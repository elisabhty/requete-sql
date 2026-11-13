/* Salle de défi : le moteur (index.html) est exécuté dans plusieurs contextes isolés,
   un par joueur, reliés par une fausse base Supabase (fonctions jeu_envoyer,
   jeu_historique, jeu_balise et canal en direct par WebSocket) et une horloge
   virtuelle. On vérifie la salle d'attente, les 6 joueurs maximum, « prêt », le
   tirage au sort, les points, le relais d'hôte, la salle fantôme, « rejouer », le
   solo sans réseau, les coupures et les reconnexions. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const engineSrc = html.slice(html.indexOf('/* ---------- Salle de défi : un défi tiré au sort'), html.indexOf('/* Le même défi, seul ou à plusieurs'));
const challengesSrc = html.slice(html.indexOf('const CHALLENGES=['), html.indexOf('const NIV='));
assert.ok(engineSrc.includes('function jeuStart(') && challengesSrc.includes('af1'), 'moteur et défis localisés');
const SB = engineSrc.match(/const JEU_SB='([^']+)'/)[1];
const VOLATILE = ['ping', 'react'];

/* ---------- Monde : horloge virtuelle + base ---------- */
class World {
  constructor() { this.now = 1_800_000_000_000; this.timers = []; this.seq = 0; this.rooms = new Map(); this.posts = 0; this.histCalls = 0; this.latency = 60; this.signals = []; }
  setTimeout(fn, ms) { const t = { at: this.now + Math.max(0, ms || 0), fn, id: ++this.seq, iv: 0 }; this.timers.push(t); return t.id; }
  setInterval(fn, ms) { const t = { at: this.now + ms, fn, id: ++this.seq, iv: ms }; this.timers.push(t); return t.id; }
  clear(id) { this.timers = this.timers.filter(t => t.id !== id); }
  advance(ms) {
    const end = this.now + ms;
    for (;;) {
      const due = this.timers.filter(t => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      this.now = Math.max(this.now, due.at);
      if (due.iv) due.at += due.iv; else this.timers = this.timers.filter(t => t !== due);
      due.fn();
    }
    this.now = end;
  }
  room(code) { if (!this.rooms.has(code)) this.rooms.set(code, { n: 0, all: [], subs: new Set() }); return this.rooms.get(code); }
  /* jeu_envoyer : numéro dans la salle, heure du serveur, gardé, diffusé en direct. */
  publish(code, m) {
    this.posts++;
    const r = this.room(code), row = { n: ++r.n, at: this.now, m: JSON.parse(JSON.stringify(m)) };
    r.all.push(row);
    r.subs.forEach(s => this.setTimeout(() => s.deliver(row), this.latency));
    return { n: row.n, at: row.at };
  }
  /* jeu_historique : après le numéro donné, 500 au plus ; signes de vie et réactions seulement s’ils ont moins de 90 s. */
  history(code, after) {
    this.histCalls++;
    const rows = this.room(code).all.filter(r => r.n > after && (!VOLATILE.includes(r.m.t) || this.now - r.at <= 90000));
    return JSON.parse(JSON.stringify(rows.slice(0, 500)));
  }
}

/* Une promesse réglée par l’horloge virtuelle : ses then s’exécutent pendant w.advance(), comme les réponses du
   réseau pendant la partie (le moteur n’enchaîne ses promesses qu’avec then). */
class WP {
  constructor() { this.s = 0; this.v = undefined; this.cb = []; }
  static at(w, ms, f) { const p = new WP(); w.setTimeout(() => { try { p.set(1, f()); } catch (e) { p.set(2, e); } }, ms); return p; }
  static of(v) { const p = new WP(); p.set(1, v); return p; }
  set(s, v) {
    if (this.s) return;
    if (s === 1 && v && typeof v.then === 'function') { v.then(x => this.set(1, x), e => this.set(2, e)); return; }
    this.s = s; this.v = v; const cb = this.cb; this.cb = []; cb.forEach(f => f());
  }
  then(ok, ko) {
    const q = new WP();
    const run = () => {
      const f = this.s === 1 ? ok : ko;
      if (typeof f !== 'function') { q.set(this.s, this.v); return; }
      try { q.set(1, f(this.v)); } catch (e) { q.set(2, e); }
    };
    if (this.s) run(); else this.cb.push(run);
    return q;
  }
  catch(ko) { return this.then(undefined, ko); }
}

/* ---------- Joueur : un contexte vm avec le moteur et ses dépendances factices ---------- */
function makeClient(world, name, { skew = 0 } = {}) {
  const ctx = vm.createContext({});
  const store = {}, session = {};
  const c = { name, ctx, offline: false, deaf: false, failPosts: 0, lose: 0, beacons: 0, html: '', toasts: [], out: '', ed: { value: '' }, root: null, misc: { 'back-label': {}, 'nav-title': {}, 'lesson-body': {} }, sockets: 0 };
  c.root = { classList: { remove() {}, add() {} }, offsetWidth: 0, set innerHTML(v) { c.html = v; }, get innerHTML() { return c.html; } };
  /* Le canal en direct (Supabase Realtime, protocole 1.0.0) : rejoindre « realtime:salle:CODE », battements,
     diffusion. Hors ligne : rien ne passe ; sourd : rien n’arrive (ni le direct, ni les réponses de jeu_historique). */
  class FakeWS {
    constructor(url) {
      assert.ok(url.startsWith(SB.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey='), url);
      this.readyState = 0; this.room = null; this.topic = '';
      c.ws = this; c.sockets++;
      world.setTimeout(() => {
        if (this.readyState !== 0) return;
        if (c.offline) { this.readyState = 3; this.onclose && this.onclose({}); return; }
        this.readyState = 1; this.onopen && this.onopen({});
      }, world.latency);
    }
    send(s) {
      if (this.readyState !== 1) throw new Error('fermé');
      if (c.offline) return;
      const f = JSON.parse(s);
      world.setTimeout(() => this.server(f), world.latency);
    }
    server(f) {
      if (this.readyState !== 1) return;
      if (f.event === 'phx_join') {
        assert.equal(f.payload.config.private, false, 'canal public');
        this.topic = f.topic; this.room = world.room(f.topic.replace('realtime:salle:', '')); this.room.subs.add(this);
        this.push({ ref: f.ref, event: 'phx_reply', payload: { status: 'ok', response: { postgres_changes: [] } }, topic: f.topic });
      } else if (f.event === 'heartbeat') this.push({ ref: f.ref, event: 'phx_reply', payload: { status: 'ok', response: {} }, topic: 'phoenix' });
      /* Diffusion d’un joueur (canal public, self:false) : aux autres seulement, sans rien garder (« il écrit », 8 novembre) */
      else if (f.event === 'broadcast' && this.room && f.topic === this.topic) {
        world.signals.push(JSON.parse(JSON.stringify(f.payload)));
        this.room.subs.forEach(s => { if (s !== this) s.push({ ref: null, event: 'broadcast', payload: f.payload, topic: f.topic }); });
      }
      else if (f.event === 'phx_leave' && this.room) this.room.subs.delete(this);
    }
    push(o) { world.setTimeout(() => this.recv(o), world.latency); }
    /* c.lose : le direct perd les n prochains messages gardés (pas les signes de vie) pour ce joueur. */
    deliver(row) { if (c.lose > 0 && !VOLATILE.includes(row.m.t)) { c.lose--; return; } this.recv({ ref: null, event: 'broadcast', payload: { event: 'm', meta: { id: 'x' }, payload: { m: row.m, n: row.n, at: row.at, id: 'x' }, type: 'broadcast' }, topic: this.topic }); }
    recv(o) { if (this.readyState !== 1 || c.offline || c.deaf) return; this.onmessage && this.onmessage({ data: JSON.stringify(o) }); }
    close() { if (this.readyState === 3) return; this.readyState = 3; if (this.room) this.room.subs.delete(this); world.setTimeout(() => this.onclose && this.onclose({}), 0); }
  }
  const rpcName = url => (url.match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
  const resp = (ok, body) => ({ ok, status: ok ? 200 : 503, json: () => WP.of(JSON.parse(JSON.stringify(body === undefined ? null : body))) });
  const stubs = {
    console, Date: { now: () => world.now + skew },
    setTimeout: (f, ms) => world.setTimeout(f, ms), clearTimeout: id => world.clear(id),
    setInterval: (f, ms) => world.setInterval(f, ms), clearInterval: id => world.clear(id),
    requestAnimationFrame: f => world.setTimeout(f, 16), cancelAnimationFrame: id => world.clear(id),
    crypto: { getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 2 ** 32); return a; } },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: k => (k in session ? session[k] : null), setItem: (k, v) => { session[k] = String(v); }, removeItem: k => { delete session[k]; } },
    location: { search: '', protocol: 'https:', origin: 'https://x.test', pathname: '/' },
    window: { addEventListener() {} },
    document: {
      body: { classList: { contains: () => false } },
      getElementById: id => id === 'jeu-root' ? c.root : id === 'ed-lesson' ? c.ed : id === 'scr-lesson' ? { scrollTop: 0, dataset: {} } : ['back-label', 'nav-title', 'lesson-body'].includes(id) ? c.misc[id] : null,
      querySelector: sel => /#jeu-nom/.test(sel) ? { value: name, focus() {}, closest: () => null } : null,
      querySelectorAll: () => [],
    },
    navigator: {
      vibrate() {},
      /* jeu_balise : texte brut {"salle", "m"}, la clé dans l’adresse (pas d’en-tête possible). */
      sendBeacon: (url, body) => {
        assert.equal(rpcName(url), 'jeu_balise'); assert.match(url, /[?&]apikey=sb_publishable_/);
        if (c.offline) return false;
        c.beacons++;
        const b = JSON.parse(body);
        world.setTimeout(() => world.publish(b.salle, b.m), world.latency);
        return true;
      },
    },
    WebSocket: FakeWS,
    fetch: (url, opt) => {
      const fn = rpcName(url), body = JSON.parse(opt.body);
      assert.ok(String(url).startsWith(SB + '/rest/v1/rpc/'), url);
      assert.match(opt.headers.apikey, /^sb_publishable_/);
      if (c.offline) return WP.at(world, world.latency, () => resp(false));
      if (fn === 'jeu_envoyer') {
        if (c.failPosts > 0) { c.failPosts--; return WP.at(world, world.latency, () => resp(false)); }
        let res = null;
        world.setTimeout(() => { res = world.publish(body.p_salle, body.p_m); }, world.latency);
        return WP.at(world, 2 * world.latency, () => resp(true, res));
      }
      if (fn === 'jeu_historique') {
        let rows = [];
        world.setTimeout(() => { rows = world.history(body.p_salle, body.p_apres); }, world.latency);
        return WP.at(world, 2 * world.latency, () => resp(!c.offline && !c.deaf, rows));
      }
      throw new Error('fonction inconnue : ' + fn);
    },
    /* Le pseudo des salles : celui réservé (state.salle.pseudo, 17 h 53), jamais le prénom */
    state: { defis: {}, name, salle: { pseudo: name } }, SQL: {}, esc: s => String(s).replace(/</g, '&lt;'), escCode: s => String(s).replace(/</g, '&lt;').replace(/`([^`\n]+)`/g, '<code>$1</code>'), highlight: s => s, DEF_CHEV_SVG: '', JEU_FRIENDS_SVG: '', lqStkSvg: k => `<svg data-k="${k}"></svg>`,
    editorBlock: () => '<textarea id="ed-lesson"></textarea>', setupEditor() {}, celebrate() {}, annulerBilanAuto() {}, showScreen() {},
    prefersReduceMotion: () => false, lessonBackLabel: () => 'Défis', leaveLessonScreen() {}, switchTab() {}, renderDefis() {}, activeTab: 'defis',
    noteActivityDay() { c.acts = (c.acts || 0) + 1; }, save() {}, renderProgress() {}, renderPlanning() {}, setLessonOut: h => { c.out = h; }, renderTable: () => '', errBox: m => m,
    exoFailDiag: () => 'x', exerciseRequiresOrder: () => false, exerciseResultsMatch: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    resultatsDefiEgaux: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    sandbox: () => ({ exec: sql => [{ columns: ['q'], values: [[sql]] }], close() {} }),
    execChallengeResult: (database,sql) => database.exec(sql),
    performance: { now: () => world.now }, confirm: () => true, toast() {},
    /* La fenêtre de l’appli (lqAsk) répond tout de suite « oui » ; un test peut la remplacer pour compter ou refuser. */
    lqAsk: () => ({ then: f => f(true) }), lqInfo: () => {},
    mode: '', current: null, exoFails: 0,
  };
  Object.assign(ctx, stubs);
  vm.runInContext(challengesSrc + '\n' + engineSrc, ctx);
  /* 1er novembre, 0 h 55 : les défis de l’appli sont ceux de la base Aéroport, Facile seulement pour l’instant. Le moteur de la
     salle se teste aussi en Moyen et en Difficile : six défis de test par niveau (la base est simulée, cf. sandbox). */
  /* La base du défi (Aéroport…) est simulée comme celle du cours. */
  vm.runInContext('defiSandbox=function(){return sandbox();};', ctx);
  vm.runInContext("['m','d'].forEach(k=>{for(let i=1;i<=6;i++)CHALLENGES.push({id:'t'+k+i,niv:k,titre:'Défi test '+k+i,q:'Question '+k+i,sol:\"SELECT 't\"+k+i+\"'\"});});", ctx);
  /* La page est supposée déjà affichée : on capture les toasts. */
  vm.runInContext('jeuToast=function(t){__toasts.push(t);}', Object.assign(ctx, { __toasts: c.toasts }));
  c.ev = code => { const r = vm.runInContext(code, ctx); return r && typeof r === 'object' ? JSON.parse(JSON.stringify(r)) : r; };
  c.host = (code, opts = '{nomId:"jeu-nom"}', cid = 'null') => c.ev(`jeuStart(${JSON.stringify(code)},true,${cid},${opts})`);
  c.join = code => c.ev(`jeuJoin(${JSON.stringify(code)})`);
  /* Réseau retrouvé (événement « online ») : nouvelle connexion tout de suite. */
  c.reconnect = () => c.ev('JEU&&JEU.t.wake&&JEU.t.wake(true)');
  /* Ce que la base a livré à ce joueur (chaque objet une seule fois : jeuDrain rejoue les mêmes objets). */
  c.logRelay = () => c.ev("(function(){__relay=[];const o=jeuOnMsg;jeuOnMsg=function(m){if(m&&m.fromRelay&&!m.__log){m.__log=1;__relay.push(m.u);}return o(m);};})()");
  c.relay = () => c.ev('__relay');
  c.view = () => c.ev('JEU?JEU.view:null');
  c.J = expr => c.ev(`JEU.${expr}`);
  c.pid = () => c.ev('JEU.me');
  c.live = () => c.ev('jeuLive().map(p=>JEU.players[p].name)');
  c.found = () => { c.ed.value = c.ev('CHALLENGES.find(x=>x.id===JEU.rounds[jeuCur()].cid).sol'); c.ev('jeuRun()'); };
  return c;
}

const sec = (w, s) => w.advance(s * 1000);
/* Une manche close avant la fin du chrono : par le serveur à son heure, ou par une version d’avant de l’appli. L’hôte n’a plus de bouton
   pour la clore (Elisa, 9 novembre, 8 h 42 : « l’hôte n’a pas la main pour la clore ») : le message « close », tel que la salle le reçoit. */
const clore = c => c.ev("jeuSend({t:'close',n:jeuCur()})");

function room({ n = 2, nb = 3, niv = 'f', settle = 3 } = {}) {
  const w = new World();
  const host = makeClient(w, 'Hôte');
  host.ev(`jeuNiv='${niv}';jeuNb=${nb}`);
  host.host('ROOM42');
  sec(w, 1);
  const guests = [];
  for (let i = 1; i < n; i++) { const g = makeClient(w, 'Ami' + i); g.ev(`jeuNiv='f';jeuNb=1`); g.join('ROOM42'); guests.push(g); sec(w, 1.2); }
  sec(w, settle);
  return { w, host, guests, all: [host, ...guests] };
}

test('salle d’attente : chacun voit les autres en direct, avec l’hôte en premier', () => {
  const { host, guests } = room({ n: 3 });
  for (const c of [host, ...guests]) {
    assert.equal(c.view(), 'lobby', c.name);
    assert.deepEqual(c.live(), ['Hôte', 'Ami1', 'Ami2'], c.name);
    assert.equal(c.J('hostPid'), host.pid());
  }
  assert.equal(guests[0].J('nb'), 3, 'le réglage de l’hôte arrive chez les amis');
  assert.match(host.html, /Invite tes amis/);
  assert.match(guests[0].html, /Salle de Hôte/);
  assert.match(host.html, /En attente d’un joueur/, 'une place libre est annoncée');
  assert.ok(host.toasts.some(t => /Ami2 a rejoint la salle/.test(t)), 'annonce d’arrivée');
});

test('« prêt » : chaque ami se déclare, l’hôte voit « 2/3 prêts » ; tout le monde prêt, il lance (14 h 01)', () => {
  const { w, host, guests } = room({ n: 3, settle: 1 });
  const etat = c => c.ev('jeuLobbyEtatHTML()'), badge = c => c.ev('jeuBadgeHTML()');
  assert.equal(host.ev('jeuLobbyLabel()'), 'En attente des joueurs…', '14 h 09 : le bouton dit qu’il attend');
  assert.match(badge(host), /1\/3 prêts$/);
  assert.match(etat(host), /<b>En attente de Ami[12] et Ami[12]…<\/b><\/span>/, 'les mots d’Elisa, sans précision');
  assert.equal(host.ev('jeuPeutLancer()'), false, 'pas tous prêts, moins de 30 s : le bouton attend');
  assert.ok(html.includes('onclick="jeuLancer()"${jeuPeutLancer()?\'\':\' disabled aria-disabled="true"\'}>'), 'désactivé : disabled');
  assert.match(etat(guests[0]), /<b>Préviens l’hôte quand tu es prêt·e\u00a0!<\/b>/);
  guests[0].ev('jeuToggleReady()'); sec(w, 1);
  assert.match(badge(host), /2\/3 prêts$/);
  assert.match(etat(host), /<b>En attente de Ami2…<\/b>/);
  assert.match(etat(guests[0]), /<b>Tu es prêt·e\u00a0!<\/b><small>En attente des autres joueurs…<\/small>/);
  assert.equal(guests[0].ev('jeuPretBouton(!!JEU.ready[JEU.me])'), 'Prêt·e ✓');
  guests[1].ev('jeuToggleReady()'); sec(w, 1);
  assert.match(etat(host), /<b>Tout le monde est prêt\u00a0!<\/b><small>À toi de lancer la partie\.<\/small>/);
  assert.equal(host.ev('jeuPeutLancer()'), true); assert.equal(host.ev('jeuLobbyLabel()'), 'Lancer la partie');
  for (const g of guests) assert.match(etat(g), /<b>Tout le monde est prêt\u00a0!<\/b><small>L’hôte peut lancer la partie\.<\/small>/);
  guests[1].ev('jeuToggleReady()'); sec(w, 1);
  assert.match(badge(host), /2\/3 prêts$/, 'on peut se remettre « pas prêt »');
  assert.equal(host.ev('jeuBadgeTous()'), false);
  assert.equal(host.ev('jeuToggleReady()'), undefined, 'l’hôte est toujours prêt : pas de bascule');
  guests[1].ev('jeuStop()'); sec(w, 3);
  assert.match(badge(host), /2\/2 prêts$/); assert.equal(host.ev('jeuPeutLancer()'), true, 'il est parti : tout le monde est prêt');
  host.ev('jeuLancer()'); sec(w, 1);
  assert.ok(host.J('rounds[0]'), 'l’hôte lance : la partie part (jamais toute seule)');
});

/* Elisa, 31 octobre, 16 h 49 : « max 5 pour une salle » ; 8 novembre, 22 h 27 : « accepte 6 max dans une salle, comme ça on a deux
   lignes pleines » */
test('6 joueurs au maximum : le 7e voit « salle complète », les autres ne changent pas', () => {
  assert.ok(html.includes('const JEU_MAX=6;'));
  const { w, host, guests } = room({ n: 6 });
  assert.equal(host.live().length, 6);
  assert.equal(host.ev("jeuLive().length+'/'+JEU.max"), '6/6', 'la salle d’attente compte sur 6');
  const late = makeClient(w, 'Trop'); late.join('ROOM42'); sec(w, 4);
  assert.equal(late.view(), 'full');
  assert.match(late.html, /Salle complète&nbsp;!/);
  assert.match(late.html, /Cette salle a déjà atteint sa limite de 6 joueurs/);
  for (const c of [host, ...guests]) assert.equal(c.live().length, 6, c.name + ' n’affiche pas le 7e');
  assert.ok(!host.live().includes('Trop'));
  /* Une place se libère : la même personne peut réessayer. */
  guests[4].ev('jeuStop()'); sec(w, 2);
  assert.equal(host.live().length, 5);
  const retry = makeClient(w, 'Trop'); retry.ev(`sessionStorage.setItem('rq-jeu-pid',${JSON.stringify(late.pid())})`);
  late.ev('jeuStop()'); retry.join('ROOM42'); sec(w, 4);
  assert.equal(retry.view(), 'lobby', 'réadmise quand il y a de la place');
  assert.equal(host.live().length, 6);
});

test('les fantômes de l’historique ne comptent pas dans la limite et ne sont pas affichés', () => {
  const { w, host, guests } = room({ n: 4 });
  guests.forEach(g => g.ev('jeuStop()')); sec(w, 70);
  assert.deepEqual(host.live(), ['Hôte']);
  const fresh = [1, 2, 3, 4].map(i => { const g = makeClient(w, 'N' + i); g.join('ROOM42'); sec(w, 1.5); return g; });
  sec(w, 3);
  assert.equal(host.live().length, 5, 'les 3 partis ont libéré leur place');
  assert.ok(fresh.every(g => g.view() === 'lobby'));
});

test('tirage au sort : même défi pour tous, compte à rebours, puis la manche (10 min au plus)', () => {
  const { w, host, guests, all } = room({ n: 3 });
  host.ev('jeuNextRound()'); sec(w, 0.8);
  const cid = host.J('rounds[0].cid');
  for (const c of all) { assert.equal(c.view(), 'draw0', c.name); assert.equal(c.J('rounds[0].cid'), cid, 'même défi'); }
  assert.match(host.html, /Tirage au sort/);
  assert.doesNotMatch(host.html, /La situation/, 'la consigne reste cachée pendant le tirage');
  sec(w, 3.6);
  for (const c of all) { assert.equal(c.view(), 'play0', c.name); }
  assert.match(host.html, /<span class="tag">La situation<\/span>/, 'la consigne : « La situation » (8 novembre, 13 h 15)');
  assert.ok(host.ev('CHALLENGES.find(c=>c.id===JEU.rounds[0].cid).niv') === 'f', 'au niveau choisi');
});

/* Elisa, 31 octobre, 1 h 34 : « le chrono compte de 00:00 à … pour avoir des points si on réussit en premier par rapport à ses amis
   + par rapport au temps » ; 17 h 39 : des paliers — ≤ 1 min 200, 1 à 2 min 175, 2 à 3 min 150, 3 à 4 min 125, 4 à 5 min 100, 5 à
   7 min 75, 7 min et + 50 ; +25 si réussi du premier essai ; 🥇 +50, 🥈 +30, 🥉 +20, 4e +10, 5e +0. Les paliers suivent le chrono
   affiché (01:00 vaut encore 200). */
const valeur = ms => { const s = Math.floor(ms / 1000); for (const [t, p] of [[60, 200], [120, 175], [180, 150], [240, 125], [300, 100], [420, 75]]) if (s <= t) return p; return 50; };
test('manche : les paliers de temps, +25 du premier coup, +50 / +30 / +20 aux premiers ; la manche se termine quand tous ont trouvé', () => {
  const { w, host, guests } = room({ n: 3 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  assert.match(guests[0].html, /<i class="jeu-val-b" id="jeu-val-b" title="Si ta première requête est la bonne">\+25<\/i>/, '« +25 » tant que la première requête peut être la bonne');
  guests[1].found(); sec(w, 5);
  /* L’hôte se trompe d’abord : il trouve au deuxième essai */
  host.ed.value = 'SELECT 1'; host.ev('jeuRun()'); assert.equal(host.J('rounds[0].tries'), 1);
  host.found(); sec(w, 1);
  assert.equal(host.view(), 'play0', 'Ami1 n’a pas encore trouvé : la manche continue');
  assert.match(host.html, /Ami2|✓/);
  sec(w, 65); guests[0].found(); sec(w, 1);
  /* 9 novembre, 8 h 20 : le dernier à trouver voit son encart passer au vert, un instant, puis les résultats de la manche */
  assert.equal(guests[0].view(), 'play0'); assert.match(guests[0].html, /Bravo, défi résolu/); assert.match(guests[0].html, /Tout le monde a trouvé, les résultats arrivent…/);
  assert.equal(host.view(), 'res0', 'les autres, aussitôt les résultats');
  sec(w, 1.5);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'res0', c.name);
  const rk = host.ev('jeuRanking(0).map(x=>({name:JEU.players[x.pid].name,ms:x.ms,val:x.val,essai:x.essai,rang:x.rang,pts:x.pts,place:x.place}))');
  assert.deepEqual(rk.map(x => x.name), ['Ami2', 'Hôte', 'Ami1']);
  assert.deepEqual(rk.map(x => x.rang), [50, 30, 20], 'le premier à trouver marque le plus');
  assert.deepEqual(rk.map(x => x.place), [1, 2, 3]);
  assert.ok(rk[0].ms < rk[1].ms && rk[1].ms < rk[2].ms, 'du plus rapide au plus lent');
  assert.deepEqual(rk.map(x => x.val), [200, 200, 175], 'trouvé en moins d’une minute : 200 ; après 1 min : 175');
  /* Elisa, 5 novembre, 9 h 18 : « quand une personne a mis la bonne requête, enlever les +25 aux autres » : entre amis, le +25 du
     premier coup ne va qu’au premier à trouver ; Ami1 trouve du premier coup, mais après Ami2 : pas de +25. */
  assert.deepEqual(rk.map(x => x.essai), [25, 0, 0], 'l’hôte s’est trompé une fois, Ami1 arrive après Ami2 : pas de +25');
  for (const x of rk) {
    assert.equal(x.val, valeur(x.ms), x.name + ' : le palier');
    assert.equal(x.pts, x.val + x.essai + x.rang, x.name + ' : le total');
  }
  assert.deepEqual(rk.map(x => x.pts), [275, 230, 195]);
  for (const x of rk) assert.ok(host.html.includes(`<em class="jr2-p">+${x.pts}</em>`), 'les points gagnés dans le classement : ' + x.pts);
  /* Le détail des points sur sa seule ligne (Elisa, 31 octobre, 16 h 29 : « il y a trop de trucs ») : l’hôte est 2e ; ce que
     valait le défi quand il l’a trouvé, puis son bonus de 2e */
  assert.ok(host.html.includes('<p class="jr2-pills"><i>Défi 200</i><i class="is-rang">2e +30</i></p>'), 'le détail des points (en pastilles, 15 h 48)');
  assert.ok(guests[1].html.includes('<p class="jr2-pills"><i>Défi 200</i><i class="is-essai">Du premier coup +25</i><i class="is-rang">1er +50</i></p>'), 'du premier coup');
  assert.doesNotMatch(host.html, /rapidité<\/i>/);
  assert.equal((host.html.match(/class="jr2-pills"/g) || []).length, 1, 'le détail : une seule fois, le sien, dans le cadre');
  assert.match(host.html, /<em>00:\d\d<\/em>/, 'le temps en 00:00');
  /* 17 h 31 : « il faut que ça continue seul sans interruption » : le même compte à rebours chez tous, plus de bouton */
  for (const c of [host, ...guests]) assert.match(c.html, /<p class="jeu-auto jr2-auto" id="jeu-auto"[^>]*><span>La manche suivante démarre dans <b id="jeu-auto-n">\d<\/b>/, c.name);
  assert.doesNotMatch(host.html, /id="jeu-go"|<span>Manche suivante<\/span>/);
  assert.equal(host.ev('state.defis[JEU.rounds[0].cid]'), true, 'réussi en salle : compte dans la progression');
});

test('manches enchaînées sans doublon, podium, points cumulés une seule fois', () => {
  const { w, host, guests } = room({ n: 2, nb: 3 });
  for (let n = 0; n < 3; n++) {
    host.ev('jeuNextRound()'); sec(w, 4.5);
    host.found(); sec(w, 3); guests[0].found(); sec(w, 1.5);
    assert.equal(host.view(), n < 2 ? 'res' + n : 'play2', '13 novembre, 17 h 31 : la dernière reste sur sa carte, le temps du compte à rebours');
  }
  assert.match(host.html, /Tes points arrivent dans <b id="jeu-auto-n">\d<\/b>/, 'la barre : « Tes points arrivent dans 5 s »');
  const cids = host.ev('JEU.rounds.map(r=>r.cid)');
  assert.equal(new Set(cids).size, 3, 'trois défis différents : ' + cids);
  host.ev('jeuFinish()'); sec(w, 1.5);
  assert.equal(host.view(), 'final'); assert.equal(guests[0].view(), 'final');
  assert.match(host.html, /onclick="jeuRevanche\(\)"><svg[^]*?<\/svg><span>Rejouer/);   // l’hôte aussi dit qu’il en est (13 novembre, 21 h 33) ; il a gagné : « Rejouer » (22 h 14)
  /* 13 novembre, 16 h 58 : l’ami aussi a son bouton, la revanche (il sera prêt à la relance) */
  assert.match(guests[0].html, /onclick="jeuRevanche\(\)"><svg[^]*?<\/svg><span>Revanche/);
  assert.doesNotMatch(guests[0].html, /jeuRejouer\(\)/);
  assert.equal(host.ev('state.salle.parties'), 1);
  const sum = c => c.ev('JEU.rounds.reduce((s,r,i)=>s+((jeuRanking(i).find(x=>x.pid===JEU.me)||{pts:0}).pts),0)');
  assert.equal(host.ev('state.salle.pts'), sum(host), 'les points des trois manches, une seule fois');
  assert.ok(sum(host) > sum(guests[0]) && sum(guests[0]) >= 3 * 130, 'l’hôte, toujours premier, devant son ami');
  assert.equal(guests[0].ev('state.salle.pts'), sum(guests[0]));
  assert.equal(host.ev('jeuScores()[0].pts'), sum(host), 'le podium dit les mêmes points');
  host.ev('jeuRender()'); sec(w, 1);
  assert.equal(host.ev('state.salle.parties'), 1, 'pas de double comptage');
});

test('« Rejouer dans cette salle » : même code, retour en salle d’attente, prêts remis à zéro', () => {
  const { w, host, guests } = room({ n: 3, nb: 1 });
  guests[0].ev('jeuToggleReady()'); sec(w, 1);
  host.ev('jeuNextRound()'); sec(w, 4.5); host.found(); guests[0].found(); guests[1].found(); sec(w, 2);
  host.ev('jeuFinish()'); sec(w, 1.5);
  const first = host.ev('JEU.rounds[0].cid');
  host.ev('jeuAgain()'); sec(w, 1.5);
  for (const c of [host, ...guests]) { assert.equal(c.view(), 'lobby', c.name); assert.equal(c.J('g'), 1); assert.equal(c.J('rounds.length'), 0); }
  assert.equal(guests[0].J('ready[JEU.me]'), undefined, 'prêts remis à zéro');
  host.ev('jeuNextRound()'); sec(w, 1);
  assert.notEqual(host.ev('JEU.rounds[0].cid'), first, 'on évite le défi qu’on vient de jouer');
  assert.equal(guests[1].J('rounds[0].cid'), host.ev('JEU.rounds[0].cid'));
});

test('13 novembre, 21 h 33 : la revanche ; chacun dit s’il en est, et quand tous ceux qui restent ont répondu, la partie repart toute seule', () => {
  const { w, host, guests } = room({ n: 3, nb: 1 });
  guests[0].ev('jeuToggleReady()'); guests[1].ev('jeuToggleReady()'); sec(w, 1);
  host.ev('jeuNextRound()'); sec(w, 4.5); guests[1].found(); sec(w, 1); host.found(); sec(w, 1); guests[0].found(); sec(w, 2);
  host.ev('jeuFinish()'); sec(w, 1.5);
  assert.equal(guests[0].view(), 'final');
  /* 22 h 14 : Ami2 a gagné : lui touche « Rejouer », les autres « Revanche » */
  assert.deepEqual(guests[0].ev('JSON.stringify([...jeuGagnants()])'), JSON.stringify([guests[1].J('me')]), 'un seul gagnant, Ami2');
  assert.match(guests[1].html, /<b>On rejoue\u00a0\?<\/b><small>Touche Rejouer pour dire que tu es de la partie\.<\/small>/);
  assert.match(guests[1].html, /onclick="jeuRevanche\(\)"><svg[^]*?<\/svg><span>Rejouer<\/span>/);
  assert.match(host.html, /onclick="jeuRevanche\(\)"><svg[^]*?<\/svg><span>Revanche<\/span>/);
  assert.match(guests[0].html, /<b>On rejoue\u00a0\?<\/b><small>Touche Revanche pour dire que tu es de la partie\.<\/small>/);
  guests[0].ev('jeuRevanche()'); sec(w, 0.5);
  assert.equal(guests[0].J('revanche'), true);
  assert.match(guests[0].html, /class="journey-primary jeu-revanche on" aria-pressed="true"/);
  assert.match(guests[0].html, /<span>Prêt·e ✓<\/span>/);
  assert.match(guests[0].html, /<b>Tu es de la partie\u00a0!<\/b><small>On attend Hôte et Ami2\.<\/small>/, 'l’un a « Revanche », l’autre « Rejouer » : leurs noms seulement');
  assert.equal(host.ev(`JEU.rv[${JSON.stringify(guests[0].J('me'))}]`), true, 'les autres le savent');
  host.ev('jeuRedraw()'); sec(w, 0.2);   // dans l’appli, jeuPatch remplace la carte sur place (ici, pas de vrai DOM)
  assert.match(host.html, /<b>Ami1 veut sa revanche\u00a0!<\/b>/, 'les autres le voient en direct');
  assert.match(host.html, /1\/3 pour la revanche/);
  guests[1].ev('jeuRedraw()'); sec(w, 0.2);
  assert.match(guests[1].html, /<b>Ami1 veut sa revanche\u00a0!<\/b>/); assert.match(guests[1].html, /1\/3 pour rejouer/, 'le gagnant : « pour rejouer »');
  guests[1].ev('jeuRevanche()'); guests[1].ev('jeuRevanche()'); sec(w, 0.5);
  assert.equal(guests[1].J('revanche'), false, 'touché de nouveau, il se ravise');
  host.ev('jeuRevanche()'); sec(w, 2);
  assert.equal(host.J('g'), 0, 'Ami2 n’a pas répondu : on l’attend');
  assert.match(host.html, /<small>On attend Ami2\u00a0: Rejouer ou Quitter la salle\.<\/small>/, 'Ami2, le gagnant, a « Rejouer »');
  /* Ami2 quitte la salle : ceux qui restent ont tous dit oui, ça relance */
  guests[1].ev('jeuQuitterSalle(); jeuStop()'); sec(w, 2);   // dans l’appli, leaveLessonScreen appelle jeuStop
  for (const c of [host, guests[0]]) assert.equal(c.J('g'), 1, c.name + ' : la salle repart');
  sec(w, 2);
  assert.equal(host.ev(`JEU.ready[${JSON.stringify(guests[0].J('me'))}]`), true, 'Ami1 prêt tout seul');
  sec(w, 5);
  for (const c of [host, guests[0]]) assert.ok(/^(draw0|play0)$/.test(c.view()), c.name + ' : la partie repart toute seule : ' + c.view());
  assert.equal(guests[0].J('revanche'), false, 'la revanche ne vaut que pour une relance');
});

test('l’hôte change le niveau et le nombre de manches dans la salle d’attente', () => {
  const { w, host, guests } = room({ n: 2, nb: 3 });
  host.ev("jeuLobbySet('niv','d')"); host.ev('jeuLobbySet("nb",5)'); sec(w, 1);
  assert.equal(host.J('nb'), 3, '5 manches n’existe plus (8 novembre, 17 h 08)');
  host.ev('jeuLobbySet("nb",2)'); sec(w, 1.5);
  assert.equal(guests[0].J('niv'), 'd'); assert.equal(guests[0].J('nb'), 2);
  assert.match(guests[0].html, /Difficile/);
  host.ev("jeuLobbySet('niv','f')"); sec(w, 1);
  assert.equal(host.J('nb'), 2, 'le niveau change, le nombre de manches reste');
  assert.equal(guests[0].ev("jeuLobbySet('niv','m')"), undefined, 'un ami ne règle rien');
  assert.equal(host.J('niv'), 'f');
});

test('l’hôte quitte la salle d’attente : le plus ancien arrivé devient hôte', () => {
  const { w, host, guests } = room({ n: 3 });
  host.ev('jeuStop()'); sec(w, 8);
  for (const g of guests) { assert.equal(g.J('hostPid'), guests[0].pid(), g.name); assert.equal(g.view(), 'lobby'); }
  assert.ok(guests[0].ev('jeuIsHost()'));
  assert.match(guests[0].html, /Invite tes amis/);
  assert.match(guests[1].html, /Salle d’Ami1/, 'élision devant une voyelle');
  assert.ok(guests[1].toasts.some(t => /Ami1 est maintenant l’hôte/.test(t)));
  assert.deepEqual(guests[1].live(), ['Ami1', 'Ami2']);
  guests[0].ev('jeuNextRound()'); sec(w, 1);
  assert.ok(guests[1].J('rounds[0]'), 'le nouvel hôte lance la partie');
});

test('l’hôte disparaît sans prévenir : relais après le délai de présence, et il revient comme simple joueur', () => {
  const { w, host, guests } = room({ n: 3 });
  host.offline = true;
  sec(w, 40);
  assert.equal(guests[0].J('hostPid'), host.pid(), 'trop tôt pour le remplacer');
  sec(w, 60);
  assert.equal(guests[1].J('hostPid'), guests[0].pid());
  assert.deepEqual(guests[1].live(), ['Ami1', 'Ami2'], 'l’hôte absent n’est plus listé');
  host.offline = false; host.reconnect();
  sec(w, 3);
  assert.equal(host.J('hostPid'), guests[0].pid(), 'l’ancien hôte se range derrière le nouveau');
  assert.equal(host.ev('jeuIsHost()'), false);
  assert.match(host.html, /Salle d’Ami1/);
});

test('deux amis veulent prendre la main en même temps : un seul hôte pour tout le monde', () => {
  const { w, host, guests } = room({ n: 4 });
  host.ev('jeuStop()'); host.ev('1');
  guests.forEach(g => { g.ev('JEU.syncAt=0'); g.ev('JEU.claimAt=0'); });
  guests[0].ev('jeuSend({t:"host",from:JEU.hostPid})'); guests[1].ev('jeuSend({t:"host",from:JEU.hostPid})');
  sec(w, 3);
  const hosts = new Set(guests.map(g => g.J('hostPid')));
  assert.equal(hosts.size, 1, 'tous d’accord');
});

test('l’hôte quitte en pleine manche : la partie continue avec le nouvel hôte', () => {
  const { w, host, guests } = room({ n: 3, nb: 3 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  host.ev('jeuStop()'); sec(w, 8);
  assert.equal(guests[0].view(), 'play0');
  guests[0].found(); guests[1].found(); sec(w, 2);
  assert.equal(guests[1].view(), 'res0', 'l’absent ne bloque pas la fin de manche');
  assert.ok(guests[0].ev('jeuIsHost()'));
  guests[0].ev('jeuNextRound()'); sec(w, 1);
  assert.ok(guests[1].J('rounds[1]'));
});

/* Elisa, 8 novembre, 16 h 05 : « on peut rejoindre tant que l’hôte n’a pas cliqué sur commencer, mais après non ». */
test('la partie lancée, un nouveau venu n’entre plus ; qui était dans la salle d’attente revient, sans fantômes ; « Rejouer » rouvre', () => {
  const { w, host, guests } = room({ n: 3, nb: 1 });
  const pid2 = guests[1].pid(); guests[1].ev('jeuStop()'); sec(w, 2);
  host.ev('jeuNextRound()'); sec(w, 4.5);
  const late = makeClient(w, 'Retard'); late.join('ROOM42'); sec(w, 3);
  assert.equal(late.view(), 'tard');
  assert.match(late.html, /La partie a déjà commencé/);
  for (const c of [host, guests[0]]) {
    assert.deepEqual(c.live().sort(), ['Ami1', 'Hôte'], c.name + ' ne le voit pas arriver');
    assert.ok(!c.toasts.some(t => /Retard/.test(t)), c.name + ' : pas d’annonce');
  }
  sec(w, 60);
  assert.ok(late.J('hostPid') !== late.pid() && host.J('hostPid') === host.pid(), 'il ne prend jamais la main');
  /* Ami2 était dans la salle d’attente : il revient en pleine manche, même appareil */
  const back = samePid(w, 'Ami2', pid2); back.join('ROOM42'); sec(w, 3);
  assert.equal(back.view(), 'play0');
  assert.deepEqual(host.live().sort(), ['Ami1', 'Ami2', 'Hôte']);
  const left = back.ev('Math.round((JEU.rounds[0].t1+600000-Date.now())/1000)');
  assert.ok(left > 500 && left < 600, 'temps restant cohérent : ' + left);
  /* Fin de partie, « Rejouer » : la salle d’attente est rouverte, un nouveau venu entre */
  host.found(); guests[0].found(); back.found(); sec(w, 2); host.ev('jeuFinish()'); sec(w, 1.5);
  const podium = makeClient(w, 'Podium'); podium.join('ROOM42'); sec(w, 3);
  assert.equal(podium.view(), 'tard', 'pendant le podium non plus');
  host.ev('jeuAgain()'); sec(w, 1.5);
  const neuf = makeClient(w, 'Neuf'); neuf.join('ROOM42'); sec(w, 3);
  assert.equal(neuf.view(), 'lobby');
  assert.ok(host.live().includes('Neuf'));
});

test('décalage d’horloge de ±3 s entre téléphones : même tirage, même manche', () => {
  const w = new World();
  const host = makeClient(w, 'Hôte'); host.host('SKEW77'); sec(w, 1);
  const a = makeClient(w, 'Avance', { skew: 3000 }), b = makeClient(w, 'Retard', { skew: -3000 });
  a.join('SKEW77'); b.join('SKEW77'); sec(w, 4);
  host.ev('jeuNextRound()'); sec(w, 0.9);
  for (const c of [host, a, b]) assert.equal(c.view(), 'draw0', c.name);
  sec(w, 3.6);
  for (const c of [host, a, b]) assert.equal(c.view(), 'play0', c.name);
});

test('salle introuvable, salle vide, salle pleine : des messages clairs', () => {
  const w = new World();
  const a = makeClient(w, 'Perdu'); a.join('NOPE99'); sec(w, 9);
  assert.equal(a.view(), 'lost'); assert.match(a.html, /Salle introuvable/);
  const host = makeClient(w, 'Hôte'); host.host('GHOST1'); sec(w, 2); host.ev('jeuStop()'); sec(w, 80);
  const late = makeClient(w, 'Tard'); late.join('GHOST1'); sec(w, 30);
  assert.equal(late.view(), 'empty'); assert.match(late.html, /Cette salle est vide/);
});

test('hors ligne au moment de rejoindre : on attend le réseau au lieu de dire « introuvable »', () => {
  const w = new World();
  const host = makeClient(w, 'Hôte'); host.host('NET123'); sec(w, 1);
  const g = makeClient(w, 'Ami'); g.offline = true; g.join('NET123'); sec(w, 20);
  assert.equal(g.view(), 'join'); assert.match(g.ev('jeuNetHTML()'), /Connexion perdue/);
  g.offline = false; g.reconnect(); g.ev('jeuSend({t:"ping"})'); sec(w, 5);
  assert.notEqual(g.view(), 'lost');
});

test('un joueur en retard de signe de vie disparaît de la manche, et revient avec un ping', () => {
  const { w, host, guests } = room({ n: 3 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  guests[1].offline = true; sec(w, 60);
  assert.deepEqual(host.live(), ['Hôte', 'Ami1']);
  host.found(); guests[0].found(); sec(w, 2.5);   // l’encart vert un instant (9 novembre, 8 h 20)
  assert.equal(host.view(), 'res0');
  guests[1].offline = false; guests[1].reconnect(); guests[1].ev('jeuPing()'); sec(w, 2);
  assert.ok(host.live().includes('Ami2'));
});

test('solo : aucun message réseau, tirage immédiat, points selon la rapidité', () => {
  const w = new World();
  const s = makeClient(w, 'Seul'); s.ev("jeuNb=3;jeuNiv='m'");
  s.ev("jeuStart('SOLO11',true,null,{solo:true})");
  sec(w, 0.5);
  assert.equal(s.view(), 'draw0');
  assert.match(s.html, /Un défi au hasard/);
  sec(w, 3.5); assert.equal(s.view(), 'play0');
  assert.doesNotMatch(s.html, /jeu-players|jeu-reacts|jeu-reagir/, 'ni liste de joueurs ni réactions');
  assert.equal(s.ev('jeuReagirLa()'), false, '« Réagir » non plus');
  sec(w, 20); s.found(); sec(w, 1);                        /* vers 20 s : 200 */
  /* 9 novembre, 8 h 20 : la manche trouvée reste à l’écran, « Bravo, défi résolu ! » dans la carte, le temps de la suite (avant : ses
     résultats, « Ton résultat ») */
  assert.equal(s.view(), 'play0'); assert.match(s.html, /Bravo, défi résolu/); assert.match(s.html, /La manche suivante démarre dans <b id="jeu-auto-n">\d+<\/b>/);
  assert.doesNotMatch(s.html, /id="ed-lesson"|En attente des autres|jeu-reacts/, 'ni éditeur, ni attente des autres, ni réactions');
  s.ev('jeuNextRound()'); sec(w, 4); sec(w, 80); s.found(); sec(w, 1);   /* vers 80 s */
  s.ev('jeuNextRound()'); sec(w, 4); sec(w, 150); s.found(); sec(w, 1);  /* vers 150 s */
  const rk = s.ev('JEU.rounds.map((r,i)=>jeuRanking(i)[0])');
  assert.deepEqual(rk.map(x => x.rang), [0, 0, 0], 'seul : pas de bonus de rang');
  /* 6 novembre, 15 h (« Multiplicateur ×2 / ×4 ») : la partie est en Moyen, les points de vitesse comptent double et chaque palier
     dure 3 min (retours-1242) ; 8 novembre, 9 h 17 : le premier coup reste à +25. Trouvés en moins de 3 min, les trois défis valent
     400, plus 25 du premier coup */
  assert.deepEqual(rk.map(x => x.pts), rk.map(x => 2 * valeur(Math.floor(x.ms / 3)) + 25), 'seul : le palier du Moyen ×2, et le premier coup');
  assert.deepEqual(rk.map(x => x.pts), [425, 425, 425], 'vers 20 s, 80 s et 150 s : 400, plus 25 du premier coup');
  s.ev('jeuFinish()'); sec(w, 1);
  assert.equal(s.view(), 'final'); assert.match(s.html, /Carton plein/); assert.match(s.html, /Rejouer/);
  assert.equal(s.ev('state.salle.pts'), rk.reduce((a, x) => a + x.pts, 0)); assert.equal(s.ev('state.salle.parties'), 1);
  assert.equal(s.ev('JEU.rounds.every(r=>state.defis[r.cid])'), true);
  assert.equal(w.posts, 0, 'rien n’est envoyé au relais en solo');
  assert.equal(s.sockets, 0, 'ni connexion au direct');
  assert.equal(new Set(s.ev('JEU.rounds.map(r=>r.cid)')).size, 3);
  s.ev('jeuAgain()'); sec(w, 0.5);
  assert.equal(s.view(), 'draw0', 'rejouer en solo enchaîne directement');
  assert.equal(s.ev('JEU.g'), 1);
});

/* 9 novembre, 8 h 20 (Elisa) : « je veux que l’encart rouge se transforme en vert avec Bravo défi résolu…. En attente des autres ou qui
   passe à la manche suivante si autre manche, avec résolu en 2 min etc. » */
test('solo : la manche trouvée reste à l’écran, « Bravo, défi résolu ! », chrono arrêté au vert ; une partie d’une manche finit sur l’écran de fin (11 h 31)', () => {
  const w = new World();
  const s = makeClient(w, 'Seul'); s.ev("jeuNb=1;jeuNiv='f'");
  s.ev("jeuStart('SOLO77',true,null,{solo:true})"); sec(w, 4);
  assert.equal(s.view(), 'play0');
  sec(w, 65); s.found(); sec(w, 1);
  assert.equal(s.view(), 'play0', 'la manche reste');
  assert.match(s.html, /<section class="coach is-ok jeu-done" id="jeu-done" aria-label="Défi résolu" aria-live="polite">/);
  assert.match(s.html, /<b class="coach-ok-k">Bravo, défi résolu&nbsp;!<\/b><p><span class="coach-ok-d">Résolu en <b>1 min 0[5-9]<\/b> ·<\/span> <span class="coach-ok-d">du premier coup <span class="coach-ok-bonus">\+25 ✨<\/span><\/span><\/p><\/div><strong class="jeu-done-pts coach-ok-pts"><em data-n="\d+">/, 'le temps, le premier coup, les points à droite (8 h 50)');
  /* 10 h 37 : le chrono arrêté sur le temps mis ; « Défi solo » plutôt que « Manche 1/1 ». 11 h 31 (Elisa : « ne pas mettre Voir la
     correction directement sur le défi mais sur l’écran de fin ») : la carte, sa suite (« Ton bilan arrive dans 5 s »), sa requête
     repliée ; ni correction, ni boutons de fin sur le défi */
  assert.match(s.html, /<b class="jeu-timer is-ok" id="jeu-timer" role="timer" aria-label="Résolu en 1 min 0[5-9]">01:0[5-9]<\/b>/, 'le chrono s’arrête sur le temps mis, au vert');
  assert.match(s.html, /<b class="jeu-hud-m">Défi solo<\/b>/); assert.doesNotMatch(s.html, /Manche 1<small>\/1|Manche 1\/1/);
  assert.match(s.html, /Tes points arrivent dans <b id="jeu-auto-n">\d+<\/b>/); assert.doesNotMatch(s.html, /jeu-done-sql|Voir ma requête/);   // 13 novembre, 20 h 33
  assert.doesNotMatch(s.html, /jeuCorrection\(|jeu-fin-actions|jeuRejouer\(/, 'rien de la fin sur le défi');
  assert.equal(s.ev('jeuLeaveQuestion()'), null, 'plus rien à perdre : on part sans question');
  sec(w, 10);
  assert.equal(s.view(), 'final', 'l’écran de fin');
  assert.equal(s.J('over'), true, 'la partie est finie');
  assert.ok(s.ev('state.salle.pts') > 0, 'les points comptent'); assert.equal(s.ev('state.salle.parties'), 1, 'une seule fois');
  /* L’écran de fin d’une manche : l’essentiel, sans redire la carte (ni « 1/1 résolu », ni son temps, ni ses points dans la ligne) */
  /* 12 h 17 (Elisa) : « Carton plein ! », « 1 manche, 1 victoire ! » ; le niveau dans le surtitre */
  assert.match(s.html, /<div class="l-kicker">Fin de la partie · Facile<\/div><h1>Carton plein( ! 🏆|\u00a0!)<\/h1><p class="l-sub" id="jeu-sub">1 manche, 1 victoire\u00a0!<\/p>/);
  assert.match(s.html, /<div class="jeu-bilan[^"]*is-2"><(span class="jeu-record".*?<\/span><)?div><b data-n="\d+">\d+<\/b><small>points<\/small><\/div><div><b>1 min 0[5-9]<\/b><small>ton temps<\/small><\/div><\/div>/);
  assert.match(s.html, /<p class="jeu-card-h">Ton récap’<\/p><ol class="jeu-rounds"><li class="jr is-ok"/);
  assert.doesNotMatch(s.html, /jr-n|jr-pts|Résolu en 1|1\/1/, 'ni « Manche 1 », ni ses points, ni son temps : le bandeau les dit');
  assert.match(s.html, /<button type="button" class="jr-corr" onclick="jeuCorrection\(0\)" aria-label="Voir la correction : [^"]+"><span>Voir la correction<\/span>/, 'la correction, sur l’écran de fin');
  assert.match(s.html, /<div class="jeu-fin-actions"><button type="button" class="jeu-prog is-m" onclick="jeuNiveauSuivant\(\)">.*?<span class="jeu-prog-t">Passer au niveau moyen<\/span>.*?<span>Rejouer<\/span>.*?<span>Quitter la salle<\/span>/s);
  sec(w, 30);
  assert.equal(s.ev('state.salle.parties'), 1, 'toujours une seule partie comptée');
  s.ev('jeuRejouer()'); sec(w, 0.5);
  assert.equal(s.view(), 'draw0', '« Rejouer » enchaîne');
});

test('solo : manche abandonnée ou temps écoulé = 0 point, le défi n’est pas marqué réussi', () => {
  const w = new World();
  const s = makeClient(w, 'Seul'); s.ev("jeuNb=1;jeuNiv='d'");
  s.ev("jeuStart('SOLO22',true,null,{solo:true})"); sec(w, 4);
  clore(s); sec(w, 1);
  /* La carte dit « Manche abandonnée », puis l’écran de fin (11 h 31) : « On retente ? », la correction, « Réessayer » */
  assert.equal(s.view(), 'play0'); assert.match(s.html, /<b class="coach-to-k">Manche abandonnée<\/b><p>Tu as quitté la manche avant ta réponse\.<\/p><\/div><\/div>/);
  assert.match(s.html, /Tes points arrivent dans/); assert.doesNotMatch(s.html, /jeuCorrection\(|jeuRetenter\(|id="ed-lesson"/);
  sec(w, 11);
  assert.equal(s.view(), 'final');
  assert.match(s.html, /<h1>Pas encore cette fois\u00a0!<\/h1><p class="l-sub" id="jeu-sub">Prêt·e à retenter ta chance\u00a0\?<\/p>/); assert.match(s.html, /<i class="jr-why">Abandonnée<\/i>/);
  assert.match(s.html, /onclick="jeuCorrection\(0\)"/); assert.match(s.html, /<span>Rejouer<\/span>/); assert.match(s.html, /onclick="jeuQuitterSalle\(\)">.*?<span>Quitter la salle<\/span>/s); assert.doesNotMatch(s.html, /Voir mon classement/);
  assert.doesNotMatch(s.html, /jeuRetenter\(|Changer de niveau|jeu-prog|Point obtenu|Non validée/);
  assert.equal(s.ev('state.salle.pts'), 0);
  assert.equal(s.ev('Object.keys(state.defis).length'), 0);
});

/* 9 novembre, 10 h 01 (Elisa : « pas de répétition de page, il faut vraiment l’essentiel ») : finie au chrono, une manche reste à
   l’écran, son encart dit « Temps écoulé ». 11 h 31 : puis l’écran de fin, une partie d’une seule manche comprise. */
test('seule dans sa salle, une manche, le chrono à 0 : « Temps écoulé » sur la carte, puis l’écran de fin, sa correction, la carte de la revanche (Quitter la salle, Revanche)', () => {
  const w = new World();
  const h = makeClient(w, 'Hôte'); h.ev("jeuNiv='f';jeuNb=1");
  h.host('ALONE9'); sec(w, 1);
  h.ev('jeuNextRound()'); sec(w, 4.5);
  assert.equal(h.view(), 'play0');
  sec(w, 10 * 60 + 1);
  assert.equal(h.view(), 'play0', 'la manche reste à l’écran');
  assert.match(h.html, /<section class="coach is-to jeu-done" id="jeu-done" aria-label="Temps écoulé" aria-live="polite">/);
  assert.match(h.html, /<b class="coach-to-k">Temps écoulé<\/b><p>La correction t’attend dans ton bilan\.<\/p><\/div><\/div>/);
  assert.match(h.html, /<b class="jeu-timer is-fin" id="jeu-timer" role="timer" aria-label="Temps écoulé">00:00<\/b>/, 'le chrono à 0, calme (10 h 37)');
  assert.match(h.html, /<b class="jeu-hud-m">Défi solo<\/b>/, 'seule dans sa salle, une manche : « Défi solo »');
  assert.match(h.html, /Tes points arrivent dans/);
  assert.doesNotMatch(h.html, /id="ed-lesson"|Point obtenu|La manche suivante|id="jeu-val"|jeuCorrection\(|jeu-fin-actions/, 'ni éditeur, ni valeur du défi, ni correction sur le défi');
  assert.equal(h.ev('jeuLeaveQuestion()'), null, 'rien à perdre : on part sans question');
  sec(w, 11);
  assert.equal(h.view(), 'final', 'l’écran de fin');
  assert.match(h.html, /<h1>Pas encore cette fois\u00a0!<\/h1>/);
  assert.match(h.html, /<div class="jeu-bilan is-2"><div><b data-n="0">0<\/b><small>point<\/small><\/div><div><b>—<\/b><small>ton temps<\/small><\/div><\/div>/);
  assert.match(h.html, /<i class="jr-why">Temps écoulé<\/i>/); assert.match(h.html, /onclick="jeuCorrection\(0\)"/);
  assert.match(h.html, /<b>On rejoue \?<\/b>/); assert.match(h.html, /Tu es seul·e dans la salle/); assert.match(h.html, /onclick="jeuRevanche\(\)"/); assert.match(h.html, /Quitter la salle/);
  assert.equal((h.html.match(/Quitter la salle/g) || []).length, 1, 'un seul « Quitter la salle » (13 novembre, 21 h 52)');
  assert.equal(h.J('over'), true, 'la fin de partie est partie');
  assert.equal(h.ev('state.salle.parties'), 1, 'la partie compte');
  /* 13 novembre, 21 h 52 : seule, « Revanche » relance aussitôt, et la manche part toute seule */
  h.ev('jeuRevanche()'); sec(w, 2);
  assert.equal(h.J('g'), 1, '« Revanche » : une nouvelle partie dans la même salle');
  assert.ok(/^(draw0|play0)$/.test(h.view()), 'la manche repart sans attendre : ' + h.view());
});

test('la bonne réponse qui revient par le fil de la salle (salle classée) fait passer l’encart au vert sur place ; avant, l’éditeur restait jusqu’à la suite', () => {
  const w = new World();
  const s = makeClient(w, 'Seul'); s.ev("jeuNb=2;jeuNiv='f'");
  s.ev("jeuStart('SOLO88',true,null,{solo:true})"); sec(w, 4);
  assert.equal(s.view(), 'play0'); assert.match(s.html, /id="ed-lesson"/);
  s.ev("jeuOnMsg({v:1,t:'found',pid:JEU.me,name:'Seul',g:JEU.g,n:0,ms:4000,u:'zzfound0001',s:JEU.sid})"); sec(w, 0.5);
  assert.equal(s.view(), 'play0');
  assert.match(s.html, /Bravo, défi résolu/); assert.doesNotMatch(s.html, /id="ed-lesson"/);
  assert.match(s.html, /La manche suivante démarre dans/);
});

test('le bilan d’une partie de 2 manches dit l’essentiel une fois : le niveau, le titre, points et défis résolus, chaque manche', () => {
  const w = new World();
  const s = makeClient(w, 'Seul'); s.ev("jeuNb=2;jeuNiv='f'");
  s.ev("jeuStart('SOLO89',true,null,{solo:true})"); sec(w, 4);
  sec(w, 30); s.ed.value = "SELECT 'faux'"; s.ev('jeuRun()'); sec(w, 1); s.found(); sec(w, 1);   // un essai manqué : pas de premier coup
  sec(w, 14); assert.equal(s.view(), 'play1');
  sec(w, 10 * 60 - 4);   // la carte : 6 s (13 novembre, 21 h 07)
  assert.equal(s.view(), 'play1'); assert.match(s.html, /Tes points arrivent dans/);
  sec(w, 11);
  assert.equal(s.view(), 'final');
  /* 10 h 37 (la relecture) : « Bien joué ! », le niveau sans point final ; toujours les trois cases du bandeau ; chaque manche a sa
     correction, plus de « Retenter ce défi » */
  assert.match(s.html, /<div class="l-kicker">Fin de la partie · Facile<\/div><h1>Bien joué\u00a0!<\/h1><p class="l-sub" id="jeu-sub">2 manches, 1 victoire\u00a0!<\/p>/);
  assert.match(s.html, /<div class="jeu-bilan"><div><b data-n="200">200<\/b><small>points<\/small><\/div><div><b>1\/2<\/b><small>résolu<\/small>.*?<\/div><div><b>3\d\u00a0s<\/b><small>temps moyen<\/small><\/div><\/div>/);
  assert.doesNotMatch(s.html, /défi sur|class="jeu-pd"|Tout trouvé|jeuRetenter\(|Retenter ce défi|Ton bilan/, 'ni phrase qui redit le bandeau, ni « Défi 200 » à côté de « +200 », ni « Retenter »');
  assert.match(s.html, /<i class="jr-time">Résolu en 3\d s<\/i><\/span>/, 'résolue en une trentaine de secondes, sans détail : seulement ses points');
  assert.equal((s.html.match(/class="jr-corr" onclick="jeuCorrection\(\d\)"/g) || []).length, 2, 'chaque manche a sa correction');
  assert.match(s.html, /class="jr is-miss".*?<span class="jr-ico" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><circle/s, 'la manquée, le réveil');
  assert.match(s.html, /onclick="jeuRejouer\(\)"><svg[^]*?<\/svg><span>Rejouer<\/span>/); assert.doesNotMatch(s.html, /jeu-prog/, 'pas tout résolu : pas de prochaine étape');
});

test('solo : en Moyen, la manche dure 15 min au plus (8 novembre, 8 h 52) ; trouvée à 8 min, elle rapporte encore 300 (+25 du premier coup)', () => {
  const w = new World();
  const s = makeClient(w, 'Seul'); s.ev("jeuNb=2;jeuNiv='m'");
  s.ev("jeuStart('SOLO44',true,null,{solo:true})"); sec(w, 4);
  sec(w, 8 * 60);
  assert.equal(s.view(), 'play0', 'à 8 min, on cherche encore');
  assert.equal(s.ev('jeuValeur(Date.now()-JEU.rounds[0].t1)'), 50, 'en Facile, le défi vaudrait 50 au-delà de 7 min');
  assert.equal(s.ev("jeuValeur(Date.now()-JEU.rounds[0].t1,'m')"), 300, 'en Moyen, les paliers durent 3 min : entre 6 et 9 min, 150 × 2');
  s.found(); sec(w, 1);
  assert.equal(s.ev('jeuRanking(0)[0].pts'), 325, '300, plus 25 du premier coup (le palier ×2 en Moyen, 6 novembre, 15 h ; le premier coup fixe, 8 novembre, 9 h 17)');
  s.ev('jeuNextRound()'); sec(w, 4);
  assert.match(s.html, /role="timer" aria-label="Temps restant de la manche">(15:00|14:5\d)<\/b>/, 'le chrono du Moyen part de 15:00');
  sec(w, 14.5 * 60); assert.equal(s.view(), 'play1', 'à 14 min 30, on cherche encore');
  sec(w, 31); assert.equal(s.view(), 'play1', 'à 15 min (le chrono à 0), la manche s’arrête et reste à l’écran (9 novembre, 10 h 01)');
  assert.match(s.html, /<b class="coach-to-k">Temps écoulé<\/b>/); assert.match(s.html, /Tes points arrivent dans <b id="jeu-auto-n">([1-9]|10)<\/b>/);
  sec(w, 10); assert.equal(s.view(), 'final', 'puis le bilan');
  assert.match(s.html, /class="jeu-bilan.*class="jr is-ok".*class="jr is-miss".*Temps écoulé.*jeuCorrection\(1\)/s, "le bilan : la manche trouvée, puis la manquée « Temps écoulé », et sa correction (10 h 37)");
  assert.equal(s.ev('state.salle.pts'), 325);
});

/* Elisa, 31 octobre, 17 h 53 : « laisse tomber le fait qu’un défi ne peut pas être rejoué s’il est réussi : il peut être rejoué, et ne
   pas mettre que ce sont des défis réussis ». Le tirage ne regarde plus ce que chacun a déjà trouvé : pas deux fois le même défi dans
   une partie, et de préférence pas déjà joué dans la salle. */
test('un défi déjà trouvé peut revenir au tirage : seul, tous les défis faciles déjà trouvés, la partie se joue', () => {
  const w = new World();
  const s = makeClient(w, 'Seul');
  s.ev("jeuNiv='f';jeuNb=3");
  s.ev("jeuChallenges('f').forEach(c=>state.defis[c.id]=true)");
  s.ev("jeuStart('SOLO33',true,null,{solo:true})"); sec(w, 1);
  assert.match(s.html, /Un défi au hasard, au niveau choisi\./);
  assert.doesNotMatch(s.html, /réussi/, 'plus de « pas encore réussi »');
  sec(w, 3);
  for (let n = 1; n < 3; n++) { clore(s); sec(w, 1); s.ev('jeuNextRound()'); sec(w, 4); }
  assert.equal(new Set(s.ev('JEU.rounds.map(r=>r.cid)')).size, 3, '3 manches faciles, tous les défis déjà trouvés, sans doublon');
});

test('entre amis : le tirage ignore ce que chacun a déjà trouvé ; l’arrivée ne transporte plus de liste', () => {
  const w = new World();
  const h = makeClient(w, 'Hôte'); h.ev("jeuNiv='f';jeuNb=1");
  const g = makeClient(w, 'Ami');
  const ids = h.ev("jeuChallenges('f').map(c=>c.id)");
  g.ev(`${JSON.stringify(ids.slice(0, 4))}.forEach(id=>state.defis[id]=true)`);
  h.host('OKOK42'); sec(w, 1);
  g.join('OKOK42'); sec(w, 3);
  assert.equal(h.ev('typeof jeuOkCount'), 'undefined'); assert.equal(h.ev('typeof jeuOkList'), 'undefined');
  assert.equal(h.ev("'okOf' in JEU"), false);
  const seen = new Set(h.ev(`(()=>{const original=Math.random,picks=[];try{for(let k=0,total=jeuChallenges('f').length;k<total;k++){Math.random=()=> (k+.5)/total;picks.push(jeuPick());}}finally{Math.random=original;}return picks;})()`));
  assert.equal(seen.size, ids.length, 'tous les défis faciles peuvent sortir, même ceux que l’ami a déjà trouvés');
  h.ev('jeuNextRound()'); sec(w, 1);
  assert.equal(g.J('rounds[0].cid'), h.J('rounds[0].cid'), 'le même défi chez l’ami');
  assert.match(g.html, /Tout le monde reçoit le même défi\./);
});

test('un défi trouvé dans la salle peut revenir après « Rejouer »', () => {
  const w = new World();
  const h = makeClient(w, 'Hôte'); h.ev("jeuNiv='f';jeuNb=1");
  h.host('OKOK43'); sec(w, 1);
  const g = makeClient(w, 'Ami'); g.join('OKOK43'); sec(w, 3);
  h.ev('jeuNextRound()'); sec(w, 4.5);
  const x = h.ev('JEU.rounds[0].cid');
  g.found(); sec(w, 2);
  assert.equal(g.ev(`state.defis['${x}']`), true, 'trouvé par l’ami (sa progression le garde)');
  clore(h); sec(w, 1); h.ev('jeuFinish()'); sec(w, 1); h.ev('jeuAgain()'); sec(w, 1);
  h.ev('JEU.recent.clear()');
  const seen = new Set(h.ev(`(()=>{const original=Math.random,picks=[];try{for(let k=0,total=jeuChallenges('f').length;k<total;k++){Math.random=()=> (k+.5)/total;picks.push(jeuPick());}}finally{Math.random=original;}return picks;})()`));
  assert.ok(seen.has(x), 'trouvé, il peut revenir');
});

/* Elisa, 31 octobre, 16 h 29 : « si personne ne rejoint la salle, alors c’est comme si on est seule ». */
test('salle entre amis sans personne : la partie se joue comme seul (écran, points, bilan)', () => {
  const w = new World();
  const h = makeClient(w, 'Hôte'); h.ev("jeuNiv='f';jeuNb=2");
  h.host('ALONE1'); sec(w, 1);
  assert.equal(h.view(), 'lobby');
  /* 13 h 41 (Elisa : « oui il peut lancer seul ») : seul dans sa salle, « Lancer la partie » lance, et la partie se joue comme seul */
  assert.equal(h.ev('jeuPeutLancer()'), true, '13 h 41 : « oui il peut lancer seul »');
  assert.equal(h.ev('jeuLobbyEtatHTML()'), '', '20 h 12 : plus de carte sous les joueurs'); assert.equal(h.ev('jeuBadgeHTML()'), '1/6');
  assert.equal(h.ev('jeuLobbyLabel()'), 'Jouer en solo', '14 h 09 : seul, le bouton dit « Jouer en solo »');
  h.ev('jeuLancer()'); sec(w, 4.5);
  assert.equal(h.view(), 'play0');
  assert.equal(h.J('rounds[0].one'), true, 'la manche commence seule');
  /* 9 novembre, 7 h 16 (« quand il y a personne dans la salle, ça se transforme en solo automatiquement ») : seul, la tête de
     « Joue seul », sans « En direct » ni commentateur (avant, 8 novembre, 17 h 08 : « En direct » restait, même seul) */
  assert.match(h.html, /<section class="jeu-direct is-seul" aria-label="Manche 1 sur 2"><div class="jeu-direct-bande"><div class="jeu-hud">/);
  assert.doesNotMatch(h.html, /id="jeu-direct"|jeu-direct-dit|Qui ouvrira le score/);
  assert.doesNotMatch(h.html, /jeu-reacts|jeu-mini|seul·e dans la salle/, 'rien d’autre des écrans à plusieurs (réactions, « Clore la manche pour tous »)');
  assert.equal(h.ev('jeuReagirLa()'), false, 'seul dans la salle, pas de « Réagir », comme en « Joue seul » (9 novembre, 7 h 16 ; avant, 19 h 12 : « visible même seule »)');
  h.found(); sec(w, 1);
  assert.ok(!h.toasts.some(t => /tête|course|affilée|minute|Remontée/.test(t)), 'seul : le commentateur se tait');
  assert.equal(h.view(), 'play0', 'seul : la manche reste, en vert (9 novembre, 8 h 20 ; avant, ses résultats tout de suite)');
  assert.match(h.html, /Bravo, défi résolu/); assert.match(h.html, /La manche suivante démarre dans/); assert.doesNotMatch(h.html, /Classement de la manche|\(toi\)|En attente des autres|jeu-reacts/);
  const x = h.ev('jeuRanking(0)[0]');
  assert.equal(x.rang, 0, 'pas de bonus de rang quand on est seul'); assert.equal(x.pts, x.val + x.essai); assert.equal(x.essai, 25);
  h.ev('jeuNextRound()'); sec(w, 4.5); h.found(); sec(w, 1);
  h.ev('jeuFinish()'); sec(w, 1.5);
  assert.equal(h.view(), 'final');
  assert.match(h.html, /Carton plein|Bien joué|Pas encore cette fois/, 'le bilan, pas le podium');
  assert.doesNotMatch(h.html, /jeu-podium|Tu as gagné/);
  assert.match(h.html, /onclick="jeuRevanche\(\)"/); assert.match(h.html, /Quitter la salle/);
  assert.equal(h.ev('state.salle.hist[0].solo'), 1, 'notée « Seul » dans Tes performances');
});

test('un ami arrive pendant une manche commencée seul : « En direct » apparaît, la manche reste sans bonus de rang', () => {
  const w = new World();
  const h = makeClient(w, 'Hôte'); h.ev("jeuNiv='f';jeuNb=1");
  h.host('ALONE2'); sec(w, 1);
  /* 8 novembre, 16 h 05 : on n’entre plus une fois la partie lancée ; l’ami était dans la salle d’attente, il en était sorti */
  const avant = makeClient(w, 'Ami'); avant.join('ALONE2'); sec(w, 2);
  const gpid = avant.pid(); avant.ev('jeuStop()'); sec(w, 40);
  h.ev('jeuNextRound()'); sec(w, 4.5);
  assert.equal((h.ev('jeuDirectHTML(0)').match(/<b class="jeu-av/g) || []).length, 1, 'seul : « En direct » est déjà là, avec son avatar (17 h 08)');
  const g = samePid(w, 'Ami', gpid); g.join('ALONE2'); sec(w, 4);
  assert.equal(g.view(), 'play0', 'il arrive dans la manche');
  assert.match(h.html, /<section class="jeu-direct" id="jeu-direct"/, 'chez l’hôte, « En direct » le montre (sans perdre la requête en cours)');
  assert.match(g.html, /<section class="jeu-direct" id="jeu-direct"/);
  g.found(); sec(w, 1);
  assert.equal(h.view(), 'play0');
  assert.equal(h.ev('jeuRanking(0)[0].rang'), 0, 'commencée seule : pas de bonus de rang, le même chez tous');
  assert.equal(g.ev('jeuRanking(0)[0].rang'), 0);
  assert.match(g.html, /class="coach is-ok jeu-done"/); assert.match(g.html, /Bravo, défi résolu/); assert.match(g.html, /En attente des autres…<\/b><small>Hôte cherche encore<\/small>/);
  const d = h.ev('jeuDirectHTML(0)'), av = /id="jeu-direct-av" aria-hidden="true">(.*?)<\/div><span class="jeu-sr"/.exec(d)[1];
  assert.equal((av.match(/<b class="jeu-av/g) || []).length, 2, 'un avatar par joueur');
  assert.match(av, /^<span class="jd-j is-ok is-premier" data-pid="[\w-]+" data-c="1" data-n="([1-9]\d*)"><b class="jeu-av" data-c="1">A<i class="jd-av-b is-roi[^"]*"><svg/, 'l’ami d’abord, la couronne (même couleur qu’en salle d’attente), ses points');
  assert.match(av, /<span class="jd-j is-pense is-moi" data-pid="[\w-]+" data-c="0" data-n="0"><b class="jeu-av" data-c="0">H<\/b><span class="jd-j-pts"><b class="jd-pts" data-n="0" data-fmt="fr">0<\/b><small>\u00a0pt<\/small><\/span><\/span>$/, 'toi ensuite, en réflexion, 0 point');
  assert.equal(h.ev('JEU.dit.cur.html'), '<b>Ami</b> ouvre le score\u00a0!', 'le commentateur l’a dit, même pendant que la rangée n’était pas redessinée');
  assert.match(d, /<span class="jeu-sr" id="jeu-direct-qui">Ami\u00a0: trouvé en premier, [\d\u202f\u00a0]+\u00a0points ; Toi\u00a0: en réflexion, 0\u00a0point<\/span>/);
  const tete = h.ev('jeuDirectJoueurs(0)[0]');
  assert.ok(tete.chef && tete.gain > 0 && tete.essais === 1 && tete.monte === 1, 'en tête, ce que la manche lui rapporte, un essai, une place gagnée');
  assert.doesNotMatch(d, /jeu-direct-ok|1\/2/, '21 h 29 : plus de « 1/2 » dans la barre');
  assert.doesNotMatch(d, /SELECT|ex-code|<table/i, 'jamais la requête ni le résultat des autres');
});

/* « En direct » (8 novembre, 11 h 33) : les essais des autres comptent chez tous, sans jamais montrer leur requête. */
test('« En direct » : les essais manqués des autres comptent chez tous, la ligne de celui qui trouve passe en tête', () => {
  const { w, host, guests } = room({ n: 3 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  assert.equal(host.view(), 'play0');
  assert.match(host.html, /<section class="jeu-direct" id="jeu-direct" aria-labelledby="jeu-direct-t">/);
  const g = guests[0], gp = JSON.stringify(g.pid()), lui = c => c.ev(`jeuDirectJoueurs(0).find(x=>x.pid===${gp})`);
  g.ed.value = "SELECT 'faux'"; g.ev('jeuRun()'); sec(w, 0.5);
  g.ed.value = "SELECT 'encore faux'"; g.ev('jeuRun()'); sec(w, 0.5);
  assert.equal(lui(host).essais, 2, 'deux essais, vus par l’hôte'); assert.equal(lui(host).etat, 'test', 'il teste sa requête');
  assert.equal(lui(guests[1]).essais, 2, 'et par l’autre ami');
  assert.equal(lui(g).essais, 2, 'chez lui, le même compte'); assert.equal(lui(g).etat, 'test', 'chez lui aussi : « Teste sa requête » (8 novembre, 18 h 18)');
  sec(w, 4); assert.equal(lui(host).etat, 'pense', 'le geste passe (3,2 s)');
  g.found(); sec(w, 1);
  const tete = host.ev('jeuDirectJoueurs(0)[0]');
  assert.equal(tete.pid, g.pid(), 'qui a trouvé passe devant'); assert.equal(tete.essais, 3); assert.equal(tete.etat, 'ok'); assert.ok(tete.chef, 'la couronne');
  assert.ok(tete.gain > 0 && tete.pts === tete.gain, 'ses points de la manche');
  assert.equal(host.ev('jeuDirectJoueurs(0).filter(x=>x.chef).length'), 1);
  const d = host.ev('jeuDirectHTML(0)');
  assert.doesNotMatch(d, /faux|SELECT/, 'jamais sa requête');
  assert.equal((d.match(/<b class="jeu-av/g) || []).length, 3, 'trois avatars'); assert.match(d, /<i class="jd-av-b is-roi/, 'la couronne sur celui qui a trouvé');
});

/* 8 novembre, 12 h 25 : le commentateur, la série, les réactions, de bout en bout */
test('« En direct » raconte la partie : qui ouvre le score, qui reste en course, la série d’une manche à l’autre ; pas les essais (9 novembre)', () => {
  const { w, host, guests } = room({ n: 3, nb: 2 });
  const [a1, a2] = guests, dit = c => c.ev('JEU.dit&&JEU.dit.cur?JEU.dit.cur.html:""'), nb = ' ';
  host.ev('jeuNextRound()'); sec(w, 4.5);
  assert.equal(dit(host), `C’est parti${nb}! Qui ouvrira le score${nb}?`);
  a1.ed.value = "SELECT 'faux'"; a1.ev('jeuRun()'); sec(w, 0.6);
  for (const c of [host, a2, a1]) assert.equal(dit(c), `C’est parti${nb}! Qui ouvrira le score${nb}?`, 'son essai manqué n’est dit nulle part (9 novembre, 2 h 11)');
  assert.ok(!host.toasts.some(t => t.includes('pas encore')), 'ni au lecteur d’écran');
  sec(w, 2.5); a1.found(); sec(w, 3);
  assert.equal(dit(host), `<b>Ami1</b> ouvre le score${nb}!`);
  a2.found(); sec(w, 3);
  assert.equal(dit(host), `Plus que toi en course, courage${nb}!`, 'à l’hôte, le dernier');
  assert.equal(dit(a1), `Plus que <b>Hôte</b> en course…`);
  assert.ok(host.toasts.includes(`Plus que toi en course, courage${nb}!`), 'dit au lecteur d’écran');
  /* Ami1 réagit (il a trouvé) : chez l’hôte, dit au lecteur d’écran ; à l’écran, la bulle sur son avatar */
  a1.ev("JEU.lastReact=0;jeuReact('👏')"); sec(w, 1);
  assert.ok(host.toasts.includes('Ami1 👏'));
  host.found(); sec(w, 0.5);
  assert.equal(dit(host), `Tout le monde a trouvé${nb}!`, 'le dernier trouve : plus de « Plus que toi en course » pendant que son encart passe au vert (9 novembre, 9 h 04)');
  assert.ok(host.toasts.includes(`Tout le monde a trouvé${nb}!`), 'dit au lecteur d’écran');
  sec(w, 2);   // l’encart vert un instant (9 novembre, 8 h 20)
  assert.equal(host.view(), 'res0');
  host.ev('jeuNextRound()'); sec(w, 4.5);
  assert.equal(dit(host), `Manche 2, c’est reparti${nb}!`);
  a1.found(); sec(w, 3);
  assert.equal(dit(host), `2 d’affilée pour <b>Ami1</b>${nb}!`, 'la série');
  assert.equal(host.ev(`jeuDirectJoueurs(1).find(x=>x.pid===${JSON.stringify(a1.pid())}).serie`), 2, 'sa série : deux manches');
  assert.match(host.ev('jeuDirectHTML(1)'), new RegExp(`data-pid="${a1.pid().replace(/[^\w-]/g, '')}" data-c="\\d" data-n="\\d+"><b class="jeu-av" data-c="\\d">A<i class="jd-av-b is-roi`), 'la couronne : premier de la manche');
});

