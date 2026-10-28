'use strict';
/* ---------- Une équipe écrit : le mail qui ouvre la situation d’un cours ----------
   Elisa, 28 octobre, 16 h 59, sur la situation du cours AS (une carte « Dashboard ») : « Mail de l’équipe commerciale qui fait la
   demande bien formulé ». Le même mail que dans le projet : la notification (l’en-tête seul), que l’élève touche, puis le mail
   déplié, en 42 px (Elisa, 28 octobre, 16 h 19 : « agrandir dans la longueur »), seul à l’écran : la légende n’est pas encore là.
   Fichier à part : seuls les cours qui ont un mail le chargent (après core.js et moments.js), les autres ne s’alourdissent pas.
   Classes lm-… : la page d’un cours a déjà ses .mb (les cartes des moments « À toi »).

   m : {id, qui: [nom affiché, initiales], k (couleur), tag, de (adresse), corps: [phrases], signe}. Le mail commence par « Bonjour, »
   et finit par « Merci ! », puis la signature. lessonMailCard() donne la carte (repliée, en notification) et le doigt de la vidéo ;
   lessonMailFit() la centre dans la hauteur libre, une fois les polices chargées (dans build) ; lessonMailIn() l’anime : à t la
   notification tombe, à T l’élève la touche (l’app s’arrête là : la page déclare l’arrêt dans ses opens) ; le mail se déplie, une
   ligne après l’autre, puis l’image s’arrête le temps de lire la demande. Renvoie l’instant de fin. */
