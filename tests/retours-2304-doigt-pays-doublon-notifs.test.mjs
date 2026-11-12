/* Elisa, 12 novembre, 23 h 04, sur ses captures de l’app iPhone :
   - « mettre un doigt qui 👉 animé au niveau de “Elle t’attend dans tes cartes mémo” au lieu du rond flèche » ;
   - « il y a un flash au niveau du choix du pays avec le clavier » ;
   - « il y a un doublon de mon compte connecté, garder celui du haut » ;
   - « on voit pas toute la notification → voir ce que ça donne ailleurs pour les notifications s’il y en a d’autres à corriger ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = lire('index.html');
const css = lire('ludique.css');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i + a.length); assert.ok(j > i, b); return html.slice(i, j); };

test('carte retournée : un doigt animé montre « Elle t’attend dans tes cartes mémo », le rond à flèches reste côté recto', () => {
  const h = cut('function bravoUnlockHtml(l){', '\n}\n');
  assert.ok(h.includes('<p class="mc-hint" aria-hidden="true"><span class="mc-hint-ico when-recto">${MEMO_TURN_SVG}</span><span class="mc-hint-doigt when-verso">👉</span><span class="when-recto">Touche ${nb>1?\'une\':\'la\'} carte pour la retourner</span><span class="when-verso">Elle t’attend dans tes cartes mémo</span></p>'));
  /* Le recto et le verso se cachent l’un l’autre, comme avant */
  assert.ok(css.includes('html.lq .mc-hint .when-verso,html.lq .is-flipped .mc-hint .when-recto{display:none}'));
  assert.ok(css.includes('html.lq .is-flipped .mc-hint .mc-hint-doigt{display:inline-block;flex:none;font:normal 400 calc(19px * var(--mc-fs))/1 system-ui,-apple-system,sans-serif;animation:mcDoigt 1.7s ease-in-out .5s infinite}'));
  const k = css.slice(css.indexOf('@keyframes mcDoigt{'), css.indexOf('}}', css.indexOf('@keyframes mcDoigt{')) + 2);
  assert.match(k, /^@keyframes mcDoigt\{0%,52%,100%\{translate:0 0\}14%\{translate:6px 0\}26%\{translate:1px 0\}38%\{translate:5px 0\}\}$/, 'deux petits coups vers la phrase, puis une pause');
  /* Mouvement réduit : le doigt est là, immobile */
  assert.ok(css.includes('@media (prefers-reduced-motion:reduce){html.lq .is-flipped .mc-hint .mc-hint-doigt{animation:none}}'));
  assert.ok(css.includes('html[data-motion="reduce"].lq .is-flipped .mc-hint .mc-hint-doigt{animation:none}'));
});

