/* Elisa, 5 novembre, 15 h 01 (neuf captures) :
   - « Si l’utilisateur doit passer bien sûr par l’onboarding depuis le début » : invité, on voit aussi la vidéo d’intro.
   - « Quand on appuie sur Select, ça nous emmène vers le moteur SQL » : « Voir les données » écrit la requête dans l’éditeur et
     l’exécute ; la page descend une seule fois jusqu’à l’éditeur.
   - Réf. 2 pour la réf. 3 : « Réinitialiser cette table ? », le nom en gras, « Attention, tes modifications seront perdues. »
   - Réf. 5 pour la réf. 4 : la carte d’une table (description, « Voir les données », deux ronds, « Structure de la table »).
   - Réf. 6 pour la réf. 7 : les exemples dans un cadre, « Requêtes prêtes à tester ».
   - Réf. 8 et 9 : « Tables du projet », et « Ajouter une table → Choisir un fichier → Vérifier les données → Créer la table » ;
     « Schéma UML » garde son nom.
   Vérifié dans un navigateur (402, 390, 375 et 320 px ; un CSV, puis un classeur de trois feuilles dont une remplace une table). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';
const SQL = await createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(ROOT, 'vendor/sqljs', f) });
const N = ' ';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plur = (n, m, pl) => n + ' ' + (Math.abs(n) > 1 ? (pl || m + 's') : m);

test('invité : la vidéo d’intro passe aussi, l’invitation attend sur l’accueil', () => {
  const v = fn('obVideoVoulue');
  assert.ok(!v.includes('jeuInvitation') && v.includes('return !localStorage.getItem(OB_VIDEO_VUE);'));
});

test('réf. 2 : « Réinitialiser cette table ? », le nom en gras, l’avertissement sans encadré, deux boutons qui disent ce qu’ils font', () => {
  const r = fn('resetTable');
  assert.ok(r.includes(`titre:'Réinitialiser cette table${N}?'`));
  assert.ok(r.includes("texteHtml:`La table <b>${esc(name)}</b> retrouvera ${cours?'les données d’origine du cours':'les données de son fichier d’origine'}.`"), 'le nom passe par esc');
  assert.ok(r.includes('<p class="lq-del-warn is-attention"><span class="lq-del-wi">${alerte}</span><span><b>Attention, tes modifications seront perdues.</b>Les lignes ajoutées, modifiées ou supprimées ${cours?\'\':\'depuis l’importation \'}seront remises dans leur état initial.</span></p>'));
  assert.ok(r.includes("oui:'Réinitialiser la table',non:'Conserver mes modifications'") && !r.includes('les effets des INSERT, UPDATE et DELETE'));
  assert.ok(r.includes("'Réinitialisée',`Table «"), 'la coche dit « Réinitialisée », là où est la table');
  /* lqAsk : un texte en HTML écrit par l’app, et une action dans le geste même du toucher */
  const ask = fn('lqAsk');
  assert.ok(ask.includes('${o.texteHtml?`<p id="lq-ask-p">${o.texteHtml}</p>`:o.texte?`<p id="lq-ask-p">${esc(o.texte)}</p>`:\'\'}</div>'));
  assert.ok(ask.includes("el.querySelector('.lq-ask-oui').onclick=()=>{if(typeof o.surOui==='function')try{o.surOui();}catch(e){}fin(true);};"));
  assert.ok(lq.includes('html.lq .lq-del-warn.is-attention{margin:2px 0 0;padding:2px 2px 0;border-radius:0;background:none;'));
  assert.ok(lq.includes('html.lq .lq-del-warn.is-attention b{display:block;margin-bottom:4px;color:var(--ink);font:800 16.5px/1.3 var(--display)}'));
});

