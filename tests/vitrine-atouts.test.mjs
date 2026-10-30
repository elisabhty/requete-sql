/* Vitrine : la section « Tout pour apprendre vraiment » (decouvrir/index.html, #programme).
   Elisa, 30 octobre, 17 h 34 : « il faut encore améliorer ces cartes comme plus haut ». Les cinq atouts deviennent des
   widgets « tableau de bord », comme les cartes chiffrées de « Pourquoi le SQL » : icône dans un rond teinté, libellé,
   pastille, titre, texte, aperçu animé, note en bas.
   Chaque aperçu montre l’appli telle qu’elle est : le résultat de la requête du labo sur la base d’exemple, les cartes
   mémo (numéro, module, mot-clé, titre) et leur nombre, le cas pratique « Le meilleur client », le calendrier des
   révisions (INTERVALS), les formats d’import, des leçons qui se suivent dans le parcours. Si l’appli change, ce test
   dit quoi reprendre sur la vitrine. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const app = lire('index.html'), vitrine = lire('decouvrir/index.html'), css = lire('decouvrir/vitrine.css');
const texte = h => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
  .replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
const section = (() => { const i = vitrine.indexOf('<section class="block" id="programme"'); return vitrine.slice(i, vitrine.indexOf('</section>', i)); })();
const tuile = cls => {
  const i = section.indexOf(` ${cls}"`);
  assert.ok(i > 0, `tuile ${cls}`);
  const j = section.indexOf('<div class="panel tile', i + 1);
  return section.slice(i, j > 0 ? j : undefined);
};

/* L’appli : les leçons dans l’ordre des modules (allLessons), le module de chaque leçon, les cartes mémo */
const mods = app.slice(app.indexOf('const MODULES = ['), app.indexOf('\n];', app.indexOf('const MODULES = [')));
const debuts = [...mods.matchAll(/\{\s*titre:"([^"]+)",\s*sous:/g)].map(m => [m.index, m[1]]);
const LECONS = [];
debuts.forEach(([pos, mod], n) => {
  const fin = n + 1 < debuts.length ? debuts[n + 1][0] : mods.length;
  for (const m of mods.slice(pos, fin).matchAll(/\bid:\s*(\d+)\s*,\s*titre:"([^"]+)"/g)) LECONS.push({id: m[1], titre: m[2], mod});
});
const cb = app.slice(app.indexOf('const CARTES={'), app.indexOf('\n};', app.indexOf('const CARTES={')));
const CARTES = Object.fromEntries([...cb.matchAll(/[\s{,](\w+):\{k:"([^"]+)",t:"([^"]+)"/g)].map(m => [m[1], {k: m[2], t: m[3]}]));
const AVEC_CARTE = LECONS.filter(l => CARTES[l.id]);

test('l’appli est bien lue : modules, leçons et cartes mémo', () => {
  assert.ok(debuts.length >= 10 && LECONS.length >= 60, `${debuts.length} modules, ${LECONS.length} leçons`);
  assert.equal(new Set(LECONS.map(l => l.id)).size, LECONS.length, 'une fois chaque leçon');
  assert.ok(AVEC_CARTE.length >= 40, `${AVEC_CARTE.length} leçons avec une carte mémo`);
});

/* Depuis le 30 octobre (21 h 17), la prépa entretien est une carte des atouts, au lieu d’une section à part ; depuis 22 h 50,
   plus de carte « Sans réseau » (« enlève la carte sans réseau »), et un nouveau texte sous « Tout pour apprendre vraiment ». */
test('les cinq atouts sont des widgets « tableau de bord », comme les cartes chiffrées de « Pourquoi le SQL »', () => {
  const titres = [...section.matchAll(/<div class="panel tile db w\d rv[^"]*"(?: id="[\w-]+")?>\s*(?:<div class="en-in">\s*<div class="en-txt">\s*)?<div class="db-head"><span class="db-ic c\d"><svg[^>]*>.*?<\/svg><\/span><span class="db-t"><small>[^<]+<\/small><\/span><span class="db-badge[^"]*">[^<]+<\/span><\/div>\s*<h3>([^<]+)<\/h3>/gs)].map(m => m[1]);
  assert.deepEqual(titres, ['Un labo SQL dans ton navigateur', 'Des cartes à collectionner', 'Tes propres données', 'Cas pratiques et révisions', 'Entraîne-toi pour l’entretien']);
  assert.equal((section.match(/<div class="panel tile db /g) || []).length, titres.length, 'chaque carte suit le même modèle');
  /* Plus les anciennes vignettes ; seule la réponse attendue de l’entretien garde son exemple SQL, comme dans l’appli */
  assert.doesNotMatch(section.replace(tuile('t-en'), ''), /class="(?:chips|streak|memo|mini-code)\b/, 'plus les anciennes vignettes (pastilles, flammes, mini-cartes, code seul)');
  assert.match(tuile('t-en'), /<div class="en-open">[\s\S]*<div class="mini-code">/, 'l’exemple est dans la réponse révélée');
  for (const k of ['.lb2{', '.mm2{', '.dt2{', '.cs2{', '.en-demo{']) assert.ok(css.includes(k), `styles ${k}`);
  /* Les aperçus sont décoratifs : le texte de la carte dit déjà tout */
  for (const k of ['lb2', 'mm2', 'dt2', 'cs2']) assert.match(section, new RegExp(`<div class="${k}" aria-hidden="true">`), `${k} masqué aux lecteurs d’écran`);
  assert.match(section, /<div class="en-demo" id="endemo" aria-hidden="true">/, 'en-demo masqué aux lecteurs d’écran');
  /* Moins d’animations demandées : tout s’affiche à son état final */
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\s*\*,\*::before,\*::after\{animation-duration:\.001ms!important/);
});

test('labo : la requête montrée donne ce résultat sur la base d’exemple de l’appli', async () => {
  const t = tuile('t-lab');
  const sql = texte(t.match(/<pre class="lb2-code" id="lb2-sql">([\s\S]*?)<\/pre>/)[1]);
  const ctx = vm.createContext({});
  vm.runInContext(app.slice(app.indexOf('const SCHEMA_SQL ='), app.indexOf('let state=')), ctx);
  const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(root, 'vendor/sqljs', f) });
  const db = new SQL.Database();
  db.run(vm.runInContext('SCHEMA_SQL', ctx));
  const [res] = db.exec(sql);
  assert.deepEqual(res.columns, ['ville', 'clients']);
  const vues = [...t.matchAll(/<div class="lb2-r" style="--v:(\d+);--i:\d"><span>([^<]+)<\/span><i><\/i><b>(\d+)<\/b><\/div>/g)].map(m => ({ville: m[2], n: +m[3], barre: +m[1]}));
  assert.ok(vues.length >= 3, 'quelques lignes du résultat');
  assert.deepEqual(vues.map(v => [v.ville, v.n]), res.values.slice(0, vues.length).map(r => [r[0], r[1]]), 'les premières lignes, dans l’ordre');
  for (const v of vues) assert.equal(v.barre, Math.round(v.n / res.values[0][1] * 100), `${v.ville} : longueur de la barre`);
  assert.ok(t.includes(`${res.values.length} lignes</span>`), `« ${res.values.length} lignes »`);
  assert.ok(t.includes(`<span>+ ${res.values.length - vues.length} lignes</span>`), 'les lignes qui ne sont pas montrées');
  assert.ok(t.includes('<th>') === false && t.includes('<span>ville</span>') && t.includes('<span>clients</span>'), 'en-têtes des colonnes');
});

test('cartes mémo : leur nombre et les trois cartes montrées sont ceux de l’appli (numéro, module, mot-clé, titre)', () => {
  const t = tuile('t-memo');
  assert.ok(t.includes(`<span class="db-badge pk">${AVEC_CARTE.length} cartes</span>`), `pastille « ${AVEC_CARTE.length} cartes »`);
  const vues = [...t.matchAll(/<span class="mm2-top"><b>(\d+)<\/b><small>([^<]+)<\/small><\/span><b class="mm2-k">([^<]+)<\/b><span class="mm2-t">([^<]+)<\/span>/g)];
  assert.equal(vues.length, 3, 'trois cartes');
  for (const [, num, mod, k, titre] of vues) {
    const i = AVEC_CARTE.findIndex(l => CARTES[l.id].k === k);
    assert.ok(i >= 0, `la carte ${k} existe`);
    assert.equal(num, String(i + 1).padStart(2, '0'), `${k} : numéro dans la collection`);
    assert.equal(mod, AVEC_CARTE[i].mod, `${k} : module`);
    assert.equal(titre, CARTES[AVEC_CARTE[i].id].t, `${k} : titre`);
  }
  /* « Chaque leçon » serait faux : toutes les leçons n’ont pas de carte */
  assert.ok(AVEC_CARTE.length < LECONS.length && !t.includes('Chaque leçon terminée débloque sa carte'), 'pas « chaque leçon »');
  assert.ok(t.includes('<p>Tes leçons terminées débloquent des cartes mémo, à relire en un coup d’œil.</p>'));
  /* Elisa, 30 octobre, 18 h 45 : « supprimer : Elles reviennent au même rythme que tes révisions. » */
  assert.ok(!t.includes('Elles reviennent') && !t.includes('class="st-src"'), 'pas de note sous les cartes');
});

test('import : les formats montrés sont ceux de l’appli (« Excel, CSV, JSON, SQL ou SQLite »)', () => {
  const t = tuile('t-data');
  const familles = app.match(/<b>Importer un fichier<\/b><small>([^<]+)<\/small>/)[1].split(/, | ou /);
  assert.deepEqual(familles, ['Excel', 'CSV', 'JSON', 'SQL', 'SQLite']);
  assert.ok(t.includes(`<span class="db-badge sun">${familles.length} formats</span>`), `pastille « ${familles.length} formats »`);
  const fmt = t.match(/<div class="fmt" aria-label="([^"]+)">(.*?)<\/div>/s);
  assert.equal(fmt[1], `Formats acceptés : ${familles.slice(0, -1).join(', ')} et ${familles.at(-1)}`);
  const ext = [...fmt[2].matchAll(/>\.(\w+)</g)].map(m => '.' + m[1]);
  const accept = app.match(/id="data-import" type="file" accept="([^"]+)"/)[1].split(',');
  assert.equal(ext.length, familles.length, 'une extension par format');
  for (const e of ext) assert.ok(accept.includes(e), `${e} accepté par l’import de l’appli`);
  /* Elisa, 30 octobre, 18 h 48 : « supprimer : Ton fichier reste sur ton appareil. » */
  assert.ok(!t.includes('Ton fichier reste') && !t.includes('class="st-src"'), 'pas de note sous les formats');
});

test('cas pratique et révisions : le cas « Le meilleur client » et le calendrier des révisions de l’appli', () => {
  const t = tuile('t-cas');
  const ch = app.slice(app.indexOf('const CHALLENGES'), app.indexOf('\n];', app.indexOf('const CHALLENGES')));
  const n = (ch.match(/^\s*\{\s*id:/gm) || []).length;
  assert.ok(t.includes(`<span class="db-badge ok">${n} cas</span>`), `pastille « ${n} cas »`);
  const nom = texte(t.match(/<span class="cs2-tag">([^<]+)<\/span>/)[1]);
  const cas = ch.match(new RegExp(`titre:"${nom}",niv:'(\\w)',q:"([^"]+)"`));
  assert.ok(cas, `le cas « ${nom} » existe`);
  const niv = Object.fromEntries([...app.match(/\{f:'[^']+',m:'[^']+',d:'[^']+'\}/)[0].matchAll(/(\w):'([^']+)'/g)].map(m => [m[1], m[2]]));
  assert.ok(t.includes(`<span class="cs2-lv">${niv[cas[1]]}</span>`), `niveau « ${niv[cas[1]]} »`);
  const q = texte(t.match(/<span class="cs2-q">([^<]+)<\/span>/)[1]);
  assert.ok(texte(cas[2]).startsWith(q), 'la question, mot pour mot');
  const INTERVALS = JSON.parse(app.match(/const INTERVALS=(\[[\d,]+\]);/)[1]);
  assert.deepEqual([...t.matchAll(/<li(?: class="\w+")?><i><\/i><span>J\+(\d+)<\/span><\/li>/g)].map(m => +m[1]), INTERVALS, 'les étapes du calendrier');
  assert.ok(t.includes(`Une leçon revient à ${INTERVALS.slice(0, -1).map(j => 'J+' + j).join(', ')} puis J+${INTERVALS.at(-1)}.`), 'la note');
});

test('plus de carte « Sans réseau » ; les données et les cas pratiques se partagent la rangée, le texte d’introduction', () => {
  assert.ok(!vitrine.includes('t-off') && !vitrine.includes('<h3>Sans réseau</h3>') && !css.includes('.of2'), 'la carte et ses styles sont partis');
  assert.ok(section.includes('<div class="panel tile db w3 rv t-data">') && section.includes('<div class="panel tile db w3 rv d1 t-cas">'), 'deux cartes de trois colonnes');
  assert.ok(css.includes('@media (min-width:600px) and (max-width:959px){.bento .w4{grid-column:span 2}.bento .t-cas{grid-column:1/-1}}'), 'tablette : les cas sur toute la largeur');
  assert.ok(css.includes('@container tuile (min-width:540px){.cs2{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);align-items:start}}'), 'large : le cas et les révisions côte à côte');
  assert.ok(vitrine.includes('<p class="sec-lead">Des cours courts, des cas pratiques, un labo interactif et des outils pour pratiquer, réviser et progresser à ton rythme.</p>'));
  assert.ok(!vitrine.includes('Pas de vidéos de deux heures'));
});

/* Elisa, 30 octobre, 18 h 51 : « de la même façon améliore ces cartes » (« Comment ça marche », #comment). Les trois étapes
   montrent l’écran de l’appli qui leur correspond : les questions du planning, la séance du jour, un mail du projet. */
test('« Comment ça marche » : les trois étapes reprennent le planning, la séance du jour et le projet de l’appli', () => {
  const i = vitrine.indexOf('<section class="block" id="comment"'), sec = vitrine.slice(i, vitrine.indexOf('</section>', i));
  const etape = n => { const a = sec.indexOf(`hw-${n}">`); return sec.slice(a, sec.indexOf('</li>\n          <li', a) > 0 ? sec.indexOf('</li>\n          <li', a) : sec.indexOf('</ol>', a)); };
  assert.deepEqual([...sec.matchAll(/<div class="hw-h"><i>(\d)<\/i><span class="hw-l">([^<]+)<\/span><span class="db-badge[^"]*">([^<]+)<\/span><\/div>\s*<h3>([^<]+)<\/h3>/g)].map(m => [m[1], m[4]]),
    [['1', 'Choisis ton rythme'], ['2', 'Suis ta séance du jour'], ['3', 'Passe aux vrais cas']]);
  for (const k of ['hw1', 'hw2', 'hw3']) assert.match(sec, new RegExp(`<div class="${k}" aria-hidden="true">`), `${k} masqué aux lecteurs d’écran`);
  /* 1 · Les questions du planning : objectif, niveau, minutes, et ce que l’appli en déduit */
  const e1 = etape(1);
  assert.equal((app.match(/\$\{bloc\("[^"]+","(?:niveau|rythme|freq)"/g) || []).length, 3, 'le planning pose trois questions');
  assert.ok(e1.includes('<span class="db-badge">3 questions</span>'));
  const objectif = e1.match(/<span class="hw1-o"><b class="on">([^<]+)<\/b>/)[1];
  assert.ok(app.includes(`'${objectif}'`) && /const OB_GOALS=\[[\s\S]*?\];/.exec(app)[0].includes(`'${objectif}'`), `objectif « ${objectif} » de l’onboarding`);
  const niv = app.match(/\{debutant:'([^']+)',bases:'([^']+)',inter:'([^']+)'\}/).slice(1);
  const segs = [...e1.matchAll(/<span class="hw1-s">(.*?)<\/span>/g)].map(m => [...m[1].matchAll(/<b(?: class="on")?>([^<]+)<\/b>/g)].map(x => x[1].replace('&nbsp;', ' ')));
  assert.deepEqual(segs[0], niv, 'les trois niveaux de l’appli');
  const RYT = [...app.match(/const RYTHMES=\[([\s\S]*?)\];/)[1].matchAll(/\{k:'(\w+)',i:'(\d+)',t:"[^"]+",d:"~(\d+) activités[^"]*",per:(\d+),min:(\d+)\}/g)];
  assert.deepEqual(segs[1], RYT.map(r => `${r[2]} min`), '10, 20 et 30 minutes');
  const choisi = RYT.find(r => e1.includes(`<b class="on">${r[2]}&nbsp;min</b>`));
  assert.ok(e1.includes(`Ton planning&nbsp;: ~${choisi[4]} activités par séance, ~${choisi[5]}&nbsp;min`), 'ce que donne le rythme choisi');
  /* 2 · La séance du jour : une leçon faite, le cas pratique qui la suit, la leçon d’après */
  const e2 = etape(2);
  const lignes = [...e2.matchAll(/<li class?="?([\w ]*)"?><b>([^<]+)<\/b><em>([^<]+)<\/em><\/li>|<li><b>([^<]+)<\/b><em>([^<]+)<\/em><\/li>/g)].map(m => [m[2] || m[4], m[3] || m[5]]);
  assert.deepEqual(lignes.map(l => l[1]), ['Leçon', 'Cas pratique', 'Leçon']);
  const [l1, cas, l2] = lignes.map(l => l[0]);
  const i1 = LECONS.findIndex(l => l.titre === l1);
  assert.ok(i1 >= 0 && LECONS[i1 + 1].titre === l2, `${l1} puis ${l2} dans l’ordre du parcours`);
  assert.match(app, new RegExp(`\\{id:'c\\d+',apres:${LECONS[i1].id},titre:"${cas}"`), `le cas « ${cas} » vient après la leçon ${l1}`);
  const per = +app.match(/const MIN_PAR_ACTIVITE=(\d+);/)[1];
  assert.ok(e2.includes('<b class="hw2-n">2 à faire</b>') && texte(e2).includes(`~${2 * per} min. Déjà 1/3.`), 'deux activités restantes, six minutes chacune');
  assert.ok(app.includes('<div class="th-tag">Aujourd’hui · Parcours progressif</div>') && app.includes("${faites?'Continuer':'Commencer'} la séance"), 'les libellés de la séance du jour');
  assert.ok(texte(e2.match(/<span class="hw2-tag">([^<]+)<\/span>/)[1]) === 'Aujourd’hui · Parcours progressif' && e2.includes('Continuer la séance'));
  /* 3 · Le projet NutriBoost : le mail du chapitre des index (les commandes trop lentes, depuis le 30 octobre, 21 h 03 :
     la demande de Salma, changer son e-mail, n’était « pas le meilleur exemple »), le nombre de chapitres et de cas */
  const e3 = etape(3);
  const proj = fs.readFileSync(path.join(root, 'assets/anim/projet-index.html'), 'utf8');
  const mail = proj.match(/const MAILS = \[\s*\[\['([^']+)', '([^']+)', '([^']+)'\], 'k-\w+', '[^']+', '[^']+', \[\s*((?:'[^']+',?\s*)+)\]/);
  assert.ok(mail, 'le premier mail du chapitre');
  assert.ok(e3.includes(`<i class="hw3-av">${mail[3]}</i>`) && e3.includes(`<b>${mail[1]} ${mail[2]}<small>NutriBoost</small></b>`), 'l’équipe qui écrit');
  const demande = [...mail[4].matchAll(/'([^']+)'/g)].map(m => m[1]).join(' ');
  assert.ok(texte(e3).includes(demande), 'son mail, mot pour mot');
  assert.ok(!e3.includes('@'), 'aucune adresse e-mail à recopier');
  assert.ok(['lente&nbsp;!', '500&nbsp;000', 'passe&nbsp;?'].every(s => e3.includes(s)), 'espaces insécables');
  const chapitres = [...mods.matchAll(/\bid:\s*(\d+)\s*,\s*titre:"([^"]+)"[\s\S]{0,900}?assets\/anim\/(projet-[\w-]+)\.html/g)];
  const vus = new Set(chapitres.map(m => m[3])), ordre = [...vus], n = ordre.indexOf('projet-index') + 1;
  assert.ok(e3.includes(`<span class="db-badge ok">${vus.size} chapitres</span>`) && e3.includes(`${vus.size} chapitres de projet`), `${vus.size} chapitres`);
  assert.equal(n, 19, 'les index : chapitre 19 du projet');
  const titre = chapitres.find(m => m[3] === 'projet-index')[2];
  assert.ok(proj.includes('NutriBoost') && e3.includes(`<span class="hw3-k">Projet NutriBoost · chapitre ${n}</span><b>${titre}</b>`), 'le chapitre montré');
  assert.ok(css.includes(`.hw3-bar i{display:block;width:${Math.round(n / vus.size * 100)}%;`), 'la barre : 19 chapitres sur 20');
  const ch = app.slice(app.indexOf('const CHALLENGES'), app.indexOf('\n];', app.indexOf('const CHALLENGES')));
  assert.ok(e3.includes(`${(ch.match(/^\s*\{\s*id:/gm) || []).length} cas pratiques`));
  /* Les règles d’avant visaient tous les <i> et <li> de la liste : elles ne visent plus que les étapes */
  assert.doesNotMatch(css, /\.how-list li\b|\.how-list i\b/);
});

/* Elisa, 30 octobre, 18 h 58 : des sous-textes concrets pour « Ton objectif ? », un nouveau sous-titre pour les avis, et plus de
   « Sans compte » sur la vitrine (« si compte obligatoire car paiement »). */
test('vitrine : objectifs, sous-titre des avis, plus de « Sans compte » ; le nombre de cartes mémo est celui de l’appli', () => {
  const objectifs = [...vitrine.matchAll(/<a class="g(?: wide)?" href="video\.html" data-goal="(\w+)">.*?<span>([^<]+)<small>([^<]+)<\/small><\/span><\/a>/g)].map(m => [m[1], m[2], m[3]]);
  assert.deepEqual(objectifs, [
    ['career', 'Me reconvertir dans la data', 'Acquiers les bases pour décrocher ton premier poste'],
    ['interview', 'Réussir un entretien', 'Entraîne-toi sur des questions proches du réel'],
    ['work', 'Être efficace au travail', 'Analyse tes propres données avec SQL'],
    ['advanced', 'Maîtriser le SQL avancé', 'Fenêtres, CTE, index et requêtes complexes'],
    ['curious', 'Apprendre par curiosité', 'Découvre comment les données sont interrogées']]);
  /* Chaque objectif de la vitrine est repris par l’onboarding de l’appli */
  const goals = /const OB_GOALS=\[([\s\S]*?)\];/.exec(app)[1];
  for (const [k] of objectifs) assert.match(goals, new RegExp(`\\['${k}',`), `objectif ${k} dans l’appli`);
  /* « Analyse tes propres données » : l’appli importe bien des fichiers */
  assert.ok(app.includes('<b>Importer un fichier</b>'));
  assert.ok(vitrine.includes("'Des premiers SELECT aux entretiens techniques\\u00a0: découvre l’expérience de celles et ceux qui utilisent Requête.'"), 'sous-titre des avis');
  assert.doesNotMatch(vitrine, /Ce qu’en disent celles et ceux/);
  /* Un compte sera nécessaire pour payer : la vitrine ne promet plus « Sans compte » */
  const module = fs.readFileSync(path.join(root, 'decouvrir/module.html'), 'utf8');
  for (const [nom, h] of [['index.html', vitrine], ['module.html', module]]) assert.doesNotMatch(h, /[Ss]ans compte/, `${nom} : plus de « Sans compte »`);
  assert.ok(vitrine.includes('</svg><span><span>Dès 10&nbsp;min</span> <span>par jour</span></span></li>') && /const RYTHMES=\[\s*\{k:'calme',i:'10'/.test(app), 'à la place : dès 10 minutes, le rythme le plus court de l’appli');
  assert.ok(module.includes("<p class=\"price\"><b>Dès 10&nbsp;min par jour</b><span>dans ton navigateur, même hors ligne</span></p>"));
  const conf = fs.readFileSync(path.join(root, 'decouvrir/confidentialite.html'), 'utf8');
  assert.ok(conf.includes('sera géré avec RevenueCat, un prestataire de gestion des achats intégrés, et relié à ton compte Requête.') && !conf.includes('sans compte Requête'), 'confidentialité : l’abonnement sera relié au compte');
  /* La fiche du parcours annonçait une carte mémo par cours (65) : l’appli en a une par leçon qui en a une */
  const ctx = vm.createContext({window: {}});
  vm.runInContext(fs.readFileSync(path.join(root, 'decouvrir/modules.js'), 'utf8'), ctx);
  const sql = ctx.window.MODULES.find(m => m.id === 'sql');
  assert.equal(sql.cartes, AVEC_CARTE.length, `${AVEC_CARTE.length} cartes mémo`);
  assert.ok(!JSON.stringify(sql.details).includes('par cours') && module.includes("(m.cartes?m.cartes+' cartes mémo':'Des cartes mémo')+' à collectionner</span>"));
});

/* Elisa, 30 octobre, 19 h 04 : la carte « Bientôt » des parcours (« augmenter le visuel d’un niveau comme on l’a fait pour les
   cartes »). Ses affiches reprennent le style des vraies affiches des cours, sans annoncer de parcours qui n’existe pas. */
test('parcours : la carte « Bientôt » a des affiches comme celles des cours, sans parcours inventé', () => {
  const i = vitrine.indexOf('var avenir=function(titre,texte,lien){'), f = vitrine.slice(i, vitrine.indexOf('var carte=function(m){', i));
  const affiches = [...f.matchAll(/<span class="nx (nx\d)"><span class="nx-k">([^<]+)<\/span>/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(affiches, [['nx1', 'Nouveau parcours'], ['nx2', 'Bientôt'], ['nx3', 'Nouveau parcours']], 'deux parcours sans nom, et l’idée à proposer au centre');
  assert.ok(f.includes('<b class="nx-h">Ton idée&nbsp;?</b><span class="nx-c">Proposer</span><img class="nx-m" src="mascotte.webp"'), 'l’affiche du centre, avec la mascotte');
  assert.ok(f.includes('<span class="nx-e">En préparation</span><span class="nx-bar"><i></i></span>'));
  assert.ok(fs.existsSync(path.join(root, 'decouvrir/mascotte.webp')));
  /* Les règles des affiches du parcours SQL (des images) ne touchent pas la mascotte de la carte « Bientôt » */
  assert.doesNotMatch(css, /\.mod-top img/);
  assert.match(css, /\.mod-top>img\{position:absolute;bottom:-58px;width:112px;/);
  assert.match(css, /\.nx\{position:absolute;bottom:-58px;width:112px;aspect-ratio:720\/947;[^}]*background:linear-gradient\(165deg,#7C5CFF/, 'fond violet des affiches');
  /* « Proposer un parcours » ouvre toujours le formulaire sur « Une idée » */
  assert.ok(vitrine.includes(`var r=document.querySelector('#ctform input[name=sujet][value="Une idée"]');if(r)r.checked=true;`));
});
