/* Elisa, 31 octobre, 16 h 49 : six retours.
   « faire une notif in-app avec la même DA que le site internet, pareil s’il y a encore une notif comme ça » ;
   « rapidité : c’est juste du bonus, on n’enlève pas de point ; peut-être un nombre de points à la base qui baisse en fonction du temps
     (par ex. 200 à la base puis ça descend) » ;
   « ne pas pouvoir changer de pseudo → intégration Supabase, pseudo unique par personne (base), ou on propose un pseudo s’il est pris
     (micro-animé), choix du pseudo à la connexion » ;
   réf. 4 « garder que la première phrase » ; réf. 5 « problème d’espace » ;
   réf. 6 « pouvoir mettre en évidence quand on a joué à 2, 3, 4, 5 avec aussi leur nombre de points (max 5 pour une salle) ».
   Le code de l’appli est exécuté avec un faux DOM et une fausse base. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const s51 = css.slice(css.indexOf('/* ---------- 51. Retours du 31 octobre, 16 h 49'));
const dir = new URL('../supabase/migrations/', import.meta.url);
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const fn = name => { const a = app.indexOf(`function ${name}(`); assert.ok(a > 0, name); return app.slice(a, app.indexOf('\n}', a) + 2); };
const line = name => { const a = app.indexOf(`function ${name}(`); assert.ok(a > 0, name); return app.slice(a, app.indexOf('\n', a)) + '\n'; };
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const plain = v => JSON.parse(JSON.stringify(v));
const flush = () => new Promise(r => setImmediate(r));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/* ---------- Un faux DOM : des éléments par identifiant ; l’écran de l’onboarding (#onboarding) accueille la mini-page du pseudo ---------- */
function mkEl(id) {
  const cls = new Set(), attrs = {};
  return {
    id, value: '', disabled: false, innerHTML: '', textContent: '', offsetWidth: 0, removed: false, attrs,
    classList: {
      add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)), contains: c => cls.has(c),
      toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; if (on) cls.add(c); else cls.delete(c); return on; },
    },
    setAttribute: (k, v) => { attrs[k] = String(v); }, removeAttribute: k => { delete attrs[k]; },
    get className() { return [...cls].join(' '); },
    set className(v) { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(x => cls.add(x)); },
  };
}
const psBlock = cut('/* ---------- Pseudo unique ----------', 'function renderDefisPerf(){');
const OB = app.match(/const OB_SLIDES = (\[[^\]]+\]);/)[1];

function pseudoCtx({ reply = () => ({ ok: true }), salle, name = 'Elisa', onboarded = true, online = true } = {}) {
  const els = {}, calls = [], buzzes = [], said = [], store = {}, timers = [], asks = [], infos = [];
  let tid = 0;
  const get = id => (els[id] ||= mkEl(id));
  const document = {
    getElementById: id => get(id),
    querySelector: sel => (sel === '.acc-pseudo em' ? get('acc-pseudo-em') : null),
  };
  const ctx = vm.createContext({
    state: { name, onboarded, ...(salle ? { salle: JSON.parse(JSON.stringify(salle)) } : {}) },
    document, navigator: { onLine: online }, Date, Math, JSON,
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    setTimeout: (f, ms) => { const id = ++tid; timers.push({ id, f, ms }); return id; },
    clearTimeout: id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
    esc, escAttr, prefersReduceMotion: () => true, buzz: k => buzzes.push(k), lqSay: t => said.push(t),
    lqAsk: o => { asks.push(plain(o)); return Promise.resolve(ctx.askAnswer !== false); }, lqInfo: (...a) => infos.push(a),
    clsCle: () => 'K'.repeat(32), clsSalle: () => (ctx.state.salle ||= {}), CLS: { data: { top: [] }, at: 5 },
    clsRpc: (f, body) => { calls.push({ fn: f, body: plain(body) }); const r = reply(f, body); return r instanceof Error ? Promise.reject(r) : Promise.resolve(r); },
    renderCompte() { ctx.compte = (ctx.compte || 0) + 1; }, renderDefis() {}, closePlusDetails() { ctx.closed = (ctx.closed || 0) + 1; },
    obStep: 1, draft: { name: 'Elisa' }, obNamePreview() {}, obBarreEtat: on => { ctx.barre = on; }, brancherObSwipeV2() {}, paintOb() { ctx.painted = (ctx.painted || 0) + 1; },
    activeTab: 'learn', saves: 0,
  });
  ctx.save = () => { ctx.saves++; };
  vm.runInContext(`var OB_SLIDES=${OB};` + cut('function jeuNom(v)', '/* Le pseudo dans la salle :') + psBlock + cut('function obPseudoTape(el){', 'function obInput(') + fn('obInput'), ctx);
  const run = () => { while (timers.length) timers.shift().f(); };
  const root = get('onboarding');
  return { ctx, ev: c => vm.runInContext(c, ctx), el: get, root, calls, buzzes, said, store, timers, run, asks, infos };
}

