/* 14 novembre, 15 h 07 (Elisa : « quand je fais Continuer sans compte, je mets mon pseudo, je fais Se connecter dans Mon compte, et je
   veux me connecter dans un autre compte… c’est comme si je perdais l’ancien pseudo »).
   Connecté, la clé de cet appareil est le joueur du compte ; « Se déconnecter » la laisse sur l’appareil. Se connecter ensuite à un
   AUTRE compte libérait cette clé (jeu_pseudo_liberer) : le pseudo du premier compte et ses points du classement disparaissaient, et
   le nouveau compte, s’il n’avait pas de joueur, prenait ce pseudo. Maintenant (cleCompte) :
   - la clé d’un compte n’est jamais libérée ni son pseudo donné à un autre compte ;
   - le nouveau compte retrouve son joueur, ou en commence un qui choisit son pseudo (la page du pseudo) ;
   - les parties de cet appareil restent au compte d’avant : Mes stats repart de celles du nouveau compte, et l’appareil prend un
     nouveau nom pour les parts, pour ne pas écraser la sienne au retour sur le premier compte ;
   - seul le joueur d’un appareil jamais connecté est repris par le compte (comme avant). */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const j = v => JSON.parse(JSON.stringify(v));
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const k = app.indexOf(b, i + a.length); assert.ok(k > i, b); return app.slice(i, k); };
const BLOC = cut('const CJ={fait:\'\',statsAt:0};', '/* Après un enregistrement : 5 s plus tard');

/* Le serveur : le joueur de chaque compte, les pseudos et les parts de stats par compte */
const serveur = () => ({comptes: {}, pseudos: {}, stats: {}, appels: [], qui: 'u1'});
function iphone(S, salle) {
  const st = {onboarded: true, salle: Object.assign({pts: 0, parties: 0, best: 0}, salle)};
  let n = 0;
  const ctx = vm.createContext({natifTexte: x => x, appAndroid: () => false, 
    state: st, JEU: null, JEU_HIST_MAX: 500, JEU_ADV_MAX: 100, CS: {}, CLS: {data: null, at: 0}, DEFIS: {cls: {cle: '', rangs: null}},
    window: {}, localStorage: {setItem() {}, removeItem() {}}, activeTab: 'learn', dits: [], pages: [],
    document: {getElementById: () => ({classList: {contains: () => false}})}, obGardeBloque: () => false, psPage: o => ctx.pages.push(o),
    clsSalle: () => st.salle, clsCle: () => st.salle.cle, save() {}, jeuRand: k => 'NEUVE' + String(++n).padStart(k - 5, 'N'),
    psMien: () => st.salle.pseudo || '', psForme: v => (v ? '@' + String(v).replace(/^@/, '').toLowerCase() : ''),
    psAdopter: p => { st.salle.pseudo = p; }, lqSay: t => ctx.dits.push(t), csPret: () => ({user: S.qui}),
    clsRpc: async (fn, b) => {
      S.appels.push(fn + (b && b.p_cle ? ':' + b.p_cle.slice(0, 4) : ''));
      if (fn === 'compte_joueur_lier') {
        const c = S.comptes[S.qui]; if (c) return {ok: true, cle: c, nouveau: false};
        if (Object.values(S.comptes).includes(b.p_cle)) return {ok: true, cle: null, autre: true};
        S.comptes[S.qui] = b.p_cle; return {ok: true, cle: b.p_cle, nouveau: true};
      }
      if (fn === 'jeu_pseudo_prendre') { const d = S.pseudos[b.p_cle]; if (d) return {ok: true, pseudo: d}; if (!b.p_pseudo) return {ok: false, raison: 'invalide'}; S.pseudos[b.p_cle] = b.p_pseudo; return {ok: true, pseudo: b.p_pseudo}; }
      if (fn === 'jeu_pseudo_liberer') { delete S.pseudos[b.p_cle]; return {ok: true}; }
      if (fn === 'compte_joueur_fusionner') {   // 16 novembre, 6 h 19 : les points de l’appareil sans compte rejoignent le compte
        if (S.comptes[S.qui] !== b.p_cle) throw {status: 403, code: '42501'};
        if (Object.values(S.comptes).includes(b.p_ancienne)) return {ok: false, raison: 'compte'};
        const pa = S.pseudos[b.p_ancienne]; if (pa) { if (!S.pseudos[b.p_cle]) S.pseudos[b.p_cle] = pa; delete S.pseudos[b.p_ancienne]; }
        return {ok: true, pseudo: S.pseudos[b.p_cle] || null, pts: 0, parties: 0};
      }
      if (fn === 'compte_stats_garder') {
        const c = S.stats[S.qui] || (S.stats[S.qui] = {}); c[b.p_appareil] = j(b.p_part);
        return {ok: true, appareils: j(c), hist: [], epoque: 0};
      }
      throw new Error('inattendu ' + fn);
    }});
  vm.runInContext(BLOC, ctx);
  return {ctx, s: () => st.salle};
}
const G = 'G'.repeat(32), KX = 'KX'.repeat(16), KZ = 'KZ'.repeat(16);
const connecter = async (S, I, u) => { S.qui = u; S.appels = []; I.ctx.dits.length = 0; await I.ctx.csJeu(u); };

