/* 4 novembre, 18 h 55 – 19 h 10 (Elisa) : « Est-ce que tu peux me proposer quelque chose au niveau fonctionnel niveau défis, je suis
   perdue ? Est-ce qu’il y a des choses à revoir ? Des écrans à construire en plus ? Je me disais peut-être qu’on peut voir toutes les
   salles dispo plutôt que les amis (amis aussi, mais les deux). Il faut qu’on voie aussi le pays sur le compte au niveau défis. »
   Puis : « Pas remis à jour tous les lundis, all time, mais on peut voir par semaine ; bien faire attention à glisser par page, par
   ex. max 5, ensuite page 2, etc. » Ses choix : salle publique par défaut, drapeau affiché d’office, les trois onglets seulement.
   Vérifié dans un navigateur (390 × 844) avec une base simulée : un vrai glissé du doigt passe de la page 1 à la page 2. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), sw = lire('sw.js');
const MIG = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).find(f => f.endsWith('_defis_trois_onglets.sql'));
const sql = MIG ? lire('supabase/migrations/' + MIG) : '';
const fn = (name, next) => { const i = app.lastIndexOf(`function ${name}(`); assert.ok(i > 0, name); const j = app.indexOf(next, i); assert.ok(j > i, next); return app.slice(i, j); };
const DEBUT = '/* ---------- Les défis en trois onglets : Jouer, Classement, Amis ----------';
const bloc = app.slice(app.indexOf(DEBUT), app.indexOf('function showScreen(){', app.indexOf(DEBUT)));

/* Le bloc des onglets dans un bac à sable : une base simulée (clsRpc), un document minimal, des minuteries à la main. */
function bac(o = {}) {
  const els = {}, appels = [], minut = [];
  const el = id => els[id] || (els[id] = { id, innerHTML: '', textContent: '', hidden: false, disabled: false, children: [], classList: { toggle() {}, add() {}, remove() {} }, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, getBoundingClientRect: () => ({ top: 0 }) });
  const ctx = vm.createContext({
    state: { salle: Object.assign({ pseudo: '@elisa_sql', pts: 2640 }, o.salle || {}), profile: { pays: 'FR' } },
    save() {}, localStorage: { getItem: () => o.prefs || null }, navigator: {}, Date, Math, JSON, Promise, Number, Object, Array, Set, Map, String, RegExp,
    document: { getElementById: id => (o.absents || []).includes(id) ? null : el(id), querySelector: () => null, querySelectorAll: () => [], hidden: false },
    setTimeout: (f, ms) => { minut.push([f, ms]); return minut.length; }, clearTimeout() {}, setInterval: () => 1, clearInterval() {}, requestAnimationFrame: f => f(),
    jeuSavedNom: () => 'elisa_sql'.replace(/^/, '@'), paysDuProfil: () => 'FR', paysNom: c => ({ FR: 'France', BE: 'Belgique' })[c] || c,
    paysDrapeau: c => `[${c}]`, salleKpi: () => ({ pts: 2640 }), sallePts: n => `${n} pts`, clsOn: () => !o.horsCls, clsCle: () => 'K'.repeat(32),
    clsSalle() { return ctx.state.salle; }, clsPts: n => String(n), clsQuitter() {}, psPage() {},
    clsRpc: (f, b) => { appels.push([f, b]); const r = o.rpc ? o.rpc(f, b) : {}; return r instanceof Promise ? r : Promise.resolve(r); },
    esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), escAttr: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
    jeuInitial: n => String(n || '?').replace(/^@+/, '').charAt(0).toUpperCase(), perfColor: () => 2, lqStkSvg: k => `<svg data-k="${k}"></svg>`,
    JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' }, jeuChallenges: () => [1, 2, 3, 4, 5], jeuNivAuto: () => 'f', jeuNiv: 'm', jeuNivUser: true,
    DEF_CHEV_SVG: '<svg data-k="chev"></svg>', CLS_FLAG_SVG: '<svg data-k="flag"></svg>', perfDay: () => 'Hier', CHALLENGES: [1], SQL: {},
    jeuStart: (...a) => appels.push(['jeuStart', ...a]), jeuPseudoPuis: f => f(), jeuRand: () => 'NOUV01', jeuNom: v => String(v || '').trim(),
    psForme: v => { const h = String(v || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 15); return h ? '@' + h : ''; },
    psLibre: () => Promise.resolve({ ok: false, raison: 'pris' }), lqSay: t => appels.push(['say', t]), buzz() {}, lqAsk: () => Promise.resolve(false),
    prefersReduceMotion: () => true, renderDefisRoom() {}, jeuSavePrefs() {}, renderCompte() {}, jeuPaint() {}, JEU: null, activeTab: 'defis', jeuInvite: '',
  });
  vm.runInContext(bloc, ctx);
  return { ctx, els, el, appels, minut, ev: c => vm.runInContext(c, ctx), tick: () => { const l = minut.splice(0); l.forEach(([f]) => f()); } };
}
const attendre = () => new Promise(r => setImmediate(r));
/* Les objets du bac à sable viennent d’un autre domaine : on les compare par leur JSON. */
const J = v => JSON.parse(JSON.stringify(v));

