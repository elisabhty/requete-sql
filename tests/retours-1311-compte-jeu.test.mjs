/* Elisa, 14 novembre, 13 h 02 : « Connecte-toi pour retrouver… sur tous tes appareils… est-ce vrai ? » (en partie : leçons, défis,
   planning et notes, mais ni le pseudo, ni les points, ni les parties) ; 13 h 11, à « relier le pseudo, les points et les stats au
   compte » : « Vas-y ».
   - Le joueur du compte (compte_joueur_lier) : la clé de joueur du premier appareil connecté devient celle du compte ; un autre
     appareil connecté la reprend (pseudo et points du classement), libère le pseudo qu’il avait, et lui donne le sien si le joueur du
     compte n’en avait pas. Une clé déjà à un autre compte : une neuve. Pas en pleine salle.
   - Les parties du compte (compte_stats_garder) : « Mes stats » = la part de chaque appareil (son total moins celle des autres),
     sans double compte d’une synchro à l’autre, et les 500 dernières parties de tous. « Tout effacer » efface partout (époque). */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync, readdirSync} from 'node:fs';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const j = v => JSON.parse(JSON.stringify(v));   // les objets du bac à sable viennent d’un autre domaine
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const BLOC = cut('const CJ={fait:\'\',statsAt:0};', '/* Après un enregistrement : 5 s plus tard');

/* Un appareil : son état, et un serveur partagé (les appareils d'un même compte voient le même) */
function serveur() {
  return {lien: null, stats: {appareils: {}, hist: [], epoque: 0}, pseudos: {}, appels: []};
}
function appareil(S, {cle = 'CLEAPPAREIL' + 'A'.repeat(20), pseudo = '', salle = {}, enPartie = false, connecte = true} = {}) {
  const st = {salle: Object.assign({cle, pts: 0, parties: 0, best: 0}, pseudo ? {pseudo} : {}, salle)};
  let n = 0;
  const ctx = vm.createContext({
    state: st, JEU: enPartie ? {} : null, JEU_HIST_MAX: 500, JEU_ADV_MAX: 100, CS: {}, CLS: {data: {x: 1}, at: 5}, DEFIS: {cls: {cle: 'x', rangs: []}},
    window: {REQUETE_JEU_ID: {pid: 'p'}}, localStorage: {setItem() {}, removeItem() {}}, activeTab: 'learn', dits: [],
    clsSalle: () => st.salle, clsCle: () => st.salle.cle, save() {}, jeuRand: k => 'NEUVE' + String(++n).padStart(k - 5, 'N'),
    psMien: () => st.salle.pseudo || '', psForme: v => (v ? '@' + String(v).replace(/^@/, '').toLowerCase() : ''),
    psAdopter: p => { st.salle.pseudo = p; }, lqSay: t => ctx.dits.push(t), csPret: () => (connecte ? {user: 'u1'} : null),
    clsRpc: async (fn, b, o) => {
      S.appels.push(fn);
      if (fn === 'compte_joueur_lier') {
        assert.ok(o && o.compte, fn + ' avec le jeton du compte');
        if (S.lien) return {ok: true, cle: S.lien, nouveau: false};
        if (S.autres && S.autres.includes(b.p_cle)) return {ok: true, cle: null, autre: true};
        S.lien = b.p_cle; return {ok: true, cle: b.p_cle, nouveau: true};
      }
      if (fn === 'jeu_pseudo_prendre') { const d = S.pseudos[b.p_cle]; if (d) return {ok: true, pseudo: d}; if (!b.p_pseudo) return {ok: false, raison: 'invalide'}; S.pseudos[b.p_cle] = b.p_pseudo; return {ok: true, pseudo: b.p_pseudo}; }
      if (fn === 'jeu_pseudo_liberer') { delete S.pseudos[b.p_cle]; return {ok: true}; }
      /* 16 novembre, 6 h 19 : le joueur de l’appareil rejoint celui du compte (ses points avec) */
      if (fn === 'compte_joueur_fusionner') {
        assert.ok(o && o.compte, fn + ' avec le jeton du compte');
        if (S.sansFusion) throw {status: 404, code: 'PGRST202'};
        if (S.lien !== b.p_cle) throw {status: 403, code: '42501'};
        const pa = S.pseudos[b.p_ancienne]; if (pa) { if (!S.pseudos[b.p_cle]) S.pseudos[b.p_cle] = pa; delete S.pseudos[b.p_ancienne]; }
        (S.fusions = S.fusions || []).push(b.p_ancienne); return {ok: true, pseudo: S.pseudos[b.p_cle] || null, pts: 0, parties: 0};
      }
      if (fn === 'compte_stats_garder') {
        if (b.p_epoque != null && b.p_epoque < S.stats.epoque) return {ok: true, efface: true, epoque: S.stats.epoque};
        S.stats.appareils[b.p_appareil] = JSON.parse(JSON.stringify(b.p_part));
        const vu = new Set(); S.stats.hist = S.stats.hist.concat(b.p_hist).filter(h => !vu.has(h.at) && vu.add(h.at)).sort((x, y) => y.at - x.at).slice(0, 500);
        return {ok: true, appareils: JSON.parse(JSON.stringify(S.stats.appareils)), hist: S.stats.hist.slice(), epoque: S.stats.epoque};
      }
      throw new Error('inattendu ' + fn);
    }});
  vm.runInContext(BLOC, ctx);
  return {ctx, st, s: () => st.salle};
}
const partie = (s, pts, at) => { s.pts += pts; s.parties += 1; s.best = Math.max(s.best, pts); if (typeof s.bestP === 'number') s.bestP = Math.max(s.bestP, pts); s.hist = [{at, pts, n: 1, ok: 1, niv: 'f', solo: 1}].concat(s.hist || []); };

