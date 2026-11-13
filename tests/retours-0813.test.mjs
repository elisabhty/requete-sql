/* Elisa, 5 novembre, 8 h 13 : « Des agents peuvent tester pour la partie base Console : si on met un fichier, ça génère
   automatiquement ! » Trois agents ont importé des scripts SQL, des bases SQLite, des CSV, des JSON et des classeurs, puis regardé le
   schéma UML. Ce qu’ils ont trouvé, et qui ne doit pas revenir :
   - les liens : une clé déclarée avec une autre casse (REFERENCES Clients(ID)), une clé primaire qui est aussi étrangère (une table
     d’association), une clé composite (une seule jointure, avec AND), une table « order » ou « group » (entre guillemets), des liens
     devinés vers leur propre table (animaux.animal_id) ou vers une colonne absente, « id_client » pas reconnu ;
   - le dessin : une table désignée par dix autres empilait ses pastilles et serrait ses couloirs à 3 px (les faisceaux), deux bouts
     au même endroit faisaient croire à une autre colonne (l’autre côté de la carte), « → table » mangeait le nom à 320 px, les
     accents coupés, la bulle qui cache la carte touchée, le focus perdu au clavier ;
   - l’import : un .csv à l’en-tête « begin » pris pour du SQL, un projet vide laissé par chaque import raté, « [object Object] »,
     les zéros en tête perdus, l’en-tête d’une feuille sous un titre, les cellules fusionnées, une colonne vide fantôme, une feuille
     cachée importée en .xls et .ods, une table remplacée sans rien demander ; et après l’import, le schéma à voir tout de suite. */
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
const fn = name => cut(`function ${name}(`, '\n}\n') + '\n}\n';

