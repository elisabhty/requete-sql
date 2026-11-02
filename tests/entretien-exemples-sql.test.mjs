#!/usr/bin/env node
/* Elisa, 3 novembre, 0 h 10 : « faire attention et vérifier les autres, parce que ce n’est pas du SQL dans la requête » (la sélectivité
   d’un index affichait une phrase dans « Exemple SQL »). Chaque exemple est une vraie requête : une instruction complète, le français
   seulement en commentaire (--) ou entre guillemets. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const a = html.indexOf('const ENTRETIEN=['), b = html.indexOf('\n];', a) + 3;
const ctx = {}; vm.runInNewContext(html.slice(a, b).replace('const ENTRETIEN', 'this.ENTRETIEN'), ctx);
let passed = 0, failed = 0;
const assert = (c, l) => { if (c) passed++; else { failed++; console.log(`  ✗ ${l}`); } };
const debut = /^(SELECT|WITH|CREATE|INSERT|UPDATE|DELETE|MERGE|BEGIN|START|COMMIT|ROLLBACK|SAVEPOINT|ALTER|DROP|TRUNCATE|EXPLAIN|GRANT|REVOKE|SET|CALL|EXEC|PRAGMA|ANALYZE|VACUUM|SHOW|LOCK|PREPARE|EXECUTE|COPY|DECLARE)\b/i;
const prose = /(\b(est|sont|une|des|plus|généralement|permet|puis|avant|après|sans|avec|pour|dans|ligne|lignes|valeur|si|alors|et)\b|[àéèêç’])/i;
console.log('\n=== Exemples SQL de l’entretien ===');
let n = 0;
ctx.ENTRETIEN.forEach(q => {
  if (!q.sql) return;
  n++;
  const lignes = q.sql.split('\n'), code = lignes.filter(l => l.trim() && !l.trim().startsWith('--'));
  assert(code.length && debut.test(code[0].trim()), `${q.id} : commence par une instruction SQL (${code[0] || 'rien'})`);
  code.forEach(l => {
    const sans = l.replace(/--.*$/, '').replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/\[[^\]]*\]/g, '[]');
    assert(!prose.test(sans), `${q.id} : pas de phrase hors commentaire (${l})`);
  });
});
console.log(`  ${n} exemples vérifiés`);
console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
