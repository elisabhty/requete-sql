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

test('la tête du cadre : la manche, ce que vaut le défi et le chrono ; dessous, le niveau et la base', () => {
  const play = cut("}else if(v.startsWith('play')){", "}else if(v.startsWith('res')){");
  assert.ok(play.includes('const hud=`<div class="jeu-hud"><b class="jeu-hud-m">Manche ${n+1}<small>/${J.nb}</small></b><span class="jeu-hud-r">${val}</span>`'));
  /* 19 h 18 : le chrono sort du bandeau, posé sur son bord (chrono-bord.test.mjs) */
  assert.ok(play.includes('const chrono=`<b class="jeu-timer${dur0-took0<30000?\' is-low\':\'\'}" id="jeu-timer" role="timer" aria-label="Temps restant de la manche">${jeuRebours(dur0-took0,dur0)}</b>`;'));
  assert.ok(play.includes('`<span class="jeu-hud-niv"><span class="dx-f-niv is-${c.niv}">${jeuNivBars(c.niv)}${JEU_NIVL[c.niv]}</span>'), 'le niveau dans la pastille blanche des feuilles');
  assert.ok(!play.includes('class="jeu-bar"'), 'plus de barre au-dessus du titre');
  /* 18 h 28 : « la base, on ne la met pas dans le premier bloc mais en pill de La situation » */
  assert.ok(!play.includes('jeu-hud-base') && play.includes('${defiConsigneHTML(c,{base:true})}'), 'la base à côté de « La situation »');
  assert.ok(play.indexOf('<div id="jeu-netslot">') < play.indexOf('<h1>${esc(c.titre)}</h1>') && play.indexOf('<h1>${esc(c.titre)}</h1>') < play.indexOf('jeuDirectHTML(n,hud,chrono)'), 'le titre, puis le cadre');
  assert.ok(play.includes('${J.solo?`<section class="jeu-direct is-seul" aria-label="Manche ${n+1} sur ${J.nb}">${chrono}<div class="jeu-direct-bande">${hud}</div></section>`:jeuDirectHTML(n,hud,chrono)}'), 'seul : la tête seulement');
  const d = cut('function jeuDirectHTML(n,hud,chrono){', '\n}\n');
  assert.ok(d.includes('id="jeu-direct" aria-labelledby="jeu-direct-t">${chrono||\'\'}<div class="jeu-direct-bande">${hud||\'\'}`+'), 'en tête du bandeau, avant « En direct » ; le chrono juste avant le bandeau (19 h 18)');
  /* Le chrono et la valeur gardent leurs identifiants : chaque seconde les tient à jour */
  const tick = cut('function jeuTick(){', '\n}\n');
  assert.ok(tick.includes("el=document.getElementById('jeu-timer')") && tick.includes("document.getElementById('jeu-val-n')"));
});

test('la DA du cadre : en grand la manche, les pastilles du chrono et des points, un filet avant « En direct »', () => {
  for (const r of ['html.lq #jeu-root .jeu-hud{display:flex;flex-wrap:wrap;align-items:center;gap:10px 10px;padding:15px 12px 13px 16px}',
    'html.lq #jeu-root .jeu-direct:not(.is-seul) .jeu-hud{box-shadow:inset 0 -1px 0 rgba(255,255,255,.14)}',
    'html.lq #jeu-root .jeu-hud-m{flex:1 1 auto;min-width:0;color:#fff;font:800 21px/1.1 var(--display);',
    'html.lq #jeu-root .jeu-hud-niv{flex:1 1 100%;display:flex;align-items:center;gap:9px;min-width:0}',
    '  html.lq #jeu-root .jeu-hud .jeu-val small{display:none}'])
    assert.ok(css.includes(r), r);
  assert.ok(css.indexOf('html.lq #jeu-root .jeu-hud{') < css.indexOf('Défis — la refonte du 7 novembre'), 'avec le bandeau « En direct »');
});
