/* 5 novembre, 21 h 41 (Elisa, capture du planning : des séances vendredi 6, lundi 9 et mercredi 11, rien aujourd’hui ni le week-end) :
   « pour les notifications mettre à jour automatiquement avec le planning (récupérer les infos de quel jour il y a des cours ou pas
   pour y mettre les notifs à l’heure définie par l’user et donc l’onboarding normalement) ».
   - Les rappels tombent les jours où le planning prévoit une séance pas encore faite, à l’heure choisie (onboarding ou Mon compte).
   - Ils suivent le planning tout seuls : après chaque enregistrement, à l’ouverture de l’appli et quand on y revient.
   - Une séance faite fait taire son rappel ; un planning fini n’en a plus ; en retard sans rien de prévu, le rythme reprend.
   - L’autorisation d’iOS n’est demandée que sur un geste (l’onboarding, « Enregistrer mes préférences »), jamais en pleine leçon. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html');
const sw = read('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const PATTERN = vm.runInNewContext('(' + cut('const PATTERN=', 'const JOURS=').replace('const PATTERN=', '').trim().replace(/;$/, '') + ')');
const rappel = cut('/* Les jours du rappel (Elisa, 4 novembre, 11 h 08, réf. 2)', '/* Le rappel dans Mon compte (Elisa, 5 novembre, 12 h 12');
const pur = v => JSON.parse(JSON.stringify(v));
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const J = n => { const t = new Date(); return iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() + n)); };
const LE_5 = new Date(2026, 10, 5, 6, 0).getTime();   // jeudi 5 novembre, 6 h
/* Le planning de la capture : vendredi 6, lundi 9, mercredi 11 ; une séance passée déjà faite */
const CAPTURE = () => [{ d: '2026-11-03', lessons: [1, 2] }, { d: '2026-11-06', lessons: [3, 4] }, { d: '2026-11-09', lessons: [5, 6] }, { d: '2026-11-11', lessons: [7, 'defi-x'] }];

const bac = ({ sessions, freq = 3, faits = [], on = true, heure = '19:00', ob = false, draft = {}, onboarded = true, natif = true, perm = 'granted' } = {}) => {
  const fait = new Set(faits), appels = [], timers = new Map();
  let n = 0;
  const LN = {
    cancel: async o => { appels.push(['annule', o.notifications.length]); },
    checkPermissions: async () => { appels.push(['lit']); return { display: perm }; },
    requestPermissions: async () => { appels.push(['demande']); return { display: perm }; },
    schedule: async o => { appels.push(['programme', pur(o.notifications)]); },
  };
  const obEl = { classList: { contains: c => c === 'on' && x.ob } };
  const ctx = vm.createContext({
    PATTERN, state: { onboarded, plan: sessions === undefined ? { freq } : { freq, sessions } }, draft,
    document: { getElementById: id => (id === 'onboarding' ? obEl : null) },
    rappelOn: () => on, rappelHeure: () => heure, itemDone: id => fait.has(id),
    window: { Capacitor: natif ? { isNativePlatform: () => true, Plugins: { LocalNotifications: LN } } : undefined },
    setTimeout: (f, ms) => { timers.set(++n, { f, ms }); return n; }, clearTimeout: id => { timers.delete(id); },
  });
  vm.runInContext(rappel.replace('const JOURS_NOMS=', 'var JOURS_NOMS='), ctx);
  const x = {
    ctx, appels, timers, fait, ob,
    run: s => vm.runInContext(s, ctx),
    attendre: async () => { for (let i = 0; i < 4; i++) await new Promise(r => setImmediate(r)); },
    minuteur: () => { const t = [...timers.values()]; timers.clear(); t.forEach(v => v.f()); return t.map(v => v.ms); },
  };
  return x;
};
const jours = (x, t = LE_5, max = 56) => pur(x.run(`rappelJoursPrevus(new Date(${t}),${max})`));
const quand = (x, t = LE_5, max = 56, h = '') => pur(x.run(`rappelSeances(new Date(${t}),${max}${h ? `,'${h}'` : ''})`).map(d => [d.getDate(), d.getHours(), d.getMinutes()]));

