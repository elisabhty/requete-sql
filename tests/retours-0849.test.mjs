/* Elisa, 6 novembre, 8 h 47 (capture des pièces de la piste A) : « Je préfère ça sans le « rappel » et j’aimerais voir tous les cas
   possibles, par ex. quand la leçon n’est pas commencée et quand elle est à 0 » ; 8 h 49 (capture de la piste A en cours de module,
   « 1:15 sur 2:50 », « Leçon 3 sur 6 », « Encore ~3 min ») : « Finalement je préfère ça, j’avais pas vu ».
   La carte de l’accueil devient « La leçon d’abord » : le module, le titre de la leçon en grand, sa vidéo et les points du module,
   le chat et sa pastille « Niv. 2 », puis le bouton et le temps qui reste. Les minutes sont celles des vraies vidéos, partout. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';
const ligne = nom => cut(`function ${nom}(`, '\n') + '\n';
const N = '\u00a0';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DUREES = cut('const S_PAR_EXERCICE=', 'function recommendedSession(){');

/* Un module de six leçons, la troisième en cours : sa vidéo dure 2 min 50 et propose 3 exercices « À toi » */
const LECONS = [{ id: 10 }, { id: 11 }, { id: 1, video: { duree: '2 min 50', moments: 3 } }, { id: 13 }, { id: 14 }, { id: 15 }];
function monde({ pos = {}, ans = {}, faites = [10, 11], lecons = {}, ses = null } = {}) {
  const ctx = vm.createContext({
    MIN_PAR_ACTIVITE: 6, esc, isDefiId: id => typeof id === 'string', itemDone: id => faites.includes(id),
    allLessons: [...LECONS, { id: 2, video: { duree: '3 min 37', moments: 6 } }, { id: 3 }], LV_POS: new Map(Object.entries(pos).map(([k, v]) => [+k, v])), LV_ANS: ans,
    state: { lessons: lecons }, nbFaites: id => (lecons[id] && lecons[id].n) || 0, defiSesRead: () => ses,
    jeuDureeMs: k => ({f: 600000, m: 900000, d: 1200000})[k] || 600000, LQ_VIDEO_SVG: '<svg v/>', LQ_CHRONO_SVG: '<svg c/>', DEFI_BASES: { aero: { nom: 'Aéroport' } }, defiBaseId: c => c.base });
  vm.runInContext(DUREES + ligne('lvFmt') + ligne('jeuChrono') + fn('itemCommence'), ctx);
  return ctx;
}

test('les minutes : la vidéo et 30 s par exercice ; une leçon commencée, ce qui reste ; un défi, 6 min', () => {
  const c = monde();
  assert.deepEqual(['2 min 50', '3 min 05', '4 min', ''].map(d => c.dureeVideoS({ video: { duree: d } })), [170, 185, 240, 0]);
  assert.equal(c.dureeActiviteS(1), 170 + 3 * 30);
  assert.equal(c.dureeActiviteS(3), 360, 'sans vidéo connue : 6 min, comme avant');
  assert.equal(c.dureeActiviteS('d1'), 360, 'un défi : 6 min');
  assert.equal(c.minutesDe([1]), 4, '4 min 20 → ~4 min');
  assert.equal(c.minutesDe([1, 2]), 11, '260 s + 397 s');
  assert.equal(c.minutesDe([]), 0);
  /* 8 h 49 : « 1:15 sur 2:50 », un exercice fait → « Encore ~3 min » (1 min 35 de vidéo, 2 exercices) */
  const m = monde({ pos: { 1: 75 }, ans: { 1: { 0: { k: 1 } } } });
  assert.equal(m.resteActiviteS(1), 95 + 60);
  assert.equal(m.minutesDe([1], true), 3);
  assert.equal(monde({ pos: { 1: 169 }, ans: { 1: { 0: {}, 1: {}, 2: {} } } }).minutesDe([1], true), 1, 'presque fini : une minute au moins');
  assert.equal(monde({ faites: [1] }).minutesDe([1], true), 0, 'validée : plus rien');
  assert.equal(monde({ pos: { 1: 9999 } }).resteActiviteS(1), 90, 'une position plus loin que la vidéo ne compte pas en négatif');
  /* La vidéo finie (sa position n’est plus gardée, ses réponses si) : seulement les moments à rejouer, 30 s au moins */
  assert.equal(monde({ ans: { 1: { 0: {}, 1: {} } } }).resteActiviteS(1), 30);
  assert.equal(monde({ ans: { 1: { 0: {}, 1: {}, 2: {} } } }).resteActiviteS(1), 30, 'tout répondu mais pas validée : un moment raté à rejouer');
  assert.equal(monde({ ans: { 1: { 0: {}, 1: {} } } }).minutesDe([1], true), 1);
});

