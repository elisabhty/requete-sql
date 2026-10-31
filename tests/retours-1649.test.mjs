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

/* ---------- Un faux DOM : des éléments par identifiant, la feuille ajoutée au corps de page ---------- */
function mkEl(id) {
  const cls = new Set();
  return {
    id, value: '', disabled: false, innerHTML: '', textContent: '', offsetWidth: 0, removed: false,
    classList: {
      add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)), contains: c => cls.has(c),
      toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; if (on) cls.add(c); else cls.delete(c); return on; },
    },
    get className() { return [...cls].join(' '); },
    set className(v) { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(x => cls.add(x)); },
  };
}
const psBlock = cut('/* ---------- Pseudo unique ----------', 'function renderDefisPerf(){');

function pseudoCtx({ reply = () => ({ ok: true }), salle, name = '', onboarded = true, online = true } = {}) {
  const els = {}, listeners = [], calls = [], buzzes = [], said = [], store = {}, gotos = [], timers = [];
  let sheet = null, tid = 0;
  const get = id => (els[id] ||= mkEl(id));
  const document = {
    getElementById: id => (id === 'lq-ask' ? sheet : get(id)),
    querySelector: sel => (sel === '.acc-pseudo em' ? get('acc-pseudo-em') : null),
    createElement: () => {
      const el = mkEl(''), q = {};
      el.querySelector = sel => (sel.startsWith('#') ? get(sel.slice(1)) : (q[sel] ||= mkEl(sel)));
      el.remove = () => { el.removed = true; if (sheet === el) sheet = null; };
      return el;
    },
    body: { appendChild: el => { if (el.id === 'lq-ask') sheet = el; } },
    addEventListener: (t, f, c) => listeners.push({ t, f, c }),
    removeEventListener: (t, f) => { const i = listeners.findIndex(l => l.f === f); if (i >= 0) listeners.splice(i, 1); },
    activeElement: null,
  };
  const ctx = vm.createContext({
    state: { name, onboarded, ...(salle ? { salle: JSON.parse(JSON.stringify(salle)) } : {}) },
    document, navigator: { onLine: online }, Date, Math, JSON,
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
    setTimeout: (f, ms) => { const id = ++tid; timers.push({ id, f, ms }); return id; },
    clearTimeout: id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
    requestAnimationFrame: f => f(),
    esc, escAttr, prefersReduceMotion: () => false, buzz: k => buzzes.push(k),
    lqStkSvg: k => `<svg data-k="${k}"></svg>`, LQ_X_SVG: '<svg data-k="x"></svg>', lqSay: t => said.push(t),
    clsCle: () => 'K'.repeat(32), clsSalle: () => (ctx.state.salle ||= {}),
    clsRpc: (f, body) => { calls.push({ fn: f, body: plain(body) }); const r = reply(f, body); return r instanceof Error ? Promise.reject(r) : Promise.resolve(r); },
    renderGreeting() { ctx.greet = (ctx.greet || 0) + 1; }, renderLearnAvatar() {},
    OB_SLIDES: ['welcome', 'name', 'goal'], obStep: 1, draft: { name: '' }, obNamePreview() {}, obGoto: s => gotos.push(s),
    activeTab: 'learn', saves: 0,
  });
  ctx.save = () => { ctx.saves++; };
  vm.runInContext(line('jeuNom') + line('jeuSavedNom') + psBlock + fn('obInput') + fn('obPseudoSuivant'), ctx);
  const run = () => { while (timers.length) timers.shift().f(); };
  return { ctx, ev: c => vm.runInContext(c, ctx), el: get, calls, buzzes, said, store, gotos, timers, run, listeners, sheet: () => sheet };
}

