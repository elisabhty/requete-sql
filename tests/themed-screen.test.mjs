/* Objets à thème, famille « screen » (guidePage) : l’outil interne et sa recherche par numéro (cours 57, cours texte ; le
   téléphone des cours 7 et 8 et l’écran verrouillé du cours 78 étaient dans le cours texte des cours en vidéo, retiré). Chaque
   carte porte toutes les colonnes de sa ligne : le contrôle des pages (tests/helpers/guide-checks.mjs) les compare au vrai résultat. */
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv, checkGuideLesson} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html, ctx} = env;
const lesson = id => vm.runInContext(`MODULES.flatMap(m=>m.lessons).find(l=>l.id===${id})`, ctx);
const cardOf = l => { const b = l.studio.uses.body; return b.slice(b.lastIndexOf('<div class="ij-done is-locked"')); };
const withBody = (l, f) => Object.assign({}, l, {studio: Object.assign({}, l.studio, {uses: Object.assign({}, l.studio.uses, {body: f(l.studio.uses.body)})})});
const count = (s, re) => (s.match(re) || []).length;

test('cours 57 : le numéro tapé, la fiche trouvée, la ligne du plan (SEARCH en vert) et le tampon « Accès direct »', () => {
  const c = cardOf(lesson(57));
  assert.ok(c.includes('<span class="pg-url">outil interne › commandes</span>'));
  assert.ok(c.includes('<div class="sr-box" aria-hidden="true"><i>🔎</i><span class="sr-q" style="--len:16">CMD-2026-1847392</span><em class="sr-chip">⚡ via l’index</em></div>'));
  assert.ok(c.includes('<div class="sr-hit" aria-hidden="true"><small class="pg-kick">Fiche de la commande</small><b>CMD-2026-1847392</b><small>Commandée le 30\u00a0juillet\u00a02026\u00a0· en préparation\u00a0· 2\u00a0unités</small></div>'));
  assert.equal(count(c, /<div class="pg-card is-plan"/g), 1);
  assert.ok(c.includes('<span class="db-x pg-text sr-plan" data-c="3" data-v="SEARCH commandes USING INDEX idx_commandes_numero (numero_commande=?)"><mark>SEARCH</mark> commandes USING INDEX idx_commandes_numero (numero_commande=?)</span>'));
  assert.ok(c.includes('style="--t:calc(var(--t0,.15s) + 1.45s + 0*var(--sg,.28s))"'), 'la carte attend la frappe (delay .5)');
  assert.ok(c.includes('<em class="pg-stamp">Accès direct</em></span><span class="db-x" data-c="0" data-v="3" hidden></span><span class="db-x" data-c="1" data-v="0" hidden></span><span class="db-x" data-c="2" data-v="0" hidden></span></div>'), 'colonnes du plan reportées');
  assert.doesNotThrow(() => checkGuideLesson(env, lesson(57)));
});

test('contrôle des pages : un plan changé (cours 57) est refusé', () => {
  const l57 = lesson(57);
  assert.throws(() => checkGuideLesson(env, withBody(l57, b => b.replace('data-c="3" data-v="SEARCH commandes', 'data-c="3" data-v="SCAN commandes'))), /la carte 1 montre toutes les colonnes/);
});

test('CSS de la famille « screen » : état final de base, états cachés seulement avant la lecture', () => {
  for (const s of [
    '.ij-sms.is-page:not(.is-play) .ph-st>i,.ij-sms.is-page:not(.is-play) .sr-chip,.ij-sms.is-page:not(.is-play) .sr-hit{opacity:0}',
    '.ij-sms.is-page:not(.is-play) .sr-q{width:0}',
    '.ij-sms.is-page.is-play .is-notifs>.pg-card{animation:pgNotif',
    '.ij-sms.is-page:has(.pg-grid.is-notifs){--extra:.4s}',
    '.ij-sms.is-page:has(.pg-grid.is-search){--extra:.1s}',
    '.nt-x{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;',
  ]) assert.ok(html.includes(s), s);
  assert.ok(/\.ph-st \.is-wait\{[^}]*opacity:0/.test(html) && /\.ph-st \.is-done\{color:var\(--ink-3\)\}/.test(html), 'sans lecture : « ✓ Appelé » affiché, « Appel en cours… » caché');
  assert.ok(/\.ph-btn\{[^}]*background:#E7E5EF/.test(html), 'bouton gris une fois l’appel passé');
});
