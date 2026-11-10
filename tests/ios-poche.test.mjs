/* Elisa, 7 novembre (« Requête de poche », d’après la planche : « Une question tirée de tes leçons. Tu réponds dans le widget, sans
   ouvrir l’app. » ; pour la flamme, son choix : « la séance seule »). Dans l’app iPhone, un widget moyen (iOS 17, ses boutons) : une
   requête à trou et trois réponses, dont une seule marche. La banque (index.html, POCHE) a une question par leçon ; chaque requête
   s’exécute ici sur la base de l’app (sql.js) : la bonne réponse marche, chaque autre échoue ou donne autre chose. La page en range
   une vingtaine pour le widget (widgetPoche), le pont les garde (RequeteWidgetPlugin.swift), le widget répond par App Intents. */
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
const pont = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const ios = lire('IOS.md');
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const ici = x => JSON.parse(JSON.stringify(x));   // des tableaux de ce contexte (deepEqual compare aussi leur prototype)
const POCHE = ici(vm.runInNewContext(entre(app, 'const POCHE=[', '\n];\n') + '\n];POCHE'));
const POCHE_PLUS = ici(vm.runInNewContext(entre(app, 'const POCHE_PLUS=[', '\n];\n') + '\n];POCHE_PLUS'));
const MODULES = ici(vm.runInNewContext(entre(app, 'const MODULES = [', 'const CHALLENGES=[').replace(/guide\(/g, '(') + ';MODULES', {}));
const LECONS = MODULES.flatMap(m => m.lessons);
const SQL = await createRequire(import.meta.url)('../vendor/sqljs/sql-wasm.js')({ locateFile: f => new URL('../vendor/sqljs/' + f, import.meta.url).pathname });
const SEED = extractSeed(app);
/* Ce que SQLite ne sait pas faire (droits, MERGE, procédures, schémas, ALL, niveaux d’isolation), et deux extraits (le trigger sans
   son corps, la clé étrangère d’une table qui l’a déjà) : leur forme est vérifiée, pas leur exécution */
const HORS_SQLITE = [50, 70, 71, 81, 82, 83, 84, 86];

test('une question par leçon, et rien d’autre', () => {
  const ids = POCHE.map(p => p.l);
  assert.equal(new Set(ids).size, ids.length, 'une seule question par leçon');
  assert.deepEqual([...ids].sort((a, b) => a - b), LECONS.map(l => l.id).sort((a, b) => a - b), 'toutes les leçons');
  /* La bonne réponse n’est pas toujours au même endroit */
  for (const b of [0, 1, 2]) assert.ok(POCHE.filter(p => p.b === b).length >= 20, 'position ' + b);
});

test('chaque question tient dans le widget : un trou, trois réponses courtes, un pourquoi d’une ligne, l’espace insécable', () => {
  for (const p of POCHE) {
    const t = p.q.join('\n');
    assert.equal(t.split('___').length - 1, 1, p.l + ' : un seul trou');
    assert.ok(p.q.length >= 2 && p.q.length <= 4, p.l + ' : de 2 à 4 lignes');
    const trou = Math.max(...p.c.map(c => c.length)) + 1;
    for (const l of p.q) assert.ok(l.replace('___', 'x'.repeat(trou)).length <= 36, `${p.l} : ligne trop longue : ${l}`);
    assert.equal(p.c.length, 3, p.l); assert.equal(new Set(p.c).size, 3, p.l + ' : trois réponses différentes');
    assert.ok(p.c.join('').length <= 24, p.l + ' : les trois puces tiennent sur une ligne');
    assert.ok([0, 1, 2].includes(p.b), p.l);
    for (const k of ['oui', 'non']) {
      const s = p[k];
      assert.ok(s.replace(/`/g, '').length <= 40, `${p.l} ${k} : ${s}`);
      assert.equal((s.split('`').length - 1) % 2, 0, `${p.l} ${k} : les mots de SQL entre accents graves`);
      assert.doesNotMatch(s.replace(/`[^`]*`/g, ''), / [?!:;»]|« /, `${p.l} ${k} : espace insécable`);
      assert.doesNotMatch(s, /bientôt|prochainement/i);
    }
    assert.ok(/^[A-ZÀ-ÖÉ«'`<%1-9]/.test(p.oui) && /[.!]$/.test(p.oui.replace(/`$/, '')), p.l + ' : une phrase');
  }
});

/* Une requête remplie : sans ses lignes de commentaire, et « SELECT * » devant un extrait qui commence par FROM */
const remplir = (p, c) => p.q.join('\n').replace('___', c);
const executable = s => { const t = s.split('\n').filter(l => !/^\s*--/.test(l)).join('\n'); return /^\s*FROM\b/.test(t) ? 'SELECT * ' + t : t; };
const essai = s => {
  const db = new SQL.Database(); db.run(SEED);
  try {
    const r = db.exec(executable(s));
    const ordonne = /ORDER BY/.test(s) && !/OVER\s*\(/.test(s);
    const lignes = r.map(x => { const v = x.values.map(l => JSON.stringify(l)); return ordonne ? v : v.sort(); });
    const schema = db.exec('SELECT type, name, sql FROM sqlite_master ORDER BY name')[0]?.values || [];
    return { ok: true, sig: JSON.stringify({ lignes, schema, n: db.getRowsModified() }) };
  } catch (e) { return { ok: false, err: e.message }; } finally { db.close(); }
};

test('sur la base de l’app : la bonne réponse s’exécute, chaque autre échoue ou donne autre chose', () => {
  let executees = 0;
  for (const p of POCHE) {
    if (HORS_SQLITE.includes(p.l)) continue;
    const bon = essai(remplir(p, p.c[p.b]));
    assert.ok(bon.ok, `${p.l} : la bonne réponse échoue (${bon.err})`);
    executees++;
    p.c.forEach((c, i) => {
      if (i === p.b) return;
      const r = essai(remplir(p, c));
      assert.ok(!r.ok || r.sig !== bon.sig, `${p.l} : « ${c} » marche aussi`);
    });
  }
  assert.ok(executees >= 60, executees + ' requêtes exécutées');
});

test('la page range une trentaine de questions : les leçons faites (et la première, pour commencer), celles à revoir d’abord, le même ordre toute la journée', () => {
  const src = entre(app, 'function widgetPoche(){', 'if(typeof document!==');
  const essaiPage = ({ faites, dues = [], jour = new Date(2026, 10, 7) }) => {
    const ctx = vm.createContext({ POCHE, POCHE_PLUS, MODULES, allLessons: LECONS, itemDone: id => faites.includes(id),
      dueList: () => LECONS.filter(l => dues.includes(l.id)), auj: () => jour,
      dstr: d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` });
    vm.runInContext(src, ctx);
    return JSON.parse(JSON.stringify(ctx.widgetPoche()));
  };
  /* 10 novembre : aucune leçon faite, les questions de la toute première leçon (le widget n’est plus vide) */
  const decouverte = essaiPage({ faites: [] });
  assert.equal(decouverte.length, POCHE.filter(p => p.l === 0).length + POCHE_PLUS.filter(p => p.l === 0).length);
  assert.ok(decouverte.length >= 5 && decouverte.every(q => q.titre === 'Introduction'), 'une découverte');
  const trois = essaiPage({ faites: [0, 4, 17] });
  assert.deepEqual([...new Set(trois.map(q => q.titre))].sort(), ['Agrégats et regroupements', 'Introduction', 'Lire une table']);
  const h = trois.find(q => q.titre === 'Agrégats et regroupements' && q.genre === 'trou');
  assert.deepEqual(Object.keys(h), ['titre', 'code', 'choix', 'bon', 'oui', 'non', 'genre', 'enonce'], 'ce que lit le widget (QuestionPoche)');
  assert.equal(h.choix[h.bon], 'HAVING');
  const toutes = LECONS.map(l => l.id);
  const a = essaiPage({ faites: toutes }), b = essaiPage({ faites: toutes });
  assert.equal(a.length, 30, 'trente au plus');
  assert.ok(new Set(a.map(q => q.genre)).size >= 3, 'des genres mêlés');
  assert.deepEqual(a, b, 'le même ordre dans la journée');
  assert.notDeepEqual(essaiPage({ faites: toutes, jour: new Date(2026, 10, 8) }), a, 'un autre le lendemain');
  const dues = essaiPage({ faites: toutes, dues: [77, 89] });
  const nDues = POCHE.concat(POCHE_PLUS).filter(p => [77, 89].includes(p.l)).length;
  assert.ok(dues.slice(0, nDues).every(q => ['Sous-requêtes et ensembles', 'Fonctions de fenêtre'].includes(q.titre)), 'les leçons à revoir d’abord');
  assert.ok(dues.slice(0, nDues).some(q => q.code[0] === POCHE.find(p => p.l === 77).q[0]), 'leur requête à trou aussi');
  /* Le bac à sable de la série (retours-0354) n’a pas de leçons : la question reste vide, la série part quand même */
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInNewContext(src + ';widgetPoche()', {}))), []);
  assert.ok(app.includes('poche:JSON.stringify(widgetPoche())'), 'avec la série (widgetMaj)');
});

test('le pont garde les questions ; une nouvelle série repart de la première, la même laisse le widget où il en est', () => {
  const maj = entre(pont, '@objc func maj(_ call: CAPPluginCall) {', '\n    }\n');
  assert.ok(maj.includes('let poche: String = call.getString("poche") ?? "[]"\n        if poche != (d.string(forKey: "poche") ?? "") {\n            d.set(poche, forKey: "poche")\n            d.set(0, forKey: "pocheIndex")\n            d.set(-1, forKey: "pocheChoix")\n        }'));
  assert.ok(maj.indexOf('forKey: "poche"') < maj.indexOf('WidgetCenter.shared.reloadAllTimelines()'));
});

test('le widget : moyen, iOS 17 (ses boutons), ses réponses passent par App Intents, sans toucher à la flamme', () => {
  assert.ok(swift.includes('import AppIntents\n'));
  const w = entre(swift, 'struct RequetePoche: Widget {', '\n}\n');
  for (const k of ['let kind = "RequetePoche"', 'StaticConfiguration(kind: kind, provider: PocheFournisseur()) { entree in', '.containerBackground(for: .widget) { fondPoche }',
    '.configurationDisplayName("La requête de poche")', '.supportedFamilies([.systemMedium])', '.contentMarginsDisabled()'])
    assert.ok(w.includes(k), k);
  for (const k of ['@available(iOS 17.0, *)\nstruct RequetePoche: Widget {', '@available(iOS 17.0, *)\nstruct PocheVue: View {',
    '@available(iOS 17.0, *)\nstruct RepondrePoche: AppIntent {', '@available(iOS 17.0, *)\nstruct SuivantePoche: AppIntent {',
    '        if #available(iOS 17.0, *) {\n            RequetePoche()\n        }'])
    assert.ok(swift.includes(k), k);
  /* Les intentions : cachées de Raccourcis, elles n’écrivent que la question du moment et la réponse touchée */
  for (const n of ['RepondrePoche', 'SuivantePoche']) {
    const i = entre(swift, `struct ${n}: AppIntent {`, '\n}\n');
    assert.ok(i.includes('static let isDiscoverable: Bool = false') && i.includes('return .result()'), n);
  }
  const r = entre(swift, 'enum PocheRangement {', '\n}\n');
  assert.ok(r.includes('if deja < 0 {\n            d?.set(choix, forKey: "pocheChoix")'), 'une seule réponse par question');
  assert.ok(r.includes('let apres: Int = n > 0 ? (i + 1) % n : 0\n        d?.set(apres, forKey: "pocheIndex")\n        d?.set(-1, forKey: "pocheChoix")'), 'la suivante, puis la première');
  const ecrit = [...r.matchAll(/forKey: "(\w+)"\)/g)].map(m => m[1]);
  for (const k of ecrit) assert.ok(['poche', 'pocheIndex', 'pocheChoix'].includes(k), 'la flamme n’est pas touchée : ' + k);
  /* Les boutons : les réponses tant qu’on n’a pas répondu, puis la flèche ; une seule entrée, redessinée à chaque appui */
  for (const k of ['Button(intent: RepondrePoche(choix: i)) {', 'Button(intent: SuivantePoche()) {', 'policy: .never',
    'verdict("Bien vu\\u{202F}!", q.oui, vertTexte, u)', 'verdict("Presque\\u{202F}!", q.non, presqueTexte, u)', 'default: return "Touche la bonne réponse"'])
    assert.ok(swift.includes(k), k);
  /* L’étiquette : le module, pas la leçon (son nom donnerait souvent la réponse) */
  assert.ok(swift.includes('let texte: String = PocheRangement.etiquette(q)') && swift.includes('default: return "Révision · " + q.titre'));
  /* Le chat de la planche : il se pose la question, hoche la tête, encourage */
  for (const [etat, nom, h] of [['question', 'ChatQuestion', 130], ['juste', 'ChatOui', 126], ['presque', 'ChatEffort', 114]]) {
    assert.ok(swift.includes(`case .${etat}: return "${nom}"`) && swift.includes(`case .${etat}: return ${h}`), nom);
    assert.ok(fs.existsSync(path.join(ROOT, `resources/ios/widget/RequeteWidget/Assets.xcassets/${nom}.imageset/Contents.json`)), nom);
  }
  /* La forme que lit le widget est celle que range la page */
  const q = entre(swift, 'struct QuestionPoche: Codable, Hashable {', '\n}\n');
  for (const k of ['let titre: String', 'let code: [String]', 'let choix: [String]', 'let bon: Int', 'let oui: String', 'let non: String']) assert.ok(q.includes(k), k);
});

test('IOS.md : la requête de poche, pour la prochaine fois', () => {
  const s = entre(ios, '### La requête de poche (7 novembre)', '\n### ');
  for (const k of ['RequetePoche', 'iOS 17', 'App Intents', 'POCHE', 'flamme']) assert.ok(s.includes(k), k);
});
