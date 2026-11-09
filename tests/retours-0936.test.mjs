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
  /* Le plan, comme obPlanInfo le donnerait (4 novembre, 17 h 27 : la page dit en combien de jours les leçons sont finies) */
  ctx.obPlanInfo = () => { const f = [2, 3, 5, 7].includes(ctx.draft.freq) ? ctx.draft.freq : 7; return { days: { 2: 84, 3: 56, 5: 34, 7: 24 }[f], minutes: 20, lessons: 71, endLabel: { 2: '26 janvier', 3: '29 décembre', 5: '7 décembre', 7: '27 novembre' }[f] }; };
  vm.runInContext(obRythmeMinutes + aides.replace('const OB_JOURS=', 'var OB_JOURS=').replace('let obJoursAvant=', 'var obJoursAvant='), ctx);
  return { ctx, images };
};
const noeud = n => ({ dataset: { n: String(n) }, textContent: String(n), isConnected: true });

test('une étape de plus, juste après la durée des séances, et comptée dans « Étape X sur N »', () => {
  assert.ok(app.includes("const OB_SLIDES = ['welcome','name','pays','age','job','goal','level','rhythm','jours','build','temoignages','pact','practice','account','source','rappel','widget','widgetTuto','pseudo','ready'];"));
  assert.ok(app.includes("const OB_PROFILE_SLIDES=['name','pays','age','job','goal','level','rhythm','jours','build','temoignages','pact','practice'];"));
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
    Object.assign(c, { slide: 'jours', obFlowHeader: s => `<header data-s="${s}"></header>`, obMascotQuestion: t => `<div class="ob-chat">${t}</div>`, obMascotDit: t => `<div class="ob-chat">${t}</div>`, obMascotOui: () => '',
      esc: s => String(s), escAttr: s => String(s).replace(/"/g, '&quot;'), obSetFooter: (...a) => pied.push(a), obGoto: () => {}, obModifiable: () => '<p class="ob-modifiable"></p>' });
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
  /* 4 novembre, 17 h 27 (réf. 8 et 9 : « fusionner sur une page, car on s’en fout des activités sur un an ») : plus de bilan sur un an ;
     à sa place, ce que disait la page « 24 jours » : en combien de jours, à ce rythme, et la date de fin */
  assert.ok(!html.includes('Voilà ce que ça t’apporte en un an') && !html.includes('activités') && !html.includes('de pratique'));
  assert.ok(html.includes('<div class="ob-apport ob-proj"><p class="ob-apport-k">À ce rythme</p>'));
  assert.ok(html.includes('<span class="ob-proj-big" aria-hidden="true"><b><i class="ob-apport-n" data-n="24">24</i></b><small>jours</small></span>'));
  assert.ok(html.includes('<p class="ob-proj-t"><span class="ob-sr">En 24 jours. </span>Avec <em>20&nbsp;minutes</em> par jour, tu termines tes <em>71&nbsp;leçons</em> d’ici le <b>27 novembre</b>.</p>'));
  assert.ok(rendu(5).html.includes('data-n="34"') && rendu(5).html.includes('Avec <em>20&nbsp;minutes</em> par jour en semaine, tu termines'));
  assert.ok(rendu(3).html.includes('Avec <em>20&nbsp;minutes</em>, 3&nbsp;jours par semaine, tu termines tes <em>71&nbsp;leçons</em> d’ici le <b>29 décembre</b>.'));
  assert.ok(!html.includes('aria-live'), 'le nombre qui défile n’est pas lu à chaque image ; la phrase dit les jours');
});

test('à ce rythme : les jours du plan que donneraient les réponses du moment ; les points des séances', () => {
  const { ctx } = etape();
  const jours = f => { ctx.draft.freq = f; return vm.runInContext('obJoursApport()', ctx).jours; };
  assert.deepEqual([7, 5, 3, 2].map(jours), [24, 34, 56, 84]);
  ctx.obPlanInfo = () => { throw new Error('plan'); };
  assert.equal(vm.runInContext('obJoursApport()', ctx).jours, 0, 'sans plan, rien ne casse');
  /* Les points, du lundi au dimanche (PATTERN compte le dimanche en 0) */
  const points = k => [...vm.runInContext(`obJoursPoints(${k})`, ctx).matchAll(/<i class="(on)?" style="--j:(\d)">/g)].map(m => (m[1] ? 'x' : '.')).join('');
  assert.equal(points(2), 'x..x...');
  assert.equal(points(3), 'x.x.x..');
  assert.equal(points(5), 'xxxxx..');
  assert.equal(points(7), 'xxxxxxx');
});

test('le nombre défile : depuis zéro à l’arrivée, depuis l’ancien à chaque choix, jamais en mouvements réduits', () => {
  /* À l’arrivée : zéro, puis la valeur, après une petite attente (le temps que la carte arrive) */
  let ns = [noeud(24)];
  let { ctx, images } = etape({ noeuds: ns });
  vm.runInContext('obJoursCompter(true)', ctx);
  assert.deepEqual(ns.map(n => n.textContent), ['0']);
  const jouer = (t) => { const f = images.shift(); assert.ok(f, 'image suivante'); f(t); };
  jouer(1000); jouer(1300);
  assert.deepEqual(ns.map(n => n.textContent), ['0'], 'encore en attente');
  jouer(1380 + 475);
  const mi = +ns[0].textContent;
  assert.ok(mi > 0 && mi < 24, String(mi));
  jouer(1380 + 950);
  assert.deepEqual(ns.map(n => n.textContent), ['24']);
  assert.equal(images.length, 0, 'fini');
  /* À un choix (obPick garde l’ancienne valeur) : de 24 à 56 jours, en 650 ms */
  ns = [noeud(56)];
  ({ ctx, images } = etape({ noeuds: ns, freq: 3 }));
  vm.runInContext('obJoursAvant={jours:24};obJoursCompter(false)', ctx);
  assert.deepEqual(ns.map(n => n.textContent), ['24']);
  jouer(500); jouer(500 + 650);
  assert.deepEqual(ns.map(n => n.textContent), ['56']);
  assert.equal(vm.runInContext('obJoursAvant', ctx), null, 'oublié une fois servi');
  /* Repeindre l’étape sans y entrer ni choisir : rien ne bouge */
  ns = [noeud(56)];
  ({ ctx, images } = etape({ noeuds: ns }));
  vm.runInContext('obJoursCompter(false)', ctx);
  assert.equal(images.length, 0);
  /* Mouvements réduits : la valeur, tout de suite */
  ns = [noeud(24)];
  ({ ctx, images } = etape({ noeuds: ns, reduit: true }));
  vm.runInContext('obJoursCompter(true)', ctx);
  assert.equal(images.length, 0);
  assert.deepEqual(ns.map(n => n.textContent), ['24']);
  /* Branché dans paintOb, et dans obPick (l’ancienne valeur, avant le nouveau choix) */
  assert.ok(app.includes("  if(slide==='jours')obJoursCompter(obJustEntered);\n"));
  const pick = lastCut('function obPick(champ,val){', 'function obPseudoTape(');
  assert.ok(pick.includes("if(!['niveau','rythme','goal','ageRange','genre','job','source','freq'].includes(champ))return;"));
  assert.ok(pick.includes("if(champ==='freq'){obJoursAvant=obJoursApport();val=OB_JOURS.includes(+val)?+val:7;}"));
  assert.ok(pick.indexOf('obJoursAvant=obJoursApport()') < pick.indexOf('draft[champ]=val;'), 'compté avant le nouveau choix');
  assert.ok(pick.includes("if(champ==='niveau'||champ==='rythme'||champ==='goal'||champ==='freq')draft.buildDone=false;"), 'un autre nombre de jours reconstruit le parcours');
});

test('la phrase de la page des jours et l’engagement suivent les jours choisis ; plus de page « 24 jours »', () => {
  assert.ok(!app.includes("}else if(slide==='promise'){"), 'la page « 24 jours » a rejoint celle des jours (17 h 27)');
  const j = lastCut("}else if(slide==='jours'){", "}else if(slide==='build'){");
  assert.ok(j.includes("const f=OB_JOURS.includes(draft.freq)?draft.freq:7,b=obPlanInfo(),quand=f===7?' par jour':f===5?' par jour en semaine':`, ${f}&nbsp;jours par semaine`;"));
  const quand = f => vm.runInNewContext("f===7?' par jour':f===5?' par jour en semaine':`, ${f} jours par semaine`", { f });
  assert.deepEqual([7, 5, 3, 2].map(f => `Avec 20 minutes${quand(f)}, tu termines`), ['Avec 20 minutes par jour, tu termines', 'Avec 20 minutes par jour en semaine, tu termines',
    'Avec 20 minutes, 3 jours par semaine, tu termines', 'Avec 20 minutes, 2 jours par semaine, tu termines']);
  const pacte = lastCut("}else if(slide==='pact'){", 'obSetFooter(');
  /* 21 h 19 : la durée de l’engagement vient de pacteDuree, partagée avec Mon compte › Mon engagement (retours-2119) */
  assert.ok(pacte.includes('const b=obPlanInfo(),f=draft.freq||7;') && pacte.includes('${pacteCarteHTML({nom:(draft.name||\'\').trim(),m:b.minutes,f,'));
  assert.ok(app.includes("function pacteDuree(m,f){const t=`${m} minutes`;return f===7?`<b>${t} par jour</b>`:f===5?`<b>${t} par jour</b> en semaine`:`<b>${t}</b>, <b>${f} jours par semaine</b>,`;}"));
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
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=40">') && sw.includes("'./onboarding-vitrine.css?v=40',"));
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  assert.ok(app.includes(`const SW_CACHE='${cache}';`) && /^requete-2026-11-0\d-[a-z-]+-v\d+$/.test(cache));
});
