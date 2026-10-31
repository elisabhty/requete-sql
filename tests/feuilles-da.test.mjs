/* Elisa, 30 octobre, 22 h 11 : les feuilles (description du projet, d’une table, suppression), la page d’un projet, la question
   d’entretien et l’exécution pas à pas « au niveau supérieur » (autocollants, animations, couleurs et DA du site) ; la semaine du
   compte qui commence aujourd’hui comme le planning ; plus de défi dans le planning (ils sont dans Pratiquer) ; des exemples qui
   montrent leur SELECT ; des textes du pas à pas sans « on coupe ». */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('les autocollants : contour blanc et ombre peints dans le dessin (pas de filtre), un par icône de feuille', () => {
  const ctx = vm.createContext({ esc, escAttr: esc });
  vm.runInContext(cut('function lqStkSvg(k){', '/* ---------- Rendu : assistant'), ctx);
  for (const k of ['note', 'table', 'pen', 'broom', 'restore', 'trash', 'file', 'info', 'db', 'mic', 'bubble']) {
    const svg = ctx.lqStkSvg(k);
    assert.ok(svg.startsWith('<svg class="lq-stk" viewBox="0 0 48 48" aria-hidden="true">'), k);
    assert.ok(svg.includes('opacity=".28" transform="translate(0 2.6)"'), `${k} : ombre à rebord`);
    assert.ok(svg.includes('<g fill="#fff" stroke="#fff" stroke-width="7"'), `${k} : découpe blanche`);
    assert.ok(!/filter|<image|<text/.test(svg), `${k} : rien qui rende flou sur iPhone`);
  }
  assert.equal(ctx.lqStkSvg('inconnu'), '');
  const map = { '📝': 'note', '🗂️': 'table', '✏️': 'pen', '🧹': 'broom', '↺': 'restore', '🗑️': 'trash', '📄': 'file', 'ℹ️': 'info' };
  for (const [ico, k] of Object.entries(map)) assert.ok(ctx.lqAskStk(ico).includes(ctx.lqStkSvg(k)), `${ico} → ${k}`);
  assert.ok(ctx.lqAskStk('🎯').includes('class="lq-ask-stk is-badge"') && ctx.lqAskStk('🎯').includes('<i>🎯</i>'), 'icône inconnue : pastille découpée');
  ctx.BRAVO_ICO = { restart: '<svg id="r"></svg>' };
  assert.ok(ctx.lqAskStk('<svg id="r"></svg>').includes(ctx.lqStkSvg('restore')), '« Recommencer cette leçon ? » : la flèche en autocollant');
});