/* 8 novembre, 12 h 07 : « Quand il écrit dans la zone de requête ? » */
test('« En direct » : « Écrit sa requête » tant qu’il tape, sans jamais envoyer son texte ni rien garder', () => {
  const { w, host, guests } = room({ n: 3 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  const g = guests[0], gp = JSON.stringify(g.pid()), lui = c => c.ev(`jeuDirectJoueurs(0).find(x=>x.pid===${gp})`).etat;
  const posts = w.posts, hist = w.histCalls;
  sec(w, 1); assert.equal(lui(host), 'pense', 'la manche commence : en réflexion');
  g.ed.value = 'SELECT nom FROM cl'; sec(w, 1);
  assert.equal(lui(host), 'ecrit', 'l’hôte le voit écrire'); assert.equal(lui(guests[1]), 'ecrit', 'l’autre ami aussi');
  assert.equal(w.signals.length, 1, 'un seul signal');
  assert.deepEqual(w.signals[0], { type: 'broadcast', event: 'ecrit', payload: { v: 1, t: 'ecrit', pid: g.pid(), g: 0, n: 0 } }, 'qui, quelle manche : rien d’autre');
  assert.doesNotMatch(JSON.stringify(w.signals), /SELECT|nom|FROM/, 'jamais son texte');
  for (let i = 0; i < 8; i++) { g.ed.value += 'i'; sec(w, 0.5); }
  assert.equal(lui(host), 'ecrit');
  assert.ok(w.signals.length >= 2 && w.signals.length <= 3, `au plus un signal toutes les 3 s (${w.signals.length} en 4 s)`);
  assert.equal(w.posts - posts < 3, true, 'rien par la base (seulement les signes de vie)');
  assert.ok(w.histCalls - hist < 4, 'ni relecture de la salle à chaque signal');
  sec(w, 6); assert.equal(lui(host), 'pense', 'il s’arrête : « En réflexion » au bout de 5 s');
  const avant = w.signals.length;
  host.ev('jeuPaint()'); sec(w, 1); assert.equal(w.signals.length, avant, 'un redessin chez lui ou ailleurs n’envoie rien');
  g.ed.value = "SELECT 'faux'"; sec(w, 0.6); assert.equal(lui(host), 'ecrit');
  g.ev('jeuRun()'); sec(w, 0.5); assert.equal(lui(host), 'test', 'il exécute : « Teste sa requête »');
  sec(w, 3.5); assert.equal(lui(host), 'pense', 'puis en réflexion (il n’écrit plus)');
  host.ed.value = 'SELECT 1'; sec(w, 1);
  assert.equal(host.ev('jeuDirectJoueurs(0).find(x=>x.me)').etat, 'ecrit', 'sa propre ligne aussi : « Écrit sa requête » (8 novembre, 18 h 18)');
  assert.equal(lui(g) , 'pense'); assert.equal(g.ev(`jeuDirectJoueurs(0).find(x=>x.pid===${JSON.stringify(host.pid())})`).etat, 'ecrit', 'l’ami voit l’hôte écrire');
  g.found(); sec(w, 1); const n = w.signals.length;
  g.ed.value = 'autre chose'; sec(w, 4); assert.equal(w.signals.length, n, 'trouvé : plus rien ne part');
});

test('« il écrit » : seul, ou seul dans la salle, rien ne part ; un signal d’un inconnu ou d’une autre manche ne change rien', () => {
  const w = new World();
  const h = makeClient(w, 'Hôte'); h.ev("jeuNiv='f';jeuNb=1");
  h.host('ALONE3'); sec(w, 1); h.ev('jeuNextRound()'); sec(w, 4.5);
  h.ed.value = 'SELECT'; sec(w, 1); h.ed.value = 'SELECT *'; sec(w, 1);
  assert.equal(w.signals.length, 0, 'seul dans la salle');
  const { w: w2, host, guests } = room({ n: 2 });
  host.ev('jeuNextRound()'); sec(w2, 4.5);
  const gp = guests[0].pid(), seq = host.ev('JSON.stringify(JEU.seq)'), seen = host.ev('JSON.stringify(JEU.seen)');
  host.ev(`jeuOnMsg({v:1,t:'ecrit',pid:'INCONNU1',g:0,n:0})`); host.ev(`jeuOnMsg({v:1,t:'ecrit',pid:${JSON.stringify(gp)},g:3,n:0})`);
  assert.equal(host.ev(`JSON.stringify(JEU.ecritAt||{})`), '{}');
  host.ev(`jeuOnMsg({v:1,t:'ecrit',pid:${JSON.stringify(gp)},g:0,n:0})`);
  assert.equal(host.ev(`jeuDirectJoueurs(0).find(x=>x.pid===${JSON.stringify(gp)}).etat`), 'ecrit');
  assert.equal(host.ev('JSON.stringify(JEU.seq)'), seq, 'hors de l’ordre du relais'); assert.equal(host.ev('JSON.stringify(JEU.seen)'), seen, 'ce n’est pas un signe de vie');
  /* Un message déguisé en « il écrit » sur le canal public : on n’en garde que qui et quelle manche */
  guests[0].ws.send(JSON.stringify({ topic: 'realtime:salle:ROOM42', event: 'broadcast', payload: { type: 'broadcast', event: 'ecrit', payload: { v: 1, t: 'found', pid: gp, g: 0, n: 0, ms: 1, sql: 'SELECT 1' } }, ref: '99' }));
  sec(w2, 1);
  assert.equal(host.ev(`JEU.rounds[0].found[${JSON.stringify(gp)}]`), undefined, 'pas un « trouvé »');
  assert.equal(host.ev(`jeuDirectJoueurs(0).find(x=>x.pid===${JSON.stringify(gp)}).etat`), 'ecrit');
});

test('un défi précis (« Avec des amis » sur sa page) ouvre la salle comme première manche', () => {
  const w = new World();
  const h = makeClient(w, 'Hôte'); h.ev('jeuNb=3');
  h.ev("jeuStart('PICK55',true,'tm1',{nomId:'jeu-nom'})"); sec(w, 1);
  const g = makeClient(w, 'Ami'); g.join('PICK55'); sec(w, 3);
  h.ev('jeuNextRound()'); sec(w, 1);
  assert.equal(h.J('rounds[0].cid'), 'tm1'); assert.equal(g.J('rounds[0].cid'), 'tm1');
  assert.equal(h.J('niv'), 'm', 'le niveau suit le défi choisi');
});

/* Elisa, 31 octobre, 1 h 34 : « le bouton Défis pour retourner ne marche pas ». La question passait par confirm(), que la page
   ne montrait pas toujours : le retour restait sans effet. Maintenant, la fenêtre de l’appli (lqAsk), puis on part vraiment. */
test('quitter une salle : la fenêtre de l’appli, seulement quand il y a quelque chose à perdre, et « Quitter » fait partir', () => {
  const { w, host, guests } = room({ n: 3 });
  const asks = []; let answer = false, left = 0;
  host.ctx.lqAsk = q => { asks.push(q.titre); return { then: f => f(answer) }; };
  host.ctx.__left = () => { left++; };
  assert.equal(guests[0].ev('jeuLeaveOk()'), true, 'un ami en salle d’attente part sans question');
  assert.equal(host.ev('jeuLeaveOk()'), false, 'hôte avec des amis dans la salle');
  host.ev('jeuLeaveAsk(()=>__left())');
  assert.deepEqual(asks, ['Quitter la salle ?']); assert.equal(left, 0, '« Rester » : on reste');
  host.ev('jeuNextRound()'); sec(w, 1);
  assert.equal(host.ev('jeuLeaveOk()'), false, 'pendant le tirage');
  answer = true; host.ev('jeuLeaveAsk(()=>__left())');
  assert.equal(left, 1, '« Quitter » : on part');
  assert.equal(host.ev('jeuLeaveOk()'), true, 'accepté une fois : on ne redemande pas');
  assert.ok(html.includes("if(mode==='jeu'&&!jeuLeaveOk()){jeuLeaveAsk(goBack);return;}"), 'le bouton retour passe par la fenêtre');
  assert.ok(!engineSrc.includes('confirm('), 'plus de confirm() dans la salle');
  const solo = makeClient(w, 'Seul'); let a2 = 0, gone = 0;
  solo.ctx.lqAsk = q => { a2++; return { then: f => f(true) }; }; solo.ctx.__left = () => { gone++; };
  solo.ev("jeuStart('SOLO44',true,null,{solo:true})"); sec(w, 5);
  assert.equal(solo.ev('jeuLeaveOk()'), false, 'manche en cours, même seul');
  solo.ev('jeuLeaveAsk(()=>__left())'); assert.equal(a2, 1); assert.equal(gone, 1);
});

test('toutes les vues se dessinent sans erreur (échappement des pseudos compris)', () => {
  const w = new World();
  const host = makeClient(w, 'Hôte'); host.ev('jeuNb=3'); host.host('VIEWS1'); sec(w, 1);
  const evil = makeClient(w, '<img src=x onerror=alert(1)>'); evil.join('VIEWS1'); sec(w, 4);
  const seen = new Set();
  const grab = () => { seen.add(host.view().replace(/\d+$/, '')); return host.html; };
  const lobby = grab(); assert.doesNotMatch(lobby, /<img/);
  host.ev('jeuNextRound()'); sec(w, 1); grab();
  sec(w, 4); const play = grab(); assert.match(play, /class="jeu-direct/); assert.doesNotMatch(play, /jeu-reacts|jeu-mini/, 'pendant qu’on cherche : rien que la manche');
  /* 8 novembre, 18 h 36 puis 19 h 37 : « Réagir », un seul bouton, posé en bas à droite de l’écran, hors de la manche qui défile */
  assert.equal(host.ev('jeuReagirLa()'), true); assert.doesNotMatch(play, /jeu-reagir/);
  assert.doesNotMatch(play, /<img/);
  host.found(); sec(w, 1); const wait = grab(); assert.match(wait, /class="coach is-ok jeu-done"/); assert.match(wait, /Bravo, défi résolu/); assert.match(wait, /En attente des autres…<\/b><small>.* cherche encore<\/small>/); assert.match(wait, /jeu-reacts/); assert.doesNotMatch(wait, /Clore la manche|jeu-hostbar/, '9 novembre, 8 h 42 : l’hôte n’a plus la main pour clore la manche');
  assert.doesNotMatch(wait, /id="ed-lesson"/, 'la carte « Trouvé » remplace l’éditeur');
  evil.found(); sec(w, 2); const res = grab(); assert.match(res, /<p class="jeu-card-h">Classement<\/p>/); assert.doesNotMatch(res, /<img/);
  clore(host); host.ev('jeuNextRound()'); sec(w, 5); clore(host); sec(w, 1);
  host.ev('jeuNextRound()'); sec(w, 5); clore(host); sec(w, 1);
  host.ev('jeuFinish()'); sec(w, 1);
  const fin = grab(); assert.match(fin, /class="jeu-podium"/); assert.doesNotMatch(fin, /Classement final/, 'deux joueurs, tous deux sur le podium : pas de liste en double');
  assert.deepEqual([...seen].sort(), ['draw', 'final', 'lobby', 'play', 'res']);
});

test('un ami dont la réception est coupée (mais qui envoie encore) ne vole pas la main à l’hôte', () => {
  const { w, host, guests } = room({ n: 3 });
  guests[0].deaf = true;               /* il n’entend plus rien : l’hôte lui paraît absent */
  sec(w, 90);
  assert.equal(guests[0].ev('jeuIsHost()'), false, 'il ne se déclare pas hôte');
  assert.equal(host.ev('jeuIsHost()'), true);
  assert.equal(guests[1].J('hostPid'), host.pid());
  guests[0].deaf = false; guests[0].reconnect(); sec(w, 25);
  assert.equal(guests[0].J('hostPid'), host.pid(), 'tout redevient normal à son retour');
  assert.ok(guests[0].live().includes('Hôte'));
});

const samePid = (w, name, pid) => { const c = makeClient(w, name); c.ev(`sessionStorage.setItem('rq-jeu-pid',${JSON.stringify(pid)})`); return c; };

test('une manche terminée le reste : un arrivant ne rouvre rien, les scores gardent les manches passées', () => {
  const { w, host, guests } = room({ n: 3, nb: 3 });
  /* 8 novembre, 16 h 05 : l’arrivant était dans la salle d’attente, il revient (un nouveau venu n’entrerait plus) */
  const avant = makeClient(w, 'Retard'); avant.join('ROOM42'); sec(w, 2);
  const lpid = avant.pid(); avant.ev('jeuStop()'); sec(w, 2);
  host.ev('jeuNextRound()'); sec(w, 4.5); host.found(); guests[0].found(); guests[1].found(); sec(w, 2.5);   // l’encart vert un instant
  assert.equal(host.view(), 'res0');
  const late = samePid(w, 'Retard', lpid); late.join('ROOM42'); sec(w, 2);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'res0', c.name + ' reste sur les résultats');
  assert.match(host.html, /La manche suivante démarre dans/);
  sec(w, 8);   // 17 h 31 : la suite part toute seule, 5 s après
  for (const c of [host, ...guests, late]) assert.equal(c.view(), 'play1', c.name);
  host.found(); late.found(); guests[0].found(); guests[1].found(); sec(w, 2);
  const sc = host.ev('jeuScores().map(x=>x.name+":"+x.pts)');
  assert.ok(sc.length === 4 && sc.every(x => !/:0$/.test(x)), 'les points des deux manches : ' + sc);
});

/* 9 novembre, 8 h 42 (Elisa) : « La manche se clôt seule quand tout le monde a trouvé ; l’hôte n’a pas la main pour la clore ; elle
   termine au mieux au chrono si personne n’a trouvé. » */
test('la manche se clôt seule quand tout le monde a trouvé, sinon à la fin du chrono ; l’hôte n’a pas la main pour la clore', () => {
  const { w, host, guests } = room({ n: 2, nb: 2 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  host.found(); sec(w, 3);
  assert.equal(host.view(), 'play0', 'un ami cherche encore : la manche continue');
  assert.doesNotMatch(host.html, /Clore la manche|jeu-hostbar|jeu-mini/, 'pas de bouton pour la clore');
  assert.equal(host.ev('typeof jeuClose'), 'undefined');
  sec(w, 150);
  assert.equal(host.view(), 'play0', '2 min 30 plus tard, toujours en cours (avant, l’hôte pouvait la clore 2 min après le premier)');
  assert.doesNotMatch(host.html, /Clore la manche/);
  guests[0].found(); sec(w, 2.5);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'res0', c.name + ' : tout le monde a trouvé, elle se clôt seule');
  sec(w, 10);
  assert.equal(host.view(), 'play1', 'la suivante part toute seule');
  sec(w, 10 * 60);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'play1', c.name + ' : personne n’a trouvé, elle finit au chrono');
  assert.match(guests[0].html, /Temps écoulé/); assert.match(guests[0].html, /Tes points arrivent dans/, '13 novembre, 17 h 31 : « Temps écoulé », puis les points');
  sec(w, 6);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'final', c.name + ' : puis l’écran de fin (13 novembre)');
  assert.match(guests[0].html, /<i>1 défi trouvé sur 2<\/i>/, 'la manche finie au chrono compte, sans être trouvée');
  assert.match(guests[0].html, /<h1 id="jr2-t">Bien joué\u00a0!<\/h1><p class="jr2-defi" id="jeu-sub">Hôte l’emporte de \d+\u00a0points?\. À toi la revanche\u00a0!<\/p>/, 'la défaite, qui encourage (18 h 35) : qui l’emporte et de combien');
  assert.match(host.html, /<h1 id="jr2-t">Tu as gagné\u00a0!<\/h1><p class="jr2-defi" id="jeu-sub">Devant Ami1, de \d+\u00a0points?\.<\/p>/, 'la victoire : devant qui et de combien');
  assert.doesNotMatch(guests[0].html, /close par l’hôte/);
});

test('un temps reçu pendant les résultats met le classement à jour (sans rouvrir la manche)', () => {
  const { w, host, guests } = room({ n: 3 });
  host.ev('jeuNextRound()'); sec(w, 4.5); clore(host); sec(w, 1);
  assert.equal(host.view(), 'res0');
  guests[0].ev('jeuSend({t:"found",n:0,ms:5000})'); sec(w, 2);
  assert.equal(host.view(), 'res0');
  assert.equal(host.ev('jeuRanking(0).length'), 1, 'le temps tardif est classé');
});

test('l’hôte revient dans sa salle avec le même pseudo d’appareil : il la retrouve et reste hôte', () => {
  const { w, host, guests } = room({ n: 2 });
  const pid = host.pid(); host.ev('jeuStop()'); sec(w, 2);
  const back = samePid(w, 'Hôte', pid); back.join('ROOM42'); sec(w, 6);
  assert.equal(back.view(), 'lobby', 'il retrouve sa salle');
  assert.ok([pid, guests[0].pid()].includes(back.J('hostPid')), 'un hôte existe : lui, ou l’ami qui a pris la main pendant son absence');
});

test('retour avec le même pseudo en pleine manche : son temps déjà trouvé est retrouvé', () => {
  const { w, host, guests } = room({ n: 3 });
  host.ev('jeuNextRound()'); sec(w, 4.5); guests[0].found(); sec(w, 1);
  const pid = guests[0].pid(); guests[0].ev('jeuStop()'); sec(w, 2);
  const back = samePid(w, 'Ami1', pid); back.join('ROOM42'); sec(w, 5);
  assert.equal(back.view(), 'play0');
  assert.notEqual(back.J('rounds[0].found[JEU.me]'), undefined, 'son temps est restitué');
  assert.match(back.html, /Bravo, défi résolu/); assert.match(back.html, /Résolu en <b>/);
});

/* Les promesses (réponses du relais) ne se résolvent qu’entre deux avances de l’horloge. */
const secA = async (w, s) => { for (let i = 0; i < s * 2; i++) { w.advance(500); await new Promise(r => setImmediate(r)); } };
test('un envoi refusé par le relais est renvoyé : arrivée, manche et « trouvé » finissent par passer', async () => {
  const w = new World();
  const host = makeClient(w, 'Hôte'); host.ev('jeuNb=3'); host.host('RETRY1'); await secA(w, 1);
  const g = makeClient(w, 'Ami'); g.failPosts = 2; g.join('RETRY1'); await secA(w, 14);
  assert.equal(g.view(), 'lobby', 'le hello a fini par passer');
  assert.deepEqual(host.live(), ['Hôte', 'Ami']);
  host.failPosts = 1; host.ev('jeuNextRound()'); await secA(w, 8);
  assert.ok(g.J('rounds[0]'), 'la manche arrive chez l’ami malgré un premier refus');
  await secA(w, 4); g.failPosts = 1; g.found(); await secA(w, 8);
  assert.notEqual(host.J('rounds[0].found["' + g.pid() + '"]'), undefined, 'son « trouvé » arrive chez l’hôte');
  assert.equal(g.J('net'), true, 'la connexion est de nouveau annoncée bonne');
  assert.equal(g.J('out.length'), 0, 'plus rien en attente d’envoi');
});

test('hôte figé un moment (partage du code) : il revient avant d’être remplacé', () => {
  const { w, host, guests } = room({ n: 3 });
  host.offline = true; sec(w, 65); host.offline = false; host.reconnect(); host.ev('jeuResume()'); sec(w, 40);
  for (const g of guests) assert.equal(g.J('hostPid'), host.pid(), g.name + ' : toujours le même hôte');
  assert.equal(host.ev('jeuIsHost()'), true);
});

test('le plus ancien ami est sourd : le suivant prend la main un peu plus tard', () => {
  const { w, host, guests } = room({ n: 3 });
  guests[0].deaf = true; host.offline = true; sec(w, 130);
  assert.equal(guests[0].ev('jeuIsHost()'), false);
  assert.equal(guests[1].ev('jeuIsHost()'), true, 'le deuxième plus ancien a pris la main');
});

test('rejeu après reconnexion : un joueur parti n’est pas « ressuscité »', () => {
  const { w, host, guests } = room({ n: 3 });
  host.deaf = true; sec(w, 6); guests[1].offline = true; sec(w, 70);
  assert.ok(!host.live().includes('Ami2') || true);
  host.deaf = false; host.reconnect(); sec(w, 12);
  assert.deepEqual(host.live(), ['Hôte', 'Ami1'], 'Ami2 reste absent après le rejeu');
});

test('téléphone dont l’horloge avance de 8 s : il rejoint une manche en cours avec le bon temps', () => {
  const w = new World();
  const host = makeClient(w, 'Hôte'); host.host('SKEW88'); sec(w, 1);
  const g = makeClient(w, 'Ami'); g.join('SKEW88'); sec(w, 3);
  /* 8 novembre, 16 h 05 : il était dans la salle d’attente, il revient en pleine manche */
  const avant = makeClient(w, 'Avance', { skew: 8000 }); avant.join('SKEW88'); sec(w, 3);
  const fpid = avant.pid(); avant.ev('jeuStop()'); sec(w, 2);
  host.ev('jeuNextRound()'); sec(w, 20);
  const fast = makeClient(w, 'Avance', { skew: 8000 }); fast.ev(`sessionStorage.setItem('rq-jeu-pid',${JSON.stringify(fpid)})`); fast.join('SKEW88'); sec(w, 4);
  assert.equal(fast.view(), 'play0', 'pas de tirage sauté ni de manche déjà finie');
  const left = fast.ev('Math.round((JEU.rounds[0].t1+180000-Date.now())/1000)');
  assert.ok(left > 140 && left < 170, 'temps restant cohérent : ' + left);
});

test('pseudos : invisibles retirés, initiale d’emoji entière, élision, code collé', () => {
  const w = new World(), c = makeClient(w, 'x');
  assert.equal(c.ev("jeuNom('\u200b\u2800  Lé\u202eo \u3164')"), 'Léo');
  assert.equal(c.ev("jeuNom('😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀').length"), 32);
  assert.equal(c.ev("jeuInitial('😀 Léa')"), '😀');
  assert.equal(c.ev("jeuDe('Anne')"), 'd’Anne'); assert.equal(c.ev("jeuDe('Lucas')"), 'de Lucas'); assert.equal(c.ev("jeuQue('Émile')"), 'qu’Émile');
  assert.equal(c.ev("jeuCleanCode('k7m 2qx')"), 'K7M2QX');
  assert.equal(c.ev("jeuCleanCode('https://x.test/requete/?partie=K7PX2M&jeu=local')"), 'K7PX2M');
  assert.equal(c.ev("jeuCleanCode('Viens me défier en SQL sur Requête ! Code de la salle : K7PX2M\\nhttps://x.test/?partie=K7PX2M')"), 'K7PX2M');
});

test('égalité en tête : les ex æquo gagnent tous les deux, pas de médaille à 0 point', () => {
  const { w, host, guests } = room({ n: 2, nb: 1 });
  host.ev('jeuNextRound()'); sec(w, 4.5); clore(host); sec(w, 1); host.ev('jeuFinish()'); sec(w, 1.5);
  assert.equal(host.view(), 'final');
  assert.doesNotMatch(host.html, /Tu as gagné/, 'personne n’a marqué : pas de gagnant');
  /* 13 novembre, 17 h 16 : le 0 à 0, sa page (le seul ex æquo possible), sans podium vide */
  assert.match(host.html, /class="jr2-hero jeu-issue is-nul"/); assert.match(host.html, /<h1 id="jr2-t">Match nul\u00a0!<\/h1>/);
  assert.match(host.html, /Personne n’a trouvé ce défi\./); assert.doesNotMatch(host.html, /jeu-podium/, 'pas de médaille d’or à 0 point');
  const w2 = new World();
  const h = makeClient(w2, 'Hôte'); h.ev('jeuNb=1'); h.host('TIE001'); sec(w2, 1);
  const g = makeClient(w2, 'Ami'); g.join('TIE001'); sec(w2, 3);
  h.ev('jeuNextRound()'); sec(w2, 4.5);
  h.ev('jeuSend({t:"found",n:0,ms:1000})'); g.ev('jeuSend({t:"found",n:0,ms:1000})'); sec(w2, 2); h.ev('jeuFinish()'); sec(w2, 2);
  const places = h.ev('jeuPlaces(jeuScores()).map(x=>x.place)');
  assert.deepEqual(places, [1, 1], 'même temps, mêmes points : deux premiers');
  const rk = h.ev('jeuRanking(0).map(x=>[x.place,x.rang,x.pts])');
  assert.deepEqual(rk, [[1, 50, 250], [1, 50, 250]], 'le même temps vaut le même bonus de rang (200 + 50, sans premier essai annoncé)');
  /* Départage : à points égaux, le temps total le plus court passe devant */
  const w3 = new World();
  const a = makeClient(w3, 'Hôte'); a.ev('jeuNb=2'); a.host('TIE002'); sec(w3, 1);
  const b = makeClient(w3, 'Ami'); b.join('TIE002'); sec(w3, 3);
  a.ev('jeuNextRound()'); sec(w3, 4.5);
  /* Manche 1 : l’hôte 1er en 30,001 s, l’ami 2e en 30,5 s ; manche 2 : l’ami 1er en 30,001 s, l’hôte 2e en 30,002 s.
     Le défi valait 200 à chaque fois : 480 points chacun ; l’hôte a mis moins de temps en tout. */
  a.ev('jeuSend({t:"found",n:0,ms:30001})'); b.ev('jeuSend({t:"found",n:0,ms:30500})'); sec(w3, 2);
  a.ev('jeuNextRound()'); sec(w3, 4.5);
  b.ev('jeuSend({t:"found",n:1,ms:30001})'); a.ev('jeuSend({t:"found",n:1,ms:30002})'); sec(w3, 2);
  const sc = a.ev('jeuPlaces(jeuScores()).map(x=>[x.name,x.pts,x.place])');
  assert.deepEqual(sc, [['Hôte', 480, 1], ['Ami', 480, 2]], 'à points égaux, le temps total le plus court passe devant');
  a.ev('jeuFinish()'); sec(w3, 1.5);
  assert.match(a.html, /jeu-tie/, 'le podium explique le départage');
});

test('les points sont crédités même si on quitte avant le podium, et un défi déjà réussi allume la série', () => {
  const w = new World();
  const s = makeClient(w, 'Seul'); s.ev("jeuNb=3;jeuNiv='f'");
  s.ev("jeuChallenges('f').forEach(c=>state.defis[c.id]=true)");
  s.ev("jeuStart('SOLO55',true,null,{solo:true})"); sec(w, 4); s.found(); sec(w, 1);
  assert.equal(s.acts, 1, 'la série compte même pour un défi déjà réussi');
  const pts = s.ev('jeuRanking(0)[0].pts');
  assert.ok(pts > 100, 'réussite + rapidité : ' + pts);
  s.ev('jeuStop()');
  assert.equal(s.ev('state.salle&&state.salle.pts'), pts, 'les points de la manche sont gardés');
});

/* Elisa, 31 octobre, 8 h 06 : « avoir un tableau de performance pour la page défis ». Chaque partie y est notée : manches jouées et
   trouvées, temps, place entre amis, niveau, et l’historique des 12 dernières. */
test('tableau de performance : une partie entre amis notée pour chacun, avec sa place', () => {
  const { w, host, guests } = room({ n: 2, nb: 3, niv: 'm' });
  for (let n = 0; n < 3; n++) {
    host.ev('jeuNextRound()'); sec(w, 4.5);
    host.found(); sec(w, 3);
    if (n < 2) guests[0].found();
    sec(w, 1.5);
    if (n === 2) sec(w, 15 * 60);   // la manche finit au chrono : l’hôte ne la clôt plus (9 novembre, 8 h 42)
  }
  host.ev('jeuFinish()'); sec(w, 1.5);
  const h = host.ev('state.salle'), g = guests[0].ev('state.salle');
  assert.equal(h.manches, 3); assert.equal(h.trouves, 3); assert.equal(h.amis, 1); assert.deepEqual(h.pl, [1, 0, 0]);
  assert.deepEqual(h.lv.m, [3, 3], 'niveau moyen : 3 manches, 3 trouvées');
  assert.equal(h.hist.length, 1);
  assert.deepEqual({ ...h.hist[0], at: 0 }, { at: 0, pts: h.pts, n: 3, ok: 3, ms: h.tms, niv: 'm', solo: 0, place: 1, players: 2,
    ppl: [{ n: 'Hôte', pts: h.pts, place: 1, me: 1 }, { n: 'Ami1', pts: g.pts, place: 2 }] }, 'le podium de la partie, avec les pseudos');
  /* Elisa, 31 octobre, 9 h 24 : « mettre aussi le lien avec les personnes qu’on a joué » — chacun garde l’autre parmi ses adversaires */
  assert.deepEqual({ ...h.mates.ami1, at: 0 }, { n: 'Ami1', g: 1, w: 1, l: 0, at: 0 }, 'l’hôte a fini devant Ami1');
  assert.deepEqual({ ...g.mates['hôte'], at: 0 }, { n: 'Hôte', g: 1, w: 0, l: 1, at: 0 }, 'Ami1 a fini derrière l’hôte');
  assert.ok(h.mates.ami1.at > 0, 'la dernière partie ensemble est datée');
  assert.equal(h.fast, Math.min(...host.ev('JEU.rounds.map(r=>r.found[JEU.me])')), 'la manche la plus rapide');
  assert.equal(g.trouves, 2, 'l’ami a trouvé deux manches sur trois'); assert.equal(g.manches, 3);
  assert.deepEqual(g.pl, [0, 1, 0]); assert.equal(g.hist[0].place, 2); assert.equal(g.hist[0].ok, 2);
  host.ev('jeuRender()'); sec(w, 1);
  assert.equal(host.ev('state.salle.hist.length'), 1, 'pas de double comptage');
});

test('tableau de performance : en solo, pas de place ; une manche abandonnée compte comme jouée', () => {
  const w = new World();
  const s = makeClient(w, 'Seul'); s.ev("jeuNb=1;jeuNiv='d'");
  s.ev("jeuStart('SOLO66',true,null,{solo:true})"); sec(w, 4);
  clore(s); sec(w, 1); s.ev('jeuFinish()'); sec(w, 1);
  const st = s.ev('state.salle');
  assert.equal(st.manches, 1); assert.equal(st.trouves, 0); assert.equal(st.fast || 0, 0); assert.equal(st.amis || 0, 0);
  assert.deepEqual(st.lv.d, [1, 0]);
  assert.deepEqual({ ...st.hist[0], at: 0 }, { at: 0, pts: 0, n: 1, ok: 0, ms: 0, niv: 'd', solo: 1, place: 0, players: 1 });
  s.ev("jeuNb=1;jeuNiv='f'"); s.ev('jeuAgain()'); sec(w, 4); s.found(); sec(w, 1); s.ev('jeuFinish()'); sec(w, 1);
  assert.equal(s.ev('state.salle.hist.length'), 2, 'la nouvelle partie passe devant');
  assert.equal(s.ev('state.salle.hist[0].ok'), 1);
});

/* ---------- La base Supabase : ordre, historique, coupures ---------- */
/* Ce qu’un joueur a reçu de la base suit l’ordre de la base (numéros croissants), sans doublon. */
function assertInOrder(w, code, c) {
  const order = w.room(code).all.map(r => r.m.u), got = c.relay();
  assert.equal(new Set(got).size, got.length, c.name + ' : chaque message une seule fois');
  let last = -1;
  for (const u of got) { const i = order.indexOf(u); assert.ok(i > last, c.name + ' : dans l’ordre de la base (' + u + ')'); last = i; }
  return got;
}

test('base : chacun reçoit les messages dans l’ordre de la base, une seule fois, historique compris', () => {
  const w = new World();
  const host = makeClient(w, 'Hôte'); host.ev('jeuNb=3'); host.host('BASE01'); host.logRelay(); sec(w, 1);
  const a = makeClient(w, 'Ami1'); a.join('BASE01'); a.logRelay(); sec(w, 1.5);
  a.ev('jeuToggleReady()'); sec(w, 1);
  /* 8 novembre, 16 h 05 : l’arrivant était dans la salle d’attente (un nouveau venu n’entrerait plus) */
  const avant = makeClient(w, 'Retard'); avant.join('BASE01'); sec(w, 1.5);
  const rpid = avant.pid(); avant.ev('jeuStop()'); sec(w, 1);
  host.ev('jeuNextRound()'); sec(w, 4.5);
  const late = samePid(w, 'Retard', rpid); late.join('BASE01'); late.logRelay(); sec(w, 2);
  host.found(); a.found(); late.found(); a.ev('jeuReact("🔥")'); sec(w, 3);
  for (const c of [host, a, late]) assertInOrder(w, 'BASE01', c);
  assert.deepEqual(late.ev('JEU.seq'), host.ev('JEU.seq'), 'le même ordre d’arrivée pour tous (relais d’hôte)');
  const got = new Set(late.relay());
  assert.ok(w.room('BASE01').all.filter(r => !VOLATILE.includes(r.m.t)).every(r => got.has(r.m.u)), 'l’arrivant a tout relu : arrivées, réglages, « prêt », manche, temps');
  assert.equal(late.view(), 'res0', 'l’arrivant a relu la manche en cours');
});

test('base : un message perdu par le direct est relu dans la base et livré avant le suivant', () => {
  const { w, host, guests } = room({ n: 3 });
  const [a, b] = guests; a.logRelay();
  a.lose = 1;                                   /* le direct perd la manche pour Ami1 */
  host.ev('jeuNextRound()'); sec(w, 0.5);
  assert.equal(a.J('rounds.length'), 0, 'rien reçu pour l’instant');
  b.ev('jeuSend({t:"ping"})'); sec(w, 1);       /* le numéro suivant arrive : il en manque un */
  assert.ok(a.J('rounds[0]'), 'la manche a été relue');
  const got = assertInOrder(w, 'ROOM42', a);
  const all = w.room('ROOM42').all, round = all.find(r => r.m.t === 'round').m.u;
  assert.ok(got.indexOf(round) >= 0 && got.indexOf(round) < got.length - 1, 'la manche avant le signe de vie qui suit');
  sec(w, 4); assert.equal(a.view(), 'play0');
});

test('base : son propre message ne revient pas par le direct : la salle est relue 3 s après', () => {
  const w = new World();
  const host = makeClient(w, 'Hôte'); host.host('ECHO01'); sec(w, 1);
  const a = makeClient(w, 'Ami'); a.join('ECHO01'); sec(w, 3);
  const calls = w.histCalls;
  a.lose = 1; const u = a.ev('jeuSend({t:"ready",on:true})');
  sec(w, 1);
  assert.equal(a.ev(`JEU.seenR.has(${JSON.stringify(u)})`), false, 'pas encore revenu');
  sec(w, 3);
  assert.equal(a.ev(`JEU.seenR.has(${JSON.stringify(u)})`), true, 'revenu par la base');
  assert.ok(w.histCalls > calls, 'la salle a été relue');
  assert.equal(host.ev(`JEU.ready[${JSON.stringify(a.pid())}]`), true, 'l’hôte l’a bien reçu');
});

test('base : connexion morte (battements sans réponse) : reconnexion toute seule, puis relecture de ce qui a été manqué', () => {
  const { w, host, guests } = room({ n: 3 });
  const a = guests[0], before = a.sockets;
  a.deaf = true; sec(w, 35);
  assert.ok(a.sockets > before, 'la connexion muette a été abandonnée');
  assert.deepEqual(a.ev('[JEU.t.stats().joined,JEU.t.stats().up]'), [false, false], 'coupée, et la salle le sait');
  host.ev('jeuNextRound()'); sec(w, 5);
  assert.equal(a.J('rounds.length'), 0);
  a.deaf = false; sec(w, 30);                   /* sans rien faire : le prochain essai passe */
  assert.equal(a.J('net'), true);
  assert.equal(a.ev('JEU.t.stats().joined'), true, 'de nouveau en direct');
  assert.ok(a.J('rounds[0]'), 'la manche manquée a été relue');
  assert.equal(a.view(), 'play0');
  assert.deepEqual(a.live(), ['Hôte', 'Ami1', 'Ami2']);
});

test('base : hors ligne puis réseau retrouvé : ce qui n’était pas parti part, et la salle reprend', () => {
  const { w, host, guests } = room({ n: 2 });
  const a = guests[0];
  a.offline = true; sec(w, 2);
  a.ev('jeuToggleReady()'); sec(w, 6);
  assert.equal(a.J('net'), false);
  assert.ok(a.J('out.length') >= 1, '« prêt » attend le réseau');
  assert.equal(host.ev(`!!JEU.ready[${JSON.stringify(a.pid())}]`), false);
  a.offline = false; a.reconnect(); sec(w, 4);
  assert.equal(a.J('net'), true);
  assert.equal(a.J('out.length'), 0, 'plus rien en attente');
  assert.equal(host.ev(`JEU.ready[${JSON.stringify(a.pid())}]`), true, '« prêt » est arrivé chez l’hôte');
});

test('base : en quittant, le dernier message part par jeu_balise (même si la page se ferme)', () => {
  const { w, host, guests } = room({ n: 3 });
  const a = guests[1], pid = a.pid();
  a.ev('jeuStop()'); sec(w, 0.5);
  assert.equal(a.beacons, 1, 'un seul envoi, par la balise');
  assert.equal(host.ev(`!!JEU.left[${JSON.stringify(pid)}]`), true, 'l’hôte sait tout de suite qu’il est parti');
  sec(w, 1); assert.equal(a.ws.readyState, 3, 'et sa connexion est fermée');
});

test('base : une longue salle (plus de 500 messages gardés) se relit page par page, dans l’ordre', () => {
  const w = new World();
  const host = makeClient(w, 'Hôte'); host.host('LONG01'); sec(w, 1);
  const a = makeClient(w, 'Ami'); a.join('LONG01'); sec(w, 2);
  for (let i = 0; i < 601; i++) { a.ev('jeuToggleReady()'); if (i % 50 === 49) sec(w, 0.3); }
  sec(w, 2);
  const want = host.ev(`!!JEU.ready[${JSON.stringify(a.pid())}]`);
  assert.equal(want, true, '601 bascules : prêt');
  const calls = w.histCalls;
  const late = makeClient(w, 'Retard'); late.join('LONG01'); late.logRelay(); sec(w, 3);
  assert.ok(w.histCalls - calls >= 2, 'deux pages au moins : ' + (w.histCalls - calls));
  assertInOrder(w, 'LONG01', late);
  assert.equal(late.ev(`!!JEU.ready[${JSON.stringify(a.pid())}]`), want, 'le dernier « prêt » compte');
  assert.equal(late.view(), 'lobby');
});

test('base : direct bloqué (WebSocket refusé par le réseau) : la salle se suit quand même, en relisant l’historique', () => {
  const w = new World();
  const host = makeClient(w, 'Hôte'); host.ev('jeuNb=3'); host.host('BLOC01'); sec(w, 1);
  const a = makeClient(w, 'Bloqué');
  a.ctx.WebSocket = class { constructor() { throw new Error('bloqué'); } };
  a.join('BLOC01'); sec(w, 10);
  assert.ok(a.ev('JEU.t.stats().polls') > 0, 'il relit la salle');
  assert.equal(a.view(), 'lobby', 'il est dans la salle');
  assert.deepEqual(host.live(), ['Hôte', 'Bloqué'], 'l’hôte le voit');
  host.ev('jeuNextRound()'); sec(w, 7);          /* relue toutes les 2,5 s : jusqu’à 2,5 s de retard */
  assert.equal(a.view(), 'play0', 'la manche arrive');
  sec(w, 70);
  assert.deepEqual(a.live(), ['Hôte', 'Bloqué'], 'les signes de vie de l’hôte arrivent aussi : il reste présent');
  a.found(); sec(w, 4);
  assert.notEqual(host.J(`rounds[0].found[${JSON.stringify(a.pid())}]`), undefined, 'son temps arrive chez l’hôte');
});

/* L’appli et la base (supabase/migrations) parlent la même langue : mêmes fonctions, mêmes paramètres, canal public
   « salle:CODE », 500 messages par page, signes de vie et réactions à part ; et la base ne s’ouvre que par ces fonctions. */
test('base : l’appli et les fonctions SQL de supabase/migrations restent d’accord', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const sql = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort().map(f => fs.readFileSync(new URL(f, dir), 'utf8')).join('\n');
  const last = name => { const i = sql.lastIndexOf('create or replace function public.' + name); assert.ok(i >= 0, name); return sql.slice(i, sql.indexOf('$$;', sql.indexOf('$$', i) + 2) + 3); };
  const env = last('jeu_envoyer('), hist = last('jeu_historique('), bal = last('jeu_balise(');
  assert.match(env, /jeu_envoyer\(p_salle text, p_m jsonb\)/);
  assert.match(hist, /jeu_historique\(p_salle text, p_apres integer default 0\)/);
  assert.match(bal, /jeu_balise\(text\)/);
  for (const f of [env, hist, bal, last('jeu_menage(')]) { assert.match(f, /security definer/); assert.match(f, /set search_path = ''/); }
  assert.match(env, /realtime\.send\(jsonb_build_object\('n', v_n, 'at', v_at, 'm', p_m\), 'm', 'salle:' \|\| p_salle, false\)/, 'diffusion publique sur salle:CODE');
  assert.match(hist, /limit 500;/);
  assert.ok(engineSrc.includes('full=rows.length>=500'), 'pagination de 500 côté appli');
  assert.match(hist, /not in \('ping', 'react'\) or j\.cree > now\(\) - interval '90 seconds'/);
  assert.ok(engineSrc.includes("const JEU_VOLATILE=['ping','react'];"), 'mêmes messages volatils');
  assert.ok(engineSrc.includes("topic='realtime:salle:'+code") && engineSrc.includes('private:false'), 'canal public côté appli');
  assert.ok(engineSrc.includes("rpc('jeu_envoyer',{p_salle:code,p_m:m})") && engineSrc.includes("rpc('jeu_historique',{p_salle:code,p_apres:S.last})"));
  assert.ok(engineSrc.includes("(secure?'jeu_balise_v2':'jeu_balise')") && engineSrc.includes("cle:clsCle()"));
  assert.match(sql, /alter table public\.jeu_salle enable row level security;/);
  assert.match(sql, /alter table public\.jeu_msg enable row level security;/);
  assert.match(sql, /revoke all on table public\.jeu_salle, public\.jeu_msg from anon, authenticated;/);
  assert.match(sql, /revoke all on function public\.jeu_menage\(\) from public, anon, authenticated;/);
  assert.doesNotMatch(sql, /grant execute on function public\.jeu_menage/, 'le ménage n’est pas appelable de l’extérieur');
  assert.match(sql, /cron\.schedule\('jeu-menage', '23 \* \* \* \*'/);
  assert.match(engineSrc, /const JEU_SB_KEY='sb_publishable_[A-Za-z0-9_]+';/, 'seule la clé publique est dans l’appli');
  assert.doesNotMatch(html, /service_role|sb_secret_/, 'aucune clé secrète');
});

/* Elisa, 6 novembre, 7 h 52 : « faire partir le chrono de 20 min pour passer à 0 et fermeture de la salle » (chaque manche) : le chrono
   descend jusqu’à 00:00 ; 10:00 en Facile depuis le 8 novembre. 8 novembre, 9 h 31 (« passe à la suivante même pour solo ») : à 0, la
   salle ne se ferme plus ; seule la manche se termine. Qui n’a pas trouvé marque 0 point (la carte « Temps écoulé »), les résultats de
   la manche s’affichent, et l’hôte lance la suivante, une fois la manche finie aussi sur le serveur (2 s de marge, jeuAttenteFin). */
test('8 novembre, 9 h 31 : à 0, la manche s’arrête, 0 point pour qui n’a pas trouvé, et la partie continue (le chrono de 10:00 en Facile)', () => {
  const { w, host, guests } = room({ n: 2, nb: 3 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  assert.match(host.html, /role="timer" aria-label="Temps restant de la manche">(10:00|09:5\d)<\/b>/, 'le temps qui reste');
  assert.equal(host.ev("jeuRebours(jeuDureeMs('f'),jeuDureeMs('f'))"), '10:00');
  assert.deepEqual(host.ev('[600000,599001,61000,999,0,-5].map(x=>jeuRebours(x,600000))'), ['10:00', '10:00', '01:01', '00:01', '00:00', '00:00'], 'à la seconde du dessus');
  assert.deepEqual(host.ev("[jeuRebours(700000,600000),jeuRebours(1300000),['f','m','d'].map(jeuDureeMs)]"), ['10:00', '20:00', [600000, 900000, 1200000]], 'jamais plus que la manche');
  host.found(); sec(w, 2);
  sec(w, 9.5 * 60);
  assert.equal(guests[0].view(), 'play0', 'à 9 min 30, l’ami cherche encore');
  sec(w, 28);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'res0', c.name + ' : les résultats de la manche');
  assert.ok(guests[0].html.includes('Temps écoulé') && guests[0].html.includes('Tu pourras retenter ce défi plus tard.') && guests[0].html.includes('<b class="jr2-n" data-n="0">0</b>'), 'l’ami : 0 point, « Temps écoulé » (la carte des résultats, 15 h 48)');
  assert.ok(host.html.includes('La manche suivante démarre dans') && !host.html.includes('la salle est fermée') && !host.html.includes('Revenir aux défis'), 'la suite part toute seule');
  assert.equal(host.J('over'), false, 'la partie continue');
  assert.ok(host.ev('jeuAttenteFin(0)') > 0, 'juste après 0 : le serveur tient encore la manche quelques instants');
  host.ev('jeuNextRound()'); sec(w, 0.5);
  assert.equal(host.J('rounds.length'), 1, 'la suivante attend la fin de la manche sur le serveur');
  sec(w, 7);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'play1', c.name + ' : la manche 2');
  assert.deepEqual(host.ev('jeuRanking(0).map(x=>x.pid===JEU.me)'), [true], 'la manche 1 : seul l’hôte marque des points');
});

test('6 novembre, 7 h 52 : tout le monde a trouvé avant 0 : rien ne se ferme ; 17 h 31 : la suite part toute seule', () => {
  const { w, host, guests } = room({ n: 2, nb: 3 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  host.found(); sec(w, 2); guests[0].found(); sec(w, 2);
  assert.equal(host.view(), 'res0');
  assert.equal(host.ev('jeuAttenteFin(0)'), 0, 'tout le monde a trouvé : rien à attendre');
  sec(w, 8);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'play1', c.name);
  assert.equal(host.J('over'), false, 'la salle ne se ferme pas');
});

test('8 novembre, 9 h 31 : seul, à 0, la manche s’arrête et la suite part toute seule (17 h 31) ; à 0 à la dernière, le bilan ; « Rejouer » repart à neuf', () => {
  const w = new World();
  const s = makeClient(w, 'Seul'); s.ev("jeuNb=3;jeuNiv='f'");
  s.ev("jeuStart('SOLO52',true,null,{solo:true})"); sec(w, 4);
  assert.equal(s.view(), 'play0');
  sec(w, 10 * 60 + 2);
  assert.equal(s.view(), 'play0', 'la première manche arrivée à 0 : elle reste à l’écran, « Temps écoulé » dans sa carte, la partie continue (9 novembre, 10 h 01 ; avant : res0)');
  assert.ok(s.html.includes('Temps écoulé') && s.html.includes('Tu te rattraperas à la prochaine manche.') && s.html.includes('La manche suivante démarre dans'));
  assert.ok(!s.html.includes('id="ed-lesson"') && !s.html.includes('jeuRetenter(') && !s.html.includes('jeuCorrection('), 'à la place de l’éditeur ; la correction viendra au bilan (10 h 37)');
  assert.ok(!s.html.includes('la salle est fermée') && !s.html.includes('id="jeu-go"'));
  sec(w, 13);
  assert.equal(s.view(), 'play1', 'la deuxième manche, toute seule');
  s.found(); sec(w, 1);
  assert.equal(s.view(), 'play1', 'trouvée : la manche reste à l’écran, en vert (9 novembre, 8 h 20 ; avant : res1)');
  assert.match(s.html, /Bravo, défi résolu/);
  assert.match(s.html, /La manche suivante démarre dans <b id="jeu-auto-n">\d+<\/b>/, 'trouvée : la suite part aussi toute seule');
  sec(w, 14);
  assert.equal(s.view(), 'play2');
  sec(w, 10 * 60 - 4);   // la carte : 6 s (13 novembre, 21 h 07)
  assert.equal(s.view(), 'play2', 'la dernière manche arrivée à 0 : « Temps écoulé », le bilan 5 s après (10 h 01)');
  assert.match(s.html, /Tes points arrivent dans/);
  sec(w, 10);
  assert.equal(s.view(), 'final', 'puis le bilan');
  assert.equal((s.html.match(/class="jr is-miss"/g) || []).length, 2, 'deux manches manquées sur trois');
  assert.equal((s.html.match(/class="jr is-ok"/g) || []).length, 1, 'la manche trouvée');
  assert.ok(s.ev('state.salle.pts') > 0, 'elle compte');
  s.ev('jeuAgain()'); sec(w, 5);
  assert.equal(s.view(), 'play0', '« Rejouer » : une nouvelle partie, une nouvelle manche');
});

test('6 novembre, 7 h 52 : le serveur compte aussi 20 minutes par manche (cinq fonctions, rien d’autre ne change)', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const f = fs.readdirSync(dir).find(x => x.endsWith('_salle_chrono_20_minutes.sql'));
  assert.ok(f, 'la migration');
  const sql = fs.readFileSync(new URL(f, dir), 'utf8');
  for (const k of ["('public','jeu_envoyer_v2')", "('public','jeu_essai_v2')", "('public','jeu_score_v2')", "('public','jeu_valider_v2')", "('requete_private','close_if_finished')"])
    assert.ok(sql.includes(k), k);
  assert.ok(sql.includes('def := pg_get_functiondef(f.oid);') && sql.includes("execute replace(def, 'interval ''10 minutes''', 'interval ''20 minutes''');"), 'chaque fonction telle qu’en service, seule sa durée change');
  assert.ok(sql.includes("if nb <> 5 then raise exception"), 'les cinq, ou rien');
});

/* Elisa, 8 novembre, 8 h 21 : « 10 min de jeu stp par manche ». Les mêmes cinq fonctions repassent à 10 minutes, comme l’appli. */
test('8 novembre, 8 h 21 : 10 minutes par manche, dans l’appli et sur le serveur (les cinq mêmes fonctions, rien d’autre ne change)', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const f = fs.readdirSync(dir).find(x => x.endsWith('_salle_chrono_10_minutes.sql'));
  assert.ok(f && f > fs.readdirSync(dir).find(x => x.endsWith('_salle_chrono_20_minutes.sql')), 'la migration, après celle des 20 minutes');
  const sql = fs.readFileSync(new URL(f, dir), 'utf8');
  for (const k of ["('public','jeu_envoyer_v2')", "('public','jeu_essai_v2')", "('public','jeu_score_v2')", "('public','jeu_valider_v2')", "('requete_private','close_if_finished')"])
    assert.ok(sql.includes(k), k);
  assert.ok(sql.includes('def := pg_get_functiondef(f.oid);') && sql.includes("execute replace(def, 'interval ''20 minutes''', 'interval ''10 minutes''');"), 'chaque fonction telle qu’en service, seule sa durée change');
  assert.ok(sql.includes("if position('interval ''20 minutes''' in def) = 0 then") && sql.includes("if nb <> 5 then raise exception"), 'les cinq, ou rien');
});

