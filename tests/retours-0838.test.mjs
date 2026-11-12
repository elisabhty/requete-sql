/* Elisa, 7 novembre, 8 h 38 (une maquette de l’accueil : « 👋 Bonjour Elisa ! », « On reprend là où tu en étais ? », « 14 min
   aujourd’hui », « Continuer ma leçon · Plus que 5 min », trois chiffres, « Ta série commence aujourd’hui ! ») : « On va essayer d’être
   plus positif pour cette écran. Supprime la carte 1 séance à terminer. Et montre moi la page quand il n’y a pas de leçon commencée et
   parcours terminé. »
   - la carte des activités à rattraper quitte l’accueil (le planning garde son rattrapage) ;
   - le bonjour de l’heure, puis une phrase qui dit où on en est (heroSousTitre, retours-1709) ;
   - « 14 min aujourd’hui » (retours-1346, retours-2109), « Continuer ma leçon », « Plus que 5 min » (retours-0849) ;
   - trois chiffres sous la carte, jamais un zéro : rien de commencé, ce que le parcours réserve ; en route, ce qui est fait ; tout
     validé, ce qui est gagné ;
   - sous « Parcours SQL », plus de « 0 leçon validée sur 71 ».
   Vérifié dans un navigateur (320, 375, 393 et 430 px, texte normal et plus grand). */
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

test('les trois chiffres sous la carte : jamais un zéro, selon où on en est', () => {
  const faits = new Set(), commencees = new Set(), ans = {};
  const lecons = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, video: { moments: 2 } }));
  const ctx = vm.createContext({ allLessons: lecons, MODULES: [{ lessons: lecons.slice(0, 3) }, { lessons: lecons.slice(3) }, { lessons: [] }],
    CARTES: { 1: {}, 2: {}, 3: {}, 4: {} }, itemDone: id => faits.has(id), itemCommence: id => commencees.has(id),
    exercicesFaits: id => Object.keys(ans[id] || {}).length,
    CHALLENGES: { length: 477 }, ENTRETIEN: Array(142).fill({}), dureeVideoS: () => 2440 });
  vm.runInContext(cut('const HOME_STAT_SVG=', '/* Ce que l’étiquette de la séance dit à VoiceOver'), ctx);
  const chiffres = () => [...ctx.homeStatsHTML().matchAll(/<li class="lq-stat is-(\w+)"[^>]*><span class="lq-stat-ic" aria-hidden="true"><svg[^]*?<\/svg><\/span><b>([^<]+)<\/b><span>([^<]+)<\/span><\/li>/g)]
    .map(m => `${m[1]} ${m[2]} ${m[3]}`).join(' · ');
  assert.equal(chiffres().replace(/\u00a0/g, ' '), 'manette 477 défis à relever · video 4 h de vidéo · bulle 142 questions d’entretien', 'rien de commencé : ce que l’app réserve au-delà des leçons (19 h 39)');
  commencees.add(1); ans[1] = { a: 1 };
  assert.equal(chiffres(), 'barres 1 leçon lancée · coche 1 exercice fait · cible 6 leçons au total', 'avant la première leçon validée : les exercices faits');
  delete ans[1];
  assert.equal(chiffres(), 'barres 1 leçon lancée · cartes 4 cartes à récolter · cible 6 leçons au total', 'ni exercice ni leçon validée : les cartes à gagner');
  faits.add(1); faits.add(2);
  assert.equal(chiffres(), 'coche 2 leçons validées · cartes 2 cartes gagnées · cible 6 leçons au total', 'rien en cours : pas deux fois « 2 »');
  commencees.add(3);
  assert.equal(chiffres(), 'barres 3 leçons lancées · coche 2 leçons validées · cible 6 leçons au total', 'la maquette, sans son « 0 leçon validée »');
  lecons.forEach(l => faits.add(l.id));
  assert.equal(chiffres(), 'coche 6 leçons validées · cartes 4 cartes gagnées · cible 2 modules terminés', 'tout validé : ce qui est gagné');
  assert.ok(ctx.homeStatsHTML().startsWith('<ul class="lq-stats" role="group" aria-label="Tes chiffres">'), 'un groupe de raccourcis, lu par VoiceOver (12 novembre, 14 h 15)');
  ctx.allLessons = []; assert.equal(ctx.homeStatsHTML(), '', 'sans leçons, rien');
});