test('les feuilles : bandeau violet en tête (titre, texte, autocollant), champ et boutons sur le blanc', () => {
  const ask = cut('function lqAsk(o){', 'const lqInfo=');
  assert.ok(ask.includes("<div class=\"lq-ask-cap${o.danger?' is-danger':''}\">${o.ico?lqAskStk(o.ico):''}"), 'bandeau, rouge sous le jaune pour une suppression');
  const prompt = cut('function lqPrompt(o){', '/* Autocollants des feuilles');
  assert.ok(prompt.includes('<div class="lq-ask-cap">${o.ico?lqAskStk(o.ico):\'\'}<div class="lq-ask-cap-t">'), 'bandeau compact avec un champ');
  assert.ok(prompt.includes("count.className=n>=max?'is-max':n>=max*.9?'is-near':'';"), 'le compteur prévient près de la limite');
  const sec = css.slice(css.indexOf('/* ---------- 36.'));
  for (const part of ['html.lq .lq-ask-cap{position:relative;isolation:isolate;margin:0 -20px 20px;', 'background:var(--deep)', 'html.lq .lq-ask .lq-ask-cap h2{color:var(--sun-hi)',
    'html.lq .lq-ask.on .lq-ask-stk{animation:lqAskSlap', 'html.lq .lq-ask-stk>svg{animation:mstkFloat', 'html.lq .lq-ask.has-field .lq-ask-cap{display:flex;',
    'html.lq .lq-ask-field small.is-near{', 'html.lq .lq-ask-cap.is-danger::before{'])
    assert.ok(sec.includes(part), part);
  assert.match(sec, /@media \(prefers-reduced-motion:reduce\)\{\s*html\.lq \.lq-ask\.on \.lq-ask-stk,/, 'mouvement réduit : rien ne bouge');
});

test('Mon compte : les 7 jours du planning à partir d’aujourd’hui (« Auj. » en premier), plus de lundi à jeudi en lunes', () => {
  const acct = cut('function renderCompte(){', 'function openLegal(');
  assert.ok(acct.includes("const date=addJ(auj(),i)") && acct.includes("label:i?name[0]:'Auj.'") && !acct.includes('const monday='));
  assert.ok(acct.includes('<b>Tes 7 prochains jours</b>') && !acct.includes('<b>Cette semaine</b>'));
  assert.ok(acct.includes("`Encore ${plural(weekLeft,'séance')} d’ici ${weekEnd}.`") && !acct.includes('cette semaine.'), '« d’ici jeudi », pas « cette semaine »');
});

test('Planning : « Auj. » se voit, un jour passé ne propose plus d’y glisser une leçon, les défis sont dans Pratiquer', () => {
  assert.ok(css.includes('html.lq .wk-nav>.wk-now{width:auto!important;min-width:0!important;padding:0 12px!important;background:var(--accent)!important;'), '« Auj. » n’est plus blanc sur blanc');
  const ctx = vm.createContext({ DEF_CHEV_SVG: '<svg></svg>' });
  vm.runInContext(cut('function dayPauseHTML(passe){', '/* Liste du jour'), ctx);
  const futur = ctx.dayPauseHTML(false), passe = ctx.dayPauseHTML(true);
  assert.ok(futur.includes('<b>Journée libre</b>') && futur.includes('Glisse une leçon ici si tu veux avancer.') && futur.includes("onclick=\"switchTab('defis')\""));
  assert.ok(!futur.includes('ou un défi') && !passe.includes('Glisse'), 'plus de défi à glisser ; rien à glisser dans le passé');
  assert.ok(passe.includes('Pas de séance ce jour-là'));
  const sem = cut('function renderSemaine(){', 'const PL_OK_SVG=');
  assert.ok(sem.includes("jourSel<t?'Jour passé':'Pas de séance prévue'") && sem.includes('dayPauseHTML(jourSel<t)'), 'en-tête et message ne se répètent pas');
});

test('les défis quittent le planning : nouveau parcours en leçons seules, un parcours enregistré perd ses défis au démarrage', () => {
  const pool = cut('function buildMixPool(niveau){', 'function apercuPlan(');
  assert.ok(!pool.includes('defisParProgression') && pool.includes('return leconsDepuis(from);'));
  assert.ok(!app.includes('DEFIS_PAR_NIV'));
  const ctx = vm.createContext({});
  vm.runInContext(cut('function nettoyerPlan(', 'function migrerPlan(') + cut('function isDefiId(', 'function itemMeta(') + cut('function trierSessions(', 'function sessionDe('), ctx);
  Object.assign(ctx, {
    allLessons: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }], NIVEAUX: [{ k: 'debutant', from: 0 }], leconsDepuis: () => [],
    parseItemId: x => x, dstr: () => '2026-10-30', auj: () => new Date(2026, 9, 30), addJ: d => d, parseD: d => new Date(d), saved: 0,
    CHALLENGES: [{ id: 'c1' }, { id: 'c2' }],
  });
  ctx.save = () => { ctx.saved++; };
  /* La leçon 0 est validée : depuis le 31 octobre, 8 h 06, elle revient au calendrier (cochée) au lieu de rester dans l’archive. */
  ctx.state = { lessons: { 0: { done: true } }, defis: {}, plan: { niveau: 'debutant', per: 3, archive: [0, 'c2'], sessions: [
    { d: '2026-10-30', lessons: [1, 'c1', 2] }, { d: '2026-10-31', lessons: ['c2'] }, { d: '2026-11-01', lessons: [3] }] } };
  vm.runInContext('nettoyerPlan()', ctx);
  const plan = JSON.parse(JSON.stringify(ctx.state.plan));
  assert.deepEqual(plan.sessions, [{ d: '2026-10-30', lessons: [1, 2, 0] }, { d: '2026-11-01', lessons: [3] }], 'les défis sortent, la séance qui n’avait qu’un défi disparaît, la leçon validée revient au calendrier');
  assert.deepEqual(plan.archive, []);
  assert.equal(ctx.saved, 1, 'enregistré une fois');
  for (const t of ['Les défis suivent les prérequis', 'leçon ou défi', 'Leçons + défis', 'Glisse une leçon ou un défi']) assert.ok(!app.includes(t), `plus de « ${t} »`);
  const over = cut('function planOverviewHTML(st){', 'function planManageHTML(');
  assert.ok(over.includes("const dOk=st.nD?doneChallenges:Object.keys(state.defis||{}).filter(k=>state.defis[k]).length;"), 'la tuile Défis compte ceux de Pratiquer');
});