(() => {
  const s = document.createElement('style');
  s.textContent = '.lm{left:64px;width:952px;height:184px;padding:0 30px;overflow:hidden}'
    + '.lm-h{height:178px;display:flex;align-items:center;gap:26px}'
    + '.lm-av{position:relative;flex:none;width:100px;height:100px;border-radius:50%;background:var(--cs);color:var(--ci);font-family:var(--display);font-size:36px;font-weight:800;font-style:normal;display:flex;align-items:center;justify-content:center}'
    + '.lm-bg{position:absolute;right:-10px;bottom:-8px;width:44px;height:44px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px var(--line);font-size:23px;display:flex;align-items:center;justify-content:center}'
    + '.lm-w{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px}'
    + '.lm-n{display:flex;align-items:center;gap:14px;white-space:nowrap}'
    + '.lm-n b{font-size:36px;font-weight:700;color:var(--ink)}'
    + '.lm-tg{height:36px;padding:0 12px;border-radius:10px;background:var(--cs);color:var(--ci);font-size:20px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;display:flex;align-items:center}'
    + '.lm-s{position:relative;height:38px;white-space:nowrap}'
    + '.lm-s>span{position:absolute;left:0;top:0;line-height:38px}'
    + '.lm-s0{font-size:29px;font-weight:700;color:var(--accent-ink)}'
    + '.lm-s1{font-family:var(--mono);font-size:27px;font-weight:600;color:var(--ink-3);opacity:0;visibility:hidden}'
    + '.lm-r{flex:none;align-self:stretch;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:18px}'
    + '.lm-t{font-size:24px;font-weight:600;color:var(--ink-3)}'
    + '.lm-dot{position:relative;width:22px;height:22px}'
    + '.lm-dot::before{content:"";position:absolute;inset:0;border-radius:50%;background:#2F80ED;animation:lmdot 1.3s ease-in-out infinite}'
    + '@keyframes lmdot{50%{transform:scale(.72);opacity:.65}}'
    + '.lm-b{padding:24px 4px 28px;box-shadow:inset 0 3px 0 var(--line-2)}'
    + '.lm-b p{margin:0;font-size:42px;line-height:1.3;font-weight:500;color:var(--ink)}'
    + '.lm-b .lm-l{display:block}'
    + '.lm-b .lm-l+.lm-l{margin-top:12px}'
    + '.lm-b .lm-l.s{margin-top:0;color:var(--ink-2)}'
    + '.lm-f{z-index:20;font-size:120px;margin:-8px 0 0 -44px;opacity:0;visibility:hidden}'
    + '.k-cc{--c:#D9468F;--cs:#FCE8F2;--ci:#A3216A}';
  document.head.append(s);
})();
function lessonMailCard(m){
  /* Le dernier mot d’une phrase reste avec le précédent : jamais un mot seul sur la dernière ligne (« seule fois. »). */
  const lines = ['Bonjour,', ...m.corps.map(x => x.replace(/ (\S+)$/, '\u00a0$1')), 'Merci !', m.signe];
  return `<div class="abs card lm ${m.k}" id="${m.id}"><div class="lm-h"><i class="lm-av">${m.qui[1]}<b class="lm-bg emo">✉️</b></i>` +
    `<div class="lm-w"><div class="lm-n"><b>${m.qui[0]}</b><small class="lm-tg">${m.tag}</small></div><div class="lm-s"><span class="lm-s0">Nouveau mail</span><span class="lm-s1">${m.de}</span></div></div>` +
    `<div class="lm-r"><span class="lm-t">maintenant</span><i class="lm-dot"></i></div></div>` +
    `<div class="lm-b"><p>${lines.map((x, j) => `<span class="lm-l${j === lines.length - 1 ? ' s' : ''}">${x}</span>`).join('')}</p></div></div>` +
    `<div class="abs emo lm-f" id="${m.id}-f">👆</div>`;
}
/* Le mail déplié se centre entre le haut de la scène (236 px) et le bas de la légende (1 790 px) ; replié, il garde ce bord haut. */
function lessonMailFit(sel){
  const el = $(sel); el.style.height = 'auto';
  const h = el.offsetHeight; el.style.height = '';
  el.style.top = Math.max(236, Math.round((236 + 1790) / 2 - h / 2)) + 'px';
  return h;
}
function lessonMailIn(sel, h, t, T){
  const lines = $$(sel + ' .lm-l');
  show(sel, t, {y: -36, scale: 0.94}, 0.55, 'back.out(1.7)');
  cue(t, 'mail', 0.8);
  show(sel + ' .lm-av', t + 0.12, {y: 0, scale: 0.5}, 0.4, 'back.out(2.4)');
  show(sel + ' .lm-bg', t + 0.3, {y: 0, scale: 0, rotation: -30}, 0.4, 'back.out(3)');
  show(sel + ' .lm-dot', t + 0.42, {y: 0, scale: 0}, 0.3, 'back.out(3)');
  if (!APP) {
    // hors de l’app, un doigt montre le geste
    const M = $(sel), f = sel + '-f';
    tl.set(f, {left: M.offsetLeft + M.offsetWidth * 0.6, top: M.offsetTop + 92}, T - 0.8);
    tl.fromTo(f, {autoAlpha: 0, x: 90, y: 170}, {autoAlpha: 1, x: 0, y: 0, duration: 0.5, ease: 'power3.out', immediateRender: false}, T - 0.75);
    tl.to(f, {scale: 0.86, duration: 0.1, ease: 'power2.in'}, T - 0.15);
    tl.to(f, {scale: 1, duration: 0.15}, T);
    tl.to(f, {autoAlpha: 0, y: 70, duration: 0.3}, T + 0.2);
  }
  tl.to(sel, {scale: 0.975, duration: 0.09, ease: 'power2.out'}, T);
  tl.to(sel, {scale: 1, duration: 0.3, ease: 'back.out(2.5)'}, T + 0.09);
  cue(T, 'click', 0.5);
  tl.to(sel + ' .lm-dot', {autoAlpha: 0, scale: 0, duration: 0.2}, T + 0.05);
  tl.to(sel + ' .lm-s0', {autoAlpha: 0, y: -16, duration: 0.2}, T + 0.1);
  tl.fromTo(sel + ' .lm-s1', {autoAlpha: 0, y: 16}, {autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out', immediateRender: false}, T + 0.2);
  tl.to(sel, {height: h, duration: 0.5, ease: 'power3.inOut'}, T + 0.12);
  cue(T + 0.12, 'whoosh', 0.35);
  gsap.set(lines, {autoAlpha: 0, y: 14});
  lines.forEach((s, k) => { tl.to(s, {autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out'}, T + 0.4 + k * 0.28); cue(T + 0.4 + k * 0.28, 'tick', 0.4, k + 2); });
  const end = T + 0.4 + (lines.length - 1) * 0.28 + 0.35;
  // le temps de lire la demande : ses phrases, entre « Bonjour, » et « Merci ! »
  hold(end + 0.05, Math.ceil(readTime(lines.slice(1, -2).map(s => s.textContent).join(' ')) * 20) / 20);
  return end;
}
function lessonMailOut(sel, t){ hide(sel, t, {x: 140, y: 0, rotation: 2}, 0.4, 'power2.in'); cue(t, 'whoosh', 0.4); }
