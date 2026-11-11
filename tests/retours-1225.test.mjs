/* 11 novembre, 12 h 25 (Elisa, deux captures de Mon compte) :
   réf. 1 « Widgets de l’écran verrouillé » : « sans déverrouiller l’écran » ;
   réf. 2 « Choisis ton pays » : « quand on appuie, ça sélectionne direct et ça part, je préfère attendre quelques secondes » ;
   « ne pas avoir de bouton Ta flamme en direct, étoile et statistiques anonymes si ce n’est pas obligatoire par Apple ».
   « Évaluer l’application » (l’étoile) : Apple ne la demande pas, elle part. « Ta flamme en direct » et « Statistiques anonymes »
   restent, au choix d’Elisa (12 h 40) : la première est l’accord qui permet à la Live Activity de démarrer seule (Apple refuse les
   Live Activities non demandées, règle 4.5.3) ; la seconde, l’opposition que la CNIL demande pour une mesure d’audience sans
   consentement. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i + a.length); assert.ok(j > i, b); return html.slice(i, j); };

test('réf. 1 : « Ta séance du jour, sans déverrouiller l’écran »', () => {
  assert.ok(html.includes("sous:'Ta séance du jour, sans déverrouiller l’écran',"));
  assert.ok(!/sans déverrouiller'/.test(html));
});

test('réf. 2 : le pays touché se coche, la feuille attend deux secondes avant de partir avec lui', () => {
  const f = cut('function paysFeuille(actuel,choisir){', 'function paysFiltrer(f,texte){');
  assert.ok(html.includes('const PAYS_ATTENTE=2000;'));
  assert.ok(f.includes("const partir=()=>{clearTimeout(attente);if(f.id==='pays-feuille')paysFeuilleFermer();if(pris){const c=pris;pris=null;choisir(c);}};"), 'part avec le pays coché');
  assert.ok(f.includes("x.classList.add('is-on','is-pris');x.setAttribute('aria-pressed','true');") && f.includes(`x.insertAdjacentHTML('beforeend','<i class="pays-ok" aria-hidden="true">✓</i>')`), 'coché tout de suite');
  assert.ok(f.includes('pris=b.dataset.pays;\n    clearTimeout(attente);attente=setTimeout(partir,prefersReduceMotion()?700:PAYS_ATTENTE);'), 'un autre pays touché reprend l’attente');
  assert.ok(f.includes("f.querySelector('.pays-fond').onclick=partir;") && f.includes("f.querySelector('.pays-x').onclick=partir;") && f.includes("if(e.key==='Escape'){e.preventDefault();partir();}"),
    'la croix, le fond et Échap gardent le pays coché');
  assert.ok(!f.includes('paysFeuilleFermer();\n    choisir(b.dataset.pays);'), 'plus de départ immédiat');
  assert.ok(css.includes('.pays-feuille .pays-ligne.is-pris .pays-ok{animation:paysOk .42s cubic-bezier(.3,1.6,.5,1) both}'), 'la coche rebondit');
});

test('Mon compte : plus d’« Évaluer l’application » ; la flamme en direct et les statistiques anonymes restent (choix d’Elisa)', () => {
  const compte = cut('function renderCompte(){', '\nfunction ');
  assert.ok(!compte.includes('noterAppli()') && compte.includes('const surIphone=widgetsVus;'));
  assert.ok(compte.includes('onclick="flammeDirectBasculer()"'), 'l’accord pour la Live Activity');
  assert.ok(compte.includes('<b>Statistiques anonymes</b>'), 'l’opposition aux statistiques');
});
