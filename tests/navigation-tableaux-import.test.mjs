/* Elisa, 31 octobre, 8 h 37 : quatorze retours.
   Réf 1 et 3 : les feuilles de Mon compte passaient sous la barre d’onglets (« pb d’espace, pareil pour le reste de cette page ») ;
   Réf 2 : « Selon le SGBD » : ne rien surligner et ne pas mettre « cours » ;
   Réf 4 : les boutons de navigation en haut à gauche ne sont pas mis en avant ;
   Réf 5 : « 2 activités à replacer » dans la DA du site ;
   Réf 6 : les pages légales mènent au site ;
   Réf 7 : Exécuter : une micro-interaction, et l’écran va au résultat ;
   Réf 8 : le tableau de résultat dans la DA du site ;
   Réf 9 : la liste des tables sans autocollants, les actions sous la description une fois la table dépliée ;
   Réf 10 : une croix en haut à droite des feuilles ;
   Réf 11 : le retour d’une sous-page ramène là d’où l’on vient ;
   Réf 12 : la journée libre a mieux qu’un emoji café ;
   Réf 13 : « Démarrer la séance » avec une flèche qui bouge ;
   et l’import : détecter l’encodage (UTF-8, etc.) pour avoir des colonnes bien formées. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const app = read('index.html'), css = read('ludique.css');
const s47 = css.slice(css.indexOf('/* ---------- 47.'));
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => { const a = app.indexOf(`function ${name}(`); assert.ok(a > 0, name); return app.slice(a, app.indexOf('\n}', a) + 2); };
const plain = v => JSON.parse(JSON.stringify(v));

test('réf 1 et 3 — une feuille de Mon compte passe devant la barre d’onglets, avec de l’air en bas', () => {
  assert.ok(s47.includes('html.lq #app:has(#scr-compte .plus-details[open])>.stage{z-index:40}'), 'la page passe devant la barre (z-index 30)');
  assert.ok(/\.tabbar\{position:absolute;left:0;right:0;bottom:0;z-index:30;/.test(app), 'la barre reste à 30');
  assert.ok(s47.includes('html.lq #scr-compte .plus-details-body{padding-bottom:calc(var(--safe-bottom) + 26px)!important}'));
});

test('réf 4 — le retour en haut à gauche : une pastille blanche en relief, la flèche dans un rond violet, le nom de la page', () => {
  for (const part of ['html.lq #app .screen>.home-back::before{content:"";position:absolute;z-index:-1;top:calc(var(--safe-top) + 3px);bottom:3px;left:12px;right:12px;',
    'border:2px solid var(--line);border-radius:99px;background:#fff;box-shadow:0 3px 0 var(--lip);',
    'background:var(--accent)!important;color:#fff;box-shadow:0 2px 0 var(--accent-lip)!important}',
    'html.lq #app .screen.p-scrolled:not(.ent-focus-mode)>.home-back span{max-width:0;margin-left:-9px;opacity:0}',
    'html.lq #scr-lesson .navbar .back{gap:9px;padding:3px 14px 3px 3px!important;border:2px solid var(--line)!important;border-radius:99px!important;'])
    assert.ok(s47.includes(part), part);
});

test('réf 11 — le retour d’une sous-page ramène là d’où l’on vient, et le dit', () => {
  const ctx = vm.createContext({ consoleView: 'list', document: { getElementById: () => null } });
  vm.runInContext(fn('primaryTabFor') + cut('const TAB_BACK_NAME=', 'function returnToParent(){'), ctx);
  assert.equal(vm.runInContext("tabBackDest('defis')", ctx), 'practice', 'sans origine : la rubrique');
  assert.deepEqual(plain(vm.runInContext("tabBackName('defis')", ctx)), ['Pratiquer', 'à Pratiquer']);
  vm.runInContext("tabFrom.defis='learn';tabFrom.sgbd='console'", ctx);
  assert.equal(vm.runInContext("tabBackDest('defis')", ctx), 'learn', 'ouvert depuis l’Accueil');
  assert.deepEqual(plain(vm.runInContext("tabBackName('defis')", ctx)), ['Accueil', 'à l’accueil']);
  assert.deepEqual(plain(vm.runInContext("tabBackName('sgbd')", ctx)), ['Console', 'à la console']);
  const sw = fn('switchTab');
  assert.ok(sw.includes('if(activeTab&&name!==activeTab&&primaryTabFor(name)!==name&&!tabBackNav&&!restoringNav)tabFrom[name]=activeTab;'), 'l’origine est notée à l’entrée');
  assert.ok(sw.includes('activeTab=name;\n  syncTabBack(name);'), 'le libellé suit');
  const back = fn('returnToParent');
  assert.ok(back.includes('const parent=tabBackDest(activeTab);') && back.includes('delete tabFrom[activeTab];') && back.includes('tabBackNav=true;\n  try{switchTab(parent);}finally{tabBackNav=false;}'));
  assert.ok(app.includes('const parent=typeof tabBackDest===\'function\'?tabBackDest(activeTab):primaryTabFor(activeTab);'), 'le glissement depuis le bord montre la bonne page dessous');
  assert.ok(fn('renderConsoleScreen').includes("if(lab) lab.textContent=inWork?'Projets':backTo[0];") && fn('syncEntretienChrome').includes("label.textContent=focused?'Questions':backTo[0];"));
});

test('réf 5 — « activités à replacer » dans la DA du site', () => {
  assert.ok(app.includes('<span class="jp-stk" aria-hidden="true">${lqStkSvg(\'cal\')}<i class="jp-badge">${late.count}</i></span>'), 'l’autocollant du calendrier et sa pastille');
  for (const part of ['html.lq #home-hero .journey-planning{border:2px solid var(--line)!important;background:#fff!important;box-shadow:0 4px 0 var(--lip)!important}',
    'html.lq #home-hero .jp-copy small{align-self:flex-start;padding:3px 10px;border-radius:99px;background:var(--sun);',
    'html.lq #home-hero .jp-chev{background:var(--accent)!important;'])
    assert.ok(s47.includes(part), part);
});

test('réf 6 — les pages légales ouvrent celles du site', () => {
  const pages = cut('const LEGAL_PAGES=', 'function legalUrl(');
  for (const f of ['decouvrir/confidentialite.html', 'decouvrir/conditions.html', 'decouvrir/mentions-legales.html']) {
    assert.ok(pages.includes(`'${f}'`), f);
    assert.ok(fs.existsSync(path.join(root, f)), 'la page existe : ' + f);
  }
  for (const k of ['privacy', 'terms', 'mentions'])
    assert.ok(app.includes(`<a class="acc-row is-ext" href="\${escAttr(legalUrl('${k}'))}" target="_blank" rel="noopener">`), 'Mon compte : ' + k);
  assert.ok(app.includes(`<a class="ob-legal-link" href="\${escAttr(legalUrl('terms'))}" target="_blank" rel="noopener">Conditions d’utilisation</a>`), 'l’onboarding');
  assert.ok(fn('openLegal').includes('if(LEGAL_PAGES[kind]&&openLegalSite(kind))return;'), 'les autres appels mènent aussi au site');
  assert.ok(app.includes('function obOpenLegal(kind){openLegalSite(kind);}'));
});

test('réf 7 — Exécuter répond, puis l’écran va au résultat', () => {
  const run = fn('runConsole');
  assert.ok(run.includes("fb=[true,n==null?'Exécutée':plur(n,'ligne')];") && run.includes("fb=[false,'Erreur'];"));
  assert.ok(run.includes('if(fb)runFeedback(btn,fb[0],fb[1]); requestAnimationFrame(()=>scrollToResult(out));'));
  assert.ok(fn('setLessonOut').includes("if(html&&typeof scrollToResult==='function')scrollToResult(out);"), 'aussi dans un cours ou un défi');
  assert.ok(fn('setRunLoading').includes("clearTimeout(btn._fb);btn.classList.remove('is-ok','is-ko');"), 'une nouvelle exécution efface le retour précédent');
  /* L’écran glisse jusqu’au résultat, sous la barre du haut, sauf s’il est déjà dans la moitié haute */
  const calls = [];
  const mk = top => ({ getBoundingClientRect: () => ({ top, bottom: top + 30 }) });
  const bar = { getBoundingClientRect: () => ({ bottom: 44 }) };
  const scr = { scrollTop: 300, getBoundingClientRect: () => ({ top: 0, bottom: 800 }), querySelector: () => bar, scrollTo: o => calls.push(o) };
  const meta = mk(700);
  const out = { firstElementChild: meta, closest: () => scr, querySelector: () => meta };
  const ctx = vm.createContext({ prefersReduceMotion: () => false });
  vm.runInContext(fn('scrollToResult'), ctx);
  ctx.scrollToResult(out);
  assert.deepEqual(plain(calls), [{ top: 300 + 700 - 56, behavior: 'smooth' }], 'le résultat monte sous la barre');
  const near = mk(120); out.querySelector = () => near; calls.length = 0;
  ctx.scrollToResult(out);
  assert.equal(calls.length, 0, 'déjà sous les yeux : on ne bouge pas');
  for (const part of ['html.lq .btn-run.is-ok{background:var(--mint)!important;', 'html.lq .btn-run.is-ko{background:#FF8E8E!important;', '@keyframes runKo{'])
    assert.ok(s47.includes(part), part);
});

