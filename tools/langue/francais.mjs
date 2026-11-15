/* 5 · Le français n'a pas bougé : chaque vidéo, en français, comparée image par image (toutes les 2 s, au quart de sa taille) à
   la même vidéo d'une version de référence de Git (HEAD par défaut : le dernier commit ; --ref=<commit> pour une autre).
   À lancer après avoir branché une page (langues.js, data-table, data-en…) ou ajouté une règle html[lang="…"] : la vidéo
   française doit rester la même. 0 à 3 images différentes d'un pixel arrivent (le lissage des polices) ; au-delà, regarder.
   node tools/langue/francais.mjs projet-vue projet-index [--ref=HEAD~1]
   La version de référence est posée à part (git worktree, dans le dossier temporaire du système) puis retirée. */
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { args, serveur, navigateur, ROOT } from './commun.mjs';

const {videos, options} = args(), ref = options.ref || 'HEAD';
const sha = execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', ref]).toString().trim();
const dir = path.join(os.tmpdir(), 'requete-ref-' + sha);
execFileSync('git', ['-C', ROOT, 'worktree', 'add', '--detach', '--force', dir, sha], {stdio: 'ignore'});
const [ici, avant] = [await serveur(), await serveur(dir)];
const b = await navigateur();
let pb = 0;
try {
  for (const c of videos) {
    const pages = [];
    for (const s of [avant, ici]) {
      const ctx = await b.newContext({viewport: {width: 1080, height: 1920}, deviceScaleFactor: 0.25, serviceWorkers: 'block'});
      await ctx.route(u => !/^http:\/\/127\.0\.0\.1:\d+\//.test(String(u)) && !/^(data|blob):/.test(String(u)), r => r.fulfill({status: 404, body: ''}));
      const p = await ctx.newPage(); await p.goto(`${s.base}/assets/anim/${c}.html?app&embed`); await p.evaluate(() => window.__ready); pages.push(p);
    }
    const D = await pages[0].evaluate(() => window.__ready.then(r => r.duration));
    let diff = 0, n = 0; const ou = [];
    for (let T = 0.5; T < D; T += 2) {
      const im = [];
      for (const p of pages) { await p.evaluate(T => window.renderAt(T), T); await p.waitForTimeout(30); im.push((await p.screenshot()).toString('base64')); }
      n++; if (im[0] !== im[1]) { diff++; ou.push(T.toFixed(1)); }
    }
    const t = await Promise.all(pages.map(p => p.evaluate(D => { renderAt(D - 1); return document.getElementById('stage').innerText; }, D)));
    if (diff > 3 || t[0] !== t[1]) pb++;
    console.log(c, 'images', n, 'différentes', diff, ou.slice(0, 8).join(' '), '· texte', t[0] === t[1] ? 'identique' : 'DIFFÉRENT');
    for (const p of pages) await p.context().close();
  }
} finally {
  await b.close(); ici.close(); avant.close();
  execFileSync('git', ['-C', ROOT, 'worktree', 'remove', '--force', dir], {stdio: 'ignore'});
}
process.exitCode = pb ? 1 : 0;
