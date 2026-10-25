import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/* Les exemples des cartes arrivent tels quels dans la console (« Essayer ») : une clause par ligne, comme les exemples de la console
   (SELECT * FROM t / LIMIT 50) et les vidéos du projet. Elisa, 25 octobre, 11 h 34, devant la console « Cours » ouverte depuis la carte DELETE :
   « Formatage aussi ici » (DELETE FROM commandes WHERE id = 15; tenait sur une seule ligne). */

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const cut = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, `extrait introuvable : ${from}`);
  return html.slice(a, b);
};

const a = html.indexOf('const CARTES'), b = html.indexOf('\n};', a);
assert.ok(a > 0 && b > a, 'les cartes sont localisées');
const ctx = vm.createContext({});
vm.runInContext(html.slice(a, b + 3) + ';this.C = CARTES;', ctx);
const CARTES = ctx.C;

/* Les mots qui ouvrent une clause : ils commencent leur ligne, sauf dans une parenthèse (OVER (ORDER BY …), sous-requête) ou une chaîne. */
const CLAUSES = ['WHERE', 'SET', 'VALUES', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT'];
function clausesSurLaLigne(sql) {
  const mal = [];
  let depth = 0, chaine = false;
  sql.split('\n').forEach(ligne => {
    if (/^\s*--/.test(ligne)) return;
    for (let i = 0; i < ligne.length; i++) {
      const c = ligne[i];
      if (c === "'") { chaine = !chaine; continue; }
      if (chaine) continue;
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (depth === 0 && (i === 0 || /[\s)]/.test(ligne[i - 1]))) {
        const mot = CLAUSES.find(k => ligne.startsWith(k, i) && /[\s(]|$/.test(ligne[i + k.length] || ' '));
        if (mot && ligne.slice(0, i).trim()) mal.push(`${mot} après « ${ligne.slice(0, i).trim()} »`);
      }
    }
  });
  return mal;
}

test('le contrôle repère une clause laissée sur la ligne de la précédente (et laisse les parenthèses et les chaînes)', () => {
  assert.deepEqual(clausesSurLaLigne('DELETE FROM commandes WHERE id = 15;'), ['WHERE après « DELETE FROM commandes »']);
  assert.deepEqual(clausesSurLaLigne("UPDATE clients SET email = '…' WHERE id = 6;"), ['SET après « UPDATE clients »', 'WHERE après « UPDATE clients SET email = \'…\' »']);
  assert.deepEqual(clausesSurLaLigne('SELECT ville, COUNT(*) FROM clients GROUP BY ville;'), ['GROUP BY après « SELECT ville, COUNT(*) FROM clients »']);
  assert.deepEqual(clausesSurLaLigne('DELETE FROM commandes\nWHERE id = 15;'), []);
  assert.deepEqual(clausesSurLaLigne('SUM(montant) OVER (ORDER BY date_commande)'), [], 'dans une parenthèse : permis');
  assert.deepEqual(clausesSurLaLigne("SELECT 'a WHERE b'\nFROM t;"), [], 'dans une chaîne : permis');
});

test('cartes : chaque exemple qui arrive dans la console met WHERE, SET, VALUES, GROUP BY, HAVING, ORDER BY et LIMIT sur leur propre ligne', () => {
  const mal = [];
  for (const [id, c] of Object.entries(CARTES))
    for (const champ of ['s', 'run'])
      if (c[champ]) for (const m of clausesSurLaLigne(c[champ])) mal.push(`carte ${id} (${c.k}), ${champ} : ${m}`);
  assert.deepEqual(mal, [], 'une clause par ligne, comme dans les vidéos et dans les exemples de la console');
});

test('cartes DELETE, UPDATE et GROUP BY : la requête tient sur une ligne par clause, dans la carte comme dans la console', () => {
  assert.equal(CARTES[28].s, 'DELETE FROM commandes\nWHERE id = 15;');
  assert.equal(CARTES[27].s, "UPDATE clients\nSET email = '…'\nWHERE id = 6;");
  assert.equal(CARTES[16].s, 'SELECT ville, COUNT(*)\nFROM clients\nGROUP BY ville;');
  assert.equal(CARTES[26].s, "INSERT INTO clients (prenom, ville)\nVALUES ('Théo', 'Lille');", 'INSERT l’était déjà : les quatre requêtes d’écriture et de regroupement suivent la même forme');
  /* « Essayer » envoie à la console l’exemple tel qu’il est écrit (ou sa version « run »), sans le remettre sur une ligne. */
  const run = vm.createContext({});
  vm.runInContext(cut('function cardRunnableSql(c){', 'function cardSyntaxHtml(c){') + ';this.f = cardRunnableSql;', run);
  assert.equal(run.f(CARTES[28]), 'DELETE FROM commandes\nWHERE id = 15;');
  const essayer = cut('function cardToConsole(id){', '\n}\n');
  assert.ok(essayer.includes('fillConsoleSql(cardRunnableSql(CARTES[id]));'), '« Essayer » : l’exemple de la carte, tel quel');
  assert.ok(cut('function fillConsoleSql(sql){', 'function clearConsoleEditor(){').includes("ta.value=sql||'';"), 'la console garde les retours à la ligne');
});
