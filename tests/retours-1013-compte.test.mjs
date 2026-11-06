/* 6 novembre, 10 h 13 (Elisa : « reconstruise le petit cadre […] sur la partie Mon compte. Donc peut-être faut le bouton déconnexion, je
   sais pas trop, mais je te laisse choisir ») : l’audit UI/UX de la carte de Mon compte. 11 h 12 : Elisa choisit la direction C,
   « Niveau et parcours, deux mesures » : deux tuiles, « Ton niveau » et « Ton parcours ». 12 h 28 (« tout le monde commence au même
   endroit ») : plus de leçons « acquises au départ » dans la tuile du niveau, ni de hachures sur la barre.
   - Le % et la barre comptent les leçons validées sur toutes les leçons, comme le catalogue ; la barre montre chaque leçon à sa place.
   - Le module est celui que propose l’accueil ; « En cours » dès qu’une leçon y est validée ou commencée, sinon « À commencer ».
   - Le nom du niveau s’accorde ; l’initiale d’un prénom qui commence par un emoji reste entière.
   - « Se déconnecter » reste en bas, avec « Supprimer mon compte », dans leur bloc, sans chevron ; sans compte, il le dit.
   - Refaire l’onboarding depuis Mon compte ne refait plus le planning pour rien ; « Enregistrer » y ramène.
   - Le compte connecté garde son nom (normalizeState). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lq = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => { const i = app.indexOf(`function ${name}(`); assert.ok(i >= 0, name); const j = app.indexOf('\n}\n', i); return app.slice(i, j + 3); };
const plain = o => JSON.parse(JSON.stringify(o));
const compte = cut('function renderCompte(){', '\nfunction ');

/* Un petit parcours : 3 modules (1, 2 et 3 leçons) */
const parcours = ({ faites = [], cur = null, commence = [], pos = {} } = {}) => {
  const MODULES = [{ titre: 'Introduction', lessons: [{ id: 0 }] }, { titre: 'Lire une table', lessons: [{ id: 2 }, { id: 13 }] }, { titre: 'Fonctions', lessons: [{ id: 51 }, { id: 52 }, { id: 53 }] }];
  const f = new Set(faites);
  const ctx = vm.createContext({ MODULES, allLessons: MODULES.flatMap(m => m.lessons.map(l => ({ ...l, video: { duree: '10 min', moments: 4 } }))),
    itemDone: id => f.has(id), itemCommence: id => commence.includes(id), pathCurrentLessonId: () => cur,
    moduleDeLecon: id => MODULES.find(m => m.lessons.some(l => l.id === id)) || null, LV_POS: new Map(Object.entries(pos).map(([k, v]) => [+k, v])),
    dureeVideoS: () => 600, exercicesFaits: () => 0, esc: s => String(s), escAttr: s => String(s), ACCT_OK_SVG: '<svg/>', ACCT_ALLER_SVG: '<svg/>',
    parcoursValidees: d => `${d} leçon${d > 1 ? 's' : ''} validée${d > 1 ? 's' : ''} sur 6` });
  vm.runInContext(fn('parcoursCompte') + fn('moduleCompte') + fn('acctParcoursHTML') + fn('acctModuleHTML'), ctx);
  return ctx;
};

