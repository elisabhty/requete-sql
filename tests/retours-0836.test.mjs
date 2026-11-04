/* 4 novembre, 8 h 36 (Elisa, dans l’app iPhone) : « J’étais sur l’application et avant le son fonctionnait (voix) et d’un coup ça n’a plus
   fonctionné » ; réf. 1 : les épingles (testées dans feuilles-projet) ; réf. 2 : « bug ici je ne peux pas descendre plus » dans une
   nouvelle note, clavier et barre des touches SQL ouverts.
   La voix : une seule erreur de lecture d’un fichier de l’app le faisait sauter pour le reste du cours, sans rien dire, et une balise qui
   ne repartait plus restait muette. Maintenant une balise neuve reprend le même fichier à la même position (sauté seulement au troisième
   échec), une voix qui n’avance plus depuis 2,5 s repart de même, et le retour dans l’app rend sa chance à chaque fichier. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i + a.length); assert.ok(j > i, b); return html.slice(i, j); };

/* La voix, seule, avec des balises <audio> factices (elles ne jouent rien : currentTime n’avance que si le test le dit). */
const lab = ({ app = true, doc = {} } = {}) => {
  const src = cut('const LvVoice=(()=>{', '/* ---------- Animation jouée comme une vidéo');
  const made = [], raf = []; let now = 0;
  class El {
    constructor() { this.l = {}; this.attrs = {}; this.paused = true; this.readyState = 0; this.currentTime = 0; this.seeking = false; this.ended = false; this.muted = false; this.playbackRate = 1; this.plays = 0; this.loads = 0; this._src = ''; made.push(this); }
    set src(v) { this._src = v; this.readyState = 0; this.paused = true; } get src() { return this._src; }
    setAttribute(k, v) { this.attrs[k] = v; } removeAttribute(k) { if (k === 'src') this._src = ''; }
    addEventListener(t, f) { (this.l[t] || (this.l[t] = [])).push(f); } fire(t) { (this.l[t] || []).forEach(f => f()); }
    load() { this.loads++; } play() { this.paused = false; this.plays++; return Promise.resolve(); } pause() { this.paused = true; }
  }
  const ctx = vm.createContext({ document: Object.assign(doc, { createElement: () => new El() }), performance: { now: () => now },
    requestAnimationFrame: f => { raf.push(f); return raf.length; }, cancelAnimationFrame: () => {}, setTimeout: () => 0, clearTimeout: () => {},
    fetch: () => Promise.resolve({ ok: true, blob: () => Promise.resolve({ size: 10 }) }), URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    window: app ? { Capacitor: { isNativePlatform: () => true } } : {}, location: { protocol: app ? 'capacitor:' : 'https:' } });
  vm.runInContext(src + ';this.V=LvVoice;', ctx);
  return { V: ctx.V, made, raf, at: ms => { now = ms; } };
};
const c1 = { src: 'assets/voix/cours/ch01.mp3', o: 2, d: 6 }, c2 = { src: 'assets/voix/cours/ch02.mp3', o: 0, d: 3 };

test('une erreur de lecture : une balise neuve reprend le même fichier, à la même position ; sauté seulement au troisième échec', () => {
  const { V, made, at } = lab();
  V.start(c1, 1); const a = made[0];
  a.readyState = 4; a.fire('loadedmetadata'); a.currentTime = 4.2;
  at(800); V.keep(c1, 2.2);
  a.fire('error');
  assert.equal(made.length, 2, 'une balise neuve');
  const b = made[1];
  assert.equal(b.src, c1.src, 'le même fichier'); assert.equal(b.paused, false, 'la phrase repart aussitôt'); assert.equal(a.src, '', 'l’ancienne balise est vidée');
  b.readyState = 1; b.fire('loadedmetadata'); assert.equal(b.currentTime, 4.2, 'à la même position');
  a.fire('error'); assert.equal(made.length, 2, 'l’ancienne balise ne compte plus');
  assert.equal(V.stats().reprises, 1); assert.equal(V.stats().derniere, 'erreur');
  b.fire('error'); assert.equal(made.length, 3, 'deuxième échec : encore une chance');
  made[2].fire('error'); assert.equal(made.length, 3, 'troisième échec : le fichier est sauté');
  assert.equal(V.stats().sautes, 1); assert.equal(V.ready(), true, 'sans faire attendre l’image');
  at(2000); V.start(c2, 0); assert.equal(made[2].src, c2.src, 'les autres fichiers jouent'); assert.equal(made[2].paused, false);
});

