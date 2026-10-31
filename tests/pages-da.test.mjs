/* Elisa, 31 octobre, 2 h 18 : « améliorer les pages Stickers, Selon le SGBD, Carte mémo avec la DA du site (stickers, animation,
   micro-interactions, responsivité), notamment les pages de chaque onglet de l’appli : Accueil, Planning, Pratiquer, Bibliothèque,
   Compte ; laisser la notif de flamme mais ajouter micro-interaction, animation ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
const s44 = css.slice(css.indexOf('/* ---------- 44. Les pages de l’appli dans la DA de la vitrine'));
const fn = name => { const a = app.indexOf(`function ${name}(`); assert.ok(a > 0, name); return app.slice(a, app.indexOf('\n}', a) + 2); };

test('de nouveaux autocollants, dans le même dessin que les autres (silhouette blanche, rebord peint, encre)', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fn('lqStkSvg'), ctx);
  for (const k of ['cal', 'book', 'cards', 'peel', 'term', 'user', 'route', 'bell', 'eye', 'shield', 'help', 'flame', 'clock', 'chart', 'rocket', 'export']) {
    const svg = ctx.lqStkSvg(k);
    assert.ok(svg.startsWith('<svg class="lq-stk" viewBox="0 0 48 48" aria-hidden="true">'), k);
    assert.ok(svg.includes('opacity=".28" transform="translate(0 2.6)"') && svg.includes('<g fill="#fff" stroke="#fff" stroke-width="7"'), `${k} : rebord et contour blanc`);
    assert.ok(svg.includes('#1B1640'), `${k} : à l’encre`);
    assert.ok(!/filter|drop-shadow/.test(svg), `${k} : sans filtre (net sur iPhone)`);
  }
  assert.equal(ctx.lqStkSvg('inconnu'), '');
});

test('le haut des pages : rubrique au tiret, titre souligné en jaune, autocollant qui se colle à chaque arrivée (et saute au toucher)', () => {
  assert.ok(app.includes("const LQ_HEAD_STK={'scr-planning':'cal','scr-practice':'rocket','scr-library':'book','scr-compte':'user','scr-stickers':'peel','scr-sgbd':'db','scr-collection':'cards','scr-notes':'note','scr-entretien':'mic'};"));
  const heads = fn('lqHeads');
  assert.ok(heads.includes("head.classList.add('lq-head');") && heads.includes("u.className='lq-tu';u.textContent=h1.textContent;") && heads.includes('head.insertBefore(st,head.firstChild);'));
  assert.ok(app.includes("  }catch(e){ bootFatal(); return; }\n  try{lqHeads();}catch(e){}"), 'posé au démarrage');
  assert.ok(app.includes("if(h1&&h1.textContent!=='Planning') h1.textContent='Planning';"), 'le planning ne retire plus le trait jaune à chaque rendu');
  assert.ok(app.includes('<div class="lgtitle account-title"><div><div class="eyebrow">Ton espace</div><h1>Mon compte</h1>'));
  assert.ok(fn('lqHeadPoke').includes("el.classList.remove('is-poke');void el.offsetWidth;el.classList.add('is-poke');") && fn('lqHeadPoke').includes('if(!el||prefersReduceMotion())return;'));
  for (const part of ['html.lq #app .lgtitle.lq-head{--hs:clamp(56px,17vw,74px);display:flow-root}', 'html.lq #app .lgtitle.lq-head>.lq-head-stk{float:right;',
    'html.lq #app .screen.active>.lgtitle.lq-head>.lq-head-stk>svg{animation:lqHeadIn .62s var(--pop) .1s backwards}', 'html.lq #app .lgtitle.lq-head .eyebrow{display:flex!important;',
    'html.lq #app .lgtitle.lq-head .eyebrow::before{content:"";flex:none;width:18px;height:3px;', 'html.lq #app .lgtitle.lq-head h1{font-size:clamp(28px,8.6vw,34px)}',
    'html.lq #app .lgtitle.lq-head h1 .lq-tu{background:url("data:image/svg+xml'])
    assert.ok(s44.includes(part), part);
});

test('Pratiquer et Bibliothèque : un autocollant par entrée, les entrées arrivent l’une après l’autre ; la carte du défi en scène violette', () => {
  assert.ok(app.includes("const JOURNEY_STK={defis:'target',console:'term',cards:'cards',stickers:'peel',notes:'note',interview:'mic',sgbd:'db',courses:'book'};"));
  const hub = fn('renderJourneyHub');
  assert.ok(hub.includes('style="--i:${i}"') && hub.includes("<span class=\"journey-tool-icon${JOURNEY_STK[kind]?' is-stk':''}\">${JOURNEY_STK[kind]?lqStkSvg(JOURNEY_STK[kind]):journeyIcon(kind)}</span>"));
  assert.equal((hub.match(/<span class="journey-spot-stk" aria-hidden="true">/g) || []).length, 3, 'prochain défi, tout réussi, à réviser');
  for (const part of ['html.lq #app .journey-resource .journey-tool-icon.is-stk svg{width:54px!important;height:54px!important;stroke:none!important;fill:none}',
    'html.lq #app .screen.active .journey-hub-list>.journey-resource{animation:lqHubIn', 'html.lq #app .screen.active .journey-resource-bar>i{transform-origin:left;animation:lqBarIn',
    'html.lq .journey-spotlight h2{color:var(--sun-hi)!important;', 'html.lq .journey-spotlight .journey-primary{background:var(--sun)!important;color:#1B1640!important;'])
    assert.ok(s44.includes(part), part);
});

test('Mon compte : les chiffres et chaque réglage portent leur autocollant ; la carte d’identité en scène violette', () => {
  assert.ok(app.includes("const ACCT_STK={account:'user',route:'route',bell:'bell',reading:'eye',privacy:'shield',help:'help'};"));
  const acct = app.slice(app.indexOf('function renderCompte(){'), app.indexOf('function openLegal('));
  assert.equal((acct.match(/<span class="plus-row-icon \w+ is-stk">\$\{lqStkSvg\(ACCT_STK\.\w+\)\}<\/span>/g) || []).length, 7);
  assert.ok(!acct.includes('${plusIcon(\'account\')}</span><span><b>Profil'), 'plus de pictogramme au trait dans les réglages');
  for (const k of ['flame', 'book', 'target']) assert.ok(acct.includes(`<span class="acct-stat-ico is-stk" aria-hidden="true">\${lqStkSvg('${k}')}</span>`), k);
  assert.ok(acct.includes("<span class=\"acct-data-ico is-stk\" aria-hidden=\"true\">${lqStkSvg('shield')}</span>"));
  for (const part of ['html.lq #scr-compte .plus-row-icon.is-stk svg,html.lq #scr-compte .acct-data-ico.is-stk svg{width:42px!important;height:42px!important;stroke:none!important;fill:none}',
    'html.lq #scr-compte .account-setting-row:active .plus-row-icon.is-stk{transform:scale(.88);rotate:-12deg}', 'html.lq .acct-hero{isolation:isolate;overflow:hidden;background:var(--deep)!important;',
    'html.lq .acct-hero .acct-level-track i{background:var(--sun)}'])
    assert.ok(css.includes(part), part);
});

test('Planning : les tuiles d’« Avancement global » et le prochain cap portent leur autocollant ; le prochain cap passe en scène violette', () => {
  assert.ok(app.includes('  brancherDrag();renderHomeToday();lqPlanStk();\n}'));
  const p = fn('lqPlanStk');
  assert.ok(p.includes("[['.pgr-stat.is-l','book'],['.pgr-stat.is-d','target'],['.pgr-stat.is-s','flame'],['.pgr-stat.is-t','clock'],['.pgr-chart','chart'],['.pgr-next','rocket']]"));
  assert.ok(p.includes("if(el.querySelector(':scope>.pgr-stk'))return;"), 'une seule fois par tuile');
  assert.ok(!fn('planOverviewHTML').includes('lqStkSvg'), 'le gabarit reste pur (testé ailleurs sans les autocollants)');
  for (const part of ['html.lq #scr-planning .pgr-stk{position:absolute!important;', 'html.lq #scr-planning .pgr-next>span:not(.pgr-stk){padding-right:58px}',
    'html.lq #scr-planning .pgr-next{isolation:isolate;overflow:hidden;', 'html.lq #scr-planning .pgr-next .pgr-go{background:var(--sun)!important;'])
    assert.ok(s44.includes(part), part);
});

test('Stickers : le tableau en scène violette, la zone qui respire tant qu’il est vide, « Nouveau » en étiquette jaune, la planche à son tour', () => {
  assert.ok(fn('renderStickers').includes("host.querySelectorAll('.stk-grid>li').forEach((li,i)=>li.style.setProperty('--i',i%15));"));
  for (const part of ['html.lq .stk-board{background:radial-gradient(', 'html.lq .stk-board.is-empty::after{content:"";position:absolute;inset:14px;border:2.5px dashed',
    'html.lq .stk-empty b{color:var(--sun-hi)}', 'html.lq .stk-new{background:var(--sun)!important;color:#1B1640!important;rotate:-7deg;',
    'html.lq #scr-stickers.active .stk-grid>li{animation:lqHubIn .42s var(--pop) backwards;'])
    assert.ok(s44.includes(part), part);
  /* Les stickers restent nets : la planche s’anime par ses cases (fill backwards : rien ne reste transformé au repos), jamais le canvas */
  assert.ok(!/stk-art>canvas\{[^}]*(transform|filter)/.test(s44));
});

