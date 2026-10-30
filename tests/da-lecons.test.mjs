/* La page d’un cours et ses vidéos dans la DA de la vitrine (Elisa, 30 octobre, 21 h 33) :
   « ici tu peux améliorer la page, la passer à un niveau supérieur : sticker, animation, etc., DA du site » (la page du cours)
   et « pareil, les vidéos peuvent avoir la DA du site ? (couleurs, etc.) » (le lecteur et les 67 cours animés). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = lire('index.html'), lq = lire('ludique.css'), core = lire('assets/anim/core.css');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i + a.length); assert.ok(j > i, b); return html.slice(i, j); };
const bloc = (src, debut) => { const i = src.indexOf(debut); assert.ok(i >= 0, debut); return src.slice(i); };

test('page du cours : la carte violette de l’accueil, pastille du module, titre jaune, vignette collée dessus', () => {
  const slide = cut('function lessonVideoSlide(l){', 'function openLessonVideo(fin){');
  assert.ok(slide.includes('<div class="lesson-rich lv-lesson lv-hero">'), 'la carte du cours');
  assert.ok(slide.includes("<div class=\"l-kicker\"><b>${mi>=0?`Module ${mi+1}`:'Cours'}</b>${m?`<span class=\"l-kicker-mod\">${m.titre}</span>`:''}</div><h1>${l.titre}</h1>"), 'pastille du module, comme sur l’accueil');
  const css = bloc(lq, '/* ---------- 34. Cours en vidéo');
  assert.match(css, /html\.lq #scr-lesson \.lv-hero\{[^}]*background:var\(--deep\);[^}]*animation:lvHeroIn \.5s [^}]*backwards\}/, 'violet profond ; entrée sans état final gardé');
  assert.match(css, /html\.lq #scr-lesson \.lv-hero>h1\{[^}]*color:var\(--sun-hi\)!important/, 'titre jaune soleil');
  assert.match(css, /html\.lq #scr-lesson \.lv-hero \.l-kicker b\{[^}]*background:var\(--mint\)/, 'rubrique menthe');
  /* La vignette : un autocollant à bord blanc, au format de l’affiche du cours (Elisa, 30 octobre, 22 h 58 : plus de fond lilas autour),
     qui ne bouge que par sa position ; l’image est découpée à la carte violette de l’affiche */
  const carte = css.match(/html\.lq #scr-lesson \.lv-hero \.lv-card\{([^}]*)\}/)[1];
  assert.ok(carte.includes('aspect-ratio:640/886') && carte.includes('max(160px,') && carte.includes('* .722') && carte.includes('var(--lv-fit,9999px)') && carte.includes('min-height:0;overflow:visible;border:4px solid #fff'), 'format de l’affiche, jamais sous 160 px, bord blanc');
  assert.ok(css.includes('clip-path:inset(1.478% 5.556% 4.963% 5.556% round 22px)') && css.includes('left:-6.25%;top:-1.58%;width:112.5%;height:auto'), 'l’image sans ses marges lilas');
  assert.ok(!carte.includes('#EEEBFA'), 'plus de fond lilas');
  assert.ok(!/\.lv-hero \.lv-card(:active)?\{[^}]*transform/.test(css), 'aucune transformation sur la vignette (Safari)');
  assert.match(css, /\.lv-hero \.lv-card:active\{top:4px;/, 'elle s’enfonce par sa position');
  assert.match(css, /\.lv-hero \.lv-card-play\{[^}]*background:var\(--sun\)/, '▶ jaune');
  assert.match(css, /\.lv-hero \.lv-card-play::after\{[^}]*animation:lvPlayPing 2\.4s/, 'qui respire');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\s*html\.lq #scr-lesson \.lv-hero,[^}]*\.lv-prize\{animation:none!important\}/, 'mouvement réduit respecté');
  /* La vignette se remesure quand la vidéo se referme (l’écran du cours redevient visible) */
  assert.ok(cut('function lvCardSync(id){', 'function lvCardFit(){').includes('requestAnimationFrame(lvCardFit);'));
});

