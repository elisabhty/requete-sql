import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'scripts/build-www.mjs'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

/* Polices des animations : JetBrains Mono (code) et Inter (texte), livrées avec l’app. */
const ANIM_FONTS = ['jetbrains-mono.woff2', 'inter-medium.woff2', 'inter-semibold.woff2', 'inter-bold.woff2', 'inter-extrabold.woff2'];

const cut = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, `extrait introuvable : ${from}`);
  return html.slice(a, b);
};

test('WHERE : le cours a son animation, son image fixe et sa vignette, présentes dans le dépôt', () => {
  const where = cut('guide({ id:4, titre:"WHERE"', 'guide({ id:5,');
  const m = where.match(/video:\{anim:'([^']+)',thumb:'([^']+)',duree:'([^']+)',/);
  assert.ok(m, 'champ video du cours WHERE');
  assert.equal(m[1], 'assets/anim/where.html?app&embed');
  for (const f of m.slice(1, 3)) assert.ok(fs.statSync(path.join(ROOT, f.split('?')[0])).size > 1000, `fichier présent : ${f}`);
  assert.equal(m[3], '2 min 02');
  assert.ok(/notes:\{t:114\.8,y:1330,card:\[64,356,1016,1017\],to:\[940,255\]\}/.test(where), 'bouton « Ajouter à mes notes » à 1 min 55, sous le récapitulatif ; la note part du récapitulatif vers le carnet');
  assert.ok(html.includes("'exoNeeds','video']"), 'guide() garde le champ video sur la leçon');
});

test('le cours en vidéo est la vidéo, sans texte de secours ni outils du cours texte', () => {
  const flow = cut('function renderLessonFlow(){', '/* ---------- Requête à trous');
  const iVideo = flow.indexOf('lessonStep===0&&lessonHasVideo(l)'), iText = flow.indexOf('const rich=l.richLesson||l.studio');
  assert.ok(iVideo > 0 && iVideo < iText, 'la branche vidéo passe avant le cours texte, même quand la vidéo n’a pas pu se charger');
  assert.ok(flow.includes('slide=lessonVideoSlide(l)'));
  assert.ok(flow.includes('if(lessonStep===0&&!lessonHasVideo(l)){\n    buildSommaire();'), 'sommaire et activités du texte seulement sans vidéo');
  assert.ok(!html.includes('ne se charge pas'), 'aucun texte « gardé pour le cas où la vidéo ne se charge pas »');
  /* guide() : un cours en vidéo ne garde que le réflexe (et l’exercice), pas de situation, d’étapes ni d’exemple. */
  const g = cut('function guide(spec){', '/* ============================================================\n   2. PROGRAMME');
  assert.ok(g.indexOf('if(spec.video){') > 0 && g.indexOf('if(spec.video){') < g.indexOf('const memoP=sit&&sit.problem;'), 'cours en vidéo : retour avant le texte du cours');
  /* L’exercice reste verrouillé jusqu’à la fin de la vidéo (plus de requête à trous du texte pour le faire). */
  assert.ok(cut('function jcGateLocked(l){', '/* Bouton verrouillé').includes('lessonHasFill(l)||lessonHasVideo(l)'), 'verrou : la vidéo');
  /* Échec de chargement : toucher la carte (openLessonVideo) recharge la vidéo. */
  assert.ok(cut('function openLessonVideo(){', 'function lvPlay(){').includes('if(LV_FAILED.delete(l.id)&&lessonStep===0)renderLessonFlow();'), 'réessayer');
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
  assert.ok(player.includes('À toi de jouer&nbsp;!'), 'fin : à toi de jouer');
  assert.ok(html.includes('.lv.is-end .lv-bottom{opacity:0;visibility:hidden;'), 'fin : commandes vraiment masquées (pas de bande sous la barre de Safari sur iPhone)');
  assert.ok(!player.includes('${l.consigne}') && !player.includes('lv-end-exo'), 'pas d’aperçu de l’exercice sur l’écran de fin : la consigne se découvre à l’étape Exercice');
  assert.ok(player.includes('Passer à l’exercice') && player.includes('Revoir la vidéo'));
  const ended = cut('function lvEnded(){', 'function lvReplay(){');
  assert.ok(ended.includes('jcMarkPassed(id);') && ended.includes('jcUnlockExo();'), 'la fin de la vidéo débloque l’exercice');
  assert.ok(cut('function lvGoExercise(){', 'function lvFail(){').includes('setLessonStep(1);'));
  const fail = cut('function lvFail(){', 'function lvKey(e){');
  assert.ok(fail.includes('LV_FAILED.add(id);') && fail.includes('renderLessonFlow();'), 'vidéo illisible : sa carte le dit (pas de cours texte)');
  assert.ok(html.includes("#schema-sheet.on,#lesson-video.on,"), 'pas de retour par glissement pendant la vidéo');
  assert.ok(html.includes("if(typeof lessonVideoOpen==='function'&&lessonVideoOpen()){closeLessonVideo();return;}"), 'le retour ferme d’abord la vidéo');
});

test('vignette du cours : verrou tant que la vidéo n’est pas finie, puis « Passer à l’exercice »', () => {
  let passed = false;
  const ctx = vm.createContext({
    moduleDeLecon: () => ({titre: 'Lire une table'}),
    jcGateLocked: () => !passed, jcPassed: () => passed, etapesDe: () => ({}),
  });
  vm.runInContext(cut('const LV_FAILED=new Set()', 'function openLessonVideo(){') + ';this.slide=lessonVideoSlide;this.on=lessonVideoOn;this.fail=LV_FAILED;this.pos=LV_POS;', ctx);
  const l = {id: 4, titre: 'WHERE', résumé: 'Filtrer les lignes', video: {anim: 'assets/anim/where.html?app&embed', poster: 'p.jpg', thumb: 't.jpg', duree: '2 min 02'}};
  let h = ctx.slide(l);
  assert.ok(h.includes('data-jc-gate onclick="openLessonVideo()">Termine la vidéo pour continuer'));
  assert.ok(h.includes('Regarder la vidéo · 2 min 02') && h.includes('src="t.jpg"'));
  passed = true;
  h = ctx.slide(l);
  assert.ok(h.includes('onclick="setLessonStep(1)">Passer à l’exercice') && h.includes('Revoir la vidéo · 2 min 02'));
  ctx.pos.set(4, 42.7);
  assert.ok(ctx.slide(l).includes('Reprendre · 0:42'), 'position gardée : la vignette propose de reprendre');
  ctx.pos.delete(4);
  assert.equal(ctx.on(l), true);
  assert.equal(ctx.on({id: 6, video: {src: 'x.mp4'}}), true, 'une vidéo MP4 reste possible');
  ctx.fail.add(4);
  assert.equal(ctx.on(l), false, 'après un échec de lecture, la vidéo ne se relance pas toute seule');
  h = ctx.slide(l);
  assert.ok(h.includes('class="lv-card is-failed" onclick="openLessonVideo()" aria-label="La vidéo n’a pas pu se charger. Réessayer"')
    && h.includes('<b>La vidéo n’a pas pu se charger.</b>') && h.includes('<span class="lv-card-meta">Réessayer</span>'), 'la carte le dit et propose de réessayer, sans texte de secours');
  assert.equal(ctx.on({id: 5, video: null}), false);
});

test('l’animation part dans l’app iOS et reste légère (plus de MP4 pour WHERE)', () => {
  assert.ok(build.includes("for (const dir of ['assets', 'vendor'])"), 'assets/ (donc assets/anim) est copié dans l’app');
  assert.ok(!fs.existsSync(path.join(ROOT, 'assets/videos/where.mp4')), 'l’ancien MP4 de 9 Mo a disparu');
  let total = 0;
  for (const f of ['where.html', 'gsap.min.js', 'mascotte.webp', 'where-thumb.jpg']) total += fs.statSync(path.join(ROOT, 'assets/anim', f)).size;
  for (const f of ANIM_FONTS) total += fs.statSync(path.join(ROOT, 'assets/fonts', f)).size;
  assert.ok(total < 450 * 1024, `animation et ressources : ${Math.round(total / 1024)} Ko`);
  assert.ok(sw.includes("url.pathname.endsWith('.mp4')"));
});

test('« Ajouter à mes notes » dans la vidéo : même note que le cours texte, un seul appui, sans doublon ni toast', () => {
  const player = cut('function openLessonVideo(){', 'function lvPlay(){');
  assert.ok(player.includes('class="lv-note-btn"') && player.includes('Ajouter à mes notes') && player.includes('class="lv-note-arrow"'), 'bouton et flèche dans le lecteur');
  assert.ok(player.includes('class="lv-a-halo"') && html.includes('.lv-note-arrow{position:absolute;z-index:1;') && html.includes('.lv-note-arrow .lv-a-halo{'),
    'flèche bien visible : trait épais sur un halo, dessinée au-dessus du bouton');
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

test('page de l’animation : ressources locales, mode intégré, chapitres et légendes exportés, sans question en pleine vidéo', () => {
  const page = fs.readFileSync(path.join(ROOT, 'assets/anim/where.html'), 'utf8');
  for (const rel of ['gsap.min.js', 'mascotte.webp', '../fonts/jetbrains-mono.woff2', '../fonts/bricolage-grotesque-regular.woff2', '../fonts/bricolage-grotesque-bold.woff2'])
    assert.ok(page.includes(rel) && fs.existsSync(path.join(ROOT, 'assets/anim', rel)), `ressource : ${rel}`);
  assert.ok(!/https?:\/\//.test(page.replace(/https:\/\/gsap\.com/g, '')), 'rien de chargé depuis Internet');
  assert.ok(page.includes("const EMBED = new URLSearchParams(location.search).has('embed');"), 'mode intégré : la scène s’adapte à la fenêtre');
  assert.ok(page.includes('const QUESTIONS = [];') && !page.includes("ctx: 'Lucas habite à Lyon.'"), 'pas de question en pleine vidéo');
  assert.ok(page.includes('chapters: CHAPTERS.map(') && page.includes('captions: CAPTIONS.map(') && page.includes('questions: QUESTIONS.map('));
  assert.ok(page.includes('const sr = $(\'#stage\').getBoundingClientRect(), k = sr.width / 1080 || 1;'), 'mesures justes quand la scène est réduite');
  assert.ok(page.includes('<div class="inv-from">NutriBoost · équipe marketing</div>') && page.includes('Avec <span class="ic">WHERE</span>, garde seulement'));
  assert.ok(page.includes('gsap.config({force3D: false});'), 'transformations en 2D : pas de calque GPU, texte net à la taille réduite');
  assert.ok(page.includes('html.embed,html.embed body{height:100%;overflow:hidden;background:transparent}') && page.includes('html.embed .blob{display:none}'),
    'dans le lecteur : fond transparent, sans halos coupés au bord de la scène');
  assert.ok(html.includes('.lv.is-ready .lv-anim{opacity:1}') && !html.includes('lv-poster'), 'l’animation apparaît en fondu une fois prête, sans image fixe dont le fond trancherait');
});

test('LvAnim se pilote comme une vidéo : lecture, vitesse, question, reprise, fin', async () => {
  const frames = [];
  let now = 0;
  const ctx = vm.createContext({
    requestAnimationFrame: cb => { frames.push(cb); return frames.length; },
    cancelAnimationFrame: () => { frames.length = 0; },
    performance: {now: () => now},
    setTimeout, clearTimeout, Promise, Math, Number, Set, Map, Error,
  });
  vm.runInContext(cut('const LvSfx=', 'function lessonVideoOn(l)') + ';this.LvAnim=LvAnim;', ctx);
  const rendered = [];
  const info = {duration: 10, cues: [{t: 1, type: 'pop', gain: 1, pitch: 0}],
    chapters: [{t: 0, n: 1, label: 'Situation'}], captions: [{a: 0, b: 5, text: 'Une légende'}],
    questions: [{t: 4, kicker: 'À toi de deviner', q: 'Question ?', options: [{label: 'Oui', ok: false}, {label: 'Non', ok: true}]}]};
  const frame = {addEventListener(type, fn) { this.load = fn; }, contentWindow: {__ready: Promise.resolve(info), renderAt: t => rendered.push(t)}, src: ''};
  const a = new ctx.LvAnim(frame), log = [];
  for (const ev of ['loadedmetadata', 'play', 'pause', 'ended', 'question', 'seeked']) a.addEventListener(ev, e => log.push(ev + (e.detail ? ':' + e.detail.i : '')));
  a.play();
  assert.equal(log.length, 0, 'lecture demandée avant le chargement : elle attend');
  await frame.load();
  assert.deepEqual(log, ['loadedmetadata', 'play']);
  assert.equal(a.duration, 10); assert.equal(a.chapters.length, 1); assert.equal(a.captions[0].text, 'Une légende');
  const step = dt => { now += dt * 1000; const f = frames.shift(); f && f(now); };
  for (let i = 0; i < 30; i++) step(0.1);
  assert.ok(Math.abs(a.currentTime - 3) < 1e-6, `3 s écoulées : ${a.currentTime}`);
  a.playbackRate = 2;
  for (let i = 0; i < 10; i++) step(0.1);
  assert.equal(a.currentTime, 4, 'arrêt pile sur la question');
  assert.ok(a.paused && log.includes('question:0'), 'la question met l’animation en pause');
  a.answer(0); a.play();
  for (let i = 0; i < 40; i++) step(0.1);
  assert.ok(a.ended && a.paused && a.currentTime === 10 && log.at(-1) === 'ended', 'fin de l’animation');
  assert.equal(log.filter(x => x === 'question:0').length, 1, 'une question répondue n’est pas reposée');
  a.currentTime = 3; a.play();
  for (let i = 0; i < 15; i++) step(0.1);
  assert.equal(a.currentTime, 4, 'revenir avant la question puis la repasser : arrêt à nouveau (le lecteur y montre la réponse gardée)');
  assert.equal(log.filter(x => x === 'question:0').length, 2);
  a.currentTime = 6.5;
  assert.ok(!a.ended && a.currentTime === 6.5 && log.at(-1) === 'seeked' && rendered.at(-1) === 6.5, 'reprise à une position donnée');
  a.currentTime = 99;
  assert.equal(a.currentTime, 10, 'jamais au-delà de la fin');
  a.play();
  assert.equal(a.currentTime, 0, 'relancer après la fin repart du début');
  a.destroy();
  assert.equal(frame.src, 'about:blank');
});

test('reprise, repères de chapitres, double appui, question et légendes dans le lecteur', () => {
  const player = cut('function openLessonVideo(){', 'function lvPlay(){');
  assert.ok(html.includes("const LV_POS_KEY='rq-video-pos';") && html.includes('localStorage.setItem(LV_POS_KEY'), 'position gardée après fermeture de l’app');
  assert.ok(player.includes("lvPosKeep(); });") && player.includes('resume>2&&resume<video.duration-2'), 'gardée à la pause, reprise au lancement');
  assert.ok(cut('function closeLessonVideo(instant){', 'function lessonStepMeta(){').includes('lvPosKeep();'));
  const keep = cut('function lvPosKeep(){', '/* Chapitre en cours');
  assert.ok(keep.includes('if(t>2&&d>0&&t<d-2)LV_POS.set(LV.id,+t.toFixed(1)); else LV_POS.delete(LV.id);'));
  assert.ok(cut('function lvEnded(){', 'function lvReplay(){').includes('LV_POS.delete(id); lvPosSave();'), 'vidéo finie : la prochaine fois, elle repart du début');
  /* La barre reste d’un seul trait : plus de coupures entre chapitres (à côté des points des exercices, elle paraissait cassée) ;
     le chapitre se lit en haut de l’image et, en glissant, au-dessus du doigt. */
  assert.ok(!html.includes('function lvMarks(') && !html.includes('--gaps') && !html.includes('.lv-rail::after'), 'barre d’un seul trait, sans coupures');
  assert.ok(cut('function lvTip(on){', '/* Double appui').includes(":c?`${c.n} · ${c.label}`:'Intro')+' · '+lvFmt(t);"), 'nom du chapitre en glissant');
  assert.ok(player.includes('if(side&&T.side===side&&now-T.t<330){') && player.includes('if(lvSkip(side*LV_SKIP))lvDtFx(side,T.total);'), 'double appui à gauche / à droite');
  assert.ok(player.includes("T.timer=setTimeout(()=>{ T.timer=0; if(LV&&LV.root===root)lvToggle(); },300);"), 'un seul appui sur le côté : pause après un court délai');
  const ans = cut('function lvQAnswer(k){', 'function lvQClose(answered){');
  for (const part of ["LV.video.sfx(ok?'true':'false')", 'navigator.vibrate(ok?[10,60,20]:[20,60,20])', 'lvNoteBurst(btns[k])', 'const ok=lvQFill(box,q,k);'])
    assert.ok(ans.includes(part), `réponse : ${part}`);
  const fill = cut('function lvQFill(box,q,k){', 'function lvQAnswer(k){');
  for (const part of ["b.classList.add(ok?'is-ok':'is-ko')", "b.classList.add('is-right')", 'Ta réponse&nbsp;:'])
    assert.ok(fill.includes(part), `résultat : ${part}`);
  assert.ok(cut('function lvQShow(i,q){', 'function lvQAnswer(k){').includes("addEventListener('click',()=>{ lvQClose(true); lvPlay(); })"), '« Continuer » relance l’animation');
  assert.ok(player.includes("video.addEventListener('question',e=>{") && player.includes('if(LV&&LV.q)lvQClose(true);'), 'relancer pendant la question la passe');
  assert.ok(player.includes('<div class="lv-sr" aria-live="polite"></div>') && html.includes('function lvCapSync(){'), 'légendes annoncées à VoiceOver');
});

test('service worker : l’animation, chargée dans un cadre, n’écrase jamais la page de l’app et reste disponible hors ligne', () => {
  /* Les pages des cours interactifs (assets/projet/) suivent la même règle que les animations. */
  const iAnim = sw.indexOf("if (req.mode === 'navigate' && (req.destination === 'iframe' || url.pathname.includes('/assets/anim/') || url.pathname.includes('/assets/projet/')))");
  const iShell = sw.indexOf("if (req.mode === 'navigate') {");
  assert.ok(iAnim > 0 && iShell > iAnim, 'les cadres sont traités avant la page de l’app');
  const block = sw.slice(iAnim, iShell);
  assert.ok(block.includes('cache.put(req, res.clone())') && !block.includes("cache.put('./index.html'"), 'rangée sous sa propre adresse');
  assert.ok(sw.includes("await cache.add(new Request('./index.html', { cache: 'reload' }))"), 'la page de l’app est rechargée à l’activation');
  for (const f of ['./assets/anim/where.html?app&embed', './assets/anim/gsap.min.js', './assets/anim/mascotte.webp', './assets/fonts/jetbrains-mono.woff2'])
    assert.ok(sw.includes(`'${f}'`), `préchargé : ${f}`);
});

test('son de l’animation : passe même en mode silencieux (comme une vidéo) et se déverrouille sur iPhone', () => {
  const sfx = cut('const LvSfx=', 'class LvAnim{');
  assert.ok(sfx.includes("as.type='playback'") && sfx.includes('as.type=prevSession'), 'Audio Session API : « lecture » pendant le cours, rendue à la fermeture');
  assert.ok(sfx.includes("silentEl.loop=true") && sfx.includes("URL.createObjectURL(silentWav())") && sfx.includes("setAttribute('x-webkit-airplay','deny')"), 'iPhone plus anciens : balise <audio> silencieuse en boucle');
  assert.ok(sfx.includes('s.buffer=c.createBuffer(1,1,22050); s.connect(c.destination); s.start(0);'), 'son vide joué pendant l’appui pour déverrouiller');
  const resume = sfx.slice(sfx.indexOf('resume(){'), sfx.indexOf('idle(){'));
  assert.ok(resume.indexOf('session(true)') < resume.indexOf('init()'), 'session réglée avant de créer le contexte audio');
  const anim = cut('class LvAnim{', 'function lessonVideoOn(l)');
  assert.ok(anim.includes('LvSfx.stop(); LvSfx.idle(); this._emit(\'pause\');') && anim.includes('LvSfx.idle(); LvSfx.release();'), 'pause : balise silencieuse arrêtée ; fermeture : session rendue');
  const ctx = vm.createContext({Blob: class { constructor(parts, o) { this.size = parts[0].byteLength; this.type = o.type; } }, ArrayBuffer, DataView});
  vm.runInContext(sfx + ';this.LvSfx=LvSfx;', ctx);
  assert.equal(JSON.stringify(ctx.LvSfx.stats()), '{"state":"none","played":0}', 'aucun son avant le premier appui');
});

test('son de l’animation : contexte neuf à chaque cours, remplacé s’il ne tourne plus, réveillé par un appui', () => {
  const sfx = cut('const LvSfx=', 'class LvAnim{');
  const made = [];
  class AC {
    constructor() { this.state = 'running'; this.sampleRate = 8000; this.destination = {}; made.push(this); }
    createDynamicsCompressor() { return {threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {}}; }
    createGain() { return {gain: {value: 1}, connect() {}}; }
    createBuffer(c, n) { return {getChannelData: () => new Float32Array(n)}; }
    createConvolver() { return {connect() {}}; }
    createBufferSource() { return {connect() {}, start() {}, stop() {}}; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  const ctx = vm.createContext({window: {AudioContext: AC}, navigator: {userAgent: 'test'}});
  vm.runInContext(sfx + ';this.LvSfx=LvSfx;', ctx);
  const S = ctx.LvSfx;
  S.resume();
  assert.equal(made.length, 1); assert.equal(S.stats().state, 'running');
  S.play('pop', 0, 1, 0);
  assert.equal(S.stats().played, 1, 'son joué');
  made[0].state = 'interrupted';
  S.play('pop', 0, 1, 0);
  assert.equal(S.stats().played, 1, 'contexte interrompu : pas de son, relance tentée');
  made[0].state = 'interrupted';
  S.resume();
  assert.equal(made.length, 2, 'appui : contexte interrompu remplacé par un neuf'); assert.equal(made[0].state, 'closed');
  S.play('tick', 3, 1, 0);
  assert.equal(S.stats().played, 2);
  S.release();
  assert.equal(made[1].state, 'closed'); assert.equal(S.stats().state, 'none', 'fermeture du cours : contexte fermé');
  S.resume();
  assert.equal(made.length, 3, 'cours suivant : contexte neuf, créé après la session « lecture »');
  made[2].state = 'suspended';
  S.wake();
  assert.equal(made.length, 4, 'appui pendant une lecture muette : le son se réveille');
  S.wake();
  assert.equal(made.length, 4, 'son déjà actif : rien ne change');
  const anim = cut('class LvAnim{', 'function lessonVideoOn(l)');
  assert.ok(anim.includes("if(typeof LV==='undefined'||!LV){ LvSfx.stop(); LvSfx.idle(); LvSfx.release(); }"), 'fondu de fermeture : le son d’un cours ouvert entre-temps reste intact');
  const open = cut('function openLessonVideo(){', 'function lvPlay(){'), close = cut('function closeLessonVideo(instant){', 'function lessonStepMeta(){');
  assert.ok(open.includes("document.addEventListener('touchend',lvWake,{capture:true,passive:true});") && open.includes("document.addEventListener('click',lvWake,true);"), 'un appui pendant la lecture réveille le son');
  assert.ok(close.includes("document.removeEventListener('touchend',lvWake,{capture:true});") && close.includes("document.removeEventListener('click',lvWake,true);"));
});

test('carte de la question : pas de coupure dans « sera-t-elle », aucun bouton présélectionné, alignée sur le tableau', () => {
  const show = cut('function lvQShow(i,q){', 'function lvQAnswer(k){');
  assert.ok(show.includes(`const nw=t=>String(t||'').replace(/([^\\s<>]+-[^\\s<>]+)/g,'<span class="lv-nw">$1</span>');`) && html.includes('.lv-nw{white-space:nowrap}'));
  const ctx = vm.createContext({});
  vm.runInContext(`this.nw=${show.match(/const nw=(t=>[^;]+);/)[1]};`, ctx);
  assert.equal(ctx.nw('Sa ligne sera-t-elle gardée ?'), 'Sa ligne <span class="lv-nw">sera-t-elle</span> gardée ?');
  assert.ok(show.includes("box.querySelector(kept!=null?'.lv-q-b':'.lv-q-card').focus({preventScroll:true})") && !show.includes(".lv-q-opt').focus("), 'focus sur la carte, pas sur « Oui, gardée »');
  assert.ok(cut('function lvQAnswer(k){', 'function lvQClose(answered){').includes('b.focus({preventScroll:true})'));
  assert.ok(show.includes('${q.ctx?`<p class="lv-q-ctx">${nw(q.ctx)}</p>`:\'\'}'), 'contexte puis question');
  const place = cut('function lvQPlace(){', 'function lvReplay(){');
  assert.ok(place.includes('const a=lvPt(64,0), b=lvPt(1016,1904);'), 'même colonne que le tableau et les légendes');
  assert.ok(place.includes('w=Math.min(col>=320?col:Math.max(col,Math.min(R.width-24,360)),440)'), 'petit écran seulement : carte élargie');
  assert.ok(html.includes('.lv-q .lv-q-opt:focus-visible{border-radius:16px;'), 'au clavier : anneau qui garde la forme du bouton');
});

test('réponse à la question gardée : enregistrée par leçon, réaffichée telle quelle, oubliée si on recommence la leçon', () => {
  const store = {};
  const ctx = vm.createContext({localStorage: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }}, JSON, Object, Map});
  vm.runInContext(cut('const LV_POS_KEY=', '/* 0:42, 2:04 */') + ';this.get=lvAnsGet;this.set=lvAnsSet;this.forget=lvForget;this.pos=LV_POS;', ctx);
  const q = {q: 'Sa ligne sera-t-elle gardée ?', options: [{label: 'Oui, gardée', ok: false}, {label: 'Non, écartée', ok: true}]};
  assert.equal(ctx.get(4, 0, q), null);
  ctx.set(4, 0, q, 0);
  assert.equal(ctx.get(4, 0, q), 0, 'réponse retrouvée');
  assert.deepEqual(JSON.parse(store['rq-video-reponses']), {4: {0: {k: 0, q: 'Sa ligne sera-t-elle gardée ?'}}}, 'gardée après fermeture de l’app');
  assert.equal(ctx.get(4, 0, {...q, q: 'Une autre question ?'}), null, 'question modifiée depuis : réponse ignorée');
  ctx.pos.set(4, 50);
  ctx.forget(4);
  assert.equal(ctx.get(4, 0, q), null, 'recommencer la leçon : question reposée');
  assert.equal(ctx.pos.has(4), false, 'et la vidéo repart du début');
  const show = cut('function lvQShow(i,q){', 'function lvQFill(box,q,k){');
  assert.ok(show.includes('const kept=lvAnsGet(LV.id,i,q);') && show.includes("box.classList.add('is-kept');") && show.includes('lvQFill(box,q,kept);'), 'réponse gardée affichée directement');
  assert.ok(!/sfx\(|lvNoteBurst/.test(show), 'sans rejouer le son ni la gerbe');
  assert.ok(cut('function lvQAnswer(k){', 'function lvQClose(answered){').includes('lvAnsSet(LV.id,Q.i,q,k);'), 'nouvelle réponse enregistrée');
  assert.ok(cut('function recommencerLecon(', 'function bravoStatsHtml(').includes('lvForget(id);'));
  assert.ok(cut('function openLessonVideo(){', 'function lvPlay(){').includes('if(r>=q.t-.02&&r<=q.t+.3)r=Math.max(0,q.t-.08);'), 'lecteur fermé pendant la question : elle se réaffiche à la reprise');
});

/* Cours animés sur le moteur commun (assets/anim/core.js) : un cas par cours. */
const COURSES = [
  {id: 0, next: 2, titre: 'Les bases de données relationnelles', page: 'bases-relationnelles.html', thumb: 'bases-relationnelles-thumb.webp', duree: '5 min 56', notesAt: 327.35,
    notes: /notes:\{t:347\.6,y:1404,card:\[64,292,1016,1109\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Chaque sujet a sa table,<br>et des identifiants relient les tables.',
    chapters: ['Situation', 'Le problème', 'Le découpage', 'Base de données et SGBD', 'La clé primaire', 'La clé étrangère', 'Lire une table', 'Choisir les colonnes', 'Deux pièges', 'À retenir'],
    traps: [
      // Le fichier Excel : une ligne par commande, le client et le produit recopiés
      '<span class="xfn">commandes.xlsx</span>', '<span class="xn" id="xn">16 commandes</span>', "const HEAD = ['N°', 'Prénom', 'Nom', 'E-mail', 'Produit', 'Prix', 'Qté'];",
      "const COMMANDES = [[1, 1, 1, 2], [2, 1, 3, 1], [3, 2, 6, 1], [4, 3, 2, 3], [5, 4, 1, 1], [13, 1, 8, 1]];", '<div class="need-h">Trois sujets sur chaque ligne</div>',
      // Le fichier grossit à chaque commande ou demande, plusieurs équipes le modifient, les erreurs arrivent
      'À chaque nouvelle commande ou demande, le fichier s’alourdit', 'Difficile de s’y retrouver', 'Il est mis à jour par plusieurs personnes, de plusieurs équipes différentes.',
      "cur('tc1', 'tc-a', 1, '🚚', 'Logistique') + cur('tc2', 'tc-b', 0, '💬', 'Service client') + cur('tc3', 'tc-c', 1, '💼', 'Commercial')", 'Des erreurs apparaissent',
      // Un e-mail corrigé sur deux lignes seulement : deux e-mails pour la même cliente
      "const NOUVEL_EMAIL = 's.martin@mail.fr';", 'L’e-mail de Sophie Martin, commande par commande', 'Deux e-mails pour Sophie Martin',
      // Le découpage par sujet : ce qu’est une table (des lignes et des colonnes, un seul sujet), puis les trois tables
      "const GRP = ['k-co', 'k-cl', 'k-cl', 'k-cl', 'k-pr', 'k-pr', 'k-co'];",
      'Une <b>table</b> organise les données en lignes et en colonnes, comme dans un tableau Excel.',
      'Elle rassemble les informations sur <b>un même sujet</b> pour les retrouver et les mettre à jour facilement.',
      'On crée donc <b>trois tables</b> : clients, produits et commandes.', '<span>Trois tables</span>',
      // La base de données et le SGBD (ici SQLite), à qui les équipes envoient leurs requêtes SQL
      'Ensemble, ces tables forment<br>une <b>base de données</b>.', 'Elle est gérée par un <b>SGBD</b> : un système de gestion de base de données.',
      'Ici, le SGBD est <b>SQLite</b>.', 'Les équipes lui envoient des requêtes en <b>SQL</b> : il les exécute et contrôle chaque modification.',
      '<div class="sgs" id="sgs">Système de gestion de base de données</div>', '<span class="sgq" id="sgq">SQLite</span>', '<span>Base de données</span>',
      // La clé primaire : son nom complet, les deux Nathan, un identifiant déjà pris refusé, un client sans identifiant qui reçoit le suivant
      '<span class="emo">🔑</span>clé primaire', '<b class="nq k-cl">clients</b><i class="ndot">.</i><b class="nq nqc">id</b><span class="nlb">la table</span>',
      'Lequel des deux&nbsp;?', 'Le client 4&nbsp;: Nathan Petit', "const NOUVEAUX = [[4, 'Yanis', 'Roche'], [null, 'Lina', 'Garnier']];",
      'UNIQUE constraint failed: clients.id', '<span class="tys ko">✕ refusé</span>', 'Le SGBD y veille : un identifiant déjà pris est <b>refusé</b>',
      // … et sa déclaration : id INTEGER PRIMARY KEY, à la création de la table
      '<span class="fname">schema.sql</span>', 'id <span class="glow" id="pkt">INTEGER</span> <span class="glow" id="pkk"><span class="kw">PRIMARY KEY</span></span>,', 'avec <code>PRIMARY KEY</code> placé juste après le type de la colonne',
      // La clé étrangère : commandes.client_id → clients.id, puis la commande pour le client 99 refusée
      '<span class="emo">🔗</span>clé étrangère', '<b class="nq k-co">commandes</b><i class="ndot">.</i><b class="nq nqc">client_id</b><i class="narr">→</i><b class="nq k-cl">clients</b>',
      '<div class="stamp" id="stamp4">Relationnelle</div>', 'const CLIENT_INCONNU = 99;', '<span class="m">FOREIGN KEY constraint failed</span>',
      // … et sa déclaration : FOREIGN KEY (client_id) REFERENCES clients(id), rappelée quand la commande est refusée
      '<span class="kw">FOREIGN KEY</span> <span class="glow" id="fka">(client_id)</span>', '<span class="kw">REFERENCES</span> <span class="glow" id="fkb">clients(id)</span>',
      '<div class="abs fkp" id="fkp"><span class="codepill"><span class="kw">FOREIGN KEY</span> (client_id) <span class="kw">REFERENCES</span> clients(id)</span></div>', 'Le SGBD vérifie alors chaque lien : existe-t-il un client d’identifiant 99 ?',
      // Lire une table : SELECT * FROM clients, les 10 clients et leurs 9 colonnes
      '<span class="star glow" id="star6">*</span>', '10 lignes · 9 colonnes', '✓ La table est lue, jamais modifiée',
      // Choisir les colonnes : l’étoile devient prenom, nom, email ; les six autres colonnes se replient ; Sophie Martin, une seule fois ; la jointure, plus tard
      '<span id="cols7"><span class="glow" id="c7a">prenom</span><span class="cm" id="k7a">,</span> <span class="glow" id="c7b">nom</span>', "const KEEP = [1, 2, 6], DROP = [0, 3, 4, 5, 7, 8]",
      '10 lignes · 3 colonnes', 'dans l’ordre où on les écrit', '✓ Chaque client une seule fois', 'Sophie Martin n’a plus qu’un seul e-mail', '<span>Plus tard&nbsp;: la jointure</span>',
      // Deux pièges : sans virgule, un alias (AS sous-entendu) ; une virgule de trop, une erreur
      'une virgule entre deux colonnes', 'SELECT</span> prenom<span class="ghost" id="ghostAS"> <b>AS</b></span> email', 'la requête équivaut à <code>prenom AS email</code>',
      'Les prénoms, sous le titre <span class="ic">email</span>', 'near "FROM": syntax error',
      // Les trois idées : les tables, les clés (et leur déclaration), SELECT
      '<span class="ic blk">FOREIGN KEY (client_id)<br>&nbsp;&nbsp;REFERENCES clients(id)</span>', '<span class="ic blk">SELECT prenom, nom, email</span>']},
  {id: 2, next: 13, titre: 'Renommer avec AS', page: 'as.html', thumb: 'as-thumb.jpg', duree: '2 min 03', notesAt: 92.4,
    notes: /notes:\{t:115\.3,y:1330,card:\[64,356,1016,1017\],to:\[940,255\]\}/, table: 'produits',
    bubble: 'Avec <span class="ic">AS</span>, donne à une colonne un nom plus clair dans le résultat.',
    chapters: ['Situation', 'Le problème', 'Renommer une colonne', 'Plusieurs colonnes', 'Le piège des guillemets', 'Le résultat', 'À retenir'],
    traps: ['near "du": syntax error', 'near "(": syntax error', '"Nom du produit"']},
  {id: 13, next: 4, titre: 'DISTINCT', page: 'distinct.html', thumb: 'distinct-thumb.jpg', duree: '2 min 00', notesAt: 87.2,
    notes: /notes:\{t:112\.0,y:1277,card:\[64,356,1016,964\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">DISTINCT</span>, garde chaque valeur une seule fois.',
    chapters: ['Situation', 'Le problème', 'DISTINCT en action', 'Où le placer', 'Plusieurs colonnes', 'Le résultat', 'À retenir'],
    traps: ['near "DISTINCT": syntax error', 'Cette ville est-elle déjà dans le résultat ?', 'Paris + Sophie et Paris + Léa sont différentes']},
  {id: 5, next: 6, titre: 'Comparer des valeurs', page: 'comparer.html', thumb: 'comparer-thumb.jpg', duree: '2 min 18', notesAt: 102.2,
    notes: /notes:\{t:130\.4,y:1372,card:\[64,356,1016,1077\],to:\[940,255\]\}/, table: 'produits',
    bubble: 'Avec les opérateurs de comparaison, compare une colonne à une valeur.',
    chapters: ['Situation', 'Le problème', 'La comparaison', 'Six opérateurs', 'La limite', 'Comparer un texte', 'Le résultat', 'À retenir'],
    traps: ['<span class="kw">WHERE</span> stock <span class="cbox" id="eqA">=<i class="mbox"></i></span><span class="glow" id="leA">&lt;=</span> 60;',
      'Son stock est-il inférieur<br>ou égal à 60 ?', '<span class="kw">WHERE</span> stock &lt; 60', '<span class="kw">WHERE</span> stock &lt;= 60',
      "<span class=\"kw\">WHERE</span> categorie != <span class=\"str glow\" id=\"s6str\">'Accessoire'</span>;", 'Un texte, entre guillemets simples']},
  {id: 6, next: 22, titre: 'AND et OR', page: 'and-or.html', thumb: 'and-or-thumb.jpg', duree: '2 min 11', notesAt: 101.5,
    notes: /notes:\{t:123\.4,y:1420,card:\[64,356,1016,1130\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">AND</span> et <span class="ic">OR</span>, relie plusieurs conditions dans <span class="ic">WHERE</span>.',
    chapters: ['Situation', 'Le problème', 'Avec AND', 'Avec OR', 'Les parenthèses', 'Le résultat', 'À retenir'],
    traps: ['<span class="ln" id="ql4">  <span class="kw hlc" id="and3">AND</span> age &gt; 30;', '<b>Aucune ligne</b><span class="s">Une ville ne peut pas être Paris et Lyon à la fois.</span>',
      '<span class="op2">AND</span>', '<span class="op2">OR</span>', 'AND : calculé en premier', 'entre parenthèses : calculé en premier',
      '<span id="lp">(</span><span id="cP">ville = <span class="str">\'Paris\'</span></span> <span class="kw">OR</span> <span id="cL">ville = <span class="str">\'Lyon\'</span></span><span id="rp">)</span> <span class="kw" id="and5">AND</span> <span id="cA">age &gt; 30</span>']},
  {id: 22, next: 7, titre: 'NOT', page: 'not.html', thumb: 'not-thumb.jpg', duree: '2 min 13', notesAt: 97.2,
    notes: /notes:\{t:124\.9,y:1365,card:\[64,356,1016,1070\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">NOT</span>, inverse une condition : garde ce qu’elle écarte.',
    chapters: ['Situation', 'Le problème', 'NOT en action', 'NOT ou l’inverse', 'Les parenthèses', 'Le résultat', 'À retenir'],
    traps: ['<span class="kw">WHERE</span> <span class="kw glow" id="not3">NOT </span>', '<span id="dY">2023</span>-<span id="dM">03</span>-<span id="dD">01</span>',
      '<span class="cp"><span class="kw">NOT</span> ville = <span class="str">\'Paris\'</span></span>', 'ville <span class="hv">!=<i class="mbox"></i></span>&nbsp;<span class="str">\'Paris\'</span>',
      'date_inscription <span class="hv">&gt;=<i class="mbox"></i></span>&nbsp;<span class="str">\'2023-03-01\'</span>',
      '<span class="kw" id="not5">NOT</span> <span id="lp">(</span><span id="cP">ville = <span class="str">\'Paris\'</span></span> <span class="kw">AND</span> age &gt; 35<span id="rp">)</span>',
      'NOT inverse tout le groupe', 'NOT n’inverse que cette condition']},
  {id: 7, next: 8, titre: 'NULL', page: 'null.html', thumb: 'null-thumb.jpg', duree: '1 min 58', notesAt: 86.2,
    notes: /notes:\{t:110\.8,y:1270,card:\[64,356,1016,957\],to:\[940,255\]\}/, table: 'clients',
    bubble: '<span class="ic">IS NULL</span> retrouve les valeurs absentes.',
    chapters: ['Situation', 'Le problème', 'IS NULL en action', 'Le piège du = NULL', 'IS NOT NULL', 'Le résultat', 'À retenir'],
    traps: ['<span class="ln" id="ql3"><span class="kw">WHERE</span> email <span class="kw glow" id="isn3">IS NULL</span>;', '<span class="tv nul">NULL</span><b>aucune valeur</b>',
      '<span class="tv">\'\'</span><b>un texte vide</b>', '<span class="tv">0</span><b>le nombre zéro</b>', '<span class="kw">WHERE</span> email = <span class="kw">NULL</span>;',
      '<b>Aucune ligne</b><span class="s">NULL n’est égal à rien, pas même à NULL.</span>', '<span class="kw glow" id="isnn5">IS NOT NULL</span>', '2 + 8 = <em>10 clients</em>']},
  {id: 8, next: 9, titre: 'LIKE', page: 'like.html', thumb: 'like-thumb.jpg', duree: '2 min 25', notesAt: 101.7,
    notes: /notes:\{t:137\.1,y:1372,card:\[64,356,1016,1077\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">LIKE</span>, cherche un motif plutôt qu’une valeur exacte.',
    chapters: ['Situation', 'Le problème', 'LIKE en action', 'Où placer le %', 'Un seul caractère', 'Le résultat', 'À retenir'],
    traps: ['<span class="kw">WHERE</span> prenom <span class="cbox" id="eqA">=<i class="mbox"></i></span><span class="kw glow" id="likeA">LIKE</span>',
      '<span id="sophie">Sophie</span><span id="lA">L</span>', '<span class="eo">0</span><b>Aucune ligne</b>', "[['L', 0, 0], ['%', 1, 'end']]",
      'Son prénom commence-t-il par L ?', '<span class="kw">WHERE</span> nom <span class="kw">LIKE</span> <span class="str glow" id="strA4">\'D%\'</span>;',
      '<span class="str glow" id="strB4">\'%ie%\'</span>', '<span class="cpl">\'l%\'</span><span class="tx">ou</span><span class="cpl">\'L%\'</span>',
      '<span class="str">\'<span class="glow" id="us5">_</span>a%\'</span>', "[['_', 0, 0], ['a', 1, 1], ['%', 2, 'end']]",
      'n’importe quelle suite, <b>même vide</b>', '<b>exactement un</b> caractère']},
  {id: 9, next: 10, titre: 'IN', page: 'in.html', thumb: 'in-thumb.jpg', duree: '2 min 10', notesAt: 92.1,
    notes: /notes:\{t:122\.5,y:1359,card:\[64,356,1016,1064\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">IN</span>, compare une colonne à toute une liste de valeurs.',
    chapters: ['Situation', 'Le problème', 'IN en action', 'Écrire la liste', 'Une seule colonne', 'Le résultat', 'À retenir'],
    traps: ['<span class="ball">2</span><span class="ball">5</span><span class="ball">9</span>',
      '<span class="ln" id="ql4">   <span class="kw">OR</span> <span class="rep" id="r2">id =<i class="mbox"></i></span> 5', '<span class="x3" id="x3">× 3</span>',
      '<span class="kw glow" id="inA">IN</span> <span id="opA">(</span>2<span id="restA">, <span id="v5">5</span>, <span id="v9">9</span></span><span id="cpA">)</span>',
      'Son identifiant est-il dans la liste ?', '<div class="tg" id="tgP"><i>( )</i>entre parenthèses</div>',
      '(<span class="hv str" id="hS1">\'Paris\'<i class="mbox"></i></span>, <span class="hv str" id="hS2">\'Nantes\'<i class="mbox"></i></span>)',
      '<span class="ln5" id="m5b">  <span class="kw">AND</span> age &gt; 35;', '✓ 3 lots prêts à partir']},
  {id: 10, next: 11, titre: 'BETWEEN', page: 'between.html', thumb: 'between-thumb.jpg', duree: '2 min 19', notesAt: 98.4,
    notes: /notes:\{t:131\.2,y:1351,card:\[64,356,1016,1056\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec <span class="ic">BETWEEN</span>, garde les valeurs situées entre deux limites.',
    chapters: ['Situation', 'Le problème', 'BETWEEN en action', 'Limites incluses', 'Limites à l’envers', 'Le résultat', 'À retenir'],
    traps: ['<div class="inv-title">¡Gracias!</div>', '<span class="t1">¡Gracias!</span><span class="t2">Merci !</span>',
      '<span id="geA">&gt;=</span><span class="kw glow" id="btA">BETWEEN</span>', '<span id="dcB"><span class="rep" id="r2">date_commande<i class="mbox"></i></span> &lt;= </span>',
      '<span class="x2" id="x2">× 2</span>', 'Sa date est-elle dans l’intervalle ?', '<span class="op" id="op2">&lt;=</span>20 juillet · inclus',
      '<span class="str bad" id="bd1">\'2026-07-20\'</span>', 'À l’envers, l’intervalle est vide.', '✓ 4 confirmations renvoyées en français']},
  {id: 11, next: 12, titre: 'ORDER BY', page: 'order-by.html', thumb: 'order-by-thumb.jpg', duree: '2 min 10', notesAt: 95.8,
    notes: /notes:\{t:122\.5,y:1366,card:\[64,356,1016,1071\],to:\[940,255\]\}/, table: 'produits',
    bubble: 'Avec <span class="ic">ORDER BY</span>, range le résultat dans l’ordre voulu.',
    chapters: ['Situation', 'Le problème', 'ORDER BY en action', 'Le sens du tri', 'Deux critères', 'Le résultat', 'À retenir'],
    traps: ["[3,'Magnésium','Bien-être',19.9,500]", '<div class="inv-title">Stock saisi : 50<span id="z0">0</span></div>',
      '<span class="kw glow" id="obA">ORDER BY</span> stock<span class="sens" id="ascG"> <span class="gh">ASC</span></span><span class="sens" id="descA"> <span class="kw glow">DESC</span></span>;',
      '<span class="sus"><span class="emo">🔍</span>50 ou 500 ?</span>', '<span class="tx">30 → 500</span><span class="tx">500 → 30</span>',
      '<span class="tx">A → Z</span><span class="tx">Z → A</span>', '<span class="kw">ORDER BY</span> categorie, prix<span class="sens" id="descC"> <span class="kw glow">DESC</span></span>;',
      '✓ Vérifications prêtes']},
  {id: 12, next: 51, titre: 'LIMIT et OFFSET', page: 'limit-offset.html', thumb: 'limit-offset-thumb.jpg', duree: '3 min 01', notesAt: 142.2,
    notes: /notes:\{t:173\.0,y:1372,card:\[64,356,1016,1077\],to:\[940,255\]\}/, table: 'produits',
    bubble: 'Avec <span class="ic">LIMIT</span> et <span class="ic">OFFSET</span>, tu affiches seulement la partie du résultat qui t’intéresse.',
    chapters: ['Situation', 'Le problème', 'LIMIT en action', 'Sauter avec OFFSET', 'Un classement stable', 'Le résultat', 'À quoi ça sert', 'À retenir'],
    traps: ['<div class="more"><span class="emo">⬇️</span>Voir plus</div>', '<div class="pc sk"><span class="pi">?</span>',
      '<span class="kw glow" id="limA">LIMIT</span> 3<span id="offA"> <span class="kw glow">OFFSET</span> 3</span>;',
      '<b>Pas les 3 plus chers</b><span class="s">L’ordre de ces lignes n’est pas garanti.</span>', '<span id="fc1"><b>OFFSET 3</b>· page 2</span>',
      '— plus aucune ligne —', 'Imaginons l’Oméga 3 à 29,90 €', '<span class="kw">ORDER BY</span> prix <span class="kw">DESC</span><span id="idC">, id</span>;',
      '✕ Oméga 3 : jamais affiché', '✓ 3 produits de plus',
      // Ce que font LIMIT et OFFSET, en deux légendes
      '"<code>LIMIT</code> indique combien de lignes récupérer, et <code>OFFSET</code> combien de lignes sauter au début du résultat."',
      '"La <b>table produits</b> reste inchangée."',
      // À quoi ça sert : le site web reste à l’écran (une requête par portion de 3), puis rejoint la liste des usages
      "telephone('#ph7', CLASSEMENT.slice(3, 6).map(fiche).join(''));", "sceneOff('#s6', 99.0);\n  sceneOn('#use', 99.0);",
      '<b>Portion 1</b><span class="ic">OFFSET 0</span>', '<b>Portion 2</b><span class="ic">OFFSET 3</span>', '<b>Portion 3</b><span class="bks">pas encore chargée</span>',
      '"Les produits arrivent ainsi <b>par portions</b> de 3 : une requête par portion."',
      '"C’est utile pour afficher ou récupérer<br>des résultats <b>par portions</b>, sans tout charger d’un coup."',
      '<b>Sites web et applications</b><span class="rs">Pages de résultats, recherche, bouton&nbsp;« Voir plus ».</span>',
      '<b>Logiciels métier</b><span class="rs">Consulter les clients ou les factures par groupes de 20.</span>',
      '<b>Tableaux de bord</b><span class="rs">Parcourir une longue liste de commandes.</span>',
      '<b>API</b><span class="rs">Renvoyer une portion des résultats à chaque demande.</span>',
      '<b>Scripts de traitement</b><span class="rs">Récupérer des données par lots.</span>']},
  {id: 51, next: 52, titre: 'Fonctions de texte', page: 'fonctions-texte.html', thumb: 'fonctions-texte-thumb.jpg', duree: '2 min 36', notesAt: 134.0,
    notes: /notes:\{t:148\.1,y:1371,card:\[64,300,1016,1076\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Les fonctions de texte permettent<br>de transformer le contenu d’une colonne<br>pour obtenir le texte dont tu as besoin.',
    chapters: ['Situation', 'Le problème', 'UPPER en action', 'Assembler avec ||', 'Une fonction par besoin', 'Le résultat', 'À retenir'],
    traps: ['<div class="tagpill">Cours · Fonctions et expressions</div>', '<div class="lb-f" id="f1"><span class="ph">NOM Prénom</span></div>',
      '<span class="fx" id="fxA"><span class="kw glow">UPPER</span>(</span>nom<span class="fx" id="fxB">)</span>',
      '<span class="fv"><span class="sw"><span class="a">?</span><span class="b">MARTIN</span></span></span>', '🔒 La table clients ne change pas',
      '<span class="str glow" id="sp4">\' \'</span>', '<div class="joined" id="jn4"><span>MARTIN Sophie</span></div>',
      '<b>Résultat : 0</b><span class="s">Le + additionne des nombres, pas des textes.</span>',
      '<span class="fc">LENGTH</span><span class="fl"><span class="tx">Sophie</span>', '<span class="fc">SUBSTR</span><span class="fl"><span class="tx">Martin</span>',
      '"<code>SUBSTR(nom, 1, 3)</code> récupère les 3 premiers caractères du nom."',
      '"<code>REPLACE</code> permet de remplacer des caractères dans un texte."', '"Ici, il supprime les espaces du numéro\\u00a0de téléphone."',
      '<span class="fi"><span class="ic">SUBSTR</span>récupère une partie du texte</span>', '<span class="fi"><span class="ic">REPLACE</span>remplace des caractères</span>',
      'hold(2.3, 4.6);', '<meta name="format-detection" content="telephone=no">', '✓ 10 étiquettes prêtes',
      'function ean13Svg(code){', "const bar = ean13Svg('3760123456784');", '.lb-bar svg{display:block;width:100%;height:100%}']},
  {id: 52, next: 53, titre: 'Fonctions numériques', page: 'fonctions-numeriques.html', thumb: 'fonctions-numeriques-thumb.jpg', duree: '2 min 31', notesAt: 132.6,
    notes: /notes:\{t:143\.4,y:1365,card:\[64,356,1016,1070\],to:\[940,255\]\}/, table: 'produits',
    bubble: 'Les fonctions numériques permettent<br><span class="nw">d’effectuer des opérations sur les nombres.</span>',
    chapters: ['Situation', 'Le problème', 'FLOOR en action', 'Calculer', 'Trois façons d’arrondir', 'Le résultat', 'À retenir'],
    traps: ['<div class="ly-pts">120 <small>points</small></div>', '<span>🎯 1 point par euro entier</span>', '<span class="pc-val"><span class="a">+ ? points</span></span>',
      "const prixHtml = v => { const [e, c] = String(v).split('.'); return e + (c ? `<span class=\"dec\">.${c}</span>` : ''); };",
      '<span class="fx" id="fxA">, <span class="kw glow">FLOOR</span>(prix) <span class="kw">AS</span> points</span>',
      '<span class="fv"><span class="sw"><span class="a">?</span><span class="b">29</span></span></span>',
      '<b>Un point de trop</b><span class="s">ROUND arrondit au plus proche : 29,90 donne 30.</span>', '<div class="joined" id="jn4"><span>58 points</span></div>',
      '<span class="oc">%</span><span class="ol">le reste</span><span class="fl"><span class="tx">80 % 6</span><span class="ar">→</span><span class="tx o">2</span></span>',
      '<span>📦 80 unités : 13 cartons de 6, reste 2</span>', '<span class="kp">CEIL</span><span class="kn">toujours vers le haut</span>', '✓ Points affichés sur les 8 fiches',
      '"Chez NutriBoost, chaque euro entier dépensé rapporte <b>1 point de fidélité</b>."', '"Les centimes ne rapportent<br><b>pas de points</b>."',
      '"Un produit à 29,90 € donnerait des points avec des décimales si l’on utilisait directement son prix."',
      '"Or les points de fidélité <span class=\\"nw\\">doivent être <b>entiers</b></span>."',
      '"Pendant la semaine des <b>points doublés</b>, organisée une fois dans l’année, <span class=\\"nw\\">seuls les euros entiers comptent</span>."',
      '"<code>FLOOR(prix)</code> retire les centimes, <span class=\\"nw\\">puis ×\\u00a02</span> calcule les points gagnés."', 'hold(2.3, 2.6);',
      '"Sur chaque fiche produit, le site web veut afficher les points gagnés à l’achat."']},
  {id: 53, next: 54, titre: 'Fonctions de dates et heures', page: 'fonctions-dates.html', thumb: 'fonctions-dates-thumb.jpg', duree: '2 min 30', notesAt: 131.5,
    notes: /notes:\{t:142\.6,y:1362,card:\[64,356,1016,1067\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Les fonctions de dates et heures permettent<br><span class="nw">d’extraire, de transformer et de comparer</span><br><span class="nw">les dates et les heures dans tes données.</span>',
    chapters: ['Situation', 'Le problème', 'DATE en action', 'Le calendrier', 'Changer l’affichage', 'Le résultat', 'À retenir'],
    traps: ['<div class="abs title"><span>J</span><span>+</span><span>7</span></div>', '<span>⏳ 7 jours plus tard</span>', '<div class="ml-f"><span>Envoi prévu le</span><span class="ml-val">?</span></div>',
      '<i class="qcol" id="qS">?</i>', '<span class="kw glow" id="dtA">DATE</span>(date_commande, <span class="str">\'+7 days\'</span>) <span class="kw">AS</span> suivi',
      '<span class="fv"><span class="sw"><span class="a">?</span><span class="b">2026-07-09</span></span></span>',
      '<span class="pt">2026<span class="dim">-07-02</span></span><span class="pj">+</span><span class="pt">7</span>', '<b>Résultat : 2033</b><span class="s">La date est lue comme le nombre 2026.</span>',
      '<span class="cp bad" id="bad4">✕ <s>2026-07-35</s></span><span class="cp good" id="good4">✓ 2026-08-04</span>',
      '<span class="dc">\'+1 month\'</span>', '<span class="dc">\'%d/%m/%Y\'</span><span class="ol">à la française</span>', '<span class="dc">\'%d\'</span><span class="ol">le jour</span>', '<span class="ic">STRFTIME()</span> change<br>l’<b>affichage</b> d’une date&nbsp;:', '✓ 16 messages planifiés']},
  {id: 54, next: 21, titre: 'Fonctions de conversion de types', page: 'conversion-types.html', thumb: 'conversion-types-thumb.jpg', duree: '2 min 45', notesAt: 148.4,
    notes: /notes:\{t:155\.9,y:1347,card:\[64,300,1016,1052\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec <span class="ic">CAST</span>, change le type d’une valeur.',
    chapters: ['Situation', 'Le problème', 'CAST en action', 'Extraire, puis convertir', 'Les types', 'Le résultat', 'À retenir'],
    traps: ['<div class="ap-in" id="in1"><span id="ty1">CMD-2026-1002481</span></div>', '✕ Nombre entier attendu, par exemple <b>1002481</b>',
      '<span class="kw">typeof</span>(numero_commande) <span class="kw">AS</span> type',
      '<span class="sw"><span class="a">?</span><span class="b">1002481<span class="tp i">integer</span></span></span>',
      '<span class="kw">CAST</span>(numero_commande <span class="kw">AS INTEGER</span>)', '<b>Résultat : 0</b><span class="s">Le texte commence par des lettres.</span>',
      '<span id="pre4">CMD-2026-</span><span class="dig" id="dig4">1002481', '<span class="fk cd"><span class="kw">SUBSTR</span>(numero_commande, 10)</span>',
      '<span class="tcp">REAL</span><span class="tl">nombre à virgule</span><span class="tx">29.9</span>', 'Les décimales sont supprimées, sans arrondir',
      '<span class="ln" id="s6l4">  <span class="kw">typeof</span>(', '<div class="rgT th"><div>numero_commande</div><div>numero</div><div>type</div></div>',
      '✓ Nombre entier : numéro accepté', '✓ 16 commandes importées']},
  {id: 21, next: 23, titre: 'CASE', page: 'case.html', thumb: 'case-thumb.jpg', duree: '2 min 35', notesAt: 141.5,
    notes: /notes:\{t:147\.7,y:1306,card:\[64,356,1016,1011\],to:\[940,255\]\}/, table: 'produits',
    bubble: 'Avec <span class="ic">CASE</span>, affiche une valeur selon une condition.',
    chapters: ['Situation', 'Le problème', 'CASE en action', 'L’ordre compte', 'Sans ELSE', 'Le résultat', 'À retenir'],
    traps: ['<span>Entrepôt · Tableau de bord</span>', "const ALERTE = s => s < 50 ? 'r' : s < 100 ? 'o' : 'g';",
      '<span class="nl">Son alerte</span><span class="tag calc">à calculer</span>', '<span class="kw">WHERE</span> <span class="glow" id="wh2">stock &lt; 50</span>;',
      '<div class="tr gh" id="gh2">✕ 6 autres produits écartés</div>',
      '<span class="sw c" id="sw3a"><span class="a">stock</span><span class="b nv">90</span></span> &lt; 50</span>', '<span class="b al o">À surveiller</span>',
      '<span>Dans le mauvais ordre</span>', '<b>Aucun produit « À commander »</b><span class="s">Sous 50, le stock est aussi sous 100.</span>',
      '<span class="a com">  -- pas de ELSE</span>', '<span class="nul" id="nul5">NULL</span>',
      '<span class="glow" id="as6"><span class="kw">AS</span> alerte</span>', '✓ 8 alertes à jour']},
  {id: 23, next: 14, titre: 'COALESCE', page: 'coalesce.html', thumb: 'coalesce-thumb.jpg', duree: '2 min 29', notesAt: 135.9,
    notes: /notes:\{t:141\.7,y:1270,card:\[64,356,1016,957\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">COALESCE</span>, remplace un <span class="ic">NULL</span> par une autre valeur.',
    chapters: ['Situation', 'Le problème', 'COALESCE en action', 'Plusieurs valeurs', 'Le texte vide', 'Le résultat', 'À retenir'],
    traps: ['<span>Support · Fiches clients</span>', '<span class="sw st"><span class="a ec"></span><span class="b nr">Non renseigné</span></span>',
      '<span class="nl">Son email ou « Non renseigné »</span><span class="tag calc">à calculer</span>', '<span class="nul">NULL</span><span class="ph2">?</span>',
      '<span class="kw glow" id="k3">COALESCE</span>(<span class="glow" id="a3a">email</span>, <span class="str glow" id="a3b">\'Non renseigné\'</span>)',
      '<span class="vb vn" id="v21"><span class="nul">NULL</span><i class="mk no" id="m21">✕</i></span>',
      '<span class="glow" id="a4b">telephone</span>,', '<span class="b">06 39 98 68 03</span>',
      '<span>NULL ou texte vide&nbsp;?</span>', '(<span class="str glow" id="q5">\'\'</span>, <span class="str">\'Non renseigné\'</span>)',
      '<b>La case reste vide</b><span class="s">Un texte vide n’est jamais remplacé.</span>',
      '<span class="kw">AS</span> email', '✓ Aucune case vide à l’écran', 'La table clients ne change pas']},
  {id: 14, next: 16, titre: 'COUNT', page: 'count.html', thumb: 'count-thumb.jpg', duree: '2 min 18', notesAt: 125.1,
    notes: /notes:\{t:130\.9,y:1365,card:\[64,356,1016,1070\],to:\[940,255\]\}/, table: 'produits',
    bubble: 'Avec <span class="ic">COUNT</span>, compte les lignes au lieu de les afficher.',
    chapters: ['Situation', 'Le problème', 'COUNT(*) en action', 'Valeurs différentes', 'Compter une partie', 'Le résultat', 'À retenir'],
    traps: ['<span>Entrepôt · Tableau de bord</span>', '<span class="nl">Les produits à commander</span><span class="tag calc">à calculer</span>',
      '<div class="tr gh" id="gh2">+ 1 nouveau produit&nbsp;: tout recompter&nbsp;?</div>', '<span>Un compteur qui avance</span>', '<span class="cnum" id="cnum3"></span>',
      '<span class="glow" id="c3b"><span class="kw">COUNT</span>(email)</span>', '<span class="vv" id="v3a">10</span>', '<span class="vv" id="v3b">8</span>',
      '<span class="x">✕ email ignoré</span>', '<span>Les catégories des 8 produits</span>', '<span class="kw glow" id="d4">DISTINCT</span> categorie)',
      '<span class="sw" id="sw4"><span class="a">?</span><span class="b">5</span></span>', '<span class="kw">WHERE</span> <span class="glow" id="w5">stock &lt; 50</span>;',
      '<span class="glow" id="as6b"><span class="kw">AS</span> categories</span>', '✓ Compteurs à jour']},
  {id: 16, next: 17, titre: 'GROUP BY', page: 'group-by.html', thumb: 'group-by-thumb.jpg', duree: '2 min 20', notesAt: 126.3,
    notes: /notes:\{t:132\.1,y:1312,card:\[64,356,1016,1017\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">GROUP BY</span>, calcule un résultat pour chaque groupe.',
    chapters: ['Situation', 'Le problème', 'GROUP BY en action', 'Un calcul par groupe', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span>Conseillers · Répartition par ville</span>', '<span class="nl">Son nombre de clients</span><span class="tag calc">à calculer</span>',
      '<span>Un nombre pour chaque ville&nbsp;?</span>', '<span class="vv" id="v2">10</span>',
      '<span class="glow" id="gb3"><span class="kw">GROUP BY</span> ville</span>', '<span class="b"><span class="emo">🧺</span>&nbsp;6 groupes, un par ville</span>',
      '<span class="chip v-lyo"><i class="cd"></i>Lucas Bernard · 28 ans</span><span class="chip v-lyo"><i class="cd"></i>Hugo Laurent · 52 ans</span>',
      '<span class="glow" id="ag4"><span class="kw">AVG</span>(age)</span>', 'Lyon&nbsp;: (28 + 52) ÷ 2 = <b>40</b>',
      '<span class="glow" id="pn5">prenom</span>, ville, <span class="kw">COUNT</span>(*)', '<span class="vv" id="so5">Sophie</span>',
      '<span class="ok">SQLite&nbsp;: un prénom au choix</span><span class="ko">Autres bases&nbsp;: une erreur</span>', '<span class="cv">✕ ni l’un ni l’autre</span>',
      '<span class="glow" id="as6"><span class="kw">AS</span> nb_clients</span>', '✓ Paris en tête avec 4 clients']},
  {id: 17, next: 76, titre: 'HAVING', page: 'having.html', thumb: 'having-thumb.jpg', duree: '2 min 26', notesAt: 131.4,
    notes: /notes:\{t:138\.5,y:1335,card:\[64,300,1016,1040\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">HAVING</span>, filtre les groupes formés par <span class="ic">GROUP BY</span>.',
    chapters: ['Situation', 'Le problème', 'HAVING en action', 'WHERE ou HAVING', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span class="emo">🪷</span><span>Ateliers bien-être · Choix des villes</span>', '<span class="emo">🧘</span>Un atelier dès 2 clients', '<span class="pd emo">🧘</span>',
      '<span class="nl">Son nombre de clients</span><span class="tag calc">à calculer</span>', 'Garder les villes d’au moins 2 clients',
      '<span class="glow" id="hv3"><span class="kw">HAVING</span> <span class="kw">COUNT</span>(*) &gt;= 2</span>;', 'Ici, seules les villes comptant <b>au moins 2 clients</b> sont retenues.',
      '<span class="b"><span class="emo">🎯</span>&nbsp;Le test&nbsp;: <code>COUNT(*) &gt;= 2</code></span>', "n >= SEUIL ? '✓ gardé' : '✕ écarté'",
      '<span class="glow" id="wa4"><span class="kw">WHERE</span> age &gt;= 30</span>', '<span class="sp4 l" id="sp4a" style="top:127px">trie les lignes</span>',
      '<span class="emo">🎂</span>&nbsp;7 clients de 30 ans ou plus</span>', '<span class="kw">WHERE</span> <span class="glow" id="cw5"><span class="kw">COUNT</span>(*) &gt;= 2</span>',
      '<b>Erreur SQL</b><span class="m">misuse of aggregate: COUNT()</span>', '<span class="sk">HAVING</span><span class="sx">trie les groupes</span><span class="sc ok" id="sc5c">COUNT(*) ✓</span>',
      '<span class="glow" id="as6"><span class="kw">AS</span> nb_clients</span>', '✓ 2 ateliers&nbsp;: Paris et Lyon']},
  {id: 76, next: 18, titre: 'GROUP_CONCAT', page: 'group-concat.html', thumb: 'group-concat-thumb.jpg', duree: '2 min 48', notesAt: 150.2,
    notes: /notes:\{t:159\.9,y:1367,card:\[64,300,1016,1072\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec <span class="ic">GROUP_CONCAT</span>, liste les valeurs de chaque groupe.',
    chapters: ['Situation', 'Le problème', 'GROUP_CONCAT en action', 'Séparateur et NULL', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span>Entrepôt · Suivi des commandes</span>', '<span class="nl">La liste de ses commandes</span><span class="tag calc">à calculer</span>',
      '<span class="emo">🎯</span>Lister les commandes de chaque statut', "const liste = s => idsDe(s).join(', ');",
      '<span class="glow" id="gc3"><span class="kw">GROUP_CONCAT</span>(<span class="hw" id="ci3">id</span>, <span class="str hw" id="cs3">\', \'</span>)</span>',
      '<span class="b"><span class="emo">🧵</span>&nbsp;Une seule cellule par groupe</span>', '<span class="dc"><span class="kw">GROUP_CONCAT</span>(id)</span>',
      '<span class="snote" id="sn4">une virgule sans espace</span>', '<span class="vc nul" id="vn4"><small>commande n°16</small><b>NULL</b>', '<span class="b">4, 1, 3, 5</span>',
      '<span class="glow" id="ob5"><span class="kw">ORDER BY</span> statut <span class="kw">DESC</span></span>', '<span class="b">16, 15, 14, 13, 12</span>',
      '<span class="glow" id="as6"><span class="kw">AS</span> commandes</span>', '✓ 16 commandes, chacune sous son statut']},
  {id: 18, next: 20, titre: 'INNER JOIN', page: 'inner-join.html', thumb: 'inner-join-thumb.jpg', duree: '2 min 21', notesAt: 120.9,
    notes: /notes:\{t:133\.3,y:1365,card:\[64,300,1016,1070\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec <span class="ic">INNER JOIN</span>, seules les lignes<br>qui ont une correspondance<br>dans l’autre table sont conservées.',
    chapters: ['Situation', 'Le problème', 'INNER JOIN en action', 'Sans correspondance', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span>Entrepôt · Étiquettes d’expédition</span><span class="tb" id="tb1">table commandes</span>', 'const PREP = [[12, 4], [13, 1], [14, 3], [15, 5], [16, null]];',
      '<span class="kw">WHERE</span> statut = <span class="str">\'en_preparation\'</span>;', '<span class="glow" id="j3"><span class="kw">INNER JOIN</span> clients</span>',
      '<span class="kw">ON</span> <span class="glow" id="o3a">commandes.client_id</span> = <span class="glow" id="o3b">clients.id</span>',
      '<div class="rgJ grp"><div class="gc cm">commandes</div><div class="gc cl">clients</div></div>',
      '<span class="qm" id="qm4"><span class="sw"><span class="a">?</span><span class="b">✕</span></span></span>',
      '<b>Erreur SQL</b><span class="m">ambiguous column name: id</span>', '<span class="glow" id="id5"><span id="pre5">commandes.</span>id</span>, prenom, nom',
      '<span>🤝 4 correspondances, 4 lignes</span>', '✓ 4 étiquettes imprimées']},
  {id: 20, next: 38, titre: 'LEFT JOIN', page: 'left-join.html', thumb: 'left-join-thumb.jpg', duree: '2 min 43', notesAt: 145.4,
    notes: /notes:\{t:155\.2,y:1370,card:\[64,300,1016,1075\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">LEFT JOIN</span>, garde aussi les lignes sans correspondance.',
    chapters: ['Situation', 'Le problème', 'LEFT JOIN en action', 'Clients sans carte', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span>Bilan fidélité</span><span class="tb" id="tb1">table clients</span>', 'const CARTES = [[1, 1, 120], [2, 2, 80], [3, 4, 250], [4, 7, 160]];',
      '<span class="glow" id="j2"><span class="kw">INNER JOIN</span> fidelite</span>', '<span class="glow" id="f3"><span class="kw">FROM</span> clients</span>',
      '<span class="glow" id="lw3">LEFT</span>', '<span class="glow" id="o3"><span class="kw">ON</span> clients.id = fidelite.client_id</span>', '<span>👥 10 clients, 10 lignes</span>',
      '<span class="glow" id="w4"><span class="kw">WHERE</span> fidelite.id <span class="kw">IS NULL</span></span>',
      '<span class="glow" id="f5"><span class="kw">FROM</span> fidelite</span>', 'Les 6 clients sans carte ont disparu', '✓ 4 clients sur 10 ont une carte']},
  {id: 38, next: 39, titre: 'RIGHT JOIN', page: 'right-join.html', thumb: 'right-join-thumb.jpg', duree: '3 min 22', notesAt: 183.1,
    notes: /notes:\{t:194\.7,y:1344,card:\[64,292,1016,1049\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec <span class="ic">RIGHT JOIN</span>, toutes les lignes<br>de la table de droite sont conservées.',
    chapters: ['Situation', 'Le problème', 'RIGHT JOIN en action', 'Commande sans client', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span>Export de l’été</span><span class="tb tc" id="tb1">table commandes</span>', "const ORDRE = [1, 2, 13, 3, 10, 4, 14, 5, 12, 6, 15, 7, 8, 9, 11, 16];",
      '<span class="glow" id="j2"><span class="kw">INNER JOIN</span> commandes</span>', '<span class="kw"><span class="glow" id="rw3">RIGHT</span> JOIN</span> <span class="glow" id="t3">commandes</span>',
      '<span class="glow" id="o3"><span class="kw">ON</span> clients.id = commandes.client_id</span>', '<span>🧾 16 commandes, 16 lignes</span>',
      '<span class="glow" id="w4"><span class="kw">WHERE</span> clients.id <span class="kw">IS NULL</span></span>',
      '<span class="kw">RIGHT JOIN</span> <span class="glow" id="c5">clients</span>', 'La commande n°16 a disparu', '✓ 16 commandes exportées, dont 1 sans client']},
  {id: 39, next: 40, titre: 'FULL OUTER JOIN', page: 'full-outer-join.html', thumb: 'full-outer-join-thumb.jpg', duree: '3 min 15', notesAt: 175.6,
    notes: /notes:\{t:187\.5,y:1377,card:\[64,292,1016,1082\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">FULL OUTER JOIN</span>, toutes les lignes<br>des deux tables sont conservées.',
    chapters: ['Situation', 'Le problème', 'FULL OUTER JOIN en action', 'Sans correspondance', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span>Audit de la base</span><span class="tb" id="tb1">table clients</span>', 'const ORDRE = [[1, 1], [1, 2], [1, 13], [2, 3], [2, 10], [3, 4], [3, 14], [4, 5], [4, 12], [5, 6], [5, 15], [6, 7], [7, 8], [7, 9], [8, 11],',
      '<span class="glow" id="l2"><span class="kw">LEFT JOIN</span></span>', '<span class="glow" id="r2"><span class="kw">RIGHT JOIN</span></span>',
      '<span class="kw"><span class="glow" id="fo3">FULL OUTER</span> JOIN</span> commandes', '<span class="glow" id="o3"><span class="kw">ON</span> clients.id = commandes.client_id</span>',
      '<span>↔️ Aucune ligne n’est exclue</span>', '<span>🚫 NULL en l’absence de correspondance</span>', '<span class="bl">correspondances, une ligne chacune</span>',
      '✓ Aucune ligne oubliée, 3 à vérifier']},
  {id: 40, next: 19, titre: 'CROSS JOIN', page: 'cross-join.html', thumb: 'cross-join-thumb.jpg', duree: '2 min 40', notesAt: 140.4,
    notes: /notes:\{t:152\.2,y:1185,card:\[64,292,1016,890\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">CROSS JOIN</span>, chaque ligne d’une table<br>est associée à chaque ligne de l’autre.',
    chapters: ['Situation', 'Le problème', 'CROSS JOIN en action', 'Les doublons', 'Le résultat', 'À retenir'],
    traps: ['<span>Catalogue des offres</span><span class="tb" id="tb1">table clients</span>', 'const DOUBLONS = [4, 6, 7, 10];',
      '<span class="glow" id="j2"><span class="kw">INNER JOIN</span></span> produits', '<span class="b"><span class="emo">✕</span>Aucune ne contient une ville</span>',
      '<span class="glow" id="cj3"><span class="kw">CROSS JOIN</span></span> produits', '<span class="vi"><span class="emo">✖️</span>Pas de <span class="ic">ON</span>&nbsp;: aucune condition</span>',
      '<span id="d4" class="glow"><span class="kw">DISTINCT</span> </span>', '<span class="ic blk sm">6 villes × 8 produits = 48 combinaisons</span>',
      '✓ Chaque produit, dans chaque ville']},
  {id: 19, next: 41, titre: 'Jointure de 3 tables', page: 'jointure-3-tables.html', thumb: 'jointure-3-tables-thumb.jpg', duree: '3 min 38', notesAt: '196.7',
    notes: /notes:\{t:210\.4,y:1149,card:\[64,292,1016,854\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Pour relier trois tables, enchaîne<br>les jointures&nbsp;: chaque <span class="ic">JOIN</span> ajoute une table.',
    chapters: ['Situation', 'Le problème', 'Deux JOIN en action', 'Filtrer', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span class="pn">Magnésium</span><span class="ps" id="ps1"><span class="emo">⚠️</span>lot défectueux</span>', "const PIEGE = [[3, '2026-07-08'], [3, '2026-07-30']];",
      '<div>client_id<span class="qb" id="qb2c">?</span></div>', '<span class="glow" id="j3a"><span class="kw">INNER JOIN</span> clients</span>',
      '<span class="glow" id="o3b"><span class="kw">ON</span> commandes.produit_id = produits.id</span>', '<span class="k1 c" id="k3c">1</span><span class="k1 p" id="k3p">3</span>',
      '<span id="w4" class="glow"><span class="kw">WHERE</span> <span id="pn4">produits.nom</span>', '<span class="bad" id="b5">clients.id = produits.id</span>',
      '<span class="orph" id="op5b"><span class="emo">✕</span>Sophie Martin et Lucas Bernard oubliés</span>',
      '<span class="qx" id="qx6">sa qualité est compromise</span>', '<span class="of" id="of6a"><span class="emo">💶</span>Le remboursement du produit</span>',
      '✓ 2 emails envoyés']},
  {id: 41, next: 42, titre: 'JOIN + GROUP BY', page: 'join-group-by.html', thumb: 'join-group-by-thumb.jpg', duree: '2 min 50', notesAt: 150.7,
    notes: /notes:\{t:162\.2,y:1346,card:\[64,292,1016,1051\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Relie d’abord les tables avec <span class="ic">JOIN</span>,<br>puis regroupe avec <span class="ic">GROUP BY</span>.',
    chapters: ['Situation', 'Le problème', 'JOIN + GROUP BY en action', 'Le bon ordre', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span>Rapport commercial</span><span class="tb" id="tb1">table clients</span>', "const GROUPES = [['Bordeaux', 2], ['Lyon', 3], ['Marseille', 2], ['Paris', 7], ['Toulouse', 1]];",
      '<span class="kw">FROM</span> clients <span class="glow" id="g2a"><span class="kw">GROUP BY</span> ville</span>;', '<span class="m">no such column: ville</span>',
      '<span class="glow" id="j3"><span class="kw">INNER JOIN</span> commandes</span>', '<span class="sw" id="tt3"><span class="a">Après le JOIN</span><span class="b">Après GROUP BY et COUNT()</span></span>',
      '<span class="m">near "INNER": syntax error</span>', '<span class="nt rd" id="nt5b">↑ les 15 commandes d’un coup</span>',
      '<span>Nantes&nbsp;: aucune commande, donc aucune ligne</span>', '✓ Paris en tête, devant Lyon']},
  {id: 42, next: 49, titre: 'SELF JOIN', page: 'self-join.html', thumb: 'self-join-thumb.jpg', duree: '2 min 58', notesAt: 158.4,
    notes: /notes:\{t:170\.2,y:1203,card:\[64,292,1016,908\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec un <span class="ic">SELF JOIN</span>, une table<br>est reliée à <span class="nw">elle-même</span>.',
    chapters: ['Situation', 'Le problème', 'SELF JOIN en action', 'Avec elle-même', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span>Commandes reçues</span><span class="tb tc" id="tb1">table commandes</span>', 'const PAIRES = [[1, 2], [8, 9]];',
      '<span class="m">ambiguous column name: commandes.id</span>', '<span class="glow" id="a3a"><span class="kw">AS</span> c1</span>',
      '<span class="glow" id="d3"><span class="kw">AND</span> c1.date_commande = c2.date_commande</span>', '<span class="dp rd">elle-même</span>',
      '<span class="sw" id="op5"><span class="a">&lt;&gt;</span><span class="b">&lt;</span></span>',
      '<span class="glow" id="w6"><span class="kw">AND</span> c1.id &lt; c2.id</span>', '✓ 2 colis au lieu de 4']},
  {id: 49, next: 44, titre: 'Plusieurs conditions dans ON', page: 'plusieurs-conditions-on.html', thumb: 'plusieurs-conditions-on-thumb.jpg', duree: '3 min 17', notesAt: 177.6,
    notes: /notes:\{t:191\.8,y:1340,card:\[64,292,1016,1045\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec <span class="ic">AND</span>, une jointure peut vérifier<br>plusieurs conditions à la fois.',
    chapters: ['Situation', 'Le problème', 'AND en action', 'Une troisième condition', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span>Coursier express</span><span class="tb tc" id="tb1">table commandes</span>', "const PARIS = LIGNES.filter(l => l[3] === 'Paris');",
      '<span class="glow" id="o2"><span class="kw">ON</span> commandes.client_id = clients.id</span>;',
      '<span class="glow" id="a3"><span class="kw">AND</span> clients.ville = <span class="str">\'Paris\'</span></span>',
      '<span class="ck-out no"><span class="sw"><span class="a">?</span><span class="b">✕ Pas reliées</span></span></span>',
      '<span class="glow" id="w4"><span class="kw">AND</span> commandes.statut = <span class="str">\'en_preparation\'</span></span>',
      '<span class="glow" id="or5"><span class="kw">OR</span> clients.ville = <span class="str">\'Paris\'</span></span>', '<span class="n5">72 lignes</span>',
      '✓ 2 commandes pour le coursier', '<span class="c">Lyon ✕</span>', '"À ne pas confondre : 13 est l’identifiant de la commande, 1 celui de la cliente."',
      '"Première condition :<br>la commande n°13 appartient-elle<br>à la cliente Sophie Martin ?"', '"Deuxième condition :<br>Sophie Martin habite-t-elle à Paris ?<br>Oui, sa ville est Paris."',
      '<span class="bike" id="bike6"><span class="emo">🛵</span></span>', '<span class="lvr">✓ Livrée</span>']},
  {id: 44, next: 45, titre: 'Quel JOIN choisir ?', page: 'quel-join-choisir.html', thumb: 'quel-join-choisir-thumb.jpg', duree: '3 min 46', notesAt: 218.5,
    notes: /notes:\{t:217\.5,y:1396,card:\[64,292,1016,1101\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Six situations de la vie courante&nbsp;:<br>à toi de choisir le bon <span class="ic">JOIN</span>.',
    chapters: ['Le cabinet des Tilleuls', 'L’aquarium de l’Atlas', 'La bibliothèque des Lumières', 'L’hôtel des Cimes', 'Le glacier parisien', 'L’agence Horizon', 'À retenir'],
    traps: ["const SAL = [[1, 'Nadia Benali', N], [2, 'Hugo Lefèvre', 1], [3, 'Inès Fabre', 2], [4, 'Théo Petit', 2]];",
      "on: (l, r) => l[1] === r[0], cols: ['patient', 'medecin'], sel: [[0, 0], [1, 1]],",
      "{label: 'medecins.id', ok: true, say: 'Chaque rendez-vous est relié à son médecin.',",
      "{label: 'rendez_vous.medecin_id', on: l => l[1] !== N, say: 'Chaque rendez-vous serait relié à tous les médecins.',",
      "{at: 113.0, c: 3, kind: 'join', res: 1, mir: 1,", "options: J('cross', {", "{label: 'managers', err: 'no such table: managers',",
      "{label: 'm.manager_id', on: (l, r) => l[2] !== N && l[2] === r[2], say: 'Ces lignes réunissent des salariés du même manager.',",
      // Le trou à remplir : jaune, entouré d’un anneau ; les autres trous restent discrets
      '<span class="se">…</span><span class="sa hid">?</span>', "tl.to([s + ' .sa', s + ' .sg'], {autoAlpha: 1, duration: 0.3}, t + 0.3);",
      '.slot.pv .se,.slot.pv .sa,.slot.pv.ok .sg,.pvh{opacity:0!important}',
      // Chaque cas s’ouvre sur une grande carte (le lieu, les lignes à garder), qui monte se ranger en bandeau
      '<div class="abs card op" id="op${n}"><div class="opi emo">${c.emo}</div><div class="opk">Cas ${n} sur 6 · ${CHAPTERS[ci].label}</div><div class="opn">${c.need}</div></div>',
      "{emo: '🩺', need: 'Les rendez-vous qui ont un médecin',", "{emo: '🍦', need: 'Chaque parfum dans chaque format', w: 340,",
      "opener(1, 5.15, 10.9);", "opener(6, 171.55, 176.7);",
      // La correction de chaque étiquette, envoyée au plateau de l’app
      "return new Promise(res => later(tv, () => res({ok, say: fr(o.say), why: fr(o.why || o.say)})));",
      '<span class="cm hid" id="q5c">-- sans ON</span>', "if (out.length + rest.length <= 6) rest.forEach(s => { out.push(JSON.parse(s)); mk.push('m'); });",
      "leave(i, answered){ if (answered && X && X.ok && X.i === i) wait = i; else clear(); },",
      "tick(t = tl.time()){ if (wait < 0) return; const a = PICKS[wait].at; if (t >= a + 0.0199 || t < a - 0.001) clear(); }"]},
  {id: 45, next: 47, titre: 'Sous-requête dans WHERE avec IN', page: 'sous-requete-in.html', thumb: 'sous-requete-in-thumb.jpg', duree: '3 min 57', notesAt: 213.5,
    notes: /notes:\{t:231\.9,y:1286,card:\[64,292,1016,991\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec une sous-requête, la liste de <span class="ic">IN</span><br>est fabriquée par une autre requête.',
    chapters: ['Situation', 'Le problème', 'La sous-requête', 'IN en action', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span class="m">no such column: statut</span>', '<span class="col gh" id="gh2">✕ statut</span>', 'const LISTE = [4, 1, 3, 5, null];',
      '<span class="nt" id="nt3">commande n°16 · sans client</span>', '<span class="kw glow" id="k3">IN</span> <span class="glow" id="p3a">(</span>',
      '<span class="glow" id="eq5">=</span> (', '<span class="n2" id="n5">1 ligne</span><span class="ok2" id="ok5">✓ Aucune erreur</span>',
      '<span class="orph" id="m5a"><span class="emo">✕</span>Sophie Martin</span>', '✓ 4 clients à appeler']},
  {id: 47, next: 48, titre: 'Sous-requête dans SELECT', page: 'sous-requete-select.html', thumb: 'sous-requete-select-thumb.jpg', duree: '3 min 33', notesAt: 187.2,
    notes: /notes:\{t:206\.3,y:1250,card:\[64,292,1016,955\],to:\[940,255\]\}/, table: 'produits',
    bubble: 'Avec une sous-requête dans <span class="ic">SELECT</span>,<br>chaque ligne reçoit sa propre valeur.',
    chapters: ['Situation', 'Le problème', 'La sous-requête', 'Ligne par ligne', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span class="rz-v" id="v2">2026-08-03</span><span class="n2" id="n2">1 seule ligne</span>', "const TOUTE_LA_TABLE = '2026-08-03';",
      '<span class="kw">WHERE</span> produit_id = <span class="glow" id="v3">5</span>', '📌 Le 5 est écrit en dur&nbsp;: la Tisane Détox seulement',
      '= <span class="glow" id="pi4">produits.id</span>)', '<span class="glow" id="f5"><span class="kw">FROM</span> commandes</span>)',
      '✕ La Tisane Détox risque d’être écartée à tort', '<span class="glow" id="as6"><span class="kw">AS</span> derniere_commande</span>', '✓ Tisane Détox relancée']},
  {id: 48, next: 55, titre: 'Sous-requête dans FROM', page: 'sous-requete-from.html', thumb: 'sous-requete-from-thumb.jpg', duree: '3 min 21', notesAt: 175.8,
    notes: /notes:\{t:193\.5,y:1344,card:\[64,292,1016,1049\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec une sous-requête dans <span class="ic">FROM</span>,<br>un résultat se lit comme une table.',
    chapters: ['Situation', 'Le problème', 'La sous-requête', 'La table dérivée', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span class="m">no such column: montant</span>', '<span class="col gh" id="gh2">✕ montant</span>',
      '<span class="glow" id="mul3">produits.prix * commandes.quantite</span>', '<span class="glow" id="al3"><span class="kw">AS</span> commandes_montants</span>',
      '<span class="t2"><span class="emo">🗃️</span><span>commandes_montants</span></span>', '<span class="m">no such column: quantite</span>',
      '<span class="col gh" id="gh5">✕ quantite</span>', '<div>46.71875</div>', '✓ Indicateur mis à jour']},
  {id: 55, next: 59, titre: 'EXISTS et NOT EXISTS', page: 'exists.html', thumb: 'exists-thumb.jpg', duree: '3 min 57', notesAt: 204.3,
    notes: /notes:\{t:227\.2,y:1399,card:\[64,292,1016,1104\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">EXISTS</span>, vérifie qu’une ligne liée<br>existe dans une autre table.',
    chapters: ['Situation', 'Le problème', 'EXISTS', 'La recherche corrélée', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span class="col gh" id="gh2">✕ commande</span>', "const FIBRE = [['n°1', 1], ['n°5', 4], ['n°8', 7], ['n°15', 5]];",
      '<span class="rv">✓ 1 ligne trouvée&nbsp;: la commande n°5</span><span class="vd ok">EXISTS → vrai</span>', '<span class="rv no">Aucune ligne trouvée</span><span class="vd ko">EXISTS → faux</span>',
      'commandes.client_id = <span class="glow" id="ci4">clients.id</span>', '<span class="glow" id="w5"><span class="kw">WHERE</span> commandes.produit_id = 1</span>',
      '✕ Inès Lefebvre et Nathan Dupont n’ont jamais commandé', '✓ 4 clients prévenus', '<span class="ic">NOT EXISTS</span> → les 6 autres clients']},
  {id: 59, next: 73, titre: 'WITH (CTE)', page: 'with-cte.html', thumb: 'with-cte-thumb.jpg', duree: '3 min 52', notesAt: 205.8,
    notes: /notes:\{t:226\.7,y:1348,card:\[64,292,1016,1053\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">WITH</span>, prépare un calcul à part,<br>puis utilise-le comme une table.',
    chapters: ['Situation', 'Le problème', 'La CTE', 'Lire la CTE', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<div class="gh" id="gh2">nb_commandes&nbsp;?</div>', 'const TOTAUX = [[1, 3], [2, 2], [3, 2], [4, 2], [5, 2], [6, 1], [7, 2], [8, 1]];',
      '<span class="glow" id="nn3"><span class="kw">WHERE</span> client_id <span class="kw">IS NOT NULL</span></span>',
      '<span class="glow" id="wh4"><span class="kw">WHERE</span> nb_commandes &gt;= 2</span>;', '<span class="m">no such table: totaux</span>',
      '<span class="glow" id="j6"><span class="kw">JOIN</span> totaux</span>', '✓ 6 invitations envoyées']},
  {id: 73, next: 80, titre: 'UNION et UNION ALL', page: 'union.html', thumb: 'union-thumb.jpg', duree: '3 min 48', notesAt: 155.7,
    notes: /notes:\{t:223\.3,y:1391,card:\[64,292,1016,1096\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">UNION</span>, empile les lignes<br>de plusieurs requêtes en un seul résultat.',
    chapters: ['Situation', 'Le problème', 'UNION ALL', 'Les noms de colonnes', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ["const INDICATEURS = [['Nombre de clients', 10, '👥'], ['Nombre de commandes', 16, '🛒'], ['Nombre de produits', 8, '📦']];",
      '<div class="q2-rh">COUNT(*)</div><div class="q2-n">16</div>', '<span class="glow" id="u3a"><span class="kw">UNION ALL</span></span>',
      '<div><span class="qm">?</span></div>', '<span class="glow" id="ai4"><span class="kw">AS</span> indicateur</span>',
      '<span class="m">SELECTs to the left and right of UNION ALL do not have the same number of result columns</span>',
      '<span class="k ko">3 colonnes</span>', '✓ Un indicateur de plus = une ligne de plus', '✓ Tableau de bord à jour',
      '<div class="mn-l"><span class="ic">UNION</span> rallonge</div>']},
  {id: 80, next: 77, titre: 'INTERSECT et EXCEPT', page: 'intersect-except.html', thumb: 'intersect-except-thumb.jpg', duree: '3 min 03', notesAt: 159.2,
    notes: /notes:\{t:178\.5,y:1356,card:\[64,292,1016,1061\],to:\[940,255\]\}/, table: 'produits',
    bubble: 'Avec <span class="ic">INTERSECT</span> et <span class="ic">EXCEPT</span>,<br>compare les lignes de deux requêtes.',
    chapters: ['Situation', 'Le problème', 'INTERSECT', 'EXCEPT', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ["const STOCK_FAIBLE = [['Collagène Marin', 80], ['Oméga 3', 90], ['Protéine Végétale', 45], ['Shaker Inox', 30], ['Tisane Détox', 60]];",
      '<span class="glow" id="op3"><span class="kw"><span class="wx" id="kwI">INTERSECT</span><span id="kwE">EXCEPT</span></span></span>',
      '<span class="glow" id="w9"><span class="kw">WHERE</span> commandes.date_commande &gt;= <span class="str">\'2026-07-20\'</span></span>',
      '🏷️ Tisane Détox&nbsp;: à écouler en promotion', "tl.to(blocB, {y: -4 * LH, duration: 0.6, ease: 'power2.inOut'}, 113.0);",
      '✕ Des stocks confortables&nbsp;: 120, 500 et 150 unités', '✓ Commande envoyée au fournisseur',
      '<div class="mn-l"><span class="ic">EXCEPT</span><span>retire la seconde</span></div>']},
  {id: 77, next: 60, titre: 'WITH RECURSIVE (CTE RECURSIVE)', page: 'with-recursive.html', thumb: 'with-recursive-thumb.jpg', duree: '3 min 28', notesAt: 159.2,
    notes: /notes:\{t:203\.2,y:1391,card:\[64,292,1016,1096\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec <span class="ic">WITH RECURSIVE</span>, fabrique une suite de lignes à partir d’une seule ligne.',
    chapters: ['Situation', 'Le problème', 'L’ancre', 'La partie récursive', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['const JOURS_AVEC_COMMANDE = [2, 5, 8, 11, 12, 15, 18, 20, 22, 25, 28, 30];', '<span class="lg q" id="lgq2">? 19 jours</span>',
      '<span class="glow" id="an3"><span class="kw">SELECT</span> <span class="str">\'2026-07-01\'</span></span>',
      '<span class="glow" id="rc3"><span class="kw">DATE</span>(jour, <span class="str">\'+1 day\'</span>)</span>',
      '<span class="glow" id="wh3"><span class="kw">WHERE</span> jour &lt; <span class="str">\'2026-07-31\'</span></span><i class="strike" id="sk5"></i>',
      '⏳ Exécution en cours…', '✕ Sans condition d’arrêt, la requête ne s’arrête jamais',
      '<span class="glow" id="ex6"><span class="kw">EXCEPT</span></span>', '✓ 19 promotions programmées']},
  {id: 60, next: 74, titre: 'OVER()', page: 'over.html', thumb: 'over-thumb.jpg', duree: '3 min 27', notesAt: 159.2,
    notes: /notes:\{t:202\.2,y:1391,card:\[64,292,1016,1096\],to:\[940,255\]\}/, table: 'produits',
    bubble: 'Avec <span class="ic">OVER()</span>, un calcul porte sur plusieurs lignes sans les regrouper.',
    chapters: ['Situation', 'Le problème', 'OVER ()', 'PARTITION BY', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<div class="lst-t mono">GROUP BY categorie</div>', '✕ Le nom et le prix des produits ont disparu',
      '<span class="glow" id="ov3"><span class="kw">OVER</span> <span id="op3">(</span><span class="wx" id="cp3">)</span></span>',
      '<span class="glow" id="pb3"><span class="kw">PARTITION BY</span> categorie</span>', '<b class="v8">8</b><b class="vp">${nbDans(c)}</b>',
      '<span class="m">misuse of window function COUNT()</span>', '<div class="st ko" id="sw5"><b>2</b><span>WHERE</span></div>',
      '<span class="glow" id="wh6"><span class="kw">WHERE</span> nb_produits = 1</span>', '✓ 3 catégories à étoffer']},
  {id: 74, next: 78, titre: 'Fonctions de rang', page: 'fonctions-rang.html', thumb: 'fonctions-rang-thumb.jpg', duree: '3 min 11', notesAt: 162.7,
    notes: /notes:\{t:186\.5,y:1411,card:\[64,292,1016,1116\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec <span class="ic">RANK()</span>, chaque ligne reçoit une place&nbsp;: la même pour les ex&nbsp;æquo.',
    chapters: ['Situation', 'Le problème', 'ROW_NUMBER()', 'PARTITION BY', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span class="cnt"><span class="ob" id="ob2">ORDER BY date_commande</span></span>', '📅 Sophie Martin&nbsp;: deux commandes le 2 juillet',
      '<span class="glow" id="rn3"><span class="kw">ROW_NUMBER</span>() <span class="kw">OVER</span> (</span>',
      '<span class="glow" id="pb4"><span class="kw">PARTITION BY</span> clients.id</span>', '<b class="a">${i + 1}</b><b class="b">${NUM[i]}</b>',
      '✕ Le Magnésium ne compte plus comme premier achat', '<div class="fc" id="f5b"><div class="fn">RANK()</div><b class="ok">1</b><b class="ok">1</b><b>3</b></div>',
      '<div class="fc" id="f5c"><div class="fn">DENSE_RANK()</div><b class="ok">1</b><b class="ok">1</b><b>2</b></div>',
      '<span class="glow" id="rk6"><span class="kw">RANK</span>() <span class="kw">OVER</span> (</span>', '🥇 Premier achat de 3 clients',
      '✓ Mise en avant pour les nouveaux clients']},
  {id: 78, next: 79, titre: 'LAG et LEAD', page: 'lag-lead.html', thumb: 'lag-lead-thumb.jpg', duree: '3 min 28', notesAt: 163.2,
    notes: /notes:\{t:203\.3,y:1357,card:\[64,292,1016,1062\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec <span class="ic">LAG()</span> et <span class="ic">LEAD()</span>, chaque ligne lit la valeur d’une ligne voisine.',
    chapters: ['Situation', 'Le problème', 'LAG() et LEAD()', 'Le délai en jours', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span class="al2" id="al2">? jours</span>', '<span class="glow" id="lg3"><span class="kw">LAG</span>(date_commande) <span class="kw">OVER</span> (</span>',
      '<span class="b"><span class="kw">LEAD</span>(date_commande) <span class="kw">OVER</span> (</span>',
      '<b class="a">${val(p)}</b><b class="b">${val(s)}</b><b class="c"><span class="vv">${val(j)}</span></b>',
      '<span class="glow" id="jd4b"><span class="kw">julianday</span>(<span class="kw">LAG</span>(date_commande)</span>',
      '<span class="glow" id="nb5"><span class="kw">ORDER BY</span> client_id, date_commande, id</span>', '<span class="jr" id="j5b">−23</span>',
      '✕ Lucas Bernard lit la commande de Sophie Martin', '<span class="glow" id="av6"><span class="kw">COALESCE</span>(<span class="kw">AVG</span>(jours_depuis), 10)</span>',
      '🔔 Hugo Laurent et Gabriel Michel&nbsp;: 10 jours par défaut', '✓ 8 rappels programmés']},
  {id: 79, next: 56, titre: 'Fenêtres glissantes', page: 'fenetres-glissantes.html', thumb: 'fenetres-glissantes-thumb.jpg', duree: '3 min 07', notesAt: 162.7,
    notes: /notes:\{t:182\.2,y:1380,card:\[64,292,1016,1085\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec <span class="ic">ROWS BETWEEN</span>, choisis les lignes qui entrent dans chaque calcul.',
    chapters: ['Situation', 'Le problème', 'Le cumul', 'La moyenne mobile', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span class="glow" id="mt2">produits.prix * commandes.quantite</span>', '<b id="tot2">747.5</b>',
      '<span class="glow" id="fr3a"><span class="kw">ROWS BETWEEN UNBOUNDED PRECEDING</span></span>', '<span class="frm" id="frm3"></span>',
      '<span class="b"><span class="glow" id="p4"><span class="kw">2 PRECEDING</span></span></span>', '<span class="glow" id="ob5"><span class="kw">ORDER BY</span> date_commande</span>',
      '✕ Les deux commandes du 2 juillet ont le même cumul', '<div class="lim" id="lim6"><span>Palier&nbsp;: 700&nbsp;€</span></div>',
      '✓ Palier franchi le 1er&nbsp;août']},
  {id: 56, next: 72, titre: 'Normaliser les inscriptions', page: 'projet-normaliser.html', thumb: 'projet-normaliser-thumb.jpg', duree: '3 min 28', notesAt: 159.3,
    notes: /notes:\{t:201\.2,y:1291,card:\[64,292,1016,996\],to:\[940,255\]\}/, table: 'inscriptions',
    bubble: 'Le fichier Excel des ateliers mélange tout&nbsp;:<br>à toi de le ranger en tables.',
    chapters: ['Le fichier Excel', 'Les copies', 'Supprimer, ajouter', 'Une table par sujet', 'Les tables remplies', 'À retenir'],
    traps: ["const INSCR = [[1, 1, '01/09', '2026-09-01'], [4, 1, '02/09', '2026-09-02'], [5, 2, '03/09', '2026-09-03'], [7, 3, '04/09', '2026-09-04'],",
      "const YOGA = [5, 'Yoga du matin', '03/10', '2026-10-03', 2, '🌅'];", '<span id="xn1">6 inscriptions</span>', "const COLS = ['client', 'atelier', 'date', 'coach', 'e-mail du coach', 'inscrit le'];",
      // Les six moments : les copies de l’e-mail, la ligne à supprimer, la case client du Yoga, les colonnes à ranger, la table du Yoga, la table sans liens
      "{at: 40.0, from: 34.6, kind: 'tap', need: 3,", "{at: 61.6, from: 52.1, kind: 'tap', need: 1,", "{label: 'Tu crées une ligne d’atelier dans un tableau censé contenir des inscriptions.', ok: true,",
      "{at: 105.0, from: 94.3, kind: 'sort',", "{at: 129.8, from: 119.0, kind: 'tap', need: 1,", "{label: 'Impossible à savoir', ok: true}", "{at: 141.4, from: 135.95, kind: 'pick',",
      '<span class="bad hid" id="xn2">7 inscriptions&nbsp;?</span>', 'Effacé avec la ligne', '<span class="m0">Nouveau mail</span>', 'Chapitre 2 · Clés et relations',
      '<span class="miss" id="ms1">? client</span><span class="miss" id="ms2">? atelier</span>']},
  {id: 72, next: 81, titre: 'Clés et relations', page: 'projet-cles.html', thumb: 'projet-cles-thumb.jpg', duree: '5 min 03', notesAt: 167.9,
    notes: /notes:\{t:296\.1,y:1193,card:\[64,292,1016,898\],to:\[940,255\]\}/, table: 'inscriptions',
    bubble: 'Tes tables sont prêtes&nbsp;:<br>à toi de les relier avec des clés.',
    chapters: ['Le problème', 'La clé primaire', 'La clé étrangère', '1 → N', 'N ↔ N', '1 ↔ 1', 'À retenir'],
    traps: ["const INSCR = [[1, 1, 1, '2026-09-01'], [2, 4, 1, '2026-09-02'], [3, 5, 2, '2026-09-03'], [4, 7, 3, '2026-09-04'],",
      "const NOUVELLE = [7, 1, 4, '2026-09-07'];", 'const CARTES = [[1, 1, 10], [2, 4, 5], [3, 6, 8]];', 'const DOUBLON = [4, 1, 10];',
      '<span class="miss" id="ms1"><i class="mi"><b class="q">?</b><b class="k">🔑</b></i>client</span><span class="miss" id="ms2"><i class="mi"><b class="q">?</b><b class="k">🔑</b></i>atelier</span>',
      // Les six moments : l’identifiant des coachs, la cliente et l’atelier d’une inscription, où ranger coach_id, l’atelier de Diego Ramos,
      // la deuxième inscription de Sophie Martin, la forme de chaque relation
      "{at: 31.0, from: 22.6, kind: 'pick', text: true,", "{label: 'Aucune : on ajoute un identifiant', ok: true}]},", "{at: 68.6, from: 55.1, kind: 'tap', need: 2,",
      "{at: 82.6, from: 75.0, kind: 'pick', text: true,", "{label: 'Dans la table ateliers : une colonne coach_id', ok: true},", "{at: 91.0, from: 82.9, kind: 'tap', need: 1,",
      "{at: 110.45, from: 103.6, kind: 'pick', text: true,", "{label: 'Une nouvelle ligne dans la table inscriptions', ok: true},", "{at: 149.6, from: 133.3, kind: 'sort',",
      "const RELS = [['11', '1 ↔ 1', 'un à un', 2], ['1n', '1 → N', 'un à plusieurs', 0], ['nn', 'N ↔ N', 'plusieurs à plusieurs', 1]];",
      '<i class="two">2, 5</i>', '<i class="two hid" id="two14">1, 4</i>', '<b class="uq" id="uq">unique</b>', '<div class="abs stamp warn refus" id="td-st">Refusé</div>',
      "tl.to('#tc-co', {'--w4': '170px', duration: 0.45, ease: 'power2.inOut'}, 83.0);", 'Chapitre 3 · Modéliser avec UML']},
  {id: 81, next: 61, titre: 'Modéliser avec UML', page: 'projet-uml.html', thumb: 'projet-uml-thumb.jpg', duree: '5 min 02', notesAt: 215.85,
    notes: /notes:\{t:294\.9,y:1115,card:\[64,292,1016,820\],to:\[940,255\]\}/, table: 'ateliers',
    bubble: 'Tu vas représenter la structure de la base avec un diagramme UML pour visualiser plus&nbsp;facilement les relations entre les tables.',
    chapters: ['Le plan', 'Les classes', 'Les multiplicités', 'Lire le diagramme', 'Du diagramme aux tables', 'À retenir'],
    traps: ["const CLASSES = [['co', 'Coach', ['prenom', 'nom', 'email']], ['ca', 'Carte', ['seances']],",
      "const ASSOCS = [['an', 'anime', '▾', 'co', '1', 'at', '0..*'], ['in', 's’inscrit à', '◂', 'cl', '0..*', 'at', '0..*'],",
      "const ACLASS = ['Inscription', ['date_inscription']];",
      // Les six moments : le trait de l’association, les multiplicités d’anime, celle de Client, celle qui interdit deux cartes,
      // les colonnes de la table inscriptions, les quatre classes à placer dans le diagramme de toute la boutique
      "{at: 41.8, from: 27.5, kind: 'pick', text: true,", "{label: 'Un trait entre Coach et Atelier, nommé «\\u00a0anime\\u00a0»', ok: true},", "{at: 68.1, from: 53.7, kind: 'sort',",
      "{at: 82.7, from: 74.4, kind: 'pick',", "{label: '0..*', ok: true}]},", "{at: 109.1, from: 100.8, kind: 'tap', need: 1,", "if (a === 'po-ca') {",
      "{at: 176.55, from: 168.1, kind: 'pick', text: true,", "{label: 'id, client_id, atelier_id, date_inscription', ok: true, why: 'Chaque ligne indique quel client s’est inscrit à quel atelier, et à quelle date. La colonne <code>id</code> identifie cette inscription.'},", "{at: 198.55, from: 190.15, kind: 'sort',",
      "const SHOP_ASSOCS = ASSOCS.concat([['pa', 'passe', '▾', 'cl', '0..1', 'cm', '0..*'], ['ce', 'concerne', '◂', 'cm', '0..*', 'pr', '1']]);",
      '<line id="ln-an"/><line id="ln-po"/><line id="ln-in"/><line id="ln-cx" class="dash"/>', "tl.to('#sb .mp:not(.ask) .mn', {opacity: 0.28,",
      'Prochaine leçon · CREATE TABLE']},
];

for (const c of COURSES) {
  test(`${c.titre} : le cours a son animation et sa vignette, avec le bouton « Ajouter à mes notes » sous le récapitulatif`, () => {
    const lesson = cut(`guide({ id:${c.id}, titre:"${c.titre}"`, `guide({ id:${c.next},`);
    const m = lesson.match(/video:\{anim:'([^']+)',thumb:'([^']+)',duree:'([^']+)',/);
    assert.ok(m, `champ video du cours ${c.titre}`);
    assert.equal(m[1], `assets/anim/${c.page}?app&embed`);
    assert.equal(m[2], `assets/anim/${c.thumb}`);
    for (const f of m.slice(1, 3)) assert.ok(fs.statSync(path.join(ROOT, f.split('?')[0])).size > 1000, `fichier présent : ${f}`);
    assert.equal(m[3], c.duree);
    assert.ok(c.notes.test(lesson), 'bouton « Ajouter à mes notes » sous « Les trois idées à retenir »');
  });

  test(`${c.titre} : page de l’animation sur le moteur commun, ressources locales, chapitres et pièges, sans question en pleine vidéo`, () => {
    const page = fs.readFileSync(path.join(ROOT, 'assets/anim', c.page), 'utf8');
    for (const rel of ['core.css', 'core.js', 'gsap.min.js', 'mascotte.webp'])
      assert.ok(page.includes(rel) && fs.existsSync(path.join(ROOT, 'assets/anim', rel)), `ressource : ${rel}`);
    assert.ok(page.indexOf('src="gsap.min.js"') < page.indexOf('src="core.js"'), 'GSAP chargé avant le moteur');
    assert.ok(!/https?:\/\//.test(page), 'rien de chargé depuis Internet');
    assert.ok(page.includes(`Course({duration: DURATION, chapters: CHAPTERS, captions: CAPTIONS, questions: QUESTIONS, notesAt: ${c.notesAt},`));
    assert.ok(page.includes('const QUESTIONS = [];') && !/kicker: '/.test(page), 'pas de question en pleine vidéo : la lecture n’est jamais interrompue');
    assert.ok(page.includes(c.bubble), 'bulle de la mascotte');
    for (const label of c.chapters) assert.ok(page.includes(`label:'${label}'`), `chapitre ${label}`);
    for (const t of c.traps) assert.ok(page.includes(t), `piège : ${t}`);
    if (!['between.html', 'limit-offset.html'].includes(c.page) && !c.page.startsWith('projet-')) assert.ok(page.includes("stackBelow('#s1 .need', "), 'la liste des informations se cale sous la carte de la situation, sans la toucher');
    assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page), 'SQL n’est jamais personnifié');
    assert.ok(page.includes(`la <b>table ${c.table}</b>`) && !new RegExp(`dans ${c.table}\\b`).test(page), `toujours « table ${c.table} »`);
  });

  test(`${c.titre} reste léger et disponible hors ligne`, () => {
    let total = 0;
    for (const f of [c.page, 'core.css', 'core.js', 'gsap.min.js', 'mascotte.webp', c.thumb]) total += fs.statSync(path.join(ROOT, 'assets/anim', f)).size;
    for (const f of ANIM_FONTS) total += fs.statSync(path.join(ROOT, 'assets/fonts', f)).size;
    assert.ok(total < 450 * 1024, `animation et ressources : ${Math.round(total / 1024)} Ko`);
    for (const f of [`./assets/anim/${c.page}?app&embed`, `./assets/anim/${c.thumb}`]) assert.ok(sw.includes(`'${f}'`), `préchargé : ${f}`);
  });
}

test('Les bases de données relationnelles : la feuille Excel, la table clients, les commandes et les produits de la vidéo sont ceux de SQLite', async () => {
  const page = fs.readFileSync(path.join(ROOT, 'assets/anim/bases-relationnelles.html'), 'utf8');
  const a = page.indexOf('const COLS = '), b = page.indexOf('const CHAPTERS = ');
  assert.ok(a > 0 && b > a, 'données de la page localisées');
  const ctx = vm.createContext({});
  vm.runInContext(page.slice(a, b) + ';this.COLS = COLS; this.CLIENTS = CLIENTS; this.PRODUITS = PRODUITS; this.COMMANDES = COMMANDES; this.NOUVEL_EMAIL = NOUVEL_EMAIL; this.NOUVEAUX = NOUVEAUX; this.CLIENT_INCONNU = CLIENT_INCONNU;', ctx);
  const data = vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), data);
  const {createRequire} = await import('node:module');
  const SQL = await createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
  const db = new SQL.Database();
  db.run(vm.runInContext('SCHEMA_SQL', data));
  const q = s => JSON.stringify(db.exec(s)[0].values), js = v => JSON.stringify(v);
  const all = db.exec('SELECT * FROM clients')[0];
  assert.equal(js(all.columns), js(ctx.COLS), 'SELECT * FROM clients : les 9 colonnes, dans l’ordre');
  assert.equal(js(all.values), js(ctx.CLIENTS), 'les 10 clients, valeur par valeur (NULL compris)');
  for (const [id, c, p, n] of ctx.COMMANDES) assert.equal(q(`SELECT id, client_id, produit_id, quantite FROM commandes WHERE id = ${id}`), js([[id, c, p, n]]), `commande ${id}`);
  for (const [id, [nom, prix]] of Object.entries(ctx.PRODUITS)) assert.equal(q(`SELECT nom, prix FROM produits WHERE id = ${id}`), js([[nom, prix]]), `produit ${id}`);
  assert.equal(q('SELECT COUNT(*) FROM commandes'), '[[16]]', 'un seul tableau : 16 lignes, une par commande');
  assert.equal(q('SELECT id FROM commandes WHERE client_id = 1 ORDER BY id'), '[[1],[2],[13]]', 'les trois commandes de Sophie Martin');
  assert.equal(q('SELECT id FROM commandes WHERE produit_id = 1 AND id <= 5 ORDER BY id'), '[[1],[5]]', 'la Fibre Prébiotique dans les commandes 1 et 5 de la feuille');
  assert.equal(js(ctx.COMMANDES.map(c => c[0])), '[1,2,3,4,5,13]', 'la feuille montre les commandes 1 à 5, puis la 13');
  assert.equal(q(`SELECT COUNT(*) FROM clients WHERE email = '${ctx.NOUVEL_EMAIL}'`), '[[0]]', 'le nouvel e-mail est imaginaire : il n’est pas dans la base');
  assert.equal(q("SELECT id, nom, ville FROM clients WHERE prenom = 'Nathan' ORDER BY id"), '[[4,"Petit","Paris"],[10,"Dupont","Paris"]]', 'deux Nathan, tous deux à Paris');
  /* Choisir les colonnes : SELECT prenom, nom, email (les 10 clients, dans l’ordre écrit) ; sans virgule, un alias ; une virgule de trop, une erreur. */
  const three = db.exec('SELECT prenom, nom, email FROM clients')[0];
  assert.equal(js(three.columns), js(['prenom', 'nom', 'email']), 'les trois colonnes gardées, dans l’ordre de la requête');
  assert.equal(js(three.values), js(ctx.CLIENTS.map(c => [c[1], c[2], c[6]])), 'les 10 clients, chacun une seule fois (NULL compris)');
  assert.equal(q("SELECT COUNT(*) FROM clients WHERE prenom = 'Sophie' AND nom = 'Martin'"), '[[1]]', 'Sophie Martin : une seule ligne, donc un seul e-mail');
  const alias = db.exec('SELECT prenom email FROM clients')[0];
  assert.equal(js(alias.columns), js(['email']), 'sans virgule : une seule colonne, titrée email');
  assert.equal(js(alias.values.slice(0, 2)), js([['Sophie'], ['Lucas']]), 'qui contient les prénoms');
  assert.throws(() => db.exec('SELECT prenom, nom, email,\nFROM clients;'), /near "FROM": syntax error/, 'virgule de trop avant FROM');
  /* Les déclarations montrées (schema.sql) sont celles de la base : id, clé primaire de clients ; client_id → clients(id). */
  assert.equal(q("SELECT name, type FROM pragma_table_info('clients') WHERE pk = 1"), '[["id","INTEGER"]]', 'id INTEGER PRIMARY KEY');
  assert.equal(q("SELECT \"table\", \"to\" FROM pragma_foreign_key_list('commandes') WHERE \"from\" = 'client_id'"), '[["clients","id"]]', 'FOREIGN KEY (client_id) REFERENCES clients(id)');
  /* Ce que la base vérifie : un identifiant déjà pris est refusé, un client sans identifiant reçoit le suivant, un client inconnu est refusé. */
  const [[idPris, p1, n1], [, p2, n2]] = JSON.parse(JSON.stringify(ctx.NOUVEAUX));
  assert.throws(() => db.run(`INSERT INTO clients (id, prenom, nom) VALUES (${idPris}, '${p1}', '${n1}')`), /UNIQUE constraint failed: clients\.id/, 'l’identifiant 4 est déjà pris');
  db.run(`INSERT INTO clients (prenom, nom) VALUES ('${p2}', '${n2}')`);
  assert.equal(q(`SELECT id FROM clients WHERE prenom = '${p2}'`), '[[11]]', 'sans identifiant, le client reçoit le suivant : 11');
  db.run('PRAGMA foreign_keys = ON;');
  assert.throws(() => db.run(`INSERT INTO commandes (client_id, produit_id, quantite) VALUES (${ctx.CLIENT_INCONNU}, 1, 1)`), /FOREIGN KEY constraint failed/, 'aucun client 99 : la commande est refusée');
  db.close();
  assert.ok(!/SELECT(<\/span>)? nom, prix/.test(page), 'la vidéo ne montre pas la requête de l’exercice (le nom et le prix des produits)');
});

test('moteur commun des animations : mode intégré, rendu net, pauses de lecture calculées d’après chaque légende', () => {
  const core = fs.readFileSync(path.join(ROOT, 'assets/anim/core.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'assets/anim/core.css'), 'utf8');
  assert.ok(core.includes("const EMBED = QS.has('embed');") && core.includes('gsap.config({force3D: false});'));
  assert.ok(css.includes('html.embed,html.embed body{height:100%;overflow:hidden;background:transparent}') && css.includes('html.embed .blob{display:none}'));
  for (const f of ['bricolage-grotesque-regular.woff2', 'bricolage-grotesque-bold.woff2', 'jetbrains-mono.woff2'])
    assert.ok(css.includes(`../fonts/${f}`) && fs.existsSync(path.join(ROOT, 'assets/fonts', f)), `police : ${f}`);
  assert.ok(core.includes('chapters: chapters.map(') && core.includes('captions: captions.map(') && core.includes('questions: questions.map('), 'protocole du lecteur (window.__ready)');
  const ctx = vm.createContext({location: {search: ''}, URLSearchParams, gsap: {config() {}, timeline: () => ({})}, document: {}});
  vm.runInContext(core, ctx);
  const txt = 'x'.repeat(85);                                  // 85 caractères : 5 s de lecture
  assert.ok(Math.abs(vm.runInContext('readTime', ctx)(txt) - 5) < 1e-9);
  assert.equal(JSON.stringify(ctx.captionHolds([[10, 13, txt]], 100)), '[[12.75,2.5]]', 'lisible 2,5 s : l’image s’arrête 2,5 s juste avant que la légende s’efface');
  assert.equal(JSON.stringify(ctx.captionHolds([[10, 16, txt]], 100)), '[]', 'assez de temps : pas de pause');
  assert.equal(JSON.stringify(ctx.captionHolds([[90, 999, txt]], 100)), '[]', 'dernière légende (jusqu’à la fin) : pas de pause');
  assert.equal(JSON.stringify(ctx.captionHolds([[10, 13, '<b>x</b>'.repeat(85)]], 100)), '[[12.75,2.5]]', 'les balises ne comptent pas');
  assert.equal(vm.runInContext('plain', ctx)('Opérateur <code>&lt;=</code>, <code>&gt;</code> ou <code>!=</code>'), 'Opérateur <=, > ou\u00a0!=', 'texte lu par VoiceOver : opérateurs en clair');
  assert.equal(JSON.stringify(ctx.mergeHolds([[20, 1], [5, 2], [20.05, 3]])), '[[5,2],[20,3]]', 'pauses triées, très proches fusionnées');
  vm.runInContext('HOLDS = [[5, 2], [20, 3]];', ctx);
  assert.equal(ctx.unwarp(4), 4); assert.equal(ctx.unwarp(10), 12); assert.equal(ctx.unwarp(30), 35);
  assert.equal(ctx.warp(6), 5, 'pendant la pause : image figée'); assert.equal(ctx.warp(12), 10); assert.equal(ctx.warp(35), 30);
  assert.equal(ctx.fr('Résultat : <code>a : b</code> ?'), 'Résultat : <code>a : b</code> ?', 'espaces insécables, sauf dans le code');
});

test('moteur commun des animations : préchargé et jamais servi périmé', () => {
  for (const f of ['./assets/anim/core.css', './assets/anim/core.js']) assert.ok(sw.includes(`'${f}'`), `préchargé : ${f}`);
  const i = sw.indexOf("if (url.pathname.includes('/assets/anim/') && /\\.(js|css)$/.test(url.pathname) && !url.pathname.endsWith('/gsap.min.js')) {");
  assert.ok(i > 0 && i < sw.indexOf("if (req.mode === 'navigate') {"), 'moteur des animations : réseau d’abord');
  assert.ok(sw.slice(i, i + 700).includes("fetch(req, { cache: 'no-cache' })"), 'revalidé auprès du serveur');
});

test('SELECT sans virgule : l’animation (cours 0) et le quiz expliquent l’alias (AS facultatif)', () => {
  const page = fs.readFileSync(path.join(ROOT, 'assets/anim/bases-relationnelles.html'), 'utf8');
  assert.ok(page.includes('Sans virgule, <code>email</code> est lu comme un <b>alias</b> : le titre donné à la colonne dans le résultat.'), 'même explication dans la vidéo');
  const qcm = cut('const QCM={', '\n};');
  assert.ok(qcm.includes('Sans virgule, <code>telephone</code> est lu comme un <b>alias</b>') && !qcm.includes('il interprète <code>telephone</code>'), 'explication du quiz alignée');
});

test('texte des animations : police Inter livrée (mêmes retours à la ligne sur iPhone), sans text-wrap pretty, mots courts collés au mot suivant', () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets/anim/core.css'), 'utf8');
  const where = fs.readFileSync(path.join(ROOT, 'assets/anim/where.html'), 'utf8');
  for (const [w, f] of [['300 550', 'inter-medium'], ['551 650', 'inter-semibold'], ['651 750', 'inter-bold'], ['751 900', 'inter-extrabold']]) {
    const face = `@font-face{font-family:'Inter';src:url(../fonts/${f}.woff2) format('woff2');font-weight:${w};font-display:block}`;
    assert.ok(css.includes(face) && where.includes(face), `Inter ${w} dans core.css et where.html`);
    assert.ok(fs.statSync(path.join(ROOT, 'assets/fonts', f + '.woff2')).size > 5000, `fichier ${f}.woff2`);
    assert.ok(sw.includes(`'./assets/fonts/${f}.woff2'`), `préchargé hors ligne : ${f}`);
  }
  assert.ok(fs.readFileSync(path.join(ROOT, 'assets/fonts/OFL-Inter.txt'), 'utf8').includes('SIL Open Font License'), 'licence OFL jointe');
  for (const f of ['core.css', ...fs.readdirSync(path.join(ROOT, 'assets/anim')).filter(n => n.endsWith('.html'))])
    assert.ok(!/text-wrap\s*:\s*pretty/.test(fs.readFileSync(path.join(ROOT, 'assets/anim', f), 'utf8')), `${f} : retours à la ligne classiques (Safari ne rééquilibre plus les lignes)`);
  const core = fs.readFileSync(path.join(ROOT, 'assets/anim/core.js'), 'utf8');
  const ctx = vm.createContext({location: {search: ''}, URLSearchParams, gsap: {config() {}, timeline: () => ({})}, document: {}});
  vm.runInContext(core, ctx);
  const nb = s => s.replace(/ /g, '⍽');
  assert.equal(nb(ctx.fr('Pour deux colonnes, il faut la virgule : <code>prenom, ville</code>.')), 'Pour⍽deux⍽colonnes, il⍽faut la⍽virgule⍽: <code>prenom, ville</code>.', 'jamais « la » ni « deux » en fin de ligne ; le code reste intact');
  /* Légendes : une expression ne se coupe pas d’une ligne à l’autre (« du plus / petit », « donne / 24 », « ne livre / pas », « tableau / de bord »). */
  assert.equal(nb(ctx.fr('Les lignes sont triées du plus petit au plus grand.')), 'Les⍽lignes sont triées du⍽plus⍽petit au⍽plus⍽grand.', 'du plus petit au plus grand');
  assert.equal(nb(ctx.fr('ROUND va au plus proche : 24,2 donne 24, et il reste <b>2 produits</b>.')), 'ROUND va au⍽plus⍽proche⍽: 24,2⍽donne⍽24, et⍽il⍽reste⍽<b>2⍽produits</b>.', 'un nombre reste collé au mot qui le précède, même à travers une balise');
  assert.equal(nb(ctx.fr('Le fournisseur ne livre pas les accessoires.')), 'Le⍽fournisseur ne⍽livre⍽pas les⍽accessoires.', 'la négation ne se coupe pas');
  assert.equal(nb(ctx.fr('Plusieurs clients ont la même ville.')), 'Plusieurs⍽clients ont la⍽même⍽ville.', 'déterminant collé à son nom');
  assert.equal(nb(ctx.fr('Sur le tableau de bord, la valeur suivante.')), 'Sur⍽le⍽tableau⍽de⍽bord, la⍽valeur⍽suivante.', 'expression figée, adjectif qui suit');
  assert.ok(fs.readFileSync(path.join(ROOT, 'assets/anim/core.css'), 'utf8').includes('.nw{white-space:nowrap}'), 'une courte expression peut être gardée sur une ligne (.nw), sur toutes les pages');
  assert.equal(nb(ctx.fr('NutriBoost travaille avec un nouveau transporteur.')), 'NutriBoost travaille avec⍽un⍽nouveau transporteur.');
  assert.equal(nb(ctx.fr('avec <b>4 informations</b>')), 'avec⍽<b>4⍽informations</b>', 'mot court collé à la balise qui suit, nombre collé à son unité');
  assert.equal(nb(ctx.fr('les intitulés « Nom du produit » et « Prix (€) ».')), 'les⍽intitulés «⍽Nom⍽du⍽produit⍽» et⍽«⍽Prix⍽(€)⍽».', 'un libellé entre guillemets ne se coupe pas');
  assert.ok(core.includes("textIssues: QS.has('check') ? textIssues() : undefined,"), 'contrôle de mise en forme à la fabrication (?check)');
  assert.ok(core.includes("kind: 'ligne trop courte'") && core.includes("kind: 'bloc étroit'"), 'contrôle des trous dans un paragraphe et des blocs serrés');
  assert.ok(core.includes("kind: 'dernière ligne trop courte'") && core.includes('const SHORT_LINE = 0.7, SHORT_LINE_CAP = 0.78, NARROW_BLOCK = 0.7, STUB_LINE = 0.36, BOLD_WORDS = 4;'), 'contrôle des bouts de phrase isolés sur la dernière ligne');
  assert.ok(core.includes('const alone = i => (i === 0 || lines[i].toks[0].brk) && (i === lines.length - 1 || lines[i + 1].toks[0].brk);') && core.includes('!w[0].blk && !alone(i)'), 'un titre d’un seul mot (« API ») au-dessus de sa description n’est pas un mot orphelin');
  assert.ok(core.includes('frDom($(\'#stage\'));'), 'même typographie pour les textes écrits dans la page');
  assert.ok(core.includes('const STACK_GAP = 40;') && core.includes('function stackBelow(lower, upper, rot = 0, gap = STACK_GAP){'), 'une carte posée sous une carte inclinée garde son écart');
  assert.ok(core.includes('const CARD_GAP = 20;') && core.includes("layoutIssues: QS.has('check') ? layoutIssues(renderAt, out) : undefined,"), 'contrôle des cadres collés à la fabrication (?check)');
  assert.ok(core.includes("kind: 'surlignage coupé'"), 'contrôle des surlignages rognés à la fabrication (?check)');
  assert.ok(fs.readFileSync(new URL('../assets/anim/core.css', import.meta.url), 'utf8').includes('.tr>div{position:relative;z-index:1;padding:7px 12px;'), 'cellule : le cadre d’une valeur surlignée tient dedans');
});

test('animations : opérateurs écrits tels qu’on les tape (<= et non ≤), JetBrains Mono sans ligatures comme dans l’app', () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets/anim/core.css'), 'utf8');
  assert.ok(css.includes('code,.ic,.code,.codepill,.mini,.tr,.th,.lk,.cp{font-variant-ligatures:none;font-feature-settings:"liga" 0,"calt" 0}'), 'code des animations sans ligatures');
  const page = fs.readFileSync(path.join(ROOT, 'assets/anim/comparer.html'), 'utf8');
  assert.ok(/\.op \.sym\{[^}]*font-variant-ligatures:none/.test(page), 'symboles du tableau des opérateurs sans ligatures');
  assert.ok(!/[≤≥≠]/.test(page), 'jamais ≤, ≥ ou ≠ : les opérateurs SQL tels qu’on les tape');
});

test('LvAnim : moments « À toi » de la leçon interactive, arrêt pile, événement « pick », son d’aperçu fourni à la page', async () => {
  const frames = [];
  let now = 0;
  const ctx = vm.createContext({
    requestAnimationFrame: cb => { frames.push(cb); return frames.length; },
    cancelAnimationFrame: () => { frames.length = 0; },
    performance: {now: () => now},
    setTimeout, clearTimeout, Promise, Math, Number, Set, Map, Error,
  });
  vm.runInContext(cut('const LvSfx=', 'function lessonVideoOn(l)') + ';this.LvAnim=LvAnim;', ctx);
  const info = {duration: 10, cues: [], chapters: [], captions: [], questions: [],
    picks: [{t: 3, prompt: 'Quel <code>JOIN</code> ?', options: [{label: 'INNER', ok: true}, {label: 'LEFT', ok: false}]}]};
  const win = {__ready: Promise.resolve(info), renderAt: () => {}};
  const frame = {addEventListener(type, fn) { this.load = fn; }, contentWindow: win, src: ''};
  const a = new ctx.LvAnim(frame), log = [];
  a.addEventListener('pick', e => log.push(`pick:${e.detail.i}:${e.detail.p.options.length}`));
  a.play();
  await frame.load();
  assert.equal(typeof win.__sfx, 'function', 'la page joue les sons de ses aperçus par le lecteur (bouton son respecté)');
  const step = dt => { now += dt * 1000; const f = frames.shift(); f && f(now); };
  for (let i = 0; i < 50; i++) step(0.1);
  assert.equal(a.currentTime, 3, 'arrêt pile sur le moment « À toi »');
  assert.ok(a.paused && log.join() === 'pick:0:2', 'le moment met l’animation en pause et prévient le lecteur');
  a.play();
  for (let i = 0; i < 80; i++) step(0.1);
  assert.ok(a.ended && log.length === 1, 'reprise jusqu’à la fin, sans repasser par le moment');
  a.destroy();
});

test('leçon interactive : plateau d’étiquettes, envol jusqu’au trou de la requête, verdict, score du premier essai', () => {
  const show = cut('function lvPkShow(i,p){', 'function lvPkTry(k){');
  for (const part of ['À toi · ${i+1}/${n}', "LV.root.classList.add('is-q','is-pk');", 'IX.enter(i)', '>Continuer</button>',
    '<span class="lv-pk-hole" aria-hidden="true">?</span>${p.prompt}', '<p class="lv-pk-why" hidden></p>'])
    assert.ok(show.includes(part), `plateau : ${part}`);
  const tr = cut('function lvPkTry(k){', 'function lvPkVerdict(');
  assert.ok(tr.includes('IX.pick(P.i,k)') && tr.includes('lvPkFly(btn,rect,land)'), 'l’étiquette s’envole jusqu’au trou, puis la page montre le résultat de ce choix');
  assert.ok(tr.includes('lvPkVerdict(P,k,btn,ok,r||{})'), 'la page renvoie le verdict et la correction de ce choix');
  const vd = cut('function lvPkVerdict(', '/* L’étiquette quitte le plateau');
  for (const part of ['lvPkSet(LV.id,P.i,first,P.tries-1)', "LvSfx.play('chord',0,.55,0)", 'lvPkBurst(rect)', "kick.textContent='✕ Essaie un autre choix';", "btn.classList.add('is-out')",
    "const why=r.why||r.say||''", "wEl.innerHTML=lvNw(why); wEl.className='lv-pk-why '+(ok?'ok':'ko'); wEl.hidden=false;", "P.box.querySelector('.lv-pk-t').hidden=true;"])
    assert.ok(vd.includes(part), `verdict : ${part}`);
  assert.ok(html.includes('.lv-pk-hole{') && html.includes('.lv-pk-why.ok{') && html.includes('.lv-pk-why.ko{'), 'case jaune du prompt, correction verte ou rouge');
  assert.ok(html.includes('.lv.is-pk .lv-bottom{visibility:hidden}'), 'le plateau cache les commandes');
  /* Le plateau part du haut de la légende et couvre la légende restée affichée à l’arrêt (jusqu’à y = 1830), pas davantage :
     au-delà, la carte suit sa question (aucun blanc), et remonte seulement si elle manque de place sous elle. */
  const place = cut('function lvPkPlace(){', 'function lvPkClose(answered){');
  assert.ok(place.includes('const a=lvPt(0,1496), z=lvPt(0,1830);') && place.includes('Math.min(z.y,lim)-a.y'),
    'le plateau couvre la légende, jamais le résultat : haut de la légende (y = 1496), jusqu’à y = 1830');
  assert.ok(place.includes("P.box.style.top=Math.max(0,Math.min(a.y,lim-card.offsetHeight)).toFixed(1)+'px'") && !place.includes('R.height-pb-10-a.y'),
    'la carte suit son contenu : plus de hauteur forcée jusqu’en bas de l’écran, elle remonte seulement s’il lui manque de la place');
  assert.ok(cut('function lvPkShow(i,p){', 'function lvPkValid(').includes('new ResizeObserver(lvPkPlace)') && cut('function lvPkClose(answered){', 'function lvReplay(){').includes('P.ro.disconnect()'),
    'la carte se replace quand son contenu change (réponse, explication, bouton) ; l’observateur est libéré à la fermeture');
  assert.ok(html.includes('.lv-pk-card>p:nth-last-child(1 of :not([hidden])){margin-bottom:0}'),
    'le blanc du bas de la carte égale celui du haut : le dernier bloc de texte visible (consigne seule, indice, correction) n’a pas de marge dessous');
  assert.ok(/\.lv-pk\.is-long \.lv-pk-opt\{[^}]*text-wrap:balance\}/.test(html) && /\.lv-pk\.is-sort \.lv-pk-opt\{[^}]*text-wrap:balance[^}]*\}/.test(html),
    'réponses longues et étiquettes à ranger : les lignes s’équilibrent, jamais un mot seul sur la deuxième ligne');
  assert.ok(cut('function lvPkClose(answered){', 'function lvReplay(){').includes('IX.leave(P.i,!!answered)'), 'à la reprise, la page laisse la timeline reprendre la même image');
  assert.ok(html.includes("o['p'+i]={first:first?1:0,err:Math.max(0,err|0)}") && html.includes('.lv-pk-t code{'), 'premier essai gardé pour le score ; code du prompt en étiquette');
  const core = fs.readFileSync(path.join(ROOT, 'assets/anim/core.js'), 'utf8');
  assert.ok(core.includes("picks: picks.map(p => ({t: unwarp(p.at), from: p.from != null ? unwarp(p.from) : null, kind: GESTURES.includes(p.kind) ? p.kind : 'pick', text: !!p.text, prompt: fr(p.prompt), hint: p.hint ? fr(p.hint) : '', next: p.next ? fr(p.next) : '', need: p.need || 0,")
    && core.includes("const GESTURES = ['tap', 'sort', 'link'];")
    && core.includes("options: (p.options || []).map(o => ({label: o.label, ok: !!o.ok, tag: o.tag || '', why: o.ok && (o.why || o.say) ? fr(o.why || o.say) : ''}))}))")
    && core.includes('clashes: holdClashes(picks.concat(opens).map(p => p.at))') && core.includes('if (cfg.onRender) cfg.onRender(T);'), 'moteur : moments exportés, aucune animation coupée par un arrêt, rendu suivi par la page');
});

test('moments joués sur l’image : toucher, glisser ou relier, au doigt comme à la souris, sans couper « e-mail »', () => {
  const show = cut('function lvPkShow(i,p){', 'function lvPkTry(k){');
  for (const part of ["const total=kind==='sort'?opts.length:(p.need||0);", "box.className='lv-pk'+(kind==='pick'?'':' is-'+kind)+(p.text?' is-text':'')+(kind==='pick'&&opts.some(o=>String(o.label).length>30)?' is-long':'');",
    '<span class="lv-pk-cnt">0 / ${total}</span>', '<span class="lv-pk-ico" aria-hidden="true">${LV_PK_ICO[kind]||LV_PK_ICO.tap}</span>${p.prompt}',
    '<p class="lv-pk-hint">${p.hint}</p>', '}else lvPkLayer(P);', "p={...p,prompt:lvNw(p.prompt),hint:p.hint?lvNw(p.hint):''};"])
    assert.ok(show.includes(part), `plateau : ${part}`);
  assert.ok(show.includes('<p class="lv-pk-why" hidden></p>\n    ${p.hint?`<p class="lv-pk-hint">${p.hint}</p>`:\'\'}\n    ${opts.length?`<div class="lv-pk-opts">')
    && html.includes('.lv-pk-hint{margin:-5px 2px 11px;font:600 14px/1.35 var(--ui);color:var(--ink-3,#6A6490);text-align:left;'), 'les consignes au même endroit : la ligne d’aide suit la consigne, au-dessus des étiquettes');
  const layer = cut('function lvPkLayer(P){', 'function lvPkActed(');
  for (const part of ['spots=(IX&&IX.spots&&IX.spots(P.i))||[]', "if(P.kind==='tap')P.spots.forEach(b=>b.addEventListener('click',()=>lvPkAct(P,[b.dataset.k],b)));",
    'lvPkDrag(P,c,zones,z=>{ lvPkSel(P,null); lvPkAct(P,[+c.dataset.k,z.el.dataset.k],z.el,c); });', 'lvGlisse(btn,', 'lvGlisse(a,',
    'res=IX&&IX.act?IX.act(P.i,...args):null;', "b.setAttribute('aria-label',"])
    assert.ok(layer.includes(part), `gestes : ${part}`);
  /* Glisser du premier coup sur iPhone : le doigt passe par les événements tactiles, qui bloquent le défilement dès le premier
     mouvement (Safari n’applique pas toujours touch-action et annulait le geste) ; la souris par les événements pointeur ;
     un toucher reste un toucher, avec un seul clic. */
  const gl = cut('function lvGlisse(el,can,slop,on){', 'function lvPkLink(P,a,b){');
  for (const part of ["el.addEventListener('touchmove',e=>{", 'if(e.cancelable)e.preventDefault();', '},{passive:false});', "if((tactile&&e.pointerType!=='mouse')||e.button!==0||!can())return;",
    'el.setPointerCapture(e.pointerId);', 'el._noClick=performance.now()+450;', 'if(G&&!G.on&&e.cancelable){ e.preventDefault(); el._noClick=0; el.click(); el._noClick=performance.now()+600; }'])
    assert.ok(gl.includes(part), `geste : ${part}`);
  let now = 1000;
  const geste = tactile => {
    const ctxG = vm.createContext({Math, window: tactile ? {ontouchstart: null} : {}, performance: {now: () => now}});
    vm.runInContext(gl + ';this.f=lvGlisse;', ctxG);
    const L = {}, log = [];
    const el = {clicks: 0, addEventListener(t, f){ (L[t] = L[t] || []).push(f); }, removeEventListener(t, f){ L[t] = (L[t] || []).filter(x => x !== f); }, setPointerCapture(){}, click(){ this.clicks++; }};
    ctxG.f(el, () => true, 6, {start: (x, y) => log.push(`start ${x},${y}`), move: (x, y) => log.push(`move ${x},${y}`), end: c => log.push(`end ${c}`)});
    const fire = (t, e) => { (L[t] || []).slice().forEach(f => f(e)); return e; };
    return {el, log, fire};
  };
  const pt = (x, y, id = 1) => ({identifier: id, clientX: x, clientY: y});
  const tev = (touches, changed) => ({touches, changedTouches: changed, cancelable: true, prevented: false, preventDefault(){ this.prevented = true; }});
  { const {el, log, fire} = geste(true);
    fire('touchstart', tev([pt(100, 200)], [pt(100, 200)]));
    const m1 = fire('touchmove', tev([pt(106, 205)], [pt(106, 205)]));
    assert.ok(m1.prevented && log.length === 0, 'doigt : défilement bloqué dès le premier mouvement, sans glisser sous 10 px');
    fire('touchmove', tev([pt(110, 190)], [pt(110, 190)]));
    fire('touchend', tev([], [pt(110, 190)]));
    assert.deepEqual(log, ['start 100,200', 'move 110,190', 'end false'], 'doigt : la copie part du point touché et se pose au lâcher');
    assert.ok(el.clicks === 0 && el._noClick === now + 450, 'après un glisser, pas de clic'); }
  { const {el, log, fire} = geste(true);
    fire('touchstart', tev([pt(50, 50)], [pt(50, 50)]));
    fire('touchmove', tev([pt(56, 54)], [pt(56, 54)]));
    const up = fire('touchend', tev([], [pt(56, 54)]));
    assert.ok(log.length === 0 && el.clicks === 1 && up.prevented && el._noClick === now + 600, 'toucher qui tremble de 7 px : un seul clic, tout de suite'); }
  { const {log, fire} = geste(true);
    fire('touchstart', tev([pt(50, 50)], [pt(50, 50)])); fire('touchmove', tev([pt(80, 50)], [pt(80, 50)])); fire('touchcancel', tev([], [pt(80, 50)]));
    fire('touchstart', tev([pt(0, 0, 1), pt(9, 9, 2)], [pt(9, 9, 2)]));
    fire('pointerdown', {pointerType: 'touch', button: 0, clientX: 5, clientY: 5, pointerId: 3});
    assert.deepEqual(log, ['start 50,50', 'move 80,50', 'end true'], 'geste interrompu : l’étiquette revient ; deuxième doigt et événements pointeur du doigt ignorés'); }
  for (const tactile of [true, false]) {
    const {log, fire} = geste(tactile);
    fire('pointerdown', {pointerType: 'mouse', button: 0, clientX: 10, clientY: 10, pointerId: 1});
    fire('pointermove', {clientX: 30, clientY: 12}); fire('pointerup', {type: 'pointerup'});
    assert.deepEqual(log, ['start 10,10', 'move 30,12', 'end false'], `souris${tactile ? ' (écran tactile)' : ''} : glisser par les événements pointeur`);
  }
  const acted = cut('function lvPkActed(', 'function lvReplay(){');
  for (const part of ['if(r.done){ lvPkWin(P,why,r.at||(el&&el._s)||null); return; }', 'P.miss++;', "kick.textContent='✕ Essaie encore';",
    'const first=P.miss===0', 'lvPkSet(LV.id,P.i,first,P.miss);', "wEl.innerHTML=lvNw(why); wEl.className='lv-pk-why ko';", "if(P.layer)P.layer.classList.add('is-done');"])
    assert.ok(acted.includes(part), `verdict des gestes : ${part}`);
  /* Toucher, relier : les zones se voient sur l’image (contour qui s’allume deux fois, puis discret) ; plus léger sur un tableau entier. */
  assert.ok(html.includes('.lv-pk-layer.is-tap .lv-pk-spot:not(:disabled):not(.is-ko),.lv-pk-layer.is-link .lv-pk-spot:not(:disabled):not(.is-ko):not(.is-sel){')
    && html.includes('animation:lvSpot 1.2s ease-in-out 2}') && html.includes('@keyframes lvSpot{') && html.includes(".lv-pk-layer.is-many .lv-pk-spot:not(:disabled):not(.is-ko){")
    && html.includes("layer.className='lv-pk-layer is-'+P.kind+(spots.length>8?' is-many':'');") && html.includes('.lv-pk-layer.is-done .lv-pk-spot{background:transparent!important;'),
    'zones à toucher visibles sur l’image, effacées une fois le moment réussi');
  /* Glisser : chaque étiquette est une colonne du tableur (poignée, lettre, nom) ; à l’ouverture, une copie monte vers les tables. */
  const show2 = cut('function lvPkShow(i,p){', 'function lvPkTry(k){');
  assert.ok(show2.includes('>${LV_PK_GRIP}${o.tag?`<span class="lv-pk-tag">${esc(o.tag)}</span>`:\'\'}${esc(o.label)}</button>`')
    && show2.includes('aria-label="Colonne ${esc(o.tag)} : ${esc(o.label)}"'), 'étiquette à glisser : poignée, lettre de la colonne, nom');
  const demo = cut('function lvPkDemo(P){', 'function lvPkLayer(P){');
  for (const part of ["P.box.addEventListener('pointerdown',stop,{capture:true,once:true});", "btn.classList.add('is-demo'); P.layer.classList.add('is-armed');", 'P.demo=setTimeout(()=>run(2),700);', 'if(prefersReduceMotion())return;'])
    assert.ok(demo.includes(part), `démonstration du geste (toucher une étiquette, les tables s’allument) : ${part}`);
  /* Ranger au doigt : toucher d’abord (la ligne d’aide dit quelle table toucher), glisser en option, lâcher au bord d’une table compte. */
  const sel = cut('function lvPkSel(P,el){', 'function lvPkDrag(');
  assert.ok(sel.includes("h.innerHTML=o?(P.p.next?P.p.next.replace('{x}',x):`Touche maintenant la table de ${x}.`):P.p.hint;") && sel.includes('function lvPkNear(zs,x,y,m){'), 'étiquette choisie : l’aide guide (la phrase du moment, sinon « la table de … ») ; place la plus proche');
  assert.ok(sel.includes("if(!h.style.minHeight&&h.offsetHeight)h.style.minHeight=h.offsetHeight+'px';"), 'la ligne d’aide garde sa hauteur : la consigne ne bouge pas');
  assert.ok(html.includes('||lvPkNear(zs,x,y,32);') && html.includes('@keyframes lvSpotArm{') && html.includes("const LV_PK_ICO={tap:'👆',sort:'👆',link:'🔗'};"), 'glisser tolérant, tables qui appellent le doigt');
  const ctxN = vm.createContext({Math}); vm.runInContext(cut('function lvPkNear(zs,x,y,m){', 'function lvPkDrag(') + ';this.f=lvPkNear;', ctxN);
  const zs = [{x1: 0, y1: 0, x2: 100, y2: 100, n: 'a'}, {x1: 200, y1: 0, x2: 300, y2: 100, n: 'b'}];
  assert.ok(ctxN.f(zs, 120, 50, 32).n === 'a' && ctxN.f(zs, 185, 50, 32).n === 'b' && ctxN.f(zs, 150, 50, 32) === null, 'à moins de 32 px d’une table : elle est prise ; au milieu : rien');
  assert.ok(cut('function lvPkLayer(P){', 'function lvPkLayerPlace(){').includes("if(P.kind==='sort'){\n    lvPkDemo(P);") && cut('function lvPkClose(answered){', 'function lvReplay(){').includes('clearTimeout(P.demo); if(P.demoEl)P.demoEl.remove();'),
    'la démonstration part avec le moment et s’arrête avec lui');
  assert.ok(html.includes("fly.className='lv-pk-fly is-drag'+(P.kind==='sort'?' is-sort':''); fly.innerHTML=btn.innerHTML;"), 'la copie qui suit le doigt garde la poignée et la lettre');
  assert.ok(html.includes('.lv-pk-opt.is-placed,.lv-pk.is-sort .lv-pk-opt.is-placed{display:none}'), 'une étiquette posée quitte le plateau');
  /* Micro-interactions : onde au toucher, rebond du compteur, de la pastille et du badge, « Continuer » qui invite, dépôt qui file dans sa table. */
  assert.ok(cut('function lvPkLayer(P){', 'function lvPkLayerPlace(){').includes("if(b&&!b.disabled&&!P.done&&!P.busy)lvPkRipple(e.clientX,e.clientY);"), 'onde au toucher des zones');
  assert.ok(html.includes('lvPkBump(cnt,1.2);') && html.includes("if(dot){ dot.className=first?'ok':'try'; lvPkBump(dot,1.8); }") && html.includes("go.hidden=false; go.classList.add('is-ready');")
    && html.includes('.lv-pk-go.is-ready::after{') && html.includes('@keyframes lvRipple{'), 'rebonds, onde, bouton qui invite');
  assert.ok(html.includes('/* Lâchée sur une place : la copie y file et s’y fond. */') && html.includes('if(navigator.vibrate)navigator.vibrate(4);'), 'dépôt animé, vibration à l’entrée d’une table');
  /* Indice après deux erreurs : la page le donne (IX.hint), il prend la place de la ligne d’aide ; les zones à regarder ressortent. */
  const hintFn = cut('function lvPkHint(P){', '/* Poignée des étiquettes à glisser');
  for (const part of ['h=IX&&IX.hint?IX.hint(P.i):null;', "el.className='lv-pk-tip';", "const gh=P.box.querySelector('.lv-pk-hint'); if(gh)gh.hidden=true;", "b.classList.add('is-tip');"])
    assert.ok(hintFn.includes(part), `indice : ${part}`);
  assert.ok(html.includes('if(P.miss>=2)lvPkHint(P);') && html.includes('if(P.tries===2)lvPkHint(P);') && html.includes('.lv-pk-layer .lv-pk-spot.is-tip:not(:disabled):not(.is-ko){'), 'indice au deuxième essai manqué, zones en jaune');
  assert.ok(html.includes('.lv-pk-opt.can-drag{touch-action:none;') && html.includes('.lv-pk-spot{position:absolute;') && html.includes('.lv-pk-layer{position:absolute;inset:0;z-index:5;pointer-events:none}'),
    'le doigt ne fait pas défiler la page en glissant ; seules les zones de l’image captent les appuis');
  /* Relier : la page reçoit toujours l’élément de gauche en premier, quel que soit le sens du geste. */
  const calls = [];
  const ctx = vm.createContext({lvPkAct: (P, args) => calls.push(args.join('→'))});
  vm.runInContext(cut('function lvPkLink(P,a,b){', '/* Un geste : la page le juge'), ctx);
  const el = (k, side) => ({dataset: {k, side}});
  ctx.lvPkLink({}, el('coach1', 'l'), el('atelier2', 'r'));
  ctx.lvPkLink({}, el('atelier2', 'r'), el('coach1', 'l'));
  assert.equal(calls.join(' '), 'coach1→atelier2 coach1→atelier2', 'lien dans les deux sens');
  /* Mots à trait d’union : jamais coupés en fin de ligne, balises intactes. */
  vm.runInContext(cut('function lvNw(h){', 'function lvPkShow(i,p){') + ';this.lvNw=lvNw;', ctx);
  assert.equal(ctx.lvNw('Touche chaque case où l’e-mail de Salma Haddad est écrit.'), 'Touche chaque case où l’<span class="lv-nw">e-mail</span> de Salma Haddad est écrit.');
  assert.equal(ctx.lvNw('d’après la table <code class="a-b">inscriptions</code> ?'), 'd’après la table <code class="a-b">inscriptions</code> ?', 'balises et attributs intacts');
  assert.ok(html.includes('.lv-nw{white-space:nowrap}'), 'mot gardé entier');
});

test('Normaliser les inscriptions (projet, chapitre 1) : leçon seule, six moments sur l’image, clients de la base', async () => {
  const l56 = cut('guide({ id:56, titre:"Normaliser les inscriptions"', 'guide({ id:72,');
  assert.ok(l56.includes('leconSeule:true,') && l56.includes(",duree:'3 min 28',moments:6,seuil:4,"), 'leçon seule, 6 moments, validée avec 4 exercices réussis du premier coup');
  const page = fs.readFileSync(path.join(ROOT, 'assets/anim/projet-normaliser.html'), 'utf8');
  const a = page.indexOf('const DURATION = '), b = page.indexOf('/* ---------- Gabarits');
  assert.ok(a > 0 && b > a, 'données de la page localisées');
  const ctx = vm.createContext({APP: true});
  vm.runInContext(page.slice(a, b) + ';this.D = {COACHS, ATELIERS, YOGA, CLIENTS, INSCR, COLS, SORT, BINS, PICKS, SHEET, MAILS, OPENS, NEWMAIL};', ctx);
  const D = JSON.parse(JSON.stringify(ctx.D));
  assert.deepEqual(D.PICKS.map(p => p.kind), ['tap', 'tap', 'pick', 'sort', 'tap', 'pick'], 'toucher, choisir, glisser');
  assert.ok(D.PICKS.filter(p => p.kind === 'tap').every(p => /^Touche /.test(p.prompt)), 'chaque moment à toucher dit qu’il faut toucher l’image');
  /* Le récit : trois mails (Salma Haddad, Léa Simon, Moussa Diallo) font découvrir les trois anomalies, chacune tamponnée, puis réunies.
     Chaque mail arrive en notification : l’app s’arrête dessus (OPENS) jusqu’à ce que l’élève le touche, puis il se déplie. */
  assert.deepEqual(D.MAILS.map(m => m[0][1] + ' ' + m[0][2] + ' · ' + m[2]), ['Salma Haddad · coach', 'Léa Simon · cliente', 'Moussa Diallo · coach'], 'qui écrit, coachs désignés comme tels');
  assert.ok(D.COACHS.every(c => !Object.values(D.CLIENTS).some(([p, n]) => p === c[1] || n === c[2])), 'aucun coach ne porte le prénom ou le nom d’un client');
  assert.deepEqual(D.MAILS.map(m => m[4].replace(/&nbsp;/g, ' ')), ['Mon adresse e-mail est désormais salma@pro.fr. Peux-tu remplacer l’ancienne adresse salma@mail.fr dans le fichier des inscriptions aux ateliers ?',
    'Je ne pourrai pas venir à l’atelier Cuisine saine prévu le 19 septembre. Peux-tu annuler mon inscription ?',
    'Je propose un nouvel atelier Yoga du matin pour le 3 octobre. Peux-tu l’ajouter au fichier ? Il n’y a pas encore d’inscrits.'], 'les demandes des mails');
  assert.ok(page.includes("const mailText = ([w, , , , ask]) => ['Bonjour,', ask, 'Merci !', w[1]];"), 'chaque mail : « Bonjour, », la demande, « Merci ! », la signature');
  assert.equal(D.MAILS[0][3], D.NEWMAIL, 'Salma Haddad écrit depuis sa nouvelle adresse');
  D.OPENS.forEach((o, n) => {
    assert.equal(o.sel, '#ml' + (n + 1)); assert.equal(o.prompt, 'Touche le mail pour l’ouvrir.');
    assert.ok(o.at < D.PICKS[n].at && (n === 0 || o.at > D.PICKS[n - 1].at), `mail ${n + 1} : ouvert avant son moment « À toi »`);
  });
  assert.ok(page.includes('Course({duration: DURATION, chapters: CHAPTERS, captions: CAPTIONS, questions: QUESTIONS, notesAt: 159.3, picks: PICKS, opens: OPENS,'), 'mails envoyés au lecteur');
  const caps = page.slice(page.indexOf('const CAPTIONS = ['), page.indexOf('const QUESTIONS = []'));
  assert.ok(!caps.includes('tableur') && !/<b>(Salma Haddad|Léa Simon|Moussa Diallo)<\/b> : « /.test(caps), 'les demandes sont dans les mails, pas dans les légendes ; « le fichier »');
  for (const part of ["['an1', 'Anomalie de mise à jour'], ['an2', 'Anomalie de suppression'], ['an3', 'Anomalie d’insertion']", "['Mise à jour', 'Suppression', 'Insertion']",
    "mailIn(1, 34.7, OPENS[0].at);", "mailIn(2, 52.2, OPENS[1].at);", "mailIn(3, 68.75, OPENS[2].at);", "stampIn('#an1', 49.6, -5);", "stampIn('#an2', 65.5, -5);",
    "SALMA.slice(0, 2).forEach((r, k) => fixMail(r, 46.9 + k * 0.6));", '<i class="you">Toi</i>', "pop('#rcm', 122.5, 0.4);"])
    assert.ok(page.includes(part), `récit : ${part}`);
  assert.ok(page.includes('spots, act, pick, hint,') && page.includes("if (i === 0) return {text: 'L’e-mail du coach est dans la colonne E.'"), 'un indice par moment à toucher ou à glisser');
  const coreJs = fs.readFileSync(path.join(ROOT, 'assets/anim/core.js'), 'utf8'), coreCss = fs.readFileSync(path.join(ROOT, 'assets/anim/core.css'), 'utf8');
  assert.ok(coreJs.includes('function stampIn(sel, t, rot = 7){') && coreCss.includes('.stamp.warn{'), 'moteur : tampon d’alerte, pour tous les chapitres');
  assert.ok(coreJs.includes('opens: opens.map(o => ({t: unwarp(o.at), sel: o.sel, prompt: fr(o.prompt), label: o.label})),') && coreJs.includes('clashes: holdClashes(picks.concat(opens).map(p => p.at)),'),
    'moteur : mails à ouvrir envoyés au lecteur, sans animation en cours à l’arrêt');
  assert.deepEqual(D.PICKS.map(p => p.at), [...D.PICKS.map(p => p.at)].sort((x, y) => x - y), 'moments dans l’ordre');
  for (const p of D.PICKS.filter(x => x.kind === 'pick')) assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
  assert.deepEqual(D.SORT.map(r => r[0]), D.COLS.slice(1), 'chaque colonne du fichier est à ranger, dans l’ordre du fichier, sauf le client : sa table existe déjà');
  assert.equal(D.PICKS[3].options.map(o => o.tag + ' ' + o.label).join(', '), 'B titre de l’atelier, C date de l’atelier, D nom du coach, E e-mail du coach, F date d’inscription',
    'chaque étiquette dit ce que contient sa colonne, avec la lettre de la colonne dans le fichier');
  assert.deepEqual([D.PICKS[3].prompt, D.PICKS[3].hint], ['Associe chaque colonne du fichier à la table qui lui correspond.',
    'Touche une colonne ci-dessous, puis la bonne table. Tu peux aussi la faire glisser directement dans la table.'], 'consigne du moment 4, puis la ligne d’aide');
  assert.ok(page.includes("show(['#bok', '#ck0'], 95.0, {y: 0, scale: 0.4}, 0.4, 'back.out(2.2)');") && page.includes("${old.length ? '<i class=\"bok\" id=\"bok\">✓</i>' : ''}")
    && page.includes("if (i === 3) return {text: 'Que décrit la colonne : un atelier, un coach ou une inscription ?'};")
    && page.includes('const [col, to, , ok, bad] = SORT[a], j = COLS.indexOf(col),'), 'la table clients et la colonne client se cochent dès que la légende dit que la table existe ; rien à ranger côté client');
  assert.ok(page.includes("if (i === 3) return $$('.bin:not(.old)').map(") && D.SORT.every(r => r[1] !== 'clients' && !('clients' in r[4])),
    'la table clients n’est pas une table où ranger : ni surlignée, ni cible, ni correction');
  assert.ok(D.SORT.every(r => D.BINS.some(x => x[0] === r[1])), 'chaque colonne a sa table parmi les quatre');
  assert.equal(D.SHEET.filter(r => r[4] === 'salma@mail.fr').length, D.PICKS[0].need, 'l’e-mail de Salma Haddad, autant de fois que de cases à toucher');
  assert.equal(D.SHEET.filter(r => r[1] === 'Cuisine saine').length, 1, 'Cuisine saine : une seule ligne, effacée avec la désinscription');
  assert.ok(!D.INSCR.some(r => r[1] === D.YOGA[0]), 'Yoga du matin : aucun inscrit');
  const data = vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), data);
  const {createRequire} = await import('node:module');
  const SQL = await createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
  const db = new SQL.Database();
  db.run(vm.runInContext('SCHEMA_SQL', data));
  for (const [id, [prenom, nom]] of Object.entries(D.CLIENTS))
    assert.equal(JSON.stringify(db.exec(`SELECT prenom, nom FROM clients WHERE id = ${id}`)[0].values), JSON.stringify([[prenom, nom]]), `client ${id}`);
  db.close();
  /* Quatre ateliers bien-être, un coach par atelier, sauf Moussa Diallo : il anime le Pilates et propose ensuite Yoga du matin. */
  assert.deepEqual(D.ATELIERS.map(a => [a[1], a[4]]), [['Récupération', 1], ['Pilates', 2], ['Cuisine saine', 3], ['Méditation', 4]], 'un coach par atelier');
  assert.equal(new Set(D.ATELIERS.map(a => a[4])).size, D.ATELIERS.length, 'chaque atelier a son coach');
  assert.equal(D.YOGA[4], D.ATELIERS.find(a => a[1] === 'Pilates')[4], 'Yoga du matin : proposé par le coach du Pilates');
  assert.ok(D.ATELIERS.every(a => D.INSCR.some(r => r[1] === a[0])), 'chaque atelier a au moins un inscrit : il figure dans le fichier');
  assert.deepEqual(D.INSCR.map(r => [r[0], r[1]]).sort(), [[1, 1], [3, 1], [4, 1], [5, 2], [6, 4], [7, 3]], 'inscriptions du cas');
  assert.equal(new Set(D.INSCR.map(r => r[2])).size, D.INSCR.length, 'une date d’inscription par ligne : le 4 septembre désigne une seule inscription');
});

test('Clés et relations (projet, chapitre 2) : leçon seule, le cas du chapitre 1 relié par des clés, chaque réponse vérifiée dans SQLite', async () => {
  const l72 = cut('guide({ id:72, titre:"Clés et relations"', 'guide({ id:81,');
  assert.ok(l72.includes('leconSeule:true,') && l72.includes(",duree:'5 min 03',moments:6,seuil:4,"), 'leçon seule, 6 moments, validée avec 4 exercices réussis du premier coup');
  const load = (file, names) => {
    const page = fs.readFileSync(path.join(ROOT, 'assets/anim', file), 'utf8');
    const a = page.indexOf('const DURATION = '), b = page.indexOf('/* ---------- Gabarits');
    assert.ok(a > 0 && b > a, `données de ${file} localisées`);
    const ctx = vm.createContext({APP: true});
    vm.runInContext(page.slice(a, b) + `;this.D = {${names}};`, ctx);
    return [page, JSON.parse(JSON.stringify(ctx.D))];
  };
  const [page, D] = load('projet-cles.html', 'COACHS, ATELIERS, CLIENTS, INSCR, NOUVELLE, CARTES, DOUBLON, CAPTIONS, RELS, CAS, WHY, PICKS, MAILS, OPENS, SQL');
  const [ch1, C1] = load('projet-normaliser.html', 'COACHS, ATELIERS, YOGA, INSCR, NEWMAIL');
  /* Le cas du chapitre 1, tel qu’il l’a laissé : mêmes coachs (Salma Haddad avec sa nouvelle adresse), mêmes ateliers (Yoga du matin compris), mêmes inscriptions. */
  assert.deepEqual(D.COACHS.map(c => c.slice(0, 3)), C1.COACHS.map(c => c.slice(0, 3)), 'les quatre coachs du chapitre 1');
  assert.deepEqual(D.COACHS.map(c => c[3]), C1.COACHS.map((c, i) => i === 0 ? C1.NEWMAIL : c[3]), 'leurs adresses, celle de Salma Haddad mise à jour');
  assert.deepEqual(D.ATELIERS, C1.ATELIERS.concat([C1.YOGA]).map(a => [a[0], a[1], a[3], a[4]]), 'les cinq ateliers et leur coach');
  assert.deepEqual(D.INSCR, C1.INSCR.map((r, i) => [i + 1, r[0], r[1], r[3]]), 'les six inscriptions, dans le même ordre');
  assert.ok(ch1.includes('</span>Chapitre 2 · Clés et relations</span>') && page.includes('</span>Chapitre 3 · Modéliser avec UML</span>') && html.includes('guide({ id:81, titre:"Modéliser avec UML"'), 'chaque chapitre annonce le suivant sous son vrai titre');
  /* Les six moments */
  assert.deepEqual(D.PICKS.map(p => p.kind), ['pick', 'tap', 'pick', 'tap', 'pick', 'sort'], 'choisir, toucher, ranger');
  assert.ok(D.PICKS.filter(p => p.kind === 'tap').every(p => /^Touche /.test(p.prompt)), 'chaque moment à toucher dit qu’il faut toucher l’image');
  for (const p of D.PICKS.filter(x => x.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    /* Sauf atelier_id dans la table coachs (moment 3) : la vidéo l’explique juste après, une correction écrite le redirait. */
    assert.ok(p.options.every(o => o.ok || o.why || o === D.PICKS[2].options[0]), `${p.prompt} : chaque mauvaise réponse est expliquée`);
  }
  D.PICKS.forEach((p, i) => assert.ok(p.from < p.at && (i === 0 || p.from > D.PICKS[i - 1].at), `moment ${i + 1} : « Revoir » repart après le moment précédent`));
  D.OPENS.forEach((o, n) => {
    assert.equal(o.sel, '#ml' + (n + 1)); assert.equal(o.prompt, 'Touche le mail pour l’ouvrir.');
    assert.ok(o.at > D.PICKS[n + 3].at && o.at < D.PICKS[n + 4].at, `mail ${n + 1} : ouvert avant le moment qui en parle`);
  });
  assert.deepEqual(D.MAILS.map(m => m[0][0] + ' ' + m[0][1] + ' · ' + m[2]), ['Sophie Martin · cliente', 'L’équipe NutriBoost · équipe'], 'qui écrit');
  const name = id => D.CLIENTS.find(c => c[0] === id).slice(1).join(' '), atl = id => D.ATELIERS.find(a => a[0] === id);
  const caps = D.CAPTIONS.map(c => c[2]).join('\n');
  /* La vidéo rappelle d’abord le contexte, puis ce que le chapitre 1 a produit. */
  assert.ok(D.CAPTIONS[0][2].startsWith('NutriBoost lance des ateliers bien-être') && D.CAPTIONS[1][2] === 'Au chapitre 1, tu as réparti<br>les informations du fichier Excel<br>dans trois tables.' && D.CAPTIONS[2][2] === 'Ce sont les tables <code>coachs</code>,<br><code>ateliers</code> et <code>inscriptions</code>.', 'le contexte avant tout');
  /* Le problème : la table inscriptions ne contient que des dates ; la question arrive avec la ligne du 4 septembre et les deux « ? ». */
  /* Animations et sons des légendes du début : les trois tables s’allument à leur couleur quand elles sont nommées, toutes
     les dates s’allument, puis seule la ligne du 4 septembre ; le « ? » des puces devient une clé ; chaque id pulse quand la
     légende dit qu’une clé primaire ne peut pas être vide. */
  assert.ok(page.includes("TA.forEach(([s, rgb], q) => { glowOn(s, rgb, 9.6 + q * 0.3); cue(9.6 + q * 0.3, 'pop', 0.6, q * 2); });")
    && page.includes("INSCR.forEach(([n], k) => { tl.to(hl('ta-in', n), {opacity: 1, duration: 0.3}, 11.55 + k * 0.06); cue(11.55 + k * 0.06, 'tick', 0.4, k); });")
    && page.includes("keyChip('#ms1', 20.6); keyChip('#ms2', 20.8);") && page.includes("cue(41.75 + q * 0.05, 'tick', 0.45, 4 + q)")
    && page.includes("bump(['#ms1', '#ms2'], 17.55, 1.12);") && page.includes("TA.forEach(([s, rgb], q) => { glowOn(s, rgb, 18.7 + q * 0.15);"), 'chaque légende reprise a son animation et son son');
  /* « Identifiant », jamais « numéro », pour la valeur d’une clé : dans la vidéo comme dans les moments « À toi ». */
  assert.ok(!page.includes('numéro'), 'chapitre 2 : « identifiant », jamais « numéro »');
  const iq = D.CAPTIONS.findIndex(c => c[2] === 'Mais la <b>table inscriptions</b> contient seulement les dates d’inscription.');
  assert.ok(iq === 3 && D.CAPTIONS[iq + 1][2] === 'Impossible de savoir quel client s’est inscrit le 4 septembre, ni à quel atelier.'
    && D.CAPTIONS[iq + 1][0] <= 12.6 && D.CAPTIONS[iq + 1][1] >= 14.3 && D.CAPTIONS[iq + 2][2] === 'Pour le savoir, il faut relier les tables grâce à des <b>clés</b>.'
    && page.includes("pop('#ms1', 14.0, 0.5); pop('#ms2', 14.3, 0.5);"), 'la question du 4 septembre, pendant que la ligne s’allume et que « ? client » et « ? atelier » apparaissent');
  /* Une seule façon de nommer la table d’une relation N ↔ N, dans les trois chapitres. */
  for (const f of ['projet-normaliser.html', 'projet-cles.html', 'projet-uml.html'])
    assert.ok(!fs.readFileSync(path.join(ROOT, 'assets/anim', f), 'utf8').includes('table de jointure'), `${f} : « table d’association », jamais « table de jointure »`);
  assert.ok(caps.includes('Une <b>table d’association</b>'), 'le chapitre 2 la nomme comme le chapitre 3');
  /* La clé étrangère : sa définition, puis à quoi elle sert, sur l’exemple entouré (inscription 1, client_id 1, Sophie Martin). */
  const def = D.CAPTIONS.findIndex(c => c[2].includes('est une <b>clé étrangère</b>'));
  assert.equal(D.CAPTIONS[def + 1][2], 'Elle sert à relier chaque inscription à son client : ici, <code>client_id</code> vaut 1, l’identifiant de Sophie Martin.', 'à quoi sert une clé étrangère, sur un exemple expliqué');
  assert.deepEqual(D.INSCR[0].slice(0, 2), [1, 1]); assert.equal(name(1), 'Sophie Martin');
  /* La clé étrangère « fait référence à » la clé primaire (comme REFERENCES), dans la vidéo comme dans le récapitulatif. */
  assert.ok(!caps.includes('reprend la clé primaire') && caps.includes('Une colonne qui fait référence<br>à la clé primaire d’une autre table<br>est une <b>clé étrangère</b>.')
    && caps.includes('De même, <code>atelier_id</code> fait référence à la clé primaire de la <b>table ateliers</b>.'), 'clé étrangère : « fait référence à »');
  /* La clé primaire : une valeur qui ne désigne qu’une ligne, qui reste stable (jamais « ne changera jamais ») et qui ne peut pas être vide,
     comme le dit le récapitulatif. */
  const iPk = D.CAPTIONS.findIndex(c => c[2] === 'C’est la <b>clé primaire</b> de la table : chaque table reçoit la sienne.');
  assert.ok(iPk > 0 && D.CAPTIONS[iPk + 1][2] === 'Une clé primaire<br>ne peut pas être vide (<code>NULL</code>).' && D.CAPTIONS[iPk + 1][1] < 43.2, 'clé primaire : jamais vide, dans son chapitre');
  assert.ok(caps.includes('une valeur qui ne désigne qu’elle.') && caps.includes('un identifiant unique, qui reste stable.') && !/changera jamais|ne change jamais/.test(page), 'clé primaire : unique et stable, sans « jamais »');
  /* Avant 1 ↔ 1 : la table cartes et sa clé étrangère sont présentées (sa requête la déclare : tapée, puis surlignée) ; les anneaux
     relient ensuite chaque carte à son propriétaire, pendant « Un client n’a qu’une carte, et une carte n’a qu’un seul client ». */
  const iCa = D.CAPTIONS.findIndex(c => c[2] === 'On crée une <b>table cartes</b> :<br>sa clé étrangère <code>client_id</code> désigne le propriétaire de chaque carte.');
  assert.ok(iCa > 0 && D.CAPTIONS[iCa + 1][2].startsWith('Un client n’a qu’une carte') && page.includes("sqType('ca5', 134.3, 40);") && page.includes("band('ca5', 135.6);")
    && D.CAPTIONS[iCa][0] <= 134.3 && D.CAPTIONS[iCa][1] >= 136.1
    && page.includes("on([ring('td-ca', id, 1), ring('td-cl', c, 0)], 136.6 + k * 0.5)") && D.CAPTIONS[iCa + 1][0] <= 136.6 && D.CAPTIONS[iCa + 1][1] >= 137.9,
    'la table cartes présentée avec sa clé étrangère ; une carte par client, un client par carte, pendant la légende qui le dit');
  /* Chaque clé se déclare aussi en SQL : une carte de code (schema.sql), tapée au fil des légendes, avec la syntaxe du cours sur les
     bases relationnelles (FOREIGN KEY … REFERENCES). Chaque mot-clé arrive pendant la légende qui en parle. */
  const capAt = t => D.CAPTIONS.find(c => c[0] <= t && t <= c[1])[2];
  const when = (what, re) => { const m = page.match(re); assert.ok(m, what); return +m[1]; };
  assert.ok(capAt(when('PRIMARY KEY', /sqMore\('pkm', ([\d.]+)\)/)).startsWith('C’est la <b>clé primaire</b>'), 'PRIMARY KEY s’ajoute à la colonne id quand la légende nomme la clé primaire');
  assert.ok(capAt(when('FOREIGN KEY', /sqType\('fk6', ([\d.]+)/)).includes('est une <b>clé étrangère</b>'), 'FOREIGN KEY se tape pendant la définition de la clé étrangère');
  assert.ok(capAt(when('atelier_id', /sqType\('fk8', ([\d.]+)/)).startsWith('De même, <code>atelier_id</code>'), 'la clé étrangère d’atelier_id pendant « De même »');
  assert.ok(capAt(when('1 → N', /band\('at3', ([\d.]+)\)/)).startsWith('La règle : dans une relation 1 → N'), 'la clé étrangère déclarée dans la table ateliers, surlignée avec la règle');
  assert.ok(capAt(when('N ↔ N', /band\('nn3', ([\d.]+)\)/)).includes('sont des <b>clés étrangères</b>'), 'les deux clés étrangères de la table d’association surlignées quand la légende les nomme');
  assert.ok(capAt(when('UNIQUE', /sqMore\('cau', ([\d.]+)\)/)).startsWith('On ajoute la contrainte <code>UNIQUE</code>'), 'UNIQUE s’ajoute quand la légende ajoute la contrainte');
  assert.ok(fs.readFileSync(path.join(ROOT, 'assets/anim/bases-relationnelles.html'), 'utf8').includes('<span class="kw">FOREIGN KEY</span>')
    && Object.values(D.SQL).every(card => card.every(([, l]) => !/REFERENCES/.test(l) || /^\s*(FOREIGN KEY \(\w+\) )?REFERENCES \w+\(id\)/.test(l.replace(/[{[]\w+\||[}\]]/g, '')))),
    'FOREIGN KEY (colonne) REFERENCES table(id), comme au cours sur les bases relationnelles');
  /* Jamais de carte de légende vide : entre deux légendes éloignées (un mail, le passage au moment 6), la carte s’efface avec la
     légende et revient juste avant la suivante. */
  const offs = [...page.matchAll(/capOff\(([\d.]+)\)/g)].map(m => +m[1]), ons = [...page.matchAll(/capOn\(([\d.]+)\)/g)].map(m => +m[1]);
  D.CAPTIONS.slice(1).forEach((c, i) => {
    const b = D.CAPTIONS[i][1], a = c[0];
    if (a - b > 1) assert.ok(offs.some(t => Math.abs(t - (b - 0.2)) < 0.11) && ons.some(t => t >= a - 0.3 && t <= a), `légende vide entre ${b} et ${a}`);
  });
  /* N ↔ N : la table ateliers revient avec sa colonne coach_id (sa 3e colonne, c2), valeurs comprises. */
  assert.ok(page.includes("tl.set('#tb-at', {'--w3': '150px'}, 107.3);") && page.includes("tl.set('#tb-at .c2', {autoAlpha: 1}, 107.3);") && page.includes("{h: 'titre', w: '1fr'}, {h: 'coach_id', w: 'var(--w3)', k: 'k-co', ini: true}],\n    ATELIERS.map(x => ({id: x[0], v: [x[0], x[1], x[3]]}))"),
    'la colonne coach_id de la table ateliers, visible au retour des tables');
  assert.ok(caps.includes('Reste une relation à créer :<br>') && !caps.includes('dernière relation'), '« Reste une relation à créer » : la carte de membre en ajoute une plus tard');
  // Moment 2 : l’inscription du 4 septembre, une seule ce jour-là
  const r4 = D.INSCR.filter(r => r[3] === '2026-09-04');
  assert.equal(r4.length, 1, 'une seule inscription le 4 septembre');
  const [[n4, c4, a4]] = r4;
  assert.ok(page.includes(`const M2_ANS = {c${c4}: [ring('tb-in', ${n4}, 1), ring('tb-cl', ${c4}, 0), hl('tb-cl', ${c4})], a${a4}: [ring('tb-in', ${n4}, 2), ring('tb-at', ${a4}, 0), hl('tb-at', ${a4})]};`), 'réponse du moment 2 : la cliente et l’atelier de cette inscription');
  assert.ok(caps.includes(`C’est donc <b>${name(c4)}</b> qui s’est inscrite le 4 septembre, à l’atelier ${atl(a4)[1]}.`), 'la légende nomme la bonne cliente et le bon atelier');
  assert.equal(D.PICKS[1].prompt, 'Touche le client/la cliente et l’atelier correspondant à l’inscription du 4 septembre.',
    'la consigne ne dit pas si c’est une femme ou un homme : le genre de la personne fait déjà partie de la réponse');
  // Moment 4 : l’atelier de Diego Ramos ; l’explication du moment 3 prend l’exemple de Moussa Diallo
  const moussa = D.COACHS.find(c => c[1] === 'Moussa'), siens = D.ATELIERS.filter(a => a[3] === moussa[0]).map(a => a[0]);
  const diego = D.COACHS.find(c => c[1] === 'Diego'), sien = D.ATELIERS.filter(a => a[3] === diego[0]);
  /* D’où vient la règle du 1 → N, juste après le moment 3 : Moussa anime deux ateliers ; avec une colonne atelier_id dans la table
     coachs (elle s’ouvre), il faudrait inscrire ses deux identifiants dans la même case (en rouge) ; impossible, une case ne contient
     qu’une seule valeur ; on place donc coach_id dans la table ateliers. Après le moment 4 : le coach_id de ces ateliers est l’id
     de Moussa Diallo, puis la règle. */
  assert.equal(siens.length, 2);
  const why = ['Moussa anime deux ateliers :<br>le ' + siens.join(' et le ') + '. Imaginons une colonne<br><code>atelier_id</code> dans la table coachs.',
    'Il faudrait inscrire ces deux<br>identifiants dans la même case.', 'Impossible : une case ne doit contenir qu’une seule valeur.',
    'Pour garder une seule valeur par case,<br>on place plutôt <code>coach_id</code><br>dans la <b>table ateliers</b>.', 'Chaque atelier indique ainsi<br>le coach qui l’anime.'];
  const iw = D.CAPTIONS.findIndex(c => c[2] === why[0]);
  assert.ok(iw > 0 && D.CAPTIONS[iw - 1][2] === 'À toi !' && D.CAPTIONS[iw][0] > D.PICKS[2].at && why.every((w, k) => D.CAPTIONS[iw + k][2] === w) && D.CAPTIONS[iw + why.length][2] === 'À toi !',
    'juste après le moment 3, avant le moment 4 : pourquoi la clé ne va pas dans la table coachs');
  assert.ok(D.PICKS[2].options[0].label === 'Dans la table coachs : une colonne atelier_id' && !D.PICKS[2].options[0].why,
    'moment 3 : la colonne atelier_id dans la table coachs n’a pas de correction écrite, l’explication qui suit la donne');
  /* Le moment 4 porte sur un autre coach que celui de l’explication : sa réponse n’est pas donnée d’avance. */
  assert.equal(D.PICKS[3].prompt, `Touche l’atelier animé par ${diego[1]} ${diego[2]}.`);
  assert.ok(sien.length === 1 && !why.some(w => w.includes(diego[1])), 'moment 4 : un autre coach que Moussa Diallo, absent de l’explication');
  assert.equal(D.PICKS[3].need, sien.length, 'autant d’ateliers à toucher que Diego Ramos en anime');
  assert.ok(caps.includes(`L’atelier ${sien[0][1]} a <code>coach_id = ${diego[0]}</code> : c’est justement l’<code>id</code> de <b>${diego[1]} ${diego[2]}</b> dans la table coachs.`)
    && caps.includes('La règle : dans une relation 1 → N, la clé étrangère va du côté « plusieurs ».'), 'le moment 4 expliqué, puis la règle');
  const cap4 = D.CAPTIONS.findIndex(c => c[2].startsWith(`L’atelier ${sien[0][1]} a <code>coach_id`));
  assert.ok(D.CAPTIONS[cap4][0] > D.PICKS[3].at && D.CAPTIONS[cap4 - 1][2] === 'À toi !', 'juste après le moment 4');
  assert.ok(page.includes(`const M4_ANS = {${sien.map(a => `a${a[0]}: [hl('tc-at', ${a[0]}), ring('tc-at', ${a[0]}, 3)]`).join(', ')}, co: [hl('tc-co', ${diego[0]}), ring('tc-co', ${diego[0]}, 0)]};`)
    && page.includes(`<i class="two">${siens.join(', ')}</i>`), 'réponse du moment 4, et la case à deux identifiants de la mauvaise idée du moment 3');
  /* « Un coach peut animer plusieurs ateliers » : Moussa Diallo et ses deux ateliers reviennent à l’image, à la place de la réponse du moment 4. */
  assert.ok(page.includes(`const N_ANS = [hl('tc-co', ${moussa[0]}), ring('tc-co', ${moussa[0]}, 0), ${siens.map(i => `hl('tc-at', ${i}), ring('tc-at', ${i}, 3)`).join(', ')}];`)
    && page.includes("tl.to(M4_ANS.co.concat(M4_ANS.a4), {autoAlpha: 0, duration: 0.25, ease: 'power2.in'}, 95.3);") && page.includes("tl.to(N_ANS, {autoAlpha: 1, duration: 0.3, ease: 'power2.out'}, 95.45);")
    && D.CAPTIONS.find(c => c[2].startsWith('Un coach peut animer plusieurs ateliers'))[0] <= 95.3, '1 → N : Moussa Diallo et ses ateliers, dès « Un coach peut animer plusieurs ateliers »');
  /* Le 1 → N dit en toutes lettres : un coach, plusieurs ateliers ; un atelier, un seul coach ; le N signifie « plusieurs ». La pastille
     « 1 → N · un à plusieurs » arrive avec la légende qui la nomme ; puis la règle. */
  const one = ['Un coach peut animer plusieurs ateliers,<br>mais chaque atelier est animé<br>par un seul coach.', 'C’est une relation « un à plusieurs », notée <b>1 → N</b> : le N signifie « plusieurs ».'];
  const i1 = D.CAPTIONS.findIndex(c => c[2] === one[0]);
  assert.ok(i1 === cap4 + 1 && one.every((w, k) => D.CAPTIONS[i1 + k][2] === w) && D.CAPTIONS[i1 + 2][2].startsWith('La règle : dans une relation 1 → N'), '1 → N : la relation expliquée, puis la règle');
  assert.ok(page.includes("pop('#tc-rel', 97.6, 0.6);") && D.CAPTIONS[i1 + 1][0] <= 97.6 && D.CAPTIONS[i1][1] < 97.6, 'la pastille 1 → N arrive avec sa légende');
  // Moment 5 : la nouvelle inscription de Sophie Martin, celle que demande son mail
  assert.deepEqual([name(D.NOUVELLE[1]), atl(D.NOUVELLE[2])[1]], ['Sophie Martin', 'Méditation'], 'la nouvelle inscription : Sophie Martin, à Méditation');
  assert.ok(D.MAILS[0][4].includes(`l’atelier ${atl(D.NOUVELLE[2])[1]} du ${+atl(D.NOUVELLE[2])[2].slice(8)} septembre`), 'le mail demande cet atelier, à sa date');
  assert.equal(D.NOUVELLE[0], D.INSCR.length + 1, 'une ligne de plus, avec l’identifiant suivant');
  assert.equal(D.PICKS[4].prompt, `Sophie Martin s’inscrit aussi à l’atelier ${atl(D.NOUVELLE[2])[1]}. Comment l’enregistrer ?`, 'la question nomme l’atelier comme tel');
  /* Le mail de l’équipe, en trois paragraphes : un forfait de 10 séances qui diminue, une carte par client, et ce que la base doit garder
     (la carte, son propriétaire, les séances restantes : les colonnes de la table cartes). Aucune carte au-dessus du forfait. */
  const m2 = [].concat(D.MAILS[1][4]);
  assert.ok(m2.length === 3 && m2[0].includes('un forfait de 10 séances') && m2[0].includes('après 3 séances, il en reste 7') && m2[1].includes('une seule carte')
    && m2[2].includes('chaque carte, son propriétaire et le nombre de séances restantes') && D.CARTES.every(c => c[2] <= 10), 'le mail de l’équipe NutriBoost');
  assert.ok(page.includes("readTime(sn.slice(1, -2).map(s => s.textContent).join(' '))"), 'le temps de lire tous les paragraphes du mail');
  /* 1 ↔ 1 : la contrainte UNIQUE sur client_id (son badge apparaît), ce qu’elle interdit, puis la deuxième carte de Sophie Martin,
     qui arrive et se fait refuser pendant la légende qui le dit. */
  const uq = ['On ajoute la contrainte <code>UNIQUE</code> à la clé étrangère <code>client_id</code>.', 'Un même client ne peut ainsi apparaître qu’une seule fois dans la <b>table cartes</b>.',
    'Sophie ayant déjà une carte, l’ajout d’une deuxième est refusé.'];
  const iu = D.CAPTIONS.findIndex(c => c[2] === uq[0]);
  assert.ok(iu > 0 && uq.every((w, k) => D.CAPTIONS[iu + k][2] === w) && page.includes("pop('#uq', 140.2, 0.5);") && D.CAPTIONS[iu][0] <= 140.2
    && page.includes("tl.to('#td-ca-r4', {autoAlpha: 1, height: 64, duration: 0.35, ease: 'power2.out'}, 142.85);") && page.includes("stampIn('#td-st', 143.8, -5);")
    && D.CAPTIONS[iu + 2][0] <= 142.85 && D.CAPTIONS[iu + 2][1] >= 143.8 && D.DOUBLON[1] === D.CARTES[0][1], '1 ↔ 1 : la contrainte UNIQUE, puis la deuxième carte refusée');
  /* La réponse expliquée : une ligne dans inscriptions, avec l’identifiant de la cliente, celui de l’atelier (entourés à l’image,
     avec ce qu’ils désignent) et la date. */
  const m5 = [`Pour inscrire ${D.CLIENTS.find(c => c[0] === D.NOUVELLE[1])[1]} à l’atelier ${atl(D.NOUVELLE[2])[1]}, on ajoute une ligne dans <code>inscriptions</code>.`,
    `Elle contient l’identifiant<br>de ${D.CLIENTS.find(c => c[0] === D.NOUVELLE[1])[1]} (${D.NOUVELLE[1]}), celui de l’atelier (${D.NOUVELLE[2]})<br>et la date d’inscription.`];
  const i5 = D.CAPTIONS.findIndex(c => c[2] === m5[0]);
  assert.ok(i5 > 0 && D.CAPTIONS[i5 - 1][2] === 'À toi !' && D.CAPTIONS[i5][0] > D.PICKS[4].at && D.CAPTIONS[i5 + 1][2] === m5[1], 'moment 5 expliqué : la nouvelle ligne, ses deux identifiants et la date');
  assert.ok(page.includes('on(neuf.cl, 113.2);') && page.includes('on(neuf.at, 113.75);') && page.includes('off(neuf.at, 116.5);')
    && D.CAPTIONS[i5 + 1][0] <= 113.2 && D.CAPTIONS[i5 + 1][1] >= 113.75, 'les deux identifiants entourés pendant la légende qui les nomme');
  // Moment 6 : chaque cas dans sa forme ; une explication pour chaque mauvaise case
  assert.deepEqual(D.RELS.map(r => [r[1], D.CAS[r[3]]]), [['1 ↔ 1', 'Un client et sa carte de membre'], ['1 → N', 'Un coach et ses ateliers'], ['N ↔ N', 'Un client et ses ateliers']]);
  assert.deepEqual(D.PICKS[5].options.map(o => o.label.replace(/\u00a0/g, ' ')), D.CAS, 'les trois cas à ranger');
  assert.equal(D.PICKS[5].options[D.CAS.indexOf('Un client et sa carte de membre')].label, 'Un client et sa carte\u00a0de\u00a0membre', 'dans la carte du lecteur, « carte de membre » ne se coupe pas');
  assert.ok(D.PICKS[5].prompt === 'Range chaque situation selon son type de relation.' && D.PICKS[5].hint.startsWith('Touche une situation, puis le type de relation qui lui correspond.'),
    'la consigne parle de situations et de types de relation');
  assert.equal(D.PICKS[5].next, '« {x} » : quel est le type de relation ?', 'une situation choisie, la ligne d’aide demande son type de relation');
  assert.ok(fs.readFileSync(path.join(ROOT, 'assets/anim/core.js'), 'utf8').includes("next: p.next ? fr(p.next) : '',"), 'moteur : la ligne d’aide du moment envoyée au lecteur');
  /* Une explication par situation, montrée quand elle est mal rangée : les deux côtés de sa relation. */
  assert.deepEqual(D.WHY, ['Un coach anime plusieurs ateliers. Chaque atelier est animé par un seul coach.', 'Un client participe à plusieurs ateliers. Chaque atelier accueille plusieurs clients.',
    'Un client possède une seule carte. Chaque carte appartient à un seul client.'], 'l’explication de chaque situation');
  assert.ok(page.includes('return {ok: false, why: fr(WHY[a])};'), 'la même explication, quelle que soit la mauvaise case');
  assert.ok(page.includes("if (i === 5) return {text: 'Pour un élément d’un côté, combien peuvent lui être associés de l’autre : un seul ou plusieurs ? Pose-toi la question dans les deux sens.'};"), 'l’indice du moment 6 : la question à se poser, dans les deux sens');
  /* Le bilan, une relation par légende : sa case se soulève, sa règle apparaît dessous et reste. */
  const bil = ['Dans une relation <b>1 ↔ 1</b>, une clé étrangère unique relie les deux tables.', 'Dans une relation <b>1 → N</b>, la clé étrangère se place du côté « plusieurs ».',
    'Dans une relation <b>N ↔ N</b>, une table d’association relie les deux tables, avec une ligne par lien.'];
  const ib = D.CAPTIONS.findIndex(c => c[2] === bil[0]);
  assert.ok(ib > 0 && bil.every((w, k) => D.CAPTIONS[ib + k][2] === w) && D.CAPTIONS[ib][0] > D.PICKS[5].at, 'le bilan, juste après le moment 6');
  assert.ok(D.CAPTIONS.every(c => !/\b[Ee]n (<b>)?[1N] [↔→]/.test(c[2])), 'chapitre 2 : « Dans une relation 1 → N », jamais « En 1 → N »');
  assert.ok(page.includes("const BILAN = [['11', 150.0], ['1n', 152.1], ['nn', 154.2]];") && [0, 1, 2].every(k => D.CAPTIONS[ib + k][0] <= [150.0, 152.1, 154.2][k])
    && page.includes("const RULES = {'11': ['🔗', 'Clé étrangère', 'unique'], '1n': ['🔗', 'Clé étrangère', 'côté « plusieurs »'], nn: ['📝', 'Table d’association', 'deux clés étrangères']};"),
    'chaque relation, sa case soulevée et sa règle, pendant la légende qui la dit');
  assert.ok(page.includes('spots, act, pick, hint,') && page.includes(`if (i === 1) return {text: 'Cherche l’id ${c4} dans la table clients, puis l’id ${a4} dans la table ateliers.', keys: ['c${c4}', 'a${a4}']};`)
    && page.includes(`if (i === 3) return {text: '${diego[1]} ${diego[2]} a l’id ${diego[0]} : cherche l’atelier dont coach_id vaut ${diego[0]}.', keys: [${sien.map(a => `'a${a[0]}'`).join(', ')}]};`), 'un indice par moment à toucher ou à ranger');
  /* Le modèle de la vidéo, créé dans la base de l’app : les clés acceptent toutes les lignes montrées, refusent la deuxième carte,
     et chaque réponse se retrouve par une jointure. */
  const data = vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), data);
  const {createRequire} = await import('node:module');
  const SQL = await createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
  const db = new SQL.Database();
  db.run(vm.runInContext('SCHEMA_SQL', data));
  const q = s => JSON.stringify(db.exec(s)[0].values), v = x => typeof x === 'string' ? `'${x}'` : x, rows = a => a.map(r => `(${r.map(v).join(', ')})`).join(', ');
  for (const [id, prenom, nom] of D.CLIENTS) assert.equal(q(`SELECT prenom, nom FROM clients WHERE id = ${id}`), JSON.stringify([[prenom, nom]]), `client ${id}`);
  assert.equal(q('SELECT email FROM clients WHERE id = 1'), JSON.stringify([[D.MAILS[0][3]]]), 'Sophie Martin écrit depuis son adresse de la base');
  assert.equal(q("SELECT COUNT(*) FROM clients WHERE prenom = 'Nathan'"), '[[2]]', 'deux Nathan : un prénom n’identifie personne');
  db.run('PRAGMA foreign_keys = ON;');
  /* Les tables sont créées par les requêtes montrées dans la vidéo (« … » : les autres colonnes de la table, écrites ici). Celles
     d’inscriptions et de cartes sont complètes ; la table d’association reprend les deux clés étrangères d’inscriptions. */
  const sqlText = k => D.SQL[k].map(([, l]) => l.replace(/[{[]\w+\||[}\]]/g, '')).join('\n');
  const autres = {pk: '  prenom TEXT, nom TEXT, email TEXT', at: '  id INTEGER PRIMARY KEY, titre TEXT, date_atelier TEXT, coach_id INTEGER,'};
  const ddl = k => sqlText(k).replace('  …', autres[k]);
  assert.ok(!sqlText('fk').includes('…') && !sqlText('ca').includes('…') && sqlText('pk').includes('…') && sqlText('at').includes('…'), 'requêtes complètes, ou « … » pour les autres colonnes');
  const fkLines = k => sqlText(k).split('\n').filter(l => /FOREIGN KEY|REFERENCES/.test(l)).map(l => l.trim().replace(/,$/, ''));
  assert.deepEqual(fkLines('nn'), fkLines('fk'), 'la table d’association : les deux clés étrangères de la table inscriptions');
  db.run([ddl('pk'), ddl('at'), ddl('fk'), ddl('ca')].join('\n'));
  assert.deepEqual(['inscriptions', 'cartes'].map(t => JSON.parse(q(`SELECT group_concat(name) FROM pragma_table_info('${t}')`))[0][0]), ['id,client_id,atelier_id,date_inscription', 'id,client_id,seances'],
    'les colonnes des tables montrées à l’image');
  db.run(`INSERT INTO coachs VALUES ${rows(D.COACHS.map(c => c.slice(0, 4)))}; INSERT INTO ateliers VALUES ${rows(D.ATELIERS)};
    INSERT INTO inscriptions VALUES ${rows(D.INSCR)}; INSERT INTO cartes VALUES ${rows(D.CARTES)};`);
  assert.throws(() => db.run("INSERT INTO inscriptions VALUES (99, 99, 1, '2026-09-30');"), /FOREIGN KEY constraint failed/, 'la clé étrangère refuse un client qui n’existe pas');
  assert.equal(q(`SELECT clients.prenom || ' ' || clients.nom, ateliers.titre FROM inscriptions JOIN clients ON clients.id = inscriptions.client_id
    JOIN ateliers ON ateliers.id = inscriptions.atelier_id WHERE inscriptions.date_inscription = '2026-09-04'`), JSON.stringify([[name(c4), atl(a4)[1]]]), 'moment 2 : la jointure retrouve l’inscription du 4 septembre');
  assert.equal(q("SELECT ateliers.titre FROM ateliers JOIN coachs ON coachs.id = ateliers.coach_id WHERE coachs.prenom = 'Moussa' ORDER BY ateliers.id"), '[["Pilates"],["Yoga du matin"]]', 'l’explication du moment 3 : Moussa Diallo anime deux ateliers (1 → N)');
  assert.equal(q("SELECT ateliers.titre FROM ateliers JOIN coachs ON coachs.id = ateliers.coach_id WHERE coachs.prenom = 'Diego'"), '[["Méditation"]]', 'moment 4 : la jointure retrouve l’atelier de Diego Ramos');
  db.run(`INSERT INTO inscriptions VALUES ${rows([D.NOUVELLE])};`);
  assert.equal(q('SELECT COUNT(*) FROM inscriptions WHERE client_id = 1'), '[[2]]', 'moment 5 : Sophie Martin suit deux ateliers…');
  assert.equal(q("SELECT COUNT(*) FROM inscriptions JOIN ateliers ON ateliers.id = inscriptions.atelier_id WHERE ateliers.titre = 'Récupération'"), '[[3]]', '… et Récupération accueille trois clients (N ↔ N)');
  /* N ↔ N dit en toutes lettres, chaque moitié avec son exemple entouré (Sophie Martin, puis l’atelier Récupération), puis la relation
     nommée avec sa pastille. */
  const nn = ['Un client peut participer à plusieurs ateliers.', 'Un atelier peut accueillir plusieurs clients.', 'C’est une relation<br>« plusieurs à plusieurs », notée <b>N ↔ N</b>.'];
  const inn = D.CAPTIONS.findIndex(c => c[2] === nn[0]);
  assert.ok(inn > 0 && nn.every((w, k) => D.CAPTIONS[inn + k][2] === w) && D.CAPTIONS[inn][0] <= 117.0 && D.CAPTIONS[inn + 1][0] <= 119.6 && D.CAPTIONS[inn + 2][0] <= 123.2
    && page.includes('on(sophie, 117.0);') && page.includes('on(recup, 119.6);') && page.includes("pop('#tb-rel', 123.2, 0.6);"), 'N ↔ N : chaque légende avec ce qu’elle montre');
  /* Puis la table d’association (son titre souligné), l’identifiant d’un client et celui d’un atelier entourés dans chaque ligne, et ses
     deux clés étrangères (leurs colonnes soulignées). Les mots d’Elisa. */
  const ta = ['Une <b>table d’association</b> enregistre ces participations.', 'Chaque ligne contient l’identifiant d’un client et celui d’un atelier.', 'Ces deux identifiants<br>sont des <b>clés étrangères</b>.'];
  assert.ok(ta.every((w, k) => D.CAPTIONS[inn + 3 + k][2] === w) && page.includes("bump('#tb-in .h', 125.2, 1.06);")
    && page.includes("INSCR.concat([NOUVELLE]).forEach((x, k) => { on([ring('tb-in', x[0], 1), ring('tb-in', x[0], 2)], 126.3 + k * 0.08, 0.25);")
    && page.includes("bump('#tb-in .hd .c1', 127.6, 1.12); bump('#tb-in .hd .c2', 127.85, 1.12);"), 'la table d’association, chaque ligne avec ses deux identifiants, puis ses deux clés étrangères');
  /* « N ↔ N » : ni Bricolage Grotesque ni Inter n’ont la flèche ; la police système la dessine, en texte. Sans elle, l’iPhone prenait
     l’émoji (un carré bleu) dans la pastille ; avec la variante texte U+FE0E, une flèche minuscule dans l’étiquette du chapitre. */
  const coreCss = fs.readFileSync(path.join(ROOT, 'assets/anim/core.css'), 'utf8'), coreSrc = fs.readFileSync(path.join(ROOT, 'assets/anim/core.js'), 'utf8');
  assert.ok(coreCss.includes("--display:'Bricolage Grotesque','Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',system-ui,sans-serif;")
    && /--ui:'Inter',-apple-system/.test(coreCss) && !coreSrc.includes('uFE0E'), '↔ dessinée par la police système, jamais en émoji');
  assert.throws(() => db.run(`INSERT INTO cartes VALUES ${rows([D.DOUBLON])};`), /UNIQUE constraint failed: cartes\.client_id/, 'une deuxième carte pour Sophie Martin est refusée (1 ↔ 1)');
  assert.equal(name(D.DOUBLON[1]), 'Sophie Martin');
  db.close();
});

test('« Identifiant », jamais « numéro », pour la valeur d’une clé : vidéos, cours et quiz', () => {
  /* « Numéro » reste pour ce qui en est un : numero_commande (CMD-2026-…), un téléphone, une chambre, ROW_NUMBER, le jour du mois. */
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  const read = f => strip(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  // vidéos où « numéro » ne désignait que des identifiants : il n’y en a plus
  for (const f of ['bases-relationnelles', 'exists', 'group-concat', 'in', 'inner-join', 'join-group-by', 'jointure-3-tables', 'normalisation', 'plusieurs-conditions-on', 'projet-cles'])
    assert.ok(!/num[ée]ros?\b/i.test(read(`assets/anim/${f}.html`)), `${f}.html : « identifiant », pas « numéro »`);
  // ailleurs, les identifiants seulement (le numéro d’une chambre, d’un téléphone ou d’une commande reste un numéro)
  const bad = {'index.html': /Affiche le num[ée]ro \(<code>id|client num[ée]ro|attribue le num[ée]ro|son propre num[ée]ro|num[ée]ros? déjà pris|num[ée]ro de client|plusieurs num[ée]ros/,
    'assets/anim/quel-join-choisir.html': /contient (un|le) num[ée]ro|num[ée]ro n’est jamais/, 'assets/anim/sous-requete-in.html': /num[ée]ros? de (son )?clients?/};
  for (const [f, re] of Object.entries(bad)) { const m = read(f).match(re); assert.ok(!m, `${f} : « ${m && m[0]} » : c’est un identifiant`); }
});

test('Modéliser avec UML (projet, chapitre 3) : leçon seule, le plan des tables du chapitre 2, chaque multiplicité et chaque traduction vérifiées', async () => {
  const l81 = cut('guide({ id:81, titre:"Modéliser avec UML"', 'guide({ id:61,');
  assert.ok(l81.includes('leconSeule:true,') && l81.includes(",duree:'5 min 02',moments:6,seuil:4,"), 'leçon seule, 6 moments, validée avec 4 exercices réussis du premier coup');
  const load = (file, names) => {
    const page = fs.readFileSync(path.join(ROOT, 'assets/anim', file), 'utf8');
    const a = page.indexOf('const DURATION = '), b = page.indexOf('/* ---------- Gabarits');
    assert.ok(a > 0 && b > a, `données de ${file} localisées`);
    const ctx = vm.createContext({APP: true});
    vm.runInContext(page.slice(a, b) + `;this.D = {${names}};`, ctx);
    return [page, JSON.parse(JSON.stringify(ctx.D))];
  };
  const [page, D] = load('projet-uml.html', 'TABLES2, CLASSES, ASSOCS, ACLASS, TRAD, SHOP, SHOP_ASSOCS, FIND, PLACE, CHAPTERS, CAPTIONS, PICKS, MAILS, OPENS');
  const [ch2, C2] = load('projet-cles.html', 'COACHS, ATELIERS, CLIENTS, INSCR, NOUVELLE, CARTES, DOUBLON');
  const [, C1] = load('projet-normaliser.html', 'COACHS');
  const T = Object.fromEntries(D.TABLES2.map(([k, , name, cols]) => [k, {name, cols}]));
  const isFk = c => Array.isArray(c);
  /* Le plan dessiné est celui des tables du chapitre 2 : mêmes tables, mêmes colonnes. */
  assert.deepEqual(D.TABLES2.map(t => t[2]), ['coachs', 'ateliers', 'clients', 'inscriptions', 'cartes'], 'les cinq tables du chapitre 2');
  for (const k of ['co', 'at', 'in', 'ca']) for (const c of T[k].cols.filter(c => c !== 'id'))
    assert.ok(ch2.includes(`{h: '${isFk(c) ? c[0] : c}'`), `${T[k].name}.${isFk(c) ? c[0] : c} : une colonne du chapitre 2`);
  assert.deepEqual([C2.COACHS[0].length - 1, C2.ATELIERS[0].length, C2.INSCR[0].length, C2.CARTES[0].length], [T.co.cols.length, T.at.cols.length, T.in.cols.length, T.ca.cols.length],
    'autant de colonnes que de valeurs par ligne au chapitre 2');
  /* Chaque classe porte les colonnes de sa table, sans aucune clé ; la date d’inscription va dans la classe d’association. */
  for (const [k, , attrs] of D.CLASSES) assert.deepEqual(attrs, T[k].cols.filter(c => c !== 'id' && !isFk(c)), `classe ${k} : ses attributs, sans clé`);
  assert.deepEqual(D.ACLASS[1], T.in.cols.filter(c => c !== 'id' && !isFk(c)), 'classe d’association : la date d’inscription');
  /* La traduction de chaque association redonne exactement les clés étrangères du chapitre 2 :
     un côté * → la clé étrangère va dans la table de ce côté ; aucun côté * → clé étrangère unique ; deux côtés * → une table d’association. */
  const max = m => m.slice(-1);
  for (const [k, , , a, ma, b, mb] of D.ASSOCS) {
    if (max(ma) === '*' && max(mb) === '*') {
      assert.equal(D.TRAD[k], T.in.name, `${k} : * des deux côtés, sa propre table`);
      assert.deepEqual(T.in.cols.filter(isFk).map(c => c[1]).sort(), [a, b].sort(), `${k} : la table d’association porte une clé vers chaque classe`);
    } else {
      const [colName, where, to] = D.TRAD[k], side = max(ma) === '*' ? a : max(mb) === '*' ? b : (ma === '1' ? b : a);
      assert.equal(where, side, `${k} : la clé étrangère va du côté * (ou du côté 0..1)`);
      assert.ok(T[where].cols.some(c => isFk(c) && c[0] === colName && c[1] === to), `${k} : ${colName} dans la table ${T[where].name}, comme au chapitre 2`);
    }
  }
  /* Les multiplicités disent vrai sur les données du chapitre 2. */
  const ins = C2.INSCR.concat([C2.NOUVELLE]);
  const count = (rows, j, v) => rows.filter(r => r[j] === v).length;
  const assocs = Object.fromEntries(D.ASSOCS.map(x => [x[0], x]));
  assert.ok(C2.ATELIERS.every(r => r[3] != null) && Math.max(...C2.COACHS.map(c => count(C2.ATELIERS, 3, c[0]))) > 1 && assocs.an[4] === '1' && assocs.an[6] === '0..*', 'anime : 1 coach par atelier, plusieurs ateliers pour Moussa Diallo');
  const parAtelier = C2.ATELIERS.map(a => count(ins, 2, a[0])), parClient = C2.CLIENTS.map(c => count(ins, 1, c[0]));
  assert.ok(Math.min(...parAtelier) === 0 && Math.max(...parAtelier) > 1 && assocs.in[4] === '0..*', 's’inscrit à, côté Client : Yoga du matin sans inscrit, Récupération avec plusieurs');
  assert.ok(Math.min(...parClient) === 0 && Math.max(...parClient) > 1 && assocs.in[6] === '0..*', 's’inscrit à, côté Atelier : Lucas Bernard sans atelier, Sophie Martin avec deux');
  const cartes = C2.CLIENTS.map(c => count(C2.CARTES, 1, c[0]));
  assert.ok(Math.min(...cartes) === 0 && Math.max(...cartes) === 1 && C2.CARTES.some(c => c[1] === C2.DOUBLON[1]) && assocs.po[6] === '0..1' && assocs.po[4] === '1', 'possède : une carte au plus (la deuxième est refusée), aucune pour certains');
  const caps = D.CAPTIONS.map(c => c[2]).join('\n');
  /* Légendes lues à plat (sans balises ; un retour à la ligne voulu devient une espace) : les phrases d’Elisa se retrouvent mot pour mot. */
  const flat = i => D.CAPTIONS[i][2].replace(/<br>/g, ' ').replace(/<[^>]+>/g, '');
  const idx = start => { const i = D.CAPTIONS.findIndex((c, k) => flat(k).startsWith(start)); assert.ok(i >= 0, `légende « ${start} »`); return i; };
  const said = (start, n) => Array.from({length: n}, (_, k) => flat(idx(start) + k)).join(' ');
  assert.ok(said('L’atelier Yoga du matin', 2) === 'L’atelier Yoga du matin n’a encore aucun inscrit, l’atelier Récupération en a trois. On écrit donc 0..* du côté de la classe Client.'
    && count(ins, 2, 1) === 3 && count(ins, 2, 5) === 0, 'la légende cite les bons ateliers');
  /* L’ouverture : la phrase demandée, en deux légendes qui se suivent (une phrase complète par bulle : « Il faut aussi » relie la seconde à la première) ;
     chaque partie a son geste pendant sa légende : les cinq tables s’allument et les quatre clés étrangères s’entourent pendant la première,
     puis les trois tables qu’elles désignent s’allument pendant la seconde. */
  const io = D.CAPTIONS.findIndex(c => c[2] === 'Pour comprendre comment les tables<br>sont reliées, il faut repérer<br>leurs clés étrangères.');
  assert.ok(io >= 0 && D.CAPTIONS.slice(io, io + 2).map(c => c[2].replace(/<br>/g, ' ')).join(' ')
    === 'Pour comprendre comment les tables sont reliées, il faut repérer leurs clés étrangères. Il faut aussi identifier les tables auxquelles elles renvoient.', 'la phrase d’ouverture, en deux phrases complètes');
  assert.ok(D.CAPTIONS[io][1] < D.CAPTIONS[io + 1][0], 'deux légendes qui se suivent, sans se chevaucher');
  const fkt = D.TABLES2.flatMap(t => t[3].filter(isFk).map(c => c[1]));
  assert.deepEqual(fkt, ['co', 'cl', 'at', 'cl'], 'les quatre clés étrangères, dans l’ordre d’affichage, et la table que chacune désigne');
  assert.equal(new Set(fkt).size, 3, 'trois tables désignées : coachs, clients, ateliers');
  assert.ok(page.includes("TABLES2.forEach(([k], q) => { tint(k, 11.22 + q * 0.14); untint(k, 11.5 + q * 0.14);") && D.CAPTIONS[io][0] < 11.22 && 11.22 < D.CAPTIONS[io][1]
    && page.includes("bump(f, 13.02 + q * 0.2, 1.12); halo(f, FKT[q], 13.02 + q * 0.2);") && D.CAPTIONS[io][0] < 13.02 && 13.02 + 3 * 0.2 < D.CAPTIONS[io][1]
    && page.includes("const t = 14.7 + q * 0.22, k = FKT[q];") && D.CAPTIONS[io + 1][0] < 14.7 && 14.7 + 3 * 0.22 < D.CAPTIONS[io + 1][1],
    'les tables et les clés étrangères s’animent pendant la première légende, les tables désignées pendant la seconde');
  assert.ok(page.includes('.sch{left:64px;width:952px;top:236px;padding:14px 0;overflow:hidden}'), 'le fond d’une table allumée suit les angles arrondis de la carte');
  /* Le diagramme arrive après le mail de Karim. Chaque texte a son rôle et ne répète pas les autres : la bulle dit la mission et l’intérêt
     du diagramme (sans nommer Karim, que le mail seul présente) ; le mail dit qui demande, pourquoi, et ce qu’il y cherche ; la légende
     nomme le diagramme de classes et ce qu’il comporte, sans redire la demande (ni « colonnes », ni « relations ») et sans devancer la phrase suivante
     (« Chaque élément à gérer est représenté par une classe »). */
  const bubble = /<div class="abs bubble">([^<]+)<\/div>/.exec(page)[1];
  assert.ok(!bubble.includes('Karim') && !/<br>/.test(bubble) && bubble.startsWith('Tu vas représenter la structure de la base avec un diagramme UML pour visualiser'), 'la bulle : la mission et son intérêt, sans Karim');
  assert.ok(page.includes('hold(2.3, 5.4);') && Math.abs(bubble.replace(/&nbsp;/g, ' ').length / 17 - 7.53) < 0.01, 'la bulle (128 caractères) reste affichée le temps de la lire');
  const ic = D.CAPTIONS.findIndex(c => c[2].startsWith('Pour répondre à Karim, on utilise un <b class="nw">diagramme de classes UML</b>.'));
  assert.ok(ic > 0 && D.CAPTIONS[ic + 1][2] === 'Il comporte quatre éléments :<br>clients, coachs, ateliers et cartes.', 'la légende après le mail : le diagramme, puis ce qu’il comporte');
  assert.ok(D.CAPTIONS[ic - 1][1] < D.OPENS[0].at && D.CAPTIONS[ic][0] > D.OPENS[0].at + 3 && D.CAPTIONS[ic][1] < D.CAPTIONS[ic + 1][0] && D.CAPTIONS[ic + 1][1] < D.CHAPTERS[1].a && D.CAPTIONS[ic + 2][0] >= D.CHAPTERS[1].a,
    'deux légendes qui se suivent, sans se chevaucher, dans le chapitre « Le plan »');
  assert.ok(!/colonnes|relations|création de la base|créer la base|Pour dessiner ce plan/.test([D.CAPTIONS[ic][2], D.CAPTIONS[ic + 1][2]].join(' ')), 'la légende ne redit pas la demande de Karim');
  assert.ok(!/représent|à gérer/.test(flat(ic + 1)), 'la légende d’avant ne dit pas deux fois la même chose que la réf 1 (« représenté », « élément à gérer »)');
  assert.ok(!/sujet/.test(JSON.stringify([D.CAPTIONS, D.PICKS, D.MAILS, bubble])), 'un « élément » (pas un « sujet ») devient une classe : même mot dans les légendes, les réponses et le mail');
  assert.ok(html.includes('e:"Une classe décrit un élément à gérer : elle devient une table, et ses attributs deviennent ses colonnes."') && !html.includes('Une classe décrit un sujet'), 'le quiz dit aussi « élément », pas « sujet »');
  assert.ok(D.CAPTIONS[ic + 2][2].startsWith('Chaque élément à gérer est représenté par une <b>classe</b>.'), 'la suite reprend « éléments »');
  /* La transition vers les tables (texte d’Elisa du 23 octobre, 11:02), en deux bulles, avant le premier moment « À toi » : à cette étape, on décrit les classes
     et leurs attributs ; les clés (primaires et étrangères) viennent au passage aux tables. Elles sont lues avant « À toi ! », sans que la coupe du moment
     (1,35 s avant l’arrêt) ni un autre fondu ne les touche. */
  assert.deepEqual([flat(ic + 4), flat(ic + 5)], ['À cette étape, on décrit les classes et leurs attributs.', 'Les clés primaires et étrangères seront ajoutées lors du passage aux tables.'],
    'la transition vers les tables : une phrase complète par bulle, les mots d’Elisa');
  assert.equal(flat(ic + 6), 'À toi !');
  assert.ok(D.CAPTIONS[ic + 3][1] < D.CAPTIONS[ic + 4][0] && D.CAPTIONS[ic + 4][1] < D.CAPTIONS[ic + 5][0] && D.CAPTIONS[ic + 5][1] < D.CAPTIONS[ic + 6][0]
    && D.CAPTIONS[ic + 6][0] + 0.5 <= D.PICKS[0].at - 1.35 && D.CAPTIONS[ic + 5][1] - 0.25 >= D.CAPTIONS[ic + 5][0] + 0.5 && D.CAPTIONS[ic + 4][1] - 0.25 >= D.CAPTIONS[ic + 4][0] + 0.5,
    'les deux bulles se suivent sans se chevaucher, chacune entièrement apparue avant sa pause de lecture, puis « À toi ! » apparaît avant la coupe du moment 1');
  assert.ok(!/Aucune clé ici|pas la façon de les ranger/.test(caps), 'l’ancienne légende « Aucune clé ici » est remplacée');
  /* Le moment 1 reprend les mots de la transition : la clé étrangère coach_id vient au passage aux tables ; sa question nomme le diagramme (Elisa, 23 octobre, 11:15). */
  assert.equal(D.PICKS[0].prompt, 'Dans ce diagramme UML, comment montrer qu’un coach anime des ateliers ?');
  assert.equal(D.PICKS[0].options.find(o => /coach_id/.test(o.label)).why, 'Le diagramme ne montre aucune clé : la clé étrangère coach_id sera ajoutée lors du passage aux tables.');
  /* Chaque geste suit sa légende : les quatre classes arrivent pendant « on utilise un diagramme de classes UML », puis s’entourent
     chacune à son tour, dans l’ordre où la légende les nomme (clients, coachs, ateliers, cartes), pendant « Il représente… ». */
  const cls = Object.fromEntries(D.CLASSES.map(([k, name]) => [name.toLowerCase(), k]));
  const named = D.CAPTIONS[ic + 1][2].split('<br>')[1].replace(/\.$/, '').split(/, | et /).map(w => cls[w.replace(/s$/, '')]);
  assert.deepEqual(named, ['cl', 'co', 'at', 'ca'], 'les quatre éléments nommés, dans l’ordre de la légende');
  assert.ok(page.includes("['cl', 'co', 'at', 'ca'].forEach((k, q) => {\n    const t = 25.0 + q * 0.32;") && D.CAPTIONS[ic + 1][0] + 0.3 <= 25.0 && 25.0 + 3 * 0.32 + 0.45 + 0.25 < D.CAPTIONS[ic + 1][1] - 0.25,
    'chaque classe s’entoure pendant la légende qui la nomme, avant la pause de lecture');
  assert.ok(page.includes("[['#cb-co', 22.1], ['#cb-ca', 22.3], ['#cb-at', 22.5], ['#cb-cl', 22.7]]") && D.CAPTIONS[ic][0] <= 22.1 && 22.7 < D.CAPTIONS[ic][1], 'les quatre classes arrivent pendant la première légende');
  assert.ok(page.includes("tl.fromTo(`#cb-${k} .hlo`, {autoAlpha: 0}, {autoAlpha: 1,") && page.includes('bump(`#cb-${k}`, t, 1.05);') && page.includes("return h + '</div><i class=\"hlo\"></i></div>';")
    && page.includes('.hlo{position:absolute;left:0;right:0;top:0;bottom:0;border-radius:32px;box-shadow:inset 0 0 0 7px var(--c);'), 'le liseré de couleur et le rebond de la classe');
  /* Les textes d’Elisa (réfs du 22 octobre), mot pour mot : « du côté de la classe X » dit où s’écrit une multiplicité, « relation » (pas « lien »)
     entre les tables ; 0..* corrige « 0.. » et « Atelier* ». */
  assert.equal(said('Chaque élément à gérer', 2), 'Chaque élément à gérer est représenté par une classe. Elle porte un nom et contient des attributs. Les attributs sont les informations qui le décrivent, comme le prénom, le nom et l’e-mail d’un client.');
  assert.equal(said('La multiplicité indique', 2), 'La multiplicité indique combien d’éléments d’une classe peuvent être liés à un seul élément de l’autre. Par exemple, pour un coach, combien d’ateliers ? On écrit la réponse du côté de la classe Atelier.');
  assert.equal(D.PICKS[1].prompt, 'Place les multiplicités 1 et 0..* aux bonnes extrémités de l’association « anime ».');
  assert.equal(D.PICKS[1].hint, 'Touche une multiplicité, puis la classe à côté de laquelle tu veux la placer. Tu peux aussi la faire glisser.');
  assert.equal(said('Chaque atelier est animé', 2), 'Chaque atelier est animé par un seul coach : on place 1 du côté de la classe Coach. Un coach peut animer zéro, un ou plusieurs ateliers : on place 0..* du côté de la classe Atelier.');
  assert.equal(flat(idx('Chaque atelier est animé') + 2), 'Pour s’inscrit à : un client suit zéro, un ou plusieurs ateliers, donc 0..* du côté de la classe Atelier.');
  assert.equal(said('La date d’inscription', 3), 'La date d’inscription indique quand un client s’est inscrit à un atelier précis. On la place dans Inscription, une classe d’association. Elle est reliée par des pointillés à la relation entre Client et Atelier.');
  assert.equal(said('Le diagramme est maintenant complet', 2), 'Le diagramme est maintenant complet : il présente les informations à conserver et les relations entre les classes. Karim pourra s’appuyer dessus pour créer la base de données.');
  /* Chapitre 5 (texte d’Elisa du 23 octobre) : une phrase complète par bulle, mot pour mot ; « À toi ! » s’intercale avant la dernière bulle. */
  const S5 = ['Chaque classe devient une table, et ses attributs deviennent des colonnes.', 'Ici, on ajoute une clé primaire id pour identifier chaque ligne de façon unique.',
    'Les tables sont définies.', 'Il faut maintenant traduire les relations du diagramme en liens entre ces tables.',
    'On regarde d’abord le maximum de chaque côté : 1 signifie « au maximum un », et * signifie « plusieurs possibles ».',
    'Ces maximums permettent de distinguer trois cas : un à un, un à plusieurs et plusieurs à plusieurs.',
    'Chaque atelier a un seul coach.', 'On ajoute donc coach_id dans la table ateliers : cette clé étrangère indique quel coach anime chaque atelier.',
    'On ajoute client_id dans la table cartes pour identifier son propriétaire.', 'La contrainte UNIQUE empêche d’attribuer plusieurs cartes au même client.',
    'Un client peut s’inscrire à plusieurs ateliers, et un atelier accueillir plusieurs clients.', 'À toi !',
    'On crée donc la table inscriptions, avec client_id, atelier_id et date_inscription : une ligne par inscription.'];
  const i5 = idx('Chaque classe devient une table');
  assert.deepEqual(S5.map((_, k) => flat(i5 + k)), S5, 'chapitre 5 : les douze phrases d’Elisa, mot pour mot, une par bulle');
  /* Aucune des douze bulles ne fige la vidéo : chacune reste affichée au moins le temps de la lire (17 caractères par seconde). */
  S5.forEach((t, k) => { const [a, b] = D.CAPTIONS[i5 + k]; assert.ok(t.length / 17 <= (b - 0.2) - (a + 0.3) + 1e-9, `« ${t} » : lue sans pause`); });
  /* Trois bulles ne tiennent pas en trois lignes à la taille du cours (expressions collées) : leur 4e valeur autorise quatre lignes. */
  assert.deepEqual(D.CAPTIONS.map((c, k) => [flat(k).split(' ').slice(0, 3).join(' '), c[3]]).filter(x => x[1]), [['On regarde d’abord', 4], ['On ajoute donc', 4], ['On crée donc', 4]], 'les trois bulles de quatre lignes');
  /* Le texte colle aux données : la clé ajoutée et sa table pour chaque association, les colonnes de la table d’association. */
  const flatAll = D.CAPTIONS.map((_, k) => flat(k)).join('\n');
  for (const k of ['an', 'po']) { const [col, where] = D.TRAD[k]; assert.ok(flatAll.includes(`${col} dans la table ${T[where].name}`), `${col} dans la table ${T[where].name}`); }
  const colsIn = T.in.cols.filter(c => c !== 'id').map(c => isFk(c) ? c[0] : c);
  assert.ok(flatAll.includes(`la table ${D.TRAD.in}, avec ${colsIn.slice(0, -1).join(', ')} et ${colsIn.slice(-1)}`), 'la table d’association et ses colonnes');
  /* L’exercice des colonnes arrête l’image avant la dernière bulle, qui donne la réponse. */
  const iCl = idx('Un client peut s’inscrire'), iLast = idx('On crée donc la table inscriptions');
  assert.ok(iLast === iCl + 2 && flat(iCl + 1) === 'À toi !' && D.CAPTIONS[iCl][1] < D.CAPTIONS[iCl + 1][0] && D.PICKS[4].from === D.CAPTIONS[iCl][0]
    && D.CAPTIONS[iCl + 1][0] < D.PICKS[4].at && D.PICKS[4].at < D.CAPTIONS[iLast][0], 'le moment 5 vient après « À toi ! » et avant la bulle qui donne les colonnes');
  assert.ok(D.CAPTIONS.slice(i5, iLast).every(c => !/atelier_id|date_inscription/.test(c[2])), 'aucune bulle ne donne la réponse avant le moment 5');
  assert.ok(!/à côté (de|d’)/.test(JSON.stringify([D.CAPTIONS, D.PLACE])) && !/\blien\b/.test(JSON.stringify(D.CAPTIONS)), 'une multiplicité est « du côté de la classe X » ; « relation » entre tables (sauf « liens entre ces tables », phrase d’Elisa gardée telle quelle)');
  /* Chaque phrase a son geste et son son, pendant sa légende : après son fondu d’entrée, avant la pause de lecture qui tombe à sa fin. */
  const during = (t, i, d) => D.CAPTIONS[i][0] + 0.3 - 1e-9 <= t && t + d <= D.CAPTIONS[i][1] - 0.25 + 1e-9;
  const BEATS = [   // [début de la légende, extraits de la page (geste, son), début du geste, durée du geste]
    ['Chaque élément à gérer', ["['co', 'ca', 'at', 'cl'].forEach(k => lite(k, 28.8, 0.55));", "cue(28.8, 'pop', 0.6, 2);"], 28.8, 0.8],
    ['Chaque élément à gérer', ["bump(`#cb-${k} .cn`, 31.3 + q * 0.25, 1.12); cue(31.3 + q * 0.25, 'tick', 0.45, q);"], 31.3, 1.15],
    ['Chaque élément à gérer', ["$$('#sb .cls:not(.acl) .ar:not(.ini)').forEach((r, q) => pulse(r, 32.45 + q * 0.03, 1));", "cue(32.45, 'tick', 0.5, 3); cue(32.65, 'tick', 0.5, 5);"], 32.45, 0.8],
    ['Les attributs sont les informations', ["lite('cl', 35.4, 0.7, 1.03);", "cue(35.4, 'tick', 0.5, 1);"], 35.4, 0.95],
    ['Les attributs sont les informations', ["pulse(`#cb-cl-${a}`, 36.5 + q * 0.45, 1); cue(36.5 + q * 0.45, 'tick', 0.5, q + 2);"], 36.5, 1.4],
    ['Par exemple', ["lite('co', 60.9, 0.6); cue(60.9, 'tick', 0.5, 1);", "lite('at', 62.0, 0.6); cue(62.0, 'tick', 0.5, 3);"], 60.9, 1.95],
    ['Par exemple', ["pop('#ph-an', 63.9, 0.5);", "hide('#ph-an', 65.0, {y: 0, scale: 0.6}, 0.3);"], 63.9, 1.4],
    ['Chaque atelier est animé', ["lite('at', 69.2, 0.5); cue(69.2, 'tick', 0.5, 1);", "lite('co', 70.2, 0.5); cue(70.2, 'tick', 0.5, 3);", "bump('#mp-an-co', 70.5, 1.3); cue(70.5, 'pop', 0.6, 4);"], 69.2, 1.75],
    ['Un coach peut animer', ["lite('co', 71.9, 0.5); cue(71.9, 'tick', 0.5, 1);", "lite('at', 72.8, 0.5); cue(72.8, 'tick', 0.5, 3);", "bump('#mp-an-at', 73.3, 1.3); cue(73.3, 'pop', 0.6, 4);"], 71.9, 1.8],
    ['Pour s’inscrit à', ["glow('#ln-in', 74.9); bump('#an-in', 74.9, 1.1); cue(74.9, 'tick', 0.5, 2);", "lite('cl', 75.8, 0.6); cue(75.8, 'tick', 0.5, 1);", "lite('at', 77.2, 0.6); cue(77.2, 'tick', 0.5, 3);", "pop('#mp-in-at', 78.6, 0.5);"], 74.9, 4.2],
    ['L’atelier Yoga du matin', ["lite('at', 83.4, 0.7); cue(83.4, 'tick', 0.5, 1);"], 83.4, 0.95],
    ['L’atelier Yoga du matin', ["lite('cl', 85.2, 2.1); cue(85.2, 'tick', 0.5, 3);"], 85.2, 0.15],
    ['On écrit donc 0..*', ["bump('#mp-in-cl', 87.5, 1.3); cue(87.5, 'pop', 0.6, 4);"], 87.5, 0.4],
    ['La date d’inscription', ["glow('#ln-in', 89.3); cue(89.3, 'tick', 0.5, 2);"], 89.3, 0.4],
    ['La date d’inscription', ["lite('cl', 89.6, 1.5); lite('at', 89.6, 1.5); cue(89.6, 'tick', 0.5, 1);"], 89.6, 0.2],
    ['On la place dans Inscription', ["show('#ab', 91.6, {y: 30, scale: 0.92}, 0.5, 'back.out(1.6)'); cue(91.6, 'pop', 0.55, 4);", "tl.to('#ib-r3', {backgroundColor: 'rgba(22,148,71,.14)', duration: 0.25}, 92.2);", "cue(92.2, 'tick', 0.5, 4);"], 91.6, 0.9],
    ['Elle est reliée par des pointillés', ["draw('#ln-cx', 93.55, 0.35);", "glow('#ln-in', 93.95); bump('#an-in', 93.95, 1.1); cue(93.95, 'tick', 0.5, 2);"], 93.55, 0.85],
    ['Le diagramme est maintenant complet', ["], 101.5, 1.03); cue(101.5, 'stamp', 0.6);"], 101.5, 0.4],
    ['Le diagramme est maintenant complet', ["$$('#sb .ar:not(.ini)').forEach((r, q) => pulse(r, 102.4 + q * 0.04, 1));", "cue(102.4, 'tick', 0.5, 3); cue(102.6, 'tick', 0.5, 5);"], 102.4, 0.95],
    ['Le diagramme est maintenant complet', ["{stroke: '#6A4DF4', strokeWidth: 8, duration: 0.25, ease: 'power1.inOut'}, 103.6);", "bump(['#an-an', '#an-in', '#an-po'], 103.6, 1.1); cue(103.6, 'tick', 0.5, 2); cue(103.75, 'tick', 0.5, 4);"], 103.6, 0.4],
    ['Karim pourra s’appuyer dessus', ["lite(k, 105.1 + q * 0.15, 0.45, 1.03); cue(105.1 + q * 0.15, 'tick', 0.5, q);"], 105.1, 1.2],
    ['C’est le 0..1', ["bump('#mp-po-ca', 109.8, 1.25); lite('ca', 109.8, 0.6); cue(109.8, 'pop', 0.6, 4);"], 109.8, 0.9],
    ['C’est le 0..1', ["lite('cl', 111.2, 0.6); cue(111.2, 'tick', 0.5, 2);"], 111.2, 0.9],
    ['Son maximum vaut 1', ["tl.to('#mp-po-ca .mn', {opacity: 0.28, duration: 0.4, ease: 'power2.out'}, 113.0);", "bump('#mp-po-ca', 113.0, 1.25); cue(113.0, 'tick', 0.5, 4);"], 113.0, 0.45],
    // Chapitre 5 : une phrase par bulle, chaque geste et chaque son pendant sa bulle
    ['Chaque classe devient une table', ["[['co', 116.8], ['ca', 117.1], ['at', 117.4], ['cl', 117.7]].forEach(([k, t]) => toTable(k, t));"], 116.8, 1.4],
    ['Chaque classe devient une table', ["waveRows('#sb .cls:not(.acl) .ar:not(.ini)', 118.35, 3, 0.03);"], 118.35, 0.8],
    ['Chaque classe devient une table', ["waveRows('#sb .cls:not(.acl) .ar:not(.ini)', 119.45, 4, 0.03);"], 119.45, 0.8],
    ['Ici, on ajoute une clé primaire', ["[['co', 121.5], ['ca', 121.57], ['at', 121.64], ['cl', 121.71]].forEach(([k, t]) => addRow(`#cb-${k}-pk`, t));",
      "tl.to('#mp-an-co', {y: 52, duration: 0.4, ease: 'power2.inOut'}, 121.5);", "tl.to('#mp-po-ca', {y: 52, duration: 0.4, ease: 'power2.inOut'}, 121.57);"], 121.5, 0.61],
    ['Ici, on ajoute une clé primaire', ["pulse(`#cb-${k}-pk`, 122.3 + q * 0.1, 1); cue(122.3 + q * 0.1, 'tick', 0.5, q + 2);"], 122.3, 0.8],
    ['Ici, on ajoute une clé primaire', ["waveRows('#sb .cls:not(.acl) .ar:not(.ini), #sb .cls:not(.acl) .ar.pk', 124.1, 2, 0.035);"], 124.1, 0.96],
    ['Ici, on ajoute une clé primaire', ["pulse(`#cb-${k}-pk`, 124.9 + q * 0.08, 1)); cue(124.9, 'pop', 0.6, 4);"], 124.9, 0.74],
    ['Les tables sont définies', ["bump(['#cb-co', '#cb-ca', '#cb-at', '#cb-cl'], 126.7, 1.03); cue(126.7, 'stamp', 0.6);"], 126.7, 0.4],
    ['Il faut maintenant traduire', ["glow('#ln-' + k, 130.5 + q * 0.4); bump('#an-' + k, 130.5 + q * 0.4, 1.1); cue(130.5 + q * 0.4, 'tick', 0.5, q);"], 130.5, 1.2],
    ['Il faut maintenant traduire', ["lite(k, 132.2 + q * 0.2, 0.45, 1.03); cue(132.2 + q * 0.2, 'tick', 0.5, q);"], 132.2, 1.3],
    ['On regarde d’abord', ["tl.to('#sb .mp:not(.ask) .mn', {opacity: 0.28, duration: 0.4, ease: 'power2.out'}, 135.5);", "bump(m, 135.7 + q * 0.06, 1.12); cue(135.7 + q * 0.06, 'tick', 0.35, q);"], 135.5, 0.9],
    ['On regarde d’abord', ["bump(MX1, 137.2, 1.25); pulse(MX1, 137.2, 1); cue(137.2, 'pop', 0.6, 1);"], 137.2, 0.5],
    ['On regarde d’abord', ["bump(MXN, 139.1, 1.25); pulse(MXN, 139.1, 1); cue(139.1, 'pop', 0.6, 5);"], 139.1, 0.5],
    ['Ces maximums permettent', ["[144.8, 145.4, 146.3].forEach((t, q) => { tl.to(RL[q], {autoAlpha: 1, y: 0, duration: 0.4, ease: 'back.out(1.6)'}, t); cue(t, 'pop', 0.55, q); });"], 144.8, 1.9],
    ['Chaque atelier a un seul coach', ["lite('at', 148.55, 0.5); cue(148.55, 'tick', 0.5, 1);"], 148.55, 0.75],
    ['Chaque atelier a un seul coach', ["lite('co', 149.5, 0.5); bump('#mp-an-co', 149.5, 1.3); cue(149.5, 'pop', 0.6, 4);"], 149.5, 0.75],
    ['Chaque atelier a un seul coach', ["rlOn(1, 149.6); glow('#ln-an', 149.6);"], 149.6, 0.4],
    ['On ajoute donc', ["off(['#ln-an', '#an-an', '#mp-an-co', '#mp-an-at'], 151.1, 0.35);", "addRow('#cb-at-fk', 152.0);"], 151.1, 1.3],
    ['On ajoute donc', ["lite('at', 152.55, 0.55); cue(152.55, 'tick', 0.5, 3);"], 152.55, 0.8],
    ['On ajoute donc', ["tl.to('#cb-at-fk .hl', {opacity: 1, duration: 0.25, yoyo: true, repeat: 3}, 154.05); cue(154.05, 'pop', 0.6, 4);"], 154.05, 1.0],
    ['On ajoute donc', ["lite('co', 155.7, 0.5); cue(155.7, 'tick', 0.5, 1);"], 155.7, 0.75],
    ['On ajoute donc', ["lite('at', 156.5, 0.5); cue(156.5, 'tick', 0.5, 3);"], 156.5, 0.75],
    ['On ajoute client_id', ["rlOn(0, 158.3); glow('#ln-po', 158.35); bump(['#mp-po-ca', '#mp-po-cl'], 158.35, 1.15);"], 158.3, 0.45],
    ['On ajoute client_id', ["off(['#ln-po', '#an-po', '#mp-po-cl', '#mp-po-ca'], 158.95, 0.35);", "addRow('#cb-ca-fk', 159.05);"], 158.95, 0.5],
    ['On ajoute client_id', ["lite('ca', 159.5, 0.5); cue(159.5, 'tick', 0.5, 1);"], 159.5, 0.75],
    ['On ajoute client_id', ["tl.to('#cb-ca-fk .hl', {opacity: 1, duration: 0.25, yoyo: true, repeat: 3}, 160.7); cue(160.7, 'pop', 0.6, 4);"], 160.7, 1.0],
    ['On ajoute client_id', ["lite('cl', 161.7, 0.5); cue(161.7, 'tick', 0.5, 3);"], 161.7, 0.75],
    ['La contrainte UNIQUE', ["pop('#uq', 164.2, 0.5);"], 164.2, 0.5],
    ['La contrainte UNIQUE', ["bump('#uq', 164.95, 1.25); cue(164.95, 'tick', 0.5, 4);"], 164.95, 0.4],
    ['La contrainte UNIQUE', ["lite('ca', 165.8, 0.5); cue(165.8, 'tick', 0.5, 1);"], 165.8, 0.75],
    ['La contrainte UNIQUE', ["lite('cl', 166.85, 0.5); cue(166.85, 'tick', 0.5, 3);"], 166.85, 0.75],
    ['Un client peut s’inscrire', ["lite('cl', 168.5, 0.5); cue(168.5, 'tick', 0.5, 1);"], 168.5, 0.75],
    ['Un client peut s’inscrire', ["rlOn(2, 168.65); glow('#ln-in', 168.65);"], 168.65, 0.4],
    ['Un client peut s’inscrire', ["bump('#mp-in-at', 170.1, 1.3); cue(170.1, 'pop', 0.6, 3);"], 170.1, 0.4],
    ['Un client peut s’inscrire', ["lite('at', 171.3, 0.5); cue(171.3, 'tick', 0.5, 3);"], 171.3, 0.75],
    ['Un client peut s’inscrire', ["bump('#mp-in-cl', 172.75, 1.3); cue(172.75, 'pop', 0.6, 4);"], 172.75, 0.4],
    ['On crée donc la table inscriptions', ["off(['#ln-in', '#an-in', '#mp-in-at', '#mp-in-cl', '#ln-cx'], 177.2, 0.35);", "toTable('in', 177.3);"], 177.2, 0.6],
    ['On crée donc la table inscriptions', ["tl.to('#ib-r1 .hl', {opacity: 1, duration: 0.25, yoyo: true, repeat: 1}, 179.6); cue(179.6, 'pop', 0.6, 2);"], 179.6, 0.5],
    ['On crée donc la table inscriptions', ["tl.to('#ib-r2 .hl', {opacity: 1, duration: 0.25, yoyo: true, repeat: 1}, 180.25); cue(180.25, 'pop', 0.6, 3);"], 180.25, 0.5],
    ['On crée donc la table inscriptions', ["tl.to('#ib-r3', {backgroundColor: 'rgba(22,148,71,.14)', duration: 0.25, yoyo: true, repeat: 1}, 181.05); cue(181.05, 'pop', 0.6, 4);"], 181.05, 0.5],
    ['On crée donc la table inscriptions', ["bump('#ab', 182.3, 1.04); cue(182.3, 'stamp', 0.6);"], 182.3, 0.4],
    ['Ses deux clés étrangères', ["tl.to(['#ib-r1 .hl', '#ib-r2 .hl'], {opacity: 1, duration: 0.25, yoyo: true, repeat: 3}, 184.75);"], 184.75, 1.0],
    ['Ses deux clés étrangères', ["tl.to('#ib-r3', {backgroundColor: 'rgba(22,148,71,.14)', duration: 0.25, yoyo: true, repeat: 3}, 186.75);"], 186.75, 1.0],
    // La boutique entière : les classes arrivent, puis chaque association (trait, nom, multiplicités) ; la légende suivante lit passe et concerne
    ['Les règles valent pour tout diagramme', ["['#sh-co', '#sh-at', '#sh-in', '#qm-cl', '#qm-ca', '#qm-cm', '#qm-pr'].forEach((q, k) => { const t = 190.8 + k * 0.15;"], 190.8, 1.35],
    ['Les règles valent pour tout diagramme', ["const t = 192.0 + q * 0.5;", "draw('#ls-' + k, t, 0.4); show('#sn-' + k, t + 0.3, {y: 12}, 0.35);", "cue(t + 0.45, 'pop', 0.6, q);"], 192.0, 2.93],
    ['Les règles valent pour tout diagramme', ["draw('#ls-cx', 192.95, 0.3);"], 192.95, 0.3],
    ['Un client passe des commandes', ["lite('cl', 199.4, 0.5, 1.05, 'sh'); cue(199.4, 'tick', 0.5, 1);"], 199.4, 0.75],
    ['Un client passe des commandes', ["glow('#ls-pa', 199.9); bump('#sn-pa', 199.9, 1.1); cue(199.9, 'tick', 0.5, 2);"], 199.9, 0.4],
    ['Un client passe des commandes', ["lite('cm', 200.3, 0.5, 1.05, 'sh'); cue(200.3, 'tick', 0.5, 3);"], 200.3, 0.75],
    ['Un client passe des commandes', ["lite('cm', 201.6, 0.5, 1.05, 'sh'); cue(201.6, 'tick', 0.5, 1);"], 201.6, 0.75],
    ['Un client passe des commandes', ["glow('#ls-ce', 202.1); bump('#sn-ce', 202.1, 1.1); cue(202.1, 'tick', 0.5, 2);"], 202.1, 0.4],
    ['Un client passe des commandes', ["lite('pr', 202.6, 0.5, 1.05, 'sh'); cue(202.6, 'tick', 0.5, 4);"], 202.6, 0.75]
  ];
  for (const [start, code, t, d] of BEATS) {
    for (const c of code) assert.ok(page.includes(c), `geste de « ${start} » : ${c}`);
    assert.ok(during(t, idx(start), d), `« ${start} » : le geste (${t} s, ${d} s) tombe pendant la légende, avant sa pause de lecture`);
  }
  assert.ok(page.includes("const rlOn = (q, t) => { tl.to(RL[q].querySelector('.rlo'), {autoAlpha: 1, duration: 0.2}, t); tl.to(RL[q], {scale: 1.06, duration: 0.2, ease: 'back.out(2)'}, t); cue(t, 'tick', 0.5, q + 2); };"),
    'chaque sorte de relation s’allume avec un son quand son association est traduite');
  /* Ce qui s’efface ou revient à son aspect le fait après la pause de lecture, jamais à cheval dessus ; la pastille « ? » et les trois sortes de relations
     disparaissent avant l’arrêt du moment suivant. */
  const hold = start => D.CAPTIONS[idx(start)][1] - 0.25;
  assert.ok(104.4 > hold('Le diagramme est maintenant complet') && page.includes("{stroke: '#4B4570', strokeWidth: 5, duration: 0.3, ease: 'power1.inOut'}, 104.4);"), 'les traits retrouvent leur aspect après la pause de lecture');
  assert.ok(115.2 > hold('Son maximum vaut 1') && page.includes("tl.to('#mp-po-ca .mn', {opacity: 1, duration: 0.3}, 115.2);"), 'le 0.. de la pastille revient avec la suite du plan');
  assert.ok(65.0 + 0.3 <= D.PICKS[1].at - 1.35 && 174.5 + 0.3 <= D.PICKS[4].at - 1.35 && page.includes('tl.to(RL, {autoAlpha: 0, y: 24, duration: 0.3, ease: \'power2.in\'}, 174.5);'),
    'la pastille « ? » et les trois sortes de relations sont retirées avant l’arrêt du moment suivant');
  assert.ok(page.includes('<div class="abs mp ask" id="ph-an"><i>?</i></div>') && page.includes('.mp.ask{border-style:dashed;border-color:var(--accent);background:var(--accent-soft)}')
    && page.includes("at2('#ph-an', xa + 22, atl.y - 24 - 5 - $('#ph-an').offsetHeight);"), 'la pastille « ? » se pose là où s’écrira la multiplicité d’Atelier');
  assert.ok(page.includes(`['un à un', 'un à plusieurs', 'plusieurs à plusieurs'].map(t => \`<div class="rl">\${t}<i class="rlo"></i></div>\`)`) && page.includes('.rlo{position:absolute;')
    && page.includes("$('#rel').style.top = (cl.y + cl.h + 52 + 9 + 40) + 'px';"), 'les trois sortes de relations, sous les tables, avec leur liseré');
  assert.ok(page.includes('Une <b>multiplicité</b> s’écrit du côté de la classe<br>qu’elle compte : 1, 0..1, 0..* ou 1..*.'), 'le récapitulatif reprend « du côté de la classe »');
  /* Les six moments */
  assert.deepEqual(D.PICKS.map(p => p.kind), ['pick', 'sort', 'pick', 'tap', 'pick', 'sort'], 'choisir, placer, choisir, toucher, choisir, placer ; jamais deux fois de suite le même geste');
  assert.ok(D.PICKS.filter(p => p.kind === 'tap').every(p => /^Touche /.test(p.prompt)), 'chaque moment à toucher dit qu’il faut toucher l’image');
  for (const p of D.PICKS.filter(x => x.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    /* Sauf les deux mauvaises multiplicités du moment 3 : la légende qui suit les explique (Yoga du matin, Récupération). */
    assert.ok(p.options.every(o => o.ok || o.why || (p === D.PICKS[2] && !o.why)), `${p.prompt} : chaque mauvaise réponse est expliquée`);
  }
  D.PICKS.forEach((p, i) => assert.ok(p.from < p.at && (i === 0 || p.from > D.PICKS[i - 1].at), `moment ${i + 1} : « Revoir » repart après le moment précédent`));
  assert.deepEqual(D.PLACE.map(p => [p[0], p[1]]), [[assocs.an[4], assocs.an[3]], [assocs.an[6], assocs.an[5]]], 'moment 2 : chaque multiplicité d’anime, du côté de la classe qu’elle compte');
  assert.equal(D.PICKS[2].options.find(o => o.ok).label, assocs.in[4], 'moment 3 : la multiplicité du côté de la classe Client');
  assert.equal(D.PICKS[2].prompt, 'Combien de clients peuvent s’inscrire à un même atelier ?', 'moment 3 : la question d’Elisa (23 octobre, 11:02), mot pour mot');
  assert.equal(assocs.po[5], 'ca', 'moment 4 : la multiplicité qui interdit deux cartes est écrite du côté de la classe Carte (zone po-ca)');
  /* Moment 3 : pas de correction écrite pour les deux mauvaises multiplicités, la légende qui suit explique le minimum et le maximum. */
  const c3 = D.CAPTIONS.find(c => c[0] > D.PICKS[2].at);
  assert.ok(D.PICKS[2].options.filter(o => !o.ok).every(o => !o.why) && c3[2].replace(/<br>/g, ' ').startsWith('L’atelier Yoga du matin n’a encore aucun inscrit, l’atelier Récupération en a trois'),
    'moment 3 : la légende qui suit dit pourquoi ni 1..* ni 0..1');
  /* Moment 4 : sa réponse n’est pas donnée avant. La légende décrit la carte sans nommer ses multiplicités ; la réponse nomme le 0..1,
     et le client_id unique n’est annoncé qu’une fois, à la traduction en tables. */
  const before4 = D.CAPTIONS.filter(c => c[0] > D.PICKS[2].at && c[0] < D.PICKS[3].at).map(c => c[2]);
  assert.ok(before4.includes('Enfin, un client possède une carte de membre ou aucune, et une carte n’a qu’un seul client.') && before4.every(c => !c.includes('0..1')), 'moment 4 : le 0..1 n’est pas nommé avant');
  assert.ok(said('C’est le 0..1', 2) === 'C’est le 0..1, du côté de la classe Carte : zéro ou une carte par client. Son maximum vaut 1 : pas de deuxième carte.'
    && (caps.match(/<code>UNIQUE<\/code>/g) || []).length === 1, 'moment 4 expliqué (deux légendes de trois lignes au plus) ; la contrainte UNIQUE est dite une seule fois');
  assert.ok(page.includes("pop('#mp-po-ca', 97.0, 0.5);\n  pop('#mp-po-cl', 98.4, 0.5);"), 'le 0..1 puis le 1, dans l’ordre de la légende');
  /* D’où vient la règle du côté * : chaque atelier n’a qu’un coach à indiquer. */
  assert.ok(flat(idx('Chaque atelier a un seul coach') + 1).startsWith('On ajoute donc coach_id dans la table ateliers : cette clé étrangère indique quel coach'), 'la règle du côté * : un seul coach par atelier, donc coach_id dans ateliers');
  assert.ok(page.includes("pop('#uq', 164.2, 0.5);") && !page.includes("gsap.set('#uq'") && D.CAPTIONS[idx('La contrainte UNIQUE')][0] < 164.2, 'l’étiquette unique n’apparaît qu’avec la phrase qui la nomme');
  assert.equal(D.PICKS[4].options.find(o => o.ok).label, T.in.cols.map(c => isFk(c) ? c[0] : c).join(', '), 'moment 5 : les colonnes de la table inscriptions');
  /* Moment 5 (texte d’Elisa du 23 octobre, 08:32), mot pour mot : la question, puis l’explication de la bonne réponse (id en code : « id identifie » se lit mal sans). */
  assert.equal(D.PICKS[4].prompt, 'Quelles colonnes faut-il dans la table inscriptions pour identifier chaque inscription, la relier à un client et à un atelier, et conserver sa date ?');
  assert.equal(D.PICKS[4].options.find(o => o.ok).why.replace(/<\/?code>/g, ''), 'Chaque ligne indique quel client s’est inscrit à quel atelier, et à quelle date. La colonne id identifie cette inscription.');
  assert.ok(D.PICKS[4].options.find(o => o.ok).why.includes('La colonne <code>id</code> identifie'), 'moment 5 : la colonne id est en code');
  assert.ok(D.PICKS[4].options.filter(o => !o.ok).every(o => o.why && !/<code>/.test(o.why)), 'moment 5 : chaque mauvaise réponse est expliquée, en texte courant');
  assert.deepEqual(D.PICKS.filter(p => p.kind === 'sort').map(p => p.next), ['{x} : touche maintenant la classe à côté de laquelle tu veux la placer.', '{x} : touche maintenant son emplacement dans le diagramme.'], 'une ligne d’aide propre à chaque moment à placer');
  /* Moment 6 (texte d’Elisa du 23 octobre, 09:29) : le diagramme de toute la boutique. Trois classes gardent leur nom (Coach, Atelier, Inscription) ;
     les quatre autres (Client, Carte, Commande, Produit) sont des emplacements vides que l’élève retrouve en lisant les associations, et remplit
     en glissant les étiquettes. Passe et concerne sont les deux associations de plus, celles de la base de l’app. */
  assert.deepEqual(D.SHOP.map(s => s[1]), ['Coach', 'Atelier', 'Carte', 'Client', 'Commande', 'Produit'], 'toute la boutique : les six classes, plus Inscription (classe d’association)');
  assert.deepEqual(D.SHOP_ASSOCS.slice(0, 3), D.ASSOCS, 'les trois associations du chapitre figurent à l’identique dans la boutique');
  assert.deepEqual(D.SHOP_ASSOCS.slice(3).map(a => a[1]), ['passe', 'concerne'], 'deux associations de plus : passe et concerne');
  assert.deepEqual([...new Set(D.SHOP_ASSOCS.flatMap(a => [a[3], a[5]]))].sort(), D.SHOP.map(s => s[0]).sort(), 'chaque classe de la boutique est au bout d’une association');
  const sides = D.SHOP_ASSOCS.slice(3).map(([, , , a, ma, b, mb]) => max(ma) === '*' ? a : b);
  assert.deepEqual(sides, ['cm', 'cm'], 'les deux 0..* de passe et de concerne sont du côté de Commande');
  const shopName = Object.fromEntries(D.SHOP);
  assert.deepEqual(D.FIND.map(f => f[1]), ['Produit', 'Client', 'Commande', 'Carte'], 'les quatre étiquettes, Produit et Client d’abord (l’ordre d’Elisa)');
  assert.deepEqual(D.FIND.map(f => f[0]).sort(), ['ca', 'cl', 'cm', 'pr'], 'quatre classes à retrouver ; Coach, Atelier et Inscription gardent leur nom');
  for (const [k, name, a, why] of D.FIND) {
    const as = D.SHOP_ASSOCS.find(x => x[0] === a);
    assert.equal(name, shopName[k], `${k} : l’étiquette porte le nom de sa classe`);
    assert.ok(as && (as[3] === k || as[5] === k), `${name} : l’association « ${as && as[1]} » désigne bien cette classe`);
    assert.ok(why.includes(as[1]) && why.endsWith('.'), `${name} : la correction dit l’association en toutes lettres (« ${as[1]} ») sans donner la place`);
  }
  assert.deepEqual(D.PICKS[5].options.map(o => o.label), D.FIND.map(f => f[1]), 'une étiquette par classe à retrouver');
  assert.ok(D.PICKS[5].options.every(o => !o.ok && !o.why), 'le moment 6 se juge à chaque geste (IX.act), pas sur une réponse');
  assert.equal(D.PICKS[5].prompt, 'Place chaque étiquette sur sa classe, en lisant les associations.');
  assert.equal(D.PICKS[5].hint, 'Touche une étiquette, puis son emplacement dans le diagramme. Tu peux aussi la faire glisser.');
  /* Les légendes : la première nomme le diagramme entier, « À toi ! » vient ensuite, l’image s’arrête, et la dernière lit les deux associations
     nouvelles en même temps que le diagramme les allume. Plus aucune clé étrangère à toucher : ce moment-là est remplacé. */
  const iShop = idx('Les règles valent pour tout diagramme');
  assert.equal(flat(iShop), 'Les règles valent pour tout diagramme, par exemple celui de toute la boutique.');
  assert.equal(flat(iShop + 1), 'À toi !');
  assert.equal(flat(iShop + 2), 'Un client passe des commandes, et chaque commande concerne un seul produit.');
  assert.ok(D.PICKS[5].from === D.CAPTIONS[iShop][0] && D.CAPTIONS[iShop + 1][0] < D.PICKS[5].at && D.PICKS[5].at < D.CAPTIONS[iShop + 2][0], 'le moment 6 vient après « À toi ! » et avant la légende qui lit les associations');
  assert.ok(!/Commande porte|client_id|produit_id|clés étrangères que crée/.test(JSON.stringify([D.CAPTIONS.slice(iShop), D.PICKS[5]])), 'plus de clé étrangère dans ce moment ni dans ses légendes');
  assert.ok(flat(iShop + 2).length / 17 <= (D.CAPTIONS[iShop + 2][1] - 0.2) - (D.CAPTIONS[iShop + 2][0] + 0.3) + 1e-9 && flat(iShop).length / 17 <= (D.CAPTIONS[iShop][1] - 0.2) - (D.CAPTIONS[iShop][0] + 0.3) + 1e-9, 'les deux légendes se lisent sans pause');
  for (const part of ['FIND.map(([k]) => `<div class="abs qm" id="qm-${k}">?</div>`)', '.qm{width:330px;height:86px;border-radius:32px;border:4px dashed var(--accent);', '.gone{opacity:0!important;visibility:hidden!important}',
    "cbox('in', ACLASS[0], ' acl')", "tl.set(FIND.map(f => '#sh-' + f[0]), {autoAlpha: 1}, a5);", "tl.set('.qm', {autoAlpha: 0}, a5);",
    "mark($('#sh-' + k)); mark($('#qm-' + k), 'gone'); flash($('#sh-' + k), 'okb', 520);", "[$('#qm-' + b), $('#sh-' + b)].forEach(e => flash(e, 'kob', 480));", "pad(rel($('#qm-' + k)), 12)",
    "hide(['#sh .cls', '#sh .asn', '#sh .mp', '#sh line'], 204.85, {y: -40}, 0.4);"])
    assert.ok(page.includes(part), `moment 6 : ${part}`);
  assert.ok(204.85 > hold('Un client passe des commandes'), 'la boutique s’efface après la pause de lecture');
  /* Les emplacements restent au-dessus de la carte de réponse, même sur un petit écran (375 × 667 : elle monte jusqu’à 1264 environ, indice compris). */
  const SY = /SY = \{([^}]*)\}/.exec(page)[1].match(/\d+/g).map(Number);
  assert.ok(Math.max(...SY) + 86 + 12 < 1264 - 100, `emplacements : le plus bas finit à ${Math.max(...SY) + 86 + 12}`);
  /* Le mail, la suite */
  assert.deepEqual(D.MAILS.map(m => m[0][0] + ' ' + m[0][1] + ' · ' + m[2]), ['Karim Benali · développeur'], 'qui écrit');
  assert.deepEqual(D.MAILS[0].slice(4), [['Je suis Karim, le développeur back end.',
    'Je vais créer la base de données dans le SGBD de l’entreprise pour gérer les ateliers. Peux-tu me transmettre un diagramme UML présentant les tables, leurs colonnes et les relations entre elles ?',
    'Ce schéma me servira de référence pour créer les tables et les relier.'], 'Karim'], 'le mail : qui il est, ce qu’il va faire et demande, à quoi le schéma lui servira ; « relier », pas « liens » (relation entre tables), sans redire « relations entre elles »');
  assert.ok(page.includes("...[].concat(body), 'Merci !', sign].map((x, j, a) => `<span class=\"sn2${j === a.length - 1 ? ' s' : ''}\">${x}</span>`)")
    && page.includes("readTime(sn.slice(1, -2).map(s => s.textContent).join(' '))"), 'le mail déplie tous ses paragraphes, et l’image reste le temps de les lire');
  assert.ok(D.OPENS.length === 1 && D.OPENS[0].at < D.PICKS[0].at && D.OPENS[0].prompt === 'Touche le mail pour l’ouvrir.', 'le mail s’ouvre avant le premier moment');
  assert.ok(![...C2.CLIENTS, ...C1.COACHS].some(p => p[1] === 'Karim' || p[2] === 'Benali'), 'le développeur ne porte le nom d’aucun client ni coach');
  assert.ok(page.includes('</span>Prochaine leçon · CREATE TABLE</span>') && html.includes('guide({ id:61, titre:"CREATE TABLE"'), 'la suite annoncée sous son vrai titre');
  /* Dans la base de l’app, le diagramme de la boutique est exact : client_id peut rester vide (0..1, une commande sans client),
     produit_id est obligatoire (1) ; les deux sont des clés étrangères de commandes. */
  const data = vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), data);
  const {createRequire} = await import('node:module');
  const SQL = await createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
  const db = new SQL.Database();
  db.run(vm.runInContext('SCHEMA_SQL', data));
  const q = s => JSON.stringify(db.exec(s).map(r => r.values));
  assert.equal(q("SELECT \"from\", \"table\" FROM pragma_foreign_key_list('commandes') ORDER BY \"from\""), '[[["client_id","clients"],["produit_id","produits"]]]', 'commandes : client_id et produit_id');
  assert.equal(q("SELECT name, \"notnull\" FROM pragma_table_info('commandes') WHERE name IN ('client_id', 'produit_id') ORDER BY name"), '[[["client_id",0],["produit_id",1]]]', 'client_id facultatif (0..1), produit_id obligatoire (1)');
  assert.equal(q('SELECT COUNT(*) FROM commandes WHERE client_id IS NULL'), '[[[1]]]', 'une commande sans client : le 0 de 0..1');
  assert.notEqual(q('SELECT client_id FROM commandes GROUP BY client_id HAVING COUNT(*) > 1'), '[]', 'plusieurs commandes par client : 0..* côté Commande');
  assert.notEqual(q('SELECT produit_id FROM commandes GROUP BY produit_id HAVING COUNT(*) > 1'), '[]', 'plusieurs commandes par produit : 0..* côté Commande');
  assert.equal(D.SHOP_ASSOCS[3][4], '0..1'); assert.equal(D.SHOP_ASSOCS[4][6], '1');
  for (const c of T.cl.cols.filter(c => c !== '…')) assert.equal(q(`SELECT COUNT(*) FROM pragma_table_info('clients') WHERE name = '${c}'`), '[[[1]]]', `clients.${c} : une colonne de la base`);
  db.close();
});

test('chapitres 1 à 3 et « Quel JOIN choisir ? » : une phrase complète par bulle, jamais une phrase coupée entre deux légendes', () => {
  for (const f of ['projet-normaliser.html', 'projet-cles.html', 'projet-uml.html', 'quel-join-choisir.html']) {
    const page = fs.readFileSync(path.join(ROOT, 'assets/anim', f), 'utf8');
    const a = page.indexOf('const DURATION = '), b = page.indexOf('/* ---------- Gabarits');
    assert.ok(a > 0 && b > a, `données de ${f} localisées`);
    const ctx = vm.createContext({APP: true});
    vm.runInContext(page.slice(a, b) + ';this.C = CAPTIONS;', ctx);
    const caps = JSON.parse(JSON.stringify(ctx.C));
    assert.ok(caps.length > 20, `${f} : ses légendes`);
    caps.forEach(([, , t], k) => {
      const txt = t.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').trim();
      /* Chaque bulle se lit seule : elle commence comme une phrase (majuscule, chiffre, guillemet ; une minuscule seulement pour un nom de colonne ou
         de table en code, comme <code>medecin_id</code>) et finit comme une phrase (point, ! ? ou guillemet fermant). */
      assert.ok(/^[A-ZÀ-ÖØ-Þ0-9«]/.test(txt) || /^(<b[^>]*>)?<code>/.test(t), `${f} · légende ${k + 1} : une phrase qui commence (« ${txt.slice(0, 50)} »)`);
      assert.ok(/[.!?»]$/.test(txt), `${f} · légende ${k + 1} : une phrase qui finit (« …${txt.slice(-50)} »)`);
    });
  }
});

test('légendes : une 4e valeur [début, fin, texte, 4] autorise quatre lignes, la carte monte le temps de cette légende, et le contrôle de mise en page la respecte', () => {
  const core = fs.readFileSync(path.join(ROOT, 'assets/anim/core.js'), 'utf8');
  for (const part of ["if (c[3] > 3) d.dataset.lines = c[3];", "if (captions[i][3] > 3) {", "const up = Math.round(44 * 1.32);",
    "tl.to(capCard, {top: capCard.offsetTop - up, height: capCard.offsetHeight + up, duration: 0.3, ease: 'power2.out'}, a);",
    "tl.to(capCard, {top: capCard.offsetTop, height: capCard.offsetHeight, duration: 0.3, ease: 'power2.in'}, b - 0.2);",
    "if (lines > (captions[i][3] || 3)) out.push({i, lines, text: captions[i][2]});", "lines.length > (+el.closest('.c').dataset.lines || 3)"])
    assert.ok(core.includes(part), `quatre lignes : ${part}`);
  /* Sans 4e valeur, une légende reste limitée à trois lignes dans toutes les autres leçons. */
  for (const f of fs.readdirSync(path.join(ROOT, 'assets/anim')).filter(f => f.endsWith('.html')))
    if (f !== 'projet-uml.html') assert.ok(!/\n\s*\[[\d.]+, [\d.]+, ("[^\n]*"|'[^\n]*'), 4\],?/.test(fs.readFileSync(path.join(ROOT, 'assets/anim', f), 'utf8')), `${f} : aucune légende de quatre lignes`);
});

test('mise en page (?check) : un élément ou un texte qui sort de son cadre est signalé (pastille, colonnes)', () => {
  const core = fs.readFileSync(path.join(ROOT, 'assets/anim/core.js'), 'utf8');
  for (const part of ["keep(key, {kind: 'débordement',", "const clips = el => getComputedStyle(el).overflowX !== 'visible'",
    "if (!/^(absolute|fixed)$/.test(pos(el)) && isBox(el)) { const f = frameOf(el); if (f) flows.push({el, f}); }",
    'const lead = t ? parseFloat(getComputedStyle(el).fontSize) * k / 3 : 0;', 'if (over <= 3) return;'])
    assert.ok(core.includes(part), `contrôle : ${part}`);
  /* Chapitre 1 du projet : les six colonnes tiennent dans la ligne du tableur (carte de 1016 px, bordures de 3 px, marges de 10 px). */
  const page = fs.readFileSync(path.join(ROOT, 'assets/anim/projet-normaliser.html'), 'utf8');
  const cols = /\.xr\{[^}]*grid-template-columns:([^;]+);/.exec(page)[1].trim().split(/\s+/).map(parseFloat);
  assert.ok(cols.length === 6 && cols.reduce((a, b) => a + b, 0) <= 1016 - 2 * 3 - 2 * 10, `colonnes : ${cols.join(' + ')}`);
  assert.ok(page.includes('.xr>span:last-of-type{box-shadow:none}'), 'pas de trait après la dernière colonne, même sur la ligne barrée');
  assert.ok(page.includes('.ml{left:64px;width:952px;height:184px;padding:0 30px;overflow:hidden}') && page.includes('.mh{height:178px;')
    && page.includes("function mailFold(n, t){ tl.to('#ml' + n, {height: 184,"), 'mail replié : l’en-tête seul, dans la carte, aux proportions d’une notification');
});

test('moment déjà réussi (vidéo revue, retour en arrière) : il s’ouvre résolu, avec la réponse, sans son ni nouvel essai', () => {
  const show = cut('function lvPkShow(i,p){', 'function lvPkKept(P,a){');
  for (const part of ['const kept=lvPkGet(LV.id,i);', 'if(kept)lvPkKept(P,kept);', "if(!kept){ LvSfx.play('pop',5,.55,0); if(navigator.vibrate)navigator.vibrate(8); }",
    "sr.textContent=`${kept?'Déjà fait':'À toi'} : ", "box.querySelector(kept?'.lv-pk-go':'.lv-pk-card').focus("])
    assert.ok(show.includes(part), `ouverture : ${part}`);
  const kept = cut('function lvPkKept(P,a){', 'function lvPkRestore(P,d){');
  for (const part of ['P.done=true;', "box.classList.add('is-ok','is-kept');", 'lvPkValid(P,a.first,false);', "if(dot)dot.className=a.first?'ok':'try';",
    'if(cnt)cnt.textContent=`${P.total} / ${P.total}`;', "b.classList.add(j===k?'is-ok':'is-gone')", "w.className='lv-pk-why ok'; w.hidden=false;", "else opts.classList.add('is-won');",
    "if(P.layer)P.layer.classList.add('is-done');", "go.hidden=false; go.classList.add('is-ready');", 'LV.video.currentTime=Math.min(P.p.t+.05,'])
    assert.ok(kept.includes(part), `résolu : ${part}`);
  assert.ok(!kept.includes('lvPkSet') && !kept.includes('LvSfx'), 'rien n’est noté de nouveau, aucun son');
  /* « Rejouer les moments ratés » et « Tout recommencer » effacent d’abord les réponses : ces moments-là repartent de zéro. */
  assert.ok(cut('function lvRedo(list){', 'function lvRedoGo(){').includes("list.forEach(i=>{ delete o['p'+i]; delete o['d'+i]; });") && html.includes('function lvPkReset(id){'), 'refaire : moments vierges');
});

test('barre de lecture : un point par moment « À toi », doré à faire, badge vert coché fait, sans chevauchement, vivant au doigt', () => {
  assert.ok(html.includes('<div class="lv-pkm" aria-hidden="true"></div>') && html.includes('.lv-pkm{position:absolute;left:0;right:0;top:50%;height:0;pointer-events:none}')
    && html.includes('.lv-pkm i{position:absolute;top:0;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:#F2B529;box-shadow:0 0 0 1.5px #fff,')
    && html.includes('.lv-pkm i.ok{width:15px;height:15px;margin:-7.5px 0 0 -7.5px;background:#169447}') && html.includes(`const LV_PKM_OK='<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M4 7.3l2 2 4.2-4.6"/></svg>';`),
    'points sur la barre, liserés de blanc ; badge vert avec une coche blanche');
  assert.ok(html.includes('.lv-pkm i.is-hot{transform:scale(1.3)}') && html.includes('@keyframes lvPkmNew{') && html.includes('@keyframes lvPkmTick{to{stroke-dashoffset:0}}'), 'le point sous le doigt grossit ; un badge neuf rebondit, sa coche se trace');
  const tip = cut('function lvTip(on){', 'function lvDtFx(side,total){');
  assert.ok(tip.includes("`À toi ${k+1}/${ps.length}${a?(a.first?' ✓':' ✕'):''}`") && tip.includes('hot(k);') && tip.includes('if(!on){ hot(-1);'), 'en glissant sur un point : le numéro de l’exercice, le point grossit');
  const marks = cut('function lvPkMarks(fresh){', '/* En glissant sur la barre');
  for (const part of ['const L=Math.max(0,LV.seek.clientWidth-18);', 'return {i,a,f,s:a?15:10,x:9+f*L};', 'if(q&&m.x-q.x<(m.s+q.s)/2+4)m.x=q.x+(m.s+q.s)/2+4;',
    "${m.i===fresh?' is-new':''}", "${m.a?(m.a.first?LV_PKM_OK:LV_PKM_KO):''}"])
    assert.ok(marks.includes(part), `points : ${part}`);
  /* Deux exercices à 9 px l’un de l’autre : le second est décalé, plus de chevauchement. */
  const ctxM = vm.createContext({lvPkGet: (id, i) => (i < 2 ? {first: 1} : i === 2 ? {first: 0} : null), LV_PKM_OK: '✓', LV_PKM_KO: '✕'});
  vm.runInContext('let LV;' + cut('function lvPkMarks(fresh){', '/* En glissant sur la barre') + ';this.run=(w,ts,d,fresh)=>{ const box={innerHTML:""}; LV={id:1,root:{querySelector:()=>box},seek:{clientWidth:w},video:{picks:ts.map(t=>({t})),duration:d}}; lvPkMarks(fresh); return box.innerHTML; };', ctxM);
  const out = ctxM.run(290, [100, 103.4, 150, 152.5], 200, 1);
  const xs = [...out.matchAll(/left:([\d.]+)px/g)].map(m => +m[1]);
  assert.ok(xs[1] - xs[0] >= 17 && xs[3] - xs[2] >= 12 && out.includes('class="ok is-new"'), `écarts : ${xs.join(', ')}`);
  assert.ok(out.includes('class="ko"') && out.includes('>✕</i>') && (out.match(/>✓</g) || []).length === 2, 'raté au premier essai : badge à croix, réussis du premier coup : coche');
  assert.ok(html.includes('.lv-pkm i.ko{width:15px;height:15px;margin:-7.5px 0 0 -7.5px;background:#DE3F46}')
    && html.includes(`const LV_PKM_KO='<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M4.7 4.7l4.6 4.6"/><path d="M9.3 4.7l-4.6 4.6"/></svg>';`)
    && html.includes('.lv-pkm i.is-new path+path{animation-delay:.55s}'), 'croix blanche sur badge rouge, tracée trait après trait');
  assert.ok(html.includes('lvPkMarks(); lvSyncSeek();') && html.includes('lvPkSet(LV.id,P.i,first,P.tries-1); lvPkMarks();') && html.includes('lvPkSet(LV.id,P.i,first,P.miss); lvPkMarks();')
    && html.includes('if(answered&&P.done&&!P.kept&&!prefersReduceMotion()){\n    lvPkMarks(P.i);\n    const a=lvPkGet(LV.id,P.i);\n    if(a&&a.first){ LV.root.classList.add(\'is-valid\');') && html.includes('.lv.is-valid .lv-seek::-webkit-slider-thumb{border-color:#169447;')
    && html.includes('lvPkPlace(); lvOpPlace(); lvPkMarks(); };'),
    'placés au chargement et au redimensionnement, mis à jour à chaque moment réussi, rebond au retour sur la vidéo');
});

test('micro-interactions du lecteur : curseur qui grossit, un rendu par image en glissant, ±5 s qui tourne, lecture/pause qui rebondit, réponses en cascade', () => {
  assert.ok(html.includes('<div class="lv-track"><div class="lv-rail" aria-hidden="true"><i class="lv-fill"></i></div><div class="lv-pkm" aria-hidden="true"></div><input class="lv-seek"')
    && html.includes('.lv-track .lv-seek{flex:1;min-width:0;position:relative;z-index:1}') && html.includes('.lv-seek::-webkit-slider-runnable-track{height:6px;border-radius:6px;background:transparent}'),
    'la barre est dessinée sous les points');
  assert.ok(html.includes('.lv-pkm i.ok,.lv-pkm i.ko{z-index:2}') && !/\.lv-pkm\{[^}]*z-index/.test(html), 'le curseur passe sur les exercices à faire, sous les exercices faits (vert ou rouge)');
  assert.ok(html.includes('.lv.is-seeking .lv-seek::-webkit-slider-thumb{transform:scale(1.25)}') && html.includes("LV.seeking=true; root.classList.add('is-seeking');")
    && html.includes("LV.seeking=false; root.classList.remove('is-seeking'); lvTip(false);"), 'le curseur grossit pendant qu’on glisse');
  assert.ok(html.includes('if(!LV.seekRaf)LV.seekRaf=requestAnimationFrame(') && html.includes('      seekTo(t);\n') && html.includes('    seekFlush();\n'), 'en glissant : un seul rendu par image, le dernier appliqué au lâcher');
  assert.ok(html.includes('lvSpin(e.currentTarget,-1); lvSkip(-LV_SKIP);') && html.includes('lvSpin(e.currentTarget,1); lvSkip(LV_SKIP);') && html.includes('function lvSpin(btn,dir){'), '±5 s : la flèche tourne');
  const pp = cut('function lvSyncPP(){', 'function lvSpin(btn,dir){');
  assert.ok(pp.includes('if(b.dataset.ico===now)return;') && pp.includes("svg.animate([{transform:'scale(.5) rotate(-12deg)',opacity:.3},{transform:'none',opacity:1}]"), 'lecture ↔ pause : l’icône rebondit, sans redessiner pour rien');
  assert.ok(cut('function lvPkShow(i,p){', 'function lvPkKept(P,a){').includes("    if(!prefersReduceMotion())box.querySelectorAll('.lv-pk-opt').forEach((o,k)=>{"), 'les réponses arrivent en cascade');
});

test('moment réussi puis vidéo reculée : la réponse ne réapparaît pas avant l’heure ; un glisser ne survit pas au plateau', () => {
  const core = fs.readFileSync(path.join(ROOT, 'assets/anim/core.js'), 'utf8');
  assert.ok(core.includes('if (cfg.beforeRender) cfg.beforeRender(t);\n    tl.seek(t, true);'), 'la page retire l’aperçu avant que la timeline ne dessine l’image');
  for (const f of ['projet-normaliser.html', 'quel-join-choisir.html']) {
    const page = fs.readFileSync(path.join(ROOT, 'assets/anim', f), 'utf8');
    assert.ok(page.includes('tick(t = tl.time()){') && page.includes('beforeRender: t => IX.tick(t)});') && !page.includes('onRender: () => IX.tick()'), `${f} : aperçu retiré avant le rendu`);
  }
  assert.ok(cut('function lvPkClose(answered){', '/* ---------- Mail reçu').includes("LV.root.querySelectorAll('.lv-pk-fly.is-drag,.lv-pk-target').forEach(e=>e.remove());"), 'plateau fermé : plus de copie en plein glisser');
  assert.ok(html.includes("lvGlisse(btn,()=>!!LV&&LV.pk===P&&") && html.includes("lvGlisse(a,()=>!!LV&&LV.pk===P&&") && html.includes('if(!can()){ g=null; return; }'), 'pas de glisser sur un plateau fermé');
});

test('moment réussi : la validation bien en avant, coche verte animée et « Bien vu ! » ; trouvé après une erreur, « Bien rattrapé ! » en orange, mais le point reste rouge', () => {
  const valid = cut('function lvPkValid(P,first,anim){', '/* La réponse gardée s’affiche telle quelle');
  for (const part of ["el.className='lv-pk-ok'+(first?'':' is-late')+(anim&&!prefersReduceMotion()?' is-anim':'');", "tick='<path class=\"k\" d=\"M12.5 21.5l6 6L30 15.5\"/>'",
    '<g class="was"><path class="k x" d="M15 15l12 12"/><path class="k x" d="M27 15L15 27"/></g>${tick}',
    "${first?'Bien vu&nbsp;!':'<span class=\"was\" aria-hidden=\"true\">Raté</span><span class=\"now\">Bien rattrapé&nbsp;!</span>'}",
    "top.querySelectorAll('.lv-pk-kick,.lv-pk-cnt').forEach(e=>{ e.hidden=true; });"])
    assert.ok(valid.includes(part), `badge : ${part}`);
  assert.ok(cut('function lvPkVerdict(', 'function lvPkFrom(i){').includes("P.box.classList.add('is-ok');\n    lvPkValid(P,first,true);") && cut('function lvPkWin(', 'function lvEndHide(){').includes('lvPkValid(P,first,true);')
    && cut('function lvPkKept(P,a){', 'function lvPkRestore(P,d){').includes('lvPkValid(P,a.first,false);') && !html.includes('✓ Trouvé !'),
    'au choix, aux gestes, et pour un moment déjà fait : là, le badge final sans animation (« Bien rattrapé ! » sans repasser par « Raté ») ; plus de « Trouvé ! »');
  /* Trouvé après une erreur : la croix rouge du premier essai se trace puis s’efface, le rond passe à l’orange, la coche se trace,
     « Raté » laisse la place à « Bien rattrapé ! » ; sans animation, directement l’état orange. Le point du moment reste rouge. */
  for (const part of ['.lv-pk-ok.is-late{color:#B45309}', '.lv-pk-ok.is-late .c{fill:#EE8A1A}', '.lv-pk-ok .was{display:none}', '.lv-pk-ok.is-late.is-anim .was{display:inline}',
    '.lv-pk-ok.is-late.is-anim .c{animation:lvLateFill .95s ease both}', '@keyframes lvLateFill{0%,72%{fill:#DE3F46}100%{fill:#EE8A1A}}',
    '.lv-pk-ok.is-late.is-anim g.was{transform-box:fill-box;transform-origin:center;animation:lvLateOut .22s ease-in .78s forwards}',
    '.lv-pk-ok.is-late.is-anim .k:not(.x){animation-delay:.95s}', '.lv-pk-ok.is-late.is-anim span.now{animation:lvOkTxt .35s cubic-bezier(.2,.9,.3,1.3) .92s both}',
    '.lv-pk-ok.is-anim .x{stroke-dashoffset:18}', '.lv-pk-ok.is-anim .x+.x{animation-delay:.44s}', '.lv-pk-dots i.try{background:#DE3F46}', '.lv-pkm i.ko{'])
    assert.ok(html.includes(part), `rattrapé : ${part}`);
  assert.ok(!html.includes('.lv-pk-ok.is-ko'), 'plus de badge rouge « Raté » une fois la bonne réponse trouvée');
  for (const f of ['function lvPkVerdict(', 'function lvPkWin(']) assert.ok(cut(f, f === 'function lvPkWin(' ? 'function lvEndHide(){' : 'function lvPkFrom(i){').includes("'Bien rattrapé, mais seul le premier essai compte : moment raté. '"), `${f} VoiceOver : rattrapé, mais raté`);
  assert.ok(cut('function lvPkWin(', 'function lvEndHide(){').includes("dot.className=first?'ok':'try';") && cut('function lvPkVerdict(', 'function lvPkFrom(i){').includes("dot.className=first?'ok':'try';"), 'le point du moment : vert du premier coup, rouge sinon');
  for (const part of ['.lv-pk-kick[hidden],.lv-pk-cnt[hidden]{display:none}', '@keyframes lvOkPop{', '@keyframes lvOkTick{to{stroke-dashoffset:0}}', '@keyframes lvOkRing{', '.lv-pk-ok.is-anim .k{stroke-dashoffset:26;'])
    assert.ok(html.includes(part), `animation : ${part}`);
});

test('« ↺ Revoir » (ou tout retour en arrière) : le moment reprend là où on l’a laissé, les erreurs restent comptées', () => {
  /* Brouillon du moment : gardé à chaque geste, effacé quand le moment est fini, par « Rejouer » et par « Tout recommencer ». */
  const ctx = vm.createContext({LV: {id: 56}, LV_ANS: {}, lvAnsSave() {}, Math, Object, Array});
  vm.runInContext(cut('function lvPkGet(id,i){', 'function lvPkScore(id,n){') + cut('function lvPkReset(id){', '/* Validation d’une leçon seule')
    + ';this.api={lvPkGet,lvPkSet,lvPkDraft,lvPkKeep,lvPkReset,lvPkSig};', ctx);
  const {api} = ctx;
  const p0 = {kind: 'tap', prompt: 'Touche chaque case', need: 3};
  api.lvPkKeep({i: 0, p: p0, done: false, acts: [['0_4']], outs: [], wrong: ['2_4'], miss: 1, tries: 0});
  const d0 = JSON.parse(JSON.stringify(api.lvPkDraft(56, 0)));
  assert.deepEqual({...d0, f: 0}, {a: [['0_4']], o: [], w: ['2_4'], m: 1, t: 0, f: 0}, 'bons gestes et erreurs gardés tout de suite');
  assert.ok(d0.f === api.lvPkSig(p0) && api.lvPkSig({...p0, need: 2}) !== d0.f, 'avec l’empreinte du moment');
  assert.equal(api.lvPkGet(56, 0), null, 'un moment en cours n’est pas un moment fait');
  api.lvPkSet(56, 0, false, 1);
  assert.ok(api.lvPkDraft(56, 0) === null && !('d0' in ctx.LV_ANS[56]) && api.lvPkGet(56, 0).first === 0, 'moment fini : le brouillon s’efface, le premier essai raté reste');
  api.lvPkKeep({i: 1, p: {kind: 'pick', prompt: 'Q', options: [{label: 'a'}, {label: 'b', ok: true}]}, done: false, acts: [], outs: [0], wrong: [], miss: 0, tries: 1});
  api.lvPkReset(56);
  assert.deepEqual(Object.keys(ctx.LV_ANS[56]), [], '« Tout recommencer » : brouillons effacés aussi');
  /* Reprise : la page rejoue les bons gestes sans son, la carte les montre ; erreurs, réponses écartées et indice reviennent. */
  const mk = k => ({dataset: {k: String(k)}, disabled: false, attrs: {}, cls: new Set(), setAttribute(n, v) { this.attrs[n] = v; },
    get classList() { const c = this.cls; return {add: x => c.add(x), contains: x => c.has(x)}; }});
  const played = [], heard = [], sfx = (...a) => heard.push(a), win = {__sfx: sfx};
  const IX = {act(i, a, b) { win.__sfx('pop'); played.push([i, a, b]); return {ok: true, done: false}; }};
  const dropped = [];
  const ctxR = vm.createContext({LV: {id: 56, video: {win}}, lvPkIX: () => IX, lvPkHint(P) { P.hinted = true; }, lvPkDrop: (id, i) => dropped.push(i), Array, Math, String});
  vm.runInContext(cut('function lvPkRestore(P,d){', 'function lvPkTry(k){') + ';this.lvPkRestore=lvPkRestore;', ctxR);
  const chips = [0, 1, 2, 3, 4].map(mk), cnt = {textContent: '0 / 5'};
  const box = {querySelector: sel => { const m = sel.match(/data-k="(\d+)"/); return m ? chips[+m[1]] || null : sel === '.lv-pk-cnt' ? cnt : null; }};
  const S = {i: 3, kind: 'sort', box, spots: [], acts: [], outs: [], count: 0, total: 5, miss: 0, tries: 0};
  ctxR.lvPkRestore(S, {a: [[0, 'ateliers'], [2, 'coachs']], o: [], m: 2, t: 0});
  assert.deepEqual(JSON.parse(JSON.stringify(played)), [[3, 0, 'ateliers'], [3, 2, 'coachs']], 'la page rejoue les bons gestes');
  assert.ok(!heard.length && win.__sfx === sfx, 'sans son, puis les sons de la page reviennent');
  assert.ok(chips[0].cls.has('is-placed') && chips[0].disabled && chips[2].cls.has('is-placed') && !chips[1].disabled, 'étiquettes déjà rangées');
  assert.ok(S.count === 2 && cnt.textContent === '2 / 5' && S.miss === 2 && S.hinted && S.acts.length === 2, 'compteur, erreurs et indice repris');
  const spots = ['0_4', '1_4', '4_4'].map(mk);
  const T = {i: 0, kind: 'tap', box: {querySelector: () => null}, spots, acts: [], outs: [], count: 0, total: 3, miss: 0, tries: 0};
  ctxR.lvPkRestore(T, {a: [['1_4']], o: [], m: 1, t: 0});
  assert.ok(spots[1].cls.has('is-ok') && spots[1].disabled && !spots[0].disabled && T.miss === 1 && !T.hinted, 'case déjà trouvée ; une erreur gardée, pas encore d’indice');
  const opts = [0, 1, 2].map(mk);
  const Q = {i: 2, kind: 'pick', p: {options: [{label: 'a'}, {label: 'b', ok: true}, {label: 'c'}]}, box: {querySelector: sel => { const m = sel.match(/data-k="(\d+)"/); return m ? opts[+m[1]] : null; }}, spots: [], acts: [], outs: [], count: 0, total: 0, miss: 0, tries: 0};
  ctxR.lvPkRestore(Q, {a: [], o: [0, 1], m: 0, t: 1});
  assert.ok(opts[0].cls.has('is-out') && opts[0].attrs['aria-disabled'] === 'true' && Q.tries === 1 && !Q.hinted, 'réponse déjà écartée : barrée, et l’essai raté compte toujours');
  assert.ok(!opts[1].cls.has('is-out') && Q.outs.join() === '0', 'la bonne réponse n’est jamais barrée');
  /* Brouillon qui ne colle plus (un geste finirait le moment, ou ne passe plus) : la page repart de zéro, le brouillon est oublié. */
  let entered = 0; IX.enter = () => { entered++; }; IX.act = (i, a) => ({ok: true, done: a === 'fin'});
  const spots2 = ['a', 'fin'].map(mk);
  const U = {i: 0, kind: 'tap', box: {querySelector: () => null}, spots: spots2, acts: [], outs: [], count: 0, total: 2, miss: 0, tries: 0};
  ctxR.lvPkRestore(U, {a: [['a'], ['fin']], o: [], m: 1, t: 0});
  assert.ok(entered === 1 && dropped.join() === '0' && U.count === 0 && U.miss === 0 && !spots2[0].cls.has('is-ok'), 'rien n’est repris d’un brouillon qui ne colle plus');
  /* Branché : chaque bon geste, chaque erreur et chaque réponse écartée est gardé ; la carte reprend le brouillon. */
  const show = cut('function lvPkShow(i,p){', 'function lvPkValid(P,first,anim){');
  assert.ok(show.includes('let draft=lvPkDraft(LV.id,i);') && show.includes('acts:[],outs:[],wrong:[],touched:!!draft};') && show.includes('if(draft)lvPkRestore(P,draft);'), 'carte : reprise du brouillon, sans démonstration');
  const acted = cut('function lvPkActed(', 'function lvPkWin(');
  assert.ok(acted.includes('if(args){ P.acts.push(args); lvPkKeep(P); }') && acted.includes('P.miss++; lvPkKeep(P);'), 'gestes : bons gestes et erreurs gardés');
  const tr = cut('function lvPkTry(k){', 'function lvPkVerdict(');
  assert.ok(tr.includes('if(!ok){ P.outs.push(k); lvPkKeep(P); }') && tr.includes("if(!btn||btn.classList.contains('is-out')||P.outs.includes(k)){ P.dropped=false; return; }")
    && !cut('function lvPkVerdict(', 'function lvPkFrom(i){').includes('P.outs.push(k)'), 'choix : mauvaise réponse gardée dès l’essai (fermer pendant l’envol ne l’efface pas), et pas retentée');
  assert.ok(acted.includes("const key=(args||[]).join('|');") && acted.includes('if(!P.wrong.includes(key)){ P.wrong.push(key); P.miss++; lvPkKeep(P); }'), 'la même erreur refaite ne compte qu’une fois');
  assert.ok(show.includes('if(draft&&draft.f!==lvPkSig(p)){ lvPkDrop(LV.id,i); draft=null; }'), 'brouillon d’une autre version du moment : ignoré');
  assert.ok(html.includes('function lvPkBack(i){\n  if(!LV||!LV.pk||LV.pk.busy)return;'), '« ↺ Revoir » attend la fin d’un essai en cours');
});

test('barre de lecture : relâcher le curseur la remet toujours en marche, même sans « change » (Safari)', () => {
  const seg = cut('  /* En glissant, la vidéo n’est redessinée', '  /* Un appui met en pause ou relance');
  const on = {}, seek = {value: '100', addEventListener(t, f) { (on[t] ||= []).push(f); }};
  const cls = new Set(), root = {classList: {add: c => cls.add(c), remove: c => cls.delete(c)}, querySelector: () => ({textContent: ''})};
  const video = {duration: 200, currentTime: 20, paused: false, picks: [{t: 44.6}], pause() { this.paused = true; }};
  const stops = [], later = [];
  const LV = {root, video, seek, seeking: false, gate: -1, gateResume: false, q: null, pk: null, op: null};
  const ctx = vm.createContext({LV, seek, video, root, Math, String,
    requestAnimationFrame: f => { later.push(f); return 1; }, cancelAnimationFrame() {}, setTimeout: f => { later.push(f); return 1; },
    lvPkGate: t => (t >= 44.6 ? 0 : -1), lvPkStop: g => stops.push(g), lvPlay() {}, lvPosKeep() {}, lvTip() {}, lvFill() {}, lvFmt: String,
    lvNoteSync() {}, lvQClose() {}, lvPkClose() {}, lvOpClose() {}});
  vm.runInContext(seg, ctx);
  const fire = t => (on[t] || []).forEach(f => f());
  seek.value = '600'; fire('input');
  assert.ok(LV.seeking && LV.gate === 0 && +seek.value < 224 && video.paused, 'curseur retenu juste avant le moment pas encore fait');
  fire('touchend'); later.splice(0).forEach(f => f());
  assert.ok(!LV.seeking && !cls.has('is-seeking') && stops.join() === '0', 'doigt levé sans « change » : le glisser se termine, le moment s’ouvre');
  fire('change'); later.splice(0).forEach(f => f());
  assert.equal(stops.length, 1, '« change » arrivé ensuite : rien n’est refait');
  assert.ok(['pointerup', 'pointercancel', 'touchend', 'touchcancel', 'mouseup', 'blur'].every(t => on[t] && on[t].length === 1), 'toutes les façons de lâcher');
  assert.ok(html.includes('function lvFill(p){ if(LV&&LV.fill)LV.fill.style.width=') && html.includes('  lvFill(p);\n') && !html.includes("setProperty('--pf'")
    && html.includes('.lv-fill{position:absolute;left:0;top:0;bottom:0;width:9px;background:var(--accent,#6A4DF4)}'), 'partie lue posée sur son propre élément');
});

test('leçon terminée avec le score requis : confettis, son de réussite, le chat saute et dit « Bravo ! »', () => {
  const end = cut('function lvEnded(){', 'function lvWin(root){');
  assert.ok(end.includes('const win=!!(current&&current.id===id&&current.leconSeule&&!LV.retry);') && end.includes("root.classList.toggle('is-win',win);")
    && end.includes('if(vid)vid.loop=win;') && end.includes('if(win)lvWin(root);'), 'seulement quand la leçon seule est validée ; le chat fait coucou en boucle');
  const win = cut('function lvWin(root){', '/* ---------- « Ajouter à mes notes »');
  assert.ok(win.includes("LvSfx.play('success',0,.6,0)") && win.includes('lqConfetti({n:56})') && win.includes('lqConfetti({n:36})') && win.includes('if(prefersReduceMotion())return;')
    && win.includes("const still=()=>!!(LV&&LV.root===root&&root.classList.contains('is-win'));"), 'deux salves de confettis, arpège de réussite ; rien en mouvement réduit ni après avoir quitté l’écran');
  assert.ok(html.includes(`<span class="lv-end-cat">\${mascotMedalHtml()}\${l.leconSeule?'<span class="lv-end-bravo" aria-hidden="true">Bravo&nbsp;!</span>':''}</span>`), 'bulle « Bravo ! » du chat');
  for (const part of ['.lv.is-win.end-in .lv-end-bravo{display:block;animation:lvBravoIn', '.lv.is-win.end-in .lv-end-cat{animation:lvCatJoy', '@keyframes lvCatBob{',
    'html[data-motion="reduce"] .lv-end-cat,html[data-motion="reduce"] .lv-end-bravo{animation:none!important}'])
    assert.ok(html.includes(part), `chat : ${part}`);
  assert.ok(cut('function lvEndHide(){', '/* « Revoir la vidéo »').includes("LV.root.classList.remove('is-end','end-in','is-retry','is-win');"), 'écran quitté : fin de la fête');
});

test('lien ?reset=56 : la leçon repart de zéro sur l’appareil, le reste de la progression intact', () => {
  const fn = cut('function resetLeconFromUrl(){', 'function recommencerLecon(){');
  for (const part of ["id=+new URLSearchParams(location.search).get('reset')||0;", 'if(!id||!allLessons.some(l=>l.id===id))return;', 's.etapes={}; s.done=false; s.level=0;', 'save();', 'lvForget(id);',
    "history.replaceState(null,'',location.pathname+location.hash);", 'if(state.onboarded)openLesson(id);'])
    assert.ok(fn.includes(part), `remise à zéro : ${part}`);
  assert.ok(html.includes('    jeuFromUrl();\n    resetLeconFromUrl();'), 'appliquée au démarrage');
});

test('mail reçu : l’image s’arrête sur la notification, le toucher l’ouvre et la lecture reprend, sans note', () => {
  const anim = cut('class LvAnim{', 'function lessonVideoOn(l){');
  assert.ok(anim.includes('this.opens=info.opens||[];') && anim.includes("this._emit('open',{i:op,o:this.opens[op]});"), 'le lecteur s’arrête sur chaque mail');
  const show = cut('function lvOpShow(i,o){', 'function lvOpPlace(){');
  for (const part of ["layer.className='lv-op';", "LV.root.classList.add('is-q','is-op');", 'lvOpClose(); lvPlay();', 'r=w.rel(el);', "b.addEventListener('pointerdown',e=>lvPkRipple(e.clientX,e.clientY));"])
    assert.ok(show.includes(part), `mail : ${part}`);
  assert.ok(!show.includes('lvPkSet'), 'rien n’est noté');
  assert.ok(html.includes("video.addEventListener('open',e=>{ if(LV&&LV.video===video&&e.detail)lvOpShow(e.detail.i,e.detail.o); });") && html.includes('if(LV&&LV.op)lvOpClose();'),
    'ouvert par l’animation, fermé dès que la lecture reprend');
  assert.ok(html.includes('.lv-op-spot{position:absolute;') && html.includes('@keyframes lvOpRing{') && html.includes('.lv-op-tip{position:absolute;'), 'zone qui s’entoure d’une onde, bulle « Touche le mail »');
  assert.ok(html.includes("case 'mail':{"), 'son du mail reçu');
  /* Moment réussi sans correction écrite : seule la bonne étiquette reste, séparée de « Continuer ». */
  assert.ok(html.includes("if(why)opts.hidden=true; else opts.classList.add('is-won');") && html.includes('.lv-pk-opts.is-won .lv-pk-opt.is-gone{display:none}')
    && html.includes('.lv-pk-opts:not([hidden])~.lv-pk-go{margin-top:14px}'), 'plateau réussi : la bonne étiquette, puis « Continuer », bien séparés');
  assert.ok(html.includes('.lv-pk.is-sort .lv-pk-opts:not([hidden]){display:flex;flex-wrap:wrap;justify-content:center;gap:7px}')
    && html.includes('.lv-pk.is-sort .lv-pk-opt{min-height:44px;flex:0 0 calc(50% - 3.5px);min-width:0}'), 'étiquettes à glisser deux par ligne, une étiquette seule centrée');
  assert.ok(html.includes("(kind==='pick'&&opts.some(o=>String(o.label).length>30)?' is-long':'')") && html.includes('.lv-pk.is-long .lv-pk-opts:not([hidden]){flex-direction:column;align-items:stretch;gap:8px}'),
    'réponses longues (une phrase) : l’une sous l’autre, sur deux lignes au besoin');
});

test('mail à toucher : le bouton lecture ne l’ouvre pas, et l’image s’arrête dessus à chaque visionnage', () => {
  /* Bouton lecture (ou barre d’espace) pressé pendant que la notification attend : rien ne repart, la notification remue. */
  const plays = [], nudges = [];
  const LV = {video: {play() { plays.push(1); return Promise.resolve(); }}, pk: null, op: {i: 0}};
  const ctx = vm.createContext({LV, Promise, lvOpNudge: () => nudges.push(1)});
  vm.runInContext(cut('function lvPlay(){', 'function lvToggle(){') + ';this.play=lvPlay;', ctx);
  ctx.play();
  assert.ok(plays.length === 0 && nudges.length === 1, 'notification en attente : lecture sans effet, la zone remue');
  LV.op = null; ctx.play();
  assert.ok(plays.length === 1 && nudges.length === 1, 'notification touchée (fermée) : la lecture repart');
  /* Même quand le mail a déjà été ouvert : aucun arrêt n’est sauté, plus de mémoire « déjà ouvert ». */
  const anim = cut('class LvAnim{', 'function lessonVideoOn(l){');
  assert.ok(anim.includes('if(ot>this.t&&ot<=t){ if((q<0&&pk<0)||ot<t){ t=ot; op=i; q=-1; pk=-1; } break; }') && !anim.includes('skipOpen'), 'la lecture s’arrête sur chaque mail, à chaque fois');
  assert.ok(!html.includes('skipOpen') && !html.includes('lvOpDone') && !html.includes('lvOpSet'), 'plus de « mail déjà ouvert » qui s’ouvre tout seul');
  const close = cut('function lvOpClose(){', '/* ---------- Moments « À toi » joués sur l’image');
  assert.ok(close.includes('LV.op=null;') && !close.includes('opened'), 'fermer la notification n’ouvre rien : seule la lecture qui reprend déplie le mail');
  const nudge = cut('function lvOpNudge(){', 'function lvOpClose(){');
  for (const part of ['if(navigator.vibrate)navigator.vibrate([10,50,10]);', "e.classList.add('is-nudge')", "classList.remove('is-nudge')"])
    assert.ok(nudge.includes(part), `notification qui remue : ${part}`);
  for (const part of ['.lv-op-spot.is-nudge{animation:lvOpPulse', '.lv-op-tip.is-nudge{animation:lvOpWiggle', '@keyframes lvOpWiggle{', 'html[data-motion="reduce"] .lv-op-spot.is-nudge'])
    assert.ok(html.includes(part), `style : ${part}`);
  assert.ok(cut('/* Saut de ±5 s', 'function lvSpeedMenu(open){').includes('if(LV.op)lvOpClose();'), 'sauter par-dessus (barre, ±5 s) ne l’ouvre pas non plus');
});

test('moments « À toi » : la légende annonce le moment sans répéter la consigne de la carte, l’attente est coupée', () => {
  /* Moteur : une coupe (durée négative) saute un passage de la timeline ; pauses et coupes se combinent. */
  const core = fs.readFileSync(path.join(ROOT, 'assets/anim/core.js'), 'utf8');
  const ctx = vm.createContext({location: {search: ''}, URLSearchParams, gsap: {config() {}, timeline: () => ({})}, document: {}});
  vm.runInContext(core, ctx);
  const got = vm.runInContext('HOLDS = [[10, 2], [20, -3], [30, 1]]; CUTS.push([20, -3]);'
    + 'JSON.stringify([warp(5), warp(11), warp(13), warp(22), warp(22.5), warp(29.5), warp(31), unwarp(5), unwarp(21), unwarp(25), unwarp(31), cutIn(19, 24), inCut(21), inCut(23.5)])', ctx);
  assert.equal(got, JSON.stringify([5, 10, 11, 20, 23.5, 30, 31, 5, 22, 24, 31, 3, true, false]), 'temps de la vidéo ↔ temps de la timeline, pauses et coupes comprises');
  assert.ok(core.includes('cues: CUES.filter(c => !inCut(c.t))') && core.includes('readTime(text) - ((b - 0.2) - (a + 0.3) - cutIn(a + 0.3, b - 0.2))')
    && core.includes('.concat(CUTS).sort((x, y) => x[0] - y[0]);'), 'sons du passage coupé retirés ; temps de lecture des légendes sans le passage coupé');
  assert.ok(core.includes('out.push({cut: h, at: +a.toFixed(2), to: +b.toFixed(2), el: name(c)})'), 'aucune animation dans un passage coupé (?check)');
  /* Pages : une légende « À toi ! » par moment, juste avant l’arrêt ; la consigne n’est que sur la carte du lecteur. */
  for (const f of ['quel-join-choisir.html', 'projet-normaliser.html']) {
    const page = fs.readFileSync(path.join(ROOT, 'assets/anim', f), 'utf8');
    const a = page.indexOf('const DURATION = '), b = page.indexOf('/* ---------- Gabarits');
    const c = vm.createContext({APP: true, $: () => null, $$: () => []});
    vm.runInContext(page.slice(a, b) + ';this.D = {CAPTIONS, PICKS};', c);
    const {CAPTIONS, PICKS} = c.D;
    const atoi = CAPTIONS.filter(x => /^À toi/.test(x[2]));
    assert.ok(atoi.every(x => x[2] === 'À toi !'), `${f} : « À toi ! », sans la consigne`);
    assert.equal(atoi.length, PICKS.length, `${f} : une légende « À toi ! » par moment`);
    PICKS.forEach((P, i) => assert.ok(atoi[i][0] < P.at && P.at < atoi[i][1], `${f}, moment ${i + 1} : arrêt pendant « À toi ! »`));
    assert.ok(page.includes('.forEach(([t0, i]) => cut(t0, +(PICKS[i].at - 0.1 - t0).toFixed(2)));'), `${f} : l’attente avant chaque arrêt est coupée`);
    /* Geste envoyé au lecteur : les « kind » propres à Quel JOIN (on, join, tbl) restent des étiquettes à placer dans la requête. */
    const G = vm.runInContext('GESTURES', ctx), sent = [...PICKS].map(P => G.includes(P.kind) ? P.kind : 'pick');
    assert.deepEqual(sent, f === 'quel-join-choisir.html' ? Array(9).fill('pick') : ['tap', 'tap', 'pick', 'sort', 'tap', 'pick'], `${f} : gestes envoyés au lecteur`);
  }
  assert.ok(cut('function lvPkShow(i,p){', 'function lvPkTry(k){').includes("kind=LV_PK_ICO[p.kind]?p.kind:'pick'"), 'lecteur : un geste inconnu reste un choix d’étiquette');
});

test('leçon seule (Quel JOIN choisir ?) : la vidéo interactive valide la leçon, sans exercice, quiz ni révision', () => {
  const l44 = cut('guide({ id:44, titre:"Quel JOIN choisir ?"', 'guide({ id:45,');
  assert.ok(l44.includes('leconSeule:true,') && l44.includes(",duree:'3 min 46',moments:9,"), 'leçon 44 : leçon seule, 9 moments');
  assert.ok(html.includes("'joinRecap','leconSeule','exoNeeds','video']"), 'drapeau copié par guide()');
  assert.ok(html.includes('function dueList(){ return allLessons.filter(l=>isDue(l.id)&&!l.leconSeule); }'), 'pas de révision « De mémoire » sans exercice');
  assert.ok(html.includes("if(current.leconSeule)return [{i:0,l:'Leçon'") && html.includes("if(leconSeule(id))return !!(state.lessons[id]&&state.lessons[id].done);"), 'une seule étape : la leçon');
  const end = cut('function lvEnded(){', 'function lvReplay(){');
  assert.ok(end.includes('markDone(id,false)') && end.includes('🎯 Tu as réussi <b>${ok}&nbsp;exercice${ok>1?\'s\':\'\'} sur&nbsp;${n}</b>&nbsp;!'), 'fin de la vidéo : leçon validée, exercices réussis');
  assert.ok(cut('function lvGoExercise(){', 'function lvFail(){').includes('leconSeuleBilan(first)'), '« Terminer la leçon » ouvre le bilan');
  assert.ok(html.includes("${l.leconSeule?'Leçon terminée&nbsp;!':'À toi de jouer&nbsp;!'}") && html.includes("${l.leconSeule?'Terminer la leçon':'Passer à l’exercice'}"), 'écran de fin propre à la leçon seule');
  assert.ok(html.includes("const score=lvErreursMax(l)!=null?(e?`${e} erreur${e>1?'s':''}`:'Aucune erreur'):`${ok} exercice${ok>1?'s':''} réussi${ok>1?'s':''} sur ${n}`;"),
    'bilan : les erreurs (règle des erreurs) ou les moments trouvés du premier coup');
});

test('leçon seule : on n’avance pas au-delà d’un moment « À toi » pas réussi ; la leçon se valide selon sa règle (erreurs au plus, ou seuil)', () => {
  const video = {picks: [{t: 10}, {t: 20}, {t: 30}], duration: 40, currentTime: 0, paused: false, plays: 0,
    pause() { this.paused = true; }, play() { this.plays++; this.paused = false; return Promise.resolve(); }};
  const LV = {id: 44, video, pk: null, q: null, root: {classList: {contains: () => false}, querySelector: () => null}}, shown = [];
  const ctx = vm.createContext({LV, LV_ANS: {}, lvAnsSave() {}, lvSyncSeek() {}, lvNoteSync() {}, lvQClose() {}, prefersReduceMotion: () => true, navigator: {},
    lvPkShow(i, p) { shown.push(i); LV.pk = {i, p, done: false}; }, lvPkClose() { LV.pk = null; }, Math, Object, Promise});
  vm.runInContext(cut('function lvPkGet(id,i){', 'function lvPkIX(){') + cut('/* Saut de ±5 s', 'function lvSpeedMenu(open){') + cut('function lvPlay(){', 'function lvToggle(){')
    + ';this.api={lvPkSet,lvPkScore,lvPkErrs,lvPkRates,lvPkReset,lvReussi,lvPkGate,lvSkip,lvPlay};', ctx);
  const {api} = ctx;
  assert.equal(api.lvPkGate(9.9), -1, 'avant le premier moment : rien ne bloque');
  assert.equal(api.lvPkGate(25), 0, 'au-delà : le premier moment pas encore réussi');
  video.currentTime = 7;
  assert.equal(api.lvSkip(5), false, '+5 s : le saut s’arrête sur le moment');
  assert.ok(video.currentTime === 10 && video.paused && shown.join() === '0', 'arrêt pile sur le moment, plateau ouvert');
  assert.ok(api.lvSkip(5) === false && video.currentTime === 10, 'plateau ouvert : pas de saut en avant');
  api.lvPlay();
  assert.equal(video.plays, 0, 'ni lecture (espace, gros bouton) tant que la bonne étiquette n’est pas posée');
  assert.ok(api.lvSkip(-5) === true && video.currentTime === 5 && !LV.pk, 'reculer reste possible');
  api.lvPkSet(44, 0, false);
  video.currentTime = 7;
  assert.ok(api.lvSkip(5) === true && video.currentTime === 12, 'moment réussi (au deuxième essai) : on peut le dépasser');
  assert.equal(api.lvPkGate(39), 1, 'le moment suivant bloque à son tour');
  api.lvPkSet(44, 1, true); api.lvPkSet(44, 2, true);
  assert.equal(api.lvPkGate(39), -1, 'tous réussis : la barre est libre');
  const l = {id: 44, video: {moments: 3, seuil: 2}};
  assert.ok(api.lvPkScore(44, 3) === 2 && api.lvReussi(l), '2 sur 3 du premier coup, seuil 2 : validée');
  ctx.LV_ANS[44][0] = {k: 1, q: 'Une question'};
  api.lvPkReset(44);
  assert.equal(Object.keys(ctx.LV_ANS[44]).join(), '0', 'nouvelle tentative : seuls les moments sont remis à zéro');
  assert.ok(!api.lvReussi(l) && api.lvReussi({id: 44, video: {moments: 3}}), 'sous le seuil : pas validée ; sans seuil, la fin suffit');
  /* Règle des erreurs (leçon 56 : 2 au plus, tous moments confondus) ; les moments ratés sont ceux à rejouer. */
  api.lvPkSet(56, 0, false, 2); api.lvPkSet(56, 1, true, 0); api.lvPkSet(56, 2, false, 1);
  const l56r = {id: 56, video: {moments: 3, erreurs: 2}};
  assert.ok(api.lvPkErrs(56, 3) === 3 && !api.lvReussi(l56r), '3 erreurs, 2 au plus : pas validée');
  assert.equal(api.lvPkRates(56, 3).join(), '0,2', 'à rejouer : les moments avec au moins une erreur');
  delete ctx.LV_ANS[56].p2; api.lvPkSet(56, 2, true, 0);
  assert.ok(api.lvPkErrs(56, 3) === 2 && api.lvReussi(l56r), 'moment rejoué sans erreur : 2 erreurs, validée');
  ctx.LV_ANS[57] = {p0: {first: 0}};
  assert.equal(api.lvPkErrs(57, 1), 1, 'réponse gardée sans le détail : 1 erreur par moment raté');
  const player = cut('function openLessonVideo(){', 'function lvPlay(){');
  assert.ok(player.includes('LV.gate=lvPkGate(t);') && player.includes('if(g>=0)lvPkStop(g); else if(again)lvPlay();'), 'barre : le curseur s’arrête avant le moment, son plateau s’ouvre au relâchement');
  assert.ok(player.includes('const g=lvPkGate(r); if(g>=0)r=Math.max(0,video.picks[g].t-.08);'), 'reprise : jamais au-delà d’un moment pas réussi');
  const end = cut('function lvEnded(){', '/* ---------- « Ajouter à mes notes »');
  for (const part of ['LV.retry=!was&&(max!=null?errs>max:ok<need);', 'if(LV.firstDone){ markDone(id,false);', 'Encore ${need-ok}&nbsp;exercice${need-ok>1?\'s\':\'\'} à réussir pour valider la leçon.',
    'Il en faut ${max} au plus pour valider la leçon.', 'if(LV.retry)LV.rates=lvPkRates(id,n);', "`Rejouer les ${nr} moments ratés`", "LV.retry?'Tout recommencer':'Revoir la vidéo'",
    "root.classList.toggle('is-retry',LV.retry);"])
    assert.ok(end.includes(part), `fin de la vidéo : ${part}`);
  assert.ok(cut('function lvGoExercise(){', 'function lvFail(){').includes('if(LV&&LV.retry){ if(LV.rates&&LV.rates.length)lvRedo(LV.rates); else lvReplay(); return; }'), 'pas assez : rejouer les moments ratés');
  assert.ok(cut('function lvReplay(){', 'function lvGoExercise(){').includes('if(LV.retry){ lvPkReset(LV.id); lvPkMarks(); }'), '« Tout recommencer » : tous les moments sont à refaire');
  assert.ok(cut('function leconSeuleBilan(first){', 'function lvFail(){').includes('if(!lvReussi(current))return;'), 'ni bilan ni validation sous le seuil');
  assert.ok(cut('guide({ id:44,', 'guide({ id:45,').includes(',moments:9,seuil:7,'), 'leçon 44 : 7 exercices réussis sur 9 (deux ratés au plus), comme le chapitre 1 du projet');
  assert.ok(html.includes('Réussis ${lvSeuil(l)} exercices sur ${v.moments} pour valider la leçon') && html.includes('Termine la vidéo avec ${lvErreursMax(l)} erreur'), 'le bouton du cours annonce la règle');
  assert.ok(cut('guide({ id:56,', 'guide({ id:72,').includes(",moments:6,seuil:4,"), 'leçon 56 : 4 exercices réussis sur 6 (deux ratés au plus)');
});

test('rejouer les moments ratés, revoir le passage : la vidéo saute d’un moment raté au suivant, puis refait le compte', () => {
  const video = {picks: [{t: 10, from: 4}, {t: 20}, {t: 30, from: 25}], duration: 40, currentTime: 33, paused: true, plays: 0,
    pause() { this.paused = true; }, play() { this.plays++; this.paused = false; return Promise.resolve(); }};
  const cls = new Set(['is-end', 'end-in', 'is-retry']), endEl = {hidden: false}, ended = [];
  const LV = {id: 56, video, pk: null, q: null, redo: null, retry: true, root: {classList: {remove: (...c) => c.forEach(x => cls.delete(x))}, querySelector: () => endEl}};
  const ctx = vm.createContext({LV, LV_ANS: {56: {p0: {first: 0, err: 2}, p1: {first: 1, err: 0}, p2: {first: 0, err: 1}}}, lvAnsSave() {}, lvSyncSeek() {}, lvNoteSync() {},
    navigator: {}, lvEnded() { ended.push(video.currentTime); }, lvPkClose() { LV.pk = null; }, lvPkMarks() {}, Math});
  vm.runInContext(cut('function lvPkFrom(i){', '/* L’étiquette quitte le plateau') + cut('function lvEndHide(){', '/* « Revoir la vidéo »')
    + cut('function lvPlay(){', 'function lvToggle(){') + ';this.api={lvPkFrom,lvPkBack,lvRedo,lvRedoNext};', ctx);
  const {api} = ctx;
  assert.deepEqual([api.lvPkFrom(0), api.lvPkFrom(1), api.lvPkFrom(2)], [4, 12, 25], 'début du passage : donné par la page, sinon 8 s avant');
  api.lvRedo([0, 2]);
  assert.deepEqual(Object.keys(ctx.LV_ANS[56]), ['p1'], 'les moments ratés repartent de zéro, les autres restent réussis');
  assert.ok(video.currentTime === 4 && video.plays === 1 && endEl.hidden && !cls.size && LV.redo.k === 0, 'la vidéo reprend au début du passage du premier moment raté');
  assert.equal(api.lvRedoNext(1), false, 'un autre moment ne fait pas avancer « Rejouer »');
  assert.ok(api.lvRedoNext(0) && video.currentTime === 25 && video.plays === 2, 'moment rejoué : saut au passage du moment raté suivant');
  assert.ok(api.lvRedoNext(2) && LV.redo === null && ended.join() === '40', 'dernier moment rejoué : l’écran de fin refait le compte');
  LV.pk = {i: 1}; video.currentTime = 20;
  api.lvPkBack(1);
  assert.ok(LV.pk === null && video.currentTime === 12 && video.plays === 3, '« ↺ Revoir » : la carte se ferme, la vidéo repart du début du passage');
  /* Le lecteur : la vidéo ne s’arrête que sur les moments à rejouer ; la carte a son bouton « ↺ Revoir ». */
  assert.ok(cut('class LvAnim{', 'function lessonVideoOn(l){').includes('if(this.skip&&this.skip(i))continue;')
    && html.includes('if(video instanceof LvAnim)video.skip=i=>!!(LV&&LV.video===video&&LV.redo&&!LV.redo.list.includes(i));'), 'pendant « Rejouer », les moments réussis sont passés');
  const show = cut('function lvPkShow(i,p){', 'function lvPkTry(k){');
  assert.ok(show.includes('<button type="button" class="lv-pk-back" aria-label="Revoir le passage avant ce moment">') && show.includes("box.querySelector('.lv-pk-back').addEventListener('click',()=>lvPkBack(i));")
    && show.includes('if(!lvRedoNext(i))lvPlay();'), 'carte : « ↺ Revoir », et « Continuer » enchaîne pendant « Rejouer »');
  assert.ok(html.includes('.lv-pk-back{margin-left:auto;') && html.includes('.lv-pk.is-ok .lv-pk-back{display:none}'), 'bouton « ↺ Revoir » discret, retiré une fois le moment réussi');
});

test('Quel JOIN choisir ? : chaque étiquette montre le résultat de SQLite (ordre compris), lignes en trop et manquantes', () => {
  const page = fs.readFileSync(path.join(ROOT, 'assets/anim/quel-join-choisir.html'), 'utf8');
  const a = page.indexOf('const DURATION = '), b = page.indexOf('/* ---------- Gabarits');
  assert.ok(a > 0 && b > a, 'données de la page localisées');
  const ctx = vm.createContext({APP: true, $: () => null, $$: () => []});
  vm.runInContext(page.slice(a, b) + ';this.PICKS = PICKS; this.rowsOf = rowsOf; this.pairsFor = pairsFor; this.diff = diff;', ctx);
  assert.equal(ctx.PICKS.length, 9, 'neuf moments « À toi »');
  ctx.PICKS.forEach((P, i) => {
    assert.equal(P.options.filter(o => o.ok).length, 1, `moment ${i + 1} : une seule bonne étiquette`);
    if (i) assert.ok(P.at > ctx.PICKS[i - 1].at, 'moments dans l’ordre');
  });
  const N = null;
  /* Résultats obtenus avec SQLite (sql.js) pour chaque requête complétée. */
  const SQLITE = [
    [1, 'INNER', [["Julie Roy", "Dr Claire Morel"], ["Marc Diaz", "Dr Paul Garnier"]]],
    [1, 'LEFT', [["Julie Roy", "Dr Claire Morel"], ["Marc Diaz", "Dr Paul Garnier"], ["Sarah Lopez", N]]],
    [1, 'RIGHT', [["Julie Roy", "Dr Claire Morel"], ["Marc Diaz", "Dr Paul Garnier"], [N, "Dr Anne Roux"]]],
    [1, 'FULL OUTER', [["Julie Roy", "Dr Claire Morel"], ["Marc Diaz", "Dr Paul Garnier"], ["Sarah Lopez", N], [N, "Dr Anne Roux"]]],
    [2, 'INNER', [["Lagon", "Poisson-clown"], ["Récif", "Hippocampe"], ["Récif", "Raie"]]],
    [2, 'LEFT', [["Lagon", "Poisson-clown"], ["Récif", "Hippocampe"], ["Récif", "Raie"], ["Abysses", N]]],
    [2, 'RIGHT', [["Lagon", "Poisson-clown"], ["Récif", "Hippocampe"], ["Récif", "Raie"], [N, "Tortue"]]],
    [2, 'FULL OUTER', [["Lagon", "Poisson-clown"], ["Récif", "Hippocampe"], ["Récif", "Raie"], ["Abysses", N], [N, "Tortue"]]],
    [3, 'INNER', [["Léa Martin", "Le Petit Prince"], ["Yanis Durand", "Les Misérables"]]],
    [3, 'LEFT', [["Léa Martin", "Le Petit Prince"], ["Yanis Durand", "Les Misérables"]]],
    [3, 'RIGHT', [["Léa Martin", "Le Petit Prince"], ["Yanis Durand", "Les Misérables"], [N, "Germinal"]]],
    [4, 'INNER', [["Léa Martin", "Le Petit Prince"], ["Yanis Durand", "Les Misérables"]]],
    [4, 'LEFT', [["Léa Martin", "Le Petit Prince"], ["Yanis Durand", "Les Misérables"], [N, "Germinal"]]],
    [4, 'RIGHT', [["Léa Martin", "Le Petit Prince"], ["Yanis Durand", "Les Misérables"]]],
    [5, 'INNER', [["Louis Bernard", 101], ["Emma Leroy", 102]]],
    [5, 'LEFT', [["Louis Bernard", 101], ["Emma Leroy", 102], ["Ali Koné", N]]],
    [5, 'RIGHT', [["Louis Bernard", 101], ["Emma Leroy", 102], [N, 103]]],
    [5, 'FULL OUTER', [["Louis Bernard", 101], ["Emma Leroy", 102], ["Ali Koné", N], [N, 103]]],
    [6, 'CROSS', [["Vanille", "Cornet"], ["Vanille", "Pot"], ["Chocolat", "Cornet"], ["Chocolat", "Pot"], ["Fraise", "Cornet"], ["Fraise", "Pot"]]],
    [8, 's.id', []],
    [8, 'm.manager_id', [["Hugo Lefèvre", "Hugo Lefèvre"], ["Inès Fabre", "Inès Fabre"], ["Inès Fabre", "Théo Petit"], ["Théo Petit", "Inès Fabre"], ["Théo Petit", "Théo Petit"]]],
    [8, 'm.id', [["Hugo Lefèvre", "Nadia Benali"], ["Inès Fabre", "Hugo Lefèvre"], ["Théo Petit", "Hugo Lefèvre"]]],
  ];
  const rows = (i, label) => { const P = ctx.PICKS[i]; return ctx.rowsOf(P, ctx.pairsFor(P, P.options.find(o => o.label === label))); };
  for (const [i, label, exp] of SQLITE) assert.equal(JSON.stringify(rows(i, label)), JSON.stringify(exp), `moment ${i + 1}, ${label}`);
  const plain = h => String(h).replace(/<[^>]+>/g, '');
  ctx.PICKS.forEach((P, i) => P.options.forEach(o => {
    assert.ok(typeof o.why === 'string' && plain(o.why).length >= 60 && plain(o.why).length <= 170, `moment ${i + 1}, ${o.label} : une correction qui explique le choix`);
    assert.ok(typeof o.say === 'string' && plain(o.say).length <= 56, `moment ${i + 1}, ${o.label} : un verdict court sous la requête`);
  }));
  ctx.PICKS.filter(P => P.kind === 'join').forEach(P => {
    const good = P.options.find(o => o.ok), others = P.options.filter(o => !o.ok).map(o => o.label.split(' ')[0]);
    assert.ok(others.some(l => good.why.includes(`<code>${l}</code>`)), `${good.label} : la bonne correction dit pourquoi pas ${others.join(', ')}`);
  });
  const [r, mk] = ctx.diff(rows(2, 'RIGHT'), rows(2, 'LEFT'));
  assert.equal(JSON.stringify(mk), '["","","","x","m"]', 'aquarium avec RIGHT : la tortue en trop, les Abysses manquantes');
  assert.equal(JSON.stringify(r[4]), '["Abysses",null]');
});

test('deux réponses enchaînées aux moments « À toi » : la pastille rouge du mauvais geste ne reste pas, clear() retire la classe de flash() sans attendre le minuteur', () => {
  for (const f of ['projet-normaliser.html', 'projet-cles.html', 'projet-uml.html']) {
    const src = fs.readFileSync(path.join(ROOT, 'assets/anim', f), 'utf8');
    const clearSrc = src.match(/function clear\(\)\{\n[\s\S]*?\n  \}/)?.[0], flashSrc = src.match(/const flash = \(e, c, ms = 600\) => \{[^\n]*\};/)?.[0];
    assert.ok(clearSrc && flashSrc, `${f} : clear() et flash() trouvés`);
    const stopped = [];
    let id = 0;
    const ctx = vm.createContext({setTimeout: () => ++id, clearTimeout: n => stopped.push(n)});
    const api = vm.runInContext(`let X = {cls: [], tm: []}, wait = 0; ${clearSrc}\n${flashSrc}\n({flash, clear, left: () => X})`, ctx);
    const classes = new Set();
    const el = {offsetWidth: 1, classList: {add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c)}};
    api.flash(el, 'kof', 650);
    assert.ok(classes.has('kof'), `${f} : le mauvais geste allume la pastille`);
    api.clear();                 // le moment change (bonne réponse aussitôt après) avant la fin du minuteur de 650 ms
    assert.ok(!classes.has('kof'), `${f} : la pastille rouge est retirée tout de suite`);
    assert.deepEqual(stopped, [1], `${f} : le minuteur est arrêté`);
    assert.equal(api.left(), null, `${f} : plus rien à nettoyer ensuite`);
  }
});
