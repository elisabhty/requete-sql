/* 4 novembre, 10 h 45 (Elisa, capture de la page de connexion sur son iPhone) : son texte, « Ta première requête est réussie ! 🎉 /
   Tu viens de franchir une première étape. Et ce n’est que le début ! / Tu pourras sauvegarder ta progression et reprendre tes cours
   sur tous tes appareils. / Continuer avec Apple / Continuer avec un e-mail » ; « et du coup, peut-être supprimer le bravo pour la
   requête et passer directement à la connexion avec confettis de ouf » ; « et centrer à la verticale les éléments ».
   La connexion vient juste après la première requête ; la page du résultat n’a plus de « Bravo » ni de bandeau, et la connexion
   arrive d’elle-même une fois le résultat déplié ; elle la fête avec une gerbe de confettis, une fois par onboarding. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html');
const css = read('onboarding-vitrine.css');
const sw = read('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const lastCut = (a, b) => { const i = app.lastIndexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

const fournisseurs = cut('const OB_PROVIDERS=', '/* 10 h 16 : pas encore de connexion.');
const page = cut("  }else if(slide==='account'){", "  }else if(slide==='name'){");
const rendre = ({ practiceDone = true, authReady = false } = {}) => {
  const ctx = vm.createContext({ slide: 'account', authReady, obAuthBusy: false, obAuthMessage: '', draft: { practiceDone }, MASCOT_IMG: 'mascotte.png',
    obFlowHeader: s => `<header data-etape="${s}"></header>`, esc: s => String(s), escAttr: s => String(s), legalUrl: k => `decouvrir/${k}.html`,
    obSetFooter() {}, obPasserConnexion() {} });
  vm.runInContext(fournisseurs.replace('const OB_PROVIDERS=', 'var OB_PROVIDERS='), ctx);
  vm.runInContext("var html='';if(slide==='x'){" + page + '}', ctx);
  return ctx.html;
};

test('la connexion vient juste après la première requête, et les transitions vont vers l’avant', () => {
  const ob = vm.runInNewContext(app.match(/const OB_SLIDES = (\[[^\]]+\]);/)[1]);
  assert.deepEqual([...ob].slice(ob.indexOf('practice'), ob.indexOf('practice') + 3), ['practice', 'account', 'source'], 'dans l’ordre du tunnel (obGoto calcule le sens avec cet ordre)');
  const fin = cut('const OB_FIN_SLIDES=', '/* « Me rappeler de m’entraîner »');
  const ctx = vm.createContext({ OB_PROFILE_SLIDES: ['name', 'practice'], obAuthReady: () => false, window: { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios',
    isPluginAvailable: n => n === 'RequeteWidget', Plugins: { LocalNotifications: {} } } } });
  vm.runInContext(fin, ctx);
  assert.deepEqual([...ctx.obFinFlux()], ['practice', 'account', 'source', 'rappel'], '13 h 48 : le widget vient après la première leçon');
  assert.equal(ctx.obAfterPractice(), 'account');
  assert.equal(ctx.obFinSuivante('account'), 'source', 'puis les sources et le rappel');
  assert.equal(ctx.obFinSuivante('rappel'), 'ready');
  assert.ok(cut('function obPasserConnexion(){', '/* Les fournisseurs,').includes("obGoto(obFinSuivante('account'));"));
});

test('la page du résultat, sans « Bravo » : le résultat se déplie, puis la connexion arrive d’elle-même', () => {
  const p = sansCommentaires(lastCut("}else if(slide==='practice'){", "}else if(slide==='source'){"));
  assert.ok(!/bravo/i.test(p) && !p.includes('ob-practice-reward') && !p.includes('Premier succès'));
  assert.ok(p.includes('<h1 class="ob-title" id="ob-title">Voilà le <em>résultat</em> de ta requête.</h1>'));
  /* obPracticeRun, exécutée seule : la requête réussit, la page se redessine, et la connexion suit 2,4 s plus tard */
  const run = lastCut('function obPracticeRun(){', 'function obCanNext(){');
  assert.ok(!run.includes('obConfettiAt(') && !run.includes("classList.add('ob-cheer')"), 'la fête est sur la connexion');
  const jouer = ({ reduit = false, quitter = false, echec = false } = {}) => {
    const vers = [], minuteurs = [], appels = [];
    const ctx = vm.createContext({
      draft: {}, OB_SLIDES: ['practice', 'account'], obStep: 0, obLock: false, obDemoTimers: [],
      db: { exec: () => { if (echec) throw new Error('pas de moteur'); return [{ values: [[1, 'Léa', 'Paris'], [4, 'Hugo', 'Paris']] }]; } },
      prefersReduceMotion: () => reduit, buzz: k => appels.push('buzz ' + k), paintOb: () => appels.push('repeint'), obGoto: t => vers.push(t), obAfterPractice: () => 'account',
      setTimeout: (f, ms) => { minuteurs.push([f, ms]); return minuteurs.length; }, requestAnimationFrame() {}, performance: { now: () => 0 },
      document: { querySelector: () => null },
    });
    vm.runInContext(run, ctx);
    vm.runInContext('obPracticeRun()', ctx);
    if (quitter) ctx.obStep = 1;
    minuteurs.forEach(([f]) => f());
    return { vers, minuteurs: minuteurs.map(m => m[1]), appels, draft: ctx.draft };
  };
  const a = jouer();
  assert.ok(a.draft.practiceDone && a.appels.includes('buzz success') && a.appels.includes('repeint'));
  assert.deepEqual(a.minuteurs, [2400], 'le temps de voir les lignes arriver et « Paris » s’allumer');
  assert.deepEqual(a.vers, ['account']);
  assert.deepEqual(jouer({ reduit: true }).minuteurs, [1800], 'en mouvements réduits, rien ne se déplie : un peu moins long');
  assert.deepEqual(jouer({ quitter: true }).vers, [], 'quittée avant (Retour, ou « Continuer » déjà touché) : rien');
  const e = jouer({ echec: true });
  assert.ok(e.draft.practiceFailed && e.minuteurs.length === 0 && e.vers.length === 0, 'moteur indisponible : on reste, « Continuer » mène à la suite');
});

