/* 17 novembre, 18 h 19 (Elisa, capture du voile « Requête » et de son anneau) : « Il y a comme un flash ».
   1. Tirer pour actualiser et changer de langue rechargeaient la page 0,18 s après le voile, encore à moitié transparent : la page
      qui arrivait le montrait d’un coup, entier, l’anneau et la touche repartis de zéro. On recharge maintenant quand le voile est
      entier (rqVoile rend une promesse), et la page qui arrive continue l’anneau et la touche là où ils en étaient (--rq-ph).
   2. Une version téléchargée qui s’installe au lancement (maj.js) remplace la page : celle qui part ne lance plus l’ouverture, ne
      retire plus l’écran de lancement, ne montre plus l’appli et garde le voile pour la suivante (window.__majInstalle). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), maj = lire('maj.js');

test('le rechargement attend le voile entier ; la langue aussi', () => {
  const v = app.slice(app.indexOf('function rqVoile(){'), app.indexOf('function rqVoileRetirer(){'));
  assert.ok(v.includes("sessionStorage.setItem('rq-recharge-t',String(Date.now()))"), 'l’heure du voile');
  assert.ok(v.includes("v.addEventListener('transitionend',fin,{once:true});") && v.includes('requestAnimationFrame(()=>requestAnimationFrame(()=>ok()))'), 'tenue quand le voile est entier et dessiné');
  assert.ok(app.includes("(typeof rqVoile==='function'?rqVoile():Promise.resolve()).then(()=>location.reload());"), 'tirer pour actualiser');
  assert.ok(app.includes("(typeof rqVoile==='function'?rqVoile():Promise.resolve()).then(()=>{if(!L.changer(c)){"), 'la langue');
  assert.ok(!app.includes('setTimeout(()=>location.reload(),180)'), 'plus de rechargement à heure fixe');
});

test('la page qui arrive continue l’anneau et la touche du voile', () => {
  assert.ok(app.includes("tVoile=+sessionStorage.getItem('rq-recharge-t')||0;"));
  assert.ok(app.includes("L.style.setProperty('--rq-ph',(-Math.min(6e5,Math.max(0,Date.now()-tVoile)))+'ms')"));
  assert.ok(lq.includes('animation:ldFloat 4.6s ease-in-out var(--rq-ph,0s) infinite!important'));
  assert.equal((lq.match(/animation:ldSpin 1\.2s linear var\(--rq-ph,0s\) infinite!important/g) || []).length, 2, 'l’arc et le point de l’anneau');
});

test('une version qui s’installe : la page qui part ne montre rien, la suivante garde le voile', () => {
  assert.ok(maj.includes("function tenir() { try { window.__majInstalle = true; } catch (e) {} }"));
  assert.ok(maj.includes("installation = true; tenir();\n    appeler('set', { id: prete.id })"), 'l’installation');
  assert.ok(maj.includes("installation = true; tenir();\n        appeler('reset', {})"), 'le retour au contenu de l’appli');
  assert.ok(maj.includes("installation = false; lacher();\n      ecrire(CLE.prete, null);") && maj.includes("installation = false; lacher(); noter('retour raté', e);"), 'un échec : tout reprend');
  assert.ok(app.includes("if(!window.__majInstalle){sessionStorage.removeItem('rq-recharge');sessionStorage.removeItem('rq-recharge-t');}"), 'le voile gardé pour la page suivante');
  assert.ok(app.includes("if(window.__majInstalle){window.__majApres=jouer;return;}"), 'l’ouverture attend : l’écran de lancement reste');
  assert.ok(app.includes("window.nativeAppReady=function(){if(window.__majInstalle)return;"));
  assert.ok(app.includes("if(typeof window!=='undefined'&&window.__majInstalle){window.__majApres=hideLoader;return;}"), 'l’appli ne se montre pas');
  assert.ok(app.includes("if(demarrageOk&&!window.__majInstalle){try{sessionStorage.setItem('rq-session','1');}"), 'la page suivante garde son ouverture');
  assert.ok(app.includes("if(window.__majInstalle)setTimeout(function(){window.__majLibere();},6000);"), 'pas remplacée à temps : tout reprend');
  assert.ok(app.indexOf('<script src="maj.js?v=3"></script>') < app.indexOf('<div id="loader">'), 'maj.js avant l’écran de chargement');
});