/* Elisa, 8 novembre, 8 h 52 : « 15 min pour moyen et 20 min par manche pour difficile » (le Facile garde ses 10 min). La durée suit le
   niveau du défi, dans l’appli (JEU_NIV_MANCHE) comme sur le serveur (requete_private.manche_duree, d’après le catalogue). */
test('8 novembre, 8 h 52 : 10 min en Facile, 15 en Moyen, 20 en Difficile, dans l’appli et sur le serveur (les cinq mêmes fonctions)', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const f = fs.readdirSync(dir).find(x => x.endsWith('_salle_chrono_selon_niveau.sql'));
  assert.ok(f && f > fs.readdirSync(dir).find(x => x.endsWith('_salle_chrono_10_minutes.sql')), 'la migration, après celle des 10 minutes');
  const sql = fs.readFileSync(new URL(f, dir), 'utf8');
  assert.ok(sql.includes("select case (select c.niv from requete_private.catalogue c where c.id = p_defi)\n    when 'm' then interval '15 minutes' when 'd' then interval '20 minutes' else interval '10 minutes' end"), 'la durée d’après le niveau du défi');
  assert.ok(sql.includes('revoke all on function requete_private.manche_duree(text) from public, anon, authenticated;'));
  for (const k of ["('public','jeu_envoyer_v2')", "('public','jeu_essai_v2')", "('public','jeu_score_v2')", "('public','jeu_valider_v2')", "('requete_private','close_if_finished')"])
    assert.ok(sql.includes(k), k);
  assert.ok(sql.includes("neuf := regexp_replace(def, '([a-z_]+)\\.debut\\+interval ''10 minutes''', '\\1.debut+requete_private.manche_duree(\\1.defi)', 'g');"), 'seule la borne change');
  assert.ok(sql.includes("if position('interval ''10 minutes''' in neuf) > 0 then") && sql.includes("if nb <> 5 then raise exception"), 'toutes les bornes, les cinq fonctions, ou rien');
  assert.ok(engineSrc.includes('const JEU_NIV_MANCHE={f:600000,m:900000,d:1200000};\nfunction jeuDureeMs(k){return JEU_NIV_MANCHE[k]||JEU_NIV_MANCHE.f;}'), 'l’appli compte les mêmes durées');
});

