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
  assert.ok(r.includes("${mine?jeuFoundHTML(r,J.me):rate?jeuRateHTML(r):editorBlock(false,'defi.sql',{jeu:1})}"));
  assert.ok(r.includes("${sl?`<section class=\"jeu-direct is-seul\" aria-label=\"${J.nb===1?jeuMancheNom(n,sl):`Manche ${n+1} sur ${J.nb}`}\"><div class=\"jeu-direct-bande\">${hud}</div></section>`:jeuDirectHTML(n,hud)}\n      ${defiConsigneHTML(c,{base:true,titre:true})}"), 'qui en est où : « En direct » sous le titre, avant la question, dès qu’on n’est pas seul (9 novembre, 7 h 16 ; avant, même seul, 17 h 08)');
  const play = r.slice(r.indexOf("}else if(v.startsWith('play')){"), r.indexOf("}else if(v.startsWith('res')){"));
  assert.ok(!play.includes('jeu-reacts') && !play.includes('jeuHostBarHTML') && !play.includes('jeuPlayersHTML'), 'pendant qu’on cherche : ni rangée de réactions, ni « Clore », ni liste de cadres');
  /* 8 novembre, 18 h 36 (« comment faire les réactions ? ») puis 19 h 37 : un seul bouton « Réagir », posé en bas à droite de l’écran,
     qui ouvre les quatre (reactions-direct.test.mjs) ; il n’est pas dans la manche */
  assert.ok(!play.includes('jeuReagirHTML') && r.includes('jeuReagirMaj();'), '« Réagir », un seul bouton, en bas à droite');
  for (const k of ['html.lq .ed-schema{flex:none;display:inline-flex;', 'html.lq #jeu-root .jeu-direct{position:relative;margin:14px 0 20px}', 'html.lq #jeu-root .jeu-direct-bande{position:relative;z-index:1;isolation:isolate;overflow:hidden;border-radius:22px;background:var(--deep);',
    'html.lq #jeu-root .jeu-direct-av{display:grid;', 'html.lq #jeu-root .jd-av-b.is-roi{'])
    assert.ok(s50.includes(k), k);
});

/* 9 novembre, 8 h 20 (Elisa) : « je veux que l’encart rouge se transforme en vert avec Bravo défi résolu…. En attente des autres ou qui
   passe à la manche suivante si autre manche, avec résolu en 2 min etc. » La carte « Trouvé en 00:04 » (médaille, carte blanche) devient
   la carte de l’indice, son encart passé au vert. */
