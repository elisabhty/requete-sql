/* Retours de 23 h 02 (Elisa, 3 novembre), sur l’appli installée par TestFlight : « Quand j’ouvre l’appli, il y a un écran
   noir. Et après, il y a l’onboarding. » L’écran de lancement d’iOS étirait une image de 2732 × 2732 px (à toutes les
   échelles) sur un fond « couleur système » : trop lourde pour l’écran de lancement, iOS ne la dessinait pas et laissait
   le fond, noir en mode sombre. Il est remplacé par un fond lavande fixe et la seule touche >_, petite image posée au centre,
   à la taille et à la place exactes de la première image de l’ouverture animée (ludique.css, 37 bis). Le dossier ios/
   n’étant pas dans Git, la version de référence est dans resources/ios et un script la recopie avant chaque envoi.
   11 novembre, 13 h 10 (« Le logo se construit ») : la touche a laissé place à 23 points de données, sans image. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const lire = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const sb = lire('resources/ios/LaunchScreen.storyboard');
const css = lire('ludique.css');


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

/* 11 novembre, 13 h 10 (« Le logo se construit ») : plus d’image du tout ; 23 points de données, aux places exactes de la première
   image de l’ouverture animée (POINTS, dans le script qui suit #loader), écrits par tools/ecran-lancement.py */
const app = lire('index.html');
const POINTS = JSON.parse(app.match(/var POINTS=(\[\[[\d.,\[\]\s]+\]\]);/)[1].replace(/\s+/g, ''));

test('Écran de lancement : plus d’image, 23 points carrés aux fractions de l’écran où l’ouverture les dessine', () => {
  assert.ok(!sb.includes('<imageView') && !sb.includes('image=') && !sb.includes('<resources>'), 'aucune image (l’écran noir du 3 novembre venait d’une image trop lourde)');
  assert.ok(!sb.includes('userDefinedRuntimeAttribute'), 'rien que les écrans de lancement refusent');
  assert.equal(POINTS.length, 23);
  const vues = [...sb.matchAll(/<view userInteractionEnabled="NO" contentMode="scaleToFill" translatesAutoresizingMaskIntoConstraints="NO" id="(P\d\d-dD-pnt)" userLabel="Point (\d+)">/g)];
  assert.equal(vues.length, 23);
  const c = (x) => assert.ok(sb.includes(x), x);
  const n = (v) => String(+v.toFixed(6));
  POINTS.forEach(([x, y], i) => {
    const id = vues[i][1];
    assert.equal(id, `P${String(i).padStart(2, '0')}-dD-pnt`);
    /* centre = centre de l’écran × 2x : x × la largeur, y × la hauteur, comme left:x% et top:y% dans la page */
    c(`<constraint firstItem="${id}" firstAttribute="centerX" secondItem="Ze5-6b-2t3" secondAttribute="centerX" multiplier="${n(2 * x)}"`);
    c(`<constraint firstItem="${id}" firstAttribute="centerY" secondItem="Ze5-6b-2t3" secondAttribute="centerY" multiplier="${n(2 * y)}"`);
    /* côté : 30/2732 du plus grand côté de l’écran, comme 30 × --u dans la page ; carré */
    for (const cote of ['height', 'width']) {
      c(`<constraint firstItem="${id}" firstAttribute="height" relation="greaterThanOrEqual" secondItem="Ze5-6b-2t3" secondAttribute="${cote}" multiplier="${n(30 / 2732)}"`);
      c(`<constraint firstItem="${id}" firstAttribute="height" secondItem="Ze5-6b-2t3" secondAttribute="${cote}" multiplier="${n(30 / 2732)}" priority="999"`);
    }
    c(`<constraint firstAttribute="width" secondItem="${id}" secondAttribute="height" id="c${String(i).padStart(2, '0')}-Ar-dDt"/>`);
    assert.ok(x > 0.06 && x < 0.94 && y > 0.07 && y < 0.93, `point ${i + 1} dans l’écran, loin de l’île et de la barre du bas`);
  });
  /* #D2C6F7, comme .in-d */
  assert.equal((sb.match(/<color key="backgroundColor" red="0.823529" green="0.776471" blue="0.968627" alpha="1" colorSpace="custom" customColorSpace="sRGB"\/>/g) || []).length, 23);
  assert.ok(css.includes('html.is-native.lq #loader.is-intro .in-d{position:absolute;z-index:0;width:calc(30*var(--u));height:calc(30*var(--u));\n  margin:calc(-15*var(--u)) 0 0 calc(-15*var(--u));background:#D2C6F7}'));
  assert.ok(app.includes("h+='<i class=\"in-d\" aria-hidden=\"true\" style=\"left:'+(POINTS[i][0]*100).toFixed(2)+'%;top:'+(POINTS[i][1]*100).toFixed(2)+'%\"></i>';"));
  /* Le générateur réécrit exactement ce fichier */
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'rq-points-'));
  try {
    fs.mkdirSync(path.join(t, 'tools')); fs.mkdirSync(path.join(t, 'resources/ios'), { recursive: true });
    fs.copyFileSync(new URL('tools/ecran-lancement.py', root), path.join(t, 'tools/ecran-lancement.py'));
    fs.copyFileSync(new URL('index.html', root), path.join(t, 'index.html'));
    execFileSync('python3', [path.join(t, 'tools/ecran-lancement.py')], { encoding: 'utf8' });
    assert.equal(fs.readFileSync(path.join(t, 'resources/ios/LaunchScreen.storyboard'), 'utf8'), sb, 'à jour avec POINTS');
  } finally { fs.rmSync(t, { recursive: true, force: true }); }
});

