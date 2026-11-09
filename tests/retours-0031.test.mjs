/* Elisa, 9 novembre, 0 h 31 (sa capture de « Tu as accès au schéma — Tables, colonnes et liens de la base Salle de sport ») :
   « supprimer du coup et pour l’indice ne met pas un coup de patte à part en bas (notif en bas de page) et corrige ce qui doit être
   corrigé ou améliorer ». Ce qui change :
   1. la carte « Tu as accès au schéma » s’en va : « À toi de jouer ! Tu peux consulter le schéma… » (sa pastille « schéma ») et le
      bouton Schéma de l’éditeur l’ouvrent déjà ;
   2. plus de pastille « Un coup de patte ? · voir l’indice » en bas de l’écran : l’indice arrive dans sa carte, qui rebondit, et le
      téléphone vibre ;
   3. les mots de la relecture : « Mes adversaires » dans le Classement (l’onglet s’appelle Adversaires), « Créer ma partie » partout
      (Jouer, Adversaires, la feuille qu’il ouvre), « À plusieurs » face à « En solo » dans Mes stats ;
   4. « Comment sont calculés les points ? » ouvre le barème du niveau choisi dans Jouer, pas du dernier regardé ;
   5. une partie d’une manche, manquée : la carte « Temps écoulé » dit déjà 0 point ; plus de bandeau « 0 · 0/1 · — » dessous ;
   6. « Joue seul » s’accorde, comme « tu joues seule » de la salle d’attente.
   Vérifié dans un navigateur (390 × 844) puis dans le simulateur. */
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

/* ---------- 1. La carte « Tu as accès au schéma » ---------- */

function consigne() {
  const ctx = vm.createContext({
    esc: s => String(s).replace(/</g, '&lt;'), escCode: s => String(s).replace(/</g, '&lt;'), ED_SCHEMA_SVG: '<svg class="sch"/>',
    DEFI_BASES: { sport: { nom: 'Salle de sport' } }
  });
  vm.runInContext(cut('const DEFI_A_TOI=', '\nfunction defiConsigneHTML(c,o){') + '\n' + cut('function defiConsigneHTML(c,o){', '\n/* Les indices d’un défi raté'), ctx);
  return c => { ctx.c = c; return vm.runInContext('defiConsigneHTML(c,{base:true,titre:true})', ctx); };
}

test('la carte « Tu as accès au schéma » est supprimée ; le schéma s’ouvre par « À toi de jouer » et par l’éditeur', () => {
  const html = consigne();
  const neuf = html({ titre: 'Qui vient le plus ?', base: 'sport', situation: 'À la salle Énergie, Paul compte les passages. À toi de jouer !', affiche: ['`nom`'], garde: [], precis: [] });
  const ancien = html({ contexte: 'Un ancien défi, sans ses points.' });
  for (const h of [neuf, ancien]) {
    assert.ok(!h.includes('dq-schema') && !h.includes('Tu as accès au') && !h.includes('Tables, colonnes et'), 'plus de carte');
    assert.equal((h.match(/class="dq-lien" onclick="openSchemaSheet\(\)"/g) || []).length, 1, 'la pastille « schéma » d’« À toi de jouer » l’ouvre');
  }
  assert.ok(neuf.includes('<div class="dq-atoi"><b>À toi de jouer !</b> Tu peux consulter le <button type="button" class="dq-lien" onclick="openSchemaSheet()"><svg class="sch"/>schéma</button> de la base'));
  assert.ok(neuf.includes('<span class="dq-chip is-base">Base Salle de sport</span>'), 'la base reste en pastille sur le cadre');
  assert.ok(ancien.includes('<p class="defi-ctx">Un ancien défi, sans ses points.</p><div class="dq-atoi">'), 'un ancien défi : sa question, puis « À toi de jouer »');
  assert.ok(app.includes('class="ed-schema${schAttn()}" onclick="openSchemaSheet()"'), 'le bouton Schéma de l’éditeur reste');
  for (const k of ['.dq-schema', '.dq-ico', 'dqAnneau', 'dqBalance', 'dqPousse', 'dqPastille', 'dqSouligne']) assert.ok(!lq.includes(k), `le style de la carte s’en va : ${k}`);
  assert.ok(lq.includes('html.lq .consigne.dq .dq-lien{') && lq.includes('html.lq .consigne.dq .dq-atoi{'), 'la pastille et son cadre gardent leur style');
});

