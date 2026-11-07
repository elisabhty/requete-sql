/* Elisa, 7 novembre, 10 h 30 (son GIF fait avec ChatGPT : le chat craque une allumette et allume une bougie) : « est-ce que tu peux
   intégrer plutôt ce GIF avec une page « Bravo, ta flamme du jour s’est allumée, il en reste 2 à enflammer cette semaine » (DA du
   site internet) ; comme ça on ne met pas d’animation au niveau de la série du haut ».
   - la première activité validée du jour allume la flamme (noteActivityDay) : la page attend l’accueil (elle ne coupe pas une leçon),
     une fois, le jour même ;
   - le violet du site, le chat du GIF détouré (son fond était noir), « Bravo ! » en étiquette soleil, la semaine, ce qui reste, un
     grand bouton jaune ; mouvement réduit : rien ne bouge, le chat est sa dernière image ;
   - la semaine faite : « Ta semaine est en feu » et « 7 jours sur 7, bravo ! », comme la carte.
   Vérifié dans un navigateur (vendredi 6 novembre, du lundi au vendredi faits : « Il en reste 2 »). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const N = String.fromCharCode(160);

test('ce que la page dit : combien de flammes restent, ou la semaine en feu', () => {
  const ctx = vm.createContext({ jourRepos: () => false });
  vm.runInContext(cut('function lqFlammeTexte(jours){', '\nfunction lqFlammeOuvrir('), ctx);
  const t = kinds => JSON.parse(JSON.stringify(ctx.lqFlammeTexte(kinds.map((kind, i) => ({ kind, letter: 'LMMJVSD'[i], today: false })))));
  const flamme = `Ta flamme${N}du${N}jour s’est allumée`;
  assert.deepEqual(t(['done', 'done', 'done', 'done', 'done', 'future', 'future']), { titre: flamme, phrase: 'Il en reste <b>2</b> à enflammer cette semaine.' }, 'la maquette d’Elisa');
  assert.deepEqual(t(['done', 'missed', 'done', 'done', 'done', 'done', 'future']), { titre: flamme, phrase: 'Il en reste <b>1</b> à enflammer cette semaine.' });
  assert.deepEqual(t(Array(7).fill('done')), { titre: 'Ta semaine est en feu', phrase: `7 jours sur 7, bravo${N}!` });
  assert.deepEqual(t(['done', 'rest', 'done', 'rest', 'done', 'rest', 'rest']), { titre: 'Ta semaine est en feu', phrase: `3 jours sur 3, bravo${N}!` }, 'trois séances par semaine');
  assert.deepEqual(t(['missed', 'done', 'done', 'done', 'done', 'done', 'done']), { titre: flamme, phrase: `C’était la dernière de la semaine. Rendez-vous lundi${N}!` }, 'un jour manqué, plus rien à allumer');
});

test('la page attend l’accueil, une fois, le jour même', () => {
  const store = new Map(), timers = [], ouvertes = [];
  let accueil = true;
  const ctx = vm.createContext({
    document: { documentElement: { classList: { contains: c => c === 'lq' } }, querySelector: s => (s === '#scr-learn.active' && accueil ? {} : null), getElementById: () => null },
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    setTimeout: (f, d) => { timers.push([f, d]); return timers.length; }, clearTimeout: () => {},
    auj: () => new Date(2026, 10, 6), dstr: d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` });
  vm.runInContext(cut("const LQ_FLAMME_CLE='rq-flamme-bravo';", '/* Ce que la page dit'), ctx);
  ctx.lqFlammeOuvrir = () => ouvertes.push(1);
  ctx.lqFlammeBravo(); assert.equal(timers.length, 0, 'pas de flamme allumée aujourd’hui : rien');
  ctx.lqFlammeAttendue('2026-11-06');
  accueil = false; ctx.lqFlammeBravo(); timers.pop()[0]();
  assert.equal(ouvertes.length, 0, 'pas sur l’accueil : elle attend'); assert.equal(store.get('rq-flamme-bravo'), '2026-11-06');
  accueil = true; ctx.lqFlammeBravo(); const [f, d] = timers.pop(); assert.equal(d, 700); f();
  assert.equal(ouvertes.length, 1, 'sur l’accueil : la page'); assert.ok(!store.has('rq-flamme-bravo'), 'une seule fois');
  ctx.lqFlammeAttendue('2026-11-05'); ctx.lqFlammeBravo();
  assert.ok(!store.has('rq-flamme-bravo') && ouvertes.length === 1, 'la flamme d’hier : c’est passé');
  assert.ok(app.includes("    if(first&&typeof lqFlammeAttendue==='function')lqFlammeAttendue(iso);"), 'la première activité du jour');
  assert.equal((app.match(/if\(typeof lqFlammeBravo==='function'\)lqFlammeBravo\(\);/g) || []).length, 2, 'à chaque rendu de l’accueil');
});

test('la page : le chat du GIF, « Bravo ! », le titre, la semaine, ce qui reste, « Continuer »', () => {
  const o = cut('function lqFlammeOuvrir(){', '\nfunction lqFlammeFermer(');
  assert.ok(o.includes('<img class="lq-flamme-chat" src="assets/${fixe?\'chat-allumette-fixe\':\'chat-allumette\'}.webp" width="374" height="436" alt="" draggable="false">'), 'le GIF détouré ; fixe en mouvement réduit');
  assert.ok(o.includes("el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');") && o.includes("ok.focus({preventScroll:true})"), 'une vraie fenêtre, le bouton prêt');
  assert.ok(o.includes('<p class="lq-flamme-bravo" aria-hidden="true">Bravo\\u00a0!</p><h2 class="lq-flamme-t" id="lq-flamme-t"><span class="lq-sr">Bravo\\u00a0! </span>${titre}</h2>'));
  assert.ok(o.includes('<button type="button" class="lq-flamme-ok" onclick="lqFlammeFermer()">Continuer</button>') && o.includes("if(e.key==='Escape')"));
  assert.ok(o.includes("lqConfetti({n:40})") && o.includes("buzz('success')"));
  for (const k of ['html.lq .lq-flamme{position:fixed;inset:0;z-index:9985;', 'linear-gradient(170deg,#6E50F6 0%,#5538E6 48%,#4529CC 100%)',
    'html.lq .lq-flamme-bravo{display:inline-block;margin:0 0 12px;padding:7px 15px 6px;border:2.5px solid #fff;border-radius:12px;background:var(--sun);',
    'html.lq .lq-flamme-sem .is-now i{box-shadow:0 0 0 3px var(--sun),', 'html.lq .lq-flamme-d b{color:var(--sun-hi);font-weight:800}',
    'html.lq .lq-flamme-ok{width:100%;min-height:54px;', '@media (prefers-reduced-motion:reduce){html.lq .lq-flamme,html.lq .lq-flamme *{animation:none!important}}',
    'html.lq[data-motion="reduce"] .lq-flamme,html.lq[data-motion="reduce"] .lq-flamme *{animation:none!important}'])
    assert.ok(lq.includes(k), k);
});

test('le chat du GIF : huit images détourées (WebP animé ; 10 h 48 : son deuxième GIF), hors ligne', () => {
  const anim = fs.readFileSync(path.join(ROOT, 'assets/chat-allumette.webp')), fixe = fs.readFileSync(path.join(ROOT, 'assets/chat-allumette-fixe.webp'));
  assert.equal(anim.subarray(0, 4).toString(), 'RIFF'); assert.equal(anim.subarray(8, 12).toString(), 'WEBP');
  assert.ok(anim.includes('ANIM') && anim.includes('ALPH'), 'animé, avec sa transparence');
  let n = 0, i = -1; while ((i = anim.indexOf('ANMF', i + 1)) >= 0) n++;
  assert.equal(n, 8, 'les huit images du GIF');
  /* 10 h 58 : « ralentis un peu » : un tiers de seconde par image, le cœur de la fin tenu 0,9 s */
  const durees = []; let j = 12;
  while (j < anim.length) { const id = anim.subarray(j, j + 4).toString(), taille = anim.readUInt32LE(j + 4); if (id === 'ANMF') durees.push(anim.readUIntLE(j + 8 + 12, 3)); j += 8 + taille + (taille & 1); }
  assert.deepEqual(durees, [340, 340, 340, 380, 340, 340, 360, 900]);
  assert.ok(anim.length < 300000 && fixe.length < 60000, 'léger');
  assert.ok(sw.includes("  './assets/chat-allumette.webp',\n  './assets/chat-allumette-fixe.webp',"));
});