test('pseudo — vérifié en direct : « déjà pris », le champ tremble, trois pseudos libres arrivent ; en toucher un le met dans le champ', async () => {
  const p = pseudoCtx({ reply: (f, b) => (f === 'jeu_pseudo_libre' ? (b.p_pseudo === 'Léa' ? { ok: false, raison: 'pris', idees: ['Léa_sql', 'Léa.db', 'Léa42'] } : { ok: true }) : { ok: true }) });
  const etat = p.el('ob-ps-etat'), idees = p.el('ob-ps-idees'), inp = p.el('ob-pseudo'), next = p.el('ob-next');
  p.ev("obInput('name','  Léa ')");
  assert.equal(etat.className, 'ps-etat is-verif');
  assert.match(etat.innerHTML, /^<i class="ps-dots" aria-hidden="true"><b><\/b><b><\/b><b><\/b><\/i>Vérification…$/);
  assert.equal(p.calls.length, 0, 'on attend la fin de la frappe');
  p.run(); await flush();
  assert.deepEqual(p.calls, [{ fn: 'jeu_pseudo_libre', body: { p_pseudo: 'Léa', p_cle: 'K'.repeat(32) } }], 'le pseudo nettoyé, avec la clé de l’appareil (le sien compte comme libre)');
  assert.equal(etat.className, 'ps-etat is-pris');
  assert.equal(etat.innerHTML, '<i class="ps-no" aria-hidden="true">!</i>« Léa » est déjà pris. Prends-en un libre :');
  assert.equal(idees.innerHTML, ['Léa_sql', 'Léa.db', 'Léa42'].map((v, i) => `<button type="button" class="ps-idee" style="--i:${i}" data-v="${v}" onclick="psIdee('ob',this.dataset.v)">${v}</button>`).join(''), 'trois pastilles, l’une après l’autre (--i)');
  assert.ok(inp.classList.contains('is-ko') && inp.classList.contains('is-shake') && !inp.classList.contains('is-ok'), 'le champ tremble');
  assert.ok(p.buzzes.includes('warning'));
  assert.equal(next.disabled, true, '« Continuer » attend un pseudo libre');
  /* Toucher une pastille : elle va dans le champ, qui pulse, et la vérification repart */
  p.ev("psIdee('ob','Léa.db')");
  assert.equal(inp.value, 'Léa.db'); assert.equal(p.ctx.draft.name, 'Léa.db');
  assert.ok(inp.classList.contains('is-pick') && p.buzzes.includes('selection'));
  assert.equal(etat.className, 'ps-etat is-verif');
  p.run(); await flush();
  assert.equal(etat.className, 'ps-etat is-libre');
  assert.equal(etat.innerHTML, '<i class="ps-ok" aria-hidden="true">✓</i>Disponible : il sera à toi');
  assert.equal(idees.innerHTML, '', 'les pastilles s’en vont');
  assert.ok(inp.classList.contains('is-ok') && !inp.classList.contains('is-ko'));
  assert.equal(next.disabled, false);
  /* Une réponse en retard (frappe suivante déjà partie) est ignorée */
  const q = pseudoCtx({ reply: (f, b) => (b.p_pseudo === 'Tom' ? { ok: false, raison: 'pris', idees: [] } : { ok: true }) });
  q.ev("psVerif('ob','T');psVerif('ob','To')"); assert.equal(q.timers.length, 1, 'une seule vérification par pause de frappe');
  q.ev("psVerif('ob','Tom')"); q.run();
  q.ev("psVerif('ob','Tomy')"); await flush();
  assert.equal(q.el('ob-ps-etat').className, 'ps-etat is-verif', 'la réponse pour « Tom » arrive trop tard : rien ne bouge');
  q.run(); await flush();
  assert.deepEqual(q.calls.map(c => c.body.p_pseudo), ['Tom', 'Tomy']);
  assert.equal(q.el('ob-ps-etat').className, 'ps-etat is-libre');
  /* Les autres réponses du serveur */
  const r = pseudoCtx({ reply: () => ({ ok: false, raison: 'refuse', idees: ['Joueur_sql'] }) });
  r.ev("psVerif('ob','Connard')"); r.run(); await flush();
  assert.equal(r.el('ob-ps-etat').innerHTML, '<i class="ps-no" aria-hidden="true">!</i>Ce pseudo n’est pas accepté. Prends-en un libre :');
  const off = pseudoCtx({ reply: () => new TypeError('Failed to fetch') });
  off.ev("psVerif('ob','Zoé')"); off.run(); await flush();
  assert.equal(off.el('ob-ps-etat').innerHTML, 'Pas de réseau : il sera vérifié dès ton retour en ligne.');
  assert.equal(off.el('ob-next').disabled, false, 'hors ligne : on peut continuer');
});

