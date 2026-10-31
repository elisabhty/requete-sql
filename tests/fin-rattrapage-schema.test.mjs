/* Elisa, 31 octobre, 1 h 02 et 1 h 07 : « améliore la page avec la DA du site (encore un effort / leçon validée, avec animation et
   micro-interaction) » (l’écran de fin du cours en vidéo), « améliorer la page selon la DA du site avec micro-interaction et
   animation » (la carte « activités à replacer » du Planning), « pareil pour le schéma, et vérifier qu’il est mis à jour en direct à
   chaque modification du schéma ». */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (src, a, b) => { const i = src.indexOf(a); assert.ok(i >= 0, a); const j = src.indexOf(b, i + a.length); assert.ok(j > i, b); return src.slice(i, j); };
const s40 = cut(lq, '/* ---------- 40. L’écran de fin du cours en vidéo', '/* ---------- 41.');
const s41 = lq.slice(lq.indexOf('/* ---------- 41.'));

test('écran de fin : en-tête violet, mascotte, une pastille par moment, tampon « Validée », bouton jaune quand la leçon est validée', () => {
  const end = cut(app, '<div class="lv-end" hidden>', '<div class="lv-bottom">');
  for (const part of ['<i class="lv-end-sp s1" aria-hidden="true"></i>', `\${l.leconSeule?'<span class="lv-end-stamp" aria-hidden="true">✓ Validée</span>':''}`,
    `\${l.leconSeule?'<span class="lv-end-pips" aria-hidden="true" hidden></span>':''}`, "Leçon terminée&nbsp;!':'À toi de jouer&nbsp;!'"])
    assert.ok(end.includes(part), part);
  /* Les pastilles : ce que la règle de la leçon compte (du premier coup, ou sans erreur), une par moment */
  const ended = cut(app, 'function lvEnded(){', '/* L’écran de fin du parcours SQL');
  assert.ok(ended.includes("k=a?((max!=null?lvPkErr(a)===0:!!a.first)?'ok':'ko'):'no';") && ended.includes('style="--i:${i}">${LV_PIP[k]||\'\'}</i>') && ended.includes('pips.hidden=!n;'));
  assert.ok(app.includes("const LV_PIP={\n  ok:'<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path pathLength=\"1\""), 'la coche se dessine (pathLength=1)');
  /* Le compte en texte ne change pas (VoiceOver le lit ; les pastilles sont décoratives) */
  assert.ok(ended.includes('🎯 Tu as réussi <b>${ok}&nbsp;exercice${ok>1?\'s\':\'\'} sur&nbsp;${n}</b>&nbsp;!'));
  for (const part of ['html.lq .lv-end-top{position:relative;isolation:isolate;flex-direction:column;', 'background:var(--deep);color:#fff}', 'html.lq .lv.is-win .lv-end h2{color:var(--sun-hi)}',
    'html.lq .lv.is-win.end-in .lv-end-cat::before{animation:lvRaysIn', 'html.lq .lv.is-win.end-in .lv-end-stamp{animation:lvStampIn', 'html.lq .lv.end-in .lv-pip{animation:lvPipIn',
    'html.lq .lv.end-in .lv-pip.is-ko{animation:lvPipIn .42s cubic-bezier(.3,.7,.3,1.5) calc(.5s + var(--i) * .12s) both,lvPipNo', 'animation:lvPipDraw',
    'html.lq .lv.is-win .lv-end .lv-go{background:var(--sun)!important;color:#1B1640!important;', 'html.lq .lv.is-retry .lv-end .lv-go::after{width:18px;height:18px;'])
    assert.ok(s40.includes(part), part);
  /* Mouvement réduit : rien ne bouge, mais les coches et croix restent visibles */
  assert.match(s40, /@media \(prefers-reduced-motion:reduce\)\{[^}]*html\.lq \.lv-pip,[^}]*\{animation:none!important\}\s*html\.lq \.lv\.end-in \.lv-pip svg path\{stroke-dashoffset:0\}/);
  assert.ok(s40.includes('html[data-motion="reduce"].lq .lv.end-in .lv-pip svg path{stroke-dashoffset:0}'));
});

