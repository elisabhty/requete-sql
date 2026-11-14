/* Elisa, 14 novembre, 22 h 51 : « Tout traduire » (avant l’envoi à Apple). Après l’interface, le module 1 en entier, pour valider
   toute la chaîne : la base des cours en anglais (customers, first_name, 'shipped'), le SQL des leçons récrit pour elle, la vidéo
   « Les bases de données relationnelles » en anglais (ses textes, son code, ses moments, sa vignette, le badge NutriBoost), l’écran
   de la leçon et son lecteur. En français, rien ne change (vérifié aussi dans un navigateur : la vidéo rend exactement la même chose).
   L’anglais reste « en essai ». */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const MOTEUR = lire('langues.js'), EN = lire('langue-en.js'), app = lire('index.html'), sw = lire('sw.js');
const core = lire('assets/anim/core.js'), page = lire('assets/anim/bases-relationnelles.html'), PAGE_EN = lire('assets/anim/en/bases-relationnelles.js');

function anglais() {
  const local = {'requete-maj-canal': '"essai"', 'requete-langue': 'en'}, win = {}, ecrits = [];
  const ctx = {window: win, navigator: {language: 'fr-FR'}, Intl: {DateTimeFormat: () => ({resolvedOptions: () => ({timeZone: 'Europe/Paris'})})},
    location: {hostname: 'x', search: ''}, localStorage: {getItem: k => (k in local ? local[k] : null), setItem(k, v) { local[k] = v; }},
    document: {write: h => ecrits.push(h), documentElement: {}, title: '', addEventListener() {}, currentScript: {getAttribute: a => ({src: '../../langues.js?v=4', 'data-textes': '{langue}/bases-relationnelles.js?v=1'})[a]}}};
  vm.runInNewContext(MOTEUR, ctx); vm.runInNewContext(EN, ctx);
  return {L: win.REQUETE_LANGUE, ecrits, ctx};
}

test('une page d’un autre dossier (une vidéo) charge la langue à côté de langues.js, puis ses propres textes', () => {
  const {L, ecrits} = anglais();
  assert.equal(L.code, 'en');
  assert.deepEqual(ecrits, ['<script src="../../langue-en.js?v=4"><\/script><script src="en/bases-relationnelles.js?v=1"><\/script>']);
  assert.ok(page.includes('<script src="../../langues.js?v=4" data-textes="{langue}/bases-relationnelles.js?v=1"></script>'), 'la vidéo charge la langue avant tout');
  assert.ok(page.indexOf('../../langues.js') < page.indexOf('src="core.js"'));
});

test('le SQL : une table suivie d’une parenthèse, une colonne citée seule', () => {
  const {L} = anglais();
  assert.equal(L.sql('FOREIGN KEY (client_id) REFERENCES clients(id)'), 'FOREIGN KEY (customer_id) REFERENCES customers(id)');
  assert.equal(L.sql('CREATE TABLE clients ('), 'CREATE TABLE customers (');
  assert.equal(L.sql("INSERT INTO clients (prenom, nom) VALUES ('Lina', 'Garnier')"), "INSERT INTO customers (first_name, last_name) VALUES ('Lina', 'Garnier')");
  assert.equal(L.sql('prenom'), 'first_name');
  assert.equal(L.sql('nom'), 'last_name', 'nom seul : celui des clients (la première table qui l’a)');
  assert.equal(L.sql('SELECT nom FROM produits'), 'SELECT name FROM products', 'avec sa table, le bon');
  assert.equal(L.sql('client_id'), 'customer_id', 'toutes les tables qui l’ont le traduisent pareil');
  assert.equal(L.sql("WHERE nom = 'Magnésium'"), "WHERE last_name = 'Magnesium'");
  assert.equal(L.sql('SELECT COUNT(*) FROM commandes'), 'SELECT COUNT(*) FROM orders', 'une fonction reste une fonction');
  assert.equal(L.identifiant('clients'), 'customers');
  assert.equal(L.identifiant('produits', 'nom'), 'name');
  assert.equal(L.identifiant('inconnue', 'x'), 'x');
  assert.equal(typeof L.code, 'string', 'REQUETE_LANGUE.code reste la langue (le code SQL s’écrit avec ecrireCode)');
});

