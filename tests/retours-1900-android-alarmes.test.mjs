/* Elisa, 25 novembre, 19 h (l'appli Android sur un vrai Pixel 8) : en entrant dans l'appli, Android ouvrait la page « Alarmes et
   rappels ». Sur Android seulement, chaque notification part en alarme non exacte (isExactNotification:false) : le module ne
   demande plus cette page ; l'iPhone ne change pas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifeste = fs.readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
const ligne = d => { const i = app.indexOf(d); assert.ok(i >= 0, d); return app.slice(i, app.indexOf('\n', i)); };

test('Android : les notifications ne demandent pas d’alarme exacte ; iPhone : inchangées', () => {
  const run = android => {
    const ctx = vm.createContext({appAndroid: () => android, Object});
    vm.runInContext(ligne('function lnSansExact(liste){'), ctx);
    return JSON.parse(JSON.stringify(vm.runInContext('lnSansExact([{id:300,title:"a"},{id:301,title:"b"}])', ctx)));
  };
  assert.deepEqual(run(true), [{id: 300, title: 'a', isExactNotification: false}, {id: 301, title: 'b', isExactNotification: false}]);
  assert.deepEqual(run(false), [{id: 300, title: 'a'}, {id: 301, title: 'b'}]);
});

test('toutes les programmations passent par lnSansExact', () => {
  const appels = app.match(/LN\.schedule\(\{notifications[^\n]*?\}\)/g) || [];
  assert.equal(appels.length, 3);
  for (const a of appels) assert.ok(a.includes("typeof lnSansExact==='function'?lnSansExact("), a);
  assert.ok(manifeste.includes('<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" tools:node="remove" />'));
});
