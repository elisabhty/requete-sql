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

/* 13 novembre, 1 h 44 (Elisa : « retirer l’appli sur mon site quand on appuie sur commencer et faire descendre vers l’appli ») :
   l’appli ne s’ouvre plus dans un navigateur. La vidéo reste sur le site, derrière « Voir la vidéo » ; « Passer la vidéo » et
   « Commencer » (à la fin) mènent à la section iPhone du site ; plus de « Se connecter » (retours-0144-site.test.mjs). */
test('vidéo du métier : « Passer la vidéo » et « Commencer » mènent à la section iPhone du site, plus de « Se connecter »', () => {
  assert.ok(video.includes('<a class="pill" href="./#mobile" aria-label="Passer la vidéo">'), 'Passer la vidéo');
  assert.ok(video.includes('<div id="end">\n  <a href="./#mobile">Commencer'), 'Commencer, à la fin de la vidéo');
  assert.ok(!video.includes('class="pill login"') && !video.includes('href="connexion.html'), 'plus de « Se connecter »');
  assert.ok(!video.includes('?depuis='), 'plus aucun lien vers l’appli');
});

test('vidéo → section iPhone : la vidéo s’arrête, sans voile violet (il couvrait l’ouverture de l’appli)', () => {
  assert.ok(!video.includes('vd-leave'));
  const js = video.slice(video.indexOf('/* Vers la section iPhone du site'), video.lastIndexOf('</script>'));
  assert.ok(js.includes("e.target.closest('a[href=\"./#mobile\"]')") && js.includes("if (typeof pause === 'function') pause();"));
});

test('arrivée dans l’appli depuis la vidéo : le site n’est pas reproposé, l’onboarding s’ouvre', () => {
  /* 13 novembre, 1 h 44 : le script de tête ne retient plus rien (l’appli ne s’ouvre plus dans un navigateur) ; maybeOnboard,
     lui, n’a pas changé (l’app iPhone, la mise au point en local). */
  assert.ok(!app.includes('rq-vu-appli'));
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
