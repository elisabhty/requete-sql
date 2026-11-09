/* Elisa, 8 novembre, 18 h 18 : « les détails des actions ne fonctionnent pas, c’est toujours en réflexion » et « mettre Un coup de
   patte ? au lieu de Pas encore ? (un indice) ». */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sec = fs.readFileSync(path.join(ROOT, 'multiplayer-security.js'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';

test('sa propre ligne suit ce qu’on fait : écrire, tester (sans rien envoyer de plus)', () => {
  assert.ok(fn('jeuDirectJoueurs').includes('const t=J.koAt&&J.koAt[pid]?now-J.koAt[pid]:-1,w=J.ecritAt&&J.ecritAt[pid]?now-J.ecritAt[pid]:-1;'), 'plus de « jamais pour soi »');
  assert.ok(fn('jeuEcritVeille').includes('if(avant&&avant.n===n&&avant.v!==v){(J.ecritAt=J.ecritAt||{})[J.me]=Date.now();jeuEcritSignal(n);}'), 'taper : « Écrit sa requête »');
  assert.ok(fn('jeuEssaiRate').includes('if(J)(J.koAt=J.koAt||{})[J.me]=Date.now();'), 'une requête manquée : « Teste sa requête »');
  assert.ok(sec.includes("game.verifying = true;\n    // « Teste sa requête » sur sa propre ligne pendant que le serveur vérifie (Elisa, 8 novembre, 18 h 18).\n    (game.koAt = game.koAt || {})[game.me] = Date.now();\n    if (typeof jeuDirectPeindre === 'function') jeuDirectPeindre(n);"), 'en salle classée, pendant la vérification');
  assert.ok(app.includes('<script src="multiplayer-security.js?v=5"></script>'));
});

test('« Essaie encore » dans la carte des indices (9 novembre, 7 h 13 ; « Raté » à 2 h ; avant « Un coup de patte ? », et encore avant « Pas encore ») ; la pastille du bas, sans appel, garde son texte', () => {
  assert.ok(fn('defiIndicesHTML').includes('<span class="coach-st-k">Essaie encore</span><p>${diag}</p>') && !fn('defiIndicesHTML').includes('Un coup de patte&nbsp;?</span>'));
  const peek = fn('coachPeek');
  /* 19 h 18 puis 19 h 49 (« je veux juste pour l’indice ») : la pastille arrive avec un indice, et dit « Un coup de patte ? · voir l’indice » */
  assert.ok(peek.includes("b.innerHTML='<span aria-hidden=\"true\">↑</span>Un coup de patte\\u00a0? · voir l’indice';"));
  assert.ok(!fn('defiIndicesHTML').includes('Pas encore</span>') && !peek.includes('Pas encore'));
});
