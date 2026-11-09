/* Elisa, 5 novembre, 7 h 03 (capture du schéma de la base Zoo) : « Comment on peut générer un schéma UML pour tous ? Comment
   l’intégrer partout, générer automatiquement quand on met des données ? De manière UI/UX, DA du site internet. Au niveau de la
   console ou défis ? Peut-être faire une première pill en jaune ? »
   La feuille Schéma s’ouvre sur une première pastille jaune, « Schéma UML » : une carte par table, ses liens d’une clé étrangère à
   la clé primaire qu’elle désigne, avec leurs multiplicités (1, 0..1, 0..*), lus dans la base elle-même (clés déclarées ou devinées
   à leur nom). Partout : cours, défis, salle de défis, Console (sa pastille jaune, et après l’import d’un projet). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

const initSqlJs = createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'));
const SQL = await initSqlJs({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
const ctx = vm.createContext({SCHEMA_META: [], esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  escAttr: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  plur: (n, mot, pl) => n + ' ' + (Math.abs(n) > 1 ? (pl || mot + 's') : mot)});
vm.runInContext(cut('function quoteIdent(name){', '\n') + '\n' + cut('function tableRowCount(database,name){', '\n}\n') + '\n}\n'
  + cut('function guessFkTarget(col,tables){', 'function courseTableNames(){')
  + cut('const UML_TEINTES=', '/* La largeur de la toile avant que la feuille soit ouverte')
  + ';this.umlModele=umlModele;this.umlPlan=umlPlan;this.umlHtml=umlHtml;this.umlPanneau=umlPanneau;this.umlType=umlType;', ctx);
vm.runInContext(cut('const DEFI_BASES={', '\nconst ').replace('const DEFI_BASES=', 'DEFI_BASES='), ctx);
const tablesDe = d => d.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0].values.map(v => v[0]);
const ouvrir = sql => { const d = new SQL.Database(); d.run(sql); return d; };
const pur = x => JSON.parse(JSON.stringify(x));   // les tableaux du contexte vm, en tableaux d’ici

/* Une mise en page lisible : les cartes ne se touchent pas, tout tient dans la toile, une table vient après celles qu’elle
   désigne, chaque lien a son trait et ses deux multiplicités, et deux pastilles d’un même côté ne se chevauchent pas. */
function verifier(m, p, nom) {
  assert.equal(p.cartes.length, m.tables.length, nom + ' : une carte par table');
  assert.equal(p.arcs.length, m.liens.length, nom + ' : un trait par lien');
  const parY = [...p.cartes].sort((a, b) => a.y - b.y);
  for (let k = 1; k < parY.length; k++) assert.ok(parY[k].y >= parY[k - 1].y + parY[k - 1].h + 10, `${nom} : ${parY[k].name} sous ${parY[k - 1].name}, sans la toucher`);
  for (const c of p.cartes) assert.ok(c.x >= 0 && c.x + c.w <= p.W && c.y + c.h <= p.H, `${nom} : ${c.name} dans la toile`);
  const carte = Object.fromEntries(p.cartes.map(c => [c.name, c]));
  for (const a of p.arcs) {
    assert.ok(a.xl >= 2 && a.xl <= p.W - 2, `${nom} : ${a.de} → ${a.vers}, son couloir dans la toile`);
    assert.ok(a.xl < carte[a.de].x || a.xl > carte[a.de].x + carte[a.de].w, `${nom} : ${a.de} → ${a.vers}, son couloir hors des cartes`);
    if (a.de !== a.vers) assert.ok(carte[a.vers].y < carte[a.de].y, `${nom} : ${a.vers} avant ${a.de}`);
    assert.equal(a.lab.length, 2);
    for (const t of a.lab) assert.ok(t.x >= 0 && t.x + t.w <= p.W, `${nom} : la multiplicité ${t.t} dans la toile`);
  }
  for (const cote of ['g', 'd']) {
    const ps = p.arcs.filter(a => a.cote === cote).flatMap(a => a.lab).sort((a, b) => a.y - b.y);
    for (let k = 1; k < ps.length; k++) assert.ok(ps[k].y >= ps[k - 1].y + ps[k - 1].h - 0.5 || Math.abs(ps[k].y - ps[k - 1].y) < 0.01 && ps[k].t === ps[k - 1].t,
      `${nom} : deux multiplicités ne se chevauchent pas (${cote}, ${ps[k - 1].t} à ${ps[k - 1].y}, ${ps[k].t} à ${ps[k].y})`);
  }
}

