/* « À toi ! » dit avec sa légende dans les cours à moments (Elisa, 2 novembre, 19 h 53 : « Dans LEFT JOIN, par exemple, [la formatrice]
   ne dit pas à toi »). moments.js (momentVoice) donne à la légende « À toi ! » du k-ième moment le début de sa consigne (at{k}, jusqu’à
   VOICE.toi[at{k}][0]) ; la feuille dit la suite. tools/voix/atoi.mjs situe ces « À toi ! » ; integrer.mjs les garde. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const ANIM = path.join(root, 'assets/anim');
const src = fs.readFileSync(path.join(ANIM, 'moments.js'), 'utf8');

function run(VOICE){
  const doc = {createElement: () => ({style: {}, append() {}, setAttribute() {}}), head: {append() {}}, querySelector: () => null};
  const ctx = vm.createContext({document: doc, window: {}, console});
  vm.runInContext(`let VCFG = ${JSON.stringify(VOICE)};\n` + src + '\nthis.momentPlan = momentPlan; this.momentVoice = momentVoice; this.V = () => VCFG;', ctx);
  return ctx;
}

test('la légende « À toi ! » dit le début de la consigne, la feuille la suite', () => {
  const ctx = run({say: {at1: ['at1', 0, 7.02], at2: ['at2', 0.05, 0.89], at3: ['at3', 0, 4]}, toi: {at1: [0.67, 0.75], at2: [0.89, 0.89]}});
  const M = ctx.momentPlan([{at: 5}, {at: 11}, {at: 20}], [[1, 4, 'Bonjour'], [6, 10, 'Suite'], [12, 19, 'Fin']], [{n: 1, a: 0, b: 30}], 30, null);
  ctx.momentVoice(M.captions);
  const J = x => JSON.parse(JSON.stringify(x));
  const toi = J(M.captions.filter(c => c[2] === 'À toi !'));
  assert.equal(toi.length, 3);
  assert.deepEqual(toi[0][3], {voice: ['at1', 0, 0.67]});
  assert.deepEqual(toi[1][3], {voice: ['at2', 0.05, 0.89]}, 'une consigne qui n’est que « À toi ! » : tout pour la légende');
  assert.equal(toi[2][3], undefined, 'sans VOICE.toi : la légende reste muette, la consigne garde son « À toi ! »');
  const V = J(ctx.V());
  assert.deepEqual(V.say.at1, ['at1', 0.75, 7.02], 'la feuille dit la suite');
  assert.equal(V.say.at2, null, 'rien après « À toi ! » : la feuille se tait');
  assert.deepEqual(V.say.at3, ['at3', 0, 4]);
  assert.equal(J(M.captions).filter(c => c[2] !== 'À toi !').every(c => c.length === 3), true, 'les autres légendes ne changent pas');
});

test('chaque cours à moments situe le « À toi ! » de chacune de ses consignes (VOICE.toi)', () => {
  for (const f of fs.readdirSync(ANIM).filter(f => f.endsWith('.html'))) {
    const page = fs.readFileSync(path.join(ANIM, f), 'utf8');
    if (!page.includes('src="moments.js"') || !page.includes('const VOICE = {')) continue;
    const m = /\n  say: (\{.*?\})(?:,\n  toi: (\{.*?\}))?\};\n\/\* Fin de la voix off \*\//s.exec(page);
    assert.ok(m, `${f} : bloc VOICE`);
    const say = JSON.parse(m[1]), toi = m[2] ? JSON.parse(m[2]) : {};
    for (const k of Object.keys(say).filter(k => /^at\d+$/.test(k))) {
      assert.ok(toi[k], `${f} : ${k} sans « À toi ! » situé (node tools/voix/atoi.mjs ${f.slice(0, -5)})`);
      assert.ok(toi[k][0] - say[k][1] >= 0.4 && toi[k][0] - say[k][1] <= 1.1 && toi[k][1] >= toi[k][0], `${f} : ${k} ${JSON.stringify(toi[k])}`);
    }
  }
});

test('core.js et where.html : un « À toi ! » sans suite ne casse pas la liste des fichiers', () => {
  assert.ok(fs.readFileSync(path.join(ANIM, 'core.js'), 'utf8').includes('Object.values(say).filter(Boolean).map(v => src(v[0]))'));
  const where = fs.readFileSync(path.join(ANIM, 'where.html'), 'utf8');
  assert.ok(where.includes("say[key] = t[1] < v[2] - 0.3 ? [v[0], t[1], v[2]] : null;") && where.includes('Object.values(say).filter(Boolean)'));
});
