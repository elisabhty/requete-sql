/* Elisa, 13 novembre, 12 h 30 : « tu peux mettre un truc en place pour faciliter la traduction dans plusieurs langues, en premier
   anglais ». Ses choix : les tables des cours passent en anglais dans la version anglaise ; d’abord le système et un pilote
   (l’onboarding et les écrans principaux), les cours module par module.
   - langues.js : le français reste la source ; dans une autre langue, les textes sont remplacés à l’affichage par ceux du fichier
     de la langue (langue-en.js). En français, il ne fait rien.
   - Une langue en cours de traduction (« essai ») n’est proposée qu’aux iPhone en essai ; jamais choisie toute seule.
   - Le SQL : sql() récrit une requête pour la base de la langue, base() renomme les tables, les colonnes et les valeurs.
   La traduction de la page elle-même (l’observateur) se vérifie dans un navigateur ; ici, tout le reste. */
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

/* langues.js dans une fausse page. stock : le stockage de l’iPhone ; langue : celle de l’iPhone. */
function page({stock = {}, langue = 'fr-FR', charger = true} = {}) {
  const ecrits = [], local = {...stock};
  const win = {};
  const ctx = {window: win, navigator: {language: langue}, location: {hostname: 'localhost.invalide', search: '', reload() { win.recharge = true; }},
    localStorage: {getItem: k => (k in local ? local[k] : null), setItem: (k, v) => { local[k] = String(v); }, removeItem: k => { delete local[k]; }},
    document: {write: h => ecrits.push(h), documentElement: {}, title: '', addEventListener() {}}, Map, WeakMap, JSON, Object, Array, String, RegExp, Math};
  vm.runInNewContext(MOTEUR, ctx);
  const L = win.REQUETE_LANGUE;
  if (charger && ecrits.length) vm.runInNewContext(EN, ctx);
  return {L, ecrits, local, win};
}
const ESSAI = {'requete-maj-canal': '"essai"'};
const anglais = () => page({stock: {...ESSAI, 'requete-langue': 'en'}}).L;

test('en français, langues.js ne fait rien', () => {
  const p = page();
  assert.equal(p.L.code, 'fr');
  assert.deepEqual(p.ecrits, [], 'aucun fichier de langue chargé');
  assert.equal(p.L.t('Continuer'), 'Continuer');
  assert.equal(p.L.sql('SELECT nom FROM clients'), 'SELECT nom FROM clients');
  assert.deepEqual([...p.L.disponibles()], ['fr'], 'une langue en essai n’est pas proposée');
  assert.deepEqual(p.L.manquants(), []);
  assert.equal(p.L.changer('en'), false);
});

test('la langue de l’iPhone : jamais une langue inachevée toute seule, seulement sur un iPhone en essai qui l’a choisie', () => {
  assert.equal(page({langue: 'en-US'}).L.code, 'fr', 'un iPhone en anglais reste en français tant que l’anglais est en essai');
  assert.equal(page({stock: {'requete-langue': 'en'}}).L.code, 'fr', 'le choix seul ne suffit pas : il faut être en essai');
  assert.equal(page({stock: ESSAI, langue: 'en-US'}).L.code, 'fr', 'en essai, mais sans l’avoir choisie');
  const p = page({stock: {...ESSAI, 'requete-langue': 'en'}});
  assert.equal(p.L.code, 'en');
  assert.equal(p.L.locale, 'en-US');
  assert.deepEqual(p.ecrits, ['<script src="langue-en.js?v=1"><\/script>'], 'le fichier de la langue est chargé tout de suite, avant le reste de la page');
  assert.deepEqual([...p.L.disponibles()], ['fr', 'en']);
  assert.equal(p.L.nom('en'), 'English');
  /* changer de langue : enregistré, puis l’appli se recharge */
  assert.equal(p.L.changer('fr'), true);
  assert.equal(p.local['requete-langue'], 'fr');
  assert.equal(p.win.recharge, true);
  assert.equal(p.L.changer('de'), false);
  assert.ok(/en: \{ nom: 'English', locale: 'en-US', fichier: 'langue-en\.js\?v=1', essai: true \}/.test(MOTEUR), 'l’anglais reste en essai tant que sa traduction n’est pas terminée');
});