/* La carte d’une table, rendue pour de vrai (sans navigateur) */
function rendre({ ouverte, note = '', verrou = false, base = null } = {}) {
  const els = {};
  const el = id => (els[id] ||= { id, innerHTML: '', textContent: '', hidden: false, querySelector: () => null, classList: { add() {} } });
  const db = new SQL.Database();
  db.run("CREATE TABLE \"Synthese_entretiens\"(n INTEGER, client TEXT, risque TEXT); INSERT INTO \"Synthese_entretiens\" VALUES (1,'A','élevé'),(2,'B','faible');");
  db.run('CREATE TABLE fournisseurs(id INTEGER PRIMARY KEY, nom TEXT)');
  const ctx = vm.createContext({
    document: { getElementById: el, querySelector: () => null }, CSS: { escape: s => s }, esc, plur, escAttr: esc,
    activeDbId: verrou ? 'cours' : 'db_1', openTableSchema: ouverte || null, tableBaselines: { db_1: base ? { synthese_entretiens: base } : {} },
    tableBaselineKey: n => String(n).toLowerCase(), isDemoDb: id => id === 'cours', activeDb: () => db,
    listTables: d => d.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0].values.map(r => r[0]),
    tableRowCount: (d, t) => d.exec(`SELECT COUNT(*) FROM "${t}"`)[0].values[0][0], hasTableBaseline: () => !!base,
    introspectTable: (d, t) => d.exec(`PRAGMA table_info("${t}")`)[0].values.map(r => ({ c: r[1], t: r[2], b: r[5] ? 'pk' : '' })),
    tableNote: () => note, colNote: () => '', renderConsoleSchemaSummary() {}, dbWsDiff: () => ({}), prefersReduceMotion: () => true,
    NOTE_PLUS_SVG: '<svg class="plus"/>', CONSOLE_EDIT_SVG: '<svg/>', CONSOLE_RESET_SVG: '<svg/>', CONSOLE_TRASH_SVG: '<svg/>', INFO_SVG: '<svg/>', SCHEMA_META: []
  });
  /* 6 novembre, 7 h 52 : la carte d’une table est celle du schéma UML (son modèle, ses couleurs, ses exemples) */
  vm.runInContext(cut('function quoteIdent(name){', '\n') + '\n' + cut('const UML_TEINTES=', 'let schCtx=null;') + cut('const TBL_GRILLE_SVG=', 'function dbWsDiff(') + fn('renderDbWorkspace'), ctx);
  ctx.renderDbWorkspace();
  db.close();
  return els;
}

test('réf. 8 : « Tables du projet », leur nombre, une phrase ; « Ajouter une table » et « Schéma UML » ; repliée, la carte du schéma UML', () => {
  const els = rendre();
  assert.equal(els['db-tables-titre'].textContent, 'Tables du projet');
  assert.equal(els['db-tables-n'].textContent, '2 tables');
  assert.equal(els['db-tables-lab'].textContent, 'Explore les tables de ton projet et leurs colonnes.');
  const bar = els['db-bar'].innerHTML;
  assert.ok(bar.includes('<button type="button" class="db-pill add is-plus" onclick="ajouterTable()"><svg class="plus"/><span>Ajouter une table</span></button>'));
  assert.ok(bar.includes('<span>Schéma UML</span>') && !bar.includes('Importer'), '« Schéma UML » garde son nom');
  const h = els['db-tables'].innerHTML;
  /* 6 novembre, 7 h 52 (« reprendre exactement ce format dans base ») : l’en-tête de la carte du schéma (le nom, ses lignes dans une
     pastille, la flèche ronde), puis les clés seulement et « +N colonnes », qui déplie la table. */
  assert.ok(h.includes('aria-label="Table Synthese_entretiens, 2 lignes, 3 colonnes">') && h.includes('<b class="tbu-n">Synthese_<wbr>entretiens</b><small class="tbu-k" aria-hidden="true">2</small><span class="tbu-pli" aria-hidden="true"><svg'));
  assert.ok(h.includes('aria-expanded="false"') && !h.includes('tbl-corps'), 'repliée : ni description ni actions');
  assert.ok(h.includes('aria-label="Déplier la table Synthese_entretiens : ses 3 colonnes">+3 colonnes</button>'), 'sans clé : toutes ses colonnes dans « +3 colonnes »');
  assert.ok(h.includes('<div class="tbu-c is-pk"><span class="tbu-r"><i class="is-pk">PK</i><span class="tbu-cn">id</span><em>INTEGER</em></span></div>') && h.includes('>+1 colonne</button>'), 'fournisseurs : sa clé, puis « +1 colonne »');
  assert.ok(app.includes('<h2 class="tbl-titre" id="db-tables-titre">Tables du projet</h2><span class="tbl-compte" id="db-tables-n">0 table</span>'));
  /* Une base d’entraînement : « Tables de la base », lecture seule */
  const v = rendre({ verrou: true });
  assert.equal(v['db-tables-titre'].textContent, 'Tables de la base');
  assert.ok(v['db-bar'].innerHTML.includes('lecture seule') && !v['db-bar'].innerHTML.includes('ajouterTable'));
});