test('Script : recopie l’écran de lancement dans le projet iOS, avant chaque ouverture et chaque envoi', () => {
  const sh = lire('scripts/ios-ecran-lancement.sh');
  assert.ok(sh.startsWith('#!/bin/bash') && sh.includes('set -euo pipefail'));
  assert.ok(fs.statSync(new URL('scripts/ios-ecran-lancement.sh', root)).mode & 0o100, 'exécutable');
  const pkg = JSON.parse(lire('package.json')).scripts;
  assert.equal(pkg['ios:testflight'], 'npm run build:www && npx cap sync ios && bash scripts/ios-ecran-lancement.sh && node scripts/ios-widget.mjs && bash scripts/ios-testflight.sh');
  assert.equal(pkg.ios, 'npm run build:www && npx cap sync ios && bash scripts/ios-ecran-lancement.sh && node scripts/ios-widget.mjs && npx cap open ios');
  assert.equal(pkg['ios:add'], 'npm run build:www && npx cap add ios && bash scripts/ios-ecran-lancement.sh && node scripts/ios-widget.mjs');
  /* Dans un faux dépôt : il remplace l’ancien storyboard, retire l’ancienne image de la touche, et s’arrête net s’il n’y a pas de projet iOS */
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'rq-lancement-'));
  try {
    const app = path.join(t, 'ios/App/App');
    fs.mkdirSync(path.join(t, 'scripts')); fs.mkdirSync(path.join(app, 'Base.lproj'), { recursive: true });
    fs.mkdirSync(path.join(app, 'Assets.xcassets/Splash.imageset'), { recursive: true });
    fs.mkdirSync(path.join(app, 'Assets.xcassets/SplashLogo.imageset'), { recursive: true });
    fs.writeFileSync(path.join(app, 'Assets.xcassets/SplashLogo.imageset/Contents.json'), '{}');
    fs.copyFileSync(new URL('scripts/ios-ecran-lancement.sh', root), path.join(t, 'scripts/ios-ecran-lancement.sh'));
    fs.cpSync(new URL('resources/ios', root), path.join(t, 'resources/ios'), { recursive: true });
    fs.writeFileSync(path.join(app, 'Base.lproj/LaunchScreen.storyboard'), 'ancien');
    const out = execFileSync('bash', [path.join(t, 'scripts/ios-ecran-lancement.sh')], { encoding: 'utf8' });
    assert.ok(out.includes('Écran de lancement à jour : fond lavande, points de données.'));
    assert.equal(fs.readFileSync(path.join(app, 'Base.lproj/LaunchScreen.storyboard'), 'utf8'), sb);
    assert.ok(!fs.existsSync(path.join(app, 'Assets.xcassets/SplashLogo.imageset')), 'l’image de la touche ne sert plus');
    assert.ok(fs.existsSync(path.join(app, 'Assets.xcassets/Splash.imageset')), 'le reste du projet n’est pas touché');
    fs.rmSync(path.join(t, 'ios'), { recursive: true });
    const sans = spawnSync('bash', [path.join(t, 'scripts/ios-ecran-lancement.sh')], { encoding: 'utf8' });
    assert.equal(sans.status, 1); assert.ok(sans.stderr.includes('npm run ios:add'));
  } finally { fs.rmSync(t, { recursive: true, force: true }); }
  assert.ok(!fs.existsSync(new URL('resources/ios/SplashLogo.imageset', root)));
  const ios = lire('IOS.md');
  assert.ok(ios.includes('resources/ios/LaunchScreen.storyboard') && ios.includes('scripts/ios-ecran-lancement.sh') && ios.includes('redémarrer l’iPhone'));
});