/* ---------- 2. L’indice, sans pastille en bas de l’écran ---------- */

test('l’indice arrive dans sa carte, qui rebondit, et le téléphone vibre ; plus de « Un coup de patte ? · voir l’indice » en bas', () => {
  const cls = new Set(), timers = [], buzz = [];
  let peek = 0;
  const card = { classList: { add: c => cls.add(c), remove: (...c) => c.forEach(x => cls.delete(x)) } };
  const slot = { innerHTML: '', querySelector: s => (s === '.coach' ? card : null) };
  const ctx = vm.createContext({
    document: { getElementById: id => (id === 'hint-slot' ? slot : null) }, current: 'c1', prefersReduceMotion: () => false,
    setTimeout: (f, ms) => timers.push(ms), defiIndicesHTML: () => '<section class="coach has-hint"></section>', coachNext: () => null,
    defiSesSave: () => {}, coachPeek: () => { peek++; }, buzz: k => buzz.push(k)
  });
  vm.runInContext('var COACH={c:"c1",n:0,view:0,diag:"",fx:"",kind:"solo",round:null};\n' + fn('coachPaint') + line('coachSet'), ctx);
  vm.runInContext('coachSet(1)', ctx);
  assert.equal(peek, 0, 'pas de pastille en bas de l’écran');
  assert.ok(cls.has('is-new-hint') && timers.includes(900), 'la carte rebondit');
  assert.deepEqual(buzz, ['light'], 'un petit retour du téléphone');
  assert.equal(vm.runInContext('COACH.fx', ctx), '');
  assert.ok(!app.includes('coachPeek(card,true)'), 'aucun appel ailleurs non plus');
});

/* ---------- 3. Les mots ---------- */

test('les mots : « Mes adversaires », « Créer ma partie », « À plusieurs »', () => {
  for (const k of ["${chip('amis','Mes adversaires')}", 'Aucun de tes adversaires n’est encore classé. Joue à plusieurs&nbsp;: invite des amis avec un code depuis l’onglet Adversaires.',
    "ou=DEFIS.portee==='amis'?'parmi tes adversaires':", "const ou=D.portee==='amis'?'parmi tes adversaires':",
    "onclick=\"defisCarte('creer')\">${DX_AJOUT_SVG}Créer ma partie</button>", ":friends?['Créer ma partie','Ta salle de défi',", '<span>Créer ma partie</span>',
    "${h.solo?'En solo':'À plusieurs'}", '<div class="perf-block perf-friends"><h3>À plusieurs</h3>', 'Ton prochain podium à plusieurs s’affichera ici.',
    "`Sur ${amis} ${plur(amis,'partie')} à plusieurs.`", '</i>les points de tes adversaires</span>', 'termine une partie, seul ou à plusieurs, pour ouvrir le classement.',
    'Il faut une connexion internet pour jouer à plusieurs.'])
    assert.ok(app.includes(k), k);
  for (const k of ["chip('amis','Mes amis')", 'Aucun de tes amis', 'parmi tes amis', 'Créer une partie</button>', "'Entre amis'", '<h3>Entre amis</h3>', 'podium entre amis s’affichera',
    'parties entre amis', 'les points de tes amis', 'seul ou entre amis, pour', 'pour jouer entre amis'])
    assert.ok(!app.includes(k), `plus : ${k}`);
});

/* ---------- 4. Le barème ---------- */