test('pseudo — « Continuer » le réserve pour l’appareil ; ensuite il ne bouge plus', async () => {
  const p = pseudoCtx({ reply: (f, b) => (f === 'jeu_pseudo_prendre' ? { ok: true, pseudo: b.p_pseudo } : { ok: true }) });
  const next = p.el('ob-next');
  p.ev("draft.name='Léa.db';PS.etat.ob='libre';obPseudoSuivant()");
  assert.ok(next.classList.contains('is-busy') && next.disabled, 'le bouton attend la réponse');
  await flush();
  assert.deepEqual(p.calls, [{ fn: 'jeu_pseudo_prendre', body: { p_cle: 'K'.repeat(32), p_pseudo: 'Léa.db' } }]);
  assert.equal(p.ctx.state.salle.pseudo, 'Léa.db'); assert.ok(p.ctx.state.salle.pseudoVu > 0);
  assert.equal(p.ctx.state.name, 'Léa.db'); assert.equal(p.store['rq-jeu-nom'], 'Léa.db');
  assert.ok(p.ctx.saves >= 1 && p.ctx.greet === 1, 'enregistré, l’accueil à jour');
  assert.deepEqual(p.gotos, ['goal']); assert.ok(p.buzzes.includes('success')); assert.ok(!next.classList.contains('is-busy'));
  /* Réservé : le champ ne change plus rien, il dit « C’est ton pseudo » sans rien demander au serveur */
  p.ev("obInput('name','Autre')");
  assert.equal(p.ctx.draft.name, 'Léa.db');
  p.ev("psVerif('ob','Léa.db')");
  assert.equal(p.el('ob-ps-etat').innerHTML, '<i class="ps-ok" aria-hidden="true">✓</i>C’est ton pseudo');
  p.ev('obPseudoSuivant()');
  assert.equal(p.calls.length, 1); assert.deepEqual(p.gotos, ['goal', 'goal']);
  /* Pris entre-temps : on reste, avec des pseudos libres */
  const q = pseudoCtx({ reply: f => (f === 'jeu_pseudo_prendre' ? { ok: false, raison: 'pris', idees: ['Tom_sql'] } : { ok: true }) });
  q.ev("draft.name='Tom';PS.etat.ob='libre';obPseudoSuivant()"); await flush();
  assert.deepEqual(q.gotos, []); assert.equal(q.el('ob-ps-etat').className, 'ps-etat is-pris');
  assert.match(q.el('ob-ps-idees').innerHTML, /data-v="Tom_sql"/); assert.equal(q.el('ob-next').disabled, true);
  assert.equal(q.ctx.state.salle, undefined, 'rien n’est réservé');
  q.ev("PS.etat.ob='pris';obPseudoSuivant()");
  assert.equal(q.calls.length, 1, 'un pseudo pris ne repart pas');
  /* Sans réseau : on continue, il sera réservé à l’ouverture suivante */
  const off = pseudoCtx({ reply: () => new TypeError('Failed to fetch') });
  off.ev("draft.name='Zoé';PS.etat.ob='horsligne';obPseudoSuivant()"); await flush();
  assert.deepEqual(off.gotos, ['goal']); assert.equal(off.ctx.state.salle, undefined);
});

