/* 4 novembre, 9 h 36 (Elisa, deux captures). Réf. 1, une autre appli : « Combien de minutes par jour ? », quatre tuiles et
   « Voilà ce que ça t’apporte » (des histoires par mois, des heures de culture par an) : « j’ai oublié de demander le nombre de jours
   préféré pour étudier, ou tous les jours ». Une étape « Combien de jours par semaine ? », après la durée des séances : 2, 3 ou
   5 jours, ou tous les jours (les rythmes du planning), et ce que ça t’apporte en un an. Le parcours, la promesse et l’engagement
   suivent les jours choisis. (Réf. 2, « Comment as-tu entendu parler de Duolingo ? » : la page existe déjà, après la première
   requête, voir tests/retours-0354.test.mjs.) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html');
const css = read('onboarding-vitrine.css');
const sw = read('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const lastCut = (a, b) => { const i = app.lastIndexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

const RYTHMES = vm.runInNewContext(cut('const RYTHMES=', 'const FREQS=').replace('const RYTHMES=', '').trim().replace(/;$/, ''));
const FREQS = vm.runInNewContext(cut('const FREQS=', 'const PATTERN=').replace('const FREQS=', '').trim().replace(/;$/, ''));
const PATTERN = vm.runInNewContext('(' + cut('const PATTERN=', 'const JOURS=').replace('const PATTERN=', '').trim().replace(/;$/, '') + ')');
const aides = cut('const OB_JOURS=[2,3,5,7];', 'function obMascotQuestion(text){');
const obRythmeMinutes = cut('function obRythmeMinutes(rythme){', 'function paintOb(){');

/* Les aides de l’étape, exécutées seules (avec un faux DOM pour le défilement des nombres). */
const etape = ({ rythme = 'regulier', freq = 7, reduit = false, noeuds = [] } = {}) => {
  const images = [];
  const ctx = vm.createContext({
    RYTHMES, FREQS, PATTERN, draft: { rythme, freq }, Number, String, Math,
    prefersReduceMotion: () => reduit,
    requestAnimationFrame: f => images.push(f),
    document: { querySelectorAll: sel => (sel === '#ob-body .ob-apport-n[data-n]' ? noeuds : []) },
  });
  vm.runInContext(obRythmeMinutes + aides.replace('const OB_JOURS=', 'var OB_JOURS=').replace('let obJoursAvant=', 'var obJoursAvant='), ctx);
  return { ctx, images };
};
const noeud = n => ({ dataset: { n: String(n) }, textContent: String(n), isConnected: true });

test('une étape de plus, juste après la durée des séances, et comptée dans « Étape X sur N »', () => {
  assert.ok(app.includes("const OB_SLIDES = ['welcome','name','age','job','goal','level','rhythm','jours','build','promise','pact','practice','source','rappel','widget','widgetTuto','account','pseudo','ready'];"));
  assert.ok(app.includes("const OB_PROFILE_SLIDES=['name','age','job','goal','level','rhythm','jours','build','promise','pact','practice'];"));
  /* obNext, exécuté seul : rythme → jours → parcours */
  const vers = [];
  const ctx = vm.createContext({ OB_SLIDES: vm.runInNewContext(app.match(/const OB_SLIDES = (\[[^\]]+\]);/)[1]), obStep: 0, OB_FIN_SLIDES: [],
    obGoto: t => vers.push(t), obAfterPractice: () => 'ready', obChooseGuest() {}, finishOnboard() {} });
  vm.runInContext(lastCut('function obNext(){', 'function obBack(){') + ';var next=s=>{obStep=OB_SLIDES.indexOf(s);obNext();};', ctx);
  for (const s of ['level', 'rhythm', 'jours']) vm.runInContext(`next('${s}')`, ctx);
  assert.deepEqual(vers, ['rhythm', 'jours', 'build']);
  /* La durée ne mène plus droit au parcours : « Continuer », puis « Construire mon parcours » sous les jours. */
  const rythme = lastCut("}else if(slide==='rhythm'){", "}else if(slide==='jours'){");
  assert.ok(rythme.includes("obSetFooter('Continuer',()=>obGoto('jours'),'','','');") && !rythme.includes('Construire mon parcours'));
  /* Retour depuis le parcours : obBack recule d’une étape, on retrouve les jours. */
  assert.ok(lastCut('function obBack(){', 'function obPick(').includes('obGoto(obStep-1);'));
});

