/* Elisa, 13 novembre, 0 h 07 : « est-ce que tu peux couper dans la vidéo data analyst là où on parle de recherche d’apprentissage
   et la mettre dans l’onboarding, animé, micro-animé, au bon endroit ».
   La scène « Une méthode fondée sur la recherche » de la vidéo (decouvrir/video.html, S8b) devient une page de l’onboarding,
   entre le parcours construit et les avis. La vidéo du site, elle, ne change pas. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = lire('index.html');
const css = lire('onboarding-vitrine.css');
const video = lire('decouvrir/video.html');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i + a.length); assert.ok(j > i, b); return html.slice(i, j); };
const NBSP = String.fromCharCode(160);
const texte = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, NBSP).replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/* La page, hors de l’app : ses données et son HTML, avec les jours de révision qu’on lui donne */
const bloc = cut("const OB_ME_FIOLE='", '/* Les trois études, telles que la vidéo les cite');
const page = (jours = [1, 3, 7, 21, 60]) => vm.runInNewContext(bloc + ';({m:OB_METHODE,e:OB_ME_ETUDES,h:obMethodeHtml()})', { INTERVALS: jours });

test('l’ordre : la méthode vient après le parcours construit et avant les avis, comptée dans les étapes', () => {
  const ob = vm.runInNewContext(html.match(/const OB_SLIDES = (\[[^\]]+\]);/)[1]);
  assert.equal(ob[ob.indexOf('build') + 1], 'methode');
  assert.equal(ob[ob.indexOf('methode') + 1], 'temoignages');
  const prof = vm.runInNewContext(html.match(/const OB_PROFILE_SLIDES=(\[[^\]]+\]);/)[1]);
  assert.equal(prof[prof.indexOf('build') + 1], 'methode', '« Étape X sur N » la compte');
  /* Suivant (le balayage), le bouton de chaque page, et le retour */
  assert.ok(html.includes("  else if(slide==='build')obGoto('methode');\n  else if(slide==='methode')obGoto('temoignages');\n  else if(slide==='temoignages')obGoto('pact');"));
  assert.ok(html.includes("    obSetFooter('Continuer',()=>obGoto('methode'),'','','',true);\n    obRunBuild();"), 'le parcours construit mène à la méthode');
  const p = cut("}else if(slide==='methode'){", "}else if(slide==='temoignages'){");
  assert.ok(p.includes('<div class="ob-screen ob-profile ob-methode">${obFlowHeader(slide)}<h1 class="ob-title" id="ob-title">Une méthode fondée<br>sur la <em>recherche</em>.</h1>'));
  assert.ok(p.includes("obSetFooter('Continuer',()=>obGoto('temoignages'),'','','');"), 'un seul bouton au pied : les études s’ouvrent depuis le bloc « 1,5 × »');
  /* Retour : la page d’avant, comme partout (des avis à la méthode, de la méthode au parcours déjà construit) */
  const retour = html.slice(html.lastIndexOf('function obBack(){'));
  assert.ok(retour.slice(0, retour.indexOf('\n}\n')).trimEnd().endsWith('obGoto(obStep-1);'));
  /* L’île dynamique et l’entonnoir (le serveur accepte tout nom d’étape de 2 à 16 lettres) */
  assert.ok(html.includes("build:'Ton parcours se prépare',methode:'Fondée sur la recherche',temoignages:"));
  assert.match('methode', /^[a-zA-Z]{2,16}$/);
  assert.ok(html.includes("  if(slide==='methode')obMethodeAnimer();"));
});

