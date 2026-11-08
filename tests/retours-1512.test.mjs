/* Elisa, 7 novembre, 15 h 12 (capture de la question d’entretien sur les doublons, « La table abonnes d’un service de vélos… ») :
   « Pourquoi il manque des caractères spéciaux : abonnes au lieu de abonnés ? Corrige ici et ailleurs ».
   En SQL, les noms de tables et de colonnes s’écrivent sans accent (abonnes, capacite, meteo…) : posés tels quels dans une phrase,
   ils passaient pour des fautes. Ils s’affichent maintenant comme du code, en pastille violette :
   - les textes simples (la consigne et la piste des défis, les exemples et la légende des questions d’entretien, les « Pas encore »
     des exercices) les écrivent entre accents graves, que escCode change en <code> après l’échappement ;
   - les textes en HTML (une leçon, les relances des questions d’entretien) et les cours en vidéo (légendes, questions, explications)
     les mettent dans <code>.
   Les mots de la phrase, eux, gardent leurs accents. Vérifié dans un navigateur : la question des doublons (393 px). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

/* Les noms sans accent qui ressemblaient à des fautes */
const NOMS = ['abonnes', 'reservations', 'meteo', 'experiences', 'recoltes', 'releves', 'annee', 'quantite', 'adherents', 'remontees', 'resultats',
  'especes', 'presence', 'arrivee', 'aeroports', 'capacite', 'categories', 'equipes', 'velos', 'reussie', 'benevoles', 'categorie', 'prenom', 'scene',
  'eleves', 'nationalite', 'medicament', 'degustations', 'echantillons', 'specialite', 'etat', 'vegetarien', 'equipements', 'enigmes', 'creneaux',
  'scenes', 'entrees', 'ecoutes', 'duree', 'debut', 'sejours', 'pieces', 'telephone', 'lecons', 'cle', 'evenements', 'comediens', 'humidite',
  'fidelite', 'age', 'seances', 'entrepot', 'medecins'];
const re = new RegExp(`(?<![\\w\\-.@#’'])(${NOMS.join('|')})(?![\\w\\-(@])`, 'g');
const horsCode = t => t.replace(/`[^`\n]*`/g, ' ').replace(/<code>[\s\S]*?<\/code>/g, ' ').replace(/<span class="(?:ic|codepill|cc)[^"]*">[\s\S]*?<\/span>/g, ' ');

test('escCode : le texte échappé, les accents graves en <code>', () => {
  const ctx = vm.createContext({});
  vm.runInContext(cut('function esc(s){', '\nfunction escAttr(s){') + cut('function escCode(s){', '\n'), ctx);
  assert.equal(ctx.escCode('La table `abonnes` d’un service de vélos'), 'La table <code>abonnes</code> d’un service de vélos');
  assert.equal(ctx.escCode('`COUNT(*) > 1` et `a<b`'), '<code>COUNT(*) &gt; 1</code> et <code>a&lt;b</code>', 'échappé avant');
  assert.equal(ctx.escCode('<script>'), '&lt;script&gt;');
  assert.equal(ctx.escCode('un ` seul'), 'un ` seul', 'un accent grave isolé reste tel quel');
});

test('les textes simples passent par escCode : défis, questions d’entretien, « Pas encore » des exercices', () => {
  const dq = cut('function defiConsigneHTML(c,o){', '\n}');
  for (const s of ["${c.situation?`<p class=\"defi-ctx\">${escCode(c.situation)}</p>`:''}", "${l.map(x=>`<li>${escCode(x)}</li>`).join('')}", "`<p class=\"dq-t\">${escCode(tri[0])}</p>`"])
    assert.ok(dq.includes(s), s);
  assert.ok(cut('function defiIndices(c){', '\n}').includes("['La piste',escCode(c.indice||"));
  const ex = cut('function entExemple(ex){', '\n}');
  for (const k of ['ex.intro', 'n', 'ex.precision', 'ex.attention']) assert.ok(ex.includes(`\${escCode(${k})}`), k);
  assert.equal((ex.match(/\$\{esc\(/g) || []).length, 2, 'esc() ne reste que pour les cases du tableau (en-têtes et valeurs)');
  assert.ok(cut('function entEtoile(et){', '\n}').includes('<figcaption>${escCode(et.legende)}</figcaption>'));
  assert.ok(app.includes('<b>Pas encore</b><p>${escCode(check.diag)}</p>') && app.includes('<b>Pas encore</b><p>${escCode(concept.diag)}</p>'));
  assert.ok(lq.includes('html.lq .ent-focus :is(.ent-ex,.ent-star figcaption) code{padding:1px 6px;border-radius:7px;background:var(--accent-soft);color:var(--accent-ink);font:700 .9em/1.4 var(--mono);'), 'la pastille dans les exemples');
});

