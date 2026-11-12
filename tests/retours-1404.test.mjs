/* Elisa, 7 novembre, 14 h 04 : « Oui » (aux GIF déjà prêts de la liste, à mettre là où ils vont aussi) :
   - les bulles de l’onboarding : « Salut ! Comment dois-je t’appeler ? », le coucou ; « Je t’encouragerai… », « C’est parti ! » (le
     pouce levé, puis il te montre) ; la première requête (« Clique sur Exécuter ») et le tutoriel du widget, le présentateur. Il tend
     la patte vers la gauche : il se met à droite de sa bulle pour la montrer (en miroir, le « SQL » de son sweat serait à l’envers) ;
     le moteur SQL indisponible garde le chat qui se pose la question ;
   - « Salle introuvable » (défis) : la loupe ;
   - l’aperçu du widget reste l’autocollant : il copie le vrai widget de l’iPhone (RequeteWidget.swift), qui ne s’anime pas ;
   - le site : la vidéo « Le métier en 2 minutes », le présentateur ; l’appel final « À toi de jouer ! », « C’est parti ! » ; « Une
     question ? », le chat qui se pose la question ; la page de connexion, le coucou qui dit « Re-bonjour ! » (sur téléphone,
     « SELECT » lui laisse le coin ; tout petit écran, il s’efface comme les autocollants). Mouvement réduit : leur image fixe
     (<picture>, prefers-reduced-motion).
   Vérifié dans un navigateur : l’onboarding (393 et 320 px), la salle introuvable, le site (393 à 1280 px). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), ob = lire('onboarding-vitrine.css');
const site = lire('decouvrir/index.html'), vit = lire('decouvrir/vitrine.css'), cx = lire('decouvrir/connexion.html');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('obMascotDit : le chat qui va avec la bulle, à droite pour le présentateur ; l’image fixe en mouvement réduit', () => {
  for (const reduit of [false, true]) {
    const ctx = vm.createContext({ esc: s => String(s), mascotReduced: () => reduit });
    vm.runInContext(cut('const MASCOT_QUESTION=', 'function obMascotQuestion(text){') + cut('function obMascotQuestion(text){', '\n}') + '\n}', ctx);
    const f = reduit ? '-fixe' : '';
    assert.equal(ctx.obMascotDit('Salut !', 'coucou'), `<div class="ob-chat"><img class="ob-chat-stk is-gif is-coucou" src="assets/chat-coucou${f}.webp" width="289" height="352" alt="La mascotte Requête" draggable="false"><div class="ob-bubble">Salut !</div></div>`);
    assert.equal(ctx.obMascotDit('Go', 'parti'), `<div class="ob-chat"><img class="ob-chat-stk is-gif is-parti" src="assets/chat-parti${f}.webp" width="302" height="359" alt="La mascotte Requête" draggable="false"><div class="ob-bubble">Go</div></div>`);
    assert.equal(ctx.obMascotDit('Vois', 'presente', true), `<div class="ob-chat is-droite"><img class="ob-chat-stk is-gif is-presente" src="assets/chat-presente${f}.webp" width="315" height="362" alt="La mascotte Requête" draggable="false"><div class="ob-bubble">Vois</div></div>`);
    assert.equal(ctx.obMascotDit('?', 'toString'), ctx.obMascotQuestion('?'), 'un nom inconnu : la question');
  }
});

test('les bulles qui changent de chat', () => {
  /* 12 novembre, 12 h 24 : sa bulle porte aussi la réponse, montrée clavier ouvert (obPrenomBulle) */
  assert.ok(app.includes("${obMascotDit('Salut ! Comment dois-je t’appeler ?','coucou',false,obPrenomBulle(draft.name))}"), 'le prénom : coucou');
  assert.ok(app.includes("${obMascotDit('Je t’encouragerai directement depuis ton écran d’accueil !','parti')}"), 'le widget : C’est parti !');
  assert.ok(app.includes("${draft.practiceFailed?obMascotQuestion('Le moteur SQL n’a pas pu démarrer ici : tu essaieras dans ta première leçon.'):obMascotDit('Clique sur « Exécuter » pour afficher les clients qui habitent à Paris dans la table clients.','presente',true)}"), 'la première requête : il la présente ; sans moteur, la question');
  assert.ok(app.includes("${obMascotDit(OB_WT_TEXTES[0],'presente',true).replace('class=\"ob-bubble\"','class=\"ob-bubble\" id=\"ob-wt-bulle\"')}"), 'le tutoriel du widget : il présente chaque étape');
  /* L’aperçu du widget copie le vrai widget de l’iPhone, qui ne s’anime pas : l’autocollant reste */
  assert.ok(app.includes('<img class="ob-wg-cat" src="${MASCOT_IMG}" alt="" draggable="false">') && app.includes('<img class="wtu-wg-chat" src="${MASCOT_IMG}" alt="" draggable="false">'));
});

