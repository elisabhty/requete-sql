/* Retours d’Elisa, 31 octobre, 16 h 29 (deux captures) : « il y a trop de boutons, il y a trop de trucs », « les cadres verts ne font
   pas assez clean, pareil pour la notif », « si personne ne rejoint la salle, alors c’est comme si on est seule », « réfléchis à
   l’UI/UX de ces écrans qui font trop tas ». Le comportement à plusieurs est vérifié dans salle-defis.test.mjs. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const s50 = css.slice(css.indexOf('/* ---------- 50. Retours du 31 octobre, 16 h 29'));
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };

test('pendant la manche, une seule action : « Exécuter » ; le schéma passe dans la barre de l’éditeur', () => {
  const ed = cut('const editorBlock=(withViz,fname=', '\nlet lessonStep=0;');
  const ctx = vm.createContext({ current: null, sqlCopyBtn: () => '<copy>', sqlClearBtn: () => '<clear>', RUN_ICO: '▶' });
  vm.runInContext(cut("const ED_SCHEMA_SVG='", '\nconst editorBlock=') + '\n' + ed.replace('const editorBlock=', 'var editorBlock='), ctx);
  const jeu = vm.runInContext("editorBlock(false,'defi.sql',{jeu:1})", ctx), cours = vm.runInContext("editorBlock(true)", ctx);
  assert.ok(jeu.includes('<button type="button" class="ed-schema" onclick="openSchemaSheet()" aria-label="Voir le schéma des tables">'));
  assert.ok(!/btn-ghost/.test(jeu), 'ni « Schéma » ni « Pas à pas » sous « Exécuter »');
  assert.equal((jeu.match(/<button/g) || []).length, 2, 'la pastille du schéma et « Exécuter »');
  assert.ok(cours.includes('>Schéma</button>') && cours.includes('>Pas à pas</button>') && !cours.includes('ed-schema'), 'les cours ne changent pas');
  const r = cut('function jeuRender(){', '\nfunction jeuNextRound(){');
  assert.ok(r.includes("${mine?jeuFoundHTML(r,J.me):editorBlock(false,'defi.sql',{jeu:1})}"));
  assert.ok(r.includes("<h1>${esc(c.titre)}</h1>\n      ${J.solo?`<section class=\"jeu-direct is-seul\" aria-label=\"Manche ${n+1} sur ${J.nb}\"><div class=\"jeu-direct-bande\">${hud}</div></section>`:jeuDirectHTML(n,hud)}\n      ${defiConsigneHTML(c,{base:true})}"), 'qui en est où : « En direct » sous le titre, avant la question, dans toute salle, même seul (8 novembre, 17 h 08)');
  const play = r.slice(r.indexOf("}else if(v.startsWith('play')){"), r.indexOf("}else if(v.startsWith('res')){"));
  assert.ok(!play.includes('jeu-reacts') && !play.includes('jeuHostBarHTML') && !play.includes('jeuPlayersHTML'), 'pendant qu’on cherche : ni rangée de réactions, ni « Clore », ni liste de cadres');
  /* 8 novembre, 18 h 36 (« comment faire les réactions ? ») puis 19 h 37 : un seul bouton « Réagir », posé en bas à droite de l’écran,
     qui ouvre les quatre (reactions-direct.test.mjs) ; il n’est pas dans la manche */
  assert.ok(!play.includes('jeuReagirHTML') && r.includes('jeuReagirMaj();'), '« Réagir », un seul bouton, en bas à droite');
  for (const k of ['html.lq .ed-schema{flex:none;display:inline-flex;', 'html.lq #jeu-root .jeu-direct{position:relative;margin:14px 0 20px}', 'html.lq #jeu-root .jeu-direct-bande{position:relative;z-index:1;isolation:isolate;overflow:hidden;border-radius:22px;background:var(--deep);',
    'html.lq #jeu-root .jeu-direct-av{display:flex;', 'html.lq #jeu-root .jd-av-b.is-roi{'])
    assert.ok(s50.includes(k), k);
});

