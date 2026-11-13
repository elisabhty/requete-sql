/* =====================================================================
   ACHAT.JS : les abonnements de l'app iPhone, branchés sur RevenueCat
   ---------------------------------------------------------------------
   En bref : ce fichier définit window.REQUETE_ACHAT, le crochet que le
   paywall de l'onboarding attend (index.html, obPaywallHTML). Tant qu'il
   n'est pas défini, le paywall laisse passer (« Continuer ») ; une fois
   défini, seul le paiement passe la page et « Restaurer » apparaît.

   Mis en place le 10 novembre (Elisa : « ouvre RevenueCat et App Store
   Connect et fais-le ») :
   - App Store Connect : groupe « Requête Premium » (22566229), avec
     fr.requete.app.annuel (1 an, 44,99 €, 3 jours gratuits pour
     commencer) et fr.requete.app.hebdo (1 semaine, 5,99 €), base France ;
   - RevenueCat : projet « Requête », droit d'accès « premium », offre
     par défaut avec le paquet annuel et le paquet hebdomadaire.

   22 h 50 : l'app App Store est reliée dans RevenueCat (clé d'achat
   intégré et clé API App Store Connect reprises de Diction AI, même
   compte Apple), les deux produits importés, rattachés à « premium » et
   aux paquets $rc_annual et $rc_weekly de l'offre « default ». La clé
   publique iOS est dans RC_CLE_IOS. Le plugin est dans package.json
   (npm install, puis npm run ios). Sur le site, ou sans le plugin, rien
   ne change : le paywall garde « Continuer ».

   Le crochet :
   - acheter('an' | 'semaine') → Promise<bool> : true si l'abonnement est
     actif après l'achat, false si la personne a annulé la feuille Apple ;
     une vraie erreur est relancée (le paywall dit « Le paiement n'a pas
     abouti »).
   - restaurer() → Promise<bool> : true si un abonnement actif revient.
   - actif() → bool, tout de suite : la dernière réponse connue, gardée
     dans localStorage pour que l'ouverture suivante saute le paywall
     même hors ligne.
   - essaiDispo(offre) → bool : faux si Apple dit que ce compte a déjà
     eu l'essai (il ne doit pas revoir « 3 jours gratuits »).
   - prix(offre) → {prix, texte, parSemaine, devise} ou null : les prix de la
     boutique du pays de la personne (en dollars aux États-Unis…), pour
     que le paywall n'affiche pas des euros à tout le monde.

   12 novembre, 16 h 34 (Elisa : « fais-le pour le −50 ») : l'offre de
   bienvenue. Un deuxième abonnement annuel du même groupe,
   fr.requete.app.annuel.bienvenue : même prix que l'annuel, avec une
   offre de lancement Apple « payée d'avance, 1 an » à moitié prix (et
   pas d'essai gratuit : Apple n'accorde qu'une offre de lancement par
   personne et par groupe). Le paywall ne la propose qu'à qui referme la
   feuille de paiement d'Apple (index.html, obSortieProposer).
   - 'bienvenue' est une troisième offre pour acheter() et prix() ;
     prix('bienvenue').intro = {prix, texte} : ce qu'Apple facture la
     première année ;
   - sortieDispo() → bool : vrai seulement si la boutique renvoie le
     produit, son prix de lancement sur un an, et qu'Apple dit en clair
     que ce compte y a droit (statut 2). Dans le doute, l'offre ne se
     montre pas : personne ne doit lire « −50 % » puis voir le plein tarif
     sur la feuille d'Apple.

   12 novembre, 21 h 06 (Elisa : « j'ai changé de compte et j'ai pas eu
   le paywall » ; « ok pour le 1 ») : la garde. L'abonnement reste celui
   du compte Apple de l'iPhone (pas du compte Requête), et l'app le
   vérifie à chaque ouverture, à chaque retour au premier plan et après
   chaque connexion (index.html, obGardeVoir) : sans abonnement actif,
   le paywall.
   - etat() → 'oui' | 'non' | 'inconnu', tout de suite : ce qu'on sait.
     'inconnu' (jamais eu de réponse de RevenueCat) ne bloque personne.
   - verifier() → Promise<etat> : redemande à RevenueCat.
   - suivre(fn) : fn(etat) à chaque changement (réponse du serveur,
     achat, restauration, retour dans l'app).
   Une abonnée hors ligne n'est jamais bloquée : RevenueCat rend d'abord
   ce qu'il a en mémoire, et une vieille réponse peut dire « expiré »
   alors qu'Apple a renouvelé depuis. Un « non » ne remplace donc un
   « oui » que s'il vient d'une réponse du serveur plus récente que
   celle qui disait « oui » (requestDate, gardée dans GARDE_VU). Sans
   réseau, on garde le « oui ».

   13 novembre, 2 h 41 (Elisa : « pour chaque pays on a les bons prix
   sur le paywall ? ») : oui, dès que la boutique a répondu. Mais la
   garde ouvrait le paywall avant (au lancement, ou hors ligne), avec
   les prix en euros écrits dans index.html, et il ne se repeignait
   jamais : hors de la zone euro, on lisait « 44,99 € » puis un autre
   prix sur la feuille d'Apple. Le paywall attend maintenant la boutique :
   - prixConnus() → bool : l'annuel et l'hebdomadaire sont lus ;
   - prixEtat() → 'oui' | 'attente' | 'echec' (pas de réponse au bout de
     12 s, erreur, offre vide) ;
   - suivrePrix(fn) : fn(etat) à chaque réponse de la boutique ;
   - rechargerPrix() → Promise<etat> : redemande (« Réessayer »). C'est
     aussi fait au retour du réseau et au retour dans l'app.
   ===================================================================== */
