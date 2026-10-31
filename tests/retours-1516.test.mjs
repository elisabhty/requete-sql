/* Retours d’Elisa, 31 octobre, 15 h 16 (dix captures) : réf. 1 le retour « Questions » trop serré, réf. 2 « Question suivante » selon
   l’onglet, réf. 3 l’export de la progression, réf. 4 des cadres de même largeur et des pastilles de points centrées, réf. 5 le chrono
   sans barre, réf. 6 plus de « Voir la solution », réf. 7 le pas à pas sans étapes dans la DA, réf. 8 le rail des cours de la vitrine,
   réf. 9 les feuilles qui se ferment après l’action. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const s48 = css.slice(css.indexOf('/* ---------- 48. Retours du 31 octobre, 15 h 16'));
const vit = fs.readFileSync(new URL('../decouvrir/index.html', import.meta.url), 'utf8');
const vcss = fs.readFileSync(new URL('../decouvrir/vitrine.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };

test('réf. 1 — le retour « Questions » d’une question ouverte a la même place à droite que les autres retours', () => {
  assert.ok(css.includes('padding:var(--safe-top) 26px 0 16px;background:transparent;border-bottom:0;box-shadow:none;'));
  assert.ok(css.includes('html.lq #app .screen>.home-back{isolation:isolate;padding-right:26px;'), 'les autres retours : 26 px, la pastille à 12 px du bord');
});

test('réf. 2 — « Question suivante » reste dans l’onglet : à revoir, toutes ou maîtrisées', () => {
  const ent = cut('const ENTRETIEN=[', 'const ENTRETIEN_CATS=');
  const fns = ['function entMark(', 'function entOk(', 'function entId(', 'function entNum(', 'function entAllItems(', 'function entInTab(', 'function entNextTarget(', 'function nextEntretien(']
    .map(a => { const i = app.indexOf(a); const j = app.indexOf('\nfunction ', i + 10); return app.slice(i, j); }).join('\n');
  const opened = [];
  const ctx = vm.createContext({ state: { entretien: {} }, opened, renderEntretien() { opened.push('liste'); }, entScrollTop() {}, openEntretienQuestion: id => opened.push(id) });
  vm.runInContext(ent + '\nlet entFilter="all",entStatus="review",entOpen="x";\n' + fns, ctx);
  const ids = vm.runInContext('ENTRETIEN.map((q,i)=>entId(q,i))', ctx);
  const set = (status, ok) => { vm.runInContext(`entStatus=${JSON.stringify(status)};state.entretien=${JSON.stringify(Object.fromEntries(ok.map(id => [id, 'ok'])))}`, ctx); };
  const next = id => { opened.length = 0; vm.runInContext(`nextEntretien(${JSON.stringify(id)})`, ctx); return opened[0]; };
  /* À revoir : la 2e et la 3e sont maîtrisées, on saute à la 4e */
  set('review', [ids[1], ids[2]]);
  assert.equal(next(ids[0]), ids[3], 'à revoir : la suivante encore à revoir');
  /* Toutes : la suivante, maîtrisée ou non */
  set('all', [ids[1], ids[2]]);
  assert.equal(next(ids[0]), ids[1], 'toutes : la suivante dans la liste');
  /* Maîtrisées : la suivante maîtrisée, en repartant du début si besoin */
  set('ok', [ids[1], ids[5]]);
  assert.equal(next(ids[1]), ids[5]);
  assert.equal(next(ids[5]), ids[1], 'on boucle sur les maîtrisées');
  /* Plus aucune autre dans l’onglet : retour à la liste */
  set('ok', [ids[4]]);
  assert.equal(next(ids[4]), 'liste');
  set('review', ids.slice(1));
  assert.equal(next(ids[0]), 'liste', 'la dernière à revoir : retour à la liste');
  assert.ok(app.includes("<span>${entNextTarget(x.id)?'Question suivante':'Retour aux questions'}</span>"), 'le bouton le dit');
});

