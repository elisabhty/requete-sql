/* Requête · moteur commun des cours animés (assets/anim/*.html).

   Une page de cours contient ses scènes (HTML + CSS), charge gsap.min.js puis ce fichier,
   et décrit son déroulé avec Course({...}). Le moteur s’occupe du reste :
   - l’habillage : étiquette du chapitre en haut à droite, carte des légendes en bas ;
   - les pauses de lecture, calculées d’après la longueur de chaque légende ;
   - les sons, les chapitres, les questions et les légendes, exportés pour le lecteur de l’app (window.__ready) ;
   - le rendu d’une image à un instant donné (window.renderAt), piloté par le lecteur.

   Temps : la timeline GSAP est écrite en « temps de la timeline ». Les pauses de lecture (HOLDS) figent
   l’image un moment ; le lecteur, lui, compte en « temps de la vidéo » (pauses comprises) : warp / unwarp
   passent de l’un à l’autre. */
'use strict';
const FPS = 30;
const QS = new URLSearchParams(location.search);
/* ?app : version du cours dans l’app (le bouton « Ajouter dans notes » et l’écran « À toi de jouer » sont ceux de l’app). */
const APP = QS.has('app');
/* ?embed : jouée dans le lecteur de l’app, qui pilote le temps (renderAt) ; la scène remplit la fenêtre sans être rognée. */
const EMBED = QS.has('embed');
if (EMBED) {
  document.documentElement.classList.add('embed');
  const fit = () => {
    const st = document.getElementById('stage'); if (!st) return;
    const s = Math.min(innerWidth / 1080, innerHeight / 1920);
    st.style.transform = `translate(${((innerWidth - 1080 * s) / 2).toFixed(2)}px,${((innerHeight - 1920 * s) / 2).toFixed(2)}px) scale(${s.toFixed(5)})`;
  };
  addEventListener('resize', fit);
  addEventListener('DOMContentLoaded', fit);
  fit();
}

const NB = '\u00a0';
const $ = s => document.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* Typographie française : espace insécable avant : ; ! ? et dans « », hors balises et hors <code>. */
function fr(h){
  let code = 0;
  return String(h).split(/(<[^>]+>)/).map(t => {
    if (/^<code[\s>]/.test(t)) { code++; return t; }
    if (/^<\/code>/.test(t)) { code = Math.max(0, code - 1); return t; }
    if (t[0] === '<' || code) return t;
    return t.replace(/ ([:?!;»])/g, NB + '$1').replace(/« /g, '«' + NB).replace(/(\d) (?=\S)/g, '$1' + NB);
  }).join('');
}
const plain = h => fr(h).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, NB).replace(/&[a-z]+;/g, 'x');

/* Découpe un élément en caractères (pour l’effet de frappe). */
function splitChars(root){
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => {
    if (n.parentElement.closest('.caret')) return;
    const frag = document.createDocumentFragment();
    for (const ch of n.textContent) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch;
      frag.append(s);
    }
    n.parentNode.replaceChild(frag, n);
  });
  return $$('.ch', root);
}

/* ---------- Pauses de lecture ---------- */
/* [instant de la timeline, durée] : l’image reste affichée le temps de lire. */
let HOLDS = [];
const EXTRA_HOLDS = [];
function warp(T){
  let shift = 0;
  for (const [t, d] of HOLDS) { if (T <= t + shift) break; if (T < t + shift + d) return t; shift += d; }
  return T - shift;
}
function unwarp(t){ let s = 0; for (const [h, d] of HOLDS) { if (t > h) s += d; else break; } return +(t + s).toFixed(3); }
/* Temps de lecture d’une légende : 17 caractères par seconde, le rythme du cours WHERE
   une fois ses pauses ajoutées (jugé confortable). */
