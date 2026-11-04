/* Elisa, 3 novembre, 9 h 01 : « Quand je clique sur Commencer, la vidéo doit apparaître, mais 2 secondes avant, on voit du blanc
   et la vidéo apparaît. […] trace violette après avoir quitté le cours, trait blanc au début d’un cours ».
   - vitrine → vidéo du métier (decouvrir/video.html) : l’affiche violette est là dès la première image (taille du cadre posée
     par le CSS et par un petit script juste après le lecteur, avant GSAP) ; durée et repères ne changent plus une fois affichés ;
   - connexion → appli : la page passe au violet de l’écran de chargement de l’appli au lieu de s’effacer sur son fond clair ;
   - « Commencer » d’un cours : le lecteur s’ouvre en fondu par-dessus la page de départ, tout de suite, sans découvrir l’écran
     clair du cours ; sur téléphone, il ne glisse plus (son bord découvrait un trait clair sous l’heure) ;
   - fermeture : le fond uni du lecteur, lu par Safari pour la zone de l’heure, prend la couleur de l’écran d’en dessous. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const video = lire('decouvrir/video.html'), cx = lire('decouvrir/connexion.html'), app = lire('index.html'), surf = lire('safari-surface.css');
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };

test('vidéo du métier : le cadre a sa taille dans le CSS, avec le même calcul que fit()', () => {
  assert.ok(video.includes('#frame{--vh:100vh;--fw:min(calc(100vw - 24px),880px,calc((var(--vh) - 116px - max(10px,env(safe-area-inset-top)) - max(12px,env(safe-area-inset-bottom))) * .8));'));
  assert.ok(video.includes('width:var(--fw);height:calc(var(--fw) * 1.25);border-radius:max(16px,calc(var(--fw) * .04444))}'));
  assert.ok(video.includes('@supports (height:100dvh){#frame{--vh:100dvh}}'));
  /* Les barres font 62 px et 68 px hors zones sûres : 116 px = 52 + 56 + 8 (l’air autour du cadre) */
  assert.ok(video.includes('.bar{width:100%;max-width:880px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 16px;flex:none}'));
  assert.ok(video.includes('.bar.top{padding-top:max(10px,env(safe-area-inset-top))}') && video.includes('.bar.bottom{padding-bottom:max(12px,env(safe-area-inset-bottom))}'));
  assert.ok(video.includes('min-height:42px;padding:0 15px') && video.includes('.ctl{flex:none;width:46px;height:46px;'));
});

test('vidéo du métier : fit() tourne juste après le lecteur, avant GSAP et la construction de la vidéo', () => {
  const fit = video.indexOf('function fit(){'), bas = video.indexOf('<div class="bar bottom">'), gsap = video.indexOf('<script src="../assets/anim/gsap.min.js"></script>');
  assert.ok(bas > 0 && fit > bas && fit < gsap, 'fit() entre la barre du bas et GSAP');
  assert.ok(cut(video, 'function fit(){', '</script>').includes('fit();'), 'appelée tout de suite');
  assert.equal(video.split('function fit(){').length, 2, 'une seule définition');
  assert.ok(video.includes("addEventListener('resize', fit);\nfit();"), 'toujours recalée au redimensionnement');
});

