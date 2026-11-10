/* Elisa, 9 novembre, 8 h 20, en réponse à « Défi en solo : la carte des indices disparaît, avec l’encart rouge. Sous l’éditeur, tu as un
   encart vert « Défi résolu » » : « Non je veux que l’encart rouge se transforme en vert avec Bravo défi résolu …. En attente des autres
   ou qui passe a la manche suivante si autre manche avec résolu en 2 min etc ». Ce qui change :
   1. trouvé, la carte de l’indice reste à sa place, au-dessus de la requête ; son encart passe au vert (coachOkHTML), comme la boîte
      « Défi résolu » : « Bravo, défi résolu ! », « Résolu en 2 min 05 », la place entre amis, le premier coup, les points ; après un
      essai manqué, le vert part du rouge ;
   2. à plusieurs, dessous : « En attente des autres · @matime cherche encore… » et les réactions (« Clore la manche » s’en va à 8 h 42) ;
   3. seul, la manche trouvée reste à l’écran le temps de la suite : « La manche suivante démarre dans 5 s », ou « Ton bilan arrive
      dans 5 s » à la dernière ; le chrono s’arrête, au vert ; on peut partir sans question (salle-defis.test.mjs : le déroulé) ;
   4. le défi seul ouvert depuis sa page : le même encart vert dans sa carte ; sous l’éditeur, le résultat et la suite. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => cut(`function ${name}(`, '\n}\n') + '\n}\n';
const line = name => cut(`function ${name}(`, '\n') + '\n';

test('l’encart vert : « Bravo, défi résolu ! », le détail, les points ; « Résolu en 4 s », « 1 min 05 », « 2 min »', () => {
  const ctx = vm.createContext({ JEU_ICO: { check: '<svg>✓</svg>' } });
  vm.runInContext(line('jeuDureeLisible') + fn('coachOkHTML'), ctx);
  /* 8 h 50 : les points à droite du titre, hors du texte */
  assert.equal(ctx.coachOkHTML({ det: 'Résolu en <b>4 s</b>', pts: '<strong class="jeu-done-pts coach-ok-pts">+225</strong>' }),
    '<div class="coach-ok"><span class="coach-ok-ico" aria-hidden="true"><svg>✓</svg></span><div class="coach-ok-tx"><b class="coach-ok-k">Bravo, défi résolu&nbsp;!</b><p>Résolu en <b>4 s</b></p></div><strong class="jeu-done-pts coach-ok-pts">+225</strong></div>');
  assert.ok(ctx.coachOkHTML({ ko: true, det: '' }).startsWith('<div class="coach-ok was-ko">'), 'après un essai manqué');
  assert.ok(!ctx.coachOkHTML({ det: '' }).includes('<p>'), 'sans détail, pas de paragraphe vide');
  /* 8 h 50 : le détail en morceaux qui ne se coupent pas, le « · » au bout du précédent */
  vm.runInContext(line('coachOkDetail'), ctx);
  assert.equal(ctx.coachOkDetail(['Résolu en <b>16 s</b>', '', '1er à trouver', 'du premier coup']), '<span class="coach-ok-d">Résolu en <b>16 s</b>\u00a0·</span> <span class="coach-ok-d">1er à trouver\u00a0·</span> <span class="coach-ok-d">du premier coup</span>');
  assert.deepEqual([0, 4200, 59999, 60000, 65000, 120000, 605000].map(ms => ctx.jeuDureeLisible(ms)),
    ['0 s', '4 s', '59 s', '1 min', '1 min 05', '2 min', '10 min 05']);
});

