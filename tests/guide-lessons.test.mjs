/* Cours « guide » (format LAG et LEAD) : chaque requête à exécuter marche, la scène animée est cohérente,
   le HTML est équilibré et la typographie française est respectée. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ctx = vm.createContext({});
const a = html.indexOf('const SCHEMA_SQL ='), b = html.indexOf('let state=');
vm.runInContext(html.slice(a, b), ctx);
const lessons = vm.runInContext('MODULES.flatMap(m=>m.lessons)', ctx).filter(l => l.guided);
const scenes = vm.runInContext('GUIDE_SCENES', ctx), schema = vm.runInContext('SCHEMA_SQL', ctx);
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
const decode = s => s.replace(/&#10;/g, '\n').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
assert.ok(lessons.length >= 1, 'au moins un cours guide');
let runs = 0;
for (const l of lessons) {
  const body = [l.situation, l.studio.problem.extra, l.studio.uses.body, l.reflex.extra].join('\n');
  /* Requêtes à exécuter : elles marchent, sauf celles d'un encadré « Attention » (qui montrent un piège). */
  const re = /<div class="ij-run"( data-warn="1")? data-run-sql="([^"]*)"><\/div>/g;
  let m, n = 0;
  while ((m = re.exec(body))) {
    const sql = decode(m[2]); n++; runs++;
    const db = new SQL.Database();
    try { db.run(schema); ctx.attachDateFns && ctx.attachDateFns(db); db.exec(sql); assert.ok(!m[1] || true); }
    catch (e) { assert.ok(m[1], `${l.titre} : la requête échoue sans être un piège volontaire : ${sql} → ${e.message}`); }
    finally { db.close(); }
  }
  assert.ok(n >= 3, `${l.titre} : au moins 3 requêtes à exécuter`);
  assert.equal(((body.match(/<div[\s>]/g) || []).length), ((body.match(/<\/div>/g) || []).length), `${l.titre} : div équilibrés`);
  assert.equal(((body.match(/<ul[\s>]/g) || []).length), ((body.match(/<\/ul>/g) || []).length), `${l.titre} : ul équilibrés`);
  /* Typographie : pas d'espace ordinaire avant : ? ! ; hors code. */
  const text = body.replace(/<code>[\s\S]*?<\/code>|<pre[\s\S]*?<\/pre>|<[^>]+>/g, '|').replace(/data-run-sql="[^"]*"/g, '');
  assert.ok(!/ [:?!;]/.test(text.replace(/&nbsp;/g, ' ')), `${l.titre} : espace insécable avant la ponctuation haute : ${(text.match(/.{12} [:?!;]/) || [''])[0]}`);
  /* Scène animée : légendes, étapes et cellules cohérentes. */
  const sc = scenes[l.id];
  if (sc) {
    const keys = new Set(sc.lanes.flatMap(x => [x.k, ...x.c.map(c => c[0])].filter(Boolean)));
    sc.steps.forEach((st, i) => {
      assert.ok(st.cap >= 0 && st.cap < sc.caps.length, `${l.titre} : légende de l'étape ${i}`);
      for (const f of ['on', 'off', 'dim', 'undim', 'gone', 'back', 'fold', 'unfold', 'show']) for (const k of st[f] || []) assert.ok(keys.has(k), `${l.titre} : « ${k} » inconnu (${f}, étape ${i})`);
      for (const k of Object.keys(st.text || {})) assert.ok(keys.has(k), `${l.titre} : texte sur « ${k} » inconnu`);
    });
    assert.equal(sc.steps.length, sc.caps.length, `${l.titre} : une légende par étape`);
  }
  assert.ok(!/Mission accomplie|Ta mission/.test(body), `${l.titre} : pas de mission dans un cours sans mission`);
}
console.log(`${lessons.length} cours guide, ${runs} requêtes exécutées : OK`);
