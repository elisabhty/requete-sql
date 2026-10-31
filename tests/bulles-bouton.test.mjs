/* Elisa, 30 octobre, 23 h 42 (trois captures) : « améliorer aussi les bulles, stickers, animation, micro-interaction ? » (la légende
   des vidéos), « pas ouf le bouton et le rond du sélecteur » (le bouton « Valide la leçon : réussis au moins 4 exercices sur 5 » et le
   rond qui suivait la souris), « ref 3 pareil, est-ce possible d’améliorer la barre de nav (présente à plusieurs endroits) » (la barre
   de défilement). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), cur = lire('assets/curseur.js');
const core = lire('assets/anim/core.js'), coreCss = lire('assets/anim/core.css'), where = lire('assets/anim/where.html');
const cut = (src, a, b) => { const i = src.indexOf(a); assert.ok(i >= 0, a); const j = src.indexOf(b, i + a.length); assert.ok(j > i, b); return src.slice(i, j); };

/* Un DOM minuscule, juste ce que capWords utilise */
class N {
  constructor(type, tag, text) { this.nodeType = type; this.tagName = tag; this._t = text; this.childNodes = []; this.parentNode = null; this.className = ''; }
  get textContent() { return this.nodeType === 3 ? this._t : this.childNodes.map(c => c.textContent).join(''); }
  set textContent(v) { if (this.nodeType === 3) this._t = v; else { this.childNodes = []; this.append(v); } }
  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  append(...ns) { ns.forEach(n => { if (typeof n === 'string') n = new N(3, null, n); if (n.nodeType === 11) { n.childNodes.slice().forEach(c => this.append(c)); return; } n.parentNode = this; this.childNodes.push(n); }); }
  replaceWith(f) { const p = this.parentNode, i = p.childNodes.indexOf(this), kids = f.nodeType === 11 ? f.childNodes : [f]; kids.forEach(k => { k.parentNode = p; }); p.childNodes.splice(i, 1, ...kids); }
  closest(sel) {
    const parts = sel.split(',').map(s => s.trim());
    for (let e = this; e; e = e.parentElement) if (e.nodeType === 1 && parts.some(s => s[0] === '.' ? e.className.split(' ').includes(s.slice(1)) : e.tagName === s.toUpperCase())) return e;
    return null;
  }
}
const el = (tag, kids, cls) => { const e = new N(1, tag.toUpperCase()); if (cls) e.className = cls; kids.forEach(k => e.append(k)); return e; };
const ser = n => n.nodeType === 3 ? n.textContent : `<${n.tagName.toLowerCase()}${n.className ? ` class="${n.className}"` : ''}>${n.childNodes.map(ser).join('')}</${n.tagName.toLowerCase()}>`;
const domCtx = () => vm.createContext({
  NodeFilter: { SHOW_TEXT: 4 },
  document: {
    createTreeWalker(r) { const list = []; (function walk(n) { n.childNodes.forEach(c => { if (c.nodeType === 3) list.push(c); else walk(c); }); })(r); let i = -1; return { get currentNode() { return list[i]; }, nextNode() { i++; return i < list.length ? list[i] : null; } }; },
    createDocumentFragment: () => new N(11), createElement: t => new N(1, t.toUpperCase()),
  },
});

test('bulles : chaque mot de la légende dans un span en ligne, coupé aux espaces ordinaires ; le gras, le code et les espaces insécables respectés', () => {
  for (const [nom, src] of [['core.js', core], ['where.html', where]]) {
    const ctx = domCtx();
    vm.runInContext(cut(src, 'function capWords(p){', '\n}\n') + '\n}\nthis.capWords = capWords;', ctx);
    const p = el('p', ['Chaque ligne est une ', el('b', ['commande :']), ' le client, réussis 4 exercices ', el('code', ['WHERE x = 1']), ' ', el('span', ['tableau de bord'], 'nw')]);
    ctx.capWords(p);
    assert.equal(ser(p), '<p><span class="w">Chaque</span> <span class="w">ligne</span> <span class="w">est</span> <span class="w">une</span> '
      + '<b><span class="w">commande :</span></b> <span class="w">le</span> <span class="w">client,</span> <span class="w">réussis</span> '
      + '<span class="w">4 exercices</span> <code>WHERE x = 1</code> <span class="nw"><span class="w">tableau de bord</span></span></p>', nom);
  }
  /* Le moteur commun : les mots dans la légende, puis la mascotte ; la page WHERE (son propre moteur) en a une copie */
  assert.ok(cut(core, 'function buildChrome(chapters, captions){', 'function capWords(p){').includes("capWords(d.firstChild);\n    cap.append(d);") && core.includes("stk.className = 'cap-stk';"));
  assert.ok(where.includes("capWords(d.firstChild);\n    cap.append(d);") && where.includes("stk.className = 'cap-stk';") && where.includes("$('#cap').insertBefore(d, $('#cap .cap-stk'));"), 'WHERE et ses « À toi ! »');
});

