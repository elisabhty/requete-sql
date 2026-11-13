/* Elisa, 13 novembre, 23 h 38 : « l’onglet Classement ne semble pas fonctionner ». Le classement était vide pour tout le monde : la
   base n’avait aucun joueur ni aucune partie. Les parties vérifiées par le serveur entrent dans la file d’envoi sous la forme
   {u:'K7P2QX-0', salle, g} (jeu_score_v2) ; normalizeState ne gardait que l’ancienne forme ({u:'abc123', pts, n…}) et le save() de
   clsEnvoyer vidait la file aussitôt : aucune partie n’arrivait au classement. Les tests du classement ne passaient pas par
   normalizeState (leur save() ne nettoie rien) : celui-ci si. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('function normalizeState('), html.indexOf('function normalize(result,')), ctx);
const fn = n => { const a = html.indexOf(`function ${n}(`); return html.slice(a, html.indexOf('\n}\n', a) + 2); };

test('une partie vérifiée reste dans la file d’envoi au classement après save()', () => {
  const s = plain(ctx.normalizeState({ salle: { cle: 'R'.repeat(32), envoi: [{ u: 'K7P2QX-0', salle: 'K7P2QX', g: 0 }, { u: 'K7P2QX-1', salle: 'K7P2QX', g: 1 }] } }));
  assert.deepEqual(s.salle.envoi, [{ u: 'K7P2QX-0', salle: 'K7P2QX', g: 0 }, { u: 'K7P2QX-1', salle: 'K7P2QX', g: 1 }]);
  /* Trois tours de save() de suite : rien ne se perd */
  let t = s; for (let i = 0; i < 3; i++) t = plain(ctx.normalizeState(t));
  assert.equal(t.salle.envoi.length, 2);
  /* Ce qui n’est pas une partie de salle ne passe pas : l’ancienne forme, un code mal formé, un numéro qui n’en est pas un */
  const x = plain(ctx.normalizeState({ salle: { envoi: [{ u: 'abc123', pts: 200, n: 1, ok: 1 }, { salle: 'k7p2qx', g: 0 }, { salle: 'K7P2QX', g: '1' }, { salle: 'K7P2QX', g: -1 }] } }));
  assert.equal(x.salle.envoi, undefined);
});

test('le rattrapage, une fois par appareil : les parties déjà jouées (comptées sur l’appareil) repartent au classement', () => {
  const st = { salle: { comptees: ['HMWRUN-0', 'SNUWBB-1', 'SNUWBB-0', 'R1-0'], envoi: [{ u: 'SNUWBB-1', salle: 'SNUWBB', g: 1 }] } };
  const c = vm.createContext({ state: st, save() { c.state = plain(ctx.normalizeState(c.state)); }, clsSalle() { return c.state.salle; } });
  vm.runInContext(fn('clsRattraper'), c);
  c.clsRattraper();
  assert.deepEqual(c.state.salle.envoi.map(p => p.u), ['SNUWBB-1', 'SNUWBB-0', 'HMWRUN-0'], 'sans doublon, la plus ancienne d’abord');
  assert.equal(c.state.salle.clsRattrape, 1, 'gardé après save()');
  c.state.salle.envoi = []; c.clsRattraper();
  assert.deepEqual(c.state.salle.envoi, [], 'une seule fois');
  assert.ok(fn('clsFlush').includes('  clsRattraper();\n'), 'au premier envoi');
});

test('les points arrivés, l’onglet Classement se relit ; à l’ouverture de Défis, la file part', () => {
  assert.ok(fn('clsFlush').includes("DEFIS.cls.cle='';DEFIS.cls.rangs=null;"));
  assert.ok(fn('defisOnglet').includes("if(k==='classement')DEFIS.cls.cle='';"));
  assert.ok(fn('defisPeindre').includes("if(typeof clsFlush==='function')clsFlush();"));
});
