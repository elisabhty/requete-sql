// Elisa, 10 novembre, 19 h 33 : « Oui tout » : les statistiques anonymes (flammes, actifs, leçons, défis, paywall…).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const conf = readFileSync(new URL('../decouvrir/confidentialite.html', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const code = cut('const STAT_FILE=', "if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){\n  window.addEventListener('load',()=>setTimeout(()=>{try{statOuverture();");

const monter = () => {
  const store = new Map(), envois = [];
  const ctx = vm.createContext({ localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    dstr: d => d.toISOString().slice(0, 10), auj: () => new Date('2026-11-10T12:00:00Z'), addJ: (d, n) => new Date(+d + n * 864e5), window: { APP_VERSION: 'requete-x-v2833' },
    setTimeout: () => 0, clearTimeout() {}, clsCle: () => 'a'.repeat(32), clsRpc: (fn, b) => { envois.push([fn, b]); return Promise.resolve({ ok: true }); },
    appliNative: () => true, streakJours: () => 0 });
  vm.runInContext(code, ctx);
  return { ctx, store, envois };
};

test('la file : un type de la liste, le jour, un nombre ; une fois par jour pour l’ouverture ; par lots de 40', async () => {
  const { ctx, envois } = monter();
  const J = x => JSON.parse(JSON.stringify(x));
  ctx.statOuverture(); ctx.statOuverture();
  assert.deepEqual(J(ctx.statLire().map(e => e.t)), ['installation', 'ouverture'], 'une installation, une ouverture par jour');
  assert.deepEqual(J(ctx.statLire()[1]), { t: 'ouverture', j: '2026-11-10', d: { p: 'ios', v: 'v2833' } });
  for (let i = 0; i < 50; i++) ctx.stat('moment', null, { l: 'x', i, ok: true });
  ctx.stat('Pas Bon'); assert.equal(ctx.statLire().length, 52, 'un type mal formé ne part pas');
  await ctx.statEnvoyer();
  assert.equal(envois[0][0], 'stat_noter'); assert.equal(envois[0][1].p_evts.length, 40); assert.equal(ctx.statLire().length, 12);
});

test('la série cassée : notée au retour quand la série d’au moins 2 jours est retombée à 0', () => {
  const { ctx, store } = monter();
  store.set('rq-stat-serie', '5'); ctx.statOuverture();
  assert.ok(ctx.statLire().some(e => e.t === 'serie_cassee' && e.v === 5));
});

test('coupées : plus rien ne part, la file est vidée et le serveur oublie ; « Supprimer mon compte » aussi', async () => {
  const { ctx, envois } = monter();
  ctx.stat('flamme', 2); ctx.statChoisir(false);
  assert.equal(ctx.statLire().length, 0); ctx.stat('flamme', 3); assert.equal(ctx.statLire().length, 0);
  assert.equal(envois.at(-1)[0], 'stat_oublier');
  assert.ok(app.includes("if(typeof statOublier==='function')await statOublier(cle);   // et ses statistiques anonymes (10 novembre)"));
  assert.ok(app.includes('onchange="statChoisir(this.checked)" aria-label="Envoyer des statistiques d’usage anonymes"'), 'l’interrupteur dans Tes données, tes choix');
});

test('les moments suivis dans l’app', () => {
  for (const s of ["stat('flamme',n)", "stat('semaine_feu',", "stat('lecon_validee',null,{l:", "stat('lecon_debut',null,{l:", "stat('video_quittee',null,{l:", "stat('moment',null,{l:",
    "stat('module_termine',i+1)", "stat('defi',ok?1:0,", "stat('partie',me?me.pts:0,", "if(host)stat('salle_creee');", "stat('salle_rejointe',undefined,{via:", "stat('invitation',undefined,{a:'partagee',via})", "stat('invitation',undefined,{a:'ouverte',nouveau:!state.onboarded})", "statUneFois('paywall_vu',", "stat('offre',null,{o:k})",
    "stat('paywall_passe',", "stat(essai?'essai':'achat',null,{o})", "stat('restaure')", "stat('connexion',null,", "stat(ok?'rappel_oui':'rappel_non')", "stat('widget')", "stat('erreur',null,{m:"])
    assert.ok(app.includes(s), s);
});

test('le serveur : la migration est dans le dépôt, la politique de confidentialité le dit', () => {
  const m = readdirSync(new URL('../supabase/migrations/', import.meta.url)).find(f => f.endsWith('_statistiques_anonymes.sql'));
  const sql = readFileSync(new URL('../supabase/migrations/' + m, import.meta.url), 'utf8');
  assert.ok(sql.includes("encode(extensions.digest(v_cle || ':stat', 'sha256'), 'hex')") && sql.includes('revoke all on function public.stat_tableau(integer) from public, anon, authenticated;'));
  assert.ok(sql.includes("interval '400 days'"), '13 mois au plus');
  assert.ok(conf.includes('<b>Statistiques d’usage anonymes.</b>') && conf.includes('effacées automatiquement au bout de 13&nbsp;mois'));
});
