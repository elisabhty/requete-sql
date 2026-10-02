/* Salle de défi : le moteur (index.html) est exécuté dans plusieurs contextes isolés,
   un par joueur, reliés par un faux relais ntfy et une horloge virtuelle. On vérifie
   la salle d'attente, les 6 joueurs maximum, « prêt », le tirage au sort, les points,
   le relais d'hôte, la salle fantôme, « rejouer », le solo sans réseau. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const engineSrc = html.slice(html.indexOf('/* ---------- Salle de défi : un défi tiré au sort'), html.indexOf('/* Le même défi, seul ou à plusieurs'));
const challengesSrc = html.slice(html.indexOf('const CHALLENGES=['), html.indexOf('const NIV='));
assert.ok(engineSrc.includes('function jeuStart(') && challengesSrc.includes('c1'), 'moteur et défis localisés');

/* ---------- Monde : horloge virtuelle + relais ---------- */
class World {
  constructor() { this.now = 1_800_000_000_000; this.timers = []; this.seq = 0; this.topics = new Map(); this.posts = 0; this.latency = 60; }
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
  topic(name) { if (!this.topics.has(name)) this.topics.set(name, { hist: [], subs: new Set() }); return this.topics.get(name); }
  publish(name, body) {
    this.posts++;
    const t = this.topic(name), m = { id: 'm' + (++this.seq), time: Math.floor(this.now / 1000), message: body, event: 'message' };
    t.hist.push(m);
    t.subs.forEach(s => this.setTimeout(() => s.deliver(m), this.latency));
  }
}

/* ---------- Joueur : un contexte vm avec le moteur et ses dépendances factices ---------- */
function makeClient(world, name, { skew = 0 } = {}) {
  const ctx = vm.createContext({});
  const store = {}, session = {};
  const c = { name, ctx, offline: false, deaf: false, html: '', toasts: [], out: '', ed: { value: '' }, root: null, misc: { 'back-label': {}, 'nav-title': {}, 'lesson-body': {} } };
  c.root = { classList: { remove() {}, add() {} }, offsetWidth: 0, set innerHTML(v) { c.html = v; }, get innerHTML() { return c.html; } };
  class FakeES {
    constructor(url) {
      this.topic = url.replace('https://ntfy.sh/', '').replace('/sse?since=all', '');
      this.closed = false; this.seen = new Set();
      world.setTimeout(() => this.connect(), world.latency);
      c.es = this;
    }
    connect() {
      if (this.closed || c.offline) { if (!this.closed) this.onerror && this.onerror(); return; }
      this.onopen && this.onopen();
      const t = world.topic(this.topic);
      t.hist.slice().forEach(m => this.deliver(m));
      t.subs.add(this);
    }
    deliver(m) {
      if (this.closed || c.offline || c.deaf) return;
      this.onmessage && this.onmessage({ data: JSON.stringify({ id: m.id, time: m.time, event: 'message', message: m.message }) });
    }
    close() { this.closed = true; world.topic(this.topic).subs.delete(this); }
  }
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
    navigator: { vibrate() {}, sendBeacon: (url, body) => { if (c.offline) return false; world.publish(url.replace('https://ntfy.sh/', ''), body); return true; } },
    EventSource: FakeES,
    fetch: (url, opt) => {
      if (c.offline) return Promise.resolve({ ok: false });
      world.setTimeout(() => world.publish(url.replace('https://ntfy.sh/', ''), opt.body), world.latency);
      return Promise.resolve({ ok: true });
    },
    state: { defis: {}, name }, SQL: {}, esc: s => String(s).replace(/</g, '&lt;'), highlight: s => s, DEF_CHEV_SVG: '', JEU_FRIENDS_SVG: '',
    editorBlock: () => '<textarea id="ed-lesson"></textarea>', setupEditor() {}, celebrate() {}, annulerBilanAuto() {}, showScreen() {},
    prefersReduceMotion: () => false, leaveLessonScreen() {}, switchTab() {}, renderDefis() {}, activeTab: 'defis',
    noteActivityDay() {}, save() {}, renderProgress() {}, renderPlanning() {}, setLessonOut: h => { c.out = h; }, renderTable: () => '', errBox: m => m,
    exoFailDiag: () => 'x', exerciseRequiresOrder: () => false, exerciseResultsMatch: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    sandbox: () => ({ exec: sql => [{ columns: ['q'], values: [[sql]] }], close() {} }),
    performance: { now: () => world.now }, confirm: () => true, toast() {},
    mode: '', current: null, exoFails: 0,
  };
  Object.assign(ctx, stubs);
  vm.runInContext(challengesSrc + '\n' + engineSrc, ctx);
  /* La page est supposée déjà affichée : on capture les toasts. */
  vm.runInContext('jeuToast=function(t){__toasts.push(t);}', Object.assign(ctx, { __toasts: c.toasts }));
  c.ev = code => { const r = vm.runInContext(code, ctx); return r && typeof r === 'object' ? JSON.parse(JSON.stringify(r)) : r; };
  c.host = (code, opts = '{nomId:"jeu-nom"}', cid = 'null') => c.ev(`jeuStart(${JSON.stringify(code)},true,${cid},${opts})`);
  c.join = code => c.ev(`jeuJoin(${JSON.stringify(code)})`);
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
  assert.match(host.html, /En attente d’un ami/, 'une place libre est annoncée');
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

