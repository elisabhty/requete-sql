#!/usr/bin/env node
/* Recherche dans les questions d’entretien (Elisa, 2 novembre, 23 h 01 : « mettre une recherche, DA site internet »). */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}`); }
}

console.log('\n=== Recherche dans l’entretien ===');
const screen = html.slice(html.indexOf('<section id="scr-entretien"'), html.indexOf('</section>', html.indexOf('<section id="scr-entretien"')));
assert(screen.includes('id="ent-search"') && screen.includes('type="search"'), 'champ de recherche sur l’écran Entretien');
assert(screen.indexOf('id="ent-progress"') < screen.indexOf('id="ent-search"') && screen.indexOf('id="ent-search"') < screen.indexOf('id="ent-status"'), 'placé entre la carte violette et les onglets');
assert(screen.includes('role="status"') && screen.includes('aria-label="Effacer la recherche"'), 'annonce des résultats et croix accessible');
assert(html.includes('#scr-entretien.ent-focus-mode>.ent-search,'), 'caché quand une question est ouverte');
assert(css.includes('html.lq #app #scr-entretien .ent-search input{') && css.includes('box-shadow:0 3px 0 var(--lip)'), 'DA ludique : champ blanc à lèvre lilas');
assert(css.includes('.ent-hit{background:#FFE49A'), 'mots trouvés surlignés du jaune « À retenir »');

// Les fonctions de recherche, exécutées sur un petit jeu de questions.
const grab = (start, end) => { const i = html.indexOf(start); return html.slice(i, html.indexOf(end, i)); };
const code = [
  "function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}",
  grab('function entNbsp(', '\n'),
  grab('function entInFilter(', 'function syncEntSearchChrome('),
  "var ENT_FAMILLE_DE={'Fonctions fenêtre':'fenetres','Index':'performance','NULL':'fonctions'};var entFilter='all';",
  'this.api={set:v=>{entSearch=v;},entInFilter,entHighlight,entFold};',
].join('\n');
const ctx = {};
vm.runInNewContext(code, ctx);
const { api } = ctx;
const qs = [
  { q: 'À quoi servent LAG() et LEAD() ?', cat: 'Fonctions fenêtre', niveau: 'Intermédiaire', a: 'LAG accède à une ligne précédente.' },
  { q: 'À quoi sert un index ?', cat: 'Index', niveau: 'Débutant', a: 'Il accélère les <code>WHERE</code>.' },
  { q: 'Pourquoi <> et != ne trouvent jamais les lignes NULL ?', cat: 'NULL', niveau: 'Débutant', a: 'NULL n’est pas une valeur.' },
];
api.set('');
assert(qs.every(api.entInFilter), 'sans recherche, toutes les questions restent');
api.set('fenetre');
assert(api.entInFilter(qs[0]) && !api.entInFilter(qs[1]), 'sans accents : « fenetre » trouve « Fonctions fenêtre »');
api.set('where');
assert(api.entInFilter(qs[1]) && !api.entInFilter(qs[0]), 'cherche aussi dans la réponse, sans les balises');
api.set('lag   précédente');
assert(api.entInFilter(qs[0]) && !api.entInFilter(qs[2]), 'chaque mot doit être trouvé');
api.set('requete');
const hl = api.entHighlight('Comment écrire une requête ?');
assert(hl.includes('<mark class="ent-hit">requête</mark>'), 'surlignage sur le texte d’origine, accents compris');
api.set('a quoi');
assert(api.entHighlight(qs[0].q) === 'À <mark class="ent-hit">quoi</mark> servent LAG() et LEAD()\u00a0?', 'une lettre seule ne surligne pas');
api.set('null');
const hl2 = api.entHighlight(qs[2].q);
assert(hl2.includes('&lt;&gt;') && hl2.includes('<mark class="ent-hit">NULL</mark>'), 'texte échappé, mot surligné');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
