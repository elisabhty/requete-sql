/* Carte « Mission accomplie » des cours texte : le Résultat est un dashboard (indicateur, graphique, tableau aux en-têtes
   du résultat), ou un objet à thème (cours 57). Avant la lecture, des cases grises (chargement) ; puis les en-têtes, et
   chaque ligne avec sa barre pendant que l'indicateur compte les lignes. Les cours en vidéo n'ont plus de cours texte. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv, checkGuideLesson, openDb, decode} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html, ctx} = env;
/* Le cours texte d’exemple : l’ancienne leçon 64, CREATE VIEW en texte (tests/fixtures/guide-texte-create-view.js) ; les cours de l’app sont
   presque tous devenus des vidéos. */
const lesson = vm.runInContext(fs.readFileSync(path.join(root, 'tests/fixtures/guide-texte-create-view.js'), 'utf8'), ctx);
const body = lesson.studio.uses.body;
const card = body.slice(body.lastIndexOf('<div class="ij-done is-locked"'));

test('la vérification des dashboards refuse un tableau qui ne suit pas le résultat de la mission', () => {
  /* Dans le tableau du dashboard (la dernière occurrence) : une ligne qui ne suit plus le résultat. */
  const swap = s => { const at = s.lastIndexOf('role="cell">Shaker Inox<'); return s.slice(0, at) + s.slice(at).replace('role="cell">Shaker Inox<', 'role="cell">Magnésium X<'); };
  const bad = Object.assign({}, lesson, {studio: Object.assign({}, lesson.studio, {uses: Object.assign({}, lesson.studio.uses, {body: swap(body)})})});
  assert.throws(() => checkGuideLesson(env, bad), /lignes du dashboard sont celles du résultat/);
  const badHead = Object.assign({}, lesson, {studio: Object.assign({}, lesson.studio, {uses: Object.assign({}, lesson.studio.uses, {body: (at => body.slice(0, at) + body.slice(at).replace('role="columnheader">stock<', 'role="columnheader">stocks<'))(body.lastIndexOf('role="columnheader">stock<'))})})});
  assert.throws(() => checkGuideLesson(env, badHead), /en-têtes du dashboard sont les colonnes du résultat/);
});

