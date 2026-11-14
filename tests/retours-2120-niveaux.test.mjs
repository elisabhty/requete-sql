/* Elisa, 14 novembre, 21 h 20 : « quand on est passé à un niveau en plus, on va avoir du coup 5 stickers… une page en commun où tu
   vas mettre tous les stickers obtenus… vous avez augmenté de niveau, le nom du niveau… les défis moyens sont conseillés, etc. Une
   belle page UX. Effet waouh… il faut que tu rajoutes des confettis et des vibrations ».
   - Cinq stickers de niveau (niv1 à niv5), chacun dans la planche dès que son image 3D est là (niv1 d’abord).
   - La page « Nouveau niveau » : les stickers gagnés au même moment, le nom du niveau, le chemin des cinq niveaux, ce qui reste
     jusqu’au suivant, les défis conseillés ; confettis, vibrations, sons.
   - Dans une leçon, elle vient sur le bilan, après la fin du module ; une personne qui avait déjà des stickers part de son niveau. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';

/* Le vrai code des paliers et des stickers de niveau, sur 71 leçons (paliers à la 12e, à la 31e et à la 46e) */
const monde = ({ faites = 0, requete = false, defis = 0 } = {}) => {
  const state = { stickers: { got: {}, fresh: {}, board: [], since: 1, ev: requete ? { requete: 1 } : {} }, lessons: {} };
  const ctx = vm.createContext({ state, itemDone: id => id < faites, compteStats: () => ({ lessons: faites, defis }) });
  vm.runInContext(cut('const NIVEAUX=[', '\nconst RYTHMES=') + '\n' + cut('const ACCOUNT_LEVELS=[', 'function lvlBadgeHTML(') + fn('stkState')
    + 'function stkEstNiv(id){return /^niv[1-5]$/.test(String(id||\'\'));}' + fn('nivRangAtteint') + fn('nivRangVu') + fn('stkNiveaux')
    + 'const allLessons=Array.from({length:71},(_,i)=>({id:i}));const MODULES=[{titre:"Jointures",lessons:[{id:30}]}];', ctx);
  return { ctx, liste: () => JSON.parse(vm.runInContext('JSON.stringify(stkNiveaux())', ctx)), rang: () => vm.runInContext('nivRangAtteint()', ctx) };
};

test('cinq stickers de niveau : le niveau 1 avec la première requête, les suivants avec les leçons validées', () => {
  const l = monde().liste();
  assert.deepEqual(l.map(s => s.id), ['niv1', 'niv2', 'niv3', 'niv4', 'niv5']);
  assert.deepEqual(l.map(s => s.cap), ['Niveau 1', 'Niveau 2', 'Niveau 3', 'Niveau 4', 'Niveau 5']);
  assert.deepEqual(l.map(s => s.name), ['Explorateur SQL', 'Constructeur de requêtes', 'Analyste relationnel', 'Architecte des requêtes', 'SELECT * FROM légende']);
  assert.deepEqual(l.map(s => s.goal), [1, 11, 30, 45, 71], 'les vrais seuils, en leçons validées');
  assert.deepEqual(l.map(s => s.ok), [false, false, false, false, false], 'avant la première requête, aucun niveau');
  assert.equal(monde({ requete: true }).rang(), 1, 'la requête d’essai de l’onboarding');
  assert.deepEqual(monde({ faites: 30 }).liste().map(s => s.ok), [true, true, true, false, false]);
  assert.deepEqual(monde({ faites: 71 }).liste().map(s => s.ok), [true, true, true, true, true]);
  assert.equal(monde({ faites: 20 }).liste()[2].now, 20, 'l’avancée vers le niveau 3');
  assert.equal(l[1].how, 'Valide 11 leçons du parcours.');
});

