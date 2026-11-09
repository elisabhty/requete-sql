/* Elisa, 9 novembre, 10 h 01, en réponse à « Tu trouves que c’est cohérent ? » (trois mots pour un défi réussi ; avec une seule manche,
   le bilan qui se répète ; la salle où l’on est seule qui annonce un bouton absent) : « Oui il faut pas de répétition de page il faut
   vraiment l’essentiel et ne pas passer par cette page si plus d’une manche ». Lu : ne passer par le bilan que s’il y a plus d’une
   manche. Ce qui change :
   1. une partie d’une seule manche, seule (Joue seule, ou seule dans sa salle), n’a plus de bilan : elle se termine sur place, la
      carte de la manche reste (« Bravo, défi résolu ! », ou « Temps écoulé » et « Retenter ce défi »), ses boutons dessous ;
   2. seul, une manche finie au chrono reste à l’écran comme une manche trouvée : son encart dit « Temps écoulé » (la pêche des défis
      à rattraper), puis la suite ; plus de page « Manche 1/2 terminée » ;
   3. le bilan d’une partie de 2 ou 3 manches dit chaque chose une fois : le niveau sous le titre, « Tout résolu ! » / « Ton bilan » /
      « Aucun défi résolu », le bandeau sans zéros ni « temps moyen » d’un seul temps, chaque manche sans « Défi 200 » à côté de
      « +200 », « Retenter ce défi » aussi seule dans sa salle ;
   4. « résolu » partout pour un défi : encart vert, bilan, Mes stats, Planning, Mon compte (« trouver » reste à la course entre
      joueurs) ;
   5. en salle classée, la bonne réponse revient du serveur par le fil de la salle : l’encart vert n’apparaissait pas (l’éditeur
      restait jusqu’à la suite) ; la carte prend désormais sa place, sur place.
   Le déroulé, dans salle-defis.test.mjs. */
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

