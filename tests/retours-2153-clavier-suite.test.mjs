// Elisa, 12 novembre, 21 h 53 (sa capture du prénom, clavier ouvert) : « quand on a le clavier dans le champ et qu’on veut passer
// à la suite, c’est là où il y a un flash. Mais sinon, le reste, c’est OK. »
// Dans l’app, la page rétrécit au-dessus du clavier (Keyboard « native »). « Continuer » peignait la page suivante dans cette
// demi-hauteur : mesurée toute petite (échelle 0,82 et les cinq paliers de resserrement), puis remesurée à la bonne taille 40 ms
// après, quand le clavier se fermait. Le clavier se ferme maintenant dès le toucher, la page d’avant s’efface figée, et la
// suivante n’est peinte qu’une fois, à la bonne hauteur.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const SRC = cut('const OB_SORTIE_MS=110;', '/* 4 novembre, 2 h 13 : « quand on clique sur Voir mon parcours');

function monde({champ = true, hauteur = 516, pleine = 852, calme = false} = {}) {
  const timers = [], journal = [], cls = new Set(['on', 'ob-clavier']), M = {t: 0, hauteur};
  const input = {tagName: 'INPUT', blur: () => journal.push('blur')};
  const body = {offsetHeight: 430, style: {}, classList: {add: c => journal.push('classe ' + c)}, contains: e => e === input};
  const root = {dataset: {}, classList: {remove: c => { cls.delete(c); }, contains: c => cls.has(c)}, get clientHeight() { return M.hauteur; }};
  const ctx = vm.createContext({obLock: false, OB_SLIDES: ['name', 'pays'], OB_STEPS: 2, obStep: 0, obPseudoAvant: () => false, prefersReduceMotion: () => calme,
    paintOb: () => journal.push(`peint à ${M.hauteur} pt, hauteur figée [${body.style.height || ''}], clavier ${cls.has('ob-clavier')}`),
    document: {activeElement: champ ? input : {tagName: 'BODY'}, getElementById: id => (id === 'ob-body' ? body : root)},
    setTimeout: (f, d) => { timers.push({f, d}); return timers.length; }, Date: {now: () => M.t}});
  vm.runInContext(SRC + `;obHPleine=${pleine};`, ctx);
  const tour = () => { const x = timers.shift(); M.t += x.d; x.f(); return x.d; };
  return {ctx, timers, journal, body, cls, M, tour};
}

test('clavier ouvert : il se ferme dès le toucher, la page d’avant s’efface figée, la suivante attend que la vue ait repris sa hauteur', () => {
  const m = monde();
  m.ctx.obGoto('pays');
  assert.deepEqual(m.journal, ['blur', 'classe out'], 'le champ perd la main tout de suite : le clavier commence à descendre');
  assert.equal(m.body.style.height, '430px', 'la page qui s’efface garde sa hauteur : elle ne se remet pas en page quand la vue grandit');
  assert.equal(vm.runInContext('obLock', m.ctx), true);
  assert.deepEqual(m.timers.map(t => t.d), [110], 'le fondu de sortie, comme toujours');
  /* À la fin du fondu, la vue est encore rétrécie : on attend, par pas de 30 ms, sans peindre */
  assert.equal(m.tour(), 110); assert.deepEqual(m.timers.map(t => t.d), [30]); assert.equal(m.journal.length, 2);
  m.tour(); assert.equal(m.journal.length, 2);
  /* La vue a repris sa hauteur : la page suivante est peinte, une fois, à 852 pt, sans la classe du clavier ni la hauteur figée */
  m.M.hauteur = 852; m.tour();
  assert.deepEqual(m.journal.slice(2), ['peint à 852 pt, hauteur figée [], clavier false']);
  assert.equal(vm.runInContext('obLock', m.ctx), false); assert.equal(vm.runInContext('obStep', m.ctx), 1); assert.equal(m.timers.length, 0);
});

test('la vue a déjà repris sa hauteur à la fin du fondu (le cas courant) : aucune attente en plus', () => {
  const m = monde();
  m.ctx.obGoto('pays'); m.M.hauteur = 852; m.tour();
  assert.deepEqual(m.journal, ['blur', 'classe out', 'peint à 852 pt, hauteur figée [], clavier false']); assert.equal(m.timers.length, 0);
  /* à quelques points près (la barre d’état) : pas d’attente non plus */
  const p = monde({hauteur: 800}); p.ctx.obGoto('pays'); p.tour(); assert.equal(p.journal.length, 3);
});

