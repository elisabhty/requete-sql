/* Requête · moteur commun des cours animés (assets/anim/*.html).
   Une page contient ses scènes (HTML + CSS), charge gsap.min.js puis ce fichier, et décrit son déroulé avec Course({...}).
   Le moteur gère l’habillage (chapitre en haut à droite, légendes en bas), les pauses de lecture (d’après la longueur
   des légendes), l’export pour le lecteur de l’app (window.__ready : sons, chapitres, questions, légendes) et le rendu
   à un instant donné (window.renderAt).
   Temps : la timeline GSAP est en « temps de la timeline » ; les pauses (HOLDS) figent l’image, les coupes (cut) sautent
   un passage ; le lecteur compte en « temps de la vidéo » : warp / unwarp passent de l’un à l’autre. */
'use strict';
const FPS = 30;
const QS = new URLSearchParams(location.search);
/* ?app : version du cours dans l’app (le bouton « Ajouter à mes notes » et l’écran « À toi de jouer » sont ceux de l’app). */
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

/* Typographie française : espace insécable avant : ; ! ? et dans « », après un nombre et après les mots courts
   (articles, prépositions, conjonctions) pour qu’une ligne ne se termine jamais sur l’un d’eux. Hors balises et <code>. */
const SHORT_WORDS = new Set(('à au aux de du des d le la les l un une en et ou ni par sur sous pour dans avec sans chez vers entre ' +
  'ce cet cette ces son sa ses leur leurs mon ma mes ton ta tes notre votre nos vos chaque il elle on ils elles se ne que qu qui si y').split(' '));
