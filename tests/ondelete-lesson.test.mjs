/* Projet NutriBoost, chapitre 10 (leçon 68 « ON DELETE ») : la vidéo interactive assets/anim/projet-ondelete.html, testée aussi dans lesson-video.test.mjs.
   Refonte du 25 octobre (Elisa, 12 h 51 : « le cours ON DELETE, je ne comprends rien du tout, je préfère qu’on se base sur tout le cours sur la partie avis ») :
   une seule histoire, celle d’un avis. Une cliente, Inès Lefebvre, remplit une feuille d’avis après un atelier (12 h 52 : l’équipe enregistre l’avis et sa note dans
   la base) ; la table avis relie l’avis à son compte (client_id) et à son produit (produit_id) par deux clés étrangères ; quelque temps plus tard, le service client
   transmet sa demande : supprimer le compte, conserver l’avis sous la mention « Ancien client ». ON DELETE RESTRICT, CASCADE et SET NULL sont montrés sur cette
   clé étrangère ; SET NULL conserve l’avis, la colonne client_id doit donc accepter NULL ; c’est le site, non la base, qui affiche « Ancien client ».
   Inès Lefebvre remplace Nathan Petit de la trame d’Elisa : la base partagée ne doit pas être modifiée pour Nathan, dont d’autres chapitres ont besoin (13 h 17).
   Seul cours du module « Contraintes et intégrité » : il remplace l’ancien cours ON DELETE (la table satisfaction, les paniers) et le cours
   « Les contraintes en action » (67, supprimé). Leçon seule : ni cours texte, ni exercice.
   Ce que la vidéo montre (FOREIGN KEY constraint failed, les trois règles, NOT NULL qui s’y oppose, NULL que le site remplace par « Ancien client ») est ici rejoué
   dans SQLite : c’est ce que la base répond vraiment. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-ondelete.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l68 = lessons.find(l => l.id === 68);

/* Les données de la page (le déroulé des légendes, le message, les six moments), évaluées telles quelles. */
const a = page.indexOf('const SCH = '), b = page.indexOf('/* ---------- Gabarits');
assert.ok(a > 0 && b > a, 'données de la page localisées');
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(a, b), D);
const val = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, D));
const strip = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const sp = s => s.replace(/[  ]/g, ' ');
const COMMENT = val('COMMENT');

/* ---------- La base de la vidéo ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
/* La base NutriBoost de la vidéo, telle que le chapitre 9 la laisse : les quatre tables de la boutique, telles que l’app les crée (SCHEMA_SQL : clients,
   produits, commandes 16, fidelite) et les quatre tables des ateliers (coachs 4, ateliers 5, inscriptions, cartes 3) ; Nathan Dupont, l’inscription de
   Léa Simon et les deux d’Hugo Laurent ont été supprimés : 9 clients, 8 inscriptions. Huit tables. */
