/* 5 novembre, 22 h 19 (Elisa, quatre captures sur l’iPhone : la feuille « Importer une base », « Projet importé », le schéma UML d’un
   classeur de 12 feuilles, la base de démo « Cours ») : « ce n’est pas fluide quand on passe de Nouveau projet à un projet qu’on a déjà
   créé, ça saute » ; « réf. 2 : mettre une micro-interaction en mode validé » ; « réf. 3 : il n’y a que la première table qui est
   dépliée, les autres doivent être pliées » ; « une micro-interaction à la suppression d’une table dans la base (Console) » ;
   « renommer la base : NutriBoost et pas Cours ».
   - Le champ « Nom du nouveau projet » glisse et s’efface au lieu de disparaître d’un coup.
   - « Projet importé » : la coche « Importé » se pose, la coche du compte rendu rebondit, ses tables arrivent une à une.
   - Le schéma UML : à la première visite d’une base, seule la première table est dépliée.
   - Une table supprimée (bouton ou DROP TABLE) : sa carte rougit, se froisse et s’efface, la liste se referme.
   - La base de démo s’appelle NutriBoost. */
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

test('la feuille d’import : passer de « Nouveau projet » à un projet déjà créé ne fait plus sauter la feuille', () => {
  assert.ok(app.includes('<select id="imp-db" onchange="onImportDbChange(true)"></select>'), 'un choix fait dans la liste : animé');
  assert.ok(fn('onImportDbChange').includes("impBasculer(nameField,sel.value==='__new__',anime);"));
  assert.ok(cut('function openImportSheet(){', 'const prev=document.getElementById(\'imp-prev\');').includes('  onImportDbChange();\n'), 'à l’ouverture : d’un coup');
  const essai = ({ anime = true, reduit = false, cache = false, voir = false } = {}) => {
    const anims = [];
    const el = { hidden: cache, style: {}, offsetHeight: 70, animate: (k, o) => { const a = { k, o, cancel() { this.annule = true; } }; anims.push(a); return a; } };
    const ctx = vm.createContext({ prefersReduceMotion: () => reduit, getComputedStyle: () => ({ marginBottom: '12px' }) });
    vm.runInContext(fn('impBasculer'), ctx);
    ctx.impBasculer(el, voir, anime);
    return { el, anims };
  };
  let x = essai();
  assert.equal(x.anims.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(x.anims[0].k)), [{ height: '70px', opacity: 1, marginBottom: '12px', transform: 'none' }, { height: '0px', opacity: 0, marginBottom: '0px', transform: 'translateY(-6px)' }], 'il se referme et s’efface');
  assert.equal(x.anims[0].o.duration, 240);
  assert.equal(x.el.hidden, false, 'caché seulement à la fin');
  assert.equal(x.el.style.animation, 'none', 'sans rejouer l’arrivée de la feuille');
  x.anims[0].onfinish();
  assert.equal(x.el.hidden, true);
  x = essai({ cache: true, voir: true });
  assert.equal(x.el.hidden, false);
  assert.deepEqual(JSON.parse(JSON.stringify(x.anims[0].k))[0].height, '0px', 'il s’ouvre depuis zéro');
  for (const o of [{ anime: false }, { reduit: true }]) {
    x = essai(o);
    assert.equal(x.anims.length, 0); assert.equal(x.el.hidden, true, JSON.stringify(o));
  }
  assert.equal(essai({ cache: true, voir: false }).anims.length, 0, 'déjà caché : rien');
});

test('réf. 2 : « Projet importé » en mode validé', () => {
  const c = cut('async function confirmImport(){', 'function importRetourHtml(');
  assert.ok(c.includes("carte.classList.add('is-valide');") && c.includes("requestAnimationFrame(()=>lqDone(carte,asDb?'Importé':'Importée',asDb?'Projet importé':'Table importée'));"));
  assert.ok(c.includes("carte.querySelectorAll('code').forEach((c,i)=>c.style.setProperty('--i',Math.min(i,14)));"), 'les tables, une à une');
  const i = lq.indexOf('/* ---------- Retours du 5 novembre, 22 h 19 ----------');
  const css = lq.slice(i), m = css.indexOf('@media (prefers-reduced-motion:no-preference){');
  assert.ok(i > 0 && m > 0 && !/animation:lqImp/.test(css.slice(0, m)), 'seulement si le mouvement n’est pas réduit');
  for (const k of ['#console-out .feedback.ok.is-valide .fi{position:relative;animation:lqImpCoche', '#console-out .feedback.ok.is-valide code{animation:lqImpTable .38s ease-out calc(.2s + var(--i,0) * 55ms) backwards}',
    '@keyframes lqImpCoche{', '@keyframes lqImpOnde{', '@keyframes lqImpTable{from{opacity:0;filter:blur(3px)}'])
    assert.ok(css.includes(k), k);
});

