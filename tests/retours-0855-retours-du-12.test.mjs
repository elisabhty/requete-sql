/* Elisa, 12 novembre, 8 h 55 (seize captures de l’iPhone) : l’avis de Sofia B. seul (réf. 1), la page qui ne remonte plus sous l’heure
   quand le clavier s’ouvre (réf. 2 et 11), « Quitter la salle ? » à sa façon (réf. 3 et 4), deux nouveaux écrans d’après HeyRua (réf. 5
   et 6), la naissance d’un projet sans coche (réf. 7), les traces de la page précédente (réf. 8), le pays qui part plus vite (réf. 9),
   le son de l’avis (réf. 10), une page de connexion plus pleine (réf. 12 et 13), plus de « Connexion annulée » (réf. 14), le vote sans
   flash et ses résultats (réf. 15), les boutons qui ne remontent plus en haut, la cloche sur place, le champ de recherche sous l’heure. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const lire = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const app = lire('index.html');
const lq = lire('ludique.css');
const ob = lire('onboarding-vitrine.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('réf. 5 et 6 : « bonjour » ouvre l’onboarding, « questions » annonce le prénom ; hors des étapes comptées', () => {
  assert.ok(app.includes("const OB_SLIDES = ['bonjour','welcome','questions','name','pays',"));
  const next = cut('function obNext(){\n  const slide=OB_SLIDES[obStep];', 'function obBack(){');
  assert.ok(next.includes("if(slide==='bonjour')obGoto('welcome');\n  else if(slide==='welcome')obGoto('questions');\n  else if(slide==='questions')obGoto('name');"));
  const start = cut('function startOnboarding(initial=', 'let obApercu=false;');
  assert.ok(start.includes("obStep=OB_SLIDES.indexOf(obEntry==='welcome'?'bonjour':obEntry);"), 'le parcours complet commence par « bonjour »');
  assert.ok(app.includes("    if(['bonjour','welcome','questions'].includes(r.slide)||OB_WIDGET_SLIDES.includes(r.slide))return null;"), 'une reprise ne repart pas de ces pages');
  assert.ok(cut('function obBack(){\n  if(obLegalMode)', 'function obPick(').includes("if(OB_SLIDES[obStep]==='account'){obGoto(draft.finVoulue?'ready':'bonjour');return;}"));
  assert.ok(app.includes('const OB_PROFILE_SLIDES=[\'name\','), 'les étapes comptées commencent toujours au prénom');
  /* « bonjour » : la bulle, le chat qui fait coucou, le nom en grand, la promesse ; « Commencer » et « J’ai déjà un compte » */
  const bonjour = cut("}else if(slide==='bonjour'){", "}else if(slide==='questions'){");
  for (const k of ['<p class="ob-bubble ob-bj-bulle">${obTypo(\'Coucou ! On apprend le SQL ensemble ?\')}</p>', 'src="assets/chat-coucou${fixe?\'-fixe\':\'\'}.webp"',
    '<h1 class="ob-bj-nom" id="ob-title">Requête</h1>', "obSetFooter(invite?'Je m’inscris':'Commencer',()=>obGoto('welcome'),authReady?'J’ai déjà un compte':'',authReady?()=>obGoto('account'):null,'');"])
    assert.ok(bonjour.includes(k), k);
  const questions = cut("}else if(slide==='questions'){", "}else if(slide==='account'){");
  assert.ok(questions.includes('Quelques questions rapides pour <b>personnaliser ton apprentissage</b>&nbsp;!') && questions.includes('assets/chat-parti${fixe?\'-fixe\':\'\'}.webp'));
  assert.ok(questions.includes("obSetFooter('Continuer',()=>obGoto('name'),'',null,'');"));
  for (const f of ['assets/chat-coucou.webp', 'assets/chat-coucou-fixe.webp', 'assets/chat-parti.webp', 'assets/chat-parti-fixe.webp']) assert.ok(fs.existsSync(new URL(`../${f}`, import.meta.url)), f);
  assert.ok(ob.includes('html #onboarding.ob-vitrine.ob-bonjour-step #ob-skip{display:flex;'), '« J’ai déjà un compte » en bouton clair');
});

