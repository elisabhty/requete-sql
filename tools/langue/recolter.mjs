/* 1 · Récolter : les textes d'une vidéo encore sans traduction dans la langue.
   La vidéo est jouée de bout en bout (une image toutes les 0,4 s), puis ses moments « À toi » (consignes, choix, corrections,
   indices) passent par le moteur ; REQUETE_LANGUE.manquants() donne tout ce qui n'a pas été trouvé.
   node tools/langue/recolter.mjs --langue en projet-vue projet-index      (ou « toutes »)
   → tools/langue/travail/<langue>/recolte/<cours>.json */
import fs from 'node:fs';
import { args, serveur, navigateur, contexte, video, travail, lire } from './commun.mjs';

const {langue, videos} = args();
const srv = await serveur(), b = await navigateur(), ctx = await contexte(b, langue);
fs.mkdirSync(travail(langue, 'recolte'), {recursive: true});
for (const c of videos) {
  if (!lire(`assets/anim/${c}.html`).includes('data-textes="{langue}/')) { console.log(`${c} : la page ne charge pas encore langues.js (voir README, étape 0)`); continue; }
  const {p, R, erreurs} = await video(ctx, srv.base, c);
  for (let T = 0; T <= R.duration; T += 0.4) await p.evaluate(T => window.renderAt(T), T);
  await p.evaluate(() => {
    const L = window.REQUETE_LANGUE, f = s => s && L.html(String(s));
    try { (typeof MOMENTS !== 'undefined' ? MOMENTS : []).forEach(m => { ['prompt', 'tip', 'hint', 'next', 'miss'].forEach(k => f(m[k]));
      (m.options || []).forEach(o => { f(o.label); f(o.why); f(o.say); }); (Array.isArray(m.spots) ? m.spots : []).forEach(s => { f(s.label); f(s.why); }); (m.controls || []).forEach(c => f(c.label)); }); } catch (e) {}
    try { (typeof OPENS !== 'undefined' ? OPENS : []).forEach(o => { f(o.prompt); f(o.label); }); } catch (e) {}
    /* Les commentaires du code (« -- Consulter la vue ») : traduits pendant le chargement, avant que le moteur ne remette sa liste
       à zéro ; on les repasse pour qu'un commentaire sans traduction soit noté. */
    document.querySelectorAll('.sq .ln, .sq .cm > i').forEach(el => { const m = /^\s*--\s*(.+?)\s*$/.exec(el.textContent || ''); if (m) L.t(m[1]); else if (el.matches('.cm > i')) L.t(el.textContent); });
  });
  const m = await p.evaluate(() => window.REQUETE_LANGUE.manquants());
  fs.writeFileSync(travail(langue, 'recolte', c + '.json'), JSON.stringify(m, null, 1));
  console.log(c, 'durée', Math.round(R.duration), 's', 'sans traduction', m.length, erreurs.length ? 'ERREURS ' + erreurs.slice(0, 3).join(' | ') : '');
  await p.close();
}
await b.close(); srv.close();
