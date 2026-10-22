/* Objets à thème, famille « calendrier » : le calendrier mural et le colis (mise en page « parcel »). Chaque Résultat reste une
   page (guidePage) : une carte par ligne du résultat, dans l'ordre, avec toutes ses colonnes (contrôle des pages de
   tests/helpers/guide-checks.mjs). Le calendrier du cours 53 et les billets duo du cours 42 étaient dans le cours texte de ces
   cours en vidéo, retiré. */
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv, decode} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html, ctx} = env;
const cardsOf = h => h.split('<div class="pg-card').slice(1).map(cd => { const a = []; for (const m of cd.matchAll(/data-c="(\d+)" data-v="([^"]*)"/g)) a[+m[1]] = decode(m[2]); return a; });
const page = m => vm.runInContext(`guidePage(${JSON.stringify(m)})`, ctx);

test('calendrier : dates à cheval sur deux années, écart de 3 jours (--dx, --dy), rang sur la date d’origine (--kf)', () => {
  const rows = [['A', '2025-12-30', '2026-01-02'], ['B', '2025-12-30', '2026-01-05']];
  const h = page({h: 'X', chrome: false, layout: 'calendar', cal: {id: 0, from: 1, to: 2}, rows, done: '✓'});
  assert.ok(h.includes('<div class="cal-h" aria-hidden="true">Décembre 2025 – janvier 2026</div>'));
  assert.ok(h.includes('style="grid-area:2/5;--k:0;--dx:-3;--dy:0;--t:'), '30 déc. (mardi) → 2 janv. (vendredi), même semaine');
  assert.ok(h.includes('style="grid-area:3/1;--k:0;--dx:1;--dy:-1;--kf:1;--t:'), '30 déc. → lundi 5 janv. : une colonne à droite, une semaine plus haut ; 2e commande du 30 déc.');
  assert.deepEqual(cardsOf(h), rows, 'colonnes reportées, cachées');
});

test('CSS calendrier et colis : état final de base, états cachés seulement avant la lecture', () => {
  for (const s of [
    '.ij-sms.is-page:not(.is-play) .cal-src,.ij-sms.is-page:not(.is-play) .cal-env,.ij-sms.is-page:not(.is-play) .cal-x2{opacity:0}',
    '.ij-sms.is-page.is-play .cal-env{animation:calWeek .5s cubic-bezier(.3,1.35,.5,1) both calc(var(--t) + .15s)}',
    '.ij-sms.is-page:has(.pg-win.is-cal){--extra:.5s}',
    '.ij-sms.is-page.is-play .pc-flap.is-l{animation:pcFlapL',
    '@keyframes pcFlapL{0%{transform:rotate(-100deg)',
  ]) assert.ok(html.includes(s), s);
  assert.ok(!/\.ij-sms\.is-page:not\(\.is-play\)[^{]*\.pc-(?:flap|gift|label)/.test(html), 'carton fermé, cadeau dedans, étiquette posée sans lecture');
});
