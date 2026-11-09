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

test('une manche manquée : la carte « Temps écoulé » (0 point obtenu), sans bandeau « 0 · 0/1 · — » ; il reste pour un record et à plusieurs manches', () => {
  assert.ok(app.includes("lastMiss=nT===1&&lastR&&lastR.ms==null?jeuMissHTML(lastR.r,J.solo||host):'';"), 'la carte : une manche, manquée');
  assert.ok(app.includes("`${lastMiss}${lastMiss&&!J.record?'':`<div class=\"jeu-bilan${J.record?' has-record':''}\">"), 'le bandeau, sinon');
  assert.ok(app.includes('<div><b>${avg}</b><small>temps moyen</small></div></div>`}'));
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
test('un essai qui ne va pas : « Raté », puis ce qui cloche', () => {
  const st = cut('  const st=diag?', ";\n");
  assert.ok(st.includes('<div class="coach-st"><span class="coach-st-k">Raté</span><p>${diag}</p></div>'));
  assert.ok(!st.includes('coup de patte'));
});

/* ---------- 8. La partie rouge : l’erreur de SQLite, en français (9 novembre, 2 h) ---------- */

/* « en français et ne met pas d’indice, met juste le message d’erreur sql pour la partie en rouge stp » */
function traducteur(o = {}) {
  const ctx = vm.createContext(Object.assign({ esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }, o));
  vm.runInContext(cut('function sqlErreurFr(msg){', '\nfunction errBox(msg,sql){'), ctx);
  return ctx;
}

test('les messages de SQLite, en français ; ce qu’ils citent en code, échappé', () => {
  const { sqlErreurFr: fr } = traducteur();
  const cas = [
    ['near "q": syntax error', 'Erreur de syntaxe près de <code>q</code>.'],
    ['incomplete input', 'La requête est incomplète.'],
    ['no such column: foo', 'La colonne <code>foo</code> n’existe pas.'],
    ['no such table: nope', 'La table <code>nope</code> n’existe pas.'],
    ['no such function: abc', 'La fonction <code>abc</code> n’existe pas.'],
    ['ambiguous column name: id', 'Le nom de colonne <code>id</code> est ambigu : plusieurs tables de la requête l’ont.'],
    ['misuse of aggregate: COUNT()', 'Mauvaise utilisation de la fonction d’agrégation <code>COUNT()</code>.'],
    ['1st ORDER BY term out of range - should be between 1 and 3', 'Le terme n° 1 de <code>ORDER BY</code> est hors limites : il doit être entre 1 et 3.'],
    ['SELECTs to the left and right of UNION do not have the same number of result columns', 'Les SELECT de part et d’autre de <code>UNION</code> n’ont pas le même nombre de colonnes.'],
    ['sub-select returns 2 columns - expected 1', 'La sous-requête renvoie 2 colonnes : il en faut une seule.'],
    ['HAVING clause on a non-aggregate query', 'La clause <code>HAVING</code> est dans une requête sans agrégation.'],
    ['wrong number of arguments to function substr()', 'Mauvais nombre d’arguments pour la fonction <code>substr()</code>.'],
    ['Utilise une seule requête de lecture SELECT pour ce défi.', 'Requête refusée : un défi n’accepte qu’une seule requête <code>SELECT</code>.'],
    ['Résultat trop volumineux.', 'Résultat trop volumineux.'],
    ['something new', 'Erreur SQL : <code>something new</code>'],
  ];
  for (const [en, attendu] of cas) assert.equal(fr(en), attendu, en);
  assert.equal(fr('near "<img src=x onerror=alert(1)>": syntax error'), 'Erreur de syntaxe près de <code>&lt;img src=x onerror=alert(1)&gt;</code>.', 'un bout de requête ne devient jamais du HTML');
  assert.ok(!fr('near "q": syntax error').includes('Utilise') && !fr('no such column: foo').includes('Vérifie'), 'pas d’indice : seulement l’erreur');
});

test('en salle classée : la requête est compilée sur la base du défi, sans être exécutée, pour donner l’erreur exacte', () => {
  const vus = [];
  const ctx = traducteur({
    sqlCompat: s => s,
    defiSandbox: () => ({ prepare: q => { vus.push(q); if (q === 'q') throw new Error('near "q": syntax error'); return { free() {}, step() { throw new Error('exécutée !'); } }; }, close() {} })
  });
  const regle = 'Utilise une seule requête de lecture SELECT pour ce défi.';
  assert.equal(ctx.defiErreurSqlFr({ id: 'd1' }, 'q', regle), 'Erreur de syntaxe près de <code>q</code>.', '« q » : l’erreur de SQLite, pas la règle du serveur');
  assert.equal(ctx.defiErreurSqlFr({ id: 'd1' }, 'DELETE FROM avis', regle), 'Requête refusée : un défi n’accepte qu’une seule requête <code>SELECT</code>.', 'une requête valide mais refusée : la raison');
  assert.equal(ctx.defiErreurSqlFr({ id: 'd1' }, 'SELECT 1', 'Le résultat ne correspond pas à la consigne.'), 'Le résultat ne correspond pas à la consigne.', 'un résultat faux n’est pas une erreur');
  assert.deepEqual(vus, ['q', 'DELETE FROM avis'], 'compilée seulement (prepare), jamais pour un résultat faux');
  const mps = lire('multiplayer-security.js');
  assert.ok(mps.includes("coachKo(typeof defiErreurSqlFr === 'function' ? defiErreurSqlFr(defi, sql, brut) : esc(brut));"));
});

test('un défi seul ou une salle locale : l’erreur dans la partie rouge, plus de boîte « Erreur SQL » dessous', () => {
  assert.ok(app.includes("    if(isDefi&&COACH&&COACH.c===current){setLessonOut('');COACH.diag=sqlErreurFr(e.message);COACH.fx='is-new-ko';}\n    else setLessonOut(errBox(e.message,sql));"));
  assert.ok(app.includes("}catch(e){setLessonOut('');jeuEssaiRate(r);coachKo(sqlErreurFr(e.message));return;}"));
  assert.ok(!app.includes('La requête ne s’exécute pas : lis le message juste en dessous.'));
});

/* ---------- 9. L’onboarding : de l’air sous « Continuer » (9 novembre, 2 h, sa réf. 1) ---------- */

test('la phrase des conditions : 12 px de plus sous le bouton', () => {
  const ob = lire('onboarding-vitrine.css');
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-foot-note.is-legal{max-width:340px;margin:12px auto 0!important;'));
});
