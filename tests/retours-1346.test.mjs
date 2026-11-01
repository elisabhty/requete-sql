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
