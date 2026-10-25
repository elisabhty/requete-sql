/* Défilement fluide sur iPhone : aucun écouteur tactile non passif ne reste posé sur toute la page (window, document).
   Un tel écouteur oblige Safari à attendre le script avant chaque défilement, partout dans l’app : le défilement
   « a du mal à se faire ». Les gestes qui doivent bloquer le défilement posent leur écouteur sur leur élément
   (barres, tableau de stickers, étiquettes à glisser) ou seulement le temps du geste (retour par le bord, glisser
   du planning).
   Elisa, 25 octobre, 22 h 20 : « Le scroll est difficile parfois » — le geste passé à la page entière en haut ou en bas
   d’un écran, l’élan cassé par un décalage de scrollTop, le cours en vidéo qui défilait de quelques pixels. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/* Tous les appels addEventListener('touchmove' | 'touchstart' | 'wheel', …) : leur cible et leurs options, même quand
   l’appel s’étend sur plusieurs lignes. */
function calls() {
  const out = [], re = /([\w$]+)?(\.)?addEventListener\('(touchmove|touchstart|wheel)'/g;
  let m;
  while ((m = re.exec(html))) {
    let i = m.index + m[0].length, depth = 1, q = null;
    for (; i < html.length && depth; i++) {
      const c = html[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === "'" || c === '"' || c === '`') q = c;
      else if (c === '(') depth++;
      else if (c === ')') depth--;
    }
    const call = html.slice(m.index, i), target = m[2] ? m[1] : 'window';
    out.push({ target, type: m[3], blocking: /\{passive:false\}\)$/.test(call), line: html.slice(0, m.index).split('\n').length, head: call.split('\n')[0].trim() });
  }
  return out;
}

test('aucun écouteur tactile non passif permanent sur window ou document', () => {
  const all = calls();
  assert.ok(all.length >= 10, 'appels trouvés');
  const global = all.filter(c => c.blocking && (c.target === 'window' || c.target === 'document'));
  /* Seuls restent : le retour par le bord (posé dans son touchstart, retiré à la fin du geste) et le glisser du
     planning (posé au début du glisser, retiré à la fin). */
  assert.deepEqual(global.map(c => c.head), [
    "addEventListener('touchmove',move,{passive:false})",
    "document.addEventListener('touchmove',bloquerScrollTactile,{passive:false})"
  ], 'écouteurs non passifs sur la page entière');
  assert.ok(html.includes("    g=Object.assign(tg,{x0:t.clientX,y0:t.clientY,t0:performance.now(),dx:0,lock:null,w:innerWidth});\n    addEventListener('touchmove',move,{passive:false});"), 'retour par le bord : seulement pendant un geste parti du bord');
  assert.ok(html.includes("    removeEventListener('touchmove',move,{passive:false});\n    if(!g)return;const G=g;g=null;"), '… et retiré à la fin du geste');
  assert.ok(html.includes("    bar.addEventListener('touchmove',move,{passive:false});") && html.includes("    bar.addEventListener('wheel',wheel,{passive:false});"), 'barres : sur les barres elles-mêmes');
});

test('arrivé en haut ou en bas d’un écran, Safari ne passe plus le geste à la page entière', () => {
  assert.ok(/html\{[^}]*overscroll-behavior-y:none/.test(html), 'la page elle-même ne rebondit pas');
  assert.ok(/\.screen\{position:absolute;inset:0;[^}]*overscroll-behavior-y:contain/.test(html), 'chaque écran garde son geste (et son rebond)');
  assert.ok(/\.viz-body\{[^}]*overscroll-behavior-y:contain/.test(html), 'les feuilles aussi');
  assert.ok(!/(^|[\s,}])\.screen[^{]*\{[^}]*overscroll-behavior(-y)?:auto/.test(html), 'aucun écran ne repasse en « auto »');
  assert.ok(html.includes('.lv:not(.on){pointer-events:none}'), 'le lecteur qui se ferme (fondu) ne retient plus le doigt');
});

