/* Elisa, 11 novembre, 21 h 11 : « le note supprimé ne le met plus. Enfin, enlève-le de l'application. Ça sera remplacé par, tu vois,
   une micro-interaction vraiment, vraiment fun, vraiment cool. »
   - Plus de toast « Note supprimée » ni d’« Annuler » : la note part à la poubelle (lqCorbeille). Elle se froisse en boulette, une
     petite poubelle rose avec une tête sort à sa place, ouvre le couvercle (bouche en « o »), la boulette part en cloche et tombe
     dedans, le couvercle claque, des confettis sautent, la poubelle sourit, saute et s’en va ; la place de la note se referme.
   - Vibrations au froissage et au claquement ; sons discrets seulement pendant l’appui et si le son du lecteur n’est pas coupé, sans
     la session « lecture » des cours (le bouton silencieux les coupe, la musique d’une autre app continue).
   - La boîte se referme entière (marges intérieures et bordures comprises), ici comme dans lqAdieu : la liste ne saute plus. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const fn = name => { const i = app.indexOf(`function ${name}(`); assert.ok(i >= 0, name); const j = app.indexOf('\n}\n', i); return app.slice(i, j + 3); };
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };

/* Un DOM de poche : assez pour la scène */
function scene({ reduit = false, carteOk = true, son = false } = {}) {
  const log = { anims: [], timers: [], buzz: [], sons: [], ajoute: [], release: 0 };
  const el = (tag) => {
    const e = { tag, style: {}, attrs: {}, kids: [], cls: new Set(), removed: false,
      setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.kids.push(c); return c; }, append(...c) { this.kids.push(...c); },
      remove() { this.removed = true; }, animate(k, o) { log.anims.push({ el: this, k, o }); return {}; } };
    Object.defineProperty(e, 'className', { get() { return [...e.cls].join(' '); }, set(v) { e.cls = new Set(String(v).split(/\s+/).filter(Boolean)); } });
    e.classList = { add: c => e.cls.add(c), remove: c => e.cls.delete(c), contains: c => e.cls.has(c) };
    Object.defineProperty(e, 'innerHTML', { get() { return e._h || ''; }, set(v) { e._h = v; e.firstChild = el('i'); } });
    return e;
  };
  const parent = { display: 'flex', rowGap: '12px' };
  const carte = el('div');
  Object.assign(carte, { isConnected: carteOk, offsetHeight: 121, previousElementSibling: {}, parentElement: parent, getBoundingClientRect: () => ({ left: 18, right: 375, top: 600, bottom: 721, width: 357, height: 121 }), scrollIntoView() {} });
  const body = el('body'); body.appendChild = c => { log.ajoute.push(c); return c; };
  const ctx = vm.createContext({
    innerWidth: 393, innerHeight: 852, Math, Object, String,
    document: { createElement: el, body },
    getComputedStyle: e => e === parent ? parent : { paddingTop: '16px', paddingBottom: '14px', borderTopWidth: '2px', borderBottomWidth: '2px' },
    prefersReduceMotion: () => reduit,
    buzz: k => log.buzz.push(k),
    setTimeout: (f, ms) => { log.timers.push([ms, f]); return log.timers.length; },
    LvSfx: { play: (k, p, g) => log.sons.push(k), release: () => { log.release++; } },
    LV: null, MU: null
  });
  vm.runInContext(cut('const LQC_INK=', 'function lqCorbSon(') + fn('lqCorbeille'), ctx);
  let fini = 0;
  ctx.lqCorbeille(carteOk ? carte : null, () => fini++, { son });
  const fait = new Set();
  const lance = (jusqua = Infinity) => log.timers.filter(t => t[0] <= jusqua && !fait.has(t)).sort((a, b) => a[0] - b[0]).forEach(t => { fait.add(t); t[1](); });
  return { ctx, log, carte, fini: () => fini, lance };
}