test('pseudo — une salle entre amis a besoin du pseudo réservé ; à l’ouverture de l’appli, un pseudo d’avant est réservé', async () => {
  const opened = [];
  const mk = o => { const c = pseudoCtx(o); c.ctx.psFeuille = x => opened.push(plain(x)); c.ctx.ran = 0; c.ctx.go = () => { c.ctx.ran++; }; return c; };
  const a = mk();
  a.ev('jeuAvecPseudo(go)');
  assert.deepEqual(opened.splice(0), [{}], 'pas de pseudo : la feuille');
  assert.equal(a.ctx.ran, 0); assert.equal(a.ev('PS.apres===go'), true, 'la salle s’ouvrira une fois le pseudo choisi');
  const b = mk({ salle: { pseudo: 'Léa' } });
  b.ev('jeuAvecPseudo(go)');
  assert.equal(b.ctx.ran, 1); assert.equal(b.calls.length, 0, 'déjà réservé : tout de suite');
  const c = mk({ name: 'Zoé', reply: (f, x) => ({ ok: true, pseudo: x.p_pseudo }) });
  c.ev('jeuAvecPseudo(go)'); await flush();
  assert.equal(c.ctx.ran, 1); assert.equal(c.ctx.state.salle.pseudo, 'Zoé');
  const d = mk({ name: 'Zoé', reply: () => ({ ok: false, raison: 'pris', idees: ['Zoé_sql'] }) });
  d.ev('jeuAvecPseudo(go)'); await flush();
  assert.deepEqual(opened.splice(0), [{ raison: 'pris', idees: ['Zoé_sql'], voulu: 'Zoé' }]); assert.equal(d.ctx.ran, 0);
  const e = mk({ name: 'Zoé', reply: () => new TypeError('Failed to fetch') });
  e.ev('jeuAvecPseudo(go)'); await flush();
  assert.equal(e.ctx.ran, 1, 'sans réseau, la salle le dira');
  /* Le pseudo réservé fait foi (même si un autre traîne, après un import) */
  const f = mk({ name: 'Zoé', salle: { pseudo: 'Léa' } });
  f.store['rq-jeu-nom'] = 'Zoé';
  assert.equal(f.ev('jeuSavedNom()'), 'Léa');
  /* À l’ouverture */
  for (const o of [{ name: 'Zoé', onboarded: false }, { name: 'Zoé', online: false }, { salle: { pseudo: 'Léa', pseudoVu: Date.now() - 3600e3 } }, {}]) {
    const v = mk(o); v.ev('psVerifier()'); await flush();
    assert.equal(v.calls.length, 0, JSON.stringify(o));
  }
  const old = mk({ salle: { pseudo: 'Léa', pseudoVu: Date.now() - 21 * 3600e3 }, reply: () => ({ ok: true, pseudo: 'Léa' }) });
  old.ev('psVerifier()'); await flush();
  assert.deepEqual(old.calls.map(x => x.body.p_pseudo), ['Léa'], 'une fois par jour, la visite est notée (le pseudo n’est libéré qu’après 12 mois sans visite)');
  assert.equal(old.el('acc-pseudo-em').textContent, 'Unique dans l’appli · il ne se change pas', 'Mon compte suit');
  const taken = mk({ name: 'Zoé', reply: () => ({ ok: false, raison: 'pris', idees: ['Zoé.db'] }) });
  taken.ev('psVerifier()'); await flush();
  assert.deepEqual(opened.splice(0), [{ raison: 'pris', idees: ['Zoé.db'], voulu: 'Zoé' }], 'déjà pris par quelqu’un d’autre : la feuille');
  const boot = cut('async function boot(){', 'function initSpotlight(){');
  assert.ok(boot.includes("setTimeout(()=>{try{psVerifier();}catch(e){}},2500);") && boot.includes("window.addEventListener('online',()=>{try{psVerifier();}catch(e){}});"), 'au démarrage, et au retour du réseau');
  /* Une partie envoyée avec un pseudo déjà pris (ancienne version) : la feuille */
  assert.ok(fn('clsFlush').includes("if(/pris/.test(m)){if(typeof psFeuille==='function'&&!document.getElementById('lq-ask'))psFeuille({raison:'pris',voulu:nom});return;}"));
  for (const f of ['jeuEnterRoom', 'jeuJoin']) assert.ok(fn(f).includes('jeuPseudoPuis(()=>jeuStart('), f);
  assert.ok(app.includes(`onclick="jeuPseudoPuis(()=>jeuStart(jeuRand(6),true,'\${c.id}',{nomId:'jeu-nom-defi'}))"`), 'la page d’un défi aussi');
});

