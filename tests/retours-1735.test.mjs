/* Elisa, 5 novembre, 17 h 35, quatre retours :
   - « Le fond de l’épingle est trop sombre » : épinglée, le bouton restait transparent (la teinte --sun-soft n’était définie nulle
     part) : le gris lavande de la page sous un anneau jaune ; une crème lumineuse maintenant.
   - « Il faut que l’animation du validé sur la console dure un peu plus longtemps car on la voit pas, on est basculé direct vers le
     bas » : le vert dure 2,6 s (1,4 s), l’écran attend 0,65 s avant de descendre, et garde le bouton en haut si le résultat tient dessous.
   - « Quand on appuie sur le bouton Voir les données, ça saute » : la descente native partait d’un coup, deux fois (avant puis après le
     résultat), et la carte ouverte rejouait son apparition sous le doigt. Maintenant : la requête s’exécute tout de suite, puis une seule
     glissade menée par l’appli, douce au départ et à l’arrivée, qui suit l’éditeur image par image.
   - Réf. 2, « est-ce possible d’avoir des icônes plus classe ? » : les lignes de la Bibliothèque (et de Pratiquer) ont une icône fine en
     deux tons, dans une tuile douce de sa couleur.
   Vérifié dans un navigateur (402 px), le défilement suivi image par image, sans l’ancrage que Safari n’a pas. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lq = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => cut(`function ${name}(`, '\n}\n') + '\n}\n';

/* Un écran qui défile, ses écouteurs, et une horloge d’images à la main */
const ecran = (o = {}) => {
  const ec = {};
  return Object.assign({ scrollTop: 0, scrollHeight: 6000, clientHeight: 800, ec,
    getBoundingClientRect: () => ({ top: 0, bottom: 800 }), querySelector: () => ({ getBoundingClientRect: () => ({ bottom: 44 }) }),
    addEventListener: (t, f) => { (ec[t] = ec[t] || []).push(f); }, removeEventListener: (t, f) => { ec[t] = (ec[t] || []).filter(g => g !== f); },
    toucher() { (ec.touchstart || []).slice().forEach(f => f()); } }, o);
};
const horloge = () => {
  const h = { t: 0, file: [] };
  h.ctx = { performance: { now: () => h.t }, requestAnimationFrame: f => { h.file.push(f); return h.file.length; }, cancelAnimationFrame: () => { h.file = []; } };
  h.image = () => { h.t += 16; const f = h.file; h.file = []; f.forEach(g => g(h.t)); };
  return h;
};

test('l’épingle épinglée : une crème claire, plus le gris de la page', () => {
  assert.ok(lq.includes('html.lq{--sun-soft:#FFF8E4}'), 'la teinte existe enfin');
  assert.ok(lq.includes('html.lq #scr-console .console-run-row .console-pin-current.is-icon.on{background:var(--sun-soft)!important;border-color:#FBE6A8!important;box-shadow:0 4px 0 #F6E1A2!important}'));
  /* La règle d’origine, qui comptait déjà sur la teinte, reste plus faible que la nouvelle (même sélecteur, plus loin) */
  assert.ok(lq.indexOf('html.lq{--sun-soft:#FFF8E4}') > lq.indexOf('.console-pin-current.is-icon.on{background:var(--sun-soft)!important;border-color:#FBE5A6'));
});

test('glisserEcran : une seule glissade, douce au départ, qui finit pile sur sa cible, même si elle bouge en route', () => {
  const h = horloge();
  const ctx = vm.createContext({ ...h.ctx, prefersReduceMotion: () => false });
  vm.runInContext(fn('glisserEcran'), ctx);
  const scr = ecran({ scrollTop: 500 });
  let cible = 2100;
  ctx.glisserEcran(scr, () => cible);
  const vus = [];
  for (let i = 0; i < 60 && h.file.length; i++) { h.image(); vus.push(scr.scrollTop); if (i === 20) cible = 2140; }
  assert.equal(scr.scrollTop, 2140, 'elle suit la cible qui a bougé, sans repartir');
  assert.ok(vus.every((v, i) => i === 0 || v >= vus[i - 1]), 'toujours dans le même sens');
  assert.ok(vus[1] - 500 < 40, 'le départ est doux (le défilement natif partait d’un coup)');
  assert.ok(vus.length * 16 <= 740, 'moins de trois quarts de seconde, même sur 1 600 px');
  assert.equal(scr.ec.touchstart.length, 0, 'ses écouteurs s’en vont à l’arrivée');
  /* Un doigt posé l’arrête */
  scr.scrollTop = 0; ctx.glisserEcran(scr, 1500); h.image(); h.image(); h.image();
  const la = scr.scrollTop; scr.toucher(); h.image(); h.image();
  assert.equal(scr.scrollTop, la, 'le doigt l’emporte');
  /* La cible au-delà du bas de la page : le bas de la page */
  const ctx2 = vm.createContext({ ...horloge().ctx, prefersReduceMotion: () => true });
  vm.runInContext(fn('glisserEcran'), ctx2);
  const s2 = ecran({ scrollTop: 10, scrollHeight: 1000, clientHeight: 800 });
  ctx2.glisserEcran(s2, 5000);
  assert.equal(s2.scrollTop, 200, 'sans animation : d’un coup, et pas plus loin que la page');
});