const initSqlJs = createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'));
const SQL = await initSqlJs({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ctx = vm.createContext({SCHEMA_META: [], esc, window: {},
  escAttr: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  plur: (n, mot, pl) => n + ' ' + (Math.abs(n) > 1 ? (pl || mot + 's') : mot)});
vm.runInContext(cut('function quoteIdent(name){', '\n') + '\n' + cut('function tableRowCount(database,name){', '\n}\n') + '\n}\n'
  + fn('safeIdent') + cut('function guessFkTarget(col,tables){', 'function courseTableNames(){')
  + cut('const UML_TEINTES=', 'let schCtx=null;')
  + cut('/* ---------- Import CSV / JSON / SQL ---------- */', '/* Un fichier, quel qu’il soit :') + fn('importRetourHtml')
  + ';Object.assign(this,{umlModele,umlPlan,umlHtml,umlPanneau,umlPastilles,umlNbLiens,umlJoin,umlCle,umlId,umlBulle,umlAllumes,schemaExemples,'
  + 'annotateColumnKeys,guessFkTarget,parseImportFile,parseJsonImport,tableFromMatrix,inferSqlType,ligneEnTete,importRetourHtml,UML_TEINTES,UML_NEUTRE});', ctx);
const tablesDe = d => d.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0].values.map(v => v[0]);
const ouvrir = sql => { const d = new SQL.Database(); d.run(sql); return d; };
const pur = x => JSON.parse(JSON.stringify(x));
const liensDe = m => pur(m.liens.map(l => `${l.de}.${l.col} -> ${l.vers}.${l.versCol || ctx.umlCle(m, l)} [${l.un}/${l.plusieurs}]`));

/* Rien ne se touche : cartes, couloirs hors des cartes, pastilles (deux à la même place : la même multiplicité, un faisceau). */
function verifier(p, nom) {
  const parY = [...p.cartes].sort((a, b) => a.y - b.y);
  for (let k = 1; k < parY.length; k++) assert.ok(parY[k].y >= parY[k - 1].y + parY[k - 1].h + 10, nom);
  const carte = Object.fromEntries(p.cartes.map(c => [c.name, c]));
  for (const a of p.arcs) {
    assert.ok(a.xl >= 2 && a.xl <= p.W - 2 && (a.xl < carte[a.de].x || a.xl > carte[a.de].x + carte[a.de].w), `${nom} : ${a.de} → ${a.vers}`);
    for (const t of a.lab) assert.ok(t.x >= 0 && t.x + t.w <= p.W, `${nom} : pastille dans la toile`);
  }
  for (const cote of ['g', 'd']) {
    const ps = p.arcs.filter(a => a.cote === cote).flatMap(a => a.lab).sort((a, b) => a.y - b.y);
    for (let k = 1; k < ps.length; k++) assert.ok(ps[k].y >= ps[k - 1].y + ps[k - 1].h - 0.5 || Math.abs(ps[k].y - ps[k - 1].y) < 0.01 && ps[k].t === ps[k - 1].t,
      `${nom} : pastilles ${ps[k - 1].t}@${ps[k - 1].y} et ${ps[k].t}@${ps[k].y} (${cote})`);
  }
}

test('la casse : « REFERENCES Clients(ID) » désigne la table clients et sa colonne id', () => {
  const d = ouvrir(`CREATE TABLE clients(id INTEGER PRIMARY KEY, nom TEXT); CREATE TABLE commandes(id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES Clients(ID));
    CREATE TABLE avis(id INTEGER PRIMARY KEY, commande_id INTEGER REFERENCES COMMANDES);`);
  const m = ctx.umlModele(d, tablesDe(d));
  assert.deepEqual(liensDe(m).sort(), ['avis.commande_id -> commandes.id [0..1/0..*]', 'commandes.client_id -> clients.id [1/0..*]']);
  const p = ctx.umlPlan(m, 322, false), cl = p.cartes.find(c => c.name === 'clients'), a = p.arcs.find(x => x.de === 'commandes');
  assert.equal(a.y2, cl.y + 34 + 7 + 10, 'le trait arrive sur la ligne id, pas sur l’en-tête');
  assert.equal(ctx.umlJoin(m, m.liens.find(l => l.de === 'commandes')), 'FROM commandes JOIN clients ON commandes.client_id = clients.id');
  d.close();
});

test('une clé primaire qui est aussi étrangère, une clé composite : leurs liens, leurs badges, une seule jointure avec AND', () => {
  const d = ouvrir(`CREATE TABLE etudiants(id INTEGER PRIMARY KEY, nom TEXT);
    CREATE TABLE cours(code TEXT, annee INTEGER, titre TEXT, PRIMARY KEY(code, annee));
    CREATE TABLE inscriptions(etudiant_id INTEGER NOT NULL REFERENCES etudiants(id), cours_code TEXT NOT NULL, cours_annee INTEGER NOT NULL,
      PRIMARY KEY(etudiant_id, cours_code, cours_annee), FOREIGN KEY(cours_code, cours_annee) REFERENCES cours(code, annee));
    CREATE TABLE profils(etudiant_id INTEGER PRIMARY KEY REFERENCES etudiants(id), bio TEXT);
    INSERT INTO etudiants VALUES (1,'Ana'),(2,'Léo');
    INSERT INTO cours VALUES ('SQL',2024,'Bases'),('SQL',2025,'Bases 2'),('PY',2024,'Python');
    INSERT INTO inscriptions VALUES (1,'SQL',2024),(1,'PY',2024),(2,'SQL',2025);`);
  const m = ctx.umlModele(d, tablesDe(d));
  assert.deepEqual(liensDe(m).sort(), ['inscriptions.cours_annee -> cours.annee [1/0..*]', 'inscriptions.cours_code -> cours.code [1/0..*]',
    'inscriptions.etudiant_id -> etudiants.id [1/0..*]', 'profils.etudiant_id -> etudiants.id [1/0..1]']);
  const comp = m.liens.find(l => l.col === 'cours_code');
  assert.ok(comp.grp && comp.grp === m.liens.find(l => l.col === 'cours_annee').grp, 'les deux colonnes d’une même clé');
  const j = ctx.umlJoin(m, comp);
  assert.equal(j, 'FROM inscriptions JOIN cours ON inscriptions.cours_code = cours.code AND inscriptions.cours_annee = cours.annee');
  assert.equal(d.exec('SELECT COUNT(*) ' + j)[0].values[0][0], 3, 'trois inscriptions, trois cours : pas sept');
  assert.equal(ctx.umlNbLiens(m), 3, 'la clé composite compte pour un lien');
  const h = ctx.umlPanneau(m, 322, true);
  assert.ok(h.includes('<span>3 tables · 3 relations</span>') === false && h.includes('4 tables · 3 relations'));
  assert.equal((h.match(/<li><button type="button" class="umd-li"/g) || []).length, 3, 'une entrée pour la clé composite');
  assert.ok(h.includes('<code>inscriptions.(cours_code, cours_annee)</code>') && h.includes('<code>cours.(code, annee)</code>') && h.includes('<small class="umd-dv">clé composite</small>'));
  assert.ok(h.includes('<i class="is-pk">PK</i><i class="is-fk">FK</i><span>etudiant_id</span><b class="umd-v">→ etudiants</b>'), 'PK et FK à la fois');
  const tout = ctx.umlAllumes(m, {i: m.liens.indexOf(comp)});
  assert.equal(tout.on.size, 2, 'toucher la clé composite allume ses deux traits');
  d.close();
});

test('les mots de SQLite et les noms à espace s’écrivent entre guillemets : chaque jointure proposée marche telle quelle', () => {
  const d = ouvrir(`CREATE TABLE "group"(id INTEGER PRIMARY KEY, nom TEXT); CREATE TABLE "order"(id INTEGER PRIMARY KEY, group_id INTEGER REFERENCES "group"(id));
    CREATE TABLE "Ventes 2024"(id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES "order"(id)); CREATE TABLE noeuds(id INTEGER PRIMARY KEY, group_id INTEGER REFERENCES noeuds(id));
    INSERT INTO "group" VALUES (1,'a'); INSERT INTO "order" VALUES (1,1); INSERT INTO "Ventes 2024" VALUES (1,1); INSERT INTO noeuds VALUES (1,NULL),(2,1);`);
  const m = ctx.umlModele(d, tablesDe(d));
  for (const l of m.liens) { const j = ctx.umlJoin(m, l); assert.doesNotThrow(() => d.exec('SELECT * ' + j), j); }
  assert.equal(ctx.umlId('order'), '"order"');
  assert.equal(ctx.umlId('Group'), '"Group"');
  assert.equal(ctx.umlId('clients'), 'clients');
  assert.equal(ctx.umlJoin(m, m.liens.find(l => l.de === 'order')), 'FROM "order" JOIN "group" ON "order".group_id = "group".id');
  assert.equal(ctx.umlJoin(m, m.liens.find(l => l.de === 'noeuds')), 'FROM noeuds JOIN noeuds AS noeuds2 ON noeuds.group_id = noeuds2.id', 'un alias qui n’est pas un mot de SQLite');
  d.close();
});

test('les liens devinés : jamais vers sa propre table ni vers une table sans clé ; id_client à la française ; leurs multiplicités lues dans les données', () => {
  const d = ouvrir(`CREATE TABLE animaux(animal_id INTEGER, nom TEXT, enclos_id INTEGER); CREATE TABLE enclos(id INTEGER, nom TEXT);
    CREATE TABLE companies(company_id INTEGER, name TEXT); CREATE TABLE contacts(id INTEGER, company_id INTEGER, transaction_id INTEGER);
    CREATE TABLE clients(id_client INTEGER, nom TEXT); CREATE TABLE factures(id_facture INTEGER, id_client INTEGER, total REAL);
    CREATE TABLE notes(texte TEXT); CREATE TABLE remarques(id INTEGER, note_id INTEGER);
    INSERT INTO animaux VALUES (1,'Léo',1),(2,'Zou',NULL); INSERT INTO enclos VALUES (1,'A');
    INSERT INTO companies VALUES (1,'ACME'); INSERT INTO contacts VALUES (1,1,9),(2,1,8);
    INSERT INTO clients VALUES (1,'Ana'); INSERT INTO factures VALUES (1,1,10),(2,1,20); INSERT INTO remarques VALUES (1,1);`);
  const m = ctx.umlModele(d, tablesDe(d));
  assert.deepEqual(liensDe(m).sort(), ['animaux.enclos_id -> enclos.id [0..1/0..*]', 'contacts.company_id -> companies.company_id [1/0..*]',
    'factures.id_client -> clients.id_client [1/0..*]'], 'animal_id, company_id, id_client, id_facture : la clé de leur table ; notes n’a pas de clé');
  const cols = t => Object.fromEntries(m.tables.find(x => x.name === t).cols.map(c => [c.c, c.b || '']));
  assert.deepEqual(cols('animaux'), {animal_id: 'pk', nom: '', enclos_id: 'fk'});
  assert.deepEqual(cols('factures'), {id_facture: 'pk', id_client: 'fk', total: ''});
  assert.equal(cols('contacts').transaction_id, '', 'transaction_id, sans table transactions : une simple colonne');
  assert.ok(m.liens.every(l => l.devine), 'aucune clé déclarée : des liens devinés');
  assert.equal(m.liens.find(l => l.de === 'animaux').un, '0..1', 'une clé vide dans les données : 0..1');
  assert.equal(m.liens.find(l => l.de === 'factures').un, '1', 'aucune clé vide : 1');
  const h = ctx.umlPanneau(m, 322, true);
  assert.ok(h.includes('<small class="umd-dv">deviné au nom</small>') && h.includes('désigne exactement une ligne de <code>clients</code> (aucune clé vide pour l’instant).'));
  for (const l of m.liens) assert.doesNotThrow(() => d.exec('SELECT * ' + ctx.umlJoin(m, l)));
  d.close();
});

test('la colonne désignée sans clé primaire : son id, sinon son rowid ; les petits nombres gardent leurs chiffres', () => {
  const d = ouvrir(`CREATE TABLE a(nom TEXT); CREATE TABLE b(x INTEGER REFERENCES a); CREATE TABLE c(Id INTEGER, v TEXT); CREATE TABLE e(y INTEGER REFERENCES c);
    CREATE TABLE m(id INTEGER PRIMARY KEY, v REAL); INSERT INTO m VALUES (1,1e-7),(2,0.00001234),(3,12.345678),(4,-0.5),(5,2.5e-9);`);
  const m = ctx.umlModele(d, tablesDe(d));
  assert.equal(ctx.umlCle(m, m.liens.find(l => l.de === 'b')), 'rowid');
  assert.equal(ctx.umlCle(m, m.liens.find(l => l.de === 'e')), 'Id');
  assert.deepEqual(pur([1, 2, 3, 4, 5].map(n => ctx.schemaExemples(d, 'm', n).v.v)), ['1e-7', '0.00001234', '12.3457', '-0.5', '-0.5']);
  d.close();
});

test('l’étoile : dix tables vers une même colonne arrivent en un faisceau (une pastille, un couloir) ; les clés ne passent jamais sous « +N colonnes »', () => {
  const br = Array.from({length: 10}, (_, i) => `CREATE TABLE branche_${String(i + 1).padStart(2, '0')}(id INTEGER PRIMARY KEY, hub_id INTEGER NOT NULL REFERENCES hub(id), v TEXT);`).join('');
  const d = ouvrir(`CREATE TABLE hub(id INTEGER PRIMARY KEY, nom TEXT);${br}
    CREATE TABLE carrefour(id INTEGER PRIMARY KEY, ${Array.from({length: 10}, (_, i) => `b${i + 1}_id INTEGER REFERENCES branche_${String(i + 1).padStart(2, '0')}(id)`).join(', ')}, a TEXT, b TEXT);`);
  const m = ctx.umlModele(d, tablesDe(d));
  for (const W of [322, 622]) for (const ex of [false, true]) {
    const p = ctx.umlPlan(m, W, ex);
    verifier(p, `étoile ${W} ${ex}`);
    const versHub = p.arcs.filter(a => a.vers === 'hub');
    assert.equal(new Set(versHub.map(a => a.xl + '|' + a.y2)).size, 1, 'vers hub : un seul couloir, un seul bout');
    const xs = [...new Set(p.arcs.filter(a => a.cote === 'd').map(a => a.xl))].sort((a, b) => a - b);
    for (let k = 1; k < xs.length; k++) assert.ok(xs[k] - xs[k - 1] >= 4.9, `deux couloirs à ${xs[k] - xs[k - 1]} px`);
    /* 6 novembre, 7 h 52 (« efface les Voir ») : dépliée, une table montre toutes ses colonnes ; pliée, ses clés restent sur la carte. */
    const car = p.cartes.find(c => c.name === 'carrefour');
    assert.equal(car.cols.length, 13, 'dépliée : toutes ses colonnes');
    assert.equal(car.plus, 0, 'dépliée : pas de « +N colonnes »');
    const pl = ctx.umlPlan(m, W, ex, new Set(['carrefour'])).cartes.find(c => c.name === 'carrefour');
    assert.equal(pl.cols.filter(c => /^b\d+_id$/.test(c.c) && !pl.caches.includes(c.c)).length, 10, 'pliée : les dix clés restent sur la carte');
    assert.equal(pl.plus, 2, 'pliée : « +2 colonnes » (a et b)');
  }
  const pp = ctx.umlPlan(m, 322, true), h = ctx.umlHtml(pp);
  const pHub = ctx.umlPastilles(pp).filter(x => x.a.vers === 'hub' && x.t.t === '1');
  assert.equal(pHub.length, 1);
  assert.equal(pHub[0].is.length, 10, 'la pastille du faisceau s’allume avec chacun de ses dix liens');
  assert.ok(h.includes(`data-is="${pHub[0].is.join(' ')}"`));
  d.close();
});

test('deux faisceaux qui arriveraient au même endroit : l’un passe de l’autre côté de la carte, au lieu de tomber sur la colonne suivante', () => {
  const d = ouvrir(`CREATE TABLE clients(id INTEGER PRIMARY KEY, prenom TEXT, nom TEXT);
    CREATE TABLE avis(id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id));
    CREATE TABLE commandes(id INTEGER PRIMARY KEY, client_id INTEGER REFERENCES clients(id));`);
  const m = ctx.umlModele(d, tablesDe(d));
  for (const ex of [false, true]) {
    const p = ctx.umlPlan(m, 322, ex), c = p.cartes.find(x => x.name === 'clients'), yId = c.y + 34 + 7 + 10;
    const a = p.arcs.filter(x => x.vers === 'clients');
    assert.deepEqual(pur(a.map(x => x.y2)), [yId, yId], 'les deux arrivent sur la ligne id');
    assert.notEqual(a[0].cote, a[1].cote, 'chacun de son côté');
    verifier(p, 'deux faisceaux');
  }
  d.close();
});

test('les dix couleurs : au-delà de sept tables désignées, elles ne se répètent plus', () => {
  assert.equal(ctx.UML_TEINTES.length, 10);
  assert.equal(new Set(ctx.UML_TEINTES.map(t => t[0])).size, 10);
});

test('les fichiers texte : un .csv n’est jamais du SQL, le JSON imbriqué en texte, les listes de valeurs en tables, les codes à zéro en texte', () => {
  const csv = ctx.parseImportFile('agenda.csv', 'begin,date,lieu\n9h,2024-03-01,Lyon\n10h,2024-03-02,Nice');
  assert.equal(csv.kind, 'table');
  assert.deepEqual(pur(csv.cols), ['begin', 'date', 'lieu']);
  assert.equal(ctx.parseImportFile('notes.txt', 'begin;fin\n1;2').kind, 'table', 'un .txt qui commence par « begin; » : du texte');
  const j = ctx.parseImportFile('imbrique.json', JSON.stringify([{id: 1, adresse: {ville: 'Lyon', cp: '69001'}, tags: ['a', 'b']}, {id: 2, adresse: null, tags: []}]));
  assert.deepEqual(pur(j.rows[0]), [1, '{"ville":"Lyon","cp":"69001"}', '["a","b"]'], 'du JSON, pas « [object Object] »');
  const b = ctx.parseImportFile('base.json', JSON.stringify({produits: [{id: 1, nom: 'Thé'}], tags: ['bio', 'local'], notes: [1, 2, 3], titre: 'x'}));
  assert.equal(b.kind, 'database');
  assert.deepEqual(pur(b.tables.map(t => [t.name, t.cols, t.rows.length])), [['produits', ['id', 'nom'], 1], ['tags', ['valeur'], 2], ['notes', ['valeur'], 3], ['infos', ['titre'], 1]], 'le titre aussi, dans infos (17 h 22)');
  assert.equal(ctx.inferSqlType(['01000', '75001']), 'TEXT', 'un code postal');
  assert.equal(ctx.inferSqlType(['0612345678']), 'TEXT', 'un téléphone');
  assert.equal(ctx.inferSqlType(['0', '0.5', '12']), 'REAL');
  assert.equal(ctx.inferSqlType(['', null]), 'TEXT', 'une colonne vide');
  const t = ctx.tableFromMatrix(['', 'id', 'nom', ''], [['', 1, 'a', ''], ['', 2, 'b', '']]);
  assert.deepEqual(pur(t.cols), ['id', 'nom'], 'les colonnes sans nom ni valeur s’en vont, même au début');
  assert.equal(ctx.ligneEnTete([['Commandes du 1er trimestre', 'Commandes du 1er trimestre'], [], ['id', 'client_id', 'montant'], [1, 1, 9.5]]), 2);
  assert.equal(ctx.ligneEnTete([['id', 'nom'], [1, 'a']]), 0);
  assert.equal(ctx.ligneEnTete([['Rapport'], ['', ''], ['id', 'nom', 'ville'], [1, 'a', 'b']]), 2);
});

test('les classeurs : les cellules fusionnées, l’en-tête sous un titre, la feuille cachée et les erreurs de formule, en .xlsx, .xls et .ods', async () => {
  const fctx = vm.createContext({TextDecoder, DecompressionStream, Response, Blob, Uint8Array, DataView, ArrayBuffer, Math, Date, String, Number, Array, Map, Set, Error, console});
  fctx.globalThis = fctx; fctx.window = fctx;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'import-formats.js'), 'utf8'), fctx);
  const F = fctx.ImportFormats, lire = async f => pur(await F.readWorkbook(new Uint8Array(fs.readFileSync(path.join(ROOT, 'tests/fixtures', f))), f));
  for (const ext of ['xlsx', 'xls', 'ods']) {
    const r = await lire('import-fusions.' + ext), fus = r.sheets.find(s => s.name === 'Fusion').rows;
    assert.deepEqual(fus.slice(1, 6).map(x => x[3]), ['Nord', 'Nord', 'Nord', 'Sud', 'Sud'], ext + ' : la région fusionnée vaut pour chaque ligne');
    assert.deepEqual(fus[0].slice(1, 3), ['Nom complet', 'Nom complet'], ext + ' : un en-tête fusionné sur deux colonnes');
    const cmd = r.sheets.find(s => s.name === 'Commandes').rows;
    assert.equal(ctx.ligneEnTete(cmd), 2, ext + ' : l’en-tête est sous le titre');
    assert.ok(!JSON.stringify(r.sheets).includes('#DIV/0!'), ext + ' : une erreur de formule est vide');
    const noms = await lire('import-noms.' + ext);
    assert.ok(!noms.sheets.some(s => s.name === 'Cachée'), ext + ' : la feuille cachée ne s’importe pas');
    assert.ok(noms.sheets.some(s => s.name === 'Order'));
  }
  assert.ok(app.includes('const h=ligneEnTete(rows);\n      return {name:tname,sheet:sh.name,...tableFromMatrix(rows[h],rows.slice(h+1))};'));
});

