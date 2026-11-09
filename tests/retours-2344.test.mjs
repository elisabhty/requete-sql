/* Elisa, 8 novembre, 23 h 44 : « corrige : À corriger en premier », la liste de la relecture des défis faite dans le simulateur
   (iPhone 17 Pro) :
   1. la salle fantôme : quitter la salle d’attente ne demandait rien, la salle restait ouverte et l’écran Défis n’en disait rien ;
   2. le chrono disparaissait : la barre manche / points / chrono défilait avec la page ;
   3. seul, l’indice arrivait « pour tout le monde » ;
   4. la fenêtre solo disait « à ton rythme », alors qu’il y a un chrono et des points qui baissent ;
   5. « liens » au lieu de « relations » dans le schéma (sa règle de rédaction).
   Vérifié dans un navigateur (390 × 844) : la question en quittant sa salle, « Ta salle » dans Jouer et « Revenir », la mini-barre
   qui arrive quand le cadre de la manche sort de l’écran. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const fn = (name, next = '\n}\n') => { const i = app.indexOf(`function ${name}(`); assert.ok(i > 0, name); const j = app.indexOf(next, i); assert.ok(j > i, next); return app.slice(i, j + 2); };
const entre = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };

/* ---------- 1. La salle quittée ---------- */

function bacQuitter(J, o = {}) {
  const ctx = vm.createContext({ JEU: J, jeuIsHost: () => o.host !== false, jeuLive: () => new Array(o.live || 1).fill('p'), jeuCommencee: () => !!o.commencee });
  vm.runInContext(fn('jeuLeaveQuestion'), ctx);
  return () => vm.runInContext('jeuLeaveQuestion()', ctx);
}

test('l’hôte seul qui quitte sa salle d’attente : une question, « Quitter » ou « Rester »', () => {
  const q = bacQuitter({ view: 'lobby', synced: true, solo: false })();
  assert.equal(q.titre, 'Quitter ta salle ?');
  assert.equal(q.texte, 'Personne ne l’a encore rejointe. Tu pourras y revenir depuis Défis.');
  assert.equal(q.oui, 'Quitter'); assert.equal(q.non, 'Rester'); assert.ok(!q.danger, 'rien de perdu : pas de bouton rouge');
  /* Ce qui existait reste : avec d’autres, un autre devient l’hôte ; en pleine manche, la manche est perdue */
  assert.equal(bacQuitter({ view: 'lobby', synced: true, solo: false }, { live: 2 })().texte, 'Un autre joueur deviendra l’hôte.');
  assert.equal(bacQuitter({ view: 'play0', synced: true, solo: false })().texte, 'Ta manche en cours sera perdue.');
  /* Pas de question : seul en mode solo, simple invité, salle pas encore jointe, ou déjà confirmé */
  assert.equal(bacQuitter({ view: 'lobby', synced: true, solo: true })(), null);
  assert.equal(bacQuitter({ view: 'lobby', synced: true, solo: false }, { host: false })(), null);
  assert.equal(bacQuitter({ view: 'lobby', synced: false, solo: false })(), null);
  assert.equal(bacQuitter({ view: 'lobby', synced: true, solo: false, leaveOk: true })(), null);
  assert.equal(bacQuitter({ view: 'final', synced: true, solo: false })(), null);
});

