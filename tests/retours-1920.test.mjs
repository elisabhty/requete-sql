// Elisa, 11 novembre, 19 h 20 : « remplacer “– Sans essai” par un avantage plus valorisant pour l’abonnement hebdomadaire » :
// « Résiliable à tout moment » au lieu de « Sans essai », « Accès immédiat » au lieu d’« Accès complet ».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');

test('l’hebdomadaire : trois avantages cochés, sur deux lignes comme les repères de l’annuelle', () => {
  assert.ok(app.includes("const inclus=[['coche','Accès<br>immédiat'],['coche','Tous les<br>niveaux'],['coche','Résiliable à<br>tout moment']];"));
  assert.ok(!app.includes("['moins','Sans essai']") && !app.includes("'Accès complet'"), 'plus de tiret « Sans essai », plus d’« Accès complet »');
  assert.ok(app.includes("${inclus.map(([,t])=>t.replace('<br>',' ').toLowerCase()).join(', ')}"), 'VoiceOver lit les mêmes avantages, sans la coupure');
  assert.ok(css.includes('html #onboarding.ob-vitrine .pw-o-inclus{display:grid;grid-template-columns:repeat(3,auto);justify-content:space-between;column-gap:8px}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .pw-o-inclus>span{white-space:nowrap;align-items:center;line-height:1.25;text-align:left}'), 'la coupure est celle du texte, pas celle de la largeur');
});

test('19 h 30 : « Tous les niveaux » au lieu de « Sans engagement »', () => {
  assert.ok(app.includes("['coche','Tous les<br>niveaux']") && !app.includes("'Sans<br>engagement'"));
});
