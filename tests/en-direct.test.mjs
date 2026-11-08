/* Elisa, 8 novembre, 11 h 33 (la proposition qu’elle a collée, avec deux captures) : un cadre « En direct » pendant la manche, un
   mini-tableau de bord multijoueur sous le titre du défi, avant « La question », réductible. Par joueur : avatar et pseudo, ce qu’il
   fait (en réflexion, teste sa requête, a trouvé), ses essais, ses points. Les gestes : il teste (l’avatar s’anime, trois petits
   points, le compteur augmente) ; il trouve (rebond, confettis, « Trouvé ! » et ses points) ; il prend la tête (une couronne, la ligne
   remonte). Jamais la requête ni le résultat des autres ; à cinq au plus, tout le monde est affiché ; compact, dépliable, des gestes
   de 0,5 à 1 s. Le comportement dans une vraie salle est vérifié dans salle-defis.test.mjs. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const bloc = cut('const JEU_TEST_MS=', '\nfunction jeuWaitLine(n){');

/* Un faux DOM, juste ce que jeuDirectPeindre touche : la liste, ses lignes (leur place donne leur hauteur), la barre. */
function fauxDom() {
  const ligne = html => ({
    html, dataset: { pid: /data-pid="([^"]*)"/.exec(html)[1], s: /data-s="([^"]*)"/.exec(html)[1] }, parent: null, anims: [],
    get className() { return /class="([^"]*)"/.exec(this.html)[1]; },
    remove() { if (this.parent) { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; } },
    getBoundingClientRect() { return { top: this.parent ? this.parent.children.indexOf(this) * 58 : 0 }; },
    animate(k, o) { this.anims.push([k, o]); },
  });
  const liste = {
    children: [], dataset: {},
    set innerHTML(h) { this.children.forEach(c => { c.parent = null; }); this.children = h.split(/(?=<li )/).filter(Boolean).map(ligne); this.children.forEach(c => { c.parent = this; }); },
    querySelectorAll() { return this.children.slice(); },
    insertBefore(node, ref) { node.remove(); const k = ref ? this.children.indexOf(ref) : -1; this.children.splice(k < 0 ? this.children.length : k, 0, node); node.parent = this; return node; },
  };
  const barre = { 'jeu-direct-ok': { innerHTML: '' }, 'jeu-direct-av': { innerHTML: '' }, 'jeu-direct-nb': { innerHTML: '' } };
  const document = {
    getElementById: id => id === 'jeu-direct-l' ? liste : barre[id] || null,
    createElement: () => { const t = { content: { firstElementChild: null } }; Object.defineProperty(t, 'innerHTML', { set(h) { t.content.firstElementChild = ligne(h); } }); return t; },
  };
  return { document, liste, barre };
}

/* Une salle : a (moi, Elisa), b, c, d ; les points d’une manche selon l’ordre où l’on a trouvé. */
function salle({ dom = false, reduit = false } = {}) {
  const store = {}, f = dom ? fauxDom() : null, toasts = [], buzz = [];
  const J = { me: 'a', players: { a: { name: 'Elisa' }, b: { name: '@lea_data' }, c: { name: '@max' }, d: { name: '@sam_sql' }, e: { name: '@zoe' } },
    left: {}, koAt: {}, rounds: [{ found: {}, tries: 0 }] };
  const ctx = vm.createContext({
    JEU: J, Date, esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    JEU_ICO: { check: '<svg class="ok"/>', cross: '<svg class="ko"/>' }, DEF_CHEV_SVG: '<svg class="chev"/>', jeuFlag: () => '',
    jeuToast: t => toasts.push(t), jeuDureeMs: () => 600000, jeuNivManche: () => 'f', jeuSoloLike: () => false,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    __absents: new Set(['e']), prefersReduceMotion: () => reduit, buzz: k => buzz.push(k),
    document: f ? f.document : undefined,
  });
  vm.runInContext(cut('function jeuInitial(name){', '\n') + '\n' + bloc.replace(/^const /gm, 'var ') + `
    function jeuOrder(){return ['a','b','c','d','e'];}
    function jeuPresent(p){return p===JEU.me||!__absents.has(p);}
    function jeuRanking(n){const r=JEU.rounds[n];return Object.entries(r.found).sort((x,y)=>x[1]-y[1]).map(([pid],i)=>({pid,place:i+1,essai:i===0&&r.first&&r.first[pid]?25:0,pts:[1000,800,600,400][i]}));}
    function jeuRoundDone(n){return !!JEU.rounds[n].done;}`, ctx);
  J.rounds[0].t1 = Date.now();
  const ev = code => vm.runInContext(code, ctx);
  /* Les objets du contexte viennent d’un autre « realm » : copiés pour deepEqual */
  return { J, ctx, ev, store, f, toasts, buzz, rang: n => JSON.parse(JSON.stringify(ev(`jeuDirectJoueurs(${n})`), (k, v) => v === Infinity ? null : v)) };
}

