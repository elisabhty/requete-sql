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

/* 16 novembre, 0 h 53 (Elisa : « oui » à vider l’iPhone quand on passe à un autre compte) */
test('un autre compte sur le même iPhone : l’appareil se vide du compte d’avant, un compte neuf repasse par les questions', () => {
  const i = app.indexOf('function compteAutre(id){'), f = app.slice(i, app.indexOf('\n}\n', i));
  const ls = new Map(), ctx = {localStorage: {getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k), get length() { return ls.size; }, key: n => [...ls.keys()][n]}};
  vm.runInNewContext("const COMPTE_DERNIER='requete-compte-dernier';" + f + '\n}\nthis.compteAutre=compteAutre;', ctx);
  assert.equal(ctx.compteAutre('u-1'), false, 'premier compte sur cet iPhone');
  ls.set('requete-compte-premier:u-1', '1');
  assert.equal(ctx.compteAutre('u-1'), false, 'connecté avant cette version : le même');
  assert.equal(ctx.compteAutre('u-2'), true, 'connecté avant cette version : un autre');
  ls.set('requete-compte-dernier', 'u-2');
  assert.equal(ctx.compteAutre('u-2'), false); assert.equal(ctx.compteAutre('u-1'), true);
  const v = app.slice(app.indexOf('function compteViderPourAutre(){'), app.indexOf('\n}\n', app.indexOf('function compteViderPourAutre(){')));
  assert.ok(v.includes('const garde={onboarded:state.onboarded,preferences:state.preferences,salle:state.salle,parcoursPush:state.parcoursPush};') && v.includes('state=normalizeState(garde);'),
    'seuls les réglages et le joueur restent');
  const a = app.slice(app.indexOf('async function obStartAuth('), app.indexOf('\n}\n', app.indexOf('async function obStartAuth(')));
  assert.ok(a.indexOf('const autre=') < a.indexOf("state.accountMode='connected';"), 'comparé avant de toucher à l’appareil');
  assert.ok(a.includes("if(autre){compteViderPourAutre();try{localStorage.removeItem('requete-compte-premier:'+result.id);}catch(e){}}"), 'revenu : son planning revient');
  assert.ok(a.includes("if(autre&&obEntry==='account'&&state.onboarded){") && a.includes("obGoto('questions');"), 'compte neuf : les questions');
  const d = app.slice(app.indexOf('async function seDeconnecter(){'), app.indexOf('\n}\n', app.indexOf('async function seDeconnecter(){')));
  assert.ok(d.indexOf('await Promise.race([csSync(),') > 0 && d.indexOf('await Promise.race([csSync(),') < d.indexOf('REQUETE_AUTH.signOut()'), 'la dernière synchro avant de partir');
  assert.ok(app.includes('CS.user=u.id;CS.prog=M.createProgressionSync(o);CS.docs=M.createDocumentsSync(o);\n    try{localStorage.setItem(COMPTE_DERNIER,u.id);}catch(e){}'));
});

/* 16 novembre, 0 h 53 (Elisa : « les stickers mettent bcp de temps à se charger ») */
test('stickers : petite version pour la planche, décodée à l’avance, préparée au calme', () => {
  assert.ok(app.includes('const STK_PETIT=400;'));
  assert.ok(app.includes("window.addEventListener('load',()=>setTimeout(()=>{try{if(state&&state.onboarded)stkPrecharger();}catch(e){}},4000));"));
  assert.ok(app.includes("if(draft.practiceDone&&typeof stkImgO==='function')try{stkImgO('requete',false);stkImgO('niv1',false);}catch(e){}"), 'la page Niveau 1 de la fin de l’onboarding');
  assert.ok(app.includes('if(mi>=0&&typeof stkImgO===\'function\'&&STK_MODULE_IDS[mi])stkImgO(STK_MODULE_IDS[mi],false);'), 'le sticker du module, dès la leçon ouverte');
});

/* 16 novembre, 1 h 15 (Elisa : « ok ») : sur un 2e iPhone, « J’ai déjà un compte » montre la page du rappel, seule */
test('2e iPhone : la page du rappel seule après la connexion, puis la suite', () => {
  const a = app.slice(app.indexOf('async function obStartAuth('), app.indexOf('\n}\n', app.indexOf('async function obStartAuth(')));
  assert.ok(a.includes("if(typeof obRappelSeulVoulu==='function'&&obRappelSeulVoulu()){draft.rappelSeul=true;obGoto('rappel');}\n        else obApresCompte();"));
  assert.ok(app.includes("return localStorage.getItem('requete-rappel')==null;"), 'jamais demandé sur cet iPhone');
  assert.ok(app.includes("if(typeof draft!=='undefined'&&draft&&draft.rappelSeul){draft.rappelSeul=false;obApresCompte();return;}"), 'puis l’abonnement ou l’accueil');
  for (const f of ['async function obRappelDemander(){', 'function obRappelRefuser(){']) {
    const i = app.indexOf(f); assert.ok(app.slice(i, i + 120).includes('const suite=obRappelSuite;'), f);
  }
  assert.ok(app.includes("if(OB_SLIDES[obStep]==='rappel'&&draft&&draft.rappelSeul)return;"), 'pas de retour en arrière');
  assert.ok(app.includes("if(slide==='rappel'&&typeof draft!=='undefined'&&draft&&draft.rappelSeul)return '<div class=\"ob-flow-top ob-flow-solo\"></div>';"), 'ni étapes');
  assert.equal(textes['Un petit <1>rappel</1><2/>chaque jour ?'], 'A little <1>reminder</1><2/>every day?');
  assert.ok(app.includes("if(typeof obLangue==='function'&&obLangue()&&typeof rappelHeureLoc==='function')return rappelHeureLoc(h||'19:00',1);"), '« Remind me at 7 PM »');
});

/* 16 novembre, 2 h 17 (Elisa, sa capture sur l’iPhone 15 : « SELECT first_name, last_name, email » sort de l’écran, « Fais attention à
   ce genre de chose ») : en anglais, la requête des deux pièges est plus petite ; et la vérification des vidéos regarde aussi les boîtes. */
test('vidéos : la requête des deux pièges tient dans l’écran ; les boîtes qui sortent de la scène sont relevées', () => {
  const v = fs.readFileSync(path.join(ROOT, 'assets/anim/bases-relationnelles.html'), 'utf8');
  assert.ok(v.includes('html[lang="en"] #qdemo .codepill{font-size:44px;padding:0 34px}'));
  /* 35 caractères de JetBrains Mono (0,6 em) à 44 px, plus le rembourrage : moins que les 1 080 px de la scène, avec de la marge */
  assert.ok(35 * 0.6 * 44 + 2 * 34 < 1080 - 2 * 40);
  const ver = fs.readFileSync(path.join(ROOT, 'tools/langue/verifier.mjs'), 'utf8');
  assert.ok(ver.includes("out.push('boîte-hors-scène|'"));
});
