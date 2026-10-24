/* Projet NutriBoost, chapitre 5 (leçon 65 « ALTER TABLE ») : la vidéo interactive assets/anim/projet-alter.html.
   Tests propres à la page. Les trois tests communs (fiche de la leçon dans index.html, sw.js, poids) arrivent avec l’entrée
   COURSES que l’orchestrateur ajoute à tests/lesson-video.test.mjs lors de l’intégration : ce fichier ne lit ni index.html
   (sauf la base SCHEMA_SQL de l’app et le son « buzz » du téléphone), ni sw.js. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '..');
const ANIM = path.join(ROOT, 'assets/anim');
/* ====== À adapter ====== */
const FILE = 'projet-alter.html';
const THUMB = ['projet-alter-thumb.jpg', 'projet-alter-thumb.webp'].find(f => fs.existsSync(path.join(ANIM, f))) || 'projet-alter-thumb.jpg';
const KINDS = ['pick', 'tap', 'pick', 'sort', 'pick', 'sort'];          // suite des gestes de PICKS (jamais deux fois de suite le même)
const TABLE = 'ateliers';                                               // « la <b>table ateliers</b> » au moins une fois, jamais « dans ateliers »
/* Chapitre 3 : « Une colonne sans DEFAULT » et non « Une colonne vide » (scénario) : la puce reste affichée pendant le moment 3,
   et ce titre y donnait la réponse (NULL). */