test('leur forme, les mêmes mouvements que la question, et le présentateur à droite', () => {
  for (const r of ['html #onboarding.ob-vitrine .ob-chat img.is-coucou{aspect-ratio:289/352}', 'html #onboarding.ob-vitrine .ob-chat img.is-parti{aspect-ratio:302/359}',
    'html #onboarding.ob-vitrine .ob-chat img.is-presente{aspect-ratio:315/362}', 'html #onboarding.ob-vitrine .ob-chat img.is-gif{animation:obvApparait .24s ease-out both}',
    'html #onboarding.ob-vitrine:not(.ob-enter) .ob-chat img.is-gif{animation:none}', 'html #onboarding.ob-vitrine.ob-cheer .ob-chat img.is-gif{animation:obvJoy .8s var(--v-pop) both}',
    'html #onboarding.ob-vitrine .ob-chat.is-droite{direction:rtl}', 'html #onboarding.ob-vitrine .ob-chat.is-droite>*{direction:ltr}',
    'html #onboarding.ob-vitrine .ob-chat.is-droite .ob-bubble::before{left:auto!important;right:-10px!important;border-left:0!important;border-bottom:0!important;border-top:3px solid var(--v-ink)!important;border-right:3px solid var(--v-ink)!important;'])
    assert.ok(ob.includes(r), r);
  assert.ok(ob.indexOf('.ob-chat img.is-gif{animation:obvApparait') > ob.indexOf('html #onboarding.ob-vitrine:not(.ob-enter) .ob-chat img{animation:obvStkBob'), 'après le balancement de l’autocollant');
});

test('« Salle introuvable » : la loupe', () => {
  const etat = cut('  const etat=(stk,titre,sub,corps,cls,codeEnBas)=>', '\n  const retour=');
  assert.ok(etat.includes("${String(stk).startsWith('chat:')&&typeof chatBonusHtml==='function'?chatBonusHtml(String(stk).slice(5),'room-chat'):`<span class=\"room-stk\" aria-hidden=\"true\">${lqStkSvg(String(stk).startsWith('chat:')?'help':stk)}</span>`}"));
  assert.ok(app.includes("html=etat('chat:loupe','Salle introuvable',"));
  assert.ok(app.includes("html=etat('user','Cette salle est vide',") && app.includes("html=etat('chat:pied','Tu rejoins la salle…',"), 'les autres gardent leur autocollant');
});

test('le site : les GIF du chat, leur image fixe en mouvement réduit', () => {
  const pic = (nom, w, h, cls) => `<picture><source media="(prefers-reduced-motion: reduce)" srcset="../assets/chat-${nom}-fixe.webp"><img class="${cls}" src="../assets/chat-${nom}.webp" width="${w}" height="${h}" alt="" loading="lazy"></picture>`;
  assert.ok(site.includes(pic('presente', 315, 362, 'is-gif')), 'la vidéo « Le métier en 2 minutes »');
  assert.ok(site.includes('<div class="final-art">\n        ' + pic('parti', 302, 359, 'is-gif') + '\n        <span class="bubble" aria-hidden="true">À toi de<br>jouer&nbsp;!</span>'), '« À toi de jouer ! »');
  assert.ok(site.includes(pic('question', 287, 362, 'ct-cat is-gif')), '« Une question ? »');
  assert.ok(!site.includes('<img src="mascotte.webp"') && !site.includes('<img class="ct-cat" src="mascotte.webp"'));
  for (const f of ['presente', 'parti', 'question', 'coucou']) for (const x of ['', '-fixe']) assert.ok(fs.existsSync(path.join(ROOT, `assets/chat-${f}${x}.webp`)), f + x);
  for (const r of ['.how-vid>picture{display:contents}', '.how-vid>img,.how-vid>picture>img{position:absolute;left:50%;bottom:0;height:88%;', '.final.in .final-art img.is-gif{animation:none}',
    '.final-art:has(img.is-gif){width:248px}', '@media (min-width:960px){.final-art:has(img.is-gif){width:306px}}', '.how-vid>picture>img.is-gif{height:80%}', '  .ct-cat.is-gif{width:222px;animation:none}'])
    assert.ok(vit.includes(r), r);
});

test('la page de connexion du site : le chat qui dit « Re-bonjour ! »', () => {
  assert.ok(cx.includes('<span class="cx-bubble" id="cx-bubble">Re-bonjour&nbsp;!</span>') && cx.includes('<picture class="cx-chat-p"><source media="(prefers-reduced-motion: reduce)" srcset="../assets/chat-coucou-fixe.webp"><img class="cx-chat" src="../assets/chat-coucou.webp" width="289" height="352" alt="" loading="lazy"></picture>'));
  assert.ok(cx.indexOf('class="cx-chat"') > cx.indexOf('id="cx-bubble"') && cx.indexOf('class="cx-chat"') < cx.indexOf('<section class="cx-panel">'), 'dans le décor, au pied de la bulle');
  for (const r of ['.cx-stage:has(.cx-chat) .cx-bubble{right:calc(var(--chat) - 10px)!important;bottom:calc(var(--chat) * .82)!important}',
    '@media (max-width:959px){.cx-stage:has(.cx-chat) .k1{display:none}.cx-stage:has(.cx-chat) .cx-bubble{bottom:30px!important}}',
    '@media (max-width:359px){.cx-chat{display:none}', '@media (min-width:960px){.cx-stage{--chat:clamp(112px,23cqw,156px)}.cx-chat{right:1%;bottom:-2%}.cx-stage:has(.cx-chat) .k4{right:auto;left:46%}}'])
    assert.ok(cx.includes(r), r);
});
