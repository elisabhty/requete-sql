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

/* Une salle : a (moi, Elisa), b, c, d ; les points d’une manche selon l’ordre où l’on a trouvé. */
function salle() {
  const store = {}, toasts = [], buzz = [];
  const J = { me: 'a', players: { a: { name: 'Elisa' }, b: { name: '@lea_data' }, c: { name: '@max' }, d: { name: '@sam_sql' }, e: { name: '@zoe' } },
    left: {}, koAt: {}, rounds: [{ found: {}, tries: 0 }] };
  const ctx = vm.createContext({
    JEU: J, Date, esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    JEU_ICO: { check: '<svg class="ok"/>', cross: '<svg class="ko"/>' }, DEF_CHEV_SVG: '<svg class="chev"/>', jeuFlag: () => '',
    jeuToast: t => toasts.push(t), jeuDureeMs: () => 600000, jeuNivManche: () => 'f', jeuSoloLike: () => false,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    __absents: new Set(['e']), prefersReduceMotion: () => false, buzz: k => buzz.push(k),
    document: undefined,
  });
  vm.runInContext(cut('function jeuInitial(name){', '\n') + '\n' + bloc.replace(/^const /gm, 'var ') + `
    function jeuOrder(){return ['a','b','c','d','e'];}
    function jeuPresent(p){return p===JEU.me||!__absents.has(p);}
    function jeuLive(){return jeuOrder().filter(jeuPresent);}
    function jeuRanking(n){const r=JEU.rounds[n];return Object.entries(r.found).sort((x,y)=>x[1]-y[1]).map(([pid],i)=>({pid,place:i+1,essai:i===0&&r.first&&r.first[pid]?25:0,pts:[1000,800,600,400][i]}));}
    function jeuRoundDone(n){return !!JEU.rounds[n].done;}`, ctx);
  J.rounds[0].t1 = Date.now();
  const ev = code => vm.runInContext(code, ctx);
  /* Les objets du contexte viennent d’un autre « realm » : copiés pour deepEqual */
  return { J, ctx, ev, store, toasts, buzz, rang: n => JSON.parse(JSON.stringify(ev(`jeuDirectJoueurs(${n})`), (k, v) => v === Infinity ? null : v)) };
}