test('une voix qui devrait parler mais n’avance plus depuis 2,5 s repart d’une balise neuve ; une voix qui avance, jamais', () => {
  const { V, made, raf, at } = lab();
  at(100); V.start(c1, 0); const a = made[0];
  a.readyState = 4; a.fire('loadedmetadata');
  for (let t = 200; t <= 2400; t += 100) { at(t); a.currentTime += 0.1; V.keep(c1, (t - 100) / 1000); }
  assert.equal(made.length, 1, 'elle avance : rien ne bouge');
  /* Plus rien n’avance (le système l’a lâchée) */
  for (let t = 2500; t <= 4800; t += 100) { at(t); V.keep(c1, (t - 100) / 1000); }
  assert.equal(made.length, 1, 'avant 2,5 s : on attend');
  at(5100); V.keep(c1, 5); assert.equal(made.length, 2, 'au-delà : une balise neuve');
  assert.equal(made[1].paused, false); assert.equal(V.stats().derniere, 'immobile');
  /* Un arrêt de l’image (question, moment) puis la reprise longtemps après : pas de fausse alerte */
  const b = made[1]; b.readyState = 4; b.fire('loadedmetadata');
  at(5200); b.currentTime += 0.1; V.keep(c1, 5.1);
  V.finish(c1); b.currentTime = 8.2; raf.shift()(); assert.equal(b.paused, true, 'fin du passage pendant l’arrêt');
  at(60000); V.keep(c1, 5.2); assert.equal(made.length, 2, 'la garde repart de zéro à la reprise');
  V.pause(); at(90000); V.keep(c1, 5.3); assert.equal(made.length, 2, 'ni après une pause');
});

test('une phrase dite à part (consigne, réaction) se reprend aussi, et va au bout de son passage', () => {
  const { V, made, raf, at } = lab();
  const s1 = { src: 'assets/voix/cours/bienvu.mp3', o: 0.5, d: 1.5 };
  at(10); V.say(s1); const a = made[0]; a.readyState = 4; a.fire('loadedmetadata');
  a.currentTime = 0.9; raf.shift()();
  a.fire('error'); const b = made[1];
  assert.equal(b.src, s1.src); assert.equal(b.paused, false, 'reprise en cours de phrase');
  b.readyState = 4; b.fire('loadedmetadata'); assert.equal(b.currentTime, 0.9);
  b.currentTime = 1.99; raf.shift()(); assert.equal(V.stats().saying, false, 'fin du passage, sur la balise neuve'); assert.equal(b.paused, true);
});

test('de retour dans l’app, chaque fichier sauté retrouve sa chance', () => {
  const l = {}; const doc = { hidden: false, addEventListener: (t, f) => { l[t] = f; } };
  const { V, made, at } = lab({ doc });
  assert.equal(typeof l.visibilitychange, 'function');
  V.start(c1, 0); for (let i = 0; i < 3; i++) made.at(-1).fire('error');
  assert.equal(V.stats().sautes, 1);
  doc.hidden = true; l.visibilitychange(); assert.equal(V.stats().sautes, 1, 'en arrière-plan : rien');
  doc.hidden = false; l.visibilitychange(); assert.equal(V.stats().sautes, 0, 'au retour : plus rien de sauté');
  at(500); V.start(c2, 0); V.start(c1, 0); assert.equal(made.at(-1).src, c1.src); assert.equal(made.at(-1).paused, false, 'le fichier rejoue');
  /* Sur le web, les fichiers absents (404) restent sautés : pas d’écoute du retour */
  const w = {}; lab({ app: false, doc: { hidden: false, addEventListener: (t, f) => { w[t] = f; } } });
  assert.equal(w.visibilitychange, undefined);
});

