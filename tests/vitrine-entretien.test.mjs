/* Vitrine : la section « Prépa entretien » (decouvrir/index.html) et la scène « Entretiens » de la vidéo
   (decouvrir/video.html) montrent l’écran « Entretien SQL » de l’appli (ENTRETIEN dans index.html). Le nombre de
   questions et de thèmes, la question montrée (« WHERE ou HAVING ? ») avec son numéro, son thème, sa réponse et
   son exemple, et les libellés de l’écran doivent rester ceux de l’appli : une question ajoutée, déplacée ou
   réécrite dans l’appli doit l’être ici aussi. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const vitrine = fs.readFileSync(path.join(root, 'decouvrir/index.html'), 'utf8');
const video = fs.readFileSync(path.join(root, 'decouvrir/video.html'), 'utf8');

/* Questions de l’appli : { id:'…', cat:'…', q:"…", a:"…", sql:"…" } */
const start = app.indexOf('const ENTRETIEN=[');
const body = app.slice(start, app.indexOf('\n];', start));
const QUESTIONS = [...body.matchAll(/\{id:'[^']+',cat:'([^']+)',q:"([^"]+)",a:"((?:[^"\\]|\\.)*)"(?:,sql:"((?:[^"\\]|\\.)*)")?\}/g)]
  .map(m => ({ cat: m[1], q: m[2], a: m[3], sql: m[4] === undefined ? null : m[4].replace(/\\n/g, '\n') }));
const catsLine = app.slice(app.indexOf('const ENTRETIEN_CATS='), app.indexOf('\n', app.indexOf('const ENTRETIEN_CATS=')));
const THEMES = [...catsLine.matchAll(/\['([^']+)','([^']+)'\]/g)].filter(m => m[1] !== 'all').map(m => m[2]);

/* Texte affiché : sans balises, entités décodées, espaces insécables ramenées à des espaces simples */
const texte = h => h.replace(/<[^>]+>/g, '')
  .replace(/&nbsp;|&#8239;| | /g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
const section = (() => {
  const i = vitrine.indexOf('<section class="block" id="entretien"');
  return vitrine.slice(i, vitrine.indexOf('</section>', i));
})();
const scene = (() => {
  const i = video.indexOf('<section class="scene" id="sen">');
  return video.slice(i, video.indexOf('</section>', i));
})();

test('l’appli a bien ses questions d’entretien, lues ici sans en perdre', () => {
  assert.ok(start > 0, 'tableau ENTRETIEN trouvé dans index.html');
  assert.equal(QUESTIONS.length, (body.match(/^\s*\{id:'/gm) || []).length, 'chaque question du tableau est lue');
  assert.ok(QUESTIONS.length >= 10 && THEMES.length >= 2);
});

test('le nombre de questions et de thèmes annoncé correspond à l’appli', () => {
  const n = QUESTIONS.length;
  assert.ok(texte(section).includes(`${n} questions d’entretien SQL`), `vitrine : « ${n} questions d’entretien SQL »`);
  assert.ok(texte(scene).includes(`${n} questions d’entretien`), `vidéo : autocollant « ${n} questions d’entretien »`);
  assert.match(video, new RegExp(`'Entraîne-toi pour l’entretien : ${n} questions d’entretien SQL`), 'vidéo : texte lu par les lecteurs d’écran');
  const faq = vitrine.slice(vitrine.indexOf('Est-ce que ça aide à préparer un entretien'));
  assert.ok(texte(faq).includes(`${n} questions d’entretien SQL en ${THEMES.length} thèmes`), 'FAQ visible');
  assert.match(vitrine, new RegExp(`"text":"Oui. L’appli propose ${n} questions d’entretien SQL en ${THEMES.length} thèmes`), 'FAQ des moteurs de recherche');
  const puces = [...section.matchAll(/<ul class="en-themes"[^>]*>(.*?)<\/ul>/gs)].map(m => [...m[1].matchAll(/<li>([^<]+)<\/li>/g)].map(x => x[1]))[0];
  assert.deepEqual(puces, THEMES, 'les thèmes listés sont ceux de l’appli, dans le même ordre');
  assert.ok(texte(section).includes(`thèmes validés sur ${THEMES.length}`));
});

test('la question montrée est celle de l’appli : même numéro, même thème, même réponse, même exemple', () => {
  const i = QUESTIONS.findIndex(x => texte(x.q) === 'WHERE ou HAVING ?');
  assert.ok(i >= 0, 'la question « WHERE ou HAVING ? » existe dans l’appli');
  const x = QUESTIONS[i], n = QUESTIONS.length;
  assert.ok(texte(section).includes(`Question ${i + 1} sur ${n}`), `vitrine : « Question ${i + 1} sur ${n} »`);
  assert.ok(texte(scene).includes(`Question ${i + 1}/${n}`), `vidéo : « Question ${i + 1}/${n} »`);
  for (const [nom, h] of [['vitrine', section], ['vidéo', scene]]) {
    assert.ok(texte(h).includes('WHERE ou HAVING ?'), `${nom} : la question`);
    assert.ok(texte(h).includes(x.cat), `${nom} : le thème « ${x.cat} »`);
  }
  const rep = section.match(/<div class="en-open">\s*<small>Réponse attendue<\/small>\s*<p>(.*?)<\/p>/s);
  assert.ok(rep, 'vitrine : réponse attendue présente');
  assert.equal(texte(rep[1]), texte(x.a), 'vitrine : la réponse est celle de l’appli, mot pour mot');
  const code = section.match(/<div class="mini-code">(.*?)<\/div>/s);
  assert.ok(code && x.sql, 'vitrine : exemple SQL présent');
  assert.equal(texte(code[1]), x.sql, 'vitrine : l’exemple SQL est celui de l’appli');
  /* La vidéo abrège : chaque morceau tapé vient de l’exemple de l’appli */
  const enq = video.match(/const ENQ = \['… ([^']+)', '([^']+)'\];/);
  assert.ok(enq, 'vidéo : requête tapée (ENQ)');
  const plat = x.sql.replace(/\s+/g, ' ');
  for (const morceau of [enq[1], enq[2]]) assert.ok(plat.includes(morceau), `vidéo : « ${morceau} » vient de l’exemple`);
});

test('les libellés de la carte sont ceux de l’écran « Entretien SQL »', () => {
  const ecran = texte(app);
  for (const l of ['Réponds à voix haute, puis compare.', 'À toi de répondre', 'Révéler la réponse', 'Réponse attendue', 'Je maîtrise', 'À revoir', 'maîtrisées'])
    for (const [nom, h] of [['vitrine', section], ['vidéo', scene]])
      assert.ok(texte(h).includes(l) && ecran.includes(l), `${nom} : « ${l} »`);
  for (const l of ['Comment évalues-tu ta réponse ?', 'Prends quelques secondes pour structurer ta réponse avant de regarder.'])
    assert.ok(texte(section).includes(l) && ecran.includes(l), `vitrine : « ${l} »`);
});

test('la vidéo compte la scène « Entretiens » dans ses chapitres et sa durée', () => {
  const chap = video.match(/const CHAPTERS = (\[.*\]);/)[1];
  const list = [...chap.matchAll(/\[([\d.]+), '([^']+)'\]/g)].map(m => [+m[1], m[2]]);
  const say = video.slice(video.indexOf('const SAY = ['), video.indexOf('];', video.indexOf('const SAY = [')));
  assert.equal((say.match(/^\s*'|\['/gm) || []).length, list.length, 'un texte lu (SAY) par chapitre');
  const e = list.findIndex(c => c[1] === 'Entretiens');
  assert.ok(e > 0, 'chapitre « Entretiens »');
  const t = list[e][0], fin = list[e + 1][0];
  assert.match(video, new RegExp(`scene\\('sen', ${t}, ${fin}\\);`), 'la scène couvre tout le chapitre');
  assert.match(video, new RegExp(`scene\\('s9', ${fin}, null\\);`), 'la dernière scène suit');
  const duree = +video.match(/const DURATION = ([\d.]+);/)[1];
  assert.ok(duree > fin + 4, 'la fin a le temps de s’afficher');
  assert.ok(duree <= 130, 'la vidéo reste autour de deux minutes, comme l’annonce la vitrine');
});