test('bulles : les mots arrivent l’un après l’autre, le gras passe au surligneur, la mascotte saute à chaque phrase ; rien ne s’arrête en plein mouvement', () => {
  const tlj = cut(core, 'function chromeTimeline(chapters, captions, duration){', '/* Animations des bulles');
  for (const part of [
    "tl.to(stk, {scale: 1, rotation: -8, duration: 0.62, ease: 'back.out(2.2)'}, captions[0][0] - 0.05); capKeep([stk, {scale: 1, rotation: -8}]);",
    "const ws = el.querySelectorAll('.w, code, .ic');",
    "tl.fromTo(ws, {opacity: 0}, {opacity: 1, duration: 0.26, stagger: Math.min(0.022, 0.5 / ws.length), ease: 'power1.out'}, a + 0.03); capKeep([ws, {opacity: 1}]);",
    "tl.fromTo(bs, {backgroundSize: '0% 100%'}, {backgroundSize: '100% 100%', duration: 0.5, stagger: 0.14, ease: 'power2.inOut'}, a + 0.34); capKeep([bs, {backgroundSize: '100% 100%'}]);",
    "if (i && stk) { tl.to(stk, {keyframes: [{y: -14, rotation: -15, duration: 0.15, ease: 'power2.out'}",
    "if (i) { tl.to(capCard, {keyframes: [{scaleY: 0.985, scaleX: 1.006, duration: 0.09, ease: 'power2.out'}"])
    assert.ok(tlj.includes(part), part);
  assert.ok(core.includes('capFxPrune(HOLDS.filter(h => h[1] > 0).map(h => h[0]).concat(picks.concat(opens).map(p => p.at)), CUTS);'), 'élagué une fois les pauses connues');
  assert.ok(core.indexOf('capFxPrune(HOLDS') < core.indexOf('clashes: holdClashes('), '… avant le contrôle des pauses');
  assert.ok(where.includes('function capFx(el, a, hop){') && where.includes('capFxPrune(HOLDS.filter(h => h[1] > 0).map(h => h[0]).concat(MP.picks.map(p => p.at)), HOLDS.filter(h => h[1] < 0).map(([t, d]) => [t - d, -d]));'));

  /* capKeep garde l’animation qu’on vient d’ajouter (tl.to rend la timeline) ; capFxPrune retire celles qu’une pause, un moment ou une
     coupe arrêterait en plein mouvement, et pose leur état final */
  const sets = [];
  const tw = (a, d) => ({ a, d, killed: false, startTime() { return this.a; }, totalDuration() { return this.d; }, kill() { this.killed = true; } });
  let last = null;
  const ctx = vm.createContext({ tl: { recent: () => last }, gsap: { set: (t, v) => sets.push([t, v]) } });
  vm.runInContext(cut(core, 'let CAP_FX = [];', '/* ---------- Scènes communes ---------- */') + ';this.keep=capKeep;this.prune=capFxPrune;this.fx=()=>CAP_FX;', ctx);
  const t1 = tw(10, 0.66), t2 = tw(20, 0.8), t3 = tw(30, 0.5), t4 = tw(40, 0.5), t5 = tw(50, 0.5);
  last = t1; ctx.keep(); last = t2; ctx.keep(['mots', { opacity: 1 }]); last = t3; ctx.keep(); last = t4; ctx.keep(); last = t5; ctx.keep();
  ctx.prune([10.5, 20.2, 31], [[40.6, -1], [49, -0.5]]);
  assert.deepEqual([t1, t2, t3, t4, t5].map(t => t.killed), [true, true, false, false, false], 'pause pendant le bond, pendant l’arrivée des mots ; une pause après ne gêne pas');
  assert.equal(JSON.stringify(sets), '[["mots",{"opacity":1}]]', 'les mots retirés s’affichent d’un coup');
  ctx.prune([], [[40.3, -1]]);
  assert.ok(t4.killed && !t5.killed, 'un passage coupé qui commence pendant l’animation');
  assert.equal(ctx.fx().length, 2);
});