test('réf. 5 : dépliée, ses colonnes (et leurs exemples), puis la description, « Voir les données », deux ronds et d’où viennent les colonnes', () => {
  const h = rendre({ ouverte: 'Synthese_entretiens', base: { name: 'Synthese_entretiens', b64: 'x', fichier: 'in-audit.xlsx' } })['db-tables'].innerHTML;
  assert.ok(h.includes('aria-label="Table Synthese_entretiens, 2 lignes, 3 colonnes">') && h.includes('aria-expanded="true"') && h.includes('class="db-tblock tbu is-open"'));
  /* Ses colonnes d’abord, comme sur le schéma : le nom, le type, le cadre « ex : » (la deuxième ligne, comme la quatrième d’une plus grande) */
  assert.ok(h.includes('<div class="tbu-c"><span class="tbu-r"><span class="tbu-cn">n</span><em>INTEGER</em></span><span class="tbu-xl"><span class="tbu-x"><small>ex&nbsp;:</small><b>2</b></span></span></div>'));
  assert.ok(h.includes('<span class="tbu-cn">risque</span><em>TEXT</em></span><span class="tbu-xl"><span class="tbu-x"><small>ex&nbsp;:</small><b>faible</b></span></span></div>'));
  assert.ok(h.indexOf('<div class="tbl-corps tbu-haut">') < h.indexOf('<span class="tbu-cn">risque</span>') && !h.includes('+3 colonnes'), '21 h 24 : dépliée, la description et les actions, puis toutes ses colonnes');
  const corps = h.slice(h.indexOf('<div class="tbl-corps tbu-haut">'));
  const i = k => { const n = corps.indexOf(k); assert.ok(n >= 0, k); return n; };
  assert.ok(i('Aucune description ajoutée') < i('<span>Décrire cette table</span>') && i('<span>Décrire cette table</span>') < i('<span>Voir les données</span>'));
  assert.ok(i('<span>Voir les données</span>') < i('class="tbl-rond reset-table"') && i('class="tbl-rond reset-table"') < i('class="tbl-rond is-danger drop-table"'));
  assert.ok(i('class="tbl-rond is-danger drop-table"') < i('Les noms et types des colonnes proviennent du fichier importé (in-audit.xlsx).'));
  assert.ok(corps.includes('onclick="voirDonneesTable(decodeURIComponent(\'Synthese_entretiens\'))"') && !corps.includes('Structure de la table'));
  /* Une description : elle se lit et se modifie ; une table créée en SQL : son CREATE TABLE */
  const d = rendre({ ouverte: 'Synthese_entretiens', note: 'Les entretiens <b>RH</b>' })['db-tables'].innerHTML;
  assert.ok(d.includes('<span class="tbl-desc-t"><small>Description</small>Les entretiens &lt;b&gt;RH&lt;/b&gt;</span>') && !d.includes('Aucune description ajoutée'));
  assert.ok(d.includes('viennent de son <code>CREATE TABLE</code>.') && d.includes('disabled>'), 'sans copie de départ : rien à réinitialiser');
  const pk = rendre({ ouverte: 'fournisseurs' })['db-tables'].innerHTML;
  assert.ok(pk.includes('<div class="tbu-c is-pk"><span class="tbu-r"><i class="is-pk">PK</i><span class="tbu-cn">id</span><em>INTEGER</em></span></div>'), 'une table sans ligne : pas de cadre « ex : »');
  /* Les styles : ceux des cartes du schéma (le nom en mono à la couleur de la table, la flèche couchée quand elle est pliée),
     « Voir les données » en grand, deux pastilles nommées sur une carte étroite */
  for (const k of ['html.lq #scr-console .tbu-n{flex:1;min-width:0;color:var(--ci);font:800 14.5px/1.25 var(--mono);overflow-wrap:anywhere}',
    'html.lq #scr-console .tbu-pli svg{width:16px;height:16px;transform:rotate(-90deg);', 'html.lq #scr-console .db-tblock.tbu.is-open .tbu-pli svg{transform:none}',
    'html.lq #scr-console .tbl-voir{flex:1;min-width:0;', '@container (max-width:336px){', 'html.lq #scr-console .tbl-rond span{position:static;width:auto;height:auto;overflow:visible;clip:auto}',
    'html.lq #scr-console .tbu-c.is-on .tbu-v{background:var(--lc);color:#fff}', 'html.lq #scr-console .tbu-r em{flex:none;margin-left:auto;'])
    assert.ok(lq.includes(k), k);
  assert.ok(!lq.includes('.tbl-col{') && !lq.includes('.tbl-chev{') && !lq.includes('.tbl-struct{'), 'plus de règles pour l’ancienne carte');
});

