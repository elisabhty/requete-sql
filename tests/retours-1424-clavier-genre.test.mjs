/* Elisa, 13 novembre, 14 h 24 (cinq captures de la version TestFlight v2929) : « J’ai encore des traces à l’onboarding et des sauts
   au niveau des champs à clavier / flash. Supprime dans Profil et objectif les deux boutons Personnalisation et Revoir l’intro ; dans
   mon appli TestFlight je ne vois pas les modifs avec les modifs à distance. Bien prendre en compte le genre de chacun pour la
   personnalisation. Réf 5 : regarde les traits au milieu des badges de progression, j’aime pas. Quand on appuie sur les boutons, on
   n’arrive pas tout le temps en haut des pages. »
   - Profil et objectif : plus que le pseudo (et les leçons à réviser).
   - Ma progression : plus de trait entre les trois chiffres.
   - Le genre : les derniers mots inclusifs qui parlent de la personne (débutante, débitée, invitée) et les rappels s’accordent.
   - Une page ouverte par un bouton s’ouvre en haut ; la barre du bas et le retour gardent la position.
   - Le clavier : la vue ne change plus de taille (mode « none ») ; l’appli suit le mouvement du clavier, une seule fois. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), ob = lire('onboarding-vitrine.css'), en = lire('langue-en.js');
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };

test('Profil et objectif : le pseudo seul, sans « Personnalisation » ni « Revoir l’intro »', () => {
  const feuille = cut(app, '<details class="plus-details" id="plus-profile-settings">', '</details>');
  assert.ok(feuille.includes('${accPseudoHTML(jeuSavedNom())}'));
  assert.ok(!feuille.includes('Personnalisation') && !feuille.includes('Revoir l’intro') && !feuille.includes('class="acc-row"'));
  assert.ok(feuille.includes('<small>Ton pseudo, ton niveau et ton objectif</small>'), 'le sous-titre dit ce qu’il y a dedans');
  assert.ok(!app.includes('const profileSummary=') && !app.includes('const nivLab='), 'plus de résumé inutile');
});

test('Réf 5 : plus de trait entre les trois chiffres de « Ma progression »', () => {
  assert.ok(!lq.includes('.acct-stat+.acct-stat{border-left'));
  assert.ok(!/\.acct-stat\+\.acct-stat\{[^}]*border/.test(lq));
});

test('le genre : un texte inclusif s’accorde (accordTexte), le pluriel reste', () => {
  const ctx = vm.createContext({});
  vm.runInContext('let G="";function genreDe(){return G;}' + cut(app, 'function accordTexte(t){', '\n}\n') + '\n}\nthis.a=(g,t)=>{G=g;return accordTexte(t);};', ctx);
  assert.equal(ctx.a('f', 'Tu pensais vraiment passer inaperçu·e ?'), 'Tu pensais vraiment passer inaperçue ?');
  assert.equal(ctx.a('h', 'Tu pensais vraiment passer inaperçu·e ?'), 'Tu pensais vraiment passer inaperçu ?');
  assert.equal(ctx.a('', 'Tu pensais vraiment passer inaperçu·e ?'), 'Tu pensais vraiment passer inaperçu·e ?', 'sans réponse : tel quel');
  assert.equal(ctx.a('f', 'Explorateur·rice SQL, relationnel·le, excellent·e'), 'Exploratrice SQL, relationnelle, excellente');
  assert.equal(ctx.a('h', 'Explorateur·rice SQL, relationnel·le, excellent·e'), 'Explorateur SQL, relationnel, excellent');
  assert.equal(ctx.a('f', '1 000 apprenant·es'), '1 000 apprenant·es', 'le pluriel ne parle pas de la personne');
  /* Les rappels (aussi en ligne, rappels.json) passent par lui */
  assert.ok(app.includes("return typeof accordTexte==='function'&&Array.isArray(m)?m.map(accordTexte):m;"));
});

test('le genre : débutante, débitée, invitée ; et leur traduction', () => {
  assert.ok(app.includes("const debLabel=accord('Débutante','Débutant','Débutant·e'),nivLabel={debutant:debLabel,bases:'Bases',inter:'Analyste'}[draft.niveau]||debLabel;"));
  assert.ok(!app.includes('Tu n’as pas été débité·e, réessaie.\''));
  assert.equal(app.split("accord('débitée','débité','débité·e')").length - 1, 2, 'les deux achats');
  assert.ok(app.includes("`Tu es ${typeof accord==='function'?accord('invitée','invité','invité·e'):'invité·e'}`} à un défi SQL"));
  for (const k of ['"Débutante · {1} min par séance"', '"Débutant·e · {1} min par séance"', '"{prenom}, tu es prêt·e à atteindre <1>ton objectif</1> !"'])
    assert.ok(en.includes(k), k);
});