test('8 novembre, 8 h 52 : entre amis en Difficile, le chrono part de 20:00 ; la manche tient encore à 15 min, s’arrête à 20 et la partie continue (9 h 31)', () => {
  const { w, host, guests } = room({ n: 2, nb: 3, niv: 'd' });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  assert.match(host.html, /role="timer" aria-label="Temps restant de la manche">(20:00|19:5\d)<\/b>/, 'le temps qui reste');
  assert.ok(host.html.includes('20\u00a0min par manche') || host.ev('jeuDureeMs(JEU.niv)') === 1200000, '20 min par manche en Difficile');
  host.found(); sec(w, 2);
  sec(w, 15 * 60);
  assert.equal(guests[0].view(), 'play0', 'à 15 min, l’ami cherche encore');
  sec(w, 5 * 60);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'res0', c.name);
  host.ev('jeuNextRound()'); sec(w, 7);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'play1', c.name);
});

/* Elisa, 8 novembre, 10 h 10 (« oui » à « la manche suivante démarre toute seule après quelques secondes ») : à 0, le résultat de la
   manche reste 5 s, le compte à rebours au-dessus de « Manche suivante », puis la suite part toute seule : la manche suivante, ou le
   podium à la dernière. */
test('8 novembre, 10 h 10 : entre amis, à 0, la manche suivante part toute seule 5 s après ; à la dernière, le podium', () => {
  const { w, host, guests } = room({ n: 2, nb: 2 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  host.found(); sec(w, 2);
  sec(w, 9.5 * 60); sec(w, 28);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'res0', c.name);
  for (const c of [host, ...guests]) assert.match(c.html, /<p class="jeu-auto jr2-auto" id="jeu-auto"[^>]*><span>La manche suivante démarre dans <b id="jeu-auto-n">\d<\/b> s<\/span><i class="jr2-barre"/, c.name + ' : le compte à rebours');
  assert.doesNotMatch(host.html, /<span>Manche suivante<\/span>/, '17 h 31 : plus de bouton');
  sec(w, 5);
  for (const c of [host, ...guests]) assert.ok(/^(draw1|play1)$/.test(c.view()), c.name + ' : la manche 2 est partie toute seule');
  sec(w, 4);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'play1', c.name);
  sec(w, 10 * 60 + 1);
  assert.equal(host.view(), 'play1', '13 novembre, 17 h 31 : la carte de la manche, le temps du compte à rebours');
  assert.match(host.html, /Tes points arrivent dans <b id="jeu-auto-n">\d<\/b>/); assert.doesNotMatch(host.html, /Le podium arrive/);
  sec(w, 6);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'final', c.name + ' : le podium, tout seul');
});