test('dans la salle : la carte trouvée est la carte de l’indice ; à plusieurs, « En attente des autres » ; seul, la suite', () => {
  const f = fn('jeuFoundHTML');
  assert.ok(f.includes('<section class="coach is-ok jeu-done" id="jeu-done" aria-label="Défi résolu" aria-live="polite">'));
  assert.ok(app.includes("${mine?jeuFoundHTML(r,J.me):rate?jeuRateHTML(r):editorBlock(false,'defi.sql',{jeu:1})}"), 'à la place de l’éditeur, où était la carte de l’indice (seul, finie au chrono : « Temps écoulé », 10 h 01)');
  assert.ok(fn('jeuWaitLine').includes('return `<i class="jeu-dot" aria-hidden="true"></i><span class="jeu-wl"><b class="jeu-wl-k">En attente des autres…</b><small>${who} ${wait.length>1?\'cherchent\':\'cherche\'} encore</small></span>`;'));
  const ctx = vm.createContext({ JEU: { me: 'a', players: { a: { name: 'Elisa' }, b: { name: '@matime' } }, rounds: [{ found: { a: 1000 } }] }, esc: s => s, jeuLive: () => ['a', 'b'] });
  vm.runInContext(fn('jeuWaitLine'), ctx);
  assert.equal(ctx.jeuWaitLine(0), '<i class="jeu-dot" aria-hidden="true"></i><span class="jeu-wl"><b class="jeu-wl-k">En attente des autres…</b><small>@matime cherche encore</small></span>', '« En attente des autres… », puis qui cherche encore, dessous (8 h 50)');
  /* Seul : la manche trouvée reste à l’écran le temps de la suite (jeuFinAuto, 5 s), jusqu’à la manche suivante ou jusqu’au bilan */
  const v = fn('jeuView');
  assert.ok(v.includes("if(fin&&jeuSoloLike(n)&&(n<J.nb-1||Date.now()<jeuFinAuto(n)))return'play'+n;"), 'trouvée ou finie au chrono (10 h 01) ; une partie d’une manche aussi, jusqu’à l’écran de fin (11 h 31)');
  assert.ok(v.indexOf("return'play'+n;") < v.indexOf("if(fin&&n>=J.nb-1&&jeuSoloLike(n)&&jeuIsHost())return'final';"), 'avant le bilan');
  assert.ok(app.includes('function jeuFige(n){const J=JEU,r=J&&n>=0?J.rounds[n]:null;return !!r&&r.found[J.me]!=null&&jeuSoloLike(n);}'));
  assert.ok(fn('jeuTick').includes("if(el&&n>=0&&(jeuFige(n)||(jeuSoloLike(n)&&jeuRoundDone(n))))jeuChronoPose(el,jeuChronoEtat(n));"), 'le chrono s’arrête, au vert');
  /* 10 h 37 : arrêté sur le temps mis (« 00:04 »), plus sur ce qui restait (« 09:56 ») */
  assert.ok(app.includes("const fige=jeuFige(n),took0=fige?r.found[J.me]:Date.now()-r.t1,dur0=jeuDureeMs(jeuNivManche(n));") && fn('jeuChronoEtat').includes("if(jeuFige(n)){const ms=r.found[J.me];return {k:'is-ok',t:jeuChrono(ms),l:`Résolu en ${jeuDureeLisible(ms)}`};}"), 'au temps trouvé');
  assert.ok(fn('jeuLeaveQuestion').includes("if(/^play/.test(v)&&typeof jeuFige==='function'&&(jeuFige(jeuCur())||(typeof jeuRoundDone==='function'&&jeuSoloLike(jeuCur())&&jeuRoundDone(jeuCur()))))return null;"), 'rien à perdre');
  /* À plusieurs, le dernier à trouver : l’encart vert un instant, puis les résultats de la manche */
  assert.ok(v.includes("if(fin&&!J.rounds[n].closed&&J.rounds[n].okAt&&Date.now()-J.rounds[n].okAt<JEU_OK_MS)return'play'+n;") && app.includes('const JEU_OK_MS=1800;'));
  assert.ok(app.includes("if(m.pid===J.me){J.played=true;if(!replay)r.okAt=Date.now();"), 'pas à la relecture de la salle (retour, rechargement)');
});

