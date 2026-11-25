/* 25 novembre, le parcours complet de l'appli Android sur les émulateurs de GitHub : l'heure, la batterie et le réseau étaient
   blancs sur le fond lavande de l'appli, donc invisibles. À la fin de l'écran de lancement, Android reprend les couleurs des
   barres du thème : le thème les met maintenant en sombre, et l'appli les remet en sombre juste après le lancement.
   Android seulement : sur iPhone, rien ne change. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../android/app/src/main/res/values/styles.xml', import.meta.url), 'utf8');

test('le thème de l’appli Android : icônes des barres en sombre', () => {
  const theme = styles.slice(styles.indexOf('<style name="AppTheme.NoActionBar"'), styles.indexOf('</style>', styles.indexOf('<style name="AppTheme.NoActionBar"')));
  assert.match(theme, /<item name="android:windowLightStatusBar">true<\/item>/);
  assert.match(theme, /<item name="android:windowLightNavigationBar" tools:targetApi="27">true<\/item>/);
  assert.match(styles, /<resources xmlns:tools="http:\/\/schemas\.android\.com\/tools">/);
});

test('après l’écran de lancement : les barres repassent en sombre sur Android, pas sur iPhone', async () => {
  const debut = app.indexOf('  var barresSombres=function(){');
  const fin = app.indexOf('},t);});};', debut) + '},t);});};'.length;
  assert.ok(debut > 0 && fin > debut);
  const run = async android => {
    const appels = [];
    const P = {SystemBars: {setStyle: o => { appels.push('SystemBars ' + o.style); return Promise.resolve(); }},
      StatusBar: {setStyle: o => { appels.push('StatusBar ' + o.style); return Promise.resolve(); }}};
    const ctx = vm.createContext({P, appAndroid: () => android, setTimeout: (f, t) => setTimeout(f, Math.min(t, 20))});
    vm.runInContext(app.slice(debut, fin) + '\nbarresSombres();', ctx);
    await new Promise(r => setTimeout(r, 80));
    return appels;
  };
  assert.deepEqual(await run(true), ['SystemBars LIGHT', 'StatusBar LIGHT', 'SystemBars LIGHT', 'StatusBar LIGHT']);
  assert.deepEqual(await run(false), []);
});

test('les deux façons de quitter l’écran de lancement remettent les barres en sombre', () => {
  assert.ok(app.includes("window.nativeAppReady=function(){if(window.__majInstalle)return;try{P.SplashScreen&&P.SplashScreen.hide({fadeOutDuration:250});}catch(e){}barresSombres();};"));
  assert.ok(app.includes("C.Plugins.SplashScreen.hide({fadeOutDuration:0});}catch(e){}\n    try{window.barresSombres&&window.barresSombres();}catch(e){}"));
});