test('Selon le SGBD : la barre des thèmes accrochée en haut allume le thème lu ; un thème choisi s’arrête juste sous elle ; les fiches se posent', () => {
  const live = fn('sgbdLive');
  assert.ok(live.includes("const spy=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)show(e.target.dataset.sg);}),{root:scroller,rootMargin:'-28% 0px -62% 0px'});"));
  assert.ok(live.includes("bar.classList.toggle('is-start',bar.scrollLeft<=2);") && live.includes("bar.classList.toggle('is-stuck',"));
  assert.ok(live.includes("if(prefersReduceMotion())return;\n  wrap.classList.add('lq-reveal');"), 'pas d’apparition en mouvement réduit');
  assert.ok(fn('renderSgbdScreen').includes("if(host)sgbdLive(host.querySelector('.sg-wrap'));") && fn('openSgbdSheet').includes('sgbdLive(body.firstElementChild);'));
  assert.ok(fn('sgbdJump').includes("const stuck=cs&&cs.position==='sticky'?(parseFloat(cs.top)||0)+bar.offsetHeight:0;") && fn('sgbdJump').includes('-12-stuck;'));
  assert.ok(app.includes("<div class=\"sg-intro\"><span class=\"sg-intro-stk\" aria-hidden=\"true\">${typeof lqStkSvg==='function'?lqStkSvg('info'):''}</span>"));
  for (const part of ['html.lq .sg-chips{position:sticky;top:calc(var(--safe-top) + 44px);z-index:20;background:var(--bg);', 'html.lq #sgbd-sheet-body .sg-chips{top:0}',
    'html.lq .sg-sec h2 span{display:grid;place-items:center;', 'html.lq .sg-who i{background:var(--sun)!important;color:#1B1640!important;',
    'html.lq .sg-wrap.lq-reveal .sg-need:not(.is-in){opacity:0;transform:translateY(16px) scale(.98)}', '@media (min-width:760px){\n  html.lq #scr-sgbd .sg-sec{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));'])
    assert.ok(s44.includes(part), part);
});

