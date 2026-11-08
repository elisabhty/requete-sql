/* Elisa, 8 novembre, 14 h 59 (capture de « Rejoindre une partie · Entre ton code ! », clavier ouvert, Safari d’iOS) : « Cette page
   saute avec le clavier ». La feuille était posée en bas et suivait le clavier (visualViewport) : au toucher du champ, Safari faisait
   d’abord défiler la page pour montrer le champ, puis la feuille remontait au-dessus du clavier, une fois les dimensions connues : deux
   sauts. Maintenant, la feuille du code descend du haut de l’écran et y reste : le champ est déjà au-dessus du clavier, Safari n’a rien
   à faire défiler, le clavier monte dessous sans rien déplacer. Les autres feuilles (créer, seul, la fiche d’un joueur) restent en bas. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}';

test('la feuille du code est en haut de l’écran : elle en descend et y repart', () => {
  for (const k of ['html.lq .dx-feuille[data-k="code"]{align-items:flex-start}',
    'html.lq .dx-feuille[data-k="code"] .dx-f-boite{margin:calc(8px + var(--safe-top,0px)) 0 0;transform:translateY(calc(-100% - 40px))}',
    'html.lq .dx-feuille.on[data-k="code"] .dx-f-boite{transform:none}',
    'html.lq .dx-feuille.off[data-k="code"] .dx-f-boite{transform:translateY(calc(-100% - 40px))}'])
    assert.ok(lq.includes(k), k);
  assert.ok(lq.includes('.dx-feuille{position:fixed;inset:0;z-index:2600;display:flex;align-items:flex-end;'), 'les autres feuilles restent en bas');
  assert.ok(fn('defisFeuilleOuvrir').includes('el.dataset.k=k;'), 'la feuille dit laquelle elle est');
});

test('plus rien ne suit le clavier : ni le champ, ni le visualViewport ne déplacent la feuille', () => {
  const c = fn('dxFeuilleCaler');
  assert.ok(c.includes("el.style.top='0px';el.style.height=window.innerHeight+'px';el.style.bottom='auto';"));
  assert.ok(!c.includes('vv.offsetTop') && !c.includes('vv.height') && !c.includes('activeElement'));
  const o = fn('defisFeuilleOuvrir');
  assert.ok(!o.includes("inp.addEventListener('focus'") && !o.includes("inp.addEventListener('blur'"));
  assert.ok(o.includes('inp.focus({preventScroll:true})'), 'le champ prend toujours le focus à l’ouverture');
});
