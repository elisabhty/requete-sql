/* « 👇 Teste par toi-même » : dans tous les cours, l'invitation à essayer est encadrée (p.gd-try) et suivie directement
   du cadre Exécuter qu'elle annonce ; les autres textes (« 👇 Exécute… ») restent de simples paragraphes. */
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const {html, ctx} = await guideEnv(root);
const lessons = vm.runInContext('MODULES.flatMap(m=>m.lessons)', ctx);
const bodyOf = l => [l.situation, l.studio.problem.extra, l.studio.uses.body, (l.studio.reflex || {}).extra].join('\n');

test('chaque « Teste par toi-même » est encadré, juste au-dessus de son cadre Exécuter', () => {
  let framed = 0;
  for (const l of lessons) {
    const b = bodyOf(l);
    assert.ok(!/<p>👇\s*Teste par toi/.test(b), `${l.titre} : un « Teste par toi-même » n’est pas encadré`);
    const all = (b.match(/Teste par toi-même/g) || []).length;
    const ok = [...b.matchAll(/<p class="gd-try"><i aria-hidden="true">👇<\/i><span>Teste par toi-même(?:(?!<\/p>)[^])*<\/span><\/p><div class="ij-run/g)].length;
    assert.equal(ok, all, `${l.titre} : ${all - ok} « Teste par toi-même » sans cadre ou sans cadre Exécuter juste après`);
    framed += ok;
  }
  assert.ok(framed >= 80, `au moins 80 invitations encadrées dans les cours (${framed})`);
});

test('les autres textes qui annoncent un cadre Exécuter restent de simples paragraphes', () => {
  const l = lessons.find(x => x.id === 2);
  assert.match(l.studio.uses.body, /<p>👇 Exécute cette requête pour voir la colonne renommée&nbsp;:<\/p><div class="ij-run"|<p>👇 Exécute cette requête pour voir la colonne renommée :<\/p><div class="ij-run"/);
});

test('style du cadre : bande lilas bordée, texte en couleur d’accent, collée au cadre Exécuter', () => {
  assert.ok(/#scr-lesson p\.gd-try\{display:flex;[^}]*border:1\.5px solid [^;]+;border-radius:14px;background:var\(--accent-soft\)/.test(html));
  assert.ok(html.includes('#scr-lesson p.gd-try + .ij-run-frame,#scr-lesson p.gd-try + .ij-run{margin-top:8px}'));
});