test('sans compte → compte X → un autre compte : le pseudo de X et sa clé restent à X', async () => {
  const S = serveur(); S.comptes.u1 = KX; S.pseudos[KX] = '@compte_x'; S.pseudos[G] = '@invite';
  const I = iphone(S, {cle: G, pseudo: '@invite', appareil: 'IPHONE0001', pts: 100, parties: 2});
  /* 1. un appareil jamais connecté : le compte reprend la main (comme avant), et le dit */
  await connecter(S, I, 'u1');
  assert.equal(I.s().cle, KX); assert.equal(I.s().pseudo, '@compte_x'); assert.equal(I.s().cleCompte, 1);
  assert.equal(S.pseudos[G], undefined, 'le pseudo sans compte est libéré');
  assert.equal(I.ctx.dits[0], 'Ton compte joue en @compte_x : cet iPhone aussi, à la place de @invite. Tes points et tes parties sans compte s’ajoutent à ceux du compte.');
  assert.equal(S.stats.u1.IPHONE0001.pts, 100, 'ses parties vont au compte');
  /* 2. déconnectée, puis un compte Y neuf : X garde tout, Y commence un joueur et choisit son pseudo */
  await connecter(S, I, 'u2');
  assert.deepEqual(S.appels.filter(a => a.startsWith('jeu_pseudo_liberer')), [], 'rien n’est libéré');
  assert.equal(S.pseudos[KX], '@compte_x', 'le pseudo de X reste à X');
  assert.match(S.comptes.u2, /^NEUVE/); assert.equal(I.s().cle, S.comptes.u2);
  assert.equal(S.pseudos[S.comptes.u2], undefined, 'Y ne prend pas le pseudo de X'); assert.equal(I.s().pseudo, undefined);
  assert.deepEqual(j(I.ctx.pages), [{obligatoire: true}], 'la page du pseudo s’ouvre, obligatoire (24 novembre, 17 h 18 : « j’ai pu m’inscrire sans pseudo c’est pas normal »)');
  assert.equal(I.s().pts, 0, 'Mes stats repart de celles de Y'); assert.notEqual(I.s().appareil, 'IPHONE0001', 'un nouveau nom d’appareil');
  assert.equal(S.stats.u1.IPHONE0001.pts, 100, 'la part de X n’est pas touchée');
  /* 3. puis un compte Z qui a déjà un joueur : Z, sans rien libérer */
  S.comptes.u3 = KZ; S.pseudos[KZ] = '@z';
  await connecter(S, I, 'u3');
  assert.deepEqual(S.appels.filter(a => a.startsWith('jeu_pseudo_liberer')), []);
  assert.equal(I.s().cle, KZ); assert.equal(I.s().pseudo, '@z');
  /* 4. retour sur X : son pseudo, et ses parties d’avant (la part de l’ancien nom, comptée avec les « autres appareils ») */
  await connecter(S, I, 'u1');
  assert.equal(I.s().cle, KX); assert.equal(I.s().pseudo, '@compte_x');
  assert.equal(I.ctx.dits[0], 'Ce compte joue en @compte_x. @z reste à l’autre compte.');
  assert.equal(S.stats.u1.IPHONE0001.pts, 100); assert.equal(I.s().pts, 100, 'Mes stats retrouve les 100 points joués ici avec X');
});

test('la marque cleCompte se garde (normalizeState) ; une clé déjà à un autre compte, même sans marque, n’est jamais libérée', async () => {
  assert.ok(app.includes("if(salleSrc.cleCompte)salle.cleCompte=1;"));
  const S = serveur(); S.comptes.u1 = KX; S.pseudos[KX] = '@compte_x';
  const I = iphone(S, {cle: KX, pseudo: '@compte_x', appareil: 'IPHONE0001'});   // un iPhone connecté avant cette version
  await connecter(S, I, 'u2');
  assert.deepEqual(S.appels.filter(a => a.startsWith('jeu_pseudo_liberer')), []);
  assert.equal(S.pseudos[KX], '@compte_x'); assert.equal(I.s().cleCompte, 1);
});