const shortWord = w => SHORT_WORDS.has(w.toLowerCase().replace(/^[(«“"']+/, ''));
const glueShort = t => t.replace(/(\S+)( +)(?=\S|$)/g, (m, w) => shortWord(w) ? w + NB : m);
/* Un court libellé entre guillemets (« Nom du produit ») ne se coupe pas d’une ligne à l’autre. */
const glueQuotes = t => t.replace(/«([^«»]{1,28})»/g, (m, q) => '«' + q.replace(/ /g, NB) + '»');
/* Le prénom et le nom d’un client (« Sophie Martin ») restent ensemble sur la même ligne. */
const glueNames = t => t.replace(/(^|[^\p{L}])(Sophie|Lucas|Emma|Nathan|Chloé|Hugo|Léa|Gabriel|Inès|Salma|Moussa) (?=\p{Lu})/gu, '$1$2' + NB);
/* « l’atelier Pilates », « Cuisine saine », « Yoga du matin » ne se coupent pas. */
const glueAteliers = t => t.replace(/Cuisine saine|Yoga du[  ]matin|\batelier (?=Récup|Pil|Cuis|Méd|Yoga)/g, m => m.replace(/ /g, NB));
const frText = t => glueAteliers(glueNames(glueQuotes(glueShort(t.replace(/ ([:?!;»])/g, NB + '$1').replace(/« /g, '«' + NB).replace(/(\d) (?=\S)/g, '$1' + NB)))));
/* Légendes : une expression ne se coupe pas d’une ligne à l’autre. Certains mots ne terminent jamais une ligne
   (« du plus / cher »), d’autres ne la commencent jamais (« ne livre / pas »), un nombre reste collé au mot qui le
   précède (« donne / 24 »). */
const CAP_GLUE_NEXT = new Set(('très tout tous toute toutes deux trois quatre cinq six autre autres même mêmes plusieurs certains certaines quelques ' +
  'seul seule seuls seules aucun aucune propre premier première premiers premières dernier dernière nulle tel telle ' +
  'puis qu’un qu’une d’un d’une l’un l’une').split(' '));
const CAP_GLUE_PREV = new Set('pas jamais suivant suivante suivants suivantes compris comprise'.split(' '));
const CAP_PHRASES = ['tableau de bord', 'code de réduction', 'site web', 'par défaut', 'en premier', 'de haut en bas', 'de gauche à droite', 'date de début', 'date de fin'];
const capText = t => {
  t = t.replace(/(\S+)( +)(?=\S|$)/g, (m, w) => CAP_GLUE_NEXT.has(w.toLowerCase().replace(/^[(«“"']+/, '')) ? w + NB : m);
  t = t.replace(/([^\s,;:.!?]) +(?=(\S+))/g, (m, c, w) => CAP_GLUE_PREV.has(w.toLowerCase().replace(/[.,;:!?»)]+$/, '')) ? c + NB : m);
  t = t.replace(/((?:^|[ \u00a0])(?:le|la|les|du|au|aux|des)[ \u00a0](?:plus|moins)) +/gi, '$1' + NB);   // du plus cher, la plus ancienne
  t = t.replace(/(\b(?:plus|moins)) +(?=d[e’'])/gi, '$1' + NB);   // plus de 30 ans
  t = t.replace(/([\p{L}°%)]) +(?=\d)/gu, '$1' + NB);
  t = t.replace(/(\p{L}) +(?=n°\d)/gu, '$1' + NB);   // la commande n°16 : le numéro reste avec son nom
  CAP_PHRASES.forEach(p => { t = t.replace(new RegExp(p.replace(/ /g, '[  ]'), 'gi'), m => m.replace(/ /g, NB)); });
  return t;
};
function fr(h){
  let code = 0;
  const out = String(h).split(/(<[^>]+>)/).map(t => {
    if (/^<code[\s>]/.test(t)) { code++; return {t, txt: false}; }
    if (/^<\/code>/.test(t)) { code = Math.max(0, code - 1); return {t, txt: false}; }
    if (t[0] === '<') return {t, txt: false, tag: true};
    if (code) return {t, txt: false};
    return {t: capText(frText(t)), txt: true};
  });
  /* Nombre collé au mot qui le précède, même quand une balise les sépare (« revient <b>3 fois</b> »). */
  out.forEach((p, i) => {
    if (!p.txt || !/[\p{L}°%)] +$/u.test(p.t)) return;
    let j = i + 1;
    while (j < out.length && out[j].tag && !out[j].t.startsWith('<br')) j++;
    if (j < out.length && out[j].txt && /^\d/.test(out[j].t)) p.t = p.t.replace(/ +$/, NB);
  });
  return out.map(p => p.t).join('');
}
/* Même typographie pour les textes écrits directement dans la page (bulle, récapitulatif, cartes…), hors code. */
const NO_FR = 'code, .ic, .code, .mini, .codepill, .lk, .colchip, .th, .tr, .mt, .chips, .cnt, .emo, #cap';
function frDom(root){
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => {
    if (!n.parentElement || n.parentElement.closest(NO_FR)) return;
    const t = n.textContent, u = frText(t);
    if (u !== t) n.textContent = u;
  });
}
/* Texte brut d’une légende (lu par VoiceOver, et mesuré pour le temps de lecture) : <code>stock &lt;= 60</code> → « stock <= 60 ». */
const plain = h => fr(h).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, NB)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, 'x');

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
/* [instant, durée] : l’image reste affichée le temps de lire ; durée négative : passage coupé (cut). */
let HOLDS = [];
const EXTRA_HOLDS = [];
const CUTS = [];
function warp(T){
  let shift = 0;
  for (const [t, d] of HOLDS) {
    if (T <= t + shift) break;
    if (d < 0) { shift += d; continue; }
    if (T < t + shift + d) return t;
    shift += d;
  }
  return T - shift;
}
function unwarp(t){
  let s = 0;
  for (const [h, d] of HOLDS) {
    if (t <= h) break;
    if (d < 0 && t < h - d) return +(h + s).toFixed(3);   // instant coupé : rendu au début de la coupe
    s += d;
  }
  return +(t + s).toFixed(3);
}
/* Coupe (instant, durée) : l’image saute à la fin du passage ; rien ne doit s’y animer (?check). */
function cut(t, d){ CUTS.push([+t.toFixed(2), -Math.abs(+d.toFixed(2))]); }
const inCut = t => CUTS.some(([h, d]) => t > h + 0.001 && t < h - d - 0.001);
const cutIn = (a, b) => CUTS.reduce((s, [h, d]) => s + Math.max(0, Math.min(b, h - d) - Math.max(a, h)), 0);
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
    const miss = readTime(text) - ((b - 0.2) - (a + 0.3) - cutIn(a + 0.3, b - 0.2));
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
/* Transformations en 2D uniquement : sans calques GPU, le texte est dessiné à sa taille finale et reste net. */
gsap.config({force3D: false});
const tl = gsap.timeline({paused: true});
const CUES = [];
function cue(t, type, gain = 1, pitch = 0){ CUES.push({t: +t.toFixed(3), type, gain, pitch}); }
/* Son joué tout de suite (aperçu d’un moment « À toi ») : le lecteur fournit window.__sfx ; seule, la page reste muette. */
function sfx(type, pitch = 0, gain = 1){ try { if (typeof window.__sfx === 'function') window.__sfx(type, pitch, gain); } catch (e) {} }
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
/* Tampon (.stamp) qui tombe et se pose. */
function stampIn(sel, t, rot = 7){
  gsap.set(sel, {autoAlpha: 0, scale: 1.9, rotation: 24});
  tl.to(sel, {autoAlpha: 1, scale: 1, rotation: rot, duration: 0.36, ease: 'power4.in'}, t);
  cue(t + 0.35, 'stamp');
}
function sceneOff(sel, t){ tl.set(sel, {autoAlpha: 0}, t); }
/* Carte posée sous une autre carte (souvent inclinée) : son bord haut se cale à `gap` px sous le point le plus bas
   de la carte du dessus, une fois celle-ci à sa place (inclinaison finale `rot`, ombre comprise). */
const STACK_GAP = 40;
function stackBelow(lower, upper, rot = 0, gap = STACK_GAP){
  const up = $(upper), lo = $(lower);
  const w = up.offsetWidth, h = up.offsetHeight, a = Math.abs(rot) * Math.PI / 180;
  const m = /(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/.exec(getComputedStyle(up).boxShadow || '');
  const lip = m && parseFloat(m[3]) < 2 ? Math.max(0, parseFloat(m[2])) : 0;
  lo.style.top = Math.round(up.offsetTop + h / 2 + (h / 2) * Math.cos(a) + (w / 2) * Math.sin(a) + lip + gap) + 'px';
}

/* conf : confettis après l’appui (« Confettis », plus bas). */
function press(btn, t, lip = '#4B30CC', depth = 9, conf){
  tl.to(btn, {y: depth - 2, boxShadow: `0 2px 0 ${lip}`, duration: 0.09, ease: 'power2.out'}, t)
    .to(btn, {y: 0, boxShadow: `0 ${depth}px 0 ${lip}`, duration: 0.3, ease: 'back.out(2.2)'}, t + 0.13);
  const r = btn.querySelector('.ripple');
  if (r) {
    gsap.set(r, {scale: 0, opacity: 0});
    tl.to(r, {scale: 0, opacity: 0.55, duration: 0.001}, t)
      .to(r, {scale: 1, opacity: 0, duration: 0.7, ease: 'power2.out'}, t + 0.01);
  }
  cue(t, 'click');
  if (conf !== false) CONFETTI.push({el: btn, t, press: true, force: conf === true});
}

/* ---------- Confettis ----------
   Elisa, 26 octobre, 7 h 18 : « quand on appuie sur les boutons pour lancer requête ou triggers etc et que c’est pas une erreur ensuite
   mettre des confettis ». La page les annonce comme un son (repère « confetti », position du bouton sur la scène) ; le lecteur de l’app
   les lance en direct : une pause ne les fige jamais. Un appui (press) en reçoit, sauf échec : son d’échec juste après, erreur ou valeur
   fautive qui apparaît, essai d’un encadré piège sans son de réussite. press(…, false|true) tranche ; un bouton de l’élève : confetti(). */
const CONFETTI = [];
const FAIL_CUES = new Set(['error', 'empty', 'false', 'miss', 'buzz']), OK_CUES = new Set(['chord', 'success']);
function confetti(el, t){ if (el) CONFETTI.push({el, t, press: false, force: true}); }
function confettiCues(){
  if (!CONFETTI.length) return;
  const stage = $('#stage');
  const seen = el => { for (let n = el; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.3) return false; } const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const fails = () => new Set($$('.err, .emp, .ko, .bad', stage).filter(seen));
  const out = [];
  CONFETTI.forEach(c => {
    let at = c.t;
    if (c.press) {
      const next = CUES.filter(q => q.t > c.t + 0.001 && q.t <= c.t + 2.2).sort((a, b) => a.t - b.t).find(q => FAIL_CUES.has(q.type) || OK_CUES.has(q.type));
      const ok = !!next && OK_CUES.has(next.type);
      if (!c.force) {
        if (next && !ok) return;
        tl.seek(Math.max(0, c.t - 0.05), true);
        const before = fails();
        tl.seek(c.t + 1.6, true);
        if ([...fails()].some(e => !before.has(e))) return;
        if (!ok && c.el.closest('.trap')) return;
      }
      at = ok ? next.t : c.t + 0.5;
    }
    tl.seek(at, true);
    const r = rel(c.el);
    if (r.w < 1 && r.h < 1) return;
    out.push({t: +at.toFixed(3), type: 'confetti', gain: 1, pitch: 0, x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2)});
  });
  tl.seek(0, true);
  CUES.push(...out);
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

/* ---------- Un client écrit : SMS (Messages de l’iPhone) ---------- */
/* Un coach, l’équipe ou le développeur écrivent par mail ; un client écrit par SMS (le style est dans core.css) ; le service client, qui
   centralise les demandes des clients depuis le chapitre 5, écrit par SMS quand la page le dit (7e élément du message : {sms: true}),
   sinon par mail. La page crée la carte avec smsCard(), puis appelle smsIn() là où elle appellerait son mailIn(). */
const isSms = (tag, opt) => /^client/.test(tag) || !!(opt && opt.sms);
/* Heure d’envoi écrite en tête de la conversation : propre à chaque expéditeur, entre 07:00 et 18:59 ; un SMS de plus du même
   expéditeur (nth : son rang dans la page) arrive sept minutes plus tard, jamais à la même minute. */
const smsTime = (name, nth = 0) => {
  const h = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7), m = (7 + h % 12) * 60 + (h * 7) % 60 + nth * 7;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
};
/* Le rang du SMS n parmi ceux du même expéditeur dans la liste des messages de la page (0 pour le premier). */
const smsRank = (list, n) => list.slice(0, n).filter(m => m[0][0] === list[n][0][0] && m[0][1] === list[n][0][1] && isSms(m[2], m[6])).length;
/* Les bulles : « Bonjour, » (ou la formule de la page : hello, comme « Bonjour ! »), une bulle par phrase de la demande, « Merci ! ». Pas de signature : le nom est en haut de la conversation.
   hello : null, sans formule ; bye : null quand le message finit sur son propre merci (pas de « Merci ! » de plus). */
function smsParts(body, hello = 'Bonjour,', bye = 'Merci !'){
  const sentences = [].concat(body).flatMap(p => String(p).split(/(?<=[.!?])\s+(?=[A-ZÀÂÉÈÊÎÔÛÇ])/));
  return [hello, ...sentences, bye].filter(p => p !== null);
}
const SMS_ICO = {
  bubble: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.3 4.7 3.4 6.1L4.4 21l4.3-2.3c1.1.3 2.2.5 3.3.5 5.5 0 10-3.6 10-8.2S17.5 3 12 3z"/></svg>',
  back: '<svg class="sms-bk" viewBox="0 0 34 68"><path d="M27 6 7 34l20 28" fill="none" stroke="#007AFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  video: '<svg class="sms-vd" viewBox="0 0 68 50"><rect x="2" y="3" width="42" height="44" rx="12" fill="#007AFF"/><path d="M48 19.5 61.5 9.4c2.2-1.6 4.5-.5 4.5 2.2v27c0 2.7-2.3 3.8-4.5 2.2L48 30.5z" fill="#007AFF"/></svg>',
  plus: '<svg viewBox="0 0 38 38"><path d="M19 5v28M5 19h28" stroke="#8A8A8E" stroke-width="5.5" stroke-linecap="round"/></svg>',
  mic: '<svg viewBox="0 0 34 44"><rect x="10" y="2" width="14" height="26" rx="7" fill="#8A8A8E"/><path d="M4 21c0 8 5 13 13 13s13-5 13-13M17 34v8" fill="none" stroke="#8A8A8E" stroke-width="3.6" stroke-linecap="round"/></svg>'
};
/* La carte d’un SMS (#ml + id, comme un mail) : la bannière de notification, et la conversation qui s’ouvre à sa place.
   cmp : version compacte (sans date ni barre de saisie), là où la place manque ; nth : rang parmi les SMS du même expéditeur (smsRank) ;
   hello : la première bulle, quand la page ne veut pas « Bonjour, » (8e élément du message : {sms: true, hello: 'Bonjour !'}) ; null : aucune (data-hi). */
function smsCard(id, k, first, last, ini, body, cmp = false, nth = 0, hello, photo, bye){
  const parts = smsParts(body, hello, bye), name = last ? first + ' ' + last : first, said = hello === null ? 0 : 1;   // Lina (chapitre 20) n’a pas de nom
  /* Une photo jointe (photo : {id, src, alt}) : une bulle d’image juste avant « Merci ! » ; un appui l’agrandit
     (Elisa, 25 octobre, 17 h 05 : « afficher sous son message la photo du shaker rose cassé ; un appui permet d’agrandir la photo »).
     Un message qui finit sur son propre merci (bye: null) envoie sa photo en dernier : la consigne « Touche la photo » se pose dessous,
     sur la barre de saisie, sans cacher de phrase ; la dernière bulle de texte perd alors sa queue, comme dans Messages. */
  const end = photo && bye === null, tail = end ? -1 : parts.length - 1;
  const list = parts.map((p, j) => `<p class="sms-m${j === tail ? ' last' : ''}">${p}</p>`);
  if (photo) list.splice(end ? list.length : parts.length - 1, 0, `<p class="sms-m sms-ph" id="${photo.id}"><img src="${photo.src}" alt="${photo.alt}"></p>`);
  const bubbles = list.join('');
  const date = cmp ? '' : `<div class="sms-d">Message texte · SMS<br><b>Aujourd’hui</b> ${smsTime(name, nth)}</div>`;
  const bar = cmp ? '' : `<div class="sms-i"><i class="sms-pl">${SMS_ICO.plus}</i><div class="sms-in">Message texte · SMS${SMS_ICO.mic}</div></div>`;
  return `<div class="abs ml sms${cmp ? ' cmp' : ''} ${k}" id="ml${id}"${said ? '' : ' data-hi="0"'}>` +
    `<div class="card sms-n"><i class="sms-ic">${SMS_ICO.bubble}</i><div class="sms-nt"><div class="sms-nr"><b>${name}</b><span>maintenant</span></div><div class="sms-np">${parts[said].replace(/ ([:?!;»])/g, NB + '$1').replace(/« /g, '«' + NB)}</div></div></div>` +
    `<div class="card sms-v"><div class="sms-h">${SMS_ICO.back}${SMS_ICO.video}<i class="sms-av">${ini}</i><div class="sms-who">${name}<i>›</i></div></div>${date}` +
    `<div class="sms-b"><div class="sms-t"><i></i><i></i><i></i></div>${bubbles}</div>${bar}</div></div>`;
}
/* Chaque bulle se resserre sur sa ligne la plus longue : un texte qui passe à la ligne garderait sinon la largeur maximale de la bulle,
   avec du vide à droite. Appelée une fois, polices chargées, avant la timeline (aucune transformation en cours). */
function smsFit(){
  const {k} = stageScale(), range = document.createRange();
  $$('.sms-m').forEach(p => {
    p.style.width = '';
    range.selectNodeContents(p);
    const lines = [...range.getClientRects()].filter(x => x.width > 0);
    if (lines.length < 2) return;   // une seule ligne : la bulle est déjà à sa taille
    const cs = getComputedStyle(p);
    p.style.width = Math.ceil(Math.max(...lines.map(x => x.width)) / k) + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 2 + 'px';
  });
  /* L’aperçu d’une notification tient en deux lignes. Un texte plus long est coupé par « … » entre deux mots : line-clamp, lui, coupe au milieu
     d’un mot (« …son compte, ca… »). On le mesure sans line-clamp (en bloc), sur la hauteur de deux lignes, comme le fait l’iPhone. */
  $$('.sms-np').forEach(p => {
    const deux = 2 * parseFloat(getComputedStyle(p).lineHeight) + 2, css = p.style.cssText;
    p.style.cssText = 'display:block;overflow:visible';
    const mots = p.textContent.split(' ');   // les espaces insécables gardent leurs mots ensemble
    for (let n = mots.length - 1; n > 0 && p.offsetHeight > deux; n--) p.textContent = mots.slice(0, n).join(' ').replace(/[,;:]$/, '') + '…';
    p.style.cssText = css;
  });
}
/* Un SMS arrive : la bannière tombe (icône Messages, nom, début du message). À T, l’élève la touche (l’app s’arrête là, moment
   OPENS ; hors de l’app, la page montre un doigt) : elle s’enfonce, la conversation s’ouvre à sa place, « … » (il écrit), puis les
   bulles arrivent une à une. Chaque bulle reste seule le temps de la lire avant la suivante (Elisa, 26 octobre, 13 h 39 : « les messages
   défilent beaucoup trop vite, tout d’un coup ») : le temps de lecture de la demande, le même qu’avant, est réparti entre ses bulles.
   Renvoie l’instant de fin. fast : cadence serrée (conversation compacte), là où la légende suivante revient tout de suite. */
function smsIn(n, t, T, fast = false){
  const m = '#ml' + n, bubbles = $$(m + ' .sms-m'), dots = $(m + ' .sms-t');
  const open = fast ? 0.4 : 0.5, first = T + (fast ? 0.5 : 0.62), step = fast ? 0.25 : 0.28;   // la première bulle prend la place de « … »
  show(m, t, {y: -36, scale: 0.94}, 0.55, 'back.out(1.7)');
  cue(t, 'sms', 0.8);
  show(m + ' .sms-ic', t + 0.12, {y: 0, scale: 0.5}, 0.4, 'back.out(2.4)');
  tl.to(m, {scale: 0.975, duration: 0.09, ease: 'power2.out'}, T);
  tl.to(m, {scale: 1, duration: 0.3, ease: 'back.out(2.5)'}, T + 0.09);
  cue(T, 'click', 0.5);
  tl.to(m + ' .sms-n', {autoAlpha: 0, duration: 0.14, ease: 'power2.in'}, T + 0.12);
  gsap.set(m + ' .sms-v', {autoAlpha: 0, scaleX: 0.9, scaleY: 0.15});
  tl.to(m + ' .sms-v', {autoAlpha: 1, scaleX: 1, scaleY: 1, duration: open, ease: 'power3.out'}, T + 0.12);
  cue(T + 0.12, 'whoosh', 0.35);
  gsap.set(dots, {autoAlpha: 0, scale: 0.6, transformOrigin: '0% 100%'});
  tl.to(dots, {autoAlpha: 1, scale: 1, duration: 0.18, ease: 'back.out(2)'}, first - 0.22);
  tl.to($$('i', dots), {y: -9, duration: 0.12, stagger: 0.06, yoyo: true, repeat: 1, ease: 'sine.inOut', data: 'amb'}, first - 0.18);
  tl.set(dots, {autoAlpha: 0}, first);
  gsap.set(bubbles, {autoAlpha: 0, scale: 0.6, y: 14, transformOrigin: '0% 100%'});
  const pop = +(step - 0.03).toFixed(2);   // une bulle a fini d’apparaître avant la suivante : la pause de lecture tombe entre les deux
  bubbles.forEach((b, k) => {
    const at = first + k * step;
    tl.to(b, {autoAlpha: 1, scale: 1, y: 0, duration: pop, ease: 'back.out(1.8)'}, at);
    cue(at, 'tick', 0.4, k + 2);
  });
  const end = first + (bubbles.length - 1) * step + 0.35;
  /* Le temps de lire la demande : toutes les bulles après « Bonjour, » (s’il y est), sans « Merci ! » (un message qui finit sur son propre merci
     le compte). Chaque bulle en reçoit sa part, juste après être apparue, selon sa longueur ; la part de la dernière vient après la toute
     dernière bulle (« Merci ! » compris). Les parts sont arrondies au centième sans changer leur somme. */
  const hi = +!$(m).dataset.hi, merci = /^Merci\s*!$/.test(bubbles[bubbles.length - 1].textContent.trim());
  const said = bubbles.slice(hi, merci ? -1 : undefined);
  const total = Math.ceil(readTime(said.map(b => b.textContent).join(' ')) * 20) / 20;
  const lens = said.map(b => plain(b.textContent).length), sum = lens.reduce((x, y) => x + y, 0) || 1;
  let lu = 0, done = 0;
  said.forEach((b, k) => {
    lu += lens[k];
    const upto = k === said.length - 1 ? total : +(total * lu / sum).toFixed(2), d = +(upto - done).toFixed(2);
    done = upto;
    if (d > 0) hold(k === said.length - 1 ? end + 0.05 : first + (hi + k) * step + pop + 0.005, d);
  });
  return end;
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
    if (c[3] > 3) d.dataset.lines = c[3];   // 4e valeur d’une légende : nombre de lignes (4 au plus), la carte monte le temps de la lire
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
    if (captions[i][3] > 3) {
      const up = Math.round(44 * 1.32);
      tl.to(capCard, {top: capCard.offsetTop - up, height: capCard.offsetHeight + up, duration: 0.3, ease: 'power2.out'}, a);
      tl.to(capCard, {top: capCard.offsetTop, height: capCard.offsetHeight, duration: 0.3, ease: 'power2.in'}, b - 0.2);
    }
  });
}

/* ---------- Scènes communes ---------- */
/* Mesures ramenées à la scène 1080 × 1920, même quand elle est réduite (lecteur de l’app). */
function stageScale(){ const sr = $('#stage').getBoundingClientRect(); return {sr, k: sr.width / 1080 || 1}; }
function rel(el, ref){ const {sr, k} = stageScale(), r = el.getBoundingClientRect(), o = ref ? ref.getBoundingClientRect() : sr;
  return {x: (r.left - o.left) / k, y: (r.top - o.top) / k, w: r.width / k, h: r.height / k}; }

/* Intro, version vitrine (Elisa, 29 octobre : « OK avec la proposition », « le plus de micro animation possible »).
   La page garde son HTML (rubrique, titre en lettres, sous-titre, mascotte, bulle) ; introScene le met en scène dans une carte
   violette : le titre s’ajuste à la largeur de la carte, le souligné prend sa longueur, les retours à la ligne pensés pour
   l’ancienne intro centrée s’effacent, le sous-titre et la bulle se réduisent s’ils sont trop longs. Les pastilles (durée de la
   vidéo, moments « À toi ») se remplissent à la fin de Course, quand ces chiffres sont connus (introPills).
   Déroulé : première image = vignette (carte, rubrique, titre, sous-titre, pastilles en place) ; lettres qui sautillent à 0,25 s,
   souligné à 0,6 s, pastilles et reflet à 0,8 s, halo et mascotte à 1 s, étincelles à 1,3 s, bulle à 1,65 s, la mascotte salue,
   tout s’en va à 4,4 s. Tout passe par la timeline : le lecteur de l’app peut avancer, reculer et faire une pause. */
const SPARK = '<path d="M12 1c.9 6 4.9 10 11 11-6.1 1-10.1 5-11 11-.9-6-4.9-10-11-11 6.1-1 10.1-5 11-11Z"/>';
function introScene(){
  const s0 = $('#s0'); s0.classList.add('nv');
  const mk = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };
  const card = mk('<div class="abs iv-card"><div class="abs iv-glow"></div><div class="abs iv-ring"></div><div class="abs iv-halo"></div></div>');
  s0.insertBefore(card, s0.firstChild);
  const title = $('#s0 .title'), sub = $('#s0 .sub'), bubble = $('#s0 .bubble');
  [sub, bubble].forEach(el => el && el.querySelectorAll('br').forEach(br => br.replaceWith(' ')));
  /* Titre : la plus grande taille qui tient dans la carte (de 250 à 96 px) */
  let fs = 250; title.style.fontSize = fs + 'px';
  while (title.scrollWidth > 840 && fs > 96) { fs -= 4; title.style.fontSize = fs + 'px'; }
  const tb = 352 + fs * 0.95;
  const sw = mk('<svg class="abs iv-sw" viewBox="0 0 720 60" preserveAspectRatio="none" aria-hidden="true"><path d="M10 40C200 14 470 8 710 26"/></svg>');
  title.after(sw);
  sw.style.width = Math.max(200, Math.min(840, title.scrollWidth)) + 'px';
  sw.style.top = (tb + 4 - fs * 0.02) + 'px';
  /* Sous-titre : deux lignes au plus */
  let fsub = 84; sub.style.top = (tb + 82) + 'px'; sub.style.fontSize = fsub + 'px';
  while (sub.scrollHeight > fsub * 1.06 * 2 + 4 && fsub > 52) { fsub -= 4; sub.style.fontSize = fsub + 'px'; }
  const pills = mk('<div class="abs iv-pills"><span class="iv-pill w"><span class="iv-shine"></span><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5Z"/></svg><b class="iv-dur"></b></span><span class="iv-pill g iv-mom"></span></div>');
  sub.after(pills);
  pills.style.top = (tb + 82 + sub.scrollHeight + 48) + 'px';
  /* Bulle : elle tient entre le haut de la mascotte et le bas de la carte */
  let fb = 44; bubble.style.fontSize = fb + 'px';
  while ((bubble.offsetHeight > 470 || bubble.scrollWidth > bubble.clientWidth + 1) && fb > 30) { fb -= 2; bubble.style.fontSize = fb + 'px'; }
  ['<svg class="abs iv-spark s1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">',
    '<svg class="abs iv-spark s2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">',
    '<svg class="abs iv-spark s3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">',
    '<svg class="abs iv-spark s4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'].forEach(o => s0.appendChild(mk(o + SPARK + '</svg>')));

  const ls = $$('#s0 .title span'), path = $('#s0 .iv-sw path'), L = path.getTotalLength();
  gsap.set(['#s0', '#s0 .iv-card', '#s0 .tag0', '#s0 .title', '#s0 .sub', '#s0 .iv-pills', '#s0 .iv-spark.s1'], {autoAlpha: 1});
  gsap.set(path, {strokeDasharray: L, strokeDashoffset: L});
  gsap.set('#s0 .iv-sw', {autoAlpha: 0});
  /* Lettres qui sautillent, chacune avec un petit pas de côté */
  tl.to(ls, {y: -40, rotation: i => (i % 2 ? 5 : -5), duration: 0.2, ease: 'power2.out', stagger: 0.07, yoyo: true, repeat: 1}, 0.25);
  ls.forEach((_, i) => cue(0.25 + i * 0.07, 'pop', 0.7, i));
  tl.set('#s0 .iv-sw', {autoAlpha: 1}, 0.6);
  tl.to(path, {strokeDashoffset: 0, duration: 0.75, ease: 'expo.out'}, 0.6);
  tl.fromTo('#s0 .tagpill', {x: 0}, {x: 10, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1}, 0.55);
  /* Pastilles : petit rebond l’une après l’autre, puis un reflet passe sur la blanche */
  tl.to('#s0 .iv-pill', {scale: 1.07, duration: 0.18, ease: 'power2.out', stagger: 0.09, yoyo: true, repeat: 1}, 0.8);
  cue(0.8, 'pop', 0.45, 2);
  gsap.set('#s0 .iv-shine', {x: -120});
  tl.to('#s0 .iv-shine', {x: 420, duration: 0.7, ease: 'power2.inOut'}, 0.95);
  /* Halo, puis la mascotte sort de la carte */
  gsap.set('#s0 .iv-halo', {autoAlpha: 0, scale: 0.6, transformOrigin: '50% 50%'});
  tl.to('#s0 .iv-halo', {autoAlpha: 1, scale: 1, duration: 0.8, ease: 'expo.out'}, 0.95);
  const m0 = '#s0 .mascot';
  gsap.set(m0, {autoAlpha: 0, y: 620, rotation: -6, transformOrigin: '50% 100%'});
  tl.to(m0, {autoAlpha: 1, y: 0, rotation: 0, duration: 1.0, ease: 'back.out(1.25)'}, 1.0);
  cue(1.0, 'whoosh', 0.8);
  tl.to(m0, {y: -14, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: 1, data: 'amb'}, 2.2);
  tl.to(m0, {rotation: -3, duration: 0.22, ease: 'sine.inOut', yoyo: true, repeat: 3, data: 'amb'}, 2.3);
  /* Étincelles : elles apparaissent, puis scintillent */
  gsap.set(['#s0 .iv-spark.s2', '#s0 .iv-spark.s3', '#s0 .iv-spark.s4'], {autoAlpha: 0, scale: 0.4, transformOrigin: '50% 50%'});
  tl.to(['#s0 .iv-spark.s2', '#s0 .iv-spark.s3', '#s0 .iv-spark.s4'], {autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.12}, 1.3);
  tl.to('#s0 .iv-spark', {rotation: 25, scale: 0.75, duration: 0.7, ease: 'sine.inOut', yoyo: true, repeat: 3, stagger: 0.2, data: 'amb'}, 1.9);
  tl.to('#s0 .iv-glow', {x: -60, y: 40, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: 1, data: 'amb'}, 0);
  /* Bulle « autocollant » */
  gsap.set('#s0 .bubble', {autoAlpha: 0, scale: 0.5, rotation: 2.5, transformOrigin: '0% 30%'});
  tl.to('#s0 .bubble', {autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(1.9)'}, 1.65);
  cue(1.65, 'pop', 1, 3);
  /* Sortie */
  tl.to(['#s0 .tag0', '#s0 .title', '#s0 .iv-sw', '#s0 .sub', '#s0 .iv-pills'], {autoAlpha: 0, y: -70, duration: 0.45, ease: 'power2.in', stagger: 0.04}, 4.4);
  tl.to('#s0 .bubble', {autoAlpha: 0, scale: 0.8, duration: 0.3, ease: 'power2.in'}, 4.4);
  tl.to(m0, {autoAlpha: 0, y: 500, duration: 0.5, ease: 'power2.in'}, 4.45);
  tl.to(['#s0 .iv-card', '#s0 .iv-spark'], {autoAlpha: 0, scale: 0.96, duration: 0.45, ease: 'power2.in'}, 4.55);
  sceneOff('#s0', 5.0);
}
/* Pastilles de l’intro : durée réelle de la vidéo (pauses de lecture comprises) et nombre de moments « À toi ». */
function introPills(seconds, moments){
  const d = $('#s0.nv .iv-dur'), m = $('#s0.nv .iv-mom'); if (!d) return;
  const t = Math.round(seconds), mn = Math.floor(t / 60), sc = t % 60;
  d.textContent = mn ? mn + ' min ' + String(sc).padStart(2, '0') : sc + ' s';
  if (moments > 0) m.textContent = moments + (moments > 1 ? ' moments' : ' moment') + ' « À' + NB + 'toi' + NB + '»';
  else m.remove();
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
    if (lines > (captions[i][3] || 3)) out.push({i, lines, text: captions[i][2]});
  });
  return out;
}
/* Mise en forme du texte (?check) : pour chaque bloc, les lignes telles qu’elles s’affichent (police livrée : mêmes lignes sur iPhone).
   Signale : mot orphelin, ligne trop courte (trou), bloc serré (< 70 % de la largeur), légende de plus de 3 lignes, mot coupé. */
const TEXT_BLOCKS = '#cap .c p, .bubble, .rtxt, .lt, .nl, .mnote, .tx, .trap-h, .ot, .need-h, .inv-title, .inv-place, .qlabel, .glbl, .badge span, .tp-h, .sub, .tagpill, .ask, .wl, .resl';
function textLines(el){
  const toks = [], r = document.createRange(), walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  /* Bloc qui porte un texte : passer d’un bloc à un autre (ou franchir un <br>) est un retour à la ligne voulu. */
  const blockOf = node => { for (let e = node.parentElement; e && e !== el; e = e.parentElement) if (!/^(inline|contents)$/.test(getComputedStyle(e).display)) return e; return el; };
  let br = false, prev = null;
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (n.nodeType === 1) { if (n.tagName === 'BR') br = true; continue; }
    if (n.parentElement.closest('.caret, .emo')) continue;
    const block = blockOf(n), re = /[^\s\u00a0]+/g; let m;
    while ((m = re.exec(n.textContent))) {
      r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      const rects = [...r.getClientRects()].filter(x => x.width > 0);
      if (!rects.length) continue;
      toks.push({w: m[0], top: rects[0].top, h: rects[0].height, left: rects[0].left, right: rects[rects.length - 1].right,
        split: rects.length > 1 && Math.abs(rects[0].top - rects[rects.length - 1].top) > rects[0].height / 2,
        blk: !!n.parentElement.closest('.blk'), brk: br || (prev !== null && block !== prev)});
      br = false; prev = block;
    }
  }
  const lines = [];
  toks.forEach(t => {
    const L = lines.find(l => Math.abs(l.top - t.top) < t.h * 0.6);
    if (L) L.toks.push(t); else lines.push({top: t.top, toks: [t]});
  });
  lines.sort((a, b) => a.top - b.top);
  lines.forEach(l => l.toks.sort((a, b) => a.left - b.left));
  return lines;
}
/* Une ligne (sauf la dernière) qui s’arrête avant 70 % de la largeur (78 % dans une légende) et nettement plus courte
   qu’une voisine laisse un trou : un groupe de mots collés trop long est parti à la ligne suivante. Une dernière ligne
   sous 36 % de la largeur est un bout de phrase isolé. Une expression en gras de quatre mots au plus ne se coupe pas. */
const SHORT_LINE = 0.7, SHORT_LINE_CAP = 0.78, NARROW_BLOCK = 0.7, STUB_LINE = 0.36, BOLD_WORDS = 4;
function textIssues(){
  const out = [];
  /* Mesures sans les transformations en cours (cartes inclinées, scène réduite) : les mots d’une même ligne ont la même hauteur. */
  const neutral = document.createElement('style');
  neutral.textContent = '#stage *{transform:none !important;rotate:none !important;scale:none !important;translate:none !important}';
  document.head.append(neutral);
  $$(TEXT_BLOCKS).forEach(el => {
    const lines = textLines(el);
    if (!lines.length) return;
    const words = l => l.toks.filter(t => !/^[.,;:!?»)…]+$/.test(t.w));
    const text = lines.map(l => l.toks.map(t => t.w).join(' '));
    const isCap = !!el.closest('#cap');
    /* Ligne qui forme à elle seule un bloc (titre court comme « API », au-dessus de sa description) : pas un mot orphelin. */
    const alone = i => (i === 0 || lines[i].toks[0].brk) && (i === lines.length - 1 || lines[i + 1].toks[0].brk);
    lines.forEach((l, i) => {
      const w = words(l);
      if (lines.length > 1 && w.length === 1 && !w[0].blk && !alone(i)) out.push({kind: 'orphelin', where: isCap ? 'légende' : el.className || el.tagName, line: i + 1, text});
      const last = l.toks[l.toks.length - 1];
      if (i < lines.length - 1 && last && shortWord(last.w)) out.push({kind: 'ligne finie par un mot court', where: isCap ? 'légende' : el.className || el.tagName, line: i + 1, text});
      if (l.toks.some(t => t.split)) out.push({kind: 'mot coupé', where: el.className || el.tagName, line: i + 1, text});
    });
    if (isCap && lines.length > (+el.closest('.c').dataset.lines || 3)) out.push({kind: 'plus de 3 lignes', where: 'légende', line: lines.length, text});
    if (lines.length > 1) {
      const cs = getComputedStyle(el), k = el.getBoundingClientRect().width / (el.offsetWidth || 1);
      const avail = (el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * k;
      const width = l => l.toks[l.toks.length - 1].right - l.toks[0].left;
      lines.forEach((l, i) => {
        if (i === lines.length - 1 || lines[i + 1].toks[0].brk) return;
        const w = width(l), next = width(lines[i + 1]), prev = i && !l.toks[0].brk ? width(lines[i - 1]) : 0;
        if (w < avail * (isCap ? SHORT_LINE_CAP : SHORT_LINE) && w < 0.8 * Math.max(prev, next))
          out.push({kind: 'ligne trop courte', where: isCap ? 'légende' : el.className || el.tagName, line: i + 1, text, ratio: +(w / avail).toFixed(2)});
      });
      /* Trois lignes ou plus (entre deux retours voulus) qui restent toutes sous 70 % de la largeur : le bloc paraît serré. */
      let seg = [];
      [...lines, null].forEach((l, i) => {
        if (l && !(i && l.toks[0].brk)) { seg.push(l); return; }
        if (seg.length >= 3 && Math.max(...seg.slice(0, -1).map(width)) < avail * NARROW_BLOCK)
          out.push({kind: 'bloc étroit', where: isCap ? 'légende' : el.className || el.tagName, line: lines.indexOf(seg[0]) + 1, text, ratio: +(Math.max(...seg.slice(0, -1).map(width)) / avail).toFixed(2)});
        if (seg.length >= 2 && width(seg[seg.length - 1]) < avail * STUB_LINE)
          out.push({kind: 'dernière ligne trop courte', where: isCap ? 'légende' : el.className || el.tagName, line: lines.indexOf(seg[seg.length - 1]) + 1, text, ratio: +(width(seg[seg.length - 1]) / avail).toFixed(2)});
        seg = l ? [l] : [];
      });
    }
    /* Une courte expression en gras (« table clients », « plus de 30 ans », jusqu’à quatre mots) reste sur une seule ligne. */
    $$('b', el).forEach(b => {
      const rs = [...b.getClientRects()].filter(x => x.width > 0);
      if (b.textContent.trim().split(/[\s ]+/).length <= BOLD_WORDS && rs.length > 1 && Math.abs(rs[0].top - rs[rs.length - 1].top) > rs[0].height / 2)
        out.push({kind: 'gras coupé', where: isCap ? 'légende' : el.className || el.tagName, line: 0, text: [b.textContent, ...text]});
    });
  });
  neutral.remove();
  return out;
}

/* Cadres collés (?check) : deux cadres visibles en même temps (cartes, éditeurs, encadrés, pastilles, légende, puce de
   chapitre) gardent 20 px d’écart, ombre comprise ; les tampons et ce qui s’envole (.fly) ne comptent pas.
   Surlignages coupés : un surlignage visible n’est jamais rogné par un parent qui masque ce qui dépasse.
   La timeline est parcourue par pas de 0,2 s ; un défaut d’un instant (rebond, ouverture) est ignoré. */
const CARD_GAP = 20;
function layoutIssues(render, total){
  const stage = $('#stage');
  const shown = el => { let o = 1; for (let n = el; n && n !== document.body; n = n.parentElement) {
    const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= parseFloat(cs.opacity); } return o; };
  const isBox = el => { const cs = getComputedStyle(el); return el.tagName !== 'IMG' && !el.classList.contains('mascot') &&
    (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none'); };
  const set = new Set();
  const take = el => { if (!el.classList.contains('stamp') && !el.classList.contains('fly') && !el.parentElement.closest('.card, .code')) set.add(el); };
  $$('.card, .code', stage).forEach(take);
  $$('section.scene > *', stage).forEach(el => { if (isBox(el)) take(el); });
  $$('.badge span, .tagpill, .pill > span', stage).forEach(el => { if (!el.closest('.card, .code')) set.add(el); });
  $$('#cap .c, #chap .chip').forEach(el => set.add(el));
  const items = [...set].map(el => {
    const m = /(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/.exec(getComputedStyle(el).boxShadow || ''), sc = el.closest('section');
    return {el, lip: m && parseFloat(m[3]) < 2 ? Math.max(0, parseFloat(m[2])) : 0,
      name: (sc && sc.id ? sc.id + ' ' : '') + (el.id ? '#' + el.id : '') + '.' + [...el.classList].filter(c => c !== 'abs').join('.')};
  });
  const hls = $$('.mbox, .glw, .band, .zone, .grp, .prd, .hlc, .glow, .hl, .mark, .ring', stage).map(el => {
    const host = el.closest('[id]');
    return {el, name: (host && host !== el ? '#' + host.id + ' ' : '') + (el.id ? '#' + el.id : '') + '.' + [...el.classList].join('.')};
  });
  /* Débordement : élément ou texte qui sort de son cadre (le premier cadre visible autour de lui) ; les repères en surplomb
     (position absolue) ne comptent pas. */
  const pos = el => getComputedStyle(el).position;
  const CHROME = '#cap, #chapter, #progress, #header, .blob, .mascot, svg';
  /* Un cadre qui rogne son contenu (volet qui défile) n’est pas une référence. */
  const clips = el => getComputedStyle(el).overflowX !== 'visible' || getComputedStyle(el).overflowY !== 'visible';
  const frameOf = el => {
    for (let n = el; n && n !== stage; n = n.parentElement) {
      if (n !== el && clips(n)) return null;
      if (n !== el && isBox(n)) return n;
      if (/^(absolute|fixed)$/.test(pos(n))) return n !== el && isBox(n) ? n : null;
    }
    return null;
  };
  const flows = [];
  $$('*', stage).forEach(el => {
    if (el.closest(CHROME) || el.tagName === 'BR' || el.tagName === 'IMG') return;
    /* Élément : seulement s’il se voit ; un conteneur invisible est jugé par ses textes. */
    if (!/^(absolute|fixed)$/.test(pos(el)) && isBox(el)) { const f = frameOf(el); if (f) flows.push({el, f}); }
    [...el.childNodes].forEach(t => {
      if (t.nodeType !== 3 || !t.textContent.trim()) return;
      const f = isBox(el) && !clips(el) ? el : frameOf(el);
      if (f && !(f !== el && /^(absolute|fixed)$/.test(pos(el)))) flows.push({el, f, t});
    });
  });
  const label = el => { const sc = el.closest('section'); return (sc && sc.id ? sc.id + ' ' : '') + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].filter(c => c !== 'abs').join('.') : el.tagName.toLowerCase()); };
  const seen = el => el.checkVisibility ? el.checkVisibility({opacityProperty: true, visibilityProperty: true}) : shown(el) > 0.3;
  const range = document.createRange();
  const found = new Map();
  let prev = new Set();
  const keep = (key, f) => { if (prev.has(key)) { const g = found.get(key) || f; g.gap = Math.min(g.gap, f.gap); found.set(key, g); } };
  for (let T = 0; T <= total; T += 0.2) {
    render(T);
    const sr = stage.getBoundingClientRect(), now = new Set(), k = sr.width / 1080 || 1;
    if (Math.round(T * 10) % 10 === 0) flows.forEach(({el, f, t}) => {
      if (!seen(el) || !seen(f)) return;
      let r; if (t) { range.selectNodeContents(t); r = range.getBoundingClientRect(); } else r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const b = f.getBoundingClientRect();
      /* Texte : en hauteur, tolérance d’un tiers de corps (interligne). */
      const lead = t ? parseFloat(getComputedStyle(el).fontSize) * k / 3 : 0;
      const over = Math.max(b.left - r.left, r.right - b.right, b.top - r.top - lead, r.bottom - b.bottom - lead) / k;
      if (over <= 3) return;
      const key = 'débordement ' + label(f) + ' ← ' + (t ? '« ' + t.textContent.trim().slice(0, 24) + ' »' : label(el));
      now.add(key);
      keep(key, {kind: 'débordement', where: key.slice(12), gap: -Math.round(over), at: +T.toFixed(1)});
    });
    else prev.forEach(key => { if (key.startsWith('débordement ')) now.add(key); });   // vérifié chaque seconde
    hls.forEach(h => {
      if (shown(h.el) < 0.3) return;
      const cs = getComputedStyle(h.el);
      if (/^rgba\([^)]*,\s*0\)$/.test(cs.backgroundColor) && cs.boxShadow === 'none') return;
      const r = h.el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
      for (let n = h.el.parentElement; n && n !== stage; n = n.parentElement) {
        const ns = getComputedStyle(n);
        if (ns.overflowX === 'visible' && ns.overflowY === 'visible') continue;
        const p = n.getBoundingClientRect(), x1 = p.left + parseFloat(ns.borderLeftWidth), y1 = p.top + parseFloat(ns.borderTopWidth);
        const cut = Math.max(x1 - r.left, y1 - r.top, r.right - (x1 + n.clientWidth), r.bottom - (y1 + n.clientHeight));
        if (cut > 1.5 && cut < Math.min(r.width, r.height) * 0.95) {
          const key = 'surlignage ' + h.name;
          now.add(key);
          keep(key, {kind: 'surlignage coupé', where: h.name, gap: -Math.round(cut), at: +T.toFixed(1)});
          break;
        }
      }
    });
    const vis = items.filter(it => shown(it.el) >= 0.9).map(it => { const r = it.el.getBoundingClientRect();
      return Object.assign({x1: r.left - sr.left, y1: r.top - sr.top, x2: r.right - sr.left, y2: r.bottom - sr.top + it.lip}, it); })
      .filter(b => b.x2 - b.x1 > 4 && b.y2 - b.y1 > 4);
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      const a = vis[i], b = vis[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const gap = Math.max(b.x1 - a.x2, a.x1 - b.x2, b.y1 - a.y2, a.y1 - b.y2);
      if (gap >= CARD_GAP) continue;
      const key = a.name + ' ↔ ' + b.name;
      now.add(key);
      keep(key, {kind: 'cadres collés', where: key, gap: Math.round(gap), at: +T.toFixed(1)});
    }
    prev = now;
  }
  render(0);
  return [...found.values()];
}

/* Une pause de lecture fige l’image : rien ne doit être en plein mouvement à cet instant (hors ambiance) ; les moments
   « À toi » (picks) arrêtent aussi l’image et sont vérifiés de même. Liste les animations interrompues. */
/* Gestes joués sur l’image ; tout autre kind (on, join… de Quel JOIN) reste un choix d’étiquette. */
const GESTURES = ['tap', 'sort', 'link', 'tune'];
function holdClashes(extra = []){
  const out = [];
  const tweens = tl.getChildren(true, true, false).filter(c => !(c.vars && c.vars.data === 'amb'));
  const name = c => { const tg = c.targets()[0]; return tg && tg.id ? '#' + tg.id : (tg && tg.className ? '.' + String(tg.className).split(' ')[0] : '?'); };
  HOLDS.filter(h => h[1] > 0).map(h => [h[0]]).concat(extra.map(t => [t])).forEach(([h]) => {
    tweens.forEach(c => {
      const a = c.startTime(), b = a + c.totalDuration();
      if (b - a > 0.002 && a < h - 0.001 && b > h + 0.001) out.push({hold: h, at: +a.toFixed(2), to: +b.toFixed(2), el: name(c)});
    });
  });
  /* Passage coupé : ni animation, ni pause, ni moment, ni son. */
  CUTS.forEach(([h, d]) => {
    const e = h - d;
    tweens.forEach(c => {
      const a = c.startTime(), b = a + c.totalDuration();
      if (b - a > 0.002 && a < e - 0.001 && b > h + 0.001) out.push({cut: h, at: +a.toFixed(2), to: +b.toFixed(2), el: name(c)});
    });
    HOLDS.filter(x => x[1] > 0).map(x => x[0]).concat(extra).filter(t => t > h - 0.001 && t < e + 0.001).forEach(t => out.push({cut: h, inside: t}));
    CUES.filter(c => c.t > h - 0.001 && c.t < e + 0.001).forEach(c => out.push({cut: h, cue: c.t, type: c.type}));
  });
  return out;
}

/* Bas du contenu visible, sur la maquette 1080 × 1920 : cartes, éditeurs et encadrés (ni la légende, ni la puce de chapitre, ni les
   tampons ni ce qui s’envole). Le lecteur s’en sert pour que la feuille de réponse ne touche jamais le contenu : quand elle monte trop
   haut (petit écran, question longue), il réduit l’image juste assez. null quand il n’y a rien à voir. */
function contentBottom(){
  const stage = $('#stage'); if (!stage) return null;
  const sr = stage.getBoundingClientRect(), k = sr.width / 1080 || 1;
  const shown = el => { let o = 1; for (let n = el; n && n !== document.body; n = n.parentElement) {
    const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= parseFloat(cs.opacity); } return o; };
  const isBox = el => { const cs = getComputedStyle(el); return el.tagName !== 'IMG' && !el.classList.contains('mascot') &&
    (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none'); };
  const set = new Set();
  const take = el => { if (!el.classList.contains('stamp') && !el.classList.contains('fly') && !el.parentElement.closest('.card, .code')) set.add(el); };
  /* La carte d’un moment « À toi » (moments.js) compte aussi ; posée sur un voile, elle est seule à compter. */
  const veil = $('.mb-veil', stage);
  $$(veil ? '.mb' : '.card, .code, .mb', stage).forEach(take);
  if (!veil) $$('section.scene > *', stage).forEach(el => { if (isBox(el)) take(el); });
  /* Une pastille centrée (.pack : « 6 situations à ranger », « 2 clés étrangères »…) : son conteneur est transparent et c’est elle qui porte le cadre.
     Sans elle, la feuille de réponse la recouvrait (Elisa, 25 octobre, 15 h 48 : « la pastille qu’on ne voit pas »). */
  if (!veil) $$('section.scene > .pack > span', stage).forEach(take);
  let best = null;
  set.forEach(el => {
    if (el.closest('#cap, #chapter, #chap') || shown(el) < 0.3) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const b = (r.bottom - sr.top) / k; if (best === null || b > best) best = b;
  });
  return best === null ? null : +best.toFixed(1);
}

/* ---------- La fin de la vidéo, avant le chapitre « À retenir » ---------- */
/* La scène d’avant s’efface juste avant le chapitre (ses fondus de sortie, dans la seconde qui précède) : la vidéo s’arrête
   sur l’image d’avant ces fondus. */
function recapEnd(a, end){
  const chrome = el => el && el.closest && el.closest('#cap, #chapter, #progress, #header');
  const outs = tl.getChildren(true, true, false).filter(tw => {
    const s = tw.startTime(), v = tw.vars || {}, tg = (tw.targets() || []).filter(x => x && x.nodeType === 1);
    return s >= a - 1.0 && s < a - 0.01 && v.data !== 'amb' && (v.autoAlpha === 0 || v.opacity === 0) && !(tg.length && tg.every(chrome));
  }).map(tw => tw.startTime());
  return outs.length ? Math.min(end, +(Math.min(...outs) - 0.02).toFixed(2)) : end;
}
/* La dernière image reste le temps de lire la dernière légende (sans fondu de sortie), puis un instant, avant le bilan de l’app. */
const RECAP_REST = 1.2;
function recapRest(captions, end){
  const c = captions[captions.length - 1];
  const miss = c && c[1] >= end ? readTime(c[2]) - ((end - 0.05) - (c[0] + 0.3) - cutIn(c[0] + 0.3, end)) : 0;
  return [[+(end - 0.02).toFixed(2), Math.ceil((Math.max(0, miss) + RECAP_REST) * 20) / 20]];
}

/* ---------- Le cours ---------- */
/* cfg : {duration, chapters, captions, questions, picks, notesAt, glyphs, dom(), build(), onRender(T)} */
function Course(cfg){
  /* Les moments « À toi » ajoutés aux cours d’avant le projet (moments.js) : leurs temps deviennent ceux de la vidéo avec ses moments. */
  if (cfg.moments && !QS.has('nomoments')) cfg = withMoments(cfg);   // ?nomoments : la vidéo sans ses moments (pour en placer de nouveaux)
  let {duration, chapters, captions, questions = [], picks = [], opens = [], notesAt = null} = cfg;
  /* « Ce que tu retiens » n’est plus dans les vidéos : il est dans le bilan de la leçon, avec le bouton « Ajouter à mes notes » et sa
     flèche (Elisa, 27 octobre, 9 h 43). La vidéo s’arrête avant son chapitre « À retenir » (les pages le gardent : ?recap le remontre),
     sur la dernière image de la scène d’avant, sa légende encore affichée : la sortie de la scène (ses fondus, juste avant le chapitre)
     est retirée après la construction (recapEnd), et l’image reste le temps de lire la légende, puis un instant (RECAP_REST). */
  const RECAP_CH = chapters.findIndex(c => c.label === 'À retenir');
  const RECAP_A = RECAP_CH > 0 && !QS.has('recap') ? chapters[RECAP_CH].a : null;
  if (RECAP_A != null) {
    duration = +(RECAP_A - 0.05).toFixed(2);
    chapters = chapters.slice(0, RECAP_CH).map((c, i, a) => i === a.length - 1 ? Object.assign({}, c, {b: duration}) : c);
    captions = captions.filter(c => c[0] < duration - 0.3);
    const k = captions.length - 1;
    if (k >= 0 && plain(captions[k][2]) !== 'À toi !') captions[k] = [captions[k][0], 999].concat(captions[k].slice(2));
    notesAt = null;
  }
  let out = 0;
  function renderAt(T){
    const t = warp(T);
    /* Avant de dessiner l’image, la page retire l’aperçu d’un moment « À toi » que la timeline va montrer (sinon la réponse réapparaîtrait en reculant). */
    if (cfg.beforeRender) cfg.beforeRender(t);
    tl.seek(t, true);
    const stage = document.getElementById('stage');
    stage.style.setProperty('--blink', Math.floor(T * 1.9) % 2 === 0 ? 1 : 0);
    if (!EMBED) {
      const b1 = $('.b1'), b2 = $('.b2');
      if (b1) b1.style.transform = `translate(${Math.sin(T * 0.21) * 60}px, ${Math.cos(T * 0.17) * 40}px)`;
      if (b2) b2.style.transform = `translate(${Math.cos(T * 0.15) * 70}px, ${Math.sin(T * 0.19) * 50}px)`;
    }
    /* La page peut suivre le rendu (aperçu d’un moment « À toi » retiré quand la timeline montre la même image). */
    if (cfg.onRender) cfg.onRender(T);
  }
  window.renderAt = renderAt;
  window.__contentBottom = contentBottom;
  /* L’élève appuie sur l’élément d’un arrêt « opens » : le lecteur le signale dès le toucher, avant le relâcher, et l’élément s’enfonce
     aussitôt (press : l’état enfoncé) ; il revient au repos (rest) si le doigt glisse hors de la zone, et remonte d’un rebond au relâcher
     ('release'), pendant que la lecture reprend et que la page joue la suite (Elisa, 25 octobre, 16 h 22 : « micro interaction quand on appuie
     sur le bouton »). Ces deux états ne passent pas par la timeline : revenir en arrière ne montre jamais le bouton enfoncé. */
  window.__opPress = (i, state) => {
    const o = opens[i]; if (!o || !o.press) return;
    if (state === 'release') gsap.to(o.sel, Object.assign({duration: 0.34, ease: 'back.out(2.6)', overwrite: 'auto'}, o.rest || {}));
    else gsap.set(o.sel, state ? o.press : (o.rest || {}));
  };
  window.__ready = (async () => {
    buildChrome(chapters, captions);
    if (cfg.dom) cfg.dom();
    frDom($('#stage'));
    const fams = ['800 50px "Bricolage Grotesque"', '400 40px "Bricolage Grotesque"', '400 40px JBM', '500 40px JBM', '600 40px JBM', '700 40px JBM', '800 40px JBM',
      '500 40px Inter', '600 40px Inter', '700 40px Inter', '800 40px Inter', '400 40px "Noto Color Emoji"'];
    await Promise.all(fams.map(f => document.fonts.load(f, 'Aàé’' + (cfg.glyphs || ''))));
    await document.fonts.ready;
    smsFit();
    chromeTimeline(chapters, captions, duration);
    cfg.build();
    let rest = [];
    if (RECAP_A != null) { duration = recapEnd(RECAP_A, duration); captions = captions.filter(c => c[0] < duration - 0.3); rest = recapRest(captions, duration); }
    tl.set({}, {}, duration);
    confettiCues();
    HOLDS = mergeHolds(captionHolds(captions, duration).concat(EXTRA_HOLDS.filter(h => h[0] < duration), rest)).concat(CUTS.filter(c => c[0] < duration)).sort((x, y) => x[0] - y[0]);
    const total = HOLDS.reduce((a, h) => a + h[1], 0);
    out = +(duration + total).toFixed(3);
    introPills(out, picks.length);
    renderAt(0);
    if (EMBED) dispatchEvent(new Event('resize'));
    return {duration: out, fps: FPS, cues: CUES.filter(c => !inCut(c.t)).map(c => Object.assign({}, c, {t: unwarp(c.t)})), overflow: checkCaptions(captions),
      notesT: notesAt != null ? unwarp(notesAt) : null,
      /* notesUntil : le bouton « Ajouter à mes notes » s’en va quand la vidéo continue après le résumé (chapitre 20). Le lecteur le lit ici,
         sur la page : il suit la vidéo telle qu’elle est, sans dépendre d’un temps recopié à la main dans la fiche de la leçon. */
      notesUntil: cfg.notesUntil != null ? unwarp(cfg.notesUntil) : null, holds: +total.toFixed(3), holdList: HOLDS, clashes: holdClashes(picks.concat(opens).map(p => p.at)).concat(cfg.extraClashes ? cfg.extraClashes() : []),
      textIssues: QS.has('check') ? textIssues() : undefined,
      layoutIssues: QS.has('check') ? layoutIssues(renderAt, out) : undefined,
      chapters: chapters.map(c => ({t: unwarp(c.a), n: c.n, label: c.label})),
      questions: questions.map(q => ({t: unwarp(q.at), kicker: q.kicker, ctx: fr(q.ctx || ''), q: fr(q.q), options: q.options.map(o => ({label: o.label, ok: o.ok})), okTitle: fr(q.okTitle), koTitle: fr(q.koTitle), why: fr(q.why)})),
      /* Moments « À toi » : l’animation s’arrête, l’élève agit ; la page montre aussitôt le résultat (window.IX : slot, pick,
         leave), le lecteur gère le plateau, le son et la reprise. Gestes (kind) : tap (toucher les bons endroits), sort (glisser
         chaque étiquette), link (relier deux éléments), tune (un réglage à manipuler : curseur, choix, bascules, dont la page dessine
         l’effet à chaque mouvement, IX.tune) ; la page décrit les endroits (IX.spots) et juge chaque geste (IX.act).
         need : bons gestes attendus (tap, link) ; hint : consigne sous le plateau ; next : ligne d’aide une fois une étiquette
         choisie ({x} : l’étiquette) ; text : étiquettes en texte courant ; tag : repère de l’étiquette à glisser ;
         from : début du passage qui amène le moment (revoir, rejouer). */
      picks: picks.map(p => ({t: unwarp(p.at), from: p.from != null ? unwarp(p.from) : null, kind: GESTURES.includes(p.kind) ? p.kind : 'pick', text: !!p.text, prompt: fr(p.prompt), hint: p.hint ? fr(p.hint) : '', next: p.next ? fr(p.next) : '', need: p.need || 0,
        /* L’explication de la bonne réponse : le lecteur la remontre quand le moment, déjà réussi, s’ouvre résolu. */
        options: (p.options || []).map(o => ({label: o.label, ok: !!o.ok, tag: o.tag || '', why: o.ok && (o.why || o.say) ? fr(o.why || o.say) : ''})),
        win: typeof momentWin === 'function' ? momentWin(p) : '',
        /* Réglage (tune) : les commandes de la feuille (curseur, choix, bascule), en données ; la page dessine leur effet (IX.tune). */
        controls: (p.controls || []).map(c => ({k: c.k, type: c.type, label: fr(c.label || ''), min: c.min, max: c.max, step: c.step, value: c.value,
          choices: c.choices || null, code: !!c.code, unit: c.unit || ''})), ico: p.ico || ''})),
      /* Mail reçu (opens) : l’image s’arrête, l’élève touche l’élément sel pour l’ouvrir ; rien n’est noté. */
      /* hand : {x, y}, le bout d’un doigt seul (sans bulle), en fraction de l’élément, quand la légende dit déjà quoi faire (Elisa, 25 octobre, 16 h 21). */
      opens: opens.map(o => ({t: unwarp(o.at), sel: o.sel, prompt: fr(o.prompt), label: o.label, hand: o.hand || null})),
      /* Légendes en texte : le lecteur les annonce à VoiceOver au fil de l’animation. */
      captions: captions.map(c => ({a: unwarp(c[0]), b: unwarp(Math.min(c[1], duration)), text: plain(c[2])}))};
  })();
  /* Une seule image, à l’instant donné (?at=2.9) : sert à fabriquer la vignette du cours. */
  if (QS.has('at')) window.__ready.then(() => renderAt(+QS.get('at') || 0));
  /* Lecture en direct quand la page est ouverte seule dans un navigateur (?play). */
  if (QS.has('play')) {
    window.__ready.then(() => {
      const t0 = performance.now();
      const loop = () => { renderAt(((performance.now() - t0) / 1000) % out); requestAnimationFrame(loop); };
      loop();
    });
  }
}