test('réf 8 — le tableau de résultat comme le labo de la vitrine', () => {
  assert.ok(fn('renderTable').includes('const bits=[`<span class="rm-n">${CHECK_SVG}${values.length} ligne${values.length>1?\'s\':\'\'}</span>`];'), '« ✓ 6 lignes »');
  for (const part of ['html.lq .table-scroll>.table-wrap{background:#fff!important;border:2px solid var(--line)!important;border-radius:18px!important;box-shadow:0 3px 0 var(--lip)!important}',
    'html.lq .table-scroll>.table-wrap thead th{background:#FBFAFF!important;color:#8E8AA8!important;font:700 11.5px/1.25 var(--mono)!important;',
    'html.lq .table-scroll>.table-wrap tbody td{font:600 13.5px/1.35 var(--ui);color:var(--ink);text-align:left;',
    'html.lq .table-scroll>.table-wrap tbody td.num{font:800 13.5px/1.35 var(--mono);color:var(--ink);text-align:right;',
    'html.lq .result-meta .rm-n{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:99px;background:#E3F6EC;color:#14955A;'])
    assert.ok(s47.includes(part), part);
  /* Les mêmes couleurs que la vitrine */
  const v = read('decouvrir/vitrine.css');
  assert.ok(v.includes('--ok:#14955A;--ok-soft:#E3F6EC;') && v.includes('.lb2-r.hd{height:26px;border-top:0;font:700 11.5px/1 var(--mono);color:#8E8AA8}'));
  assert.ok(css.includes('html.lq #scr-lesson .result-meta .rm-n{background:var(--accent-soft);color:var(--accent-ink)}'), 'dans un cours, la justesse se lit sur la carte Correct / Pas encore');
});

