/* Elisa, 10 novembre : « Enlever tous les exemple concret / base et faire plutôt une réponse générale mais très bien formulé pour
   toute les questions reprendre ce qu’il y a déjà comme matière ».
   Les 142 questions d’entretien n’ont plus d’exemple concret (le tableau d’un univers inventé), ni d’exemple SQL, ni de schéma en
   étoile : chaque réponse est générale, à la première personne, comme le candidat la dirait. Ce que disaient les exemples et les
   relances (les pièges, les écarts entre SGBD) est repris dans la réponse, en deux à quatre paragraphes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lq = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const a0 = html.indexOf('const ENTRETIEN=['), b0 = html.indexOf('\n];', a0) + 3;
const ctx = {}; vm.runInNewContext(html.slice(a0, b0).replace('const ENTRETIEN', 'this.E'), ctx);
const E = ctx.E;
const NB = ' ';
const sansCode = t => t.replace(/<code>[\s\S]*?<\/code>/g, 'CODE');

test('les 142 questions : la question, ses notions et une réponse, plus d’exemple', () => {
  assert.equal(E.length, 142);
  for (const q of E) {
    assert.deepEqual(Object.keys(q).filter(k => k !== 'syntaxe'), ['id', 'niveau', 'cat', 'notions', 'dialectes', 'q', 'a'], q.id);
    const paras = q.a.split('\n\n');
    assert.ok(paras.length >= 2 && paras.length <= 4 && paras.every(p => p.trim() && !p.includes('\n')), `${q.id} : ${paras.length} paragraphes`);
    /* Débutant : des phrases courtes et des mots simples (Elisa, 10 novembre, 1 h 41 : « trop compliqué pour des débutants ») */
    const [min, max] = q.niveau === 'Débutant' ? [120, 700] : [300, 1100];
    assert.ok(q.a.length >= min && q.a.length <= max, `${q.id} : ${q.a.length} caractères`);
    assert.doesNotMatch(q.a.replace(/<\/?(code|b|i)>/g, ''), /<[^>]*>/, `${q.id} : seulement <code>, <b> et <i>`);
    assert.equal((q.a.match(/<code>/g) || []).length, (q.a.match(/<\/code>/g) || []).length, `${q.id} : <code> fermés`);
  }
});

test('des réponses générales : plus aucun univers inventé', () => {
  const UNIVERS = /\b(festival|food truck|théâtre|camping|campeur|apicole|ruches?|escape game|urgences|bibliothèque|lecteurs?|vélos|cyclistes?|station de ski|forfaits|aquarium|bassins?|mobil-home|auditeurs?|spectateurs?|élèves?|auto-école|jardin partagé|parcelles|épiceries|Brest|Malo|Bastille|Anna Pires)\b/i;
  for (const q of E) {
    const m = sansCode(q.a).match(UNIVERS);
    assert.equal(m, null, `${q.id} : « ${m && m[0]} »`);
  }
});

test('la typographie : espaces insécables, apostrophes et guillemets', () => {
  for (const q of E) {
    const s = sansCode(q.a);
    assert.doesNotMatch(s, / [:;?!»]/, `${q.id} : une espace insécable avant « : ; ? ! »`);
    assert.doesNotMatch(s, /[A-Za-zÀ-ÿ)][;?!]/, `${q.id} : une espace avant « ; ? ! »`);
    assert.doesNotMatch(s, /[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ]/, `${q.id} : l’apostrophe typographique`);
    assert.doesNotMatch(s, new RegExp(`«(?!${NB})|(?<!${NB})»`), `${q.id} : des espaces insécables dans les guillemets`);
  }
});

test('ce que disaient les exemples est repris dans la réponse', () => {
  const a = id => E.find(q => q.id === id).a;
  assert.ok(a('ent-v2-73').includes('requêtes paramétrées') && a('ent-v2-73').includes('<code>EXECUTE</code>'), 'injection : le SQL dynamique');
  assert.ok(a('ent-v2-91').includes("<code>'100'</code> passe avant <code>'9'</code>"), 'CAST : le tri du texte');
  assert.ok(a('ent-v2-96').includes('<code>excluded</code>') && a('ent-v2-96').includes('<code>INSERT IGNORE</code>'), 'upsert : les relances');
  assert.ok(a('ent-v2-112').includes('T-SQL') && a('ent-v2-112').includes('PL/pgSQL'), 'dialectes : la relance');
  assert.ok(a('ent-v2-121').includes('<code>AUTO_INCREMENT</code>'), 'clé artificielle : l’identifiant selon le SGBD');
});

test('l’écran n’affiche plus d’exemple concret, de schéma ni d’exemple SQL', () => {
  const f = html.slice(html.indexOf('function renderEntretienFocus(x){'), html.indexOf('\n}\n', html.indexOf('function renderEntretienFocus(x){')));
  assert.ok(f.includes("${x.q.a.split('\\n\\n').map(p=>`<p class=\"eans\">${entCodeInsec(p)}</p>`).join('')}"), 'la réponse, paragraphe par paragraphe');
  assert.ok(f.includes('ent-notions') && f.includes('Voir selon le SGBD'), 'les notions et le lien « Voir selon le SGBD » restent');
  assert.doesNotMatch(f, /Exemple concret|Exemple SQL|entExemple|entEtoile|x\.q\.(ex|sql|apres|etoile)\b/);
  assert.ok(!html.includes('function entExemple(') && !html.includes('function entEtoile('));
  assert.doesNotMatch(lq, /\.ent-ex\b|\.ent-star|eans-apres/, 'leur style est parti avec eux');
});