test('chaque base des défis : ses liens, et un schéma lisible sur l’iPhone comme sur l’ordinateur', () => {
  const attendus = {aeroport: 8, hopital: 8, wok: 10, zoo: 8, fromagerie: 9, labo: 9, voyages: 8, salle_sport: 6};
  for (const [id, b] of Object.entries(ctx.DEFI_BASES)) {
    const d = ouvrir(b.sql), tables = tablesDe(d), m = ctx.umlModele(d, tables);
    if (attendus[id] != null) assert.equal(m.liens.length, attendus[id], id + ' : ses clés étrangères');
    for (const W of [322, 622]) verifier(m, ctx.umlPlan(m, W), `${id} (${W} px)`);
    d.close();
  }
});

test('le zoo : les tables près de celles qu’elles désignent, et les multiplicités de chaque clé', () => {
  const d = ouvrir(ctx.DEFI_BASES.zoo.sql), m = ctx.umlModele(d, tablesDe(d)), p = ctx.umlPlan(m, 322);
  assert.deepEqual(pur(p.cartes.map(c => c.name)), ['enclos', 'soigneurs', 'affectations_soigneurs', 'especes', 'animaux', 'repas', 'visiteurs', 'avis', 'billets']);
  const nn = (t, c) => !!d.exec(`PRAGMA table_info("${t}")`)[0].values.find(v => v[1] === c)[3];
  for (const l of m.liens) {
    assert.equal(l.un, nn(l.de, l.col) ? '1' : '0..1', `${l.de}.${l.col} : 1 si la clé ne peut pas être vide`);
    assert.equal(l.plusieurs, '0..*');
  }
  d.close();
});

test('des données importées sans clé déclarée : les liens devinés au nom des colonnes, les tables seules en dernier', () => {
  const d = ouvrir(`CREATE TABLE clients(id INTEGER PRIMARY KEY, nom TEXT);
    CREATE TABLE notes(texte TEXT);
    CREATE TABLE commandes(id INTEGER PRIMARY KEY, client_id INTEGER, produit_id INTEGER NOT NULL, total REAL);
    CREATE TABLE produits(id INTEGER PRIMARY KEY, nom TEXT);
    INSERT INTO clients VALUES (1,'Ana'),(2,'Léo');`);
  const m = ctx.umlModele(d, tablesDe(d));
  assert.deepEqual(pur(m.liens.map(l => [l.de, l.col, l.vers, l.un, l.plusieurs])),
    [['commandes', 'client_id', 'clients', '0..1', '0..*'], ['commandes', 'produit_id', 'produits', '1', '0..*']]);
  const p = ctx.umlPlan(m, 322);
  verifier(m, p, 'import');
  assert.equal(p.cartes.at(-1).name, 'notes', 'sans lien : en dernier');
  assert.equal(p.cartes.find(c => c.name === 'clients').n, 2, 'ses lignes');
  d.close();
});

test('une clé unique : 0..1 des deux côtés ; une table de douze colonnes : ses clés gardées, « +6 colonnes »', () => {
  const d = ouvrir(`CREATE TABLE clients(id INTEGER PRIMARY KEY, a TEXT, b TEXT, c TEXT, e TEXT, f TEXT, g TEXT, h TEXT, i TEXT, j TEXT,
      ville_id INTEGER REFERENCES villes(id), pays_id INTEGER NOT NULL REFERENCES pays(id));
    CREATE TABLE villes(id INTEGER PRIMARY KEY, nom TEXT);
    CREATE TABLE pays(id INTEGER PRIMARY KEY, nom TEXT);
    CREATE TABLE cartes(id INTEGER PRIMARY KEY, client_id INTEGER UNIQUE REFERENCES clients(id), points INTEGER);`);
  const m = ctx.umlModele(d, tablesDe(d)), p = ctx.umlPlan(m, 322);
  assert.deepEqual(pur(m.liens.find(l => l.de === 'cartes')), {de: 'cartes', col: 'client_id', vers: 'clients', versCol: 'id', un: '0..1', plusieurs: '0..1'});
  /* 6 novembre, 7 h 52 (« efface les Voir ») : dépliée, la table montre ses douze colonnes ; pliée, ses clés et « +9 colonnes », qui la
     déplie. */
  const c = p.cartes.find(x => x.name === 'clients');
  assert.equal(c.cols.length, 12);
  assert.equal(c.plus, 0);
  verifier(m, p, 'douze colonnes');
  const pl = ctx.umlPlan(m, 322, false, new Set(['clients'])), cp = pl.cartes.find(x => x.name === 'clients');
  assert.deepEqual(pur(cp.cols.filter(x => !cp.caches.includes(x.c)).map(x => x.c)), ['id', 'ville_id', 'pays_id'], 'pliée : les clés restent sur la carte');
  assert.equal(cp.plus, 9);
  assert.ok(ctx.umlHtml(pl).includes('aria-label="Déplier la table clients : ses 12 colonnes" onclick="umlPlier(this,event)"><span>+9 colonnes</span></button>'));
  assert.equal(ctx.umlType('VARCHAR(255)'), 'VARCHAR');
  d.close();
});

