/* 5 novembre, 22 h 04 (Elisa, capture de la note « Prochain rappel : demain à 10:00. Il suit ton planning… ») : « pour les
   notifications il faut que ça s’update, car parfois on a le « Adapter à mon rythme » qui modifie le planning ; tu peux me montrer
   comment ça apparaîtra sur le téléphone ; n’oublie pas que le rappel, c’est si la personne n’a pas commencé sa séance (elle peut
   faire un cours sur deux, alors ne pas envoyer de rappel) ; pareil si elle est allée sur l’application (si elle l’a ouverte) » ;
   « dans la phrase, enlève la dernière phrase ».
   - Une séance commencée (une activité faite, ou une étape d’une leçon) n’a pas de rappel.
   - L’appli ouverte un jour : pas de rappel ce jour-là (le jour est noté au premier plan, puis tout est reprogrammé).
   - « Adapter mon rythme » reprogramme les rappels sur le nouveau planning.
   - Mon compte : « Prochain rappel : demain à 10:00. », sans la phrase sur le planning. */
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
const LE_6 = new Date(2026, 10, 6, 7, 0).getTime();   // vendredi 6 novembre, 7 h

const bac = ({ sessions, freq = 5, faits = [], etapes = {}, vu = '', heure = '10:00' } = {}) => {
  const fait = new Set(faits), store = { 'requete-rappel-vu': vu }, appels = [], timers = new Map();
  let n = 0;
  const LN = {
    cancel: async () => { appels.push(['annule']); }, checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }),
    schedule: async o => { appels.push(['programme', [...o.notifications].map(x => iso(new Date(x.schedule.at)))]); },
  };
  const lessons = {};
  for (const [id, e] of Object.entries(etapes)) lessons[id] = { etapes: e };
  const ctx = vm.createContext({
    PATTERN, state: { onboarded: true, lessons, plan: sessions === undefined ? { freq } : { freq, sessions } }, draft: {},
    document: { getElementById: () => null }, rappelOn: () => true, rappelHeure: () => heure, itemDone: id => fait.has(id),
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
    window: { Capacitor: { isNativePlatform: () => true, Plugins: { LocalNotifications: LN } } },
    setTimeout: (f, ms) => { timers.set(++n, { f, ms }); return n; }, clearTimeout: id => { timers.delete(id); },
  });
  vm.runInContext(rappel.replace('const JOURS_NOMS=', 'var JOURS_NOMS='), ctx);
  return {
    ctx, store, fait, appels, run: s => vm.runInContext(s, ctx),
    jours: (t = LE_6, max = 56) => pur(vm.runInContext(`rappelJoursPrevus(new Date(${t}),${max})`, ctx)),
    minuteur: () => { const t = [...timers.values()]; timers.clear(); t.forEach(v => v.f()); },
    attendre: async () => { for (let i = 0; i < 4; i++) await new Promise(r => setImmediate(r)); },
  };
};
/* Le planning d’Elisa : en semaine, deux cours par séance */
const SEMAINE = () => [{ d: '2026-11-06', lessons: [1, 2] }, { d: '2026-11-09', lessons: [3, 4] }, { d: '2026-11-10', lessons: [5, 6] }, { d: '2026-11-11', lessons: [7, 8] }];

test('séance commencée (un cours sur deux, ou une étape d’une leçon) : pas de rappel ce jour-là', () => {
  assert.deepEqual(bac({ sessions: SEMAINE() }).jours(), ['2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11'], 'rien de commencé : chaque séance');
  assert.deepEqual(bac({ sessions: SEMAINE(), faits: [1] }).jours(), ['2026-11-09', '2026-11-10', '2026-11-11'], 'un cours sur deux fait vendredi');
  assert.deepEqual(bac({ sessions: SEMAINE(), etapes: { 1: { video: 1 } } }).jours(), ['2026-11-09', '2026-11-10', '2026-11-11'], 'la vidéo d’une leçon vue');
  assert.deepEqual(bac({ sessions: SEMAINE(), etapes: { 1: {} } }).jours()[0], '2026-11-06', 'rien de vu : ce n’est pas commencé');
  assert.deepEqual(bac({ sessions: SEMAINE(), faits: [6] }).jours(), ['2026-11-06', '2026-11-09', '2026-11-11'], 'un cours de mardi fait en avance : pas de rappel mardi');
  /* Deux séances le même jour (après un rattrapage) : l’une commencée, le jour l’est */
  assert.deepEqual(bac({ sessions: [{ d: '2026-11-06', lessons: [1] }, { d: '2026-11-06', lessons: [2] }, { d: '2026-11-09', lessons: [3] }], faits: [2] }).jours(), ['2026-11-09']);
  /* Tout ce qui est prévu est commencé, rien en retard : pas de rappel (le rythme ne reprend pas) */
  assert.deepEqual(bac({ sessions: [{ d: '2026-11-06', lessons: [1, 2] }], faits: [1] }).jours(), []);
});

