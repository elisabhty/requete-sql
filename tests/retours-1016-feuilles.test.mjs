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
    jeuVisTexte: () => 'visible', esc: s => String(s), DEFIS: {carte: ''}, JEU_NIV_X: {f: 1, m: 2, d: 4}, JEU_NIV_MANCHE: {f: 600000, m: 900000, d: 1200000}, LQ_CHRONO_SVG: '<svg class="chrono"/>',
    document: {getElementById: id => els[id] || null, querySelectorAll: () => [], body: null}
  }, o));
  vm.runInContext(line('jeuNivBars') + fn('renderDefisRoom') + fn('defisActionsHTML') + fn('defisFeuilleHTML') + line('dxDureeTexte') + line('jeuDureeMs') + fn('dxConfHTML'), ctx);
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
  assert.ok(creer.includes('<p class="room-sub" id="dx-f-p">Le défi est tiré au sort au dernier moment, le même pour tous.</p><p class="dx-f-niv-l"><span class="dx-f-niv is-d"><i class="jeu-bars is-d" aria-hidden="true"><b></b><b></b><b></b></i>Difficile</span><span class="dx-f-pts">Points ×4</span></p>'), 'le niveau de la partie rapide');
  assert.ok(creer.startsWith('<div class="room-head dx-f-tete"><span class="room-stk" aria-hidden="true"><svg data-stk="user"/></span>\n    <div class="dx-f-titres"><p class="room-kicker">Créer ma partie</p>'), 'l’autocollant à côté du surtitre et du titre');
  for (const h of [creer, code, seul]) assert.ok(!h.includes('room-levels') && !h.includes('data-set="niv"'), 'pas de second choix de niveau');
  assert.ok(creer.includes('<p class="jeu-lab" id="room-nb-l">Combien de manches&nbsp;?</p>\n      <div class="dx-manches" role="radiogroup" aria-labelledby="room-nb-l">'));
  assert.ok(creer.includes('<button type="button" role="radio" aria-checked="true" class="dx-manche on" data-set="nb" data-v="3" onclick="jeuRoomSet(\'nb\',3)"><b>3</b> <span>manches</span></button>')
    && creer.includes('<button type="button" role="radio" aria-checked="false" class="dx-manche" data-set="nb" data-v="1" onclick="jeuRoomSet(\'nb\',1)"><b>1</b> <span>manche</span></button>'), 'les manches en cartes, « manche » au singulier');
  assert.ok(creer.includes('<p class="dx-duree" aria-live="polite"><svg class="chrono"/><span>Jusqu’à 1\u00a0h de jeu</span></p>'), '3 manches de 20 min en Difficile (8 novembre, 8 h 52) : une heure');
  assert.ok(creer.includes('<p class="jeu-lab" id="room-vis-l">Qui peut entrer&nbsp;?</p>') && creer.includes('<div class="jeu-me" data-nom="jeu-nom"></div>'));
  /* 8 novembre, 0 h 23 : la confidentialité repliée derrière « Confidentialité des parties » (« utile, mais trop visible »). */
  assert.ok(creer.includes('<details class="dx-conf"><summary><span aria-hidden="true">🔒</span> Confidentialité des parties</summary><p class="jeu-note">Les joueurs de ta salle voient ton pseudo, ton drapeau, tes temps et tes réactions. Tes requêtes sont vérifiées en ligne et restent privées.</p></details></div>\n    <div class="dx-f-pied"><p class="jeu-msg" role="status" aria-live="polite"></p>'), 'la confidentialité repliée, puis le message et le bouton en pied de feuille');
  assert.ok(creer.includes('onclick="jeuEnterRoom()"><span>Ouvrir la salle</span>'));
  /* 8 novembre, 0 h 23 (la relecture d’Elisa) : « Rejoindre une partie », « Entre ton code ! », « Code à 6 caractères », plus « Les 6
     caractères que ton ami t’a envoyés » ; « Rejoindre la partie », éteint tant que le code n’a pas ses 6 caractères. */
  assert.ok(code.includes('<p class="room-kicker">Rejoindre une partie</p>') && code.includes('<h2 id="dx-f-t">Entre ton code&nbsp;!</h2>') && code.includes('<p class="room-sub" id="dx-f-p">Un joueur t’a envoyé un code&nbsp;? Saisis-le pour rejoindre sa partie.</p>'));
  assert.ok(code.includes('<label class="jeu-lab" for="jeu-code">Code à 6 caractères</label>') && code.includes('oninput="this.value=jeuCleanCode(this.value);dxCodePret(this)"') && !code.includes('room-hint') && !code.includes('Les 6 caractères'));
  assert.ok(code.includes('<button type="button" class="room-go" id="jeu-code-go" disabled onclick="jeuEnterRoom()"><span>Rejoindre la partie</span>') && code.includes('dx-conf'));
  assert.ok(!code.includes('jeu-me') && !code.includes('data-set="nb"'), 'un code : pas de pseudo, pas de manches (l’hôte choisit)');
  assert.ok(seul.includes('<p class="room-kicker">Mode solo</p>') && seul.includes('<h2 id="dx-f-t">Joue seul</h2>') && seul.includes('<p class="room-sub" id="dx-f-p">Relève des défis à ton rythme.</p><p class="dx-f-niv-l"><span class="dx-f-niv is-d">'));
  assert.ok(seul.includes('<span class="dx-f-pts">Points ×4</span>') && seul.includes('<span>Lancer la partie</span>') && seul.includes('class="dx-manche on" data-set="nb" data-v="3"') && seul.includes('Jusqu’à 1\u00a0h de jeu') && !seul.includes('jeu-note') && !seul.includes('data-vis'));
  assert.ok(!code.includes('dx-f-niv-l') && !code.includes('dx-duree'), 'le code : ni niveau ni durée (l’hôte choisit)');
  ctx.jeuNb = 1; ctx.jeuNiv = 'f';
  assert.ok(ctx.defisFeuilleHTML('seul').includes('<span class="dx-f-pts">Points ×1</span>') && ctx.defisFeuilleHTML('seul').includes('<span>Jusqu’à 10\u00a0min de jeu</span>'));
  assert.equal(ctx.dxDureeTexte(5), 'Jusqu’à 50\u00a0min de jeu', '10 min par manche en Facile');
  assert.deepEqual([ctx.dxDureeTexte(3, 'm'), ctx.dxDureeTexte(1, 'd'), ctx.dxDureeTexte(5, 'm'), ctx.dxDureeTexte(5, 'd')],
    ['Jusqu’à 45\u00a0min de jeu', 'Jusqu’à 20\u00a0min de jeu', 'Jusqu’à 1\u00a0h\u00a015 de jeu', 'Jusqu’à 1\u00a0h\u00a040 de jeu'], '15 min en Moyen, 20 en Difficile ; en heures dès une heure');
  ctx.jeuNb = 3; ctx.jeuNiv = 'd';
  ctx.jeuInvite = 'ABC123';
  const inv = ctx.defisFeuilleHTML('code');
  assert.ok(inv.includes('<p class="room-invite">Tu es invitée dans la salle <b class="jeu-code-inline">ABC123</b></p>') && inv.includes('value="ABC123"') && inv.includes('id="jeu-code-go" onclick='), 'le code d’un lien : le bouton allumé');
  /* Code introuvable (personne dans la salle) : la feuille revient, le code gardé, le message dessous */
  ctx.jeuInvite = ''; ctx.jeuCodeKo = 'ZZZ999';
  const ko = ctx.defisFeuilleHTML('code');
  assert.ok(ko.includes('value="ZZZ999"') && ko.includes('aria-live="polite">Code introuvable. Vérifie-le et réessaie.</p>') && !ko.includes('room-invite'));
  ctx.jeuCodeKo = '';
  ctx.jeuChallenges = () => [1, 2];
  assert.ok(ctx.defisFeuilleHTML('seul').includes('data-set="nb" data-v="3" disabled') && ctx.defisFeuilleHTML('seul').includes('data-set="nb" data-v="5" disabled'), 'pas plus de manches que de défis');
});