test('chaque joueur : ce qu’il fait, ses essais (chaque requête exécutée), ses points de la partie ; en tête, la couronne', () => {
  const s = salle(), now = Date.now();
  Object.assign(s.J.rounds[0], { found: { b: 42000 }, tries: 2, ko: { a: 2, c: 2 }, tried: { a: 1, c: 1 } });
  s.J.koAt.c = now - 500;
  const xs = s.rang(0);
  assert.deepEqual(xs.map(x => x.pid), ['b', 'a', 'c', 'd'], 'en tête d’abord, puis l’ordre de la salle ; parti sans rien jouer, pas de ligne');
  assert.deepEqual(xs.map(x => [x.etat, x.essais, x.pts, x.chef]), [['ok', 1, 1000, true], ['pense', 2, 0, false], ['test', 2, 0, false], ['pense', 0, 0, false]]);
  assert.deepEqual(xs.map(x => x.c), [1, 0, 2, 3], 'la couleur de son avatar en salle d’attente, quelle que soit sa place');
  const html = s.ev('jeuDirectHTML(0)'), rows = html.split('<li ').slice(1);
  assert.match(rows[0], /<span class="jd-l1"><b>@lea_data<span class="jeu-sr">, en tête<\/span><\/b><\/span><small class="jd-etat"><i class="jd-i" aria-hidden="true"><svg class="ok"\/><\/i>A trouvé&nbsp;!<em class="jd-gain">\+1 000<\/em><\/small>/);
  assert.match(rows[0], /<i class="jd-couronne"><svg viewBox/); assert.match(rows[0], /<b><span class="jd-pts" data-n="1000" data-fmt="fr">1 000<\/span><small>&nbsp;pts<\/small><\/b><small>1&nbsp;essai<\/small>/);
  assert.match(rows[0], /^class="jd is-ok is-chef" data-pid="b" data-s="[^"]+"><span class="jd-rang is-m1" aria-hidden="true">1<\/span><b class="jeu-av"/, 'le rang : l’or');
  assert.match(rows[1], /"><span class="jd-rang is-vide" aria-hidden="true">–<\/span><b class="jeu-av"/, 'sans points : un tiret');
  assert.match(rows[1], /^class="jd is-pense is-moi"/); assert.match(rows[1], /<span class="jd-l1"><b>Toi<\/b><\/span><small class="jd-etat"><i class="jd-rond" aria-hidden="true"><\/i>En réflexion<\/small>/);
  assert.match(rows[1], /<b><span class="jd-pts" data-n="0" data-fmt="fr">0<\/span><small>&nbsp;pt<\/small><\/b><small>2&nbsp;essais<\/small>/);
  assert.match(rows[2], /^class="jd is-test"/); assert.match(rows[2], /<i class="jd-run" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 7.2v9.6l7.6-4.8z"[^>]*\/><\/svg><\/i>Teste sa requête/, 'la pastille d’« Exécuter »');
  assert.match(html, /<span class="jeu-direct-nb"><span id="jeu-direct-nb">4&nbsp;joueurs<\/span><\/span>/);
  assert.match(html, /^<section class="jeu-direct" id="jeu-direct" aria-labelledby="jeu-direct-t"><div class="jeu-direct-bande"><button [^>]*><span class="jeu-direct-live" aria-hidden="true"><\/span><b id="jeu-direct-t">En direct<\/b>/, 'le bandeau, la pastille « en direct »');
  assert.match(html, /<span class="jeu-direct-ok" id="jeu-direct-ok"><i aria-hidden="true"><svg class="ok"\/><\/i>1\/4<span class="jeu-sr"> : 1 joueur a trouvé<\/span><\/span>/);
  assert.match(html, /<span class="jeu-direct-av" id="jeu-direct-av" aria-hidden="true"><b class="jeu-av is-ok" data-c="1" data-pid="b">@?L<\/b><b class="jeu-av is-pense" data-c="0" data-pid="a">E<\/b>/, 'repliée, les avatars restent dans la barre');
  assert.doesNotMatch(html, /SELECT|ex-code|<table/i, 'jamais la requête ni le résultat des autres');
  /* Chez moi, mes essais sont ceux que j’ai lancés (même relu après une coupure, la salle les recompte) */
  s.J.rounds[0].tries = 0; assert.equal(s.rang(0).find(x => x.me).essais, 2);
  /* Il écrit (12 h 07) : les trois petits points, « Écrit sa requête » ; s’il vient d’exécuter, « Teste sa requête » l’emporte */
  s.J.ecritAt = { d: now - 1000, c: now - 100, a: now };
  const e = s.rang(0);
  assert.deepEqual(e.map(x => [x.pid, x.etat]), [['b', 'ok'], ['a', 'pense'], ['c', 'test'], ['d', 'ecrit']], 'jamais pour soi');
  assert.match(s.ev('jeuDirectHTML(0)').split('<li ')[4], /^class="jd is-ecrit"[^>]*>.*<small class="jd-etat"><i class="jd-pp" aria-hidden="true"><b><\/b><b><\/b><b><\/b><\/i>Écrit sa requête<\/small>/);
  s.J.ecritAt.d = now - 5200; assert.equal(s.rang(0)[3].etat, 'pense', 'sans nouvelles 5 s : en réflexion');
  /* « Teste sa requête » le temps du geste (3,2 s), puis « En réflexion » ; jamais pour soi */
  s.J.ecritAt = {}; s.J.koAt.c = now - 4000; s.J.koAt.a = now; assert.deepEqual(s.rang(0).filter(x => x.pid !== 'b').map(x => x.etat), ['pense', 'pense', 'pense']);
});

test('les points de toute la partie ; deux à égalité en tête, deux couronnes ; parti, il garde sa ligne et ses points', () => {
  const s = salle();
  s.J.rounds = [{ found: { e: 1, b: 2 } }, { found: { b: 9000 }, tried: { c: 1 }, ko: { c: 1 } }];
  /* e a pris 1 000 à la première manche puis est parti (« bye ») ; c a essayé puis a perdu le réseau */
  s.J.left.e = true; s.ctx.__absents.add('c');
  const xs = s.rang(1);
  assert.deepEqual(xs.map(x => [x.pid, x.pts, x.chef, x.etat]), [['b', 1800, true, 'ok'], ['e', 1000, false, 'parti'], ['a', 0, false, 'pense'], ['c', 0, false, 'parti'], ['d', 0, false, 'pense']]);
  const html = s.ev('jeuDirectHTML(1)');
  assert.match(html, /<b>@zoe<span class="jeu-sr">, 2e<\/span><\/b><\/span><small class="jd-etat"><i class="jd-rond" aria-hidden="true"><\/i>A quitté la salle<\/small>/);
  assert.match(html, /<b>@max<\/b><\/span><small class="jd-etat"><i class="jd-rond" aria-hidden="true"><\/i>Hors ligne<\/small>/);
  assert.match(html, /1\/3<span class="jeu-sr"> : 1 joueur a trouvé<\/span>/, 'ceux partis avant d’avoir trouvé ne comptent plus');
  assert.match(html, /3&nbsp;joueurs/);
  s.J.rounds[1].found.a = 9500;
  assert.deepEqual(s.rang(1).filter(x => x.chef).map(x => x.pid), ['b'], 'b : 1 000 + 1 000, Elisa : 800');
  s.J.rounds[0].found = { a: 1, b: 2 };
  assert.deepEqual(s.rang(1).filter(x => x.chef).map(x => x.pid).sort(), ['a', 'b'], 'à égalité, deux couronnes (1 800 chacun)');
});

test('les gestes : seulement ce qui vient de changer, une fois (le premier dessin de la manche ne rejoue rien)', () => {
  const s = salle();
  const x = { pid: 'b', me: false, vrai: '@lea_data', nom: '@lea_data', c: 1, ok: true, essais: 2, etat: 'ok', quitte: false, pts: 1000, gain: 1000, chef: true, serie: 0, monte: 0, place: 1, rang: 1 };
  const neuf = s.ctx.jeuDirectLigne(x, null);
  assert.match(neuf, /^<li class="jd is-ok is-chef" data-pid="b" data-s="b:ok:2:1000:1:1000:0:0:1"><span class="jd-rang is-m1" aria-hidden="true">1<\/span>/);
  assert.doesNotMatch(neuf, /jd-fete/);
  const vu = s.ctx.jeuDirectLigne(x, { etat: 'test', essais: 1, chef: false });
  assert.match(vu, /^<li class="jd is-ok is-chef is-plus is-trouve is-sacre"/, 'un essai de plus, trouvé, en tête');
  assert.match(vu, /<i class="jd-fete">(<i><\/i>){6}<\/i><\/b>/, 'six confettis autour de l’avatar');
  assert.match(s.ctx.jeuDirectLigne(Object.assign({}, x, { ok: false, etat: 'test', gain: 0, chef: false }), { etat: 'pense', essais: 1, chef: false }), /^<li class="jd is-test is-plus"/);
  /* Le premier dessin de la manche : rien ne se joue ; redessinée, la liste rejoue ce qui a changé depuis */
  s.J.rounds[0].found = { b: 1 };
  assert.doesNotMatch(s.ev('jeuDirectHTML(0)'), /is-trouve|is-sacre|is-plus/);
  s.J.rounds[0].found.c = 2; s.J.rounds[0].ko = { c: 1 };
  const re = s.ev('jeuDirectHTML(0)');
  assert.match(re, /class="jd is-ok is-plus is-trouve" data-pid="c"/);
  assert.doesNotMatch(s.ev('jeuDirectHTML(0)'), /is-trouve/, 'une fois');
});

test('sur place : une ligne qui n’a pas changé garde son nœud (son geste continue) ; celle qui change de place glisse', () => {
  const s = salle({ dom: true }), { liste, barre } = s.f;
  s.J.rounds[0].found = { b: 1 };
  const html = s.ev('jeuDirectHTML(0)');
  liste.innerHTML = /<ol [^>]*>([\s\S]*)<\/ol>/.exec(html)[1]; liste.dataset.sig = /data-sig="([^"]*)"/.exec(html)[1];
  const [b0, a0, c0, d0] = liste.children;
  assert.deepEqual(liste.children.map(li => li.dataset.pid), ['b', 'a', 'c', 'd']);
  /* Rien de neuf : rien ne bouge */
  s.ev('jeuDirectPeindre(0)'); assert.equal(liste.children[0], b0); assert.equal(barre['jeu-direct-ok'].innerHTML, '', 'la barre non plus');
  /* c manque un essai : sa ligne seule est redessinée */
  s.J.rounds[0].ko = { c: 1 }; s.J.koAt.c = Date.now();
  s.ev('jeuDirectPeindre(0)');
  assert.deepEqual(liste.children.map(li => li.dataset.pid), ['b', 'a', 'c', 'd']);
  assert.equal(liste.children[0], b0); assert.equal(liste.children[1], a0); assert.equal(liste.children[3], d0);
  assert.notEqual(liste.children[2], c0); assert.equal(liste.children[2].className, 'jd is-test is-plus');
  assert.match(barre['jeu-direct-ok'].innerHTML, /1\/4/);
  /* d trouve, plus vite que b ne l’a fait : il prend la tête, sa ligne remonte en glissant, la couronne passe */
  s.J.rounds[0].found = { d: 0, b: 1 };
  s.ev('jeuDirectPeindre(0)');
  assert.deepEqual(liste.children.map(li => li.dataset.pid), ['d', 'b', 'a', 'c']);
  assert.equal(liste.children[0].className, 'jd is-ok is-chef is-plus is-trouve is-sacre');
  assert.equal(liste.children[1].className, 'jd is-ok', 'b perd la couronne');
  assert.equal(liste.children[2], a0, 'Elisa n’a pas changé : même nœud');
  assert.deepEqual(liste.children[0].anims.map(([k, o]) => [k[0].transform, o.duration]), [['translateY(174px)', 520]], 'd glisse depuis sa place');
  assert.deepEqual(a0.anims.map(([k]) => k[0].transform), ['translateY(-58px)'], 'Elisa descend d’une ligne, en douceur');
  assert.match(barre['jeu-direct-ok'].innerHTML, /2\/4/);
  /* Mouvement réduit : les lignes changent de place sans glisser */
  const r = salle({ dom: true, reduit: true });
  r.J.rounds[0].found = {};
  const h2 = r.ev('jeuDirectHTML(0)');
  r.f.liste.innerHTML = /<ol [^>]*>([\s\S]*)<\/ol>/.exec(h2)[1]; r.f.liste.dataset.sig = /data-sig="([^"]*)"/.exec(h2)[1];
  r.J.rounds[0].found = { d: 0 }; r.ev('jeuDirectPeindre(0)');
  assert.equal(r.f.liste.children[0].dataset.pid, 'd');
  assert.ok(r.f.liste.children.every(li => !li.anims.length));
});

