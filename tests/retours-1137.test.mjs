/* 5 novembre, 11 h 37 (Elisa) : « Choisis ton niveau et invite jusqu’à 4 joueurs, ou ouvre ta salle à tous. Tout le monde relève le
   même défi ! » ; « Mets un peu plus en avant “les stats” en faisant bouger la flèche aussi » ; le cadre du bas : « Rejoins une partie.
   Affronte d’autres joueurs sur des défis adaptés à ton niveau. […] Aucune salle à ton niveau ? Crée la tienne et laisse les autres te
   rejoindre ! Enlever le bouton Trouver une salle » ; « Remplacer amis par joueurs » ; « Comment on marque des points → Comment sont
   calculés les points ? De façon visible stp ». Sa réponse à la question sur le bouton : « Non, en fait les salles s’affichent
   directement dans le cadre du bas, sinon “pas de salle disponible, crée la tienne” et un bouton créer plutôt que trouver. »
   Vérifié dans un navigateur (390, 375 et 320 px de large) : avec des salles au niveau choisi, sans salle à ce niveau, sans salle. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), sw = lire('sw.js');
const fn = (name, next = '\n}\n') => { const i = app.lastIndexOf(`function ${name}(`); assert.ok(i > 0, name); const j = app.indexOf(next, i); assert.ok(j > i, next); return app.slice(i, j); };
const DEBUT = '/* ---------- Les défis en trois onglets : Jouer, Classement, Amis ----------';
const bloc = app.slice(app.indexOf(DEBUT), app.indexOf('function showScreen(){', app.indexOf(DEBUT)));

/* Le bloc des onglets dans un bac à sable (le même que retours-1855) : une base simulée, un document minimal. */
function bac(o = {}) {
  const els = {}, appels = [];
  const el = id => els[id] || (els[id] = { id, innerHTML: '', textContent: '', hidden: false, disabled: false, value: '', classList: { toggle() {}, add() {}, remove() {} }, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, getBoundingClientRect: () => ({ top: 0 }) });
  const ctx = vm.createContext({
    state: { salle: Object.assign({ pseudo: '@elisa_sql', pts: 0 }, o.salle || {}), profile: { pays: 'FR' } },
    save() {}, localStorage: { getItem: () => null }, navigator: {}, Date, Math, JSON, Promise, Number, Object, Array, Set, Map, String, RegExp,
    document: { getElementById: id => (o.absents || []).includes(id) ? null : (o.els && o.els[id]) || el(id), querySelector: () => null, querySelectorAll: () => [], hidden: false },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {}, requestAnimationFrame: f => f(),
    jeuSavedNom: () => '@elisa_sql', paysDuProfil: () => 'FR', paysNom: c => c, paysDrapeau: c => `[${c}]`, salleKpi: () => ({ pts: 0 }), sallePts: n => `${n} pts`,
    clsOn: () => true, clsCle: () => 'K'.repeat(32), clsSalle() { return ctx.state.salle; }, clsPts: n => String(n), clsQuitter() {}, psPage() {},
    clsRpc: (f, b) => { appels.push([f, b]); return Promise.resolve(o.rpc ? o.rpc(f, b) : {}); },
    esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), escAttr: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
    jeuInitial: n => String(n || '?').replace(/^@+/, '').charAt(0).toUpperCase(), perfColor: () => 2, lqStkSvg: k => `<svg data-k="${k}"></svg>`, chatBonusHtml: k => `<img data-k="${k}">`,
    JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' }, JEU_NIV_X: { f: 1, m: 2, d: 4 }, JEU_MAX: 6, jeuChallenges: () => [1, 2, 3], jeuNivAuto: () => 'f', jeuNiv: o.niv || 'm', jeuNivUser: true,
    DEF_CHEV_SVG: '<svg data-k="chev"></svg>', CLS_FLAG_SVG: '<svg data-k="flag"></svg>', perfDay: () => 'Hier', CHALLENGES: o.sansMoteur ? undefined : [1], SQL: o.sansMoteur ? null : {},
    jeuStart: (...a) => { appels.push(['jeuStart', ...a]); return o.start ? o.start() : undefined; }, jeuPseudoPuis: f => f(), jeuRand: () => 'NOUV01', jeuNom: v => String(v || '').trim(),
    psForme: v => { const h = String(v || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 15); return h ? '@' + h : ''; },
    psLibre: () => Promise.resolve({ ok: false, raison: 'pris' }), lqSay: t => appels.push(['say', t]), buzz() {}, lqAsk: () => Promise.resolve(false),
    prefersReduceMotion: () => true, renderDefisRoom() {}, jeuSavePrefs() {}, renderCompte() {}, jeuPaint() {}, JEU: null, activeTab: 'defis', jeuInvite: '',
    defisActionsHTML: () => '<p class="dx-ou"></p><div class="dx-actions"></div>', DEFIS_FEUILLE: null,
  });
  if (o.salles !== undefined) ctx.__s = o.salles;
  vm.runInContext(bloc, ctx);
  if (o.salles !== undefined) vm.runInContext('DEFIS.salles=__s', ctx);
  return { ctx, els, el, appels, ev: c => vm.runInContext(c, ctx) };
}
const attendre = () => new Promise(r => setImmediate(r));
const J = v => JSON.parse(JSON.stringify(v));
const salle = (code, niv, hote, nb = 2) => ({ code, niv, manches: 1, nb, max: 6, hote, joueurs: [] });
const codes = h => [...h.matchAll(/sallesRejoindre\('([A-Z0-9]{6})'\)/g)].map(m => m[1]);