test('la vitrine compte les niveaux de l’appli, et plus de « À retenir »', () => {
  const vitrine = fs.readFileSync(path.join(ROOT, 'decouvrir/index.html'), 'utf8');
  const nb = k => E.filter(q => q.niveau === k).length;
  assert.ok(vitrine.includes(`<li>Débutant · ${nb('Débutant')}</li><li>Intermédiaire · ${nb('Intermédiaire')}</li><li>Avancé · ${nb('Avancé')}</li>`));
  assert.ok(!html.includes('class="ent-retenir"'));
});

test('le code d’une réponse ne se coupe pas en deux, jusqu’à 28 caractères (10 novembre, 1 h 06)', () => {
  const ctx = {}; vm.runInNewContext(html.slice(html.indexOf('function entCodeInsec('), html.indexOf('\nfunction entNbsp(')) + ';this.f=entCodeInsec;', ctx);
  assert.equal(ctx.f('et <code>COUNT(DISTINCT colonne)</code> compte'), 'et <code class="ins">COUNT(DISTINCT colonne)</code> compte');
  assert.equal(ctx.f('<code>COUNT(*) - COUNT(colonne)</code>'), '<code class="ins">COUNT(*) - COUNT(colonne)</code>', 'ni après le « - »');
  const long = '<code>INSERT … ON CONFLICT … DO UPDATE SET x = 1</code>';
  assert.equal(ctx.f(long), long, 'plus long : il peut se couper');
  assert.ok(lq.includes('html.lq .eans code{padding:1px 7px;border-radius:7px;background:var(--accent-soft);color:var(--accent-ink);font:700 .9em/1.4 var(--mono);-webkit-box-decoration-break:clone;box-decoration-break:clone}'), 'chaque morceau garde sa pastille');
  assert.ok(lq.includes('html.lq .eans code.ins,.ent-focus .eans code.ins{white-space:nowrap}'), 'la pastille courte reste entière');
});

test('le double filtre : les onglets comptent dans la famille, les familles dans l’onglet (10 novembre, 1 h 06)', () => {
  const r = html.slice(html.indexOf('function renderEntretien('), html.indexOf('\nfunction setEntFilter('));
  assert.ok(r.includes("const dansTab=found.filter(x=>entStatus==='ok'?entOk(x.id):entStatus==='review'?!entOk(x.id):true);"));
  assert.ok(r.includes('const ok=dansFam.filter(x=>entOk(x.id)).length, total=dansFam.length;'), 'onglets : dans la famille');
  assert.ok(r.includes("const n=k==='all'?dansTab.length:dansTab.filter(x=>ENT_FAMILLE_DE[x.q.cat]===k).length;") && r.includes("if(!n&&k!=='all'&&entFilter!==k)return '';"), 'familles : dans l’onglet, les vides cachées');
});

test('la syntaxe en SQL, dans un cadre, quand elle aide (Elisa, 10 novembre, 1 h 26)', () => {
  const avec = E.filter(q => q.syntaxe);
  assert.ok(avec.length >= 120, `${avec.length} questions avec leur syntaxe`);
  for (const q of avec) {
    for (const l of q.syntaxe.split('\n')) assert.ok(l.length <= 30 && l === l.trimEnd(), `${q.id} : « ${l} » (${l.length} caractères, iPhone)`);
    assert.doesNotMatch(q.syntaxe, /festival|vélo|velo|élève|camping|ruche|spectateur|auditeur/i, `${q.id} : des noms génériques`);
  }
  /* Les questions de culture générale n’en ont pas */
  for (const id of ['ent-v2-45', 'ent-v2-76', 'ent-v2-77', 'ent-v2-109']) assert.ok(!E.find(q => q.id === id).syntaxe, id);
  assert.equal(E.find(q => q.id === 'ent-v2-12').syntaxe, 'SELECT DISTINCT a, b\nFROM t;');
  const f = html.slice(html.indexOf('function renderEntretienFocus(x){'), html.indexOf('\n}\n', html.indexOf('function renderEntretienFocus(x){')));
  assert.ok(f.includes('${x.q.syntaxe?`<div class="esql sql-copy-wrap ent-syntaxe"><span class="esql-lab">Syntaxe</span>${sqlCopyBtn()}<pre>${highlight(x.q.syntaxe)}</pre></div>`:\'\'}'), 'le cadre de code, colorié et copiable');
  assert.ok(f.indexOf('ent-syntaxe') < f.indexOf('ent-notions'), 'sous la réponse, avant les notions');
});

test('les réponses Débutant, simples : phrases courtes, sans jargon (Elisa, 10 novembre, 1 h 41)', () => {
  const D = E.filter(q => q.niveau === 'Débutant');
  assert.equal(D.length, 47);
  const JARGON = /hach|optimiseur|clé candidate|intégrité référentielle|collation|journalis|autocommit|atomique|plan d’exécution|agrégat\b|UNKNOWN|ANSI|Codd|SGBD relationnel/i;
  for (const q of D) {
    const t = sansCode(q.a);
    assert.doesNotMatch(t, JARGON, `${q.id} : ${(t.match(JARGON) || [''])[0]}`);
    const phrases = t.split(/(?<=[.!?])\s+/).filter(Boolean);
    assert.ok(phrases.every(ph => ph.length <= 230), `${q.id} : une phrase trop longue (${phrases.find(ph => ph.length > 230)})`);
    assert.ok(q.a.length <= 700, `${q.id} : ${q.a.length} caractères`);
  }
  assert.ok(E.find(q => q.id === 'ent-v2-12').a.startsWith('<code>DISTINCT</code> supprime les lignes en double dans le résultat\u00a0: chaque ligne n’apparaît qu’une seule fois.'));
});
