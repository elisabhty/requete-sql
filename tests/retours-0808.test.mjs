/* Elisa, 7 novembre, 8 h 08, avec une capture de l’accueil (le clavier ouvert, la barre de recherche cachée) : « Quand on clique sur
   explorer il faut que ça nous ramène dans la barre et ça sur les pages l’ayant ». Puis, sur la coche qui s’affiche après une action :
   « j’aime pas ce genre de notification déjà pas centré puis je préfère juste une petite micro interaction sans texte en mode « validé »
   pareil pour le supprimer je préfère quand l’icône fait juste une petite micro interaction » et, à 8 h 09, « Comme l’épinglé ».
   - « Explorer » ouvre la recherche et la fait remonter en haut de l’écran, sous la barre d’état, le curseur dedans (« / » aussi) ;
   - la coche de lqDone (partout dans l’app) n’a plus de mot ni de place au coin : au centre de la chose touchée, elle se plante d’un
     rebond avec une onde et quatre éclats, comme la punaise des requêtes épinglées ; une suppression montre une poubelle dont le
     couvercle saute. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html'), lq = read('ludique.css'), sw = read('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('« Explorer » : la barre de recherche remonte en haut de l’écran, le curseur dedans', () => {
  const t = cut('function toggleCatalogTools(btn){', '\n}\n');
  assert.ok(t.includes("if(open){lqVersRecherche(tools,document.getElementById('course-search'));return;}"));
  const v = cut('function lqVersRecherche(boite,input){', '\n}\n');
  assert.ok(v.includes('if(input)input.focus({preventScroll:true});'), 'le focus se pose dans le geste (le clavier s’ouvre sur iPhone), sans que le navigateur ne défile');
  assert.ok(v.includes("const sc=boite.closest('.screen');") && v.includes('-lqHautSur()-14;') && v.includes("sc.scrollTo({top:Math.max(0,Math.round(y)),behavior:"), 'c’est l’écran qui défile, jusqu’à 14 px sous la barre d’état');
  assert.ok(cut('function lqHautSur(){', '\n}\n').includes('height:var(--safe-top,0px)'));
  assert.ok(app.includes("const input=document.getElementById('course-search');if(input){lqVersRecherche(tools,input);input.select();}"), '« / » au clavier fait pareil');
  /* Une seule page a le bouton « Explorer » : l’accueil (les autres recherches sont déjà en haut de leur page) */
  assert.equal((app.match(/class="lq-search-toggle"/g) || []).length, 1);
});

test('lqVersRecherche : le défilement qui pose la barre à 14 px sous la barre d’état', () => {
  const pos = []; let focus = null;
  const sc = { scrollTop: 900, getBoundingClientRect: () => ({ top: 0 }), scrollTo: o => pos.push(o) };
  const boite = { closest: () => sc, getBoundingClientRect: () => ({ top: 1300 }) };
  const ctx = vm.createContext({ document: { createElement: () => ({ style: {}, offsetHeight: 59, remove() {} }), body: { appendChild() {} } }, prefersReduceMotion: () => false });
  vm.runInContext(cut('function lqHautSur(){', '\nfunction toggleCatalogTools('), ctx);
  ctx.lqVersRecherche(boite, { focus: o => { focus = o; } });
  const brut = v => JSON.parse(JSON.stringify(v));
  assert.deepEqual(brut(focus), { preventScroll: true });
  assert.deepEqual(brut(pos), [{ top: 900 + 1300 - 59 - 14, behavior: 'smooth' }]);
});

test('la coche « validé » : sans mot, au centre de la chose touchée, comme la punaise ; une poubelle pour une suppression', () => {
  const d = cut('function lqDone(el,label,say){', '\n}\n');
  assert.ok(!d.includes('<b>${esc(label)}</b>') && !d.includes('b.right-6'), 'plus de mot, plus de place au coin');
  assert.ok(d.includes('const p0=lqCentreDe(el);if(!p0)return;'), 'au centre');
  assert.ok(d.includes('<i class="lq-done-onde"></i><i class="lq-done-eclats"><b></b><b></b><b></b><b></b></i><span class="lq-done-pastille">${suppr?LQ_POUBELLE_SVG:CHECK_SVG}</span>'), 'l’onde et les quatre éclats de la punaise');
  assert.ok(d.includes('lqSay(say||label);'), 'le lecteur d’écran entend toujours la phrase');
  const ctx = vm.createContext({ document: {}, innerHeight: 852 });
  vm.runInContext(cut('function lqEstSuppr(label){', '\nfunction lqDone('), ctx);
  for (const l of ['Supprimé', 'Supprimée', 'Effacé', 'Retirée', 'Vidé']) assert.equal(ctx.lqEstSuppr(l), true, l);
  for (const l of ['Enregistrée', 'Créée', 'À jour', 'Prête', 'Ajoutée', 'Réinitialisée', 'Restaurée']) assert.equal(ctx.lqEstSuppr(l), false, l);
  const carte = { tagName: 'DIV', getBoundingClientRect: () => ({ left: 20, top: 100, width: 350, height: 200, bottom: 300 }) };
  assert.deepEqual({ ...ctx.lqCentreDe(carte) }, { x: 195, y: 200 }, 'le centre de la carte');
  const longue = { tagName: 'DIV', getBoundingClientRect: () => ({ left: 0, top: 700, width: 390, height: 600, bottom: 1300 }) };
  assert.equal(ctx.lqCentreDe(longue).y, 776, 'au centre de ce qu’on en voit');
  for (const r of ['html.lq .lq-done{position:fixed;z-index:9500;width:0;height:0;pointer-events:none}', '@keyframes lqDone{', '@keyframes lqDoneOnde{', '@keyframes lqDoneEclat{',
    'html.lq .lq-done.is-suppr .lq-done-pastille{background:#FFE4E6;color:#C2283C}', '@keyframes lqPbCouv{'])
    assert.ok(lq.includes(r), r);
  assert.ok(!lq.includes('transform:translate(-100%,-50%)'), 'plus de pastille accrochée au coin');
});

test('la nouvelle version arrive sur les iPhone', () => {
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=249">'));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-08-reactions-chaine-v2696';") && app.includes("const SW_CACHE='requete-2026-11-08-reactions-chaine-v2696';"));
});