const READ_CPS = 17;
const readTime = h => plain(h).length / READ_CPS;
/* Pause supplémentaire à un instant précis (lire un tableau, une carte…), en plus de celles des légendes. */
function hold(t, d){ EXTRA_HOLDS.push([+t.toFixed(2), d]); }
/* Une légende reste lisible de son fondu d’entrée (a + 0,3 s) au début de son fondu de sortie (b − 0,2 s) ;
   s’il manque du temps pour la lire, l’image s’arrête juste avant qu’elle ne s’efface. */
function captionHolds(captions, end){
  const out = [];
  captions.forEach(([a, b, text]) => {
    if (b >= end) return;
    const miss = readTime(text) - ((b - 0.2) - (a + 0.3));
    if (miss > 0.05) out.push([+(b - 0.25).toFixed(2), Math.ceil(miss * 20) / 20]);
  });
  return out;
}
/* Deux pauses très proches n’en font qu’une, de la plus longue des deux durées. */
function mergeHolds(list){
  const out = [];
  list.slice().sort((x, y) => x[0] - y[0]).forEach(h => {
    const last = out[out.length - 1];
    if (last && h[0] - last[0] < 0.12) last[1] = Math.max(last[1], h[1]);
    else out.push([h[0], h[1]]);
  });
  return out;
}

/* ---------- Timeline ---------- */
/* Transformations en 2D uniquement : sans calques GPU, le texte est dessiné directement à sa taille finale
   (la scène est réduite dans le lecteur) et reste net, au lieu d’être agrandi puis réduit. */
gsap.config({force3D: false});
const tl = gsap.timeline({paused: true});
const CUES = [];
function cue(t, type, gain = 1, pitch = 0){ CUES.push({t: +t.toFixed(3), type, gain, pitch}); }
/* Mouvements d’ambiance (mascotte qui flotte…) : une pause de lecture peut tomber pendant eux. */
const AMB = {data: 'amb'};

function show(el, t, from = {}, dur = 0.55, ease = 'expo.out'){
  const f = Object.assign({autoAlpha: 0, y: 40}, from);
  gsap.set(el, f);
  const to = {autoAlpha: 1, duration: dur, ease};
  Object.keys(f).forEach(k => { if (k !== 'autoAlpha' && to[k] === undefined) to[k] = (k === 'scale' || k === 'scaleX' || k === 'scaleY') ? 1 : 0; });
  tl.to(el, to, t);
}
function hide(el, t, to = {}, dur = 0.42, ease = 'power2.in'){
  tl.to(el, Object.assign({autoAlpha: 0, y: -40, duration: dur, ease}, to), t);
}
function sceneOn(sel, t){ tl.set(sel, {autoAlpha: 1}, t); }
function sceneOff(sel, t){ tl.set(sel, {autoAlpha: 0}, t); }

function press(btn, t, lip = '#4B30CC', depth = 9){
  tl.to(btn, {y: depth - 2, boxShadow: `0 2px 0 ${lip}`, duration: 0.09, ease: 'power2.out'}, t)
    .to(btn, {y: 0, boxShadow: `0 ${depth}px 0 ${lip}`, duration: 0.3, ease: 'back.out(2.2)'}, t + 0.13);
  const r = btn.querySelector('.ripple');
  if (r) {
    gsap.set(r, {scale: 0, opacity: 0});
    tl.to(r, {scale: 0, opacity: 0.55, duration: 0.001}, t)
      .to(r, {scale: 1, opacity: 0, duration: 0.7, ease: 'power2.out'}, t + 0.01);
  }
  cue(t, 'click');
}