test('pseudo — la mini-page vérifie en direct : « déjà pris », le champ tremble, trois pseudos libres arrivent ; en toucher un le met dans le champ', async () => {
  const p = pseudoCtx({ reply: (f, b) => (f === 'jeu_pseudo_libre' ? (b.p_pseudo === '@léa' ? { ok: false, raison: 'pris', idees: ['@léa_sql', '@léa.db', '@léa42'] } : { ok: true }) : { ok: true }) });
  p.ev('psPage({})');
  assert.equal(p.ev("OB_SLIDES[obStep]"), 'pseudo', 'la mini-page, dans l’écran de l’onboarding');
  assert.ok(p.root.classList.contains('on') && !('aria-hidden' in p.root.attrs) && p.ctx.barre === true && p.ctx.painted === 1);
  const etat = p.el('ob-ps-etat'), idees = p.el('ob-ps-idees'), inp = p.el('ob-pseudo'), next = p.el('ob-next');
  p.ev("obInput('pseudo','  Léa ')");
  assert.equal(etat.className, 'ps-etat is-verif');
  assert.match(etat.innerHTML, /^<i class="ps-dots" aria-hidden="true"><b><\/b><b><\/b><b><\/b><\/i>Vérification…$/);
  assert.equal(p.calls.length, 0, 'on attend la fin de la frappe');
  p.run(); await flush();
  assert.deepEqual(p.calls, [{ fn: 'jeu_pseudo_libre', body: { p_pseudo: '@léa', p_cle: 'K'.repeat(32) } }], 'le pseudo en identifiant (18 h 22 : @, minuscules, sans espace), avec la clé de l’appareil');
  assert.equal(etat.className, 'ps-etat is-pris');
  assert.equal(etat.innerHTML, '<i class="ps-no" aria-hidden="true">!</i>« @léa » est déjà pris. Prends-en un libre :');
  assert.equal(idees.innerHTML, ['@léa_sql', '@léa.db', '@léa42'].map((v, i) => `<button type="button" class="ps-idee" style="--i:${i}" data-v="${v}" onclick="psIdee('ob',this.dataset.v)">${v}</button>`).join(''), 'trois pastilles, l’une après l’autre (--i)');
  assert.ok(inp.classList.contains('is-ko') && !inp.classList.contains('is-ok'));
  assert.ok(p.buzzes.includes('warning'));
  assert.equal(next.disabled, true, '« C’est mon pseudo » attend un pseudo libre');
  /* Toucher une pastille : elle va dans le champ, et la vérification repart */
  p.ev("psIdee('ob','@léa.db')");
  assert.equal(inp.value, 'léa.db', 'le @ est posé devant le champ'); assert.equal(p.ctx.draft.pseudo, '@léa.db'); assert.equal(p.ctx.draft.name, 'Elisa', 'le prénom n’y est pour rien');
  assert.ok(p.buzzes.includes('selection'));
  p.run(); await flush();
  assert.equal(etat.className, 'ps-etat is-libre');
  assert.equal(etat.innerHTML, '<i class="ps-ok" aria-hidden="true">✓</i>Disponible : il sera à toi');
  assert.equal(idees.innerHTML, '', 'les pastilles s’en vont');
  assert.ok(inp.classList.contains('is-ok') && !inp.classList.contains('is-ko'));
  assert.equal(next.disabled, false);
  /* Une réponse en retard (frappe suivante déjà partie) est ignorée */
  const q = pseudoCtx({ reply: (f, b) => (b.p_pseudo === '@tom' ? { ok: false, raison: 'pris', idees: [] } : { ok: true }) });
  q.ev('psPage({})');
  q.ev("psVerif('ob','T');psVerif('ob','To')"); assert.equal(q.timers.length, 1, 'une seule vérification par pause de frappe');
  q.ev("psVerif('ob','Tom')"); q.run();
  q.ev("psVerif('ob','Tomy')"); await flush();
  assert.equal(q.el('ob-ps-etat').className, 'ps-etat is-verif', 'la réponse pour « @tom » arrive trop tard : rien ne bouge');
  q.run(); await flush();
  assert.deepEqual(q.calls.map(c => c.body.p_pseudo), ['@tom', '@tomy']);
  assert.equal(q.el('ob-ps-etat').className, 'ps-etat is-libre');
  /* Les autres réponses du serveur */
  const r = pseudoCtx({ reply: () => ({ ok: false, raison: 'refuse', idees: ['Joueur_sql'] }) });
  r.ev('psPage({})'); r.ev("psVerif('ob','Connard')"); r.run(); await flush();
  assert.equal(r.el('ob-ps-etat').innerHTML, '<i class="ps-no" aria-hidden="true">!</i>Ce pseudo n’est pas accepté. Prends-en un libre :');
  const off = pseudoCtx({ reply: () => new TypeError('Failed to fetch') });
  off.ev('psPage({})'); off.ev("psVerif('ob','Zoé')"); off.run(); await flush();
  assert.equal(off.el('ob-ps-etat').innerHTML, 'Pas de réseau : il sera vérifié dès ton retour en ligne.');
});

test('pseudo — « C’est mon pseudo » le réserve pour l’appareil, sans toucher au prénom ; « Plus tard » ferme la page', async () => {
  const p = pseudoCtx({ reply: (f, b) => (f === 'jeu_pseudo_prendre' ? { ok: true, pseudo: b.p_pseudo } : { ok: true }) });
  p.ctx.suite = () => { p.ctx.s1 = (p.ctx.s1 || 0) + 1; }; p.ctx.ok = () => { p.ctx.s2 = (p.ctx.s2 || 0) + 1; };
  p.ev('psPage({suite,siOk:ok})');
  const next = p.el('ob-next');
  p.ev("draft.pseudo='@léa.db';PS.etat.ob='libre';obPseudoSuivant()");
  assert.ok(next.classList.contains('is-busy') && next.disabled, 'le bouton attend la réponse');
  await flush();
  assert.deepEqual(p.calls, [{ fn: 'jeu_pseudo_prendre', body: { p_cle: 'K'.repeat(32), p_pseudo: '@léa.db' } }]);
  assert.equal(p.ctx.state.salle.pseudo, '@léa.db'); assert.ok(p.ctx.state.salle.pseudoVu > 0);
  assert.equal(p.ctx.state.name, 'Elisa', 'le prénom reste le prénom');
  assert.equal(p.store['rq-jeu-nom'], '@léa.db'); assert.ok(p.ctx.saves >= 1);
  assert.deepEqual(p.said, ['Pseudo réservé : @léa.db']); assert.ok(p.buzzes.includes('success'));
  assert.ok(!p.root.classList.contains('on') && p.root.attrs['aria-hidden'] === 'true' && p.ctx.barre === false, 'la page se ferme');
  assert.equal(p.ctx.s1, 1, 'la suite (l’appli, après l’onboarding)'); assert.equal(p.ctx.s2, 1, 'et ce qui attendait le pseudo (une salle entre amis)');
  assert.equal(p.ev('jeuSavedNom()'), '@léa.db');
  p.ev("psVerif('ob','léa.db')");
  assert.equal(p.el('ob-ps-etat').innerHTML, '<i class="ps-ok" aria-hidden="true">✓</i>C’est ton pseudo');
  /* Pris entre-temps : on reste, avec des pseudos libres ; un pseudo pris ne part pas */
  const q = pseudoCtx({ reply: f => (f === 'jeu_pseudo_prendre' ? { ok: false, raison: 'pris', idees: ['Tom_sql'] } : { ok: true }) });
  q.ev('psPage({})'); q.ev("draft.pseudo='@tom';PS.etat.ob='libre';obPseudoSuivant()"); await flush();
  assert.ok(q.root.classList.contains('on')); assert.equal(q.el('ob-ps-etat').className, 'ps-etat is-pris');
  assert.match(q.el('ob-ps-idees').innerHTML, /data-v="@tom_sql"/); assert.equal(q.el('ob-next').disabled, true);
  assert.equal(q.ctx.state.salle, undefined, 'rien n’est réservé');
  q.ev("obPseudoSuivant()"); assert.equal(q.calls.length, 1);
  /* Sans réseau : le pseudo est gardé (réservé au retour du réseau, sans être redemandé) et la page se ferme */
  const off = pseudoCtx({ reply: () => new TypeError('Failed to fetch') });
  off.ev('psPage({})'); off.ev("draft.pseudo='@zoé';PS.etat.ob='horsligne';obPseudoSuivant()"); await flush();
  assert.ok(!off.root.classList.contains('on')); assert.equal(off.ctx.state.salle.psVoulu, '@zoé');
  assert.deepEqual(off.said, ['Pas de réseau : @zoé sera réservé dès ton retour en ligne.']);
  const off2 = pseudoCtx({ reply: () => new TypeError('Failed to fetch') });
  off2.ev('psPage({})'); off2.ev("draft.pseudo='@zoé';PS.etat.ob='horsligne';obPseudoPlusTard()");
  assert.equal(off2.ctx.state.salle.psVoulu, '@zoé', '« Plus tard » sans réseau : le pseudo tapé est gardé');
  /* « Plus tard » : la suite continue, pas ce qui attendait le pseudo ; la page ne revient plus toute seule */
  const l = pseudoCtx();
  l.ctx.suite = () => { l.ctx.s1 = 1; }; l.ctx.ok = () => { l.ctx.s2 = 1; };
  l.ev('psPage({suite,siOk:ok})'); l.ev('obPseudoPlusTard()');
  assert.ok(!l.root.classList.contains('on')); assert.equal(l.ctx.s1, 1); assert.equal(l.ctx.s2, undefined);
  assert.equal(l.ctx.state.salle.psPage, 1);
  assert.equal(l.calls.length, 0);
});

