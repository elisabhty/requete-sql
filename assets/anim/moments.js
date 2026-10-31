'use strict';
/* ---------- Moments « À toi » des cours vidéo d’avant le projet ----------
   Elisa, 26 octobre, 14 h 59 : « il faut convertir les premières leçons sans moment en moments […] il manque les moments ».
   Ces vidéos gardent donc leurs temps validés (légendes, chapitres, animations, sons). La page décrit ses moments dans MOMENTS, en
   temps de sa timeline, et passe Course({…, moments: MOMENTS}) : à chaque `at`, withMoments() insère un passage de 2,65 s — la
   légende « À toi ! », comme toi() dans les chapitres du projet, puis l’arrêt (le passage d’attente est coupé, comme là-bas) ; tout
   ce qui vient après (légendes, chapitres, animations, sons, pauses, coupes, confettis, bouton « Ajouter à mes notes ») est décalé
   d’autant. L’image du moment est celle de `at` : rien ne doit y bouger (?check le vérifie), et la réponse n’y est pas encore.
   Un moment : {at, from, kind: 'pick' | 'tap' | 'sort' | 'link' | 'tune', prompt, …}
     pick : options [{label, ok, why}] (une seule bonne réponse ; why : la correction, pour chaque réponse) ; text : réponses en phrases ;
            slot : le sélecteur d’un trou de la page (ou de la carte du moment), où l’étiquette se glisse aussi du doigt ;
     tap : spots [{k, sel, label, ok, why}] (les zones à toucher : un sélecteur de la page), need (bons gestes attendus),
           hint (la ligne d’aide sous la consigne), miss (la correction d’une zone fausse sans why) ;
     sort : options [{label, to, why}] (chaque étiquette du plateau va dans la zone `to` ; why : la correction si elle est mal rangée),
            spots [{k, sel, label}] (les zones où ranger), next (aide une fois une étiquette choisie, {x} : l’étiquette) ;
     link : spots [{k, sel, label, side: 'l' | 'r', pair, why}] (relier chaque élément de gauche à sa paire de droite ; why : la
            correction d’un mauvais lien partant de lui), need (liens attendus) ;
     tune : un réglage à manipuler, dont l’effet se voit aussitôt sur la carte (Elisa, 27 octobre, 23 h 25 : des mini-jeux) :
            controls [{k, type: 'range' | 'seg' | 'switch', label, min, max, step, choices, value, code}] (curseur, choix d’une valeur,
            bascule), show(s, carte) (la carte pour le réglage s, à chaque mouvement), check(s) → {ok, why} (le réglage validé),
            answer (le réglage juste, montré quand le moment s’ouvre déjà réussi), ico (l’icône de la consigne) ;
     board : {y, h, html, veil} (facultatif) : une carte posée sur l’image le temps du moment (relier, ranger, compléter une requête) :
            ses éléments servent de zones ; elle n’existe que pendant le moment, jamais dans la vidéo ; un voile la sépare de la scène
            (veil: false pour garder la scène visible autour) ;
     win (tap, sort, link) : l’explication sous « Bien vu ! », remontrée au retour (tune : celle du réglage juste) ;
     tip : l’indice après deux erreurs (tipKeys : les zones qu’il fait ressortir) ; from : début du passage qui amène le moment
     (« ↺ Revoir »), en temps de la timeline d’origine.
   Elisa, 27 octobre, 13 h 48 : « tu peux faire tout ce que tu veux comme moment : lignes à relier, toucher, dessins, question, puzzle ». */