test('l’appli ouverte aujourd’hui : pas de rappel aujourd’hui, ceux des jours suivants restent', () => {
  assert.deepEqual(bac({ sessions: SEMAINE(), vu: '2026-11-06' }).jours(), ['2026-11-09', '2026-11-10', '2026-11-11']);
  assert.deepEqual(bac({ sessions: SEMAINE(), vu: '2026-11-05' }).jours()[0], '2026-11-06', 'ouverte hier : le rappel d’aujourd’hui reste');
  assert.deepEqual(bac({ freq: 5, vu: '2026-11-06' }).jours(LE_6, 3), ['2026-11-09', '2026-11-10', '2026-11-11'], 'sans planning (les jours du rythme) aussi');
  /* rappelVu note le jour ; la signature change, et le rappel du jour est retiré */
  const x = bac({ sessions: [{ d: J(0), lessons: [1] }, { d: J(1), lessons: [2] }], heure: '23:59' });
  const avant = x.run('rappelSignature()');
  x.run('rappelVu()');
  assert.equal(x.store['requete-rappel-vu'], J(0));
  assert.notEqual(x.run('rappelSignature()'), avant, 'ce qui est prévu a changé');
  assert.ok(!pur(x.run('rappelJoursPrevus(new Date(),5)')).includes(J(0)) && pur(x.run('rappelJoursPrevus(new Date(),5)')).includes(J(1)));
});

test('à l’ouverture et au retour dans l’appli : le jour noté, puis les rappels reprogrammés', async () => {
  const x = bac({ sessions: [{ d: J(0), lessons: [1] }, { d: J(1), lessons: [2] }, { d: J(2), lessons: [3] }], heure: '23:59' });
  x.run('rappelAuto()'); x.minuteur(); await x.attendre();
  const premier = x.appels.filter(a => a[0] === 'programme').at(-1)[1];
  assert.deepEqual(premier, [J(0), J(1), J(2)], 'avant l’ouverture : ce soir aussi');
  x.appels.length = 0;
  x.run('rappelVu();rappelAuto(400)'); x.minuteur(); await x.attendre();
  assert.deepEqual(x.appels.map(a => a[0]), ['annule', 'programme']);
  assert.deepEqual(x.appels[1][1], [J(1), J(2)], 'ouverte : plus de rappel ce soir');
  assert.ok(app.includes("    if(document.visibilityState!=='hidden')rappelVu();   // ouverte aujourd’hui : pas de rappel aujourd’hui (22 h 04)\n    tickRappel();"));
  assert.ok(app.includes("if(document.visibilityState==='visible'){ rappelVu(); tickRappel(); rappelAuto(400); }"));
});

test('« Adapter mon rythme » : les rappels suivent le nouveau planning', () => {
  const c = cut('function planAdjustCommit(preview){', '\n}\n');
  const i = c.indexOf("p.rythme=preview.choice.per===2?'calme':(preview.choice.per===5?'intensif':'regulier');"), j = c.indexOf('  try{rappelNativeSync();}catch(e){}   // le rappel suit les jours du parcours (11 h 08)');
  assert.ok(c.includes('p.sessions=planMergeSessions(') && i > 0 && j > i, 'reprogrammés une fois le planning recalculé');
  assert.ok(c.includes('save();renderPlanning();'), 'et l’enregistrement le vérifie (rappelAuto)');
  /* Passer de « en semaine » à « lundi, mercredi, vendredi » : les rappels du mardi et du jeudi partent */
  const x = bac({ sessions: SEMAINE() });
  assert.ok(x.jours().includes('2026-11-10'));
  x.ctx.state.plan.sessions = [{ d: '2026-11-06', lessons: [1, 2, 3] }, { d: '2026-11-09', lessons: [4, 5, 6] }, { d: '2026-11-11', lessons: [7, 8] }];
  x.ctx.state.plan.freq = 3;
  assert.deepEqual(x.jours(), ['2026-11-06', '2026-11-09', '2026-11-11']);
  assert.ok(app.includes('function save(){ state=normalizeState(state); Store.set(KEY,state); if(typeof rappelAuto===\'function\')rappelAuto(); }'));
});

test('Mon compte : « Prochain rappel : demain à 10:00. », sans la phrase sur le planning', () => {
  const f = cut('function rappelFeuilleHTML(){', 'function rappelPeindre(){');
  assert.ok(f.includes("    :d.on?(prochain?`Prochain rappel\\u00a0: ${rappelQuand(prochain)}.`"));
  assert.ok(!app.includes('Il suit ton planning\\u00a0: les jours de séance seulement'), 'la dernière phrase est partie');
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-08-salle-relue-v2658';"), 'le cache de l’appli change');
});
