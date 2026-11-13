/* =====================================================================
   MAJ.JS : corriger l'appli iPhone sans repasser par Apple
   ---------------------------------------------------------------------
   Elisa, 13 novembre, 11 h 49 : « comment faire si je veux modifier un
   cours, ajouter un parcours, modifier une faute, sans passer par une
   mise en prod Apple », puis « oui stp ».

   En bref : tout le contenu de l'appli (index.html, les styles, les
   scripts, les cours, les voix) est embarqué dans l'appli envoyée à
   Apple. Ce fichier permet de remplacer cette partie web par une version
   plus récente, publiée sur requeteapp.com, sans nouvel envoi à Apple.
   La coque native (widgets, île, plugins, achats) ne change pas par là.

   Le plugin : @capgo/capacitor-updater (open source), en mode manuel et
   sans service tiers. Rien ne part chez Capgo : ni vérification, ni
   statistiques (capacitor.config.json : autoUpdate false ; updateUrl,
   statsUrl et channelUrl vides). L'appli ne parle qu'à requeteapp.com.

   Le site annonce la version que chaque iPhone doit avoir
   (https://requeteapp.com/maj/version.json, fabriqué à chaque mise en
   ligne du site à partir de maj/publication.json). Ce fichier fait le
   reste, dans cet ordre :
   1. Au lancement (ici, dans l'en-tête de la page) : si une version plus
      récente a déjà été téléchargée, elle est installée tout de suite
      (CapacitorUpdater.set : la page se recharge sur le nouveau contenu,
      sous l'écran de lancement). Jamais en cours d'utilisation : on ne
      perd pas une leçon commencée.
   2. Une fois l'appli démarrée (boot, dans index.html, appelle
      REQUETE_MAJ.pret) : on confirme au plugin que cette version marche
      (notifyAppReady). Sans cette confirmation dans les 20 secondes, le
      plugin revient de lui-même à la version d'avant.
   3. Quelques secondes plus tard, puis à chaque retour dans l'appli (au
      plus une fois toutes les 30 minutes) : on lit l'annonce du site.
      - Elle annonce une version plus récente : on télécharge la liste de
        ses fichiers (le manifeste) et le plugin fabrique le nouveau
        contenu. Chaque fichier inchangé est repris de l'appli (les
        108 Mo de voix ne sont pas retéléchargés) ; seuls les fichiers
        modifiés viennent du site, vérifiés un par un (empreinte SHA-256).
        La version attend alors le prochain lancement (étape 1).
      - Elle annonce une version plus ancienne que la version téléchargée
        en cours (une publication retirée) : au prochain lancement,
        l'iPhone revient au contenu embarqué dans l'appli.

   Les garde-fous :
   - une version qui ne démarre pas est essayée deux fois au plus sur un
     même iPhone, puis écartée pendant sept jours ;
   - les adresses de téléchargement doivent être sous requeteapp.com ;
   - une publication peut exiger une appli assez récente (natifMin) ;
   - quand l'appli est mise à jour par l'App Store, le plugin efface les
     versions téléchargées : le contenu embarqué, plus récent, reprend.

   Les versions d'essai : une publication peut être réservée aux iPhone
   « en essai » (sept touchers sur le numéro de version, dans Mon
   compte), pour la voir sur un vrai téléphone avant tout le monde.

   Sur le site, dans un navigateur, ou sans le plugin : rien ne se passe.
   Publier une version : scripts/maj-publier.mjs (voir IOS.md).
   ===================================================================== */