test('les quatre tuiles : les rythmes du planning, du plus léger à tous les jours, choix unique', () => {
  const { ctx } = etape();
  assert.deepEqual([...vm.runInContext('OB_JOURS', ctx)], [2, 3, 5, 7]);
  assert.deepEqual([...vm.runInContext('OB_JOURS', ctx)].sort(), [...FREQS.map(f => f.k)].sort(), 'les mêmes que le planning (FREQS)');
  const j = lastCut("}else if(slide==='jours'){", "}else if(slide==='build'){");
  /* La page, rendue seule */
  const rendu = (freq, rythme = 'regulier') => {
    const pied = [];
    const c = etape({ freq, rythme }).ctx;
    Object.assign(c, { slide: 'jours', obFlowHeader: s => `<header data-s="${s}"></header>`, obMascotQuestion: t => `<div class="ob-chat">${t}</div>`,
      esc: s => String(s), escAttr: s => String(s).replace(/"/g, '&quot;'), obSetFooter: (...a) => pied.push(a), obGoto: () => {} });
    vm.runInContext('var html="";if(slide===\'x\'){' + j + '}', c);
    return { html: c.html, pied };
  };
  const { html, pied } = rendu(7);
  assert.ok(html.includes('<h1 class="ob-title" id="ob-title">Combien de <em>jours</em> par semaine&nbsp;?</h1>'));
  assert.ok(html.includes('<div class="ob-chat">Même deux jours par semaine, ça fait avancer !</div>'), 'la mascotte pose la question, comme aux autres étapes');
  assert.ok(html.includes('role="radiogroup" aria-label="Jours d’entraînement par semaine"'));
  const tuiles = [...html.matchAll(/<button type="button" role="radio" aria-checked="(true|false)" class="ob-tile ob-jour-tile ([a-z]*)" style="--d:(\d+)ms" onclick="obPick\('freq',(\d)\)" aria-label="([^"]+)"><b>(\d)<\/b><small>jours<\/small><span class="ob-jour-dots" aria-hidden="true">((?:<i class="(?:on)?" style="--j:\d"><\/i>){7})<\/span><\/button>/g)];
  assert.equal(tuiles.length, 4);
  assert.deepEqual(tuiles.map(t => +t[4]), [2, 3, 5, 7]);
  assert.deepEqual(tuiles.map(t => t[1]), ['false', 'false', 'false', 'true'], 'tous les jours, par défaut');
  assert.deepEqual(tuiles.map(t => t[2]), ['', '', '', 'on']);
  assert.deepEqual(tuiles.map(t => t[5]), ['2 jours / semaine : Lundi et jeudi', '3 jours / semaine : Lundi, mercredi, vendredi', 'En semaine : Du lundi au vendredi', 'Tous les jours : Sept jours sur sept'], 'ce que lit un lecteur d’écran');
  assert.deepEqual(tuiles.map(t => (t[7].match(/class="on"/g) || []).length), [2, 3, 5, 7], 'les jours des séances, en points allumés');
  assert.deepEqual(pied, [['Construire mon parcours', pied[0][1], '', '', '']]);
  assert.equal(rendu(3).html.match(/aria-checked="true"[^>]*onclick="obPick\('freq',(\d)\)"/)[1], '3');
  assert.equal(rendu(4).html.match(/aria-checked="true"[^>]*onclick="obPick\('freq',(\d)\)"/)[1], '7', 'une valeur inconnue revient à tous les jours');
  /* Ce que ça t’apporte, avec les nombres du rythme choisi */
  assert.ok(html.includes('<p class="ob-apport-k">Voilà ce que ça t’apporte en un an</p>'));
  assert.ok(html.includes(`<i class="ob-apport-n" data-n="1092">${(1092).toLocaleString('fr-FR')}</i></b><small>activités</small>`));
  assert.ok(html.includes('<i class="ob-apport-n" data-n="121">121</i><em>h</em></b><small>de pratique</small>'));
  assert.ok(html.includes('<p class="ob-apport-note">Sept jours sur sept · 20&nbsp;min par séance</p>'));
  const calme = rendu(2, 'calme').html;
  assert.ok(calme.includes('data-n="208"') && calme.includes('data-n="17"') && calme.includes('Lundi et jeudi · 10&nbsp;min par séance'));
  assert.ok(!html.includes('aria-live'), 'les nombres qui défilent ne sont pas lus à chaque image');
});

test('ce que ça t’apporte en un an : les activités du rythme et ses minutes, sur cinquante-deux semaines', () => {
  const { ctx } = etape();
  const apport = (rythme, f) => { ctx.draft.rythme = rythme; const a = vm.runInContext(`obJoursApport(${f})`, ctx); return [a.activites, a.heures, a.minutes]; };
  assert.deepEqual(apport('regulier', 7), [1092, 121, 20]);
  assert.deepEqual(apport('regulier', 3), [468, 52, 20]);
  assert.deepEqual(apport('calme', 2), [208, 17, 10]);
  assert.deepEqual(apport('intensif', 5), [1300, 130, 30]);
  assert.deepEqual(apport('intensif', 7), [1820, 182, 30]);
  /* Par mois et par an (comme la capture), les deux nombres tombaient pareil à 10 minutes : 61 activités, 61 h. Plus maintenant. */
  for (const r of RYTHMES) for (const f of [2, 3, 5, 7]) { const [a, h] = apport(r.k, f); assert.notEqual(a, h, `${r.k}, ${f} jours`); }
  assert.deepEqual(apport('regulier', 9), [1092, 121, 20], 'une valeur inconnue compte comme tous les jours');
  /* Les points, du lundi au dimanche (PATTERN compte le dimanche en 0) */
  const points = k => [...vm.runInContext(`obJoursPoints(${k})`, ctx).matchAll(/<i class="(on)?" style="--j:(\d)">/g)].map(m => (m[1] ? 'x' : '.')).join('');
  assert.equal(points(2), 'x..x...');
  assert.equal(points(3), 'x.x.x..');
  assert.equal(points(5), 'xxxxx..');
  assert.equal(points(7), 'xxxxxxx');
});

test('les nombres défilent : depuis zéro à l’arrivée, depuis les anciens à chaque choix, jamais en mouvements réduits', () => {
  /* À l’arrivée : zéro, puis la valeur, après une petite attente (le temps que la carte arrive) */
  let ns = [noeud(1092), noeud(121)];
  let { ctx, images } = etape({ noeuds: ns });
  vm.runInContext('obJoursCompter(true)', ctx);
  assert.deepEqual(ns.map(n => n.textContent), ['0', '0']);
  const jouer = (t) => { const f = images.shift(); assert.ok(f, 'image suivante'); f(t); };
  jouer(1000); jouer(1300);
  assert.deepEqual(ns.map(n => n.textContent), ['0', '0'], 'encore en attente');
  jouer(1380 + 475);
  const mi = ns.map(n => +n.textContent.replace(/\s/g, ''));
  assert.ok(mi[0] > 0 && mi[0] < 1092 && mi[1] > 0 && mi[1] < 121, String(mi));
  jouer(1380 + 950);
  assert.deepEqual(ns.map(n => n.textContent), [(1092).toLocaleString('fr-FR'), '121']);
  assert.equal(images.length, 0, 'fini');
  /* À un choix (obPick garde les anciennes valeurs) : de 1 092 à 468, en 650 ms */
  ns = [noeud(468), noeud(52)];
  ({ ctx, images } = etape({ noeuds: ns, freq: 3 }));
  vm.runInContext('obJoursAvant={activites:1092,heures:121,minutes:20};obJoursCompter(false)', ctx);
  assert.deepEqual(ns.map(n => n.textContent), [(1092).toLocaleString('fr-FR'), '121']);
  jouer(500); jouer(500 + 650);
  assert.deepEqual(ns.map(n => n.textContent), ['468', '52']);
  assert.equal(vm.runInContext('obJoursAvant', ctx), null, 'oublié une fois servi');
  /* Repeindre l’étape sans y entrer ni choisir : rien ne bouge */
  ns = [noeud(468), noeud(52)];
  ({ ctx, images } = etape({ noeuds: ns }));
  vm.runInContext('obJoursCompter(false)', ctx);
  assert.equal(images.length, 0);
  /* Mouvements réduits : les valeurs, tout de suite */
  ns = [noeud(1092), noeud(121)];
  ({ ctx, images } = etape({ noeuds: ns, reduit: true }));
  vm.runInContext('obJoursCompter(true)', ctx);
  assert.equal(images.length, 0);
  assert.deepEqual(ns.map(n => n.textContent), ['1092', '121']);
  /* Branché dans paintOb, et dans obPick */
  assert.ok(app.includes("  if(slide==='jours')obJoursCompter(obJustEntered);\n"));
  const pick = lastCut('function obPick(champ,val){', 'function obPseudoTape(');
  assert.ok(pick.includes("if(!['niveau','rythme','goal','ageRange','job','source','freq'].includes(champ))return;"));
  assert.ok(pick.includes("if(champ==='freq'){obJoursAvant=obJoursApport(draft.freq||7);val=OB_JOURS.includes(+val)?+val:7;}"));
  assert.ok(pick.includes("if(champ==='niveau'||champ==='rythme'||champ==='goal'||champ==='freq')draft.buildDone=false;"), 'un autre nombre de jours reconstruit le parcours');
});

test('la promesse et l’engagement suivent les jours choisis', () => {
  const promesse = lastCut("}else if(slide==='promise'){", "}else if(slide==='pact'){");
  assert.ok(promesse.includes("const b=obPlanInfo(),fq=draft.freq||7,quand=fq===7?' par jour':fq===5?' par jour en semaine':`, ${fq} jours par semaine`;"));
  assert.ok(promesse.includes('Avec <em>${b.minutes} minutes</em>${quand}, tu termines tes <em>${b.lessons} leçons</em> d’ici le ${esc(b.endLabel)}.</h1>'));
  const quand = fq => vm.runInNewContext("fq===7?' par jour':fq===5?' par jour en semaine':`, ${fq} jours par semaine`", { fq });
  assert.deepEqual([7, 5, 3, 2].map(f => `Avec 20 minutes${quand(f)}, tu termines`), ['Avec 20 minutes par jour, tu termines', 'Avec 20 minutes par jour en semaine, tu termines',
    'Avec 20 minutes, 3 jours par semaine, tu termines', 'Avec 20 minutes, 2 jours par semaine, tu termines']);
  const pacte = lastCut("}else if(slide==='pact'){", 'obSetFooter(');
  assert.ok(pacte.includes("const duree=f===7?`<b>${m} par jour</b>`:f===5?`<b>${m} par jour</b> en semaine`:`<b>${m}</b>, <b>${f} jours par semaine</b>,`;"));
  /* Le parcours construit et le planning créé à la fin prennent les mêmes jours */
  assert.ok(app.includes('freqLabel:(FREQS.find(f=>f.k===freq)||FREQS[0]).t') && app.includes('state.plan=apercuPlan(draft.niveau,draft.rythme,draft.freq);'));
});

test('l’habillage : tuiles en ligne comme l’âge, carte voilée aux nombres jaunes, tout tient sur un écran', () => {
  const s = sansCommentaires(css);
  for (const r of ['html #onboarding.ob-vitrine .ob-jours-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}',
    'html #onboarding.ob-vitrine .ob-jour-tile b{display:block;font:800 32px/1 var(--v-display);letter-spacing:-.03em;color:var(--c);font-variant-numeric:tabular-nums}',
    'html #onboarding.ob-vitrine .ob-jour-dots i.on{background:var(--c)}',
    'html #onboarding.ob-vitrine .ob-apport{margin-top:16px;padding:13px 12px 12px;border:1.5px solid rgba(255,255,255,.22);border-radius:18px;background:rgba(255,255,255,.1);color:#fff;text-align:center}',
    'html #onboarding.ob-vitrine.ob-fit-3 .ob-apport-note{display:none}', 'html #onboarding.ob-vitrine.ob-fit-4 .ob-jour-tile{min-height:0;padding:7px 3px 6px}'])
    assert.ok(s.includes(r), r);
  assert.ok(/\.ob-apport-c b\{[^}]*color:var\(--v-sun-hi\);[^}]*font-variant-numeric:tabular-nums/.test(s), 'les nombres en jaune soleil, chiffres à chasse fixe');
  /* Les animations : dans le média « no-preference », hors mouvements réduits (vérifié pour tout le bloc par retours-1732) */
  const media = css.slice(css.indexOf('@media (prefers-reduced-motion:no-preference){'), css.indexOf('@media (prefers-reduced-motion:reduce){', css.indexOf('@media (prefers-reduced-motion:no-preference){')));
  for (const k of ['.ob-enter .ob-jour-dots i.on{animation:obvDotOn', '.ob-selection-update .ob-jour-tile.on b{animation:obvJoyIcon', '.ob-enter .ob-apport-ico{animation:obvPopSpin',
    '.ob-selection-update .ob-apport-c b{transform-origin:0 70%;animation:obvNumBump'])
    assert.ok(media.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine' + k), k);
  assert.ok(css.includes('@keyframes obvDotOn{') && css.includes('@keyframes obvNumBump{'));
  /* La feuille est rechargée, et le cache de l’app renouvelé */
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=16">') && sw.includes("'./onboarding-vitrine.css?v=16',"));
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  assert.ok(app.includes(`const SW_CACHE='${cache}';`) && /^requete-2026-11-0\d-[a-z-]+-v\d+$/.test(cache));
});