test('une page ouverte par un bouton s’ouvre en haut ; la barre du bas et le retour gardent la position', () => {
  const sw = cut(app, 'function switchTab(name){', '\n}\n');
  assert.ok(sw.includes("if(name!==activeTab&&!tabBackNav&&!restoringNav&&!(typeof tabDepuisBarre==='function'&&tabDepuisBarre()))tabScrollPositions[name]=0;"));
  assert.ok(sw.indexOf('tabScrollPositions[name]=0;\n  activeTab=name;') > 0, 'avant de changer d’onglet');
  /* La barre du bas : l’évènement en cours vient de #tabbar */
  const f = cut(app, 'function tabDepuisBarre(){', '\n}\n') + '\n}';
  const essai = cible => { const ctx = vm.createContext({window: {event: cible === undefined ? null : {target: {closest: s => s === '#tabbar' && cible ? {} : null}}}}); vm.runInContext(f + ';this.r=tabDepuisBarre();', ctx); return ctx.r; };
  assert.equal(essai(true), true, 'un onglet de la barre');
  assert.equal(essai(false), false, 'un bouton de la page');
  assert.equal(essai(undefined), false, 'sans évènement (appel du code)');
});

test('le clavier : la vue garde sa taille, l’appli suit son mouvement une seule fois', () => {
  assert.ok(app.includes("var kbMode=P.Keyboard&&P.Keyboard.setResizeMode&&P.Keyboard.setResizeMode({mode:'none'});"), 'mode « none » au démarrage');
  assert.ok(app.includes('const KB_ANIM_MS=260;let kbAnimFin=0;'));
  assert.ok(app.includes("if(h!==kbNatH)kbAnimFin=Date.now()+KB_ANIM_MS; kbNatH=h;"), 'le clavier qui monte');
  assert.ok(app.includes("window.addEventListener('keyboardWillHide',()=>{ if(kbNatH)kbAnimFin=Date.now()+KB_ANIM_MS; kbNatH=0; });"), 'le clavier qui descend');
  /* Plus de recalages en cascade */
  assert.ok(app.includes('cevT=[KB_ANIM_MS+40,700].map(t=>setTimeout(champEnVue,t));') && !app.includes('[60,320,650,1000]'));
  assert.ok(app.includes('obClavierT=[KB_ANIM_MS+60,750].map(t=>setTimeout(obRefit,t));') && !app.includes('[120,520,900]'));
  assert.ok(app.includes("if(typeof kbEnMouvement==='function'&&kbEnMouvement())return;\n      obRefit();"), 'l’onboarding ne se remesure pas pendant le mouvement');
  /* Le champ glisse en vue, d’un seul mouvement */
  assert.ok(app.includes("sc.scrollTop=st0;try{sc.scrollTo({top:vise,behavior:'smooth'});}catch(e){sc.scrollTop=vise;}"));
  /* kb-ouvert tient le temps que le clavier descende */
  assert.ok(app.includes("document.documentElement.classList.toggle('kb-ouvert',kb>60||kbNatH>0||serre||part);"));
  /* L’appli et les feuilles suivent le clavier (0,26 s), sauf mouvements réduits */
  const bloc = cut(lq, '/* Le clavier qui monte (13 novembre, 14 h 24', '/* ====');
  assert.ok(bloc.includes('@media (prefers-reduced-motion:no-preference){\n  html.is-native:not([data-motion="reduce"]) #app{transition:height .26s cubic-bezier(.38,.7,.125,1),min-height .26s cubic-bezier(.38,.7,.125,1)}'));
  assert.ok(bloc.includes('html.lq.is-native:not([data-motion="reduce"]) #scr-compte .plus-details[open],html.lq.is-native:not([data-motion="reduce"]) .imp-sheet{transition:bottom .26s'));
  assert.ok(bloc.includes('html.lq.is-native.kb-ouvert:has(#onboarding.on) body{background:#4529CC!important}'), 'le violet sous le clavier qui monte');
  assert.ok(!bloc.includes('drop-shadow('));
  assert.ok(lq.indexOf('/* Le clavier qui monte') < lq.indexOf('Défis — la refonte du 7 novembre'));
});