test('réf. 1 et 10 : l’avis de Sofia B. seul ; sa voix passe même l’iPhone en silencieux, puis la session d’avant revient', () => {
  assert.ok(app.includes('function obTemoinsListe(){return OB_TEMOINS.slice(0,1);}'));
  const ctx = vm.createContext({ navigator: { audioSession: { type: 'ambient' } } });
  vm.runInContext(cut('let obTvSession=null;', 'function obTemoinsLire(){'), ctx);
  ctx.obTemoinsSession(true); assert.equal(ctx.navigator.audioSession.type, 'playback');
  ctx.obTemoinsSession(true); ctx.obTemoinsSession(false); assert.equal(ctx.navigator.audioSession.type, 'ambient', 'la session d’avant, une seule fois gardée');
  ctx.obTemoinsSession(false); assert.equal(ctx.navigator.audioSession.type, 'ambient');
  const sans = vm.createContext({ navigator: {} }); vm.runInContext(cut('let obTvSession=null;', 'function obTemoinsLire(){'), sans);
  sans.obTemoinsSession(true);   // sans Audio Session API : rien, sans erreur
  const lireAvis = cut('function obTemoinsLire(){', 'function obTemoinsCouper(){');
  assert.ok(lireAvis.includes('obTemoinsSession(true);') && lireAvis.indexOf('obTemoinsSession(true);') < lireAvis.indexOf('au.play()'));
  assert.ok(cut('function obTemoinsCouper(){', 'function obTemoinsBrancher(){').includes('obTemoinsSession(false);'));
});

test('réf. 2, 11 et dernière : dans l’appli, la page ne remonte plus sous l’heure ; un champ qui y passe redescend', () => {
  const lock = cut('(function lockShell(){', '/* 12 novembre (Elisa, dernière réf.');
  assert.ok(lock.includes('const reset=()=>{ if(typing()&&!natif())return;'), 'dans l’appli, même pendant la saisie');
  assert.ok(lock.includes("if((window.scrollY||window.pageYOffset||0)>0)window.scrollTo(0,0);"));
  /* lqChampSousBarre : le champ sous la barre d’état redescend juste dessous */
  const champ = { matches: s => s === 'input,textarea', closest: s => (s === '.screen' ? sc : s.startsWith('#onboarding') ? null : s.startsWith('label') ? boite : null) };
  const boite = { getBoundingClientRect: () => ({ top: 12 }) };
  const sc = { scrollHeight: 2000, clientHeight: 800, scrollTop: 500 };
  const ctx = vm.createContext({ document: { activeElement: champ }, lqHautSur: () => 47 });
  vm.runInContext(cut('function lqChampSousBarre(){', '(function(){\n  const bientot='), ctx);
  ctx.lqChampSousBarre();
  assert.equal(sc.scrollTop, 500 - (47 + 6 + 8 - 12));
  boite.getBoundingClientRect = () => ({ top: 200 }); sc.scrollTop = 500; ctx.lqChampSousBarre();
  assert.equal(sc.scrollTop, 500, 'bien placé : rien ne bouge');
});

test('réf. 3 et 4 : « Quitter la salle ? », rester en bouton plein, partir et supprimer dessous ; la croix garde dans la salle', () => {
  const q = cut('function jeuLeaveQuestion(){', 'function jeuLeaveOk(){');
  assert.ok(q.includes("titre:'Quitter la salle\\u00a0?'") && q.includes('dans la salle. Si tu la quittes, elle sera automatiquement supprimée.`'));
  assert.ok(q.includes("oui:'Rester dans la salle',trois:'Quitter et supprimer la salle',non:null,partirSiTrois:true"));
  const ask = cut('function jeuLeaveAsk(suite){', 'if(typeof document!==');
  assert.ok(ask.includes("const part=q.partirSiTrois?r==='trois':r===true;"));
});

