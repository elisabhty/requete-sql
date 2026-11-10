/* Elisa, 10 novembre, 13 h 05 (après la relecture finale des cours) :
   « Corrige en parlant un peu de qu’est-ce qu’une clé et corrige le reste de la meilleure des manières ; fin d’annonce : corrige ;
   oui fais le filtre ; OVER : refais l’animation ; LIMIT et OFFSET : augmente la limite. »
   - Les voix à refaire (tools/voix/<cours>-relecture.json) : la clé dite avant la 2e forme normale, EXCEPT qui retire 12 jours de
     juillet, le conseil du GROUP BY, « jamais vide », et WHERE / HAVING qui filtrent. Même nombre de légendes qu’avant.
   - La vidéo de fin : 71 cours et 247 requêtes (recomptées dans les 71 vidéos), comme l’écran de fin de l’app.
   - HAVING : les étiquettes affichées disent « filtre les lignes », « filtre les groupes ».
   - OVER : sans ORDER BY, OVER () rend les produits dans l’ordre de la table ; avec PARTITION BY, les lignes se rangent par catégorie. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('les voix à refaire : une par cours, au format des retouches, sans changer le nombre de légendes', () => {
  const attendu = {
    'projet-normaliser': ['Deuxième forme normale : chaque colonne dépend de toute la clé, les colonnes qui repèrent chaque ligne.', 'La clé d’une inscription, c’est le couple client et atelier'],
    'with-recursive': ['Ixèpte en retire 12, les jours de juillet avec au moins une commande : il reste 19 jours.'],
    'group-by-colonnes': ['Conseil : mets aussi dans le SELECT chaque colonne du groupe baï.'],
    'bases-relationnelles': ['sa valeur est unique et n’est jamais vide.'],
    having: ['WHERE filtre les lignes avant les groupes', 'WHERE filtre d’abord les lignes, puis hèvinngue filtre les groupes.']
  };
  for (const [cours, phrases] of Object.entries(attendu)) {
    const r = JSON.parse(lire(`tools/voix/${cours}-relecture.json`)), base = JSON.parse(lire(`tools/voix/${cours}.json`));
    assert.equal(r.cours, `${cours}-relecture`);
    assert.deepEqual(r.voix, base.voix, `${cours} : la voix du cours`);
    for (const p of phrases) assert.ok(r.elements.some(e => e.texte.includes(p)), `${cours} : ${p}`);
    for (const e of r.elements) {
      const o = base.elements.find(x => x.id === e.id);
      assert.equal(e.legendes.length, o.legendes.length, `${cours} ${e.id} : autant de légendes`);
      assert.equal(e.phrases.length, o.phrases.length, `${cours} ${e.id} : autant de phrases`);
      assert.ok(e.legendes.every(l => l.length <= 115), `${cours} ${e.id} : trois lignes au plus`);
    }
  }
  const doc = lire('tools/voix/A-REGENERER.md');
  assert.ok(doc.includes('with-recursive-relecture,group-by-colonnes-relecture,projet-normaliser-relecture,bases-relationnelles-relecture,having-relecture'));
});

test('la vidéo de fin : 71 cours et 247 requêtes, les mêmes nombres que l’app', () => {
  const fin = lire('assets/anim/fin-sql.html'), app = lire('index.html');
  assert.ok(fin.includes("cap('k3', \"15 modules, 71 cours<br>et 247 requêtes SQL.\", 4.8);") && fin.includes("const FSTAT = [[15, 'modules'], [71, 'cours'], [247, 'requêtes']];"));
  assert.ok(app.includes('const SQL_REQUETES=247;') && !fin.includes('65 cours'));
});

test('HAVING : WHERE et HAVING filtrent (ORDER BY, lui, trie)', () => {
  const h = lire('assets/anim/having.html');
  assert.ok(h.includes('id="sp4a" style="top:127px">filtre les lignes</span>') && h.includes('id="sp4b" style="top:227px">filtre les groupes</span>'));
  assert.ok(h.includes('<span class="sk">WHERE</span><span class="sx">filtre les lignes</span>') && h.includes('<span class="sk">HAVING</span><span class="sx">filtre les groupes</span>'));
});

test('OVER : l’ordre de la table avec OVER (), puis les lignes rangées par catégorie avec PARTITION BY', () => {
  const o = lire('assets/anim/over.html');
  assert.ok(o.includes("const PAR_ID = ['Fibre Prébiotique', 'Collagène Marin', 'Magnésium', 'Vitamine D', 'Tisane Détox', 'Protéine Végétale', 'Oméga 3', 'Shaker Inox']"));
  assert.ok(o.includes("$('#rows3').innerHTML = PAR_ID.map(") && o.includes("$('#pr2').innerHTML = PAR_ID.map("));
  assert.ok(o.includes("r3.forEach((r, i) => { const j = ordre.indexOf(r.dataset.n) - i; if (j) tl.to(r, {y: j * 52, duration: 0.34, ease: 'power2.inOut'}, 84.42); });"));
});
