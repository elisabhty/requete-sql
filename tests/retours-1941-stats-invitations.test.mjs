import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* 13 novembre, 19 h 41 (Elisa : « Et est-ce que je peux avoir ces informations dans Supabase ? Combien de liens partagés ? Combien de
   personnes avaient un code quand elles sont arrivées ? ») */
const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a > 0, n); return app.slice(a, app.indexOf('\n}\n', a) + 2); };

test('l’invitation partagée compte, par la feuille de partage, la copie, le code copié ou le bouton de l’île ; annulée, non', () => {
  assert.ok(app.includes("function jeuStatInvitation(via){if(typeof stat==='function')stat('invitation',undefined,{a:'partagee',via});}"));
  const share = fn('jeuShare');
  assert.ok(share.includes("gagne();jeuStatInvitation('partage');return;") && share.includes("gagne();jeuStatInvitation('copie');"));
  assert.ok(!/AbortError'\)return;[^}]*jeuStatInvitation/.test(share), 'partage annulé : rien');
  assert.ok(fn('jeuCopyCode').includes("jeuCopyText(J.code).then(()=>{\n    jeuStatInvitation('code');"));
  assert.ok(fn('ileSalleAction').includes("if(typeof jeuStatInvitation==='function')jeuStatInvitation('ile');"));
});

test('arriver avec une invitation : le lien qui ouvre l’app, puis la salle rejointe par le lien ou par le code', () => {
  assert.ok(fn('raccourciOuvrir').includes("stat('invitation',undefined,{a:'ouverte',nouveau:!state.onboarded});"));
  assert.ok(fn('jeuFromUrl').includes('jeuViaLien=inv.code;'));
  const s = fn('jeuStart');
  assert.ok(s.includes("else stat('salle_rejointe',undefined,{via:jeuViaLien&&jeuViaLien===code?'lien':'code',nouveau:!(state.salle&&state.salle.parties>0)});"));
  assert.ok(s.includes("if(!host)jeuViaLien='';"), 'une seule fois');
  assert.ok(app.includes("var jeuViaLien='';"));
  assert.ok(!/stat\('invitation'[^)]*(code:|J\.code|pseudo|nom)/.test(app), 'ni code de salle, ni pseudo');
});

test('le serveur : « invitation » dans la liste fermée, la partie « invitations » du tableau ; la politique de confidentialité le dit', () => {
  const m = '20261113184618_stat_invitations.sql';
  assert.ok(fs.existsSync(path.join(ROOT, 'supabase/migrations', m)));
  const sql = lire('supabase/migrations/' + m);
  assert.ok(sql.includes("'rappel_oui','rappel_non','widget','erreur',\n    'invitation'];"));
  for (const k of ["'partagees'", "'partagees_par'", "'liens_ouverts'", "'liens_ouverts_avant_inscription'", "'salles_rejointes_par_lien'", "'salles_rejointes_par_code'", "'arrives_avec_une_invitation'"]) assert.ok(sql.includes(k), k);
  assert.ok(sql.includes('revoke all on function public.stat_tableau(integer) from public, anon, authenticated;') && sql.includes('grant execute on function public.stat_noter(text, jsonb) to anon, authenticated;'));
  assert.ok(lire('decouvrir/confidentialite.html').includes('les salles créées ou rejointes (par un lien d’invitation ou par le code), les invitations partagées et les liens d’invitation ouverts (sans le code de la salle)'));
});
