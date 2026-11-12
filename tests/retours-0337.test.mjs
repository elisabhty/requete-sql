/* Elisa, 4 novembre, 3 h 37 : « dans l’onboarding il faudrait implémenter la vidéo data analyst ».
   La vidéo de la vitrine (decouvrir/video.html, « Le métier de data analyst », avec sa voix) s’ouvre dans un cadre par-dessus l’accueil
   de l’onboarding, pour qui ne l’a pas vue sur le site : l’app iPhone, l’appli installée, l’adresse de l’appli ouverte directement.
   Avec ?onboarding, la page signale « Passer la vidéo » et « Commencer » à l’appli au lieu de changer de page.
   Vérifié dans un navigateur de la taille d’un iPhone (mode app) : affiche, lecture avec la voix, « Passer la vidéo » puis l’accueil
   qui s’anime, balayage arrière vers la vidéo, rechargement (plus de vidéo), fin de la vidéo puis « Commencer », aperçu, page
   introuvable (le « Passer la vidéo » de l’appli), arrivée du site par ./?depuis=video (pas de vidéo). */
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

/* Le module de la vidéo (index.html), exécuté seul avec un DOM réduit au nécessaire. */
const lab = ({vue = null, site = false, apercu = false} = {}) => {
  const calls = [], store = new Map(vue ? [['rq-video-vue', vue]] : []);
  const cls = () => { const s = new Set(); return {add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), contains: c => s.has(c), has: c => s.has(c)}; };
  const part = n => ({n, inert: false, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }});
  const parts = [part('progress'), part('slides'), part('foot')];
  const inner = {kids: [], appendChild(f) { this.kids.push(f); layer.frame = f; }};
  const layer = {hidden: true, classList: cls(), offsetWidth: 1, frame: null,
    querySelector: s => s === 'iframe' ? layer.frame : s === '.ob-video-in' ? inner : null};
  const root = {classList: cls(), querySelectorAll: () => parts};
  const made = [];
  const win = {};
  let onMessage = null;
  const ctx = vm.createContext({
    document: {
      getElementById: id => id === 'onboarding' ? root : id === 'ob-video' ? layer : null,
      querySelector: s => s === '#ob-video iframe' ? layer.frame : null,
      createElement: () => { const f = {attrs: {}, l: {}, removed: false, contentWindow: {location: {pathname: '/decouvrir/video.html'}},
        setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(t, h) { this.l[t] = h; }, focus() { calls.push('focus'); },
        remove() { this.removed = true; if (layer.frame === this) layer.frame = null; }}; made.push(f); return f; }
    },
    localStorage: {getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v))},
    addEventListener: (t, h) => { if (t === 'message') onMessage = h; },
    setTimeout: f => { f(); return 1; }, clearTimeout() {},
    prefersReduceMotion: () => false, obBarreEtat: () => calls.push('barres'),
    paintOb: () => calls.push('accueil ' + ctx.obJustEntered), obDemoTimers: [7], obJustEntered: false, obApercu: apercu
  });
  vm.runInContext(cut(app, '/* ---------- La vidéo « Le métier de data analyst », avant l’accueil ----------', 'function startOnboarding(initial') + `;obVideoSite=${site};`, ctx);
  return {ctx, calls, store, layer, root, parts, made, send: (data, source) => onMessage({data, source})};
};

test('la vidéo s’ouvre dans un cadre par-dessus l’accueil, qui ne s’anime pas dessous', () => {
  const t = lab();
  assert.equal(t.ctx.obVideoVoulue(), true, 'jamais vue : montrée');
  t.ctx.obVideoOuvrir();
  const f = t.made[0];
  assert.equal(f.src, 'decouvrir/video.html?onboarding'); assert.equal(f.title, 'Vidéo : le métier de data analyst');
  assert.equal(f.attrs.allow, 'autoplay; fullscreen');
  assert.equal(t.layer.hidden, false); assert.equal(t.ctx.obVideoOn(), true); assert.ok(t.root.classList.contains('ob-video-step'));
  assert.ok(t.parts.every(p => p.inert && p.attrs['aria-hidden'] === 'true'), 'l’accueil, dessous, n’est ni lu ni touchable');
  assert.equal(t.ctx.obDemoTimers.length, 0, 'l’écriture de la console et sa vibration attendent');
  assert.ok(t.calls.includes('barres') && t.calls.includes('focus'));
  t.ctx.obVideoOuvrir(); assert.equal(t.made.length, 1, 'déjà ouverte : rien de plus');
});