test('trouvé : la carte de l’indice reste à la place de l’éditeur, son encart passe au vert, « Bravo, défi résolu ! » ; la requête repliée', () => {
  const f = cut('function jeuFoundHTML(r,pid){', '\nfunction jeuCountUp(el){');
  assert.ok(!f.includes('feedback ok') && !f.includes('Trouvé en') && !f.includes('JEU_OK_STK') && !app.includes('const JEU_OK_STK='), 'plus de carte blanche « Trouvé en », ni de médaille');
  assert.ok(f.includes('<section class="coach is-ok jeu-done" id="jeu-done" aria-label="Défi résolu" aria-live="polite">') && f.includes('${coachOkHTML({ko,det,pts})}'));
  assert.ok(f.includes("const det=coachOkDetail([`Résolu en <b>${jeuDureeLisible(x.ms)}</b>`,sl||pos<0?'':pos===0?'1er à trouver':`${pos+1}e à trouver`,x.essai?`du premier coup <span class=\"coach-ok-bonus\">+${x.essai}\\u00a0✨</span>`:'']);"), 'le temps, la place entre amis, le premier coup (le record, sur l’écran de fin : 11 h 31)');
  assert.ok(f.includes("const ko=typeof COACH!=='undefined'&&!!COACH&&COACH.kind==='room'&&COACH.round===n&&!!COACH.diag;"), 'après un essai manqué, le vert part du rouge');
  const suite = cut('function jeuSuiteHTML(n){', '\n}\n');
  assert.ok(f.includes("const suite=sl||(last&&jeuRoundDone(n))?jeuSuiteHTML(n)") && suite.includes('`<div class="coach-ok-suite"><p class="jeu-auto" id="jeu-auto">${reste?`<span>${last?\'Tes points arrivent\':\'La manche suivante démarre\'} dans <b id="jeu-auto-n">') && suite.includes('<i class="coach-ok-barre" aria-hidden="true" style="--d:${reste}ms;--p0:'), 'seul : la suite, son compte à rebours et sa barre (8 h 50)');
  assert.ok(f.includes('<div class="jeu-done-wait"><p id="jeu-waitline">${jeuWaitLine(n)}</p><div class="jeu-reacts" aria-label="Réagir">'), 'à plusieurs : qui cherche encore, et les réactions groupées');
  assert.ok(!f.includes('jeu-hostbar') && !f.includes('jeuHostBarHTML'), 'plus de « Clore la manche » pour l’hôte (9 novembre, 8 h 42)');
  /* 10 h 37 : « Voir ma requête et son résultat » ; 11 h 31 : la correction attend l’écran de fin, jamais sur le défi */
  /* 13 novembre, 20 h 33 (Elisa : « enlève Voir ma requête et son résultat ») : plus rien à déplier sur la carte */
  assert.ok(!f.includes('jeu-done-sql') && !f.includes('<summary>') && !f.slice(0, f.indexOf('\n}\n')).includes('jeuCorrBoutonHTML'));
  const run = cut('function jeuRun(){', '\nfunction jeuStop(){');
  assert.ok(!run.includes('r.mine') && run.includes('    r.sql=sql;'), 'la requête acceptée seulement pour la correction (13 novembre, 20 h 33)');
  assert.ok(run.includes("if(JEU===J&&J.view==='play'+n){J.keep=J.view;J.view='';jeuRender();}"), 'la manche se redessine aussitôt');
  assert.ok(!run.includes('setLessonOut(jeuFoundHTML'), 'plus de carte sous l’éditeur');
  for (const k of ['html.lq .jeu-done{margin:16px 0 0;padding:16px;border:2px solid var(--line);border-radius:24px;background:#fff;box-shadow:0 4px 0 var(--lip);',
    'html.lq .jeu-done .jeu-reacts{flex:none;display:flex;gap:0;margin:0;padding:3px;border-radius:999px;background:var(--surface-2)}', 'html.lq .jeu-mini{display:inline-flex;', 'html.lq #jeu-hostbar:empty{display:none}'])
    assert.ok(s50.includes(k), k);
  /* La ligne d’attente */
  const ctx = vm.createContext({ JEU: { me: 'a', players: { a: { name: 'Elisa' }, b: { name: 'Léa' }, c: { name: 'Tom' }, d: { name: 'Zoé' } }, rounds: [{ found: { a: 1000 } }] }, esc: s => s });
  vm.runInContext(cut('function jeuWaitLine(n){', '\nfunction jeuNetHTML(){'), ctx);
  ctx.jeuLive = () => ['a', 'b'];
  assert.match(vm.runInContext('jeuWaitLine(0)', ctx), /En attente des autres…<\/b><small>Léa cherche encore<\/small><\/span>$/);
  ctx.jeuLive = () => ['a', 'b', 'c', 'd'];
  assert.match(vm.runInContext('jeuWaitLine(0)', ctx), /<small>Léa, Tom \+1 cherchent encore<\/small><\/span>$/);
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
  assert.ok(app.includes("if(J.seulFin==null)J.seulFin=J.solo||sc.every(x=>x.pid===J.me);"), 'fin de partie seul : le bilan, pas le podium (décidé à l’arrivée, 12 h 36)');
  assert.ok(app.includes("salle:J.code,g:J.g});"), 'au classement : la partie est identifiée, les bonus sont calculés sur le serveur');
  /* 13 h 41 : seul, il peut lancer (« oui il peut lancer seul ») */
  assert.ok(app.includes("if(host&&live.length<2)return '';"), '20 h 12 : seul dans sa salle, plus de carte sous les joueurs');
});

test('résultats et fin de partie allégés ; les points de la partie ont leur page (11 novembre)', () => {
  const r = cut('function jeuRender(){', '\nfunction jeuNextRound(){');
  assert.ok(r.includes('<p class="jr2-pills">') && r.includes('<i class="is-essai">Du premier coup +${moi.essai}</i>'), 'le détail de mes points, en pastilles dans le cadre (15 h 48)');
  /* 1er novembre, 8 h 59 : plus jamais la requête ; le résultat attendu, replié quand on a trouvé */
  assert.ok(!r.includes('<summary class="jeu-card-h">Le résultat attendu</summary>') && r.includes('Tu pourras retenter ce défi plus tard.') && r.includes('const autoHTML=`<p class="jeu-auto jr2-auto" id="jeu-auto"') && !r.includes('highlight(c.sol)'), 'plus de résultat attendu sur les résultats de manche (16 h 04)');
  assert.ok(r.includes('}else if(!sl){') && !r.includes('<p class="jeu-card-h">Au total</p>') && r.includes('<i class="jr2-mv is-up"'), 'dès la 2e manche, un seul classement, au total, avec ▲ ▼ (16 h 04)');
  assert.ok(r.includes('const surPodium=new Set(top.flat().map(x=>x.pid)),liste=sc.some(x=>!surPodium.has(x.pid));'), 'la liste finale seulement si le podium ne dit pas tout');
  assert.ok(r.includes("const tie=sc.some((x,i)=>i>0&&x.pts>0&&x.pts===sc[i-1].pts)?"), 'le mot sur l’égalité seulement s’il y a égalité');
  for (const k of ['html.lq .jeu-pd i{padding:0!important;background:none!important;', 'html.lq .jeu-pd i:not(:last-child)::after{content:"·";', 'html.lq .jeu-rank li.is-me{', 'html.lq .jeu-sol>summary{display:flex;'])
    assert.ok(s50.includes(k), k);
  const pop = cut('function jeuPtsPage(o){', '\n/* Points de la partie (une seule fois)');
  assert.ok(pop.includes('<div class="mu mu-acc mu-pts${zero?\' is-zero\':\'\'}${enc?\' is-encourage\':\'\'}${issue?\' is-\'+issue:\'\'}" role="dialog" aria-modal="true" aria-labelledby="mu-h" aria-describedby="mu-p">'), 'une page, dans la DA de la fin d’un module');
});
