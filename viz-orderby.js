/* viz-orderby.js — cascade de lecture + délais de rangement pour ORDER BY.
   Complète viz-select.js. Toute l'animation vit dans viz-orderby.css. */
(function () {
  "use strict";

  var STAGGER = 110;

  function eligible(root) {
    return !!root && !!root.dataset &&
      root.dataset.kind === "sort" &&
      root.dataset.viz === "orderby";
  }

  function armOrder(root) {
    if (!eligible(root)) return;
    var chips = root.querySelectorAll(".grp-chip");
    if (!chips.length) return;
    [].forEach.call(chips, function (c, i) {
      c.style.setProperty("--dw", (i * STAGGER) + "ms");
      c.style.setProperty("--rank", String(c.dataset.rank || i));
    });
    root.classList.add("vo");
  }

  function armAll() {
    [].forEach.call(
      document.querySelectorAll('.sql-viz[data-kind="sort"]'),
      armOrder
    );
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
