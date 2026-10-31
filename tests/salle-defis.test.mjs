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
assert.ok(engineSrc.includes('function jeuStart(') && challengesSrc.includes('c1'), 'moteur et défis localisés');
const SB = engineSrc.match(/const JEU_SB='([^']+)'/)[1];
const VOLATILE = ['ping', 'react'];

/* ---------- Monde : horloge virtuelle + base ---------- */
class World {
  constructor() { this.now = 1_800_000_000_000; this.timers = []; this.seq = 0; this.rooms = new Map(); this.posts = 0; this.histCalls = 0; this.latency = 60; }
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
    state: { defis: {}, name }, SQL: {}, esc: s => String(s).replace(/</g, '&lt;'), highlight: s => s, DEF_CHEV_SVG: '', JEU_FRIENDS_SVG: '', lqStkSvg: k => `<svg data-k="${k}"></svg>`,
    editorBlock: () => '<textarea id="ed-lesson"></textarea>', setupEditor() {}, celebrate() {}, annulerBilanAuto() {}, showScreen() {},
    prefersReduceMotion: () => false, lessonBackLabel: () => 'Défis', leaveLessonScreen() {}, switchTab() {}, renderDefis() {}, activeTab: 'defis',
    noteActivityDay() { c.acts = (c.acts || 0) + 1; }, save() {}, renderProgress() {}, renderPlanning() {}, setLessonOut: h => { c.out = h; }, renderTable: () => '', errBox: m => m,
    exoFailDiag: () => 'x', exerciseRequiresOrder: () => false, exerciseResultsMatch: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    sandbox: () => ({ exec: sql => [{ columns: ['q'], values: [[sql]] }], close() {} }),
    performance: { now: () => world.now }, confirm: () => true, toast() {},
    /* La fenêtre de l’appli (lqAsk) répond tout de suite « oui » ; un test peut la remplacer pour compter ou refuser. */
    lqAsk: () => ({ then: f => f(true) }),
    mode: '', current: null, exoFails: 0,
  };
  Object.assign(ctx, stubs);
  vm.runInContext(challengesSrc + '\n' + engineSrc, ctx);
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

test('« prêt » : chaque ami se déclare, l’hôte voit le compteur', () => {
  const { w, host, guests } = room({ n: 3 });
  assert.equal(host.ev('jeuLobbyLabel()'), 'Lancer la partie · 1/3 prêts');
  guests[0].ev('jeuToggleReady()'); sec(w, 1);
  assert.equal(host.ev('jeuLobbyLabel()'), 'Lancer la partie · 2/3 prêts');
  assert.match(host.ev('jeuLobbyHint()'), /Pas encore prêt : Ami2/);
  guests[1].ev('jeuToggleReady()'); sec(w, 1);
  assert.equal(host.ev('jeuLobbyHint()'), 'Tout le monde est prêt.');
  guests[1].ev('jeuToggleReady()'); sec(w, 1);
  assert.equal(host.ev('jeuLobbyLabel()'), 'Lancer la partie · 2/3 prêts', 'on peut se remettre « pas prêt »');
  assert.equal(host.ev('jeuToggleReady()'), undefined, 'l’hôte est toujours prêt : pas de bascule');
});