test('la page d’un projet : carte violette, base en autocollant, pastille du type de projet ; exemples qui montrent leur SELECT', () => {
  const scr = cut('function renderConsoleScreen(){', 'function renderConsoleHome(){');
  assert.ok(scr.includes("row.classList.toggle('is-project',inWork)") && scr.includes("lqStkSvg('db')"));
  assert.ok(scr.includes("sub.innerHTML=`<b>${activeDbId==='cours'?'Base de démo':'Projet local'}</b><span>${plur(st.tables,'table')}</span>`;"));
  const chips = cut('function renderConsoleChips(){', '/* Projet vide');
  assert.ok(chips.includes("l:'Aperçu de la table',q:`SELECT * FROM ${t}\\nLIMIT 50;`") && chips.includes('<code><span>${highlight(line)}</span></code>'));
  const ctx = vm.createContext({ esc, escAttr: esc, highlight: s => `[${s}]` });
  vm.runInContext(`const CONSOLE_EX_PLAY='';` + chips.replace('function renderConsoleChips(){', 'function f(q){').replace(/[\s\S]*?(host\.innerHTML=ex\.map)/, 'function f(ex){const host={};$1').replace(/window\.__chips=ex;[\s\S]*$/, 'return host.innerHTML;}'), ctx);
  const html = ctx.f([{ l: 'Aperçu de la table', q: 'SELECT * FROM clients\nLIMIT 50;' }, { l: 'Ventes par client', q: 'SELECT a\nFROM b\nGROUP BY a;' }]);
  assert.ok(html.includes('<small>Aperçu de la table</small><code><span>[SELECT * FROM clients]</span></code>'), 'la requête de l’aperçu, en une ligne');
  assert.ok(html.includes('<code><span>[SELECT a FROM b GROUP BY a]</span></code>'), 'une requête sur plusieurs lignes, en une seule');
  for (const part of ['html.lq #scr-console .console-title-row.is-project>div:first-child{', 'html.lq #scr-console .is-project .console-hero-stk{', 'html.lq #scr-console .chip.console-ex code{', 'html.lq #scr-console .console-project-tab.on{background:#fff;'])
    assert.ok(css.includes(part), part);
});

test('la question d’entretien : sur la carte violette, micro en autocollant, onde ; les libellés restent ceux de la vitrine', () => {
  const f = cut('function renderEntretienFocus(x){', 'function renderEntretien(opts){');
  assert.ok(f.includes('<header class="ent-focus-hero">') && f.includes("lqStkSvg('mic')") && f.includes("lqStkSvg('bubble')") && f.includes('class="ent-coach-ico ent-wave"'));
  for (const l of ['Réponds à voix haute, puis compare.', 'À toi de répondre', 'Révéler la réponse', 'Réponse attendue'])
    assert.ok(f.includes(l), l);
  assert.match(f, /Comment évalues-tu ta réponse(\s|&nbsp;|\u00a0|\u202f)\?/);
  for (const part of ['html.lq .ent-focus-hero{position:relative;isolation:isolate;', 'html.lq .ent-focus .ent-focus-hero h1{margin:14px 0 12px;color:var(--sun-hi);', 'html.lq .ent-focus .ent-wave i{', 'html.lq .ent-focus .ent-assessment .estat.on.ok{'])
    assert.ok(css.includes(part), part);
});

