/* Défilement fluide sur iPhone : aucun écouteur tactile non passif ne reste posé sur toute la page (window, document).
   Un tel écouteur oblige Safari à attendre le script avant chaque défilement, partout dans l’app : le défilement
   « a du mal à se faire ». Les gestes qui doivent bloquer le défilement posent leur écouteur sur leur élément
   (barres, tableau de stickers, étiquettes à glisser) ou seulement le temps du geste (retour par le bord, glisser
   du planning). */
import fs from 'node:fs';
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