test('pseudo — une salle entre amis a besoin du pseudo réservé ; à l’ouverture de l’appli, la mini-page une fois ; supprimer son pseudo', async () => {
  /* 2 novembre, 23 h 45 : « ne pas le mettre avant d’entrer dans une salle défi » : jamais la mini-page ici. Sans pseudo, celui
     du prénom de l’onboarding est réservé sans rien demander, et la salle s’ouvre. */
  const a = pseudoCtx({ reply: (f, b) => ({ ok: true, pseudo: b.p_pseudo }) });
  a.ctx.ran = 0; a.ctx.go = () => { a.ctx.ran++; };
  a.ev('jeuAvecPseudo(go)'); await flush(); await flush();
  assert.ok(!a.root.classList.contains('on') && a.ctx.ran === 1, 'pas de mini-page : la salle s’ouvre');
  assert.deepEqual(a.calls.map(x => x.body.p_pseudo), ['@elisa'], 'le prénom de l’onboarding, en identifiant');
  assert.deepEqual(a.said, ['Tu joues en tant que @elisa']);
  const a2 = pseudoCtx({ reply: (f, b) => (b.p_pseudo === '@elisa' ? { ok: false, raison: 'pris', idees: ['@elisa_sql'] } : { ok: true, pseudo: b.p_pseudo }) });
  a2.ctx.ran = 0; a2.ctx.go = () => { a2.ctx.ran++; };
  a2.ev('jeuAvecPseudo(go)'); for (let i = 0; i < 4; i++) await flush();
  assert.ok(!a2.root.classList.contains('on') && a2.ctx.ran === 1 && a2.ctx.state.salle.pseudo === '@elisa_sql', 'pris : le premier pseudo libre proposé, sans rien demander');
  const a3 = pseudoCtx({ reply: () => new TypeError('Failed to fetch') });
  a3.ctx.ran = 0; a3.ctx.go = () => { a3.ctx.ran++; };
  a3.ev('jeuAvecPseudo(go)'); for (let i = 0; i < 4; i++) await flush();
  assert.ok(!a3.root.classList.contains('on') && a3.ctx.ran === 0 && a3.infos[0][0] === 'Pas de réseau', 'sans réseau : on le dit, sans mini-page');
  const b = pseudoCtx({ salle: { pseudo: 'Léa' } });
  b.ctx.ran = 0; b.ctx.go = () => { b.ctx.ran++; };
  b.ev('jeuAvecPseudo(go)');
  assert.equal(b.ctx.ran, 1); assert.equal(b.calls.length, 0, 'déjà réservé : tout de suite');
  assert.equal(pseudoCtx({ name: 'Zoé' }).ev('jeuSavedNom()'), '', 'le prénom n’est jamais un pseudo');
  /* À l’ouverture de l’appli */
  for (const o of [{ onboarded: false }, { online: false }, { salle: { pseudo: 'Léa', pseudoVu: Date.now() - 3600e3 } }, { salle: { psPage: 1 } }]) {
    const v = pseudoCtx(o); v.ev('psVerifier()'); await flush();
    assert.equal(v.calls.length, 0, JSON.stringify(o)); assert.ok(!v.root.classList.contains('on'), JSON.stringify(o));
  }
  const n = pseudoCtx({ reply: (f, b) => ({ ok: true, pseudo: b.p_pseudo }) }); n.store['rq-jeu-nom'] = 'Zoé';
  n.ev('psVerifier()'); await flush();
  assert.ok(!n.root.classList.contains('on'), 'un pseudo déjà donné : pas de mini-page');
  assert.deepEqual(n.calls.map(x => x.body.p_pseudo), ['@zoé'], 'réservé sans le redemander (en identifiant)');
  assert.equal(n.ctx.state.salle.pseudo, '@zoé');
  const none = pseudoCtx();
  none.ev('psVerifier()');
  assert.ok(none.root.classList.contains('on'), 'jamais de pseudo : la mini-page');
  assert.equal(none.ctx.state.salle.psPage, 1, 'une seule fois');
  none.ev('obPseudoPlusTard();psVerifier()'); assert.ok(!none.root.classList.contains('on'), 'elle ne revient pas toute seule');
  /* Salle entre amis : le pseudo de l’onboarding gardé sans réseau est réservé sans rien demander, puis la salle s’ouvre */
  const w = pseudoCtx({ salle: { psVoulu: '@léa' }, reply: (f, b) => ({ ok: true, pseudo: b.p_pseudo }) });
  w.ctx.ran = 0; w.ctx.go = () => { w.ctx.ran++; };
  w.ev('jeuAvecPseudo(go)'); await flush();
  assert.equal(w.ctx.ran, 1); assert.ok(!w.root.classList.contains('on')); assert.equal(w.ctx.state.salle.pseudo, '@léa'); assert.equal(w.ctx.state.salle.psVoulu, undefined);
  const t = pseudoCtx({ salle: { psVoulu: '@léa' }, reply: (f, b) => (b.p_pseudo === '@léa' ? { ok: false, raison: 'pris', idees: ['@léa_sql'] } : { ok: true, pseudo: b.p_pseudo }) });
  t.ctx.ran = 0; t.ctx.go = () => { t.ctx.ran++; };
  t.ev('jeuAvecPseudo(go)'); for (let i = 0; i < 4; i++) await flush();
  assert.ok(!t.root.classList.contains('on') && t.ctx.ran === 1 && t.ctx.state.salle.pseudo === '@léa_sql', 'pris entre-temps : le premier pseudo libre, sans mini-page');
  const old = pseudoCtx({ salle: { pseudo: 'Léa', pseudoVu: Date.now() - 21 * 3600e3 }, reply: () => ({ ok: true, pseudo: 'Léa' }) });
  old.ev('psVerifier()'); await flush();
  assert.deepEqual(old.calls.map(x => x.body.p_pseudo), ['Léa'], 'une fois par jour, la réservation est vérifiée');
  assert.equal(old.ctx.state.salle.pseudo, '@léa', 'toujours le sien, sous sa forme d’identifiant');
  const lost = pseudoCtx({ salle: { pseudo: 'Léa', pseudoVu: 1 }, reply: () => ({ ok: false, raison: 'pris', idees: ['Léa.db'] }) });
  lost.ev('psVerifier()'); await flush();
  assert.equal(lost.ctx.state.salle.pseudo, undefined, 'pris par quelqu’un d’autre : il n’est plus le sien');
  assert.ok(lost.root.classList.contains('on') && lost.ev("PS.page.raison") === 'pris');
  const boot = cut('async function boot(){', 'function initSpotlight(){');
  assert.ok(boot.includes("setTimeout(()=>{try{psVerifier();}catch(e){}},2500);") && boot.includes("window.addEventListener('online',()=>{try{psVerifier();}catch(e){}});"), 'au démarrage, et au retour du réseau');
  assert.ok(fn('clsFlush').includes("if(/pris/.test(m)){const s3=clsSalle();delete s3.pseudo;delete s3.pseudoVu;save();if(typeof psPage==='function'&&!psPageOuverte())psPage({raison:'pris',voulu:nom});return;}"));
  for (const f of ['jeuEnterRoom', 'jeuJoin']) assert.ok(fn(f).includes('jeuPseudoPuis(()=>jeuStart('), f);
  /* Supprimer son pseudo (Mon compte › Données) : libéré avec les scores, la progression reste */
  const d = pseudoCtx({ salle: { pseudo: 'Léa', pseudoVu: 9, clsId: 'x', envoi: [{ u: 'A' }], pts: 400 }, reply: () => ({ ok: true }) });
  d.store['rq-jeu-nom'] = 'Léa';
  d.ev('psSupprimer()'); await flush(); await flush();
  assert.equal(d.asks[0].titre, 'Supprimer « Léa » ?'); assert.equal(d.asks[0].danger, true);
  assert.deepEqual(d.calls, [{ fn: 'jeu_pseudo_liberer', body: { p_cle: 'K'.repeat(32) } }]);
  assert.deepEqual(plain(d.ctx.state.salle), { envoi: [], pts: 400, psPage: 1 }, 'le pseudo et le classement partent ; les points de la progression restent');
  assert.equal(d.store['rq-jeu-nom'], undefined); assert.deepEqual(d.said, ['Ton pseudo est supprimé.']); assert.ok(d.ctx.compte >= 1);
  const k = pseudoCtx({ salle: { pseudo: 'Léa' } }); k.ctx.askAnswer = false;
  k.ev('psSupprimer()'); await flush();
  assert.equal(k.calls.length, 0); assert.equal(k.ctx.state.salle.pseudo, 'Léa', '« Garder mon pseudo »');
  const o = pseudoCtx({ salle: { pseudo: 'Léa' }, reply: () => new TypeError('Failed to fetch') });
  o.ev('psSupprimer()'); await flush(); await flush();
  assert.equal(o.ctx.state.salle.pseudo, 'Léa'); assert.equal(o.infos[0][0], 'Pas de réseau');
});

