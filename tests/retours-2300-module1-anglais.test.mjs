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
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const MOTEUR = lire('langues.js'), EN = lire('langue-en.js'), app = lire('index.html'), sw = lire('sw.js');
const core = lire('assets/anim/core.js'), where = lire('assets/anim/where.html'), page = lire('assets/anim/bases-relationnelles.html'), PAGE_EN = lire('assets/anim/en/bases-relationnelles.js');

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
  for (const k of ["if (el.nodeName === 'CODE') codeSql(el);", "if (n.nodeName === 'CODE' && !surPlace(n)) codeSql(n);", 'try { if (API.autreBase && API.autreBase()) return; } catch (e) {}',
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
  assert.ok(app.includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct',"));
  const {L} = anglais();
  assert.equal(L.sql('SELECT nom AS "Nom du produit",', 'SELECT nom AS "Nom du produit", prix FROM produits;'), 'SELECT name AS "Product name",', 'la table de l’éditeur, l’alias traduit');
  assert.equal(L.sql('nom', 'produits'), 'name');
  assert.equal(L.sql('nom'), 'last_name');
  assert.ok(app.includes('["📍","Il se place <b>juste après la colonne</b> :",null,"nom AS \\"Nom du produit\\"","produits"]'), 'le code du bilan de AS : sa table');
  assert.ok(MOTEUR.includes("var porte = el.closest ? el.closest('[data-table]') : null;"));
});

/* Elisa, 15 novembre : « fait la suite du module 2 entier ». Les dix autres vidéos du module 2 (WHERE à LIMIT et OFFSET) en anglais,
   avec ce qu’elles ont appris au moteur : le contexte d’une ligne déjà traduite, un prix seul, la table d’une page entière, les
   éditeurs trop étroits pour les noms anglais, les cartes et les réglages des moments, les étiquettes des choix en texte. */
const M2 = ['where', 'comparer', 'and-or', 'not', 'null', 'like', 'in', 'between', 'order-by', 'limit-offset'];
const textesDe = c => { const t = {}; vm.runInNewContext(lire(`assets/anim/en/${c}.js`), {window: {REQUETE_LANGUE: {ajouter: (l, x) => { assert.equal(l, 'en'); Object.assign(t, x.textes); }}}}); return t; };

test('le module 2 en entier : chaque vidéo charge ses textes anglais, gardés nombre pour nombre, avec sa vignette, préchargés', () => {
  /* Un mois peut revenir deux fois en anglais (« before July 14 and after July 20 ») : on compare les marques présentes */
  const f = x => [String([...new Set(x.match(/\{\w+\}/g) || [])].sort()), String((x.match(/<\d+\/?>/g) || []).sort())];
  for (const c of M2) {
    const pg = lire(`assets/anim/${c}.html`), textes = textesDe(c);
    assert.ok(pg.includes(`<script src="../../langues.js?v=4" data-textes="{langue}/${c}.js?v=1"></script>`), c);
    assert.ok(Object.keys(textes).length > 120, `${c} : ${Object.keys(textes).length} textes`);
    for (const k in textes) assert.deepEqual(f(textes[k]), f(k), `${c} : ${k}`);
    for (const v of Object.values(textes)) assert.ok(!/[«»]|\s[:;?!](?!\S)/.test(v.replace(/\{\w+\}/g, 'X')), `${c} : la typographie anglaise : ${v}`);
    for (const g of [`'./assets/anim/en/${c}.js?v=1'`, `'./assets/anim/en/${c}-thumb.webp'`]) assert.ok(sw.includes(g), g);
    assert.ok(fs.statSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)).size > 10000, c);
  }
  assert.ok(app.includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct'," + M2.map(c => `'${c}'`).join(',') + ','));
  assert.ok(where.includes("if (LG && LG.ecrireCode) document.querySelectorAll('.ln,.codepill,.rq,.tye,.m,code').forEach(el => LG.ecrireCode(el));"), 'WHERE a son propre moteur');
});

test('le module 2 : les histoires gardent leur sens en anglais', () => {
  const b = textesDe('between'), o = textesDe('order-by'), l = textesDe('limit-offset');
  assert.equal(b['Merci !'], 'Thank you!', 'la confirmation dans la bonne langue');
  assert.ok(b['Nous leur renverrons la bonne confirmation, en français.'].endsWith('in English.'));
  assert.equal(o['ORDER BY en action'], 'ORDER BY in action');
  assert.equal(l['LIMIT en action'], 'LIMIT in action');
  assert.equal(l['rien'], 'nothing');
  assert.ok(lire('assets/anim/order-by.html').includes('<b data-en="2nd">2e</b>') && lire('assets/anim/order-by.html').includes('<b data-en="3rd">3e</b>'));
  for (const c of M2) assert.equal(textesDe(c)['0 ligne'], '0 rows', c);
  const {L} = anglais();
  assert.equal(L.t('À retenir'), 'Key takeaways', 'le dernier chapitre de chaque vidéo');
});

test('le code en anglais : une ligne prend sa table même déjà traduite, la table d’une page entière, un nom seul hors des tables', () => {
  const {L} = anglais();
  assert.equal(L.sql(' nom, stock', 'SELECT nom, stock FROM produits'), ' name, stock');
  assert.equal(L.sql(' nom, stock', 'SELECT nom, stock FROM products'), ' name, stock', 'la ligne FROM déjà passée en anglais');
  assert.equal(L.sql('OFFSET = (n − 1) × taille'), 'OFFSET = (n − 1) × size');
  assert.ok(MOTEUR.includes("var contexte = dt + ' ' + morceaux.join(' ');"), 'les lignes d’un éditeur, séparées (« stock» puis «FROM produits »)');
  for (const c of ['comparer', 'order-by', 'limit-offset']) assert.ok(lire(`assets/anim/${c}.html`).includes('<body data-table="produits">'), c);
});

test('un prix seul se traduit (« 39,90 € » : « €39.90 ») ; les fiches du module 2 en anglais', () => {
  const {L} = anglais();
  assert.equal(L.t('39,90 €'), '€39.90');
  assert.equal(L.t('3 842,00 €'), '€3,842.00');
  assert.ok(MOTEUR.includes("return /[A-Za-zÀ-ÿ]{2}/.test(s) || /\\d\\s?€/.test(s) ||"));
  for (const [fr, en] of [['sert à <1>filtrer les lignes</1> selon une condition.', 'is used to <1>filter rows</1> based on a condition.'],
    ['<1>range</1> le résultat selon une colonne.', '<1>sorts</1> the result by a column.'],
    ['Une pagination demande un <1>classement stable</1> : termine <2/> par une colonne unique comme <3/>.', 'Pagination needs a <1>stable ranking</1>: end <2/> with a unique column like <3/>.']])
    assert.equal(L.t(fr), en, fr);
  assert.equal(L.t('Leçon verrouillée'), 'Lesson locked');
  assert.equal(L.t('Valider'), 'Confirm');
  assert.ok(app.includes("window.REQUETE_LANGUE.valeur('etape',()=>cle.titre||'')"), 'la prochaine étape, traduite comme un titre de leçon');
});

test('les vidéos dans une autre langue : éditeurs ajustés, cartes et réglages des moments écrits pour la base, étiquettes en texte', () => {
  const moments = lire('assets/anim/moments.js');
  for (const src of [core, where]) {
    for (const k of ["const momentCtx = p => [(document.body && document.body.getAttribute('data-table')) || ''",
      'const trTxt = (s, ctx) => {', "return r !== x ? r : LG.sql ? LG.sql(x, ctx || '') : x;",
      'options: (p.options || []).map(o => ({label: trTxt(o.label, momentCtx(p)),',
      "choices: c.choices || null, ...(LG ? {labels: choixLabels(c, p)} : {}), code: !!c.code, unit: LG && c.unit ? trT(c.unit) : c.unit || ''",
      "b.querySelectorAll('.ln').forEach(l => { const r = document.createRange(); r.selectNodeContents(l); large = Math.max(large, r.getBoundingClientRect().width); });"])
      assert.ok(src.includes(k), k);
  }
  assert.ok(core.includes('    smsFit();\n    codeFit();\n'));
  assert.ok(moments.includes("const code = el => { if (el && typeof LG !== 'undefined' && LG && LG.ecrireCode) el.querySelectorAll('.mb-q').forEach(q => LG.ecrireCode(q)); };"));
  assert.ok(moments.includes('P[i].show(s, X.board); code(X.board);') && moments.includes('code(d); }'));
  assert.ok(app.includes('${esc(String(c.labels&&c.labels[j]!=null?c.labels[j]:v))}</button>'), 'le lecteur montre l’étiquette, la page juge la valeur');
  assert.ok(lire('assets/anim/bases-relationnelles.html').includes('html[lang="en"] .qdemo .codepill{font-size:46px}'));
});