test('le planning, l’accueil et le bilan comptent avec les vraies minutes (plus de 6 min par activité)', () => {
  const hors = app.replace(DUREES, '');
  assert.ok(!/\*\s*MIN_PAR_ACTIVITE|MIN_PAR_ACTIVITE\s*\*/.test(hors), 'le forfait ne sert plus que dans les durées');
  assert.ok(fn('recommendedSession').includes('const minutes=minutesDe(session.remaining,true);'), '« Ta session · 12 min »');
  for (const k of ['<small>${plur(n,\'leçon\')} · ~${minutesDe(sess.lessons)} min</small>', '· ~${minutesDe(sess.lessons)} min${ret?',
    'body=`Aujourd’hui : ${plur(left,\'activité\')} · ~${minutesDe(info.today.lessons.filter(id=>!itemDone(id)),true)} min.',
    'moy:p.sessions.length?Math.round(toutesActivites().reduce((a,id)=>a+dureeActiviteS(id),0)/60/p.sessions.length):0',
    'Une leçon prend environ ${Math.round(allLessons.reduce((a,l)=>a+dureeActiviteS(l.id),0)/Math.max(1,allLessons.length)/60)}\\u00a0minutes.'])
    assert.ok(app.includes(k), k);
  /* Sur les vraies leçons : chaque vidéo a sa durée et ses exercices */
  const videos = [...app.matchAll(/video:\{([^}]*)\}/g)].map(m => m[1]);
  assert.ok(videos.length >= 60 && videos.every(v => /duree:'\d+ min \d\d'/.test(v) && /moments:\d+/.test(v)), 'toutes au format « 3 min 37 », avec leurs exercices');
});

/* Ce que la carte montre sous le titre de la leçon, et dans le bouton */
const SOUS = cut("  let prog='',sub='',part=0;", '  const ctaLu=').replace("let prog='',sub='',part=0;", "var prog='',sub='',part=0;").replace(/const (n|points)=/g, 'var $1=');
function carte(id, o = {}) {
  const c = monde(o);
  const defi = typeof id === 'string';
  Object.assign(c, { nxt: id, defi, ch: defi ? { id, base: 'aero', niv: o.niv } : null, lesson: defi ? null : c.allLessons.find(l => l.id === id), mod: defi ? null : { lessons: LECONS }, index: defi ? 0 : 3 });
  vm.runInContext('var commence=itemCommence(nxt);' + SOUS, c);
  return { commence: c.commence, prog: c.prog, sub: c.sub, points: c.points };
}
const barre = p => `<span class="lq-a-bar" aria-hidden="true" data-p="${p}"><i style="width:${p}%"></i></span>`;
const dots = pv => `<p class="lq-a-meta lq-a-pos"><span class="lq-a-dots" aria-hidden="true"><i class="is-done"></i><i class="is-done"></i><i class="is-cur" style="--pv:${pv}%"></i><i class=""></i><i class=""></i><i class=""></i></span><span>Leçon 3 sur 6</span></p>`;

