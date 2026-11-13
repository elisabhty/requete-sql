/* Elisa, 9 novembre, 10 h 37 : la relecture qu’elle a fait faire des écrans de fin (le chrono à 09:56 après une réussite, « Rejouer »
   et « Retenter ce défi » côte à côte, le bilan après un échec, « Manche 1/1 », « Niveau facile. »…), et ses notes :
   « Chrono arrête -> seulement en solo », « Pouvoir voir la correction et résultat finalement mais sur l’écran bilan qui ouvre une
   page en restant sur celle ci », « Faire passer les page a un niveau plus que prenium ». Ce qui change :
   1. seul, le chrono arrêté dit le temps mis (« 00:04 », une coche, au vert), ou « 00:00 » calme quand la manche finit au chrono ; à
      plusieurs, il continue ; la page d’un défi fait de même ;
   2. « Voir la correction » : une feuille qui monte par-dessus le bilan (la fin sur place d’une partie d’une manche, le podium entre
      amis) : une solution à copier, ce qu’elle renvoie, le raisonnement, ta requête acceptée ou ton dernier essai ; elle remplace
      « Retenter ce défi » ;
   3. le bilan : « Tout résolu ! », « Bien joué ! » ou « On retente ? », « Niveau facile » sans point, toujours les trois cases (« — »
      sans défi résolu), une manche ratée dans la pêche, la prochaine étape en carte, « Rejouer » ou « Réessayer », « Retour aux défis » ;
   4. « Défi solo » (ou « Manche unique » à plusieurs) plutôt que « Manche 1/1 » ; « Voir ma requête et son résultat » ; « Temps
      écoulé » plus court (« Tu te rattraperas à la prochaine manche. »).
   Elle avait dit à 10 h 01 de ne pas passer par le bilan pour une seule manche : la relecture proposait d’harmoniser, la fin sur
   place reste. Le déroulé, dans salle-defis.test.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), mps = lire('multiplayer-security.js'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => cut(`function ${name}(`, '\n}\n') + '\n}\n';
const line = name => cut(`function ${name}(`, '\n') + '\n';

test('seul, le chrono arrêté dit le temps mis ; fini au chrono, 00:00 calme ; à plusieurs, il continue', () => {
  const ctx = vm.createContext({ Date: { now: () => 100_000 } });
  vm.runInContext(line('jeuChrono') + line('jeuRebours') + line('jeuDureeLisible') + line('jeuFermeeAuChrono') + fn('jeuChronoEtat') + fn('jeuChronoPose')
    + `var JEU_NIV_MANCHE={f:600000,m:900000,d:1200000},seul=true,fini=false,JEU;function jeuDureeMs(k){return JEU_NIV_MANCHE[k]||600000;}function jeuNivManche(){return 'f';}
       function jeuSoloLike(){return seul;}function jeuRoundDone(){return fini;}function jeuFige(n){return JEU.rounds[n].found[JEU.me]!=null&&seul;}`, ctx);
  ctx.JEU = { me: 'a', rounds: [{ t1: 96_000, found: { a: 4_200 } }] };
  assert.deepEqual({ ...ctx.jeuChronoEtat(0) }, { k: 'is-ok', t: '00:04', l: 'Résolu en 4 s' }, 'seul, trouvée : le temps mis, plus ce qui restait (09:56)');
  ctx.seul = false;
  assert.deepEqual({ ...ctx.jeuChronoEtat(0) }, { k: '', t: '09:56', l: 'Temps restant de la manche' }, 'à plusieurs : le chrono continue');
  ctx.seul = true; ctx.fini = true; ctx.JEU.rounds[0].found = {};
  assert.deepEqual({ ...ctx.jeuChronoEtat(0) }, { k: 'is-fin', t: '00:00', l: 'Temps écoulé' }, 'seul, fini au chrono : 00:00, sans battre');
  /* Posé sur l’élément : le texte, une seule classe d’état, son nom pour le lecteur d’écran */
  const cls = new Set(['jeu-timer', 'is-low']), attrs = {};
  const el = { textContent: '04:12', classList: { add: k => cls.add(k), remove: k => cls.delete(k) }, getAttribute: k => attrs[k], setAttribute: (k, v) => { attrs[k] = v; } };
  ctx.jeuChronoPose(el, { k: 'is-ok', t: '00:04', l: 'Résolu en 4 s' });
  assert.deepEqual([el.textContent, [...cls].sort(), attrs['aria-label']], ['00:04', ['is-ok', 'jeu-timer'], 'Résolu en 4 s']);
  /* La manche, la barre collée, la page d’un défi */
  assert.ok(fn('jeuTick').includes("if(el&&n>=0&&(jeuFige(n)||(jeuSoloLike(n)&&jeuRoundDone(n))))jeuChronoPose(el,jeuChronoEtat(n));"));
  assert.ok(app.includes("mt.classList.toggle('is-fin',t.classList.contains('is-fin'));"), 'la barre collée recopie aussi « fini »');
  assert.ok(fn('runLesson').includes("if(ms!=null)jeuChronoPose(document.getElementById('defi-timer'),{k:'is-ok',t:jeuChrono(ms),l:`Résolu en ${jeuDureeLisible(ms)}`});"), 'la page d’un défi : le temps mis');
  assert.ok(fn('defiChronoStart').includes("jeuChronoPose(el,{k:'is-fin',t:'00:00',l:'Temps écoulé'});defiTempsEcoule(c);"));
  /* La coche à la place du réveil, la pêche du « Temps écoulé » */
  assert.ok(lq.includes("html.lq .jeu-timer.is-ok::before{\n  -webkit-mask-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 12.6l4.4 4.4L19 7.4'"));
  assert.ok(lq.includes('html.lq .jeu-timer.is-fin{background:#FFE9DC!important;color:#A24A1E!important;box-shadow:0 3px 0 #F4C4A6;animation:none!important}'));
});