test('pseudo — la feuille « Choisis ton pseudo », dans la DA des autres feuilles : idées, réservation, « Plus tard », Échap', async () => {
  const f = pseudoCtx({ reply: (x, b) => (x === 'jeu_pseudo_prendre' ? { ok: true, pseudo: b.p_pseudo } : { ok: true }) });
  f.ctx.after = () => { f.ctx.done = (f.ctx.done || 0) + 1; };
  f.ev("PS.apres=after;psFeuille({raison:'pris',voulu:'Léa',idees:['Léa_sql','Léa42']})");
  const sheet = f.sheet();
  assert.equal(sheet.className, 'lq-ask has-field ps-sheet on');
  const h = sheet.innerHTML;
  assert.ok(h.includes('<div class="lq-ask-sheet" role="dialog" aria-modal="true" aria-labelledby="lq-ask-t" aria-describedby="lq-ask-p">'));
  assert.ok(h.includes('<span class="lq-ask-stk" aria-hidden="true"><svg data-k="user"></svg></span><div class="lq-ask-cap-t"><h2 id="lq-ask-t">Choisis ton pseudo</h2>'));
  assert.ok(h.includes('<p id="lq-ask-p">« Léa » est déjà pris : un pseudo est unique dans toute l’appli. Choisis le tien, il ne se changera plus.</p>'));
  assert.ok(h.includes('<input id="ps-pseudo" type="text" maxlength="16" placeholder="Ex. Léa" value=""'), 'le champ vide, prêt pour un autre');
  assert.ok(h.includes('id="ps-ok">C’est mon pseudo</button><button type="button" class="lq-btn-2 lq-ask-non">Plus tard</button>'));
  assert.equal(f.el('ps-ps-etat').className, 'ps-etat is-pris');
  assert.match(f.el('ps-ps-idees').innerHTML, /data-v="Léa_sql" onclick="psIdee\('ps',this\.dataset\.v\)">Léa_sql<\/button>/);
  assert.equal(f.el('ps-ok').disabled, true);
  f.el('ps-pseudo').value = 'Léa'; f.ev('psValider()');
  assert.equal(f.calls.length, 0, 'un pseudo pris ne part pas');
  f.ev("psIdee('ps','Léa42')");
  assert.equal(f.el('ps-pseudo').value, 'Léa42');
  f.run(); await flush();
  assert.equal(f.el('ps-ps-etat').className, 'ps-etat is-libre'); assert.equal(f.el('ps-ok').disabled, false);
  f.ev('psValider()');
  assert.ok(f.el('ps-ok').classList.contains('is-busy'));
  await flush();
  assert.deepEqual(f.calls.at(-1), { fn: 'jeu_pseudo_prendre', body: { p_cle: 'K'.repeat(32), p_pseudo: 'Léa42' } });
  assert.equal(f.ctx.state.salle.pseudo, 'Léa42');
  assert.deepEqual(f.said, ['Pseudo réservé : Léa42'], 'le lecteur d’écran l’entend');
  assert.equal(f.ctx.done, 1, 'la salle qui attendait s’ouvre');
  assert.ok(sheet.classList.contains('off')); f.run();
  assert.equal(f.sheet(), null, 'la feuille s’en va'); assert.equal(f.ev('PS.apres'), null);
  /* Échap ferme, sans rien réserver ; l’écouteur s’en va avec la feuille */
  const g = pseudoCtx({ name: 'Zoé' });
  g.ev('psFeuille({})');
  assert.ok(g.sheet().innerHTML.includes('Il est unique dans toute l’appli : c’est ton nom dans les salles de défi et au classement. Il ne se changera plus.'));
  assert.ok(g.sheet().innerHTML.includes('value="Zoé"'), 'le pseudo d’avant, proposé');
  const key = g.listeners.find(l => l.t === 'keydown');
  assert.equal(key.c, true, 'en capture');
  key.f({ key: 'Escape', preventDefault() {}, stopPropagation() {} }); g.run();
  assert.equal(g.sheet(), null); assert.equal(g.listeners.length, 0);
  assert.equal(g.ctx.state.salle, undefined);
  /* Les micro-animations, et le mouvement réduit */
  for (const part of ['.ps-idee{min-height:40px;', 'animation:psIdee .45s var(--pop,ease) backwards;animation-delay:calc(.08s + var(--i,0) * .09s)',
    '@keyframes psIdee{from{opacity:0;transform:translateY(12px) scale(.8) rotate(-4deg)}to{opacity:1;transform:none}}',
    '.is-shake{animation:psShake .42s', '@keyframes psPop{', '.ps-dots b{', '@keyframes psDot{',
    '@media (prefers-reduced-motion:reduce){.ps-ok,.ps-no,.ps-dots b,.ps-idee,.is-shake,.is-pick'])
    assert.ok(s51.includes(part), part);
});