test('chaque joueur : ce qu’il fait, ses essais (chaque requête exécutée), ses points de la partie ; la rangée, dans l’ordre de la manche', () => {
  const s = salle(), now = Date.now();
  Object.assign(s.J.rounds[0], { found: { b: 42000 }, tries: 2, ko: { a: 2, c: 2 }, tried: { a: 1, c: 1 } });
  s.J.koAt.c = now - 500;
  const xs = s.rang(0);
  assert.deepEqual(xs.map(x => x.pid), ['b', 'a', 'c', 'd'], 'en tête d’abord, puis l’ordre de la salle ; parti sans rien jouer, absent');
  assert.deepEqual(xs.map(x => [x.etat, x.essais, x.pts, x.chef]), [['ok', 1, 1000, true], ['pense', 2, 0, false], ['test', 2, 0, false], ['pense', 0, 0, false]]);
  assert.deepEqual(xs.map(x => x.c), [1, 0, 2, 3], 'la couleur de son avatar en salle d’attente, quelle que soit sa place');
  const html = s.ev('jeuDirectHTML(0)');
  assert.match(html, /^<section class="jeu-direct" id="jeu-direct" aria-labelledby="jeu-direct-t"><div class="jeu-direct-bande"><div class="jeu-direct-h"><span class="jeu-direct-live" aria-hidden="true"><\/span><b id="jeu-direct-t">En direct<\/b><span class="jeu-direct-av" id="jeu-direct-av" aria-hidden="true">/, 'le bandeau, la pastille « en direct », la rangée des avatars');
  assert.match(html, /<span class="jeu-direct-ok" id="jeu-direct-ok"><i aria-hidden="true"><svg class="ok"\/><\/i>1\/4<span class="jeu-sr"> : 1 joueur a trouvé<\/span><\/span><\/div><p class="jeu-direct-dit"/);
  /* 21 h 13 (« supprimer le Toi, etc. ») : plus de tableau des scores, ni de flèche, ni de « 4 joueurs » */
  assert.match(html, /<\/p><\/div><\/section>$/); assert.doesNotMatch(html, /<ol|<li|<button|aria-expanded|jeu-direct-chev|jeu-direct-nb|jd-l1|jd-pts/);
  const av = /id="jeu-direct-av" aria-hidden="true">(.*?)<\/span><span class="jeu-sr"/.exec(html)[1];
  assert.deepEqual([...av.matchAll(/data-pid="(\w+)"/g)].map(m => m[1]), ['b', 'a', 'c', 'd'], 'qui a trouvé, puis ceux qui cherchent, dans l’ordre de la salle');
  assert.match(av, /^<b class="jeu-av is-ok is-premier" data-c="1" data-pid="b">@?L<i class="jd-av-b is-roi"><svg viewBox/, 'le premier qui a trouvé : la couronne (21 h 13)');
  assert.match(av, /<b class="jeu-av is-test" data-c="2" data-pid="c">@?M<\/b>/, 'il teste : l’avatar respire, sans bulle');
  assert.match(html, /<span class="jeu-sr" id="jeu-direct-qui">@lea_data : trouvé en premier, Toi : en réflexion, @max : teste une requête, @sam_sql : en réflexion<\/span>/, 'le lecteur d’écran a la rangée en une phrase');
  assert.doesNotMatch(html, /SELECT|ex-code|<table/i, 'jamais la requête ni le résultat des autres');
  /* Chez moi, mes essais sont ceux que j’ai lancés (même relu après une coupure, la salle les recompte) */
  s.J.rounds[0].tries = 0; assert.equal(s.rang(0).find(x => x.me).essais, 2);
  /* Il écrit (12 h 07) : les trois petits points ; s’il vient d’exécuter, « Teste sa requête » l’emporte */
  s.J.ecritAt = { d: now - 1000, c: now - 100, a: now };
  const e = s.rang(0);
  assert.deepEqual(e.map(x => [x.pid, x.etat]), [['b', 'ok'], ['a', 'ecrit'], ['c', 'test'], ['d', 'ecrit']], 'pour soi aussi (8 novembre, 18 h 18 : « c’est toujours en réflexion »)');
  assert.match(s.ev('jeuDirectHTML(0)'), /data-pid="d">@?S<i class="jd-av-b is-ecrit[^"]*"><b><\/b><b><\/b><b><\/b><\/i><\/b>/, 'ses trois petits points');
  s.J.ecritAt.d = now - 5200; assert.equal(s.rang(0)[3].etat, 'pense', 'sans nouvelles 5 s : en réflexion');
  /* « Teste sa requête » le temps du geste (3,2 s), puis « En réflexion » ; pour soi aussi */
  s.J.ecritAt = {}; s.J.koAt.c = now - 4000; s.J.koAt.a = now; assert.deepEqual(s.rang(0).filter(x => x.pid !== 'b').map(x => x.etat), ['test', 'pense', 'pense']);
});