test('le rappel tombe les jours où le planning prévoit une séance, à l’heure choisie (la capture : vendredi, lundi, mercredi)', () => {
  const x = bac({ sessions: CAPTURE(), faits: [1, 2] });
  assert.deepEqual(jours(x), ['2026-11-06', '2026-11-09', '2026-11-11'], 'rien aujourd’hui, rien le week-end, rien le mardi');
  assert.deepEqual(quand(x), [[6, 19, 0], [9, 19, 0], [11, 19, 0]], 'à 19 h, l’heure choisie');
  assert.deepEqual(quand(x, LE_5, 1, '08:30'), [[6, 8, 30]], 'l’heure de la feuille, pas encore enregistrée');
  assert.deepEqual(quand(x, LE_5, 2), [[6, 19, 0], [9, 19, 0]], 'au plus max');
  /* Un planning qui ne suit pas le rythme (« 3 jours par semaine » : lundi, mercredi, vendredi) : c’est le planning qui compte */
  const y = bac({ sessions: [{ d: '2026-11-07', lessons: [1] }, { d: '2026-11-08', lessons: [2] }], freq: 3 });
  assert.deepEqual(jours(y), ['2026-11-07', '2026-11-08'], 'un samedi et un dimanche, parce que le planning les prévoit');
  /* Deux séances le même jour (après un rattrapage) : un seul rappel */
  const z = bac({ sessions: [{ d: '2026-11-06', lessons: [1] }, { d: '2026-11-06', lessons: [2] }] });
  assert.deepEqual(jours(z), ['2026-11-06']);
});

test('il suit le planning : séance déplacée, faite (en entier ou en partie), du jour avant ou après l’heure', () => {
  const s = CAPTURE(), x = bac({ sessions: s, faits: [1, 2] });
  const le6 = h => new Date(2026, 10, 6, h, 0).getTime();
  assert.deepEqual(quand(x, le6(18))[0], [6, 19, 0], 'le jour même, avant l’heure : ce soir');
  assert.deepEqual(quand(x, le6(20))[0], [9, 19, 0], 'après l’heure : la prochaine séance');
  /* 22 h 04 : commencée (un cours sur deux), elle n’a plus de rappel (retours-2204) */
  x.fait.add(3);
  assert.deepEqual(quand(x, le6(18))[0], [9, 19, 0], 'commencée : son rappel se tait');
  x.fait.add(4);
  assert.deepEqual(quand(x, le6(18))[0], [9, 19, 0], 'faite : son rappel se tait');
  s[2].d = '2026-11-10';
  assert.deepEqual(jours(x, le6(18)), ['2026-11-10', '2026-11-11'], 'la séance de lundi passée à mardi : son rappel aussi');
  s.push({ d: '2026-11-07', lessons: [8] });
  assert.deepEqual(jours(x, le6(18)), ['2026-11-07', '2026-11-10', '2026-11-11'], 'une séance ajoutée samedi : un rappel samedi');
});

test('sans planning, en retard sans rien de prévu, planning fini, onboarding : ce qui tombe', () => {
  /* Sans séances (un plan d’avant) : les jours du rythme */
  assert.deepEqual(jours(bac({ freq: 3 })).slice(0, 4), ['2026-11-06', '2026-11-09', '2026-11-11', '2026-11-13']);
  assert.ok(jours(bac({ freq: 3 })).every(j => [1, 3, 5].includes(new Date(j + 'T12:00').getDay())), 'lundi, mercredi, vendredi');
  /* Tout est fait : plus de rappel */
  assert.deepEqual(jours(bac({ sessions: CAPTURE(), faits: [1, 2, 3, 4, 5, 6, 7, 'defi-x'] })), []);
  /* En retard, rien de prévu ensuite : le rythme reprend, pour ne pas laisser tomber */
  const r = jours(bac({ sessions: [{ d: '2026-11-02', lessons: [1] }, { d: '2026-11-04', lessons: [2] }], freq: 5 }), LE_5, 6);
  assert.deepEqual(r, ['2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'], 'en semaine');
  /* En retard mais des séances prévues : celles-ci */
  assert.deepEqual(jours(bac({ sessions: [{ d: '2026-11-02', lessons: [1] }, { d: '2026-11-09', lessons: [2] }] })), ['2026-11-09']);
  /* L’onboarding ouvert : les jours choisis tant que le planning n’est pas celui de ces choix ; sa fin crée le planning, puis
     programme le rappel avant de se fermer */
  const o = bac({ sessions: CAPTURE(), freq: 7, ob: true, draft: { freq: 5 } });
  assert.deepEqual(jours(o, LE_5, 3), ['2026-11-05', '2026-11-06', '2026-11-09'], 'les jours de l’étape des jours (en semaine)');
  o.ctx.state.plan.freq = 5;
  assert.deepEqual(jours(o, LE_5, 3), ['2026-11-06', '2026-11-09', '2026-11-11'], 'le planning créé : ses séances');
  const i = app.lastIndexOf('function finishOnboard(action){'), fin = app.slice(i, app.indexOf("root.classList.remove('on',", i));
  assert.ok(fin.indexOf('state.plan=apercuPlan(draft.niveau,draft.rythme,draft.freq);') < fin.indexOf('  try{rappelNativeSync();}catch(e){}   // le rappel suit les jours du parcours créé (11 h 08)'));
});

