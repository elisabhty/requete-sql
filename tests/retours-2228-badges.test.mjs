/* Elisa, 13 novembre, 22 h 28 (sa capture de l’onglet Défis) : « Mauvais formatage des badges ». « Niveau recommandé » couvrait le
   haut des barres de Difficile ; dans une salle ouverte, « 1/6 » était lavande sur le fond lavande et « Facile » blanc en relief,
   le drapeau de l’avatar touchait « Facile ». */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const defis = css.indexOf('Défis — la refonte du 7 novembre');

test('« Niveau recommandé » droit, à cheval sur le bord, et les barres dessous, à toutes les hauteurs d’écran', () => {
  const badge = 'html.lq #scr-defis .room-level .room-lv-auto{top:-10px;rotate:none;white-space:nowrap;';
  const pad = 'html.lq #scr-defis .room-levels:has(.room-lv-auto)>.room-level,html.lq #scr-defis .dx-rapide.is-v2 .room-levels:has(.room-lv-auto)>.room-level{padding-top:19px!important}';
  assert.ok(css.indexOf(badge) > defis && css.indexOf(pad) > defis);
  assert.ok(css.indexOf(pad) > css.indexOf('html.lq #scr-defis .dx-rapide.is-v2 .room-level{padding:9px 4px 8px!important}'), 'après les cartes resserrées (20.3, 20.12), sinon elles le défont');
  assert.ok(css.indexOf(badge) > css.indexOf('  rotate:-2deg;box-shadow:0 2px 0 rgba(27,22,64,.18)}'), 'après l’ancien, penché');
  assert.ok(app.includes(`'<em class="room-lv-auto">Niveau recommandé</em>'`));
});

test('salle ouverte : les joueurs et le niveau, la même pastille blanche bordée ; le drapeau à distance', () => {
  const p = 'html.lq #scr-defis .dx-list .dx-t .dx-pc:is(.is-gens,.is-niv){min-height:22px;padding:1px 8px 1px 7px;background:#fff;box-shadow:inset 0 0 0 1.5px var(--line)}';
  assert.ok(css.indexOf(p) > css.indexOf('html.lq :is(#scr-defis,.dx-feuille) .dx-pc.is-doux{'), 'après la pastille douce qu’elle remplace ici');
  assert.ok(css.indexOf(p) > css.indexOf('html.lq :is(#scr-defis,.dx-feuille) .dx-pc.is-blanc{'));
  assert.ok(css.includes('html.lq #scr-defis .dx-list>li>.jeu-av{margin-right:5px}'));
  assert.ok(app.includes('${dxPcGens(`${s.nb}/${s.max}`)}') && app.includes('<small class="dx-pcs">${dxPcNiv(s.niv)}'), 'la ligne d’une salle ouverte');
});
