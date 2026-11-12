/* Elisa, 12 novembre, 12 h 24 (cinq captures de la version TestFlight) :
   « Le chat bug il apparaît puis pas » (l’ouverture) ; réf. 1, les textes de « bonjour » ; réf. 2, « les espaces sont horribles
   sur l’écran de connexion, remplis stp » ; « Toujours les traces violettes d’autre page » ; « Choisis ton pseudo, la page part
   loin aussi en haut » (puis, à la question posée : « Le haut de la page d’abord ») ; « pas de texte notifié noir » ; « les chats
   aussi ont des problèmes à l’onboarding, des flashs » ; « Pour le prénom, fais en sorte de récupérer l’info. Regarde comment la
   page part en haut… » ; et ses textes pour la carte du pays. */
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const lire = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const app = lire('index.html'), ob = lire('onboarding-vitrine.css'), lq = lire('ludique.css'), cap = JSON.parse(lire('capacitor.config.json'));
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('l’ouverture : le chat en grilles de 4 × 3, décodé avant de partir et gardé jusqu’au rangement', () => {
  const intro = cut('(function(){\n  var d=document.documentElement,L=document.getElementById(\'loader\')', '})();\n  </script>');
  assert.ok(intro.includes("var CHAT_IMG=['assets/ouverture-chat-marche-grille.webp','assets/ouverture-chat-appui-grille.webp'],chatPret=0,chatFini=0,garde=[];"));
  assert.ok(intro.includes('garde.push(im);') && intro.includes('if(im.decode)im.decode().then(pret,pret);'), 'décodé, gardé');
  assert.ok(intro.includes("var ranger=function(){L.style.display='none';garde.length=0;};"), 'rendu une fois rangé');
  assert.ok(lq.includes('html.is-native.lq #loader.is-intro :is(.in-chat-m,.in-chat-a)>b{position:absolute;left:0;top:0;width:400%;height:300%;'));
  assert.ok(!/ouverture-chat-(marche|appui)\.webp/.test(app + lq), 'plus de bandes nulle part');
});

test('la vue de l’appli ne défile plus (iOS) : ce qui défile dans la page défile toujours', () => {
  assert.equal(cap.ios.scrollEnabled, false, 'capacitor.config.json');
  const natif = cut('(function(){\n  var C=window.Capacitor;\n  if(!C||!C.isNativePlatform||!C.isNativePlatform())return;', '  var H=P.Haptics;');
  assert.ok(natif.includes("var kbScroll=P.Keyboard&&P.Keyboard.setScroll&&P.Keyboard.setScroll({isDisabled:true});if(kbScroll&&kbScroll.catch)kbScroll.catch(function(){});"));
});