test('réf. 7 : un projet créé naît sur sa carte (la base tombe, les lettres montent), sans coche', () => {
  const cree = cut('function createProjectFromForm(event){', 'async function renameDb(id){');
  assert.ok(cree.includes("requestAnimationFrame(()=>lqProjetNe('Projet créé : importe un fichier ou crée une table.'));") && !cree.includes("lqDone(document.querySelector('#scr-console .lgtitle h1')"));
  const ne = cut('function lqProjetNe(say,renomme){', '/* La poubelle des notes');
  assert.ok(ne.includes("row.classList.add('lq-ne');if(renomme)row.classList.add('lq-ne-renomme');") && ne.includes('h1.innerHTML=html;'), 'le titre revient tel quel');
  assert.ok(ne.includes('if(prefersReduceMotion()||!row){lqFresh(h1);return;}'));
  for (const k of ['@keyframes lqNeStk{', '@keyframes lqNeLettre{', '@keyframes lqNeEclat{', 'html.lq #scr-console .console-title-row.lq-ne .lq-ne-l{display:inline-block;animation:lqNeLettre'])
    assert.ok(lq.includes(k), k);
  assert.ok(lq.indexOf('@keyframes lqNeStk{') < lq.indexOf('Défis — la refonte du 7 novembre'), 'avant la partie des Défis de la feuille');
});

test('réf. 8 et 9 : la page qui part éteint ses flous, la nouvelle refait ses calques ; le pays part en 0,9 s', () => {
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-slide.out *{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;will-change:auto!important}'));
  assert.ok(app.includes("  body.innerHTML=html;\n  obInsecables(body);\n") && app.includes("  body.style.display='none';void body.offsetHeight;body.style.display='';\n  body.scrollTop=0;"));
  assert.ok(app.includes('const PAYS_ATTENTE=900;'));
});

test('réf. 12, 13 et 14 : la connexion en grand ; fermer la feuille d’Apple ou de Google n’affiche plus « Connexion annulée »', () => {
  assert.ok(app.includes("ob-account${reussie?' is-fete':''}${masquee?' is-sans-connexion':' is-grand'}"));
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-account.is-grand .ob-provider-list{margin-top:auto!important;padding-top:26px}'), 'les boutons en bas');
  const auth = cut('async function obStartAuth(provider,btn){', '/* Elisa, 31 octobre, 8 h 37 (Réf 6)');
  /* Son choix : connecté depuis « J’ai déjà un compte », on arrive sur Mon compte ; le compte remplit d’abord les réponses */
  assert.ok(auth.includes("draft.finConnexion='compte';") && auth.indexOf('csSync({premier:true})') < auth.indexOf('obDraftDepuisEtat();'));
  assert.ok(app.includes("function obApresCompte(){if(obAbonne())finishOnboard(draft.finVoulue||draft.finConnexion||'home');else obGoto('paywall');}"));
  assert.ok(app.includes("finishOnboard(draft.finVoulue||draft.finConnexion||'home');}\nasync function obPaywallAcheter(){"));
  const dctx = vm.createContext({ state: { plan: { niveau: 'avance', rythme: 'intensif', freq: 3 }, name: 'Léa', profile: { goal: 'job', pays: 'BE' } },
    draft: { niveau: 'debutant', rythme: 'regulier', freq: 7, name: '', goal: '' }, PAYS_CODES: ['FR', 'BE'] });
  vm.runInContext(cut('function obDraftDepuisEtat(){', '\n}\n') + '\n}', dctx);
  dctx.obDraftDepuisEtat();
  assert.deepEqual(JSON.parse(JSON.stringify(dctx.draft)), { niveau: 'avance', rythme: 'intensif', freq: 3, name: 'Léa', goal: 'job', pays: 'BE', paysAuto: false });
  assert.ok(!auth.includes("throw new Error('Connexion annulée')") && !auth.includes("'Connexion annulée.'"));
  assert.ok(auth.includes("obAuthMessage=!vite?'':provider==='apple'?"), 'fermée à la main : rien ; refermée aussitôt par iOS : quoi faire');
});

