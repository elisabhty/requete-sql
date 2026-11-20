/* 20 novembre, 9 h 43 (Elisa : « rends proportionnels les points », puis « Points ×2,5 ») : en Difficile, ×4 pour des paliers de
   2 min 30 faisait 320 points par minute au premier palier, contre 200 en Facile et en Moyen. Les points de vitesse et de place
   comptent ×2,5 : 200 points par minute partout. Arrondis à l’entier, dans l’appli (jeuX) comme sur le serveur (jeu_score_v2). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');
const ligne = d => { const i = app.indexOf(d); return app.slice(i, app.indexOf('\n', i)); };

test('les mêmes points par minute à chaque niveau, au premier palier', () => {
  const c = vm.createContext({});
  vm.runInContext([ligne('const JEU_PALIERS='), ligne('const JEU_NIV_X='), ligne('function jeuValeur('), ligne('function jeuPts(')].join('\n'), c);
  const ppm = k => vm.runInContext(`jeuValeur(1000,'${k}')/JEU_NIV_DUREE['${k}']`, c);
  assert.deepEqual(['f', 'm', 'd'].map(ppm), [200, 200, 200]);
  assert.deepEqual([150, 300, 450, 600, 750, 900, 901].map(t => vm.runInContext(`jeuValeur(${t * 1000},'d')`, c)), [500, 438, 375, 313, 250, 188, 125]);
  assert.equal(vm.runInContext("jeuPts(1000,0,false,true,'d').pts", c), 650, 'manche parfaite entre amis');
});
test('le serveur compte de même : ×2,5 en Difficile, arrondi manche par manche', () => {
  const m = lire('supabase/migrations/20261120084511_difficile_proportionnel.sql');
  assert.ok(m.includes("b2 constant text := $a$v_x:=case r.niv when 'm' then 2 when 'd' then 2.5 else 1 end;$a$;"));
  assert.ok(m.includes('b1 constant text := $a$v_x numeric; v_d numeric; res jsonb;$a$;') && m.includes('round((case when') && m.includes('*v_x)+case when premier'));
  assert.ok(m.includes("raise exception 'jeu_score_v2 n’est plus celle attendue : rien n’est changé';"));
});
test('partout où le coefficient s’affiche : ×2,5', () => {
  assert.ok(app.includes("<span>×${String(x).replace('.',typeof REQUETE_LANGUE!=='undefined'&&REQUETE_LANGUE.code&&REQUETE_LANGUE.code!=='fr'?'.':',')}</span>"), 'en anglais : ×2.5');
  assert.ok(!/comptent \$\{x===2\?'double':'quadruple'\}/.test(app));
});
