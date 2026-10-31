/* Elisa, 31 octobre, 1 h 34 : neuf retours. Les boutons d’une note (responsive), la dernière phrase de la recherche des notes,
   la « coupure » de la barre Insérer, la salle de défi (plus d’entraînement libre, des points pour le premier et pour la rapidité,
   un chrono qui monte depuis 00:00, un podium de trois places), les minutes mal placées des modules, des micro-interactions au lieu
   des notifications, la description d’une table au-dessus de ses actions, les espacements de la console, une seule barre sous les
   tableaux, et la page d’un défi (DA, bouton retour). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
const s43 = css.slice(css.indexOf('/* ---------- 43.'));
const s42 = css.slice(css.indexOf('/* ---------- 42.'), css.indexOf('/* ---------- 43.'));
const fn = name => { const a = app.indexOf(`function ${name}(`); assert.ok(a > 0, name); return app.slice(a, app.indexOf('\n}', a) + 2); };
const line = name => { const a = app.indexOf(`function ${name}(`); assert.ok(a > 0, name); return app.slice(a, app.indexOf('\n', a)); };

test('ref 1 — les boutons d’une note : « Enregistrer » sur toute la ligne, « Épingler » et « Supprimer » côte à côte, sans coupure', () => {
  for (const part of ['html.lq .ne-row{flex-wrap:wrap}', 'html.lq .ne-row .prim{flex:1 1 100%!important}',
    'html.lq .ne-row .sec,html.lq .ne-row .del{flex:1 1 0!important;min-width:0;padding-left:12px!important;padding-right:12px!important;white-space:nowrap}'])
    assert.ok(s43.includes(part), part);
});

test('ref 2 — recherche sans résultat : la dernière phrase est retirée', () => {
  assert.ok(app.includes("<span>Rien pour « ${esc(searchQ)} » dans ${all.length>1?`tes ${all.length} notes`:'ta note'}.</span>"));
  assert.ok(!app.includes('Les accents et les majuscules ne comptent pas.'));
});

test('ref 3 — la barre Insérer ne coupe plus net sa dernière touche : le bord s’estompe là où il en reste', () => {
  const k = fn('kbarEdges');
  assert.ok(k.includes("box.classList.toggle('is-start',box.scrollLeft<=2);") && k.includes("box.classList.toggle('is-end',max<=2||box.scrollLeft>=max-2);"));
  assert.ok(app.includes("kin.addEventListener('scroll',kbarEdges,{passive:true});"), 'suit le défilement');
  assert.ok(app.includes('requestAnimationFrame(kbarEdges);'), 'après chaque remplissage de la barre');
  assert.ok(s43.includes('html.lq .kbar-in{padding-right:16px!important;') && s43.includes('html.lq .kbar-in.is-end.is-start{-webkit-mask-image:none;mask-image:none}'));
});

test('ref 4 — Défis : la salle seule, tirée au sort au niveau choisi ; ses règles de points', () => {
  assert.ok(app.includes('<div id="defis-room"></div>\n      <div id="defis-perf"></div>\n      <div id="defis-join" class="jeu"></div>\n      <div id="defis-rules"></div>'));
  assert.ok(app.includes('<div class="eyebrow">Salle de défi</div>'), 'plus « Entraînement »');
  for (const gone of ['function setDefisLevel(', 'function defiListRow(', 'id="defis-list"', 'id="defis-free"', 'def-list-static'])
    assert.ok(!app.includes(gone), 'retiré : ' + gone);
  const rules = fn('renderDefisRules');
  /* 17 h 39 : les paliers de temps, +25 du premier coup, le classement entre amis jusqu’au 4e */
  for (const part of ['<li class="room-rule-vite"><b>⏱️ Trouvé vite</b><span>jusqu’à ${top}</span><small>Plus tu trouves vite, plus le défi rapporte. La manche s’arrête à ${JEU_ROUND_MS/60000}&nbsp;min.</small>',
    '<li><b>✨ Du premier coup</b><span>+${JEU_PTS_ESSAI}</span><small>Ta première requête exécutée est la bonne</small></li>',
    '<li><b>🥇 Premier entre amis</b><span>+${JEU_PTS_RANG[0]}</span><small>2e : +${JEU_PTS_RANG[1]} · 3e : +${JEU_PTS_RANG[2]} · 4e : +${JEU_PTS_RANG[3]}</small></li>',
    '<small>Le plus rapide au total passe devant ; même temps : ex æquo</small>'])
    assert.ok(rules.includes(part), part);
  assert.ok(!rules.includes('Rapidité') && !rules.includes('moins toutes les'), 'plus de ligne « Rapidité » à part');
  assert.ok(app.includes(':`<button class="next-btn" onclick="openJeu()">Salle de défi →</button>`'), 'après un défi : vers la salle');
});

