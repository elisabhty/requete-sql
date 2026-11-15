#!/usr/bin/env node
/* Les titres des défis dans chaque langue, pour la fonction jeu-ile (la salle dans l’île, Live Activity) : 15 novembre, 17 h 45
   (Elisa : « corrige stp », pour « sur l’iPhone des autres, dans la Dynamic Island, le nom du défi s’affiche dans la langue de celui qui
   l’envoie »). Le téléphone qui pousse l’état de la salle donne l’identifiant du défi (defi_id) ; le serveur met, chez chacun, le
   titre dans sa langue (celle que son téléphone a donnée avec le jeton de son activité). Le titre anglais est celui que l’appli
   affiche (defisLangue : REQUETE_LANGUE.t du titre français, langue-en-defis.js).
   node scripts/build-ile-titres.mjs   →   supabase/functions/jeu-ile/titres.mjs (puis redéployer jeu-ile) */
import fs from 'node:fs';
import vm from 'node:vm';
import { ROOT, lire, moteur } from '../tools/langue/commun.mjs';

const html = lire('index.html'), ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const CHALLENGES=['), html.indexOf('const NIV=')).replace('const CHALLENGES=', 'CHALLENGES='), ctx);
const CHALLENGES = vm.runInContext('CHALLENGES', ctx);
const LANGUES = ['en'], L = Object.fromEntries(LANGUES.map(c => [c, moteur(c, [`langue-${c}-defis.js`])]));
const propre = s => Array.from(String(s || '').trim()).slice(0, 80).join('');   // tel que l’appli l’envoie (natifT(c.titre).slice(0, 80))
const titres = {};
for (const c of CHALLENGES) titres[c.id] = [propre(c.titre), ...LANGUES.map(l => propre(c.base && L[l].baseTraduite(c.base) ? L[l].t(c.titre) : c.titre))];
const corps = `// Écrit par scripts/build-ile-titres.mjs : ne pas modifier à la main. {id du défi: [français, ${LANGUES.join(', ')}]}\n`
  + `export const LANGUES_ILE = ${JSON.stringify(['fr', ...LANGUES])};\nexport const TITRES = ${JSON.stringify(titres)};\n`;
fs.writeFileSync(`${ROOT}/supabase/functions/jeu-ile/titres.mjs`, corps);
const traduits = Object.values(titres).filter(t => t[1] !== t[0]).length;
console.log(`${Object.keys(titres).length} défis, ${traduits} titres traduits → supabase/functions/jeu-ile/titres.mjs (${corps.length} octets)`);
