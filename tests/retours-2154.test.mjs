/* 5 novembre, 21 h 54 (Elisa, quatre captures : la ligne « Profil et objectif » des réglages, la carte du profil de Mon compte, la
   phrase « Ton message part sur le serveur de l’appli… » de Contacte-nous, les réglages et leurs autocollants) : « enlève ça pour
   mettre réf. 2 la partie objectif » ; « réf. 3 supprimer » ; « il n’y a pas de bouton de déconnexion ? » ; « dans Biblio et
   Pratiquer, finalement on reste sur la même DA que les icônes réf. 4 ».
   - La ligne « Profil et objectif » part ; l’objectif de l’onboarding passe sur la carte du profil (qui ouvre la même feuille).
   - Contacte-nous : plus la phrase sur le serveur.
   - Se déconnecter : la ligne n’apparaît qu’une fois connecté ; l’appli n’a pas encore de connexion par compte.
   - La Bibliothèque et Pratiquer retrouvent leurs autocollants. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html');
const lq = read('ludique.css');
const sw = read('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const compte = cut('function renderCompte(){', '\nfunction ');

test('réf. 1 et 2 : plus de ligne « Profil et objectif » ; l’objectif sur la carte du profil, sous le niveau', () => {
  assert.ok(!compte.includes('<b>Profil et objectif</b>'), 'la ligne des réglages est partie');
  const apprentissage = compte.slice(compte.indexOf('<p class="account-settings-group-title">Apprentissage</p>'), compte.indexOf('<p class="account-settings-group-title">Compte et assistance</p>'));
  assert.ok(apprentissage.indexOf('onclick="paysChanger()"') > 0 && !apprentissage.includes("openPlusDetails('plus-profile-settings')"), 'la liste commence par le pays');
  /* La carte du profil ouvre toujours la feuille (pseudo, personnalisation, revoir l’intro) */
  assert.ok(compte.includes(`<button type="button" class="acct-id" onclick="openPlusDetails('plus-profile-settings')"`));
  assert.ok(compte.includes('<details class="plus-details" id="plus-profile-settings">\n      <summary><span>Profil et objectif</span>'));
  assert.ok(compte.includes("</span>${objHero}</span>"), 'sous le prénom (6 novembre, 11 h 12 : le niveau a sa tuile, retours-1013-compte)');
  assert.ok(compte.includes('${profileGoal?`, objectif : ${profileGoal}`:\'\'}`)}">'), 'VoiceOver le lit aussi');
  /* L’objectif, rendu */
  const decl = compte.match(/  const objHero=(profileGoal\?`[^\n]+`:'');/)[1];
  const rendu = (goal, icone = 'person') => vm.runInNewContext(decl, {
    profileGoal: goal, profileGoalO: ['interview', goal, icone], esc: s => String(s).replace(/</g, '&lt;'), obOptionIcon: t => `<span class="ob-answer-icon">${t}</span>`,
  });
  assert.equal(rendu('Réussir un entretien'), '<span class="acct-obj"><span class="acct-obj-ico" aria-hidden="true"><span class="ob-answer-icon">person</span></span><span>Mon objectif : <strong>Réussir un entretien</strong></span></span>');
  assert.equal(rendu(''), '', 'sans objectif (un profil d’avant) : rien');
  assert.ok(compte.includes("const profileGoalO=OB_GOALS.find(g=>g[0]===profile.goal)||null,profileGoal=(profileGoalO||[])[1]||'';"));
  /* Le style : une tuile claire, « Objectif : » puis l’objectif en gras, en blanc sur le violet */
  for (const k of ['html.lq .acct-hero .acct-obj{display:flex;align-items:center;gap:8px;min-width:0;color:rgba(255,255,255,.82);font:600 13.5px/1.3 var(--ui);text-wrap:balance}',
    'html.lq .acct-hero .acct-obj strong{color:#fff;font-weight:800}', 'html.lq .acct-hero .acct-obj-ico{flex:none;display:grid;place-items:center;width:26px;height:26px;'])
    assert.ok(lq.includes(k), k);
  /* Pas de <b> ni de <small> dans la carte (ils prendraient le style du prénom ou du niveau) */
  assert.ok(!/<b>|<small>/.test(rendu('Réussir un entretien')));
});

