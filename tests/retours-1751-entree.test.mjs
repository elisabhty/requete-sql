// L’entrée dans l’appli iOS (Elisa, 12 novembre, 17 h 51, sa capture de l’écran de lancement : « Améliore cette entrée stp en plus
// j’ai l’impression que ça bug au début »).
// 1. L’écran de lancement n’est plus un semis de points sur un fond vide : au centre, les seize emplacements de la touche, en clair,
//    là où les points vont se poser (les mêmes vues dans la page et dans LaunchScreen.storyboard).
// 2. Le début : le vol des cases, la soudure et les lettres n’animent plus que transform et opacity ; WebKit ne les joue hors du fil
//    principal (occupé par le démarrage) qu’à cette condition.
// 3. La barre d’état est sombre dès l’écran de lancement.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), css = lire('ludique.css'), sb = lire('resources/ios/LaunchScreen.storyboard'), py = lire('tools/ecran-lancement.py'), sh = lire('scripts/ios-ecran-lancement.sh');
const bloc = css.slice(css.indexOf('/* ---------- 37 bis.'), css.indexOf('/* Si le moteur SQL ne se charge pas'));
const images = nom => { const i = bloc.indexOf('@keyframes ' + nom + '{'); assert.ok(i > 0, nom); let n = 0, j = i; do { const c = bloc[j++]; if (c === '{') n++; else if (c === '}') n--; } while (n > 0 || bloc[j - 1] !== '}'); return bloc.slice(i, j); };
const n = v => String(+v.toFixed(6));

test('les seize emplacements de la touche : dans la page, aux places exactes des cases', () => {
  assert.ok(app.includes(`for(var sc=0;sc<4;sc++)for(var sr=0;sr<4;sr++)h+='<i class="in-s" aria-hidden="true" style="--c:'+sc+';--r:'+sr+'"></i>';`));
  assert.ok(app.indexOf('class="in-s"') < app.indexOf("L.insertAdjacentHTML('afterbegin',h);"), 'posés avec les points, avant la première image');
  const regle = 'html.is-native.lq #loader.is-intro .in-s{position:absolute;z-index:0;left:calc(50% + (var(--c)*128 - 248)*var(--u));top:calc(var(--cy) + (var(--r)*128 - 248)*var(--u));\n  width:calc(112*var(--u));height:calc(112*var(--u));background:#E9E4FA}';
  assert.ok(bloc.includes(regle));
  assert.ok(bloc.includes('html.is-native.lq #loader.is-intro .in-k{position:absolute;z-index:1;left:calc(50% + (var(--c)*128 - 248)*var(--u));top:calc(var(--cy) + (var(--r)*128 - 248)*var(--u));'), 'même place que les cases');
  assert.ok(bloc.includes('html.is-native.lq #loader.is-intro.is-play .in-s{animation:introFade 90ms linear var(--t-soude) forwards}'), 'ils s’effacent à la soudure');
  /* Aucun point de l’écran de lancement ne tombe sur la grille (elle fait 496 unités de côté, autour du centre) */
  const POINTS = JSON.parse(app.match(/var POINTS=(\[\[[\d.,\[\]\s]+\]\]);/)[1].replace(/\s+/g, ''));
  for (const [w, h] of [[375, 667], [393, 852], [440, 956]]) {
    const u = h / 2732, cy = h / 2 - 14 * u;
    for (const [x, y] of POINTS) assert.ok(Math.abs(x * w - w / 2) > 248 * u + 15 * u || Math.abs(y * h - cy) > 248 * u + 15 * u, `point ${x},${y} sur la grille (${w}×${h})`);
  }
});

