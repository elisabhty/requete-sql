/* 4 novembre, 14 h 08 (Elisa, trois captures de l’iPhone et une du site) : « Avec Google aussi » (réf. 1, la connexion) ; « Réf 2 :
   mettre plus en avant le cadre des notices, peut-être avec animation » ; « Réf 3 : monter encore le bouton jaune et mettre une flèche
   animée au bouton continuer, commencer, etc. » ; « Faire un écran "Ils apprécient Requête" […] avec les personnes qui parlent sur le
   site internet. Mettre que celle-là (réf. 4), puis dire 10+ profs vous feront progresser. » */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html'), css = read('onboarding-vitrine.css'), sw = read('sw.js'), site = read('decouvrir/index.html');
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };
const lastCut = (a, b) => { const i = app.lastIndexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
const media = (() => {
  const bloc = css.slice(css.indexOf('/* ---------- 3 novembre, 17 h 32'));
  return bloc.slice(bloc.indexOf('@media (prefers-reduced-motion:no-preference){'), bloc.indexOf('@media (prefers-reduced-motion:reduce){'));
})();
const bloc = cut(app, '/* ---------- « Ils apprécient Requête » (Elisa, 4 novembre, 14 h 08) ----------', '/* 14 h 08 (réf. 3) : « mettre une flèche animée');

/* Un petit DOM : assez pour le lecteur (textes, attributs, classes, onde) */
const faux = () => {
  const els = new Map();
  const el = id => {
    if (els.has(id)) return els.get(id);
    const attrs = new Map(), cls = new Set();
    const e = { id, attrs, textContent: '', _html: '', children: [], paused: true, currentTime: 0, duration: NaN, readyState: 0, src: '',
      classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); return cls.has(c); } },
      setAttribute: (k, v) => attrs.set(k, String(v)), getAttribute: k => attrs.has(k) ? attrs.get(k) : null,
      pause() { e.paused = true; }, load() {}, play() { e.paused = false; return Promise.resolve(); }, addEventListener() {} };
    Object.defineProperty(e, 'innerHTML', { get: () => e._html, set: v => { e._html = v; e.children = [...v.matchAll(/<i style="--h:([\d.]+)"><\/i>/g)].map(m => el(`${id}-barre-${m.index}`)); } });
    e.cls = cls;
    els.set(id, e);
    return e;
  };
  const pastilles = [0, 1, 2].map(j => el('pastille-' + j));
  return { el, pastilles, document: { getElementById: el, querySelectorAll: s => s === '#ob-tv .ob-tv-pick button' ? pastilles : [], querySelector: () => null, addEventListener() {} } };
};
const lecteur = (goal, communaute) => {
  const d = faux();
  const ctx = vm.createContext({ draft: { goal }, document: d.document, Image: function () {}, escAttr: s => String(s).replace(/"/g, '&quot;'), obTypo: s => s,
    obNombre: n => Number(n).toLocaleString('fr-FR'), cancelAnimationFrame() {}, requestAnimationFrame() {}, obDemoTimers: [], setTimeout: () => 0, buzz() {}, isFinite });
  vm.runInContext((communaute === undefined ? bloc : bloc.replace('const OB_COMMUNAUTE=1000;', `const OB_COMMUNAUTE=${communaute};`)) + ';this.OB_TEMOINS=OB_TEMOINS;this.OB_FORMATEURS=OB_FORMATEURS;this.obTvLire=()=>obTv;', ctx);
  return { ctx, d };
};

test('réf. 1 : « avec Google aussi » : entre Apple et l’e-mail, « Bientôt » comme les autres', () => {
  assert.ok(app.includes("const OB_PROVIDERS=[['apple','Apple'],['google','Google'],['email','un e-mail']];"));
  const icone = cut(app, 'function obProviderIcon(provider){', '/* 10 h 16 : pas encore de connexion.');
  assert.ok(icone.includes("if(provider==='google')return `<span class=\"ob-provider-icon\" aria-hidden=\"true\"><svg viewBox=\"0 0 24 24\"><path fill=\"#4285F4\""), 'le G en couleurs, déjà dessiné');
  /* Le message du toucher sans connexion : « La connexion avec Google arrive bientôt. » */
  const ctx = vm.createContext({});
  vm.runInContext(cut(app, 'const OB_PROVIDERS=', '/* La pomme en dessin') + ';this.OB_PROVIDERS=OB_PROVIDERS;', ctx);
  const [, label] = ctx.OB_PROVIDERS.find(x => x[0] === 'google');
  assert.equal(label, 'Google');
  assert.ok(app.includes("par=provider==='email'?'par e-mail':label?`avec ${label}`:''"));
  /* Trois boutons : sur un iPhone SE, ils se resserrent au dernier palier ; le blanc par défaut (Apple seul est noir) */
  for (const k of ['html #onboarding.ob-vitrine.ob-fit-5 .ob-account .ob-provider{min-height:42px!important}'])
    assert.ok(css.includes(k), k);
  assert.ok(!css.includes('.ob-provider.is-google{'), 'le bouton blanc des fournisseurs');
});

test('réf. 2 : le cadre de la notification, plus grand, blanc, sur un halo qui respire ; il tombe d’un rebond et « Autoriser » se touche', () => {
  const r = lastCut("}else if(slide==='rappel'){", "}else if(slide==='widget'){");
  /* 6 novembre, 23 h 08 : ses deux boutons se touchent pour de vrai (tests/retours-2308.test.mjs) */
  assert.ok(r.includes('<div class="ob-notif" id="ob-notif"><div class="ob-notif-cadre"><div class="ob-notif-alert">'));
  assert.ok(r.includes('aria-label="Autoriser les rappels">Autoriser</button></span></div></div>\n        <svg class="ob-notif-arrow"'), 'le cadre autour de la fenêtre, la flèche dessous');
  assert.ok(cut(app, 'function obNotifCaler(){', '/* Le widget, tel qu’il est').includes("z.querySelector('.ob-notif-alert')"), 'toujours centrée sur l’écran');
  const s = sansCommentaires(css);
  for (const k of ['html #onboarding.ob-vitrine .ob-rappel-step .ob-notif{width:min(286px,100%);margin-top:18px}',
    'html #onboarding.ob-vitrine .ob-notif-cadre{position:relative;width:100%;isolation:isolate}',
    'html #onboarding.ob-vitrine .ob-notif-cadre::before{content:\'\';position:absolute;inset:-24px -34px;z-index:-1;',
    'html #onboarding.ob-vitrine .ob-rappel-step .ob-notif-alert{background:#F8F8FB;box-shadow:0 0 0 3px #fff,0 0 0 9px rgba(255,216,107,.32),0 24px 50px rgba(20,10,60,.5)}',
    'html #onboarding.ob-vitrine .ob-rappel-step .ob-notif-alert b{padding:17px 16px 0;font-size:16.5px}'])
    assert.ok(s.includes(k), k);
  /* Les animations, seulement avec les mouvements autorisés */
  for (const k of [' .ob-rappel-step .ob-notif-alert{animation:obvNotifTombe .7s var(--v-pop) .2s both}', ' .ob-notif-cadre::before{animation:obvNotifHalo 2.2s ease-in-out .9s infinite}',
    ' .ob-rappel-step .ob-notif-btns .is-ok::after{animation:obvNotifTouche 2.2s ease-out 1.5s infinite}'])
    assert.ok(media.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine' + k), k);
  for (const k of ['@keyframes obvNotifTombe{0%{opacity:0;transform:translateY(-34px) scale(.86) rotate(-2deg)}', '@keyframes obvNotifHalo{', '@keyframes obvNotifTouche{'])
    assert.ok(css.includes(k), k);
  /* Quand la page se resserre, tout reste (11 novembre (6 h 54) : plus rien ne disparaît pour tenir, la page se met à l’échelle (obFit)) : la fenêtre, la flèche et la phrase se font plus petites aux paliers 3 et 4 */
  for (const k of ['html #onboarding.ob-vitrine.ob-fit-2 .ob-rappel-step .ob-notif-arrow{display:block;height:34px;margin-top:4px}',
    'html #onboarding.ob-vitrine.ob-fit-3 .ob-rappel-step .ob-notif{width:min(244px,100%)}', 'html #onboarding.ob-vitrine.ob-fit-4 .ob-rappel-step .ob-notif-arrow{height:28px;margin-top:4px}'])
    assert.ok(s.includes(k), k);
  for (const k of ['.ob-rappel-step .ob-rappel-note{display:none}', '.ob-rappel-step .ob-notif-arrow{display:none}', '.ob-rappel-step .ob-notif{display:none}'])
    assert.ok(!s.includes(k), k);
});

test('réf. 3 : le bouton jaune remonte encore, et chaque bouton jaune a sa flèche animée', () => {
  assert.ok(sansCommentaires(css).includes('html #onboarding.ob-vitrine .ob-foot{padding-bottom:calc(var(--safe-bottom,0px) + clamp(34px,6.6vh,58px))!important}'), '58 px sur un iPhone de 874 pt, 34 px au moins');
  /* obSetFooter pose la flèche après le libellé ; elle avance en boucle et se cache tant que le bouton attend */
  const pied = cut(app, "const OB_CTA_FLECHE='", 'function obRythmeMinutes(rythme){');
  assert.ok(pied.includes('<path d="M4 12h14M13 6l6 6-6 6"/>') && pied.includes("  if(btn){const was=btn.disabled;obCtaLibelle(btn,primary);"));
  const ctx = vm.createContext({});
  vm.runInContext(cut(app, "const OB_CTA_FLECHE='", 'function obSetFooter('), ctx);
  const btn = { textContent: 'ancien', html: '', insertAdjacentHTML(pos, h) { assert.equal(pos, 'beforeend'); this.html += h; } };
  ctx.obCtaLibelle(btn, 'Continuer');
  assert.equal(btn.textContent, 'Continuer'); assert.ok(btn.html.startsWith('<span class="ob-cta-arrow" aria-hidden="true">'), 'lue « Continuer », la flèche est décorative');
  const vide = { textContent: 'x', insertAdjacentHTML() { throw new Error('pas de flèche sans libellé'); } };
  ctx.obCtaLibelle(vide, ''); assert.equal(vide.textContent, '');
  assert.ok(app.includes("  if(cta)obCtaLibelle(cta,`Me rappeler à ${obHeureTexte(v)}`);"), 'changer l’heure du rappel garde la flèche');
  assert.ok(!app.includes("?.insertAdjacentHTML('beforeend','<span class=\"ob-cta-arrow\""), 'une seule flèche par bouton (plus d’ajout à la main sur la construction et le parcours prêt)');
  assert.ok(sansCommentaires(css).includes('html #onboarding.ob-vitrine .ob-cta:disabled .ob-cta-arrow{display:none}'));
  assert.ok(media.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine .ob-cta:not(:disabled) .ob-cta-arrow{animation:obvArrow 1.1s ease-in-out .4s infinite}'));
});

test('« Ils apprécient Requête » : entre le parcours construit et l’engagement (16 h 09 ; la promesse a rejoint les jours à 17 h 27), compté dans les étapes, l’avis s’arrête quand on change d’étape', () => {
  assert.ok(app.includes("const OB_SLIDES = ['bonjour','welcome','questions','name','pays','age','job','goal','level','rhythm','jours','build','methode','temoignages','pact',"));
  assert.ok(app.includes("const OB_PROFILE_SLIDES=['name','pays','age','job','goal','level','rhythm','jours','build','methode','temoignages','pact','practice'];"), '« Étape X sur N » le compte');
  assert.ok(app.includes("  else if(slide==='build')obGoto('methode');\n  else if(slide==='methode')obGoto('temoignages');\n  else if(slide==='temoignages')obGoto('pact');"), 'Suivant, au balayage (la méthode entre les deux depuis le 13 novembre)');
  const s = lastCut("}else if(slide==='goal'){", "}else if(slide==='level'){");
  assert.ok(s.includes("obSetFooter('Continuer',()=>obGoto('level'),'','','',!draft.goal);"), 'l’objectif mène au niveau');
  assert.ok(s.includes('<div class="ob-screen ob-profile ob-temoins">${obFlowHeader(slide)}${obTemoinsTitre()}') && s.includes("obSetFooter('Continuer',()=>obGoto('pact'),'','','');"));
  assert.ok(lastCut("}else if(slide==='build'){", "}else if(slide==='pact'){").includes("obSetFooter('Continuer',()=>obGoto('methode'),'','','',true);") && app.includes("    obSetFooter('Continuer',()=>obGoto('temoignages'),'','','');\n  }else if(slide==='temoignages'){"), 'le parcours construit mène à la méthode (13 novembre), qui mène aux avis');
  const peindre = lastCut('function paintOb(){', '  body.classList.remove(\'out\');');
  assert.ok(peindre.includes("  obDemoTimers.forEach(clearTimeout);obDemoTimers=[];\n  obTemoinsCouper();"), 'en changeant d’étape, l’avis s’arrête');
  assert.ok(app.includes("  if(slide==='temoignages')obTemoinsBrancher();"));
  assert.ok(bloc.includes("document.addEventListener('visibilitychange',()=>{if(document.hidden)obTemoinsCouper();});"), 'et quand l’appli passe en arrière-plan');
  /* L’entonnoir de l’onboarding la compte, à sa place */
  assert.match('temoignages', /^[a-zA-Z]{2,16}$/);
  const sql = read('supabase/migrations/20261104173026_onboarding_entonnoir_sans_promesse.sql');
  assert.ok(sql.includes("('build', 10, 'Parcours construit'), ('temoignages', 11, 'Ils apprécient Requête'), ('pact', 12, 'Engagement')") && sql.includes("('termine', 18, 'Onboarding terminé')"));
  assert.ok(!sql.includes("'promise'"), 'plus de page « 24 jours » dans l’entonnoir');
});

test('les avis : ceux du site, mot pour mot, avec leurs photos et leurs voix ; le premier suit l’objectif choisi', () => {
  /* Le site (decouvrir/index.html) : AVIS (textes, notes) et RECO (photos, voix, ondes) */
  const c = vm.createContext({});
  vm.runInContext(cut(site, 'var AVIS = [', "(function(){\n  var sec=document.getElementById('avis')").replace('var AVIS', 'this.AVIS'), c);
  vm.runInContext(cut(site, 'var RECO = [', "(function(){\n  var ph=document.getElementById('voix')").replace('var RECO', 'this.RECO'), c);
  const { ctx } = lecteur('curious');
  const T = JSON.parse(JSON.stringify(ctx.OB_TEMOINS)), RECO = JSON.parse(JSON.stringify(c.RECO)), AVIS = JSON.parse(JSON.stringify(c.AVIS));
  assert.deepEqual(T.map(t => t.prenom), RECO.map(r => r.prenom), 'les mêmes personnes, dans l’ordre du site');
  for (const t of T) {
    const r = RECO.find(x => x.prenom === t.prenom), a = AVIS.find(x => x.prenom === t.prenom);
    assert.deepEqual([t.info, t.court, t.date, t.duree, t.onde], [r.info, r.court, r.date, r.duree, r.onde], t.prenom);
    assert.deepEqual([t.photo, t.mini, t.audio], ['decouvrir/' + r.photo, 'decouvrir/' + r.mini, 'decouvrir/' + r.audio]);
    assert.equal(t.texte, a.texte, 'le texte de l’avis, mot pour mot'); assert.equal(t.note, a.note);
    for (const f of [t.photo, t.mini, t.audio]) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  }
  /* Sur le site, ce sont de vrais avis, publiés avec l’accord des personnes, et la voix est une voix de synthèse */
  assert.ok(site.includes('N’ajouter ici que de VRAIS avis, avec l’accord de la personne'));
  assert.ok(read('decouvrir/mentions-legales.html').includes('sont lus par une <b>voix de synthèse</b>'));
  assert.ok(bloc.includes('<p class="ob-tv-note">De vrais avis, recueillis sur le site requeteapp.com</p>'), 'la carte dit que ce sont de vrais avis (14 h 50) ; la voix, les mentions légales (15 h 30)');
  /* 15 h 20 : l’ordre du site pour tout le monde (Sofia B. d’abord, Aminata C. en dernier), quel que soit l’objectif */
  const ordre = g => [...lecteur(g).ctx.obTemoinsListe()].map(t => t.prenom);
  /* 12 novembre (réf. 1, « ne mets que cette personne, pas les autres ») : Sofia B. seule ; les trois restent recopiés du site */
  for (const g of ['career', 'interview', 'work', 'advanced', 'curious', undefined]) assert.deepEqual(ordre(g), ['Sofia B.'], String(g));
  /* Embarqués dans l’app iPhone (www/) ; sur le web, le service worker les range au passage (decouvrir/, réseau d’abord) */
  assert.ok(read('scripts/build-www.mjs').includes("for (const f of ['decouvrir/video.html', 'decouvrir/mascotte.webp', 'decouvrir/voix', 'decouvrir/avis'])"));
  assert.ok(sw.includes("if (url.pathname.includes('/decouvrir/')) {"));
});

test('la carte : la photo, les pastilles, la lecture et l’onde ; puis « 8 formateurs te feront progresser »', () => {
  const { ctx } = lecteur('career');
  const seul = ctx.obTemoinsHtml();
  assert.ok(!seul.includes('ob-tv-pick') && !seul.includes('ob-tv-nav') && seul.includes('id="ob-tv-play"'), '12 novembre : un seul avis, ni pastilles ni flèches');
  /* La mécanique à plusieurs avis reste (si l’on en remet) : on la vérifie avec les trois */
  ctx.obTemoinsListe = () => ctx.OB_TEMOINS.slice();
  const html = ctx.obTemoinsHtml();
  assert.ok(!html.includes('ob-tv-stat') && !html.includes('ob-tv-badge'), 'le chiffre est dans le titre (obTemoinsTitre, 16 h 09)');
  assert.ok(html.includes('<img class="ob-tv-img" id="ob-tv-img" src="decouvrir/avis/sofia-b.webp" width="640" height="640" alt="Sofia B., Data Analyst junior" draggable="false">'), 'même après « Me reconvertir »');
  assert.deepEqual([...html.matchAll(/aria-label="(Témoignage [^"]+)" onclick="obTemoinsChoisir\((\d)\)"><img src="([^"]+)"/g)].map(m => [m[1], +m[2], m[3]]),
    [['Témoignage de Sofia B.', 0, 'decouvrir/avis/sofia-b-mini.webp'], ['Témoignage de Thomas L.', 1, 'decouvrir/avis/thomas-l-mini.webp'], ['Témoignage d’Aminata C.', 2, 'decouvrir/avis/aminata-c-mini.webp']]);
  for (const k of ['<button type="button" class="ob-tv-nav" id="ob-tv-prev" onclick="obTemoinsPasser(-1)">', '<button type="button" class="ob-tv-play" id="ob-tv-play" aria-pressed="false" aria-describedby="ob-tv-tx" onclick="obTemoinsLire()">',
    '<button type="button" class="ob-tv-nav" id="ob-tv-next" onclick="obTemoinsPasser(1)">', '<div class="ob-tv-wave" id="ob-tv-wave" role="slider" tabindex="0" aria-valuemin="0"></div>',
    '<audio id="ob-tv-audio" preload="none"></audio>', '<p class="ob-sr" id="ob-tv-tx"></p>'])
    assert.ok(html.includes(k), k);
  assert.ok(!/Ils recommandent/.test(html), 'la barre ne redit pas le titre : la note et la date à la place');
  /* Les formateurs : huit, comme sur le site (5 novembre, 0 h 38 : Anaïs remplace Arthur, Miya, Emily, Coralie et Sam) ; quatre visages et « +4 » */
  assert.equal(ctx.OB_FORMATEURS.length, 8);
  for (const [f] of ctx.OB_FORMATEURS) { assert.ok(fs.existsSync(path.join(ROOT, `assets/anim/${f}.webp`)), f); assert.ok(sw.includes(`'./assets/anim/${f}.webp',`), f + ' hors ligne'); }
  assert.ok(site.includes('8 formateurs <em>pour t’accompagner jusqu’au bout</em>'), 'le site en annonce huit, comme l’appli');
  assert.equal((html.match(/<img src="assets\/anim\/[a-z-]+\.webp" width="420" height="420" alt=""/g) || []).length, 4);
  assert.ok(html.includes('<b style="--i:4">+4</b></span><p><b>8 formateurs</b> te feront progresser</p></div>'));
  /* Un chiffre vérifié s’affiche en badge, à la place du titre (14 h 50 : « vrai chiffre, 1000+ » ; 16 h 09 : le badge) */
  assert.ok(bloc.includes('const OB_COMMUNAUTE=1000;'));
  assert.ok(ctx.obTemoinsTitre().includes('<b><i data-n="1000">1\u202f000</i>+</b><span>personnes apprécient Requête</span>'));
  assert.equal(lecteur('career', null).ctx.obTemoinsTitre(), '<h1 class="ob-title" id="ob-title">Ils <em>apprécient</em> Requête</h1>', 'sans chiffre vérifié');
});

test('le lecteur : le nom, le métier, la note et la date ; écouter, passer d’un avis à l’autre, l’onde qui avance', () => {
  const { ctx, d } = lecteur('work');
  ctx.obTemoinsListe = () => ctx.OB_TEMOINS.slice();   // la mécanique à plusieurs avis (l’appli n’en montre qu’un depuis le 12 novembre)
  ctx.obTemoinsHtml();
  ctx.obTemoinsMontrer(0);
  const t = id => d.el(id).textContent, a = (id, k) => d.el(id).getAttribute(k);
  assert.deepEqual([t('ob-tv-nom'), t('ob-tv-info'), t('ob-tv-date'), t('ob-tv-stars')], ['Sofia B.', 'Data Analyst junior', 'septembre 2026', '★★★★★']);
  assert.equal(a('ob-tv-stars', 'aria-label'), '5 étoiles sur 5');
  assert.equal(a('ob-tv-audio', 'src'), 'decouvrir/avis/sofia-b.mp3');
  assert.equal(a('ob-tv-play', 'aria-label'), 'Écouter l’avis de Sofia B.');
  assert.ok(t('ob-tv-tx').startsWith('Avis de Sofia B., Data Analyst junior, septembre 2026 : « J’ai décroché mon premier poste') && t('ob-tv-tx').endsWith('» Un vrai avis, recueilli sur le site requeteapp.com.'), 'le texte pour un lecteur d’écran');
  assert.equal(d.el('ob-tv-wave').children.length, 48, 'les 48 barres de l’onde');
  assert.deepEqual([a('ob-tv-prev', 'aria-label'), a('ob-tv-next', 'aria-label')], ['Témoignage précédent : Aminata C.', 'Témoignage suivant : Thomas L.']);
  assert.deepEqual(d.pastilles.map(p => p.getAttribute('aria-pressed')), ['true', 'false', 'false']);
  /* Pendant l’écoute : la carte s’allume, les barres lues passent en menthe, celle du moment palpite */
  const au = d.el('ob-tv-audio');
  au.paused = false; au.currentTime = 7.4; au.duration = 14.8;
  ctx.obTemoinsEtat(true); ctx.obTemoinsPeindre();
  const barres = d.el('ob-tv-wave').children;
  assert.equal(barres.filter(b => b.cls.has('on')).length, 24); assert.ok(barres[24].cls.has('cur'));
  assert.ok(d.el('ob-tv').cls.has('is-lecture')); assert.equal(a('ob-tv-play', 'aria-label'), 'Mettre en pause l’avis de Sofia B.');
  assert.equal(a('ob-tv-wave', 'aria-valuetext'), '0:07 sur 0:14');
  /* Toucher la pastille de l’avis en cours ne l’arrête pas ; une autre, si */
  ctx.obTemoinsChoisir(0); assert.equal(au.paused, false);
  ctx.obTemoinsChoisir(2); assert.equal(au.paused, true);
  assert.deepEqual([t('ob-tv-nom'), t('ob-tv-info')], ['Aminata C.', 'Reconversion data'], 'le métier court tient dans la barre');
  assert.equal(a('ob-tv-play', 'aria-label'), 'Écouter l’avis d’Aminata C.');
  assert.ok(!d.el('ob-tv').cls.has('is-lecture'));
  /* Les flèches font le tour */
  ctx.obTemoinsPasser(1); assert.equal(t('ob-tv-nom'), 'Sofia B.', 'après la dernière, la première');
  ctx.obTemoinsPasser(-1); assert.equal(t('ob-tv-nom'), 'Aminata C.');
  /* En changeant d’étape : l’avis s’arrête */
  au.paused = false; ctx.obTemoinsCouper(); assert.equal(au.paused, true);
  /* Les gestes sur la carte ne changent pas d’étape ; balayer la photo change d’avis */
  const b = cut(bloc, 'function obTemoinsBrancher(){', "if(typeof document!=='undefined')document.addEventListener('visibilitychange'");
  assert.ok(b.includes("ph.addEventListener('pointerdown',e=>{e.stopPropagation();") && b.includes('obTemoinsPasser(dx<0?1:-1);'));
  assert.ok(b.includes("au.addEventListener('ended',()=>{au.currentTime=0;obTemoinsEtat(false);obTemoinsPeindre();obTemoinsSession(false);if(t.liste.length>1)obTemoinsMontrer(t.i+1);});"), 'à la fin, l’avis suivant s’affiche sans se lancer (et la session audio d’avant revient, 12 novembre)');
});

test('le style : la carte du site, qui prend la hauteur qui reste ; ses animations avec les mouvements autorisés', () => {
  const s = sansCommentaires(css);
  for (const k of ['html #onboarding.ob-vitrine .ob-screen.ob-temoins{min-height:100%}', 'html #onboarding.ob-vitrine .ob-tv{flex:1 1 auto;display:flex;flex-direction:column;justify-content:center;margin-top:18px}',
    'html #onboarding.ob-vitrine .ob-tv-ph{position:relative;flex:1 1 auto;min-height:230px;max-height:470px;overflow:hidden;container-type:inline-size;border:5px solid #fff;border-radius:30px;',
    'html #onboarding.ob-vitrine .ob-tv.is-lecture .ob-tv-ph{box-shadow:0 0 0 5px var(--v-sun-hi),', 'html #onboarding.ob-vitrine .ob-tv-img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;object-position:50% 24%;',
    'html #onboarding.ob-vitrine .ob-tv-wave i.on{background:var(--v-mint)}', 'html #onboarding.ob-vitrine .ob-tv-who b{flex:none;font:800 14px/1.1 var(--v-display);letter-spacing:-.01em;color:#fff}',
    '@container (max-width:329px){html #onboarding.ob-vitrine .ob-tv-nav{display:none}}',
    'html #onboarding.ob-vitrine .ob-tv-profs p b{display:block;font:800 17px/1.15 var(--v-display);letter-spacing:-.01em;white-space:nowrap;color:var(--v-accent-ink)}'])
    assert.ok(s.includes(k), k);
  for (const k of ['.ob-enter .ob-tv-ph{animation:obvTvIn .6s var(--v-pop) .08s backwards}', '.ob-enter .ob-tv-faces>*{animation:obvTvFace .42s var(--v-pop) calc(.74s + var(--i,0) * 70ms) backwards}',
    ' .ob-tv:not(.is-lecture) .ob-tv-play::after{animation:obvTvRing 2.4s ease-out 1.4s infinite}', ' .ob-tv-wave i.cur{animation:obvTvCur .45s ease-in-out infinite alternate}'])
    assert.ok(media.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine' + k), k);
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=63">') && sw.includes("'./onboarding-vitrine.css?v=63',"), 'feuille rechargée');
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  assert.ok(app.includes(`const SW_CACHE='${cache}';`) && Number((cache.match(/-v(\d+)$/) || [])[1]) >= 2501, cache);
});