test('tous les cas d’une leçon : jamais ouverte, ouverte à 0:05, en cours, vidéo vue', () => {
  /* Jamais ouverte (la vidéo n’est gardée qu’après 2 s : ouverte puis refermée à 0:01, elle est « pas commencée ») */
  assert.deepEqual(carte(1), { commence: false, prog: `<p class="lq-a-meta is-ico"><svg v/><span>Vidéo de 2 min 50 · 3${N}exercices</span></p>`, sub: `~4${N}min`, points: dots(0) });
  /* Ouverte, arrêtée à 0:05 */
  assert.deepEqual(carte(1, { pos: { 1: 5 } }), { commence: true, prog: `${barre(3)}<p class="lq-a-meta"><span class="lq-sr">Vidéo : </span><span>0:05 sur 2:50</span></p>`, sub: `Plus que 4${N}min`, points: dots(3) });
  /* 8 h 49 : « 1:15 sur 2:50 · 1/3 exercices », « Encore ~3 min » */
  assert.deepEqual(carte(1, { pos: { 1: 75 }, ans: { 1: { 0: { k: 1 } } } }), { commence: true,
    prog: `${barre(44)}<p class="lq-a-meta"><span class="lq-sr">Vidéo : </span><span>1:15 sur 2:50</span><span class="lq-a-pt" aria-hidden="true">·</span><span>1/3 exercices</span></p>`, sub: `Plus que 3${N}min`, points: dots(44) });
  /* La vidéo finie (sa position n’est plus gardée), deux exercices sur trois : la barre ne dépasse jamais 95 % avant la validation */
  assert.deepEqual(carte(1, { ans: { 1: { 0: {}, 1: {} } } }), { commence: true, prog: `${barre(63)}<p class="lq-a-meta"><span>Vidéo vue · 2/3 exercices</span></p>`, sub: `Plus que 1${N}min`, points: dots(63) });
  assert.equal(carte(1, { ans: { 1: { 0: {}, 1: {}, 2: {} } } }).prog.slice(0, barre(95).length), barre(95));
  /* Commencée autrement (un brouillon d’exercice) : la vidéo entière reste à voir */
  assert.deepEqual(carte(1, { lecons: { 1: { draft: 'SELECT *' } } }), { commence: true, prog: `<p class="lq-a-meta is-ico"><svg v/><span>Vidéo de 2 min 50 · 3${N}exercices</span></p>`, sub: `Plus que 4${N}min`, points: dots(0) });
});

test('un défi : 10 min au chrono (8 novembre, 8 h 21) et sa base ; son chrono en cours, ce qui reste', () => {
  assert.deepEqual(carte('d1'), { commence: false, prog: `<p class="lq-a-meta is-ico"><svg c/><span>10${N}min au chrono · Base Aéroport</span></p>`, sub: `10${N}min au plus`, points: '' });
  const enCours = carte('d1', { ses: { cid: 'd1', t0: Date.now() - 348000 } });
  assert.deepEqual(enCours, { commence: true, prog: `${barre(58)}<p class="lq-a-meta"><span class="lq-sr">Chrono : </span><span>05:48 sur 10:00</span></p>`, sub: `Plus que 5${N}min au chrono`, points: '' });
  assert.equal(carte('d1', { ses: { cid: 'd2', t0: Date.now() - 348000 } }).commence, false, 'le chrono d’un autre défi');
  /* 8 novembre, 8 h 52 : la durée suit le niveau du défi, 15 min en Moyen, 20 en Difficile */
  assert.deepEqual(carte('d1', { niv: 'd' }), { commence: false, prog: `<p class="lq-a-meta is-ico"><svg c/><span>20${N}min au chrono · Base Aéroport</span></p>`, sub: `20${N}min au plus`, points: '' });
  assert.equal(carte('d1', { niv: 'm', ses: { cid: 'd1', t0: Date.now() - 348000 } }).sub, `Plus que 10${N}min au chrono`, '5 min 48 sur 15 min');
});

