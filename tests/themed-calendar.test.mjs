/* Objets à thème, famille « calendrier » : le calendrier mural du cours 53 (dates de suivi), les billets duo empilés du cours 42
   (SELF JOIN) et le colis du cours 35 (clé étrangère). Chaque Résultat reste une page (guidePage) : une carte par ligne du
   résultat, dans l'ordre, avec toutes ses colonnes (contrôle des pages de tests/helpers/guide-checks.mjs). */
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv, checkGuideLesson, decode} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html, ctx} = env;
const lessonOf = id => vm.runInContext(`MODULES.flatMap(m=>m.lessons).find(l=>l.id===${id})`, ctx);
const cardOf = l => { const b = l.studio.uses.body; return b.slice(b.lastIndexOf('<div class="ij-done is-locked"')); };
const withBody = (l, b) => Object.assign({}, l, {studio: Object.assign({}, l.studio, {uses: Object.assign({}, l.studio.uses, {body: b})})});
const cardsOf = h => h.split('<div class="pg-card').slice(1).map(cd => { const a = []; for (const m of cd.matchAll(/data-c="(\d+)" data-v="([^"]*)"/g)) a[+m[1]] = decode(m[2]); return a; });
const page = m => vm.runInContext(`guidePage(${JSON.stringify(m)})`, ctx);

test('cours 53 (dates) : un calendrier mural de juillet-août 2026, chaque 📨 une semaine sous son 🛒, les 16 lignes en vue', () => {
  const l = lessonOf(53), c = cardOf(l);
  assert.doesNotThrow(() => checkGuideLesson(env, l));
  assert.match(c, /<div class="ij-sms is-board is-page" style="--n:16;--sg:0\.2s" data-total="16"/, 'une étape par ligne, aucune pile');
  assert.ok(c.includes('<div class="pg-win is-cal"><i class="cal-rings" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></i>'), 'feuille à reliure, six anneaux');
  assert.ok(c.includes('<div class="cal-h" aria-hidden="true">Juillet – août 2026</div>'), 'titre tiré des dates');
  assert.ok(c.includes('<div class="pg-grid is-calendar" style="--weeks:7">'), 'sept semaines, du lundi 29 juin au dimanche 16 août');
  assert.equal((c.match(/<i class="cal-dow"/g) || []).length, 7);
  assert.equal((c.match(/<i class="cal-d[ "]/g) || []).length, 49, 'une case par jour');
  assert.equal((c.match(/<i class="cal-d is-out"/g) || []).length, 2, '29 et 30 juin pâlis');
  assert.equal((c.match(/<i class="cal-d is-m2"/g) || []).length, 16, 'août teinté');
  assert.ok(c.includes('style="grid-area:6/6;--r:4">1<small>août</small></i>'), 'le 1er août écrit son mois');
  const cards = [...c.matchAll(/<div class="pg-card is-cal" role="img" aria-label="([^"]*)" style="grid-area:(\d+)\/(\d+);--k:(\d);--t:/g)];
  assert.deepEqual(cards.map(m => `${m[2]}/${m[3]}${m[4] === '1' ? ' k1' : ''}`), ['3/4', '3/4 k1', '3/7', '4/3', '4/6', '4/7', '5/3', '5/6', '5/6 k1', '6/1', '6/3', '6/6', '7/2', '7/4', '7/6', '8/1'], 'chaque carte sur sa date de suivi ; deux paires le même jour (9 et 25 juillet)');
  assert.ok(!/--dx:|--dy:/.test(c), '+7 jours : même colonne, une semaine plus haut (valeurs par défaut)');
  assert.equal(decode(cards[11][1]).replace(/\u00a0/g, ' '), 'CMD-2026-1093528 : commande du 25 juillet, message de suivi le 1er août');
  assert.equal((c.match(/<b class="cal-x2" aria-hidden="true">×2<\/b>/g) || []).length, 2);
  assert.equal((c.match(/<i class="cal-src" aria-hidden="true">🛒<\/i><i class="cal-env" aria-hidden="true">📨<\/i>/g) || []).length, 16);
  assert.ok(c.includes('<div class="cal-leg" aria-hidden="true">🛒 commande · 📨 message de suivi</div><em class="pg-seal" aria-hidden="true">Planifié</em>'));
  assert.ok(!/<i class="cal-[^>]*data-c=/.test(c), 'les cases et pastilles ne portent aucune donnée');
  const b = l.studio.uses.body;
  assert.equal(b.split('data-c="2" data-v="2026-08-10"').length, 2);
  assert.throws(() => checkGuideLesson(env, withBody(l, b.replace('data-c="2" data-v="2026-08-10"', 'data-c="2" data-v="2026-08-11"'))), /la carte 16 montre toutes les colonnes/);
});