test('les points de toute la partie ; deux à égalité en tête, deux couronnes ; parti, il garde sa ligne et ses points', () => {
  const s = salle();
  s.J.rounds = [{ found: { e: 1, b: 2 } }, { found: { b: 9000 }, tried: { c: 1 }, ko: { c: 1 } }];
  /* e a pris 1 000 à la première manche puis est parti (« bye ») ; c a essayé puis a perdu le réseau */
  s.J.left.e = true; s.ctx.__absents.add('c');
  const xs = s.rang(1);
  assert.deepEqual(xs.map(x => [x.pid, x.pts, x.chef, x.etat]), [['b', 1800, true, 'ok'], ['e', 1000, false, 'parti'], ['a', 0, false, 'pense'], ['c', 0, false, 'parti'], ['d', 0, false, 'pense']]);
  const html = s.ev('jeuDirectHTML(1)');
  assert.match(html, /<span class="jeu-sr" id="jeu-direct-qui">@lea_data\u00a0: trouvé en premier, Toi\u00a0: en réflexion, @sam_sql\u00a0: en réflexion, @max\u00a0: hors ligne, @zoe\u00a0: parti de la salle<\/span>/, 'partis : au bout de la rangée');
  assert.match(html, /data-pid="e">@?Z<\/b><\/span>/, 'son avatar, pâli, au bout');
  assert.match(html, /1\/3<span class="jeu-sr"> : 1 joueur a trouvé<\/span>/, 'ceux partis avant d’avoir trouvé ne comptent plus');
  s.J.rounds[1].found.a = 9500;
  assert.deepEqual(s.rang(1).filter(x => x.chef).map(x => x.pid), ['b'], 'b : 1 000 + 1 000, Elisa : 800');
  s.J.rounds[0].found = { a: 1, b: 2 };
  assert.deepEqual(s.rang(1).filter(x => x.chef).map(x => x.pid).sort(), ['a', 'b'], 'à égalité, deux couronnes (1 800 chacun)');
});

