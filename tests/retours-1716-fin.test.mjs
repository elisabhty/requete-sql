/* 13 novembre, 17 h 16 (Elisa, ses captures « 2e place, bien joué ! » puis « Le podium ») : « Fusionner les deux pages car ce sont
   la même chose dit différemment, du coup avec le bouton défier ou quelque chose comme ça. Faire une page défaite, 0-0, gagnant ; pas
   d’ex æquo possible à part 0/0 (aucun n’a trouvé) car ça se joue sur le temps ». Le parcours en salle (victoire, défaite, 0 à 0,
   « Revanche ») est vérifié par salle-defis.test.mjs ; ici, les branchements. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a > 0, n); return app.slice(a, app.indexOf('\n}\n', a) + 2); };

test('la dernière manche entre amis : sa carte 5 s (« Tes points arrivent »), puis l’écran de fin (plus « Le podium arrive »)', () => {
  const v = fn('jeuView');
  /* 17 h 31 : 5 s sur la carte de la manche, avec « Tes points arrivent dans 5 s », puis l’écran de fin */
  assert.ok(v.includes("if(fin&&n>=J.nb-1&&!jeuSoloLike(n)){const t=jeuFinAuto(n);return t&&Date.now()<t?'play'+n:'final';}"));
});

test('trois issues : la victoire, la défaite, le 0 à 0 ; tes points et leur détail ; « Revanche »', () => {
  for (const k of ["const nul=sc.length>0&&sc.every(x=>x.pts===0),winner=!nul&&moi.place===1&&moi.pts>0;",
    "if(winner){ton='is-or';titre='Tu as gagné\\u00a0!';chat='trophee';med=lqStkSvg('medal1');",
    "phrase=!second?'':second.pts>0?`Devant ${nom(second)}, de ${ecart(moi,second)}.`:`${nom(second)} n’a ${J.nb>1?'rien':'pas'} trouvé.`;}",
    "else if(nul){ton='is-nul';titre='0 à 0\\u00a0!';chat='reveil';phrase=`Personne n’a trouvé${J.nb>1?' de défi':' ce défi'}. Égalité parfaite\\u00a0: la revanche\\u00a0?`;}",
    "else{ton='is-ko';titre='Pas cette fois\\u00a0!';chat='effort';",
    "phrase=`${nom(premier)} l’emporte${moi.pts>0?` de ${ecart(premier,moi)}`:''}. À toi la revanche\\u00a0!`;}",
    "const kick=J.nb===1?'Manche unique terminée':`Partie terminée · ${jouees} manche${jouees>1?'s':''}`;",
    'pills=`<i>${ok} défi${ok>1?\'s\':\'\'} trouvé${ok>1?\'s\':\'\'} sur ${jouees}</i>`;',
    '<section class="jr2-hero jeu-issue ${ton}" aria-labelledby="jr2-t">',
    '<p class="jeu-card-h">Les joueurs</p>',
    '<button type="button" class="journey-primary jeu-revanche" onclick="jeuRejouer()"><span>Revanche</span>'])
    assert.ok(app.includes(k), k);
  assert.ok(!app.includes("head('Salle de défi · Fin de partie'"), 'plus de deuxième titre « Le podium »');
});

test('le 0 à 0 a son ton ; les styles avant la refonte des défis', () => {
  assert.ok(css.includes('html.lq #jeu-root .jr2-hero.is-nul h1{color:#fff}'));
  assert.ok(css.indexOf('html.lq #jeu-root .jr2-hero.is-nul h1') < css.indexOf('Défis — la refonte du 7 novembre'));
});