test('la base : le pays, les salles publiques, les salles ouvertes, les drapeaux, le classement par pages de 5', () => {
  assert.ok(MIG, 'la migration du 4 novembre');
  assert.ok(sql.includes("alter table public.jeu_pseudo add column if not exists pays text;") && sql.includes("check (pays is null or pays ~ '^[A-Z]{2}$')"));
  assert.ok(sql.includes('alter table requete_private.salle add column if not exists publique boolean not null default false;'));
  for (const f of ['jeu_pays(text, text)', 'jeu_drapeaux(text[])', 'jeu_salle_publier(text, text, boolean)', 'jeu_salles_ouvertes(text)', 'jeu_classement_v2(text, text, text, integer, text, text[])']) {
    assert.ok(sql.includes(`revoke all on function public.${f} from public, anon, authenticated;`), f);
    assert.ok(sql.includes(`grant execute on function public.${f} to anon, authenticated;`), f);
  }
  assert.ok(sql.includes('revoke all on function requete_private.classement_base(text, text, text, text, text[]) from public, anon, authenticated;'), 'la base du classement reste privée');
  const ouv = sql.slice(sql.indexOf('create or replace function public.jeu_salles_ouvertes'));
  for (const k of ["where not m.parti and m.vu > now() - interval '55 seconds'", 'where s.publique and not s.solo and not s.fini',
    'not exists (select 1 from requete_private.manche x where x.code = s.code and x.generation = s.generation)', 'having count(v.pid) < 5', 'jj.masque', 'limit 20'])
    assert.ok(ouv.includes(k), k);
  const pub = sql.slice(sql.indexOf('create or replace function public.jeu_salle_publier'));
  assert.ok(pub.includes('m.pid = r.host and m.cle = k') && pub.includes("raise exception 'réservé à l’hôte' using errcode = '42501';"), 'seul l’hôte publie');
  const v2 = sql.slice(sql.indexOf('create or replace function public.jeu_classement_v2'));
  assert.ok(v2.includes('where b.pos > v_page * 5 and b.pos <= v_page * 5 + 5;'), '5 joueurs par page');
  assert.ok(v2.includes("'page', (b.pos - 1) / 5)"), 'la page où se trouve le joueur');
  const base = sql.slice(sql.indexOf('create or replace function requete_private.classement_base'));
  assert.ok(base.includes("p.cree >= (date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris')"), 'la semaine commence le lundi, heure de Paris');
  assert.ok(base.includes("case when p_periode = 'semaine' then coalesce(w.pts, 0) else j.pts::bigint end"), 'depuis toujours : le total, jamais remis à zéro');
  assert.ok(base.includes('rank() over (order by b.pts desc) as rang') && base.includes('row_number() over (order by b.pts desc, b.maj, b.id) as pos'));
});

