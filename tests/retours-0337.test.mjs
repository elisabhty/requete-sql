/* Elisa, 4 novembre, 3 h 37 : « dans l’onboarding il faudrait implémenter la vidéo data analyst ».
   La vidéo de la vitrine (decouvrir/video.html, « Le métier de data analyst », avec sa voix) s’ouvre dans un cadre par-dessus l’accueil
   de l’onboarding, pour qui ne l’a pas vue sur le site : l’app iPhone, l’appli installée, l’adresse de l’appli ouverte directement.
   Avec ?onboarding, la page signale « Passer la vidéo » et « Commencer » à l’appli au lieu de changer de page.
   Vérifié dans un navigateur de la taille d’un iPhone (mode app) : affiche, lecture avec la voix, « Passer la vidéo » puis l’accueil
   qui s’anime, balayage arrière vers la vidéo, rechargement (plus de vidéo), fin de la vidéo puis « Commencer », aperçu, page
   introuvable (le « Passer la vidéo » de l’appli), arrivée du site par ./?depuis=video (pas de vidéo).
   12 novembre, 18 h 06 (Elisa, sur l’app iPhone : « Supprime la vidéo ») : la vidéo ne passe plus dans l’appli, ni avant l’accueil,
   ni dans l’aperçu, ni dans « Revoir l’intro ». La page du site (decouvrir/video.html) reste, avec son mode ?onboarding. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html'), page = read('decouvrir/video.html'), surf = read('safari-surface.css');
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };
const fn = (name, next) => { const i = app.lastIndexOf(`function ${name}(`); assert.ok(i > 0, name); return app.slice(i, app.indexOf(next, i)); };

test('12 novembre, 18 h 06 : plus de vidéo dans l’appli, l’onboarding s’ouvre sur sa première page', () => {
  for (const reste of ['obVideo', 'ob-video', 'rq-video-vue', 'video-fin', 'video-prete', 'decouvrir/video.html?onboarding'])
    assert.ok(!app.includes(reste), `plus de « ${reste} » dans index.html`);
  assert.ok(!surf.includes('ob-video-step'));
  const start = fn('startOnboarding', '/* 13 h 48');
  assert.ok(start.includes("obFinRappel=obFinWidget=null;\n  const reprise=") && start.includes('  }\n  paintOb();\n}'), 'la reprise, sinon la première page, sans rien par-dessus');
  assert.ok(fn('obApercuOuvrir', 'function obApercuFermer(').includes('  obJustEntered=true;\n  paintOb();\n}'));
  assert.ok(fn('replayOnboarding', '/* Enregistrer un fichier').includes('  startOnboarding();\n}'), '« Revoir l’intro » : l’onboarding, sans la vidéo');
  const back = fn('obBack', 'function obPick(');
  assert.ok(back.includes("if(obStep===0||OB_SLIDES[obStep]==='pseudo')return;"), 'sur la première page, le retour arrière ne mène nulle part');
  assert.ok(app.includes("if(slide==='welcome')obRunWelcomeDemo();"), 'l’accueil s’anime tout de suite');
  const html = cut(app, '<div id="onboarding"', '<div class="burst"');
  assert.ok(!html.includes('<iframe') && !/Passer<span>/.test(html));
  assert.ok(app.includes('<link rel="stylesheet" href="safari-surface.css?v=14">') && read('sw.js').includes("'./safari-surface.css?v=14',"));
  /* Arrivé du site : plus rien à retenir sur la vidéo */
  const mo = app.slice(app.indexOf('function maybeOnboard(){'), app.indexOf('function startOnboarding(', app.indexOf('function maybeOnboard(){')));
  assert.ok(mo.includes('const viaConnexion=depuisConnexion(),viaVitrine=depuisVitrine();\n  oublierDepuis();'));
});

test('decouvrir/video.html?onboarding : ni « Retour » ni « Se connecter », et la fin est dite à l’appli au lieu de changer de page', () => {
  assert.ok(page.indexOf("if(/[?&]onboarding\\b/.test(location.search)&&window.parent!==window)document.documentElement.classList.add('vd-onboarding');") < page.indexOf('<style>'), 'dès la première image');
  assert.ok(page.includes('html.vd-onboarding .bar.top{justify-content:flex-end}') && page.includes('html.vd-onboarding .pill.back,html.vd-onboarding .pill.login{display:none}'));
  const iife = cut(page, '/* Vers l’appli : la vidéo s’arrête', '</script>');
  const run = embed => {
    const sent = [], calls = [], body = new Set(); let click = null;
    const ctx = vm.createContext({
      document: {querySelector: () => null, documentElement: {classList: {contains: c => embed && c === 'vd-onboarding'}, style: {}},
        body: {classList: {add: c => body.add(c), remove: c => body.delete(c)}}, addEventListener: (t, h) => { if (t === 'click') click = h; }},
      window: {parent: {postMessage: (m, o) => sent.push([m.requete, o])}}, location: {href: 'video.html'},
      matchMedia: () => ({matches: false}), setTimeout: f => f(), addEventListener() {}, pause: () => calls.push('pause')});
    vm.runInContext(iife, ctx);
    const a = {href: '../?depuis=video'};
    let prevented = false;
    click({target: {closest: () => a}, preventDefault() { prevented = true; }, defaultPrevented: false, button: 0});
    return {sent, calls, body, prevented, href: ctx.location.href};
  };
  const e = run(true);
  assert.deepEqual(e.sent, [['video-prete', '*'], ['video-fin', '*']], 'prête, puis la fin');
  assert.ok(e.prevented && e.calls.includes('pause')); assert.equal(e.href, 'video.html', 'la page reste'); assert.equal(e.body.has('vd-leave'), false);
  const s = run(false);
  assert.deepEqual(s.sent, [], 'sur le site : rien à dire'); assert.equal(s.href, '../?depuis=video', 'sur le site : vers l’appli, comme avant'); assert.ok(s.body.has('vd-leave'));
});

test('l’app iPhone embarque la vidéo : la page, sa mascotte, sa voix et sa musique', () => {
  const b = read('scripts/build-www.mjs');
  /* 14 h 08 : avec les avis audio de la vitrine (decouvrir/avis), pour l’étape « Ils apprécient Requête » */
  assert.ok(b.includes("for (const f of ['decouvrir/video.html', 'decouvrir/mascotte.webp', 'decouvrir/voix', 'decouvrir/avis']) cpSync(join(root, f), join(out, f), {recursive: true});"));
  const voix = JSON.parse(read('decouvrir/voix/voix.json'));
  for (const c of voix.scenes) assert.ok(fs.statSync(path.join(ROOT, 'decouvrir/voix', c.id + '.mp3')).size > 2000, c.id);
  assert.ok(fs.existsSync(path.join(ROOT, 'decouvrir/voix/musique.mp3')) && fs.existsSync(path.join(ROOT, 'decouvrir/mascotte.webp')));
  /* La page n’utilise que ce qui est embarqué : ../assets (copié en entier), sa mascotte et voix/ */
  const refs = [...page.matchAll(/(?:src|href)="(?!https?:|data:|#|\.\.\/assets\/|\.\.\/\?depuis=)([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual([...new Set(refs)].sort(), ['./', 'connexion.html#cx-form', 'mascotte.webp'], 'Retour et Se connecter, masqués dans l’appli');
});
