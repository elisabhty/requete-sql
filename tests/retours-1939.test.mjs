/* Elisa, 11 novembre, 19 h 34 : « T’as d’autres idées pour les petits KPI ? 71 leçons, 15 modules, car c’est assez répétitif la
   ligne » (la ligne « Parcours SQL · 71 leçons · 15 modules » est juste dessous). 19 h 39, son choix, « Ce qui t’attend » : avant la
   première leçon, les défis à relever, les heures de vidéo, les questions d’entretien, avec les vrais chiffres de l’app.
   Vérifié dans un navigateur (320 et 393 px) : « 477 défis à relever · 4 h de vidéo · 142 questions d’entretien », dès le premier
   affichage de l’accueil. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const lq = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const tuiles = extra => {
  const lecons = Array.from({ length: 3 }, (_, i) => ({ id: i + 1, video: { moments: 2 } }));
  const ctx = vm.createContext({ allLessons: lecons, MODULES: [{ lessons: lecons }], CARTES: {}, itemDone: () => false, itemCommence: () => false, exercicesFaits: () => 0, ...extra });
  vm.runInContext(cut('const HOME_STAT_SVG=', '/* Ce que l’étiquette de la séance dit à VoiceOver'), ctx);
  return [...ctx.homeStatsHTML().matchAll(/<li class="lq-stat is-(\w+)">[^]*?<b>([^<]+)<\/b><span>([^<]+)<\/span><\/li>/g)].map(m => `${m[1]} ${m[2].replace(/ /g, ' ')} ${m[3]}`);
};

test('avant la première leçon : défis, vidéo, entretien ; plus rien qui répète la ligne du parcours', () => {
  assert.deepEqual(tuiles({ CHALLENGES: { length: 477 }, ENTRETIEN: Array(142).fill(0), dureeVideoS: () => 4900 }),
    ['manette 477 défis à relever', 'video 4 h de vidéo', 'bulle 142 questions d’entretien']);
  assert.deepEqual(tuiles({ CHALLENGES: { length: 1 }, ENTRETIEN: [0], dureeVideoS: () => 600 }),
    ['manette 1 défi à relever', 'video 30 min de vidéo', 'bulle 1 question d’entretien'], 'moins d’une heure : en minutes ; le singulier');
  assert.deepEqual(tuiles({ CHALLENGES: { length: 477 }, dureeVideoS: () => 4900 }), ['manette 477 défis à relever', 'video 4 h de vidéo'],
    'sans la liste d’entretien (pas encore lue) : la tuile s’efface, les autres restent');
  assert.ok(!/leçons? à découvrir/.test(cut('function homeStatsHTML(', '\n}catch(e){return \'\';}}')), 'plus de « 71 leçons à découvrir »');
});

test('les icônes et leurs couleurs', () => {
  const svg = cut('const HOME_STAT_SVG=', 'function homeStatsHTML(');
  for (const k of ['manette:', 'video:', 'bulle:']) assert.ok(svg.includes(k), k);
  assert.ok(lq.includes('html.lq .lq-stat.is-manette .lq-stat-ic{background:#FFE6E2;color:#D2453B}'));
  assert.ok(lq.includes('html.lq .lq-stat.is-bulle .lq-stat-ic{background:#DCF6E9;color:#14935A}'));
});
