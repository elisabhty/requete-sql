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
  assert.ok(MOTEUR.includes("return /[A-Za-zÀ-ÿ]{2}/.test(s) || /\\d\\s?€/.test(s);"));
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
  assert.ok(app.replace(/,\n\s*'/g, ",'").includes("const LV_VIGNETTES={en:['bases-relationnelles','as','distinct'," + [...M2, ...M3].map(c => `'${c}'`).join(',') + ']};'));
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
