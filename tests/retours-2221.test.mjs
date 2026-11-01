/* Elisa, 1er novembre, 22 h 21 : « étiquette coincée » (réf. 2, la leçon Les schémas). Une étiquette glissée restait suspendue au-dessus
   de l’image quand elle perdait le pointeur en route (capture perdue, fenêtre qui perd la main) : la fin du geste ne venait jamais.
   Rejoué dans Chromium (glisser, capture perdue ; glisser, fenêtre qui perd la main) : une copie restait avant, plus aucune après. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const glisse = app.slice(app.indexOf('function lvGlisse(el,can,slop,on){'), app.indexOf('function lvPkLink(P,a,b){'));
const drag = app.slice(app.indexOf('function lvPkDrag(P,btn,zonesFn,onDrop){'), app.indexOf('function lvPkRubber(P,a){'));

test('réf. 2 : un glisser finit toujours, même si l’étiquette perd le pointeur', () => {
  assert.ok(glisse.includes("['pointerup','pointercancel','touchend','touchcancel'].forEach(t=>w[m](t,f.up,true)); w[m]('blur',f.out);"), 'la fenêtre finit le geste');
  assert.ok(glisse.includes("if(d&&typeof d[m]==='function')d[m]('visibilitychange',f.vis);"), 'onglet caché : le geste s’annule');
  assert.ok(glisse.includes("el.addEventListener('lostpointercapture',()=>{ if(g&&g.on&&g.id==null)stop(false); });"), 'capture perdue : l’étiquette se pose là où elle est');
  assert.ok(glisse.includes("g.on=true; drag(true); filet(true);") && glisse.includes("if(G&&G.on){ filet(false);"), 'le filet ne sert que pendant le geste');
  assert.ok(glisse.includes("(g.id!=null)!==e.type.startsWith('touch')") && glisse.includes('[...e.changedTouches].some(t=>t.identifier===g.id)'), 'un geste au doigt ne finit que par son doigt');
});

test('réf. 2 : la copie qui suit le doigt s’en va toujours, même si son animation ne finit pas', () => {
  assert.ok(drag.includes('setTimeout(()=>f.remove(),420);'), 'posée : la copie s’efface');
  assert.ok(drag.includes("const back=()=>{ f.remove(); btn.classList.remove('is-lift'); };") && drag.includes('setTimeout(back,380);'), 'revenue : l’étiquette redevient libre');
});
