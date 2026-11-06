/* Elisa, 31 octobre, 0 h 19 (huit captures) : « bouton en haut à gauche trop proche du cadre » (la croix du lecteur et la carte de
   l’intro), « regarde la page note pour l’améliorer au niveau de la DA du site », « pareil » (Ajuster mon rythme), « la taille change
   en fonction de l’onglet : je veux que ce soit toujours la même taille d’écran », « micro-interaction quand on enregistre quelque chose,
   ici ou ailleurs », « améliorer le bouton d’épingle en fonction de la DA du site (ici ou ailleurs) », « ce n’est pas responsive, et on
   ne comprend pas c’est la description de quoi au niveau de la table », « pas assez d’espace entre les éléments (juste un petit peu) ». */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), coreCss = lire('assets/anim/core.css'), where = lire('assets/anim/where.html');
const cut = (src, a, b) => { const i = src.indexOf(a); assert.ok(i >= 0, a); const j = src.indexOf(b, i + a.length); assert.ok(j > i, b); return src.slice(i, j); };
const s39 = lq.slice(lq.indexOf('/* ---------- 39.'));

test('lecteur : la carte de l’intro descend sous la croix de fermeture (dans l’app seulement), dans les deux moteurs', () => {
  for (const [nom, src] of [['core.css', coreCss], ['where.html', where]]) assert.ok(src.includes('html.embed #s0.nv{translate:0 64px}'), nom);
  /* La croix : 44 px à 10 px du haut ; la carte : 170 px de la scène (1080 de large), plus 64, avec son liseré de 10 px. Sur un iPhone de
     375 px, il reste au moins 12 px entre les deux. */
  const k = 375 / 1080, haut = (170 + 64 - 10) * k, croix = 10 + 44;
  assert.ok(haut - croix >= 12, `écart : ${Math.round(haut - croix)} px`);
});

test('feuilles du bas : en-tête violet, autocollant, titre jaune et une ligne d’explication (Notes, Adapte ton rythme)', () => {
  const cap = cut(app, 'function lqVizCap(id,stk,sub){', 'function openNotesHub(){');
  for (const part of ["head.classList.add('viz-cap'); sheet.classList.add('has-cap');", "b.replaceWith(t); t.appendChild(b);", "s.className='viz-cap-sub'",
    "k.innerHTML=String(stk).startsWith('<svg')?stk:lqStkSvg(stk);", "k.classList.add('is-in');"])
    assert.ok(cap.includes(part), part);
  assert.ok(cut(app, 'function openNotesHub(){', 'function onSearch(').includes("lqVizCap('note-sheet','note',nb?`${plur(nb,'note')} · tes idées et tes requêtes`:'Tes idées et tes requêtes, au même endroit.');"));
  assert.ok(cut(app, 'function openNote(id,pre){', 'function collectNote(){').includes("lqVizCap('note-sheet','pen',"));
  assert.ok(cut(app, 'function openPlanAdjust(trigger){', 'function togglePlanTools(){').includes("lqVizCap('plan-adjust-sheet',PL_STK_CAL,'Un programme qui s’adapte à toi, pas l’inverse.');"), 'Elisa, 5 novembre, 12 h 12');
  /* Le titre garde son élément : aria-labelledby et les textes mis à jour (Notes, Note, Nouvelle note) */
  assert.ok(app.includes('<b id="note-head">Nouvelle note</b>') && app.includes('<b id="plan-adjust-title" tabindex="-1">Adapte ton rythme</b>'));
  for (const part of ['html.lq .viz-head.viz-cap{isolation:isolate;overflow:hidden;', 'background:var(--deep)!important;', 'html.lq .viz-cap-stk.is-in{animation:lqAskSlap',
    'html.lq .viz-head.viz-cap .viz-cap-t b{display:block;color:var(--sun-hi)!important;', 'html.lq .viz-cap-sub{display:block;', 'html.lq #plan-adjust-sheet.has-cap .pl-adjust-lead{display:none}'])
    assert.ok(s39.includes(part), part);
  /* Notes vides : l’autocollant et les trois amorces, aussi dans la feuille (avec la leçon ou la requête en cours) */
  assert.ok(app.includes(`<div class="notes-empty"><div class="ne-i is-stk" aria-hidden="true">\${lqStkSvg('note')}</div><b>Aucune note</b>`));
  assert.ok(cut(app, 'function startNoteHere(txt){', '\n}\n').includes("openNote(null,{ctx:currentContext(),sql,txt:txt||''});"));
  /* « Ton nouveau parcours » : la cible en autocollant, sur une fiche blanche */
  assert.ok(app.includes(`<span class="pl-impact-icon is-stk" aria-hidden="true">\${lqStkSvg('target')}</span>`));
  assert.ok(s39.includes('html.lq #plan-adjust-sheet .pl-adjust-impact{align-items:center;') && lq.includes('html.lq #plan-adjust-sheet .pl-impact-delta:not(.is-good):not(.is-warn){background:var(--accent-soft)}'));
});