test('pseudo — l’onboarding demande le prénom ; la mini-page du pseudo suit, dans sa DA ; Mon compte le montre, verrouillé', () => {
  /* Elisa, 31 octobre, 17 h 53 : « non, ici ce sera le prénom, et une fois connecté la première fois, une mini-page pour le pseudo » */
  const name = cut("}else if(slide==='name'){", "}else if(slide==='pseudo'){");
  assert.ok(name.includes('<label class="ob-field"><span>Ton prénom</span><input id="ob-prenom" type="text" maxlength="32"') && name.includes('autocomplete="given-name"'));
  /* 3 novembre, 17 h 32 : la mascotte dit « Salut ! » (« Enchantée » passe dans l’accueil au prénom) ; plus de « Passer pour le moment » */
  assert.ok(name.includes("obMascotDit('Salut ! Comment dois-je t’appeler ?','coucou',false,obPrenomBulle(draft.name))") && name.includes("obSetFooter('Continuer',obNameNext,'','','',!(draft.name||'').trim());"), 'puis l’âge (3 novembre, 13 h 25)');
  assert.ok(!name.includes('psVerif') && !name.includes('ob-ps-etat'), 'le prénom ne passe plus par la base');
  assert.ok(fn('obInput').includes("if(champ==='name'){draft.name=String(val||'').slice(0,32);obNamePreview();obNameCta();}"));
  const page = cut("}else if(slide==='pseudo'){", "}else if(slide==='goal'){");
  assert.ok(page.includes('<h1 class="ob-title" id="ob-title">Choisis ton<br> <em>pseudo</em>.</h1>') && page.includes('C’est ton nom dans les salles de défi et au classement.'));
  /* 18 h 22 : le @ posé dans le champ, en minuscules, sans espace ; plus de « unique dans l’appli » ni de texte en bas */
  assert.ok(page.includes('<label class="ob-field ob-field-at"><span>Ton pseudo</span><span class="ob-at-box"><b class="ob-at" aria-hidden="true">@</b><input id="ob-pseudo" type="text" maxlength="15"'));
  assert.ok(page.includes('autocapitalize="none" autocorrect="off" spellcheck="false"') && page.includes('oninput="obPseudoTape(this)"') && page.includes('<p class="ps-etat" id="ob-ps-etat" role="status" aria-live="polite"></p>'));
  assert.ok(page.includes("obSetFooter('C’est mon pseudo',obPseudoSuivant,pg.obligatoire?'':'Plus tard',pg.obligatoire?'':obPseudoPlusTard,'',!v);"), '« Plus tard » depuis l’app ; obligatoire pendant l’onboarding (4 novembre, 17 h 27)');
  assert.ok(!page.includes('unique dans l’appli') && !page.includes('Il est unique et ne se changera plus') && !page.includes('ob-helper'), 'ni « unique dans l’appli », ni texte en bas');
  assert.ok(app.includes("const OB_SLIDES = ['bonjour','welcome','questions','name','pays','age','job','goal','level','rhythm','jours','build','methode','temoignages','pact','practice','source','rappel','widget','widgetTuto','widgetVerrou','widgetVerrouTuto','pseudo','ready','account','paywall'];"));
  const back = app.slice(app.lastIndexOf('function obBack(){'), app.indexOf('\n}', app.lastIndexOf('function obBack(){')));
  assert.ok(back.includes("if(obStep===0||OB_SLIDES[obStep]==='pseudo')return;"), 'pas de retour depuis la mini-page');
  /* La fin de l’onboarding : la mini-page, puis l’appli */
  const fin = app.slice(app.lastIndexOf('function finishOnboard(action){'), app.indexOf('function obTerminer(action){'));
  assert.ok(fin.includes("if(!psMien()&&!clsSalle().psVoulu&&typeof psPage==='function'){const s=clsSalle();s.psPage=1;save();psPage({voulu:psAncien(),obligatoire:true,suite:()=>obTerminer(action)});return;}"))   // 4 novembre, 17 h 27 : obligatoire, redemandée tant qu’il n’y en a pas (ni gardé hors ligne);
  assert.ok(!fin.includes("localStorage.setItem('rq-jeu-nom'"), 'le prénom ne devient plus le pseudo des salles');
  /* Mon compte */
  const ctx = vm.createContext({ PS_LOCK_SVG: '<svg data-k="lock"></svg>', ACCT_CHEV: '<svg data-k="chev"></svg>', esc, mien: '' });
  vm.runInContext(line('jeuNom') + line('jeuInitial') + fn('accPseudoHTML') + 'function psMien(){return mien;}', ctx);
  ctx.mien = 'Léa';
  /* 1er novembre, 0 h 06 : la carte prend la DA du site (trait sous le pseudo) ; 5 novembre, 21 h 01 : le drapeau à la place du
     cadenas, le niveau et l’objectif sous le pseudo (absents ici : ni pays, ni niveau, ni objectif dans ce contexte) */
  assert.equal(vm.runInContext("accPseudoHTML('Léa')", ctx), '<div class="acc-pseudo" style="--l:3"><span class="acc-pseudo-av"><span aria-hidden="true">L</span></span><span class="acc-pseudo-t"><b><span class="acc-pseudo-nm">Léa<svg class="acc-pseudo-sw" viewBox="0 0 300 30" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M4 20C70 8 170 6 296 14"/></svg></span></b></span></div>');
  ctx.mien = '';
  assert.equal(vm.runInContext("accPseudoHTML('')", ctx), '<button type="button" class="acc-pseudo is-vide" onclick="closePlusDetails();psPage({})"><span class="acc-pseudo-av" aria-hidden="true">?</span><span class="acc-pseudo-t"><small>Pseudo</small><b><span class="acc-pseudo-nm">Choisis ton pseudo</span></b></span><span class="acc-pseudo-go" aria-hidden="true"><svg data-k="chev"></svg></span></button>');
  assert.ok(app.includes('        ${accPseudoHTML(jeuSavedNom())}'));
  /* 1er novembre, 1 h 01 : « ne pas pouvoir supprimer son pseudo » dans l’appli — sur demande, depuis « Nous contacter » */
  assert.ok(!app.includes('<b>Supprimer mon pseudo</b>') && app.includes('et reste à toi&nbsp;: «&nbsp;Supprimer mon compte&nbsp;», dans Mon compte, le libère avec tes scores.'), 'Données et confidentialité (4 novembre, 22 h 08 : « Supprimer mon compte »)');
  for (const gone of ['id="acc-name"', 'class="acc-save"', 'function saveAccountName(', 'function clsRenommer(', 'function jeuNomEdit(', 'function psFeuille(', 'function psValider('])
    assert.ok(!app.includes(gone), 'retiré : ' + gone);
  for (const part of ['html.lq .acc-pseudo{display:flex;', 'html.lq .jeu-me-lock{', 'html.lq .jeu-me.is-vide{', '.ps-idee{min-height:40px;',
    '@keyframes psIdee{from{opacity:0;transform:translateY(12px) scale(.8) rotate(-4deg)}to{opacity:1;transform:none}}', '.is-shake{animation:psShake .42s'])
    assert.ok(s51.includes(part), part);
  assert.ok(!/is-vide\{[^}]*dashed/.test(s51), 'pas de pointillés');
  assert.ok(css.includes('html #onboarding .ps-etat.is-pris,html #onboarding .ps-etat.is-refuse,html #onboarding .ps-etat.is-invalide{color:#FFE0E2}'), 'lisible sur le violet');
  /* La progression garde le pseudo réservé */
  const ns = cut('function normalizeState(raw){', 'function normalize(');
  assert.ok(ns.includes("if(typeof salleSrc.pseudo==='string'){const p=psForme(salleSrc.pseudo);if(p)salle.pseudo=p;}") && ns.includes('if(salleSrc.pseudoVu)salle.pseudoVu=salleBig(salleSrc.pseudoVu);'), 'sous sa forme d’identifiant (18 h 22)');
});