test('le prénom et le pseudo : la page se resserre avec le clavier au lieu de sauter', () => {
  const debut = ob.indexOf('/* ---------- 3 novembre, 17 h 32'), bloc = ob.slice(debut);
  const media = bloc.slice(bloc.indexOf('@media (prefers-reduced-motion:no-preference){'), bloc.indexOf('@media (prefers-reduced-motion:reduce){'));
  for (const k of [
    'html:not([data-motion="reduce"]) #onboarding.ob-vitrine :is(.ob-name,.ob-pseudo)>.ob-lead{max-height:9em;overflow:hidden;transition:max-height .26s',
    'html:not([data-motion="reduce"]) #onboarding.ob-vitrine.ob-clavier :is(.ob-name,.ob-pseudo)>.ob-lead{display:block!important;max-height:0;opacity:0;',
    'html:not([data-motion="reduce"]) #onboarding.ob-vitrine :is(.ob-name,.ob-pseudo)>:is(.ob-title,.ob-chat){transition:margin .26s',
    'html:not([data-motion="reduce"]) #onboarding.ob-vitrine .ob-foot{transition:padding .26s'])
    assert.ok(media.includes(k), k);
  /* Mouvements réduits : la phrase disparaît d’un coup, comme avant */
  assert.ok(ob.includes('html #onboarding.ob-vitrine.ob-clavier :is(.ob-name,.ob-pseudo)>.ob-lead{display:none!important}'));
});

test('le genre se change dans Profil et objectif (« Tu es… »), et l’appli s’accorde aussitôt', () => {
  const feuille = cut(app, '<details class="plus-details" id="plus-profile-settings">', '</details>');
  assert.ok(feuille.indexOf('${accPseudoHTML(jeuSavedNom())}') < feuille.indexOf('${accGenreHTML()}'), 'sous le pseudo');
  const src = app.match(/const OB_GENRES=[^\n]+\n/)[0] + cut(app, 'function accGenreHTML(){', 'function accPseudoHTML(name){');
  const appels = [];
  const ctx = vm.createContext({ state: { profile: {} }, draft: { genre: 'h' }, esc: s => String(s), escAttr: s => String(s), save: () => appels.push('save'), buzz: () => {}, renderCompte: () => appels.push('rendu') });
  vm.runInContext(src, ctx);
  const h = vm.runInContext('accGenreHTML()', ctx);
  assert.ok(h.includes('<p class="ct-l" id="acc-genre-q">Tu es…</p>') && h.includes('aria-label="Je préfère ne pas le dire">Ne pas dire</button>'));
  assert.ok(!h.includes(' on"'), 'sans réponse : rien de choisi');
  vm.runInContext("accGenre('f')", ctx);
  assert.equal(ctx.state.profile.genre, 'f');
  assert.equal(ctx.draft.genre, 'f', 'le brouillon de l’onboarding suit (genreDe le lit d’abord)');
  assert.deepEqual(appels, ['save', 'rendu']);
  vm.runInContext("accGenre('f');accGenre('x')", ctx);
  assert.deepEqual(appels, ['save', 'rendu'], 'même choix, ou inconnu : rien');
  assert.ok(vm.runInContext('accGenreHTML()', ctx).includes('class="ct-type on" role="radio" aria-checked="true" onclick="accGenre(\'f\')"'));
  assert.ok(lq.includes('html.lq #scr-compte .plus-details-body>.acc-genre{margin:4px 18px 18px}'));
});

test('15 h 32 : l’appli rouverte commence sur l’accueil ; rechargée sans être fermée, elle reste où l’on était', () => {
  const f = cut(app, 'function restoreNav(){', '\n  if(!state.onboarded)return;');
  const essai = (natif, session, long) => {
    const ctx = vm.createContext({ dxNatif: () => natif, NAV_KEY: 'nav', NAV_KEY_LONG: 'long', NAV_REPRISE_MS: 6 * 3600e3, navTried: false, Date,
      sessionStorage: { getItem: k => (k === 'nav' ? session : null) }, localStorage: { getItem: k => (k === 'long' ? long : null) } });
    vm.runInContext(f + '\n  return nav;\n}\nthis.r=JSON.stringify(restoreNav() ?? null);', ctx);
    return ctx.r;
  };
  const long = JSON.stringify({ nav: { view: 'tab', tab: 'compte' }, ts: Date.now() - 60000 });
  assert.equal(essai(true, null, long), 'null', 'app iPhone rouverte : l’accueil');
  assert.equal(essai(true, JSON.stringify({ view: 'tab', tab: 'compte' }), long), '{"view":"tab","tab":"compte"}', 'rechargée (nouvelle version, langue) : la même page');
  assert.equal(essai(false, null, long), '{"view":"tab","tab":"compte"}', 'Safari : la reprise des 6 dernières heures reste');
});