test('toujours la même largeur d’écran : la place de la barre de défilement est gardée', () => {
  assert.ok(s39.includes('html.lq .screen,html.lq .viz-body{scrollbar-gutter:stable}'));
});

test('enregistrer : le bouton passe au menthe, la coche se dessine, des confettis ; puis la feuille descend et la chose s’allume', async () => {
  const src = cut(app, "const LQ_SAVED={", '/* Autocollants des feuilles');
  const btn = () => { const cls = new Set(), at = {}; return { cls, at, innerHTML: '', classList: { add: c => cls.add(c), remove: c => cls.delete(c) }, setAttribute: (k, v) => { at[k] = v; }, querySelector: () => ({}) }; };
  let bursts = 0, buzzes = [], delays = [], reduit = false;
  const ctx = vm.createContext({
    CHECK_SVG: '<svg ✓/>', esc: s => String(s), prefersReduceMotion: () => reduit, lqBurst: () => { bursts++; }, buzz: t => buzzes.push(t),
    setTimeout: (f, d) => { delays.push(d); f(); }, clearTimeout() {}, Promise,
  });
  vm.runInContext(src + ';this.saved=lqSaved;this.label=lqSavedLabel;this.fresh=lqFresh;', ctx);
  assert.equal(ctx.label('Enregistrer'), 'Enregistré'); assert.equal(ctx.label('Renommer'), 'Renommé'); assert.equal(ctx.label('OK'), 'OK');
  const b = btn();
  await ctx.saved(b, 'Enregistré');
  assert.ok(b.cls.has('lq-saved') && b.at['aria-disabled'] === 'true');
  assert.equal(b.innerHTML, '<span class="lq-saved-ico" aria-hidden="true"><svg ✓/></span><span>Enregistré</span>');
  assert.deepEqual([bursts, buzzes[0], delays[0]], [1, 'success', 560]);
  reduit = true; delays = []; const c = btn(); await ctx.saved(c, 'Rythme appliqué');
  assert.deepEqual([bursts, delays[0]], [1, 0], 'mouvement réduit : ni confettis ni attente');
  /* Partout où l’on enregistre */
  assert.ok(cut(app, 'function lqPrompt(o){', '/* On enregistre').includes("const ok=()=>{ if(fini||el._saving)return; el._saving=1; const v=input.value.replace(/\\s+$/,'').replace(/^\\s+/,''); lqSaved(el.querySelector('.lq-ask-oui'),lqSavedLabel(o.oui||'Enregistrer')).then(()=>fin(v)); };"), 'les feuilles à champ (descriptions, renommer)');
  assert.ok(cut(app, 'function saveNote(){', 'function togglePinFromList(id){').includes("lqSaved(b,'Enregistrée').then(()=>{\n      backToNotesList();"), 'une note');
  assert.ok(cut(app, 'function applyPlanAdjustment(){', 'function planAdjustCommit(preview){').includes("lqSaved(btn,'Rythme appliqué').then(()=>planAdjustCommit(preview));"), 'le rythme');
  assert.ok(cut(app, 'async function editDbNote(id){', 'async function editTableNote(name){').includes("lqFresh(document.querySelector('#scr-console .console-desc'));"));
  assert.ok(cut(app, 'async function editTableNote(name){', 'function projectName(id){').includes('lqFresh(document.querySelector(`#db-tables .db-tblock[data-table="${CSS.escape(name)}"]`));'));
  for (const part of ['html.lq .lq-saved{position:relative;overflow:visible!important;pointer-events:none;background:var(--mint)!important;', 'html.lq .lq-saved .lq-saved-ico svg path{stroke-dasharray:23;animation:lqCheckDraw',
    '@keyframes lqFresh{0%{outline:3px solid rgba(255,200,61,.95);outline-offset:0}', 'html.lq .toast.on .tmini.ok svg{animation:lqCheckPop'])
    assert.ok(s39.includes(part), part);
});

