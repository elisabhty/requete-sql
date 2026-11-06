/* Elisa, 5 novembre, 14 h 24 (huit captures) :
   - « Quand on joue seule (quand il n’y a que nous dans la salle), il n’y a pas les +25 → corriger le Comment sont calculés les
     points » : seule dans la salle, la manche se joue comme seul ; le +25 du premier coup reste (vérifié : 200 + 25), c’est le bonus
     de place qui ne compte pas ; la règle le dit.
   - Réf. 1 : « la pill violette est pixelisée » (« À toi de jouer », penchée, son curseur clignotait en opacité : un calque à part).
   - Réf. 2 et 3 : Pratiquer d’après sa réf. 3 ; « Mes défis » ouvre Mes stats, plus la page Défis ; plus de « Le chrono part de 00:00 ».
   - Réf. 4 : « 1 à 0 sur 0 » au classement, au rechargement.
   - La suppression du compte enlève des classements : la liste le dit.
   - Import : « le bouton Importer le projet ne fonctionne pas » (un classeur de 120 594 lignes), les noms de colonnes (un titre
     fusionné pris pour l’en-tête), « Bases trop volumineuses pour la sauvegarde locale » en supprimant une table.
   - Schéma UML : « Voir » avec › animé dans la table, comme dans les défis.
   Vérifié dans un navigateur (402 et 320 px ; un classeur de 80 874 lignes sur trois feuilles, titre fusionné compris). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';
const SQL = await createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(ROOT, 'vendor/sqljs', f) });

test('seule dans la salle : le +25 du premier coup reste, le bonus de place ne compte pas, et la règle le dit', () => {
  /* Le calcul, inchangé : seul (Joue seul, ou seul dans la salle au lancement de la manche) */
  const ctx = vm.createContext({});
  vm.runInContext(cut('const JEU_PALIERS=', '\n') + '\n' + cut('const JEU_NIV_X=', '\n') + '\n' + fn('jeuValeur') + fn('jeuPts') + fn('jeuRanking') + 'var JEU={solo:false,rounds:[]};', ctx);
  vm.runInContext("JEU.rounds[0]={one:true,found:{a:30000},first:{a:1}};JEU.rounds[1]={one:false,found:{a:30000,b:40000},first:{a:1,b:1}};", ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.jeuRanking(0))), [{ pid: 'a', ms: 30000, place: 1, k: 'f', val: 200, x: 1, essai: 25, rang: 0, pts: 225 }]);
  const deux = JSON.parse(JSON.stringify(ctx.jeuRanking(1)));
  assert.deepEqual(deux.map(x => [x.pid, x.essai, x.rang, x.pts]), [['a', 25, 50, 275], ['b', 0, 30, 230]], 'à plusieurs : le +25 au premier, le bonus de place à chacun');
  const regles = fn('renderDefisRules');
  assert.ok(regles.includes('<li><b>✨ Du premier coup</b><span>+${JEU_PTS_ESSAI*x}</span><small>Ta première requête exécutée est la bonne. Seul, tu le gardes toujours ; à plusieurs, si personne n’a trouvé avant toi</small></li>'));
  assert.ok(regles.includes('<li><b>🥇 Premier à trouver</b><span>+${JEU_PTS_RANG[0]*x}</span><small>À plusieurs : 2e +${JEU_PTS_RANG[1]*x} · 3e +${JEU_PTS_RANG[2]*x} · 4e +${JEU_PTS_RANG[3]*x}. Seul à jouer la manche, pas de bonus de place</small></li>'));
  assert.ok(regles.includes('<small>seul</small><i aria-hidden="true">·</i><b>${(top+(JEU_PTS_ESSAI+JEU_PTS_RANG[0])*x).toLocaleString(\'fr-FR\')}</b><small>à plusieurs</small>'));
});

test('réf. 1 : le curseur de « À toi de jouer » clignote par sa couleur, plus en opacité (l’étiquette penchée reste nette)', () => {
  assert.ok(lq.includes('@keyframes coachCaret{50%{background-color:transparent}}') && !lq.includes('@keyframes coachCaret{50%{opacity:0}}'));
  assert.ok(lq.includes('animation:coachCaret 1s steps(1) infinite') && lq.includes('html.lq .coach-tag.is-go{background:var(--accent);color:#fff;box-shadow:0 3px 0 var(--accent-ink);rotate:-2deg}'));
});

