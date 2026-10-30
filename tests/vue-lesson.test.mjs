/* Projet NutriBoost, chapitre 16 (leçon 64 « CREATE VIEW ») : la vidéo interactive assets/anim/projet-vue.html, testée aussi dans lesson-video.test.mjs.
   La trame est celle d’Elisa (26 octobre, 10 h 52, « CREATE VIEW — La sélection surprise dévoilée trop tôt ») : NutriBoost prépare une box
   surprise ; une agence doit créer la page de présentation à partir du catalogue produits, sans recevoir ni les stocks ni les produits qui ne
   font pas partie de la sélection. Camille Roux, la responsable des opérations, demande une vue dédiée : catalogue_box (le nom, la catégorie
   et le prix des produits sélectionnés, ceux dont la colonne selection_box, ajoutée par Karim, le développeur, vaut 1). Puis, les coûts
   recalculés, le magnésium remplace la protéine (Elisa, 13 h 39) : consultée à nouveau, la vue montre la nouvelle sélection, sans être recréée. Ce que la vidéo montre est ici rejoué dans SQLite : c’est ce que la base répond vraiment.
   Leçon seule : ni cours texte, ni exercice ; elle remplace l’ancien cours texte CREATE VIEW (gardé comme exemple de cours texte dans
   tests/fixtures/guide-texte-create-view.js). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-vue.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l64 = lessons.find(l => l.id === 64);

/* Les données de la page (le déroulé des légendes, les messages, les six moments), évaluées telles quelles. */
const a = page.indexOf('const SCH = '), b = page.indexOf('/* ---------- Gabarits');
assert.ok(a > 0 && b > a, 'données de la page localisées');
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(a, b), D);
const val = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, D));
const strip = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/* Les requêtes que la page tape, telles qu’elle les écrit (gabarits Q_…) : sans le commentaire ni le balisage {repère|texte}. */
const Q = vm.createContext({});
vm.runInContext([...page.matchAll(/^const Q_[A-Z0-9]+ = [\s\S]*?\]\];$/gm)].map(m => m[0]).join('\n') + ';this.Q = {Q_VIEW, Q_SEL};', Q);
const sql = q => Q.Q[q].map(([s]) => s).filter(s => !s.trim().startsWith('--')).join('\n').replace(/\{\w+\|([^{}]*)\}/g, '$1');

/* ---------- La base de la vidéo ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
/* La base NutriBoost telle que le chapitre 15 la laisse (douze tables ; l’inscription de Léa Simon à l’atelier Cuisine saine du 14 novembre,
   confirmée : il n’y reste plus de place), puis la colonne selection_box que Karim, le développeur, ajoute à la table produits : la Tisane
   Détox, la Protéine Végétale et le Shaker Inox sont dans la box. */
