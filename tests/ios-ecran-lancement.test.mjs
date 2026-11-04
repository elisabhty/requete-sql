/* Retours de 23 h 02 (Elisa, 3 novembre), sur l’appli installée par TestFlight : « Quand j’ouvre l’appli, il y a un écran
   noir. Et après, il y a l’onboarding. » L’écran de lancement d’iOS étirait une image de 2732 × 2732 px (à toutes les
   échelles) sur un fond « couleur système » : trop lourde pour l’écran de lancement, iOS ne la dessinait pas et laissait
   le fond, noir en mode sombre. Il est remplacé par un fond lavande fixe et la seule touche >_, petite image posée au centre,
   à la taille et à la place exactes de la première image de l’ouverture animée (ludique.css, 37 bis). Le dossier ios/
   n’étant pas dans Git, la version de référence est dans resources/ios et un script la recopie avant chaque envoi. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync, spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const lire = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const sb = lire('resources/ios/LaunchScreen.storyboard');
const css = lire('ludique.css');

/* Petit lecteur de PNG (8 bits, RVB ou RVBA, non entrelacé) : de quoi vérifier les pixels sans dépendance */
function png(file) {
  const buf = fs.readFileSync(new URL(file, root));
  assert.equal(buf.toString('latin1', 1, 4), 'PNG', file);
  let off = 8, w = 0, h = 0, type = 0; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), kind = buf.toString('latin1', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); assert.equal(data[8], 8); type = data[9]; assert.equal(data[12], 0); }
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    off += 12 + len;
  }
  const ch = { 2: 3, 6: 4 }[type]; assert.ok(ch, `${file} : RVB ou RVBA`);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[dst + x - ch] : 0, b = y ? px[dst - stride + x] : 0, c = x >= ch && y ? px[dst - stride + x - ch] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[dst + x] = v & 255;
    }
  }
  const at = (x, y) => { const i = (y * w + x) * ch; return [px[i], px[i + 1], px[i + 2], ch === 4 ? px[i + 3] : 255]; };
  return { w, h, ch, at, bytes: buf.length };
}
const proche = (p, q, tol = 6) => p.slice(0, 3).every((v, i) => Math.abs(v - q[i]) <= tol);

test('Écran de lancement : fond lavande fixe, plus d’image géante ni de couleur système', () => {
  assert.ok(sb.includes('launchScreen="YES"') && sb.includes('initialViewController="01J-lp-oVM"') && sb.includes('<viewController id="01J-lp-oVM"'));
  assert.ok(!sb.includes('systemBackgroundColor') && !sb.includes('systemColor='), 'pas de couleur qui devient noire en mode sombre');
  assert.ok(!sb.includes('image="Splash"') && !sb.includes('name="Splash"'), 'plus l’image de 2732 px');
  assert.ok(!sb.includes('<imageView key="view"'), 'la vue de base n’est plus l’image');
  assert.ok(sb.includes('<view key="view" contentMode="scaleToFill" id="Ze5-6b-2t3">'));
  /* #F4F2FC, comme le fond de l’ouverture animée et le backgroundColor de capacitor.config.json */
  assert.ok(sb.includes('<color key="backgroundColor" red="0.95686274509803926" green="0.94901960784313721" blue="0.9882352941176471" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>'));
  assert.equal(Math.round(0.95686274509803926 * 255), 0xF4); assert.equal(Math.round(0.94901960784313721 * 255), 0xF2); assert.equal(Math.round(0.9882352941176471 * 255), 0xFC);
  assert.ok(css.includes('html.is-native.lq #loader.is-intro{position:fixed;inset:0;z-index:2147483000;display:block;padding:0;background:#F4F2FC!important;'));
  const cap = JSON.parse(lire('capacitor.config.json'));
  assert.equal(cap.ios.backgroundColor, '#F4F2FC'); assert.equal(cap.plugins.SplashScreen.backgroundColor, '#F4F2FC');
  /* Un XML bien formé : chaque balise ouverte est refermée, identifiants uniques */
  const pile = [];
  for (const m of sb.replace(/<\?xml[^>]*\?>/, '').replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([A-Za-z]+)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) assert.equal(pile.pop(), m[2], `balise ${m[2]} mal refermée`); else pile.push(m[2]);
  }
  assert.deepEqual(pile, []);
  const ids = [...sb.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
});

