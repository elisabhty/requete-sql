/* 18 novembre, 12 h 22 (Elisa, capture de la page du pseudo : « @elisabhty est déjà pris ») : « J’ai supprimé l’application et il ne me
   reconnaît plus niveau pseudo ». Le pseudo tient au compte, mais l’onboarding demande le pseudo avant la connexion. Sans compte
   connecté, sous les pseudos libres : « C’est le mien, je me connecte juste après » ; la page se ferme sans rien réserver, le pseudo
   est gardé (psVoulu, la fin de l’onboarding ne le redemande pas) et la connexion rend au compte son joueur, son pseudo et ses points. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), lq = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8'), en = fs.readFileSync(path.join(ROOT, 'langue-en.js'), 'utf8');

test('« C’est le mien » : seulement pendant l’onboarding, pseudo pris, sans compte connecté', () => {
  assert.ok(app.includes("const mien=etat==='pris'&&scope==='ob'&&!!(PS.page&&PS.page.garder)&&!(typeof csPret==='function'&&csPret());"));
  assert.ok(app.includes('onclick="psCestLeMien()">C’est le mien, je me connecte juste après</button>'));
});
test('il ferme la page sans rien réserver et garde le pseudo pour la fin de l’onboarding', () => {
  const f = app.slice(app.indexOf('function psCestLeMien(){'), app.indexOf('function psPageFin(ok){'));
  assert.ok(f.includes('if(n)s.psVoulu=n;s.psPage=1;save();') && f.includes('psPageFin(false);') && !f.includes('psPrendre'));
  /* 24 novembre, 17 h 18 (« j’ai pu m’inscrire sans pseudo c’est pas normal ») : la fin de l’onboarding ne laisse plus passer un pseudo
     seulement gardé ; elle attend le compte relié, puis le réserve, et la page revient s’il est pris (retours-1649, psExiger). */
  assert.ok(app.includes("if(!psMien()&&typeof psPage==='function'){psExiger(()=>obTerminer(action));return;}"), 'la fin de l’onboarding exige un pseudo réservé');
  assert.ok(app.includes('s.cle=cle;s.cleCompte=1;delete s.clsId;delete s.clsRefus;delete s.psVoulu;'), 'à la connexion, le joueur du compte');
});
test('le lien et le message, en anglais aussi', () => {
  assert.ok(lq.includes('.ps-mien{flex-basis:100%;min-height:44px;'));
  assert.ok(en.includes('"C’est le mien, je me connecte juste après": "It’s mine, I’ll sign in next"'));
  assert.ok(en.includes('"Connecte-toi juste après : ton compte retrouve {x1} et tes points.": "Sign in next: your account gets {x1} and your points back."'));
});
