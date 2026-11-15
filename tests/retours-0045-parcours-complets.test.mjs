/* 16 novembre, nuit (Elisa : « tester plusieurs parcours à partir de la connexion, connexion avec synchro, défi etc. pour voir si on
   peut pousser en prod ou corriger des choses ») : ce que les parcours de bout en bout (iPhone simulé, faux serveur, deux appareils)
   ont trouvé et ce qui a été corrigé.
   - Un compte neuf envoyait 71 fiches de leçon vides ({level:0}, juste prévues au planning), une par une, avant son planning.
   - Supprimer son compte laissait les rappels programmés (100 et plus, et « Plus tard ») : ils sonnaient encore des semaines.
   - « Plus tard » touché à minuit et demi programmait un rappel à 1 h 38.
   - Sur un iPhone neuf, « J’ai déjà un compte » ouvrait « Niveau 1 ! Ta toute première requête SQL a marché ».
   - Onboarding en anglais : « J+1 » (Day 1), « 1,5× » (1.5×), « Étudiant, en poste… » (la bulle au masculin et au neutre),
     « ≈ 20 min » coupé, « Engine », « Tap “Run” » alors que le bouton dit « Run the query ».
   - En anglais, encore en français : « Bon retour ! », « Il en reste 6 à enflammer », « En cours · Module 2 », « Demain · mar. 17 nov. »,
     et plusieurs textes lus à voix haute. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const en = fs.readFileSync(path.join(ROOT, 'langue-en.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'onboarding-vitrine.css'), 'utf8');
const textes = (() => { const ctx = {window: {REQUETE_LANGUE: {charger: (c, o) => { ctx.o = o; }}}}; ctx.window.window = ctx.window; vm.runInNewContext(en, ctx); return ctx.o.textes; })();

test('la synchro du compte ne part pas avec les leçons seulement prévues', () => {
  const i = app.indexOf('function csExtraire(){'), f = app.slice(i, app.indexOf('\n}\n', i));
  assert.ok(f.includes("if(!c.done&&!c.at&&!c.due&&!(c.level>0)&&!(c.etapes&&Object.keys(c.etapes).length))continue;"));
  assert.ok(f.indexOf('continue;') < f.indexOf('lessons[id]=c;'), 'avant de la garder');
});

test('supprimer son compte annule tous les rappels programmés, « Plus tard » compris', () => {
  const i = app.indexOf('async function compteSupprimer(){'), f = app.slice(i, app.indexOf('\n}\n', i));
  assert.ok(f.includes('[...RAPPEL_IDS,RAPPEL_PLUS_TARD_ID]'));
  assert.ok(/const RAPPEL_IDS=\[1,11,12,13,14,15,16,17,\.\.\.Array\.from\(\{length:64\},\(_,i\)=>100\+i\)\];/.test(app), 'les rappels 100 à 163');
});

test('le niveau rapporté par le compte n’ouvre pas sa page sur l’autre appareil', () => {
  const i = app.indexOf('function csSync(o){'), f = app.slice(i, app.indexOf('\n}\n', i));
  assert.ok(f.includes('try{const a=nivRangAtteint();if(nivRangVu()<a){stkState().rang=a;save();}}catch(e){}'));
  assert.ok(f.indexOf('stkSync&&stkSync();') < f.indexOf('nivRangAtteint()'), 'après les stickers gagnés en silence');
});

test('onboarding en anglais : jours, chiffre, bulle, séance type, moteur, bouton', () => {
  assert.ok(app.includes("const jPas=String((typeof natifT==='function'&&natifT('J+{1}'))||'J+{1}');"));
  assert.ok(app.includes('aria-label="Révisions à ${jN.map(n=>\'J+\'+n).join(\', \')}"'), 'la phrase lue garde sa clé française');
  assert.equal(textes['J+{1}'], 'Day {1}');
  assert.ok(/html:not\(\[lang="fr"\]\) #onboarding\.ob-vitrine \.ob-me-j span\{[^}]*white-space:nowrap/.test(css), 'cinq pastilles sur une ligne');
  assert.ok(app.includes("const dire=v=>{n.textContent=v.toLocaleString(typeof obLoc==='function'?obLoc():'fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});};"));
  assert.ok(!/n\.textContent='1,5'/.test(app));
  for (const k of ['Étudiante', 'Étudiant', 'Étudiant·e']) assert.equal(textes[`${k}, en poste ou en reconversion : tout le monde a sa place ici.`], 'Student, employed or changing careers: everyone belongs here.');
  assert.ok(app.includes('· ≈ ${obRythmeMinutes(r)} min</b>.'));
  assert.ok(textes['Ta séance type : <1>{1} activités · ≈ {2} min</1>.'].includes('≈ {2} min'));
  assert.equal(textes['Moteur'], 'Built-in');
  assert.match(textes['Clique sur « Exécuter » pour afficher les clients qui habitent à Paris dans la table clients.'], /“Run the query”/);
});

test('anglais : les textes restés en français dans les parcours', () => {
  for (const k of ['Bon retour !', 'Il en reste <1>{1}</1> à enflammer cette semaine.', '<1>En cours</1> · Module {1}', '<1>À commencer</1> · Module {1}',
    'Demain · {x1}', 'Ces {1} derniers jours : <1>{x1}</1>, {x2}.', '{1} de plus que les {2} jours d’avant', '{m1}, aujourd’hui : {1} activités sur {2}',
    '{1} activité aujourd’hui', '{1} % du parcours validé : {2} leçons sur {3} activités', 'Aujourd’hui · {1} activités', '{1} leçons · ~{2} min · {3}/{4}',
    'Avancement global<1>{1} activités validées sur {2}</1><2><3></3></2>', '{1} activités · {2} jour actif', 'Continuer {x1}', 'Modifier mon profil. {prenom}, pseudo {p1}'])
    assert.ok(typeof textes[k] === 'string' && textes[k].length, k);
  assert.ok(app.includes("const date=parseD(iso).toLocaleDateString(typeof obLoc==='function'?obLoc():'fr-FR',{weekday:'short',day:'numeric',month:'short'});"));
});
