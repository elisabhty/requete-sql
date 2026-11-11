'use strict';
/* Requête · contrôles de mise en page des vidéos de cours, en plus de ceux du moteur (core.js, ?check) : chargé seulement par
   ?check (fabrication), jamais dans l’app. Il lit le moteur (tl, contentBox, $, $$, rel) dans la page. */
/* Textes recouverts, images vides, scènes peintes (?check). Elisa, 11 novembre, 8 h 57 (captures du cours « SUM, AVG, MIN et MAX » et de
   l’intro de « CASE » : « des soucis de formatage, regarde que ça n’existe pas ailleurs ») : les prix glissaient sous le calcul de la
   moyenne, l’image restait vide un instant entre deux cartes pendant la légende, la pastille de durée passait sous la mascotte, la
   rubrique sous l’étincelle, et un fond violet clair débordait derrière la carte de l’intro (la classe .nv de la page portait le nom
   de celle du moteur).
   — Texte recouvert : un texte visible passe sous un autre élément visible (pastille, carte, image, étincelle) pendant 0,6 s au moins ;
     ce qui passe un instant (s’envole, rebondit) ne compte pas. Le haut de la pile est lu au point près (elementsFromPoint, trois
     points par ligne) ; une image ne couvre que là où elle n’est pas transparente.
   — Image vide : une légende court sur une image où il n’y a rien à voir (ni carte, ni éditeur, ni encadré, ni image), 0,1 s au moins.
   — Scène peinte : une scène (section) garde un fond transparent. */
