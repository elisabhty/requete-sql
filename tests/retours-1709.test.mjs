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

test('réf. 2 : « Prête pour la suite, Elisa ? », selon le genre ; le salut de l’heure quand le parcours est terminé', () => {
  const title = {}, sous = {};
  let suite = true, genre = 'f';
  const ctx = vm.createContext({ state: { name: 'Elisa' }, Date: class { getHours() { return 15; } }, recommendedSession: () => suite ? { id: 1 } : null,
    accord: (f, h, n) => genre === 'f' ? f : genre === 'h' ? h : n, document: { querySelector: () => title, getElementById: () => sous, createElement: () => ({ style: {} }) } });
  vm.runInContext(cut('function greetingForHour(', 'function renderStartCta('), ctx);
  ctx.renderGreeting();
  assert.equal(title.textContent, `Prête pour la suite, Elisa${N}?`);
  genre = 'h'; ctx.renderGreeting(); assert.equal(title.textContent, `Prêt pour la suite, Elisa${N}?`);
  genre = 'n'; ctx.state.name = ''; ctx.renderGreeting(); assert.equal(title.textContent, `Prêt·e pour la suite${N}?`);
  suite = false; ctx.state.name = 'Elisa'; ctx.renderGreeting(); assert.equal(title.textContent, 'Bon après-midi, Elisa', 'plus de suite : le salut de l’heure');
  const hero = fn('renderHomeHero');
  assert.ok(hero.includes("const suite=nxt!=null&&typeof salutSuite==='function'?salutSuite():'';"));
  assert.ok(hero.includes("const hiHtml=`<span class=\"lq-nw\">${esc(hiWord)}</span>${name?`, ${esc(name)}`:''}${suite?'\\u00a0?':''}`;"));
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
  assert.ok(hero.includes(":(itemCommence(nxt)?'Reprendre ma leçon':'Commencer la leçon'));") && hero.includes("?(itemCommence(nxt)?'Reprendre le défi':'Commencer le défi')"));
  assert.ok(!hero.includes('session.started?'), 'une autre activité faite dans la séance ne suffit plus');
});

test('réf. 3 : les activités à rattraper, sur l’accueil, sans pastille rouge ni étiquette jaune, avec ce qu’on y fait', () => {
  const hero = fn('renderHomeHero');
  assert.ok(hero.includes('<button type="button" class="journey-planning is-calme" onclick="openLateRecoveryFromHome(this)"><span class="jp-stk" aria-hidden="true">${lqStkSvg(\'cal\')}</span>'));
  assert.ok(hero.includes('<small class="jp-desc">Réorganise ton planning pour reprendre à ton rythme.</small>') && !hero.includes('jp-badge'));
  assert.ok(lq.includes('html.lq #home-hero .journey-planning.is-calme .jp-copy small.jp-meta{align-self:auto;padding:0;border-radius:0;background:none;box-shadow:none;color:var(--ink-3)!important;'));
});

test('la série : « Garde le rythme ! » et sa phrase au-dessus des sept flammes de la semaine', () => {
  const etat = { n: 0, jours: [] };
  const ctx = vm.createContext({ esc, escAttr: esc, document: { querySelector: () => null }, lqLastStreak: null, LQ_FLAME_SVG: '<svg/>', LQ_MOON_SVG: '<svg/>',
    streakJours: () => etat.n, streakRecord: () => etat.n, semaineSerie: () => etat.jours });
  vm.runInContext('var lqLastStreak=null;' + fn('homeStreakHTML'), ctx);
  const sem = done => ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((letter, i) => ({ letter, today: i === 3, kind: i === 3 ? (done ? 'done' : 'today') : i < 3 ? 'done' : 'future' }));
  etat.jours = sem(false);
  let h = ctx.homeStreakHTML();
  assert.ok(h.includes(`<b>Garde le rythme${N}!</b><small>Une activité aujourd’hui pour lancer ta série.</small>`), 'pas encore de série');
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