function base() {
  const db = new SQL.Database();
  db.run(vm.runInContext('SCHEMA_SQL', ctx));
  /* Le chapitre 10 (MERGE, 30 octobre) : l’inventaire de l’entrepôt met à jour la Fibre Prébiotique (150) et Oméga 3 (75), et ajoute la Spiruline Bio. */
  db.run("UPDATE produits SET stock = 150 WHERE id = 1; UPDATE produits SET stock = 75 WHERE id = 7; INSERT INTO produits VALUES (9, 'Spiruline Bio', 'Nutrition', 22.90, 40);");
  db.run(`PRAGMA foreign_keys = ON;
    CREATE TABLE coachs (id INTEGER PRIMARY KEY, prenom TEXT NOT NULL, nom TEXT NOT NULL, email TEXT NOT NULL);
    CREATE TABLE ateliers (id INTEGER PRIMARY KEY, titre TEXT NOT NULL, date_atelier DATE, coach_id INTEGER NOT NULL REFERENCES coachs(id), places INTEGER DEFAULT 12);
    CREATE TABLE inscriptions (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id), atelier_id INTEGER NOT NULL REFERENCES ateliers(id), date_inscription DATE);
    CREATE TABLE cartes (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL UNIQUE REFERENCES clients(id), seances_restantes INTEGER NOT NULL DEFAULT 10 CHECK (seances_restantes >= 0));
    INSERT INTO coachs VALUES (1,'Salma','Haddad','salma@pro.fr'),(2,'Moussa','Diallo','moussa@mail.fr'),(3,'Julie','Nguyen','julie@mail.fr'),(4,'Diego','Ramos','diego@mail.fr');
    INSERT INTO ateliers VALUES (1,'Récupération','2026-09-12',1,12),(2,'Pilates','2026-09-18',2,12),(3,'Cuisine saine','2026-09-19',3,12),(4,'Méditation','2026-09-24',4,12),(5,'Yoga du matin','2026-10-03',2,12);
    INSERT INTO inscriptions VALUES (1,1,1,'2026-09-01'),(2,4,1,'2026-09-02'),(3,5,2,'2026-09-03'),(5,3,1,'2026-09-05'),(7,1,4,'2026-09-07'),
      (8,2,3,'2026-09-08'),(10,8,5,'2026-09-09'),(11,9,5,'2026-09-09');
    INSERT INTO cartes VALUES (1,1,12),(2,4,7),(3,6,20);
    DELETE FROM clients WHERE id = 10;
    CREATE TABLE avis (id INTEGER PRIMARY KEY, client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL, produit_id INTEGER REFERENCES produits(id), note INTEGER, commentaire TEXT);
    INSERT INTO avis VALUES (1, 9, 6, 5, 'Je recommande !');
    DELETE FROM inscriptions WHERE client_id = 9;
    DELETE FROM clients WHERE id = 9;
    CREATE TABLE remplacements (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id), produit_id INTEGER NOT NULL REFERENCES produits(id),
      quantite INTEGER NOT NULL, personnalisation TEXT NOT NULL);
    INSERT INTO remplacements VALUES (1, 7, 8, 1, 'Léa'); UPDATE produits SET stock = stock - 1 WHERE id = 8;
    CREATE TABLE cadeaux (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id), produit_id INTEGER NOT NULL REFERENCES produits(id), quantite INTEGER NOT NULL);
    INSERT INTO cadeaux (client_id, produit_id, quantite) VALUES (7, 6, 1); UPDATE produits SET stock = stock - 1 WHERE id = 6;
    CREATE TABLE historique_prix (produit_id INTEGER REFERENCES produits(id), ancien_prix REAL, nouveau_prix REAL, date_changement TEXT);
    INSERT INTO historique_prix VALUES (2, 39.9, 34.9, '2026-10-25 14:32:00'); UPDATE produits SET prix = 34.9, stock = stock - 1 WHERE id = 2;
    ALTER TABLE ateliers ADD COLUMN places_restantes INTEGER;
    INSERT INTO ateliers VALUES (6, 'Cuisine saine', '2026-11-14', 3, 8, 1);
    INSERT INTO inscriptions (client_id, atelier_id, date_inscription) VALUES (7, 6, '2026-10-25'); UPDATE ateliers SET places_restantes = places_restantes - 1 WHERE id = 6;`);
  return db;
}
/* La colonne de Karim, le développeur : 1 pour un produit de la box, 0 sinon. */
const SELECTION = 'ALTER TABLE produits ADD COLUMN selection_box INTEGER NOT NULL DEFAULT 0; UPDATE produits SET selection_box = 1 WHERE id IN (5, 6, 8);';
/* Le message de Camille Roux : le magnésium remplace la protéine ; elle met à jour la sélection dans l’outil de gestion. */
const CHANGEMENT = 'UPDATE produits SET selection_box = 0 WHERE id = 6; UPDATE produits SET selection_box = 1 WHERE id = 3;';
const catalogue = () => { const db = base(); db.run(SELECTION); return db; };
const tables = db => db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(r => r[0]);
const count = (db, t) => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
const lignes = (db, q) => (db.exec(q)[0] || {values: []}).values;
const prix = v => v.toFixed(2);

test('CREATE VIEW : juste après Concurrence et isolation, en tête du module « Vues, index et optimisation », juste avant Les index et EXPLAIN', () => {
  const m = modules.find(x => x.titre === 'Vues, index et optimisation');
  assert.deepEqual([...m.lessons.map(l => l.id)].slice(0, 2), [64, 57], 'CREATE VIEW, puis Les index et EXPLAIN');
  const liste = lessons.map(l => l.id);
  assert.equal(liste.indexOf(64), liste.indexOf(71) + 1, 'juste après Concurrence et isolation');
  assert.equal(l64.titre, 'CREATE VIEW');
  assert.equal(l64.résumé, 'Enregistrer une requête sous un nom');
});

