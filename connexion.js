/* =====================================================================
   CONNEXION.JS : le compte de l'app iPhone, avec Apple et Google
   ---------------------------------------------------------------------
   En bref : ce fichier définit window.REQUETE_AUTH, le crochet que la page
   « Garde ta progression » (index.html, obStartAuth) et Mon compte
   attendent. Tant qu'il n'est pas défini (sur le site, ou sans le plugin),
   rien ne change : la page de connexion reste cachée sur l'iPhone.

   Elisa, 12 novembre, 1 h 04 : « il faut brancher la connexion », avant la
   sortie, avec Apple et Google (Apple l'exige dès qu'on propose Google,
   règle 4.8 de l'App Review).

   Le trajet :
   1. le plugin @capgo/capacitor-social-login ouvre la feuille d'Apple ou de
      Google et rend un jeton d'identité (idToken) signé par eux ;
   2. Supabase (Auth, /auth/v1/token?grant_type=id_token) vérifie ce jeton
      et rend une session : un jeton d'accès d'une heure et un jeton de
      renouvellement, gardés sur l'appareil (localStorage) ;
   3. les fonctions du compte (compte_supprimer, la synchronisation de la
      progression) partent avec le jeton d'accès, renouvelé au besoin.

   Réglages (IOS.md, « La connexion ») : Sign in with Apple coché sur
   l'identifiant fr.requete.app ; dans Supabase, Apple avec « fr.requete.app »
   en Client IDs, Google avec les deux identifiants ci-dessous et « Skip nonce
   check ». Google n'apparaît que quand GOOGLE_IOS et GOOGLE_WEB sont remplis.

   Le crochet :
   - fournisseurs : ['apple'] ou ['apple', 'google'] (pas d'e-mail) ;
   - signIn('apple' | 'google') → Promise<{id, email, label}> ; null si la
     personne a fermé la feuille ; une vraie erreur est relancée ;
   - signOut() → Promise : oublie la session (et la ferme côté serveur) ;
   - connecte() → bool ; utilisateur() → {id, email} ou null ;
   - jeton() → Promise<string|null> : un jeton d'accès valide, renouvelé
     s'il expire dans la minute ; null (et session oubliée) si le serveur
     ne la reconnaît plus ;
   - revoquerApple() → Promise<bool> : avant la suppression du compte,
     révoque l'accès « Se connecter avec Apple » (fonction apple-jeton).
   ===================================================================== */
