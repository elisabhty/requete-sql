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
for (const m of page.matchAll(/^const ([A-Z_][A-Z0-9_]*) = ([^;\n]+);/gm)) { try { consts[m[1]] = vm.runInContext(m[2], vm.createContext(Object.assign({APP: true}, consts))); } catch (e) {} }
const chapters = run(block('CHAPTERS'), 'CHAPTERS', consts);
const captions = run(block('CAPTIONS'), 'CAPTIONS', consts);
const opens = block('OPENS', '];') ? run(block('OPENS', '];'), 'OPENS', consts) : [];
/* Les moments : leurs consignes et indices, lus dans le texte (le reste du tableau dépend de la page). Un moment = un « {at: ». */
const str = (seg, k) => { const m = seg.match(new RegExp('\\b' + k + ":\\s*'((?:[^'\\\\]|\\\\.)*)'")); return m ? m[1].replace(/\\'/g, "'") : ''; };
const mSrc = block('MOMENTS') || '';
const moments = mSrc.split(/\{\s*at:/).slice(1).map(seg => ({prompt: str(seg, 'prompt'), hint: str(seg, 'hint')}));

const plain = h => String(h).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
/* Le code, dit à voix haute. */
const DIRE = [[/\bSELECT \*/g, 'SELECT étoile'], [/(\w)_(\w)/g, '$1 underscore $2'], [/« Prix \(€\) »/g, '« Prix en euros »'], [/\(€\)/g, 'le symbole euro'],
  [/ = /g, ' égale '], [/ \+ /g, ' avec '], [/'([^']+)'/g, '$1'], [/\s*;\s*$/g, '.']];
/* Elisa, 2 novembre, 1 h 06 : « c’est pas A-S c’est AS (attaché comme en anglais) » ; « quantité qu’elle a prononcé quantite ».
   Les mots-clés courts, écrits en capitales, que la voix épelait : écrits comme ils se disent (à l’anglaise, d’un seul mot). */
/* Elisa, 2 novembre, 1 h 32 : « elle dit DISTINCT (à la française), il faut dire distincte ». Les mots-clés qui sont aussi des mots français
   (DISTINCT, CASE, UNION) se disent à l’anglaise, eux aussi. */
const MOTS_CLES = {AS: 'aze', IN: 'inne', ON: 'onne', OR: 'or', BY: 'baï', IS: 'ize', AND: 'ènde', NOT: 'notte', ALL: 'ol', ASC: 'assk', DESC: 'dissk',
  DISTINCT: 'distinkte', CASE: 'kéïsse', UNION: 'iounionne', LIKE: 'laïke'};
/* Les noms de colonnes et de tables sans accent (le code n’en met pas) : dits avec leurs accents. */
const ACCENTS = {prenom: 'prénom', prenoms: 'prénoms', age: 'âge', ages: 'âges', selection: 'sélection', quantite: 'quantité', quantites: 'quantités',
  categorie: 'catégorie', categories: 'catégories', numero: 'numéro', etre: 'être', fidelite: 'fidélité', seance: 'séance', seances: 'séances',
  medecin: 'médecin', medecins: 'médecins', salarie: 'salarié', salaries: 'salariés', expedition: 'expédition', expedier: 'expédier', expedie: 'expédié',
  telephone: 'téléphone', entrepot: 'entrepôt', derniere: 'dernière', dernier: 'dernier', delai: 'délai', delais: 'délais', annee: 'année', annees: 'années',
  evenement: 'événement', evenements: 'événements', reference: 'référence', region: 'région', duree: 'durée', employe: 'employé', employes: 'employés',
  depense: 'dépense', depenses: 'dépenses', creation: 'création', cree: 'créé', modifie: 'modifié', genre: 'genre', periode: 'période', tache: 'tâche',
  taches: 'tâches', theme: 'thème', etat: 'état', eleve: 'élève', eleves: 'élèves', reduction: 'réduction', reserve: 'réservé', reservation: 'réservation',
  reservations: 'réservations', interet: 'intérêt', adherent: 'adhérent', adherents: 'adhérents', echeance: 'échéance', reglement: 'règlement'};
/* Les signes de comparaison, les motifs de LIKE et les flèches, dits en mots (Elisa, 2 novembre, 7 h 23 : les cinq cours suivants). */
const SIGNES = {'<=': 'inférieur ou égal', '>=': 'supérieur ou égal', '!=': 'différent', '<>': 'différent', '<': 'inférieur', '>': 'supérieur', '=': 'égal'};
DIRE.unshift([/'([^']+)'/g, '$1'], [/(\d)\s*%/g, '$1 pour cent'], [/\s*→\s*/g, ', donne '],
  [/(^|\s)([%_A-Za-zÀ-ÿ]*[%_][%_A-Za-zÀ-ÿ]*)(?=[\s,.;:!?»)]|$)/g, (m, a, w) => /[%_]/.test(w) && !/[A-Za-zÀ-ÿ]_[A-Za-zÀ-ÿ]/.test(w)
    ? a + w.split(/([%_])/).filter(Boolean).map(x => x === '%' ? 'pourcent' : x === '_' ? 'tiret bas' : x).join(', ') : m],
  /* Suivi d’une valeur : « inférieur à 60 », « différent de Accessoire » ; suivi d’un mot de la phrase (« > et < », « != à la place ») : le signe seul. */
  [/\s*(<=|>=|!=|<>|<|>)\s*(?=[A-Za-zÀ-ÿ0-9'«])(?!(?:et|ou|à|est|pas|qui|ni)\b)/g, (m, op) => ' ' + SIGNES[op] + (/^(!=|<>)$/.test(op) ? ' de ' : ' à ')], [/(<=|>=|!=|<>|<|>)/g, op => SIGNES[op]],
  [/(^|\s)=(?=[,.;:])/g, '$1égal']);
DIRE.push([/\b(AS|IN|ON|OR|BY|IS|AND|NOT|ALL|ASC|DESC|DISTINCT|CASE|UNION|LIKE)\b/g, (m, w, off, all) => { const d = MOTS_CLES[w];
    return off === 0 || /[.!?:]\s+$/.test(all.slice(0, off)) && !/:\s+$/.test(all.slice(0, off)) ? d.charAt(0).toUpperCase() + d.slice(1) : d; }],
  [/(^|[^A-Za-zÀ-ÿ])([a-z]+)(?=$|[^A-Za-zÀ-ÿ])/g, (m, a, w) => a + (ACCENTS[w] || w)]);
/* Une phrase qui ne se lit pas telle quelle : sa version dite (la légende, elle, ne change pas). */
const PHRASES = {
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
  '\'%ie%\' renvoie Sophie Martin et Gabriel Michel, dont le prénom contient « ie ».': 'Le motif pourcent, i e, pourcent renvoie Sophie Martin et Gabriel Michel, dont le prénom contient i e.'
};
const dire = s => PHRASES[s] || DIRE.reduce((t, [a, b]) => t.replace(a, b), s);

const intro = (() => {
  const a = page.indexOf('class="abs title"'), seg = page.slice(a, a + 1600);
  const sub = plain((seg.match(/class="abs sub">([\s\S]*?)<\/div>/) || [])[1] || '');
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

const job = {cours, titre: intro.sub, voix: base.voix, modele: base.modele, langue: base.langue, format: base.format, elements: out};
fs.writeFileSync(path.join(DIR, cours + '.json'), JSON.stringify(job, null, 2) + '\n');
/* Les phrases communes : copiées depuis le premier cours (si ses fichiers bruts sont là). */
const src = path.join(DIR, 'sortie', 'bases-relationnelles'), dst = path.join(DIR, 'sortie', cours);
if (fs.existsSync(src)) { fs.mkdirSync(dst, {recursive: true}); for (const id of COMMUNES) for (const x of ['.mp3', '.json']) if (fs.existsSync(path.join(src, id + x)) && !fs.existsSync(path.join(dst, id + x))) fs.copyFileSync(path.join(src, id + x), path.join(dst, id + x)); }
const n = out.filter(e => !COMMUNES.includes(e.id)).reduce((a, e) => a + e.texte.length, 0);
console.log(`${cours} : ${out.length} fichiers (${out.length - COMMUNES.length} à générer, ${COMMUNES.length} repris), environ ${n.toLocaleString('fr-FR')} crédits`);
