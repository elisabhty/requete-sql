// Le parcours complet de l’appli Android sur un émulateur de GitHub (.github/workflows/android.yml, travail « parcours »).
// Elisa, 25 novembre, 19 h 49 : « tu peux tester l’appli sur GitHub (Android) ? est-ce que tu vas voir tous les soucis ? »
// De l’onboarding à la première leçon, comme une nouvelle venue : une capture de l’écran du téléphone à chaque étape
// (captures/NN-etape.png) et, sur chaque écran, des vérifications automatiques : erreurs de la page, éléments qui se chevauchent,
// qui sortent de l’écran ou passent sous les barres d’Android, textes coupés. Le rapport : captures/rapport.json et le journal.
// Rien n’est écrit dans le vrai nuage : les envois vers Supabase (hors lectures) sont refusés, les statistiques sont déclinées.
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

mkdirSync('captures', {recursive: true});
const adb = c => { try { return execSync('adb ' + c, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000}); } catch (e) { return ''; } };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const cibles = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = cibles.find(c => c.type === 'page') || cibles[0];
if (!page) throw new Error('Aucune page dans la WebView');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
let n = 0; const attente = new Map(); let erreurs = [];
// Chaque demande à la page a 25 s pour répondre : un téléphone figé ne bloque plus tout le parcours.
const envoyer = (method, params = {}) => new Promise(ok => { const id = ++n; attente.set(id, ok); try { ws.send(JSON.stringify({id, method, params})); } catch (e) { attente.delete(id); ok({}); return; }
  setTimeout(() => { if (attente.has(id)) { attente.delete(id); ok({result: {exceptionDetails: {text: 'pas de réponse de la page en 25 s (' + method + ')'}}}); } }, 25000); });
