/* 16 novembre, 5 h 24 (Elisa, inscrite un dimanche, sa capture à 23 h 59 : « j’ai fait ma flamme mais j’ai pas eu la semaine en feu,
   c’est normal ? Comment ça se calcule ? ») : la semaine en feu demande une flamme chaque jour du lundi au dimanche, sauf les jours de
   repos. Lundi à samedi, d’avant son inscription, comptaient comme ratés : impossible de l’avoir. Elle a dit « ok » à les rendre
   neutres, comme des jours de repos (une flamme pâle, pas une lune : ce n’était pas un repos). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), lq = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const N = String.fromCharCode(160);

function semaine(inscritLe, faits, aujourdhui = '2026-11-15') {
  const pad = n => String(n).padStart(2, '0'), dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ctx = vm.createContext({state: {inscritLe}, Date, Array, String,
    dstr, auj: () => new Date(aujourdhui + 'T12:00:00'), addJ: (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
    lundiDe: d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; },
    debutPlan: () => inscritLe, jourActif: iso => faits.includes(iso), jourRepos: () => false});
  vm.runInContext(cut('function semaineSerie(){', '\nconst LQ_FLAME_SVG=') + cut('function lqFlammeTexte(jours){', '\nfunction lqFlammeOuvrir('), ctx);
  const jours = ctx.semaineSerie();
  return {kinds: jours.map(d => d.kind).join(' '), texte: JSON.parse(JSON.stringify(ctx.lqFlammeTexte(jours)))};
}

test('inscrite un dimanche, sa flamme du dimanche allumée : la semaine est en feu', () => {
  const r = semaine('2026-11-15', ['2026-11-15']);
  assert.equal(r.kinds, 'avant avant avant avant avant avant done');
  assert.deepEqual(r.texte, {titre: 'Ta semaine est en feu', phrase: `1 jour sur 1, bravo${N}!`});
});

test('inscrite un mercredi : mercredi à dimanche faits, 5 sur 5 ; un jour manqué après l’inscription compte toujours', () => {
  const s = ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];
  assert.deepEqual(semaine('2026-11-11', s).texte, {titre: 'Ta semaine est en feu', phrase: `5 jours sur 5, bravo${N}!`});
  const r = semaine('2026-11-11', s.filter(d => d !== '2026-11-12'));
  assert.equal(r.kinds, 'avant avant done missed done done done');
  assert.equal(r.texte.titre, `Ta flamme${N}du${N}jour s’est allumée`);
  /* sans date d’inscription connue : comme avant */
  assert.equal(semaine(null, ['2026-11-15']).kinds, 'missed missed missed missed missed missed done');
});

test('partout où la semaine se compte, et visible : neutre, ni ratée ni à venir', () => {
  assert.ok(cut('function homeStreakHTML(){', '\n}\n').includes("const repos=d=>d.kind==='rest'||d.kind==='avant'||"));
  assert.ok(cut('function lqFlammeTexte(jours){', '\n}\n').includes("const repos=d=>d.kind==='rest'||d.kind==='avant'||"));
  assert.ok(cut('function lqFeuOuvrir(jours){', '\n}\n').includes("<i>${repos&&!avant?LQ_MOON_SVG:LQ_FLAME_SVG}</i>"), 'une flamme pâle, pas une lune');
  for (const r of ['html.lq .lq-day.is-avant i{background:transparent;box-shadow:none}', 'html.lq .lq-flamme-sem .is-avant i{background:transparent;box-shadow:none}',
    'html.lq .lq-feu-arc .is-avant .f-o,html.lq .lq-feu-arc .is-avant .f-i{fill:rgba(255,255,255,.24)}']) assert.ok(lq.includes(r), r);
});
