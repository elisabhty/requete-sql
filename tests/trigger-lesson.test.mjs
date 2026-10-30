/* Projet NutriBoost, chapitre 15 (leçon 70 « Les triggers ») : la vidéo interactive assets/anim/projet-trigger.html, testée aussi dans lesson-video.test.mjs.
   La trame est celle d’Elisa (25 octobre, 20 h 52, « TRIGGER — Qui a changé le prix du collagène ? ») : la responsable commerciale écrit que
   le collagène est passé de 39,90 € à 34,90 €, sans qu’elle retrouve la date du changement ; la table historique_prix garde le produit concerné,
   l’ancien prix, le nouveau prix et la date du changement ; le trigger garder_prix l’alimente « après une modification de produit, si son prix
   a réellement changé ». Rejoué, le changement de prix ajoute tout seul une ligne à l’historique ; une modification du stock seul n’en ajoute
   aucune. Ce que la vidéo montre est ici rejoué dans SQLite : c’est ce que la base répond vraiment.
   Leçon seule : ni cours texte, ni exercice ; elle remplace l’ancien cours texte Les triggers (le Magnésium, le journal des clients supprimés). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-trigger.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l70 = lessons.find(l => l.id === 70);

/* Les données de la page (le déroulé des légendes, le message, les six moments), évaluées telles quelles. */
const a = page.indexOf('const SCH = '), b = page.indexOf('/* ---------- Gabarits');
assert.ok(a > 0 && b > a, 'données de la page localisées');
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(a, b), D);
const val = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, D));
const strip = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/* Les requêtes que la page tape, telles qu’elle les écrit (gabarits Q_…) : sans le commentaire ni le balisage {repère|texte} ; <> s’y écrit &lt;&gt;. */
const Q = vm.createContext({});
vm.runInContext([...page.matchAll(/^const Q_[A-Z0-9]+ = [\s\S]*?\]\];$/gm)].map(m => m[0]).join('\n') + ';this.Q = {Q_TRIG, Q_PRIX, Q_STOCK};', Q);
const sql = q => Q.Q[q].map(([s]) => s).filter(s => !s.trim().startsWith('--')).join('\n').replace(/\{\w+\|([^{}]*)\}/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/* ---------- La base de la vidéo ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
/* La base NutriBoost telle que le chapitre 13 la laisse : les tables de la boutique (SCHEMA_SQL), les quatre tables des ateliers, la table avis
   (chapitre 11), la table remplacements (chapitre 12 : le remplacement de Léa Simon, et le shaker retiré du stock) et la table cadeaux (chapitre 13 :
   la Protéine Végétale offerte, retirée du stock). Onze tables. */
function base() {
  const db = new SQL.Database();
  db.run(vm.runInContext('SCHEMA_SQL', ctx));
  /* Le chapitre 10 (MERGE, 30 octobre) : l’inventaire de l’entrepôt met à jour la Fibre Prébiotique (150) et Oméga 3 (75), et ajoute la Spiruline Bio. */
  db.run("UPDATE produits SET stock = 150 WHERE id = 1; UPDATE produits SET stock = 75 WHERE id = 7; INSERT INTO produits VALUES (9, 'Spiruline Bio', 'Nutrition', 22.90, 40);");
  /* Le chapitre 14 (procédures et fonctions stockées, 30 octobre) : CALL expedier_commande(13), puis (14). */
  db.run("UPDATE commandes SET statut = 'expédiée' WHERE id IN (13, 14);");
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
    INSERT INTO cadeaux (client_id, produit_id, quantite) VALUES (7, 6, 1); UPDATE produits SET stock = stock - 1 WHERE id = 6;`);
  return db;
}
/* La table que l’équipe commerciale ajoute : le produit concerné, l’ancien prix, le nouveau prix et la date du changement (mots d’Elisa). */
const HISTORIQUE = 'CREATE TABLE historique_prix (produit_id INTEGER REFERENCES produits(id), ancien_prix REAL, nouveau_prix REAL, date_changement TEXT);';
/* La base du chapitre, la table historique_prix et le trigger : prêts pour le changement de prix rejoué (le collagène à 39,90 €). */
const avecTrigger = () => { const db = base(); db.run(HISTORIQUE); db.run(sql('Q_TRIG')); return db; };
const tables = db => db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(r => r[0]);
const count = (db, t) => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
const lignes = (db, t) => (db.exec(`SELECT * FROM ${t}`)[0] || {values: []}).values;
const produit = (db, id) => db.exec(`SELECT prix, stock FROM produits WHERE id = ${id}`)[0].values[0];

test('Les triggers : juste après Procédures et fonctions stockées, dans le module « Triggers et concurrence », juste avant Concurrence et isolation', () => {
  const m = modules.find(x => x.titre === 'Triggers et concurrence');
  assert.deepEqual([...m.lessons.map(l => l.id)], [83, 70, 71], 'Procédures et fonctions stockées, Les triggers, puis Concurrence et isolation');
  const liste = lessons.map(l => l.id);
  assert.equal(liste.indexOf(70), liste.indexOf(83) + 1, 'juste après Procédures et fonctions stockées (30 octobre)');
  assert.equal(liste[liste.indexOf(70) + 1], 71, 'Concurrence et isolation vient juste après');
  assert.equal(l70.titre, 'Les triggers');
  assert.equal(l70.résumé, 'Déclencher une action automatiquement');
});

test('recherche et leçon seule : ni texte de secours, ni exercice, ni quiz', () => {
  const mots = html.match(/\n  70:'([^']+)',/)[1];
  assert.ok(['trigger', 'declencheur', 'after update on', 'when', 'old', 'new', 'current_timestamp', 'historique_prix', 'collagene', 'prix'].every(m => mots.includes(m)),
    'trouvé par la recherche : trigger, déclencheur, AFTER UPDATE ON, WHEN, OLD, NEW, l’historique des prix, le collagène…');
  assert.ok(l70.leconSeule && l70.video && !l70.situation && !l70.consigne && !l70.solution && !l70.petitDefi && !l70.learningCheck && !l70.testeVariants && !l70.anatomie, 'la vidéo est le cours');
  assert.equal(l70.video.moments, 6); assert.equal(l70.video.seuil, 4);
  assert.equal(l70.video.anim, 'assets/anim/projet-trigger.html?app&embed');
  const recap = l70.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['⚡', '🔀', '🎯'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
  assert.equal(vm.runInContext('QCM', ctx)[70], undefined, 'plus de quiz : la vidéo et ses moments valident la leçon (Elisa, 28 octobre)');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  assert.equal(val('NOTES'), 244.94);
  assert.ok(page.includes('notesAt: 244.94,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 252.14);
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999, `légende ${k + 1} : après la précédente`);
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  /* Les trois parties de la trame d’Elisa (le message, la table d’historique et le trigger, la vérification avec le stock), découpées comme dans
     les autres chapitres du projet : une partie par geste, puis « Ligne ajoutée ou non ? », où l’élève range les modifications, et le récapitulatif. */
  assert.deepEqual(chaps.map(c => c.label), ['Qui a changé le prix ?', 'Garder chaque changement', 'Créer le trigger', 'Modifier le prix', 'Lire la nouvelle ligne',
    'Vérifier avec le stock', 'Ligne ajoutée ou non ?', 'À retenir']);
  caps.forEach(([, , t, lines], k) => {
    const txt = strip(t);
    assert.ok(/^[A-ZÀ-ÖØ-Þ0-9«]/.test(txt) || /^(<b[^>]*>)?<code>/.test(t), `légende ${k + 1} : une phrase qui commence (« ${txt.slice(0, 50)} »)`);
    assert.ok(/[.!?»]$/.test(txt), `légende ${k + 1} : une phrase qui finit (« …${txt.slice(-50)} »)`);
    assert.ok(!/[.!?»] ?[A-ZÀ-ÖØ-Þ«]/.test(txt), `légende ${k + 1} : une seule phrase par bulle (« ${txt.slice(0, 70)} »)`);
    assert.equal(lines, undefined, `légende ${k + 1} : trois lignes au plus`);
    assert.ok(t.split('<br>').length <= 3, `légende ${k + 1} : trois lignes au plus`);
  });
  assert.deepEqual(picks.map(p => p.kind), ['pick', 'pick', 'pick', 'tap', 'pick', 'sort']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    assert.equal(p.options.length, 3, `${p.prompt} : trois réponses`);
    for (const o of p.options) assert.ok(o.why && strip(o.why).length > 30, `${o.label} : une explication`);
  }
  assert.deepEqual(picks[0].options.map(o => !!o.ok), [false, true, false], 'un UPDATE remplace l’ancien prix, sans garder de trace');
  assert.deepEqual(picks[1].options.map(o => !!o.ok), [true, false, false], 'après une modification de prix d’un produit');
  assert.deepEqual(picks[2].options.map(o => !!o.ok), [false, false, true], 'OLD.prix vaut 39.90, le prix avant la modification');
  assert.deepEqual(picks[4].options.map(o => !!o.ok), [false, true, false], 'le stock seul : aucune ligne');
  assert.equal(picks[3].need, 1, 'une case à toucher : celle du nouveau prix');
  assert.equal(picks[5].options.length, 6, 'six modifications à ranger');
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
});

test('les phrases d’Elisa (25 octobre, 20 h 52) : sa trame, une phrase par bulle, avec ses mots', () => {
  const caps = val('CAPTIONS').map(c => c[2]), lus = caps.map(strip);
  const dit = (...phrases) => phrases.forEach(p => assert.ok(lus.includes(p), `légende : ${p}`));
  /* Ses trois bulles, mot pour mot, juste après la ligne ajoutée par le trigger */
  dit('Tu n’as exécuté que la modification du prix.', 'Le TRIGGER a ajouté la ligne d’historique automatiquement.',
    'Un trigger déclenche une action lorsqu’un événement précis se produit dans une table.');
  const d6 = lus.indexOf('Tu n’as exécuté que la modification du prix.');
  assert.ok(lus[d6 - 1] === 'Une ligne apparaît automatiquement dans la table historique_prix.' && lus[d6 + 1].startsWith('Le TRIGGER') && lus[d6 + 2].startsWith('Un trigger déclenche'),
    'la ligne apparaît, puis ses trois bulles, à la suite');
  /* La table d’historique, le déclencheur à créer, la vérification avec le stock */
  dit('Elle garde le produit concerné, l’ancien prix, le nouveau prix et la date du changement.',
    'Pour vérifier, tu modifies ensuite uniquement le stock du collagène.', 'Aucune ligne n’est ajoutée à l’historique des prix.');
  /* Ses mots du 26 octobre (7 h 18) : ce qu’est un trigger (Réf 3), AFTER UPDATE ON (Réf 4), WHEN (Réf 2), BEGIN et END (Réf 5). Une phrase
     trop longue pour trois lignes devient deux bulles ; « la table historique_prix » plutôt que le nom seul, comme toujours. */
  const suite = (...phrases) => { const i = lus.indexOf(phrases[0]); assert.ok(i >= 0, `légende : ${phrases[0]}`);
    phrases.forEach((p, k) => assert.equal(lus[i + k], p, 'ses phrases, à la suite')); };
  suite('Pour l’instant, aucun changement n’y est enregistré.',
    'Un déclencheur, ou TRIGGER, est un bloc de code SQL qui s’exécute automatiquement lors d’un événement.',
    'Par exemple : l’ajout, la modification ou la suppression de données.',
    'Ici, chaque fois que le prix d’un produit change, le trigger enregistre l’ancien prix, le nouveau et la date.',
    'Il les ajoute à la table historique_prix.',
    'Tu n’as pas à ajouter toi-même cette ligne dans l’historique.');
  suite('CREATE TRIGGER crée le trigger, ici nommé garder_prix.',
    'AFTER UPDATE ON produits signifie « après une modification dans la table produits ».',
    'Cela précise à quel moment le déclencheur intervient.',
    'WHEN précise la condition à respecter : l’ancien prix (OLD.prix) doit être différent du nouveau (NEW.prix).',
    'Si le prix reste identique, rien n’est ajouté à l’historique.',
    'BEGIN et END encadrent les instructions à exécuter automatiquement.',
    'Ici, INSERT INTO ajoute une ligne dans la table historique_prix.',
    'Elle contient l’identifiant du produit, l’ancien prix, le nouveau prix et la date du changement.',
    'OLD.prix donne l’ancien prix, NEW.prix le nouveau.');
  /* L’explication du moment 2 (Réf 1), mot pour mot */
  assert.equal(strip(val('PICKS')[1].options[0].why), 'AFTER UPDATE ON produits indique que le trigger intervient après une modification dans la table produits. ' +
    'La condition WHEN OLD.prix <> NEW.prix précise que son action s’exécute uniquement si le prix a changé : OLD.prix correspond à l’ancien prix et NEW.prix au nouveau.');
  /* Le changement de prix, 39,90 € → 34,90 €, rejoué pour tester le trigger */
  dit('Dans la table produits, le collagène est bien à 34,90 €.', 'Pour tester le trigger, rejouons le changement de prix du collagène.',
    'Le collagène repart de son ancien prix : 39,90 €.', 'La date vient de CURRENT_TIMESTAMP : le 25/10/2026 à 14:32.');
  assert.ok(page.includes('Déclenche automatiquement une action lorsqu’un&nbsp;événement précis se produit dans la base.'), 'la bulle de la mascotte');
  assert.ok(page.includes('Elisa, 25 octobre, 20 h 52'), 'la page garde la trace de la trame d’Elisa');
});

test('la base du chapitre 13 : onze tables ; le collagène, produit 2 (Collagène Marin, 39,90 €, 80 en stock)', () => {
  const db = base(), TB = val('TB');
  assert.deepEqual(TB.map(t => t[3]), ['clients', 'commandes', 'fidelite', 'produits', 'coachs', 'ateliers', 'inscriptions', 'cartes', 'avis', 'remplacements', 'cadeaux']);
  assert.deepEqual(TB.map(t => t[3]).sort(), tables(db), 'aucune table de la base n’est oubliée à l’écran');
  for (const [, , , name, n] of TB) assert.equal(count(db, name), n, `${name} : ${n} lignes`);
  assert.ok(page.includes('<span>11 tables</span>'), '11 tables');
  assert.deepEqual(lignes(db, 'cadeaux'), [[1, 7, 6, 1]], 'la Protéine Végétale offerte à Léa Simon, validée au chapitre 13');
  assert.deepEqual(db.exec('SELECT id, nom, prix, stock FROM produits WHERE id = 2')[0].values, [[2, 'Collagène Marin', 39.9, 80]], 'le collagène, avant le changement de prix');
  assert.deepEqual(val('COLLAGENE'), {id: 2, nom: 'Collagène Marin', prix: 39.9, nouveau: 34.9, stock: 80});
  assert.ok(page.includes("line('tp2', cell(0, '<i class=\"v\">2</i>') + cell(1, '<i class=\"v\">Collagène Marin</i>') + cell(2, sw('pr2', [['34.90'], ['39.90'], ['34.90']])) + cell(3, sw('st2', [['80'], ['79']])))"),
    'l’extrait de la table produits : 34,90 € (changé sans trace), 39,90 € (le changement rejoué), puis 34,90 € ; le stock passe de 80 à 79');
});

test('sans trigger : un UPDATE remplace l’ancien prix, et rien ne garde ni l’ancien prix ni la date', () => {
  const db = base();
  db.run(sql('Q_PRIX'));
  assert.deepEqual(produit(db, 2), [34.9, 80], 'le collagène est passé à 34,90 €');
  assert.equal(db.exec('SELECT COUNT(*) FROM produits WHERE prix = 39.9')[0].values[0][0], 0, 'plus aucune trace de 39,90 €');
  assert.deepEqual(db.exec("SELECT name FROM pragma_table_info('produits')")[0].values.map(r => r[0]), ['id', 'nom', 'categorie', 'prix', 'stock'], 'aucune colonne ne garde la date du changement');
  assert.equal(val('PICKS')[0].options[1].label, 'Un UPDATE remplace l’ancien prix, sans garder de trace');
});

test('le trigger, rejoué dans SQLite : la ligne d’historique apparaît toute seule ; le stock seul n’ajoute rien', () => {
  assert.equal(sql('Q_TRIG'), 'CREATE TRIGGER garder_prix\nAFTER UPDATE ON produits\nWHEN OLD.prix <> NEW.prix\nBEGIN\n  INSERT INTO historique_prix\n    (produit_id, ancien_prix,\n' +
    '     nouveau_prix, date_changement)\n  VALUES (OLD.id, OLD.prix,\n          NEW.prix, CURRENT_TIMESTAMP);\nEND;', 'le trigger de la vidéo');
  assert.equal(sql('Q_PRIX'), 'UPDATE produits\nSET prix = 34.90\nWHERE id = 2;');
  assert.equal(sql('Q_STOCK'), 'UPDATE produits\nSET stock = stock - 1\nWHERE id = 2;');
  const db = avecTrigger();
  assert.deepEqual(db.exec("SELECT name, tbl_name FROM sqlite_master WHERE type = 'trigger'")[0].values, [['garder_prix', 'produits']], 'le trigger est attaché à la table produits');
  assert.deepEqual(lignes(db, 'historique_prix'), [], 'aucun changement enregistré pour l’instant');
  /* « Tu n’as exécuté que la modification du prix » : l’UPDATE seul ; le trigger ajoute la ligne d’historique. */
  db.run(sql('Q_PRIX'));
  const [[pid, ancien, nouveau, quand]] = lignes(db, 'historique_prix');
  assert.deepEqual([pid, ancien, nouveau], [2, 39.9, 34.9], 'le produit 2, de 39,90 € à 34,90 €');
  assert.match(quand, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/, 'CURRENT_TIMESTAMP : la date et l’heure');
  assert.match(val('QUAND'), /^2026-10-25 14:32:\d\d$/, 'la vidéo montre une date au même format : le 25/10/2026 à 14:32');
  assert.ok(page.includes("cell(3, `<i class=\"v\">${QUAND}</i>`)"), 'la ligne ajoutée montre cette date');
  /* « Tu modifies ensuite uniquement le stock » : le trigger se déclenche, sa condition est fausse, aucune ligne n’est ajoutée. */
  db.run(sql('Q_STOCK'));
  assert.deepEqual(produit(db, 2), [34.9, 79], 'le stock passe de 80 à 79');
  assert.equal(count(db, 'historique_prix'), 1, 'toujours une seule ligne dans l’historique');
  /* Ce que la page montre : le trigger qui se déclenche, sa condition (vraie, puis fausse), l’écran qui se déplace vers l’historique. */
  for (const t of ["tapButton('bcre', CRE, '#4B30CC');", "mark('#tgc', CRE + 0.55);", "tapButton('bmod', MOD, '#A3216A');", "swap('#pr2 .a1', '#pr2 .a2', MOD + 0.45);", 'fire(MOD + 0.85);',
    "hide('#hp', A.d1 + 0.6, {y: 600}, 0.55, 'power2.in');", "tl.fromTo('#hp', {autoAlpha: 1, y: 700}, {autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.inOut', immediateRender: false}, MOD + 1.3);",
    "rowOut('#rhp0', MOD + 2.6); rowIn('#rhp1', MOD + 2.65);", "swap('#st2 .a0', '#st2 .a1', A.f3 + 0.45);", 'fire(A.f3 + 0.85);',
    '<i class="a0">39.90 &lt;&gt; 34.90</i><i class="a1">34.90 &lt;&gt; 34.90</i>', '<i class="a0 ok">✓ Vrai : une ligne ajoutée</i><i class="a1 no">✕ Faux : aucune ligne</i>'])
    assert.ok(page.includes(t), `la page montre : ${t}`);
  assert.ok(page.includes("$('#rhp1').style.height = '0px';") && page.includes("$('#hp').style.height = $('#hp').offsetHeight + 'px';"), 'l’historique garde sa hauteur : une ligne à la fois');
});