test('l’écran : trois onglets, et « Mes stats » garde le tableau de bord et le barème', () => {
  assert.ok(app.includes('<div id="defis-tabs"></div>\n      <div id="defis-jouer" class="defis-panel" role="tabpanel" aria-labelledby="dx-tab-jouer">'));
  assert.ok(app.includes('<div id="defis-classement" class="defis-panel" role="tabpanel" aria-labelledby="dx-tab-classement" hidden></div>'));
  assert.ok(app.includes('<div id="defis-amis" class="defis-panel" role="tabpanel" aria-labelledby="dx-tab-amis" hidden></div>'));
  assert.ok(fn('renderDefis', '\n}\n').includes("if(typeof defisPeindre==='function')defisPeindre();"));
  const c = bac();
  c.ev("DEFIS.onglet='classement';defisPeindre()");
  assert.match(c.els['defis-tabs'].innerHTML, /role="tablist" aria-label="Défis"/);
  assert.match(c.els['defis-tabs'].innerHTML, /id="dx-tab-classement" class="room-opt on" aria-selected="true"/);
  assert.equal(c.els['defis-jouer'].hidden, true);
  assert.equal(c.els['defis-classement'].hidden, false);
  c.ev("defisOnglet('stats')");
  assert.match(c.els['defis-tabs'].innerHTML, /id="dx-tab-jouer" class="room-opt on"/, '« Mes stats » fait partie de Jouer');
  assert.match(c.els['defis-stats-tete'].innerHTML, /onclick="defisOnglet\('jouer'\)"/);
});

test('les drapeaux : le sien (masquable), ceux des autres demandés par lots, puis gardés', async () => {
  const c = bac({ rpc: (f, b) => f === 'jeu_drapeaux' ? b.p_pseudos.filter(q => q !== 'inconnu').map(q => ({ q, pseudo: '@' + q, pays: q === 'lea_data' ? 'BE' : null })) : {} });
  assert.equal(c.ev("jeuFlag('@elisa_sql')"), '<i class="jeu-flag" aria-hidden="true">[FR]</i>', 'le sien, depuis le profil');
  c.ctx.state.salle.paysVoir = false;
  assert.equal(c.ev("jeuFlag('@elisa_sql')"), '', 'masqué dans Mon compte');
  assert.equal(c.ev("jeuFlag('@lea_data')"), '', 'pas encore connu');
  c.ev("jeuFlag('@inconnu')");
  assert.equal(c.minut.length, 1, 'un seul lot');
  c.tick(); await attendre();
  assert.deepEqual(J(c.appels.filter(a => a[0] === 'jeu_drapeaux').map(a => a[1].p_pseudos)), [['lea_data', 'inconnu']]);
  assert.equal(c.ev("jeuFlag('@lea_data')"), '<i class="jeu-flag" aria-hidden="true">[BE]</i>');
  assert.equal(c.ev("jeuFlag('@inconnu')"), '', 'un pseudo inconnu n’a pas de drapeau');
  assert.equal(c.ev("jeuFlag('@tom',null)"), '', 'un pays donné vide : pas de drapeau, pas de demande');
  /* Les avatars des défis le portent (salle d’attente, podium, adversaires, « Tu joues en tant que ») */
  for (const k of ["${jeuInitial(p.name)}${typeof jeuFlag==='function'?jeuFlag(p.name):''}</b>", "${jeuInitial(x.name)}${typeof jeuFlag==='function'?jeuFlag(x.name):''}</b>",
    "${jeuInitial(m.n)}${typeof jeuFlag==='function'?jeuFlag(m.n):''}</b>", "${jeuInitial(nom)}${typeof jeuFlag==='function'?jeuFlag(nom):''}</b>"])
    assert.ok(app.includes(k), k);
  assert.ok(lq.includes('html.lq .jeu-av{position:relative}') && lq.includes('html.lq .jeu-av .jeu-flag{position:absolute;right:-6px;bottom:-5px;'));
});

