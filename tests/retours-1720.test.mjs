/* Elisa, 11 novembre, 17 h 20 (son brouillon de la carte « Base relationnelle », avec le tableau des types) : « ça va faire deux
   cartes pour la leçon base relationnelle » ; les types n’étaient dans aucune carte. 17 h 24 (capture de l’accueil) : « ne pas mettre
   SQLite, mais un moteur SQL dans ton application ». */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a > 0, n); return app.slice(a, app.indexOf('\n}', a) + 2); };
const plain = x => JSON.parse(JSON.stringify(x));

function bac() {
  const ctx = vm.createContext({ esc: s => String(s), escAttr: s => String(s), highlight: s => s, lqStkSvg: k => `<svg data-k="${k}"></svg>`, cardMemoPoints: () => [] });
  vm.runInContext(app.slice(app.indexOf('const CARTES={'), app.indexOf('function memoArg(')) + fn('memoArg').split('\n')[0]
    + '\nconst allLessons=[{id:0},{id:2},{id:13}];this.L=()=>({liste:memoCartes().map(e=>[e.cid,e.lid,e.c.k]),total:memoCartes().length});'
    + app.slice(app.indexOf('const MEMO_LOCK_STK='), app.indexOf('/* Le numéro de collection (01 à 71)')) + fn('memoSerial') + fn('memoKn') + fn('memoKw') + fn('memoCodes') + fn('memoTab') + fn('memoVerso'), ctx);
  return ctx;
}

test('la leçon « Les bases de données relationnelles » donne deux cartes : 01 Base relationnelle, 02 Types de données', () => {
  const ctx = bac();
  assert.deepEqual(plain(ctx.L().liste), [[0, 0, 'Base relationnelle'], ['0-types', 0, 'Types de données'], [2, 2, 'AS'], [13, 13, 'DISTINCT']]);
  assert.deepEqual([0, '0-types', 2].map(id => ctx.memoSerial(id)), ['01', '02', '03'], 'les numéros suivent');
  assert.equal(ctx.memoCarte('0-types').lid, 0, 'elle se gagne avec sa leçon');
  assert.equal(ctx.memoArg('0-types'), "'0-types'");
  assert.equal(ctx.memoArg(4), '4');
  assert.ok(app.includes('const TOTAL_CARTES=memoCartes().length;'), '72 cartes à récolter');
});

test('la carte des types : trois points, le tableau de son brouillon, une syntaxe que la Console exécute, un piège', () => {
  const ctx = bac();
  const c = ctx.memoCarte('0-types').c;
  assert.equal(c.t, 'Ce qu’une colonne peut contenir');
  assert.equal(c.points.length, 3);
  assert.deepEqual(plain(c.tab.lignes.map(l => l[0])), ['INTEGER', 'DECIMAL', 'VARCHAR', 'TEXT', 'DATE', 'BOOLEAN'], 'les six types de son brouillon');
  assert.deepEqual(plain(c.tab.tete), ['Type', 'Utilisation', 'Exemple']);
  assert.ok(c.s.split('\n').every(l => l.length <= 30), 'la syntaxe : 30 signes par ligne au plus');
  assert.ok(!c.dialecte, 'la base de l’appli accepte ces types : « Essayer » reste');
  const v = ctx.memoVerso('0-types');
  assert.ok(v.includes('<div class="mc-tab"><p class="mc-lab">Les types courants</p><table><thead><tr><th scope="col">Type</th><th scope="col">Utilisation</th><th scope="col">Exemple</th></tr></thead>'));
  assert.ok(v.includes('<tr><th scope="row"><code>DATE</code></th><td>Date</td><td class="mc-tab-ex"><code>\'2026-11-11\'</code></td></tr>'));
  assert.ok(v.indexOf('mc-pts') < v.indexOf('mc-tab') && v.indexOf('mc-tab') < v.indexOf('mc-syn') && v.indexOf('mc-syn') < v.indexOf('mc-piege'), 'À retenir, le tableau, la syntaxe, le piège');
  assert.ok(!ctx.memoVerso(0).includes('mc-tab'), 'pas de tableau sur les autres cartes');
  assert.ok(css.includes('html.lq .mc-tab{position:relative;margin:22px 0 0;'));
});

test('au bilan de la leçon, les deux cartes ; plus d’annonce de déblocage depuis le 11 novembre (le bilan l’accueille)', () => {
  /* 12 novembre, 17 h 05 : les deux cartes dans la même main, sous un seul titre (plus de « Et une deuxième carte ») */
  assert.ok(fn('bravoUnlockHtml').includes("${cs.map((e,k)=>bravoUnlockCarte(l,e,k,nb)).join('')}"));
  assert.ok(fn('bravoUnlockHtml').includes("'Deux nouvelles cartes <em>mémo</em>&nbsp;!'") && !app.includes('deuxième carte <em>mémo</em>'));
  assert.ok(fn('showUnlock').includes('lastUnlockedId=id;') && !fn('showUnlock').includes('toast'));
  assert.ok(fn('revealBravoCard').includes("document.querySelectorAll('#lesson-body .mc-reveal').forEach(revealBravoUne);"));
});

test('l’accueil : « Moteur SQL dans ton application », plus SQLite ni navigateur', () => {
  assert.ok(app.includes('<div><strong class="ob-moteur">Moteur</strong><span>SQL dans ton application</span></div>'));
  /* 17 h 47 : son texte */
  assert.ok(app.includes('<p class="ob-lead">Écris tes premières requêtes sur une vraie base SQL, exécute-les et découvre instantanément les résultats. Apprends à ton rythme, où que tu sois.</p>'));
  assert.ok(!app.includes('<strong>SQLite</strong><span>dans ton navigateur</span>'));
});