test('déjà des stickers avant cette version : on part de son niveau, sans page pour les niveaux déjà atteints', () => {
  const vieux = monde({ faites: 30 }), neuf = monde({ requete: true });
  vieux.ctx.state.stickers.since = 5; assert.equal(vm.runInContext('nivRangVu()', vieux.ctx), 3, 'le niveau du moment');
  neuf.ctx.state.stickers.since = 0; assert.equal(vm.runInContext('nivRangVu()', neuf.ctx), 0, 'une nouvelle personne fête son niveau 1');
  const sync = fn('stkSync');
  assert.ok(sync.includes('if(!(s.kind===\'niveau\'&&s.num<=vu))won.push(s.id);') && sync.includes('if(neuf)save();'), 'gagné sans page, « Nouveau » dans la collection');
  /* rang survit à la sauvegarde (normalizeState) */
  assert.ok(app.includes('const rangVu=Number(stkSrc.rang);if(Number.isInteger(rangVu)&&rangVu>=0&&rangVu<=5)stickers.rang=rangVu;'));
});

/* stkAfterProgress, avec de faux voisins : ce qui part tout de suite, ce qui attend le bilan */
const apres = ({ won, de = 1, a = 1, lecon = false, requete = false }) => {
  const pages = [], ctx = vm.createContext({ state: { stickers: { got: {}, fresh: {}, board: [], since: 1, ev: requete ? { requete: 1 } : {} } }, mode: lecon ? 'lesson' : 'learn',
    document: { body: { classList: { contains: c => lecon && c === 'in-lesson' } } }, stkPageOuvrir: (ids, niv) => pages.push([[].concat(ids), niv || null]),
    stkSync: () => won, nivRangVu: () => de, nivRangAtteint: () => a, save: () => {}, stkEstNiv: id => /^niv[1-5]$/.test(id) });
  vm.runInContext(fn('stkState') + 'let stkLessonNew=[],stkLessonNiv=null;' + fn('stkAfterProgress'), ctx);
  ctx.stkAfterProgress();
  return { pages: JSON.parse(JSON.stringify(pages)), attente: JSON.parse(vm.runInContext('JSON.stringify({n:stkLessonNew,v:stkLessonNiv})', ctx)), rang: ctx.state.stickers.rang };
};

test('un niveau de plus : sa page, avec tous les stickers gagnés au même moment', () => {
  assert.deepEqual(apres({ won: ['niv2'], de: 1, a: 2 }).pages, [[['niv2'], { de: 1, a: 2 }]], 'hors leçon : tout de suite');
  assert.equal(apres({ won: [], de: 1, a: 2 }).rang, 2, 'le niveau fêté est retenu');
  assert.deepEqual(apres({ won: [], de: 1, a: 2 }).pages, [[[], { de: 1, a: 2 }]], 'sans sticker (pas encore d’image) : la page quand même');
  assert.deepEqual(apres({ won: ['lecons10'] }).pages, [[['lecons10'], null]], 'sans niveau : la page d’un accomplissement, comme avant');
  /* La première requête de l’onboarding : « Première requête » et le niveau 1 sur la même page */
  assert.deepEqual(apres({ won: ['requete', 'niv1'], de: 0, a: 1, requete: true, lecon: true }).pages, [[['requete', 'niv1'], { de: 0, a: 1 }]]);
  /* Dans une leçon : le bilan d’abord */
  const l = apres({ won: ['agregats', 'niv3'], de: 2, a: 3, lecon: true });
  assert.deepEqual(l.pages, []);
  assert.deepEqual(l.attente, { n: ['agregats', 'niv3'], v: { de: 2, a: 3 } });
  const check = fn('nivUpCheck');
  assert.ok(check.includes("if(!stkLessonNiv||mode!=='lesson'||lessonStep!==3)return;") && check.includes("return s&&!(s.kind==='module'&&MU_SEEN.has(id));") && check.includes('stkPageOuvrir(ids,niv,true);'),
    'sur le bilan, sans le sticker du module que sa page a déjà montré');
  assert.ok(app.includes('setTimeout(()=>{moduleUpCheck();nivUpCheck();},250);'), 'après la fin du module');
  assert.ok(fn('stkLeaveLesson').includes('if(niv)setTimeout(()=>stkPageOuvrir(shown?[]:won,niv),450);'), 'partie avant le bilan : en sortant');
});