test('le clavier ouvert sur un champ : ob-clavier ; la phrase s’efface, le pied se pose sur le clavier', () => {
  const src = cut('if(typeof window!==\'undefined\'&&typeof document!==\'undefined\'){\n  let obTailleH=-1', '/* Même capture :');
  const wl = {}, dl = {}, timers = [];
  const cls = new Set(), racine = { classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => c === 'on' || cls.has(c) } };
  const corps = { contains: t => !!t.dedans };
  const ctx = vm.createContext({
    window: { addEventListener: (n, f) => { (wl[n] = wl[n] || []).push(f); } },
    document: { readyState: 'complete', getElementById: id => (id === 'onboarding' ? racine : id === 'ob-body' ? corps : null), addEventListener: (n, f) => { (dl[n] = dl[n] || []).push(f); } },
    setTimeout: (f, ms) => { timers.push([f, ms]); return timers.length; }, clearTimeout: id => { if (timers[id - 1]) timers[id - 1][0] = () => {}; },
    obFit: () => {}, matchMedia: q => ({ matches: q === '(pointer:coarse)' })
  });
  vm.runInContext(src, ctx);
  const ev = (n, t) => (dl[n] || []).forEach(f => f({ target: t }));
  ev('focusin', { tagName: 'INPUT', type: 'text', dedans: true });
  assert.ok(cls.has('ob-clavier'), 'un champ de la page : le mode clavier');
  ev('focusout', { tagName: 'INPUT', type: 'text', dedans: true });
  ev('focusin', { tagName: 'INPUT', type: 'text', dedans: true });
  timers.filter(t => t[1] === 60).forEach(t => t[0]());
  assert.ok(cls.has('ob-clavier'), 'd’un champ à l’autre : il reste');
  ev('focusout', { tagName: 'INPUT', type: 'text', dedans: true });
  timers.filter(t => t[1] === 60).forEach(t => t[0]());
  assert.ok(!cls.has('ob-clavier'), 'le champ quitté : il s’en va');
  ev('focusin', { tagName: 'INPUT', type: 'checkbox', dedans: true }); ev('focusin', { tagName: 'INPUT', type: 'text', dedans: false });
  assert.ok(!cls.has('ob-clavier'), 'une case à cocher, ou un champ hors de l’onboarding : rien');
  ev('focusin', { tagName: 'INPUT', type: 'text', dedans: true }); wl.keyboardWillHide.forEach(f => f());
  timers.filter(t => t[1] === 60).forEach(t => t[0]());
  assert.ok(!cls.has('ob-clavier'), 'le clavier qui part l’emporte');
  for (const r of ['html #onboarding.ob-vitrine.ob-clavier .ob-foot{padding-bottom:10px!important}',
    'html #onboarding.ob-vitrine.ob-clavier :is(.ob-name,.ob-pseudo)>.ob-lead{display:none!important}',
    'html #onboarding.ob-vitrine.ob-clavier :is(.ob-name,.ob-pseudo)>.ob-chat{margin:6px 0 8px!important}',
    'html #onboarding.ob-vitrine.ob-clavier .ob-name-preview{display:none!important}'])
    assert.ok(ob.includes(r), r);
});