test('le pays part avec le pseudo, une fois, et null quand on le masque', async () => {
  const c = bac({ rpc: f => f === 'jeu_pays' ? { ok: true } : {} });
  c.ev('paysSync()'); await attendre();
  assert.deepEqual(J(c.appels.at(-1)), ['jeu_pays', { p_cle: 'K'.repeat(32), p_pays: 'FR' }]);
  assert.equal(c.ctx.state.salle.paysEnv, 'FR');
  c.ev('paysSync()'); await attendre();
  assert.equal(c.appels.filter(a => a[0] === 'jeu_pays').length, 1, 'rien ne repart tant que rien ne change');
  c.ev('paysMontrer(false)'); await attendre();
  assert.deepEqual(J(c.appels.filter(a => a[0] === 'jeu_pays').at(-1)[1].p_pays), null);
  assert.equal(c.ctx.state.salle.paysVoir, false);
  assert.equal(c.ctx.state.salle.paysEnv, '');
  /* Mon compte : la ligne « Afficher mon drapeau », sous le pays */
  assert.ok(app.includes('<label class="account-setting-row dx-drapeau-row">') && app.includes('<b>Afficher mon drapeau</b>') && app.includes('onchange="paysMontrer(this.checked)" aria-label="Afficher mon drapeau dans les défis"'));
  assert.ok(fn('psAdopter', '\n}\n').includes("if(typeof paysSync==='function')setTimeout(paysSync,0);"), 'dès que le pseudo est réservé');
  assert.ok(fn('paysChanger', '\n}\n').includes("if(typeof paysSync==='function')paysSync();"), 'quand le pays change');
});

test('Jouer : la carte du joueur ; les salles chargées sans les invalides ni les pleines ; plus de partie rapide', async () => {
  const c = bac();
  c.ev("DEFIS.cls.rangs={monde:12,pays:4,mon_pays:'FR'}");
  const moi = c.ev('defisMoiHTML()');
  assert.ok(moi.includes('<small>2640 pts · 4<sup>e</sup> en France</small>') && moi.includes('aria-label="@elisa_sql\u00a0: 2640 pts, 4e en France. Voir mes stats"'));
  assert.ok(moi.includes('onclick="defisOnglet(\'stats\')"') && moi.includes('<i class="jeu-flag" aria-hidden="true">[FR]</i>'));
  c.ev("DEFIS.cls.rangs={monde:1,pays:null,mon_pays:null}");
  assert.ok(c.ev('defisMoiHTML()').includes('1<sup>er</sup> au classement'));
  /* Les salles ouvertes */
  const salles = [{ code: 'AAA111', niv: 'm', manches: 3, nb: 2, max: 5, hote: '@lea', pays: 'BE', joueurs: [] }, { code: 'BBB222', niv: 'm', manches: 1, nb: 4, max: 5, hote: '@tom', joueurs: [] },
    { code: 'CCC333', niv: 'f', manches: 1, nb: 4, max: 5, hote: '@kev', joueurs: [] }, { code: 'bad', niv: 'm', nb: 1, max: 5, hote: '@x' }, { code: 'DDD444', niv: 'm', manches: 1, nb: 5, max: 5, hote: '@plein' }];
  const r = bac({ rpc: f => f === 'jeu_salles_ouvertes' ? salles : {} });
  r.ev('sallesCharger(true)'); await attendre(); await attendre();
  assert.deepEqual(J(r.ev('DEFIS.salles.map(s=>s.code)')), ['AAA111', 'BBB222', 'CCC333'], 'les salles invalides ou pleines sont écartées');
  /* 5 novembre, 11 h 37 : plus de « Trouver une salle » ; 12 h 52 : plus de « Créer ma salle » non plus, le cadre n’a qu’un « Créer une salle » */
  assert.equal(r.ev('typeof jeuPartieRapide'), 'undefined');
  assert.equal(r.ev('typeof jeuSalleOuverte'), 'undefined');
});

test('« Rejoins une partie » : l’hôte et son drapeau, les places, le niveau, « Rejoindre » ; sans salle, la phrase d’Elisa', () => {
  const c = bac();
  c.ev("DEFIS.salles=[{code:'AAA111',niv:'m',manches:3,nb:2,max:5,hote:'@lea<b>',pays:'BE',joueurs:[]}]");
  c.ev('sallesRepeindre()');
  const h = c.els['dx-rejoindre'].innerHTML;
  assert.ok(h.includes('<h3 class="dx-rj-h" id="dx-rejoindre-h">Rejoins une partie</h3><span class="dx-live">1 en direct</span>'));
  assert.ok(h.includes('<b>@lea&lt;b&gt; <span class="dx-plp">2/5</span></b>'), 'le pseudo échappé, les places');
  assert.ok(h.includes('<i class="dx-niv is-m">Moyen</i> · 3 manches') && h.includes('<i class="jeu-flag" aria-hidden="true">[BE]</i>'));
  assert.ok(h.includes("onclick=\"sallesRejoindre('AAA111')\""));
  /* 12 h 52 : un seul cadre ; la rangée du barème reste dessous */
  assert.ok(!h.includes('defisCarte(') && !h.includes('Trouver une salle') && !h.includes('Créer ma salle'));
  assert.ok(c.els['defis-salles'].innerHTML.includes('<b>Comment sont calculés les points&nbsp;?</b>'));
  c.ev('DEFIS.salles=[]'); c.ev('sallesRepeindre()');
  assert.ok(c.els['dx-rejoindre'].innerHTML.endsWith('<p class="dx-vide is-aucune">Aucune salle à ton niveau&nbsp;? Crée la tienne et laisse les autres te rejoindre&nbsp;!</p>'));
  c.ev("DEFIS.salles=null;DEFIS.sallesErr='net'"); c.ev('sallesRepeindre()');
  assert.ok(c.els['dx-rejoindre'].innerHTML.includes('Pas de connexion&nbsp;: les salles ouvertes reviennent avec internet.'));
});

