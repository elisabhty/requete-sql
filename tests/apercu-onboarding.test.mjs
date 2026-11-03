/* Aperçu de l’onboarding (Elisa, 3 novembre, 17 h : « je ne vois pas l’onboarding car déjà connectée, tu as un lien ? »).
   ./?app=onboarding montre l’onboarding comme à un nouveau visiteur, même sur un appareil qui a déjà son parcours, sans rien
   enregistrer. Vérifié dans un navigateur : de la bienvenue à « Ton parcours est prêt », puis retour à l’accueil ; les données
   de l’appareil (requete-sql-v3) sont identiques, octet pour octet, avant et après ; recharger ramène l’appli telle qu’elle était. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const fn = (name, next) => { const i = app.lastIndexOf(`function ${name}(`); assert.ok(i > 0, name); return app.slice(i, app.indexOf(next, i)); };

/* maybeOnboard et ses aides, exécutés seuls (comme tests/premiere-visite.test.mjs) */
const src = app.slice(app.indexOf('function maybeOnboard(){'), app.indexOf('function startOnboarding(){', app.indexOf('function maybeOnboard(){')));
const arrive = (search, { onboarded = false, lecons = {} } = {}) => {
  const appels = [];
  const store = k => ({ removeItem: c => appels.push(`oublie ${k} ${c}`) });
  const ctx = vm.createContext({ URL, URLSearchParams, location: { search, href: 'https://elisabhty.github.io/requete-sql/' + search }, appels,
    sessionStorage: store('session'), localStorage: store('local'), NAV_KEY: 'nav', NAV_KEY_LONG: 'nav-long',
    history: { state: null, replaceState: (s, t, u) => appels.push('url ' + u) },
    state: { lessons: lecons, plan: null, profile: {}, onboarded, accountMode: null },
    apercuPlan: (n, r, f) => ({ niveau: n, rythme: r, freq: f, sessions: [] }), obVitrineGoal: () => '',
    save: () => appels.push('save'), startOnboarding: () => appels.push('onboarding'), obApercuOuvrir: () => appels.push('aperçu'),
    switchTab: t => appels.push('onglet ' + t), renderGreeting() {}, renderHomeHero() {}, renderProgress() {}, renderPlanning() {}, renderCompte() {} });
  vm.runInContext(src + '\nmaybeOnboard();', ctx);
  return appels;
};

test('le lien ?app=onboarding ouvre l’aperçu sur un appareil qui a déjà son parcours, et l’adresse est nettoyée', () => {
  assert.deepEqual(arrive('?app=onboarding', { onboarded: true }), ['url /requete-sql/', 'aperçu']);
  assert.deepEqual(arrive('?app=onboarding', { lecons: { 1: { done: true } } }), ['url /requete-sql/', 'save', 'aperçu'], 'une leçon déjà validée : l’aperçu aussi');
  /* Un nouveau visiteur a le vrai onboarding (rien à protéger) */
  assert.deepEqual(arrive('?app=onboarding'), ['url /requete-sql/', 'onboarding']);
  /* Sans le lien, rien ne change */
  assert.deepEqual(arrive('', { onboarded: true }), []);
  assert.deepEqual(arrive('?app', { onboarded: true }), [], '?app seul : l’appli, sans aperçu');
  /* « app » garde l’appli : le script de tête ne renvoie pas vers le site */
  assert.ok(app.includes("/[?&]app\\b/.test(q))return;"));
});

test('l’aperçu part d’un brouillon vierge et se referme à la fin sans rien enregistrer', () => {
  const ouvrir = fn('obApercuOuvrir', 'function obApercuFermer(');
  assert.ok(ouvrir.includes("startOnboarding('welcome');\n  obApercu=true;"));
  assert.ok(ouvrir.includes("draft={niveau:'debutant',rythme:'regulier',freq:7,name:'',goal:obVitrineGoal(),ageRange:'',job:'',source:'',referral:'',"), 'rien de prérempli depuis le profil');
  assert.ok(fn('obApercuFermer', 'function closeOnboardingAuth(').includes('closeOnboardingAuth();'));
  /* La fin de l’onboarding : en aperçu, on referme avant d’écrire le planning, le profil ou le pseudo */
  const fin = fn('finishOnboard', 'function obTerminer(');
  const garde = fin.indexOf("if(typeof obApercu!=='undefined'&&obApercu){obApercuFermer();return;}");
  assert.ok(garde > 0 && garde < fin.indexOf('state.plan=') && garde < fin.indexOf('save();') && garde < fin.indexOf('psPage('), 'avant toute écriture');
});
