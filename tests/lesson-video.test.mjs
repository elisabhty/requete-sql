import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'scripts/build-www.mjs'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const cut = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, `extrait introuvable : ${from}`);
  return html.slice(a, b);
};

test('WHERE : le cours a sa vidéo, son image fixe et sa vignette, présentes dans le dépôt', () => {
  const where = cut('guide({ id:4, titre:"WHERE"', 'guide({ id:5,');
  const m = where.match(/video:\{src:'([^']+)',poster:'([^']+)',thumb:'([^']+)',duree:'([^']+)',/);
  assert.ok(m, 'champ video du cours WHERE');
  for (const f of m.slice(1, 4)) assert.ok(fs.statSync(path.join(ROOT, f)).size > 1000, `fichier présent : ${f}`);
  assert.equal(m[4], '2 min 04');
  assert.ok(/notes:\{t:116\.2,y:1330,card:\[64,356,1016,1017\],to:\[940,255\]\}/.test(where), 'bouton « Ajouter dans notes » à 1 min 56, sous le récapitulatif ; la note part du récapitulatif vers le carnet');
  assert.ok(html.includes("'exoNeeds','video']"), 'guide() garde le champ video sur la leçon');
});

test('le cours en vidéo remplace le texte du cours, sans lancer les outils du cours texte', () => {
  const flow = cut('function renderLessonFlow(){', '/* ---------- Requête à trous');
  const iVideo = flow.indexOf('lessonStep===0&&lessonVideoOn(l)'), iText = flow.indexOf('const rich=l.richLesson||l.studio');
  assert.ok(iVideo > 0 && iVideo < iText, 'la branche vidéo passe avant le cours texte');
  assert.ok(flow.includes('slide=lessonVideoSlide(l)'));
  assert.ok(flow.includes('if(lessonStep===0&&!lessonVideoOn(l)){\n    buildSommaire();'), 'sommaire et activités du texte seulement sans vidéo');
});

test('la vidéo démarre à l’ouverture du cours, au retour sur « Cours » et au redémarrage de la leçon, pas lors d’une reprise automatique', () => {
  const open = cut('function openLesson(id, restoreStep){', '/* « Quel JOIN choisir ? »');
  assert.ok(open.includes('closeLessonVideo(true);'));
  assert.ok(open.includes('if(lessonStep===0&&lessonVideoOn(l)&&!restoringNav)openLessonVideo();'));
  assert.ok(cut('function setLessonStep(n){', 'function recommencerLecon(').includes('if(n===0&&lessonVideoOn(current))openLessonVideo();'));
  assert.ok(cut('function recommencerLecon(', 'function bravoStatsHtml(').includes('if(lessonVideoOn(current))openLessonVideo();'));
});

test('lecteur plein écran : lecture dans la page, fin « À toi de jouer », exercice débloqué, repli sur le texte', () => {
  const player = cut('function openLessonVideo(){', 'function lvPlay(){');
  assert.ok(player.includes('playsinline webkit-playsinline'), 'lecture dans la page sur iPhone');
  assert.ok(player.includes('À toi de jouer&nbsp;!') && player.includes('${l.consigne}'), 'fin : à toi de jouer + consigne');
  assert.ok(player.includes('Passer à l’exercice') && player.includes('Revoir la vidéo'));
  const ended = cut('function lvEnded(){', 'function lvReplay(){');
  assert.ok(ended.includes('jcMarkPassed(id);') && ended.includes('jcUnlockExo();'), 'la fin de la vidéo débloque l’exercice');
  assert.ok(cut('function lvGoExercise(){', 'function lvFail(){').includes('setLessonStep(1);'));
  const fail = cut('function lvFail(){', 'function lvKey(e){');
  assert.ok(fail.includes('LV_FAILED.add(id);') && fail.includes('renderLessonFlow();'), 'vidéo illisible : retour au cours texte');
  assert.ok(html.includes("#schema-sheet.on,#lesson-video.on,"), 'pas de retour par glissement pendant la vidéo');
  assert.ok(html.includes("if(typeof lessonVideoOpen==='function'&&lessonVideoOpen()){closeLessonVideo();return;}"), 'le retour ferme d’abord la vidéo');
});

test('vignette du cours : verrou tant que la vidéo n’est pas finie, puis « Passer à l’exercice »', () => {
  let passed = false;
  const ctx = vm.createContext({
    moduleDeLecon: () => ({titre: 'Lire une table'}),
    jcGateLocked: () => !passed, jcPassed: () => passed, etapesDe: () => ({}),
  });
  vm.runInContext(cut('const LV_FAILED=new Set()', 'function openLessonVideo(){') + ';this.slide=lessonVideoSlide;this.on=lessonVideoOn;this.fail=LV_FAILED;', ctx);
  const l = {id: 4, titre: 'WHERE', résumé: 'Filtrer les lignes', video: {src: 'assets/videos/where.mp4', poster: 'p.jpg', thumb: 't.jpg', duree: '2 min 04'}};
  let h = ctx.slide(l);
  assert.ok(h.includes('data-jc-gate onclick="openLessonVideo()">Termine la vidéo pour continuer'));
  assert.ok(h.includes('Regarder la vidéo · 2 min 04') && h.includes('src="t.jpg"'));
  passed = true;
  h = ctx.slide(l);
  assert.ok(h.includes('onclick="setLessonStep(1)">Passer à l’exercice') && h.includes('Revoir la vidéo · 2 min 04'));
  assert.equal(ctx.on(l), true);
  ctx.fail.add(4);
  assert.equal(ctx.on(l), false, 'après un échec de lecture, le cours texte revient');
  assert.equal(ctx.on({id: 5, video: null}), false);
});

test('la vidéo part dans l’app iOS et reste hors du cache du service worker (lecture par morceaux sur Safari)', () => {
  assert.ok(build.includes("for (const dir of ['assets', 'vendor'])") && !/unused = new Set\([^)]*where\.mp4/.test(build));
  assert.ok(sw.includes("url.pathname.endsWith('.mp4')"));
});

test('« Ajouter dans notes » dans la vidéo : même note que le cours texte, un seul appui, sans doublon ni toast', () => {
  const player = cut('function openLessonVideo(){', 'function lvPlay(){');
  assert.ok(player.includes('class="lv-note-btn"') && player.includes('Ajouter dans notes') && player.includes('class="lv-note-arrow"'), 'bouton et flèche dans le lecteur');
  assert.ok(player.includes("e.target.closest('.lv-end,.lv-big,.lv-note-btn')"), 'toucher le bouton ne met pas la vidéo en pause');
  const add = cut('function lvNoteAdd(e){', 'function lvNoteBurst(btn){');
  assert.ok(!/toast\(/.test(add), 'pas de toast : le retour se fait sur le bouton');
  assert.ok(add.includes('lvNoteExisting(l)') && add.includes("lvNoteMark('already')"), 'pas de doublon');
  const ctx = vm.createContext({REFLEX_TITLE: 'Le réflexe à retenir', state: {notes: []},
    lessonReflexText: l => 'WHERE sert à filtrer les lignes selon une condition.\nIl agit sur le résultat.'});
  vm.runInContext(cut('function lvNoteCtx(l){', 'function lvNotePlace(){'), ctx);
  const l = {id: 4, titre: 'WHERE'};
  assert.equal(ctx.lvNoteCtx(l), 'Leçon 4 · WHERE · Le réflexe à retenir', 'même contexte que noteFromRetenir (currentContext + réflexe)');
  assert.equal(ctx.lvNoteExisting(l), null);
  ctx.state.notes.push({ctx: 'Leçon 4 · WHERE · Le réflexe à retenir', txt: 'WHERE sert à filtrer les lignes selon une condition.  Il agit sur le résultat.', sql: ''});
  assert.ok(ctx.lvNoteExisting(l), 'note déjà ajoutée depuis le cours texte ou une vidéo précédente');
  const fromText = cut('function noteFromRetenir(', 'function lessonRetenirText(');
  assert.ok(fromText.includes("ctx:currentContext()+' · '+REFLEX_TITLE") && fromText.includes('txt:lessonReflexText(l)'));
});

test('le bouton suit la vidéo : visible à partir de son moment, caché à la fin et quand on revient avant', () => {
  const sync = cut('function lvNoteSync(){', 'function lvNoteMark(kind){');
  assert.ok(sync.includes("!LV.root.classList.contains('is-end')&&!V.ended&&V.currentTime>=N.cfg.t"));
  const place = cut('function lvNotePlace(){', 'function lvNoteSync(){');
  assert.ok(place.includes('Math.min(W/vw,H/vh)') && place.includes('N.cfg.y/1920*dh'), 'placé comme la vidéo (object-fit: contain), sur la maquette 1080 × 1920');
  assert.ok(html.includes('.lv.is-end .lv-note{display:none}'));
});

test('commandes de lecture : reculer / avancer de 5 s, pause, vitesse 0,5× à 2× gardée d’une vidéo à l’autre, son', () => {
  const player = cut('function openLessonVideo(){', 'function lvPlay(){');
  for (const c of ['lv-back', 'lv-pp', 'lv-fwd', 'lv-speed', 'lv-mute', 'lv-cur', 'lv-dur'])
    assert.ok(player.includes(`class="lv-${c.slice(3)}`) || player.includes(c), `commande ${c}`);
  assert.ok(player.includes("lvSkip(-LV_SKIP)") && player.includes("lvSkip(LV_SKIP)"));
  assert.ok(player.includes("if(!menu.hidden&&!e.target.closest('.lv-speed-wrap')){ e.stopPropagation(); e.preventDefault(); lvSpeedMenu(false); }"),
    'menu ouvert : un appui ailleurs le ferme sans mettre la vidéo en pause');
  const ctx = vm.createContext({});
  vm.runInContext(cut('/* 0:42, 2:04 */', 'function lvSyncPP(){'), ctx);
  assert.equal(ctx.lvFmt(0), '0:00'); assert.equal(ctx.lvFmt(42.7), '0:42'); assert.equal(ctx.lvFmt(123.8), '2:03'); assert.equal(ctx.lvFmt(NaN), '0:00');
  assert.equal(ctx.lvRateLabel(0.5), '0,5×'); assert.equal(ctx.lvRateLabel(1), '1×'); assert.equal(ctx.lvRateLabel(1.5), '1,5×');
  assert.ok(html.includes('const LV_RATES=[0.5,0.75,1,1.5,2];') && html.includes("localStorage.getItem('rq-video-vitesse')") && html.includes('const LV_SKIP=5;'));
  const skip = cut('function lvSkip(d){', 'function lvSpeedMenu(open){');
  assert.ok(skip.includes('Math.max(0,Math.min(dur-0.15,V.currentTime+d))'), 'jamais avant le début ni au-delà de la fin');
  assert.ok(cut('function lvKey(e){', 'function lvHidden(){').includes("e.key==='ArrowLeft'"), 'flèches du clavier');
});

test('micro-interaction de l’ajout : halo, mini-note en arc vers « Mes notes », compteur n → n + 1, puis tout s’efface', () => {
  const add = cut('function lvNoteAdd(e){', '/* Micro-interaction de l’ajout');
  assert.ok(add.includes('const before=state.notes.length;') && add.includes('lvNoteFly(before,state.notes.length)'), 'compteur avant / après l’ajout');
  assert.ok(add.indexOf("lvNoteMark('already')") < add.indexOf('lvNoteFly('), 'note déjà présente : pas d’envol');
  assert.ok(add.includes('if(!prefersReduceMotion()){ lvNoteBurst('), 'mouvement réduit : pas d’animation');
  const fly = cut('function lvNoteFly(before,after){', 'function lvNoteBurst(btn){');
  for (const part of ["add('lv-cap')", "add('lv-notes-to'", "add('lv-fly'", "tgt.classList.add('is-hit')", 'fly.remove()', 'cap.remove()', 'tgt.remove()'])
    assert.ok(fly.includes(part), `étape « ${part} »`);
  assert.ok(fly.includes('<span class="lv-notes-lab">Mes notes</span>') && fly.includes('<span>${before}</span><span>${after}</span>'));
  assert.ok(!/toast\(/.test(fly), 'pas de toast');
  const pt = cut('function lvPt(X,Y){', 'function lvNotePlace(){');
  assert.ok(pt.includes('X/1080*dw') && pt.includes('Y/1920*dh'), 'positions prises sur la maquette de la vidéo');
});