test('« il écrit » : part si ma requête a changé depuis le dernier tour, au plus toutes les 3 s, jamais le texte', () => {
  const s = salle(), sent = [], ed = { value: '' };
  Object.assign(s.ctx, { document: { getElementById: id => (id === 'ed-lesson' ? ed : null) }, jeuSoloLike: () => false, jeuDirectPeindre() {} });
  Object.assign(s.J, { g: 2, t: { signal: m => sent.push(JSON.parse(JSON.stringify(m))) } });
  s.ev('jeuEcritVeille(0)'); assert.equal(sent.length, 0, 'le premier tour de la manche note seulement la requête');
  ed.value = 'SELECT nom'; s.ev('jeuEcritVeille(0)');
  assert.deepEqual(sent, [{ v: 1, t: 'ecrit', pid: 'a', g: 2, n: 0 }], 'qui, quelle partie, quelle manche ; pas le texte');
  ed.value = 'SELECT nom,'; s.ev('jeuEcritVeille(0)'); assert.equal(sent.length, 1, 'moins de 3 s après : rien');
  s.J.ecritEnvoye -= 3000; s.ev('jeuEcritVeille(0)'); assert.equal(sent.length, 1, 'rien n’a changé depuis le dernier tour : rien');
  ed.value = 'SELECT nom, ville'; s.ev('jeuEcritVeille(0)'); assert.equal(sent.length, 2);
  s.J.ecritEnvoye = 0; s.J.edVu = { n: 1, v: '' }; ed.value = 'x'; s.ev('jeuEcritVeille(0)'); assert.equal(sent.length, 2, 'une autre manche : on repart de sa requête');
  s.J.rounds[0].found = { a: 1 }; ed.value = 'y'; s.ev('jeuEcritVeille(0)'); assert.equal(sent.length, 2, 'trouvé : plus rien');
  s.J.rounds[0].found = {}; s.ctx.jeuSoloLike = () => true; ed.value = 'z'; s.ev('jeuEcritVeille(0)'); assert.equal(sent.length, 2, 'seul dans la salle : rien');
  /* Reçu */
  s.ctx.jeuSoloLike = () => false; Object.assign(s.J, { view: 'play0', denied: {} });
  s.ev("jeuEcritRecu({t:'ecrit',pid:'c',g:2,n:0})"); assert.ok(s.J.ecritAt.c > 0);
  for (const m of ["{pid:'a',g:2,n:0}", "{pid:'zz',g:2,n:0}", "{pid:'d',g:1,n:0}", "{pid:'d',g:2,n:4}"]) s.ev(`jeuEcritRecu(${m})`);
  assert.deepEqual(Object.keys(s.J.ecritAt), ['c'], 'ni moi, ni un inconnu, ni une autre partie, ni une manche absente');
  s.J.rounds[0].found = { d: 1 }; s.ev("jeuEcritRecu({pid:'d',g:2,n:0})"); assert.deepEqual(Object.keys(s.J.ecritAt), ['c'], 'ni celui qui a trouvé');
  s.J.left.c = true; delete s.J.ecritAt.c; s.ev("jeuEcritRecu({pid:'c',g:2,n:0})"); assert.deepEqual(Object.keys(s.J.ecritAt), [], 'ni celui qui est parti');
});