test('la voix anglaise du module 2 : un fichier par vidéo, la même voix, les mêmes ids, le code dit en toutes lettres', () => {
  const br = JSON.parse(lire('tools/voix/en/bases-relationnelles.json'));
  let total = 0;
  for (const c of ['as', 'distinct', ...M2]) {
    const fr = JSON.parse(lire(`tools/voix/${c}.json`)), en = JSON.parse(lire(`tools/voix/en/${c}.json`));
    assert.equal(en.langue, 'en'); assert.equal(en.cours, c); assert.deepEqual(en.voix, br.voix, c); assert.equal(en.modele, fr.modele);
    const ids = fr.elements.map(e => e.id);
    assert.deepEqual(en.elements.map(e => e.id), ids.filter(i => en.elements.some(e => e.id === i)), `${c} : l’ordre du français`);
    for (const e of en.elements) {
      const t = e.texte.replace(/^\[\w+\]\s*/, '');
      assert.ok(t.length > 3, `${c} ${e.id} : vide`);
      assert.ok(!/[«»<>≠→⇔]|&[a-z]+;|\b(SELECT|FROM|WHERE|ORDER BY|LIMIT|OFFSET|BETWEEN|LIKE|DISTINCT|DESC|ASC)\b|'\d{4}-/.test(t), `${c} ${e.id} : ${t}`);
      if (e.cles) assert.equal(e.phrases.length, e.cles.length, `${c} ${e.id}`);
    }
    total += en.elements.reduce((a, e) => a + e.texte.length, 0);
  }
  assert.ok(!JSON.parse(lire('tools/voix/en/where.json')).elements.some(e => e.id === 'ch07'), 'le « À retenir » de WHERE n’est plus joué dans l’appli');
  assert.ok(total > 28000 && total < 36000, `${total} caractères (autant de crédits)`);
});

/* Elisa, 15 novembre, 1 h 06 : « fini » (la voix anglaise des modules 1 et 2, générée sur son Mac). integrer.mjs --langue en la
   découpe phrase par phrase sur les légendes françaises (cles), la range dans assets/voix/en/<cours>/ et l’écrit dans le fichier
   de la vidéo traduite ; la page, sa voix française et ses fichiers ne changent pas. */
test('la voix anglaise des modules 1 et 2 : chaque vidéo a la sienne, calée sur ses légendes, fichiers présents', () => {
  const integ = lire('tools/voix/integrer.mjs');
  for (const k of ["const LI = process.argv.indexOf('--langue'), LANGUE = LI >= 0 ? process.argv[LI + 1] : null;",
    "const job = JSON.parse(fs.readFileSync(path.join(DIR, LANGUE || '', cours + '.json'), 'utf8'));",
    "const OUT = path.join(ROOT, 'assets', 'voix', LANGUE || '', cours);",
    "if (cle && CLES.has(cle)) caps.push([cle, el.id].concat(clips[k]));", 'if (!LANGUE) fs.writeFileSync(PAGE, out);'])
    assert.ok(integ.includes(k), k);
  assert.ok(lire('tools/voix/atoi-lib.mjs').includes('/toi|turn/i.test(txt.slice(0, k))'), '« Your turn! » se coupe comme « À toi ! »');
  const ctx = vm.createContext({location: {search: ''}, URLSearchParams, gsap: {config() {}, timeline: () => ({})}, document: {}});
  vm.runInContext(core, ctx);
  const vkey = vm.runInContext('vkey', ctx);
  for (const c of ['bases-relationnelles', 'as', 'distinct', ...M2]) {
    let voix = null;
    vm.runInNewContext(lire(`assets/anim/en/${c}.js`), {window: {REQUETE_LANGUE: {ajouter: (l, x) => { if (x.voix) voix = x.voix; }}}});
    assert.ok(voix, `${c} : sa voix`);
    assert.equal(voix.dir, `../voix/en/${c}/`);
    const pg = lire(`assets/anim/${c}.html`), src = pg.slice(pg.indexOf('const CAPTIONS = ['), pg.indexOf('\n];', pg.indexOf('const CAPTIONS = [')) + 3);
    const caps = vm.runInNewContext(src.replace('const CAPTIONS =', 'CAPTIONS =') + ';CAPTIONS', {APP: true, CAPTIONS: null});
    const cles = new Set(caps.map(x => vkey(x[2])));
    assert.ok(voix.caps.length >= caps.length - 2 && voix.caps.every(x => cles.has(x[0])), `${c} : ${voix.caps.length} phrases sur ${caps.length} légendes`);
    for (const f of new Set([voix.intro[0], ...voix.caps.map(x => x[1]), ...Object.values(voix.say).map(x => x[0])]))
      assert.ok(fs.statSync(path.join(ROOT, `assets/voix/en/${c}/${f}.mp3`)).size > 5000, `${c}/${f}.mp3`);
    for (const k of ['bienvu', 'rattrape', 'presque', 'finbravo', 'fineffort', 'at1']) assert.ok(voix.say[k], `${c} : ${k}`);
    assert.ok(pg.includes('const VOICE = {dir: \'../voix/' + c + '/\''), `${c} : la voix française reste dans la page`);
  }
  assert.ok(app.includes("const LV_DUREES={en:{'bases-relationnelles':'10 min 41',") && app.includes("if(k&&d[k[1]])l.video.duree=d[k[1]];"), 'la durée de la vidéo anglaise');
});

/* Elisa, 15 novembre, 1 h 25 : « la page tu nous aides à améliorer Requête est pas trad ». Les pages de l’onboarding ajoutées le
   14 novembre après la traduction de l’interface (les statistiques, les widgets, le témoignage lu) et la première requête, écrite
   pour la base anglaise (customers, first_name, city) et exécutée sur elle. */
test('l’onboarding ajouté le 14 novembre en anglais, et sa première requête sur la base anglaise', () => {
  const {L} = anglais();
  for (const [fr, en] of [['Tu nous aides à <1>améliorer</1> Requête ?', 'Will you help us <1>improve</1> Requête?'], ['Oui, avec plaisir', 'Yes, happy to'],
    ['Non merci', 'No thanks'], ['Requête sur ton<1/><2>écran d’accueil</2>', 'Requête on your<1/><2>Home Screen</2>'], ['Pas maintenant', 'Not now'],
    ['C’est fait !', 'Done!'], ['Requête réussie', 'Query succeeded'], ['3 séances sur les 6 prochains jours', '3 sessions over the next 6 days'], ['demain', 'tomorrow']])
    assert.equal(L.t(fr), en, fr);
  assert.ok(L.t('Avis de Sofia B., Data Analyst junior, septembre 2026 : « J’ai décroché mon premier poste dans la data 🥹 ! Requête m’a énormément aidée à apprendre SQL mais surtout à pratiquer. J’ai beaucoup utilisé les entraînements aux entretiens avant mes candidatures et certaines questions étaient très proches de ce qu’on m’a demandé en entretien. Aujourd’hui je suis Data Analyst, donc forcément je recommande ! » Un vrai avis, recueilli sur le site requeteapp.com.')
    .startsWith('Review from Sofia B., Junior Data Analyst, September 2026, translated from French:'));
  assert.equal(L.sql("SELECT id, prenom, ville FROM clients WHERE ville = 'Paris' ORDER BY id;", 'clients'), "SELECT id, first_name, city FROM customers WHERE city = 'Paris' ORDER BY id;");
  assert.equal(L.sql('prenom, ville\n', 'clients'), 'first_name, city\n');
  for (const k of ["function obSqlL(t){try{const L=window.REQUETE_LANGUE;return L&&L.code!=='fr'?L.sql(t,'clients'):t;}catch(e){return t;}}",
    "OB_DEMO_TOKENS.map(([t,c])=>[c==='o'?obSqlL(t):t,c])", `db.exec(obSqlL("SELECT id, prenom, ville FROM clients WHERE ville = 'Paris' ORDER BY id;"))`,
    "--n:${7+obSqlL('id, prenom, ville').length}", "--n:${17+obSqlL('ville').length}", 'aria-label="${escAttr(obJoursLabel(nWeek,joursOn))}"'])
    assert.ok(app.includes(k), k);
});

/* Elisa, 15 novembre, 1 h 49 : « fais attention dans l’onboarding. Beaucoup de phrases en français encore, et la voix de Sofia, et la
   requête en français (SELECT prenom) ; la femme a un accent indien, je veux 6u6JbqKdaQy89ENzLSju ».
   Le paywall et l’offre de bienvenue : les phrases qui portent un montant ou une date se traduisent par leur gabarit (obPh) et
   s’écrivent avec les montants de la langue (« €44.99 », « $39.99 ») ; en français, au caractère près celles d’avant. Le rappel :
   les jours dans la langue. La voix anglaise des vidéos : Brielle ; l’avis de Sofia B. : sa voix anglaise à générer (avis.json). */
test('l’onboarding entier en anglais : le paywall, l’offre de bienvenue, le rappel ; la voix Brielle et l’avis de Sofia B.', () => {
  const debut = app.indexOf('function obLangue(){'), fin = app.indexOf('\n}', app.indexOf('function obEuros(x){')) + 2;
  const bloc = app.slice(debut, fin);
  const fr = vm.createContext({window: {}, Intl, Object, String});
  vm.runInContext(bloc, fr);
  assert.equal(vm.runInContext('obEuros(44.99)', fr), '44,99 €');
  assert.equal(vm.runInContext('obMoins(86)', fr), '−86&nbsp;%');
  assert.equal(vm.runInContext('obNt()', fr), '');
  assert.equal(vm.runInContext("obPh('{essai}, puis {prix} {par} à partir du {date}.',{essai:'3 jours d’essai',prix:'44,99 €',par:'par an',date:'18 novembre'})", fr),
    '3 jours d’essai, puis 44,99 € par an à partir du 18 novembre.');
  const {L} = anglais();
  const en = vm.createContext({window: {REQUETE_LANGUE: L}, Intl, Object, String});
  vm.runInContext(bloc, en);
  assert.equal(vm.runInContext('obEuros(44.99)', en), '€44.99');
  assert.equal(vm.runInContext('obMoins(86)', en), '−86%');
  assert.equal(vm.runInContext('obNt()', en), ' data-notrad');
  assert.equal(vm.runInContext("obPh('{essai}, puis {prix} {par} à partir du {date}.',{essai:obPh('3 jours d’essai'),prix:'$39.99',par:obPh('par an'),date:'November 18'})", en),
    '3-day trial, then $39.99 per year starting November 18.');
  assert.equal(vm.runInContext("obPh('{prix} aujourd’hui, puis {quand}.',{prix:'$4.99',quand:obPh('chaque semaine')})", en), '$4.99 today, then every week.');
  assert.equal(vm.runInContext("obPh('<em>−{pct}&nbsp;%</em> sur ta première année',{pct:50})", en), '<em>50% off</em> your first year');
  for (const [f, e] of [['Choisis ton offre', 'Choose your plan'], ['Paiement Apple', 'Paid via Apple'], ['Données protégées', 'Data protected'],
    ['Renouvellement automatique, sauf annulation 24 h avant (réglages Apple).', 'Renews automatically unless canceled at least 24 hours before (Apple settings).'],
    ['Conditions d’utilisation', 'Terms of Use'], ['Tu nous quittes déjà ?', 'Leaving already?'], ['J’en profite à −50 %', 'Claim my 50% off'],
    ['Activé · {jours} à {heure}', 'On · {jours} at {heure}'], ['Prochain rappel : {quand}.', 'Next reminder: {quand}.'], ['{a} et {b}', '{a} and {b}'],
    ['Écouter l’avis de Sofia B.', 'Play Sofia B.’s review'], ['Mettre en pause l’avis d’Aminata C.', 'Pause Aminata C.’s review'], ['0:05 sur 0:18', '0:05 of 0:18'], ['Me rappeler à 19 h 30', 'Remind me at 19:30']])
    assert.equal(L.t(f), e, f);
  for (const k of ["const prixHtml=k=>`<span class=\"pw-o-p\"${obNt()}><b>${obPrixTexte(k)}</b> ${obPh(sur(OB_OFFRES[k].par))}</span>`;",
    "`<b class=\"pw-sans\"${obNt()}>${obPh('{essai}, puis {prix} {par} à partir du {date}.',",
    "const zero=(ba&&obDevise(0,ba.devise,true))||(obLangue()?obEuros(0):'0&nbsp;€');",
    "try{return new Intl.NumberFormat(obLoc(),Object.assign({style:'currency',currency:devise}",
    "<span class=\"pw-confiance\"${obNt()}><span>${PW_ICO.cadenas}${obPh('Paiement Apple')}</span>",
    "${obLangue()?obPh('Conditions d’utilisation'):'Conditions'}</a>",
    "const t=n.length>1?obPh('{a} et {b}',{a:n.slice(0,-1).join(', '),b:n[n.length-1]}):(n[0]||'');",
    "if(L&&L.code&&L.code!=='fr'&&L.locale)return [0,1,2,3,4,5,6].map(d=>new Date(2024,0,7+d).toLocaleDateString(L.locale,{weekday:'narrow'}));",
    "const OB_TEMOINS_LANGUE={", "if(x)OB_TEMOINS.forEach(r=>{if(x[r.prenom])Object.assign(r,x[r.prenom]);});"])
    assert.ok(app.includes(k), k);
  assert.ok(MOTEUR.includes("var ATTRIBUTS = ['placeholder', 'aria-label', 'title', 'alt', 'aria-valuetext'];"), 'le temps lu de l’avis audio');
  /* La voix des vidéos anglaises : Brielle, partout ; l’avis de Sofia B. : Jeni, une voix à part */
  let total = 0;
  for (const c of ['bases-relationnelles', 'as', 'distinct', ...M2]) {
    const j = JSON.parse(lire(`tools/voix/en/${c}.json`));
    assert.deepEqual(j.voix, {id: '6u6JbqKdaQy89ENzLSju', nom: 'Brielle'}, c);
    total += j.elements.reduce((s, e) => s + e.texte.length, 0);
  }
  const avis = JSON.parse(lire('tools/voix/en/avis.json'));
  assert.equal(avis.langue, 'en'); assert.equal(avis.cours, 'avis'); assert.equal(avis.elements.length, 1);
  assert.equal(avis.elements[0].id, 'sofia-b'); assert.ok(avis.elements[0].texte.startsWith('[excited] I landed my first job in data!'));
  assert.notEqual(avis.voix.id, '6u6JbqKdaQy89ENzLSju');
  total += avis.elements[0].texte.length;
  assert.ok(total > 38000 && total < 45000, `${total} caractères`);
  /* 15 novembre, 2 h 32 : « fini ». Les treize vidéos parlent avec Brielle (fichiers de assets/voix/en/ refaits, durées et
     vignettes recalculées) ; l’avis de Sofia B. a sa voix anglaise, sa durée et sa forme d’onde. */
  assert.ok(fs.statSync(path.join(ROOT, 'decouvrir/avis/en/sofia-b.mp3')).size > 100000, 'l’avis de Sofia B. en anglais');
  assert.ok(app.includes("const OB_TEMOINS_LANGUE={en:{'Sofia B.':{audio:'decouvrir/avis/en/sofia-b.mp3',duree:17.2,"));
  const onde = /onde:\[([^\]]*)\]\}\}\};/.exec(app.slice(app.indexOf('const OB_TEMOINS_LANGUE=')));
  assert.ok(onde && onde[1].split(',').length === 48 && onde[1].split(',').every(v => +v >= 0.12 && +v <= 1), 'quarante-huit barres, comme le français');
  assert.ok(app.includes("'limit-offset':'3 min 56',"), 'les durées des vidéos avec la voix de Brielle');
  /* 2 h 47 (« j’ai toujours l’ancienne voix ») : refaite sous les mêmes noms, la voix restait celle d’avant dans les caches. Les
     fichiers se demandent sous ?v=<version>, tirée de leur contenu : une voix refaite a une autre adresse. */
  const vsrc = "  const src = f => new URL((VCFG.dir || '') + f + '.mp3' + (VCFG.v ? '?v=' + VCFG.v : ''), location.href).href;";
  assert.equal(core.split(vsrc).length, 3, 'core.js'); assert.equal(where.split(vsrc).length, 3, 'where.html');
  assert.ok(lire('tools/voix/integrer.mjs').includes("const VER = HV.digest('hex').slice(0, 8);"));
  for (const c of ['bases-relationnelles', 'as', 'distinct', ...M2]) {
    const HV = crypto.createHash('sha1'), OUT = path.join(ROOT, 'assets/voix/en', c);
    for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.mp3')).sort()) { HV.update(f); HV.update(fs.readFileSync(path.join(OUT, f))); }
    assert.ok(lire(`assets/anim/en/${c}.js`).includes(`{voix: {dir: '../voix/en/${c}/', v: '${HV.digest('hex').slice(0, 8)}',`), `${c} : la version de ses fichiers`);
  }
  /* 2 h 57 et 3 h (« on garde cette voix et cette photo pour tous les modules », « je parle de la blonde ») : en anglais, Brielle et
     la photo de la formatrice blonde des modules 1 et 2 (formatrice.webp) dans toutes les vidéos ; l’onboarding n’annonce plus huit
     formateurs, mais sa formatrice. */
  assert.ok(lire('tools/voix/preparer-langue.mjs').includes("const [cours, voixId = '6u6JbqKdaQy89ENzLSju', voixNom = 'Brielle'] = process.argv.slice(2);"));
  assert.ok(lire('assets/anim/core.css').includes('html[lang="en"]:is(.tr-f,.tr-m) #cap .cap-stk{background:url(formatrice.webp) 50% 0/134px 134px no-repeat,'));
  assert.ok(app.includes("montres=OB_FORMATEURS.slice(0,seule?1:4);") && app.includes("${seule?'<b>Ta formatrice</b> te fera progresser':`<b>${OB_FORMATEURS.length} formateurs</b> te feront progresser`}"));
  assert.equal(anglais().L.t('<1>Ta formatrice</1> te fera progresser'), '<1>Your instructor</1> will help you progress');
});

/* Elisa, 15 novembre : « continue ». Le module 3 (Fonctions et expressions) en anglais : ses six vidéos (textes, code, mise en page,
   fiches, vignettes), et leur voix prête pour generer.mjs --langue en. Le code s’y dit comme on le lit (« two vertical bars »,
   « floor of price », « percent d, slash… »), comme la voix française ; le « Pour finir, voici les trois idées à retenir », coupé
   dans l’appli, n’est plus dans les fichiers à générer. En français, les six vidéos rendent exactement la même chose. */
const M3 = ['fonctions-texte', 'fonctions-numeriques', 'fonctions-dates', 'conversion-types', 'case', 'coalesce'];

test('le module 3 en entier : chaque vidéo charge ses textes anglais, gardés nombre pour nombre, avec sa vignette, préchargés', () => {
  const f = x => [String([...new Set(x.match(/\{\w+\}/g) || [])].sort()), String((x.match(/<\d+\/?>/g) || []).sort())];
  for (const c of M3) {
    const pg = lire(`assets/anim/${c}.html`), textes = textesDe(c);
    assert.ok(pg.includes(`<script src="../../langues.js?v=4" data-textes="{langue}/${c}.js?v=1"></script>`), c);
    assert.ok(Object.keys(textes).length > 150, `${c} : ${Object.keys(textes).length} textes`);
    for (const k in textes) assert.deepEqual(f(textes[k]), f(k), `${c} : ${k}`);
    /* « + ? points » : les points encore inconnus du ticket, pas une ponctuation française */
    for (const v of Object.values(textes)) assert.ok(!/[«»]|\s[:;?!](?!\S)/.test(v.replace(/\{\w+\}/g, 'X').replace('+ ? points', '')), `${c} : la typographie anglaise : ${v}`);
    for (const g of [`'./assets/anim/en/${c}.js?v=1'`, `'./assets/anim/en/${c}-thumb.webp'`]) assert.ok(sw.includes(g), g);
    assert.ok(fs.statSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)).size > 10000, c);
    assert.equal(textes['0 ligne'], '0 rows', c);
  }
  assert.ok(app.replace(/,\n\s*'/g, ",'").includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct'," + [...M2, ...M3].map(c => `'${c}'`).join(',') + ','));
  for (const [c, t] of [['fonctions-numeriques', 'produits'], ['case', 'produits'], ['fonctions-dates', 'commandes'], ['conversion-types', 'commandes'], ['coalesce', 'clients']])
    assert.ok(lire(`assets/anim/${c}.html`).includes(`<body data-table="${t}"`), c);
  const dates = lire('assets/anim/fonctions-dates.html'), texte = lire('assets/anim/fonctions-texte.html');
  assert.ok(dates.includes('<span data-en="D">J</span><span>+</span><span>7</span>'), 'J+7 : D+7');
  assert.ok(texte.includes('html[lang="en"] .rgT{grid-template-columns:236px 160px 1fr 186px}'), 'les colonnes de l’étiquette');
  const {L} = anglais();
  assert.equal(L.sql("SELECT nom, stock, CASE WHEN stock < 50 THEN 'À commander' WHEN stock < 100 THEN 'À surveiller' ELSE 'OK' END AS alerte FROM produits"),
    "SELECT name, stock, CASE WHEN stock < 50 THEN 'Reorder' WHEN stock < 100 THEN 'Watch' ELSE 'OK' END AS alert FROM products");
  assert.equal(L.sql("SELECT nom, COALESCE(email, 'Non renseigné') FROM clients"), "SELECT last_name, COALESCE(email, 'Not provided') FROM customers");
  for (const [fr, en] of [['Une <1>fonction par besoin</1> :', 'One <1>function per need</1>:'],
    ['renvoie la <1>première valeur qui n’est pas NULL</1> :', 'returns the <1>first value that isn’t NULL</1>:'],
    ['Sans <1/>, une ligne qui ne remplit aucune condition reçoit <2/>.', 'Without <1/>, a row that meets no condition gets <2/>.']])
    assert.equal(L.t(fr), en, fr);
});

