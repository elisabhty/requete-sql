import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/* Retouches d’Elisa du 25 octobre (08 h 44, deux captures d’iPhone) :
   Réf 1 : la notification « Carte débloquée » flottait trop haut sur le bilan « Bravo ! » (iPhone et ordinateur) ;
   Réf 2 : « Mettre leçon au complet, pas leçon interactive » ;
   Réf 3 : feuille « Carte » : « Syntaxe » touchait le bouton « Ajouter à mes notes », presque coupé. */

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const cut = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, `extrait introuvable : ${from}`);
  return html.slice(a, b);
};

test('bilan « Bravo ! » d’une leçon seule : « Leçon au complet », jamais « Leçon interactive »', () => {
  const ctx = vm.createContext({
    esc: s => s, stkBravoHtml: () => '', bravoRecapHtml: () => '', bravoUnlockHtml: () => '', bravoNextHtml: () => '', bravoActionsHtml: () => '', CARTES: {},
    lvPkScore: () => 6, lvPkErrs: () => 0, lvErreursMax: () => null,
  });
  vm.runInContext(cut('function bravoStepsHtml(l){', 'function bravoRecapHtml(l){') + cut('/* Elisa, 2 novembre, 8 h 01 : « cette page est encore', '/* ---------- Blocs de cours enrichis'), ctx);
  const seule = {id: 28, titre: 'DELETE', leconSeule: true, video: {moments: 6}};
  const slide = ctx.renderBravoSlide(seule);
  assert.ok(slide.includes('<small>Leçon au complet</small>'), 'sous le titre : « Leçon au complet »');
  assert.ok(slide.includes('<span class="bravo-step"><i>✓</i> Leçon</span>'), 'pastille : « ✓ Leçon » (le sous-titre dit déjà « au complet »)');
  assert.ok(slide.includes('6 exercices réussis sur 6'), 'le score reste affiché');
  assert.ok(!/interactive/i.test(slide), 'plus aucun « interactive » sur le bilan');
  /* Une leçon avec exercice et quiz garde ses mots. */
  const classique = ctx.renderBravoSlide({id: 5, titre: 'WHERE'});
  assert.ok(classique.includes('<small>Exercice et quiz au complet</small>'), 'leçon avec exercice et quiz : inchangée');
  assert.ok(['Cours', 'Exercice', 'Quiz'].every(m => classique.includes(`<i>✓</i> ${m}</span>`)), 'trois pastilles : Cours, Exercice, Quiz');
});

/* toastLift(t) pose --toast-lift (la hauteur de la notification au-dessus du bas de l’écran) à partir du bouton collant du cours. */
function lift({inLesson = true, nav = null, lst = null, innerHeight = 800, before = '99px', classes = null} = {}) {
  const props = {'--toast-lift': before}, cls = classes || new Set(['is-over']);
  const t = {style: {removeProperty: k => { delete props[k]; }, setProperty: (k, v) => { props[k] = v; }}, classList: {add: c => cls.add(c), remove: c => cls.delete(c)}};
  const el = nav && {classList: {contains: c => (nav.cls || []).includes(c)}, getBoundingClientRect: () => nav.rect};
  /* 11 novembre, 20 h 26 : la page de départ d’un cours (#lesson-start) et son bouton « Commencer » */
  const page = lst && {querySelector: s => s === '.lst-go' ? {getBoundingClientRect: () => lst.rect} : null};
  const ctx = vm.createContext({
    document: {body: {classList: {contains: c => c === 'in-lesson' && inLesson}}, querySelector: s => s.startsWith('#lesson-start') ? page : (el || null)},
    window: {innerHeight},
  });
  vm.runInContext(cut('function toastLift(t){', 'function toast(msg,sub,tone){'), ctx);
  ctx.toastLift(t);
  return props['--toast-lift'];
}