test('« Défi solo » ou « Manche unique » plutôt que « Manche 1/1 »', () => {
  const ctx = vm.createContext({ JEU: { nb: 1 } });
  vm.runInContext(line('jeuMancheNom'), ctx);
  assert.equal(ctx.jeuMancheNom(0, true), 'Défi solo');
  assert.equal(ctx.jeuMancheNom(0, false), 'Manche unique');
  ctx.JEU.nb = 3;
  assert.equal(ctx.jeuMancheNom(1, true), 'Manche 2/3');
  const play = cut("}else if(v.startsWith('play')){", "}else if(v.startsWith('res')){");
  assert.ok(play.includes('<b class="jeu-hud-m">${J.nb===1?jeuMancheNom(n,sl):`Manche ${n+1}<small>/${J.nb}</small>`}</b>') && play.includes("${J.nb===1?jeuColleeHTML(jeuMancheNom(n,sl),'',!mine&&!rate)"));
  assert.ok(app.includes('<p class="l-kicker">${jeuMancheNom(0,true)} · ${JEU_NIVL[J.niv]}</p>') && app.includes('<p class="l-kicker">${jeuMancheNom(n,jeuSoloLike(n))} · ${JEU_NIVL[c.niv]}</p>'), 'le tirage aussi');
  assert.ok(app.includes("if(k)k.textContent=`${jeuMancheNom(n,true)} · ${JEU_NIVL[c.niv]}`;"), 'la scène d’attente qui devient le tirage');
});