function bacSalle(o = {}) {
  const store = new Map(Object.entries(o.store || {}));
  let now = o.now || 1_800_000_000_000;
  const appels = [];
  const ctx = vm.createContext({
    JEU: o.JEU || null, Date: { now: () => now }, JSON, Math,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    jeuIsHost: () => o.host !== false, jeuCommencee: () => !!o.commencee, jeuLive: () => new Array(o.live || 1).fill('p'),
    jeuSavedNom: () => '@elisa_sql', paysMontre: () => true, paysDuProfil: () => 'FR', perfColor: () => 3, jeuInitial: n => n.replace(/^@+/, '').charAt(0).toUpperCase(),
    jeuFlag: (n, p) => `<i class="flag">${p}</i>`, dxPcNiv: k => `<span class="dx-pc is-niv is-${k}">${k}</span>`,
    escAttr: s => String(s).replace(/"/g, '&quot;'), JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' }, LQ_X_SVG: '<svg class="x"></svg>',
    CHALLENGES: [1], SQL: {}, jeuNiv: 'f', jeuNb: 1,
    buzz() {}, sallesRepeindre: () => appels.push(['repeindre']), document: { getElementById: () => null },
    jeuPseudoPuis: f => f(), jeuStart: (...a) => { appels.push(['start', ...a]); ctx.JEU = { code: a[0] }; },
  });
  vm.runInContext(entre("const JEU_MA_SALLE='rq-ma-salle'", '/* « Rejoins une partie », dans le cadre'), ctx);
  return { ctx, store, appels, ev: s => vm.runInContext(s, ctx), avance: ms => { now += ms; } };
}

test('« Ta salle » : notée au départ de l’hôte seul, avant le lancement ; rien à garder sinon', () => {
  const salle = { code: 'U9SAHM', niv: 'm', nb: 2, pub: true, solo: false, synced: true };
  const b = bacSalle({ JEU: salle });
  b.ev('jeuMaSalleNoter()');
  assert.deepEqual(JSON.parse(b.store.get('rq-ma-salle')), { code: 'U9SAHM', niv: 'm', nb: 2, pub: true, at: 1_800_000_000_000 });
  for (const [nom, o] of [['avec d’autres joueurs', { live: 2 }], ['partie lancée', { commencee: true }], ['simple invité', { host: false }],
    ['partie seul', { JEU: { ...salle, solo: true } }], ['salle pas encore jointe', { JEU: { ...salle, synced: false } }], ['salle complète', { JEU: { ...salle, full: true } }]]) {
    const x = bacSalle({ JEU: salle, ...o });
    x.ev('jeuMaSalleNoter()');
    assert.ok(!x.store.has('rq-ma-salle'), nom);
  }
  assert.ok(fn('leaveLessonScreen').includes("if(mode==='jeu'){if(typeof jeuMaSalleNoter==='function')jeuMaSalleNoter();jeuStop();}"), 'notée juste avant de quitter (jeuStop)');
  assert.ok(fn('jeuEcran').includes("if(!J.solo&&typeof jeuMaSalleOublier==='function')jeuMaSalleOublier();"), 'oubliée en entrant dans une salle à plusieurs');
});

test('« Ta salle » : sa ligne, « Revenir », la croix ; deux heures au plus', () => {
  const rec = JSON.stringify({ code: 'U9SAHM', niv: 'd', nb: 3, pub: false, at: 1_800_000_000_000 });
  const b = bacSalle({ store: { 'rq-ma-salle': rec } });
  const h = b.ev('jeuMaSalleHTML()');
  assert.ok(h.startsWith('<ul class="dx-list is-mienne" aria-label="Ta salle"><li class="is-me">'), 'sa ligne, en violet clair comme sa ligne du classement');
  assert.ok(h.includes('<span class="dx-nom">Ta salle</span>') && h.includes('<span class="dx-pc is-niv is-d">d</span><span class="dx-pc-t">3 manches</span>'));
  assert.ok(!h.includes('jeu-av'), 'pas d’avatar : c’est la sienne, et tout tient sur la ligne');
  assert.ok(h.includes('onclick="jeuMaSalleRevenir()" aria-label="Revenir dans ta salle U 9 S A H M : Difficile, 3 manches">Revenir</button>'));
  assert.ok(h.includes('<button type="button" class="dx-ma-x" onclick="jeuMaSalleFermer()" aria-label="Fermer ta salle U 9 S A H M"><svg class="x"></svg></button>'));
  /* Revenir : comme après un rechargement, en hôte, même code, mêmes réglages ; publique ou non, comme avant */
  b.ev('jeuMaSalleRevenir()');
  const [, code, host, cid, opts] = b.appels.find(a => a[0] === 'start');
  assert.equal(code, 'U9SAHM'); assert.equal(host, false); assert.equal(cid, null); assert.deepEqual(JSON.parse(JSON.stringify(opts)), { nomId: 'jeu-nom', reprise: { host: true } });
  assert.equal(b.ev('jeuNiv'), 'd'); assert.equal(b.ev('jeuNb'), 3); assert.equal(b.ev('JEU.pub'), false);
  assert.equal(b.ev('jeuMaSalleHTML()'), '', 'pas de ligne pendant qu’on y est');
  /* La croix : oubliée, la liste redessinée */
  const c = bacSalle({ store: { 'rq-ma-salle': rec } });
  c.ev('jeuMaSalleFermer()');
  assert.ok(!c.store.has('rq-ma-salle') && c.appels.some(a => a[0] === 'repeindre'));
  /* Deux heures plus tard, elle s’efface d’elle-même ; un enregistrement abîmé aussi */
  const d = bacSalle({ store: { 'rq-ma-salle': rec } });
  d.avance(2 * 3600 * 1000 - 1); assert.ok(d.ev('jeuMaSalleHTML()'));
  d.avance(2); assert.equal(d.ev('jeuMaSalleHTML()'), ''); assert.ok(!d.store.has('rq-ma-salle'));
  const e = bacSalle({ store: { 'rq-ma-salle': '{"code":"abc","niv":"f","at":1800000000000}' } });
  assert.equal(e.ev('jeuMaSalle()'), null); assert.ok(!e.store.has('rq-ma-salle'));
});

test('« Rejoins une partie » : « Ta salle » en tête, à la place de « Crée la tienne » et de « Aucune salle disponible »', () => {
  const peindre = ma => {
    const ctx = vm.createContext({ DEFIS: { salles: [], sallesErr: '' }, jeuNiv: 'f', jeuMaSalleHTML: () => ma, DEF_CHEV_SVG: '>' });
    vm.runInContext(fn('sallesSectionHTML'), ctx);
    return vm.runInContext('sallesSectionHTML()', ctx);
  };
  const avec = peindre('<ul class="dx-list is-mienne"></ul>'), sans = peindre('');
  assert.ok(avec.includes('Rejoins une partie</h3></div><ul class="dx-list is-mienne"></ul>'));
  assert.ok(!avec.includes('Aucune salle disponible') && !avec.includes('Crée la tienne'));
  assert.ok(sans.includes('<span class="dx-live is-off">Aucune salle disponible</span>') && sans.includes('Aucune salle à ton niveau&nbsp;? Crée la tienne'), 'sinon, comme avant (sa phrase, 8 novembre, 0 h 17)');
  /* Une ligne de la liste, pas une notification (règle de l’app) : en violet clair, la croix haute de 44 px */
  assert.ok(lq.includes('html.lq #scr-defis .dx-ma-x{flex:none;display:grid;place-items:center;width:38px;height:44px;'));
  assert.ok(lq.includes('html.lq #scr-defis .dx-list.is-mienne>li{gap:8px;margin:0;padding:10px 2px 10px 14px}'), '« 1 manche » tient en entier à 390 px');
  assert.ok(lq.includes('html.lq #scr-defis .dx-list.is-mienne{margin-top:8px;padding:0;background:none}'), 'sa rangée seule, sans le fond des listes');
});

/* ---------- 2. La mini-barre du chrono ---------- */

test('la mini-barre : une ancre sans hauteur, collée sous l’en-tête, muette pour le lecteur d’écran', () => {
  const ctx = vm.createContext({ JEU_COIN_SVG: '<svg class="coin"></svg>' });
  vm.runInContext(fn('jeuColleeHTML'), ctx);
  const h = vm.runInContext("jeuColleeHTML('Manche 2','/3',true)", ctx);
  assert.equal(h, '<div class="jeu-collee-ancre" aria-hidden="true"><div class="jeu-collee" id="jeu-collee"><b class="jeu-collee-m">Manche 2<small>/3</small></b>'
    + '<span class="jeu-collee-box"><b class="jeu-val jeu-collee-v"><svg class="coin"></svg><span id="jeu-collee-v"></span><small>pts</small></b><b class="jeu-timer jeu-collee-t" id="jeu-collee-t"></b></span></div></div>');
  assert.ok(!vm.runInContext("jeuColleeHTML('Défi',' · Facile',false)", ctx).includes('jeu-val'), 'la page d’un défi : le chrono seul');
  /* Pendant une manche (salle ou seul) et sur la page d’un défi */
  assert.ok(app.includes("html=`${jeuColleeHTML(`Manche ${n+1}`,`/${J.nb}`,!mine&&!rate)}${jeuNetSlot()}"), 'ce que vaut le défi tant qu’on cherche (ni trouvée, ni finie au chrono)');
  assert.ok(app.includes("jeuColleeSuivre(v.startsWith('play')&&typeof root.querySelector==='function'?root.querySelector('.jeu-hud'):null,'jeu-timer','jeu-val-n');"));
  assert.ok(app.includes("document.getElementById('lesson-body').innerHTML=`${jeuColleeHTML('Défi',` · ${NIV[c.niv].l}`,false)}\n    <div class=\"defi-top\">"));
  assert.ok(app.includes("  jeuColleeSuivre(document.querySelector('#lesson-body .defi-top'),'defi-timer',null);"));
  assert.ok(fn('leaveLessonScreen').includes("if(typeof jeuColleeSuivre==='function')jeuColleeSuivre(null);"), 'elle s’en va avec la page');
  /* La cascade de l’arrivée de la manche ne compte pas l’ancre */
  assert.ok(app.includes("Array.from(root.children).filter(el=>!(el.classList&&el.classList.contains('jeu-collee-ancre'))).forEach((el,i)=>"));
  for (const r of ['html.lq .jeu-collee-ancre{position:sticky;top:var(--jeu-collee-top,0px);z-index:19;height:0;',
    'html.lq #scr-lesson:has(.navbar.nav-away) .jeu-collee-ancre{transform:translateY(calc(var(--safe-top,0px) - var(--jeu-collee-top,0px)))}',
    'html.lq .jeu-collee.is-on{opacity:1;transform:none}', 'html.lq .jeu-collee.is-masque{display:none}', 'html.lq .jeu.jeu-cascade>.jeu-collee-ancre{animation:none!important}',
    'html[data-motion="reduce"].lq .jeu-collee,html[data-motion="reduce"].lq .jeu-collee-ancre{transition:none!important}'])
    assert.ok(lq.includes(r), r);
  assert.ok(/html\.lq \.jeu-collee\{[^}]*pointer-events:none/.test(lq), 'elle laisse passer les touchers');
});

test('la mini-barre recopie le cadre (chrono, points, rouge à 30 s) et arrive quand il sort de l’écran', () => {
  const classe = () => { const s = new Set(); return { s, toggle: (k, on) => (on ? s.add(k) : s.delete(k)), contains: k => s.has(k), add: k => s.add(k) }; };
  const el = (extra = {}) => ({ textContent: '', hidden: false, classList: classe(), parentNode: null, ...extra });
  const mini = el(), mt = el(), mv = el(), boite = el(), timer = el({ textContent: '09:56' }), val = el({ textContent: '200' });
  mv.parentNode = boite;
  const src = { id: 'hud' }, styles = {}, nav = { offsetHeight: 92 };
  const scr = { style: { setProperty: (k, v) => { styles[k] = v; } }, querySelector: s => (s === '.navbar' ? nav : null) };
  const els = { 'scr-lesson': scr, 'jeu-collee': mini, 'jeu-collee-t': mt, 'jeu-collee-v': mv, 'jeu-timer': timer, 'jeu-val-n': val };
  let mo = null, io = null, ioOpts = null, coupes = 0;
  const ctx = vm.createContext({
    document: { getElementById: id => els[id] || null },
    MutationObserver: class { constructor(f) { mo = f; } observe(t, o) { assert.equal(t, src); assert.ok(o.subtree && o.characterData && o.attributeFilter.includes('hidden')); } disconnect() { coupes++; } },
    IntersectionObserver: class { constructor(f, o) { io = f; ioOpts = o; } observe(t) { assert.equal(t, src); } disconnect() { coupes++; } },
  });
  vm.runInContext('let jeuColleeObs=null;\n' + fn('jeuColleeSuivre'), ctx);
  vm.runInContext("jeuColleeSuivre(src,'jeu-timer','jeu-val-n')", Object.assign(ctx, { src }));
  assert.equal(styles['--jeu-collee-top'], '92px', 'sous l’en-tête');
  assert.equal(ioOpts.root, scr); assert.equal(ioOpts.rootMargin, '-92px 0px 0px 0px');
  assert.equal(mt.textContent, '09:56'); assert.equal(mv.textContent, '200'); assert.equal(boite.hidden, false);
  /* Les secondes passent, un palier tombe, les 30 dernières secondes */
  timer.textContent = '00:29'; timer.classList.add('is-low'); val.textContent = '150'; mo();
  assert.equal(mt.textContent, '00:29'); assert.ok(mt.classList.contains('is-low')); assert.equal(mv.textContent, '150');
  /* Trouvé : la valeur quitte le cadre, et la barre ; le chrono masqué (« Avec des amis ») : plus de barre */
  delete els['jeu-val-n']; mo(); assert.equal(boite.hidden, true);
  timer.hidden = true; mo(); assert.ok(mini.classList.contains('is-masque'));
  /* Le cadre sort de l’écran : la barre arrive ; il revient : elle s’en va ; un cadre pas encore dessiné ne compte pas */
  io([{ isIntersecting: false, boundingClientRect: { height: 120 } }]); assert.ok(mini.classList.contains('is-on'));
  io([{ isIntersecting: true, boundingClientRect: { height: 120 } }]); assert.ok(!mini.classList.contains('is-on'));
  io([{ isIntersecting: false, boundingClientRect: { height: 0 } }]); assert.ok(!mini.classList.contains('is-on'));
  /* Une autre vue : on débranche */
  vm.runInContext('jeuColleeSuivre(null)', ctx);
  assert.equal(coupes, 2);
});

/* ---------- 3, 4, 5. Les textes ---------- */

test('seul : « Premier indice dans 01:28 », sans « pour tout le monde » ; à plusieurs, comme avant', () => {
  const carte = (seul, n) => {
    const ctx = vm.createContext({ JEU: { solo: seul }, COACH: { round: 0 }, jeuSoloLike: () => seul, jeuCur: () => 0, jeuChrono: ms => `0${Math.floor(ms / 60000)}:28`,
      defiIndices: () => [['Où chercher', 'a'], ['La piste', 'b'], ['La forme', 'c']], escCode: s => s });
    vm.runInContext(fn('defiIndicesHTML'), ctx);
    return vm.runInContext(`defiIndicesHTML({id:'x'},${n},0,'',88000,'room')`, ctx);
  };
  assert.ok(carte(true, 0).includes('Premier indice dans <b id="coach-cd">01:28</b>') && !carte(true, 0).includes('pour tout le monde'));
  assert.ok(carte(true, 1).includes('Indice suivant dans <b id="coach-cd">'));
  assert.ok(carte(false, 0).includes('Premier indice pour tout le monde dans <b id="coach-cd">01:28</b>'));
});

test('la fenêtre « Joue seul » : « contre la montre », plus « à ton rythme »', () => {
  assert.ok(app.includes(":['Mode solo',`Joue ${typeof accord==='function'?accord('seule','seul','seul·e'):'seul·e'}`,'Relève des défis contre la montre.'];"), 'le titre s’accorde depuis le 9 novembre (retours-0031)');
  assert.ok(!app.includes('Relève des défis à ton rythme.'));
});

test('le schéma : « relations » plutôt que « liens » entre tables', () => {
  /* 9 novembre, 0 h 31 : la carte « Tables, colonnes et relations de la base » est retirée (retours-0031) */
  for (const neuf of ["${plur(umlNbLiens(m),'relation')}",
    '<b>Les relations en clair</b>', '${UML_SVG}Les relations en clair</button>', 'Touche une table&nbsp;: ses relations s’allument.', ': allumer ses relations`)',
    'Aucune relation&nbsp;: elle ne désigne aucune table, et aucune ne la désigne.', 'le schéma UML se dessinera tout seul, avec ses relations.',
    'Aucune relation pour l’instant&nbsp;: une colonne comme', "`${liens.length} relations trouvées`:'Relation trouvée'"])
    assert.ok(app.includes(neuf), neuf);
  for (const vieux of ['Tables, colonnes et liens de la base', "plur(umlNbLiens(m),'lien')", '<b>Les liens en clair</b>', 'Les liens en clair</button>', 'Touche une table&nbsp;: ses liens s’allument',
    'allumer ses liens', 'Aucun lien&nbsp;: elle ne désigne', 'avec ses liens.</p>', 'Aucun lien pour l’instant', "'Lien trouvé'"])
    assert.ok(!app.includes(vieux), vieux);
});