test('« notif in-app » : effacer la progression passe par deux feuilles de l’appli, plus aucune fenêtre du navigateur', async () => {
  assert.ok(!/\b(?:confirm|alert|prompt)\(\s*['"`]/.test(app), 'plus de confirm(), alert() ni prompt()');
  const src = cut('async function resetAllProgress(){', '\n}\n') + '\n}\n';
  const asks = [], rpc = [], answers = [];
  const ctx = vm.createContext({
    lqAsk: o => { asks.push(plain(o)); return Promise.resolve(answers.shift()); }, closePlusDetails() { ctx.closed = (ctx.closed || 0) + 1; },
    clsRpc: (f, b) => { rpc.push([f, plain(b)]); return Promise.resolve({}); }, save() {}, stkSync() {}, buildDb() {}, db: { export: () => 'octets' }, attachDateFns() {},
    renderModules() {}, renderDefis() {}, renderProgress() {}, renderCollection() {}, renderNotes() {}, renderPlanning() {}, renderCompte() {}, renderGreeting() {},
  });
  const before = { lessons: { 1: { done: true } }, defis: { c1: true }, notes: [{ t: 'x' }], plan: { per: 3 }, onboarded: true, name: 'Léa', profile: { goal: 'job' }, accountMode: 'guest',
    salle: { cle: 'K'.repeat(32), pseudo: 'Léa', pseudoVu: 42, pts: 900, hist: [{ pts: 1 }] } };
  ctx.state = JSON.parse(JSON.stringify(before));
  vm.runInContext('var baseBytes;' + src, ctx);
  answers.push(false); await ctx.resetAllProgress();
  assert.equal(asks.length, 1); assert.deepEqual(plain(ctx.state), before, 'Annuler : rien ne bouge');
  answers.push(true, false); await ctx.resetAllProgress();
  assert.equal(asks.length, 3); assert.deepEqual(plain(ctx.state), before, '« Garder ma progression » : rien ne bouge');
  answers.push(true, true); await ctx.resetAllProgress();
  assert.deepEqual(asks[1], { ico: '🗑️', titre: 'Effacer toute ta progression ?', texte: 'Leçons, défis, cartes, notes, planning et points de salle seront vidés sur cet appareil, et tes scores retirés du classement. C’est définitif.', oui: 'Continuer', non: 'Annuler', danger: true });
  assert.deepEqual(asks[2], { ico: '🗑️', titre: 'Dernière confirmation', texte: 'Tout effacer maintenant ? Ton pseudo, lui, reste à toi.', oui: 'Tout effacer', non: 'Garder ma progression', danger: true });
  const st = plain(ctx.state);
  assert.deepEqual([st.lessons, st.defis, st.notes, st.plan], [{}, {}, [], null], 'tout est vidé');
  assert.deepEqual(st.salle, { cle: 'K'.repeat(32), pseudo: 'Léa', pseudoVu: 42 }, 'le pseudo et sa clé restent');
  assert.equal(st.name, 'Léa'); assert.equal(ctx.closed, 1);
  assert.deepEqual(rpc, [['jeu_oublier', { p_cle: 'K'.repeat(32) }]], 'les scores quittent le classement');
  /* La feuille de l’appli : celle d’« Effacer » est rouge (danger), le clavier la ferme (Échap) */
  const ask = fn('lqAsk');
  assert.ok(ask.includes("o.danger") || ask.includes('danger'), 'une variante « danger »');
});

test('points — la valeur du défi, palier par palier, à côté du chrono ; « +25 » tant que la première requête peut être la bonne', () => {
  /* Le barème a ses propres tests (salle-points-microinteractions, salle-defis : 17 h 39) ; ici, ce que montre la barre de jeu */
  assert.ok(app.includes('const val=mine||rate?\'\':`<b class="jeu-val" id="jeu-val" title="Ce que vaut le défi maintenant">${JEU_COIN_SVG}<span id="jeu-val-n">${jeuValeur(Math.max(0,took0),jeuNivManche(n))}</span><small>pts</small>${r.tries||jeuBonusPris(r)?\'\':`<i class="jeu-val-b" id="jeu-val-b" title="Si ta première requête est la bonne">+${JEU_PTS_ESSAI}</i>`}</b>`;'), 'le premier coup : +25 à tous les niveaux (8 novembre, 9 h 17)');
  const tick = fn('jeuTick');
  assert.ok(tick.includes("const vn=document.getElementById('jeu-val-n');if(vn){const v=String(jeuValeur(Math.max(0,took),jeuNivManche(n)));if(vn.textContent!==v){vn.textContent=v;"), 'le palier du niveau change avec le chrono (6 novembre, 15 h)');
  assert.ok(tick.includes("pv.classList.remove('is-drop');void pv.offsetWidth;pv.classList.add('is-drop');"), 'un petit saut quand il change');
  /* Dans le cadre de la manche depuis le 8 novembre, 17 h 48 ; 19 h 18 : le chrono est posé sur le bord du cadre, juste au-dessus d’elle */
  /* 20 h 15 : dans le même cadre que le chrono, « points | chrono » */
  assert.ok(app.includes('<span class="jeu-hud-box${val?\'\':\' is-seul\'}">${val}${chrono}</span></div>`;'), 'à côté du chrono, dans le même cadre');
  /* Le premier essai manqué : le « +25 » s’envole */
  const run = fn('jeuRun');
  assert.ok(run.includes('r.tries=(r.tries||0)+1;') && run.includes("jeuSend({t:'found',n,ms:took,p1:r.tries===1?1:0});"), 'chaque exécution est un essai ; le premier juste est annoncé à tous');
  assert.ok(run.includes("}catch(e){typeof edPied==='function'&&edPied('ed-lesson','err');setLessonOut('');jeuEssaiRate(r);coachRoomTick();coachKo(typeof defiErreurSql==='function'?defiErreurSql(e.message,sql):esc(e.message));return;}"), 'une erreur compte comme un essai, et se lit dans la carte, comme dans la boîte « Erreur SQL » (9 novembre, 8 h 04) (14 h 33 : les indices arrivent à la même minute pour tous)');
  const els = {}, ctx = vm.createContext({ prefersReduceMotion: () => false, setTimeout: f => { ctx.later = f; } });
  const b = { classList: { list: [], add(c) { this.list.push(c); } }, remove() { b.gone = true; } };
  ctx.document = { getElementById: id => (id === 'jeu-val-b' ? b : els[id] || null) };
  vm.runInContext(fn('jeuEssaiRate'), ctx);
  ctx.jeuEssaiRate({ tries: 2 }); assert.deepEqual(b.classList.list, [], 'déjà parti au premier essai');
  ctx.jeuEssaiRate({ tries: 1 }); assert.deepEqual(b.classList.list, ['is-out']); ctx.later(); assert.ok(b.gone);
  assert.ok(app.includes("if(m.p1===1)(r.first=r.first||{})[m.pid]=1;"), 'reçu : le premier essai de chacun, pour que tout le monde compte les mêmes points');
  /* Le détail des points et la carte « Trouvé » */
  const d = vm.createContext({ JEU_PTS_RANG: [50, 30, 20, 10] });
  vm.runInContext(line('jeuPtsDetail'), d);
  assert.equal(vm.runInContext('jeuPtsDetail({val:175,essai:25,rang:30,place:2})', d), '<span class="jeu-pd"><i>Défi 175</i><i class="is-essai">Du premier coup +25</i><i class="is-rang">2e +30</i></span>');
  assert.equal(vm.runInContext('jeuPtsDetail({val:100,essai:0,rang:10,place:4})', d), '<span class="jeu-pd"><i>Défi 100</i><i class="is-rang">4e +10</i></span>');
  assert.equal(vm.runInContext('jeuPtsDetail({val:150,essai:0,rang:0,place:1})', d), '<span class="jeu-pd"><i>Défi 150</i></span>', 'seul : la valeur du défi');
  assert.ok(fn('jeuFoundHTML').includes('x.essai?`du premier coup <span class="coach-ok-bonus">+${x.essai}'), 'le premier coup, dans l’encart vert « Bravo, défi résolu ! » (9 novembre, 8 h 20)');
  for (const part of ['html.lq .jeu-bar-r{flex:none;display:flex;align-items:center;gap:6px}', 'html.lq .jeu-val{display:inline-flex;', 'font-variant-numeric:tabular-nums'])
    assert.ok(s51.includes(part), part);
  assert.ok(s51.includes('html.lq .jeu-bar .l-kicker{display:block;flex:1 1 0%;min-width:0;'), 'la pastille de manche peut prendre l’espace restant');
  assert.ok(s51.includes('@media (max-width:760px){') && s51.includes('html.lq #scr-lesson .jeu-bar>.l-kicker{flex:1 1 100%;width:100%;white-space:normal;'), 'sur une vue étroite, le libellé complet passe au-dessus des points et du chrono');
  const s52 = css.slice(css.indexOf('/* ---------- 52.'));
  for (const part of ['html.lq .jeu-val-b{position:absolute;', '@keyframes jeuValBOut{', 'html.lq .jeu-val.is-drop #jeu-val-n{', 'html.lq .jeu-pd i.is-essai{'])
    assert.ok(s52.includes(part), part);
});

test('réf. 4 et 5 — la note de la salle garde sa première phrase ; « Un code reçu ? » respire, sans rappel du pseudo', () => {
  assert.ok(app.includes("const JEU_NOTE_HTML='<p class=\"jeu-note\">🔒 Les joueurs de ta salle voient ton pseudo, ton drapeau, tes temps et tes réactions. Tes requêtes sont vérifiées en ligne et restent privées.</p>';"));
  assert.ok(!app.includes('et s’effacent au bout de 24&nbsp;h. Il faut une connexion internet.</p>'));
  /* 3 novembre, 7 h 49 : le code reçu passe dans la carte de la salle, en mode « Rejoindre ». */
  /* 5 novembre, 10 h 16 : la feuille « J’ai un code » (defisFeuilleHTML) */
  const join = fn('defisFeuilleHTML');
  assert.ok(fn('defisFeuilleOuvrir').includes("jeuMode=k==='code'?'join'") && join.includes('<label class="jeu-lab" for="jeu-code">Code de la salle</label>') && join.includes('<p class="jeu-msg${ko?\' is-ko\':\'\'}" role="status" aria-live="polite">${ko?dxCodeMsgHTML(\'introuvable\'):\'\'}</p>'));
  assert.ok(!fn('renderDefisJoin').includes('jeu-code'), 'plus de carte « Un code reçu ? » à part');
  for (const part of ['html.lq .def-join-body{padding:2px 16px 18px!important;gap:10px!important}', 'html.lq .def-join-body>.jeu-msg:empty{display:none}',
    'html.lq:not(.pointer-nav) .def-join>summary:focus-visible{box-shadow:inset 0 0 0 2.5px rgba(106,77,244,.45)!important;'])
    assert.ok(s51.includes(part), part);
});

function perfHTML(salle) {
  const host = { innerHTML: '', get firstElementChild() { return null; } };
  const ctx = vm.createContext({
    document: { getElementById: id => (id === 'defis-perf' ? host : null) }, state: { salle },
    JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' }, lqStkSvg: k => `<svg data-k="${k}"></svg>`, perfReveal() {}, Date, Math, esc, escAttr,
    jeuInitial: n => String(n || '?').trim().charAt(0).toUpperCase(), JEU_FRIENDS_SVG: '', DEF_CHEV_SVG: '',
    clsTopHTML: () => '', clsFlush() {}, clsCharger() {},
  });
  vm.runInContext('const PERF_HIST_PAR=5;let perfHistPage=0;var JEU_HIST_MAX=500;if(typeof clsPts===\'undefined\')var clsPts=n=>(+n||0).toLocaleString(\'fr-FR\');' + ['jeuChrono', 'perfDay', 'perfWith', 'perfGame', 'perfBadge', 'perfColor', 'pseudoBr', 'perfPodiumHTML', 'perfMateHTML', 'perfCapHTML', 'perfTeintes', 'perfRecordHaut', 'perfHistLignesHTML', 'lqPagesNums', 'lqPagesHTML', 'lqPagesK', 'perfHistLigneHTML', 'perfHistPiedHTML', 'renderDefisPerf'].map(fn).join('') + ';renderDefisPerf();', ctx);
  return { h: host.innerHTML, ctx };
}

test('réf. 6 — « Tes dernières parties » : les parties à 2, 3, 4, 5 (et jusqu’à 8) ressortent, avec les points de chacun', () => {
  const now = Date.now();
  const ppl5 = [{ n: 'Léa', pts: 420, place: 1 }, { n: 'Elisa', pts: 380, place: 2, me: 1 }, { n: 'Tom', pts: 300, place: 3 }, { n: 'Ana <3', pts: 150, place: 4 }, { n: 'Zoé', pts: 0, place: 5 }];
  const salle = { pts: 1200, parties: 3, best: 380, manches: 7, trouves: 6, tms: 6e5, fast: 3e4, amis: 2, pl: [0, 1, 0], lv: { f: [7, 6] },
    hist: [
      { at: now - 6e4, pts: 380, n: 3, ok: 3, ms: 3e5, niv: 'm', solo: 0, place: 2, players: 5, ppl: ppl5 },
      { at: now - 864e5, pts: 250, n: 1, ok: 1, ms: 9e4, niv: 'f', solo: 1, place: 0, players: 1 },
      { at: now - 2 * 864e5, pts: 230, n: 3, ok: 2, ms: 2e5, niv: 'f', solo: 0, place: 1, players: 2, ppl: [{ n: 'Elisa', pts: 230, place: 1, me: 1 }, { n: 'Léa', pts: 180, place: 2 }] }] };
  const { h, ctx } = perfHTML(salle);
  const bars = [...h.matchAll(/<button type="button" class="perf-bar([^"]*)"[\s\S]*?<\/button>/g)];
  assert.equal(bars.length, 3);
  assert.deepEqual(bars.map(b => b[1]), [' is-vs', '', ' is-best is-on is-vs'], 'de la plus ancienne à la plus récente : les parties à plusieurs ressortent');
  const dots = b => [...b[0].matchAll(/<span class="perf-o" data-c="(\d)" style="--y:(\d+)%;--x:(-?\d+)px" aria-hidden="true"><\/span>/g)].map(m => [+m[1], +m[2], +m[3]]);
  assert.deepEqual(dots(bars[0]), [[vm.runInContext("perfColor('Léa')||1", ctx), Math.round(180 / 420 * 100), -2]], 'à deux : un point, celui de l’autre, à sa hauteur, de sa couleur');
  assert.deepEqual(dots(bars[2]).map(d => d[1]), [100, 71, 36, 4], 'à cinq : les quatre autres (0 point : au pied)');
  assert.deepEqual(dots(bars[2]).map(d => d[2]), [-2, 2, -5, 5], 'en zigzag autour du milieu de la barre');
  const c5 = dots(bars[2]).map(d => d[0]);
  assert.equal(new Set(c5).size, 4, 'quatre couleurs différentes : on sait quel point est à qui');
  assert.ok(!c5.includes(0), 'le violet reste à « Toi »');
  assert.ok(bars[2][0].includes('<b class="perf-n" aria-hidden="true">5</b>') && bars[0][0].includes('<b class="perf-n" aria-hidden="true">2</b>') && !bars[1][0].includes('perf-n'), 'le nombre de joueurs au pied de la barre');
  assert.ok(bars[2][0].includes('style="--h:90%;--i:2"'), 'la hauteur se compte sur le meilleur score de la partie, amis compris (380 / 420)');
  assert.ok(bars[2][0].includes('aria-label="Aujourd’hui, 380 points, à 5 joueurs"'));
  /* Dessous : la partie choisie, joueur par joueur, dans l’ordre du classement */
  const cap = h.match(/<p class="perf-cap" aria-live="polite">([\s\S]*?)<\/p>/)[1];
  assert.ok(cap.startsWith('<span class="perf-cap-t">Aujourd’hui · à 5 · Moyen</span><span class="perf-cap-ppl">'));
  const chips = [...cap.matchAll(/<span( class="is-me")?><i class="jeu-av" data-c="(\d)" aria-hidden="true">[^<]*<\/i>([^<]+)<b>(\d+)<\/b><\/span>/g)].map(m => [m[3], +m[4], !!m[1], +m[2]]);
  assert.deepEqual(chips.map(x => x.slice(0, 3)), [['Léa', 420, false], ['Toi', 380, true], ['Tom', 300, false], ['Ana &lt;3', 150, false], ['Zoé', 0, false]], 'les pseudos échappés, « Toi » pour soi');
  assert.equal(chips[1][3], 0, '« Toi » en violet');
  assert.deepEqual(chips.filter(x => !x[2]).map(x => x[3]), c5, 'chaque pastille a la couleur de son point');
  /* 18 h 19 : « pourquoi nombre de joueurs = 3 ? » : plus de chiffre d’exemple dans la légende */
  assert.ok(h.includes('<p class="perf-legend"><span><i class="perf-legend-o" aria-hidden="true"></i>les points de tes adversaires</span><span class="perf-legend-t">au pied de chaque barre : le nombre de joueurs</span></p>'), 'une légende, sans chiffre trompeur');
  assert.ok(!app.includes('perf-legend-n') && !css.includes('perf-legend-n'));
  assert.ok(bars[0][0].includes(`data-caph="${escAttr(vm.runInContext('perfCapHTML(state.salle.hist[2])', ctx))}"`), 'toucher une barre écrit sa partie');
  assert.equal(vm.runInContext('perfCapHTML(state.salle.hist[1])', ctx), 'Hier · En solo · Facile · 250 points');
  /* Elisa, 17 h 53 : « et à 6, 7, 8 joueurs dans l’historique ? » — les 7 autres, 7 couleurs différentes, serrés autour de la barre */
  const ppl8 = ['Léa', 'Tom', 'Ana', 'Zoé', 'Hugo', 'Inès', 'Paul'].map((n, i) => ({ n, pts: 400 - i * 50, place: i + 2 })).concat([{ n: 'Elisa', pts: 420, place: 1, me: 1 }]);
  const g8 = perfHTML({ ...salle, hist: [{ at: now, pts: 420, n: 3, ok: 3, ms: 1, niv: 'd', solo: 0, place: 1, players: 8, ppl: ppl8 }] });
  const b8 = [...g8.h.matchAll(/<button type="button" class="perf-bar([^"]*)"[\s\S]*?<\/button>/g)][0];
  const d8 = dots(b8);
  assert.equal(d8.length, 7, 'les 7 autres');
  assert.equal(new Set(d8.map(d => d[0])).size, 7, '7 couleurs différentes'); assert.ok(d8.every(d => d[0] >= 1 && d[0] <= 7));
  assert.ok(d8.every(d => Math.abs(d[2]) <= 11), 'dans la largeur de la barre : ' + d8.map(d => d[2]));
  assert.ok(b8[0].includes('<b class="perf-n" aria-hidden="true">8</b>'));
  const cap8 = g8.h.match(/<p class="perf-cap" aria-live="polite">([\s\S]*?)<\/p>/)[1];
  assert.ok(cap8.startsWith('<span class="perf-cap-t">Aujourd’hui · à 8 · Difficile</span>') && (cap8.match(/<i class="jeu-av"/g) || []).length === 8, 'les 8, joueur par joueur');
  /* Plus de joueurs que de pseudos gardés : le nombre dit vrai */
  const g9 = perfHTML({ ...salle, hist: [{ at: now, pts: 420, n: 3, ok: 3, ms: 1, niv: 'd', solo: 0, place: 1, players: 9, ppl: ppl8 }] });
  assert.ok(g9.h.includes('<b class="perf-n" aria-hidden="true">9</b>'));
  /* Que des parties seul : rien de plus */
  const solo = perfHTML({ ...salle, hist: [salle.hist[1]] }).h;
  assert.ok(!solo.includes('is-vs') && !solo.includes('perf-legend') && !solo.includes('perf-o'));
  for (const part of ['html.lq .perf-bar.is-vs i{', 'html.lq .perf-o{position:absolute;left:50%;bottom:var(--y);', 'html.lq .perf-card.is-in .perf-o{opacity:1;transform:translateX(var(--x,0px)) scale(1)}',
    'html.lq .perf-n{position:absolute;', 'html.lq .perf-cap-ppl>span.is-me{', 'html.lq .perf-legend{'])
    assert.ok(s51.includes(part), part);
  assert.ok(css.includes('html.lq .perf-o[data-c="7"],html.lq .perf-cap-ppl .jeu-av[data-c="7"]{'), 'deux couleurs de plus');
  /* Six joueurs par salle au plus (8 novembre, 22 h 27 ; cinq avant) */
  assert.ok(app.includes('const JEU_MAX=6;'));
  assert.ok(app.includes('max:Math.max(1,Math.min(JEU_MAX,+m.max||JEU_MAX))'), 'une salle annoncée plus grande est ramenée à 6');
});

test('Supabase — le pseudo unique (jeu_pseudo), sans ménage : il reste à la personne tant qu’elle ne le supprime pas', () => {
  assert.ok(files.includes('20261031160846_pseudos_uniques.sql') && files.includes('20261031170407_pseudo_sans_menage.sql'), 'les migrations appliquées le 31 octobre');
  const m = fs.readFileSync(new URL('20261031160846_pseudos_uniques.sql', dir), 'utf8');
  assert.match(m, /create table public\.jeu_pseudo \(\n  cle text primary key,[^\n]*\n  pseudo text not null,\n  norme text not null unique,/);
  assert.match(m, /alter table public\.jeu_pseudo enable row level security;\nrevoke all on table public\.jeu_pseudo from anon, authenticated;/);
  assert.ok(!/create policy/i.test(m), 'rien n’est lisible directement');
  assert.match(m, /translate\(lower\(btrim\(coalesce\(p, ''\)\)\), 'àâäáãåāçćčéèêëēęíìîïīñńóòôöõøōúùûüūýÿœæß', 'aaaaaaaccceeeeeeiiiiinnooooooouuuuuyyoas'\)/);
  assert.equal(Array.from('àâäáãåāçćčéèêëēęíìîïīñńóòôöõøōúùûüūýÿœæß').length, Array.from('aaaaaaaccceeeeeeiiiiinnooooooouuuuuyyoas').length, 'autant de lettres de chaque côté');
  assert.match(m, /if v_deja is not null then\n    update public\.jeu_pseudo set vu = now\(\) where cle = v_cle and vu < now\(\) - interval '1 hour';\n    return jsonb_build_object\('ok', true, 'pseudo', v_deja\);/, 'un appareil, un pseudo : il ne se change plus');
  for (const f of ['jeu_pseudo_libre(text, text)', 'jeu_pseudo_prendre(text, text)'])
    assert.ok(m.includes(`grant execute on function public.${f} to anon, authenticated;`), f);
  for (const f of ['jeu_pseudo_norme(text)', 'jeu_pseudo_idees(text)'])
    assert.ok(m.includes(`revoke all on function public.${f} from public, anon, authenticated;`) && !m.includes(`grant execute on function public.${f}`), f);
  /* 17 h 53 : « il n’y aura pas de suppression de pseudo si la personne a encore son compte » */
  const s = fs.readFileSync(new URL('20261031170407_pseudo_sans_menage.sql', dir), 'utf8');
  assert.ok(s.includes("select cron.unschedule('jeu-pseudo-menage');\ndrop function if exists public.jeu_pseudo_menage();"), 'plus de ménage des pseudos');
  assert.match(s, /create or replace function public\.jeu_pseudo_liberer\(p_cle text\)[\s\S]*delete from public\.jeu_joueur where cle = v_cle;\n  delete from public\.jeu_pseudo where cle = v_cle;/);
  assert.ok(s.includes('grant execute on function public.jeu_pseudo_liberer(text) to anon, authenticated;'));
  /* Les règles du site et de l’appli disent la même chose */
  const conf = fs.readFileSync(new URL('../decouvrir/confidentialite.html', import.meta.url), 'utf8');
  assert.ok(conf.includes('Ton pseudo ne se change plus ensuite, et il reste à toi&nbsp;; «&nbsp;Supprimer mon compte&nbsp;» le libère avec tes scores') && !conf.includes('12&nbsp;mois sans ouvrir'), 'politique de confidentialité');
  const ios = fs.readFileSync(new URL('../IOS.md', import.meta.url), 'utf8');
  assert.ok(ios.includes('n’est jamais\n  libéré tout seul (pas de ménage)') && ios.includes("delete from jeu_pseudo where pseudo = '") && !ios.includes('jeu-pseudo-menage'), 'IOS.md');
  assert.equal(app.split('et reste à toi&nbsp;: «&nbsp;Supprimer mon compte&nbsp;», dans Mon compte, le libère avec tes scores. Ton prénom, lui, reste sur cet appareil.').length - 1, 2, 'les deux textes « Confidentialité » de l’appli');
  assert.ok(!app.includes('libéré après 12&nbsp;mois'));
});
