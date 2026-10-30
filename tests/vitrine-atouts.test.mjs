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
  const i = section.indexOf(` ${cls}">`);
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

test('les cinq atouts sont des widgets « tableau de bord », comme les cartes chiffrées de « Pourquoi le SQL »', () => {
  const titres = [...section.matchAll(/<div class="panel tile db w\d rv[^"]*">\s*<div class="db-head"><span class="db-ic c\d"><svg[^>]*>.*?<\/svg><\/span><span class="db-t"><small>[^<]+<\/small><\/span><span class="db-badge[^"]*">[^<]+<\/span><\/div>\s*<h3>([^<]+)<\/h3>/gs)].map(m => m[1]);
  assert.deepEqual(titres, ['Un labo SQL dans ton navigateur', 'Des cartes à collectionner', 'Tes propres données', 'Cas pratiques et révisions', 'Sans réseau']);
  assert.doesNotMatch(section, /class="(?:chips|streak|memo|mini-code)\b/, 'plus les anciennes vignettes (pastilles, flammes, mini-cartes, code seul)');
  for (const k of ['.lb2{', '.mm2{', '.dt2{', '.cs2{', '.of2{']) assert.ok(css.includes(k), `styles ${k}`);
  /* Les aperçus sont décoratifs : le texte de la carte dit déjà tout */
  for (const k of ['lb2', 'mm2', 'dt2', 'cs2', 'of2']) assert.match(section, new RegExp(`<div class="${k}" aria-hidden="true">`), `${k} masqué aux lecteurs d’écran`);
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
  /* Les cartes reviennent avec les révisions des leçons (renderCollection : dueCards) */
  assert.match(app, /const dueCards=allLessons\.filter\(l=>CARTES\[l\.id\]&&isUnlocked\(l\.id\)&&revisable\(l\)&&isDue\(l\.id\)\);/);
  assert.ok(t.includes('Elles reviennent au même rythme que tes révisions.'));
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
  /* Le fichier est lu dans le navigateur : l’appli n’envoie rien, sauf le relais du jeu à plusieurs */
  assert.deepEqual([...app.matchAll(/fetch\(([^,)]+)/g)].map(m => m[1]), ['JEU_RELAY+topic', 'JEU_RELAY+topic']);
  assert.ok(t.includes('Ton fichier reste sur ton appareil.'));
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

test('hors ligne : la séance montre des leçons qui se suivent dans le parcours', () => {
  const t = tuile('t-off');
  const vues = [...t.matchAll(/<li class="(?:ok|now)">([^<]+)<\/li>/g)].map(m => m[1]);
  assert.equal(vues.length, 3);
  const i = LECONS.findIndex(l => l.titre === vues[0]);
  assert.ok(i >= 0, `la leçon ${vues[0]} existe`);
  assert.deepEqual(LECONS.slice(i, i + vues.length).map(l => l.titre), vues, 'dans l’ordre du parcours');
  /* La progression est gardée sur l’appareil (Store), et l’appli marche sans réseau (service worker) */
  assert.match(app, /function save\(\)\{ state=normalizeState\(state\); Store\.set\(KEY,state\); \}/);
  assert.ok(fs.existsSync(path.join(root, 'sw.js')));
});