test('réf. 2 et 3 : Pratiquer, la salle de défi lance une partie ; Mes stats s’ouvre seulement si on le demande', () => {
  assert.ok(app.includes('<h1>Pratiquer</h1><p class="sub">Passe de la théorie à la pratique, une requête à la fois.</p>'));
  const hub = fn('renderJourneyHub');
  assert.ok(hub.includes("<h2>${typeof accord==='function'?accord('Prête','Prêt','Prêt·e'):'Prêt·e'} à relever le défi&nbsp;?</h2><p>Un défi surprise, un chrono et des points à gagner. Joue en solo ou affronte d’autres joueurs&nbsp;!</p><button type=\"button\" class=\"journey-primary\" onclick=\"pratiquerDefis('jouer')\"><span>Relever un défi</span>${PRAT_FLECHE}</button>"));
  assert.ok(!app.includes('Le chrono part de 00:00') && !hub.includes('Entrer dans la salle'), '« Le chrono part de 00:00 » quitte la page');
  /* 6 novembre, 15 h 20 : « supprimer le bandeau Mes défis » (retours-1520-pratiquer) */
  assert.ok(!hub.includes("'Mes défis'") && !hub.includes("pratiquerDefis('stats')"), 'plus de « Mes défis » sur Pratiquer');
  assert.ok(hub.includes("['console','Console SQL','Explore les données et teste librement tes requêtes.',\"switchTab('console')\"]"));
  assert.ok(app.includes("const JOURNEY_STK={defis:'trophy',"), 'le trophée pour la progression');
  /* pratiquerDefis('stats') : Mes stats ; « Relever un défi » : Jouer, même si Mes stats était resté ouvert */
  const vus = [];
  const ctx = vm.createContext({ DEFIS: { onglet: 'jouer' }, switchTab: t => vus.push([t, ctx.DEFIS.onglet, vm.runInContext('defisVersStats', ctx)]) });
  vm.runInContext(cut('let defisVersStats=false;', '/* L’entrée Stickers'), ctx);
  ctx.pratiquerDefis('stats'); ctx.pratiquerDefis('jouer');
  assert.deepEqual(vus, [['defis', 'stats', true], ['defis', 'jouer', false]]);
  assert.equal(vm.runInContext('defisVersStats', ctx), false);
  /* Les autres chemins vers Défis (Accueil, Planning) n’arrivent pas sur Mes stats laissé ouvert */
  assert.ok(fn('switchTab').includes("if(name==='defis'&&activeTab!=='defis'&&typeof DEFIS!=='undefined'&&DEFIS.onglet==='stats'&&!(typeof defisVersStats!=='undefined'&&defisVersStats))DEFIS.onglet='jouer';"));
  assert.ok(lq.includes('html.lq:not([data-motion="reduce"]) .journey-spotlight .journey-primary .prat-fleche{animation:pratFleche 1.1s ease-in-out .4s infinite}'));
});

test('réf. 4 : personne de classé → le message, plus « 1 à 0 sur 0 »', () => {
  const charger = fn('clsPageCharger');
  assert.ok(charger.includes('if(sc&&c.total>0&&sc.children.length===clsPagesNb())clsPagerRemplir();else clsPagerPeindre();'));
  const el = { textContent: '' }, ctx = vm.createContext({ DEFIS: { cls: { total: 0, page: 0 } }, CLS_PAR_PAGE: 5, CLS_PAGES_MAX: 20, clsPts: n => String(n),
    document: { getElementById: id => (id === 'dx-range' ? el : null) } });
  vm.runInContext(fn('clsPagesNb') + fn('clsNavPeindre'), ctx);
  ctx.clsNavPeindre();
  assert.equal(el.textContent, '');
  ctx.DEFIS.cls.total = 12; ctx.DEFIS.cls.page = 2; ctx.clsNavPeindre();
  assert.equal(el.textContent, '11 à 12 sur 12');
});

test('la suppression du compte retire aussi des classements, et la liste le dit', () => {
  assert.ok(fn('compteSupprimerHTML').includes(', tes scores et ta place dans les classements, tes avis, ton vote et tes messages'));
  const mig = lire('supabase/migrations/20261104224931_compte_supprimer.sql'), cls = lire('supabase/migrations/20261031143437_classement_general.sql');
  assert.ok(mig.includes('delete from public.jeu_joueur where cle = v_cle;') && cls.includes('joueur uuid not null references public.jeu_joueur (id) on delete cascade'), 'ses parties partent avec lui');
});

