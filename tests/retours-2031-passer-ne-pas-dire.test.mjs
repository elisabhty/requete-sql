/* Elisa, 14 novembre, 20 h 31, sur la page de l’âge (« 55 + » et « Un homme » cochés, « Passer » dessous) : « Si la personne
   passe, faire comme si elle a sélectionné Ne pas dire. » « Passer » ne répond pas, même si un choix était coché : à l’âge, pas
   d’âge et « Ne pas dire » ; au métier et à « Comment as-tu connu Requête ? », rien de gardé. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const fn = (debut, fin) => { const i = app.indexOf(debut); assert.ok(i >= 0, debut); return app.slice(i, app.indexOf(fin, i)); };

function bac(draft) {
  const vers = [];
  const ctx = vm.createContext({ draft, obGoto: t => vers.push(t), obFinSuivante: s => (s === 'source' ? 'rappel' : s) });
  vm.runInContext(fn('const OB_GENRES=', 'function genreDe(){') + fn('function genreDe(){', '/* 13 novembre, 14 h 24'), ctx);
  return { ctx, vers };
}

test('l’âge : « Passer » vaut « Ne pas dire », sans âge, même après « 55 + » et « Un homme »', () => {
  const b = bac({ ageRange: '55+', genre: 'h' });
  b.ctx.obPasser('age');
  assert.deepEqual([b.ctx.draft.ageRange, b.ctx.draft.genre], ['', 'n']);
  assert.deepEqual(b.vers, ['job']);
  assert.equal(b.ctx.genreDe(), '', 'les textes restent en forme inclusive');
  /* Un genre d’avant (le profil) ne revient pas : « Ne pas dire » l’emporte */
  const c = bac({ ageRange: '', genre: '' });
  c.ctx.state = { profile: { genre: 'f' } };
  c.ctx.obPasser('age');
  assert.equal(c.ctx.genreDe(), '');
  assert.ok(vm.runInContext("OB_GENRES.some(g=>g[0]==='n'&&g[1]==='Ne pas dire')", b.ctx), '« n » est bien « Ne pas dire »');
});

test('le métier et « Comment as-tu connu Requête ? » : « Passer » ne garde rien', () => {
  const b = bac({ job: 'student', source: 'referral', referral: 'Léa' });
  b.ctx.obPasser('job');
  assert.equal(b.ctx.draft.job, '');
  b.ctx.obPasser('source');
  assert.deepEqual([b.ctx.draft.source, b.ctx.draft.referral], ['', '']);
  assert.deepEqual(b.vers, ['goal', 'rappel']);
});

test('les trois pages appellent obPasser ; la fin de l’onboarding garde « Ne pas dire »', () => {
  assert.ok(app.includes("obSetFooter('Continuer',()=>obGoto('job'),'Passer',()=>obPasser('age'),'',!draft.ageRange||!draft.genre);"));
  assert.ok(app.includes("obSetFooter('Continuer',()=>obGoto('goal'),'Passer',()=>obPasser('job'),'',!draft.job);"));
  assert.ok(app.includes("obSetFooter('Continuer',()=>obGoto(obFinSuivante('source')),'Passer',()=>obPasser('source'),'',!draft.source);"));
  assert.ok(app.includes("    genre:OB_GENRES.some(g=>g[0]===draft.genre)?draft.genre:'',"), 'finishOnboard enregistre « n »');
  assert.ok(!app.includes("'Passer',()=>obGoto("), 'plus aucun « Passer » qui garde le choix');
});
