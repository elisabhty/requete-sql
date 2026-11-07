/* Elisa, 5 novembre, 17 h 09 (trois captures) :
   - Réf. 1 : « Ta semaine, organisée rien que pour toi. »
   - Réf. 2 : « Prête pour la suite ? » (selon le genre) à la place de « Bon après-midi » ; « Reprendre ma leçon » seulement si la leçon
     a déjà été commencée, sinon « Commencer la leçon ».
   - Réf. 3 : les activités à rattraper sur l’accueil, sans multiplier les badges d’alerte, et « Réorganise ton planning pour reprendre
     à ton rythme ».
   - La série : « Garde le rythme ! », « Une activité aujourd’hui pour prolonger ta série », les flammes de la semaine gardées.
   - « Explorer » au lieu de « Chercher », sur l’accueil et dans la page Entretien.
   Vérifié dans un navigateur (402 et 320 px). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), lq = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';
const N = ' ';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('réf. 1 : « Ta semaine, organisée rien que pour toi. »', () => {
  assert.ok(app.includes('<p class="sub" id="pl-sub">Ta semaine, organisée rien que pour toi.</p>') && app.includes("if(sub)sub.textContent='Ta semaine, organisée rien que pour toi.';"));
  assert.ok(!app.includes('Ta semaine, organisée pour toi.'));
});

test('réf. 2 : « Prête pour la suite ? », selon le genre… devenue, le 7 novembre, la phrase sous « 👋 Bonjour, Elisa ! »', () => {
  /* Elisa, 7 novembre, 8 h 38 (sa maquette) : le bonjour de l’heure, et dessous une phrase qui dit où on en est */
  const title = {}, sous = {};
  const ctx = vm.createContext({ state: { name: 'Elisa' }, Date: class { getHours() { return 15; } },
    document: { querySelector: () => title, getElementById: () => sous, createElement: () => ({ style: {} }) } });
  vm.runInContext(cut('function greetingForHour(', 'function renderStartCta('), ctx);
  ctx.renderGreeting(); assert.equal(title.textContent, 'Bon après-midi, Elisa');
  ctx.state.name = ''; ctx.renderGreeting(); assert.equal(title.textContent, 'Bon après-midi');
  let genre = 'f';
  const faits = new Set(), commencees = new Set();
  const phr = vm.createContext({ accord: (f, h, n) => genre === 'f' ? f : genre === 'h' ? h : n, isDefiId: id => typeof id === 'string',
    itemCommence: id => commencees.has(id), itemDone: id => faits.has(id), allLessons: [{ id: 7 }, { id: 8 }] });
  vm.runInContext(fn('heroSousTitre'), phr);
  const u = t => `<span class="lq-hi-u">${t}</span>`;
  assert.equal(phr.heroSousTitre(7), `Prête pour ${u('ta première leçon')}${N}?`, 'rien de commencé');
  commencees.add(7); assert.equal(phr.heroSousTitre(7), `On reprend là ${u('où tu en étais')}${N}?`, 'la leçon est commencée');
  commencees.clear(); faits.add(7); assert.equal(phr.heroSousTitre(8), `Prête pour ${u('la suite')}${N}?`);
  genre = 'h'; assert.equal(phr.heroSousTitre(8), `Prêt pour ${u('la suite')}${N}?`);
  genre = 'n'; assert.equal(phr.heroSousTitre('d1'), `Prêt·e pour ${u('un défi')}${N}?`);
  commencees.add('d1'); assert.equal(phr.heroSousTitre('d1'), `On reprend ${u('ton défi')}${N}?`);
  genre = 'f'; assert.equal(phr.heroSousTitre(null), `Tu peux être ${u('fière de toi')}${N}!`, 'tout est validé');
  genre = 'h'; assert.equal(phr.heroSousTitre(null), `Tu peux être ${u('fier de toi')}${N}!`);
  const hero = fn('renderHomeHero');
  assert.ok(hero.includes("const hiWord=typeof greetingForHour==='function'?greetingForHour(new Date().getHours()):'Bonjour';") && !app.includes('function salutSuite('));
  assert.ok(hero.includes("const sousT=typeof heroSousTitre==='function'?heroSousTitre(nxt):'';") && hero.includes('${sousT?`<p class="lq-hi-sub">${sousT}</p>`:\'\'}'));
});

