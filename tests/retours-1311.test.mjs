/* 4 novembre, 13 h 11 (Elisa, sur l’aperçu du widget, la flamme seule) : « Mettre 0/1, je pense, au niveau de la flamme, avec un validé
   coche ✅ quand c’est bon. » À côté de la flamme : la séance du jour, « 0/1 », puis « 1/1 » en doré, et la coche menthe qui se pose sur
   la flamme dorée. Un jour de repos du planning, pas d’objectif : la flamme seule (la bulle du matin dit « Jour de repos ! »). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const swift = fs.readFileSync(path.join(ROOT, 'resources/ios/widget/RequeteWidget/RequeteWidget.swift'), 'utf8');
const ios = fs.readFileSync(path.join(ROOT, 'IOS.md'), 'utf8');
const entre = (a, b) => { const i = swift.indexOf(a); assert.ok(i >= 0, a); const j = swift.indexOf(b, i + a.length); assert.ok(j > i, b); return swift.slice(i, j); };

test('« 0/1 » à côté de la flamme : la séance du jour, le « /1 » plus petit, le chiffre qui roule de 0 à 1', () => {
  const c = entre('private func compteurVue(_ w: CGFloat) -> some View {', '    /// La flamme du jour : éteinte');
  assert.ok(c.includes('let ecart: CGFloat = w * ecartCompteur\n        return HStack(alignment: .center, spacing: ecart) {\n            flammeVue(w)'));
  /* 16 h 28 : l’écart (plus grand le soir, un peu plus avec la coche) est calculé à part, avec son type (l’archive échouait sur ces chaînes) */
  assert.ok(swift.includes('private var ecartCompteur: CGFloat {\n        if humeur == .soir { return 0.07 }\n        return entree.faitAujourdhui ? 0.05 : 0.03\n    }'));
  assert.ok(c.includes('if !entree.repos {\n                objectifVue(w)\n                    .transition(.opacity)\n            }'), 'un jour de repos : la flamme seule');
  const o = entre('private func objectifVue(_ w: CGFloat) -> some View {', '    /// La coche « validé »');
  for (const k of ['let fait: Bool = entree.faitAujourdhui', 'let chiffre: String = fait ? "1" : "0"', 'let valeur: Int = fait ? 1 : 0',
    'return HStack(alignment: .firstTextBaseline, spacing: 0) {', 'Text(chiffre)', '.chiffreQuiRoule(valeur)',
    'Text("/1")', 'let petit: Font = Font.system(size: w * 0.13, weight: .bold, design: .rounded)', '.font(petit)', '.opacity(0.75)',
    'let teinte: Color = fait ? doreClair : Color.white.opacity(0.9)', '.foregroundColor(teinte)'])
    assert.ok(o.includes(k), k);
  assert.ok(swift.includes('compteurVue(w)\n                .scaleEffect(humeur == .matin ? 0.55 : 1, anchor: .topLeading)'), 'le matin, le compteur se range dans le coin');
});

test('validé : la coche menthe cerclée de blanc se pose d’un rebond sur la flamme dorée', () => {
  const f = entre('private func flammeVue(_ w: CGFloat) -> some View {', '    /// « 0/1 »');
  assert.ok(f.includes('ZStack(alignment: .bottomTrailing) {'));
  assert.ok(f.includes('if entree.faitAujourdhui {\n                coche(w)\n                    .offset(x: w * 0.025, y: w * 0.015)\n                    .transition(.scale(scale: 0.2).combined(with: .opacity))'));
  assert.ok(f.includes('.id(entree.faitAujourdhui)   // allumée ↔ éteinte'), 'la flamme se rallume toujours d’un rebond');
  const c = entre('private func coche(_ w: CGFloat) -> some View {', '    /// La bulle du matin');
  for (const k of ['Image(systemName: "checkmark")', '.font(.system(size: w * 0.07, weight: .heavy))', '.foregroundColor(encre)',
    '.frame(width: w * 0.14, height: w * 0.14)', '.background(Circle().fill(menthe))', '.overlay(Circle().stroke(Color.white, lineWidth: w * 0.012))'])
    assert.ok(c.includes(k), k);
  /* La menthe et l’encre de l’étiquette « ✓ Validée » du bilan (ludique.css : --mint #9FF0C6, #1B1640) */
  assert.ok(swift.includes('private let menthe = Color(red: 0.624, green: 0.941, blue: 0.776)') && swift.includes('private let encre = Color(red: 0.106, green: 0.086, blue: 0.251)'));
  assert.ok(Math.abs(0.624 - 0x9F / 255) < 0.002 && Math.abs(0.941 - 0xF0 / 255) < 0.002 && Math.abs(0.776 - 0xC6 / 255) < 0.002);
  assert.ok(Math.abs(0.106 - 0x1B / 255) < 0.002 && Math.abs(0.086 - 0x16 / 255) < 0.002 && Math.abs(0.251 - 0x40 / 255) < 0.002);
});

test('VoiceOver lit la séance du jour, et le guide iOS le dit', () => {
  const l = entre('private var libelle: String {', '\n    }\n');
  assert.ok(l.includes('if entree.faitAujourdhui { return "Séance du jour validée : 1 sur 1. Ta flamme est allumée." }'));
  assert.ok(l.includes('return entree.repos ? "Jour de repos." : "Séance du jour : 0 sur 1."'));
  assert.ok(ios.includes('13 h 11 (« mettre 0/1 au niveau de la flamme, avec un validé coche ✅ quand c’est bon »)'));
});
