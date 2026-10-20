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
  assert.ok(/notes:\{t:114\.8,y:1330,card:\[64,356,1016,1017\],to:\[940,255\]\}/.test(where), 'bouton « Ajouter dans notes » à 1 min 55, sous le récapitulatif ; la note part du récapitulatif vers le carnet');
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
  assert.ok(player.includes('À toi de jouer&nbsp;!'), 'fin : à toi de jouer');
  assert.ok(html.includes('.lv.is-end .lv-bottom{opacity:0;visibility:hidden;'), 'fin : commandes vraiment masquées (pas de bande sous la barre de Safari sur iPhone)');
  assert.ok(!player.includes('${l.consigne}') && !player.includes('lv-end-exo'), 'pas d’aperçu de l’exercice sur l’écran de fin : la consigne se découvre à l’étape Exercice');
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
  assert.equal(ctx.on(l), false, 'après un échec de lecture, le cours texte revient');
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

test('« Ajouter dans notes » dans la vidéo : même note que le cours texte, un seul appui, sans doublon ni toast', () => {
  const player = cut('function openLessonVideo(){', 'function lvPlay(){');
  assert.ok(player.includes('class="lv-note-btn"') && player.includes('Ajouter dans notes') && player.includes('class="lv-note-arrow"'), 'bouton et flèche dans le lecteur');
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
  const keep = cut('function lvPosKeep(){', '/* Repères des chapitres');
  assert.ok(keep.includes('if(t>2&&d>0&&t<d-2)LV_POS.set(LV.id,+t.toFixed(1)); else LV_POS.delete(LV.id);'));
  assert.ok(cut('function lvEnded(){', 'function lvReplay(){').includes('LV_POS.delete(id); lvPosSave();'), 'vidéo finie : la prochaine fois, elle repart du début');
  const marks = cut('function lvMarks(){', '/* En glissant sur la barre');
  assert.ok(marks.includes("LV.seek.style.setProperty('--gaps'") && html.includes('background:var(--gaps,linear-gradient(transparent,transparent))'), 'barre coupée au début de chaque chapitre');
  assert.ok(cut('function lvTip(on){', '/* Double appui').includes("tip.textContent=(c?`${c.n} · ${c.label}`:'Intro')+' · '+lvFmt(t);"), 'nom du chapitre en glissant');
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
  const iAnim = sw.indexOf("if (req.mode === 'navigate' && (req.destination === 'iframe' || url.pathname.includes('/assets/anim/')))");
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
  {id: 0, next: 2, titre: 'Les bases de données relationnelles', page: 'bases-relationnelles.html', thumb: 'bases-relationnelles-thumb.webp', duree: '5 min 55', notesAt: 327.35,
    notes: /notes:\{t:346\.5,y:1404,card:\[64,292,1016,1109\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Chaque sujet a sa table,<br>et des numéros relient les tables.',
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
      // La clé primaire : son nom complet, les deux Nathan, un numéro déjà pris refusé, un client sans numéro qui reçoit le suivant
      '<span class="emo">🔑</span>clé primaire', '<b class="nq k-cl">clients</b><i class="ndot">.</i><b class="nq nqc">id</b><span class="nlb">la table</span>',
      'Lequel des deux&nbsp;?', 'Le client 4&nbsp;: Nathan Petit', "const NOUVEAUX = [[4, 'Yanis', 'Roche'], [null, 'Lina', 'Garnier']];",
      'UNIQUE constraint failed: clients.id', '<span class="tys ko">✕ refusé</span>', 'Le SGBD y veille : un numéro déjà pris est <b>refusé</b>',
      // … et sa déclaration : id INTEGER PRIMARY KEY, à la création de la table
      '<span class="fname">schema.sql</span>', 'id <span class="glow" id="pkt">INTEGER</span> <span class="glow" id="pkk"><span class="kw">PRIMARY KEY</span></span>,', 'avec <code>PRIMARY KEY</code> placé juste après le type de la colonne',
      // La clé étrangère : commandes.client_id → clients.id, puis la commande pour le client 99 refusée
      '<span class="emo">🔗</span>clé étrangère', '<b class="nq k-co">commandes</b><i class="ndot">.</i><b class="nq nqc">client_id</b><i class="narr">→</i><b class="nq k-cl">clients</b>',
      '<div class="stamp" id="stamp4">Relationnelle</div>', 'const CLIENT_INCONNU = 99;', '<span class="m">FOREIGN KEY constraint failed</span>',
      // … et sa déclaration : FOREIGN KEY (client_id) REFERENCES clients(id), rappelée quand la commande est refusée
      '<span class="kw">FOREIGN KEY</span> <span class="glow" id="fka">(client_id)</span>', '<span class="kw">REFERENCES</span> <span class="glow" id="fkb">clients(id)</span>',
      '<div class="abs fkp" id="fkp"><span class="codepill"><span class="kw">FOREIGN KEY</span> (client_id) <span class="kw">REFERENCES</span> clients(id)</span></div>', 'Le SGBD vérifie alors chaque lien : existe-t-il un client numéro 99 ?',
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
  {id: 2, next: 13, titre: 'Renommer avec AS', page: 'as.html', thumb: 'as-thumb.jpg', duree: '2 min 02', notesAt: 92.4,
    notes: /notes:\{t:114\.1,y:1330,card:\[64,356,1016,1017\],to:\[940,255\]\}/, table: 'produits',
    bubble: 'Avec <span class="ic">AS</span>, donne à une colonne un nom plus clair dans le résultat.',
    chapters: ['Situation', 'Le problème', 'Renommer une colonne', 'Plusieurs colonnes', 'Le piège des guillemets', 'Le résultat', 'À retenir'],
    traps: ['near "du": syntax error', 'near "(": syntax error', '"Nom du produit"']},
  {id: 13, next: 4, titre: 'DISTINCT', page: 'distinct.html', thumb: 'distinct-thumb.jpg', duree: '1 min 59', notesAt: 87.2,
    notes: /notes:\{t:111\.6,y:1277,card:\[64,356,1016,964\],to:\[940,255\]\}/, table: 'clients',
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
    notes: /notes:\{t:122\.2,y:1359,card:\[64,356,1016,1064\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">IN</span>, compare une colonne à toute une liste de valeurs.',
    chapters: ['Situation', 'Le problème', 'IN en action', 'Écrire la liste', 'Une seule colonne', 'Le résultat', 'À retenir'],
    traps: ['<span class="ball">2</span><span class="ball">5</span><span class="ball">9</span>',
      '<span class="ln" id="ql4">   <span class="kw">OR</span> <span class="rep" id="r2">id =<i class="mbox"></i></span> 5', '<span class="x3" id="x3">× 3</span>',
      '<span class="kw glow" id="inA">IN</span> <span id="opA">(</span>2<span id="restA">, <span id="v5">5</span>, <span id="v9">9</span></span><span id="cpA">)</span>',
      'Son numéro est-il dans la liste ?', '<div class="tg" id="tgP"><i>( )</i>entre parenthèses</div>',
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
  {id: 76, next: 18, titre: 'GROUP_CONCAT', page: 'group-concat.html', thumb: 'group-concat-thumb.jpg', duree: '2 min 46', notesAt: 150.2,
    notes: /notes:\{t:158\.5,y:1367,card:\[64,300,1016,1072\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec <span class="ic">GROUP_CONCAT</span>, liste les valeurs de chaque groupe.',
    chapters: ['Situation', 'Le problème', 'GROUP_CONCAT en action', 'Séparateur et NULL', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span>Entrepôt · Suivi des commandes</span>', '<span class="nl">La liste de ses commandes</span><span class="tag calc">à calculer</span>',
      '<span class="emo">🎯</span>Lister les commandes de chaque statut', "const liste = s => idsDe(s).join(', ');",
      '<span class="glow" id="gc3"><span class="kw">GROUP_CONCAT</span>(<span class="hw" id="ci3">id</span>, <span class="str hw" id="cs3">\', \'</span>)</span>',
      '<span class="b"><span class="emo">🧵</span>&nbsp;Une seule cellule par groupe</span>', '<span class="dc"><span class="kw">GROUP_CONCAT</span>(id)</span>',
      '<span class="snote" id="sn4">une virgule sans espace</span>', '<span class="vc nul" id="vn4"><small>commande n°16</small><b>NULL</b>', '<span class="b">4, 1, 3, 5</span>',
      '<span class="glow" id="ob5"><span class="kw">ORDER BY</span> statut <span class="kw">DESC</span></span>', '<span class="b">16, 15, 14, 13, 12</span>',
      '<span class="glow" id="as6"><span class="kw">AS</span> commandes</span>', '✓ 16 commandes, chacune sous son statut']},
  {id: 18, next: 20, titre: 'INNER JOIN', page: 'inner-join.html', thumb: 'inner-join-thumb.jpg', duree: '2 min 20', notesAt: 120.9,
    notes: /notes:\{t:132\.5,y:1365,card:\[64,300,1016,1070\],to:\[940,255\]\}/, table: 'commandes',
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
    notes: /notes:\{t:210\.3,y:1149,card:\[64,292,1016,854\],to:\[940,255\]\}/, table: 'clients',
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
    notes: /notes:\{t:162\.0,y:1346,card:\[64,292,1016,1051\],to:\[940,255\]\}/, table: 'clients',
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
  {id: 49, next: 44, titre: 'Plusieurs conditions dans ON', page: 'plusieurs-conditions-on.html', thumb: 'plusieurs-conditions-on-thumb.jpg', duree: '3 min 16', notesAt: 177.6,
    notes: /notes:\{t:190\.8,y:1340,card:\[64,292,1016,1045\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec <span class="ic">AND</span>, une jointure peut vérifier<br>plusieurs conditions à la fois.',
    chapters: ['Situation', 'Le problème', 'AND en action', 'Une troisième condition', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span>Coursier express</span><span class="tb tc" id="tb1">table commandes</span>', "const PARIS = LIGNES.filter(l => l[3] === 'Paris');",
      '<span class="glow" id="o2"><span class="kw">ON</span> commandes.client_id = clients.id</span>;',
      '<span class="glow" id="a3"><span class="kw">AND</span> clients.ville = <span class="str">\'Paris\'</span></span>',
      '<span class="ck-out no"><span class="sw"><span class="a">?</span><span class="b">✕ Pas reliées</span></span></span>',
      '<span class="glow" id="w4"><span class="kw">AND</span> commandes.statut = <span class="str">\'en_preparation\'</span></span>',
      '<span class="glow" id="or5"><span class="kw">OR</span> clients.ville = <span class="str">\'Paris\'</span></span>', '<span class="n5">72 lignes</span>',
      '✓ 2 commandes pour le coursier', '<span class="c">Lyon ✕</span>', '"À ne pas confondre : 13 est le numéro de la commande, 1 celui de la cliente."',
      '"Première condition :<br>la commande n°13 appartient-elle<br>à la cliente Sophie Martin ?"', '"Deuxième condition :<br>Sophie Martin habite-t-elle à Paris ?<br>Oui, sa ville est Paris."',
      '<span class="bike" id="bike6"><span class="emo">🛵</span></span>', '<span class="lvr">✓ Livrée</span>']},
  {id: 44, next: 45, titre: 'Quel JOIN choisir ?', page: 'quel-join-choisir.html', thumb: 'quel-join-choisir-thumb.jpg', duree: '4 min 14', notesAt: 218.5,
    notes: /notes:\{t:245\.7,y:1396,card:\[64,292,1016,1101\],to:\[940,255\]\}/, table: 'clients',
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
      "tick(){ if (wait < 0) return; const a = PICKS[wait].at, t = tl.time(); if (t >= a + 0.0199 || t < a - 0.001) clear(); }"]},
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
  {id: 73, next: 80, titre: 'UNION et UNION ALL', page: 'union.html', thumb: 'union-thumb.jpg', duree: '3 min 49', notesAt: 155.7,
    notes: /notes:\{t:223\.3,y:1391,card:\[64,292,1016,1096\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">UNION</span>, empile les lignes<br>de plusieurs requêtes en un seul résultat.',
    chapters: ['Situation', 'Le problème', 'UNION ALL', 'Les noms de colonnes', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ["const INDICATEURS = [['Nombre de clients', 10, '👥'], ['Nombre de commandes', 16, '🛒'], ['Nombre de produits', 8, '📦']];",
      '<div class="q2-rh">COUNT(*)</div><div class="q2-n">16</div>', '<span class="glow" id="u3a"><span class="kw">UNION ALL</span></span>',
      '<div><span class="qm">?</span></div>', '<span class="glow" id="ai4"><span class="kw">AS</span> indicateur</span>',
      '<span class="m">SELECTs to the left and right of UNION ALL do not have the same number of result columns</span>',
      '<span class="k ko">3 colonnes</span>', '✓ Un indicateur de plus = une ligne de plus', '✓ Tableau de bord à jour',
      '<div class="mn-l"><span class="ic">UNION</span> rallonge</div>']},
  {id: 80, next: 77, titre: 'INTERSECT et EXCEPT', page: 'intersect-except.html', thumb: 'intersect-except-thumb.jpg', duree: '3 min 04', notesAt: 159.2,
    notes: /notes:\{t:178\.5,y:1356,card:\[64,292,1016,1061\],to:\[940,255\]\}/, table: 'produits',
    bubble: 'Avec <span class="ic">INTERSECT</span> et <span class="ic">EXCEPT</span>,<br>compare les lignes de deux requêtes.',
    chapters: ['Situation', 'Le problème', 'INTERSECT', 'EXCEPT', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ["const STOCK_FAIBLE = [['Collagène Marin', 80], ['Oméga 3', 90], ['Protéine Végétale', 45], ['Shaker Inox', 30], ['Tisane Détox', 60]];",
      '<span class="glow" id="op3"><span class="kw"><span class="wx" id="kwI">INTERSECT</span><span id="kwE">EXCEPT</span></span></span>',
      '<span class="glow" id="w9"><span class="kw">WHERE</span> commandes.date_commande &gt;= <span class="str">\'2026-07-20\'</span></span>',
      '🏷️ Tisane Détox&nbsp;: à écouler en promotion', "tl.to(blocB, {y: -4 * LH, duration: 0.6, ease: 'power2.inOut'}, 113.0);",
      '✕ Des stocks confortables&nbsp;: 120, 500 et 150 unités', '✓ Commande envoyée au fournisseur',
      '<div class="mn-l"><span class="ic">EXCEPT</span><span>retire la seconde</span></div>']},
  {id: 77, next: 60, titre: 'WITH RECURSIVE (CTE RECURSIVE)', page: 'with-recursive.html', thumb: 'with-recursive-thumb.jpg', duree: '3 min 29', notesAt: 159.2,
    notes: /notes:\{t:203\.2,y:1391,card:\[64,292,1016,1096\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec <span class="ic">WITH RECURSIVE</span>, fabrique une suite de lignes à partir d’une seule ligne.',
    chapters: ['Situation', 'Le problème', 'L’ancre', 'La partie récursive', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['const JOURS_AVEC_COMMANDE = [2, 5, 8, 11, 12, 15, 18, 20, 22, 25, 28, 30];', '<span class="lg q" id="lgq2">? 19 jours</span>',
      '<span class="glow" id="an3"><span class="kw">SELECT</span> <span class="str">\'2026-07-01\'</span></span>',
      '<span class="glow" id="rc3"><span class="kw">DATE</span>(jour, <span class="str">\'+1 day\'</span>)</span>',
      '<span class="glow" id="wh3"><span class="kw">WHERE</span> jour &lt; <span class="str">\'2026-07-31\'</span></span><i class="strike" id="sk5"></i>',
      '⏳ Exécution en cours…', '✕ Sans condition d’arrêt, la requête ne s’arrête jamais',
      '<span class="glow" id="ex6"><span class="kw">EXCEPT</span></span>', '✓ 19 promotions programmées']},
  {id: 60, next: 74, titre: 'OVER()', page: 'over.html', thumb: 'over-thumb.jpg', duree: '3 min 28', notesAt: 159.2,
    notes: /notes:\{t:202\.2,y:1391,card:\[64,292,1016,1096\],to:\[940,255\]\}/, table: 'produits',
    bubble: 'Avec <span class="ic">OVER()</span>, un calcul porte sur plusieurs lignes sans les regrouper.',
    chapters: ['Situation', 'Le problème', 'OVER ()', 'PARTITION BY', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<div class="lst-t mono">GROUP BY categorie</div>', '✕ Le nom et le prix des produits ont disparu',
      '<span class="glow" id="ov3"><span class="kw">OVER</span> <span id="op3">(</span><span class="wx" id="cp3">)</span></span>',
      '<span class="glow" id="pb3"><span class="kw">PARTITION BY</span> categorie</span>', '<b class="v8">8</b><b class="vp">${nbDans(c)}</b>',
      '<span class="m">misuse of window function COUNT()</span>', '<div class="st ko" id="sw5"><b>2</b><span>WHERE</span></div>',
      '<span class="glow" id="wh6"><span class="kw">WHERE</span> nb_produits = 1</span>', '✓ 3 catégories à étoffer']},
  {id: 74, next: 78, titre: 'Fonctions de rang', page: 'fonctions-rang.html', thumb: 'fonctions-rang-thumb.jpg', duree: '3 min 12', notesAt: 162.7,
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
  {id: 78, next: 79, titre: 'LAG et LEAD', page: 'lag-lead.html', thumb: 'lag-lead-thumb.jpg', duree: '3 min 29', notesAt: 163.2,
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
  {id: 79, next: 56, titre: 'Fenêtres glissantes', page: 'fenetres-glissantes.html', thumb: 'fenetres-glissantes-thumb.jpg', duree: '3 min 03', notesAt: 162.7,
    notes: /notes:\{t:177\.8,y:1274,card:\[64,292,1016,979\],to:\[940,255\]\}/, table: 'commandes',
    bubble: 'Avec <span class="ic">ROWS BETWEEN</span>, choisis les lignes qui entrent dans chaque calcul.',
    chapters: ['Situation', 'Le problème', 'Le cumul', 'La moyenne mobile', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ['<span class="glow" id="mt2">produits.prix * commandes.quantite</span>', '<b id="tot2">747.5</b>',
      '<span class="glow" id="fr3a"><span class="kw">ROWS BETWEEN UNBOUNDED PRECEDING</span></span>', '<span class="frm" id="frm3"></span>',
      '<span class="b"><span class="glow" id="p4"><span class="kw">2 PRECEDING</span></span></span>', '<span class="glow" id="ob5"><span class="kw">ORDER BY</span> date_commande</span>',
      '✕ Les deux commandes du 2 juillet ont le même cumul', '<div class="lim" id="lim6"><span>Palier&nbsp;: 700&nbsp;€</span></div>',
      '✓ Palier franchi le 1er&nbsp;août']},
  {id: 56, next: 72, titre: 'Normalisation', page: 'normalisation.html', thumb: 'normalisation-thumb.jpg', duree: '3 min 15', notesAt: 174.9,
    notes: /notes:\{t:186\.2,y:1304,card:\[64,292,1016,1009\],to:\[940,255\]\}/, table: 'produits',
    bubble: 'Normaliser, c’est écrire chaque information<br>une seule fois, dans la bonne table.',
    chapters: ['Situation', 'Le problème', 'La normalisation', 'Une seule fois', 'Le piège', 'Le résultat', 'À retenir'],
    traps: ["const COUPE = [['Collagène Marin', 4], ['Fibre Prébiotique', 6], ['Fibre prebiotique', 1], ['Fibres Prébiotiques', 3], ['Magnésium', 3],",
      "const VENTES = [['Collagène Marin', 4], ['Fibre Prébiotique', 10], ['Magnésium', 3], ['Oméga 3', 3], ['Protéine Végétale', 2], ['Shaker Inox', 1], ['Tisane Détox', 2], ['Vitamine D', 3]];",
      "'Fibre <i class=\"ty\">p</i>r<i class=\"ty\">e</i>biotique'", '<span class="cl">🧮 Vrai total</span>',
      '<div class="sr fk" id="sl-produit_id"><span class="v"><span class="emo">🔗</span>produit_id</span></div>',
      '<span class="w x st">Fibres Prébiotiques</span>', '<span class="n1">produit_id = 1</span>', '<span class="emo">🔗</span>commandes.produit_id = produits.id',
      '<span class="c rg" id="rg5">région</span>', '<span class="glow" id="g6"><span class="kw">GROUP BY</span> produits.nom</span>', '✓ Une seule barre par produit']},
  {id: 72, next: 81, titre: 'Relations 1-1, 1-N et N-N', page: 'relations.html', thumb: 'relations-thumb.jpg', duree: '3 min 32', notesAt: 190.3,
    notes: /notes:\{t:203\.1,y:1286,card:\[64,292,1016,991\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avant de relier deux tables, demande-toi&nbsp;: combien de lignes en face&nbsp;?',
    chapters: ['Situation', 'Le problème', 'Combien en face ?', '1 → N', '1 ↔ 1', 'N ↔ N', 'Le couple unique', 'Le résultat', 'À retenir'],
    traps: ["const COMMANDES = [[4, 3, 2], [5, 4, 1], [6, 5, 4], [12, 4, 2]];", "const FIDELITE = [[1, 1, 120], [2, 2, 80], [3, 4, 250], [4, 7, 160]];",
      "const ENVOIS = [[1, 1, '2026-09-01'], [1, 3, '2026-09-01'], [2, 1, '2026-09-02']];",
      // Une case ne range qu’un seul numéro : deux produits pour Sophie Martin, deux clients pour la Fibre, deux commandes pour Nathan Petit
      "row([1, 'Sophie', essai(1, 3, 'k-pr')])", "row([1, PRODUITS[1], essai(1, 2, 'k-cl')])", "id === 4 ? essai(5, 12, 'k-co') : ''",
      '<span class="tx3">Combien de lignes en face&nbsp;?</span>', "cb: '1 ↔ 1'}", "cb: '1 → N'}", "cb: 'N ↔ N'}",
      '<span class="glow" id="un5"><span class="kw">UNIQUE</span></span>', '<span class="m">UNIQUE constraint failed: fidelite.client_id</span>',
      'table de jointure</span>', '<span class="kw">PRIMARY KEY</span> (client_id, produit_id)', 'echantillons.client_id, echantillons.produit_id</span>',
      "row([fk(1, 'k-cl'), fk(1, 'k-pr'), '2026-09-05', st('ko', '✕ refusé')], ' nw')", "row([fk(2, 'k-cl'), fk(1, 'k-pr'), '2026-09-02', st('ok', '✓ accepté')], ' nw')",
      '✓ 3 envois, aucun doublon possible']},
  {id: 81, next: 61, titre: 'Modéliser avec UML', page: 'uml.html', thumb: 'uml-thumb.jpg', duree: '3 min 43', notesAt: 195.45,
    notes: /notes:\{t:214\.9,y:1289,card:\[64,292,1016,994\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Dessine les classes et leurs liens<br>avant de créer les tables.',
    chapters: ['Situation', 'Le problème', 'Le diagramme', 'Les multiplicités', 'Classe → table', '1 — 0..*', '0..* — 0..*', 'Le résultat', 'À retenir'],
    traps: ["const COACHS = [[1, 'Camille', 'Roux'], [2, 'Thomas', 'Girard']];", "const ATELIERS = [[1, 'Récupération', 1], [2, 'Cuisine saine', 1], [3, 'Gainage doux', 2]];",
      'const INSCRIPTIONS = [[1, 1], [1, 3], [4, 1], [7, 2]];', '<span class="pc qq">? coach</span>', '<span class="pc qq">? client</span>',
      // Le diagramme : trois classes, deux associations, une multiplicité à chaque bout
      '<div class="un">Coach</div>', '<div class="un">Atelier</div>', '<div class="un">Client</div>', '<span class="ux" id="ux1">anime<i>▾</i></span>',
      '<span class="ux" id="ux2">s’inscrit à<i>▴</i></span>', '<span class="um" id="um1a">1</span><span class="um" id="um1b">0..*</span>',
      // Traduction : la classe devient une table, coach_id du côté 0..*, la table d’association
      '<span class="abs fl fly k-ch" id="fl6">coach_id</span>', "essai(1, 2, 'k-at')", '<span class="emo">🔑</span>clé primaire sur le couple',
      '<span class="kw">PRIMARY KEY</span> (client_id, atelier_id)', '✓ 3 nouvelles tables, chaque lien à sa place']},
];

for (const c of COURSES) {
  test(`${c.titre} : le cours a son animation et sa vignette, avec le bouton « Ajouter dans notes » sous le récapitulatif`, () => {
    const lesson = cut(`guide({ id:${c.id}, titre:"${c.titre}"`, `guide({ id:${c.next},`);
    const m = lesson.match(/video:\{anim:'([^']+)',thumb:'([^']+)',duree:'([^']+)',/);
    assert.ok(m, `champ video du cours ${c.titre}`);
    assert.equal(m[1], `assets/anim/${c.page}?app&embed`);
    assert.equal(m[2], `assets/anim/${c.thumb}`);
    for (const f of m.slice(1, 3)) assert.ok(fs.statSync(path.join(ROOT, f.split('?')[0])).size > 1000, `fichier présent : ${f}`);
    assert.equal(m[3], c.duree);
    assert.ok(c.notes.test(lesson), 'bouton « Ajouter dans notes » sous « Les trois idées à retenir »');
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
    if (!['between.html', 'limit-offset.html'].includes(c.page)) assert.ok(page.includes("stackBelow('#s1 .need', "), 'la liste des informations se cale sous la carte de la situation, sans la toucher');
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
  /* Ce que la base vérifie : un numéro déjà pris est refusé, un client sans numéro reçoit le suivant, un client inconnu est refusé. */
  const [[idPris, p1, n1], [, p2, n2]] = JSON.parse(JSON.stringify(ctx.NOUVEAUX));
  assert.throws(() => db.run(`INSERT INTO clients (id, prenom, nom) VALUES (${idPris}, '${p1}', '${n1}')`), /UNIQUE constraint failed: clients\.id/, 'le numéro 4 est déjà pris');
  db.run(`INSERT INTO clients (prenom, nom) VALUES ('${p2}', '${n2}')`);
  assert.equal(q(`SELECT id FROM clients WHERE prenom = '${p2}'`), '[[11]]', 'sans numéro, le client reçoit le suivant : 11');
  db.run('PRAGMA foreign_keys = ON;');
  assert.throws(() => db.run(`INSERT INTO commandes (client_id, produit_id, quantite) VALUES (${ctx.CLIENT_INCONNU}, 1, 1)`), /FOREIGN KEY constraint failed/, 'aucun client 99 : la commande est refusée');
  db.close();
  assert.ok(!/SELECT(<\/span>)? nom, prix/.test(page), 'la vidéo ne montre pas la requête de l’exercice (le nom et le prix des produits)');
});

test('Modéliser avec UML : les clients inscrits sont ceux de la base, et les tables de la vidéo celles que crée la requête du cours', async () => {
  const page = fs.readFileSync(path.join(ROOT, 'assets/anim/uml.html'), 'utf8');
  const a = page.indexOf('const COACHS = '), b = page.indexOf('const CHAPTERS = ');
  assert.ok(a > 0 && b > a, 'données de la page localisées');
  const ctx = vm.createContext({});
  vm.runInContext(page.slice(a, b) + ';this.D = {COACHS, ATELIERS, CLIENTS, INSCRIPTIONS, TABLES};', ctx);
  const D = JSON.parse(JSON.stringify(ctx.D));
  const data = vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), data);
  const lesson = vm.runInContext('MODULES.flatMap(m=>m.lessons).find(l=>l.id===81)', data);
  const {createRequire} = await import('node:module');
  const SQL = await createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
  const db = new SQL.Database();
  db.run(vm.runInContext('SCHEMA_SQL', data));
  for (const [id, [prenom, nom]] of Object.entries(D.CLIENTS))
    assert.equal(JSON.stringify(db.exec(`SELECT prenom, nom FROM clients WHERE id = ${id}`)[0].values), JSON.stringify([[prenom, nom]]), `client ${id}`);
  assert.ok(D.INSCRIPTIONS.every(([c, at]) => D.CLIENTS[c] && D.ATELIERS.some(x => x[0] === at)), 'chaque inscription désigne un client et un atelier montrés');
  /* La requête complète du cours crée les trois tables, puis on y range les données de la vidéo : les clés étrangères les acceptent. */
  db.run('PRAGMA foreign_keys = ON;');
  const res = db.exec(lesson.missionSql);
  assert.equal(JSON.stringify(res.at(-1).values.map(r => r[0])), JSON.stringify(D.TABLES), 'les 7 tables du résultat');
  db.run(`INSERT INTO coachs VALUES ${D.COACHS.map(([i, p, n]) => `(${i}, '${p}', '${n}')`).join(', ')};`);
  db.run(`INSERT INTO ateliers VALUES ${D.ATELIERS.map(([i, t, c]) => `(${i}, '${t}', ${c})`).join(', ')};`);
  db.run(`INSERT INTO inscriptions VALUES ${D.INSCRIPTIONS.map(([c, at]) => `(${c}, ${at})`).join(', ')};`);
  assert.equal(JSON.stringify(db.exec('SELECT coach_id, COUNT(*) FROM ateliers GROUP BY coach_id')[0].values), '[[1,2],[2,1]]', 'Camille Roux anime deux ateliers, Thomas Girard un seul');
  assert.equal(JSON.stringify(db.exec('SELECT client_id, COUNT(*) FROM inscriptions GROUP BY client_id HAVING COUNT(*) > 1')[0].values), '[[1,2]]', 'Sophie Martin suit deux ateliers');
  assert.equal(JSON.stringify(db.exec('SELECT atelier_id, COUNT(*) FROM inscriptions GROUP BY atelier_id HAVING COUNT(*) > 1')[0].values), '[[1,2]]', 'l’atelier Récupération accueille deux clients');
  assert.throws(() => db.run('INSERT INTO inscriptions VALUES (1, 1);'), /UNIQUE constraint failed/, 'clé primaire sur le couple');
  db.close();
  /* Mêmes coachs et mêmes ateliers que dans le cours (étape 1 et onglet Teste). */
  assert.ok(lesson.studio.uses.body.includes('VALUES (1, &#39;Camille&#39;, &#39;Roux&#39;),') || lesson.studio.uses.body.includes("VALUES (1, 'Camille', 'Roux'),"), 'les deux coachs du cours');
  assert.ok(lesson.testeVariants[0].sql.includes("VALUES (1, 'Récupération', 1),\n       (2, 'Cuisine saine', 1);"), 'les ateliers de Camille Roux');
  assert.ok(!page.includes('programme') && !page.includes('seance'), 'la vidéo ne montre pas l’exercice');
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

test('SELECT sans virgule : le cours texte (cours 0) et le quiz expliquent l’alias (AS facultatif), comme l’animation', () => {
  const sel = cut('guide({ id:0, titre:"Les bases de données relationnelles"', 'guide({ id:2,');
  assert.ok(sel.includes('Sans virgule, <code>email</code> est lu comme un <b>alias</b> : le titre donné à la colonne dans le résultat. Le mot-clé <code>AS</code> étant facultatif, cette requête équivaut à :'));
  assert.ok(sel.includes('{syntax:"SELECT prenom AS email\\nFROM clients;"}'), 'la requête équivalente avec AS');
  assert.ok(sel.includes('il faut la virgule : <code>SELECT prenom, email</code>'), 'la correction');
  assert.ok(!/SQL ne comprend pas|Il interprète|SQL voit|Il s’attend/.test(sel), 'SQL n’est pas personnifié');
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
  for (const part of ['lvPkSet(LV.id,P.i,first)', "LvSfx.play('chord',0,.55,0)", 'lvPkBurst(rect)', "kick.textContent='✕ Essaie un autre choix';", "btn.classList.add('is-out')",
    "const why=r.why||r.say||''", "wEl.innerHTML=why; wEl.className='lv-pk-why '+(ok?'ok':'ko'); wEl.hidden=false;", "P.box.querySelector('.lv-pk-t').hidden=true;"])
    assert.ok(vd.includes(part), `verdict : ${part}`);
  assert.ok(html.includes('.lv-pk-hole{') && html.includes('.lv-pk-why.ok{') && html.includes('.lv-pk-why.ko{'), 'case jaune du prompt, correction verte ou rouge');
  assert.ok(html.includes('.lv.is-pk .lv-bottom{visibility:hidden}') && html.includes('const a=lvPt(0,1496);'), 'le plateau couvre la légende et les commandes, jamais le résultat');
  assert.ok(cut('function lvPkClose(answered){', 'function lvReplay(){').includes('IX.leave(P.i,!!answered)'), 'à la reprise, la page laisse la timeline reprendre la même image');
  assert.ok(html.includes("o['p'+i]={first:first?1:0}") && html.includes('.lv-pk-t code{'), 'premier essai gardé pour le score ; code du prompt en étiquette');
  const core = fs.readFileSync(path.join(ROOT, 'assets/anim/core.js'), 'utf8');
  assert.ok(core.includes('picks: picks.map(p => ({t: unwarp(p.at), prompt: fr(p.prompt), options: p.options.map(o => ({label: o.label, ok: !!o.ok}))}))')
    && core.includes('clashes: holdClashes(picks.map(p => p.at))') && core.includes('if (cfg.onRender) cfg.onRender(T);'), 'moteur : moments exportés, aucune animation coupée par un arrêt, rendu suivi par la page');
});

test('leçon seule (Quel JOIN choisir ?) : la vidéo interactive valide la leçon, sans exercice, quiz ni révision', () => {
  const l44 = cut('guide({ id:44, titre:"Quel JOIN choisir ?"', 'guide({ id:45,');
  assert.ok(l44.includes('leconSeule:true,') && l44.includes(",duree:'4 min 14',moments:9,"), 'leçon 44 : leçon seule, 9 moments');
  assert.ok(html.includes("'joinRecap','leconSeule','exoNeeds','video']"), 'drapeau copié par guide()');
  assert.ok(html.includes('function dueList(){ return allLessons.filter(l=>isDue(l.id)&&!l.leconSeule); }'), 'pas de révision « De mémoire » sans exercice');
  assert.ok(html.includes("if(current.leconSeule)return [{i:0,l:'Leçon'") && html.includes("if(leconSeule(id))return !!(state.lessons[id]&&state.lessons[id].done);"), 'une seule étape : la leçon');
  const end = cut('function lvEnded(){', 'function lvReplay(){');
  assert.ok(end.includes('markDone(id,false)') && end.includes('🎯 Du premier coup'), 'fin de la vidéo : leçon validée, score des moments');
  assert.ok(cut('function lvGoExercise(){', 'function lvFail(){').includes('leconSeuleBilan(first)'), '« Terminer la leçon » ouvre le bilan');
  assert.ok(html.includes("${l.leconSeule?'Leçon terminée&nbsp;!':'À toi de jouer&nbsp;!'}") && html.includes("${l.leconSeule?'Terminer la leçon':'Passer à l’exercice'}"), 'écran de fin propre à la leçon seule');
  assert.ok(html.includes('<i>🎯</i> ${ok}/${n} du premier coup'), 'bilan : moments trouvés du premier coup');
});

test('leçon seule : on n’avance pas au-delà d’un moment « À toi » pas réussi ; la leçon se valide avec au moins 6 sur 9', () => {
  const video = {picks: [{t: 10}, {t: 20}, {t: 30}], duration: 40, currentTime: 0, paused: false, plays: 0,
    pause() { this.paused = true; }, play() { this.plays++; this.paused = false; return Promise.resolve(); }};
  const LV = {id: 44, video, pk: null, q: null, root: {classList: {contains: () => false}, querySelector: () => null}}, shown = [];
  const ctx = vm.createContext({LV, LV_ANS: {}, lvAnsSave() {}, lvSyncSeek() {}, lvNoteSync() {}, lvQClose() {}, prefersReduceMotion: () => true, navigator: {},
    lvPkShow(i, p) { shown.push(i); LV.pk = {i, p, done: false}; }, lvPkClose() { LV.pk = null; }, Math, Object, Promise});
  vm.runInContext(cut('function lvPkGet(id,i){', 'function lvPkIX(){') + cut('/* Saut de ±5 s', 'function lvSpeedMenu(open){') + cut('function lvPlay(){', 'function lvToggle(){')
    + ';this.api={lvPkSet,lvPkScore,lvPkReset,lvReussi,lvPkGate,lvSkip,lvPlay};', ctx);
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
  const player = cut('function openLessonVideo(){', 'function lvPlay(){');
  assert.ok(player.includes('LV.gate=lvPkGate(t);') && player.includes('if(g>=0)lvPkStop(g); else if(again)lvPlay();'), 'barre : le curseur s’arrête avant le moment, son plateau s’ouvre au relâchement');
  assert.ok(player.includes('const g=lvPkGate(r); if(g>=0)r=Math.max(0,video.picks[g].t-.08);'), 'reprise : jamais au-delà d’un moment pas réussi');
  const end = cut('function lvEnded(){', '/* ---------- « Ajouter dans notes »');
  for (const part of ['LV.retry=!was&&ok<need;', 'if(LV.firstDone){ markDone(id,false);', 'Il en faut au moins ${need} pour valider la leçon.',
    "LV.retry?'Recommencer la vidéo':'Terminer la leçon'", 'if(LV.retry)lvPkReset(id);', "root.classList.toggle('is-retry',LV.retry);"])
    assert.ok(end.includes(part), `fin de la vidéo : ${part}`);
  assert.ok(cut('function lvGoExercise(){', 'function lvFail(){').includes('if(LV&&LV.retry){ lvReplay(); return; }'), 'sous le seuil : « Recommencer la vidéo »');
  assert.ok(cut('function leconSeuleBilan(first){', 'function lvFail(){').includes('if(!lvReussi(current))return;'), 'ni bilan ni validation sous le seuil');
  assert.ok(cut('guide({ id:44,', 'guide({ id:45,').includes(',moments:9,seuil:6,'), 'leçon 44 : au moins 6 moments sur 9');
  assert.ok(html.includes('Obtiens ${lvSeuil(l)}/${v.moments} pour valider la leçon'), 'le bouton du cours annonce la règle');
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
