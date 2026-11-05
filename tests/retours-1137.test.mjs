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
    jeuInitial: n => String(n || '?').replace(/^@+/, '').charAt(0).toUpperCase(), perfColor: () => 2, lqStkSvg: k => `<svg data-k="${k}"></svg>`,
    JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' }, jeuChallenges: () => [1, 2, 3], jeuNivAuto: () => 'f', jeuNiv: o.niv || 'm', jeuNivUser: true,
    DEF_CHEV_SVG: '<svg data-k="chev"></svg>', CLS_FLAG_SVG: '<svg data-k="flag"></svg>', perfDay: () => 'Hier', CHALLENGES: o.sansMoteur ? undefined : [1], SQL: o.sansMoteur ? null : {},
    jeuStart: (...a) => { appels.push(['jeuStart', ...a]); return o.start ? o.start() : undefined; }, jeuPseudoPuis: f => f(), jeuRand: () => 'NOUV01', jeuNom: v => String(v || '').trim(),
    psForme: v => { const h = String(v || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 15); return h ? '@' + h : ''; },
    psLibre: () => Promise.resolve({ ok: false, raison: 'pris' }), lqSay: t => appels.push(['say', t]), buzz() {}, lqAsk: () => Promise.resolve(false),
    prefersReduceMotion: () => true, renderDefisRoom() {}, jeuSavePrefs() {}, renderCompte() {}, jeuPaint() {}, JEU: null, activeTab: 'defis', jeuInvite: '',
  });
  if (o.salles !== undefined) ctx.__s = o.salles;
  vm.runInContext(bloc, ctx);
  if (o.salles !== undefined) vm.runInContext('DEFIS.salles=__s', ctx);
  return { ctx, els, el, appels, ev: c => vm.runInContext(c, ctx) };
}
const attendre = () => new Promise(r => setImmediate(r));
const J = v => JSON.parse(JSON.stringify(v));
const salle = (code, niv, hote, nb = 2) => ({ code, niv, manches: 1, nb, max: 5, hote, joueurs: [] });
const codes = h => [...h.matchAll(/sallesRejoindre\('([A-Z0-9]{6})'\)/g)].map(m => m[1]);

