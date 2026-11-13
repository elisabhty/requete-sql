import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/* 13 novembre, 19 h 52 (Elisa : « Est-ce qu’il y a d’autres statistiques à récupérer comme ça ? » ; « Oui, tout ça. Tout ce que tu
   peux trouver, mets-le. ») */
const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a > 0, n); return app.slice(a, app.indexOf('\n}\n', a) + 2); };

test('chaque moment envoie son type, sans contenu', () => {
  const lieux = [
    ['raccourcisBrancher', "LN.addListener('localNotificationActionPerformed',e=>{const id=+(e&&e.notification&&e.notification.id)||0;if(typeof stat==='function')stat('rappel_ouvert',undefined,{k:id>=100?'seance':'n'+id});});"],
    ['raccourciOuvrir', "stat('raccourci',undefined,{k:type.replace(/^fr\\.requete\\.app\\./,'').split(/[|.]/)[0].slice(0,24)});"],
    ['repondreQcm', "stat('qcm',choix===q.b?1:0,{l:id,q:i});"],
    ['setEntretienMark', "stat('entretien',mark==='ok'?1:0,{q:String(id).slice(0,20)});"],
    ['coachSet', "if(n>COACH.n&&COACH.kind!=='room'&&typeof stat==='function')stat('indice',n,{c:String(COACH.c&&COACH.c.id).slice(0,20)});"],
    ['jeuStop', "if(ou&&typeof stat==='function')stat('salle_quittee',undefined,{ou,solo:!!J.solo,hote:J.hostPid===J.me,joueurs:typeof jeuLive==='function'?jeuLive().length:0});"],
    ['runConsole', "statUneFois('console','console:'+statJour());"],
    ['createImportedTables', "stat('import',tables.length);"],
    ['stkAfterProgress', "won.forEach(id=>stat('sticker',undefined,{s:String(id).slice(0,24)}));"],
    ['shareCard', "stat('partage',undefined,{quoi:'carte'});"],
    ['lqFeuPartager', "stat('partage',undefined,{quoi:'flamme'});"]
  ];
  for (const [f, s] of lieux) assert.ok(fn(f).includes(s), f);
  assert.ok(app.includes("if(typeof stat==='function')stat('revision',exoFails?0:1,{l:current.id});"));
  assert.ok(app.includes("{const depuis=state.onboarded?'retour':'onboarding';statUneFois('paywall_vu','paywall:'+depuis+':'+statJour(),undefined,{depuis});}"));
  assert.ok(app.includes("if(document.hidden){const s=Math.round((Date.now()-statVisibleDepuis)/1000);if(s>=5&&s<=14400)stat('duree',s);}"));
  for (const t of ['rappel_ouvert', 'revision', 'qcm', 'entretien', 'indice', 'salle_quittee', 'raccourci', 'duree', 'console', 'import', 'sticker', 'partage'])
    assert.match(t, /^[a-z_]{3,24}$/, t);
});

test('le raccourci d’une invitation ne laisse passer ni le code ni le pseudo', () => {
  const envoyes = [];
  const ctx = vm.createContext({ stat: (t, v, d) => envoyes.push([t, d]), JEU_INV: 'a', JEU_INV_DE: 'b', sessionStorage: { setItem() {}, removeItem() {} }, jeuFromUrl() {}, state: { onboarded: true } });
  vm.runInContext(fn('raccourciOuvrir'), ctx);
  ctx.raccourciOuvrir('fr.requete.app.partie.SNUWBB|jjjj');
  assert.deepEqual(JSON.parse(JSON.stringify(envoyes[0])), ['raccourci', { k: 'partie' }]);
  assert.ok(!JSON.stringify(envoyes).includes('SNUWBB') && !JSON.stringify(envoyes).includes('jjjj'));
  ctx.raccourciOuvrir('fr.requete.app.salle-partager');
  assert.equal(envoyes.at(-1)[1].k, 'salle-partager');
});

test('le serveur : douze types de plus, et les parties du tableau', () => {
  const sql = lire('supabase/migrations/20261113185916_stat_usage.sql');
  assert.ok(sql.includes("'invitation','rappel_ouvert','revision','qcm','entretien','indice','salle_quittee','raccourci','duree','console','import',\n    'sticker','partage'];"));
  for (const k of ["'les_plus_durs'", "'salles', jsonb_build_object(", "'fermees_sans_personne'", "'revisions', jsonb_build_object(", "'qcm_les_plus_rates'", "'entretien_a_revoir'",
    "'usage', jsonb_build_object(", "'duree_mediane_min'", "'paywall_depuis'", "'rappels_ouverts'", "'invitations', jsonb_build_object("]) assert.ok(sql.includes(k), k);
  assert.ok(sql.includes('revoke all on function public.stat_tableau(integer) from public, anon, authenticated;'));
  const conf = lire('decouvrir/confidentialite.html');
  assert.ok(conf.includes('les révisions, les QCM et les questions d’entretien (réussis ou non, jamais ta réponse)') && conf.includes('(jamais leur contenu)'));
});