test('réf. 3 — l’export contient toute la progression, et le même fichier se réimporte', () => {
  const block = cut('const EXPORT_EXTRA=', 'async function exportProgress(){');
  const store = { 'requete-sql-v3': '{}', 'requete-sql-app-version': 'x', 'requete-nav-v1': 'x', 'requete-nav-long-v1': 'x', 'rq-video-reponses': '{"a":1}', 'rq-video-pos': '{"b":2}',
    'requete-sql-proj-v1': '{"cours":{}}', 'requete-sql-dbs-v1': '[]', 'rq-jc-pass-12': '1', 'rq-qf-7': '["a"]', 'requete-rappel': '1', 'rq-recent-search': '[]', 'autre': 'x' };
  const keys = Object.keys(store);
  const ctx = vm.createContext({ LV_ANS_KEY: 'rq-video-reponses', LV_POS_KEY: 'rq-video-pos', PROJ_KEY: 'requete-sql-proj-v1', DBS_KEY: 'requete-sql-dbs-v1', Date, JSON,
    localStorage: { get length() { return keys.length; }, key: i => keys[i], getItem: k => store[k] ?? null },
    state: { lessons: { 1: { done: true } }, defis: { c1: 1 }, notes: [{ id: 'n1' }], plan: { freq: 5 }, entretien: { e1: 'ok' }, salle: { pts: 30, cle: 'K'.repeat(32) } },
    normalizeState: s => JSON.parse(JSON.stringify(s)) });
  vm.runInContext(block + ';var P=progressPayload();', ctx);
  const p = JSON.parse(JSON.stringify(ctx.P));
  assert.equal(p.v, 1); assert.equal(p.app, 'requete-sql');
  assert.deepEqual(Object.keys(p.state).sort(), ['defis', 'entretien', 'lessons', 'notes', 'plan', 'salle'], 'l’état complet de la progression');
  assert.deepEqual(Object.keys(p.extra).sort(), ['requete-rappel', 'requete-sql-dbs-v1', 'requete-sql-proj-v1', 'rq-jc-pass-12', 'rq-qf-7', 'rq-video-pos', 'rq-video-reponses'],
    'vidéos, quiz réussis, requêtes à trous, projets, bases importées, rappel ; pas la navigation ni la version');
  const imp = cut('function importProgress(){', '\nasync function resetAllProgress(){');
  assert.ok(imp.includes("if(!p||p.v!==1||!p.state||typeof p.state!=='object')") && imp.includes("titre:'Remplacer ta progression ?'") && imp.includes('setTimeout(()=>location.reload(),350);'));
  assert.ok(imp.includes('if(EXPORT_EXTRA(k)&&typeof v===\'string\')localStorage.setItem(k,v);'), 'seules les clés connues sont réécrites');
  assert.ok(app.includes('<div class="at"><b>Importer une progression</b><small>Le fichier exporté, depuis un autre appareil</small></div>'));
  assert.ok(app.includes("try{if(sessionStorage.getItem('rq-import-ok')){sessionStorage.removeItem('rq-import-ok');switchTab('compte');"), 'au retour : Mon compte dit que c’est fait');
});

test('réf. 4 — la même marge de 20 px sur toutes les pages, et les pastilles de points centrées sur leur ligne', () => {
  assert.ok(s48.includes('html.lq #app #defis-room,html.lq #app #defis-perf,html.lq #app #defis-join,html.lq #app #defis-rules,'));
  assert.ok(s48.includes('{margin-left:var(--gut,20px)!important;margin-right:var(--gut,20px)!important}'));
  assert.ok(s48.includes('html.lq #app #sgbd-screen-body .sg-wrap{padding-left:var(--gut,20px)!important;padding-right:var(--gut,20px)!important}'));
  assert.ok(s48.includes('html.lq .screen,html.lq .viz-body{scrollbar-gutter:stable both-edges}'), 'au milieu, même avec une barre de défilement');
  assert.ok(s48.includes('html.lq .room-rules li:has(small) span{grid-row:1 / span 2}') && s48.includes('html.lq .room-rules li{grid-template-columns:minmax(0,1fr) auto;align-items:center;'));
});