test('une salle créée est publique par défaut ; l’hôte la publie dès que la base la connaît', async () => {
  assert.ok(app.includes("let JEU=null,jeuNiv='f',jeuNb=1,jeuMode='solo',jeuNivUser=false,jeuVis='pub';"), 'publique par défaut (19 h 10)');
  assert.ok(fn('defisFeuilleHTML', '\n}\n').includes("${seg('vis',[['pub','Tout le monde'],['priv','Sur invitation']],jeuVis)}"));
  assert.ok(app.includes("else jeuPseudoPuis(()=>jeuStart(jeuRand(6),true,null,{nomId:'jeu-nom',pub:jeuVis==='pub'}));"));
  assert.ok(app.includes("pub:!solo&&!!opts.pub,pour:solo?'':jeuNom(opts.pour||''),") && app.includes("if(host&&JEU.pub&&typeof jeuPublier==='function')jeuPublier(JEU,0);"));
  let n = 0;
  const c = bac({ rpc: f => f === 'jeu_salle_publier' ? (++n < 3 ? { ok: false, raison: 'introuvable' } : { ok: true }) : {} });
  c.ev("JEU={code:'ABC123',solo:false,pub:true,created:true};jeuPublier(JEU,0)");
  for (let k = 0; k < 4; k++) { c.tick(); await attendre(); }
  assert.equal(c.appels.filter(a => a[0] === 'jeu_salle_publier').length, 3, 'des essais jusqu’à ce que la salle existe');
  assert.equal(c.ev('JEU.pubOk'), true);
  assert.deepEqual(J(c.minut.map(m => m[1])), [], 'puis plus rien');
  /* La salle d’attente le dit */
  const r = fn('jeuRender', '\nfunction jeuNextRound(){');
  assert.ok(r.includes("host?(J.pub?'Ta salle est ouverte':J.pour?`Défie ${esc(J.pour)}`:'Invite tes amis')"));
  assert.ok(app.includes("${JEU.pub?'Ta salle est visible par les autres joueurs.':'Personne n’a encore rejoint : partage le code.'}"), 'sans nommer « Salles ouvertes » (11 h 37)');
});