test('« il écrit » passe par le canal en direct de la salle, sans la base ; reçu, on n’en garde que qui et quelle manche', () => {
  const sb = cut('function jeuSupabase(code,onMsg,onNet){', '\n/* ');
  assert.ok(sb.includes("signal(m){if(!S.closed&&S.ws&&S.joined)put(S.ws,{topic,event:'broadcast',payload:{type:'broadcast',event:'ecrit',payload:m},ref:String(++S.ref),join_ref:S.joinRef});},"));
  const recu = sb.indexOf("if(f.payload&&f.payload.event==='ecrit'){const e=f.payload.payload;if(e&&typeof e==='object')onMsg({v:1,t:'ecrit',pid:String(e.pid||''),g:+e.g||0,n:+e.n||0});return;}");
  assert.ok(recu > 0 && recu < sb.indexOf('if(secure){if(Date.now()-noticeAt>150)'), 'avant la relecture des salles classées : un signal ne relit pas la salle');
  const tr = cut('function jeuTransport(code,onMsg,onNet,solo){', '\nfunction jeuSupabase(');
  assert.ok(tr.includes('return{send(){return Promise.resolve(true);},signal(){},beacon(){},close(){}};'), 'seul : rien');
  assert.ok(tr.includes('bc.onmessage=e=>onMsg(e.data&&e.data.eph?e.data:rel(e.data));') && tr.includes('signal(m){try{bc.postMessage(Object.assign({},m,{eph:1}));}catch(e){}}'), 'le canal local (tests) : pas gardé');
  const on = cut('function jeuOnMsg(m){', "\n  const mine=");
  assert.ok(on.includes("if(m.t==='ecrit')return jeuEcritRecu(m);"), 'avant l’ordre du relais et les signes de vie');
  assert.ok(cut("    case 'rate':{", "    case 'close':{").includes('if(J.ecritAt)delete J.ecritAt[m.pid];'), 'il exécute : il n’écrit plus');
});

