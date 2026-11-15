/* 8 · Les fiches des leçons dans l'appli : le titre, le résumé et le récapitulatif (« Les trois idées à retenir ») de chaque
   leçon vidéo, passés par le moteur dans la langue. Ce qui manque s'ajoute à langue-<langue>.js, dans le bloc « Les fiches des
   cours du module N » (les clés sans retours à la ligne : les phrases du récapitulatif tiennent sur une ligne).
   node tools/langue/fiches.mjs --langue en [projet-vue projet-index]      (sans vidéo : toutes)
   Un code de la fiche qu'il faut traduire autrement que le moteur (« SAVEPOINT nom » : un nom de savepoint, pas celui d'un client) :
   data-<langue>="…" sur son <code>, dans index.html. */
import { args, serveur, navigateur } from './commun.mjs';

const {langue, videos} = args();
const srv = await serveur(), b = await navigateur();
const ctx = await b.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block'});
await ctx.route(u => !/^http:\/\/127\.0\.0\.1:\d+\//.test(String(u)) && !/^(data|blob):/.test(String(u)), r => r.fulfill({status: 404, body: ''}));
await ctx.addInitScript(l => { try { localStorage.setItem('requete-langue-essai', '1'); localStorage.setItem('requete-langue', l); } catch (e) {} }, langue);
const p = await ctx.newPage();
await p.goto(`${srv.base}/index.html?langue=${langue}`); await p.waitForFunction(() => typeof allLessons !== 'undefined' && window.REQUETE_LANGUE, null, {timeout: 30000});
const r = await p.evaluate(vids => {
  const L = window.REQUETE_LANGUE, out = [], avant = new Set(L.manquants());
  const lecons = allLessons.filter(l => l.video && vids.some(v => String(l.video.anim || '').includes('/' + v + '.html')));
  for (const l of lecons) {
    const d = document.createElement('div');
    const morceaux = [l.titre, l.résumé, l.studio.reflex && l.studio.reflex.extra].filter(Boolean).map(x => L.html(String(x)));
    d.innerHTML = morceaux.join(' ¶ ');
    out.push(`${l.id} | ${d.textContent.replace(/\s+/g, ' ').slice(0, 400)}`);
  }
  return {out, manque: L.manquants().filter(x => !avant.has(x))};   // seulement ce que ces fiches ont ajouté
}, videos);
r.out.forEach(x => console.log(x));
const fr = r.manque.filter(x => /[àâéèêîôûç’«»]/.test(x) || /\b(le|la|les|des|une|un|et|du|en|pour)\b/.test(x));
console.log(fr.length ? `\nÀ traduire dans langue-${langue}.js (${fr.length}) :\n` + fr.join('\n') : '\nRien ne manque.');
await b.close(); srv.close();
