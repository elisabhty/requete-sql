/* =====================================================================
   LANGUES.JS : Requête en plusieurs langues (l'anglais d'abord)
   ---------------------------------------------------------------------
   Elisa, 13 novembre, 12 h 30 : « tu peux mettre un truc en place pour
   faciliter la traduction dans plusieurs langues, en premier anglais ».
   Ses choix : dans la version anglaise, les tables des cours passent en
   anglais (customers, orders…) ; d'abord le système et un pilote
   (l'onboarding et les écrans principaux), les cours module par module.

   En bref : le français reste la source. Rien ne change dans index.html :
   les textes y restent écrits en français. Chaque langue est un fichier
   (langue-en.js) qui donne, pour chaque texte français, sa traduction.
   À l'affichage, ce fichier-ci remplace les textes de la page par leur
   traduction ; un texte sans traduction reste en français, et il est
   noté (REQUETE_LANGUE.manquants()) pour qu'on sache quoi traduire.

   En français, ce fichier ne fait rien : pas d'observateur, pas de coût.

   Les parties :
   1. La langue de cet iPhone (requete-langue ; une langue « en essai »
      n'est proposée qu'aux iPhone en essai, voir maj.js).
   2. Traduire un texte : t(« texte français »). Les nombres sont mis de
      côté (« 3 leçons sur 12 » se cherche sous « {1} leçons sur {2} »),
      le prénom aussi (« Bonjour {prenom} »).
   3. Traduire la page : un observateur remplace les textes et les
      attributs (placeholder, aria-label, title, alt) dès qu'ils arrivent
      dans la page. Une phrase avec du gras ou du code se traduit d'un
      bloc : « Utilise <1/> pour <2>filtrer</2> » (<1/> : un morceau gardé
      tel quel, du code, une icône ; <2>…</2> : un morceau mis en forme).
      Ce qui porte data-notrad, les zones de saisie et le code ne sont
      jamais touchés.
   4. Le SQL : sql(« SELECT nom FROM clients ») rend la requête écrite pour
      la base de la langue (SELECT last_name FROM customers), et base(db)
      renomme les tables, les colonnes et les valeurs d'une base SQLite.

   Ajouter une langue : LANGUES.md.
   ===================================================================== */
