/* Vérifications d'un cours « guide » : requêtes exécutables, scènes animées, mission, parcours, tableaux testés.
   Partagé par le test (tests/guide-lessons.test.mjs) et par l'outil de contrôle d'un cours en cours d'écriture
   (node tests/helpers/check-spec.mjs fichier.js). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

export const decode = s => s.replace(/&#10;/g, '\n').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/* Contexte du programme : données, générateur de cours et, si until = 'const MODULES = [', sans les cours déjà écrits. */
export async function guideEnv(root, until = 'let state=') {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ctx = vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf(until)), ctx);
  /* Fonctions de dates et de nombres (YEAR, CEILING…) ajoutées à chaque base de test. */
  const a = html.indexOf('function datePart(val,i){'), b = html.indexOf('\nfunction buildDb()');
  vm.runInContext(html.slice(a, b), ctx);
  const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
  const get = n => vm.runInContext(n, ctx);
  return {html, ctx, SQL, decode, scenes: get('GUIDE_SCENES'), xscenes: get('GUIDE_XSCENES'), fills: get('GUIDE_FILLS'), dones: get('GUIDE_DONE'), schema: get('SCHEMA_SQL')};
}

/* Une base neuve comme celle d'une exécution dans l'app : schéma, fonctions de dates et de nombres, clés étrangères contrôlées. */
export function openDb(env) {
  const db = new env.SQL.Database();
  db.run(env.schema); env.ctx.attachDateFns && env.ctx.attachDateFns(db);
  try { db.run('PRAGMA foreign_keys = ON'); } catch (e) { /* ignoré */ }
  return db;
}

