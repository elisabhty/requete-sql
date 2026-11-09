#!/usr/bin/env node
/* Salle d’attente (Elisa, 2 novembre, 23 h 48) : plus de réglages une fois dans la salle ; le code en tête, dans la carte violette.
   Et jamais la page « Choisis ton pseudo » avant une salle (23 h 45), y compris quand la base ne connaît pas encore le pseudo. */
import fs from 'fs';
import path from 'path';
const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sec = fs.readFileSync(path.join(ROOT, 'multiplayer-security.js'), 'utf8');
let passed = 0, failed = 0;
const assert = (c, l) => { if (c) { passed++; console.log(`  ✓ ${l}`); } else { failed++; console.log(`  ✗ ${l}`); } };
console.log('\n=== Salle d’attente ===');
const i = html.indexOf("}else if(v==='lobby'){"), lobby = html.slice(i, html.indexOf("}else if(v.startsWith('draw')){", i));
assert(!lobby.includes('jeu-set') && !lobby.includes('jeuLobbySet('), 'pas de carte Niveau / Nombre de manches dans la salle');
assert(lobby.includes("const frame=etat(host?'target':'chat:pied',") && lobby.includes('html=frame+players+'), 'le code d’abord, dans la carte violette, puis les joueurs');
assert(lobby.includes('${chips()}${codeTuiles()}<button') && lobby.includes('onclick="jeuCopyCode()">${JEU_COPY_SVG}<span>Copier le code</span></button>'), 'pastilles, puis le code et « Copier le code » en bas de la carte');
assert(!/psPage\(/.test(sec), 'la salle sécurisée n’ouvre plus la page du pseudo');
assert(sec.includes('psReserverPourSalle()') && sec.includes('nameRetry:true'), 'pseudo inconnu de la base : réservé sans rien demander, puis on entre');
assert(html.includes('multiplayer-security.js?v=9') && fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes("'./multiplayer-security.js?v=9'"), 'script versionné');
/* 3 novembre, 6 h 08 : en solo, pas de salle d’attente avant le défi : le tirage au sort directement. */
const k = html.indexOf("}else if(v==='lobby'&&J.solo){"), solo = html.slice(html.indexOf('html=`', k), html.indexOf("}else if(v==='lobby'){", k));
assert(k > 0 && solo.includes('<h1>Tirage au sort</h1>') && !solo.includes('jeu-etat-code') && !solo.includes('Lancer') && !solo.includes('Invite'), 'solo : le tirage au sort, sans code ni « Invite tes amis »');
console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