test('la capture d’Elisa : « La table abonnes » devient la table `abonnes`', () => {
  assert.ok(app.includes('ex:{intro:"La table `abonnes` d’un service de vélos en libre-service, avec un e-mail saisi deux fois et deux e-mails manquants :"') || app.includes('ex:{intro:"La table `abonnes` d’un service de vélos en libre-service, avec un e-mail saisi deux fois et deux e-mails manquants :"'));
  assert.ok(!app.includes('La table abonnes'), 'plus nulle part');
});

test('les défis : plus aucun nom sans accent hors code dans la consigne et la piste', () => {
  const vus = [];
  for (const m of app.matchAll(/\b(indice|situation|tri):"((?:[^"\\]|\\.)*)"/g))
    for (const w of horsCode(m[2]).matchAll(re)) vus.push(`${m[1]} : ${w[1]} …${m[2].slice(0, 70)}`);
  for (const m of app.matchAll(/\b(precis|garde|affiche):\[((?:"(?:[^"\\]|\\.)*",?\s*)+)\]/g))
    for (const w of horsCode(m[2]).matchAll(re)) vus.push(`${m[1]} : ${w[1]} …${m[2].slice(0, 70)}`);
  assert.deepEqual(vus, []);
  assert.ok(app.includes('Relie la table `reservations` à la table `vols` par `vol_id`.') && app.includes('`reussie` vaut 0 et `indices_demandes` vaut 0.'), 'les autres noms de la phrase aussi');
  assert.ok(app.includes('Les tables `pistes` et `remontees` ont chacune une colonne `nom` et une colonne `etat`'));
});

test('les questions d’entretien : plus aucun nom sans accent hors code dans les exemples, la légende et les relances', () => {
  const vus = [];
  for (const m of app.matchAll(/\b(intro|note|attention|precision|legende|apres):"((?:[^"\\]|\\.)*)"/g)) {
    const t = m[1] === 'apres' ? m[2] : m[2];
    for (const w of horsCode(t).matchAll(re)) vus.push(`${m[1]} : ${w[1]} …${t.slice(0, 80)}`);
  }
  assert.deepEqual(vus, []);
  assert.ok(app.includes('il faudrait joindre la table <code>recoltes</code> au résultat d’un <code>GROUP BY ruche_id</code>'), 'une relance en HTML : <code>');
  assert.ok(app.includes('`ROLLUP (annee, mois)` équivaut à `GROUPING SETS ((annee, mois), (annee), ())`'), 'l’expression entière, pas seulement le nom');
});

test('une leçon et un exercice', () => {
  assert.ok(app.includes('aucune ligne de la table <code>fidelite</code> ne leur correspond.'));
  assert.ok(app.includes("diag:'Il manque la colonne `categorie`, en TEXT.'"));
});

test('les cours en vidéo : les noms en <code> dans les légendes, les questions et les explications', () => {
  const A = f => lire('assets/anim/' + f);
  const lj = A('left-join.html');
  assert.ok(lj.includes('"Pour eux, les colonnes de <code>fidelite</code> contiennent <code>NULL</code>."') && lj.includes('<span>Table <code>fidelite</code></span>') && lj.includes('<span>Table <code>clients</code></span>'));
  assert.ok(!lj.includes('<b>table fidelite</b>') && lj.includes('aucune ligne de la table <span class="ic">fidelite</span> ne leur correspond.'));
  const al = A('projet-alter.html');
  assert.ok(al.includes("prompt: 'Que contient la colonne <code>telephone</code> pour les quatre coachs, juste après son ajout ?'") && al.includes("'La colonne <code>seances</code> indique le nombre de séances"));
  assert.ok(A('projet-drop.html').includes("fi: 'La <b>table</b>&nbsp;<code>fidelite</code> enregistre"));
  assert.ok(A('quel-join-choisir.html').includes("fr('Pour Julie Roy, <code>medecin_id</code> vaut 1 : où trouver cet identifiant dans <code>medecins</code> ?')"));
  assert.ok(A('insert-select.html').includes('du <code>SELECT</code> : <code>prenom</code>, <code>nom</code> et <code>email</code>."'));
  assert.ok(A('projet-merge.html').includes('la table <code>entrepot</code>."') && A('ordre-execution.html').includes("why: '<code>quantite</code> est une colonne de la table"));
  assert.ok(A('projet-vue.html').includes("{label: 'nom, catégorie et prix', ok: true,"), 'un choix (texte simple) : le mot avec son accent, comme à la question suivante');
});
