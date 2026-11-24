/* Elisa, 24 novembre, 16 h 48 : « Tu peux pousser pour tout le monde de la fermer 5 min après avoir fermé complètement l’appli »,
   puis « c’est urgent » et « Retirer aujourd'hui + 5 min plus tard ». L’app balayée, iOS ne la prévient pas : l’île de la leçon ou
   de l’onboarding restait jusqu’à 8 heures. Les versions de l’app d’avant (sans la méthode ileServeur du pont) n’ont plus ces deux
   îles ; la nouvelle version les rend, et le serveur les ferme 5 minutes après qu’on a quitté l’app. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j + b.length); };

const lab = headers => {
  const appels = [];
  const js = entre(app, 'let ileEtat=null;', '\nfunction ileProgression(){').replace(/\nfunction ileProgression\(\)\{$/, '');
  const lecon = entre(app, 'function ileDebut(l){', '\n}\n');
  const ob = entre(app, 'let ileOb=null;', '\nfunction ileObFin(fini){').replace(/\nfunction ileObFin\(fini\)\{$/, '');
  const Capacitor = {isNativePlatform: () => true, isPluginAvailable: n => n === 'RequeteWidget',
    nativePromise: (p, m, d) => { appels.push(m); return Promise.resolve(); }};
  if (headers) Capacitor.PluginHeaders = headers;
  const ctx = vm.createContext({window: {Capacitor}, natifT: x => x, natifSql: x => x, natifLangue: () => 'fr',
    LV: {id: 12, fin: false, video: {currentTime: 0, duration: 100}}, MODULES: [], moduleDeLecon: () => null,
    jourActif: () => false, dstr: () => '2026-11-24', auj: () => 0, lvSeuil: () => 0,
    OB_SLIDES: ['welcome', 'name'], obStep: 1, obApercu: false, obLegalMode: null, obFlowSteps: () => ['name'],
    draft: {name: ''}, state: {onboarded: false},
    document: {getElementById: () => ({classList: {contains: c => c === 'on'}}), addEventListener: () => {}}});
  vm.runInContext(js + '\nfunction ileProgression(){return 0;}\nfunction ileAllumee(){return false;}\nfunction ileMoments(){return null;}\nfunction ilePause(){return false;}\n'
    + lecon + '\n' + ob + '\nthis.ileDebut=ileDebut;this.ileObSync=ileObSync;this.ileFermetureOk=ileFermetureOk;', ctx);
  return {ctx, appels};
};

test('une version de l’app d’avant (sans ileServeur) : ni l’île de la leçon, ni celle de l’onboarding', () => {
  for (const h of [undefined, [], [{name: 'RequeteWidget', methods: [{name: 'leconDebut'}, {name: 'accueilDebut'}]}]]) {
    const {ctx, appels} = lab(h);
    assert.equal(ctx.ileFermetureOk(), false);
    ctx.ileDebut({id: 12, titre: 'WHERE'});
    ctx.ileObSync();
    assert.deepEqual(appels, [], 'rien n’est lancé');
  }
});

test('la nouvelle version (ileServeur dans la liste du pont) : les deux îles reviennent', () => {
  const {ctx, appels} = lab([{name: 'Autre', methods: []}, {name: 'RequeteWidget', methods: [{name: 'leconDebut'}, {name: 'ileServeur'}]}]);
  assert.equal(ctx.ileFermetureOk(), true);
  ctx.ileDebut({id: 12, titre: 'WHERE'});
  ctx.ileObSync();
  assert.deepEqual(appels, ['leconDebut', 'accueilDebut']);
});

test('la flamme du soir et les salles ne dépendent pas de ileServeur', () => {
  for (const f of ['function flammeProgrammer', 'function ileSalle']) {
    const i = app.indexOf(f);
    if (i < 0) continue;
    assert.ok(!app.slice(i, app.indexOf('\n}\n', i)).includes('ileFermetureOk'), f);
  }
});
