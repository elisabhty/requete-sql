/* Elisa, 7 novembre, 21 h 44 : sa relecture des trois écrans de Défis (Jouer, Classement, Joueurs). « L’identité visuelle est cohérente […]
   je simplifierais certains textes et je rendrais les actions principales plus évidentes. » Jouer : « Lance un défi ! », « Créer ma
   partie », « Rejoindre avec un code », « Jouer en solo », les multiplicateurs ×1, ×2, ×4 plus visibles. Classement : un état vide plus
   motivant, « Ta place dans le classement », un bouton « Jouer un défi », plus « Depuis lundi ». Joueurs : « Tes adversaires », « Pas
   encore d’adversaire ! », « Ajouter par pseudo », « Partager une invitation », plus la note technique. L’intro : « 477 défis. Des
   adversaires. Une place à décrocher. » Et surtout des liens entre les trois : depuis le classement, défier quelqu’un ; une fiche joueur
   avec ses scores ; après une partie, retrouver tout de suite ses adversaires.
   Vérifié dans Chrome (390 px de large) : les trois onglets vides et remplis, la fiche ouverte du classement et de tes adversaires. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const fn = (name, next = '\n}\n') => { const i = app.lastIndexOf(`function ${name}(`); assert.ok(i > 0, name); const j = app.indexOf(next, i); assert.ok(j > i, next); return app.slice(i, j); };
const DEBUT = '/* ---------- Les défis en trois onglets : Jouer, Classement, Amis ----------';
const bloc = app.slice(app.indexOf(DEBUT), app.indexOf('function showScreen(){', app.indexOf(DEBUT)));

/* Le bloc des onglets dans un bac à sable (comme retours-1137), avec de quoi poser la feuille de la fiche. */
function bac(o = {}) {
  const els = {}, appels = [], poses = [];
  const el = id => els[id] || (els[id] = { id, innerHTML: '', textContent: '', hidden: false, disabled: false, value: '', classList: { toggle() {}, add() {}, remove() {} },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, getBoundingClientRect: () => ({ top: 0 }), focus() {}, children: [] });
  const ctx = vm.createContext({
    state: { salle: Object.assign({ pseudo: '@elisa_sql', pts: 0 }, o.salle || {}), profile: { pays: 'FR' } },
    save() {}, localStorage: { getItem: () => null }, navigator: {}, Date, Math, JSON, Promise, Number, Object, Array, Set, Map, String, RegExp,
    window: {},
    document: { getElementById: id => [...(o.absents || []), 'dx-feuille'].includes(id) ? null : el(id), querySelector: () => null, querySelectorAll: () => [], hidden: false,
      activeElement: null, addEventListener() {}, body: { appendChild: x => poses.push(x) },
      createElement: () => ({ dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, innerHTML: '', querySelector: () => null }) },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {}, requestAnimationFrame: f => f(),
    jeuSavedNom: () => '@elisa_sql', paysDuProfil: () => 'FR', paysMontre: () => true, paysNom: c => c, paysDrapeau: c => `[${c}]`, salleKpi: () => ({ pts: 0 }), sallePts: n => `${n} pts`,
    clsOn: () => o.clsOn !== false, clsCle: () => 'K'.repeat(32), clsSalle() { return ctx.state.salle; }, clsPts: n => String(n), clsQuitter() {}, psPage() {},
    clsRpc: (f, b) => { appels.push([f, b]); return o.rpcKo ? Promise.reject(new Error('net')) : Promise.resolve(o.rpc ? o.rpc(f, b) : {}); },
    esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), escAttr: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
    jeuInitial: n => String(n || '?').replace(/^@+/, '').charAt(0).toUpperCase(), perfColor: () => 2, lqStkSvg: k => `<svg data-k="${k}"></svg>`, chatBonusHtml: k => `<img data-k="${k}">`,
    JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' }, JEU_NIV_X: { f: 1, m: 2, d: 4 }, jeuChallenges: () => [1, 2, 3], jeuNivAuto: () => 'f', jeuNiv: 'm', jeuNivUser: true,
    DEF_CHEV_SVG: '<svg data-k="chev"></svg>', CLS_FLAG_SVG: '<svg data-k="flag"></svg>', LQ_X_SVG: '<svg data-k="x"></svg>', perfDay: () => 'Hier', CHALLENGES: [1], SQL: {},
    jeuStart: (...a) => { appels.push(['jeuStart', ...a]); }, jeuPseudoPuis: f => f(), jeuRand: () => 'NOUV01', jeuNom: v => String(v || '').trim(),
    psForme: v => { const h = String(v || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 15); return h ? '@' + h : ''; },
    psLibre: () => Promise.resolve({ ok: false }), lqSay: t => appels.push(['say', t]), buzz() {}, lqAsk: () => Promise.resolve(false),
    prefersReduceMotion: () => true, renderDefisRoom() {}, jeuSavePrefs() {}, renderCompte() {}, jeuPaint() {}, JEU: null, activeTab: 'defis', jeuInvite: '',
    defisActionsHTML: () => '<p class="dx-ou"></p><div class="dx-actions"></div>',
    accord: (f, h, n) => o.genre === 'f' ? f : o.genre === 'h' ? h : n,
    dxFeuilleTouche() {}, dxFeuilleCaler() {}, dxFeuilleRetour: null, defisFeuilleFermer: s => appels.push(['fermer', !!s]),
  });
  vm.runInContext(bloc, ctx);
  return { ctx, els, el, appels, poses, ev: c => vm.runInContext(c, ctx) };
}
const attendre = () => new Promise(r => setImmediate(r));
const J = v => JSON.parse(JSON.stringify(v));

test('Jouer : « Lance un défi ! », « Créer ma partie », « Rejoindre avec un code », « Jouer en solo » ; les feuilles reprennent le bouton touché (le code : « Rejoindre une partie »)', () => {
  const haut = fn('defisRapideHTML');
  assert.ok(haut.includes('<h2 id="dx-rapide-h">Lance un défi&nbsp;!</h2>') && haut.includes('<span>Créer ma partie</span>'));
  const tuiles = fn('defisActionsHTML');
  /* Refonte du 7 novembre (designers) : deux boutons secondaires sous « Créer ma partie », plus de « ou » ni de tuiles. */
  assert.ok(tuiles.includes("${b('code','rocket','Rejoindre avec un code')}${b('seul','clock','Jouer en solo')}") && !tuiles.includes('<small>') && !tuiles.includes('dx-ou'), 'un libellé chacune, sans petite ligne');
  assert.ok(app.includes("const tete=join?['Rejoindre une partie',") && app.includes(":friends?['Créer ma partie','Ta salle de défi',") && app.includes(":['Mode solo','Joue seul',"), 'seul : « Mode solo », d’après sa maquette (8 novembre, 8 h 21)');
  for (const vieux of ["'J’ai un code','rejoindre un ami'", "'Seul','entraînement'", '<span>Créer une salle</span>', '<h2 id="dx-rapide-h">Ta salle de défi</h2>', "['Entraînement','Joue seul',"])
    assert.ok(!app.includes(vieux), vieux);
  /* « Aucune salle à ton niveau ? » : seulement quand il n’y en a aucune à ce niveau (déjà le cas) */
  assert.ok(fn('sallesSectionHTML').includes("corps=ici.length?`<ul class=\"dx-list\">${ici.map(s=>salleLigneHTML(s)).join('')}</ul>`\n      :`<p class=\"dx-vide is-aucune\">Aucune salle à ton niveau&nbsp;?"));
});