test('le classement : 5 par page qu’on fait glisser, depuis toujours par défaut, la semaine en vue, sa place toujours là', async () => {
  const lignes = p => Array.from({ length: p < 4 ? 5 : 3 }, (_, i) => ({ id: 'id' + (p * 5 + i), pseudo: '@j' + (p * 5 + i), pays: 'FR', pts: 900 - (p * 5 + i), parties: 3, rang: p * 5 + i + 1, moi: p * 5 + i === 11 }));
  const c = bac({ rpc: (f, b) => f === 'jeu_classement_v2' ? { lignes: lignes(b.p_page), total: 23, moi: { rang: 12, pts: 889, page: 2 }, rangs: { monde: 12, pays: 4, mon_pays: 'FR' } } : {} });
  assert.equal(c.ev('DEFIS.periode'), 'tout', 'depuis toujours par défaut');
  c.ev('clsPageCharger(0)'); await attendre();
  assert.deepEqual(J(c.appels.at(-1)), ['jeu_classement_v2', { p_cle: 'K'.repeat(32), p_portee: 'monde', p_periode: 'tout', p_page: 0, p_pays: null, p_pseudos: null }]);
  assert.equal(c.ev('clsPagesNb()'), 5, '23 joueurs : 5 pages de 5');
  c.ev('DEFIS.cls.page=1;clsNavPeindre()');
  assert.equal(c.els['dx-range'].textContent, '6 à 10 sur 23');
  assert.equal(c.els['dx-prev'].disabled, false);
  c.ev('DEFIS.cls.page=4;clsNavPeindre()');
  assert.equal(c.els['dx-range'].textContent, '21 à 23 sur 23');
  assert.equal(c.els['dx-next'].disabled, true);
  c.ev('clsPlacePeindre()');
  assert.ok(c.els['dx-place'].innerHTML.includes('onclick="clsAllerPage(2)"') && c.els['dx-place'].innerHTML.includes('<i>Toi</i> · page 3 ›'), 'un toucher ramène à sa page');
  /* La semaine, puis un pays : la clé change, les pages repartent de zéro */
  c.ev("DEFIS.periode='semaine';DEFIS.portee='pays';clsPageCharger(0)"); await attendre();
  assert.deepEqual(J(c.appels.at(-1)[1]), { p_cle: 'K'.repeat(32), p_portee: 'pays', p_periode: 'semaine', p_page: 0, p_pays: 'FR', p_pseudos: null });
  c.ev("DEFIS.portee='amis';clsPageCharger(0)"); await attendre();
  assert.ok(Array.isArray(c.appels.at(-1)[1].p_pseudos), 'mes amis : leurs pseudos');
  /* Le défilement horizontal aimanté, une page à la fois */
  for (const k of ['html.lq #scr-defis .dx-pages{display:flex;gap:10px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;',
    'html.lq #scr-defis .dx-page{flex:0 0 calc(100% - 22px);margin:0;scroll-snap-align:start;scroll-snap-stop:always}', 'html.lq #scr-defis .dx-dots i.on{width:22px;background:var(--accent)}'])
    assert.ok(lq.includes(k), k);
  assert.ok(bloc.includes("sc.addEventListener('scroll',()=>{clearTimeout(t);t=setTimeout(()=>clsPageVue(),90);},{passive:true});"), 'la page suit le doigt');
  assert.ok(bloc.includes('clsNavPeindre();clsPageCharger(p);clsPageCharger(p+1);'), 'la page vue et la suivante se chargent');
});

test('sans la nouvelle base, le classement retombe sur l’ancien Top 12, en pages de 5', async () => {
  const top = Array.from({ length: 12 }, (_, i) => ({ id: 'i' + i, pseudo: '@p' + i, pts: 100 - i, parties: 1, rang: i + 1 }));
  const c = bac({ rpc: f => f === 'jeu_classement_v2' ? Promise.reject({ status: 404, code: 'PGRST202' }) : f === 'jeu_classement' ? { top, total: 40, moi: { id: 'i3', rang: 4, pts: 97 } } : {} });
  c.ev('clsPageCharger(0)'); await attendre(); await attendre(); await attendre();
  assert.equal(c.ev('DEFIS.cls.v1'), true);
  assert.deepEqual(J(c.ev('Object.keys(DEFIS.cls.pages)')), ['0', '1', '2']);
  assert.equal(c.ev('DEFIS.cls.total'), 12);
  assert.equal(c.ev('DEFIS.cls.moi.page'), 0);
});

