/* Elisa, 15 novembre, 21 h 36 : « Tu peux mettre ces boutons sur tous les notifs actuels : Voir mon planning et Plus tard ».
   - Chaque rappel programmé porte le type de boutons RAPPEL (registerActionTypes du plugin LocalNotifications, déjà dans l’appli).
   - « Voir mon planning » ouvre Planning par le chemin des raccourcis ; « Plus tard » relance le même message une heure après, jamais
     après 22 h 30 ; ouvrir l’appli annule la relance.
   - Les deux boutons sont dans la langue de l’appli. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const en = fs.readFileSync(path.join(ROOT, 'langue-en.js'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';

const monde = () => {
  const journal = { types: null, poses: [], annules: [], ouverts: [] };
  const LN = {
    registerActionTypes: async o => { journal.types = o; },
    schedule: async o => { journal.poses.push(...o.notifications); },
    cancel: async o => { journal.annules.push(...o.notifications.map(n => n.id)); },
  };
  const ctx = vm.createContext({ window: { Capacitor: { isNativePlatform: () => true, Plugins: { LocalNotifications: LN } } }, Date, Promise,
    natifT: x => ({ 'Voir mon planning': 'See my schedule', 'Plus tard': 'Later' })[x] || x, raccourciOuvrir: t => journal.ouverts.push(t) });
  vm.runInContext(cut('const RAPPEL_BOUTONS=', '\nasync function rappelBoutonsPoser(') + '\n' + cut('async function rappelBoutonsPoser(', '\n}\n') + '\n}\n'
    + fn('rappelPlusTardQuand') + fn('rappelBouton') + fn('rappelPlusTardAnnuler'), ctx);
  return { ctx, journal, LN };
};
const attendre = () => new Promise(r => setTimeout(r, 20));

test('les rappels portent les boutons « Voir mon planning » et « Plus tard », dans la langue de l’appli', async () => {
  const { ctx, journal, LN } = monde();
  assert.equal(await ctx.rappelBoutonsPoser(LN), true);
  assert.deepEqual(JSON.parse(JSON.stringify(journal.types)), { types: [{ id: 'RAPPEL', actions: [{ id: 'planning', title: 'See my schedule', foreground: true }, { id: 'plus-tard', title: 'Later' }] }] });
  assert.equal(await ctx.rappelBoutonsPoser({}), false, 'un plugin sans boutons : des rappels sans boutons, comme avant');
  const sync = fn('rappelNativeSync');
  assert.ok(sync.includes("const boutons=typeof LN.registerActionTypes==='function'?await rappelBoutonsPoser(LN):false;") && sync.includes('boutons?{actionTypeId:RAPPEL_BOUTONS}:{}'), 'chaque rappel programmé');
  assert.ok(en.includes('"Voir mon planning": "See my schedule",') && en.includes('"Plus tard": "Later",'));
  assert.ok(en.includes('"Ton planning t’attend juste après.": "Your schedule is waiting right after.",'));
});

test('« Voir mon planning » ouvre Planning ; « Plus tard » relance le même message une heure après, pas après 22 h 30', async () => {
  const { ctx, journal } = monde();
  ctx.rappelBouton('planning', { id: 104 });
  assert.deepEqual(journal.ouverts, ['fr.requete.app.planning']);
  const r = fn('raccourciOuvrir');
  assert.ok(r.includes("planning=!vers&&type.endsWith('.planning')") && r.includes("else if(planning)switchTab('planning');"), 'le chemin des raccourcis (onboarding, paywall, séance en cours)');
  const h = (H, M) => { const d = new Date(2026, 10, 15, H, M, 0, 0); return d; };
  assert.equal(ctx.rappelPlusTardQuand(h(19, 0)).getHours(), 20);
  assert.equal(ctx.rappelPlusTardQuand(h(21, 30)).getMinutes(), 30, '22 h 30 pile, encore');
  assert.equal(ctx.rappelPlusTardQuand(h(21, 31)), null, 'trop tard ce soir');
  assert.equal(ctx.rappelPlusTardQuand(h(23, 30)), null, 'le lendemain : non');
  assert.equal(ctx.rappelPlusTardQuand(h(0, 38)), null, '16 novembre : touché à minuit et demi, pas de rappel à 1 h 38');
  assert.equal(ctx.rappelPlusTardQuand(h(7, 30)).getHours(), 8, 'dès 8 h, oui');
  /* « Plus tard », touché maintenant : tout dépend de l’heure ; le message reste le même */
  const avant = ctx.rappelPlusTardQuand(new Date());
  ctx.rappelBouton('plus-tard', { id: 104, title: '😏 Netflix peut attendre', body: 'Une petite requête d’abord ?' });
  await attendre();
  if (avant) {
    assert.deepEqual(journal.annules, [99]);
    assert.equal(journal.poses.length, 1);
    assert.equal(journal.poses[0].id, 99); assert.equal(journal.poses[0].title, '😏 Netflix peut attendre'); assert.equal(journal.poses[0].actionTypeId, 'RAPPEL');
  } else assert.equal(journal.poses.length, 0);
  ctx.rappelBouton('dismiss', { id: 104 }); ctx.rappelBouton('tap', { id: 104 });
  assert.equal(journal.ouverts.length, 1, 'toucher la notification : l’appli s’ouvre, comme avant');
});

test('ouvrir l’appli annule la relance', async () => {
  const { ctx, journal } = monde();
  ctx.rappelPlusTardAnnuler(); await attendre();
  assert.deepEqual(journal.annules, [99]);
  assert.ok(app.includes("if(document.visibilityState==='visible'){ rappelVu(); if(typeof rappelPlusTardAnnuler==='function')rappelPlusTardAnnuler();"));
  assert.ok(app.includes("try{rappelBouton(a,e&&e.notification);}catch(err){}"), 'l’écoute des boutons');
});
