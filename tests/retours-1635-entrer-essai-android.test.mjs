/* Elisa, 25 novembre, 16 h 35 (sur l’émulateur Android) : « laisse-moi rentrer dans l’application avec un bouton », « avec le paywall
   je ne peux pas rentrer ». Dans l’appli d’essai Android seulement, sans achat branché : les offres s’affichent et le bouton du
   paywall fait entrer, en le disant. L’iPhone et l’appli de Google Play gardent « Les offres ne se chargent pas » sans achat. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ligne = d => { const i = app.indexOf(d); assert.ok(i >= 0, d); return app.slice(i, app.indexOf('\n', i)); };

test('sans achat : l’essai Android montre les offres ; l’iPhone et Google Play non', () => {
  const run = (plateforme, ua) => {
    const ctx = vm.createContext({window: {Capacitor: {isNativePlatform: () => true}}, navigator: {userAgent: ua}, appAndroid: () => plateforme === 'android'});
    vm.runInContext(ligne('function obAppIphone(){') + '\n' + ligne('function obEssaiAndroid(){') + '\n' + ligne('function obPrixEtat(){'), ctx);
    return vm.runInContext('obPrixEtat()', ctx);
  };
  assert.equal(run('android', 'Mozilla/5.0 (Linux; Android 15) wv RequeteEssaiAndroid'), 'oui');
  assert.equal(run('android', 'Mozilla/5.0 (Linux; Android 15) wv'), 'echec', 'Google Play : pas d’entrée gratuite');
  assert.equal(run('ios', 'Mozilla/5.0 (iPhone) RequeteEssaiAndroid'), 'echec', 'iPhone : inchangé');
});

test('le bouton du paywall de l’essai Android fait entrer, et le dit', () => {
  assert.ok(app.includes("const testAndroid=!obAchatPret()&&obEssaiAndroid();"));
  assert.ok(app.includes("obSetFooter(testAndroid?'Entrer dans l’appli (version de test)':libelle,testAndroid?obPaywallPasser:obPaywallAcheter,'','',{html:legal},obPwBusy);"));
  assert.ok(app.includes("function obPaywallPasser(){if(!obPaywallOuvert())return;"));
});