test('import : l’en-tête sous un titre fusionné, les lignes par requête préparée avec la progression, le bouton occupé', async () => {
  const ctx = vm.createContext({});
  vm.runInContext(fn('ligneEnTete'), ctx);
  const titre = 'Générateur de code produit ameublement barème 2025';
  assert.equal(ctx.ligneEnTete([Array(12).fill(titre), ['Remplissez les cellules jaunes'], [], ['Catégorie', 'Type de produit', 'Matériau', 'Code produit'], ['Cat 0', 'Type 0', 'Bois', '0101']]), 3, 'le titre fusionné ne fixe plus la largeur');
  assert.equal(ctx.ligneEnTete([Array(6).fill(titre), [1, 2, 3], [4, 5, 6]]), 1, 'sans en-tête net : la première ligne qui n’est pas un titre');
  assert.equal(ctx.ligneEnTete([['Commandes du 1er trimestre', 'Commandes du 1er trimestre'], [], ['id', 'client_id', 'montant'], [1, 1, 9.5]]), 2);
  assert.equal(ctx.ligneEnTete([['id', 'nom'], [1, 'a']]), 0);
  /* Les lignes : une requête préparée, et la main rendue à l’écran avec la progression */
  const db = new SQL.Database(), suivis = [];
  let maintenant = 0;
  const ictx = vm.createContext({ safeIdent: s => String(s).replace(/[^A-Za-z0-9_]/g, '_'), quoteIdent: s => '"' + s + '"', setTimeout: f => f(), performance: { now: () => (maintenant += 30) } });
  vm.runInContext(cut('async function createImportedTables(', '/* Le bouton de la feuille d’import'), ictx);
  const rows = Array.from({ length: 30 }, (_, i) => [String(i), 'n' + i, i % 2 ? '1,5' : '2']);
  await ictx.createImportedTables(db, [{ name: 'grille', cols: ['id', 'nom', 'prix'], types: ['INTEGER', 'TEXT', 'REAL'], rows }], f => suivis.push(+f.toFixed(2)));
  assert.equal(db.exec('SELECT COUNT(*), SUM(id) FROM grille')[0].values[0].join(), '30,435');
  assert.ok(suivis.length >= 5 && suivis.every((f, i) => f > 0 && f <= 1 && (!i || f > suivis[i - 1])), 'la progression avance : ' + suivis.join(' '));
  db.close();
  const conf = fn('confirmImport');
  assert.ok(conf.includes("if(go&&go.getAttribute('aria-busy')==='true')return;}") && conf.includes('importOccupe(true);\n  await new Promise(ok=>setTimeout(ok,40));'));
  assert.ok(conf.includes('await createImportedTables(database, p.tables, f=>importOccupe(true,f));') && conf.includes('importOccupe(false);\n    closeImportSheet();') && conf.includes('importOccupe(false);\n    lqInfo(\'Import impossible\''));
  assert.ok(fn('importOccupe').includes("go.textContent=frac==null?'Import en cours…':`Import en cours… ${Math.min(99,Math.round(frac*100))}\\u00a0%`;"));
  /* Les noms longs passent à la ligne dans la carte du projet (depuis le 6 novembre, 7 h 52 : la carte du schéma UML) */
  assert.ok(app.includes('<span class="tbu-cn">${esc(c.c).replace(/_/g,\'_<wbr>\')}</span>') && lq.includes('html.lq #scr-console .tbu-cn{min-width:0;line-height:1.3;overflow-wrap:anywhere}'));
});

