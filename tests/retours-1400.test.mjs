/* Elisa, 5 novembre, 14 h : « Fais en sorte qu’on puisse partager le code qui mène vers l’application : rejoins-moi… La personne
   devra s’inscrire obligatoirement si elle n’a pas de compte ; si elle en a un, elle rejoint la salle sans taper le code ».
   - Salle d’attente : « Partager l’invitation » (la feuille de partage du téléphone, sinon l’invitation copiée) : « Rejoins-moi… »,
     le code, et le lien ?partie=CODE&de=pseudo.
   - Le lien mène à l’appli, jamais au site (le script de tête renvoyait un nouveau visiteur vers decouvrir/, l’invitation perdue).
   - Pas encore inscrit : l’accueil annonce l’invitation, « Je m’inscris », tout le parcours de bienvenue, puis « Rejoindre la salle ».
   - Déjà inscrit : on entre dans la salle sans taper le code.
   Vérifié dans un navigateur (402 et 320 px ; accueil aussi à 375 × 667 et 320 × 568) : l’hôte partage, une nouvelle venue s’inscrit
   puis entre, un inscrit entre directement ; l’hôte les voit arriver. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pseudo = cut('const PS_CAR=', 'function psForme(v)') + cut('function psForme(v)', '\n') + '\n';
const nettoyer = cut('function jeuCleanCode(v){', '\n}\n') + '\n}\n';
const memoire = () => { const m = new Map(); return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

test('le lien d’une invitation mène à l’appli, pas au site, et s’en souvient', () => {
  const tete = cut('<script>(function(){try{var q=location.search', '</script>').slice('<script>'.length);
  const visite = (search, garde = {}) => {
    const ls = memoire(); Object.entries(garde).forEach(([k, v]) => ls.setItem(k, v));
    const vers = [];
    vm.runInContext(tete, vm.createContext({ location: { search, protocol: 'https:', replace: u => vers.push(u) }, localStorage: ls, window: {}, navigator: {}, matchMedia: () => ({ matches: false }) }));
    return { vers, vu: ls.getItem('rq-vu-appli') };
  };
  assert.deepEqual(visite('?partie=PRET02&de=elisa_sql'), { vers: [], vu: '1' }, 'invité : l’appli, et la prochaine visite aussi');
  assert.deepEqual(visite(''), { vers: ['decouvrir/'], vu: null }, 'un nouveau visiteur sans invitation : le site, comme avant');
  assert.deepEqual(visite('?depuis=vitrine'), { vers: [], vu: '1' });
});

test('l’invitation : lue dans le lien, gardée le temps de l’inscription, puis on entre dans la salle sans taper le code', () => {
  const bloc = cut('const JEU_INV=', 'function jeuEntrerInvitation(code){');
  const ouvrir = ({ search = '', onboarded = false, ss = memoire() } = {}) => {
    const appels = [];
    const ctx = vm.createContext({ URL, URLSearchParams, sessionStorage: ss, state: { onboarded },
      location: { search, href: 'https://elisabhty.github.io/requete-sql/' + search },
      history: { state: null, replaceState: (s, t, u) => appels.push('adresse ' + u) }, jeuEntrerInvitation: c => appels.push('entre ' + c) });
    vm.runInContext(pseudo + nettoyer + bloc, ctx);
    return { ctx, ss, appels };
  };
  /* Pas encore inscrit : gardée, rien d’autre */
  const a = ouvrir({ search: '?partie=pret02&de=Elisa_SQL&jeu=local' });
  assert.deepEqual(JSON.parse(JSON.stringify(a.ctx.jeuInvitation())), { code: 'PRET02', de: '@elisa_sql' });
  a.ctx.jeuFromUrl();
  assert.deepEqual(a.appels, []);
  assert.deepEqual([...a.ss.m], [['rq-jeu-invite', 'PRET02'], ['rq-jeu-invite-de', '@elisa_sql']]);
  /* Inscrite, la même page (l’adresse a pu perdre son invitation) : on entre, l’adresse et la mémoire nettoyées */
  const b = ouvrir({ onboarded: true, ss: a.ss });
  b.ctx.jeuFromUrl();
  assert.deepEqual(b.appels, ['adresse /requete-sql/', 'entre PRET02']);
  assert.equal(a.ss.m.size, 0);
  /* Déjà inscrit qui ouvre le lien : on entre tout de suite ; seuls partie et de quittent l’adresse */
  const c = ouvrir({ search: '?partie=PRET02&de=elisa_sql&jeu=local', onboarded: true });
  c.ctx.jeuFromUrl();
  assert.deepEqual(c.appels, ['adresse /requete-sql/?jeu=local', 'entre PRET02']);
  /* Un lien abîmé ne fait rien ; un pseudo bizarre est ramené à un pseudo possible */
  assert.equal(ouvrir({ search: '?partie=PRE02' }).ctx.jeuInvitation(), null);
  assert.equal(ouvrir({ search: '?partie=PRET02&de=%3Cb%3Ex%3C/b%3E' }).ctx.jeuInvitation().de, '@bxb');
  assert.equal(ouvrir({ search: '?partie=PRET02' }).ctx.jeuInvitation().de, '');
});

