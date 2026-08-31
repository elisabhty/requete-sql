#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT=path.resolve(import.meta.dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
let passed=0,failed=0;
function assert(condition,label){
  if(condition){passed++;console.log(`  ✓ ${label}`);}
  else{failed++;console.log(`  ✗ ${label}`);}
}

const helpersStart=html.indexOf('function consoleSqlKey(');
const helpersEnd=html.indexOf('function isConsoleSqlPinned(',helpersStart);
const helpersSource=html.slice(helpersStart,helpersEnd);
const helpers=new Function(`${helpersSource};return {consoleSqlKey,dedupeConsoleQueries,promoteConsoleQuery,removeConsoleQuery};`)();
const {consoleSqlKey,dedupeConsoleQueries,promoteConsoleQuery,removeConsoleQuery}=helpers;

console.log('\n=== Historique et requêtes épinglées sans doublon ===');
assert(consoleSqlKey(' SELECT  *  FROM clients; ' )===consoleSqlKey('SELECT * FROM clients'),'espaces et point-virgule ne créent pas un doublon');

const old={sql:'SELECT * FROM clients;',ts:1,n:'9 lignes'};
const recent={sql:'SELECT * FROM produits;',ts:2,n:'8 lignes'};
const duplicate={sql:' SELECT * FROM clients ',ts:3,n:'9 lignes'};
const clean=dedupeConsoleQueries([recent,duplicate,old],24);
assert(clean.length===2,'les doublons déjà stockés sont nettoyés');
assert(clean[1]===duplicate,'la version la plus récente dans la liste est conservée');

const rerun={sql:'SELECT * FROM clients',ts:4,n:'9 lignes',ms:1};
const promoted=promoteConsoleQuery([recent,old],rerun,24);
assert(promoted.length===2,'réexécuter une requête ne grossit pas l’historique');
assert(promoted[0]===rerun,'la requête réexécutée repasse en tête');
assert(promoted[0].ts===4&&promoted[0].ms===1,'les métadonnées de la dernière exécution remplacent les anciennes');

const pins=promoteConsoleQuery([{sql:'SELECT * FROM clients;',ts:1}],{sql:' SELECT * FROM clients ',ts:5},12);
assert(pins.length===1&&pins[0].ts===5,'une requête épinglée reste unique et peut être actualisée');
assert(removeConsoleQuery([old,duplicate],old.sql).length===0,'désépingler retire toutes les anciennes copies éventuelles');

const recordStart=html.indexOf('function recordConsoleRun(');
const recordEnd=html.indexOf('function pinConsoleQuery(',recordStart);
const recordSource=html.slice(recordStart,recordEnd);
assert(recordSource.includes('p.hist=promoteConsoleQuery(p.hist,row,HIST_MAX)'), 'l’historique utilise la promotion plutôt qu’une insertion systématique');
const projectStart=html.indexOf('function projOf(');
const projectEnd=html.indexOf('function projectName(',projectStart);
const projectSource=html.slice(projectStart,projectEnd);
assert(projectSource.includes('dedupeConsoleQueries(projState[k].hist,HIST_MAX)')&&projectSource.includes('dedupeConsoleQueries(projState[k].pins,PIN_MAX)'), 'historique et épingles existants sont assainis au chargement');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed?1:0);
