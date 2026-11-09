/* Elisa, 8 novembre, 10 h 24 (capture du bilan d’une partie seule, rien trouvé, le chat « Encore un effort ! » en haut à droite) :
   « Le chat est coupé ». Il était posé 12 px au-dessus du haut du contenu : la barre du haut (collante, opaque, par-dessus) lui
   mangeait les oreilles dès que la marge de la page était plus petite que ces 12 px, comme sur l’iPhone. Et la phrase sous le titre
   gardait la marge de la leçon (#scr-lesson .l-sub, en !important) : elle passait sous le chat au lieu de s’arrêter avant lui. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lq = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const regle = sel => { const i = lq.indexOf(sel + '{'); assert.ok(i >= 0, sel); return lq.slice(i + sel.length + 1, lq.indexOf('}', i)); };

test('le chat du bilan part du haut du contenu : jamais sous la barre du haut', () => {
  const r = regle('html.lq #jeu-root>.jeu-fin-chat');
  const top = /(?:^|;)top:(-?\d+(?:\.\d+)?)(px)?(?:;|$)/.exec(r);
  assert.ok(top, r);
  assert.ok(+top[1] >= 0, `top:${top[1]} — au-dessus du contenu, la barre du haut le coupe`);
  assert.ok(r.includes('position:absolute') && r.includes('right:-10px') && r.includes('width:116px'), 'même place à droite du titre, même taille');
  assert.ok(lq.includes('.jeu{position:relative}'), 'posé dans la page du défi');
});

test('la phrase sous le titre s’arrête avant le chat (la marge de la leçon est en !important)', () => {
  assert.ok(app.includes('#scr-lesson .l-sub{margin:-6px 2px 18px!important;'), 'la marge de la leçon, qui gagnait');
  assert.ok(lq.includes('html.lq #jeu-root:has(>.jeu-fin-chat)>:is(h1,.l-sub){margin-right:100px!important}'));
  assert.ok(lq.includes('html.lq #jeu-root:has(>.jeu-fin-chat)>:is(h1,.l-sub){margin-right:82px!important}'), 'petit écran');
});

test('« retente-le » ne se coupe pas au trait d’union à côté du chat ; 9 novembre, 10 h 01 : la phrase s’en va (« l’essentiel »), « Retenter ce défi » le dit', () => {
  assert.ok(!app.includes('retente-le${nT>1') && app.includes("const titre=all?(trophee?'Tout résolu\\u00a0!':'Tout résolu ! 🏆'):nOk?'Ton bilan':'Aucun défi résolu';"));
  assert.ok(lq.includes('html.lq #jeu-root .jeu-nw{white-space:nowrap}'));
  const debut = lq.indexOf('Défis — la refonte du 7 novembre');
  assert.ok(debut > 0 && lq.indexOf('html.lq #jeu-root .jeu-nw{') < debut, 'avec les règles du jeu, avant le bloc des Défis');
});

test('seul dans sa salle : « Abandonnée » partout, la carte du haut comme la ligne de la manche', () => {
  assert.ok(app.includes("lastMiss=nT===1&&lastR&&lastR.ms==null?jeuMissHTML(lastR.r,J.solo||host):'';"));
  assert.ok(app.includes("const why=x.r.closed&&!jeuFermeeAuChrono(x.r,J.rounds.indexOf(x.r))?(J.solo||host?'Abandonnée':'Close par l’hôte'):'Temps écoulé';"), '8 novembre, 17 h 31 : fermée à son heure par le serveur, c’est le chrono');
  assert.ok(!app.includes("const why=x.r.closed?(J.solo?'Abandonnée'"), 'plus « Close par l’hôte » pour l’hôte seul');
});