test('Cartes mémo et Accueil : les cartes arrivent à leur tour et se retournent d’un rien à l’appui ; « Tous les cours » en rubrique au tiret', () => {
  assert.ok(fn('renderCollection').includes("host.querySelectorAll('.coll-module').forEach(m=>m.querySelectorAll('.coll-card').forEach((c,i)=>c.style.setProperty('--i',Math.min(i,11))));"));
  for (const part of ['html.lq #scr-collection.active .coll-module[open] .coll-card{animation:lqHubIn', 'html.lq #scr-collection .coll-card:active{transform:perspective(600px) rotateY(-12deg) scale(.97)}',
    'html.lq .coll-overview-next button,html.lq .ent-hero .ent-hero-cta{background:var(--sun)!important;', 'html.lq #scr-learn .home-catalog-head>div>span{display:flex;',
    'html.lq #scr-learn .home-catalog-head h2{width:fit-content;', 'html.lq #scr-learn.active #modules>.home-module{animation:lqHubIn'])
    assert.ok(s44.includes(part), part);
  assert.ok(!s44.includes('.home-catalog-head span{'), 'le bouton « Chercher » ne prend pas le style de la rubrique');
});

test('la notification de flamme reste, et s’anime : chute balancée, anneau, étincelles, « +1 », le compteur qui monte', () => {
  const t = fn('lqStreakToast');
  assert.ok(t.includes('<i class="lq-st-ring"></i>${LQ_FLAME_SVG}${\'<i class="lq-st-sp"></i>\'.repeat(6)}<em class="lq-st-plus">+1</em>'));
  assert.ok(t.includes('<span class="lq-st-odo" aria-hidden="true"><span class="lq-st-new">${n}</span><span class="lq-st-old">${prev}</span></span><span class="acct-sr">${n}</span>'), 'le lecteur d’écran entend le bon nombre');
  assert.ok(t.includes('const prev=Math.max(0,n-1);') && t.includes('Flamme du jour allumée !'));
  for (const part of ['#lq-streak-toast.on{animation:lqStIn .7s var(--pop) both}', '#lq-streak-toast.on .lq-st-ring{animation:lqStRing', '#lq-streak-toast.on .lq-st-sp{animation:lqStSpark',
    '#lq-streak-toast.on .lq-st-plus{animation:lqStPlus', '#lq-streak-toast .lq-st-odo{position:relative;display:inline-block;-webkit-clip-path:inset(0 -6px);clip-path:inset(0 -6px)}',
    '#lq-streak-toast.on .lq-st-new{animation:lqStNew', '#lq-streak-toast .lq-st-old{position:absolute;left:0;top:0;opacity:0}'])
    assert.ok(s44.includes(part), part);
  for (const n of [2, 3, 4, 5, 6, 7]) assert.ok(s44.includes(`#lq-streak-toast .lq-st-sp:nth-of-type(${n}){--a:`), `étincelle ${n}`);
});

test('mouvement réduit : tout est à sa place d’emblée', () => {
  const rm = s44.slice(s44.indexOf('/* 44j.'));
  for (const sel of ['html.lq #app .lq-head-stk>svg', 'html.lq #app .journey-resource', 'html.lq #scr-planning .pgr-stk svg', 'html.lq .stk-board.is-empty::after', 'html.lq #scr-stickers .stk-grid>li',
    'html.lq #scr-collection .coll-card', 'html.lq #scr-learn #modules>.home-module', '#lq-streak-toast,#lq-streak-toast *'])
    assert.ok(rm.includes(sel), sel);
  assert.ok(rm.includes('html.lq .sg-wrap.lq-reveal .sg-need:not(.is-in){opacity:1;transform:none}'));
  assert.ok(rm.includes('html[data-motion="reduce"] #lq-streak-toast,html[data-motion="reduce"] #lq-streak-toast *{animation:none!important}'), 'le réglage de l’appli aussi');
});
