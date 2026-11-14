/* 4 novembre, 13 h 18 (Elisa) : « Faire une page où il détecte le pays où la personne vit, car plus tard je veux plusieurs langues, et
   mettre le drapeau au niveau du rond compte. »
   Le pays se devine sans rien demander (ni localisation, ni réseau) : le fuseau horaire du téléphone, puis la région de sa langue.
   L’onboarding a sa page (« Tu vis où ? »), juste après le prénom ; la liste des pays s’ouvre en feuille, avec une recherche ; le pays
   se garde dans le profil, son drapeau se pose sur le rond de l’onglet Compte et de Mon compte, où une ligne « Pays » permet d’en changer. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html'), vitrine = read('onboarding-vitrine.css'), ludique = read('ludique.css'), sw = read('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const PAYS = cut('/* ---------- Le pays ----------', '/* Les couleurs suivent la surface visible');
const lab = ({tz = 'Europe/Paris', langues = ['fr-FR'], noms = true, etat = {}} = {}) => {
  const ctx = vm.createContext({
    Intl: {DateTimeFormat: () => ({resolvedOptions: () => ({timeZone: tz})}), ...(noms ? {DisplayNames: Intl.DisplayNames} : {})},
    navigator: {languages: langues, language: langues[0]}, String, Object, state: etat, saves: 0
  });
  ctx.save = () => { ctx.saves++; };
  vm.runInContext(PAYS + ';this.PAYS_CODES=PAYS_CODES;this.PAYS_PROCHES=PAYS_PROCHES;this.PAYS_FUSEAUX=PAYS_FUSEAUX;', ctx);
  return ctx;
};

test('le pays se devine : le fuseau horaire d’abord, puis la région de la langue ; rien sinon', () => {
  const pays = (tz, langues) => lab({tz, langues}).paysDetecte();
  assert.equal(pays('Europe/Paris', ['fr-FR']), 'FR');
  assert.equal(pays('Europe/Paris', ['fr-BE']), 'FR', 'là où on vit, pas la langue');
  assert.equal(pays('America/Toronto', ['fr-FR']), 'CA');
  assert.equal(pays('America/Montreal', ['fr-CA']), 'CA', 'l’ancien nom du fuseau de Montréal');
  assert.equal(pays('Indian/Reunion', ['fr-FR']), 'RE');
  assert.equal(pays('Africa/Casablanca', ['fr-FR']), 'MA');
  assert.equal(pays('Asia/Calcutta', ['en-IN']), 'IN');
  assert.equal(pays('UTC', ['fr-BE', 'fr']), 'BE', 'fuseau inconnu : la région de la langue');
  assert.equal(pays('UTC', ['zh-Hant-TW']), 'TW', 'avec une écriture');
  assert.equal(pays('UTC', ['fr', 'en']), null, 'ni fuseau ni région : la liste');
  assert.equal(pays('UTC', ['fr-AQ']), null, 'une région qui n’est pas dans la liste');
});

test('les pays : 243 codes, leurs noms en français, leurs drapeaux ; les plus proches en tête', () => {
  const c = lab();
  const codes = [...c.PAYS_CODES];
  assert.equal(codes.length, 243);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.every(x => /^[A-Z]{2}$/.test(x)) && codes.includes('XK'));
  for (const x of ['AQ', 'BV', 'GS', 'HM', 'IO', 'TF', 'UM']) assert.ok(!codes.includes(x), `${x} : personne n’y vit`);
  assert.deepEqual([...c.PAYS_PROCHES], ['FR', 'BE', 'CH', 'CA', 'LU', 'MA', 'DZ', 'TN', 'SN', 'CI', 'CM', 'MG']);
  for (const [tz, p] of Object.entries(c.PAYS_FUSEAUX)) assert.ok(codes.includes(p), `${tz} → ${p}`);
  assert.ok(Object.keys(c.PAYS_FUSEAUX).length > 240);
  assert.equal(c.paysNom('FR'), 'France'); assert.equal(c.paysNom('US'), 'États-Unis'); assert.equal(c.paysNom('CI'), 'Côte d’Ivoire');
  assert.equal(c.paysNom('HK'), 'Hong Kong', 'pas « R.A.S. chinoise de Hong Kong »'); assert.equal(c.paysNom('VA'), 'Vatican');
  assert.equal(c.paysDrapeau('FR'), '🇫🇷'); assert.equal(c.paysDrapeau('CA'), '🇨🇦'); assert.equal(c.paysDrapeau('fr'), ''); assert.equal(c.paysDrapeau(''), '');
  /* Sans les noms du navigateur (anciens iPhone) : les pays proches gardent leur nom, les autres leurs deux lettres */
  const vieux = lab({noms: false});
  assert.equal(vieux.paysNom('BE'), 'Belgique'); assert.equal(vieux.paysNom('JP'), 'JP');
  /* De A à Z, à la française (les accents et les « Îles » à leur lettre) */
  const l = [...c.paysListe()].map(p => p.nom);
  assert.equal(l[0], 'Afghanistan');
  assert.ok(l.indexOf('Égypte') < l.indexOf('Équateur') && l.indexOf('Équateur') < l.indexOf('Espagne') && l.indexOf('Estonie') < l.indexOf('États-Unis') && l.indexOf('États-Unis') < l.indexOf('Éthiopie'), 'É parmi les E');
  assert.ok(l.indexOf('Îles Féroé') > l.indexOf('Hongrie') && l.indexOf('Îles Féroé') < l.indexOf('Japon'));
  assert.equal(c.paysSansAccents('Côte d’Ivoire'), 'cote d ivoire');
});

