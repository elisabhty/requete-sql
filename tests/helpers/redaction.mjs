/* La charte d’écriture d’Elisa, mise en règles.
   ------------------------------------------------------------------------------------------------------------------
   Chaque correction qu’Elisa a demandée sur le texte des cours est ici une RÈGLE : un titre, ce qu’elle a demandé (et
   quand), la vérification, et des exemples bons et mauvais qui sont rejoués à chaque lancement (tests/redaction.test.mjs).
   Une règle qui laisse passer son mauvais exemple, ou qui refuse son bon exemple, fait échouer la suite : les règles
   se vérifient elles-mêmes.

   Les règles s’appliquent à TOUS les chapitres du projet (assets/anim/projet-*.html), y compris ceux qui seront ajoutés :
   la liste des pages est lue dans le dossier, rien n’est à déclarer. Ajouter une règle : une entrée de REGLES (avec au
   moins un bon et un mauvais exemple). Un texte d’Elisa qui déroge à une règle : une entrée de EXCEPTIONS, avec la raison.

   Un texte est décrit par :
     genre  legende (bulle du bas de la vidéo) · consigne (question d’un moment « À toi ») · option (réponse proposée) ·
            correction (explication d’une mauvaise réponse) · indice (aide après deux erreurs) · mail · recap (les
            trois idées à retenir) · etiquette (nom d’un chapitre, titre) · fiche (carte de la leçon dans index.html) ·
            autre (tout autre texte lu par l’élève, trouvé dans la page)
     html   le texte tel qu’il est écrit dans la page (balises, <br>, &nbsp;)
     plain  le texte lu par l’élève : sans balises, les espaces insécables en espaces, et le code (<code>…</code>) remplacé
            par « ⟦code⟧ » (les règles de français ne lisent pas du SQL). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const ANIM = path.join(ROOT, 'assets/anim');
const lire = f => fs.readFileSync(f, 'utf8');
export const CODE = '⟦code⟧';
/* Un trou de gabarit (`Ligne ${n} de la requête`) : une valeur que la page calcule, lue comme un seul mot. */
export const VALEUR = '⟦valeur⟧';

/* ---------- Le texte, tel que l’élève le lit ---------- */
export const lisible = h => String(h)
  .replace(/<code\b[^>]*>[\s\S]*?<\/code>/g, CODE)
  .replace(/<br\s*\/?>/g, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/[\u00a0\u202f]/g, ' ')
  .replace(/\s+/g, ' ').trim();
const mots = t => t.split(' ').filter(Boolean);
const nu = m => m.toLowerCase().replace(/^[(«“"'‹]+/, '').replace(/[.,;:!?»”)›…]+$/, '');
const echappe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------- Ce que raconte l’histoire : les personnes et les ateliers de NutriBoost ---------- */
const html = lire(path.join(ROOT, 'index.html'));
const INSERT_CLIENTS = html.slice(html.indexOf('INSERT INTO clients VALUES'), html.indexOf(';', html.indexOf('INSERT INTO clients VALUES')));
/* Les clients de la base de l’app : [prénom, nom]. Un client est toujours cité par son prénom ET son nom (« Sophie Martin »). */
export const CLIENTS = [...INSERT_CLIENTS.matchAll(/\(\d+,'([^']+)','([^']+)'/g)].map(m => [m[1], m[2]]);
/* Les coachs et le développeur ne sont pas des clients : « Karim », « Moussa » seuls sont permis. */
export const EQUIPE = ['Karim', 'Moussa', 'Salma', 'Julie', 'Diego'];
export const ATELIERS = ['Récupération', 'Pilates', 'Cuisine saine', 'Méditation', 'Yoga du matin'];
export const TABLES = ['clients', 'commandes', 'produits', 'fidelite', 'coachs', 'ateliers', 'inscriptions', 'cartes', 'avis', 'inscriptions_excel'];

/* ---------- Les listes de mots du moteur (assets/anim/core.js) : les mêmes que celles qui évitent les coupes à l’affichage ---------- */
const core = lire(path.join(ANIM, 'core.js'));
const deb = core.indexOf('const SHORT_WORDS'), fin = core.indexOf('const glueShort'), deb2 = core.indexOf('const CAP_GLUE_NEXT'), fin2 = core.indexOf('const CAP_PHRASES');
if (deb < 0 || fin < deb || deb2 < 0 || fin2 < deb2) throw new Error('repères de core.js introuvables (SHORT_WORDS, CAP_GLUE_NEXT)');
const moteur = vm.createContext({});
vm.runInContext(core.slice(deb, fin) + core.slice(deb2, fin2), moteur);
/* Mots qui ne terminent jamais une ligne : articles, prépositions, conjonctions, « toute », « cinq »… */
export const MOTS_COURTS = new Set([...vm.runInContext('SHORT_WORDS', moteur), ...vm.runInContext('CAP_GLUE_NEXT', moteur)]);

/* ---------- Les pages ---------- */
export const pagesProjet = () => fs.readdirSync(ANIM).filter(f => /^projet-.+\.html$/.test(f)).sort();
export const pagesAutres = () => fs.readdirSync(ANIM).filter(f => f.endsWith('.html') && !f.startsWith('projet-')).sort();
const nom = f => f.replace(/\.html$/, '');

/* Les données d’une page du projet (légendes, moments, mails, chapitres), exécutées seules (ni DOM, ni GSAP) :
   de « const SCH = » (ou « const DURATION = ») jusqu’à « /* ---------- Gabarits ». */
export function donnees(file) {
  const src = lire(path.join(ANIM, file));
  const a1 = src.indexOf('const SCH = '), a2 = src.indexOf('const DURATION = '), b = src.indexOf('/* ---------- Gabarits');
  const a = a1 > 0 ? a1 : a2;
  if (a < 0 || b < a) throw new Error(`${file} : données introuvables (const SCH / const DURATION … /* ---------- Gabarits)`);
  const ctx = vm.createContext({APP: true});
  vm.runInContext(src.slice(a, b) + ';this.D = {CAPTIONS, PICKS, MAILS, CHAPTERS, QUESTIONS};', ctx);
  return JSON.parse(JSON.stringify(ctx.D));
}

/* Les légendes des autres vidéos : des lignes « [début, fin, "texte"] » (ou « [début, fin, "texte", 4] »). */
export function legendesLitterales(file) {
  const src = lire(path.join(ANIM, file));
  return [...src.matchAll(/\[\s*[\d.]+,\s*[\d.]+,\s*"((?:[^"\\]|\\.)*)"(?:,\s*(\d))?\s*\]/g)].map(m => ({html: m[1].replace(/\\"/g, '"'), lignes: m[2] ? +m[2] : 3}));
}