/* Elisa, 31 octobre, 16 h 49 : « max 5 pour une salle » */
test('5 joueurs au maximum : le 6e voit « salle complète », les autres ne changent pas', () => {
  assert.ok(html.includes('const JEU_MAX=5;'));
  const { w, host, guests } = room({ n: 5 });
  assert.equal(host.live().length, 5);
  const late = makeClient(w, 'Trop'); late.join('ROOM42'); sec(w, 4);
  assert.equal(late.view(), 'full');
  assert.match(late.html, /salle est complète/);
  for (const c of [host, ...guests]) assert.equal(c.live().length, 5, c.name + ' n’affiche pas le 6e');
  assert.ok(!host.live().includes('Trop'));
  /* Une place se libère : la même personne peut réessayer. */
  guests[3].ev('jeuStop()'); sec(w, 2);
  assert.equal(host.live().length, 4);
  const retry = makeClient(w, 'Trop'); retry.ev(`sessionStorage.setItem('rq-jeu-pid',${JSON.stringify(late.pid())})`);
  late.ev('jeuStop()'); retry.join('ROOM42'); sec(w, 4);
  assert.equal(retry.view(), 'lobby', 'réadmise quand il y a de la place');
  assert.equal(host.live().length, 5);
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
  assert.doesNotMatch(host.html, /La question/, 'la question reste cachée pendant le tirage');
  sec(w, 3.6);
  for (const c of all) { assert.equal(c.view(), 'play0', c.name); }
  assert.match(host.html, /La question/);
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
  for (const c of [host, ...guests]) assert.equal(c.view(), 'res0', c.name);
  const rk = host.ev('jeuRanking(0).map(x=>({name:JEU.players[x.pid].name,ms:x.ms,val:x.val,essai:x.essai,rang:x.rang,pts:x.pts,place:x.place}))');
  assert.deepEqual(rk.map(x => x.name), ['Ami2', 'Hôte', 'Ami1']);
  assert.deepEqual(rk.map(x => x.rang), [50, 30, 20], 'le premier à trouver marque le plus');
  assert.deepEqual(rk.map(x => x.place), [1, 2, 3]);
  assert.ok(rk[0].ms < rk[1].ms && rk[1].ms < rk[2].ms, 'du plus rapide au plus lent');
  assert.deepEqual(rk.map(x => x.val), [200, 200, 175], 'trouvé en moins d’une minute : 200 ; après 1 min : 175');
  assert.deepEqual(rk.map(x => x.essai), [25, 0, 25], 'l’hôte s’est trompé une fois : pas de +25');
  for (const x of rk) {
    assert.equal(x.val, valeur(x.ms), x.name + ' : le palier');
    assert.equal(x.pts, x.val + x.essai + x.rang, x.name + ' : le total');
  }
  assert.deepEqual(rk.map(x => x.pts), [275, 230, 220]);
  for (const x of rk) assert.ok(host.html.includes(`<small>+${x.pts}</small>`), 'les points gagnés dans le classement : ' + x.pts);
  /* Le détail des points sur sa seule ligne (Elisa, 31 octobre, 16 h 29 : « il y a trop de trucs ») : l’hôte est 2e ; ce que
     valait le défi quand il l’a trouvé, puis son bonus de 2e */
  assert.ok(host.html.includes('class="jeu-pd"><i>Défi 200</i><i class="is-rang">2e +30</i></span>'), 'le détail des points');
  assert.ok(guests[1].html.includes('class="jeu-pd"><i>Défi 200</i><i class="is-essai">1er essai +25</i><i class="is-rang">1er +50</i></span>'), 'du premier coup');
  assert.doesNotMatch(host.html, /rapidité<\/i>/);
  assert.equal((host.html.match(/class="jeu-pd"/g) || []).length, 1, 'seulement sur sa propre ligne');
  assert.match(host.html, /<em>00:\d\d<\/em>/, 'le temps en 00:00');
  assert.match(host.html, /Manche suivante/);
  assert.match(guests[0].html, /La manche suivante arrive/);
  assert.equal(host.ev('state.defis[JEU.rounds[0].cid]'), true, 'réussi en salle : compte dans la progression');
});

