/* Elisa, 5 novembre, 0 h 30. Réf. 6 : « ne pas parler de SQLite dans les leçons ». Les fiches, les cartes mémo, les notes
   « SQL serveur », les messages d’erreur et les indices des défis disent « la base de l’app » ; la page Selon le SGBD, qui compare
   les moteurs, garde leurs noms. Les récapitulatifs des vidéos MERGE et Procédures disent la même chose que leur fiche.
   Réf. 4 : dans le duel du cours Procédures et fonctions, la demande reste à côté de son numéro. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const page = nom => fs.readFileSync(path.join(ROOT, 'assets/anim', nom), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

test('réf. 6 : les fiches des leçons, les cartes mémo et les indices des défis ne nomment plus SQLite', () => {
  for (const [a, b] of [['guide({ id:0,', 'const CHALLENGES=['], ['const CHALLENGES=[', 'const NIV='], ['const CARTES={', '\n};'],
    ['function errBox(msg,sql){', 'const RUN_ICO=']]) {
    assert.ok(!sansCommentaires(cut(a, b)).includes('SQLite'), a);
  }
  /* 6 novembre (cartes mémo, direction A) : les cartes réécrites disent « la base de l’app » dans leurs points et leurs pièges. */
  for (const t of ['Dans la base de l’app, <code>MERGE</code> <b>n’existe pas</b>.', 'Les deux reçoivent des paramètres. La base de l’app n’en a pas.',
    "Dans la base de l’app, <code>CAST('CMD-2026-1002481' AS INTEGER)</code> donne 0, sans erreur.",
    'Dans la base de l’app, le même résultat s’obtient avec <code>INSERT … ON CONFLICT DO UPDATE</code>.', 'Leur syntaxe dépend du SGBD\\u00a0: la base de l’app n’en a pas.',
    'vaut 1 si le plat peut être commandé et 0 sinon', 'Les dates AAAA-MM-JJ se comparent comme du texte\\u00a0:']) {
    /* 6 novembre : les pistes de wf1 et ff8, réécrites avec les 267 défis, ne nomment toujours pas SQLite. */
    assert.ok(app.includes(t), t);
  }
});

test('réf. 6 : les notes « SQL serveur », les messages d’erreur et les pièges des défis disent « l’app »', () => {
  for (const t of ['Notion SQL serveur — non exécutable dans l’app</p>', 'ces commandes ne s’exécutent pas dans l’app. Lis-les, ne les lance pas.',
    'La base de l’app ne gère pas <code>GRANT</code> / <code>REVOKE</code>.', 'Cette commande ne s’exécute pas dans l’app. Écris-la, puis touche <b>Vérifier</b>',
    'GRANT SELECT suffit pour consulter <code>clients</code>. Cette commande ne s’exécute pas dans l’app.',
    'Pour trouver son équivalent, voir la page <button type=\'button\' class=\'sgbd-link\' data-sgbd=\'\'>Selon le SGBD</button>.',
    'ta division se fait entre deux nombres entiers, alors le résultat ne garde que la partie entière.',
    '\'Ici, soustraire deux dates ne donne pas un nombre de jours', '<code>DISTINCT ON</code> est propre à PostgreSQL : la base de l’app ne le connaît pas.']) {
    assert.ok(app.includes(t), t);
  }
  for (const t of ['non exécutable en SQLite', 'pas dans SQLite', 'SQLite ne gère pas', 'équivalent dans SQLite', 'SQLite ne garde', 'En SQLite, soustraire',
    'SQLite ne le connaît pas', 'booléen SQLite', 'texte dans SQLite']) {
    assert.ok(!app.includes(t), t);
  }
});

test('réf. 6 : les récapitulatifs des vidéos MERGE et Procédures disent « la base de l’app »', () => {
  assert.ok(page('projet-merge.html').includes('<div class="rtxt">Dans la base de l’app,<br><code>MERGE</code> <b>n’existe pas</b>.'));
  assert.ok(page('projet-procedures.html').includes('<span class="rs">Les deux reçoivent des paramètres.<br>La base de l’app n’en a pas.</span>'));
});

test('réf. 4 : dans le duel, la demande reste à côté de son numéro et passe à la ligne en dessous', () => {
  const p = page('projet-procedures.html');
  assert.ok(p.includes('.dv{flex-wrap:wrap}') && p.includes('.dv>span:not(.ans){flex:1 1 0;min-width:0}'));
});
