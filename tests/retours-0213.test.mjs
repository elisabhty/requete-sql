/* Retours de 2 h 13 (Elisa, 4 novembre), sur la fin de l’onboarding, captures de son iPhone à l’appui :
   - la page du résultat : « Bravo, tu viens d’exécuter ta première requête ! 🎉 », « Ta requête a fonctionné ! Tu as retrouvé les
     4 clients qui habitent à Paris. », et le bandeau vert « Premier succès débloqué ! Ce n’est que le début de ton parcours. » ;
   - « le dernier cadre est pixelisé (vert) » : ce bandeau, penché, restait sur un calque dessiné à l’échelle 0,4 de son entrée ;
   - « Commencer la première leçon avec flèche animée » ;
   - « quand on clique sur Voir le parcours, on atterrit » sur « Choisis ton pseudo » : la mini-page venait après la dernière page,
     elle passe avant, et les deux boutons de « Ton parcours est prêt » mènent droit où ils le disent. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const lire = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const app = lire('index.html');
const css = lire('onboarding-vitrine.css');
const sw = lire('sw.js');
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };
/* La dernière définition d’une fonction (certaines ont une ancienne version plus haut dans le fichier) */
const fnLast = (name, fin = '\n}\n') => { const i = app.lastIndexOf(`function ${name}(`); assert.ok(i >= 0, name); return app.slice(i, app.indexOf(fin, i) + fin.length); };

test('page du résultat : le titre, l’explication et le bandeau voulus, avec les espaces insécables', () => {
  const p = cut(app, "const done=!!draft.practiceDone,", "obSetFooter(canGo?'Continuer'");
  assert.ok(p.includes('<h1 class="ob-title" id="ob-title">Bravo, tu viens d’exécuter ta première requête&nbsp;! 🎉</h1>'));
  assert.ok(p.includes("<p class=\"ob-lead\">Ta requête a fonctionné&nbsp;! Tu as retrouvé ${rowsN>1?`les <b>${rowsN}</b> clients qui habitent`:'le client qui habite'} à Paris.</p>"),
    'le nombre vient toujours du vrai résultat, en jaune');
  assert.ok(p.includes('">Premier succès débloqué&nbsp;! Ce n’est que le début de ton parcours.</p>'));
  for (const ancien of ['ta première requête fonctionne', 'SQL a retrouvé, dans la table clients', 'tu apprendras toujours en pratiquant'])
    assert.ok(!app.includes(ancien), `plus de « ${ancien} »`);
});

