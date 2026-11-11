/* Retours de 1 h 16 et 1 h 29 (Elisa, 4 novembre), sur l’ouverture de l’appli iOS : « je suis sûr que tu peux améliorer l’écran
   de lancement (en mode data) : mettre des chiffres au lieu des confettis ? », puis, sur une gerbe de nombres lancés autour de la
   touche : « réfléchis mieux stp, on peut faire mieux ». L’écran était devenu une table : l’appui sur la touche >_ y envoyait une
   onde, chaque case chiffrée surgissait à son passage, la requête allumait ses résultats, puis on plongeait dans la touche.
   11 novembre, 13 h 10 : « je veux qu’on retravaille l’animation de lancement », puis « Le logo se construit » : les cases
   chiffrées restent (l’idée « data »), mais ce sont elles qui forment la touche, venues des points de l’écran de lancement
   (tests/retours-1310.test.mjs). La table, son onde et ses résultats sont partis. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const bloc = css.slice(css.indexOf('/* ---------- 37 bis.'), css.indexOf('/* ---------- 38.'));

test('ouverture : la table de données a laissé place au logo qui se construit, avec des cases toujours chiffrées', () => {
  for (const vieux of ['in-grid', 'in-ring', '.in-t{', 'introWave', 'introTile', 'introRoll', 'introPick', 'introWarp', 'introKey', 'introZoom'])
    assert.ok(!bloc.includes(vieux), `style parti : ${vieux}`);
  const intro = app.slice(app.indexOf('/* Appli iOS : l’ouverture animée'), app.indexOf('  </script>', app.indexOf('/* Appli iOS : l’ouverture animée')));
  assert.ok(!intro.includes('in-grid') && !intro.includes('in-ring') && !intro.includes('class="in-t"'), 'le script ne construit plus de table');
  assert.ok(intro.includes('<i class="in-k" aria-hidden="true"') && intro.includes("'\"><b>'+nb()+'</b></i>'"), 'les cases de la touche portent un nombre');
  assert.ok(bloc.includes('font:800 calc(40*var(--u))/1 var(--mono);color:#fff;font-variant-numeric:tabular-nums}'));
});