test('recherche et leçon seule : ni texte de secours, ni exercice, ni quiz', () => {
  const mots = html.match(/\n  64:'([^']+)',/)[1];
  assert.ok(['create view', 'vue', 'catalogue_box', 'selection_box', 'box surprise', 'agence', 'droits', 'consultation', 'donnees actuelles'].every(m => mots.includes(m)),
    'trouvé par la recherche : CREATE VIEW, la vue, catalogue_box, selection_box, la box surprise, l’agence, les droits…');
  assert.ok(l64.leconSeule && l64.video && !l64.situation && !l64.consigne && !l64.solution && !l64.petitDefi && !l64.learningCheck && !l64.testeVariants && !l64.anatomie, 'la vidéo est le cours');
  assert.equal(l64.video.moments, 6); assert.equal(l64.video.seuil, 4);
  assert.equal(l64.video.anim, 'assets/anim/projet-vue.html?app&embed');
  const recap = l64.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['📋', '🔄', '🎁'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
  assert.ok(!recap.includes('👁️'), 'une vue : 📋, pas d’œil (Elisa, 13 h 39)');
  assert.equal(vm.runInContext('QCM', ctx)[64], undefined, 'plus de quiz : la vidéo et ses moments valident la leçon (Elisa, 28 octobre)');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  assert.equal(val('NOTES'), 210.54);
  assert.ok(page.includes('notesAt: 210.54,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 217.74);
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999, `légende ${k + 1} : après la précédente`);
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  /* La trame d’Elisa : la box et le message de Camille, le catalogue, la vue créée puis consultée, le changement de sélection, les droits ;
     puis « Dans la vue ou non ? », où l’élève range les informations, et le récapitulatif. */
  assert.deepEqual(chaps.map(c => c.label), ['La box surprise', 'Le catalogue interne', 'Créer la vue', 'Consulter la vue', 'Petit changement', 'Et les droits ?',
    'Dans la vue ou non ?', 'À retenir']);
  caps.forEach(([, , t, lines], k) => {
    const txt = strip(t);
    assert.ok(/^[A-ZÀ-ÖØ-Þ0-9«]/.test(txt) || /^(<b[^>]*>)?<code>/.test(t), `légende ${k + 1} : une phrase qui commence (« ${txt.slice(0, 50)} »)`);
    assert.ok(/[.!?»]$/.test(txt), `légende ${k + 1} : une phrase qui finit (« …${txt.slice(-50)} »)`);
    assert.ok(!/[.!?»] ?[A-ZÀ-ÖØ-Þ«]/.test(txt), `légende ${k + 1} : une seule phrase par bulle (« ${txt.slice(0, 70)} »)`);
    assert.equal(lines, undefined, `légende ${k + 1} : trois lignes au plus`);
    assert.ok(t.split('<br>').length <= 3, `légende ${k + 1} : trois lignes au plus`);
  });
  assert.deepEqual(picks.map(p => p.kind), ['tap', 'pick', 'pick', 'pick', 'tap', 'sort']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    assert.equal(p.options.length, 3, `${p.prompt} : trois réponses`);
    for (const o of p.options) assert.ok(o.why && strip(o.why).length > 30, `${o.label} : une explication`);
  }
  assert.deepEqual(picks[1].options.map(o => !!o.ok), [true, false, false], 'les colonnes : nom, categorie et prix');
  assert.deepEqual(picks[2].options.map(o => !!o.ok), [false, true, false], 'la vue affiche les 3 produits de la box : nom, catégorie et prix');
  assert.deepEqual(picks[3].options.map(o => !!o.ok), [false, false, true], 'pas besoin de recréer la vue : il suffit de la consulter à nouveau');
  assert.equal(picks[0].need, 3, 'trois produits à toucher : ceux de la box');
  assert.equal(picks[4].need, 1, 'une case à toucher : la valeur qui fait entrer le magnésium dans la vue');
  assert.equal(picks[5].options.length, 6, 'six informations à ranger');
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
});

test('les phrases d’Elisa (26 octobre, 10 h 52) : sa trame, une phrase par bulle, avec ses mots', () => {
  const lus = val('CAPTIONS').map(c => strip(c[2]));
  const suite = (...phrases) => { const i = lus.indexOf(phrases[0]); assert.ok(i >= 0, `légende : ${phrases[0]}`);
    phrases.forEach((p, k) => assert.equal(lus[i + k], p, 'ses phrases, à la suite')); };
  /* Le contexte de la box */
  suite('NutriBoost prépare une box surprise.', 'Une agence doit créer la page de présentation à partir du catalogue produits.',
    'Mais elle ne doit recevoir ni les stocks ni les produits qui ne font pas partie de la sélection.');
  /* Ses deux bulles sur la vue, juste avant « Créer la vue » */
  suite('Une vue enregistre une requête sous un nom.', 'Ici, elle présente uniquement les colonnes et les produits utiles à la préparation de la box.',
    'Clique sur le bouton « Créer la vue ».');
  /* La nouvelle sélection, puis ses trois bulles */
  suite('Pas besoin de recréer la vue !', 'Elle conserve la requête, pas une copie des résultats.', 'À chaque consultation, elle utilise les données actuelles.');
  /* Les droits d’accès, à découvrir dans une prochaine leçon (Elisa, 13 h 39), puis sa note de la trame */
  suite('Encore un point à découvrir dans une prochaine leçon : les droits d’accès !', 'Qui peut consulter ou modifier les données ?',
    'Ces droits se configurent séparément, pour que l’agence consulte la vue sans accéder au catalogue complet.');
  assert.ok(page.includes('<span class="emo">🔐</span>Une prochaine leçon · Sécurité et droits</span>'), 'la leçon qui les présente');
  /* La colonne selection_box : Karim, le développeur, l’a ajoutée ; Camille Roux met à jour la sélection dans l’outil de gestion (13 h 39) */
  suite('Karim, le développeur, y a ajouté la colonne selection_box.');
  suite('Camille Roux met à jour la sélection dans l’outil de gestion.', 'La protéine passe à 0, et le magnésium à 1.');
  assert.ok(!/équipe de la box/.test(JSON.stringify([val('CAPTIONS'), val('PICKS'), val('MAILS'), val('ITEMS')])), 'plus d’« équipe de la box » à l’écran');
  assert.ok(!/👁️|👀/.test(page), 'une vue : 📋, pas d’œil');
  assert.ok(lus.includes('Les stocks et les produits non sélectionnés n’y figurent pas.'), 'le résultat de la vue : ni les stocks, ni les produits non sélectionnés');
  assert.ok(page.includes('Enregistre une requête sous forme de vue pour consulter facilement un résultat réutilisable.'), 'la bulle de la mascotte');
  assert.ok(page.includes('Elisa, 26 octobre, 10 h 52'), 'la page garde la trace de la trame d’Elisa');
});

test('les messages : Camille écrit par SMS, avec les mots d’Elisa ; l’app s’arrête sur eux, et sur les boutons de la trame', () => {
  const mails = val('MAILS'), opens = val('OPENS'), picks = val('PICKS'), caps = val('CAPTIONS');
  assert.equal(mails.length, 2);
  assert.deepEqual(mails.map(m => [m[0], m[2], m[6]]), [[['Camille', 'Roux', 'CR'], 'équipe', {sms: true, hello: 'Salut !', bye: null}],
    [['Camille', 'Roux', 'CR'], 'équipe', {sms: true, hello: null, bye: null}]]);
  assert.deepEqual(mails[0][4], ['L’agence prépare la page de notre prochaine box.', 'Elle a besoin du nom, de la catégorie et du prix des produits sélectionnés.',
    'La sélection peut encore changer, donc évitons les exports à refaire.', 'Peux-tu préparer une vue dédiée ?']);
  /* Elisa, 13 h 39 : son texte, mot pour mot, et sa question */
  assert.deepEqual(mails[1][4], ['Petit changement : après avoir recalculé les coûts, la hausse du prix des matières premières rend la box trop chère à produire.',
    'On va donc remplacer la protéine par le magnésium pour conserver le prix de vente prévu.',
    'Est-ce qu’il faut recréer la vue pour prendre en compte ce changement ?'], 'le second commence directement, sans formule');
  assert.ok(mails.every(m => m[5] === 'Camille, responsable des opérations NutriBoost'), 'Camille Roux, responsable des opérations');
  assert.equal(vm.runInContext('mailRows(0)', D), 5, 'cinq bulles : « Salut ! » et ses quatre phrases');
  assert.equal(vm.runInContext('mailRows(1)', D), 3, 'trois bulles : ses trois phrases');
  assert.deepEqual(opens.map(o => o.sel), ['#ml1', '#bcre', '#bexe', '#ml2', '#bexe']);
  assert.deepEqual(opens.map(o => o.label), ['Ouvrir le message de Camille Roux', 'Créer la vue', 'Exécuter', 'Ouvrir le message de Camille Roux', 'Exécuter']);
  assert.ok(opens[0].at < picks[0].at && opens[1].at > picks[1].at && opens[1].at < picks[2].at && opens[2].at > picks[2].at && opens[3].at < picks[3].at
    && opens[4].at > picks[3].at && opens[4].at < picks[4].at, 'les messages et les boutons, à leur place entre les moments');
  const bulles = [['#bcre', 'Clique sur le bouton<br>« Créer la vue ».', '#0E6F8A'], ['#bexe', 'Clique sur le bouton<br>« Exécuter ».', '#4B30CC'], ['#bexe', 'Consulte à nouveau la vue :<br>clique sur « Exécuter ».', '#4B30CC']];
  opens.filter(o => o.sel !== '#ml1' && o.sel !== '#ml2').forEach((o, k) => {
    const [sel, bulle, lip] = bulles[k];
    assert.equal(o.sel, sel);
    assert.deepEqual(o.hand, {x: 0.86, y: 0.78});
    assert.deepEqual([o.press, o.rest], [{y: 7, boxShadow: `0 2px 0 ${lip}`}, {y: 0, boxShadow: `0 9px 0 ${lip}`}]);
    const c = caps.find(x => x[2] === bulle);
    assert.ok(c && o.at > c[0] + 1 && o.at < c[1] - 1, `${sel} : le bouton est visible pendant sa légende, puis l’app s’arrête`);
  });
  assert.ok(!/fromTo\('#b(cre|exe)|fromTo\(b\b/.test(page), 'aucun « fromTo » sur un bouton ni sur son anneau');
  assert.ok(page.includes('(MAILS[n][6] || {}).hello, (MAILS[n][6] || {}).photo, (MAILS[n][6] || {}).bye)'), 'la page passe au moteur la formule et la fin du SMS');
  for (const t of ['capOff(B.o3 - 0.2);', "sceneOn('#sw', MAIL1 + MO[0] + 0.45);", 'capOff(B.d5 - 0.2);', "sceneOn('#sw', MAIL2 + MO[1] + 0.45);"]) assert.ok(page.includes(t), `les messages : ${t}`);
});

test('la base du chapitre 15 : douze tables ; le catalogue, avec la colonne selection_box (la tisane, la protéine et le shaker dans la box)', () => {
  const db = base(), TB = val('TB');
  assert.deepEqual(TB.map(t => t[3]), ['clients', 'commandes', 'fidelite', 'produits', 'coachs', 'ateliers', 'inscriptions', 'cartes', 'avis', 'remplacements', 'cadeaux', 'historique_prix']);
  assert.deepEqual(TB.map(t => t[3]).sort(), tables(db), 'aucune table de la base n’est oubliée à l’écran');
  for (const [, , , name, n] of TB) assert.equal(count(db, name), n, `${name} : ${n} lignes`);
  assert.ok(page.includes('<span>12 tables</span>'), '12 tables');
  db.run(SELECTION);
  /* Le catalogue de la vidéo est celui de la base : identifiant, nom, catégorie, prix, stock, selection_box (avant, puis après le message de Camille). */
  const P = val('PRODUITS');
  assert.deepEqual(P.map(p => [p[0], p[1], p[2], +p[3], p[4], p[5]]), lignes(db, 'SELECT id, nom, categorie, prix, stock, selection_box FROM produits ORDER BY id'));
  assert.ok(P.every(p => p[3] === prix(+p[3])), 'les prix s’écrivent avec deux décimales');
  db.run(CHANGEMENT);
  assert.deepEqual(P.map(p => [p[0], p[6]]), lignes(db, 'SELECT id, selection_box FROM produits ORDER BY id'), 'après le message de Camille : le magnésium à 1, la protéine à 0');
  assert.deepEqual(val('BOX'), [5, 6, 8]); assert.deepEqual(val('BOX2'), [3, 5, 8]);
});

test('la vue, rejouée dans SQLite : CREATE VIEW enregistre la requête ; consultée, elle présente la sélection, sans stock', () => {
  assert.equal(sql('Q_VIEW'), 'CREATE VIEW catalogue_box AS\nSELECT nom, categorie, prix\nFROM produits\nWHERE selection_box = 1;', 'la vue de la vidéo');
  assert.equal(sql('Q_SEL'), 'SELECT * FROM catalogue_box;');
  const db = catalogue();
  db.run(sql('Q_VIEW'));
  /* La vue est enregistrée dans la base : une vue, pas une table de plus, qui garde sa requête. */
  assert.deepEqual(lignes(db, "SELECT type, name FROM sqlite_master WHERE name = 'catalogue_box'"), [['view', 'catalogue_box']]);
  assert.equal(tables(db).length, 12, 'aucune table créée : la vue ne copie rien');
  assert.match(lignes(db, "SELECT sql FROM sqlite_master WHERE name = 'catalogue_box'")[0][0], /WHERE selection_box = 1/, 'elle conserve la requête');
  /* Consultée comme une table : le nom, la catégorie et le prix des trois produits de la box. */
  const r = db.exec(sql('Q_SEL'))[0];
  assert.deepEqual(r.columns, ['nom', 'categorie', 'prix'], 'ni le stock, ni selection_box');
  assert.deepEqual(r.values.map(v => [v[0], v[1], prix(v[2])]), [['Tisane Détox', 'Boisson', '12.50'], ['Protéine Végétale', 'Nutrition', '34.90'], ['Shaker Inox', 'Accessoire', '15.00']]);
  /* La vidéo montre ce résultat : trois lignes, celles des produits de BOX, dans l’ordre de la table ; une ligne qui change avec le message de
     Camille empile ses deux valeurs (avant, après). */
  const P = val('PRODUITS'), rang = ids => ids.map(id => P.find(p => p[0] === id)).map(p => [p[1], p[2], p[3]]);
  assert.deepEqual(rang(val('BOX')), r.values.map(v => [v[0], v[1], prix(v[2])]), 'la vidéo : les lignes de la vue, dans l’ordre de SQLite');
  assert.ok(page.includes('const avant = BOX.map(id => PRODUITS.find(p => p[0] === id)), apres = BOX2.map(id => PRODUITS.find(p => p[0] === id));')
    && page.includes("cell(0, sw('vn' + k, [[p[1]], [n[1]]]))"), 'le résultat de la vue : la tisane, la protéine, le shaker ; puis le magnésium, la tisane, le shaker');
  assert.ok(page.includes("head([['c0', 'nom'], ['c1', 'categorie'], ['c2', 'prix']])"), 'les colonnes de la vue');
  for (const t of ["tapButton('bcre', CRE, '#0E6F8A');", "mark('#vwc', CRE + 0.55);", "tapButton('bexe', EXE1, '#4B30CC');", "keep(BOX, A.d5 + 0.5);", "tapButton('bexe', EXE2, '#4B30CC');",
    "swap('#sb6 .a0', '#sb6 .a1', A.e1 + 1.5);", "swap('#sb3 .a0', '#sb3 .a1', A.e1 + 2.3);", "keep(BOX2, A.e4 + 1.6);",
    "'#vn1 .a1', '#vc1 .a1', '#vp1 .a1', '#vn2 .a1', '#vc2 .a1', '#vp2 .a1'"])
    assert.ok(page.includes(t), `la page montre : ${t}`);
});

test('le changement de Camille : sans recréer la vue, sa consultation présente la nouvelle sélection', () => {
  const db = catalogue();
  db.run(sql('Q_VIEW'));
  db.run(CHANGEMENT);
  /* Pas besoin de recréer la vue : la même requête, sur les données actuelles. Le magnésium (produit 3) vient en tête ; plus de protéine. */
  const apres = lignes(db, sql('Q_SEL')).map(v => [v[0], v[1], prix(v[2])]);
  assert.deepEqual(apres, [['Magnésium', 'Bien-être', '19.90'], ['Tisane Détox', 'Boisson', '12.50'], ['Shaker Inox', 'Accessoire', '15.00']]);
  const P = val('PRODUITS');
  assert.deepEqual(val('BOX2').map(id => P.find(p => p[0] === id)).map(p => [p[1], p[2], p[3]]), apres, 'la vidéo montre ce résultat, ligne par ligne');
  /* Une copie, elle, ne suit pas : CREATE TABLE … AS SELECT garde la sélection de sa création. */
  const db2 = catalogue();
  db2.run('CREATE TABLE copie_box AS SELECT nom, categorie, prix FROM produits WHERE selection_box = 1;');
  db2.run(CHANGEMENT);
  assert.deepEqual(lignes(db2, 'SELECT nom FROM copie_box'), [['Tisane Détox'], ['Protéine Végétale'], ['Shaker Inox']], 'la copie garde la protéine');
  assert.equal(val('PICKS')[3].options[2].label, 'Non, il suffit de consulter à nouveau la vue');
});

test('moments 1 et 5 : les produits cochés ; la valeur qui fait entrer le magnésium dans la vue', () => {
  const db = catalogue();
  assert.deepEqual(lignes(db, 'SELECT id FROM produits WHERE selection_box = 1 ORDER BY id').map(r => r[0]), val('BOX'), 'moment 1 : les produits que la vue gardera');
  assert.deepEqual(Object.keys(val('WHY1')).map(Number), [1, 2, 3, 4, 7, 9], 'une correction pour chaque produit hors de la box (la Spiruline Bio, ajoutée au chapitre 10, comprise)');
  assert.equal(val('PICKS')[0].prompt, 'Touche les produits qui font partie de la sélection.');
  /* Moment 5 : la case selection_box du magnésium (c4) ; le WHERE de la vue ne regarde qu’elle. */
  assert.deepEqual(Object.keys(val('WHY5')).sort(), ['c0', 'c1', 'c2', 'c3']);
  assert.ok(/if \(i === 4\) return \{text: '[^']+', keys: \['c4'\]\};/.test(page), 'indice du moment 5 : la case selection_box ressort');
  assert.ok(page.includes("(id === 3 ? '<i class=\"hc\" id=\"hc3\"></i>' : '')") && page.includes("const M5_ANS = ['#hc3'];"), 'la case selection_box du magnésium s’entoure');
  db.run(sql('Q_VIEW'));
  db.run('UPDATE produits SET selection_box = 0 WHERE id = 6;');
  assert.ok(!lignes(db, sql('Q_SEL')).some(r => r[0] === 'Magnésium'), 'sans son 1, pas de magnésium dans la vue');
  db.run('UPDATE produits SET selection_box = 1 WHERE id = 3;');
  assert.ok(lignes(db, sql('Q_SEL')).some(r => r[0] === 'Magnésium'), 'avec son 1, il y entre');
});

test('moment 6 : chaque information est rangée selon ce que la vue présente, comme dans SQLite', () => {
  const BINS = val('BINS'), ITEMS = val('ITEMS');
  assert.deepEqual(BINS.map(b => b[1]), ['Dans la vue', 'Hors de la vue']);
  assert.deepEqual(ITEMS.map(x => x[1]), ['vu', 'ho', 'vu', 'ho', 'vu', 'ho']);
  assert.deepEqual(val('PICKS')[5].options.map(o => o.label), ITEMS.map(x => x[0]));
  for (const x of ITEMS) assert.ok(strip(x[2]).length > 40, `${x[0]} : une correction qui explique le choix`);
  /* Chaque information : [produit, colonne], après le changement de Camille. */
  const QUOI = [[8, 'prix'], [5, 'stock'], [3, 'categorie'], [7, 'prix'], [5, 'nom'], [6, 'nom']];
  const db = catalogue(); db.run(sql('Q_VIEW')); db.run(CHANGEMENT);
  const vue = db.exec(sql('Q_SEL'))[0], noms = vue.values.map(v => v[0]);
  ITEMS.forEach(([label, k], i) => {
    const [id, col] = QUOI[i], nom = lignes(db, `SELECT nom FROM produits WHERE id = ${id}`)[0][0];
    assert.equal(vue.columns.includes(col) && noms.includes(nom), k === 'vu', `${label} : ${k === 'vu' ? 'dans la vue' : 'hors de la vue'}`);
  });
});

test('chapitre 16 : écran titre, ouverture comme aux autres chapitres, la box surprise d’Elisa, annonce de la prochaine leçon', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 16 : CREATE VIEW</title>') && page.includes('<div class="tagpill">Projet · Chapitre 16</div>')
    && page.includes('<span>C</span><span>R</span><span>E</span><span>A</span><span>T</span><span class="sp">E</span><span>V</span><span>I</span><span>E</span><span>W</span>')
    && page.includes('<div class="abs sub">Enregistrer une requête sous un nom</div>'), 'écran titre : « Projet · Chapitre 16 », CREATE VIEW, « Enregistrer une requête sous un nom »');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.');
  assert.equal(caps[1], 'Au chapitre 15, un verrou<br>a gardé la dernière place<br>pour une seule réservation.', 'le chapitre précédent');
  const cc = fs.readFileSync(path.join(root, 'assets/anim/projet-concurrence.html'), 'utf8');
  assert.ok(cc.includes('les vues : des requêtes enregistrées') && cc.includes('Prochaine leçon · CREATE VIEW</span>'), 'le chapitre 15 annonce celui-ci');
  assert.ok(caps.includes('Dans la prochaine leçon,<br>la file des commandes à préparer<br>s’allongera.') && page.includes('Prochaine leçon · Les index et EXPLAIN</span>'),
    'annonce de la prochaine leçon');
  assert.equal(lessons[lessons.findIndex(l => l.id === 64) + 1].titre, 'Les index et EXPLAIN');
  assert.equal(caps[caps.length - 2], 'Pour finir, voici les <b>trois idées à retenir</b>.');
  /* La photo d’Elisa (26 octobre, 11 h 16) : la box surprise, gardée pour le hors ligne. */
  assert.ok(page.includes("const PHOTO = 'projet-vue-box.webp';") && fs.statSync(path.join(root, 'assets/anim/projet-vue-box.webp')).size > 20000, 'la photo de la box');
  assert.ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes("'./assets/anim/projet-vue-box.webp'"), 'et gardée pour le hors ligne');
});

test('le récapitulatif, dans la vidéo comme dans la fiche de la leçon : trois idées, chacune avec sa phrase puis sa précision', () => {
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div><div class="rtxt">(.*?)<\/div><\/div>/g)].map(m => {
    const [phrase, detail] = m[2].split('<span class="rs">');
    return [m[1], strip(phrase), strip(detail.replace(/<\/span>$/, ''))];
  });
  const RECAP = [['📋', 'Une vue enregistre une requête sous un nom.', 'Elle se consulte comme une table, avec SELECT.'],
    ['🔄', 'Elle conserve la requête, pas une copie des résultats.', 'À chaque consultation, elle utilise les données actuelles.'],
    ['🎁', 'Elle présente uniquement les colonnes et les lignes utiles.', 'Avec des droits configurés séparément, l’agence la consulte sans accéder au catalogue complet.']];
  assert.deepEqual(rows, RECAP, 'la vidéo : les trois idées');
  const fiche = html.slice(html.indexOf('guide({ id:64,'), html.indexOf('guide({ id:57,'));
  const idees = [...fiche.matchAll(/\["(📋|🔄|🎁)","([^"]*)","([^"]*)"(?:,"([^"]*)")?\]/g)].map(m => [m[1], strip(m[2]), strip(m[3])]);
  assert.deepEqual(idees, RECAP, 'la fiche de la leçon dit la même chose que la vidéo');
});

test('ce que la vidéo ne reprend pas de l’ancien cours : plus de produits_premium ni de stock faible ; le chapitre ne parle pas de SQL comme d’une personne', () => {
  const textes = JSON.stringify([val('CAPTIONS'), val('PICKS'), val('MAILS'), val('ITEMS'), val('WHY5')]);
  for (const mot of ['produits_premium', 'produits_stock_faible', 'detail_commandes', 'réassort']) assert.ok(!textes.includes(mot), `la vidéo ne parle pas de ${mot}`);
  assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page) && !/la base (réagit|ajoute|garde)/.test(page), 'ni SQL ni la base ne sont personnifiés');
  const fiche = html.slice(html.indexOf('guide({ id:64,'), html.indexOf('guide({ id:57,'));
  assert.ok(!fiche.includes('sit:{') && !fiche.includes('testeVariants'), 'plus de cours texte CREATE VIEW dans la fiche');
  assert.ok(!/dans produits\b/.test(page) && val('CAPTIONS').filter(c => /table produits/.test(c[2])).every(c => /<b>table produits<\/b>/.test(c[2])), 'toujours la <b>table produits</b>');
});

test('zones à toucher : les lignes des tables font 62 px ; les indices passent par la typographie française', () => {
  assert.ok(page.includes('const RH = 62;') && /\.r\{position:relative;height:(6[2-9]|[7-9]\d)px/.test(page), 'lignes de 62 px au moins');
  assert.ok(/return h && Object\.assign\(h, \{text: fr\(h\.text\)\}\);/.test(page));
  assert.equal([...page.matchAll(/return \{text: '([^']+)'/g)].length, 5, 'cinq indices écrits : un par moment à choix ou à toucher');
  assert.ok(page.includes("const CELLS = [['c0', 'Nom : Magnésium'], ['c1', 'Catégorie : Bien-être'], ['c2', 'Prix : 19.90'], ['c3', 'Stock : 500'], ['c4', 'selection_box : 1']];"));
});
