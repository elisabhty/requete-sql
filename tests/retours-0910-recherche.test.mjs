/* Elisa, 10 novembre, 9 h 10 (deux captures : l’accueil, « jjzej » sans résultat ; la salle de défi ouverte) :
   1. « essaie un mot clé plus court » : la phrase sous « Aucun cours ne correspond ».
   2. « Mettre une croix à côté de la recherche pour enlever -> micro interaction, fais la même chose ailleurs si besoin » : la croix des
      feuilles (LQ_X_SVG) dans une pastille .lq-clear, à l’accueil, dans l’Entretien, Mes notes et la Console ; elle arrive en tournant,
      s’enfonce en tournant au toucher ; rien en mouvement réduit.
   3. « Copier le code avant partager » : dans la salle d’attente, « Copier le code » vient avant « Partager l’invitation ». */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');

test('la recherche vide : « Essaie un mot-clé plus court. »', () => {
  assert.ok(app.includes("const emptyDetail=searching?'Essaie un mot-clé plus court.'"));
  assert.ok(!app.includes('Vérifie l’orthographe'));
});

test('une croix pour effacer, la même partout, avec sa micro-interaction', () => {
  assert.ok(app.includes('<button id="clear-course-search" class="lq-clear" type="button" onclick="clearCourseSearch()" aria-label="Effacer la recherche de cours" hidden>${LQ_X_SVG}</button>'), 'l’accueil : plus le mot « Effacer »');
  assert.ok(app.includes('class="ent-search-clear lq-clear" id="ent-search-clear"'), 'l’Entretien');
  assert.ok(app.includes('<button class="sx lq-clear" type="button" aria-label="Effacer la recherche"') && app.includes('${LQ_X_SVG}</button>'), 'Mes notes');
  assert.ok(app.includes('class="console-query-clear lq-clear" id="console-query-clear"') && !app.includes('onclick="clearConsoleQuerySearch()" hidden>✕</button>'), 'la Console');
  assert.ok(!app.includes('aria-label="Effacer la recherche de cours" hidden>Effacer</button>'));
  const sec = css.slice(css.indexOf('/* ---------- 65. La croix des recherches'));
  for (const r of ['animation:lqClearIn .36s cubic-bezier(.3,1.6,.5,1) both', 'html.lq .lq-clear:active{scale:.82;rotate:90deg;',
    '@keyframes lqClearIn{from{scale:.2;rotate:-120deg;opacity:0}to{scale:1;rotate:0deg;opacity:1}}',
    'html.lq .lq-clear[hidden],html.lq #scr-notes .searchbar:not(.has) .lq-clear,html.lq .searchbar:not(.has) .lq-clear{display:none}',
    '@media (prefers-reduced-motion:reduce){html.lq .lq-clear{animation:none;transition:none}', 'html[data-motion="reduce"].lq .lq-clear{animation:none;transition:none}',
    'width:44px;height:44px;min-width:44px;min-height:44px;'])
    assert.ok(sec.includes(r), r);
});

test('la salle d’attente : « Copier le code » puis « Partager l’invitation »', () => {
  const i = app.indexOf('<span>Copier le code</span></button><button type="button" class="jeu-btn is-wide jeu-share${jeuPartageCalme()?\' is-calme\':\'\'}"');
  assert.ok(i > 0);
  assert.ok(app.includes('html.lq #jeu-root .jeu-copy+.jeu-share{margin-top:10px}') || app.includes(',html.lq #jeu-root .jeu-copy+.jeu-share{margin-top:10px}'));
});