test('Amis : les adversaires et ceux qu’on ajoute par leur pseudo ; qui est dans une salle ouverte', async () => {
  const now = Date.now();
  const c = bac({ salle: { mates: { tom: { n: '@tom', g: 4, w: 3, l: 1, at: now - 1000 } }, amisAjoutes: [{ n: '@lea', at: now - 500 }] },
    rpc: (f, b) => f === 'jeu_drapeaux' ? (b.p_pseudos[0] === '@noe' ? [{ q: '@noe', pseudo: '@noe', pays: 'CH' }] : []) : {} });
  assert.deepEqual(J(c.ev('amisListe().map(a=>a.n+":"+a.g+(a.ajout?"+":""))')), ['@lea:0+', '@tom:4']);
  c.ev("DEFIS.salles=[{code:'AAA111',niv:'f',manches:1,nb:2,max:5,hote:'@kev',joueurs:[{pseudo:'@kev'},{pseudo:'@tom'}]}];defisAmisPeindre()");
  const s = c.els['dx-amis-salles'].innerHTML, l = c.els['dx-amis-liste'].innerHTML;
  assert.ok(s.includes('Dans une salle maintenant') && s.includes('<b>@tom <span class="dx-plp">2/5</span></b>') && s.includes("sallesRejoindre('AAA111')"));
  assert.ok(l.includes('<em>3–1</em><small>tu mènes</small>') && l.includes("onclick=\"jeuDefier('@tom')\"") && l.includes("onclick=\"amisRetirer('@lea')\""));
  /* Ajouter : il doit exister */
  c.el('dx-ajout-in').value = 'Noé!'; c.ev('amisAjouter()'); await attendre();
  assert.equal(c.els['dx-ajout-msg'].textContent, 'Aucun joueur ne s’appelle @no.');
  c.el('dx-ajout-in').value = '@noe'; c.ev('amisAjouter()'); await attendre();
  assert.deepEqual(J(c.ctx.state.salle.amisAjoutes.map(a => a.n)), ['@lea', '@noe']);
  c.el('dx-ajout-in').value = '@elisa_sql'; c.ev('amisAjouter()');
  assert.equal(c.els['dx-ajout-msg'].textContent, 'C’est ton pseudo à toi.');
  /* Défier : une salle privée */
  c.ev("jeuDefier('@tom')");
  assert.deepEqual(J(c.appels.filter(a => a[0] === 'jeuStart').at(-1)), ['jeuStart', 'NOUV01', true, null, { nomId: 'jeu-nom', pub: false, pour: '@tom' }]);
  /* « amis » compte les parties à plusieurs : la liste est ailleurs, et la progression la garde */
  const ns = app.slice(app.indexOf('function normalizeState(raw){'));
  assert.ok(ns.includes('salle.amis=salleN(salleSrc.amis);'));
  for (const k of ['if(salleSrc.paysVoir===false)salle.paysVoir=false;', "if(typeof salleSrc.paysEnv==='string'&&/^([A-Z]{2})?$/.test(salleSrc.paysEnv))salle.paysEnv=salleSrc.paysEnv;",
    'const a=salleSrc.amisAjoutes.filter(x=>x&&typeof x===\'object\'&&!Array.isArray(x)).map(x=>({n:psForme(x.n),at:salleBig(x.at)})).filter(x=>x.n).slice(-50);'])
    assert.ok(ns.includes(k), k);
});

test('la confidentialité, IOS.md, l’erreur réseau traduite, le cache et les versions', () => {
  const conf = lire('decouvrir/confidentialite.html');
  assert.ok(conf.includes('Une salle publique (le choix proposé quand tu en crées une) apparaît dans la liste des salles ouvertes («&nbsp;Rejoins une partie&nbsp;»)'));
  assert.ok(conf.includes('Ton pays y est enregistré avec lui, pour afficher ton drapeau à côté de ton pseudo dans les défis&nbsp;; tu peux le masquer dans Mon compte («&nbsp;Afficher mon drapeau&nbsp;»).'));
  assert.ok(conf.includes('Les autres joueurs voient le classement (5 joueurs par page, avec leur drapeau)'));
  assert.ok(conf.includes('<p class="lg-maj">Dernière mise à jour&nbsp;: 6 novembre 2026</p>'), 'mise à jour le 6 novembre : les durées de conservation');
  const ios = lire('IOS.md');
  assert.ok(ios.includes('- **Défis en trois onglets**') && ios.includes('« Localisation approximative » (le pays)'));
  const ms = lire('multiplayer-security.js');
  assert.ok(ms.includes("/failed to fetch|load failed|network ?error|network request failed|abort/i.test(raw)") && ms.includes("const text = offline ? 'La salle est indisponible. Vérifie ta connexion et réessaie.' : raw;"), 'plus de « Load failed » brut');
  assert.ok(app.includes('<script src="multiplayer-security.js?v=3"></script>') && sw.includes("'./multiplayer-security.js?v=3',"));
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=184">'));
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  assert.ok(app.includes(`const SW_CACHE='${cache}';`) && cache === 'requete-2026-11-06-anti-triche-v2585');
});
