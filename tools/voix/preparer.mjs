#!/usr/bin/env node
/* Voix off : prépare tools/voix/<cours>.json à partir de la page du cours (assets/anim/<cours>.html), pour generer.mjs.
   node tools/voix/preparer.mjs <cours> [--ouverture "Texte de l’ouverture"]

   - ch00 : l’ouverture (le titre du cours, puis la phrase de la bulle) ;
   - ch01… : un fichier par chapitre, ses légendes dans l’ordre (telles que l’app les voit), phrase par phrase ;
   - at1… : les consignes des moments « À toi », indice1… : leurs indices (même numéro que le moment), touche1… : « Touche … » ;
   - lienavant, lienapres : le lien avec la leçon d’avant et celle d’après (assets/anim/liens.js) ;
   - bienvu, rattrape, presque, finbravo, fineffort : les phrases communes, reprises du premier cours (copiées dans
     tools/voix/sortie/<cours>/ : generer.mjs ne les refait pas, elles ne coûtent rien).
   La prononciation : DIRE ci-dessous (le code dit à voix haute) ; la phrase gardée pour caler la voix reste celle qui est dite. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..', '..');
const cours = process.argv[2];
if (!cours) { console.log('Usage : node tools/voix/preparer.mjs <cours> [--ouverture "…"]'); process.exit(1); }
const opt = f => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };
const page = fs.readFileSync(path.join(ROOT, 'assets', 'anim', cours + '.html'), 'utf8');
const base = JSON.parse(fs.readFileSync(path.join(DIR, 'bases-relationnelles.json'), 'utf8'));

const block = (name, close = '\n];') => { const a = page.indexOf(`const ${name} = [`); if (a < 0) return null; return page.slice(a, page.indexOf(close, a) + close.length); };
const run = (src, name, extra = {}) => vm.runInContext(src.replace(`const ${name} =`, `${name} =`) + `;${name}`, vm.createContext(Object.assign({APP: true, DURATION: 999, MAIL_OPEN: 0, [name]: null}, extra)));
/* Les constantes simples de la page (temps, couleurs du code…) dont les tableaux ont besoin. */
const consts = {};
for (const m of page.matchAll(/^const ([A-Z_][A-Z0-9_]* = [^;\n]+);/gm))   // « const A = 1, B = 2; » : chacune des constantes
  for (const d of m[1].split(/,\s*(?=[A-Z_][A-Z0-9_]* = )/)) { const k = d.slice(0, d.indexOf(' = ')), v = d.slice(d.indexOf(' = ') + 3);
    try { consts[k] = vm.runInContext(v, vm.createContext(Object.assign({APP: true}, consts))); } catch (e) {} }
/* Les cours qui posent leurs légendes avec cap(…) (DROP, schémas) : CAPTIONS et CHAPTERS sortent de SCH ; on rejoue ce déroulé. */
const sch = (() => { if (block('CHAPTERS')) return null; const a = page.indexOf('const SCH = {'), z = page.indexOf('\n', page.indexOf('const CHAPTERS = ', a));
  if (a < 0 || z < 0) return null;
  return vm.runInContext(page.slice(a, z) + ';({CAPTIONS, CHAPTERS})', vm.createContext(Object.assign({APP: true}, consts))); })();