/* Les chaînes de texte d’un script : guillemets simples, doubles ou obliques, sans les commentaires. */
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:'"\\`])\/\/.*$/gm, '$1');
export function litteraux(src) {
  const code = sansCommentaires(src), out = [];
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(code))) {
    out.push((m[1] ?? m[2] ?? m[3]).replace(/\\u00a0|\\u202f/gi, ' ').replace(/\\n/g, ' ').replace(/\\(['"`\\])/g, '$1').replace(/\$\{[^}]*\}/g, VALEUR));
  }
  return out;
}
/* Du SQL écrit sans <code> (des <span> colorés dans le balisage) : au moins deux mots-clés en majuscules (« FROM clients INNER JOIN … »). */
const MOTS_SQL = /\b(?:SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|OVER|PARTITION BY|CASE|WHEN|THEN|ELSE|END|UNION|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|CREATE TABLE|ALTER TABLE|ADD COLUMN|RENAME COLUMN|DROP TABLE|DEFAULT|NOT NULL|PRIMARY KEY|FOREIGN KEY|REFERENCES|UNIQUE|CHECK|COALESCE|EXISTS|DISTINCT|COUNT|SUM|AVG|MAX|MIN|INTEGER|TEXT|REAL|DATE)\b/g;
/* Du texte qui se lit (quatre mots au moins, des lettres, pas de code) et non un sélecteur, un nom de fichier, du CSS, du SQL ou un message de SQLite. */
export const estDeLaProse = t => {
  const p = lisible(t);
  return mots(p).length >= 4 && /[a-zà-ÿ]{3}/.test(p) && !/[{};]|=>|function|const |\.querySelector|var\(--|^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|PRAGMA)\b/.test(p)
    && !/rgba?\(|\d ?px\b|:not\(|(^| )[#.][a-z][\w-]*( |$)|\w ?> ?[\w.#:-]|calc\(|cubic-bezier|translate|inset /.test(p)   // ni du CSS : « 0 9px 0 rgba(…) », « #tb-at .hd > span »
    && (p.match(MOTS_SQL) || []).length < 2                                                                           // ni du SQL : « FROM clients INNER JOIN commandes ON … »
    && !/syntax error|no such (?:table|column)|constraint failed|datatype mismatch|ambiguous column/.test(p);        // ni un message d’erreur de SQLite, reproduit tel quel
};
/* Les textes du balisage de la page (hors <script> et <style>) : feuilles qui ne contiennent que du texte et de la mise en forme. */
export function textesDuBalisage(src) {
  const corps = src.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const re = /<(div|p|span|li|h\d|b|i|button|label)\b[^>]*>((?:[^<]|<(?:b|i|code|br|em|strong|span)\b[^>]*>|<\/(?:b|i|code|em|strong|span)>)+)<\/\1>/g;
  const out = []; let m;
  while ((m = re.exec(corps))) out.push(m[2]);
  return out;
}

/* Une page rend-elle en SMS le message d’un client ? Son constructeur de messages passe par smsCard() quand l’étiquette est celle d’un client
   (isSms), et son mailIn() par smsIn(). */
export const rendEnSms = src => /isSms\([^)]*\)\s*\?\s*smsCard\(/.test(src) && /isSms\([^)]*\)[^\n]*\bsmsIn\(/.test(src);

/* Tous les textes d’une page du projet : la structure (légendes, consignes, réponses, corrections, mails, chapitres, récapitulatif),
   puis tout ce que la page écrit d’autre à l’élève (indices, corrections calculées, bulles…), sans doublon. */
export function textes(file) {
  const page = nom(file), src = lire(path.join(ANIM, file)), D = donnees(file), out = [], vus = new Set();
  const ajoute = (genre, h, ou, extra = {}) => {
    if (!h || typeof h !== 'string') return;
    const cle = lisible(h);
    if (!cle || vus.has(cle)) return;
    vus.add(cle);
    out.push({page, genre, ou, html: h, plain: cle, ...extra});
  };
  D.CAPTIONS.forEach((c, k) => ajoute('legende', c[2], `légende ${k + 1}`, {lignes: c[3] || 3, index: k}));
  D.CHAPTERS.forEach((c, k) => ajoute('etiquette', c.label, `chapitre ${k + 1}`));
  D.PICKS.forEach((p, i) => {
    ajoute('consigne', p.prompt, `moment ${i + 1}, consigne`);
    ajoute('indice', p.hint, `moment ${i + 1}, aide`); ajoute('indice', p.next, `moment ${i + 1}, ligne d’aide`);
    (p.options || []).forEach((o, k) => { ajoute('option', o.label, `moment ${i + 1}, réponse ${k + 1}`); ajoute('correction', o.why, `moment ${i + 1}, correction ${k + 1}`); });
  });
  const sms = rendEnSms(src);
  D.MAILS.forEach((m, k) => [].concat(m[4]).forEach((p, j) => ajoute('mail', p, `message ${k + 1}, paragraphe ${j + 1}`, {etiquette: m[2], sms})));
  for (const m of src.matchAll(/<div class="rrow"><div class="rico emo">[^<]*<\/div><div class="rtxt">([\s\S]*?)<\/div><\/div>/g)) {
    const [phrase, precision] = m[1].split('<span class="rs">');
    ajoute('recap', phrase, 'récapitulatif'); if (precision) ajoute('recap', precision.replace(/<\/span>[\s\S]*$/, ''), 'récapitulatif, précision');
  }
  const scripts = [...src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  litteraux(scripts).filter(estDeLaProse).forEach(t => ajoute('autre', t, 'texte de la page'));
  textesDuBalisage(src).filter(estDeLaProse).forEach(t => ajoute('autre', t, 'texte de la page'));
  return out;
}

/* Les textes d’une leçon dans index.html (la fiche : titre, résumé, bulle, récapitulatif), pour les leçons du projet. */
export function textesFiche(idLecon) {
  const a = html.indexOf(`guide({ id:${idLecon},`);
  if (a < 0) throw new Error(`leçon ${idLecon} introuvable dans index.html`);
  /* La fiche s’arrête à la ligne « }) » qui ferme le guide : l’en-tête du module suivant (« titre », « sous ») n’en fait pas partie. */
  const fin = html.indexOf('\n})', a), suite = html.indexOf('guide({ id:', a + 10), bloc = html.slice(a, fin > 0 && (suite < 0 || fin < suite) ? fin + 3 : suite < 0 ? a + 20000 : suite);
  const champs = ['titre', 'résumé'].map(c => [c, bloc.match(new RegExp(`${c}:"((?:[^"\\\\]|\\\\.)*)"`))?.[1]]).filter(c => c[1]);
  const vus = new Set();
  return [...champs.map(([c, h]) => ({ou: c, h})), ...litteraux(bloc).filter(estDeLaProse).map((h, k) => ({ou: `fiche ${k + 1}`, h}))]
    .map(({ou, h}) => ({page: `leçon ${idLecon}`, genre: 'fiche', ou, html: h, plain: lisible(h)}))
    .filter(t => t.plain && !vus.has(t.plain) && vus.add(t.plain));
}
/* Toutes les leçons de index.html : [{id, titre, projet: true si la vidéo est un chapitre du projet}]. */
export function toutesLesLecons() {
  const projet = new Set(leconsDuProjet().map(l => l.id));
  return [...html.matchAll(/guide\(\{ id:(\d+), titre:"([^"]*)"/g)].map(m => ({id: +m[1], titre: m[2], projet: projet.has(+m[1])}));
}

/* Les textes d’une vidéo qui n’est pas un chapitre du projet : ses légendes (« [début, fin, "texte"] »), puis tout ce que la page écrit à l’élève. */
export function textesVideo(file) {
  const page = nom(file), src = lire(path.join(ANIM, file)), out = [], vus = new Set();
  const ajoute = (genre, h, ou, extra = {}) => { const cle = lisible(h); if (!cle || vus.has(cle)) return; vus.add(cle); out.push({page, genre, ou, html: h, plain: cle, ...extra}); };
  legendesLitterales(file).forEach((c, k) => ajoute('legende', c.html, `légende ${k + 1}`, {lignes: c.lignes}));
  const scripts = [...src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  litteraux(scripts).filter(estDeLaProse).forEach(t => ajoute('autre', t, 'texte de la page'));
  textesDuBalisage(src).filter(estDeLaProse).forEach(t => ajoute('autre', t, 'texte de la page'));
  return out;
}

/* Le compte des écarts d’une liste de textes, par règle : {règle: nombre}. Les exceptions de la charte ne comptent pas. */
export function compteParRegle(liste, regles = REGLES.filter(r => !r.projetSeulement)) {
  const compte = {};
  for (const t of liste) for (const r of regles) for (const pb of probleme(r, t)) if (!excepte(r, t, pb)) compte[r.id] = (compte[r.id] || 0) + 1;
  return compte;
}
/* Les leçons du projet : celles dont la vidéo est un chapitre assets/anim/projet-*.html. */
export function leconsDuProjet() {
  const debuts = [...html.matchAll(/guide\(\{ id:(\d+), titre:"([^"]*)"/g)];
  return debuts.map((m, k) => {
    const bloc = html.slice(m.index, k + 1 < debuts.length ? debuts[k + 1].index : m.index + 20000);
    const v = bloc.match(/video:\{anim:'assets\/anim\/(projet-[a-z-]+\.html)/);
    return v ? {id: +m[1], titre: m[2], page: v[1]} : null;
  }).filter(Boolean);
}

/* Le numéro de chapitre d’une page du projet (« Projet · Chapitre 8 » sur son écran titre) ou de la fiche d’une leçon du projet ;
   99 pour tout autre texte (les exemples des règles) : une règle posée « à partir du chapitre N » les regarde. */
const NUMEROS_DE_CHAPITRE = new Map();
export function chapitreDe(page) {
  if (NUMEROS_DE_CHAPITRE.has(page)) return NUMEROS_DE_CHAPITRE.get(page);
  const f = /^leçon \d+$/.test(page) ? leconsDuProjet().find(l => l.id === +page.slice(6))?.page : /^projet-[a-z-]+$/.test(page) ? `${page}.html` : null;
  const m = f && fs.existsSync(path.join(ANIM, f)) ? lire(path.join(ANIM, f)).match(/<div class="tagpill">Projet · Chapitre (\d+)<\/div>/) : null;
  const n = m ? +m[1] : 99;
  NUMEROS_DE_CHAPITRE.set(page, n);
  return n;
}

/* ---------- Les règles ---------- */
/* Une règle : id, titre, demande (ce qu’Elisa a dit, et quand), genres (où elle s’applique ; tous si absent), verifie(texte) → liste de problèmes,
   bon / mauvais : des textes {genre, html} ou des chaînes (genre = le premier de la règle). */
const prose = ['legende', 'consigne', 'correction', 'indice', 'mail', 'recap', 'fiche', 'autre'];
const lignes = h => String(h).split(/<br\s*\/?>/);

export const REGLES = [
  {
    id: 'atelier',
    titre: 'Toujours « l’atelier » devant le nom d’un atelier',
    demande: 'Elisa, 22 octobre : « l’atelier Récupération », jamais « Récupération » seul (idem Pilates, Cuisine saine, Méditation, Yoga du matin).',
    genres: [...prose, 'option'],
    verifie: ({plain, genre}) => {
      if (genre === 'option' && mots(plain).length < 4) return [];   // une étiquette courte à ranger (« Pilates ») n’est pas une phrase
      const pb = [];
      for (const nomAtelier of ATELIERS) for (const m of plain.matchAll(new RegExp(`(?<![\\p{L}-])${echappe(nomAtelier)}(?![\\p{L}-])`, 'gu'))) {
        const avant = plain.slice(Math.max(0, m.index - 10), m.index), apres = plain.slice(m.index + nomAtelier.length);
        if (/atelier $/i.test(avant)) continue;                              // « l’atelier Pilates », « L’atelier Pilates », « un nouvel atelier Yoga du matin »
        if (/^ (?:est|sont) (?:un|une) atelier\b/.test(apres)) continue;     // « Yoga du matin est un atelier » : la phrase dit justement ce que c’est
        pb.push(`« ${nomAtelier} » sans « l’atelier » devant`);
      }
      return pb;
    },
    bon: ['Emma Dubois est inscrite à l’atelier Pilates.', 'Elle choisit l’atelier Cuisine saine ou l’atelier Yoga du matin.', 'L’atelier Pilates a lieu le 17 septembre.',
      'Je propose un nouvel atelier Yoga du matin.', 'Yoga du matin est un atelier.'],
    mauvais: ['Emma Dubois est inscrite à Pilates.', 'Le Yoga du matin est ouvert à tous les clients.', 'Pilates est complet.', 'La ligne de Yoga du matin est vide.']
  },
  {
    id: 'client',
    titre: 'Un client est toujours cité par son prénom et son nom',
    demande: 'Elisa, 22 octobre : « Sophie Martin », pas « Sophie » (dans le cours concerné comme dans les autres). « Karim » ou « Moussa » seuls sont permis : ce ne sont pas des clients.',
    genres: [...prose, 'option'],
    verifie: ({plain}) => {
      const pb = [];
      for (const prenom of new Set(CLIENTS.map(c => c[0])))
        for (const m of plain.matchAll(new RegExp(`(?<![\\p{L}-])(?<!Victor )${echappe(prenom)}(?![\\p{L}-])`, 'gu'))) {
          const suite = plain.slice(m.index + prenom.length).match(/^ (\p{L}+)/u)?.[1];
          if (/(?:deux|trois|quatre|plusieurs) $/.test(plain.slice(0, m.index))) continue;   // « deux Nathan » : un prénom que plusieurs clients partagent
          if (!suite || !CLIENTS.some(c => c[0] === prenom && c[1] === suite)) pb.push(`« ${prenom} » sans son nom`);
        }
      return pb;
    },
    bon: ['Sophie Martin demande une carte.', 'Le mail de Karim arrive : Moussa a besoin de Lucas Bernard.', 'La carte d’Hugo Laurent passe à 18 séances.', 'La table clients compte deux Nathan.'],
    mauvais: ['Sophie demande une carte.', 'La carte d’Hugo passe à 18 séances.', 'Nathan est inscrit.']
  },
  {
    id: 'identifiant',
    titre: '« identifiant », jamais « numéro »',
    demande: 'Elisa, 23 octobre : on dit « l’identifiant » d’un client, d’un atelier… « numéro » ne sert que pour un numéro de téléphone.',
    genres: [...prose, 'option', 'etiquette'],
    verifie: ({plain}) => /\bnuméros?\b/i.test(plain) ? ['« numéro » : écrire « identifiant »'] : [],
    bon: ['Aucun atelier n’a l’identifiant 15.', 'L’identifiant 8 est attribué automatiquement.'],
    mauvais: ['Aucun atelier n’a le numéro 15.', 'Le numéro de l’inscription est attribué automatiquement.']
  },
  {
    id: 'relation',
    titre: '« relation » entre deux tables, pas « lien »',
    demande: 'Elisa, 24 octobre : « une relation « un à plusieurs », notée 1 → N », « relation » plutôt que « lien » entre tables.',
    genres: [...prose, 'option', 'etiquette'],
    verifie: ({plain}) => /(?<![\p{L}-])liens?(?![\p{L}-])/iu.test(plain) ? ['« lien » : écrire « relation »'] : [],
    bon: ['Dans une relation 1 → N, la clé étrangère va du côté « plusieurs ».', 'Elle relie chaque client à un atelier.'],
    mauvais: ['Un lien vers une autre table.', 'Il faut traduire les relations en liens entre les tables.']
  },
  {
    id: 'sans-personnification',
    titre: 'Ni SQL, ni la table, ni la base, ni une erreur ne font d’actions de personne',
    demande: 'Elisa : ne jamais personnifier SQL ni les tables (« SQL voit », « SQL ne sait pas », « la table accepte »…). Tournures passives : « est refusée », « est attribué automatiquement » ; « la requête contient », « le résultat », « SQL compare ».',
    genres: [...prose, 'option', 'etiquette'],
    verifie: ({plain}) => {
      const pb = [];
      const sujets = `(?:SQL|la table(?: (?:${TABLES.join('|')}))?|les tables|la base|la base de données|la requête|le serveur|le moteur|la contrainte|la colonne|une erreur|l’erreur|aucune erreur|le message d’erreur)`;
      const verbes = '(?:voit|voient|comprend|sait|savent|lit|lisent|accepte|acceptent|crée|créent|refuse|refusent|connaît|pense|croit|réagit|répond|ajoute|modifie|supprime|veut|décide|avertit|préviennent|prévient|signale)';
      // « la table clients le sait » : le nom de la table (dans le sujet) et un pronom peuvent s’intercaler
      for (const m of plain.matchAll(new RegExp(`(?<![\\p{L}-])${sujets}(?: (?:le|la|les|l’|en|y|lui))? (?:ne |n’)?${verbes}(?![\\p{L}-])`, 'giu'))) pb.push(`« ${m[0]} »`);
      if (/on lui demande|la réaction de SQL/i.test(plain)) pb.push('« on lui demande » / « la réaction de SQL »');
      return pb;
    },
    bon: ['L’inscription est refusée : l’atelier est obligatoire.', 'Un identifiant déjà pris est refusé.', 'SQL compare les deux valeurs.', 'La requête contient trois valeurs.', 'La table clients contient dix lignes.'],
    mauvais: ['SQL voit les trois valeurs.', 'La table accepte la ligne.', 'La base refuse l’inscription.', 'Aucune erreur n’avertit : l’oubli passe inaperçu.', 'SQL ne sait pas qui est le client.', 'La table clients le sait.', 'La table clients refuse la ligne.']
  },
  {
    id: 'table-gras',
    titre: 'Dans une bulle ou une correction : « la <b>table clients</b> » en gras, jamais le nom de la table seul',
    demande: 'Elisa, 15 et 22 octobre : toujours « la table clients », jamais le nom de table seul dans le texte ; en gras dans les légendes et les corrections ; si plusieurs tables sont nommées, toutes en gras ou aucune ; un nom tapé (code) reste en <code>.',
    genres: ['legende', 'correction', 'indice'],
    verifie: ({html: h}) => {
      const pb = [], sansCode = h.replace(/<code\b[^>]*>[\s\S]*?<\/code>/g, CODE);
      const noms = TABLES.join('|');
      const nus = [], gras = [];
      for (const m of sansCode.matchAll(new RegExp(`table(?:&nbsp;|[\\s\\u00a0])(${noms})(?![\\p{L}_])`, 'gu'))) {
        const avant = sansCode.slice(0, m.index), ouvre = avant.lastIndexOf('<b>'), ferme = avant.lastIndexOf('</b>');
        (ouvre > ferme ? gras : nus).push(m[1]);
      }
      if (nus.length && gras.length) pb.push('plusieurs tables nommées : toutes en gras, ou aucune');
      for (const n of nus) if (!gras.length) pb.push(`« table ${n} » : le nom de la table se met en gras`);
      const sansBalise = lisible(sansCode);
      for (const m of sansBalise.matchAll(new RegExp(`(?<![\\p{L}_-])(?:dans|sur|vers|depuis) (${noms})(?![\\p{L}_])`, 'gu'))) pb.push(`« ${m[0]} » : écrire « la table ${m[1]} »`);
      return pb;
    },
    bon: [{genre: 'legende', html: 'La <b>table&nbsp;clients</b> enregistre chaque client une seule fois.'},
      {genre: 'legende', html: 'Les tables <code>ateliers</code> et <code>cartes</code><br>font référence à <code>coachs</code>.'},
      {genre: 'correction', html: 'Aucune table ne fait référence à la <b>table&nbsp;inscriptions</b>.'},
      {genre: 'legende', html: 'La <b>table clients</b> et la <b>table commandes</b> sont reliées.'}],
    mauvais: [{genre: 'legende', html: 'La table clients enregistre chaque client une seule fois.'},
      {genre: 'legende', html: 'La <b>table clients</b> est reliée à la table commandes.'},
      {genre: 'correction', html: 'On ajoute une ligne dans inscriptions.'}]
  },
  {
    id: 'ou-trouver',
    titre: 'Pour dire où trouver une information : une tournure parlée',
    demande: 'Elisa, 22 octobre : « Pour ce calcul, on commence par récupérer la quantité commandée pour chacune des 16 commandes dans la table commandes », pas « … est à rechercher dans la table … ».',
    genres: [...prose, 'etiquette'],
    verifie: ({plain}) => /à rechercher/i.test(plain) ? ['« à rechercher » : une tournure parlée (« on commence par récupérer … dans … »)'] : [],
    bon: ['On commence par récupérer la date dans la table ateliers.'],
    mauvais: ['La date est à rechercher dans la table ateliers.']
  },
  {
    id: 'vocabulaire-relations',
    titre: '« Dans une relation 1 → N », « table d’association »',
    demande: 'Elisa, 23 octobre : « Dans une relation 1 → N » (pas « En 1 → N ») ; « table d’association » (pas « table de jointure »).',
    genres: [...prose, 'option', 'etiquette'],
    verifie: ({plain}) => {
      const pb = [];
      if (/(^|[.!?:,;] )En (?:1|N|n) ?[→↔]/.test(plain)) pb.push('« En 1 → N » : écrire « Dans une relation 1 → N »');
      if (/table de (?:jointure|liaison)/i.test(plain)) pb.push('« table de jointure » : écrire « table d’association »');
      return pb;
    },
    bon: ['Dans une relation N ↔ N, une table d’association relie les deux tables.'],
    mauvais: ['En 1 → N, la clé étrangère va du côté « plusieurs ».', 'Une table de jointure relie les deux tables.']
  },
  {
    id: 'elision',
    titre: 'Élision devant un prénom : « d’Hugo Laurent »',
    demande: 'Elisa, 24 octobre : « la carte d’Hugo Laurent », « d’Emma Dubois », « d’Inès Lefebvre » : « de » s’élide devant une voyelle ou un h muet.',
    genres: [...prose, 'option'],
    verifie: ({plain}) => {
      const pb = [], voyelles = [...new Set(CLIENTS.map(c => c[0]).filter(p => /^[AEIOUÉÈÊÀÂÎÔÛH]/i.test(p)))];
      for (const p of voyelles) for (const m of plain.matchAll(new RegExp(`(?<![\\p{L}’-])(de|que|ne|se|le|la) ${p}(?![\\p{L}-])`, 'gu'))) pb.push(`« ${m[0]} » : élision devant ${p}`);
      return pb;
    },
    bon: ['La carte d’Hugo Laurent passe à 18 séances.', 'Le mail d’Inès Lefebvre.', 'La date de Sophie Martin.'],
    mauvais: ['La carte de Hugo Laurent passe à 18 séances.', 'Le mail de Inès Lefebvre.']
  },
  {
    id: 'typographie',
    titre: 'Typographie française : apostrophe courbe, « … », guillemets « », pas de point de suspension à trois points',
    demande: 'Elisa, 22 octobre : un texte ne se coupe pas mal et se lit bien (apostrophes ’, guillemets « », espaces insécables avant : ; ! ? »).',
    genres: [...prose, 'option', 'etiquette'],
    verifie: ({plain, html: h}) => {
      const pb = [];
      if (/\p{L}'\p{L}/u.test(plain)) pb.push('apostrophe droite : écrire ’');
      if (/\.\.\./.test(plain)) pb.push('trois points : écrire …');
      if (/"/.test(plain)) pb.push('guillemets droits : écrire « »');
      if (/\S {2,}\S/.test(h.replace(/<[^>]+>/g, ''))) pb.push('deux espaces à la suite');
      if (/\s[,.]/.test(plain.replace(CODE, 'x'))) pb.push('espace avant une virgule ou un point');
      return pb;
    },
    bon: ['L’atelier est complet : c’est « Pilates ».', 'Il manque une valeur…'],
    mauvais: ["L'atelier est complet.", 'Il manque une valeur...', 'Le mot "atelier" est obligatoire.', 'Il y a deux  espaces.', 'Une virgule , mal placée.']
  },
  {
    id: 'consigne-autonome',
    titre: 'Une question se suffit : elle ne renvoie ni à « cette requête », ni à « ci-dessus », ni à « ci-dessous »',
    demande: 'Elisa, 24 octobre : sur un petit écran, le plateau des réponses recouvre le bas de l’image : la question ne doit pas renvoyer à ce qu’on ne voit plus.',
    genres: ['consigne'],
    verifie: ({plain}) => /cette requête|ci-dessus|ci-dessous|ci-contre/i.test(plain) ? ['la consigne renvoie à l’image'] : [],
    bon: ['Quelle fin de requête ajoute 10 séances à la carte d’Hugo Laurent ?'],
    mauvais: ['Que fait cette requête ?', 'Touche la ligne fautive ci-dessus.']
  },
  {
    id: 'legende-phrase',
    titre: 'Une bulle : une phrase courte et complète, qui commence comme une phrase et finit par . ! ? ou »',
    demande: 'Elisa, 23 octobre : une seule phrase courte et complète par bulle ; elle commence comme une phrase (majuscule) et finit par . ! ? ou ». ' +
      'Elisa, 24 octobre : plusieurs bulles courtes plutôt qu’un long texte (« pas à lire tout d’un coup mais séparé en plusieurs bulles pour améliorer la lecture et la concentration ») : ' +
      '« complète » ne veut pas dire « longue » ; une explication se découpe en une phrase par bulle, jamais en morceaux d’une même phrase.',
    genres: ['legende'],
    verifie: ({plain, html: h}) => {
      const pb = [];
      const debut = plain.startsWith(CODE) || /^[A-ZÀ-ÖØ-Þ0-9«]/.test(plain);
      if (!debut) pb.push('commence par une minuscule');
      if (!/[.!?»]$/.test(plain)) pb.push('ne finit pas comme une phrase (. ! ? »)');
      if (/[.!?»] ?[A-ZÀ-ÖØ-Þ«]/.test(plain.replace(/\.\.\*?/g, ''))) pb.push('plus d’une phrase');
      if (/^À toi/.test(plain) && plain !== 'À toi !') pb.push('« À toi ! » annonce le moment, sans autre mot (la consigne est dans la carte)');
      return pb;
    },
    bon: ['Une inscription est une ligne de la table inscriptions.', 'À toi !', '<code>UPDATE</code> indique la table à modifier.', 'Imagine que tu oublies le <code>WHERE</code>.',
      'Jusqu’ici, Karim, le développeur, s’est chargé d’ajouter les données dans les tables de NutriBoost.', 'À ton tour de prendre la main !', 'Et si tu oublies de préciser l’atelier dans ta requête ?'],
    mauvais: ['une inscription est une ligne.', 'Une inscription est une ligne', 'Une inscription est une ligne. Elle contient une date.', 'À toi de jouer !']
  },
  {
    id: 'legende-lignes',
    titre: 'Une bulle tient en trois lignes au plus : une phrase plus longue devient deux bulles (jamais de bulle de quatre lignes)',
    demande: 'Elisa, 23 octobre : pas de bulle de plus de trois lignes. ' +
      'Elisa, 24 octobre (Réf 2) : « t’aurais pu découper en plusieurs bulles → modifier le contrôle » : la 4e valeur de la légende (la bulle de quatre lignes) n’existe plus ; ' +
      'une phrase trop longue se coupe en deux bulles, une phrase complète chacune, avec ses mots à elle.',
    genres: ['legende'],
    verifie: ({html: h, lignes: n}) => {
      const pb = [];
      if (lignes(h).length > 3) pb.push(`${lignes(h).length} lignes : trois au plus, sinon deux bulles`);
      if ((n || 3) > 3) pb.push('la 4e valeur de la légende (quatre lignes) n’existe plus : découper en deux bulles');
      return pb;
    },
    bon: [{genre: 'legende', html: 'a<br>b<br>c', lignes: 3}, {genre: 'legende', html: 'a<br>b', lignes: 3}, 'a'],
    mauvais: [{genre: 'legende', html: 'a<br>b<br>c<br>d', lignes: 3}, {genre: 'legende', html: 'a<br>b<br>c<br>d', lignes: 4}, {genre: 'legende', html: 'a<br>b<br>c', lignes: 4}]
  },
  {
    id: 'coupes',
    titre: 'Une ligne ne finit pas sur un mot court, ne commence pas par une ponctuation, et ne coupe pas un groupe de mots',
    demande: 'Elisa : « il faut la / virgule » : pas de mot orphelin ou de ponctuation seule en bout de ligne, pas de groupe de mots coupé (« Sophie / Martin », « l’atelier / Pilates », « la table / clients », « back / end », « cinq / ateliers »).',
    genres: ['legende', 'recap', 'mail', 'indice', 'correction', 'autre', 'fiche'],
    verifie: ({html: h}) => {
      const pb = [], ls = lignes(h);
      ls.forEach((l, i) => {
        if (i === ls.length - 1) return;
        const a = lisible(l), b = lisible(ls[i + 1]);
        if (!a || !b) return;
        const dernier = nu(mots(a).pop());
        if (MOTS_COURTS.has(dernier)) pb.push(`« ${dernier} » finit la ligne ${i + 1}`);
        if (/^[:;!?»,.)%]/.test(b)) pb.push(`la ligne ${i + 2} commence par « ${b[0]} »`);
        if (/[«(]$/.test(a)) pb.push(`la ligne ${i + 1} finit par « ${a.slice(-1)} »`);
        const suite = nu(mots(b)[0] || '');
        for (const [prenom, nomFamille] of CLIENTS) if (nu(mots(a).pop()) === prenom.toLowerCase() && suite === nomFamille.toLowerCase()) pb.push(`« ${prenom} ${nomFamille} » coupé entre deux lignes`);
        if (/(^| )(l’|d’)?atelier$/.test(a) && ATELIERS.some(n => b.startsWith(n))) pb.push('« l’atelier » coupé de son nom');
        if (/(^| )table$/.test(a) && TABLES.some(n => b.startsWith(n))) pb.push('« table » coupé du nom de la table');
        if (/(^| )(back|clé|clés)$/.test(a) && /^(end|primaire|primaires|étrangère|étrangères)/.test(b)) pb.push(`« ${mots(a).pop()} ${mots(b)[0]} » coupé entre deux lignes`);
        if (/\d$/.test(a) && /^(séances?|lignes?|ateliers?|clients?|cartes?|colonnes?|tables?|valeurs?|fois|jours|ans|commandes?|produits?|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/.test(b)) pb.push('un nombre coupé de ce qu’il compte');
      });
      for (const m of h.matchAll(/<b\b[^>]*>([\s\S]*?)<\/b>/g)) if (/<br\s*\/?>/.test(m[1])) pb.push('un saut de ligne dans un passage en gras');
      return pb;
    },
    bon: ['Hugo Laurent a déjà une carte,<br>et une seule carte par client<br>est autorisée.', 'Jusqu’ici, Karim,<br>le développeur back end,<br>a rempli les tables.', 'La date de l’atelier Pilates<br>est écrite dans la <b>table ateliers</b>.',
      'Jusqu’ici, Karim, le développeur,<br>s’est chargé d’ajouter les données<br>dans les tables de NutriBoost.', 'Et si tu oublies de préciser<br>l’atelier dans ta requête ?'],
    mauvais: ['Il faut la<br>virgule.', 'Chaque solde augmente de 2 :<br>10 devient 12<br>, puis 5.', 'Pour inscrire Sophie<br>Martin à l’atelier Pilates.', 'Une carte pour l’atelier<br>Pilates est créée.', 'On lit la<br>table clients.', 'Le développeur back<br>end a rempli les tables.', 'Elle contient 12 pour chacun des cinq<br>ateliers déjà enregistrés.', 'Une <b>table<br>clients</b> existe.', 'Il a acheté 10<br>séances.']
  },
  {
    id: 'recap-sans-numero',
    titre: 'Un récapitulatif : des titres sans numéro (« 1. », « 2. », « 3. »)',
    demande: 'Elisa, 24 octobre (Réf 1 et 10) : « dans cette partie, ne jamais mettre les 1. 2. 3. » : les trois idées à retenir se lisent à la suite, chacune avec son titre (« Ajouter une ligne », « Ajouter plusieurs lignes », « Gérer un doublon »), sans la numéroter.',
    genres: ['recap', 'fiche', 'autre'],   // « autre » : le récapitulatif des vidéos qui ne sont pas des chapitres du projet (« Quel JOIN choisir ? » était numéroté)
    verifie: ({plain}) => /^\d+ ?[.)] /.test(plain) ? ['le titre commence par un numéro : l’enlever'] : [],
    bon: ['Ajouter une ligne', 'Créer une table', 'Définir les règles', '3 colonnes suffisent pour cette table.'],
    mauvais: ['1. Ajouter une ligne', '2) Ajouter plusieurs lignes', '3. Gérer un doublon']
  },
  {
    id: 'registre-parle',
    titre: 'Un ton parlé : on s’adresse à l’élève à voix haute (« tu », des verbes d’action), pas avec des tournures écrites ou administratives',
    demande: 'Elisa, 24 octobre : « j’ai les phrases un peu plus parlées » : « Jusqu’ici, Karim, le développeur, s’est chargé d’ajouter les données dans les tables de NutriBoost. À ton tour de prendre la main ! », ' +
      '« Est-ce que tu pourrais prendre le relais pendant mon absence ? », « Et si tu oublies de préciser l’atelier dans ta requête ? ». Puis, à 22 h 29, sur le chapitre 8 : « Tu n’écris pas comme moi j’aime, j’ai l’impression (parlé) », ' +
      'avec ses mots : « Pour les traiter, tu vas modifier des informations dans des lignes existantes avec la commande SQL UPDATE. », « Résultat : les cinq ateliers sont désormais programmés le 18 septembre ! », ' +
      '« Pense à vérifier ce nombre après chaque mise à jour ! », « SET précise les colonnes à modifier et leurs nouvelles valeurs ; WHERE sélectionne les lignes concernées. ». ' +
      'Tutoiement, questions, exclamations, mots de tous les jours : ni « veuillez », ni « il convient de », ni « afin de », ni « procéder à »… ' +
      'À partir du chapitre 7 : pas de phrase qui commence par « Reste à », « Ici, pas de » ou « Or » ; un mot SQL ne « indique » ni ne « désigne » (« SET précise », « WHERE sélectionne ») ; pas de « peut être exécuté » (« tu peux exécuter »).',
    genres: [...prose, 'option'],
    projetSeulement: true,   // une règle prudente, posée le 24 octobre : elle ne regarde que les chapitres du projet (les anciens cours seront remplacés par les chapitres 11 à 16)
    depuisChapitre: 7,       // la partie « stricte » : les chapitres 1 à 6 seront repassés avec Elisa ; les chapitres 7 et suivants (et ceux à venir) la respectent déjà
    verifie(t) {
      const pb = [];
      for (const m of t.plain.matchAll(/(?<![\p{L}-])(?:veuillez|il convient|afin (?:de|d’|que|qu’)|procéd(?:er|ez|ons)|nous vous|je vous|ci-joint|ci-après|susmentionn\p{L}*|dudit|ledit|préalablement|ultérieurement|le cas échéant|en vue de|au sein de|il est (?:nécessaire|impératif|recommandé|préférable) de)(?![\p{L}-])/giu)) pb.push(`« ${m[0]} » : une tournure écrite, à dire autrement`);
      if (chapitreDe(t.page) < this.depuisChapitre || t.genre === 'mail') return pb;   // un mail est écrit par son auteur, pas dit à l’élève
      /* Une phrase écrite plutôt que dite : « Reste à écrire… », « Ici, pas de WHERE », « Or… ». */
      for (const m of t.plain.matchAll(/(?:^|[.!?:;»] )(Reste à|Ici, pas d(?:e|’)|Or(?=[ ,]))/gu)) pb.push(`« ${m[1]}… » en début de phrase : une phrase écrite, à dire avec « tu » (« Maintenant, tu écris… », « Avec WHERE, tu… »)`);
      /* Un mot SQL fait quelque chose : « SET précise », « WHERE sélectionne ». Il n’« indique » ni ne « désigne » (mots d’Elisa, récapitulatif du chapitre 8). */
      const brut = String(t.html).replace(/&nbsp;|[\u00a0\u202f]/g, ' ').replace(/<br\s*\/?>/g, ' ');
      for (const m of brut.matchAll(/<code>(WHERE|SET|UPDATE|DELETE FROM|INSERT INTO|VALUES|SELECT|DROP TABLE|ALTER TABLE|CREATE TABLE|ON DELETE|CASCADE|SET NULL|RESTRICT)<\/code> (?:ne |n’)?(indique|indiquent|désigne|désignent|représente|représentent)(?![\p{L}-])/giu))
        pb.push(`« ${m[1]} ${m[2]} » : un mot SQL agit (« SET précise… », « WHERE sélectionne… »), il n’« indique » ni ne « désigne »`);
      /* Un passif à la place d’un « tu » : « peut être exécuté » → « tu peux exécuter ». */
      if (['legende', 'recap', 'consigne'].includes(t.genre))
        for (const m of t.plain.matchAll(/(?<![\p{L}-])(?:peut|peuvent|doit|doivent) être (?:\p{L}+(?:é|ée|és|ées)|fait|faite|faits|faites|écrit|écrite|écrits|écrites|pris|prise|prises|mis|mise|mises|lu|lue|lus|lues|vu|vue|vus|vues|ouvert|ouverte|ouverts|ouvertes|compris|comprise|comprises|inclus|incluse|incluses|perdu|perdue|perdus|perdues|rendu|rendue|rendus|rendues|choisi|choisie|choisis|choisies|rempli|remplie|remplis|remplies)(?![\p{L}-])/giu))
          pb.push(`« ${m[0]} » : un passif, à dire avec « tu » ou avec l’action (« tu peux exécuter… »)`);
      return pb;
    },
    bon: ['Jusqu’ici, Karim, le développeur, s’est chargé d’ajouter les données dans les tables de NutriBoost.', 'À ton tour de prendre la main !', 'Est-ce que tu pourrais prendre le relais pendant mon absence ?',
      'Et si tu oublies de préciser l’atelier dans ta requête ?', 'Je te confie une première tâche, encore en attente dans mon planning et assez urgente.', 'Merci pour ton aide !',
      'Pour les traiter, tu vas modifier des informations dans des lignes existantes avec la commande SQL <code>UPDATE</code>.', 'Résultat : les cinq ateliers sont désormais programmés le 18 septembre !',
      'Pense à vérifier ce nombre après chaque mise à jour !', 'La ligne est la bonne :<br>tu peux exécuter l’<code>UPDATE</code>.', 'Avec <code>WHERE</code>, tu sélectionnes<br>la ligne à supprimer.',
      '<code>NULL</code> ne désigne aucun client :<br>la clé étrangère n’a rien à vérifier.', 'Une colonne unique peut être vide.',
      {genre: 'recap', html: '<code>UPDATE</code> modifie les valeurs de lignes déjà présentes. <code>SET</code> précise les colonnes à modifier et leurs nouvelles valeurs ; <code>WHERE</code> sélectionne les lignes concernées.'}],
    mauvais: ['Veuillez prendre le relais durant mon absence.', 'Il convient de relire les valeurs avant l’exécution.', 'Afin d’enregistrer l’inscription, procédez à l’ajout d’une ligne.', 'Je vous prie de bien vouloir ajouter cette ligne.', 'Le cas échéant, relis les valeurs.',
      'Reste à écrire la requête qui retire la copie.', 'Ici, pas de <code>WHERE</code> :<br>on modifie toutes les cartes.', 'Le solde est de 7. Or le retrait est de 8.', '<code>DELETE FROM</code> indique la table<br>dont on supprime des lignes.',
      'La ligne est la bonne :<br>l’<code>UPDATE</code> peut être exécuté.', {genre: 'recap', html: '<code>SET</code> indique la colonne et la nouvelle valeur ; <code>WHERE</code> désigne les lignes concernées.'}]
  }
];

/* ---------- Les règles qui regardent toute la vidéo d’un coup ---------- */
/* Une règle de page : verifie(textes de la page) → [{texte, probleme}] (le texte fautif est celui qui répète), bon / mauvais : des listes de textes {genre, html}. */
export const REGLES_DE_PAGE = [
  {
    id: 'imagine-une-fois',
    titre: '« Imagine » une seule fois par vidéo : ensuite, « Et si… ? » ou une question',
    demande: 'Elisa, 24 octobre (Réf 5) : « répétition de imagine » : « Et si tu oublies de préciser l’atelier dans ta requête ? » à la place d’un deuxième « Imagine que… » ; ' +
      'la même idée, dite autrement : « Et si quatre clients achètent un pack de 10 séances ? », « Que se passe-t-il si tu oublies la date ? ».',
    genres: ['legende', 'consigne', 'indice', 'correction'],
    verifie(textes) {
      const vus = textes.filter(t => this.genres.includes(t.genre) && /(?<![\p{L}-])imagin(?:e|ons|ez)(?![\p{L}-])/iu.test(t.plain));
      return vus.slice(1).map(t => ({texte: t, probleme: `« Imagine » déjà écrit (« ${vus[0].plain.slice(0, 45)}… ») : écrire « Et si… ? » ou une question`}));
    },
    bon: [[{genre: 'legende', html: 'Imagine que tu inverses<br>les deux premières valeurs.'}, {genre: 'legende', html: 'Et si tu oublies de préciser<br>l’atelier dans ta requête ?'}, {genre: 'legende', html: 'Que se passe-t-il<br>si tu oublies la date ?'}]],
    mauvais: [[{genre: 'legende', html: 'Imagine que tu inverses les deux premières valeurs.'}, {genre: 'legende', html: 'Imagine que tu oublies l’atelier.'}],
      [{genre: 'legende', html: 'Imaginons une colonne atelier_id.'}, {genre: 'consigne', html: 'Imagine une valeur pour chaque colonne.'}]]
  },
  {
    id: 'client-par-sms',
    titre: 'Un client écrit par SMS (notification, puis conversation de l’iPhone), jamais par mail',
    demande: 'Elisa, 24 octobre : « Quand c’est des clients, faire plutôt des messages SMS immersifs, crédibles, iPhone iOS. » Un coach, l’équipe, l’accueil ou le développeur écrivent par mail ; ' +
      'un client écrit par SMS : la page crée sa carte avec smsCard() et la joue avec smsIn() (assets/anim/core.js), à la place de la carte de mail.',
    genres: ['mail'],
    verifie(textes) {
      const vus = new Set();
      return textes.filter(t => t.genre === 'mail' && /^client/.test(t.etiquette || '') && !t.sms && !vus.has(t.ou.split(',')[0]) && vus.add(t.ou.split(',')[0]))
        .map(t => ({texte: t, probleme: `le message d’un client (« ${t.etiquette} ») est une carte de mail : il s’écrit par SMS (smsCard, smsIn)`}));
    },
    bon: [[{genre: 'mail', html: 'Je ne pourrai pas venir à l’atelier.', etiquette: 'cliente', sms: true}, {genre: 'mail', html: 'Mon adresse e-mail a changé.', etiquette: 'coach', sms: false}],
      [{genre: 'mail', html: 'Nous lançons une carte de membre.', etiquette: 'équipe', sms: false}, {genre: 'mail', html: 'Peux-tu supprimer mon compte ?', etiquette: 'client', sms: true}]],
    mauvais: [[{genre: 'mail', html: 'Je ne pourrai pas venir à l’atelier.', etiquette: 'cliente', sms: false}],
      [{genre: 'mail', html: 'Peux-tu supprimer mon compte ?', etiquette: 'client', sms: false}, {genre: 'mail', html: 'Mon adresse e-mail a changé.', etiquette: 'coach', sms: false}]]
  }
];

/* ---------- Les exceptions : des textes d’Elisa (ou approuvés par elle) qui dérogent à une règle ---------- */
/* regle : id de la règle ; page : nom de la page (projet-uml) ou « leçon 12 » ; contient : un bout du texte lu (absent : toute la page) ; raison : pourquoi ;
   aConfirmer : ce qu’il faut demander à Elisa (la suite l’affiche à chaque lancement).
   Une exception qui ne sert plus (le texte a changé) fait échouer la suite : la liste reste juste. */
export const EXCEPTIONS = [
  /* Un mot qui est le bon mot ici */
  {regle: 'identifiant', page: 'projet-alter',
    raison: 'Le chapitre 4 parle des numéros de téléphone des coachs : « numéro » est le bon mot (il ne sert que pour un téléphone).'},
  {regle: 'atelier', page: 'projet-normaliser', contient: 'Quatre ateliers bien-être arrivent',
    raison: 'Énumération des quatre ateliers, introduite par « Quatre ateliers bien-être » (les noms y sont en minuscules, « Pilates » en majuscule).'},
  {regle: 'relation', page: 'projet-cles', contient: 'ligne par lien',
    raison: 'Mots d’Elisa : ici « lien » désigne une ligne de la table d’association (un client relié à un atelier), pas la relation entre deux tables.'},
  {regle: 'relation', page: 'leçon 72', contient: 'ligne par lien',
    raison: 'Même phrase que dans la vidéo du chapitre 2 (récapitulatif), mots d’Elisa : « lien » désigne une ligne de la table d’association.'},
  {regle: 'relation', page: 'projet-uml', contient: 'au lien entre un client et un atelier',
    raison: 'Mots d’Elisa : « le lien entre un client et un atelier » est une inscription (une ligne), pas la relation entre deux tables.'},
  {regle: 'client', page: 'projet-delete', contient: "WHERE prenom = 'Nathan'",
    raison: 'Une fin de requête SQL (réponse fausse du moment 3), pas une phrase : la condition sur le prénom seul désigne les deux Nathan, c’est justement le piège.'},
  /* Des mots d’Elisa qu’elle a confirmés */
  {regle: 'client', page: 'projet-insert', contient: 'Pour enregistrer l’inscription de Lucas,',
    raison: 'Mots d’Elisa (24 octobre, Réf 4), confirmés par elle le soir même (« Lucas seul ») : juste après le mail de Karim qui nomme Lucas Bernard en entier.'},
  {regle: 'client', page: 'projet-update', contient: 'Nathan conserve ses 7 séances',
    raison: 'Mots d’Elisa (24 octobre, 22 h 29, Réf 6) : « Nathan conserve ses 7 séances », juste après « Nathan Petit » (légende et mail de l’accueil).'},
  {regle: 'client', page: 'projet-delete', contient: 'Léa ne pourra pas venir.',
    raison: 'Mots d’Elisa (25 octobre, 00 h 21) : le SMS de l’accueil dit « Léa ne pourra pas venir », et c’est l’aperçu de la notification ; les moments qui suivent nomment Léa Simon en entier.'},
  /* Les mots d’Elisa écrits avant sa consigne : à lui redemander */
  {regle: 'client', page: 'projet-cles', contient: 'Pour inscrire Sophie à l’atelier Méditation', aConfirmer: '« Sophie Martin » ?',
    raison: 'Mots d’Elisa (22 octobre, réponse du moment 5), juste après la question qui nomme Sophie Martin en entier.'},
  {regle: 'client', page: 'projet-cles', contient: 'l’identifiant de Sophie (1)', aConfirmer: '« Sophie Martin (1) » ?',
    raison: 'Mots d’Elisa : « Sophie (1), celui de l’atelier (4) » : le moment 5 vient de nommer Sophie Martin.'},
  {regle: 'client', page: 'projet-cles', contient: 'Sophie ayant déjà une carte', aConfirmer: '« Sophie Martin ayant déjà une carte » ?',
    raison: 'Mots d’Elisa (22 octobre, la contrainte UNIQUE).'},
  {regle: 'relation', page: 'projet-uml', contient: 'Pour comprendre ces liens', aConfirmer: '« ces relations » ?',
    raison: 'Texte d’Elisa du 23 octobre, avant sa consigne du 24 (« relation » plutôt que « lien » entre tables).'},
  {regle: 'relation', page: 'projet-uml', contient: 'en liens entre ces tables', aConfirmer: 'quel mot, puisque « les relations du diagramme en relations » se répéterait (« en clés étrangères entre ces tables » ?)',
    raison: 'Texte d’Elisa du 23 octobre : « traduire les relations du diagramme en liens entre ces tables » ; remplacer « liens » par « relations » répéterait le mot.'}
];

/* ---------- La dette : ce qui reste à reprendre dans les anciens cours ---------- */
/* Un compte par page et par règle : le nombre d’écarts que la charte trouve encore dans les vidéos qui ne sont pas des chapitres du projet et dans les
   leçons en texte (relevé du 24 octobre). C’est un PLAFOND : le test refuse un écart de plus, et signale ceux qui ont disparu (à retirer d’ici).
   Les chapitres 9 à 16 du projet remplaceront les anciens cours : ils sont, eux, vérifiés sans aucune tolérance (tests/redaction.test.mjs, partie 2). */
export const DETTE = {
  videos: {
    'and-or': {'legende-phrase': 1, typographie: 1, coupes: 1},
    'as': {typographie: 3},
    'bases-relationnelles': {'table-gras': 3, client: 2, relation: 1, 'legende-phrase': 1},
    'between': {identifiant: 3},
    'case': {'legende-phrase': 3},
    'coalesce': {elision: 4, 'legende-phrase': 7, coupes: 1, identifiant: 1, typographie: 1},
    'comparer': {'legende-phrase': 1},
    'conversion-types': {identifiant: 9, 'legende-phrase': 9},
    'count': {'table-gras': 2, client: 2},
    'cross-join': {'legende-phrase': 4, relation: 1},
    'distinct': {client: 3, 'legende-phrase': 1},
    'exists': {'legende-phrase': 17, client: 4, relation: 2, coupes: 1},
    'fenetres-glissantes': {'legende-phrase': 4},
    'fonctions-dates': {'legende-phrase': 3, identifiant: 3},
    'fonctions-rang': {'legende-phrase': 1, identifiant: 5, coupes: 1},
    'fonctions-texte': {client: 4, identifiant: 2},
    'full-outer-join': {'legende-phrase': 6, identifiant: 4},
    'group-by': {'legende-phrase': 3},
    'group-concat': {'legende-phrase': 9},
    'inner-join': {'legende-phrase': 2, 'table-gras': 1},
    'intersect-except': {'legende-phrase': 2},
    'join-group-by': {'legende-phrase': 3, 'table-gras': 4},
    'jointure-3-tables': {'legende-phrase': 8, 'table-gras': 6, relation: 4, client: 1},
    'lag-lead': {'legende-phrase': 2, coupes: 1, client: 5},
    'left-join': {'legende-phrase': 2, 'table-gras': 1},
    'like': {client: 2, 'legende-phrase': 1, typographie: 1},
    'limit-offset': {'legende-phrase': 2},
    'normalisation': {'legende-phrase': 3, 'table-gras': 3},
    'not': {'legende-phrase': 1},
    'null': {'legende-phrase': 2},
    'over': {'legende-phrase': 12},
    'plusieurs-conditions-on': {'legende-phrase': 3, 'table-gras': 1, coupes: 1},
    'quel-join-choisir': {identifiant: 1, 'legende-phrase': 1, relation: 1, client: 3, elision: 1},
    'right-join': {'legende-phrase': 12, identifiant: 3, 'table-gras': 3},
    'self-join': {'table-gras': 1, 'legende-phrase': 3, typographie: 1},
    'sous-requete-from': {'legende-phrase': 10, 'table-gras': 2},
    'sous-requete-in': {'table-gras': 3, 'legende-phrase': 8, identifiant: 1},
    'sous-requete-select': {'legende-phrase': 4, relation: 4},
    'union': {coupes: 5, 'legende-phrase': 8},
    'with-cte': {'legende-phrase': 12},
    'with-recursive': {'table-gras': 2, 'legende-phrase': 16}
  },
  lecons: {
    2: {typographie: 1},   // Renommer avec AS
    7: {identifiant: 1},   // NULL
    53: {identifiant: 1},   // Fonctions de dates et heures
    23: {elision: 1, identifiant: 1},   // COALESCE
    39: {identifiant: 1},   // FULL OUTER JOIN
    45: {client: 1},   // Sous-requête dans WHERE avec IN
    47: {relation: 1},   // Sous-requête dans SELECT
    55: {relation: 1},   // EXISTS et NOT EXISTS
    74: {identifiant: 2},   // Fonctions de rang
    62: {client: 22, relation: 1, 'sans-personnification': 1},   // Transactions
    63: {'sans-personnification': 1},   // SAVEPOINT
    70: {client: 1},   // Les triggers
    71: {'sans-personnification': 1},   // Concurrence et isolation
    64: {'sans-personnification': 1},   // CREATE VIEW
    57: {identifiant: 11, 'sans-personnification': 3},   // Les index et EXPLAIN
    50: {'sans-personnification': 6, typographie: 1}   // Sécurité et droits
  }
};

/* Un texte {genre, html, …} à partir d’une chaîne (genre = le premier genre de la règle) ou d’un objet. */
export const texteDExemple = (regle, ex) => {
  const t = typeof ex === 'string' ? {genre: (regle.genres || prose)[0], html: ex} : ex;
  return {page: 'exemple', ou: 'exemple', lignes: 3, ...t, plain: lisible(t.html)};
};
export const probleme = (regle, texte) => (regle.genres && !regle.genres.includes(texte.genre)) ? [] : regle.verifie(texte);
/* Les écarts d’une règle de page : [{texte, probleme}], pour une liste de textes {genre, html, plain, page, ou}. */
export const problemesDePage = (regle, textes) => regle.verifie(textes);
export const textesDExemple = (regle, liste) => liste.map(ex => texteDExemple(regle, ex));
export const excepte = (regle, texte, pb) => EXCEPTIONS.find(e => e.regle === regle.id && e.page === texte.page && (!e.contient || texte.plain.includes(e.contient)) && (!e.probleme || pb.includes(e.probleme)));
