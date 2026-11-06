/* Elisa, 6 novembre, 12 h 28 (à propos des hachures « leçons acquises au départ » de la carte de Mon compte) : « Non, tout le monde
   commence au même endroit, c’est juste les défis qui vont être recommandés comme facile, difficile etc. »
   - Le niveau du compte : les leçons validées, pour tout le monde ; le choix de l’onboarding n’en ajoute plus.
   - Le niveau de défi conseillé : celui du choix (« Je pars de zéro » Facile, « J’ai quelques bases » Moyen, « Je vise le niveau
     analyste » Difficile, comme le disent l’onboarding et son chemin), qui monte avec le niveau du compte, jamais en dessous du choix.
   - La carte de Mon compte n’a plus de hachures ni de « leçons acquises au départ » (retours-1013-compte). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';

/* Le vrai code du niveau et du conseil, sur 71 leçons : paliers à la 12e (bases), à la 31e (Jointures) et à la 46e (analyste) */
const monde = ({ niveau = null, faites = 0, dansLeProfil = false, defis = { f: 3, m: 3, d: 3 } } = {}) => {
  const state = { plan: niveau && !dansLeProfil ? { niveau } : null, profile: niveau && dansLeProfil ? { niveau } : {}, lessons: {} };
  const ctx = vm.createContext({ state, isDefiId: () => false, itemDone: id => id < faites, jeuChallenges: k => Array.from({ length: defis[k] || 0 }) });
  vm.runInContext(cut('const NIVEAUX=[', '\nconst RYTHMES=') + '\n' + cut('const ACCOUNT_LEVELS=[', 'function lvlBadgeHTML(') + fn('jeuNivAuto')
    + 'const allLessons=Array.from({length:71},(_,i)=>({id:i}));const MODULES=[{titre:"Jointures",lessons:[{id:30}]}];', ctx);
  return { rang: () => vm.runInContext('niveauCompte().rank', ctx), defi: () => vm.runInContext('jeuNivAuto()', ctx) };
};
const CHOIX = [null, 'debutant', 'bases', 'inter'];

test('tout le monde commence au même endroit : le niveau du compte, ce sont les leçons validées', () => {
  assert.deepEqual(CHOIX.map(niveau => monde({ niveau }).rang()), [1, 1, 1, 1], 'au départ, niveau 1 pour tout le monde');
  assert.deepEqual(CHOIX.map(niveau => monde({ niveau, dansLeProfil: true }).rang()), [1, 1, 1, 1], 'pendant « Refaire mon planning » aussi');
  assert.deepEqual([0, 11, 30, 45, 71].map(faites => monde({ niveau: 'inter', faites }).rang()), [1, 2, 3, 4, 5], 'les leçons validées font monter');
  const nc = fn('niveauCompte');
  assert.ok(nc.includes('const acquis=ids.filter(id=>itemDone(id)).length;') && !nc.includes('depart') && !nc.includes('choisi'));
});

test('les défis conseillés : Facile, Moyen ou Difficile selon le choix de l’onboarding, puis plus haut avec le niveau', () => {
  assert.deepEqual(CHOIX.map(niveau => monde({ niveau }).defi()), ['f', 'f', 'm', 'd']);
  assert.deepEqual(CHOIX.map(niveau => monde({ niveau, dansLeProfil: true }).defi()), ['f', 'f', 'm', 'd'], 'le choix gardé dans le profil');
  /* Le niveau du compte fait monter le conseil (Constructeur et Analyste relationnel → Moyen, Analyste SQL et au-delà → Difficile) */
  assert.deepEqual([0, 11, 30, 45, 71].map(faites => monde({ niveau: 'debutant', faites }).defi()), ['f', 'm', 'm', 'd', 'd']);
  assert.equal(monde({ niveau: 'bases', faites: 45 }).defi(), 'd');
  assert.equal(monde({ niveau: 'inter', faites: 0 }).defi(), 'd', 'jamais en dessous du choix');
  /* Un niveau sans défi : le premier qui en a, comme avant (Moyen, puis Facile, puis Difficile) */
  assert.equal(monde({ niveau: 'inter', defis: { f: 2, m: 1, d: 0 } }).defi(), 'm');
  assert.equal(monde({ niveau: 'bases', defis: { f: 2, m: 0, d: 4 } }).defi(), 'f');
});

test('ce que promet l’onboarding : les mêmes niveaux de défis, et la même première étape pour tous', () => {
  for (const d of ['Jamais écrit une requête · défis faciles', 'SELECT et les filtres me parlent · défis moyens', 'Agrégations et jointures acquises · défis difficiles'])
    assert.ok(cut('const NIVEAUX=[', '\n];').includes(d), d);
  const chemin = fn('obLevelPath');
  assert.ok(chemin.includes("const start=0,defi={debutant:'Facile',bases:'Moyen',inter:'Difficile'}[draft.niveau]||'Facile';"), 'le chemin : départ à la première étape');
  const plan = fn('obPlanInfo');
  assert.ok(plan.includes('const rank={debutant:1,bases:2,inter:4}[niv]||1;') && plan.includes("defiNiv:rank>=4?'Difficile':rank>=2?'Moyen':'Facile'"), 'le récapitulatif du plan');
});