/* Frappe : les caractères apparaissent un à un, le curseur clignote devant. Renvoie l’instant de fin. */
function typeChars(chars, t, cps = 24, caret = null, keepCaret = false){
  gsap.set(chars, {display: 'none'});
  if (caret) tl.set(caret, {autoAlpha: 1}, t - 0.25);
  tl.to(chars, {display: 'inline', duration: 0.001, stagger: 1 / cps, ease: 'none'}, t);
  chars.forEach((c, i) => { if (i % 2 === 0 && c.textContent.trim()) cue(t + i / cps, 'type', 1, (i * 7) % 5); });
  const end = t + chars.length / cps;
  if (caret && !keepCaret) tl.set(caret, {autoAlpha: 0}, end + 0.12);
  return end;
}
/* Tape une ligne entière ; later = partie de la ligne gardée pour plus tard (tapée ensuite avec typeMore). */
function typeLine(line, t, cps = 24, keepCaret = false, later = null){
  const chars = splitChars(line).filter(c => !(later && later.contains(c)));
  return typeChars(chars, t, cps, line.querySelector('.caret'), keepCaret);
}
function typeMore(part, t, cps = 24, keepCaret = false){
  const line = part.closest('.ln') || part.parentElement;
  return typeChars($$('.ch', part), t, cps, line.querySelector('.caret'), keepCaret);
}