test('« Comment sont calculés les points ? » ouvre le barème du niveau choisi dans Jouer', () => {
  const vus = [];
  const ctx = vm.createContext({
    JEU_NIV_X: { f: 1, m: 2, d: 4 }, jeuNiv: 'f', document: { getElementById: () => null }, setTimeout: () => {}, prefersReduceMotion: () => true
  });
  const k = cut('  const k=JEU_NIV_X[defisReglesNiv]?', ';\n') + ';';
  ctx.defisOnglet = o => vus.push(o);
  ctx.renderDefisRules = () => vus.push(vm.runInContext(`(()=>{${k}return k;})()`, ctx));
  vm.runInContext(cut('let defisReglesNiv=', '\n') + '\n' + line('defisRulesNiv') + fn('defisStats'), ctx);
  vm.runInContext("defisRulesNiv('d')", ctx);
  assert.deepEqual(vus, ['d'], 'Difficile regardé dans le barème');
  vus.length = 0; vm.runInContext("jeuNiv='m';defisStats(true)", ctx);
  assert.deepEqual(vus, ['m', 'stats'], 'Moyen choisi dans Jouer : le barème est repeint au Moyen, puis Mes stats s’ouvre');
  vus.length = 0; vm.runInContext("defisRulesNiv('d');defisStats()", ctx);
  assert.deepEqual(vus, ['d', 'stats'], 'sans « Comment sont calculés… » : rien n’est repeint, le niveau regardé reste');
  assert.ok(app.includes('class="dx-points" onclick="defisStats(true)"'));
  /* Choisir un niveau dans Jouer : le barème le suit (Mes stats s’ouvre aussi par la carte du joueur) */
  assert.ok(fn('defisNiv').includes("  jeuNiv=k;jeuNivUser=true;jeuSavePrefs();\n  if(typeof defisReglesNiv!=='undefined'&&defisReglesNiv&&defisReglesNiv!==k&&typeof renderDefisRules==='function'){defisReglesNiv='';renderDefisRules();}"));
});

/* ---------- 5. Le bilan d’une partie d’une manche, manquée ---------- */

test('une manche manquée : l’écran de fin dit les points et le temps, « — » sans défi résolu ; plus de carte « 0 point obtenu » qui le redisait', () => {
  /* 9 novembre, 10 h 37 (la relecture) : le bandeau, toujours ; 11 h 31 : une partie d’une seule manche repasse par l’écran de fin,
     deux cases (les points, ton temps) ; la carte « Temps écoulé · 0 point obtenu · Non validée » de 0 h 31 s’en va */
  assert.ok(!app.includes('lastMiss') && app.includes('html=trophee+head(`Fin de la partie · ${JEU_NIVL[J.niv]}`,titre,sous)+progres+') && app.includes("        `${bande}\n"));
  assert.ok(app.includes("const bande=`<div class=\"jeu-bilan${J.record?' has-record':''}${un?' is-2':''}\">"), 'le bandeau, toujours le même ; deux cases pour une manche');
  assert.ok(app.includes("<div><b>${nOk?dur(got.reduce((a,x)=>a+x.ms,0)/nOk):'—'}</b><small>${un?'ton temps':'temps moyen'}</small></div></div>`;"), 'le temps, « — » sans défi résolu');
  assert.ok(fn('jeuMissHTML').includes('<div><b>0</b><small>Point obtenu</small></div><div><b>Non validée</b><small>Ta réponse</small></div>'), 'la carte dit déjà 0 point');
  /* Le compteur des points vise le bandeau : sans lui, il ne trouve rien et ne fait rien */
  assert.ok(app.includes("const b=document.querySelector('#jeu-root .jeu-bilan b[data-n]');if(b&&JEU===J)jeuCountUp(b);"));
});

/* ---------- 6. « Joue seul » ---------- */

test('« Joue seul » s’accorde : « Joue seule », « Joue seul », « Joue seul·e »', () => {
  const titre = genre => {
    const ctx = vm.createContext({
      JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' }, jeuNiv: 'd', jeuNb: 3, jeuVis: 'pub', jeuInvite: '', jeuNivUser: true, jeuMode: 'solo',
      jeuChallenges: () => [1, 2, 3], jeuNivAuto: () => 'f', accord: (f, h, n) => (genre === 'f' ? f : genre === 'h' ? h : n), DEF_CHEV_SVG: '', LQ_X_SVG: '',
      JEU_NOTE_HTML: '', lqStkSvg: k => `<svg data-stk="${k}"/>`, jeuNomField: () => '', jeuVisTexte: () => '', esc: s => String(s), DEFIS: { carte: '' },
      JEU_NIV_X: { f: 1, m: 2, d: 4 }, JEU_NIV_MANCHE: { f: 600000, m: 900000, d: 1200000 }, JEU_MAX: 6, document: { getElementById: () => null, querySelectorAll: () => [], body: null }
    });
    vm.runInContext(cut('const DX_CODE_MSG=', '\nfunction dxCodeEtat(') + '\n' + line('jeuNivBars') + fn('defisFeuilleHTML') + line('dxDureeMax') + line('jeuDureeMs'), ctx);
    const h = ctx.defisFeuilleHTML('seul');
    assert.ok(h.includes('<p class="room-kicker">Mode solo</p>') && h.includes('Relève des défis contre la montre.'));
    return (h.match(/<h2 id="dx-f-t">([^<]*)<\/h2>/) || [])[1];
  };
  assert.equal(titre('f'), 'Joue seule');
  assert.equal(titre('h'), 'Joue seul');
  assert.equal(titre(''), 'Joue seul·e');
});