test('8 novembre, 10 h 10 : seul, à 0, la manche suivante part toute seule 5 s après ; à 0 à la dernière, le bilan', () => {
  const w = new World();
  const s = makeClient(w, 'Seul'); s.ev("jeuNb=2;jeuNiv='f'");
  s.ev("jeuStart('SOLO77',true,null,{solo:true})"); sec(w, 4);
  assert.equal(s.view(), 'play0');
  sec(w, 10 * 60 + 1);
  assert.equal(s.view(), 'play0', 'la manche reste à l’écran, « Temps écoulé » (9 novembre, 10 h 01)');
  assert.match(s.html, /La manche suivante démarre dans <b id="jeu-auto-n">\d+<\/b>/);
  sec(w, 10);
  assert.ok(/^(draw1|play1)$/.test(s.view()), 'la manche 2, toute seule');
  sec(w, 4);
  assert.equal(s.view(), 'play1');
  sec(w, 10 * 60 - 5);   // la carte : 6 s (13 novembre, 21 h 07)
  assert.equal(s.view(), 'play1', 'la dernière manche à 0 : « Temps écoulé », puis le bilan (10 h 01)');
  sec(w, 10);
  assert.equal(s.view(), 'final');
});

/* Elisa, 8 novembre, 17 h 31 : « pourquoi on doit cliquer sur le bouton pour la manche ? il faut que ça continue seul sans
   interruption » : une manche trouvée par tout le monde, close par l’hôte ou abandonnée enchaîne aussi toute seule, 5 s après. */