test('animation du dashboard : chargement gris avant la lecture, état final = style de base, pied après la dernière ligne', () => {
  assert.ok(html.includes('.ij-sms.is-board:not(.is-play) .db-x{color:transparent}'), 'textes masqués avant la lecture');
  assert.ok(!/\n  \.db-x\{/.test(html) && html.includes('.is-board .db-x{position:relative;'), 'styles cloisonnés au dashboard (la classe db-x sert aussi au « × » des bases de la console)');
  assert.ok(html.includes('.ij-sms.is-board:not(.is-play) .db-x::after{opacity:1;animation:dbShim'), 'cases grises qui scintillent');
  assert.ok(/\.db-x::after\{[^}]*opacity:0;/.test(html), 'sans lecture (mouvement réduit), les cases grises disparaissent');
  assert.ok(html.includes('.db-tr{--t:calc(var(--t0,.15s) + .95s + var(--i,0)*var(--sg,.26s))'), 'une ligne après l’autre');
  assert.ok(html.includes('.ij-sms.is-board.is-play .db-chart i{animation:dbGrow .5s cubic-bezier(.3,.9,.3,1.15) both calc(var(--t0) + .95s + var(--i)*var(--sg,.26s))}'), 'chaque barre pousse avec sa ligne');
  assert.ok(html.includes('.ij-sms.is-board.is-play .ij-sms-done{animation:smsPop .45s cubic-bezier(.2,.8,.3,1.2) both calc(var(--t0) + .95s + var(--n,8)*var(--sg,.26s) + .45s + var(--extra,0s))}'), 'pied « à jour » après la dernière ligne (il déclenche la fin et le bouton Rejouer)');
});

test('compteur des missions : data-ease="linear" suit un rythme régulier', () => {
  const src = html.slice(html.indexOf('function actCountUp('), html.indexOf('function qfSettleHeight('));
  assert.ok(src.includes("const lin=b.dataset.ease==='linear';"));
  assert.ok(src.includes('e=lin?p:1-Math.pow(1-p,3)'));
});

/* Objets à thème (guidePage) : la structure de chaque mise en page, sur le modèle des billets du cours 6. Le protocole des
   pages reste celui du contrôle (tests/helpers/guide-checks.mjs) : une carte pg-card par ligne du résultat, dans l'ordre (cartes
   empilées comprises), chacune avec toutes les colonnes de sa ligne (data-c, data-v). */
/* L’objet à thème du cours 57 (l’outil interne) : son cours texte est gardé dans tests/fixtures/guide-texte-index.js (identifiant 957), le cours
   étant devenu le chapitre 19, en vidéo ; les autres objets à thème étaient dans le cours texte des cours en vidéo. */
const themed = [957];
const INDEX_TEXTE = vm.runInContext(fs.readFileSync(path.join(root, 'tests/fixtures/guide-texte-index.js'), 'utf8'), ctx);
const lessonOf = id => id === 957 ? INDEX_TEXTE : vm.runInContext(`MODULES.flatMap(m=>m.lessons).find(l=>l.id===${id})`, ctx);
const doneOf = id => { const b = lessonOf(id).studio.uses.body; return b.slice(b.lastIndexOf('<div class="ij-done is-locked"')); };
const count = (s, re) => (s.match(re) || []).length;
const withBody = (l, b) => Object.assign({}, l, {studio: Object.assign({}, l.studio, {uses: Object.assign({}, l.studio.uses, {body: b})})});
/* Résultat réel de la requête de la mission (la dernière du cours). */
const missionOf = id => {
  const b = lessonOf(id).studio.uses.body, last = b.slice(b.lastIndexOf('<div class="fn-use">'));
  const db = openDb(env); try { return db.exec(decode(/data-run-sql="([^"]*)"/.exec(last)[1]))[0]; } finally { db.close(); }
};
const vOf = (c, j) => [...c.matchAll(new RegExp(`data-c="${j}" data-v="([^"]*)"`, 'g'))].map(m => decode(m[1]));

test('objets à thème : plus aucun envoi générique (guideSms et sa bulle retirés), le cadre commun reste', () => {
  assert.ok(!html.includes('function guideSms(') && !html.includes('guideSms('), 'guideSms n’a plus d’appelant : retiré');
  assert.ok(!/\n\s+sms:\{/.test(html), 'aucune carte « Mission accomplie » ne garde un envoi sms:{…}');
  for (const old of ['ij-sms-bubble', 'ij-sms-typing', 'ij-sms-list', 'ij-sms-plane', 'ij-sms-meter', 'smsPlane', 'smsBubble']) assert.ok(!html.includes(old), `CSS morte retirée : ${old}`);
  for (const keep of ['  .ij-sms{', '#scr-lesson .ij-sms-h{', '#scr-lesson .ij-sms-done{', '@keyframes smsPop{']) assert.ok(html.includes(keep), `cadre commun gardé : ${keep}`);
  assert.ok(html.includes('@media (prefers-reduced-motion:reduce){.ij-sms,.ij-sms *,.ij-sms *::before,.ij-sms *::after{animation:none!important}#scr-lesson .ij-sms-done{opacity:1!important}}'), 'mouvement réduit : ::before compris, pied visible');
  for (const id of themed) {
    const c = doneOf(id);
    assert.match(c, /<div class="ij-sms is-board is-page" style="--n:\d+;--sg:[\d.]+s" data-total="\d+"/, `cours ${id} : la racine de page que lit le contrôle`);
    assert.ok(!c.includes('ij-sms-bubble') && !c.includes('ij-sms-list'), `cours ${id} : plus de bulle de message`);
    assert.doesNotThrow(() => checkGuideLesson(env, lessonOf(id)), `cours ${id}`);
  }
});

test('cours 57 (recherche, cours texte d’exemple) : une seule fiche, la ligne du plan (is-plan)', () => {
  assert.equal(count(doneOf(957), /<div class="pg-card is-plan"/g), 1);
});

test('contrôle des pages : deux valeurs échangées entre deux cartes (ou une valeur changée) sont refusées, sur chaque objet à thème', () => {
  for (const id of themed) {
    const l = lessonOf(id), body = l.studio.uses.body, at = body.lastIndexOf('<div class="ij-done is-locked"');
    const parts = body.slice(at).split('<div class="pg-card');
    const cards = parts.slice(1);
    let bad = null, k = 0;
    /* Première colonne dont deux cartes diffèrent : on échange leurs valeurs. */
    for (let j = 0; !bad && j < 12; j++) {
      const v = cards.map(cd => (new RegExp(`data-c="${j}" data-v="([^"]*)"`).exec(cd) || [])[1]);
      const a = v.findIndex(x => x !== undefined), b = v.findIndex(x => x !== undefined && x !== v[a]);
      if (a < 0) continue;
      const tag = x => `data-c="${j}" data-v="${x}"`;
      const cs = cards.slice();
      if (b < 0) { if (cards.length > 1) continue; cs[a] = cs[a].split(tag(v[a])).join(tag(v[a] + 'x')); }
      else { cs[a] = cs[a].split(tag(v[a])).join(tag(v[b])); cs[b] = cs[b].split(tag(v[b])).join(tag(v[a])); }
      bad = body.slice(0, at) + [parts[0], ...cs].join('<div class="pg-card'); k = a + 1;
    }
    assert.ok(bad, `cours ${id} : une valeur à échanger`);
    assert.throws(() => checkGuideLesson(env, withBody(l, bad)), new RegExp(`la carte ${k} montre toutes les colonnes`), `cours ${id}`);
  }
});