/* ---------- 7. « Raté » (9 novembre, 2 h) ---------- */

/* Sa capture de la carte des indices après un essai : « Un coup de patte ? Utilise une seule requête de lecture SELECT pour ce défi. »
   « ici mettre qqchose comme raté au lieu d’un coup de patte ». */
/* 7 h 13 : « Essaie encore finalement avec le message sql » ; 7 h 23 : « si je veux une erreur sous l’éditeur… et enlève le « raté »
   complètement » ; 7 h 37 : « Non enfaite met le au niveau de l’indice « Réessaie » avec une icône ! Mais en mode erreur sql ui ux » ;
   7 h 51 : « Je vais plus partir sur : Pas tout à fait. Réessaie ! ». */
test('« Réessaie » dans la carte, sous l’indice, avec la pastille « ! » de « Erreur SQL » (7 h 37 ; sous l’éditeur à 7 h 23, « Essaie encore » à 7 h 13, « Raté » à 2 h)', () => {
  const f = fn('defiIndicesHTML');
  assert.ok(f.includes("const st=diag?`<div class=\"coach-st\"><span class=\"coach-st-ico\" aria-hidden=\"true\">!</span><div class=\"coach-st-tx\"><b class=\"coach-st-k\">Pas tout à fait. Réessaie&nbsp;!</b>${String(diag).startsWith('<p>')?diag:`<p>${diag}</p>`}</div></div>`:'';"));
  assert.ok(lq.includes('html.lq .coach-st p+p{margin-top:6px}'), 'le message, puis l’aide (8 h 04)');
  assert.ok(f.includes("${diag?' has-ko':''}") && f.includes('${head}${body}${st}${nx}'), 'sous l’indice, avant le compte à rebours');
  assert.ok(!f.includes('Essaie encore</span>') && !f.includes('>Raté<') && !f.includes('Un coup de patte&nbsp;?</span>'));
  assert.ok(app.includes("function coachKo(diag){if(!COACH)return;COACH.diag=diag;COACH.fx='is-new-ko';coachPaint();}"), 'un essai manqué la remplit, la ligne secoue');
  /* En mode erreur SQL : les couleurs, la pastille et le titre de la boîte « Erreur SQL » (ludique.css, 24) */
  for (const part of [
    'html.lq .coach-st{display:flex;align-items:flex-start;gap:12px;margin-top:12px;padding:12px 14px 13px 12px;border:2px solid #F6C9CC;border-radius:16px;background:var(--danger-soft);animation:none}',
    'html.lq .coach-st .coach-st-ico{flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:12px;background:var(--danger-fill);color:#fff;',
    'html.lq .coach-st .coach-st-k{display:block;margin:3px 0 2px;color:var(--danger);font:700 17px/1.2 var(--display)}',
    'html.lq .coach-st p code{padding:1px 6px;border-radius:6px;background:rgba(0,0,0,.05);color:var(--ink);',
    'html.lq .coach.is-new-ko .coach-st{animation:coachKo .45s ease}',
  ]) assert.ok(lq.includes(part), part);
  assert.ok(lq.includes('html.lq .feedback.err{background:var(--danger-soft)!important;border-color:#F6C9CC!important;') && lq.includes('html.lq .feedback.err .fi{background:var(--danger-fill)!important}'), 'les mêmes que « Erreur SQL »');
  assert.ok(!lq.includes('html.lq .coach-st-k{flex:none;padding:3px 9px;border-radius:99px;background:#E0457B;') && !lq.includes('html.lq .coach-st p{display:inline}') && !lq.includes('html.lq .coach-intro+.coach-st{'), 'plus la pastille rose « Essaie encore »');
});