test('8 novembre, 17 h 31 : trouvée par tout le monde, close ou abandonnée, la manche suivante part toute seule 5 s après', () => {
  const { w, host, guests } = room({ n: 2, nb: 3 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  host.found(); sec(w, 2); guests[0].found(); sec(w, 1);
  assert.equal(host.view(), 'res0');
  assert.match(host.html, /La manche suivante démarre dans <b id="jeu-auto-n">[56]<\/b>/);   // 6 s depuis le 13 novembre, 21 h 07
  assert.match(guests[0].html, /Bravo, défi résolu/, 'le dernier à trouver : son encart vert, un instant (9 novembre, 8 h 20)');
  sec(w, 3);
  assert.equal(host.view(), 'res0', 'les 6 s pour voir le résultat (5 s jusqu’au 13 novembre, 21 h 07)');
  sec(w, 6.5);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'play1', c.name + ' : la manche 2');
  /* Close (par une version d’avant de l’appli) : la suite part aussi toute seule ; les 5 s passées sans la suite, la ligne le dit */
  clore(host); sec(w, 1);
  assert.equal(guests[0].view(), 'res1');
  assert.match(guests[0].html, /Manche close par l’hôte/);
  guests[0].ev('JEU.rounds[1].finVu=Date.now()-6000'); guests[0].ev("JEU.view='';jeuRender()");
  assert.match(guests[0].html, /<p class="jeu-auto jr2-auto" id="jeu-auto"[^>]*><span class="jeu-auto-att"><i class="jeu-dot" aria-hidden="true"><\/i>La manche suivante arrive…<\/span><\/p>/, 'les 5 s passées : la suite arrive');
  sec(w, 9);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'play2', c.name + ' : la manche 3');
});