test('le % et la barre : les leçons validées sur toutes les leçons, chacune à sa place', () => {
  assert.deepEqual(plain(parcours().parcoursCompte()), { faites: 0, total: 6, pct: 0 });
  assert.deepEqual(plain(parcours({ faites: [2, 13] }).parcoursCompte()), { faites: 2, total: 6, pct: 33 });
  assert.equal(parcours({ faites: [0, 2, 13, 51, 52] }).parcoursCompte().pct, 83);
  assert.equal(parcours({ faites: [0, 2, 13, 51, 52, 53] }).parcoursCompte().pct, 100);
  /* 70 sur 71 : 99 %, pas 100 % */
  const grand = vm.createContext({ allLessons: Array.from({ length: 71 }, (_, i) => ({ id: i })), itemDone: id => id < 70 });
  vm.runInContext(fn('parcoursCompte'), grand);
  assert.equal(grand.parcoursCompte().pct, 99);
  /* La barre : les leçons 2 et 13 (le module 2) remplies, le module 1 encore ouvert ; un trait entre deux modules ; le repère */
  const h = parcours({ faites: [2, 13], cur: 0, pos: { 0: 300 } }).acctParcoursHTML(0);
  assert.ok(h.startsWith('<span class="acct-parc" aria-hidden="true">'));
  assert.ok(h.includes('<i style="left:16.67%;width:33.33%"></i>'), 'les deux leçons du module 2, d’un bloc');
  assert.ok(h.includes('<i class="is-ici" style="left:0.00%;width:16.67%;--vu:50%"></i>'), 'la leçon en cours, à moitié vue');
  assert.equal((h.match(/<b style=/g) || []).length, 2, 'un trait entre deux modules');
  assert.ok(h.includes('<span class="acct-parc-ici" style="left:8.33%"></span>'));
  assert.ok(!parcours({ faites: [0, 2, 13, 51, 52, 53] }).acctParcoursHTML(null).includes('acct-parc-ici'), 'tout est fait : pas de repère');
});

test('le module : celui de l’accueil, « En cours » ou « À commencer » ; le planning fini ; le parcours fini', () => {
  assert.deepEqual(plain(parcours({ cur: 0 }).moduleCompte()), { mi: 0, titre: 'Introduction', cur: 0, etat: 'à commencer' });
  assert.equal(parcours({ cur: 0, commence: [0] }).moduleCompte().etat, 'en cours', 'la vidéo commencée : l’accueil dit « Reprendre ma leçon »');
  assert.equal(parcours({ faites: [2], cur: 13 }).moduleCompte().etat, 'en cours', 'une leçon du module validée');
  /* Le module de l’accueil, même si une leçon plus haut reste à faire (planning créé avant le 3 novembre) */
  assert.equal(parcours({ faites: [2, 13], cur: 51 }).moduleCompte().titre, 'Fonctions');
  assert.deepEqual(plain(parcours({ faites: [2, 13, 51, 52, 53], cur: null }).moduleCompte()), { mi: 0, titre: 'Introduction', cur: null, etat: 'hors planning', reste: 1 });
  assert.equal(parcours({ faites: [0, 2, 13, 51, 52, 53], cur: null }).moduleCompte(), null);
  const x = parcours({ cur: 0, commence: [0] });
  const b = x.acctModuleHTML(x.moduleCompte());
  assert.ok(b.startsWith('<button type="button" class="acct-chap" onclick="ouvrirChapitre(0)" data-etat="cours" aria-label="Module 1, Introduction, en cours. Ouvrir le module dans le parcours">'));
  assert.ok(b.includes('<small><span class="acct-chap-k">En cours</span> · Module 1</small><b>Introduction</b>'));
  assert.ok(parcours({ cur: 51 }).acctModuleHTML(parcours({ cur: 51 }).moduleCompte()).includes('data-etat="neuf"') && parcours({ cur: 51 }).acctModuleHTML(parcours({ cur: 51 }).moduleCompte()).includes('À commencer</span> · Module 3'));
  assert.ok(x.acctModuleHTML({ mi: 0, titre: 'Introduction', cur: null, etat: 'hors planning', reste: 11 }).includes('<small>Planning terminé · 11 leçons hors planning</small>'));
  assert.ok(x.acctModuleHTML(null).startsWith('<p class="acct-fini">') && x.acctModuleHTML(null).includes('<b>Parcours terminé</b>'));
  /* Dans la carte (direction C) : deux tuiles, chacune sa phrase lue par VoiceOver ; puis la barre et le module */
  assert.ok(compte.includes('const parc=parcoursCompte(),chap=moduleCompte();'));
  assert.ok(compte.includes('<div class="acct-tuile acct-t-niv"><span class="acct-sr">${esc(nivLu)}</span><span aria-hidden="true"><small>Ton niveau</small><span class="acct-t-l"><span class="acct-niv"><span class="lvl-k">Niv.</span>${level.rank}</span></span><b>${esc(level.label)}</b>'), 'la tuile du niveau');
  assert.ok(compte.includes('<div class="acct-tuile acct-t-parc"><span class="acct-sr">${esc(`Ton parcours : ${parcoursValidees(parc.faites)}, soit ${parc.pct} %.`)}</span><span aria-hidden="true"><small>Ton parcours</small><span class="acct-t-l"><b class="acct-t-n">${parc.pct}<i>\\u00a0%</i></b></span>'), 'la tuile du parcours');
  assert.ok(compte.includes('<div class="acct-level acct-level-c">\n        ${acctParcoursHTML(chap&&chap.cur)}\n        ${acctModuleHTML(chap)}'), 'la barre, puis le module');
  assert.ok(!compte.includes('acct-level-head') && !compte.includes('acct-level-leg'), 'les tuiles remplacent le titre et la légende');
  assert.ok(!compte.includes('Prochain chapitre') && !compte.includes('role="group" aria-label="${escAttr(`Ma progression'));
});