/* ---------- 8. La partie rouge : l’erreur SQL, comme dans la boîte « Erreur SQL » (9 novembre, 8 h 04) ---------- */

/* 2 h : « en français et ne met pas d’indice, met juste le message d’erreur sql pour la partie en rouge stp » (sqlErreurFr, retiré).
   8 h 04 : « Non, c’est pas ça que je veux, c’est vraiment l’erreur SQL, comme quand on fait exécuter et qu’on a une erreur. Ça dit,
   il n’y a pas de point-virgule, etc. » : le message de SQLite tel quel, puis l’aide de errBox. */
function erreurs(o = {}) {
  const ctx = vm.createContext(Object.assign({}, o));
  vm.runInContext(line('esc') + cut('/* 9 novembre, 8 h 04 (Elisa) : « c’est vraiment l’erreur SQL', 'const RUN_ICO='), ctx);
  return ctx;
}

test('l’erreur SQL d’un défi : le message de SQLite, puis l’aide de la boîte « Erreur SQL » (« … le point-virgule final »)', () => {
  const { defiErreurSql: e, errBox, errAide } = erreurs();
  assert.equal(e('near "q": syntax error', 'q'), '<p><code>near "q": syntax error</code></p><p>Requête mal formée — vérifie les <span style=\'white-space:nowrap\'>mots-clés</span>, les virgules et le <span style=\'white-space:nowrap\'>point-virgule</span> final.</p>');
  assert.equal(e('no such column: foo', 'SELECT foo FROM vols'), '<p><code>no such column: foo</code></p><p>Vérifie l\'orthographe exacte de la colonne — ou si tu voulais du texte, entoure-le de guillemets simples : <code>\'texte\'</code>.</p>');
  assert.equal(e('incomplete input', 'SELECT * FROM vols WHERE'), '<p><code>incomplete input</code></p>', 'sans aide connue : le message seul');
  assert.equal(e('Error: near "x": syntax error'), '<p><code>near "x": syntax error</code></p><p>Requête mal formée — vérifie les <span style=\'white-space:nowrap\'>mots-clés</span>, les virgules et le <span style=\'white-space:nowrap\'>point-virgule</span> final.</p>');
  assert.equal(e('near "<img src=x onerror=alert(1)>": syntax error'), '<p><code>near "&lt;img src=x onerror=alert(1)&gt;": syntax error</code></p><p>Requête mal formée — vérifie les <span style=\'white-space:nowrap\'>mots-clés</span>, les virgules et le <span style=\'white-space:nowrap\'>point-virgule</span> final.</p>', 'un bout de requête ne devient jamais du HTML');
  for (const [m, q] of [['near "q": syntax error', 'q'], ['no such column: foo', ''], ['near "ON": syntax error', 'SELECT DISTINCT ON (e.id) e.nom FROM equipes e']]) {
    assert.ok(errBox(m, q).includes(`<p><code>${m}</code></p><p style="margin-top:7px">${errAide(m, q)}</p>`), 'les mêmes mots que la boîte « Erreur SQL » : ' + m);
  }
  assert.ok(!app.includes('function sqlErreurFr(') && !app.includes('sqlErreurFr(') && !lire('multiplayer-security.js').includes('sqlErreurFr'), 'plus de traduction');
});