const chapters = sch ? sch.CHAPTERS : run(block('CHAPTERS'), 'CHAPTERS', consts);
const captions = sch ? sch.CAPTIONS : run(block('CAPTIONS'), 'CAPTIONS', consts);
/* Les cours du projet construisent OPENS avec un .map(…) sur leurs mails : on rejoue alors les tableaux dont il dépend. */
const opens = (() => { if (!block('OPENS', '];')) return [];
  try { const o = run(block('OPENS', '];'), 'OPENS', consts); if (Array.isArray(o) && o.every(x => x && x.prompt)) return o; } catch (e) {}
  const ctx = Object.assign({}, consts);
  for (const m of page.matchAll(/^const ([A-Z_][A-Z0-9_]*) = \[/gm)) if (m[1] !== 'OPENS') { try { ctx[m[1]] = run(block(m[1]), m[1], ctx); } catch (e) {} }
  const a = page.indexOf('const OPENS = ['), end = page.indexOf('\n});', a), line = page.indexOf(';\n', a);
  const src = page.slice(a, end > 0 && end < page.indexOf('\nconst ', a + 10) ? end + 4 : line + 1);
  try { const o = run(src, 'OPENS', ctx); return Array.isArray(o) ? o : []; } catch (e) { return []; } })();
/* Les moments : leurs consignes et indices, lus dans le texte (le reste du tableau dépend de la page). Un moment = un « {at: ». */
const str = (seg, k) => { const m = seg.match(new RegExp('\\b' + k + ":\\s*'((?:[^'\\\\]|\\\\.)*)'")); return m ? m[1].replace(/\\u([0-9a-fA-F]{4})/g, (x, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\'/g, "'") : ''; };
const mSrc = block('MOMENTS') || block('PICKS') || '';   // les cours du projet appellent leurs moments PICKS
const moments = mSrc.split(/\{\s*at:/).slice(1).map(seg => ({prompt: str(seg, 'prompt'), hint: str(seg, 'hint')}));

const plain = h => String(h).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
/* Le code, dit à voix haute. */
const DIRE = [[/\bSELECT \*/g, 'SELECT étoile'], [/(\w)_(\w)/g, '$1 underscore $2'], [/« Prix \(€\) »/g, '« Prix en euros »'], [/\(€\)/g, 'le symbole euro'],
  [/ = /g, ' égale '], [/ \+ /g, ' plus '], [/'([^']+)'/g, '$1'], [/\s*;\s*$/g, '.']];
/* Elisa, 2 novembre, 1 h 06 : « c’est pas A-S c’est AS (attaché comme en anglais) » ; « quantité qu’elle a prononcé quantite ».
   Les mots-clés courts, écrits en capitales, que la voix épelait : écrits comme ils se disent (à l’anglaise, d’un seul mot). */
/* Elisa, 2 novembre, 1 h 32 : « elle dit DISTINCT (à la française), il faut dire distincte ». Les mots-clés qui sont aussi des mots français
   (DISTINCT, CASE, UNION) se disent à l’anglaise, eux aussi. */
const MOTS_CLES = {AS: 'aze', IN: 'inne', ON: 'onne', OR: 'or', BY: 'baï', IS: 'ize', AND: 'ènde', NOT: 'notte', ALL: 'ol', ANY: 'èni', SOME: 'somme', ASC: 'assk', DESC: 'dissk',
  DISTINCT: 'distinkte', CASE: 'kéïsse', UNION: 'iounionne', LIKE: 'laïke',
  /* Le premier module en entier (Elisa, 2 novembre, 7 h 49) : IN, BETWEEN, ORDER BY, LIMIT et OFFSET. */
  BETWEEN: 'bitouine', ORDER: 'ordeur', LIMIT: 'limitte', OFFSET: 'offsette',
  /* Le module « Fonctions et expressions » (Elisa, 2 novembre, 8 h 29, voix d’Adam) : les fonctions dites à l’anglaise. */
  UPPER: 'appeur', LOWER: 'loweur', TRIM: 'trimme', LENGTH: 'lènnguethe', SUBSTR: 'sub-stringue', INSTR: 'inne-stringue', REPLACE: 'riplèïsse',
  ROUND: 'round', FLOOR: 'flôr', CEIL: 'sîle', STRFTIME: 'strèf-taïme', CAST: 'kaste', INTEGER: 'inntédjeur', REAL: 'riale', TEXT: 'tèxte',
  WHEN: 'when', THEN: 'then', ELSE: 'else', END: 'end', COALESCE: 'koalèsse', COUNT: 'count',
  /* Le module « Agrégats et regroupements » (voix d’Antoine). 9 h 54 : « compté » pour COUNT, un accent espagnol sur SUM, AVG, MIN et MAX,
     « averge », « rounde » : ces fonctions s’écrivent désormais en anglais, comme des mots anglais (count, sum, average, min, max, round). */
  SUM: 'sum', AVG: 'average', MIN: 'min', MAX: 'max', GROUP: 'groupe', HAVING: 'hèvinngue', GROUP_CONCAT: 'groupe-konkatte', SEPARATOR: 'séparateur',
  /* Le module « Jointures » (voix de Perle). */
  JOIN: 'djoïnne', INNER: 'ineur', LEFT: 'lèfte', RIGHT: 'raïte', FULL: 'foul', OUTER: 'aouteur', CROSS: 'krosse', SELF: 'sèlfe', USING: 'iouzinngue',
  /* Le module « Sous-requêtes et ensembles » (voix de Mia). */
  EXISTS: 'ègzisste', WITH: 'ouisse', RECURSIVE: 'rikeursive', INTERSECT: 'inntersècte', EXCEPT: 'ixèpte', OVER: 'ôveur',
  /* Le module « Fonctions de fenêtre » (voix de Dorian). */
  PARTITION: 'partition', RANK: 'rannk', LAG: 'lague', LEAD: 'lîde', ROWS: 'raôze', ROW: 'raô', PRECEDING: 'prissîdinngue',
  FOLLOWING: 'folôouinngue', CURRENT: 'current', UNBOUNDED: 'eunnbaoundide', RANGE: 'réïndje',
  /* Le projet (voix d’Agathe) : la suite parle de CREATE TABLE. */
  CREATE: 'criéïte', TABLE: 'téïbeul',
  /* Le module « Créer et faire évoluer les tables » (voix d’Anaïs, 2 novembre, 9 h 33). */
  ALTER: 'olteur', RENAME: 'rinéïme', COLUMN: 'kolomme', DEFAULT: 'difolte', CHECK: 'tchèk', FOREIGN: 'foreune', KEY: 'ki', REFERENCES: 'rèfeurennssize',
  SCHEMA: 'skima', DROP: 'drope', UPDATE: 'eupdéïte', INSERT: 'innseurte', INTO: 'inntou', DELETE: 'dilîte', TO: 'tou', PRIMARY: 'praïmeri', UNIQUE: 'iounique', ADD: 'adde', IF: 'iffe', SET: 'sètte', DATE: 'date',
  /* Le module « Écrire et modifier les données » (voix d’Emily, 2 novembre, 9 h 42). */
  VALUES: 'valiouze', CONFLICT: 'konnflikte', MERGE: 'meurdje', MATCHED: 'matchte',
  /* Le module « Transactions et concurrence » (voix d’Arthur, 10 h 07) : écrits en anglais, comme count ou sum. */
  BEGIN: 'begin', TRANSACTION: 'transaction', COMMIT: 'commit', ROLLBACK: 'rollback', SAVEPOINT: 'savepoint', FOR: 'for',
  /* Le module « Procédures et triggers » (voix de Sam, 10 h 22). */
  CALL: 'call', PROCEDURE: 'procedure', FUNCTION: 'function', TRIGGER: 'trigger', AFTER: 'after', BEFORE: 'before', OLD: 'old', NEW: 'new',
  TIMESTAMP: 'timestamp', RETURNS: 'returns', RETURN: 'return',
  /* Le module « Vues, index et optimisation » (voix d’Abraham, 10 h 27). */
  VIEW: 'view', EXPLAIN: 'explain', QUERY: 'query', PLAN: 'plan', SCAN: 'scan', SEARCH: 'search',
  /* Le module « Sécurité et droits » (voix d’Anna, 10 h 32). */
  GRANT: 'grant', REVOKE: 'revoke'};
/* Les noms de colonnes et de tables sans accent (le code n’en met pas) : dits avec leurs accents. */
const ACCENTS = {schema: 'schéma', sql: 'S Q L', prenom: 'prénom', prenoms: 'prénoms', age: 'âge', ages: 'âges', selection: 'sélection', quantite: 'quantité', quantites: 'quantités',
  categorie: 'catégorie', categories: 'catégories', numero: 'numéro', etre: 'être', fidelite: 'fidélité', seance: 'séance', seances: 'séances',
  medecin: 'médecin', medecins: 'médecins', salarie: 'salarié', salaries: 'salariés', expedition: 'expédition', expedier: 'expédier', expedie: 'expédié',
  telephone: 'téléphone', entrepot: 'entrepôt', derniere: 'dernière', dernier: 'dernier', delai: 'délai', delais: 'délais', annee: 'année', annees: 'années',
  evenement: 'événement', evenements: 'événements', reference: 'référence', region: 'région', duree: 'durée', employe: 'employé', employes: 'employés',
  depense: 'dépense', depenses: 'dépenses', creation: 'création', cree: 'créé', genre: 'genre', periode: 'période', tache: 'tâche',
  taches: 'tâches', theme: 'thème', etat: 'état', eleve: 'élève', eleves: 'élèves', reduction: 'réduction', reserve: 'réservé', reservation: 'réservation',
  reservations: 'réservations', id: 'identifiant', typeof: 'taïpe-off', preparation: 'préparation', integer: 'inntédjeur', text: 'tèxte', interet: 'intérêt', adherent: 'adhérent', adherents: 'adhérents', echeance: 'échéance', reglement: 'règlement'};
/* Les signes de comparaison, les motifs de LIKE et les flèches, dits en mots (Elisa, 2 novembre, 7 h 23 : les cinq cours suivants). */
const SIGNES = {'<=': 'inférieur ou égal', '>=': 'supérieur ou égal', '!=': 'différent', '<>': 'différent', '<': 'inférieur', '>': 'supérieur', '=': 'égal'};
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/* SQLite, excluded et true (le module « Écrire et modifier les données ») : dits à l’anglaise. */
/* FIRST_VALUE, LAST_VALUE et NTILE : dits en anglais, sans « underscore ». */
DIRE.unshift([/\bFIRST_VALUE\b/g, 'First value'], [/\bLAST_VALUE\b/g, 'Last value'], [/\bNTILE\((\d+)\)/g, 'ènne-taïle de $1'], [/\bNTILE\b/g, 'ènne-taïle']);
/* « 1re forme normale », « 2e », « 3e » : dits en toutes lettres. */
DIRE.unshift([/\b([123])(?:re|e)(?= forme)/g, (m, n, off, all) => { const w = ['première', 'deuxième', 'troisième'][n - 1]; return off === 0 || /[.!?]\s+$/.test(all.slice(0, off)) ? w.charAt(0).toUpperCase() + w.slice(1) : w; }]);
DIRE.unshift([/\b(\d{1,2})\/(\d{2})\/(\d{4})\b/g, (m, j, mo, a) => (+j === 1 ? '1er' : String(+j)) + ' ' + MOIS[+mo - 1] + ' ' + a],
  [/\b(\d{1,2}):(\d{2})\b/g, '$1 h $2'], [/PostgreSQL/g, 'Postgres Q L'], [/\bNB-(\d+)/g, 'N B $1'], [/CURRENT_TIMESTAMP/g, 'current timestamp'], [/(^|\s)−(?=\d)/g, '$1moins '], [/SQLite/g, 'S Q Laïte'], [/\bexcluded\b/g, 'ixcloudide'], [/\bWHERE true\b/g, 'WHERE trou']);
DIRE.unshift([/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, a, mo, j) => (+j === 1 ? '1er' : String(+j)) + ' ' + MOIS[+mo - 1] + ' ' + a],
  [/(\d)\.\.\*/g, '$1 point point étoile'], [/(\d)\.\.(\d)/g, '$1 point point $2'], [/(^|\s)\*(?=\s)(?!\s*\d)/g, '$1étoile'], [/([a-zé])\/(?=l[ae] )/g, '$1 ou '],
  [/GROUP_CONCAT/g, 'groupe-konkatte'], [/ROW_NUMBER/g, 'raô-nommbeur'], [/DENSE_RANK/g, 'dènnse-rannk'], [/PERCENT_RANK/g, 'peursènnte-rannk'], [/rendez_vous/g, 'rendez-vous'], [/([A-Za-zÀ-ÿ0-9])\.(?=[a-zà-ÿ])/g, '$1 point '], [/'([^']+)'/g, '$1'], [/(\d)\s*%/g, '$1 pour cent'], [/\s*→\s*/g, ', donne '],
  [/(^|\s)([%_A-Za-zÀ-ÿ]*[%_][%_A-Za-zÀ-ÿ]*)(?=[\s,.;:!?»)]|$)/g, (m, a, w) => /[%_]/.test(w) && !/[A-Za-zÀ-ÿ]_[A-Za-zÀ-ÿ]/.test(w)
    ? a + w.split(/([%_])/).filter(Boolean).map(x => x === '%' ? 'pourcent' : x === '_' ? 'tiret bas' : x).join(', ') : m],
  /* Suivi d’une valeur : « inférieur à 60 », « différent de Accessoire » ; suivi d’un mot de la phrase (« > et < », « != à la place ») : le signe seul. */
  [/\s*(<=|>=|!=|<>|<|>)\s*(?=[A-Za-zÀ-ÿ0-9'«])(?!(?:et|ou|à|est|pas|qui|ni)\b)/g, (m, op) => ' ' + SIGNES[op] + (/^(!=|<>)$/.test(op) ? ' de ' : ' à ')], [/(<=|>=|!=|<>|<|>)/g, op => SIGNES[op]],
  [/(^|\s)=(?=[,.;:])/g, '$1égal'],
  /* Les calculs du module « Fonctions et expressions » : ||, ×, *, −, +7, 29.9, (), 1ᵉʳ. */
  [/\s*\|\|\s*/g, ' deux barres verticales '], [/\s*[×*]\s*(?=\d)/g, ' fois '], [/ − /g, ' moins '], [/(^|[\s'])\+(?=\d)/g, '$1plus '],
  [/(^|\s)\+(?=,|\s(?!\d))/g, '$1le signe plus'], [/\s*÷\s*/g, ' divisé par '], [/(\d)\.(\d)/g, '$1 virgule $2'], [/\(\)/g, ''], [/ᵉʳ/g, 'er'], [/ +(?=[.,])/g, ''], [/n°\s*/g, 'numéro ']);
/* Injection SQL : « ' OR '1'='1 » dit « or un égale un », le « ? » d’une requête paramétrée dit en toutes lettres, l’e-mail dit avec « arobase ». */
DIRE.unshift([/(?:' )?OR '1'='1'?/g, 'or un égale un'], [/'1'='1'/g, (m, off, all) => off === 0 || /[.!?:]\s+$/.test(all.slice(0, off)) ? 'Un égale un' : 'un égale un'], [/\b(un|son) \?(?=[.,]| [a-zà-ÿ])/g, '$1 point d’interrogation'], [/sophie@mail\.fr/g, 'sophie arobase mail point fr']);
DIRE.push([new RegExp('\\b(' + Object.keys(MOTS_CLES).join('|') + ')\\b', 'g'), (m, w, off, all) => { const d = MOTS_CLES[w];
    return off === 0 || /[.!?:]\s+$/.test(all.slice(0, off)) && !/:\s+$/.test(all.slice(0, off)) ? d.charAt(0).toUpperCase() + d.slice(1) : d; }],
  [/(^|[^A-Za-zÀ-ÿ])([a-z]+)(?=$|[^A-Za-zÀ-ÿ])/g, (m, a, w) => a + (ACCENTS[w] || w)]);
/* Une phrase qui ne se lit pas telle quelle : sa version dite (la légende, elle, ne change pas). */
const PHRASES = {
  /* ANY et ALL : « > ALL » en tête de phrase, « (…) » qui ne se lit pas, « = ANY » à dire « égal à ANY ». */
  '> ALL est vrai si le prix est plus grand que chacune des valeurs de la sous-requête.': 'Supérieur à ol est vrai si le prix est plus grand que chacune des valeurs de la sous-requête.',
  '> ANY est vrai si le prix dépasse au moins une valeur de la sous-requête.': 'Supérieur à èni est vrai si le prix dépasse au moins une valeur de la sous-requête.',
  'Et = ANY revient à IN : égal à au moins une valeur de la liste.': 'Et égal à èni revient à inne : égal à au moins une valeur de la liste.',
  'Or > compare un prix à une seule valeur.': 'Or le signe supérieur à compare un prix à une seule valeur.',
  'Et à la place de = ANY, on écrit IN.': 'Et à la place de égal à èni, on écrit inne.',
  'Pour chaque produit, prix > ALL (…) est-il vrai ou faux ?': 'Pour chaque produit, prix supérieur à ol est-il vrai ou faux ?',
  'Avec prix > ANY (…), combien des 8 produits sont retenus ?': 'Avec prix supérieur à èni, combien des 8 produits sont retenus ?',
  "'paris' ≠ 'Paris' : écris la valeur telle qu’elle figure dans la table.": 'Attention aux majuscules : paris n’est pas Paris. Écris la valeur telle qu’elle figure dans la table.',
  'Dans la prochaine leçon, tu compareras des valeurs avec =, > ou <.': 'Dans la prochaine leçon, tu compareras des valeurs avec les signes égal, plus grand que et plus petit que.',
  'Dans la leçon précédente, tu as comparé des valeurs avec =, > ou <.': 'Dans la leçon précédente, tu as comparé des valeurs avec les signes égal, plus grand que et plus petit que.',
  'On remplace = par <=, qui signifie inférieur ou égal à.': 'On remplace le signe égal par le signe inférieur ou égal.',
  'Avec > et <, la limite est exclue : une valeur égale n’est pas gardée.': 'Avec les signes strictement supérieur et strictement inférieur, la limite est exclue : une valeur égale n’est pas gardée.',
  'Avec >= et <=, la limite est incluse : une valeur égale à la limite est gardée.': 'Avec les signes supérieur ou égal et inférieur ou égal, la limite est incluse : une valeur égale à la limite est gardée.',
  'Avec !=, on compare aussi du texte : seul le Shaker Inox est écarté.': 'Avec le signe différent, on compare aussi du texte : seul le Shaker Inox est écarté.',
  'Pour dire « différent de », tu peux utiliser != à la place de NOT devant une égalité.': 'Pour dire « différent de », tu peux utiliser le signe différent à la place de notte devant une égalité.',
  'Attention, l’inverse de < est >=, pas > : le 1er mars compte aussi.': 'Attention, l’inverse de strictement inférieur est supérieur ou égal, pas strictement supérieur : le 1er mars compte aussi.',
  'Avec =, on retrouve une valeur exacte : prenom = \'Sophie\' → Sophie Martin.': 'Avec le signe égal, on retrouve une valeur exacte : prénom égal Sophie donne Sophie Martin.',
  'C’est l’équivalent de >= pour le début et de <= pour la fin.': 'C’est l’équivalent du signe supérieur ou égal pour le début, et du signe inférieur ou égal pour la fin.',
  'On saute (page − 1) × 3 lignes : 0 pour la page 1, puis 3, puis 6.': 'On saute le numéro de la page moins un, fois 3 lignes : 0 pour la page 1, puis 3, puis 6.',
  'Attention : avec + à la place de ||, la requête renvoie 0.': 'Attention : avec le signe plus à la place des deux barres verticales, la requête renvoie 0.',
  'Pour assembler des textes, utilise donc toujours ||, jamais +.': 'Pour assembler des textes, utilise donc toujours les deux barres verticales, jamais le signe plus.',
  'INSTR(adresse, \' \') donne la position de ce premier espace : 3.': 'inne-stringue, adresse, espace, donne la position de ce premier espace : 3.',
  'SUBSTR garde les caractères avant cet espace, soit 3 − 1 = 2 : 12.': 'sub-stringue garde les caractères avant cet espace, soit 3 moins 1, égale 2 : 12.',
  'Le + 1 permet de commencer juste après le premier espace.': 'Le plus 1 permet de commencer juste après le premier espace.',
  'Et avec + à la place de ||, que renvoie UPPER(nom) + \' \' + prenom ?': 'Et avec le signe plus à la place des deux barres verticales, que renvoie appeur de nom, plus espace, plus prénom ?',
  'Dans une requête, +, -, * et / calculent comme sur une calculatrice.': 'Dans une requête, plus, moins, fois et divisé calculent comme sur une calculatrice.',
  'Et % donne le reste d’une division : 80 % 6 donne 2.': 'Et le signe pourcent donne le reste d’une division : 80 modulo 6 donne 2.',
  'FLOOR(prix) retire les centimes, puis × 2 calcule les points gagnés.': 'flôr de prix retire les centimes, puis fois 2 calcule les points gagnés.',
  'Les dates s’affichent au format année-mois-jour : 2026-07-02.': 'Les dates s’affichent au format année, mois, jour : 2026, tiret, 07, tiret, 02.',
  'Le format \'%d/%m/%Y\' affiche la date 2026-07-02 en 02/07/2026.': 'Le format pourcent d, barre, pourcent m, barre, pourcent Y affiche le 2 juillet 2026 sous la forme 02/07/2026.',
  'Chaque format récupère une partie de la date. Ici, \'%d\' renvoie 02, le numéro du jour dans le mois.': 'Chaque format récupère une partie de la date. Ici, pourcent d renvoie 02, le numéro du jour dans le mois.',
  'car le texte commence par CMD-, et non par des chiffres.': 'car le texte commence par C M D tiret, et non par des chiffres.',
  'et \'CMD-2026-1002481\' du texte, écrit entre apostrophes.': 'et C M D, tiret, 2026, tiret, 1002481 du texte, écrit entre apostrophes.',
  'Un texte vide \'\' ne contient aucun caractère, mais ce n’est pas NULL.': 'Un texte vide, deux apostrophes sans rien entre elles, ne contient aucun caractère, mais ce n’est pas NULL.',
  'Que renvoie COALESCE(\'\', \'Non renseigné\') ?': 'Que renvoie koalèsse d’un texte vide et de Non renseigné ?',
  'Que renvoie GROUP_CONCAT(client_id, \', \') ?': 'Que renvoie groupe-konkatte de client underscore identifiant, avec virgule et espace comme séparateur ?',
  '\'%ie%\' renvoie Sophie Martin et Gabriel Michel, dont le prénom contient « ie ».': 'Le motif pourcent, i e, pourcent renvoie Sophie Martin et Gabriel Michel, dont le prénom contient i e.'
};
const dire = s => PHRASES[s] || DIRE.reduce((t, [a, b]) => t.replace(a, b), s);

const intro = (() => {
  const a = page.indexOf('class="abs title"'), seg = page.slice(a, a + 1600);
  let sub = plain((seg.match(/class="abs sub">([\s\S]*?)<\/div>/) || [])[1] || '');
  /* Un sous-titre qui continue le grand titre (« PROCÉDURES » puis « et fonctions stockées ») : le titre est dit avant. */
  const big = plain((seg.match(/class="abs title">([\s\S]*?)<\/div>/) || [])[1] || '').replace(/\s+/g, '');
  if (/^(et|ou|de|du|des|avec)\b/.test(sub) && big) sub = big.charAt(0) + big.slice(1).toLowerCase() + ' ' + sub;
  /* La bulle de l’intro : le premier bloc de texte assez long après le sous-titre, balises comprises. */
  const rest = seg.slice(seg.indexOf('abs sub')).replace(/^[^>]*>[\s\S]*?<\/div>/, '');
  const bulle = (rest.split(/<\/(?:p|div)>/).map(plain).find(t => t.length > 25) || '');
  return {sub, bulle};
})();
const ouverture = opt('--ouverture') || `Nouveau cours : ${intro.sub.charAt(0).toLowerCase() + intro.sub.slice(1)}.`;

const el = [];
const ch00 = [ouverture, intro.bulle].filter(Boolean).map(dire);   // l’ouverture aussi : « Utilise distinkte pour… »
el.push({id: 'ch00', titre: '00 · Ouverture', phrases: ch00});
chapters.forEach((c, i) => {
  const lg = captions.filter(x => x[0] >= c.a && x[0] < c.b).map(x => plain(x[2]));
  if (lg.length) el.push({id: 'ch' + String(c.n).padStart(2, '0'), titre: `${String(c.n).padStart(2, '0')} · ${c.label}`, phrases: lg.map(dire), legendes: lg});
});
el.forEach((e, k) => { e.avant = k ? e === el[0] ? null : el[k - 1].phrases.at(-1) : null; e.apres = el[k + 1] ? el[k + 1].phrases[0] : null; });
const out = el.map(e => Object.assign({id: e.id, titre: e.titre, texte: '[cheerful] ' + e.phrases.join('\n\n'), avant: e.avant, apres: e.apres, phrases: e.phrases},
  e.legendes && e.legendes.some((x, k) => x !== e.phrases[k]) ? {legendes: e.legendes} : {}));
moments.forEach((m, i) => out.push({id: 'at' + (i + 1), texte: '[cheerful] À toi ! ' + dire(plain(m.prompt || ''))}));
moments.forEach((m, i) => { if (m.hint) out.push({id: 'indice' + (i + 1), texte: '[warmly] ' + dire(plain(m.hint))}); });
opens.forEach((o, i) => out.push({id: 'touche' + (i + 1), texte: '[cheerful] ' + dire(plain(o.prompt))}));
/* Le lien avec la leçon d’avant et celle d’après (assets/anim/liens.js) : lienavant, lienapres, dits pendant leur pause. */
const liens = (() => { const c = vm.createContext({window: {}}); vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', 'anim', 'liens.js'), 'utf8'), c); return c.window.liensDe(cours) || {}; })();
for (const k of ['avant', 'apres']) if (liens[k]) out.push({id: 'lien' + k, texte: '[cheerful] ' + dire(plain(liens[k]).replace(/&gt;/g, '>').replace(/&lt;/g, '<'))});
const COMMUNES = ['bienvu', 'rattrape', 'presque', 'finbravo', 'fineffort'];
COMMUNES.forEach(id => out.push(base.elements.find(x => x.id === id)));

/* La voix (Elisa, 2 novembre, 8 h 29) : Agathe garde les cours déjà voisés (l’introduction et « Lire une table ») ; à partir du module
   « Fonctions et expressions », c’est Adam (« Adam – Formation, Tutos & Éducation »). Ses phrases communes sont générées avec lui. */
const AGATHE = ['bases-relationnelles', 'as', 'distinct', 'where', 'comparer', 'and-or', 'injection-sql', 'not', 'null', 'like', 'in', 'between', 'order-by', 'limit-offset'];
const ADAM = {id: 'TGAegA0zNRi8I6nUdq3i', nom: 'Adam'};
/* 8 h 55 : le module « Agrégats et regroupements » avec Antoine (« Antoine – Dynamic, Captivating, and Professional Voice »). */
const ANTOINE = {id: 'nbiTBaMRdSobTQJDzIWm', nom: 'Antoine'}, AGREGATS = ['count', 'agregats', 'group-by', 'group-by-colonnes', 'having', 'ordre-execution', 'group-concat'];
/* 9 h 02 : le module « Jointures » avec Perle (« Perle | Premium French Corporate Voice »), la formatrice. */
const PERLE = {id: 'UaGvaD7NWzU5mJNoUqoY', nom: 'Perle'}, JOINTURES = ['inner-join', 'left-join', 'right-join', 'full-outer-join', 'cross-join',
  'jointure-3-tables', 'join-group-by', 'self-join', 'plusieurs-conditions-on', 'quel-join-choisir'];
/* 9 h 06 : le module « Sous-requêtes et ensembles » avec Mia (« Mia García – Cálida instructora e-learning »), la formatrice. */
const MIA = {id: 'PrwKJdvtTbJVdosRhS1O', nom: 'Mia'}, SOUS_REQUETES = ['sous-requete-in', 'sous-requete-select', 'sous-requete-from', 'exists', 'any-all',
  'with-cte', 'union', 'intersect-except', 'with-recursive'];
/* 9 h 14 : le module « Fonctions de fenêtre » avec Dorian (« Dorian – Jeune homme calme français sans accent »), le formateur. */
const DORIAN = {id: 'vp2FCFmQCE4NzuQj9QNe', nom: 'Dorian'}, FENETRES = ['over', 'fonctions-rang', 'lag-lead', 'fenetres-glissantes', 'first-last-ntile'];
/* 9 h 21 : le module « Modéliser » reprend la formatrice du premier module (Agathe, la blonde). */
const MODELISER = ['formes-normales', 'projet-normaliser', 'projet-cles', 'projet-uml'];
/* 9 h 33 : le module « Créer et faire évoluer les tables » avec Anaïs (« Anaïs – News, podcasting and e-learning »), la formatrice. */
const ANAIS = {id: '5OnMHwgTFgvPVwE8jP6B', nom: 'Anaïs'}, TABLES = ['projet-create', 'projet-alter', 'projet-drop', 'projet-schemas'];
/* 9 h 42 : le module « Écrire et modifier les données » avec Emily (« Emily – Australian Female »), la formatrice. */
const EMILY = {id: 'p43fx6U8afP2xoq1Ai9f', nom: 'Emily'}, DONNEES = ['projet-insert', 'projet-update', 'projet-merge', 'projet-delete'];
/* 9 h 59 : le module « Intégrité des tables liées » avec Koraly (« Koraly – E-learning Instructor »), la formatrice. */
const KORALY = {id: 'QbsdzCokdlo98elkq4Pc', nom: 'Koraly'}, INTEGRITE = ['projet-ondelete'];
/* 10 h 07 : le module « Transactions et concurrence » avec Arthur (« Arthur – Chill Gen Z American Male »), le formateur. */
const ARTHUR = {id: 'i32gAGa2D3T8nPzY1EsZ', nom: 'Arthur'}, TRANSACTIONS = ['projet-transaction', 'projet-savepoint', 'projet-concurrence'];
/* 10 h 22 : le module « Procédures et triggers » avec Sam (« Sam – British Male – Warm, Articulate Non-Fiction Narrator »), le formateur. */
const SAM = {id: 'G7ILShrCNLfmS0A37SXS', nom: 'Sam'}, PROCEDURES = ['projet-procedures', 'projet-trigger'];
/* 10 h 27 : le module « Vues, index et optimisation » avec Abraham (« Abraham – Casual Narrator »), le formateur. */
const ABRAHAM = {id: 'coQWS9nJLPoZCZPQu6km', nom: 'Abraham'}, VUES = ['projet-vue', 'projet-index'];
/* 10 h 32 : le module « Sécurité et droits » avec Anna (« Anna – Customer Service & Training »), la formatrice. */
const ANNA = {id: '0VPW6YsfGkzxile59Ueo', nom: 'Anna'}, DROITS = ['projet-droits'];
const voix = AGATHE.includes(cours) || MODELISER.includes(cours) ? base.voix : AGREGATS.includes(cours) ? ANTOINE : JOINTURES.includes(cours) ? PERLE
  : SOUS_REQUETES.includes(cours) ? MIA : FENETRES.includes(cours) ? DORIAN : TABLES.includes(cours) ? ANAIS : DONNEES.includes(cours) ? EMILY : INTEGRITE.includes(cours) ? KORALY : TRANSACTIONS.includes(cours) ? ARTHUR : PROCEDURES.includes(cours) ? SAM : VUES.includes(cours) ? ABRAHAM : DROITS.includes(cours) ? ANNA : ADAM;
const job = {cours, titre: intro.sub, voix, modele: base.modele, langue: base.langue, format: base.format, elements: out};
fs.writeFileSync(path.join(DIR, cours + '.json'), JSON.stringify(job, null, 2) + '\n');
/* Les phrases communes : copiées depuis le premier cours (si ses fichiers bruts sont là). */
const src = path.join(DIR, 'sortie', 'bases-relationnelles'), dst = path.join(DIR, 'sortie', cours);
if (voix.id === base.voix.id && fs.existsSync(src)) { fs.mkdirSync(dst, {recursive: true}); for (const id of COMMUNES) for (const x of ['.mp3', '.json']) if (fs.existsSync(path.join(src, id + x)) && !fs.existsSync(path.join(dst, id + x))) fs.copyFileSync(path.join(src, id + x), path.join(dst, id + x)); }
const repris = voix.id === base.voix.id ? COMMUNES : [];
const n = out.filter(e => !repris.includes(e.id)).reduce((a, e) => a + e.texte.length, 0);
console.log(`${cours} (voix ${voix.nom}) : ${out.length} fichiers (${out.length - repris.length} à générer, ${repris.length} repris), environ ${n.toLocaleString('fr-FR')} crédits`);