test('notification : au ras du bas de l’écran quand aucun bouton collant n’est à éviter (bilan « Bravo ! »), au-dessus du bouton sinon', () => {
  const BAS = 'calc(max(8px,var(--safe-bottom)) + 14px)';
  assert.equal(lift({inLesson: false}), undefined, 'hors d’un cours : la hauteur par défaut de l’app (au-dessus de la barre d’onglets) s’applique');
  assert.equal(lift(), BAS, 'bilan « Bravo ! » : pas de bouton collant, la notification se pose en bas (et non à 92 px du bord, au milieu du contenu)');
  assert.equal(lift({nav: {cls: ['ls-nav', 'cta-away'], rect: {top: 700, bottom: 780, height: 80}}}), BAS, 'bouton rentré : en bas aussi');
  assert.equal(lift({nav: {rect: {top: 0, bottom: 0, height: 0}}}), BAS, 'bouton sans hauteur (masqué) : en bas');
  assert.equal(lift({nav: {rect: {top: 900, bottom: 980, height: 80}}}), BAS, 'bouton sous l’écran : en bas');
  assert.equal(lift({nav: {rect: {top: -90, bottom: -10, height: 80}}}), BAS, 'bouton au-dessus de l’écran : en bas');
  assert.equal(lift({nav: {rect: {top: 700, bottom: 780, height: 80}}}), '124px', 'bouton collant visible : 24 px au-dessus de lui (800 − 700 + 24)');
  assert.equal(lift({nav: {rect: {top: 640, bottom: 720, height: 80}}, innerHeight: 720}), '104px', 'la hauteur de la fenêtre compte (iPhone : barre de Safari)');
  /* 20 h 26 : devant la page de départ d’un cours, juste au-dessus de « Commencer » (800 − 690 + 14) ; ailleurs, la classe part */
  const cls = new Set();
  assert.equal(lift({lst: {rect: {top: 690, bottom: 756, height: 66}}, classes: cls}), '124px');
  assert.ok(cls.has('is-over'), 'passe devant la page (z-index au-dessus du sien)');
  const cls2 = new Set(['is-over']); lift({classes: cls2});
  assert.ok(!cls2.has('is-over'), 'sans la page de départ, la notification reprend sa place');
  assert.ok(html.includes('body.in-lesson .toast{bottom:var(--toast-lift,calc(max(8px,var(--safe-bottom)) + 92px))}'), 'dans un cours, la notification suit --toast-lift');
  const toast = cut('function toast(msg,sub,tone){', '/* ---------- Rendu : assistant');
  assert.ok(toast.includes('toastLift(t);t.classList.add(\'on\');'), 'toast() mesure avant d’afficher');
  assert.ok(cut('function showUnlock(', '\n}\n').includes('toastLift(t)'), '« Carte débloquée » (showUnlock) passe aussi par toastLift');
});

test('feuille « Carte » : la note rejoint « Essayer » en bas (21 h 58, Réf 3 : « remplacer le bouton partager par note »)', () => {
  /* 6 novembre (direction A) : le recto, puis le verso (À retenir, Syntaxe, le piège), puis Noter et Essayer côte à côte */
  const open = cut('function openCard(id){', '\n}\n');
  const ordre = ['class="mc-fiche"', 'class="mc mc--big"', '<div class="mc-verso">${memoVerso(id)}</div>', 'class="cd-actions"', 'class="cd-note-btn"', 'class="cd-try-btn"'].map(s => open.indexOf(s));
  assert.ok(ordre.every(i => i > 0) && ordre.every((i, k) => !k || i > ordre[k - 1]), 'ordre : le recto, À retenir, Syntaxe, le piège, puis Noter et Essayer côte à côte');
  assert.ok(!open.includes('coda-note') && !open.includes('shareCard('), 'plus de bandeau vert ni de « Partager » sur la carte');
  assert.ok(!html.includes('<div class="cd-syntaxes">'), 'une seule syntaxe par carte (le CASE simple n’est pas enseigné)');
});