/* 8 novembre, 22 h 27 (« accepte 6 max dans une salle, comme ça on a deux lignes pleines ») : six joueurs, l’hôte et 5 invités ;
   la phrase suit JEU_MAX. */
test('le cadre du haut : la phrase d’Elisa, et « 5 joueurs » tient avec une salle de 6 (l’hôte et 5 invités)', () => {
  const haut = fn('defisRapideHTML');
  /* 8 novembre, 0 h 17 (Elisa, « je veux garder ça ») : après la refonte, le bandeau garde sa phrase entière. */
  assert.ok(haut.includes('<p class="room-sub">Choisis ton niveau et invite jusqu’à ${JEU_MAX-1} joueurs, ou ouvre ta salle à tous. Tout le monde relève le même défi&nbsp;!</p>'));
  assert.ok(bac().ev('defisRapideHTML()').includes('invite jusqu’à 5 joueurs, ou ouvre ta salle à tous.'), 'jusqu’à 5 invités');
  assert.ok(!haut.includes('invite tes amis'));
  assert.ok(app.includes('const JEU_MAX=6;') && app.includes('max:solo?1:JEU_MAX'), 'une salle : 6 joueurs au plus');
  const mig = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).find(f => f.endsWith('_salle_six_joueurs.sql'));
  const sql = lire('supabase/migrations/' + mig);
  assert.ok(sql.includes("neuf := replace(replace(def, 'having count(v.pid) < 5', 'having count(v.pid) < 6'), '''max'', 5,', '''max'', 6,');"), 'la base cache une salle pleine à 6');
  assert.ok(sql.includes("neuf := replace(def, avant, 'case when r.solo then 1 else 6 end');"), 'et laisse entrer le 6e');
});

test('« Mes stats » plus en avant : une pastille lavande, et sa flèche qui bouge (sauf en mouvement réduit)', () => {
  const c = bac();
  const moi = c.ev('defisMoiHTML()');
  assert.ok(moi.includes('<span class="dx-me-go" aria-hidden="true">Mes stats<svg data-k="chev"></svg></span></button>'), 'la flèche est un dessin, plus un « › »');
  assert.ok(!moi.includes('Mes stats ›') && moi.includes('Voir mes stats"'), 'le lecteur d’écran dit toujours « Voir mes stats »');
  for (const k of ['html.lq #scr-defis .dx-me-go{flex:none;display:inline-flex;align-items:center;gap:1px;padding:9px 7px 9px 13px;border-radius:999px;background:var(--accent-soft);',
    'html.lq #scr-defis .dx-me-go svg{display:block;flex:none;width:16px;height:16px;animation:dxMeFleche 2.6s ease-in-out infinite}',
    '@keyframes dxMeFleche{0%,50%,100%{transform:translateX(0)}62%{transform:translateX(4px)}74%{transform:translateX(0)}84%{transform:translateX(2.5px)}}',
    '@media (prefers-reduced-motion:reduce){html.lq #scr-defis .dx-me-go svg{animation:none}}', 'html[data-motion="reduce"].lq #scr-defis .dx-me-go svg{animation:none}'])
    assert.ok(lq.includes(k), k);
});