test('la poubelle : la note se froisse, la boulette tombe dedans, le couvercle claque, la place se referme', () => {
  const s = scene();
  assert.equal(s.log.ajoute.length, 1, 'une scène, posée sur la page');
  const S = s.log.ajoute[0];
  assert.equal(S.className, 'lq-corb'); assert.equal(S.attrs['aria-hidden'], 'true', 'VoiceOver ne la lit pas');
  const parts = S.kids.map(k => k.className);
  assert.deepEqual(parts.slice(0, 4), ['lqc-p lqc-back', 'lqc-x', 'lqc-p lqc-front', 'lqc-p lqc-lid'], 'la boulette passe entre le fond et le corps : elle tombe vraiment dedans');
  assert.equal(parts.filter(c => /^lqc-s/.test(c)).length, 9, 'neuf confettis');
  assert.ok(S.kids[0]._h.includes('#FF9EC7') && S.kids[2]._h.includes('class="f-wait"') && S.kids[2]._h.includes('class="f-happy"'), 'la poubelle rose et ses trois têtes');
  /* La note : froissée en 260 ms, sa place se referme à la fin, marges intérieures et bordures comprises */
  const c = s.log.anims.find(a => a.el === s.carte);
  assert.equal(c.o.duration, 1800);
  const der = c.k[c.k.length - 1];
  assert.deepEqual([der.height, der.paddingTop, der.paddingBottom, der.borderTopWidth, der.borderBottomWidth, der.marginTop, der.opacity], ['0px', '0px', '0px', '0px', '0px', '-12px', 0]);
  assert.deepEqual([c.k[0].paddingTop, c.k[0].height], ['16px', '121px']);
  assert.ok(Math.abs(c.k.find(k => k.opacity === 0).offset - 260 / 1800) < 1e-9, 'boulette à 260 ms');
  /* Le couvercle s’ouvre, puis claque ; la boulette part en cloche */
  const li = S.kids[3].firstChild, lid = s.log.anims.filter(a => a.el === li);
  assert.deepEqual(lid.map(a => a.o.delay), [330, 810, 1180], 'ouvert, claqué, qui tressaute');
  const y = s.log.anims.find(a => a.el === S.kids[1].kids[0]);
  assert.equal(y.o.delay, 420);
  const ys = y.k.map(k => +k.transform.match(/-?[\d.]+/)[0]);
  assert.ok(ys[1] < ys[0] - 50 && ys[3] > ys[2], 'monte, puis redescend dans la poubelle');
  /* Les têtes et les vibrations, dans l’ordre */
  s.lance(400); assert.ok(S.cls.has('is-wait'));
  s.lance(900); assert.ok(S.cls.has('is-happy') && !S.cls.has('is-wait'));
  assert.deepEqual(s.log.buzz, ['light', 'medium']);
  assert.equal(s.fini(), 0, 'la note reste dans la liste pendant la scène');
  s.lance(1800); assert.equal(s.fini(), 1);
  assert.ok(!S.removed); s.lance(1890); assert.ok(S.removed, 'la scène s’en va');
  assert.equal(s.log.sons.length, 0, 'sans son : aucun son');
});

test('la poubelle : les sons, seulement demandés ; mouvements réduits ou note absente : tout de suite', () => {
  const s = scene({ son: true });
  s.lance();
  assert.deepEqual(s.log.sons, ['crumple', 'whoosh', 'stamp', 'click', 'pop']);
  assert.equal(s.log.release, 1, 'le son de l’interface s’arrête après la scène');
  const r = scene({ reduit: true });
  assert.equal(r.fini(), 1); assert.equal(r.log.ajoute.length, 0); assert.equal(r.log.anims.length, 0);
  const a = scene({ carteOk: false });
  assert.equal(a.fini(), 1); assert.equal(a.log.ajoute.length, 0);
});

test('Supprimer : plus de toast ni d’« Annuler », la poubelle, VoiceOver dit « Note supprimée »', () => {
  const d = fn('deleteNote');
  assert.ok(!/toastWithAction|Annuler'|Note restaurée/.test(d));
  assert.ok(d.indexOf('const son=gone?lqCorbSon():false;') < d.indexOf('const go=()=>{'), 'le son se décide pendant l’appui');
  assert.ok(d.includes("r.querySelectorAll('.notes-list[data-enter]').forEach(l=>l.removeAttribute('data-enter'));"), 'la liste revient déjà en place');
  assert.ok(d.includes('setTimeout(()=>lqCorbeille(carte,fin,{son}),carte?120:0);'));
  assert.ok(d.includes("if(gone)lqSay('Note supprimée');"));
});

test('le son de la poubelle : coupé si le lecteur est muet ou hors d’un appui ; jamais la session « lecture »', () => {
  const essai = (muet, actif) => {
    let ui = 0;
    const ctx = vm.createContext({ LV_MUTED: muet, navigator: { userActivation: { isActive: actif } }, LvSfx: { ui: () => { ui++; return true; } } });
    vm.runInContext(fn('lqCorbSon'), ctx);
    return [ctx.lqCorbSon(), ui];
  };
  assert.deepEqual(essai(false, true), [true, 1]);
  assert.deepEqual(essai(true, true), [false, 0]);
  assert.deepEqual(essai(false, false), [false, 0]);
  const ui = cut('    ui(){', '    stats(){');
  assert.ok(!ui.includes('session('), 'pas de session « lecture » : le bouton silencieux coupe ces sons');
  assert.ok(app.includes("case 'crumple':{"), 'le bruit du papier froissé');
});

test('lqAdieu referme aussi marges intérieures et bordures ; le style de la scène', () => {
  const a = fn('lqAdieu');
  assert.ok(a.includes("['paddingTop','paddingBottom','borderTopWidth','borderBottomWidth'].forEach(k=>{if(cs[k])bx0[k]=cs[k];});"));
  assert.ok(a.includes("backgroundColor:'#FFE4E6',...bxZ,offset:1}"));
  assert.ok(app.includes('.lq-corb{position:fixed;inset:0;z-index:9998;pointer-events:none;overflow:hidden}'));
  assert.ok(app.includes('.lq-corb.is-wait .f-wait,.lq-corb.is-happy .f-happy{opacity:1}'));
});
