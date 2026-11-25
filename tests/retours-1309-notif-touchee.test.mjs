/* Elisa, 25 novembre, 13 h 08-13 h 09 : « c’était quoi la notif », puis « oui stp pour tout le monde ». Une notification touchée
   dit son genre (séance, relance, absence) et le numéro de son message, dans les statistiques anonymes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ligne = d => { const i = html.indexOf(d); return html.slice(i, html.indexOf('\n', i)); };
const bloc = nom => { const i = html.indexOf('function ' + nom + '('); return html.slice(i, html.indexOf('\n}\n', i) + 2); };

const ctx = vm.createContext({localStorage: {getItem: () => '2026-11-24'}, parseD: s => new Date(s + 'T12:00:00'), natifLangue: () => 'fr', rappelListe: () => [['⏰ C’est l’heure', 'x'], ['🔥 Ta flamme', 'y']], rappelListeLangue: () => [], Array, String, Number, Math, Date});
vm.runInContext(ligne('const RELANCE_IDS=') + '\n' + ligne('const RELANCE_MSG=') + '\n' + ligne('const ABSENCE_MSG=') + '\n' + bloc('relanceNumeroDu') + ligne('function relanceMessageDu(at)') + '\n' + bloc('notifQuoi'), ctx);

test('le genre et le numéro du message d’une notification touchée', () => {
  const q = n => JSON.parse(JSON.stringify(vm.runInContext('notifQuoi(' + JSON.stringify(n) + ')', ctx)));
  assert.deepEqual(q({id: 305, title: '👀 SELECT * FROM excuses', extra: {rq: 'relance', m: 1}}), {k: 'relance', m: 1});
  assert.deepEqual(q({id: 312, title: '💔 C’est un LEFT JOIN ?'}), {k: 'relance', m: 2}, 'posée avant la mise à jour : le titre suffit');
  assert.deepEqual(q({id: 401}), {k: 'absence', m: 2});
  assert.deepEqual(q({id: 104, title: '🔥 Ta flamme'}), {k: 'seance', m: 2});
  assert.deepEqual(q({id: 99}), {k: 'n99'});
  assert.deepEqual(q({id: 120, title: 'inconnu'}), {k: 'seance'});
});

test('le 1er message des relances est « 👀 SELECT * FROM excuses », le lendemain du paywall', () => {
  const k = vm.runInContext('relanceNumeroDu(new Date("2026-11-25T20:00:00"))', ctx);
  assert.equal(k, 1);
  assert.equal(vm.runInContext('relanceMessageDu(new Date("2026-11-25T20:00:00"))[0]', ctx), '👀 SELECT * FROM excuses');
  assert.ok(html.includes("extra:{rq:'relance',m:k}") && html.includes("extra:{rq:'absence',m:i+1}"));
  assert.ok(html.includes("q=notifQuoi(e&&e.notification)") && !html.includes("k:id>=100?'seance':'n'+id"));
});