test('le contenu est celui de la scène de la vidéo : trois pratiques, ce que fait Requête, ce que dit la recherche, et « 1,5 × »', () => {
  const scene = video.slice(video.indexOf('<section class="scene" id="sme">'), video.indexOf('</section>', video.indexOf('<section class="scene" id="sme">')));
  assert.ok(scene.includes('Une méthode fondée') && scene.includes('sur la <em>recherche</em>.'), 'la vidéo du site garde sa scène');
  const dit = texte(scene);
  const { m, h } = page();
  assert.deepEqual([...m].map(x => x.k), ['pratiquer', 'tester', 'espacer']);
  for (const x of m) {
    for (const k of ['t', 'fait', 'dit']) assert.ok(dit.includes(texte(x[k])), `« ${x[k]} » vient de la vidéo`);
    assert.ok(scene.includes(x.ico), 'la même icône');
  }
  assert.ok(dit.includes('plus de risques d’échouer avec un enseignement magistral qu’avec un apprentissage actif.'));
  /* La page : une liste de trois cartes, chacune avec son titre, la ligne « >_ » et la ligne de la fiole */
  assert.ok(h.startsWith('<div class="ob-me-b"><ul class="ob-me" role="list">') && h.endsWith('</button></div>'), 'dans un bloc : l’arrivée générale des pages ne prend pas la place des animations des cartes et du chiffre');
  assert.equal((h.match(/<li class="ob-me-c is-/g) || []).length, 3);
  assert.equal((h.match(/<h2>/g) || []).length, 3, 'des titres de niveau 2 sous le titre de la page');
  assert.equal((h.match(/<p class="ob-me-r"><span class="ob-me-app" aria-hidden="true">&gt;<i>_<\/i><\/span><span class="ob-me-rt">/g) || []).length, 3);
  assert.equal((h.match(/<p class="ob-me-s"><svg /g) || []).length, 3);
  assert.ok(texte(h).includes('1,5 × fois plus de risques d’échouer avec un enseignement magistral qu’avec un apprentissage actif. Voir les études'));
  assert.ok(h.includes('<b><span id="ob-me-n">1,5</span><i aria-hidden="true">×</i><span class="ob-sr"> fois</span></b>'), 'lu « 1,5 fois »');
  assert.ok(!/bient[oô]t|prochainement/i.test(h));
});

test('les jours de révision sont ceux de l’app (INTERVALS), pas une liste recopiée', () => {
  assert.ok(html.includes('const INTERVALS=[1,3,7,21,60];'));
  const { h } = page();
  assert.ok(h.includes('<p class="ob-me-j" aria-label="Révisions à J+1, J+3, J+7, J+21, J+60"><span style="--j:0">J+1</span><span style="--j:1">J+3</span><span style="--j:2">J+7</span><span style="--j:3">J+21</span><span style="--j:4">J+60</span></p>'));
  assert.equal((h.match(/class="ob-me-j"/g) || []).length, 1, 'sur la carte « Réviser au bon moment » seulement');
  /* Si les intervalles changent un jour, la page suit */
  assert.ok(page([2, 5, 12]).h.includes('aria-label="Révisions à J+2, J+5, J+12"><span style="--j:0">J+2</span><span style="--j:1">J+5</span><span style="--j:2">J+12</span></p>'));
  /* Sans la constante (un harnais de test), la liste de la vidéo */
  assert.ok(vm.runInNewContext(bloc + ';obMethodeHtml()', {}).includes('<span style="--j:4">J+60</span>'));
});

test('« Voir les études » : le bloc « 1,5 × » est un bouton, il ouvre les trois références de la vidéo (0 h 32, réf. 1 : la phrase s’arrête à « publiées », sans parler de Requête)', () => {
  const { h, e } = page();
  assert.ok(h.includes('<button type="button" class="ob-me-x" onclick="obMethodeSources()">'));
  assert.ok(/<u>Voir les études<svg [^>]*aria-hidden="true">/.test(h));
  const f = cut('function obMethodeSources(){', '\n}\n');
  assert.ok(f.includes("lqAsk({ico:'🔬',titre:'Les études',texte:'Ces résultats viennent d’études publiées.',"));
  assert.ok(!/Requête/.test(f), 'la feuille ne parle pas de Requête');
  assert.ok(f.includes('corps:`<ul class="ob-me-refs">${OB_ME_ETUDES.map(([t,r])=>`<li><b>${esc(t)}</b><span>${esc(r)}</span></li>`).join(\'\')}</ul>`,oui:\'OK\',non:null});'));
  /* Les mêmes références, les mêmes chiffres que dans les sources de la vidéo */
  const sources = texte(video.slice(video.indexOf('Pratiquer plutôt qu’écouter&nbsp;: environ 6'), video.indexOf('id="src-close"')));
  assert.equal(e.length, 3);
  const [freeman, dunlosky, cepeda] = [...e].map(x => x[1]);
  const plat = x => x.replace(/\s+/g, ' ');   // les espaces insécables comptent comme des espaces
  for (const morceau of ['Freeman et al.', 'Active learning increases student performance in science, engineering, and mathematics', 'PNAS, 2014', '225 études', 'environ 6 % de mieux aux examens avec un apprentissage actif', '1,5 fois plus de risques d’échouer en cours magistral']) {
    assert.ok(sources.includes(morceau), morceau);
    assert.ok(plat(freeman).includes(morceau), morceau);
  }
  for (const morceau of ['Dunlosky et al.', 'Improving Students’ Learning With Effective Learning Techniques', 'Psychological Science in the Public Interest, 2013']) { assert.ok(sources.includes(morceau), morceau); assert.ok(dunlosky.includes(morceau), morceau); }
  assert.ok(sources.includes('les deux techniques les mieux notées sur les dix étudiées') && dunlosky.includes('Les deux techniques les mieux notées sur les dix étudiées.'));
  for (const morceau of ['Cepeda et al.', 'Distributed practice in verbal recall tasks: A review and quantitative synthesis', 'Psychological Bulletin, 2006', '317 expériences tirées de 184 articles']) { assert.ok(sources.includes(morceau), morceau); assert.ok(cepeda.includes(morceau), morceau); }
  /* La feuille : une liste lisible, alignée à gauche */
  assert.ok(css.includes('.lq-ask .ob-me-refs{display:grid;gap:12px;margin:0;padding:0;list-style:none;text-align:left}'));
});

test('animé, micro-animé : les cartes arrivent l’une après l’autre, la ligne « >_ » se tape, la fiole s’agite, le chiffre monte à 1,5', () => {
  const debut = css.indexOf('@media (prefers-reduced-motion:no-preference){'), fin = css.indexOf('\n}\n', css.indexOf('#onboarding.ob-vitrine.ob-enter .ob-me-c{'));
  const media = css.slice(debut, fin);
  for (const regle of [
    '#onboarding.ob-vitrine.ob-enter .ob-me-c{animation:obMeCarte .5s var(--v-pop) calc(.2s + var(--i) * .34s) backwards}',
    '#onboarding.ob-vitrine.ob-enter .ob-me-i{animation:obMeIco .5s var(--v-pop) calc(.32s + var(--i) * .34s) backwards}',
    '#onboarding.ob-vitrine.ob-enter .ob-me-rt{animation:obMeTape .5s steps(22,end) calc(.5s + var(--i) * .34s) backwards}',
    '#onboarding.ob-vitrine.ob-enter .ob-me-j span{animation:obMeJour .34s var(--v-pop) calc(1.28s + var(--j) * .09s) backwards}',
    '#onboarding.ob-vitrine.ob-enter .ob-me-s{animation:obMeDit .4s ease-out calc(.8s + var(--i) * .34s) backwards}',
    '#onboarding.ob-vitrine.ob-enter .ob-me-s svg{animation:obMeFiole .7s ease-in-out calc(.92s + var(--i) * .34s) backwards}',
    '#onboarding.ob-vitrine.ob-enter .ob-me-x{animation:obMeCarte .5s var(--v-pop) 1.75s backwards}',
    '#onboarding.ob-vitrine .ob-me-x.is-compte b{animation:obMeChiffre .5s var(--v-pop)}',
    '#onboarding.ob-vitrine .ob-me-app i{animation:obMeCurseur 1.1s steps(1,end) infinite}'
  ]) assert.ok(media.includes('  html:not([data-motion="reduce"]) ' + regle), regle);
  /* Aucune animation de la page hors du bloc « mouvement accepté » */
  const dehors = css.slice(0, debut) + css.slice(fin);
  assert.ok(!/\.ob-me[^{}]*\{[^}]*animation\s*:/.test(dehors));
  for (const k of ['obMeCarte', 'obMeIco', 'obMeTape', 'obMeJour', 'obMeDit', 'obMeFiole', 'obMeChiffre', 'obMeCurseur']) assert.ok(css.includes('@keyframes ' + k + '{'), k);
  /* Chaque carte porte son rang, chaque pastille le sien */
  const { h } = page();
  assert.ok(h.includes('<li class="ob-me-c is-pratiquer" style="--i:0">') && h.includes('<li class="ob-me-c is-tester" style="--i:1">') && h.includes('<li class="ob-me-c is-espacer" style="--i:2">'));
});

test('le chiffre : de 1,0 à 1,5 quand son bloc arrive, une seule fois ; mouvement réduit ou page déjà vue : 1,5 tout de suite', () => {
  const f = cut('let obMethodeT=0;', '\n}\n') + '\n}';
  const monter = ({ entre, reduit }) => {
    const n = { textContent: '1,5', closest: () => bloc2 }, classes = [];
    const bloc2 = { classList: { add: c => classes.push(c) } };
    const minuteurs = [], images = [];
    let t = 0, vibre = 0;
    const ctx = { obJustEntered: entre, prefersReduceMotion: () => reduit, document: { getElementById: id => id === 'ob-me-n' ? n : null }, performance: { now: () => t },
      setTimeout: (fn, d) => { minuteurs.push([fn, d]); return minuteurs.length; }, clearTimeout: () => {}, requestAnimationFrame: fn => { images.push(fn); }, buzz: () => { vibre++; } };
    vm.runInNewContext(f + ';obMethodeAnimer();', ctx);
    return { n, classes, minuteurs, images, avancer: ms => { t += ms; const fn = images.shift(); if (fn) fn(t); }, vibre: () => vibre };
  };
  /* Arrivée sur la page : 1,0, puis la montée 1,75 s plus tard, sur 750 ms */
  const a = monter({ entre: true, reduit: false });
  assert.equal(a.n.textContent, '1,0');
  assert.equal(a.minuteurs.length, 1);
  assert.equal(a.minuteurs[0][1], 1750, 'en même temps que l’arrivée du bloc (1,75 s dans la feuille de style)');
  a.minuteurs[0][0]();
  a.avancer(0);
  assert.equal(a.n.textContent, '1,0');
  a.avancer(375);
  assert.match(a.n.textContent, /^1,[34]$/, 'à mi-course, déjà bien avancé (ralenti en fin de course)');
  a.avancer(375);
  assert.equal(a.n.textContent, '1,5');
  assert.deepEqual(a.classes, ['is-compte'], 'le petit rebond du chiffre');
  assert.equal(a.vibre(), 1);
  assert.equal(a.images.length, 0, 'et rien ne tourne ensuite');
  /* Mouvement réduit, ou page repeinte sans y entrer : le chiffre est là */
  for (const cas of [{ entre: true, reduit: true }, { entre: false, reduit: false }]) {
    const b = monter(cas);
    assert.equal(b.n.textContent, '1,5');
    assert.equal(b.minuteurs.length, 0);
  }
});

test('la page tient sur l’écran : le pied garde un seul bouton, des paliers pour les petits iPhone, et la mesure ne se trompe plus en mouvement réduit', () => {
  /* Le bloc « 1,5 × », bouton de toute la largeur */
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-me-x{display:flex;align-items:center;gap:14px;width:100%;'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-me-x:focus-visible{outline:3px solid var(--v-sun-hi);outline-offset:2px}'));
  /* Les trois lignes d’une carte s’alignent : 30 + 10 à gauche du texte */
  assert.ok(css.includes('.ob-me-i{flex:none;display:grid;place-items:center;width:30px;height:30px;'));
  assert.ok(css.includes('width:22px;height:22px;margin:0 4px;'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-me-j{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 0 40px}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-me-s svg{flex:none;width:15px;height:15px;margin:1px 7.5px 0;'));
  /* Les paliers d’obFit */
  for (const k of [1, 2, 3, 4]) assert.ok(css.includes(`html #onboarding.ob-vitrine.ob-fit-${k} .ob-me`), 'palier ' + k);
  /* Mouvement réduit : toute transition y dure 0,01 ms, obFit lisait donc la hauteur d’avant son changement d’échelle */
  assert.ok(lire('ludique.css').includes('html.lq *,html.lq *::before,html.lq *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}'));
  assert.ok(css.includes('@media (prefers-reduced-motion:reduce){html #onboarding.ob-vitrine.ob-jauge,html #onboarding.ob-vitrine.ob-jauge *,html #onboarding.ob-vitrine.ob-jauge *::before,html #onboarding.ob-vitrine.ob-jauge *::after{transition:none!important}}'));
  assert.ok(css.includes('html[data-motion="reduce"] #onboarding.ob-vitrine.ob-jauge,html[data-motion="reduce"] #onboarding.ob-vitrine.ob-jauge *,html[data-motion="reduce"] #onboarding.ob-vitrine.ob-jauge *::before,html[data-motion="reduce"] #onboarding.ob-vitrine.ob-jauge *::after{transition:none!important}'));
  assert.ok(html.includes("  root.classList.add('ob-jauge');") && html.includes("  root.classList.remove('ob-jauge');\n  metZ(z);"), 'le temps de la mesure seulement');
});
