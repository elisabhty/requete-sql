/* Elisa, 11 novembre, 18 h 05 (capture d’une note, champ « Requête associée ») : « le clavier SELECT, etc. ne fonctionne pas du
   tout ». La barre des touches SQL annulait le début du toucher (touchstart) pour garder le clavier ouvert : le navigateur
   n’envoyait plus le clic, et rien ne s’écrivait. Vérifié dans Chrome en mode tactile : avant, « pointerdown, touchstart,
   pointerup, touchend » et un champ vide ; après, « SELECT » s’écrit, le champ garde le clavier, glisser la rangée la fait défiler
   sans rien écrire, et la console marche pareil. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const b = app.slice(app.indexOf('function buildKbar(){'), app.indexOf('function insertKey(k,schemaKind){'));

test('au doigt, la touche s’écrit à la fin du toucher ; le début du toucher n’est plus annulé', () => {
  assert.ok(!/addEventListener\('touchstart',e=>\{[^}]*preventDefault/.test(b), 'plus de touchstart annulé (il supprimait le clic et le défilement)');
  assert.ok(b.includes("bar.addEventListener('touchstart',e=>{\n    const b=e.target.closest('button'),t=e.touches[0];") && b.includes('},{passive:true});'), 'le début du toucher est seulement noté');
  assert.ok(b.includes("if(t&&(Math.abs(t.clientX-kbarDoigt.x)>8||Math.abs(t.clientY-kbarDoigt.y)>8))kbarDoigt.glisse=true;".replace('if(t&&', 'if(kbarDoigt&&t&&')), 'un doigt qui glisse fait défiler');
  assert.ok(b.includes("    if(e.cancelable)e.preventDefault();\n    if(d.glisse||!d.b.isConnected)return;") && b.includes("insertKey(d.b.dataset.k,d.b.dataset.schema||'');\n  },{passive:false});"), 'la fin du toucher, annulée (ni clic en double, ni clavier perdu), écrit la touche');
  assert.ok(b.includes("bar.addEventListener('mousedown',e=>{ if(!e.target.closest('.kbar-dock')) e.preventDefault(); });") && b.includes("insertKey(b.dataset.k,b.dataset.schema||'');"), 'la souris garde son clic');
  assert.ok(b.includes("if(typeof buzz==='function')buzz('selection');"), 'un petit cran sous le doigt');
});