test('Jouer : ce que rapporte un niveau, plus visible : « ×2 pts » (plus « Plus c’est dur, plus ça rapporte » depuis le 8 novembre)', () => {
  const c = bac();
  const haut = c.ev('defisRapideHTML()');
  /* 8 novembre, 0 h 23 : « enlever le plus c’est dur plus ça rapporte » ; ×1, ×2, ×4 le disent sous chaque niveau. */
  assert.ok(haut.includes('<div class="dx-niv-tete"><p class="jeu-lab" id="dx-niv-l">Niveau</p></div>') && !app.includes('<span class="dx-niv-plus">'));
  /* 8 novembre, 11 h 08 (« ce niveau premium ») : la pièce de « Ta salle de défi » puis ×N (retours-premium-defis) */
  assert.deepEqual([...haut.matchAll(/<span class="room-lv-x" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true">[\s\S]*?<\/svg>(×\d)<small>pts<\/small><\/span>/g)].map(m => m[1]), ['×1', '×2', '×4']);
  assert.ok(haut.includes('aria-label="Difficile, points multipliés par 4"'), 'toujours lu en toutes lettres');
  for (const k of ['html.lq #scr-defis .dx-niv-tete{display:flex;align-items:baseline;justify-content:space-between;', 'html.lq #scr-defis .dx-niv-plus{color:var(--accent-ink);',
    'html.lq .room-level .room-lv-x{gap:2px;min-width:44px;padding:4px 10px;font-size:15px}', 'html.lq .room-level .room-lv-x small{'])
    assert.ok(lq.includes(k), k);
});

test('l’intro des trois écrans : « 477 défis. Des adversaires. Une place à décrocher. »', () => {
  assert.ok(fn('renderDefis').includes('sub.textContent=`${all.length} défis. Des adversaires. Une place à décrocher.`;'));
  assert.ok(app.includes('<p class="sub" id="defis-sub">Des défis. Des adversaires. Une place à décrocher.</p>'));
  assert.ok(!app.includes('défis pour te tester. Joue en solo, défie d’autres joueurs et grimpe dans le classement.`') && !app.includes('>Des défis pour te tester.'), 'l’ancienne phrase n’est plus qu’un souvenir, en commentaire');
});

test('Classement vide : « Le classement n’attend que toi ! 🏆 », puis la phrase de la période, accordée', async () => {
  const vide = { lignes: [], total: 0, moi: null, rangs: { monde: null, pays: null, mon_pays: 'FR' } };
  const phrase = async (genre, periode, portee) => {
    const c = bac({ genre, rpc: f => f === 'jeu_classement_v2' ? vide : {} });
    c.ev(`DEFIS.periode='${periode}';DEFIS.portee='${portee}';defisClassementPeindre()`); await attendre();
    return { pager: c.els['dx-pager'].innerHTML, k: c.els['dx-cls-k'].textContent, place: c.els['dx-place'].innerHTML };
  };
  let r = await phrase('f', 'semaine', 'monde');
  assert.ok(r.pager.includes('<p class="dx-vide-t">Le classement n’attend que toi&nbsp;! <span aria-hidden="true">🏆</span></p><p class="perf-top-msg">Sois la première à marquer des points cette semaine.</p>'));
  /* Plus « Depuis lundi » (« Cette semaine » est déjà choisi juste au-dessus) ; refonte du 7 novembre : la légende « 5 joueurs classés »
     remplace le surtitre, et se tait tant que personne n’est classé. La mascotte au trophée au-dessus du titre. */
  assert.equal(r.k, '');
  assert.ok(r.pager.startsWith('<div class="dx-vide-bloc is-cls"><img data-k="trophee"><p class="dx-vide-t">'));
  assert.ok((await phrase('h', 'semaine', 'monde')).pager.includes('Sois le premier à marquer des points cette semaine.'));
  assert.ok((await phrase('', 'semaine', 'monde')).pager.includes('Marque les premiers points de la semaine.'), 'sans genre connu : une phrase qui n’en a pas besoin');
  assert.ok((await phrase('h', 'tout', 'monde')).pager.includes('Sois le premier à marquer des points.'));
  assert.ok((await phrase('', 'tout', 'pays')).pager.includes('Marque les premiers points dans ton pays.'));
  assert.ok((await phrase('f', 'tout', 'pays')).pager.includes('Sois la première à marquer des points dans ton pays.'));
  r = await phrase('', 'tout', 'amis');
  /* 22 h 09 : la pastille dit « Mes amis », la phrase aussi */
  /* 8 novembre, 14 h 48 (« je veux marcher qu’avec code ») : plus d’ajout dans l’onglet Joueurs, on y invite avec un code */
  assert.ok(r.pager.includes('Aucun de tes amis n’est encore classé. Joue avec eux&nbsp;: invite-les avec un code depuis l’onglet Joueurs.') && !r.pager.includes('dx-vide-t'), 'Mes amis : la phrase qui dit quoi faire');
  assert.ok(!app.includes("'Depuis lundi'") && !app.includes('Personne n’a encore marqué de points cette semaine'));
  for (const k of ['html.lq #scr-defis .dx-vide-t{margin:0 0 4px;color:var(--ink);font:800 16px/1.3 var(--display);', 'html.lq #scr-defis .dx-vide-bloc{'])
    assert.ok(lq.includes(k), k);
});

test('Classement : « Ta place dans le classement », et « Jouer un défi » d’ici, classé ou pas encore', async () => {
  const go = '<button type="button" class="room-go dx-cls-go" onclick="defisOnglet(\'jouer\')"><span>Jouer un défi</span><svg data-k="chev"></svg></button>';
  let c = bac({ rpc: f => f === 'jeu_classement_v2' ? { lignes: [], total: 0, moi: null } : {} });
  c.ev("DEFIS.periode='tout';defisClassementPeindre()"); await attendre();
  assert.ok(c.els['defis-classement'].innerHTML.includes('<p class="dx-h3" id="dx-place-h">Ta place dans le classement</p><div id="dx-place"></div>'));
  /* Refonte du 7 novembre : personne de classé, l’état vide dit déjà tout ; ici, seulement le bouton (le titre se cache). */
  assert.equal(c.els['dx-place'].innerHTML, go);
  assert.equal(c.els['dx-place-h'].hidden, true);
  const autres = [{ id: 'a', pseudo: '@lea', pts: 90, parties: 3, rang: 1, moi: false }];
  c = bac({ rpc: f => f === 'jeu_classement_v2' ? { lignes: autres, total: 1, moi: null } : {} });
  c.ev("DEFIS.periode='tout';defisClassementPeindre()"); await attendre();
  assert.equal(c.els['dx-place'].innerHTML, `<p class="perf-top-msg">Termine un défi pour décrocher ta place.</p>${go}`);
  assert.equal(c.els['dx-place-h'].hidden, false);
  c.ev("DEFIS.periode='semaine';DEFIS.cls.cle='';defisClassementPeindre()"); await attendre();
  assert.ok(c.els['dx-place'].innerHTML.startsWith('<p class="perf-top-msg">Termine un défi cette semaine pour décrocher ta place.</p>'));
  c = bac({ rpc: f => f === 'jeu_classement_v2' ? { lignes: [{ id: 'm', pseudo: '@elisa_sql', pts: 40, parties: 2, rang: 1, moi: true }], total: 1, moi: { rang: 1, pts: 40, page: 0 } } : {} });
  c.ev("DEFIS.periode='tout';defisClassementPeindre()"); await attendre();
  /* 8 novembre, 11 h 08 (« ce niveau premium ») : ta place dans le bandeau violet de la feuille, puis le bouton (retours-premium-defis) */
  const tete = c.els['dx-place'].innerHTML;
  assert.ok(tete.startsWith('<div class="dx-bande dx-place-bande" role="group" aria-labelledby="dx-place-t">') && tete.includes('<h2 id="dx-place-t">🥇 1<sup>er</sup> mondial</h2><p class="room-sub">Tu es en tête du classement.</p>')
    && tete.includes('<span>40\u00a0pts</span>') && tete.endsWith(go) && !tete.includes('dx-list'), 'classé : sa place (sa ligne est déjà dans la page), puis le bouton, pour grimper');
  assert.equal(c.els['dx-place-h'].hidden, true, 'le bandeau dit « Ta place »');
  /* Classé derrière quelqu’un : l’écart avec le joueur juste devant */
  c = bac({ rpc: f => f === 'jeu_classement_v2' ? { lignes: [autres[0], { id: 'm', pseudo: '@elisa_sql', pts: 40, parties: 2, rang: 2, moi: true }], total: 2, moi: { rang: 2, pts: 40, page: 0 } } : {} });
  c.ev("DEFIS.periode='tout';defisClassementPeindre()"); await attendre();
  assert.ok(c.els['dx-place'].innerHTML.includes('<h2 id="dx-place-t">🥈 2<sup>e</sup> mondial</h2><p class="room-sub">50&nbsp;pts te séparent de @lea, 1<sup>er</sup>.</p>'));
  /* Pas encore au classement, ou sans pseudo : leur bouton à eux, pas deux boutons */
  c = bac({ clsOn: false }); c.ev('clsPlacePeindre()');
  assert.ok(!c.els['dx-place'].innerHTML.includes('Jouer un défi'));
  assert.ok(lq.includes('html.lq #scr-defis .dx-cls-go{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:12px}'));
});

test('Joueurs : « Tes adversaires », « Ton prochain rival t’attend ! », « Inviter un ami » seul (8 novembre, 14 h 48 : « je veux marcher qu’avec code »)', () => {
  const c = bac();
  c.ev("DEFIS.onglet='amis';defisPeindre()");
  assert.ok(c.els['defis-tabs'].innerHTML.includes('onclick="defisOnglet(\'amis\')">Joueurs</button>'), 'l’onglet garde son nom');
  const a = c.els['defis-amis'].innerHTML;
  /* 22 h 13 : le surtitre « Tes adversaires » ; vide, le titre (8 novembre, 14 h 40) : « Ton prochain rival t’attend ! » */
  assert.ok(a.includes('<section class="dx-amis is-v2 is-vide" aria-labelledby="dx-amis-k">') && a.includes('<p class="room-kicker" id="dx-amis-k">Tes adversaires</p><h2 id="dx-amis-h">Ton prochain rival t’attend&nbsp;!</h2>'));
  assert.ok(!app.includes('Ceux que tu as affrontés</p>'));
  /* 14 h 48 : on se retrouve avec un code de salle, rien d’autre : un seul bouton, « Inviter un ami » (une salle privée, son code) */
  assert.ok(a.includes('<div class="dx-duo is-un"><button type="button" class="dx-sec is-main" onclick="jeuDefier()">Inviter un ami</button></div>'));
  for (const k of ['>Rechercher un joueur</button>', '>Ajouter par pseudo</button>', 'id="dx-ajout"', 'for="dx-ajout-in"', 'function amisAjouter(', 'function amisGarder(', 'function amisRetirer('])
    assert.ok(!app.includes(k), `plus d’ajout par pseudo : ${k}`);
  /* Vide : la mascotte, la phrase, puis le bouton ; remplie (refonte du 7 novembre) : le bouton au-dessus de la liste. */
  assert.ok(a.indexOf('id="dx-amis-liste"') < a.indexOf('Inviter un ami'));
  assert.ok(!a.includes('dx-note') && !app.includes('Un adversaire s’ajoute tout seul après une partie.'), 'plus l’explication sur l’ajout automatique et le code de salle');
  /* La mascotte dans l’espace vide de la carte (22 h 13 : elle saluait ; 8 novembre, 14 h 27 : le duel, joué une fois), puis la phrase */
  assert.equal(c.els['dx-amis-liste'].innerHTML, '<div class="dx-vide-bloc is-amis"><img data-k="duel"><p class="dx-vide">Chaque joueur affronté en salle arrive ici. Invite un ami&nbsp;: il te rejoint avec ton code.</p></div>');
  assert.ok(fn('amisListesPeindre').includes("chatBonusHtml('duel','is-vide dx-amis-chat')"));
  for (const k of ['html.lq #scr-defis .dx-vide-bloc.is-amis{margin:2px 2px 0;text-align:center}', 'html.lq #scr-defis .dx-vide-bloc.is-amis .chat-bonus{display:block;width:96px;'])
    assert.ok(lq.includes(k), k);
  /* Remplie : seulement ceux avec qui tu as joué (un ancien ajout par pseudo ne s’affiche plus) ; la liste n’a pas de titre à elle */
  const d = bac({ salle: { mates: { tom: { n: '@tom', g: 4, w: 3, l: 1, at: 5 } }, amisAjoutes: [{ n: '@lea', at: 9 }] } });
  d.ev("DEFIS.onglet='amis';defisPeindre()");
  assert.ok(d.els['dx-amis-liste'].innerHTML.startsWith('<ul class="dx-list dx-adv">'));
  assert.ok(!d.els['dx-amis-liste'].innerHTML.includes('@lea') && !d.els['dx-amis-liste'].innerHTML.includes('×'), 'plus d’ajoutés, plus de ×');
  assert.ok(d.els['defis-amis'].innerHTML.indexOf('Inviter un ami') < d.els['defis-amis'].innerHTML.indexOf('id="dx-amis-liste"'), 'remplie : le bouton au-dessus');
  assert.ok(d.els['defis-amis'].innerHTML.includes('<h2 id="dx-amis-h">1 adversaire</h2>'), 'remplie : le titre dit combien');
  for (const k of ['html.lq #scr-defis .dx-amis .dx-duo{flex-direction:column;gap:10px}', 'html.lq #scr-defis .dx-sec.is-main{border-color:var(--accent);background:var(--accent);',
    'html.lq #scr-defis .dx-amis.is-v2 .dx-amis-actions .dx-duo{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;margin:0}'])
    assert.ok(lq.includes(k), k);
});

test('depuis le classement : une ligne se touche (ou son nom au clavier) et ouvre la fiche du joueur, pour le défier', async () => {
  const lignes = [{ id: 'a1', pseudo: '@lea', pays: 'BE', pts: 1240, parties: 37, rang: 1, moi: false }, { id: 'me', pseudo: '@elisa_sql', pts: 30, parties: 1, rang: 2, moi: true }];
  const c = bac({ salle: { mates: { lea: { n: '@lea', g: 4, w: 3, l: 1, at: 9 } } }, rpc: f => f === 'jeu_classement_v2' ? { lignes, total: 2, moi: { rang: 2, pts: 30, page: 0 } } : {} });
  c.ev("DEFIS.periode='tout';DEFIS.portee='monde';defisClassementPeindre()"); await attendre();
  const pages = c.ev('DEFIS.cls.pages[0].map(clsLigneHTML)');
  assert.ok(pages[0].startsWith('<li class="is-tap is-r1" style="--i:0" onclick="if(!event.target.closest(\'button\'))dxFicheCls(\'a1\')">'), 'toute la ligne');
  assert.ok(pages[0].includes('<button type="button" class="dx-t dx-t-btn" onclick="dxFicheCls(\'a1\')" aria-label="@lea, 1er, 1240 points\u00a0: voir sa fiche"><b>@lea</b><small>37\u00a0parties</small></button>'), 'et son nom, au clavier');
  /* Refonte du 7 novembre : plus de drapeau « Signaler » sur chaque ligne (il passe dans la fiche) ; une flèche dit que la ligne s’ouvre. */
  assert.ok(!pages[0].includes('clsSignalerV2') && pages[0].includes('<span class="dx-go" aria-hidden="true"><svg data-k="chev"></svg></span></li>'));
  assert.ok(!pages[1].includes('dxFicheCls') && !pages[1].includes('dx-go') && pages[1].includes('<span class="dx-t"><b>@elisa_sql</b><small><i>Toi</i> · 1\u00a0partie</small></span>'), 'sa propre ligne : rien à ouvrir');
  c.ev("dxFicheCls('a1')");
  const n = c.appels.length;
  const h = c.ev('dxFicheHTML()');
  /* 22 h 19 : « Profil du joueur », « 🥇 N° 1 mondial », « parties jouées », « Dernier duel : hier » */
  assert.ok(h.includes('<p class="room-kicker">Profil du joueur</p>') && h.includes('<h2 id="dx-f-t">@lea</h2>') && h.includes('<p class="room-sub dx-f-pcs" id="dx-f-p"><span class="dx-pc is-blanc"><span>🥇 N°\u00a01 mondial</span></span>'));
  assert.ok(h.includes('<div><b>1240</b><small>points</small></div><div><b>37</b><small>parties jouées</small></div>'), 'depuis toujours : ses chiffres déjà là');
  assert.ok(h.includes('<div class="dx-duel-score" aria-hidden="true"><span><b>1</b><small>@lea</small></span><i>–</i><span class="is-tete"><b>3</b><small>Toi</small></span></div>'), 'ses victoires sous son pseudo, les tiennes sous « Toi »');
  assert.ok(h.includes('aria-label="Face à face\u00a0: @lea 1 victoire, toi 3 victoires, en 4 confrontations"') && h.includes('<div class="dx-fiche-duel is-up"'));
  assert.ok(h.includes('<p class="dx-duel-voir">4 confrontations</p>'), 'sans parties gardées avec lui : le nombre, sans liste à déplier');
  assert.ok(h.includes('<p class="dx-fiche-h2h">Dernier duel&nbsp;: hier</p>'));
  assert.ok(h.includes('<button type="button" class="dx-fiche-signal" onclick="dxFicheSignaler(\'a1\')">Signaler ce pseudo</button>'), 'ouverte du classement : « Signaler ce pseudo »');
  assert.ok(h.includes('onclick="dxFicheDefier()"><span>Défier @lea</span>') && !h.includes('dx-fiche-ajout'), 'il mène pas : « Défier » ; déjà dans tes adversaires : pas de « Ajouter »');
  assert.equal(c.appels.filter(x => x[0] === 'jeu_classement_v2').length, 1, 'rien de plus à demander');
  assert.equal(c.appels.length, n);
  c.ev('dxFicheDefier()');
  assert.deepEqual(J(c.appels.slice(-2)), [['fermer', true], ['jeuStart', 'NOUV01', true, null, { nomId: 'jeu-nom', pub: false, pour: '@lea' }]], 'la feuille se ferme, puis une salle privée pour lui');
});

test('la fiche d’un adversaire : ses points demandés à la base (lui seul), votre face-à-face ; sans connexion, « — »', async () => {
  const c = bac({ salle: { mates: { tom: { n: '@tom', g: 2, w: 0, l: 2, at: 9 } } },
    rpc: (f, b) => f === 'jeu_classement_v2' ? { lignes: [{ id: 't', pseudo: '@tom', pays: 'CH', pts: 980, parties: 22, rang: 1, moi: false }, { id: 'me', pseudo: '@elisa_sql', pts: 30, parties: 1, rang: 2, moi: true }], total: 2 } : {} });
  c.ev("DEFIS.onglet='amis';defisPeindre()");
  const l = c.els['dx-amis-liste'].innerHTML;
  assert.ok(l.includes('<li class="is-tap" style="--i:0" onclick="if(!event.target.closest(\'button\'))dxFiche(\'@tom\')">') && l.includes('<button type="button" class="dx-t dx-t-btn" onclick="dxFiche(\'@tom\')" aria-label="@tom, 0 fois devant, 2 fois derrière\u00a0: voir sa fiche">'));
  assert.ok(l.includes("onclick=\"jeuDefier('@tom')\""), '« Défier » reste sur la ligne');
  c.ev("dxFiche('@tom')");
  assert.deepEqual(J(c.appels.find(x => x[0] === 'jeu_classement_v2')[1]), { p_cle: 'K'.repeat(32), p_portee: 'amis', p_periode: 'tout', p_page: 0, p_pays: null, p_pseudos: ['@tom'] });
  assert.ok(c.ev('dxFicheHTML()').includes('<div><b>…</b><small>point</small></div><div><b>…</b><small>partie jouée</small></div>'), 'le temps de la réponse');
  await attendre();
  assert.equal(c.els['dx-fiche-kpi'].innerHTML, '<div><b>980</b><small>points</small></div><div><b>22</b><small>parties jouées</small></div>');
  const h = c.ev('dxFicheHTML()');
  assert.ok(h.includes('<p class="room-sub dx-f-pcs" id="dx-f-p"><span class="dx-pc is-verre is-adv"><span>Ton adversaire</span></span></p>'), 'pas de place sans classement d’où l’on vient');
  assert.ok(h.includes('<span class="is-tete"><b>2</b><small>@tom</small></span><i>–</i><span><b>0</b><small>Toi</small></span>') && h.includes('<div class="dx-fiche-duel is-down"'));
  assert.ok(h.includes('<span>Prendre ta revanche ⚡</span>'), 'il mène (pas de partie gardée pour savoir la dernière) : la revanche');
  /* Sans connexion */
  const k = bac({ rpcKo: true });
  k.ev("dxFiche('@noe')"); await attendre();
  assert.ok(k.els['dx-fiche-kpi'].innerHTML.includes('<b>—</b>') && k.els['dx-fiche-kpi'].innerHTML.includes('Pas de connexion&nbsp;: ses points reviennent avec internet.'));
  /* Soi-même : rien */
  const m = bac(); m.ev("dxFiche('@elisa_sql')");
  assert.equal(m.ev('dxFicheEtat'), null);
});

test('la fiche d’un joueur qui n’est pas dans ta liste : « Défier » seul (8 novembre, 14 h 48 : plus « Ajouter à mes adversaires »)', async () => {
  const c = bac({ rpc: f => f === 'jeu_classement_v2' ? { lignes: [{ id: 'z', pseudo: '@zoe', pts: 5, parties: 1, rang: 3, moi: false }], total: 3, moi: null } : {} });
  c.ev("DEFIS.periode='semaine';DEFIS.portee='monde';defisClassementPeindre()"); await attendre();
  c.ev("dxFicheCls('z')");
  const h = c.ev('dxFicheHTML()');
  assert.ok(h.includes('<p class="room-sub dx-f-pcs" id="dx-f-p"><span class="dx-pc is-blanc"><span>🥉 N°\u00a03 mondial cette semaine</span></span></p>'), 'sa place, dans le classement d’où l’on vient');
  assert.ok(h.includes('onclick="dxFicheDefier()"><span>Défier @zoe</span>'));
  assert.ok(!h.includes('Ajouter à mes adversaires') && !app.includes('dxFicheAjouter') && !app.includes('amisGarder'), 'on se retrouve avec un code, pas en ajoutant un pseudo');
  assert.equal(c.appels.filter(x => x[0] === 'jeu_classement_v2' && x[1].p_portee === 'amis').length, 1, 'la semaine : ses points depuis toujours sont demandés');
  for (const k of ['html.lq .dx-feuille .dx-fiche-kpi{display:grid;', 'html.lq .dx-feuille .dx-fiche-duel{',
    'html.lq .dx-feuille .dx-fiche-av>.jeu-av{', 'html.lq #scr-defis button.dx-t-btn{margin:0;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;'])
    assert.ok(lq.includes(k), k);
  assert.ok(!lq.includes('dx-fiche-ajout') && !lq.includes('dx-ajout') && !lq.includes('dx-retirer'), 'leurs styles sont partis');
});

test('après une partie à plusieurs : « Retrouver mes adversaires » mène à l’onglet Joueurs', () => {
  const r = fn('jeuRender', '\nfunction jeuNextRound(){');
  const fin = r.slice(r.indexOf("head('Salle de défi · Fin de partie'"));
  assert.ok(fin.includes("${jeuBtn2('amis','Retrouver mes adversaires','jeuVersAdversaires()')}\n        <div id=\"jeu-netslot\">"), 'sous le podium, à plusieurs seulement');
  assert.ok(!r.slice(0, r.indexOf("head('Salle de défi · Fin de partie'")).includes('Retrouver mes adversaires'), 'pas en solo');
  assert.ok(app.includes("  amis:'<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">"), 'son icône');
  const vers = fn('jeuVersAdversaires');
  const appels = [];
  const ctx = vm.createContext({ DEFIS: { onglet: 'jouer', carte: 'code' }, jeuInvite: 'ABC123', mode: 'jeu', jeuLeaveOk: () => true, leaveLessonScreen: t => appels.push(t) });
  vm.runInContext(vers + '\n}', ctx);
  ctx.jeuVersAdversaires();
  assert.deepEqual([ctx.DEFIS.onglet, ctx.DEFIS.carte, ctx.jeuInvite, appels], ['amis', '', '', ['defis']]);
  /* Une partie pas finie : la même question que « Quitter la salle » */
  const ask = [];
  const c2 = vm.createContext({ DEFIS: { onglet: 'jouer' }, jeuInvite: '', mode: 'jeu', jeuLeaveOk: () => false, jeuLeaveAsk: f => ask.push(f), leaveLessonScreen() { throw new Error('parti'); } });
  vm.runInContext(vers + '\n}', c2);
  c2.jeuVersAdversaires();
  assert.equal(ask.length, 1); assert.equal(c2.DEFIS.onglet, 'jouer');
});

test('la fiche (22 h 19) : sa place suit le classement d’où l’on vient ; la préposition de chaque pays', async () => {
  const ligne = rang => ({ lignes: [{ id: 'q', pseudo: '@quentin', pays: 'FR', pts: 50, parties: 2, rang, moi: false }], total: 9, moi: null });
  const lieu = async (portee, periode, rang, profilPays = 'FR') => {
    const c = bac({ rpc: f => f === 'jeu_classement_v2' ? ligne(rang) : {} });
    c.ctx.paysDuProfil = () => profilPays;
    c.ctx.paysNom = k => ({ FR: 'France', CA: 'Canada', US: 'États-Unis', SG: 'Singapour', BE: 'Belgique' })[k] || k;
    c.ev(`DEFIS.portee='${portee}';DEFIS.periode='${periode}';defisClassementPeindre()`); await attendre();
    c.ev("dxFicheCls('q')");
    return c.ev('dxFicheEtat.lieu');
  };
  assert.equal(await lieu('pays', 'tout', 4), 'N°\u00a04 en France', 'premier en France n’est pas premier au monde');
  assert.equal(await lieu('pays', 'semaine', 2, 'CA'), '🥈 N°\u00a02 au Canada cette semaine');
  assert.equal(await lieu('pays', 'tout', 7, 'US'), 'N°\u00a07 aux États-Unis');
  assert.equal(await lieu('pays', 'tout', 5, 'SG'), 'N°\u00a05 à Singapour');
  assert.equal(await lieu('amis', 'tout', 2), '🥈 N°\u00a02 parmi tes amis');
  assert.equal(await lieu('monde', 'tout', 12), 'N°\u00a012 mondial');
  /* La carte du joueur (Jouer) prend la même préposition */
  assert.ok(fn('defisMoiHTML').includes('${dxRang(r.pays)} ${esc(paysEn(r.mon_pays))}'));
});

test('la fiche : « 4 confrontations » déplie vos dernières parties ; la revanche suit la dernière', () => {
  const N = 1_800_000_000_000, h = (at, mien, sien, res, niv = 'm', n = 3) => ({ at, pts: mien, n, niv, solo: 0, place: res === 'w' ? 1 : 2, players: 2,
    ppl: res === 'w' ? [{ n: '@elisa_sql', pts: mien, place: 1, me: 1 }, { n: '@lea', pts: sien, place: 2 }] : res === 'l' ? [{ n: '@lea', pts: sien, place: 1 }, { n: '@elisa_sql', pts: mien, place: 2, me: 1 }]
      : [{ n: '@elisa_sql', pts: mien, place: 1, me: 1 }, { n: '@lea', pts: sien, place: 1 }] });
  const hist = [h(N, 120, 200, 'l', 'f', 1), h(N - 9e7, 230, 195, 'w'), { at: N - 1e8, pts: 50, n: 1, niv: 'f', solo: 1, place: 0, players: 1 }, h(N - 2e8, 80, 80, 'e', 'd', 5)];
  const c = bac({ salle: { mates: { lea: { n: '@lea', g: 4, w: 2, l: 1, at: N } }, hist } });
  assert.deepEqual(J(c.ev("dxDuels('@lea').map(d=>d.res+d.moi+'-'+d.lui)")), ['l120-200', 'w230-195', 'e80-80'], 'les parties avec lui seulement, les plus récentes d’abord');
  c.ev("dxFiche('@lea')");
  const f = c.ev('dxFicheHTML()');
  assert.ok(f.includes('<button type="button" class="dx-duel-voir" aria-expanded="false" aria-controls="dx-fiche-duels" onclick="dxFicheDuels(this)"><span>4 confrontations</span>'));
  assert.ok(f.includes('<div class="dx-duel-plus" id="dx-fiche-duels" hidden><ol class="dx-duel-liste"><li class="is-l"><b>Perdue</b><span>120&nbsp;pts contre 200</span><small>Hier · Facile · 1 manche</small></li><li class="is-w"><b>Gagnée</b><span>230&nbsp;pts contre 195</span>'));
  assert.ok(f.includes('<li class="is-e"><b>Égalité</b>') && f.includes('<p class="dx-duel-note">Seules tes 12 dernières parties sont gardées.</p></div>'), 'trois parties gardées pour quatre jouées : on le dit');
  assert.ok(f.includes('<span>Prendre ta revanche ⚡</span>'), 'la dernière est perdue : la revanche, même s’il est derrière au total');
  /* Déplier, replier */
  const l = { hidden: true }, b = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  c.ctx.document.getElementById = id => id === 'dx-fiche-duels' ? l : null;
  c.ev('dxFicheDuels')(b); assert.equal(l.hidden, false); assert.equal(b.attrs['aria-expanded'], 'true');
  c.ev('dxFicheDuels')(b); assert.equal(l.hidden, true); assert.equal(b.attrs['aria-expanded'], 'false');
  /* La dernière gagnée : « Défier », même s’il mène au total */
  const d = bac({ salle: { mates: { lea: { n: '@lea', g: 3, w: 1, l: 2, at: N } }, hist: [h(N, 300, 100, 'w'), h(N - 1e7, 10, 90, 'l'), h(N - 2e7, 10, 90, 'l')] } });
  d.ev("dxFiche('@lea')");
  assert.ok(d.ev('dxFicheHTML()').includes('<span>Défier @lea</span>') && !d.ev('dxFicheHTML()').includes('dx-duel-note'), 'toutes gardées : pas de note');
  /* Jamais affronté : « Défier », pas de face-à-face */
  const e = bac(); e.ev("dxFiche('@noe')");
  assert.ok(e.ev('dxFicheHTML()').includes('<span>Défier @noe</span>') && !e.ev('dxFicheHTML()').includes('dx-fiche-duel'));
  for (const k of ['html.lq .dx-feuille .dx-duel-score{display:grid;', 'html.lq .dx-feuille .dx-duel-plus[hidden]{display:none}', 'html.lq .dx-feuille .dx-duel-liste li.is-l b{color:#C2323A}',
    'html.lq .dx-feuille button.dx-duel-voir[aria-expanded="true"] svg{rotate:90deg}'])
    assert.ok(lq.includes(k), k);
});

/* Refonte du 7 novembre, 22 h 30 – 23 h 46 : « il faut que quelqu’un m’aide pour la partie design/product design sur la partie défi ».
   Un designer produit (structure, parcours, états) et un designer visuel (la DA du site) ; Elisa (« ok ») garde son ordre et prend le
   sous-titre court. Vérifié dans Chrome à 320, 375 et 390 px : « Créer ma partie » visible sans défiler à 390 × 844, plein ou vide. */
test('refonte — Jouer : le bandeau court, les salles du niveau puis « Créer ma partie », et « Voir les autres salles »', () => {
  const c = bac({ niv: 'd' });
  c.ev("DEFIS.salles=[{code:'AAA111',niv:'f',manches:1,nb:2,max:5,hote:'@kev',joueurs:[]},{code:'BBB222',niv:'m',manches:3,nb:3,max:5,hote:'@lea',joueurs:[]}];jeuNiv='d'");
  const h = c.ev('defisRapideHTML()');
  assert.ok(h.includes('<p class="room-sub">Choisis ton niveau et invite jusqu’à 4 joueurs, ou ouvre ta salle à tous. Tout le monde relève le même défi&nbsp;!</p>'), '8 novembre, 0 h 17 : « je veux garder ça », la phrase entière');
  const i = k => h.indexOf(k);
  assert.ok(i('id="dx-niv-l"') < i('id="dx-rejoindre"') && i('id="dx-rejoindre"') < i('data-k="creer"') && i('data-k="creer"') < i('class="dx-actions"') && i('class="dx-actions"') < i('id="dx-autres"'),
    'l’ordre d’Elisa (5 novembre, 12 h 52) : le niveau, les salles du niveau, « Créer ma partie », les deux boutons, les autres niveaux');
  assert.ok(h.includes('<button type="button" class="dx-ancre" onclick="dxVoirAutres()">Voir les 2 autres salles<svg data-k="chev"></svg></button>'));
  assert.ok(!fn('defisActionsHTML').includes('dx-ou'), 'plus de « ou »');
  /* Le lien descend aux autres niveaux et y pose le focus */
  const vu = [], titre = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus: o => vu.push(['focus', o]) };
  c.el('dx-autres').scrollIntoView = o => vu.push(['scroll', o]); c.el('dx-autres').querySelector = s => s === '.dx-h3' ? titre : null;
  c.ev('dxVoirAutres()');
  assert.deepEqual(J(vu), [['scroll', { block: 'start', behavior: 'auto' }], ['focus', { preventScroll: true }]], 'mouvement réduit : sans glisser');
  assert.equal(titre.attrs.tabindex, '-1');
  /* Une seule autre salle : « Voir l’autre salle » ; aucune ailleurs : pas de lien */
  c.ev("DEFIS.salles=[{code:'AAA111',niv:'f',manches:1,nb:2,max:5,hote:'@kev',joueurs:[]}]");
  assert.ok(c.ev('sallesSectionHTML()').includes('>Voir l’autre salle<'));
  c.ev("DEFIS.salles=[]");
  assert.ok(!c.ev('sallesSectionHTML()').includes('dx-ancre'));
});

test('refonte — Classement : la légende, une page sans navigation, l’écart avec le joueur devant, chaque message garde son action', async () => {
  const L = [['@lea', 1240], ['@max', 980], ['@sam', 640], ['@nora', 420], ['@elisa_sql', 310]].map(([pseudo, pts], k) => ({ id: 'i' + k, pseudo, pts, parties: 3, rang: k + 1, moi: k === 4 }));
  const c = bac({ rpc: f => f === 'jeu_classement_v2' ? { lignes: L, total: 5, moi: { rang: 5, pts: 310, page: 0 } } : {} });
  const nav = { hidden: false };
  c.el('dx-prev').closest = s => s === '.dx-nav' ? nav : null;
  c.ev("DEFIS.periode='tout';DEFIS.portee='monde';defisClassementPeindre()"); await attendre();
  const sec = c.els['defis-classement'].innerHTML;
  assert.ok(sec.startsWith('<section class="dx-cls is-v2" aria-labelledby="dx-cls-h"><h2 class="lq-sr" id="dx-cls-h">Classement</h2>') && !sec.includes('perf-card') && !sec.includes('Tous les joueurs'), 'plus de carte ni de titre qui répète l’onglet (il reste pour le lecteur d’écran)');
  assert.equal(c.els['dx-cls-k'].textContent, '5 joueurs classés', 'la légende, dès la première réponse');
  assert.equal(nav.hidden, true, 'une seule page : ni flèches ni « 1 à 5 sur 5 »');
  const place = c.els['dx-place'].innerHTML.split('<button')[0];
  assert.ok(place.includes('<h2 id="dx-place-t">5<sup>e</sup> mondial</h2><p class="room-sub">110&nbsp;pts te séparent de @nora, 4<sup>e</sup>.</p>') && !place.includes('dx-list') && !place.includes('dx-place-go'), 'ta ligne n’est pas répétée ; une seule page, pas de « Page 1 › »');
  /* Sans connexion : le message et « Réessayer » ; filtre pas encore servi : plus de promesse de mise à jour */
  const k = bac({ rpcKo: true }); k.ev("DEFIS.periode='tout';defisClassementPeindre()"); await attendre();
  assert.ok(k.els['dx-pager'].innerHTML.includes('il faut une connexion internet.</p><button type="button" class="perf-top-btn" onclick="DEFIS.cls.cle=\'\';clsPageCharger(0)">Réessayer</button></div>'));
  assert.ok(k.els['dx-place'].innerHTML.startsWith('<button type="button" class="room-go dx-cls-go"') && k.els['dx-place-h'].hidden, 'en dessous : seulement « Jouer un défi »');
  assert.ok(!app.includes('arrive avec la prochaine mise à jour') && fn('clsPagerPeindre').includes('Ce classement n’est pas disponible pour le moment.</p><button type="button" class="perf-top-btn" onclick="DEFIS.periode=\'tout\';defisPortee(\'monde\')">Voir le classement mondial</button>'));
  assert.ok(fn('clsPagerPeindre').includes('onclick="defisOnglet(\\\'amis\\\')">Ouvrir l’onglet Joueurs</button>'), 'Mes amis, personne de classé : l’onglet Joueurs d’un toucher');
});

test('refonte — Joueurs : une ligne par joueur ; qui attend dans une salle le dit, « Rejoindre », en tête', () => {
  const c = bac({ salle: { mates: { tom: { n: '@tom', g: 4, w: 1, l: 3, at: 9 }, zoe: { n: '@zoe', g: 2, w: 1, l: 1, at: 5 } } } });
  c.ev("DEFIS.salles=[{code:'AAA111',niv:'m',manches:1,nb:2,max:5,hote:'@zoe',joueurs:[]}];DEFIS.onglet='amis';defisPeindre()");
  const l = c.els['dx-amis-liste'].innerHTML;
  assert.ok(l.indexOf('@zoe') < l.indexOf('@tom'), 'en salle : en tête, même ajouté avant');
  assert.ok(l.includes('<li class="is-tap is-live" style="--i:0"') && l.includes('<span class="dx-dot" aria-hidden="true"></span>En salle<span class="dx-pc is-niv is-m is-blanc"><i class="jeu-bars is-m" aria-hidden="true"><b></b><b></b><b></b></i><span>Moyen</span></span><span class="dx-large"><span class="dx-pc is-gens is-doux"><svg') && l.includes('<span>2/5</span></span></span>') && l.includes("onclick=\"sallesRejoindre('AAA111')\""));
  assert.ok(l.includes('<span class="dx-score is-down" aria-hidden="true">1–3</span>') && l.includes('<em class="is-down">à rattraper</em> · hier') && l.includes("onclick=\"jeuDefier('@tom')\""));
  assert.ok(l.includes('aria-label="@zoe, 1 fois devant, 1 fois derrière, dans une salle ouverte (Moyen) : voir sa fiche"'), 'le lecteur d’écran dit tout');
  assert.ok(!c.els['defis-amis'].innerHTML.includes('perf-card') && c.els['defis-amis'].innerHTML.includes('<div class="dx-amis-actions"><div class="dx-duo is-un">'));
});

test('refonte — la fiche : « En salle maintenant » et « Rejoindre » ; ouverte du classement, « Signaler ce pseudo »', async () => {
  const c = bac({ rpc: f => f === 'jeu_classement_v2' ? { lignes: [{ id: 'a1', pseudo: '@lea', pts: 90, parties: 3, rang: 1, moi: false }], total: 1, moi: null } : {} });
  c.ev("DEFIS.salles=[{code:'AAA111',niv:'d',manches:1,nb:3,max:5,hote:'@kev',joueurs:[{pseudo:'@kev'},{pseudo:'@lea'}]}];DEFIS.periode='tout';defisClassementPeindre()"); await attendre();
  c.ev("dxFicheCls('a1')");
  const h = c.ev('dxFicheHTML()');
  assert.ok(h.includes('<div class="dx-fiche-live"><span class="dx-dot" aria-hidden="true"></span><p><b>En salle maintenant</b><small class="dx-pcs"><span class="dx-pc is-niv is-d is-blanc"><i class="jeu-bars is-d" aria-hidden="true"><b></b><b></b><b></b></i><span>Difficile</span></span><span class="dx-pc is-gens is-doux"><svg')
    && h.includes('<span>3/5</span></span></small></p><button type="button" class="dx-join" onclick="dxFicheRejoindre(\'AAA111\')"'));
  assert.ok(h.includes('aria-label="Rejoindre la salle de @kev : Difficile, 3 joueurs sur 5"'));
  assert.ok(h.indexOf('dx-fiche-live') < h.indexOf('dx-fiche-kpi') && h.indexOf('<span>Défier @lea</span>') < h.indexOf('Signaler ce pseudo'), 'le bouton validé ne change pas');
  c.ev("dxFicheRejoindre('AAA111')");
  assert.deepEqual(J(c.appels.slice(-2)), [['fermer', true], ['jeuStart', 'AAA111', false, null, { nomId: 'jeu-nom', pub: true }]], 'la fiche se ferme, puis la salle s’ouvre');
  assert.ok(fn('dxFicheSignaler').includes('defisFeuilleFermer(true);dxFicheEtat=null;') && fn('dxFicheSignaler').includes('clsSignalerV2(id)'));
});

test('refonte — la feuille de style : la DA du site sur la nouvelle structure, 44 px partout, Mes stats sans onglets', () => {
  const v2 = lq.slice(lq.indexOf('Défis — la refonte du 7 novembre'));
  assert.ok(v2.length > 40000, 'à la fin de ludique.css');
  const regles = v2.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').split('}').map(r => r.trim()).filter(r => r.includes('{') && !r.startsWith('@'));
  assert.ok(regles.every(r => /html\.lq(\[[^\]]+\])?(:not\([^)]*\))? (body )?(#scr-defis|\.dx-feuille|:is\(#scr-defis,\.dx-feuille\))/.test(r.split('{')[0].trim().replace(/^@media[^{]*\{/, ''))), 'rien hors des Défis');
  for (const k of ['html.lq #scr-defis #defis-tabs[hidden]{display:none}', 'html.lq #scr-defis .dx-nav[hidden]{display:none}',
    'html.lq #scr-defis .dx-rapide.is-v2 .dx-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;',
    'html.lq #scr-defis .dx-ancre{display:inline-flex;align-items:center;gap:4px;min-height:44px;', 'html.lq .dx-feuille .dx-fiche-signal{display:block;min-height:44px;',
    'html.lq #scr-defis .dx-chip{display:inline-flex;align-items:center;gap:6px;min-height:44px;', '--dx-swoosh:url(', '--dx-vague:url('])
    assert.ok(v2.includes(k), k);
  assert.ok(!v2.includes('Tu joues en tant que » passe en'), 'Elisa garde l’aplat violet de « Tu joues en tant que »');
  /* 8 novembre, 0 h 17 (« je veux garder ça ») : le bandeau de Jouer garde son dessin d’avant (chat à gauche, sans vague ni souligné). */
  assert.ok(!v2.includes('.dx-rapide>.room-head') && !v2.includes('.dx-rapide.is-v2>.room-head') && v2.includes('html.lq :is(#scr-defis,.dx-feuille) :not(.dx-rapide)>.room-head::after{content:"";'));
  assert.ok(fn('defisPeindre').includes("tabs.hidden=DEFIS.onglet==='stats';") && fn('defisStatsPeindre').includes(`<p class="room-kicker" id="dx-stats-k">${'$'}{nom?'Mes stats':'Tableau de bord'}</p><h2 class="dx-stats-h" id="dx-stats-h">${'$'}{nom?esc(nom):'Mes stats'}</h2>`) && !fn('defisStatsPeindre').includes('dx-retour'));
  assert.ok(app.includes("function dxParties(n){n=Math.max(0,Math.floor(+n||0));return `${n.toLocaleString('fr-FR')}\\u00a0partie${n>1?'s':''}`;}") && app.includes("d.getDate()+'\\u00a0'+['janv.',"), '« 4 parties », « 4 nov. » ne se coupent plus');
});

/* 8 novembre, 8 h 00 : « Ok pour le coefficient dans défi mais une animation ou une micro interaction qui le met en avant ». */
test('le coefficient mis en avant : il saute à l’arrivée, brille sur le niveau choisi, se fête quand on choisit (étincelles, vibration)', () => {
  assert.ok(fn('defisRapideHTML').includes('<section class="room-card dx-rapide is-v2 is-entree"') && fn('defisJouerPeindre').includes("const c=rap.querySelector&&rap.querySelector('.dx-rapide.is-entree');if(c)c.classList.remove('is-entree');},1400);"),
    'les trois pastilles sautent à l’arrivée, une fois (un choix ne rejoue pas l’arrivée)');
  assert.ok(fn('defisNiv').includes('dxCoefFete(k);') && !fn('defisNiv').includes('navigator.vibrate(6)'));
  /* Le choix : la vibration (plus forte à ×4), puis la pastille saute et six étincelles (quatre sinon) partent de son centre */
  const vu = [];
  const pastille = { offsetLeft: 30, offsetTop: 60, offsetWidth: 52, offsetHeight: 24, _fete: 0, classList: { add: k => vu.push('+' + k), remove: k => vu.push('-' + k) } };
  const carte = { querySelector: s => s === '.room-lv-x' ? pastille : null, querySelectorAll: () => [], appendChild: e => vu.push(['étincelles', e.className, e.innerHTML.split('<i>').length - 1, e.style.left, e.style.top]) };
  const ctx = vm.createContext({ buzz: t => vu.push('buzz ' + t), prefersReduceMotion: () => false, navigator: {}, setTimeout: () => 1, clearTimeout: () => {},
    document: { querySelector: s => s === '#scr-defis .dx-rapide [data-set="niv"][data-v="d"]' ? carte : null,
      createElement: () => ({ style: {}, setAttribute() {}, className: '', innerHTML: '' }) } });
  vm.runInContext(fn('dxCoefFete') + '\n}\n', ctx);
  ctx.dxCoefFete('d');
  assert.deepEqual(J(vu), ['buzz medium', '-is-pop', '+is-pop', ['étincelles', 'dx-x-fete is-fort', 6, '56px', '72px']]);
  vu.length = 0; ctx.prefersReduceMotion = () => true; ctx.dxCoefFete('d');
  assert.deepEqual(vu, ['buzz medium'], 'sans mouvement : seulement la vibration');
  for (const k of ['html.lq #scr-defis .dx-rapide.is-entree .room-level .room-lv-x{animation:dxXEntree .55s', 'html.lq #scr-defis .dx-rapide .room-level .room-lv-x.is-pop{animation:dxXPop .6s',
    'html.lq #scr-defis .dx-rapide .room-level.on .room-lv-x::after{content:"";', 'animation:dxXReflet 4.6s ease-in-out 1.2s infinite}', '@keyframes dxXEtincelle{', '@keyframes dxXOnde{',
    'html.lq[data-motion="reduce"] #scr-defis .dx-x-fete{display:none}'])
    assert.ok(lq.includes(k), k);
});
