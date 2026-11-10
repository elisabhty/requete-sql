// Elisa, 10 novembre, 15 h 39 : « Le deuxième parfait » : la semaine en feu devient le feu de camp (piste B de la planche).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const lq = readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };

test('la semaine faite ouvre le feu de camp, pas la page de la flamme du jour', () => {
  const o = cut('function lqFlammeOuvrir(){', '\nfunction lqFlammeFermer(');
  assert.ok(o.includes("if(titre==='Ta semaine est en feu'&&typeof lqFeuOuvrir==='function')return lqFeuOuvrir(jours);"));
  const f = cut('function lqFeuOuvrir(jours){', '\nasync function lqFeuPartager(');
  assert.ok(f.includes("el.id='lq-flamme';el.className='lq-flamme lq-feu'"), 'même fenêtre : Échap, Continuer et le focus marchent pareil');
  assert.ok(f.includes('chat-oui-fixe') && f.includes('LQ_MOON_SVG') && f.includes('Garder le feu allumé'));
});

test('les textes : jours faits sur jours faits, la série, le record', () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(cut('function lqFeuTextes(', '\nfunction lqFeuOuvrir('), ctx);
  const j = k => [...k].map(c => ({ kind: c === 'r' ? 'rest' : 'done' }));
  const a = ctx.lqFeuTextes(j('ddddddd'), 12, 12);
  assert.equal(a.phrase, '7 jours sur 7. Chaque petite flamme a nourri ce feu de camp.');
  assert.equal(a.serie, 'Série : 12 jours'); assert.equal(a.record, 'C’est ton record');
  const b = ctx.lqFeuTextes(j('dddddrr'), 5, 20);
  assert.equal(b.phrase, '5 jours sur 5. Chaque petite flamme a nourri ce feu de camp.'); assert.equal(b.record, '');
  assert.equal(ctx.lqFeuTextes(j('rrrrrrd'), 1, 1).serie, '', 'une série d’un jour : pas de pastille');
});

test('le style : la nuit, les flammes qui tombent dans le foyer, et rien ne bouge en mouvement réduit', () => {
  for (const r of ['@keyframes lqFeuNuit{from{background-color:#5538E6}to{background-color:#16123F}}',
    'html.lq .lq-feu-arc .is-done{animation:lqFeuTombe .55s', '@keyframes lqFeuGrandit{from{transform:scale(.26)}}', 'html.lq .lq-feu-partage{'])
    assert.ok(lq.includes(r), r);
  assert.ok(lq.indexOf('html.lq .lq-feu-arc') > lq.indexOf('@media (prefers-reduced-motion:reduce){html.lq .lq-flamme,html.lq .lq-flamme *{animation:none!important}}'));
});

test('iPhone SE : le code de « Selon le SGBD » ne se coupe plus au milieu des mots', () => {
  assert.ok(lq.includes('@media (max-width:400px){html.lq .sg-row{grid-template-columns:minmax(0,84px) minmax(0,1fr);gap:8px}html.lq .sg-code{font-size:11.5px;padding:5px 8px}}'));
});