/* Elisa, 8 novembre, 15 h 27 (la relecture de « Rejoindre une partie » qu’elle a fait faire) : la salle se cherche dans la feuille du
   code, sans passer par la page « Tu rejoins la salle… ». La feuille est simulée : son champ existe, ses états sont notés. */
function avecFeuille(c) {
  c.etats = []; c.fermee = []; c.ecrans = 0;
  const doc = c.ctx.document, qs = doc.querySelector;
  doc.querySelector = sel => (sel === '#dx-feuille #jeu-code' ? { value: '' } : qs(sel));
  c.ctx.dxCodeEtat = (e, code) => c.etats.push([e, code]);
  c.ctx.defisFeuilleFermer = s => c.fermee.push(!!s);
  c.ctx.showScreen = () => { c.ecrans++; };
  return c;
}

test('8 novembre, 15 h 27 : la salle trouvée depuis la feuille du code, on y entre ; rien ne s’affiche avant', () => {
  const w = new World();
  const host = makeClient(w, 'Hôte'); host.host('ROOM42'); sec(w, 1);
  const g = avecFeuille(makeClient(w, 'Ami1'));
  g.join('ROOM42');
  assert.deepEqual(g.etats, [['cherche', 'ROOM42']], '« On cherche ta salle… » dans le bouton');
  assert.deepEqual([g.J('verif'), g.ecrans, g.fermee, g.html], [true, 0, [], ''], 'la feuille reste ouverte, aucune page « Tu rejoins la salle… »');
  g.join('ROOM42');
  assert.deepEqual(g.etats, [['cherche', 'ROOM42']], 'touché deux fois : une seule recherche');
  sec(w, 3);
  assert.deepEqual([g.J('verif'), g.ecrans, g.fermee], [false, 1, [true]], 'l’hôte a répondu : la coche verte, puis la feuille se referme sur la salle');
  assert.equal(g.view(), 'lobby');
  assert.match(g.html, /Salle de Hôte/);
  assert.doesNotMatch(g.html, /Tu rejoins la salle/);
  assert.deepEqual(host.live(), ['Hôte', 'Ami1']);
  assert.deepEqual(g.etats, [['cherche', 'ROOM42'], ['trouvee', 'ROOM42']], '16 h 34 : « Salle trouvée ! », un court instant');
});

test('8 novembre, 15 h 27 : personne derrière le code, salle complète, plus de réseau : la feuille le dit, on reste où l’on est', () => {
  const { w, host } = room({ n: 6 });   // complète à six (22 h 27)
  const perdu = avecFeuille(makeClient(w, 'Perdu'));
  perdu.join('NOPE99'); sec(w, 6);
  assert.equal(perdu.J('verif'), true, 'on cherche encore');
  sec(w, 2);
  assert.equal(perdu.ev('JEU'), null);
  assert.deepEqual(perdu.etats, [['cherche', 'NOPE99'], ['introuvable', 'NOPE99']]);
  assert.deepEqual([perdu.ecrans, perdu.fermee, perdu.html], [0, [], '']);
  const trop = avecFeuille(makeClient(w, 'Trop'));
  trop.join('ROOM42'); sec(w, 4);
  assert.deepEqual(trop.etats, [['cherche', 'ROOM42'], ['complete', 'ROOM42']]);
  assert.deepEqual([trop.ev('JEU'), trop.ecrans, trop.fermee], [null, 0, []]);
  assert.equal(host.live().length, 6);
  const coupe = avecFeuille(makeClient(w, 'Coupé')); coupe.offline = true;
  coupe.join('ROOM42'); sec(w, 8);
  assert.deepEqual(coupe.etats, [['cherche', 'ROOM42'], ['reseau', 'ROOM42']]);
  assert.deepEqual([coupe.ev('JEU'), coupe.ecrans], [null, 0]);
  const hors = avecFeuille(makeClient(w, 'Hors')); hors.ctx.navigator.onLine = false;
  hors.join('ROOM42');
  assert.deepEqual([hors.etats, hors.ev('JEU')], [[['horsligne', 'ROOM42']], null], 'hors ligne : tout de suite');
  /* Sans feuille (un lien d’invitation ouvert en pleine leçon) : la page « Tu rejoins la salle… », comme avant */
  const lien = makeClient(w, 'Lien'); lien.join('ROOM42');
  assert.equal(lien.J('verif'), false);
});