test('6 joueurs au maximum : le 7e voit « salle complète », les autres ne changent pas', () => {
  const { w, host, guests } = room({ n: 6 });
  assert.equal(host.live().length, 6);
  const late = makeClient(w, 'Trop'); late.join('ROOM42'); sec(w, 4);
  assert.equal(late.view(), 'full');
  assert.match(late.html, /salle est complète/);
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
  const fresh = [1, 2, 3, 4, 5].map(i => { const g = makeClient(w, 'N' + i); g.join('ROOM42'); sec(w, 1.5); return g; });
  sec(w, 3);
  assert.equal(host.live().length, 6, 'les 3 partis ont libéré leur place');
  assert.ok(fresh.every(g => g.view() === 'lobby'));
});

test('tirage au sort : même défi pour tous, compte à rebours, puis la manche de 3 min', () => {
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

test('manche : classement 3-2-1, la manche se termine quand tous les présents ont trouvé', () => {
  const { w, host, guests } = room({ n: 3 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  guests[1].found(); sec(w, 5); host.found(); sec(w, 1);
  assert.equal(host.view(), 'play0', 'Ami1 n’a pas encore trouvé : la manche continue');
  assert.match(host.html, /Ami2|✓/);
  sec(w, 20); guests[0].found(); sec(w, 1);
  for (const c of [host, ...guests]) assert.equal(c.view(), 'res0', c.name);
  const rk = host.ev('jeuRanking(0).map(x=>JEU.players[x.pid].name+":"+x.pts)');
  assert.deepEqual(rk, ['Ami2:3', 'Hôte:2', 'Ami1:1']);
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
  assert.equal(host.ev('state.salle.pts'), 9, 'trois manches gagnées : 3 × 3 points');
  assert.equal(guests[0].ev('state.salle.pts'), 6);
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
  assert.match(guests[1].html, /Salle de Ami1/);
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
  sec(w, 30);
  assert.equal(guests[1].J('hostPid'), guests[0].pid());
  assert.deepEqual(guests[1].live(), ['Ami1', 'Ami2'], 'l’hôte absent n’est plus listé');
  host.offline = false; host.es.connect();
  sec(w, 3);
  assert.equal(host.J('hostPid'), guests[0].pid(), 'l’ancien hôte se range derrière le nouveau');
  assert.equal(host.ev('jeuIsHost()'), false);
  assert.match(host.html, /Salle de Ami1/);
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
  const late = makeClient(w, 'Tard'); late.join('GHOST1'); sec(w, 9);
  assert.equal(late.view(), 'empty'); assert.match(late.html, /Cette salle est vide/);
});

test('hors ligne au moment de rejoindre : on attend le réseau au lieu de dire « introuvable »', () => {
  const w = new World();
  const host = makeClient(w, 'Hôte'); host.host('NET123'); sec(w, 1);
  const g = makeClient(w, 'Ami'); g.offline = true; g.join('NET123'); sec(w, 20);
  assert.equal(g.view(), 'join'); assert.match(g.ev('jeuNetHTML()'), /Connexion perdue/);
  g.offline = false; g.es.connect(); g.ev('jeuSend({t:"ping"})'); sec(w, 5);
  assert.notEqual(g.view(), 'lost');
});

test('un joueur en retard de signe de vie disparaît de la manche, et revient avec un ping', () => {
  const { w, host, guests } = room({ n: 3 });
  host.ev('jeuNextRound()'); sec(w, 4.5);
  guests[1].offline = true; sec(w, 60);
  assert.deepEqual(host.live(), ['Hôte', 'Ami1']);
  host.found(); guests[0].found(); sec(w, 1);
  assert.equal(host.view(), 'res0');
  guests[1].offline = false; guests[1].es.connect(); guests[1].ev('jeuPing()'); sec(w, 2);
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
  sec(w, 20); s.found(); sec(w, 1);                        /* < 60 s → 3 pts */
  assert.equal(s.view(), 'res0'); assert.match(s.html, /Ton résultat/);
  s.ev('jeuNextRound()'); sec(w, 4); sec(w, 80); s.found(); sec(w, 1);   /* < 120 s → 2 pts */
  s.ev('jeuNextRound()'); sec(w, 4); sec(w, 150); s.found(); sec(w, 1);  /* après 120 s → 1 pt */
  assert.deepEqual(s.ev('JEU.rounds.map((r,i)=>jeuRanking(i)[0].pts)'), [3, 2, 1]);
  s.ev('jeuFinish()'); sec(w, 1);
  assert.equal(s.view(), 'final'); assert.match(s.html, /Tout trouvé/); assert.match(s.html, /Rejouer/);
  assert.equal(s.ev('state.salle.pts'), 6); assert.equal(s.ev('state.salle.parties'), 1);
  assert.equal(s.ev('JEU.rounds.every(r=>state.defis[r.cid])'), true);
  assert.equal(w.posts, 0, 'rien n’est envoyé au relais en solo');
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

test('défi choisi dans l’entraînement libre : il ouvre la salle comme première manche', () => {
  const w = new World();
  const h = makeClient(w, 'Hôte'); h.ev('jeuNb=3');
  h.ev("jeuStart('PICK55',true,'c1',{nomId:'jeu-nom'})"); sec(w, 1);
  const g = makeClient(w, 'Ami'); g.join('PICK55'); sec(w, 3);
  h.ev('jeuNextRound()'); sec(w, 1);
  assert.equal(h.J('rounds[0].cid'), 'c1'); assert.equal(g.J('rounds[0].cid'), 'c1');
  assert.equal(h.J('niv'), 'm', 'le niveau suit le défi choisi');
});

test('quitter une salle : confirmation seulement quand il y a quelque chose à perdre', () => {
  const { w, host } = room({ n: 3 });
  let asked = 0; host.ctx.confirm = () => { asked++; return false; };
  assert.equal(host.ev('jeuLeaveOk()'), false, 'hôte avec des amis dans la salle');
  assert.equal(asked, 1);
  host.ev('jeuNextRound()'); sec(w, 1);
  assert.equal(host.ev('jeuLeaveOk()'), false, 'pendant le tirage');
  const solo = makeClient(w, 'Seul'); let a2 = 0; solo.ctx.confirm = () => { a2++; return true; };
  solo.ev("jeuStart('SOLO44',true,null,{solo:true})"); sec(w, 5);
  assert.equal(solo.ev('jeuLeaveOk()'), true); assert.equal(a2, 1);
});

test('toutes les vues se dessinent sans erreur (échappement des pseudos compris)', () => {
  const w = new World();
  const host = makeClient(w, 'Hôte'); host.ev('jeuNb=3'); host.host('VIEWS1'); sec(w, 1);
  const evil = makeClient(w, '<img src=x onerror=alert(1)>'); evil.join('VIEWS1'); sec(w, 4);
  const seen = new Set();
  const grab = () => { seen.add(host.view().replace(/\d+$/, '')); return host.html; };
  const lobby = grab(); assert.doesNotMatch(lobby, /<img/);
  host.ev('jeuNextRound()'); sec(w, 1); grab();
  sec(w, 4); const play = grab(); assert.match(play, /jeu-reacts/);
  host.found(); evil.found(); sec(w, 2); const res = grab(); assert.match(res, /Classement de la manche/); assert.doesNotMatch(res, /<img/);
  host.ev('jeuClose()'); host.ev('jeuNextRound()'); sec(w, 5); host.ev('jeuClose()'); sec(w, 1);
  host.ev('jeuNextRound()'); sec(w, 5); host.ev('jeuClose()'); sec(w, 1);
  host.ev('jeuFinish()'); sec(w, 1);
  const fin = grab(); assert.match(fin, /Classement final/);
  assert.deepEqual([...seen].sort(), ['draw', 'final', 'lobby', 'play', 'res']);
});

test('un ami dont la réception est coupée (mais qui envoie encore) ne vole pas la main à l’hôte', () => {
  const { w, host, guests } = room({ n: 3 });
  guests[0].deaf = true;               /* il n’entend plus rien : l’hôte lui paraît absent */
  sec(w, 90);
  assert.equal(guests[0].ev('jeuIsHost()'), false, 'il ne se déclare pas hôte');
  assert.equal(host.ev('jeuIsHost()'), true);
  assert.equal(guests[1].J('hostPid'), host.pid());
  guests[0].deaf = false; guests[0].es.connect(); sec(w, 25);
  assert.equal(guests[0].J('hostPid'), host.pid(), 'tout redevient normal à son retour');
  assert.ok(guests[0].live().includes('Hôte'));
});
