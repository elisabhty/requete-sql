/* 7 · Les vignettes : la couverture de chaque vidéo dans la langue (le titre, le sous-titre, la bulle du chat), à 2,9 s,
   recadrée (40, 222 → 1080 × 1759) puis réduite à 720 × 947, en WebP (qualité 0,82) : assets/anim/<langue>/<cours>-thumb.webp.
   Puis, si la langue a déjà sa liste : la vidéo est ajoutée à LV_VIGNETTES (index.html) et au service worker (sw.js), avec son
   fichier de textes. Une langue nouvelle : créer d'abord sa liste dans LV_VIGNETTES (voir README).
   node tools/langue/vignettes.mjs --langue en projet-vue projet-index */
import fs from 'node:fs';
import path from 'node:path';
import { args, serveur, navigateur, contexte, video, ROOT, lire } from './commun.mjs';
import { versions } from './versions.mjs';

const {langue, videos} = args();
const srv = await serveur(), b = await navigateur(), ctx = await contexte(b, langue);
for (const c of videos) {
  const {p} = await video(ctx, srv.base, c);
  await p.evaluate(() => window.renderAt(2.9)); await p.waitForTimeout(300);
  const png = (await p.screenshot({clip: {x: 40, y: 222, width: 1040, height: 1537}})).toString('base64');
  /* La réduction et le WebP : par un canevas du navigateur (aucun outil d'image à installer) */
  const webp = await p.evaluate(async png => {
    const im = new Image(); im.src = 'data:image/png;base64,' + png; await im.decode();
    const cv = document.createElement('canvas'); cv.width = 720; cv.height = 947;
    const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, 720, 947);
    return cv.toDataURL('image/webp', 0.82).split(',')[1];
  }, png);
  const f = `assets/anim/${langue}/${c}-thumb.webp`;
  fs.mkdirSync(path.join(ROOT, `assets/anim/${langue}`), {recursive: true});
  fs.writeFileSync(path.join(ROOT, f), Buffer.from(webp, 'base64'));
  console.log(f, Math.round(fs.statSync(path.join(ROOT, f)).size / 1024), 'Ko');
  await p.close();
}
await b.close(); srv.close();

/* L'appli et le service worker */
let app = lire('index.html'), sw = lire('sw.js');
const m = new RegExp(`(const LV_VIGNETTES=\\{[^}]*?${langue}:\\[)([\\s\\S]*?)(\\])`).exec(app);
if (!m) console.log(`LV_VIGNETTES n'a pas encore de liste « ${langue} » : à créer dans index.html (voir README).`);
else {
  const neuves = videos.filter(c => !m[2].includes(`'${c}'`));
  if (neuves.length) { app = app.replace(m[0], m[1] + m[2] + `,\n  ${neuves.map(c => `'${c}'`).join(',')}` + m[3]); fs.writeFileSync(path.join(ROOT, 'index.html'), app); }
  console.log('LV_VIGNETTES :', neuves.length ? '+ ' + neuves.join(', ') : 'déjà à jour');
}
const ajouts = [];
/* Les textes d’une vidéo : quelle que soit leur version (versions.mjs met l’empreinte juste après) */
for (const c of videos) for (const g of [`./assets/anim/${langue}/${c}.js?v=1`, `./assets/anim/${langue}/${c}-thumb.webp`]) if (!sw.includes(`'${g}'`) && !(g.endsWith('.js?v=1') && sw.includes(`'${g.slice(0, -2)}`))) ajouts.push(g);
if (ajouts.length) {
  /* Après le dernier fichier de la langue déjà listé, sinon après la dernière vignette française */
  const tous = [...sw.matchAll(new RegExp(`\\n  '\\./assets/anim/${langue}/[^']+',`, 'g'))], dernier = tous.length ? tous[tous.length - 1] : null;
  const ici = dernier ? dernier.index + dernier[0].length : sw.lastIndexOf("-thumb.webp',") + "-thumb.webp',".length;
  sw = sw.slice(0, ici) + ajouts.map(g => `\n  '${g}',`).join('') + sw.slice(ici);
  fs.writeFileSync(path.join(ROOT, 'sw.js'), sw);
}
console.log('sw.js :', ajouts.length ? '+ ' + ajouts.length + ' fichiers' : 'déjà à jour');
const nv = versions(); if (nv.length) console.log(`${nv.length} adresses de fichiers de langue mises à jour (versions.mjs)`);