test('Écran de lancement : la touche au centre, à 540/2732 du plus grand côté, comme dans splash.png et l’ouverture animée', () => {
  const img = sb.match(/<imageView [^>]*>/)[0];
  for (const a of ['image="SplashLogo"', 'contentMode="scaleAspectFit"', 'translatesAutoresizingMaskIntoConstraints="NO"', 'id="Rq1-Lg-0Ky"',
    'verticalCompressionResistancePriority="100"', 'horizontalCompressionResistancePriority="100"']) assert.ok(img.includes(a), a);
  assert.ok(sb.includes('<image name="SplashLogo" width="256" height="270"/>'));
  const c = (s) => assert.ok(sb.includes(s), s);
  c('<constraint firstAttribute="width" secondItem="Rq1-Lg-0Ky" secondAttribute="height" multiplier="512:540" id="Rq1-Ar-0Ky"/>');
  c('<constraint firstItem="Rq1-Lg-0Ky" firstAttribute="centerX" secondItem="Ze5-6b-2t3" secondAttribute="centerX" id="Rq1-Cx-0Ky"/>');
  c('<constraint firstItem="Rq1-Lg-0Ky" firstAttribute="centerY" secondItem="Ze5-6b-2t3" secondAttribute="centerY" id="Rq1-Cy-0Ky"/>');
  /* Le plus grand des deux côtés (comme max(100vw,100vh) dans la page, et l’image carrée « remplie » d’avant) : deux minimums
     obligatoires et deux égalités presque obligatoires, dont seule la plus grande peut tenir */
  for (const cote of ['height', 'width']) {
    c(`<constraint firstItem="Rq1-Lg-0Ky" firstAttribute="height" relation="greaterThanOrEqual" secondItem="Ze5-6b-2t3" secondAttribute="${cote}" multiplier="0.19765739"`);
    c(`<constraint firstItem="Rq1-Lg-0Ky" firstAttribute="height" secondItem="Ze5-6b-2t3" secondAttribute="${cote}" multiplier="0.19765739" priority="999"`);
  }
  assert.ok(Math.abs(540 / 2732 - 0.19765739) < 1e-8);
  /* La page : unité = plus grand côté / 2732, touche de 512, socle 28 plus bas, l’ensemble (540) centré */
  assert.ok(css.includes('--u:calc(max(100vw,100vh) / 2732);--cy:calc(50% - 14*var(--u))'));
  assert.ok(css.includes('width:calc(512*var(--u));height:calc(512*var(--u));\n  margin:calc(-270*var(--u)) 0 0 calc(-256*var(--u));'), 'touche : de -270 à +242');
  assert.ok(css.includes('margin:calc(-242*var(--u)) 0 0 calc(-256*var(--u));border-radius:calc(116*var(--u));background:#4B30CC'), 'socle : de -242 à +270');
  /* splash.png, la référence : la touche et son socle font 512 × 540 et sont centrés */
  const sp = png('resources/splash.png'), fond = sp.at(5, 5);
  assert.equal(sp.w, 2732); assert.ok(proche(fond, [0xF4, 0xF2, 0xFC], 1));
  const ligne = (y) => { let a = -1, b = -1; for (let x = 0; x < sp.w; x++) if (!proche(sp.at(x, y), fond, 30)) { if (a < 0) a = x; b = x; } return [a, b]; };
  const col = (x) => { let a = -1, b = -1; for (let y = 0; y < sp.h; y++) if (!proche(sp.at(x, y), fond, 30)) { if (a < 0) a = y; b = y; } return [a, b]; };
  assert.deepEqual(ligne(1366), [1110, 1621]); assert.deepEqual(col(1366), [1096, 1635]);
  assert.equal((1110 + 1621 + 1) / 2, 2732 / 2); assert.equal((1096 + 1635 + 1) / 2, 2732 / 2);
});

