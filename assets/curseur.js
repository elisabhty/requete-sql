/* Curseur de Requête, sur la vitrine et dans l’appli (Elisa, 30 octobre, 22 h 58 : « faire en sorte que le curseur sur l’appli soit
   UI/UX très jolie, quand on rentre sur le site / l’appli », « mettre des micro-interactions »). Ordinateur seulement : souris ou
   pavé tactile (survol et pointeur fin) ; rien ne change au doigt.
   - La flèche est un autocollant de la vitrine : violet, liseré blanc, trait encre, petite ombre. Sur ce qui se touche (lien, bouton,
     carte, puce), une main blanche à manche violet (le sweat de la mascotte) ; le texte garde sa barre de saisie. Ce sont des curseurs
     du système, dessinés en SVG puis peints en double résolution : nets sur un écran Retina, sans aucun retard.
   - Un halo les suit avec un léger ressort. Quand la souris entre dans la page, il s’ouvre et lâche quelques étincelles ; sur ce qui
     se touche, il grossit et passe au jaune soleil ; il se resserre à l’appui et laisse une onde au clic ; il s’efface quand la
     souris sort de la page, passe sur un champ de texte ou sur une vidéo intégrée.
   Mouvement réduit (réglage du système ou de l’appli) : les curseurs seuls, sans halo ni étincelles.
   Et partout, au doigt comme à la souris : le rebond des boutons au relâché (plus bas, « L’appui »). */