function momentWin(p){
  if (p.win) return fr(p.win);
  if (p.kind === 'tune' && p.check && p.answer) try { const r = p.check(p.answer); return r && r.ok && r.why ? fr(r.why) : ''; } catch (e) {}
  return '';
}
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
  /* La carte du moment (board) : posée dans la scène à l’ouverture du moment, retirée avec lui. */
  const clear = () => { if (!X) return; X.tm.forEach(clearTimeout); X.cls.forEach(([e, c]) => e.classList.remove(c)); X.add.forEach(e => e.remove());
    if (X.slot0) X.slot0[0].innerHTML = X.slot0[1];   // le trou retrouve son « ? » : la vidéo le remplit elle-même, et « Revoir » le remontre vide
    X = null; wait = -1; };
  const start = i => {
    if (X && X.i === i) return;
    clear(); X = {i, cls: [], tm: [], add: [], got: new Set()};
    const b = P[i].board;
    if (b) {
      const d = document.createElement('div');
      d.className = 'mb'; d.style.top = (b.y || 640) + 'px'; if (b.h) d.style.minHeight = b.h + 'px';
      d.innerHTML = fr(b.html || '');
      const st = $('#stage');
      /* Un voile sous la carte : la scène de la vidéo, à moitié recouverte, dépassait autour d’elle (lignes de tableau, bout de requête).
         La scène s’efface le temps du moment (mb-veiled) : la carte se pose seule sur le fond violet du cours. Le voile était un aplat
         lavande, l’ancien fond des vidéos : sur le violet, il restait comme un grand cadre blanc autour de la carte (Elisa, 31 octobre,
         1 h 02 : « faire attention, car on a des cadres blancs qui restent »). Il ne peint plus rien : il marque seulement le moment. */
      if (st && b.veil !== false) { const v = document.createElement('div'); v.className = 'mb-veil'; st.append(v); X.add.push(v); mark(st, 'mb-veiled'); }
      if (st) { st.append(d); X.add.push(d); if (typeof frDom === 'function') try { frDom(d); } catch (e) {} }
      X.board = d;
    }
    /* Un réglage : la carte part des valeurs de départ des commandes. */
    if (P[i].kind === 'tune') draw(i, tuneStart(P[i]));
  };
  const tuneStart = p => Object.fromEntries((p.controls || []).map(c => [c.k, c.value]));
  const draw = (i, s) => { if (X && X.board && P[i].show) try { P[i].show(s, X.board); } catch (e) {} };
  const mark = (e, c) => { if (e && !e.classList.contains(c)) { e.classList.add(c); X.cls.push([e, c]); } };
  const flash = (e, c, ms = 650) => { if (!e) return; e.classList.remove(c); void e.offsetWidth; e.classList.add(c); X.cls.push([e, c]); X.tm.push(setTimeout(() => e.classList.remove(c), ms)); };
  const spot = (i, k) => (P[i].spots || []).find(s => String(s.k) === String(k));
  const won = (p, d, el) => ({ok: true, done: d, why: d ? momentWin(p) : '', at: rel(el)});
  /* Rectangle d’un élément de la carte, sans son entrée animée (qui le décale et le réduit un instant) : mesuré pendant l’entrée,
     la zone à toucher tombait à côté de la case. */
  const lay = (el, ref) => {
    const host = ref || $('#stage');
    if (el && host && el.closest('#stage > .mb')) { let x = 0, y = 0, e = el; while (e && e !== host) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
      if (e === host) return {x, y, w: el.offsetWidth, h: el.offsetHeight}; }
    return rel(el, ref);
  };
  /* Un lien réussi : un trait entre les deux éléments, sur la carte du moment (ou sur la scène). */
  const line = (a, b) => {
    const host = (a && a.closest('#stage > .mb')) || $('#stage'); if (!a || !b || !host) return;
    const r = lay(a, host), q = lay(b, host);
    let svg = host.querySelector(':scope > svg.mb-ln');
    if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'mb-ln'); host.append(svg); X.add.push(svg); }
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', r.x + r.w); l.setAttribute('y1', r.y + r.h / 2); l.setAttribute('x2', q.x); l.setAttribute('y2', q.y + q.h / 2);
    svg.append(l);
  };
  return {
    enter: i => { clear(); start(i); },
    /* Réglage en cours : la carte suit chaque mouvement (rien n’est jugé). */
    tune(i, s){ start(i); draw(i, s); },
    /* Moment déjà réussi : la carte montre le réglage juste. */
    /* Moment déjà réussi (vidéo revue) : l’image garde la réponse — réglage, blocs rangés, zones, liens (Elisa, 28 octobre, 19 h 15). */
    solve(i){
      start(i);
      const p = P[i];
      if (p.kind === 'tune' && p.answer) draw(i, p.answer);
      if (p.kind === 'sort') (p.options || []).forEach((o, k) => {
        const z = spot(i, o.to), el = z && $(z.sel); if (!el || X.got.has(k)) return;
        X.got.add(k);
        const c = document.createElement('span'); c.className = 'mb-chip'; c.textContent = o.label;
        (el.querySelector('.mb-drop') || el).append(c); X.add.push(c); mark(el, 'pk-on');
      });
      if (p.kind === 'tap') (p.spots || []).filter(s => s.ok).forEach(s => { X.got.add(s.k); mark($(s.sel), 'pk-on'); });
      if (p.kind === 'link') (p.spots || []).filter(s => s.side === 'l' && s.pair != null).forEach(a => {
        const b = spot(i, a.pair); if (!b || X.got.has(a.k)) return;
        X.got.add(a.k); mark($(a.sel), 'pk-on'); mark($(b.sel), 'pk-on'); line($(a.sel), $(b.sel));
      });
    },
    spots: i => { start(i); return (P[i].spots || []).map(s => Object.assign({k: String(s.k), label: s.label || String(s.k), side: s.side || undefined}, lay($(s.sel)))); },
    act(i, k, k2){
      start(i);
      const p = P[i];
      /* Réglage validé : le lecteur envoie l’état des commandes (JSON) ; la page le juge. */
      if (p.kind === 'tune') {
        let s = {}; try { s = typeof k === 'string' ? JSON.parse(k) : (k || {}); } catch (e) {}
        draw(i, s);
        const r = (p.check && p.check(s)) || {ok: false};
        const el = X.board || $('#stage');
        if (r.ok) { mark(el, 'pk-on'); return {ok: true, done: true, why: r.why ? fr(r.why) : '', at: rel(el)}; }
        flash(el, 'pk-ko');
        return {ok: false, why: r.why ? fr(r.why) : (p.miss ? fr(p.miss) : '')};
      }
      if (p.kind === 'sort') {
        const o = (p.options || [])[+k], z = spot(i, k2), el = z && $(z.sel);
        if (!o || !z) return {ok: false};
        if (String(o.to) === String(z.k)) {
          if (!X.got.has(+k)) {
            X.got.add(+k);
            const c = document.createElement('span'); c.className = 'mb-chip'; c.textContent = o.label;   // la police du bouton rangé
            const box = el && (el.querySelector('.mb-drop') || el); if (box) { box.append(c); X.add.push(c); }
            mark(el, 'pk-on'); sfx('tick', X.got.size + 1, 0.6);
          }
          return won(p, X.got.size >= p.options.length, el);
        }
        flash(el, 'pk-ko');
        const why = o.why || p.miss;
        return {ok: false, why: why ? fr(why) : ''};
      }
      if (p.kind === 'link') {
        const a = spot(i, k), b = spot(i, k2);
        if (!a || !b) return {ok: false};
        const ok = String(a.pair) === String(b.k) || String(b.pair) === String(a.k);
        if (ok) {
          if (!X.got.has(a.k)) { X.got.add(a.k); mark($(a.sel), 'pk-on'); mark($(b.sel), 'pk-on'); line($(a.sel), $(b.sel)); sfx('tick', X.got.size + 1, 0.6); }
          return won(p, X.got.size >= (p.need || 1), $(b.sel));
        }
        flash($(a.sel), 'pk-ko'); flash($(b.sel), 'pk-ko');
        const why = a.why || b.why || p.miss;
        return {ok: false, why: why ? fr(why) : ''};
      }
      const s = spot(i, k);
      if (!s) return {ok: false};
      if (s.ok) {
        if (!X.got.has(s.k)) { X.got.add(s.k); mark($(s.sel), 'pk-on'); sfx('tick', X.got.size + 1, 0.6); }
        return won(p, X.got.size >= (p.need || 1), $(s.sel));
      }
      flash($(s.sel), 'pk-ko');
      const why = s.why || p.miss;
      return {ok: false, why: why ? fr(why) : ''};
    },
    pick(i, k){
      clear(); start(i);
      const o = P[i].options[k], ok = !!o.ok;
      /* Une réponse glissée dans le trou d’une requête : elle s’y écrit. */
      if (P[i].slot) { const sl = $(P[i].slot); if (sl) { X.slot0 = [sl, sl.innerHTML]; sl.textContent = o.label; mark(sl, ok ? 'mb-fill' : 'mb-bad');
        if (!ok) X.tm.push(setTimeout(() => { if (X && X.slot0) { sl.innerHTML = X.slot0[1]; sl.classList.remove('mb-bad'); } }, 900)); } }
      sfx(ok ? 'pop' : 'miss', 2, 0.5);
      return new Promise(res => setTimeout(() => res({ok, why: o.why ? fr(o.why) : ''}), 260));
    },
    hint(i){ const p = P[i]; return p.tip ? {text: fr(p.tip), keys: (p.tipKeys || []).map(String)} : null; },
    slot: i => { start(i); const sl = P[i].slot && $(P[i].slot); return sl ? lay(sl) : null; },
    leave(i, answered){ if (answered && X && X.i === i) wait = i; else clear(); },
    tick(t){ if (wait < 0) return; const a = P[wait].at; if (t >= a + 0.0199 || t < a - 0.001) clear(); }
  };
}

