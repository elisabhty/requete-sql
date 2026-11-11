/* Elisa, 11 novembre, 20 h 26 : « Quand on vient pour la première fois sur l’appli, après quelques secondes, on a lancé la page
   nouveau sticker (1re requête, à cause de l’onboarding), donc du coup n’apparaît pas dans module terminé base relationnelle. »
   Son choix : « Le donner à l’arrivée ». La requête d’essai réussie dans l’onboarding est la première requête : quelques secondes
   après l’arrivée, « Nouveau sticker · Première requête » ; le bilan de la première leçon ne montre plus que le sticker du module.
   Vérifié dans un navigateur : avec l’essai, la notification à +2,6 s (devant la page de départ de la leçon, au-dessus de
   « Commencer »), puis « Module 1 terminé » et « Module terminé · Nouveau sticker · Introduction » ; sans l’essai, comme avant :
   « 2 nouveaux stickers · Introduction · Première requête » à la fin de la leçon. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => cut(`function ${name}(`, '\n}\n') + '\n}\n';
/* La dernière définition gagne (finishOnboard est défini deux fois) */
const derniere = name => { const i = app.lastIndexOf(`function ${name}(`); return app.slice(i, app.indexOf('\n}\n', i) + 3); };

test('la règle : la requête d’essai de l’onboarding, sinon une leçon ou un défi', () => {
  const ligne = cut("{id:'requete',", '\n');
  assert.ok(ligne.includes('now:ev.requete||st.lessons+st.defis>0?1:0'));
  assert.ok(ligne.includes("how:'Exécute ta première requête\u00a0: l’essai du début, une leçon ou un défi.'"));
});

test('finishOnboard note la requête d’essai réussie, et l’arrivée l’annonce quelques secondes après', () => {
  const f = derniere('finishOnboard');
  assert.ok(f.includes('if(draft.practiceDone){try{const S=stkState();if(!S.ev||typeof S.ev!==\'object\')S.ev={};S.ev.requete=1;}catch(e){}}'));
  assert.ok(f.indexOf('S.ev.requete=1') < f.indexOf('state.onboarded=true;'), 'noté avant la sauvegarde');
  const t = derniere('obTerminer');
  assert.ok(t.includes("if(typeof stkAfterProgress==='function')setTimeout(()=>{try{stkAfterProgress();}catch(e){}},2600);"), 'une fois dans l’app, pas par-dessus la page du pseudo');
});

test('pendant la première leçon, la première requête s’annonce tout de suite ; le reste attend le bilan', () => {
  const ann = [], pages = [], ctx = vm.createContext({ state: { stickers: { got: {}, fresh: {}, board: [], since: 1, ev: { requete: 1 } } }, mode: 'lesson',
    document: { body: { classList: { contains: c => c === 'in-lesson' } } }, stkAnnounce: ids => ann.push([...ids]), stkPageOuvrir: id => pages.push(id) });
  vm.runInContext(fn('stkState') + 'let stkLessonNew=[];' + fn('stkAfterProgress'), ctx);
  ctx.stkSync = () => ['intro', 'requete'];
  ctx.stkAfterProgress();
  assert.deepEqual(pages, ['requete'], 'sa page vient tout de suite (20 h 54 : « C’est pas une page qui vient ? »)');
  assert.deepEqual(ann, [], 'pas de notification en plus');
  assert.deepEqual([...vm.runInContext('stkLessonNew', ctx)], ['intro'], 'le module attend le bilan');
  /* Sans l’essai (ev vide), rien ne change : tout attend le bilan */
  ctx.state.stickers.ev = {}; ann.length = 0; pages.length = 0; vm.runInContext('stkLessonNew=[]', ctx);
  ctx.stkAfterProgress();
  assert.deepEqual(ann, []); assert.deepEqual(pages, []);
  assert.deepEqual([...vm.runInContext('stkLessonNew', ctx)], ['intro', 'requete']);
});

test('la notification passe devant la page de départ d’un cours, juste au-dessus de « Commencer »', () => {
  const l = fn('toastLift');
  assert.ok(l.includes("const lst=document.querySelector('#lesson-start:not(.is-out)'),go=lst&&lst.querySelector('.lst-go');"));
  assert.ok(l.includes("t.classList.add('is-over');t.style.setProperty('--toast-lift',Math.round(window.innerHeight-r.top+14)+'px');"));
  assert.ok(app.includes('.toast.is-over{z-index:125;'), 'devant #lesson-start (z-index 120)');
});

/* 20 h 54 : « C’est pas une page qui vient ? » La page de la fin d’un module, sans le chemin des modules ni le module suivant. */
test('la page d’un accomplissement : le sticker tombe, « Récupérer le sticker », puis « Continuer »', () => {
  const html = fn('stkPageHtml');
  assert.ok(html.includes('<div class="mu mu-acc" role="dialog" aria-modal="true" aria-labelledby="mu-h">'));
  assert.ok(html.includes('<span class="mu-tag">Nouveau sticker</span>') && html.includes('<h2 class="mu-h" id="mu-h" tabindex="-1">Bravo&nbsp;!</h2>'));
  assert.ok(html.includes("id==='requete'?'Ta toute première requête SQL a marché. Voici ton sticker&nbsp;!'"));
  assert.ok(html.includes('Récupérer le sticker') && html.includes('Voir ma collection') && !html.includes('mu-card') && !html.includes('mu-path'));
  const ouvrir = fn('stkPageOuvrir');
  assert.ok(ouvrir.includes("if(MU||(video&&video.classList.contains('on'))||(ob&&ob.classList.contains('on'))){ setTimeout(()=>stkPageOuvrir(id),1500); return; }"), 'une page à la fois : elle attend la fin d’un module, une vidéo, l’onboarding');
  assert.ok(ouvrir.includes('MU={el,acc:id,stage:\'a\',snd:false,timers:[]};') && ouvrir.includes("openStickers(id);"));
  assert.ok(fn('moduleUpGo').includes("if(MU.acc){ if(MU.stage==='a')stkPageCollect(); else if(MU.stage==='c')moduleUpClose(); return; }"));
  const col = fn('stkPageCollect');
  assert.ok(col.includes("muSet(go.querySelector('.mu-go-l'),'Continuer',vite);") && col.includes("'Ton sticker est dans ta collection&nbsp;!'"));
  assert.ok(app.includes('.mu-acc .mu-acts{margin-top:auto}'));
  assert.ok(fn('stkAfterProgress').includes('if(now.length)stkPageOuvrir(now[0]);'));
});
