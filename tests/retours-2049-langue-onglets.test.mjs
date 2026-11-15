/* Elisa, 15 novembre, 20 h 49 : « et les pages qui arrivent pour les stickers niveau points et tout c'est traduit ? pouvoir changer la
   langue dans compte (après afficher le drapeau) et dans l'onboarding mettre en dessous de pays (présélectionner la langue et pouvoir
   changer par anglais et français si on a envie (de manière UI UX) ; d'ailleurs quand on clique sur un onglet pousser vers le haut à
   chaque fois ». */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };

test('l’onboarding : la langue de l’appli sous le pays, déjà choisie, l’autre d’un appui', () => {
  assert.ok(app.includes("<u>Choisir dans la liste</u>'}</button>${obLangueHTML()}</div>`;"), 'sous « Ce n’est pas ton pays ? Modifier »');
  const code = cut('function langueDrapeau(c){', 'function openLegal(kind){') + cut('function obLangueHTML(){', 'function obPaysListe(){');
  const ctx = {window: {}, esc: s => String(s), prefersReduceMotion: () => true, obLock: false, obRepriseGarder: s => { ctx.garde = s; }};
  vm.runInNewContext(code + ';this.ob=obLangueHTML;this.choix=obLangueChoisir;', ctx);
  assert.equal(ctx.ob(), '', 'sans le moteur : rien');
  ctx.window.REQUETE_LANGUE = {code: 'fr', disponibles: () => ['fr'], nom: c => c};
  assert.equal(ctx.ob(), '', 'une seule langue proposée (l’anglais en essai) : rien');
  let change = null;
  ctx.window.REQUETE_LANGUE = {code: 'fr', disponibles: () => ['fr', 'en'], nom: c => ({fr: 'Français', en: 'English'})[c], changer: c => { change = c; return true; }};
  const h = ctx.ob();
  assert.ok(h.includes('<p class="ob-langue-t" id="ob-langue-t">Langue de l’appli</p>') && h.includes('role="radiogroup" aria-labelledby="ob-langue-t"'));
  assert.ok(h.includes('class="ob-langue-c on" role="radio" aria-checked="true" lang="fr" data-notrad onclick="obLangueChoisir(\'fr\',this)"><span class="lg-drapeau" aria-hidden="true">🇫🇷</span><span class="lg-nom">Français</span>'), 'la langue en cours, déjà choisie');
  assert.ok(h.includes('class="ob-langue-c" role="radio" aria-checked="false" lang="en" data-notrad onclick="obLangueChoisir(\'en\',this)"><span class="lg-drapeau" aria-hidden="true">🇺🇸</span><span class="lg-nom">English</span>'));
  ctx.setTimeout = f => f();
  vm.runInNewContext('obLangueChoisir("en",null)', ctx);
  assert.equal(ctx.garde, 'pays', 'la page et les réponses gardées : l’onboarding reprend ici, dans l’autre langue');
  assert.equal(change, 'en');
  assert.ok(app.includes("valeur('prenom',()=>state.name||(typeof draft!=='undefined'&&draft&&draft.name)||'')"), 'le prénom tapé pendant l’onboarding');
});

test('les pages qui arrivent : plusieurs stickers gagnés, leurs noms traduits ; les jours de la flamme dans la langue', () => {
  const f = cut('function stkNomsListe(infos){', '\n}\n') + '\n}';
  const ctx = {window: {REQUETE_LANGUE: {code: 'en'}}, esc: s => String(s), natifT: s => ({'Premier défi réussi': 'First challenge solved', '10 leçons': '10 lessons'})[s] || s};
  vm.runInNewContext(f + ';this.r=stkNomsListe([{name:"Premier défi réussi"},{name:"10 leçons"}]);', ctx);
  assert.equal(ctx.r, '“First challenge solved” and “10 lessons”');
  const fr = {window: {REQUETE_LANGUE: {code: 'fr'}}, esc: s => String(s)};
  vm.runInNewContext(f + ';this.r=stkNomsListe([{name:"A"},{name:"B"},{name:"C"}]);', fr);
  assert.equal(fr.r, '«&nbsp;A&nbsp;», «&nbsp;B&nbsp;» et «&nbsp;C&nbsp;»', 'en français : comme avant');
  const j = cut('function joursInitiales(lundi){', '\n}\n') + '\n}';
  const en = {window: {REQUETE_LANGUE: {code: 'en', locale: 'en-US'}}};
  vm.runInNewContext(j + ';this.a=joursInitiales(true).join("");this.b=joursInitiales(false).join("");', en);
  assert.equal(en.a, 'MTWTFSS'); assert.equal(en.b, 'SMTWTFS');
  const f2 = {window: {REQUETE_LANGUE: {code: 'fr'}}};
  vm.runInNewContext(j + ';this.a=joursInitiales(true).join("");', f2);
  assert.equal(f2.a, 'LMMJVSD');
});
