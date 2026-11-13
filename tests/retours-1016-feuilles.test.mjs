/* Elisa, 5 novembre, 10 h 16 (capture de l’écran Défis) : « Au niveau UI/UX des défis, ça me bloque pour la mise en prod, car pas
   trop pratique : créer une salle ouvre un autre cadre, etc. On peut travailler dessus. » Elle a choisi les feuilles : la partie
   rapide en haut (le seul choix de niveau), puis trois boutons, « Créer », « J’ai un code », « Seul », qui ouvrent chacun une feuille
   par-dessus l’écran ; rien ne bouge dans la page. « Salles ouvertes » ne garde que les salles en direct. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const secu = fs.readFileSync(path.join(ROOT, 'multiplayer-security.js'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => cut(`function ${name}(`, '\n}\n') + '\n}\n';
const line = name => cut(`function ${name}(`, '\n') + '\n';

function bac(o = {}) {
  const els = {};
  const ctx = vm.createContext(Object.assign({
    JEU_NIVL: {f: 'Facile', m: 'Moyen', d: 'Difficile'}, jeuNiv: 'd', jeuNb: 3, jeuVis: 'pub', jeuInvite: '', jeuNivUser: true, jeuMode: 'solo',
    jeuChallenges: () => [1, 2, 3, 4, 5], jeuNivAuto: () => 'f', accord: (f, m, n) => f, DEF_CHEV_SVG: '<svg class="chev"/>', LQ_X_SVG: '<svg class="x"/>',
    JEU_NOTE_HTML: '<p class="jeu-note">🔒 note</p>', lqStkSvg: k => `<svg data-stk="${k}"/>`, jeuNomField: id => `<div class="jeu-me" data-nom="${id}"></div>`,
    jeuVisTexte: () => 'visible', esc: s => String(s), DEFIS: {carte: ''}, JEU_NIV_X: {f: 1, m: 2, d: 4}, JEU_NIV_MANCHE: {f: 600000, m: 900000, d: 1200000}, JEU_MAX: 6,
    document: {getElementById: id => els[id] || null, querySelectorAll: () => [], body: null}
  }, o));
  vm.runInContext(cut('const DX_CODE_MSG=', '\nfunction dxCodeEtat(') + '\n' + line('jeuNivBars') + fn('renderDefisRoom') + fn('defisActionsHTML') + fn('defisFeuilleHTML') + line('dxDureeMax') + line('jeuDureeMs'), ctx);
  return {ctx, els};
}

test('le cadre du haut (11 h 11, 11 h 19) : le niveau, « Créer une salle », puis une rangée « J’ai un code », « Seul » ; plus de carte au milieu', () => {
  const {ctx, els} = bac();
  els['defis-room'] = {innerHTML: 'ancien'};
  const ouvertes = [];
  ctx.defisFeuilleOuvrir = k => ouvertes.push(k);
  const h = ctx.defisActionsHTML();
  /* Refonte du 7 novembre (designer produit) : deux boutons secondaires sous « Créer ma partie », plus de « ou » ni de tuiles. */
  assert.ok(h.startsWith('<div class="dx-actions" role="group" aria-label="D’autres façons de jouer">') && !h.includes('dx-ou'));
  assert.equal((h.match(/<button type="button" class="dx-act /g) || []).length, 2);
  /* 7 novembre, 21 h 44 : un libellé explicite chacun, plus de petite ligne dessous (retours-2144-defis). */
  for (const [k, stk, titre] of [['code', 'rocket', 'Rejoindre avec un code'], ['seul', 'clock', 'Jouer en solo']])
    assert.ok(h.includes(`<button type="button" class="dx-act is-${k}" data-k="${k}" aria-haspopup="dialog" aria-expanded="false" onclick="defisCarte('${k}')"><span class="dx-act-stk" aria-hidden="true"><svg data-stk="${stk}"/></span><b>${titre}</b></button>`), k);
  const haut = fn('defisRapideHTML');
  assert.ok(haut.includes('<p class="room-kicker">Créer ou rejoindre</p><h2 id="dx-rapide-h">Lance un défi&nbsp;!</h2>') && haut.includes("${jeuNiveauxHTML('dx-niv-l','defisNiv')}"), 'le niveau dans le cadre de « Créer ma partie »');
  assert.ok(haut.includes('<button type="button" class="room-go dx-act-go" data-k="creer" aria-haspopup="dialog" aria-expanded="${c===\'creer\'}" onclick="defisCarte(\'creer\')"><span>Créer ma partie</span>${DEF_CHEV_SVG}</button>\n    ${defisActionsHTML()}\n    <div class="dx-autres" id="dx-autres">${sallesAutresHTML()}</div></section>`;'), '« Créer une salle » ouvre sa feuille ; la rangée dessous, puis les autres niveaux');
  assert.ok(!haut.includes('jeuPartieRapide') && haut.includes('${sallesSectionHTML()}') && !app.includes('function jeuPartieRapide('), '11 h 37 puis 12 h 52 : « Rejoins une partie » dans le même cadre, sans « Trouver une salle »');
  ctx.renderDefisRoom();
  assert.equal(els['defis-room'].innerHTML, '', 'plus rien entre la partie rapide et les salles ouvertes');
  assert.deepEqual(ouvertes, [], 'rien ne s’ouvre tout seul');
  /* Un lien d’invitation : la feuille du code s’ouvre */
  ctx.jeuInvite = 'XYZ789';
  ctx.renderDefisRoom();
  assert.deepEqual(ouvertes, ['code']);
  ctx.DEFIS.carte = 'code';
  assert.ok(ctx.defisActionsHTML().includes('data-k="code" aria-haspopup="dialog" aria-expanded="true"'));
  const salles = fn('sallesRepeindre');
  assert.ok(!salles.includes('defisCarte(') && !salles.includes('dx-duo') && !salles.includes('t’entraîner seul'), 'Salles ouvertes : les salles en direct seulement');
});

test('les feuilles : le niveau rappelé dans le bandeau, puis seulement ce qu’il faut choisir ; le bouton en bas', () => {
  const {ctx} = bac();
  const creer = ctx.defisFeuilleHTML('creer'), code = ctx.defisFeuilleHTML('code'), seul = ctx.defisFeuilleHTML('seul');
  assert.ok(creer.includes('<p class="room-kicker">Créer ma partie</p>') && creer.includes('<h2 id="dx-f-t">Ta salle de défi</h2>'), 'le surtitre : le bouton touché (7 novembre, 21 h 44)');
  /* 8 novembre, 8 h 21 (la maquette de « Joue seul ») : la phrase sur toute la largeur, puis le niveau et ce qu’il fait aux points. */
  /* 8 novembre, 9 h 42 (la relecture de « Ta salle de défi ») : « Choisis les règles. Le défi sera révélé au lancement de la partie. »,
     et « 5 joueurs max » à côté des points */
  /* 10 h 38 (« comment mettre en avant le coefficient et le 5 joueurs max ») : deux pastilles à côté du niveau, le coefficient en
     jaune après la pièce, les joueurs en verre clair (les lecteurs d’écran entendent « Difficile, ×4 points, 5 joueurs max ») */
  assert.ok(creer.includes('<p class="room-sub" id="dx-f-p">Choisis les règles. Le défi sera révélé au lancement de la partie.</p><p class="dx-f-niv-l"><span class="dx-f-niv is-d"><i class="jeu-bars is-d" aria-hidden="true"><b></b><b></b><b></b></i>Difficile</span><span class="lq-sr">, </span><span class="dx-f-chip is-pts"><svg viewBox="0 0 24 24" aria-hidden="true">'), 'le niveau de la partie rapide, puis ses points');
  assert.ok(creer.includes('<span><b>×4</b><small aria-hidden="true">\u00a0pts</small><span class="lq-sr"> points</span></span></span><span class="lq-sr">, </span><span class="dx-f-chip is-max"><svg viewBox="0 0 24 24" aria-hidden="true">') && creer.includes('<span><b>6</b>\u00a0joueurs max</span></span></p>'), '×4 en pastille, puis 6 joueurs (22 h 27 : six par salle)');
  assert.ok(!creer.includes('dx-f-pts') && !app.includes('dx-f-pts'), 'plus la ligne de texte');
  assert.ok(creer.startsWith('<div class="room-head dx-f-tete"><span class="room-stk" aria-hidden="true"><svg data-stk="user"/></span>\n    <div class="dx-f-titres"><p class="room-kicker">Créer ma partie</p>'), 'l’autocollant à côté du surtitre et du titre');
  for (const h of [creer, code, seul]) assert.ok(!h.includes('room-levels') && !h.includes('data-set="niv"'), 'pas de second choix de niveau');
  assert.ok(creer.includes('<p class="jeu-lab" id="room-nb-l">Combien de manches&nbsp;?</p>\n      <div class="dx-manches" role="radiogroup" aria-labelledby="room-nb-l">'));
  /* 8 novembre, 9 h 42 : la durée au plus sur chaque carte (Difficile : 20 min la manche), plus de ligne dessous */
  assert.ok(creer.includes('<button type="button" role="radio" aria-checked="true" class="dx-manche on" data-set="nb" data-v="3" onclick="jeuRoomSet(\'nb\',3)"><b>3</b> <span>manches</span> <small class="dx-m-duree">1\u00a0h\u00a0max</small></button>')
    && creer.includes('<button type="button" role="radio" aria-checked="false" class="dx-manche" data-set="nb" data-v="1" onclick="jeuRoomSet(\'nb\',1)"><b>1</b> <span>manche</span> <small class="dx-m-duree">20\u00a0min\u00a0max</small></button>')
    && creer.includes('data-v="2" onclick="jeuRoomSet(\'nb\',2)"><b>2</b> <span>manches</span> <small class="dx-m-duree">40\u00a0min\u00a0max</small>') && !creer.includes('data-v="5"') && !creer.includes('dx-duree') && !creer.includes('Jusqu’à'), 'les manches en cartes, « manche » au singulier, la durée sur chacune');
  /* « Qui peut rejoindre ? », Publique ou Privée ; « Tu joues en tant que » en ligne simple. 9 h 57 : « Confidentialité des parties »
     quitte la feuille pour Mon compte (retours-0957). */
  assert.ok(creer.includes('<p class="jeu-lab" id="room-vis-l">Qui peut rejoindre&nbsp;?</p>') && creer.includes('<span aria-hidden="true">🌍</span> Publique</button>') && creer.includes('<span aria-hidden="true">🔒</span> Privée</button>'));
  assert.ok(creer.includes('<small class="room-hint" id="room-vis-hint">visible</small></div>\n    <div class="room-field dx-f-moi" data-friends><div class="jeu-me" data-nom="jeu-nom"></div></div>'));
  assert.ok(creer.indexOf('dx-f-moi') < creer.indexOf('dx-f-pied'), 'le pseudo, puis le bouton');
  for (const h of [creer, code, seul]) assert.ok(!h.includes('dx-conf') && !h.includes('Confidentialité des parties'), 'plus de confidentialité dans les feuilles (9 h 57)');
  assert.ok(creer.includes('<span>Ouvrir la salle</span><svg class="chev"/></button><p class="dx-f-note">Le défi démarre quand tu le décides.</p></div>'));
  assert.ok(creer.includes('<div class="dx-f-pied"><p class="jeu-msg" role="status" aria-live="polite"></p>'), 'le message et le bouton en pied de feuille');
  assert.ok(creer.includes('onclick="jeuEnterRoom()"><span>Ouvrir la salle</span>'));
  /* 8 novembre, 0 h 23 (la relecture d’Elisa) : « Rejoindre une partie », « Entre ton code ! », plus « Les 6 caractères que ton ami
     t’a envoyés » ; le bouton éteint tant que le code n’a pas ses 6 caractères. 15 h 27 (la relecture qu’elle a fait faire) : « Code de
     la salle », « Rejoindre la salle » ; ni correction ni suggestions ; plus de longueur maximale (une invitation collée entière). */
  assert.ok(code.includes('<p class="room-kicker">Rejoindre une partie</p>') && code.includes('<h2 id="dx-f-t">Entre ton code&nbsp;!</h2>') && code.includes('<p class="room-sub" id="dx-f-p">Un joueur t’a envoyé un code&nbsp;? Saisis-le pour rejoindre sa partie.</p>'));
  assert.ok(code.includes('<label class="jeu-lab" for="jeu-code">Code de la salle</label>') && code.includes('oninput="this.value=jeuCleanCode(this.value);dxCodePret(this)" onpaste="dxCodeColle(event)"') && !code.includes('room-hint') && !code.includes('Les 6 caractères'));
  assert.ok(code.includes('<input id="jeu-code" class="jeu-input is-code" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="ABC123" value=""') && !code.includes('maxlength'));
  assert.ok(code.includes('<button type="button" class="room-go" id="jeu-code-go" onmousedown="event.preventDefault()" disabled onclick="jeuEnterRoom()"><i class="dx-go-roue" aria-hidden="true"></i><i class="dx-go-ok" aria-hidden="true"><svg viewBox="0 0 24 24"') && code.includes('</svg></i><span>Rejoindre la salle</span>'));
  assert.ok(!code.includes('jeu-me') && !code.includes('data-set="nb"'), 'un code : pas de pseudo, pas de manches (l’hôte choisit)');
  assert.ok(seul.includes('<p class="room-kicker">Mode solo</p>') && seul.includes('<h2 id="dx-f-t">Joue seule</h2>') && seul.includes('<p class="room-sub" id="dx-f-p">Relève des défis contre la montre.</p><p class="dx-f-niv-l"><span class="dx-f-niv is-d">'));
  assert.ok(seul.includes('<span class="dx-f-chip is-pts">') && seul.includes('<span><b>×4</b><small aria-hidden="true">\u00a0pts</small><span class="lq-sr"> points</span></span></span></p>') && !seul.includes('is-max') && seul.includes('<span>Lancer la partie</span>') && seul.includes('class="dx-manche on" data-set="nb" data-v="3"') && seul.includes('<small class="dx-m-duree">1\u00a0h\u00a0max</small>') && !seul.includes('jeu-note') && !seul.includes('data-vis') && !seul.includes('dx-f-note') && !seul.includes('joueurs max'));
  assert.ok(!code.includes('dx-f-niv-l') && !code.includes('dx-m-duree'), 'le code : ni niveau ni durée (l’hôte choisit)');
  ctx.jeuNb = 1; ctx.jeuNiv = 'f';
  assert.ok(ctx.defisFeuilleHTML('seul').includes('<b>×1</b><small aria-hidden="true">\u00a0pts</small><span class="lq-sr"> points</span>') && ctx.defisFeuilleHTML('seul').includes('<small class="dx-m-duree">10\u00a0min\u00a0max</small>'));
  assert.equal(ctx.dxDureeMax(5), '50\u00a0min\u00a0max', '10 min par manche en Facile');
  assert.deepEqual([ctx.dxDureeMax(3, 'm'), ctx.dxDureeMax(1, 'd'), ctx.dxDureeMax(5, 'm'), ctx.dxDureeMax(5, 'd'), ctx.dxDureeMax(3, 'd')],
    ['45\u00a0min\u00a0max', '20\u00a0min\u00a0max', '1\u00a0h\u00a015\u00a0max', '1\u00a0h\u00a040\u00a0max', '1\u00a0h\u00a0max'], '15 min en Moyen, 20 en Difficile ; en heures dès une heure');
  ctx.jeuNb = 3; ctx.jeuNiv = 'd';
  ctx.jeuInvite = 'ABC123';
  const inv = ctx.defisFeuilleHTML('code');
  assert.ok(inv.includes('<p class="room-invite">Tu es invitée dans la salle <b class="jeu-code-inline">ABC123</b></p>') && inv.includes('value="ABC123"') && inv.includes('class="jeu-input is-code is-pret"') && inv.includes('id="jeu-code-go" onmousedown="event.preventDefault()" onclick='), 'le code d’un lien : le champ allumé, le bouton aussi');
  /* Code introuvable (personne dans la salle) : la feuille revient, le code gardé, le message dessous */
  ctx.jeuInvite = ''; ctx.jeuCodeKo = 'ZZZ999';
  const ko = ctx.defisFeuilleHTML('code');
  assert.ok(ko.includes('value="ZZZ999"') && ko.includes('class="jeu-input is-code is-ko"') && ko.includes('<p class="jeu-msg is-ko" role="status" aria-live="polite"><span class="dx-alerte-plie"><span class="dx-alerte"><i class="dx-alerte-ico"><svg viewBox="0 0 32 32" aria-hidden="true">') && ko.includes('<span class="dx-alerte-t"><b>Salle introuvable&nbsp;!</b><small>Ce code ne correspond à aucune salle. Vérifie-le et réessaie.</small></span></span></span></p>') && !ko.includes('room-invite'));
  assert.ok(ko.includes('<span>Réessayer</span>'), '16 h 34 (la relecture) : « Réessayer » après un échec');
  ctx.jeuCodeKo = '';
  ctx.jeuChallenges = () => [1];
  assert.ok(ctx.defisFeuilleHTML('seul').includes('data-set="nb" data-v="2" disabled') && ctx.defisFeuilleHTML('seul').includes('data-set="nb" data-v="3" disabled'), 'pas plus de manches que de défis');
  /* 8 novembre, 17 h 08 : « on va partir sur 1 / 2 / 3 manches car 5 ça fait trop » */
  ctx.jeuChallenges = () => [1, 2, 3, 4, 5];
  assert.deepEqual([...ctx.defisFeuilleHTML('seul').matchAll(/data-set="nb" data-v="(\d)"/g)].map(m => +m[1]), [1, 2, 3]);
});

test('la feuille s’ouvre par-dessus, se referme par ×, le voile ou Échap, et rend le focus au bouton touché', () => {
  const o = fn('defisFeuilleOuvrir');
  for (const k of ["el.id='dx-feuille';el.className='dx-feuille';", 'role="dialog" aria-modal="true" aria-labelledby="dx-f-t" aria-describedby="dx-f-p" tabindex="-1"',
    '<button type="button" class="dx-f-fond" tabindex="-1" aria-label="Fermer" onclick="defisFeuilleFermer()"></button>',
    '<button type="button" class="lq-x dx-f-x" aria-label="Fermer" onclick="defisFeuilleFermer()">${LQ_X_SVG}</button>',
    "document.addEventListener('keydown',dxFeuilleTouche,true);", "vv.addEventListener('resize',dxFeuilleCaler)", "document.querySelectorAll('#scr-defis :is(.dx-act,.dx-act-go)').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.k===k)));",
    'if(inp&&(!inp.value||ko))setTimeout(()=>{try{if(inp.isConnected&&document.activeElement!==inp){inp.focus({preventScroll:true});const n=inp.value.length;inp.setSelectionRange(n,n);}}catch(e){}},', "bx.classList.toggle('is-defile',"])
    assert.ok(o.includes(k), k);
  const f = fn('defisFeuilleFermer');
  for (const k of ["DEFIS.carte='';", "document.removeEventListener('keydown',dxFeuilleTouche,true);", "el.removeAttribute('id');", "el.classList.remove('on');el.classList.add('off');",
    'setTimeout(()=>el.remove(),prefersReduceMotion()?0:260);', "if(!sansRetour&&r&&r.isConnected)try{ r.focus({preventScroll:true}); }catch(e){}"])
    assert.ok(f.includes(k), k);
  const t = fn('dxFeuilleTouche');
  assert.ok(t.includes("if(e.key==='Escape'){e.preventDefault();e.stopPropagation();defisFeuilleFermer();return;}") && t.includes('f[i<0?0:(i+(e.shiftKey?f.length-1:1))%f.length].focus();'), 'Échap, et Tab qui reste dans la feuille');
  /* 8 novembre, 16 h 18 : le cadre couvre l’écran ; la feuille du code, une carte, monte avec le clavier (feuille-code-clavier) */
  assert.ok(fn('dxFeuilleCaler').includes("el.style.top='0px';el.style.height=el._haut+'px';el.style.bottom='auto';") && fn('dxFeuilleCaler').includes("el.style.setProperty('--dx-clavier',k+'px');"));
  assert.ok(fn('defisCarte').includes('if(!k){defisFeuilleFermer();return;}') && fn('defisCarte').includes('defisFeuilleOuvrir(k);'));
});

test('branchée partout : le message et les réglages dans la feuille ; la salle démarre, on change d’onglet : elle se referme', () => {
  assert.ok(fn('jeuMsgEl').includes("if((id||'jeu-nom')==='jeu-nom'){const f=document.querySelector('#dx-feuille .jeu-msg');if(f)return f;}"));
  assert.ok(fn('jeuRoomSet').includes("const card=document.querySelector('#dx-feuille .dx-f-corps')||document.getElementById('defis-room');if(!card)return;"));
  assert.ok(fn('jeuRoomSet').includes("if(k==='mode'){const sub=card.querySelector('.room-sub');"), 'le bandeau garde le niveau quand on choisit les manches');
  assert.ok(fn('jeuRoomSet').includes("if(k==='niv')card.querySelectorAll('.dx-manche').forEach(b=>{const d=b.querySelector('.dx-m-duree');if(d)d.textContent=dxDureeMax(+b.dataset.v);});"), 'les durées des cartes suivent le niveau (8 novembre, 9 h 42)');
  assert.ok(fn('jeuRoomSet').includes("go.textContent=join?'Rejoindre la salle':friends?'Ouvrir la salle':'Lancer la partie';"), 'le bouton garde son libellé');
  assert.ok(fn('jeuStart').includes("if(!verif&&typeof defisFeuilleFermer==='function')defisFeuilleFermer(true);"), 'la salle s’ouvre : la feuille se referme (sauf le code qu’on cherche encore, 15 h 27)');
  assert.ok(fn('switchTab').includes("if(name!=='defis'&&typeof defisFeuilleFermer==='function'&&document.getElementById('dx-feuille'))defisFeuilleFermer(true);"));
  assert.ok(!fn('openJeu').includes('scrollIntoView'), 'un lien d’invitation : la feuille du code, plus de défilement');
  const re = fn('perfRematch');
  assert.ok(re.includes("DEFIS.onglet='jouer';DEFIS.carte='creer';jeuSavePrefs();defisPeindre();") && re.includes("document.querySelector('#dx-feuille .room-go')"), '« Les redéfier » : la feuille Créer, son bouton fait signe');
  assert.ok(secu.includes("const button = document.querySelector('#dx-feuille .room-go') || (options.verif ? null : document.querySelector('.screen.active .room-go'));"), 'la vérification en ligne grise le bouton de la feuille');
  assert.ok(app.includes("||!!document.querySelector('.lq-ask.on,#lesson-video,#dx-feuille');\n}") && app.includes("    if(accueilOccupe())return false;\n    localStorage.setItem(OB_WIDGET_VU,'1');"));
});

test('la DA : une rangée de trois cases dans le cadre, la feuille qui monte du bas, son bouton qui reste en bas sur un petit écran', () => {
  for (const k of ['html.lq #scr-defis .dx-ou{display:flex;align-items:center;gap:12px;', 'html.lq #scr-defis .dx-ou::before,html.lq #scr-defis .dx-ou::after{content:"";flex:1;height:2px;',
    'html.lq #scr-defis .dx-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin-top:12px;border:2px solid var(--line);border-radius:18px;',
    'html.lq #scr-defis .dx-rejoindre{margin:18px 0 14px}', 'html.lq #scr-defis .dx-autres:empty{display:none}',
    'html.lq #scr-defis .dx-act+.dx-act{box-shadow:inset 2px 0 0 var(--line)}',
    'html.lq #scr-defis .dx-act:active,html.lq #scr-defis .dx-act[aria-expanded="true"]{background:var(--accent-soft)}',
    '.dx-feuille{position:fixed;inset:0;z-index:2600;display:flex;align-items:flex-end;justify-content:center;pointer-events:none}',
    'transform:translateY(calc(100% + 40px));transition:transform .36s cubic-bezier(.32,.72,0,1)}', 'html.lq .dx-feuille.on .dx-f-boite{transform:none}',
    'html.lq .dx-feuille .dx-f-pied{position:sticky;bottom:-18px;z-index:2;margin:6px -18px -18px;padding:12px 18px 18px;background:#fff}',
    'html.lq .dx-feuille .dx-f-boite.is-defile .dx-f-pied::before{opacity:1}', 'html.lq .dx-f-niv{display:inline-flex;align-items:center;gap:7px;',
    '@media (max-height:720px),(max-width:360px){', 'html[data-motion="reduce"] .dx-feuille,html[data-motion="reduce"] .dx-feuille .dx-f-fond,html[data-motion="reduce"].lq .dx-feuille .dx-f-boite{transition:none!important}'])
    assert.ok(css.includes(k), k);
  /* .dx-duo et .dx-sec restent : l’onglet Joueurs s’en sert encore (« Ajouter un joueur », « Inviter par lien » ; retours-1137). */
  for (const gone of ['.dx-fermer{', '.dx-carte .room-head']) assert.ok(!css.includes(gone), 'retiré : ' + gone);
});

/* Elisa, 8 novembre, 8 h 21 (sa maquette de « Joue seul ») puis 9 h 42 (la durée sur chaque carte) : toucher une carte de manches
   l’allume ; le niveau change la durée de chaque carte ; le bouton reste « Lancer la partie ». */
test('8 novembre : choisir 3 manches allume la carte ; le niveau change la durée de chaque carte ; le bouton reste « Lancer la partie »', () => {
  const go = {textContent: 'Lancer la partie'};
  const carte = v => { const d = {textContent: ''}; const b = {dataset: {v: String(v)}, disabled: false, attrs: {}, on: false, d,
    classList: {toggle(c, on) { if (c === 'on') b.on = !!on; }}, setAttribute(k, x) { b.attrs[k] = String(x); }, querySelector: q => (q === '.dx-m-duree' ? d : null)}; return b; };
  const nbs = [1, 2, 3].map(carte);
  const card = {querySelector: q => q === '.room-go span' ? go : null, querySelectorAll: q => q.includes('data-set="nb"') || q === '.dx-manche' ? nbs : []};
  const ctx = vm.createContext({document: {querySelector: q => q === '#dx-feuille .dx-f-corps' ? card : null, getElementById: () => null},
    JEU_NIVL: {f: 'Facile', m: 'Moyen', d: 'Difficile'}, jeuChallenges: () => [1, 2, 3, 4, 5], jeuNiv: 'm', jeuNb: 1, jeuMode: 'solo', jeuVis: 'pub', jeuNivUser: false,
    jeuSavePrefs() {}, navigator: {}, JEU_NIV_MANCHE: {f: 600000, m: 900000, d: 1200000}});
  vm.runInContext(fn('jeuRoomSet') + line('dxDureeMax') + line('jeuDureeMs'), ctx);
  ctx.jeuRoomSet('nb', 5);
  assert.equal(ctx.jeuNb, 1, '5 manches n’existe plus (17 h 08)');
  ctx.jeuRoomSet('nb', 3);
  assert.equal(go.textContent, 'Lancer la partie');
  assert.deepEqual(nbs.map(b => [b.attrs['aria-checked'], b.on]), [['false', false], ['false', false], ['true', true]]);
  assert.equal(ctx.jeuNb, 3);
  ctx.jeuRoomSet('niv', 'd');
  assert.deepEqual(nbs.map(b => b.d.textContent), ['20\u00a0min\u00a0max', '40\u00a0min\u00a0max', '1\u00a0h\u00a0max'], 'en Difficile, 20 min par manche');
  ctx.jeuRoomSet('niv', 'm');
  assert.deepEqual(nbs.map(b => b.d.textContent), ['15\u00a0min\u00a0max', '30\u00a0min\u00a0max', '45\u00a0min\u00a0max'], 'en Moyen, 15 min');
});

test('10 h 38 : le coefficient et « 5 joueurs max » en pastilles de la hauteur du niveau, le coefficient en jaune', () => {
  for (const r of ['html.lq .dx-feuille .dx-f-tete>.dx-f-niv-l{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:12px 0 0}',
    'html.lq .dx-feuille .dx-f-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 12px 5px 6px;border-radius:999px;font:800 14px/1.2 var(--display);',
    'html.lq .dx-feuille .dx-f-chip.is-pts{padding-right:13px;background:var(--sun);color:var(--ink);box-shadow:0 2px 0 var(--sun-lip)}',
    'html.lq .dx-feuille .dx-f-chip.is-max{padding-left:9px;background:rgba(255,255,255,.14);color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.34)}',
    'html.lq .dx-feuille .dx-f-chip.is-max>svg{width:18px;height:18px;color:var(--mint)}'])
    assert.ok(css.includes(r), r);
  assert.ok(css.indexOf('html.lq .dx-feuille .dx-f-chip{') > css.indexOf('Défis — la refonte du 7 novembre'), 'avec les feuilles des Défis');
  assert.ok(!css.includes('.dx-f-pts'), 'l’ancienne ligne de texte n’a plus de style');
});
