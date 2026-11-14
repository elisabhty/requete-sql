/* 5 novembre, 22 h 35 (Elisa : « pareil quand on supprime des notes, ou crée une note, ou quoi que ce soit : une micro-interaction pour
   être sûr que l’action s’est bien passée » ; puis l’avis demandé sur la carte de Mon compte : « la barre semble remplie à 45 % alors
   que le texte indique 11 % du parcours », « Jointures est un chapitre, Constructeur de requêtes un niveau : bien les distinguer »,
   « Mon objectif », « Retrouve tes progrès, tes objectifs et tes préférences »).
   - Le geste commun de ce qu’on supprime (lqAdieu) : une note, des doublons, une ligne de l’historique, un projet, une table ; et la
     coche de ce qu’on crée (lqDone) : une note créée ou modifiée, l’historique effacé, un projet ou une table supprimés.
   - La carte : « Ma progression » et la barre du parcours, au même chiffre ; le chapitre en cours (ou le prochain), qui s’ouvre ; le
     niveau suivant sous le badge, en leçons ; « Mon objectif ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html');
const lq = read('ludique.css');
const sw = read('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => { const i = app.indexOf(`function ${name}(`); assert.ok(i >= 0, name); const j = app.indexOf('\n}\n', i); return app.slice(i, j + 3); };
const compte = cut('function renderCompte(){', '\nfunction ');

test('le geste de ce qu’on supprime : depuis le 11 novembre (21 h 33), la poubelle partout (lqCorbeille, retours-2111-poubelle)', () => {
  assert.ok(!app.includes('function lqAdieu(') && app.includes('function lqCorbeille(cartes,suite,o){'));
});

test('partout où l’on supprime ou crée : la carte s’en va, la coche dit que c’est fait', () => {
  /* Une note supprimée : la liste revient avec elle, et elle part à la poubelle (11 novembre : lqCorbeille, plus de toast) */
  const d = fn('deleteNote');
  assert.ok(d.indexOf('notesEnter=false;backToNotesList();') < d.indexOf('setTimeout(()=>lqCorbeille(carte,fin,{son}),carte?120:0);'));
  assert.ok(d.indexOf('const fin=()=>{') > 0 && d.indexOf("state.notes=(state.notes||[]).filter(x=>x.id!==id);") > d.indexOf('const fin=()=>{'), 'retirée seulement après le geste');
  assert.ok(!d.includes("toastWithAction('Note supprimée'"));
  /* Une note créée ou modifiée : la coche sur sa carte */
  assert.ok(fn('saveNote').includes("if(c)requestAnimationFrame(()=>lqDone(c,wasNew?'Créée':'Enregistrée',dit));else lqSay(dit);"));
  /* Les doublons fusionnés : à la poubelle, l’un après l’autre ; le lecteur d’écran dit combien */
  const m = fn('mergeDuplicateNotes');
  assert.ok(m.includes('lqCorbeille(r?[...drop].map(id=>r.querySelector(') && m.includes('},{pas:70});') && m.includes("'Doublon fusionné'") && !m.includes('lqDone('));
  /* L’historique effacé : ses lignes à la poubelle ; un projet supprimé : sa ligne ; plus de coche ensuite (le lecteur d’écran le dit) */
  const h = cut('function clearConsoleHistory(){', 'function loadHistSql(');
  assert.ok(h.includes("lqCorbeille([...document.querySelectorAll('#console-hist .console-query-row')].slice(0,10),()=>{") && h.includes("lqSay('Historique effacé');") && !h.includes('lqDone('));
  const p = fn('deleteDbNow');
  assert.ok(p.includes("lqCorbeille([ligne&&ligne.closest('.console-project-row')],()=>{") && p.includes('deleteDbFin(id);') && p.includes("lqSay(`Projet «\\u00a0${meta.name}\\u00a0» supprimé`)"));
  assert.ok(fn('deleteDbFin').includes('dbCatalog=dbCatalog.filter(d=>d.id!==id);') && fn('deleteDbFin').includes('renderConsoleScreen();'));
  /* Une table supprimée : sa carte à la poubelle ; le lecteur d’écran le dit */
  assert.ok(fn('dropTable').includes("lqSay(`Table «\\u00a0${name}\\u00a0» supprimée`);"));
  assert.ok(fn('dbCartesAdieu').includes("lqCorbeille(cartes,suite,{gap:parseFloat(getComputedStyle(host).rowGap)||0});"), 'les tables : le même geste');
  /* Sans document (les tests, un autre contexte) : la suppression d’un projet se fait quand même, tout de suite */
  const ctx = vm.createContext({ customDbs: { db_1: { close() {} } }, tableBaselines: {}, dbCatalog: [{ id: 'db_1', name: 'Ventes' }], projState: { db_1: {} }, activeDbId: 'db_1', consoleView: 'work', vus: [] });
  vm.runInContext(fn('lqCorbeille') + fn('deleteDbNow') + fn('deleteDbFin') + 'function saveProjState(){} function persistCustomDbs(){} function renderConsoleScreen(){vus.push("rendu")}', ctx);
  vm.runInContext("deleteDbNow('db_1')", ctx);
  assert.equal(vm.runInContext('dbCatalog.length+"|"+activeDbId+"|"+consoleView+"|"+vus.join()', ctx), '0|cours|list|rendu');
});

