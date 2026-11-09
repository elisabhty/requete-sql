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

test('le geste de ce qu’on supprime : rougit, se froisse, part, la liste se referme ; en cascade ; rien en mouvement réduit', () => {
  const essai = ({ reduit = false, display = 'flex' } = {}) => {
    const appels = [], timers = [];
    const parent = { display, rowGap: '8px' };
    const carte = (id, avant, bg) => ({ id, bg, offsetHeight: 80, previousElementSibling: avant, parentElement: parent, style: {}, animate: (k, o) => appels.push({ id, k, o }) });
    const ctx = vm.createContext({ prefersReduceMotion: () => reduit, getComputedStyle: e => (e === parent ? parent : { backgroundColor: e.bg }), buzz: k => appels.push({ buzz: k }), setTimeout: (f, ms) => timers.push([f, ms]) });
    vm.runInContext(fn('lqAdieu'), ctx);
    return { ctx, appels, timers, carte };
  };
  const x = essai(), a = x.carte('a', null, 'rgb(255, 251, 235)'), b = x.carte('b', {}, 'rgba(0, 0, 0, 0)');
  let fini = 0;
  x.ctx.lqAdieu([a, null, b], () => fini++, { pas: 45 });
  const an = x.appels.filter(e => e.k);
  assert.deepEqual(an.map(e => e.id), ['a', 'b'], 'les cartes absentes sont ignorées');
  assert.deepEqual(an.map(e => e.o.delay), [0, 45], 'en cascade');
  assert.equal(an[0].k[0].backgroundColor, 'rgb(255, 251, 235)', 'part de sa couleur (une note épinglée, jaune)');
  assert.equal(an[1].k[0].backgroundColor, '#fff', 'transparente : blanc');
  assert.deepEqual([an[0].k[2].marginBottom, an[1].k[2].marginTop], ['-8px', '-8px'], 'l’écart de la liste se referme aussi');
  assert.deepEqual(x.appels.filter(e => e.buzz).map(e => e.buzz), ['medium']);
  assert.equal(x.timers[0][1], 480 + 45);
  x.timers[0][0](); assert.equal(fini, 1);
  const y = essai({ display: 'block' }), c = y.carte('c', {}, '#fff');
  y.ctx.lqAdieu([c], () => {});
  assert.equal(y.appels.find(e => e.k).k[2].marginTop, '0px', 'une liste sans écart (des marges) : rien à refermer en plus');
  const z = essai({ reduit: true }); let f = 0;
  z.ctx.lqAdieu([z.carte('d', null, '#fff')], () => f++);
  assert.equal(f, 1); assert.equal(z.appels.length, 0);
  f = 0; z.ctx.lqAdieu([], () => f++); assert.equal(f, 1, 'rien à animer : tout de suite');
});

test('partout où l’on supprime ou crée : la carte s’en va, la coche dit que c’est fait', () => {
  /* Une note supprimée : la liste revient avec elle, elle s’y froisse, puis « Note supprimée » et « Annuler » */
  const d = fn('deleteNote');
  assert.ok(d.indexOf('notesEnter=false;backToNotesList();') < d.indexOf('setTimeout(()=>lqAdieu([carte],fin),carte?140:0);'));
  assert.ok(d.indexOf('const fin=()=>{') > 0 && d.indexOf("state.notes=(state.notes||[]).filter(x=>x.id!==id);") > d.indexOf('const fin=()=>{'), 'retirée seulement après le geste');
  assert.ok(d.indexOf("toastWithAction('Note supprimée'") > d.indexOf('const fin=()=>{'));
  /* Une note créée ou modifiée : la coche sur sa carte */
  assert.ok(fn('saveNote').includes("if(c)requestAnimationFrame(()=>lqDone(c,wasNew?'Créée':'Enregistrée',dit));else lqSay(dit);"));
  /* Les doublons fusionnés : l’un après l’autre, puis la coche */
  const m = fn('mergeDuplicateNotes');
  assert.ok(m.includes('lqAdieu(r?[...drop].map(id=>r.querySelector(') && m.includes('},{pas:70});') && m.includes("'Doublon fusionné'"));
  /* L’historique effacé : ses lignes, puis la coche « Effacé » sur l’onglet */
  const h = cut('function clearConsoleHistory(){', 'function loadHistSql(');
  assert.ok(h.includes("lqAdieu([...document.querySelectorAll('#console-hist .console-query-row')].slice(0,10),()=>{") && h.includes("lqDone(document.getElementById('console-tab-history')||document.querySelector('#console-hist'),'Effacé','Historique effacé');") && h.includes('},{pas:45});'));
  /* Un projet supprimé : sa ligne, puis la coche « Supprimé » */
  const p = fn('deleteDbNow');
  assert.ok(p.includes("lqAdieu([ligne&&ligne.closest('.console-project-row')],()=>{") && p.includes('deleteDbFin(id);') && p.includes("'Supprimé',`Projet «\\u00a0${meta.name}\\u00a0» supprimé`"));
  assert.ok(fn('deleteDbFin').includes('dbCatalog=dbCatalog.filter(d=>d.id!==id);') && fn('deleteDbFin').includes('renderConsoleScreen();'));
  /* Une table supprimée : la coche « Supprimée » sur le schéma, qui compte une table de moins */
  assert.ok(fn('dropTable').includes("lqDone(document.getElementById('console-schema-summary'),'Supprimée',`Table «\\u00a0${name}\\u00a0» supprimée`);"));
  assert.ok(fn('dbCartesAdieu').includes("lqAdieu(cartes,suite,{gap:parseFloat(getComputedStyle(host).rowGap)||0});"), 'les tables : le même geste');
  /* Sans document (les tests, un autre contexte) : la suppression d’un projet se fait quand même, tout de suite */
  const ctx = vm.createContext({ customDbs: { db_1: { close() {} } }, tableBaselines: {}, dbCatalog: [{ id: 'db_1', name: 'Ventes' }], projState: { db_1: {} }, activeDbId: 'db_1', consoleView: 'work', vus: [] });
  vm.runInContext(fn('lqAdieu') + fn('deleteDbNow') + fn('deleteDbFin') + 'function saveProjState(){} function persistCustomDbs(){} function renderConsoleScreen(){vus.push("rendu")}', ctx);
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
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=272">') && sw.includes("const CACHE = 'requete-2026-11-09-compte-v2734';"));
});
