/* Elisa, 31 octobre, 18 h 39, capture de « Profil et objectif » : « fix ».
   Le cadre du pseudo prenait toute la largeur de la feuille (collé aux bords, coins coupés) et disait encore « Unique dans
   l’appli ». En vérifiant la ligne « Choisis ton pseudo », la mini-page revenait à chaque lancement après « Plus tard ».
   18 h 45 : « enlève (il ne se change pas) » — la ligne n’a plus de sous-titre, le cadenas suffit. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('« Profil et objectif » : le pseudo (le cadenas a laissé sa place au drapeau, 5 novembre, 21 h 01) — ni « Unique dans l’appli » ni « Il ne se change pas »', () => {
  assert.ok(!app.includes('Unique dans l’appli') && !app.includes('unique dans l’appli'), 'nulle part dans l’appli');
  const ctx = vm.createContext({ PS_LOCK_SVG: '<svg data-k="lock"></svg>', ACCT_CHEV: '<svg data-k="chev"></svg>', esc: v => String(v) });
  vm.runInContext(cut('function jeuNom(v)', '\n') + cut('function jeuInitial(name){', '\n') + cut('function accPseudoHTML(name){', 'function replayOnboarding(){'), ctx);
  const html = vm.runInContext("accPseudoHTML('@elisa')", ctx);
  /* 1er novembre, 0 h 06 : la carte prend la DA du site (le @ à part pour le colorer, le trait sous le pseudo, le cadenas
     dans la pastille de l’avatar) — le texte reste « Pseudo », le pseudo et le cadenas. */
  assert.equal(html, '<div class="acc-pseudo" style="--l:6"><span class="acc-pseudo-av"><span aria-hidden="true">E</span></span><span class="acc-pseudo-t"><b><i class="acc-pseudo-at">@</i><span class="acc-pseudo-nm">elisa<svg class="acc-pseudo-sw" viewBox="0 0 300 30" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M4 20C70 8 170 6 296 14"/></svg></span></b></span></div>');
  assert.ok(!html.includes('<em>') && !/se change/.test(html) && !/unique/i.test(html), 'pas de sous-titre ni « Unique »');
  /* Ni après la vérification du jour, ni dans la bulle du cadenas des salles */
  assert.ok(app.includes("psPrendre(mien).then(r=>{\n      if(r&&r.ok)return;"));
  assert.ok(!app.includes("document.querySelector('.acc-pseudo em')"));
  assert.ok(app.includes('<span class="jeu-me-lock" aria-label="Pseudo verrouillé" role="img">${PS_LOCK_SVG}</span>'));
  assert.ok(!/title="[^"]*ne se change pas/.test(app));
});

test('le pseudo ne déborde plus de la feuille : même marge (18 px) que « Personnalisation » et « Revoir l’intro »', () => {
  /* 1er novembre, 0 h 06 : la ligne redevient une carte (DA du site), mais toujours posée dans la marge des lignes de la
     feuille, jamais collée aux bords. */
  assert.ok(css.includes('html.lq #scr-compte .plus-details-body>.acc-pseudo{position:relative;isolation:isolate;display:flex;align-items:center;gap:16px;\n  width:calc(100% - 36px);min-height:0;margin:22px 18px 16px;'));
  assert.ok(!css.includes('html.lq #scr-compte .plus-details-body>.acc-pseudo{width:100%;'), 'plus de cadre pleine largeur');
  /* Les lignes de la feuille ont la même marge (18 px) et des icônes de 40 px */
  assert.ok(css.includes('html.lq #scr-compte .plus-details-body>.acc-row{min-height:66px;padding:12px 18px!important;'));
  assert.ok(css.includes('html.lq #scr-compte .acc-row-ico{flex:none;width:40px;height:40px;'));
  assert.ok(css.indexOf('/* 52i.') > css.indexOf('html.lq .acc-pseudo{display:flex;'), 'après la règle de base du cadre');
});

test('« Plus tard » sur la mini-page du pseudo tient d’un lancement à l’autre', () => {
  const ns = vm.createContext({});
  vm.runInContext(cut('function jeuNom(v)', '/* Le pseudo des salles et du classement') + cut('function normalizeState(raw){', 'function normalize('), ns);
  assert.equal(vm.runInContext('normalizeState({salle:{psPage:1}}).salle.psPage', ns), 1, 'gardé au rechargement');
  assert.equal(vm.runInContext('normalizeState({salle:{}}).salle.psPage', ns), undefined, 'pas encore proposée : elle s’ouvrira une fois');
  /* psVerifier ne rouvre la mini-page que si elle n’a jamais été proposée */
  assert.ok(app.includes('if(!s.psPage&&!psPageOuverte()){clsSalle().psPage=1;save();psPage({voulu:psAncien()});}'));
});
