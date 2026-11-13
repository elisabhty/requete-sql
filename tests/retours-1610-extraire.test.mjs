/* Elisa, 13 novembre, 16 h 10 (capture de la Console, projet NutriBoost) : « mettre un bouton extraire, UI UX jolie, pour extraire
   les résultats ». « Extraire » au bout de la ligne du résultat ; une feuille : le fichier CSV (la feuille de partage d’iOS) ou
   « Copier le tableau ». Le CSV suit l’usage français (points-virgules, virgule décimale, UTF-8 avec BOM). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), lq = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

const ctx = () => {
  const c = vm.createContext({ Uint8Array, dstr: () => '2026-11-13', auj: () => 0 });
  vm.runInContext(cut('let consoleResultat=null;', 'function extraireCopier(texte){'), c);
  return c;
};

test('le fichier CSV : points-virgules, virgule décimale, NULL vide, guillemets quand il faut', () => {
  const c = ctx();
  c.R = { columns: ['id', 'nom', 'prix', 'note'], values: [[1, 'Barre "protéinée"; cacao', 12.5, null], [2, 'Shaker\nbleu', 3, 'ok']] };
  assert.equal(vm.runInContext('extraireCsv(R)', c),
    'id;nom;prix;note\r\n1;"Barre ""protéinée""; cacao";12,5;\r\n2;"Shaker\nbleu";3;ok\r\n');
  assert.equal(vm.runInContext('extraireTsv(R)', c), 'id\tnom\tprix\tnote\n1\tBarre "protéinée"; cacao\t12,5\t\n2\tShaker bleu\t3\tok', 'la copie : des tabulations, une ligne par ligne');
  assert.equal(vm.runInContext("extraireNom({nom:'NutriBoost'})", c), 'nutriboost-2026-11-13.csv');
  assert.equal(vm.runInContext("extraireNom({nom:'Mes ventes été 2026 !'})", c), 'mes-ventes-ete-2026-2026-11-13.csv', 'sans accents ni espaces');
  assert.equal(vm.runInContext("extraireNom({nom:''})", c), 'resultat-2026-11-13.csv');
  assert.equal(vm.runInContext('extraireValeur(1/3)', c), '0,333333', 'six décimales au plus');
});

test('le bouton : seulement sous le résultat de la Console, et la feuille', () => {
  const rt = cut('function renderTable(result,ms,opts){', '\n}\n');
  assert.ok(rt.includes('${opts&&opts.extraire?`<button type="button" class="rm-extraire" onclick="consoleExtraire()" aria-label="Extraire le résultat">${EXTRAIRE_SVG}<span>Extraire</span></button>`:\'\'}'));
  const run = cut('function runConsole(o){', '\nfunction ');
  assert.ok(run.includes('consoleResultat=res&&res[0]&&res[0].values.length?{columns:res[0].columns,values:res[0].values,nom:'));
  assert.ok(run.includes('${renderTable(res,ms,{extraire:!!consoleResultat})}'));
  const ex = cut('async function consoleExtraire(){', '\n}\n');
  assert.ok(ex.includes("oui:'Télécharger le fichier CSV',trois:'Copier le tableau',surTrois:()=>{copie=extraireCopier(extraireTsv(R));},non:'Annuler'"));
  assert.ok(ex.includes("const texte='\\uFEFF'+extraireCsv(R);"), 'le BOM : Excel ouvre les accents');
  assert.ok(ex.includes("C.nativePromise('RequeteWidget','partager',{nom,texte})") && ex.includes("saveFile(new Blob([texte],{type:'text/csv;charset=utf-8'}),nom,'Résultat Requête')"));
  /* La copie part dans le geste même du toucher (Safari refuse sinon) */
  assert.ok(app.includes("if(tr)tr.onclick=()=>{if(typeof o.surTrois==='function')try{o.surTrois();}catch(e){}fin('trois');};"));
  for (const r of ['html.lq #console-out .rm-extraire{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:34px;margin:0 0 0 auto;',
    'html.lq .lq-ask-corps .ex-fichier{', 'html.lq .lq-ask-corps .ex-cols span{'])
    assert.ok(lq.includes(r), r);
  assert.ok(lq.indexOf('html.lq #console-out .rm-extraire{') < lq.indexOf('Défis — la refonte du 7 novembre'));
});