test('Image de la touche : trois échelles légères, fond transparent, identique à splash.png', () => {
  const man = JSON.parse(lire('resources/ios/SplashLogo.imageset/Contents.json'));
  assert.deepEqual(man.images.map(i => [i.filename, i.idiom, i.scale]),
    [['splash-logo@1x.png', 'universal', '1x'], ['splash-logo@2x.png', 'universal', '2x'], ['splash-logo@3x.png', 'universal', '3x']]);
  for (const [n, k] of [[1, 0.5], [2, 1], [3, 1.5]]) {
    const im = png(`resources/ios/SplashLogo.imageset/splash-logo@${n}x.png`);
    assert.deepEqual([im.w, im.h], [512 * k, 540 * k], `@${n}x : 256 × 270 points`);
    assert.equal(im.ch, 4); assert.ok(im.bytes < 150000, `@${n}x : ${im.bytes} octets`);
    for (const [x, y] of [[0, 0], [im.w - 1, 0], [0, im.h - 1], [im.w - 1, im.h - 1]]) assert.equal(im.at(x, y)[3], 0, 'coins transparents');
    const s = (x, y) => im.at(Math.round(x * k), Math.round(y * k));
    assert.ok(proche(s(256, 100), [0x75, 0x56, 0xF7], 14) && s(256, 100)[3] === 255, 'dégradé violet');
    assert.ok(proche(s(256, 528), [0x4B, 0x30, 0xCC], 4), 'socle');
    assert.ok(proche(s(317, 314), [255, 255, 255], 2), 'curseur blanc');
    assert.ok(proche(s(189, 205), [255, 255, 255], 2), 'chevron blanc');
  }
  const sp = png('resources/splash.png'), lg = png('resources/ios/SplashLogo.imageset/splash-logo@2x.png');
  let somme = 0;
  for (let y = 0; y < 540; y++) for (let x = 0; x < 512; x++) {
    const a = lg.at(x, y), b = sp.at(1110 + x, 1096 + y), al = a[3] / 255;
    for (let i = 0; i < 3; i++) somme += Math.abs(a[i] * al + [0xF4, 0xF2, 0xFC][i] * (1 - al) - b[i]);
  }
  assert.ok(somme / (512 * 540 * 3) < 2, `écart moyen avec splash.png : ${(somme / (512 * 540 * 3)).toFixed(2)}`);
});

test('Script : recopie l’écran de lancement dans le projet iOS, avant chaque ouverture et chaque envoi', () => {
  const sh = lire('scripts/ios-ecran-lancement.sh');
  assert.ok(sh.startsWith('#!/bin/bash') && sh.includes('set -euo pipefail'));
  assert.ok(fs.statSync(new URL('scripts/ios-ecran-lancement.sh', root)).mode & 0o100, 'exécutable');
  const pkg = JSON.parse(lire('package.json')).scripts;
  assert.equal(pkg['ios:testflight'], 'npm run build:www && npx cap sync ios && bash scripts/ios-ecran-lancement.sh && node scripts/ios-widget.mjs && bash scripts/ios-testflight.sh');
  assert.equal(pkg.ios, 'npm run build:www && npx cap sync ios && bash scripts/ios-ecran-lancement.sh && node scripts/ios-widget.mjs && npx cap open ios');
  assert.equal(pkg['ios:add'], 'npm run build:www && npx cap add ios && bash scripts/ios-ecran-lancement.sh && node scripts/ios-widget.mjs');
  /* Dans un faux dépôt : il remplace l’ancien storyboard, ajoute l’image, et s’arrête net s’il n’y a pas de projet iOS */
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'rq-lancement-'));
  try {
    const app = path.join(t, 'ios/App/App');
    fs.mkdirSync(path.join(t, 'scripts')); fs.mkdirSync(path.join(app, 'Base.lproj'), { recursive: true });
    fs.mkdirSync(path.join(app, 'Assets.xcassets/Splash.imageset'), { recursive: true });
    fs.copyFileSync(new URL('scripts/ios-ecran-lancement.sh', root), path.join(t, 'scripts/ios-ecran-lancement.sh'));
    fs.cpSync(new URL('resources/ios', root), path.join(t, 'resources/ios'), { recursive: true });
    fs.writeFileSync(path.join(app, 'Base.lproj/LaunchScreen.storyboard'), 'ancien');
    const out = execFileSync('bash', [path.join(t, 'scripts/ios-ecran-lancement.sh')], { encoding: 'utf8' });
    assert.ok(out.includes('Écran de lancement à jour'));
    assert.equal(fs.readFileSync(path.join(app, 'Base.lproj/LaunchScreen.storyboard'), 'utf8'), sb);
    assert.deepEqual(fs.readdirSync(path.join(app, 'Assets.xcassets/SplashLogo.imageset')).sort(),
      ['Contents.json', 'splash-logo@1x.png', 'splash-logo@2x.png', 'splash-logo@3x.png']);
    assert.ok(fs.existsSync(path.join(app, 'Assets.xcassets/Splash.imageset')), 'le reste du projet n’est pas touché');
    fs.rmSync(path.join(t, 'ios'), { recursive: true });
    const sans = spawnSync('bash', [path.join(t, 'scripts/ios-ecran-lancement.sh')], { encoding: 'utf8' });
    assert.equal(sans.status, 1); assert.ok(sans.stderr.includes('npm run ios:add'));
  } finally { fs.rmSync(t, { recursive: true, force: true }); }
  const ios = lire('IOS.md');
  assert.ok(ios.includes('resources/ios/LaunchScreen.storyboard') && ios.includes('scripts/ios-ecran-lancement.sh') && ios.includes('redémarrer l’iPhone'));
});