test('trouvé : une carte blanche à la place de l’éditeur (plus le grand cadre vert), la requête repliée', () => {
  const f = cut('function jeuFoundHTML(r,pid){', '\nfunction jeuCountUp(el){');
  assert.ok(!f.includes('feedback ok'), 'plus de cadre vert');
  assert.ok(f.includes('<section class="jeu-done" id="jeu-done" aria-label="Trouvé">'));
  assert.ok(f.includes("const stk=!sl&&pos>=0&&pos<3?lqStkSvg('medal'+(pos+1)):JEU_OK_STK;"), 'la médaille de sa place, ou la coche');
  assert.ok(f.includes('<div class="jeu-done-wait"><p id="jeu-waitline">${jeuWaitLine(n)}</p><div class="jeu-reacts" aria-label="Réagir">'), 'qui cherche encore, et les réactions groupées');
  assert.ok(f.includes('<div id="jeu-hostbar">${jeuHostBarHTML()}</div>'));
  assert.ok(f.includes('<details class="jeu-done-sql"><summary>Ta requête et son résultat</summary>${r.mine}</details>'));
  const run = cut('function jeuRun(){', '\nfunction jeuStop(){');
  assert.ok(run.includes('r.mine=`<div class="ex-code">${highlight(sql)}</div>${renderTable(userRes,ms)}`;'));
  assert.ok(run.includes("if(JEU===J&&J.view==='play'+n){J.keep=J.view;J.view='';jeuRender();}"), 'la manche se redessine aussitôt');
  assert.ok(!run.includes('setLessonOut(jeuFoundHTML'), 'plus de carte sous l’éditeur');
  for (const k of ['html.lq .jeu-done{margin:16px 0 0;padding:16px;border:2px solid var(--line);border-radius:24px;background:#fff;box-shadow:0 4px 0 var(--lip);',
    'html.lq .jeu-done .jeu-reacts{flex:none;display:flex;gap:0;margin:0;padding:3px;border-radius:999px;background:var(--surface-2)}', 'html.lq .jeu-mini{display:inline-flex;', 'html.lq #jeu-hostbar:empty{display:none}'])
    assert.ok(s50.includes(k), k);
  /* La ligne d’attente */
  const ctx = vm.createContext({ JEU: { me: 'a', players: { a: { name: 'Elisa' }, b: { name: 'Léa' }, c: { name: 'Tom' }, d: { name: 'Zoé' } }, rounds: [{ found: { a: 1000 } }] }, esc: s => s });
  vm.runInContext(cut('function jeuWaitLine(n){', '\nfunction jeuNetHTML(){'), ctx);
  ctx.jeuLive = () => ['a', 'b'];
  assert.match(vm.runInContext('jeuWaitLine(0)', ctx), /Léa cherche encore…$/);
  ctx.jeuLive = () => ['a', 'b', 'c', 'd'];
  assert.match(vm.runInContext('jeuWaitLine(0)', ctx), /Léa, Tom \+1 cherchent encore…$/);
  ctx.JEU.rounds[0].found = { a: 1, b: 2, c: 3, d: 4 };
  assert.match(vm.runInContext('jeuWaitLine(0)', ctx), /Tout le monde a trouvé/);
});