test('activités à replacer : en-tête violet, autocollant, « Conseillé » en autocollant jaune, entrée en cascade, choix animé', () => {
  const html = cut(app, 'function lateRecoveryHTML(){', 'function activitesRestantesAujourdhui(){');
  assert.ok(html.includes('onclick="lrPick(this,()=>{${o.action}})"'), 'un choix passe par lrPick');
  assert.ok(app.includes("action:'decalerPlanning()'") && app.includes("action:'etalerRetard()'") && app.includes("action:'rattraper()'"));
  assert.ok(html.includes("const key=d.ids.map(String).join('|'),fresh=key!==lrSeenKey; lrSeenKey=key;") && html.includes("${fresh?' is-fresh':''}"), 'animée quand elle apparaît, pas à chaque mise à jour');
  /* Le choix : étincelles, puis l’action, une seule fois ; tout de suite en mouvement réduit */
  const calls = [];
  const ctx = vm.createContext({ prefersReduceMotion: () => false, buzz: t => calls.push('buzz:' + t), lqBurst: () => calls.push('burst'), setTimeout: (f, ms) => { calls.push('wait:' + ms); f(); } });
  vm.runInContext(cut(app, "let lrSeenKey='';", '/* Le choix conseillé dépend du retard') + ';this.lrPick=lrPick;', ctx);
  const btn = { dataset: {}, classList: { add: c => calls.push('class:' + c) }, querySelector: () => ({}) };
  ctx.lrPick(btn, () => calls.push('action'));
  ctx.lrPick(btn, () => calls.push('action'));
  assert.deepEqual(calls, ['class:is-picked', 'buzz:success', 'burst', 'wait:320', 'action'], 'un seul geste compte');
  ctx.prefersReduceMotion = () => true; calls.length = 0;
  ctx.lrPick({ dataset: {}, classList: { add() {} }, querySelector: () => null }, () => calls.push('action'));
  assert.deepEqual(calls, ['action'], 'mouvement réduit : l’action tout de suite');
  /* Déplier rejoue l’entrée des activités et des choix */
  assert.ok(cut(app, 'function setLateRecoveryCollapsed(collapsed,source){', 'function toggleLateRecovery(button){').includes("if(!collapsed&&!prefersReduceMotion()){ void card.offsetWidth; card.classList.add('is-reveal'); }"));
  const s14 = cut(lq, '/* ---------- 14 bis. Activités à replacer', '/* ---------- 15. Jouer');
  for (const part of ['html.lq .lr-heading{position:relative;isolation:isolate;margin:0;padding:16px;', 'background:var(--deep);color:#fff}', 'html.lq .late-recovery .lr-title{font:700 18px/1.2 var(--display);letter-spacing:-.01em;color:#fff;',
    'html.lq .late-recovery .lr-option-title em{padding:4px 9px 3px;border-radius:9px;background:var(--sun);', 'html.lq .late-recovery:is(.is-fresh,.is-reveal) .lr-option{animation:lrUp',
    'html.lq .late-recovery.is-fresh .lr-icon{animation:lrStk', 'html.lq .late-recovery .lr-option.is-picked .lr-option-icon{transform:scale(1.12) rotate(-8deg)}'])
    assert.ok(s14.includes(part), part);
  assert.ok(!/#FFD9A6|#FFF6E8|#EFCB9C|#F6DDBD/.test(s14), 'plus de tons crème du retard dans la carte');
  assert.ok(s14.includes('html[data-motion="reduce"].lq #scr-planning .late-recovery,html[data-motion="reduce"].lq .late-recovery *{animation:none!important}'));
});

test('console : le schéma et la sauvegarde suivent toute requête qui change la base, même celle qui échoue en route', () => {
  const run = cut(app, 'function runConsole(){', 'function normalizeState(raw){');
  assert.ok(run.includes('const database=activeDb(), v0=schemaVersion(database), c0=dbChanges(database);'));
  assert.ok(run.includes("if(activeDbId!=='cours'&&touched()) persistCustomDbs();") && !run.includes('!/^\\s*select\\b/i.test(sql)'), 'sauvegardé quand la base a changé, quelle que soit la première instruction');
  assert.ok(run.includes("if(touched()){ if(activeDbId!=='cours') persistCustomDbs(); renderDbWorkspace(); }"), 'requête en erreur : ce qui est déjà fait se voit et se garde');
});

test('SQLite : une requête en erreur garde ses instructions passées, et le compteur le dit', async () => {
  const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(root, 'vendor/sqljs', f) });
  const ctx = vm.createContext({});
  const fn = name => { const a = app.indexOf(`function ${name}(`); return app.slice(a, app.indexOf('\n}', a) + 2); };
  for (const name of ['schemaVersion', 'dbChanges', 'quoteIdent', 'listTables']) vm.runInContext(fn(name), ctx);
  const d = new SQL.Database();
  const v0 = ctx.schemaVersion(d), c0 = ctx.dbChanges(d);
  assert.throws(() => d.exec('CREATE TABLE produits(id INTEGER PRIMARY KEY, nom TEXT); INSERT INTO pas_de_table VALUES (1);'));
  assert.ok(ctx.listTables(d).includes('produits'), 'la table est créée malgré l’erreur');
  assert.notEqual(ctx.schemaVersion(d), v0, 'le schéma a changé');
  assert.equal(ctx.dbChanges(d), c0, 'aucune ligne encore');
  d.exec("INSERT INTO produits(nom) VALUES ('Zinc'), ('Fer');");
  assert.equal(ctx.dbChanges(d), c0 + 2, 'les lignes se comptent');
  const v1 = ctx.schemaVersion(d);
  d.exec('SELECT * FROM produits');
  assert.ok(ctx.schemaVersion(d) === v1 && ctx.dbChanges(d) === c0 + 2, 'un SELECT ne change rien');
});