test('la fin du module passe d’abord ; « Commencer le module » ouvre le module en refermant la page du niveau', () => {
  const start = fn('moduleUpStart');
  assert.ok(start.includes('if(attente){ stkPageApres=()=>openItem(first.id); stkPageOuvrir([]); if(MU)return; stkPageApres=null; }'));
  assert.ok(fn('moduleUpClose').includes("if(stkPageFile.length||stkPageNiv){ clearTimeout(stkPageOuvrir.t); stkPageOuvrir.t=setTimeout(()=>stkPageOuvrir([]),instant?0:320); }"));
  const o = fn('stkPageOuvrir');
  assert.ok(o.includes("if(niveau){ if(MU)MU.apres=null; moduleUpClose(true); nivVoirDefis(); return; }"), '« Voir les défis » ne lance pas le module');
});

test('la page : le niveau, son nom, le chemin des cinq niveaux, la suite et les défis conseillés', () => {
  const h = fn('nivPageHtml');
  assert.ok(h.includes("${a===1?'Ton premier niveau':'Tu passes au niveau supérieur'}") && h.includes('<h2 class="mu-h" id="mu-h" tabindex="-1">Niveau&nbsp;${a}&nbsp;!</h2>'));
  assert.ok(h.includes('<p class="mu-lvl"><i aria-hidden="true">${a}</i><span>${esc(nivNom(a-1))}</span></p>'), 'le nom du niveau, accordé');
  assert.ok(h.includes('role="img" aria-label="Niveau ${a} sur 5"'));
  assert.ok(h.includes("`Prochain&nbsp;: <b>${esc(nivNom(a))}</b>${reste?` · encore ${reste}&nbsp;leçon${reste>1?'s':''}`:''}`:'Tu as atteint le plus haut niveau'"), 'de vrais chiffres');
  assert.ok(h.includes("<small>${change?'Maintenant conseillés':'Défis conseillés'}</small><b>Les défis ${NIV_DEFIS[kAp]||'Faciles'}</b>") && h.includes('kAp=jeuNivAuto(a);if(de)kAv=jeuNivAuto(de);'));
  assert.ok(h.includes('<span class="mu-medal-in"><small>Niv.</small><b>${a}</b></span>'), 'la médaille, tant que le sticker du niveau n’a pas d’image');
  assert.ok(h.includes("${!stk.length?'Continuer':plus?'Récupérer les stickers':'Récupérer le sticker'}") && h.includes('<button type="button" class="mu-later">Voir les défis</button>'));
  assert.ok(!/bient[oô]t|prochainement/i.test(h));
  /* Effet waouh : impact, confettis deux fois, vibrations (moteur haptique sur iPhone), sons */
  const o = fn('stkPageOuvrir');
  assert.ok(o.includes('muImpact(el,true);') && o.includes("buzz('heavy');") && o.includes('lqConfetti({n:90});') && o.includes("el.classList.add('is-lvl'); buzz('success'); lqConfetti({n:60});"));
  assert.ok(app.includes('@keyframes muLvFill{to{width:calc((var(--a) - 1) / 4 * 100%)}}') && app.includes('.mu.is-still .mu-lv-fill{width:calc((var(--a) - 1) / 4 * 100%)}'), 'mouvement réduit : le chemin déjà rempli');
  assert.ok(app.includes("if(q&&q.get('apercu')==='niveau'){"), 'aperçu : ?apercu=niveau&niveau=3');
});

test('les cinq stickers de niveau : WebP carrés de 768 px, transparents, dans la planche', () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const b = fs.readFileSync(path.join(ROOT, `assets/stickers/niv${n}.webp`));
    assert.equal(b.toString('ascii', 8, 16), 'WEBPVP8X', `niv${n}`);
    assert.ok(b[20] & 0x10, `niv${n} : avec transparence`);
    assert.deepEqual([1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)], [768, 768], `niv${n}`);
  }
  assert.ok(app.includes("'niv1','niv2','niv3','niv4','niv5']);   // 14 novembre"));
  const r = fn('renderStickers');
  assert.ok(r.includes("${nivs.length>1?group('Niveaux',nivs):''}") && r.includes("list.filter(s=>s.kind==='acc'||(s.kind==='niveau'&&nivs.length<2))"), 'un seul : avec les accomplissements');
});