test('déjà inscrit : le pays deviné une fois, sans rien demander ; pas pendant l’onboarding', () => {
  const c = lab({tz: 'Europe/Brussels', etat: {onboarded: true, profile: {goal: 'job'}}});
  c.paysCompleter();
  assert.deepEqual(JSON.parse(JSON.stringify(c.state.profile)), {goal: 'job', pays: 'BE', paysAuto: true});
  assert.equal(c.saves, 1);
  c.paysCompleter();
  assert.equal(c.saves, 1, 'une seule fois');
  const choisi = lab({tz: 'Europe/Brussels', etat: {onboarded: true, profile: {pays: 'CH', paysAuto: false}}});
  choisi.paysCompleter();
  assert.equal(choisi.state.profile.pays, 'CH', 'un pays choisi ne change pas');
  const nouveau = lab({etat: {onboarded: false, profile: {}}});
  nouveau.paysCompleter();
  assert.equal(nouveau.state.profile.pays, undefined, 'pendant l’onboarding, c’est sa page qui demande');
  const rien = lab({tz: 'UTC', langues: ['fr'], etat: {onboarded: true, profile: {}}});
  rien.paysCompleter();
  assert.equal(rien.state.profile.pays, undefined);
  assert.equal(lab({etat: {profile: {pays: 'ZZ'}}}).paysDuProfil(), '', 'un code inconnu ne s’affiche pas');
});

test('l’onboarding : la page « Tu vis où ? » juste après le prénom, dans le compte des étapes', () => {
  assert.ok(app.includes("const OB_SLIDES = ['bonjour','welcome','questions','name','pays','age','job',"));
  assert.ok(app.includes("const OB_PROFILE_SLIDES=['name','pays','age','job',"));
  assert.ok(app.includes("  else if(slide==='name')obGoto('pays');\n  else if(slide==='pays')obGoto('age');"));
  assert.ok(app.includes("  if((draft.name||'').trim()){obGoto('pays');return;}"), '« Continuer » et Entrée au prénom');
  const page = cut("}else if(slide==='pays'){", "}else if(slide==='age'){");
  for (const k of ["if(draft.pays===undefined){const p=paysDetecte();draft.pays=p||'';draft.paysAuto=!!p;draft.paysCherche=!!p;}",
    'Tu vis <em>où</em>${prenom?`, ${esc(prenom)}`:\'\'}&nbsp;?',
    /* 12 novembre, 12 h 24 (Elisa, ses textes) : la carte dit pourquoi, puis le pays ; « Modifier » ; « Oui, c’est bien ça » */
    "${obTypo('Chaque pays a ses particularités ! Le tien nous aide à adapter ton expérience.')} <span aria-hidden=\"true\">🌍</span>",
    'const cherche=!!(draft.paysCherche&&obJustEntered&&!prefersReduceMotion())', '<b>Je cherche où tu es…</b>',
    "${draft.paysAuto?'Pays détecté automatiquement':'Choisi par toi'}", 'Je n’ai pas réussi à le deviner.',
    '<button type="button" class="ob-pays-trouve is-vide" onclick="obPaysListe()">',
    "${code?'Ce n’est pas ton pays&nbsp;? <u>Modifier</u>':'<u>Choisir dans la liste</u>'}",
    "obSetFooter(code&&draft.paysAuto?'Oui, c’est bien ça':'Continuer',()=>obGoto('age'),'','','',!code);"])
    assert.ok(page.includes(k), k);
  assert.ok(!page.includes('bientôt'), 'plus de langues « bientôt » : jamais de promesse à venir');
  assert.ok(app.includes("  if(slide==='pays')obPaysJouer();"), 'la recherche, puis le drapeau, après le dessin');
  const jouer = cut('function obPaysJouer(){', 'function obPaysListe(){');
  assert.ok(jouer.includes("c.classList.remove('is-cherche');c.classList.add('is-trouve');") && jouer.includes('},1300));') && jouer.includes('obDemoTimers.push('));
  /* Choisir dans la liste */
  const ctx = vm.createContext({OB_SLIDES: ['name', 'pays'], obStep: 1, obLock: false, draft: {pays: 'FR', paysAuto: true}, PAYS_CODES: ['FR', 'BE'], peint: 0});
  ctx.paintOb = () => { ctx.peint++; };
  ctx.paysFeuille = (actuel, choisir) => { ctx.actuel = actuel; ctx.choisir = choisir; };
  vm.runInContext(cut('function obPaysListe(){', 'function obMascotQuestion(text){'), ctx);
  ctx.obPaysListe();
  assert.equal(ctx.actuel, 'FR');
  ctx.choisir('BE');
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.draft)), {pays: 'BE', paysAuto: false, paysPop: true});
  assert.equal(ctx.peint, 1);
  ctx.choisir('ZZ');
  assert.equal(ctx.draft.pays, 'BE', 'un code inconnu : rien');
});

