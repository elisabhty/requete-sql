/* 4 novembre, 14 h 50 (Elisa) : « Avis réels, récoltés par Requête : reformule bien » ; « vrai chiffre, 1000+, car j’ai un site web ».
   La carte des avis de « Ils apprécient Requête » le dit en une ligne, et le chiffre s’affiche sous le titre, en défilant à l’arrivée. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), css = fs.readFileSync(path.join(ROOT, 'onboarding-vitrine.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const bloc = cut('/* ---------- « Ils apprécient Requête » (Elisa, 4 novembre, 14 h 08) ----------', '/* 14 h 08 (réf. 3) : « mettre une flèche animée');

test('« De vrais avis, recueillis par Requête · voix de synthèse » : sous la photo, et pour un lecteur d’écran', () => {
  assert.ok(bloc.includes('<p class="ob-tv-note">De vrais avis, recueillis par Requête · voix de synthèse</p>'));
  assert.ok(!bloc.includes('Avis réels, lus par une voix de synthèse.'), 'l’ancienne ligne est partie');
  assert.ok(bloc.includes('» Un vrai avis, recueilli par Requête et lu par une voix de synthèse.`);'));
});

test('« Plus de 1 000 personnes accompagnées », sous le titre ; le chiffre défile à l’arrivée, sauf en mouvements réduits', () => {
  assert.ok(bloc.includes('const OB_COMMUNAUTE=1000;'));
  assert.ok(bloc.includes('<p class="ob-tv-stat"><b>Plus de <i data-n="${OB_COMMUNAUTE}">${obNombre(OB_COMMUNAUTE)}</i></b> personnes accompagnées</p>'));
  const b = cut('function obTemoinsBrancher(){', "if(typeof document!=='undefined')document.addEventListener('visibilitychange'");
  assert.ok(b.includes("const n=document.querySelector('#ob-body .ob-tv-stat i[data-n]');\n  if(n&&obJustEntered&&!prefersReduceMotion()){"));
  /* Le défilement, joué à la main : de 0 à 1 000, en ralentissant */
  const images = [];
  const n = { dataset: { n: '1000' }, isConnected: true, textContent: '' };
  const ctx = vm.createContext({ document: { querySelector: s => (s === '#ob-body .ob-tv-stat i[data-n]' ? n : null) }, obJustEntered: true, prefersReduceMotion: () => false,
    obNombre: x => String(x), requestAnimationFrame: f => images.push(f) });
  vm.runInContext(b.slice(b.indexOf("  const n=document.querySelector('#ob-body .ob-tv-stat i[data-n]');"), b.indexOf('  /* Les autres photos se chargent à l’avance. */')), ctx);
  assert.equal(n.textContent, '0', 'il part de zéro');
  const suivre = t => { const f = images.shift(); assert.ok(f, 'encore une image'); f(t); return n.textContent; };
  suivre(1000);                       // première image : le départ, 250 ms plus tard
  const milieu = +suivre(1250 + 475);
  assert.ok(milieu > 500 && milieu < 1000, String(milieu));
  assert.equal(suivre(1250 + 950), '1000');
  assert.equal(images.length, 0, 'puis il s’arrête');
  /* En mouvements réduits : le chiffre est là tout de suite */
  const fixe = { dataset: { n: '1000' }, isConnected: true, textContent: '1 000' };
  const c2 = vm.createContext({ document: { querySelector: () => fixe }, obJustEntered: true, prefersReduceMotion: () => true, obNombre: String, requestAnimationFrame() { throw new Error('rien ne défile'); } });
  vm.runInContext(b.slice(b.indexOf("  const n=document.querySelector('#ob-body .ob-tv-stat i[data-n]');"), b.indexOf('  /* Les autres photos se chargent à l’avance. */')), c2);
  assert.equal(fixe.textContent, '1 000');
  assert.ok(css.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine.ob-enter .ob-tv-stat{animation:obvTileIn .4s var(--v-pop) .05s backwards}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-tv-stat i{font-style:normal;font-variant-numeric:tabular-nums}'), 'les chiffres ne dansent pas en défilant');
});