test('le nom du niveau s’accorde ; l’initiale reste entière', () => {
  const lv = g => {
    const c = vm.createContext(g ? { accord: (f, h, n) => (g === 'f' ? f : g === 'h' ? h : n) } : {});
    vm.runInContext(cut('const ACCOUNT_LEVELS=[', 'const ACCT_OK_SVG='), c);
    return [11, 26, 0].map(a => c.accountLevel(a, [11, 26, 36], 71).label);
  };
  assert.deepEqual(lv('f'), ['Constructrice de requêtes', 'Analyste relationnelle', 'Exploratrice SQL']);
  assert.deepEqual(lv('n'), ['Constructeur·rice de requêtes', 'Analyste relationnel·le', 'Explorateur·rice SQL']);
  assert.deepEqual(lv(null), ['Constructeur de requêtes', 'Analyste relationnel', 'Explorateur SQL'], 'sans accord (ailleurs) : le nom de base');
  const ini = compte.match(/const initial=(.*);   \/\/ sans prénom/)[1];
  const e = (name, pseudo) => vm.runInNewContext(ini, { name, psMien: () => pseudo });
  assert.deepEqual([e('🦊 Zoé', ''), e('élodie', ''), e('', '@elisa_sql'), e('', '')], ['🦊', 'É', 'E', 'R']);
  assert.ok(app.includes("ini=name?(Array.from(name)[0]||'R').toUpperCase():'R';"), 'l’onglet Compte aussi');
});

test('« Se déconnecter » : en bas, avec « Supprimer mon compte », dans leur bloc, sans chevron ; sans compte, il le dit', () => {
  const i = compte.indexOf('<div class="account-settings-list acct-compte-actions">');
  assert.ok(i > compte.indexOf('onclick="openPlusDetails(\'plus-contact\')"'), 'après « Contacte-nous »');
  const bloc = compte.slice(i, compte.indexOf('</div>', i));
  assert.ok(bloc.indexOf('onclick="seDeconnecter()"') > 0 && bloc.indexOf('onclick="seDeconnecter()"') < bloc.indexOf('onclick="compteSupprimer()"'));
  assert.ok(!bloc.includes('${CHEV}'), 'des actions, pas des pages');
  assert.ok(bloc.includes("${connected?'Ta progression reste sur ton compte':'Aucun compte connecté sur cet appareil'}"));
  assert.ok(lq.includes('html.lq #scr-compte .acct-compte-actions .account-setting-row{grid-template-columns:40px minmax(0,1fr)!important}'));
});

