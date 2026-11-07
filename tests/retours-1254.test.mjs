/* Elisa, 7 novembre, 12 h 54 (ses GIF faits avec ChatGPT) : « En bonus, pour de nouveaux endroits : il cherche avec une loupe (recherche
   sans résultat), il dort avec des « zzz » (jour de repos), il tient un chrono (défis). »
   - les trois GIF détourés et adoucis au bord, 12 images de 420 ms, en boucle (assets/chat-loupe, chat-dodo, chat-chrono) ; en
     mouvement réduit, l’image qui le dit le mieux : la loupe à l’œil, les « zzz », le chrono levé avec un clin d’œil ;
   - la loupe : chaque recherche sans résultat (les cours, les questions d’entretien, les notes, les requêtes de la console), à la place
     du picto ; les filtres des cours sans résultat (« Tu es à jour »…) gardent le leur : ce n’est pas une recherche ;
   - le chat qui dort : un jour de repos dans le planning (« Journée libre », et un jour passé sans séance), à la place de la tasse et
     de la lune ;
   - le chrono : la carte des défis, « Ta salle de défi », à la place de la cible ; il arrive du même rebond.
   Vérifié dans un navigateur (393 et 320 px de large) : les cours, les entretiens, les notes, le planning, les défis. Les deux autres
   GIF reçus avec eux (il salue et s’en va ; il jongle avec des tables) attendent leur place. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const TAILLES = { loupe: [307, 356], dodo: [321, 348], chrono: [340, 352] };

test('les trois GIF bonus et leur image fixe', () => {
  for (const [k, [w, h]] of Object.entries(TAILLES)) {
    const anim = fs.readFileSync(path.join(ROOT, `assets/chat-${k}.webp`)), fixe = fs.readFileSync(path.join(ROOT, `assets/chat-${k}-fixe.webp`));
    for (const f of [anim, fixe]) { assert.equal(f.subarray(0, 4).toString(), 'RIFF'); assert.equal(f.subarray(8, 12).toString(), 'WEBP'); assert.equal(f.subarray(12, 16).toString(), 'VP8X'); }
    const taille = f => [f.readUIntLE(24, 3) + 1, f.readUIntLE(27, 3) + 1];
    assert.deepEqual(taille(anim), [w, h], k); assert.deepEqual(taille(fixe), [w, h], k);
    assert.ok(anim.includes('ANIM') && anim.includes('ALPH') && !fixe.includes('ANIM'), k);
    const durees = []; let j = 12;
    while (j < anim.length) { const id = anim.subarray(j, j + 4).toString(), t = anim.readUInt32LE(j + 4); if (id === 'ANMF') durees.push(anim.readUIntLE(j + 8 + 12, 3)); j += 8 + t + (t & 1); }
    assert.deepEqual(durees, Array(12).fill(420), k);
    assert.equal(anim.readUInt16LE(anim.indexOf('ANIM') + 8 + 4), 0, `${k} : en boucle`);
    assert.ok(anim.length < 300000 && fixe.length < 60000, `${k} : léger`);
    assert.ok(sw.includes(`  './assets/chat-${k}.webp',\n  './assets/chat-${k}-fixe.webp',\n`), `${k} : hors ligne`);
  }
});

test('chatBonusHtml : l’image animée, ou fixe en mouvement réduit ; une fonction, prête dès les premiers rendus', () => {
  const code = cut('function chatBonusHtml(k,cls){', '\nfunction mascotReduced(){');
  for (const reduit of [false, true]) {
    const ctx = vm.createContext({ mascotReduced: () => reduit });
    vm.runInContext(code, ctx);
    for (const [k, [w, h]] of Object.entries(TAILLES))
      assert.equal(ctx.chatBonusHtml(k, 'is-vide'), `<img class="chat-bonus is-${k} is-vide" src="assets/chat-${k}${reduit ? '-fixe' : ''}.webp" width="${w}" height="${h}" alt="" draggable="false">`);
    assert.equal(ctx.chatBonusHtml('dodo'), `<img class="chat-bonus is-dodo" src="assets/chat-dodo${reduit ? '-fixe' : ''}.webp" width="321" height="348" alt="" draggable="false">`, 'sans classe en plus');
    assert.equal(ctx.chatBonusHtml('toString'), '', 'un nom inconnu : rien');
  }
});

test('la loupe : chaque recherche sans résultat', () => {
  const cours = cut('function filterCourseCatalog(value){', '\nfunction clearCourseSearch(){');
  assert.ok(cours.includes(`<div class="catalog-no-results">\${searching?chatBonusHtml('loupe','is-vide'):'<div class="sq-empty-ico" aria-hidden="true">🔎</div>'}<h3>\${emptyTitle}</h3>`), 'les cours ; les filtres gardent leur picto');
  assert.ok(app.includes(`<div class="ent-empty ent-empty-search">\${chatBonusHtml('loupe','is-vide')}<b>Aucune question trouvée</b>`), 'les questions d’entretien');
  assert.ok(app.includes(`<div class="notes-empty">\${chatBonusHtml('loupe','is-vide')}<b>Aucun résultat</b>`), 'les notes');
  assert.ok(app.includes(`<p class="console-query-empty">\${q?chatBonusHtml('loupe','is-vide is-petit'):\`<span class="console-query-stk" aria-hidden="true">\${lqStkSvg('pin')}</span>\`}<b>\${q?'Aucun résultat':'Aucune requête épinglée'}</b>`), 'la console : les requêtes épinglées');
  assert.ok(app.includes(`<p class="console-query-empty">\${q?chatBonusHtml('loupe','is-vide is-petit'):''}<b>\${q?'Aucun résultat':consoleHistFilter==='err'?`), 'la console : l’historique');
  assert.ok(!app.includes('<span class="ent-empty-ico" aria-hidden="true">${LQ_SEARCH_SVG}</span><b>Aucune question trouvée</b>'));
});

test('le chat qui dort : un jour de repos dans le planning', () => {
  const ctx = vm.createContext({ DEF_CHEV_SVG: '<svg></svg>', mascotReduced: () => false, lqStkSvg: () => '<svg class="lq-stk"></svg>' });
  vm.runInContext(cut('function chatBonusHtml(k,cls){', '\nfunction mascotReduced(){') + cut('function dayPauseHTML(passe){', '/* Liste du jour'), ctx);
  const libre = ctx.dayPauseHTML(false), passe = ctx.dayPauseHTML(true);
  assert.ok(libre.startsWith('<div class="dp-pause"><span class="dp-stk is-dodo" aria-hidden="true"><img class="chat-bonus is-dodo" src="assets/chat-dodo.webp" width="321" height="348" alt="" draggable="false"><i class="dp-sp s1"></i><i class="dp-sp s2"></i></span><b>Journée libre</b>'), 'à la place de la tasse, ses étincelles autour');
  assert.ok(passe.startsWith('<div class="dp-pause is-past"><span class="dp-stk is-dodo" aria-hidden="true"><img class="chat-bonus is-dodo" src="assets/chat-dodo.webp"') && passe.includes('<b>Pas de séance ce jour-là</b>'), 'à la place de la lune');
  assert.ok(!libre.includes('lq-stk') && !passe.includes('lq-stk'));
});

test('le chrono : la carte des défis', () => {
  const carte = cut('function defisRapideHTML(){', '\n/* Créer une salle, entrer un code');
  assert.ok(carte.includes(`<section class="room-card dx-rapide" aria-labelledby="dx-rapide-h"><div class="room-head">\${chatBonusHtml('chrono','room-chat')}<div>`), 'à la place de la cible');
  assert.ok(!carte.includes("lqStkSvg('target')"));
});

test('les tailles, et rien ne bouge par-dessus les GIF', () => {
  for (const r of ['.chat-bonus{display:block;height:auto;max-width:none;pointer-events:none;',
    '.chat-bonus.is-vide{width:86px;margin:0 auto 8px}', '.chat-bonus.is-vide.is-petit{width:66px;margin-bottom:6px}',
    'html.lq .dp-pause .dp-stk.is-dodo{width:94px;height:auto;margin:0 0 4px;rotate:0deg;animation:none}', 'html.lq .dp-pause.is-past .dp-stk.is-dodo{width:76px}',
    'html.lq .room-head .room-chat{flex:none;width:80px;margin:-10px -4px -12px -6px;animation:lrStk .6s cubic-bezier(.3,.7,.3,1.35) .1s both}',
    '@media (prefers-reduced-motion:reduce){html.lq .room-head .room-chat{animation:none}}', 'html[data-motion="reduce"].lq .room-head .room-chat{animation:none}'])
    assert.ok(lq.includes(r), r);
  assert.ok(lq.indexOf('html.lq .dp-pause .dp-stk.is-dodo{') > lq.indexOf('html.lq .dp-pause .dp-stk{position:relative;display:block;width:78px;height:78px;'), 'après la règle de l’autocollant');
});
