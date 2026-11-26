// 26 novembre, 11 h 25 (Elisa, sur son Samsung, version 32 de Google Play) : « le logo du début est trop flou ».
// Android 12 et plus montre au lancement l'icône dans un cercle de 192 dp ; elle venait de l'icône du téléphone, tirée d'une image
// de 144 px (xxhdpi), donc agrandie plus de trois fois. L'écran de lancement a maintenant sa propre image, nette à chaque densité,
// et le premier plan de l'icône du téléphone est tiré à sa vraie taille (72 dp, le centre de l'icône adaptative).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const res = new URL('../android/app/src/main/res/', import.meta.url);
const taille = f => { const b = readFileSync(new URL(f, res)); assert.equal(b.toString('latin1', 1, 4), 'PNG', f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

test('Android : l’écran de lancement a sa propre icône, à la bonne taille pour chaque densité', () => {
  const s = readFileSync(new URL('values/styles.xml', res), 'utf8');
  const lancement = s.slice(s.indexOf('name="AppTheme.NoActionBarLaunch"'));
  assert.match(lancement, /<item name="windowSplashScreenAnimatedIcon">@drawable\/splash_icone<\/item>/);
  for (const [d, k] of Object.entries(DENS)) {
    assert.deepEqual(taille(`drawable-${d}/splash_icone.png`), [288 * k, 288 * k], d);
  }
});

test('Android : l’icône du téléphone est tirée à 72 dp (le centre de l’icône adaptative), plus à 48', () => {
  for (const [d, k] of Object.entries({ ldpi: 0.75, ...DENS })) {
    assert.deepEqual(taille(`mipmap-${d}/ic_launcher_foreground.png`), [72 * k, 72 * k], d);
  }
  const a = readFileSync(new URL('mipmap-anydpi-v26/ic_launcher.xml', res), 'utf8');
  assert.ok(a.includes('<inset android:drawable="@mipmap/ic_launcher_foreground" android:inset="16.7%" />'), 'le logo reste dans le centre');
});

// 26 novembre, 11 h 34 (Elisa, sa photo du Samsung) : « la page Requête “on explore le monde des données” n’est pas centrée ».
// Sur Android, la barre du haut est fine et le bas gardait l'écart prévu pour l'iPhone, plus les 48 px des boutons d'Android : tout
// remontait contre l'heure. Android seulement ; l'iPhone ne change pas.
test('Android : les boutons du bas posés à 20 px de la barre d’Android, la page « bonjour » centrée', () => {
  const css = readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');
  const regle = 'html.is-android #onboarding.ob-vitrine :where(.ob-foot){padding-bottom:calc(var(--safe-bottom,0px) + 20px)!important}';
  assert.ok(css.includes(regle));
  assert.ok(css.indexOf(regle) > css.indexOf('html #onboarding.ob-vitrine .ob-foot{padding-bottom:calc(var(--safe-bottom,0px) + max(12px,'), 'après la règle générale, qu’elle remplace sur Android');
  assert.ok(css.includes('html.is-android #onboarding.ob-vitrine.ob-bonjour-step #ob-foot-note:empty{display:none}'));
  // Les écrans qui ont leur propre bas le gardent : leurs règles pèsent plus que :where(.ob-foot).
  assert.ok(css.includes('html #onboarding.ob-vitrine.ob-paywall-step .ob-foot{padding-top:10px!important;padding-bottom:calc(var(--safe-bottom,0px) + 12px)!important}'));
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=84">'));
});
