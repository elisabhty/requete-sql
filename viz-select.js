/* ============================================================
   viz-select.js — pilotage des animations SQL (.sql-viz)
   Chargé en defer, donc après le <script> inline : les fonctions
   globales existent déjà et sont ici complétées ou remplacées.

   1. Largeurs de colonnes en phase 1 + fil d’étapes (voir viz-select.css).
   2. Correctif : un timer et un observer PAR viz, au lieu des globales
      havingGrpTimer / havingGrpObs partagées. Avec deux vizzes sur une
      même page, le stopHavingGrpViz() de la seconde annulait le timer de
      la première, qui restait bloquée en phase 0 avec playing="1" :
      bouton Pause actif sur une animation morte, seen jamais atteint.
      Et dans initSqlViz, le disconnect() en tête de boucle tuait
      l’observer du root précédent à chaque itération.
   ============================================================ */
(function () {
  var STAGGER = 36;          // ms entre deux lignes de la cascade
  var DUR = [2400, 3000];    // durée des paliers
  var END = 2000;            // temps de lecture du dernier palier

  /* ---------- largeurs naturelles, mesurées une fois ---------- */
  function natWidths(root) {
    if (root.__natW) return root.__natW;
    var m = {}, head = root.querySelector(".sel-head");
    if (head) [].forEach.call(head.children, function (c) {
      m[c.dataset.col] = c.offsetWidth || 60;
    });
    return (root.__natW = m);
  }

  /* Phase 1 : comprime les colonnes écartées pour que les colonnes gardées
     tiennent entièrement dans .sel-table, qui est en overflow:hidden.
     Au-delà du seuil où tout tient déjà, on ne touche à rien. */
  function fitCols(root, phase) {
    if (root.dataset.kind !== "cols") return;
    var table = root.querySelector(".sel-table");
    if (!table) return;
    var cells = root.querySelectorAll(".sel-c");
    var clear = function () {
      [].forEach.call(cells, function (c) { c.style.flex = ""; c.style.maxWidth = ""; });
    };
    if (phase !== 1) return clear();

    var N = natWidths(root), keepN = 0, ghostN = 0, ghostCount = 0;
    [].forEach.call(root.querySelector(".sel-head").children, function (c) {
      var w = N[c.dataset.col] || 60;
      if (c.dataset.keep === "1") keepN += w;
      else { ghostN += w; ghostCount++; }
    });

    var avail = table.clientWidth - 2;
    if (avail >= keepN + ghostN) return clear();

    var ghostAvail = Math.max(ghostCount * 17, avail - keepN - 6);
    var gf = ghostAvail / ghostN;
    var kf = Math.max(60, avail - ghostAvail - 2) / keepN;
    [].forEach.call(cells, function (c) {
      var w = N[c.dataset.col] || 60;
      var t = c.dataset.keep === "1" ? w * kf : Math.max(17, w * gf);
      c.style.flex = "0 0 " + t.toFixed(1) + "px";
      c.style.maxWidth = t.toFixed(1) + "px";
    });
  }
  /* ---------- fil d’étapes ---------- */
  function buildSteps(root) {
    var bar = root.querySelector(".grp-viz-bar");
    if (!bar || bar.querySelector(".vb-steps")) return;
    var n = sqlVizPhases(root).length;
    var wrap = document.createElement("div");
    wrap.className = "vb-steps";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Étapes de l’animation");
    for (var i = 0; i < n; i++) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "vb-dot";
      b.dataset.i = i;
      b.setAttribute("aria-label", "Étape " + (i + 1) + " sur " + n);
      b.appendChild(document.createElement("i"));
      wrap.appendChild(b);
    }
    wrap.addEventListener("click", function (e) {
      var d = e.target.closest(".vb-dot");
      if (!d) return;
      stopHavingGrpViz(root);
      root.dataset.playing = "0";
      root.dataset.paused = "0";
      root.dataset.seen = "1";
      havingGrpSetPhase(root, parseInt(d.dataset.i, 10));
      havingGrpSyncControls(root);
    });
    bar.appendChild(wrap);

    // --d2 plutôt que calc() sur une var() de type <time> (bugs WebKit)
    [].forEach.call(root.querySelectorAll(".sel-row, .grp-chip"), function (r, i) {
      r.style.setProperty("--d", (i * STAGGER) + "ms");
      r.style.setProperty("--d2", Math.round(i * STAGGER * 0.4) + "ms");
    });
  }

  function paintSteps(root, phase, dur, running, fill) {
    [].forEach.call(root.querySelectorAll(".vb-dot"), function (d, i) {
      d.classList.remove("run", "full");
      d.classList.toggle("done", i < phase);
      d.classList.toggle("on", i === phase);
      d.querySelector("i").style.cssText = "";
      if (i !== phase) return;
      void d.offsetWidth;                      // reflow : relance la jauge
      if (running && dur) {
        d.style.setProperty("--dur", dur + "ms");
        d.classList.add("run");
      } else if (fill) {
        d.classList.add("full");
      }
    });
  }

  /* Appelé à chaque layout : ne doit pas écraser une jauge en cours,
     sinon un pause() la ferait sauter à 100 %. */
  function syncSteps(root, phase) {
    var cur = root.querySelector(".vb-dot.on");
    if (cur && +cur.dataset.i === phase) return;
    paintSteps(root, phase, 0, false, root.dataset.playing !== "1");
  }
  /* ---------- pilotage : un timer et un observer PAR viz ---------- */
  function allRoots() {
    var r = [].slice.call(document.querySelectorAll(".sql-viz"));
    var h = document.getElementById("having-grp-viz");
    if (h && r.indexOf(h) < 0) r.push(h);
    return r;
  }

  // stopViz(root) cible une viz ; stopViz() sans argument stoppe tout,
  // pour rester compatible avec les appels existants.
  function stopViz(root) {
    if (root && root.nodeType === 1) {
      if (root._grpTimer) { clearTimeout(root._grpTimer); root._grpTimer = null; }
      return;
    }
    allRoots().forEach(stopViz);
  }

  function finishViz(root) {
    root._grpTimer = null;
    root.dataset.playing = "0";
    root.dataset.paused = "0";
    root.dataset.seen = "1";
    havingGrpSyncControls(root);
    paintSteps(root, sqlVizPhases(root).length - 1, 0, false, true);
    if (navigator.vibrate) navigator.vibrate(10);   // sans effet sur iOS
  }

  function continueViz(root, fromPhase) {
    stopViz(root);
    root.dataset.playing = "1";
    root.dataset.paused = "0";
    havingGrpSyncControls(root);

    var last = sqlVizPhases(root).length - 1;
    if (fromPhase >= last) return finishViz(root);

    var next = fromPhase + 1;
    var delay = fromPhase === 0 ? DUR[0] : DUR[1];
    paintSteps(root, fromPhase, delay, true, true);

    root._grpTimer = setTimeout(function () {
      havingGrpSetPhase(root, next);
      if (next >= last) {
        paintSteps(root, next, 0, false, true);
        root._grpTimer = setTimeout(function () { finishViz(root); }, END);
      } else {
        continueViz(root, next);
      }
    }, delay);
  }

  function playViz(root) {
    stopViz(root);
    root.dataset.paused = "0";
    var last = sqlVizPhases(root).length - 1;
    if (prefersReduceMotion()) {
      root.dataset.playing = "0";
      root.dataset.seen = "1";
      havingGrpSetPhase(root, last, { animate: false });
      havingGrpSyncControls(root);
      return;
    }
    var from = parseInt(root.dataset.phase || "0", 10);
    havingGrpSetPhase(root, 0, { animate: from > 0 });
    continueViz(root, 0);
  }

  // La jauge se fige sur pause au lieu de sauter à 100 %.
  function pauseViz(root) {
    if (!root || root.dataset.playing !== "1") return;
    var dot = root.querySelector(".vb-dot.on");
    var run = dot && dot.classList.contains("run");
    var tf = run ? getComputedStyle(dot.querySelector("i")).transform : null;

    stopViz(root);
    root.dataset.playing = "0";
    root.dataset.paused = "1";
    layoutSqlViz(root, parseInt(root.dataset.phase || "0", 10), { animate: false });
    havingGrpSyncControls(root);

    if (run) {
      var d = root.querySelector(".vb-dot.on");
      if (d) {
        d.classList.remove("full");
        var b = d.querySelector("i");
        b.style.animation = "none";
        b.style.transform = tf;
      }
    }
  }

  function resumeViz(root) {
    if (!root || root.dataset.paused !== "1") return;
    var b = root.querySelector(".vb-dot.on i");
    if (b) { b.style.animation = ""; b.style.transform = ""; }
    root.dataset.paused = "0";
    continueViz(root, parseInt(root.dataset.phase || "0", 10));
  }
  /* L’observer est porté par le root : plus de disconnect() croisé. */
  function armViz(root) {
    if (root._grpObs) { root._grpObs.disconnect(); root._grpObs = null; }
    if (prefersReduceMotion()) return;

    var scr = document.getElementById("scr-lesson");
    if (!scr || typeof IntersectionObserver === "undefined") {
      root._grpTimer = setTimeout(function () { playViz(root); }, 220);
      return;
    }
    root._grpObs = new IntersectionObserver(function (entries) {
      var visible = entries.some(function (e) {
        return e.isIntersecting && e.intersectionRatio >= 0.25;
      });
      if (!visible) return;
      root._grpObs.disconnect();
      root._grpObs = null;
      havingGrpSetPhase(root, 0, { animate: false });
      playViz(root);
    }, { root: scr, threshold: [0.25, 0.4] });
    root._grpObs.observe(root);
  }

  /* ---------- branchements ---------- */
  var _layout = layoutSqlViz;
  layoutSqlViz = function (root, phase, opts) {
    _layout.apply(this, arguments);
    try {
      buildSteps(root);
      fitCols(root, phase);
      syncSteps(root, phase);
    } catch (e) { /* une viz mal formée ne doit pas casser la leçon */ }
  };

  stopHavingGrpViz = stopViz;
  havingGrpFinish = finishViz;
  havingGrpContinue = continueViz;
  playHavingGrpViz = playViz;
  pauseHavingGrpViz = pauseViz;
  resumeHavingGrpViz = resumeViz;

  initSqlViz = function () {
    // neutralise l’observer global unique de la version précédente
    if (typeof havingGrpObs !== "undefined" && havingGrpObs) havingGrpObs.disconnect();

    allRoots().forEach(function (root) {
      stopViz(root);
      if (root._grpObs) { root._grpObs.disconnect(); root._grpObs = null; }
      root.dataset.playing = "0";
      root.dataset.paused = "0";
      root.dataset.seen = "0";

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (!root.isConnected) return;
          havingGrpSetPhase(root, 0, { animate: false });
          havingGrpSyncControls(root);

          var onResize = function () {
            layoutSqlViz(root, parseInt(root.dataset.phase || "0", 10), { animate: false });
          };
          if (root._grpResize) window.removeEventListener("resize", root._grpResize);
          root._grpResize = onResize;
          window.addEventListener("resize", onResize);

          armViz(root);
        });
      });
    });
  };
  initHavingGrpViz = initSqlViz;

  if (typeof havingGrpObs !== "undefined" && havingGrpObs) havingGrpObs.disconnect();
})();
