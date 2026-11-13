/* Elisa, 13 novembre, 23 h 26 (« Montre-moi maintenant la partie classement, avec 6 ») : @marie_charlotte et @ines finissaient à
   495 points et « 00:06 » toutes les deux. Le podium de la gagnante disait « Devant @ines, de 0 point. », celui d’@ines
   « @marie_charlotte l’emporte de 0 point ». À égalité de points, c’est le temps qui départage : on le dit, et le dixième de seconde
   s’affiche quand les temps se lisent pareil. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ligne = n => { const a = app.indexOf(`function ${n}(`); return app.slice(a, app.indexOf('\n', a) + 1); };
const fn = n => { const a = app.indexOf(`function ${n}(`); return app.slice(a, app.indexOf('\n}\n', a) + 2); };

test('des temps qui se lisent pareil : le dixième les départage à l’écran', () => {
  const ctx = vm.createContext({});
  vm.runInContext(ligne('jeuChrono') + fn('jeuChronoFin'), ctx);
  const sc = [{ pid: 'm', pts: 495, ms: 6230 }, { pid: 'i', pts: 495, ms: 6870 }, { pid: 'l', pts: 460, ms: 6400 }, { pid: 't', pts: 0, ms: 1200000 }, { pid: 'u', pts: 0, ms: 1200000 }];
  assert.equal(ctx.jeuChronoFin(sc[0], sc), '00:06,2');
  assert.equal(ctx.jeuChronoFin(sc[1], sc), '00:06,8');
  assert.equal(ctx.jeuChronoFin(sc[2], sc), '00:06', 'autres points : la seconde suffit');
  assert.equal(ctx.jeuChronoFin(sc[3], sc), '20:00', 'à 0 point, pas de départage à dire');
  assert.ok(app.includes("' · '+jeuChronoFin(g[0],sc):''}</small>") && app.includes("<small class=\"is-ms\">${x.pts>0?jeuChronoFin(x,sc):'Pas trouvé'}</small>"), 'le podium et le classement final');
});

test('à égalité de points, plus de « de 0 point » : le temps départage', () => {
  assert.ok(app.includes('phrase=!second?\'\':second.pts===moi.pts?`À égalité de points avec ${nom(second)}, tu passes devant au temps.`'));
  assert.ok(app.includes('phrase=moi.pts>0&&premier&&premier.pts===moi.pts?`À égalité de points, ${nom(premier)} passe devant au temps. À toi la revanche\\u00a0!`'));
  assert.ok(app.includes(':second.pts>0?`Devant ${nom(second)}, de ${ecart(moi,second)}.`'), 'sinon, l’écart comme avant');
});