test('l’exécution pas à pas : des verbes (lire, filtrer, regrouper, calculer, trier, limiter), des phrases complètes, « Terminer » à la fin', async () => {
  const ctx = vm.createContext({ esc });
  vm.runInContext(app.slice(app.indexOf('const SCHEMA_SQL ='), app.indexOf('let state=')), ctx);
  const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(root, 'vendor/sqljs', f) });
  const db = new SQL.Database(); db.run(vm.runInContext('SCHEMA_SQL', ctx));
  Object.assign(ctx, { db, activeDb: () => db });
  vm.runInContext(cut('function splitClauses(sql){', 'let vizSteps=[],vizI=0;'), ctx);
  const titres = q => Array.from(ctx.buildSteps(q), s => s.t);
  assert.deepEqual(titres("SELECT ville, COUNT(*) AS n FROM clients WHERE age > 25 GROUP BY ville HAVING COUNT(*) >= 2 ORDER BY n DESC LIMIT 3;"),
    ['Lire la table clients', 'Filtrer les lignes', 'Regrouper les lignes', 'Filtrer les groupes', 'Calculer pour chaque groupe', 'Trier, puis limiter']);
  assert.deepEqual(titres('SELECT * FROM clients LIMIT 5;'), ['Lire la table clients', 'Garder toutes les colonnes', 'Limiter le résultat']);
  assert.deepEqual(titres('SELECT COUNT(*) FROM commandes;'), ['Lire la table commandes', 'Calculer sur toutes les lignes']);
  assert.deepEqual(titres('SELECT prenom FROM clients ORDER BY prenom;'), ['Lire la table clients', 'Garder les colonnes demandées', 'Trier le résultat']);
  assert.equal(titres('SELECT clients.prenom FROM clients JOIN commandes ON commandes.client_id = clients.id;')[0], 'Relier les tables');
  const lim = ctx.buildSteps('SELECT * FROM clients LIMIT 5;').at(-1).e;
  assert.match(lim, /<code>LIMIT 5<\/code> garde les 5 premières lignes du résultat\. Sans <code>ORDER BY<\/code>, rien ne garantit lesquelles/);
  const tout = ctx.buildSteps('SELECT * FROM clients LIMIT 500;').at(-1).e;
  assert.match(tout, /garde au plus 500 lignes : le résultat n’en compte que \d+, elles restent donc toutes/);
  assert.match(ctx.buildSteps('SELECT * FROM clients LIMIT 3 OFFSET 2;').at(-1).e, /saute les 2 premières lignes du résultat, puis garde les 3 suivantes/);
  const tri = ctx.buildSteps('SELECT prenom, age FROM clients ORDER BY age DESC;').at(-1).e;
  assert.ok(tri.includes(', du plus grand au plus petit.') && !tri.includes('(DESC'));
  const err = ctx.buildSteps('SELECT ville FROM clients WHERE COUNT(*) > 2;').find(s => s.err);
  assert.ok(err && err.e.includes('il faut utiliser <code>HAVING</code>'), 'un calcul dans WHERE : on explique pourquoi');
  const textes = [
    "SELECT ville, COUNT(*) AS n FROM clients WHERE age > 25 GROUP BY ville HAVING COUNT(*) >= 2 ORDER BY n DESC LIMIT 3;",
    'SELECT * FROM clients LIMIT 5;', 'SELECT COUNT(*) FROM commandes;', 'SELECT ville FROM clients WHERE COUNT(*) > 2;', 'SELECT nope FROM clients;'
  ].flatMap(q => ctx.buildSteps(q).flatMap(s => [s.t, s.e]));
  for (const t of textes) assert.doesNotMatch(t, /\b[Oo]n (coupe|charge|forme|garde|trie|filtre|calcule)\b|paquet|SQL (commence|n’a pas pu)|— /, t);
  const nav = cut('function updateVizNav(){', '/* ============================================================\n   8. ÉCRANS');
  assert.ok(nav.includes("n.textContent=none?'Compris':last?'Terminer':'Étape suivante';") && nav.includes('if(d>0&&(!vizSteps.length||vizI>=vizSteps.length-1)){closeViz();return;}'), '« Terminer » ferme, plus de « Fin » grisé ; sans étapes, « Compris »');
  /* Elisa, 31 octobre, 15 h 16, réf. 7 : la page « Visualisation impossible » dans la DA du site */
  const empty = cut('function vizEmpty(kind,sql){', 'function closeViz(){');
  assert.ok(empty.includes("vide:{stk:'pen',t:'Écris d’abord ta requête'") && empty.includes("action:{stk:'bulb',t:'Le pas à pas suit les SELECT'") && empty.includes("complexe:{stk:'route'"));
  assert.ok(empty.includes('<ol class="viz-none-path"') && !app.includes('<b>Visualisation impossible</b>'), 'plus de « Visualisation impossible » sur une requête vide');
  assert.ok(app.includes("lqVizCap('viz','route','Ta requête, rejouée une étape à la fois.');"), 'l’en-tête violet des autres feuilles');
  assert.ok(app.includes('<div class="viz-stepnum"><span>Étape ${vizI+1} sur ${vizSteps.length}</span><b>${esc(s.n)}</b></div>'));
});
