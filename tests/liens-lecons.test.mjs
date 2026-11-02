/* Elisa, 1er novembre, 21 h 30 : « faire ça pour toutes les leçons, vérifier la cohérence » : comme les vidéos du projet, chaque leçon
   rappelle la leçon d’avant (« Dans la leçon précédente, tu as… ») et annonce celle d’après (« Dans la prochaine leçon, tu… », puis la
   pastille « Prochaine leçon · … »). Les phrases sont dans assets/anim/liens.js, dans l’ordre des leçons de l’app. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const ctx = vm.createContext({window: {}});
vm.runInContext(read('assets/anim/liens.js'), ctx);
const LIENS = JSON.parse(JSON.stringify(ctx.window.LIENS)), liensDe = p => JSON.parse(JSON.stringify(ctx.window.liensDe(p) || {}));
const html = read('index.html');
/* Les leçons de l’app, dans l’ordre : [page de la vidéo, titre]. */
const APP = [...html.matchAll(/guide\(\{ id:\d+, titre:"([^"]+)"/g)].map((m, i, all) => {
  const seg = html.slice(m.index, all[i + 1] ? all[i + 1].index : m.index + 6000), v = /video:\{anim:'assets\/anim\/([\w-]+)\.html\?/.exec(seg);
  return v ? [v[1], m[1].replace(/'/g, '’')] : null;
}).filter(Boolean);

test('liens.js suit l’ordre des leçons de l’app, de la première à la dernière', () => {
  assert.equal(APP.length, 71, '71 leçons en vidéo');
  assert.deepEqual(LIENS.map(l => l.page), APP.map(a => a[0]));
});

test('chaque leçon a son lien avec celle d’avant et celle d’après ; le projet garde les siens, écrits dans sa vidéo', () => {
  LIENS.forEach((l, i) => {
    const L = liensDe(l.page), page = read(`assets/anim/${l.page}.html`);
    assert.ok(page.includes('<script src="liens.js"></script>'), `${l.page} : liens.js chargé`);
    const projet = l.page.startsWith('projet-');
    if (i === 0) assert.equal(L.avant, undefined, 'la première leçon n’a pas de leçon d’avant');
    else if (!projet || l.page === 'projet-normaliser') assert.equal(L.avant, `Dans la leçon précédente, ${LIENS[i - 1].passe}.`, `${l.page} : la leçon d’avant`);
    else assert.equal(L.avant, undefined, `${l.page} : déjà dans sa vidéo`);
    if (projet) assert.equal(L.apres, undefined, `${l.page} : déjà dans sa vidéo`);
    else {
      assert.equal(L.apres, `Dans la prochaine leçon, ${LIENS[i + 1].futur}.`, `${l.page} : la leçon d’après`);
      assert.equal(L.suite, LIENS[i + 1].titre);
    }
  });
});

test('le titre de la pastille est celui de la leçon suivante dans l’app', () => {
  LIENS.forEach((l, i) => assert.equal(l.titre, APP[i][1], `${l.page} : « ${APP[i][1]} »`));
});

test('le moteur commun et la page WHERE montrent les liens : une pause sur l’intro, la fin allongée, VoiceOver et la voix', () => {
  const core = read('assets/anim/core.js'), where = read('assets/anim/where.html'), css = read('assets/anim/core.css');
  for (const t of ['function pontLiens(){', 'function pontRender(T){', 'function pontVoice(v){', "QS.has('noliens')", 'if (PONTS.length) pontRender(T);',
    "liens: PONTS.map(p => ({k: p.k, a: p.a, b: p.b,"]) assert.ok(core.includes(t), `core.js : ${t}`);
  for (const t of ['function pontPlan(){', 'if (PONTS.length) pontRender(T);', "window.liensDe('where')", 'body.pont-fin .pont-pill{'])
    assert.ok(where.includes(t), `where.html : ${t}`);
  assert.ok(css.includes('body.pont-fin .pont-pill{opacity:var(--pont-a,1);visibility:visible}'), 'la pastille de fin');
  assert.ok(read('sw.js').includes("'./assets/anim/liens.js',"), 'liens.js disponible hors ligne');
});

test('dans le projet, chaque pastille « Prochaine leçon · … » porte le titre de la leçon suivante dans l’app', () => {
  const projet = LIENS.map((l, i) => [l, i]).filter(([l]) => l.page.startsWith('projet-'));
  for (const [l, i] of projet) {
    const next = LIENS[i + 1], page = read(`assets/anim/${l.page}.html`);
    if (!next) { assert.ok(!page.includes('Prochaine leçon · '), `${l.page} : la dernière leçon n’annonce rien`); continue; }
    const pills = [...page.matchAll(/Prochaine leçon · ([^<']+)</g)].map(m => m[1]);
    assert.deepEqual(pills, [next.titre], `${l.page} : « Prochaine leçon · ${next.titre} »`);
  }
});

test('les cours en voix off disent aussi leurs liens : lienavant, lienapres, calés et présents dans assets/voix', () => {
  const voix = LIENS.filter(l => /const VOICE = \{dir: '\.\.\/voix\//.test(read(`assets/anim/${l.page}.html`)));
  assert.ok(voix.length >= 4, `${voix.length} cours en voix`);
  for (const l of voix) {
    const page = read(`assets/anim/${l.page}.html`), L = liensDe(l.page);
    for (const k of ['avant', 'apres']) {
      if (!L[k]) continue;
      assert.ok(new RegExp(`"lien${k}":\\["lien${k}",[\\d.]+,[\\d.]+\\]`).test(page), `${l.page} : lien${k} calé`);
      assert.ok(fs.existsSync(new URL(`../assets/voix/${l.page}/lien${k}.mp3`, import.meta.url)), `${l.page}/lien${k}.mp3`);
    }
  }
});
