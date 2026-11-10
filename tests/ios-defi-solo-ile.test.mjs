/* Elisa, 10 novembre, 7 h 47 (« ok pour solo et multijoueur avec le 1/2 etc. pour les manches ») : un défi en solo a son chrono
   dans l’île, les yeux du chat à gauche ; à droite, la manche (« 1/3 ») à côté du chrono, seul comme à plusieurs. Une partie seule
   reste sur le téléphone : ni jeton de push, ni serveur. Pas de compilateur Swift ici : les tests lisent le code. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');
const swift = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift');
const pont = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const sansCommentaires = t => t.replace(/\/\/.*$/gm, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');

test('la page : une partie seule a son île, avec une seule place, sans jeton ni serveur', () => {
  const etat = entre(app, 'function ileSalleEtat(){', '\n}\n');
  assert.ok(etat.includes('const J=JEU;if(!J||!J.synced||J.full)return null;'), 'plus de « ni pour une partie seule »');
  const m = entre(app, 'function ileSalleMaintenant(){', '\n}\n');
  assert.ok(m.includes("ileAppel('salleDebut',{code:J.code,moi:J.me,max:J.solo?1:(J.max|0)||JEU_MAX,etat,push:!J.solo});"));
  assert.ok(m.indexOf('if(J.solo)return;') > m.indexOf("ileAppel('salleMaj'") && m.indexOf('if(J.solo)return;') < m.indexOf('ileSallePoster('), 'seul : rien au serveur');
});

test('le pont : une partie seule démarre sans jeton de push', () => {
  const f = entre(pont, '@objc func salleDebut(_ call: CAPPluginCall) {', '\n    }\n');
  assert.ok(f.includes('let push: Bool = call.getBool("push") ?? true') && f.includes('max: places, etat: etat, push: push)'));
  const d = entre(pont, 'static func debut(code: String, moi: String, max: Int, etat: RequeteSalle.ContentState, push: Bool,', '\n    }\n');
  assert.ok(d.includes('guard push else { throw RequeteSansPush.seul }\n            activite = try Activity<RequeteSalle>.request(attributes: salle, content: contenu, pushType: .token)'));
  assert.ok(d.includes('pushType: nil)') && d.includes('guard push else { return true }\n        Task {\n            for await jeton in activite.pushTokenUpdates {'));
  assert.ok(pont.includes('enum RequeteSansPush: Error {\n    case seul\n}'));
});

test('l’île : « 1/3 » et le chrono à droite ; seul, la manche et les points à gauche, « Défi en solo », « Ton score »', () => {
  const L = entre(swift, 'enum LectureSalle {', '\n}\n');
  for (const k of ['static func solo(_ a: RequeteSalle) -> Bool {\n        return a.max <= 1',
    'let m: Int = min(nb, max(1, e.manche))\n        return "\\(m)/\\(nb)"',
    'if p > 1 { return "\\(p)\\u{00A0}pts" }\n        return "\\(p)\\u{00A0}pt"',
    'if e.phase == "attente" { return compte(e, a) }\n        if e.phase != "fin" { return manches(e) }\n        if solo(a) { return points(e, a) }\n        return rang(place(e, a))',
    'if solo(a) { return "Ton score\\u{202F}: " + points(e, a) }\n        if e.phase == "fin" { return podium(e, a).joined(separator: "   ") }\n        return scores(e, a)'])
    assert.ok(L.includes(k), k);
  const droite = entre(swift, 'struct SalleDroite: View {', '\n}\n');
  assert.ok(droite.includes('if LectureSalle.enCours(etat) {\n                HStack(alignment: .firstTextBaseline, spacing: 4) {\n                    Text(LectureSalle.manches(etat))'), 'la manche, puis le chrono');
  assert.ok(droite.includes('Text(LectureSalle.court(etat, salle))'));
  assert.ok(entre(swift, 'struct SalleMinimale: View {', '\n}\n').includes('let texte: String = LectureSalle.court(etat, salle)'));
  const gauche = entre(swift, 'struct SalleGauche: View {', '\n}\n');
  assert.ok(gauche.includes('} else if LectureSalle.solo(salle) {\n                Text(soloHaut)') && gauche.includes('let soloBas: String = fin ? "points" : "manche"'));
  assert.ok(swift.includes('if LectureSalle.solo(a) { return "Défi en solo" }'));
  for (const v of ['struct SalleBas: View {', 'struct SalleDetail: View {']) assert.ok(entre(swift, v, '\n}\n').includes('LectureSalle.tableau(etat, salle)'), v);
  assert.equal(swift.split('Text(timerInterval: LectureSalle.chrono(etat), countsDown: true)').length - 1, 3, 'à droite de l’île, ouverte, et sur l’écran verrouillé');
  const code = sansCommentaires(entre(swift, '// MARK: - La salle dans l’île', '@main'));
  assert.ok(!/Text\([^)\n]*\?[^)\n]*:/.test(code));
  for (const l of code.split('\n')) assert.ok(l.split(' ? ').length <= 2, l.trim());
});