test('Exécuter : le vert dure 2,6 s, l’écran attend 0,65 s, puis descend en gardant le bouton en haut', () => {
  assert.ok(fn('runFeedback').includes("prefersReduceMotion()?1800:2600);"));
  assert.ok(fn('runConsole').includes('if(fb)runFeedback(btn,fb[0],fb[1]); requestAnimationFrame(()=>{if(!surEditeur)return descendreApresValide(out,btn);'));
  /* La descente attend, et un doigt posé entre-temps l’annule */
  const minuteries = [];
  const scr = ecran({ scrollTop: 300 });
  const appels = [];
  const ctx = vm.createContext({ prefersReduceMotion: () => false, setTimeout: (f, ms) => { minuteries.push({ f, ms, on: true }); return minuteries.length; },
    clearTimeout: id => { if (minuteries[id - 1]) minuteries[id - 1].on = false; }, scrollToResult: (o, opt) => appels.push(opt) });
  vm.runInContext(fn('descendreApresValide'), ctx);
  const out = { closest: () => scr };
  const btn = {};
  ctx.descendreApresValide(out, btn);
  assert.equal(minuteries[0].ms, 650);
  minuteries[0].f();
  assert.equal(appels.length, 1); assert.equal(appels[0].garde, btn, 'le bouton est gardé en vue');
  ctx.descendreApresValide(out, btn);
  scr.toucher();
  assert.equal(minuteries[1].on, false, 'touché avant : on ne descend pas');
  /* scrollToResult({garde}) : le bouton en haut, le résultat juste dessous ; trop loin, le résultat en haut */
  const ctx2 = vm.createContext({ ...horloge().ctx, prefersReduceMotion: () => true });
  vm.runInContext(fn('glisserEcran') + fn('scrollToResult'), ctx2);
  const mk = top => ({ getBoundingClientRect: () => ({ top, bottom: top + 30, height: 30 }) });
  const s = ecran({ scrollTop: 300 });
  const meta = mk(700), b2 = mk(560);
  ctx2.scrollToResult({ firstElementChild: meta, closest: () => s, querySelector: () => meta }, { garde: b2 });
  assert.equal(s.scrollTop, 300 + 560 - 56, 'le bouton passé au vert reste sous la barre, le résultat dessous');
  const loin = mk(1400); s.scrollTop = 300;
  ctx2.scrollToResult({ firstElementChild: loin, closest: () => s, querySelector: () => loin }, { garde: b2 });
  assert.equal(s.scrollTop, 300 + 1400 - 56, 'un éditeur très haut : le résultat d’abord');
});

test('« Voir les données » : exécutée tout de suite, une seule glissade, et la carte ouverte ne rejoue plus son apparition', () => {
  const v = fn('voirDonneesTable');
  assert.ok(v.includes("fillConsoleSql(`SELECT * FROM ${quoteIdent(name)}\\nLIMIT 50;`,{reste:true});") && v.includes('runConsole({surEditeur:true,direct:true});'));
  assert.ok(fn('fillConsoleSql').includes("if(!(o&&o.reste))sh?.scrollIntoView("), 'l’écran ne part pas avant le résultat');
  const run = fn('runConsole');
  assert.ok(run.includes('const surEditeur=!!(o&&o.surEditeur),direct=!!(o&&o.direct);'));
  assert.ok(run.includes('if(!direct)out.innerHTML=`<div class="query-loading"'), 'pas d’« Exécution… » qui changerait la page en route');
  assert.ok(run.includes('if(prefersReduceMotion()||direct)finish();'));
  assert.ok(run.includes('if(moved) renderDbWorkspace();') && !/\n\s*renderDbWorkspace\(\);\n\s*\/\* La première table créée ici/.test(run), 'les cartes ne se redessinent que si la requête a changé quelque chose');
  assert.ok(fn('ecranVers').includes('glisserEcran(scr,()=>scr.scrollTop+(el.getBoundingClientRect().top-haut()));'), 'la glissade suit l’éditeur');
  /* La carte : l’apparition seulement quand on l’ouvre */
  assert.ok(fn('toggleTableSchema').includes('tblOuvre=openTableSchema;'));
  const w = cut('function renderDbWorkspace(){', 'function toggleTableSchema(name){');
  assert.ok(w.includes("const ouvre=typeof tblOuvre==='undefined'?null:tblOuvre;") && w.includes("<div class=\"tbl-corps tbu-haut${ouvre===t?' is-ouvre':''}\">") && w.includes('  tblOuvre=null;'));
  assert.ok(lq.includes('html.lq #scr-console .tbl-corps{animation:none}\nhtml.lq #scr-console .tbl-corps.is-ouvre{animation:dbColIn .3s cubic-bezier(.2,.8,.3,1.2) both}'));
});

test('réf. 2 : des icônes fines en deux tons… puis, à 21 h 54, retour aux autocollants (« la même DA que les icônes » de Mon compte)', () => {
  /* Les icônes fines de 17 h 35 sont parties (retours-2154) : chaque ligne a de nouveau son autocollant */
  assert.ok(!app.includes('const JOURNEY_ICO={') && !lq.includes('.journey-tool-icon.is-ico'));
  assert.ok(fn('renderJourneyHub').includes('${journeyToolIcon(kind)}'));
  assert.ok(fn('journeyToolIcon').includes("return `<span class=\"journey-tool-icon${JOURNEY_STK[kind]?' is-stk':''}\">${JOURNEY_STK[kind]?lqStkSvg(JOURNEY_STK[kind]):journeyIcon(kind)}</span>`;"));
  assert.ok(lq.includes('html.lq #app .journey-resource .journey-tool-icon.is-stk{width:54px;height:54px;background:none!important;'));
});