test('le défi seul ouvert depuis sa page : le même encart vert dans sa carte, puis le résultat et la suite sous l’éditeur', () => {
  const run = fn('runLesson');
  assert.ok(run.includes("{const hs=document.getElementById('hint-slot'),ms=defiChrono?Date.now()-defiChrono.t0:null,ko=!!(COACH&&COACH.c===current&&COACH.diag);"));
  assert.ok(run.includes("if(hs)hs.innerHTML=`<section class=\"coach is-ok\" aria-live=\"polite\">${coachOkHTML({ko,det:coachOkDetail([ms!=null?`Résolu en <b>${jeuDureeLisible(ms)}</b>`:'',exoFails?'':'du premier coup ✨'])})}</section>`;"));
  assert.ok(run.includes('COACH=null;}') && run.includes('setLessonOut(table+(nxtPlan!=null'), 'la carte ne se redessine plus par-dessus ; sous l’éditeur, le résultat et la suite');
  assert.ok(!run.includes('<b>Défi résolu</b>'), 'plus de boîte « Défi résolu » sous l’éditeur');
  assert.ok(fn('defiChronoStart').includes("if(document.querySelector('#hint-slot .coach.is-ok,#lesson-out .feedback.ok')){el.classList.add('is-ok');defiChronoStop();defiSesClear();return;}"), 'le chrono s’arrête toujours, au vert');
});

test('le style : l’encart vert comme la boîte « Défi résolu », le vert qui part du rouge, la suite sous un filet', () => {
  for (const k of [
    'html.lq .coach-ok{display:flex;align-items:flex-start;gap:12px;padding:12px 14px 13px 12px;border:2px solid #BFE6CF;border-radius:16px;background:var(--success-soft);',
    'html.lq .coach-ok .coach-ok-ico{flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:12px;background:var(--success-fill);color:#fff;',
    'html.lq .coach-ok .coach-ok-k{display:block;margin:3px 0 2px;color:var(--success);font:700 17px/1.2 var(--display)}',
    'html.lq .coach-ok.was-ko{animation:coachOkDuRouge .8s ease both}',
    '@keyframes coachOkDuRouge{0%,30%{background:var(--danger-soft);border-color:#F6C9CC;',
    'html.lq .coach.jeu-done{margin:4px 0 14px;padding:14px 16px 15px;border-radius:22px;box-shadow:0 5px 0 var(--lip);animation:none}',
    'html.lq .coach-ok-suite{margin:14px 0 0;padding-top:12px;border-top:2px dashed var(--line-2)}',
    'html.lq .coach-ok .coach-ok-pts{align-self:center;display:flex;flex-direction:column;align-items:flex-end;',
    'html.lq .coach-ok .coach-ok-bonus{display:inline-block;',
    'html.lq .coach-ok-barre::after{content:"";display:block;height:100%;border-radius:inherit;background:var(--accent);transform-origin:0 50%;transform:scaleX(var(--p0,0));animation:coachOkBarre var(--d,5s) linear forwards}',
    'html[data-motion="reduce"].lq .coach-ok-barre{display:none}',
    'html.lq .consigne.dq .dq-sec.is-garde{background:#E8F3FF}',
    'html.lq .coach-ok{display:grid;grid-template-columns:28px minmax(0,1fr) auto;', 'html.lq .coach-ok p{grid-column:2 / 4;grid-row:2}', 'html.lq .coach-ok .coach-ok-d{white-space:nowrap}', 'html.lq #jeu-waitline .jeu-wl{display:flex;flex-direction:column;gap:2px;min-width:0}',
    'html.lq #jeu-root .jeu-hud-box .jeu-timer.is-ok{',
    'html.lq .coach.jeu-done .jeu-done-wait{flex-wrap:wrap;row-gap:10px}',
    'html[data-motion="reduce"].lq .coach-ok,html[data-motion="reduce"].lq .coach-ok *{animation:none!important}',
  ]) assert.ok(lq.includes(k), k);
  assert.ok(lq.includes('html.lq .feedback.ok{background:var(--success-soft)!important;border-color:#BFE6CF!important;'), 'les couleurs de « Défi résolu »');
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=300">'));
  /* 8 h 50 (« Change de couleur pour le vert Garde, sinon ça fait trop ») : « Garde » au bleu ciel, plus en menthe */
  assert.ok(!lq.includes('html.lq .consigne.dq .dq-sec.is-garde{background:#E5FAEF}') && lq.includes("background:#9CD7FF url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 12.5l4 4 8-9' fill='none' stroke='%23134E7C'"));
});