test('« Passer la vidéo » ou « Commencer » (signalés par le cadre) ouvrent l’accueil, qui s’anime ; la vidéo est retenue comme vue', () => {
  const t = lab(); t.ctx.obVideoOuvrir(); const f = t.made[0];
  t.send({requete: 'video-fin'}, {});   // une autre fenêtre : ignoré
  assert.equal(t.ctx.obVideoOn(), true);
  t.send({requete: 'video-prete'}, f.contentWindow);
  assert.ok(t.layer.classList.contains('is-prete'), 'le cadre est prêt : le « Passer la vidéo » de l’appli s’efface');
  t.send({requete: 'video-fin'}, f.contentWindow);
  assert.equal(t.ctx.obVideoOn(), false); assert.equal(t.layer.hidden, true); assert.ok(!t.root.classList.contains('ob-video-step'));
  assert.ok(t.parts.every(p => !p.inert && !('aria-hidden' in p.attrs)));
  assert.ok(t.calls.includes('accueil true'), 'l’accueil repart de son entrée (console qui s’écrit, mascotte)');
  assert.equal(f.src, 'about:blank'); assert.equal(f.removed, true, 'le cadre est retiré : plus de son');
  assert.equal(t.store.get('rq-video-vue'), '1');
  assert.equal(lab({vue: '1'}).ctx.obVideoVoulue(), false, 'vue : pas remontrée');
  assert.equal(lab({site: true}).ctx.obVideoVoulue(), false, 'arrivé du site, où elle vient juste avant l’appli');
});

test('aperçu : rien n’est retenu ; fermeture de l’onboarding : sans suite ; cadre devenu autre chose : refermé', () => {
  let t = lab({apercu: true}); t.ctx.obVideoOuvrir(); t.ctx.obVideoFermer();
  assert.equal(t.store.has('rq-video-vue'), false, 'aperçu : rien d’enregistré');
  t = lab(); t.ctx.obVideoOuvrir(); t.ctx.obVideoFermer(true);
  assert.equal(t.store.has('rq-video-vue'), false); assert.ok(!t.calls.some(c => c.startsWith('accueil')), 'sans repeindre l’accueil');
  t = lab(); t.ctx.obVideoOuvrir(); const f = t.made[0];
  f.contentWindow.location.pathname = '/index.html'; f.l.load();
  assert.equal(t.ctx.obVideoOn(), false, 'une ancienne copie de la page qui mènerait à l’appli dans le cadre : l’accueil');
  t = lab(); t.ctx.obVideoOuvrir(); t.made[0].l.load(); assert.equal(t.ctx.obVideoOn(), true, 'la vidéo elle-même : rien');
});