/* 12 h 25, les quatre idées : le commentateur, les réactions sur les avatars, la série et la remontée, la dernière minute. */
test('le commentateur : une phrase à la fois (2,2 s au moins), de la croix d’un essai à « Plus que … en course »', () => {
  const s = salle(), nb = '\u00a0', r = s.J.rounds[0];
  const dit = () => s.J.dit.cur.html, attend = () => [...s.J.dit.file].map(d => d.k), passe = () => { s.J.dit.at -= 2300; s.ev('jeuDitAvancer(0)'); };
  const html0 = s.ev('jeuDirectHTML(0)');
  assert.match(html0, /<\/button><p class="jeu-direct-dit" id="jeu-direct-dit" aria-hidden="true"><span class="jd-dit-m is-go"><i class="jd-dit-i" aria-hidden="true"><svg[^]*?<\/i><span>C’est parti\u00a0! Qui ouvrira le score\u00a0\?<\/span><\/span><\/p><\/div><ol class="jeu-direct-l"/, 'en bas du bandeau, avant la liste (visible même repliée)');
  /* @max manque : la croix, son pseudo, tout de suite (la phrase de départ s’efface aussitôt) */
  Object.assign(r, { ko: { c: 1 }, tried: { c: 1 } }); s.J.koAt.c = Date.now(); s.ev('jeuDirectHTML(0)');
  assert.equal(dit(), `<b>@max</b>${nb}: pas encore`); assert.equal(s.J.dit.cur.ico, '<svg class="ko"/>');
  /* @lea_data trouve du premier coup : elle attend que la croix ait été lue */
  r.found = { b: 30000 }; r.first = { b: 1 }; s.ev('jeuDirectHTML(0)');
  assert.deepEqual(attend(), ['ok']); assert.equal(dit(), `<b>@max</b>${nb}: pas encore`);
  passe(); assert.equal(dit(), `<b>@lea_data</b> ouvre le score${nb}!`); assert.equal(s.J.dit.cur.b, '+25');
  assert.equal(s.ev('jeuDitHTML(JEU.dit.cur,true)'), `<span class="jd-dit-m is-ok is-neuf"><i class="jd-dit-i" aria-hidden="true"><svg class="ok"/></i><span><b>@lea_data</b> ouvre le score${nb}!</span><em class="jd-dit-b">+25</em></span>`);
  assert.deepEqual(s.toasts, [], 'les essais et les trouvailles, le lecteur d’écran les entend déjà (jeuToast du message)');
  /* Un troisième essai manqué : son numéro */
  r.ko.c = 3; s.J.koAt.c = Date.now(); s.ev('jeuDirectHTML(0)'); passe();
  assert.equal(dit(), `<b>@max</b>${nb}: pas encore <small>(3e essai)</small>`);
  /* @sam_sql trouve, 2e : il remonte de la 4e à la 2e place, la flèche reste 4 s */
  r.found.d = 45000; const h = s.ev('jeuDirectHTML(0)'); passe();
  assert.equal(dit(), `Remontée de <b>@sam_sql</b>, 2e${nb}!`);
  assert.match(h, /data-pid="d"[^>]*>.*?<span class="jd-monte is-neuf"><svg[^]*?<\/svg><b>2<\/b><span class="jeu-sr">, gagne 2 places<\/span><\/span>/);
  assert.equal(s.rang(0).find(x => x.pid === 'd').monte, 2);
  s.J.directMonte.d.at -= 4100; assert.equal(s.rang(0).find(x => x.pid === 'd').monte, 0, 'au bout de 4 s, la flèche s’en va');
  /* Moi, 3e sans changer de place : pas de phrase (la carte « Trouvé » le dit) ; @max reste seul */
  r.found.a = 60000; s.ev('jeuDirectHTML(0)'); passe();
  assert.equal(dit(), `Plus que <b>@max</b> en course…`); assert.deepEqual(s.toasts, [`Remontée de @sam_sql, 2e${nb}!`, 'Plus que @max en course…'], 'dit au lecteur d’écran quand elle s’affiche');
  /* Trois au plus attendent ; les « pas encore » partent les premiers, et ne passent plus après 5 s */
  for (let i = 0; i < 3; i++) s.ev(`jeuDitPousser(0,{k:'ko',p:1,html:'k${i}'})`);
  s.ev("jeuDitPousser(0,{k:'tete',p:4,html:'t'})");
  assert.deepEqual(attend(), ['ko', 'ko', 'tete']);
  s.J.dit.file.forEach(d => { d.t -= 6000; }); passe(); assert.equal(dit(), 't', 'les « pas encore » trop vieux sont passés');
});

