/* 4 novembre, 16 h 09 (Elisa) : « Fais comme un badge qui fusionne "1000 personnes apprécient Requête" et "Ils apprécient Requête",
   stp, et regarde s’il y a des pages qu’on peut fusionner ou placer dans le bon ordre. » Le titre devient un badge à lauriers ; l’étape
   passe entre la promesse et l’engagement (la promesse, la preuve, puis l’engagement), et les questions se suivent sans interruption. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html'), css = read('onboarding-vitrine.css');
const i = app.indexOf('/* ---------- « Ils apprécient Requête » (Elisa, 4 novembre, 14 h 08) ----------'), j = app.indexOf('/* 14 h 08 (réf. 3) : « mettre une flèche animée', i);
const bloc = app.slice(i, j);
const titre = communaute => {
  const ctx = vm.createContext({ obNombre: n => Number(n).toLocaleString('fr-FR'), escAttr: s => String(s), obTypo: s => s, draft: {}, document: { addEventListener() {} } });
  vm.runInContext(bloc.replace('const OB_COMMUNAUTE=1000;', `const OB_COMMUNAUTE=${communaute};`), ctx);
  return ctx.obTemoinsTitre();
};

test('le badge : « 1 000+ » entre deux lauriers, « personnes apprécient Requête » dessous, lu en entier par un lecteur d’écran', () => {
  const h = titre(1000);
  assert.ok(h.startsWith('<h1 class="ob-tv-badge" id="ob-title"><span class="ob-sr">Plus de 1 000 personnes apprécient Requête</span>'), h.slice(0, 120));
  assert.ok(h.includes('<span class="ob-tv-badge-c" aria-hidden="true"><b><i data-n="1000">1 000</i>+</b><span>personnes apprécient Requête</span></span>'));
  assert.equal((h.match(/<span class="ob-tv-laurier( is-d)?" aria-hidden="true"><svg viewBox="-4 -8 48 112">/g) || []).length, 2, 'une branche de chaque côté, la droite en miroir');
  assert.ok(h.indexOf('ob-tv-laurier"') < h.indexOf('ob-tv-badge-c') && h.indexOf('ob-tv-badge-c') < h.indexOf('ob-tv-laurier is-d'));
  assert.ok(!/Ils <em>apprécient<\/em>/.test(h) && !h.includes('accompagnées'), 'un seul message, celui du badge');
  assert.equal(titre(null), '<h1 class="ob-title" id="ob-title">Ils <em>apprécient</em> Requête</h1>', 'sans chiffre vérifié, le titre d’avant');
  /* Le dessin : une tige et des feuilles, en jaune, qui poussent depuis leur pied */
  assert.ok(bloc.includes("const OB_TV_LAURIER='<svg viewBox=\"-4 -8 48 112\"><path d=\"M36 98C8 84 2 40 18 6\" fill=\"none\" stroke=\"currentColor\""));
  for (const k of ['html #onboarding.ob-vitrine .ob-tv-laurier{flex:none;width:38px;height:88px;color:var(--v-sun-hi);transform-origin:50% 100%;',
    'html #onboarding.ob-vitrine .ob-tv-laurier.is-d{transform:scaleX(-1)}', 'html #onboarding.ob-vitrine .ob-tv-badge-c b{font:800 46px/1 var(--v-display);',
    'html #onboarding.ob-vitrine .ob-tv-badge+.ob-tv{margin-top:14px}', '@keyframes obvLaurier{0%{opacity:0;scale:.3;rotate:-28deg}'])
    assert.ok(css.includes(k), k);
  assert.ok(css.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine.ob-enter .ob-tv-laurier{animation:obvLaurier .65s var(--v-pop) .14s backwards}'));
  assert.ok(!css.includes('.ob-tv-stat') && !app.includes('ob-tv-stat'), 'plus de pastille à part');
  /* Le chiffre défile dans le badge */
  assert.ok(bloc.includes("const n=document.querySelector('#ob-body .ob-tv-badge i[data-n]');"));
});

test('l’ordre : les questions se suivent, puis le parcours, la promesse, la preuve et l’engagement', () => {
  const ob = vm.runInNewContext(app.match(/const OB_SLIDES = (\[[^\]]+\]);/)[1]);
  const ordre = ['goal', 'level', 'rhythm', 'jours', 'build', 'promise', 'temoignages', 'pact', 'practice'];
  assert.deepEqual([...ob].slice(ob.indexOf('goal'), ob.indexOf('goal') + ordre.length), ordre);
  const prof = vm.runInNewContext(app.match(/const OB_PROFILE_SLIDES=(\[[^\]]+\]);/)[1]);
  assert.deepEqual([...prof], ['name', 'pays', 'age', 'job', 'goal', 'level', 'rhythm', 'jours', 'build', 'promise', 'temoignages', 'pact', 'practice'], '« Étape X sur N »');
  /* Suivant, le bouton et le retour suivent ce même ordre */
  assert.ok(app.includes("  else if(slide==='goal')obGoto('level');\n  else if(slide==='level')obGoto('rhythm');"));
  assert.ok(app.includes("  else if(slide==='promise')obGoto('temoignages');\n  else if(slide==='temoignages')obGoto('pact');\n  else if(slide==='pact')obGoto('practice');"));
  assert.ok(app.includes("    obSetFooter('Continuer',()=>obGoto('level'),'','','',!draft.goal);") && app.includes("    obSetFooter('Continuer',()=>obGoto('temoignages'),'','','');\n    obRunBig();"));
  assert.ok(app.includes("    obSetFooter('Continuer',()=>obGoto('pact'),'','','');\n  }else if(slide==='level'){"), 'les avis mènent à l’engagement');
  /* L’entonnoir de l’onboarding, dans le même ordre */
  const sql = read('supabase/migrations/20261104135000_onboarding_entonnoir.sql');
  const rangs = [...sql.matchAll(/\('([a-zA-Z]+)', (\d+), '/g)].map(m => [m[1], +m[2]]);
  assert.deepEqual(rangs.map(r => r[0]), ['welcome', 'name', 'pays', 'age', 'job', 'goal', 'level', 'rhythm', 'jours', 'build', 'promise', 'temoignages', 'pact', 'practice', 'account', 'source', 'rappel', 'ready', 'termine']);
  assert.deepEqual(rangs.map(r => r[1]), rangs.map((_, k) => k + 1), 'des rangs qui se suivent');
});
