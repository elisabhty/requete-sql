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

test('« Profil et objectif » : « Pseudo », le pseudo et le cadenas — ni « Unique dans l’appli » ni « Il ne se change pas »', () => {
  assert.ok(!app.includes('Unique dans l’appli') && !app.includes('unique dans l’appli'), 'nulle part dans l’appli');
  const ctx = vm.createContext({ PS_LOCK_SVG: '<svg data-k="lock"></svg>', ACCT_CHEV: '<svg data-k="chev"></svg>', esc: v => String(v) });
  vm.runInContext(cut('function jeuNom(v)', '\n') + cut('function jeuInitial(name){', '\n') + cut('function accPseudoHTML(name){', 'function replayOnboarding(){'), ctx);
  const html = vm.runInContext("accPseudoHTML('@elisa')", ctx);
  assert.equal(html, '<div class="acc-pseudo"><span class="acc-pseudo-av" aria-hidden="true">E</span><span class="acc-pseudo-t"><small>Pseudo</small><b>@elisa</b></span><span class="acc-pseudo-lock" aria-label="Pseudo verrouillé" role="img"><svg data-k="lock"></svg></span></div>');
  assert.ok(!html.includes('<em>') && !/se change/.test(html), 'pas de sous-titre');
  /* Ni après la vérification du jour, ni dans la bulle du cadenas des salles */
  assert.ok(app.includes("psPrendre(mien).then(r=>{\n      if(r&&r.ok)return;"));
  assert.ok(!app.includes("document.querySelector('.acc-pseudo em')"));
  assert.ok(app.includes('<span class="jeu-me-lock" aria-label="Pseudo verrouillé" role="img">${PS_LOCK_SVG}</span>'));
  assert.ok(!/title="[^"]*ne se change pas/.test(app));
});

test('la ligne du pseudo s’aligne sur « Personnalisation » et « Revoir l’intro » au lieu de déborder de la feuille', () => {
  for (const part of [
    /* Même hauteur que les autres lignes (66 px), maintenant qu’elle a deux lignes de texte comme elles */
    'html.lq #scr-compte .plus-details-body>.acc-pseudo{width:100%;min-height:66px;margin:0;padding:12px 18px;border:0;border-radius:0;background:#fff}',
    'html.lq #scr-compte .plus-details-body>.acc-pseudo.is-vide{background:#FAF8FF}',
    /* L’avatar a la taille des icônes des lignes (40 px) : son texte tombe sur le leur */
    'html.lq #scr-compte .plus-details-body>.acc-pseudo .acc-pseudo-av{width:40px;height:40px}',
    'html.lq #scr-compte .plus-details-body>.acc-pseudo+.acc-row{border-top:2px solid var(--line-2)}'])
    assert.ok(css.includes(part), part);
  /* Les lignes de la feuille ont la même marge (18 px) et des icônes de 40 px */
  assert.ok(css.includes('html.lq #scr-compte .plus-details-body>.acc-row{min-height:66px;padding:12px 18px!important;'));
  assert.ok(css.includes('html.lq #scr-compte .acc-row-ico{flex:none;width:40px;height:40px;'));
  assert.ok(css.indexOf('/* 52h.') > css.indexOf('html.lq .acc-pseudo{display:flex;'), 'après la règle de base du cadre');
});

test('« Plus tard » sur la mini-page du pseudo tient d’un lancement à l’autre', () => {
  const ns = vm.createContext({});
  vm.runInContext(cut('function jeuNom(v)', '/* Le pseudo des salles et du classement') + cut('function normalizeState(raw){', 'function normalize('), ns);
  assert.equal(vm.runInContext('normalizeState({salle:{psPage:1}}).salle.psPage', ns), 1, 'gardé au rechargement');
  assert.equal(vm.runInContext('normalizeState({salle:{}}).salle.psPage', ns), undefined, 'pas encore proposée : elle s’ouvrira une fois');
  /* psVerifier ne rouvre la mini-page que si elle n’a jamais été proposée */
  assert.ok(app.includes('if(!s.psPage&&!psPageOuverte()){clsSalle().psPage=1;save();psPage({voulu:psAncien()});}'));
});
