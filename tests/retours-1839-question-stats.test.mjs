/* Elisa, 14 novembre, 18 h 33 : « Mais si elle est décochée, il n’y a personne qui va la recocher » ; 18 h 39 : « Ok, une mini-page
   après commencer, avec un beau texte et tout ». La question des statistiques anonymes (App Review 5.1.1(ii) : un accord, même pour
   des données anonymes) remplace la case sous les conditions : une page, juste après « Commencer », deux réponses de même poids. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const obv = readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('la page : juste après « bonjour », le chat à la loupe, le titre, trois promesses, deux réponses de même taille', () => {
  assert.ok(app.includes("const OB_SLIDES = ['bonjour','stats','welcome','questions',"));
  const p = cut("}else if(slide==='stats'){", "}else if(slide==='questions'){");
  assert.ok(p.includes('<img class="ob-stats-chat" src="assets/chat-loupe${fixe?\'-fixe\':\'\'}.webp"'));
  assert.ok(p.includes('<h1 class="ob-title" id="ob-title">Tu nous aides à <em>améliorer</em> Requête&nbsp;?</h1>'));
  assert.ok(p.includes('<p class="ob-lead">Avec ton accord, l’appli compte ce qui marche et ce qui coince. C’est comme ça qu’on rend les leçons plus claires.</p>'));
  for (const k of ['<b>Anonyme</b>Ni ton nom, ni ton e-mail, ni ton pseudo.', '<b>Jamais tes réponses</b>Ni tes requêtes, ni ce que tu écris.', '<b>À toi de choisir</b>Tu changes d’avis quand tu veux, dans Mon&nbsp;compte.'])
    assert.ok(p.includes(k), k);
  /* Les deux réponses : la même classe, rien qui pousse vers le oui (5.1.1(iv)) */
  assert.ok(p.includes('<button type="button" class="ob-stats-btn" onclick="obStatsRepondre(true)">Oui, avec plaisir</button><button type="button" class="ob-stats-btn" onclick="obStatsRepondre(false)">Non merci</button>'));
  assert.ok(p.includes("obSetFooter('',null,'','',{html:"), 'à la place du bouton jaune');
  assert.ok(!/ob-stats-btn[^"]*is-/.test(app) && !/\.ob-stats-btn\.[a-z]/.test(obv), 'aucune des deux n’est mise en avant');
  for (const k of ['html #onboarding.ob-vitrine .ob-stats-btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:56px;',
    'html #onboarding.ob-vitrine .ob-stats-choix{display:flex;flex-direction:column;gap:12px}',
    'html #onboarding.ob-vitrine.ob-stats-ecran .ob-foot.is-sans-bouton{padding-bottom:calc(var(--safe-bottom,0px) + clamp(34px,6.6vh,58px))!important}'])
    assert.ok(obv.includes(k), k);
  assert.ok(app.includes("  root.classList.toggle('ob-stats-ecran',slide==='stats'&&!obLegalMode);"));
  /* Une reprise ne repart pas d’ici ; « Suivant » ne la passe pas ; de l’accueil, « Retour » mène à « bonjour » */
  assert.ok(app.includes("    if(['bonjour','stats','welcome','questions'].includes(r.slide)||OB_WIDGET_SLIDES.includes(r.slide))return null;"));
  assert.ok(app.includes("  if(slide==='stats')return;   // une des deux réponses, rien d'autre (14 novembre)\n  if(slide==='bonjour')obGoto('welcome');"));
  assert.ok(app.includes("  if(OB_SLIDES[obStep]==='welcome'){obGoto('bonjour');return;}"));
  /* Plus de case sous les conditions */
  assert.ok(!app.includes('statCaseHTML') && !obv.includes('ob-stat-case'));
});

function monter({ accord = '', onboarded = false, apercu = false } = {}) {
  const OB_SLIDES = vm.runInNewContext(cut('const OB_SLIDES = ', ';\n').replace('const OB_SLIDES = ', '') + ';');
  const el = { classList: { remove() {}, add() {} }, dataset: {}, style: {}, offsetHeight: 0, contains: () => false };
  const ctx = vm.createContext({ OB_SLIDES, OB_STEPS: OB_SLIDES.length, obLock: false, obStep: 0, obLegalMode: null, obAuthMessage: '', obJustEntered: false, obHPleine: 0,
    OB_CLAVIER_MS: 0, OB_SORTIE_MS: 0, state: { onboarded }, obApercu: apercu, document: { getElementById: () => el, activeElement: null },
    obPseudoAvant: () => false, paintOb() {}, prefersReduceMotion: () => true, setTimeout: f => f(), buzz() {}, Date,
    statAccord: () => ctx.accord, statChoisir: on => { ctx.accord = on ? '1' : '0'; ctx.choix.push(on); }, accord, choix: [] });
  vm.runInContext(cut('function obGoto(target){', '\nlet obPeinteLe=0;') + '\nvar obPeinteLe=0;', ctx);
  return { ctx, ou: () => OB_SLIDES[ctx.obStep], aller: s => ctx.obGoto(s) };
}

test('posée une fois : « Commencer » y mène tant qu’il n’y a pas de réponse ; un double toucher ne vaut pas un oui ; répondue, elle ne revient plus', () => {
  const m = monter();
  m.aller('welcome');
  assert.equal(m.ou(), 'stats', '« Commencer » (obGoto(\'welcome\')) passe par la question');
  m.ctx.obStatsRepondre(true);
  assert.deepEqual(m.ctx.choix, [], 'un toucher dans la demi-seconde : ignoré (le second toucher de « Commencer »)');
  m.ctx.obPeinteLe = Date.now() - 1000;
  m.ctx.obStatsRepondre(true);
  assert.deepEqual(m.ctx.choix, [true]); assert.equal(m.ou(), 'welcome', 'puis l’accueil');
  m.aller('stats'); assert.equal(m.ou(), 'welcome', 'répondue : on n’y revient pas');
  /* « Non merci » : pareil, l’accueil */
  const n = monter(); n.aller('welcome'); n.ctx.obPeinteLe = 0; n.ctx.obStatsRepondre(false);
  assert.deepEqual(n.ctx.choix, [false]); assert.equal(n.ou(), 'welcome');
  /* Même si l’appareil ne garde rien (stockage refusé), la question ne boucle pas */
  const r = monter(); r.ctx.statChoisir = () => {}; r.aller('welcome'); r.ctx.obPeinteLe = 0; r.ctx.obStatsRepondre(true);
  assert.equal(r.ou(), 'welcome');
});

test('jamais posée : réponse déjà gardée, l’aperçu de Mon compte, un compte déjà inscrit', () => {
  for (const o of [{ accord: '1' }, { accord: '0' }, { apercu: true }, { onboarded: true }]) {
    const m = monter(o); m.aller('welcome');
    assert.equal(m.ou(), 'welcome', JSON.stringify(o));
  }
});
