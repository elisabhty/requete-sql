/* Vitrine : la section « Prépa entretien » (decouvrir/index.html) et la scène « Entretiens » de la vidéo
  (decouvrir/video.html) montrent l’écran « Entretien SQL » de l’appli (ENTRETIEN dans index.html). Le nombre de
  questions et de niveaux, la question montrée (question 6) avec son numéro, son niveau, son thème, sa réponse et
  son exemple, ainsi que les libellés, doivent rester synchronisés avec l’appli. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const vitrine = fs.readFileSync(path.join(root, 'decouvrir/index.html'), 'utf8');
const video = fs.readFileSync(path.join(root, 'decouvrir/video.html'), 'utf8');

/* Questions de l’appli, exécutées pour contrôler leurs métadonnées complètes. */
const start = app.indexOf('const ENTRETIEN=[');
const end = app.indexOf('\n];', start);
const ctx = vm.createContext({});
vm.runInContext(app.slice(start, end + 3).replace('const ENTRETIEN=', 'ENTRETIEN=') + ';', ctx);
const QUESTIONS = JSON.parse(JSON.stringify(ctx.ENTRETIEN));
const catsStart = app.indexOf('const ENTRETIEN_CATS=');
const catsEnd = app.indexOf(';', catsStart);
vm.runInContext(app.slice(catsStart, catsEnd + 1).replace('const ENTRETIEN_CATS=', 'ENTRETIEN_CATS='), ctx);
const FILTRES = JSON.parse(JSON.stringify(ctx.ENTRETIEN_CATS)).filter(([k]) => k !== 'all').map(([key, label]) => ({ key, label }));
const NIVEAUX = [...new Set(QUESTIONS.map(q => q.niveau))];
const NOTIONS = [...new Set(QUESTIONS.map(q => q.cat))];

