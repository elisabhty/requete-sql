/* Première visite (Elisa, 3 novembre, 12 h 53 : « vérifie que quelqu’un qui se connecte pour la première fois voit bien
   l’onboarding ; avant ou après la vidéo, avant ou après la connexion ? » ; 13 h 04 : « Ok corrige »).
   Parcours vérifié dans un navigateur vierge, sur téléphone et sur ordinateur :
     adresse de l’appli → site (decouvrir/) → « Commencer » → vidéo du métier (facultative : « Passer la vidéo ») → onboarding
     → première requête → (compte, quand il existera) → pseudo → première leçon.
   - La vidéo menait à la page de connexion : un nouveau visiteur devait choisir entre « Se connecter », « Créer un compte » et
     « Continuer sans compte » avant d’avoir rien essayé. « Passer la vidéo » et « Commencer » (fin de la vidéo) ouvrent
     maintenant l’onboarding ; « Se connecter » reste dans la barre du haut pour qui a déjà un compte.
   - « Se connecter » (aperçu, accepte n’importe quel e-mail) sautait l’onboarding : accueil sans prénom, sans objectif, rythme
     par défaut. Tant que les comptes n’existent pas, un appareil sans progression passe par l’onboarding. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const video = lire('decouvrir/video.html'), app = lire('index.html');

test('vidéo du métier : « Passer la vidéo » et « Commencer » ouvrent l’onboarding, « Se connecter » le formulaire', () => {
  assert.ok(video.includes('<a class="pill" href="../?depuis=video" aria-label="Passer la vidéo">'), 'Passer la vidéo');
  assert.ok(video.includes('<div id="end">\n  <a href="../?depuis=video">Commencer'), 'Commencer, à la fin de la vidéo');
  assert.ok(video.includes('<a class="pill login" href="connexion.html#cx-form">'), 'Se connecter, pour qui a un compte');
  assert.equal((video.match(/href="connexion\.html"/g) || []).length, 0, 'plus aucun passage obligé par la page de connexion');
});

test('vidéo → appli : l’écran passe au violet de l’écran de chargement, jamais au blanc', () => {
  assert.ok(video.includes("body::after{content:'';position:fixed;inset:0;z-index:1000;pointer-events:none;opacity:0;transition:opacity .28s;\n  background:linear-gradient(180deg,#6E50F6 0%,#5538E6 48%,#4529CC 100%)}\nbody.vd-leave::after{opacity:1}"));
  const js = video.slice(video.indexOf('/* Vers l’appli : la vidéo s’arrête'), video.lastIndexOf('</script>'));
  assert.ok(js.includes("e.target.closest('a[href^=\"../?depuis=\"]')"), 'les liens vers l’appli');
  assert.ok(js.includes("document.body.classList.add('vd-leave');") && js.includes("document.documentElement.style.backgroundColor = '#6E50F6';"), 'violet, zone de l’heure comprise');
  assert.ok(js.includes('e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button'), 'un nouvel onglet reste un nouvel onglet');
  assert.ok(js.includes("addEventListener('pageshow'"), 'retour arrière : la page revient telle quelle');
});

test('arrivée dans l’appli depuis la vidéo : le site n’est pas reproposé, l’onboarding s’ouvre', () => {
  /* Le script de tête retient qu’on vient du site (?depuis=…) : la prochaine ouverture de l’adresse reste dans l’appli. */
  /* 5 novembre, 14 h : une invitation (?partie=…) aussi (retours-1400.test.mjs). */
  assert.ok(app.includes("if(/[?&](depuis|partie)=/.test(q))ls.setItem('rq-vu-appli','1');"));
  const src = app.slice(app.indexOf('function maybeOnboard(){'), app.indexOf('function startOnboarding(){', app.indexOf('function maybeOnboard(){')));
  const arrive = (search, { onboarded = false, comptes = false, lecons = {} } = {}) => {
    const appels = [];
    const store = k => ({ removeItem: c => appels.push(`oublie ${k} ${c}`) });
    const ctx = vm.createContext({ URL, URLSearchParams, location: { search, href: 'https://requete.app/' + search }, appels,
      sessionStorage: store('session'), localStorage: store('local'), NAV_KEY: 'nav', NAV_KEY_LONG: 'nav-long',
      history: { state: null, replaceState: (s, t, u) => appels.push('url ' + u) },
      state: { lessons: lecons, plan: null, profile: {}, onboarded, accountMode: null },
      apercuPlan: (n, r, f) => ({ niveau: n, rythme: r, freq: f, sessions: [] }), obVitrineGoal: () => '',
      save: () => appels.push('save'), startOnboarding: () => appels.push('onboarding'), switchTab: t => appels.push('onglet ' + t),
      renderGreeting() {}, renderHomeHero() {}, renderProgress() {}, renderPlanning() {}, renderCompte() {} });
    if (comptes) ctx.obAuthReady = () => true;
    vm.runInContext(src + '\nmaybeOnboard();', ctx);
    return appels.at(-1);
  };
  assert.equal(arrive('?depuis=video'), 'onboarding', 'Passer la vidéo, Commencer');
  assert.equal(arrive('?depuis=vitrine'), 'onboarding', 'Créer un compte, Continuer sans compte');
  assert.equal(arrive('?depuis=connexion'), 'onboarding', 'Se connecter sans rien sur l’appareil, tant que les comptes n’existent pas');
  assert.equal(arrive('?depuis=connexion', { comptes: true }), 'onglet learn', 'avec les comptes : l’accueil');
  assert.equal(arrive('?depuis=video', { onboarded: true }), 'onglet learn', 'déjà passé par l’onboarding : l’accueil');
  assert.equal(arrive('?depuis=connexion', { lecons: { 1: { done: true } } }), 'save', 'une leçon déjà validée sur l’appareil : pas d’onboarding, l’appli la garde');
});