test('sous « Parcours SQL », plus de « 0 leçon validée sur 71 »', () => {
  const ctx = vm.createContext({ TOTAL: 71 });
  vm.runInContext(cut('function parcoursValidees(', '\n'), ctx);
  assert.equal(ctx.parcoursValidees(0), '71 leçons');
  assert.equal(ctx.parcoursValidees(1), '1 leçon validée sur 71');
  assert.equal(ctx.parcoursValidees(5), '5 leçons validées sur 71');
  assert.equal(ctx.parcoursValidees(71), '71 leçons validées');
  assert.ok(app.includes('<p class="pc-head-sub">${parcoursValidees(allDone)} · ${nMods} modules</p>'), '« 71 leçons · 15 modules »');
});

test('la carte : « 👋 Bonjour, Elisa ! », la phrase dessous, « Continuer ma leçon · Plus que 5 min », puis les chiffres et la série', () => {
  const h = fn('renderHomeHero');
  assert.ok(h.includes('const hiHtml=`<span class="lq-hi-wave">👋</span> <span class="lq-hi-mot">${esc(hiWord)}</span>'));
  assert.ok(h.includes('${sousT?`<p class="lq-hi-sub">${sousT}</p>`:\'\'}'), 'la phrase sous le bonjour');
  assert.equal((h.match(/<\/section>\$\{stats\}\$\{streak\}`;/g) || []).length, 2, 'les deux cartes : la leçon et le parcours terminé');
  assert.ok(h.includes("(commence?'Continuer ma leçon':'Commencer la leçon')") && h.includes('sub=commence?`Plus que ${minutesDe([nxt],true)}'));
  /* Supprimée : la carte « 1 séance à terminer » (les activités à rattraper) */
  assert.ok(!h.includes('journey-planning') && !h.includes('latePlanDetails()') && !h.includes('extras'), 'plus de carte de rattrapage');
  assert.ok(!app.includes('lateRecoveryHTML'), '10 novembre : le planning non plus, il se décale tout seul (planning-decalage-auto)');
  /* La séance d’un jour passé a l’air de celle du jour : plus de pastille rose sur l’accueil */
  assert.ok(h.includes("const sesVue=sesEtat==='late'?'run':sesEtat;") && h.includes('<span class="lq-ses is-${sesVue}">'));
});

test('le style : la phrase soulignée en jaune, les trois cartes blanches en relief, la main qui salue une fois (et pas en mouvement réduit)', () => {
  for (const k of ['html.lq .lq-hero.has-hi .lq-hero-hi{margin-bottom:4px;padding-bottom:0;border-bottom:0}',
    'html.lq .lq-hi-sub{position:relative;z-index:1;margin:0 0 14px;font:600 16px/1.3 var(--ui);color:rgba(255,255,255,.92);text-wrap:balance}',
    'html.lq .lq-hi-u{padding-bottom:.12em;background:url("data:image/svg+xml,',
    'html.lq .lq-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 14px;padding:0;list-style:none}',
    'html.lq .lq-stat{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;align-content:start;',
    'background:#fff;box-shadow:0 3px 0 var(--lip)}', 'html.lq .lq-stat.is-coche .lq-stat-ic{background:#DCF6E9;color:#14935A}',
    '@keyframes lqSalut{', '@media (prefers-reduced-motion:reduce){html.lq .lq-hi-wave{animation:none}}', 'html.lq[data-motion="reduce"] .lq-hi-wave{animation:none}'])
    assert.ok(lq.includes(k), k);
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=321">'));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-12-stickers-bonjour-v2900';") && app.includes("const SW_CACHE='requete-2026-11-12-stickers-bonjour-v2900';"));
});