test('réf. 5 et 6 — pendant une manche : le chrono seul, et pas de « Voir la solution » seul', () => {
  assert.ok(!app.includes('id="jeu-tbar"'), 'plus de barre de temps');
  const bar = cut('function jeuHostBarHTML(){', '\nfunction jeuRedraw(){');
  /* Le bouton de l’hôte, devenu un bouton secondaire de l’appli (retours de 15 h 52, réf. 3 : voir retours-1552.test.mjs). */
  assert.ok(bar.includes("return jeuIsHost()&&!JEU.solo?jeuBtn2('flag','Clore la manche pour tous','jeuClose()'):'';"));
  assert.ok(!bar.includes('Voir la solution'));
});

test('réf. 7 — le pas à pas sans étapes : en-tête violet, autocollant, chemin d’un SELECT, « Compris »', () => {
  const ov = cut('function openViz(taId, rawSql){', 'function vizEmpty(kind,sql){');
  assert.ok(ov.includes("if(!sql||!sel){vizSteps=[];vizEmpty(sql?'action':'vide',sql);return;}"), 'requête vide ≠ requête qui modifie la base');
  assert.ok(ov.includes("if(!vizSteps.length){vizEmpty('complexe',sql);return;}"));
  for (const k of ['.viz-none{', '.viz-none-stk{', '.viz-none-path code{', '@keyframes vizNonePath', '.viz.is-empty .viz-nav .prev{display:none!important}']) assert.ok(s48.includes(k), k);
  /* Une requête WITH … SELECT se décompose aussi */
  const sel = ov.match(/const sel=(\/.+\/i)\.test\(sql\);/)[1];
  const re = eval(sel);
  assert.ok(re.test('WITH t AS (SELECT 1) SELECT * FROM t') && re.test('select * from clients') && !re.test('UPDATE clients SET a=1'));
});

test('réf. 8 — vitrine : la phrase sur toute la largeur, une barre de progression qui suit le défilement', () => {
  assert.ok(vit.includes('<span class="rail-track" aria-hidden="true"><i id="rbar"></i></span>'));
  assert.ok(vit.includes("var demande=function(){if(!raf)raf=requestAnimationFrame(maj);};") && vit.includes("rail.addEventListener('scroll',demande,{passive:true});"));
  assert.ok(vcss.includes('.rail-ctl{display:flex;flex-direction:column;align-items:stretch;gap:16px}'), 'sur téléphone, la phrase au-dessus des flèches');
  assert.ok(vcss.includes('@media (hover:hover){.poster:hover{transform:translateY(-4px) rotate(0)}}'), 'pas de survol collé au doigt sur iPhone');
  const rail = vit.slice(vit.indexOf('<div class="rail" id="rail"'), vit.indexOf('<div class="rail-ctl">'));
  const imgs = rail.match(/<img [^>]+>/g);
  assert.ok(imgs.slice(0, 3).every(t => !t.includes('loading="lazy"')) && imgs.slice(3).every(t => t.includes('loading="lazy"')), 'les trois premières affiches tout de suite');
});

test('réf. 9 — une feuille se ferme une fois l’action faite, et reste au-dessus du clavier', () => {
  assert.ok(app.includes(`onclick="closePlusDetails();startOnboarding('name')"`), 'Personnalisation');
  assert.ok(cut('function replayOnboarding(){', 'startOnboarding();').includes('closePlusDetails();'), 'Revoir l’intro');
  assert.ok(cut('async function resetAllProgress(){', 'state={').includes('closePlusDetails();'), 'Effacer la progression');
  assert.ok(cut('async function exportProgress(){', 'function importProgress(){').includes('closePlusDetails();'), 'Exporter');
  assert.ok(app.includes('<button class="acc-save" type="button" onpointerdown="event.preventDefault()" onclick="saveAccountName()">Enregistrer</button>'), 'le toucher ne déplace pas la feuille');
  assert.ok(app.includes("document.documentElement.style.setProperty('--kb',(kb>60?kb:0)+'px');"));
  assert.ok(s48.includes('html.lq #scr-compte .plus-details[open]{bottom:var(--kb,0px)!important;'));
});
