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
  /* 13 h 33 (Elisa, d’après une relecture de l’écran) : des titres plus directs, une précision d’une ligne dessous.
     18 h 12 (« tout blanc ça fait bizarre » ; le titre dit déjà « partout avec toi ») : trois repères courts, dans une carte */
  for (const t of ['Leçons et défis <b>sauvegardés</b>', 'Notes et planning <b>synchronisés</b>', 'Sans <b>mot de passe</b>'])
    assert.ok(h.includes('<span class="ob-ca-txt">' + t + '</span>'), t);
  assert.ok(!/Ne perds rien|Retrouve tout|en un geste/.test(h), 'plus de phrases qui répètent le titre');
  assert.ok(app.includes("      ${masquee||reussie||!authReady?'':obCompteAtoutsHTML()}\n      ${masquee?'':`<div class=\"ob-provider-list\">"));
  /* ce qu’elle promet existe : la synchro emporte leçons, défis, jours de série, planning et notes, quelques secondes après un changement */
  const ext = cut('function csExtraire(){', '\n}\n');
  assert.ok(ext.includes('extractProgression({lessons,defis,entretien,actDays}') && ext.includes("key:'planning:main'") && ext.includes('extractSavedNotes('));
  assert.ok(app.includes('clearTimeout(CS.t);CS.t=setTimeout(()=>{csSync();},5000);'));
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-account.is-grand{--stk0:104px}'));
});

/* 12 novembre, 13 h 33 (Elisa, une relecture de l’écran « Garde ta progression ») : une phrase plus directe, des titres plus courts,
   la mention légale juste, la page resserrée. 13 h 44 : « Pas de sans compte stp » : le compte reste le seul chemin. */
test('« Garde ta progression » : sa phrase, la mention légale, la page resserrée ; pas de « sans compte »', () => {
  const p = cut("}else if(slide==='account'){", "}else if(slide==='paywall'){");
  assert.ok(p.includes('<p class="ob-compte-sub">Retrouve tes cours, tes défis et tes réussites sur tous tes appareils.</p>'));
  assert.ok(p.includes('En continuant, tu acceptes nos <a') && p.includes('et reconnais avoir pris connaissance de notre <a'));
  assert.ok(!app.includes('Continuer sans compte') && !app.includes('function obSansCompte(') && !ob.includes('.ob-sans-compte'), 'pas de « Continuer sans compte »');
  assert.ok(p.includes("obSetFooter(authReady?'':'Continuer',authReady?null:obPasserConnexion,'','',{html:legal});"), 'branchée : aucun bouton pour passer');
  /* sans bouton dans le pied, il ne garde plus la place du bouton jaune */
  assert.ok(app.includes("  if(pied)pied.classList.toggle('is-sans-bouton',!primary&&!secondary);"));
  for (const r of ['html #onboarding.ob-vitrine .ob-foot.is-sans-bouton{padding-bottom:calc(var(--safe-bottom,0px) + 14px)!important}',
    'html #onboarding.ob-vitrine .ob-account.is-grand .ob-compte-haut+.ob-title{margin-top:4px!important}',
    'html #onboarding.ob-vitrine .ob-compte-atouts{display:flex;flex-direction:column;gap:8px;width:100%;max-width:360px;margin:14px auto 0!important;padding:12px 14px;'])
    assert.ok(ob.includes(r), r);
});

/* 12 novembre, 13 h 50 : le test de bout en bout avant la mise en production (onboarding entier au doigt, tous les onglets, console,
   notes, défi solo). Trois défauts trouvés : le message de la connexion illisible (blanc sur lilas), la carte des avantages qui
   coupait le champ e-mail sur le site (connexion pas branchée), « prêt·e » sur le paywall alors que le genre est connu. */
