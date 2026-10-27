/* La fin d’un module (Elisa, 27 octobre, 12 h 40 : « pour la fin de module, une félicitation, passer au nouveau module en gros, avec
   une animation waouh, du son, et tout bien réfléchi »).
   Une seule fois, quand le module vient d’être terminé (son sticker vient d’être gagné pendant la leçon), par-dessus le bilan :
   la récompense (le sticker du module se plaque au centre, « Bravo ! », le chemin des quinze modules), puis « Débloquer le module 5 » :
   la carte du module suivant tombe, verrouillée, le cadenas saute, elle se retourne ; « Commencer le module 5 » ou « Voir mon bilan ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cut = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, `extrait introuvable : ${from}`);
  return html.slice(a, b);
};
const code = cut('const MU_SEEN=new Set();', '/* Les autres actions, en tuiles égales');

function bac(done = []){
  const MODULES = [
    {titre: 'Introduction', sous: 'Bases', lessons: [{id: 0}, {id: 1}]},
    {titre: 'Lire une table', sous: 'SELECT', lessons: [{id: 2}, {id: 3}]},
    {titre: 'Agrégats et regroupements', sous: 'Calculer, regrouper et agréger', lessons: [{id: 4}]},
    {titre: 'Jointures', sous: 'Interroger plusieurs tables à la fois', lessons: [{id: 5}, {id: 6}, {id: 7}]}
  ];
  const ctx = vm.createContext({
    MODULES, STK_MODULE_IDS: ['intro', 'lire', 'agregats', 'jointures'],
    itemDone: id => done.includes(id), esc: s => String(s),
    stkArtHtml: (id, mode) => `<span class="stk-art" data-id="${id}" data-mode="${mode}"></span>`
  });
  vm.runInContext(code, ctx);
  return ctx;
}

test('le module à débloquer : le suivant pas terminé, sinon le premier qui reste ; rien s’il ne reste rien', () => {
  const {muNext} = bac();
  const ok = set => k => set.includes(k);
  assert.equal(muNext(2, 4, ok([0, 1, 2])), 3, 'le suivant');
  assert.equal(muNext(1, 4, ok([0, 1, 2])), 3, 'le suivant déjà fini (modules dans le désordre) : celui d’après');
  assert.equal(muNext(3, 4, ok([1, 2, 3])), 0, 'le dernier : on revient au premier qui reste');
  assert.equal(muNext(2, 4, ok([0, 1, 2, 3])), -1, 'tout est fini : la fin du parcours a sa vidéo et sa carte');
});

test('l’écran : la récompense du module terminé, le chemin des modules, la carte verrouillée du suivant, deux boutons', () => {
  const h = bac([0, 1, 2, 3, 4]).moduleUpHtml(2, 3);
  assert.ok(h.startsWith('<div class="mu" role="dialog" aria-modal="true" aria-labelledby="mu-h">'));
  assert.ok(h.includes('<span class="mu-kick" id="mu-k">Module 3 terminé</span>'));
  assert.ok(h.includes('<div class="mu-st mu-done"><span class="stk-art" data-id="agregats" data-mode="art"></span></div>'), 'le sticker gagné, en couleur');
  assert.ok(h.includes('<h2 class="mu-h" id="mu-h" tabindex="-1">Bravo&nbsp;!</h2>') && h.includes('Tu as terminé le module <b>Agrégats et regroupements</b>.'));
  assert.ok(h.includes('<span class="mu-pips"><i class="on"></i><i class="on"></i><i class="cur"></i><i class="nx"></i></span>'), 'les modules faits, celui qui vient d’être terminé, le suivant');
  assert.ok(h.includes('aria-label="3 modules terminés sur 4"') && h.includes('<small><b>3</b> / 4 modules</small>'));
  assert.ok(h.includes('<div class="mu-back"><span class="mu-lock">') && h.includes('<b>Module 4</b></div>'), 'le dos : verrouillé');
  assert.ok(h.includes('<div class="mu-front"><small>Module</small><b class="mu-num">4</b><span class="mu-t">Jointures</span><span class="mu-n">3 leçons</span></div>'), 'la face : le numéro, le nom, les leçons');
  assert.ok(h.includes('<span class="mu-go-l">Débloquer le module 4</span>') && h.includes('<button type="button" class="mu-later">Voir mon bilan</button>'));
  assert.ok(h.includes('class="mu-x" aria-label="Fermer et voir mon bilan"') && h.includes('<p class="mu-sr" aria-live="polite"></p>'));
});

test('une seule fois, au bilan de la leçon qui termine le module ; jamais sans module suivant', () => {
  assert.ok(cut('function renderLessonFlow(){', '/* ---------- Requête à trous').includes('setTimeout(moduleUpCheck,250);'), 'branché au bilan');
  const check = cut('function moduleUpCheck(){', 'function moduleUpHtml(i,n){');
  assert.ok(check.includes("if(MU||mode!=='lesson'||lessonStep!==3"), 'seulement au bilan d’une leçon');
  assert.ok(check.includes("stkLessonNew.map(stkInfo).find(x=>x&&x.kind==='module'&&!MU_SEEN.has(x.id))") && check.includes('MU_SEEN.add(s.id);'),
    'le sticker du module vient d’être gagné pendant la leçon (une fois par module : un sticker se gagne une fois)');
  assert.ok(check.includes('if(n<0)return;'));
  assert.ok(html.includes("#lesson-video.on,[id$=\"-back\"].on,.plus-details[open],.mu');"), 'pas de retour par glissement pendant l’écran');
});

test('le déroulé : impact à l’arrivée, puis l’élève débloque (le son part de son appui), la carte se retourne, l’écran final', () => {
  const open = cut('function moduleUpOpen(i,n){', 'function moduleUpGo(){');
  for (const part of ["el.classList.add('is-a')", 'muImpact(el,false);', 'lqConfetti({n:60});', "muSound([[0,'stamp',0,.8],[110,'chord',0,.5]]);", 'navigator.vibrate([18,30,10])'])
    assert.ok(open.includes(part), part);
  assert.ok(open.indexOf('if(prefersReduceMotion()){ moduleUpFinal(true);') < open.indexOf('muImpact('), 'mouvement réduit : l’écran final, d’emblée');
  const unlock = cut('function moduleUpUnlock(){', 'function moduleUpFinal(instant){');
  assert.ok(unlock.includes("[1210,'success',0,.65]") && unlock.includes("[1560,'chord',0,.5]],true);"), 'les sons de l’appui, forcés (on est dans l’appui)');
  for (const part of ["el.classList.add('is-card')", "el.classList.add('is-unlock')", "el.classList.add('is-open');", 'muImpact(el,true);', 'lqConfetti({n:90});', "c.className='mu-comet'", "nx.classList.add('is-on')", 'moduleUpFinal(false)'])
    assert.ok(unlock.includes(part), part);
  const sound = cut('function muSound(seq,force){', 'function muImpact(el,big){');
  assert.ok(sound.includes('LV_MUTED') && sound.includes('if(!force&&!(ua&&ua.isActive))return;') && sound.includes('LvSfx.resume();'), 'muet respecté ; sans appui, pas de son');
  const fin = cut('function moduleUpFinal(instant){', '/* Lien « ?apercu=fin-module »');
  assert.ok(fin.includes('`Module ${n+1} débloqué`') && fin.includes("'C’est parti&nbsp;!'") && fin.includes('`Commencer le module ${n+1}`') && fin.includes('MU_PLAY'));
  const start = cut('function moduleUpStart(){', 'function moduleUpClose(instant){');
  assert.ok(start.includes('N.lessons.find(l=>!itemDone(l.id))||N.lessons[0]') && start.includes('openItem(first.id);'), 'la première leçon à faire du module');
  const close = cut('function moduleUpClose(instant){', '/* Les autres actions');
  assert.ok(close.includes('LvSfx.release()') && close.includes('timers.forEach(clearTimeout);'), 'la session audio est rendue, rien ne reste en attente');
});

test('l’animation : chute du sticker, onde, rayons, carte qui se retourne, pastilles ; mouvement réduit respecté', () => {
  for (const part of ['@keyframes muSlam{', '.mu.is-a .mu-done{animation:muSlam', '.mu.is-open .mu-card-in{transform:rotateY(180deg)}', '.mu.is-unlock .mu-back .mu-shk{transform:translateY(-3px) rotate(-34deg)}',
    '.mu.is-card .mu-card{opacity:1;animation:muCardIn', '.mu.is-open .mu-rays::after{opacity:1}', '.mu.is-a .mu-pips i.cur{animation:muPip', '.mu-pips i.nx.is-on{', '.mu.is-ready:not(.is-b) .mu-go::after{animation:lvRing',
    '.mu.is-still,.mu.is-still *,.mu.is-still *::before,.mu.is-still *::after{animation:none!important;transition:none!important}'])
    assert.ok(html.includes(part), part);
  assert.ok(html.includes('apercuFromUrl();') && cut('function apercuFromUrl(){', 'function moduleUpStart(){').includes("q.get('apercu')!=='fin-module'"), 'un lien d’aperçu, sans toucher à la progression');
});