test('8 novembre, 16 h 05 : depuis la feuille du code, une partie déjà lancée : « Trop tard, la partie a déjà commencé ! », on reste où l’on est', () => {
  const { w, host, guests } = room({ n: 2, nb: 1 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  const tard = avecFeuille(makeClient(w, 'Tard'));
  tard.join('ROOM42'); sec(w, 3);
  assert.deepEqual(tard.etats, [['cherche', 'ROOM42'], ['commencee', 'ROOM42']]);
  assert.deepEqual([tard.ev('JEU'), tard.ecrans, tard.fermee, tard.html], [null, 0, [], '']);
  sec(w, 2);
  for (const c of [host, ...guests]) { assert.deepEqual(c.live().sort(), ['Ami1', 'Hôte'], c.name); assert.equal(c.view(), 'play0', c.name); }
});

/* 9 novembre, 10 h 37 (Elisa, la relecture qu’elle a fait faire, et ses notes : « Chrono arrête -> seulement en solo », « pouvoir voir
   la correction et le résultat finalement, mais sur l’écran bilan », « plus que premium ») : le déroulé (retours-1037.test.mjs). */
test('10 h 37 : à plusieurs, le chrono continue après sa trouvaille, sans correction pendant la partie ; « Manche unique »', () => {
  const { w, host } = room({ n: 2, nb: 1 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  sec(w, 20); host.found(); sec(w, 1);
  assert.equal(host.view(), 'play0', 'l’hôte attend l’autre');
  assert.match(host.html, /<b class="jeu-timer" id="jeu-timer" role="timer" aria-label="Temps restant de la manche">09:[34]\d<\/b>/, 'le chrono continue');
  assert.match(host.html, /<b class="jeu-hud-m">Manche unique<\/b>/);
  assert.doesNotMatch(host.html, /jeuCorrection\(|Défi solo/, 'la correction attend la fin de la partie');
  assert.doesNotMatch(host.html, /jeu-done-sql|Voir ma requête/, 'plus de « Voir ma requête et son résultat » (13 novembre, 20 h 33)');
  sec(w, 10 * 60 + 8);
  assert.equal(host.view(), 'final', 'le podium');
  assert.match(host.html, /<div class="jeu-card jeu-corr-l"><p class="jeu-card-h">Les défis de la partie<\/p><ol class="jeu-corr-liste"><li><button type="button" class="jcl-b" onclick="jeuCorrection\(0\)"><span class="jcl-t"><small><i class="is-ok">Résolu en 2\d s<\/i><\/small>/, 'sous le classement, chaque défi et sa correction');
});

test('10 h 37 : seul, deux manches ratées : « On retente ? », le bandeau et son « — », « Réessayer », chaque correction', () => {
  const w = new World();
  const s = makeClient(w, 'Seul'); s.ev("jeuNb=2;jeuNiv='f'");
  s.ev("jeuStart('SOLO90',true,null,{solo:true})"); sec(w, 4);
  s.ed.value = "SELECT 'faux'"; s.ev('jeuRun()'); sec(w, 1);
  sec(w, 10 * 60);
  assert.equal(s.view(), 'play0');
  assert.match(s.html, /<b class="coach-to-k">Temps écoulé<\/b><p>Tu te rattraperas à la prochaine manche\.<\/p><\/div><\/div>/, 'la partie continue : de quoi se rattraper');
  assert.match(s.html, /<b class="jeu-timer is-fin" id="jeu-timer" role="timer" aria-label="Temps écoulé">00:00<\/b>/);
  assert.equal(s.J('rounds[0].essai'), "SELECT 'faux'", 'son dernier essai, pour la correction');
  sec(w, 14); assert.equal(s.view(), 'play1');
  sec(w, 10 * 60 - 5);   // la carte : 6 s (13 novembre, 21 h 07)
  assert.match(s.html, /<p>La correction t’attend dans ton bilan\.<\/p>/);
  sec(w, 11);
  assert.equal(s.view(), 'final');
  assert.match(s.html, /<h1>Pas encore cette fois\u00a0!<\/h1><p class="l-sub" id="jeu-sub">Prêt·e à retenter ta chance\u00a0\?<\/p>/);
  assert.match(s.html, /<p class="jeu-card-h">Ton récap’<\/p>/);
  assert.match(s.html, /<div class="jeu-bilan"><div><b data-n="0">0<\/b><small>point<\/small><\/div><div><b>0\/2<\/b><small>résolu<\/small>.*?<div><b>—<\/b><small>temps moyen<\/small><\/div><\/div>/);
  assert.equal((s.html.match(/class="jr-corr" onclick="jeuCorrection\(\d\)"/g) || []).length, 2);
  assert.match(s.html, /<span>Rejouer<\/span>/); assert.doesNotMatch(s.html, /jeu-prog|jeuRetenter\(/);
});

test('10 h 37 : seul, tout résolu : « Tout résolu », la prochaine étape (une ligne depuis 11 h 38), puis « Rejouer » et « Retour aux défis »', () => {
  const w = new World();
  const s = makeClient(w, 'Seul'); s.ev("jeuNb=2;jeuNiv='f'");
  s.ev("jeuStart('SOLO91',true,null,{solo:true})"); sec(w, 4);
  sec(w, 5); s.found(); sec(w, 1);
  assert.match(s.html, /<b class="jeu-timer is-ok" id="jeu-timer" role="timer" aria-label="Résolu en 5 s">00:05<\/b>/, 'le temps mis, plus ce qui restait');
  assert.match(s.html, /<b class="jeu-hud-m">Manche 1<small>\/2<\/small><\/b>/);
  sec(w, 14); assert.equal(s.view(), 'play1');
  sec(w, 7); s.found(); sec(w, 11);
  assert.equal(s.view(), 'final');
  assert.match(s.html, /<h1>Carton plein( ! 🏆|\u00a0!)<\/h1><p class="l-sub" id="jeu-sub">2 manches, 2 victoires\u00a0!<\/p>/);
  assert.match(s.html, /<div><b>2\/2<\/b><small>résolus<\/small>.*?<div><b>\d s<\/b><small>temps moyen<\/small><\/div>/);
  assert.match(s.html, /<div class="jeu-fin-actions"><button type="button" class="jeu-prog is-m" onclick="jeuNiveauSuivant\(\)">.*?<span class="jeu-prog-t">Passer au niveau moyen<\/span>.*?<button type="button" class="journey-primary jeu-rejouer-solo" onclick="jeuRejouer\(\)"><svg[^]*?<\/svg><span>Rejouer<\/span>.*?<span>Quitter la salle<\/span>/s);
});

/* 9 novembre, 12 h 36 (Elisa : « regarde s’il n’y a pas d’erreur dans la logique hôte, salle, joueur, quitter la salle ») */
test('12 h 36 : l’ami resté seul garde la salle d’attente en hôte ; le podium ne se change pas en bilan ; « Rejouer » seulement chez l’hôte', () => {
  {
    const { w, host, guests } = room({ n: 2 });
    host.ev('jeuStop()'); sec(w, 40);
    assert.equal(guests[0].view(), 'lobby', 'plus de « Cette salle est vide » 30 s après le départ de l’hôte');
    assert.ok(guests[0].ev('jeuIsHost()'));
    assert.match(guests[0].ev('jeuLeaveQuestion().texte'), /^Tu es encore seul/, 'pas « Personne ne l’a encore rejointe »');
    const ghost = makeClient(w, 'Tard');
    guests[0].ev('jeuStop()'); sec(w, 120);
    ghost.join('ROOM42'); sec(w, 60);
    assert.equal(ghost.view(), 'empty', 'la salle fantôme reste « vide »');
  }
  {
    const { w, host, guests } = room({ n: 2, nb: 1 });
    host.ev('jeuNextRound()'); sec(w, 4.5); guests[0].found(); sec(w, 615);
    assert.equal(guests[0].view(), 'final'); assert.match(guests[0].html, /jeu-podium/);
    host.offline = true; sec(w, 65);
    assert.match(guests[0].html, /jeu-podium/, 'l’hôte à 0 point n’est plus compté présent : le podium reste');
    assert.doesNotMatch(guests[0].html, /jeuRejouer\(\)|jeuAgain\(\)/);
    sec(w, 20);
    assert.ok(guests[0].ev('jeuIsHost()'));
    assert.match(guests[0].html, /jeuRevanche\(\)"><svg[^]*?<\/svg><span>Rejouer/, 'devenu hôte : le même bouton que tout le monde (21 h 33) ; il a gagné : « Rejouer » (22 h 14)');
    guests[0].ev('jeuRevanche()'); sec(w, 2);
    assert.equal(guests[0].J('g'), 1, 'seul dans la salle, sa revanche suffit : ça relance');
    sec(w, 6);
    assert.ok(/^(draw0|play0)$/.test(guests[0].view()), 'et la partie repart toute seule : ' + guests[0].view());
  }
  assert.ok(html.includes("if(!J.solo)return `<div class=\"jeu-fin-actions\">${jeuRevancheHTML()}</div>`;"), 'le bilan d’une salle : la carte de la revanche, pour l’hôte comme pour les autres (21 h 52)');
});

/* 9 novembre, 12 h 47 (Elisa : « corrige ») */
test('12 h 47 : l’hôte perd le réseau pile à la fin de la dernière manche : l’écran de fin arrive quand même, sans attendre le relais', () => {
  const { w, host, guests } = room({ n: 3, nb: 1 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  guests[0].found(); guests[1].found(); sec(w, 2);
  host.found(); sec(w, 1); host.offline = true; sec(w, 3);
  for (const g of guests) assert.equal(g.view(), 'play0', g.name + ' : sa carte, « Tes points arrivent dans 5 s » (13 novembre, 17 h 31)');
  sec(w, 5);
  for (const g of guests) { assert.equal(g.view(), 'final', g.name + ' : le podium, sans l’hôte'); assert.match(g.html, /jeu-podium/); assert.doesNotMatch(g.html, /jeuAgain\(\)/); }
  assert.equal(guests[0].J('over'), false, 'la fin de partie n’est pas encore partie');
  sec(w, 90);
  assert.ok(guests[0].ev('jeuIsHost()'));
  assert.equal(guests[1].J('over'), true, 'le nouvel hôte envoie la fin');
  guests[0].ev('jeuAgain()'); sec(w, 2);
  for (const g of guests) assert.equal(g.view(), 'lobby', g.name + ' : « Rejouer dans cette salle »');
});

test('12 h 47 : en temps normal, l’écran de fin arrive avec la fin de l’hôte, chez tous en même temps', () => {
  const { w, host, guests } = room({ n: 2, nb: 1 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  host.found(); guests[0].found(); sec(w, 6.5);
  assert.equal(host.view(), 'final'); assert.equal(guests[0].view(), 'final'); assert.equal(guests[0].J('over'), true);
  assert.ok(html.includes("if(fin&&n>=J.nb-1&&!jeuIsHost()){const t=jeuFinAuto(n);if(t&&Date.now()>=t+JEU_FIN_MARGE)return'final';}"));
});

/* 9 novembre, 13 h 09 (Elisa : « si la personne qui est l’hôte et seule part, ça quitte carrément la salle ») */
test('13 h 09 : l’hôte seul quitte sa salle d’attente (« Veux-tu quitter la salle ? », 13 h 11) ; son code ne mène plus à personne', () => {
  const w = new World();
  const h = makeClient(w, 'Hôte'); const asks = []; let partie = 0;
  h.ctx.lqAsk = q => { asks.push(q.titre + ' ' + q.texte); return { then: f => f(q.partirSiTrois ? 'trois' : true) }; }; h.ctx.__partie = () => { partie++; h.ev('jeuStop()'); };
  h.host('SEUL42'); sec(w, 3);
  assert.equal(h.view(), 'lobby');
  h.ev('jeuLeaveAsk(()=>__partie())'); sec(w, 2);
  assert.deepEqual(asks, ['Quitter la salle\u00a0? Tu es encore seul·e dans la salle. Si tu la quittes, elle sera automatiquement supprimée.']); assert.equal(partie, 1);
  const tard = makeClient(w, 'Tard'); tard.join('SEUL42'); sec(w, 60);
  assert.equal(tard.view(), 'empty', 'la salle est fermée : « Cette salle est vide »');
  /* resté seul après le départ de l’hôte : pareil */
  const { w: w2, host, guests } = room({ n: 2 });
  host.ev('jeuStop()'); sec(w2, 5);
  assert.ok(guests[0].ev('jeuIsHost()'));
  assert.match(guests[0].ev('jeuLeaveQuestion().texte'), /elle sera automatiquement supprimée/);
});

/* 9 novembre, 13 h 20 (Elisa : la salle d’attente selon le rôle ; « Retirer ce joueur » à 60 s, avec une question, jamais tout seul) */
/* 9 novembre, 14 h 01 (Elisa : « je veux pas possible de supprimer un joueur ; l’hôte lance quand il en a envie, qu’il y ait un ou deux
   sur 3 présents ; le bouton se débloque quand 30 s et non prêt ») */
test('14 h 01 : pas tous prêts, le bouton se débloque à 30 s ; « n’est pas encore prêt·e », puis « prend son temps » ; personne n’est retiré', () => {
  const { w, host, guests } = room({ n: 3, settle: 1, nb: 1 });
  const etat = c => c.ev('jeuLobbyEtatHTML()');
  guests[0].ev('jeuToggleReady()'); sec(w, 1);
  assert.equal(host.ev('jeuPeutLancer()'), false);
  host.ev('jeuLancer()'); sec(w, 1); assert.equal(host.view(), 'lobby', 'bloqué : rien ne part');
  sec(w, 30);
  assert.match(etat(host), /<b>Ami2 n’est pas encore prêt·e\.<\/b><small>Tu peux patienter ou lancer sans ce joueur\.<\/small>/);
  assert.equal(host.ev('jeuPeutLancer()'), true, '30 s : le bouton se débloque');
  assert.doesNotMatch(etat(guests[0]), /Ami2/, 'les invités ne voient pas ces messages');
  sec(w, 30);
  assert.match(etat(host), /<b>Ami2 prend son temps…<\/b><small>Tu peux lancer la partie\.<\/small>/);
  assert.doesNotMatch(host.ev("jeuPlayersHTML('lobby')"), /jeu-pl-x|Retirer/, 'plus de croix');
  assert.ok(!html.includes('jeuRetirer') && !html.includes("case 'retire'"), 'plus de retrait dans l’appli');
  /* Un nouvel arrivant a ses 30 s : le bouton se rebloque, la carte le nomme */
  const n = makeClient(w, 'Ami3'); n.join('ROOM42'); sec(w, 3);
  assert.equal(host.ev('jeuPeutLancer()'), false, 'le dernier arrivé a ses 30 s');
  assert.match(etat(host), /<b>En attente de Ami2 et Ami3…<\/b>/);
  sec(w, 30);
  assert.match(etat(host), /<b>Ami2 et Ami3 ne sont pas encore prêts\.<\/b><small>Tu peux patienter ou lancer sans eux\.<\/small>/);
  assert.equal(host.ev('jeuLobbyLabel()'), 'Lancer la partie');
  host.ev('jeuLancer()'); sec(w, 1);
  assert.ok(host.J('rounds[0]'), 'l’hôte lance sans eux');
  /* 14 h 09 : sans les joueurs non prêts ; eux lisent « Oups, la partie a déjà démarré ! » */
  assert.equal(guests[0].view(), 'draw0', 'la prête joue');
  for (const c of [guests[1], n]) { assert.equal(c.view(), 'oups', c.name); assert.match(c.html, /Oups, la partie a déjà démarré\u00a0!/);
    assert.match(c.html, /Tu n’étais pas prêt·e au lancement\. Pas de panique, d’autres salles t’attendent\./); assert.doesNotMatch(c.html, /prochaine/, '14 h 22 : plus « tu joueras la prochaine partie »');
    assert.match(c.html, /<button type="button" class="room-go jeu-retour" onclick="openJeu\(\)"><span>Retour aux défis<\/span><i class="jeu-ready-fl" aria-hidden="true">/, 'la flèche qui avance');
    assert.match(c.html, /Retour automatique dans <b id="jeu-oups-n">30<\/b>\u00a0s/, '14 h 24 : le compte à rebours'); }
  for (const c of [host, guests[0]]) assert.deepEqual(c.live(), ['Hôte', 'Ami1'], c.name + ' : la partie se joue à deux');
  sec(w, 3.5); host.found(); guests[0].found(); sec(w, 2.5);
  assert.equal(host.view(), 'play0', 'la manche finit sans attendre les absents de la partie (la dernière : sa carte, puis l’écran de fin)');
  assert.match(host.html, /Tes points arrivent dans/);
  /* Un « prêt » touché trop tard ne change rien */
  guests[1].ev('jeuToggleReady()'); sec(w, 1); assert.equal(guests[1].view(), 'oups');
  /* 14 h 24 : au bout de 30 s, retour sur Défis tout seul */
  n.ctx.leaveLessonScreen = t => { n.parti = t; };
  sec(w, 12); assert.equal(n.parti, undefined, 'pas avant 30 s'); sec(w, 12); assert.equal(n.parti, 'defis', 'retour sur Défis');
  /* L’hôte part : la main passe à un participant, jamais à un absent de la partie */
  host.ev('jeuStop()'); sec(w, 6);
  assert.equal(guests[0].ev('jeuIsHost()'), true);
  for (const c of [guests[1], n]) assert.equal(c.ev('jeuIsHost()'), false);
  /* « Rejouer » : la partie suivante, tout le monde revient dans la salle d’attente */
  guests[0].ev('jeuFinish()'); sec(w, 2); guests[0].ev('jeuAgain()'); sec(w, 2);
  for (const c of [guests[0], guests[1], n]) assert.equal(c.view(), 'lobby', c.name);
  assert.deepEqual(guests[0].live().sort(), ['Ami1', 'Ami2', 'Ami3']);
});

test('14 h 09 : tout le monde prêt, tout le monde joue ; le lancement emporte la liste, la même chez tous', () => {
  const { w, host, guests } = room({ n: 3, settle: 1 });
  guests.forEach(g => g.ev('jeuToggleReady()')); sec(w, 1);
  host.ev('jeuLancer()'); sec(w, 1);
  const who = host.J('rounds[0]') && host.ev('[...JEU.partants].sort()');
  assert.deepEqual(who, [host.pid(), ...guests.map(g => g.pid())].sort());
  for (const g of guests) { assert.equal(g.view(), 'draw0'); assert.deepEqual(g.ev('[...JEU.partants].sort()'), who); }
  /* Le serveur fait foi : sa liste (joueurs) passe avant celle de l’hôte (who) */
  assert.ok(html.includes("const lst=Array.isArray(m.joueurs)?m.joueurs:Array.isArray(m.who)?m.who:null;"));
});

/* 9 novembre, 15 h 41 (Elisa : « si la personne a validé la manche, même si elle n’a pas terminé les autres manches, elle va gagner ses
   points ; vérifie, teste avec plusieurs personnes ») */
test('15 h 41 : qui part garde les points des manches qu’il a validées, même celle que les autres jouent encore', () => {
  const jusqua = (w, c, re) => { for (let i = 0; i < 80 && !re.test(c.view() || ''); i++) sec(w, 0.5); };
  const total = c => c.ev('(state.salle&&state.salle.pts)||0');
  const partie = () => { const r = room({ n: 3, nb: 3, settle: 1 }); r.guests.forEach(g => g.ev('jeuToggleReady()')); sec(r.w, 1); r.host.ev('jeuLancer()'); sec(r.w, 4.5); return r; };
  {
    /* Il valide la manche 1 et part pendant cette manche (les autres cherchent encore) : avant, 0 point */
    const { w, host, guests } = partie();
    guests[0].found(); sec(w, 1);
    const gagne = guests[0].ev('jeuRanking(0).find(x=>x.pid===JEU.me).pts');
    guests[0].ev('jeuStop()'); sec(w, 2);
    assert.ok(gagne > 0); assert.equal(total(guests[0]), gagne, 'la manche validée compte');
    host.found(); guests[1].found();
    for (let m = 1; m < 3; m++) { jusqua(w, host, new RegExp('^play' + m + '$')); sec(w, 0.5); host.found(); guests[1].found(); }
    jusqua(w, host, /^final$/);
    assert.ok(host.ev('jeuScores().some(x=>x.name==="Ami1"&&x.pts>0)'), 'les autres le voient au podium avec ses points');
  }
  {
    /* Il valide les manches 1 et 2, part pendant la 3 sans l’avoir trouvée */
    const { w, host, guests } = partie();
    for (let m = 0; m < 2; m++) { jusqua(w, host, new RegExp('^play' + m + '$')); sec(w, 0.5); guests[0].found(); host.found(); guests[1].found(); }
    jusqua(w, host, /^play2$/); sec(w, 0.5);
    const avant = guests[0].ev('jeuScores().find(x=>x.pid===JEU.me).pts');
    guests[0].ev('jeuStop()'); sec(w, 2);
    assert.equal(total(guests[0]), avant, 'ses deux manches');
    assert.equal(guests[0].ev('state.salle.hist[0].ok'), 2);
  }
  {
    /* Il part sans rien avoir validé : rien */
    const { w, guests } = partie();
    guests[0].ed.value = 'SELECT 1'; guests[0].ev('jeuRun()'); sec(w, 1);
    guests[0].ev('jeuStop()'); sec(w, 2);
    assert.equal(total(guests[0]), 0);
  }
});

test('9 novembre, 18 h : la salle pleine refuse vraiment le 7e (transport local en ordre, refus d’une reprise, recompte de l’hôte)', () => {
  const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(app.includes("bc.onmessage=e=>{const c=e.data&&e.data.eph?e.data:rel(e.data);if(replayed)onMsg(c);else queue.push(c);};"), 'le direct local attend la fin du rejeu');
  assert.ok(app.includes("if(m.who===J.me){if(m.hu!==J.helloU&&m.hu!==J.resumeU)return;J.full=true;J.view='';}"), 'un refus visant le « hello » de reprise compte aussi');
  assert.ok(/function jeuTropPlein\(\)\{[\s\S]{0,260}l\.slice\(J\.max\)/.test(app) && app.includes('  jeuTropPlein();\n'), 'l’hôte refait le compte à chaque battement');
});

test('13 novembre, 20 h 33 : plus de « Voir ma requête et son résultat » sur la carte de la salle (sa requête est dans la correction, à la fin)', () => {
  const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
  assert.ok(!app.includes('r.mine') && !app.includes('jeu-done-sql') && !css.includes('.jeu-done-sql'));
  assert.ok(app.includes('    r.sql=sql;   // « Ta requête » dans la correction'), 'la requête acceptée reste pour la correction');
  assert.ok(css.includes('html.lq .jeu-sql-pied{display:flex;'), 'le pied des éditeurs garde ses styles');
});

test('9 novembre, 18 h 09 : « N lignes · ms » en pied de chaque éditeur (défi, salle, console, Teste) ; pâlit quand on retouche', () => {
  const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
  for (const s of ["edPied('ed-console',res,ms);", "edPied('ed-console',null);", "edPied('ed-lesson',userRes,ms);", "edPied('ed-lesson',write?null:userRes,ms);", "edPied(ta,follow?null:res,ms);", "edPied(ta,'err');"]) assert.ok(app.includes("typeof edPied==='function'&&" + s), s);
  assert.ok(app.includes("if(p)p.classList.add('is-perime');") && css.includes('html.lq .ed-pied.is-perime{opacity:.4}'), 'retouchée : le pied pâlit');
  assert.ok(css.includes('html.lq #lesson-out>.result-meta,html.lq .xf-result>.result-meta{display:none!important}'), 'plus de pastille sous l’éditeur');
});

test('9 novembre, 18 h 21 : le pied dit aussi les colonnes, « ✕ Erreur » en rouge ; la console : « ✓ Exécutée » sur le bouton, plus de « Encore 4 colonnes »', () => {
  const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
  assert.ok(app.includes("if(res==='err')return `<span class=\"jsp-n is-ko\"><i aria-hidden=\"true\">✕</i>${label||'Erreur'}</span>`;"), 'l’erreur dans le pied');
  assert.ok(app.includes("if(cols)bits.push(`<span class=\"jsp-c\">${cols} colonne${cols>1?'s':''}</span>`);"), 'les colonnes');
  assert.ok(app.includes("fb=[true,'Exécutée'];") && app.includes("edPied('ed-console','err',null,verrou&&/readonly|query_only/i.test(e.message)?'Lecture seule':'Erreur');"), 'la console');
  assert.ok(css.includes('html.lq #console-out .result-live>.result-meta>span{display:none!important}'), 'au-dessus du tableau de la console : « Résultat » seul');
});

test('9 novembre, 18 h 21 : dans la console, « Tables disponibles » parle de la base de la console, même après un défi', () => {
  const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(app.includes('const dId=o&&o.console?null:defiBaseId(defiActif());let tabs;') && app.includes('errBox(e.message,sql,{console:1})'));
});

test('9 novembre, 18 h 43 : jeuNextRound garde sa garde (seul l’hôte tire une manche)', () => {
  const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const i = app.indexOf('function jeuNextRound(){');
  assert.ok(/\n  if\(!J\|\|!jeuIsHost\(\)\)return;/.test(app.slice(i, i + 400)));
});

test('9 novembre, 18 h 43 : lancée avec la liste des prêts, un nouveau venu lit « La partie a déjà commencé », pas « Oups »', () => {
  const { w, host, guests } = room({ n: 3, nb: 1 });
  for (const g of guests) g.ev('jeuToggleReady()');
  sec(w, 1); host.ev('jeuLancer()'); sec(w, 4.5);
  const late = makeClient(w, 'Retard'); late.join('ROOM42'); sec(w, 3);
  assert.equal(late.view(), 'tard');
  assert.ok(!late.J('horsPartie'));
});

test('9 novembre, 18 h 43 : refusé quand la salle était pleine, puis revenu après le lancement : « La partie a déjà commencé »', () => {
  const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(app.includes('J.inscrits.delete(m.who);   // refusé (salle pleine)'));
});

test('9 novembre, 19 h 30 : « Encore 3 caractères » sur le bouton ; « Oups » sans le code ; « Salle complète ! » partout le même texte', () => {
  const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(app.includes("lib=c.length&&reste>0?`Encore ${reste} caractère${reste>1?'s':''}`:'Rejoindre la salle';"));
  assert.ok(app.includes("s</p>`,'is-lost',true);   // 19 h 30 : sans le code de la salle"));
  assert.ok(app.includes("html=etat('user','Salle complète&nbsp;!',`Cette salle a déjà atteint sa limite de ${J.max} joueurs. Essaie un autre code ou crée ta propre salle.`"));
});

test('9 novembre, 19 h 40 : « Oups » une fois suffit ; un lien en plein défi se cherche sur place ; l’hôte reste l’hôte à l’écran pendant une reprise', () => {
  const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(app.includes("if(J.tard||J.horsPartie){jeuVerifEchec('commencee');return false;}"), 'le code retapé après « Oups » : « Trop tard, la partie a commencé ! »');
  assert.ok(app.includes("if(enLecon&&!document.querySelector('#dx-feuille #jeu-code')){jeuInvitationEchec(r);return;}") && app.includes("oui:\"Retour aux défis\",fleche:true,non:null"), 'salle pleine en plein défi : un message par-dessus, on reste');
  assert.ok(app.includes('const J=JEU,host=J.hostPid===J.me,{live,prets}=jeuPrets()') && app.includes('const host=J.hostPid===J.me;   // l’écran'), 'Safari, retour sur la page : la carte ne passe plus au vert');
});
test('9 novembre, 19 h 40 : la salle d’attente en reprise (Safari revient) garde l’écran de l’hôte', () => {
  const { w, host } = room({ n: 1 });
  const avant = host.html;
  host.ev('JEU.replaying=true;JEU.replayEnd=Date.now()+6000;jeuRender()');
  assert.match(host.html, /id="jeu-go"/, 'le bouton de l’hôte reste');
  assert.doesNotMatch(host.html, /id="jeu-ready"/, 'pas le bouton « Prêt » des invités');
});

test('9 novembre, 20 h 29 : un même pas de 16 px entre les blocs des pages de la salle (fin de partie, podium, résultats)', () => {
  const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
  for (const r of ['html.lq .jeu-fin-actions{margin:16px 0 6px}', 'html.lq #jeu-root>.l-sub{margin-bottom:16px!important}', 'html.lq #jeu-root>.jeu-card,html.lq #jeu-root>.jeu-bilan+.jeu-card{margin-top:16px}', 'html.lq #jeu-root>.jeu-podium{margin-bottom:0}']) assert.ok(css.includes(r), r);
  assert.ok(/html\.lq #app \.jeu-bilan\{[^}]*margin:16px 0 16px;/.test(css) && /html\.lq #jeu-root \.jr2-hero\{[^}]*margin:14px 0 16px;/.test(css));
});

test('9 novembre, 20 h 49 : le même pas vertical sur toute l’appli et l’onboarding (16 entre blocs, 12 dans les listes, 8 titre / phrase)', () => {
  const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
  const ob = fs.readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');
  for (const r of ['html.lq #scr-compte .acc-stack{gap:16px!important}', 'html.lq #scr-learn #modules>.home-module{margin-bottom:12px!important}', 'html.lq #scr-console .console-projects-head{margin:16px 1px 12px!important}', 'html.lq #scr-entretien .ent-list{display:flex;flex-direction:column;gap:12px!important}']) assert.ok(css.includes(r), r);
  for (const r of ['html #onboarding.ob-vitrine .ob-screen>.ob-chat{margin:12px 0 16px!important}', 'html #onboarding.ob-vitrine .ob-screen>.ob-answer-list{display:flex;flex-direction:column;gap:12px!important}']) assert.ok(ob.includes(r), r);
  assert.ok(ob.indexOf('html #onboarding.ob-vitrine .ob-screen>.ob-chat{margin:12px 0 16px!important}') < ob.indexOf('html #onboarding.ob-vitrine.ob-fit-1 '), 'avant les paliers ob-fit, qui resserrent sur les petits écrans');
});

test('9 novembre, 21 h 30 : une table ouverte glisse sous la barre ; cartes de table au même calme dans la Console et le schéma', () => {
  const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
  const t = app.slice(app.indexOf('function toggleTableSchema(name){'), app.indexOf('function voirDonneesTable('));
  assert.ok(t.includes('if(r.top>=70&&r.top<=h*.28)return;') && t.includes('ecranVers(el);'), 'la table ouverte se montre');
  for (const r of ['html.lq #scr-console .tbu-h,html.lq #schema-sheet .umd-h{background:#fff!important;', 'html.lq #schema-sheet .sch-table.is-tbu .sch-head{', 'html.lq #scr-console .tbu-c i.is-fk,html.lq #schema-sheet .umd-c i.is-fk{background:#EEEBF8;']) assert.ok(css.includes(r), r);
});

test('9 novembre, 21 h 38 : import, plus d’étiquette « Nouvelle », la page va au compte rendu, des erreurs en français et une image refusée', () => {
  const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
  assert.ok(css.includes('html.lq #scr-console .console-schema-panel .db-tblock.is-new::after{content:none!important;display:none!important}'));
  assert.ok(app.includes("if(cadre&&typeof ecranVers==='function')requestAnimationFrame(()=>requestAnimationFrame(()=>ecranVers(cadre)));"));
  const ctx = vm.createContext({});
  const f = n => { const i = app.indexOf('function ' + n + '('); return app.slice(i, app.indexOf('\n}\n', i) + 3); };
  vm.runInContext(f('importPasUnTableau') + f('importErreurLisible'), ctx);
  assert.match(ctx.importPasUnTableau('photo.png', new Uint8Array([0x89, 0x50, 0x4E, 0x47, 1, 2])), /une image, pas un tableau/);
  assert.match(ctx.importPasUnTableau('releve.pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46])), /un PDF/);
  assert.equal(ctx.importPasUnTableau('ventes.csv', new Uint8Array([0x61, 0x3B, 0x62])), '');
  assert.match(ctx.importErreurLisible(new SyntaxError('Unexpected end of JSON input')), /JSON est incomplet ou mal formé/);
  assert.match(ctx.importErreurLisible(new Error('il faut une ligne d’en-têtes et au moins une ligne de données.')), /n’a pas de données/);
});

test('9 novembre, 21 h 46 : la ligne d’une colonne, la même partout : un filet entre deux colonnes, le cadre « ex : » toujours sous le nom, plus de fond gris', () => {
  const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
  for (const r of ['html.lq #scr-console .db-tblock.tbu .tbu-xl{display:block;margin-top:6px;', 'html.lq #scr-console .db-tblock.tbu .tbu-r{align-items:baseline;min-height:0}',
    'html.lq #schema-sheet .sch-table.is-tbu .sch-col .cxl{display:block;margin-top:6px;', 'html.lq #schema-sheet .umd-c{background:none!important}',
    'html.lq #scr-console .db-tblock.tbu .tbu-c+.tbu-c{box-shadow:inset 0 1px 0 var(--line-2,#EEEBF8)}']) assert.ok(css.includes(r), r);
  assert.ok(!css.includes('html.lq #scr-console .tbu-c.is-on,html.lq #schema-sheet .umd-c.is-on{background:#F6F4FD}'), 'plus de fond gris sous les colonnes clés');
});

test('9 novembre, 21 h 50 : nouveau projet, le champ seul sur sa ligne, puis « Annuler » et « Créer le projet » côte à côte', () => {
  const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(app.includes('<div class="console-create-acts"><button type="button" class="console-create-cancel" onclick="closeProjectCreator()">Annuler</button><button type="submit" class="console-create-cta">Créer le projet</button></div>'));
});

test('9 novembre, 21 h 53 : « Importer » reste collé en bas de la feuille d’import, la liste des tables ne défile plus seule', () => {
  const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
  assert.ok(css.includes('html.lq .imp-sheet>.imp-go{position:sticky;bottom:0;z-index:3;') && css.includes('html.lq .imp-prev.is-riche{max-height:none;overflow:visible}'));
});

test('9 novembre, 21 h 57 : importer dans un projet qui a déjà des tables : identiques laissées, nouvelles ajoutées, différentes au choix', () => {
  const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(app.includes("oui:bilan.nouvelles.length?'Ajouter au projet':'Mettre à jour le projet',trois:'Remplacer le contenu',troisDanger:true,non:null"), 'ajouter ou remplacer le contenu');
  assert.ok(app.includes("oui:un?'Mettre à jour':'Les mettre à jour',trois:un?'Conserver la version actuelle':'Conserver les versions actuelles',non:null"), 'les tables différentes : mettre à jour ou conserver');
  assert.ok(app.includes("copierTablesSqlite(p.bytes,database,pendingImport.saute);") && app.includes("if(saute&&saute.has(String(t).toLowerCase()))continue;"), 'une base SQLite saute ses tables identiques');
  assert.ok(app.includes("{const tr=el.querySelector('.lq-ask-trois');if(tr)tr.onclick=()=>{if(typeof o.surTrois==='function')try{o.surTrois();}catch(e){}fin('trois');};}"), 'lqAsk : un deuxième choix (13 novembre : o.surTrois dans le geste)');
});

test('9 novembre, 22 h 09 : l’historique de la Console garde le début d’une requête de plus de 20 000 caractères, et ne l’épingle pas', () => {
  const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(app.includes('const HIST_SQL_MAX=20000;') && app.includes("const row={sql:coupe?plein.slice(0,HIST_SQL_MAX):plein,"));
  assert.ok(app.includes("const meta=it.coupe?['Trop longue : seul le début est gardé',fmtHistWhen(it.ts)].join(' · '):it.ok"));
  assert.ok(app.includes("if(idx<0&&t.length>HIST_SQL_MAX){lqInfo('Requête trop longue',") && app.includes("if(idx<0&&it.coupe){lqInfo('Requête trop longue',"));
  const ctx = vm.createContext({ HIST_SQL_MAX: 20000, consoleSqlKey: s => String(s || '').trim().toLowerCase() });
  const i = app.indexOf('function dedupeConsoleQueries('); vm.runInContext(app.slice(i, app.indexOf('\n}\n', i) + 3), ctx);
  const r = ctx.dedupeConsoleQueries([{ sql: 'x'.repeat(30000) }, { sql: 'SELECT 1' }], 24);
  assert.equal(r[0].sql.length, 20000); assert.equal(r[0].coupe, true); assert.equal(r[1].sql, 'SELECT 1');
});
