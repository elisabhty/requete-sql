/* Elisa, 15 novembre, 11 h 18 : « Est-ce que tu as fait la même chose pour les vidéos en français ? Donc améliore, regarde que ça
   déborde pas. Mets des haptiques, des vibrations. »
   - Les débordements : une revue des 71 vidéos, image par image (toutes les 0,7 s), en français puis en anglais. Un texte compte comme
     débordant quand son étendue réelle (Range) sort d'un parent qui coupe, de sa carte ou de la scène, sur au moins deux images.
     En français : rien à corriger (les tableaux qui défilent exprès, les pages de factures qui glissent, le commentaire tronqué par
     ses points de suspension et le tampon « Places limitées » posé à cheval sur sa carte sont voulus). En anglais : six vidéos des
     modules 8 à 11 avaient un mot trop long pour sa colonne (Healthy cooking, customer_id et son badge UNIQUE, enrolled on, la chaîne
     de la 2NF) ; une règle html[lang="en"] les fait tenir, le français ne bouge pas.
   - Les vibrations : pendant la lecture, les temps forts de l'image vibrent avec leur son (lvHapt) ; l'étiquette qu'on soulève dans un
     moment « À toi » donne un cran. Les réponses de l'élève vibraient déjà (réussite, erreur, curseur, ouverture d'un moment). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');

function hapt() {
  const debut = app.indexOf('const LV_HAPT='), fin = app.indexOf('function lvConfetti(frame,c){');
  assert.ok(debut > 0 && fin > debut, 'lvHapt est juste avant lvConfetti');
  const coups = [], ctx = {navigator: {vibrate: p => { coups.push(Array.isArray(p) ? [...p] : p); return true; }}, Date: {now: () => ctx.t}, t: 10000};
  vm.runInNewContext(app.slice(debut, fin) + '\nthis.lvHapt = lvHapt;', ctx);
  return {ctx, coups};
}

test('pendant la lecture, chaque son de la vidéo passe aussi par lvHapt, après le son', () => {
  assert.ok(app.includes("else{ LvSfx.play(c.type,c.pitch||0,c.gain==null?1:c.gain,.36*Math.sin(this.ci*2.399)); lvHapt(c.type); }"));
  /* seulement les repères franchis en avançant : un retour en arrière ne rejoue ni son ni vibration */
  assert.ok(app.includes('while(this.ci<this.cues.length&&this.cues[this.ci].t<=t){ const c=this.cues[this.ci]; if(c.t>this.t){'));
});

test('les vibrations de la vidéo : un bouton appuyé, un message qui arrive, une réussite, une erreur ; jamais la frappe', () => {
  const {ctx, coups} = hapt();
  const un = (type, dt = 1000) => { ctx.t += dt; const n = coups.length; ctx.lvHapt(type); return coups.length > n ? coups[coups.length - 1] : null; };
  assert.equal(un('click'), 8);
  assert.equal(un('mail'), 14); assert.equal(un('sms'), 14);
  for (const t of ['true', 'chord', 'success']) assert.deepEqual(un(t), [10, 60, 20], t);   // la réussite d'iOS (notification SUCCESS)
  for (const t of ['error', 'buzz']) assert.deepEqual(un(t), [16, 60, 16], t);   // l'avertissement d'iOS (WARNING), plus doux que l'erreur de l'élève
  for (const t of ['tick', 'pop', 'whoosh', 'type', 'fold', 'miss', 'confetti']) assert.equal(un(t), null, t);
  /* pas d'empilement : 0,2 s entre deux vibrations, 0,4 s entre deux réussites */
  assert.equal(un('click'), 8); assert.equal(un('click', 150), null); assert.deepEqual(un('chord', 100), [10, 60, 20]);
  assert.equal(un('success', 300), null); assert.deepEqual(un('success', 200), [10, 60, 20]);
  /* le motif d'avertissement donne bien WARNING dans l'appli iOS (le pont navigator.vibrate → Haptics) */
  assert.ok(app.includes("type:p[0]>=15&&p[2]>=15&&p[0]===p[2]?(p[1]>=60&&p[0]<20?'WARNING':'ERROR'):'SUCCESS'"));
});

test('dans un moment « À toi », l’étiquette soulevée sous le doigt donne un cran ; les réponses vibrent toujours', () => {
  assert.ok(app.includes("      LvSfx.play('pop',3,.4,0);\n      if(navigator.vibrate)navigator.vibrate(6);"));
  assert.ok(app.includes("if(navigator.vibrate)navigator.vibrate([10,60,20]);") && app.includes("if(navigator.vibrate)navigator.vibrate([20,60,20]);"));
});

test('les débordements anglais des modules 8 à 11 : une règle html[lang="en"] par vidéo, le français garde sa mise en page', () => {
  for (const [c, regle] of [['projet-cles', 'html[lang="en"] #ta-at .r .c1{font-size:24px}'], ['projet-insert', 'html[lang="en"] #sc2 .r .c1{font-size:23px}'],
    ['projet-ondelete', 'html[lang="en"] #tav, html[lang="en"] #kv, html[lang="en"] #wi{--g:84px 216px 200px 96px 1fr!important}'],
    ['projet-create', 'html[lang="en"] #p-ca .ar{font-size:25px}'], ['projet-uml', 'html[lang="en"] #cb-ca .ar{font-size:25px}'],
    ['projet-normaliser', 'html[lang="en"] .xr{grid-template-columns:184px 206px 88px 192px 204px 122px}']]) {
    const pg = lire(`assets/anim/${c}.html`);
    assert.ok(pg.includes(regle), `${c} : ${regle}`);
    /* la règle est dans la feuille de style de la page, et ne vise que l'anglais */
    const style = pg.slice(pg.indexOf('<style'), pg.indexOf('</style>'));
    assert.ok(style.includes(regle), c);
  }
  assert.ok(lire('assets/anim/projet-normaliser.html').includes('html[lang="en"] .fxr .cel{font-size:22px;padding:0 12px}'), 'la chaîne de la 2NF tient dans sa carte');
});