test('moment 3 : pendant le changement de prix, OLD.prix vaut l’ancien prix et NEW.prix le nouveau', () => {
  const db = avecTrigger();
  db.run('CREATE TABLE vu (ancien REAL, nouveau REAL); CREATE TRIGGER lire AFTER UPDATE ON produits BEGIN INSERT INTO vu VALUES (OLD.prix, NEW.prix); END;');
  db.run(sql('Q_PRIX'));
  assert.deepEqual(lignes(db, 'vu'), [[39.9, 34.9]], 'OLD.prix : 39,90 € ; NEW.prix : 34,90 €');
  assert.equal(val('PICKS')[2].options[2].label, '39.90, le prix avant la modification');
});

test('moment 4 : la case remplie avec NEW.prix ; d’où viennent les autres', () => {
  assert.deepEqual(Object.keys(val('WHY4')).sort(), ['c0', 'c1', 'c3']);
  assert.ok(/if \(i === 3\) return \{text: '[^']+', keys: \['c2'\]\};/.test(page), 'indice du moment 4 : la case du nouveau prix ressort');
  assert.equal(val('PICKS')[3].prompt, 'Touche la case que le trigger a remplie avec NEW.prix.');
  assert.ok(page.includes('cell(2, \'<i class="v">34.90</i><i class="hc" id="hc2"></i>\')') && page.includes("const M4_ANS = ['#hc2'];"), 'la case du nouveau prix s’entoure');
});

test('moment 6 : chaque modification est rangée selon ce que fait le trigger, comme dans SQLite', () => {
  const BINS = val('BINS'), ITEMS = val('ITEMS');
  assert.deepEqual(BINS.map(b => b[1]), ['Une ligne ajoutée', 'Aucune ligne']);
  assert.deepEqual(ITEMS.map(x => x[1]), ['ad', 'no', 'ad', 'no', 'no', 'ad']);
  assert.deepEqual(val('PICKS')[5].options.map(o => o.label), ITEMS.map(x => x[0]));
  for (const x of ITEMS) assert.ok(strip(x[2]).length > 40, `${x[0]} : une correction qui explique le choix`);
  /* Chaque modification, jouée après le changement de prix du collagène (déjà une ligne dans l’historique). */
  const JOUE = ['UPDATE produits SET prix = 32.90 WHERE id = 2;', 'UPDATE produits SET stock = stock - 1 WHERE id = 8;',
    "UPDATE produits SET nom = 'Tisane Détox Bio', prix = 13.00 WHERE id = 5;", 'UPDATE produits SET prix = prix WHERE id = 6;',
    "INSERT INTO produits (nom, categorie, prix, stock) VALUES ('Spiruline', 'Nutrition', 22.90, 40);", 'UPDATE produits SET prix = 12.00 WHERE id = 8;'];
  ITEMS.forEach(([label, k], i) => {
    const db = avecTrigger(); db.run(sql('Q_PRIX'));
    db.run(JOUE[i]);
    assert.equal(count(db, 'historique_prix') - 1, k === 'ad' ? 1 : 0, `${label} : ${k === 'ad' ? 'une ligne ajoutée' : 'aucune ligne'}`);
  });
});

test('le message : la responsable commerciale écrit par SMS ; l’app s’arrête sur lui, et sur les deux boutons de la trame', () => {
  const mails = val('MAILS'), opens = val('OPENS'), picks = val('PICKS'), caps = val('CAPTIONS');
  assert.equal(mails.length, 1);
  assert.deepEqual([mails[0][0], mails[0][2], mails[0][6]], [['La responsable', 'commerciale', 'RC'], 'équipe', {sms: true, hello: 'Bonjour !', bye: null}]);
  /* Elisa, 25 octobre, 20 h 52 : son message, mot pour mot (« Bonjour ! », puis ses deux phrases, sans « Merci ! » de plus). */
  assert.deepEqual(mails[0][4], ['Le collagène est passé de 39,90 € à 34,90 €, mais je ne retrouve pas la date du changement.',
    'Peux-tu faire en sorte que chaque modification de prix soit désormais conservée automatiquement ?']);
  assert.equal(vm.runInContext('mailRows(0)', D), 3, 'trois bulles : « Bonjour ! » et ses deux phrases');
  assert.deepEqual(opens.map(o => o.sel), ['#ml1', '#bcre', '#bmod']);
  assert.deepEqual(opens.map(o => o.label), ['Ouvrir le message de la responsable commerciale', 'Créer le trigger', 'Modifier le prix']);
  assert.ok(opens[0].at < picks[0].at && opens[1].at > picks[1].at && opens[1].at < picks[2].at && opens[2].at > picks[2].at && opens[2].at < picks[3].at,
    'le message avant le moment 1, « Créer le trigger » après le moment 2, « Modifier le prix » après le moment 3');
  const bulles = {'#bcre': 'Clique sur le bouton<br>« Créer le trigger ».', '#bmod': 'Clique sur le bouton<br>« Modifier le prix ».'}, lips = {'#bcre': '#4B30CC', '#bmod': '#A3216A'};
  for (const o of opens.slice(1)) {
    assert.deepEqual(o.hand, {x: 0.86, y: 0.78});
    assert.deepEqual([o.press, o.rest], [{y: 7, boxShadow: `0 2px 0 ${lips[o.sel]}`}, {y: 0, boxShadow: `0 9px 0 ${lips[o.sel]}`}]);
    const c = caps.find(x => x[2] === bulles[o.sel]);
    assert.ok(c && o.at > c[0] + 1 && o.at < c[1] - 1, `${o.sel} : le bouton est visible pendant sa légende, puis l’app s’arrête`);
  }
  assert.ok(!/fromTo\('#b(cre|mod)|fromTo\(b\b/.test(page), 'aucun « fromTo » sur un bouton ni sur son anneau');
  for (const t of ['capOff(B.r2 - 0.2);', "hide('#bc', B.r2 - 0.1, {y: -30}, 0.35);", "sceneOn('#sw', MAIL1 + MO[0] + 0.45);"]) assert.ok(page.includes(t), `le message : ${t}`);
  assert.ok(page.includes('(MAILS[n][6] || {}).hello, (MAILS[n][6] || {}).photo, (MAILS[n][6] || {}).bye)'), 'la page passe au moteur la formule et la fin du SMS');
});

test('chapitre 15 : écran titre, ouverture comme aux autres chapitres, annonce de la prochaine leçon', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 15 : TRIGGER</title>') && page.includes('<div class="tagpill">Projet · Chapitre 15</div>')
    && page.includes('<span>T</span><span>R</span><span>I</span><span>G</span><span>G</span><span>E</span><span>R</span>')
    && page.includes('<div class="abs sub">Déclencher une action automatiquement</div>'), 'écran titre : « Projet · Chapitre 15 », TRIGGER, « Déclencher une action automatiquement »');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.');
  assert.equal(caps[1], 'Au chapitre 14, une procédure<br>stockée t’a permis de réutiliser<br>un traitement.', 'le chapitre précédent');
  const pr = fs.readFileSync(path.join(root, 'assets/anim/projet-procedures.html'), 'utf8');
  assert.ok(pr.includes('les triggers : des actions lancées') && pr.includes('Prochaine leçon · Les triggers</span>'), 'le chapitre 14 annonce celui-ci');
  assert.ok(page.includes("on('#bw-cm .hl', A.r2 + 0.6, 0.2);"), 'la table commandes, que la procédure a expédiée, s’allume avec cette légende');
  assert.ok(caps.includes('Dans la prochaine leçon, deux clients<br>réserveront la dernière place<br>d’un atelier en même temps.') && page.includes('Prochaine leçon · Concurrence et isolation</span>'),
    'annonce de la prochaine leçon');
  assert.equal(lessons[lessons.findIndex(l => l.id === 70) + 1].titre, 'Concurrence et isolation');
  assert.equal(caps[caps.length - 2], 'Pour finir, voici les <b>trois idées à retenir</b>.');
});

test('le récapitulatif d’Elisa (26 octobre, 8 h 10), mot pour mot, dans la vidéo comme dans la fiche de la leçon : trois idées, chacune avec sa phrase puis sa précision', () => {
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div><div class="rtxt">(.*?)<\/div><\/div>/g)].map(m => {
    const [phrase, detail] = m[2].split('<span class="rs">');
    return [m[1], strip(phrase), strip(detail.replace(/<\/span>$/, ''))];
  });
  const RECAP = [['⚡', 'Un TRIGGER exécute une action automatiquement lorsqu’un événement se produit dans une table.', 'Ici, il permet de conserver une trace de chaque changement de prix.'],
    ['🔀', 'OLD et NEW donnent accès aux valeurs avant et après la modification.', 'OLD.prix correspond à l’ancien prix et NEW.prix au nouveau.'],
    ['🎯', 'WHEN précise la condition à remplir pour exécuter l’action.', 'Ici, une ligne est ajoutée à l’historique uniquement si l’ancien prix est différent du nouveau.']];
  assert.deepEqual(rows, RECAP, 'la vidéo : les trois idées');
  const fiche = html.slice(html.indexOf('guide({ id:70,'), html.indexOf('guide({ id:71,'));
  const idees = [...fiche.matchAll(/\["(⚡|🔀|🎯)","([^"]*)","([^"]*)"(?:,"([^"]*)")?\]/g)].map(m => [m[1], strip(m[2]), strip(m[3])]);
  assert.deepEqual(idees, RECAP, 'la fiche de la leçon dit la même chose que la vidéo');
  /* Les lignes se coupent entre les groupes de mots : jamais « lorsqu’un » ni « du nouveau. » seul en fin de ligne. */
  assert.ok(page.includes('Un <code>TRIGGER</code> exécute une action<br><b>automatiquement</b> lorsqu’un <b>événement</b><br>se produit dans une table.'));
  assert.ok(page.includes('Ici, une ligne est ajoutée à l’historique<br>uniquement si l’ancien prix<br>est différent du nouveau.'));
});

test('ce que la vidéo ne reprend pas de l’ancien cours : plus de Magnésium, de journal des clients supprimés ni de RAISE ; le chapitre ne parle pas de SQL comme d’une personne', () => {
  const textes = JSON.stringify([val('CAPTIONS'), val('PICKS'), val('MAILS'), val('ITEMS'), val('WHY4')]);
  for (const mot of ['Magnésium', 'clients_supprimes', 'RAISE', 'BEFORE', 'journal']) assert.ok(!textes.includes(mot), `la vidéo ne parle pas de ${mot}`);
  assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page) && !/la base (réagit|ajoute|garde)/.test(page), 'ni SQL ni la base ne sont personnifiés');
  const fiche = html.slice(html.indexOf('guide({ id:70,'), html.indexOf('guide({ id:71,'));
  assert.ok(!fiche.includes('sit:{') && !fiche.includes('testeVariants'), 'plus de cours texte Les triggers dans la fiche');
  assert.ok(!/dans historique_prix\b/.test(page) && val('CAPTIONS').filter(c => /table historique_prix|table produits/.test(c[2])).every(c => /<b>table (historique_prix|produits)<\/b>/.test(c[2])),
    'toujours la <b>table historique_prix</b>, la <b>table produits</b>');
});

test('zones à toucher : les lignes des tables font 62 px ; les indices passent par la typographie française', () => {
  assert.ok(page.includes('const RH = 62;') && /\.r\{position:relative;height:(6[2-9]|[7-9]\d)px/.test(page), 'lignes de 62 px au moins');
  assert.ok(/return h && Object\.assign\(h, \{text: fr\(h\.text\)\}\);/.test(page));
  assert.equal([...page.matchAll(/return \{text: '([^']+)'/g)].length, 5, 'cinq indices écrits : un par moment à choix ou à toucher');
  assert.ok(page.includes("const CELLS = [['c0', 'Produit concerné : 2'], ['c1', 'Ancien prix : 39.90'], ['c2', 'Nouveau prix : 34.90'], ['c3', 'Date du changement']];"));
});
