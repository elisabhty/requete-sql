/* Elisa, 10 novembre, 7 h 56 (sur une capture du widget vide, « Rien à réviser pour l’instant ») : « Crée des questions juste pour
   le widget en combinant tout : QCM, choix de la réponse à l’intérieur d’une requête, cas pratique etc., une centaine de questions
   cohérentes. » La banque POCHE_PLUS (index.html) : cinq genres, chaque question rattachée à sa leçon. Ici, chaque requête tourne sur
   la base de l’app (sql.js) : la bonne réponse marche et chaque autre échoue ou donne autre chose ; le résultat annoncé est le vrai ;
   la ligne fausse échoue, et corrigée, elle marche. Le widget (RequeteWidget.swift) lit le genre et l’énoncé.
   13 novembre, 8 h 32 (« il faudrait éviter les questions combien il y a de lignes car on ne peut pas exécuter ») : les vingt-cinq
   « Quel résultat ? » sont parties, il reste quatre genres ; l’entretien a sa banque et son test (retours-0832-poche-entretien). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { extractSeed } from '../scripts/db-snapshot.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');
const swift = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift');
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const ici = x => JSON.parse(JSON.stringify(x));
const PLUS = ici(vm.runInNewContext(entre(app, 'const POCHE_PLUS=[', '\n];\n') + '\n];POCHE_PLUS'));
const MODULES = ici(vm.runInNewContext(entre(app, 'const MODULES = [', 'const CHALLENGES=[').replace(/guide\(/g, '(') + ';MODULES', {}));
const LECONS = MODULES.flatMap(m => m.lessons).map(l => l.id);
const SQL = await createRequire(import.meta.url)('../vendor/sqljs/sql-wasm.js')({ locateFile: f => new URL('../vendor/sqljs/' + f, import.meta.url).pathname });
const SEED = extractSeed(app);
const LIGNES = ['Ligne 1', 'Ligne 2', 'Ligne 3'];
const nom = p => `${p.g} l${p.l} « ${p.e || p.q[0]} »`;

test('une centaine de questions, de quatre genres, rattachées aux leçons du parcours', () => {
  assert.ok(PLUS.length >= 95, PLUS.length + ' questions');
  const genres = {};
  for (const p of PLUS) genres[p.g] = (genres[p.g] || 0) + 1;
  assert.deepEqual(Object.keys(genres).sort(), ['cas', 'erreur', 'qcm', 'trou'], 'plus de « resultat » : le widget n’exécute rien');
  assert.ok(genres.qcm >= 30 && genres.cas >= 30 && genres.erreur >= 6, JSON.stringify(genres));
  assert.ok(PLUS.every(p => p.r === undefined), 'plus de résultat annoncé');
  for (const p of PLUS) assert.ok(LECONS.includes(p.l), nom(p) + ' : une leçon du parcours');
  assert.ok(new Set(PLUS.map(p => p.l)).size >= 60, 'presque toutes les leçons');
  assert.ok(PLUS.filter(p => p.l === LECONS[0]).length >= 5, 'de quoi commencer avant la première leçon');
  for (const b of [0, 1, 2]) assert.ok(PLUS.filter(p => p.b === b).length >= 30, 'la bonne réponse change de place : ' + b);
});

test('chaque question tient dans le widget, à la typographie de l’app', () => {
  const prose = s => s.replace(/`[^`]*`/g, '');
  for (const p of PLUS) {
    const n = nom(p), trous = p.q.join('\n').split('___').length - 1;
    assert.equal(p.c.length, 3, n); assert.equal(new Set(p.c).size, 3, n);
    assert.ok(p.c.join('').length <= 24, n + ' : les trois puces sur une ligne');
    assert.ok([0, 1, 2].includes(p.b), n);
    assert.equal(trous, ['trou', 'cas'].includes(p.g) ? 1 : 0, n + ' : les trous');
    if (p.g === 'qcm') assert.equal(p.q.length, 0, n); else assert.ok(p.q.length >= 1 && p.q.length <= (p.g === 'trou' ? 4 : 3), n);
    if (p.g === 'erreur') assert.deepEqual(p.c, LIGNES, n);
    const trou = Math.max(...p.c.map(c => c.length)) + 1;
    for (const l of p.q) assert.ok(l.replace('___', 'x'.repeat(trou)).length <= 36, `${n} : ligne trop longue : ${l}`);
    assert.equal(!!p.e, p.g !== 'trou', n + ' : l’énoncé');
    if (p.e) {
      assert.ok(p.e.length <= (p.q.length ? 44 : 100), `${n} : énoncé trop long (${p.e.length})`);
      assert.doesNotMatch(p.e, / [?!:;»]|« /, n + ' : espace insécable');
      assert.doesNotMatch(p.e, /^(Il|Elle|Ils|Elles) /, n + ' : le sujet nommé');
    }
    for (const k of ['oui', 'non']) {
      const s = p[k];
      assert.ok(s.replace(/`/g, '').length <= 40, `${n} ${k} : ${s}`);
      assert.equal((s.split('`').length - 1) % 2, 0, `${n} ${k} : accents graves`);
      assert.doesNotMatch(prose(s), / [?!:;»]|« /, `${n} ${k} : espace insécable`);
      assert.doesNotMatch(prose(s), /'/, `${n} ${k} : apostrophe typographique`);
      assert.doesNotMatch(s, /^(Il|Elle|Ils|Elles) /, `${n} ${k} : le sujet nommé (10 novembre)`);
    }
  }
});

const executable = s => s.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
const essai = s => {
  const db = new SQL.Database(); db.run(SEED);
  try {
    const r = db.exec(executable(s));
    const ordonne = /ORDER BY/.test(s) && !/OVER\s*\(/.test(s);
    const lignes = r.map(x => { const v = x.values.map(l => JSON.stringify(l)); return ordonne ? v : v.sort(); });
    const schema = db.exec('SELECT type, name, sql FROM sqlite_master ORDER BY name')[0]?.values || [];
    return { ok: true, r, sig: JSON.stringify({ lignes, schema, n: db.getRowsModified() }) };
  } catch (e) { return { ok: false, err: e.message }; } finally { db.close(); }
};

test('sur la base de l’app : la bonne réponse, le vrai résultat, la vraie ligne fausse', () => {
  let n = 0;
  for (const p of PLUS) {
    const code = p.q.join('\n');
    if (p.g === 'trou' || p.g === 'cas') {
      const bon = essai(code.replace('___', p.c[p.b]));
      assert.ok(bon.ok, `${nom(p)} : la bonne réponse échoue (${bon.err})`);
      p.c.forEach((c, i) => { if (i !== p.b) { const r = essai(code.replace('___', c)); assert.ok(!r.ok || r.sig !== bon.sig, `${nom(p)} : « ${c} » marche aussi`); } });
      n++;
    } else if (p.g === 'erreur') {
      assert.ok(!essai(code).ok, nom(p) + ' : la requête fausse échoue');
      n++;
    }
  }
  assert.ok(n >= 50, n + ' requêtes vérifiées');
});

test('le widget lit le genre et l’énoncé : l’étiquette, l’énoncé au-dessus du code, les lignes numérotées, la consigne', () => {
  const q = entre(swift, 'struct QuestionPoche: Codable, Hashable {', '\n}\n');
  assert.ok(q.includes('var genre: String? = nil') && q.includes('var enonce: String? = nil'), 'facultatifs : les anciennes questions se lisent encore');
  const r = entre(swift, 'enum PocheRangement {', '\nstruct BoutCode');
  for (const k of ['case "qcm": return "QCM · " + q.titre', 'case "cas": return "Cas pratique · " + q.titre',
    'case "erreur": return "Trouve l’erreur · " + q.titre', 'case "erreur": return "Touche la ligne fausse"',
    'q.choix.count >= 2 && q.bon >= 0 && q.bon < q.choix.count && (!q.code.isEmpty || aEnonce(q))', 'let place: CGFloat = aEnonce(q) ? 35 : 53', 'if q.genre == "erreur" { return false }'])
    assert.ok(r.includes(k), k);
  assert.ok(!r.includes('Quel résultat') && !r.includes('Touche le bon résultat'), '13 novembre : « Quel résultat ? » est parti');
  const v = entre(swift, 'struct PocheVue: View {', '\n}\n');
  for (const k of ['if PocheRangement.aEnonce(q) {\n                enonce(u, q, m)', 'if !q.code.isEmpty {\n                code(u, v, q, m)', 'let lignes: Int = seul ? 3 : 1',
    'ligne(item.element, item.offset, q, police, taille)', 'if numero {\n                Text(verbatim: "\\(n + 1) ")', 'consigne(u, q)'])
    assert.ok(v.includes(k), k);
  /* La page envoie le genre et l’énoncé */
  assert.ok(app.includes(".map(({p})=>({titre:module[p.l]||'',code:p.q||[],choix:p.c,bon:p.b,oui:p.oui,non:p.non,genre:p.g||'trou',enonce:p.e||''}));"));
  assert.ok(app.includes(".filter(p=>p.g!=='resultat');"), 'une ancienne question « resultat » ne part plus au widget');
});