test('traduire un texte : tel quel, avec ses nombres, le prénom, les mois et les jours ; sans traduction, il reste en français et il est noté', () => {
  const L = anglais();
  assert.equal(L.t('Continuer'), 'Continue');
  assert.equal(L.t('Étape 3 sur 14'), 'Step 3 of 14');
  assert.equal(L.t('Étape 3 sur 14'), 'Step 3 of 14', 'les espaces insécables ne changent rien');
  assert.equal(L.t('Le 12 novembre 2026'), 'November 12, 2026');
  assert.equal(L.t('sam.'), 'Sat');
  assert.equal(L.t('2 jours / semaine : Lundi et jeudi'), '2 days / week: Monday and Thursday');
  assert.equal(L.t('Plus de 1 000 personnes apprécient Requête'), 'More than 1,000 people love Requête');
  L.valeur('prenom', () => 'Maëlle');
  assert.equal(L.t('Tu vis <1>où</1>, Maëlle ?'), '<1>Where</1> do you live, Maëlle?');
  assert.equal(L.t('Ton parcours est prêt, <1>Maëlle</1>.'), 'Your path is ready, <1>Maëlle</1>.');
  /* les numéros des morceaux ne sont pas pris pour des nombres */
  assert.equal(L.t('<1>En 123 jours. </1>Avec <2>10 minutes</2>, 2 jours par semaine, tu termines tes <3>71 leçons</3> d’ici le <4>15 mars</4>.'),
    '<1>In 123 days. </1>With <2>10 minutes</2>, 2 days a week, you’ll finish your <3>71 lessons</3> by <4>March 15</4>.');
  assert.deepEqual(L.manquants(), []);
  assert.equal(L.t('Une phrase que personne n’a traduite'), 'Une phrase que personne n’a traduite');
  assert.deepEqual(L.manquants(), ['Une phrase que personne n’a traduite']);
  assert.equal(L.t('SELECT nom FROM clients;'), 'SELECT nom FROM clients;');
  assert.equal(L.manquants().length, 1, 'du SQL n’est pas un texte à traduire');
});

test('le fichier de la langue : chaque traduction garde les nombres, les mots et les morceaux de son texte', () => {
  let contenu = null;
  vm.runInNewContext(EN, {window: {REQUETE_LANGUE: {charger: (c, o) => { contenu = [c, o]; }}}});
  assert.equal(contenu[0], 'en');
  const {textes, mots, base} = contenu[1];
  const jetons = s => (String(s).match(/\{[a-z0-9]+\}|<\/?\d+\/?>/g) || []).sort().join(' ');
  let n = 0;
  for (const [fr, en] of Object.entries(textes)) {
    n++;
    assert.ok(typeof en === 'string' && en.trim(), `traduction vide : ${fr}`);
    assert.equal(jetons(en), jetons(fr), `mêmes nombres, mots et morceaux : ${fr}`);
    assert.equal(fr, fr.replace(/\s+/g, ' ').trim(), `clé avec des espaces simples : ${fr}`);
    assert.ok(!/[  ]/.test(fr), `clé sans espace insécable : ${fr}`);
  }
  assert.ok(n >= 200, 'le pilote : l’onboarding');
  assert.equal(Object.keys(mots).length, 34, '12 mois, 8 abréviations, 7 jours, 7 abréviations');
  /* la base des cours : les quatre tables de NutriBoost, toutes leurs colonnes */
  const schema = /const SCHEMA_SQL = `([\s\S]*?)`;/.exec(app)[1];
  for (const [table, [nom, colonnes]] of Object.entries(base.tables)) {
    const m = new RegExp(`CREATE TABLE ${table}\\s*\\(([\\s\\S]*?)\\);`).exec(schema);
    assert.ok(m, `table du cours : ${table}`);
    const reelles = m[1].split('\n').map(l => l.trim().split(/\s+/)[0]).filter(c => /^[a-z_]+$/.test(c));
    assert.deepEqual(Object.keys(colonnes).sort(), [...new Set(reelles)].sort(), `colonnes de ${table}`);
    assert.match(nom, /^[a-z_]+$/);
  }
  assert.deepEqual(Object.keys(base.tables).sort(), ['clients', 'commandes', 'fidelite', 'produits']);
});

