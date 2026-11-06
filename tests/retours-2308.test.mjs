/* Elisa, 6 novembre, 23 h 08, sur sa capture de la fenêtre d’iOS en aperçu (étape « Un petit rappel »), la flèche jaune vers
   « Autoriser » : « Les boutons ne marchent pas quand on clique ; je veux que ça fasse l’action ou que ça ouvre la pop-up si c’est pas
   possible d’autoriser sans ». Les deux boutons de l’aperçu sont de vrais boutons : « Autoriser » ouvre la vraie demande d’iOS (on ne
   peut pas autoriser sans elle), comme le bouton du bas, puis programme le rappel ; « Ne pas autoriser » passe à la suite, sans rappel
   et sans ouvrir la demande d’iOS (elle reste possible plus tard, dans Mon compte). Une seule demande à la fois. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };

/* La demande et le refus, exécutés seuls : iOS répond (ou tarde à répondre) comme on veut. */
function etape({ reponse = 'granted', apercu = false } = {}) {
  const appels = [], store = {}; let repondre;
  const ctx = vm.createContext({ obLock: false, obApercu: apercu, document: { getElementById: () => ({ disabled: false }) },
    window: { Capacitor: { isNativePlatform: () => true, Plugins: { LocalNotifications: { requestPermissions: () => { appels.push('demande d’iOS'); return new Promise(r => { repondre = () => r({ display: reponse }); }); } } } } },
    localStorage: { setItem: (k, v) => { store[k] = v; } }, rappelNativeSync: () => appels.push('rappel programmé'), buzz: () => {},
    obGoto: t => appels.push('vers ' + t), obFinSuivante: () => 'widget', draft: { rappelHeure: '08:00' }, rappelHeure: () => '19:00' });
  vm.runInContext(cut('async function obRappelDemander(){', '/* La fenêtre en aperçu au centre'), ctx);
  return { ctx, appels, store, repondre: () => repondre() };
}

test('les deux boutons de l’aperçu sont de vrais boutons, avec leur action', () => {
  const s = cut("}else if(slide==='rappel'){", "}else if(slide==='widget'){");
  assert.ok(s.includes('<div class="ob-notif" id="ob-notif"><div class="ob-notif-cadre">'), 'l’aperçu n’est plus caché aux lecteurs d’écran : ses boutons y sont');
  assert.ok(s.includes('<button type="button" onclick="obRappelRefuser()" aria-label="Ne pas autoriser les rappels">Ne pas autoriser</button>'));
  assert.ok(s.includes('<button type="button" class="is-ok" onclick="obRappelDemander()" aria-label="Autoriser les rappels">Autoriser</button>'));
  assert.ok(s.includes('<b aria-hidden="true">') && s.includes('<small aria-hidden="true">'), 'le texte imité d’iOS n’est pas lu');
  assert.ok(s.includes("obSetFooter(`Me rappeler à ${obHeureTexte(draft.rappelHeure)}`,obRappelDemander,'','','');"), 'le bouton du bas fait comme « Autoriser »');
});

test('« Autoriser » ouvre la vraie demande d’iOS, puis programme le rappel ; une seule demande à la fois', async () => {
  const t = etape();
  const p = t.ctx.obRappelDemander();
  t.ctx.obRappelDemander();     // un deuxième toucher pendant que la fenêtre d’iOS est ouverte
  t.ctx.obRappelRefuser();      // ou « Ne pas autoriser » derrière elle
  t.repondre(); await p;
  assert.deepEqual(t.appels, ['demande d’iOS', 'rappel programmé', 'vers widget'], 'une seule demande, une seule suite');
  assert.deepEqual({ ...t.store }, { 'requete-rappel-heure': '08:00', 'requete-rappel': '1' });
  const t2 = etape({ reponse: 'denied' }); const p2 = t2.ctx.obRappelDemander(); t2.repondre(); await p2;
  assert.deepEqual(t2.appels, ['demande d’iOS', 'vers widget'], 'refusé dans la fenêtre d’iOS : pas de rappel, on continue');
});

test('« Ne pas autoriser » passe à la suite sans ouvrir la demande d’iOS', () => {
  const t = etape();
  t.ctx.obRappelRefuser();
  assert.deepEqual(t.appels, ['vers widget'], 'iOS n’est pas dérangé');
  assert.deepEqual({ ...t.store }, { 'requete-rappel-heure': '08:00', 'requete-rappel': '0' }, 'pas de rappel ; l’heure choisie reste pour Mon compte');
  const a = etape({ apercu: true }); a.ctx.obRappelRefuser();
  assert.deepEqual([a.appels, { ...a.store }], [['vers widget'], {}], 'aperçu : rien gardé');
});

test('le style : de vrais boutons d’iOS, qui s’assombrissent sous le doigt', () => {
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-notif-btns button{-webkit-appearance:none;appearance:none;margin:0;border:0;border-radius:0;background:transparent;cursor:pointer;touch-action:manipulation;'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-notif-btns button+button{border-left:1px solid rgba(60,60,67,.22)}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-notif-btns button:active{background:rgba(60,60,67,.12)}') && css.includes('html #onboarding.ob-vitrine .ob-notif-btns .is-ok:active{background:rgba(0,122,255,.18)}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-notif-btns button:focus-visible{outline:3px solid var(--v-sun);outline-offset:-3px}'));
  assert.ok(!/\.ob-notif-btns span/.test(css), 'plus de faux boutons');
});