test('10 novembre, 8 h 24 (« problème de formatage et ce n’est pas responsive ») : les mesures viennent de la vraie taille du widget', () => {
  const m = entre(swift, 'struct MesurePoche {', '\n}\n');
  for (const k of ['u = min(taille.width / 364, taille.height / 170)', 'chat = min(taille.width * 0.29, taille.height * 0.62)', 'contenu = max(120, taille.width - gauche - 14 * u)'])
    assert.ok(m.includes(k), k);
  const v = entre(swift, 'struct PocheVue: View {', '\n}\n');
  for (const k of ['let m = MesurePoche(taille)', '.frame(maxWidth: .infinity)\n            .frame(height: hauteur)', 'PocheRangement.policeReponses(q, u: u, largeur: m.contenu)',
    'PocheRangement.policeCode(q, u: u, v: v, largeur: m.contenu)', '.frame(minWidth: largeur, minHeight: hauteur)', 'verdictOuConsigne(u, q)\n                .frame(maxWidth: .infinity, alignment: .leading)\n            if repondu {\n                suivante(u, v)'])
    assert.ok(v.includes(k), k);
  assert.ok(!v.includes('242 * u'), 'plus de largeur fixe');
  const r = entre(swift, 'enum PocheRangement {', '\nstruct BoutCode');
  assert.ok(r.includes('let parLargeur: CGFloat = (largeur - 20 * u) / (0.61 * CGFloat(plusLongue))') && r.includes('static func largeurTrou(') && r.includes('static func policeReponses('));
});