test('« Voir les données » : la requête dans l’éditeur, exécutée, et une seule descente jusqu’à l’éditeur', () => {
  const v = fn('voirDonneesTable');
  assert.ok(v.includes("fillConsoleSql(`SELECT * FROM ${quoteIdent(name)}\\nLIMIT 50;`,{reste:true});") && v.includes('runConsole({surEditeur:true,direct:true});'), '17 h 35 : exécutée tout de suite, puis une glissade');
  assert.ok(v.includes("out.style.minHeight=Math.round((window.innerHeight||800)*.8)+'px';"), 'la place du résultat est gardée : la page peut descendre jusqu’à l’éditeur');
  assert.ok(fn('fillConsoleSql').includes('if(!(o&&o.reste))sh?.scrollIntoView('));
  const run = fn('runConsole');
  assert.ok(run.includes("if(out&&!surEditeur)out.style.minHeight='';") && run.includes("const garde=out.style.minHeight;out.style.minHeight='';if(garde&&out.offsetHeight<parseFloat(garde))out.style.minHeight=garde;"));
  assert.ok(!app.includes('function tablePreviewHTML(') && !app.includes('const tblPreview=') && !app.includes('function queryTable('), 'plus de lignes affichées dans la carte');
  /* ecranVers : l’élément juste sous la barre du haut, en un seul défilement (sans animation : d’un coup ; la glissade, dans
     retours-1735) */
  const scr = { scrollTop: 700, scrollHeight: 5000, clientHeight: 800, getBoundingClientRect: () => ({ top: 0 }), querySelector: () => ({ getBoundingClientRect: () => ({ bottom: 56 }) }) };
  const ctx = vm.createContext({ prefersReduceMotion: () => true });
  vm.runInContext(fn('glisserEcran') + fn('ecranVers'), ctx);
  ctx.ecranVers({ closest: () => scr, getBoundingClientRect: () => ({ top: 940 - (scr.scrollTop - 700) }) });
  assert.equal(scr.scrollTop, 700 + 940 - 68);
});

test('réf. 6 : les exemples dans un cadre, « Requêtes prêtes à tester » et ce qu’on en fait', () => {
  assert.ok(app.includes('<div class="chips-wrap ex-cadre">\n            <div class="ex-tete"><h2 class="ex-titre">Requêtes prêtes à tester</h2><p class="ex-sous">Choisis un exemple pour le charger dans l’éditeur, puis exécute-le pour découvrir les résultats.</p></div>\n            <div class="chips" id="console-chips"></div>'));
  assert.ok(!app.includes('<small>Requêtes prêtes à lancer</small>') && !fn('renderConsoleChips').includes(".db-lab small"));
  assert.ok(lq.includes('html.lq #scr-console .chips-wrap.ex-cadre{margin:0 0 18px!important;padding:16px 0 12px;border:2px solid var(--line);border-radius:22px;background:#fff;box-shadow:0 4px 0 var(--lip)}'));
  assert.ok(lq.includes('html.lq #scr-console .ex-cadre .chips{margin:0!important;padding:2px 16px 6px!important;'), 'les cartes défilent dans le cadre');
});

test('réf. 9 : « Ajouter une table au projet », puis le fichier choisi dans le geste même du toucher, pour le projet ouvert', () => {
  const a = fn('ajouterTable');
  assert.ok(a.includes("titre:'Ajouter une table au projet',texte:'Importe un fichier Excel ou CSV pour créer une nouvelle table dans ta base de données.'"));
  assert.ok(a.includes("oui:'Choisir un fichier',non:'Annuler'") && a.includes("surOui:()=>{importAjout=Date.now();const f=document.getElementById('data-import');if(f)f.click();}"));
  const on = fn('onDataImport');
  assert.ok(on.indexOf("const ajout=importAjout&&Date.now()-importAjout<15*60*1000&&consoleView==='work'&&!isDemoDb(activeDbId)&&customDbs[activeDbId]?activeDbId:null;") < on.indexOf("ev.target.value='';"));
  assert.ok(on.includes('importAjout=0;') && on.includes("surOui:()=>{importAjout=ajout?Date.now():0;document.getElementById('data-import').click();}"), '« Choisir un autre fichier » garde le projet');
  assert.ok(app.includes('onchange="onDataImport(event)" oncancel="importAjout=0">'), 'un choix annulé oublie « Ajouter une table »');
  assert.ok(app.includes(`onclick="importAjout=Date.now();document.getElementById('data-import').click()">Importer un fichier</button>`), 'un projet vide aussi');
});