test('la couronne pour le premier qui a trouvé, la coche pour les suivants ; posées une fois, quand ça change (21 h 13)', () => {
  const s = salle(), r = s.J.rounds[0];
  const av = () => /id="jeu-direct-av" aria-hidden="true">(.*?)<\/span><span class="jeu-sr"/.exec(s.ev('jeuDirectHTML(0)'))[1];
  r.found = { c: 42000 };
  assert.match(av(), /^<b class="jeu-av is-ok is-premier" data-c="2" data-pid="c">@?M<i class="jd-av-b is-roi"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.6 8.8l4.5 3.4L12 5.6/, 'le premier dessin de la manche : posée, sans geste');
  r.found.b = 50000; r.found.a = 46000;
  const a1 = av();
  assert.deepEqual([...a1.matchAll(/data-pid="(\w+)"/g)].map(m => m[1]), ['c', 'a', 'b', 'd'], 'dans l’ordre où ils ont trouvé, puis ceux qui cherchent');
  assert.match(a1, /data-pid="a">E<i class="jd-av-b is-ok is-neuf"><svg class="ok"\/><\/i><\/b><b class="jeu-av is-ok" data-c="1" data-pid="b">@?L<i class="jd-av-b is-ok is-neuf"><svg class="ok"\/><\/i><\/b>/, 'la coche se pose pour les suivants');
  assert.equal((a1.match(/is-roi/g) || []).length, 1, 'une seule couronne'); assert.doesNotMatch(a1, /is-roi is-neuf/, 'elle ne rejoue pas');
  assert.doesNotMatch(av(), /is-neuf/, 'une fois');
  r.found.d = 42000; assert.equal((av().match(/is-roi/g) || []).length, 2, 'à égalité, deux couronnes');
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
  assert.ok(s.J.ecritAt.a > 0, 'ma ligne aussi : « Écrit sa requête » (18 h 18), sans rien envoyer de plus');
  /* Reçu */
  s.J.ecritAt = {};
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

/* 20 h 39 : « quand quelqu’un tape une requête, on a un … juste au-dessus de lui, et un validé aussi quand la personne a eu juste à la
   manche ». */
test('sur la tête de l’avatar : les trois petits points tant qu’il écrit, la coche quand il a trouvé ; posées quand ça change', () => {
  const s = salle(), now = Date.now(), r = s.J.rounds[0];
  const tete = () => /<span class="jeu-direct-av" id="jeu-direct-av" aria-hidden="true">(.*?)<\/span><span class="jeu-sr"/.exec(s.ev('jeuDirectHTML(0)'))[1];
  const av = (h, pid) => new RegExp(`<b class="jeu-av[^"]*" data-c="\\d" data-pid="${pid}">.*?</b>(?=<b class="jeu-av|$)`).exec(h)[0];
  s.J.ecritAt = { c: now - 400, a: now };
  const h0 = tete();
  assert.equal(av(h0, 'c'), '<b class="jeu-av is-ecrit" data-c="2" data-pid="c">@?M<i class="jd-av-b is-ecrit"><b></b><b></b><b></b></i></b>'.replace('@?', /data-pid="c">@/.test(h0) ? '@' : ''), 'il écrit : la bulle et ses trois points');
  assert.match(av(h0, 'a'), /^<b class="jeu-av is-ecrit" data-c="0" data-pid="a">E<i class="jd-av-b is-ecrit"><b><\/b><b><\/b><b><\/b><\/i><\/b>$/, 'pour soi aussi');
  assert.equal(av(h0, 'd'), '<b class="jeu-av is-pense" data-c="3" data-pid="d">' + /data-pid="d">([^<]*)/.exec(h0)[1] + '</b>', 'en réflexion : rien');
  assert.doesNotMatch(h0, /is-neuf/, 'le premier dessin de la manche ne rejoue rien');
  /* b trouve le premier (la couronne), c ensuite : la coche se pose ; d se met à écrire : sa bulle se pose ; a écrit toujours : la
     sienne ne rejoue pas */
  r.found = { b: 20000, c: 30000 }; s.J.ecritAt.d = now; s.J.ecritAt.a = now;
  const h1 = tete();
  assert.match(av(h1, 'b'), /<i class="jd-av-b is-roi is-neuf"><svg/, 'la couronne se pose');
  assert.match(av(h1, 'c'), /^<b class="jeu-av is-ok" data-c="2" data-pid="c">@?M<i class="jd-av-b is-ok is-neuf"><svg class="ok"\/><\/i><\/b>$/);
  assert.match(av(h1, 'd'), /<i class="jd-av-b is-ecrit is-neuf">/); assert.match(av(h1, 'a'), /<i class="jd-av-b is-ecrit">/);
  assert.doesNotMatch(tete(), /is-neuf/, 'une fois');
  /* Il vient d’exécuter (« Teste sa requête ») ou il est parti : pas de bulle */
  s.J.koAt.d = Date.now(); assert.doesNotMatch(av(tete(), 'd'), /jd-av-b/);
  const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
  /* 21 h 04 (« tu peux mettre les drapeaux ? ») : le drapeau au coin de l’avatar ; arrivé en cours de manche, il redessine son avatar */
  s.ctx.drapPays = n => (n === '@lea_data' ? 'BE' : '');
  s.ctx.jeuFlag = (n, p) => (/^[A-Z]{2}$/.test(p || '') ? `<i class="jeu-flag" aria-hidden="true">${p}</i>` : '');
  const h2 = tete();
  assert.match(h2, /<b class="jeu-av[^"]*" data-c="1" data-pid="b">@?L<i class="jeu-flag" aria-hidden="true">BE<\/i><i class="jd-av-b is-roi">/, 'Léa : son drapeau, puis sa couronne');
  assert.doesNotMatch(h2, /data-pid="(a|c|d)">[^<]*<i class="jeu-flag"/, 'sans pays : rien');
  assert.ok(s.ev("jeuDirectSig(jeuDirectJoueurs(0).filter(x=>x.pid==='b'))").endsWith(':BE') && !s.ev("jeuDirectSig(jeuDirectJoueurs(0).filter(x=>x.pid==='a'))").includes(':BE'), 'dans sa signature : il redessine en arrivant');
  for (const k of ['html.lq #jeu-root .jeu-direct-av{display:flex;align-items:center;min-width:0;margin:-8px -8px -2px 0;padding:14px 8px 8px 2px;overflow:hidden}',
    'html.lq #jeu-root .jd-av-b.is-roi{left:calc(50% - 10px);bottom:calc(100% - 6px);width:20px;height:20px;background:none;box-shadow:none;rotate:-10deg}',
    '  html.lq #jeu-root .jd-av-b.is-roi{left:calc(50% - 9px);bottom:calc(100% - 4px);width:18px;height:18px}',
    'html.lq #jeu-root .jeu-direct-av .jeu-av .jeu-flag{right:-6px;bottom:-6px;font-size:10px}', '  html.lq #jeu-root .jeu-direct-av .jeu-av .jeu-flag{right:-5px;font-size:9px}',
    'html.lq #jeu-root .jd-av-b{position:absolute;left:calc(50% - 9px);bottom:calc(100% - 2px);z-index:1;',
    'html.lq #jeu-root .jd-av-b>b{flex:none;width:3px;height:3px;border-radius:50%;background:var(--accent);animation:jdBulle 1s ease-in-out infinite}',
    '@keyframes jdBulle{0%,60%,100%{transform:none;opacity:.5}30%{transform:translateY(-2px);opacity:1}}',
    'html.lq #jeu-root .jd-av-b.is-ok{left:calc(50% - 7px);bottom:calc(100% - 4px);width:14px;height:14px;background:#2DB67C;color:#fff;',
    'html.lq #jeu-root .jd-av-b.is-neuf{animation:jdPose .55s cubic-bezier(.3,.7,.3,1.5) both}',
    '  html.lq #jeu-root .jd-av-b,html.lq #jeu-root .jd-av-b>b{animation:none!important}',
    'html.lq[data-motion="reduce"] #jeu-root .jd-av-b,html.lq[data-motion="reduce"] #jeu-root .jd-av-b>b{animation:none!important}',
    '  html.lq #jeu-root .jd-av-b{left:calc(50% - 7px);bottom:calc(100% - 1px);width:14px;height:9px;gap:1.5px}', '  html.lq #jeu-root .jd-av-b.is-ok{bottom:calc(100% - 2px)}'])
    assert.ok(css.includes(k), k);
});

test('la barre, avatar par avatar : celui qui n’a pas changé garde son nœud (ses points sautent sans à-coup)', () => {
  const s = salle();
  const fait = h => { const m = /data-pid="(\w+)"/.exec(h), c = /class="([^"]*)"/.exec(h), dc = /data-c="(\d)"/.exec(h), f = /<i class="jeu-flag"[^>]*>([^<]*)<\/i>/.exec(h);
    return { html: h, className: c[1], dataset: { pid: m[1], c: dc[1] }, querySelector: q => (q === '.jeu-flag' && f ? { textContent: f[1] } : null), replaceWith(n) { const k = barre.children.indexOf(this); barre.children[k] = n; } }; };
  const morceaux = h => h.split(/(?=<b class="jeu-av)/).filter(Boolean).map(fait);
  const barre = { children: [], innerHTML: '', replaceChildren(...k) { this.children = k; this.tout = (this.tout || 0) + 1; } };
  s.ctx.document = { createElement: () => { const t = { content: { children: [] } }; Object.defineProperty(t, 'innerHTML', { set(h) { t.content.children = morceaux(h); } }); return t; } };
  const h = '<b class="jeu-av is-ok" data-c="1" data-pid="b">L</b><b class="jeu-av is-ecrit" data-c="0" data-pid="a">E</b><b class="jeu-av is-pense" data-c="2" data-pid="c">M</b>';
  s.ctx.jeuDirectAvMaj(barre, h); assert.equal(barre.tout, 1, 'la première fois : toute la rangée');
  const [b0, a0, c0] = barre.children;
  s.ctx.jeuDirectAvMaj(barre, h.replace('is-pense" data-c="2"', 'is-ecrit" data-c="2"'));
  assert.equal(barre.tout, 1); assert.equal(barre.children[0], b0); assert.equal(barre.children[1], a0, 'Elisa écrit toujours : même nœud');
  assert.notEqual(barre.children[2], c0); assert.equal(barre.children[2].className, 'jeu-av is-ecrit', 'seul celui qui change est redessiné');
  s.ctx.jeuDirectAvMaj(barre, '<b class="jeu-av is-ok" data-c="2" data-pid="c">M</b><b class="jeu-av is-ok" data-c="1" data-pid="b">L</b><b class="jeu-av is-ecrit" data-c="0" data-pid="a">E</b>');
  assert.equal(barre.tout, 2, 'quelqu’un passe devant : la rangée est redessinée');
  const [c1, b1, a1] = barre.children;
  s.ctx.jeuDirectAvMaj(barre, '<b class="jeu-av is-ok" data-c="2" data-pid="c">M</b><b class="jeu-av is-ok" data-c="1" data-pid="b">L<i class="jeu-flag" aria-hidden="true">🇧🇪</i></b><b class="jeu-av is-ecrit" data-c="0" data-pid="a">E</b>');
  assert.equal(barre.tout, 2); assert.equal(barre.children[0], c1); assert.equal(barre.children[2], a1);
  assert.notEqual(barre.children[1], b1, 'son drapeau arrive (21 h 04) : son avatar est redessiné');
  /* Sans vrai DOM (les tests, un vieux navigateur) : comme avant */
  const simple = { innerHTML: '' }; s.ctx.jeuDirectAvMaj(simple, h); assert.equal(simple.innerHTML, h);
  s.ctx.jeuDirectAvMaj(null, h);
  assert.ok(cut('function jeuDirectPeindre(n){', '\n}\n').includes("const t=jeuDirectTete(xs,avant);\n  [['jeu-direct-ok',t.ok],['jeu-direct-qui',t.qui]].forEach(([id,h])=>{const e=document.getElementById(id);if(e&&e.innerHTML!==h)e.innerHTML=h;});\n  jeuDirectAvMaj(document.getElementById('jeu-direct-av'),t.av);"));
  /* Rien de neuf : rien n’est repeint (le commentateur non plus) */
  const v = salle(), touche = [];
  v.ctx.document = { getElementById: id => (touche.push(id), null) };
  v.ev('jeuDirectHTML(0)'); v.ev('jeuDirectPeindre(0)'); assert.deepEqual(touche, [], 'même signature : on ne touche à rien');
  v.J.rounds[0].found = { b: 1 }; v.ev('jeuDirectPeindre(0)'); assert.deepEqual(touche, ['jeu-direct-dit', 'jeu-direct-ok', 'jeu-direct-qui', 'jeu-direct-av'], 'b trouve : la phrase, le compte, la rangée');
});

/* 12 h 25, les quatre idées : le commentateur, les réactions sur les avatars, la série et la remontée, la dernière minute. */
test('le commentateur : une phrase à la fois (2,2 s au moins), de la croix d’un essai à « Plus que … en course »', () => {
  const s = salle(), nb = '\u00a0', r = s.J.rounds[0];
  const dit = () => s.J.dit.cur.html, attend = () => [...s.J.dit.file].map(d => d.k), passe = () => { s.J.dit.at -= 2300; s.ev('jeuDitAvancer(0)'); };
  const html0 = s.ev('jeuDirectHTML(0)');
  assert.match(html0, /<\/div><p class="jeu-direct-dit" id="jeu-direct-dit" aria-hidden="true"><span class="jd-dit-m is-go"><i class="jd-dit-i" aria-hidden="true"><svg[^]*?<\/i><span>C’est parti\u00a0! Qui ouvrira le score\u00a0\?<\/span><\/span><\/p><\/div><\/section>$/, 'en bas du bandeau');
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
  r.found.d = 45000; s.ev('jeuDirectHTML(0)'); passe();
  assert.equal(dit(), `Remontée de <b>@sam_sql</b>, 2e${nb}!`);
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
  assert.match(h, /data-pid="a">E<i class="jd-av-b is-roi is-neuf">/, 'premier de la manche : la couronne');
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

test('une réaction d’un autre jaillit de son avatar, dans la rangée du bandeau', () => {
  const s = salle(), made = [], later = [];
  const sec = { kids: [], getBoundingClientRect: () => ({ left: 10, top: 100 }), appendChild(b) { this.kids.push(b); b.parent = this; },
    querySelector: q => (sec.q = q, { getBoundingClientRect: () => ({ left: 30, top: 120, width: 38 }) }) };
  s.ctx.setTimeout = (f, ms) => later.push([f, ms]);
  s.ctx.document = { getElementById: id => (id === 'jeu-direct' ? sec : null), querySelector: () => null,
    createElement: () => { const e = { style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, remove() { this.gone = true; } }; made.push(e); return e; } };
  assert.equal(s.ev("jeuReactPop('b','👏')"), true);
  assert.equal(sec.q, '#jeu-direct-av .jeu-av[data-pid="b"]');
  const b = sec.kids[0];
  assert.equal(b.className, 'jd-react'); assert.equal(b.textContent, '👏'); assert.equal(b.attrs['aria-hidden'], 'true');
  assert.deepEqual([b.style.left, b.style.top], ['39px', '20px'], 'au-dessus du centre de son avatar');
  assert.equal(later[0][1], 1100); later[0][0](); assert.ok(b.gone, 'elle s’en va d’elle-même');
  s.ctx.document.getElementById = () => null; assert.equal(s.ev("jeuReactPop('b','🔥')"), false, 'sans « En direct » : rien');
  const react = cut("    case 'react':", "    case 'rate':{");
  assert.ok(react.includes('if(JEU_REACTS.includes(m.e)&&J.synced&&!replay&&!mine){const suite=jeuReactSuite(m.pid);if(!suite)jeuToast(`${name} ${m.e}`);jeuReactPop(m.pid,m.e);jeuReactBulle(m.pid,m.e,name,suite);}'), 'reçue des autres : de son avatar, et le long de l’écran avec son pseudo (18 h 36) ; à la chaîne, dite une fois (20 h 07)');
  /* 8 novembre, 18 h 36 : la sienne monte avec celles des autres (« Toi ») ; elle ne jaillit plus de son avatar, juste sous les
     réactions qu’on vient de toucher dans le cadre */
  const mienne = cut('function jeuReact(e,btn){', '\n}\n');
  assert.ok(mienne.includes('jeuSend({t:\'react\',e});if(!suite)jeuToast(`Toi ${e}`);jeuReactBulle(J.me,e,null,suite);') && !mienne.includes('jeuReactPop('), 'la sienne, tout de suite');
  for (const k of ['html.lq #jeu-root .jd-react{position:absolute;', '@keyframes jdReact{', 'html.lq #jeu-root .jeu-direct{position:relative;'])
    assert.ok(css.includes(k), k);
});

test('21 h 13 : plus de tableau des scores ni de flèche ; la rangée des avatars, toujours là', () => {
  const s = salle();
  for (const f of ['jeuDirectBasculer', 'jeuDirectLigne', 'jeuDirectPlie']) assert.equal(typeof s.ctx[f], 'undefined', f);
  s.store['rq-jeu-direct'] = 'plie'; s.J.rounds[0].found = { b: 1 };
  assert.doesNotMatch(s.ev('jeuDirectHTML(0)'), /is-plie|<ol|aria-expanded|onclick|jeu-direct-nb/, 'l’ancien choix replié/déplié ne compte plus');
  for (const k of ['html.lq #jeu-root .jeu-direct-h{display:flex;align-items:center;gap:8px;min-height:52px;margin:0;padding:9px 12px 8px 16px;box-sizing:border-box;color:#fff}',
    'html.lq #jeu-root .jeu-direct-av{display:flex;align-items:center;min-width:0;'])
    assert.ok(css.includes(k), k);
  assert.ok(!/jeu-direct-l(?!ive)|jeu-direct-chev|jeu-direct-nb|\.jd[{ .:+>]|jd-couronne|jd-fete|jd-rang|jd-l1|jd-pts|jdConfetti|jdRebond|jdTourne|is-plie \.jeu/.test(css), 'les règles du tableau et de la flèche sont parties');
});

test('branché à la manche : sous le titre, avant la question ; chaque essai, chaque trouvaille, chaque seconde le tiennent à jour', () => {
  const r = cut('function jeuRender(){', '\nfunction jeuNextRound(){');
  assert.ok(r.includes("<h1>${esc(c.titre)}</h1>\n      ${J.solo?`<section class=\"jeu-direct is-seul\" aria-label=\"Manche ${n+1} sur ${J.nb}\"><div class=\"jeu-direct-bande\">${hud}</div></section>`:jeuDirectHTML(n,hud)}\n      ${defiConsigneHTML(c,{base:true})}"), 'dans toute salle, même seul (17 h 08) ; en solo, le bandeau avec sa tête seulement (17 h 48)');
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
  const a = css.indexOf('/* « En direct » pendant la manche, à plusieurs (8 novembre'), b = css.indexOf('\n/* ', css.indexOf('html.lq[data-motion="reduce"] #jeu-root .jd-av-b,html.lq[data-motion="reduce"] #jeu-root .jd-av-b>b{animation:none!important}'));
  assert.ok(a > 0 && b > a);
  assert.ok(b < css.indexOf('Défis — la refonte du 7 novembre'), 'avant le bloc des Défis, dont les règles sont limitées à leurs pages');
  const bloc = css.slice(a, b);
  for (const l of bloc.split('\n').filter(l => l.includes('{') && !/^\s*@/.test(l) && !/^\s*\/\*/.test(l)))
    assert.match(l, /^\s*html\.lq(\[data-(reading|motion)="(large|reduce)"\])? #jeu-root [.:]/, l.slice(0, 80));
  const gestes = [...bloc.matchAll(/animation:(jd\w+) ([\d.]+)s([^;}]*)/g)].filter(m => !/infinite/.test(m[3]));
  assert.deepEqual([...new Set(gestes.map(m => m[1]))].sort(), ['jdDit', 'jdNon', 'jdPose', 'jdReact']);
  for (const m of gestes) assert.ok(+m[2] >= 0.5 && +m[2] <= 1, `${m[1]} ${m[2]} s`);
  assert.ok(!/:is\([^)]*::/.test(bloc), 'pas de pseudo-élément dans :is() (la règle entière serait ignorée)');
  for (const k of ['@media (prefers-reduced-motion:reduce){\n  html.lq #jeu-root :is(.jeu-direct-av .jeu-av,.jd-dit-m,.jd-dit-m *,.jd-react,.jeu-direct.is-urgent .jeu-direct-bande),html.lq #jeu-root .jeu-direct-live::after{animation:none!important}',
    'html.lq[data-motion="reduce"] #jeu-root :is(.jeu-direct-av .jeu-av,.jd-dit-m,.jd-dit-m *,.jd-react,.jeu-direct.is-urgent .jeu-direct-bande),html.lq[data-motion="reduce"] #jeu-root .jeu-direct-live::after{animation:none!important}',
    'html.lq[data-reading="large"] #jeu-root .jeu-direct-h>b{font-size:18px}',
    /* 12 h 48, premium : le bandeau des Défis ; ses avatars et ce qu’ils font */
    'html.lq #jeu-root .jeu-direct-bande{position:relative;z-index:1;isolation:isolate;overflow:hidden;border-radius:22px;background:var(--deep);color:#fff;box-shadow:0 4px 0 #3420A6}',
    'linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px) 0 0/22px 22px', 'html.lq #jeu-root .jeu-direct-av .jeu-av.is-ok{border-color:var(--mint)}',
    'html.lq #jeu-root .jeu-direct-av .jeu-av.is-test{border-color:var(--sun);animation:jdRespire 1.1s ease-in-out infinite}', '@keyframes jdRespire{', '@keyframes jdPose{',
    'html.lq #jeu-root .jd-av-b.is-roi svg{display:block;width:100%;height:100%}', 'html.lq #jeu-root .jd-dit-m b{color:var(--sun-hi);font-weight:800}'])
    assert.ok(bloc.includes(k), k);
  assert.ok(!/jeu-mates|jeu-mate-/.test(css), 'les règles de l’ancienne bande sont parties');
  assert.ok(!/jeu-evt|jeuMateOk|jeuEvtNon/.test(css), 'les pastilles du haut sont parties (le commentateur les remplace)');
});