test('vidéo du métier : la première image est complète (lecture, durée, polices de l’affiche)', () => {
  assert.ok(video.includes('<button type="button" class="ctl" id="pp" aria-label="Lecture"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5Z"/></svg></button>'));
  for (const f of ['inter-bold', 'jetbrains-mono']) assert.ok(video.includes(`<link rel="preload" href="../assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`), f);
  /* La durée écrite dans la page est celle que calcule le lecteur avec la voix (voix/voix.json) : elle ne change plus à l’affichage. */
  const j = JSON.parse(lire('decouvrir/voix/voix.json'));
  const DURATION = +video.match(/const DURATION = ([\d.]+);/)[1];
  const holds = j.scenes.filter(c => c.fin && c.d + .45 > c.fin - c.t).map(c => +(c.d + .45 - (c.fin - c.t)).toFixed(2));
  const d = Math.floor(DURATION + holds.reduce((n, x) => n + x, 0)), mm = Math.floor(d / 60), ss = String(d % 60).padStart(2, '0');
  assert.ok(video.includes(`<span class="go-dur" id="go-dur" aria-hidden="true">${mm} min ${ss}</span>`), `affiche : ${mm} min ${ss}`);
  assert.ok(video.includes(`<span id="time">0:00 / ${mm}:${ss}</span>`), `barre : 0:00 / ${mm}:${ss}`);
  /* Avant la voix, la durée affichée et les repères des chapitres restent tels quels (ils passaient un instant à 2:14). */
  assert.ok(video.includes('if (dureeConnue) time.textContent = `${mmss(t)} / ${mmss(VDUR())}`;'));
  assert.ok(video.includes('setPlaying(false); sync();') && !video.includes('setPlaying(false); ticks(); sync();'));
  assert.ok(video.includes('dureeConnue = true; fit(); ticks(); ui(C.time());'));
});

test('connexion → appli : la page passe au violet de l’écran de chargement, jamais au blanc', () => {
  assert.ok(cx.includes('body.cx::after{content:\'\';position:fixed;inset:0;z-index:100;pointer-events:none;opacity:0;transition:opacity .28s;'));
  assert.ok(cx.includes('background:linear-gradient(180deg,#6E50F6 0%,#5538E6 48%,#4529CC 100%)}\nbody.cx.cx-leave::after{opacity:1}'));
  assert.ok(app.includes('html.lq #loader{background:var(--immersive-background)!important}') || surf.includes('html.lq #loader{background:var(--immersive-background)!important}'), 'même dégradé que l’écran de chargement');
  assert.ok(surf.includes('--immersive-background:linear-gradient(180deg,var(--immersive-top) 0%,var(--immersive-mid) 48%,var(--immersive-bottom) 100%)') && surf.includes('--immersive-top:#6E50F6;'));
  const leave = cut(cx, 'function leave(dest){', '\n  }');
  assert.ok(leave.includes("document.body.classList.add('cx-leave');"));
  assert.ok(leave.includes("document.documentElement.style.backgroundColor = document.body.style.backgroundColor = '#6E50F6';"), 'zone de l’heure violette');
});

test('« Commencer » d’un cours : le lecteur s’ouvre par-dessus la page de départ, qui n’est retirée qu’une fois couverte', () => {
  const close = cut(app, '  const close=ok=>{', '\n  };');
  assert.ok(close.indexOf('if(ok)go&&go();') < close.indexOf("root.classList.add('is-out');"), 'le lecteur s’ouvre d’abord');
  assert.ok(close.includes("if(ok&&document.getElementById('lesson-video')&&!prefersReduceMotion()){\n      setTimeout(()=>{ root.classList.add('is-out'); setTimeout(()=>root.remove(),220); },LV_FADE_MS);\n      return;\n    }"));
  assert.ok(app.includes('const LV_FADE_MS=260;'));
  /* Fermé aussitôt ouvert, le lecteur emporte la page de départ encore dessous. */
  assert.ok(cut(app, 'function closeLessonVideo(instant){', 'function lessonStepMeta(){').includes("document.getElementById('lesson-start')?.remove();"));
  assert.ok(app.includes('transition:opacity .26s ease,transform .38s cubic-bezier(.2,.8,.2,1)}'), 'fondu de 260 ms');
  /* Le fondu ne dépend plus de deux images (requestAnimationFrame), retardées par le chargement de l’animation sur iPhone. */
  const open = cut(app, 'function openLessonVideo(fin){', 'function lvPlay(){');
  assert.ok(open.includes("else{ void getComputedStyle(root).opacity; root.classList.add('on'); }"));
  assert.ok(!open.includes("requestAnimationFrame(()=>requestAnimationFrame(()=>root.classList.add('on')))"));
});

