/* Elisa, 13 novembre, 22 h 53 (« décale-le ») : dans la partie à 6, le bouton « Réagir », en bas à droite, couvrait le bout d’une ligne
   du classement (les points, le temps). Il s’efface pendant qu’on fait défiler et revient à l’arrêt ; sur les résultats, le podium et
   plus bas dans la manche, son sourire seul, rond, contre le bord de l’écran (vérifié à 375, 390, 393 et 430 px : rien du texte
   dessous). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a > 0, n); return app.slice(a, app.indexOf('\n}\n', a) + 2); };

test('le sourire seul sur les résultats et le podium, ou plus bas que le haut de la manche ; contre le bord de l’écran', () => {
  const classes = new Set(), el = { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) }, style: {} };
  const ctx = vm.createContext({ JEU: { view: 'play0' }, jeuReagirDroite: () => 20, document: { getElementById: id => (id === 'scr-lesson' ? ctx.sl : null) }, sl: { scrollTop: 0 } });
  vm.runInContext('const JEU_REAGIR_PETIT_Y=40;' + fn('jeuReagirPlacer'), ctx);
  ctx.jeuReagirPlacer(el);
  assert.equal(classes.has('is-petit'), false, 'en haut de la manche : la pastille « Réagir »'); assert.equal(el.style.right, '20px');
  ctx.sl.scrollTop = 120; ctx.jeuReagirPlacer(el);
  assert.equal(classes.has('is-petit'), true, 'plus bas : le sourire seul'); assert.equal(el.style.right, '6px', 'contre le bord de l’écran');
  for (const v of ['res0', 'final']) { ctx.sl.scrollTop = 0; ctx.JEU.view = v; ctx.jeuReagirPlacer(el); assert.equal(classes.has('is-petit'), true, v); }
});

test('il s’efface pendant qu’on fait défiler la salle, revient 0,7 s après l’arrêt ; la rangée ouverte reste là', () => {
  const d = fn('jeuReagirDefile');
  assert.ok(d.includes("if(!s||s.id!=='scr-lesson')return;") && d.includes("if(f.classList.contains('is-ouvert'))return;") && d.includes('},700);'));
  assert.ok(app.includes("document.addEventListener('scroll',jeuReagirDefile,{capture:true,passive:true});"));
  assert.ok(fn('jeuReagirMaj').includes('jeuReagirPlacer(f);'));
  assert.ok(css.includes('html.lq .jeu-reagir.is-defile:not(.is-ouvert):not(.is-ecrit){opacity:0;visibility:hidden;translate:22px 0;pointer-events:none;'));
  assert.ok(css.includes('html.lq .jeu-reagir.is-petit:not(.is-ouvert) .jeu-reagir-b{width:40px;height:40px;padding:0}') && css.includes('html.lq .jeu-reagir.is-petit:not(.is-ouvert) .jeu-reagir-b>span{display:none}'));
  assert.ok(css.indexOf('.jeu-reagir.is-defile') > css.indexOf('html.lq .jeu-reagir.is-haut:not(.is-ecrit){translate:0 -58px}'), 'après « au-dessus de la pastille », qu’il remplace en défilant');
});