test('pseudo — l’onboarding le demande et le réserve ; Mon compte et la salle le montrent, verrouillé', () => {
  const ob = cut("}else if(slide==='name'){", "}else if(slide==='goal'){");
  assert.ok(ob.includes('<input id="ob-pseudo" type="text" maxlength="16"') && ob.includes(`\${mien?' readonly aria-readonly="true"':''}`), 'déjà réservé : en lecture seule');
  assert.ok(ob.includes('<p class="ps-etat${mien?\' is-mien\':\'\'}" id="ob-ps-etat" role="status" aria-live="polite">${mien?PS_TXT.mien():\'\'}</p>') && ob.includes('<div class="ps-idees" id="ob-ps-idees"></div>'));
  assert.ok(ob.includes(`\${mien?\`<i class="ob-field-lock" aria-hidden="true">\${PS_LOCK_SVG}</i>\`:''}`));
  assert.ok(ob.includes('Il est unique, et ne se changera plus.'));
  assert.ok(ob.includes("if(!mien&&jeuNom(draft.name))setTimeout(()=>{if(OB_SLIDES[obStep]==='name')psVerif('ob',draft.name);},0);"), 'un pseudo déjà tapé est vérifié en revenant');
  /* Mon compte */
  const ctx = vm.createContext({ PS_LOCK_SVG: '<svg data-k="lock"></svg>', ACCT_CHEV: '<svg data-k="chev"></svg>', esc, mien: '' });
  vm.runInContext(line('jeuNom') + line('jeuInitial') + fn('accPseudoHTML') + 'function psMien(){return mien;}', ctx);
  ctx.mien = 'Léa';
  assert.equal(vm.runInContext("accPseudoHTML('Léa')", ctx), '<div class="acc-pseudo"><span class="acc-pseudo-av" aria-hidden="true">L</span><span class="acc-pseudo-t"><small>Pseudo</small><b>Léa</b><em>Unique dans l’appli · il ne se change pas</em></span><span class="acc-pseudo-lock" aria-hidden="true"><svg data-k="lock"></svg></span></div>');
  ctx.mien = '';
  assert.ok(vm.runInContext("accPseudoHTML('Léa')", ctx).includes('<em>Il sera réservé dès que tu seras en ligne</em>'));
  assert.equal(vm.runInContext("accPseudoHTML('')", ctx), '<button type="button" class="acc-pseudo is-vide" onclick="closePlusDetails();psFeuille({})"><span class="acc-pseudo-av" aria-hidden="true">?</span><span class="acc-pseudo-t"><small>Pseudo</small><b>Choisis ton pseudo</b></span><svg data-k="chev"></svg></button>');
  assert.ok(app.includes('        ${accPseudoHTML(jeuSavedNom())}'), 'le pseudo réservé, celui des salles');
  for (const gone of ['id="acc-name"', 'class="acc-save"', 'function saveAccountName(', 'function clsRenommer(', 'function jeuNomEdit('])
    assert.ok(!app.includes(gone), 'retiré : ' + gone);
  for (const part of ['html.lq .acc-pseudo{display:flex;', 'html.lq .jeu-me-lock{', 'html.lq .jeu-me.is-vide{', 'html.lq #onboarding .ob-field.is-locked input{'])
    assert.ok(s51.includes(part), part);
  assert.ok(!/is-vide\{[^}]*dashed/.test(s51), 'pas de pointillés');
  /* La progression garde le pseudo réservé, même effacée */
  const ns = cut('function normalizeState(raw){', 'function normalize(');
  assert.ok(ns.includes("if(typeof salleSrc.pseudo==='string'){const p=salleNom(salleSrc.pseudo);if(p)salle.pseudo=p;}") && ns.includes('if(salleSrc.pseudoVu)salle.pseudoVu=salleBig(salleSrc.pseudoVu);'));
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
  assert.deepEqual(asks[1], { ico: '🗑️', titre: 'Effacer toute ta progression ?', texte: 'Leçons, défis, cartes, notes, planning et points de salle seront vidés sur cet appareil, et tes scores retirés du classement. C’est définitif, sauf si tu as exporté ta progression avant.', oui: 'Continuer', non: 'Annuler', danger: true });
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
  assert.ok(app.includes('const val=mine?\'\':`<b class="jeu-val" id="jeu-val" title="Ce que vaut le défi maintenant">${JEU_COIN_SVG}<span id="jeu-val-n">${jeuValeur(Math.max(0,took0))}</span><small>pts</small>${r.tries?\'\':`<i class="jeu-val-b" id="jeu-val-b" title="Si ta première requête est la bonne">+${JEU_PTS_ESSAI}</i>`}</b>`;'));
  const tick = fn('jeuTick');
  assert.ok(tick.includes("const vn=document.getElementById('jeu-val-n');if(vn){const v=String(jeuValeur(Math.max(0,took)));if(vn.textContent!==v){vn.textContent=v;"), 'le palier change avec le chrono');
  assert.ok(tick.includes("pv.classList.remove('is-drop');void pv.offsetWidth;pv.classList.add('is-drop');"), 'un petit saut quand il change');
  assert.ok(app.includes('<span class="jeu-bar-r">${val}<b class="jeu-timer'), 'à côté du chrono');
  /* Le premier essai manqué : le « +25 » s’envole */
  const run = fn('jeuRun');
  assert.ok(run.includes('r.tries=(r.tries||0)+1;') && run.includes("jeuSend({t:'found',n,ms:took,p1:r.tries===1?1:0});"), 'chaque exécution est un essai ; le premier juste est annoncé à tous');
  assert.ok(run.includes('}catch(e){setLessonOut(errBox(e.message));jeuEssaiRate(r);return;}'), 'une erreur compte comme un essai');
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
  assert.equal(vm.runInContext('jeuPtsDetail({val:175,essai:25,rang:30,place:2})', d), '<span class="jeu-pd"><i>Défi 175</i><i class="is-essai">1er essai +25</i><i class="is-rang">2e +30</i></span>');
  assert.equal(vm.runInContext('jeuPtsDetail({val:100,essai:0,rang:10,place:4})', d), '<span class="jeu-pd"><i>Défi 100</i><i class="is-rang">4e +10</i></span>');
  assert.equal(vm.runInContext('jeuPtsDetail({val:150,essai:0,rang:0,place:1})', d), '<span class="jeu-pd"><i>Défi 150</i></span>', 'seul : la valeur du défi');
  assert.ok(fn('jeuFoundHTML').includes("+(x.essai?' · du premier coup ✨':'')"));
  for (const part of ['html.lq .jeu-bar-r{flex:none;display:flex;align-items:center;gap:6px}', 'html.lq .jeu-val{display:inline-flex;', 'font-variant-numeric:tabular-nums'])
    assert.ok(s51.includes(part), part);
  const s52 = css.slice(css.indexOf('/* ---------- 52.'));
  for (const part of ['html.lq .jeu-val-b{position:absolute;', '@keyframes jeuValBOut{', 'html.lq .jeu-val.is-drop #jeu-val-n{', 'html.lq .jeu-pd i.is-essai{'])
    assert.ok(s52.includes(part), part);
});

