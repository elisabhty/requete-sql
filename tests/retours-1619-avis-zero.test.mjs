/* 13 novembre, 16 h 19 (Elisa, sur le bilan, 5 étoiles et un commentaire) : « Est-ce que je vais recevoir ? Par mail ».
   Aucun avis n’était jamais arrivé dans avis_lecon : la 1re leçon porte le numéro 0, que la base refusait (« invalide »), et l’avis
   sur la leçon 0, toujours en tête de file (clés numériques dans l’ordre), bloquait tous les suivants.
   1. La base accepte la leçon 0 (20261113152709_avis_lecon_zero.sql).
   2. Un avis que la base refuse pour de bon passe « refusé » et ne bloque plus la file ; hors ligne ou « trop », il attend. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html');
const cut = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };

const lab = rpc => {
  const envois = [];
  const ctx = vm.createContext({
    state: {avis: {}}, setTimeout, Promise, esc: s => String(s), buzz() {}, prefersReduceMotion: () => true, clsCle: () => 'K'.repeat(32),
    allLessons: [{id: 0, titre: 'Les bases de données relationnelles'}, {id: 12, titre: 'Les jointures'}],
    document: {createElement: () => ({className: '', style: {}, setAttribute() {}, remove() {}})},
    clsRpc: (fn, body) => { envois.push(JSON.parse(JSON.stringify(body))); return rpc(body); }
  });
  ctx.save = () => {};
  vm.runInContext(cut(html, '/* ---------- L’avis sur la leçon ----------', '/* ---------- Blocs de cours enrichis (réutilisables) ---------- */'), ctx);
  return {ctx, envois};
};
const attendre = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setTimeout(r, 0)); };

test('l’ancienne base refuse la leçon 0 : l’avis passe « refusé » et le commentaire de la leçon suivante part quand même', async () => {
  const {ctx, envois} = lab(b => Promise.resolve(b.p_lecon === 0 ? {ok: false, raison: 'invalide'} : {ok: true}));
  ctx.state.avis = {0: {n: 5, le: 1, envoye: false}, 12: {n: 5, le: 2, envoye: false, c: 'Tgyty'}};
  assert.equal(await ctx.avisEnvoyer(), true);
  await attendre();
  assert.equal(ctx.state.avis[0].envoye, 'refus', 'il ne repart plus');
  assert.equal(ctx.state.avis[12].envoye, true, 'il ne bloque plus la file');
  assert.deepEqual(envois.map(e => [e.p_lecon, e.p_commentaire]), [[0, null], [12, 'Tgyty']]);
});

test('la nouvelle base accepte la leçon 0 ; hors ligne ou « trop », l’avis attend en tête de file', async () => {
  const ok = lab(() => Promise.resolve({ok: true}));
  ok.ctx.state.avis = {0: {n: 4, le: 1, envoye: false}};
  await ok.ctx.avisEnvoyer(); await attendre();
  assert.equal(ok.ctx.state.avis[0].envoye, true);
  assert.equal(ok.envois[0].p_titre, 'Les bases de données relationnelles');
  for (const rpc of [() => Promise.reject(new Error('hors ligne')), () => Promise.resolve({ok: false, raison: 'trop'})]) {
    const {ctx, envois} = lab(rpc);
    ctx.state.avis = {0: {n: 4, le: 1, envoye: false}, 12: {n: 3, le: 2, envoye: false}};
    assert.equal(await ctx.avisEnvoyer(), false); await attendre();
    assert.equal(ctx.state.avis[0].envoye, false); assert.equal(ctx.state.avis[12].envoye, false);
    assert.equal(envois.length, 1, 'on réessaiera plus tard');
  }
});

test('la migration : la leçon 0 acceptée par la table et par lecon_noter, le reste inchangé', () => {
  const sql = read('supabase/migrations/20261113152709_avis_lecon_zero.sql');
  for (const k of ['alter table public.avis_lecon drop constraint if exists avis_lecon_lecon_check;',
    'alter table public.avis_lecon add constraint avis_lecon_lecon_check check (lecon between 0 and 99999);',
    'if p_lecon is null or p_lecon not between 0 and 99999 or p_note is null or p_note not between 1 and 5 then',
    "security definer\nset search_path = ''", 'v_cle text := public.jeu_cle(p_cle);',
    'grant execute on function public.lecon_noter(text, integer, integer, text, text) to anon, authenticated;'])
    assert.ok(sql.includes(k), k);
  assert.ok(!sql.includes('between 1 and 99999'));
  assert.ok(html.includes('{id:0,') || html.includes('id:0, titre:"Les bases de données relationnelles"'), 'la 1re leçon porte bien le numéro 0');
});