test('défilement en cours : un doigt posé, ou un défilement il y a moins de 200 ms ; écouteurs passifs', () => {
  const a = html.indexOf('/* Défilement en cours :'), b = html.indexOf('/* ---------- Démarrage des animations ----------');
  assert.ok(a > 0 && b > a);
  const ls = []; let now = 1000;
  const ctx = vm.createContext({ document: { addEventListener: (t, f, o) => ls.push({ t, f, o }) }, performance: { now: () => now } });
  vm.runInContext(html.slice(a, b) + ';this.en=enDefilement;', ctx);
  assert.deepEqual(ls.map(l => l.t).sort(), ['scroll', 'touchcancel', 'touchend', 'touchstart']);
  assert.ok(ls.every(l => l.o && l.o.passive === true && l.o.capture === true), 'passifs, en capture (aucune attente du script)');
  const fire = (t, e = {}) => ls.filter(l => l.t === t).forEach(l => l.f(e));
  now = 5000; assert.equal(ctx.en(), false, 'au repos');
  fire('touchstart', { touches: [{}] }); assert.equal(ctx.en(), true, 'doigt posé');
  now += 5000; assert.equal(ctx.en(), true, 'doigt toujours posé, même immobile');
  fire('touchend', { touches: [] }); assert.equal(ctx.en(), false, 'doigt levé, sans défilement');
  fire('scroll'); now += 150; assert.equal(ctx.en(), true, 'l’élan continue : défilement il y a 150 ms');
  now += 100; assert.equal(ctx.en(), false, 'arrêté depuis 250 ms');
});

test('pendant un défilement, aucun décalage de scrollTop ni défilement automatique dans un cours', () => {
  const mount = html.slice(html.indexOf('function mountProbScene('), html.indexOf('/* Emplacements de requête exécutable dans le texte d’un cours. */'));
  assert.ok(/if\(held\.length\|\|\(sc&&enDefilement\(\)&&root\.getBoundingClientRect\(\)\.top<sc\.getBoundingClientRect\(\)\.top-1\)\)\{\s*held\.push\(change\);/.test(mount), 'scène dépassée pendant un défilement : son étape est mise de côté');
  assert.ok(/if\(root\.isConnected&&enDefilement\(\)\)\{heldT=setTimeout\(flushHeld,150\);return;\}/.test(mount), 'on attend la fin du geste');
  assert.ok(/const list=held;held=\[\];\s*if\(root\.isConnected\)keepNow\(list\);/.test(mount), 'puis les étapes passent ensemble, dans l’ordre, avec un seul décalage');
  assert.ok(/const reset=\(\)=>\{\s*timers\.forEach\(clearTimeout\);timers=\[\];\s*clearTimeout\(heldT\);heldT=0;held=\[\];/.test(mount), 'rejouer ou finir oublie les étapes en attente');
  const slots = html.slice(html.indexOf('function initRunSqlSlots('), html.indexOf('function renderStudio('));
  assert.ok(slots.includes('if(keep&&enDefilement()){setTimeout(montrer,150);return;}'), 'commentaire d’une requête : attend la fin du geste');
  assert.ok(slots.includes("if(!enDefilement())done.scrollIntoView("), '« Mission accomplie » : pas de défilement automatique sous le doigt');
});

test('planning : un doigt posé un instant avant de faire défiler ne soulève plus la carte (appui long de 400 ms)', () => {
  const lp = html.slice(html.indexOf('function armerAppuiLong(e){'), html.indexOf('function annulerAppuiLong(){'));
  assert.ok(lp.includes("if(!souris)lpTimer=setTimeout(()=>{lpTimer=null;demarrer(x,y,'medium');},400);"));
  assert.ok(lp.includes('if(Math.abs(dx)+Math.abs(dy)>12){nettoyer();annulerAppuiLong();}'), 'un vrai glisser vertical reste un défilement');
});