test('le prénom clavier ouvert : la bulle répond à la place de la carte, sans changer de taille', () => {
  const ctx = vm.createContext({ esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;') });
  vm.runInContext(cut('function obTypo(s){', '\n') + '\n' + cut('function obPrenomReponse(n){', 'function obNamePreview(){'), ctx);
  assert.equal(ctx.obPrenomReponse(' Elisa '), 'Enchantée, <em>Elisa</em>&nbsp;! J’ai hâte d’en savoir plus sur toi.');
  assert.equal(ctx.obPrenomReponse(''), 'Enchantée, <em>Léa</em>&nbsp;! J’ai hâte d’en savoir plus sur toi.', 'sans prénom : la place d’un prénom courant');
  assert.equal(ctx.obPrenomBulle('<b>'), '<span class="ob-bulle-q">Salut ! Comment dois-je t’appeler ?</span><span class="ob-bulle-r" aria-hidden="true">Enchantée, <em>&lt;b></em>&nbsp;! J’ai hâte d’en savoir plus sur toi.</span>');
  const prev = cut('function obNamePreview(){', '/* L\'accueil tape');
  assert.ok(prev.includes("if(ecran){ecran.classList.toggle('has-prenom',!!n);const r=ecran.querySelector('.ob-bulle-r');if(r)r.innerHTML=obPrenomReponse(n);}"));
  for (const r of ['html #onboarding.ob-vitrine .ob-bubble.ob-bulle-duo{display:grid!important}', 'html #onboarding.ob-vitrine .ob-bulle-duo>span{grid-area:1/1;min-width:0}',
    'html #onboarding.ob-vitrine:not(.ob-clavier) .ob-bulle-duo>.ob-bulle-r{display:none}', 'html #onboarding.ob-vitrine.ob-clavier .ob-name.has-prenom .ob-bulle-q{visibility:hidden}'])
    assert.ok(ob.includes(r), r);
});

test('la page commence sous la barre d’état : rien de ce qui défile ne passe sous l’heure', () => {
  assert.ok(app.includes('  #onboarding .ob-slides{margin-top:var(--safe-top)}\n  #onboarding #ob-body{width:100%;height:100%;padding:20px 24px 12px;overflow-y:auto;overscroll-behavior:contain}'));
  assert.ok(app.includes('  #onboarding.ob-profile-step #ob-body{padding-top:12px}') && app.includes('  #onboarding.ob-account-step #ob-body{padding-top:10px}'));
  assert.ok(!/#ob-body\{[^}]*safe-top/.test(app), 'plus de zone sûre dans la page qui défile');
  assert.ok(cut('function obFit(){', '\n}\n').includes('const H=root.clientHeight-Math.max(0,Math.round(body.getBoundingClientRect().top-root.getBoundingClientRect().top))'));
});

test('les traces de la page d’avant : tout l’onboarding est repeint après chaque page et chaque échelle', () => {
  const frames = [], props = {};
  const ctx = vm.createContext({ document: { getElementById: () => ({ style: { setProperty: (k, v) => { props[k] = v; } } }) },
    requestAnimationFrame: f => { frames.push(f); return frames.length; }, cancelAnimationFrame: () => {} });
  vm.runInContext(cut('let obRpN=0,obRpT=0;', 'function paintOb(){'), ctx);
  ctx.obRepeindre(); frames.shift()(); assert.equal(props['--ob-rp'], undefined, 'pas à la première image');
  frames.shift()(); assert.equal(props['--ob-rp'], '1', 'à la deuxième');
  ctx.obRepeindre(); frames.shift()(); frames.shift()(); assert.equal(props['--ob-rp'], '0', 'et ainsi de suite');
  assert.ok(app.includes("  obInsecables(body);\n  /* 12 novembre (réf. 8") && app.includes("  obRepeindre();\n  body.scrollTop=0;\n  obFitSoon();"));
  assert.ok(!app.includes("body.style.display='none';void body.offsetHeight"), 'plus de page refaite d’un bloc');
  assert.ok(cut('function obFit(){', '\n}\n').includes("if(root.style.getPropertyValue('--obz')!==v){root.style.setProperty('--obz',v);if(typeof obRepeindre==='function')obRepeindre();}"));
  assert.ok(ob.includes('html:root #onboarding.ob-vitrine{background-position:0 calc(var(--ob-rp,0) * .01px)!important}'));
  assert.ok(ob.includes('html #onboarding.ob-vitrine #ob-body{background-color:rgba(69,41,204,calc(var(--ob-rp,0) * .004))}'));
});

test('les chats de l’onboarding chargés et décodés d’avance, gardés jusqu’à la fin', () => {
  const ims = [], timers = [];
  const ctx = vm.createContext({ Image: class { constructor() { ims.push(this); } decode() { this.decode_ = 1; return { catch() {} }; } },
    mascotReduced: () => false, setTimeout: (f, ms) => timers.push([f, ms]) });
  vm.runInContext(cut('const OB_CHATS=[];', 'function startOnboarding(initial='), ctx);
  ctx.obChatsPrecharger(); timers.forEach(t => t[0]());
  assert.deepEqual(ims.map(i => i.src), ['coucou', 'parti', 'question', 'oui', 'cle', 'pseudo', 'ordi', 'presente', 'reveil', 'bravo'].map(n => `assets/chat-${n}.webp`));
  assert.ok(ims.every(i => i.decode_), 'décodés');
  assert.deepEqual(timers.map(t => t[1]), [0, 90, 180, 270, 360, 450, 540, 630, 720, 810], 'l’un après l’autre');
  ctx.obChatsPrecharger(); assert.equal(ims.length, 10, 'une seule fois');
  for (const n of ['coucou', 'parti', 'question', 'oui', 'cle', 'pseudo', 'ordi', 'presente', 'reveil', 'bravo'])
    assert.ok(fs.existsSync(new URL(`../assets/chat-${n}.webp`, import.meta.url)) && fs.existsSync(new URL(`../assets/chat-${n}-fixe.webp`, import.meta.url)), n);
  assert.ok(app.includes("function startOnboarding(initial='welcome'){\n  obChatsPrecharger();"));
  assert.ok(app.includes('function obTerminer(action){\n  OB_CHATS.length=0;'));
});

test('« bonjour » : ses nouveaux textes ; plus de bandeau noir après la connexion ni à la reprise', () => {
  const b = cut("}else if(slide==='bonjour'){", "}else if(slide==='questions'){");
  assert.ok(b.includes("${obTypo('Coucou ! On explore le monde des données ?')}") && b.includes("${obTypo('Apprends en pratiquant, progresse en t’amusant.')}"));
  assert.ok(!app.includes('Ton compte est prêt. Quelques questions') && !app.includes("'On reprend là où tu en étais.'"));
});

test('la connexion remplie : ce que le compte garde vraiment, et les fournisseurs branchés', () => {
  const ctx = vm.createContext({ OB_PROVIDERS: [['apple', 'Apple'], ['google', 'Google'], ['email', 'un e-mail']], esc: s => String(s), window: {} });
  vm.runInContext(cut('function obFournisseurOk(f){', '\n') + '\n' + cut('function obCompteAtoutsHTML(){', 'function obCompteCarteHTML(){'), ctx);
  const h = ctx.obCompteAtoutsHTML();
  assert.equal((h.match(/<li /g) || []).length, 3);
  for (const t of ['Tes leçons et tes défis', 'Gardés, même si tu changes de téléphone', 'Tes notes et ton planning', 'Synchronisés automatiquement', 'Sans mot de passe', 'Un geste avec Apple ou Google'])
    assert.ok(h.includes(t), t);
  ctx.window.REQUETE_AUTH = { fournisseurs: ['apple'] };
  assert.ok(ctx.obCompteAtoutsHTML().includes('Un geste avec Apple<'), 'Apple seul');
  assert.ok(app.includes("      ${masquee||reussie?'':obCompteAtoutsHTML()}\n      ${masquee?'':`<div class=\"ob-provider-list\">"));
  /* ce qu’elle promet existe : la synchro emporte leçons, défis, jours de série, planning et notes, quelques secondes après un changement */
  const ext = cut('function csExtraire(){', '\n}\n');
  assert.ok(ext.includes('extractProgression({lessons,defis,entretien,actDays}') && ext.includes("key:'planning:main'") && ext.includes('extractSavedNotes('));
  assert.ok(app.includes('clearTimeout(CS.t);CS.t=setTimeout(()=>{csSync();},5000);'));
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-account.is-grand{--stk0:104px}'));
});

test('le pays : sa carte, le chat assis dessus qui hoche la tête quand le drapeau se pose', () => {
  const p = cut("}else if(slide==='pays'){", "}else if(slide==='age'){");
  assert.ok(p.includes('<div class="ob-pays-carte is-v2${code?\' is-on\':\'\'}${cherche?\' is-cherche\':\'\'}${pop?\' is-trouve\':\'\'}">${chat}'));
  assert.ok(!p.includes('obMascotDit('), 'plus de bulle');
  const jouer = cut('function obPaysJouer(){', 'function obPaysListe(){');
  assert.ok(jouer.includes("chat.src='assets/chat-oui.webp';chat.width=294;chat.height=351;chat.classList.add('is-oui');"));
  for (const r of ['html #onboarding.ob-vitrine .ob-pays-carte.is-v2::before{display:none}', 'html #onboarding.ob-vitrine .ob-pays-msg::before{content:\'\';float:right;width:64px;height:20px}'])
    assert.ok(ob.includes(r), r);
});
