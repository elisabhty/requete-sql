/* Elisa, 31 octobre, 18 h 39, capture de « Profil et objectif » : « fix ».
   Le cadre du pseudo prenait toute la largeur de la feuille (collé aux bords, coins coupés) et disait encore « Unique dans
   l’appli ». En vérifiant la ligne « Choisis ton pseudo », la mini-page revenait à chaque lancement après « Plus tard ». */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('« Profil et objectif » : plus de « Unique dans l’appli », seulement « Il ne se change pas »', () => {
  assert.ok(!app.includes('Unique dans l’appli') && !app.includes('unique dans l’appli'), 'nulle part dans l’appli');
  assert.ok(app.includes("<em>${ok?'Il ne se change pas':'Il sera réservé dès que tu seras en ligne'}</em>"), 'la ligne du pseudo');
  assert.ok(app.includes("if(r&&r.ok){const em=document.querySelector('.acc-pseudo em');if(em)em.textContent='Il ne se change pas';return;}"),
    'le même texte après la vérification du jour');
  assert.ok(app.includes('<span class="jeu-me-lock" title="Ton pseudo ne se change pas" aria-label="Pseudo verrouillé">'), 'le cadenas des salles');
});

test('la ligne du pseudo s’aligne sur « Personnalisation » et « Revoir l’intro » au lieu de déborder de la feuille', () => {
  for (const part of [
    'html.lq #scr-compte .plus-details-body>.acc-pseudo{width:100%;min-height:74px;margin:0;padding:12px 18px;border:0;border-radius:0;background:#fff}',
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