/* ---------- Habillage : chapitres et légendes ---------- */
function buildChrome(chapters, captions){
  const prog = $('#progress');
  chapters.forEach(() => { const s = document.createElement('div'); s.className = 'seg'; s.innerHTML = '<i></i>'; prog.append(s); });
  const chap = $('#chapter');
  chapters.forEach(c => {
    const d = document.createElement('div');
    d.className = 'chip';
    d.innerHTML = `<b>${c.n}</b><span>/ ${chapters.length} · ${c.label}</span>`;
    chap.append(d);
  });
  const cap = $('#cap');
  captions.forEach(c => {
    const d = document.createElement('div');
    d.className = 'c';
    d.innerHTML = `<p>${fr(c[2])}</p>`;
    cap.append(d);
  });
}
function chromeTimeline(chapters, captions, duration){
  /* Dans l’app, le lecteur a sa propre barre d’avancement et sa croix en haut à gauche :
     la scène garde seulement l’étiquette du chapitre. */
  gsap.set(['#progress', '#header'], {opacity: 1});
  if (APP) gsap.set(['#progress', '#header .logo', '#header .brand'], {opacity: 0});
  const segs = $$('#progress .seg i');
  chapters.forEach((c, i) => tl.to(segs[i], {scaleX: 1, duration: c.b - c.a, ease: 'none', data: 'amb'}, c.a));
  const chips = $$('#chapter .chip');
  chapters.forEach((c, i) => {
    gsap.set(chips[i], {autoAlpha: 0, y: 30});
    tl.to(chips[i], {autoAlpha: 1, y: 0, duration: 0.5, ease: 'back.out(1.8)'}, c.a - 0.1);
    if (!(APP && i === chapters.length - 1)) tl.to(chips[i], {autoAlpha: 0, y: -26, duration: 0.3, ease: 'power2.in'}, c.b - 0.35);
  });
  const capCard = $('#cap');
  gsap.set(capCard, {autoAlpha: 0, y: 40});
  tl.to(capCard, {autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out'}, captions[0][0] - 0.3);
  if (!APP) tl.to(capCard, {autoAlpha: 0, y: 40, duration: 0.45, ease: 'power2.in'}, duration - 0.5);
  $$('#cap .c').forEach((el, i) => {
    const [a, b] = captions[i];
    gsap.set(el, {autoAlpha: 0, y: 26});
    tl.to(el, {autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out'}, a);
    if (b < duration) tl.to(el, {autoAlpha: 0, y: -18, duration: 0.25, ease: 'power2.in'}, b - 0.2);
  });
}

/* ---------- Scènes communes ---------- */
/* Mesures ramenées à la scène 1080 × 1920, même quand elle est réduite (lecteur de l’app). */
function stageScale(){ const sr = $('#stage').getBoundingClientRect(); return {sr, k: sr.width / 1080 || 1}; }
function rel(el, ref){ const {sr, k} = stageScale(), r = el.getBoundingClientRect(), o = ref ? ref.getBoundingClientRect() : sr;
  return {x: (r.left - o.left) / k, y: (r.top - o.top) / k, w: r.width / k, h: r.height / k}; }

/* Intro : le titre est déjà en place sur la première image (elle sert de vignette), puis les lettres sautillent,
   le surligneur passe dessous, la mascotte arrive avec sa bulle ; tout s’en va à 4,4 s. */
function introScene(){
  const ls = $$('#s0 .title span'), a = rel(ls[0]), b = rel(ls[ls.length - 1]);
  const hl = $('#s0 .hilite');
  hl.style.left = (a.x + 10) + 'px';
  hl.style.width = (b.x + b.w - a.x - 20) + 'px';
  gsap.set(['#s0', '#s0 .tag0', '#s0 .title', '#s0 .sub'], {autoAlpha: 1});
  tl.to(ls, {y: -34, duration: 0.2, ease: 'power2.out', stagger: 0.07, yoyo: true, repeat: 1}, 0.25);
  ls.forEach((_, i) => cue(0.25 + i * 0.07, 'pop', 0.7, i));
  tl.to('#s0 .hilite', {scaleX: 1, duration: 0.7, ease: 'expo.out'}, 0.6);
  const m0 = '#s0 .mascot';
  gsap.set(m0, {autoAlpha: 0, y: 620, rotation: -6, transformOrigin: '50% 100%'});
  tl.to(m0, {autoAlpha: 1, y: 0, rotation: 0, duration: 1.0, ease: 'back.out(1.25)'}, 1.0);
  cue(1.0, 'whoosh', 0.8);
  tl.to(m0, {y: -12, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: 1, data: 'amb'}, 2.2);
  gsap.set('#s0 .bubble', {autoAlpha: 0, scale: 0.5, transformOrigin: '0% 40%'});
  tl.to('#s0 .bubble', {autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(1.9)'}, 1.65);
  cue(1.65, 'pop', 1, 3);
  tl.to(['#s0 .tag0', '#s0 .title', '#s0 .hilite', '#s0 .sub'], {autoAlpha: 0, y: -70, duration: 0.45, ease: 'power2.in', stagger: 0.04}, 4.4);
  tl.to(m0, {autoAlpha: 0, y: 500, duration: 0.5, ease: 'power2.in'}, 4.45);
  tl.to('#s0 .bubble', {autoAlpha: 0, scale: 0.8, duration: 0.3, ease: 'power2.in'}, 4.4);
  sceneOff('#s0', 5.0);
}

/* Récapitulatif « Les trois idées à retenir » : titre, carte, puis une idée à chaque instant donné. */
function recapScene(t0, rowTimes){
  sceneOn('#s7', t0);
  show('#s7 .rtitle', t0 + 0.05, {y: 34});
  cue(t0 + 0.05, 'whoosh', 0.6);
  show('#s7 .recap', t0 + 0.35, {y: 50}, 0.6);
  const rows = $$('#s7 .rrow');
  gsap.set(rows, {autoAlpha: 0, x: -36});
  rowTimes.forEach((t, i) => {
    tl.to(rows[i], {autoAlpha: 1, x: 0, duration: 0.55, ease: 'power3.out'}, t);
    cue(t, 'pop', 0.85, i * 2);
  });
}

/* ---------- Contrôles ---------- */
/* Chaque légende tient-elle dans la carte (3 lignes au plus) ? */
function checkCaptions(captions){
  const out = [];
  $$('#cap .c').forEach((el, i) => {
    const p = el.querySelector('p');
    const prev = el.style.visibility;
    el.style.visibility = 'visible';
    const lines = Math.round(p.getBoundingClientRect().height / stageScale().k / (44 * 1.32));
    el.style.visibility = prev;
    if (lines > 3) out.push({i, lines, text: captions[i][2]});
  });
  return out;
}
/* Une pause de lecture fige l’image : rien ne doit être en plein mouvement à cet instant
   (hors mouvements d’ambiance). Liste les animations interrompues, pour la mise au point. */
function holdClashes(){
  const out = [];
  const tweens = tl.getChildren(true, true, false).filter(c => !(c.vars && c.vars.data === 'amb'));
  HOLDS.forEach(([h]) => {
    tweens.forEach(c => {
      const a = c.startTime(), b = a + c.totalDuration();
      if (b - a > 0.002 && a < h - 0.001 && b > h + 0.001) {
        const tg = c.targets()[0];
        out.push({hold: h, at: +a.toFixed(2), to: +b.toFixed(2), el: tg && tg.id ? '#' + tg.id : (tg && tg.className ? '.' + String(tg.className).split(' ')[0] : '?')});
      }
    });
  });
  return out;
}

/* ---------- Le cours ---------- */
/* cfg : {duration, chapters, captions, questions, notesAt, glyphs, dom(), build()} */
function Course(cfg){
  const {duration, chapters, captions, questions = [], notesAt = null} = cfg;
  let out = 0;
  function renderAt(T){
    tl.seek(warp(T), true);
    const stage = document.getElementById('stage');
    stage.style.setProperty('--blink', Math.floor(T * 1.9) % 2 === 0 ? 1 : 0);
    if (!EMBED) {
      const b1 = $('.b1'), b2 = $('.b2');
      if (b1) b1.style.transform = `translate(${Math.sin(T * 0.21) * 60}px, ${Math.cos(T * 0.17) * 40}px)`;
      if (b2) b2.style.transform = `translate(${Math.cos(T * 0.15) * 70}px, ${Math.sin(T * 0.19) * 50}px)`;
    }
  }
  window.renderAt = renderAt;
  window.__ready = (async () => {
    buildChrome(chapters, captions);
    if (cfg.dom) cfg.dom();
    const fams = ['800 50px "Bricolage Grotesque"', '400 40px "Bricolage Grotesque"', '400 40px JBM', '500 40px JBM', '600 40px JBM', '700 40px JBM', '800 40px JBM',
      '400 40px Inter', '500 40px Inter', '600 40px Inter', '700 40px Inter', '400 40px "Noto Color Emoji"'];
    await Promise.all(fams.map(f => document.fonts.load(f, 'Aàé’' + (cfg.glyphs || ''))));
    await document.fonts.ready;
    chromeTimeline(chapters, captions, duration);
    cfg.build();
    tl.set({}, {}, duration);
    HOLDS = mergeHolds(captionHolds(captions, duration).concat(EXTRA_HOLDS));
    const total = HOLDS.reduce((a, h) => a + h[1], 0);
    out = +(duration + total).toFixed(3);
    renderAt(0);
    if (EMBED) dispatchEvent(new Event('resize'));
    return {duration: out, fps: FPS, cues: CUES.map(c => Object.assign({}, c, {t: unwarp(c.t)})), overflow: checkCaptions(captions),
      notesT: notesAt != null ? unwarp(notesAt) : null, holds: +total.toFixed(3), holdList: HOLDS, clashes: holdClashes(),
      chapters: chapters.map(c => ({t: unwarp(c.a), n: c.n, label: c.label})),
      questions: questions.map(q => ({t: unwarp(q.at), kicker: q.kicker, ctx: fr(q.ctx || ''), q: fr(q.q), options: q.options.map(o => ({label: o.label, ok: o.ok})), okTitle: fr(q.okTitle), koTitle: fr(q.koTitle), why: fr(q.why)})),
      /* Légendes en texte : le lecteur les annonce à VoiceOver au fil de l’animation. */
      captions: captions.map(c => ({a: unwarp(c[0]), b: unwarp(Math.min(c[1], duration)), text: plain(c[2])}))};
  })();
  /* Lecture en direct quand la page est ouverte seule dans un navigateur (?play). */
  if (QS.has('play')) {
    window.__ready.then(() => {
      const t0 = performance.now();
      const loop = () => { renderAt(((performance.now() - t0) / 1000) % out); requestAnimationFrame(loop); };
      loop();
    });
  }
}