test('l’import : un échec ne laisse rien, un nom déjà pris se demande, et le compte rendu montre le schéma qui s’est dessiné', () => {
  const c = cut('async function confirmImport(){', 'function importRetourHtml(');
  for (const k of ["titre:'Remplacer cette table ?'", "database.run('SAVEPOINT rq_import');point=true;", "if(point){ database.run('RELEASE rq_import'); point=false; }",
    "if(point)try{ database.run('ROLLBACK TO rq_import'); database.run('RELEASE rq_import'); }catch(x){}",
    'if(ancienne){ try{ customDbs[target].close(); }catch(x){} customDbs[target]=ancienne; }', 'dbCatalog=dbCatalog.filter(d=>d.id!==target);',
    "activeDbId=avant==='cours'||isDemoDb(avant)||customDbs[avant]?avant:'cours';", 'out.innerHTML=importRetourHtml(database,tabs,tn,asDb,affected.length>1&&!asDb?affected:null,infosN?{n:infosN,c:infosT.cols}:null);', "if(cadre&&typeof ecranVers==='function')requestAnimationFrame(()=>requestAnimationFrame(()=>ecranVers(cadre)));"])
    assert.ok(c.includes(k), k);
  assert.ok(c.indexOf('const avant=activeDbId,neuf=chosen===') < c.indexOf('activeDbId=target;'));
  const d = ouvrir(`CREATE TABLE clients(id INTEGER PRIMARY KEY, nom TEXT); INSERT INTO clients VALUES (1,'Ana');`);
  const un = ctx.importRetourHtml(d, ['clients'], 'clients', false);
  assert.ok(un.includes('<b>Table ajoutée</b><p>Ajoutée au projet&nbsp;: <code>clients</code>.</p>') && un.includes('Importe une deuxième table avec une colonne comme <code>client_id</code>&nbsp;: le schéma UML affichera leur relation.') && !un.includes('imp-uml'));
  d.run('CREATE TABLE commandes(id INTEGER, client_id INTEGER, total REAL); INSERT INTO commandes VALUES (1,1,9.5);');
  const deux = ctx.importRetourHtml(d, ['clients', 'commandes'], 'commandes', false);
  assert.ok(deux.includes('Ajoutée au projet&nbsp;: <code>commandes</code>.') && deux.includes('<p class="imp-liens">Relation trouvée&nbsp;: <code>commandes.client_id</code> → <code>clients</code>.</p>'));
  assert.ok(deux.includes(`onclick="openSchemaSheet('console','__uml__')"`), 'le bouton ouvre le schéma UML');
  d.run('CREATE TABLE meteo(jour TEXT, temp REAL);');
  assert.ok(ctx.importRetourHtml(d, ['clients', 'commandes', 'meteo'], 'meteo', false).includes('Aucune relation pour l’instant&nbsp;: une colonne comme <code>client_id</code> en créerait une.'));
  assert.ok(ctx.importRetourHtml(d, ['clients', 'commandes', 'meteo'], null, true).includes("<b>Tables ajoutées</b><p>Ajoutées au projet&nbsp;: <code>clients</code>, <code>commandes</code>, <code>meteo</code>.</p>"));
  d.close();
});