(function(){
  'use strict';
  /* La clé publique iOS de RevenueCat (Projet Requête › Apps & providers › App Store › Public API key).
     Elle est faite pour être dans l'app : ce n'est pas un secret. */
  var RC_CLE_IOS = 'appl_qLAPPmCbplIcNyriYbILgTzVYYQ';
  var DROIT = 'premium';
  var GARDE = 'requete-premium';
  var GARDE_VU = 'requete-premium-vu';
  var PRODUITS = {an:'fr.requete.app.annuel', semaine:'fr.requete.app.hebdo', bienvenue:'fr.requete.app.annuel.bienvenue'};

  var C = window.Capacitor;
  var natif = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
  var P = natif && C.Plugins && C.Plugins.Purchases;
  if (!RC_CLE_IOS || !P) return;

  /* Ce qu'on sait : true (abonnée), false (pas abonnée), null (jamais eu de réponse). Et la date de la réponse qui l'a dit. */
  var su = null, vu = '';
  try { var g = localStorage.getItem(GARDE); su = g === '1' ? true : g === '0' ? false : null; vu = localStorage.getItem(GARDE_VU) || ''; } catch (e) {}
  var actifConnu = su === true;
  var suiveurs = [], dit = null;
  var paquets = {};      /* 'an' | 'semaine' → le paquet RevenueCat (à repasser tel quel à purchasePackage) */
  var essais = {};       /* 'an' | 'semaine' → false si Apple dit « déjà eu l'essai » */
  var statuts = {};      /* la réponse d'Apple telle quelle : 0 inconnu, 1 pas éligible, 2 éligible, 3 pas d'offre de lancement */

  function etat(){ return su === true ? 'oui' : su === false ? 'non' : 'inconnu'; }
  /* Les suiveurs sont prévenus après coup (au tour suivant) : l'achat ou la restauration en cours finit d'abord, le paywall
     ouvre l'app lui-même, puis la garde constate que tout est en ordre. */
  var plusTard = typeof setTimeout === 'function' ? function(f){ setTimeout(f, 0); } : function(f){ Promise.resolve().then(f); };
  function prevenir(){
    var e = etat();
    if (e === dit) return;
    dit = e;
    plusTard(function(){ suiveurs.slice().forEach(function(fn){ try { fn(e); } catch (x) {} }); });
  }
  function noterClient(info){
    var ci = info && (info.customerInfo || info);
    if (!ci || !ci.entitlements) return actifConnu;      /* rien de lisible : on garde ce qu'on sait */
    var a = !!(ci.entitlements.active && ci.entitlements.active[DROIT]);
    var date = String(ci.requestDate || ''), t = Date.parse(date), tVu = Date.parse(vu);
    if (!a && su === true) {
      /* « Non » alors qu'on la savait abonnée : seulement si le serveur a répondu depuis (voir l'en-tête). */
      var plusRecent = isFinite(t) && isFinite(tVu) && t > tVu;
      if (!plusRecent) {
        if (!vu && date) { vu = date; try { localStorage.setItem(GARDE_VU, date); } catch (e) {} }
        return actifConnu;
      }
    }
    su = a; actifConnu = a;
    if (date) vu = date;
    try { localStorage.setItem(GARDE, a ? '1' : '0'); if (date) localStorage.setItem(GARDE_VU, date); } catch (e) {}
    prevenir();
    return a;
  }
  function offreDe(pq){
    var t = pq && (pq.packageType || ''), id = pq && pq.product && pq.product.identifier;
    /* Le produit de bienvenue d'abord : c'est aussi un annuel, il ne doit jamais prendre la place du paquet « an ». */
    if (id === PRODUITS.bienvenue) return 'bienvenue';
    if (t === 'ANNUAL' || id === PRODUITS.an) return 'an';
    if (t === 'WEEKLY' || id === PRODUITS.semaine) return 'semaine';
    return '';
  }
  /* Les prix de la boutique : lus, attendus ou en échec (voir l'en-tête, 13 novembre). */
  var prixCharge = null, prixRate = false, suiveursPrix = [], DELAI_PRIX = 12000;
  function prixConnus(){ return !!(paquets.an && paquets.semaine); }
  function prixEtat(){ return prixConnus() ? 'oui' : (prixRate && !prixCharge ? 'echec' : 'attente'); }
  function direPrix(){
    var e = prixEtat();
    plusTard(function(){ suiveursPrix.slice().forEach(function(fn){ try { fn(e); } catch (x) {} }); });
  }
  function chargerOffres(){
    if (prixCharge) return prixCharge;
    var lecture = lireOffres();
    /* Une boutique qui ne répond pas (réseau coupé en route) : au bout de 12 s, « Réessayer » plutôt qu'une attente sans fin.
       Si elle répond plus tard quand même, ses prix sont pris et le paywall prévenu. */
    var delai = typeof setTimeout === 'function' ? new Promise(function(_, non){ setTimeout(function(){ non(new Error('delai')); }, DELAI_PRIX); }) : null;
    var fin = function(rate){ prixRate = rate || !prixConnus(); prixCharge = null; direPrix(); };
    lecture.then(function(){ if (!prixCharge && prixConnus() && prixRate) { prixRate = false; direPrix(); } }, function(){});
    prixCharge = (delai ? Promise.race([lecture, delai]) : lecture).then(function(){ fin(false); }, function(){ fin(true); });
    return prixCharge;
  }
  function lireOffres(){
    return P.getOfferings().then(function(r){
      var cur = r && (r.current || (r.all && r.all['default']));
      var liste = (cur && cur.availablePackages) || [];
      liste.forEach(function(pq){ var k = offreDe(pq); if (k) paquets[k] = pq; });
      var ids = Object.keys(paquets).map(function(k){ return paquets[k].product.identifier; });
      if (!ids.length || typeof P.checkTrialOrIntroductoryPriceEligibility !== 'function') return;
      return P.checkTrialOrIntroductoryPriceEligibility({productIdentifiers: ids}).then(function(el){
        Object.keys(paquets).forEach(function(k){
          var s = el && el[paquets[k].product.identifier];
          /* 1 = pas éligible (déjà eu l'essai) ; 0 = inconnu, 2 = éligible, 3 = pas d'offre : on ne cache l'essai que sur un « non » net. */
          essais[k] = !(s && Number(s.status) === 1);
          statuts[k] = s ? Number(s.status) : 0;
        });
      }, function(){});   /* sans réponse sur l'essai : les prix restent bons, l'essai reste proposé (essaiDispo) */
    });
  }
  /* Le prix de lancement d'un produit : {prix, texte} seulement s'il est payant et couvre un an d'un coup (« P1Y », un seul cycle). */
  function introDe(p){
    var i = p && p.introPrice;
    if (!i || typeof i.price !== 'number' || !(i.price > 0) || !i.priceString) return null;
    var unAn = String(i.period || '').toUpperCase() === 'P1Y' || (String(i.periodUnit || '').toUpperCase() === 'YEAR' && Number(i.periodNumberOfUnits) === 1);
    if (!unAn || (i.cycles != null && Number(i.cycles) !== 1)) return null;
    return {prix: i.price, texte: i.priceString};
  }
  function annule(e){
    return !!(e && (e.userCancelled || e.code === '1' || e.code === 1 || /cancel/i.test(String(e.message || ''))));
  }

  /* 13 novembre, 2 h 41 : les prix se lisent en même temps que l'abonnement, dès que RevenueCat a démarré ; acheter, restaurer et
     vérifier n'attendent plus la lecture des prix (elle pouvait durer). */
  var demarre = P.configure({apiKey: RC_CLE_IOS});
  var pret = demarre
    .then(function(){
      /* RevenueCat rend d'abord ce qu'il a en mémoire, puis interroge son serveur : la vraie réponse arrive ici, un peu plus tard.
         (Le pont de Capacitor attend (options, fonction) pour une méthode à rappel.) */
      try { if (typeof P.addCustomerInfoUpdateListener === 'function') P.addCustomerInfoUpdateListener({}, function(info){ if (info) noterClient(info); }); } catch (e) {}
      return P.getCustomerInfo().then(noterClient).catch(function(){});
    })
    .catch(function(){});
  demarre.then(chargerOffres, function(){ prixRate = true; direPrix(); });   /* RevenueCat ne démarre pas : pas de prix, le paywall le dit */

  function rechargerPrix(){
    if (!prixConnus()) prixRate = false;   /* tout de suite « attente » : le paywall se repeint avant la réponse */
    return pret.then(function(){ return prixConnus() ? null : chargerOffres(); }).then(prixEtat, prixEtat);
  }
  /* De retour dans l'app (abonnement annulé ou repris dans les réglages Apple) : on relit le droit ; et les prix, s'ils manquent. */
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState !== 'visible') return;
    pret.then(function(){ return P.getCustomerInfo(); }).then(noterClient).catch(function(){});
    if (!prixConnus() && prixRate) rechargerPrix();
  });
  /* Le réseau revient : les prix qui manquaient sont redemandés. */
  try { if (typeof window.addEventListener === 'function') window.addEventListener('online', function(){ if (!prixConnus()) rechargerPrix(); }); } catch (e) {}

  window.REQUETE_ACHAT = {
    acheter: function(offre){
      return pret.then(function(){ return paquets[offre] ? null : chargerOffres(); }).then(function(){
        var pq = paquets[offre];
        if (!pq) throw new Error('offre indisponible');
        return P.purchasePackage({aPackage: pq}).then(noterClient, function(e){ if (annule(e)) return false; throw e; });
      });
    },
    restaurer: function(){ return pret.then(function(){ return P.restorePurchases(); }).then(noterClient); },
    actif: function(){ return actifConnu; },
    etat: etat,
    verifier: function(){ return pret.then(function(){ return P.getCustomerInfo(); }).then(noterClient).catch(function(){}).then(etat); },
    suivre: function(fn){ if (typeof fn === 'function') suiveurs.push(fn); },
    essaiDispo: function(offre){ return essais[offre] !== false; },
    prix: function(offre){
      var pq = paquets[offre], p = pq && pq.product;
      if (!p || typeof p.price !== 'number') return null;
      return {prix: p.price, texte: p.priceString || '', parSemaine: p.pricePerWeekString || '', devise: p.currencyCode || '', intro: introDe(p)};
    },
    sortieDispo: function(){
      var pq = paquets.bienvenue, p = pq && pq.product, i = introDe(p);
      return !!(i && typeof p.price === 'number' && i.prix < p.price && statuts.bienvenue === 2);
    },
    prixConnus: prixConnus,
    prixEtat: prixEtat,
    suivrePrix: function(fn){ if (typeof fn === 'function') suiveursPrix.push(fn); },
    rechargerPrix: rechargerPrix
  };
  /* L'app est peut-être déjà ouverte (ce fichier se charge après elle) : la garde démarre dès que le crochet existe. */
  try { if (typeof window.obGardeDemarrer === 'function') window.obGardeDemarrer(); } catch (e) {}
})();