test('le choix du pays, clavier ouvert : la feuille ne bouge plus, son fond couvre tout, la page derrière garde sa hauteur', () => {
  /* Les trois repères, posés à chaque nouvelle du clavier */
  assert.ok(html.includes("const vh=Math.max(kbNatBase,window.innerHeight);\n    document.documentElement.style.setProperty('--vue-h',vh+'px');document.documentElement.style.setProperty('--kb-vue',Math.max(0,vh-window.innerHeight)+'px');document.documentElement.style.setProperty('--kb-tot',kbNatH+'px');"));
  /* La feuille : sa hauteur vient de la vue sans clavier, son bas descend sous la vue quand elle rétrécit, la liste gagne la hauteur du clavier */
  assert.ok(!css.includes('html.is-native .pays-feuille{bottom:'), 'la feuille (et son fond) ne monte plus au-dessus du clavier');
  assert.ok(css.includes('html.is-native .pays-feuille .pays-boite{height:min(calc(var(--vue-h,100vh) * .82),760px);max-height:calc(var(--vue-h,100dvh) - var(--safe-top) - 10px);margin-bottom:calc(-1 * var(--kb-vue,0px))}'));
  assert.ok(css.includes('html.is-native .pays-feuille .pays-liste{padding-bottom:calc(6px + var(--kb-tot,0px))}'));
  /* La page derrière : Mon compte ou l’onboarding gardent leur hauteur tant que la feuille est là */
  assert.ok(css.includes('html.is-native.pays-ouvert body{min-height:var(--vue-h,100dvh)}'));
  assert.ok(css.includes('html.is-native.pays-ouvert #app{height:var(--vue-h,100dvh);min-height:var(--vue-h,100dvh)}'));
  assert.ok(css.indexOf('html.is-native.pays-ouvert #app{') > css.indexOf('html.is-native.kb-ouvert #app{'), 'après la règle du clavier, à poids égal : elle l’emporte');
  assert.ok(css.includes('html.is-native.kb-ouvert.pays-ouvert #app>.tabbar{visibility:visible}'));
  assert.ok(css.includes('html.is-native.pays-ouvert #onboarding.ob-vitrine{--ob-sous-barre:clamp(12px,calc(var(--vue-h,100vh) * .035 - 7.6px),22px)}'));
  /* Sur le site (Safari), rien ne change */
  assert.ok(css.includes('.pays-feuille .pays-boite{position:relative;display:flex;flex-direction:column;width:min(560px,100%);height:min(82vh,760px);'));
  /* À l’ouverture la classe ; à la fermeture le champ rend le clavier, et la page est rendue quand il est parti */
  const f = cut('function paysFeuille(actuel,choisir){', 'function paysFiltrer(f,texte){');
  assert.ok(f.includes("document.body.appendChild(f);") && f.includes("document.documentElement.classList.add('pays-ouvert');"));
  assert.ok(f.includes("const partir=()=>{clearTimeout(attente);try{input.blur();}catch(e){}if(f.id==='pays-feuille')paysFeuilleFermer();"));
  const fermer = cut('function paysFeuilleFermer(vite){', '\n}\n');
  assert.ok(fermer.includes('paysVueRendre();setTimeout(()=>paysVueRendre(true),1200);'));
  assert.ok(html.includes("document.documentElement.classList.toggle('kb-ouvert',kb>60||kbNatH>0);\n    if(typeof paysVueRendre==='function')paysVueRendre();};"));
});

test('la page derrière n’est rendue au clavier qu’une fois la feuille partie ET la vue revenue', () => {
  const src = cut('function paysVueRendre(force){', '\n}\n') + '\n}';
  const essai = ({feuille = false, kb = 0, vue = 852, base = 852, force = false}) => {
    const classes = new Set(['pays-ouvert']);
    const ctx = vm.createContext({kbNatH: kb, kbNatBase: base, window: {innerHeight: vue},
      document: {documentElement: {classList: {contains: c => classes.has(c), remove: c => classes.delete(c)}}, getElementById: () => (feuille ? {} : null)}});
    vm.runInContext(src + `;paysVueRendre(${force})`, ctx);
    return !classes.has('pays-ouvert');
  };
  assert.equal(essai({feuille: true}), false, 'la feuille est encore là');
  assert.equal(essai({kb: 285, vue: 567}), false, 'le clavier est encore là');
  assert.equal(essai({kb: 0, vue: 567}), false, 'le clavier est parti, la vue pas encore revenue (10 ms)');
  assert.equal(essai({kb: 0, vue: 852}), true, 'tout est revenu : rendue');
  assert.equal(essai({}), true, 'fermée sans clavier : rendue tout de suite');
  assert.equal(essai({kb: 285, vue: 567, force: true}), true, 'au bout de 1,2 s, quoi qu’il arrive');
  assert.equal(essai({feuille: true, force: true}), false, 'jamais tant qu’une feuille est ouverte (rouverte entre-temps)');
});

