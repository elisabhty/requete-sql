// Les moteurs de synchronisation du compte (account/*.mjs, préparés début novembre) réunis en un script classique, compte-moteurs.js,
// que l'appli charge comme achat.js et connexion.js (12 novembre, la connexion). Pourquoi pas des modules : dans l'app iPhone, Capacitor
// sert un .mjs comme « application/octet-stream », qu'un navigateur refuse d'exécuter comme module. Chaque fichier garde sa portée
// (une fonction par module) ; ses « import » deviennent des lectures dans les modules déjà chargés, ses « export » ce qu'il rend.
// Lancé par npm run build:www ; le fichier produit est gardé dans Git (un test vérifie qu'il est à jour).
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const racine = new URL('..', import.meta.url).pathname;
const ORDRE = ['sync-engine', 'learning', 'progression', 'documents'];

export function assembler() {
  const parties = ORDRE.map(nom => {
    let t = readFileSync(join(racine, 'account', nom + '.mjs'), 'utf8');
    const exports = [...t.matchAll(/^export (?:async )?(?:function|const|class) ([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
    t = t.replace(/^import \{([^}]+)\} from '\.\/([\w-]+)\.mjs';$/gm, (_, noms, de) => {
      if (!ORDRE.includes(de) || ORDRE.indexOf(de) >= ORDRE.indexOf(nom)) throw new Error(`${nom} importe ${de}, absent ou chargé après`);
      return `const {${noms.trim()}}=M['${de}'];`;
    });
    if (/^import /m.test(t)) throw new Error(`${nom} : import non pris en charge`);
    t = t.replace(/^export (async function|function|const|class) /gm, '$1 ');
    return `M['${nom}']=(function(){\n${t.trim()}\nreturn {${exports.join(',')}};\n})();`;
  });
  return `/* compte-moteurs.js : FICHIER PRODUIT par scripts/compte-moteurs.mjs à partir de account/${ORDRE.join('.mjs, account/')}.mjs.
   Ne pas modifier à la main : changer account/*.mjs, puis npm run build:www (ou node scripts/compte-moteurs.mjs). */
(function(){
'use strict';
var M={};
${parties.join('\n')}
window.REQUETE_MOTEURS=Object.freeze({
  createProgressionSync:M['progression'].createProgressionSync,extractProgression:M['progression'].extractProgression,
  mergeProgression:M['progression'].mergeProgression,validateProgression:M['progression'].validateProgression,
  extractPlan:M['learning'].extractPlan,validatePlan:M['learning'].validatePlan,
  createDocumentsSync:M['documents'].createDocumentsSync,extractSavedNotes:M['documents'].extractSavedNotes,
  notesFromSnapshot:M['documents'].notesFromSnapshot,validateDocument:M['documents'].validateDocument
});
})();
`;
}

if (process.argv[1] && process.argv[1].endsWith('compte-moteurs.mjs')) {
  writeFileSync(join(racine, 'compte-moteurs.js'), assembler());
  console.log('compte-moteurs.js prêt');
}