test('schéma de la console : ce qui vient de changer s’anime (nouvelle table, colonnes changées, lignes en plus)', () => {
  const diff = cut(app, 'let dbWsSnap=null;', 'function renderDbWorkspace(){');
  const ctx = vm.createContext({ activeDbId: 'p1', V: 1, SIG: { a: 'id:INTEGER:1' }, N: { a: 2 } });
  vm.runInContext('function schemaVersion(){return V;} function tableRowCount(d,t){return N[t];} function quoteIdent(n){return n;}' + diff.replace('let dbWsSnap=null;', 'var dbWsSnap=null;')
    + ';function dbTableSig(d,t){return SIG[t];} this.dbWsDiff=dbWsDiff;', ctx);
  assert.deepEqual({ ...ctx.dbWsDiff({}, ['a']) }, { a: '' }, 'premier affichage : rien ne s’anime');
  ctx.V = 2; ctx.SIG.b = 'x:TEXT:0'; ctx.N.b = 0;
  assert.deepEqual({ ...ctx.dbWsDiff({}, ['a', 'b']) }, { a: '', b: 'is-new' }, 'CREATE TABLE : la table est nouvelle');
  ctx.V = 3; ctx.SIG.a = 'id:INTEGER:1,email:TEXT:0';
  assert.deepEqual({ ...ctx.dbWsDiff({}, ['a', 'b']) }, { a: 'is-changed', b: '' }, 'ALTER TABLE : ses colonnes changent');
  ctx.N.b = 3;
  assert.deepEqual({ ...ctx.dbWsDiff({}, ['a', 'b']) }, { a: '', b: 'is-more' }, 'INSERT : des lignes en plus');
  ctx.activeDbId = 'p2';
  assert.deepEqual({ ...ctx.dbWsDiff({}, ['a', 'b']) }, { a: '', b: '' }, 'une autre base : rien ne s’anime');
  const w = cut(app, 'function renderDbWorkspace(){', 'function toggleTableSchema(name){');
  assert.ok(w.includes('const fresh=dbWsDiff(database,tables);') && w.includes("if(!prefersReduceMotion())tables.forEach(t=>{ if(!fresh[t])return; const el=host.querySelector(`.db-tblock[data-table=\"${CSS.escape(t)}\"]`); if(el)el.classList.add(fresh[t]); });"));
  assert.ok(w.includes(`<span class="db-tico" aria-hidden="true">\${lqStkSvg('table')}</span>`), 'l’autocollant de la table');
  const sum = cut(app, 'function renderConsoleSchemaSummary(){', 'function toggleConsoleSchema(){');
  assert.ok(sum.includes("ico.innerHTML=lqStkSvg('db');") && sum.includes("const html=st.tables?bits.map(b=>`<span>${b}</span>`).join(''):'Aucune table';") && sum.includes("meta.classList.add('is-bump');"));
  for (const part of ['html.lq #scr-console .console-schema-summary{position:relative;isolation:isolate;overflow:hidden;border:0!important;background:var(--deep)!important;',
    'html.lq #scr-console #console-schema-meta.is-bump span{animation:dbBump', 'html.lq #scr-console .console-schema-panel .db-tblock.is-new::after{content:"Nouvelle";',
    'html.lq #scr-console .console-schema-panel .db-tblock.is-changed{animation:dbFlash', 'html.lq #scr-console .console-schema-panel .db-col .badge.pk{background:var(--sun);',
    'html.lq #scr-console .console-schema-panel .db-col .badge.fk{background:var(--mint);', 'html.lq #scr-console .console-schema-panel .db-cols.on .db-col{animation:dbColIn'])
    assert.ok(s41.includes(part), part);
});

test('feuille « Schéma » : l’en-tête violet des feuilles et les cartes des tables', () => {
  assert.ok(cut(app, 'function openSchemaSheet(){', 'function closeSchemaSheet(){').includes("lqVizCap('schema-sheet','db',`${plur(n,'table')}, leurs colonnes et leurs clés.`);"));
  assert.ok(cut(app, 'function renderSchemaSheet(){', 'function openSchemaSheet(){').includes(`<span class="sch-stk" aria-hidden="true">\${lqStkSvg('table')}</span>`));
  for (const part of ['html.lq #schema-sheet .sch-table{margin:0 16px 14px;border:2px solid var(--line);', 'html.lq #schema-sheet .sch-col .badge.pk{background:var(--sun);', 'html.lq #schema-sheet.on .sch-table{animation:dbColIn'])
    assert.ok(s41.includes(part), part);
});
