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
const bloc = cut('const JEU_TEST_MS=3200;', '\nfunction jeuWaitLine(n){');

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
  const store = {}, f = dom ? fauxDom() : null;
  const J = { me: 'a', players: { a: { name: 'Elisa' }, b: { name: '@lea_data' }, c: { name: '@max' }, d: { name: '@sam_sql' }, e: { name: '@zoe' } },
    left: {}, koAt: {}, rounds: [{ found: {}, tries: 0 }] };
  const ctx = vm.createContext({
    JEU: J, Date, esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    JEU_ICO: { check: '<svg class="ok"/>' }, DEF_CHEV_SVG: '<svg class="chev"/>', jeuFlag: () => '',
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    __absents: new Set(['e']), prefersReduceMotion: () => reduit, buzz() {},
    document: f ? f.document : undefined,
  });
  vm.runInContext(cut('function jeuInitial(name){', '\n') + '\n' + bloc.replace(/^const /gm, 'var ') + `
    function jeuOrder(){return ['a','b','c','d','e'];}
    function jeuPresent(p){return p===JEU.me||!__absents.has(p);}
    function jeuRanking(n){const r=JEU.rounds[n];return Object.entries(r.found).sort((x,y)=>x[1]-y[1]).map(([pid],i)=>({pid,pts:[1000,800,600,400][i]}));}`, ctx);
  const ev = code => vm.runInContext(code, ctx);
  /* Les objets du contexte viennent d’un autre « realm » : copiés pour deepEqual */
  return { J, ctx, ev, store, f, rang: n => JSON.parse(JSON.stringify(ev(`jeuDirectJoueurs(${n})`), (k, v) => v === Infinity ? null : v)) };
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
  assert.match(rows[0], /<b>@lea_data<span class="jeu-sr">, en tête<\/span><\/b><small class="jd-etat"><i class="jd-i" aria-hidden="true"><svg class="ok"\/><\/i>A trouvé&nbsp;!<em class="jd-gain">\+1 000<\/em><\/small>/);
  assert.match(rows[0], /<i class="jd-couronne"><svg viewBox/); assert.match(rows[0], /<b>1 000<small>&nbsp;pts<\/small><\/b><small>1&nbsp;essai<\/small>/);
  assert.match(rows[1], /^class="jd is-pense is-moi"/); assert.match(rows[1], /<b>Toi<\/b><small class="jd-etat"><i class="jd-rond" aria-hidden="true"><\/i>En réflexion<\/small>/);
  assert.match(rows[1], /<b>0<small>&nbsp;pt<\/small><\/b><small>2&nbsp;essais<\/small>/);
  assert.match(rows[2], /^class="jd is-test"/); assert.match(rows[2], /<i class="jd-pp" aria-hidden="true"><b><\/b><b><\/b><b><\/b><\/i>Teste sa requête/, 'trois petits points');
  assert.match(html, /<span class="jeu-direct-nb" id="jeu-direct-nb">4&nbsp;joueurs<\/span>/);
  assert.match(html, /<span class="jeu-direct-ok" id="jeu-direct-ok"><i aria-hidden="true"><svg class="ok"\/><\/i>1\/4<span class="jeu-sr"> : 1 joueur a trouvé<\/span><\/span>/);
  assert.match(html, /<span class="jeu-direct-av" id="jeu-direct-av" aria-hidden="true"><b class="jeu-av is-ok" data-c="1">@?L<\/b><b class="jeu-av is-pense" data-c="0">E<\/b>/, 'repliée, les avatars restent dans la barre');
  assert.doesNotMatch(html, /SELECT|ex-code|<table/i, 'jamais la requête ni le résultat des autres');
  /* Chez moi, mes essais sont ceux que j’ai lancés (même relu après une coupure, la salle les recompte) */
  s.J.rounds[0].tries = 0; assert.equal(s.rang(0).find(x => x.me).essais, 2);
  /* « Teste sa requête » le temps du geste (3,2 s), puis « En réflexion » ; jamais pour soi */
  s.J.koAt.c = now - 4000; s.J.koAt.a = now; assert.deepEqual(s.rang(0).filter(x => x.pid !== 'b').map(x => x.etat), ['pense', 'pense', 'pense']);
});

test('les points de toute la partie ; deux à égalité en tête, deux couronnes ; parti, il garde sa ligne et ses points', () => {
  const s = salle();
  s.J.rounds = [{ found: { e: 1, b: 2 } }, { found: { b: 9000 }, tried: { c: 1 }, ko: { c: 1 } }];
  /* e a pris 1 000 à la première manche puis est parti (« bye ») ; c a essayé puis a perdu le réseau */
  s.J.left.e = true; s.ctx.__absents.add('c');
  const xs = s.rang(1);
  assert.deepEqual(xs.map(x => [x.pid, x.pts, x.chef, x.etat]), [['b', 1800, true, 'ok'], ['e', 1000, false, 'parti'], ['a', 0, false, 'pense'], ['c', 0, false, 'parti'], ['d', 0, false, 'pense']]);
  const html = s.ev('jeuDirectHTML(1)');
  assert.match(html, /<b>@zoe<\/b><small class="jd-etat"><i class="jd-rond" aria-hidden="true"><\/i>A quitté la salle<\/small>/);
  assert.match(html, /<b>@max<\/b><small class="jd-etat"><i class="jd-rond" aria-hidden="true"><\/i>Hors ligne<\/small>/);
  assert.match(html, /1\/3<span class="jeu-sr"> : 1 joueur a trouvé<\/span>/, 'ceux partis avant d’avoir trouvé ne comptent plus');
  assert.match(html, /3&nbsp;joueurs/);
  s.J.rounds[1].found.a = 9500;
  assert.deepEqual(s.rang(1).filter(x => x.chef).map(x => x.pid), ['b'], 'b : 1 000 + 1 000, Elisa : 800');
  s.J.rounds[0].found = { a: 1, b: 2 };
  assert.deepEqual(s.rang(1).filter(x => x.chef).map(x => x.pid).sort(), ['a', 'b'], 'à égalité, deux couronnes (1 800 chacun)');
});