test('jamais bloqué : au plus 450 ms d’attente, et rien du tout sans champ, sans vue rétrécie ou sans hauteur connue', () => {
  const m = monde();
  m.ctx.obGoto('pays');
  let n = 0; while (m.timers.length && n++ < 40) m.tour();
  assert.ok(m.M.t >= 450 && m.M.t < 520, `peinte au bout de ${m.M.t} ms même si la vue ne grandit pas`);
  assert.equal(m.journal.at(-1), 'peint à 516 pt, hauteur figée [], clavier false');
  assert.ok(SRC.includes('const OB_CLAVIER_MS=450;'));
  /* Pas de champ en cours (toutes les autres pages) : exactement comme avant */
  const sans = monde({champ: false}); sans.ctx.obGoto('pays');
  assert.deepEqual(sans.journal, ['classe out']); assert.equal(sans.body.style.height, undefined);
  assert.equal(sans.tour(), 110); assert.equal(sans.journal.length, 2); assert.equal(sans.timers.length, 0);
  /* Safari, ordinateur : la vue ne rétrécit pas sous le clavier */
  const safari = monde({hauteur: 852}); safari.ctx.obGoto('pays'); safari.tour(); assert.equal(safari.journal.length, 3);
  /* Hauteur sans clavier inconnue : on n’attend pas */
  const inconnu = monde({pleine: 0}); inconnu.ctx.obGoto('pays'); inconnu.tour(); assert.equal(inconnu.journal.length, 3);
  /* Mouvement réduit : pas de fondu, mais la même attente de la bonne hauteur */
  const calme = monde({calme: true}); calme.ctx.obGoto('pays');
  assert.deepEqual(calme.timers.map(t => t.d), [0]); calme.tour(); assert.deepEqual(calme.timers.map(t => t.d), [30]);
  calme.M.hauteur = 852; calme.tour(); assert.equal(calme.journal.at(-1), 'peint à 852 pt, hauteur figée [], clavier false');
});

test('pendant le changement de page : la classe du clavier reste, obFit ne remesure pas la page qui s’efface ; la hauteur sans clavier est notée', () => {
  /* focusout puis keyboardWillHide arrivent pendant le fondu : la classe ne part pas (la page se remettrait en page sous les yeux) */
  assert.ok(app.includes("if(on)r.classList.add('ob-clavier');else obClavierAttente=setTimeout(()=>{if(typeof obLock!=='undefined'&&obLock)return;r.classList.remove('ob-clavier');},60);"));
  /* La vue grandit pendant le fondu (ResizeObserver, resize) : pas de mesure tant que la page suivante n’est pas là */
  const fit = cut('function obFit(){', '\n  /* ob-fit-5');
  assert.ok(fit.includes("if(typeof obLock!=='undefined'&&obLock)return;"));
  assert.ok(fit.indexOf('if(!body||!root)return;') < fit.indexOf("if(typeof obLock!=='undefined'&&obLock)return;"));
  /* La plus grande hauteur vue à cette largeur (l’iPhone tourné repart de zéro) */
  assert.ok(app.includes('if(l!==obHPleineL){obHPleineL=l;obHPleine=h;}else if(h>obHPleine)obHPleine=h;'));
  const noter = (mesures) => { const ctx = vm.createContext({}); vm.runInContext('let obHPleine=0,obHPleineL=0;const note=(l,h)=>{if(l!==obHPleineL){obHPleineL=l;obHPleine=h;}else if(h>obHPleine)obHPleine=h;return obHPleine;};', ctx);
    return mesures.map(([l, h]) => vm.runInContext(`note(${l},${h})`, ctx)); };
  assert.deepEqual(noter([[393, 852], [393, 516], [393, 852], [852, 393], [852, 200]]), [852, 852, 852, 393, 393]);
  /* Toutes les pages à champ passent par obGoto : le prénom (obNext), le pseudo (psPageFin → la suite), « Retour » */
  assert.ok(app.includes("else if(slide==='name')obGoto('pays');"));
});