test('réf. 4 et 5 — la note de la salle garde sa première phrase ; « Un code reçu ? » respire, sans rappel du pseudo', () => {
  assert.ok(app.includes("const JEU_NOTE_HTML='<p class=\"jeu-note\">🔒 Seuls ton pseudo, tes temps et tes réactions sont partagés, jamais tes requêtes.</p>';"));
  assert.ok(!app.includes('et s’effacent au bout de 24&nbsp;h. Il faut une connexion internet.</p>'));
  const join = fn('renderDefisJoin');
  assert.ok(!join.includes('jeuNomField'), 'le pseudo n’y est plus rappelé');
  assert.ok(join.includes('<label class="jeu-lab" for="jeu-code">Code de la salle</label>') && join.includes('<p class="jeu-msg" role="status" aria-live="polite"></p>'));
  for (const part of ['html.lq .def-join-body{padding:2px 16px 18px!important;gap:10px!important}', 'html.lq .def-join-body>.jeu-msg:empty{display:none}',
    'html.lq .def-join>summary:focus-visible{box-shadow:inset 0 0 0 2.5px rgba(106,77,244,.45)!important;'])
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
  vm.runInContext(['jeuChrono', 'perfDay', 'perfWith', 'perfGame', 'perfBadge', 'perfColor', 'perfPodiumHTML', 'perfMateHTML', 'perfCapHTML', 'perfTeintes', 'renderDefisPerf'].map(fn).join('') + ';renderDefisPerf();', ctx);
  return { h: host.innerHTML, ctx };
}

test('réf. 6 — « Tes dernières parties » : les parties à 2, 3, 4, 5 ressortent, avec les points de chacun', () => {
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
  const dots = b => [...b[0].matchAll(/<span class="perf-o" data-c="(\d)" style="--y:(\d+)%;--k:(\d)" aria-hidden="true"><\/span>/g)].map(m => [+m[1], +m[2], +m[3]]);
  assert.deepEqual(dots(bars[0]), [[vm.runInContext("perfColor('Léa')||1", ctx), Math.round(180 / 420 * 100), 0]], 'à deux : un point, celui de l’autre, à sa hauteur, de sa couleur');
  assert.deepEqual(dots(bars[2]).map(d => d[1]), [100, 71, 36, 4], 'à cinq : les quatre autres (0 point : au pied)');
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
  const ord = ['Léa', 'Tom', 'Ana <3', 'Zoé'], byName = Object.fromEntries(ord.map((n, i) => [n, c5[i]]));
  assert.deepEqual(chips.filter(x => !x[2]).map(x => x[3]), ord.map(n => byName[n]), 'chaque pastille a la couleur de son point');
  assert.ok(h.includes('<p class="perf-legend"><span class="perf-legend-o" aria-hidden="true"></span>les points de tes amis<span class="perf-legend-n" aria-hidden="true">3</span>le nombre de joueurs</p>'), 'une légende');
  const tt = plain(vm.runInContext("perfTeintes([{n:'A'},{n:'A'},{n:'Moi',me:1},{n:'B'},{n:'C'},{n:'D'},{n:'E'}])", ctx));
  assert.equal(Object.keys(tt).length, 5); assert.equal(new Set(Object.values(tt)).size, 5, 'cinq autres au plus : cinq couleurs');
  assert.ok(Object.values(tt).every(c => c >= 1 && c <= 5));
  assert.ok(bars[0][0].includes(`data-caph="${escAttr(vm.runInContext('perfCapHTML(state.salle.hist[2])', ctx))}"`), 'toucher une barre écrit sa partie');
  assert.equal(vm.runInContext('perfCapHTML(state.salle.hist[1])', ctx), 'Hier · Seul · Facile · 250 points');
  /* Que des parties seul : rien de plus */
  const solo = perfHTML({ ...salle, hist: [salle.hist[1]] }).h;
  assert.ok(!solo.includes('is-vs') && !solo.includes('perf-legend') && !solo.includes('perf-o'));
  for (const part of ['html.lq .perf-bar.is-vs i{', 'html.lq .perf-o{position:absolute;left:50%;bottom:var(--y);', 'html.lq .perf-card.is-in .perf-o{opacity:1;',
    'html.lq .perf-n{position:absolute;', 'html.lq .perf-cap-ppl>span.is-me{', 'html.lq .perf-legend{'])
    assert.ok(s51.includes(part), part);
  /* Cinq joueurs par salle au plus */
  assert.ok(app.includes('const JEU_MAX=5;'));
  assert.ok(app.includes('max:Math.max(1,Math.min(JEU_MAX,+m.max||JEU_MAX))'), 'une ancienne salle à 6 est ramenée à 5');
});

test('Supabase — le pseudo unique (jeu_pseudo) et le nouveau barème', () => {
  assert.ok(files.includes('20261031160846_pseudos_uniques.sql'), 'la migration appliquée le 31 octobre');
  const m = fs.readFileSync(new URL('20261031160846_pseudos_uniques.sql', dir), 'utf8');
  assert.match(m, /create table public\.jeu_pseudo \(\n  cle text primary key,[^\n]*\n  pseudo text not null,\n  norme text not null unique,/);
  assert.match(m, /alter table public\.jeu_pseudo enable row level security;\nrevoke all on table public\.jeu_pseudo from anon, authenticated;/);
  assert.ok(!/create policy/i.test(m), 'rien n’est lisible directement');
  assert.match(m, /translate\(lower\(btrim\(coalesce\(p, ''\)\)\), 'àâäáãåāçćčéèêëēęíìîïīñńóòôöõøōúùûüūýÿœæß', 'aaaaaaaccceeeeeeiiiiinnooooooouuuuuyyoas'\)/);
  assert.equal(Array.from('àâäáãåāçćčéèêëēęíìîïīñńóòôöõøōúùûüūýÿœæß').length, Array.from('aaaaaaaccceeeeeeiiiiinnooooooouuuuuyyoas').length, 'autant de lettres de chaque côté');
  assert.match(m, /if v_deja is not null then\n    update public\.jeu_pseudo set vu = now\(\) where cle = v_cle and vu < now\(\) - interval '1 hour';\n    return jsonb_build_object\('ok', true, 'pseudo', v_deja\);/, 'un appareil, un pseudo : il ne se change plus');
  assert.match(m, /v_pts < v_ok \* 100 or v_pts > v_ok \* \(case when v_solo then 200 else 250 end\)/, '200 au plus seul, 250 entre amis');
  assert.match(m, /raise exception 'pseudo déjà pris' using errcode = '23505', hint = 'pseudo';/);
  for (const f of ['jeu_pseudo_libre(text, text)', 'jeu_pseudo_prendre(text, text)'])
    assert.ok(m.includes(`grant execute on function public.${f} to anon, authenticated;`), f);
  for (const f of ['jeu_pseudo_norme(text)', 'jeu_pseudo_idees(text)', 'jeu_pseudo_menage()'])
    assert.ok(m.includes(`revoke all on function public.${f} from public, anon, authenticated;`) && !m.includes(`grant execute on function public.${f}`), f);
  assert.match(m, /delete from public\.jeu_pseudo where vu < now\(\) - interval '12 months';/);
  assert.ok(m.includes("select cron.schedule('jeu-pseudo-menage', '41 3 * * *', 'select public.jeu_pseudo_menage()');"));
  /* Les règles du site disent la même chose */
  const conf = fs.readFileSync(new URL('../decouvrir/confidentialite.html', import.meta.url), 'utf8');
  assert.ok(conf.includes('Ton pseudo.'), 'politique de confidentialité');
  const ios = fs.readFileSync(new URL('../IOS.md', import.meta.url), 'utf8');
  assert.ok(ios.includes('jeu-pseudo-menage') && ios.includes("delete from jeu_pseudo where pseudo = '"), 'IOS.md : la modération');
  for (const t of ['est unique : il est réservé sur le serveur de l’appli avec un identifiant tiré au hasard (pas ton nom ni ton e-mail), et libéré après 12&nbsp;mois sans ouvrir l’appli.'])
    assert.equal(app.split(t).length - 1, 2, 'les deux textes « Confidentialité » de l’appli');
});
