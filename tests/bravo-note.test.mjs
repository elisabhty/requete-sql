/* « Ce que tu retiens » : seulement dans le bilan de la leçon, avec le bouton « Ajouter à mes notes » et sa flèche, plus dans les vidéos
   (Elisa, 27 octobre, 9 h 43 : « Finalement les ce que tu retiens doivent être que là avec le bouton ajouter au note et la flèche, pas
   dans les vidéos »).
   Les vidéos s’arrêtent avant leur chapitre « À retenir » (assets/anim/core.js, et where.html qui a son propre moteur) : sur la dernière
   image de la scène d’avant, sa légende encore affichée. Le bilan garde « Ce que tu retiens » et y ajoute le bouton des vidéos d’avant :
   la flèche dessinée, l’anneau qui appelle, la coche, la gerbe, la mini-note qui file vers « Mes notes ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, 'assets/anim/core.js'), 'utf8');
const cut = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, `extrait introuvable : ${from}`);
  return html.slice(a, b);
};

function bac(notes = []){
  const ctx = vm.createContext({
    LV_ICO: {pen: '<svg class="pen"></svg>', check: '<svg class="check"></svg>'},
    REFLEX_TITLE: 'Le réflexe à retenir',
    state: {notes},
    saved: 0,
    lessonHasVideo: l => !!(l && l.video),
    lessonReflexText: () => 'AS donne un nom d’affichage à une colonne.\nIl agit sur le résultat.',
    havingReflexHtml: () => '', highlight: s => s
  });
  vm.runInContext('function save(){ saved++; } var noteFreshId = null;' + cut('function lvNoteCtx(l){', '/* Point de la maquette')
    + cut('/* La note du réflexe : enregistrée une fois', 'function lvNoteAdd(e){')
    + cut('function bravoRecapHtml(l){', '/* Le bouton arrive quand il est à l’écran'), ctx);
  return ctx;
}
const AS = {id: 2, titre: 'Renommer avec AS', video: {anim: 'assets/anim/as.html?app&embed'}, studio: {reflex: {extra: '<div class="memory-rule">Les trois idées</div>'}}};

test('bilan d’une leçon en vidéo : « Ajouter à mes notes » et sa flèche sous « Ce que tu retiens »', () => {
  const ctx = bac();
  const h = ctx.bravoRecapHtml(AS);
  assert.ok(h.includes('<b>Ce que tu retiens</b>') && h.includes('Les trois idées'), 'le récapitulatif reste dans le bilan');
  assert.ok(h.indexOf('Les trois idées') < h.indexOf('class="lv-note bravo-note"'), 'le bouton sous le récapitulatif, dans sa carte');
  assert.ok(h.includes('class="lv-note-arrow"') && h.includes('class="lv-a-halo"') && h.includes('class="lv-a-head"'), 'la flèche dessinée, comme dans les vidéos');
  assert.ok(h.includes('<button type="button" class="lv-note-btn" onclick="bravoNoteAdd(this)">') && h.includes('<span class="lv-note-l">Ajouter à mes notes</span>'));
  assert.ok(h.includes('<svg class="pen"></svg>') && h.includes('<svg class="check"></svg>'), 'le crayon, puis la coche');
  assert.ok(!bac().bravoRecapHtml({id: 3, titre: 'Texte', solution: 'SELECT 1'}).includes('bravo-note'), 'leçon écrite : pas de bouton (son réflexe a le sien)');
});

test('bilan : réflexe déjà dans les notes, le bouton le dit tout de suite, sans flèche', () => {
  const ctx = bac([{ctx: 'Leçon 2 · Renommer avec AS · Le réflexe à retenir', txt: 'AS donne un nom d’affichage à une colonne. Il agit sur le résultat.', sql: ''}]);
  const h = ctx.bravoRecapHtml(AS);
  assert.ok(h.includes('class="lv-note bravo-note is-had is-in is-done is-already"') && h.includes('Déjà dans mes notes') && h.includes('aria-disabled="true"'));
  assert.ok(!h.includes('lv-note-arrow'), 'pas de flèche vers un bouton déjà utilisé');
});

test('la note du réflexe : la même depuis le bilan et depuis les vidéos, enregistrée une seule fois', () => {
  const ctx = bac();
  assert.equal(ctx.lvNoteSave(AS), 'added');
  assert.equal(ctx.state.notes.length, 1);
  assert.deepEqual([ctx.state.notes[0].ctx, ctx.state.notes[0].sql, ctx.state.notes[0].pin], ['Leçon 2 · Renommer avec AS · Le réflexe à retenir', '', false]);
  assert.equal(ctx.noteFreshId, ctx.state.notes[0].id, 'la nouvelle note est mise en avant dans « Mes notes »');
  assert.equal(ctx.saved, 1);
  assert.equal(ctx.lvNoteSave(AS), 'already', 'pas de doublon');
  assert.equal(ctx.state.notes.length, 1);
  assert.ok(cut('function lvNoteAdd(e){', 'function lvNoteBurst(btn){').includes("if(lvNoteSave(l)==='already')"), 'le bouton des vidéos passe par la même fonction');
});

test('bilan : le bouton arrive quand il est à l’écran, l’ajout se voit (coche, gerbe, mini-note vers « Mes notes »), sans toast', () => {
  assert.ok(cut('function renderLessonFlow(){', '/* ---------- Requête à trous').includes('requestAnimationFrame(bravoNoteWire);'), 'branché à l’affichage du bilan');
  const wire = cut('function bravoNoteWire(){', 'function bravoNoteAdd(btn){');
  assert.ok(wire.includes('new IntersectionObserver(') && wire.includes("el.classList.add('is-in')") && wire.includes("el.classList.add('is-idle'); },1300);"), 'la flèche se dessine, puis l’anneau appelle');
  assert.ok(wire.includes("if(prefersReduceMotion()){ el.classList.add('is-in','is-idle'); return; }"), 'mouvement réduit : tout est là d’emblée');
  const add = cut('function bravoNoteAdd(btn){', '/* L’ajout, comme dans les vidéos');
  assert.ok(add.includes('kind=lvNoteSave(l)') && add.includes("'Ajouté à mes notes'") && add.includes("'Déjà dans mes notes'"));
  assert.ok(add.indexOf("if(kind==='already')") < add.indexOf('bravoNoteFly('), 'déjà dans les notes : pas d’envol');
  assert.ok(add.includes('if(!prefersReduceMotion()){ lvNoteBurst(btn); bravoNoteFly(el,before,state.notes.length); }'));
  assert.ok(!/toast\(/.test(add), 'pas de toast : le retour se fait sur le bouton');
  const fly = cut('function bravoNoteFly(el,before,after){', '/* La suite du parcours');
  for (const part of ["add('lv-cap')", "add('lv-notes-to'", "add('lv-fly'", "getElementById('nav-notes')", "tgt.classList.add('is-hit')", 'fly.remove()', 'cap.remove()', 'tgt.remove()'])
    assert.ok(fly.includes(part), `étape « ${part} »`);
  assert.ok(html.includes('.bravo-note{position:relative;left:auto;top:auto;width:auto;height:auto;transform:none;') && html.includes('.bravo-note .lv-note-arrow{'), 'dans le flux du bilan, la flèche au-dessus du bouton');
});

test('les vidéos n’ont plus « Ce que tu retiens » ni le bouton « Ajouter à mes notes »', () => {
  assert.ok(!/video:\{[^}]*notes:\{t:/.test(html), 'aucune leçon n’a de bouton de notes dans sa vidéo');
  const pages = [...html.matchAll(/video:\{anim:'assets\/anim\/([a-z0-9-]+\.html)\?app&embed'/g)].map(m => m[1]);
  assert.equal(pages.length, 62);
  for (const p of pages) {
    const src = fs.readFileSync(path.join(root, 'assets/anim', p), 'utf8');
    assert.ok(/label: ?'À retenir'/.test(src), `${p} : son chapitre « À retenir » (gardé dans la page, ?recap le remontre)`);
  }
  assert.ok(core.includes("const RECAP_CH = chapters.findIndex(c => c.label === 'À retenir');") && core.includes("const RECAP_A = RECAP_CH > 0 && !QS.has('recap') ? chapters[RECAP_CH].a : null;"));
  assert.ok(core.includes('chapters = chapters.slice(0, RECAP_CH)') && core.includes('notesAt = null;'), 'ni le chapitre ni le bouton');
  assert.ok(core.includes("if (k >= 0 && plain(captions[k][2]) !== 'À toi !') captions[k] = [captions[k][0], 999].concat(captions[k].slice(2));"), 'la dernière légende reste affichée jusqu’à la fin');
  const end = core.slice(core.indexOf('function recapEnd(a, end){'), core.indexOf('/* ---------- Le cours ---------- */'));
  assert.ok(end.includes('s >= a - 1.0 && s < a - 0.01') && end.includes('(v.autoAlpha === 0 || v.opacity === 0)'), 'arrêt sur l’image d’avant les fondus de sortie de la scène');
  assert.ok(end.includes('const RECAP_REST = 1.2;') && end.includes('readTime(c[2])'), 'la dernière image reste le temps de lire, puis un instant');
});