test('la feuille s’ouvre par-dessus, se referme par ×, le voile ou Échap, et rend le focus au bouton touché', () => {
  const o = fn('defisFeuilleOuvrir');
  for (const k of ["el.id='dx-feuille';el.className='dx-feuille';", 'role="dialog" aria-modal="true" aria-labelledby="dx-f-t" aria-describedby="dx-f-p" tabindex="-1"',
    '<button type="button" class="dx-f-fond" tabindex="-1" aria-label="Fermer" onclick="defisFeuilleFermer()"></button>',
    '<button type="button" class="lq-x dx-f-x" aria-label="Fermer" onclick="defisFeuilleFermer()">${LQ_X_SVG}</button>',
    "document.addEventListener('keydown',dxFeuilleTouche,true);", "vv.addEventListener('resize',dxFeuilleCaler)", "document.querySelectorAll('#scr-defis :is(.dx-act,.dx-act-go)').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.k===k)));",
    'if(inp&&(!inp.value||ko)){inp.focus({preventScroll:true});if(ko)inp.select();} else el.querySelector(\'.dx-f-boite\').focus({preventScroll:true});', "bx.classList.toggle('is-defile',"])
    assert.ok(o.includes(k), k);
  const f = fn('defisFeuilleFermer');
  for (const k of ["DEFIS.carte='';", "document.removeEventListener('keydown',dxFeuilleTouche,true);", "el.removeAttribute('id');", "el.classList.remove('on');el.classList.add('off');",
    'setTimeout(()=>el.remove(),prefersReduceMotion()?0:260);', "if(!sansRetour&&r&&r.isConnected)try{ r.focus({preventScroll:true}); }catch(e){}"])
    assert.ok(f.includes(k), k);
  const t = fn('dxFeuilleTouche');
  assert.ok(t.includes("if(e.key==='Escape'){e.preventDefault();e.stopPropagation();defisFeuilleFermer();return;}") && t.includes('f[i<0?0:(i+(e.shiftKey?f.length-1:1))%f.length].focus();'), 'Échap, et Tab qui reste dans la feuille');
  assert.ok(fn('dxFeuilleCaler').includes("el.style.top=(open?vv.offsetTop:0)+'px';el.style.height=(open?vv.height:window.innerHeight)+'px';"), 'au-dessus du clavier');
  assert.ok(fn('defisCarte').includes('if(!k){defisFeuilleFermer();return;}') && fn('defisCarte').includes('defisFeuilleOuvrir(k);'));
});