test('un cycle de clés, une table qui se désigne elle-même : le schéma se dessine quand même', () => {
  const d = ouvrir(`CREATE TABLE a(id INTEGER PRIMARY KEY, b_id INTEGER REFERENCES b(id));
    CREATE TABLE b(id INTEGER PRIMARY KEY, a_id INTEGER REFERENCES a(id));
    CREATE TABLE employes(id INTEGER PRIMARY KEY, chef_id INTEGER REFERENCES employes(id));`);
  const m = ctx.umlModele(d, tablesDe(d)), p = ctx.umlPlan(m, 322);
  assert.equal(p.cartes.length, 3);
  assert.equal(p.arcs.length, 3);
  const auto = p.arcs.find(a => a.de === 'employes');
  assert.equal(auto.cote, 'd', 'la boucle sur le côté droit de sa carte');
  d.close();
});

test('la toile : une carte par table (7 h 38 : touchée, elle allume ses liens), un trait par lien, ses pastilles, ses liens en clair', () => {
  const d = ouvrir(ctx.DEFI_BASES.zoo.sql), m = ctx.umlModele(d, tablesDe(d)), h = ctx.umlPanneau(m, 322, true);
  /* 9 h 18 : la carte est un bloc (son en-tête et sa flèche « plier » sont deux boutons) */
  assert.equal((h.match(/<div class="umd-t[ "]/g) || []).length, 9);
  assert.equal((h.match(/<path class="umd-a"/g) || []).length, 8);
  /* Deux multiplicités par lien ; celles d’un faisceau (8 h 13 : des liens vers une même colonne, avec la même multiplicité) n’en font qu’une */
  const pp = ctx.umlPlan(m, 322, true), uniques = new Set(pp.arcs.flatMap(a => a.lab.map(t => t.x + '|' + t.y + '|' + t.t))).size;
  assert.equal((h.match(/<g class="umd-m"/g) || []).length, uniques, 'deux multiplicités par lien, une par bout de faisceau');
  assert.ok(uniques > 8 && uniques <= 16);
  assert.ok(h.includes('onclick="umlCarte(this,event)"') && h.includes('<button type="button" class="umd-hb" aria-pressed="false"') && h.includes('aria-label="Table animaux, 8 colonnes, 35 lignes : allumer ses relations"'));
  assert.ok(h.includes('<div class="umd-tete"><b>Schéma UML</b><span>9 tables · 8 relations</span></div>'));
  assert.ok(h.includes('<span class="umd-lg is-pk"><i>PK</i>clé primaire</span><span class="umd-lg is-fk"><i>FK</i>clé étrangère</span><span class="umd-lg is-v"><b>→</b>la table qu’elle désigne</span><span class="umd-lg"><b>0..*</b>zéro ou plusieurs</span>'));
  /* Ce que montrent les traits, en clair (pour les lecteurs d’écran aussi) : la liste pliable, une entrée par lien */
  assert.ok(h.includes('<code>animaux.espece_id</code><span class="umd-fl" aria-hidden="true">→</span><span class="sr">désigne</span><code>especes.id</code>'));
  assert.ok(h.includes('Chaque ligne d’<code>animaux</code> désigne exactement une ligne d’<code>especes</code>.'));
  assert.ok(h.includes('<div class="sch-uml" role="tabpanel" data-t="__uml__">') && ctx.umlPanneau(m, 322, false).includes('data-t="__uml__" hidden>'));
  d.close();
});