test('la carte : le bonjour et la séance, le module, la leçon, le chat, puis le bouton ; plus de « Rappel »', () => {
  const h = fn('renderHomeHero');
  assert.ok(h.includes('const html=`<section class="lq-hero journey-session has-hi is-lecon" data-mc="${mc}" aria-label="${defi?\'Prochain défi\':\'Ta prochaine leçon\'}">${heading}<div class="lq-a-kick">${chip}</div><div class="lq-hero-main lq-a-main"><div class="lq-hero-body lq-a-body"><h3 class="lq-a-titre">${esc(meta.titre)}</h3><div class="lq-a-prog">${prog}${points}</div></div>${mascot}</div>'));
  assert.ok(h.includes('onclick="openItem(${arg},0)"><span class="lq-play" aria-hidden="true">${HOME_PLAY_SVG}</span><span class="lq-cta-t"><b>${esc(ctaLabel)}</b><small>${esc(sub)}</small></span></button></section>${stats}${streak}`;'), '7 novembre, 8 h 38 : les trois chiffres, puis la série ; plus de carte de rattrapage');
  assert.ok(h.includes("const ctaLu=`${ctaLabel} : ${meta.titre}, ${(sub.charAt(0).toLowerCase()+sub.slice(1)).replace(/~/g,'environ ').replace(/\\u00a0/g,' ')}`;"), 'VoiceOver : « Continuer ma leçon : ORDER BY, plus que 3 min »');
  assert.ok(!/Rappel/.test(h.replace(/\/\*[\s\S]*?\*\//g, '')), 'sans la pastille « Rappel » (8 h 47)');
  assert.ok(!app.includes('function homeLessonSteps(') && !app.includes('HOME_STEP_OK'), 'plus d’étapes Leçon · Exercice · Quiz');
  /* La séance : une copie, montrée à côté du module quand la ligne du bonjour était trop courte (lqSesAjuste) ; depuis le 7 novembre,
     10 h 10 (« Enlève le badge en haut, à part quand le parcours est terminé »), plus d’étiquette sur la carte d’une leçon, ni de copie.
     8 h 38 (« plus positif ») : la séance d’un jour passé a le sablier de celle du jour, plus de flèche de retard ↻ */
  assert.ok(!h.includes('const sesCopie=') && !h.includes('lq-ses-copie'));
  assert.ok(h.includes('${nxt==null?sesMeta:`<span class="lq-sr">${esc(seanceLue(session,sesEtat))}</span>`}'), 'l’étiquette sur la carte de fin seulement ; ailleurs, VoiceOver lit la séance');
  assert.ok(h.includes("const sesVue=sesEtat==='late'?'run':sesEtat;") && h.includes("const sesIc=sesVue==='run'") && !h.includes('M3.2 8.6a5 5 0 1 0 1.5-4.4'));
  /* 7 novembre, 8 h 38 (maquette) : « 👋 Bonjour, Elisa ! », puis la phrase de heroSousTitre */
  assert.ok(h.includes('const hiHtml=`<span class="lq-hi-wave">👋</span> <span class="lq-hi-mot">${esc(hiWord)}</span>${name?`, <span class="lq-hi-nom">${esc(name)}</span>`:\'\'}\\u00a0!`;'));
  assert.ok(h.includes("mascotMedalHtml({kw:nxt==null?'COMMIT;':'SELECT',niv:nivC,nivCourt:true,"));
});

test('la pastille « Niv. 2 » seule sur le chat ; le nom du niveau se lit avec lui', () => {
  const ctx = vm.createContext({ esc, escAttr: esc });
  vm.runInContext(cut('const MASCOT_IMG=', 'function mascotReduced(){'), ctx);
  const court = vm.runInContext("mascotMedalHtml({kw:'SELECT',niv:{rank:2,label:'Constructeur de requêtes'},nivCourt:true,hi:'Ravi de te revoir !'})", ctx);
  assert.ok(court.includes('<span class="mstk-niv is-court" aria-hidden="true"><i><span>Niv.</span>2</i></span>') && !court.includes('<b>Constructeur'));
  assert.ok(court.includes('aria-label="Niveau 2 : Constructeur de requêtes. La mascotte Requête te fait coucou">'));
  const long = vm.runInContext("mascotMedalHtml({kw:'SELECT',niv:{rank:2,label:'Constructeur de requêtes'},hi:'Coucou !'})", ctx);
  assert.ok(long.includes('<span class="mstk-niv" aria-hidden="true"><i><span>Niv.</span>2</i><b>Constructeur de requêtes</b></span>'), 'ailleurs, l’étiquette entière');
});

test('les minutes de l’étiquette défilent aussi dans sa copie (petits écrans)', () => {
  const ns = [{ dataset: { n: '12' }, textContent: '12' }, { dataset: { n: '12' }, textContent: '12' }], vus = [];
  let t = 0;
  const ctx = vm.createContext({ document: { querySelector: s => (s === '#scr-learn.active' ? {} : null) }, performance: { now: () => 0 }, mascotReduced: () => false,
    setTimeout: g => g(), requestAnimationFrame: g => { t += 150; vus.push(ns.map(n => n.textContent).join('/')); g(t); } });
  vm.runInContext(cut('let lqSesCounted=false;', '/* 21 h 09'), ctx);
  ctx.lqSesCount({ querySelectorAll: s => (s === '.lq-ses-n[data-n]' ? ns : []) });
  assert.equal(vus[0], '0/0');
  assert.ok(vus.every(v => v.split('/')[0] === v.split('/')[1]), 'ensemble');
  assert.deepEqual(ns.map(n => n.textContent), ['12', '12']);
  const avant = vus.length;
  ctx.lqSesCount({ querySelectorAll: () => ns });
  assert.equal(vus.length, avant, 'une fois par ouverture de l’appli');
  /* Une page de test sans querySelectorAll : la première étiquette, comme avant */
  const seul = { dataset: { n: '6' }, textContent: '6' };
  const c2 = vm.createContext({ document: { querySelector: s => (s === '#scr-learn.active' ? {} : null) }, performance: { now: () => 0 }, mascotReduced: () => true, setTimeout: g => g(), requestAnimationFrame: () => {} });
  vm.runInContext(cut('let lqSesCounted=false;', '/* 21 h 09'), c2);
  c2.lqSesCount({ querySelector: () => seul });
  assert.equal(seul.textContent, '6', 'mouvements réduits : rien ne bouge');
});

test('le style de la carte, et la nouvelle version en cache', () => {
  for (const k of ['html.lq .lq-a-titre{margin:0;font:800 25px/1.05 var(--display);',
    'html.lq .lq-a-dots i.is-done{background:var(--mint)}',
    'html.lq .lq-a-dots i.is-cur{background:linear-gradient(90deg,var(--sun-hi) var(--pv,0%),rgba(255,255,255,.3) var(--pv,0%));',
    'html.lq .lq-hero.is-ses-bas .lq-ses-copie{display:inline-flex}',
    'html.lq .lq-hero.is-ses-bas .lq-hero-hi .journey-session-meta{position:absolute!important;',
    'html.lq .lq-hero-hi.is-serre .lq-hi-nom{display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
    'html.lq .mstk-niv.is-court{right:-6px;bottom:4px;rotate:-6deg;',
    'html.lq .lq-a-meta.is-ico{flex-wrap:nowrap;align-items:flex-start}',
    '@media (max-width:360px){\n  html.lq .lq-a-titre{font-size:22px}'])
    assert.ok(lq.includes(k), k);
  assert.ok(!lq.includes('.lq-steps') && !lq.includes('.lq-step ') && !lq.includes('.lq-hero-kicker'), 'le style des anciennes cartes est parti avec elles');
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=313">'));
  assert.ok(sw.includes("'requete-2026-11-11-parcours-bascule-v2850'"));
});
