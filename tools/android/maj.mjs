// La mise à jour à distance sur Android, vérifiée sur un émulateur de GitHub (tools/android/maj.sh, travail « maj »).
// Elisa, 25 novembre, 22 h 57 : « Vérifie ».
// Le paquet installé est l’appli d’aujourd’hui qui se croit en v3100 (maj.js modifié au moment de la fabrication). Comme un vrai
// téléphone resté sur une ancienne version, elle doit :
//   1. au 1er lancement, lire l’annonce de requeteapp.com et télécharger la version publiée pour tous ;
//   2. au 2e lancement, l’installer et confirmer qu’elle démarre (sinon le module revient à la version d’avant au bout de 20 s) ;
//   3. au 3e lancement, la garder ; les voix (dans leur propre paquet sur Android) doivent toujours se lire.
// Rien n’est écrit dans le vrai nuage : les envois vers Supabase (hors lectures) sont refusés.
import { execSync } from 'node:child_process';
import { writeFileSync, readdirSync, statSync } from 'node:fs';

const adb = (c, t = 60000) => { try { return execSync('adb ' + c, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: t}); } catch (e) { return ''; } };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const rapport = {etapes: []};
let bon = true;
const note = (quoi, ok, detail) => {
  rapport.etapes.push({quoi, ok, detail});
  console.log((ok ? 'OK     ' : 'ÉCHEC  ') + quoi + (detail === undefined ? '' : ' : ' + JSON.stringify(detail)));
  if (!ok) bon = false;
  try { writeFileSync('captures/maj.json', JSON.stringify(rapport, null, 1)); } catch (e) {}
};
const capture = nom => { try { execSync(`adb exec-out screencap -p > captures/${nom}.png`, {timeout: 30000}); } catch (e) {} };

/* Une voix embarquée (son chemin dans l’appli), pour vérifier qu’elle se lit encore après la mise à jour */
const dossierVoix = readdirSync('assets/voix').find(d => statSync('assets/voix/' + d).isDirectory());
const voix = 'assets/voix/' + dossierVoix + '/' + readdirSync('assets/voix/' + dossierVoix).find(f => f.endsWith('.mp3'));

/* L’annonce publiée (ce que le téléphone doit finir par avoir) */
const annonce = await (await fetch('https://requeteapp.com/maj/version.json?t=' + Date.now())).json();
const attendue = annonce.version;
console.log('Version publiée pour tous sur requeteapp.com : v' + attendue);

