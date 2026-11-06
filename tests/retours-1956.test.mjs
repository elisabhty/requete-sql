/* Elisa, 6 novembre, 19 h 56 : « Corrige ce qui peut être corrigé et dis-moi de trancher pour le reste ». Les erreurs vérifiées de la
   relecture des cours (8 élèves, 71 cours) :
   - ce qui n’est pas dit par la voix est corrigé tout de suite (l’explication de la bonne barre d’Agrégats, les résumés de SELF JOIN
     et de Plusieurs conditions dans ON) ;
   - ce que la voix dit attend sa voix refaite : tools/voix/<cours>-retouches.json porte les phrases à refaire et les textes de la page
     qui changent avec elles, que integrer.mjs pose au moment où la voix arrive. D’ici là, la page garde ses textes et sa voix. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const RET = fs.readdirSync(path.join(ROOT, 'tools/voix')).filter(f => f.endsWith('-retouches.json') && f !== 'video-site-retouches.json').sort();

test('chaque retouche : la voix du cours, ses phrases telles que dans le cours, et ses textes posés dans la page avec sa voix (intégrée le 6 novembre, 21 h 30)', () => {
  assert.deepEqual(RET.map(f => f.replace('-retouches.json', '')), ['as', 'between', 'comparer', 'fonctions-numeriques', 'group-by-colonnes',
    'lag-lead', 'not', 'plusieurs-conditions-on', 'projet-create', 'projet-index', 'quel-join-choisir', 'sous-requete-in']);
  for (const f of RET) {
    const r = JSON.parse(read('tools/voix/' + f)), c = f.replace('-retouches.json', ''), job = JSON.parse(read(`tools/voix/${c}.json`));
    const page = read(`assets/anim/${c}.html`);
    assert.equal(r.cours, c + '-retouches');
    assert.deepEqual([r.voix, r.modele], [job.voix, job.modele], `${c} : la voix du cours`);
    for (const e of r.elements) assert.deepEqual(e, job.elements.find(x => x.id === e.id), `${c}/${e.id} : le même texte que le cours`);
    /* Intégrée : le nouveau texte est posé une fois, l’ancien a disparu ; en attente de sa voix : l’ancien est encore là, une fois. */
    for (const [a, b] of [].concat(r.legendes || [], r.remplacements || [])) {
      if (page.includes(b)) { assert.ok(!page.includes(a), `${c} : l’ancien texte n’est plus dans la page`); assert.equal(page.split(b).length - 1, 1, `${c} : posé une fois`); }
      else assert.equal(page.split(a).length - 1, 1, `${c} : en attente de sa voix, le texte d’aujourd’hui une fois`);
    }
  }
});

test('integrer.mjs pose les textes d’une retouche avec sa voix, et seulement depuis son dossier', () => {
  const integ = read('tools/voix/integrer.mjs');
  assert.ok(integ.includes("const RET_F = path.join(DIR, path.basename(RAW) + '.json');") && integ.includes("const RET = GARDER && path.basename(RAW).startsWith(cours + '-') && fs.existsSync(RET_F)"));
  assert.ok(integ.includes('if (n === 1) page = page.replace(a, () => b);'));
  assert.ok(integ.includes("else if (!(n === 0 && page.includes(b))) { console.log(`Retouche introuvable dans la page (${n} fois) : ${a}`); process.exit(1); }"));
});

test('ce que la voix dira : les phrases corrigées', () => {
  const ph = (c, id) => JSON.parse(read(`tools/voix/${c}-retouches.json`)).elements.find(e => e.id === id).phrases || [];
  const dit = (c, id) => { const e = JSON.parse(read(`tools/voix/${c}-retouches.json`)).elements.find(x => x.id === id); return e.texte; };
  assert.ok(ph('between', 'ch06').includes('Ces 4 commandes reçoivent un nouvel e-mail de confirmation, cette fois en français.'));
  assert.ok(ph('as', 'ch03').includes('Même chose avec un symbole : sans guillemets, l’euro entre parenthèses donne une erreur.'));
  assert.ok(ph('not', 'ch02').includes('Ici, la date s’écrit au format année, mois, jour : 2023, tiret, 03, tiret, 01 correspond au 1er mars 2023.'));
  assert.ok(ph('not', 'ch05').includes('Les Parisiens, dont Sophie Martin, sont écartés, et âge supérieur à 35 écarte les plus jeunes : il reste 3 clients.'));
  assert.ok(ph('comparer', 'ch07').includes('La liste compte 3 produits, dont le Shaker Inox : pour l’écarter aussi, il faudra combiner deux conditions.'));
  assert.ok(ph('fonctions-numeriques', 'ch04').includes('Plus, moins, fois et divisé calculent comme sur une calculatrice, sauf entre deux entiers : 7 divisé par 2 donne 3.'));
  assert.ok(ph('group-by-colonnes', 'ch01').includes('La date et le statut de chaque commande se trouvent dans la table commandes.'));
  assert.equal(dit('plusieurs-conditions-on', 'at3'), '[cheerful] À toi ! Et avec or à la place de ènde, que devient le résultat ?');
  assert.ok(ph('lag-lead', 'ch05').includes('Sans partition baï, les commandes, rangées par client puis par date, forment une seule suite.'));
  assert.ok(dit('lag-lead', 'at3').includes('Sans partition baï, en rangeant par client puis par date, que lit lague'));
  assert.ok(ph('quel-join-choisir', 'ch06').includes('Nadia Benali, la directrice, n’a pas de manager : elle n’apparaît pas comme salariée.'));
  assert.ok(dit('quel-join-choisir', 'at3').includes('garde tous les bassins, même vides, et seulement eux ?'));
  assert.ok(ph('projet-create', 'ch04').includes('Une date a son propre type : date, au format année, mois, jour, comme 2026, tiret, 09, tiret, 12.'));
  const is = JSON.parse(read('tools/voix/insert-select.json')).elements.find(e => e.id === 'at2');
  assert.equal(is.texte, '[cheerful] À toi ! Que faut-il ajouter au SELECT pour que chaque valeur arrive dans la bonne colonne ?', 'INSERT … SELECT : refait avec les cours d’Anaïs');
});

test('ce qui n’est pas dit : corrigé tout de suite', () => {
  const ag = read('assets/anim/agregats.html');
  assert.ok(ag.includes("why: i === 1 ? `${eur(p)} est le prix le plus élevé : c’est celui que trouve <code>MAX(prix)</code>.`"), 'la bonne barre : son explication');
  const app = read('index.html'), vit = read('decouvrir/modules.js');
  for (const [t, r] of [['SELF JOIN', 'Comparer les lignes d’une même table'], ['Plusieurs conditions dans ON', 'Relier seulement les commandes à livrer à Paris']]) {
    assert.ok(app.includes(`titre:"${t}", résumé:"${r}",`) && vit.includes(`["${t}", "${r}",`), `${t} : un résumé qui dit le cours`);
  }
  assert.ok(!app.includes('Retrouver les clients qui habitent dans la même ville') && !app.includes('Relier seulement les produits encore en stock'));
});