test('réf. 2 : la feuille de note réserve sous son contenu la hauteur de la barre des touches SQL, et « Enregistrer » reste au-dessus', () => {
  assert.ok(html.includes("  document.documentElement.style.setProperty('--kbar-h',kh+'px');"), 'la hauteur de la barre, seule');
  assert.ok(html.includes('  body.kbar-on .viz.on .viz-body{padding-bottom:calc(18px + var(--safe-bottom) + var(--kbar-h,0px))}'));
  assert.ok(cut('function syncKbarOffset(){', 'function showKbar(on){').includes('  updateKbarDock();\n  noteSqlEnVue();\n}'));
  /* noteSqlEnVue, sur une feuille factice : la rangée « Enregistrer » finit à 569, la barre commence à 524 */
  const rect = (top, bottom) => () => ({ top, bottom });
  const mk = ({ rowBas = 569, shellHaut = 300, actif = 'ne-sql', on = true } = {}) => {
    const body = { scrollTop: 92, getBoundingClientRect: rect(120, 587), querySelector: () => ({ getBoundingClientRect: () => ({ bottom: rowBas }) }) };
    const ta = { id: actif, closest: () => ({ getBoundingClientRect: () => ({ top: shellHaut }) }) };
    const els = { 'note-sheet': { classList: { contains: () => on } }, 'note-body': body, kbar: { classList: { contains: () => true }, getBoundingClientRect: rect(524, 587) } };
    const ctx = vm.createContext({ document: { getElementById: id => els[id], activeElement: ta } });
    vm.runInContext(cut('function noteSqlEnVue(){', 'if(typeof document!==\'undefined\')document.addEventListener(\'focusin\''), ctx);
    ctx.noteSqlEnVue(); return body.scrollTop;
  };
  assert.equal(mk(), 92 + 57, 'la feuille défile : 569 − (524 − 12)');
  assert.equal(mk({ shellHaut: 150 }), 92 + 22, 'sans faire passer le haut de la requête sous l’en-tête');
  assert.equal(mk({ rowBas: 480 }), 92, 'déjà au-dessus : rien');
  assert.equal(mk({ actif: 'ne-ta' }), 92, 'seulement pour la requête associée');
  assert.equal(mk({ on: false }), 92, 'feuille fermée : rien');
  assert.ok(html.includes("  [150,550,950].forEach(t=>setTimeout(noteSqlEnVue,t));"), 'recalée pendant que la vue rétrécit (app)');
});

test('« c’est possible d’animer plus le widget ? » : le passage d’un état à l’autre s’anime (iOS n’anime pas un widget en boucle)', () => {
  const swift = fs.readFileSync(path.join(ROOT, 'resources/ios/widget/RequeteWidget/RequeteWidget.swift'), 'utf8');
  for (const k of ['.id(entree.faitAujourdhui)   // allumée ↔ éteinte', '.transition(.scale(scale: 0.3).combined(with: .opacity))',
    '.chiffreQuiRoule(entree.serie)', '.id(chat)   // la série ou le moment change : le chat plonge et ressort', 'private var chat: String { "\\(entree.serie)-\\(humeur.rawValue)" }',
    'insertion: AnyTransition.move(edge: .bottom)', 'removal: AnyTransition.move(edge: .bottom)',
    '.animation(ressort, value: entree.serie)', '.animation(ressort, value: entree.faitAujourdhui)',
    'private var ressort: Animation { .spring(response: 0.55, dampingFraction: 0.58) }'])
    assert.ok(swift.includes(k), k);
  /* Le chiffre qui roule n’existe qu’à partir d’iOS 17 : l’app reste installable en iOS 15 */
  const roule = swift.slice(swift.indexOf('func chiffreQuiRoule(_ valeur: Int) -> some View {'), swift.indexOf('extension WidgetConfiguration {'));
  assert.ok(roule.includes('if #available(iOSApplicationExtension 17.0, *) {\n            self.contentTransition(.numericText(value: Double(valeur)))\n        } else {\n            self\n        }'));
  assert.ok(swift.indexOf('@ViewBuilder\n    func chiffreQuiRoule') > 0, 'deux branches de types différents : ViewBuilder');
  /* Accolades et parenthèses équilibrées (pas de compilateur Swift ici) */
  const code = swift.replace(/\/\/.*$/gm, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');
  for (const [o, f] of [['{', '}'], ['(', ')'], ['[', ']']]) assert.equal(code.split(o).length, code.split(f).length, `${o}${f} équilibrées`);
});