test('« Rejoins une partie » : les salles du niveau choisi, directement, plus de « Trouver une salle » (12 h 52 : dans le même cadre)', () => {
  const c = bac({ niv: 'm', salles: [salle('AAA111', 'f', '@kev'), salle('BBB222', 'm', '@lea'), salle('CCC333', 'd', '@tom'), salle('DDD444', 'm', '@noe')] });
  const haut = c.ev('defisRapideHTML()');
  assert.ok(haut.indexOf('id="dx-niv-l"') < haut.indexOf('<div class="dx-rejoindre" id="dx-rejoindre" role="group" aria-labelledby="dx-rejoindre-h">'), 'sous le niveau');
  assert.ok(haut.indexOf('id="dx-rejoindre"') < haut.indexOf('data-k="creer"') && haut.indexOf('class="dx-actions"') < haut.indexOf('id="dx-autres"'), 'puis « Créer une salle », « ou », et les autres niveaux');
  const r = haut.slice(haut.indexOf('id="dx-rejoindre"'), haut.indexOf('data-k="creer"'));
  assert.ok(r.includes('<h3 class="dx-rj-h" id="dx-rejoindre-h">Rejoins une partie</h3><span class="dx-live">2 en direct</span>'), 'deux salles en Moyen');
  assert.deepEqual(codes(r), ['BBB222', 'DDD444'], 'celles du niveau choisi');
  const autres = haut.slice(haut.indexOf('id="dx-autres"'));
  assert.ok(autres.includes('<p class="dx-h3">Salles disponibles</p>') && codes(autres).join() === 'AAA111,CCC333', 'les autres niveaux, à la fin du cadre (13 h 04 : « Salles disponibles »)');
  assert.ok(!app.includes('>Aux autres niveaux<'), 'plus « Aux autres niveaux »');
  assert.ok(!haut.includes('Trouver une salle') && !haut.includes('Créer ma salle') && (haut.match(/class="room-go/g) || []).length === 1, 'un seul bouton pour créer');
  assert.ok(!app.includes('function jeuPartieRapide(') && !app.includes('function dxTrouverTexte(') && !app.includes('function jeuSalleOuverte('));
  assert.ok(app.includes('<p class="room-kicker">Créer ou rejoindre</p><h2 id="dx-rapide-h">Lance un défi&nbsp;!</h2>'), '7 novembre, 21 h 44 : « Lance un défi ! »');
});

test('aucune salle au niveau choisi : la phrase d’Elisa, juste au-dessus de « Créer une salle » ; les autres niveaux restent à la fin', () => {
  const c = bac({ niv: 'd', salles: [salle('AAA111', 'f', '@kev'), salle('BBB222', 'm', '@lea')] });
  const haut = c.ev('defisRapideHTML()');
  const r = haut.slice(haut.indexOf('id="dx-rejoindre"'), haut.indexOf('data-k="creer"'));
  /* Refonte du 7 novembre : sous la phrase, « Voir les 2 autres salles » descend à celles des autres niveaux (dxVoirAutres). */
  assert.ok(r.includes('<h3 class="dx-rj-h" id="dx-rejoindre-h">Rejoins une partie</h3></div><p class="dx-vide is-aucune">Aucune salle à ton niveau&nbsp;? Crée la tienne et laisse les autres te rejoindre&nbsp;!</p><button type="button" class="dx-ancre" onclick="dxVoirAutres()">Voir les 2 autres salles<svg data-k="chev"></svg></button></div>'),
    'sans compte en direct, la phrase, le lien vers les autres niveaux, puis le bouton');
  assert.ok(codes(haut.slice(haut.indexOf('id="dx-autres"'))).join() === 'AAA111,BBB222');
  /* Aucune salle du tout : « Aucune salle disponible » (13 h 04), remonté à côté de « Rejoins une partie » (7 novembre, 22 h 29) ;
     pendant le chargement, des lignes vides et rien en bas */
  c.ev('DEFIS.salles=[]'); c.ev('sallesRepeindre()');
  assert.ok(c.els['dx-rejoindre'].innerHTML.startsWith('<div class="dx-rj-tete"><h3 class="dx-rj-h" id="dx-rejoindre-h">Rejoins une partie</h3><span class="dx-live is-off">Aucune salle disponible</span></div>'));
  assert.ok(c.els['dx-rejoindre'].innerHTML.includes('is-aucune') && c.els['dx-autres'].innerHTML === '', 'plus rien tout en bas du cadre');
  c.ev("DEFIS.salles=null;DEFIS.sallesErr='net'"); c.ev('sallesRepeindre()');
  assert.ok(!c.els['dx-rejoindre'].innerHTML.includes('Aucune salle disponible'), 'sans connexion : on ne sait pas');
  c.ev("DEFIS.sallesErr=''");
  c.ev('DEFIS.salles=null'); c.ev('sallesRepeindre()');
  assert.ok(c.els['dx-rejoindre'].innerHTML.includes('class="dx-list is-wait"') && !c.els['dx-rejoindre'].innerHTML.includes('is-aucune') && c.els['dx-autres'].innerHTML === '');
});

test('les salles changent ou le niveau change : seules « Rejoins une partie » et les autres niveaux sont redessinées', () => {
  const c = bac({ niv: 'm', salles: [salle('AAA111', 'f', '@kev')] });
  c.ev('sallesRepeindre()');
  assert.ok(c.els['dx-rejoindre'].innerHTML.includes('is-aucune') && codes(c.els['dx-autres'].innerHTML).join() === 'AAA111');
  /* Elisa choisit « Facile » : la salle Facile monte dans « Rejoins une partie » */
  c.ev("defisNiv('f')");
  assert.deepEqual(codes(c.els['dx-rejoindre'].innerHTML), ['AAA111']);
  assert.ok(c.els['dx-rejoindre'].innerHTML.includes('<span class="dx-live">1 en direct</span>') && c.els['dx-autres'].innerHTML === '', 'la seule salle est au niveau choisi : rien en bas');
  assert.ok(fn('defisNiv').includes('sallesRepeindre();') && !fn('defisNiv').includes('dx-trouver-t'));
  const rep = fn('sallesRepeindre');
  /* Refonte du 7 novembre : réécrites seulement si leur contenu a changé (le focus posé sur « Rejoindre » ne repart plus en haut). */
  assert.ok(rep.includes("const poser=(el,h)=>{if(el&&el._dxH!==h){el.innerHTML=h;el._dxH=h;}};") && rep.includes("poser(document.getElementById('dx-rejoindre'),sallesSectionHTML());")
    && rep.includes("if(host&&!(host.querySelector&&host.querySelector('.dx-points')))host.innerHTML=defisPointsHTML();"));
  c.els['dx-rejoindre'].innerHTML = 'posé à la main'; c.ev('sallesRepeindre()');
  assert.equal(c.els['dx-rejoindre'].innerHTML, 'posé à la main', 'rien n’a changé dans les salles : rien n’est réécrit');
  /* 8 novembre, 0 h 17 (« je veux garder ça ») : la phrase garde son cadre en pointillés ; rien dans la refonte ne l’efface. */
  const v2 = lq.slice(lq.indexOf('Défis — la refonte du 7 novembre'));
  assert.ok(!/\.dx-vide\.is-aucune\{[^}]*border:0/.test(v2) && v2.includes('html.lq #scr-defis .dx-rapide.is-v2 .dx-rejoindre .dx-vide.is-aucune+.dx-ancre{margin-top:4px}'), 'le cadre en pointillés reste');
  for (const k of ['html.lq #scr-defis .dx-rejoindre{margin:18px 0 14px}', 'html.lq #scr-defis .dx-rj-h{margin:0;font:700 16px/1.2 var(--display);',
    'html.lq #scr-defis .dx-rejoindre .dx-vide.is-aucune{margin:0;padding:12px 14px;border:2px dashed #D6CCFA;', 'html.lq #scr-defis .dx-autres{margin-top:16px;border-top:2px dashed var(--line-2)}'])
    assert.ok(lq.includes(k), k);
  assert.ok(!lq.includes('.dx-aucune') && !lq.includes('dx-salles-liste') && !lq.includes('.dx-creer-t') && !lq.includes('.dx-salles-sub'), 'les styles du cadre du bas sont partis');
});

test('« Comment sont calculés les points ? » : une rangée bien visible sous les cadres, qui ouvre le barème', () => {
  const c = bac({ salles: [] });
  c.ev('sallesRepeindre()');
  const h = c.els['defis-salles'].innerHTML;
  const rangee = '<button type="button" class="dx-points" onclick="defisStats(true)"><span class="dx-points-stk" aria-hidden="true"><svg data-k="trophy"></svg></span><span class="dx-points-t"><b>Comment sont calculés les points&nbsp;?</b><small>Vitesse, niveau, premier coup et place dans la salle</small></span><svg data-k="chev"></svg></button>';
  assert.equal(h, rangee, 'sous le cadre, seule (12 h 52 : un seul cadre au-dessus)');
  assert.ok(!h.includes('dx-lien') && !h.includes('dx-regles') && !h.includes('Comment on marque'));
  assert.ok(app.includes('<h2 id="room-rules-h"><span class="room-rules-stk" aria-hidden="true">${lqStkSvg(\'target\')}</span>Comment sont calculés les points&nbsp;?</h2>'), 'le même titre dans Mes stats');
  assert.ok(!app.includes('Comment on marque des points</'), 'plus l’ancien titre à l’écran');
  for (const k of ['html.lq #scr-defis .dx-points{display:flex;align-items:center;gap:12px;width:100%;margin:0 0 16px;', 'border-radius:18px;background:var(--accent-soft);box-shadow:0 3px 0 #D2C6FA;',
    'html.lq #scr-defis .dx-points-t b{color:var(--ink);font:700 15.5px/1.2 var(--display);', 'html.lq #scr-defis .dx-points:focus-visible{outline:3px solid var(--accent);outline-offset:2px}'])
    assert.ok(lq.includes(k), k);
  assert.ok(!lq.includes('.dx-regles') && !lq.includes('.dx-lien') && !lq.includes('.dx-trouver'), 'les anciens styles sont partis');
});

test('« Remplacer amis par joueurs » : l’onglet Joueurs, ce qu’il contient, et ce qui le nomme', async () => {
  const c = bac({ salle: { mates: { lea: { n: '@lea', g: 2, w: 1, l: 1, at: 1 } } } });
  c.ev("DEFIS.onglet='amis';defisPeindre()");
  assert.ok(c.els['defis-tabs'].innerHTML.includes('id="dx-tab-amis" class="room-opt on" aria-selected="true" aria-controls="defis-amis" onclick="defisOnglet(\'amis\')">Adversaires</button>'), '8 novembre, 15 h 09 (sa maquette) : l’onglet s’appelle « Adversaires »');
  const a = c.els['defis-amis'].innerHTML;
  /* 7 novembre, 21 h 44 : l’onglet reste « Joueurs », la carte s’appelle « Tes adversaires » (retours-2144-defis). */
  /* 22 h 13 : le surtitre « Tes adversaires », le titre dit combien (retours-2144-defis). */
  /* 8 novembre, 11 h 08 (« ce niveau premium ») : le haut dans le bandeau violet de la feuille (retours-premium-defis) */
  /* 8 novembre, 14 h 48 (« je veux marcher qu’avec code ») : plus d’ajout par pseudo. 15 h 09 (sa maquette) : « Créer une partie » et
     « Rejoindre avec un code » ouvrent les feuilles de Jouer. */
  assert.ok(a.includes('<p class="room-kicker" id="dx-amis-k">Tes adversaires</p><h2 id="dx-amis-h">1 adversaire</h2>') && a.includes('onclick="defisCarte(\'creer\')">') && a.includes('Créer ma partie</button>') && a.includes('Rejoindre avec un code</button>'));
  assert.ok(!a.includes('dx-ajout') && !a.includes('Inviter un ami') && !c.els['dx-amis-liste'].innerHTML.includes('Retirer @lea'));
  const ouvertes = [];
  c.ctx.defisFeuilleOuvrir = k => ouvertes.push(k); c.ctx.defisFeuilleFermer = () => ouvertes.push('fermée');
  for (const m of a.matchAll(/onclick="(defisCarte\('[a-z]+'\))"/g)) c.ev(m[1]);
  assert.deepEqual(ouvertes, ['creer', 'code']);
  c.ev("jeuDefier('@lea')");
  assert.deepEqual(J(c.appels.filter(x => x[0] === 'jeuStart').at(-1)), ['jeuStart', 'NOUV01', true, null, { nomId: 'jeu-nom', pub: false, pour: '@lea' }], '« Défier » sur une ligne : une salle privée, son code à envoyer');
  const v = bac();
  v.ev("DEFIS.onglet='amis';defisPeindre()");
  assert.ok(v.els['dx-amis-liste'].innerHTML.includes('<p class="dx-vide-t">Aucun adversaire pour l’instant&nbsp;!</p><p class="dx-vide">Les joueurs que tu affrontes en salle apparaîtront ici automatiquement après une partie.</p>'));
  /* 7 novembre, 22 h 09 (Elisa) : « remplace la pills "mes joueurs" par "mes amis" ». 8 novembre, 15 h 09 : l’onglet s’appelle Adversaires. */
  assert.ok(app.includes("${chip('amis','Mes adversaires')}") && app.includes('invite des amis avec un code depuis l’onglet Adversaires.'), 'le classement nomme l’onglet Adversaires');
  assert.ok(!app.includes('depuis l’onglet Joueurs') && !app.includes('>Ouvrir l’onglet Joueurs<'), 'plus d’« onglet Joueurs » à l’écran');
  for (const k of ['<h2 id="dx-amis-h">Tes amis</h2>', 'Ajouter un ami</button>', "chip('amis','Mes joueurs')", 'dans l’onglet Amis', 'dans tes amis'])
    assert.ok(!app.includes(k), k);
});

test('chaque classe des défis a son style : l’onglet Joueurs avait perdu ses deux boutons à 10 h 16', () => {
  const classes = new Set([...app.matchAll(/class="([^"]*)"/g)].flatMap(m => m[1].split(/[\s$]+/)).map(k => (k.match(/^dx-[a-z0-9-]+/) || [''])[0]).filter(Boolean));
  const sans = [...classes].filter(k => !new RegExp(`\\.${k}(?![a-z0-9-])`).test(lq)).sort();
  assert.deepEqual(sans, ['dx-drapeau-row', 'dx-pager'], 'seuls des repères pour le script restent sans style à eux');
  for (const k of ['html.lq #scr-defis .dx-duo{display:flex;gap:10px;margin-top:14px}', 'html.lq #scr-defis .dx-sec{flex:1;min-height:46px;padding:10px 8px;border:2px solid var(--card-border);',
    'html.lq #scr-defis .dx-sec.on{border-color:var(--accent);background:var(--accent-soft)}', '@media (max-width:350px){html.lq #scr-defis .dx-me{gap:10px;padding:12px}'])
    assert.ok(lq.includes(k), k);
});

test('la salle ouverte se dit visible par les autres joueurs, partout où l’on nommait « Salles ouvertes »', () => {
  assert.ok(!app.includes('«\\u00a0Salles ouvertes\\u00a0»') && !app.includes('«&nbsp;Salles ouvertes&nbsp;»'));
  assert.ok(app.includes("function jeuVisTexte(){return jeuVis==='priv'?'Seuls les joueurs à qui tu donnes le code peuvent rejoindre ta salle.':'Tous les joueurs peuvent voir et rejoindre ta salle. Tu peux aussi partager son code.';}"), '8 novembre, 9 h 42 : « Qui peut rejoindre ? »');
  assert.ok(app.includes("if(host&&live.length<2)return '';"), '20 h 12 : seul dans sa salle, plus de carte sous les joueurs');
  assert.ok(lire('decouvrir/confidentialite.html').includes('apparaît dans la liste des salles ouvertes («&nbsp;Rejoins une partie&nbsp;»), avec le pseudo et le drapeau de ses joueurs'));
  assert.ok(lire('IOS.md').includes('dans « Rejoins une partie », la liste des salles ouvertes (`jeu_salles_ouvertes`, `jeu_salle_publier`)'));
});

test('les versions : la feuille de style et le cache', () => {
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=293">'));
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  assert.ok(cache === 'requete-2026-11-09-lecture-v2785' && app.includes(`const SW_CACHE='${cache}';`));
});