test('le SQL : une requête récrite pour la base anglaise (tables, colonnes selon leur table, valeurs)', () => {
  const L = anglais();
  const cas = [
    ['SELECT nom, prix FROM produits WHERE categorie = \'Beauté\';', 'SELECT name, price FROM products WHERE category = \'Beauty\';'],
    ['SELECT prenom, nom FROM clients WHERE ville = \'Paris\'', 'SELECT first_name, last_name FROM customers WHERE city = \'Paris\''],
    ['SELECT c.nom, COUNT(*) AS nb FROM clients c JOIN commandes co ON co.client_id = c.id WHERE co.statut = \'expédiée\' GROUP BY c.nom',
      'SELECT c.last_name, COUNT(*) AS nb FROM customers c JOIN orders co ON co.customer_id = c.id WHERE co.status = \'shipped\' GROUP BY c.last_name'],
    ['select clients.nom, produits.nom from clients, produits', 'select customers.last_name, products.name from customers, products'],
    ['SELECT NOM FROM CLIENTS', 'SELECT LAST_NAME FROM CUSTOMERS'],
    ['SELECT p.nom AS produit, SUM(co.quantite) FROM commandes AS co INNER JOIN produits AS p ON p.id = co.produit_id GROUP BY p.nom',
      'SELECT p.name AS produit, SUM(co.quantity) FROM orders AS co INNER JOIN products AS p ON p.id = co.product_id GROUP BY p.name'],
    ['SELECT \'nom\' AS texte -- la colonne nom\nFROM fidelite WHERE points > 100', 'SELECT \'nom\' AS texte -- la colonne nom\nFROM loyalty WHERE points > 100'],
    ['SELECT COUNT(*) FROM commandes WHERE date_commande >= \'2024-01-01\'', 'SELECT COUNT(*) FROM orders WHERE order_date >= \'2024-01-01\''],
  ];
  for (const [fr, en] of cas) assert.equal(L.sql(fr), en);
  assert.equal(L.sql(null), null);
});

