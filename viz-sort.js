/* viz-sort.js — micro-interactions pour ORDER BY (data-kind="sort")
   Complète viz-select.js : rang, haptique léger à l’atterrissage, pulse visuel. */
(function () {
  "use strict";

  var SORT_OK = ["orderby"];
  var STAGGER = 45;
  var LAND = 680;
  var hapticTimers = [];

  function eligible(root) {
    return !!root && !!root.dataset &&
      root.dataset.kind === "sort" &&
      SORT_OK.indexOf(root.dataset.viz) !== -1;
  }

  function buzzSel() {
    if (typeof buzz === "function") buzz("selection");
    else if (navigator.vibrate) navigator.vibrate(4);
  }

  function clearHaptics() {
    hapticTimers.forEach(clearTimeout);
    hapticTimers = [];
  }

  function armSort(root) {
    if (!eligible(root)) return;
    root.classList.add("vs");
    var chips = root.querySelectorAll(".grp-chip");
    [].forEach.call(chips, function (c, i) {
      var rank = c.dataset.rank;
      if (rank != null) c.dataset.rankDisp = String(+rank + 1);
      c.style.setProperty("--ds", (i * STAGGER) + "ms");
      c.style.setProperty("--dl", (i * STAGGER + LAND) + "ms");
    });
  }

  function scheduleSortHaptics(root) {
    clearHaptics();
    if (typeof prefersReduceMotion === "function" && prefersReduceMotion()) return;
    if (root.dataset.playing !== "1" || root.dataset.phase !== "1") return;

    var chips = root.querySelectorAll(".grp-chip");
    [].forEach.call(chips, function (c, i) {
      hapticTimers.push(setTimeout(function () {
        if (!root.isConnected || root.dataset.phase !== "1" || root.dataset.paused === "1") return;
        buzzSel();
        c.classList.remove("vs-tick");
        void c.offsetWidth;
        c.classList.add("vs-tick");
        hapticTimers.push(setTimeout(function () { c.classList.remove("vs-tick"); }, 360));
      }, i * STAGGER + LAND));
    });
  }

  function onPhase(root, phase) {
    if (!eligible(root)) return;
    armSort(root);
    if (phase === 1) {
      scheduleSortHaptics(root);
    } else {
      clearHaptics();
      [].forEach.call(root.querySelectorAll(".grp-chip.vs-tick"), function (c) {
        c.classList.remove("vs-tick");
      });
    }
  }

  function armAll() {
    [].forEach.call(
      document.querySelectorAll('.sql-viz[data-kind="sort"]'),
      armSort
    );
  }

  var _setPhase = window.havingGrpSetPhase;
  if (typeof _setPhase === "function") {
    window.havingGrpSetPhase = function (root, phase, opts) {
      _setPhase.apply(this, arguments);
      onPhase(root, phase);
    };
  }

  var _stop = window.stopHavingGrpViz;
  if (typeof _stop === "function") {
    window.stopHavingGrpViz = function (root) {
      clearHaptics();
      _stop.apply(this, arguments);
    };
  }

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