test('ref 4 — les points en paliers (17 h 39) : 200 → 50 selon le temps, +25 du premier coup, +50 / +30 / +20 / +10 ; le chrono en 00:00', () => {
  const ctx = vm.createContext({});
  vm.runInContext(['const JEU_ROUND_MS=600000;', 'const JEU_PALIERS=[[60,200],[120,175],[180,150],[240,125],[300,100],[420,75]],JEU_PTS_MIN=50,JEU_PTS_ESSAI=25,JEU_PTS_RANG=[50,30,20,10];', line('jeuChrono'), line('jeuValeur'), line('jeuPts')].join('\n'), ctx);
  assert.ok(app.includes('const JEU_ROUND_MS=600000;') && app.includes('const JEU_PALIERS=[[60,200],[120,175],[180,150],[240,125],[300,100],[420,75]],JEU_PTS_MIN=50,JEU_PTS_ESSAI=25,JEU_PTS_RANG=[50,30,20,10];'));
  const ev = c => JSON.parse(JSON.stringify(vm.runInContext(c, ctx)));
  assert.deepEqual(ev("[0,999,72000,179999].map(jeuChrono)"), ['00:00', '00:00', '01:12', '02:59']);
  assert.deepEqual(ev('[0,59000,60999,61000,120999,121000,180999,181000,240999,241000,300999,301000,420999,421000,599999].map(jeuValeur)'),
    [200, 200, 200, 175, 175, 150, 150, 125, 125, 100, 100, 75, 75, 50, 50], 'les paliers suivent le chrono affiché : 01:00 vaut encore 200, 01:01 vaut 175');
  assert.deepEqual(ev('jeuPts(72000,0,false,true)'), { val: 175, essai: 25, rang: 50, pts: 250 });
  assert.deepEqual(ev('jeuPts(30000,0,false,true)'), { val: 200, essai: 25, rang: 50, pts: 275 }, 'une manche parfaite entre amis : 275');
  assert.deepEqual(ev('jeuPts(30000,0,true,true)'), { val: 200, essai: 25, rang: 0, pts: 225 }, 'seul : 225 au plus');
  assert.deepEqual(ev('jeuPts(270000,0,true,false)'), { val: 100, essai: 0, rang: 0, pts: 100 }, '4 à 5 min : encore 100 points');
  assert.deepEqual(ev('[0,1,2,3,4].map(i=>jeuPts(91000,i,false).rang)'), [50, 30, 20, 10, 0], '5e : +0');
  /* Même temps, même place et même bonus ; à points égaux, le temps total départage */
  assert.ok(fn('jeuRanking').includes('return rows.map(([pid,ms])=>{const i=rows.findIndex(y=>y[1]===ms);return Object.assign({pid,ms,place:i+1},jeuPts(ms,i,J.solo||r.one,!!(r.first&&r.first[pid])));});'), 'seul dans la salle : pas de bonus de rang (retours de 16 h 29) ; le premier essai de chacun');
  assert.ok(fn('jeuScores').includes('.sort((a,b)=>b.pts-a.pts||a.ms-b.ms||a.name.localeCompare(b.name));'));
  assert.ok(fn('jeuScores').includes('J.order.forEach(p=>{if(!got.has(p))t[p]=(t[p]||0)+JEU_ROUND_MS;});'), 'une manche non trouvée compte 3 min');
  assert.ok(line('jeuPlaces').includes('if(i===0||x.pts<sc[i-1].pts||x.ms>sc[i-1].ms)place=i+1;'));
});

test('ref 4 — le chrono monte (sans barre de temps), le podium a trois marches', () => {
  const tick = fn('jeuTick');
  assert.ok(tick.includes('const took=Date.now()-J.rounds[n].t1;el.textContent=jeuChrono(took);'), 'le temps écoulé, pas le temps restant');
  /* Elisa, 31 octobre, 15 h 16, réf. 5 : « ne pas mettre la barre, laisse que le chrono » */
  assert.ok(!tick.includes('jeu-tbar') && !app.includes('<i class="jeu-tbar"'), 'plus de barre de temps');
  assert.ok(app.includes('id="jeu-timer" role="timer" aria-label="Chrono de la manche">${jeuChrono(took0)}</b>'));
  assert.ok(app.includes('`<div class="jeu-podium">${top.map((g,i)=>{const pl=[2,1,3][i];'), 'argent, or, bronze');
  assert.ok(app.includes("<em>${jeuChrono(x.ms)}</em><small>+${x.pts}</small>"), 'chaque ligne : le temps et les points gagnés');
  assert.ok(app.includes("<span class=\"jeu-rk\">${sl?'✓':(medal[x.place-1]||x.place)}</span>"), 'les ex æquo partagent la médaille');
  for (const part of ['html.lq .jeu-timer', 'html.lq .jeu-podium', 'html.lq .jeu-pd i'])
    assert.ok(s42.includes(part), part);
});