test('« Vérifier les données » : les colonnes, leurs types et un exemple ; les feuilles d’un classeur, et celle qui remplacera une table', () => {
  const db = new SQL.Database();
  db.run('CREATE TABLE "Phase_audit___RH"(n INTEGER)');
  const ctx = vm.createContext({ esc, plur, customDbs: { db_1: db }, listTables: d => d.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]?.values.map(r => r[0]) || [],
    safeIdent: s => String(s).replace(/[^\p{L}\p{N}_]+/gu, '_'), TBL_GRILLE_SVG: '<svg/>' });
  vm.runInContext(fn('importNoms') + fn('importApercuHtml'), ctx);
  const t = ctx.importApercuHtml({ kind: 'table', cols: ['fournisseur_id', 'nom'], types: ['INTEGER', 'TEXT'], rows: [[null, ''], [1, 'Atelier Nord']] }, 'db_1');
  assert.ok(t.startsWith('<div class="iv-t"><b>Colonnes détectées</b><small>2 colonnes · 2 lignes</small></div><ul class="iv-cols">'));
  assert.ok(t.includes('<li class="iv-col"><span class="iv-cn">fournisseur_<wbr>id</span><span class="iv-ct">INTEGER</span><small class="iv-ex">ex. 1</small></li>'), 'l’exemple : la première valeur remplie');
  assert.ok(t.includes('<span class="iv-cn">nom</span><span class="iv-ct">TEXT</span><small class="iv-ex">ex. Atelier Nord</small>'));
  const c = ctx.importApercuHtml({ kind: 'database', format: 'json-db', tables: [{ name: 'Clients', cols: ['id', 'nom'], rows: [[1, 'A']] }, { name: 'Phase_audit___RH', cols: ['n'], rows: [] }] }, 'db_1');
  assert.ok(c.includes('<b>Tables détectées</b><small>2 tables</small>') && c.includes('<b>Clients</b><small>1 ligne · 2 colonnes</small><small class="iv-tc">id, nom</small></span>'));
  assert.ok(c.includes('<b>Phase_<wbr>audit_<wbr>_<wbr>_<wbr>RH</b><small>0 ligne · 1 colonne</small><small class="iv-tc">n</small><em class="iv-deja">Remplacera la table du même nom</em>'));
  assert.deepEqual([...ctx.importNoms({ format: 'sqlite', noms: ['a', 'b'] })], ['a', 'b']);
  assert.equal(ctx.importApercuHtml({ kind: 'database', format: 'sql', sql: 'CREATE TABLE x(a)' }, 'db_1'), '', 'un script : son texte, comme avant');
  db.close();
  const o = fn('openImportSheet');
  assert.ok(o.includes("title.textContent=aj?'Vérifier les données':asDb?'Importer une base':'Importer une table';"));
  assert.ok(o.includes("go.textContent=aj?(!asDb||noms.length===1?'Créer la table':noms.length>1?`Créer les ${noms.length} tables`:'Créer les tables'):(asDb?'Importer le projet':'Importer la table');"));
  assert.ok(o.includes("document.getElementById('imp-db-field').hidden=!!aj;") && o.includes(`Elle rejoindra «${N}\${projectName(aj)}${N}»`), 'le projet ouvert, sans le choisir');
  assert.ok(app.includes('<div class="imp-prev" id="imp-prev"></div>\n    <p class="imp-ou" id="imp-ou" hidden></p>'));
  assert.ok(lq.includes('html.lq .imp-sheet{max-height:calc(100dvh - 12px);overflow-y:auto;overscroll-behavior:contain}'), 'une longue liste de colonnes défile');
});

