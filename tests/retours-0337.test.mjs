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

test('decouvrir/video.html?onboarding : ni « Retour » ni « Se connecter » ; depuis le 13 novembre, la fin mène à la section iPhone du site', () => {
  assert.ok(page.indexOf("if(/[?&]onboarding\\b/.test(location.search)&&window.parent!==window)document.documentElement.classList.add('vd-onboarding');") < page.indexOf('<style>'), 'dès la première image');
  assert.ok(page.includes('html.vd-onboarding .bar.top{justify-content:flex-end}') && page.includes('html.vd-onboarding .pill.back,html.vd-onboarding .pill.login{display:none}'));
  /* L’appli n’ouvre plus cette page dans un cadre (12 novembre : la scène « Une méthode fondée sur la recherche » est une page de
     l’onboarding) et ne s’ouvre plus dans un navigateur (13 novembre, 1 h 44) : plus de message « video-fin » ni de voile violet,
     la vidéo s’arrête et le lien fait son travail. */
  const iife = cut(page, '/* Vers la section iPhone du site', '</script>');
  let click = null; const calls = [];
  let mode = '';
  const doc = {addEventListener: (t, h) => { if (t === 'click') click = h; }, documentElement: {classList: {contains: c => c === mode}}};
  vm.runInContext(iife, vm.createContext({document: doc, pause: () => calls.push('pause'), parent: {requeteVersAppli: () => calls.push('appli')}}));
  let prevented = false;
  click({target: {closest: s => (s === 'a[href="./#mobile"]' ? {href: './#mobile'} : null)}, preventDefault() { prevented = true; }});
  assert.deepEqual(calls, ['pause']); assert.equal(prevented, false, 'le lien n’est pas retenu');
  click({target: {closest: () => null}, preventDefault() {}});
  assert.deepEqual(calls, ['pause'], 'ailleurs : rien');
  /* 13 novembre, 9 h 56 : dans le héros du site (video.html?site), le lien est retenu (il ouvrirait l’accueil dans le cadre) et
     c’est la page autour qui descend à sa section iPhone. */
  mode = 'vd-site';
  click({target: {closest: s => (s === 'a[href="./#mobile"]' ? {href: './#mobile'} : null)}, preventDefault() { prevented = true; }});
  assert.deepEqual(calls, ['pause', 'pause', 'appli']); assert.equal(prevented, true, 'dans le héros : le lien est retenu');
  assert.ok(!page.includes('video-fin') && !page.includes('postMessage') && !page.includes('vd-leave'));
});

test('l’app iPhone embarque la vidéo : la page, sa mascotte, sa voix et sa musique', () => {
  const b = read('scripts/build-www.mjs');
  /* 14 h 08 : avec les avis audio de la vitrine (decouvrir/avis), pour l’étape « Ils apprécient Requête » */
  assert.ok(b.includes("for (const f of ['decouvrir/video.html', 'decouvrir/mascotte.webp', 'decouvrir/voix', 'decouvrir/avis']) cpSync(join(root, f), join(out, f), {recursive: true});"));
  const voix = JSON.parse(read('decouvrir/voix/voix.json'));
  for (const c of voix.scenes) assert.ok(fs.statSync(path.join(ROOT, 'decouvrir/voix', c.id + '.mp3')).size > 2000, c.id);
  assert.ok(fs.existsSync(path.join(ROOT, 'decouvrir/voix/musique.mp3')) && fs.existsSync(path.join(ROOT, 'decouvrir/mascotte.webp')));
  /* La page n’utilise que ce qui est embarqué : ../assets (copié en entier), sa mascotte et voix/ */
  const refs = [...page.matchAll(/(?:src|href)="(?!https?:|data:|#|\.\.\/assets\/)([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual([...new Set(refs)].sort(), ['./', './#mobile', 'mascotte.webp'], 'Retour, et la section iPhone du site (13 novembre : plus de « Se connecter »)');
});