test('le pays se garde dans le profil, et revient quand l’onboarding se rouvre', () => {
  assert.ok(app.includes("    ...(PAYS_CODES.includes(draft.pays)?{pays:draft.pays,paysAuto:!!draft.paysAuto}:{}),\n    ...(draft.pacte?"), 'finishOnboard');
  /* 5 novembre, 21 h 19 : l’engagement déjà pris revient aussi (retours-2119) */
  assert.ok(app.includes("    ...(PAYS_CODES.includes(profile.pays)?{pays:profile.pays,paysAuto:!!profile.paysAuto}:{}),\n    /* 21 h 19 : l’engagement déjà pris le reste"), 'startOnboarding');
});

test('le drapeau sur le rond du compte : l’onglet Compte, Mon compte, et la ligne « Pays » des réglages', () => {
  const av = cut('function renderLearnAvatar(){', 'function renderHomeStreak(){');
  assert.ok(av.includes('try{paysCompleter();}catch(e){}'));
  assert.ok(av.includes("el.innerHTML=esc(ini)+(drapeau?`<i class=\"av-drapeau\">${drapeau}</i>`:'');"));
  const ctx = vm.createContext({state: {name: 'elisa', profile: {pays: 'CA'}}, esc: s => s, paysCompleter() {}, paysDuProfil: () => 'CA', paysDrapeau: () => '🇨🇦'});
  const el = {innerHTML: ''};
  ctx.document = {querySelectorAll: () => [el]};
  vm.runInContext(av.slice(0, av.indexOf('/* Mon compte › Pays')), ctx);
  ctx.renderLearnAvatar();
  assert.equal(el.innerHTML, 'E<i class="av-drapeau">🇨🇦</i>');
  ctx.paysDuProfil = () => ''; ctx.renderLearnAvatar();
  assert.equal(el.innerHTML, 'E', 'sans pays : l’initiale seule');
  assert.ok(app.includes('<span class="acct-pic" aria-hidden="true"><span class="acct-avatar">${esc(initial)}<i>${ACCT_PEN_SVG}</i>${paysDuProfil()?`<b class="acct-drapeau">${paysDrapeau(paysDuProfil())}</b>`:\'\'}</span>'));   // 6 novembre, 6 h 10 : l’avatar et son « Niv. 2 » dessous
  assert.ok(app.includes('<button class="account-setting-row" type="button" onclick="paysChanger()"><span class="plus-row-icon is-drapeau" aria-hidden="true">${paysDuProfil()?paysDrapeau(paysDuProfil()):\'🌍\'}</span><span><b>Pays</b><small>${paysDuProfil()?esc(paysNom(paysDuProfil())):\'Choisir mon pays\'}</small></span>'));
  const ch = cut('function paysChanger(){', '\n}\n');
  assert.ok(ch.includes('state.profile=Object.assign({},state.profile||{},{pays:code,paysAuto:false});save();') && ch.includes('renderCompte();'));
});