test('qui trouve : en premier, prend ou rejoint la tête (« tu » pour soi), et la série d’affilée avec sa flamme', () => {
  const s = salle(), nb = '\u00a0';
  s.J.rounds = [{ found: { b: 1, a: 2 } }, { found: {}, t1: Date.now() }];
  s.ev('jeuDirectHTML(1)');
  assert.deepEqual(s.rang(1).map(x => [x.pid, x.pts, x.serie]), [['b', 1000, 1], ['a', 800, 0], ['c', 0, 0], ['d', 0, 0]]);
  /* Moi, premier de la manche 2 : 1 800, je passe devant */
  s.J.rounds[1].found = { a: 5000 }; s.ev('jeuDirectHTML(1)');
  assert.equal(s.J.dit.cur.html, `Tu prends la tête${nb}!`); assert.equal(s.J.dit.cur.k, 'tete'); assert.deepEqual(s.toasts, [`Tu prends la tête${nb}!`]);
  /* b trouve 2e (800) : 1 800 aussi, à égalité en tête */
  s.J.rounds[1].found.b = 9000; s.ev('jeuDirectHTML(1)'); s.J.dit.at -= 2300; s.ev('jeuDitAvancer(1)');
  assert.equal(s.J.dit.cur.html, `<b>@lea_data</b> rejoint la tête${nb}!`);
  assert.deepEqual(s.rang(1).filter(x => x.chef).map(x => x.pid).sort(), ['a', 'b']);
  /* Manche 3 : moi encore premier, deux d’affilée */
  s.J.rounds.push({ found: {}, t1: Date.now() }); s.ev('jeuDirectHTML(2)');
  assert.equal(s.rang(2).find(x => x.me).serie, 1, 'la manche en cours sans premier : la série d’avant compte');
  s.J.rounds[2].found = { a: 3000 }; const h = s.ev('jeuDirectHTML(2)');
  assert.equal(s.J.dit.cur.html, `2 d’affilée pour toi${nb}!`); assert.equal(s.J.dit.cur.k, 'serie');
  assert.match(h, /<span class="jd-l1"><b>Toi<span class="jeu-sr">, en tête<\/span><\/b><span class="jd-serie is-neuf"><svg[^]*?<\/svg><b>2<\/b><span class="jeu-sr">, 2 manches d’affilée en premier<\/span><\/span><\/span>/);
  /* La série : une manche jouée seul ne compte pas ; une manche sans premier l’arrête ; un autre premier la casse */
  const serie = (rounds, pid, n) => { s.J.rounds = rounds; return s.rang(n).find(x => x.pid === pid).serie; };
  assert.equal(serie([{ found: { b: 1 } }, { found: { b: 1 }, one: true }, { found: { b: 1 } }], 'b', 2), 2);
  assert.equal(serie([{ found: { b: 1 } }, { found: {} }, { found: { b: 1 } }], 'b', 2), 1);
  assert.equal(serie([{ found: { b: 1 } }, { found: { b: 1 } }, { found: { c: 1, b: 2 } }], 'b', 2), 0);
  assert.equal(serie([{ found: { b: 1 } }, { found: { b: 1 } }, { found: { c: 1, b: 2 } }], 'c', 2), 1);
});

test('la dernière minute : le cadre bat en rouge, « Plus qu’une minute ! » une fois, le téléphone vibre si on cherche encore', () => {
  const s = salle(), r = s.J.rounds[0], cls = new Set(['jeu-direct']);
  s.ctx.document = { getElementById: id => id === 'jeu-direct' ? { classList: { contains: k => cls.has(k), toggle: (k, on) => { if (on) cls.add(k); else cls.delete(k); } } } : null };
  r.t1 = Date.now() - 530000; s.ev('jeuDirectMinute(0)');
  assert.ok(!cls.has('is-urgent')); assert.equal(s.J.dit, undefined, '70 s : rien');
  r.t1 = Date.now() - 545000; s.ev('jeuDirectMinute(0)');
  assert.ok(cls.has('is-urgent')); assert.equal(s.J.dit.cur.html, 'Plus qu’une minute\u00a0!'); assert.equal(s.J.dit.cur.k, 'minute');
  assert.deepEqual(s.buzz, ['medium']); assert.deepEqual(s.toasts, ['Plus qu’une minute\u00a0!']);
  s.ev('jeuDirectMinute(0)'); assert.deepEqual(s.buzz, ['medium'], 'une fois');
  assert.match(s.ev('jeuDirectHTML(0)'), /^<section class="jeu-direct is-urgent" id="jeu-direct"/, 'redessiné : toujours rouge');
  r.done = true; s.ev('jeuDirectMinute(0)'); assert.ok(!cls.has('is-urgent'), 'manche finie : plus rien');
  const t = salle(); t.J.rounds[0].found = { a: 1 }; t.J.rounds[0].t1 = Date.now() - 545000; t.ev('jeuDirectMinute(0)');
  assert.deepEqual(t.buzz, [], 'j’ai déjà trouvé : pas de vibration'); assert.equal(t.J.dit.cur.k, 'minute');
  const u = salle(); u.J.solo = true; u.J.rounds[0].t1 = Date.now() - 545000; u.ev('jeuDirectMinute(0)');
  assert.equal(u.J.dit, undefined, 'en solo : pas de cadre, pas de phrase');
  /* 17 h 08 : seul dans la salle, le cadre est là ; il bat aussi la dernière minute */
  const v = salle(); v.ctx.jeuSoloLike = () => true; v.J.rounds[0].t1 = Date.now() - 545000; v.ev('jeuDirectMinute(0)');
  assert.equal(v.J.dit.cur.k, 'minute', 'seul dans la salle : « Plus qu’une minute ! »');
});

