/* 14 novembre, 13 h 58 (Elisa : « Tu peux prendre en compte le fait qu’il y a un ex-aequo, par exemple s’il y a deux manches. Je sais
   pas si on a prévu des pages pour lui ») ; à la question (même score, 505 à 505 après une manche gagnée chacun), « Garder le temps » :
   - le plus rapide au total gagne toujours ; la page des points et l’écran de fin le disent en grand : « Gagné au temps ! » pour
     l’un, « Battu au temps ! » pour l’autre, avec qui et de combien (« plus rapide de 2 s au total ») ;
   - même score et même temps à la milliseconde (la même place, jeuPlaces) : « Ex æquo ! », la 1re place partagée ;
   - « Match nul ! » (personne n’a trouvé) ne change pas. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const ligne = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a >= 0, n); return app.slice(a, app.indexOf('\n', a) + 1); };
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a >= 0, n); return app.slice(a, app.indexOf('\n}\n', a) + 2); };

test('de combien : « 2 s », « 1 min 05 », et sous la seconde « 0,4 s »', () => {
  const ctx = vm.createContext({});
  vm.runInContext(ligne('jeuDureeLisible') + fn('jeuEcartTemps'), ctx);
  const e = (a, b) => ctx.jeuEcartTemps({ ms: a }, { ms: b });
  assert.equal(e(6591, 9098), '2 s');
  assert.equal(e(130000, 65000), '1 min 05');
  assert.equal(e(120000, 0), '2 min');
  assert.equal(e(6230, 6870), '0,6 s');
  assert.equal(e(5000, 5020), '0,1 s', 'jamais « 0 s »');
  assert.equal(e(5000, 5970), '1 s');
});

test('l’écran de fin : gagné ou battu au temps, à égalité de points avec l’autre', () => {
  const a = app.indexOf("      const nul=sc.length>0&&sc.every(x=>x.pts===0),winner=!nul&&moi.place===1&&moi.pts>0;");
  const f = app.slice(a, app.indexOf('/* Le détail de tes points', a));
  assert.ok(f.includes("const egal=x=>x&&x!==moi&&x.pts===moi.pts,auTemps=moi.pts>0?[winner?second:premier].find(x=>egal(x)&&x.ms!==moi.ms)||null:null;"));
  assert.ok(f.includes("const exae=winner&&egal(second)&&second.ms===moi.ms;"));
  assert.ok(f.includes("const temps=auTemps?{avec:auTemps.name||'Joueur',ecart:jeuEcartTemps(moi,auTemps)}:null;"));
  assert.ok(f.includes("titre=temps?'Gagné au temps\\u00a0!':exae?'Ex æquo\\u00a0!':'Tu as gagné\\u00a0!'"));
  assert.ok(f.includes("titre=temps?'Battu au temps\\u00a0!':moi.pts>0?'Bien joué\\u00a0!':'La revanche t’attend\\u00a0!'"));
  assert.ok(f.includes(":exae?`Même score et même temps que ${nom(second)}\\u00a0: vous partagez la 1<sup>re</sup> place.`"));
  assert.ok(f.includes("titre='Match nul\\u00a0!'"), 'le 0 à 0 ne change pas');
  /* la page des points, avant le podium, reçoit avec qui et de combien */
  assert.ok(f.includes("place:moi.pts>0?moi.place:0,temps,apres:jeuVoileLever}"));
});

test('la page des points avant le podium : « Gagné au temps ! » ou « Battu au temps ! », pas entre les manches', () => {
  const p = fn('jeuPtsPage');
  assert.ok(p.includes("const auT=!M&&!zero&&o.temps&&o.temps.ecart&&(issue==='victoire'||issue==='defaite')?o.temps:null;"));
  assert.ok(p.includes("const h=auT?(issue==='victoire'?'Gagné au temps\\u00a0!':'Battu au temps\\u00a0!'):"));
  assert.ok(p.includes("const p=auT?(issue==='victoire'?`À égalité de points avec ${esc(auT.avec)}\\u00a0: tu as été plus rapide de ${auT.ecart} au total.`:`À égalité de points\\u00a0: ${esc(auT.avec)} a été plus rapide de ${auT.ecart} au total. Tes points comptent quand même\\u00a0!`)"));
});

test('chaque script de la page se lit (une même variable déclarée deux fois casse toute l’appli)', () => {
  const re = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g; let m, n = 0;
  while ((m = re.exec(app))) { n++; assert.doesNotThrow(() => new Function(m[1]), `script ${n}`); }
  assert.ok(n >= 5);
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-25-module-v3143';"), 'le cache de l’appli change');
});
