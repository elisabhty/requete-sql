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
/* Les exemples réécrits tiennent dans le bloc SQL sur iPhone : 30 caractères par ligne au plus (3 novembre, 1 h 21). */
const reecrits = '02 03 04 22 47 49 50 51 53 61 63 64 65 66 67 69 70 71 72 74 75 84 85 92 93 94 95 98 99 100 101 106 108 111 117'.split(' ').map(x => 'ent-v2-' + x);
ctx.ENTRETIEN.filter(q => reecrits.includes(q.id)).forEach(q => q.sql.split('\n').forEach(l => assert(l.length <= 30, `${q.id} : ligne de ${l.length} caractères (${l})`)));
const q74 = ctx.ENTRETIEN.find(q => q.id === 'ent-v2-74');
assert(q74.niveau === 'Intermédiaire' && q74.ex && q74.ex.rows.length === 4 && /WHERE id > 30/.test(q74.sql), 'pagination : Intermédiaire, pages en exemple, pagination par clé');
const vitrine = fs.readFileSync(path.join(ROOT, 'decouvrir/index.html'), 'utf8');
const nb = k => ctx.ENTRETIEN.filter(q => q.niveau === k).length;
assert(vitrine.includes(`<li>Débutant · ${nb('Débutant')}</li><li>Intermédiaire · ${nb('Intermédiaire')}</li><li>Avancé · ${nb('Avancé')}</li>`), 'la vitrine compte les niveaux de l’appli');
/* 3 novembre, 6 h 07 : « supprimer les À retenir dans Entretien SQL ». */
assert(ctx.ENTRETIEN.every(q => !('retenir' in q)) && !html.includes('class="ent-retenir"'), 'plus de « À retenir » dans l’entretien');
/* 3 novembre, 6 h 19 : le schéma en étoile est dessiné (faits au centre, quatre dimensions). */
const etoile = ctx.ENTRETIEN.find(q => q.id === 'ent-v2-102').etoile;
assert(etoile && etoile.faits.t === 'faits_ventes' && etoile.dims.length === 4 && html.includes('${x.q.etoile?entEtoile(x.q.etoile):\'\'}'), 'schéma en étoile dessiné');
console.log(`  ${n} exemples vérifiés`);
console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