test('calendrier : dates à cheval sur deux années, écart de 3 jours (--dx, --dy), rang sur la date d’origine (--kf)', () => {
  const rows = [['A', '2025-12-30', '2026-01-02'], ['B', '2025-12-30', '2026-01-05']];
  const h = page({h: 'X', chrome: false, layout: 'calendar', cal: {id: 0, from: 1, to: 2}, rows, done: '✓'});
  assert.ok(h.includes('<div class="cal-h" aria-hidden="true">Décembre 2025 – janvier 2026</div>'));
  assert.ok(h.includes('style="grid-area:2/5;--k:0;--dx:-3;--dy:0;--t:'), '30 déc. (mardi) → 2 janv. (vendredi), même semaine');
  assert.ok(h.includes('style="grid-area:3/1;--k:0;--dx:1;--dy:-1;--kf:1;--t:'), '30 déc. → lundi 5 janv. : une colonne à droite, une semaine plus haut ; 2e commande du 30 déc.');
  assert.deepEqual(cardsOf(h), rows, 'colonnes reportées, cachées');
});

test('cours 42 (SELF JOIN) : billets duo, Lyon et les deux Nathan en vue, trois autres billets de Paris empilés', () => {
  const l = lessonOf(42), c = cardOf(l);
  assert.doesNotThrow(() => checkGuideLesson(env, l));
  assert.match(c, /<div class="ij-sms is-board is-page" style="--n:5;--sg:0\.28s" data-total="7"/, '4 billets en vue + 1 pile');
  assert.ok(c.includes('<div class="pg-grid is-tickets has-pile">'));
  const tickets = [...c.matchAll(/<div class="pg-card is-ticket( is-stacked)?"[^>]*>[\s\S]*?<i class="pg-no">N°\u00a0(\d+)<\/i>/g)].map(m => `${m[2]}${m[1] ? ' pile' : ''}`);
  assert.deepEqual(tickets, ['001', '002', '003 pile', '004', '005 pile', '006', '007 pile'], 'ordre du résultat ; N° = rang de la ligne');
  assert.equal((c.match(/<span class="pg-stub is-alt">/g) || []).length, 1, 'un seul talon Lyon');
  assert.ok(c.includes('<b class="db-x pg-name" data-c="0" data-v="Nathan">Nathan\u00a0P.</b><i class="pg-sep">\u00a0&amp; </i><b class="db-x pg-name" data-c="1" data-v="Nathan">Nathan\u00a0D.</b>'), 'deux clients différents, même prénom');
  assert.equal((c.match(/<small class="pg-subs">Entrée pour 2<\/small><em class="pg-stamp">Envoyé<\/em>/g) || []).length, 7);
  assert.ok(c.includes('>… et 3 autres billets duo à Paris</div></div>'));
});

test('cours 35 (clé étrangère) : le colis de Nathan, son étiquette et la pastille « Cadeau glissé »', () => {
  const l = lessonOf(35), c = cardOf(l);
  assert.doesNotThrow(() => checkGuideLesson(env, l));
  assert.ok(!c.includes('db-table is-fiche'), 'plus de fiche');
  assert.ok(c.includes('<div class="pg-grid is-parcel"><div class="pg-card is-parcel" style="--t:calc(var(--t0,.15s) + .95s + 0*var(--sg,.28s))"><span class="pc-box" aria-hidden="true"><i class="pc-flap is-l"></i><i class="pc-flap is-r"></i><i class="pc-gift">🎁</i></span>'));
  assert.ok(c.includes('<small class="pg-kick">Colis de Nathan</small><b class="db-x pg-name pc-no" data-c="0" data-v="CMD-2026-1093528">CMD-2026-1093528</b>'));
  assert.ok(c.includes('<span class="db-x pg-sub" data-c="1" data-v="2">Produit n°\u00a02</span> · <span class="db-x pg-sub" data-c="2" data-v="en_preparation">en préparation</span>'), 'valeur brute, texte lisible');
  assert.ok(c.includes('<em class="pg-stamp pc-sticker"><i aria-hidden="true">🎁</i>Cadeau glissé</em>'));
});

test('CSS calendrier et colis : état final de base, états cachés seulement avant la lecture', () => {
  for (const s of [
    '.ij-sms.is-page:not(.is-play) .cal-src,.ij-sms.is-page:not(.is-play) .cal-env,.ij-sms.is-page:not(.is-play) .cal-x2{opacity:0}',
    '.ij-sms.is-page.is-play .cal-env{animation:calWeek .5s cubic-bezier(.3,1.35,.5,1) both calc(var(--t) + .15s)}',
    '.ij-sms.is-page.is-play .pc-flap.is-l{animation:pcFlapL',
    '@keyframes pcFlapL{0%{transform:rotate(-100deg)',
  ]) assert.ok(html.includes(s), s);
  assert.ok(!/\.ij-sms\.is-page:not\(\.is-play\)[^{]*\.pc-(?:flap|gift|label)/.test(html), 'carton fermé, cadeau dedans, étiquette posée sans lecture');
});