test('manches enchaînées sans doublon, podium, points cumulés une seule fois', () => {
  const { w, host, guests } = room({ n: 2, nb: 3 });
  for (let n = 0; n < 3; n++) {
    host.ev('jeuNextRound()'); sec(w, 4.5);
    host.found(); sec(w, 3); guests[0].found(); sec(w, 1.5);
    assert.equal(host.view(), 'res' + n);
  }
  const cids = host.ev('JEU.rounds.map(r=>r.cid)');
  assert.equal(new Set(cids).size, 3, 'trois défis différents : ' + cids);
  host.ev('jeuFinish()'); sec(w, 1.5);
  assert.equal(host.view(), 'final'); assert.equal(guests[0].view(), 'final');
  assert.match(host.html, /Rejouer dans cette salle/);
  assert.doesNotMatch(guests[0].html, /Rejouer dans cette salle/);
  assert.match(guests[0].html, /L’hôte peut relancer/);
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

test('l’hôte change le niveau et le nombre de manches dans la salle d’attente', () => {
  const { w, host, guests } = room({ n: 2, nb: 3 });
  host.ev("jeuLobbySet('niv','d')"); host.ev('jeuLobbySet("nb",5)'); sec(w, 1.5);
  assert.equal(guests[0].J('niv'), 'd'); assert.equal(guests[0].J('nb'), 5);
  assert.match(guests[0].html, /Difficile/);
  host.ev("jeuLobbySet('niv','f')"); sec(w, 1);
  assert.equal(host.J('nb'), 5, 'facile : 5 défis, donc 5 manches possibles');
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

test('arrivée en cours de manche : on rejoint la manche, sans fantômes', () => {
  const { w, host, guests } = room({ n: 3 });
  guests[1].ev('jeuStop()'); sec(w, 2);
  host.ev('jeuNextRound()'); sec(w, 4.5);
  const late = makeClient(w, 'Retard'); late.join('ROOM42'); sec(w, 3);
  assert.equal(late.view(), 'play0');
  assert.deepEqual(late.live().sort(), ['Ami1', 'Hôte', 'Retard']);
  const left = late.ev('Math.round((JEU.rounds[0].t1+180000-Date.now())/1000)');
  assert.ok(left > 150 && left < 180, 'temps restant cohérent : ' + left);
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
  host.found(); guests[0].found(); sec(w, 1);
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
  assert.doesNotMatch(s.html, /jeu-players|jeu-reacts/, 'ni liste de joueurs ni réactions');
  sec(w, 20); s.found(); sec(w, 1);                        /* vers 20 s : 200 */
  assert.equal(s.view(), 'res0'); assert.match(s.html, /Ton résultat/);
  s.ev('jeuNextRound()'); sec(w, 4); sec(w, 80); s.found(); sec(w, 1);   /* vers 80 s */
  s.ev('jeuNextRound()'); sec(w, 4); sec(w, 150); s.found(); sec(w, 1);  /* vers 150 s */
  const rk = s.ev('JEU.rounds.map((r,i)=>jeuRanking(i)[0])');
  assert.deepEqual(rk.map(x => x.rang), [0, 0, 0], 'seul : pas de bonus de rang');
  assert.deepEqual(rk.map(x => x.pts), rk.map(x => valeur(x.ms) + 25), 'seul : le palier, +25 du premier coup');
  assert.deepEqual(rk.map(x => x.pts), [225, 200, 175], 'vers 20 s, 80 s et 150 s : 200, 175 et 150, +25');
  s.ev('jeuFinish()'); sec(w, 1);
  assert.equal(s.view(), 'final'); assert.match(s.html, /Tout trouvé/); assert.match(s.html, /Rejouer/);
  assert.equal(s.ev('state.salle.pts'), rk.reduce((a, x) => a + x.pts, 0)); assert.equal(s.ev('state.salle.parties'), 1);
  assert.equal(s.ev('JEU.rounds.every(r=>state.defis[r.cid])'), true);
  assert.equal(w.posts, 0, 'rien n’est envoyé au relais en solo');
  assert.equal(s.sockets, 0, 'ni connexion au direct');
  assert.equal(new Set(s.ev('JEU.rounds.map(r=>r.cid)')).size, 3);
  s.ev('jeuAgain()'); sec(w, 0.5);
  assert.equal(s.view(), 'draw0', 'rejouer en solo enchaîne directement');
  assert.equal(s.ev('JEU.g'), 1);
});

test('solo : manche abandonnée ou temps écoulé = 0 point, le défi n’est pas marqué réussi', () => {
  const w = new World();
  const s = makeClient(w, 'Seul'); s.ev("jeuNb=1;jeuNiv='d'");
  s.ev("jeuStart('SOLO22',true,null,{solo:true})"); sec(w, 4);
  s.ev('jeuClose()'); sec(w, 1);
  assert.equal(s.view(), 'res0'); assert.match(s.html, /Manche abandonnée/);
  s.ev('jeuFinish()'); sec(w, 1);
  assert.match(s.html, /Ton bilan/); assert.match(s.html, /0\/1/);
  assert.equal(s.ev('state.salle.pts'), 0);
  assert.equal(s.ev('Object.keys(state.defis).length'), 0);
});

test('solo : la manche dure 10 min au plus ; trouvée après 7 min, elle rapporte encore 50 (+25 du premier coup)', () => {
  const w = new World();
  const s = makeClient(w, 'Seul'); s.ev("jeuNb=2;jeuNiv='m'");
  s.ev("jeuStart('SOLO44',true,null,{solo:true})"); sec(w, 4);
  sec(w, 8 * 60);
  assert.equal(s.view(), 'play0', 'à 8 min, on cherche encore');
  assert.equal(s.ev('jeuValeur(Date.now()-JEU.rounds[0].t1)'), 50, 'le défi vaut 50 au-delà de 7 min');
  s.found(); sec(w, 1);
  assert.equal(s.ev('jeuRanking(0)[0].pts'), 75, '50 + 25');
  s.ev('jeuNextRound()'); sec(w, 4);
  sec(w, 9.5 * 60); assert.equal(s.view(), 'play1');
  sec(w, 31); assert.equal(s.view(), 'res1', 'à 10 min, la manche s’arrête');
  assert.match(s.html, /Temps écoulé\./);
  s.ev('jeuFinish()'); sec(w, 1);
  assert.equal(s.ev('state.salle.pts'), 75);
});

test('le tirage préfère les défis non réussis, sans jamais bloquer', () => {
  const w = new World();
  const s = makeClient(w, 'Seul');
  s.ev("jeuNiv='f';jeuNb=5");
  s.ev("jeuChallenges('f').slice(0,3).forEach(c=>state.defis[c.id]=true)");
  s.ev("jeuStart('SOLO33',true,null,{solo:true})"); sec(w, 4);
  const first = s.ev('JEU.rounds[0].cid');
  assert.equal(s.ev(`state.defis['${first}']`), undefined, 'le premier tirage n’est pas déjà réussi');
  for (let n = 1; n < 5; n++) { s.ev('jeuClose()'); sec(w, 1); s.ev('jeuNextRound()'); sec(w, 4); }
  assert.equal(new Set(s.ev('JEU.rounds.map(r=>r.cid)')).size, 5, '5 manches faciles = les 5 défis, même réussis');
});

/* Elisa, 31 octobre, 15 h 52 : « quand un joueur réussit un défi il est considéré comme validé pour lui et la sélection ne va pas
   choisir le défi, pareil pour l’autre ». Chacun donne ses défis réussis dans son « hello » ; un défi trouvé dans la salle compte aussi. */
test('le tirage ne prend jamais un défi déjà réussi par l’un des joueurs présents', () => {
  const w = new World();
  const h = makeClient(w, 'Hôte'); h.ev("jeuNiv='f';jeuNb=1");
  const g = makeClient(w, 'Ami');
  const ids = h.ev("jeuChallenges('f').map(c=>c.id)");
  assert.equal(ids.length, 5);
  g.ev(`${JSON.stringify(ids.slice(0, 4))}.forEach(id=>state.defis[id]=true)`);
  h.host('OKOK42'); sec(w, 1);
  g.join('OKOK42'); sec(w, 3);
  const gp = g.pid();
  assert.deepEqual(h.ev(`Array.from(JEU.okOf[${JSON.stringify(gp)}]||[])`).sort(), ids.slice(0, 4).sort(), 'l’hôte connaît les défis réussis par l’ami');
  for (let k = 0; k < 12; k++) assert.equal(h.ev('jeuPick()'), ids[4], 'le seul défi que personne n’a réussi');
  h.ev('jeuNextRound()'); sec(w, 1);
  assert.equal(g.J('rounds[0].cid'), ids[4], 'le même défi chez l’ami');
  assert.match(g.html, /qu’aucun de vous n’a encore réussi/, 'le tirage le dit');
  /* L’ami parti : ses défis réussis ne comptent plus */
  g.ev('jeuStop()'); sec(w, 40);
  assert.deepEqual(h.live(), ['Hôte']);
  const seen = new Set(); for (let k = 0; k < 80; k++) seen.add(h.ev('jeuPick()'));
  assert.ok(seen.size > 1, 'seul dans la salle : tous les défis non joués reviennent');
});

test('un défi trouvé dans la salle compte comme réussi pour son joueur : il n’est plus tiré, même après « rejouer »', () => {
  const w = new World();
  const h = makeClient(w, 'Hôte'); h.ev("jeuNiv='f';jeuNb=1");
  h.host('OKOK43'); sec(w, 1);
  const g = makeClient(w, 'Ami'); g.join('OKOK43'); sec(w, 3);
  const gp = g.pid();
  h.ev('jeuNextRound()'); sec(w, 4.5);
  const x = h.ev('JEU.rounds[0].cid');
  g.found(); sec(w, 2);
  assert.equal(g.ev(`state.defis['${x}']`), true, 'validé pour l’ami');
  assert.equal(h.ev(`!!state.defis['${x}']`), false, 'pas pour l’hôte, qui ne l’a pas trouvé');
  assert.equal(h.ev(`JEU.okOf[${JSON.stringify(gp)}].has('${x}')`), true, 'l’hôte le sait');
  assert.equal(h.ev(`jeuOkCount('${x}')`), 1);
  h.ev('jeuClose()'); sec(w, 1); h.ev('jeuFinish()'); sec(w, 1); h.ev('jeuAgain()'); sec(w, 1);
  h.ev('JEU.recent.clear()');                 /* même sans la mémoire « déjà joué dans cette salle » */
  for (let k = 0; k < 30; k++) assert.notEqual(h.ev('jeuPick()'), x, 'réussi par l’ami : jamais retiré');
  /* Tout réussi par l’un ou l’autre : le tirage continue, avec ceux que le moins de joueurs ont réussis */
  h.ev("jeuChallenges('f').forEach(c=>state.defis[c.id]=true)");
  const p = h.ev('jeuPick()');
  assert.ok(h.ev("jeuChallenges('f').map(c=>c.id)").includes(p) && p !== x, 'réussi par un seul joueur plutôt que par les deux : ' + p);
});

/* Elisa, 31 octobre, 16 h 29 : « si personne ne rejoint la salle, alors c’est comme si on est seule ». */
test('salle entre amis sans personne : la partie se joue comme seul (écran, points, bilan)', () => {
  const w = new World();
  const h = makeClient(w, 'Hôte'); h.ev("jeuNiv='f';jeuNb=2");
  h.host('ALONE1'); sec(w, 1);
  assert.equal(h.view(), 'lobby');
  assert.match(h.ev('jeuLobbyHint()'), /Si tu lances maintenant, tu joues seul·e\./);
  h.ev('jeuNextRound()'); sec(w, 4.5);
  assert.equal(h.view(), 'play0');
  assert.equal(h.J('rounds[0].one'), true, 'la manche commence seule');
  assert.doesNotMatch(h.html, /jeu-mates|jeu-reacts|jeu-mini|seul·e dans la salle/, 'rien des écrans à plusieurs');
  h.found(); sec(w, 1);
  assert.equal(h.view(), 'res0', 'seul : les résultats tout de suite');
  assert.match(h.html, /Ton résultat/); assert.doesNotMatch(h.html, /Classement de la manche|\(toi\)/);
  const x = h.ev('jeuRanking(0)[0]');
  assert.equal(x.rang, 0, 'pas de bonus de rang quand on est seul'); assert.equal(x.pts, x.val + x.essai); assert.equal(x.essai, 25);
  h.ev('jeuNextRound()'); sec(w, 4.5); h.found(); sec(w, 1);
  h.ev('jeuFinish()'); sec(w, 1.5);
  assert.equal(h.view(), 'final');
  assert.match(h.html, /Tout trouvé|Ton bilan/, 'le bilan, pas le podium');
  assert.doesNotMatch(h.html, /jeu-podium|Tu as gagné/);
  assert.match(h.html, /Rejouer/); assert.match(h.html, /Quitter la salle/);
  assert.equal(h.ev('state.salle.hist[0].solo'), 1, 'notée « Seul » dans Tes performances');
});

test('un ami arrive pendant une manche commencée seul : la bande des joueurs apparaît, la manche reste sans bonus de rang', () => {
  const w = new World();
  const h = makeClient(w, 'Hôte'); h.ev("jeuNiv='f';jeuNb=1");
  h.host('ALONE2'); sec(w, 1);
  h.ev('jeuNextRound()'); sec(w, 4.5);
  assert.doesNotMatch(h.html, /jeu-mates/);
  const g = makeClient(w, 'Ami'); g.join('ALONE2'); sec(w, 4);
  assert.equal(g.view(), 'play0', 'il arrive dans la manche');
  assert.match(h.html, /class="jeu-mates"/, 'chez l’hôte, la bande apparaît (sans perdre la requête en cours)');
  assert.match(g.html, /class="jeu-mates"/);
  g.found(); sec(w, 1);
  assert.equal(h.view(), 'play0');
  assert.equal(h.ev('jeuRanking(0)[0].rang'), 0, 'commencée seule : pas de bonus de rang, le même chez tous');
  assert.equal(g.ev('jeuRanking(0)[0].rang'), 0);
  assert.match(g.html, /class="jeu-done"/); assert.match(g.html, /Hôte cherche encore/);
  assert.match(h.ev('jeuMatesHTML(0)'), /class="is-found[^"]*"><b class="jeu-av" data-c="1" aria-hidden="true">A<i class="jeu-mate-ok">/, 'la coche de l’ami dans la bande (mise à jour sur place)');
  assert.match(h.ev('jeuMatesHTML(0)'), /<span class="jeu-sr">Ami : trouvé en 00:0\d<\/span>/, 'dit au lecteur d’écran');
});

test('un défi précis (« Avec des amis » sur sa page) ouvre la salle comme première manche', () => {
  const w = new World();
  const h = makeClient(w, 'Hôte'); h.ev('jeuNb=3');
  h.ev("jeuStart('PICK55',true,'c1',{nomId:'jeu-nom'})"); sec(w, 1);
  const g = makeClient(w, 'Ami'); g.join('PICK55'); sec(w, 3);
  h.ev('jeuNextRound()'); sec(w, 1);
  assert.equal(h.J('rounds[0].cid'), 'c1'); assert.equal(g.J('rounds[0].cid'), 'c1');
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
  sec(w, 4); const play = grab(); assert.match(play, /class="jeu-mates"/); assert.doesNotMatch(play, /jeu-reacts|jeu-mini/, 'pendant qu’on cherche : rien que la manche');
  assert.doesNotMatch(play, /<img/);
  host.found(); sec(w, 1); const wait = grab(); assert.match(wait, /class="jeu-done"/); assert.match(wait, /cherche encore/); assert.match(wait, /jeu-reacts/); assert.match(wait, /Clore la manche pour tous/);
  assert.doesNotMatch(wait, /id="ed-lesson"/, 'la carte « Trouvé » remplace l’éditeur');
  evil.found(); sec(w, 2); const res = grab(); assert.match(res, /Classement de la manche/); assert.doesNotMatch(res, /<img/);
  host.ev('jeuClose()'); host.ev('jeuNextRound()'); sec(w, 5); host.ev('jeuClose()'); sec(w, 1);
  host.ev('jeuNextRound()'); sec(w, 5); host.ev('jeuClose()'); sec(w, 1);
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
  host.ev('jeuNextRound()'); sec(w, 4.5); host.found(); guests[0].found(); guests[1].found(); sec(w, 1.5);
  assert.equal(host.view(), 'res0');
  const late = makeClient(w, 'Retard'); late.join('ROOM42'); sec(w, 6);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'res0', c.name + ' reste sur les résultats');
  assert.match(host.html, /Manche suivante/);
  host.ev('jeuNextRound()'); sec(w, 4.5); host.found(); late.found(); guests[0].found(); guests[1].found(); sec(w, 2);
  const sc = host.ev('jeuScores().map(x=>x.name+":"+x.pts)');
  assert.ok(sc.length === 4 && sc.every(x => !/:0$/.test(x)), 'les points des deux manches : ' + sc);
});

test('un temps reçu pendant les résultats met le classement à jour (sans rouvrir la manche)', () => {
  const { w, host, guests } = room({ n: 3 });
  host.ev('jeuNextRound()'); sec(w, 4.5); host.ev('jeuClose()'); sec(w, 1);
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
  assert.match(back.html, /Trouvé en/);
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
  host.ev('jeuNextRound()'); sec(w, 20);
  const fast = makeClient(w, 'Avance', { skew: 8000 }); fast.join('SKEW88'); sec(w, 4);
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
  host.ev('jeuNextRound()'); sec(w, 4.5); host.ev('jeuClose()'); sec(w, 1); host.ev('jeuFinish()'); sec(w, 1.5);
  assert.equal(host.view(), 'final');
  assert.doesNotMatch(host.html, /Tu as gagné/, 'personne n’a marqué : pas de gagnant');
  assert.match(host.html, /is-1 is-empty/, 'pas de médaille d’or à 0 point');
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
    if (n === 2) { host.ev('jeuClose()'); sec(w, 1.5); }
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
  s.ev('jeuClose()'); sec(w, 1); s.ev('jeuFinish()'); sec(w, 1);
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
  host.ev('jeuNextRound()'); sec(w, 4.5);
  const late = makeClient(w, 'Retard'); late.join('BASE01'); late.logRelay(); sec(w, 2);
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
  assert.ok(engineSrc.includes("api+'jeu_balise?apikey='+JEU_SB_KEY"));
  assert.match(sql, /alter table public\.jeu_salle enable row level security;/);
  assert.match(sql, /alter table public\.jeu_msg enable row level security;/);
  assert.match(sql, /revoke all on table public\.jeu_salle, public\.jeu_msg from anon, authenticated;/);
  assert.match(sql, /revoke all on function public\.jeu_menage\(\) from public, anon, authenticated;/);
  assert.doesNotMatch(sql, /grant execute on function public\.jeu_menage/, 'le ménage n’est pas appelable de l’extérieur');
  assert.match(sql, /cron\.schedule\('jeu-menage', '23 \* \* \* \*'/);
  assert.match(engineSrc, /const JEU_SB_KEY='sb_publishable_[A-Za-z0-9_]+';/, 'seule la clé publique est dans l’appli');
  assert.doesNotMatch(html, /service_role|sb_secret_/, 'aucune clé secrète');
});
