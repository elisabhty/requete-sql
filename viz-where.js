/* viz-where.js — cascade ligne par ligne + compteur pour le cours WHERE.
   Complète viz-select.js (étapes cliquables, minuteurs par viz).

   Sept leçons partagent data-kind="filter" (where, compare, andor, like,
   inbetween, distinct, count). La cascade est activée leçon par leçon via
   VIZ_OK (where, compare, andor) : pour étendre, ajouter la clé et revérifier le
   rendu, notamment pour count où aucune ligne n'est écartée.

   Ce fichier ne fait que poser des variables CSS et construire le
   compteur ; toute l'animation vit dans viz-where.css. */
(function () {
  "use strict";

  var VIZ_OK   = ["where", "compare", "andor", "or", "nulls", "like", "inbetween"];
  var WSTAGGER = 105;   // ms entre deux lignes testées
  var WMARK    = 230;   // ms entre le test d'une ligne et son verdict
  var WTAIL    = 220;   // marge de lecture après le dernier verdict

  function eligible(root) {
    return !!root && !!root.dataset &&
      root.dataset.kind === "filter" &&
      VIZ_OK.indexOf(root.dataset.viz) !== -1;
  }

  /* --- 1. un délai par ligne ------------------------------------------- */
  function stampDelays(root) {
    var keeps = [];
    [].forEach.call(root.querySelectorAll(".grp-chip"), function (c, i) {
      c.style.setProperty("--dw", (i * WSTAGGER) + "ms");
      c.style.setProperty("--dwm", (i * WSTAGGER + WMARK) + "ms");
      if (c.dataset.keep === "1") keeps.push(i);
    });
    return keeps;
  }

  /* --- 2. keyframes du compteur, calculées depuis les données ----------
     Les lignes gardées ne sont pas régulièrement espacées dans le cas
     général : on place donc un palier par ligne gardée, à l'instant exact
     où elle reçoit sa coche, au lieu de supposer un pas constant. */
  var kfSheet = null;
  var kfRules = {};

  function keyframesFor(root, keeps) {
    var n = keeps.length;
    if (!n) return;
    var step = 100 / (n + 1);                    // hauteur d'un chiffre, en %
    var dur  = keeps[n - 1] * WSTAGGER + WMARK + WTAIL;
    var name = "wc-" + String(root.id || "filter").replace(/[^a-zA-Z0-9_-]/g, "");
    var body = "0%{transform:translateY(0)}";
    keeps.forEach(function (k, idx) {
      var pc = Math.min(99, ((k * WSTAGGER + WMARK) / dur) * 100);
      body += pc.toFixed(2) + "%{transform:translateY(-" +
              (step * (idx + 1)).toFixed(3) + "%)}";
    });
    body += "100%{transform:translateY(-" + (step * n).toFixed(3) + "%)}";

    kfRules[name] = "@keyframes " + name + "{" + body + "}";
    if (!kfSheet) {
      kfSheet = document.createElement("style");
      kfSheet.id = "viz-where-kf";
      document.head.appendChild(kfSheet);
    }
    var txt = "";
    for (var key in kfRules) {
      if (Object.prototype.hasOwnProperty.call(kfRules, key)) txt += kfRules[key];
    }
    kfSheet.textContent = txt;

    root.style.setProperty("--wcname", name);
    root.style.setProperty("--wcdur", dur + "ms");
  }

  /* --- 3. le compteur --------------------------------------------------
     aria-hidden : la description du palier annonce déjà le résultat en
     clair, un compteur qui défile ne ferait que bavarder au lecteur
     d'écran. */
  /* Le fil d'étapes de viz-select.js est construit dans un double
     requestAnimationFrame : au moment où l'on passe ici, .vb-steps n'existe
     pas encore. On réessaie donc sur quelques trames plutôt que de supposer
     un ordre de chargement. */
  function buildCounter(root, total, keeps, tries) {
    if (!root.isConnected) return;
    var steps = root.querySelector(".vb-steps");
    if (!steps) {
      if ((tries || 0) < 10) {
        requestAnimationFrame(function () {
          buildCounter(root, total, keeps, (tries || 0) + 1);
        });
      }
      return;
    }
    if (steps.querySelector(".wc")) return;

    var wc = document.createElement("span");
    wc.className = "wc";
    wc.setAttribute("aria-hidden", "true");

    var box = document.createElement("span");
    box.className = "wc-box";
    var strip = document.createElement("i");
    strip.className = "wc-strip";
    for (var i = 0; i <= keeps.length; i++) {
      var b = document.createElement("b");
      b.textContent = String(i);
      strip.appendChild(b);
    }
    box.appendChild(strip);

    /* Le total reste toujours visible, le mot est replié par viz-where.css
       sous 360px : sur un iPhone étroit la colonne descend vers 160px et
       « lignes gardées » ne rentre plus à côté des puces. */
    var tot = document.createElement("span");
    tot.className = "wc-tot";
    tot.textContent = "/ " + total;

    var lbl = document.createElement("span");
    lbl.className = "wc-lbl";
    lbl.textContent = "lignes gardées";

    /* Le compteur de lignes gardées est retiré de l'animation. */
  }

  /* --- 4. montage ------------------------------------------------------ */
  function armWhere(root) {
    if (!eligible(root)) return;
    var chips = root.querySelectorAll(".grp-chip");
    if (!chips.length) return;
    stampDelays(root);
    root.classList.add("vw");        // c'est ce marqueur qui active viz-where.css
  }

  function armAll() {
    [].forEach.call(
      document.querySelectorAll('.sql-viz[data-kind="filter"]'),
      armWhere
    );
  }

  /* Les puces sont reconstruites à chaque rendu de leçon : on se raccroche
     à initSqlViz, déjà appelé à ce moment-là. */
  var _init = window.initSqlViz;
  if (typeof _init === "function") {
    window.initSqlViz = function () {
      var r = _init.apply(this, arguments);
      armAll();
      return r;
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", armAll);
  } else {
    armAll();
  }
})();