test('page du cours : la carte mémo à gagner, collée dans le coin de la vignette (cadenas, puis son mot-clé une fois gagnée)', () => {
  const src = cut('function lvPrizeHtml(l){', '/* La vignette du cours.');
  const ctx = vm.createContext({CARTES: {0: {k: 'Modèle relationnel'}, 4: {k: 'WHERE'}}, allLessons: [{id: 0}, {id: 2}, {id: 4}], MEMO_LOCK: '<svg/>',
    esc: s => s, won: false});
  vm.runInContext(src + ';this.prize=lvPrizeHtml;this.isUnlocked=()=>this.won;', ctx);
  vm.runInContext('isUnlocked=this.isUnlocked;', ctx);
  let h = ctx.prize({id: 4});
  assert.equal(h, '<span class="lv-prize" aria-hidden="true"><span class="lv-prize-c"><b>02</b><i><svg/></i></span><span class="lv-prize-t">Carte à gagner</span></span>', 'numéro dans la collection, cadenas');
  ctx.won = true;
  h = ctx.prize({id: 4});
  assert.ok(h.includes('class="lv-prize is-won"') && h.includes('<em>WHERE</em>') && h.includes('Carte gagnée'), 'gagnée : son mot-clé');
  assert.equal(ctx.prize({id: 2}), '', 'sans carte mémo, rien');
  assert.ok(html.includes('<img src="${v.thumb||v.poster}" alt="" decoding="async">${lvPrizeHtml(l)}'), 'dans la vignette, décor seulement');
  const css = bloc(lq, '/* ---------- 34. Cours en vidéo');
  assert.match(css, /html\.lq #scr-lesson \.lv-prize\{[^}]*pointer-events:none;rotate:9deg;animation:lvPrizeF 4\.8s/, 'penchée, elle flotte');
});

test('vidéos : le lecteur peint le violet de la vitrine, ses boutons sont blancs, le ▶ jaune, la barre d’état claire', () => {
  const css = bloc(lq, '/* ---------- 35. Lecteur des cours en vidéo');
  assert.ok(css.includes('html.lq .lv{background:linear-gradient(170deg,#6E50F6 0%,#5538E6 48%,#4529CC 100%)}'));
  assert.match(css, /html\.lq \.lv::before\{content:"";position:absolute;inset:0;pointer-events:none;/, 'quadrillage et lueurs sous l’image et les commandes');
  assert.match(css, /html\.lq \.lv-c\.lv-pp\{background:var\(--sun\);color:#1B1640/, 'lecture / pause en jaune');
  assert.match(css, /html\.lq \.lv-big\{background:var\(--sun\)/);
  assert.match(css, /html\.lq \.lv-fill\{background:#fff\}/, 'barre blanche : les points dorés des moments restent lisibles');
  assert.match(css, /html\.lq \.lv-note-arrow path\{stroke:#fff\}/, 'la flèche des notes se voit sur le violet');
  assert.ok(cut('function openLessonVideo(fin){', 'function lvPlay(){').includes("if(typeof obBarreEtat==='function')obBarreEtat(true);"), 'texte clair dans la barre d’état');
  assert.ok(cut('function closeLessonVideo(instant){', 'function ').includes("if(typeof obBarreEtat==='function')obBarreEtat(false);"), '… rendu à la fermeture');
});

test('vidéos : chaque cours animé a le fond violet, ses cartes bordées de blanc, et rien ne se perd sur le fond', () => {
  const v = bloc(core, '/* ---------- Couleurs de la vitrine ----------');
  assert.ok(v.includes('#stage{background:var(--fond)}') && v.includes('html.embed #stage::before{content:none}'), 'fond violet ; dans le lecteur, c’est lui qui le peint');
  assert.ok(core.includes('html.embed #stage{position:absolute;left:0;top:0;transform-origin:0 0;background:transparent}'), 'la scène reste transparente dans le lecteur');
  for (const r of ['#chapter .chip{border-color:#fff;', '#cap{border-color:#fff;', '.card{border-color:#fff;', '.rtitle{color:#fff}', '#s0.nv .iv-card{box-shadow:0 0 0 10px #fff,',
    '#s0.nv .iv-spark.s3{color:#fff}', '.sqlrow .lbl,.sqlrow .arw{color:rgba(255,255,255,.82)}', 'svg.lk,.lks,svg.ar{filter:drop-shadow(0 0 2.5px rgba(255,255,255,.95))}'])
    assert.ok(v.includes(r), r);
  /* Les textes et traits posés directement sur le fond, relevés image par image dans les 67 cours, passent en clair */
  const pages = ['bases-relationnelles', 'where', 'group-by', 'group-concat', 'having', 'limit-offset', 'projet-concurrence', 'projet-create', 'projet-uml', 'projet-droits', 'projet-ondelete', 'quel-join-choisir'];
  for (const p of pages) assert.ok(lire(`assets/anim/${p}.html`).includes('/* Fond violet de la vitrine (core.css, « Couleurs de la vitrine », Elisa, 30 octobre)'), p);
  const uml = lire('assets/anim/projet-uml.html');
  assert.ok(uml.includes(".lns line{stroke:rgba(255,255,255,.9)}") && uml.includes("const glow = (id, t) => tl.to(id, {stroke: '#FFD86B', strokeWidth: 9,"), 'UML : traits blancs, surlignés en jaune');
  /* Tous les cours chargent ce même habillage */
  const anims = fs.readdirSync(path.join(root, 'assets/anim')).filter(f => f.endsWith('.html'));
  assert.ok(anims.length >= 60);
  for (const f of anims) {
    const page = lire(`assets/anim/${f}`);
    /* WHERE a son propre moteur et sa copie de l’habillage : elle reprend le même bloc */
    assert.ok(page.includes('<link rel="stylesheet" href="core.css">') || (f === 'where.html' && page.includes(v.split('\n').slice(0, 12).join('\n'))), f);
  }
});