const LABELS = ['Les demandes', 'Ajouter une colonne', 'Une colonne sans DEFAULT', 'Renommer une colonne', 'Supprimer une colonne', 'Structure ou valeurs', 'À retenir'];
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
  /* Aucune bulle de quatre lignes : une phrase trop longue devient deux bulles (demande d’Elisa, 23 et 24 oct.). Les cinq phrases qui tenaient en quatre lignes
     sont donc coupées en deux bulles, chacune d’au plus trois lignes, et plus aucune légende n’a de 4e valeur. */
  assert.equal((page.match(/\n\s*\[[\d.]+, [\d.]+,\s+("[^\n]*"|'[^\n]*'), 4\],?/g) || []).length, 0, 'aucune légende de quatre lignes');
  assert.ok(D.CAPTIONS.every(c => c[2].split('<br>').length <= 3 && (c[3] || 3) <= 3), 'trois lignes au plus, 4e valeur absente');
  for (const s of ['"Pour enregistrer le nombre de places<br>de chaque atelier, on ajoute<br>une colonne <code>places</code>."',
    '"Cette colonne s’ajoute<br>dans la <b>table ateliers</b>."',
    '"Avec <code>DEFAULT 12</code>, la colonne <code>places</code><br>contient 12 dès son ajout."',
    '"Cela vaut pour chacun<br>des cinq ateliers déjà enregistrés."',
    '"On l’ajoute donc dans une colonne<br><code>telephone</code> de la <b>table coachs</b>."',
    '"Le numéro est renseigné<br>une seule fois par coach."',
    '"Les coachs reçoivent de nombreux<br>appels et messages pendant les cours."',
    '"Ce sont des questions<br>que l’accueil peut gérer."',
    '"Dans le prochain chapitre,<br>tu apprendras à supprimer<br>une table entière."',
    '"Tu le feras avec <code>DROP TABLE</code> :<br>la table disparaît<br>avec toutes ses données."'])
    assert.ok(page.includes(s), `légende découpée : ${s.slice(0, 60)}`);
  /* Même budget que le test COURSES : page + vignette + moteur + GSAP + mascotte + 5 polices < 450 Kio. */
  const FONTS = ['jetbrains-mono.woff2', 'inter-medium.woff2', 'inter-semibold.woff2', 'inter-bold.woff2', 'inter-extrabold.woff2'];
  let total = 0;
  for (const f of [FILE, 'core.css', 'core.js', 'gsap.min.js', 'mascotte.webp', THUMB]) total += fs.statSync(path.join(ANIM, f)).size;
  for (const f of FONTS) total += fs.statSync(path.join(ROOT, 'assets/fonts', f)).size;
  assert.ok(total < 470 * 1024, `animation et ressources : ${Math.round(total / 1024)} Kio`);
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
  assert.equal(before[2], 'Pour finir, voici les <b>trois idées à retenir</b>.');
  /* Jamais de carte de légende vide : entre deux légendes éloignées de plus d’une seconde, la carte s’efface (capOff) puis revient (capOn). */
  const offs = [...page.matchAll(/capOff\(([\d.]+)\)/g)].map(m => +m[1]), ons = [...page.matchAll(/capOn\(([\d.]+)\)/g)].map(m => +m[1]);
  caps.slice(1).forEach(([a], k) => {
    const b = caps[k][1];
    if (a - b > 1) assert.ok(offs.some(t => Math.abs(t - (b - 0.2)) <= 0.11) && ons.some(t => t >= a - 0.3 && t <= a), `trou de légende entre ${b} et ${a} : capOff(${+(b - 0.2).toFixed(2)}) et capOn dans [${+(a - 0.3).toFixed(2)} ; ${a}]`);
  });
  assert.ok(page.includes(`la <b>table ${TABLE}</b>`) && !new RegExp(`dans ${TABLE}\\b`).test(page), `« la table ${TABLE} »`);
  assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page), 'SQL n’est jamais personnifié');
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  /* « Numéro » ne reste que pour ce qui en est un : le téléphone des coachs (et celui des clients). Jamais pour la valeur d’une clé. */
  const code = strip(page);
  assert.ok(code.includes('numéros de téléphone') && code.includes('Le numéro de téléphone est une information sur le coach.'), 'le numéro de téléphone des coachs');
  assert.ok(!/num[ée]ros? (de |d’|du )(client|atelier|carte|ligne|inscription)s?\b|num[ée]ros? d[’']identifiant|\bid\b.{0,12}num[ée]ro|num[ée]ro.{0,12}\bid\b/i.test(code), '« identifiant », jamais « numéro », pour une valeur de clé');
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
  assert.ok(page.includes('PICKS.forEach(p => cut(p.at - 1.35, 1.25));') || page.includes('.forEach(([t0, i]) => cut(t0, +(PICKS[i].at - 0.1 - t0).toFixed(2)));'), 'l’attente avant chaque arrêt est coupée');
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

/* ---------- Propre au chapitre 5 ---------- */

test(`${FILE} : intro, bulles du scénario mot pour mot, mails, annonce du chapitre 6 et récapitulatif`, () => {
  assert.ok(page.includes('<div class="tagpill">Projet · Chapitre 5</div>') && page.includes('<span>A</span><span>L</span><span>T</span><span>E</span><span>R</span>')
    && page.includes('<div class="abs sub">Faire évoluer les tables</div>'), 'écran titre : « Projet · Chapitre 5 », ALTER, « Faire évoluer les tables »');
  assert.ok(page.includes('<div class="abs bubble">Les ateliers ont commencé&nbsp;:<br>à toi d’adapter les tables sans les recréer.</div>'), 'bulle de la mascotte');
  /* Les bulles du scénario validé, dans l’ordre (les « À toi ! » mis à part) ; seuls les <br> et les espaces insécables sont libres. */
  const BULLES = [
    'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.',
    'Au chapitre 4, tu as créé les tables des ateliers avec CREATE TABLE.',
    'Karim y a enregistré les coachs, les ateliers, les inscriptions et les premières cartes de membre.',
    'Les premières séances amènent aussi des demandes de changement.',
    'Pour enregistrer le nombre de places de chaque atelier, on ajoute une colonne places.',
    'Cette colonne s’ajoute dans la table ateliers.',
    'CREATE TABLE sert à créer une nouvelle table.',
    'Ici, la table ateliers existe déjà : pour lui ajouter une colonne en conservant ses données, on utilise ALTER TABLE.',
    'On la modifie donc avec ALTER TABLE, qui change la structure d’une table existante.',
    'ADD COLUMN ajoute une colonne, avec son nom et son type.',
    'Avec DEFAULT 12, la colonne places contient 12 dès son ajout.',
    'Cela vaut pour chacun des cinq ateliers déjà enregistrés.',
    'Leurs titres, dates et coachs restent intacts : aucune ligne n’est perdue.',
    'Le numéro de téléphone est une information sur le coach.',
    'On l’ajoute donc dans une colonne telephone de la table coachs.',
    'Le numéro est renseigné une seule fois par coach.',
    'Chaque coach a son propre numéro : on n’écrit donc pas de DEFAULT.',
    'Sans DEFAULT, les lignes existantes reçoivent NULL : la case reste vide.',
    'Quelques jours plus tard, Karim y enregistre le numéro de chaque coach.',
    'Il utilise pour cela UPDATE, qui change des valeurs : tu le découvriras bientôt.',
    'Pour renommer une colonne, on écrit RENAME COLUMN.',
    'Après RENAME COLUMN, on indique le nom actuel, seances, puis TO suivi du nouveau nom, seances_restantes.',
    'Les valeurs restent inchangées.',
    'La colonne s’appelle maintenant seances_restantes.',
    'Chaque carte conserve son nombre de séances : 10, 5 et 8.',
    'La contrainte CHECK suit le nouveau nom : seances_restantes >= 0.',
    'Sur le même modèle, ALTER TABLE cartes RENAME TO cartes_membre renommerait la table elle-même.',
    'Les coachs reçoivent de nombreux appels et messages pendant les cours.',
    'Ce sont des questions que l’accueil peut gérer.',
    'Ils souhaitent pouvoir se concentrer sur leurs séances.',
    'DROP COLUMN supprime la colonne, et toutes ses valeurs avec elle.',
    'Une colonne supprimée ne se récupère pas : il faudrait redemander leurs numéros aux coachs.',
    'Julie prévient que l’atelier Cuisine saine déménage dans une cuisine plus petite, de 8 places.',
    'Cette fois, aucune colonne ne change : seule la valeur de l’atelier Cuisine saine passe de 12 à 8.',
    'Comme pour les numéros des coachs, Karim s’en charge avec UPDATE.',
    'Avec DROP COLUMN, on supprime la colonne age et tous les âges qu’elle contient.',
    'UPDATE permet de modifier les valeurs en conservant la colonne.',
    'Dans le prochain chapitre, tu apprendras à supprimer une table entière.',
    'Tu le feras avec DROP TABLE : la table disparaît avec toutes ses données.',
    'Pour finir, voici les trois idées à retenir.',
    'Ajoute ce résumé à tes notes pour le retrouver facilement.'];
  assert.deepEqual(D.CAPTIONS.map(c => flat(c[2])).filter(t => t !== 'À toi !'), BULLES, 'les bulles du scénario, mot pour mot');
  /* Les quatre mails : Julie Nguyen (12 places), Diego Ramos (les numéros des coachs), l’équipe NutriBoost (seances prête à confusion), puis de nouveau
     l’équipe NutriBoost (l’accueil centralise les demandes : les numéros des coachs ne sont plus conservés). Chaque mail, le dernier aussi, se termine par « Merci ! » et sa signature. */
  assert.deepEqual(D.MAILS.map(m => [m[0][0] + ' ' + m[0][1], m[1], m[2], m[3], m[5]]), [['Julie Nguyen', 'k-co', 'coach', 'julie@mail.fr', 'Julie'],
    ['Diego Ramos', 'k-co', 'coach', 'diego@mail.fr', 'Diego'], ['L’équipe NutriBoost', 'k-nb', 'équipe', 'equipe@nutriboost.fr', 'L’équipe NutriBoost'],
    ['L’équipe NutriBoost', 'k-nb', 'équipe', 'equipe@nutriboost.fr', 'L’équipe NutriBoost']], 'expéditeurs');
  assert.deepEqual(D.MAILS.map(m => m[4]), [
    ['Je suis Julie, la coach de l’atelier Cuisine saine.', 'Nos salles accueillent au maximum 12 personnes. Peux-tu enregistrer le nombre de places de chaque atelier ?'],
    ['Je suis Diego, le coach de l’atelier Méditation.', 'Les clients aimeraient pouvoir appeler leur coach avant la séance. Peux-tu ajouter nos numéros de téléphone dans la base ?'],
    ['La colonne seances indique le nombre de séances qu’un client peut encore utiliser. Son nom prête à confusion : l’équipe d’accueil pense parfois qu’il s’agit des séances déjà suivies.',
      'Peux-tu la renommer seances_restantes, en conservant les valeurs actuelles ?'],
    ['Désormais, l’accueil centralise les demandes des clients. Nous ne souhaitons plus conserver les numéros personnels des coachs dans cette base.']], 'demandes, mot pour mot');
  assert.ok(page.includes("['<span class=\"sn2\">Merci !</span>', `<span class=\"sn2 s\">${sign}</span>`]).join('');") && !page.includes('sign ? ['), 'chaque mail : « Merci ! » et sa signature');
  /* Chaque mail arrive avant le moment qui s’en sert ; le quatrième, juste avant le moment 5 (la requête qui retire les numéros),
     et « Revoir » du moment 5 repart avant lui pour que le mail se relise. */
  assert.ok(D.OPENS[0].at < D.PICKS[0].from && D.OPENS[1].at < D.PICKS[1].at && D.OPENS[1].at > D.PICKS[0].at && D.OPENS[2].at < D.PICKS[3].at && D.OPENS[2].at > D.PICKS[2].at
    && D.OPENS[3].at < D.PICKS[4].at && D.OPENS[3].at > D.PICKS[3].at && D.PICKS[4].from < D.OPENS[3].at, 'chaque mail avant son moment');
  /* L’annonce du chapitre suivant, sous son vrai titre. */
  assert.ok(page.includes('<span class="emo">🗑️</span>Chapitre 6 · DROP</span>'), 'pilule « 🗑️ Chapitre 6 · DROP »');
  /* La suite de la fin du chapitre 4 : une table qui vient d’être créée affiche « 0 ligne » ; Karim arrive dans la même pilule
     (KB, ✍️, la commande) : INSERT INTO quand il remplit les tables, puis UPDATE quand il change des valeurs. */
  assert.ok(page.includes('<i class="e">0 ligne</i>') && !page.includes('<i class="e">vide</i>'), '« 0 ligne », comme au chapitre 4');
  assert.ok(["kbp('kb1', 'INSERT INTO')", "kbp('kb2', 'UPDATE', 'up2')", "kbp('kb6', 'UPDATE', 'up6')"].every(s => page.includes(s)) && !page.includes("who('kb"), 'Karim : la pilule du chapitre 4, INSERT INTO puis UPDATE');
  /* Les trois idées à retenir : un titre, puis sa précision (chaque ligne en a une). */
  const recap = page.slice(page.indexOf('<div class="abs card recap" id="recap">'), page.indexOf('</section>', page.indexOf('id="recap"')));
  const rows = [...recap.matchAll(/<div class="rtxt">([\s\S]*?)<\/div><\/div>/g)].map(m => m[1]);
  const phrase = r => flat(r.split('<span class="rs">')[0]), prec = r => r.includes('<span class="rs">') ? flat(r.slice(r.indexOf('<span class="rs">'))) : null;
  assert.deepEqual(rows.map(r => [phrase(r), prec(r)]), [
    ['Modifier une table', 'ALTER TABLE permet d’ajouter, de renommer ou de supprimer une colonne d’une table existante.'],
    ['Ajouter une colonne', 'Avec ADD COLUMN, les lignes déjà présentes reçoivent la valeur définie par DEFAULT, ou NULL si aucune valeur par défaut n’est prévue et que la colonne l’autorise.'],
    ['Distinguer structure et valeurs', 'ALTER TABLE modifie la structure ; UPDATE modifie les valeurs. Renommer une colonne conserve son contenu. La supprimer efface toutes les données de cette colonne.']], 'récapitulatif');
  assert.ok(['🛠️', '➕', '🔄'].every(e => recap.includes(`<div class="rico emo">${e}</div>`)), 'emoji des trois idées');
});

test(`${FILE} : les six moments du scénario, leurs corrections et leurs indices, la réponse posée juste après l’arrêt`, () => {
  const P = D.PICKS, opt = (i, k) => P[i].options[k];
  /* 1 · le trou de la requête : DEFAULT 12 */
  assert.equal(P[0].prompt, 'Que faut-il ajouter pour que les cinq ateliers aient 12 places ?');
  assert.deepEqual(P[0].options, [{label: 'NOT NULL', why: 'NOT NULL exige une valeur, et les cinq ateliers n’en auraient aucune : la requête serait refusée.'},
    {label: 'DEFAULT 12', ok: true}, {label: 'CHECK (places = 12)', why: 'CHECK vérifie les valeurs sans en donner : les ateliers n’auraient aucune valeur.'}]);
  assert.ok(!P[0].text && page.includes("['pl2', '  ADD COLUMN {plc|places} {pli|INTEGER} <sl0|DEFAULT 12>;']") && page.includes("slot: i => (i === 0 ? rel($('#sl0')) : null),"), 'étiquette envolée jusqu’au trou de la requête');
  /* 2 · la table où ranger les numéros : coachs */
  assert.ok(P[1].prompt === 'Touche la table où ajouter ces numéros de téléphone.' && P[1].need === 1);
  const W = load(FILE, 'TAP_WHY, NOMS, OPS, DEMANDES, TABLES');
  assert.deepEqual(W.TAP_WHY, {cl: 'La table clients a déjà une colonne telephone : ce sont les numéros des clients.',
    at: 'Moussa Diallo anime deux ateliers : son numéro serait écrit deux fois.', in: 'Une inscription relie un client à un atelier : elle ne décrit pas un coach.',
    ca: 'Une carte appartient à un client, pas à un coach.'}, 'une correction par mauvaise table');
  assert.deepEqual(W.TABLES.map(t => t[0]).sort(), ['ca', 'cl', 'co', 'in', 'at'].sort(), 'cinq tables à toucher');
  assert.ok(page.includes("if (a === 'co') {") && page.includes("const M2_ANS = ['#sr-co .rg'];"), 'réponse : coachs');
  /* 3 · ce que contient la colonne : NULL */
  assert.ok(P[2].text && P[2].prompt === 'Que contient la colonne telephone pour les quatre coachs, juste après son ajout ?');
  assert.deepEqual(P[2].options, [{label: 'NULL\u00a0: aucune valeur', ok: true}, {label: 'Une chaîne vide \'\'', why: 'Une chaîne vide est déjà une valeur : sans DEFAULT, la base n’en donne aucune.'},
    {label: 'Le numéro de chaque coach', why: 'Ces numéros ne sont pas encore dans la base : personne ne les a saisis.'}]);
  /* 4 · l’ancien nom, puis le nouveau */
  assert.ok(P[3].prompt === 'Place chaque nom au bon endroit de la requête.' && P[3].hint === 'Touche un nom, puis sa place dans la requête. Tu peux aussi le faire glisser directement.'
    && P[3].next === '{x} : touche maintenant sa place dans la requête.');
  assert.deepEqual(W.NOMS, [['seances_restantes', 'new', 'seances_restantes est le nouveau nom : il vient après TO.'], ['seances', 'old', 'seances est l’ancien nom : il vient juste après RENAME COLUMN.']]);
  assert.deepEqual(P[3].options.map(o => o.label), ['seances_restantes', 'seances'], 'le nouveau nom d’abord : pas l’ordre des deux trous');
  /* Deux zones de toute la largeur de la requête, l’une sous l’autre, sans chevauchement (et non deux bandes de la taille des trous). */
  assert.ok(page.includes("return [{k: 'old', label: 'Après RENAME COLUMN', x: q.x, y: a.y, w: q.w, h: c.y - a.y}, {k: 'new', label: 'Après TO', x: q.x, y: c.y, w: q.w, h: q.y + q.h + 9 - c.y}];"), 'moment 4 : zones larges');
  /* Une mauvaise place montre le nom posé, en rouge, dans le trou (comme au moment 1) ; un trou déjà rempli cache sa réponse le temps du geste. */
  assert.ok(page.includes("s.querySelector('.sx').textContent = NOMS[a][0];") && page.includes("flash(s.querySelector('.sx'), 'pvs', 1300); flash(s.querySelector(full ? '.sv' : '.se'), 'pvh', 1300); flash(s, 'kob', 480);"), 'moment 4 : le nom mal placé se voit');
  /* 5 · la requête qui retire les numéros et leur colonne */
  assert.ok(P[4].text && P[4].prompt === 'Quelle requête retire les numéros et leur colonne de la table coachs ?');
  assert.deepEqual(P[4].options, [{label: 'ALTER TABLE coachs RENAME COLUMN telephone TO ancien_telephone', why: 'Renommer garde la colonne et ses numéros : seul son nom changerait.'},
    {label: 'UPDATE coachs SET telephone = NULL', why: 'Les numéros seraient effacés, mais la colonne telephone resterait, vide.'}, {label: 'ALTER TABLE coachs DROP COLUMN telephone', ok: true}]);
  /* 6 · structure ou valeurs */
  assert.ok(P[5].prompt === 'Range chaque demande selon la requête qui la réalise.' && P[5].next === '« {x} » : quelle requête ?');
  assert.deepEqual(W.OPS.map(o => o[2]), ['ADD COLUMN', 'RENAME COLUMN', 'DROP COLUMN', 'UPDATE'], 'les quatre cases');
  assert.deepEqual(W.DEMANDES, [['Passer l’atelier Pilates à 10 places', 'upd', 'Aucune colonne ne change : seule une valeur change.'],
    ['Ne plus conserver l’âge des clients', 'drop', 'La colonne disparaît, avec toutes ses valeurs.'],
    ['Noter la salle de chaque atelier', 'add', 'Une nouvelle information à enregistrer : il faut une colonne de plus.'],
    ['Donner le nom email_pro à la colonne email des coachs', 'ren', 'La colonne garde ses valeurs, sous un autre nom.']]);
  /* Le plateau range les demandes deux par deux, comme les cases : aucune demande n’est à la place de sa case. */
  assert.ok(W.DEMANDES.every((d, q) => d[1] !== W.OPS[q][0]), 'moment 6 : les demandes ne suivent pas l’ordre des cases');
  /* Pendant « Avec DROP COLUMN, on supprime la colonne age… » : la case DROP COLUMN s’allume et la demande sur l’âge pulse (où qu’elle soit dans la liste) ;
     pendant « UPDATE permet de modifier les valeurs… » : la case UPDATE s’allume à son tour, avec la demande qui lui revient. */
  assert.ok(page.includes("const cdrop = '#rc' + DEMANDES.findIndex(d => d[1] === 'drop'), cupd = '#rc' + DEMANDES.findIndex(d => d[1] === 'upd');")
    && page.includes("pulse(cdrop, 202, 1, 'rgba(201,188,255,.8)');") && page.includes("pulse(cupd, 207.3, 1, 'rgba(201,188,255,.8)');")
    && page.includes("tl.to('#rb-drop', {scale: 1.04,") && page.includes("tl.to('#rb-upd', {scale: 1.04,"), 'moment 6 : la case et la demande de chaque bulle s’allument');
  /* Une case remplie passe en trait plein pendant l’arrêt, comme la timeline juste après : la reprise ne saute pas. */
  assert.ok(page.includes('.rbin.pvb{border-style:solid!important}') && page.includes("mark(bin, 'pvb');") && page.includes("tl.set('.rbin', {borderStyle: 'solid'}, a5);"), 'moment 6 : trait plein dans l’aperçu');
  /* L’indice 💡 de chaque moment, après deux erreurs : une piste, passée par la typographie française. */
  for (const h of ["if (i === 0) return {text: 'Il faut une valeur de départ, donnée aussi aux ateliers déjà enregistrés.'};",
    "if (i === 1) return {text: 'Ce numéro décrit un coach : dans quelle table chaque coach a-t-il une seule ligne ?', keys: ['co']};",
    "if (i === 2) return {text: 'Sans DEFAULT, la base ne devine aucune valeur pour les lignes déjà là.'};",
    "if (i === 3) return {text: 'On part de la colonne qui existe aujourd’hui, puis on donne son nouveau nom.'};",
    "if (i === 4) return {text: 'Les coachs ne veulent plus de cette colonne du tout, pas seulement des numéros.'};",
    "if (i === 5) return {text: 'Pour chaque demande : faut-il ajouter, renommer ou retirer une colonne, ou changer une valeur ?'};",
    'return h && Object.assign(h, {text: fr(h.text)});'])
    assert.ok(page.includes(h), `indice : ${h.slice(0, 60)}`);
  /* La réponse de chaque moment, posée par la timeline juste après l’arrêt (aN = at + 0,02), la même que l’aperçu. */
  for (const s of ["tl.set(M1_ANS.on, {autoAlpha: 1}, a0); tl.set(M1_ANS.off, {autoAlpha: 0}, a0);", 'tl.set(M2_ANS, {autoAlpha: 1}, a1);',
    "tl.set('#tc-co', {'--w4': '260px'}, a2);", 'tl.set(M3_ANS, {autoAlpha: 1}, a2);', "tl.set(M4_ANS.on, {autoAlpha: 1}, a3); tl.set(M4_ANS.off, {autoAlpha: 0}, a3);",
    'tl.set(M5_ANS, {autoAlpha: 1}, a4);', 'tl.set(M6_ANS, {autoAlpha: 1}, a5);', "if (ok) { mark($('#tc-co'), 'pv-w4'); marks(M3_ANS); mark($('#mtl'), 'pvh'); }", 'if (ok) marks(M5_ANS);', "#tc-co.pv-w4{--w4:260px!important}"])
    assert.ok(page.includes(s), `réponse : ${s}`);
  /* Moment 3 : la puce « + telephone » (la colonne qui manque) s’efface avec la réponse, comme « + places » au moment 1 ; elle revient dans l’aperçu d’une mauvaise réponse. */
  for (const s of ["tl.set('#mtl', {autoAlpha: 0}, a2);", "flash($('#tc-co'), 'pv-w4', 1300); flashAll(M3_ANS, 'pvs', 1300); flash($('#mtl'), 'pvh', 1300);"])
    assert.ok(page.includes(s), `moment 3 : ${s}`);
  /* Moment 1, CHECK : l’aperçu ouvre la colonne places (vide) ; « + places » (la colonne qui manque) s’efface avec. */
  assert.ok(page.includes("flashAll(['#tb-at .r .c4 .p0'], 'pvh', 1300); flash($('#mpl'), 'pvh', 1300); }"), 'moment 1 : aperçu de CHECK cohérent');
  /* Moment 2 : juste avant l’arrêt, rien n’attire l’œil sur une mauvaise table (la puce places de la table ateliers ne bouge pas). */
  assert.ok(!page.includes("bump('#sr-at .pl'"), 'moment 2 : pas de geste sur la table ateliers');
  [0, 1, 2, 3, 4, 5].forEach(i => assert.ok(page.includes(`const a${i} = +(PICKS[${i}].at + 0.02).toFixed(2);`), `a${i}`));
  /* Les gestes de la timeline, chacun pendant la bulle qui en parle. */
  /* La colonne telephone s’effrite de bas en haut, son nom en dernier : chaque case tombe sur une case déjà vide. */
  for (const s of ["addCol('tb-at', 4, 150, 53.7, 0.16);", "swap(`#lc-${k} .e`, `#lc-${k} .f`, t, false);",
    "crumble(COACHS.map(([id]) => `#tc-co-r${id} .c4 .l1`).reverse().concat('#tc-co .hd .c4 .h0').map(s => $(s)), 172.6);", "swap('#hsw .o', '#hsw .n', 125.4);",
    "swap('#cksw .o', '#cksw .n', 132.75);", "swap(`#tb-at-r${CUISINE[0]} .c4 .p0`, `#tb-at-r${CUISINE[0]} .c4 .p2`, 190.9);", "COACHS.forEach(([id], k) => swap(`#tc-co-r${id} .c4 .l0`, `#tc-co-r${id} .c4 .l1`, 95.5 + k * 0.4));"])
    assert.ok(page.includes(s), `geste : ${s}`);
  /* … et chacun tombe pendant la bulle qui le dit (début de la bulle ≤ geste ≤ fin). */
  const during = (t, start) => { const c = D.CAPTIONS.find(c => flat(c[2]).startsWith(start)); assert.ok(c && t >= c[0] && t <= c[1], `geste à ${t} s pendant « ${start}… »`); };
  during(53.7, 'Avec DEFAULT 12'); during(95.5, 'Quelques jours plus tard'); during(125.4, 'La colonne s’appelle maintenant'); during(132.75, 'La contrainte CHECK');
  during(172.6, 'DROP COLUMN supprime la colonne'); during(190.9, 'Cette fois, aucune colonne ne change');
});

test(`${FILE} : le téléphone d’un coach (deux vagues de notifications, message de Léa Simon), puis le quatrième mail`, () => {
  const T = load(FILE, 'NOTIF1, PHONE_MSG, NOTIF2');
  /* Première vague : six notifications (message : m, appel manqué : x), la plus ancienne en bas ; le message de Léa Simon s’ouvre. */
  assert.deepEqual(T.NOTIF1, [['Léa Simon', 'm', 'Message'], ['Sophie Martin', 'x', 'Appel manqué'], ['Nathan Petit', 'm', 'Message'],
    ['Lucas Bernard', 'x', 'Appel manqué'], ['Chloé Moreau', 'm', 'Message'], ['Emma Dubois', 'm', 'Message']], 'première vague');
  assert.equal(T.PHONE_MSG, 'Bonjour coach, je suis dans les bouchons… J’arrive dans 15 minutes. Je sais que le cours a commencé, mais j’aimerais beaucoup y participer. Pouvez-vous m’attendre ?');
  /* Seconde vague : 💬 une question, 📞 un appel entrant, 💬, 📞 3 appels manqués, 💬. Chaque client porte son prénom et son nom. */
  assert.deepEqual(T.NOTIF2, [['Hugo Laurent', 'm', 'Le cours est dans quelle salle ?'], ['Chloé Moreau', 'c', 'Appel entrant…'], ['Lucas Bernard', 'm', 'Il faut apporter un tapis ?'],
    ['Nathan Petit', 'x', '3 appels manqués'], ['Emma Dubois', 'm', 'Je peux venir avec une amie ?']], 'seconde vague');
  assert.ok(T.NOTIF1.concat(T.NOTIF2).every(n => /^\S+ \S+$/.test(n[0])), 'chaque client avec son prénom et son nom');
  /* « …pour des questions que l’accueil peut gérer » : les trois messages de la seconde vague s’entourent, de haut en bas (le plus récent est en haut). */
  assert.deepEqual(T.NOTIF2.map((n, k) => [k, n[1]]).filter(([, kind]) => kind === 'm').map(([k]) => k).reverse(), [4, 2, 0], 'les trois messages de questions');
  /* Le téléphone entre au centre ; l’image reste le temps de lire le message de Léa Simon ; la légende revient avec la première bulle. */
  for (const s of ["show('#ph', p, {y: 170, scale: 0.92}, 0.7, 'back.out(1.3)');", 'hold(p + 5.5, Math.ceil(readTime(PHONE_MSG) * 20) / 20);', '[4, 2, 0].forEach((k, q) =>',
    "sceneOn('#sp', 141.35);\n  phoneScene(141.4);\n  capOn(151.05);\n  capOff(162.3);\n  sceneOff('#sp', 162.95);"])
    assert.ok(page.includes(s), `téléphone : ${s.slice(0, 70)}`);
  const [c1, cq, c2] = ['Les coachs reçoivent de nombreux', 'Ce sont des questions', 'Ils souhaitent pouvoir'].map(s => D.CAPTIONS.find(c => flat(c[2]).startsWith(s)));
  assert.ok(c1 && cq && c2 && c1[0] >= 141.4 + 9.5 && c2[1] <= 162.95 && c1[1] < cq[0] && cq[1] < c2[0], 'les trois bulles du téléphone (appels et messages, questions, concentration) sont lues dans l’ordre pendant la scène, après les deux vagues');
  /* La phrase coupée en deux : les trois messages de questions s’entourent pendant « Ce sont des questions que l’accueil peut gérer. », pas avant. */
  assert.ok(141.4 + 14.9 >= cq[0] && 141.4 + 14.9 + 2 * 0.55 <= cq[1], 'les trois messages s’entourent pendant « Ce sont des questions que l’accueil peut gérer. »');
  /* Le téléphone vibre à chaque notification : un nombre pair de mouvements (répétition impaire + 1), pour qu’il revienne exactement à sa place. */
  const buzzes = [...page.matchAll(/\bbuzz\(([^()]*)\);/g)].map(m => m[1].split(', ')).map(a => a.length > 1 ? +a[1] : 5);
  assert.ok(buzzes.length === 3 && buzzes.every(n => n % 2 === 1), `vibrations : ${buzzes}`);
  assert.ok(page.includes("cue(t, 'buzz', 0.55);") && fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes("case 'buzz':{"), 'le son « buzz » existe dans l’app (un son inconnu resterait muet)');
  /* Le message de l’équipe arrive juste après le téléphone ; l’app s’arrête dessus 1,1 s après son entrée, comme pour les trois autres mails. */
  assert.ok(page.includes("sceneOn('#sm', 163.05);\n  mailIn(4, 163.15, OPENS[3].at);"), 'quatrième mail');
  assert.deepEqual([...page.matchAll(/mailIn\((\d), ([\d.]+), OPENS\[(\d)\]\.at\)/g)].map(m => [+m[1] - 1 === +m[3], +(+m[2] + 1.1).toFixed(2)]),
    D.OPENS.map(o => [true, o.at]), 'mailIn(n, t, OPENS[n - 1].at) : l’arrêt 1,1 s après l’entrée du mail');
  assert.ok(D.OPENS[3].at > 162.95, 'le mail vient après le téléphone');
});

test(`${FILE} : le cas NutriBoost des chapitres 2 à 4, et chaque requête montrée vérifiée dans SQLite`, async () => {
  /* Données du cas : identiques à celles du chapitre 2. */
  const C2 = load('projet-cles.html', 'COACHS, ATELIERS, CLIENTS, INSCR, NOUVELLE, CARTES');
  const H = load(FILE, 'COACHS, ATELIERS, CLIENTS, INSCR, NOUVELLE, CARTES, PLACES, CUISINE, TELS, TABLES, SQL, RECREE');
  for (const k of Object.keys(C2)) assert.deepEqual(H[k], C2[k], `${k} : comme au chapitre 2`);
  /* La base de l’app (sql.js, SQLite 3.45.2), PRAGMA foreign_keys = ON compris. */
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const data = vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), data);
  const SQL = await createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
  const db = new SQL.Database(); db.run(vm.runInContext('SCHEMA_SQL', data));
  const q = s => JSON.stringify(db.exec(s).flatMap(r => r.values));
  const cols = t => q(`SELECT group_concat(name) FROM pragma_table_info('${t}')`);
  const v = x => typeof x === 'string' ? `'${x}'` : x, rows = a => a.map(r => `(${r.map(v).join(', ')})`).join(', ');
  for (const [id, prenom, nom] of H.CLIENTS) assert.equal(q(`SELECT prenom, nom FROM clients WHERE id = ${id}`), JSON.stringify([[prenom, nom]]), `client ${id}`);
  /* L’état de départ : la fin du chapitre 4 (le schéma canonique), tables remplies par Karim avec les données du fichier. */
  db.run(`CREATE TABLE coachs (
  id INTEGER PRIMARY KEY,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  email TEXT UNIQUE
);
CREATE TABLE ateliers (
  id INTEGER PRIMARY KEY,
  titre TEXT NOT NULL,
  date_atelier DATE,
  coach_id INTEGER NOT NULL,
  FOREIGN KEY (coach_id) REFERENCES coachs(id)
);
CREATE TABLE inscriptions (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL,
  atelier_id INTEGER NOT NULL,
  date_inscription DATE,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (atelier_id) REFERENCES ateliers(id)
);
CREATE TABLE cartes (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL UNIQUE,
  seances INTEGER DEFAULT 10 CHECK (seances >= 0),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);`);
  db.run(`INSERT INTO coachs VALUES ${rows(H.COACHS.map(c => c.slice(0, 4)))}; INSERT INTO ateliers VALUES ${rows(H.ATELIERS)};
    INSERT INTO inscriptions VALUES ${rows(H.INSCR.concat([H.NOUVELLE]))}; INSERT INTO cartes VALUES ${rows(H.CARTES)};`);
  /* La base des ateliers telle que la page la montre : colonnes et nombre de lignes de chaque table (8 tables dans la base). */
  for (const [, , name, c, n] of H.TABLES) {
    assert.equal(cols(name), JSON.stringify([[c.map(x => Array.isArray(x) ? x[0] : x).join(',')]]), `colonnes de la table ${name}`);
    assert.equal(q(`SELECT COUNT(*) FROM ${name}`), `[[${n}]]`, `${n} lignes dans la table ${name}`);
  }
  assert.deepEqual(H.TABLES.map(t => t[4]), [4, 5, 10, 7, 3], '4 coachs, 5 ateliers, 10 clients, 7 inscriptions, 3 cartes');
  assert.equal(q("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'"), '[[8]]', 'la base compte 8 tables');
  /* Les requêtes des cartes de code : {id|…} retiré, le trou remplacé par sa réponse, ce qu’on n’écrit pas (barré) retiré. */
  const sqlText = k => H.SQL[k].map(([, l]) => l.replace(/<sl\w+\|([^<>]*)>/g, '$1').replace(/<gh\|[^<>]*>/g, '').replace(/\{\w+\|([^{}]*)\}/g, '$1')).join('\n');
  assert.deepEqual(Object.fromEntries(Object.keys(H.SQL).map(k => [k, sqlText(k)])), {
    pl: 'ALTER TABLE ateliers\n  ADD COLUMN places INTEGER DEFAULT 12;', te: 'ALTER TABLE coachs\n  ADD COLUMN telephone TEXT;',
    rn: 'ALTER TABLE cartes\n  RENAME COLUMN seances\n  TO seances_restantes;', rt: 'ALTER TABLE cartes RENAME TO cartes_membre;', dr: 'ALTER TABLE coachs\n  DROP COLUMN telephone;'}, 'les requêtes montrées');
  for (const k of Object.keys(H.SQL)) for (const [, l] of H.SQL[k]) assert.ok(l.replace(/<sl\w+\|([^<>]*)>/g, '$1').replace(/<gh\|([^<>]*)>/g, '$1').replace(/[{}]|\w+\|/g, '').length <= 53, `ligne de ${k} : 53 caractères au plus`);
  /* 2 · Recréer la table : refusé, avec le message montré. */
  assert.equal(H.RECREE[1], 'table ateliers already exists');
  assert.throws(() => db.run('CREATE TABLE ateliers (id INTEGER PRIMARY KEY, titre TEXT NOT NULL, date_atelier DATE, coach_id INTEGER NOT NULL, FOREIGN KEY (coach_id) REFERENCES coachs(id));'),
    new RegExp(H.RECREE[1]), 'la table existe déjà');
  /* Moment 1 : NOT NULL est refusé ; CHECK ne donne aucune valeur ; DEFAULT 12 donne 12 aux cinq ateliers, sans perdre une ligne. */
  assert.throws(() => db.run('ALTER TABLE ateliers ADD COLUMN places INTEGER NOT NULL;'), /Cannot add a NOT NULL column with default value NULL/, 'NOT NULL : la requête serait refusée');
  db.run('SAVEPOINT m1'); db.run('ALTER TABLE ateliers ADD COLUMN places INTEGER CHECK (places = 12);');
  assert.equal(q('SELECT COUNT(*) FROM ateliers WHERE places IS NULL'), '[[5]]', 'CHECK : les ateliers n’auraient aucune valeur'); db.run('ROLLBACK TO m1'); db.run('RELEASE m1');
  db.run(sqlText('pl'));
  assert.equal(q('SELECT id, titre, date_atelier, coach_id, places FROM ateliers ORDER BY id'), JSON.stringify(H.ATELIERS.map(a => a.concat([H.PLACES]))), 'les cinq ateliers reçoivent 12, titres, dates et coachs intacts');
  /* 3 · telephone sans DEFAULT : NULL pour les quatre coachs ; puis Karim enregistre les numéros (UPDATE, nommé seulement). */
  db.run(sqlText('te'));
  assert.equal(q('SELECT COUNT(*) FROM coachs WHERE telephone IS NULL'), '[[4]]', 'NULL : aucune valeur');
  assert.equal(q("SELECT COUNT(*) FROM coachs WHERE telephone = ''"), '[[0]]', 'pas une chaîne vide');
  H.TELS.forEach((t, n) => db.run(`UPDATE coachs SET telephone = '${t}' WHERE id = ${n + 1};`));
  assert.equal(q('SELECT telephone FROM coachs ORDER BY id'), JSON.stringify(H.TELS.map(t => [t])));
  const appTels = JSON.parse(q('SELECT telephone FROM clients')).map(r => r[0]);
  assert.ok(H.TELS.every(t => /^06 39 98 \d\d \d\d$/.test(t) && !appTels.includes(t)), 'numéros réservés à la fiction, aucun déjà pris par un client');
  /* 4 · seances devient seances_restantes : les soldes 10, 5 et 8 restent, la contrainte CHECK suit le nouveau nom. */
  db.run(sqlText('rn'));
  assert.equal(cols('cartes'), '[["id,client_id,seances_restantes"]]');
  assert.equal(q('SELECT seances_restantes FROM cartes ORDER BY id'), '[[10],[5],[8]]', 'soldes gardés');
  assert.ok(q("SELECT sql FROM sqlite_master WHERE name = 'cartes'").includes('CHECK (seances_restantes >= 0)'), 'la contrainte CHECK suit le nouveau nom');
  assert.throws(() => db.run('UPDATE cartes SET seances_restantes = -1 WHERE id = 1;'), /CHECK constraint failed: seances_restantes >= 0/);
  /* RENAME TO renommerait la table elle-même (la requête est seulement montrée : la table garde son nom). */
  db.run('SAVEPOINT rt'); db.run(sqlText('rt'));
  assert.equal(q("SELECT name FROM sqlite_master WHERE name IN ('cartes', 'cartes_membre')"), '[["cartes_membre"]]'); db.run('ROLLBACK TO rt'); db.run('RELEASE rt');
  /* 5 · Moment 5 : renommer garde la colonne et ses numéros ; UPDATE la vide ; DROP COLUMN la retire avec ses valeurs. */
  db.run('SAVEPOINT m5'); db.run('ALTER TABLE coachs RENAME COLUMN telephone TO ancien_telephone;');
  assert.ok(cols('coachs').includes('ancien_telephone') && q('SELECT COUNT(ancien_telephone) FROM coachs') === '[[4]]', 'renommer garde les numéros'); db.run('ROLLBACK TO m5');
  db.run('UPDATE coachs SET telephone = NULL;');
  assert.ok(cols('coachs').includes('telephone') && q('SELECT COUNT(telephone) FROM coachs') === '[[0]]', 'UPDATE : la colonne resterait, vide'); db.run('ROLLBACK TO m5'); db.run('RELEASE m5');
  db.run(sqlText('dr'));
  assert.equal(cols('coachs'), '[["id,prenom,nom,email"]]', 'la colonne telephone a disparu');
  /* 6 · Cuisine saine passe de 12 à 8 : une valeur change, aucune colonne. */
  db.run(`UPDATE ateliers SET places = ${H.CUISINE[1]} WHERE id = ${H.CUISINE[0]};`);
  assert.equal(q('SELECT places FROM ateliers ORDER BY id'), '[[12],[12],[8],[12],[12]]');
  assert.equal(cols('ateliers'), '[["id,titre,date_atelier,coach_id,places"]]', 'aucune colonne ne change');
  /* L’état de fin (contrat de continuité avec le chapitre 6). */
  assert.deepEqual(['coachs', 'ateliers', 'inscriptions', 'cartes'].map(cols), ['[["id,prenom,nom,email"]]', '[["id,titre,date_atelier,coach_id,places"]]',
    '[["id,client_id,atelier_id,date_inscription"]]', '[["id,client_id,seances_restantes"]]'], 'état de fin du chapitre 5');
  assert.equal(q("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'"), '[[8]]', 'toujours 8 tables');
  /* Moment 6 : chaque demande se réalise bien par la requête de sa case (sur une copie, rien n’est gardé). */
  db.run('SAVEPOINT m6');
  db.run('ALTER TABLE ateliers ADD COLUMN salle TEXT;'); assert.ok(cols('ateliers').includes('salle'), 'ADD COLUMN : la salle');
  db.run('ALTER TABLE coachs RENAME COLUMN email TO email_pro;'); assert.equal(q('SELECT email_pro FROM coachs WHERE id = 1'), '[["salma@pro.fr"]]', 'RENAME COLUMN : email_pro garde les adresses');
  db.run('ALTER TABLE clients DROP COLUMN age;'); assert.ok(!cols('clients').includes('age'), 'DROP COLUMN : l’âge des clients');
  db.run('UPDATE ateliers SET places = 10 WHERE id = 2;'); assert.equal(q('SELECT places FROM ateliers WHERE id = 2'), '[[10]]', 'UPDATE : Pilates à 10 places');
  assert.throws(() => db.run('ALTER TABLE ateliers ADD COLUMN a TEXT, ADD COLUMN b TEXT;'), /syntax error/, 'une seule opération par requête');
  db.run('ROLLBACK TO m6'); db.run('RELEASE m6');
  db.close();
});