test('entrer : Défis passe derrière (la carte au code rempli si ça échoue), en pleine leçon la salle prend sa place', () => {
  const entrer = cut('function jeuEntrerInvitation(code){', '\n}\n') + '\n}\n';
  const lancer = ({ lecon = false, salle = null } = {}) => {
    const appels = [];
    const ctx = vm.createContext({ JEU: salle, jeuInvite: '', document: { body: { classList: { contains: c => c === 'in-lesson' && lecon } } },
      openJeu: c => { appels.push('défis ' + c); ctx.jeuInvite = c; }, jeuJoin: c => appels.push('rejoint ' + c), requestAnimationFrame: f => f() });
    vm.runInContext('var jeuInvite="";' + entrer, ctx);
    ctx.jeuEntrerInvitation('PRET02');
    return appels;
  };
  assert.deepEqual(lancer(), ['défis PRET02', 'rejoint PRET02']);
  assert.deepEqual(lancer({ lecon: true }), ['rejoint PRET02']);
  assert.deepEqual(lancer({ lecon: true, salle: { code: 'PRET02' } }), [], 'déjà dans cette salle (rechargement) : rien');
  /* La salle se rejoint comme d’habitude : le pseudo réservé sans rien demander, puis la salle (jeuJoin) */
  assert.ok(app.includes('  jeuPseudoPuis(()=>jeuStart(c,false,null,{nomId:\'jeu-nom\',parCode:true}));'));
  /* 8 novembre, 0 h 23 : personne dans la salle d’un code tapé (ou d’un lien) : retour à sa feuille, « Code introuvable. Vérifie-le et réessaie. » */
  assert.ok(app.includes("if(J.parCode&&typeof jeuCodeIntrouvable==='function'){jeuCodeIntrouvable(code);return;}") && app.includes("jeuCodeKo=jeuCleanCode(code);jeuInvite='';"));
});