test('ref 9 — la page d’un défi : le bouton retour ouvre une vraie fenêtre, puis ramène aux Défis', () => {
  assert.ok(fn('goBack').includes("if(mode==='jeu'&&!jeuLeaveOk()){jeuLeaveAsk(goBack);return;}"));
  const ask = fn('jeuLeaveAsk');
  assert.ok(ask.includes('if(!q){suite();return;}') && ask.includes('lqAsk(q).then(ok=>{if(ok&&JEU===J){J.leaveOk=true;suite();}});'));
  const engine = app.slice(app.indexOf('/* ---------- Salle de défi : un défi tiré au sort'), app.indexOf('/* Le même défi, seul ou à plusieurs'));
  assert.ok(!engine.includes('confirm('), 'plus de confirm(), qui ne s’affiche pas partout');
  assert.ok(s42.includes('html.lq #scr-lesson .jeu-draw h1,html.lq #scr-lesson .jeu-draw .l-kicker + h1{color:var(--sun-hi)!important}'), 'le titre du tirage en jaune sur la scène violette');
});

test('ref 5 — les minutes d’un module suivent « Module 1 · en cours », sur leur ligne', () => {
  assert.ok(app.includes("<small class=\"lq-unit-k\">Module ${moduleIndex+1}${moduleIndex===curMod?' · en cours':''}${secs>=60?studyPill(secs,'home-module-time'):''}</small>"));
  assert.ok(s43.includes('html.lq #scr-learn .home-module-copy small.lq-unit-k{display:flex!important;flex-wrap:wrap;align-items:center;gap:4px 8px}'));
});

test('micro-interactions au lieu des notifications : l’action se voit là où elle a lieu', () => {
  for (const gone of ["toast('Requête ouverte dans l’éditeur'", "toast('Requête copiée'", "toast('Requête épinglée'", "toast('Requête désépinglée'",
    "toast(v?'Description enregistrée':'Description retirée'", "toast(`Table « ${name} » restaurée`", "toast('Table supprimée'", "toast('Historique effacé'",
    "toast('Projet renommé'", "toast('Base active · '", "toast(asDb?'Projet importé':'Table importée'", "toast('Planning décalé'",
    "toast(`Nouveau rythme appliqué", "toast('Prénom enregistré'", "toast('Note restaurée'", "toast(wasNew?'Note enregistrée':'Modifications enregistrées'",
    "toast(e.pin?'Note épinglée'", "toast(n.pin?'Note épinglée'"])
    assert.ok(!app.includes(gone), 'plus de notification : ' + gone);
  const done = fn('lqDone');
  assert.ok(done.includes('lqSay(say||label);') && done.includes('lqFresh(el);') && done.includes("buzz('success')") && done.includes('if(prefersReduceMotion())return;'));
  assert.ok(done.includes("c.className='lq-done';c.setAttribute('aria-hidden','true');"), 'la coche est décorative ; le lecteur d’écran entend lqSay');
  assert.ok(fn('lqSay').includes("s.setAttribute('role','status');s.setAttribute('aria-live','polite');"));
  assert.ok(fn('lqPlanDone').includes("'À jour'"));
  assert.ok(app.includes("lqDone(document.querySelector(`#db-tables .db-tblock[data-table=\"${CSS.escape(name)}\"]`),'Restaurée',"));
  /* Depuis le 31 octobre, 8 h 06, le prénom est un pseudo ; depuis 16 h 49, il est réservé une fois pour toutes : la feuille se
     ferme et le lecteur d’écran l’entend. */
  assert.ok(fn('psValider').includes("lqSay('Pseudo réservé : '+(r.pseudo||v));"));
  assert.ok(css.includes('.lq-say{position:absolute;width:1px;height:1px;') && css.includes('html.lq .lq-done{position:fixed;') && css.includes('@keyframes lqDone{'));
});