test('trouvés au test de bout en bout : message de connexion lisible, paywall accordé, pas de carte sans connexion branchée', () => {
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-auth-message{margin:12px 0 0!important;padding:11px 14px!important;border-radius:14px!important;background:#fff!important;color:var(--v-ink)!important;'));
  assert.ok(app.includes("es ${typeof accord==='function'?accord('prête','prêt','prêt·e'):'prêt·e'} à atteindre <em>ton objectif</em>"));
  assert.ok(app.includes("${masquee||reussie||!authReady?'':obCompteAtoutsHTML()}"));
});

/* 12 novembre, 14 h 08 (Elisa : « améliore mon appli comme tu le sens ») : les chiffres de l’accueil montent une fois à l’arrivée ;
   la page de confidentialité décrit le compte de l’appli iPhone ; seul le prénom est gardé avec le compte ; plus de « bientôt ». */
test('14 h 08 : les chiffres de l’accueil montent une fois ; la confidentialité décrit le compte', () => {
  const f = cut('let homeStatsComptes=false;', 'function homeStatsHTML(){try{');
  assert.ok(f.includes('if(homeStatsComptes||typeof document===\'undefined\'||prefersReduceMotion()') && f.includes("b.textContent=fin+suf;"), 'une fois, pas en mouvement réduit, le vrai chiffre à la fin');
  assert.ok(f.includes("if(ob&&ob.classList.contains('on'))return;") && f.includes("ld.style.display!=='none'"), 'pas sous l’onboarding ni sous l’ouverture');
  assert.ok(app.includes("if(name==='learn'&&typeof homeStatsCompter==='function')setTimeout(homeStatsCompter,380);"));
  const conf = lire('decouvrir/confidentialite.html');
  for (const t of ['<section id="compte"><h2>Ton compte (appli iPhone)</h2>', 'tu te connectes avec Apple ou avec Google, sans mot de passe chez nous', 'Tes leçons et exercices validés, tes défis réussis',
    'l’accès «&nbsp;Se connecter avec Apple&nbsp;» est retiré chez Apple', 'Dernière mise à jour&nbsp;: 12 novembre 2026'])
    assert.ok(conf.includes(t), t);
  assert.ok(!conf.includes('Si Requête propose un jour une connexion'));
  assert.ok(lire('connexion.js').includes("appel('user', {data: {given_name: donne}}, s.access_token, 'PUT')"), 'le prénom seul');
  assert.ok(!app.includes(":'bientôt'}"));
});

/* 12 novembre, 14 h 15 (Elisa : « C’est tout ? Niveau micro-interaction, stickers, animation cours, UI/UX, espace… ? ») : les tuiles
   de chiffres mènent quelque part, un sticker entamé montre où il en est, son cadenas fait « non », retoucher un onglet remonte en
   haut, le graphique vide est moins haut, la vignette du premier cours dit sa vraie durée. */
test('14 h 15 : tuiles en raccourcis, progression des stickers, onglet retouché, graphique vide', () => {
  const ctx = vm.createContext({});
  vm.runInContext(cut('function stkProgHtml(s){', '\n}') + '\n}', ctx);
  assert.equal(ctx.stkProgHtml({got: 0, goal: 12, now: 4}), '<span class="stk-prog"><i aria-hidden="true"><i style="width:33%"></i></i><b aria-hidden="true">4/12</b><span class="acct-sr">4 sur 12</span></span>');
  assert.equal(ctx.stkProgHtml({got: 0, goal: 12, now: 0}), '', 'rien de commencé : rien');
  assert.equal(ctx.stkProgHtml({got: 1, goal: 12, now: 12}), '', 'gagné : rien');
  assert.equal(ctx.stkProgHtml({got: 0, goal: 1, now: 0}), '', 'un seul pas : rien');
  assert.ok(app.includes("if(btn.classList.contains('is-lock')&&!prefersReduceMotion()){btn.classList.remove('is-non');void btn.offsetWidth;btn.classList.add('is-non');"));
  /* les tuiles de l’accueil */
  const vers = [];
  const c2 = vm.createContext({ buzz() {}, switchTab: t => vers.push(t), prefersReduceMotion: () => true, lqHautSur: () => 59,
    document: { getElementById: id => (id === 'scr-learn' ? { scrollTop: 100, getBoundingClientRect: () => ({ top: 0 }), scrollTo: o => vers.push('haut ' + o.top) } : id === 'modules' ? { getBoundingClientRect: () => ({ top: 700 }) } : null) } });
  vm.runInContext(cut('function homeStatAller(ico,el){', '\n}') + '\n}', c2);
  c2.homeStatAller('manette'); c2.homeStatAller('bulle'); c2.homeStatAller('cartes'); c2.homeStatAller('video');
  assert.deepEqual(vers, ['defis', 'entretien', 'collection', 'haut 671'], 'chaque tuile mène à ce qu’elle compte ; les autres, au parcours');
  assert.ok(app.includes("onclick=\"acctStatAller('planning')\"") && app.includes("onclick=\"acctStatAller('learn')\"") && app.includes("onclick=\"acctStatAller('defis')\""), 'Mon compte');
  /* l’onglet déjà ouvert, retouché : en haut */
  const h = cut('/* 12 novembre, 14 h 15 : retoucher l’onglet déjà ouvert', 'function homeStatAller(ico,el){');
  assert.ok(h.includes("if(!t||typeof activeTab==='undefined'||t.dataset.tab!==activeTab)return;") && h.includes('if(!scr||scr.scrollTop<8)return;') && h.includes('e.stopPropagation();e.preventDefault();') && h.includes('},true);'));
  assert.ok(app.includes("<div class=\"pgr-chart${total14||active14?'':' is-vide'}\">") && lq.includes('html.lq .pgr-chart.is-vide .pgr-bars{height:44px}'));
  for (const r of ['html.lq .lq-stat[role="button"]:active{transform:translateY(2px) scale(.97);border-color:var(--accent-2,#8B6CFF)}', 'html.lq .acct-stat.is-lien:active{transform:scale(.94)}',
    '@keyframes stkNon{', 'html.lq:not([data-motion="reduce"]) .stk-cell.is-non .stk-lock{animation:stkNon .44s'])
    assert.ok(lq.includes(r), r);
  assert.ok(lq.indexOf('@keyframes stkNon{') < lq.indexOf('Défis — la refonte du 7 novembre'), 'avant la partie des Défis de la feuille');
});