test('la Console : des requêtes prêtes qui marchent sur des données importées, et les jointures des liens du schéma', () => {
  const r = fn('renderConsoleChips');
  assert.ok(r.includes("const ex=tables.map(t=>({l:'Aperçu de la table',q:`SELECT * FROM ${umlId(t)}\\nLIMIT 50;`}));"));
  assert.ok(r.includes("aDes('clients',['id','prenom'])&&aDes('commandes',['id','client_id','quantite'])"), '« Ventes par client » seulement si ses colonnes sont là');
  assert.ok(r.includes("ex.push({l:`Jointure ${l.de} → ${l.vers}`,q:`SELECT *\\n${umlJoin(m,l).replace(/ JOIN /,'\\nJOIN ')}\\nLIMIT 50;`})"));
  assert.ok(r.includes("if(activeDbId!=='cours'&&tables.length>1){"), 'pas sur la base du cours, qui a déjà les siennes');
});

test('les noms à guillemet ou apostrophe, la pastille UML, le clavier, la bulle', () => {
  const r = cut('function renderSchemaSheet(){', 'const schTabSel={},schBaseOuverte={};');
  assert.ok(r.includes('data-t="${escAttr(name)}" onclick="schemaPickTab(this)">') && r.includes('<div class="sch-table is-tbu" role="tabpanel" data-t="${escAttr(name)}"'));
  assert.ok(!r.includes('data-t="${esc(name)}"'));
  /* Une seule depuis le 5 novembre, 15 h 01 : les lignes d’une table ne s’affichent plus dans sa carte (« Voir les données » va à l’éditeur) */
  assert.equal((app.match(/encodeURIComponent\((?:t|name)\)\.replace\(\/'\/g,'%27'\)/g) || []).length, 1, 'l’apostrophe ne ferme plus le onclick de la Console');
  assert.ok(r.includes("if(schVue==='__uml__'&&avecUml)cur=schTabSel[key]='__uml__';"), 'la pastille jaune ouvre le schéma, pas le dernier onglet');
  const o = cut('function openSchemaSheet(ctx,vue){', 'function closeSchemaSheet(){');
  assert.ok(o.includes("if(ae&&ae!==document.body&&!ae.closest('#schema-sheet'))schRetour=ae;") && o.includes("document.querySelector('#schema-body .sch-tab.on')||document.querySelector('#schema-sheet .viz-head button'); if(f)try{ f.focus({preventScroll:true}); }"));
  assert.ok(cut('function closeSchemaSheet(){', '\n}\n').includes('schRetour.focus({preventScroll:true})'));
  const piege = fn('schemaPiege');
  assert.ok(piege.includes("if(e.shiftKey&&i<=0){ e.preventDefault(); f[f.length-1].focus(); }") && app.includes("document.getElementById('schema-sheet').addEventListener('keydown',schemaPiege);"));
  assert.ok(!app.includes('function schemaOuvrirTable('), 'plus de « Ses colonnes » ni de « Voir » vers l’onglet de la table (6 novembre, 7 h 52)');
  const dg = fn('umlDegager');
  assert.ok(dg.includes('const trop=c.bottom-(b.top-22),marge=Math.max(0,c.top-haut);') && fn('umlFocus').includes('else if(umlSel&&umlSel.t!=null)umlDegager();'));
});

test('la DA : les accents entiers, « → table » qui rétrécit d’abord, les noms longs qui passent à la ligne, deviné ou composite', () => {
  for (const k of ['html.lq #schema-sheet .umd-h b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:800 13px/34px var(--mono);',
    'html.lq #schema-sheet .umd-r>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:20px}',
    'html.lq #schema-sheet .umd-v{flex:0 3 auto;min-width:34px;max-width:58%;', 'font:800 9.5px/14px var(--mono)}',
    'html.lq #schema-sheet .umd-x{display:flex;align-items:center;gap:4px;align-self:flex-start;max-width:100%;height:14px;padding:0 5px;border-radius:5px;background:#F6F4FD;box-shadow:inset 0 0 0 1px var(--line);font:600 9.5px/14px var(--mono);',
    'html.lq #schema-sheet .umd-bh{display:flex;flex-wrap:wrap;', 'html.lq #schema-sheet .umd-bn{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;',
    'html.lq #schema-sheet .umd-lt code{min-width:0;font:inherit;overflow-wrap:anywhere}', 'html.lq #schema-sheet .umd-lt code:last-of-type{color:var(--lci)}',
    'html.lq #schema-sheet .umd-dv{padding:2px 7px;border-radius:99px;', 'html.lq #schema-sheet .umd-c i.is-pk{background:var(--sun);', 'html.lq #schema-sheet .umd-c i.is-fk{background:var(--mint);',
    'html.lq #schema-sheet .sch-col .cxl{flex-basis:100%;order:9;min-width:0;', 'html.lq #schema-sheet .sch-col .cx{display:inline-flex;align-items:center;gap:5px;max-width:100%;overflow:hidden;'])
    assert.ok(css.includes(k), k);
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=335">'), 'la feuille de style est rechargée');
});