test('réf. 3 : le schéma UML, seule la première table dépliée à la première visite d’une base', () => {
  const doc = { base: 'console:db_1' };
  const ctx = vm.createContext({ document: { getElementById: id => (id === 'schema-body' ? { dataset: { base: doc.base } } : null) }, umlOrdre: m => ({ ordre: m.tables.map(t => t.name).reverse() }) });
  vm.runInContext(cut('const umlPlies={};', '/* Un exemple par colonne'), ctx);
  const m = { tables: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] };
  const s = ctx.umlPliesDe(m);
  assert.deepEqual([...s].sort(), ['a', 'b'], 'toutes pliées sauf la première de la toile (c)');
  assert.equal(ctx.umlPliesDe(), s, 'ensuite : ce qu’on a plié ou déplié');
  s.delete('a');
  assert.deepEqual([...ctx.umlPliesDe(m)].sort(), ['b'], 'déplier une table : elle le reste');
  doc.base = 'console:db_2';
  assert.deepEqual([...ctx.umlPliesDe({ tables: [{ name: 'x' }] })], [], 'une seule table : dépliée');
  doc.base = 'console:db_3';
  assert.equal(ctx.umlPliesDe().size, 0, 'sans modèle : rien n’est retenu');
  assert.deepEqual([...ctx.umlPliesDe(m)].sort(), ['a', 'b'], 'puis le premier choix, avec le modèle');
  assert.ok(fn('umlPanneau').includes('umlPlan(m,W,ex,umlPliesDe(m))'));
  const o = cut('function renderSchemaSheet(){', 'const baseOuverte=');
  assert.ok(o.indexOf('body.dataset.base=key;') < o.indexOf("const umlBloc=modele?umlPanneau("), 'la base posée avant de dessiner la toile');
});

test('une table supprimée : sa carte rougit, se froisse et s’efface ; la liste se referme sur elle', async () => {
  const essai = ({ reduit = false, sans = false } = {}) => {
    const appels = [], timers = [];
    const carte = (t, avant) => ({ dataset: { table: t }, offsetHeight: 64, previousElementSibling: avant, style: {}, animate: (k, o) => appels.push(['anime', t, k, o]) });
    const a = carte('clients', null), b = carte('commandes', {});
    const host = { querySelector: s => (s.includes('"clients"') ? a : s.includes('"commandes"') ? b : null) };
    const ctx = vm.createContext({
      document: { getElementById: id => (id === 'db-tables' && !sans ? host : null) }, CSS: { escape: s => s }, prefersReduceMotion: () => reduit,
      getComputedStyle: () => ({ rowGap: '10px' }), buzz: k => appels.push(['buzz', k]), setTimeout: (f, ms) => { timers.push([f, ms]); },
    });
    vm.runInContext(fn('lqAdieu') + fn('dbCartesAdieu'), ctx);   // 22 h 35 : le geste commun (retours-2235)
    return { ctx, appels, timers, a, b };
  };
  let x = essai(), fini = 0;
  x.ctx.dbCartesAdieu(['commandes', 'clients'], () => fini++);
  const an = x.appels.filter(a => a[0] === 'anime');
  assert.deepEqual(an.map(a => a[1]), ['commandes', 'clients']);
  const [, , k, o] = an[0];
  assert.equal(k.length, 3); assert.equal(o.duration, 480); assert.equal(o.fill, 'forwards');
  assert.equal(k[1].backgroundColor, '#FFF1F2', 'elle rougit');
  assert.ok(k[1].transform.includes('rotate(-1.4deg)') && k[2].transform.includes('translateX(-18px)'), 'se froisse, part à gauche');
  assert.deepEqual([k[2].height, k[2].opacity, k[2].marginTop], ['0px', 0, '-10px'], 'la liste se referme, son écart avec');
  assert.equal(an[1][2][2].marginBottom, '-10px', 'la première carte : l’écart du dessous');
  assert.ok(x.b.style.pointerEvents === 'none' && x.b.style.overflow === 'hidden');
  assert.deepEqual(x.appels.find(a => a[0] === 'buzz'), ['buzz', 'medium']);
  assert.equal(fini, 0); assert.equal(x.timers[0][1], 480);
  x.timers[0][0](); assert.equal(fini, 1, 'puis les cartes se redessinent');
  for (const o2 of [{ reduit: true }, { sans: true }]) {
    const y = essai(o2); let f = 0;
    y.ctx.dbCartesAdieu(['clients'], () => f++);
    assert.equal(f, 1, JSON.stringify(o2)); assert.equal(y.appels.length, 0);
  }
  /* Le bouton de la carte : après « Supprimer », avant le DROP ; et un DROP TABLE écrit dans l’éditeur */
  const d = fn('dropTable');
  assert.ok(d.indexOf('await new Promise(r=>dbCartesAdieu([name],r));') > d.indexOf('danger:true}))return;') && d.indexOf('await new Promise(r=>dbCartesAdieu([name],r));') < d.indexOf("activeDb().run('DROP TABLE IF EXISTS '+quoteIdent(name));"));
  const r = cut('const moved=touched();', '}catch(e){');
  assert.ok(r.includes(".filter(n=>!listTables(database).includes(n)):[];") && r.includes('if(partis.length)dbCartesAdieu(partis,()=>{renderDbWorkspace();renderConsoleChips();});'));
  assert.ok(r.includes('if(moved) renderDbWorkspace();'), 'sinon, comme avant');
});

test('la base de démo des cours s’appelle NutriBoost', () => {
  assert.ok(app.includes("let dbCatalog=[{id:'cours',name:'NutriBoost'}];"));
  const ctx = vm.createContext({ dbCatalog: [] });
  vm.runInContext(fn('projectName'), ctx);
  assert.equal(ctx.projectName('cours'), 'NutriBoost');
  assert.ok(!app.includes("name:'Cours'") && !app.includes("return 'Cours';"));
  assert.ok(app.includes("fname.textContent=(activeDbId==='cours'?'nutriboost':isDemoDb(activeDbId)?activeDbId:'projet')+'.sql';"), 'son brouillon : nutriboost.sql');
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=252">') && sw.includes("const CACHE = 'requete-2026-11-08-schema-bouton-v2699';"));
});
