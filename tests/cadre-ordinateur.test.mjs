/* Sur ordinateur et tablette, l’app est un cadre arrondi au milieu de la fenêtre (dès 600 px, 680 px de large dès 700 px).
   Retours d’Elisa du 30 octobre, 16 h 47 :
   - « il faut que la vidéo soit centrée, pas prendre toute la largeur » : le lecteur des cours en vidéo se pose dans ce cadre ;
   - « j’ai l’impression que le clavier est flou et qu’on ne peut pas écrire des lettres » : la barre de touches SQL n’est plus en verre
     dépoli, elle dit « Insérer » (elle ajoute des mots SQL, les lettres s’écrivent au clavier), sans bouton « Masquer le clavier » sur
     ordinateur, et elle se pose en bas du cadre. Sur téléphone, rien ne change de place. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const lq = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
const journey = fs.readFileSync(path.join(root, 'home-journey.css'), 'utf8');

test('le cadre de l’app sur ordinateur : 600 px pour s’afficher, 680 px de large dès 700 px (référence du lecteur et de la barre)', () => {
  assert.ok(html.includes('@media (min-width:600px){\n    body{padding:14px;overflow:hidden}\n    #app{\n      width:100%;max-width:min(1120px,100%);'), 'cadre dès 600 px, marge de 14 px');
  assert.ok(journey.includes('@media(min-width:700px) {\n  #app { max-width:680px; }'), '680 px dès 700 px');
});

test('vidéo d’un cours : au milieu du cadre, pas sur toute la largeur de la fenêtre', () => {
  const css = html.slice(html.indexOf('<style id="lesson-video-css">'), html.indexOf('<style id="sgbd-css">'));
  assert.ok(css.includes('.lv{position:fixed;inset:0;z-index:2000;'), 'téléphone : plein écran, comme avant');
  assert.ok(css.includes('@media (min-width:600px){\n  .lv{top:14px;bottom:14px;left:0;right:0;width:min(1120px,calc(100% - 28px));margin:0 auto;border-radius:34px;overflow:hidden;'), 'dans le cadre, centré, coins du cadre');
  assert.ok(css.includes('@media (min-width:700px){.lv{width:680px}}'), 'même largeur que le cadre');
  assert.ok(css.includes('  .lv.is-fin-end .lv-end{position:absolute}'), 'l’écran de fin du parcours reste dans le lecteur');
});

test('barre de touches SQL : nette, elle dit « Insérer », dans le cadre sur ordinateur', () => {
  const sec = lq.slice(lq.indexOf('/* ---------- 33. Barre de touches SQL'));
  assert.ok(sec.includes('html.lq .kbar{background:#FBFAFF;border-top:1.5px solid var(--line);-webkit-backdrop-filter:none;backdrop-filter:none;'), 'fond plein, sans flou');
  assert.ok(sec.includes('html.lq .kbar button{height:40px;padding:0 13px;border:1.5px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);font:700 14px/1 var(--mono);box-shadow:0 2px 0 var(--lip)}'), 'touches à rebord, texte plus grand');
  assert.ok(html.includes('<span class="kbar-lab" aria-hidden="true">Insérer</span>\n    <div class="kbar-in" id="kbar-in"></div>'), 'le libellé avant les touches');
  assert.ok(sec.includes('@media (hover:hover) and (pointer:fine){\n  html.lq .kbar .kbar-dock{display:none}\n  html.lq .kbar-lab{display:flex}\n}'), 'souris ou pavé tactile : « Insérer », sans « Masquer le clavier »');
  assert.ok(sec.includes('@media (min-width:600px){\n  html.lq .kbar{left:0;right:0;bottom:14px;width:min(1120px,calc(100% - 28px));margin:0 auto;border-radius:0 0 34px 34px}'), 'en bas du cadre');
  assert.ok(sec.includes('@media (min-width:700px){html.lq .kbar{width:680px}}'));
  assert.ok(html.includes("  kbar.style.bottom=kbLift?kb+'px':'';"), 'sans clavier à l’écran, le bas vient de la feuille de style');
});