test('réf 9 — les tables d’un projet : ni autocollant, ni actions sur la ligne du nom ; dépliée, la description, les actions, les colonnes', () => {
  const w = cut('function renderDbWorkspace(){', 'function toggleTableSchema(name){');
  assert.ok(!w.includes('db-tico') && !w.includes("lqStkSvg('table')") && !w.includes('db-tnote-k'), 'aucun autocollant');
  const row = w.slice(w.indexOf('<div class="db-trow'), w.indexOf('${open?`<div class="db-tdetail">'));
  assert.ok(!row.includes('db-tacts') && !row.includes('${noteHtml}'), 'la ligne du nom ne porte ni actions ni description');
  const det = w.slice(w.indexOf('${open?`<div class="db-tdetail">'));
  assert.ok(det.indexOf('${noteHtml}') < det.indexOf('<span class="db-tacts">') && det.indexOf('<span class="db-tacts">') < det.indexOf('${colsHtml}'), 'description, actions, colonnes');
  assert.ok(css.includes(':is(.db-trow,.db-tdetail) .tb') && app.includes(':is(.db-trow,.db-tdetail) .tb{'), 'les boutons gardent leur style hors de la ligne');
  assert.ok(s47.includes('html.lq #scr-console .console-schema-panel .db-tdetail .tb:not(.reset-table):not(.drop-table){flex:1;'), 'SELECT en grand');
});