window.coverIssues = function coverIssues(render, total){
  const stage = $('#stage'), out = [];
  const pe = document.createElement('style');
  pe.textContent = '#stage,#stage *{pointer-events:auto!important}';
  document.head.append(pe);
  const alpha = c => { const m = /rgba?\(([^)]*)\)/.exec(c || ''); if (!m) return c && c !== 'transparent' && c !== 'none' ? 1 : 0;
    const p = m[1].split(/[\s,/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1; };
  const gradAlpha = img => /url\(/.test(img) ? 1 : Math.max(0, ...(img.match(/rgba?\([^)]*\)/g) || []).map(alpha));
  /* Opacité réelle (celle des parents comprise), mémorisée le temps d’une image. */
  let memo = new Map();
  const op = el => { if (!el || el.nodeType !== 1) return 1; let v = memo.get(el); if (v !== undefined) return v;
    const cs = getComputedStyle(el); v = cs.display === 'none' || cs.visibility === 'hidden' ? 0 : op(el.parentElement) * parseFloat(cs.opacity);
    memo.set(el, v); return v; };
  $$('section.scene', stage).forEach(s => { const cs = getComputedStyle(s);
    if (alpha(cs.backgroundColor) > 0 || cs.backgroundImage !== 'none') out.push({kind: 'scène peinte', where: '#' + s.id, gap: 0, at: 0, bg: cs.backgroundColor}); });
  /* Une image ne couvre que là où elle est opaque : son canal alpha, lu une fois par fichier. */
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', {willReadFrequently: true}), pix = new Map();
  const imgAlpha = (img, x, y) => {
    const r = img.getBoundingClientRect(), src = img.currentSrc || img.src; if (!img.naturalWidth || !r.width) return 255;
    let d = pix.get(src);
    if (!d) { cv.width = img.naturalWidth; cv.height = img.naturalHeight; cx.clearRect(0, 0, cv.width, cv.height);
      try { cx.drawImage(img, 0, 0); d = {w: cv.width, h: cv.height, a: cx.getImageData(0, 0, cv.width, cv.height).data}; } catch (e) { d = {w: 0}; }
      pix.set(src, d); }
    if (!d.w) return 255;
    const u = Math.floor((x - r.left) / r.width * d.w), v = Math.floor((y - r.top) / r.height * d.h);
    return u < 0 || v < 0 || u >= d.w || v >= d.h ? 0 : d.a[(v * d.w + u) * 4 + 3];
  };
  const range = document.createRange();
  /* Ce qui cache un texte : un aplat ou une image presque opaques (une teinte légère, un surlignage, ne le cachent pas). */
  const HIDE = 0.6;
  const paints = (E, x, y) => {
    /* Ce qui se pose exprès sur un texte : un trait qui le barre, un tampon, ce qui s’envole, un curseur qui clignote. */
    if (E.closest('.mb-veil, .ripple, .caret, .strike, .stamp, .fly')) return false;
    if (E instanceof SVGElement) return E.tagName.toLowerCase() === 'svg' ? alpha(getComputedStyle(E).backgroundColor) * op(E) >= HIDE : op(E) >= HIDE;
    const o = op(E); if (o < 0.5) return false;
    if (E.tagName === 'IMG') return imgAlpha(E, x, y) / 255 * o >= HIDE;
    const cs = getComputedStyle(E);
    if (alpha(cs.backgroundColor) * o >= HIDE || (cs.backgroundImage !== 'none' && gradAlpha(cs.backgroundImage) * o >= HIDE)) return true;
    /* Un texte sur un texte : au cœur de ses lettres (les boîtes de deux lettres voisines se chevauchent un peu, interlettrage serré). */
    for (const t of E.childNodes) if (t.nodeType === 3 && t.textContent.trim()) {
      range.selectNodeContents(t); for (const q of range.getClientRects()) { const m = q.width * 0.18;
        if (x >= q.left + m && x <= q.right - m && y >= q.top + q.height * 0.2 && y <= q.bottom - q.height * 0.2) return true; } }
    const bw = parseFloat(cs.borderTopWidth) || 0;
    if (bw > 0 && alpha(cs.borderTopColor) * o >= HIDE) { const r = E.getBoundingClientRect(), b = bw * r.width / (E.offsetWidth || r.width || 1) + 0.5;
      if (x - r.left < b || r.right - x < b || y - r.top < b || r.bottom - y < b) return true; }
    return false;
  };
  const label = el => { const h = el instanceof SVGElement && el.ownerSVGElement ? el.ownerSVGElement : el, sc = h.closest('section');
    const cl = typeof h.className === 'string' ? h.className : (h.getAttribute('class') || '');
    return (sc && sc.id ? sc.id + ' ' : h.closest('#cap') ? 'légende ' : '') + (h.id ? '#' + h.id : '') + (cl.trim() ? '.' + cl.trim().split(/\s+/).filter(c => c !== 'abs').join('.') : h.tagName.toLowerCase()); };
  const texts = [], tw = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) if (n.textContent.trim() && !n.parentElement.closest('svg, style, script')) texts.push(n);
  /* Cadres qui se chevauchent : deux cadres (fond ou bordure) posés dans le flux d’une même carte ne se recouvrent jamais (les
     prix poussés sous le calcul de la moyenne). Ce qui est placé à la main (position absolue : badges, tampons, surlignages) n’en
     est pas. */
  const flowBox = el => { if (el.closest('#cap, #chapter, #progress, #header, svg, .mb-veil') || /^(IMG|BR|svg)$/i.test(el.tagName)) return false;
    const cs = getComputedStyle(el); if (cs.display === 'inline' || cs.display === 'contents' || /^(absolute|fixed)$/.test(cs.position)) return false;
    return alpha(cs.backgroundColor) >= 0.3 || cs.backgroundImage !== 'none' || ((parseFloat(cs.borderTopWidth) || 0) > 0 && alpha(cs.borderTopColor) >= 0.3); };
  const layer = el => { for (let n = el.parentElement; n && n !== stage; n = n.parentElement) if (/^(absolute|fixed)$/.test(getComputedStyle(n).position)) return n; return stage; };
  const flows = $$('*', stage).filter(flowBox).map(el => ({el, layer: layer(el)}));
  const runs = new Map(), found = new Map();
  const note = (key, kind, T) => { const r = runs.get(key) || {n: 0, at: +T.toFixed(1)}; r.n++; runs.set(key, r);
    if (r.n >= 3) { const f = found.get(key); if (!f || f.n < r.n) found.set(key, {kind, where: key, at: r.at, n: r.n, gap: -Math.round(r.n * 2) / 10}); } };
  for (let T = 0; T <= total; T += 0.2) {
    render(T); memo = new Map();
    const now = new Set(), k = stage.getBoundingClientRect().width / 1080 || 1;
    /* Une ligne de texte dont une partie seulement est cachée (cinq points) : un texte caché en entier derrière une carte (une liste
       qui défile sous un cadre, un texte d’attente remplacé) ne se voit pas ; une ligne à moitié couverte, si. */
    texts.forEach(t => {
      const el = t.parentElement;
      if (op(el) < 0.5) return;
      range.selectNodeContents(t);
      for (const q of [...range.getClientRects()]) {
        if (q.width < 4 || q.height < 4) continue;
        let over = null, free = 0;
        for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) {
          const x = q.left + q.width * fx, y = q.top + q.height / 2;
          let hit = null;
          for (const E of document.elementsFromPoint(x, y)) {
            if (E === el || el.contains(E) || E.contains(el)) break;
            if (paints(E, x, y)) { hit = E; break; }
          }
          if (hit) over = over || hit; else free++;
        }
        if (over && free) { const key = '« ' + t.textContent.trim().slice(0, 28) + ' » (' + label(el) + ') ← ' + label(over); if (!now.has(key)) { now.add(key); note(key, 'texte recouvert', T); } }
      }
    });
    const vis = flows.filter(f => op(f.el) >= 0.3).map(f => Object.assign({r: f.el.getBoundingClientRect()}, f)).filter(f => f.r.width > 2 && f.r.height > 2);
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      const a = vis[i], b = vis[j];
      if (a.layer !== b.layer || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ox > 4 * k && oy > 4 * k) { const key = label(a.el) + ' ↔ ' + label(b.el); if (!now.has(key)) { now.add(key); note(key, 'cadres qui se chevauchent', T); } }
    }
    [...runs.keys()].forEach(key => { if (!now.has(key)) runs.delete(key); });
  }
  /* L’intro : les pastilles ne touchent pas la mascotte (là où elle est opaque, au plus haut de son balancement), la rubrique, le titre,
     le sous-titre et les pastilles ne touchent pas les étincelles. */
  if ($('#s0.nv')) {
    render(3.1); memo = new Map();
    const k = stage.getBoundingClientRect().width / 1080 || 1, m0 = $('#s0 .mascot');
    const near = (r, q, pad) => r.left < q.right + pad && q.left < r.right + pad && r.top < q.bottom + pad && q.top < r.bottom + pad;
    if (m0 && op(m0) > 0.5) $$('#s0 .iv-pill').forEach(p => { const r = p.getBoundingClientRect(), q = m0.getBoundingClientRect(), pad = 12 * k;
      if (!near(r, q, pad)) return;
      let hit = false;
      for (let y = Math.max(r.top - pad, q.top); y <= Math.min(r.bottom + pad, q.bottom) && !hit; y += 2 * k)
        for (let x = Math.max(r.left - pad, q.left); x <= Math.min(r.right + pad, q.right); x += 3 * k) if (imgAlpha(m0, x, y) > 60) { hit = true; break; }
      if (hit) out.push({kind: 'intro', where: 'pastille « ' + p.textContent.trim() + ' » sur la mascotte', at: 3.1, gap: 0}); });
    $$('#s0 .iv-spark').forEach(sp => { if (op(sp) < 0.5) return; const q0 = sp.getBoundingClientRect(), dx = q0.width * 0.22, dy = q0.height * 0.22;
      const q = {left: q0.left + dx, right: q0.right - dx, top: q0.top + dy, bottom: q0.bottom - dy};
      $$('#s0 .tagpill, #s0 .title, #s0 .sub, #s0 .iv-pill').forEach(el => {
        const rs = el.matches('.iv-pill') ? [el.getBoundingClientRect()] : (() => { const out2 = []; [...el.childNodes].forEach(t => { range.selectNodeContents(t); out2.push(...range.getClientRects()); }); return out2; })();
        if (rs.some(r => r.width > 1 && near(r, q, 4 * k))) out.push({kind: 'intro', where: label(el) + ' sur l’étincelle ' + label(sp), at: 3.1, gap: 0}); }); });
  }
  /* Image vide pendant une légende : pas de 0,05 s (une image vide d’un instant entre deux cartes se voit aussi). */
  const capOn = () => $$('#cap .c').some(c => op(c) >= 0.5);
  /* Ce qui se voit : un cadre (fond, bordure) à n’importe quelle profondeur, une image, un texte posé sur le fond (le titre du
     récapitulatif), la pastille « Prochaine leçon » de la fin. */
  const boxy = el => { const cs = getComputedStyle(el); return el.tagName !== 'IMG' && (alpha(cs.backgroundColor) > 0.2 || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0); };
  const seenEls = $$('*', stage).filter(el => !el.closest('#cap, #chapter, #progress, #header, svg, .mb-veil') && (el.tagName === 'IMG' || boxy(el)))
    .concat(texts.map(t => t.parentElement).filter(el => !el.closest('#cap, #chapter, #progress, #header')), $$('.pont-pill'));
  const textOn = () => { const k = stage.getBoundingClientRect().width / 1080 || 1;
    return seenEls.some(el => { if (op(el) < 0.3) return false; const r = el.getBoundingClientRect(); return r.width > 16 * k && r.height > 16 * k; }); };
  let blank = null;
  /* Une légende qui commence sur une image vide, même un instant : sur l’iPhone, l’image attend que sa voix soit prête (jusqu’à
     2,5 s) et reste figée là (la capture d’Elisa à 1:47). Les débuts des légendes, en temps de la vidéo : le texte qui change. */
  let capTxt = '', starts = 0;
  for (let T = 0; T <= total + 1e-9; T += 0.05) {
    render(T); memo = new Map();
    const txt = $$('#cap .c').filter(c => op(c) >= 0.5).map(c => c.textContent).join('|');
    const starting = txt && txt !== capTxt; capTxt = txt;
    /* La carte d’un moment compte dès qu’elle est posée (son entrée animée la rend transparente un instant). */
    const b = !$('#stage > .mb') && capOn() && !textOn();
    if (b && !blank) { blank = {a: T}; starts = 0; }
    if (b && starting) starts++;
    if (!b && blank) { if (T - blank.a >= 0.099 || starts) out.push({kind: 'image vide', where: 'légende sans rien à l’image' + (starts ? ' (une légende y commence)' : ''), at: +blank.a.toFixed(2), gap: -+(T - blank.a).toFixed(2)}); blank = null; }
  }
  pe.remove();
  render(0);
  return out.concat([...found.values()]);
};
