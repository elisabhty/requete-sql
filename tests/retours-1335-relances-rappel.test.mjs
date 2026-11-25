/* Elisa, 25 novembre, 13 h 35 : « Bah, ceux qui ont autorisé, il faut aussi une notification alors. » Les relances partent dès le
   rappel accepté, sans attendre le paywall : quelqu’un qui s’arrête entre le rappel et le paywall les reçoit aussi. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ligne = d => { const i = html.indexOf(d); return html.slice(i, html.indexOf('\n', i)); };
const bloc = nom => { const i = html.indexOf('function ' + nom + '('); return html.slice(i, html.indexOf('\n}\n', i) + 2); };

test('le rappel accepté pose la date de départ des relances', () => {
  const i = html.indexOf("stat(ok?'rappel_oui':'rappel_non');");
  assert.ok(i > 0);
  const suite = html.slice(i, i + 600);
  assert.ok(suite.includes("if(ok&&typeof relancePwVu==='function')relancePwVu();"), 'juste après le choix du rappel');
});

test('rattrapage : rappel déjà accepté, pas encore de date, pas fini → la date est posée à la prochaine ouverture', () => {
  const ctx = vm.createContext({Date, Math, RegExp});
  const mk = (rappel, onboarded, pw) => {
    const st = {'requete-rappel': rappel}; if (pw) st['rq-pw-vu'] = pw;
    ctx.localStorage = {getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }};
    ctx.state = {onboarded};
    return st;
  };
  vm.runInContext('var dstr=d=>"2026-11-25",auj=()=>new Date();' + bloc('rappelOn') + ligne('function relancePwVu()') + '\n'
    + 'function rattrape(){' + ligne("try{if(rappelOn()&&!(typeof state!=='undefined'&&state&&state.onboarded))relancePwVu();}catch(e){}") + '}', ctx);
  let st = mk('1', false); vm.runInContext('rattrape()', ctx); assert.equal(st['rq-pw-vu'], '2026-11-25');
  st = mk('0', false); vm.runInContext('rattrape()', ctx); assert.equal(st['rq-pw-vu'], undefined, 'rappel refusé : rien');
  st = mk('1', true); vm.runInContext('rattrape()', ctx); assert.equal(st['rq-pw-vu'], undefined, 'onboarding fini : inchangé');
  st = mk('1', false, '2026-11-20'); vm.runInContext('rattrape()', ctx); assert.equal(st['rq-pw-vu'], '2026-11-20', 'date déjà posée : gardée');
  assert.ok(bloc('relanceAuto').includes("relancePwVu();}catch(e){}\n  const q=relanceQui()"), 'avant le calcul de qui reçoit');
});
