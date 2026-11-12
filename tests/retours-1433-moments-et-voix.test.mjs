/* Elisa, 12 novembre, 14 h 31 puis 14 h 33 : « T’as des idées ? » sur la vidéo du cours et ses moments « À toi », puis « Tous, en cohérence
   avec les voix ». Ce qui existait déjà reste tel quel (« Bien vu ! » et « Bien rattrapé ! », l’indice après deux erreurs, les badges de la
   barre, le bilan de fin). Ce qui s’ajoute ne dit rien que la voix ne dise pas :
   - l’image descend vers la feuille quand un grand vide les sépare (lvPkAir) ;
   - le chat, derrière le bord haut de la feuille, suit la voix : consigne, « Bien vu ! », « Pas tout à fait… », indice (lvPkCat) ;
   - « 3 d’affilée » à côté de « Bien vu ! » (lvPkSerie) ;
   - le point doré du prochain moment bat pendant ses cinq dernières secondes (lvSoon) ;
   - « Continuer » : une onde part du bouton lecture (lvResumeCue). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i > 0, `repère : ${a}`); const j = html.indexOf(b, i); assert.ok(j > i, `repère : ${b}`); return html.slice(i, j); };
const bloc = cut('const LV_PK_AIR=120', '/* Pendant un moment « À toi », la légende de l’image');

function air() {
  const ctx = vm.createContext({Math});
  vm.runInContext('const LV_PK_GAP=18;' + cut('const LV_PK_AIR=120', '/* Elisa, 1er novembre, 23 h 46 (réf. 2)'), ctx);
  return (P, yb, top, oy = 0) => { ctx.P = P; return vm.runInContext(`lvPkAir(P,${oy},${yb},${top})`, ctx); };
}

test('le vide entre l’image et la feuille : l’image descend de la moitié de l’écart, 160 px au plus, et seulement au-delà de 120 px', () => {
  const f = air();
  assert.equal(f({zoom: 1}, 330, 700), 160, 'iPhone 15, premier moment : 370 px de vide, descente plafonnée');
  assert.equal(f({zoom: 1}, 400, 600), 91, '200 px de vide : (200 − 18) / 2');
  assert.equal(f({zoom: 1}, 500, 619), 0, '119 px : rien ne bouge');
  assert.equal(f({zoom: 1}, 500, 518), 0, 'la feuille au ras du contenu : rien');
  assert.equal(f({zoom: .8}, 500, 520), 51, 'le contenu réduit laisse de la place : mesuré à sa taille (bas à 400)');
});

test('la descente ne bat pas à chaque essai : reprise au-delà de 28 px d’écart, ou quand la feuille la rattrape', () => {
  const f = air(), P = {zoom: 1};
  assert.equal(f(P, 400, 600), 91);
  assert.equal(f(P, 400, 570), 91, 'l’explication s’ajoute (feuille 30 px plus haut) : l’image ne bouge pas');
  assert.equal(f(P, 400, 500), 0, 'la feuille monte de 100 px : moins de 120 px de vide, l’image remonte');
  const Q = {zoom: 1};
  assert.equal(f(Q, 300, 700), 160);
  assert.equal(f(Q, 300, 470), 76, 'feuille montée de 230 px : la moitié du nouvel écart');
  const R = {zoom: 1, air: 20};
  assert.equal(f(R, 400, 430), 12, 'petite descente rattrapée par la feuille : 18 px gardés entre le contenu et elle');
});

function lecteur() {
  const frame = {style: {}}, stage = {getBoundingClientRect: () => ({left: 0, top: 0, width: 390, height: 660})};
  const calls = {layer: 0};
  const ctx = vm.createContext({
    Math, parseFloat, performance: {now: () => 0}, cancelAnimationFrame() {}, requestAnimationFrame() { return 1; }, prefersReduceMotion: () => true,
    lvPkLayerPlace: () => { calls.layer++; },
    LV: {root: {querySelector: () => stage, getBoundingClientRect: () => ({left: 0, top: 0, width: 390, height: 760})}, video: {videoWidth: 1080, videoHeight: 1920, frame}},
  });
  vm.runInContext(cut('function lvPt(X,Y,raw){', 'function lvNotePlace(){') + cut('function lvZoomTo(z,dy){', '/* 12 novembre, 14 h 33 (« le chat réagit »)'), ctx);
  return {ctx, frame, calls, run: c => vm.runInContext(c, ctx)};
}

test('l’image descend et se réduit d’un même geste ; tout ce qui se pose dessus suit ; elle retrouve sa place à la fermeture', () => {
  const p = lecteur();
  const y0 = p.run('lvPt(540,600).y');
  p.run('lvZoomTo(1,120)');
  assert.equal(p.frame.style.transform, 'translateY(120.0px)');
  assert.equal(p.run('lvPt(540,600).y'), y0 + 120, 'zones tactiles, étiquette qui vole, gerbe : 120 px plus bas');
  assert.equal(p.run('lvPt(540,600,1).y'), y0, 'la place de la feuille se mesure sans la descente');
  assert.ok(p.calls.layer >= 1, 'les zones tactiles sont replacées');
  p.run('lvZoomTo(.9,40)');
  assert.equal(p.frame.style.transform, 'translateY(40.0px) scale(0.9000)');
  assert.equal(p.frame.style.transformOrigin, '50% 0');
  p.run('lvZoomTo(1)');
  assert.equal(p.frame.style.transform, '', 'fermeture : ni réduction ni descente');
  assert.equal(p.run('LV.shift'), 0);
  const fit = cut('function lvPkFit(P,settled){', 'const LV_PK_AIR=120');
  assert.ok(fit.includes('const dy=lvPkAir(P,oy,yb,top);\n  lvZoomTo(P.zoom,dy);'), 'réglée avec la taille, à chaque mesure');
  assert.ok(fit.includes('P.zoom=null; P.air=null;'), 'écran tourné ou redimensionné : tout est repris');
  assert.ok(cut('function lvPkClose(answered){', 'function lvOpShow(i,o){').includes('lvZoomTo(1);'));
});

test('le chat suit la voix, sans rien dire : consigne, « Bien vu ! », « Pas tout à fait… », indice', () => {
  const names = bloc.match(/const LV_PK_CATS=\{([^}]+)\}/)[1].match(/[a-z]+(?=:\[)/g);
  assert.deepEqual(names, ['presente', 'oui', 'loupe', 'eureka']);
  for (const n of names) for (const s of ['', '-fixe']) assert.ok(fs.existsSync(path.join(root, `assets/chat-${n}${s}.webp`)), `assets/chat-${n}${s}.webp`);
  const show = cut('function lvPkShow(i,p){', 'function lvPkValid(P,first,anim){');
  assert.ok(show.includes("if(kept)lvPkCat(P,'oui',true); else lvPkCat(P,P.hinted?'eureka':'presente');"), 'à l’ouverture, pendant « À toi ! … » ; déjà fait : oui, image fixe');
  assert.ok(show.indexOf('lvVoiceSay(V.picks[i])') < show.indexOf("lvPkCat(P,'oui',true)"), 'juste après la consigne');
  assert.ok(html.includes("if(LV&&LV.pk&&typeof lvPkCat==='function'){ lvPkCat(LV.pk,'oui'); if(first)lvPkSerie(LV.pk); } }"), '« Bien vu ! », « Bien rattrapé ! » : oui de la tête');
  assert.ok(html.includes("function lvVoiceKo(P){ if(P&&typeof lvPkCat==='function')lvPkCat(P,P.hinted?'eureka':'loupe');"), '« Pas tout à fait. Lis l’explication… » : la loupe ; l’indice : l’idée');
  const cat = cut('function lvPkCat(P,nom,calme){', 'function lvPkCatFit(P,gap){');
  assert.ok(cat.includes("c.setAttribute('aria-hidden','true')") && !/textContent|bulle|<p|<b/.test(cat), 'aucun texte, aucune bulle : c’est la formatrice qui parle');
  assert.ok(cat.includes("still=calme||prefersReduceMotion()||(typeof mascotReduced==='function'&&mascotReduced())") && cat.includes("${still?'-fixe':''}.webp"), 'mouvements réduits : l’image fixe');
  assert.ok(cat.includes('if(first||still||!c.animate){ set(); return; }') && cat.includes('P.catT=setTimeout(set,170);'), 'il plonge, change de geste derrière la feuille, remonte');
  assert.ok(bloc.includes("c.classList.toggle('is-off',!(gap>=84)); c.classList.toggle('is-mini',gap<150);"), 'pas de place au-dessus de la feuille : il ne couvre jamais le contenu');
  assert.ok(html.includes("if(typeof lvPkCatFit==='function')lvPkCatFit(P,top-(oy+(yb-oy)*P.zoom)-dy);"));
  assert.ok(/\.lv-pk-cat\{position:absolute;z-index:-1;[^}]*pointer-events:none/.test(html), 'derrière la carte, jamais sous le doigt');
  assert.ok(html.includes('.lv-pk .lv-pk-cat.is-off{opacity:0;'));
  assert.ok(html.includes('LV_PK_CAT_IMG=Object.keys(LV_PK_CATS).map(') && html.includes('if(g>=0)lvPkCatLoad();'), 'images chargées avant le moment : pas de flash');
});

test('« 3 d’affilée » : à partir de deux moments de suite réussis du premier coup, à côté de « Bien vu ! »', () => {
  const mk = ans => {
    const added = [];
    const ok = {parentNode: {insertBefore: (el, ref) => added.push({el, ref})}, nextSibling: 'après'};
    const ctx = vm.createContext({
      LV: {id: 'L'}, lvPkGet: (id, j) => ans[j] || null, prefersReduceMotion: () => true,
      document: {createElement: () => ({className: '', innerHTML: ''})},
    });
    vm.runInContext(cut('function lvPkSerie(P){', '/* Le moment approche'), ctx);
    const P = {i: ans.length - 1, box: {querySelector: s => s === '.lv-pk-ok' ? ok : null}};
    ctx.P = P; vm.runInContext('lvPkSerie(P)', ctx);
    return {added, P};
  };
  assert.equal(mk([{first: 1}]).added.length, 0, 'un seul : rien');
  const two = mk([{first: 0}, {first: 1}, {first: 1}]);
  assert.equal(two.added.length, 1);
  assert.equal(two.added[0].el.innerHTML, '<b>2</b> <span>d’affilée</span>');
  assert.equal(two.added[0].ref, 'après', 'juste après « Bien vu ! »');
  assert.equal(mk([{first: 1}, {first: 1}, {first: 1}, {first: 1}]).P.serie, 4);
  assert.equal(mk([{first: 1}, {first: 1}, {first: 0}, {first: 1}]).added.length, 0, 'une erreur remet le compte à zéro');
  assert.equal(mk([{first: 1}, null, {first: 1}]).added.length, 0, 'un moment pas fait aussi');
  assert.ok(html.includes('@media (max-width:359px){.lv-pk-serie span{display:none}.lv-pk-serie b::before{content:"×"}}'), 'écran étroit : « ×3 »');
});

test('le moment approche : son point doré bat pendant les cinq dernières secondes, rien d’écrit', () => {
  const mk = ({t, paused = false, pk = null, seeking = false, done = []}) => {
    const marks = [0, 1, 2].map(() => { const set = new Set(); return {classList: {toggle: (c, on) => on ? set.add(c) : set.delete(c)}, set}; });
    const ctx = vm.createContext({
      lvPkGet: (id, i) => done.includes(i) ? {first: 1} : null, lvPkCatLoad() { ctx.loaded = true; },
      LV: {id: 'L', pk, seeking, video: {paused, currentTime: t, picks: [{t: 60}, {t: 100}, {t: 200}]}, root: {querySelectorAll: () => marks}},
    });
    vm.runInContext(cut('const LV_SOON=5;', '/* « Continuer » : la lecture reprend'), ctx);
    vm.runInContext('lvSoon()', ctx);
    return {soon: ctx.LV.soon == null ? -1 : ctx.LV.soon, marks: marks.map(m => m.set.has('is-soon')), loaded: !!ctx.loaded};
  };
  assert.deepEqual(mk({t: 54}).marks, [false, false, false], 'six secondes avant : rien');
  const a = mk({t: 56});
  assert.deepEqual(a.marks, [true, false, false]);
  assert.ok(a.loaded, 'les images du chat se chargent à ce moment-là');
  assert.deepEqual(mk({t: 97, done: [1]}).marks, [false, false, false], 'moment déjà fait : pas d’annonce');
  assert.deepEqual(mk({t: 197}).marks, [false, false, true]);
  assert.equal(mk({t: 56, paused: true}).soon, -1, 'en pause : rien');
  assert.equal(mk({t: 56, pk: {}}).soon, -1, 'pendant un moment : rien');
  assert.equal(mk({t: 56, seeking: true}).soon, -1, 'en glissant : rien');
  assert.ok(html.includes('lvNoteSync(); lvCapSync(); ileMaj(false); lvSoon();'), 'suivi à chaque image de la lecture');
  assert.ok(html.includes("${m.i===LV.soon?' is-soon':''}"), 'la barre redessinée garde le battement');
  assert.ok(html.includes('.lv-pkm i.is-soon{animation:lvPkmSoon .9s ease-in-out infinite}') && html.includes('@media (prefers-reduced-motion:reduce){.lv-pkm i.is-soon{animation:none;transform:scale(1.35)}}'));
});

test('« Continuer » : la lecture reprend, une onde part du bouton lecture', () => {
  assert.ok(html.includes("box.querySelector('.lv-pk-go').addEventListener('click',()=>{ lvPkClose(true); if(!lvRedoNext(i)){ lvPlay(); lvResumeCue(); } });"));
  const cue = cut('function lvResumeCue(){', '/* Pendant un moment « À toi », la légende de l’image');
  assert.ok(cue.includes('prefersReduceMotion()') && cue.includes("root.classList.add('is-resume')") && cue.includes("root.classList.remove('is-resume'),950"));
  assert.ok(html.includes('.lv.is-resume .lv-c.lv-pp::after{content:"";position:absolute;inset:-3px;border-radius:50%;border:3px solid #fff;pointer-events:none;animation:lvResume .9s ease-out both}'));
});

test('rien d’ajouté que la voix ne dise pas : ni phrase nouvelle, ni « bientôt »', () => {
  const tout = bloc + cut('/* 12 novembre, 14 h 33 : le chat derrière le bord haut', '.lv-pk.is-busy');
  assert.ok(!/bient[oô]t|prochainement/i.test(tout));
  const textes = [...tout.matchAll(/(?:innerHTML|textContent)=`([^`]*)`/g)].map(m => m[1].replace(/<[^>]+>|\$\{[^}]+\}/g, '').trim()).filter(Boolean);
  assert.deepEqual(textes, ['d’affilée'], 'seul texte ajouté : le compte « n d’affilée »');
});
