/* Elisa, 4 novembre, 23 h 50 : « 4 bonnes requêtes encore refusées, des cas rares : DISTINCT ON, date - date à la PostgreSQL, et
   deux divisions entières. On supprime ou corrige ? » On corrige sans supprimer les défis ni accepter un faux résultat : ces
   écritures sont justes en PostgreSQL, mais SQLite, le moteur de l’appli, en tire un autre résultat (550 au lieu de 550,33 ; 0 jour ;
   une erreur de syntaxe). L’appli dit pourquoi, sur les vraies bases des défis. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

const ctx = vm.createContext({esc: s => String(s).replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[ch])});
vm.runInContext(cut('const CHALLENGES=[', 'const NIV=').replace('const CHALLENGES=', 'CHALLENGES=').replace('const DEFI_BASES=', 'DEFI_BASES='), ctx);
vm.runInContext(cut('function defiDiag(', 'function defisParProgression('), ctx);
vm.runInContext(cut('function errBox(msg,sql,o){', 'const RUN_ICO='), ctx);
const initSqlJs = createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'));
const SQL = await initSqlJs({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
const defi = id => vm.runInContext(`CHALLENGES.find(c=>c.id==='${id}')`, ctx);
const lancer = (c, sql) => { const db = new SQL.Database(); try { db.exec(vm.runInContext(`DEFI_BASES['${c.base}'].sql`, ctx)); return db.exec(sql); } finally { db.close(); } };
const diag = (id, sql) => { const c = defi(id); return ctx.defiDiag(lancer(c, sql), lancer(c, c.sol), c, sql); };

test('af21 et vm3 : une division entre deux entiers, l’appli le dit', () => {
  const af21 = diag('af21', 'SELECT classe, ROUND(SUM(prix) / COUNT(*), 2) AS prix_moyen FROM reservations GROUP BY classe ORDER BY prix_moyen DESC, classe');
  assert.ok(af21.includes('ta division se fait entre deux nombres entiers') && af21.includes('<code>AVG(…)</code>'), af21);
  const vm3 = diag('vm3', "SELECT c.prenom, c.nom, ROUND(COALESCE(SUM(p.montant), 0) / COUNT(DISTINCT r.id), 2) AS pm FROM clients c JOIN reservations r ON r.client_id = c.id LEFT JOIN paiements p ON p.reservation_id = r.id AND p.statut = 'Payé' GROUP BY c.id ORDER BY pm DESC, c.nom, c.prenom");
  assert.ok(vm3.includes('ta division se fait entre deux nombres entiers'), vm3);
  /* Avec * 1.0, la même requête est juste : plus rien à dire */
  const c = defi('af21');
  const juste = lancer(c, 'SELECT classe, ROUND(SUM(prix) * 1.0 / COUNT(*), 2) AS prix_moyen FROM reservations GROUP BY classe ORDER BY prix_moyen DESC, classe');
  assert.equal(JSON.stringify(juste[0].values), JSON.stringify(lancer(c, c.sol)[0].values));
  /* Une autre erreur de calcul, même avec une division : le message général, sans indice (9 novembre, 7 h 55) */
  assert.equal(diag('af21', 'SELECT classe, ROUND(SUM(prix) / 2.0, 2) AS prix_moyen FROM reservations GROUP BY classe ORDER BY prix_moyen DESC, classe'),
    'Le résultat ne correspond pas à la consigne.');
});

test('hm2 : soustraire deux dates ne donne pas des jours, l’appli le dit', () => {
  const d = diag('hm2', 'SELECT s.nom, ROUND(AVG(h.date_fin - h.date_debut), 1) AS d FROM services s JOIN hospitalisations h ON h.service_id = s.id WHERE h.date_fin IS NOT NULL GROUP BY s.id ORDER BY d DESC, s.nom');
  assert.ok(d.includes('soustraire deux dates ne donne pas un nombre de jours') && d.includes('<code>julianday(date_fin) - julianday(date_debut)</code>'), d);
  /* Avec julianday mais une autre erreur : pas ce message */
  assert.ok(!diag('hm2', 'SELECT s.nom, ROUND(AVG(julianday(h.date_fin) - julianday(h.date_debut)) + 1, 1) AS d FROM services s JOIN hospitalisations h ON h.service_id = s.id WHERE h.date_fin IS NOT NULL GROUP BY s.id ORDER BY d DESC, s.nom').includes('soustraire deux dates'));
});

test('ld8 : DISTINCT ON n’existe pas en SQLite, l’erreur le dit', () => {
  const c = defi('ld8'), sql = 'SELECT DISTINCT ON (e.id) e.nom, p.titre, p.date_debut FROM equipes e JOIN projets p ON p.equipe_id = e.id ORDER BY e.id, p.date_debut, p.id';
  let msg = '';
  try { lancer(c, sql); } catch (e) { msg = e.message; }
  assert.ok(/syntax error/.test(msg), msg);
  const box = ctx.errBox(msg, sql);
  assert.ok(box.includes('<code>DISTINCT ON</code> est propre à PostgreSQL') && box.includes('ROW_NUMBER() OVER (PARTITION BY … ORDER BY …)'), box);
  assert.ok(!ctx.errBox(msg, 'SELECT nom FROM equipes WHERE').includes('DISTINCT ON'), 'une autre erreur de syntaxe : l’aide habituelle');
  assert.ok(ctx.errBox(msg).includes('Requête mal formée'), 'sans la requête (anciens appels) : l’aide habituelle');
});

test('les trois appels passent la requête : défi seul, salle, console', () => {
  assert.ok(app.includes('const diag=isDefi?defiDiag(userRes,solRes,current,sql):exoFailDiag(sql,sol,userRes,solRes,ordered);'));
  assert.ok(app.includes("const diag=typeof defiDiag==='function'?defiDiag(userRes,solRes,c,sql):exoFailDiag("));
  /* 9 novembre, 8 h 04 (retours-0031) : dans un défi, l’encart de la carte dit l’erreur comme la boîte « Erreur SQL », son message et
     son aide (errAide, dont celle sur DISTINCT ON) ; la boîte elle-même reste pour un défi sans carte et pour la console. */
  assert.ok(app.includes("    else setLessonOut(errBox(e.message,sql));") && app.includes("}catch(e){typeof edPied==='function'&&edPied('ed-lesson','err');setLessonOut('');jeuEssaiRate(r);coachRoomTick();coachKo(typeof defiErreurSql==='function'?defiErreurSql(e.message,sql):esc(e.message));return;}") && app.includes('?consoleLockBox():errBox(e.message,sql,{console:1})}'));
  /* Les quatre défis restent là, avec leur solution */
  for (const id of ['af21', 'vm3', 'hm2', 'ld8']) assert.ok(defi(id) && defi(id).sol, id);
});