test('le cadre du haut : la phrase d’Elisa, et « 4 joueurs » tient avec une salle de 5 (l’hôte et 4 invités)', () => {
  const haut = fn('defisRapideHTML');
  assert.ok(haut.includes('<p class="room-sub">Choisis ton niveau et invite jusqu’à 4 joueurs, ou ouvre ta salle à tous. Tout le monde relève le même défi&nbsp;!</p>'));
  assert.ok(!haut.includes('invite tes amis'));
  assert.ok(app.includes('const JEU_MAX=5;') && app.includes('max:solo?1:JEU_MAX'), 'une salle : 5 joueurs au plus');
  const mig = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).find(f => f.endsWith('_defis_trois_onglets.sql'));
  assert.ok(lire('supabase/migrations/' + mig).includes('having count(v.pid) < 5'), 'la base cache une salle pleine à 5');
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

test('« Rejoins une partie » : les salles directement, celles du niveau choisi d’abord, plus de « Trouver une salle »', () => {
  const c = bac({ niv: 'm', salles: [salle('AAA111', 'f', '@kev'), salle('BBB222', 'm', '@lea'), salle('CCC333', 'd', '@tom'), salle('DDD444', 'm', '@noe')] });
  c.ev('sallesRepeindre()');
  const h = c.els['defis-salles'].innerHTML;
  assert.ok(h.includes('<p class="perf-kicker"><span class="dx-live">4 en direct</span></p><h2 id="dx-salles-h">Rejoins une partie</h2><p class="dx-salles-sub">Affronte d’autres joueurs sur des défis adaptés à ton niveau.</p>'));
  assert.deepEqual(codes(h), ['BBB222', 'DDD444', 'AAA111', 'CCC333'], 'Moyen d’abord, puis les autres niveaux');
  assert.ok(h.includes('<div class="dx-aucune" id="dx-aucune" hidden>') && !h.includes('Aux autres niveaux'));
  assert.ok(!h.includes('Trouver une salle') && !h.includes('dx-rapide-go') && !h.includes('dx-trouver'));
  assert.ok(!app.includes('function jeuPartieRapide(') && !app.includes('function dxTrouverTexte(') && !app.includes('onclick="jeuPartieRapide()"'));
});

test('aucune salle au niveau choisi : la phrase d’Elisa et « Créer ma salle » ; les autres niveaux restent visibles dessous', () => {
  const c = bac({ niv: 'd', salles: [salle('AAA111', 'f', '@kev'), salle('BBB222', 'm', '@lea')] });
  c.ev('sallesRepeindre()');
  const h = c.els['defis-salles'].innerHTML;
  assert.ok(h.includes('<div class="dx-aucune" id="dx-aucune"><p class="dx-vide">Aucune salle à ton niveau&nbsp;? Crée la tienne et laisse les autres te rejoindre&nbsp;!</p>'));
  assert.ok(h.includes('<button type="button" class="room-go" id="dx-creer-go" onclick="jeuSalleOuverte()"><span>Créer ma salle</span><svg data-k="chev"></svg></button>'));
  assert.ok(h.includes('<p class="dx-creer-t" id="dx-creer-t">Niveau <b>Difficile</b>, visible par les autres joueurs.</p>'), 'le niveau choisi en haut');
  assert.ok(h.includes('<div id="dx-salles-liste"><p class="dx-h3">Aux autres niveaux</p><ul class="dx-list">') && J(codes(h)).join() === 'AAA111,BBB222');
  assert.ok(h.indexOf('id="dx-aucune"') < h.indexOf('id="dx-salles-liste"'), '« Créer ma salle » avant les autres niveaux');
  /* Aucune salle du tout : la phrase et le bouton, et la liste vide (masquée en CSS) */
  c.ev('DEFIS.salles=[]'); c.ev('sallesRepeindre()');
  const v = c.els['defis-salles'].innerHTML;
  assert.ok(v.includes('<p class="perf-kicker">Salles ouvertes</p>') && v.includes('<div class="dx-aucune" id="dx-aucune">') && v.includes('<div id="dx-salles-liste"></div>'));
  /* Pendant le chargement : ni la phrase ni le bouton */
  c.ev('DEFIS.salles=null'); c.ev('sallesRepeindre()');
  assert.ok(c.els['defis-salles'].innerHTML.includes('<div class="dx-aucune" id="dx-aucune" hidden>') && c.els['defis-salles'].innerHTML.includes('class="dx-list is-wait"'));
});

test('déjà dessiné : la liste, son surtitre et « Créer ma salle » suivent, sans redessiner le bouton ; le niveau choisi en haut aussi', () => {
  const part = () => ({ innerHTML: '', hidden: false });
  const liste = part(), kick = part(), aucune = part(), t = part();
  const host = { innerHTML: 'DÉJÀ', querySelector: k => ({ '#dx-salles-liste': liste, '.perf-kicker': kick, '#dx-aucune': aucune, '#dx-creer-t': t })[k] || null };
  const c = bac({ niv: 'm', salles: [salle('AAA111', 'f', '@kev')], els: { 'defis-salles': host } });
  c.ev('sallesRepeindre()');
  assert.equal(host.innerHTML, 'DÉJÀ', 'le cadre n’est pas redessiné : le bouton garde son état et son message');
  assert.equal(aucune.hidden, false, 'aucune salle Moyen : « Créer ma salle » apparaît');
  assert.ok(liste.innerHTML.startsWith('<p class="dx-h3">Aux autres niveaux</p>') && kick.innerHTML === '<span class="dx-live">1 en direct</span>');
  assert.equal(t.innerHTML, 'Niveau <b>Moyen</b>, visible par les autres joueurs.');
  /* Elisa choisit « Facile » en haut : la salle Facile passe en tête, le bouton s’efface */
  c.ev("defisNiv('f')");
  assert.equal(aucune.hidden, true);
  assert.ok(liste.innerHTML.startsWith('<ul class="dx-list">') && t.innerHTML === 'Niveau <b>Facile</b>, visible par les autres joueurs.');
  assert.ok(fn('defisNiv').includes('sallesRepeindre();') && !fn('defisNiv').includes('dx-trouver-t'));
});

test('« Créer ma salle » : une salle publique à soi, au niveau choisi ; le bouton attend la vérification en ligne', async () => {
  let fini;
  const c = bac({ niv: 'm', start: () => new Promise(r => { fini = r; }) });
  c.ev('jeuSalleOuverte()');
  assert.deepEqual(J(c.appels.filter(a => a[0] === 'jeuStart')), [['jeuStart', 'NOUV01', true, null, { nomId: 'jeu-nom', pub: true }]]);
  assert.equal(c.els['dx-creer-go'].disabled, true, 'pas de double salle pendant la vérification');
  fini(); await attendre();
  assert.equal(c.els['dx-creer-go'].disabled, false);
  const m = bac({ sansMoteur: true });
  m.ev('jeuSalleOuverte()');
  assert.equal(m.els['dx-salles-msg'].textContent, 'Le moteur SQL se charge encore, réessaie dans un instant.');
  assert.ok(!m.appels.some(a => a[0] === 'jeuStart'));
});

test('« Comment sont calculés les points ? » : une rangée bien visible sous les cadres, qui ouvre le barème', () => {
  const c = bac({ salles: [] });
  c.ev('sallesRepeindre()');
  const h = c.els['defis-salles'].innerHTML;
  const rangee = '<button type="button" class="dx-points" onclick="defisStats(true)"><span class="dx-points-stk" aria-hidden="true"><svg data-k="trophy"></svg></span><span class="dx-points-t"><b>Comment sont calculés les points&nbsp;?</b><small>Vitesse, premier coup et place dans la salle</small></span><svg data-k="chev"></svg></button>';
  assert.ok(h.includes('</section>') && h.indexOf(rangee) > h.indexOf('</section>'), 'sous le cadre « Rejoins une partie »');
  assert.ok(!h.includes('dx-lien') && !h.includes('dx-regles') && !h.includes('Comment on marque'));
  assert.ok(app.includes('<h2 id="room-rules-h"><span class="room-rules-stk" aria-hidden="true">${lqStkSvg(\'target\')}</span>Comment sont calculés les points&nbsp;?</h2>'), 'le même titre dans Mes stats');
  assert.ok(!app.includes('Comment on marque des points</'), 'plus l’ancien titre à l’écran');
  for (const k of ['html.lq #scr-defis .dx-points{display:flex;align-items:center;gap:12px;width:100%;margin:0 0 16px;', 'border-radius:18px;background:var(--accent-soft);box-shadow:0 3px 0 #D2C6FA;',
    'html.lq #scr-defis .dx-points-t b{color:var(--ink);font:700 15.5px/1.2 var(--display);', 'html.lq #scr-defis .dx-points:focus-visible{outline:3px solid var(--accent);outline-offset:2px}'])
    assert.ok(lq.includes(k), k);
  assert.ok(!lq.includes('.dx-regles') && !lq.includes('.dx-lien') && !lq.includes('.dx-trouver'), 'les anciens styles sont partis');
});

test('« Remplacer amis par joueurs » : l’onglet Joueurs, ce qu’il contient, et ce qui le nomme', async () => {
  const c = bac({ salle: { amisAjoutes: [{ n: '@lea', at: 1 }] } });
  c.ev("DEFIS.onglet='amis';defisPeindre()");
  assert.ok(c.els['defis-tabs'].innerHTML.includes('id="dx-tab-amis" class="room-opt on" aria-selected="true" aria-controls="defis-amis" onclick="defisOnglet(\'amis\')">Joueurs</button>'));
  const a = c.els['defis-amis'].innerHTML;
  assert.ok(a.includes('<p class="perf-kicker">Ceux que tu as affrontés</p><h2 id="dx-amis-h">Joueurs</h2>') && a.includes('onclick="amisFormBasculer()">Ajouter un joueur</button>'));
  assert.ok(a.includes('<label class="jeu-lab" for="dx-ajout-in">Le pseudo du joueur</label>'));
  assert.ok(c.els['dx-amis-liste'].innerHTML.includes('aria-label="Retirer @lea de ta liste"'));
  c.el('dx-ajout-in').value = '@lea'; c.ev('amisAjouter()');
  assert.equal(c.els['dx-ajout-msg'].textContent, '@lea est déjà dans ta liste.');
  c.el('dx-ajout-in').value = 'x'; c.ev('amisAjouter()');
  assert.equal(c.els['dx-ajout-msg'].textContent, 'Écris le pseudo du joueur, avec ou sans @.');
  c.ev("amisRetirer('@lea')");
  assert.ok(c.appels.some(x => x[0] === 'say' && x[1] === '@lea n’est plus dans ta liste.'));
  assert.ok(c.els['dx-amis-liste'].innerHTML.includes('Tu peux aussi ajouter un joueur avec son pseudo.'));
  assert.ok(app.includes("${chip('amis','Mes joueurs')}") && app.includes('ajoute-les dans l’onglet Joueurs.'), 'le classement nomme l’onglet Joueurs');
  for (const k of ['<h2 id="dx-amis-h">Tes amis</h2>', 'Ajouter un ami</button>', "chip('amis','Mes amis')", 'dans l’onglet Amis', 'dans tes amis'])
    assert.ok(!app.includes(k), k);
});

test('chaque classe des défis a son style : l’onglet Joueurs avait perdu ses deux boutons à 10 h 16', () => {
  const classes = new Set([...app.matchAll(/class="([^"]*)"/g)].flatMap(m => m[1].split(/[\s$]+/)).map(k => (k.match(/^dx-[a-z0-9-]+/) || [''])[0]).filter(Boolean));
  const sans = [...classes].filter(k => !new RegExp(`\\.${k}(?![a-z0-9-])`).test(lq)).sort();
  assert.deepEqual(sans, ['dx-act-go', 'dx-drapeau-row', 'dx-pager'], 'seuls des repères pour le script restent sans style à eux');
  for (const k of ['html.lq #scr-defis .dx-duo{display:flex;gap:10px;margin-top:14px}', 'html.lq #scr-defis .dx-sec{flex:1;min-height:46px;padding:10px 8px;border:2px solid var(--card-border);',
    'html.lq #scr-defis .dx-sec.on{border-color:var(--accent);background:var(--accent-soft)}', '@media (max-width:350px){html.lq #scr-defis .dx-me{gap:10px;padding:12px}'])
    assert.ok(lq.includes(k), k);
});

test('la salle ouverte se dit visible par les autres joueurs, partout où l’on nommait « Salles ouvertes »', () => {
  assert.ok(!app.includes('«\\u00a0Salles ouvertes\\u00a0»') && !app.includes('«&nbsp;Salles ouvertes&nbsp;»'));
  assert.ok(app.includes("function jeuVisTexte(){return jeuVis==='priv'?'Seuls ceux qui ont le code peuvent entrer.':'Tous les joueurs voient ta salle et peuvent entrer. Le code marche aussi.';}"));
  assert.ok(app.includes("host&&J.pub?'Elle est visible par les autres joueurs, qui peuvent entrer. Tu peux aussi partager ce code.'"));
  assert.ok(lire('decouvrir/confidentialite.html').includes('apparaît dans la liste des salles ouvertes («&nbsp;Rejoins une partie&nbsp;»), avec le pseudo et le drapeau de ses joueurs'));
  assert.ok(lire('IOS.md').includes('dans « Rejoins une partie », la liste des salles ouvertes (`jeu_salles_ouvertes`, `jeu_salle_publier`)'));
});

test('les versions : la feuille de style et le cache', () => {
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=153">'));
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  assert.ok(cache === 'requete-2026-11-05-compte-v2535' && app.includes(`const SW_CACHE='${cache}';`));
});
