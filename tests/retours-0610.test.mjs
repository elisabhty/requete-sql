/* Elisa, 6 novembre, 6 h 10 : « Est-ce que dès à présent on peut cliquer sur évaluer l’application et tomber sur la page d’avis nous
   concernant ? Mettre aussi un élément FAQ vers le site internet. Mets la date d’inscription sur la partie compte. Enlève niveau 3
   dans 8 leçons dans compte. Niv 2 mets-le juste en bas de son icône ronde. » (avec la capture d’une carte « Invite & gagne »).
   - « Noter Requête » ouvre la page « Écrire un avis » de la fiche App Store de Requête (retours-2208) ;
   - une carte « Questions fréquentes », comme celle de la capture, ouvre la FAQ du site (decouvrir/#faq) ; dans l’app iPhone, où le
     site n’est pas, ses pages s’ouvrent dans Safari à leur adresse en ligne (les pages légales aussi) ;
   - la carte du profil : « Niv. 2 » sous l’avatar, le nom du niveau sous le prénom, plus de niveau suivant, la date d’inscription. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const lire = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), site = lire('decouvrir/index.html');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const compte = cut('function renderCompte(){', '\nfunction ');

test('« Noter Requête » mène à la page « Écrire un avis » de la fiche App Store de Requête', () => {
  assert.ok(app.includes("const APP_STORE_ID='6830361256';"), 'la fiche App Store Connect de Requête (IOS.md)');
  assert.ok(app.includes('const url=`itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review`;'));
  assert.ok(compte.includes('onclick="noterAppli()"'));
});

/* 6 novembre, 11 h 12 : Elisa choisit la direction C de l’audit de la carte (retours-1013-compte) : « Niv. 2 » et le nom du niveau
   quittent le rond et le dessous du prénom pour la tuile « Ton niveau » ; toujours pas de niveau suivant. */
test('la carte du profil : « Niv. 2 » et le nom du niveau dans la tuile « Ton niveau », plus de niveau suivant', () => {
  assert.ok(compte.includes('<span class="acct-pic" aria-hidden="true"><span class="acct-avatar">${esc(initial)}<i>${ACCT_PEN_SVG}</i>'));
  assert.ok(compte.includes('<small>Ton niveau</small><span class="acct-t-l"><span class="acct-niv"><span class="lvl-k">Niv.</span>${level.rank}</span></span><b>${esc(level.label)}</b>'), 'la pastille, puis le nom du niveau, dans leur tuile');
  assert.ok(compte.includes('</span>${objHero}</span>'), 'sous le prénom : l’objectif (la date d’inscription s’en va, 9 novembre, 12 h 24)');
  assert.ok(!compte.includes('lvlBadgeHTML(level') && !compte.includes('Niveau ${level.rank+1} dans'), 'plus de « Niveau 3 dans 8 leçons »');
  assert.ok(!compte.includes('membre depuis') && !compte.includes('Membre depuis') && !compte.includes('depuisHero'), '9 novembre, 12 h 24 : plus de « Membre depuis le … », ni à l’écran ni pour VoiceOver');
  for (const k of ['html.lq .acct-pic{flex:none;display:flex;flex-direction:column;align-items:center;gap:10px}', 'html.lq .acct-hero .acct-niv{display:inline-flex;', 'html.lq .acct-hero .acct-tuile .acct-niv{height:28px;'])
    assert.ok(lq.includes(k), k);
});