test('les projets dans IndexedDB : un gros projet s’enregistre, se recharge, et supprimer une table ne dit plus « trop volumineuse »', async () => {
  /* Un IndexedDB minimal, en mémoire */
  const store = new Map();
  const req = v => { const r = {}; setTimeout(() => { r.result = v; r.onsuccess && r.onsuccess(); }); return r; };
  const idb = { objectStoreNames: { contains: () => true }, createObjectStore() {},
    transaction: () => { const tx = { objectStore: () => ({ clear: () => store.clear(), put: r => store.set(r.id, r), getAll: () => req([...store.values()]) }) }; setTimeout(() => tx.oncomplete && tx.oncomplete()); return tx; } };
  const indexedDB = { open: () => { const r = {}; setTimeout(() => { r.result = idb; r.onsuccess && r.onsuccess(); }); return r; } };
  const ls = new Map(), avis = [];
  const big = new SQL.Database();
  big.run('CREATE TABLE grille (code TEXT, prix REAL)'); big.run('BEGIN');
  const st = big.prepare('INSERT INTO grille VALUES (?,?)'); for (let i = 0; i < 25000; i++) st.run(['c' + i, i / 10]); st.free(); big.run('COMMIT');
  big.run('CREATE TABLE eco (code TEXT)'); big.run("INSERT INTO eco VALUES ('e1'),('e2')");
  const ctx = vm.createContext({ indexedDB, SQL, setTimeout, Uint8Array, JSON, Date, Error, Promise, Object, Math, String, Number, Array,
    localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, v), removeItem: k => ls.delete(k) },
    DBS_KEY: 'requete-sql-dbs-v1', isDemoDb: () => false, attachDateFns: d => d, lqInfo: (...a) => avis.push(a[0]),
    quoteIdent: s => '"' + s + '"', quoteSqlText: s => "'" + s + "'", u8ToB64: () => 'b64', b64ToU8: () => new Uint8Array(),
    listTables: d => d.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0].values.map(v => v[0]) });
  vm.runInContext('var dbCatalog=[{id:"db_1",name:"Ameublement"}],customDbs={},tableBaselines={};' + fn('tableBaselineKey') + fn('baselineSlot') + fn('tableDefinitionSql') + fn('tableRowCount')
    + cut('const BASELINE_MAX=', 'function rememberTableBaseline(') + fn('rememberTableBaseline') + fn('hasTableBaseline').replace("if(id==='cours')return SCHEMA_META.some(t=>tableBaselineKey(t.table)===tableBaselineKey(name));", '')
    + cut('const DBS_IDB=', 'async function persistCustomDbs(') + cut('async function persistCustomDbs(', 'async function loadCustomDbs(') + cut('async function loadCustomDbs(', '\n}\n') + '\n}\n', ctx);
  vm.runInContext('customDbs.db_1=SQL_BIG;', Object.assign(ctx, { SQL_BIG: big }));
  vm.runInContext('rememberTableBaseline(customDbs.db_1,"db_1","grille");rememberTableBaseline(customDbs.db_1,"db_1","eco");', ctx);
  assert.equal(vm.runInContext('JSON.stringify(tableBaselines.db_1.grille)', ctx), '{"name":"grille","trop":25000}', 'pas de copie de départ au-delà de 20 000 lignes');
  assert.equal(vm.runInContext('hasTableBaseline("db_1","grille")+","+hasTableBaseline("db_1","eco")', ctx), 'false,true');
  assert.equal(await ctx.persistCustomDbs(), true);
  const rec = store.get('db_1');
  assert.ok(rec && rec.bytes.byteLength > 100000 && rec.name === 'Ameublement' && rec.ordre === 0 && !ls.has('requete-sql-dbs-v1'), 'les octets tels quels, rien dans localStorage');
  /* Un nouveau démarrage : le projet revient */
  vm.runInContext('dbCatalog=[];customDbs={};tableBaselines={};', ctx);
  await ctx.loadCustomDbs();
  assert.equal(vm.runInContext('dbCatalog.map(d=>d.name).join()+"|"+listTables(customDbs.db_1).join()+"|"+tableRowCount(customDbs.db_1,"grille")', ctx), 'Ameublement|eco,grille|25000');
  assert.deepEqual(avis, [], 'aucun avertissement');
  /* Supprimer une table enlève aussi sa copie de départ ; l’enregistrement ne touche que ce projet */
  const drop = fn('dropTable');
  assert.ok(drop.includes('if(tableBaselines[activeDbId])delete tableBaselines[activeDbId][tableBaselineKey(name)];') && drop.includes("if(activeDbId!=='cours') persistCustomDbs(activeDbId);"));
  assert.ok(!app.includes("toast('Bases trop volumineuses pour la sauvegarde locale')"));
  assert.ok(fn('resetTable').includes("if(snapshot&&snapshot.trop){lqInfo('Pas de copie de départ',"));
});

test('schéma UML : « +2 colonnes » est un bouton, sans « Voir » (6 novembre, 7 h 52 : « efface les Voir ») : il déplie la table', () => {
  const html = fn('umlHtml');
  assert.ok(html.includes('<button type="button" class="umd-c is-plus is-deplier" aria-label="${escAttr(`Déplier la table ${c.name} : ses ${plur(nc,\'colonne\')}`)}" onclick="umlPlier(this,event)"><span>+${plur(c.plus,\'colonne\')}</span></button>`'));
  assert.ok(html.includes(":'<span class=\"umd-c is-plus is-vide\"></span>')"), 'sans colonne de plus : la ligne vide, comme avant');
  assert.ok(!html.includes('umd-voir') && !html.includes('schemaOuvrirTable') && !lq.includes('.umd-voir'), 'plus de pastille « Voir »');
  assert.ok(app.includes("e.target.closest('.umd-pli,.is-deplier'))return;"), 'toucher « +2 colonnes » déplie la table sans allumer la carte');
  assert.ok(lq.includes('html.lq #schema-sheet button.umd-c.is-deplier{width:100%;margin:0;border:0;background:none;cursor:pointer;'));
});

test('versions : ludique.css v155, cache du service worker', () => {
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=185">'));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-06-procedures-v2591';") && app.includes("const SW_CACHE='requete-2026-11-06-procedures-v2591';"));
});
