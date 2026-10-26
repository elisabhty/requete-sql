/* Projet NutriBoost, chapitre 17 (leçon 50 « Sécurité et droits ») : la vidéo interactive assets/anim/projet-droits.html, testée aussi dans
   lesson-video.test.mjs. La trame est celle d’Elisa (26 octobre, 11 h 57, « Sécurité et droits — Un accès trop large »), le dernier chapitre
   du projet, avec sa photo de Lina : Lina rejoint l’équipe pour un mois ; la vue commandes_expedition présente les quatre colonnes utiles à la
   préparation des colis ; GRANT SELECT lui ouvre la vue, GRANT UPDATE (statut) la seule colonne statut de la table commandes ; sa tentative de
   modifier un prix est refusée ; un mois plus tard, REVOKE retire les deux droits. SQLite n’a pas de comptes : ces commandes sont simulées,
   comme sur un serveur PostgreSQL, et la vidéo le dit. Les données montrées sont rejouées ici dans SQLite, sur la base du projet.
   Leçon seule : ni cours texte, ni exercice ; elle remplace l’ancien cours texte Sécurité et droits, le dernier de l’app (gardé en exemple
   pour les tests : tests/fixtures/guide-texte-droits.js). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-droits.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l50 = lessons.find(l => l.id === 50);

/* Les données de la page (le déroulé des légendes, les messages, les six moments), évaluées telles quelles. */
const a = page.indexOf('const SCH = '), b = page.indexOf('/* ---------- Gabarits');
assert.ok(a > 0 && b > a, 'données de la page localisées');
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(a, b), D);
const val = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, D));
const strip = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/* Les commandes que la page tape, telles qu’elle les écrit (gabarits Q_…) : sans le commentaire ni le balisage {repère|texte}. */
const Q = vm.createContext({});
vm.runInContext([...page.matchAll(/^const Q_[A-Z0-9]+ = [\s\S]*?\]\];$/gm)].map(m => m[0]).join('\n') + ';this.Q = {Q_GSEL, Q_GUPD, Q_LINA, Q_REV};', Q);
const sql = q => Q.Q[q].map(([s]) => s).filter(s => !s.trim().startsWith('--')).join('\n').replace(/\{\w+\|([^{}]*)\}/g, '$1');