test('le bandeau vert n’est plus pixelisé : une fois posé, l’animation ne s’applique plus et Safari le redessine net', () => {
  assert.ok(css.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine .ob-practice-reward.is-new{animation:obvStampIn .55s var(--v-pop) 1s backwards}'));
  assert.ok(!css.includes('obvStampIn .55s var(--v-pop) 1s both'));
  /* Avant le départ (1 s), la première image clé le cache ; après, la règle de base (penché de 1,5°) est la même que la dernière image */
  assert.ok(css.includes('@keyframes obvStampIn{0%{opacity:0;transform:scale(.4) rotate(-12deg)}60%{opacity:1;transform:scale(1.08) rotate(2deg)}100%{opacity:1;transform:rotate(-1.5deg)}}'));
  const base = css.match(/html #onboarding\.ob-vitrine \.ob-practice-reward\{[^}]+\}/)[0];
  assert.ok(base.includes('transform:rotate(-1.5deg)') && !/will-change/.test(base), 'penché, sans calque gardé exprès');
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=16">') && sw.includes("'./onboarding-vitrine.css?v=16',"), 'feuille rechargée');
});

test('« Commencer la première leçon » a la flèche animée du bouton de la construction', () => {
  const r = cut(app, "obSetFooter('Commencer la première leçon',", "/* Le bouton se réveille une fois tout posé");
  const fleche = "document.getElementById('ob-next')?.insertAdjacentHTML('beforeend','<span class=\"ob-cta-arrow\" aria-hidden=\"true\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12h14M13 6l6 6-6 6\"/></svg></span>');";
  assert.ok(r.includes(fleche), 'la même flèche, posée après le libellé');
  assert.equal(app.split(fleche).length - 1, 2, 'construction et parcours prêt');
  assert.ok(css.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine .ob-cta:not(:disabled) .ob-cta-arrow{animation:obvArrow 1.1s ease-in-out .4s infinite}'), 'elle avance en boucle');
});

test('le pseudo passe avant « Ton parcours est prêt », qui reste la dernière page', () => {
  assert.ok(app.includes("const OB_SLIDES = ['welcome','name','age','job','goal','level','rhythm','jours','build','promise','pact','practice','source','rappel','widget','widgetTuto','account','pseudo','ready'];"));
  const go = fnLast('obGoto');
  assert.ok(go.includes("if(OB_SLIDES[n]==='ready'&&obPseudoAvant())return;"), 'tout chemin vers la dernière page passe par le pseudo');
  assert.ok(go.indexOf('obPseudoAvant()') < go.indexOf('obLock=true'));
  assert.ok(fnLast('obNext').includes("else if(slide==='pseudo')obPseudoSuivant();"), 'glisser ou Entrée sur la mini-page : le pseudo, pas la fin');
  const fin = fnLast('finishOnboard');
  assert.ok(fin.includes("if(!psMien()&&!clsSalle().psPage&&typeof psPage==='function'){const s=clsSalle();s.psPage=1;save();psPage({voulu:psAncien(),suite:()=>obTerminer(action)});return;}"),
    'déjà montrée (ou « Plus tard ») : pas redemandée à la fin');
  assert.ok(fnLast('obTerminer').includes("if(action==='plan-ready'){\n    switchTab('planning');"), '« Voir mon parcours » : le Planning');
});

/* obPseudoAvant et psPageFin, joués dans un bac à sable */
function bac({ pseudo = '', dejaVue = false, apercu = false } = {}) {
  const log = [], classes = new Set(['on']), salle = dejaVue ? { psPage: 1 } : {};
  const ctx = vm.createContext({
    psMien: () => pseudo, clsSalle: () => salle, save: () => log.push('enregistré'), psAncien: () => 'lea_sql',
    obApercu: apercu, obEntry: 'welcome', PS: { suite: null, siOk: null, page: null, etat: {} },
    psPage: o => { log.push('mini-page ' + JSON.stringify({ voulu: o.voulu, garder: o.garder })); ctx.PS.page = o; ctx.PS.suite = o.suite; ctx.obEntry = 'pseudo'; },
    obGoto: t => log.push('vers ' + t), obBarreEtat: v => log.push('barre ' + v), renderCompte() {}, renderDefis() {}, activeTab: 'learn',
    document: { getElementById: () => ({ classList: { remove: (...c) => { c.forEach(x => classes.delete(x)); log.push('fermé'); } }, setAttribute() {} }) }
  });
  vm.runInContext(fnLast('obPseudoAvant') + fnLast('psPageFin'), ctx);
  return { ctx, log, classes, salle };
}

test('bac à sable : la mini-page une seule fois, l’onboarding reste ouvert, puis la dernière page', () => {
  const b = bac();
  assert.equal(b.ctx.obPseudoAvant(), true);
  assert.deepEqual(b.log, ['enregistré', 'mini-page {"voulu":"lea_sql","garder":true}']);
  assert.equal(b.salle.psPage, 1, 'notée comme montrée : la fin de l’onboarding ne la redemande pas');
  b.log.length = 0;
  b.ctx.psPageFin(false);                       // « Plus tard », ou pseudo gardé hors ligne
  assert.deepEqual(b.log, ['vers ready'], 'pas de fermeture, pas de barre rendue : « Ton parcours est prêt » prend la place');
  assert.ok(b.classes.has('on'));
  assert.equal(b.ctx.obEntry, 'welcome', 'l’entrée de l’onboarding revient');
  for (const opts of [{ pseudo: 'tom' }, { dejaVue: true }, { apercu: true }]) {
    const c = bac(opts);
    assert.equal(c.ctx.obPseudoAvant(), false, JSON.stringify(opts)); assert.deepEqual(c.log, []);
  }
  /* Ailleurs (ouverture de l’appli, salle de défi) : la mini-page se ferme comme avant */
  const d = bac(); d.ctx.PS.page = {}; d.ctx.PS.suite = () => d.log.push('suite');
  d.ctx.psPageFin(true);
  assert.deepEqual(d.log, ['fermé', 'barre false', 'suite']);
});