test('la carte de Mon compte : la barre au chiffre du parcours, le module qui suit ; plus de niveau suivant (6 novembre, 6 h 10)', () => {
  /* 6 novembre, audit de la carte : le chiffre et la barre sont ceux du parcours entier, la barre leçon par leçon (retours-1013-compte) */
  /* 11 h 12, direction C : « Ton parcours » dans sa tuile, à côté de « Ton niveau » ; 12 h 28, plus d’acquis au départ sur la barre (retours-1013-compte) */
  assert.ok(compte.includes('<small>Ton parcours</small><span class="acct-t-l"><b class="acct-t-n">${parc.pct}<i>\\u00a0%</i></b></span>'));
  assert.ok(compte.includes('${acctParcoursHTML(chap&&chap.cur)}'), 'la barre : le même chiffre');
  assert.ok(!compte.includes('Prochain cap') && !compte.includes('width:${level.pct}%'), 'plus la barre du palier sous le chiffre du parcours');
  assert.ok(compte.includes('${acctModuleHTML(chap)}') && app.includes('<button type="button" class="acct-chap" onclick="ouvrirChapitre(${c.mi})"'));
  /* 6 novembre, 6 h 10 (Elisa : « enlève niveau 3 dans 8 leçons dans compte ») : le niveau suivant n’est plus affiché (retours-0610) */
  assert.ok(!compte.includes('lvlSuite') && !compte.includes('acct-niv-suite') && !lq.includes('.acct-niv-suite'));
  assert.ok(app.includes('<p class="sub">Tes progrès, ton objectif et tes réglages.</p>'));
  assert.ok(compte.includes('<span>Mon objectif\\u00a0: <strong>${esc(profileGoal)}</strong></span>') && app.includes('<span>Mon objectif\\u00a0: <strong>${esc(o[1])}</strong></span>'));
  /* Le niveau suivant, en leçons */
  const lv = vm.createContext({});
  vm.runInContext(cut('const ACCOUNT_LEVELS=[', 'const ACCT_OK_SVG='), lv);
  const reste = n => lv.accountLevel(n, [11, 23, 33], 65).reste;
  assert.deepEqual([reste(0), reste(10), reste(11), reste(30), reste(64), reste(65)], [11, 1, 12, 3, 1, 0]);
  /* Le module : celui de l’accueil (retours-1013-compte) */
  /* Il s’ouvre : le catalogue, ce chapitre déplié et allumé */
  const vus = [], el = { tagName: 'DETAILS', open: false, scrollIntoView: o => vus.push(['vue', o.block]) };
  const ctx = vm.createContext({ openCourseCatalog: () => vus.push(['catalogue']), requestAnimationFrame: f => f(), prefersReduceMotion: () => false, lqFresh: e => vus.push(['allume', e === el]),
    document: { querySelector: s => (s === '#modules>.home-module[data-module-index="2"]' ? el : null) } });
  vm.runInContext(fn('ouvrirChapitre'), ctx);
  ctx.ouvrirChapitre(2);
  assert.deepEqual(vus, [['catalogue'], ['vue', 'center'], ['allume', true]]);
  assert.equal(el.open, true);
  /* Le style */
  for (const k of ['html.lq .acct-hero .acct-chap{display:flex;align-items:center;gap:12px;width:100%;', 'html.lq .acct-hero .acct-chap-go{flex:none;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--sun);',
    'html.lq .acct-hero .acct-level-head em{font:800 19px/1 var(--display);color:var(--sun-hi)}'])
    assert.ok(lq.includes(k), k);
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=363">') && sw.includes("const CACHE = 'requete-2026-11-14-fleche-v2992';"));
});
