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
  assert.equal(a.phrase, '7 jours, 7 flammes. Ta régularité fait des étincelles\u00a0!');   // 13 novembre, 15 h 54
  assert.equal(a.serie, 'Série : 12 jours'); assert.equal(a.record, 'C’est ton record');
  const b = ctx.lqFeuTextes(j('dddddrr'), 5, 20);
  assert.equal(b.phrase, '5 jours, 5 flammes. Ta régularité fait des étincelles\u00a0!'); assert.equal(b.record, '');
  assert.equal(ctx.lqFeuTextes(j('rrrrrrd'), 1, 1).phrase, '1 jour, 1 flamme. Ta régularité fait des étincelles\u00a0!', 'au singulier');
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

test('15 h 54 : « 🔥 Ta semaine est en feu ! », et l’embrasement plus waouh', () => {
  const f = cut('function lqFeuOuvrir(jours){', '\nasync function lqFeuPartager(');
  assert.ok(f.includes('<h2 class="lq-flamme-t" id="lq-flamme-t"><span class="lq-feu-emoji" aria-hidden="true">🔥</span> Ta semaine est <em>en feu</em>\\u00a0!</h2>'));
  assert.ok(f.includes('<span class="lq-feu-eclat"></span><span class="lq-feu-onde"></span>${LQ_FEU_SVG}') && f.includes('<span class="lq-feu-gerbe">${gerbe}</span>') && f.includes('<span class="lq-feu-lueur"></span>'));
  assert.ok(f.includes('const gerbe=Array.from({length:24},'), '24 étincelles');
  assert.ok(f.includes("const embrase=fixe?0:Math.round(750+Math.max(1,k)*170+500+270);") && f.includes("buzz('heavy')"), 'le coup au plus fort du feu');
  for (const r of ['html.lq .lq-feu{--t:calc(.75s + var(--n,7) * .17s + .77s)}', '@keyframes lqFeuGerbe{', '@keyframes lqFeuVague{', '@keyframes lqFeuEclat{',
    'html.lq .lq-feu .lq-flamme-t{animation:lqFeuTitre .6s cubic-bezier(.34,1.56,.64,1) calc(var(--t) + .12s) both;'])
    assert.ok(lq.includes(r), r);
  /* Mouvement réduit : les règles de .lq-flamme arrêtent tout ; l’éclair, l’onde et la gerbe restent invisibles */
  assert.ok(lq.indexOf('html.lq .lq-feu-gerbe i{') > lq.indexOf('@media (prefers-reduced-motion:reduce){html.lq .lq-flamme,html.lq .lq-flamme *{animation:none!important}}'));
  assert.ok(/html\.lq \.lq-feu-gerbe i\{[^}]*opacity:0;/.test(lq) && /html\.lq \.lq-feu-onde\{[^}]*opacity:0;/.test(lq) && /html\.lq \.lq-feu-eclat\{[^}]*opacity:0;/.test(lq));
});

test('16 h 02 : « réchauffe Requête » : le chat prend la lumière du feu, une flaque de lumière jusqu’à lui', () => {
  for (const r of ['lqFeuRechauffe .9s ease-out calc(var(--t) + .05s) forwards', 'lqFeuVacille 1.3s ease-in-out calc(var(--t) + .95s) infinite alternate',
    '@keyframes lqFeuRechauffe{from{filter:none}to{filter:sepia(.12) saturate(1.22) brightness(1.1) hue-rotate(6deg)}}',
    'html.lq .lq-feu-scene::before{content:"";', 'html[data-motion="reduce"].lq .lq-feu-chat{filter:sepia(.12) saturate(1.22) brightness(1.1) hue-rotate(6deg)}'])
    assert.ok(lq.includes(r), r);
});