test('réf. 3 : Contacte-nous sans la phrase sur le serveur', () => {
  assert.ok(!app.includes('Ton message part sur le serveur de l’appli') && !app.includes('class="ct-note"'));
  assert.ok(!lq.includes('.ct-note{'), 'son style aussi');
  const ct = cut('function ctHTML(){', 'function ctPeindre(){');
  assert.ok(ct.includes('<div class="ct-pied"><p class="ct-etat" id="ct-etat" role="status" aria-live="polite"></p>'), 'le bouton d’envoi reste');
});

test('« pas de bouton de déconnexion ? » : il n’apparaît qu’une fois connecté, et l’appli n’a pas encore de connexion', () => {
  assert.ok(compte.includes("const connected=state.accountMode==='connected';"));
  /* 22 h 14 : « mets le bouton déconnexion même s’il ne fonctionne pas » : la ligne est toujours là (retours-2214) */
  assert.ok(compte.includes('<button class="account-setting-row" type="button" onclick="seDeconnecter()">') && !compte.includes('${connected?`<button class="account-setting-row" type="button" onclick="seDeconnecter()">'), 'Se déconnecter, toujours');
  assert.ok(/async function seDeconnecter\(\)\{/.test(app));
  /* Aucun fournisseur de connexion n’est branché (window.REQUETE_AUTH) : tout est sur l’appareil, rien à déconnecter */
  assert.ok(!/window\.REQUETE_AUTH\s*=/.test(app) && app.includes("function obAuthReady(){return !!(window.REQUETE_AUTH&&typeof window.REQUETE_AUTH.signIn==='function');}"));
});

test('réf. 4 : la Bibliothèque et Pratiquer retrouvent leurs autocollants, comme les réglages de Mon compte', () => {
  assert.ok(!app.includes('const JOURNEY_ICO={') && !lq.includes('journey-tool-icon.is-ico'), 'les icônes fines de 17 h 35 sont parties');
  const ctx = vm.createContext({ lqStkSvg: k => `<svg data-stk="${k}"></svg>`, journeyIcon: k => `<svg data-trait="${k}"></svg>` });
  vm.runInContext(cut('const JOURNEY_STK=', ';\n') + ';\n' + cut('function journeyToolIcon(kind){', '\n}\n') + '\n}\n', ctx);
  const vus = {};
  for (const k of ['defis', 'console', 'cards', 'stickers', 'notes', 'interview', 'sgbd', 'courses']) {
    const h = vm.runInContext(`journeyToolIcon('${k}')`, ctx);
    assert.ok(h.startsWith('<span class="journey-tool-icon is-stk"><svg data-stk="'), k);
    vus[k] = h.match(/data-stk="(\w+)"/)[1];
  }
  assert.deepEqual(vus, { defis: 'trophy', console: 'term', cards: 'cards', stickers: 'peel', notes: 'note', interview: 'mic', sgbd: 'db', courses: 'book' });
  /* Les autocollants de Mon compte et ceux des lignes : penchés, un sur deux de l’autre côté, ils se redressent au toucher */
  for (const k of ['html.lq #app .journey-resource .journey-tool-icon.is-stk{width:54px;height:54px;background:none!important;border-radius:0!important;overflow:visible;rotate:-6deg;',
    'html.lq #app .journey-resource:nth-child(even) .journey-tool-icon.is-stk{rotate:6deg}',
    'html.lq #scr-compte .account-setting-row:nth-child(even) .plus-row-icon.is-stk{rotate:6deg}'])
    assert.ok(lq.includes(k), k);
  /* Les feuilles et le cache rafraîchis */
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=313">'));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-11-paywall-devise-v2858';"));
});