test('les seize emplacements : les mêmes vues dans l’écran de lancement, sans image', () => {
  assert.ok(!sb.includes('<imageView') && !sb.includes('<resources>') && !sb.includes('userDefinedRuntimeAttribute'));
  assert.ok(sb.includes('<view userInteractionEnabled="NO" contentMode="scaleToFill" translatesAutoresizingMaskIntoConstraints="NO" id="gRl-eM-plc" userLabel="Emplacements de la touche">'));
  /* La grille : centrée, 14 unités au-dessus du milieu (--cy), 496/2732 du plus grand côté, carrée, transparente */
  for (const c of ['<constraint firstItem="gRl-eM-plc" firstAttribute="centerX" secondItem="Ze5-6b-2t3" secondAttribute="centerX" id="gRl-Cx-eMp"/>',
    `<constraint firstItem="gRl-eM-plc" firstAttribute="centerY" secondItem="Ze5-6b-2t3" secondAttribute="centerY" multiplier="${n(1 - 28 / 2732)}" id="gRl-Cy-eMp"/>`,
    `<constraint firstItem="gRl-eM-plc" firstAttribute="height" relation="greaterThanOrEqual" secondItem="Ze5-6b-2t3" secondAttribute="height" multiplier="${n(496 / 2732)}" id="gRl-M0-eMp"/>`,
    `<constraint firstItem="gRl-eM-plc" firstAttribute="height" secondItem="Ze5-6b-2t3" secondAttribute="width" multiplier="${n(496 / 2732)}" priority="999" id="gRl-E1-eMp"/>`,
    '<constraint firstAttribute="width" secondItem="gRl-eM-plc" secondAttribute="height" id="gRl-Ar-eMp"/>',
    '<color key="backgroundColor" white="0.0" alpha="0.0" colorSpace="custom" customColorSpace="genericGamma22GrayColorSpace"/>']) assert.ok(sb.includes(c), c);
  const vues = [...sb.matchAll(/id="(S\d\d-eM-plc)" userLabel="Emplacement (\d+)">/g)];
  assert.equal(vues.length, 16);
  for (let col = 0; col < 4; col++) for (let r = 0; r < 4; r++) {
    const k = col * 4 + r, id = `S${String(k).padStart(2, '0')}-eM-plc`;
    assert.ok(sb.includes(`<constraint firstItem="${id}" firstAttribute="centerX" secondItem="gRl-eM-plc" secondAttribute="centerX" multiplier="${n(2 * (col * 128 + 56) / 496)}"`), id + ' x');
    assert.ok(sb.includes(`<constraint firstItem="${id}" firstAttribute="centerY" secondItem="gRl-eM-plc" secondAttribute="centerY" multiplier="${n(2 * (r * 128 + 56) / 496)}"`), id + ' y');
    assert.ok(sb.includes(`<constraint firstItem="${id}" firstAttribute="width" secondItem="gRl-eM-plc" secondAttribute="width" multiplier="${n(112 / 496)}"`), id + ' côté');
  }
  /* #E9E4FA, comme .in-s ; la grille vient avant les points (dessous) */
  assert.equal((sb.match(/<color key="backgroundColor" red="0.913725" green="0.894118" blue="0.980392" alpha="1" colorSpace="custom" customColorSpace="sRGB"\/>/g) || []).length, 16);
  assert.ok(sb.indexOf('id="gRl-eM-plc"') < sb.indexOf('id="P00-dD-pnt"'));
  assert.ok(py.includes("CASE = (0xE9, 0xE4, 0xFA)") && py.includes('GRILLE = 496 / 2732'));
});

test('le début sans à-coups : le vol, la soudure et les lettres n’animent que transform et opacity', () => {
  for (const nom of ['introCase', 'introSoude', 'introLettre', 'introLettreTxt', 'introVoile', 'introNombre', 'introLettreDot']) {
    const k = images(nom).replace(/animation-timing-function:[^;}]+/g, '');
    const props = new Set([...k.matchAll(/[{;]\s*([a-z-]+)\s*:/g)].map(m => m[1]));
    for (const p of props) assert.ok(p === 'transform' || p === 'opacity', `${nom} anime ${p}`);
  }
  /* Les coins et l’épaisseur changent d’un coup, dans une animation à part d’une milliseconde */
  assert.equal(images('introCoins'), '@keyframes introCoins{to{border-radius:var(--rf);box-shadow:0 calc(8*var(--u)) 0 var(--ombre,#4B30CC)}}');
  assert.ok(bloc.includes('introCoins 1ms linear var(--t-soude) forwards,introFade 1ms linear var(--t-fin) forwards}'));
  /* Le caractère a son <b> : il apparaît en opacité pendant que son point reste visible */
  assert.ok(app.includes(`return '<span class="in-l" aria-hidden="true" style="--i:'+i+'"><b>'+c+'</b></span>';`));
  assert.ok(bloc.includes('html.is-native.lq #loader.is-intro .in-l>b{display:inline-block;font:inherit;opacity:0}'));
  assert.ok(bloc.includes('html.is-native.lq #loader.is-intro.is-play .in-l>b{animation:introLettreTxt var(--v) linear var(--a) both}'));
  assert.ok(!/color:rgba\(27,22,64,0\)/.test(bloc), 'plus de couleur animée sur les lettres');
});

test('la barre d’état est sombre dès l’écran de lancement', () => {
  assert.ok(sh.includes('/usr/libexec/PlistBuddy -c "Set :UIStatusBarStyle UIStatusBarStyleDarkContent" "$plist" 2>/dev/null'));
  assert.ok(sh.includes('|| /usr/libexec/PlistBuddy -c "Add :UIStatusBarStyle string UIStatusBarStyleDarkContent" "$plist"'));
  assert.ok(sh.includes('if [ -f "$plist" ] && [ -x /usr/libexec/PlistBuddy ]; then'), 'sans Info.plist ou hors du Mac, rien ne casse');
});
