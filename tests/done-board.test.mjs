/* Carte « Mission accomplie » du cours « Renommer avec AS » : le Résultat est un dashboard (indicateur, graphique, tableau
   aux intitulés « Nom du produit » et « Prix (€) »), plus un envoi de message. Avant la lecture, des cases grises
   (chargement) ; puis les en-têtes, et chaque ligne avec sa barre pendant que l'indicateur compte les produits. */
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv, checkGuideLesson} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html, ctx} = env;
const lesson = vm.runInContext('MODULES.flatMap(m=>m.lessons).find(l=>l.id===2)', ctx);
const body = lesson.studio.uses.body;
const card = body.slice(body.lastIndexOf('<div class="ij-done is-locked"'));

test('cours 2 : le Résultat de la mission est un dashboard, plus un message', () => {
  assert.match(card, /<div class="ij-sms is-board" style="--n:8;--sg:0\.26s" data-total="8"/, 'dashboard de 8 lignes');
  for (const old of ['ij-sms-bubble', 'ij-sms-list', 'ij-sms-plane', 'ij-sms-typing', 'Ajouté']) assert.ok(!card.includes(old), `plus de « ${old} » (animation d'envoi)`);
  assert.match(card, /<p class="ij-sms-h"><i aria-hidden="true">📊<\/i>Dashboard des produits<\/p>/, 'titre « Dashboard des produits »');
  assert.match(card, /<div class="db-tr is-head" role="row"><span class="db-x" role="columnheader">Nom du produit<\/span><span class="db-x is-num" role="columnheader">Prix \(€\)<\/span><\/div>/, 'en-têtes = les alias de la mission (le prix, chiffré, à droite)');
  assert.equal((card.match(/<div class="db-tr" role="row" style="--i:\d+">/g) || []).length, 8, 'les 8 produits');
  assert.match(card, /<small>Produits<\/small><b class="db-x" data-kpi="rows" data-count-to="8" data-ease="linear" data-delay="1\.1" data-dur="2\.08">8<\/b>/, 'indicateur : 8 produits, compté au rythme des lignes');
  assert.match(card, /<small>Prix \(€\) par produit<\/small>/, 'le graphique porte l’alias « Prix (€) »');
  assert.match(card, /<i style="--i:1\.00;--v:1\.000"><\/i>/, 'Collagène Marin (39.9) : la plus haute barre');
  assert.match(card, /<p class="ij-sms-done">✓ Dashboard à jour<\/p>/);
});

test('la vérification des dashboards refuse un tableau qui ne suit pas le résultat de la mission', () => {
  const swap = s => s.replace('Collagène Marin', 'Magnésium X');
  const bad = Object.assign({}, lesson, {studio: Object.assign({}, lesson.studio, {uses: Object.assign({}, lesson.studio.uses, {body: swap(body)})})});
  assert.throws(() => checkGuideLesson(env, bad), /lignes du dashboard sont celles du résultat/);
  const badHead = Object.assign({}, lesson, {studio: Object.assign({}, lesson.studio, {uses: Object.assign({}, lesson.studio.uses, {body: body.replace('role="columnheader">Prix (€)', 'role="columnheader">Prix')})})});
  assert.throws(() => checkGuideLesson(env, badHead), /en-têtes du dashboard sont les colonnes du résultat/);
});

test('animation du dashboard : chargement gris avant la lecture, état final = style de base, pied après la dernière ligne', () => {
  assert.ok(html.includes('.ij-sms.is-board:not(.is-play) .db-x{color:transparent}'), 'textes masqués avant la lecture');
  assert.ok(!/\n  \.db-x\{/.test(html) && html.includes('.is-board .db-x{position:relative;'), 'styles cloisonnés au dashboard (la classe db-x sert aussi au « × » des bases de la console)');
  assert.ok(html.includes('.ij-sms.is-board:not(.is-play) .db-x::after{opacity:1;animation:dbShim'), 'cases grises qui scintillent');
  assert.ok(/\.db-x::after\{[^}]*opacity:0;/.test(html), 'sans lecture (mouvement réduit), les cases grises disparaissent');
  assert.ok(html.includes('.db-tr{--t:calc(var(--t0,.15s) + .95s + var(--i,0)*var(--sg,.26s))'), 'une ligne après l’autre');
  assert.ok(html.includes('.ij-sms.is-board.is-play .db-chart i{animation:dbGrow .5s cubic-bezier(.3,.9,.3,1.15) both calc(var(--t0) + .95s + var(--i)*var(--sg,.26s))}'), 'chaque barre pousse avec sa ligne');
  assert.ok(html.includes('.ij-sms.is-board.is-play .ij-sms-done{animation:smsPop .45s cubic-bezier(.2,.8,.3,1.2) both calc(var(--t0) + .95s + var(--n,8)*var(--sg,.26s) + .45s)}'), 'pied « à jour » après la dernière ligne (il déclenche la fin et le bouton Rejouer)');
});

test('compteur des missions : data-ease="linear" suit un rythme régulier', () => {
  const src = html.slice(html.indexOf('function actCountUp('), html.indexOf('function qfSettleHeight('));
  assert.ok(src.includes("const lin=b.dataset.ease==='linear';"));
  assert.ok(src.includes('e=lin?p:1-Math.pow(1-p,3)'));
});