test('la base des cours en anglais : écrite par sql() depuis SCHEMA_SQL, valeurs par défaut comprises', async () => {
  const {L} = anglais();
  const init = createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'));
  const SQL = await init({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
  const schema = /const SCHEMA_SQL = `([\s\S]*?)`;/.exec(app)[1];
  const a = new SQL.Database(); a.run(L.sql(schema));
  const b = L.base((() => { const d = new SQL.Database(); d.run(schema); return d; })());
  for (const t of ['customers', 'products', 'orders', 'loyalty'])
    assert.deepEqual(a.exec('SELECT * FROM ' + t), b.exec('SELECT * FROM ' + t), `${t} : les mêmes lignes que base()`);
  assert.ok(/status TEXT NOT NULL DEFAULT 'processing'/.test(a.exec("SELECT sql FROM sqlite_master WHERE name='orders'")[0].values[0][0]));
  assert.deepEqual(a.exec('SELECT name FROM products ORDER BY id')[0].values.flat(),
    ['Prebiotic Fiber', 'Marine Collagen', 'Magnesium', 'Vitamin D', 'Detox Tea', 'Plant Protein', 'Omega 3', 'Steel Shaker']);
  a.run("INSERT INTO orders (order_number, customer_id, product_id, quantity) VALUES ('X', 1, 1, 1)");
  assert.equal(a.exec("SELECT status FROM orders WHERE order_number = 'X'")[0].values[0][0], 'processing');
});

test('l’appli : la base, son schéma, les solutions et les vérifications dans la langue ; un défi à sa propre base reste en français', () => {
  assert.ok(app.includes('function buildDb(){ if(db)db.close(); db=new SQL.Database(); attachDateFns(db); db.run(langueSql(SCHEMA_SQL)); }'));
  assert.ok(app.includes("function langueSql(s){try{const L=window.REQUETE_LANGUE;return L&&L.code!=='fr'?L.sql(s):s;}catch(e){return s;}}"));
  assert.ok(app.includes("function langueSqlDe(s,c){return c&&typeof defiBaseId==='function'&&defiBaseId(c)?s:langueSql(s);}"));
  assert.ok(app.includes('const sol=langueSqlDe(isDefi?current.sol:current.solution,isDefi?current:null);'));
  assert.ok(app.includes('userRes=d1.exec(langueSql(current.verif))') && app.includes('solRes=d2.exec(langueSql(current.verif))'));
  assert.ok(app.includes("SCHEMA_META.forEach(t=>{t.cols.forEach(c=>{c.c=L.identifiant(t.table,c.c);});t.table=L.identifiant(t.table);})"));
  assert.ok(app.includes('window.REQUETE_LANGUE.autreBase=()=>{const c=typeof defiActif===\'function\'&&defiActif();return !!(c&&defiBaseId(c));};'));
  /* Le serveur des salles vérifie avec le code de l’appli jusqu’à buildDb (sql-compat.mjs) : les fonctions de la langue sont après. */
  assert.ok(app.indexOf('function langueSql(') > app.indexOf('function buildDb()'));
});

test('le code affiché : <code> et les lignes d’éditeur des vidéos, écrits pour la base de la langue ; data-en et data-en-src', () => {
  for (const k of ["if (el.nodeName === 'CODE') codeSql(el);", "if (n.nodeName === 'CODE') codeSql(n);", 'try { if (API.autreBase && API.autreBase()) return; } catch (e) {}',
    "var src = el.getAttribute && el.getAttribute('data-' + CODE + '-src');", "var v = el.getAttribute && el.getAttribute('data-' + CODE);",
    "ecrireCode: function (el) { try { codeSql(el); } catch (e) {} },", 'html: function (h) {', 'ajouter: function (code, contenu) {'])
    assert.ok(MOTEUR.includes(k), k);
  assert.ok(core.includes("if (LG && LG.ecrireCode) $$('.ln, .codepill, .rq, .tye, .m, code'"), 'les lignes de code avant la frappe');
});

test('le moteur des vidéos : les textes traduits à la source, la voix de la langue (aucune tant qu’elle n’existe pas), les clés des voix restent françaises', () => {
  assert.ok(core.includes("const LG = (() => { try { const L = window.REQUETE_LANGUE; return L && L.code !== 'fr' ? L : null; } catch (e) { return null; } })();"));
  assert.ok(core.includes('function fr(h){\n  if (LG) return LG.html(h);\n  return frSource(h);\n}'));
  assert.ok(core.includes("if (LG) cfg = Object.assign({}, cfg, {voice: LG.voix || null});"));
  assert.ok(core.includes('const vkey = h => { let x = 5381; for (const ch of plainFr(h)'), 'la clé d’une légende vient de son texte français');
  assert.ok(core.includes("if (LG) cap.setAttribute('data-notrad', '');") && core.includes('function frDom(root){\n  if (LG) return;'));
  assert.ok(lire('assets/anim/core.css').includes('html[lang="en"] #cap .cap-stk::after{content:"Your instructor"}'));
});

test('la vidéo du module 1 en anglais : ses textes, gardés nombre pour nombre et morceau pour morceau', () => {
  const textes = {};
  vm.runInNewContext(PAGE_EN, {window: {REQUETE_LANGUE: {ajouter: (c, x) => { assert.equal(c, 'en'); Object.assign(textes, x.textes); }}}});
  const cles = Object.keys(textes);
  assert.ok(cles.length >= 280, `${cles.length} textes`);
  const f = x => [String(x.match(/\{\w+\}/g) || []), String((x.match(/<\d+\/?>/g) || []).sort())];
  for (const k of cles) assert.deepEqual(f(textes[k]), f(k), k);
  for (const k of ['<1>NutriBoost</1> est une boutique en ligne de compléments alimentaires.', 'Qu’est-ce qu’une table dans une base de données ?',
    'Le nom complet d’une colonne : table.colonne', 'Les {1} clients, avec {2} colonnes', 'Order {1}'.replace('Order', 'Commande'), 'À toi !', 'clients', 'prenom'])
    assert.ok(k in textes, k);
  assert.equal(textes['nom'], 'last_name');
  assert.ok(page.includes('<i class="v" data-en="name">nom</i>'), 'le nom d’un produit : name');
  assert.ok(!/[«»]|\s[:;?!]/.test(Object.values(textes).join('\n').replace(/\{\d+\}/g, 'X')), 'la typographie anglaise : ni guillemets français ni espace avant la ponctuation');
});

test('la vidéo du module 1 : ses largeurs en anglais, son badge et sa vignette en anglais, préchargés', () => {
  assert.ok(page.includes("const EN = typeof window !== 'undefined' && !!window.REQUETE_LANGUE && window.REQUETE_LANGUE.code === 'en';"));
  for (const k of ['html[lang="en"] .xrw{grid-template-columns:52px 148px 143px 214px 218px 80px 67px}', 'html[lang="en"] #c3{--g:var(--w0) 160px 152px 1fr !important}',
    'html[lang="en"] #pan6{--k1:204px;--k2:190px}', "'--w1': EN ? '200px' : '156px', '--w2': EN ? '186px' : '172px'", 'data-en-src="badge-nutriboost-en.webp"'])
    assert.ok(page.includes(k), k);
  for (const f of ['assets/anim/badge-nutriboost-en.webp', 'assets/anim/en/bases-relationnelles-thumb.webp', 'assets/anim/en/bases-relationnelles.js?v=1']) {
    assert.ok(fs.statSync(path.join(ROOT, f.split('?')[0])).size > 1000, f);
    assert.ok(sw.includes(`'./${f}'`), `préchargé : ${f}`);
  }
  assert.ok(app.includes("const LV_VIGNETTES={en:['bases-relationnelles',") && app.includes('<img src="${lvVignette(v)}" alt="" decoding="async">'));
});

test('l’écran de la leçon et son lecteur en anglais', () => {
  const {L} = anglais();
  for (const [fr, en] of [['Leçon 1 sur 1', 'Lesson 1 of 1'], ['Module 1 · Introduction', 'Module 1 · Introduction'], ['Module 5 · Jointures', 'Module 5 · Joins'],
    ['Regarder la vidéo · 10 min 48', 'Watch the video · 10 min 48'], ['réussis au moins 4 exercices sur 5', 'get at least 4 of 5 exercises right'],
    ['À toi · 2/5', 'Your turn · 2/5'], ['Leçon terminée !', 'Lesson complete!'], ['À toi :', 'Your turn:']])
    assert.equal(L.t(fr), en, fr);
  assert.ok(app.includes("function lvGateDeco(l){ return `<i class=\"ls-gate-x\" aria-hidden=\"true\" data-notrad>"), 'les pastilles du bouton hors de la phrase');
  assert.ok(app.includes("window.REQUETE_LANGUE.valeur('lecon',()=>typeof current!=='undefined'&&current&&mode==='lesson'&&current.titre||'')"));
});

test('la voix anglaise du module 1 : prête pour generer.mjs --langue en, fichier pour fichier avec le français', () => {
  const gen = lire('tools/voix/generer.mjs');
  for (const k of ["const LANGUE = opt('--langue');", "const JOBS = LANGUE ? path.join(DIR, LANGUE) : DIR, SORTIE = LANGUE ? path.join(DIR, 'sortie', LANGUE) : path.join(DIR, 'sortie');",
    "const jobs = fs.readdirSync(JOBS).filter(f => f.endsWith('.json'));", "x.cours, '--oui', ...(LANGUE ? ['--langue', LANGUE] : [])"])
    assert.ok(gen.includes(k), k);
  const fr = JSON.parse(lire('tools/voix/bases-relationnelles.json')), en = JSON.parse(lire('tools/voix/en/bases-relationnelles.json'));
  assert.equal(en.langue, 'en'); assert.equal(en.cours, 'bases-relationnelles'); assert.equal(en.modele, fr.modele);
  assert.ok(en.voix && en.voix.id && en.voix.nom);
  assert.deepEqual(en.elements.map(e => e.id), fr.elements.map(e => e.id), 'les mêmes fichiers, dans le même ordre');
  const caps = [...page.matchAll(/\["(v[0-9a-z]+)","(ch[0-9a-z]+)",/g)].map(m => [m[1], m[2]]);
  for (const e of en.elements) {
    assert.ok(!/[éèàçùâêîôû«»]/.test(e.texte), `${e.id} : en anglais`);
    if (!e.cles) continue;
    assert.deepEqual(e.cles, caps.filter(c => c[1] === e.id).map(c => c[0]), `${e.id} : les légendes de son fichier, dans l’ordre`);
    assert.equal(e.phrases.length, e.cles.length);
  }
  const total = en.elements.reduce((a, e) => a + e.texte.length, 0);
  assert.ok(total > 7000 && total < 10000, `${total} caractères (autant de crédits)`);
});

test('le module 2 commence : AS et DISTINCT en anglais (textes, vignettes) ; le code d’une ligne prend la table de son éditeur', () => {
  for (const c of ['as', 'distinct']) {
    const pg = lire(`assets/anim/${c}.html`), src = lire(`assets/anim/en/${c}.js`), textes = {};
    assert.ok(pg.includes(`<script src="../../langues.js?v=4" data-textes="{langue}/${c}.js?v=1"></script>`), c);
    vm.runInNewContext(src, {window: {REQUETE_LANGUE: {ajouter: (l, x) => Object.assign(textes, x.textes)}}});
    assert.ok(Object.keys(textes).length > 100, `${c} : ${Object.keys(textes).length} textes`);
    const f = x => [String(x.match(/\{\w+\}/g) || []), String((x.match(/<\d+\/?>/g) || []).sort())];
    for (const k in textes) assert.deepEqual(f(textes[k]), f(k), `${c} : ${k}`);
    for (const g of [`'./assets/anim/en/${c}.js?v=1'`, `'./assets/anim/en/${c}-thumb.webp'`]) assert.ok(sw.includes(g), g);
    assert.ok(fs.statSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)).size > 10000);
  }
  assert.ok(app.includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct']};"));
  const {L} = anglais();
  assert.equal(L.sql('SELECT nom AS "Nom du produit",', 'SELECT nom AS "Nom du produit", prix FROM produits;'), 'SELECT name AS "Product name",', 'la table de l’éditeur, l’alias traduit');
  assert.equal(L.sql('nom', 'produits'), 'name');
  assert.equal(L.sql('nom'), 'last_name');
  assert.ok(app.includes('["📍","Il se place <b>juste après la colonne</b> :",null,"nom AS \\"Nom du produit\\"","produits"]'), 'le code du bilan de AS : sa table');
  assert.ok(MOTEUR.includes("((el.getAttribute && el.getAttribute('data-table')) || '')"));
});
