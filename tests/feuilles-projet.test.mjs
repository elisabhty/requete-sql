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

test('feuilles du bas : en-tête violet, autocollant, titre jaune et une ligne d’explication (Notes, Ajuster mon rythme)', () => {
  const cap = cut(app, 'function lqVizCap(id,stk,sub){', 'function openNotesHub(){');
  for (const part of ["head.classList.add('viz-cap'); sheet.classList.add('has-cap');", "b.replaceWith(t); t.appendChild(b);", "s.className='viz-cap-sub'",
    "k.innerHTML=String(stk).startsWith('<svg')?stk:lqStkSvg(stk);", "k.classList.add('is-in');"])
    assert.ok(cap.includes(part), part);
  assert.ok(cut(app, 'function openNotesHub(){', 'function onSearch(').includes("lqVizCap('note-sheet','note',nb?`${plur(nb,'note')} · tes idées et tes requêtes`:'Tes idées et tes requêtes, au même endroit.');"));
  assert.ok(cut(app, 'function openNote(id,pre){', 'function collectNote(){').includes("lqVizCap('note-sheet','pen',"));
  assert.ok(cut(app, 'function openPlanAdjust(trigger){', 'function togglePlanTools(){').includes("lqVizCap('plan-adjust-sheet',PL_STK_CAL,'Choisis un rythme confortable.');"));
  /* Le titre garde son élément : aria-labelledby et les textes mis à jour (Notes, Note, Nouvelle note) */
  assert.ok(app.includes('<b id="note-head">Nouvelle note</b>') && app.includes('<b id="plan-adjust-title" tabindex="-1">Ajuster mon rythme</b>'));
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
  assert.ok(cut(app, 'function saveNote(){', 'function togglePin(){').includes("lqSaved(b,'Enregistrée').then(()=>{backToNotesList();"), 'une note');
  assert.ok(cut(app, 'function applyPlanAdjustment(){', 'function planAdjustCommit(preview){').includes("lqSaved(btn,'Rythme appliqué').then(()=>planAdjustCommit(preview));"), 'le rythme');
  assert.ok(cut(app, 'async function editDbNote(id){', 'async function editTableNote(name){').includes("lqFresh(document.querySelector('#scr-console .console-desc'));"));
  assert.ok(cut(app, 'async function editTableNote(name){', 'function projectName(id){').includes('lqFresh(document.querySelector(`#db-tables .db-tblock[data-table="${CSS.escape(name)}"]`));'));
  for (const part of ['html.lq .lq-saved{position:relative;overflow:visible!important;pointer-events:none;background:var(--mint)!important;', 'html.lq .lq-saved .lq-saved-ico svg path{stroke-dasharray:23;animation:lqCheckDraw',
    '@keyframes lqFresh{0%{outline:3px solid rgba(255,200,61,.95);outline-offset:0}', 'html.lq .toast.on .tmini.ok svg{animation:lqCheckPop'])
    assert.ok(s39.includes(part), part);
});

test('épingler : la punaise en autocollant partout ; elle se plante en sautant, se décroche d’un bond', () => {
  const ctx = vm.createContext({});
  vm.runInContext(cut(app, 'function lqStkSvg(k){', '\n}\n') + '\n}\nthis.stk=lqStkSvg;', ctx);
  const pin = ctx.stk('pin');
  assert.ok(pin.includes('<rect x="15" y="5" width="18" height="7.5" rx="3.6" fill="#FF6B6B"') && pin.includes('stroke="#1B1640" stroke-width="3"'), 'une punaise corail, l’aiguille à l’encre');
  for (const part of ["if(glyph&&!glyph.querySelector('.lq-stk'))glyph.innerHTML=lqStkSvg('pin');", `data-pin-key="\${escAttr(consoleSqlKey(it.sql))}" onclick="toggleHistoryPin(\${i})"`,
    `onclick="unpinConsoleQuery(\${i})" aria-label="Désépingler cette requête" aria-pressed="true">\${lqStkSvg('pin')}</button>`, `togglePinFromList('\${n.id}')">\${lqStkSvg('pin')}</button>`,
    `<button class="sec ne-pin \${e.pin?'pin-on':''}"`, "lqPinFx(document.getElementById('console-pin-current'),idx<0);", 'lqPinFx(btn,e.pin);'])
    assert.ok(app.includes(part), part);
  /* lqPinFx : la classe de l’animation, les confettis seulement quand on épingle */
  const cls = new Set(); let bursts = 0;
  const b = { classList: { add: c => cls.add(c), remove: (...cs) => cs.forEach(c => cls.delete(c)) }, offsetWidth: 1, querySelector: () => ({}) };
  const f = vm.createContext({ prefersReduceMotion: () => false, lqBurst: () => { bursts++; }, buzz() {}, setTimeout() {}, clearTimeout() {} });
  vm.runInContext(cut(app, 'function lqPinFx(btn,on){', '\n}\n') + '\n}\nthis.fx=lqPinFx;', f);
  f.fx(b, true); assert.ok(cls.has('is-pin') && bursts === 1);
  f.fx(b, false); assert.ok(cls.has('is-unpin') && !cls.has('is-pin') && bursts === 1);
  for (const part of ['@keyframes lqPinPlant{', 'html.lq #scr-console .console-pin-current{position:relative;overflow:visible;display:flex;', 'border:2px solid var(--line)!important;border-radius:16px!important;background:#fff!important;box-shadow:0 4px 0 var(--lip)!important;',
    'html.lq #scr-console .console-pin-current.on{background:#FFF4D6!important;', 'html.lq #scr-console .console-query-pin.on svg{rotate:0deg;filter:none;opacity:1}',
    'html.lq .ncard.pin .npin-btn svg{rotate:0deg;filter:none;opacity:1}', 'html.lq .is-pin .lq-stk{animation:lqPinPlant', 'html.lq #scr-console .console-query-empty .console-query-stk{'])
    assert.ok(s39.includes(part), part);
});

test('tables d’un projet : le nom en entier, « 1 ligne » dessous, les actions groupées ; la description se dit « Description de la table »', () => {
  const w = cut(app, 'function renderDbWorkspace(){', 'function toggleTableSchema(name){');
  for (const part of ['<div class="db-tblock" data-table="${escAttr(t)}">', '<span class="db-tname"><span class="tn">${esc(t)}</span><span class="tc">${typeof n===\'number\'?plur(n,\'ligne\'):',
    '<span class="db-tacts">', '<i class="db-tnote-k" aria-hidden="true">${lqStkSvg(\'note\')}</i><span><small>Description de la table</small>${esc(note)}</span>',
    'aria-label="Description de ${escAttr(t)} : ${escAttr(note)}. Modifier"', '<span>Ajouter une description de la table</span>'])
    assert.ok(w.includes(part), part);
  assert.ok(!w.includes('lig.</span>\n          <span class="db-thint">'), 'plus de « 1 lig. » collé au nom');
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
