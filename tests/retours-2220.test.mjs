/* La navigation d’une question d’entretien (Elisa, 6 novembre, sur sa capture de « Question 5 sur 142 »).
   22 h 20 : « Met le suivant précédent plutôt à l’intérieur du cadre bleu de manière ui ux ».
   22 h 56, à « après « Je maîtrise » ou « À revoir », il faut remonter jusqu’à la carte ; j’ajoute aussi un « Question suivante » sous
   l’évaluation ? » : « Oui et en haut juste des flèches animées vers la gauche et droite ».
   En haut de la carte violette, deux flèches encadrent le numéro : la précédente à gauche, en verre comme la pastille, la suivante à
   droite, blanche à rebord ; chacune fait signe vers son côté, à son tour (mouvement réduit : immobiles). Sur les écrans étroits (iPhone
   SE et mini), le numéro seul (« 5 sur 142 ») ; le lecteur d’écran entend toujours « Question 5 sur 142 ». Plus aucune autre question
   dans l’onglet : pas de flèches. Sous l’évaluation, le grand bouton « Question suivante » (ou « Retour aux questions »).
   Vérifié aux largeurs 320, 360, 375, 390 et 430, questions 5 et 142 : les flèches et le numéro sur une ligne, loin de l’ampoule. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };
const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

/* Les deux morceaux, rendus pour de vrai selon ce que proposent entPrevTarget et entNextTarget. */
function rendu(prev, next) {
  const ctx = vm.createContext({ ENTRETIEN: { length: 142 }, entPrevTarget: () => prev, entNextTarget: () => next, entRun: false, entOrdre: a => a, entAllItems: () => [], entInFilter: () => true, entInTab: () => true, entOk: () => false });
  vm.runInContext(cut('const ENT_FL_G=', 'function renderEntretienFocus(x){'), ctx);
  /* const n’est pas une propriété du contexte : on lit les deux flèches dans le contexte même */
  const fl = vm.runInContext('({ G: ENT_FL_G, D: ENT_FL_D })', ctx);
  return { haut: ctx.entPagerHtml({ id: 'q5', i: 4 }), bas: ctx.entSuiteHtml('q5'), fl };
}

test('en haut de la carte : les flèches autour du numéro ; sous l’évaluation : « Question suivante »', () => {
  const f = cut('function renderEntretienFocus(x){', 'function renderEntretien(opts){');
  assert.ok(f.includes('<div class="ent-focus-meta">${entPagerHtml(x)}</div>\n    <p class="ent-focus-kick"><span class="ent-focus-cat">${esc(x.q.cat)}</span>'), 'dans la ligne du numéro');
  assert.ok(f.includes('${entFoot(x.id)}</div>${entSuiteHtml(x.id)}`:\'\'}'), 'juste sous l’évaluation, une fois la réponse révélée');
  const hero = f.slice(f.indexOf('<header class="ent-focus-hero">'), f.indexOf('</header>'));
  assert.ok(!hero.includes('entSuiteHtml') && hero.includes('<span>Réponds à voix haute, puis compare.</span></div>\n    </header>'.replace('\n    </header>', '')), 'plus de rangée de boutons sous la consigne');
  assert.ok(!/ent-step|ent-nav\b|class="ent-next|class="ent-prev/.test(app + css), 'ni la rangée du dessous ni celle de 22 h 20');
});

test('les flèches : la précédente à gauche, le numéro, la suivante à droite ; des noms pour le lecteur d’écran', () => {
  const { haut, fl } = rendu({ id: 'q4' }, { id: 'q6' });
  assert.equal(haut, `<nav class="ent-pager" aria-label="Changer de question"><button type="button" class="ent-pager-prev" onclick="prevEntretien('q5')" aria-label="Question précédente">${fl.G}</button><span class="ent-pager-n"><span class="ent-pager-q">Question </span><b>5</b> sur 142</span><button type="button" class="ent-pager-next" onclick="nextEntretien('q5')" aria-label="Question suivante">${fl.D}</button></nav>`);
  assert.ok(fl.G.includes('<path d="M19 12H5M11 6l-6 6 6 6"/>') && fl.D.includes('<path d="M5 12h14M13 6l6 6-6 6"/>'), 'de vraies flèches, vers la gauche et vers la droite');
  assert.ok(fl.G.includes('aria-hidden="true"') && fl.D.includes('aria-hidden="true"'));
});

