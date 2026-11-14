/* Elisa, 14 novembre, 8 h 55 : « Dans l’appli en général » (tester qu’il n’y a pas d’erreur). Le tour complet de l’appli (onglets,
   71 leçons et leurs vidéos, 477 défis, cartes mémo, entretien, console sur chaque base, parcours, stickers, accueil d’un nouvel
   utilisateur jusqu’à l’offre, salle à deux) n’a relevé qu’une chose : une révision gardée d’avant le 28 octobre (toutes les leçons
   sont devenues « seules », sans exercice à réécrire) se rouvrait au lancement sur « De mémoire undefined ». */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('au lancement, une révision gardée ne se rouvre que si la leçon a encore un exercice à réécrire', () => {
  assert.ok(app.includes("}else if(nav.view==='review'&&nav.reviewId!=null&&revisable(allLessons.find(l=>l.id===nav.reviewId))){"));
});

test('openReview saute une leçon sans exercice et nettoie la file gardée', () => {
  const f = cut('function openReview(id){', '\nlet defiDernierKo=null;');
  const appels = [];
  const ctx = vm.createContext({
    allLessons: [{ id: 0, leconSeule: true }, { id: 1, leconSeule: true }],
    revisable: l => !!(l && !l.leconSeule && l.consigne && l.solution),
    reviewQueue: [0, 1], REV_SES_KEY: 'k', activeTab: 'learn',
    localStorage: { removeItem: k => appels.push('suppr:' + k) },
    switchTab: t => appels.push('onglet:' + t),
    document: { getElementById: () => { throw new Error('l’écran de révision ne doit pas s’ouvrir'); } },
  });
  vm.runInContext(f, ctx);
  vm.runInContext('openReview(0)', ctx);
  assert.deepEqual(appels, ['suppr:k', 'onglet:learn'], 'la file vidée, retour à l’onglet');
  assert.equal(vm.runInContext('reviewQueue.length', ctx), 0);
  assert.ok(f.includes('revisable(allLessons.find(l=>l.id===x))'), 'la file reprise au lancement ne garde que des leçons à réviser');
});