// La liaison avec l’appli coupée (l’émulateur qui s’arrête, l’appli fermée) : le rapport est gardé et le parcours s’arrête net.
ws.onclose = () => {
  console.log('\n!! La liaison avec l’appli s’est coupée (émulateur arrêté ou appli fermée), après ' + rapport.etapes.length + ' écrans.');
  rapport.coupe = true; try { writeFileSync('captures/rapport.json', JSON.stringify(rapport, null, 1)); } catch (e) {}
  process.exit(3);
};
ws.onmessage = m => {
  const d = JSON.parse(m.data);
  if (d.id && attente.has(d.id)) { attente.get(d.id)(d); attente.delete(d.id); return; }
  if (d.method === 'Runtime.exceptionThrown') erreurs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') erreurs.push(d.params.args.map(a => a.value ?? a.description ?? '').join(' '));
  // Le nuage : les lectures passent, les envois (POST, PATCH, DELETE…) vers Supabase sont refusés (rien n’est écrit pour de vrai).
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
let rapport = {etapes: []};
await envoyer('Runtime.enable'); await envoyer('Page.enable');
await envoyer('Fetch.enable', {patterns: [{urlPattern: '*supabase.co*'}]});

const HAUT = Number(process.env.ESSAI_HAUT || 0);   // le haut de la WebView sur l’écran, en pixels du téléphone
rapport = {appareil: adb('shell getprop ro.product.model').trim() + ' · Android ' + adb('shell getprop ro.build.version.release').trim(), etapes: []};
let num = 0;

/* Les vérifications d’un écran, de l’intérieur de la page */
const VERIFS = `(() => {
  const vis = e => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .05) return false;
    const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  let p = e => { for (let x = e; x; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .05) return false; } return true; };
  const W = innerWidth, H = innerHeight, cs = getComputedStyle(document.documentElement);
  const haut = parseFloat(cs.getPropertyValue('--safe-area-inset-top')) || 0, bas = parseFloat(cs.getPropertyValue('--safe-area-inset-bottom')) || 0;
  const nom = e => (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') || e.tagName.toLowerCase();
  const txt = e => (e.innerText || e.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 50);
  const soucis = [];
  // Textes : les éléments qui portent du texte eux-mêmes
  const textes = [...document.querySelectorAll('h1,h2,h3,p,small,b,em,span,label,button,a,li')].filter(e => [...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim().length > 1) && vis(e) && p(e));
  // Images décoratives (mascottes, autocollants) : leur cadre, rentré de 18 % (les bords transparents des images)
  const images = [...document.querySelectorAll('img,video,canvas')].filter(e => vis(e) && p(e)).map(e => { const r = e.getBoundingClientRect(), dx = r.width * .18, dy = r.height * .18; return {e, l: r.left + dx, r: r.right - dx, t: r.top + dy, b: r.bottom - dy}; });
  for (const t of textes) {
    const r = t.getBoundingClientRect();
    for (const i of images) {
      // Un texte posé exprès sur sa photo (la carte d’un avis : le nom sur la photo) n’est pas un souci
      if (i.e.contains(t) || t.contains(i.e) || (i.e.parentElement && i.e.parentElement.contains(t))) continue;
      const w = Math.min(r.right, i.r) - Math.max(r.left, i.l), h = Math.min(r.bottom, i.b) - Math.max(r.top, i.t);
      if (w > 6 && h > 6 && w * h > r.width * r.height * .12) soucis.push({type: 'image sur un texte', texte: txt(t), image: nom(i.e) + ' ' + (i.e.getAttribute('src') || '').split('/').pop()});
    }
    // Texte coupé (débordement caché)
    const s = getComputedStyle(t);
    if ((s.overflow === 'hidden' || s.textOverflow === 'ellipsis') && t.scrollWidth > t.clientWidth + 2 && s.whiteSpace !== 'normal') soucis.push({type: 'texte coupé', texte: txt(t)});
    // Hors de l’écran, sur les côtés
    if (r.left < -1 || r.right > W + 1) soucis.push({type: 'sort de l’écran', texte: txt(t), gauche: Math.round(r.left), droite: Math.round(r.right), largeur: W});
  }
  // Boutons sous les barres d’Android (en haut : la barre d’état ; en bas : la barre de navigation)
  for (const b of [...document.querySelectorAll('button,a,[role=button],input')].filter(e => vis(e) && p(e))) {
    const r = b.getBoundingClientRect();
    if (r.top < haut - 1 && r.bottom > 0) soucis.push({type: 'bouton sous la barre d’état', texte: txt(b), haut: Math.round(r.top), barre: haut});
    if (r.bottom > H - bas + 1 && r.top < H) soucis.push({type: 'bouton sous la barre du bas', texte: txt(b), bas: Math.round(r.bottom), limite: H - bas});
  }
  // Deux boutons l’un sur l’autre
  const boutons = [...document.querySelectorAll('button,a.btn,[role=button]')].filter(e => vis(e) && p(e)).map(e => ({e, r: e.getBoundingClientRect()}));
  for (let i = 0; i < boutons.length; i++) for (let j = i + 1; j < boutons.length; j++) {
    const a = boutons[i], b = boutons[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 8 && h > 8) soucis.push({type: 'boutons superposés', a: txt(a.e), b: txt(b.e)});
  }
  if (document.documentElement.scrollWidth > W + 1) soucis.push({type: 'la page déborde sur le côté', largeur: document.documentElement.scrollWidth, ecran: W});
  const vus = new Set(); return soucis.filter(s => { const k = JSON.stringify(s); if (vus.has(k)) return false; vus.add(k); return true; });
})()`;

const etat = () => evaluer(`(() => { const r = document.getElementById('onboarding'); const ob = !!(r && r.classList.contains('on'));
  return {ob, slide: ob && typeof OB_SLIDES !== 'undefined' ? OB_SLIDES[obStep] : '', ecran: (document.querySelector('.scr.on,.screen.on,[data-ecran].on') || {}).id || '',
    titre: ((r && ob ? r : document.body).querySelector('h1,h2') || {}).innerText || '', activite: '' }; })()`);

/* Une fenêtre d’Android devant l’appli (« … ne répond pas ») : on touche « Attendre », elle s’en va. */
function fenetreSysteme() {
  const f = adb('shell dumpsys window').split('\n').find(l => /mCurrentFocus/.test(l)) || '';
  if (!/Not Responding|ne répond pas/i.test(f)) return '';
  adb('shell uiautomator dump /sdcard/anr.xml');
  const x = adb('shell cat /sdcard/anr.xml');
  const m = x.match(/text="(Wait|Attendre)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (m) adb(`shell input tap ${(+m[2] + +m[4]) >> 1} ${(+m[3] + +m[5]) >> 1}`); else adb('shell input keyevent KEYCODE_BACK');
  return f.trim().slice(0, 120);
}

async function capture(nomEtape) {
  num++;
  const anr = fenetreSysteme(); if (anr) { (rapport.fenetres = rapport.fenetres || []).push(anr); await dormir(800); }
  const fichier = String(num).padStart(2, '0') + '-' + nomEtape.replace(/[^a-z0-9-]+/gi, '-').slice(0, 40) + '.png';
  try { execSync(`adb exec-out screencap -p > captures/${fichier}`, {timeout: 30000}); } catch (e) {}
  let soucis = []; try { soucis = await evaluer(VERIFS); } catch (e) { soucis = [{type: 'vérification impossible', detail: String(e).slice(0, 120)}]; }
  const act = adb('shell dumpsys activity activities').split('\n').find(l => /mResumedActivity|topResumedActivity/.test(l)) || '';
  if (act && !/fr\.requete\.app/.test(act)) soucis.push({type: 'une autre application est passée devant', activite: act.trim().slice(0, 140)});
  const e = {etape: nomEtape, capture: fichier, soucis, erreurs: erreurs.filter(x => !/^Error injecting safe area CSS/.test(x))};
  erreurs = [];
  rapport.etapes.push(e);
  try { writeFileSync('captures/rapport.json', JSON.stringify(rapport, null, 1)); } catch (x) {}
  console.log(`${fichier}  ${e.soucis.length ? e.soucis.length + ' souci(s)' : 'ok'}${e.erreurs.length ? ', ' + e.erreurs.length + ' erreur(s)' : ''}`);
  for (const s of e.soucis) console.log('   · ' + JSON.stringify(s));
  for (const x of e.erreurs) console.log('   ! ' + String(x).slice(0, 200));
}

/* Un appui long (le doigt sur le bouton du serment) : un vrai toucher envoyé à la page (les coordonnées de la page, sans
   dépendre de la place de la vue sur l’écran) ; s’il n’a pas pris, le doigt d’Android aux coordonnées de l’écran. */
async function appuiLong(selecteur, ms) {
  const ou = `(() => { const e = document.querySelector(${JSON.stringify(selecteur)}); if (!e) return null; const b = e.getBoundingClientRect(); return {x: b.left + b.width / 2, y: b.top + b.height / 2, d: devicePixelRatio, fait: e.classList.contains('is-done')}; })()`;
  const r = await evaluer(ou);
  if (!r) return false;
  await envoyer('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: r.x, y: r.y}]});
  await dormir(ms);
  await envoyer('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await dormir(600);
  const apres = await evaluer(ou).catch(() => null);
  if (apres && !apres.fait) adb(`shell input swipe ${Math.round(r.x * r.d)} ${Math.round(r.y * r.d + HAUT)} ${Math.round(r.x * r.d)} ${Math.round(r.y * r.d + HAUT)} ${ms}`);
  return true;
}

/* Une étape de l’onboarding : ce qu’une nouvelle venue toucherait */
const AGIR = `(async () => {
  const vis = e => e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden';
  const root = document.getElementById('onboarding'), slide = OB_SLIDES[obStep];
  const clic = e => { e.click(); return 'clic ' + (e.innerText || e.getAttribute('aria-label') || e.className || '').replace(/\\s+/g, ' ').trim().slice(0, 40); };
  const bouton = re => [...root.querySelectorAll('button,a')].find(b => vis(b) && re.test(b.innerText || b.getAttribute('aria-label') || ''));
  const ask = [...document.querySelectorAll('.lq-ask-oui')].find(vis); if (ask) return clic(ask);
  if (slide === 'stats') { const b = bouton(/Non merci|No thanks/i); if (b) return clic(b); }
  if (slide === 'name') { const c = root.querySelector('input'); if (c && !c.value) { c.value = 'Elisa'; c.dispatchEvent(new Event('input', {bubbles: true})); return 'prénom'; } }
  if (slide === 'pseudo') { const i = [...root.querySelectorAll('input')].find(vis); if (i && !/testandroid/.test(i.value)) { i.value = 'testandroid' + Math.floor(Math.random() * 9000 + 1000); i.dispatchEvent(new Event('input', {bubbles: true})); return 'pseudo'; } }
  if (slide === 'practice') { const run = document.getElementById('ob-practice-run'); if (run && !run.dataset.qa) { run.dataset.qa = 1; return clic(run); } }
  if (slide === 'account') { const b = bouton(/Continuer sans compte|Continue without/i); if (b) return clic(b); }
  if (slide === 'pact') { const h = root.querySelector('.ob-hold'); if (h && !h.classList.contains('is-done')) return 'serment'; }
  for (const g of [...root.querySelectorAll('[role=radiogroup]')].filter(vis)) {
    const opts = [...g.querySelectorAll('[role=radio]')].filter(x => vis(x) && !x.disabled);
    if (opts.length && !opts.some(x => x.getAttribute('aria-checked') === 'true')) return clic(opts[1] || opts[0]);
  }
  const next = document.getElementById('ob-next'); if (next && vis(next) && !next.disabled) return clic(next);
  const choix = [...root.querySelectorAll('[role=radio],[role=option],.ob-opt,.ob-choice,.ob-tile,.ob-card-btn,.ob-source-tile,.ob-goal')].filter(e => vis(e) && !e.disabled);
  if (choix.length) return clic(choix[0]);
  return null;
})()`;

// Le départ : l’appli fraîchement installée, page relancée pour partir de zéro
await envoyer('Page.reload', {ignoreCache: false});
await dormir(12000);
try { rapport.langue = await evaluer(`navigator.language + ' · ' + ((window.REQUETE_LANGUE || {}).code || 'fr')`); console.log('Langue de la page : ' + rapport.langue); } catch (e) {}
let precedente = '', meme = 0;
/* L’état de la page, même si elle met du temps à répondre : jusqu’à 3 min ; le temps passé figée est noté (c’est un souci). */
async function etatSur() {
  const t0 = Date.now(); let vu = false;
  for (;;) {
    try {
      const st = await etat();
      const s = Math.round((Date.now() - t0) / 1000);
      if (s >= 20) { console.log(`   ! la page n’a pas répondu pendant ${s} s (${st.slide || st.ecran || 'appli'})`); (rapport.figee = rapport.figee || []).push({ecran: st.slide || st.ecran, secondes: s}); }
      return st;
    } catch (e) {
      if (!vu) { vu = true; try { execSync(`adb exec-out screencap -p > captures/fige-${String(num).padStart(2, '0')}.png`, {timeout: 30000}); } catch (x) {} }
      if (Date.now() - t0 > 180000) throw e;
      fenetreSysteme();
    }
  }
}
for (let k = 0; k < 140; k++) {
  const st = await etatSur();
  if (!st.ob) break;
  if (st.slide !== precedente) { await dormir(1200); await capture('onb-' + st.slide); precedente = st.slide; meme = 0; }
  else if (++meme > 14) { await capture('bloque-' + st.slide); rapport.bloque = st.slide; break; }
  let fait = null;
  fenetreSysteme();
  try { fait = await evaluer(AGIR); } catch (e) { console.log('   ! action : ' + String(e).slice(0, 160)); }
  if (fait === 'serment') { await appuiLong('.ob-hold', 2600); await dormir(1500); if (!rapport.pacte) { rapport.pacte = 1; await capture('onb-pact-fait'); } }
  await dormir(fait ? 900 : 1600);
}

// Dans l’appli : l’arrivée (autocollants), l’accueil, les onglets, puis la première leçon
await dormir(3000);
await capture('appli-arrivee');
for (let i = 0; i < 4; i++) {
  const ferme = await evaluer(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent && /Récupérer|Plus tard|Fermer|Compris|C’est parti|Continuer/i.test(b.innerText || b.getAttribute('aria-label') || '')); if (b) { b.click(); return b.innerText.trim().slice(0, 30); } return null; })()`).catch(() => null);
  if (!ferme) break;
  await dormir(1800);
  await capture('appli-' + ferme);
}
const onglets = await evaluer(`[...document.querySelectorAll('#tabbar [role=tab], #tabbar button')].filter(b => b.offsetParent).map((b, i) => i)`).catch(() => []);
for (const i of (onglets || []).slice(0, 6)) {
  const nom = await evaluer(`(() => { const b = [...document.querySelectorAll('#tabbar [role=tab], #tabbar button')].filter(b => b.offsetParent)[${i}]; if (!b) return null; b.click(); return (b.innerText || b.getAttribute('aria-label') || 'onglet').trim().split('\\n')[0].slice(0, 20); })()`).catch(() => null);
  if (!nom) continue;
  await dormir(2200);
  await capture('onglet-' + nom);
}
// La première leçon, depuis l’accueil
const lecon = await evaluer(`(() => { const b = [...document.querySelectorAll('button,a')].find(b => b.offsetParent && /Commencer la leçon|Reprendre|Start the lesson|Start lesson|Resume/i.test(b.innerText || '')); if (b) { b.click(); return true; } return false; })()`).catch(() => false);
if (lecon) { for (let i = 0; i < 3; i++) { await dormir(4000); await capture('lecon-' + (i + 1)); } }

writeFileSync('captures/rapport.json', JSON.stringify(rapport, null, 1));
const total = rapport.etapes.reduce((s, e) => s + e.soucis.length + e.erreurs.length, 0);
console.log(`\n${rapport.appareil} : ${rapport.etapes.length} écrans, ${total} point(s) à regarder${rapport.bloque ? ', bloqué à ' + rapport.bloque : ''}.`);
ws.close();
process.exit(0);