/* ---------- La base du projet, telle que le chapitre 16 la laisse ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
/* Les tables des chapitres 1 à 15 (comme dans tests/index-lesson.test.mjs), puis les commandes du jour du chapitre 16 (NB-10001 à NB-10490 :
   NB-10482 est celle de Léa Simon, la cliente 7 ; NB-10483 celle de Nathan Petit, le client 4). Les 499 510 anciennes commandes de 2019
   à 2025, sans rôle ici, ne sont pas recréées : leur nombre est vérifié contre celui du chapitre 16. Puis la vue commandes_expedition. */
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
    INSERT INTO inscriptions (client_id, atelier_id, date_inscription) VALUES (7, 6, '2026-10-25'); UPDATE ateliers SET places_restantes = places_restantes - 1 WHERE id = 6;
    ALTER TABLE produits ADD COLUMN selection_box INTEGER NOT NULL DEFAULT 0; UPDATE produits SET selection_box = 1 WHERE id IN (3, 5, 8);
    CREATE VIEW catalogue_box AS SELECT nom, categorie, prix FROM produits WHERE selection_box = 1;`);
  const st = db.prepare('INSERT INTO commandes (numero_commande, client_id, produit_id, quantite, date_commande, statut) VALUES (?, ?, ?, ?, ?, ?)');
  for (let k = 10001; k <= 10490; k++) st.run([`NB-${k}`, k === 10482 ? 7 : k === 10483 ? 4 : 1 + k % 8, k === 10482 ? 6 : 1 + k % 8, 1, '2026-10-26', 'en_preparation']);
  st.free();
  db.run(`CREATE INDEX idx_commandes_numero ON commandes(numero_commande);
    CREATE VIEW commandes_expedition AS
      SELECT commandes.numero_commande, clients.prenom || ' ' || clients.nom AS destinataire, clients.adresse || ', ' || clients.ville AS adresse_livraison, commandes.statut
      FROM commandes JOIN clients ON clients.id = commandes.client_id
      WHERE commandes.date_commande = '2026-10-26';`);
  return db;
}
const DB = base();
const count = (db, t) => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];

test('Sécurité et droits : le dernier cours de l’app, seul dans son module, juste après Les index et EXPLAIN', () => {
  const m = modules.find(x => x.titre === 'Sécurité et droits');
  assert.deepEqual([...m.lessons.map(l => l.id)], [50]);
  assert.equal(modules[modules.length - 1], m, 'le dernier module');
  const liste = lessons.map(l => l.id);
  assert.equal(liste.indexOf(50), liste.indexOf(57) + 1, 'juste après Les index et EXPLAIN');
  assert.equal(liste[liste.length - 1], 50, 'le dernier cours');
  assert.equal(l50.titre, 'Sécurité et droits');
  assert.equal(l50.résumé, 'Contrôler les accès avec GRANT et REVOKE');
  assert.equal(lessons.filter(l => !l.video).length, 0, 'plus aucun cours texte dans l’app : tous les cours sont en vidéo');
});

test('recherche, quiz, et leçon seule sans texte de secours ni exercice', () => {
  const mots = html.match(/\n  50:'([^']+)',?\n/)[1];
  assert.ok(['grant', 'revoke', 'droits', 'acces', 'compte', 'select', 'update', 'statut', 'colonne', 'vue', 'commandes_expedition', 'lina', 'simulation', 'postgresql'].every(m => mots.includes(m)),
    'trouvé par la recherche : GRANT, REVOKE, les droits, la vue, la colonne statut, Lina, la simulation…');
  assert.ok(l50.leconSeule && l50.video && !l50.situation && !l50.consigne && !l50.solution && !l50.petitDefi && !l50.learningCheck && !l50.testeVariants && !l50.anatomie && !l50.noExec,
    'la vidéo est le cours');
  assert.equal(l50.video.moments, 6); assert.equal(l50.video.seuil, 4);
  assert.equal(l50.video.anim, 'assets/anim/projet-droits.html?app&embed');
  const recap = l50.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['🔐', '✅', '🚪'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
  const quiz = vm.runInContext('QCM', ctx)[50];
  assert.equal(quiz.length, 3);
  assert.deepEqual([...quiz.map(q => q.b)], [1, 0, 2], 'la bonne réponse change de place d’une question à l’autre');
  assert.ok(quiz.every(q => q.o.length === 3 && q.e), 'trois réponses et une explication par question');
  assert.ok(/GRANT SELECT ON commandes_expedition TO lina/.test(quiz[0].o[1]) && /uniquement la colonne/.test(quiz[1].o[0]) && /REVOKE/.test(quiz[2].o[2]),
    'les bonnes réponses : GRANT SELECT sur la vue, la seule colonne statut, REVOKE à la fin de la mission');
  assert.ok(!/app_user|stagiaire|reporting/.test(JSON.stringify(quiz)), 'plus rien de l’ancien cours texte');
  const carte = html.match(/\n 50:\{k:"GRANT \/ REVOKE",t:"([^"]+)",s:"([^"]+)"/);
  assert.ok(carte && carte[1] === 'Accorder uniquement les accès nécessaires' && carte[2].includes('GRANT UPDATE (statut) ON commandes TO lina;'), 'la carte mémo suit le chapitre');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  assert.equal(val('NOTES'), 256.8);
  assert.ok(page.includes('notesAt: 256.8,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 264);
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999, `légende ${k + 1} : après la précédente`);
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  assert.deepEqual(chaps.map(c => c.label), ['Un accès trop large', 'Les accès nécessaires', 'Ce qu’elle peut consulter', 'Autoriser la consultation', 'Une modification précise',
    'Les limites de son accès', 'Retirer les accès', 'Le dernier réflexe', 'À retenir']);
  caps.forEach(([, , t, lines], k) => {
    const txt = strip(t);
    assert.ok(/^[A-ZÀ-ÖØ-Þ0-9«]/.test(txt) || /^(<b[^>]*>)?<code>/.test(t), `légende ${k + 1} : une phrase qui commence (« ${txt.slice(0, 50)} »)`);
    assert.ok(/[.!?»]$/.test(txt), `légende ${k + 1} : une phrase qui finit (« …${txt.slice(-50)} »)`);
    assert.ok(!/[.!?»] ?[A-ZÀ-ÖØ-Þ«]/.test(txt), `légende ${k + 1} : une seule phrase par bulle (« ${txt.slice(0, 70)} »)`);
    assert.equal(lines, undefined, `légende ${k + 1} : trois lignes au plus`);
    assert.ok(t.split('<br>').length <= 3, `légende ${k + 1} : trois lignes au plus`);
  });
  assert.deepEqual(picks.map(p => p.kind), ['tap', 'pick', 'tap', 'pick', 'pick', 'pick']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    assert.equal(p.options.length, 3, `${p.prompt} : trois réponses`);
    for (const o of p.options) assert.ok(o.why && strip(o.why).length > 30, `${o.label} : une explication`);
  }
  assert.deepEqual(picks[1].options.map(o => !!o.ok), [false, true, false], 'consulter ne donne pas le droit de supprimer');
  assert.deepEqual(picks[3].options.map(o => !!o.ok), [false, false, true], 'masquer un bouton ne suffit pas');
  assert.deepEqual(picks[4].options.map(o => !!o.ok), [true, false, false], 'REVOKE … FROM lina');
  assert.deepEqual(picks[5].options.map(o => !!o.ok), [false, true, false], 'identifier ses besoins');
  assert.deepEqual([picks[0].need, picks[2].need], [2, 1], 'deux accès à toucher, puis une partie de la commande');
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
});

test('les phrases d’Elisa (26 octobre, 11 h 57) : sa trame, une phrase par bulle, avec ses mots', () => {
  const lus = val('CAPTIONS').map(c => strip(c[2]));
  const suite = (...phrases) => { const i = lus.indexOf(phrases[0]); assert.ok(i >= 0, `légende : ${phrases[0]}`);
    phrases.forEach((p, k) => assert.equal(lus[i + k], p, 'ses phrases, à la suite')); };
  suite('Les droits déterminent ce qu’un utilisateur peut faire dans la base.', 'Le principe est simple : donner uniquement les accès nécessaires à sa mission.');
  suite('Lina a besoin du destinataire et de l’adresse pour préparer les colis.', 'Cette vue rassemble les informations utiles à son travail.',
    'Son compte est déjà créé et ne dispose, pour le moment, d’aucun accès aux tables.');
  assert.ok(lus.includes('Ta mission : autoriser Lina à consulter la vue.') && lus.includes('Ta mission : autoriser uniquement la modification de la colonne statut.'), 'ses deux missions');
  suite('GRANT accorde un droit.', 'Ici, SELECT autorise Lina à consulter la vue commandes_expedition.');
  suite('Chaque droit correspond à une action.', 'Autoriser la consultation ne donne pas automatiquement le droit de modifier ou de supprimer.');
  assert.ok(lus.includes('Tu peux limiter un droit à une colonne.') && lus.includes('Lina peut maintenant modifier le statut des commandes, sans pouvoir changer leur quantité ou leur client.'));
  suite('La base vérifie les droits avant d’exécuter l’action.', 'Comme Lina n’a pas le droit de modifier les produits, le prix reste inchangé.');
  suite('Masquer un bouton ne protège pas la base.', 'Les droits doivent aussi empêcher l’action si une requête est envoyée autrement.');
  suite('REVOKE retire un droit accordé.', 'Ici, tu retires les deux autorisations données à Lina au début de sa mission.');
  suite('Chaque personne doit utiliser son propre compte, avec des droits adaptés à son travail.', 'Les accès doivent être revus lorsque sa mission change ou se termine.');
  /* Ses questions, mot pour mot ; ses réponses dans la correction de la bonne réponse */
  const picks = val('PICKS');
  assert.deepEqual([0, 1, 3, 5].map(i => picks[i].prompt), ['Lina prépare les colis. De quels accès a-t-elle besoin ?', 'Ce droit lui permet-il aussi de supprimer une commande ?',
    'Suffirait-il de masquer le bouton « Modifier le prix » dans l’application ?', 'Une nouvelle personne rejoint l’équipe. Que fais-tu ?']);
  assert.equal(strip(picks[1].options[1].why), 'Chaque droit correspond à une action. Autoriser la consultation ne donne pas automatiquement le droit de modifier ou de supprimer.');
  assert.equal(strip(picks[3].options[2].why), 'Masquer un bouton ne protège pas la base. Les droits doivent aussi empêcher l’action si une requête est envoyée autrement.');
  assert.equal(strip(picks[5].options[1].why), 'Chaque personne doit utiliser son propre compte, avec des droits adaptés à son travail. Les accès doivent être revus lorsque sa mission change ou se termine.');
  assert.deepEqual(picks[5].options.map(o => o.label), ['Lui donner tous les droits pour éviter les blocages', 'Identifier ses besoins et lui accorder les droits correspondants', 'Lui prêter le compte d’un collègue']);
  /* Ses quatre accès possibles, et les deux dont Lina a besoin */
  assert.deepEqual(val('ACCES').map(x => [x[2], x[3]]), [['Consulter les commandes', true], ['Mettre à jour leur statut', true], ['Modifier les prix', false], ['Supprimer des clients', false]]);
  assert.ok(page.includes('Un accès trop large&nbsp;:<br>à toi de donner<br>les bons accès !'), 'la bulle de la mascotte');
  assert.ok(page.includes('Elisa (26 octobre, 11 h 57'), 'la page garde la trace de la trame d’Elisa et de sa photo');
});

test('les messages : Camille Roux, puis Lina, puis Camille Roux, par SMS, avec les mots d’Elisa ; l’app s’arrête sur eux, et sur « Simuler »', () => {
  const mails = val('MAILS'), opens = val('OPENS'), picks = val('PICKS'), caps = val('CAPTIONS');
  assert.equal(mails.length, 3);
  assert.deepEqual(mails.map(m => [m[0], m[2], m[6]]), [[['Camille', 'Roux', 'CR'], 'équipe', {sms: true, hello: 'Bonjour !', bye: null}],
    [['Lina', '', 'L'], 'équipe', {sms: true, hello: null, bye: null}], [['Camille', 'Roux', 'CR'], 'équipe', {sms: true, hello: null, bye: null}]]);
  assert.deepEqual(mails[0][4], ['Lina rejoint l’équipe pour nous aider à préparer les commandes pendant un mois.',
    'Elle doit consulter les informations nécessaires aux expéditions et mettre à jour le statut des commandes.',
    'En revanche, elle ne doit pas pouvoir modifier les prix ni supprimer des clients.', 'Peux-tu lui donner les accès adaptés à sa mission ?']);
  /* « Le colis de Léa » : un client est toujours cité par son prénom et son nom (Elisa, 22 octobre) */
  assert.deepEqual(mails[1][4], ['Je peux consulter les expéditions !', 'Le colis de Léa Simon est prêt.', 'Il me manque l’accès pour passer son statut à « expédiée ».']);
  assert.deepEqual(mails[2][4], ['La mission de Lina est terminée.', 'Peux-tu retirer les accès que nous lui avions accordés ?']);
  assert.deepEqual([0, 1, 2].map(n => vm.runInContext(`mailRows(${n})`, D)), [5, 3, 2], '« Bonjour ! » et ses quatre phrases ; puis trois, puis deux phrases');
  assert.ok(strip(caps.find(c => /t’écrit/.test(c[2]))[2]) === 'Camille Roux, responsable des opérations, t’écrit.', 'qui est Camille Roux (Elisa : « responsable des opérations »)');
  assert.deepEqual(opens.map(o => o.sel), ['#ml1', '#bs1', '#ml2', '#bs2', '#ml3', '#bs3']);
  assert.deepEqual(opens.map(o => o.label), ['Ouvrir le message de Camille Roux', 'Simuler', 'Ouvrir le message de Lina', 'Simuler', 'Ouvrir le message de Camille Roux', 'Simuler']);
  assert.ok(opens.every((o, k) => !k || o.at > opens[k - 1].at), 'dans l’ordre');
  assert.ok(opens[0].at < picks[0].at && opens[1].at > picks[0].at && opens[1].at < picks[1].at && opens[2].at > picks[1].at && opens[3].at > picks[2].at && opens[3].at < picks[3].at
    && opens[4].at > picks[3].at && opens[4].at < picks[4].at && opens[5].at > picks[4].at && opens[5].at < picks[5].at,
    'le message de Camille Roux avant le moment 1 ; GRANT SELECT avant le moment 2 ; le message de Lina, GRANT UPDATE après le moment 3 ; le second message, le moment 5, puis REVOKE');
  const bulles = [['#bs1', 'Clique sur le bouton<br>« Simuler ».'], ['#bs2', 'Clique de nouveau<br>sur « Simuler ».'], ['#bs3', 'Simule les deux commandes :<br>clique sur « Simuler ».']];
  [opens[1], opens[3], opens[5]].forEach((o, k) => {
    const [sel, bulle] = bulles[k];
    assert.equal(o.sel, sel);
    assert.deepEqual(o.hand, {x: 0.86, y: 0.78});
    assert.deepEqual([o.press, o.rest], [{y: 7, boxShadow: '0 2px 0 #4B30CC'}, {y: 0, boxShadow: '0 9px 0 #4B30CC'}]);
    const c = caps.find(x => x[2] === bulle);
    assert.ok(c && o.at > c[0] + 1 && o.at < c[1] - 1, `${sel} : le bouton est visible pendant sa légende, puis l’app s’arrête`);
  });
  assert.ok(!/fromTo\('#bs\d|fromTo\(b\b/.test(page), 'aucun « fromTo » sur un bouton ni sur son anneau');
  assert.ok(page.includes('(MAILS[n][6] || {}).hello, (MAILS[n][6] || {}).photo, (MAILS[n][6] || {}).bye)'), 'la page passe au moteur la formule et la fin du SMS');
});

test('une simulation clairement présentée : SQLite n’a pas de comptes, le bouton « Simuler » affiche la réponse d’un serveur PostgreSQL', () => {
  const lus = val('CAPTIONS').map(c => strip(c[2]));
  const i = lus.indexOf('SQLite, le moteur de l’application, n’a pas de comptes.');
  assert.ok(i > 0 && lus[i + 1] === 'Le bouton « Simuler » affiche donc la réponse d’un serveur PostgreSQL.' && lus[i + 2] === 'Clique sur le bouton « Simuler ».', 'annoncé avant le premier « Simuler »');
  assert.ok(val('CAPTIONS').findIndex(c => /Simuler/.test(c[2])) === i + 1, 'avant tout bouton « Simuler »');
  /* Chaque commande de droits porte l’étiquette « simulation » ; chaque réponse se dit simulée ; le bouton s’appelle « Simuler », comme dans les cours de l’app */
  for (const e of ["ed('eg', Q_GSEL, 'droits.sql', SIM)", "ed('eu', Q_GUPD, 'droits.sql', SIM)", "ed('er', Q_REV, 'droits.sql', SIM)", "const SIM = '🧪 simulation';"])
    assert.ok(page.includes(e), `étiquette : ${e}`);
  assert.ok(!page.includes("ed('el', Q_LINA, 'application de Lina', SIM)"), 'la requête de l’application de Lina n’est pas une commande de droits');
  assert.equal((page.match(/Réponse simulée · serveur PostgreSQL/g) || []).length, 2, 'les réponses : le gabarit, et la modification refusée');
  assert.ok(page.includes("reponse('rs1', ['GRANT'], '✓ droit accordé')") && page.includes("reponse('rs4', ['REVOKE', 'REVOKE'], '✓ droit retiré')"), 'GRANT, puis REVOKE deux fois');
  assert.equal((page.match(/button\('bs\d', '', PLAY, 'Simuler'\)/g) || []).length, 3, 'trois boutons « Simuler »');
  assert.ok(html.includes("${simulated?'Simuler':'Exécuter'}"), 'le même mot que le bouton des cours de l’app');
  /* La modification refusée : le message d’Elisa, puis l’erreur d’un serveur PostgreSQL */
  assert.ok(page.includes('<div class="rsm">🔒 Modification refusée : droit insuffisant.</div><div class="rse">ERROR: permission denied for table produits</div>'));
});

test('les commandes de la trame : GRANT SELECT sur la vue, GRANT UPDATE (statut), la requête de Lina, les deux REVOKE', () => {
  assert.equal(sql('Q_GSEL'), 'GRANT SELECT\nON commandes_expedition\nTO lina;');
  assert.equal(sql('Q_GUPD'), 'GRANT UPDATE (statut)\nON commandes\nTO lina;');
  assert.equal(sql('Q_LINA'), 'UPDATE produits\nSET prix = 1\nWHERE id = 2;');
  assert.equal(sql('Q_REV'), 'REVOKE SELECT ON commandes_expedition FROM lina;\nREVOKE UPDATE (statut) ON commandes FROM lina;');
  /* La syntaxe des privilèges (PostgreSQL, MySQL) : GRANT droit [(colonnes)] ON objet TO compte ; REVOKE droit [(colonnes)] ON objet FROM compte */
  const grant = /^GRANT (SELECT|UPDATE)(?: \((\w+)\))? ON (\w+) TO (\w+);$/, revoke = /^REVOKE (SELECT|UPDATE)(?: \((\w+)\))? ON (\w+) FROM (\w+);$/;
  const g = [sql('Q_GSEL'), sql('Q_GUPD')].map(s => s.replace(/\n/g, ' ').match(grant)), r = sql('Q_REV').split('\n').map(s => s.match(revoke));
  assert.ok(g.every(Boolean) && r.every(Boolean), 'GRANT … TO, REVOKE … FROM');
  assert.deepEqual(r.map(m => m.slice(1)), g.map(m => m.slice(1)), 'chaque REVOKE retire exactement un droit accordé');
  /* La partie qui limite le droit à une colonne (moment 3), dans l’ordre de la commande */
  assert.deepEqual(val('PARTS').map(p => p[1]).join(' '), 'GRANT UPDATE (statut) ON commandes TO lina');
  assert.deepEqual(Object.keys(val('WHY3')).sort(), ['q0', 'q2', 'q3']);
  assert.ok(/if \(i === 2\) return \{text: '[^']+', keys: \['q1'\]\};/.test(page), 'indice du moment 3 : (statut) ressort');
  assert.ok(page.includes("const M3_ANS = ['#hcq'];") && page.includes("${k === 'q1' ? '<i class=\"hc\" id=\"hcq\"></i>' : ''}"), '(statut) s’entoure');
});

test('la base, rejouée dans SQLite : la vue commandes_expedition, les commandes de Léa Simon et de Nathan Petit, le prix du Collagène Marin', () => {
  /* Les douze tables de la base, comme au chapitre 16 */
  const TB = val('TB');
  const tables = DB.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(r => r[0]);
  assert.deepEqual(TB.map(t => t[3]).sort(), tables, 'aucune table de la base n’est oubliée à l’écran (les vues et l’index n’en sont pas)');
  for (const [, , , name, n] of TB) if (name !== 'commandes') assert.equal(count(DB, name), n, `${name} : ${n} lignes`);
  const ix = fs.readFileSync(path.join(root, 'assets/anim/projet-index.html'), 'utf8');
  const TB16 = vm.runInContext(ix.slice(ix.indexOf('const TB = ['), ix.indexOf('];', ix.indexOf('const TB = [')) + 2) + ';TB', vm.createContext({}));
  assert.equal(JSON.stringify(TB), JSON.stringify(TB16), 'la base telle que le chapitre 16 la laisse : 500 000 commandes');
  /* La vue : ses quatre colonnes, et les deux commandes que Lina prépare (celles du chapitre 16) */
  const v = DB.exec("SELECT * FROM commandes_expedition WHERE numero_commande IN ('NB-10482', 'NB-10483') ORDER BY numero_commande")[0];
  assert.deepEqual(v.columns, val('VCOLS'));
  assert.deepEqual(v.values, val('VUE'), 'NB-10482 · Léa Simon · 41 avenue Jaurès, Paris ; NB-10483 · Nathan Petit · 5 rue Victor Hugo, Paris');
  assert.ok(count(DB, 'commandes_expedition') > 2 && page.includes('⋮ les autres commandes à préparer'), 'et les autres commandes du jour');
  /* La colonne statut se modifie : la commande de Léa Simon passe à « expédiée », une valeur de la base */
  DB.run("UPDATE commandes SET statut = 'expédiée' WHERE numero_commande = 'NB-10482'");
  assert.deepEqual(DB.exec("SELECT statut FROM commandes_expedition WHERE numero_commande = 'NB-10482'")[0].values, [['expédiée']]);
  assert.ok(DB.exec("SELECT COUNT(*) FROM commandes WHERE statut = 'expédiée'")[0].values[0][0] > 1, '« expédiée », comme les autres commandes expédiées');
  /* Les sept colonnes de la table commandes ; UPDATE (statut) n’en ouvre qu’une */
  assert.deepEqual(DB.exec("SELECT name FROM pragma_table_info('commandes')")[0].values.map(r => r[0]), val('CMCOLS'));
  /* La requête de Lina vise le Collagène Marin, à 34,90 € depuis le chapitre 13 ; refusée, le prix reste inchangé */
  assert.deepEqual(DB.exec('SELECT id, nom, prix FROM produits WHERE id = 2')[0].values, [[2, 'Collagène Marin', 34.9]]);
  assert.deepEqual(val('PROD'), {id: 2, nom: 'Collagène Marin', prix: '34,90 €'});
  assert.deepEqual(DB.exec('SELECT prix FROM produits WHERE id = 3')[0].values, [[19.9]], 'le Magnésium, sur l’écran de gestion : 19,90 €');
  assert.ok(page.includes("gsr('<b>Magnésium</b><span class=\"pz\">19,90 €</span>')"));
});

test('chapitre 17 : écran titre, ouverture comme aux autres chapitres, la photo d’Elisa, puis la fin du projet', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 17 : Sécurité et droits</title>') && page.includes('<div class="tagpill">Projet · Chapitre 17</div>')
    && page.includes('<span>G</span><span>R</span><span>A</span><span>N</span><span class="sp">T</span><span>R</span><span>E</span><span>V</span><span>O</span><span>K</span><span>E</span>')
    && page.includes('<div class="abs sub">Contrôler les accès avec GRANT et REVOKE</div>'), 'écran titre : « Projet · Chapitre 17 », GRANT REVOKE, le résumé de la leçon');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.');
  assert.equal(caps[1], 'Au chapitre 16, un index a accéléré<br>la recherche des commandes.', 'le chapitre précédent');
  const ix = fs.readFileSync(path.join(root, 'assets/anim/projet-index.html'), 'utf8');
  assert.ok(ix.includes('Dans la prochaine leçon,<br>une nouvelle collègue aura besoin<br>des bons accès.') && ix.includes('Prochaine leçon · Sécurité et droits</span>'), 'le chapitre 16 annonce celui-ci');
  /* Le compte trop large, au conditionnel : son compte ne dispose encore d’aucun accès aux tables (la précision d’Elisa, plus loin) */
  assert.ok(caps.includes('Mais avec un compte trop large,<br>elle pourrait aussi, sans faire exprès,<br>modifier les prix et supprimer des clients.'));
  /* Le dernier chapitre : pas de prochaine leçon, la fin du projet */
  assert.ok(!page.includes('Prochaine leçon') && !caps.some(c => /prochaine leçon/i.test(c)), 'aucune leçon après celle-ci');
  assert.ok(caps.includes('Bravo : tu as terminé<br>le dernier chapitre<br>du projet NutriBoost !') && page.includes('Projet NutriBoost terminé !'), 'la fin du projet');
  assert.equal(caps[caps.length - 2], 'Pour finir, voici les <b>trois idées à retenir</b>.');
  assert.ok(page.includes("const PHOTO = 'projet-droits-lina.webp';") && fs.statSync(path.join(root, 'assets/anim/projet-droits-lina.webp')).size > 20000, 'la photo de Lina');
  assert.ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes("'./assets/anim/projet-droits-lina.webp'"), 'et gardée pour le hors ligne');
  assert.ok(page.includes('url(projet-droits-lina.webp)'), 'son portrait sur la fiche de son compte');
});

test('le récapitulatif, dans la vidéo comme dans la fiche de la leçon : trois idées, chacune avec sa phrase puis sa précision (les mots d’Elisa)', () => {
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div><div class="rtxt">(.*?)<\/div><\/div>/g)].map(m => {
    const [phrase, detail] = m[2].split('<span class="rs">');
    return [m[1], strip(phrase), strip(detail.replace(/<\/span>$/, ''))];
  });
  const RECAP = [['🔐', 'Accorde uniquement les accès nécessaires.', 'Un compte doit pouvoir effectuer les actions utiles à sa mission.'],
    ['✅', 'GRANT permet d’accorder un droit.', 'Tu peux autoriser la consultation ou limiter une modification à certaines colonnes.'],
    ['🚪', 'REVOKE permet de retirer un droit.', 'Pense à revoir les accès lorsqu’une mission change ou se termine.']];
  assert.deepEqual(rows, RECAP, 'la vidéo : les trois idées');
  const fiche = html.slice(html.indexOf('guide({ id:50,'), html.indexOf('\n]}\n]', html.indexOf('guide({ id:50,')));
  const idees = [...fiche.matchAll(/\["(🔐|✅|🚪)","([^"]*)","([^"]*)"\]/g)].map(m => [m[1], strip(m[2]), strip(m[3])]);
  assert.deepEqual(idees, RECAP, 'la fiche de la leçon dit la même chose que la vidéo');
});

test('ce que la vidéo ne reprend pas de l’ancien cours ; le chapitre ne parle pas de SQL comme d’une personne', () => {
  const textes = JSON.stringify([val('CAPTIONS'), val('PICKS'), val('MAILS'), val('WHY1'), val('WHY3')]);
  for (const mot of ['app_user', 'reporting', 'stagiaire', 'ALL PRIVILEGES', 'Le serveur répond']) assert.ok(!textes.includes(mot), `la vidéo ne parle pas de ${mot}`);
  assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page) && !/(la base|le serveur) (lit|réagit|ajoute|garde|répond|refuse)\b/.test(page), 'ni SQL, ni la base, ni le serveur ne sont personnifiés');
  const fiche = html.slice(html.indexOf('guide({ id:50,'), html.indexOf('\n]}\n]', html.indexOf('guide({ id:50,')));
  assert.ok(!fiche.includes('sit:{') && !fiche.includes('testeVariants') && !fiche.includes('noExec'), 'plus de cours texte Sécurité et droits dans la fiche');
  assert.ok(!/dans commandes\b/.test(page) && val('CAPTIONS').filter(c => /table (commandes|produits|clients)/.test(c[2])).every(c => /<b>table (commandes|produits|clients)<\/b>/.test(c[2])), 'toujours la <b>table …</b>');
  /* Le texte gardé pour les tests : l’ancien cours, à l’identifiant 950 */
  const ancien = vm.runInContext(fs.readFileSync(path.join(root, 'tests/fixtures/guide-texte-droits.js'), 'utf8'), ctx);
  assert.ok(ancien.id === 950 && ancien.titre === 'Sécurité et droits' && ancien.noExec && /app_user/.test(ancien.missionSql), 'l’ancien cours texte, gardé en exemple');
});

test('zones à toucher : les accès de la fiche font 100 px, les parties de la commande 86 px ; les indices passent par la typographie française', () => {
  assert.ok(/\.fcr\{[^}]*height:(1\d\d)px/.test(page) && +page.match(/\.fcr\{[^}]*height:(\d+)px/)[1] >= 96, 'les accès : 96 px au moins');
  assert.ok(/\.gpr\{[^}]*height:(8[4-9]|9\d)px/.test(page), 'les parties de la commande : 84 px au moins');
  assert.ok(/return h && Object\.assign\(h, \{text: fr\(h\.text\)\}\);/.test(page));
  assert.equal([...page.matchAll(/return \{text: '([^']+)'/g)].length, 6, 'six indices écrits : un par moment');
  assert.ok(/if \(i === 0\) return \{text: '[^']+', keys: \['a0', 'a1'\]\};/.test(page), 'indice du moment 1 : les deux accès nécessaires ressortent');
  assert.deepEqual(Object.keys(val('WHY1')).sort(), ['a2', 'a3']);
  assert.ok(page.includes("const M1_ANS = ['#nd0', '#nd1'];"), 'les deux accès nécessaires : « ✓ nécessaire »');
});