test('la page de connexion : son texte, Apple et l’e-mail, et la fête seulement après une vraie réussite', () => {
  const html = rendre();
  assert.ok(html.startsWith('<div class="ob-screen ob-profile ob-account is-fete"><header data-etape="account"></header>'));
  assert.ok(html.includes('<img class="ob-promise-stk ob-compte-stk" src="mascotte.png" width="450" height="674" alt="" draggable="false">'), 'la mascotte au-dessus du titre');
  assert.ok(html.includes('<h1 class="ob-title" id="ob-title">Ta première requête est <em>réussie</em>&nbsp;!<span class="ob-fete-emoji" aria-hidden="true"> 🎉</span></h1>'));
  assert.ok(html.includes('<p class="ob-compte-lead">Tu viens de franchir une première étape. Et ce n’est que le début&nbsp;!</p>'));
  assert.ok(html.includes('<p class="ob-compte-sub">Tu pourras sauvegarder ta progression et reprendre tes cours sur tous tes appareils.</p>'));
  const ordre = ['ob-compte-stk', 'ob-title', 'ob-compte-lead', 'ob-compte-sub', 'ob-provider-list', 'ob-compte-msg', 'ob-legal-note'].map(k => html.indexOf(k));
  assert.deepEqual([...ordre].sort((x, y) => x - y), ordre, 'dans l’ordre de son texte');
  assert.deepEqual([...html.matchAll(/<span>Continuer avec ([^<]+)<\/span>/g)].map(m => m[1]), ['Apple', 'Google', 'un e-mail'], '14 h 08 : « avec Google aussi »');
  assert.ok(!html.includes('ob-chat'));
  /* Sans première requête réussie (moteur SQL indisponible, ou ouverte depuis Mon compte) : pas de réussite annoncée, pas de fête */
  const sans = rendre({ practiceDone: false });
  assert.ok(sans.startsWith('<div class="ob-screen ob-profile ob-account"><header') && sans.includes('<h1 class="ob-title" id="ob-title">Garde ta <em>progression</em>.</h1>'));
  assert.ok(!sans.includes('réussie') && !sans.includes('ob-compte-lead') && sans.includes('<p class="ob-compte-sub">Tu pourras la sauvegarder et reprendre tes cours sur tous tes appareils.</p>'));
  /* Les confettis : à l’arrivée, une seule fois par onboarding, après une vraie réussite */
  assert.ok(app.includes("  if(slide==='account'&&obJustEntered&&draft.practiceDone&&!draft.feteConnexion){draft.feteConnexion=true;obDemoTimers.push(setTimeout(()=>{if(OB_SLIDES[obStep]==='account')obFeteConnexion();},120));}\n"));
  assert.ok(cut('function startOnboarding(', 'const root=').includes('draft={'), 'oubliés à chaque nouvel onboarding (draft recréé)');
});

