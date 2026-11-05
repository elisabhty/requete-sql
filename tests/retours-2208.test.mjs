/* Elisa, 4 novembre, 22 h 08 : « pour les requêtes à refaire et correction douteuse je te laisse la main ». Huit défis ont une
   nouvelle solution. Ils sont restés hors des salles le temps de redéployer le serveur de vérification avec elle (version 11,
   4 novembre, 23 h, « Oui, déploie ») : les revoilà dans les salles. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const catalog = JSON.parse(fs.readFileSync(new URL('../supabase/functions/jeu-verifier/catalog.json', import.meta.url), 'utf8'));
const HUIT = ['sm9', 'sd3', 'zm8', 'zd6', 'ld1', 'ld9', 'vm4', 'wf2'];

test('les huit défis refaits reviennent dans les salles : le serveur a leur nouvelle solution', () => {
  assert.ok(!app.includes('JEU_ATTENTE_SERVEUR'), 'plus de mise à l’écart');
  const ctx = vm.createContext({});
  vm.runInContext(app.slice(app.indexOf('const CHALLENGES=['), app.indexOf('const NIV=')).replace('const CHALLENGES=', 'CHALLENGES=') + ';' +
    app.slice(app.indexOf('function jeuEligible(c){'), app.indexOf('\n', app.indexOf('function jeuEligible(c){'))) + ';' +
    app.slice(app.indexOf('function jeuChallenges(niv){'), app.indexOf('\n', app.indexOf('function jeuChallenges(niv){'))), ctx);
  const ids = vm.runInContext("['f','m','d'].flatMap(n=>jeuChallenges(n)).map(c=>c.id)", ctx);
  for (const id of HUIT) {
    assert.ok(ids.includes(id), id + ' : tiré en salle');
    assert.equal(vm.runInContext(`jeuEligible(CHALLENGES.find(c=>c.id==='${id}'))`, ctx), true, id);
  }
  assert.equal(ids.length, 267);
  for (const id of HUIT) assert.equal(catalog.challenges.find(c => c.id === id).sol, vm.runInContext(`CHALLENGES.find(c=>c.id==='${id}').sol`, ctx), id + ' : le catalogue du serveur a la nouvelle solution');
});

/* 22 h 08 : « dans compte il manque évaluez-nous » ; « le bouton exporter la progression est vraiment cohérent par rapport au fichier
   qu’elle donne ? […] une interaction qui dit fichier exporté alors qu’on a juste cliqué » ; « mettre se déconnecter aussi » ;
   « suppression du compte » ; « toutes les choses obligatoires pour passer la validation Apple en sérénité ». */