test('en salle classée : la requête est compilée sur la base du défi, sans être exécutée, pour donner l’erreur exacte', () => {
  const vus = [];
  const ctx = erreurs({
    sqlCompat: s => s,
    defiSandbox: () => ({ prepare: q => { vus.push(q); if (q === 'q') throw new Error('near "q": syntax error'); return { free() {}, step() { throw new Error('exécutée !'); } }; }, close() {} })
  });
  const regle = 'Utilise une seule requête de lecture SELECT pour ce défi.';
  assert.equal(ctx.defiErreurSalle({ id: 'd1' }, 'q', regle), '<p><code>near "q": syntax error</code></p><p>Requête mal formée — vérifie les <span style=\'white-space:nowrap\'>mots-clés</span>, les virgules et le <span style=\'white-space:nowrap\'>point-virgule</span> final.</p>', '« q » : l’erreur de SQLite et son aide, pas la règle du serveur');
  assert.equal(ctx.defiErreurSalle({ id: 'd1' }, 'DELETE FROM avis', regle), `<p><code>${regle}</code></p>`, 'une requête valide mais refusée : la règle du serveur');
  assert.equal(ctx.defiErreurSalle({ id: 'd1' }, 'SELECT 1', 'Le résultat ne correspond pas à la consigne.'), 'Le résultat ne correspond pas à la consigne.', 'un résultat faux n’est pas une erreur');
  assert.deepEqual(vus, ['q', 'DELETE FROM avis'], 'compilée seulement (prepare), jamais pour un résultat faux');
  const mps = lire('multiplayer-security.js');
  assert.ok(mps.includes("const msg = typeof defiErreurSalle === 'function' ? defiErreurSalle(defi, sql, brut) : esc(brut);"));
  assert.ok(mps.includes("setLessonOut(carte ? '' : `<div class=\"feedback err\"><div class=\"fi\">!</div><div><b>Pas tout à fait. Réessaie&nbsp;!</b>${String(msg).startsWith('<p>') ? msg : `<p>${msg}</p>`}</div></div>`);\n        jeuEssaiRate(round);\n        if(typeof coachRoomTick==='function')coachRoomTick();\n        if(carte)coachKo(msg);"), 'dans la carte : l’erreur SQL et son aide, ou « Le résultat ne correspond pas à la consigne. » ; rien sous l’éditeur');
  assert.ok(!mps.includes('defiErreurBox') && !mps.includes('defiPasEncoreBox') && !mps.includes('defiErreurSqlFr'));
});

test('un défi seul ou une salle : l’erreur SQL et son aide dans la carte, rien sous l’éditeur (8 h 04) ; un résultat faux, sans indice, et le résultat dessous (7 h 55)', () => {
  assert.ok(app.includes("    if(isDefi&&COACH&&COACH.c===current){setLessonOut('');COACH.diag=defiErreurSql(e.message,sql);COACH.fx='is-new-ko';}\n    else setLessonOut(errBox(e.message,sql));"), 'seul : une erreur');
  assert.ok(app.includes("    if(isDefi&&COACH&&COACH.c===current){setLessonOut(table);COACH.diag=diag;COACH.fx='is-new-ko';}\n    else setLessonOut(defiPasEncoreBox(diag,table));\n    registerExoFail(sql);"), 'seul : un résultat faux ; un exercice garde « La requête tourne, mais… »');
  assert.ok(app.includes("}catch(e){setLessonOut('');jeuEssaiRate(r);coachRoomTick();coachKo(typeof defiErreurSql==='function'?defiErreurSql(e.message,sql):esc(e.message));return;}"), 'en salle : une erreur');
  assert.ok(app.includes('  setLessonOut(table);   // le résultat obtenu sous l’éditeur ; dans la carte, « Pas tout à fait. Réessaie ! », sans indice (9 novembre, 7 h 55)\n  jeuEssaiRate(r);\n  coachRoomTick();\n  coachKo(diag);\n}'), 'en salle : un résultat faux');
  assert.ok(!app.includes('defiErreurBox('), 'plus de boîte « Erreur SQL » sous l’éditeur dans un défi (errBox la garde pour les exercices)');
  /* En salle, pour de vrai : une requête qui plante, puis une qui tourne sans le bon résultat */
  const vu = { out: [], ko: [], rate: 0, tick: 0 };
  const salle = vm.createContext({
    JEU: { me: 'p1', rounds: [{ cid: 'd1', t1: 0, found: {}, tries: 0 }] }, CHALLENGES: [{ id: 'd1', sol: 'SELECT 1' }],
    jeuCur: () => 0, jeuRoundDone: () => false, Date: { now: () => 1 }, performance: { now: () => 0 },
    document: { getElementById: () => ({ value: vu.sql }), querySelectorAll: () => [] },
    defiSandbox: () => ({ close() {} }), execChallengeResult: (d, q) => { if (q === 'q') throw new Error('near "q": syntax error'); return [{ columns: ['x'], values: [[q === 'SELECT 1' ? 1 : 2]] }]; },
    resultatsDefiEgaux: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    renderTable: () => '<table></table>', setLessonOut: h => vu.out.push(h), jeuEssaiRate: () => vu.rate++, coachRoomTick: () => vu.tick++, coachKo: d => vu.ko.push(d),
    defiErreurSql: (m, q) => `ERR(${m} | ${q})`, esc: s => s,
  });
  vm.runInContext(fn('defiDiag') + fn('defiPiege') + fn('jeuRun'), salle);
  vu.sql = 'q'; salle.jeuRun();
  assert.deepEqual([vu.out, vu.ko, vu.rate, vu.tick], [[''], ['ERR(near "q": syntax error | q)'], 1, 1], 'l’erreur SQL et son aide (avec la requête), dans la carte ; rien sous l’éditeur');
  vu.sql = 'SELECT 2'; salle.jeuRun();
  assert.deepEqual([vu.out[1], vu.ko[1], vu.rate, vu.tick], ['<table></table>', 'Le résultat ne correspond pas à la consigne.', 2, 2], 'dans la carte, sans indice (7 h 55) ; le résultat obtenu sous l’éditeur');
  const ctx = vm.createContext({});
  vm.runInContext(line('defiPasEncoreBox'), ctx);
  assert.equal(ctx.defiPasEncoreBox('On attend 1 colonne.', '<table></table>'), '<div class="feedback warn"><div class="fi">≈</div><div><b>La requête tourne, mais…</b><p>On attend 1 colonne.</p></div></div><table></table>');
  assert.ok(!app.includes('La requête ne s’exécute pas : lis le message juste en dessous.'));
});