test('bulles : la mascotte en autocollant rond sous le coin gauche, une pointe de BD, le surligneur jaune ; jamais sur le texte', () => {
  const b = cut(coreCss, '/* ---------- Bulles : la mascotte parle ----------', '\n#cap .c b{') + '\n';
  const stk = b.match(/#cap \.cap-stk\{([^}]*)\}/)[1];
  for (const part of ['position:absolute;', 'left:-49px;bottom:-118px;width:150px;height:150px;', 'border-radius:50%;', 'background:url(mascotte.webp) -6px 12px/146px auto no-repeat,radial-gradient(circle at 50% 34%,#FFE08A,#FFC83D 72%);',
    'border:8px solid #fff;', 'box-shadow:0 9px 0 var(--rebord)'])
    assert.ok(stk.includes(part), part);
  /* L’autocollant n’entre dans la carte que de (hauteur − débord) px : moins que la marge sous la dernière ligne (carte de 262 px,
     trois lignes de 44 × 1,32 : 44 px de marge), même à quatre lignes (la carte grandit vers le haut, son bas ne bouge pas) */
  const h = +stk.match(/height:(\d+)px/)[1], bas = -stk.match(/bottom:(-\d+)px/)[1];
  assert.ok(h - bas <= 44 - 12, `l’autocollant monte de ${h - bas} px dans la carte`);
  assert.ok(Math.round((262 - 3 * 44 * 1.32) / 2) === 44);
  assert.match(b, /#cap::after\{content:"";position:absolute;left:86px;bottom:-49px;width:78px;height:52px;pointer-events:none;/, 'la pointe');
  assert.ok(coreCss.includes('#cap .c b{background:linear-gradient(transparent 58%,rgba(255,200,61,.62) 58%,rgba(255,200,61,.62) 90%,transparent 90%) 0 0/0% 100% no-repeat}'), 'le surligneur, replié au départ');
  /* La page WHERE a sa propre feuille : la même bulle */
  const w = cut(where, '/* ---------- Bulles : la mascotte parle (copie de core.css) ----------', '\n#cap .c b{');
  assert.equal(w.replace(' (copie de core.css)', ''), b.slice(0, -1));
  /* Toujours cachée pendant un moment « À toi » (la feuille de réponse prend sa place) */
  assert.ok(coreCss.includes('body.lv-pk-open #cap{visibility:hidden!important}'));
});

test('le bouton du bas d’un cours à valider : violet à rebord, cible en autocollant, pastilles des moments, ▶ jaune ; ses mots ne changent pas', () => {
  /* L’autocollant « cible » : une fléchette plantée au centre */
  const ctx = vm.createContext({});
  vm.runInContext(cut(app, 'function lqStkSvg(k){', '\n}\n') + '\n}\nthis.stk=lqStkSvg;', ctx);
  const svg = ctx.stk('target');
  assert.ok(svg.startsWith('<svg class="lq-stk" viewBox="0 0 48 48" aria-hidden="true">') && svg.includes('<circle cx="21" cy="27" r="16" fill="#FF6B6B"') && svg.includes('fill="#6A4DF4"'));
  /* Les pastilles : menthe = réussi du premier coup, corail = réussi après une erreur, vide = à faire ; seulement pour la règle « N sur M » */
  const ans = { 3: { p0: { first: 1 }, p1: { first: 0 }, p3: { first: 1 } } };
  const g = vm.createContext({
    lvSeuil: l => (l && l.video && l.video.seuil) || 0, lvErreursMax: l => (l.video.erreurs != null ? l.video.erreurs : null),
    lvPkGet: (id, i) => (ans[id] && ans[id]['p' + i]) || null, lqStkSvg: k => `<svg ${k}/>`,
  });
  vm.runInContext(cut(app, 'function lvGatePips(l){', 'function lessonVideoSlide(l){') + ';this.pips=lvGatePips;this.deco=lvGateDeco;', g);
  assert.equal(g.pips({ id: 3, video: { moments: 5, seuil: 4 } }), '<i class="ls-pips"><i class="ok"></i><i class="try"></i><i></i><i class="ok"></i><i></i></i>');
  assert.equal(g.pips({ id: 3, video: { moments: 5, erreurs: 2 } }), '', 'règle aux erreurs : pas de pastilles');
  assert.equal(g.deco(null), '<i class="ls-gate-x" aria-hidden="true"><i class="ls-gate-stk"><svg target/></i></i>');
  /* Le décor suit le texte du bouton (aria-hidden) : l’annonce reste la règle, mot pour mot */
  const slide = cut(app, 'function lessonVideoSlide(l){', 'function openLessonVideo(fin){');
  assert.ok(slide.includes("'Termine la vidéo pour valider la leçon'}${lvGateDeco(l)}</button>`)") && slide.includes('>Termine la vidéo pour continuer${lvGateDeco(null)}</button>`'));
  assert.ok(cut(app, 'function lvCardSync(id){', 'function lvCardFit(){').includes("const pp=document.querySelector('#lesson-body .ls-next[data-jc-gate] .ls-pips'); if(pp)pp.outerHTML=lvGatePips(current);"), 'la vidéo refermée, les pastilles se mettent à jour');
  /* Le style */
  const s = cut(lq, '/* Le bouton du bas d’un cours pas encore validé (Elisa, 30 octobre, 23 h 42', '/* L’écran de chargement');
  for (const part of [
    'background:linear-gradient(165deg,#7B5CFF 0%,#6146F2 55%,#5536E4 100%)!important;color:#fff!important;', 'box-shadow:0 4px 0 var(--accent-lip),inset 0 1px 0 rgba(255,255,255,.18)!important;',
    ':has(br)::first-line{color:var(--sun-hi);', '::before{content:none!important}', "fill='%231B1640'", 'radial-gradient(circle at 50% 35%,#FFE08A,#FFC83D 70%);',
    '.ls-gate-stk{position:absolute;left:-7px;top:50%;width:52px;height:52px;', '.ls-pips{position:absolute;right:54px;top:13px;display:flex;gap:3.5px}',
    '.ls-pips i.ok{background:var(--mint);', '.ls-pips i.try{background:#FFB4A8;',
    ':active{transform:translateY(4px)!important;box-shadow:0 0 0 var(--accent-lip)', ':active .ls-gate-stk{animation:lqGateHit', '.is-go::after{animation:lqGateGo', ':hover{translate:0 -2px;'])
    assert.ok(s.includes(part), part);
  assert.ok(!s.includes('content:"↑"'), 'plus de flèche ↑');
  assert.match(lq, /@media \(prefers-reduced-motion:reduce\)\{\s*html\.lq #lesson-body \.ls-nav \.ls-next\[data-jc-gate\]::after,html\.lq #lesson-body \.ls-nav \.ls-next\[data-jc-gate\] \.ls-gate-stk,/, 'mouvement réduit');
});

test('les barres de défilement dans la DA, là où le système les montre en permanence ; plus de rond qui suit la souris', () => {
  const lancer = (largeur) => {
    const ajoutes = [], cls = new Set(), ecoute = {};
    const div = { style: {}, get offsetWidth() { return 120; }, get clientWidth() { return 120 - largeur; }, remove() {} };
    const ctx = vm.createContext({
      window: { matchMedia: q => ({ matches: !/reduced/.test(q) }), addEventListener() {} },
      document: {
        documentElement: { style: { setProperty() {} }, classList: { add: c => cls.add(c), toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) }, getAttribute: () => null },
        head: { appendChild: n => ajoutes.push(n) }, body: { appendChild() {}, classList: { contains: () => false } },
        createElement: t => (t === 'div' ? div : { style: { setProperty() {} }, setAttribute() {} }), addEventListener: (t, f) => { ecoute[t] = f; },
      },
      encodeURIComponent, Image: function () {}, setTimeout() {}, Math, String,
    });
    ctx.window.CSS = { supports: () => false }; ctx.CSS = ctx.window.CSS;
    vm.runInContext(cur, ctx);
    return { css: ajoutes[0].textContent, cls };
  };
  const classique = lancer(15), auto = lancer(0);
  assert.ok(classique.cls.has('rq-sb') && !auto.cls.has('rq-sb'), 'barres permanentes : html.rq-sb ; barres qui s’effacent : rien');
  const css = classique.css;
  for (const part of [
    '@media (hover:hover) and (pointer:fine){@supports selector(::-webkit-scrollbar){html.rq-sb::-webkit-scrollbar,html.rq-sb ::-webkit-scrollbar{width:12px;height:12px}',
    'html.rq-sb::-webkit-scrollbar-thumb,html.rq-sb ::-webkit-scrollbar-thumb{min-height:44px;min-width:44px;border:3.5px solid transparent;border-radius:99px;background:#CBC1F5;background-clip:padding-box}',
    '-thumb:hover{border-width:2.5px;background-color:#A797F0}', '-thumb:active{border-width:2.5px;background-color:#6A4DF4}',
    'html.rq-sb :is(.editor-shell,.esql,.nsql,.ncode,.ne-sql-shell,.ex-code,.qf-editor)::-webkit-scrollbar-thumb', '{background-color:rgba(255,255,255,.3)}',
    'html.rq-sb .screen{scrollbar-width:auto;scrollbar-color:auto}', '@supports not selector(::-webkit-scrollbar){html.rq-sb,html.rq-sb .screen{scrollbar-color:#CBC1F5 transparent}}'])
    assert.ok(css.includes(part), part);
  assert.ok(cur.includes("root.classList.toggle('rq-sb', d.offsetWidth - d.clientWidth > 0);"), 'mesure d’une boîte qui défile');
  /* Les barres masquées (rubans, puces) le restent : elles gardent scrollbar-width:none et ::-webkit-scrollbar{display:none} */
  assert.ok(app.includes('.db-bar::-webkit-scrollbar{display:none}') && !/scrollbar[^{]*\{[^}]*display:(?!none)/.test(css));
  /* Le rond qui suivait la souris est parti ; restent l’onde au clic et les étincelles à l’arrivée */
  assert.ok(!css.includes('.rq-halo') && !cur.includes("halo = document.createElement('div')") && css.includes('.rq-onde{') && css.includes('.rq-eclat{'));
});