test('la correction : une solution mise en lignes et à copier, ce qu’elle renvoie, le raisonnement, ta requête ou ton dernier essai', () => {
  const ctx = vm.createContext({
    JEU: { me: 'a', nb: 2, solo: true, rounds: [] }, JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' }, DEF_CHEV_SVG: '›', JEU_ICO: { check: '<ok>', reveil: '<reveil>' },
    esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), highlight: s => `«${s}»`, lqStkSvg: k => `<stk ${k}>`, sqlCopyBtn: () => '<copier>',
    defiAttenduHTML: () => '<div class="result-meta"><span class="rm-n">2 lignes</span></div>\n  <div class="table-scroll">TABLE</div>',
    jeuSoloLike: () => true, jeuFermeeAuChrono: () => false
  });
  vm.runInContext(line('dxBarres') + line('dxPc') + line('dxPcNiv') + line('escCode') + line('jeuDureeLisible') + fn('sqlEnLignes') + fn('jeuCorrHTML') + fn('jeuCorrBoutonHTML'), ctx);
  const c = { id: 'x1', niv: 'f', titre: 'Les vols « retardés »', sol: "SELECT a, COUNT(*) AS n FROM vols v JOIN x ON x.id=v.id WHERE s = 'Retardé FROM' GROUP BY a ORDER BY n DESC;", indice: 'Compte avec `COUNT(*)`.' };
  ctx.CHALLENGES = [c];
  const ok = ctx.jeuCorrHTML({ cid: 'x1', found: { a: 4200 }, sql: 'select a from vols' }, c, 1);
  assert.ok(ok.includes('<p class="room-kicker">Correction · manche 2</p>') && ok.includes('<h2 id="dx-f-t">Les vols « retardés »</h2>'));
  assert.ok(ok.includes('<p class="room-sub dx-f-pcs" id="dx-f-p"><span class="dx-pc is-niv is-f is-blanc">') && ok.includes('<span class="dx-pc is-ok"><ok><span>Résolu en 4 s</span></span>'), 'le niveau, ce qui s’est passé');
  assert.ok(ok.includes("<div class=\"sql-copy-wrap\"><div class=\"ex-code\">«SELECT a, COUNT(*) AS n\nFROM vols v\nJOIN x ON x.id=v.id\nWHERE s = 'Retardé FROM'\nGROUP BY a\nORDER BY n DESC;»</div><copier></div>"), 'une clause par ligne, hors des chaînes ; à copier');
  assert.ok(ok.includes('D’autres requêtes peuvent donner le même résultat&nbsp;: c’est lui qui compte.'), 'une solution, pas la seule');
  assert.ok(ok.includes('<section class="jc-sec is-res"><div class="jc-h"><b>Ce qu’elle renvoie</b><div class="result-meta"><span class="rm-n">2 lignes</span></div></div>\n  <div class="table-scroll">TABLE</div></section>'), 'le nombre de lignes sur la ligne du titre');
  assert.ok(ok.includes('<p class="jc-p">Compte avec <code>COUNT(*)</code>.</p>'), 'le raisonnement : la piste du défi');
  assert.ok(ok.includes('<b>Ta requête</b><span class="jc-chip is-ok">Acceptée</span></div><div class="ex-code">«select a\nfrom vols»</div>'), 'ta requête, acceptée');
  assert.ok(ok.includes('<button type="button" class="room-go" onclick="defisFeuilleFermer()"><span>J’ai compris</span>›</button>'));
  const rate = ctx.jeuCorrHTML({ cid: 'x1', found: {}, essai: 'SELECT * FROM vols' }, c, 0);
  assert.ok(rate.includes('<span class="dx-pc is-to"><reveil><span>Temps écoulé</span></span>') && rate.includes('<b>Ton dernier essai</b></div><div class="ex-code">«SELECT *\nFROM vols»</div>') && !rate.includes('Ta requête'));
  assert.ok(!ctx.jeuCorrHTML({ cid: 'x1', found: {} }, c, 0).includes('jc-sec is-essai'), 'sans essai, rien');
  ctx.JEU.nb = 1;
  assert.ok(ctx.jeuCorrHTML({ cid: 'x1', found: {} }, c, 0).includes('<p class="room-kicker">La correction</p>'));
  ctx.JEU.rounds = [{ cid: 'x1', found: {} }];
  assert.equal(ctx.jeuCorrBoutonHTML(0), '<button type="button" class="jr-corr" onclick="jeuCorrection(0)" aria-label="Voir la correction : Les vols « retardés »"><span>Voir la correction</span>›</button>');
  /* Une requête déjà mise en lignes reste telle quelle */
  assert.equal(ctx.sqlEnLignes('SELECT a\nFROM b'), 'SELECT a\nFROM b');
  assert.equal(ctx.sqlEnLignes('WITH t AS (SELECT a FROM b) SELECT * FROM t UNION ALL SELECT 1'), 'WITH t AS (SELECT a FROM b)\nSELECT *\nFROM t\nUNION ALL\nSELECT 1', 'pas dans les parenthèses');
});