test('sur l’iPhone : les séances du planning, chacune avec son message ; l’autorisation lue, demandée seulement sur un geste', async () => {
  const s = [{ d: J(-2), lessons: [1] }, { d: J(1), lessons: [2] }, { d: J(2), lessons: [3] }, { d: J(3), lessons: [4] }, { d: J(5), lessons: [5, 6] }];
  const x = bac({ sessions: s, faits: [3] });
  x.run('rappelNativeSync()'); await x.attendre();
  assert.deepEqual(x.appels.map(a => a[0]), ['annule', 'lit', 'programme'], 'l’autorisation seulement lue');
  assert.equal(x.appels[0][1], 72, 'les anciens rappels et ceux déjà posés, d’abord');
  const t = x.appels[2][1];
  assert.deepEqual(t.map(n => iso(new Date(n.schedule.at))), [J(1), J(3), J(5)], 'ni la séance en retard, ni celle déjà faite');
  assert.deepEqual(t.map(n => n.id), [100, 101, 102]);
  for (const n of t) {
    const d = new Date(n.schedule.at);
    assert.deepEqual([d.getHours(), d.getMinutes()], [19, 0]);
    assert.deepEqual([n.title, n.body], pur(x.run(`rappelMessage(new Date(${d.getTime()}))`)), 'le message de son jour');
  }
  /* « Enregistrer mes préférences » : la vraie demande */
  const y = bac({ sessions: s });
  y.run('rappelNativeSync(true)'); await y.attendre();
  assert.deepEqual(y.appels.map(a => a[0]), ['annule', 'demande', 'programme']);
  assert.ok(app.includes("  rappelNativeSync(true);\n  RP=null;"), 'rappelEnregistrer');
  assert.ok(app.includes("  if(ok){rappelNativeSync();buzz('success');}"), 'l’onboarding vient d’avoir la réponse');
  /* Refusée dans les réglages d’iOS : tout est annulé, rien de programmé */
  const z = bac({ sessions: s, perm: 'denied' });
  z.run('rappelNativeSync()'); await z.attendre();
  assert.deepEqual(z.appels.map(a => a[0]), ['annule', 'lit']);
  /* Coupé : tout est annulé */
  const c = bac({ sessions: s, on: false });
  c.run('rappelNativeSync()'); await c.attendre();
  assert.deepEqual(c.appels.map(a => a[0]), ['annule']);
  /* Deux reprogrammations de suite : l’une après l’autre, jamais l’annulation de la seconde au milieu de la première */
  const d = bac({ sessions: s });
  d.run('rappelNativeSync();rappelNativeSync()'); await d.attendre();
  assert.deepEqual(d.appels.map(a => a[0]), ['annule', 'lit', 'programme', 'annule', 'lit', 'programme']);
});

test('automatique : reprogrammé quand ce qui est prévu change, et seulement alors', async () => {
  const s = [{ d: J(1), lessons: [1] }, { d: J(3), lessons: [2] }];
  const x = bac({ sessions: s });
  x.run('rappelAuto()');
  assert.deepEqual(x.minuteur(), [800], 'un peu après l’enregistrement');
  await x.attendre();
  assert.equal(x.appels.filter(a => a[0] === 'programme').length, 1, 'la première fois (à l’ouverture) : programmé');
  assert.equal(x.appels.at(-1)[1].length, 2);
  x.appels.length = 0;
  x.run('rappelAuto()'); x.minuteur(); await x.attendre();
  assert.deepEqual(x.appels, [], 'rien n’a changé : rien ne bouge');
  x.fait.add(1);
  x.run('rappelAuto()'); x.minuteur(); await x.attendre();
  assert.deepEqual(x.appels.map(a => a[0]), ['annule', 'lit', 'programme'], 'une séance faite');
  assert.deepEqual(x.appels[2][1].map(n => iso(new Date(n.schedule.at))), [J(3)]);
  x.appels.length = 0;
  s.push({ d: J(2), lessons: [3] });
  x.run('rappelAuto()'); x.minuteur(); await x.attendre();
  assert.deepEqual(x.appels[2][1].map(n => iso(new Date(n.schedule.at))), [J(2), J(3)], 'une séance ajoutée');
  /* L’heure ou l’interrupteur changent : la signature aussi */
  assert.notEqual(bac({ sessions: s, heure: '08:00' }).run('rappelSignature()'), bac({ sessions: s }).run('rappelSignature()'));
  assert.notEqual(bac({ sessions: s, on: false }).run('rappelSignature()'), bac({ sessions: s }).run('rappelSignature()'));
  /* Plusieurs enregistrements à la suite : une seule fois, après le dernier */
  x.appels.length = 0;
  x.run('rappelAuto();rappelAuto();rappelAuto(400)');
  assert.deepEqual(x.minuteur(), [400]);
  /* Pendant l’onboarding, avant d’avoir fini, ou sur le web : rien */
  for (const o of [{ ob: true }, { onboarded: false }, { natif: false }]) {
    const y = bac({ sessions: s, ...o });
    y.run('rappelAuto()'); y.minuteur(); await y.attendre();
    assert.deepEqual(y.appels, [], JSON.stringify(o));
  }
});

