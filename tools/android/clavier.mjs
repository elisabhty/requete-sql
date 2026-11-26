// Le clavier d’Android dans une note (tools/android/clavier.sh) : ce qui bouge dans la page, image par image, quand le vrai clavier
// monte, à la première lettre tapée et quand il redescend ; et le film de l’écran, en planche d’images.
// Elisa, 26 novembre, 17 h 27 : « Quand on clique sur le carré, le cadre pour écrire, ça saute au début. »
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';

const adb = c => { try { return execSync('adb ' + c, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000}); } catch (e) { return ''; } };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const cibles = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = cibles.find(c => c.type === 'page') || cibles[0];
if (!page) throw new Error('Aucune page dans la WebView');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
let n = 0; const attente = new Map(); const erreurs = [];
const envoyer = (method, params = {}) => new Promise(ok => { const id = ++n; attente.set(id, ok); try { ws.send(JSON.stringify({id, method, params})); } catch (e) { attente.delete(id); ok({}); return; }
  setTimeout(() => { if (attente.has(id)) { attente.delete(id); ok({result: {exceptionDetails: {text: 'pas de réponse en 25 s (' + method + ')'}}}); } }, 25000); });
ws.onclose = () => { console.log('!! La liaison avec l’appli s’est coupée.'); process.exit(3); };
ws.onmessage = m => {
  const d = JSON.parse(m.data);
  if (d.id && attente.has(d.id)) { attente.get(d.id)(d); attente.delete(d.id); return; }
  if (d.method === 'Runtime.exceptionThrown') erreurs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  if (d.method === 'Fetch.requestPaused') {
    const r = d.params.request;
    if (/supabase\.co/.test(r.url) && r.method !== 'GET' && r.method !== 'OPTIONS') envoyer('Fetch.failRequest', {requestId: d.params.requestId, errorReason: 'BlockedByClient'});
    else envoyer('Fetch.continueRequest', {requestId: d.params.requestId});
  }
};
const evaluer = async expr => {
  const r = await envoyer('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true});
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result?.result?.value;
};
await envoyer('Runtime.enable'); await envoyer('Page.enable');
await envoyer('Fetch.enable', {patterns: [{urlPattern: '*supabase.co*'}]});
const HAUT = Number(process.env.ESSAI_HAUT || 0);
/* Une fenêtre d’Android devant l’appli (« … ne répond pas ») : celle d’une autre appli est fermée, celle de Requête attend. */
function fenetreSysteme() {
  const f = adb('shell dumpsys window').split('\n').find(l => /mCurrentFocus/.test(l)) || '';
  if (!/Not Responding|ne répond pas|Application Error/i.test(f)) return '';
  adb('shell uiautomator dump /sdcard/anr.xml');
  const x = adb('shell cat /sdcard/anr.xml');
  const ici = /fr\.requete\.app/.test(f);
  const m = x.match(new RegExp('text="(' + (ici ? 'Wait|Attendre' : 'Close app|Fermer l’application|Fermer') + ')"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"'));
  if (m) adb(`shell input tap ${(+m[2] + +m[4]) >> 1} ${(+m[3] + +m[5]) >> 1}`); else adb('shell input keyevent KEYCODE_BACK');
  return f.trim().slice(0, 120);
}
async function systemeCalme() { for (let i = 0; i < 4; i++) { const f = fenetreSysteme(); if (!f) return; console.log('   fenêtre d’Android refermée : ' + f); await dormir(1500); } }
/* Une photo de l’écran, petite, dans le journal (même format que les planches) */
function photo(nom) {
  try {
    execSync(`adb exec-out screencap -p > captures/${nom}.png`, {timeout: 30000});
    execSync(`ffmpeg -y -loglevel error -i captures/${nom}.png -vf scale=300:-2 -q:v 6 captures/${nom}-petit.jpg`, {timeout: 60000});
    const b = readFileSync(`captures/${nom}-petit.jpg`).toString('base64');
    console.log(`=== PLANCHE ${nom} ${b.length} ===`);
    for (let i = 0; i < b.length; i += 3000) console.log('PL ' + b.slice(i, i + 3000));
    console.log(`=== FIN PLANCHE ${nom} ===`);
  } catch (e) { console.log('   ! photo : ' + String(e).slice(0, 160)); }
}
const rapport = {appareil: adb('shell getprop ro.product.model').trim() + ' · Android ' + adb('shell getprop ro.build.version.release').trim(), clavier: adb('shell settings get secure default_input_method').trim(), essais: []};

console.log('Page : ' + await evaluer('navigator.userAgent').catch(e => String(e)));
await systemeCalme();
// L’accueil de l’onboarding simplement caché (pas finishOnboard : l’arrivée dans l’appli, ses autocollants, ses sons et ses
// confettis faisaient tomber l’émulateur sans carte graphique, 26 novembre) ; l’appli est dessous, déjà dessinée au démarrage.
// Les écrans de l’appli et la barre d’onglets cachés aussi : seule la feuille de la note (dans #app) reste à dessiner (l’émulateur
// tombait aussi en dessinant l’accueil, 26 novembre, 17 h 34 et 17 h 41).
console.log('Onboarding caché : ' + await evaluer(`(() => { try { const o = document.getElementById('onboarding'); if (o) { o.classList.remove('on'); o.style.display = 'none'; } document.body.classList.remove('ob-on');
  document.querySelectorAll('#app > .screen, #app > .tabbar, #loader').forEach(e => { e.style.display = 'none'; }); return true; } catch (e) { return String(e); } })()`).catch(e => String(e)));
await dormir(3000);
for (let i = 0; i < 6; i++) {
  const f = await evaluer(`(() => { const m = document.querySelector('.mu'); if (m && typeof moduleUpClose === 'function') { moduleUpClose(true); return 'page'; }
    const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && /Récupérer|Plus tard|Fermer|Compris|C’est parti/i.test(b.innerText || b.getAttribute('aria-label') || '')); if (b) { b.click(); return b.innerText.trim().slice(0, 20); } return null; })()`).catch(() => null);
  if (!f) break;
  await dormir(1500);
}

// Le relevé dans la page : chaque image (requestAnimationFrame) et chaque événement, l’heure comptée depuis le premier toucher
const RELEVE = `(() => {
  const K = window.__clavier = {t0: 0, images: [], evts: []};
  const maintenant = () => Math.round(performance.now() - (K.t0 || performance.now()));
  const R = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; };
  const vv = window.visualViewport;
  const repere = document.getElementById('clavier-repere') || Object.assign(document.createElement('div'), {id: 'clavier-repere'});
  repere.style.cssText = 'position:fixed;left:0;top:0;width:48px;height:48px;z-index:2147483647;background:#E5484D;pointer-events:none';
  document.body.appendChild(repere);
  const evt = (nom, plus) => K.evts.push([maintenant(), nom, plus == null ? '' : plus]);
  addEventListener('touchstart', () => { if (!K.t0) { K.t0 = performance.now(); repere.style.background = '#2EB872'; } evt('toucher'); }, {capture: true, passive: true});
  addEventListener('focusin', e => evt('focus', e.target.id || e.target.tagName), true);
  addEventListener('resize', () => evt('resize', innerWidth + 'x' + innerHeight));
  ['keyboardWillShow', 'keyboardDidShow', 'keyboardWillHide', 'keyboardDidHide'].forEach(n => addEventListener(n, e => evt(n, e.keyboardHeight)));
  if (vv) vv.addEventListener('resize', () => evt('vv', Math.round(vv.height) + '@' + Math.round(vv.offsetTop)));
  addEventListener('scroll', e => evt('scroll', (e.target.id || e.target.className || 'doc').toString().slice(0, 20) + '=' + Math.round(e.target.scrollTop || document.scrollingElement.scrollTop)), true);
  addEventListener('input', () => evt('input'), true);
  const fin = performance.now() + 60000;
  const image = () => {
    const nb = document.getElementById('note-body'), act = document.querySelector('#note-body .ne-act'), cs = getComputedStyle(document.documentElement);
    K.images.push({t: maintenant(), ih: innerHeight, vv: vv ? Math.round(vv.height) : 0, kb: document.documentElement.classList.contains('kb-ouvert') ? 1 : 0,
      feuille: R('#note-sheet'), corps: R('#note-body'), cadre: R('#ne-ta'), bouton: R('#note-body .ne-act'), pos: act ? getComputedStyle(act).position[1] : '',
      defil: nb ? Math.round(nb.scrollTop) : -1, page: Math.round(document.scrollingElement.scrollTop), appli: R('#app'), kbv: cs.getPropertyValue('--kb').trim()});
    if (performance.now() < fin) requestAnimationFrame(image);
  };
  requestAnimationFrame(image);
  return true;
})()`;
// Une ligne par image où quelque chose a changé, puis les événements
function lignes(K, de, a) {
  const out = []; let avant = '';
  for (const s of K.images) {
    if (s.t < de || s.t > a) continue;
    const {t, ...r} = s, j = JSON.stringify(r);
    if (j !== avant) { out.push(String(t).padStart(6) + '  ' + j); avant = j; }
  }
  return out;
}
const film = (nom, s) => { const p = spawn('adb', ['shell', 'screenrecord', '--time-limit', String(s), '--bit-rate', '6000000', '/sdcard/' + nom + '.mp4'], {stdio: 'ignore'});
  p.fini = new Promise(r => { p.on('exit', r); p.on('error', r); setTimeout(r, (s + 6) * 1000); }); return p; };
/* Le film arrêté proprement (SIGINT sur le téléphone : le fichier est refermé), puis attendu */
async function couper(f) { adb('shell pkill -INT screenrecord'); await f.fini; await dormir(1500); }
/* Les images du film où l’écran change (détection de changement d’image de ffmpeg) : le doigt (le repère passe au vert), le
   clavier qui monte, ce qui bouge dans la page ; l’heure du film sur chacune. */
function planche(nom, seuil = 0.001) {
  try {
    adb(`pull /sdcard/${nom}.mp4 captures/${nom}.mp4`);
    if (!existsSync(`captures/${nom}.mp4`)) return console.log('   (pas de film)');
    execSync(`ffmpeg -y -loglevel error -i captures/${nom}.mp4 -vf "select='gt(scene\\,${seuil})',scale=150:-2,drawtext=text='%{pts\\:hms}':x=4:y=h-22:fontsize=14:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=8x4:padding=2" -fps_mode vfr -frames:v 1 -q:v 6 captures/${nom}-planche.jpg`, {stdio: 'inherit', timeout: 180000});
    const b = readFileSync(`captures/${nom}-planche.jpg`).toString('base64');
    console.log(`=== PLANCHE ${nom} ${b.length} ===`);
    for (let i = 0; i < b.length; i += 3000) console.log('PL ' + b.slice(i, i + 3000));
    console.log(`=== FIN PLANCHE ${nom} ===`);
  } catch (e) { console.log('   ! planche : ' + String(e).slice(0, 200)); }
}
async function toucher(sel, dy) {
  await systemeCalme();
  const r = await evaluer(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return {x: b.left + b.width / 2, y: b.top + ${dy}, d: devicePixelRatio}; })()`);
  if (!r) return false;
  adb(`shell input tap ${Math.round(r.x * r.d)} ${Math.round(r.y * r.d + HAUT)}`);
  return true;
}
/* Attendre que la hauteur de la vue passe la condition (le clavier là, ou reparti) : l’émulateur sans carte graphique met
   plusieurs secondes à montrer le clavier */
async function attendreVue(cond, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const h = await evaluer('innerHeight').catch(() => 0); if (h && cond(h)) return Date.now() - t0; await dormir(150); }
  return -1;
}
const montrer = (K, titre, de = -1e9, a = 1e9) => {
  console.log('\n--- ' + titre + ' ---');
  console.log(K.evts.filter(e => e[0] >= de && e[0] <= a).map(e => String(e[0]).padStart(6) + '  ' + e[1] + ' ' + e[2]).join('\n'));
  console.log('--- images (celles où quelque chose change) ---');
  console.log(lignes(K, de, a).join('\n'));
};

// Les animations d’Android remises (le clavier monte comme sur un vrai téléphone)
for (const s of ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale']) adb(`shell settings put global ${s} 1`);
await dormir(1500);

// 1. Une note déjà écrite : le doigt sur le cadre d’écriture, le clavier monte ; 2. une lettre ; 3. le retour d’Android le referme
await evaluer(`(() => { state.notes = [{id: 'nk1', txt: 'Une idée à garder : GROUP BY avant HAVING.', sql: 'SELECT ville, COUNT(*)\\nFROM clients\\nGROUP BY ville;', ctx: '', ts: Date.now() - 3600e3, pin: false}]; save(); openNote('nk1'); return true; })()`);
await dormir(2000);
await systemeCalme();
photo('avant');
await evaluer(RELEVE);
const base = await evaluer('innerHeight');
const f1 = film('note', 60);
await dormir(1500);
await toucher('#ne-ta', 40);
const monte = await attendreVue(h => h < base - 100, 15000);
console.log(monte >= 0 ? `\nLe clavier est là ${monte} ms après le toucher (vue : ${base} px avant)` : '\nLe clavier n’est pas venu en 15 s');
await dormir(2500);
let K = await evaluer('window.__clavier');
const t2 = (K.images.slice(-1)[0] || {}).t || 0;
adb('shell input text a');
await dormir(2500);
K = await evaluer('window.__clavier');
const t3 = (K.images.slice(-1)[0] || {}).t || 0;
adb('shell input keyevent KEYCODE_BACK');
const descend = await attendreVue(h => h >= base - 2, 12000);
await dormir(2000);
K = await evaluer('window.__clavier');
montrer(K, '1. Note existante, le doigt sur le cadre (ms depuis le toucher)', -300, t2);
montrer(K, '2. La première lettre tapée', t2, t3);
montrer(K, `3. Le retour d’Android (clavier parti ${descend} ms après)`, t3);
rapport.essais.push({nom: 'note existante', base, monte, descend, t2, t3, evts: K.evts, images: K.images});
await couper(f1);
planche('note');

// 4. Une note neuve (« + ») : le cadre prend la main tout seul (260 ms après l’ouverture) ; le clavier monte-t-il de lui-même ?
await evaluer(`(() => { try { closeNote(); } catch (e) { document.getElementById('note-sheet')?.classList.remove('on'); } return true; })()`).catch(() => null);
await dormir(1500);
await evaluer(RELEVE);
await evaluer(`(() => { window.__clavier.t0 = performance.now(); openNote(); return true; })()`);
const seul = await attendreVue(h => h < base - 100, 6000);
console.log(seul >= 0 ? `\nNote neuve : le clavier monte de lui-même (${seul} ms)` : '\nNote neuve : le clavier ne monte pas de lui-même (6 s)');
await dormir(1500);
K = await evaluer('window.__clavier');
montrer(K, '4. Note neuve, sans toucher (ms depuis l’ouverture)', 0);
rapport.essais.push({nom: 'note neuve', seul, evts: K.evts, images: K.images});
rapport.erreurs = erreurs;
writeFileSync('captures/clavier.json', JSON.stringify(rapport, null, 1));
console.log('\nErreurs de la page : ' + (erreurs.length ? erreurs.slice(0, 5).join(' | ') : 'aucune'));
ws.close();
process.exit(0);
