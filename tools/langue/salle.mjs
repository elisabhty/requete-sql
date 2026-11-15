/* Une salle de défi à deux, un joueur en français (Léa, l'hôte) et un en anglais (Sam), dans deux onglets du même navigateur
   (?jeu=local, sans serveur : multiplayer-security.js est mis de côté, la vérification du serveur a ses propres tests).
   Deux manches : chaque fois un essai raté puis la solution, Sam d'abord ; puis la fin, la correction, la revanche.
   Écrit ce qui s'est affiché sans traduction chez Sam dans tools/langue/travail/<langue>/salle-manque.json.
   node tools/langue/salle.mjs [--langue en] [--manches=2] [--captures=dossier]
   (15 novembre, Elisa : « un français et un anglais peuvent jouer ensemble ? test pour être sûr ») */
import fs from 'node:fs';
import { serveur, navigateur, args, travail } from './commun.mjs';
const srv = await serveur(), browser = await navigateur();
const ctx = await browser.newContext({viewport: {width: 393, height: 852}, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris'});
await ctx.route(u => !String(u).startsWith(srv.base), r => r.fulfill({status: 404, body: ''}));
await ctx.route(u => String(u).includes('multiplayer-security.js'), r => r.fulfill({status: 200, contentType: 'text/javascript', body: ''}));
const A_ = args(process.argv.slice(2).concat('salle')), LANGUE = A_.langue, NB = +(A_.options.manches || 2), SHOTS = A_.options.captures || '';
const ouvrir = async (langue, pseudo, nom) => {
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(String(e).slice(0, 200)));
  await p.addInitScript(([l, ps, n]) => { try { if (sessionStorage.getItem('pret')) return; sessionStorage.setItem('pret', '1');
    if (l !== 'fr') { localStorage.setItem('requete-langue-essai', '1'); localStorage.setItem('requete-langue', l); } else { localStorage.removeItem('requete-langue'); localStorage.removeItem('requete-langue-essai'); }
    localStorage.setItem('requete-sql-v3', JSON.stringify({onboarded: true, name: n, salle: {pseudo: ps}})); } catch (e) {} }, [langue, pseudo, nom]);
  await p.goto(srv.base + '/index.html?jeu=local' + (langue !== 'fr' ? '&langue=' + langue : ''), {waitUntil: 'load'});
  await p.waitForTimeout(3500);
  return p;
};
const A = await ouvrir('fr', '@lea', 'Léa'), B = await ouvrir(LANGUE, '@sam', 'Sam');
const shot = async (n) => { if (!SHOTS) return; await A.screenshot({path: `${SHOTS}/a-${n}.png`}); await B.screenshot({path: `${SHOTS}/b-${n}.png`}); };
await A.evaluate(nb => { jeuNb = nb; jeuStart('FREN02', true, null, {}); }, NB); await A.waitForTimeout(1500);
await B.evaluate(() => jeuStart('FREN02', false, null, {})); await B.waitForTimeout(2500);
await B.evaluate(() => { const b = [...document.querySelectorAll('#jeu-root button')].find(x => /ready|Prêt/i.test(x.textContent)); if (b) b.click(); }); await B.waitForTimeout(1500);
await shot('1-attente');
await A.evaluate(() => jeuNextRound()); await A.waitForTimeout(6500);
await shot('2-defi');
const joue = async (p, faux) => { await p.evaluate(f => { const c = CHALLENGES.find(x => x.id === JEU.rounds[jeuCur()].cid); const ta = document.getElementById('ed-lesson'); ta.value = f ? 'SELECT * FROM xyz;' : c.sol; ta.dispatchEvent(new Event('input')); runLesson(); }, faux); };
for (let n = 0; n < NB; n++) {
  await joue(B, true); await B.waitForTimeout(1500);
  await joue(B); await B.waitForTimeout(2000);
  if (n === 0) await shot('3-sam-trouve');
  await joue(A, true); await A.waitForTimeout(1200);
  await joue(A); await A.waitForTimeout(7000);
  if (n < NB - 1) { await shot('4-entre-manches'); await A.waitForTimeout(6000); }
}
await A.waitForTimeout(5000);
await shot('5-fin');
await B.evaluate(() => jeuCorrection(0)); await A.evaluate(() => jeuCorrection(0)); await A.waitForTimeout(1500);
await shot('6-correction');
await B.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Voir le podium|podium/i.test(x.textContent)); if (b) b.click(); }); await B.waitForTimeout(1500);
await B.evaluate(() => { if (typeof jeuRevanche === 'function') jeuRevanche(); }); await B.waitForTimeout(2000);
await shot('7-revanche');
const manque = await B.evaluate(() => REQUETE_LANGUE.manquants());
fs.writeFileSync(travail(LANGUE, 'salle-manque.json'), JSON.stringify(manque, null, 1));
console.log(manque.length, 'textes sans traduction chez Sam');
console.log(manque.join('\n'));
console.log('erreurs :', A.errs, B.errs);
await browser.close(); srv.close();