test('plus aucune autre question dans l’onglet : pas de flèches, et « Retour aux questions » sous l’évaluation', () => {
  const { haut, bas } = rendu(null, null);
  assert.equal(haut, '<div class="ent-pager"><span class="ent-pager-n"><span class="ent-pager-q">Question </span><b>5</b> sur 142</span></div>');
  assert.ok(bas.startsWith(`<button type="button" class="ent-suite" onclick="nextEntretien('q5')"><span>Retour aux questions</span>`));
  assert.ok(rendu({ id: 'q4' }, { id: 'q6' }).bas.startsWith(`<button type="button" class="ent-suite" onclick="nextEntretien('q5')"><span>Question suivante</span>`));
});

test('le style : verre et blanc à rebord, 44 px sous le doigt, les flèches font signe à leur tour, immobiles en mouvement réduit', () => {
  assert.ok(code.includes('html.lq .ent-focus .ent-pager-prev{background:rgba(255,255,255,.14);color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.26),'), 'en verre, comme la pastille');
  assert.ok(code.includes('html.lq .ent-focus .ent-pager-next{background:#fff;color:var(--accent-ink);box-shadow:0 3px 0 #2E1A9E}'));
  assert.ok(code.includes('width:36px;height:36px;') && code.includes('html.lq .ent-focus .ent-pager>button::after{content:"";position:absolute;inset:-4px}'), '36 px à l’œil, 44 px sous le doigt');
  assert.ok(code.includes('html.lq .ent-focus .ent-pager>button:active{transform:translateY(3px)}'), 'elles s’enfoncent sous le doigt');
  assert.ok(code.includes('html.lq .ent-focus .ent-pager-next svg{animation:entFlD 3.2s ease-in-out 1s infinite}') && code.includes('html.lq .ent-focus .ent-pager-prev svg{animation:entFlG 3.2s ease-in-out 2.6s infinite}'), 'chacune à son tour');
  assert.ok(code.includes('@keyframes entFlD{0%,58%,100%{translate:0 0}68%{translate:4px 0}') && code.includes('@keyframes entFlG{0%,58%,100%{translate:0 0}68%{translate:-4px 0}'), 'vers la droite, vers la gauche');
  assert.ok(/@media \(prefers-reduced-motion:reduce\)\{[^}]*html\.lq \.ent-focus \.ent-pager svg\{animation:none!important\}/.test(code.replace(/\n/g, '')) || code.includes(',html.lq .ent-focus .ent-pager svg{animation:none!important}'), 'réglage de l’appareil');
  assert.ok(code.includes('html[data-motion="reduce"].lq .ent-focus .ent-pager svg{animation:none!important}'), 'réglage de l’appli');
  assert.ok(code.includes('html.lq .ent-focus .ent-pager-q{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}'), 'écrans étroits : « 5 sur 142 », lu « Question 5 sur 142 »');
  assert.ok(code.includes('html.lq .ent-focus-hero::after{content:"";position:absolute;right:30px;top:80px;'), 'l’étoile passe sous l’ampoule, à l’écart des flèches');
  assert.ok(code.includes('html.lq .ent-focus .ent-suite{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:54px;'), 'en bas, le grand bouton');
  assert.ok(code.includes('html.lq .ent-focus .ent-suite:active{transform:translateY(4px);box-shadow:0 0 0 var(--accent-lip)}'));
});