test('le SQL : sur la vraie base du cours, la requête récrite donne le même résultat que la requête d’origine', async () => {
  const init = createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'));
  const SQL = await init({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
  const schema = /const SCHEMA_SQL = `([\s\S]*?)`;/.exec(app)[1];
  const L = anglais();
  const fr = new SQL.Database(); fr.run(schema);
  const en = L.base((() => { const d = new SQL.Database(); d.run(schema); return d; })());
  assert.deepEqual(en.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1")[0].values.flat(), ['customers', 'loyalty', 'orders', 'products']);
  assert.deepEqual(en.exec('SELECT * FROM customers LIMIT 1')[0].columns, ['id', 'first_name', 'last_name', 'address', 'city', 'age', 'email', 'phone', 'signup_date']);
  assert.deepEqual(en.exec('SELECT DISTINCT status FROM orders ORDER BY 1')[0].values.flat(), ['processing', 'shipped']);
  const valeurs = {'expédiée': 'shipped', 'en_preparation': 'processing', 'Bien-être': 'Wellness', 'Beauté': 'Beauty', 'Boisson': 'Drink', 'Accessoire': 'Accessory'};
  const requetes = [
    'SELECT prenom, nom, ville FROM clients WHERE ville = \'Paris\' ORDER BY nom',
    'SELECT nom, prix FROM produits WHERE prix > 20 ORDER BY prix DESC, nom',
    'SELECT ville, COUNT(*) AS nb FROM clients GROUP BY ville ORDER BY nb DESC, ville',
    'SELECT c.prenom, p.nom, co.quantite FROM commandes co JOIN clients c ON c.id = co.client_id JOIN produits p ON p.id = co.produit_id WHERE co.statut = \'expédiée\' ORDER BY co.id',
    'SELECT categorie, ROUND(AVG(prix), 2) FROM produits GROUP BY categorie HAVING COUNT(*) >= 1 ORDER BY categorie',
    'SELECT c.nom, f.points FROM clients c LEFT JOIN fidelite f ON f.client_id = c.id ORDER BY c.id',
    'SELECT nom FROM produits WHERE id IN (SELECT produit_id FROM commandes WHERE quantite >= 2) ORDER BY nom',
    'SELECT statut, COUNT(*) FROM commandes GROUP BY statut ORDER BY COUNT(*) DESC',
  ];
  for (const q of requetes) {
    const a = fr.exec(q)[0], b = en.exec(L.sql(q))[0];
    assert.ok(a && a.values.length, `la requête d’origine rend des lignes : ${q}`);
    const traduit = a.values.map(l => l.map(v => (v in valeurs ? valeurs[v] : v)));
    const trier = t => t.map(l => JSON.stringify(l)).sort();
    assert.deepEqual(trier(b.values), trier(traduit), q);
  }
});

test('index.html : langues.js juste après maj.js, le prénom confié au moteur, le choix de la langue seulement en essai', () => {
  const i = app.indexOf('<script src="maj.js?v=1"></script>'), j = app.indexOf('<script src="langues.js?v=1"></script>');
  assert.ok(i > 0 && j > i && j < app.indexOf('<script src="vendor/sqljs/sql-wasm.js"></script>'));
  assert.ok(sw.includes("'./langues.js?v=1',") && sw.includes("'./langue-en.js?v=1',"));
  assert.ok(app.includes("window.REQUETE_LANGUE.valeur('prenom',()=>state.name)"));
  assert.ok(app.includes('onclick="majEssaiTap()">${esc(appVersionNote())}</p>${langueNoteHTML()}'));
  const d = app.indexOf('function langueNoteHTML(){'), f = app.indexOf('let majTaps=[];');
  const ctx = {window: {}, esc: s => String(s)};
  vm.runInNewContext(app.slice(d, f) + ';this.html=langueNoteHTML;', ctx);
  assert.equal(ctx.html(), '', 'sans le moteur : rien');
  ctx.window.REQUETE_LANGUE = {code: 'fr', disponibles: () => ['fr'], nom: c => c};
  assert.equal(ctx.html(), '', 'une seule langue : la ligne n’existe pas');
  ctx.window.REQUETE_LANGUE = {code: 'en', disponibles: () => ['fr', 'en'], nom: c => ({fr: 'Français', en: 'English'})[c]};
  const h = ctx.html();
  assert.ok(h.includes('id="app-langue-note" data-notrad') && h.includes("REQUETE_LANGUE.changer('fr')") && h.includes("REQUETE_LANGUE.changer('en')"));
  assert.ok(/aria-pressed="true"[^>]*>English/.test(h) && /aria-pressed="false"[^>]*>Français/.test(h));
  /* les fichiers de langue partent avec l’appli (scripts/build-www.mjs copie les .js de la racine) */
  assert.ok(fs.existsSync(path.join(ROOT, 'langues.js')) && fs.existsSync(path.join(ROOT, 'langue-en.js')));
  assert.ok(lire('LANGUES.md').includes('REQUETE_LANGUE.manquants()'));
});