test('« Créer la table » : tout rejoint le projet ouvert sans le remplacer ; une table du même nom se demande ; on reste sur la page', () => {
  const c = fn('confirmImport');
  /* 9 novembre, 21 h 57 : un classeur vers un projet qui a déjà des tables : « Ajouter au projet » ou « Tout remplacer » ; les tables du
     même nom : identiques, laissées ; différentes, « Mettre à jour » ou « Garder les miennes » */
  assert.ok(c.includes('let aj=importAjoutCible();') && c.includes('const asDb=isDatabaseImport(p)&&!aj;\n  const chosen=aj||document.getElementById(\'imp-db\').value;'), 'un classeur ajouté ne remplace pas le projet');
  assert.ok(c.includes('const bilan=importComparer(customDbs[aj],p);') && c.includes("if(r==='trois'){m.forEach(n=>pendingImport.saute.add(n.toLowerCase()));"));
  assert.ok(c.includes("const remplace=p.format==='sqlite'&&!aj;") && c.includes("database.run('SAVEPOINT rq_import');point=true;\n      copierTablesSqlite(p.bytes,database,pendingImport.saute);"));
  assert.ok(c.includes('[pendingImport.importedTable,p.primaryTable,...(p.tableNames||[]),...ajoutees].filter(Boolean)'), 'leur copie de départ');
  assert.ok(c.includes('if(s0&&fichier)s0.fichier=String(fichier).slice(0,120);'), 'le nom du fichier, pour la carte');
  assert.ok(c.includes('consoleSchemaOpen=true;') && c.includes("if(aj&&avant===aj&&consoleView==='work'){") && c.includes('}else openConsoleProject(target);'), 'on reste sur la page du projet ; depuis la liste, on l’ouvre (la page va au compte rendu, 21 h 38)');
  assert.ok(!c.includes('queryTable('));
  /* Le compte rendu : « Tables ajoutées », et « Schéma UML » */
  const ctx = vm.createContext({ esc, plur, UML_SVG: '<svg/>', umlModele: () => ({ liens: [] }) });
  vm.runInContext(fn('importRetourHtml'), ctx);
  const h = ctx.importRetourHtml(null, ['Clients', 'Commandes', 'In'], null, false, ['Clients', 'Commandes']);
  assert.ok(h.includes('<b>Tables ajoutées</b><p>Ajoutées au projet&nbsp;: <code>Clients</code>, <code>Commandes</code>.</p>') && h.includes('<span>Schéma UML</span>') && !h.includes('Voir le schéma UML'));
  /* 9 novembre, 22 h 13 (« mal formulé, sois pro ») : une ligne par sort */
  ctx.importLaisses = { identiques: ['Infos'], gardees: ['Bareme'], majs: [] };
  const f = ctx.importRetourHtml(null, ['Bareme', 'Infos', 'Codes_eco'], 'Codes_eco', false, null);
  assert.ok(f.includes('<b>Table ajoutée</b><p>Ajoutée au projet&nbsp;: <code>Codes_eco</code>.</p><p class="imp-idem">Identique au projet, non modifiée&nbsp;: <code>Infos</code>.</p><p class="imp-idem">Version du projet conservée&nbsp;: <code>Bareme</code>.</p>'), f);
  assert.ok(!/rejoint|déjà là|Gardée|telle quelle/.test(f));
  ctx.importLaisses = { identiques: [], gardees: [], majs: ['Bareme'] };
  const m = ctx.importRetourHtml(null, ['Bareme', 'Infos', 'Codes_eco'], null, false, ['Codes_eco', 'Bareme']);
  assert.ok(m.includes('<b>Table ajoutée</b><p>Ajoutée au projet&nbsp;: <code>Codes_eco</code>.</p><p class="imp-idem">Mise à jour avec la version du fichier&nbsp;: <code>Bareme</code>.</p>'), m);
  ctx.importLaisses = null;
  const b = vm.createContext({});
  vm.runInContext(fn('importBilanPhrase'), b);
  assert.equal(b.importBilanPhrase({ nouvelles: ['a'], identiques: ['b'], modifiees: ['c'] }), '1\u00a0nouvelle, 1\u00a0identique et 1\u00a0différente');
  assert.equal(b.importBilanPhrase({ nouvelles: ['a', 'd'], identiques: [], modifiees: ['c'] }), '2\u00a0nouvelles et 1\u00a0différente');
  assert.ok(app.includes("titre:'Ce projet contient déjà des tables'") && app.includes('La mise à jour remplace ${un?\'sa\':\'leur\'} version actuelle par celle du fichier.'));
});