test('les confettis de ouf : deux canons, une explosion derrière le titre, une pluie, et trois retours haptiques', () => {
  const fete = cut('const OB_FETE_COULEURS=', 'async function obStartAuth(');
  const lancer = (reduit = false) => {
    const pieces = [], appels = [], minuteurs = [];
    let calque = null;
    const el = tag => ({ tag, style: {}, children: [], className: '', setAttribute() {}, appendChild(c) { this.children.push(c); return c; }, remove() { this.removed = true; },
      animate(k, o) { pieces.push({ k, o }); return {}; } });
    const root = el('div');
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 844 });
    root.appendChild = c => { calque = c; return c; };
    const ctx = vm.createContext({
      Element: { prototype: { animate() {} } }, Math, prefersReduceMotion: () => reduit, buzz: k => appels.push(k),
      setTimeout: (f, ms) => { minuteurs.push([f, ms]); return minuteurs.length; },
      document: { getElementById: id => (id === 'onboarding' ? root : null), createElement: el,
        querySelector: s => (s === '#ob-body .ob-account .ob-title' ? { getBoundingClientRect: () => ({ left: 24, top: 300, width: 342, height: 80 }) } : null) },
    });
    vm.runInContext(fete, ctx);
    vm.runInContext('obFeteConnexion()', ctx);
    minuteurs.forEach(([f]) => f());
    return { pieces, appels, minuteurs: minuteurs.map(m => m[1]), calque };
  };
  const f = lancer();
  assert.equal(f.calque.className, 'ob-build-confetti ob-fete', 'dans le calque de confettis de l’onboarding (au-dessus de tout, sans bloquer les doigts)');
  assert.equal(f.calque.children.length, 72 + 48 + 56);
  assert.equal(f.pieces.length, 176);
  assert.ok(f.pieces.slice(72, 120).every(p => p.o.delay >= 280), 'l’explosion part juste après les canons');
  assert.ok(f.pieces.slice(120).every(p => p.o.delay >= 560), 'puis la pluie');
  assert.deepEqual(f.appels, ['success', 'medium', 'light'], 'comme un feu d’artifice');
  assert.deepEqual(f.minuteurs, [300, 620, 5400]);
  assert.ok(f.calque.removed, 'puis le calque s’efface');
  const r = lancer(true);
  assert.ok(!r.calque && r.pieces.length === 0 && r.appels.join() === 'success', 'mouvements réduits : la vibration de réussite seulement');
});

test('tout centré à la verticale, et les animations en mouvements autorisés', () => {
  const s = sansCommentaires(css);
  for (const r of ['html #onboarding.ob-vitrine .ob-screen.ob-account{min-height:100%}',
    'html #onboarding.ob-vitrine .ob-account .ob-compte-stk{margin:auto auto 8px}',
    'html #onboarding.ob-vitrine .ob-account .ob-legal-note{margin-top:16px!important;margin-bottom:auto!important;',
    'html #onboarding.ob-vitrine.ob-fit-2 .ob-account .ob-title{margin-top:auto!important}',
    'html #onboarding.ob-vitrine .ob-compte-msg:empty{margin:0;padding:0;border:0}',
    'html #onboarding.ob-vitrine>.ob-build-confetti{position:absolute;inset:0;z-index:6;pointer-events:none;overflow:hidden}'])
    assert.ok(s.includes(r), r);
  /* La mascotte de la promesse : exclue de l’entrée en cascade, elle peut sauter de joie ; cachée sur les petits écrans (fit-2) */
  assert.ok(css.includes(':not(.ob-promise-stk)') && css.includes('html #onboarding.ob-vitrine.ob-fit-2 .ob-promise-stk{display:none}'));
  const media = css.slice(css.indexOf('@media (prefers-reduced-motion:no-preference){'), css.indexOf('@media (prefers-reduced-motion:reduce){', css.indexOf('@media (prefers-reduced-motion:no-preference){')));
  for (const k of ['.ob-enter .ob-account.is-fete .ob-compte-stk{animation:obvJoy .9s var(--v-pop) .22s both}', ' .ob-account .ob-compte-stk.is-oups{animation:obvJoyIcon',
    ' .ob-account.is-fete .ob-fete-emoji{animation:obvFeteEmoji 1.2s var(--v-pop) .4s both}', ' .ob-compte-msg.is-new{transform-origin:50% 0;animation:obvBubbleIn'])
    assert.ok(media.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine' + k), k);
  assert.ok(css.includes('@keyframes obvFeteEmoji{'));
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=23">') && sw.includes("'./onboarding-vitrine.css?v=23',"), 'feuille rechargée');
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  assert.ok(app.includes(`const SW_CACHE='${cache}';`) && /^requete-2026-11-0\d-[a-z-]+-v\d+$/.test(cache));
});
