#!/usr/bin/env node
/* Photo (snapshot) de la base du cours, et retour à une photo.

   La base « Cours » de l’appli est décrite par la constante SCHEMA_SQL de index.html
   (CREATE TABLE + INSERT). Les photos sont des copies de ce texte, rangées dans
   db-snapshots/, avec une fiche .json (empreinte, tables, colonnes, nombre de lignes)
   et un fichier .sqlite que l’on peut ouvrir dans DB Browser, TablePlus, etc.

   Usage :
     node scripts/db-snapshot.mjs snapshot [libellé]   prend une photo de la base actuelle
     node scripts/db-snapshot.mjs list                 liste les photos
     node scripts/db-snapshot.mjs diff [photo]         compare la base actuelle à une photo (la dernière par défaut)
     node scripts/db-snapshot.mjs verify [photo]       code 0 si la base actuelle est identique à la photo
     node scripts/db-snapshot.mjs restore <photo>      remet la base de la photo dans index.html
                                                       (la base actuelle est d’abord photographiée sous « avant-restauration »)

   <photo> = nom de fichier (avec ou sans .sql), ou début du nom. */
import {readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const indexPath = path.join(root, 'index.html');
const dir = path.join(root, 'db-snapshots');
const SEED_RE = /(const SCHEMA_SQL = `)([\s\S]*?)(`;)/;

export function extractSeed(html) {
  const m = SEED_RE.exec(html);
  if (!m) throw new Error('SCHEMA_SQL introuvable dans index.html');
  return m[2];
}
export function replaceSeed(html, seed) {
  if (seed.includes('`') || seed.includes('${')) throw new Error('La photo contient « ` » ou « ${ » : impossible de l’insérer dans une chaîne JavaScript.');
  return html.replace(SEED_RE, (_, a, __, c) => a + seed + c);
}
export const sha = text => createHash('sha256').update(text).digest('hex');

async function engine() {
  const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
  return SQL;
}
/* Exécute la base et décrit son contenu (tables, colonnes, lignes). */
export async function describeSeed(seed) {
  const SQL = await engine();
  const db = new SQL.Database();
  try {
    db.run(seed);
    const tables = {};
    const names = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values.map(v => v[0]) || [];
    for (const name of names) {
      const cols = db.exec(`PRAGMA table_info("${name}")`)[0].values.map(r => r[1]);
      const rows = db.exec(`SELECT COUNT(*) FROM "${name}"`)[0].values[0][0];
      tables[name] = {columns: cols, rows};
    }
    const binary = db.export();
    return {tables, binary, engine: db.exec('SELECT sqlite_version()')[0].values[0][0]};
  } finally { db.close(); }
}

const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const listSnaps = () => (existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.sql')).sort() : []);
function findSnap(ref) {
  const all = listSnaps();
  if (!ref) { if (!all.length) throw new Error('Aucune photo : lance d’abord « snapshot ».'); return all[all.length - 1]; }
  const name = ref.endsWith('.sql') ? ref : ref + '.sql';
  if (all.includes(name)) return name;
  const hits = all.filter(f => f.startsWith(ref) || f.includes(ref));
  if (hits.length === 1) return hits[0];
  throw new Error(hits.length ? 'Plusieurs photos correspondent : ' + hits.join(', ') : 'Photo introuvable : ' + ref);
}

export async function takeSnapshot(label = 'base') {
  const seed = extractSeed(readFileSync(indexPath, 'utf8'));
  let info = null, error = null;
  try { info = await describeSeed(seed); } catch (e) { error = e.message; }
  mkdirSync(dir, {recursive: true});
  const base = `${stamp()}_${slug(label) || 'base'}`;
  writeFileSync(path.join(dir, base + '.sql'), seed);
  if (info) writeFileSync(path.join(dir, base + '.sqlite'), info.binary);
  writeFileSync(path.join(dir, base + '.json'), JSON.stringify(info ? {
    label, createdAt: new Date().toISOString(), sha256: sha(seed), engine: 'SQLite ' + info.engine, tables: info.tables,
  } : {
    label, createdAt: new Date().toISOString(), sha256: sha(seed), invalid: true, error,
  }, null, 2) + '\n');
  return {base, info, error, sha: sha(seed)};
}

function summary(tables) {
  return Object.entries(tables).map(([t, v]) => `  ${t} (${v.columns.join(', ')}) : ${v.rows} ligne${v.rows > 1 ? 's' : ''}`).join('\n');
}
function diffTables(a, b) {
  const out = [];
  for (const t of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!a[t]) { out.push(`+ table ${t} (nouvelle)`); continue; }
    if (!b[t]) { out.push(`- table ${t} (supprimée)`); continue; }
    const added = b[t].columns.filter(c => !a[t].columns.includes(c)), gone = a[t].columns.filter(c => !b[t].columns.includes(c));
    if (added.length) out.push(`+ ${t} : colonnes ajoutées ${added.join(', ')}`);
    if (gone.length) out.push(`- ${t} : colonnes retirées ${gone.join(', ')}`);
    if (a[t].rows !== b[t].rows) out.push(`~ ${t} : ${a[t].rows} → ${b[t].rows} lignes`);
  }
  return out;
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'snapshot') {
    const r = await takeSnapshot(arg || 'base');
    console.log(`Photo prise : db-snapshots/${r.base}.sql\nEmpreinte : ${r.sha.slice(0, 16)}…\n${r.info ? summary(r.info.tables) : '⚠ cette base ne s’exécute pas : ' + r.error + ' (copie gardée telle quelle)'}`);
  } else if (cmd === 'list') {
    const all = listSnaps();
    if (!all.length) return console.log('Aucune photo.');
    for (const f of all) {
      const meta = JSON.parse(readFileSync(path.join(dir, f.replace(/\.sql$/, '.json')), 'utf8'));
      console.log(`${f.replace(/\.sql$/, '')}  ·  ${meta.invalid ? '⚠ ne s’exécute pas' : Object.entries(meta.tables).map(([t, v]) => `${t}:${v.rows}`).join(' ')}`);
    }
  } else if (cmd === 'diff' || cmd === 'verify') {
    const f = findSnap(arg);
    const snap = readFileSync(path.join(dir, f), 'utf8');
    const cur = extractSeed(readFileSync(indexPath, 'utf8'));
    if (sha(snap) === sha(cur)) { console.log(`Identique à ${f}.`); return; }
    let b;
    try { b = await describeSeed(cur); } catch (e) { console.log(`Différent de ${f}, et la base actuelle ne s’exécute pas : ${e.message}\n(après un ajout de colonne, pense à compléter les INSERT)`); if (cmd === 'verify') process.exitCode = 1; return; }
    const a = await describeSeed(snap);
    console.log(`Différent de ${f} :\n${diffTables(a.tables, b.tables).join('\n') || '  (même structure et mêmes effectifs : le texte SQL a changé)'}`);
    if (cmd === 'verify') process.exitCode = 1;
  } else if (cmd === 'restore') {
    if (!arg) throw new Error('Indique la photo à restaurer (voir « list »).');
    const f = findSnap(arg);
    const snap = readFileSync(path.join(dir, f), 'utf8');
    await describeSeed(snap); // la photo doit s’exécuter sans erreur
    const html = readFileSync(indexPath, 'utf8');
    if (sha(extractSeed(html)) === sha(snap)) return console.log(`La base actuelle est déjà identique à ${f}.`);
    const safe = await takeSnapshot('avant-restauration');
    writeFileSync(indexPath, replaceSeed(html, snap));
    console.log(`Base restaurée depuis ${f}.\nL’ancienne base est conservée : db-snapshots/${safe.base}.sql\n\nÀ faire ensuite : mettre à jour SCHEMA_META (colonnes / effectifs) si besoin, passer le cache (sw.js) à la version suivante, lancer « npm test ».`);
  } else {
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^[\s\S]*?\/\*/, '').trim());
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch(e => { console.error('Erreur : ' + e.message); process.exit(1); });
}