test('épingler : une punaise micro-animée partout, sans notification (Elisa, 4 novembre, 8 h 36 ; avant, 2 novembre, une coche ronde)', () => {
  assert.ok(app.includes(`const PUNAISE_SVG='<svg class="pin-pp" viewBox="0 0 48 48" aria-hidden="true"><ellipse class="pin-pp-trou"`), 'la punaise');
  for (const k of ['class="pin-pp-onde"', 'class="pin-pp-eclats"', 'class="pin-pp-corps"', 'class="pin-pp-aiguille"', 'class="pin-pp-tete"']) assert.ok(app.includes(k), k);
  assert.ok(!app.includes('PIN_CK') && !app.includes('class="pin-ck"'), 'plus de coche');
  for (const part of ["if(glyph&&!glyph.querySelector('.pin-pp'))glyph.innerHTML=PUNAISE_SVG;", `data-pin-key="\${escAttr(consoleSqlKey(it.sql))}" onclick="toggleHistoryPin(\${i})"`,
    `data-pin-key="\${escAttr(consoleSqlKey(it.sql))}" onclick="unpinConsoleQuery(\${i})" aria-label="Désépingler cette requête" aria-pressed="true">\${PUNAISE_SVG}</button>`, `togglePinFromList('\${n.id}')">\${PUNAISE_SVG}</button>`,
    "lqPinFx(document.getElementById('console-pin-current'),idx<0);"])
    assert.ok(app.includes(part), part);
  /* La note s’épingle depuis sa carte, plus depuis l’éditeur (Elisa, 2 novembre, 18 h 45 : « Il y a trop de bouton »). */
  assert.ok(!app.includes('class="sec ne-pin') && !app.includes('onclick="togglePin()"'), 'pas d’épingle dans l’éditeur de note');
  /* lqPinFx : la classe de l’animation, ni confettis ni étiquette */
  const cls = new Set(); let bursts = 0, done = 0;
  const b = { classList: { add: c => cls.add(c), remove: (...cs) => cs.forEach(c => cls.delete(c)) }, offsetWidth: 1, querySelector: () => ({}) };
  const f = vm.createContext({ prefersReduceMotion: () => false, lqBurst: () => { bursts++; }, lqDone: () => { done++; }, buzz() {}, setTimeout() {}, clearTimeout() {} });
  vm.runInContext(cut(app, 'function lqPinFx(btn,on){', '\n}\n') + '\n}\nthis.fx=lqPinFx;', f);
  f.fx(b, true); assert.ok(cls.has('is-pin') && bursts === 0 && done === 0);
  f.fx(b, false); assert.ok(cls.has('is-unpin') && !cls.has('is-pin'));
  /* Désépingler depuis la liste : la punaise se décroche sur place, la ligne s’efface ; plus de coche « Désépinglée » flottante */
  const un = cut(app, 'function unpinConsoleQuery(i){', 'function toggleHistoryPin(i){');
  assert.ok(!un.includes('lqDone(') && un.includes("lqSay('Requête désépinglée');") && un.includes('lqPinFx(btn,false);') && un.includes("row.classList.add('is-leaving');") && un.includes('if(btn&&btn._busy)return;'));
  for (const part of ['@keyframes pinPlante{', '@keyframes pinOnde{', '@keyframes pinEclat{', '@keyframes pinDecroche{',
    'html.lq .is-pin .pin-pp .pin-pp-corps{animation:pinPlante', 'html.lq .pin-pp .pin-pp-corps{transform-box:view-box;transform-origin:50% 87.5%;transform:rotate(-24deg)',
    'html.lq :is(.ncard.pin .npin-btn,.console-query-pin.on,.console-pin-current.on) .pin-pp :is(.pin-pp-tete,.pin-pp-base){fill:#FF6B6B;stroke:#1B1640}',
    'html.lq #scr-console .console-query-row.is-leaving{pointer-events:none;'])
    assert.ok(lq.includes(part), part);
  assert.ok(!lq.includes('.pin-ck'), 'la coche est partie de la feuille de style');
});

