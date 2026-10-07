/* Consignes des cadres Exécuter (« 👇 Exécute cette requête… », « 👇 Teste par toi-même… ») : dans tous les cours, elles
   sont l'en-tête lilas du cadre, collé à lui (p.gd-try), avec l'emoji dans une pastille qui reste affichée une fois la requête
   exécutée. Le deux-points final est retiré. */
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const {html, ctx} = await guideEnv(root);
const lessons = vm.runInContext('MODULES.flatMap(m=>m.lessons)', ctx);
const bodyOf = l => [l.situation, l.studio.problem.extra, l.studio.uses.body, (l.studio.reflex || {}).extra].join('\n');

test('chaque cadre Exécuter des cours a sa consigne en en-tête (p.gd-try juste au-dessus), sans deux-points final', () => {
  let heads = 0;
  for (const l of lessons) {
    const b = bodyOf(l);
    const runs = (b.match(/<div class="ij-run"/g) || []).length;
    const ok = [...b.matchAll(/<p class="gd-try"><i aria-hidden="true"><b>[^<]+<\/b><\/i><span>((?:(?!<\/p>)[^])*)<\/span><\/p><div class="ij-run/g)];
    assert.equal(ok.length, runs, `${l.titre} : ${runs - ok.length} cadre(s) Exécuter sans consigne en en-tête`);
    for (const m of ok) assert.ok(!/(&nbsp;| |\s):$/.test(m[1]), `${l.titre} : deux-points final dans « ${m[1]} »`);
    assert.ok(!/<p>👇/.test(b), `${l.titre} : une consigne « 👇 » est restée un simple paragraphe`);
    heads += ok.length;
  }
  assert.ok(heads >= 350, `au moins 350 consignes en en-tête (${heads})`);
});

test('« Teste par toi-même » et « Exécute cette requête… » : même en-tête, l’emoji passe dans la pastille', () => {
  const l = lessons.find(x => x.id === 2), b = bodyOf(l);
  assert.ok(b.includes('<p class="gd-try"><i aria-hidden="true"><b>👇</b></i><span>Exécute cette requête pour voir la colonne renommée</span></p><div class="ij-run"'));
  assert.ok(b.includes('<p class="gd-try"><i aria-hidden="true"><b>👇</b></i><span>Teste par toi-même</span></p><div class="ij-run" data-warn="1"'));
});

test('style : en-tête lilas arrondi en haut, collé au cadre sombre dont les coins du haut deviennent droits', () => {
  assert.ok(/#scr-lesson p\.gd-try\{display:flex;[^}]*border-bottom:0;border-radius:22px 22px 0 0;background:var\(--accent-soft\)/.test(html));
  assert.ok(html.includes('#scr-lesson p.gd-try + .ij-run-frame{margin-top:0!important}'));
  assert.ok(html.includes('#scr-lesson p.gd-try + .ij-run-frame > .exframe{border-top-left-radius:0!important;border-top-right-radius:0!important}'));
});

test('requête exécutée : le doigt 👇 reste affiché (plus de coche à la place), à la demande de l’utilisatrice', () => {
  const src = html.slice(html.indexOf('function initRunSqlSlots('), html.indexOf('function initRunSqlSlots(') + 4000);
  assert.ok(!src.includes("classList.toggle('is-ran'"), 'aucune bascule de la pastille après l’exécution');
  assert.ok(!html.includes('p.gd-try.is-ran'), 'plus de style « exécutée » pour la pastille');
  assert.ok(!/<p class="gd-try"><i aria-hidden="true"><b>[^<]*<\/b><svg/.test(html), 'plus de coche dans la pastille');
});

test('dans un encadré « Attention », la consigne d’un second cadre n’est pas prise pour le commentaire du premier (elle reste visible)', () => {
  assert.ok(html.includes("if(!notes.length&&nx&&nx.tagName==='P'&&!nx.classList.contains('gd-try')&&src.closest('.sit-memo.is-warn'))notes.push(nx);"));
});
