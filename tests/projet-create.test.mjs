/* Projet NutriBoost, chapitre 4 (leçon 61 « CREATE TABLE ») : la vidéo interactive assets/anim/projet-create.html.
   Tests propres à la page. Les trois tests communs (fiche de la leçon dans index.html, sw.js, poids) arrivent avec l’entrée
   COURSES que l’orchestrateur ajoute à tests/lesson-video.test.mjs lors de l’intégration : ce fichier ne lit ni index.html
   (sauf la base SCHEMA_SQL de l’app), ni sw.js. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '..');
const ANIM = path.join(ROOT, 'assets/anim');
/* ====== À adapter ====== */
const FILE = 'projet-create.html';
const THUMB = ['projet-create-thumb.webp', 'projet-create-thumb.jpg'].find(f => fs.existsSync(path.join(ANIM, f))) || 'projet-create-thumb.webp';
const KINDS = ['pick', 'tap', 'sort', 'tap', 'sort', 'pick'];          // suite des gestes de PICKS (jamais deux fois de suite le même)
const TABLE = 'coachs';                                                 // « la <b>table coachs</b> » au moins une fois, jamais « dans coachs »
const LABELS = ['Le plan', 'La table coachs', 'L’ordre des tables', 'La table ateliers', 'La carte de membre', 'Exécuter', 'À retenir'];
/* ======================= */

