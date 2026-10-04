/* Contrôle d'un cours « guide » en cours d'écriture, avant de le placer dans index.html.
   Usage : node tests/helpers/check-spec.mjs cours-1.js [cours-2.js …]
   Chaque fichier contient une expression complète : guide({ id:…, titre:…, … }) (sans virgule finale).
   Les vérifications sont celles du test des cours guide (requêtes exécutables, scènes, mission, parcours, tableaux testés),
   plus l'exercice, le quiz et quelques règles de rédaction. Un échec arrête le contrôle et dit quoi corriger. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {guideEnv, checkGuideLesson, openDb} from './guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const files = process.argv.slice(2);
if (!files.length) { console.error('Usage : node tests/helpers/check-spec.mjs cours.js [autre.js …]'); process.exit(2); }
const env = await guideEnv(root, 'const MODULES = [');
let failed = 0;

for (const f of files) {
  try {
    const text = fs.readFileSync(f, 'utf8');
    const l = vm.runInContext(text, env.ctx);
    assert.ok(l && l.guided, 'le fichier doit contenir guide({ … })');
    const r = checkGuideLesson(env, l);

    /* Exercice : la solution s'exécute et renvoie des lignes (ou modifie la base, pour les cours d'écriture) ; quiz à 3 réponses. */
    for (const k of ['consigne', 'solution', 'indice', 'retenir', 'exemple', 'attendu']) assert.ok(l[k], `champ « ${k} » manquant`);
    const db = openDb(env);
    const res = db.exec(l.solution);
    if (!l.write && !l.noExec) assert.ok(res.length && res[0].values.length >= 1, 'la solution de l\'exercice doit renvoyer au moins une ligne');
    db.close();
    const q = l.learningCheck;
    assert.ok(q && q.question && q.options.length === 3 && q.answer >= 0 && q.answer < 3 && q.explanation, 'learningCheck : question, 3 options, answer (0-2), explanation');
    for (const v of l.testeVariants || []) {
      const d = openDb(env);
      try { d.exec(v.sql); } catch (e) { assert.equal(v.tone, 'bad', `variante « ${v.label} » : ${e.message}`); }
      d.close();
    }

    /* Rédaction : erreurs bloquantes, puis avertissements à relire. */
    const flat = JSON.stringify(l);
    assert.ok(!/Nathan\s*n°|\(N°\s*\d+\)/.test(flat), 'écrire « Nathan », jamais « Nathan n°10 »');
    const prose = [l.situation, l.studio.problem.extra, l.studio.uses.body, l.studio.reflex.extra, JSON.stringify(env.scenes[l.id] || {}), JSON.stringify(env.xscenes[l.id] || [])]
      .join('\n').replace(/<code>[\s\S]*?<\/code>|<pre[\s\S]*?<\/pre>|data-run-sql="[^"]*"/g, ' ');
    const warn = [];
    if (/e-mail/i.test(prose)) warn.push('« e-mail » : le cours écrit « email »');
    if (/[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ]/.test(prose.replace(/<[^>]+>/g, ' '))) warn.push('apostrophe droite dans le texte : utiliser ’');
    if (/\.\.\./.test(prose)) warn.push('« ... » : utiliser …');
    if (/ {2,}/.test(prose.replace(/<[^>]+>/g, ' ').replace(/\n\s*/g, ' ').replace(/\s{2,}/g, ' ')) === false) { /* rien */ }
    console.log(`✔ ${path.basename(f)} : cours ${l.id} « ${l.titre} » — ${r.runs} requêtes exécutées, ${(env.xscenes[l.id] || []).length + 1} animation(s), ${r.testedTables} tableau(x) testé(s)`);
    for (const w of warn) console.log(`  ⚠ ${w}`);
  } catch (e) {
    failed++;
    console.error(`✖ ${path.basename(f)} : ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