test('réf 10 — une croix en haut à droite : questions, saisies et import', () => {
  assert.equal((cut('function lqAsk(o){', 'function lqSavedLabel(').match(/<button type="button" class="lq-x lq-ask-x" aria-label="Fermer">\$\{LQ_X_SVG\}<\/button>/g) || []).length, 2, 'lqAsk et lqPrompt');
  assert.ok(fn('lqAsk').includes("const xb=el.querySelector('.lq-ask-x');if(xb)xb.onclick=()=>fin(false);"));
  assert.ok(fn('lqPrompt').includes("const xb=el.querySelector('.lq-ask-x');if(xb)xb.onclick=()=>fin(null);"), 'la croix annule la saisie');
  assert.ok(app.includes('<button type="button" class="lq-x imp-x" onclick="closeImportSheet()" aria-label="Fermer">'), 'l’import');
  assert.ok(s47.includes('html.lq .lq-x{position:absolute;z-index:3;top:12px;right:12px;width:40px;height:40px;'));
});

test('réf 12 et 13 — la journée libre a son autocollant ; « Démarrer la séance » a sa flèche', () => {
  const ctx = vm.createContext({ DEF_CHEV_SVG: '<svg></svg>' });
  vm.runInContext(fn('lqStkSvg') + fn('dayPauseHTML'), ctx);
  const libre = ctx.dayPauseHTML(false), passe = ctx.dayPauseHTML(true);
  assert.ok(libre.includes('<span class="dp-stk" aria-hidden="true"><svg class="lq-stk"') && libre.includes('class="stk-steam"') && !libre.includes('☕'), 'la tasse qui fume');
  assert.ok(passe.includes('class="stk-twk"') && !passe.includes('🌙'), 'la lune');
  assert.ok(app.includes('<i class="dp-go-arr" aria-hidden="true">${DP_GO_ARR_SVG}</i></button>'));
  for (const part of ['@keyframes dpSteam{', '@keyframes dpArrow{0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}}', 'html.lq .dp-pause .dp-stk{position:relative;display:block;width:78px;height:78px;'])
    assert.ok(s47.includes(part), part);
});

/* L’import : le lecteur de fichiers tourne ici comme dans l’app */
function formats() {
  const ctx = vm.createContext({ TextDecoder, Uint8Array, DataView, ArrayBuffer, Math, Date, String, Number, Array, Map, Set, Error, console });
  ctx.globalThis = ctx; ctx.window = ctx;
  vm.runInContext(read('import-formats.js'), ctx);
  return ctx.ImportFormats;
}
const F = formats();
const TXT = 'nom;ville;prix\nCafé crème;Évry;3,5\nThé à la menthe;Besançon;2\n';
const u16be = s => { const b = Buffer.from(s, 'utf16le'); for (let i = 0; i < b.length; i += 2) [b[i], b[i + 1]] = [b[i + 1], b[i]]; return b; };

