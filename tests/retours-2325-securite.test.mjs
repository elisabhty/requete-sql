/* Elisa, 11 novembre, 23 h 25 : « Test maintenance niveau sécurité de l’application pour une mise en prod demain. »
   L’audit n’a trouvé aucune faille ouverte à un inconnu. Il durcit ce qu’une sauvegarde importée (un fichier reçu de quelqu’un d’autre)
   pouvait glisser dans les boutons de l’appli : les identifiants qui finissent dans un onclick (notes, séances et activités du planning,
   projets de la Console) sont des jetons simples ; le nom d’une note, dans son aria-label, est échappé comme un attribut. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const fn = name => { const i = app.indexOf(`function ${name}(`); assert.ok(i >= 0, name); const j = app.indexOf('\n}\n', i); return app.slice(i, j + 3); };

const ctx = vm.createContext({});
vm.runInContext(fn('normalizeState'), ctx);
const norm = s => JSON.parse(JSON.stringify(ctx.normalizeState(s)));
const MAL = "x');alert(1);('";

test('une note à l’identifiant piégé reçoit un identifiant neuf ; les autres restent telles quelles', () => {
  const ok = { id: 'n123abc', txt: 'bonne', sql: '', ts: 1 }, num = { id: 1730000000000, txt: 'ancienne', ts: 2 };
  const s = norm({ notes: [ok, { id: MAL, txt: 'piégée', ts: 3 }, null, 'texte', num] });
  assert.equal(s.notes.length, 3, 'les entrées qui ne sont pas des notes sont écartées');
  assert.deepEqual(s.notes[0], ok); assert.deepEqual(s.notes[2], num);
  assert.match(s.notes[1].id, /^[A-Za-z0-9_-]+$/); assert.equal(s.notes[1].txt, 'piégée', 'le texte est gardé');
  const propre = [ok, num];
  assert.equal(ctx.normalizeState({ notes: propre }).notes, propre, 'tout est propre : le même tableau, rien n’est recopié');
});

test('le planning : une séance à la date piégée est écartée, une activité piégée retirée ; propre, le même objet', () => {
  const plan = { freq: 3, sessions: [{ d: '2026-11-12', lessons: [1, 'af1'] }, { d: "2026-11-13');alert(1);('", lessons: [2] }, { d: '2026-11-14', lessons: [3, MAL] }] };
  const s = norm({ plan });
  assert.deepEqual(s.plan.sessions, [{ d: '2026-11-12', lessons: [1, 'af1'] }, { d: '2026-11-14', lessons: [3] }]);
  assert.equal(s.plan.freq, 3);
  const propre = { freq: 7, sessions: [{ d: '2026-11-12', lessons: [1] }] };
  assert.equal(ctx.normalizeState({ plan: propre }).plan, propre, 'le cas normal : le même objet');
});

test('les projets de la Console et le nom d’une note : rien ne sort de son attribut', () => {
  assert.ok(app.includes("if(!item||!item.id||typeof item.id!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(item.id)||isDemoDb(item.id))return;"));
  assert.ok(app.includes('aria-label="Ouvrir la note ${escAttr(label||\'sans titre\')}"'));
  assert.ok(!app.includes('aria-label="Ouvrir la note ${esc('));
});

test('pas de code évalué à la volée, les liens externes sans accès à l’appli', () => {
  const code = app.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/\beval\(|new Function\(|document\.write\(/.test(code));
  assert.ok(!/<a [^>]*target="_blank"(?![^>]*noopener)[^>]*>/.test(app), 'target="_blank" toujours avec noopener');
  assert.ok(fn('openLegalSite').includes('w.opener=null'));
  const ligne = app.slice(app.indexOf('function escAttr(s){'), app.indexOf('\n', app.indexOf('function escAttr(s){')));
  const esc = vm.runInNewContext(`(${ligne.replace('function escAttr(s)', 'function(s)')})`);
  assert.equal(esc(`"'<>&`), '&quot;&#39;&lt;&gt;&amp;');
});

test('23 h 38 : les dépendances sont figées (plus de « latest ») aux versions installées sur le Mac', () => {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const sec of ['dependencies', 'devDependencies'])
    for (const [k, v] of Object.entries(p[sec])) assert.match(v, /^\d+\.\d+\.\d+$/, `${k} : ${v}`);
  assert.equal(p.dependencies['@capacitor/core'], '8.6.0');
  assert.equal(p.dependencies['@revenuecat/purchases-capacitor'], '14.1.0');
});