test('une base SQLite ajoutée à un projet : ses tables, leurs lignes, leur clé et leurs index, sans toucher aux autres', () => {
  const src = new SQL.Database();
  src.run("CREATE TABLE clients(id INTEGER PRIMARY KEY, nom TEXT NOT NULL); INSERT INTO clients VALUES (1,'Ana'),(2,'Bo'); CREATE INDEX ix_nom ON clients(nom); CREATE TABLE notes(txt TEXT); INSERT INTO notes VALUES ('x');");
  const bytes = src.export(); src.close();
  const dest = new SQL.Database();
  dest.run("CREATE TABLE garde(a INTEGER); INSERT INTO garde VALUES (7); CREATE TABLE notes(vieux TEXT); INSERT INTO notes VALUES ('ancien'),('ancien 2');");
  const ctx = vm.createContext({ SQL, quoteIdent: s => '"' + String(s).replace(/"/g, '""') + '"', quoteSqlText: s => "'" + String(s).replace(/'/g, "''") + "'",
    listTables: d => d.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0].values.map(r => r[0]) });
  vm.runInContext(fn('tableDefinitionSql') + fn('copierTablesSqlite'), ctx);
  assert.deepEqual([...ctx.copierTablesSqlite(bytes, dest)], ['clients', 'notes']);
  assert.deepEqual(dest.exec('SELECT a FROM garde')[0].values, [[7]], 'les autres tables restent');
  assert.deepEqual(dest.exec('SELECT id, nom FROM clients ORDER BY id')[0].values, [[1, 'Ana'], [2, 'Bo']]);
  assert.deepEqual(dest.exec('SELECT * FROM notes')[0].values, [['x']], 'la table du même nom est remplacée');
  assert.equal(dest.exec("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='ix_nom'")[0].values[0][0], 1);
  assert.equal(dest.exec("PRAGMA table_info(clients)")[0].values[0][5], 1, 'la clé primaire suit');
  dest.close();
  assert.ok(app.includes("return {kind:'database',format:'sqlite',bytes,defaultTable:baseName,noms:tabs,nbs:counts,"));
});

/* 9 novembre, 22 h 22 (« teste avec des fichiers différents ») : chaque cas a une phrase juste */
test('import dans un projet : phrases selon le contenu du fichier, table identique, remplacement complet', () => {
  const b = vm.createContext({});
  vm.runInContext(fn('importBilanPhrase') + fn('importBilanTexte') + fn('importListe'), b);
  const B = (n, i, m) => ({ total: n.length + i.length + m.length, nouvelles: n, identiques: i, modifiees: m });
  assert.equal(b.importBilanTexte(B(['a', 'b'], [], [])), 'Les 2 tables du fichier sont nouvelles.');
  assert.equal(b.importBilanTexte(B([], ['a', 'b'], [])), 'Les 2 tables du fichier sont identiques à celles du projet.');
  assert.equal(b.importBilanTexte(B([], [], ['a'])), 'La table du fichier existe déjà dans le projet avec un contenu différent.');
  assert.equal(b.importBilanTexte(B(['a'], ['b'], ['c'])), 'Le fichier en compte 3 : 1 nouvelle, 1 identique et 1 différente.');
  assert.equal(b.importListe(['Bareme', 'Infos']), '«\u00a0Bareme\u00a0» et «\u00a0Infos\u00a0»');
  assert.ok(app.includes("if(bilan.total&&bilan.identiques.length===bilan.total){lqInfo('Projet déjà à jour'"), 'tout identique : rien à demander');
  assert.ok(app.includes("oui:bilan.nouvelles.length?'Ajouter au projet':'Mettre à jour le projet'"));
  assert.ok(app.includes("lqInfo('Projet déjà à jour',`La table « ${deja} » du fichier est identique à celle du projet."), 'un CSV identique ne remplace rien');
  assert.ok(app.includes("titre:'Remplacer tout le contenu ?'") && app.includes('Cette action est définitive.`,oui:\'Remplacer\',danger:true,non:\'Annuler\''));
  assert.ok(app.includes("if(asDb&&pi.remplace)return ok('Contenu remplacé'"));
  assert.ok(app.includes("k===1?'Sa ligne actuelle sera remplacée'"), 'plus de « ses 1 ligne »');
});