test('tables d’un projet : le nom en entier, « 1 ligne » dessous, les actions groupées ; la description se dit « Description »', () => {
  /* Depuis le 6 novembre, 7 h 52 (« reprendre exactement ce format dans base ») : la carte d’une table du schéma UML, à la couleur de
     la table (son nom, ses lignes dans une pastille, la flèche ronde ; l’aide vocale dit « Table clients, 27 lignes, 11 colonnes ») ;
     dépliée, ses colonnes, puis la description ou « Aucune description ajoutée » et « Décrire cette table », puis les actions. */
  const w = cut(app, 'function renderDbWorkspace(){', 'function toggleTableSchema(name){');
  for (const part of ['<div class="db-tblock tbu${open?\' is-open\':\'\'}" data-table="${escAttr(t)}" style="--c:${teinte[0]};--cs:${teinte[1]};--ci:${teinte[2]}">', "const lignes=typeof n==='number'?plur(n,'ligne'):",
    'aria-label="${escAttr(`Table ${t}, ${lignes}, ${plur(cols.length,\'colonne\')}`)}">', '<b class="tbu-n">${nom}</b><small class="tbu-k" aria-hidden="true">',
    '<div class="tbl-acts">', '<span class="tbl-desc-t"><small>Description</small>${esc(note)}</span>',
    'aria-label="Description de ${escAttr(t)} : ${escAttr(note)}. Modifier"', 'Aucune description ajoutée</p>', '<span>Décrire cette table</span>'])
    assert.ok(w.includes(part), part);
  assert.ok(!w.includes('db-thint'), 'plus d’indice « Colonnes › » collé au nom');
  for (const part of ['.db-tblock{container-type:inline-size;', '.db-trow{display:flex;flex-wrap:wrap;', '.db-trow .tn{display:block;margin:0;font:700 14.5px/1.25 var(--mono);color:var(--ink);white-space:normal;overflow-wrap:anywhere;',
    '@container (max-width:330px){', '.db-tacts{width:100%;justify-content:flex-end;', '.db-tnote small{display:block;margin-bottom:2px;color:var(--accent-ink);'])
    assert.ok(s39.includes(part), part);
  /* Un peu plus d’air sur la page d’un projet */
  for (const part of ['html.lq #scr-console .console-title-row.is-project{margin-bottom:16px}', 'html.lq #scr-console .console-project-tabs{margin-bottom:16px!important}',
    'html.lq #scr-console .console-schema-summary{margin-bottom:14px!important}', 'html.lq #scr-console .console-schema-panel{margin-bottom:22px!important;gap:14px!important}',
    'html.lq #scr-console .console-schema-panel .db-tables{gap:10px!important}'])
    assert.ok(s39.includes(part), part);
  assert.match(s39, /@media \(prefers-reduced-motion:reduce\)\{[^}]*html\.lq \.lq-saved,[^}]*\{animation:none!important\}/, 'mouvement réduit');
});
