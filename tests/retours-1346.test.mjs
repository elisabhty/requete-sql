/* Elisa, 1er novembre, 13 h 46 : défis filtrés d’abord selon le niveau de la personne (sans rien enlever) ; la photo détourée dans
   la bulle de la première leçon ; « Voir » animé ; la barre Schéma dans le premier cadre de la Console. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const lecon = fs.readFileSync(new URL('../assets/anim/bases-relationnelles.html', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('la salle de défi se place au niveau de la personne, les trois niveaux restent choisissables', () => {
  const ctx = vm.createContext({ rank: 1, niveauCompte: () => ({ rank: ctx.rank }), jeuChallenges: () => [1] });
  vm.runInContext(cut('function jeuNivAuto(){', '\n}') + '\n}', ctx);
  const auto = r => { ctx.rank = r; return vm.runInContext('jeuNivAuto()', ctx); };
  assert.deepEqual([1, 2, 3, 4, 5].map(auto), ['f', 'm', 'm', 'd', 'd']);
  assert.ok(app.includes('  if(!jeuNivUser)jeuNiv=jeuNivAuto();'), 'tant qu’on n’a pas choisi soi-même');
  assert.ok(app.includes("if(k==='niv'){jeuNiv=v;jeuNivUser=true;}"), 'un niveau touché est retenu');
  assert.ok(app.includes("${k===auto&&!vide?'<em class=\"room-lv-auto\">Ton niveau</em>':''}"));
  assert.ok(css.includes('html.lq .room-level .room-lv-auto{position:absolute;'));
});

test('la bulle de la première leçon porte le portrait détouré', () => {
  assert.ok(fs.existsSync(new URL('../assets/anim/formatrice.webp', import.meta.url)));
  assert.ok(lecon.includes('#cap .cap-stk{background:url(formatrice.webp) 50% 6px/150px auto no-repeat,'));
  assert.ok(sw.includes("'./assets/anim/formatrice.webp',"), 'hors ligne aussi');
});

test('Console : la barre Schéma dans la carte du projet, « Voir » qui s’anime', () => {
  assert.ok(app.includes("if(inWork&&sum.parentElement!==hero)hero.appendChild(sum);"));
  assert.ok(app.includes("if(consoleSchemaOpen&&consoleProjectPanel!=='editor'&&typeof setConsoleProjectPanel==='function')setConsoleProjectPanel('editor');"));
  assert.ok(css.includes('html.lq #scr-console .console-schema-summary:not(.open) .console-schema-action{animation:voirNudge 2.8s'));
  assert.ok(css.includes('html.lq #scr-console .console-title-row.is-project .console-schema-summary.in-hero{width:100%;'));
});

test('avant un cours, sa page de départ dans la DA du site, avec un seul bouton « Commencer »', () => {
  const open = cut('function openLesson(id, restoreStep){', '/* « Quel JOIN choisir ? »');
  assert.ok(open.includes("if(restoreStep==null&&!restoringNav&&typeof lessonStartShow==='function'){"), 'pas lors d’une reprise automatique');
  assert.ok(open.includes('lessonStartShow(l,()=>{if(current===l&&lessonStep===0&&lessonVideoOn(l))openLessonVideo();});'), 'la vidéo démarre au « Commencer »');
  assert.ok(open.includes("<button type=\"button\" class=\"lst-go\"><span>${done?'Revoir le cours':started?'Reprendre':'Commencer'}</span>${DEF_CHEV_SVG}</button>"));
  assert.ok(open.includes("<p class=\"lst-kicker\">${m?`Module ${mi+1} · ${esc(m.titre)}`:'Cours'}</p>"));
  assert.ok(open.includes('<ol class="lst-plan">'), 'ce que tu vas faire, dans l’ordre');
  assert.ok(css.includes('.lst-card{position:relative;isolation:isolate;overflow:visible;padding:26px 22px 30px;border-radius:30px;background:var(--deep);'));
  assert.ok(css.includes('.lst-go{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:62px;'));
});

test('onboarding : le parcours qui se construit, la promesse en grand chiffre, l’engagement signé ; tout tient sur un écran', () => {
  assert.ok(app.includes("const OB_SLIDES = ['welcome','name','goal','level','rhythm','build','promise','pact','practice','account','ready','pseudo'];"));
  const ob = cut('function obPlanInfo(){', 'function obRhythmSummary(){');
  assert.ok(ob.includes("const days=Math.max(1,Math.round((parseD(last)-auj())/864e5)+1);"), 'le nombre de jours vient du plan réellement généré');
  assert.ok(ob.includes("if(ink>40){"), 'une vraie signature, pas un point');
  assert.ok(ob.includes("for(const c of ['ob-fit-1','ob-fit-2','ob-fit-3']){"), 'se resserre par paliers tant que ça déborde');
  assert.ok(app.includes('<div class="ob-big" aria-hidden="true"><b id="ob-big-n" data-n="${b.days}">${b.days}</b><span>jours</span></div>'));
  assert.ok(app.includes('<p class="ob-pact-k">Mon contrat d’apprentissage</p>'));
  assert.ok(app.includes("obSetFooter('Je m’engage',()=>{draft.pacteAt=Date.now();obGoto('practice');},'Plus tard',()=>obGoto('practice'),'',!draft.pacte);"), '« Je m’engage » s’allume une fois signé');
  assert.ok(app.includes("...(draft.pacte?{pacte:{at:draft.pacteAt||Date.now(),sig:draft.pacte}}:{})"), 'la signature reste sur l’appareil, dans le profil');
  const v = fs.readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');
  for (const part of ['html #onboarding.ob-vitrine .ob-big b{font:800 clamp(120px,40vw,168px)/.9 var(--v-display);', 'html #onboarding.ob-vitrine .ob-pact-card{position:relative;',
    'html #onboarding.ob-vitrine .ob-build-path span.is-start{background:var(--v-sun);', 'html #onboarding.ob-vitrine.ob-fit-3 .ob-chat{display:none!important}'])
    assert.ok(v.includes(part), part);
});

test('14 h 33 : un seul cadre pour « Pas encore » et l’indice ; en salle, les indices à la même minute pour tous ; la base dans la barre', () => {
  assert.ok(app.includes("${coach?'<div id=\"hint-slot\"></div>':''}"), 'la carte avant le résultat');
  assert.ok(app.includes("if(isDefi&&COACH&&COACH.c===current){setLessonOut(table);COACH.diag=diag;COACH.fx='is-new-ko';}"), 'défi seul');
  assert.ok(app.includes('const due=JEU_IND_T.filter(t=>Date.now()-r.t1>=t).length;'), 'en salle : le temps de la manche, le même pour tous');
  assert.ok(app.includes("pour tout le monde dans <b id=\"coach-cd\">${jeuChrono(next)}</b>"));
  assert.ok(app.includes("<span class=\"l-kicker\">Manche ${n+1}/${J.nb} · ${JEU_NIVL[c.niv]}${defiBaseId(c)?` · Base ${esc(DEFI_BASES[defiBaseId(c)].nom)}`:''}</span>"));
  for (const part of ['html.lq .coach.is-new-ko .coach-st{animation:coachKo .45s ease}', 'html.lq .coach-dot.is-cur{transform:scale(1.3);', 'html.lq .coach-tag{flex:none;padding:4px 10px;border-radius:99px;background:var(--sun);'])
    assert.ok(css.includes(part), part);
});