const page = fs.readFileSync(path.join(ANIM, FILE), 'utf8');
/* Les données de la page : tout ce qui est entre « const DURATION = » et « /* ---------- Gabarits », exécuté seul (ni DOM, ni GSAP). */
const load = (file, names) => {
  const src = fs.readFileSync(path.join(ANIM, file), 'utf8');
  const a = src.indexOf('const DURATION = '), b = src.indexOf('/* ---------- Gabarits');
  assert.ok(a > 0 && b > a, `données de ${file} localisées`);
  const ctx = vm.createContext({APP: true});
  vm.runInContext(src.slice(a, b) + `;this.D = {${names}};`, ctx);
  return JSON.parse(JSON.stringify(ctx.D));
};
const D = load(FILE, 'DURATION, CHAPTERS, CAPTIONS, QUESTIONS, PICKS, MAILS, OPENS');
const flat = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').trim();
const notesAt = +(/Course\(\{duration: DURATION, chapters: CHAPTERS, captions: CAPTIONS, questions: QUESTIONS, notesAt: ([\d.]+), picks: PICKS, opens: OPENS,/.exec(page) || [])[1];

test(`${FILE} : sur le moteur commun, ressources locales, légère`, () => {
  for (const rel of ['core.css', 'core.js', 'gsap.min.js', 'mascotte.webp']) assert.ok(page.includes(rel), `ressource : ${rel}`);
  assert.ok(page.indexOf('src="gsap.min.js"') > 0 && page.indexOf('src="gsap.min.js"') < page.indexOf('src="core.js"'), 'GSAP chargé avant le moteur');
  assert.ok(!/https?:\/\//.test(page), 'rien de chargé depuis Internet (pas même en commentaire)');
  assert.ok(notesAt > 0, 'Course({duration: DURATION, chapters: CHAPTERS, captions: CAPTIONS, questions: QUESTIONS, notesAt: …, picks: PICKS, opens: OPENS,');
  assert.ok(page.includes('const QUESTIONS = [];') && !/kicker: '/.test(page), 'pas de question en pleine vidéo');
  assert.ok(page.includes('beforeRender: t => IX.tick(t)});') && page.includes('tick(t = tl.time()){') && !page.includes('onRender: () => IX.tick()') && page.includes('window.IX = IX;'), 'aperçu retiré avant le rendu');
  assert.ok(!/text-wrap\s*:\s*pretty/.test(page), 'retours à la ligne classiques');
  /* Aucune bulle de quatre lignes : une phrase trop longue devient deux bulles (demande d’Elisa, 23 et 24 oct.). Les quatre phrases qui tenaient en quatre lignes
     (le 1 du côté de Coach, les deux clés étrangères NOT NULL, INSERT INTO, le récapitulatif) sont donc coupées en deux bulles, chacune d’au plus trois lignes. */
  assert.equal((page.match(/\n\s*\[[\d.]+, [\d.]+, ("[^\n]*"|'[^\n]*'), 4\],?/g) || []).length, 0, 'aucune légende de quatre lignes');
  assert.ok(D.CAPTIONS.every(c => c[2].split('<br>').length <= 3 && (c[3] || 3) <= 3), 'trois lignes au plus, 4e valeur absente');
  for (const s of ['[115.95, 119.6, "Le <code>1</code> du côté de Coach signifie<br>que chaque atelier est animé<br>par un seul coach."],',
    '[119.7, 120.6, "Un atelier ne peut avoir<br>ni zéro ni plusieurs coachs."],',
    '[128.7, 131.7, "Une inscription concerne toujours<br>un client et un atelier."],',
    '[131.8, 133.6, "Ses deux clés étrangères<br>sont donc <code>NOT NULL</code>."],',
    '[186.1, 187.15, "Karim y ajoutera les données<br>avec la commande <code>INSERT INTO</code>."],',
    '[187.25, 188.7, "Elle permet d’insérer<br>de nouvelles lignes dans une table."],',
    '[194.0, 197.95, "Créer une table, c’est définir<br>ses colonnes et les données<br>qu’elles peuvent contenir."],',
    '[198.05, 198.8, "C’est aussi définir<br>les règles à respecter."],'])
    assert.ok(page.includes(s), `légende découpée : ${s.slice(0, 60)}`);
  /* Même budget que le test COURSES : page + vignette + moteur + GSAP + mascotte + 5 polices < 450 Kio. */
  const FONTS = ['jetbrains-mono.woff2', 'inter-medium.woff2', 'inter-semibold.woff2', 'inter-bold.woff2', 'inter-extrabold.woff2'];
  let total = 0;
  for (const f of [FILE, 'core.css', 'core.js', 'gsap.min.js', 'mascotte.webp', THUMB]) total += fs.statSync(path.join(ANIM, f)).size;
  for (const f of FONTS) total += fs.statSync(path.join(ROOT, 'assets/fonts', f)).size;
  /* 480 Kio (470 jusqu’au 27 octobre) : le moteur commun arrête chaque vidéo avant son chapitre « À retenir » (recapEnd, recapRest). */
  assert.ok(total < 480 * 1024, `animation et ressources : ${Math.round(total / 1024)} Kio`);
  assert.ok(fs.statSync(path.join(ANIM, THUMB)).size > 1000, 'vignette');
});

test(`${FILE} : chapitres, légendes d’une seule phrase, vocabulaire du projet`, () => {
  const C = D.CHAPTERS, caps = D.CAPTIONS;
  assert.deepEqual(C.map(c => c.label), LABELS, 'chapitres');
  assert.ok(C[0].a === 5.0 && C.every((c, i) => c.n === i + 1 && (i === 0 || c.a === C[i - 1].b)) && C[C.length - 1].b === D.DURATION, 'chapitres contigus, de 5,0 s à la fin');
  for (const l of LABELS) assert.ok(page.includes(`label:'${l}'`), `label:'${l}'`);
  assert.ok(caps.length > 20, 'plus de 20 légendes');
  caps.forEach(([a, b, t], k) => {
    const txt = t.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').trim();
    assert.ok(a < b && (k === 0 || a >= caps[k - 1][1]), `légende ${k + 1} : dans l’ordre, sans chevauchement`);
    assert.ok(/^[A-ZÀ-ÖØ-Þ0-9«]/.test(txt) || /^(<b[^>]*>)?<code>/.test(t), `légende ${k + 1} : commence comme une phrase (« ${txt.slice(0, 50)} »)`);
    assert.ok(/[.!?»]$/.test(txt), `légende ${k + 1} : finit comme une phrase (« …${txt.slice(-50)} »)`);
    assert.ok(!/[.!?»] ?[A-ZÀ-ÖØ-Þ«]/.test(txt.replace(/\.\.\*?/g, '')), `légende ${k + 1} : une seule phrase (« ${txt.slice(0, 70)} »)`);
  });
  const last = caps[caps.length - 1], before = caps[caps.length - 2];
  assert.ok(last[0] === notesAt && last[1] === 999 && last[2] === '<b>Ajoute ce résumé à tes notes</b> pour le retrouver facilement.', 'dernière légende (app) à notesAt');
  /* Les bulles du récapitulatif résument les trois idées (à la demande d’Elisa) : elles ne disent plus « Pour finir, voici les trois idées à retenir ».
     La phrase, trop longue pour trois lignes, est coupée en deux bulles (jamais de bulle de quatre lignes). */
  assert.equal(caps[caps.length - 3][2], 'Créer une table, c’est définir<br>ses colonnes et les données<br>qu’elles peuvent contenir.');
  assert.equal(before[2], 'C’est aussi définir<br>les règles à respecter.');
  /* Jamais de carte de légende vide : entre deux légendes éloignées de plus d’une seconde, la carte s’efface (capOff) puis revient (capOn). */
  const offs = [...page.matchAll(/capOff\(([\d.]+)\)/g)].map(m => +m[1]), ons = [...page.matchAll(/capOn\(([\d.]+)\)/g)].map(m => +m[1]);
  caps.slice(1).forEach(([a], k) => {
    const b = caps[k][1];
    if (a - b > 1) assert.ok(offs.some(t => Math.abs(t - (b - 0.2)) <= 0.11) && ons.some(t => t >= a - 0.3 && t <= a), `trou de légende entre ${b} et ${a} : capOff(${+(b - 0.2).toFixed(2)}) et capOn dans [${+(a - 0.3).toFixed(2)} ; ${a}]`);
  });
  assert.ok(page.includes(`la <b>table ${TABLE}</b>`) && !new RegExp(`dans ${TABLE}\\b`).test(page), `« la table ${TABLE} »`);
  for (const t of ['clients', 'ateliers', 'inscriptions', 'cartes']) assert.ok(!new RegExp(`dans ${t}\\b`).test(page), `jamais « dans ${t} »`);
  assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page), 'SQL n’est jamais personnifié');
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  assert.ok(!/num[ée]ros?\b/i.test(strip(page)), '« identifiant », jamais « numéro »');
  assert.ok(!page.includes('table de jointure'), '« table d’association »');
  assert.ok(!/\bEn 1 → N\b/.test(page), '« Dans une relation 1 → N »');
});

test(`${FILE} : six moments « À toi », chacun annoncé, l’attente coupée, une seule bonne réponse`, () => {
  const P = D.PICKS;
  assert.deepEqual(P.map(p => p.kind), KINDS, 'gestes');
  assert.ok(KINDS.every((k, i) => i === 0 || k !== KINDS[i - 1]), 'jamais deux fois de suite le même geste');
  const atoi = D.CAPTIONS.filter(c => /^À toi/.test(c[2]));
  assert.ok(atoi.every(c => c[2] === 'À toi !') && atoi.length === P.length, 'une légende « À toi ! » par moment, sans la consigne');
  P.forEach((p, i) => {
    assert.ok(atoi[i][0] <= p.at - 1.85 && p.at < atoi[i][1], `moment ${i + 1} : « À toi ! » lue avant la coupe, arrêt pendant elle`);
    assert.ok(p.from < p.at && (i === 0 || (p.from > P[i - 1].at && p.at > P[i - 1].at)), `moment ${i + 1} : from après le moment précédent`);
    assert.ok(p.prompt && !D.CAPTIONS.some(c => flat(c[2]) === flat(p.prompt)), `moment ${i + 1} : la consigne n’est que sur la carte`);
    if (p.kind === 'tap') assert.ok(/^Touche /.test(p.prompt) && p.need >= 1, `moment ${i + 1} : « Touche … », need`);
    if (p.kind === 'sort') assert.ok(p.hint && p.next && p.next.includes('{x}') && p.options.length >= 2, `moment ${i + 1} : hint, next ({x}), étiquettes`);
    if (p.kind === 'pick') {
      assert.equal(p.options.filter(o => o.ok).length, 1, `moment ${i + 1} : une seule bonne réponse`);
      /* Chaque mauvaise réponse a son explication, sauf si la légende qui suit l’explique (commentaire dans la page). */
      p.options.filter(o => !o.ok).forEach(o => assert.ok(o.why || page.includes(`{label: '${o.label}'},   // `), `moment ${i + 1} : why de « ${o.label} »`));
    }
    (p.options || []).forEach(o => assert.ok(!/[<>]/.test(o.label), `moment ${i + 1} : étiquette en texte brut (« ${o.label} »)`));
  });
  assert.ok(page.includes('PICKS.forEach(p => cut(p.at - 1.35, 1.25));'), 'l’attente avant chaque arrêt est coupée');
  assert.ok(page.includes('spots, act, pick, hint,') && page.includes('slot: '), 'IX : spots, act, pick, hint, slot');
});

test(`${FILE} : mails à toucher`, () => {
  D.OPENS.forEach((o, n) => {
    const m = D.MAILS[n];
    assert.ok(o.sel === '#ml' + (n + 1) && o.prompt === 'Touche le mail pour l’ouvrir.' && o.label === `Ouvrir le mail de ${m[0][0]} ${m[0][1]}`, `mail ${n + 1}`);
    assert.ok(!D.PICKS.some(p => Math.abs(p.at - o.at) < 1), `mail ${n + 1} : loin des moments`);
  });
  assert.equal(D.OPENS.length, D.MAILS.length, 'un arrêt par mail');
});

test(`${FILE} : deux réponses enchaînées, clear() retire la classe de flash() sans attendre le minuteur`, () => {
  const clearSrc = page.match(/function clear\(\)\{\n[\s\S]*?\n  \}/)?.[0], flashSrc = page.match(/const flash = \(e, c, ms = 600\) => \{[^\n]*\};/)?.[0];
  assert.ok(clearSrc && flashSrc, 'clear() et flash() trouvés');
  const stopped = []; let id = 0;
  const ctx = vm.createContext({setTimeout: () => ++id, clearTimeout: n => stopped.push(n)});
  const api = vm.runInContext(`let X = {cls: [], tm: []}, wait = 0; ${clearSrc}\n${flashSrc}\n({flash, clear, left: () => X})`, ctx);
  const classes = new Set();
  const el = {offsetWidth: 1, classList: {add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c)}};
  api.flash(el, 'kof', 650); assert.ok(classes.has('kof'));
  api.clear(); assert.ok(!classes.has('kof')); assert.deepEqual(stopped, [1]); assert.equal(api.left(), null);
});

/* ---------- Propre au chapitre 4 ---------- */

test(`${FILE} : intro, bulles du scénario mot pour mot, mails, annonce du chapitre 5 et récapitulatif`, () => {
  assert.ok(page.includes('<div class="tagpill">Projet · Chapitre 4</div>') && page.includes('<span>C</span><span>R</span><span>E</span><span>A</span><span>T</span><span>E</span>')
    && page.includes('<div class="abs sub">Les tables des ateliers</div>'), 'écran titre : « Projet · Chapitre 4 », CREATE, « Les tables des ateliers »');
  assert.ok(page.includes('<div class="abs bubble">Le plan est prêt&nbsp;: à toi de construire<br>les tables avec <span class="ic">CREATE TABLE</span>.</div>'), 'bulle de la mascotte');
  /* Les bulles du scénario validé, dans l’ordre, avec les six « À toi ! » ; seuls les <br> et les espaces insécables sont libres. */
  const BULLES = [
    'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.',
    'Au chapitre 3, tu as dessiné le plan de la base avec un diagramme de classes UML.',
    'Tu l’as ensuite traduit en cinq tables, avec leurs colonnes et leurs clés.',
    'La table clients existe déjà : il reste quatre tables à créer.',
    'Tu les écris dans le fichier schema.sql : une requête CREATE TABLE par table.',
    'On commence par la table coachs.',
    'On écrit CREATE TABLE, le nom de la table, puis ses colonnes entre parenthèses, séparées par des virgules.',
    'Chaque colonne a un nom, suivi de son type : la nature des valeurs qu’elle contient.',
    'INTEGER pour un nombre entier, REAL pour un nombre à virgule, TEXT pour du texte.',
    'Une colonne peut aussi porter une contrainte : une règle que ses valeurs doivent respecter.',
    'À toi !',
    'PRIMARY KEY fait de id la clé primaire de la table : unique, et jamais vide.',
    'Un coach a toujours un prénom et un nom : NOT NULL les rend obligatoires.',
    'Deux coachs ne peuvent pas avoir la même adresse e-mail : UNIQUE interdit les doublons.',
    'La base refusera toute ligne qui ne respecte pas ces contraintes.',
    'Karim exécutera le fichier de haut en bas, une requête après l’autre.',
    'Pour qu’une clé étrangère fonctionne, la table à laquelle elle fait référence doit déjà exister.',
    'À toi !',
    'Les tables ateliers et cartes font seulement référence à coachs et à clients.',
    'La table inscriptions viendra après la table ateliers, à laquelle elle fait référence.',
    'La table ateliers a un titre obligatoire, une date et le coach qui anime l’atelier.',
    'À toi !',
    'Une date a son propre type : DATE, au format année-mois-jour, comme \'2026-09-12\'.',
    'coach_id est un entier, comme l’identifiant auquel il fait référence.',
    'La clé étrangère se déclare avec FOREIGN KEY et REFERENCES, comme au chapitre 2.',
    'Reste à savoir si coach_id peut rester vide.',
    'À toi !',
    'Le 1 du côté de Coach signifie que chaque atelier est animé par un seul coach.',
    'Un atelier ne peut avoir ni zéro ni plusieurs coachs.',
    'Pas d’atelier sans coach : coach_id ne doit jamais être vide, on ajoute NOT NULL.',
    'Vient ensuite la table inscriptions, écrite sur le même modèle.',
    'Une inscription concerne toujours un client et un atelier.',
    'Ses deux clés étrangères sont donc NOT NULL.',
    'Reste la table cartes, celle des cartes de membre.',
    'Comme coach_id, client_id est obligatoire : une carte a toujours un propriétaire.',
    'DEFAULT donne une valeur à la colonne quand on n’en précise aucune.',
    'CHECK est une contrainte qui vérifie une condition sur chaque valeur.',
    'À toi !',
    'Avec DEFAULT 10, une carte créée sans solde précisé reçoit 10 séances.',
    'On écrit CHECK (seances >= 0) : le solde peut tomber à 0, mais pas en dessous.',
    'Ton fichier schema.sql est complet : quatre requêtes, dans le bon ordre.',
    'Karim le relit, puis l’exécute dans le SGBD.',
    'Les quatre nouvelles tables sont créées !',
    'Ta base compte désormais huit tables pour gérer la boutique et les ateliers.',
    'À toi !',
    'Les quatre nouvelles tables sont encore vides.',
    'Karim y ajoutera les données avec la commande INSERT INTO.',
    'Elle permet d’insérer de nouvelles lignes dans une table.',
    'Dans le prochain chapitre, tu feras évoluer ces tables avec ALTER TABLE.',
    'Créer une table, c’est définir ses colonnes et les données qu’elles peuvent contenir.',
    'C’est aussi définir les règles à respecter.',
    'Ajoute ce résumé à tes notes pour le retrouver facilement.'];
  assert.deepEqual(D.CAPTIONS.map(c => flat(c[2])), BULLES, 'les bulles du scénario, mot pour mot et dans l’ordre');
  /* Les deux premières légendes, communes aux chapitres 4 à 6 (contrat de continuité), et la devise hors de l’app. */
  assert.ok(page.includes('"Au chapitre 3, tu as dessiné<br>le plan de la base<br>avec un <b class=\\"nw\\">diagramme de classes UML</b>."'), 'le diagramme de classes UML, insécable');
  assert.ok(page.includes(': [198.9, 999, "Un plan d’abord,<br>puis une requête par table :<br>c’est ainsi qu’une base prend forme."]'), 'devise (hors de l’app)');
  /* La seule légende trop longue pour trois lignes ordinaires : interlettrage un peu serré, mots intacts. */
  assert.ok(page.includes('#cap .ser{letter-spacing:-1.2px}') && page.includes('"<span class=\\"ser\\">On écrit <code>CREATE TABLE</code>, le nom de la table,<br>'), 'légende de CREATE TABLE en trois lignes');
  /* Les deux mails : Karim Benali (écrire les requêtes), l’équipe NutriBoost (deux règles pour les cartes de membre). */
  assert.deepEqual(D.MAILS.map(m => [m[0][0] + ' ' + m[0][1], m[0][2], m[1], m[2], m[3], m[5]]), [['Karim Benali', 'KB', 'k-dv', 'développeur', 'karim@nutriboost.fr', 'Karim'],
    ['L’équipe NutriBoost', 'NB', 'k-nb', 'équipe', 'equipe@nutriboost.fr', 'L’équipe NutriBoost']], 'expéditeurs');
  assert.deepEqual(D.MAILS.map(m => [].concat(m[4])), [
    ['Merci pour ton diagramme : il est clair et complet.', 'Je suis pris par un autre projet cette semaine. Peux-tu écrire toi-même les requêtes qui créent ces tables ?',
      'Je les relirai, puis je les exécuterai dans le SGBD.'],
    ['Pour les cartes de membre, deux règles comptent : chaque nouvelle carte commence avec 10 séances, et son solde ne doit jamais devenir négatif.']], 'demandes, mot pour mot');
  assert.ok(page.includes("${['Bonjour,', ...[].concat(body), 'Merci !', sign]"), 'chaque mail : « Bonjour, », la demande, « Merci ! », la signature');
  /* Le mail de Karim ouvre le chapitre ; celui de l’équipe arrive avant le moment des trois règles de la carte de membre. */
  assert.ok(D.OPENS[0].at < D.CHAPTERS[1].a && D.OPENS[1].at > D.PICKS[3].at && D.OPENS[1].at < D.PICKS[4].from, 'chaque mail avant le moment qui s’en sert');
  /* L’annonce du chapitre suivant, sous son vrai titre. */
  assert.ok(page.includes('<span class="emo">🔧</span>Chapitre 5 · ALTER TABLE</span>'), 'pilule « 🔧 Chapitre 5 · ALTER TABLE »');
  /* Les trois idées à retenir : un titre (sans numéro), puis sa précision (comme dans la leçon « Quel JOIN choisir ? »). */
  const recap = page.slice(page.indexOf('<div class="abs card recap" id="recap">'), page.indexOf('</section>', page.indexOf('id="recap"')));
  const rows = [...recap.matchAll(/<div class="rtxt">([\s\S]*?)<\/div><\/div>/g)].map(m => m[1]);
  const phrase = r => flat(r.split('<span class="rs">')[0]), prec = r => r.includes('<span class="rs">') ? flat(r.slice(r.indexOf('<span class="rs">'))) : null;
  assert.deepEqual(rows.map(r => [phrase(r), prec(r)]), [
    ['Créer une table', 'CREATE TABLE définit son nom et ses colonnes. Pour y ajouter des lignes, on utilise INSERT INTO.'],
    ['Définir les colonnes', 'Chaque colonne possède un nom et un type de données. Par exemple, seances INTEGER permet de stocker un nombre entier de séances.'],
    ['Définir les règles', 'Les contraintes encadrent les données : identifiant unique (PRIMARY KEY), valeur obligatoire (NOT NULL), absence de doublons (UNIQUE), condition à respecter (CHECK) et relation avec une autre table (FOREIGN KEY).']], 'récapitulatif');
  assert.ok(['🏗️', '🔤', '🛡️'].every(e => recap.includes(`<div class="rico emo">${e}</div>`)), 'emoji des trois idées');
  assert.ok(rows[0].includes('Créer une <b>table</b>') && rows[1].includes('Définir les <b>colonnes</b>') && rows[2].includes('Définir les <b>règles</b>'), 'les notions en gras');
  /* La dernière précision arrive à 198,05 s : sa pause de lecture (198,55) est aussi celle de la dernière bulle « C’est aussi définir les règles à respecter. »
     (198,05 → 198,8), une seule pause. La bulle d’avant (194,0 → 197,95) s’arrête à 197,7, entre deux précisions : aucun mouvement en cours. */
  assert.ok(page.includes('[[194.3, 195.05], [195.7, 196.45], [197.1, 198.05]].forEach(([r, d], i) => {') && D.CAPTIONS.some(c => c[0] === 198.05 && c[1] === 198.8 && flat(c[2]) === 'C’est aussi définir les règles à respecter.'), 'une seule pause à la fin : celle du récapitulatif');
});

test(`${FILE} : les six moments du scénario, leurs corrections et leurs indices, la réponse posée juste après l’arrêt`, () => {
  const P = D.PICKS;
  const W = load(FILE, 'TYPES, TYPES3, COLS3, KW5, REGLES, ORDRE_WHY, ASSOCS, SQL');
  /* 1 · le trou de la requête des coachs : PRIMARY KEY */
  assert.ok(!P[0].text && flat(P[0].prompt) === 'Quelle contrainte permet à id d’identifier chaque coach ?');
  assert.deepEqual(P[0].options, [{label: 'UNIQUE', why: 'UNIQUE interdit les doublons, mais l’id d’un coach pourrait rester vide (NULL).'},
    {label: 'PRIMARY KEY', ok: true}, {label: 'NOT NULL', why: 'NOT NULL interdit les valeurs vides, pas les doublons : deux coachs pourraient avoir le même id.'}]);
  assert.ok(W.SQL.co.some(([lid, l]) => lid === 'co2' && l === '  {c2n|id} {c2t|INTEGER}<sl0| PRIMARY KEY>,') && page.includes("slot: i => { const s = $('#sl' + i); return s ? rel(s) : null; },"),
    'l’étiquette s’envole jusqu’au trou, après id INTEGER');
  /* 2 · les deux tables à écrire juste après coachs : ateliers et cartes */
  assert.ok(P[1].prompt === 'Touche les deux tables que tu peux écrire juste après coachs.' && P[1].need === 2);
  assert.ok(page.includes("const M2_ANS = {at: ['#p-at .hlo'], ca: ['#p-ca .hlo']};") && page.includes("if (i === 1) return ['co', 'ca', 'in', 'at', 'cl'].map(k =>"), 'réponse : ateliers et cartes, parmi les cinq tables du plan');
  assert.deepEqual(W.ORDRE_WHY, {in: 'La table inscriptions fait référence à la table ateliers, qui n’est pas encore écrite.',
    co: 'La table coachs est déjà écrite : c’est la première du fichier.', cl: 'La table clients existe déjà : il ne faut pas la recréer.'}, 'une correction par mauvaise table');
  /* 3 · ranger les colonnes de la table ateliers selon leur type (la case REAL reste vide) */
  assert.ok(P[2].prompt === 'Range chaque colonne de la table ateliers selon son type : une case peut rester vide.'
    && P[2].hint === 'Sélectionne une colonne, puis appuie sur le type qui lui correspond. Tu peux aussi la faire glisser directement.' && P[2].next === '{x} : appuie maintenant sur son type.');
  assert.deepEqual(W.TYPES.map(t => [t[0], t[1]]), [['int', 'INTEGER'], ['real', 'REAL'], ['text', 'TEXT']], 'les trois types du chapitre 2 : INTEGER, REAL, TEXT');
  assert.deepEqual(W.TYPES3.map(t => [t[0], t[1], t[2], t[3]]), [['int', 'INTEGER', 'nombre entier', '10'], ['real', 'REAL', 'nombre à virgule', '29.90'], ['text', 'TEXT', 'texte', '\'Salma\''],
    ['date', 'DATE', 'date', '\'2026-09-12\'']], 'les quatre cases du moment 3 : INTEGER, REAL, TEXT, et DATE en plus');
  assert.deepEqual(W.COLS3, [['titre', 'text', 'Un titre est du texte.'], ['date_atelier', 'date', 'date_atelier contient une date, comme \'2026-09-12\' : une date a son propre type.'],
    ['coach_id', 'int', 'coach_id contient l’identifiant d’un coach : un nombre entier, comme id.']]);
  assert.deepEqual(P[2].options.map(o => o.label), ['titre', 'date_atelier', 'coach_id']);
  assert.ok(!W.COLS3.some(c => c[1] === 'real'), 'la case REAL reste vide');
  /* 4 · la multiplicité qui dit si un atelier peut exister sans coach : le 1 du côté de la classe Coach */
  assert.ok(P[3].prompt === 'Touche la multiplicité qui indique si un atelier peut exister sans coach.' && P[3].need === 1);
  assert.deepEqual(W.ASSOCS.find(a => a[0] === 'an'), ['an', 'anime', '▾', 'co', '1', 'at', '0..*'], 'anime : 1 du côté de Coach, 0..* du côté d’Atelier');
  for (const s of ["if (a === 'an-co') { mark($('#rg-an-co'));", "fr(a === 'an-at' ? 'Ce 0..* compte les ateliers d’un coach : un coach peut n’en animer aucun.' : 'Cette multiplicité appartient à une autre association.')",
    'if (i === 3) return MPS.map(([k, m, s]) => Object.assign({k, label: `${m}, du côté de la classe ${NOM[s]}`}, pad(rel($(\'#um-\' + k)), 16)));'])
    assert.ok(page.includes(s), `moment 4 : ${s.slice(0, 60)}`);
  /* 5 · chaque mot-clé à côté de la règle qu’il traduit */
  assert.ok(P[4].prompt === 'Place chaque mot-clé à côté de la règle qu’il traduit.'
    && P[4].hint === 'Sélectionne un mot-clé, puis appuie sur la règle qu’il traduit. Tu peux aussi le faire glisser directement.' && P[4].next === '{x} : appuie maintenant sur la règle qu’il traduit.');
  assert.deepEqual(W.KW5, [['UNIQUE', 'uq', 'UNIQUE interdit les doublons : un même client ne peut pas avoir deux cartes.'],
    ['DEFAULT', 'df', 'DEFAULT fixe la valeur de départ : ici, le solde d’une nouvelle carte.'],
    ['CHECK', 'ck', 'CHECK refuse les valeurs qui ne respectent pas sa condition : ici, un solde négatif.']]);
  assert.deepEqual(Object.fromEntries(W.REGLES), {df: 'Une nouvelle carte commence avec 10 séances.', ck: 'Le solde ne devient jamais négatif.', uq: 'Un client n’a qu’une seule carte.'});
  assert.deepEqual(P[4].options.map(o => o.label), ['UNIQUE', 'DEFAULT', 'CHECK']);
  /* 6 · ce que contient la table ateliers juste après sa création */
  assert.ok(P[5].text && P[5].prompt === 'Que contient la table ateliers juste après sa création ?');
  assert.deepEqual(P[5].options, [{label: 'Les cinq ateliers de la rentrée', why: 'Les ateliers n’ont pas encore été enregistrés : CREATE TABLE ne crée que la structure.'},
    {label: 'Ses colonnes, mais aucune ligne', ok: true}, {label: 'Une ligne vide, prête à remplir', why: 'Une table neuve ne contient aucune ligne, pas même une ligne vide.'}]);
  assert.ok(page.includes('<i class="z0">0 ligne</i><i class="z1">${ATELIERS.length} lignes ?</i><i class="z2">1 ligne vide ?</i>'), 'chaque réponse se voit sur la table ateliers');
  /* L’indice 💡 de chaque moment, après deux erreurs : une piste, passée par la typographie française. */
  for (const h of ["'Il faut une valeur à la fois unique et jamais vide : la clé du chapitre 2.',", "'Suis les flèches : chaque table vise-t-elle une table déjà là ?',",
    "'Pour chaque colonne, imagine une valeur : des lettres, un nombre, une date ?',", "'Pour un atelier donné, combien de coachs ? Ce nombre s’écrit du côté de la classe Coach.',",
    "'Valeur de départ, condition à vérifier, pas de doublon : à chaque règle son mot-clé.',", "'CREATE TABLE décrit les colonnes : qui a déjà enregistré des ateliers dans cette table ?'][i];",
    'return h ? {text: fr(h)} : null;'])
    assert.ok(page.includes(h), `indice : ${h.slice(0, 60)}`);
  /* La réponse de chaque moment, posée par la timeline juste après l’arrêt (aN = at + 0,02), la même que l’aperçu. */
  for (const s of ["tl.set('#sl0 .sv', {autoAlpha: 1}, a0);", "tl.set('#sl0 .se', {autoAlpha: 0}, a0);", 'tl.set(M2_ANS.at.concat(M2_ANS.ca), {autoAlpha: 1}, a1);',
    'tl.set(COLS3.flatMap((c, j) => M3_ANS(j)), {autoAlpha: 1}, a2);', 'tl.set(COLS3.flatMap((c, j) => M3_OFF(j)), {autoAlpha: 0}, a2);', 'tl.set(M4_ANS, {autoAlpha: 1}, a3);',
    "tl.set('.rul .rc', {autoAlpha: 1}, a4);", 'tl.set(M6_ANS, {autoAlpha: 1}, a5);',
    "if (ok) { mark($('#sl0 .sv')); mark($('#sl0 .se'), 'pvh'); }", 'marks(M2_ANS[a]);', "marks(M3_ANS(a)); marks(M3_OFF(a), 'pvh');", "mark($('#rc5-' + a));", 'if (ok) marks(M6_ANS);',
    "const M4_ANS = ['#rg-an-co'];", "const M6_ANS = ['#gx-at-f', '#gx-at-f .z0'];"])
    assert.ok(page.includes(s), `réponse : ${s}`);
  [0, 1, 2, 3, 4, 5].forEach(i => assert.ok(page.includes(`const a${i} = +(PICKS[${i}].at + 0.02).toFixed(2);`), `a${i}`));
  /* Moment 3 : le « ? » prêtait à confusion. Chaque trou du code et de l’aperçu dit « type », en jaune, et les trois noms de types
     (INTEGER, REAL, TEXT, DATE) sont surlignés de la même couleur ; ils clignotent à l’ouverture du moment et ne sont plus surlignés une fois la réponse posée. */
  assert.ok(['at3', 'at4', 'at5'].every((id, q) => W.SQL.at.some(([lid, l]) => lid === id && l.includes(`<sl2${'abc'[q]}|`))), 'les trois trous du moment 3 : titre, date_atelier, coach_id');
  for (const s of ["<span class=\"se\">${/^sl2/.test(id) ? 'type' : '?'}</span>",                                  // le trou du code : « type » au moment 3, « ? » au moment 1
    "${k === 'at' ? '<i class=\"t0\">type</i>' : ''}",                                                              // la case de l’aperçu : « type », seulement pour la table ateliers
    '.pr .t0{justify-self:end;align-self:center;height:28px;padding:0 10px;border:3px dashed #FFC94A;',                              // même jaune pointillé que le trou du code
    '.slot .se{border:3px dashed #FFC94A;background:rgba(255,201,74,.16);color:#FFD66B;',
    '.tyb .tyl b{margin:-2px -8px;padding:2px 8px;border-radius:9px;background:#FFE18A}', '.tyb.pvb .tyl b{background:transparent!important}',
    '.hot{animation:hot 1.2s ease-in-out 2}', '@keyframes hot{50%{box-shadow:0 0 0 5px rgba(255,205,70,.85)}}',
    "bump(['#sl2a .se', '#sl2b .se', '#sl2c .se', '#pv-at .t0'], 96.12, 1.12); cue(96.12, 'tick', 0.45, 3);",         // quand les trois types arrivent
    "tl.set('.tyb b', {backgroundColor: 'rgba(255,225,138,0)'}, a2);",                                              // la réponse efface le surlignage, comme l’aperçu (pvb)
    "const M3_HOT = ['#sl2a .se', '#sl2b .se', '#sl2c .se', '#pv-at .t0', '.tyb .tyl b'];",                       // ce qui clignote : cases « type » et noms des types
    "if (i === 2) { marks(M3_HOT, 'hot'); X.hot = true; }",                                                         // le lecteur ouvre le moment : tout clignote
    "if (X && X.hot && t >= PICKS[2].at + 0.0199) { X.hot = false; M3_HOT.forEach(s => $$(s).forEach(e => e.classList.remove('hot'))); }"])   // rouvert déjà réussi : plus de clignotement
    assert.ok(page.includes(s), `types surlignés : ${s.slice(0, 70)}`);
  assert.ok(!page.includes('<i class="t0">?</i>'), 'plus de « ? » dans l’aperçu');
  assert.ok(96.12 > 95.8 + 0.09 * 3 && 96.12 + 2 * 0.18 < D.PICKS[2].at - 1.35, 'le battement des cases « type » se voit : après l’arrivée des types, fini avant le passage coupé');
  assert.ok(95.8 + 0.09 * (W.TYPES3.length - 1) + 0.4 < D.PICKS[2].at - 1.35, 'la quatrième carte de type a fini d’arriver avant le passage coupé');
  /* DATE : une quatrième carte, un exemple qui se voit tout de suite (plus de TEXT qui change d’exemple), animée quand la bulle la nomme. */
  for (const s of ["TYPES3.map(([k, ty, d, ex]) => `<div class=\"abs tyc tyb\" id=\"tb-${k}\" style=\"left:556px\"><div class=\"tyl\"><b>${ty}</b><span>${d}</span><i class=\"ex\">${ex}</i></div><div class=\"rcs\">`",
    "if (i === 2) return TYPES3.map(([k, ty]) => Object.assign({k, label: `Type ${ty}`}, rel($('#tb-' + k))));", "stack(TYPES3.map(t => '#tb-' + t[0]), G.pvAt[0]);",
    "TYPES3.forEach(([k], q) => { show('#tb-' + k, 95.8 + q * 0.09,", "bump('#tb-date', 100.05, 1.05);", "bump('#tb-date .ex', 101.45, 1.12);"])
    assert.ok(page.includes(s), `carte DATE : ${s.slice(0, 70)}`);
  assert.ok(!/class="sw|\.sw\b|\.ex[01]\b|tb-text \./.test(page), 'plus de TEXT qui change d’exemple');
  /* Les noms des types gardent leur surlignage pendant tout l’arrêt : rien dans IX.act ne l’efface avant la dernière colonne rangée. */
  assert.ok(page.includes("if (X.got.size === COLS3.length) marks(['.tyb'], 'pvb');"), 'le surlignage s’efface avec la dernière colonne rangée');
  /* Les gestes de la timeline, chacun pendant la bulle qui en parle. */
  for (const s of ["show('#st-cl', 21.3,", "slotIn('sl0', 46.6);", "FLECHES.forEach(([id], q) => draw('#' + id, 73.0 + q * 0.6, 0.5));", "pop('#od-co', 86.5, 0.5);",
    "bump('#tb-date .ex', 101.45, 1.12);", "sqMore('an1', 123.1);", "sqMore('cdf', 157.3);", "sqMore('cck', 161.0, 30);", "press($('#run'), 171.6);", "show('#okm', 172.4,",
    "show('#ins', 186.35,", "show('#keyc', 189.35,", "bump('#db .dbn', 178.05, 1.18);", "bump('#ins code', 187.45, 1.15);"])
    assert.ok(page.includes(s), `geste : ${s}`);
  /* Le badge de la base compte avec les tables : 4, 5, 6, 7, 8, chaque nombre quand la table entre ; « 8 tables » est là avant que la bulle ne dise huit. */
  assert.ok(page.includes("Base de données<span class=\"dbn\">' + [4, 5, 6, 7, 8].map(n => `<i class=\"n${n}\">${n} tables</i>`).join('') + '</span></div>'"), 'le badge a cinq états, de 4 à 8 tables');
  for (const s of ["const t = 176.2 + q * 0.2;", "tl.to(`#db .n${4 + q}`, {autoAlpha: 0, y: -14, duration: 0.1, ease: 'power2.in'}, t);",
    "tl.fromTo(`#db .n${5 + q}`, {autoAlpha: 0, y: 14}, {autoAlpha: 1, y: 0, duration: 0.16, ease: 'power3.out', immediateRender: false}, t + 0.04);",
    "gsap.set(['#db .n5', '#db .n6', '#db .n7', '#db .n8'], {autoAlpha: 0});"])
    assert.ok(page.includes(s), `compteur : ${s.slice(0, 60)}`);
  const huit = D.CAPTIONS.find(c => /huit tables/.test(c[2])), creees = D.CAPTIONS.find(c => /sont créées/.test(c[2]));
  const derniere = 176.2 + 0.2 * 3, fini = derniere + 0.04 + 0.16;
  assert.ok(creees[0] < 176.2 && fini < huit[0] + 0.3, 'le compte atteint 8 avant que la bulle « huit tables » soit lisible');
  assert.ok(derniere + 0.4 < creees[1] - 0.25, 'la dernière table a fini d’entrer avant la pause de la bulle « créées »');
  assert.ok(!/huit tables/.test(D.CAPTIONS.filter(c => c[0] < huit[0]).map(c => c[2]).join(' ')), 'aucune bulle ne parle de huit tables avant le badge à 8');
  /* « Karim y ajoutera… INSERT INTO » : la puce porte la commande en entier, ses gestes finissent avant la pause de la bulle (fin 188,7). */
  const ins = D.CAPTIONS.find(c => /INSERT INTO/.test(c[2])), ins2 = D.CAPTIONS.find(c => flat(c[2]) === 'Elle permet d’insérer de nouvelles lignes dans une table.');
  assert.ok(page.includes('<span class="emo">✍️</span><code>INSERT INTO</code></span></div>') && !page.includes('<code>INSERT</code>'), 'la puce dit INSERT INTO, comme la bulle');
  /* La phrase est coupée en deux bulles : la puce entre pendant la première (elle a fini d’entrer, 186,35 + 0,45, avant sa pause à 186,9), le stylo écrit pendant la seconde. */
  assert.ok(ins && ins2 && 186.35 > ins[0] && 186.35 + 0.45 < ins[1] - 0.25 && ins[1] < ins2[0], 'la puce INSERT INTO entre pendant la première bulle, avant sa pause');
  assert.ok(187.75 > ins2[0] && 187.75 + 0.14 * 4 < ins2[1] - 0.25, 'le stylo a fini d’écrire avant la pause de la seconde bulle');
  /* Une seule bulle sur le contenu des nouvelles tables : « Les quatre nouvelles tables sont encore vides » (plus de « Une table neuve est vide »).
     Les « 0 ligne » des trois autres tables entrent un à un, puis les quatre battent ensemble, avant la fin de la bulle. */
  const vides = D.CAPTIONS.filter(c => /nouvelles tables sont encore vides|table neuve est vide/.test(flat(c[2])));
  assert.equal(vides.length, 1, 'une seule bulle sur les tables vides');
  assert.equal(flat(vides[0][2]), 'Les quatre nouvelles tables sont encore vides.');
  assert.ok(vides[0][0] === 182.75 && vides[0][1] === 186.0 && ins[0] === +(vides[0][1] + 0.1).toFixed(2), 'la bulle INSERT INTO suit tout de suite');
  assert.ok(page.includes("bump(ORDRE.map(k => `#gx-${k}-f`), 184.6, 1.06);") && !page.includes('#gx-${k} .pr'), 'les « 0 ligne » battent ensemble, sans les rangées de colonnes de la bulle retirée');
});

test(`${FILE} : le cas NutriBoost des chapitres 2 et 3, et chaque requête montrée vérifiée dans SQLite`, async () => {
  /* Données du cas : identiques à celles du chapitre 2 ; le diagramme, celui du chapitre 3. */
  const C2 = load('projet-cles.html', 'COACHS, ATELIERS, CLIENTS, INSCR, NOUVELLE, CARTES');
  const C3 = load('projet-uml.html', 'CLASSES, ASSOCS, ACLASS');
  const H = load(FILE, 'COACHS, ATELIERS, CLIENTS, INSCR, NOUVELLE, CARTES, CLASSES, ASSOCS, ACLASS, TABLES, ORDRE, BOUTIQUE, FLECHES, SQL, SUJET');
  for (const k of Object.keys(C2)) assert.deepEqual(H[k], C2[k], `${k} : comme au chapitre 2`);
  for (const k of Object.keys(C3)) assert.deepEqual(H[k], C3[k], `${k} : le diagramme du chapitre 3`);
  /* La base de l’app (sql.js, SQLite 3.45.2), PRAGMA foreign_keys = ON compris. */
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const data = vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), data);
  const SQL = await createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
  const fresh = () => { const d = new SQL.Database(); d.run(vm.runInContext('SCHEMA_SQL', data)); return d; };
  const db = fresh();
  const q = (s, d = db) => JSON.stringify(d.exec(s).flatMap(r => r.values));
  const names = (d = db) => q("SELECT group_concat(name) FROM (SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name)", d);
  for (const [id, prenom, nom] of H.CLIENTS) assert.equal(q(`SELECT prenom, nom FROM clients WHERE id = ${id}`), JSON.stringify([[prenom, nom]]), `client ${id}`);
  /* Au départ, la base a les quatre tables de la boutique : la table clients existe déjà. */
  assert.equal(names(), JSON.stringify([[H.BOUTIQUE.map(b => b[2]).sort().join(',')]]), 'les tables de la boutique');
  assert.deepEqual(H.BOUTIQUE.map(b => b[2]), ['clients', 'commandes', 'fidelite', 'produits']);
  /* Les requêtes des cartes de code : {id|…} et [id|…] retirés, le trou remplacé par sa réponse, les lignes « … » (pas encore écrites) laissées de côté. */
  const sqlText = k => H.SQL[k].filter(([, l]) => !/^\s*…/.test(l)).map(([, l]) => l.replace(/<sl\w+\|([^<>]*)>/g, '$1').replace(/[{[]\w+\||[}\]]/g, '')).join('\n');
  /* Le schéma canonique de la fin du chapitre 4 (le chapitre 5 en part) : mot pour mot le SQL du scénario. */
  assert.deepEqual(H.ORDRE.map(sqlText), [
    'CREATE TABLE coachs (\n  id INTEGER PRIMARY KEY,\n  prenom TEXT NOT NULL,\n  nom TEXT NOT NULL,\n  email TEXT UNIQUE\n);',
    'CREATE TABLE ateliers (\n  id INTEGER PRIMARY KEY,\n  titre TEXT NOT NULL,\n  date_atelier DATE,\n  coach_id INTEGER NOT NULL,\n  FOREIGN KEY (coach_id) REFERENCES coachs(id)\n);',
    'CREATE TABLE inscriptions (\n  id INTEGER PRIMARY KEY,\n  client_id INTEGER NOT NULL,\n  atelier_id INTEGER NOT NULL,\n  date_inscription DATE,\n  FOREIGN KEY (client_id) REFERENCES clients(id),\n  FOREIGN KEY (atelier_id) REFERENCES ateliers(id)\n);',
    'CREATE TABLE cartes (\n  id INTEGER PRIMARY KEY,\n  client_id INTEGER NOT NULL UNIQUE,\n  seances INTEGER DEFAULT 10 CHECK (seances >= 0),\n  FOREIGN KEY (client_id) REFERENCES clients(id)\n);'],
    'les quatre requêtes de schema.sql, dans l’ordre du fichier');
  for (const k of H.ORDRE) for (const [, l] of H.SQL[k]) assert.ok(l.replace(/<sl\w+\|([^<>]*)>/g, '$1').replace(/[{[]\w+\||[}\]]/g, '').length <= 53, `ligne de ${k} : 53 caractères au plus (« ${l} »)`);
  /* Bulle 16 : une clé étrangère vers une table qui n’existe pas encore ne fonctionne pas (la requête passe, la première ligne est refusée). */
  const tot = fresh();
  tot.run(sqlText('at'));
  assert.throws(() => tot.run("INSERT INTO ateliers VALUES (1, 'Récupération', '2026-09-12', 1);"), /no such table: main\.coachs/, 'la table coachs doit déjà exister');
  tot.close();
  /* Le fichier, exécuté de haut en bas : coachs, ateliers, inscriptions, cartes. */
  assert.deepEqual(H.ORDRE, ['co', 'at', 'in', 'ca']);
  const T = Object.fromEntries(H.ORDRE.map(k => [k, H.TABLES[k][1]]));
  H.ORDRE.forEach((k, i) => {
    /* Chaque table vient après celles auxquelles ses clés étrangères font référence (la table clients existe déjà). */
    const before = ['clients', ...H.ORDRE.slice(0, i).map(x => T[x])];
    db.run(sqlText(k));
    for (const [, to] of JSON.parse(q(`SELECT "from", "table" FROM pragma_foreign_key_list('${T[k]}')`))) assert.ok(before.includes(to), `${T[k]} : la table ${to} existe déjà`);
  });
  assert.equal(names(), '[["ateliers,cartes,clients,coachs,commandes,fidelite,inscriptions,produits"]]', 'la base compte maintenant huit tables');
  /* Les tables de la vidéo (aperçus, tables créées) : les colonnes, leurs types, les clés, et le bouclier 🛡️ des colonnes protégées par une contrainte. */
  for (const k of H.ORDRE) {
    const [, name, cols] = H.TABLES[k];
    assert.equal(name, T[k]);
    assert.equal(q(`SELECT group_concat(name || ' ' || type, ', ') FROM pragma_table_info('${name}')`), JSON.stringify([[cols.map(c => c[0] + ' ' + c[1]).join(', ')]]), `colonnes et types de la table ${name}`);
    assert.equal(q(`SELECT name FROM pragma_table_info('${name}') WHERE pk`), JSON.stringify(cols.filter(c => c[2] === 'pk').map(c => [c[0]])), `clé primaire de la table ${name}`);
    assert.deepEqual(JSON.parse(q(`SELECT "from", "table", "to" FROM pragma_foreign_key_list('${name}') ORDER BY "from"`)),
      cols.filter(c => c[2] && c[2] !== 'pk').map(c => [c[0], H.SUJET[c[2]][0], 'id']).sort(), `clés étrangères de la table ${name}`);
    const unique = JSON.parse(q(`SELECT ii.name FROM pragma_index_list('${name}') il, pragma_index_info(il.name) ii WHERE il."unique" AND il.origin = 'u'`)).map(r => r[0]);
    const ddl = JSON.parse(q(`SELECT sql FROM sqlite_master WHERE name = '${name}'`))[0][0];
    const guarded = JSON.parse(q(`SELECT name, "notnull", dflt_value FROM pragma_table_info('${name}') WHERE NOT pk`))
      .filter(([c, nn, df]) => nn || df !== null || unique.includes(c) || new RegExp(`CHECK \\(${c} `).test(ddl)).map(r => r[0]);
    assert.deepEqual(guarded, cols.filter(c => c[3]).map(c => c[0]), `colonnes protégées (🛡️) de la table ${name}`);
  }
  /* Les flèches du plan : une par clé étrangère, de la table qui fait référence vers la table désignée. */
  assert.deepEqual(H.FLECHES.map(f => [T[f[1]], H.SUJET[f[2]][0]]).sort(),
    JSON.parse(q("SELECT m.name, f.\"table\" FROM sqlite_master m, pragma_foreign_key_list(m.name) f WHERE m.name IN ('ateliers', 'cartes', 'inscriptions') ORDER BY 1, 2")), 'les flèches du plan');
  /* Moment 6 et bulle 37 : les quatre nouvelles tables sont encore vides (aucune ligne, pas même une ligne vide). */
  for (const name of Object.values(T)) assert.equal(q(`SELECT COUNT(*) FROM ${name}`), '[[0]]', `la table ${name} ne contient aucune ligne`);
  /* Moment 1 : UNIQUE laisse l’id vide (NULL), NOT NULL laisse deux fois le même id ; PRIMARY KEY : unique, et jamais vide. */
  db.run('SAVEPOINT m1');
  db.run('CREATE TABLE t_unique (id INTEGER UNIQUE, prenom TEXT); INSERT INTO t_unique VALUES (NULL, \'Salma\'), (NULL, \'Moussa\');');
  assert.equal(q('SELECT COUNT(*) FROM t_unique WHERE id IS NULL'), '[[2]]', 'UNIQUE : l’id pourrait rester vide');
  db.run('CREATE TABLE t_notnull (id INTEGER NOT NULL, prenom TEXT); INSERT INTO t_notnull VALUES (1, \'Salma\'), (1, \'Moussa\');');
  assert.equal(q('SELECT COUNT(*) FROM t_notnull WHERE id = 1'), '[[2]]', 'NOT NULL : deux coachs pourraient avoir le même id');
  db.run("INSERT INTO coachs (prenom, nom) VALUES ('Salma', 'Haddad');");
  assert.equal(q('SELECT id FROM coachs'), '[[1]]', 'PRIMARY KEY : jamais vide (la base attribue l’identifiant)');
  assert.throws(() => db.run("INSERT INTO coachs (id, prenom, nom) VALUES (1, 'Moussa', 'Diallo');"), /UNIQUE constraint failed: coachs\.id/, 'PRIMARY KEY : unique');
  /* Bulles 12 à 14 : la base refuse les lignes qui ne respectent pas les contraintes. */
  assert.throws(() => db.run("INSERT INTO coachs (id, nom) VALUES (2, 'Diallo');"), /NOT NULL constraint failed: coachs\.prenom/, 'prénom obligatoire');
  assert.throws(() => db.run("INSERT INTO coachs (id, prenom) VALUES (2, 'Moussa');"), /NOT NULL constraint failed: coachs\.nom/, 'nom obligatoire');
  db.run("UPDATE coachs SET email = 'salma@pro.fr';");
  assert.throws(() => db.run("INSERT INTO coachs VALUES (2, 'Moussa', 'Diallo', 'salma@pro.fr');"), /UNIQUE constraint failed: coachs\.email/, 'pas deux fois la même adresse');
  db.run('ROLLBACK TO m1'); db.run('RELEASE m1');
  assert.equal(names(), '[["ateliers,cartes,clients,coachs,commandes,fidelite,inscriptions,produits"]]', 'rien n’est gardé des essais');
  /* Les données du fichier entrent toutes (ce que Karim enregistrera ensuite avec INSERT, au chapitre 5). */
  const v = x => typeof x === 'string' ? `'${x}'` : x, rows = a => a.map(r => `(${r.map(v).join(', ')})`).join(', ');
  db.run('SAVEPOINT data');
  db.run(`INSERT INTO coachs VALUES ${rows(H.COACHS.map(c => c.slice(0, 4)))}; INSERT INTO ateliers VALUES ${rows(H.ATELIERS)};
    INSERT INTO inscriptions VALUES ${rows(H.INSCR.concat([H.NOUVELLE]))}; INSERT INTO cartes VALUES ${rows(H.CARTES)};`);
  assert.equal(q('SELECT (SELECT COUNT(*) FROM coachs), (SELECT COUNT(*) FROM ateliers), (SELECT COUNT(*) FROM inscriptions), (SELECT COUNT(*) FROM cartes)'), '[[4,5,7,3]]');
  /* Moment 3 et bulle 20 : date_atelier est de type DATE, coach_id un entier. SQLite n’a pas de stockage propre aux dates : la valeur « année-mois-jour » est gardée en texte. */
  assert.equal(q("SELECT name, type FROM pragma_table_info('ateliers') WHERE name IN ('date_atelier', 'coach_id') ORDER BY name"), '[["coach_id","INTEGER"],["date_atelier","DATE"]]');
  assert.equal(q("SELECT type FROM pragma_table_info('inscriptions') WHERE name = 'date_inscription'"), '[["DATE"]]', 'la date d’une inscription aussi');
  assert.equal(q('SELECT DISTINCT typeof(date_atelier), typeof(coach_id) FROM ateliers'), '[["text","integer"]]');
  assert.equal(q("SELECT strftime('%d/%m/%Y', date_atelier) FROM ateliers WHERE id = 1"), q("SELECT strftime('%d/%m/%Y', '" + H.ATELIERS[0][2] + "')"), 'une date « année-mois-jour » se lit comme une date');
  /* Moment 4 et bulle 25 : pas d’atelier sans coach (ni avec un coach qui n’existe pas). */
  assert.throws(() => db.run("INSERT INTO ateliers (id, titre, date_atelier) VALUES (6, 'Stretching', '2026-10-10');"), /NOT NULL constraint failed: ateliers\.coach_id/, 'coach_id obligatoire');
  assert.throws(() => db.run("INSERT INTO ateliers VALUES (6, 'Stretching', '2026-10-10', 9);"), /FOREIGN KEY constraint failed/, 'un coach qui existe');
  assert.throws(() => db.run("INSERT INTO ateliers (id, date_atelier, coach_id) VALUES (6, '2026-10-10', 1);"), /NOT NULL constraint failed: ateliers\.titre/, 'un titre obligatoire');
  /* Bulle 27 : une inscription concerne toujours un client et un atelier. */
  assert.throws(() => db.run("INSERT INTO inscriptions (id, atelier_id, date_inscription) VALUES (8, 1, '2026-09-08');"), /NOT NULL constraint failed: inscriptions\.client_id/);
  assert.throws(() => db.run("INSERT INTO inscriptions (id, client_id, date_inscription) VALUES (8, 2, '2026-09-08');"), /NOT NULL constraint failed: inscriptions\.atelier_id/);
  /* Bulle 29 : une carte a toujours un propriétaire. Moment 5 : UNIQUE, DEFAULT 10, CHECK (seances >= 0). */
  assert.throws(() => db.run('INSERT INTO cartes (id, seances) VALUES (4, 10);'), /NOT NULL constraint failed: cartes\.client_id/, 'un propriétaire');
  assert.throws(() => db.run('INSERT INTO cartes VALUES (4, 1, 10);'), /UNIQUE constraint failed: cartes\.client_id/, 'un client n’a qu’une seule carte');
  db.run('INSERT INTO cartes (id, client_id) VALUES (4, 2);');
  assert.equal(q('SELECT seances FROM cartes WHERE id = 4'), '[[10]]', 'une nouvelle carte commence avec 10 séances');
  db.run('UPDATE cartes SET seances = 0 WHERE id = 4;');
  assert.equal(q('SELECT seances FROM cartes WHERE id = 4'), '[[0]]', 'le solde peut tomber à 0');
  assert.throws(() => db.run('UPDATE cartes SET seances = -1 WHERE id = 4;'), /CHECK constraint failed: seances >= 0/, 'mais pas en dessous');
  db.run('ROLLBACK TO data'); db.run('RELEASE data');
  /* L’état de fin (contrat de continuité avec le chapitre 5) : huit tables, les quatre nouvelles vides, avec les colonnes du schéma canonique. */
  assert.deepEqual(['coachs', 'ateliers', 'inscriptions', 'cartes'].map(t => q(`SELECT group_concat(name) FROM pragma_table_info('${t}')`)), ['[["id,prenom,nom,email"]]',
    '[["id,titre,date_atelier,coach_id"]]', '[["id,client_id,atelier_id,date_inscription"]]', '[["id,client_id,seances"]]'], 'état de fin du chapitre 4');
  assert.equal(q('SELECT (SELECT COUNT(*) FROM coachs) + (SELECT COUNT(*) FROM ateliers) + (SELECT COUNT(*) FROM inscriptions) + (SELECT COUNT(*) FROM cartes)'), '[[0]]', 'tables vides');
  assert.equal(q("SELECT dflt_value FROM pragma_table_info('cartes') WHERE name = 'seances'"), '[["10"]]');
  db.close();
});