test('la feuille monte par-dessus l’écran, qui reste dessous ; elle se referme sans toucher à l’écran Défis ni à la salle', () => {
  const o = fn('jeuCorrection');
  assert.ok(o.includes("el.dataset.k='corr';") && o.includes('<div class="dx-f-boite" role="dialog" aria-modal="true" aria-labelledby="dx-f-t" aria-describedby="dx-f-p" tabindex="-1">'), 'la feuille des Défis');
  assert.ok(o.includes("document.addEventListener('keydown',dxFeuilleTouche,true);"), 'Échap la referme, Tab y reste');
  assert.ok(o.includes("dxFeuilleRetour=a&&a!==document.body&&a.closest&&a.closest('#jeu-root')?a:null;"), 'le focus revient au bouton');
  assert.ok(o.includes("if(typeof bindTableSwipe==='function')bindTableSwipe(el);"), 'le tableau se fait glisser');
  const f = fn('defisFeuilleFermer');
  assert.ok(f.includes("document.getElementById('dx-feuille').dataset.k==='corr';") && f.indexOf('if(!corr){') < f.indexOf("DEFIS.carte='';") && f.indexOf("jeuStop();") < f.indexOf('  }\n  if(typeof document'), 'ni la carte de l’écran Défis, ni l’invitation, ni la salle');
  /* Une autre vue (une autre partie, une autre manche), ou la salle quittée : elle se referme */
  assert.ok(fn('jeuRender').includes("if(v!=='final')jeuCorrFermer();"));
  assert.ok(fn('jeuStop').includes('  JEU=null;\n  document.getElementById(\'jeu-toasts\')?.remove();\n  jeuCorrFermer();'));
  const ferme = [];
  const ctx = vm.createContext({ document: { getElementById: () => ({ dataset: { k: 'corr' } }) }, defisFeuilleFermer: x => ferme.push(x) });
  vm.runInContext(fn('jeuCorrFermer'), ctx);
  ctx.jeuCorrFermer(); assert.deepEqual(ferme, [true]);
  ctx.document.getElementById = () => ({ dataset: { k: 'code' } }); ctx.jeuCorrFermer(); assert.deepEqual(ferme, [true], 'la feuille du code reste');
  /* Où on l’ouvre : sur l’écran de fin seulement (11 h 31 : « pas directement sur le défi ») ; plus « Retenter ce défi » nulle part */
  assert.ok(cut("}else if(v==='final'){", '/* Fondu enchaîné').includes('${jeuCorrBoutonHTML(k)}</div>'));
  assert.ok(!fn('jeuFoundHTML').includes('jeuCorrBoutonHTML') && !fn('jeuRateHTML').includes('jeuCorrBoutonHTML'), 'jamais sur la carte du défi');
  assert.equal((app.match(/jeuCorrBoutonHTML\(/g) || []).length, 2, 'sa définition et l’écran de fin');
  assert.ok(cut("}else if(v==='final'){", '/* Fondu enchaîné').includes('${jeuCorrListeHTML()}'), 'entre amis, sous le classement');
  assert.ok(!/Retenter ce défi<\/span>/.test(app), 'plus de « Retenter ce défi »');
  /* Ta requête et ton dernier essai, gardés : en salle, et en salle classée (la réponse vient du serveur) */
  assert.ok(fn('jeuRun').includes('r.tries=(r.tries||0)+1;r.essai=sql;') && fn('jeuRun').includes('r.sql=sql;'));
  assert.ok(mps.includes('round.sql = sql;') && mps.includes("round.mine = `<div class=\"ex-code\">${highlight(sql)}</div>${renderTable(execChallengeResult(base, sql))}`;") && mps.includes('round.essai = sql;'));
  /* Pendant la partie, la requête reste cachée : le dernier indice le dit */
  assert.ok(app.includes("${room?'C’était le dernier indice. La correction t’attend à la fin de la partie\\u00a0: d’ici là, à toi de trouver.':'C’était le dernier indice. La requête ne sera pas dévoilée : à toi de la trouver.'}"));
});

test('le bilan : le titre dit l’issue, les trois cases, une manche ratée dans la pêche, la prochaine étape, « Réessayer »', () => {
  const fin = cut("}else if(v==='final'){", '/* Fondu enchaîné');
  assert.ok(fin.includes("const titre=all?(trophee?'Carton plein\\u00a0!':'Carton plein ! 🏆'):nOk?'Bien joué\\u00a0!':'Pas encore cette fois\\u00a0!';"));
  assert.ok(fin.includes("head(`Fin de la partie · ${JEU_NIVL[J.niv]}`,titre,sous)"), '« Niveau facile », sans point');
  assert.ok(fin.includes("<div><b>${nOk?dur(got.reduce((a,x)=>a+x.ms,0)/nOk):'—'}</b><small>${un?'ton temps':'temps moyen'}</small></div></div>`;"), '« — » sans défi résolu');
  assert.ok(fin.includes("<span class=\"jr-ico\" aria-hidden=\"true\">${ok?ICO_OK:ab?ICO_KO:JEU_ICO.reveil}</span>"), 'le réveil pour le chrono, la croix pour une manche quittée');
  const ctx = vm.createContext({ JEU: { solo: true, niv: 'm' }, JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' }, JEU_NIV_X: { f: 1, m: 2, d: 4 }, JEU_COIN_SVG: '<coin>', DEF_CHEV_SVG: '›',
    jeuNivBars: k => `[${k}]`, jeuBtn2: (i, l, o) => `[${i}|${l}|${o}]` });
  vm.runInContext(fn('jeuFinBoutonsHTML'), ctx);
  assert.ok(ctx.jeuFinBoutonsHTML(2, true).startsWith('<div class="jeu-fin-actions"><button type="button" class="jeu-prog is-d" onclick="jeuNiveauSuivant()">') && ctx.jeuFinBoutonsHTML(2, true).includes('<span class="jeu-prog-t">Passer au niveau difficile</span><span class="jeu-prog-x">×4<span class="lq-sr"> points par défi</span></span>'));
  assert.ok(ctx.jeuFinBoutonsHTML(0, false).includes('<span>Réessayer</span>') && ctx.jeuFinBoutonsHTML(0, false).includes('[classement|Voir mon classement|jeuVersClassement()]'));
  /* Le style : la pêche, la pastille à 44 px de toucher, la carte de la prochaine étape, les trois cases */
  for (const k of ['html.lq #app .jeu-rounds .jr.is-miss{border-style:solid;border-color:#FFDCC8;background:#FFF9F5;', 'html.lq #app .jr.is-miss .jr-ico{background:#FFE1D1;color:#A24A1E;',
    'html.lq #app .jr-corr::after{content:"";position:absolute;inset:-9px -6px}', 'html.lq #app .jeu-prog{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:44px;',
    'html.lq #app .jeu-prog.is-d{color:#A3262E}', 'html.lq .consigne.dq .dq-sec.is-garde{background:#F1F8FF}', 'html.lq #app .jeu-bilan{grid-template-columns:repeat(3,minmax(0,1fr))}',
    'html.lq #app .jcl-b{display:flex;align-items:center;gap:10px;width:100%;'])
    assert.ok(lq.includes(k), k);
});

test('la feuille de style : le jeu avant le bloc des Défis, la feuille de la correction dans la feuille des Défis ; les versions', () => {
  const jeu = lq.indexOf('9 novembre, 10 h 37 (Elisa, la relecture'), defis = lq.indexOf('Défis — la refonte du 7 novembre'), feuille = lq.indexOf('/* La feuille de la correction : l’en-tête violet');
  assert.ok(jeu > 0 && jeu < defis && feuille > defis, 'les règles des Défis restent limitées à leurs pages (retours-2144-defis)');
  for (const k of ['html.lq .dx-feuille .jc-sec.is-sol{background:var(--accent-soft)}', 'html.lq .dx-feuille .jc-sec.is-moi{background:#EAF8F0}', 'html.lq .dx-feuille .jc-sec.is-essai{background:#FFF1E8}',
    'html.lq .dx-feuille .dx-pc.is-ok{background:var(--mint);color:#0E4A2E;', 'html.lq .dx-feuille .jc-h>.result-meta{flex:none;margin:0;padding:0}'])
    assert.ok(lq.indexOf(k) > feuille, k);
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-13-carte-v2965';") && app.includes("const SW_CACHE='requete-2026-11-13-carte-v2965';"));
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=346">') && app.includes('<script src="multiplayer-security.js?v=10"></script>') && sw.includes("'./multiplayer-security.js?v=10',"));
});

/* 11 h 53 (Elisa) : « Rejouer » garde la même salle ; « Passer au niveau moyen » ramène à l’écran Défis, le niveau suivant déjà choisi ;
   au niveau Difficile, seulement « Rejouer ». */
test('11 h 53 : le niveau suivant ramène à l’écran Défis, déjà choisi ; « Rejouer » garde la salle ; rien au-dessus du Difficile', () => {
  const ouverts = [], prefs = [];
  const ctx = vm.createContext({ JEU: { niv: 'f', nb: 2 }, jeuNiv: 'f', jeuNivUser: false, jeuNb: 1, DEFIS: { onglet: 'classement', carte: 'seul' },
    jeuSavePrefs: () => prefs.push(1), openJeu: c => ouverts.push(c === undefined ? 'défis' : c), jeuStart: () => { throw Error('pas de partie lancée'); } });
  vm.runInContext(fn('jeuNiveauSuivant'), ctx);
  ctx.jeuNiveauSuivant();
  assert.deepEqual([ctx.jeuNiv, ctx.jeuNivUser, ctx.jeuNb, ctx.DEFIS.onglet, ctx.DEFIS.carte, ouverts, prefs.length], ['m', true, 2, 'jouer', '', ['défis'], 1]);
  ctx.JEU.niv = 'm'; ctx.jeuNiveauSuivant(); assert.equal(ctx.jeuNiv, 'd');
  const b = vm.createContext({ JEU: { solo: true, niv: 'd' }, JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' }, JEU_NIV_X: { f: 1, m: 2, d: 4 }, DEF_CHEV_SVG: '›', jeuNivBars: k => k, jeuBtn2: (i, l) => `[${l}]` });
  vm.runInContext(fn('jeuFinBoutonsHTML'), b);
  assert.ok(!b.jeuFinBoutonsHTML(2, true).includes('jeu-prog') && b.jeuFinBoutonsHTML(2, true).includes('<span>Rejouer</span>'), 'Difficile : « Rejouer » seulement');
  assert.ok(line('jeuRejouer').includes('if(J.over)return jeuAgain();') && fn('jeuAgain').includes("jeuSend({t:'again',g:J.g+1});"), '« Rejouer » : une nouvelle partie dans la même salle');
});

/* 11 h 57 (Elisa) : « Retour aux défis » devient « Voir mon classement » ; « ne pas tout mettre en vert, mettre des pills ou pointillé ». */
test('11 h 57 : « Voir mon classement », et le bilan en pastilles : le vert à la coche seulement', () => {
  assert.ok(fn('jeuFinBoutonsHTML').includes("jeuBtn2('classement','Voir mon classement','jeuVersClassement()')") && !app.includes("'Retour aux défis'"));
  const v = fn('jeuVersClassement');
  assert.ok(v.includes("DEFIS.onglet='classement';DEFIS.carte='';") && v.includes("leaveLessonScreen('defis');") && v.includes('jeuLeaveAsk(jeuVersClassement)'));
  const fin = cut("}else if(v==='final'){", '/* Fondu enchaîné');
  /* 12 h 04 (« les points à droite ») : sur la ligne de « Manche 1 », à droite ; le titre garde toute la largeur */
  assert.ok(fin.includes('<span class="jr-top"><small class="jr-n">Manche ${i+1}</small>${pt}</span>') && fin.includes('${jeuCorrBoutonHTML(k)}</div></li>`;'), 'les points à droite de « Manche 1 »');
  assert.ok(lq.includes('html.lq #app .jr-top{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:26px}'));
  for (const k of ['html.lq #app .jr-meta .jeu-pd{display:contents!important}', 'html.lq #app .jr-meta .jeu-pd i:not([class]){display:none!important}',
    'html.lq #app .jr-pts{align-items:center;gap:3px;height:24px;margin:0;padding:0 9px;box-sizing:border-box;border-radius:99px;background:var(--sun);',
    'html.lq #app .jeu-rounds .jr-t>.jr-corr::before{content:"";position:absolute;left:-2px;right:-200px;top:-12px;border-top:2px dashed #E4DFF5;'])
    assert.ok(lq.includes(k), k);
});

/* 12 h 09 (Elisa) : « Les flèches de Voir la correction sont animées ? Un peu d’espace avant Voir la correction. » */
test('12 h 09 : la flèche de « Voir la correction » avance de temps en temps (rien en mouvement réduit) ; plus d’air au-dessus', () => {
  for (const k of ['html.lq #app .jr-t>.jr-corr{margin-top:22px}', 'html.lq #app .jr-corr>svg{animation:jrCorrPas 2.8s ease-in-out 1.2s infinite}',
    '@keyframes jrCorrPas{', '@media (prefers-reduced-motion:reduce){html.lq #app .jr-corr>svg{animation:none}}', 'html[data-motion="reduce"].lq #app .jr-corr>svg{animation:none}'])
    assert.ok(lq.includes(k), k);
});

/* 12 h 17 (Elisa) : à la place de « Niveau facile », une phrase selon l’issue ; « Tu progresses à chaque défi ! » quand c’est mieux
   qu’avant ; « Ton récap’ » à la place de « Manche par manche ». */
test('12 h 17 : « Carton plein ! », « Bien joué ! », « Pas encore cette fois ! », leur phrase ; « Tu progresses » si mieux qu’avant ; « Ton récap’ »', () => {
  const fin = cut("}else if(v==='final'){", '/* Fondu enchaîné');
  assert.ok(fin.includes("const sous=nOk?`${nT} manche${nT>1?'s':''}, ${nOk} victoire${nOk>1?'s':''}\\u00a0!`:`${typeof accord==='function'?accord('Prête','Prêt','Prêt·e'):'Prêt·e'} à retenter ta chance\\u00a0?`;"));
  assert.ok(fin.includes('const progres=J.mieux?`<p class="jeu-progres">') && fin.includes('Tu progresses à chaque défi\\u00a0!</p>`') && fin.includes('<p class="jeu-card-h">Ton récap’</p>'));
  const c = fn('jeuCreditGame');
  assert.ok(c.includes('{const av=(Array.isArray(s.hist)?s.hist:[]).find(h=>h&&h.niv===k&&h.solo===(vs?0:1));J.mieux=!!av&&pts>(+av.pts||0);}') && c.indexOf('J.mieux=') < c.indexOf('s.hist=['), 'comparée à la partie d’avant, avant d’ajouter celle-ci');
  assert.ok(lq.includes('html.lq #jeu-root>.jeu-progres{display:flex;width:fit-content;align-items:center;gap:7px;'));
});

/* 12 h 28 (Elisa) : « un mini doigt qui s’anime » sur « Schéma » ; « tout doit se passer dans le cadre du haut », jamais un message
   sous l’éditeur. */
test('12 h 28 : le doigt qui tapote sur « Schéma » ; les messages de la vérification dans la carte, rien sous l’éditeur', () => {
  assert.ok(app.includes("${schAttn()?'<i class=\"sch-doigt\" aria-hidden=\"true\">👆</i>':''}</button>"));
  for (const k of ['html.lq .ed-schema .sch-doigt{position:absolute;left:50%;top:100%;', 'html.lq .ed-schema:not(.sch-attn) .sch-doigt{display:none}', '@keyframes schDoigt{',
    '@media (prefers-reduced-motion:reduce){html.lq .ed-schema .sch-doigt{animation:none}}'])
    assert.ok(lq.includes(k), k);
  assert.ok(mps.includes("if (typeof coachKo === 'function' && typeof COACH !== 'undefined' && COACH) { setLessonOut(''); coachKo(esc(msg)); }"), 'salle classée : la vérification indisponible ou trop lente se dit dans la carte');
  assert.ok(fn('runLesson').includes("if(isDefi&&(!COACH||COACH.c!==current)&&document.getElementById('hint-slot'))coachReset(current,'solo');"), 'la page d’un défi : la carte revient s’il le faut');
});

/* 9 novembre, 15 h 18 (Elisa : « oui, attendre la fin de la manche ») */
test('15 h 18 : la flamme du jour pendant une salle : plus de notification depuis le 11 novembre (21 h 33), la page à l’accueil', () => {
  assert.ok(!app.includes('function lqStreakToast('));
});

/* 9 novembre, 17 h 09 (Elisa : « je pense que ça saute quand ça passe du moteur jusqu’au cadre ») */
test('17 h 09 : de l’éditeur à « Bravo, défi résolu ! », la hauteur perdue se résorbe en douceur et la carte revient au milieu', () => {
  const r = fn('jeuRender');
  assert.ok(r.includes("const atterrit=keep&&/^play/.test(v)&&!!prevEd&&!html.includes('id=\"ed-lesson\"');") && r.includes('if(atterrit)jeuAtterrir(root,avantH);'));
  const a = fn('jeuAtterrir');
  assert.ok(a.includes("sp.className='jeu-amorti'") && a.includes("sp.style.transition='height .5s cubic-bezier(.3,.7,.2,1)';sp.style.height='0px';"), 'la hauteur perdue s’amortit');
  assert.ok(a.includes("scr.scrollTo({top:cible,behavior:doux?'smooth':'auto'})"), 'la carte revient doucement (tout de suite en mouvement réduit)');
});