test('branché partout : chaque enregistrement, l’ouverture, le retour dans l’appli ; sur le web, la page aussi suit le planning', () => {
  assert.ok(app.includes("function save(){ state=normalizeState(state); Store.set(KEY,state); if(typeof rappelAuto==='function')rappelAuto(); }"));
  assert.ok(app.includes("    setTimeout(()=>{try{if(state.onboarded)rappelAuto(0);}catch(e){}},2200);"));
  assert.ok(app.includes("    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'){ rappelVu(); tickRappel(); rappelAuto(400); } });"));
  /* La page ouverte (web) : la notification de l’heure, seulement un jour de séance pas encore faite */
  const tick = cut('function tickRappel(){', 'function plusIcon(kind){');
  const LE_6 = new Date(2026, 10, 6, 19, 0, 10).getTime();
  const essai = (sessions, faits = []) => {
    const vus = [], store = {};
    const N = function (t, o) { vus.push([t, o.body]); };
    N.permission = 'granted';
    const D = class extends Date { constructor(...a) { if (a.length) super(...a); else super(LE_6); } static now() { return LE_6; } };
    const x = bac({ sessions, faits });
    Object.assign(x.ctx, { Date: D, Notification: N, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } } });
    x.ctx.window.Notification = N;
    x.run(tick + ';tickRappel();tickRappel();');
    return vus;
  };
  assert.equal(essai([{ d: '2026-11-06', lessons: [1] }]).length, 1, 'vendredi, séance prévue : une notification (une seule)');
  assert.equal(essai([{ d: '2026-11-06', lessons: [1] }], [1]).length, 0, 'déjà faite : rien');
  assert.equal(essai([{ d: '2026-11-09', lessons: [1] }]).length, 0, 'pas de séance ce jour-là : rien');
});

test('Mon compte : le prochain rappel, et qu’il suit le planning', () => {
  const feuille = (sessions, faits = []) => {
    const body = { innerHTML: '', contains: () => false, querySelector: () => null }, fait = new Set(faits);
    const store = { 'requete-rappel': '1', 'requete-rappel-heure': '19:00' };
    const ctx = vm.createContext({
      localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } }, PATTERN,
      state: { plan: { freq: 3, sessions } }, draft: null, window: {}, navigator: { vibrate() {} }, Notification: { permission: 'granted' },
      itemDone: id => fait.has(id),
      document: { activeElement: null, documentElement: { classList: { contains: () => false } }, getElementById: id => (id === 'rp-body' ? body : null) } });
    vm.runInContext(cut('function rappelOn(){', 'function tickRappel(){'), ctx);
    vm.runInContext('RP=null;rappelBrouillon();rappelPeindre()', ctx);
    return body.innerHTML;
  };
  /* 22 h 04 : la phrase sur le planning est partie (retours-2204) */
  const h = feuille([{ d: J(1), lessons: [1] }]);
  assert.ok(h.includes('<span>Prochain rappel : demain à 19:00.</span>') && !h.includes('Il suit ton planning'), h);
  const t = new Date(); t.setDate(t.getDate() + 3);
  const loin = `${t.toLocaleDateString('fr-FR', { weekday: 'long' })} ${t.getDate() === 1 ? '1er' : t.getDate()} ${t.toLocaleDateString('fr-FR', { month: 'long' })} à 19:00`;
  assert.ok(feuille([{ d: J(3), lessons: [1] }]).includes(`Prochain rappel : ${loin}.`), loin);
  assert.ok(feuille([{ d: J(1), lessons: [1] }], [1]).includes('Ton planning ne prévoit plus de séance : pas de rappel pour l’instant.'));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-09-flamme-v2766';"), 'le cache de l’appli change');
});