(function () {
  'use strict';

  /* essai : la langue n'est proposée qu'aux iPhone en essai, tant que sa traduction n'est pas terminée. */
  var LANGUES = {
    fr: { nom: 'Français', locale: 'fr-FR' },
    en: { nom: 'English', locale: 'en-US', fichier: 'langue-en.js?v=7', defis: 'langue-en-defis.js?v=2', entretien: 'langue-en-entretien.js?v=1', essai: true }
  };
  var CLE = 'requete-langue';

  /* ---------- 1. La langue de cet iPhone ---------- */
  function lire(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function enEssai() {
    try { return JSON.parse(lire('requete-maj-canal') || 'null') === 'essai' || lire('requete-langue-essai') === '1'; } catch (e) { return false; }
  }
  function disponibles() { return Object.keys(LANGUES).filter(function (c) { return !LANGUES[c].essai || enEssai(); }); }
  function choisir() {
    /* Sur une page de mise au point (localhost) ou pilotée par un test : ?langue=en */
    try {
      var h = location.hostname, m = /[?&]langue=([a-z]{2})\b/.exec(location.search);
      if (m && LANGUES[m[1]] && (h === 'localhost' || h === '127.0.0.1' || navigator.webdriver)) { localStorage.setItem('requete-langue-essai', '1'); localStorage.setItem(CLE, m[1]); }
    } catch (e) {}
    var voulu = lire(CLE), dispo = disponibles();
    if (voulu && dispo.indexOf(voulu) >= 0) return voulu;
    return automatique();
  }
  /* Sans choix (Elisa, 13 novembre, 12 h 57 : « vérifie par rapport aux langues de chaque pays laquelle afficher, par exemple en
     Afrique beaucoup seront en français, mais peuvent changer la langue avec un réglage »).
     1. La première langue de l'iPhone que l'appli parle (une langue en essai ne compte pas).
     2. Sinon (un iPhone en arabe, en espagnol, en allemand…) : le français dans les pays où il est langue officielle ou seconde
        langue courante, l'anglais partout ailleurs. Le pays : celui des réglages de l'iPhone (« ar-MA »), à défaut son fuseau
        horaire. La Belgique, la Suisse et le Canada n'y sont pas : un iPhone en français y est déjà en français, et les autres
        (néerlandais, allemand) lisent plus volontiers l'anglais.
     Dans tous les cas, le réglage « Langue » de Mon compte permet de changer. */
  var FRANCOPHONES = 'FR MC LU SN CI ML BF NE TG BJ GN CM GA CG CD CF TD DJ KM MG BI MU MR MA DZ TN HT GP MQ GF RE YT PM BL MF NC PF WF'.split(' ');
  var FUSEAUX = ('Europe/Paris Europe/Monaco Europe/Luxembourg Africa/Dakar Africa/Abidjan Africa/Bamako Africa/Ouagadougou Africa/Niamey Africa/Lome Africa/Porto-Novo ' +
    'Africa/Conakry Africa/Douala Africa/Libreville Africa/Brazzaville Africa/Kinshasa Africa/Lubumbashi Africa/Bangui Africa/Ndjamena Africa/Djibouti Indian/Comoro ' +
    'Indian/Antananarivo Africa/Bujumbura Indian/Mauritius Africa/Nouakchott Africa/Casablanca Africa/El_Aaiun Africa/Algiers Africa/Tunis America/Port-au-Prince ' +
    'America/Guadeloupe America/Martinique America/Cayenne Indian/Reunion Indian/Mayotte America/Miquelon America/St_Barthelemy America/Marigot Pacific/Noumea ' +
    'Pacific/Tahiti Pacific/Marquesas Pacific/Gambier Pacific/Wallis').split(' ');
  function automatique() {
    var finies = Object.keys(LANGUES).filter(function (c) { return !LANGUES[c].essai; }), liste = [], i, m;
    try { liste = (navigator.languages && navigator.languages.length ? Array.prototype.slice.call(navigator.languages) : [navigator.language || '']).map(String); } catch (e) {}
    for (i = 0; i < liste.length; i++) { var c = liste[i].slice(0, 2).toLowerCase(); if (finies.indexOf(c) >= 0) return c; }
    if (finies.indexOf('en') < 0) return 'fr';
    for (i = 0; i < liste.length; i++) if ((m = /[-_]([A-Za-z]{2})(?![A-Za-z])/.exec(liste[i]))) return FRANCOPHONES.indexOf(m[1].toUpperCase()) >= 0 ? 'fr' : 'en';
    var fuseau = ''; try { fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    return FUSEAUX.indexOf(fuseau) >= 0 ? 'fr' : 'en';
  }
  var CODE = choisir();
  var TRAD = null;   // {textes: {français: traduction}, base: {…}} une fois le fichier de la langue chargé

  /* ---------- 2. Traduire un texte ---------- */
  var valeurs = {};   // {prenom: () => 'Elisa'} : mis de côté avant de chercher la traduction
  var manque = new Map(), MANQUE_MAX = 6000;
  function propre(s) { return String(s).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  /* Un nombre français (« 1 200,5 ») écrit dans la langue (« 1,200.5 ») */
  function nombre(n) { return CODE === 'fr' ? n : n.replace(/,(\d+)$/, '.$1').replace(/ /g, ','); }
  /* Rend la traduction, ou null. cle : le texte français, déjà nettoyé (propre). */
  function chercher(cle) {
    var D = TRAD && TRAD.textes;
    if (!D || !cle) return null;
    if (Object.prototype.hasOwnProperty.call(D, cle)) return D[cle];
    /* Le prénom, puis les nombres, mis de côté */
    var r = gabaritCherche(cle, true);
    /* 15 novembre : une valeur nommée retenue d'avant (le titre « Transactions » de la prochaine étape) ne doit pas cacher un autre
       texte qui la contient (« Module 12 · Transactions et concurrence ») : sans traduction avec elle, on cherche sans elle. */
    if (r === null && gabaritCherche.vu) r = gabaritCherche(cle, false);
    return r;
  }
  function gabaritCherche(cle, avecValeurs) {
    var D = TRAD.textes, mis = {}, gabarit = cle, k, vu = false;
    if (avecValeurs) for (k in valeurs) {
      var v = ''; try { v = propre(valeurs[k]() || ''); } catch (e) {}
      if (v.length >= 2 && gabarit.indexOf(v) >= 0) { gabarit = gabarit.split(v).join('{' + k + '}'); mis[k] = v; vu = true; }
    }
    gabaritCherche.vu = vu;
    /* Le pseudo d’un autre joueur (« Profil de @nora ») : {p1}, {p2}… (14 novembre : l’interface en anglais) */
    var p = 0;
    gabarit = gabarit.replace(/(^|[^\wÀ-ÿ@])(@[A-Za-z0-9À-ÿ._-]{2,16})/g, function (tout, avant, ps) { p++; mis['p' + p] = ps; return avant + '{p' + p + '}'; });
    /* Les mois et les jours (TRAD.mots) : « le 15 mars » se cherche sous « le {1} {m1} » */
    if (TRAD.mots) {
      if (!TRAD.motsRe) TRAD.motsRe = new RegExp('(^|[^A-Za-zÀ-ÿ])(' + Object.keys(TRAD.mots).sort(function (a, b) { return b.length - a.length; }).map(function (m) { return m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')(?![A-Za-zÀ-ÿ])', 'gi');
      var j = 0;
      gabarit = gabarit.replace(TRAD.motsRe, function (tout, avant, mot) { j++; mis['m' + j] = TRAD.mots[mot.toLowerCase()]; return avant + '{m' + j + '}'; });
    }
    /* Les nombres, sauf ceux des morceaux (<1/>, <2>…</2>) */
    var i = 0;
    gabarit = gabarit.replace(/<[^>]*>|\{[a-z0-9]+\}|\d{1,3}(?: \d{3})+(?:,\d+)?|\d+(?:,\d+)?/g, function (n) { if (n.charAt(0) === '<' || n.charAt(0) === '{') return n; i++; mis[i] = nombre(n); return '{' + i + '}'; });
    if (gabarit === cle || !Object.prototype.hasOwnProperty.call(D, gabarit)) return null;
    /* Une valeur nommée qui a sa traduction (le nom d’un niveau) est remise traduite ; le prénom et les pseudos, tels quels */
    return String(D[gabarit]).replace(/\{([a-z0-9]+)\}/g, function (tout, nom) {
      if (!(nom in mis)) return tout;
      var v = mis[nom];
      return /^(?:\d+|m\d+|p\d+|prenom|pseudo)$/.test(nom) || !Object.prototype.hasOwnProperty.call(D, v) ? v : D[v];
    });
  }
  /* Du SQL affiché (un décor, un exemple) n'est pas un texte à traduire. */
  var SQL_RE = /^(?:<\d+>)?\s*(?:SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|JOIN|INNER JOIN|LEFT JOIN|INSERT|UPDATE|DELETE|CREATE|WITH|UNION)\b/;
  var connues = null;   // les traductions elles-mêmes : un texte déjà dans la langue n'est pas un texte qui manque
  function dejaTraduit(cle) {
    if (!connues) { connues = new Set(); var D = (TRAD && TRAD.textes) || {}; for (var k in D) connues.add(propre(String(D[k]).replace(/<\/?\d+\/?>/g, ''))); }
    return connues.has(cle.replace(/<\/?\d+\/?>/g, ''));
  }
  function noter(cle) {
    if (TRAD && dejaTraduit(cle)) return;
    var nu = cle.replace(/<[^>]*>/g, '');
    if (manque.size < MANQUE_MAX && (/[A-Za-zÀ-ÿ]{2}/.test(nu) || /(^|[\s\d])[àÀ](?=[\s\d:\u00a0]|$)/.test(nu)) && !SQL_RE.test(cle)) manque.set(cle, (manque.get(cle) || 0) + 1);
  }
  /* Pour un texte fabriqué en JavaScript qui ne passe pas par la page (une notification, un texte envoyé au widget). */
  function t(texte) {
    if (CODE === 'fr' || texte == null) return texte;
    var cle = propre(texte), r = chercher(cle);
    if (r == null) { noter(cle); return texte; }
    return r;
  }

  /* ---------- 4. Le SQL : la base et les requêtes dans la langue ---------- */
  /* base : {tables: {clients: ['customers', {nom: 'last_name', …}], …}, valeurs: {'Livrée': 'Delivered', …}} */
  /* Le dictionnaire du SQL : celui de la base des cours (TRAD.base), ou, le temps d'un appel, celui de la base d'un défi
     (TRAD.bases.aquarium, 15 novembre : « il faut qu'un Anglais comprenne ce qu'il y a dans la base ») ou son inverse (versFrancais). */
  var dicoCourant = null, versFr = false;
  function dico() { return dicoCourant || (TRAD && TRAD.base) || null; }
  function tablesBase() { var d = dico(); return (d && d.tables) || null; }
  /* Découpe une requête : mots, chaînes, commentaires, le reste. */
  function decouper(sql) {
    var re = /('(?:[^']|'')*')|("(?:[^"]|"")*")|(--[^\n]*|\/\*[\s\S]*?\*\/)|([A-Za-z_À-ÿ][\wÀ-ÿ$]*)|([\s\S])/g, m, liste = [];
    while ((m = re.exec(sql))) liste.push(m[1] ? { g: 'chaine', v: m[1] } : m[2] ? { g: 'nom', v: m[2].slice(1, -1), guillemets: true } : m[3] ? { g: 'autre', v: m[3] } : m[4] ? { g: 'nom', v: m[4] } : { g: 'autre', v: m[5] });
    return liste;
  }
  function casse(modele, mot) { return modele === modele.toUpperCase() && /[A-Z]/.test(modele) ? mot.toUpperCase() : mot; }
  /* Une colonne citée sans sa table (« la colonne <code>prenom</code> », FOREIGN KEY (client_id) avant REFERENCES) : sa traduction si
     toutes les tables qui l'ont la traduisent pareil (client_id : customer_id) ; sinon celle de base.defauts, à défaut celle de la
     première table qui l'a (nom : last_name, celui des clients). */
  function colonneSeule(nom) {
    var T = tablesBase(), D = (dico() && dico().defauts) || {}, vu = null, k;
    if (Object.prototype.hasOwnProperty.call(D, nom)) return D[nom];
    for (k in T) if (Object.prototype.hasOwnProperty.call(T[k][1], nom)) { if (vu == null) vu = T[k][1][nom]; else if (vu !== T[k][1][nom]) return vu; }
    return vu;
  }
  /* contexte : le texte autour (le reste de l'éditeur, la phrase) ; ses tables servent aux colonnes citées seules (une ligne
     « SELECT nom, » dont le FROM produits est à la ligne d'après). */
  function sql(requete, contexte) {
    var T = tablesBase();
    if (CODE === 'fr' || !T || requete == null) return requete;
    var autour = [], deja = {}, t;
    /* Le contexte peut être déjà traduit (la ligne FROM products passée avant la ligne SELECT) : les noms anglais des tables comptent aussi */
    for (t in T) deja[String(T[t][0]).toLowerCase()] = t;
    if (contexte) decouper(String(contexte)).forEach(function (x) { var n = x.g === 'nom' ? x.v.toLowerCase() : ''; n = T[n] ? n : deja[n] || ''; if (n && autour.indexOf(n) < 0) autour.push(n); });
    var L = decouper(String(requete)), valeursBase = (dico().valeurs) || {}, i, j;
    var suivant = function (k) { for (k++; k < L.length; k++) if (L[k].g !== 'autre' || /\S/.test(L[k].v)) return k; return -1; };
    var precedent = function (k) { for (k--; k >= 0; k--) if (L[k].g !== 'autre' || /\S/.test(L[k].v)) return k; return -1; };
    /* Les tables citées, et leurs alias (FROM clients c, JOIN commandes AS co) */
    var citees = [], alias = {};
    for (i = 0; i < L.length; i++) {
      var x = L[i], nomTable = x.g === 'nom' ? x.v.toLowerCase() : '';
      if (!nomTable || !T[nomTable]) continue;
      var avant = precedent(i);
      if (avant >= 0 && L[avant].v === '.') continue;   // schéma.table : rare, laissé
      var apres = suivant(i);
      if (apres >= 0 && L[apres].v === '.') { x.table = nomTable; continue; }   // clients.nom : la table sert de préfixe
      /* Suivi d'une parenthèse, c'est encore la table (REFERENCES clients(id), INSERT INTO clients (…), CREATE TABLE clients () :
         aucune fonction SQL ne porte le nom d'une table de la base. */
      x.table = nomTable; citees.push({ table: nomTable, i: i });
      j = apres;
      if (j >= 0 && L[j].g === 'nom' && L[j].v.toUpperCase() === 'AS') j = suivant(j);
      if (j >= 0 && L[j].g === 'nom' && !T[L[j].v.toLowerCase()] && !/^(ON|USING|WHERE|GROUP|ORDER|HAVING|LIMIT|JOIN|INNER|LEFT|RIGHT|FULL|CROSS|NATURAL|UNION|EXCEPT|INTERSECT|SET|VALUES|AS)$/i.test(L[j].v)) { alias[L[j].v.toLowerCase()] = nomTable; L[j].alias = true; }
    }
    /* Les alias posés ailleurs dans le contexte (15 novembre, SELF JOIN : « FROM commandes AS c1 » sur une autre carte que
       « c1.client_id ») : un préfixe inconnu de la requête y est cherché. */
    if (contexte) { var C = decouper(String(contexte)).filter(function (x) { return x.g !== 'autre' || /\S/.test(x.v); });
      for (i = 0; i + 1 < C.length; i++) { var tc = C[i].g === 'nom' ? C[i].v.toLowerCase() : ''; tc = T[tc] ? tc : deja[tc] || ''; if (!tc || (C[i + 1].v === '.')) continue;
        j = i + 1; if (C[j].g === 'nom' && C[j].v.toUpperCase() === 'AS') j++;
        if (j < C.length && C[j].g === 'nom' && !T[C[j].v.toLowerCase()] && !deja[C[j].v.toLowerCase()] && !/^(ON|USING|WHERE|GROUP|ORDER|HAVING|LIMIT|JOIN|INNER|LEFT|RIGHT|FULL|CROSS|NATURAL|UNION|EXCEPT|INTERSECT|SET|VALUES|AS)$/i.test(C[j].v) && !alias[C[j].v.toLowerCase()]) alias[C[j].v.toLowerCase()] = tc; } }
    /* 15 novembre, base Salle de sport : dans CREATE TABLE t (…) et INSERT INTO t (…), une colonne est celle de t, même si une
       table citée plus près (REFERENCES adherents(id)) a une colonne du même nom (date_inscription : join_date, booking_date). */
    (function () {
      var k, prof = 0, cible = null, debut = false, etat = 0;
      for (k = 0; k < L.length; k++) {
        var z = L[k], uz = z.g === 'nom' ? z.v.toUpperCase() : '';
        if (!cible) {
          if (uz === 'CREATE' || uz === 'INSERT') { etat = 1; continue; }
          if (etat === 1) {
            if (z.g === 'nom' && z.table) { cible = z.table; prof = 0; continue; }
            if (z.g === 'nom' && /^(TABLE|IF|NOT|EXISTS|INTO|OR|REPLACE|IGNORE|TEMP|TEMPORARY)$/.test(uz)) continue;
            if (/\S/.test(z.v)) etat = 0;
          }
          continue;
        }
        if (z.v === '(') { prof++; if (prof === 1) debut = true; continue; }
        if (z.v === ')') { prof--; if (prof <= 0) { cible = null; etat = 0; } continue; }
        if (prof === 0 && /\S/.test(z.v)) { cible = null; etat = 0; continue; }
        if (prof === 1 && z.v === ',') { debut = true; continue; }
        if (prof === 1 && z.g === 'nom' && debut) { z.colonneDe = cible; debut = false; continue; }
        if (z.g !== 'autre' || /\S/.test(z.v)) debut = false;
      }
    })();
    /* 15 novembre, base Aéroport : une même valeur française qui se traduit autrement selon sa colonne (« Suisse » : Swiss pour une
       nationalité, Switzerland pour un pays). valeursColonnes : {'passagers.nationalite': {'Suisse': 'Swiss'}}. La colonne d'une
       chaîne se lit dans un INSERT INTO t (colonnes) VALUES (…), ou devant elle : nationalite = 'Suisse', nationalite IN ('Suisse', …). */
    var VC = !versFr && dico() && dico().valeursColonnes;
    if (VC) {
      var ins = null, prof = 0, rang = 0, k2, u;
      for (i = 0; i < L.length; i++) {
        var y = L[i]; u = y.g === 'nom' ? y.v.toUpperCase() : '';
        if (u === 'INSERT') { ins = { table: '', cols: [], etat: 0 }; prof = 0; continue; }
        if (ins) {
          if (ins.etat === 0 && y.g === 'nom' && !/^(INTO|OR|REPLACE|IGNORE)$/.test(u)) { ins.table = y.v.toLowerCase(); ins.etat = 1; }
          else if (ins.etat === 1 && y.v === '(') ins.etat = 2;
          else if (ins.etat === 1 && y.g === 'nom') ins = null;
          else if (ins.etat === 2 && y.g === 'nom') ins.cols.push(y.v.toLowerCase());
          else if (ins.etat === 2 && y.v === ')') ins.etat = 3;
          else if (ins.etat === 3 && u === 'VALUES') ins.etat = 4;
          else if (ins.etat === 4) {
            if (y.v === '(') { prof++; if (prof === 1) rang = 0; }
            else if (y.v === ')') prof--;
            else if (y.v === ',' && prof === 1) rang++;
            else if (y.g === 'chaine' && prof === 1) y.colonne = ins.table + '.' + ins.cols[rang];
            else if (y.v === ';' && prof === 0) ins = null;
          }
          continue;
        }
        if (y.g !== 'chaine') continue;
        var enIn = false, op = false;
        k2 = precedent(i);
        while (k2 >= 0 && (L[k2].v === ',' || L[k2].v === '(' || L[k2].g === 'chaine')) k2 = precedent(k2);
        if (k2 >= 0 && L[k2].g === 'nom' && L[k2].v.toUpperCase() === 'IN') { enIn = true; k2 = precedent(k2); if (k2 >= 0 && L[k2].g === 'nom' && L[k2].v.toUpperCase() === 'NOT') k2 = precedent(k2); }
        else { k2 = precedent(i); while (k2 >= 0 && /^[=<>!]$/.test(L[k2].v)) { op = true; k2 = precedent(k2); } }
        if ((!enIn && !op) || k2 < 0 || L[k2].g !== 'nom') continue;
        var col = L[k2].v.toLowerCase();
        for (var cle in VC) { var tc2 = cle.split('.'); if (tc2[1] === col && citees.some(function (x) { return x.table === tc2[0]; })) { y.colonne = cle; break; } }
      }
    }
    for (i = 0; i < L.length; i++) {
      var e = L[i];
      if (e.g === 'chaine') { var c = e.v.slice(1, -1).replace(/''/g, "'"), vc = VC && e.colonne && VC[e.colonne];
        if (vc && Object.prototype.hasOwnProperty.call(vc, c)) { e.v = "'" + String(vc[c]).replace(/'/g, "''") + "'"; continue; }
        if (Object.prototype.hasOwnProperty.call(valeursBase, c)) e.v = "'" + String(valeursBase[c]).replace(/'/g, "''") + "'"; continue; }
      if (e.g !== 'nom' || e.alias) continue;
      /* Un alias devant un point (ca.nom, alias de « JOIN camions ca ») reste l'alias, même si son nom a une traduction (ca : revenue) */
      if (alias[e.v.toLowerCase()]) { var apresAlias = suivant(i); if (apresAlias >= 0 && L[apresAlias].v === '.') continue; }
      /* Un alias entre guillemets doubles (« nom AS "Nom du produit" ») : traduit comme le texte qu'il affiche */
      if (e.guillemets && !versFr && TRAD.textes && Object.prototype.hasOwnProperty.call(TRAD.textes, e.v)) { e.v = String(TRAD.textes[e.v]).replace(/"/g, '""'); continue; }
      if (e.table) { e.v = casse(e.v, T[e.table][0]); continue; }
      var nom = e.v.toLowerCase(), p = precedent(i), n = suivant(i), table = '';
      if (n >= 0 && L[n].v === '(') {   // COUNT(, une fonction
        /* … sauf une routine de la base (15 novembre, module 13 : CALL expedier_commande(13), SELECT calculer_points(80)) : son nom est dans les défauts */
        var D = (dico() && dico().defauts) || {};
        /* … jamais à l'envers : RANK( reste RANK( même si « rank » est un alias (rang) */
        if (!versFr && Object.prototype.hasOwnProperty.call(D, nom)) e.v = casse(e.v, D[nom]);
        continue;
      }
      if (p >= 0 && L[p].v === '.') {
        var q = precedent(p), prefixe = q >= 0 && L[q].g === 'nom' ? L[q].v.toLowerCase() : '';
        table = L[q] && L[q].table ? L[q].table : alias[prefixe] || '';
        /* Un schéma devant une table (15 novembre, module 9 : boutique.commandes, bien_etre.inscriptions) : la table elle-même */
        if (!table && Object.prototype.hasOwnProperty.call(T, nom)) { e.v = casse(e.v, T[nom][0]); continue; }
        /* Préfixe inconnu (une sous-requête nommée, un alias posé sur une autre carte) : la table du contexte qui a cette colonne */
        if (!table) { for (j = 0; j < autour.length && !table; j++) if (Object.prototype.hasOwnProperty.call(T[autour[j]][1], nom)) table = autour[j]; }
        /* … sinon le nom seul (une colonne calculée d'une CTE : totaux.nb_commandes) */
        if (!table) { var g2 = colonneSeule(nom); if (g2) e.v = casse(e.v, g2); continue; }
      } else if (e.colonneDe && T[e.colonneDe] && Object.prototype.hasOwnProperty.call(T[e.colonneDe][1], nom)) {
        table = e.colonneDe;   // la colonne d'un CREATE TABLE ou d'un INSERT INTO
      } else {
        /* Sans préfixe : la table citée la plus proche qui a cette colonne */
        var mieux = -1;
        for (j = 0; j < citees.length; j++) if (T[citees[j].table][1][nom] && (mieux < 0 || Math.abs(citees[j].i - i) < Math.abs(citees[mieux].i - i))) mieux = j;
        if (mieux < 0) {
          var g = null;
          for (j = 0; j < autour.length && g == null; j++) if (Object.prototype.hasOwnProperty.call(T[autour[j]][1], nom)) g = T[autour[j]][1][nom];
          if (g == null) g = colonneSeule(nom);
          if (g) e.v = casse(e.v, g);
          continue;
        }
        table = citees[mieux].table;
      }
      if (T[table][1][nom]) e.v = casse(e.v, T[table][1][nom]);
      /* Un alias réutilisé pour un résultat intermédiaire (« JOIN medecins m » dans un WITH, puis « CROSS JOIN moyenne m » : m.valeur) */
      else if (dicoCourant) { var g3 = colonneSeule(nom); if (g3) e.v = casse(e.v, g3); }
    }
    return L.map(function (e) { return e.guillemets ? '"' + e.v + '"' : e.v; }).join('');
  }
  function avec(d, fr, f) {
    var avant = dicoCourant, avantFr = versFr;
    dicoCourant = d; versFr = fr;
    try { return f(); } finally { dicoCourant = avant; versFr = avantFr; }
  }
  /* Le dictionnaire à l'envers (customers → clients, 'Freshwater' → 'Eau douce'), gardé une fois fait */
  var inverses = {};
  function inverse(baseId) {
    var d = TRAD && TRAD.bases && TRAD.bases[baseId];
    if (!d) return null;
    if (inverses[baseId]) return inverses[baseId];
    var r = { tables: {}, valeurs: {}, defauts: {} }, t, c;
    for (t in d.tables || {}) {
      var cols = {};
      for (c in d.tables[t][1]) cols[String(d.tables[t][1][c]).toLowerCase()] = c;
      r.tables[String(d.tables[t][0]).toLowerCase()] = [t, cols];
    }
    for (c in d.valeurs || {}) r.valeurs[d.valeurs[c]] = c;
    for (t in d.valeursColonnes || {}) for (c in d.valeursColonnes[t]) r.valeurs[d.valeursColonnes[t][c]] = c;
    /* … et les valeurs qu'une solution écrite à la main traduit autrement (« Faible » : Weak pour une ruche, Low pour un niveau) */
    for (c in d.valeursRetour || {}) r.valeurs[c] = d.valeursRetour[c];
    for (c in d.defauts || {}) r.defauts[String(d.defauts[c]).toLowerCase()] = c;
    return (inverses[baseId] = r);
  }
  /* Une base SQLite (sql.js) passée dans la langue : tables, colonnes, valeurs. Rend la base. */
  function base(db) {
    var T = tablesBase();
    if (CODE === 'fr' || !T || !db) return db;
    var presentes = {};
    try { (db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0] || { values: [] }).values.forEach(function (l) { presentes[String(l[0]).toLowerCase()] = 1; }); } catch (e) { return db; }
    var V = TRAD.base.valeurs || {}, colonnesValeurs = TRAD.base.colonnesValeurs || {};
    Object.keys(T).forEach(function (table) {
      if (!presentes[table]) return;
      (colonnesValeurs[table] || []).forEach(function (col) {
        Object.keys(V).forEach(function (fr) { db.run('UPDATE "' + table + '" SET "' + col + '" = ? WHERE "' + col + '" = ?', [V[fr], fr]); });
      });
      Object.keys(T[table][1]).forEach(function (col) { if (T[table][1][col] !== col) db.run('ALTER TABLE "' + table + '" RENAME COLUMN "' + col + '" TO "' + T[table][1][col] + '"'); });
      if (T[table][0] !== table) db.run('ALTER TABLE "' + table + '" RENAME TO "' + T[table][0] + '"');
    });
    return db;
  }

  /* ---------- 3. Traduire la page ---------- */
  var FORME = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, SMALL: 1, SPAN: 1, MARK: 1, SUP: 1, SUB: 1, A: 1, LABEL: 1 };
  var TEL_QUEL = { CODE: 1, KBD: 1, BR: 1, IMG: 1, svg: 1, SVG: 1, WBR: 1 };
  var SAUTE = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, PRE: 1, NOSCRIPT: 1, TEMPLATE: 1, IFRAME: 1 };
  var ATTRIBUTS = ['placeholder', 'aria-label', 'title', 'alt', 'aria-valuetext'];
  var PHRASE_MAX = 700;
  var fait = typeof WeakMap === 'function' ? new WeakMap() : { get: function () {}, set: function () {} };   // élément ou nœud → ce qu'on y a écrit
  var obs = null;

  /* Un texte à traduire : des mots, ou un prix seul (« 39,90 € » s'écrit « €39.90 » en anglais) */
  /* Un texte à traduire a deux lettres de suite (ou un prix) ; aussi la préposition « à » seule (15 novembre, revue des vidéos :
     « 1 à 20 » sous la liste des factures, « À : » dans un e-mail, restaient en français) */
  function lettres(s) { s = String(s).replace(/<[^>]*>/g, ''); return /[A-Za-zÀ-ÿ]{2}/.test(s) || /\d\s?€/.test(s) || /(^|[\s\d])[àÀ](?=[\s\d:\u00a0]|$)/.test(s); }
  function saute(el) { return !el || SAUTE[el.nodeName] || (el.hasAttribute && el.hasAttribute('data-notrad')) || el.isContentEditable === true; }
  function dansSaute(el) { for (var p = el; p && p.nodeType === 1; p = p.parentNode) if (saute(p)) return true; return false; }
  function simple(el) {   // un morceau mis en forme, sans rôle propre : il se traduit avec sa phrase
    if (!FORME[el.nodeName] || el.id || el.hasAttribute('data-notrad') || el.hasAttribute('data-' + CODE)) return false;
    for (var i = 0; i < el.attributes.length; i++) if (/^on/.test(el.attributes[i].name)) return false;
    return true;
  }
  /* La phrase d'un élément : son texte, ses morceaux numérotés (<1/> : gardé tel quel ; <2>…</2> : mis en forme).
     null : l'élément contient autre chose (des blocs, un bouton) ; c'est un conteneur. */
  function phrase(el, etat) {
    var s = '';
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { s += n.nodeValue; if (/\S/.test(n.nodeValue)) etat.texte = true; }
      else if (n.nodeType === 1) {
        if (TEL_QUEL[n.nodeName]) { if (n.nodeName === 'CODE' && !surPlace(n)) codeSql(n); etat.morceaux.push(n); s += '<' + etat.morceaux.length + '/>'; }
        else if (simple(n)) {
          etat.morceaux.push(n); var k = etat.morceaux.length, sous = { morceaux: etat.morceaux }, dedans = phrase(n, sous);
          if (dedans == null) return null;
          s += '<' + k + '>' + dedans + '</' + k + '>';
        } else return null;
      } else if (n.nodeType !== 8) return null;
      if (s.length > PHRASE_MAX * 3) return null;
    }
    return s;
  }
  /* Un nœud de texte écrit par nous : on le reconnaîtra (ce n'est plus du français à traduire ni à noter). */
  function notre(texte) { var n = document.createTextNode(texte); fait.set(n, texte); return n; }
  function nosTextes(el) {
    var vu = false;
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) { if (fait.get(n) !== n.nodeValue) return false; vu = true; }
    return vu;
  }
  /* Écrit un texte à morceaux dans l'élément, en reprenant ses propres nœuds (les icônes et le code gardent leur place). */
  function poser(el, texte, morceaux) {
    var re = /<(\d+)\/>|<(\d+)>([\s\S]*?)<\/\2>/g, m, fin = 0, enfants = [];
    while ((m = re.exec(texte))) {
      if (m.index > fin) enfants.push(notre(texte.slice(fin, m.index)));
      var noeud = morceaux[+(m[1] || m[2]) - 1];
      if (!noeud) return false;
      if (m[2] && !poser(noeud, m[3], morceaux)) return false;
      enfants.push(noeud); fin = re.lastIndex;
    }
    if (fin < texte.length) enfants.push(notre(texte.slice(fin)));
    while (el.firstChild) el.removeChild(el.firstChild);
    enfants.forEach(function (n) { el.appendChild(n); });
    return true;
  }
  /* La clé d'une phrase : sans les icônes ni les retours à la ligne du début et de la fin, et ses morceaux renumérotés à partir de 1
     (« <1/> Commencer » se traduit sous « Commencer » ; ajouter une icône ne change pas la clé). */
  var DEBUT = /^\s*(?:<\d+\/>|<(\d+)>((?:[^<]|<\d+\/>)*)<\/\1>)/, FIN = /(?:<\d+\/>|<(\d+)>((?:[^<]|<\d+\/>)*)<\/\1>)\s*$/;
  function cleDe(s) {
    var avant = '', apres = '', m, vers = {}, retour = {}, n = 0;
    /* Au début et à la fin : une icône seule, ou un morceau sans mot (une flèche dans son rond, un « ✓ ») */
    while ((m = DEBUT.exec(s)) && !(m[2] && /[A-Za-zÀ-ÿ]/.test(m[2]))) { avant += m[0]; s = s.slice(m[0].length); }
    while ((m = FIN.exec(s)) && !(m[2] && /[A-Za-zÀ-ÿ]/.test(m[2]))) { apres = m[0] + apres; s = s.slice(0, m.index); }
    m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    var coeur = m[2].replace(/<(\/?)(\d+)(\/?)>/g, function (tout, f, k, g) { if (!vers[k]) { vers[k] = ++n; retour[n] = k; } return '<' + f + vers[k] + g + '>'; });
    return { avant: avant + m[1], apres: m[3] + apres, cle: propre(coeur), retour: retour };
  }
  var faitA = typeof WeakMap === 'function' ? new WeakMap() : { get: function () {}, set: function () {} };
  function attributs(el) {
    if (!el.getAttribute) return;
    for (var i = 0; i < ATTRIBUTS.length; i++) {
      var a = ATTRIBUTS[i], v = el.getAttribute(a);
      if (!v) continue;
      var ecrits = faitA.get(el);
      if (ecrits && ecrits[a] === v) continue;
      var cle = propre(v), r = chercher(cle);
      if (r == null) { noter(cle); continue; }
      if (r !== v) el.setAttribute(a, r);
      if (!ecrits) { ecrits = {}; faitA.set(el, ecrits); }
      ecrits[a] = r;
    }
  }
  function texteSeul(n, silence) {
    var brut = n.nodeValue, cle = propre(brut);
    if (!cle || fait.get(n) === brut) return;
    var r = chercher(cle);
    if (r == null) { if (!silence) noter(cle); return; }
    var ecrit = brut.replace(/^(\s*)[\s\S]*?(\s*)$/, function (tout, a, b) { return a + r + b; });
    if (ecrit !== brut) n.nodeValue = ecrit;
    fait.set(n, ecrit);
  }
  /* Le code affiché (<code>clients</code>, <code>FOREIGN KEY (client_id)…</code>) : écrit pour la base de la langue, sauf là où
     l'appli dit qu'une autre base est ouverte (un défi qui a sa propre base : REQUETE_LANGUE.autreBase). */
  function codeSql(el) {
    if (!TRAD || !TRAD.base || CODE === 'fr' || !el) return;
    try { if (API.autreBase && API.autreBase()) return; } catch (e) {}
    /* Le contexte : le bloc de code (l'éditeur entier), sinon la phrase ou le paragraphe qui contient ce code */
    var bloc = null;
    try { bloc = el.closest ? el.closest('.body, pre, .code, .codepill, .rq, p, li, td, th, .c') : null; } catch (e) {}
    /* Texte par texte, séparés d'une espace : les lignes d'un éditeur se suivent sans retour (« stock» puis «FROM produits») */
    var morceaux = [];
    (function lire(p) { for (var n = p.firstChild; n; n = n.nextSibling) { if (n.nodeType === 1) lire(n); else if (n.nodeType === 3) morceaux.push(n.nodeValue); } })(bloc || el.parentNode || el);
    /* data-table (sur l'élément ou un parent : une page de vidéo entière sur les produits) : la table dont il parle, comptée en premier */
    var dt = '';
    try { var porte = el.closest ? el.closest('[data-table]') : null; dt = porte ? porte.getAttribute('data-table') || '' : ''; } catch (e) {}
    var contexte = dt + ' ' + morceaux.join(' ');
    (function tour(p) {
      for (var n = p.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 1) tour(n);
        else if (n.nodeType === 3 && fait.get(n) !== n.nodeValue) {
          /* Un commentaire SQL (« -- Vider la copie », 15 novembre, module 9) : une phrase, traduite comme les textes */
          var v = /^\s*--/.test(n.nodeValue) ? n.nodeValue.replace(/^(\s*--\s*)(.*?)(\s*)$/, function (m, a, x, b) { return a + t(x) + b; }) : sql(n.nodeValue, contexte);
          if (v !== n.nodeValue) n.nodeValue = v; fait.set(n, v);
        }
      }
    })(el);
  }
  /* data-en (data-<langue>) : la traduction écrite sur l'élément lui-même, quand le même mot se traduit selon l'endroit
     (« nom » : last_name pour un client, name pour un produit). Aussi sur le <code> d'une phrase (15 novembre : la légende de « AS »
     cite les mots d'un alias sans guillemets, <code data-en="Product">Nom</code>, pas des colonnes). */
  function surPlace(el) {
    /* data-en-src : l'image de la langue (une image qui porte du texte) */
    var src = el.getAttribute && el.getAttribute('data-' + CODE + '-src');
    if (src && el.getAttribute('src') !== src) el.setAttribute('src', src);
    var v = el.getAttribute && el.getAttribute('data-' + CODE);
    if (v == null) return false;
    if (fait.get(el) !== v) { el.textContent = v; fait.set(el, v); }
    return true;
  }
  function passer(el) {
    /* Une zone de saisie n'est jamais touchée, mais ce qu'elle dit d'elle-même (aria-label, placeholder) se traduit (15 novembre :
       « Éditeur SQL » de la console, « Ce qui t’a plu… » sous l'avis d'une leçon) */
    if (el && el.nodeType === 1 && (el.nodeName === 'TEXTAREA' || el.nodeName === 'INPUT') && !el.hasAttribute('data-notrad')) { attributs(el); return; }
    if (!el || el.nodeType !== 1 || saute(el)) return;
    attributs(el);
    if (surPlace(el)) return;
    if (el.nodeName === 'CODE') codeSql(el);
    if (TEL_QUEL[el.nodeName] || !el.firstChild) return;
    var etat = { morceaux: [], texte: false }, s = phrase(el, etat), n;
    /* Les morceaux d'une phrase (une icône, un mot en gras) gardent leurs attributs à eux : un cadenas « Module verrouillé » */
    for (n = 0; n < etat.morceaux.length; n++) if (etat.morceaux[n].nodeType === 1 && etat.morceaux[n].attributes && etat.morceaux[n].attributes.length) attributs(etat.morceaux[n]);
    if (s != null && etat.texte && s.length <= PHRASE_MAX) {
      var c = cleDe(s);
      if (!lettres(c.cle) || fait.get(el) === c.cle) return;
      var r = chercher(c.cle);
      if (r != null) {
        r = String(r).replace(/<(\/?)(\d+)(\/?)>/g, function (tout, f, k, g) { return '<' + f + (c.retour[k] || k) + g + '>'; });
        /* Une phrase qui commence après un code par « : » (15 novembre, module 14 : « <code>SCAN commandes</code> : les lignes… ») :
           l’espace d’avant le deux-points est française ; en anglais, le signe suit le code. */
        var av = /^[:;!?]/.test(r) ? c.avant.replace(/[ \u00a0\u202f]+$/, '') : c.avant;
        if (poser(el, av + r + c.apres, etat.morceaux)) fait.set(el, cleDe(phrase(el, { morceaux: [] }) || '').cle);
        return;
      }
      /* Pas de traduction : la phrase reste entière en français (jamais à moitié traduite). Si son texte est déjà le nôtre
         (l'appli vient de changer un nombre ou un prénom dans une phrase traduite), il n'y a rien à noter. */
      if (!nosTextes(el)) noter(c.cle);
      return;
    }
    for (n = el.firstChild; n; n = n.nextSibling) { if (n.nodeType === 1) passer(n); else if (n.nodeType === 3) texteSeul(n); }
  }
  /* Un changement dans un morceau mis en forme concerne la phrase qui le contient. */
  function racine(el) {
    while (el && el.parentNode && el.parentNode.nodeType === 1 && simple(el) && el.parentNode !== document.body) el = el.parentNode;
    return el;
  }
  function observer() {
    if (obs || typeof MutationObserver !== 'function') return;
    obs = new MutationObserver(function (liste) {
      var blocs = [], phrases = [], petits = [], i, j;
      var ajouter = function (t, el) { if (el && el.nodeType === 1 && t.indexOf(el) < 0) t.push(el); };
      for (i = 0; i < liste.length; i++) {
        var m = liste[i];
        if (m.type === 'attributes') { if (!dansSaute(m.target)) attributs(m.target); continue; }
        if (m.type === 'characterData') { ajouter(phrases, m.target.parentNode); continue; }
        for (j = 0; j < m.addedNodes.length; j++) { var n = m.addedNodes[j];
          /* Un morceau mis en forme qui arrive dans une phrase : c'est la phrase entière qu'on regarde */
          if (n.nodeType === 1) { if (simple(n) && m.target !== document.body) { ajouter(phrases, m.target); ajouter(petits, n); } else ajouter(blocs, n); }
          else if (n.nodeType === 3) ajouter(phrases, m.target);
        }
        if (m.removedNodes.length) ajouter(phrases, m.target);
      }
      for (i = 0; i < blocs.length; i++) if (blocs[i].isConnected !== false && !dansSaute(blocs[i])) passer(blocs[i]);
      for (i = 0; i < phrases.length; i++) {
        var p = phrases[i];
        if (p.isConnected === false || dansSaute(p)) continue;
        var r = racine(p), e = { morceaux: [], texte: false };
        if (phrase(r, e) != null && e.texte) passer(r);
        else {
          for (var c = p.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) texteSeul(c);
          for (j = 0; j < petits.length; j++) if (petits[j].parentNode === p) passer(petits[j]);
        }
      }
      obs.takeRecords();   // nos propres écritures
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTS });
  }

  /* ---------- Ce que voit le reste de l'appli ---------- */
  var API = window.REQUETE_LANGUE = {
    code: CODE,
    locale: LANGUES[CODE].locale,
    langues: LANGUES,
    disponibles: disponibles,
    nom: function (c) { return (LANGUES[c] || {}).nom || c; },
    t: t,
    /* baseId : la base d'un défi (« aquarium ») ; sans dictionnaire pour elle, la requête reste telle quelle (base restée en français). */
    sql: function (requete, contexte, baseId) {
      if (!baseId) return sql(requete, contexte);
      var d = TRAD && TRAD.bases && TRAD.bases[baseId];
      return d ? avec(d, false, function () { return sql(requete, contexte); }) : requete;
    },
    /* Une requête écrite pour la base d'un défi dans la langue, récrite pour sa base française : le serveur des salles vérifie sur
       la base française (supabase/functions/jeu-verifier). */
    versFrancais: function (requete, baseId) {
      var d = inverse(baseId);
      return d ? avec(d, true, function () { return sql(requete, null); }) : requete;
    },
    /* La solution d'un défi écrite à la main pour la langue (une requête que la réécriture automatique lirait mal : une colonne d'un
       résultat intermédiaire, WITH, qui a deux traductions selon sa table) ; null sinon. */
    solution: function (baseId, cid) { var d = TRAD && TRAD.bases && TRAD.bases[baseId]; return (d && d.solutions && d.solutions[cid]) || null; },
    /* La base d'un défi a-t-elle sa traduction ? */
    baseTraduite: function (baseId) { return CODE !== 'fr' && !!(TRAD && TRAD.bases && TRAD.bases[baseId]); },
    base: base,
    /* Le nom d'une table (identifiant('clients') : customers) ou d'une de ses colonnes (identifiant('produits', 'nom') : name). */
    identifiant: function (table, colonne, baseId) {
      var d = baseId ? TRAD && TRAD.bases && TRAD.bases[baseId] : dico(), T = d && d.tables, x = T && T[String(table).toLowerCase()];
      if (CODE === 'fr' || !x) return colonne == null ? table : colonne;
      return colonne == null ? x[0] : (Object.prototype.hasOwnProperty.call(x[1], colonne) ? x[1][colonne] : colonne);
    },
    valeur: function (nom, f) { valeurs[nom] = f; },
    /* Un texte HTML fabriqué en JavaScript (une consigne avec du gras ou du code) : traduit comme s'il était dans la page. */
    html: function (h) {
      if (CODE === 'fr' || h == null || !TRAD) return h;
      try { var d = document.createElement('div'); d.innerHTML = String(h); passer(d); return d.innerHTML; } catch (e) { return h; }
    },
    /* L'appli dit ici quand une autre base que celle des cours est ouverte (un défi qui a la sienne) : son code reste tel quel. */
    autreBase: null,
    /* Le code d'une page qui ne l'écrit pas dans <code> (les lignes d'éditeur d'une vidéo) : écrit pour la base de la langue. */
    ecrireCode: function (el) { try { codeSql(el); } catch (e) {} },
    /* La voix de la page dans la langue (une vidéo de cours : assets/anim/en/<cours>.js) ; null tant qu'elle n'existe pas. */
    voix: null,
    /* Les textes propres à une page (une vidéo de cours), ajoutés à ceux de la langue. */
    ajouter: function (code, contenu) {
      if (code !== CODE || !contenu) return;
      if (!TRAD) TRAD = { textes: {}, base: null, mots: null };
      var D = contenu.textes || {}, k;
      for (k in D) TRAD.textes[k] = D[k];
      /* Les bases des défis (langue-en-defis.js) : chacune son dictionnaire */
      if (contenu.bases) { TRAD.bases = TRAD.bases || {}; for (k in contenu.bases) TRAD.bases[k] = contenu.bases[k]; inverses = {}; }
      /* Les tables propres à une page (15 novembre, « Quel JOIN choisir ? » : medecins, bassins, livres…) : ses tables, ses alias et ses
         valeurs s'ajoutent à la base de la langue, pour cette page seulement. */
      var B = contenu.base;
      if (B && TRAD.base) ['tables', 'defauts', 'valeurs'].forEach(function (n) { if (!B[n]) return; var x = TRAD.base[n] = Object.assign({}, TRAD.base[n] || {}); for (var t in B[n]) x[t] = B[n][t]; });
      connues = null;
      if (contenu.voix) API.voix = contenu.voix;
      try { if (document.body) passer(document.body); } catch (e) {}
    },
    /* Les textes rencontrés sans traduction, les plus vus d'abord (pour savoir quoi traduire). */
    manquants: function () { return Array.from(manque.entries()).sort(function (a, b) { return b[1] - a[1]; }).map(function (x) { return x[0]; }); },
    changer: function (c) {
      if (!LANGUES[c] || disponibles().indexOf(c) < 0 || c === CODE) return false;
      try { localStorage.setItem(CLE, c); } catch (e) { return false; }
      try { location.reload(); } catch (e) {}
      return true;
    },
    /* Appelé par le fichier de la langue (langue-en.js) : ses textes, sa base. */
    charger: function (code, contenu) {
      if (code !== CODE || !contenu) return;
      TRAD = { textes: contenu.textes || {}, base: contenu.base || null, mots: contenu.mots || null };
      try { document.documentElement.lang = CODE; } catch (e) {}
      observer();
      try { if (document.title) { var ti = chercher(propre(document.title)); if (ti) document.title = ti; } } catch (e) {}
      try { if (document.body) passer(document.body); } catch (e) {}
      /* La page est lue en plusieurs fois : une phrase a pu être vue à moitié. Une fois la page entière, on repasse et on recompte. */
      try { document.addEventListener('DOMContentLoaded', function () { manque.clear(); passer(document.body); if (obs) obs.takeRecords(); }); } catch (e) {}
    }
  };

  /* Le fichier de la langue, chargé tout de suite après celui-ci, avant le reste de la page : aucun texte français n'apparaît d'abord. */
  /* Une page d'un autre dossier (une vidéo de cours, assets/anim/) charge ce fichier avec son chemin (../../langues.js) : le fichier de
     la langue est cherché à côté de lui. data-textes : le fichier des textes de cette page ({langue} : la langue), chargé juste après. */
  if (CODE !== 'fr' && LANGUES[CODE].fichier) {
    var moi = document.currentScript, src = (moi && moi.getAttribute('src')) || '', dossier = src.slice(0, src.lastIndexOf('/') + 1);
    var page = moi && moi.getAttribute('data-textes'), html = '<script src="' + dossier + LANGUES[CODE].fichier + '"><\/script>';
    /* data-defis (l'appli, pas les vidéos) : les bases des défis et leurs textes, dans leur propre fichier */
    if (moi && moi.hasAttribute && moi.hasAttribute('data-defis') && LANGUES[CODE].defis) html += '<script src="' + dossier + LANGUES[CODE].defis + '"><\/script>';
    /* Les questions d'entretien (15 novembre : langue-en-entretien.js, fabriqué par tools/langue/entretien.mjs), l'appli seulement aussi */
    if (moi && moi.hasAttribute && moi.hasAttribute('data-defis') && LANGUES[CODE].entretien) html += '<script src="' + dossier + LANGUES[CODE].entretien + '"><\/script>';
    if (page) html += '<script src="' + page.replace('{langue}', CODE) + '"><\/script>';
    try { document.write(html); } catch (e) {}
  }
})();
