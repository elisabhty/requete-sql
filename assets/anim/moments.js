'use strict';
/* ---------- Moments « À toi » des cours vidéo d’avant le projet ----------
   Elisa, 26 octobre, 14 h 59 : « il faut convertir les premières leçons sans moment en moments, même si c’est juste des petites
   questions du style : qu’est-ce que la normalisation ? […] les premières leçons sont validées aussi par moi, elles sont bien mises,
   il manque les moments ».
   Ces vidéos gardent donc leurs temps validés (légendes, chapitres, animations, sons). La page décrit ses moments dans MOMENTS, en
   temps de sa timeline, et passe Course({…, moments: MOMENTS}) : à chaque `at`, withMoments() insère un passage de 2,65 s — la
   légende « À toi ! », comme toi() dans les chapitres du projet, puis l’arrêt (le passage d’attente est coupé, comme là-bas) ; tout
   ce qui vient après (légendes, chapitres, animations, sons, pauses, coupes, confettis, bouton « Ajouter à mes notes ») est décalé
   d’autant. L’image du moment est celle de `at` : rien ne doit y bouger (?check le vérifie), et la réponse n’y est pas encore.
   Un moment : {at, from, kind: 'pick' | 'tap', prompt, …}
     pick : options [{label, ok, why}] (une seule bonne réponse ; why : la correction, pour chaque réponse) ; text : réponses en phrases ;
     tap : spots [{k, sel, label, ok, why}] (les zones à toucher : un sélecteur de la page), need (bons gestes attendus),
           hint (la ligne d’aide sous la consigne), miss (la correction d’une zone fausse sans why) ;
     tip : l’indice après deux erreurs (tipKeys : les zones qu’il fait ressortir) ; from : début du passage qui amène le moment
     (« ↺ Revoir »), en temps de la timeline d’origine. */
const MOMENT_GAP = 2.65;   // 0,1 s d’écart + la légende « À toi ! » (2,55 s), comme toi() dans les chapitres du projet

/* Le plan : où tombent les moments une fois les passages insérés, et ce que deviennent les temps de la page. Fonction pure (testée). */
function momentPlan(moments, captions, chapters, duration, notesAt){
  const T = moments.map(m => m.at).sort((a, b) => a - b);
  const r3 = t => +t.toFixed(3);
  /* Un instant qui commence (une animation, une légende, un chapitre, un son) : à partir du moment, il vient après l’arrêt ;
     un instant qui finit (la fin d’une légende, une pause de lecture) : au moment même, il reste avant. */
  const s1 = t => r3(t + MOMENT_GAP * T.filter(x => t >= x - 1e-6).length);
  const s0 = t => r3(t + MOMENT_GAP * T.filter(x => t > x + 1e-6).length);
  const gaps = T.map((x, k) => r3(x + MOMENT_GAP * k));   // début de chaque passage inséré, en temps de la nouvelle timeline
  const caps = captions.map(c => [s1(c[0]), c[1] >= 900 ? c[1] : s0(c[1]), ...c.slice(2)]);
  gaps.forEach(g => caps.push([r3(g + 0.1), r3(g + MOMENT_GAP), 'À toi !']));
  caps.sort((x, y) => x[0] - y[0]);
  const order = moments.map((m, i) => i).sort((i, j) => moments[i].at - moments[j].at);
  const picks = order.map((i, k) => {
    const m = moments[i];
    return Object.assign({}, m, {at: +(gaps[k] + 2.45).toFixed(2), from: m.from != null ? s1(m.from) : null, src: m.at});
  });
  return {
    s0, s1, gaps, picks, captions: caps,
    /* Un chapitre garde son moment : celui qui finit au moment s’étend sur le passage inséré. */
    chapters: chapters.map(c => Object.assign({}, c, {a: s1(c.a), b: c.b >= 900 ? c.b : s1(c.b)})),
    duration: r3(duration + MOMENT_GAP * T.length),
    notesAt: notesAt == null ? notesAt : s1(notesAt),
    /* Le passage d’attente, coupé : la légende « À toi ! » se montre, puis l’image s’arrête aussitôt (comme les chapitres du projet). */
    cuts: picks.map(p => [r3(p.at - 1.35), 1.25])
  };
}

/* Ce que l’élève touche ou choisit, jugé et montré sur l’image (window.IX), quand la page n’a pas le sien : une bonne zone s’entoure
   de vert (elle le reste jusqu’à la reprise), une fausse rougit un instant ; un choix renvoie sa correction. */