test('la voix anglaise du module 3 : Brielle, les ids du français, le code dit comme on le lit, sans le « Pour finir » coupé dans l’appli', () => {
  const br = JSON.parse(lire('tools/voix/en/bases-relationnelles.json')), prep = lire('tools/voix/preparer-langue.mjs');
  assert.ok(prep.includes('if (cles.every(k => !D.caps[k] || D.caps[k] === D.caps0[k])) { horsAppli.push(el.id); continue; }'));
  const DIRE = new Function(prep.slice(prep.indexOf('const B = '), prep.indexOf('const parFichier')) + '\nreturn DIRE;')();
  for (const [x, dit] of [['Careful: with + instead of ||, the query returns 0.', 'Careful: with the plus sign instead of two vertical bars, the query returns 0.'],
    ['We multiply the function’s result: FLOOR(price) * 2 gives 58.', 'We multiply the function’s result: floor of price times 2 gives 58.'],
    ["The '%d/%m/%Y' format shows the date 2026-07-02 as 02/07/2026.", 'The percent d, slash, percent m, slash, percent capital Y format shows the date 2026, dash, 07, dash, 02 as 02, slash, 07, slash, 2026.'],
    ["Your turn! What does COALESCE('', 'Not provided') return?", 'Your turn! What does coalesce of an empty text and Not provided return?'],
    ["CAST(price AS INTEGER) drops the decimals, without rounding: 29.9 becomes 29.", 'cast price as integer drops the decimals, without rounding: 29.9 becomes 29.']])
    assert.equal(DIRE(x).replace(/^\w/, m => m.toLowerCase()), dit.replace(/^\w/, m => m.toLowerCase()), x);
  let total = 0;
  for (const c of M3) {
    const fr = JSON.parse(lire(`tools/voix/${c}.json`)), en = JSON.parse(lire(`tools/voix/en/${c}.json`));
    assert.equal(en.langue, 'en'); assert.equal(en.cours, c); assert.deepEqual(en.voix, br.voix, c); assert.equal(en.modele, fr.modele);
    const ids = fr.elements.map(e => e.id), chs = ids.filter(i => /^ch/.test(i));
    assert.deepEqual(en.elements.map(e => e.id), ids.filter(i => en.elements.some(e => e.id === i)), `${c} : l’ordre du français`);
    assert.ok(!en.elements.some(e => e.id === chs[chs.length - 1]), `${c} : le « Pour finir » n’est pas joué dans l’appli`);
    for (const e of en.elements) {
      const t = e.texte.replace(/^\[\w+\]\s*/, '');
      assert.ok(t.length > 3, `${c} ${e.id} : vide`);
      assert.ok(!/[«»<>=≠→⇔|+*%()_×−']|&[a-z]+;|Pour finir|idées à retenir|\b(SELECT|FROM|WHERE|UPPER|SUBSTR|INSTR|FLOOR|ROUND|CAST|COALESCE|STRFTIME|DATE|CASE|WHEN|THEN|ELSE|END|NULL|INTEGER)\b/.test(t), `${c} ${e.id} : ${t}`);
      if (e.cles) assert.equal(e.phrases.length, e.cles.length, `${c} ${e.id}`);
    }
    total += en.elements.reduce((a, e) => a + e.texte.length, 0);
  }
  assert.ok(total > 14000 && total < 18000, `${total} caractères (autant de crédits)`);
});

/* 15 novembre, 6 h 23 : « fini » (la voix anglaise du module 3, générée sur son Mac). Les six vidéos parlent avec Brielle : fichiers
   dans assets/voix/en/<cours>/, sous leur version ; durées (LV_DUREES) et vignettes recalculées. */
test('la voix anglaise du module 3 : intégrée, versionnée, durées et vignettes refaites', () => {
  for (const c of M3) {
    const HV = crypto.createHash('sha1'), OUT = path.join(ROOT, 'assets/voix/en', c);
    const mp3 = fs.readdirSync(OUT).filter(f => f.endsWith('.mp3')).sort();
    assert.ok(mp3.length > 15, `${c} : ${mp3.length} fichiers`);
    for (const f of mp3) { HV.update(f); HV.update(fs.readFileSync(path.join(OUT, f))); }
    assert.ok(lire(`assets/anim/en/${c}.js`).includes(`{voix: {dir: '../voix/en/${c}/', v: '${HV.digest('hex').slice(0, 8)}',`), `${c} : la version de ses fichiers`);
  }
  assert.ok(app.includes("'limit-offset':'3 min 56','fonctions-texte':'3 min 40','fonctions-numeriques':'2 min 51','fonctions-dates':'2 min 59','conversion-types':'3 min 08','case':'2 min 49','coalesce':'2 min 33'}};"));
});

/* Elisa, 15 novembre, 7 h 17 : « oui » (le module 4 après le module 3). Agrégats et regroupements : COUNT, SUM/AVG/MIN/MAX,
   GROUP BY, GROUP BY sur plusieurs colonnes, HAVING, l’ordre d’exécution, GROUP_CONCAT. Leurs alias passent dans la base anglaise
   (nb_clients : customer_count), le code des cartes (.mini, .cl) est récrit (codeSel), les dates des commandes se lisent mois/jour,
   le grand titre ORDRE devient ORDER ; la voix (Brielle) dit les agrégats comme on les lit (« count star », « A-V-G of price »). */
const M4 = ['count', 'agregats', 'group-by', 'group-by-colonnes', 'having', 'ordre-execution', 'group-concat'];

test('le module 4 en entier : chaque vidéo charge ses textes anglais, gardés nombre pour nombre, avec sa vignette, préchargés', () => {
  const f = x => [String([...new Set(x.match(/\{\w+\}/g) || [])].sort()), String((x.match(/<\d+\/?>/g) || []).sort())];
  for (const c of M4) {
    const pg = lire(`assets/anim/${c}.html`), textes = textesDe(c);
    assert.ok(pg.includes(`<script src="../../langues.js?v=4" data-textes="{langue}/${c}.js?v=1"></script>`), c);
    assert.ok(Object.keys(textes).length > 120, `${c} : ${Object.keys(textes).length} textes`);
    for (const k in textes) assert.deepEqual(f(textes[k]), f(k), `${c} : ${k}`);
    for (const v of Object.values(textes)) assert.ok(!/[«»]|\s[:;?!](?!\S)/.test(v.replace(/\{\w+\}/g, 'X')), `${c} : la typographie anglaise : ${v}`);
    for (const g of [`'./assets/anim/en/${c}.js?v=1'`, `'./assets/anim/en/${c}-thumb.webp'`]) assert.ok(sw.includes(g), g);
    assert.ok(fs.statSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)).size > 10000, c);
    assert.ok(/Course\(\{(codeSel: '[^']+', )?duration: DURATION,/.test(pg), c);
  }
  assert.ok(app.replace(/,\n\s*'/g, ",'").includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct'," + [...M2, ...M3, ...M4].map(c => `'${c}'`).join(',') + ','));
  for (const [c, t] of [['count', 'produits'], ['agregats', 'produits'], ['group-by', 'clients'], ['group-by-colonnes', 'commandes'], ['having', 'clients'], ['ordre-execution', 'commandes'], ['group-concat', 'commandes']])
    assert.ok(lire(`assets/anim/${c}.html`).includes(`<body data-table="${t}">`), c);
  for (const c of ['count', 'agregats', 'group-by', 'having', 'group-concat']) assert.ok(lire(`assets/anim/${c}.html`).includes("Course({codeSel: '.mini', duration: DURATION,"), c);
  const oe = lire('assets/anim/ordre-execution.html');
  assert.ok(oe.includes("Course({codeSel: '.mini, .cl, .vrow b', duration: DURATION,"));
  assert.ok(oe.includes('<span>O</span><span>R</span><span>D</span><span data-en="E">R</span><span data-en="R">E</span>'), 'ORDRE : ORDER');
  assert.ok(oe.includes('<b data-en="#${id}">n°${id}</b>'));
  assert.ok(lire('assets/anim/group-by-colonnes.html').includes('<b data-en="${m}/${j}">${j}/${m}</b>'), 'les dates des commandes, mois/jour');
  assert.ok(lire('assets/anim/agregats.html').includes('<span class="b" data-en="23.9875">23,9875</span>'));
  const {L} = anglais();
  for (const [fr, en] of [['SELECT ville, COUNT(*) AS nb_clients FROM clients GROUP BY ville', 'SELECT city, COUNT(*) AS customer_count FROM customers GROUP BY city'],
    ["SELECT produit_id, COUNT(*) AS nb_envois FROM commandes WHERE statut = 'expédiée' GROUP BY produit_id HAVING COUNT(*) >= 2 ORDER BY nb_envois DESC",
      "SELECT product_id, COUNT(*) AS shipment_count FROM orders WHERE status = 'shipped' GROUP BY product_id HAVING COUNT(*) >= 2 ORDER BY shipment_count DESC"],
    ['SELECT SUM(stock) AS stock_total, ROUND(AVG(prix), 2) AS prix_moyen, MIN(prix) AS prix_min, MAX(prix) AS prix_max FROM produits',
      'SELECT SUM(stock) AS total_stock, ROUND(AVG(price), 2) AS avg_price, MIN(price) AS min_price, MAX(price) AS max_price FROM products'],
    ['COUNT(colonne)', 'COUNT(column)']])
    assert.equal(L.sql(fr), en);
  const gbc = textesDe('group-by-colonnes');
  assert.equal(gbc['{1}/{2}, expédiée'], '{2}/{1}, shipped', 'jour/mois : mois/jour');
  assert.equal(gbc['{m1} et expédiée : <1>{1} commandes</1>.'], '{m1} and shipped: <1>{1} orders</1>.');
  for (const [fr, en] of [['compte <1>toutes les lignes</1>, même si certaines colonnes contiennent <2/>.', 'counts <1>all the rows</1>, even if some columns contain <2/>.'],
    [', <1/>, <2/>, <3/>, <4/>, <5/>, puis <6/>.', ', <1/>, <2/>, <3/>, <4/>, <5/>, then <6/>.'],
    ['Pour trier les valeurs dans chaque liste, place <1/> <2>à l’intérieur</2> de la fonction.', 'To sort the values in each list, put <1/> <2>inside</2> the function.']])
    assert.equal(L.t(fr), en, fr);
});

test('la voix anglaise du module 4 : Brielle, les ids du français, les agrégats dits comme on les lit', () => {
  const br = JSON.parse(lire('tools/voix/en/bases-relationnelles.json')), prep = lire('tools/voix/preparer-langue.mjs');
  const DIRE = new Function(prep.slice(prep.indexOf('const B = '), prep.indexOf('const parFichier')) + '\nreturn DIRE;')();
  for (const [x, dit] of [['Then COUNT(*) counts the ones left: the counter shows 2.', 'Then count star counts the ones left: the counter shows 2.'],
    ['With ROUND(AVG(price), 2), the average price becomes €23.99.', 'With round of A-V-G of price, 2, the average price becomes €23.99.'],
    ['For the categories, COUNT(category) gives 8: one per product.', 'For the categories, count of category gives 8: one per product.'],
    ["Your turn! What does GROUP_CONCAT(customer_id, ', ') return?", 'Your turn! What does group concat of customer underscore ID, comma space return?']])
    assert.equal(DIRE(x), dit, x);
  let total = 0;
  for (const c of M4) {
    const fr = JSON.parse(lire(`tools/voix/${c}.json`)), en = JSON.parse(lire(`tools/voix/en/${c}.json`));
    assert.equal(en.langue, 'en'); assert.equal(en.cours, c); assert.deepEqual(en.voix, br.voix, c); assert.equal(en.modele, fr.modele);
    const ids = fr.elements.map(e => e.id), chs = ids.filter(i => /^ch/.test(i));
    assert.deepEqual(en.elements.map(e => e.id), ids.filter(i => en.elements.some(e => e.id === i)), `${c} : l’ordre du français`);
    assert.ok(!en.elements.some(e => e.id === chs[chs.length - 1]), `${c} : le « Pour finir » n’est pas joué dans l’appli`);
    for (const e of en.elements) {
      const t = e.texte.replace(/^\[\w+\]\s*/, '');
      assert.ok(t.length > 3, `${c} ${e.id} : vide`);
      /* Les parenthèses restent dans une phrase (« Paris (4) and Lyon (2) ») ; celles du code sont dites (« count star ») */
      assert.ok(!/[«»<>=≠→⇔|+*%_×−']|\w\(|&[a-z]+;|Pour finir|idées à retenir|\b(SELECT|FROM|WHERE|COUNT|SUM|AVG|MIN|MAX|GROUP BY|HAVING|ORDER BY|GROUP_CONCAT|DISTINCT|NULL|DESC|ROUND)\b/.test(t), `${c} ${e.id} : ${t}`);
      if (e.cles) assert.equal(e.phrases.length, e.cles.length, `${c} ${e.id}`);
    }
    total += en.elements.reduce((a, e) => a + e.texte.length, 0);
  }
  assert.ok(total > 16000 && total < 20000, `${total} caractères (autant de crédits)`);
});

/* Elisa, 15 novembre, 7 h 51 : « prochain ». Le module 5 (Jointures) en anglais : dix vidéos. Le moteur a appris : les tables
   propres à une page (« Quel JOIN choisir ? » : medecins, bassins, livres… dans en/quel-join-choisir.js), un alias posé sur une
   autre carte (SELF JOIN : « c1.client_id »), les en-têtes de tableau et les cartes de code trop larges en anglais (thFit, .mini). */
const M5 = ['inner-join', 'left-join', 'right-join', 'full-outer-join', 'cross-join', 'jointure-3-tables', 'join-group-by', 'self-join', 'plusieurs-conditions-on', 'quel-join-choisir'];

test('le module 5 en entier : chaque vidéo charge ses textes anglais, gardés nombre pour nombre, avec sa vignette, préchargés', () => {
  const f = x => [String([...new Set(x.match(/\{\w+\}/g) || [])].sort()), String((x.match(/<\d+\/?>/g) || []).sort())];
  for (const c of M5) {
    const pg = lire(`assets/anim/${c}.html`), textes = textesDe(c);
    assert.ok(pg.includes(`<script src="../../langues.js?v=4" data-textes="{langue}/${c}.js?v=1"></script>`), c);
    assert.ok(Object.keys(textes).length > 120, `${c} : ${Object.keys(textes).length} textes`);
    for (const k in textes) assert.deepEqual(f(textes[k]), f(k), `${c} : ${k}`);
    for (const v of Object.values(textes)) assert.ok(!/[«»]|\s[:;?!](?!\S)/.test(v.replace(/\{\w+\}/g, 'X').replace('? points', '').replace('? rows', '').replace('? customer', '')), `${c} : la typographie anglaise : ${v}`);
    for (const g of [`'./assets/anim/en/${c}.js?v=1'`, `'./assets/anim/en/${c}-thumb.webp'`]) assert.ok(sw.includes(g), g);
    assert.ok(fs.statSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)).size > 10000, c);
    assert.ok(/<body data-table="(clients|produits|commandes)">/.test(pg), c);
  }
  assert.ok(app.replace(/,\n\s*'/g, ",'").includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct'," + [...M2, ...M3, ...M4, ...M5].map(c => `'${c}'`).join(',') + ','));
  const q = lire('assets/anim/quel-join-choisir.html');
  assert.ok(q.includes("Course({codeSel: '.qy, .tb2 .h, .gr.hd span', duration: DURATION,") && q.includes('html[lang="en"] #s0 .title span.sp{margin-right:0}'));
  assert.ok(lire('assets/anim/full-outer-join.html').includes('<span class="k" data-id="${id}" data-en="#${id}">n°${id}</span>'));
  /* Les tables des six cas, pour cette page seulement */
  const {L, ctx} = anglais();
  vm.runInNewContext(lire('assets/anim/en/quel-join-choisir.js'), ctx);
  assert.equal(L.sql('SELECT rendez_vous.patient, medecins.nom AS medecin FROM rendez_vous INNER JOIN medecins ON rendez_vous.medecin_id = medecins.id'),
    'SELECT appointments.patient, doctors.name AS doctor FROM appointments INNER JOIN doctors ON appointments.doctor_id = doctors.id');
  assert.equal(L.sql('SELECT s.nom, m.nom AS manager FROM salaries AS s JOIN salaries AS m ON s.manager_id = m.id'), 'SELECT s.name, m.name AS manager FROM employees AS s JOIN employees AS m ON s.manager_id = m.id');
  assert.ok(MOTEUR.includes("if (B && TRAD.base) ['tables', 'defauts', 'valeurs'].forEach("));
  /* Un alias posé ailleurs, un préfixe inconnu : la table du contexte */
  const {L: L2} = anglais();
  assert.equal(L2.sql(' c1.client_id = c2.client_id AND c1.date_commande = c2.date_commande', 'commandes FROM commandes AS c1 JOIN commandes AS c2'), ' c1.customer_id = c2.customer_id AND c1.order_date = c2.order_date');
  assert.equal(L2.sql(' t.nom', 'SELECT t.nom FROM (SELECT nom FROM clients) t'), ' t.last_name');
  assert.equal(L2.sql('SELECT COUNT(*) AS nombre_commandes FROM commandes'), 'SELECT COUNT(*) AS order_count FROM orders');
  /* En anglais, les en-têtes et les cartes de code trop larges prennent une police plus petite ; le français ne change pas */
  assert.ok(core.includes('const thFit = () => {\n  if (!LG) return;') && core.includes('    codeFit();\n    thFit();\n'));
  assert.ok(core.includes("  $$('.mini').forEach(m => {"));
  for (const [fr, en] of [['conserve <1>toutes les lignes de la table de gauche</1>, même sans correspondance dans la table de droite.', 'keeps <1>every row of the left table</1>, even with no match in the right table.'],
    ['Condition {1} : c’est le client de la commande. Condition {2} : il habite à Paris.'.replace('{1}', '1').replace('{2}', '2'), 'Condition 1: it’s the order’s customer. Condition 2: they live in Paris.']])
    assert.equal(L2.t(fr), en, fr);
  const sj = textesDe('self-join');
  assert.equal(sj['n°{1}'], '#{1}'); assert.equal(sj['client {1} · {2} {m1}'], 'customer {1} · {m1} {2}');
});

test('la voix anglaise du module 5 : Brielle, les ids du français, les jointures dites comme on les lit', () => {
  const br = JSON.parse(lire('tools/voix/en/bases-relationnelles.json')), prep = lire('tools/voix/preparer-langue.mjs');
  assert.ok(prep.includes("const M = (typeof MOMENTS !== 'undefined' ? MOMENTS : typeof PICKS !== 'undefined' ? PICKS : []).map("), 'les moments de « Quel JOIN choisir ? »');
  const DIRE = new Function(prep.slice(prep.indexOf('const B = '), prep.indexOf('const parFichier')) + '\nreturn DIRE;')();
  for (const [x, dit] of [['No customer matches it: INNER JOIN leaves it out of the result.', 'No customer matches it: inner join leaves it out of the result.'],
    ['Here it filters on products.name, a column of the third table.', 'Here it filters on products dot name, a column of the third table.'],
    ["Your turn! Where does WHERE products.name = 'Magnesium' go?", 'Your turn! Where does where products dot name equals Magnesium go?']])
    assert.equal(DIRE(x), dit, x);
  let total = 0;
  for (const c of M5) {
    const fr = JSON.parse(lire(`tools/voix/${c}.json`)), en = JSON.parse(lire(`tools/voix/en/${c}.json`));
    assert.equal(en.langue, 'en'); assert.equal(en.cours, c); assert.deepEqual(en.voix, br.voix, c); assert.equal(en.modele, fr.modele);
    const ids = fr.elements.map(e => e.id), chs = ids.filter(i => /^ch/.test(i));
    assert.deepEqual(en.elements.map(e => e.id), ids.filter(i => en.elements.some(e => e.id === i)), `${c} : l’ordre du français`);
    assert.ok(!en.elements.some(e => e.id === chs[chs.length - 1]), `${c} : le « Pour finir » n’est pas joué dans l’appli`);
    for (const e of en.elements) {
      const t = e.texte.replace(/^\[\w+\]\s*/, '');
      assert.ok(t.length > 3, `${c} ${e.id} : vide`);
      assert.ok(!/[«»<>=≠→⇔|+*%_×−']|\w\(|\w\.\w|&[a-z]+;|Pour finir|idées à retenir|\b(SELECT|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|CROSS|COUNT|GROUP BY|NULL|DISTINCT)\b/.test(t), `${c} ${e.id} : ${t}`);
      if (e.cles) assert.equal(e.phrases.length, e.cles.length, `${c} ${e.id}`);
    }
    total += en.elements.reduce((a, e) => a + e.texte.length, 0);
  }
  assert.ok(total > 25000 && total < 31000, `${total} caractères (autant de crédits)`);
});

/* Module 6 (« Sous-requêtes et ensembles », 15 novembre) : les dix vidéos en anglais, leur vignette, leur voix préparée (les prix
   à décimales, 46.72, se disent tels quels) */
const M6 = ['sous-requete-in', 'sous-requete-select', 'sous-requete-from', 'insert-select', 'exists', 'any-all', 'with-cte', 'union', 'intersect-except', 'with-recursive'];
test('le module 6 en entier : chaque vidéo charge ses textes anglais, gardés nombre pour nombre, avec sa vignette, préchargés', () => {
  const f = x => [String([...new Set(x.match(/\{\w+\}/g) || [])].sort()), String((x.match(/<\d+\/?>/g) || []).sort())];
  for (const c of M6) {
    const pg = lire(`assets/anim/${c}.html`), textes = textesDe(c);
    assert.ok(pg.includes(`<script src="../../langues.js?v=4" data-textes="{langue}/${c}.js?v=1"></script>`), c);
    assert.ok(Object.keys(textes).length > 120, `${c} : ${Object.keys(textes).length} textes`);
    for (const k in textes) assert.deepEqual(f(textes[k]), f(k), `${c} : ${k}`);
    for (const v of Object.values(textes)) assert.ok(!/[«»]|\s[:;?!](?!\S)/.test(v.replace(/\{\w+\}/g, 'X').replace('? points', '').replace('? rows', '')), `${c} : la typographie anglaise : ${v}`);
    for (const g of [`'./assets/anim/en/${c}.js?v=1'`, `'./assets/anim/en/${c}-thumb.webp'`]) assert.ok(sw.includes(g), g);
    assert.ok(fs.statSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)).size > 10000, c);
    assert.ok(/<body data-table="(clients|produits|commandes)">/.test(pg), c);
  }
  assert.ok(app.replace(/,\n\s*'/g, ",'").includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct'," + [...M2, ...M3, ...M4, ...M5, ...M6].map(c => `'${c}'`).join(',') + ','));
  /* Les milliers à l'anglaise (1,250) ; les jours du calendrier en anglais (M T W T F S S) */
  assert.ok(lire('assets/anim/union.html').includes("const milliers = v => String(v).replace(/\\B(?=(\\d{3})+(?!\\d))/g, typeof LG !== 'undefined' && LG ? ',' : '\\u00a0');"));
  assert.ok(lire('assets/anim/with-recursive.html').includes("<div class=\"wd\" data-en=\"${'MTWTFSS'[i]}\">${d}</div>"));
  /* Les sous-requêtes, la CTE et ses colonnes calculées, sur la base anglaise */
  const {L} = anglais();
  assert.equal(L.sql('SELECT nom, (SELECT MAX(date_commande) FROM commandes WHERE commandes.produit_id = produits.id) AS derniere_commande FROM produits'),
    'SELECT name, (SELECT MAX(order_date) FROM orders WHERE orders.product_id = products.id) AS last_order FROM products');
  assert.equal(L.sql('SELECT AVG(montant) FROM (SELECT p.prix * c.quantite AS montant FROM commandes c JOIN produits p ON c.produit_id = p.id) AS commandes_montants'),
    'SELECT AVG(amount) FROM (SELECT p.price * c.quantity AS amount FROM orders c JOIN products p ON c.product_id = p.id) AS order_amounts');
  assert.equal(L.sql('WITH totaux AS (SELECT client_id, COUNT(*) AS nb_commandes FROM commandes GROUP BY client_id) SELECT clients.prenom, totaux.nb_commandes FROM clients JOIN totaux ON clients.id = totaux.client_id'),
    'WITH totals AS (SELECT customer_id, COUNT(*) AS order_count FROM orders GROUP BY customer_id) SELECT customers.first_name, totals.order_count FROM customers JOIN totals ON customers.id = totals.customer_id');
  assert.equal(L.sql("SELECT nom, prix FROM produits WHERE prix > ALL (SELECT prix FROM produits WHERE categorie = 'Bien-être')"),
    "SELECT name, price FROM products WHERE price > ALL (SELECT price FROM products WHERE category = 'Wellness')");
  /* Les tables d'une seule page : invites (guests), jours (days), les libellés des indicateurs */
  for (const [c, q, en] of [['insert-select', "INSERT INTO invites SELECT prenom, nom, email FROM clients WHERE ville = 'Lyon'", "INSERT INTO guests SELECT first_name, last_name, email FROM customers WHERE city = 'Lyon'"],
    ['with-recursive', "WITH RECURSIVE jours(jour) AS (SELECT '2026-07-01' UNION ALL SELECT DATE(jour, '+1 day') FROM jours WHERE jour < '2026-07-31') SELECT jour FROM jours",
      "WITH RECURSIVE days(day) AS (SELECT '2026-07-01' UNION ALL SELECT DATE(day, '+1 day') FROM days WHERE day < '2026-07-31') SELECT day FROM days"],
    ['union', "SELECT 'Nombre de clients' AS indicateur, COUNT(*) AS valeur FROM clients", "SELECT 'Number of customers' AS indicator, COUNT(*) AS value FROM customers"]]) {
    const {L: L3, ctx} = anglais();
    vm.runInNewContext(lire(`assets/anim/en/${c}.js`), ctx);
    assert.equal(L3.sql(q), en, c);
  }
  /* Les fiches des cours du module 6 */
  for (const [fr, en] of [['La sous-requête fournit une <1>liste de valeurs</1>.', 'The subquery provides a <1>list of values</1>.'],
    ['Garde les lignes du premier résultat qui ne figurent pas dans le second. L’ordre des requêtes compte !', 'Keeps the rows of the first result that aren’t in the second. The order of the queries matters!']])
    assert.equal(L.t(fr), en, fr);
  /* « AS » : la légende cite les mots d'un alias sans guillemets, pas des colonnes ; un <code> peut porter sa traduction (data-en) */
  assert.ok(MOTEUR.includes("if (TEL_QUEL[n.nodeName]) { if (n.nodeName === 'CODE' && !surPlace(n)) codeSql(n);"));
  assert.ok(lire('assets/anim/as.html').includes('"Sans guillemets, <code data-en=\\"Product\\">Nom</code> devient l’alias, puis <code data-en=\\"name\\">du produit</code> provoque une erreur."'));
  assert.ok(lire('tools/voix/en/as.json').includes('Without quotes, Product becomes the alias, then name causes an error.') && !lire('tools/voix/en/as.json').includes('du produit'));
});

test('la voix anglaise du module 6 : Brielle, les ids du français, les mots-clés en capitales, les dates sans apostrophes', () => {
  const br = JSON.parse(lire('tools/voix/en/bases-relationnelles.json')), prep = lire('tools/voix/preparer-langue.mjs');
  const DIRE = new Function(prep.slice(prep.indexOf('const B = '), prep.indexOf('const parFichier')) + '\nreturn DIRE;')();
  for (const [x, dit] of [["Select '2026-07-01' provides the starting date: July 1.", 'Select 2026, dash, 07, dash, 01 provides the starting date: July 1.'],
    ['Your turn! For each product, is price > ALL (…) true or false?', 'Your turn! For each product, is price greater than ALL true or false?'],
    ['With WITH totals AS (…), we give the name totals to the result.', 'Writing WITH totals as, we give the name totals to the result.'],
    ['In the next lesson, you’ll create a series of values with WITH RECURSIVE.', 'In the next lesson, you’ll create a series of values with the WITH RECURSIVE clause.'],
    ['Which keyword stacks the rows of several SELECTs?', 'Which keyword stacks the rows of several select queries?']])
    assert.equal(DIRE(x), dit, x);
  let total = 0;
  for (const c of M6) {
    const fr = JSON.parse(lire(`tools/voix/${c}.json`)), en = JSON.parse(lire(`tools/voix/en/${c}.json`));
    assert.equal(en.langue, 'en'); assert.equal(en.cours, c); assert.deepEqual(en.voix, br.voix, c); assert.equal(en.modele, fr.modele);
    const ids = fr.elements.map(e => e.id), chs = ids.filter(i => /^ch/.test(i));
    assert.deepEqual(en.elements.map(e => e.id), ids.filter(i => en.elements.some(e => e.id === i)), `${c} : l’ordre du français`);
    assert.ok(!en.elements.some(e => e.id === chs[chs.length - 1]), `${c} : le « Pour finir » n’est pas joué dans l’appli`);
    for (const e of en.elements) {
      const t = e.texte.replace(/^\[\w+\]\s*/, '');
      assert.ok(t.length > 3, `${c} ${e.id} : vide`);
      assert.ok(!/[«»<>=≠→⇔|+*%_×−'"]|\(…\)|\w\(|[A-Za-z_]\.[A-Za-z]|&[a-z]+;|Pour finir|idées à retenir|\b(SELECT|FROM|WHERE|JOIN|COUNT|GROUP BY|DISTINCT)\b/.test(t), `${c} ${e.id} : ${t}`);
      if (e.cles) assert.equal(e.phrases.length, e.cles.length, `${c} ${e.id}`);
    }
    total += en.elements.reduce((a, e) => a + e.texte.length, 0);
  }
  assert.ok(total > 28000 && total < 33000, `${total} caractères (autant de crédits)`);
});

/* Module 7 (« Fonctions de fenêtre », 15 novembre) : les cinq vidéos en anglais, leur vignette, leur voix préparée */
const M7 = ['over', 'fonctions-rang', 'lag-lead', 'fenetres-glissantes', 'first-last-ntile'];
test('le module 7 en entier : chaque vidéo charge ses textes anglais, gardés nombre pour nombre, avec sa vignette, préchargés', () => {
  const f = x => [String([...new Set(x.match(/\{\w+\}/g) || [])].sort()), String((x.match(/<\d+\/?>/g) || []).sort())];
  for (const c of M7) {
    const pg = lire(`assets/anim/${c}.html`), textes = textesDe(c);
    assert.ok(pg.includes(`<script src="../../langues.js?v=4" data-textes="{langue}/${c}.js?v=1"></script>`), c);
    assert.ok(Object.keys(textes).length > 120, `${c} : ${Object.keys(textes).length} textes`);
    for (const k in textes) assert.deepEqual(f(textes[k]), f(k), `${c} : ${k}`);
    for (const v of Object.values(textes)) assert.ok(!/[«»]|\s[:;?!](?!\S)/.test(v.replace(/\{\w+\}/g, 'X').replace('? days', '')), `${c} : la typographie anglaise : ${v}`);
    for (const g of [`'./assets/anim/en/${c}.js?v=1'`, `'./assets/anim/en/${c}-thumb.webp'`]) assert.ok(sw.includes(g), g);
    assert.ok(fs.statSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)).size > 10000, c);
    assert.ok(/<body data-table="(produits|commandes)">/.test(pg), c);
  }
  assert.ok(app.replace(/,\n\s*'/g, ",'").includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct'," + [...M2, ...M3, ...M4, ...M5, ...M6, ...M7].map(c => `'${c}'`).join(',') + ','));
  /* Le code hors des cartes : l'étiquette « GROUP BY categorie », le tri des commandes, la requête du total */
  for (const [c, sel] of [['over', "'.mini, .lst-t.mono'"], ['fonctions-rang', "'.mini, .ob'"], ['fenetres-glissantes', "'.mini, .sm2-q'"], ['lag-lead', "'.mini'"], ['first-last-ntile', "'.mini'"]])
    assert.ok(lire(`assets/anim/${c}.html`).includes(`Course({codeSel: ${sel}, duration: DURATION,`), c);
  /* FIRST_VALUE(nom) : le nom d'un produit (name), pas celui d'un client */
  const fl = lire('assets/anim/first-last-ntile.html');
  assert.equal((fl.match(/<code data-en=\\"FIRST_VALUE\(name\)\\">FIRST_VALUE\(nom\)<\/code>/g) || []).length, 2);
  assert.ok(fl.includes('<code data-en="FIRST_VALUE(name)">FIRST_VALUE(nom)</code>') && fl.includes('<code data-en="LAST_VALUE(name)">LAST_VALUE(nom)</code>'));
  /* Les noms des requêtes du module 7 */
  const {L} = anglais();
  assert.equal(L.sql('WITH rayons AS (SELECT nom, categorie, prix, COUNT(*) OVER (PARTITION BY categorie) AS nb_produits FROM produits) SELECT nom, categorie, prix FROM rayons WHERE nb_produits = 1', 'produits'),
    'WITH shelves AS (SELECT name, category, price, COUNT(*) OVER (PARTITION BY category) AS product_count FROM products) SELECT name, category, price FROM shelves WHERE product_count = 1');
  assert.equal(L.sql('SELECT client_id, date_commande, LAG(date_commande) OVER (PARTITION BY client_id ORDER BY date_commande, id) AS precedente FROM commandes'),
    'SELECT customer_id, order_date, LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, id) AS previous FROM orders');
  assert.equal(L.sql('SELECT date_commande, montant, SUM(montant) OVER (ORDER BY date_commande, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumul FROM montants'),
    'SELECT order_date, amount, SUM(amount) OVER (ORDER BY order_date, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total FROM amounts');
  assert.equal(L.sql('SELECT nom, NTILE(3) OVER (ORDER BY prix DESC) AS gamme FROM produits'), 'SELECT name, NTILE(3) OVER (ORDER BY price DESC) AS tier FROM products');
  assert.equal(L.sql(') AS delai_moyen, RANK() OVER (ORDER BY commandes.date_commande) AS rang, AS produit_le_plus_cher'), ') AS avg_gap, RANK() OVER (ORDER BY orders.order_date) AS rank, AS most_expensive');
  /* Les fiches des cours du module 7 */
  for (const [fr, en] of [['Recommencer à {1} dans chaque groupe'.replace('{1}', '1'), 'Starting again at 1 in each group'],
    ['Les lignes triées sont réparties en n groupes presque égaux ; les premiers reçoivent une ligne de plus.', 'The sorted rows are split into n nearly equal groups; the first ones get one more row.']])
    assert.equal(L.t(fr), en, fr);
  const fr = textesDe('fenetres-glissantes');
  assert.equal(fr['{1}er {m1} · {2}e commande'], '{m1} {1} · {2}th order');
});

test('la voix anglaise du module 7 : Brielle, les ids du français, les fonctions de fenêtre dites comme on les lit', () => {
  const br = JSON.parse(lire('tools/voix/en/bases-relationnelles.json')), prep = lire('tools/voix/preparer-langue.mjs');
  const DIRE = new Function(prep.slice(prep.indexOf('const B = '), prep.indexOf('const parFichier')) + '\nreturn DIRE;')();
  for (const [x, dit] of [['ROW_NUMBER() numbers the rows, in the order given by OVER.', 'Row number numbers the rows, in the order given by OVER.'],
    ['With LAG(order_date), each row reads the date of the previous row.', 'With lag of order underscore date, each row reads the date of the previous row.'],
    ['So the average gap is (0 + 26) ÷ 2 = 13 days.', 'So the average gap is 0 plus 26, divided by 2, equals 13 days.'],
    ['The calculated gap is −23 days.', 'The calculated gap is minus 23 days.'],
    ['Next, the price tier: NTILE(3) splits the rows into 3 groups.', 'Next, the price tier: N-tile of 3 splits the rows into 3 groups.'],
    ['Unlike GROUP BY, PARTITION BY doesn’t reduce the number of rows.', 'Unlike group by, partition by doesn’t reduce the number of rows.'],
    ['What does FIRST_VALUE(name) return?', 'What does first value of name return?']])
    assert.equal(DIRE(x), dit, x);
  let total = 0;
  for (const c of M7) {
    const fr = JSON.parse(lire(`tools/voix/${c}.json`)), en = JSON.parse(lire(`tools/voix/en/${c}.json`));
    assert.equal(en.langue, 'en'); assert.equal(en.cours, c); assert.deepEqual(en.voix, br.voix, c); assert.equal(en.modele, fr.modele);
    const ids = fr.elements.map(e => e.id), chs = ids.filter(i => /^ch/.test(i));
    assert.deepEqual(en.elements.map(e => e.id), ids.filter(i => en.elements.some(e => e.id === i)), `${c} : l’ordre du français`);
    assert.ok(!en.elements.some(e => e.id === chs[chs.length - 1]), `${c} : le « Pour finir » n’est pas joué dans l’appli`);
    for (const e of en.elements) {
      const t = e.texte.replace(/^\[\w+\]\s*/, '');
      assert.ok(t.length > 3, `${c} ${e.id} : vide`);
      assert.ok(!/[«»<>=≠→⇔|+*%_×÷−'"()]|\w\(|[A-Za-z_]\.[A-Za-z]|&[a-z]+;|Pour finir|idées à retenir|\b(SELECT|FROM|WHERE|JOIN|COUNT|GROUP BY|PARTITION BY|ROWS BETWEEN|ROW_NUMBER|DENSE_RANK|NTILE|FIRST_VALUE|LAST_VALUE|LAG|LEAD)\b/.test(t), `${c} ${e.id} : ${t}`);
      if (e.cles) assert.equal(e.phrases.length, e.cles.length, `${c} ${e.id}`);
    }
    total += en.elements.reduce((a, e) => a + e.texte.length, 0);
  }
  assert.ok(total > 12500 && total < 16500, `${total} caractères (autant de crédits)`);
});

/* Module 8 (« Modéliser », 15 novembre) : le projet des ateliers bien-être, ses trois vidéos en anglais, leurs tables, leur voix préparée */
const M8 = ['projet-normaliser', 'projet-cles', 'projet-uml'];
test('le module 8 en entier : les ateliers deviennent workshops, les inscriptions enrollments ; le code tapé écrit pour la base', () => {
  const f = x => [String([...new Set(x.match(/\{\w+\}/g) || [])].sort()), String((x.match(/<\d+\/?>/g) || []).sort())];
  for (const c of M8) {
    const pg = lire(`assets/anim/${c}.html`), textes = textesDe(c);
    assert.ok(pg.includes(`<script src="../../langues.js?v=4" data-textes="{langue}/${c}.js?v=1"></script>`), c);
    assert.ok(Object.keys(textes).length > 120, `${c} : ${Object.keys(textes).length} textes`);
    for (const k in textes) assert.deepEqual(f(textes[k]), f(k), `${c} : ${k}`);
    for (const v of Object.values(textes)) assert.ok(!/[«»]|\s[:;?!](?!\S)/.test(v.replace(/\{\w+\}/g, 'X').replace('? workshop', '')), `${c} : la typographie anglaise : ${v}`);
    for (const g of [`'./assets/anim/en/${c}.js?v=1'`, `'./assets/anim/en/${c}-thumb.webp'`]) assert.ok(sw.includes(g), g);
    assert.ok(fs.statSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)).size > 10000, c);
    /* la table des inscriptions d'abord : date_inscription y est enrollment_date (signup_date chez un client) */
    assert.ok(pg.includes('<body data-table="inscriptions">'), c);
    assert.equal(textes['date_inscription'], 'enrollment_date', c);
    const {L, ctx} = anglais();
    vm.runInNewContext(lire(`assets/anim/en/${c}.js`), ctx);
    /* ligne par ligne, comme l'éditeur : chaque texte avec la requête entière pour contexte, la table des inscriptions d'abord */
    const req = 'CREATE TABLE inscriptions ( id INTEGER PRIMARY KEY, client_id INTEGER, atelier_id INTEGER, date_inscription DATE, FOREIGN KEY (client_id) REFERENCES clients(id) )';
    assert.deepEqual(['CREATE TABLE inscriptions (', '  client_id INTEGER,', '  date_inscription DATE,', '    REFERENCES clients(id),'].map(l => L.sql(l, 'inscriptions ' + req)),
      ['CREATE TABLE enrollments (', '  customer_id INTEGER,', '  enrollment_date DATE,', '    REFERENCES customers(id),'], c);
    assert.equal(L.sql('CREATE TABLE cartes ( client_id INTEGER UNIQUE, seances INTEGER ) ; FOREIGN KEY (coach_id) REFERENCES coachs(id) ; ateliers', 'cartes'),
      'CREATE TABLE cards ( customer_id INTEGER UNIQUE, sessions INTEGER ) ; FOREIGN KEY (coach_id) REFERENCES coaches(id) ; workshops', c);
  }
  assert.ok(app.replace(/,\n\s*'/g, ",'").includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct'," + [...M2, ...M3, ...M4, ...M5, ...M6, ...M7, ...M8].map(c => `'${c}'`).join(',') + ','));
  /* Les titres des couvertures, lettre par lettre : NORMALIZE, KEYS */
  assert.ok(lire('assets/anim/projet-normaliser.html').includes('<span>I</span><span data-en="Z">S</span><span>E</span><span data-en="">R</span></div>'));
  assert.ok(lire('assets/anim/projet-cles.html').includes('<span data-en="K">C</span><span data-en="E">L</span><span data-en="Y">É</span><span>S</span>'));
  /* Les requêtes de « Clés et relations » s'écrivent pour la base avant d'être découpées pour la frappe */
  const cles = lire('assets/anim/projet-cles.html');
  assert.ok(cles.indexOf("$$('.sq .ln').forEach(el => LG.ecrireCode(el));") > 0 && cles.indexOf("$$('.sq .ln').forEach(el => LG.ecrireCode(el));") < cles.indexOf("$$('.sq .ln').forEach(splitChars);"));
  const {L} = anglais();
  for (const [fr, en] of [['<1>Normaliser</1>, c’est répartir les informations dans des tables reliées, en suivant les trois <2>formes normales</2> (1FN, 2FN, 3FN).',
    '<1>Normalizing</1> means spreading the information across linked tables, following the three <2>normal forms</2> (1NF, 2NF, 3NF).']])
    assert.equal(L.t(fr), en, fr);
});

test('la voix anglaise du module 8 : Brielle, les ids du français, les relations et les multiplicités dites en mots', () => {
  const br = JSON.parse(lire('tools/voix/en/bases-relationnelles.json')), prep = lire('tools/voix/preparer-langue.mjs');
  const DIRE = new Function(prep.slice(prep.indexOf('const B = '), prep.indexOf('const parFichier')) + '\nreturn DIRE;')();
  for (const [x, dit] of [['The rule: in a 1 → N relationship, the foreign key goes on the “many” side.', 'The rule: in a 1 to N relationship, the foreign key goes on the “many” side.'],
    ['It’s a “many-to-many” relationship, written N ↔ N.', 'It’s a “many-to-many” relationship, written N to N.'],
    ['Likewise, 1..* means “at least one” and 0..1 “zero or one”.', 'Likewise, one dot dot star means “at least one” and zero dot dot one “zero or one”.'],
    ['With x → y, the result changes.', 'With x gives y, the result changes.']])
    assert.equal(DIRE(x), dit, x);
  let total = 0;
  for (const c of M8) {
    const fr = JSON.parse(lire(`tools/voix/${c}.json`)), en = JSON.parse(lire(`tools/voix/en/${c}.json`));
    assert.equal(en.langue, 'en'); assert.equal(en.cours, c); assert.deepEqual(en.voix, br.voix, c); assert.equal(en.modele, fr.modele);
    const ids = fr.elements.map(e => e.id), chs = ids.filter(i => /^ch/.test(i));
    assert.deepEqual(en.elements.map(e => e.id), ids.filter(i => en.elements.some(e => e.id === i)), `${c} : l’ordre du français`);
    assert.ok(!en.elements.some(e => e.id === chs[chs.length - 1]), `${c} : le « Pour finir » n’est pas joué dans l’appli`);
    /* un tri à glisser n'a pas d'indice affiché (moments.js : hint(i) lit tip) : pas de fichier d'indice */
    assert.deepEqual(fr.elements.map(e => e.id).filter(i => /^indice/.test(i) && !en.elements.some(e => e.id === i)), {'projet-normaliser': ['indice4'], 'projet-cles': ['indice6'], 'projet-uml': ['indice2', 'indice6']}[c], c);
    for (const e of en.elements) {
      const t = e.texte.replace(/^\[\w+\]\s*/, '');
      assert.ok(t.length > 3, `${c} ${e.id} : vide`);
      assert.ok(!/[«»<>=≠→↔⇔|+*%_×÷−'"@]|\.\.|\w\(|[A-Za-z_]\.[A-Za-z]|&[a-z]+;|Pour finir|idées à retenir|atelier|inscription|\b(SELECT|FROM|WHERE|JOIN)\b/.test(t), `${c} ${e.id} : ${t}`);
      if (e.cles) assert.equal(e.phrases.length, e.cles.length, `${c} ${e.id}`);
    }
    total += en.elements.reduce((a, e) => a + e.texte.length, 0);
  }
  assert.ok(total > 10500 && total < 14500, `${total} caractères (autant de crédits)`);
});

/* Module 9 (« Créer et faire évoluer les tables », 15 novembre) : quatre vidéos du projet, le code tapé écrit pour la base */
const M9 = ['projet-create', 'projet-alter', 'projet-drop', 'projet-schemas'];
test('le module 9 en entier : CREATE, ALTER, DROP, les schémas ; requêtes, commentaires et schémas écrits pour la base', () => {
  const f = x => [String([...new Set(x.match(/\{\w+\}/g) || [])].sort()), String((x.match(/<\d+\/?>/g) || []).sort())];
  for (const c of M9) {
    const pg = lire(`assets/anim/${c}.html`), textes = textesDe(c);
    assert.ok(pg.includes(`<script src="../../langues.js?v=4" data-textes="{langue}/${c}.js?v=1"></script>`), c);
    assert.ok(Object.keys(textes).length > 100, `${c} : ${Object.keys(textes).length} textes`);
    for (const k in textes) assert.deepEqual(f(textes[k]), f(k), `${c} : ${k}`);
    for (const v of Object.values(textes)) assert.ok(!/[«»]|\s[:;?!](?!\S)/.test(v.replace(/\{\w+\}/g, 'X')), `${c} : la typographie anglaise : ${v}`);
    for (const g of [`'./assets/anim/en/${c}.js?v=1'`, `'./assets/anim/en/${c}-thumb.webp'`]) assert.ok(sw.includes(g), g);
    assert.ok(fs.statSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)).size > 10000, c);
    assert.ok(pg.includes('<body data-table="inscriptions">'), c);
    /* les lignes des requêtes, écrites pour la base avant d'être découpées en caractères pour la frappe */
    assert.ok(/if \(typeof LG !== 'undefined' && LG && LG\.ecrireCode\) \$\$\('[^']*\.sq \.ln[^']*'\)\.forEach\(el => LG\.ecrireCode\(el\)\);/.test(pg), c);
    const {L, ctx} = anglais();
    vm.runInNewContext(lire(`assets/anim/en/${c}.js`), ctx);
    for (const [q, en] of [['ALTER TABLE ateliers ADD COLUMN places INTEGER DEFAULT 12;', 'ALTER TABLE workshops ADD COLUMN spots INTEGER DEFAULT 12;'],
      ['ALTER TABLE cartes RENAME COLUMN seances TO seances_restantes;', 'ALTER TABLE cards RENAME COLUMN sessions TO sessions_left;'],
      ['ALTER TABLE cartes RENAME TO cartes_membre', 'ALTER TABLE cards RENAME TO membership_cards'],
      ['ALTER TABLE coachs RENAME COLUMN telephone TO ancien_telephone', 'ALTER TABLE coaches RENAME COLUMN phone TO old_phone'],
      ['DROP TABLE IF EXISTS inscriptions_excel;', 'DROP TABLE IF EXISTS enrollments_excel;'],
      ['CREATE SCHEMA bien_etre; ALTER TABLE clients SET SCHEMA boutique; SELECT * FROM boutique.commandes; SELECT * FROM bien_etre.inscriptions;',
        'CREATE SCHEMA wellness; ALTER TABLE customers SET SCHEMA shop; SELECT * FROM shop.orders; SELECT * FROM wellness.enrollments;']])
      assert.equal(L.sql(q, 'inscriptions'), en, `${c} : ${q}`);
  }
  assert.ok(app.replace(/,\n\s*'/g, ",'").includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct'," + [...M2, ...M3, ...M4, ...M5, ...M6, ...M7, ...M8, ...M9].map(c => `'${c}'`).join(',') + ','));
  /* « Les requêtes d'une page » : un commentaire SQL se traduit comme une phrase ; un schéma devant une table */
  assert.ok(MOTEUR.includes("var v = /^\\s*--/.test(n.nodeValue) ? n.nodeValue.replace(/^(\\s*--\\s*)(.*?)(\\s*)$/, function (m, a, x, b) { return a + t(x) + b; }) : sql(n.nodeValue, contexte);"));
  assert.ok(MOTEUR.includes("if (!table && Object.prototype.hasOwnProperty.call(T, nom)) { e.v = casse(e.v, T[nom][0]); continue; }"));
  assert.equal(textesDe('projet-schemas')['Même nom, deux tables'], 'Same name, two tables');
  assert.equal(textesDe('projet-drop')['inscriptions<1>_excel<2></2></1>'], 'enrollments<1>_excel<2></2></1>');
  /* la date d'inscription d'un client (signup_date) n'est pas celle d'une inscription (enrollment_date) */
  for (const c of ['projet-alter', 'projet-drop']) assert.ok(lire(`assets/anim/${c}.html`).includes(`'<span data-en="signup_date">date_inscription</span>'`), c);
  assert.ok(lire('assets/anim/projet-schemas.html').includes('<span>H</span><span data-en="E">É</span><span>M</span>'));
  assert.ok(lire('assets/anim/projet-schemas.html').includes("Course({codeSel: '.rc', duration: DURATION,"));
});

test('la voix anglaise du module 9 : Brielle, les ids du français, pas de fichier pour un indice qui ne s’affiche pas', () => {
  const br = JSON.parse(lire('tools/voix/en/bases-relationnelles.json')), prep = lire('tools/voix/preparer-langue.mjs');
  const DIRE = new Function(prep.slice(prep.indexOf('const B = '), prep.indexOf('const parFichier')) + '\nreturn DIRE;')();
  assert.equal(DIRE('With ALTER TABLE … SET SCHEMA, each table joins its space.'), 'With ALTER TABLE, then SET SCHEMA, each table joins its space.');
  let total = 0;
  for (const c of M9) {
    const fr = JSON.parse(lire(`tools/voix/${c}.json`)), en = JSON.parse(lire(`tools/voix/en/${c}.json`));
    assert.equal(en.langue, 'en'); assert.equal(en.cours, c); assert.deepEqual(en.voix, br.voix, c); assert.equal(en.modele, fr.modele);
    const ids = fr.elements.map(e => e.id), chs = ids.filter(i => /^ch/.test(i));
    assert.deepEqual(en.elements.map(e => e.id), ids.filter(i => en.elements.some(e => e.id === i)), `${c} : l’ordre du français`);
    assert.ok(!en.elements.some(e => e.id === chs[chs.length - 1]), `${c} : le « Pour finir » n’est pas joué dans l’appli`);
    assert.ok(fr.elements.every(e => en.elements.some(x => x.id === e.id) || /^indice/.test(e.id) || e.id === chs[chs.length - 1]), `${c} : seuls les indices sans texte et le « Pour finir » manquent`);
    for (const e of en.elements) {
      const t = e.texte.replace(/^\[\w+\]\s*/, '');
      assert.ok(t.length > 3, `${c} ${e.id} : vide`);
      assert.ok(!/[«»<>=≠→↔⇔|+*%_×÷−'"@…]|\.\.|\w\(|[A-Za-z_]\.[A-Za-z]|&[a-z]+;|Pour finir|idées à retenir|atelier|inscription|séance|boutique|bien_etre/.test(t), `${c} ${e.id} : ${t}`);
      if (e.cles) assert.equal(e.phrases.length, e.cles.length, `${c} ${e.id}`);
    }
    total += en.elements.reduce((a, e) => a + e.texte.length, 0);
  }
  assert.ok(total > 10500 && total < 14500, `${total} caractères (autant de crédits)`);
});

/* Module 10 (« Écrire et modifier les données », 15 novembre) : INSERT, UPDATE, MERGE, DELETE dans le projet des ateliers */
const M10 = ['projet-insert', 'projet-update', 'projet-merge', 'projet-delete'];
test('le module 10 en entier : INSERT, UPDATE, MERGE, DELETE ; requêtes et commentaires écrits pour la base avant la frappe', () => {
  const f = x => [String([...new Set(x.match(/\{\w+\}/g) || [])].sort()), String((x.match(/<\d+\/?>/g) || []).sort())];
  for (const c of M10) {
    const pg = lire(`assets/anim/${c}.html`), textes = textesDe(c);
    assert.ok(pg.includes(`<script src="../../langues.js?v=4" data-textes="{langue}/${c}.js?v=1"></script>`), c);
    assert.ok(Object.keys(textes).length > 100, `${c} : ${Object.keys(textes).length} textes`);
    for (const k in textes) assert.deepEqual(f(textes[k]), f(k), `${c} : ${k}`);
    for (const v of Object.values(textes)) assert.ok(!/[«»]|\s[:;?!](?!\S)/.test(v.replace(/\{\w+\}/g, 'X')), `${c} : la typographie anglaise : ${v}`);
    for (const g of [`'./assets/anim/en/${c}.js?v=1'`, `'./assets/anim/en/${c}-thumb.webp'`]) assert.ok(sw.includes(g), g);
    assert.ok(fs.statSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)).size > 10000, c);
    assert.ok(pg.includes(`<body data-table="${c === 'projet-merge' ? 'produits' : 'inscriptions'}">`), c);
    assert.ok(pg.includes("  if (typeof LG !== 'undefined' && LG && LG.ecrireCode) $$('.sq .ln').forEach(el => LG.ecrireCode(el));"), c);
    /* les commentaires qui changent en cours de vidéo, traduits avant le code (sinon « Atelier » deviendrait workshop) */
    if (pg.includes('cmtStack')) assert.ok(pg.indexOf("$$('.sq .cm > i').forEach(el => { el.textContent = LG.t(el.textContent); });") < pg.indexOf("$$('.sq .ln').forEach(el => LG.ecrireCode(el));"), c);
    assert.equal(textes['date_inscription'], 'enrollment_date', c);
    const {L, ctx} = anglais();
    vm.runInNewContext(lire(`assets/anim/en/${c}.js`), ctx);
    for (const [q, en] of [['INSERT INTO inscriptions (client_id, atelier_id, date_inscription) VALUES (2, 3, \'2026-09-08\');', 'INSERT INTO enrollments (customer_id, workshop_id, enrollment_date) VALUES (2, 3, \'2026-09-08\');'],
      ['INSERT INTO cartes (client_id, seances_restantes) VALUES (6, 10) ON CONFLICT (client_id) DO UPDATE SET seances_restantes = seances_restantes + 10;',
        'INSERT INTO cards (customer_id, sessions_left) VALUES (6, 10) ON CONFLICT (customer_id) DO UPDATE SET sessions_left = sessions_left + 10;'],
      ['UPDATE ateliers SET date_atelier = \'2026-09-18\' WHERE id = 2;', 'UPDATE workshops SET workshop_date = \'2026-09-18\' WHERE id = 2;'],
      ['MERGE INTO produits USING entrepot ON produits.id = entrepot.id WHEN MATCHED THEN UPDATE SET stock = entrepot.stock',
        'MERGE INTO products USING warehouse ON products.id = warehouse.id WHEN MATCHED THEN UPDATE SET stock = warehouse.stock'],
      ['DELETE FROM inscriptions WHERE client_id = 6;', 'DELETE FROM enrollments WHERE customer_id = 6;']])
      assert.equal(L.sql(q, 'inscriptions'), en, `${c} : ${q}`);
  }
  assert.ok(app.replace(/,\n\s*'/g, ",'").includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct'," + [...M2, ...M3, ...M4, ...M5, ...M6, ...M7, ...M8, ...M9, ...M10].map(c => `'${c}'`).join(',') + ','));
  assert.equal(textesDe('projet-merge')['nom'], 'name');
  assert.ok(lire('assets/anim/projet-merge.html').includes("Course({codeSel: '.rc', duration: DURATION,"));
  for (const [c, k, v] of [['projet-update', 'Oubli du WHERE', 'Forgetting the WHERE'], ['projet-insert', 'Atelier oublié', 'Workshop forgotten'], ['projet-update', 'Offrir {1} séances à toutes les cartes', 'Give {1} sessions to every card']])
    assert.equal(textesDe(c)[k], v, `${c} : ${k}`);
});

test('la voix anglaise du module 10 : Brielle, les ids du français, sans code brut', () => {
  const br = JSON.parse(lire('tools/voix/en/bases-relationnelles.json'));
  let total = 0;
  for (const c of M10) {
    const fr = JSON.parse(lire(`tools/voix/${c}.json`)), en = JSON.parse(lire(`tools/voix/en/${c}.json`));
    assert.equal(en.langue, 'en'); assert.equal(en.cours, c); assert.deepEqual(en.voix, br.voix, c); assert.equal(en.modele, fr.modele);
    const ids = fr.elements.map(e => e.id), chs = ids.filter(i => /^ch/.test(i));
    assert.deepEqual(en.elements.map(e => e.id), ids.filter(i => en.elements.some(e => e.id === i)), `${c} : l’ordre du français`);
    assert.ok(!en.elements.some(e => e.id === chs[chs.length - 1]), `${c} : le « Pour finir » n’est pas joué dans l’appli`);
    assert.ok(fr.elements.every(e => en.elements.some(x => x.id === e.id) || /^indice/.test(e.id) || e.id === chs[chs.length - 1]), c);
    for (const e of en.elements) {
      const t = e.texte.replace(/^\[\w+\]\s*/, '');
      assert.ok(t.length > 3, `${c} ${e.id} : vide`);
      assert.ok(!/[«»<>=≠→↔⇔|+*%_×÷−'"@…]|\.\.|\w\(|[A-Za-z_]\.[A-Za-z]|&[a-z]+;|Pour finir|idées à retenir|atelier|inscription|séance|entrepot/.test(t), `${c} ${e.id} : ${t}`);
      if (e.cles) assert.equal(e.phrases.length, e.cles.length, `${c} ${e.id}`);
    }
    total += en.elements.reduce((a, e) => a + e.texte.length, 0);
  }
  assert.ok(total > 9000 && total < 13000, `${total} caractères (autant de crédits)`);
});

/* Module 11 (« Intégrité des tables liées », 15 novembre) : ON DELETE, la table des avis (reviews) */
test('le module 11 : ON DELETE en anglais, la table avis devient reviews, le nom d’un produit name, celui d’un client last_name', () => {
  const f = x => [String([...new Set(x.match(/\{\w+\}/g) || [])].sort()), String((x.match(/<\d+\/?>/g) || []).sort())];
  const c = 'projet-ondelete', pg = lire(`assets/anim/${c}.html`), textes = textesDe(c);
  assert.ok(pg.includes(`<script src="../../langues.js?v=4" data-textes="{langue}/${c}.js?v=1"></script>`));
  assert.ok(Object.keys(textes).length > 100, `${Object.keys(textes).length} textes`);
  for (const k in textes) assert.deepEqual(f(textes[k]), f(k), k);
  for (const v of Object.values(textes)) assert.ok(!/[«»]|\s[:;?!](?!\S)/.test(v.replace(/\{\w+\}/g, 'X')), `la typographie anglaise : ${v}`);
  for (const g of [`'./assets/anim/en/${c}.js?v=1'`, `'./assets/anim/en/${c}-thumb.webp'`]) assert.ok(sw.includes(g), g);
  assert.ok(fs.statSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)).size > 10000);
  assert.ok(pg.includes('<body data-table="avis">'));
  assert.ok(pg.includes("  if (typeof LG !== 'undefined' && LG && LG.ecrireCode) $$('.sq .ln').forEach(el => LG.ecrireCode(el));"));
  assert.ok(pg.includes(`['c1', '<span data-en="name">nom</span>']`), 'le nom d’un produit');
  assert.ok(app.replace(/,\n\s*'/g, ",'").includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct'," + [...M2, ...M3, ...M4, ...M5, ...M6, ...M7, ...M8, ...M9, ...M10, c].map(c => `'${c}'`).join(',') + ','));
  const {L, ctx} = anglais();
  vm.runInNewContext(lire(`assets/anim/en/${c}.js`), ctx);
  assert.equal(L.sql('client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE SET NULL', 'avis'), 'customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE SET NULL');
  assert.equal(L.sql('SELECT id, client_id, produit_id, note, commentaire FROM avis', 'avis'), 'SELECT id, customer_id, product_id, rating, comment FROM reviews');
  assert.equal(textes['La colonne client_id de la table avis'], 'The customer_id column of the reviews table');
  assert.equal(textes['Customer reviews'] || textes['Avis clients<1>{1} avis</1>'], 'Customer reviews<1>{1}</1>');
  const fr = JSON.parse(lire(`tools/voix/${c}.json`)), en = JSON.parse(lire(`tools/voix/en/${c}.json`));
  assert.equal(en.langue, 'en'); assert.deepEqual(en.voix, JSON.parse(lire('tools/voix/en/bases-relationnelles.json')).voix);
  assert.deepEqual(en.elements.map(e => e.id), fr.elements.map(e => e.id).filter(i => en.elements.some(e => e.id === i)));
  for (const e of en.elements) {
    const t = e.texte.replace(/^\[\w+\]\s*/, '');
    assert.ok(t.length > 3 && !/[«»<>=≠→↔⇔|+*%_×÷−'"@…]|\.\.|\w\(|[A-Za-z_]\.[A-Za-z]|SET null|avis|atelier|Pour finir/.test(t), `${e.id} : ${t}`);
  }
  const total = en.elements.reduce((a, e) => a + e.texte.length, 0);
  assert.ok(total > 2800 && total < 4400, `${total} caractères`);
});

/* Module 12 (« Transactions et concurrence », 15 novembre) : BEGIN, COMMIT, ROLLBACK, SAVEPOINT, FOR UPDATE ;
   les tables remplacements (replacements) et cadeaux (gifts), les places restantes d’un atelier (spots_left) */
const M12 = ['projet-transaction', 'projet-savepoint', 'projet-concurrence'];
test('le module 12 en entier : les transactions, le savepoint before_gift, la concurrence ; requêtes écrites pour la base avant la frappe', () => {
  const f = x => [String([...new Set(x.match(/\{\w+\}/g) || [])].sort()), String((x.match(/<\d+\/?>/g) || []).sort())];
  for (const c of M12) {
    const pg = lire(`assets/anim/${c}.html`), textes = textesDe(c);
    assert.ok(pg.includes(`<script src="../../langues.js?v=4" data-textes="{langue}/${c}.js?v=1"></script>`), c);
    assert.ok(Object.keys(textes).length > 200, `${c} : ${Object.keys(textes).length} textes`);
    for (const k in textes) assert.deepEqual(f(textes[k]), f(k), `${c} : ${k}`);
    for (const v of Object.values(textes)) assert.ok(!/[«»]|\s[:;?!](?!\S)/.test(v.replace(/\{\w+\}/g, 'X')), `${c} : la typographie anglaise : ${v}`);
    for (const g of [`'./assets/anim/en/${c}.js?v=1'`, `'./assets/anim/en/${c}-thumb.webp'`]) assert.ok(sw.includes(g), g);
    assert.ok(fs.statSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)).size > 10000, c);
    assert.ok(pg.includes(`<body data-table="${c === 'projet-concurrence' ? 'inscriptions' : 'produits'}">`), c);
    assert.ok(pg.indexOf("  if (typeof LG !== 'undefined' && LG && LG.ecrireCode) $$('.sq .ln').forEach(el => LG.ecrireCode(el));") > 0
      && pg.indexOf("$$('.sq .ln').forEach(el => LG.ecrireCode(el));") < pg.indexOf("  $$('.sq .ln').forEach(splitChars);"), c);
    const {L, ctx} = anglais();
    vm.runInNewContext(lire(`assets/anim/en/${c}.js`), ctx);
    for (const [q, en] of [['INSERT INTO remplacements (id, client_id, produit_id, quantite, personnalisation) VALUES (1, 7, 8, 1, \'Léa\');',
        'INSERT INTO replacements (id, customer_id, product_id, quantity, personalization) VALUES (1, 7, 8, 1, \'Léa\');'],
      ['INSERT INTO cadeaux (client_id, produit_id, quantite) VALUES (7, 5, 1);', 'INSERT INTO gifts (customer_id, product_id, quantity) VALUES (7, 5, 1);'],
      ['SAVEPOINT avant_cadeau;', 'SAVEPOINT before_gift;'], ['ROLLBACK TO SAVEPOINT avant_cadeau;', 'ROLLBACK TO SAVEPOINT before_gift;'],
      ['SELECT places_restantes FROM ateliers WHERE id = 6 FOR UPDATE;', 'SELECT spots_left FROM workshops WHERE id = 6 FOR UPDATE;'],
      ['INSERT INTO inscriptions (client_id, atelier_id, date_inscription) VALUES (7, 6, \'2026-10-25\');', 'INSERT INTO enrollments (customer_id, workshop_id, enrollment_date) VALUES (7, 6, \'2026-10-25\');']])
      assert.equal(L.sql(q, c === 'projet-concurrence' ? 'inscriptions' : 'produits'), en, `${c} : ${q}`);
  }
  /* « Healthy cooking » et customer_id / personalization, plus longs qu’en français : des colonnes plus larges, en anglais seulement */
  assert.ok(lire('assets/anim/projet-transaction.html').includes('html[lang="en"] #tr{--g:'));
  assert.ok(lire('assets/anim/projet-concurrence.html').includes('html[lang="en"] #ta{--g:'));
  assert.ok(lire('assets/anim/projet-concurrence.html').includes('<span data-en="Y">E</span></div>'), 'CONCURRENCY');
  assert.equal(textesDe('projet-concurrence')['Nathan Petit attend'], 'Nathan Petit waits');
  assert.equal(textesDe('projet-savepoint')['Quelle commande choisir ?'], 'Which command?');
  assert.equal(textesDe('projet-transaction')['Retirer un shaker du stock'], 'Remove a shaker from stock');
  assert.ok(app.replace(/,\n\s*'/g, ",'").includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct'," + [...M2, ...M3, ...M4, ...M5, ...M6, ...M7, ...M8, ...M9, ...M10, 'projet-ondelete', ...M12].map(c => `'${c}'`).join(',') + ','));
  /* la fiche du cours SAVEPOINT : « nom » y est un nom de savepoint, pas celui d’un client */
  assert.ok(app.includes('<code data-en=\\"SAVEPOINT name\\">SAVEPOINT nom</code>') && app.includes('<code data-en=\\"ROLLBACK TO SAVEPOINT name\\">ROLLBACK TO SAVEPOINT nom</code>'));
});

test('la voix anglaise du module 12 : Brielle, les ids du français, sans code brut', () => {
  const br = JSON.parse(lire('tools/voix/en/bases-relationnelles.json'));
  let total = 0;
  for (const c of M12) {
    const fr = JSON.parse(lire(`tools/voix/${c}.json`)), en = JSON.parse(lire(`tools/voix/en/${c}.json`));
    assert.equal(en.langue, 'en'); assert.equal(en.cours, c); assert.deepEqual(en.voix, br.voix, c); assert.equal(en.modele, fr.modele);
    const ids = fr.elements.map(e => e.id), chs = ids.filter(i => /^ch/.test(i));
    assert.deepEqual(en.elements.map(e => e.id), ids.filter(i => en.elements.some(e => e.id === i)), `${c} : l’ordre du français`);
    assert.ok(!en.elements.some(e => e.id === chs[chs.length - 1]), `${c} : le « Pour finir » n’est pas joué dans l’appli`);
    assert.ok(fr.elements.every(e => en.elements.some(x => x.id === e.id) || /^indice/.test(e.id) || e.id === chs[chs.length - 1]), c);
    for (const e of en.elements) {
      const t = e.texte.replace(/^\[\w+\]\s*/, '');
      assert.ok(t.length > 3, `${c} ${e.id} : vide`);
      assert.ok(!/[«»<>=≠→↔⇔|+*%_×÷−'"@]| … |\.\.|\w\(|[A-Za-z_]\.[A-Za-z]|&[a-z]+;|Pour finir|idées à retenir|atelier|inscription|cadeau|remplacement|places_restantes/.test(t), `${c} ${e.id} : ${t}`);
      if (e.cles) assert.equal(e.phrases.length, e.cles.length, `${c} ${e.id}`);
    }
    total += en.elements.reduce((a, e) => a + e.texte.length, 0);
  }
  assert.ok(total > 9000 && total < 13500, `${total} caractères (autant de crédits)`);
  assert.ok(JSON.parse(lire('tools/voix/en/projet-concurrence.json')).elements.some(e => e.texte.includes('Select for update reads the spots')));
});

/* Module 13 (« Procédures et triggers », 15 novembre) : CALL expedier_commande, calculer_points, le trigger garder_prix et la table historique_prix */
const M13 = ['projet-procedures', 'projet-trigger'];
test('le module 13 en entier : les routines de la base (ship_order, calculate_points) et le trigger track_price ; requêtes écrites pour la base avant la frappe', () => {
  const f = x => [String([...new Set(x.match(/\{\w+\}/g) || [])].sort()), String((x.match(/<\d+\/?>/g) || []).sort())];
  for (const c of M13) {
    const pg = lire(`assets/anim/${c}.html`), textes = textesDe(c);
    assert.ok(pg.includes(`<script src="../../langues.js?v=4" data-textes="{langue}/${c}.js?v=1"></script>`), c);
    assert.ok(Object.keys(textes).length > 200, `${c} : ${Object.keys(textes).length} textes`);
    for (const k in textes) assert.deepEqual(f(textes[k]), f(k), `${c} : ${k}`);
    for (const v of Object.values(textes)) assert.ok(!/[«»]|\s[:;?!](?!\S)/.test(v.replace(/\{\w+\}/g, 'X')), `${c} : la typographie anglaise : ${v}`);
    for (const g of [`'./assets/anim/en/${c}.js?v=1'`, `'./assets/anim/en/${c}-thumb.webp'`]) assert.ok(sw.includes(g), g);
    assert.ok(fs.statSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)).size > 10000, c);
    assert.ok(pg.includes(`<body data-table="${c === 'projet-procedures' ? 'commandes' : 'produits'}">`), c);
    assert.ok(pg.indexOf("$$('.sq .ln').forEach(el => LG.ecrireCode(el));") > 0 && pg.indexOf("$$('.sq .ln').forEach(el => LG.ecrireCode(el));") < pg.indexOf("  $$('.sq .ln').forEach(splitChars);"), c);
  }
  const {L, ctx} = anglais();
  vm.runInNewContext(lire('assets/anim/en/projet-trigger.js'), ctx);   // historique_prix : une table de cette page seulement
  /* les noms des routines (suivis d’une parenthèse, comme une fonction SQL) sont dans les défauts de la base : traduits */
  for (const [q, en] of [['CALL expedier_commande(13);', 'CALL ship_order(13);'], ['SELECT calculer_points(80);', 'SELECT calculate_points(80);'],
    ['CREATE PROCEDURE expedier_commande(id_commande INT)', 'CREATE PROCEDURE ship_order(order_id INT)'], ['CREATE FUNCTION calculer_points(montant NUMERIC)', 'CREATE FUNCTION calculate_points(amount NUMERIC)'],
    ['SELECT COUNT(*), ROUND(AVG(prix), 2) FROM produits', 'SELECT COUNT(*), ROUND(AVG(price), 2) FROM products'],
    ['CREATE TRIGGER garder_prix AFTER UPDATE ON produits WHEN OLD.prix <> NEW.prix', 'CREATE TRIGGER track_price AFTER UPDATE ON products WHEN OLD.price <> NEW.price'],
    ['INSERT INTO historique_prix (produit_id, ancien_prix, nouveau_prix, date_changement) VALUES (OLD.id, OLD.prix, NEW.prix, CURRENT_TIMESTAMP);',
      'INSERT INTO price_history (product_id, old_price, new_price, change_date) VALUES (OLD.id, OLD.price, NEW.price, CURRENT_TIMESTAMP);']])
    assert.equal(L.sql(q, 'produits'), en, q);
  assert.ok(lire('assets/anim/projet-procedures.html').includes('<span data-en="E">É</span>'), 'PROCEDURES');
  assert.equal(textesDe('projet-procedures')['procédure'], 'procedure');
  assert.equal(textesDe('projet-trigger')['La date vient de <1/> :<2/>le {1}/{2}/{3} à {4}:{5}.'], 'The date comes from <1/>:<2/>{2}/{1}/{3} at {4}:{5}.');
  assert.ok(app.replace(/,\n\s*'/g, ",'").includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct'," + [...M2, ...M3, ...M4, ...M5, ...M6, ...M7, ...M8, ...M9, ...M10, 'projet-ondelete', ...M12, ...M13].map(c => `'${c}'`).join(',') + ','));
});

test('la voix anglaise du module 13 : Brielle, les ids du français, sans code brut ; la date du trigger en toutes lettres', () => {
  const br = JSON.parse(lire('tools/voix/en/bases-relationnelles.json'));
  let total = 0;
  for (const c of M13) {
    const fr = JSON.parse(lire(`tools/voix/${c}.json`)), en = JSON.parse(lire(`tools/voix/en/${c}.json`));
    assert.equal(en.langue, 'en'); assert.equal(en.cours, c); assert.deepEqual(en.voix, br.voix, c); assert.equal(en.modele, fr.modele);
    const ids = fr.elements.map(e => e.id), chs = ids.filter(i => /^ch/.test(i));
    assert.deepEqual(en.elements.map(e => e.id), ids.filter(i => en.elements.some(e => e.id === i)), `${c} : l’ordre du français`);
    assert.ok(!en.elements.some(e => e.id === chs[chs.length - 1]), `${c} : le « Pour finir » n’est pas joué dans l’appli`);
    assert.ok(fr.elements.every(e => en.elements.some(x => x.id === e.id) || /^indice/.test(e.id) || e.id === chs[chs.length - 1]), c);
    for (const e of en.elements) {
      const t = e.texte.replace(/^\[\w+\]\s*/, '');
      assert.ok(t.length > 3, `${c} ${e.id} : vide`);
      assert.ok(!/[«»<>=≠→↔⇔|+*%_×÷−'"@]| … |\.\.|\w\(|[A-Za-z_]\.[A-Za-z]|&[a-z]+;|Pour finir|idées à retenir|commande|historique|garder|calculer|\d\/\d/.test(t), `${c} ${e.id} : ${t}`);
      if (e.cles) assert.equal(e.phrases.length, e.cles.length, `${c} ${e.id}`);
    }
    total += en.elements.reduce((a, e) => a + e.texte.length, 0);
  }
  assert.ok(total > 5500 && total < 8000, `${total} caractères (autant de crédits)`);
  assert.ok(JSON.parse(lire('tools/voix/en/projet-trigger.json')).elements.some(e => e.texte.includes('October 25, 2026, at 14:32')));
});

/* Module 14 (« Vues, index et optimisation », 15 novembre) : CREATE VIEW catalogue_box, CREATE INDEX idx_commandes_numero et EXPLAIN QUERY PLAN */
const M14 = ['projet-vue', 'projet-index'];
test('le module 14 en entier : la vue box_catalog, l’index idx_orders_number ; le deux-points qui suit un code, sans espace en anglais', () => {
  const f = x => [String([...new Set(x.match(/\{\w+\}/g) || [])].sort()), String((x.match(/<\d+\/?>/g) || []).sort())];
  for (const c of M14) {
    const pg = lire(`assets/anim/${c}.html`), textes = textesDe(c);
    assert.ok(pg.includes(`<script src="../../langues.js?v=4" data-textes="{langue}/${c}.js?v=1"></script>`), c);
    assert.ok(Object.keys(textes).length > 200, `${c} : ${Object.keys(textes).length} textes`);
    for (const k in textes) assert.deepEqual(f(textes[k]), f(k), `${c} : ${k}`);
    for (const v of Object.values(textes)) assert.ok(!/[«»]|\s[:;?!](?!\S)/.test(v.replace(/\{\w+\}/g, 'X')), `${c} : la typographie anglaise : ${v}`);
    for (const g of [`'./assets/anim/en/${c}.js?v=1'`, `'./assets/anim/en/${c}-thumb.webp'`]) assert.ok(sw.includes(g), g);
    assert.ok(fs.statSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)).size > 10000, c);
    assert.ok(pg.includes(`<body data-table="${c === 'projet-vue' ? 'produits' : 'commandes'}">`), c);
    assert.ok(pg.indexOf("$$('.sq .ln').forEach(el => LG.ecrireCode(el));") > 0 && pg.indexOf("$$('.sq .ln').forEach(el => LG.ecrireCode(el));") < pg.indexOf("  $$('.sq .ln').forEach(splitChars);"), c);
  }
  const {L} = anglais();
  for (const [q, en] of [['CREATE VIEW catalogue_box AS SELECT nom, categorie, prix FROM produits WHERE selection_box = 1;', 'CREATE VIEW box_catalog AS SELECT name, category, price FROM products WHERE box_selection = 1;'],
    ['SELECT * FROM catalogue_box;', 'SELECT * FROM box_catalog;'], ['CREATE INDEX idx_commandes_numero ON commandes(numero_commande);', 'CREATE INDEX idx_orders_number ON orders(order_number);'],
    ["EXPLAIN QUERY PLAN SELECT * FROM commandes WHERE numero_commande = 'NB-10482';", "EXPLAIN QUERY PLAN SELECT * FROM orders WHERE numero_commande = 'NB-10482';".replace('numero_commande', 'order_number')]])
    assert.equal(L.sql(q, 'produits'), en, q);
  /* « <code>SCAN commandes</code> : les lignes… » : en anglais, le deux-points suit le code */
  const langues = lire('langues.js');
  assert.ok(langues.includes("var av = /^[:;!?]/.test(r) ? c.avant.replace(/[ \\u00a0\\u202f]+$/, '') : c.avant;"));
  assert.equal(textesDe('projet-index')['Le plan ou la mesure ?'], 'Plan or measurement?');
  assert.ok(app.replace(/,\n\s*'/g, ",'").includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct'," + [...M2, ...M3, ...M4, ...M5, ...M6, ...M7, ...M8, ...M9, ...M10, 'projet-ondelete', ...M12, ...M13, ...M14].map(c => `'${c}'`).join(',') + ','));
});

test('la voix anglaise du module 14 : Brielle, les ids du français, sans code brut', () => {
  const br = JSON.parse(lire('tools/voix/en/bases-relationnelles.json'));
  let total = 0;
  for (const c of M14) {
    const fr = JSON.parse(lire(`tools/voix/${c}.json`)), en = JSON.parse(lire(`tools/voix/en/${c}.json`));
    assert.equal(en.langue, 'en'); assert.equal(en.cours, c); assert.deepEqual(en.voix, br.voix, c); assert.equal(en.modele, fr.modele);
    const ids = fr.elements.map(e => e.id), chs = ids.filter(i => /^ch/.test(i));
    assert.deepEqual(en.elements.map(e => e.id), ids.filter(i => en.elements.some(e => e.id === i)), `${c} : l’ordre du français`);
    assert.ok(!en.elements.some(e => e.id === chs[chs.length - 1]), `${c} : le « Pour finir » n’est pas joué dans l’appli`);
    assert.ok(fr.elements.every(e => en.elements.some(x => x.id === e.id) || /^indice/.test(e.id) || e.id === chs[chs.length - 1]), c);
    for (const e of en.elements) {
      const t = e.texte.replace(/^\[\w+\]\s*/, '');
      assert.ok(t.length > 3, `${c} ${e.id} : vide`);
      assert.ok(!/[«»<>=≠→↔⇔|+*%_×÷−'"@]| … |\.\.|\w\(|[A-Za-z_]\.[A-Za-z]|&[a-z]+;|Pour finir|idées à retenir|commande|catalogue_|selection_| :/.test(t), `${c} ${e.id} : ${t}`);
      if (e.cles) assert.equal(e.phrases.length, e.cles.length, `${c} ${e.id}`);
    }
    total += en.elements.reduce((a, e) => a + e.texte.length, 0);
  }
  assert.ok(total > 5500 && total < 8000, `${total} caractères (autant de crédits)`);
});

/* Module 15 (« Sécurité et droits », 15 novembre) : GRANT, REVOKE et la vue commandes_expedition ; le dernier module */
test('le module 15 : GRANT et REVOKE en anglais, la vue shipping_orders ; les droits de la fiche de Lina sont du code ; tous les modules ont leur vignette', () => {
  const f = x => [String([...new Set(x.match(/\{\w+\}/g) || [])].sort()), String((x.match(/<\d+\/?>/g) || []).sort())];
  const c = 'projet-droits', pg = lire(`assets/anim/${c}.html`), textes = textesDe(c);
  assert.ok(pg.includes(`<script src="../../langues.js?v=4" data-textes="{langue}/${c}.js?v=1"></script>`));
  assert.ok(Object.keys(textes).length > 200, `${Object.keys(textes).length} textes`);
  for (const k in textes) assert.deepEqual(f(textes[k]), f(k), k);
  for (const v of Object.values(textes)) assert.ok(!/[«»]|\s[:;?!](?!\S)/.test(v.replace(/\{\w+\}/g, 'X')), `la typographie anglaise : ${v}`);
  for (const g of [`'./assets/anim/en/${c}.js?v=1'`, `'./assets/anim/en/${c}-thumb.webp'`]) assert.ok(sw.includes(g), g);
  assert.ok(fs.statSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)).size > 10000);
  assert.ok(pg.includes('<body data-table="commandes">'));
  assert.ok(pg.includes("Course({codeSel: '.fcd', duration: DURATION,"), 'les droits de la fiche du compte (SELECT · commandes_expedition) sont du code');
  /* le prix tapé dans l’application de Lina, traduit avant d’être découpé pour la frappe (1,00 € : €1.00) */
  assert.ok(pg.indexOf("$$('#pfl').forEach(el => { el.textContent = LG.t(el.textContent); });") > 0 && pg.indexOf("$$('#pfl').forEach(el => { el.textContent = LG.t(el.textContent); });") < pg.indexOf("  $$('#pfl').forEach(splitChars);"));
  assert.equal(textes['{1} €'], '€{1}');
  const {L} = anglais();
  for (const [q, en] of [['GRANT SELECT ON commandes_expedition TO lina;', 'GRANT SELECT ON shipping_orders TO lina;'], ['GRANT UPDATE (statut) ON commandes TO lina;', 'GRANT UPDATE (status) ON orders TO lina;'],
    ['REVOKE SELECT ON commandes_expedition FROM lina;', 'REVOKE SELECT ON shipping_orders FROM lina;'], ['UPDATE produits SET prix = 1 WHERE id = 2;', 'UPDATE products SET price = 1 WHERE id = 2;'],
    ['SELECT numero_commande, destinataire, adresse_livraison, statut FROM commandes_expedition', 'SELECT order_number, recipient, shipping_address, status FROM shipping_orders']])
    assert.equal(L.sql(q, 'commandes'), en, q);
  assert.ok(app.replace(/,\n\s*'/g, ",'").includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct'," + [...M2, ...M3, ...M4, ...M5, ...M6, ...M7, ...M8, ...M9, ...M10, 'projet-ondelete', ...M12, ...M13, ...M14, c].map(c => `'${c}'`).join(',') + ']};'));
  /* toutes les vidéos de l’appli ont maintenant leur vignette anglaise */
  const videos = [...app.matchAll(/video:\{anim:'assets\/anim\/([a-z0-9-]+)\.html/g)].map(m => m[1]);
  const vignettes = /const LV_VIGNETTES=\{en:\[([\s\S]*?)\]\};/.exec(app)[1];
  for (const v of videos) assert.ok(vignettes.includes(`'${v}'`), `la vignette anglaise de ${v}`);
  /* la voix */
  const fr = JSON.parse(lire(`tools/voix/${c}.json`)), en = JSON.parse(lire(`tools/voix/en/${c}.json`));
  assert.equal(en.langue, 'en'); assert.deepEqual(en.voix, JSON.parse(lire('tools/voix/en/bases-relationnelles.json')).voix);
  assert.deepEqual(en.elements.map(e => e.id), fr.elements.map(e => e.id).filter(i => en.elements.some(e => e.id === i)));
  for (const e of en.elements) {
    const t = e.texte.replace(/^\[\w+\]\s*/, '');
    assert.ok(t.length > 3 && !/[«»<>=≠→↔⇔|+*%_×÷−'"@]| … |\.\.|\w\(|[A-Za-z_]\.[A-Za-z]|commande|expedition|droit|Pour finir|after from/.test(t), `${e.id} : ${t}`);
  }
  const total = en.elements.reduce((a, e) => a + e.texte.length, 0);
  assert.ok(total > 3000 && total < 4500, `${total} caractères`);
});