test('dans le parcours : à l’entrée par l’accueil, l’aperçu et « Revoir l’intro » ; retour arrière depuis l’accueil ; arrivée du site', () => {
  const start = fn('startOnboarding', 'let obApercu=false;');
  /* 4 novembre, 13 h 48 : un onboarding repris (retours-1348) ne remontre pas la vidéo */
  assert.ok(start.includes("obVideoMontree=false;obFinRappel=obFinWidget=null;\n  const reprise=") && start.includes("}else if(obEntry==='welcome'&&obVideoVoulue())obVideoOuvrir();\n  paintOb();"), 'avant de peindre l’accueil');
  assert.ok(fn('obApercuOuvrir', 'function obApercuFermer(').includes('obVideoOuvrir();   // la vidéo d’abord, même déjà vue sur cet appareil'));
  assert.ok(fn('replayOnboarding', '/* Enregistrer un fichier').includes('startOnboarding();\n  obVideoOuvrir();'));
  assert.ok(fn('closeOnboardingAuth', 'function obGoto(').includes('obVideoFermer(true);'));
  const back = fn('obBack', 'function obPick(');
  /* 12 novembre : la première page est « bonjour » (réf. 5) ; le retour arrière y rouvre la vidéo */
  assert.ok(back.indexOf("if(OB_SLIDES[obStep]==='bonjour'&&obVideoMontree&&!obVideoOn()){obVideoOuvrir();return;}") > 0
    && back.indexOf('obVideoOuvrir') < back.indexOf("if(obStep===0||OB_SLIDES[obStep]==='pseudo')return;"), 'balayage arrière sur l’accueil : la vidéo');
  assert.ok(app.includes("if(slide==='welcome'&&!obVideoOn())obRunWelcomeDemo();"), 'pas de vibration de la console sous la vidéo');
  /* maybeOnboard, exécuté seul (comme tests/premiere-visite.test.mjs) */
  const src = app.slice(app.indexOf('function maybeOnboard(){'), app.indexOf('function startOnboarding(){', app.indexOf('function maybeOnboard(){')));
  const arrive = search => {
    const store = new Map();
    const ctx = vm.createContext({URL, URLSearchParams, location: {search, href: 'https://requete.app/' + search},
      sessionStorage: {removeItem() {}}, localStorage: {removeItem() {}, setItem: (k, v) => store.set(k, v)}, NAV_KEY: 'nav', NAV_KEY_LONG: 'nav-long',
      history: {state: null, replaceState() {}}, state: {lessons: {}, plan: null, profile: {}, onboarded: false, accountMode: null},
      apercuPlan: () => ({}), obVitrineGoal: () => '', save() {}, startOnboarding() {}, switchTab() {},
      renderGreeting() {}, renderHomeHero() {}, renderProgress() {}, renderPlanning() {}, renderCompte() {}});
    vm.runInContext(src + '\nmaybeOnboard();', ctx);
    return [ctx.obVideoSite, store.get('rq-video-vue') || null];
  };
  assert.deepEqual(arrive('?depuis=video'), [true, '1'], 'vue sur le site juste avant');
  assert.deepEqual(arrive('?depuis=connexion'), [true, '1']);
  assert.deepEqual(arrive(''), [false, null], 'app iPhone, appli installée : montrée');
});

test('le calque : par-dessus tout l’onboarding, son fond clair sous l’heure, un « Passer la vidéo » de l’appli tant que le cadre se tait', () => {
  const html = cut(app, '<div id="onboarding"', '<div class="burst"');
  assert.ok(html.includes('<div class="ob-video" id="ob-video" hidden><div class="ob-video-in"></div><button type="button" class="ob-video-skip" onclick="obVideoFermer()">Passer<span>&nbsp;la vidéo</span>'));
  assert.ok(html.indexOf('id="ob-video"') > html.indexOf('class="ob-foot"'));
  /* html #onboarding.ob-vitrine>* (1,1,1) met chaque enfant en position:relative : #ob-video (2,0,1) passe devant */
  assert.ok(read('onboarding-vitrine.css').includes('html #onboarding.ob-vitrine>*{position:relative;z-index:1}'));
  assert.ok(app.includes('html #onboarding #ob-video{position:absolute;inset:0;z-index:60;background:#F4F2FC;opacity:0;transition:opacity .3s ease}'));
  assert.ok(app.includes('html #onboarding #ob-video[hidden]{display:none}') && app.includes('#onboarding #ob-video.is-prete .ob-video-skip{display:none}'));
  assert.ok(app.includes('#onboarding .ob-video-in{position:absolute;top:var(--safe-top,env(safe-area-inset-top,0px));'), 'le cadre sous l’heure, au-dessus de la barre d’accueil');
  /* Barres : claires pendant la vidéo ; l’écran de chargement, encore là au tout début, garde son violet */
  const i = surf.indexOf('html.lq:has(:where(#onboarding.on)),'), j = surf.indexOf('html.lq:has(:where(#onboarding.on.ob-video-step)){--browser-top:#F4F2FC;--browser-bottom:#F4F2FC}');
  const k = surf.indexOf('html.lq:has(:where(#loader:not(.fade-out)', j);
  assert.ok(i > 0 && j > i && k > j, 'onboarding, puis la vidéo, puis l’écran de chargement');
  assert.ok(app.includes('<link rel="stylesheet" href="safari-surface.css?v=13">') && read('sw.js').includes("'./safari-surface.css?v=13',"));
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
