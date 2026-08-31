/* Sonde de fluidité — chargée uniquement avec ?perf=1 dans l'URL.

   Pourquoi : la saccade signalée sur iPhone ne se reproduit ni sous Chromium
   ni sous un CPU bridé. Il faut donc mesurer sur l'appareil, sur la vraie
   application, et pouvoir désactiver un suspect à la fois pour comparer.

   Ce que la sonde mesure : le temps entre deux images, mais UNIQUEMENT
   pendant que le doigt fait défiler. Mesurer à l'arrêt donnerait 60 i/s dans
   tous les cas et ne dirait rien. */
(function () {
  'use strict';

  var FIN_DE_SCROLL = 140;    /* ms de silence avant de considérer l'arrêt */

  /* Un seuil fixe de 32 ms supposait un écran à 60 Hz. En mode économie
     d'énergie, iOS bride WebKit à 30 Hz : chaque image dure alors 33 ms et
     serait comptée comme perdue, ce qui donnait 90 % d'images « longues » sur
     un défilement en réalité régulier. On mesure donc d'abord la cadence que
     l'appareil tient réellement, et on ne compte comme perdues que les images
     qui dépassent nettement cette cadence-là. */
  var CADENCES = [8.33, 11.11, 16.67, 33.33];   /* 120, 90, 60, 30 Hz */

  function cadence(tri) {
    if (tri.length < 12) return 0;
    /* Le 10e centile : assez bas pour ignorer les à-coups, assez haut pour ne
       pas se caler sur une image isolée anormalement courte. */
    var plancher = tri[Math.floor(tri.length * 0.1)];
    var best = CADENCES[0], ecart = Infinity;
    for (var i = 0; i < CADENCES.length; i++) {
      var d = Math.abs(plancher - CADENCES[i]);
      if (d < ecart) { ecart = d; best = CADENCES[i]; }
    }
    /* Au-delà de 30 Hz, l'appareil ne suit aucune cadence connue : on garde la
       mesure brute plutôt que de la forcer dans une case. */
    return ecart > 6 ? plancher : best;
  }

  /* Les suspects, dans l'ordre où on les soupçonne. Chacun est une feuille de
     style qu'on injecte pour neutraliser une propriété, pas une modification
     du fichier : on peut donc revenir en arrière sans recharger. */
  var SUSPECTS = [
    { id: 'flou', label: 'Flous',
      css: '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' },
    { id: 'ombre', label: 'Ombres',
      css: '*{box-shadow:none!important}' },
    { id: 'anim', label: 'Animations',
      css: '*{animation:none!important;transition:none!important}' }
  ];

  var mesures = [];
  var actifJusqua = 0;
  var derniere = 0;
  var styles = {};

  function estEnScroll() { return performance.now() < actifJusqua; }

  /* Une seule boucle rAF pour toute la session : on n'enregistre l'écart que
     si le défilement est en cours, et on ignore la première image après une
     reprise (elle porte tout le temps d'inactivité). */
  function boucle(t) {
    if (derniere && estEnScroll()) mesures.push(t - derniere);
    derniere = estEnScroll() ? t : 0;
    requestAnimationFrame(boucle);
  }

  function surScroll() { actifJusqua = performance.now() + FIN_DE_SCROLL; }

  function quantile(tri, q) {
    if (!tri.length) return 0;
    return tri[Math.min(tri.length - 1, Math.floor(tri.length * q))];
  }

  function stats() {
    var tri = mesures.slice().sort(function (a, b) { return a - b; });
    var cad = cadence(tri);
    /* Une image est perdue si elle dure plus d'une fois et demie la cadence de
       l'appareil : à 60 Hz cela redonne 25 ms, à 30 Hz cela donne 50 ms. */
    var seuil = cad ? cad * 1.5 : 25;
    var longues = 0;
    for (var i = 0; i < tri.length; i++) if (tri[i] > seuil) longues++;
    return {
      n: tri.length,
      cadence: cad,
      seuil: seuil,
      p50: quantile(tri, 0.5),
      p95: quantile(tri, 0.95),
      max: tri.length ? tri[tri.length - 1] : 0,
      longues: longues,
      pct: tri.length ? (longues * 100 / tri.length) : 0,
      ips: tri.length ? (1000 / quantile(tri, 0.5)) : 0
    };
  }

  function html(s) {
    if (!s.n || !s.cadence) {
      return '<p class="pp-vide">Fais défiler la leçon quelques secondes.</p>';
    }
    var verdict = s.pct >= 10 ? 'pp-mauvais' : (s.pct >= 3 ? 'pp-moyen' : 'pp-bon');
    var hz = Math.round(1000 / s.cadence);
    /* Le plafond est un fait sur l'appareil, pas un défaut de l'application :
       on le nomme, pour qu'un 30 Hz bridé ne se lise pas comme une saccade. */
    var note = hz <= 35
      ? '<p class="pp-note">Appareil bridé à ' + hz + ' Hz — mode économie d’énergie ?</p>'
      : '';
    return '<p class="pp-ips ' + verdict + '"><b>' + s.ips.toFixed(0) + '</b> images/s ' +
      '<span>sur ' + hz + ' possibles</span></p>' + note +
      '<table><tbody>' +
      '<tr><td>cadence appareil</td><td>' + s.cadence.toFixed(1) + ' ms</td></tr>' +
      '<tr><td>médiane</td><td>' + s.p50.toFixed(1) + ' ms</td></tr>' +
      '<tr><td>p95</td><td>' + s.p95.toFixed(1) + ' ms</td></tr>' +
      '<tr><td>pire</td><td>' + s.max.toFixed(1) + ' ms</td></tr>' +
      '<tr><td>images perdues</td><td>' + s.longues + ' (' + s.pct.toFixed(1) + ' %)</td></tr>' +
      '<tr><td>échantillon</td><td>' + s.n + '</td></tr>' +
      '</tbody></table>';
  }

  function bascule(sus, bouton) {
    if (styles[sus.id]) {
      styles[sus.id].remove();
      delete styles[sus.id];
      bouton.classList.remove('on');
      bouton.textContent = sus.label;
    } else {
      var st = document.createElement('style');
      st.textContent = sus.css;
      document.head.appendChild(st);
      styles[sus.id] = st;
      bouton.classList.add('on');
      bouton.textContent = sus.label + ' ✕';
    }
    remise();
  }

  function remise() { mesures.length = 0; derniere = 0; }

  function monte() {
    var css = document.createElement('style');
    css.textContent = [
      /* En haut : le bas de l'écran porte déjà le bouton « Passer à l'exercice »,
         dont l'escamotage au scroll fait partie de ce qu'on observe. */
      '#pp{position:fixed;left:8px;right:8px;top:calc(6px + env(safe-area-inset-top,0px));z-index:9999;',
      'max-width:504px;margin:0 auto;padding:10px 12px;border-radius:14px;',
      'background:#12121A;color:#EDEDF5;font:600 12px/1.35 ui-monospace,Menlo,monospace;',
      '-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:none}',
      '#pp.plie{padding:6px 12px}',
      '#pp.plie .pp-corps{display:none}',
      '#pp h3{margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#9B9BB5;',
      'display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '#pp h3 button{background:none;border:0;color:#9B9BB5;font:inherit;padding:2px 6px;cursor:pointer}',
      '#pp .pp-ips{margin:6px 0 4px;font-size:13px;color:#EDEDF5}',
      '#pp .pp-ips b{font-size:22px}',
      '#pp .pp-ips span{color:#9B9BB5;font-size:11px;font-weight:600}',
      '#pp .pp-note{margin:0 0 6px;color:#FFD166;font-weight:600}',
      '#pp .pp-bon b{color:#5BE49B}#pp .pp-moyen b{color:#FFD166}#pp .pp-mauvais b{color:#FF8A80}',
      '#pp table{width:100%;border-collapse:collapse}',
      '#pp td{padding:1px 0;color:#B9B9CE}#pp td+td{text-align:right;color:#EDEDF5}',
      '#pp .pp-vide{margin:6px 0;color:#9B9BB5;font-weight:500}',
      '#pp .pp-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
      '#pp .pp-btns button{flex:1 1 auto;padding:7px 8px;border-radius:9px;border:1px solid #3A3A4E;',
      'background:#24242F;color:#EDEDF5;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '#pp .pp-btns button.on{background:#5B5BD6;border-color:#5B5BD6}'
    ].join('');
    document.head.appendChild(css);

    var box = document.createElement('div');
    box.id = 'pp';
    box.innerHTML = '<h3><span>Sonde de fluidité</span>' +
      '<span><button type="button" data-pp="raz">RAZ</button>' +
      '<button type="button" data-pp="plier">–</button></span></h3>' +
      '<div class="pp-corps"><div class="pp-out"></div><div class="pp-btns"></div></div>';
    document.body.appendChild(box);

    var btns = box.querySelector('.pp-btns');
    SUSPECTS.forEach(function (sus) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = sus.label;
      b.addEventListener('click', function () { bascule(sus, b); });
      btns.appendChild(b);
    });

    box.querySelector('[data-pp="raz"]').addEventListener('click', remise);
    box.querySelector('[data-pp="plier"]').addEventListener('click', function () {
      box.classList.toggle('plie');
      this.textContent = box.classList.contains('plie') ? '+' : '–';
    });

    /* On ne redessine jamais pendant le défilement : la sonde perturberait la
       mesure qu'elle prend. Les chiffres se figent le temps du geste, puis se
       mettent à jour dès l'arrêt. */
    var out = box.querySelector('.pp-out');
    setInterval(function () {
      if (box.classList.contains('plie') || estEnScroll()) return;
      out.innerHTML = html(stats());
    }, 500);

    /* Le défilement se fait dans les conteneurs .screen, pas dans le document :
       on écoute en phase de capture pour attraper n'importe lequel, y compris
       ceux créés après coup. */
    document.addEventListener('scroll', surScroll, { capture: true, passive: true });
    window.addEventListener('scroll', surScroll, { passive: true });
    requestAnimationFrame(boucle);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', monte);
  } else {
    monte();
  }
})();