test('le premier appareil connecté donne sa clé au compte ; un autre la reprend, avec le pseudo du compte', async () => {
  const S = serveur(), A = appareil(S, {cle: 'CLEA' + 'A'.repeat(24), pseudo: '@lea'});
  S.pseudos[A.s().cle] = '@lea';
  assert.deepEqual(j(await A.ctx.csJoueur('u1')), {meme: true});
  assert.equal(S.lien, A.s().cle);
  const B = appareil(S, {cle: 'CLEB' + 'B'.repeat(24), pseudo: '@lea_tmp'});
  S.pseudos[B.s().cle] = '@lea_tmp';
  const r = await B.ctx.csJoueur('u1');
  assert.equal(B.s().cle, A.s().cle, 'la clé du compte');
  assert.equal(B.s().pseudo, '@lea', 'le pseudo du compte');
  assert.equal(S.pseudos['CLEB' + 'B'.repeat(24)], undefined, 'le pseudo pris sur cet appareil est libéré');
  assert.deepEqual(j(B.s().envoi), []); assert.equal(B.s().clsRattrape, 1);
  assert.equal(B.ctx.window.REQUETE_JEU_ID, null); assert.equal(B.ctx.CLS.data, null); assert.equal(B.ctx.DEFIS.cls.cle, '');
  /* 14 novembre, 15 h 07 : le message dit ce que devient le pseudo d’avant (retours-1507-changer-de-compte) */
  assert.equal(B.ctx.dits[0], 'Ton compte joue en @lea : cet iPhone aussi, à la place de @lea_tmp. Tes points et tes parties sans compte s’ajoutent à ceux du compte.');
  assert.deepEqual(S.fusions, ['CLEB' + 'B'.repeat(24)], 'ses points rejoignent le compte (16 novembre)');
  assert.ok(!S.appels.includes('jeu_pseudo_liberer'), 'plus libéré à part : la fusion s’en charge');
  assert.equal(B.s().cleCompte, 1, 'la clé de cet appareil est maintenant celle d’un compte');
  assert.equal(r.pseudo, '@lea');
  /* une seule fois par compte et par lancement */
  const n = S.appels.length; await B.ctx.csJoueur('u1'); assert.equal(S.appels.length, n);
});

test('le joueur du compte sans pseudo prend celui de cet appareil ; une clé à un autre compte en donne une neuve ; jamais en pleine salle', async () => {
  const S = serveur(); S.lien = 'CLECOMPTE' + 'C'.repeat(20);
  const B = appareil(S, {cle: 'CLEB' + 'B'.repeat(24), pseudo: '@leo'}); S.pseudos[B.s().cle] = '@leo';
  await B.ctx.csJoueur('u1');
  assert.equal(B.s().cle, S.lien); assert.equal(B.s().pseudo, '@leo'); assert.equal(S.pseudos[S.lien], '@leo', 'il passe au joueur du compte');
  const S2 = serveur(); S2.autres = ['CLEP' + 'P'.repeat(24)];
  const P = appareil(S2, {cle: 'CLEP' + 'P'.repeat(24), pseudo: '@sam'});
  await P.ctx.csJoueur('u1');
  assert.match(S2.lien, /^NEUVE/); assert.equal(P.s().cle, S2.lien, 'une identité neuve pour ce compte');
  const S3 = serveur(); S3.lien = 'CLECOMPTE' + 'C'.repeat(20);
  const J = appareil(S3, {enPartie: true});
  assert.equal(await J.ctx.csJoueur('u1'), null); assert.deepEqual(S3.appels, [], 'en pleine salle : à la prochaine synchro');
});