test('refaire l’onboarding depuis Mon compte : le planning reste, ou seules les leçons à faire bougent ; « Enregistrer » ramène à Mon compte', () => {
  const fo = app.slice(app.lastIndexOf('function finishOnboard('), app.indexOf('\n}\n', app.lastIndexOf('function finishOnboard(')) + 3);
  const fin = (plan, d) => {
    const appels = [];
    const ctx = vm.createContext({ obApercu: false, obRepriseOublier() {}, obCompter() {}, obCompteEnvoyer() {}, setTimeout() {}, state: { onboarded: true, plan, profile: {}, lessons: {} },
      draft: { niveau: 'bases', rythme: 'calme', freq: 7, ...d }, OB_GENRES: [], PAYS_CODES: [], inscriptionIso: () => '2026-10-20', save() {}, rappelNativeSync() {},
      psMien: () => '@elisa_sql', clsSalle: () => ({}), psPage() {}, obTerminer: a => appels.push(['fin', a]), itemDone: id => id === 0 || id === 2,
      RYTHMES: [{ k: 'calme', per: 2 }, { k: 'regulier', per: 3 }], auj: () => 'auj', datesMotif: (a, f, n) => Array.from({ length: n }, (_, i) => 'j' + i),
      apercuPlan: (n, r, f) => { appels.push(['apercu', n, r, f]); return { niveau: n, rythme: r, freq: f, sessions: [{ d: 'j0', lessons: [0, 2] }, { d: 'j1', lessons: [13, 4] }] }; },
      planAnchorDone: (p, done) => { appels.push(['ancrees', done]); return [{ d: 'hier', lessons: done }]; },
      distribuerSessions: (pool, dates) => { appels.push(['reste', pool, dates]); return [{ d: dates[0], lessons: pool }]; },
      planMergeSessions: (a, b) => a.concat(b) });
    vm.runInContext(fo, ctx);
    ctx.finishOnboard('compte');
    return { ctx, appels };
  };
  const ancien = { niveau: 'bases', rythme: 'calme', freq: 7, sessions: [{ d: '2026-11-01', lessons: [0, 2] }] };
  let x = fin(ancien, {});
  assert.equal(x.ctx.state.plan, ancien, 'rien de changé : le même planning');
  assert.deepEqual(plain(x.appels), [['fin', 'compte']]);
  x = fin(ancien, { rythme: 'regulier' });
  assert.deepEqual(plain(x.appels.slice(0, 3)), [['apercu', 'bases', 'regulier', 7], ['ancrees', [0, 2]], ['reste', [13, 4], ['j0']]]);
  assert.deepEqual(plain(x.ctx.state.plan.sessions), [{ d: 'hier', lessons: [0, 2] }, { d: 'j0', lessons: [13, 4] }], 'les validées à leur jour, le reste à partir d’aujourd’hui');
  x = fin(null, {});
  assert.deepEqual(plain(x.appels[0]), ['apercu', 'bases', 'calme', 7], 'le premier onboarding : le planning se crée');
  /* « Enregistrer » au bout, et le retour à Mon compte */
  assert.ok(app.includes("    else if(state.onboarded&&obEntry!=='welcome')obSetFooter('Enregistrer',()=>finishOnboard('compte'),'Voir mon parcours',()=>finishOnboard('plan-ready'),'');"));
  const t = cut('function obTerminer(action){', '\nfunction celebrate(){');
  assert.ok(t.includes("}else if(action==='compte'){\n    switchTab('compte');"));
  assert.ok(t.includes("const firstId=state.plan.sessions.map(x=>x.lessons.find(id=>!isDefiId(id)&&!(typeof itemDone==='function'&&itemDone(id)))).find(id=>id!=null);"), 'la leçon à faire, pas une leçon déjà validée');
});