/* ---------- 9. L’onboarding : de l’air sous « Continuer » (9 novembre, 2 h, sa réf. 1) ---------- */

test('la phrase des conditions : 12 px de plus sous le bouton', () => {
  const ob = lire('onboarding-vitrine.css');
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-foot-note.is-legal{max-width:340px;margin:12px auto 0!important;'));
});

/* ---------- 10. La salle : plus les essais des autres (9 novembre, 2 h 11, sa réf. 1 : « @bb : pas encore (5e essai) ») ---------- */

test('« En direct » ne raconte plus les essais manqués des autres, ni au lecteur d’écran ; « Teste sa requête » reste', () => {
  const obs = cut('function jeuDirectObserver(n,xs,avant){', '\nfunction jeuDitPousser(');
  assert.ok(!obs.includes("k:'ko'") && !obs.includes('\\u00a0: pas encore') && !obs.includes('jeuOrdinal(x.essais)'));
  assert.ok(obs.includes("d={k:'ok',p:2,ico:JEU_ICO.check,html:`${N(x)} trouve, ") && obs.includes("bulles.push([x.pid,'ecrit'])"), 'qui trouve, qui écrit : toujours');
  const rate = cut("    case 'rate':{", "    case 'close':{");
  assert.ok(!rate.includes('jeuToast(') && rate.includes('(J.koAt=J.koAt||{})[m.pid]=Date.now();\n      jeuDirectPeindre(n);'));
});

/* ---------- 11. La connexion : le trait « ou », puis l’e-mail (9 novembre, 2 h 11) ---------- */

test('la page de connexion : Apple, Google, le trait « ou », puis l’adresse e-mail en champ', () => {
  const page = cut("  }else if(slide==='account'){", "  }else if(slide==='name'){");
  assert.ok(page.includes("${OB_PROVIDERS.filter(([provider])=>provider!=='email').map(") && page.includes('<p class="ob-divider" aria-hidden="true">ou</p>${obMailChampHTML(authReady)}'));
  const ctx = vm.createContext({ obAuthBusy: false, obProviderIcon: p => `<i data-p="${p}"></i>` });
  vm.runInContext(cut('function obMailChampHTML(authReady){', '\nfunction obCompteCarteHTML(){'), ctx);
  const bientot = ctx.obMailChampHTML(false), branche = ctx.obMailChampHTML(true);
  assert.ok(bientot.includes('class="ob-provider is-email is-champ is-soon"') && bientot.includes('onclick="obStartAuth(\'email\',this)"') && bientot.includes('<span class="ob-champ-ph">Ton adresse e-mail</span><small>Bientôt</small>'));
  assert.ok(!branche.includes('is-soon') && !branche.includes('Bientôt') && branche.includes('ob-provider-chev'), 'branchée : elle ouvre la connexion par e-mail');
  const ob = lire('onboarding-vitrine.css');
  for (const r of ['html #onboarding.ob-vitrine .ob-account .ob-provider-list>.ob-divider{margin:2px 4px!important;', 'html #onboarding.ob-vitrine .ob-provider.is-champ .ob-champ-ph{color:#A9A3C4;'])
    assert.ok(ob.includes(r), r);
});

/* ---------- 12. La salle d’attente d’un invité (9 novembre, 2 h 19, sa réf. 1) ---------- */

test('l’invité attend : « En attente que l’hôte lance la partie… » (son pseudo est déjà dans la liste, avec « hôte »)', () => {
  assert.ok(app.includes('<p class="jeu-wait"><i class="jeu-dot" aria-hidden="true"></i>En attente que l’hôte lance la partie…</p>'));
  assert.ok(!app.includes('En attente ${jeuQue(hostName)} lance la partie…'));
});

/* ---------- 13. « Essaie encore » (9 novembre, 7 h 13), puis « Réessaie » (7 h 37) : voir le test 7 ---------- */

/* ---------- 14. Seul dans la salle : la partie se joue comme en solo (9 novembre, 7 h 16) ---------- */

/* Sa capture d’une salle où elle est seule (« En direct », « C’est parti ! Qui ouvrira le score ? », « Réagir ») : « quand il y a
   personne dans la salle, ça se transforme en solo automatiquement ». */
test('seul dans la salle : la tête de « Joue seul », pas de « Réagir », « Défi » en titre', () => {
  const play = cut("    /* 9 novembre, 7 h 16 (Elisa, sa capture d’une salle où elle est seule", "      ${defiConsigneHTML(c,{base:true,titre:true})}");
  assert.ok(play.includes('    jeuTitreNav(sl);\n') && play.includes('${sl?`<section class="jeu-direct is-seul" aria-label="${J.nb===1?jeuMancheNom(n,sl):`Manche ${n+1} sur ${J.nb}`}"><div class="jeu-direct-bande">${hud}</div></section>`:jeuDirectHTML(n,hud)}'));
  /* Le titre */
  const titres = [];
  const ctx = vm.createContext({ JEU: { solo: false }, document: { getElementById: id => (id === 'nav-title' ? { set textContent(v) { titres.push(v); } } : null) } });
  vm.runInContext(fn('jeuTitreNav'), ctx);
  vm.runInContext('jeuTitreNav(true);jeuTitreNav(false);JEU.solo=true;jeuTitreNav(false)', ctx);
  assert.deepEqual(titres, ['Défi', 'Salle de défi', 'Défi']);
  for (const k of ['last=n>=J.nb-1,sl=jeuSoloLike(n);\n    jeuTitreNav(sl);', "  }else if(v==='lobby'){\n    jeuTitreNav(false);", '    const seul=J.solo||sc.every(x=>x.pid===J.me);\n    jeuTitreNav(seul);', '  jeuTitreNav(false);'])
    assert.ok(app.includes(k), k);   // les résultats, la salle d’attente, le bilan, l’entrée dans la salle
  /* « Réagir » */
  const r = vm.createContext({ JEU: { solo: false, view: 'play0' }, seul: true });
  vm.runInContext(fn('jeuReagirLa') + 'function jeuSoloLike(n){return seul;}', r);
  assert.equal(vm.runInContext('jeuReagirLa()', r), false, 'seul : pas de « Réagir »');
  vm.runInContext('seul=false', r); assert.equal(vm.runInContext('jeuReagirLa()', r), true, 'à plusieurs : « Réagir »');
  vm.runInContext("JEU.view='res0'", r); assert.equal(vm.runInContext('jeuReagirLa()', r), false, 'hors de la manche : non');
  /* Quelqu’un arrive ou part pendant la manche : elle se redessine (salle-defis.test.mjs le joue) */
  assert.ok(app.includes('    if(jeuSoloLike(n)!==J.slShown){J.keep=v;J.view=\'\';jeuPaint();return;}'));
});