test('une partie d’une seule manche, seule, se termine sur place : pas de bilan, ses points, sa notification, sa fin de partie', () => {
  assert.ok(line('jeuFinSurPlace').includes('return !!J&&J.nb===1&&!!J.rounds[0]&&jeuSoloLike(0);'));
  const v = fn('jeuView');
  assert.ok(v.includes("if(J.over)return jeuFinSurPlace()?'play0':'final';"), 'finie, elle reste la page de la manche');
  assert.ok(v.includes("if(fin&&jeuSoloLike(n)&&(n<J.nb-1||J.nb===1||Date.now()<jeuFinAuto(n)))return'play'+n;"), 'trouvée ou finie au chrono');
  const f = fn('jeuFinirSurPlace');
  assert.ok(f.includes('const cg=jeuCreditGame();') && f.includes("jeuPtsPop({kind:'game',pts:cg.pts,total:cg.total})") && f.includes('celebrate()') && f.includes('jeuFinish();'));
  assert.ok(f.includes('if(J.finSP!==J.g){') && f.includes('J.finSP=J.g;'), 'une fois par partie');
  assert.ok(app.includes("if((mine||rate)&&jeuFinSurPlace())jeuFinirSurPlace();"), 'dès que la manche est finie, avant de dessiner sa carte (le record)');
  assert.ok(app.includes("if(x&&!jeuFinSurPlace())jeuPtsPop({kind:'round',pts:x.pts});"), 'une seule notification : celle de la partie, avec le total');
  /* Ses boutons : ceux du bilan */
  const ctx = vm.createContext({ JEU: { solo: true, niv: 'f' }, JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' }, DEF_CHEV_SVG: '<svg>›</svg>', jeuBtn2: (i, l, o) => `[${i}|${l}|${o}]` });
  vm.runInContext(fn('jeuFinActionsHTML'), ctx);
  assert.equal(ctx.jeuFinActionsHTML(true), '<div class="jeu-fin-actions"><button type="button" class="journey-primary" onclick="jeuRejouer()"><span>Rejouer</span><svg>›</svg></button>[level|Passer au niveau moyen|jeuNiveauSuivant()]</div>');
  assert.ok(ctx.jeuFinActionsHTML(false).includes('[level|Changer de niveau|openJeu()]'), 'pas résolue : changer de niveau');
  ctx.JEU.solo = false;
  assert.ok(ctx.jeuFinActionsHTML(true).includes('[quit|Quitter la salle|goBack()]'), 'dans une salle : la quitter');
  /* « Rejouer » touché avant que la fin de partie revienne : elle part, la partie suivante la suit */
  assert.ok(line('jeuRejouer').includes('if(J.over)return jeuAgain();J.rejouer=true;jeuFinish();'));
  assert.ok(app.includes("J.over=true;\n      if(J.rejouer){J.rejouer=false;setTimeout(()=>{if(JEU===J&&J.over)jeuAgain();},0);}"));
  /* Le bilan, au bouton aussi */
  assert.ok(cut("}else if(v==='final'){", '/* Fondu enchaîné').includes('onclick="jeuRejouer()"><span>Rejouer</span>'));
});

test('seul, finie au chrono : « Temps écoulé » à la place de l’éditeur, dans la pêche des défis à rattraper ; « Retenter ce défi » quand la partie s’arrête là', () => {
  const r = fn('jeuRateHTML');
  assert.ok(r.includes('<section class="coach is-to jeu-done" id="jeu-done" aria-label="${t}" aria-live="polite">'), 'la carte de l’indice, comme l’encart vert (jeu-done : la page ne la redessine pas)');
  assert.ok(r.includes('<div class="coach-to"><span class="coach-to-ico" aria-hidden="true">${JEU_ICO.cross}</span><div class="coach-to-tx"><b class="coach-to-k">${t}</b><p>${p}</p>${retry}</div></div>'));
  assert.ok(r.includes("const t=ab?'Manche abandonnée':'Temps écoulé',p=ab?'Tu as quitté la manche avant de valider ta réponse.':'Le chrono est arrivé à 0 avant que tu valides ta réponse.';"));
  assert.ok(r.includes("${fin1?'':jeuSuiteHTML(n)}") && r.includes("${fin1?jeuFinActionsHTML(false):''}"), 'la suite, ou ses boutons');
  assert.ok(!r.includes('Point obtenu') && !r.includes('Non validée'), 'l’essentiel : plus de « 0 point obtenu », « Non validée »');
  assert.ok(app.includes("const rate=!mine&&sl&&jeuRoundDone(n);edOn=!mine&&!rate;") && app.includes("${mine?jeuFoundHTML(r,J.me):rate?jeuRateHTML(r):editorBlock(false,'defi.sql',{jeu:1})}"));
  assert.ok(app.includes("+'|'+(r&&r.closed?'c':'')+(r&&jeuRoundDone(n)?'d':'');"), 'le chrono à 0 redessine la page');
  assert.ok(fn('jeuRetenter').includes('if(JEU)jeuStop();'), 'seule dans sa salle aussi, on la quitte pour la page du défi');
  for (const k of ['html.lq .coach-to{display:grid;grid-template-columns:28px minmax(0,1fr);', 'border:2px solid #FFD2BC;border-radius:16px;background:#FFF1E8;',
    'html.lq .coach-to .coach-to-k{grid-column:2;grid-row:1;margin:0;color:#A24A1E;', 'html.lq #app .coach-to .jr-retry{grid-column:2;grid-row:3;justify-self:start;margin-top:8px}',
    'html.lq .jeu-fin-actions{margin:4px 0 6px}', 'html.lq .coach-ok .coach-ok-bonus.is-record{background:var(--sun);color:#1B1640}', 'html.lq #app .jeu-bilan.is-2{grid-template-columns:repeat(2,minmax(0,1fr))}'])
    assert.ok(lq.includes(k), k);
});

test('trouvée sans que la page le montre (la réponse du serveur en salle classée) : la carte prend la place de l’éditeur', () => {
  const p = fn('jeuPatch');
  assert.ok(p.includes("{const r=J.rounds[n];if(r&&(r.found[J.me]!=null||(J.slShown&&jeuRoundDone(n)))&&!document.getElementById('jeu-done')){J.keep=v;J.view='';jeuPaint();return;}}"));
  assert.ok(p.indexOf("if(jeuSoloLike(n)!==J.slShown)") < p.indexOf("document.getElementById('jeu-done')"), 'après le passage seul / à plusieurs');
});

test('le bilan (2 ou 3 manches) : l’essentiel, une fois ; « résolu » partout pour un défi', () => {
  const fin = cut("}else if(v==='final'){", '/* Fondu enchaîné');
  assert.ok(fin.includes("const titre=all?(trophee?'Tout résolu\\u00a0!':'Tout résolu ! 🏆'):nOk?'Ton bilan':'Aucun défi résolu';"));
  assert.ok(fin.includes("html=trophee+head('Fin de la partie',titre,`Niveau ${JEU_NIVL[J.niv].toLowerCase()}.`)+"), 'le niveau sous le titre, seul');
  assert.ok(!fin.includes('const verdict') && !fin.includes('`Bien joué') && !fin.includes("'Tout trouvé"), 'plus de phrase qui redit le bandeau');
  assert.ok(fin.includes("const bande=nOk||J.record?") && fin.includes("<small>résolu${nOk>1?'s':''}</small>"), 'pas de bandeau de zéros ; « résolu »');
  assert.ok(fin.includes("<i class=\"jr-time\">Résolu en ${dur(x.ms)}</i>${y&&(y.essai||y.rang)?jeuPtsDetail(y):''}"), 'le détail seulement s’il dit autre chose que les points');
  assert.ok(fin.includes("${!ok?`<button type=\"button\" class=\"jr-retry\" onclick=\"jeuRetenter('${x.c.id}')\">"), '« Retenter ce défi », seule dans sa salle aussi');
  /* Mes stats, Planning, Mon compte */
  for (const k of ["${trouves} ${plur(trouves,'défi')} ${plur(trouves,'résolu')} sur ${manches}", "'Les défis que tu résous comptent ici.'", "${h.ok}/${h.n} ${plur(h.ok,'résolu')}",
    "<p>${kd.ma?`résolu${kd.tr>1?'s':''}`:'à jouer'}</p>", "${kd.ma?`${kd.tr}/${kd.ma} résolu${kd.tr>1?'s':''}`:'À jouer'}"])
    assert.ok(app.includes(k), k);
  assert.ok(!/plur\([a-z.]+,'réussie'\)|réussie\$\{kd\.tr/.test(app), 'plus de « réussie » pour un défi');
  /* « trouver » reste à la course entre joueurs */
  assert.ok(app.includes("dits.push({k:'tous',p:6,ico:JEU_ICO.check,html:'Tout le monde a trouvé\\u00a0!'});") && app.includes("pos===0?'1er à trouver'"));
});
