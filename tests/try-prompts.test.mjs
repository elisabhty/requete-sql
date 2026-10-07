/* Consignes des cadres Exécuter (« 👇 Exécute cette requête… », « 👇 Teste par toi-même… ») : dans tous les cours, elles
   sont l'en-tête lilas du cadre, collé à lui (p.gd-try), avec l'emoji dans une pastille qui passe à ✓ une fois la requête
   exécutée (vert, violet dans un encadré « Attention » où l'erreur est voulue). Le deux-points final est retiré. */
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
    const ok = [...b.matchAll(/<p class="gd-try"><i aria-hidden="true"><b>[^<]+<\/b><svg viewBox="0 0 24 24"><path d="[^"]+"\/><\/svg><\/i><span>((?:(?!<\/p>)[^])*)<\/span><\/p><div class="ij-run/g)];
    assert.equal(ok.length, runs, `${l.titre} : ${runs - ok.length} cadre(s) Exécuter sans consigne en en-tête`);
    for (const m of ok) assert.ok(!/(&nbsp;| |\s):$/.test(m[1]), `${l.titre} : deux-points final dans « ${m[1]} »`);
    assert.ok(!/<p>👇/.test(b), `${l.titre} : une consigne « 👇 » est restée un simple paragraphe`);
    heads += ok.length;
  }
  assert.ok(heads >= 350, `au moins 350 consignes en en-tête (${heads})`);
});

test('« Teste par toi-même » et « Exécute cette requête… » : même en-tête, l’emoji passe dans la pastille', () => {
  const l = lessons.find(x => x.id === 2), b = bodyOf(l);
  assert.ok(b.includes('<p class="gd-try"><i aria-hidden="true"><b>👇</b><svg viewBox="0 0 24 24"><path d="M5.5 12.5l4.2 4.2L18.5 8"/></svg></i><span>Exécute cette requête pour voir la colonne renommée</span></p><div class="ij-run"'));
  assert.ok(b.includes('<p class="gd-try"><i aria-hidden="true"><b>👇</b><svg viewBox="0 0 24 24"><path d="M5.5 12.5l4.2 4.2L18.5 8"/></svg></i><span>Teste par toi-même</span></p><div class="ij-run" data-warn="1"'));
});

test('style : en-tête lilas arrondi en haut, collé au cadre sombre dont les coins du haut deviennent droits', () => {
  assert.ok(/#scr-lesson p\.gd-try\{display:flex;[^}]*border-bottom:0;border-radius:22px 22px 0 0;background:var\(--accent-soft\)/.test(html));
  assert.ok(html.includes('#scr-lesson p.gd-try + .ij-run-frame{margin-top:0!important}'));
  assert.ok(html.includes('#scr-lesson p.gd-try + .ij-run-frame > .exframe{border-top-left-radius:0!important;border-top-right-radius:0!important}'));
});

test('requête exécutée : la pastille passe à ✓ (classe is-ran posée quand le résultat s’affiche), violet dans un encadré « Attention »', () => {
  const src = html.slice(html.indexOf('function initRunSqlSlots('), html.indexOf('function initRunSqlSlots(') + 4000);
  assert.ok(src.includes("const head=wrap.previousElementSibling&&wrap.previousElementSibling.matches('p.gd-try')?wrap.previousElementSibling:null;"));
  assert.ok(src.includes("if(el.dataset.warn)head.classList.add('is-warn');"));
  assert.ok(src.includes("const mark=()=>head.classList.toggle('is-ran',!res.hidden);"));
  assert.ok(html.includes('#scr-lesson p.gd-try.is-ran > i > svg{opacity:1;stroke-dashoffset:0;'), 'la coche se dessine');
  assert.ok(html.includes('animation:gdTryPop .5s'), 'petit rebond de la pastille');
  assert.ok(html.includes('@media (prefers-reduced-motion:reduce){#scr-lesson p.gd-try > i,#scr-lesson p.gd-try > i *{animation:none!important;transition:none!important}}'), 'mouvement réduit : pas d’animation');
  assert.ok(html.includes('#scr-lesson p.gd-try.is-ran.is-warn > i{background:var(--accent);'), 'violet dans un encadré « Attention »');
});

test('dans un encadré « Attention », la consigne d’un second cadre n’est pas prise pour le commentaire du premier (elle reste visible)', () => {
  assert.ok(html.includes("if(!notes.length&&nx&&nx.tagName==='P'&&!nx.classList.contains('gd-try')&&src.closest('.sit-memo.is-warn'))notes.push(nx);"));
});