test('une réaction jaillit de l’avatar de celui qui l’envoie, dans la liste ou dans la barre repliée', () => {
  const s = salle(), made = [], later = [];
  const sec = { plie: false, kids: [], getBoundingClientRect: () => ({ left: 10, top: 100 }), appendChild(b) { this.kids.push(b); b.parent = this; },
    classList: { contains: k => k === 'is-plie' && sec.plie }, querySelector: q => (sec.q = q, { getBoundingClientRect: () => ({ left: 30, top: 120, width: 38 }) }) };
  s.ctx.setTimeout = (f, ms) => later.push([f, ms]);
  s.ctx.document = { getElementById: id => (id === 'jeu-direct' ? sec : null), querySelector: () => null,
    createElement: () => { const e = { style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, remove() { this.gone = true; } }; made.push(e); return e; } };
  assert.equal(s.ev("jeuReactPop('b','👏')"), true);
  assert.equal(sec.q, '#jeu-direct-l li[data-pid="b"]>.jeu-av');
  const b = sec.kids[0];
  assert.equal(b.className, 'jd-react'); assert.equal(b.textContent, '👏'); assert.equal(b.attrs['aria-hidden'], 'true');
  assert.deepEqual([b.style.left, b.style.top], ['39px', '20px'], 'au-dessus du centre de son avatar');
  assert.equal(later[0][1], 1100); later[0][0](); assert.ok(b.gone, 'elle s’en va d’elle-même');
  sec.plie = true; s.ev("jeuReactPop('b','🔥')"); assert.equal(sec.q, '#jeu-direct-av .jeu-av[data-pid="b"]', 'repliée : depuis la barre');
  s.ctx.document.getElementById = () => null; assert.equal(s.ev("jeuReactPop('b','🔥')"), false, 'sans « En direct » : rien');
  const react = cut("    case 'react':", "    case 'rate':{");
  assert.ok(react.includes('if(JEU_REACTS.includes(m.e)&&J.synced&&!replay&&!mine){jeuToast(`${name} ${m.e}`);jeuReactPop(m.pid,m.e);}'), 'reçue des autres');
  assert.ok(cut('function jeuReact(e){', '\n}\n').includes('jeuSend({t:\'react\',e});jeuToast(`Toi ${e}`);jeuReactPop(JEU.me,e);'), 'la sienne, tout de suite');
  for (const k of ['html.lq #jeu-root .jd-react{position:absolute;', '@keyframes jdReact{', 'html.lq #jeu-root .jeu-direct{position:relative;'])
    assert.ok(css.includes(k), k);
});

test('réductible : la flèche plie et déplie, le choix est gardé ; plié, il ne reste que la barre', () => {
  const s = salle();
  s.J.rounds[0].found = { b: 1 };
  assert.match(s.ev('jeuDirectHTML(0)'), /^<section class="jeu-direct" id="jeu-direct" aria-labelledby="jeu-direct-t"><div class="jeu-direct-bande"><button type="button" class="jeu-direct-h" id="jeu-direct-h" aria-expanded="true" aria-controls="jeu-direct-l" onclick="jeuDirectBasculer\(\)">/);
  s.store['rq-jeu-direct'] = 'plie';
  assert.match(s.ev('jeuDirectHTML(0)'), /^<section class="jeu-direct is-plie" [^>]*><div class="jeu-direct-bande"><button [^>]*aria-expanded="false"/);
  const cls = new Set(['jeu-direct']), attrs = {};
  s.ctx.document = { getElementById: id => id === 'jeu-direct' ? { classList: { contains: k => cls.has(k), toggle: (k, on) => { if (on) cls.add(k); else cls.delete(k); } } }
    : id === 'jeu-direct-h' ? { setAttribute: (k, v) => { attrs[k] = v; } } : null };
  s.ev('jeuDirectBasculer()');
  assert.ok(cls.has('is-plie')); assert.equal(attrs['aria-expanded'], 'false'); assert.equal(s.store['rq-jeu-direct'], 'plie');
  s.ev('jeuDirectBasculer()');
  assert.ok(!cls.has('is-plie')); assert.equal(attrs['aria-expanded'], 'true'); assert.equal(s.store['rq-jeu-direct'], 'ouvert');
  for (const k of ['html.lq #jeu-root .jeu-direct.is-plie .jeu-direct-l{display:none}', 'html.lq #jeu-root .jeu-direct.is-plie .jeu-direct-av{display:flex}',
    'html.lq #jeu-root .jeu-direct:not(.is-plie) .jeu-direct-chev{rotate:-90deg}'])
    assert.ok(css.includes(k), k);
});