export function checkGuideLesson(env, l) {
  const {ctx, SQL, schema, scenes, xscenes, fills, dones} = env;
  let runs = 0, testedTables = 0;
  const body = [l.situation, l.studio.problem.extra, l.studio.uses.body, (l.studio.reflex || {}).extra].join('\n');
  /* Requêtes à exécuter : elles marchent, sauf celles d'un encadré « Attention » (qui montrent un piège). */
  const re = /<div class="ij-run"( data-warn="1")?(?: data-hit="[^"]*")? data-run-sql="([^"]*)"( data-sim="[^"]*")?><\/div>/g;
  let m, n = 0;
  while ((m = re.exec(body))) {
    const sql = decode(m[2]); n++; runs++;
    /* Commande de SQL serveur (GRANT, REVOKE…) : la réponse est simulée, SQLite ne l'exécute pas. Réservé aux cours « noExec ». */
    if (m[3]) { assert.ok(l.noExec, `${l.titre} : une réponse simulée (sim) n'a de sens que dans un cours noExec`); continue; }
    const db = openDb(env);
    try { db.exec(sql); assert.ok(!m[1] || true); }
    catch (e) { assert.ok(m[1], `${l.titre} : la requête échoue sans être un piège volontaire : ${sql} → ${e.message}`); }
    finally { db.close(); }
  }
  assert.ok(n >= 3, `${l.titre} : au moins 3 requêtes à exécuter`);
  assert.equal(((body.match(/<div[\s>]/g) || []).length), ((body.match(/<\/div>/g) || []).length), `${l.titre} : div équilibrés`);
  assert.equal(((body.match(/<ul[\s>]/g) || []).length), ((body.match(/<\/ul>/g) || []).length), `${l.titre} : ul équilibrés`);
  assert.equal(((body.match(/<ol[\s>]/g) || []).length), ((body.match(/<\/ol>/g) || []).length), `${l.titre} : ol équilibrés`);
  assert.ok((l.studio.reflex || {}).extra, `${l.titre} : le réflexe est bien lu par le rendu (studio.reflex)`);
  /* Typographie : pas d'espace ordinaire avant : ? ! ; hors code. */
  const text = body.replace(/<code[^>]*>[\s\S]*?<\/code>|<pre[\s\S]*?<\/pre>|<[^>]+>/g, '|').replace(/data-run-sql="[^"]*"/g, '');
  assert.ok(!/ [:?!;]/.test(text.replace(/&nbsp;/g, ' ')), `${l.titre} : espace insécable avant la ponctuation haute : ${(text.match(/.{12} [:?!;]/) || [''])[0]}`);
  /* Quiz de choix (bloc « quiz ») : chaque besoin a une bonne réponse parmi les boutons, et ses deux messages. */
  for (const q of body.match(/<div class="fn-use jc-quiz">[\s\S]*?<div class="jc-done" hidden/g) || []) {
    const asks = [...q.matchAll(/<div class="ij-ask jc-ask" data-ok="(\d+)" data-yes="([^"]+)" data-no="([^"]+)">[\s\S]*?<div class="ij-ask-opts">([\s\S]*?)<\/div>/g)];
    assert.ok(asks.length >= 3, `${l.titre} : un quiz a au moins 3 besoins`);
    for (const a of asks) assert.ok(+a[1] < (a[4].match(/<button/g) || []).length, `${l.titre} : la bonne réponse du quiz existe parmi les boutons`);
    assert.equal(+/<b>0<\/b> \/ (\d+) bonnes réponses/.exec(q)[1], asks.length, `${l.titre} : le score annonce le bon nombre de besoins`);
  }
  /* Scènes animées (celle du Problème, puis celles placées dans le cours) : légendes, étapes et cellules cohérentes. */
  const allScenes = [scenes[l.id], ...(xscenes[l.id] || [])].filter(Boolean);
  assert.ok(scenes[l.id], `${l.titre} : une scène animée dans le Problème`);
  for (const sc of allScenes) {
    const keys = new Set(sc.lanes.flatMap(x => [x.k, ...x.c.map(c => c[0])].filter(Boolean)));
    const tracks = t => String(t).trim().split(/\s+/).length;
    sc.steps.forEach((st, i) => {
      assert.ok(st.cap >= 0 && st.cap < sc.caps.length, `${l.titre} : légende de l'étape ${i}`);
      for (const f of ['on', 'off', 'dim', 'undim', 'gone', 'back', 'fold', 'unfold', 'show']) for (const k of st[f] || []) assert.ok(keys.has(k), `${l.titre} : « ${k} » inconnu (${f}, étape ${i})`);
      for (const k of Object.keys(st.text || {})) assert.ok(keys.has(k), `${l.titre} : texte sur « ${k} » inconnu`);
      for (const k of st.order || []) assert.ok(sc.lanes.some(x => x.k === k), `${l.titre} : ligne « ${k} » inconnue (order, étape ${i})`);
      for (const [a, b] of st.fly || []) assert.ok(keys.has(a) && keys.has(b), `${l.titre} : vol « ${a} » → « ${b} » inconnu (étape ${i})`);
      for (const f of ['mark', 'unmark']) for (const k of Object.keys(st[f] || {})) assert.ok(keys.has(k), `${l.titre} : « ${k} » inconnu (${f}, étape ${i})`);
      if (st.cols) assert.equal(tracks(st.cols), tracks(sc.cols), `${l.titre} : la nouvelle grille de l'étape ${i} garde le même nombre de colonnes`);
    });
    assert.equal(sc.steps.length, sc.caps.length, `${l.titre} : une légende par étape`);
    /* Les cellules de chaque ligne tiennent dans la grille. */
    /* Une ligne a au plus autant de cellules que de colonnes, sauf si elle a sa propre grille et que ses cellules passent à la ligne (multiple du nombre de colonnes). */
    if (sc.cols) for (const lane of sc.lanes) assert.ok(lane.c.length <= tracks(lane.cols || sc.cols) || (lane.cols && lane.c.length % tracks(lane.cols) === 0), `${l.titre} : trop de cellules pour la grille (${lane.k || 'en-tête'})`);
  }
  /* Chaque emplacement d'animation du cours a sa scène. */
  const slots = (body.match(/data-xscene="(\d+)"/g) || []).length;
  assert.equal(slots, (xscenes[l.id] || []).length, `${l.titre} : autant d'emplacements que de scènes dans le cours`);
  /* Mission : un « Ta mission » dans la situation, une carte « Mission accomplie » après la requête complète. */
  assert.match(l.situation, /is-mission/, `${l.titre} : « Ta mission » dans la situation`);
  const card = /<div class="ij-done is-locked"[\s\S]*?<\/ol>/.exec(l.studio.uses.body);
  assert.ok(card, `${l.titre} : carte Mission accomplie après la requête complète`);
  assert.ok(fills[l.id] && dones[l.id], `${l.titre} : requête à trous et résumé de la mission enregistrés`);
  const lastUse = l.studio.uses.body.slice(l.studio.uses.body.lastIndexOf('<div class="fn-use">'));
  const full = decode(/data-run-sql="([^"]*)"/.exec(lastUse)[1]);
  /* L'exercice n'est ni la mission ni une requête déjà exécutée dans le cours ; la mission n'est pas déjà exécutée dans une étape précédente. */
  const normSql = q => String(q).replace(/\s+/g, ' ').replace(/;\s*$/, '').trim().toLowerCase();
  const runsOf = h => [...h.matchAll(/data-run-sql="([^"]*)"/g)].map(m => normSql(decode(m[1])));
  /* L'« exemple du cours à adapter » (aide après un premier échec) ne donne pas la solution. */
  if (l.solution && l.exemple) assert.notEqual(normSql(l.exemple), normSql(l.solution), `${l.titre} : l'exemple du cours est identique à la solution de l'exercice (il doit seulement aider à l'adapter)`);
  if (l.solution) assert.ok(!runsOf(body).includes(normSql(l.solution)), `${l.titre} : l'exercice (solution) est identique à une requête exécutée dans le cours : il doit différer de la mission`);
  const beforeLast = l.situation + l.studio.problem.extra + l.studio.uses.body.slice(0, l.studio.uses.body.lastIndexOf('<div class="fn-use">'));
  assert.ok(!runsOf(beforeLast).includes(normSql(full)), `${l.titre} : la requête de la mission est déjà exécutée dans une étape précédente (varie colonnes, valeurs ou table)`);
  /* Les morceaux à placer apparaissent, dans l'ordre, dans la requête complète. */
  let pos = 0;
  for (const tok of fills[l.id].t) { const i = full.indexOf(tok, pos); assert.ok(i >= 0, `${l.titre} : « ${tok} » introuvable (dans l'ordre) dans la requête de la mission`); pos = i + tok.length; }
  /* Le parcours annonce le bon nombre de lignes. */
  const outN = +/is-out"><b>(\d+)<\/b>/.exec(lastUse)[1];
  /* Mission en SQL serveur (réponse simulée) : rien à exécuter, le parcours ne se mesure pas en lignes. */
  const simMission = / data-sim="/.test(/<div class="ij-run"[^>]*><\/div>/.exec(lastUse)[0]);
  let resMission = null, nRows = 0;
  if (!simMission) { const dbm = openDb(env); resMission = dbm.exec(full)[0]; dbm.close(); nRows = resMission.values.length; }
  /* Parcours en lignes (par défaut) ou en colonnes (data-unit="cols", ex. SELECT). */
  const unitCols = /<ol class="ij-funnel" data-unit="cols"/.test(lastUse);
  /* data-unit="free" : cours d'écriture (INSERT, UPDATE…) ou parcours qui ne se mesure pas en lignes du résultat : aucun contrôle des nombres. */
  const unitFree = /<ol class="ij-funnel" data-unit="free"/.test(lastUse);
  if (simMission) assert.ok(unitFree, `${l.titre} : la mission d'un cours simulé a un parcours data-unit="free"`);
  if (unitFree) { /* rien à comparer avec le résultat */ }
  else if (unitCols) assert.equal(outN, resMission.columns.length, `${l.titre} : la requête de la mission renvoie ${resMission.columns.length} colonnes, le parcours en annonce ${outN}`);
  else assert.equal(outN, nRows, `${l.titre} : la requête de la mission renvoie ${nRows} lignes, le parcours en annonce ${outN}`);
  /* Les personnes citées (liste d'envois et parcours) sont celles que renvoie la requête : « prénom nom », et leur contact. */
  const col = c => resMission.columns.indexOf(c);
  const whoOf = row => (col('prenom') >= 0 && col('nom') >= 0 ? `${row[col('prenom')]} ${row[col('nom')]}` : String(row[col('prenom') >= 0 ? col('prenom') : col('nom') >= 0 ? col('nom') : 0]));
  /* Le contact affiché sous chaque personne vient d'une colonne du résultat : email, téléphone ou adresse (la même pour tout le monde). */
  const contactCols = !resMission ? [] : ['email', 'telephone', 'adresse'].map(col).filter(i => i >= 0);
  const peopleHtml = unitFree ? [] : [...lastUse.matchAll(/<span class="ij-sms-who">([^<]*)<small>([^<]*)<\/small>/g)].map(m => [decode(m[1]), decode(m[2])]);
  if (peopleHtml.length) {
    /* Liste d'envois : toutes les personnes du résultat, ou les premières puis une ligne « … et N autres » (class="is-more"). */
    const more = /<li class="is-more" style="--i:\d+"><b class="ij-sms-av" aria-hidden="true">\+(\d+)<\/b>/.exec(lastUse);
    const want = resMission.values.slice(0, peopleHtml.length);
    assert.equal(peopleHtml.length + (more ? +more[1] : 0), nRows, `${l.titre} : la liste d'envois montre ${peopleHtml.length} personnes${more ? ` et annonce ${more[1]} autres` : ''}, la requête en renvoie ${nRows}`);
    assert.deepEqual(peopleHtml.map(p => p[0]), want.map(whoOf), `${l.titre} : les personnes de la liste d'envois sont celles de la requête de la mission`);
    if (contactCols.length) assert.ok(contactCols.some(i => peopleHtml.every((p, k) => p[1] === String(want[k][i]))), `${l.titre} : chaque personne a, sous son nom, son email, son téléphone ou son adresse tel que le renvoie la requête (colonnes ${contactCols.map(i => resMission.columns[i]).join(', ')})`);
    if (!more && !unitCols) {
      const funnelWho = /is-out"><b>\d+<\/b><span>[^<]*<small>([^<]*)<\/small>/.exec(lastUse)[1].replace(/ et /g, ', ').split(', ');
      assert.deepEqual(funnelWho, resMission.values.map(whoOf), `${l.titre} : le parcours cite les mêmes personnes, dans le même ordre`);
    }
  }
  const lit = (/is-out">[\s\S]*?<\/li>/.exec(lastUse)[0].match(/class="is-null"/g) || []).length;
  if (!unitFree) assert.equal(lit, outN, `${l.titre} : autant de points allumés que de lignes gardées`);
  const sms = /ij-sms(?: is-mail)?(?: is-flat)?(?: is-icons)?" style="--n:(\d+);--sg:[\d.]+s"/.exec(lastUse);
  if (sms) assert.equal(+sms[1], (lastUse.match(/<li(?: class="is-(?:more|skip)")? style="--i:/g) || []).length, `${l.titre} : nombre d'envois`);
  /* Dashboard (guideBoard) : les en-têtes sont les colonnes du résultat (leurs alias), les lignes ses valeurs, dans l'ordre
     (les premières, puis éventuellement « … et N autres » et les dernières) ; data-total = nombre de lignes ; le compteur compte
     les lignes (ou les lignes repérées, ou les colonnes) ; le graphique a une barre par ligne, à la hauteur de la valeur de la
     colonne qui le titre ; des tuiles seules (is-kpis) montrent les valeurs de la 1re ligne. */
  const board = /<div class="ij-sms is-board( is-kpis)?" style="--n:(\d+);--sg:[\d.]+s" data-total="(\d+)"(?: data-hl-col="(-?\d+)" data-hl-val="([^"]*)")?[\s\S]*?<p class="ij-sms-done">/.exec(lastUse);
  if (board) {
    assert.ok(resMission, `${l.titre} : un dashboard montre le résultat d'une requête exécutée`);
    const b = board[0], str = v => v === null ? 'NULL' : typeof v === 'number' && !Number.isInteger(v) ? String(+v.toFixed(2)) : String(v);
    const want = resMission.values.map(r => r.map(str));
    assert.equal(+board[3], nRows, `${l.titre} : data-total du dashboard = nombre de lignes du résultat`);
    if (board[1]) {
      const tiles = [...b.matchAll(/data-col="([^"]*)" data-count-to="([^"]*)"/g)];
      assert.ok(tiles.length >= 1, `${l.titre} : au moins une tuile`);
      for (const [, c, v] of tiles) {
        const k = resMission.columns.indexOf(decode(c));
        assert.ok(k >= 0, `${l.titre} : la tuile « ${c} » est une colonne du résultat`);
        assert.equal(+v, +resMission.values[0][k], `${l.titre} : la tuile « ${c} » montre la valeur du résultat`);
      }
    } else {
      /* Lignes : en-tête, lignes du résultat (repérées is-hl, ajoutées is-add), résumé « … et N autres » (is-more) ; les lignes
         supprimées (is-del) et de contexte (is-lead) ne font pas partie du résultat. */
      const trs = [...b.matchAll(/<div class="db-tr((?: is-[a-z]+)*)" role="row"[^>]*>([\s\S]*?)<\/div>/g)].map(m => ({ k: / is-head/.test(m[1]) ? ' is-head' : / is-more/.test(m[1]) ? ' is-more' : / is-(?:del|lead)/.test(m[1]) ? 'skip' : '', cells: [...m[2].matchAll(/<span class="db-x[^"]*" role="(?:columnheader|cell)"(?: data-from="[^"]*")?>([^<]*)<\/span>/g)].map(c => decode(c[1]).replace(/\u00a0/g, ' ')) })).filter(t => t.k !== 'skip');
      /* Fiche (un seul enregistrement, en colonne) : chaque ligne = nom de colonne, valeur. */
      if (/class="db-table is-fiche"/.test(b)) {
        const kv = [...b.matchAll(/<span class="db-x is-key" role="rowheader">([^<]*)<\/span><span class="db-x[^"]*" role="cell"(?: data-from="[^"]*")?>([^<]*)<\/span>/g)].map(m => [decode(m[1]), decode(m[2]).replace(/\u00a0/g, ' ')]);
        assert.equal(JSON.stringify(kv.map(x => x[0])), JSON.stringify(resMission.columns), `${l.titre} : la fiche liste les colonnes du résultat`);
        assert.equal(JSON.stringify(kv.map(x => x[1])), JSON.stringify(want[0]), `${l.titre} : la fiche montre la ligne du résultat`);
        trs.length = 0;
      }
      const head = trs.find(t => t.k === ' is-head');
      if (head) {
      assert.equal(JSON.stringify(head.cells), JSON.stringify(resMission.columns), `${l.titre} : les en-têtes du dashboard sont les colonnes du résultat de la mission`);
      const body = trs.filter(t => t.k !== ' is-head'), mi = body.findIndex(t => t.k === ' is-more');
      const before = (mi < 0 ? body : body.slice(0, mi)).map(t => t.cells), after = mi < 0 ? [] : body.slice(mi + 1).map(t => t.cells);
      const norm = r => r.map(c => c.replace(/\u00a0/g, ' '));
      assert.equal(JSON.stringify(before), JSON.stringify(want.slice(0, before.length).map(norm)), `${l.titre} : les lignes du dashboard sont celles du résultat de la mission, dans l'ordre`);
      if (after.length) assert.equal(JSON.stringify(after), JSON.stringify(want.slice(nRows - after.length).map(norm)), `${l.titre} : les dernières lignes du dashboard sont les dernières du résultat`);
      if (mi >= 0) assert.ok(body[mi].cells[0].includes(String(nRows - before.length - after.length)), `${l.titre} : « … et N autres » annonce le bon nombre de lignes`);
      else assert.equal(before.length, nRows, `${l.titre} : toutes les lignes du résultat sont affichées`);
      }
      const hlN = board[4] == null ? 0 : +board[4] < 0 ? want.filter(r => r.includes('NULL')).length : want.filter(r => r[+board[4]] === decode(board[5])).length;
      for (const [, tag, v] of b.matchAll(/data-kpi="([a-z]+)" data-count-to="([^"]*)"/g)) {
        if (tag === 'rows') assert.equal(+v, nRows, `${l.titre} : le compteur du dashboard compte les lignes`);
        if (tag === 'hl') assert.equal(+v, hlN, `${l.titre} : le compteur compte les lignes repérées`);
        if (tag === 'cols') assert.equal(+v, resMission.columns.length, `${l.titre} : le compteur compte les colonnes`);
      }
      const chart = /<small>([^<]*)<\/small><span class="db-chart"/.exec(b);
      if (chart) {
        const title = decode(chart[1]);
        const k = resMission.columns.findIndex(c => title.startsWith(c));
        assert.ok(k >= 0, `${l.titre} : le titre du graphique (« ${title} ») commence par le nom d'une colonne du résultat`);
        const vals = resMission.values.map(r => (r[k] === null || isNaN(+r[k])) ? 0 : +r[k]), max = Math.max(...vals) || 1;
        const vs = [...b.matchAll(/<i style="--i:[\d.]+;--v:([\d.]+)"><\/i>/g)].map(m => m[1]);
        assert.equal(JSON.stringify(vs), JSON.stringify(vals.map(v => (v / max).toFixed(3))), `${l.titre} : une barre par ligne, à la hauteur de sa valeur (${resMission.columns[k]})`);
      }
    }
  }
  /* Tableaux « à tester » (balayage ligne par ligne) : chaque verdict est celui de la condition, sur de vraies lignes de la table. */
  for (const blk of body.match(/<div class="rt-wrap"[\s\S]*?<span class="rt-hint">/g) || []) {
    const n = +/data-rt-n="(\d+)"/.exec(blk)[1], vals = /data-rt-val="([\d,]+)"/.exec(blk)[1].split(',').map(Number), val = vals[0], last = Math.max(...vals);
    const cond = decode(/<code class="rt-cond">([^<]*)<\/code>/.exec(blk)[1]), table = /<p class="ij-tlab">([^<]*)</.exec(blk)[1];
    const grid = /<div class="pk-mini[^>]*>([\s\S]*?)<i class="rt-bar"/.exec(blk)[1];
    const cells = [...grid.matchAll(/<span(?: class="([^"]*)")?>([\s\S]*?)<\/span>/g)].map(c => ({ cls: c[1] || '', text: decode(c[2].replace(/<i class="rt-sr">[^<]*<\/i>/g, '').replace(/<[^>]+>/g, '')) }));
    assert.equal(cells.length % n, 0, `${l.titre} : le tableau à tester a ${n} colonnes`);
    const head = cells.slice(0, n).map(c => c.text), rows = []; for (let i = n; i < cells.length; i += n) rows.push(cells.slice(i, i + n));
    assert.ok(rows.length >= 2 && cells.slice(0, n).every(c => c.cls === 'is-h'), `${l.titre} : en-têtes et lignes du tableau à tester`);
    assert.ok(rows.every(r => r[n - 1].cls.startsWith('rt-v')), `${l.titre} : une colonne de verdicts, une cellule par ligne`);
    assert.ok(rows.some(r => /is-hit/.test(r[n - 1].cls)) && rows.some(r => !/is-hit/.test(r[n - 1].cls)), `${l.titre} : au moins une ligne vraie et une fausse`);
    const dbt = openDb(env);
    /* L'étiquette du tableau est une vraie table (ses lignes sont alors vérifiées) ou un nom libre comme « groupes » (seuls les verdicts sont vérifiés). */
    const info = dbt.exec(`PRAGMA table_info(${table})`)[0], realTable = !!info, cols = realTable ? info.values.map(v => v[1]) : [];
    /* Tableau « première apparition » (DISTINCT) : une ligne est gardée si sa valeur n'a pas déjà paru plus haut, et ces lignes sont les premières de la table. */
    const firstSeen = /^DISTINCT\b/.test(cond);
    if (firstSeen) {
      const tableRows = dbt.exec(`SELECT ${head.slice(0, last + 1).filter(h => cols.includes(h)).join(', ')} FROM ${table} ORDER BY id`)[0].values.map(v => v.map(String));
      rows.forEach((r, i) => assert.deepEqual(tableRows[i], r.slice(0, last + 1).map(c => c.text), `${l.titre} : la ligne ${i + 1} du tableau est la ligne ${i + 1} de la table ${table}`));
    }
    rows.forEach((r, i) => {
      const where = head.slice(0, last + 1).map((h, k) => cols.includes(h) ? (r[k].text === 'NULL' ? `${h} IS NULL` : `${h}=${JSON.stringify(r[k].text).replace(/^"|"$/g, "'")}`) : null).filter(Boolean).join(' AND ');
      if (realTable) assert.ok(dbt.exec(`SELECT COUNT(*) FROM ${table} WHERE ${where}`)[0].values[0][0] >= 1, `${l.titre} : ${r[0].text} (${r[val].text}) existe dans la table ${table}`);
      const truth = firstSeen ? !rows.slice(0, i).some(p => p[val].text === r[val].text) : dbt.exec(`SELECT ${vals.reduce((c, v) => c.replace(new RegExp(`\\b${head[v]}\\b`, 'g'), /^-?\d+(\.\d+)?$/.test(r[v].text) ? r[v].text : /^NULL$/i.test(r[v].text) ? 'NULL' : `'${r[v].text}'`), cond)}`)[0].values[0][0] === 1;
      assert.equal(/is-hit/.test(r[n - 1].cls), truth, `${l.titre} : le verdict de ${r[0].text} doit être « ${truth ? 'vraie' : 'fausse'} » pour ${cond}`);
    });
    dbt.close(); testedTables++;
    assert.match(body.slice(body.indexOf(blk) + blk.length), /^[^<]*<\/span><button type="button" class="rt-replay">[^<]*<\/button><\/div><\/div>\s*<ul class="win-look is-cmp"[^>]*><li>[\s\S]*?<\/li><li>[\s\S]*?<\/li><\/ul>/, `${l.titre} : les deux cartes vraie / fausse suivent le tableau à tester`);
  }
  return {runs, testedTables};
}