test('pas encore inscrite : l’accueil annonce l’invitation, « Je m’inscris », tout le parcours, puis « Rejoindre la salle »', () => {
  const html = cut('function obInviteHTML(){', '\n}\n') + '\n}\n';
  const accueil = (inv, onboarded = false) => {
    const ctx = vm.createContext({ state: { onboarded }, esc, jeuInvitation: () => inv, lqStkSvg: k => `<svg data-k="${k}"></svg>` });
    vm.runInContext(html, ctx);
    return ctx.obInviteHTML();
  };
  const h = accueil({ code: 'PRET02', de: '@elisa_sql' });
  assert.ok(h.startsWith('<div class="ob-invite" role="note"><span class="ob-invite-stk" aria-hidden="true"><svg data-k="target"></svg></span>'), 'la cible des salles');
  assert.ok(h.includes('<b>@elisa_sql t’invite à un défi SQL</b><small>Inscris-toi pour rejoindre sa salle&nbsp;: tu y entres juste après.</small>'));
  assert.ok(accueil({ code: 'PRET02', de: '' }).includes('<b>Tu es invité·e à un défi SQL</b><small>Inscris-toi pour rejoindre la salle&nbsp;:'));
  assert.equal(accueil({ code: 'PRET02', de: '<i>' }).includes('<i>'), false, 'échappé');
  assert.equal(accueil(null), '');
  assert.equal(accueil({ code: 'PRET02', de: '@x' }, true), '', 'déjà inscrit : rien à annoncer');
  /* Sous le titre, à la place de la démo de la console ; le bouton dit « Je m’inscris » ; la vidéo du métier passe d’abord, comme pour
     tout nouveau venu (15 h 01 : « l’onboarding depuis le début ») */
  assert.ok(app.includes('Choisis ton parcours en quelques étapes.</p>${invite}\n      <div class="ob-welcome-demo'));
  assert.ok(app.includes("    obSetFooter(invite?'Je m’inscris':'Personnaliser mon parcours',()=>obGoto('name'),"));
  assert.ok(app.includes('  #onboarding .ob-screen.welcome.has-invite .ob-welcome-demo{display:none!important}'));
  const video = cut('function obVideoVoulue(){', '\n}\n') + '\n}\n';
  const vctx = vm.createContext({ obVideoSite: false, OB_VIDEO_VUE: 'v', localStorage: memoire(), jeuInvitation: () => ({ code: 'PRET02', de: '' }) });
  vm.runInContext(video, vctx);
  assert.equal(vctx.obVideoVoulue(), true, 'invité : la vidéo aussi');
  vctx.jeuInvitation = () => null;
  assert.equal(vctx.obVideoVoulue(), true, 'sans invitation : la vidéo comme avant');
  assert.ok(!video.includes('jeuInvitation'));
  /* La dernière page */
  assert.ok(app.includes("    const inv=!state.onboarded&&typeof jeuInvitation==='function'?jeuInvitation():null;"));
  assert.ok(app.includes("<p class=\"ob-lead\">${inv?`${inv.de?`<b>${esc(inv.de)}</b> t’attend dans sa salle de défi`:'Ta salle de défi t’attend'}. Ta première leçon sera là à ton retour.`:'Commence par ta première leçon et avance jusqu’à ton objectif.'}</p>"));
  assert.ok(app.includes("    if(inv)obSetFooter('Rejoindre la salle',()=>finishOnboard('salle'),'',''"), 'un seul bouton : la salle');
  /* La reprise d’une inscription commencée le rappelle */
  assert.ok(app.includes("'On reprend là où tu en étais. La salle t’attend à la fin.'"));
});

test('l’inscription finie : Défis puis la salle, sans ouvrir la première leçon ; sans invitation, rien ne change', () => {
  const fin = cut('function obTerminer(action){', '\nfunction celebrate(){');
  const terminer = (action, inv) => {
    const appels = [];
    const el = { classList: { remove() {} }, setAttribute() {} };
    const ctx = vm.createContext({ document: { getElementById: () => el }, obBarreEtat() {}, renderGreeting() {}, renderHomeHero() {}, renderProgress() {}, renderPlanning() {}, renderCompte() {},
      celebrate() {}, semaineOffset: 0, jourSel: null, state: { plan: { sessions: [{ lessons: [7] }] } }, isDefiId: () => false,
      switchTab: t => appels.push('onglet ' + t), openLesson: id => appels.push('leçon ' + id), requestAnimationFrame: f => f(),
      jeuInvitation: () => inv, jeuFromUrl() {}, setTimeout: (f, t) => appels.push(f === ctx.jeuFromUrl ? `invitation ${t} ms` : 'minuteur') });
    vm.runInContext('var semaineOffset=0,jourSel=null;' + fin, ctx);
    ctx.obTerminer(action);
    return appels;
  };
  assert.deepEqual(terminer('salle', { code: 'PRET02' }), ['onglet defis', 'invitation 450 ms']);
  assert.deepEqual(terminer('home', { code: 'PRET02' }), ['onglet defis', 'invitation 450 ms'], 'une invitation en attente passe avant la leçon');
  assert.deepEqual(terminer('home', null), ['onglet learn', 'leçon 7', 'invitation 450 ms']);
  assert.deepEqual(terminer('plan-ready', null), ['onglet planning', 'invitation 450 ms']);
});