test('le compte connecté garde son nom à chaque enregistrement', () => {
  const ctx = vm.createContext({ psForme: s => s });
  vm.runInContext(cut('function normalizeState(raw){', '/* Un nombre écrit en texte'), ctx);
  const s = ctx.normalizeState({ accountMode: 'connected', accountProvider: 'apple', accountLabel: 'elisa@exemple.fr' });
  assert.deepEqual([s.accountMode, s.accountProvider, s.accountLabel], ['connected', 'apple', 'elisa@exemple.fr']);
  const g = ctx.normalizeState({ accountMode: 'guest' });
  assert.ok(!('accountProvider' in g) && !('accountLabel' in g), 'sans compte : rien de plus');
});

test('le style : contraste, barre, module, bloc du compte, « Texte plus grand »', () => {
  for (const k of ['html.lq .acct-hero{background:linear-gradient(165deg,#6B4CF3 0%,#5236E2 52%,#4528CA 100%)!important}', 'html.lq .acct-hero .acct-id-copy .acct-id-pseudo{color:rgba(255,255,255,.92)}',
    'html.lq .acct-hero .acct-rang{color:#C2F7DA}', 'html.lq .acct-parc-z>i{position:absolute;top:0;bottom:0;display:block;background:var(--sun)}',
    'html.lq .acct-hero .acct-chap[data-etat="neuf"] .acct-chap-k{color:#fff}', 'html.lq #scr-compte .acct-compte-actions{margin-top:12px}',
    'html.lq[data-reading="large"] .acct-hero .acct-chap-t small,html.lq[data-reading="large"] .acct-level-leg{font-size:15px}'])
    assert.ok(lq.includes(k), k);
});

test('direction C, puis 12 h 28 (« tout le monde commence au même endroit ») : ni hachures, ni leçons « acquises au départ »', () => {
  const x = parcours({ faites: [13], cur: 0 });
  const h = x.acctParcoursHTML(0);
  assert.ok(h.includes('<i style="left:33.33%;width:16.67%"></i>'), 'la 13, validée : en jaune');
  assert.ok(!h.includes('is-a'), 'les leçons d’avant ne sont plus hachurées');
  assert.equal(x.acctParcoursHTML(0, 3), h, 'plus de « point de départ » qui change la barre');
  assert.ok(!app.includes('function departCompte(') && !compte.includes('acqN') && !compte.includes('acct-sw is-a'), 'plus de leçons acquises au départ dans la carte');
  assert.ok(compte.includes("const nivDit=level.rank>=5?'Le plus haut niveau':'Il monte avec tes leçons validées';") && compte.includes('<b>${esc(level.label)}</b><em>${nivDit}</em>'), 'la tuile du niveau dit qu’il monte avec les leçons validées');
  assert.ok(compte.includes('const nivLu=`Ton niveau : niveau ${level.rank}, ${level.label}. ${nivDit}.`;'), 'VoiceOver lit la même chose');
  /* Le niveau quitte le rond et le dessous du prénom : il est dans sa tuile */
  assert.ok(compte.includes('<span class="acct-pic" aria-hidden="true"><span class="acct-avatar">${esc(initial)}<i>${ACCT_PEN_SVG}</i>${paysDuProfil()?`<b class="acct-drapeau">${paysDrapeau(paysDuProfil())}</b>`:\'\'}</span></span>'));
  assert.ok(!compte.includes('<span class="acct-rang"'), 'plus le nom du niveau sous le prénom');
  assert.ok(!lq.includes('.acct-parc-z>i.is-a') && !lq.includes('.acct-sw.is-a'), 'plus de style de hachures');
  for (const r of ['html.lq .acct-duo{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}', 'html.lq .acct-sw.is-v{background:var(--sun)}',
    'html.lq[data-reading="large"] .acct-tuile b:not(.acct-t-n){font-size:17px}', '@media (max-width:400px){html.lq[data-reading="large"] .acct-duo{grid-template-columns:1fr}}'])
    assert.ok(lq.includes(r), r);
});