test('réf. 15 : le vote se met à jour sur place, sans flash ; ses résultats en pour cent, dès le premier vote, sans aucun nombre', () => {
  const voter = cut('function parcoursVoter(){', '/* Sur place :');
  assert.ok(!voter.includes('renderParcoursScreen()'), 'la page n’est plus redessinée');
  const sql = lire('supabase/migrations/20261112090000_parcours_resultats.sql');
  assert.ok(sql.includes("select jsonb_build_object('seuil', 1, 'parts',") && sql.includes('case when t.total >= 1 then') && !/'votes'|'total'/.test(sql.split('$$')[1]), 'son choix : dès le premier vote');
  assert.ok(sql.includes('grant execute on function public.parcours_resultats() to anon, authenticated;'));
  /* Les résultats posés sur la page : une barre et un pourcentage par choix, une fois voté */
  const opts = ['python', 'excel', 'powerbi'].map(id => {
    const kids = []; const l = { classList: new Set(), querySelector: s => (s === 'input' ? { value: id } : s === '.pc-res' ? kids[0] || null : null),
      insertAdjacentHTML: () => { kids.push({ style: { setProperty(k, v) { this[k] = v; } }, querySelector: () => kids.b || (kids.b = { textContent: '' }), remove() {} }); } };
    l.classList.add = l.classList.add.bind(l.classList); l.classList.remove = l.classList.delete.bind(l.classList); l.kids = kids; return l;
  });
  const host = { querySelector: s => (s === '.pc-vote' ? {} : null), querySelectorAll: () => opts };
  const ctx = vm.createContext({ document: { getElementById: () => host }, requestAnimationFrame: f => f(), parcoursVote: () => ({ id: 'excel' }) });
  vm.runInContext(cut('let parcoursRes=null', 'function parcoursCloche(id,btn){').replace('let parcoursRes=null,', 'var parcoursRes=null,'), ctx);
  vm.runInContext("parcoursRes={seuil:10,parts:{python:46,excel:31,powerbi:23}}", ctx);
  ctx.parcoursResultatsPeindre();
  assert.deepEqual(opts.map(l => [l.classList.has('has-res'), l.kids[0].style['--p'], l.kids.b.textContent]),
    [[true, '46%', '46 %'], [true, '31%', '31 %'], [true, '23%', '23 %']]);
});

test('les cloches de la liste : l’alerte s’active sur place, sans changer de page ; les boutons ne remontent plus en haut sans besoin', () => {
  const liste = cut('function parcoursListeHTML(){', '/* 11 novembre, 15 h 15');
  assert.ok(liste.includes('<button type="button" class="pc-bell${on?\' is-on\':\'\'}" aria-pressed="${on?\'true\':\'false\'}"') && liste.includes('onclick="parcoursCloche(\'${p.id}\',this)"'));
  assert.ok(!/<button type="button" class="pc-card is-soon"[^`]*class="pc-bell/.test(liste.split('<span class="pc-bell-place"')[0]), 'la cloche n’est plus dans le bouton de la carte');
  const cloche = cut('function parcoursCloche(id,btn){', '/* Le vote part à la base');
  assert.ok(!/openParcours|switchTab/.test(cloche) && cloche.includes("btn.classList.add(on?'is-sonne':'is-coupe');"));
  assert.ok(lq.includes('@keyframes pcSonne{') && lq.includes('html.lq .pc-bell.is-sonne .pc-bell-ok{animation:pcOk'));
  const onglets = cut('function setConsoleProjectPanel(panel){', 'function onConsoleTabsKey(event){');
  assert.ok(!onglets.includes('screen.scrollTo({top:0,') && onglets.includes('if(y<haut)screen.scrollTo('), 'Éditeur, Épinglées, Historique : on reste où l’on est');
  assert.ok(cut('function entretienBack(){', 'returnToParent();').includes('const sc=document.getElementById(\'scr-entretien\'),y=entListeY;'), 'retour à la liste des questions : à sa place');
});