function base() {
  const db = new SQL.Database();
  db.run(vm.runInContext('SCHEMA_SQL', ctx));
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
    DELETE FROM clients WHERE id = 10;`);
  return db;
}
/* La colonne client_id de la table avis, telle que la page l’écrit (lignes e2b à e2d), sans le balisage {clé|texte} ; NOT NULL et la règle au choix. */
const lignes = Object.fromEntries([...page.matchAll(/\['e2([a-d])', '((?:[^'\\]|\\.)*)'\]/g)].map(m => [m[1], m[2]]));
assert.deepEqual(Object.keys(lignes), ['a', 'b', 'c', 'd'], 'les quatre lignes du fragment de requête');
const colonne = ({notNull = false, regle = 'ON DELETE SET NULL'} = {}) => ['b', 'c', 'd'].map(k => lignes[k]
  .replace(/\{\w+\|([^}]*)\}/g, '$1').replace('<span class="sg" id="smn"> NOT NULL</span>', notNull ? ' NOT NULL' : '').replace('ON DELETE SET NULL', regle)).join('\n');
/* La table avis : cinq colonnes (id, client_id, produit_id, note, commentaire), comme la page les nomme ; le produit est la seconde clé étrangère. */
const creation = options => `CREATE TABLE avis (
  id INTEGER PRIMARY KEY,
  ${colonne(options)},
  produit_id INTEGER REFERENCES produits(id),
  note INTEGER,
  commentaire TEXT
);`;
/* La base avec la table avis et sa seule ligne : l’avis d’Inès Lefebvre (cliente 9) sur la Protéine Végétale (produit 6), cinq étoiles. */
function avec(options) {
  const db = base();
  db.run(creation(options));
  db.run('INSERT INTO avis (id, client_id, produit_id, note, commentaire) VALUES (1, 9, 6, 5, ?)', [COMMENT]);
  return db;
}
const HUIT = ['ateliers', 'cartes', 'clients', 'coachs', 'commandes', 'fidelite', 'inscriptions', 'produits'];   // par ordre alphabétique
const tables = db => db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(r => r[0]);
const count = (db, t) => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
const avis = db => (db.exec('SELECT id, client_id, produit_id, note, commentaire FROM avis ORDER BY id')[0] || {values: []}).values;
/* Le compte d’Inès Lefebvre : sa seule inscription (Yoga du matin) est déjà supprimée, hors écran, comme au chapitre 9 ; puis la ligne de la table clients. */
const supprimerInscription = db => db.run('DELETE FROM inscriptions WHERE client_id = 9;');
const supprimerCompte = db => db.run('DELETE FROM clients WHERE id = 9;');
/* Ce que le site lit : l’avis de la fiche produit, avec le prénom de son auteur ou, à défaut, « Ancien client ». */
const FICHE = "SELECT COALESCE(c.prenom, 'Ancien client'), a.note, a.commentaire FROM avis a LEFT JOIN clients c ON c.id = a.client_id WHERE a.produit_id = 6";

test('ON DELETE : seul cours du module « Contraintes et intégrité », juste après DELETE et juste avant Transactions ; la leçon 67 n’existe plus', () => {
  const m = modules.find(x => x.titre === 'Contraintes et intégrité');
  assert.deepEqual([...m.lessons.map(l => l.id)], [68], 'ON DELETE est seul dans son module');
  assert.equal(m.sous, 'Les règles que les données doivent respecter', 'le sous-titre du module ne fait pas agir la base');
  const liste = lessons.map(l => l.id);
  assert.equal(liste.indexOf(68), liste.indexOf(28) + 1, 'ON DELETE vient juste après DELETE');
  assert.equal(liste[liste.indexOf(68) + 1], 62, 'Transactions vient juste après');
  assert.equal(lessons.find(l => l.id === 62).titre, 'Transactions');
  assert.equal(l68.titre, 'ON DELETE');
  assert.equal(l68.résumé, 'Décider du sort des lignes liées');
  /* Le cours « Les contraintes en action » est supprimé, avec son quiz et ses mots-clés de recherche. */
  assert.ok(!liste.includes(67) && !html.includes('guide({ id:67,') && !/\n 67:\[/.test(html) && !/\n  67:'/.test(html), 'plus de leçon 67');
  assert.equal(vm.runInContext('QCM', ctx)[67], undefined);
});

test('recherche et leçon seule : ni texte de secours, ni exercice, ni quiz', () => {
  const mots = html.match(/\n  68:'([^']+)',/)[1];
  assert.ok(['on delete', 'cascade', 'set null', 'restrict', 'cle etrangere', 'foreign key', 'constraint failed', 'not null', 'avis', 'ancien client', 'create table', 'supprimer lignes liees'].every(m => mots.includes(m)),
    'trouvé par la recherche : ON DELETE, les trois règles, la clé étrangère, NOT NULL, la table avis, « Ancien client »…');
  assert.ok(l68.leconSeule && l68.video && !l68.situation && !l68.consigne && !l68.solution && !l68.petitDefi && !l68.learningCheck && !l68.testeVariants && !l68.anatomie, 'la vidéo est le cours');
  assert.equal(l68.video.moments, 6); assert.equal(l68.video.seuil, 4);
  assert.equal(l68.video.anim, 'assets/anim/projet-ondelete.html?app&embed');
  const recap = l68.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['🔀', '🧭', '🏷️'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
  assert.equal(vm.runInContext('QCM', ctx)[68], undefined, 'plus de quiz : la vidéo et ses moments valident la leçon (Elisa, 28 octobre)');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  /* Le bouton des notes est écrit en clair dans Course(…) : il suit la dernière légende. */
  assert.equal(val('NOTES'), 237.73);
  assert.ok(page.includes('notesAt: 237.73,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 244.93);
  /* Des légendes qui se suivent sans se chevaucher, chaque chapitre commençant 0,4 s après la légende précédente. */
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999, `légende ${k + 1} : après la précédente`);
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  /* Les sept parties de la trame d’Elisa (25 octobre, 12 h 51), avec l’ouverture commune à tous les chapitres du projet dans la première et le récapitulatif en dernier. */
  assert.deepEqual(chaps.map(c => c.label), ['Après l’atelier', 'De la feuille à la base', 'Quelque temps plus tard…', 'Le moment de la suppression', 'Découvrir ON DELETE',
    'À toi de choisir', 'Retour sur le site web', 'Chaque cas, sa règle', 'À retenir']);
  /* Une seule phrase complète par bulle (Elisa, 23 octobre) ; aucune bulle de plus de trois lignes. */
  caps.forEach(([, , t, lines], k) => {
    const txt = strip(t);
    assert.ok(/^[A-ZÀ-ÖØ-Þ0-9«]/.test(txt) || /^(<b[^>]*>)?<code>/.test(t), `légende ${k + 1} : une phrase qui commence (« ${txt.slice(0, 50)} »)`);
    assert.ok(/[.!?»]$/.test(txt), `légende ${k + 1} : une phrase qui finit (« …${txt.slice(-50)} »)`);
    assert.ok(!/[.!?»] ?[A-ZÀ-ÖØ-Þ«]/.test(txt), `légende ${k + 1} : une seule phrase par bulle (« ${txt.slice(0, 70)} »)`);
    assert.equal(lines, undefined, `légende ${k + 1} : trois lignes au plus`);
    assert.ok(t.split('<br>').length <= 3, `légende ${k + 1} : trois lignes au plus`);
  });
  /* Six moments, dans l’ordre des chapitres ; chacun s’arrête 2,35 s après le début de sa légende « À toi ! ». */
  assert.deepEqual(picks.map(p => p.kind), ['tap', 'pick', 'tap', 'pick', 'pick', 'sort']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    assert.equal(p.options.length, 3, `${p.prompt} : trois réponses`);
    for (const o of p.options.filter(o => !o.ok)) assert.ok(o.why && strip(o.why).length > 30, `${o.label} : une correction qui explique le choix`);
  }
  assert.deepEqual(picks[1].options.map(o => !!o.ok), [false, false, true], 'la règle qui conserve l’avis : SET NULL');
  assert.deepEqual(picks[3].options.map(o => !!o.ok), [false, false, true], 'avec NOT NULL, la suppression du compte est refusée');
  assert.deepEqual(picks[4].options.map(o => !!o.ok), [true, false, false], 'c’est le site web qui affiche « Ancien client »');
  assert.equal(picks[0].need, 2, 'deux cases à toucher : les deux clés étrangères de l’avis');
  assert.equal(picks[2].need, 1, 'une seule case à toucher : celle qui devient NULL');
  assert.equal(picks[5].options.length, 6, 'six situations à ranger');
  /* Chaque question se suffit : sur un petit écran, le plateau des réponses recouvre le bas de l’image. */
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
});

test('les phrases d’Elisa (25 octobre, 12 h 51) : les sept parties de sa trame, dites avec ses mots', () => {
  const caps = val('CAPTIONS').map(c => c[2]), picks = val('PICKS');
  const dit = (...phrases) => phrases.forEach(p => assert.ok(caps.includes(p), `légende : ${p}`));
  /* 1 · Après l’atelier */
  dit('Inès Lefebvre vient de participer<br>à un atelier NutriBoost.', 'Elle a pu goûter<br>plusieurs de nos produits.', 'Elle souhaite maintenant<br>partager son expérience.');
  /* 2 · Du site web à la base de données : une table avis, deux clés étrangères */
  dit('Son avis doit s’afficher<br>à chaque visite sur le site.', 'Il faut donc l’enregistrer<br>dans la base de données.',
    'On ajoute une <b>table avis</b> :<br>chaque ligne contient un avis<br>publié sur un produit.', 'Elle a cinq colonnes :<br><code>id</code>, <code>client_id</code>, <code>produit_id</code>,<br><code>note</code> et <code>commentaire</code>.',
    'La colonne <code>client_id</code><br>relie l’avis au compte<br>d’Inès Lefebvre.', 'La colonne <code>produit_id</code><br>le relie à la protéine<br>qu’elle a goûtée.', 'Ces deux colonnes sont<br>des <b>clés étrangères</b>.');
  /* 4 · Le moment de la suppression : le bouton, la table clients, le lien qui n’a plus de sens ; c’est l’élève qui clique sur le bouton (Elisa, 25 octobre, 15 h 48 :
     « demande plutôt à l’utilisateur de cliquer lui sur le bouton »), la légende le lui demande. */
  dit('Le compte d’Inès Lefebvre<br>est relié à son avis<br>par <code>client_id</code>.', 'Clique sur le bouton<br>« Supprimer le compte ».', 'Son avis ne peut pas continuer<br>à référencer un compte<br>qui n’existe plus.', 'Que doit devenir ce lien ?');
  assert.ok(!caps.some(c => /^On clique/.test(c)), 'plus de « On clique… » : la vidéo ne clique plus à la place de l’élève');
  /* 5 · Découvrir ON DELETE */
  dit('La règle <code>ON DELETE</code> se définit<br>sur une clé étrangère.', 'Elle précise ce qui se passe<br>lorsque la ligne référencée<br>est supprimée.', 'Il existe trois possibilités.');
  /* 7 · Retour sur le site web */
  dit('Avec <code>ON DELETE SET NULL</code>,<br>l’avis est conservé.', 'Mais son lien vers le compte<br>d’Inès Lefebvre est retiré.', 'La colonne <code>client_id</code> doit donc<br>autoriser <code>NULL</code>.', '<code>SET NULL</code> modifie le lien<br>dans la base de données.');
  /* 6 · À toi de choisir (la question) et 7 (la réponse), mot pour mot, sans le « Exact ! » que le lecteur dit déjà par « Bien vu ! » */
  assert.equal(picks[1].prompt, 'Quelle règle permet de conserver l’avis d’Inès Lefebvre sans le rattacher à son compte supprimé ?');
  assert.deepEqual(picks[1].options.map(o => sp(o.label)), ['RESTRICT', 'CASCADE', 'SET NULL']);
  assert.equal(picks[1].options[2].why, 'Avec <code>ON DELETE SET NULL</code>, l’avis est conservé, mais son lien vers le compte d’Inès Lefebvre est retiré. La colonne <code>client_id</code> doit donc autoriser <code>NULL</code>.');
  assert.equal(picks[4].options[0].why, '<code>SET NULL</code> modifie le lien dans la base de données. C’est ensuite le site web qui affiche « Ancien client » lorsqu’aucun compte n’est associé à l’avis.');
  assert.ok(picks.every(p => !(p.options || []).some(o => /^Exact/.test(o.why || ''))), 'le lecteur affiche déjà « Bien vu ! » : pas de « Exact ! » en plus');
  assert.ok(page.includes('Un client part,<br>mais son avis doit rester&nbsp;:<br>à toi de décider !'), 'la bulle de la mascotte');
});

test('la base du chapitre 9 : huit tables, neuf clients, huit inscriptions ; Inès Lefebvre y est la cliente 9, sans commande, sans carte ni points de fidélité', () => {
  const db = base(), TB = val('TB');
  assert.deepEqual(tables(db), HUIT, 'huit tables avant la création de la table avis');
  assert.deepEqual(TB.map(t => t[3]), ['clients', 'commandes', 'fidelite', 'produits', 'coachs', 'ateliers', 'inscriptions', 'cartes'], 'la boutique d’abord, puis les tables des ateliers dans l’ordre du chapitre 5');
  assert.equal(new Set(TB.map(t => t[1])).size, TB.length, 'chaque table a sa couleur');
  for (const [, , , name, n] of TB) assert.equal(count(db, name), n, `${name} : ${n} lignes`);
  assert.deepEqual(TB.map(t => t[3]).sort(), tables(db), 'aucune table de la base n’est oubliée à l’écran');
  assert.equal(count(db, 'clients'), 9); assert.equal(count(db, 'inscriptions'), 8);
  assert.ok(page.includes('<span>8 tables</span>'), '8 tables');
  assert.deepEqual(db.exec('SELECT id, prenom, nom, ville FROM clients WHERE id = 9')[0].values, [[9, 'Inès', 'Lefebvre', 'Nantes']], 'la ligne de la table clients que la page montre');
  assert.equal(val('PRENOM'), 'Inès');
  /* Elle n’a ni commande, ni points de fidélité, ni carte : seule son inscription (Yoga du matin) la désigne, et la vidéo la suppose supprimée hors écran. */
  for (const t of ['commandes', 'fidelite', 'cartes']) assert.equal(db.exec(`SELECT COUNT(*) FROM ${t} WHERE client_id = 9`)[0].values[0][0], 0, `${t} : aucune ligne pour Inès Lefebvre`);
  assert.deepEqual(db.exec('SELECT id, atelier_id FROM inscriptions WHERE client_id = 9')[0].values, [[11, 5]], 'une seule inscription : la 11, à l’atelier Yoga du matin');
  assert.throws(() => supprimerCompte(db), /FOREIGN KEY constraint failed/, 'tant que cette inscription existe, le compte ne peut pas être supprimé');
});

test('Nathan Petit : la vidéo ne le nomme jamais et le chapitre ne touche pas à sa ligne (Elisa, 25 octobre, 13 h 17 : « je ne veux pas que tu modifies la base pour Nathan »)', () => {
  const textes = JSON.stringify([val('CAPTIONS'), val('PICKS'), val('MAILS'), val('TB'), val('ITEMS'), val('WHY1'), val('WHY2'), val('PRENOM'), COMMENT]);
  assert.ok(!/Nathan/.test(textes), 'aucun texte de la vidéo ne parle de Nathan');
  const db = avec({}), avant = db.exec('SELECT * FROM clients WHERE id = 4')[0].values;
  assert.deepEqual(db.exec("SELECT prenom, nom FROM clients WHERE id = 4")[0].values, [['Nathan', 'Petit']]);
  supprimerInscription(db); supprimerCompte(db);
  assert.deepEqual(db.exec('SELECT * FROM clients WHERE id = 4')[0].values, avant, 'sa ligne n’a pas changé');
  assert.equal(db.exec('SELECT COUNT(*) FROM inscriptions WHERE client_id = 4')[0].values[0][0], 1, 'son inscription non plus');
  assert.equal(db.exec('SELECT COUNT(*) FROM commandes WHERE client_id = 4')[0].values[0][0], 2, 'ni ses deux commandes');
  assert.equal(db.exec('SELECT COUNT(*) FROM cartes WHERE client_id = 4')[0].values[0][0], 1, 'ni sa carte');
});

test('de la feuille à la base : l’avis devient une ligne de la table avis (cinq colonnes, deux clés étrangères) ; le client et le produit sont ceux que la page montre', () => {
  const db = avec({});
  assert.deepEqual(tables(db), [...HUIT, 'avis'].sort(), 'neuf tables une fois la table avis créée');
  assert.deepEqual(db.exec(`SELECT name, "notnull", pk FROM pragma_table_info('avis')`)[0].values,
    [['id', 0, 1], ['client_id', 0, 0], ['produit_id', 0, 0], ['note', 0, 0], ['commentaire', 0, 0]], 'cinq colonnes : id, client_id, produit_id, note, commentaire');
  assert.deepEqual(db.exec(`SELECT "from", "table", "to" FROM pragma_foreign_key_list('avis') ORDER BY "from"`)[0].values,
    [['client_id', 'clients', 'id'], ['produit_id', 'produits', 'id']], 'deux clés étrangères : client_id vers clients, produit_id vers produits');
  assert.deepEqual(avis(db), [[1, 9, 6, 5, COMMENT]], 'une seule ligne : l’avis 1 du client 9 sur le produit 6, cinq étoiles, le commentaire de la feuille');
  /* Les trois lignes que la page montre, côte à côte : le compte, l’avis, le produit. */
  assert.deepEqual(db.exec('SELECT id, nom, categorie, prix FROM produits WHERE id = 6')[0].values, [[6, 'Protéine Végétale', 'Nutrition', 34.9]]);
  for (const t of ["['c1', 'client_id'], ['c2', 'produit_id'], ['c3', 'note'], ['c4', 'commentaire']", "'<i class=\"v\">Protéine Végétale</i>'", "'<i class=\"v\">34.9</i>'", "'<i class=\"v\">Nantes</i>'",
    "sw('kcw', [['?', 'nul'], ['9']])", "sw('kpw', [['?', 'nul'], ['6']])", "sw('vnw', [['?', 'nul'], ['5']])"]) assert.ok(page.includes(t), `la page montre : ${t}`);
  assert.ok((page.match(/\$\{COMMENT\}/g) || []).length >= 4, 'le même commentaire sur la feuille, dans la table, dans le schéma et sur le site');
  assert.ok(COMMENT.startsWith('J’ai découvert cette protéine pendant un atelier NutriBoost.') && COMMENT.endsWith('Je recommande !'), 'le commentaire de la feuille, mot pour mot');
  /* Moment 1 : les deux clés étrangères sont client_id (c1) et produit_id (c2) ; pourquoi les autres cases ne conviennent pas. */
  assert.deepEqual(Object.keys(val('WHY1')).sort(), ['c0', 'c3', 'c4'], 'toutes les cases sauf les deux bonnes sont expliquées');
  assert.ok(/if \(i === 0\) return \{text: '[^']+', keys: \['c1', 'c2'\]\};/.test(page), 'indice du moment 1 : les deux colonnes (c1, c2) ressortent');
  assert.equal(val('PICKS')[0].prompt, 'Dans l’avis d’Inès Lefebvre, touche les deux clés étrangères.');
});

test('moment 2 : RESTRICT refuse la suppression du compte, CASCADE supprime l’avis avec lui, SET NULL le garde en mettant NULL dans la case du compte', () => {
  const avant = avis(avec({}));
  assert.deepEqual(avant, [[1, 9, 6, 5, COMMENT]]);
  const jouer = regle => {
    const db = avec({regle}); supprimerInscription(db);
    try { supprimerCompte(db); } catch (e) { return {refuse: e.message, clients: count(db, 'clients'), avis: avis(db)}; }
    return {clients: count(db, 'clients'), avis: avis(db)};
  };
  /* CASCADE : le compte et l’avis disparaissent ensemble, sans confirmation. */
  assert.deepEqual(jouer('ON DELETE CASCADE'), {clients: 8, avis: []});
  /* SET NULL : le compte est supprimé, l’avis reste ; seule la case client_id devient NULL, le produit, la note et le commentaire ne changent pas. */
  assert.deepEqual(jouer('ON DELETE SET NULL'), {clients: 8, avis: [[1, null, 6, 5, COMMENT]]});
  /* RESTRICT, ou pas de règle : la suppression du compte est bloquée, et rien ne change. */
  assert.deepEqual(jouer('ON DELETE RESTRICT'), {refuse: 'FOREIGN KEY constraint failed', clients: 9, avis: avant});
  assert.deepEqual(jouer(''), {refuse: 'FOREIGN KEY constraint failed', clients: 9, avis: avant}, 'sans règle, la suppression est déjà bloquée');
  /* Les trois règles sont lues telles que la base les connaît. */
  const lire = regle => avec({regle}).exec(`SELECT on_delete FROM pragma_foreign_key_list('avis') WHERE "from" = 'client_id'`)[0].values[0][0];
  assert.deepEqual(['ON DELETE RESTRICT', 'ON DELETE CASCADE', 'ON DELETE SET NULL', ''].map(lire), ['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION']);
  /* Ce que la page montre : la règle écrite sur la clé étrangère, ses trois valeurs, les trois messages. */
  for (const t of ["['e3b', '{kc3|client_id} INTEGER']", "['e3c', '  {kr3|REFERENCES clients(id)}']", "'  {od3|ON DELETE} ' + sw('rule', [['?'], ['RESTRICT'], ['CASCADE'], ['SET NULL']], 'rl')",
    "out('o-rs', 'err', 'Suppression bloquée', 'FOREIGN KEY constraint failed', 'm')", "out('o-ca', 'warn', 'Compte et avis supprimés', 'Sans aucune confirmation.')",
    "out('o-sn', 'ok', 'Compte supprimé, avis conservé', 'La colonne <code>client_id</code> vaut <code>NULL</code>.')"]) assert.ok(page.includes(t), `la page montre : ${t}`);
  const caps = val('CAPTIONS').map(c => c[2]);
  for (const c of ['Avec <code>RESTRICT</code>, la suppression<br>du compte est bloquée<br>tant que l’avis lui est rattaché.', 'Avec <code>CASCADE</code>, le compte<br>et l’avis sont supprimés ensemble.',
    'Avec <code>SET NULL</code>, le compte<br>est supprimé mais l’avis reste.', 'Seule la colonne <code>client_id</code><br>devient <code>NULL</code>.']) assert.ok(caps.includes(c), `légende : ${c}`);
  const picks = val('PICKS');
  assert.ok(picks[1].options[0].why.includes('<code>RESTRICT</code>') && picks[1].options[1].why.includes('<code>CASCADE</code>'), 'chaque mauvaise réponse est expliquée par sa règle');
});

test('moment 3 : avec SET NULL, seule la case du compte (client_id) devient NULL ; le produit, la note et le commentaire ne changent pas', () => {
  const db = avec({}); supprimerInscription(db);
  const [avant] = avis(db); supprimerCompte(db); const [apres] = avis(db);
  assert.deepEqual(avant.map((v, k) => v === apres[k]), [true, false, true, true, true], 'une seule case change : la deuxième, client_id (c1)');
  assert.equal(avant[1], 9); assert.equal(apres[1], null);
  assert.deepEqual(Object.keys(val('WHY2')).sort(), ['c0', 'c2', 'c3', 'c4'], 'toutes les cases sauf celle du compte (c1) sont expliquées');
  assert.ok(/if \(i === 2\) return \{text: '[^']+', keys: \['c1'\]\};/.test(page), 'indice du moment 3 : la case du compte (c1) ressort');
  assert.ok(val('PICKS')[2].prompt.includes('<code>SET NULL</code>'), 'le moment 3 porte sur SET NULL');
  /* NULL ne désigne aucun compte : la clé étrangère n’a rien à vérifier, et un avis sans compte est accepté. */
  assert.deepEqual(db.exec('PRAGMA foreign_key_check'), []);
  db.run('INSERT INTO avis (client_id, produit_id, note, commentaire) VALUES (NULL, 6, 4, ?)', ['Très bonne protéine.']);
  assert.equal(count(db, 'avis'), 2);
  assert.ok(page.includes("swap('#wsw .a0', '#wsw .a1', A.g2 + 0.5)") && page.includes("sw('wsw', [['9'], ['NULL', 'nul']])"), 'la page remplace 9 par NULL dans la case du compte');
});

test('moment 4 : avec NOT NULL sur client_id, SET NULL ne peut plus détacher l’avis, et la suppression du compte est refusée', () => {
  const db = avec({notNull: true});
  assert.deepEqual(db.exec(`SELECT "notnull" FROM pragma_table_info('avis') WHERE name = 'client_id'`)[0].values, [[1]], 'la colonne du compte est obligatoire');
  assert.deepEqual(db.exec(`SELECT on_delete FROM pragma_foreign_key_list('avis') WHERE "from" = 'client_id'`)[0].values, [['SET NULL']], 'la règle est toujours SET NULL');
  supprimerInscription(db);
  assert.throws(() => supprimerCompte(db), /NOT NULL constraint failed: avis\.client_id/);
  assert.equal(count(db, 'clients'), 9, 'le compte est toujours là');
  assert.deepEqual(avis(db), [[1, 9, 6, 5, COMMENT]], 'l’avis n’est ni supprimé ni détaché');
  const picks = val('PICKS');
  assert.deepEqual(picks[3].options.map(o => o.label), ['L’avis reste, sans compte', 'L’avis est supprimé avec le compte', 'La suppression du compte est refusée']);
  assert.ok(page.includes("out('o-nn', 'err', 'Suppression du compte refusée', 'NOT NULL constraint failed:<br>avis.client_id', 'm', true)") && page.includes('<span class="sg" id="smn"> NOT NULL</span>'), 'la page montre NOT NULL et le message de la base');
  const caps = val('CAPTIONS').map(c => c[2]);
  for (const c of ['La colonne <code>client_id</code> doit donc<br>autoriser <code>NULL</code>.', 'Et si tu ajoutes <code>NOT NULL</code><br>à cette colonne ?', 'Avec <code>NOT NULL</code>, la suppression<br>du compte est refusée.']) assert.ok(caps.includes(c), `légende : ${c}`);
  /* La même colonne dans la table inscriptions est NOT NULL depuis le chapitre 4 : SET NULL n’y serait pas possible non plus. */
  assert.deepEqual(base().exec(`SELECT "notnull" FROM pragma_table_info('inscriptions') WHERE name = 'client_id'`)[0].values, [[1]]);
});

test('moment 5 : la base ne garde que NULL ; c’est le site web qui affiche « Ancien client » à la place du prénom', () => {
  const db = avec({}), site = () => db.exec(FICHE)[0].values;
  assert.deepEqual(site(), [['Inès', 5, COMMENT]], 'avant : le site affiche le prénom, les cinq étoiles et le commentaire');
  supprimerInscription(db); supprimerCompte(db);
  assert.deepEqual(db.exec('SELECT client_id FROM avis')[0].values, [[null]], 'dans la base de données, il ne reste que NULL');
  assert.deepEqual(site(), [['Ancien client', 5, COMMENT]], 'après : le site affiche « Ancien client », avec les mêmes cinq étoiles et le même commentaire');
  const picks = val('PICKS');
  assert.equal(picks[4].prompt, 'Qui affiche « Ancien client » sur la fiche produit ?');
  assert.deepEqual(picks[4].options.map(o => sp(o.label)), ['Le site web, sans compte associé', 'La base de données', 'La règle SET NULL']);
  for (const t of ["sw('snm', [[PRENOM, 'rnm'], ['Ancien client', 'rnm']], 'sn2')", "swap('#snm .a0', '#snm .a1', A.g7 + 2.4)", '<span class="url">nutriboost.fr/produit/6</span>',
    '<div class="rh">Avis clients<small>1 avis</small></div>', '<span class="emo">🗄️</span>Base de données<i class="sp"></i><code>client_id</code><span>vaut</span><code>NULL</code>'])
    assert.ok(page.includes(t), `la page montre : ${t}`);
  const caps = val('CAPTIONS').map(c => c[2]);
  for (const c of ['Sur la fiche produit,<br>l’avis est toujours là,<br>avec ses cinq étoiles.', 'À la place du prénom,<br>le site écrit « Ancien client ».']) assert.ok(caps.includes(c), `légende : ${c}`);
  /* La base laissée au chapitre suivant : un client de moins (Inès Lefebvre), une inscription de moins, un avis sans compte ; Nathan Petit est toujours là. */
  assert.equal(count(db, 'clients'), 8); assert.equal(count(db, 'inscriptions'), 7); assert.equal(count(db, 'avis'), 1);
  assert.equal(db.exec("SELECT COUNT(*) FROM clients WHERE prenom = 'Nathan' AND nom = 'Petit'")[0].values[0][0], 1);
});

test('moment 6 : chaque situation est rangée sous la bonne règle ; SET NULL ne vaut que pour une colonne qui accepte NULL', () => {
  const BINS = val('BINS'), ITEMS = val('ITEMS');
  assert.deepEqual(BINS.map(b => b[1]), ['CASCADE', 'SET NULL', 'RESTRICT']);
  assert.deepEqual(ITEMS.map(x => x[1]), ['ca', 'sn', 're', 'ca', 'sn', 're']);
  assert.deepEqual(BINS.map(([k]) => ITEMS.filter(x => x[1] === k).length), [2, 2, 2], 'deux situations par règle');
  assert.deepEqual(val('PICKS')[5].options.map(o => o.label), ITEMS.map(x => x[0]), 'les situations à ranger sont celles des correcteurs');
  for (const x of ITEMS) assert.ok(strip(x[2]).length > 40, `${x[0]} : une correction qui explique pourquoi pas les autres règles`);
  /* Elisa, 25 octobre, 15 h 48 : « les cartes quoi ? » : la table cartes se dit « carte de membre » depuis le chapitre 2. */
  assert.ok(ITEMS.some(x => x[0] === 'Les cartes de membre d’un client qui ferme son compte' && x[1] === 're'), 'les cartes de membre, pas « les cartes »');
  assert.ok(!ITEMS.some(x => /cartes d’un/.test(x[0])) && /carte de membre/.test(ITEMS[2][2]), 'la correction aussi parle de la carte de membre');
  /* Le cas de l’avis revient dans la liste : un avis de client se conserve (SET NULL), un avis de produit retiré disparaît (CASCADE). */
  assert.ok(ITEMS.some(x => /avis d’un client/.test(x[0]) && x[1] === 'sn') && ITEMS.some(x => /avis d’un produit/.test(x[0]) && x[1] === 'ca'));
  /* La colonne concernée par chaque situation : celle qui désigne le client ou le produit. */
  const db = avec({}), nullable = (t, c) => db.exec(`SELECT "notnull" FROM pragma_table_info('${t}') WHERE name = '${c}'`)[0].values[0][0] === 0;
  const COLONNES = [['inscriptions', 'client_id'], ['commandes', 'client_id'], ['cartes', 'client_id'], ['avis', 'produit_id'], ['avis', 'client_id'], ['commandes', 'produit_id']];
  ITEMS.forEach((x, k) => { if (x[1] === 'sn') assert.ok(nullable(...COLONNES[k]), `${x[0]} : SET NULL, donc une colonne qui accepte NULL (${COLONNES[k].join('.')})`); });
  assert.deepEqual(COLONNES.map(c => nullable(...c)), [false, true, false, true, true, false], 'les colonnes obligatoires de la base : inscriptions.client_id, cartes.client_id, commandes.produit_id');
  assert.equal(db.exec('SELECT COUNT(*) FROM commandes WHERE client_id IS NULL')[0].values[0][0], 1, 'une commande sans client existe déjà : commande 16');
  /* Les cartes et les commandes d’un produit : la clé est obligatoire, la suppression doit être refusée tant qu’elles existent. */
  assert.throws(() => db.run('DELETE FROM clients WHERE id = 6;'), /FOREIGN KEY constraint failed/, 'Hugo Laurent a une carte (et des commandes)');
  assert.throws(() => db.run('DELETE FROM produits WHERE id = 1;'), /FOREIGN KEY constraint failed/, 'un produit commandé ne peut pas être retiré');
  const caps = val('CAPTIONS').map(c => c[2]);
  for (const c of ['Chaque clé étrangère peut avoir<br>sa propre règle.', '<code>CASCADE</code> convient à une ligne liée<br>qui n’a plus de sens sans l’autre.', '<code>SET NULL</code> convient à une ligne liée<br>qui garde sa valeur sans l’autre.',
    '<code>RESTRICT</code> convient à une ligne liée<br>à traiter d’abord à la main.', 'Attention : <code>CASCADE</code> supprime<br>sans demander de confirmation.']) assert.ok(caps.includes(c), `légende : ${c}`);
});

test('le message : un mail du service client relaie la demande d’Inès Lefebvre mot pour mot, puis demande à l’équipe de la traiter ; l’app s’arrête sur lui jusqu’au toucher', () => {
  const mails = val('MAILS'), opens = val('OPENS'), picks = val('PICKS'), mail = val('MAIL1'), sortie = val('MO[0]'), lignes = val('mailRows(0)'), chaps = val('SCH.chaps');
  assert.equal(mails.length, 1, 'un seul message dans ce chapitre');
  assert.deepEqual([mails[0][0][0], mails[0][0][1], mails[0][3]], ['Le service client', 'NutriBoost', 'service.client@nutriboost.fr'], 'du service client : un client n’écrit plus lui-même depuis le chapitre 5 (Elisa, 25 octobre)');
  assert.equal(mails[0][2], 'équipe'); assert.ok(!(mails[0][6] && mails[0][6].sms), 'un mail, pas un SMS'); assert.equal(mails[0][5], 'Le service client NutriBoost');
  assert.deepEqual(mails[0][4], ['Inès Lefebvre nous a écrit :',
    '<i class="qt">Bonjour, je souhaite supprimer mon compte NutriBoost. Vous pouvez conserver mon avis, mais je ne souhaite plus que mon prénom apparaisse. Merci !</i>',
    'Peux-tu supprimer le compte d’Inès Lefebvre tout en conservant son avis sur la fiche produit ? Il devra apparaître sous la mention « Ancien client ».']);
  assert.deepEqual(base().exec('SELECT prenom, nom FROM clients WHERE id = 9')[0].values[0], ['Inès', 'Lefebvre'], 'Inès Lefebvre est la cliente 9');
  assert.equal(opens.length, 2, 'deux arrêts « toucher » : le mail, puis le bouton « Supprimer le compte »');
  assert.ok(opens[0].at > mail && opens[0].at < mail + sortie, 'l’app s’arrête pendant le message'); assert.equal(opens[0].sel, '#ml1');
  assert.equal(opens[0].label, 'Ouvrir le mail du service client NutriBoost'); assert.equal(opens[0].prompt, 'Touche le mail pour l’ouvrir.');
  /* Le bouton : l’app s’arrête dessus pendant la légende qui demande de cliquer, jusqu’au toucher ; rien n’est noté (ce n’est pas un moment « À toi »). */
  const caps = val('CAPTIONS'), d2 = caps.find(c => c[2] === 'Clique sur le bouton<br>« Supprimer le compte ».');
  assert.ok(d2, 'la légende demande à l’élève de cliquer');
  assert.deepEqual([opens[1].sel, opens[1].prompt, opens[1].label], ['#bdel', 'Touche le bouton.', 'Supprimer le compte d’Inès Lefebvre']);
  /* Elisa, 25 octobre, 16 h 21 : un doigt seul qui monte et descend, sans texte (la consigne reste dite à VoiceOver), posé sur le coin du bouton pour ne pas
     cacher la table clients ; 16 h 22 : le bouton s’enfonce dès l’appui, puis rebondit, une onde le traverse, la corbeille remue, un anneau s’en échappe. */
  assert.deepEqual(opens[1].hand, {x: 0.86, y: 0.78}, 'le bout du doigt sur le coin bas droit du bouton, après la fin du mot « compte »');
  assert.deepEqual([opens[1].press, opens[1].rest], [{y: 7, boxShadow: '0 2px 0 #A92A31'}, {y: 0, boxShadow: '0 9px 0 #A92A31'}], 'enfoncé au toucher, au repos sinon');
  assert.ok(!opens[0].hand, 'le mail garde sa bulle « Touche le mail pour l’ouvrir. » : aucune légende ne le dit');
  for (const t of ["tl.set('#bring', {autoAlpha: 0.9, scale: 1}, BTN + 0.05);", "tl.to('#bring', {autoAlpha: 0, scale: 1.16, duration: 0.6, ease: 'power2.out'}, BTN + 0.051);",
    "tl.to('#bdel .emo', {rotation: -16, transformOrigin: '50% 85%', duration: 0.07, yoyo: true, repeat: 3, ease: 'sine.inOut'}, BTN + 0.06);",
    "tl.to('#bdel', {scale: 1.04, duration: 0.14, ease: 'power2.out'}, BTN + 0.1)", '<i class="abs bring" id="bring"></i><div class="abs run bdel" id="bdel">'])
    assert.ok(page.includes(t), `micro-interaction : ${t}`);
  assert.ok(!/fromTo\('#bdel'|fromTo\('#bring'/.test(page), 'aucun « fromTo » sur le bouton ni sur l’anneau : en revenant en arrière, rien ne reste enfoncé ni allumé');
  assert.equal(opens[1].at, val('BTN')); assert.ok(opens[1].at > d2[0] + 1 && opens[1].at < d2[1] - 1, 'le bouton est visible, puis l’app s’arrête ; la légende ne reste pas longtemps après le toucher');
  assert.ok(opens[1].at > picks[0].at && opens[1].at < picks[1].at && opens[1].at > opens[0].at, 'après le moment 1 et le mail, avant le moment 2');
  assert.ok(val('NOTES') === 237.73 && val('DURATION') === 244.93, 'un arrêt « toucher » n’allonge pas la vidéo');
  assert.ok(page.includes("if (!APP) fingerTap($('#bdel'), BTN, '#tapw', 0.6, 62);") && page.includes("press($('#bdel'), BTN, '#A92A31', 9, false);"),
    'le doigt ne montre le geste que dans la vidéo seule ; dans l’app, le bouton s’enfonce au toucher de l’élève');
  assert.equal(l68.video.moments, 6, 'le bouton ne compte pas parmi les moments « À toi »');
  /* Elisa, 25 octobre, 15 h 48 : « met des espaces dans le mail pour espacer » : un blanc entre les blocs, la citation collée à sa phrase, la signature collée à « Merci ! ». */
  assert.ok(page.includes('.mb .sn+.sn{margin-top:34px}') && page.includes('.mb .sn.q{margin-top:14px}') && page.includes('.mb .sn.s{margin-top:0}'), 'espaces entre les blocs du mail');
  assert.ok(page.includes(`\${/class="qt"/.test(x) ? ' q' : ''}`), 'la citation reçoit sa classe');
  /* Le message reste le temps de ses lignes : une ligne toutes les 0,28 s, le départ juste après la pause de lecture. */
  assert.equal(lignes, 6, 'lignes du mail : Bonjour, ses trois paragraphes, Merci !, la signature'); assert.equal(sortie, 4.08, 'le départ : +2,68 s + 0,28 s par ligne après la première');
  /* Il arrive après le premier moment et avant le deuxième, derrière la carte-titre « Quelque temps plus tard… ». */
  assert.ok(picks[0].at < val('T3') && mail >= val('T3') + val('TC') && mail < picks[1].at, 'après le moment 1, après la carte-titre, avant le moment 2');
  assert.equal(chaps[2].label, 'Quelque temps plus tard…'); assert.equal(chaps[2].a, val('T3'), 'le chapitre commence avec la carte-titre');
  assert.ok(page.includes('<span>Quelque temps<br>plus tard…</span>') && page.includes('<span class="emo">📩</span>'), 'la carte-titre');
  assert.ok(page.includes('Elisa, 25 octobre'), 'la page garde la trace de la demande d’Elisa');
});

/* ---------- Propre au chapitre 10 : la suite du chapitre 9, l’annonce de la leçon Transactions ---------- */
test('chapitre 10 : écran titre, ouverture comme aux autres chapitres, annonce de la prochaine leçon', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 10 : ON DELETE</title>') && page.includes('<div class="tagpill">Projet · Chapitre 10</div>')
    && page.includes('<span>O</span><span class="sp">N</span><span>D</span><span>E</span><span>L</span><span>E</span><span>T</span><span>E</span>') && page.includes('<div class="abs sub">Quand un compte disparaît</div>'),
    'écran titre : « Projet · Chapitre 10 », ON DELETE, « Quand un compte disparaît »');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.', 'la même première légende que les chapitres 2 à 9');
  assert.equal(caps[1], 'Au chapitre 9, tu as supprimé<br>des lignes avec <code>DELETE</code>.', 'le chapitre précédent');
  /* La fin du chapitre 9 annonce « ON DELETE » : c’est ce chapitre. */
  const del = fs.readFileSync(path.join(root, 'assets/anim/projet-delete.html'), 'utf8');
  assert.ok(del.includes('avec <code>ON DELETE</code>.') && del.includes('Prochaine leçon · ON DELETE</span>'), 'le chapitre 9 annonce celui-ci');
  /* Il annonce à son tour la leçon suivante du cours : Transactions. */
  assert.ok(caps.includes('Dans la prochaine leçon, tu apprendras<br>à tout valider ou tout annuler<br>avec une transaction.') && page.includes('Prochaine leçon · Transactions</span>'), 'annonce de la prochaine leçon');
  assert.equal(lessons[lessons.findIndex(l => l.id === 68) + 1].titre, 'Transactions');
  assert.equal(caps[caps.length - 2], 'Pour finir, voici les <b>trois idées à retenir</b>.');
});

test('le récapitulatif, mot pour mot, dans la vidéo comme dans la fiche de la leçon : trois idées, chacune avec sa phrase puis sa précision', () => {
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div><div class="rtxt">(.*?)<\/div><\/div>/g)].map(m => {
    const [phrase, detail] = m[2].split('<span class="rs">');
    return [m[1], strip(phrase), strip(detail.replace(/<\/span>$/, ''))];
  });
  const RECAP = [['🔀', 'La règle ON DELETE décide du sort de la ligne liée.', 'Elle se définit sur la clé étrangère.'],
    ['🧭', 'Trois règles au choix.', 'RESTRICT bloque la suppression, CASCADE supprime aussi l’avis, SET NULL le conserve sans compte.'],
    ['🏷️', 'Avec SET NULL, la colonne doit autoriser NULL.', 'Le site affiche alors « Ancien client ».']];
  assert.deepEqual(rows, RECAP, 'la vidéo : les trois idées');
  const fiche = html.slice(html.indexOf('guide({ id:68,'), html.indexOf('guide({ id:62,'));
  const idees = [...fiche.matchAll(/\["(🔀|🧭|🏷️)","([^"]*)","([^"]*)"(?:,"([^"]*)")?\]/g)].map(m => [m[1], strip(m[2]), strip(m[3])]);
  assert.deepEqual(idees, RECAP, 'la fiche de la leçon dit la même chose que la vidéo');
  assert.ok(page.includes('recapScene(RECAP, [RECAP + 0.7, RECAP + 2.1, RECAP + 3.5]);'), 'chaque idée se révèle à son tour');
});

test('ce que la vidéo ne reprend pas des anciens cours : plus de table satisfaction ni de paniers, de DEFAULT ni de contraintes UNIQUE ou CHECK ; le chapitre ne parle pas de SQL comme d’une personne', () => {
  const caps = val('CAPTIONS').map(c => strip(c[2])).join(' ');
  for (const mot of ['satisfaction', 'panier', 'DEFAULT', 'CHECK', 'PRAGMA', 'TRIGGER']) assert.ok(!caps.includes(mot) && !page.includes(`>${mot}`), `la vidéo n’enseigne pas ${mot}`);
  assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page), 'SQL n’est jamais personnifié');
  assert.ok(!html.slice(html.indexOf('guide({ id:68,'), html.indexOf('guide({ id:62,')).includes('sit:{'), 'plus de cours texte ON DELETE dans la fiche');
  /* L’histoire est celle de l’avis seul : plus d’atelier lié à l’avis, plus de SMS, plus d’erreur de syntaxe à provoquer. */
  assert.ok(!/atelier_id|syntax error/.test(JSON.stringify([val('CAPTIONS'), val('PICKS'), val('MAILS')])), 'la table avis relie un compte et un produit (pas d’atelier), et la vidéo ne provoque aucune erreur de syntaxe');
});

test('zones à toucher : les lignes des tables font 62 px (le doigt) ; les indices des trois moments « toucher » et « choisir » ressortent la bonne zone, en typographie française', () => {
  const hv = +page.match(/\.tz \.r\{height:(\d+)px/)[1];
  assert.ok(hv >= 62, `lignes des tables clients, avis et produits : ${hv} px`);
  assert.ok(/return h && Object\.assign\(h, \{text: fr\(h\.text\)\}\);/.test(page), 'l’indice passe par la typographie française (espaces insécables)');
  assert.equal([...page.matchAll(/return \{text: '([^']+)'/g)].length, 5, 'cinq indices écrits : un par moment à choix ou à toucher');
});
