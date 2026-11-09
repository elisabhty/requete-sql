/* 5 novembre, 21 h 01 (Elisa, capture de « Profil et objectif » dans Mon compte : l’avatar « E » et son cadenas, « Pseudo »,
   « @elisa_sql ») : « Ici mets que le pseudo avec le drapeau, le niveau actuel (comme sur l’accueil) et l’objectif défini dans
   l’onboarding ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const SW = '<svg class="acc-pseudo-sw" viewBox="0 0 300 30" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M4 20C70 8 170 6 296 14"/></svg>';

const carte = (nom, { pays = 'FR', goal = 'interview', niv = { rank: 2, label: 'Constructeur de requêtes' } } = {}) => {
  const ctx = vm.createContext({
    PS_LOCK_SVG: '<svg data-k="lock"></svg>', ACCT_CHEV: '<svg data-k="chev"></svg>',
    state: { profile: { goal, pays } }, paysDuProfil: () => pays, paysNom: c => (c === 'FR' ? 'France' : c), niveauCompte: () => niv,
    obOptionIcon: t => `<span class="ob-answer-icon" data-t="${t}"></span>`,
  });
  vm.runInContext(cut('function esc(s){', '\n') + cut('function escAttr(s){', '\n') + cut('function paysDrapeau(code){', '\n}') + '\n}\n'
    + app.match(/const OB_GOALS=\[[\s\S]*?\];/)[0] + cut('function jeuNom(v)', '\n') + cut('function jeuInitial(name){', '\n')
    + cut('function accPseudoHTML(name){', 'function replayOnboarding(){'), ctx);
  return vm.runInContext(`accPseudoHTML(${JSON.stringify(nom)})`, ctx);
};

test('la carte du pseudo : le drapeau au coin de l’avatar, le pseudo, le niveau, l’objectif', () => {
  assert.equal(carte('@elisa_sql'), '<div class="acc-pseudo" style="--l:10"><span class="acc-pseudo-av"><span aria-hidden="true">E</span>'
    + '<span class="acc-pseudo-flag" role="img" aria-label="France">🇫🇷</span></span><span class="acc-pseudo-t"><b><i class="acc-pseudo-at">@</i><span class="acc-pseudo-nm">elisa_sql' + SW + '</span></b>'
    + '<span class="acc-pseudo-niv" role="img" aria-label="Niveau 2 : Constructeur de requêtes"><i aria-hidden="true"><span>Niv.</span>2</i><span class="acc-pseudo-niv-l" aria-hidden="true">Constructeur de requêtes</span></span>'
    + '<span class="acc-pseudo-obj"><span class="acc-pseudo-obj-ico" aria-hidden="true"><span class="ob-answer-icon" data-t="person"></span></span><span>Mon objectif : <strong>Réussir un entretien</strong></span></span></span></div>');
  const h = carte('@elisa_sql', { goal: 'work' });
  assert.ok(h.includes('data-t="chart"') && h.includes('<strong>Être plus efficace au travail</strong>'), 'l’objectif choisi à l’onboarding, son pictogramme');
  assert.ok(!carte('@elisa_sql', { goal: '' }).includes('acc-pseudo-obj'), 'sans objectif : rien');
  assert.ok(!carte('@elisa_sql', { pays: '' }).includes('acc-pseudo-flag'), 'sans pays : pas de pastille');
  assert.ok(!carte('@elisa_sql', { niv: null }).includes('acc-pseudo-niv'));
  assert.ok(!carte('@elisa_sql').includes('Pseudo verrouillé') && !carte('@elisa_sql').includes('<small>Pseudo</small>'), 'plus de cadenas ni de surtitre « Pseudo »');
  /* Sans pseudo : toujours le bouton pour le choisir */
  assert.ok(carte('').startsWith('<button type="button" class="acc-pseudo is-vide" onclick="closePlusDetails();psPage({})">'));
  /* Les mêmes sources que l’accueil et l’onboarding */
  const f = cut('function accPseudoHTML(name){', 'function replayOnboarding(){');
  assert.ok(f.includes("const niv=typeof niveauCompte==='function'?niveauCompte():null;") && f.includes("OB_GOALS.find(x=>x[0]===g)") && f.includes("paysDrapeau(pays)"));
});

test('le style : la pastille du drapeau, l’étiquette du niveau de la mascotte, l’objectif en clair sur le violet', () => {
  const P = 'html.lq #scr-compte .plus-details-body>.acc-pseudo';
  for (const k of [`${P} .acc-pseudo-flag{position:absolute;right:-12px;bottom:-7px;display:grid;place-items:center;width:30px;height:23px;`,
    `${P} .acc-pseudo-niv>i{position:relative;z-index:1;flex:none;display:inline-flex;align-items:baseline;gap:3px;margin-right:-9px;`,
    'padding:5px 10px;border-radius:999px;background:var(--sun);color:#1B1640;',
    `${P} .acc-pseudo-niv-l{min-width:0;padding:6px 11px 6px 16px;border-radius:10px;background:#1E1A3B;color:var(--mint);`,
    'font:700 12px/1.2 var(--display);box-shadow:0 3px 0 #0F0B2A;text-wrap:balance}',
    `${P} .acc-pseudo-obj strong{color:#fff;font-weight:800}`,
    `${P} .acc-pseudo-obj-ico .ob-answer-icon{display:grid;place-items:center;width:100%;height:100%;border-radius:inherit;background:none;color:#fff}`])
    assert.ok(lq.includes(k), k);
  /* Les couleurs de l’étiquette de la mascotte de l’accueil */
  assert.ok(lq.includes('html.lq .mstk-niv>b{display:block;padding:9px 9px 6px;border-radius:10px;background:#1E1A3B;color:var(--mint);'));
  assert.ok(!lq.includes('acc-pseudo-lock'), 'le cadenas est parti');
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=270">'));
});