test('Mes stats : la somme des appareils, sans double compte d’une synchro à l’autre', async () => {
  const S = serveur();
  const A = appareil(S, {salle: {appareil: 'APPAREILA1'}}), B = appareil(S, {cle: 'CLEB' + 'B'.repeat(24), salle: {appareil: 'APPAREILB2'}});
  partie(A.s(), 100, 1000); partie(A.s(), 50, 2000);
  partie(B.s(), 30, 3000);
  await A.ctx.csStats(true); await B.ctx.csStats(true); await A.ctx.csStats(true);
  for (const X of [A, B]) {
    assert.equal(X.s().pts, 180, 'tous les points'); assert.equal(X.s().parties, 3); assert.equal(X.s().best, 100);
    assert.deepEqual(j(X.s().hist.map(h => h.at)), [3000, 2000, 1000], 'les parties des deux appareils');
  }
  /* d'autres synchros n'ajoutent rien */
  await B.ctx.csStats(true); await A.ctx.csStats(true); await B.ctx.csStats(true);
  assert.equal(A.s().pts, 180); assert.equal(B.s().pts, 180);
  /* une partie de plus sur B : comptée une fois partout */
  partie(B.s(), 20, 4000); await B.ctx.csStats(false); await A.ctx.csStats(true);
  assert.equal(B.s().pts, 200); assert.equal(A.s().pts, 200); assert.equal(B.s().bestP, 30); assert.equal(A.s().best, 100);
  assert.deepEqual(S.stats.appareils.APPAREILA1.pts, 150); assert.deepEqual(S.stats.appareils.APPAREILB2.pts, 50);
  /* rien de neuf : pas d'envoi avant 10 minutes */
  const n = S.appels.length; await A.ctx.csStats(false); assert.equal(S.appels.length, n);
});

test('« Tout effacer » ailleurs : les parties d’ici partent aussi, puis la part vide repart', async () => {
  const S = serveur();
  const A = appareil(S, {salle: {appareil: 'APPAREILA1'}});
  partie(A.s(), 100, 1000); await A.ctx.csStats(true);
  assert.equal(A.s().statsEpoque, 0);
  S.stats = {appareils: {}, hist: [], epoque: 1};   // effacé depuis un autre appareil
  partie(A.s(), 10, 2000);
  await A.ctx.csStats(true);
  assert.equal(A.s().pts, 0); assert.equal(A.s().parties, 0); assert.deepEqual(j(A.s().hist), []); assert.equal(A.s().statsEpoque, 1);
  assert.deepEqual(S.stats.appareils.APPAREILA1.pts, 0);
});

test('serveur sans époque (avant sa migration) : le même envoi sans p_epoque', async () => {
  const S = serveur(), A = appareil(S, {salle: {appareil: 'APPAREILA1'}});
  const vrai = A.ctx.clsRpc, vus = [];
  A.ctx.clsRpc = async (fn, b, o) => { if (fn === 'compte_stats_garder') { vus.push('p_epoque' in b); if ('p_epoque' in b) throw {status: 404, code: 'PGRST202'}; } return vrai(fn, b, o); };
  partie(A.s(), 70, 1000);
  await A.ctx.csStats(true);
  assert.deepEqual(vus, [true, false]); assert.equal(A.s().pts, 70); assert.equal(S.stats.appareils.APPAREILA1.pts, 70);
});

test('la synchro du compte appelle le jeu ; « Tout effacer » efface les parties du compte ; l’état garde les champs du compte', () => {
  assert.ok(cut('function csSync(o){', '\n/* ---------- Le joueur et les parties du compte').includes('try{await csJeu(cs.user);}catch(e){}'));
  const reset = cut('async function resetAllProgress(){', '\n}\n');
  assert.ok(reset.includes("clsRpc('compte_stats_effacer',{},{compte:true})") && reset.includes('if(id&&state.salle.appareil)id.appareil=state.salle.appareil;'));
  const norm = cut('if(salleSrc.clsRattrape)salle.clsRattrape=1;', '/* Temps d’apprentissage');
  for (const k of ['salle.appareil=', 'salle.statsEpoque=', 'salle.bestP=', 'salle.fastP=', 'salle.statsHaut=', 'salle.statsAutres=o;']) assert.ok(norm.includes(k), k);
  const credit = cut('function jeuCreditGame(){', '\n    save();');
  assert.ok(credit.includes("if(typeof s.bestP==='number')s.bestP=Math.max(s.bestP,pts);") && credit.includes("if(mine.length&&typeof s.fastP==='number')"));
});