/* La date d’inscription, exécutée */
function dates(st, aujourdhui = new Date(2026, 10, 6, 9)) {
  const ctx = vm.createContext({ state: st, auj: () => aujourdhui, Intl });
  vm.runInContext(cut('function dstr(d){', '\n') + '\n' + cut('function inscriptionIso(){', '\n/* ') , ctx);
  return { iso: () => ctx.inscriptionIso(), texte: () => ctx.inscriptionTexte() };
}
test('la date d’inscription : posée au premier onboarding, retrouvée pour qui s’est inscrit avant, écrite « le 6 novembre 2026 »', () => {
  assert.equal(dates({ inscritLe: '2026-10-28', actSince: '2026-10-01' }).iso(), '2026-10-28', 'gardée telle quelle');
  const ancien = dates({ actSince: '2026-10-20', actDays: { '2026-10-18': 2, '2026-10-30': 1 }, lessons: { a: { done: true, at: new Date(2026, 9, 25, 10).getTime() } }, profile: { pacte: { at: new Date(2026, 9, 19, 8).getTime() } } });
  assert.equal(ancien.iso(), '2026-10-18', 'le plus ancien jour connu');
  assert.equal(dates({ lessons: {}, profile: {} }).iso(), '2026-11-06', 'sinon aujourd’hui');
  assert.equal(dates({ inscritLe: '2026-11-06' }).texte(), '6 novembre 2026');
  assert.equal(dates({ inscritLe: '2026-12-01' }).texte(), '1er décembre 2026', '« 1er »');
  /* 9 novembre, 12 h 24 : la date ne s’affiche plus dans la carte du profil ; elle reste gardée et calculée */
  /* Gardée dans l’état, posée à la fin du premier onboarding, retrouvée au démarrage, et gardée quand on efface sa progression */
  assert.ok(app.includes("const inscritLe=typeof source.inscritLe==='string'&&/^\\d{4}-\\d{2}-\\d{2}$/.test(source.inscritLe)?source.inscritLe:null;"));
  assert.ok(app.includes('return {lessons,defis,notes,plan,onboarded,inscritLe,name,'));
  assert.ok(cut('function finishOnboard(action){\n  if(typeof obApercu', '\nfunction obTerminer').includes('if(!state.inscritLe)state.inscritLe=inscriptionIso();'));
  assert.ok(app.includes('if(state.onboarded&&!state.inscritLe){ try{ state.inscritLe=inscriptionIso(); setTimeout(()=>{try{save();}catch(e){}},2500); }catch(e){} }'));
  assert.ok(cut('async function resetAllProgress(){', '\n}').includes('onboarded:true,inscritLe:state.inscritLe||null,'));
});

test('la carte « Questions fréquentes » : en tête de « Compte et assistance », elle ouvre la FAQ du site', () => {
  const g = compte.slice(compte.indexOf('Compte et assistance</p>'));
  const faq = g.indexOf('<a class="acct-faq" href="${escAttr(siteUrl(\'decouvrir/#faq\'))}" target="_blank" rel="noopener">');
  assert.ok(faq > 0 && faq < g.indexOf('<div class="account-settings-list">'), 'avant la liste');
  assert.ok(g.includes('<b>Questions fréquentes</b><small>Toutes les réponses, sur le site de Requête.</small>') && g.includes("${lqStkSvg('faq')}"));
  assert.ok(site.includes('<section class="faq" id="faq"'), 'la section existe sur le site');
  assert.ok(/\n    faq:\['/.test(cut('function lqStkSvg(k){', '\n}')), 'son autocollant');
  for (const k of ['html.lq #scr-compte .acct-faq{display:flex;align-items:center;gap:14px;', 'html.lq .acct-faq-ill{flex:none;display:block;width:60px;height:60px}'])
    assert.ok(lq.includes(k), k);
});

test('le site dans l’app iPhone : à son adresse en ligne (le site n’est pas dans l’app), à côté sur le web', () => {
  const code = cut("const SITE_URL='https://elisabhty.github.io/requete-sql/';", '/* La date d’inscription');
  const essai = natif => { const ctx = vm.createContext({ appliNative: () => natif, location: { href: 'https://elisabhty.github.io/requete-sql/index.html?app' }, URL });
    vm.runInContext("const LEGAL_PAGES={privacy:'decouvrir/confidentialite.html'};" + code, ctx); return ctx; };
  assert.equal(essai(true).siteUrl('decouvrir/#faq'), 'https://elisabhty.github.io/requete-sql/decouvrir/#faq');
  assert.equal(essai(true).legalUrl('privacy'), 'https://elisabhty.github.io/requete-sql/decouvrir/confidentialite.html', 'les pages légales aussi');
  assert.equal(essai(false).siteUrl('decouvrir/#faq'), 'https://elisabhty.github.io/requete-sql/decouvrir/#faq');
  const web = vm.createContext({ appliNative: () => false, location: { href: 'http://127.0.0.1:8765/index.html' }, URL });
  vm.runInContext("const LEGAL_PAGES={};" + code, web);
  assert.equal(web.siteUrl('decouvrir/#faq'), 'http://127.0.0.1:8765/decouvrir/#faq', 'sur le web : le site à côté de l’appli');
  assert.ok(lire('scripts/build-www.mjs').includes("for (const f of ['decouvrir/video.html', 'decouvrir/mascotte.webp', 'decouvrir/voix', 'decouvrir/avis'])"), 'le reste du site n’est pas dans l’app');
});
