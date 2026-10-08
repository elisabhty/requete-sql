/* Objet à thème « doc » (guidePage, layout doc) : un document sur porte-bloc. Cours 1 (SELECT) : la liste remise au
   transporteur, une ligne cochée par client, pièce jointe, tampon « Transmise » et camion. Cours 5 (Comparer des valeurs) :
   le bon de commande, une jauge de stock par produit (seuil en pointillés), la ligne du Shaker Inox barrée mais gardée. */
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv, checkGuideLesson} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html, ctx} = env;
const lessonOf = id => vm.runInContext(`MODULES.flatMap(m=>m.lessons).find(l=>l.id===${id})`, ctx);
const cardOf = l => { const b = l.studio.uses.body; return b.slice(b.lastIndexOf('<div class="ij-done is-locked"')); };
const withBody = (l, b) => Object.assign({}, l, {studio: Object.assign({}, l.studio, {uses: Object.assign({}, l.studio.uses, {body: b})})});

test('cours 1 (SELECT) : la liste remise au transporteur est une feuille sur porte-bloc, une ligne cochée par client', () => {
  const l1 = lessonOf(1), c = cardOf(l1);
  assert.ok(c.includes('<div class="ij-sms is-board is-page" style="--n:10;--sg:0.22s" data-total="10" role="group"'), 'racine de page inchangée : le contrôle des pages s’applique');
  assert.ok(c.includes('<div class="pg-win is-clip"><i class="dc-clip" aria-hidden="true"></i><div class="pg-body dc-paper"><div class="dc-head" aria-hidden="true">'), 'planche, pince, feuille, en-tête');
  assert.ok(c.includes('<b class="dc-title">Clients à livrer</b>'));
  assert.ok(c.includes('<p class="ij-sms-h"><i aria-hidden="true">🚚</i>Feuille de prise en charge</p>'), 'titre tiré de l’histoire (« prendre en charge »), distinct du pied');
  assert.ok(c.includes('<div class="pg-grid is-doc" role="table" aria-label="Clients à livrer"><div class="dc-th" role="row" aria-hidden="true">'), 'intitulés de colonnes avant la 1re ligne');
  assert.equal((c.match(/<div class="pg-card is-line" role="row" style="--t:/g) || []).length, 10, 'une ligne par client');
  assert.ok(c.includes('<span class="pg-main" role="cell"><span class="pg-who"><b class="db-x pg-name" data-c="0" data-v="Nathan">Nathan</b> <b class="db-x pg-name" data-c="1" data-v="Dupont">Dupont</b></span><small class="pg-subs"><span class="db-x pg-sub" data-c="2" data-v="Paris">Paris</span> · <span class="db-x pg-sub is-mono" data-c="3" data-v="06 39 98 10 26">06 39 98 10 26</span></small></span>'), 'nom, puis ville · téléphone');
  assert.ok(c.includes('</div></div><div class="dc-foot" aria-hidden="true"><small>📎 liste_clients.csv</small><i class="dc-truck">🚚</i></div><em class="pg-seal" aria-hidden="true">Transmise</em></div></div><p class="ij-sms-done">✓ Liste de 10 clients transmise au transporteur</p>'), 'pièce jointe et camion, puis le tampon, après la dernière ligne');
  assert.ok(!c.includes('ij-sms-bubble') && !c.includes('ij-sms-list'), 'plus de bulle de message');
  assert.doesNotThrow(() => checkGuideLesson(env, l1));
});

test('cours 5 (Comparer des valeurs) : bon de commande avec jauges de stock, le Shaker Inox barré mais gardé', () => {
  const l5 = lessonOf(5), c = cardOf(l5);
  assert.ok(c.includes('style="--n:3;--sg:0.45s" data-total="3"'));
  assert.ok(c.includes('<div class="dc-th" role="row" aria-hidden="true"><span>Produit</span><span>Stock</span></div>'));
  assert.equal((c.match(/<div class="pg-card is-line( is-skip)?" role="row"/g) || []).length, 3, 'trois lignes, le produit écarté compris');
  assert.ok(c.includes('<span class="dc-qty" role="cell"><b class="db-x dc-num" data-c="1" data-v="60">60</b></span><i class="dc-gauge" style="--v:0.75;--lim:0.75" aria-hidden="true"></i>'), 'la jauge de la Tisane Détox touche le seuil');
  assert.ok(c.includes('<div class="pg-card is-line is-skip" role="row"'), 'ligne barrée');
  assert.equal((c.match(/class="pg-card is-line is-skip"/g) || []).length, 1, 'seul le Shaker Inox est barré');
  assert.ok(/data-v="Shaker Inox">Shaker Inox<\/b>[\s\S]*?<small class="dc-note" role="cell">↪ Accessoire\u00a0: commandé ailleurs<\/small><\/div><\/div><em class="pg-seal" aria-hidden="true">Envoyé<\/em>/.test(c), 'note en marge, puis le tampon');
  assert.ok(!c.includes('dc-foot') && !c.includes('Ailleurs'), 'ni pied ni ancien statut « Ailleurs »');
  assert.doesNotThrow(() => checkGuideLesson(env, l5));
  /* Le contrôle des pages lit les données des lignes : une valeur changée est refusée. */
  assert.throws(() => checkGuideLesson(env, withBody(l5, l5.studio.uses.body.replace('data-c="1" data-v="30"', 'data-c="1" data-v="35"'))), /la carte 3 montre toutes les colonnes/);
});

test('CSS du document : état final de base, états cachés seulement avant la lecture, pied après le camion', () => {
  for (const s of [
    '.ij-sms.is-page:has(.dc-truck){--extra:1.4s}',
    '@media (max-width:360px){.dc-paper:has(>.pg-seal):has(>.dc-foot) .pg-grid.is-doc{margin-bottom:46px}}',
    '.ij-sms.is-page.is-play .pg-grid.is-doc .db-x::after{content:none}',
    '.ij-sms.is-page.is-play .pg-grid.is-doc .db-x{animation:none}',
    '.ij-sms.is-page.is-play .pg-card.is-line>.pg-main{animation:pgLine .35s steps(12,end) both var(--t)}',
    '.ij-sms.is-page.is-play .pg-card.is-line::before{animation:pgTick .28s cubic-bezier(.3,1.5,.5,1) both calc(var(--t) + .3s)}',
    '.ij-sms.is-page.is-play .dc-truck{animation:pgDrive 1s ease-out both calc(var(--to) + .5s)}',
    '.ij-sms.is-page:not(.is-play) .dc-gauge::before{width:0}',
  ]) assert.ok(html.includes(s), s);
  const css = html.slice(html.indexOf('/* @themed:doc:css */'), html.indexOf('/* @themed:lanes:css */'));
  assert.ok(!/opacity:0[;}]|[{;]width:0[;}]|scaleX\(0\)/.test(css.split('\n').filter(l => !/:not\(\.is-play\)|@keyframes/.test(l)).join('\n')), 'aucun état caché hors de :not(.is-play) et des keyframes');
});
