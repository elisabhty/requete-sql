/* Elisa, 11 novembre, 22 h 11 : dix-neuf nouveaux messages pour le rappel du jour ; « ça va prendre au hasard, un par jour, et après ça
   va retrier » ; « est-ce que je pourrais ajouter d’autres notifications, même quand l’application sera sur l’App Store ? ». La liste vit
   aussi en ligne (rappels.json, sur requeteapp.com) : l’appli la relit à l’ouverture et reprogramme ses rappels si elle a changé. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const bloc = app.slice(app.indexOf('const RAPPEL_MESSAGES=['), app.indexOf('/* App iOS : le rappel passe par des notifications locales'));

function ctx({ store = {}, reponse = null, ok = true } = {}) {
  const appels = [];
  const c = vm.createContext({
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    fetch: async (url, o) => { appels.push([url, o]); return { ok, json: async () => reponse }; },
    rappelAuto: ms => appels.push(['auto', ms]), Date, Math, JSON, Map, Set, Array, String,
  });
  vm.runInContext(bloc.replace('const RAPPEL_MESSAGES=', 'var RAPPEL_MESSAGES='), c);
  return { c, store, appels };
}

test('rappels.json, sur le site : la même liste que l’appli, un message par ligne', () => {
  const f = fs.readFileSync(path.join(ROOT, 'rappels.json'), 'utf8'), d = JSON.parse(f);
  const { c } = ctx();
  assert.deepEqual(d.messages, JSON.parse(JSON.stringify(c.RAPPEL_MESSAGES)), 'les 27 messages');
  assert.ok(d._aide.includes('pas besoin d’une nouvelle version sur l’App Store'));
  assert.equal(f.split('\n').filter(l => l.startsWith('  ["')).length, 27, 'une ligne par message : facile à modifier sur GitHub');
});

test('la liste en ligne : lue à l’ouverture (deux fois par jour au plus), gardée, et les rappels reprogrammés si elle change', async () => {
  const neuf = { messages: [['A', 'a'], ['B', 'b'], ['C', 'c'], ['D', 'd'], ['E', 'e']] };
  const t = ctx({ reponse: neuf });
  await t.c.rappelCharger();
  assert.equal(t.appels[0][0], 'https://requeteapp.com/rappels.json');
  assert.equal(t.appels[0][1].cache, 'no-store');
  assert.deepEqual(JSON.parse(t.store['requete-rappels']), neuf.messages, 'gardée sur l’appareil');
  assert.deepEqual(t.appels[1], ['auto', 0], 'les rappels sont reprogrammés');
  assert.equal(t.c.rappelListe().length, 5);
  assert.ok(['A', 'B', 'C', 'D', 'E'].includes(t.c.rappelMessage(new Date(2026, 10, 12))[0]), 'les rappels prennent la nouvelle liste');
  t.appels.length = 0; await t.c.rappelCharger();
  assert.equal(t.appels.length, 0, 'pas deux fois en douze heures');
  await t.c.rappelCharger(true);
  assert.equal(t.appels.length, 1, 'la même liste : pas de reprogrammation');
  /* Un fichier abîmé, trop court, ou le réseau absent : la liste d’avant */
  for (const reponse of [{ messages: [['A', 'a']] }, { messages: 'x' }, null, [['', 'b'], ['c']]]) {
    const u = ctx({ reponse });
    await u.c.rappelCharger(true);
    assert.equal(u.c.rappelListe().length, 27, JSON.stringify(reponse));
  }
  const v = ctx({ ok: false }); await v.c.rappelCharger(true); assert.equal(v.c.rappelListe().length, 27);
  const w = ctx({ store: { 'requete-rappels': '{abîmé' } }); assert.equal(w.c.rappelListe().length, 27, 'une copie abîmée sur l’appareil');
});

test('la liste en ligne entre dans l’empreinte des rappels ; le service worker la laisse passer au réseau', () => {
  assert.ok(app.includes('function rappelSignature(){return [rappelOn()?1:0,rappelHeure(),rappelListeSig(),'));
  assert.ok(app.includes('        rappelCharger();   // la liste en ligne (rappels.json)'));
  assert.ok(sw.includes("if (url.pathname.endsWith('/rappels.json')) return;"));
  const a = ctx(), b = ctx({ store: { 'requete-rappels': JSON.stringify([['A', 'a'], ['B', 'b'], ['C', 'c'], ['D', 'd']]) } });
  assert.notEqual(a.c.rappelListeSig(), b.c.rappelListeSig());
});

test('au hasard, propre à chaque appareil : deux graines, deux ordres', () => {
  const a = ctx({ store: { 'requete-rappel-graine': '12345' } }), b = ctx({ store: { 'requete-rappel-graine': '98765' } });
  const jours = Array.from({ length: 10 }, (_, i) => new Date(2026, 10, 12 + i));
  assert.notDeepEqual(jours.map(d => a.c.rappelMessage(d)[0]), jours.map(d => b.c.rappelMessage(d)[0]));
  const n = ctx(); n.c.rappelGraine(); assert.ok(+n.store['requete-rappel-graine'] > 0, 'tirée une fois, gardée');
});