let ws = null;
async function lancer() {
  try { if (ws) ws.close(); } catch (e) {}
  let page = null;
  // Jusqu’à trois essais : l’émulateur de GitHub, lent, ne montre pas toujours la page du premier coup.
  for (let essai = 1; essai <= 3 && !page; essai++) {
    adb('shell am force-stop fr.requete.app'); await dormir(1500);
    adb('shell monkey -p fr.requete.app -c android.intent.category.LAUNCHER 1');
    await dormir(30000);
    for (let i = 0; i < 20 && !page; i++) {
      const pid = adb('shell pidof fr.requete.app').trim();
      const socks = adb('shell cat /proc/net/unix').match(/webview_devtools_remote_\d+/g) || [];
      const sock = socks.find(x => x === 'webview_devtools_remote_' + pid) || socks[socks.length - 1];
      if (i % 5 === 0) console.log(`   (lancement ${essai} : processus ${pid || '?'}, ${socks.length} prise(s) de débogage)`);
      if (sock) {
        adb('forward --remove-all'); adb(`forward tcp:9222 localabstract:${sock}`);
        try { page = (await (await fetch('http://127.0.0.1:9222/json')).json()).find(c => c.type === 'page'); } catch (e) {}
      }
      if (!page) await dormir(3000);
    }
  }
  if (!page) throw new Error('aucune page dans la WebView');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
  let n = 0; const attente = new Map();
  const envoyer = (method, params = {}) => new Promise(ok => {
    const id = ++n; attente.set(id, ok); ws.send(JSON.stringify({id, method, params}));
    setTimeout(() => { if (attente.has(id)) { attente.delete(id); ok({}); } }, 25000);
  });
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && attente.has(d.id)) { attente.get(d.id)(d); attente.delete(d.id); return; }
    if (d.method === 'Fetch.requestPaused') {
      const r = d.params.request;
      if (/supabase\.co/.test(r.url) && r.method !== 'GET' && r.method !== 'OPTIONS') envoyer('Fetch.failRequest', {requestId: d.params.requestId, errorReason: 'BlockedByClient'});
      else envoyer('Fetch.continueRequest', {requestId: d.params.requestId});
    }
  };
  await envoyer('Fetch.enable', {patterns: [{urlPattern: '*supabase.co*'}]});
  const evaluer = async expr => (await envoyer('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true})).result?.result?.value;
  return {evaluer, url: page.url};
}
const ETAT = `(async () => { const M = window.REQUETE_MAJ, U = window.Capacitor && Capacitor.Plugins.CapacitorUpdater;
  let cur = null; try { cur = await U.current(); } catch (e) { cur = String(e); }
  return {version: M && M.version, etat: M && M.etat(), paquet: cur && cur.bundle ? {id: cur.bundle.id, version: cur.bundle.version, status: cur.bundle.status} : cur, natif: cur && cur.native,
    plateforme: Capacitor.getPlatform(), texte: (document.body.innerText || '').trim().length}; })()`;

// 1. Premier lancement : l’ancienne version, qui découvre la nouvelle et la télécharge
let p = await lancer();
let e = await p.evaluer(ETAT);
console.log('1er lancement :', JSON.stringify(e));
note('appli Android, module de mise à jour présent', e && e.plateforme === 'android' && e.etat && e.etat.branchee, e && e.plateforme);
note('version embarquée v3100 (le téléphone « en retard »)', e && e.version === 3100, e && e.version);
for (let i = 0; i < 48 && !(e && e.etat && e.etat.prete === attendue); i++) {
  await dormir(5000);
  e = await p.evaluer(ETAT);
  const d = e && e.etat && e.etat.dernier;
  if (i % 4 === 0) console.log('   … ' + (d ? d.quoi + (d.detail ? ' (' + d.detail + ')' : '') : 'pas encore lu'));
  if (d && d.quoi === 'vérification ratée' && i === 6) await p.evaluer('REQUETE_MAJ.verifier(true)');
}
note('nouvelle version téléchargée en arrière-plan', e && e.etat && e.etat.prete === attendue, e && e.etat);
capture('1-ancienne-version');

// 2. Deuxième lancement : la nouvelle version s’installe et confirme son démarrage
p = await lancer();
e = await p.evaluer(ETAT);
console.log('2e lancement :', JSON.stringify(e));
note('au lancement suivant, la nouvelle version tourne', e && e.version === attendue, e && e.version);
// Ce que la page charge vraiment, et ce qu’il y a dans le paquet sur le téléphone (pour comprendre un écart)
const diag = await p.evaluer(`(async () => { const nom = t => (String(t).match(/var NOM = '([^']+)'/) || [])[1];
  const a = await fetch('maj.js?v=3', {cache: 'no-store'}).then(r => r.text()).catch(e => String(e));
  const b = await fetch('maj.js?v=3').then(r => r.text()).catch(e => String(e));
  const n = performance.getEntriesByType('navigation')[0];
  return {adresse: location.href, majServi: nom(a), majCache: nom(b), script: ([...document.scripts].find(s => /maj\\.js/.test(s.src)) || {}).src,
    navigation: n && {type: n.type, transfert: n.transferSize, debut: Math.round(n.startTime)}, sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller)}; })()`);
console.log('   page :', JSON.stringify(diag));
console.log('   paquets sur le téléphone :', adb(`shell run-as fr.requete.app sh -c 'ls files/versions; for d in files/versions/*; do echo $d; grep -o "var NOM = .[^;]*" $d/maj.js; ls $d | head -5; done'`).replace(/\s+/g, ' ').slice(0, 600));
console.log('   journal du module :', adb('logcat -d').split('\n').filter(l => /updater|capgo/i.test(l)).slice(-25).join('\n'));
note('elle vient du paquet téléchargé (pas du contenu embarqué)', e && e.paquet && e.paquet.id && e.paquet.id !== 'builtin' && e.paquet.version === 'v' + attendue, e && e.paquet);
note('la page s’affiche', e && e.texte > 50, e && e.texte);
const lu = await p.evaluer(`fetch(${JSON.stringify(voix)}).then(async r => ({ok: r.ok, octets: (await r.arrayBuffer()).byteLength})).catch(e => String(e))`);
note('les voix se lisent toujours (' + voix + ')', lu && lu.ok && lu.octets > 1000, lu);
await dormir(25000);   // au-delà des 20 s où le module revient à l’ancienne version si rien n’est confirmé
e = await p.evaluer(ETAT);
note('confirmée : toujours en place 25 s après', e && e.version === attendue && e.paquet && e.paquet.status === 'success', e && e.paquet);
capture('2-nouvelle-version');

// 3. Troisième lancement : elle reste
p = await lancer();
e = await p.evaluer(ETAT);
note('au lancement d’après, elle reste', e && e.version === attendue, e && {version: e.version, paquet: e.paquet, dernier: e.etat && e.etat.dernier});
capture('3-relance');

console.log('\n' + (bon ? 'La mise à jour à distance marche sur Android.' : 'La mise à jour à distance ne marche pas entièrement sur Android (voir ci-dessus).'));
try { ws.close(); } catch (x) {}
process.exit(bon ? 0 : 1);