(function(){
  'use strict';
  /* Les identifiants OAuth de Google (Google Cloud › Google Auth Platform › Clients) : publics, faits pour être dans l'app.
     Le client « iOS » (bundle fr.requete.app) et le client « Web application » (l'audience que Supabase vérifie). */
  var GOOGLE_IOS = '';
  var GOOGLE_WEB = '';
  /* L'interrupteur : tant qu'il est à false, REQUETE_AUTH n'est pas défini et l'appli reste sans compte (la page de connexion
     cachée sur l'iPhone). Il passe à true quand la synchronisation de la progression est branchée et que les réglages Apple,
     Google et Supabase sont faits (IOS.md, « La connexion ») : sans eux, la page promettrait une sauvegarde qui n'a pas lieu. */
  var ACTIVE = false;
  var APP_ID = 'fr.requete.app';
  var GARDE = 'requete-session';

  if (!ACTIVE) return;
  var C = window.Capacitor;
  var natif = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
  var SL = natif && C.Plugins && C.Plugins.SocialLogin;
  if (!SL || typeof SL.login !== 'function') return;
  var SB = typeof JEU_SB === 'string' ? JEU_SB : 'https://ynuenrxozcpkrjdbeftc.supabase.co';
  var CLE = typeof JEU_SB_KEY === 'string' ? JEU_SB_KEY : '';
  if (!CLE) return;

  var avecGoogle = !!(GOOGLE_IOS && GOOGLE_WEB);
  var fournisseurs = avecGoogle ? ['apple', 'google'] : ['apple'];
  var pret = null, renouvel = null;

  function initialiser(){
    if (!pret) {
      var o = {apple: {clientId: APP_ID}};
      if (avecGoogle) o.google = {iOSClientId: GOOGLE_IOS, iOSServerClientId: GOOGLE_WEB, mode: 'online'};
      pret = Promise.resolve(SL.initialize(o)).catch(function(e){ pret = null; throw e; });
    }
    return pret;
  }
  function lire(){
    try {
      var s = JSON.parse(localStorage.getItem(GARDE) || 'null');
      return s && typeof s.access_token === 'string' && typeof s.refresh_token === 'string' ? s : null;
    } catch (e) { return null; }
  }
  function garder(s){
    try { if (s) localStorage.setItem(GARDE, JSON.stringify(s)); else localStorage.removeItem(GARDE); } catch (e) {}
  }
  function appel(chemin, corps, jeton){
    var h = {apikey: CLE, 'Content-Type': 'application/json'};
    if (jeton) h.Authorization = 'Bearer ' + jeton;
    return fetch(SB + '/auth/v1/' + chemin, {method: 'POST', headers: h, body: JSON.stringify(corps || {})})
      .then(function(r){
        return r.json().catch(function(){ return null; }).then(function(j){
          if (!r.ok) {
            var e = new Error((j && (j.msg || j.error_description || j.message)) || ('auth ' + r.status));
            e.status = r.status; e.code = j && (j.error_code || j.error);
            throw e;
          }
          return j;
        });
      });
  }
  function session(j, fournisseur){
    if (!j || typeof j.access_token !== 'string' || typeof j.refresh_token !== 'string') throw new Error('Session absente');
    var u = j.user || {};
    return {
      access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: Number.isFinite(j.expires_at) ? j.expires_at : Math.floor(Date.now() / 1000) + (Number(j.expires_in) || 3600),
      user: {id: typeof u.id === 'string' ? u.id : null, email: typeof u.email === 'string' && u.email ? u.email : null},
      fournisseur: fournisseur
    };
  }
  function hex(octets){
    var t = ''; for (var i = 0; i < octets.length; i++) t += (octets[i] < 16 ? '0' : '') + octets[i].toString(16);
    return t;
  }
  /* Le nonce d'Apple : Apple reçoit son empreinte SHA-256, Supabase le nonce lui-même, qu'il hache pour comparer. Sans
     crypto.subtle, pas de nonce (Supabase l'accepte alors, le jeton n'en portant pas). */
  function nonceApple(){
    try {
      if (!(window.crypto && crypto.getRandomValues && crypto.subtle && window.TextEncoder)) return Promise.resolve(null);
      var brut = hex(crypto.getRandomValues(new Uint8Array(16)));
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(brut))
        .then(function(b){ return {brut: brut, hache: hex(new Uint8Array(b))}; })
        .catch(function(){ return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  /* La feuille fermée : Apple répond 1001 (« canceled »), Google -5 (« The user canceled the sign-in flow »). */
  function annulee(e){
    var t = String((e && (e.code || '')) || '') + ' ' + String((e && (e.message || e.errorMessage)) || e || '');
    return /cancel|annul|1001|(^|\D)-5(\D|$)/i.test(t);
  }

  function signIn(fournisseur){
    if (fournisseurs.indexOf(fournisseur) < 0) return Promise.reject(new Error('Fournisseur indisponible'));
    var nonce = null;
    return initialiser()
      .then(function(){ return fournisseur === 'apple' ? nonceApple() : null; })
      .then(function(n){
        nonce = n;
        var options = fournisseur === 'apple' ? {scopes: ['email', 'name']} : {scopes: ['email', 'profile']};
        if (nonce) options.nonce = nonce.hache;
        return Promise.resolve(SL.login({provider: fournisseur, options: options})).catch(function(e){
          if (annulee(e)) return null;
          throw e;
        });
      })
      .then(function(res){
        if (!res) return null;
        var r = res.result || {};
        if (typeof r.idToken !== 'string' || !r.idToken) throw new Error('Jeton d’identité absent');
        var corps = {provider: fournisseur, id_token: r.idToken};
        if (nonce) corps.nonce = nonce.brut;
        return appel('token?grant_type=id_token', corps).then(function(j){
          var s = session(j, fournisseur);
          var p = r.profile || {};
          var prenom = typeof p.givenName === 'string' ? p.givenName.trim().slice(0, 80) : '';
          if (prenom) s.prenom = prenom;
          garder(s);
          /* Le code d'autorisation d'Apple (10 minutes) part à la fonction apple-jeton, qui l'échange et garde le jeton d'Apple pour
             pouvoir le révoquer si la personne supprime son compte. Sans réponse, la connexion continue. */
          var code = fournisseur === 'apple' ? (r.authorizationCode || (r.accessToken && r.accessToken.token)) : null;
          if (typeof code === 'string' && code) fonction({action: 'garder', code: code}, s.access_token).catch(function(){});
          return {id: s.user.id, email: s.user.email, prenom: prenom || null,
            label: s.user.email || (fournisseur === 'apple' ? 'Compte Apple' : 'Compte Google')};
        });
      });
  }

  function fonction(corps, jeton){
    return fetch(SB + '/functions/v1/apple-jeton?forceFunctionRegion=eu-west-3', {method: 'POST',
      headers: {apikey: CLE, Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json'}, body: JSON.stringify(corps)})
      .then(function(r){ return r.json().catch(function(){ return null; }); });
  }
  /* Avant la suppression du compte : l'accès « Se connecter avec Apple » est révoqué chez Apple (règle 5.1.1(v)). */
  function revoquerApple(){
    var s = lire();
    if (!s || s.fournisseur !== 'apple') return Promise.resolve(false);
    return jeton().then(function(t){ return t ? fonction({action: 'revoquer'}, t) : null; })
      .then(function(j){ return !!(j && j.ok && j.revoque); }).catch(function(){ return false; });
  }

  function signOut(){
    var s = lire();
    garder(null);
    var fin = [];
    if (s) fin.push(appel('logout', {}, s.access_token).catch(function(){}));
    try { if (s && s.fournisseur) fin.push(Promise.resolve(SL.logout({provider: s.fournisseur})).catch(function(){})); } catch (e) {}
    return Promise.all(fin).then(function(){});
  }

  function jeton(){
    var s = lire();
    if (!s) return Promise.resolve(null);
    if (s.expires_at - Math.floor(Date.now() / 1000) > 60) return Promise.resolve(s.access_token);
    if (!renouvel) {
      renouvel = appel('token?grant_type=refresh_token', {refresh_token: s.refresh_token})
        .then(function(j){
          var n = session(j, s.fournisseur);
          if (s.prenom) n.prenom = s.prenom;
          garder(n);
          return n.access_token;
        })
        .catch(function(e){
          /* Le serveur ne reconnaît plus la session (compte supprimé ailleurs, jeton révoqué) : elle est oubliée.
             Sans réseau (pas de statut), elle est gardée : on réessaiera. */
          if (e && e.status >= 400 && e.status < 500) {
            garder(null);
            try { window.dispatchEvent(new CustomEvent('requete-session-perdue')); } catch (x) {}
          }
          return null;
        })
        .then(function(t){ renouvel = null; return t; });
    }
    return renouvel;
  }

  window.REQUETE_AUTH = {
    fournisseurs: fournisseurs.slice(),
    signIn: signIn,
    signOut: signOut,
    jeton: jeton,
    revoquerApple: revoquerApple,
    connecte: function(){ return !!lire(); },
    utilisateur: function(){ var s = lire(); return s ? {id: s.user.id, email: s.user.email, fournisseur: s.fournisseur} : null; }
  };
})();
