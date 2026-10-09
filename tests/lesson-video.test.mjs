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
  total += fs.statSync(path.join(ROOT, 'assets/fonts/jetbrains-mono.woff2')).size;
  assert.ok(total < 450 * 1024, `animation et ressources : ${Math.round(total / 1024)} Ko`);
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

test('page de l’animation : ressources locales, mode intégré, question, chapitres et légendes exportés', () => {
  const page = fs.readFileSync(path.join(ROOT, 'assets/anim/where.html'), 'utf8');
  for (const rel of ['gsap.min.js', 'mascotte.webp', '../fonts/jetbrains-mono.woff2', '../fonts/bricolage-grotesque-regular.woff2', '../fonts/bricolage-grotesque-bold.woff2'])
    assert.ok(page.includes(rel) && fs.existsSync(path.join(ROOT, 'assets/anim', rel)), `ressource : ${rel}`);
  assert.ok(!/https?:\/\//.test(page.replace(/https:\/\/gsap\.com/g, '')), 'rien de chargé depuis Internet');
  assert.ok(page.includes("const EMBED = new URLSearchParams(location.search).has('embed');"), 'mode intégré : la scène s’adapte à la fenêtre');
  assert.ok(page.includes("ctx: 'Lucas habite à Lyon.'") && page.includes("q: 'Sa ligne sera-t-elle gardée ?'") && page.includes("{label: 'Non, écartée', ok: true}"));
  assert.ok(page.includes('chapters: CHAPTERS.map(') && page.includes('captions: CAPTIONS.map(') && page.includes('questions: QUESTIONS.map('));
  assert.ok(page.includes('const sr = $(\'#stage\').getBoundingClientRect(), k = sr.width / 1080 || 1;'), 'mesures justes quand la scène est réduite');
  assert.ok(page.includes('<div class="inv-from">NutriBoost</div>') && page.includes('Avec <span class="ic">WHERE</span>, garde seulement'));
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
  assert.ok(player.includes('if(side&&T.side===side&&now-T.t<330){') && player.includes('lvSkip(side*LV_SKIP); lvDtFx(side,T.total);'), 'double appui à gauche / à droite');
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
  {id: 1, next: 2, titre: 'SELECT', page: 'select.html', thumb: 'select-thumb.jpg', duree: '2 min 23', notesAt: 96.4,
    notes: /notes:\{t:135\.15,y:1405,card:\[64,356,1016,1119\],to:\[940,255\]\}/, table: 'clients',
    bubble: 'Avec <span class="ic">SELECT</span>, choisis seulement les colonnes dont tu as besoin.',
    chapters: ['Situation', 'Le problème', 'Choisir les colonnes', 'Deux pièges', 'Toutes les colonnes', 'Le résultat', 'À retenir'],
    question: ["ctx: 'Cette requête affiche 4 colonnes.'", "q: 'Combien de lignes le résultat contiendra-t-il ?'", "{label: '4 lignes', ok: false}, {label: '10 lignes', ok: true}"],
    traps: ['near "FROM": syntax error', 'SELECT</span> prenom<span class="ghost" id="ghostAS"> <b>AS</b></span> ville', 'la requête équivaut à <code>prenom AS ville</code>', 'il faut la virgule : <code>prenom, ville</code>']},
  {id: 2, next: 13, titre: 'Renommer avec AS', page: 'as.html', thumb: 'as-thumb.jpg', duree: '2 min 11', notesAt: 92.4,
    notes: /notes:\{t:123,y:1365,card:\[64,356,1016,1071\],to:\[940,255\]\}/, table: 'produits',
    bubble: 'Avec <span class="ic">AS</span>, donne à une colonne un nom plus clair dans le résultat.',
    chapters: ['Situation', 'Le problème', 'Renommer une colonne', 'Plusieurs colonnes', 'Le piège des guillemets', 'Le résultat', 'À retenir'],
    question: ["ctx: 'Le dashboard affiche « Prix (€) ».'", "q: 'Dans la table produits, comment s’appelle cette colonne ?'", "{label: 'prix', ok: true}, {label: 'Prix (€)', ok: false}"],
    traps: ['near "du": syntax error', 'near "(": syntax error', '"Nom du produit"']},
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

  test(`${c.titre} : page de l’animation sur le moteur commun, ressources locales, chapitres, question et pièges`, () => {
    const page = fs.readFileSync(path.join(ROOT, 'assets/anim', c.page), 'utf8');
    for (const rel of ['core.css', 'core.js', 'gsap.min.js', 'mascotte.webp'])
      assert.ok(page.includes(rel) && fs.existsSync(path.join(ROOT, 'assets/anim', rel)), `ressource : ${rel}`);
    assert.ok(page.indexOf('src="gsap.min.js"') < page.indexOf('src="core.js"'), 'GSAP chargé avant le moteur');
    assert.ok(!/https?:\/\//.test(page), 'rien de chargé depuis Internet');
    assert.ok(page.includes(`Course({duration: DURATION, chapters: CHAPTERS, captions: CAPTIONS, questions: QUESTIONS, notesAt: ${c.notesAt},`));
    for (const q of c.question) assert.ok(page.includes(q), `question : ${q}`);
    assert.ok(page.includes(c.bubble), 'bulle de la mascotte');
    for (const label of c.chapters) assert.ok(page.includes(`label:'${label}'`), `chapitre ${label}`);
    for (const t of c.traps) assert.ok(page.includes(t), `piège : ${t}`);
    assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page), 'SQL n’est jamais personnifié');
    assert.ok(page.includes(`la <b>table ${c.table}</b>`) && !new RegExp(`dans ${c.table}\\b`).test(page), `toujours « table ${c.table} »`);
  });

  test(`${c.titre} reste léger et disponible hors ligne`, () => {
    let total = 0;
    for (const f of [c.page, 'core.css', 'core.js', 'gsap.min.js', 'mascotte.webp', c.thumb]) total += fs.statSync(path.join(ROOT, 'assets/anim', f)).size;
    total += fs.statSync(path.join(ROOT, 'assets/fonts/jetbrains-mono.woff2')).size;
    assert.ok(total < 450 * 1024, `animation et ressources : ${Math.round(total / 1024)} Ko`);
    for (const f of [`./assets/anim/${c.page}?app&embed`, `./assets/anim/${c.thumb}`]) assert.ok(sw.includes(`'${f}'`), `préchargé : ${f}`);
  });
}

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

test('SELECT sans virgule : le cours texte et le quiz expliquent l’alias (AS facultatif), comme l’animation', () => {
  const sel = cut('guide({ id:1, titre:"SELECT"', 'guide({ id:2,');
  assert.ok(sel.includes('Sans virgule, <code>ville</code> est lu comme un <b>alias</b> : le titre donné à la colonne dans le résultat. Le mot-clé <code>AS</code> étant facultatif, cette requête équivaut à :'));
  assert.ok(sel.includes('{syntax:"SELECT prenom AS ville\\nFROM clients;"}'), 'la requête équivalente avec AS');
  assert.ok(sel.includes('il faut la virgule : <code>SELECT prenom, ville</code>'), 'la correction');
  assert.ok(!/SQL ne comprend pas|Il interprète/.test(sel), 'SQL n’est pas personnifié');
  const qcm = cut('const QCM={', '\n};');
  assert.ok(qcm.includes('Sans virgule, <code>telephone</code> est lu comme un <b>alias</b>') && !qcm.includes('il interprète <code>telephone</code>'), 'explication du quiz alignée');
});