test('la liste en feuille : recherche sans accents, pays proches en tête, le pays choisi coché, Échap et le fond la ferment', () => {
  const f = cut('function paysFeuille(actuel,choisir){', 'function paysFiltrer(f,texte){');
  for (const k of ['<h2 id="pays-feuille-t">Choisis ton pays</h2>', 'placeholder="Rechercher un pays"', '<p class="pays-titre" data-groupe="proches">Les plus proches</p>',
    '<p class="pays-titre" data-groupe="tous">Tous les pays</p>', '${paysListe().map(p=>ligne(p.code)).join(\'\')}', 'Aucun pays ne correspond.',
    "f.setAttribute('role','dialog');f.setAttribute('aria-modal','true');", "if(e.key==='Escape'){e.preventDefault();partir();}",
    "f.querySelector('.pays-fond').onclick=partir;", "matchMedia('(hover:hover) and (pointer:fine)').matches",
    /* 11 novembre, 12 h 25 : le pays touché se coche, la feuille part deux secondes après (retours-1225) */
    "clearTimeout(attente);attente=setTimeout(partir,prefersReduceMotion()?700:PAYS_ATTENTE);"])
    assert.ok(f.includes(k), k);
  /* Le filtre, sur une liste factice */
  const li = (cherche, groupe) => ({hidden: false, firstElementChild: {dataset: {cherche}}, groupe});
  const tous = [li('belgique be'), li('cote d ivoire ci'), li('france fr')];
  const titres = [{hidden: false}, {hidden: false}], rien = {hidden: true};
  const feuille = {querySelectorAll: s => s.includes('[data-groupe="tous"] li') ? tous : s === '[data-groupe="proches"]' ? titres : [], querySelector: s => s === '.pays-rien' ? rien : {hidden: false}};
  const ctx = vm.createContext({String});
  vm.runInContext(cut('function paysSansAccents(t){', '\n') + cut('function paysFiltrer(f,texte){', 'function paysFeuilleFermer(vite){'), ctx);
  ctx.paysFiltrer(feuille, 'Côte');
  assert.deepEqual(tous.map(l => l.hidden), [true, false, true]);
  assert.ok(titres.every(t => t.hidden) && rien.hidden, 'les pays proches s’effacent');
  ctx.paysFiltrer(feuille, 'zzz');
  assert.equal(rien.hidden, false, 'aucun pays');
  ctx.paysFiltrer(feuille, '');
  assert.ok(tous.every(l => !l.hidden) && titres.every(t => !t.hidden));
});

test('les feuilles de style : la page (rechargée, v19) et ses animations, la feuille des pays et les pastilles (v136)', () => {
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=68">') && sw.includes("'./onboarding-vitrine.css?v=68',"));
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=369">'));
  for (const k of ['html #onboarding.ob-vitrine .ob-pays-carte.is-on{border-color:var(--v-sun);background:#FFFBEB;box-shadow:0 5px 0 var(--v-sun-lip)}',
    'html #onboarding.ob-vitrine .ob-pays-carte.is-cherche .ob-pays-radar{display:flex}', 'html #onboarding.ob-vitrine .ob-pays-carte.is-cherche .ob-pays-trouve{display:none}',
    'html #onboarding.ob-vitrine .ob-pays-globe i:first-child{opacity:1}', '@keyframes obvPaysGlobe{', '@keyframes obvPaysPose{'])
    assert.ok(vitrine.includes(k), k);
  /* Les animations dans le média « mouvements autorisés » (retours-1732 vérifie tout le bloc) */
  const media = vitrine.slice(vitrine.indexOf('@media (prefers-reduced-motion:no-preference){'), vitrine.indexOf('@media (prefers-reduced-motion:reduce){', vitrine.indexOf('@media (prefers-reduced-motion:no-preference){')));
  for (const k of ['.ob-pays-carte.is-cherche .ob-pays-globe i{animation:obvPaysGlobe .9s linear calc(var(--k) * -.3s) infinite}', '.ob-pays-carte.is-trouve .ob-pays-drapeau{animation:obvPaysPose']) assert.ok(media.includes(k), k);
  for (const k of ['html.lq #app>.tabbar .tab-avatar .av-drapeau{position:absolute;right:-8px;bottom:-6px;', 'html.lq .acct-avatar .acct-drapeau{position:absolute;right:-7px;top:-5px;',
    '.pays-feuille{position:fixed;inset:0;z-index:2700;', '.pays-feuille.on .pays-boite{transform:none}', 'height:min(82vh,760px)',
    '@media (prefers-reduced-motion:reduce){.pays-feuille .pays-boite,.pays-feuille .pays-fond{transition:none}}'])
    assert.ok(ludique.includes(k), k);
});