test('seul dans la salle : comme seul (ni bande, ni réactions, ni « Clore », ni annonce), sans bonus de rang', () => {
  const sl = cut('function jeuSoloLike(n){', '\nfunction jeuRoomEmpty(){');
  assert.ok(sl.includes('return jeuLive().length<2&&(!r||Object.keys(r.found).every(p=>p===J.me));'));
  /* 6 novembre, 15 h 20 : le défi choisi exprès le dit (imp), le serveur tire les autres (retours-1520-pratiquer) */
  assert.ok(app.includes("jeuSend({t:'round',n,cid:J.plan[n]||jeuPick(),imp:impose?1:0,one:jeuLive().length<2?1:0});"), 'la manche dit si elle commence seule, le même drapeau chez tous');
  /* 5 novembre, 9 h 18 : entre amis, le +25 du premier coup ne va qu’au premier à trouver ; seul, comme avant. */
  assert.ok(app.includes('const seul=J.solo||r.one||actifs.size<2,k=jeuNivManche(n);') && app.includes('Object.assign({pid,ms,place:i+1,k},jeuPts(ms,i,seul,!!(r.first&&r.first[pid])&&(seul||i===0),k))'));
  assert.ok(app.includes("if(jeuSoloLike(n)!==J.slShown){J.keep=v;J.view='';jeuPaint();return;}"), 'quelqu’un arrive ou part : la manche se redessine (la requête tapée reste)');
  assert.ok(!app.includes('Tu es seul·e dans la salle'), 'plus d’annonce « seul·e dans la salle »');
  assert.ok(app.includes("const seul=J.solo||sc.every(x=>x.pid===J.me);"), 'fin de partie seul : le bilan, pas le podium');
  assert.ok(app.includes("salle:J.code,g:J.g});"), 'au classement : la partie est identifiée, les bonus sont calculés sur le serveur');
  assert.ok(app.includes("`${JEU.pub?'Ta salle est visible par les autres joueurs.':'Personne n’a encore rejoint : partage le code.'} Si tu lances maintenant, tu joues ${typeof accord==='function'?accord('seule','seul','seul·e'):'seul·e'}.`"));
});

test('résultats et fin de partie allégés ; la notification des points en une pastille', () => {
  const r = cut('function jeuRender(){', '\nfunction jeuNextRound(){');
  assert.ok(r.includes("${x.pid===J.me?jeuPtsDetail(x):''}"), 'le détail des points sur sa seule ligne');
  /* 1er novembre, 8 h 59 : plus jamais la requête ; le résultat attendu, replié quand on a trouvé */
  assert.ok(r.includes('${got?`<details class="jeu-card jeu-sol"><summary class="jeu-card-h">Le résultat attendu</summary>') && r.includes('Tu pourras retenter ce défi plus tard.') && r.includes('const autoHTML=`<p class="jeu-auto" id="jeu-auto">') && !r.includes('highlight(c.sol)'), 'le résultat attendu replié quand on a trouvé');
  assert.ok(r.includes("${sl||n<1?'':`<div class=\"jeu-card\"><p class=\"jeu-card-h\">Scores</p>"), 'les scores cumulés à partir de la 2e manche');
  assert.ok(r.includes('const surPodium=new Set(top.flat().map(x=>x.pid)),liste=sc.some(x=>!surPodium.has(x.pid));'), 'la liste finale seulement si le podium ne dit pas tout');
  assert.ok(r.includes("const tie=sc.some((x,i)=>i>0&&x.pts>0&&x.pts===sc[i-1].pts)?"), 'le mot sur l’égalité seulement s’il y a égalité');
  for (const k of ['html.lq .jeu-pd i{padding:0!important;background:none!important;', 'html.lq .jeu-pd i+i::before{content:"·";', 'html.lq .jeu-rank li.is-me{', 'html.lq .jeu-sol>summary{display:flex;'])
    assert.ok(s50.includes(k), k);
  const pop = cut('function jeuPtsPop(o){', '\n/* Points de la partie (une seule fois)');
  assert.ok(pop.includes('t.innerHTML=`<span class="jpp-coin">${JEU_COIN_SVG}</span><b><em class="jpp-n" data-n="${o.pts}">+${still?o.pts:0}</em> point${o.pts>1?\'s\':\'\'}</b>'));
  assert.ok(css.includes('#jeu-pts-pop{position:fixed;left:50%;top:calc(var(--safe-top,0px) + 12px);z-index:9991;display:flex;align-items:center;gap:9px;\n  height:48px;'), 'une pastille de 48 px');
});