test('« Partager l’invitation » : la feuille de partage avec « Rejoins-moi… », le code et le lien ; sinon l’invitation copiée', async () => {
  const bloc = cut('const JEU_SHARE_SVG=', 'async function jeuShare(){') + cut('async function jeuShare(){', '\n}\n') + '\n}\n';
  const partager = async ({ share = true, protocole = 'https:', search = '' } = {}) => {
    const vu = { partage: null, copie: null };
    const out = { textContent: '', classList: { remove() {} } };
    const ctx = vm.createContext({ JEU: { code: 'PRET02', nom: '@elisa_sql' }, encodeURIComponent,
      location: { protocol: protocole, origin: protocole === 'https:' ? 'https://elisabhty.github.io' : 'capacitor://localhost', pathname: protocole === 'https:' ? '/requete-sql/' : '/index.html', search },
      navigator: share ? { share: async d => { vu.partage = d; } } : {}, document: { getElementById: id => (id === 'jeu-copied' ? out : null) },
      jeuCopyText: async t => { vu.copie = t; }, buzz() {} });
    vm.runInContext(pseudo + bloc, ctx);
    await ctx.jeuShare();
    return { ...vu, dit: out.textContent };
  };
  const a = await partager();
  assert.deepEqual(JSON.parse(JSON.stringify(a.partage)), { title: 'Défi SQL sur Requête', text: 'Rejoins-moi sur Requête pour un défi SQL ! Code de la salle : PRET02', url: 'https://elisabhty.github.io/requete-sql/?partie=PRET02&de=elisa_sql' });
  const b = await partager({ protocole: 'capacitor:' });
  assert.equal(b.partage.url, 'https://elisabhty.github.io/requete-sql/?partie=PRET02&de=elisa_sql', 'depuis l’app iOS : le site public, pas l’adresse locale');
  const c = await partager({ share: false });
  assert.equal(c.copie, 'Rejoins-moi sur Requête pour un défi SQL ! Code de la salle : PRET02\nhttps://elisabhty.github.io/requete-sql/?partie=PRET02&de=elisa_sql');
  assert.equal(c.dit, 'Invitation copiée : colle-la dans un message à tes amis.');
  /* Collée dans « Entre le code », l’invitation donne le code, avec ou sans le lien */
  const n = vm.createContext({}); vm.runInContext(nettoyer, n);
  assert.equal(n.jeuCleanCode(c.copie), 'PRET02');
  assert.equal(n.jeuCleanCode('Rejoins-moi sur Requête pour un défi SQL ! Code de la salle : PRET02'), 'PRET02');
  assert.equal(n.jeuCleanCode('k7m 2qx'), 'K7M2QX');
  /* Dans la carte de la salle : le bouton plein, puis « Copier le code » */
  assert.ok(app.includes('${codeTuiles()}<button type="button" class="jeu-btn is-wide jeu-share" id="jeu-share" onclick="jeuShare()">${JEU_SHARE_SVG}<span>Partager l’invitation</span></button><button type="button" class="jeu-btn is-wide jeu-copy" id="jeu-copy" onclick="jeuCopyCode()">'));
  assert.ok(app.includes("'Tes amis entrent avec le lien de l’invitation, ou avec ce code.'") && app.includes('`Envoie l’invitation à ${esc(J.pour)} pour jouer ensemble.`'));
  assert.ok(app.includes('  html.lq #jeu-root .jeu-share{display:flex;align-items:center;justify-content:center;gap:9px;background:var(--accent)!important;'));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-09-reessaie-v2717';") && app.includes("const SW_CACHE='requete-2026-11-09-reessaie-v2717';"));
});
