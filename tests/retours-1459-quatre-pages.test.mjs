/* Elisa, 12 novembre, 14 h 59, quatre captures de l’iPhone : « Tu peux améliorer ces pages ? »
   1. Schéma · base Aéroport, la table reservations allumée : la bulle de ses relations couvrait la moitié du schéma.
   2. Fin de leçon : deux cartes mémo gagnées, toutes les deux marquées « 2 sur 72 ».
   3. Schéma d’une base importée (« pare brise 2027 35 cours 70 exercices 3d », deux tables sans relation) : le titre passait sous
      l’étoile de l’en-tête, et toucher « infos » grisait toute la table « cours ».
   4. « Ton parcours est prêt » : la page réduite à 87 % au-dessus d’une bande vide, la ligne du milieu sans libellé, six barres sans jour. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = lire('index.html'), lud = lire('ludique.css'), obv = lire('onboarding-vitrine.css');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i > 0, `repère : ${a}`); const j = html.indexOf(b, i); assert.ok(j > i, `repère : ${b}`); return html.slice(i, j); };

test('« Ton parcours est prêt » : chaque ligne a son libellé, chaque barre son jour', () => {
  const r = cut('const p=apercuPlan(draft.niveau', 'if(inv)obSetFooter(');
  assert.ok(r.includes('<div><small>Ton objectif</small>') && r.includes('<div><small>Ton niveau, ton rythme</small><b>${nivLabel} · ${obRythmeMinutes(ryt)} min par séance</b></div>') && r.includes('<div><small>Première leçon</small>'), 'trois lignes, trois libellés');
  assert.ok(r.includes("const jourCourt=i=>i?JOURS_C[addJ(d0,i).getDay()]:'Auj.';") && r.includes("const JOURS_C=['dim.','lun.','mar.','mer.','jeu.','ven.','sam.']"), 'le premier jour est aujourd’hui, les autres par leur nom court');
  assert.ok(r.includes('<div class="ob-ready-jours" aria-hidden="true">${week.map((on,i)=>`<span class="${on?\'on\':\'\'}" style="--i:${i}">${jourCourt(i)}</span>`).join(\'\')}</div>'), 'une étiquette sous chaque barre, celles des séances marquées');
  assert.ok(r.includes("sur les ${NB_JOURS_VUS} prochains jours${nWeek?'\\u00a0: '+joursOn.join(', '):''}") && !r.includes('sur les sept prochains jours'), 'lu : « 2 séances sur les 6 prochains jours : aujourd’hui, lundi » (plus « sept »)');
  assert.ok(obv.includes('html #onboarding.ob-vitrine .ob-ready-jours{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:5px}'), 'la même grille que les barres');
  assert.ok(obv.includes('html #onboarding.ob-vitrine .ob-ready-jours span.on{color:var(--v-ink);font-weight:800}'));
  /* Les jours se calculent bien à partir d’aujourd’hui. */
  const ctx = vm.createContext({addJ: (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; }, d0: new Date(2026, 10, 12)});   // jeudi 12 novembre 2026
  vm.runInContext("const JOURS_C=['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];const jourCourt=i=>i?JOURS_C[addJ(d0,i).getDay()]:'Auj.';", ctx);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(i => vm.runInContext(`jourCourt(${i})`, ctx)), ['Auj.', 'ven.', 'sam.', 'dim.', 'lun.', 'mar.']);
});

test('« Ton parcours est prêt » : le pied ne garde plus de place vide, la page reprend sa taille', () => {
  assert.ok(obv.includes('html #onboarding.ob-vitrine[data-ob-slide="ready"] .ob-foot-note:empty{display:none}'), 'pas de ligne réservée pour une note vide');
  const regle = 'html #onboarding.ob-vitrine[data-ob-slide="ready"] .ob-foot:has(#ob-foot-note:empty){padding-bottom:calc(var(--safe-bottom,0px) + max(12px,clamp(20px,3.6vh,32px) - max(0px,var(--safe-bottom,0px) - 34px)))!important}';
  assert.ok(obv.includes(regle), 'sous « Voir mon parcours » : 20 à 32 px, plus la zone sûre');
  assert.ok(obv.indexOf(regle) > obv.indexOf('html #onboarding.ob-vitrine .ob-foot{padding-bottom:calc(var(--safe-bottom,0px) + max(12px,clamp(34px,6.6vh,58px)'), 'après la règle des autres pages, qu’elle remplace ici');
  /* 13 novembre, 9 h 56 : « Commencer » (il mène à l’accueil, plus dans la première leçon) */
  assert.ok(html.includes("else obSetFooter('Commencer',()=>obApresPret('home'),'Voir mon parcours',()=>obApresPret('plan-ready'),"), 'les deux boutons restent');
});

