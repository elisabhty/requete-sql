/* Elisa, 8 novembre, 17 h 48 : « mettre tout ce qu’il y a en haut aussi dans le cadre (manche, points, temps) de manière UI UX ».
   La barre du haut (la manche, ce que vaut le défi, le chrono) entre dans le bandeau violet, sous le titre : sa tête. Seul, le même
   bandeau, sans « En direct ». */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('la tête du cadre : à gauche la manche et le niveau ; à droite un seul cadre, ce que vaut le défi | le chrono (20 h 15)', () => {
  const play = cut("}else if(v.startsWith('play')){", "}else if(v.startsWith('res')){");
  /* 20 h 15 : « peut-être intégrer à l’intérieur un cadre avec point | chrono » ; le chrono revient dans le bandeau */
  assert.ok(play.includes('const chrono=`<b class="jeu-timer${dur0-took0<30000?\' is-low\':\'\'}" id="jeu-timer" role="timer" aria-label="Temps restant de la manche">${jeuRebours(dur0-took0,dur0)}</b>`;'));
  assert.ok(play.includes('const hud=`<div class="jeu-hud"><span class="jeu-hud-g"><b class="jeu-hud-m">Manche ${n+1}<small>/${J.nb}</small></b>`+'));
  assert.ok(play.includes('`<span class="dx-f-niv is-${c.niv}">${jeuNivBars(c.niv)}${JEU_NIVL[c.niv]}</span></span>`+'), 'le niveau, sous la manche, dans la pastille blanche des feuilles');
  assert.ok(play.includes('`<span class="jeu-hud-box${val?\'\':\' is-seul\'}">${val}${chrono}</span></div>`;'), 'un seul cadre : ce que vaut le défi | le chrono');
  assert.ok(!play.includes('class="jeu-bar"'), 'plus de barre au-dessus du titre');
  /* 18 h 28 : « la base, on ne la met pas dans le premier bloc mais en pill de La situation » */
  assert.ok(!play.includes('jeu-hud-base') && play.includes('${defiConsigneHTML(c,{base:true})}'), 'la base à côté de « La situation »');
  assert.ok(play.indexOf('<div id="jeu-netslot">') < play.indexOf('<h1>${esc(c.titre)}</h1>') && play.indexOf('<h1>${esc(c.titre)}</h1>') < play.indexOf('jeuDirectHTML(n,hud)'), 'le titre, puis le cadre');
  assert.ok(play.includes('${J.solo?`<section class="jeu-direct is-seul" aria-label="Manche ${n+1} sur ${J.nb}"><div class="jeu-direct-bande">${hud}</div></section>`:jeuDirectHTML(n,hud)}'), 'seul : la tête seulement');
  const d = cut('function jeuDirectHTML(n,hud){', '\n}\n');
  assert.ok(d.includes('id="jeu-direct" aria-labelledby="jeu-direct-t"><div class="jeu-direct-bande">${hud||\'\'}`+'), 'en tête du bandeau, avant « En direct »');
  /* Le chrono et la valeur gardent leurs identifiants : chaque seconde les tient à jour */
  const tick = cut('function jeuTick(){', '\n}\n');
  assert.ok(tick.includes("el=document.getElementById('jeu-timer')") && tick.includes("document.getElementById('jeu-val-n')"));
  assert.equal((app.match(/id="jeu-timer"/g) || []).length, 1);
});

test('la DA du cadre : en grand la manche ; le cadre blanc à rebord, le chrono dans sa pastille soleil au bout ; un filet avant « En direct »', () => {
  for (const r of ['html.lq #jeu-root .jeu-hud{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px 12px 14px 16px}',
    'html.lq #jeu-root .jeu-direct:not(.is-seul) .jeu-hud{box-shadow:inset 0 -1px 0 rgba(255,255,255,.14)}',
    'html.lq #jeu-root .jeu-hud-g{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:7px}',
    'html.lq #jeu-root .jeu-hud-m{min-width:0;color:#fff;font:800 21px/1.1 var(--display);',
    'html.lq #jeu-root .jeu-hud-box{position:relative;flex:none;display:flex;align-items:center;gap:2px;height:44px;margin-left:auto;padding:4px;box-sizing:border-box;',
    'border-radius:999px;background:#fff;box-shadow:0 3px 0 rgba(22,12,74,.45)}',
    'html.lq #jeu-root .jeu-hud-box .jeu-val{position:static;height:36px;padding:0 9px 0 2px;border:0;border-radius:999px;background:none;box-shadow:none}',
    'html.lq #jeu-root .jeu-hud-box .jeu-val-b{top:-9px;right:auto;left:-5px}',
    'html.lq #jeu-root .jeu-hud-box .jeu-timer{height:36px;box-sizing:border-box;padding:0 12px 0 10px!important;font-size:17px!important;box-shadow:none}',
    'html.lq #jeu-root .jeu-hud-box .jeu-timer.is-low{animation:jdChronoBat 1s ease-out infinite}',
    '  html.lq #jeu-root .jeu-hud .jeu-val small{display:none}', '  html.lq #jeu-root .jeu-hud-box .jeu-timer{padding:0 10px 0 8px!important;font-size:16px!important}}'])
    assert.ok(css.includes(r), r);
  assert.ok(css.indexOf('html.lq #jeu-root .jeu-hud{') < css.indexOf('Défis — la refonte du 7 novembre'), 'avec le bandeau « En direct »');
  /* Plus de chrono posé sur le bord (19 h 18), ni de ligne du niveau et des points (19 h 57) */
  assert.ok(!css.includes('.jeu-direct>.jeu-timer') && !css.includes(':has(>.jeu-timer)') && !css.includes('jeu-hud-niv'));
});