test('onboarding : la recherche de la liste des pays garde le focus (le clavier ne se referme plus à peine ouvert)', () => {
  const src = lire('onboarding-focus.js');
  assert.ok(src.includes(`const ailleurs = document.activeElement?.closest?.('[role="dialog"],[role="alertdialog"]');`));
  let focus = 0, sync = null;
  const dedans = {closest: () => dialog}, feuille = {};
  const dialog = {tabIndex: 0, parentElement: null, classList: {contains: c => c === 'on'}, contains: e => e === dedans || e === dialog,
    focus: () => { focus++; doc.activeElement = dialog; }, addEventListener: () => {}, querySelectorAll: () => []};
  const doc = {getElementById: id => (id === 'onboarding' ? dialog : null), activeElement: null, body: {}};
  class MO { constructor(f) { sync = f; } observe() {} }
  vm.runInContext(src, vm.createContext({document: doc, MutationObserver: MO, HTMLElement: class {}, getComputedStyle: () => ({})}));
  assert.equal(focus, 1, 'à l’ouverture, le focus va à la fenêtre de l’accueil');
  /* Le champ de recherche de la liste des pays (une fenêtre posée par-dessus, hors de l’accueil) */
  doc.activeElement = {closest: s => (/dialog/.test(s) ? feuille : null)};
  sync();
  assert.equal(focus, 1, 'une page qui se redessine derrière ne lui reprend plus le focus');
  /* Le focus perdu dans la page (une étape remplacée) revient à l’accueil, comme avant */
  doc.activeElement = {closest: () => null};
  sync();
  assert.equal(focus, 2);
  doc.activeElement = doc.body;
  sync();
  assert.equal(focus, 3, 'un élément sans fenêtre autour (le corps de la page) : repris');
  doc.activeElement = dedans;
  sync();
  assert.equal(focus, 3, 'un champ de l’accueil lui-même : laissé');
});

test('Mon compte : « Compte connecté » n’est plus dit deux fois, la carte du haut reste', () => {
  const r = cut('function renderCompte(', 'function homeVersDefis(btn){');
  assert.ok(r.includes("?{title:'Compte connecté',copy:esc(state.accountLabel||'Ta progression est liée à ton compte.'),btn:'Gérer mes données',action:\"openPlusDetails('plus-data')\"}"), 'la carte du haut');
  assert.ok(!r.includes('<b>Compte connecté</b>'), 'plus de ligne du même nom dans « Compte et assistance »');
  assert.ok(!r.includes('Progression synchronisable'));
  /* Le reste de « Compte et assistance » est là, dans l’ordre */
  const ordre = ['<b>Questions fréquentes</b>', '<b>Contacte-nous</b>', '<b>Tes données, tes choix</b>', '<b>Confidentialité des parties</b>', '<b>Gérer mon abonnement</b>', '<b>Se déconnecter</b>', '<b>Supprimer mon compte</b>'].map(x => r.indexOf(x));
  assert.ok(ordre.every(i => i > 0) && ordre.join() === [...ordre].sort((a, b) => a - b).join(), ordre.join());
});

test('une notification se lit en entier : elle passe à la ligne, et reste plus longtemps quand elle est longue', () => {
  /* Avant : une seule ligne, coupée par « … » */
  assert.ok(html.includes('.toast b{font-size:14px;line-height:1.25;display:block;font-weight:720;letter-spacing:-.25px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'));
  assert.ok(css.includes('html.lq .toast b,html.lq .toast small{white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:break-word}'));
  assert.ok(!/\.toast[^{}]*\{[^}]*line-clamp/.test(css), 'pas de nombre de lignes imposé');
  const src = cut('function toastDuree(msg,sub){', '\n');
  const duree = vm.runInContext(src + ';toastDuree', vm.createContext({Math, String}));
  assert.equal(duree('Rien à copier'), 2000, 'courte : comme avant');
  assert.equal(duree('Rien à enregistrer', 'La note est vide.'), 2800);
  assert.equal(duree('Aucun état initial pour cette table'), 2000);
  const flamme = duree('Flamme en direct activée', 'Les soirs de séance, dès 19:00, si ta flamme n’est pas encore allumée.');
  assert.ok(flamme > 4500 && flamme < 6000, String(flamme));
  assert.equal(duree('x'.repeat(200), 'y'.repeat(200)), 6000, 'six secondes au plus');
  assert.equal(duree(undefined, undefined), 2000);
  assert.ok(html.includes("clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('on'),toastDuree(msg,sub));"));
  /* Les notifications de l’app passent toutes par toast() ou par « Carte copiée » : aucune autre n’écrit dans le bandeau */
  assert.equal((html.match(/getElementById\('toast-s'\)\.textContent=/g) || []).length, 2);
});