(function () {
  'use strict';
  if (window.__rqCurseur) return;
  window.__rqCurseur = true;
  var root = document.documentElement;
  var reduit = function () {
    return (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || root.getAttribute('data-motion') === 'reduce';
  };

  /* L’appui (Elisa, 30 octobre, 23 h 23 : « micro-interaction quand on appuie sur les boutons stp »). Sous le doigt, chaque bouton
     s’enfonce déjà en CSS, sur son rebord ou en rétrécissant ; au relâché, il rebondit : un petit ressort en Web Animations sur la
     propriété scale, qui se compose avec le transform du CSS sans toucher à ses animations. Il gagne 8 px de large au plus fort
     (6 % au plus pour une pastille). Pas de rebond pour une grande surface, ce qui se glisse, un bouton remplacé par le clic ou qui joue déjà sa propre
     animation (les onglets, les jours, les choix qui sautent en se cochant), ni au clavier ; rien en mouvement réduit. */
  var APPUI = 'button,summary,[role="button"],[role="tab"],.chip,a.btn,a.nav-cta,a.g,a.arrow';
  var SANS_REBOND = '.stk-item,.stk-cell,.qf-card,.hdl,[data-sans-rebond]';
  var rebondir = function (el, r) {
    if (!el.isConnected || !el.animate || reduit()) return;
    if (!r.width || r.width * r.height > window.innerWidth * window.innerHeight * 0.22) return;
    try {
      var sc = window.getComputedStyle(el).scale;
      if (sc && sc !== 'none' && sc !== '1') return;
      if (el.getAnimations && typeof CSSAnimation !== 'undefined'
        && el.getAnimations().some(function (a) { return a instanceof CSSAnimation && a.playState === 'running'; })) return;
      var k = Math.min(0.06, Math.max(0.01, 8 / r.width));
      if (el.__rqRebond) el.__rqRebond.cancel();
      el.__rqRebond = el.animate([
        { scale: '1', easing: 'cubic-bezier(.2,.7,.3,1)' },
        { scale: String(+(1 + k).toFixed(4)), offset: 0.36, easing: 'ease-in-out' },
        { scale: String(+(1 - k * 0.35).toFixed(4)), offset: 0.7, easing: 'ease-out' },
        { scale: '1' }
      ], { duration: 420 });
    } catch (e) {}
  };
  document.addEventListener('click', function (e) {
    if (!e.detail) return;
    var el = e.target && e.target.closest && e.target.closest(APPUI);
    if (!el || el.disabled || el.closest(SANS_REBOND) || (el.getAttribute('aria-disabled') === 'true' && !el.hasAttribute('data-jc-gate'))) return;
    if (document.body && document.body.classList.contains('dragging')) return;
    var r = el.getBoundingClientRect();
    /* Après les gestionnaires du clic : on sait alors si le bouton a été remplacé, ou s’il saute déjà de lui-même */
    if (window.requestAnimationFrame) window.requestAnimationFrame(function () { rebondir(el, r); });
    else setTimeout(function () { rebondir(el, r); }, 16);
  }, true);

  var mq = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!mq || !mq.matches) return;

  /* Les deux curseurs, dans un carré de 30 */
  var FLECHE = 'M6.5 4.5V22.7l4.7-4.4 3.2 7 3.4-1.5-3.1-6.9 6.4-.3Z';
  var flecheSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">'
    + '<path d="' + FLECHE + '" fill="#1B1640" opacity=".22" transform="translate(1.3 1.8)"/>'
    + '<path d="' + FLECHE + '" fill="#6A4DF4" stroke="#1B1640" stroke-width="3.6" stroke-linejoin="round"/>'
    + '<path d="' + FLECHE + '" fill="#6A4DF4" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>'
    + '<path d="M8.6 9.2v7.4" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".55"/></svg>';
  var MAIN = '<rect x="10.3" y="2.5" width="4.6" height="14" rx="2.3"/><rect x="14.6" y="9.2" width="4.4" height="8" rx="2.2"/>'
    + '<rect x="18.7" y="10.4" width="4.2" height="7.4" rx="2.1"/><rect x="22.6" y="12" width="3.8" height="6.6" rx="1.9"/>'
    + '<rect x="8.8" y="13.6" width="17.6" height="11.2" rx="5.2"/><rect x="5.3" y="13.4" width="4.4" height="9.4" rx="2.2" transform="rotate(-36 7.5 18.1)"/>';
  var mainSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">'
    + '<g fill="#1B1640" opacity=".2" transform="translate(1.1 1.5)">' + MAIN + '</g>'
    + '<g fill="none" stroke="#1B1640" stroke-width="3.4" stroke-linejoin="round">' + MAIN + '</g>'
    + '<g fill="#fff">' + MAIN + '</g>'
    + '<rect x="10.2" y="23.5" width="14.8" height="4.6" rx="1.6" fill="#6A4DF4" stroke="#1B1640" stroke-width="1.7"/>'
    + '<path d="M14.75 12.6v3.9M18.8 13.6v3.3M22.7 14.8v2.6" stroke="#1B1640" stroke-width="1.15" stroke-linecap="round" opacity=".5"/></svg>';
  var url = function (svg) { return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")'; };
  var poser = function (a, h) {
    root.style.setProperty('--rq-cur-a', a + ' 6 4, auto');
    root.style.setProperty('--rq-cur-h', h + ' 12 3, pointer');
  };
  poser(url(flecheSvg), url(mainSvg));
  /* Puis les mêmes curseurs peints en 1x et 2x, là où le navigateur accepte image-set pour un curseur */
  var peindre = function (svg, k, fin) {
    var img = new Image();
    img.onload = function () {
      try {
        var c = document.createElement('canvas'); c.width = c.height = 30 * k;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        fin(c.toDataURL('image/png'));
      } catch (e) { fin(null); }
    };
    img.onerror = function () { fin(null); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
  var jeu = function (a, b) { return '-webkit-image-set(url("' + a + '") 1x, url("' + b + '") 2x)'; };
  if (window.CSS && CSS.supports && CSS.supports('cursor', jeu('data:image/png;base64,AA==', 'data:image/png;base64,AA==') + ' 6 4, auto')) {
    var p = {};
    var pret = function () {
      if (p.a1 && p.a2 && p.h1 && p.h2) poser(jeu(p.a1, p.a2), jeu(p.h1, p.h2));
    };
    peindre(flecheSvg, 1, function (d) { p.a1 = d; pret(); });
    peindre(flecheSvg, 2, function (d) { p.a2 = d; pret(); });
    peindre(mainSvg, 1, function (d) { p.h1 = d; pret(); });
    peindre(mainSvg, 2, function (d) { p.h2 = d; pret(); });
  }

  /* Ce qui se touche : la main et le halo jaune. Les poignées à glisser gardent leur curseur. */
  var TOUCHE = 'a[href],button,summary,label[for],select,[role="button"],[role="tab"],[role="link"],[role="switch"],[role="menuitem"],[onclick],.chip,input[type="checkbox"],input[type="radio"],input[type="submit"],input[type="button"]';
  var SAISIE = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]):not([type="button"]):not([type="file"]),textarea,[contenteditable="true"],[contenteditable=""]';
  var EXCLU = ':not(:disabled):not([aria-disabled="true"]:not([data-jc-gate])):not(.stk-cell):not(.stk-item):not(.qf-card):not(.hdl)';
  var css = '@media (hover:hover) and (pointer:fine){'
    + 'html.rq-cur,html.rq-cur body{cursor:var(--rq-cur-a)}'
    + 'html.rq-cur body:not(.dragging) :is(' + TOUCHE + ')' + EXCLU + '{cursor:var(--rq-cur-h)!important}'
    + 'html.rq-cur :is(' + SAISIE + '){cursor:text!important}'
    + '.rq-halo{position:fixed;left:0;top:0;z-index:2147483646;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;box-sizing:border-box;pointer-events:none;'
    + 'border:2px solid rgba(106,77,244,.62);background:radial-gradient(circle,rgba(106,77,244,.1) 0 55%,rgba(106,77,244,0) 72%);'
    + 'box-shadow:0 0 0 1.5px rgba(255,255,255,.55),0 8px 22px -10px rgba(40,20,140,.45);opacity:0;will-change:transform;'
    + 'transition:opacity .28s ease,border-color .22s ease,background .22s ease,box-shadow .22s ease}'
    + '.rq-halo.is-on{opacity:1}'
    + '.rq-halo.is-touche{border-color:#FFC83D;background:radial-gradient(circle,rgba(255,200,61,.24) 0 55%,rgba(255,200,61,0) 72%);'
    + 'box-shadow:0 0 0 1.5px rgba(27,22,64,.16),0 0 22px rgba(255,200,61,.42)}'
    + '.rq-halo.is-saisie,.rq-halo.is-cache{opacity:0}'
    + '.rq-onde{position:fixed;z-index:2147483645;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:2px solid #FFC83D;pointer-events:none;'
    + 'animation:rqOnde .55s cubic-bezier(.2,.7,.3,1) forwards}'
    + '.rq-onde.v{border-color:#6A4DF4}'
    + '@keyframes rqOnde{from{opacity:.95;transform:scale(.6)}to{opacity:0;transform:scale(4.4)}}'
    + '.rq-eclat{position:fixed;z-index:2147483645;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:2px;pointer-events:none;background:var(--c);'
    + 'animation:rqEclat .7s cubic-bezier(.15,.7,.3,1) forwards}'
    + '.rq-eclat.e{border-radius:50%}'
    + '.rq-eclat.s{width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:0;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M12 1c.9 6 4.9 10 11 11-6.1 1-10.1 5-11 11-.9-6-4.9-10-11-11 6.1-1 10.1-5 11-11Z\'/%3E%3C/svg%3E") center/contain no-repeat;'
    + 'mask:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M12 1c.9 6 4.9 10 11 11-6.1 1-10.1 5-11 11-.9-6-4.9-10-11-11 6.1-1 10.1-5 11-11Z\'/%3E%3C/svg%3E") center/contain no-repeat}'
    + '@keyframes rqEclat{0%{opacity:0;transform:translate(0,0) scale(.3) rotate(0)}18%{opacity:1}100%{opacity:0;transform:translate(var(--x),var(--y)) scale(1) rotate(var(--r))}}'
    + '}';
  var style = document.createElement('style');
  style.id = 'rq-curseur';
  style.textContent = css;
  (document.head || root).appendChild(style);
  root.classList.add('rq-cur');

  var halo = null, mx = -100, my = -100, x = -100, y = -100, s = .4, vu = false, bas = false, touche = false, boucle = 0;
  var cible = function () { return (touche ? 1.42 : 1) * (bas ? .82 : 1); };
  var anime = function () {
    boucle = 0;
    if (!halo) return;
    x += (mx - x) * .3; y += (my - y) * .3; s += (cible() - s) * .22;
    halo.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) scale(' + s.toFixed(3) + ')';
    if (Math.abs(mx - x) > .15 || Math.abs(my - y) > .15 || Math.abs(cible() - s) > .002) boucle = requestAnimationFrame(anime);
  };
  var relance = function () { if (!boucle) boucle = requestAnimationFrame(anime); };
  var creer = function () {
    if (halo || !document.body) return;
    halo = document.createElement('div');
    halo.className = 'rq-halo';
    halo.setAttribute('aria-hidden', 'true');
    document.body.appendChild(halo);
  };
  var etincelles = function (px, py) {
    if (!document.body) return;
    var cols = ['#FFC83D', '#9FF0C6', '#6A4DF4', '#FF8FB8', '#FFD86B', '#B9A8FF'];
    for (var i = 0; i < 7; i++) {
      var e = document.createElement('i'), a = (i / 7) * Math.PI * 2 + .4, d = 22 + (i * 7) % 16;
      e.className = 'rq-eclat' + (i % 3 === 0 ? ' s' : i % 3 === 1 ? ' e' : '');
      e.setAttribute('aria-hidden', 'true');
      e.style.left = px + 'px'; e.style.top = py + 'px';
      e.style.setProperty('--c', cols[i % cols.length]);
      e.style.setProperty('--x', (Math.cos(a) * d).toFixed(1) + 'px');
      e.style.setProperty('--y', (Math.sin(a) * d - 6).toFixed(1) + 'px');
      e.style.setProperty('--r', ((i % 2 ? 1 : -1) * (90 + i * 25)) + 'deg');
      document.body.appendChild(e);
      setTimeout(function (n) { return function () { n.remove(); }; }(e), 760);
    }
  };
  var montrer = function (premier) {
    if (reduit()) return;
    creer();
    if (!halo) return;
    if (!vu) { x = mx; y = my; s = .2; vu = true; if (premier !== false) etincelles(mx, my); }
    halo.classList.add('is-on');
    relance();
  };
  var cacher = function () { if (halo) halo.classList.remove('is-on'); };
  var lire = function (el) {
    if (!halo || !el || el.nodeType !== 1) return;
    var saisie = !!(el.closest && el.closest(SAISIE));
    var t = !saisie && !!(el.closest && el.closest(TOUCHE));
    if (t) { var b = el.closest(TOUCHE); if (b.disabled || (b.getAttribute('aria-disabled') === 'true' && !b.hasAttribute('data-jc-gate'))) t = false; }
    halo.classList.toggle('is-saisie', saisie);
    halo.classList.toggle('is-cache', el.tagName === 'IFRAME');
    if (t !== touche) { touche = t; halo.classList.toggle('is-touche', t); relance(); }
  };
  var vrai = function (e) { return !e.pointerType || e.pointerType === 'mouse' || e.pointerType === 'pen'; };
  document.addEventListener('pointermove', function (e) {
    if (!vrai(e)) { cacher(); return; }
    mx = e.clientX; my = e.clientY;
    if (!halo || !halo.classList.contains('is-on')) montrer();
    else relance();
  }, { passive: true });
  document.addEventListener('pointerover', function (e) { if (vrai(e)) lire(e.target); }, { passive: true });
  document.addEventListener('pointerdown', function (e) {
    if (!vrai(e) || reduit()) return;
    bas = true; relance();
    var o = document.createElement('i');
    o.className = 'rq-onde' + (touche ? '' : ' v');
    o.setAttribute('aria-hidden', 'true');
    o.style.left = e.clientX + 'px'; o.style.top = e.clientY + 'px';
    if (document.body) { document.body.appendChild(o); setTimeout(function () { o.remove(); }, 600); }
  }, { passive: true });
  var relache = function () { if (bas) { bas = false; relance(); } };
  document.addEventListener('pointerup', relache, { passive: true });
  document.addEventListener('pointercancel', relache, { passive: true });
  /* La souris quitte la fenêtre, puis revient : le halo s’efface, puis se rouvre là où elle rentre */
  document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) cacher(); }, { passive: true });
  document.addEventListener('mouseover', function (e) {
    if (e.relatedTarget) return;
    mx = e.clientX; my = e.clientY;
    if (halo && vu) { x = mx; y = my; s = .5; }
    montrer();
  }, { passive: true });
  window.addEventListener('blur', cacher);
  /* Le réglage « Animations réduites » de l’appli change en cours de route */
  if (window.MutationObserver) new MutationObserver(function () { if (reduit()) cacher(); }).observe(root, { attributes: true, attributeFilter: ['data-motion'] });
})();
