/* Elisa, 7 novembre, 9 h 08 : « Quand on a fait une semaine complète : bravo… quel message on peut mettre ? Laisse-moi choisir. »
   Son choix, parmi quatre : « Ta semaine est en feu 🔥 », et dessous « 7 jours sur 7, bravo ! ». La semaine est complète quand chaque
   jour est fait ou de repos (les jours de repos ne comptent pas : « 5 jours sur 5 ») ; le lundi, une nouvelle semaine commence.
   Vérifié dans un navigateur (dimanche 8 novembre, sept jours faits). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const N = ' ';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function carte(n, kinds, reposAuj = false) {
  const ctx = vm.createContext({ esc, escAttr: esc, document: { querySelector: () => null }, LQ_FLAME_SVG: '<svg/>', LQ_MOON_SVG: '<svg class="lune"/>',
    streakJours: () => n, streakRecord: () => n, jourRepos: () => reposAuj,
    semaineSerie: () => kinds.map((kind, i) => ({ letter: 'LMMJVSD'[i], today: i === 6, kind })) });
  vm.runInContext('var lqLastStreak=null;' + cut('function homeStreakHTML(', '\nfunction openAccountProgress('), ctx);
  const h = ctx.homeStreakHTML();
  return { texte: /<b>([^]*?)<\/b><small>([^<]*)<\/small>/.exec(h).slice(1).join(' | '), aria: /aria-label="([^"]*)"/.exec(h)[1],
    jours: [...h.matchAll(/<span class="lq-day is-(\w+)/g)].map(m => m[1]).join(' ') };
}

test('toute la semaine faite : « Ta semaine est en feu 🔥 », « 7 jours sur 7, bravo ! »', () => {
  const c = carte(12, Array(7).fill('done'));
  assert.equal(c.texte, `Ta semaine est en feu | 7 jours sur 7, bravo${N}!`, 'le titre remplace « 12 jours de série »');
  assert.ok(c.aria.startsWith(`Ta semaine est en feu. 7 jours sur 7, bravo${N}! Cette semaine : 7 jours faits.`), c.aria);
});

test('les jours de repos ne comptent pas', () => {
  assert.equal(carte(5, ['done', 'done', 'rest', 'done', 'done', 'rest', 'done']).texte, `Ta semaine est en feu | 5 jours sur 5, bravo${N}!`);
  assert.equal(carte(1, ['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'done']).texte, `Ta semaine est en feu | 1 jour sur 1, bravo${N}!`, 'au singulier');
  /* 3 jours par semaine : lundi, mercredi, vendredi faits ; on est dimanche, sans séance */
  const trois = carte(3, ['done', 'rest', 'done', 'rest', 'done', 'rest', 'today'], true);
  assert.equal(trois.texte, `Ta semaine est en feu | 3 jours sur 3, bravo${N}!`);
  assert.equal(trois.jours, 'done rest done rest done rest rest', 'aujourd’hui sans séance : une lune, plus la flamme pointillée');
  assert.equal(carte(2, ['done', 'rest', 'done', 'rest', 'rest', 'rest', 'today'], false).texte, '<span class="lq-count" data-count="2">2</span> jours de série | Une activité aujourd’hui pour prolonger ta série.', 'aujourd’hui a une séance : la semaine n’est pas finie');
});

test('une semaine pas encore finie, ou un jour manqué : la série comme avant', () => {
  assert.equal(carte(6, ['done', 'done', 'done', 'done', 'done', 'done', 'today']).texte, '<span class="lq-count" data-count="6">6</span> jours de série | Une activité aujourd’hui pour prolonger ta série.');
  assert.equal(carte(4, ['missed', 'done', 'done', 'done', 'done', 'rest', 'done']).texte, `<span class="lq-count" data-count="4">4</span> jours de série | Flamme du jour allumée. À demain${N}!`);
  assert.equal(carte(0, ['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest']).texte, `Ta série commence aujourd’hui${N}! | Une activité par jour pour progresser.`, 'une semaine sans rien de fait n’est pas « en feu »');
});