test('réf. 2 : « Reprendre ma leçon » seulement si la leçon a été commencée, sinon « Commencer la leçon »', () => {
  const pos = new Map(), ans = {};
  let ses = null;
  const ctx = vm.createContext({ LV_POS: pos, LV_ANS: ans, state: { lessons: {} }, isDefiId: id => typeof id === 'string', defiSesRead: () => ses, nbFaites: id => ctx.state.lessons[id]?.n || 0 });
  vm.runInContext(fn('itemCommence'), ctx);
  assert.equal(ctx.itemCommence(7), false, 'jamais ouverte');
  pos.set(7, 42); assert.equal(ctx.itemCommence(7), true, 'la vidéo arrêtée en route'); pos.clear();
  ans[7] = { 0: { k: 1, q: 'Q' } }; assert.equal(ctx.itemCommence(7), true, 'une réponse pendant l’animation'); delete ans[7];
  ctx.state.lessons[7] = { draft: '  ' }; assert.equal(ctx.itemCommence(7), false, 'un brouillon vide ne compte pas');
  ctx.state.lessons[7] = { draft: 'SELECT *' }; assert.equal(ctx.itemCommence(7), true, 'un brouillon d’exercice');
  ctx.state.lessons[8] = { n: 1 }; assert.equal(ctx.itemCommence(8), true, 'une étape validée');
  assert.equal(ctx.itemCommence('d1'), false);
  ses = { cid: 'd1' }; assert.equal(ctx.itemCommence('d1'), true, 'un défi au chrono en cours');
  assert.equal(ctx.itemCommence('d2'), false, 'pas un autre défi');
  const hero = fn('renderHomeHero');
  /* 7 novembre, 8 h 38 (maquette) : « Continuer ma leçon » plutôt que « Reprendre ma leçon » */
  assert.ok(hero.includes("const commence=itemCommence(nxt);") && hero.includes("const ctaLabel=defi?(commence?'Continuer le défi':'Commencer le défi'):(commence?'Continuer ma leçon':'Commencer la leçon');"));
  assert.ok(!hero.includes('session.started?'), 'une autre activité faite dans la séance ne suffit plus');
});

test('réf. 3 : les activités à rattraper, sur l’accueil… jusqu’au 7 novembre, 8 h 38 (« Supprime la carte 1 séance à terminer »)', () => {
  const hero = fn('renderHomeHero');
  assert.ok(!hero.includes('journey-planning') && !hero.includes('latePlanDetails()'), 'plus de carte de rattrapage sur l’accueil');
  assert.ok(app.includes('const late=lateRecoveryHTML();'), 'le planning garde la sienne');
});

test('la série : « Garde le rythme ! » (puis « Ta série commence aujourd’hui ! ») et sa phrase au-dessus des sept flammes de la semaine', () => {
  const etat = { n: 0, jours: [] };
  const ctx = vm.createContext({ esc, escAttr: esc, document: { querySelector: () => null }, lqLastStreak: null, LQ_FLAME_SVG: '<svg/>', LQ_MOON_SVG: '<svg/>',
    streakJours: () => etat.n, streakRecord: () => etat.n, semaineSerie: () => etat.jours });
  vm.runInContext('var lqLastStreak=null;' + fn('homeStreakHTML'), ctx);
  const sem = done => ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((letter, i) => ({ letter, today: i === 3, kind: i === 3 ? (done ? 'done' : 'today') : i < 3 ? 'done' : 'future' }));
  etat.jours = sem(false);
  let h = ctx.homeStreakHTML();
  /* 7 novembre, 8 h 38 (maquette, « plus positif ») : « Ta série commence aujourd’hui ! » à la place de « Garde le rythme ! » */
  assert.ok(h.includes(`<b>Ta série commence aujourd’hui${N}!</b><small>Une activité par jour pour progresser.</small>`), 'pas encore de série');
  assert.equal((h.match(/class="lq-day /g) || []).length, 7, 'les sept flammes restent');
  etat.n = 2; h = ctx.homeStreakHTML();
  assert.ok(h.includes('<b><span class="lq-count" data-count="2">2</span> jours de série</b><small>Une activité aujourd’hui pour prolonger ta série.</small>'));
  etat.n = 3; etat.jours = sem(true); h = ctx.homeStreakHTML();
  assert.ok(h.includes(`<small>Flamme du jour allumée. À demain${N}!</small>`));
  assert.ok(!app.includes("'Allume ta série'") && !app.includes(":'Allume'}"), '« Allume ta série » est parti');
  assert.ok(lq.includes('html.lq .lq-streak{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-areas:"f c" "w w";'));
  assert.ok(lq.includes('html.lq .lq-week{grid-area:w;justify-content:space-between;padding-top:10px;border-top:1.5px dashed var(--line)}'));
});

test('« Explorer » au lieu de « Chercher », sur l’accueil et dans la page Entretien', () => {
  assert.ok(app.includes('aria-controls="catalog-tools">${LQ_SEARCH_SVG}<span>Explorer</span>'));
  assert.ok(app.includes(`<input id="ent-search" type="search" aria-label="Explorer les questions d’entretien" placeholder="Explorer${N}: LAG, index, NULL…"`));
  assert.ok(app.includes('onclick="entSearchEverywhere()">Explorer toutes les questions</button>'));
  assert.ok(!app.includes('<span>Chercher</span>') && !app.includes('placeholder="Chercher'), 'plus de « Chercher » à l’écran');
});