test('branchée partout : le message et les réglages dans la feuille ; la salle démarre, on change d’onglet : elle se referme', () => {
  assert.ok(fn('jeuMsgEl').includes("if((id||'jeu-nom')==='jeu-nom'){const f=document.querySelector('#dx-feuille .jeu-msg');if(f)return f;}"));
  assert.ok(fn('jeuRoomSet').includes("const card=document.querySelector('#dx-feuille .dx-f-corps')||document.getElementById('defis-room');if(!card)return;"));
  assert.ok(fn('jeuRoomSet').includes("if(k==='mode'){const sub=card.querySelector('.room-sub');"), 'le bandeau garde le niveau quand on choisit les manches');
  assert.ok(fn('jeuRoomSet').includes("if(k==='nb'||k==='niv'){const du=card.querySelector('.dx-duree>span');if(du)du.textContent=dxDureeTexte(jeuNb);}"), 'la durée suit les manches et le niveau (8 novembre, 8 h 21 et 8 h 52)');
  assert.ok(fn('jeuRoomSet').includes("go.textContent=join?'Rejoindre la partie':friends?'Ouvrir la salle':'Lancer la partie';"), 'le bouton garde son libellé');
  assert.ok(fn('jeuStart').includes("if(typeof defisFeuilleFermer==='function')defisFeuilleFermer(true);"));
  assert.ok(fn('switchTab').includes("if(name!=='defis'&&typeof defisFeuilleFermer==='function'&&document.getElementById('dx-feuille'))defisFeuilleFermer(true);"));
  assert.ok(!fn('openJeu').includes('scrollIntoView'), 'un lien d’invitation : la feuille du code, plus de défilement');
  const re = fn('perfRematch');
  assert.ok(re.includes("DEFIS.onglet='jouer';DEFIS.carte='creer';jeuSavePrefs();defisPeindre();") && re.includes("document.querySelector('#dx-feuille .room-go')"), '« Les redéfier » : la feuille Créer, son bouton fait signe');
  assert.ok(secu.includes("const button = document.querySelector('#dx-feuille .room-go') || document.querySelector('.screen.active .room-go');"), 'la vérification en ligne grise le bouton de la feuille');
  assert.ok(app.includes("document.querySelector('.lq-ask.on,#lesson-video,#dx-feuille'))return false;"));
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

/* Elisa, 8 novembre, 8 h 21 (sa maquette de « Joue seul », « 10 min de jeu stp par manche ») : toucher une carte de manches change la
   durée annoncée dessous ; le bouton reste « Lancer la partie ». */
test('8 novembre : en Moyen, 5 manches annoncent « Jusqu’à 1 h 15 de jeu », 3 manches 45 min ; le bouton reste « Lancer la partie »', () => {
  const span = {textContent: 'Jusqu’à 10\u00a0min de jeu'}, go = {textContent: 'Lancer la partie'};
  const carte = v => ({dataset: {v: String(v)}, disabled: false, attrs: {}, on: false,
    classList: {toggle(c, on) { if (c === 'on') carte.parent[v].on = !!on; }}, setAttribute(k, x) { this.attrs[k] = String(x); }});
  carte.parent = {};
  const nbs = [1, 3, 5].map(v => (carte.parent[v] = carte(v)));
  const card = {querySelector: q => q === '.dx-duree>span' ? span : q === '.room-go span' ? go : null, querySelectorAll: q => q.includes('data-set="nb"') ? nbs : []};
  const ctx = vm.createContext({document: {querySelector: q => q === '#dx-feuille .dx-f-corps' ? card : null, getElementById: () => null},
    JEU_NIVL: {f: 'Facile', m: 'Moyen', d: 'Difficile'}, jeuChallenges: () => [1, 2, 3, 4, 5], jeuNiv: 'm', jeuNb: 1, jeuMode: 'solo', jeuVis: 'pub', jeuNivUser: false,
    jeuSavePrefs() {}, navigator: {}, JEU_NIV_MANCHE: {f: 600000, m: 900000, d: 1200000}});
  vm.runInContext(fn('jeuRoomSet') + line('dxDureeTexte') + line('jeuDureeMs'), ctx);
  ctx.jeuRoomSet('nb', 5);
  assert.equal(span.textContent, 'Jusqu’à 1\u00a0h\u00a015 de jeu', '15 min par manche en Moyen (8 h 52)');
  assert.equal(go.textContent, 'Lancer la partie');
  assert.deepEqual(nbs.map(b => [b.attrs['aria-checked'], b.on]), [['false', false], ['false', false], ['true', true]]);
  assert.equal(ctx.jeuNb, 5);
  ctx.jeuRoomSet('nb', 3);
  assert.equal(span.textContent, 'Jusqu’à 45\u00a0min de jeu');
});
