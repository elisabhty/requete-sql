/* Objets à thème, famille « screen » (guidePage) : un téléphone pour les appels (cours 7 et 8, étiquette déchirée au 8),
   l’écran verrouillé et ses rappels (cours 78), l’outil interne et sa recherche par numéro (cours 57). Chaque carte porte
   toutes les colonnes de sa ligne : le contrôle des pages (tests/helpers/guide-checks.mjs) les compare au vrai résultat. */
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

test('cours 7 : le téléphone appelle Hugo puis Inès, « email absent » sous chaque numéro', () => {
  const c = cardOf(lesson(7));
  assert.ok(c.includes('<div class="ij-sms is-board is-page" style="--n:2;--sg:1.4s" data-total="2"'), 'racine du contrôle des pages, une étape par appel');
  assert.ok(c.includes('<div class="pg-win is-phone"><div class="ph-bar" aria-hidden="true"><b>10:30</b><i class="ph-notch"></i><i class="ph-sig"></i></div>'), 'téléphone, barre d’état 10:30');
  assert.ok(c.includes('<div class="ph-title" aria-hidden="true"><b>Appels à passer</b><small>Email absent</small></div><div class="pg-grid is-calls">'));
  assert.equal(count(c, /<div class="pg-card is-call" style="--t:/g), 2, 'une ligne par client');
  assert.ok(c.includes('<b class="ph-av" aria-hidden="true">HL</b>') && c.includes('<b class="ph-av" aria-hidden="true">IL</b>'), 'initiales');
  assert.ok(c.includes('<small class="db-x pg-sub ph-num" data-c="2" data-v="06 39 98 68 03">06 39 98 68 03</small>'), 'numéro = donnée');
  assert.equal(count(c, /<em class="ph-note">✉️ email absent<\/em>/g), 2);
  assert.equal(count(c, /<span class="ph-st" aria-hidden="true"><i class="is-wait">Appel en cours…<\/i><i class="is-done">✓ Appelé<\/i><\/span>/g), 2);
  assert.equal(count(c, /<i class="ph-btn" aria-hidden="true"><svg/g), 2, 'bouton d’appel');
  for (const old of ['ij-sms-bubble', 'ij-sms-list', 'ij-sms-plane', 'ij-sms-typing']) assert.ok(!c.includes(old), `plus de « ${old} »`);
  assert.doesNotThrow(() => checkGuideLesson(env, lesson(7)));
});

test('cours 8 : l’étiquette déchirée ne laisse lire qu’un L, puis le L de chaque prénom s’allume', () => {
  const c = cardOf(lesson(8));
  assert.ok(c.includes('<div class="pg-body"><div class="ph-lead" aria-hidden="true"><small>Étiquette du colis</small><b>Destinataire\u00a0: <u>L</u><i class="ph-scrawl"></i></b></div><div class="ph-title" aria-hidden="true"><b>Destinataires possibles</b><small>Colis revenu à l’entrepôt</small></div><div class="pg-grid is-calls">'), 'étiquette puis en-tête, avant la liste, sans donnée');
  assert.ok(c.includes('<b class="db-x pg-name" data-c="0" data-v="Lucas"><u class="ph-hl">L</u>ucas</b>'), 'L souligné, valeur brute intacte');
  assert.ok(c.includes('<b class="db-x pg-name" data-c="0" data-v="Léa"><u class="ph-hl">L</u>éa</b>'));
  assert.ok(!c.includes('ph-note'), 'pas de note');
  assert.ok(c.includes('<p class="ij-sms-done">✓ 2 appels pour retrouver le destinataire</p>'), 'pied distinct de celui du cours 7');
  assert.doesNotThrow(() => checkGuideLesson(env, lesson(8)));
});

test('cours 78 : écran verrouillé, 5 rappels en vue (dont Hugo et Gabriel « par défaut »), pile de 3', () => {
  const c = cardOf(lesson(78));
  assert.ok(c.includes('style="--n:6;--sg:0.35s" data-total="8"'), '5 cartes en vue + 1 pile');
  assert.ok(c.includes('<div class="pg-win is-phone is-lock">') && c.includes('<div class="ph-clock" aria-hidden="true"><b>10:30</b><small>Aperçu des rappels</small></div><div class="pg-grid is-notifs has-pile">'));
  assert.equal(count(c, /<div class="pg-card is-notif/g), 8, 'un rappel par client, tous dans le DOM');
  const st = [...c.matchAll(/<div class="pg-card is-notif is-stacked" style="[^"]*;--k:(\d)" aria-hidden="true">[\s\S]*?data-c="0" data-v="([^"]*)"/g)].map(m => [+m[1], m[2]]);
  assert.deepEqual(st, [[0, 'Nathan'], [1, 'Chloé'], [2, 'Léa']], 'Nathan, Chloé et Léa empilés');
  assert.equal(count(c, /<em class="pg-flag">par défaut<\/em>/g), 2, 'Hugo et Gabriel : 10 j par défaut');
  assert.ok(c.includes('<span class="db-x nt-when" data-c="1" data-v="13">dans 13 j</span>'), 'délai = donnée');
  assert.ok(c.includes('<span class="db-x nt-when" data-c="1" data-v="0">le jour même</span>'), 'Léa : délai 0');
  assert.ok(c.includes('<div class="pg-more" style="--t:calc(var(--t0,.15s) + .95s + 5*var(--sg,.28s))">+3 rappels programmés</div>'));
  assert.doesNotThrow(() => checkGuideLesson(env, lesson(78)));
});

test('cours 57 : le numéro tapé, la fiche trouvée, la ligne du plan (SEARCH en vert) et le tampon « Retrouvée »', () => {
  const c = cardOf(lesson(57));
  assert.ok(c.includes('<span class="pg-url">outil interne › commandes</span>'));
  assert.ok(c.includes('<div class="sr-box" aria-hidden="true"><i>🔎</i><span class="sr-q" style="--len:16">CMD-2026-1847392</span><em class="sr-chip">⚡ via l’index</em></div>'));
  assert.ok(c.includes('<div class="sr-hit" aria-hidden="true"><small class="pg-kick">Commande trouvée</small><b>CMD-2026-1847392</b><small>Commandée le 30\u00a0juillet 2026\u00a0· en préparation\u00a0· 2\u00a0unités</small></div>'));
  assert.equal(count(c, /<div class="pg-card is-plan"/g), 1);
  assert.ok(c.includes('<span class="db-x pg-text sr-plan" data-c="3" data-v="SEARCH commandes USING INDEX idx_commandes_numero (numero_commande=?)"><mark>SEARCH</mark> commandes USING INDEX idx_commandes_numero (numero_commande=?)</span>'));
  assert.ok(c.includes('style="--t:calc(var(--t0,.15s) + 1.45s + 0*var(--sg,.28s))"'), 'la carte attend la frappe (delay .5)');
  assert.ok(c.includes('<em class="pg-stamp">Retrouvée</em></span><span class="db-x" data-c="0" data-v="3" hidden></span><span class="db-x" data-c="1" data-v="0" hidden></span><span class="db-x" data-c="2" data-v="0" hidden></span></div>'), 'colonnes du plan reportées');
  assert.doesNotThrow(() => checkGuideLesson(env, lesson(57)));
});

test('contrôle des pages : un numéro changé (cours 7) ou un plan changé (cours 57) sont refusés', () => {
  const l7 = lesson(7), l57 = lesson(57);
  assert.throws(() => checkGuideLesson(env, withBody(l7, b => b.replace('data-c="2" data-v="06 39 98 97 50"', 'data-c="2" data-v="06 39 98 97 51"'))), /la carte 2 montre toutes les colonnes/);
  assert.throws(() => checkGuideLesson(env, withBody(l57, b => b.replace('data-c="3" data-v="SEARCH commandes', 'data-c="3" data-v="SCAN commandes'))), /la carte 1 montre toutes les colonnes/);
});

test('CSS de la famille « screen » : état final de base, états cachés seulement avant la lecture', () => {
  for (const s of [
    '.ij-sms.is-page:not(.is-play) .ph-st>i,.ij-sms.is-page:not(.is-play) .sr-chip,.ij-sms.is-page:not(.is-play) .sr-hit{opacity:0}',
    '.ij-sms.is-page:not(.is-play) .sr-q{width:0}',
    '.ij-sms.is-page.is-play .is-notifs>.pg-card{animation:pgNotif',
    '.ij-sms.is-page:has(.pg-grid.is-notifs){--extra:.4s}',
    '.ij-sms.is-page:has(.pg-grid.is-search){--extra:.9s}',
  ]) assert.ok(html.includes(s), s);
  assert.ok(/\.ph-st \.is-wait\{[^}]*opacity:0/.test(html) && /\.ph-st \.is-done\{color:var\(--ink-3\)\}/.test(html), 'sans lecture : « ✓ Appelé » affiché, « Appel en cours… » caché');
  assert.ok(/\.ph-btn\{[^}]*background:#E7E5EF/.test(html), 'bouton gris une fois l’appel passé');
});