test('schéma : un titre long s’arrête avant l’étoile de l’en-tête, sur deux lignes au plus', () => {
  assert.ok(lud.includes('html.lq .viz-cap-t{flex:1;min-width:0;padding-right:20px}'));
  assert.ok(lud.includes('html.lq .viz-head.viz-cap .viz-cap-t b{display:-webkit-box!important;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}'));
});

test('schéma : une table sans relation ne grise pas les autres ; une base sans relation prend la largeur', () => {
  const app = cut('function umlAppliquer(){', '/* La flèche animée de la bulle');
  assert.ok(app.includes("plan.classList.toggle('is-focus',!!s&&(s.i!=null||on.size>0));"), 'rien à mettre en avant : rien n’est éteint');
  assert.ok(app.includes("b.classList.toggle('is-sel',sel);"), 'sa carte reste cerclée');
  assert.ok(html.includes('Aucune relation&nbsp;: elle ne désigne aucune table, et aucune ne la désigne.'), 'et la bulle le dit');
  assert.ok(cut('function umlPlan(m,W,ex,plies){', 'function umlType(t){').includes('const base=!faisceaux.length?10:W<420?40:64,bg='), 'pas de trait à loger : 10 px de marge au lieu de 40');
});

test('schéma : la bulle des relations ne couvre plus la table allumée ni tout le schéma', () => {
  const d = cut('function umlDefiler(){', 'let schCtx=null;');
  assert.ok(d.includes("hb=bulle&&!bulle.hidden&&bulle.offsetHeight?bulle.offsetHeight+24:150;") && d.includes('vu=Math.max(120,body.clientHeight-96-hb);'), 'la table se place au-dessus de la vraie hauteur de la bulle');
  assert.ok(lud.includes('html.lq #schema-sheet .umd-bc{max-height:min(44vh,340px);overflow:hidden auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}'), 'quatre relations et plus : elle défile à l’intérieur');
  assert.ok(lud.includes('html.lq #schema-sheet .umd-bc>.umd-bx{position:sticky;top:1px;right:auto;z-index:1;flex:none;align-self:flex-end;margin:1px -4px -41px 0}'), 'sa croix reste en haut');
  assert.ok(lud.includes('html.lq #schema-sheet .umd-bulle{position:sticky;bottom:-6px;z-index:3;margin:12px 0 0}'), '12 px au-dessus de la zone sûre');
});

test('schéma : une autre base s’ouvre en haut de sa feuille', () => {
  const r = cut('function renderSchemaSheet(){', 'const schTabSel={}');
  assert.ok(r.includes('const autreBase=body.dataset.base!==key;\n  body.dataset.base=key;') && r.includes('schEnHaut=autreBase;\n  if(autreBase)body.scrollTop=0;'));
  const o = cut('function openSchemaSheet(ctx,vue){', 'function closeSchemaSheet(){');
  assert.ok(o.includes("const enHaut=schEnHaut,corps=document.getElementById('schema-body'); schEnHaut=false;\n  if(enHaut&&corps)corps.scrollTop=0;"), 'une fois la feuille affichée (fermée, elle n’a pas de défilement à régler)');
  assert.ok(o.includes('if(enHaut&&corps)corps.scrollTop=0; });'), 'et après le dessin de la toile');
});

test('fin de leçon : deux cartes gagnées portent « 1 sur 72 » puis « 2 sur 72 »', () => {
  const c = cut('function bravoUnlockCarte(l,e,k,nb){', 'function memoFlip(el,toVerso){');
  assert.ok(c.includes('const rang=Math.max(1,owned-(nb-1-k));') && c.includes('<span class="mc-seal" aria-hidden="true"><b>${rang}</b><small>sur ${TOTAL_CARTES}</small></span>'));
  const rang = (owned, nb, k) => Math.max(1, owned - (nb - 1 - k));
  assert.deepEqual([rang(2, 2, 0), rang(2, 2, 1)], [1, 2], 'la première leçon : 1 puis 2');
  assert.deepEqual([rang(10, 2, 0), rang(10, 2, 1)], [9, 10], 'plus tard : la dernière porte le total');
  assert.equal(rang(5, 1, 0), 5, 'une seule carte : le total, comme avant');
});