/* Course({…, moments}) passe par ici (core.js) : les temps de la page deviennent ceux de la vidéo avec ses moments. */
function withMoments(cfg){
  const M = momentPlan(cfg.moments, cfg.captions, cfg.chapters, cfg.duration, cfg.notesAt);
  const clashes = [];
  const build0 = cfg.build;
  /* Les arrêts « toucher » de la page (opens : un message à ouvrir, un bouton ; le recrutement du cours 0) suivent la vidéo avec ses moments. */
  const opens = (cfg.opens || []).map(o => Object.assign({}, o, {at: M.s1(o.at)}));
  const out = Object.assign({}, cfg, {captions: M.captions, chapters: M.chapters, duration: M.duration, notesAt: M.notesAt, picks: M.picks, opens,
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
  s.textContent = '.pk-on{outline:6px solid #16A34A;outline-offset:-6px}.pk-ko{outline:6px solid #EF4F55;outline-offset:-6px}body.lv-pk-open #cap{visibility:hidden!important}'
    /* La carte d’un moment (relier, ranger, compléter une requête) : une carte blanche, comme celles des scènes. Entrée non maintenue
       (backwards) : maintenue, Safari gardait la carte dans un calque et son texte paraissait flou sur iPhone. Seule la carte posée sur
       la scène (#stage > .mb) : le corps des emails des cours jointure-3-tables et union s’appelle aussi .mb ; il prenait ce style
       (carte absolue de 952 px), sortait de son email et s’y retrouvait coupé net (Elisa, 31 octobre, 1 h 02 : « comportement bizarre »). */
    + '#stage>.mb{position:absolute;left:64px;width:952px;z-index:40;box-sizing:border-box;padding:44px 44px 48px;border-radius:48px;background:#fff;box-shadow:0 0 0 3px #E6E1F6,0 12px 0 #DCD5F2;font-family:Inter,system-ui,sans-serif;color:#1F1B3A;animation:mbIn .35s cubic-bezier(.2,.9,.3,1.3) backwards}'
    + '.mb-veil{position:absolute;left:0;right:0;top:190px;bottom:0;z-index:39;pointer-events:none}'
    + '#stage.mb-veiled>:not(#progress):not(#header):not(#cap):not(.mb):not(.mb-veil):not(.mb-ln){opacity:0!important;transition:opacity .25s ease-out}'
    + '@keyframes mbIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}'
    + '.mb-k{display:inline-block;margin-bottom:22px;padding:10px 22px;border-radius:999px;background:#EEE9FF;color:#5335E0;font:800 34px/1.1 "Bricolage Grotesque",Inter,sans-serif}'
    + '.mb-cols{position:relative;display:flex;justify-content:space-between;gap:150px}.mb-col{flex:1;display:flex;flex-direction:column;gap:26px}'
    + '.mb-i{display:flex;align-items:center;justify-content:center;min-height:96px;padding:12px 22px;box-sizing:border-box;border-radius:28px;background:#F6F4FF;box-shadow:inset 0 0 0 3px #DCD5F2;font:600 38px/1.2 Inter,sans-serif;text-align:center}'
    + '.mb-i.c,.mb-q,.mb-chip.c{font-family:"JetBrains Mono",JBM,monospace;font-weight:700;font-variant-ligatures:none;font-feature-settings:"liga" 0,"calt" 0}.mb-i.c{color:#5335E0}.mb-i.sm{font-size:32px}'
    + '.mb-bin{min-height:150px;padding:20px;border-radius:30px;background:#F6F4FF;box-shadow:inset 0 0 0 3px #DCD5F2;display:flex;flex-direction:column;gap:12px}'
    + '.mb-bin.mb-row{flex-direction:row;align-items:center;min-height:112px;gap:22px;padding:14px 24px}.mb-bin.mb-row>b{flex:0 0 72px}.mb-bin.mb-row .mb-drop{flex:1}'
    + '.mb-bin>b{font:800 36px/1.15 "Bricolage Grotesque",Inter,sans-serif;color:#5335E0}.mb-drop{display:flex;flex-wrap:wrap;gap:10px}'
    + '.mb-chip{display:inline-block;padding:10px 18px;border-radius:999px;background:#16A34A;color:#fff;font:700 32px/1.2 Inter,sans-serif;animation:mbIn .3s backwards}'
    + '.mb-q{padding:30px 34px;border-radius:30px;background:#1F1B3A;color:#fff;font-size:38px;line-height:1.55;white-space:pre-wrap}.mb-q .k{color:#B9A8FF}.mb-q .s{color:#FFD58A}'
    + '.mb-hole{display:inline-block;min-width:150px;padding:0 14px;border-radius:14px;background:rgba(185,168,255,.18);box-shadow:inset 0 0 0 3px #B9A8FF;color:#fff;text-align:center}'
    + '.mb-hole.mb-fill{background:#16A34A;box-shadow:none}.mb-hole.mb-bad{background:#EF4F55;box-shadow:none}.mb-fill:not(.mb-hole){color:#16A34A!important}.mb-bad:not(.mb-hole){color:#EF4F55!important}'
    /* Un calendrier (des jours à toucher) et une référence découpée en caractères numérotés. */
    + '.mb-row{display:flex;justify-content:center;align-items:flex-end;gap:24px}.mb-grp{display:flex;flex-direction:column;align-items:center;gap:12px}.mb-grp>small{font:700 28px/1 Inter,sans-serif;color:#6B6790}.mb-grp>div{display:flex;gap:10px}'
    + '.mb-i.d{width:84px;min-height:112px;padding:0;font:800 40px/1 Inter,sans-serif}.mb-grp>div{gap:8px}.mb-i.from{background:#5335E0;color:#fff;box-shadow:none}'
    + '.mb-lh{display:block;margin-bottom:4px;font:800 30px/1.2 "Bricolage Grotesque",Inter,sans-serif;color:#5335E0}.mb-t{display:block;padding:12px 18px;border-radius:16px;background:#F6F4FF;box-shadow:inset 0 0 0 3px #E6E1F6;font:600 30px/1.25 Inter,sans-serif}'
    + '.mb-chars{display:flex;flex-wrap:wrap;justify-content:center;gap:12px 8px;max-width:856px;margin:0 auto}.mb-chars>span{display:flex;flex-direction:column;align-items:center;width:100px;padding:14px 0 10px;box-sizing:border-box;border-radius:18px;background:#F6F4FF;font:700 52px/1.1 "JetBrains Mono",JBM,monospace}'
    + '.mb-chars>span>small{margin-top:8px;font:700 28px/1 Inter,sans-serif;color:#8A86A8}.mb-chars>span.n{background:#EEE9FF;color:#5335E0}'
    + 'svg.mb-ln{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}svg.mb-ln line{stroke:#16A34A;stroke-width:8;stroke-linecap:round}'
    /* Mini-jeux (tune) : des lignes qui passent ou non (portique), des pastilles qui disparaissent (doublons), des étages (ascenseur). */
    + '#stage>.mb .mb-q{margin-bottom:24px}'
    + '.mg-hd{display:flex;align-items:center;gap:20px;margin-bottom:24px}.mg-hd>.mb-k{flex:none;margin:0}.mg-hd>.mb-q{flex:1;min-width:0;margin:0;padding:22px 28px;white-space:nowrap}'
    + '.mg-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}'
    + '.mg-r{position:relative;display:flex;align-items:center;gap:12px;min-height:88px;padding:0 18px 0 58px;box-sizing:border-box;border-radius:24px;background:#F6F4FF;box-shadow:inset 0 0 0 3px #DCD5F2;font:600 30px/1.1 Inter,sans-serif;letter-spacing:-.01em;white-space:nowrap;transition:opacity .3s,transform .35s cubic-bezier(.2,.9,.3,1.3),background-color .25s,box-shadow .25s}'
    + '.mg-r>b{margin-left:auto;font:800 32px/1 "JetBrains Mono",JBM,monospace;color:#5335E0}'
    + '.mg-r::before{content:"";position:absolute;left:16px;top:50%;width:28px;height:28px;margin-top:-14px;border-radius:50%;background:#DCD5F2;transition:background-color .25s}'
    + '.mg-r.in{background:#E7F7EE;box-shadow:inset 0 0 0 3px #A7E3C0}.mg-r.in::before{background:#16A34A url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27%3E%3Cpath d=%27M9 16.5l4.5 4.5L23 11.5%27 fill=%27none%27 stroke=%27white%27 stroke-width=%274%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E") center/100% no-repeat}'
    + '.mg-r.out{opacity:.4;transform:scale(.97)}'
    + '.mg-c{margin-top:24px;text-align:center;font:600 32px/1.2 Inter,sans-serif;color:#6B6790}.mg-c b{font-size:40px;font-weight:800;color:#1F1B3A}'
    + '.mg-pills{display:flex;flex-wrap:wrap;justify-content:center;margin:-7px}'
    + '.mg-p{display:inline-flex;align-items:center;max-width:460px;margin:7px;padding:16px 26px;box-sizing:border-box;overflow:hidden;white-space:nowrap;border-radius:999px;background:var(--c,#EEE9FF);color:var(--t,#3B2A9E);font:700 36px/1.1 Inter,sans-serif;transition:max-width .4s ease,padding .4s ease,margin .4s ease,opacity .3s ease,transform .4s cubic-bezier(.2,.9,.3,1.3)}'
    + '.mg-p i{font-style:normal;font-weight:600;opacity:.75}.mg-p.gone{max-width:0;padding-left:0;padding-right:0;margin-left:0;margin-right:0;opacity:0;transform:scale(.5)}'
    + '.mg-lift{position:relative}.mg-fl{position:absolute;left:0;width:64px;display:flex;align-items:center;justify-content:center;font:800 30px/1 Inter,sans-serif;color:#8A86A8}'
    + '.mg-lr{position:absolute;left:80px;right:0;display:flex;align-items:center;gap:18px;padding:0 24px;box-sizing:border-box;border-radius:22px;background:#F6F4FF;box-shadow:inset 0 0 0 3px #DCD5F2;font:600 32px/1 Inter,sans-serif;transition:top .55s cubic-bezier(.3,.9,.3,1.1),background-color .25s}'
    + '.mg-lr>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mg-lr>b{flex:0 0 auto;font:700 30px/1 "JetBrains Mono",JBM,monospace;color:#8A86A8;text-align:right}.mg-lr>b.k{color:#5335E0;font-weight:800}'
    + '.mg-lr.top{background:#E7F7EE;box-shadow:inset 0 0 0 3px #A7E3C0}'
    /* Le puzzle (des blocs à poser dans les trous d’une requête, un bac « En trop ») et la chasse (des mots d’une requête à toucher). */
    + '.mb-q .mb-chip{font-family:"JetBrains Mono",JBM,monospace;font-size:34px;padding:6px 14px;border-radius:12px;font-variant-ligatures:none}'
    + '.mg-pz{line-height:2}.mg-pz .mb-hole{display:inline-flex;align-items:center;justify-content:center;min-width:170px;min-height:66px;padding:0 6px;box-sizing:border-box;vertical-align:middle}'
    + '.mg-pz .mb-hole .mb-drop{gap:0}.mg-pz .mb-hole.pk-on{background:none;box-shadow:none;outline:none}'
    + '.mg-bin{margin-top:26px;min-height:120px}.mg-bin>b{font-size:32px}'
    /* Le bon emplacement : des trous entre les mots d’une requête ; le bon se remplit du mot-clé (data-w sur la carte). */
    + '.mg-gaps{line-height:2}.mg-g{display:inline-block;width:46px;height:58px;margin:0 8px;vertical-align:middle;border-radius:14px;box-shadow:inset 0 0 0 3px #B9A8FF;background:rgba(185,168,255,.16);font-style:normal}'
    + '.mg-g.pk-on{width:auto;height:auto;padding:0 12px;outline:none;background:#16A34A;box-shadow:none;vertical-align:baseline}.mg-g.pk-on::before{content:attr(data-w);color:#fff;font-weight:800}'
    /* Chacun son rôle : des cases en lignes, le mot-clé à gauche ; une erreur SQL sous un banc d’essai. */
    + '.mg-kw{gap:20px}.mg-kw>.mb-bin.mb-row>b{flex:0 0 190px;font:800 36px/1 "JetBrains Mono",JBM,monospace;color:#5335E0}.mg-kw .mb-chip{font-size:30px}'
    + '.mg-err{display:inline-block;padding:10px 22px;border-radius:18px;background:#FDE8E8;color:#C2323A;font:700 30px/1.3 "JetBrains Mono",JBM,monospace}'
    + '.mg-r.mg-cat{padding-left:24px}.mg-r.mg-cat::before{display:none}.mg-cat>b{font:700 28px/1 Inter,sans-serif;color:#6B6790}'
    + '.mb-q.mg-sm{font-size:32px;line-height:1.5;margin-bottom:22px}'
    + '.mg-tag{display:inline-block;margin-left:10px;padding:4px 10px;border-radius:999px;background:#FFF1D6;color:#9A5B00;font:700 22px/1 Inter,sans-serif;font-style:normal}'
    + '.mg-r.mg-test{grid-column:1/-1;background:#FFF8E6;box-shadow:inset 0 0 0 3px #F5D58A}.mg-r.mg-test.in{background:#E7F7EE;box-shadow:inset 0 0 0 3px #A7E3C0}'
    + '.mg-dense .mg-r{min-height:76px;padding-left:52px;font-size:28px}.mg-dense .mg-r::before{left:14px;width:26px;height:26px;margin-top:-13px}.mg-dense .mg-r>b{font-size:26px}.mg-dense .mg-tag{margin-left:8px;padding:3px 8px;font-size:20px}'
    + '.mg-null{font-style:italic;font-weight:600;color:#8A86A8;padding:2px 10px;border-radius:10px;box-shadow:inset 0 0 0 2px #DCD5F2}.mg-cb>b{font-family:"JetBrains Mono",JBM,monospace}'
    + '.mg-ph{font:800 32px/1.1 "Bricolage Grotesque",Inter,sans-serif;color:#5335E0}.mg-r.mg-dup{background:#FDE8E8;box-shadow:inset 0 0 0 3px #F3B7BB;color:#C2323A}'
    + '.mg-tq{line-height:1.95}.mg-tq .mg-t{display:inline-block;padding:2px 10px;margin:0 -10px;border-radius:14px;line-height:1.3}';
  document.head.append(s);
})();
