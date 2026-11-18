/* 18 novembre, 17 h 24 (Elisa, après « j’ai supprimé l’application et j’arrive plus à me connecter » : « @elisabhty » était « déjà
   pris » par l’ancienne clé de son iPhone ; « je veux ça plutôt : Se connecter avec Apple… Oui, elle garde automatiquement le pseudo,
   pas besoin de demander, et tout ce qui suit, tout ce qui a été sauvegardé »). Le compte rapporte déjà pseudo, points et progression
   (csSync → csJeu) ; il fallait le proposer :
   - pendant l’onboarding, sous un pseudo « déjà pris » : « C’est mon pseudo : je me connecte » ;
   - juste après le choix du pseudo, la feuille du compte : « Garde @pseudo et tes points ». */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), obv = lire('onboarding-vitrine.css'), en = lire('langue-en.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

const page = ({onboarded = false, accountMode = null, auth = true, pseudo = '', draft = {}} = {}) => {
  const appels = [];
  const ctx = vm.createContext({
    appels, state: {onboarded, accountMode}, draft, obEntry: 'pseudo', obAuthBusy: false, PS: {suite: () => 1, siOk: null, page: {garder: true, obligatoire: true, voulu: '@elisabhty', raison: 'pris', suite: () => 1}},
    esc, escAttr: esc, psForme: v => (v ? '@' + String(v).replace(/^@+/, '').toLowerCase() : ''), psMien: () => pseudo,
    obAuthReady: () => auth, obCompteVisible: () => true, buzz() {},
    obGoto: k => appels.push(['obGoto', k]), psPage: o => appels.push(['psPage', o]),
    closeOnboardingAuth: () => appels.push(['ferme']), obApresCompte: () => appels.push(['paywall']),
  });
  vm.runInContext(cut('function psRetrouvable(scope){', '\nfunction psPeut(scope,v){') + cut('function obSansCompte(){', '\nfunction obPasserConnexion(){'), ctx);
  return {ctx, appels, run: c => vm.runInContext(c, ctx)};
};

test('sous « déjà pris », pendant l’onboarding : « C’est mon pseudo : je me connecte », après les pseudos libres', () => {
  const aff = cut('function psAfficher(scope,etat,v,idees){', '\n}\n');
  assert.ok(aff.includes("+(etat==='pris'&&psRetrouvable(scope)?`<button type=\"button\" class=\"ps-retrouver\" style=\"--i:${id.length}\" data-v=\"${escAttr(v)}\" onclick=\"psRetrouver(this.dataset.v)\">C’est mon pseudo&nbsp;: je me connecte</button>`:''):'';"));
  assert.ok(obv.includes('html #onboarding.ob-vitrine .ob-pseudo .ps-retrouver{flex-basis:100%;'), 'sur sa propre ligne, en lien jaune');
  assert.equal(page().run("psRetrouvable('ob')"), true);
  assert.equal(page().run("psRetrouvable('compte')"), false, 'seulement la page de l’onboarding');
  assert.equal(page({onboarded: true}).run("psRetrouvable('ob')"), false, 'l’app déjà ouverte : pas de réinstallation');
  assert.equal(page({accountMode: 'connected'}).run("psRetrouvable('ob')"), false, 'déjà connecté : le pseudo est celui du compte');
  assert.equal(page({auth: false}).run("psRetrouvable('ob')"), false, 'sans connexion (le site)');
});

test('le toucher : la connexion s’ouvre ; « Choisir un autre pseudo » ou Retour ramène à la page du pseudo, telle quelle', () => {
  const x = page();
  x.run("psRetrouver('@ElisaBhty')");
  assert.deepEqual(JSON.parse(JSON.stringify(x.appels)), [['obGoto', 'account']]);
  assert.equal(x.run('draft.retrouver.pseudo'), '@elisabhty');
  assert.equal(x.run('PS.suite'), null, 'la page du pseudo n’a plus la main');
  const h = x.run('obSansCompteHTML()');
  assert.ok(h.includes('>Choisir un autre pseudo</button>') && !h.includes('ob-sans-compte-note'));
  assert.deepEqual(JSON.parse(JSON.stringify(x.run('obCompteTextes()'))), {titre: 'Retrouve <em>@elisabhty</em>.',
    sous: 'Connecte-toi avec le compte où tu l’as gardé&nbsp;: ton pseudo, tes points et ta progression reviennent.'});
  x.run('obSansCompte()');
  const [nom, o] = x.appels.at(-1);
  assert.equal(nom, 'psPage');
  assert.equal(o.garder && o.obligatoire && typeof o.suite, 'function', 'la même page : obligatoire, gardée, sa suite');
  assert.equal(o.raison, '', 'le message « déjà pris » repart avec le champ vide');
  assert.equal(x.run('draft.retrouver'), undefined);
  assert.equal(x.run('draft.accountMode'), undefined, 'pas « sans compte » pour autant');
  const back = cut('function obBack(){\n  if(obLegalMode)', '\n}\n');
  assert.ok(back.indexOf("if(OB_SLIDES[obStep]==='account'&&typeof psRetrouverAnnuler==='function'&&psRetrouverAnnuler())return;")
    < back.indexOf("if(OB_SLIDES[obStep]==='account'){obGoto(draft.finVoulue?'ready':'bonjour');return;}"));
});

test('connecté : plus rien à demander, le pseudo du compte revient avec lui (csSync → csJeu)', () => {
  const auth = cut('async function obStartAuth(provider,btn){', '\n/* Elisa, 31 octobre, 8 h 37');
  assert.ok(auth.includes("draft.accountMode='connected';\n    if(draft.retrouver)delete draft.retrouver;"));
  assert.ok(auth.indexOf("csSync({premier:true});   // 12 novembre") < auth.indexOf('if(draft.retrouver)delete draft.retrouver;'));
  assert.ok(cut('function csSync(o){', '\n}\n').includes('try{await csJeu(cs.user);}catch(e){}'), 'le pseudo, les points et les parties suivent le compte');
});

test('juste après le choix du pseudo : « Garde @pseudo et tes points » ; sans compte, ce que ça veut dire', () => {
  const x = page({pseudo: '@lea_sql', draft: {finVoulue: 'home'}});
  assert.deepEqual(JSON.parse(JSON.stringify(x.run('obCompteTextes()'))), {titre: 'Garde <em>@lea_sql</em> et tes points.',
    sous: 'Connecte-toi&nbsp;: même sur un autre iPhone ou après avoir supprimé l’app, tu retrouves ton pseudo, tes points et ta progression.'});
  assert.ok(x.run('obSansCompteHTML()').includes('>Continuer sans compte</button><p class="ob-sans-compte-note">Sans compte, ton pseudo et tes points restent sur cet iPhone&nbsp;: supprimer l’app les efface.</p>'));
  assert.equal(page().run('obCompteTextes()'), null, 'sans pseudo : les textes d’avant');
  assert.equal(page({pseudo: '@lea_sql', accountMode: 'connected'}).run('obCompteTextes()'), null);
  const feuille = cut("}else if(slide==='account'){", "}else if(slide==='paywall'){");
  assert.ok(feuille.includes("const obCt=typeof obCompteTextes==='function'?obCompteTextes():null;"));
  assert.ok(feuille.includes('${obCt?`<h1 class="ob-title" id="ob-title">${obCt.titre}</h1>'));
});

test('en anglais aussi', () => {
  for (const k of ['"C’est mon pseudo : je me connecte": "That’s my username: sign in"', '"Choisir un autre pseudo": "Choose another username"',
    '"Retrouve <1>{p1}</1>.": "Get <1>{p1}</1> back."', '"Garde <1>{pseudo}</1> et tes points.": "Keep <1>{pseudo}</1> and your points."'])
    assert.ok(en.includes(k), k);
});