test('ref 6 — la description d’une table : seulement dépliée, au-dessus de SELECT, Restaurer et Supprimer', () => {
  const ws = fn('renderDbWorkspace');
  assert.ok(ws.includes("const noteHtml=!open?'':note?"), 'repliée : pas de description');
  assert.ok(ws.indexOf('${noteHtml}') > ws.indexOf('<span class="db-thint">') && ws.indexOf('${noteHtml}') < ws.indexOf('<span class="db-tacts">'), 'entre le nom et les actions');
  assert.ok(ws.indexOf('${noteHtml}') < ws.indexOf('${colsHtml}'), 'avant les colonnes');
  assert.ok(s43.includes('html.lq #scr-console .console-schema-panel .db-trow>.db-tnote{flex:1 1 100%;min-width:0;margin:2px 2px 2px 4px!important;animation:dbColIn'));
  assert.ok(ws.includes("<span class=\"tn\">${esc(t).replace(/_/g,'_<wbr>')}</span>"), 'un long nom passe à la ligne après un « _ »');
});

test('ref 7 — console : le même souffle entre schéma, exemples, éditeur, Exécuter, Épingler et résultat', () => {
  for (const part of ['html.lq #scr-console .console-schema-summary{margin-bottom:20px!important}', 'html.lq #scr-console .chips-wrap{margin-bottom:18px!important}',
    'html.lq #scr-console .console-editor-shell{margin-bottom:16px!important}', 'html.lq #scr-console .console-run-row{margin-bottom:15px!important}',
    'html.lq #scr-console .console-pin-current{margin-bottom:20px!important}'])
    assert.ok(s43.includes(part), part);
});

test('ref 8 — une seule barre sous un tableau : la native masquée, la barre de position se tire', () => {
  assert.ok(s43.includes('html.lq .table-scroll>.table-wrap{scrollbar-width:none!important}'));
  assert.ok(s43.includes('html.lq .table-scroll>.table-wrap::-webkit-scrollbar,html.lq.rq-sb .table-scroll>.table-wrap::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}'),
    'plus fort que les barres de curseur.js (html.rq-sb ::-webkit-scrollbar)');
  assert.ok(s43.includes('html.lq .table-pos{box-sizing:content-box;height:4px;padding:7px 0;margin:1px auto -6px;background-clip:content-box;cursor:grab;touch-action:none;'), 'une prise de 18 px pour le doigt');
  assert.ok(app.includes("shell.appendChild(pos);\n        tablePosDrag(shell,pos);"));
  /* Tirer la poignée jusqu’au bout fait défiler le tableau jusqu’au bout ; un appui à gauche le ramène au début */
  const on = {}, cls = new Set();
  const wrap = { scrollWidth: 519, clientWidth: 346, scrollLeft: 0 };
  const pos = { getBoundingClientRect: () => ({ left: 100, width: 64 }), addEventListener: (t, f) => { on[t] = f; }, setPointerCapture() {}, classList: { add: c => cls.add(c), remove: c => cls.delete(c) } };
  const ctx = vm.createContext({});
  vm.runInContext(fn('tablePosDrag'), ctx);
  ctx.tablePosDrag({ querySelector: () => wrap }, pos);
  const ev = x => ({ clientX: x, pointerId: 1, preventDefault() {} });
  on.pointerdown(ev(163)); assert.ok(cls.has('is-drag'));
  assert.equal(Math.round(wrap.scrollLeft), 173, 'au bout');
  on.pointermove(ev(130)); assert.ok(wrap.scrollLeft > 0 && wrap.scrollLeft < 173, 'au milieu');
  on.pointerup(); assert.ok(!cls.has('is-drag'));
  on.pointermove(ev(100)); assert.ok(wrap.scrollLeft > 0, 'relâché : ne suit plus');
  on.pointerdown(ev(101)); assert.equal(wrap.scrollLeft, 0, 'un appui à gauche : au début');
});

test('console : la première table créée retire « Ta base est vide » et montre ses exemples', () => {
  const run = app.slice(app.indexOf('function runConsole(){'), app.indexOf('function normalizeState(raw){'));
  assert.ok(run.includes('if(moved) renderConsoleChips();'));
  assert.ok(run.includes("if(touched()){ if(activeDbId!=='cours') persistCustomDbs(); renderDbWorkspace(); renderConsoleChips(); }"));
  const chips = fn('renderConsoleChips');
  assert.ok(chips.includes('if(empty)empty.hidden=false;') && chips.includes('{const empty=document.getElementById(\'console-empty\');if(empty)empty.hidden=true;}'));
});