test('import — l’encodage est détecté : UTF-8 (avec ou sans marque), UTF-16, Windows-1252, UTF-8 lu deux fois', () => {
  const cases = [
    ['UTF-8', Buffer.from(TXT, 'utf8')],
    ['UTF-8', Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(TXT, 'utf8')])],
    ['UTF-16', Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(TXT, 'utf16le')])],
    ['UTF-16', Buffer.from(TXT, 'utf16le')],
    ['UTF-16', Buffer.concat([Buffer.from([0xFE, 0xFF]), u16be(TXT)])],
    ['UTF-16', u16be(TXT)],
    ['Windows-1252', Buffer.from([...TXT].map(c => ({ é: 0xE9, è: 0xE8, É: 0xC9, à: 0xE0, ç: 0xE7, ê: 0xEA })[c] ?? c.charCodeAt(0)))],
  ];
  for (const [enc, b] of cases) {
    const r = F.detectEncoding(new Uint8Array(b));
    assert.equal(r.encoding, enc);
    assert.equal(r.text.replace(/^﻿/, ''), TXT, enc + ' : le texte est lu tel quel');
  }
  const twice = Buffer.from(new TextDecoder('windows-1252').decode(Buffer.from(TXT, 'utf8')), 'utf8');
  const r = F.detectEncoding(new Uint8Array(twice));
  assert.equal(r.text, TXT, '« CafÃ© » redevient « Café »'); assert.equal(r.repaired, true);
  assert.equal(F.repairMojibake('Prix : 12 €').repaired, false, 'un texte sain ne change pas');
  assert.equal(F.decodeText(new Uint8Array(Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('a;b', 'utf8')]))), 'a;b', 'la marque d’ordre ne reste pas dans le texte');
});

test('import — les colonnes : la ligne « sep=; » d’Excel, toutes les fins de ligne, les espaces autour des cellules', () => {
  assert.deepEqual(plain(F.parseDelimited('sep=;\r\nnom ; ville\r\nZoé ; Évry\r\n')), { delimiter: ';', delimiterName: 'point-virgule', rows: [['nom', 'ville'], ['Zoé', 'Évry']] });
  assert.deepEqual(plain(F.parseDelimited('a,b\r1,2\r3,4\r').rows), [['a', 'b'], ['1', '2'], ['3', '4']], 'fins de ligne des anciens Mac');
  assert.equal(F.detectDelimiter('sep=|\na|b,c\n1|2,3'), '|');
  assert.deepEqual(plain(F.parseDelimited('nom;prix\n"Café; moulu";12,5\nThé;3\n').rows), [['nom', 'prix'], ['Café; moulu', '12,5'], ['Thé', '3']], 'les guillemets protègent le séparateur');
});

test('import — bien formé : noms de colonnes propres, nombres à la française, dates en AAAA-MM-JJ ; la feuille dit ce qui a été détecté', () => {
  const ctx = vm.createContext({});
  vm.runInContext(cut('function safeIdent(', 'function u8ToB64(') + cut('function inferSqlType(', 'function extractSqlIdent('), ctx);
  const t = plain(ctx.tableFromMatrix(['Produit', 'Prix (€)', 'Date d’achat', 'Quantité', '2024'],
    [['Café', '1 234,50', '31/10/2026', '3', 'a'], ['Thé', '12,5', '01/02/2025 14:05', '4', 'b'], ['Lait', '1.234,5', '', '', 'c']]));
  assert.deepEqual(t.cols, ['produit', 'prix', 'date_d_achat', 'quantite', '_2024']);
  assert.deepEqual(t.types, ['TEXT', 'REAL', 'TEXT', 'INTEGER', 'TEXT']);
  assert.deepEqual(t.rows.map(r => r[1]), ['1234.50', '12.5', '1234.5'], 'milliers et virgule décimale');
  assert.deepEqual(t.rows.map(r => r[2]), ['2026-10-31', '2025-02-01 14:05', ''], 'dates JJ/MM/AAAA');
  assert.equal(t.dates, 1);
  assert.equal(ctx.frDateIso('31/02/2024'), null, 'une date impossible reste du texte');
  const mixed = plain(ctx.tableFromMatrix(['d'], [['31/10/2026'], ['bientôt']]));
  assert.deepEqual(mixed.rows, [['31/10/2026'], ['bientôt']], 'une colonne qui n’est pas faite que de dates ne change pas');
  const pf = fn('parseImportFile');
  assert.ok(pf.includes("const det=[fmt,encTxt,parsedCsv.delimiterName,") && pf.includes("hint:`${det} · ${plur(t.rows.length,'ligne')} · ${t.cols.join(', ')}`"));
  assert.ok(cut('async function parseImportBytes(name,bytes){', 'function isDatabaseImport(').includes('const enc=F&&F.detectEncoding?F.detectEncoding(bytes):'), 'l’encodage détecté passe à la feuille d’import');
});
