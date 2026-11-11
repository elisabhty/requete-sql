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
   ===================================================================== */
(function(){
  'use strict';
  /* La clé publique iOS de RevenueCat (Projet Requête › Apps & providers › App Store › Public API key).
     Elle est faite pour être dans l'app : ce n'est pas un secret. */
  var RC_CLE_IOS = 'appl_qLAPPmCbplIcNyriYbILgTzVYYQ';
  var DROIT = 'premium';
  var GARDE = 'requete-premium';
  var PRODUITS = {an:'fr.requete.app.annuel', semaine:'fr.requete.app.hebdo'};

  var C = window.Capacitor;
  var natif = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
  var P = natif && C.Plugins && C.Plugins.Purchases;
  if (!RC_CLE_IOS || !P) return;

  var actifConnu = false;
  try { actifConnu = localStorage.getItem(GARDE) === '1'; } catch (e) {}
  var paquets = {};      /* 'an' | 'semaine' → le paquet RevenueCat (à repasser tel quel à purchasePackage) */
  var essais = {};       /* 'an' | 'semaine' → false si Apple dit « déjà eu l'essai » */

  function noterClient(info){
    var ci = info && (info.customerInfo || info);
    var a = !!(ci && ci.entitlements && ci.entitlements.active && ci.entitlements.active[DROIT]);
    actifConnu = a;
    try { localStorage.setItem(GARDE, a ? '1' : '0'); } catch (e) {}
    return a;
  }
  function offreDe(pq){
    var t = pq && (pq.packageType || ''), id = pq && pq.product && pq.product.identifier;
    if (t === 'ANNUAL' || id === PRODUITS.an) return 'an';
    if (t === 'WEEKLY' || id === PRODUITS.semaine) return 'semaine';
    return '';
  }
  function chargerOffres(){
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
        });
      });
    }).catch(function(){});
  }
  function annule(e){
    return !!(e && (e.userCancelled || e.code === '1' || e.code === 1 || /cancel/i.test(String(e.message || ''))));
  }

  var pret = P.configure({apiKey: RC_CLE_IOS})
    .then(function(){ return P.getCustomerInfo().then(noterClient).catch(function(){}); })
    .then(chargerOffres)
    .catch(function(){});

  /* De retour dans l'app (abonnement annulé ou repris dans les réglages Apple) : on relit le droit. */
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible') pret.then(function(){ return P.getCustomerInfo(); }).then(noterClient).catch(function(){});
  });

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
    essaiDispo: function(offre){ return essais[offre] !== false; },
    prix: function(offre){
      var pq = paquets[offre], p = pq && pq.product;
      if (!p || typeof p.price !== 'number') return null;
      return {prix: p.price, texte: p.priceString || '', parSemaine: p.pricePerWeekString || '', devise: p.currencyCode || ''};
    }
  };
})();