test('téléphone : le lecteur apparaît et disparaît en fondu, sans glisser ni rétrécir', () => {
  assert.ok(app.includes('@media (max-width:599.98px){.lv{transform:none}}'));
  assert.ok(app.indexOf('@media (max-width:599.98px){.lv{transform:none}}') > app.indexOf('.lv.on{opacity:1;transform:none}'));
});

test('fermeture : le fond uni du lecteur prend la couleur de l’écran d’en dessous, le dégradé reste à l’écran', () => {
  assert.ok(surf.includes('html.lq .lv.is-closing{background-color:var(--browser-top)}'));
  assert.ok(!surf.includes('html.lq .lv.is-closing{background-color:transparent}'));
  assert.ok(surf.includes('html.lq .lv{background-color:var(--immersive-top);background-image:var(--immersive-background)}'), 'dégradé opaque par-dessus');
  assert.ok(app.includes('<link rel="stylesheet" href="safari-surface.css?v=13">') && lire('sw.js').includes("'./safari-surface.css?v=13',"));
});

/* Elisa, 3 novembre, 10 h 00 : « là c’est ok quand j’arrive sur la page, mais quand je descends et remonte, j’ai la barre blanche
   en haut ». Safari 26 garde la couleur du dernier élément fixe ou collant trouvé au bord haut tant qu’il est affiché, et un
   <header> même caché : la barre de navigation, claire une fois qu’on a défilé. Un repère vide, présent seulement quand la barre
   est claire, prend sa place ; il est retiré sur l’en-tête violet. */
const vitrines = ['index', 'module', 'conditions', 'confidentialite', 'mentions-legales'];
test('vitrine : un seul script pour la barre de navigation par page (sur les pages légales, le menu s’ouvrait puis se refermait)', () => {
  for (const p of vitrines) {
    const h = lire(`decouvrir/${p}.html`);
    assert.equal(h.split("var nav=document.getElementById('nav')").length, 2, `${p} : une seule fois`);
    assert.equal(h.split("var prog=document.getElementById('prog')").length, 2, `${p} : une seule barre de lecture`);
    assert.equal(h.split("b.addEventListener('click',function(){ouvrir(menu.hidden);});").length, 2, `${p} : un seul écouteur sur le menu`);
  }
});

test('vitrine : la zone de l’heure redevient violette en remontant sur l’en-tête', () => {
  for (const p of vitrines) {
    const h = lire(`decouvrir/${p}.html`), on = cut(h, '  var on=function(){', '\n  };');
    assert.ok(h.includes("rep.style.cssText='position:fixed;top:0;left:0;right:0;height:12px;z-index:2147483647;margin:0;padding:0;border:0;pointer-events:none;background-color:#F7F6FD;background-clip:text;-webkit-background-clip:text;transition:none';"), `${p} : repère invisible, plus de 10 px de haut, au-dessus de la barre`);
    assert.ok(h.includes("}else if(!clair&&rep){rep.remove();rep=null;}"), `${p} : retiré sur l’en-tête`);
    assert.ok(on.includes("if(s)nav.style.removeProperty('transition');else nav.style.transition='none';"), `${p} : la barre perd son fond clair d’un coup`);
    assert.ok(on.includes("nav.classList.toggle('scrolled',s);repere(s);"), `${p} : repère quand la barre est claire (défilement ou menu ouvert)`);
    assert.ok(on.indexOf("nav.style.transition='none'") < on.indexOf("nav.classList.toggle('scrolled',s)"), `${p} : sans fondu, avant de changer de classe`);
  }
  /* La barre est bien un <header> : WebKit garde la couleur d’un <header> même caché, d’où le repère. */
  for (const p of vitrines) assert.ok(lire(`decouvrir/${p}.html`).includes('<header class="nav" id="nav">'), p);
});