test('Supabase : les deux tables privées, effacées avec le compte ; les fonctions réservées aux comptes connectés', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const sql = readdirSync(dir).filter(f => f >= '20261114121753').map(f => readFileSync(new URL(f, dir), 'utf8')).join('\n');
  for (const k of ['create table if not exists requete_private.compte_joueur (', 'user_id uuid primary key references auth.users(id) on delete cascade,',
    "cle text not null unique check (cle ~ '^[A-Za-z0-9]{24,64}$'),", 'create table if not exists requete_private.compte_stats (',
    'revoke all on table requete_private.compte_joueur from public, anon, authenticated;', 'revoke all on table requete_private.compte_stats from public, anon, authenticated;',
    'grant execute on function public.compte_joueur_lier(text) to authenticated;', "if v_uid is null or coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' then",
    "return jsonb_build_object('ok', true, 'cle', null, 'autre', true);", 'select h, at from uniques order by at desc limit 500',
    /* 13 h 34 (« Oui vas-y ») : l’époque des effacements */
    'alter table requete_private.compte_stats add column if not exists epoque integer not null default 0;',
    'drop function if exists public.compte_stats_garder(text, jsonb, jsonb);',
    "if p_epoque is not null and p_epoque < v_ep then\n    return jsonb_build_object('ok', true, 'efface', true, 'epoque', v_ep);",
    'grant execute on function public.compte_stats_garder(text, jsonb, jsonb, integer) to authenticated;',
    'epoque = requete_private.compte_stats.epoque + 1'])
    assert.ok(sql.includes(k), k);
  assert.ok(!/grant execute on function public\.compte_[a-z_]+\([^)]*\) to [^;]*anon/.test(sql), 'jamais pour anon');
});

test('les textes : l’accueil ne promet plus sans compte ; la confidentialité dit ce que le compte garde du jeu', () => {
  assert.ok(app.includes("'Avec un compte, ta progression te suit sur tous tes appareils.'") && !app.includes('Ta progression sera sauvegardée sur tous tes appareils.'));
  assert.ok(app.includes('Avec un compte&nbsp;: leçons, défis, notes, planning, ton pseudo, tes points et tes parties sont sauvegardés et te suivent sur tes autres appareils.'));
  const conf = readFileSync(new URL('../decouvrir/confidentialite.html', import.meta.url), 'utf8');
  assert.ok(conf.includes('l’identifiant de joueur tiré au hasard par ton appareil (celui qui porte ton pseudo et tes points au classement)') && conf.includes('Dernière mise à jour&nbsp;: 16 novembre 2026'));
});

/* 16 novembre, 6 h 19 : un serveur sans compte_joueur_fusionner (404) : comme avant (le pseudo de l’appareil libéré) ; sans réponse
   du serveur, rien n’est libéré et la reprise attend la synchro suivante. */
test('la fusion des points : sans la fonction, comme avant ; sans réponse, on recommence plus tard', async () => {
  const S = serveur(); S.lien = 'CLECOMPTE' + 'C'.repeat(20); S.pseudos[S.lien] = '@lea'; S.sansFusion = true;
  const B = appareil(S, {cle: 'CLEB' + 'B'.repeat(24), pseudo: '@lea_tmp'}); S.pseudos[B.s().cle] = '@lea_tmp';
  await B.ctx.csJoueur('u1');
  assert.equal(B.s().cle, S.lien); assert.equal(S.pseudos['CLEB' + 'B'.repeat(24)], undefined); assert.ok(S.appels.includes('jeu_pseudo_liberer'));
  assert.equal(B.ctx.dits[0], 'Ton compte joue en @lea : cet iPhone aussi, à la place de @lea_tmp. Tes parties sans compte s’ajoutent à celles du compte.');
  const S2 = serveur(); S2.lien = 'CLECOMPTE' + 'C'.repeat(20); S2.pseudos[S2.lien] = '@lea';
  const C = appareil(S2, {cle: 'CLEC' + 'C'.repeat(24), pseudo: '@lea_tmp'}); S2.pseudos[C.s().cle] = '@lea_tmp';
  const rpc = C.ctx.clsRpc; C.ctx.clsRpc = async (fn, b, o) => { if (fn === 'compte_joueur_fusionner') throw new TypeError('Load failed'); return rpc(fn, b, o); };
  assert.equal(await C.ctx.csJoueur('u1'), null);
  assert.equal(C.s().cle, 'CLEC' + 'C'.repeat(24), 'l’appareil garde son joueur'); assert.equal(S2.pseudos['CLEC' + 'C'.repeat(24)], '@lea_tmp', 'rien n’est libéré');
  C.ctx.clsRpc = rpc; await C.ctx.csJoueur('u1');
  assert.equal(C.s().cle, S2.lien, 'à la synchro suivante, la fusion se fait'); assert.deepEqual(S2.fusions, ['CLEC' + 'C'.repeat(24)]);
});
