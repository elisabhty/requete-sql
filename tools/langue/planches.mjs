/* 6 · Les planches : une vidéo en petites images (une toutes les 7 s), 16 par planche (8 × 2), pour la relire d'un coup d'œil.
   node tools/langue/planches.mjs --langue en projet-vue [--pas=7]
   → tools/langue/travail/<langue>/planches/<cours>-1.png, -2.png… */
import fs from 'node:fs';
import { args, serveur, navigateur, contexte, video, travail } from './commun.mjs';

const {langue, videos, options} = args(), pas = +(options.pas || 7);
const srv = await serveur(), b = await navigateur(), ctx = await contexte(b, langue, {echelle: 0.25});
fs.mkdirSync(travail(langue, 'planches'), {recursive: true});
for (const c of videos) {
  const {p, R} = await video(ctx, srv.base, c), images = [];
  for (let T = 1.5; T < R.duration; T += pas) { await p.evaluate(T => window.renderAt(T), T); await p.waitForTimeout(60); images.push((await p.screenshot()).toString('base64')); }
  /* Les images posées dans une page blanche, 8 par ligne, puis photographiées */
  const q = await ctx.newPage();
  for (let k = 0; k < images.length; k += 16) {
    const lot = images.slice(k, k + 16);
    await q.setViewportSize({width: 270 * 8, height: 480 * 2});
    await q.setContent(`<body style="margin:0;display:grid;grid-template-columns:repeat(8,270px);background:#fff">${lot.map(x => `<img src="data:image/png;base64,${x}" style="width:270px;height:480px">`).join('')}</body>`);
    await q.waitForTimeout(100);
    const f = travail(langue, 'planches', `${c}-${k / 16 + 1}.png`);
    await q.screenshot({path: f, clip: {x: 0, y: 0, width: 270 * 8, height: 480 * Math.ceil(lot.length / 8)}});
    console.log(f);
  }
  await q.close(); await p.close();
}
await b.close(); srv.close();