const swift = fs.readFileSync(new URL('../resources/ios/widget/App/RequeteWidgetPlugin.swift', import.meta.url), 'utf8');
const widget = fs.readFileSync(new URL('../scripts/ios-widget.mjs', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('Mon compte : noter l’appli sur l’App Store, se déconnecter, supprimer son compte', () => {
  assert.ok(app.includes("${appliNative()?`<button class=\"account-setting-row\" type=\"button\" onclick=\"noterAppli()\">"), 'noter : dans l’app iPhone');
  assert.ok(app.includes("const APP_STORE_ID='6830361256';") && app.includes('itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review'), 'la page « Écrire un avis » de la fiche');
  assert.ok(app.includes("${connected?`<button class=\"account-setting-row\" type=\"button\" onclick=\"seDeconnecter()\">"), 'se déconnecter : avec un compte connecté');
  assert.ok(app.includes('<button class="account-setting-row is-danger" type="button" onclick="compteSupprimer()">'), 'supprimer : toujours là');
  const f = cut('async function compteSupprimer(){', '\n}\n');
  assert.ok(f.includes("clsRpc('compte_supprimer',{p_cle:cle})") && f.includes("clsRpc('jeu_pseudo_liberer',{p_cle:cle})"), 'le serveur d’abord, l’ancienne fonction en secours');
  assert.ok(f.indexOf("clsRpc('compte_supprimer'") < f.indexOf('localStorage.clear()'), 'l’appareil n’est vidé qu’après le serveur');
  assert.equal((f.match(/lqAsk\(/g) || []).length, 2, 'deux confirmations');
  const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
  assert.ok(css.includes('html.lq #scr-compte .account-setting-row.is-danger b{color:var(--danger)}'), 'en rouge, comme une action destructrice d’iOS');
});

test('validation Apple : dans l’app iPhone sans connexion branchée, le bravo sans les boutons « Bientôt »', () => {
  assert.ok(app.includes("function obConnexionMasquee(){return typeof appliNative==='function'&&appliNative()&&!obAuthReady();}"));
  const s = cut("}else if(slide==='account'){", "}else if(slide==='name'){");
  assert.ok(s.includes("const reussie=!!draft.practiceDone,masquee=typeof obConnexionMasquee==='function'&&obConnexionMasquee();"));
  assert.ok(s.includes("${masquee?'':`<div class=\"ob-provider-list\">"), 'pas de boutons');
  assert.ok(s.includes("${masquee?'':'<p class=\"ob-compte-sub\">Tu pourras sauvegarder ta progression et reprendre tes cours sur tous tes appareils.</p>'}"), 'pas de promesse');
  assert.ok(s.includes('Ta première requête est <em>réussie</em>&nbsp;!'), 'le bravo reste');
});

test('validation Apple : les textes de confidentialité disent la suppression de compte et la vérification en ligne', () => {
  const conf = fs.readFileSync(new URL('../decouvrir/confidentialite.html', import.meta.url), 'utf8');
  assert.ok(!app.includes('ne quittent jamais'), 'les requêtes d’une salle sont vérifiées en ligne');
  assert.equal(app.split('Tes requêtes y sont vérifiées en ligne, sans être montrées aux autres joueurs ni gardées en clair.').length - 1, 2);
  assert.ok(!app.includes('permettra de supprimer'), 'la suppression existe déjà');
  assert.ok(conf.includes('<section id="suppression"><h2>Supprimer ton compte</h2>') && conf.includes('sont effacés par nous dans le mois qui suit'));
  assert.ok(!conf.includes('permettra de supprimer le compte'));
});

test('Sauvegarder ma progression : un fichier de sauvegarde, et le message seulement une fois le fichier parti', () => {
  const f = cut('async function exportProgress(){', '\n}\n');
  assert.ok(f.includes('requete-sauvegarde-') && f.includes("C.nativePromise('RequeteWidget','partager',{nom:fileName,texte})"));
  assert.ok(f.includes('if(!how)return;') && f.indexOf('if(!how)return;') < f.indexOf('lqDone('), 'rien si on annule');
  assert.ok(app.includes('<b>Sauvegarder ma progression</b>') && app.includes('<b>Restaurer une sauvegarde</b>') && !app.includes('<b>Exporter ma progression</b>'));
  assert.ok(swift.includes('CAPPluginMethod(name: "partager", returnType: CAPPluginReturnPromise)') && swift.includes('UIActivityViewController(activityItems: [url], applicationActivities: nil)'));
  assert.ok(swift.includes('CAPPluginMethod(name: "ouvrir", returnType: CAPPluginReturnPromise)') && swift.includes('UIApplication.shared.open(url, options: [:])'));
});

test('validation Apple : la suppression de compte côté serveur, la caméra des pièces jointes', () => {
  const sql = fs.readFileSync(new URL('../supabase/migrations/20261104224931_compte_supprimer.sql', import.meta.url), 'utf8');
  for (const t of ['public.jeu_joueur', 'public.jeu_pseudo', 'public.parcours_vote', 'public.avis_lecon', 'public.onboarding_etape', 'public.contact_message', 'requete_private.membre', 'auth.users'])
    assert.ok(sql.includes('delete from ' + t), t);
  assert.ok(sql.includes('grant execute on function public.compte_supprimer(text) to anon, authenticated;'));
  assert.ok(widget.includes("['NSCameraUsageDescription', 'Pour joindre une photo à ton message dans « Contacte-nous ».']") && widget.includes("'NSPhotoLibraryUsageDescription'"));
});