function momentIX(P){
  let X = null, wait = -1;
  const clear = () => { if (!X) return; X.tm.forEach(clearTimeout); X.cls.forEach(([e, c]) => e.classList.remove(c)); X = null; wait = -1; };
  const start = i => { if (!X || X.i !== i) { clear(); X = {i, cls: [], tm: [], got: new Set()}; } };
  const mark = (e, c) => { if (e && !e.classList.contains(c)) { e.classList.add(c); X.cls.push([e, c]); } };
  const flash = (e, c, ms = 650) => { if (!e) return; e.classList.remove(c); void e.offsetWidth; e.classList.add(c); X.cls.push([e, c]); X.tm.push(setTimeout(() => e.classList.remove(c), ms)); };
  const spot = (i, k) => (P[i].spots || []).find(s => String(s.k) === String(k));
  return {
    enter: i => { clear(); start(i); },
    spots: i => (P[i].spots || []).map(s => Object.assign({k: String(s.k), label: s.label || String(s.k)}, rel($(s.sel)))),
    act(i, k){
      start(i);
      const s = spot(i, k), p = P[i];
      if (!s) return {ok: false};
      if (s.ok) {
        if (!X.got.has(s.k)) { X.got.add(s.k); mark($(s.sel), 'pk-on'); sfx('tick', X.got.size + 1, 0.6); }
        return {ok: true, done: X.got.size >= (p.need || 1), why: '', at: rel($(s.sel))};
      }
      flash($(s.sel), 'pk-ko');
      const why = s.why || p.miss;
      return {ok: false, why: why ? fr(why) : ''};
    },
    pick(i, k){
      clear(); start(i);
      const o = P[i].options[k], ok = !!o.ok;
      sfx(ok ? 'pop' : 'miss', 2, 0.5);
      return new Promise(res => setTimeout(() => res({ok, why: o.why ? fr(o.why) : ''}), 260));
    },
    hint(i){ const p = P[i]; return p.tip ? {text: fr(p.tip), keys: (p.tipKeys || []).map(String)} : null; },
    slot: () => null,
    leave(i, answered){ if (answered && X && X.i === i) wait = i; else clear(); },
    tick(t){ if (wait < 0) return; const a = P[wait].at; if (t >= a + 0.0199 || t < a - 0.001) clear(); }
  };
}

/* Course({…, moments}) passe par ici (core.js) : les temps de la page deviennent ceux de la vidéo avec ses moments. */
function withMoments(cfg){
  const M = momentPlan(cfg.moments, cfg.captions, cfg.chapters, cfg.duration, cfg.notesAt);
  const clashes = [];
  const build0 = cfg.build;
  const out = Object.assign({}, cfg, {captions: M.captions, chapters: M.chapters, duration: M.duration, notesAt: M.notesAt, picks: M.picks,
    build(){
      /* Ce que la page construit, en temps d’origine, est décalé après coup : animations (sauf l’habillage, déjà construit avec les
         nouveaux temps), sons, pauses, coupes et confettis. */
      const pre = new Set(tl.getChildren(false, true, true));
      const n = {cues: CUES.length, holds: EXTRA_HOLDS.length, cuts: CUTS.length, conf: CONFETTI.length};
      build0();
      const T = cfg.moments.map(m => m.at);
      tl.getChildren(false, true, true).forEach(c => {
        if (pre.has(c)) return;
        const a = c.startTime(), b = a + c.totalDuration();
        /* Une animation en cours à l’instant d’un moment continuerait pendant « À toi ! » : la page doit placer ses moments entre deux gestes. */
        if (!(c.vars && c.vars.data === 'amb')) T.forEach(x => { if (a < x - 0.001 && b > x + 0.001) clashes.push({moment: x, at: +a.toFixed(2), to: +b.toFixed(2), el: (c.targets && c.targets()[0] && c.targets()[0].id) ? '#' + c.targets()[0].id : '?'}); });
        const k = T.filter(x => a >= x - 1e-6).length;
        if (k) c.startTime(a + MOMENT_GAP * k);
      });
      CUES.slice(n.cues).forEach(q => { q.t = M.s1(q.t); });
      EXTRA_HOLDS.slice(n.holds).forEach(h => { h[0] = M.s0(h[0]); });
      CUTS.slice(n.cuts).forEach(c => { c[0] = M.s1(c[0]); });
      CONFETTI.slice(n.conf).forEach(c => { c.t = M.s1(c.t); });
      M.cuts.forEach(([t, d]) => cut(t, d));
      /* Une légende de la page à cheval sur un moment : « À toi ! » la couvrirait. */
      cfg.captions.forEach(c => T.forEach(x => { if (c[0] < x - 0.001 && c[1] > x + 0.001 && c[1] < 900) clashes.push({moment: x, caption: c[2]}); }));
    },
    extraClashes: () => clashes
  });
  window.__moments = M.picks;   // pour les contrôles (app, tests) : les moments tels que le lecteur les reçoit, bonnes zones comprises
  if (!window.IX) {
    const IX = momentIX(M.picks);
    window.IX = IX;
    const br = cfg.beforeRender;
    out.beforeRender = t => { IX.tick(t); if (br) br(t); };
  }
  return out;
}

/* Une zone touchée : entourée de vert si c’est la bonne, rouge un instant sinon (les cadres restent dans la zone, rien ne bouge).
   Pendant un moment, la légende se cache (le lecteur pose lv-pk-open sur body) : la règle de core.css, redite pour where.html, qui a son propre style. */
(() => {
  const s = document.createElement('style');
  s.textContent = '.pk-on{outline:6px solid #16A34A;outline-offset:-6px}.pk-ko{outline:6px solid #EF4F55;outline-offset:-6px}body.lv-pk-open #cap{visibility:hidden!important}';
  document.head.append(s);
})();