(function () {
  'use strict';

  /* Le même identifiant que SW_CACHE (index.html) et CACHE (sw.js) : la montée de version le remplace partout à la fois. */
  var NOM = 'requete-2026-11-13-sortie-v2956';
  var ORIGINE = 'https://requeteapp.com/';
  var ANNONCE = ORIGINE + 'maj/version.json';
  var PAUSE_MS = 30 * 60 * 1000;           // entre deux lectures de l'annonce
  var REPRISE_MS = 5 * 60 * 1000;          // après une lecture ratée (pas de réseau, site injoignable)
  var ATTENTE_MS = 8000;                   // après le démarrage, avant la première lecture
  var ESSAIS_MAX = 2;                      // lancements ratés tolérés pour une même version
  var REFUS_MS = 7 * 24 * 3600 * 1000;     // durée pendant laquelle une version écartée n'est plus proposée
  var DELAI_MS = 12000;                    // attente d'une réponse du site
  var CLE = {
    prete: 'requete-maj-prete',     // {id, version} : téléchargée, à installer au prochain lancement
    essais: 'requete-maj-essais',   // {version: nombre d'installations sans confirmation}
    refus: 'requete-maj-refus',     // {version, le} : écartée sur cet iPhone
    retour: 'requete-maj-retour',   // {version} : revenir au contenu embarqué au prochain lancement
    vu: 'requete-maj-vu',           // date de la dernière lecture de l'annonce
    etat: 'requete-maj-etat',       // le dernier événement, pour comprendre après coup
    canal: 'requete-maj-canal',     // 'essai' : cet iPhone reçoit aussi les versions d'essai
    session: 'requete-maj-session'  // (sessionStorage) la version déjà installée depuis l'ouverture de l'appli
  };

  function numero(nom) { var m = /v(\d+)$/.exec(String(nom == null ? '' : nom)); return m ? +m[1] : 0; }
  function entier(x) { var n = Math.floor(+x); return n > 0 && isFinite(n) ? n : 0; }
  var VERSION = numero(NOM);

  function lire(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function ecrire(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function noter(quoi, detail) {
    ecrire(CLE.etat, { le: Date.now(), quoi: quoi, detail: detail == null ? '' : String((detail && detail.message) || detail).slice(0, 200) });
    return quoi;
  }
  function canal() { return lire(CLE.canal) === 'essai' ? 'essai' : ''; }

  /* Dans l'appli iPhone, la page n'a pas de service worker : c'est ici que « Version », dans Mon compte, prend son numéro. */
  try { if (!window.APP_VERSION) window.APP_VERSION = NOM; } catch (e) {}

  var C = window.Capacitor;
  var natif = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
  var P = (natif && C.Plugins && C.Plugins.CapacitorUpdater) || null;
  if (P && (typeof P.set !== 'function' || typeof P.notifyAppReady !== 'function' || typeof P.download !== 'function' || typeof P.current !== 'function')) P = null;

  /* Un appel au plugin : toujours une promesse, jamais une exception. */
  function appeler(methode, options) {
    try {
      if (!P || typeof P[methode] !== 'function') return Promise.reject(new Error(methode + ' absent'));
      return Promise.resolve(P[methode](options));
    } catch (e) { return Promise.reject(e); }
  }

  /* ---------- 1. Au lancement : installer la version déjà téléchargée ---------- */
  var installation = false;   // la page va être remplacée : elle ne confirme rien et ne télécharge rien
  var signale = false;        // boot a prévenu que l'appli a démarré (ou qu'elle n'y est pas arrivée)
  var bon = false;            // … et le démarrage s'est bien passé

  function dejaTentee(v) { try { return sessionStorage.getItem(CLE.session) === String(v); } catch (e) { return false; } }
  function tenter(v) { try { sessionStorage.setItem(CLE.session, String(v)); } catch (e) {} }

  function appliquer() {
    if (!P) return 'rien';
    var retour = lire(CLE.retour);
    if (retour) {
      ecrire(CLE.retour, null);
      /* La version téléchargée en cours a été retirée du site : retour au contenu embarqué dans l'appli. */
      if (+retour.version === VERSION) {
        ecrire(CLE.prete, null); ecrire(CLE.essais, null);
        installation = true;
        appeler('reset', {}).catch(function (e) { installation = false; noter('retour raté', e); reprendre(); });
        return 'retour';
      }
    }
    var prete = lire(CLE.prete);
    var v = prete ? entier(prete.version) : 0;
    if (!prete || !prete.id || !(v > VERSION)) return 'rien';
    var essais = lire(CLE.essais) || {};
    var n = entier(essais[v]);
    if (n >= ESSAIS_MAX) {
      /* Installée deux fois sans jamais confirmer son démarrage : cette version ne marche pas sur cet iPhone. */
      ecrire(CLE.refus, { version: v, le: Date.now() });
      ecrire(CLE.prete, null); ecrire(CLE.essais, null);
      return 'écartée';
    }
    /* Le plugin vient de revenir à la version d'avant (même ouverture de l'appli) : pas de nouvel essai avant le prochain lancement. */
    if (dejaTentee(v)) return 'rien';
    tenter(v);
    var suivi = {}; suivi[v] = n + 1;
    ecrire(CLE.essais, suivi);
    installation = true;
    appeler('set', { id: prete.id }).catch(function (e) {
      /* Le paquet n'existe plus (l'appli a été mise à jour par l'App Store, ou le plugin l'a effacé) : ce n'était pas un essai.
         On l'oublie : la prochaine lecture de l'annonce le retéléchargera s'il est toujours d'actualité. */
      installation = false;
      ecrire(CLE.prete, null);
      var s = {}; if (n > 0) s[v] = n;
      ecrire(CLE.essais, n > 0 ? s : null);
      noter('installation ratée', e);
      reprendre();
    });
    return 'installée';
  }

  /* ---------- 2. L'appli a démarré : cette version marche ---------- */
  function confirmer() {
    if (bon) {
      appeler('notifyAppReady').catch(function () {});
      /* La version attendue tourne : plus rien à installer, plus d'essai à compter. */
      var prete = lire(CLE.prete);
      if (prete && !(entier(prete.version) > VERSION)) ecrire(CLE.prete, null);
      var essais = lire(CLE.essais);
      if (essais && essais[VERSION] != null) ecrire(CLE.essais, null);
      var refus = lire(CLE.refus);
      if (refus && !(entier(refus.version) > VERSION)) ecrire(CLE.refus, null);
    }
    /* Même après un démarrage raté, on lit l'annonce : c'est peut-être elle qui apporte la correction.
       13 novembre, 14 h 59 (Elisa : « Sur TestFlight, j'ai toujours la version 29 ») : à chaque lancement, l'annonce est lue, même si
       elle l'a été il y a moins d'une demi-heure. Avant, une lecture faite juste avant la publication (« à jour ») faisait attendre
       30 minutes, même en relançant l'appli. La demi-heure ne vaut plus que pour les retours dans l'appli. */
    setTimeout(function () { verifier(true); }, ATTENTE_MS);
  }
  function reprendre() { if (signale && P && !installation) confirmer(); }
  /* boot (index.html) : pret() quand les écrans sont prêts, pret(false) quand le démarrage a échoué. */
  function pret(ok) {
    if (signale) return;
    signale = true;
    bon = ok !== false;
    if (!P || installation) return;
    confirmer();
  }

  /* ---------- 3. Que dit le site ? ---------- */
  function chercher(url) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var t = setTimeout(function () { try { if (ctl) ctl.abort(); } catch (e) {} }, DELAI_MS);
    return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), { cache: 'no-store', credentials: 'omit', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r || !r.ok) throw new Error('réponse ' + (r ? r.status : 'vide')); return r.json(); })
      .then(function (j) { clearTimeout(t); return j; }, function (e) { clearTimeout(t); throw e; });
  }
  function sousLeSite(url) { return typeof url === 'string' && url.indexOf(ORIGINE) === 0 && url.indexOf('..') < 0 && url.indexOf('\\') < 0; }
  /* « 1.2 » contre « 1.10.3 » : nombre par nombre. */
  function comparer(a, b) {
    var x = String(a == null ? '' : a).split('.'), y = String(b == null ? '' : b).split('.');
    for (var i = 0; i < Math.max(x.length, y.length); i++) {
      var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
      if (d) return d < 0 ? -1 : 1;
    }
    return 0;
  }
  /* Une publication peut demander une appli assez récente (une fonction native ajoutée depuis), ou pas trop récente.
     La version de l'appli est celle de l'App Store (1.0, 1.1…). Inconnue (0.0.0), on ne bloque pas. */
  function natifConvient(cible, natifVersion) {
    if (!natifVersion || comparer(natifVersion, '0') === 0) return true;
    if (cible.natifMin && comparer(natifVersion, cible.natifMin) < 0) return false;
    if (cible.natifMax && comparer(natifVersion, cible.natifMax) > 0) return false;
    return true;
  }
  function manifesteSur(m) {
    if (!Array.isArray(m) || m.length < 50 || m.length > 6000) return false;
    var index = false, moi = false;
    for (var i = 0; i < m.length; i++) {
      var e = m[i];
      if (!e || typeof e.file_name !== 'string' || !e.file_name || e.file_name.charAt(0) === '/' || e.file_name.indexOf('..') >= 0 || e.file_name.indexOf('\\') >= 0) return false;
      if (!/^[0-9a-f]{64}$/.test(String(e.file_hash))) return false;
      if (!sousLeSite(e.download_url)) return false;
      if (e.file_name === 'index.html') index = true;
      if (e.file_name === 'maj.js') moi = true;
    }
    return index && moi;
  }
  function ecartee(v) {
    var refus = lire(CLE.refus);
    if (!refus || entier(refus.version) !== v) return false;
    if (Date.now() - (+refus.le || 0) > REFUS_MS) { ecrire(CLE.refus, null); return false; }
    return true;
  }
  /* La version que cet iPhone doit avoir : celle publiée pour tous, ou la version d'essai si elle est plus récente et l'iPhone en essai. */
  function choisir(pub) {
    if (!pub || typeof pub !== 'object' || typeof pub.version !== 'number') return null;
    var c = { version: entier(pub.version), manifeste: pub.manifeste, natifMin: pub.natifMin, natifMax: pub.natifMax };
    var e = pub.essai;
    if (canal() === 'essai' && e && typeof e === 'object' && entier(e.version) > c.version) {
      c = { version: entier(e.version), manifeste: e.manifeste, natifMin: e.natifMin, natifMax: e.natifMax };
    }
    return c;
  }
  function utilisable(b) { return !!b && (b.status === 'pending' || b.status === 'success'); }

  var enCours = false;
  function verifier(force) {
    if (!P || enCours || installation) return Promise.resolve('rien');
    try { if (navigator.onLine === false) return Promise.resolve('hors ligne'); } catch (e) {}
    if (!force && Date.now() - (+lire(CLE.vu) || 0) < PAUSE_MS) return Promise.resolve('attente');
    enCours = true;
    ecrire(CLE.vu, Date.now());
    return chercher(ANNONCE).then(function (pub) {
      var cible = choisir(pub);
      if (!cible) return noter('annonce illisible');
      var v = cible.version;
      return appeler('current').then(function (cur) {
        var actuel = (cur && cur.bundle && cur.bundle.id) || 'builtin';
        var prete = lire(CLE.prete);
        if (prete && entier(prete.version) !== v) { ecrire(CLE.prete, null); prete = null; }   // une version prête qui n'est plus celle annoncée
        if (v === VERSION) return noter('à jour');
        if (v < VERSION) {
          /* L'annonce est plus ancienne que la version en cours. Si celle-ci a été téléchargée, la publication a été retirée :
             retour au contenu embarqué au prochain lancement. Si c'est le contenu embarqué, il est simplement plus récent. */
          if (actuel !== 'builtin') { ecrire(CLE.retour, { version: VERSION }); return noter('version retirée', 'v' + VERSION); }
          return noter('à jour');
        }
        if (ecartee(v)) return noter('version écartée', 'v' + v);
        if (!natifConvient(cible, cur && cur.native)) return noter('appli à mettre à jour', cur && cur.native);
        if (!sousLeSite(cible.manifeste)) return noter('adresse refusée', cible.manifeste);
        return appeler('list', {}).then(function (l) { return (l && l.bundles) || []; }, function () { return null; }).then(function (paquets) {
          if (prete && prete.id) {
            /* Déjà téléchargée. On vérifie quand même que le paquet existe encore (le plugin efface une version qui n'a pas démarré). */
            if (!paquets) return noter('prête', 'v' + v);
            for (var i = 0; i < paquets.length; i++) if (paquets[i].id === prete.id && utilisable(paquets[i])) return noter('prête', 'v' + v);
            ecrire(CLE.prete, null);
          }
          var nom = 'v' + v, menage = 0;
          for (var j = 0; paquets && j < paquets.length; j++) {
            var b = paquets[j];
            if (!b || !b.id || b.id === 'builtin' || b.id === actuel || b.status !== 'pending') continue;
            /* Un téléchargement fini dont la page n'a pas eu la réponse (appli fermée entre-temps) : on le reprend tel quel. */
            if (b.version === nom) { ecrire(CLE.prete, { id: b.id, version: v, le: Date.now() }); return noter('prête', nom); }
            /* Une ancienne version téléchargée, jamais installée : elle ne sert plus. */
            if (menage++ < 3) appeler('delete', { id: b.id }).catch(function () {});
          }
          return chercher(cible.manifeste).then(function (m) {
            if (!manifesteSur(m)) throw new Error('manifeste refusé');
            return appeler('download', { url: cible.manifeste, version: nom, manifest: m });
          }).then(function (paquet) {
            if (!paquet || !paquet.id) throw new Error('paquet sans identifiant');
            ecrire(CLE.prete, { id: paquet.id, version: v, le: Date.now() });
            return noter('prête', nom);
          });
        });
      });
    }).catch(function (e) {
      ecrire(CLE.vu, Date.now() - PAUSE_MS + REPRISE_MS);
      return noter('vérification ratée', e);
    }).then(function (r) { enCours = false; return r; });
  }

  /* ---------- Ce que voit le reste de l'appli ---------- */
  window.REQUETE_MAJ = {
    version: VERSION,
    nom: NOM,
    branchee: !!P,
    pret: pret,
    verifier: verifier,
    /* Sans argument : le canal de cet iPhone ('' ou 'essai'). Avec : le change, puis relit l'annonce. */
    canal: function (nouveau) {
      if (arguments.length) {
        ecrire(CLE.canal, nouveau === 'essai' ? 'essai' : null);
        if (signale) verifier(true);
      }
      return canal();
    },
    /* Pour « Version », dans Mon compte : la version téléchargée qui attend le prochain lancement, le canal, le dernier événement. */
    etat: function () {
      var prete = lire(CLE.prete);
      var v = prete ? entier(prete.version) : 0;
      return { version: VERSION, branchee: !!P, prete: v > VERSION ? v : 0, canal: canal(), retour: !!lire(CLE.retour), dernier: lire(CLE.etat) };
    }
  };

  var fait = appliquer();
  if (fait !== 'rien') noter(fait === 'installée' ? 'installation' : fait, 'depuis v' + VERSION);

  /* Au retour dans l'appli, une lecture de l'annonce (au plus une toutes les 30 minutes). */
  try {
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && signale) verifier(); });
  } catch (e) {}
})();
