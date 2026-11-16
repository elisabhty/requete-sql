/* Elisa, 14 novembre, 13 h 36 : « parfois quand on quitte l’appli et qu’on revient, genre pas quitter, mais tu vois, on pousse vers le
   haut, on va dans une autre, après on revient, ça flash des fois ». En arrière-plan, iOS décharge parfois la page de l’appli (la
   mémoire) ; au retour, Capacitor la recharge (WebViewDelegationHandler.webViewWebContentProcessDidTerminate) : l’écran de lancement
   et toute l’ouverture animée repassaient, et l’on revenait sur l’accueil. Rechargée pendant la même ouverture de l’appli
   (sessionStorage rq-session, posé à la fin du démarrage) : pas d’ouverture, un simple aplat, puis la page où l’on était, d’un coup. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const lq = readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('rechargée pendant la même ouverture : pas d’ouverture animée', () => {
  const tete = cut("var d=document.documentElement,L=document.getElementById('loader'),C=window.Capacitor;", 'var POINTS=');
  assert.ok(tete.includes("var reprise=false;try{reprise=sessionStorage.getItem('rq-session')==='1';}catch(e){}"));
  assert.ok(tete.indexOf("if(reprise){L.classList.add('is-reprise');window.__appReprise=true;return;}") < tete.indexOf("L.classList.add('is-intro');"), 'avant l’ouverture');
});

test('le démarrage pose la marque ; l’écran de lancement disparaît d’un coup sur la page reprise', () => {
  assert.ok(cut('async function boot(){', '\n}\n').includes("  if(demarrageOk){try{sessionStorage.setItem('rq-session','1');}catch(e){}}\n  hideLoader();"));
  const cacher = cut('function hideLoader(){', '\n}\n');
  assert.ok(cacher.indexOf("if(typeof window!=='undefined'&&window.__appReprise&&loader){window.nativeAppReady&&window.nativeAppReady();loader.classList.add('fade-out');loader.style.display='none';return;}")
    < cacher.indexOf('__introJouer'));
  /* la page où l’on était revient : dans l’app, restoreNav lit sessionStorage (requete-nav-v1), qui vit le temps de l’ouverture */
  assert.ok(cut('function restoreNav(){', '\n}\n').includes('try{ nav=JSON.parse(sessionStorage.getItem(NAV_KEY)); }catch(e){}'));
});

test('l’aplat de la reprise : sans logo ni barre ; le cache change', () => {
  assert.ok(lq.includes('html.is-native.lq #loader.is-reprise{position:fixed;inset:0;z-index:2147483000;display:block;padding:0;background:#F4F2FC!important}'));
  assert.ok(lq.includes('html.is-native.lq #loader.is-reprise>*{display:none!important}'));
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=388">'));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-16-module-v3113';"));
});