test('branché à la manche : sous le titre, avant la question ; chaque essai, chaque trouvaille, chaque seconde le tiennent à jour', () => {
  const r = cut('function jeuRender(){', '\nfunction jeuNextRound(){');
  assert.ok(r.includes("<h1>${esc(c.titre)}</h1>\n      ${J.solo?`<section class=\"jeu-direct is-seul\" aria-label=\"Manche ${n+1} sur ${J.nb}\"><div class=\"jeu-direct-bande\">${hud}</div></section>`:jeuDirectHTML(n,hud)}\n      ${defiConsigneHTML(c)}"), 'dans toute salle, même seul (17 h 08) ; en solo, le bandeau avec sa tête seulement (17 h 48)');
  assert.ok(!app.includes('jeuMatesHTML'), 'la bande d’avatars est partie');
  const rate = cut("    case 'rate':{", "    case 'close':{");
  const compte = rate.indexOf('(rt.ko=rt.ko||{})[m.pid]=(rt.ko[m.pid]||0)+1;'), sortie = rate.indexOf('if((m.g|0)!==J.g||J.solo||mine||!J.synced||replay)return;');
  assert.ok(compte > 0 && compte < sortie, 'chaque essai compte, même relu, même le sien (la salle reprise après une coupure retrouve ses compteurs)');
  assert.ok(rate.includes("(J.koAt=J.koAt||{})[m.pid]=Date.now();\n      jeuDirectPeindre(n);"), 'en direct : « Teste sa requête » tout de suite');
  assert.ok(cut('function jeuEssaiRate(r){', '\n}\n').includes("if(n>=0&&typeof jeuDirectPeindre==='function')jeuDirectPeindre(n);"), 'mon compteur aussi, sans attendre');
  assert.ok(cut('function jeuPatch(v){', '\n}\n').includes('jeuDirectPeindre(n);'), 'quelqu’un trouve, arrive ou part : sur place, l’éditeur ne bouge pas');
  assert.ok(cut('function jeuTick(){', '\n}\n').includes("else{coachRoomTick();if(n>=0&&J.view==='play'+n){jeuEcritVeille(n);jeuDirectPeindre(n);jeuDirectMinute(n);jeuDitAvancer(n);}}"), 'ma requête qui change part ; « Teste », « Écrit », la flèche s’éteignent seuls ; la dernière minute ; la phrase suivante');
});

test('le style : tout sous #jeu-root (avant la refonte des Défis), des gestes de 0,5 à 1 s, rien en mouvement réduit', () => {
  const a = css.indexOf('/* « En direct » pendant la manche, à plusieurs (8 novembre'), b = css.indexOf('\n/* ', css.indexOf('html.lq[data-motion="reduce"] #jeu-root .jeu-direct-chev{transition:none}'));
  assert.ok(a > 0 && b > a);
  assert.ok(b < css.indexOf('Défis — la refonte du 7 novembre'), 'avant le bloc des Défis, dont les règles sont limitées à leurs pages');
  const bloc = css.slice(a, b);
  for (const l of bloc.split('\n').filter(l => l.includes('{') && !/^\s*@/.test(l) && !/^\s*\/\*/.test(l)))
    assert.match(l, /^\s*html\.lq(\[data-(reading|motion)="(large|reduce)"\])? #jeu-root [.:]/, l.slice(0, 80));
  const gestes = [...bloc.matchAll(/animation:(jd\w+) ([\d.]+)s([^;}]*)/g)].filter(m => !/infinite/.test(m[3]));
  assert.deepEqual([...new Set(gestes.map(m => m[1]))].sort(), ['jdConfetti', 'jdCouronne', 'jdDit', 'jdLueur', 'jdNon', 'jdPlus', 'jdPose', 'jdReact', 'jdRebond']);
  for (const m of gestes) assert.ok(+m[2] >= 0.5 && +m[2] <= 1, `${m[1]} ${m[2]} s`);
  assert.ok(!/:is\([^)]*::/.test(bloc), 'pas de pseudo-élément dans :is() (la règle entière serait ignorée)');
  for (const k of ['@media (prefers-reduced-motion:reduce){\n  html.lq #jeu-root :is(.jd,.jd *,.jeu-direct-av .jeu-av,.jd-dit-m,.jd-dit-m *,.jd-react,.jeu-direct.is-urgent .jeu-direct-bande),html.lq #jeu-root .jd>.jeu-av::after,html.lq #jeu-root .jeu-direct-live::after{animation:none!important}',
    'html.lq[data-motion="reduce"] #jeu-root .jd-fete{display:none}', 'html.lq[data-reading="large"] #jeu-root .jd-l1>b{font-size:17px}',
    'html.lq #jeu-root .jd.is-moi{margin:4px -7px;padding:9px 9px;border-radius:15px;background:var(--accent-soft);box-shadow:inset 0 0 0 2px #DDD5FF}',
    /* 12 h 48, premium : le bandeau des Défis, l’anneau de l’avatar, le rang */
    'html.lq #jeu-root .jeu-direct-bande{position:relative;z-index:1;isolation:isolate;overflow:hidden;border-radius:22px;background:var(--deep);color:#fff;box-shadow:0 4px 0 #3420A6}',
    'linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px) 0 0/22px 22px', 'html.lq #jeu-root .jd.is-ok>.jeu-av::after{border-color:#2DB67C}',
    'html.lq #jeu-root .jd.is-ecrit>.jeu-av::after{border-color:var(--accent) transparent var(--accent) transparent;animation:jdTourne 1.4s linear infinite}',
    'html.lq #jeu-root .jd-rang.is-m1{background:var(--sun);', 'html.lq #jeu-root .jd-dit-m b{color:var(--sun-hi);font-weight:800}'])
    assert.ok(bloc.includes(k), k);
  assert.ok(!/jeu-mates|jeu-mate-/.test(css), 'les règles de l’ancienne bande sont parties');
  assert.ok(!/jeu-evt|jeuMateOk|jeuEvtNon/.test(css), 'les pastilles du haut sont parties (le commentateur les remplace)');
});