test('la feuille : la pastille jaune en premier, ouverte d’abord ; « Ses colonnes » ouvre sa table ; la Console a son schéma', () => {
  const r = cut('function renderSchemaSheet(){', 'const schTabSel={},schBaseOuverte={};');
  for (const k of ["const cons=schCtx==='console';", 'const database=cons?activeDb():dId?new SQL.Database(defiBaseBytes(dId)):db;',
    "const key=cons?'console:'+activeDbId:(dId||'cours');", "let cur=schTabSel[key];if(!tables.includes(cur)&&!(avecUml&&cur==='__uml__'))cur=avecUml?'__uml__':tables[0];",
    'class="sch-tab is-uml${cur===\'__uml__\'?\' on\':\'\'}" aria-selected="${cur===\'__uml__\'}" data-t="__uml__" onclick="schemaPickTab(this)">${UML_SVG}Schéma UML</button>',
    '<div class="sch-tabs" role="tablist" aria-label="Tables de la base">${umlPill}${tables.map(', 'body.innerHTML=baseCarte+tabs+umlBloc+(tables.map(',
    "}finally{if(dId)database.close();}"])
    assert.ok(r.includes(k), k);
  const pick = cut('function schemaPickTab(btn){', '\n}\n');
  assert.ok(pick.includes("body.querySelectorAll('.sch-table,.sch-uml').forEach(p=>{p.hidden=p.dataset.t!==t;});") && pick.includes("if(t==='__uml__')umlAjuster();"));
  const open = cut('function openSchemaSheet(ctx,vue){', 'function closeSchemaSheet(){');
  assert.ok(open.includes("schCtx=ctx==='console'?'console':null;") && open.includes('requestAnimationFrame(()=>{ umlAjuster();'));
  assert.ok(open.includes("`Schéma · ${projectName(activeDbId)}`"), 'le nom du projet de la Console');
  /* La Console : la pastille jaune dès deux tables, et après l’import d’un projet */
  const ws = cut('function renderDbWorkspace(){', '\n}\n');
  /* 8 h 13 : la pastille ouvre le schéma UML, pas le dernier onglet de table ; le compte rendu de l’import propose de le voir */
  assert.ok(ws.includes(`const uml=tables.length>1?\`<button type="button" class="db-pill is-uml" onclick="openSchemaSheet('console','__uml__')">\${UML_SVG}<span>Schéma UML</span>`));
  /* 15 h 01 : « Schéma UML » plutôt que « Voir le schéma UML », comme la pastille jaune */
  assert.ok(cut('function importRetourHtml(database,tabs,tn,asDb,ajoutees,infos){', '\n}\n').includes(`<button type="button" class="imp-uml" onclick="openSchemaSheet('console','__uml__')">\${UML_SVG}<span>Schéma UML</span></button>`));
  /* Partout où le schéma s’ouvre déjà : la leçon, le défi, la salle de défis */
  for (const k of ['id="nav-schema" onclick="openSchemaSheet()"', 'class="dq-lien" onclick="openSchemaSheet()"', 'class="ed-schema${schAttn()}" onclick="openSchemaSheet()"']) assert.ok(app.includes(k), k);
  assert.ok(cut('function umlSurligne(el,on,e){', '\n}\n').includes("e.pointerType!=='mouse'"), 'au doigt, rien au survol : la toucher allume ses liens');
});

test('la DA : la pastille jaune soleil, la toile quadrillée, les classes aux couleurs du cours UML, les multiplicités en pastilles', () => {
  for (const k of ['html.lq #schema-sheet .sch-tab.is-uml{display:inline-flex;align-items:center;gap:7px;border-color:#FFD86B;background:#FFF4CF;',
    'html.lq #schema-sheet .sch-tab.is-uml.on{border-color:var(--sun);background:var(--sun);color:#1B1640;box-shadow:0 3px 0 var(--sun-lip)}',
    'background-image:linear-gradient(rgba(106,77,244,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(106,77,244,.07) 1px,transparent 1px);background-size:22px 22px;',
    'html.lq #schema-sheet .umd-h{flex:none;display:flex;align-items:center;gap:6px;height:34px;', 'html.lq #schema-sheet .umd-c{display:flex;flex-direction:column;flex:none;height:20px;',
    'html.lq #schema-sheet .umd-r{display:flex;align-items:center;gap:6px;flex:none;height:20px;',
    'html.lq #schema-sheet .umd-cs{display:flex;flex-direction:column;padding:7px 0}', 'html.lq #schema-sheet .umd-m rect{fill:#fff;stroke:var(--lc,var(--line));stroke-width:1.5px;',
    'html.lq #schema-sheet .umd-c i.is-pk{background:var(--sun);color:#1B1640}', 'html.lq #schema-sheet .umd-c i.is-fk{background:var(--mint);color:#0D5B3B}',
    'html.lq #scr-console .console-schema-panel .db-pill.is-uml{flex:1 1 100%;', 'html[data-motion="reduce"].lq #schema-sheet :is(.umd-t,.umd-a,.umd-m,.umd-x,.umd-bc,.umd-f,.umd-ar-l,.umd-ar-p){animation:none!important}'])
    assert.ok(css.includes(k), k);
  /* Les mesures de la page et du dessin sont les mêmes : en-tête 34 px, lignes de 20 px, 7 px autour */
  assert.ok(app.includes('const UML_G={tete:34,pad:7,ligne:20,ligneEx:40,haut:2,ecart:20,voie0:14,voie:8};'));
  assert.ok(!/\.uml-(?:t|h|cs|toile|plan)\b/.test(css), 'les classes umd- : celles du guide (.uml-c, .uml-l…) restent à lui');
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=262">'));
});