test('les gestes : seulement ce qui vient de changer, une fois (le premier dessin de la manche ne rejoue rien)', () => {
  const s = salle();
  const x = { pid: 'b', me: false, vrai: '@lea_data', nom: '@lea_data', c: 1, ok: true, essais: 2, etat: 'ok', quitte: false, pts: 1000, gain: 1000, chef: true };
  const neuf = s.ctx.jeuDirectLigne(x, null);
  assert.match(neuf, /^<li class="jd is-ok is-chef" data-pid="b" data-s="b:ok:2:1000:1:1000">/);
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

test('réductible : la flèche plie et déplie, le choix est gardé ; plié, il ne reste que la barre', () => {
  const s = salle();
  s.J.rounds[0].found = { b: 1 };
  assert.match(s.ev('jeuDirectHTML(0)'), /^<section class="jeu-direct" id="jeu-direct" aria-labelledby="jeu-direct-t"><button type="button" class="jeu-direct-h" id="jeu-direct-h" aria-expanded="true" aria-controls="jeu-direct-l" onclick="jeuDirectBasculer\(\)">/);
  s.store['rq-jeu-direct'] = 'plie';
  assert.match(s.ev('jeuDirectHTML(0)'), /^<section class="jeu-direct is-plie" [^>]*><button [^>]*aria-expanded="false"/);
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
  assert.ok(r.includes("<h1>${esc(c.titre)}</h1>\n      ${sl?'':jeuDirectHTML(n)}\n      ${defiConsigneHTML(c)}"), 'à plusieurs seulement');
  assert.ok(!app.includes('jeuMatesHTML'), 'la bande d’avatars est partie');
  const rate = cut("    case 'rate':{", "    case 'close':{");
  const compte = rate.indexOf('(rt.ko=rt.ko||{})[m.pid]=(rt.ko[m.pid]||0)+1;'), sortie = rate.indexOf('if((m.g|0)!==J.g||J.solo||mine||!J.synced||replay)return;');
  assert.ok(compte > 0 && compte < sortie, 'chaque essai compte, même relu, même le sien (la salle reprise après une coupure retrouve ses compteurs)');
  assert.ok(rate.includes("(J.koAt=J.koAt||{})[m.pid]=Date.now();\n      jeuDirectPeindre(n);"), 'en direct : « Teste sa requête » tout de suite');
  assert.ok(cut('function jeuEssaiRate(r){', '\n}\n').includes("if(n>=0&&typeof jeuDirectPeindre==='function')jeuDirectPeindre(n);"), 'mon compteur aussi, sans attendre');
  assert.ok(cut('function jeuPatch(v){', '\n}\n').includes('jeuDirectPeindre(n);'), 'quelqu’un trouve, arrive ou part : sur place, l’éditeur ne bouge pas');
  assert.ok(cut('function jeuTick(){', '\n}\n').includes("else{coachRoomTick();if(n>=0&&J.view==='play'+n)jeuDirectPeindre(n);}"), 'le geste « Teste sa requête » s’éteint tout seul');
});

test('le style : tout sous #jeu-root (avant la refonte des Défis), des gestes de 0,5 à 1 s, rien en mouvement réduit', () => {
  const a = css.indexOf('/* « En direct » pendant la manche, à plusieurs (8 novembre'), b = css.indexOf('\n/* ', css.indexOf('html.lq[data-motion="reduce"] #jeu-root .jeu-direct-chev{transition:none}'));
  assert.ok(a > 0 && b > a);
  assert.ok(b < css.indexOf('Défis — la refonte du 7 novembre'), 'avant le bloc des Défis, dont les règles sont limitées à leurs pages');
  const bloc = css.slice(a, b);
  for (const l of bloc.split('\n').filter(l => l.includes('{') && !/^\s*@/.test(l) && !/^\s*\/\*/.test(l)))
    assert.match(l, /^\s*html\.lq(\[data-(reading|motion)="(large|reduce)"\])? #jeu-root [.:]/, l.slice(0, 80));
  const gestes = [...bloc.matchAll(/animation:(jd\w+) ([\d.]+)s([^;}]*)/g)].filter(m => !/infinite/.test(m[3]));
  assert.deepEqual(gestes.map(m => m[1]).sort(), ['jdConfetti', 'jdCouronne', 'jdLueur', 'jdPlus', 'jdPose', 'jdRebond']);
  for (const m of gestes) assert.ok(+m[2] >= 0.5 && +m[2] <= 1, `${m[1]} ${m[2]} s`);
  for (const k of ['@media (prefers-reduced-motion:reduce){\n  html.lq #jeu-root :is(.jd,.jd *,.jeu-direct-onde .jd-onde2,.jeu-direct-av .jeu-av){animation:none!important}',
    'html.lq[data-motion="reduce"] #jeu-root .jd-fete{display:none}', 'html.lq[data-reading="large"] #jeu-root .jd-t>b{font-size:17px}',
    'html.lq #jeu-root .jd.is-moi{margin:4px -8px;padding:9px 8px;border-radius:14px;background:var(--accent-soft)}'])
    assert.ok(bloc.includes(k), k);
  assert.ok(!/jeu-mates|jeu-mate-/.test(css), 'les règles de l’ancienne bande sont parties');
  assert.ok(css.includes('@keyframes jeuMateOk{') && css.includes('animation:jeuMateOk .55s'), 'la coche des pastilles d’essais reste');
});
