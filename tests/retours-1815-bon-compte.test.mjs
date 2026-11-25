/* Elisa, 24 novembre, 17 h 45 : inscrite avec Google, elle s’était reconnectée avec Apple (« il me reconnaît plus, j’ai plus rien ») ;
   18 h 15 : « Corrige pour tous ». Pour l’appli, Apple et Google sont deux comptes : un compte neuf derrière « J’ai déjà un compte »,
   ou un compte qui n’a pas le pseudo de « C’est le mien », et l’appli propose de se connecter avec l’autre fournisseur. Le parcours
   complet est joué sur le faux nuage (connexion, déconnexion, appli réinstallée, changement de fournisseur, sans compte, suppression). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const en = fs.readFileSync(new URL('../langue-en.js', import.meta.url), 'utf8');
const entre = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('l’autre fournisseur, et les deux questions', async () => {
  const js = entre('const FOURNISSEUR_NOMS=', '\nasync function compteQuitterNeuf(){');
  const vues = [];
  const ctx = vm.createContext({obFournisseurOk: f => f !== 'interdit', lqAsk: o => { vues.push(o); return Promise.resolve(o.reponse ?? true); }});
  vm.runInContext(js + '\nthis.compteAutreFournisseur=compteAutreFournisseur;this.compteProposerAutre=compteProposerAutre;', ctx);
  assert.equal(ctx.compteAutreFournisseur('apple'), 'google');
  assert.equal(ctx.compteAutreFournisseur('google'), 'apple');
  assert.equal(ctx.compteAutreFournisseur('email'), '');
  assert.equal(await ctx.compteProposerAutre('apple', 'google'), true);
  assert.deepEqual(JSON.parse(JSON.stringify(vues[0])), {ico: '🔑', titre: 'Ce compte est nouveau',
    texte: 'Aucune progression n’est enregistrée sur ce compte Apple. Si tu avais utilisé Google la première fois, connecte-toi avec Google pour tout retrouver.',
    oui: 'Me connecter avec Google', non: 'Continuer avec ce compte'});
  await ctx.compteProposerAutre('apple', 'google', '@lea_sql');
  assert.equal(vues[1].titre, 'Ce pseudo est sur un autre compte');
  assert.equal(vues[1].texte, '@lea_sql n’est pas sur ce compte Apple. Si tu avais utilisé Google la première fois, connecte-toi avec Google pour retrouver ton pseudo et ta progression.');
  assert.equal(vues[1].non, 'Choisir un autre pseudo');
  for (const k of ['"Ce compte est nouveau": "This account is new"', '"Me connecter avec {x1}": "Sign in with {x1}"', '"Continuer avec ce compte": "Continue with this account"',
    '"Ce pseudo est sur un autre compte": "This username is on another account"', '"Choisir un autre pseudo": "Choose another username"',
    '"Aucune progression n’est enregistrée sur ce compte {x1}. Si tu avais utilisé {x2} la première fois, connecte-toi avec {x3} pour tout retrouver.":',
    '"{x1} n’est pas sur ce compte {x2}. Si tu avais utilisé {x3} la première fois, connecte-toi avec {x4} pour retrouver ton pseudo et ta progression.":'])
    assert.ok(en.includes(k), k);
});

test('« J’ai déjà un compte » sur un compte neuf : l’autre fournisseur est proposé avant les questions', () => {
  const f = entre('async function obStartAuth(provider,btn){', '\n}\n');
  assert.ok(f.includes("const autreF=typeof compteAutreFournisseur==='function'?compteAutreFournisseur(provider):'';\n        if(autreF&&!obAutreEssaye&&await compteProposerAutre(provider,autreF)){compteChangerFournisseur(autreF);return;}"));
  assert.ok(f.indexOf('compteProposerAutre(provider,autreF)') < f.lastIndexOf("obGoto('questions');"), 'la question, puis les questions de l’onboarding');
  const c = entre('async function compteChangerFournisseur(a){', '\n}\n');
  assert.ok(c.includes('await compteQuitterNeuf();') && c.includes('return obStartAuth(a,null);'));
  const q = entre('async function compteQuitterNeuf(){', '\n}\n');
  assert.ok(q.includes('window.REQUETE_AUTH.signOut()') && q.includes("state.accountMode='guest';delete state.accountProvider;delete state.accountLabel;save();"));
});

test('« C’est le mien », puis un compte qui n’a pas ce pseudo : l’autre fournisseur est proposé ; non, la page du pseudo', () => {
  assert.ok(app.includes("if(n){s.psVoulu=n;s.psMienDit=1;}s.psPage=1;save();"), '« C’est le mien » est noté');
  assert.ok(app.includes("if(salleSrc.psMienDit&&salle.psVoulu)salle.psMienDit=1;"), 'gardé d’un lancement à l’autre');
  const x = entre('function psExiger(suite){', '\n}\n');
  assert.ok(x.includes("const s=clsSalle(),mienDit=!!s.psMienDit;delete s.psVoulu;delete s.psMienDit;save();"));
  assert.ok(x.includes("autreF=r.raison==='pris'&&mienDit&&cs&&typeof compteAutreFournisseur==='function'?compteAutreFournisseur(prov):'';"));
  assert.ok(x.includes("if(autreF){compteProposerAutre(prov,autreF,r.voulu).then(ok=>{if(ok){suite();compteRelierAutre(autreF);}else ouvrir({raison:r.raison,idees:r.idees,voulu:r.voulu});});return;}"));
  const r = entre('async function compteRelierAutre(a){', '\n}\n');
  assert.ok(r.includes("startOnboarding('account');") && r.includes('obStartAuth(a,null)'));
});
