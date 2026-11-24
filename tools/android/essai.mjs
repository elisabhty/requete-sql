// Vérifie l’appli Android lancée sur l’émulateur, de l’intérieur de sa page (protocole d’inspection de la WebView,
// redirigé sur le port 9222 par tools/android/essai.sh). Sort en erreur si une vérification échoue.
import { writeFileSync } from 'node:fs';
const cibles = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = cibles.find(c => c.type === 'page') || cibles[0];
if (!page) throw new Error('Aucune page dans la WebView');
console.log('Page :', page.url);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
let n = 0; const attente = new Map(); const erreurs = [];
ws.onmessage = m => {
  const d = JSON.parse(m.data);
  if (d.id && attente.has(d.id)) { attente.get(d.id)(d); attente.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') erreurs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
    const lieu = d.params.stackTrace?.callFrames?.[0], ou = lieu ? ' @' + lieu.url.replace(/^https?:\/\/localhost/, '') + ':' + (lieu.lineNumber + 1) : '';
    erreurs.push(d.params.args.map(a => a.value ?? (a.preview ? '{' + a.preview.properties.map(p => p.name + ': ' + p.value).join(', ') + '}' : a.description)).join(' ') + ou);
  }
};
const envoyer = (method, params = {}) => new Promise(ok => { const id = ++n; attente.set(id, ok); ws.send(JSON.stringify({id, method, params})); });
const evaluer = async expr => { const r = await envoyer('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true}); if (r.result.exceptionDetails) throw new Error(expr + ' → ' + r.result.exceptionDetails.text); return r.result.result.value; };
await envoyer('Runtime.enable'); await envoyer('Page.enable');
// Un relancement de la page, pour attraper les erreurs du démarrage.
await envoyer('Page.reload', {ignoreCache: false});
await new Promise(r => setTimeout(r, 15000));
const ok = [], ko = [];
const verifier = (nom, cond, detail = '') => (cond ? ok : ko).push(nom + (detail ? ' (' + detail + ')' : ''));
const info = await evaluer(`(async () => ({
  plateforme: window.Capacitor && Capacitor.getPlatform(),
  android: typeof appAndroid === 'function' && appAndroid(),
  plugins: Object.keys((window.Capacitor && Capacitor.Plugins) || {}),
  accueil: !!document.getElementById('onboarding')?.classList.contains('on') || !!document.querySelector('#scr-learn'),
  retour: typeof androidRetour === 'function',
  marge: getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top').trim(),
  voix: await fetch(${JSON.stringify('/' + process.env.ESSAI_VOIX)}).then(async r => ({statut: r.status, octets: (await r.arrayBuffer()).byteLength})).catch(e => ({erreur: String(e)})),
  anim: await fetch('/assets/anim/as.html').then(r => r.status).catch(e => String(e)),
  lecture: await new Promise(fin => { const a = new Audio(${JSON.stringify('/' + process.env.ESSAI_VOIX)}); a.preload = 'auto';
    a.oncanplaythrough = () => fin('prête, ' + Math.round(a.duration * 10) / 10 + ' s'); a.onerror = () => fin('erreur ' + (a.error && a.error.code)); a.load(); setTimeout(() => fin('délai dépassé'), 10000); }),
  texte: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 160)
}))()`);
console.log(JSON.stringify(info, null, 1));
verifier('plateforme android', info.plateforme === 'android' && info.android === true);
for (const p of ['App', 'LocalNotifications', 'SocialLogin', 'CapacitorUpdater']) verifier('module ' + p, info.plugins.includes(p));
verifier('écran affiché', info.accueil);
verifier('bouton Retour branché', info.retour);
verifier('voix servie depuis son paquet', info.voix.statut === 200 && info.voix.octets === Number(process.env.ESSAI_TAILLE), JSON.stringify(info.voix));
verifier('voix lisible', /^prête/.test(info.lecture), info.lecture);
verifier('animations de cours', info.anim === 200);
if (erreurs.length) console.log('\nErreurs de la page :\n  ' + erreurs.slice(0, 12).join('\n  '));
verifier('aucune erreur au démarrage', erreurs.length === 0, erreurs.length + ' erreur(s)');
if (process.env.ESSAI_BORDS === '1') verifier('marges des bords (Android 15, plein écran)', parseFloat(info.marge) > 0, info.marge);
const cap = await envoyer('Page.captureScreenshot', {format: 'png'});
if (cap.result?.data) writeFileSync('captures/page.png', Buffer.from(cap.result.data, 'base64'));
console.log('\nOK :\n  ' + ok.join('\n  ') + (ko.length ? '\nÉCHEC :\n  ' + ko.join('\n  ') : '\nTout est bon.'));
ws.close();
process.exit(ko.length ? 1 : 0);