/* Texte affiché : sans balises, entités décodées, espaces insécables ramenées à des espaces simples */
const texte = h => h.replace(/<[^>]+>/g, '')
  .replace(/&nbsp;|&#8239;| | /g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
const section = (() => {
  /* Depuis le 30 octobre (21 h 17) : une carte des atouts, au lieu d’une section à part (sous « Cas pratiques et révisions » depuis 22 h 50) */
  const i = vitrine.indexOf('<div class="panel tile db w6 rv t-en" id="entretien">');
  return vitrine.slice(i, vitrine.indexOf('</section>', i));
})();
const scene = (() => {
  const i = video.indexOf('<section class="scene" id="sen">');
  return video.slice(i, video.indexOf('</section>', i));
})();

test('l’appli a bien ses questions d’entretien, lues ici sans en perdre', () => {
  assert.ok(start > 0, 'tableau ENTRETIEN trouvé dans index.html');
  assert.equal(QUESTIONS.length, 102, '75 questions, puis 27 ajoutées (19 h 12)');
  assert.deepEqual(NIVEAUX, ['Débutant', 'Intermédiaire', 'Avancé']);
  assert.deepEqual(NIVEAUX.map(n => QUESTIONS.filter(q => q.niveau === n).length), [34, 34, 34]);
  assert.deepEqual([...FILTRES.map(f => f.key)].sort(), [...NOTIONS].sort(), 'les notions de la liste sont celles de la banque (rangées dans l’ordre où on les apprend, 18 h 48)');
  assert.equal(FILTRES[0].key, 'SELECT', 'SELECT en haut');
  assert.ok(!NOTIONS.some(n => ['Requêtes', 'Bases', 'Entretien'].includes(n)), 'plus de notion qui ne veut rien dire');
  assert.ok(QUESTIONS.every(q => q.id && q.cat && q.q && q.a && q.niveau && q.dialectes?.length), 'chaque carte a ses métadonnées');
});

test('les filtres de la banque sélectionnent des familles de notions, pas les niveaux (18 h 38 : « trop de notions »)', () => {
  const fnsStart = app.indexOf('function entMark(');
  const fnsEnd = app.indexOf('function entFoot(', fnsStart);
  const famStart = app.indexOf('const ENT_FAMILLES=');
  const famEnd = app.indexOf('const ENTRETIEN_CATS=', famStart);
  const ctx = vm.createContext({ state: { entretien: {} } });
  vm.runInContext(app.slice(start, end + 3).replace('const ENTRETIEN=', 'ENTRETIEN=') + ';', ctx);
  vm.runInContext(app.slice(famStart, famEnd).replace(/^const /gm, 'var ') + app.slice(fnsStart, fnsEnd) + '\nvar entFilter="all",entStatus="all";', ctx);
  const familles = JSON.parse(JSON.stringify(vm.runInContext('ENT_FAMILLES', ctx))).filter(([k]) => k !== 'all');
  assert.ok(familles.length <= 8, `${familles.length} familles au plus`);
  const toutes = familles.flatMap(([, , cats]) => cats);
  assert.deepEqual([...toutes].sort(), [...NOTIONS].sort(), 'chaque notion est dans exactement une famille');
  let total = 0;
  for (const [key, label, cats] of familles) {
    const actual = JSON.parse(JSON.stringify(vm.runInContext(`(entFilter=${JSON.stringify(key)},entVisibleItems().map(x=>x.q.cat))`, ctx)));
    assert.ok(actual.length > 0 && actual.every(cat => cats.includes(cat)), `${label} : seules ses questions sont affichées`);
    assert.equal(actual.length, QUESTIONS.filter(q => cats.includes(q.cat)).length, `${label} : compteur exact`);
    total += actual.length;
  }
  assert.equal(total, QUESTIONS.length);
});

test('la liste rassemble chaque notion dans un seul groupe', () => {
  const groupStart = app.indexOf('function entGroupItems(');
  const groupEnd = app.indexOf('\nfunction entFoot(', groupStart);
  assert.ok(groupStart > 0 && groupEnd > groupStart, 'fonction de regroupement trouvée');
  vm.runInContext(app.slice(groupStart, groupEnd), ctx);
  const groups = JSON.parse(JSON.stringify(vm.runInContext('entGroupItems(ENTRETIEN.map((q,i)=>({q,id:String(i)})))', ctx)));
  assert.deepEqual(groups.map(g => g.cat), FILTRES.map(f => f.key), 'les groupes suivent l’ordre des notions (SELECT en haut)');
  assert.equal(new Set(groups.map(g => g.cat)).size, groups.length);
  assert.deepEqual(groups.map(g => g.items.length), groups.map(g => QUESTIONS.filter(q => q.cat === g.cat).length));
});

test('le nombre de questions et de niveaux annoncé correspond à l’appli', () => {
  const n = QUESTIONS.length;
  assert.ok(texte(section).includes(`${n} questions d’entretien SQL`), `vitrine : « ${n} questions d’entretien SQL »`);
  assert.ok(texte(scene).includes(`${n} questions d’entretien`), `vidéo : autocollant « ${n} questions d’entretien »`);
  assert.match(video, new RegExp(`'Entraîne-toi pour l’entretien : ${n} questions SQL`), 'vidéo : texte lu par les lecteurs d’écran');
  const faq = vitrine.slice(vitrine.indexOf('Le parcours prépare-t-il aux entretiens SQL'));
  assert.ok(texte(faq).includes(`${n} questions d’entretien SQL réparties en trois niveaux`), 'FAQ visible');
  assert.match(vitrine, new RegExp(`"text":"Oui. L’appli propose ${n} questions d’entretien SQL réparties en trois niveaux`), 'FAQ des moteurs de recherche');
  const puces = [...section.matchAll(/<ul class="en-themes"[^>]*>(.*?)<\/ul>/gs)].map(m => [...m[1].matchAll(/<li>([^<]+)<\/li>/g)].map(x => x[1]))[0];
  assert.deepEqual(puces, ['Débutant · 34', 'Intermédiaire · 34', 'Avancé · 34'], 'la vitrine annonce les trois niveaux équilibrés');
  assert.ok(texte(section).includes('niveau validé sur 3'));
});

test('la question montrée est celle de l’appli : même numéro, niveau, thème, réponse et exemple', () => {
  const i = QUESTIONS.findIndex(x => x.id === 'ent-v2-06');
  assert.ok(i >= 0, 'la question WHERE/HAVING existe dans l’appli');
  const x = QUESTIONS[i], n = QUESTIONS.length;
  assert.ok(texte(section).includes(`Question ${i + 1} sur ${n}`), `vitrine : « Question ${i + 1} sur ${n} »`);
  assert.ok(texte(scene).includes(`Question ${i + 1}/${n}`), `vidéo : « Question ${i + 1}/${n} »`);
  for (const [nom, h] of [['vitrine', section], ['vidéo', scene]]) {
    assert.ok(texte(h).includes(x.q), `${nom} : la question`);
    assert.ok(texte(h).includes(x.cat), `${nom} : le thème « ${x.cat} »`);
    assert.ok(texte(h).includes(x.niveau), `${nom} : le niveau « ${x.niveau} »`);
  }
  const rep = section.match(/<div class="en-open">\s*<small>Réponse attendue<\/small>\s*<p>(.*?)<\/p>/s);
  assert.ok(rep, 'vitrine : réponse attendue présente');
  assert.equal(texte(rep[1]), texte(x.a), 'vitrine : la réponse est celle de l’appli, mot pour mot');
  const code = section.match(/<div class="mini-code">(.*?)<\/div>/s);
  assert.ok(code && x.sql, 'vitrine : exemple SQL présent');
  assert.equal(texte(code[1]), x.sql, 'vitrine : l’exemple SQL est celui de l’appli');
  /* La vidéo montre la réponse attendue, sans la requête d’exemple (Elisa, 30 octobre, 20 h 45 : « ne mets pas la requête ici ») */
  assert.ok(texte(scene).includes('Réponse attendue'), 'vidéo : réponse attendue');
  assert.doesNotMatch(scene, /en-sql|mini-code|<code>SELECT/, 'vidéo : pas de requête dans la carte');
  assert.doesNotMatch(video, /const ENQ = /, 'vidéo : plus de requête tapée');
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
  /* Elisa, 30 octobre, 20 h 01 : « La méthode » passe à 7 s pour être lue et « Défie tes amis » s’ajoute aux cas pratiques :
     2 min 14 s, toujours autour de deux minutes */
  assert.ok(duree <= 135, 'la vidéo reste autour de deux minutes, comme l’annonce la vitrine');
});

/* Elisa, 30 octobre, 21 h 10 : « tu n’as pas laissé d’espace dans le cadre ». Dans la vidéo, l’icône touchait le haut
   du cadre pointillé et le bouton « Révéler la réponse » son bas. Le cadre garde au moins 28 px d’air de chaque côté,
   la carte au moins 28 px sous « Je maîtrise / À revoir », et le doigt tombe toujours au milieu des deux boutons. */
test('vidéo, entretien : de l’air dans le cadre pointillé, et le doigt tombe sur les boutons', () => {
  const regle = sel => { const m = video.match(new RegExp(`\\n${sel.replace(/[.#]/g, c => '\\' + c)}\\{([^}]*)\\}`)); assert.ok(m, sel); return m[1]; };
  const px = (sel, prop) => { const m = regle(sel).match(new RegExp(`(?:^|;)${prop}:(-?[\\d.]+)px`)); assert.ok(m, `${sel} ${prop}`); return +m[1]; };
  const bord = +regle('.en-ans').match(/border:(\d+)px dashed/)[1];
  /* Le bloc centré : icône, « À toi de répondre », bouton (son liseré de 5 px dépasse en dessous, hors mise en page) */
  const bloc = px('.en-lock .ico', 'width') + 2 * px('.en-lock', 'gap') + +regle('.en-lock b').match(/font:800 (\d+)px\/1 /)[1] + px('.en-rev', 'height');
  const airHaut = (px('.en-ans', 'height') - 2 * bord - bloc) / 2, airBas = airHaut - 5;
  assert.ok(airHaut >= 28 && airBas >= 28, `air au-dessus de l’icône (${airHaut} px) et sous le bouton (${airBas} px)`);
  const bas = px('.en-seg', 'top') + px('.en-seg', 'height');
  assert.equal(px('.en-seg', 'top'), px('.en-ans', 'top') + px('.en-ans', 'height') + 20, '20 px entre le cadre et les deux boutons');
  assert.ok(px('#en', 'height') - bas >= 28, 'de l’air sous « Je maîtrise / À revoir »');
  assert.ok(px('#en', 'top') + px('#en', 'height') + 20 <= px('#stk-en', 'top'), 'l’autocollant reste sous la carte');
  /* Le doigt (56 px) : d’abord sur « Révéler la réponse » (au milieu du cadre, en bas du bloc), puis sur « Je maîtrise » */
  const haut = px('#en-touch', 'top'), milieu = haut + 28;
  const centreCadre = px('#en', 'top') + px('.en-ans', 'top') + px('.en-ans', 'height') / 2;
  const bouton = centreCadre + bloc / 2 - px('.en-rev', 'height') / 2;
  assert.ok(Math.abs(milieu - bouton) <= 4, `doigt ${milieu} / bouton ${bouton}`);
  const y = +video.match(/T\.fromTo\('#en-touch', \{autoAlpha: 0, x: -49, y: (\d+)\}, \{autoAlpha: 1, x: -209, y: (\d+),/)[2];
  const jeMaitrise = px('#en', 'top') + px('.en-seg', 'top') + px('.en-seg', 'height') / 2;
  assert.ok(Math.abs(milieu + y - jeMaitrise) <= 4, `doigt ${milieu + y} / « Je maîtrise » ${jeMaitrise}`);
});
