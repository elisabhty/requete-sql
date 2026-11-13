/* Elisa, 13 novembre, 1 h 18, trois idées retenues :
   1. « Le cadenas qui s’ouvre sur l’écran de fin de leçon… avec le titre de la leçon débloquée, donnerait la récompense au bon
      moment. »
   2. « Prolonger l’entonnoir après l’onboarding… “1re leçon commencée”, “1re leçon terminée” et “2e leçon terminée”. »
   3. « Une deuxième demande de note plus tard… à un moment fort (un module terminé, ou 7 jours de série). » Et sa question :
      « s’ils n’ont pas mis d’avis, est-ce possible de voir sur Supabase si mis ou pas ? » Non : iOS ne le dit pas. L’entonnoir
      compte seulement les demandes. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = lire('index.html');
const css = lire('ludique.css');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i + a.length); assert.ok(j > i, b); return html.slice(i, j); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

test('le bilan : « Leçon débloquée », le cadenas qui s’ouvre et le titre de la leçon, juste sous « Bravo ! »', () => {
  const f = cut('function bravoOuvreHtml(l){', '\n}\n') + '\n}';
  const L = [{ id: 0, titre: 'Les bases' }, { id: 2, titre: 'Renommer <AS>', résumé: 'Un nom lisible' }, { id: 13, titre: 'DISTINCT', résumé: 'Valeurs uniques' }];
  const MODULES = [{ titre: 'Introduction', lessons: [L[0]] }, { titre: 'Lire une table', lessons: [L[1], L[2]] }];
  const ligne = ({ vue, cle, faites = [], entamee = false }) => vm.runInNewContext(f + ';bravoOuvreHtml(l)', {
    l: L[vue], leconCle: () => cle == null ? null : L[cle], leconRang: id => L.findIndex(x => x.id === id), lecCompletee: id => faites.includes(L.findIndex(x => x.id === id)),
    leconEntamee: () => entamee, moduleDeLecon: id => MODULES.find(m => m.lessons.some(x => x.id === id)), MODULES, lqStkSvg: k => '<svg data-stk="' + k + '"></svg>', esc, DEF_CHEV_SVG: '<svg class="chev"></svg>' });
  /* La 2e leçon validée ouvre la 3e, dans le même module */
  const h = ligne({ vue: 1, cle: 2, faites: [0, 1] });
  assert.ok(h.startsWith('<button type="button" class="bravo-stk bravo-ouvre" onclick="openLesson(13)">'), 'toute la ligne mène à la leçon débloquée');
  assert.ok(h.includes('<span class="bravo-ouvre-art" aria-hidden="true"><svg data-stk="cadenas"></svg></span>'), 'l’autocollant cadenas de l’app');
  assert.ok(h.includes('<small>Leçon débloquée</small><b>DISTINCT</b><em>Valeurs uniques</em>'));
  /* La 1re leçon (seule de son module) ouvre un nouveau module : on le dit, et le titre est échappé */
  const m = ligne({ vue: 0, cle: 1, faites: [0] });
  assert.ok(m.includes('<small>Nouveau module débloqué</small><b>Renommer &lt;AS&gt;</b><em>Module 2 · Lire une table</em>'));
  /* Rien à annoncer : la suivante déjà entamée ou validée, la prochaine étape ailleurs, la leçon pas validée, le parcours fini */
  assert.equal(ligne({ vue: 1, cle: 2, faites: [0, 1], entamee: true }), '');
  assert.equal(ligne({ vue: 0, cle: 2, faites: [0, 1] }), '', 'le bilan d’une ancienne leçon, revu plus tard');
  assert.equal(ligne({ vue: 1, cle: 1, faites: [0] }), '', 'pas encore validée');
  assert.equal(ligne({ vue: 2, cle: null, faites: [0, 1, 2] }), '');
  /* Sa place : sous la carte « Bravo ! » et le sticker gagné, avant la carte mémo */
  const b = cut('function renderBravoSlide(l){', '\n}\n');
  assert.ok(b.includes("      ${stkBravoHtml()}\n      ${typeof bravoOuvreHtml==='function'?bravoOuvreHtml(l):''}\n      ${typeof CARTES!=='undefined'&&CARTES[l.id]?'':bravoRecapHtml(l)}\n      ${bravoUnlockHtml(l)}"));
  /* L’anse de l’autocollant se lève : ses trois tracés (ombre et contour blanc, trait, reflet lilas) portent la même classe */
  const stk = cut("    cadenas:['", '`],');
  assert.equal(stk.split('<path class="stk-anse" d="M15.5 2').length - 1, 3);
  const debut = css.indexOf('Le parcours se suit — 13 novembre, 0 h 32'), fin = css.indexOf('Défis — la refonte du 7 novembre');
  const bloc = css.slice(debut, fin);
  assert.ok(bloc.includes('html.lq .bravo-ouvre-art .lq-stk{display:block;width:48px;height:48px;overflow:visible;animation:bvCadenas 1.5s ease .5s both}'));
  assert.ok(bloc.includes('html.lq .bravo-ouvre-art .stk-anse{transform-origin:32.5px 23px;animation:bvAnse .45s var(--pop) 1.25s both}'), 'elle pivote sur son pied droit, une fois le cadenas remué');
  assert.ok(bloc.includes('@keyframes bvAnse{from{transform:none}to{transform:translateY(-2.5px) rotate(26deg)}}'));
  assert.ok(!bloc.includes('drop-shadow('));
});

test('l’entonnoir continue après l’accueil : 1re leçon commencée, 1re et 2e leçon terminées, une fois par appareil', () => {
  const f = cut('function obCompterLecon(quoi){', '\n}\n') + '\n}';
  const compter = ({ quoi, faites, inscrit = true, stats = true }) => {
    const vu = [];
    vm.runInNewContext(f + ';obCompterLecon(quoi)', { quoi, state: { onboarded: inscrit, lessons: Object.fromEntries([...Array(faites).keys()].map(i => [i, { done: true }])) },
      allLessons: [0, 1, 2, 3].map(id => ({ id })), statActif: () => stats, obCompter: e => vu.push(e) });
    return vu;
  };
  assert.deepEqual(compter({ quoi: 'debut', faites: 0 }), ['leconDebut'], '« Commencer » touché, sur la toute première leçon');
  assert.deepEqual(compter({ quoi: 'debut', faites: 1 }), [], 'pas sur les suivantes');
  assert.deepEqual(compter({ quoi: 'fin', faites: 1 }), ['leconDebut', 'leconUne'], 'chaque étape compte aussi celles d’avant : l’entonnoir ne remonte pas');
  assert.deepEqual(compter({ quoi: 'fin', faites: 2 }), ['leconDebut', 'leconUne', 'leconDeux']);
  assert.deepEqual(compter({ quoi: 'fin', faites: 3 }), [], 'au-delà : plus rien');
  assert.deepEqual(compter({ quoi: 'fin', faites: 1, stats: false }), [], 'statistiques anonymes coupées : rien ne part');
  assert.deepEqual(compter({ quoi: 'fin', faites: 1, inscrit: false }), []);
  for (const e of ['leconDebut', 'leconUne', 'leconDeux', 'note', 'noteDeux']) assert.match(e, /^[a-zA-Z]{2,16}$/, 'un nom que le serveur accepte');
  /* Branché là où la leçon commence et là où elle est validée (pas sur une révision) */
  assert.ok(html.includes("    if(typeof obCompterLecon==='function')obCompterLecon('debut');   // l’entonnoir : la 1re leçon commencée\n    close(true);};"));
  assert.ok(html.includes("  state.lessons[id]=cur; noteActivityDay('lecon'); save();\n  if(!review&&typeof obCompterLecon==='function')obCompterLecon('fin');"));
  /* Le tableau de bord les montre à la suite (migration appliquée le 13 novembre, 1 h 24) : 24 lignes, toujours privé */
  const sql = lire('supabase/migrations/20261113002420_onboarding_entonnoir_premieres_lecons.sql');
  assert.ok(sql.includes("('termine', 19, 'Onboarding terminé'),\n  ('leconDebut', 20, '1re leçon commencée'), ('leconUne', 21, '1re leçon terminée'), ('leconDeux', 22, '2e leçon terminée'),\n  ('note', 23, 'Note demandée à iOS (1re fois)'), ('noteDeux', 24, 'Note demandée à iOS (2e fois)')"));
  assert.ok(sql.includes('with (security_invoker = true)') && sql.includes('revoke all on public.onboarding_entonnoir from public, anon, authenticated;'));
  assert.ok(!/bient[oô]t|prochainement/i.test(sql));
  /* La page de confidentialité le dit, avec sa date */
  const p = lire('decouvrir/confidentialite.html');
  assert.ok(p.includes('Le même décompte continue juste après l’accueil, si les statistiques anonymes sont activées&nbsp;: la première leçon commencée, la première et la deuxième leçon terminées, et les fois où l’appli demande à iOS de te proposer de la noter (ta note, elle, n’arrive jamais à Requête).'));
  assert.ok(p.includes('<p class="lg-maj">Dernière mise à jour&nbsp;: 13 novembre 2026</p>'));
});

/* La note : l’accueil hors de l’app, avec une date, des modules et une série qu’on choisit */
const blocNote = cut("const OB_WIDGET_VU='requete-widget-propose';", 'function obWidgetFin(){');
function accueil({ faites = 1, demandes = 0, le = null, jour = '2026-11-20', serie = 0, stats = true, reponse = { ok: true } } = {}) {
  const stock = new Map(); if (demandes) stock.set('requete-note-demandee', String(demandes)); if (le) stock.set('requete-note-jour', le);
  stock.set('requete-widget-propose', '1');
  const minuteurs = [], appels = [];
  const lecons = [...Array(14).keys()].map(id => ({ id: id + 1 }));
  const ctx = vm.createContext({
    localStorage: { getItem: k => stock.has(k) ? stock.get(k) : null, setItem: (k, v) => stock.set(k, String(v)), removeItem: k => stock.delete(k) },
    state: { onboarded: true }, allLessons: lecons, lecCompletee: id => id <= ctx.faites, faites, serie, jour, stats,
    /* Module 1 : une leçon ; module 2 : douze ; module 3 : la suite */
    MODULES: [{ lessons: lecons.slice(0, 1) }, { lessons: lecons.slice(1, 13) }, { lessons: lecons.slice(13) }],
    streakJours: () => ctx.serie, activeTab: 'learn', ouverts: [], comptes: [], obCompter: e => ctx.comptes.push(e), statActif: () => ctx.stats,
    auj: () => new Date(ctx.jour + 'T00:00:00'), parseD: j => new Date(j + 'T00:00:00'),
    dstr: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
    obWidgetPossible: () => true, startOnboarding: s => ctx.ouverts.push(s),
    ilePont: () => ({ nativePromise: (p, m) => { appels.push(m); return reponse instanceof Error ? Promise.reject(reponse) : Promise.resolve(reponse); } }),
    setTimeout: (fn, d) => { minuteurs.push([fn, d]); return minuteurs.length; }, clearTimeout: () => {},
    document: { body: { classList: { contains: () => false } }, getElementById: () => null, querySelector: () => null },
  });
  vm.runInContext(blocNote, ctx);
  const retour = async () => { vm.runInContext('obWidgetBientot()', ctx); while (minuteurs.length) { minuteurs.shift()[0](); } await new Promise(r => setTimeout(r, 0)); };
  return { ctx, stock, appels, retour };
}

test('une deuxième demande de note, à un moment fort : un vrai module terminé ou 7 jours de série, une semaine au moins après la première', async () => {
  assert.ok(blocNote.includes("const NOTE_DEMANDEE='requete-note-demandee',NOTE_JOUR='requete-note-jour',NOTE_ECART_J=7,NOTE_MODULE_MIN=5,NOTE_SERIE_J=7;"));
  /* Le module 2 (12 leçons) terminé, 8 jours après la première demande : la deuxième part */
  const a = accueil({ faites: 13, demandes: 1, le: '2026-11-12' });
  await a.retour();
  assert.deepEqual(a.appels, ['noter']);
  assert.equal(a.stock.get('requete-note-demandee'), '2');
  assert.equal(a.stock.get('requete-note-jour'), '2026-11-20');
  assert.deepEqual([...a.ctx.comptes], ['noteDeux'], 'l’entonnoir compte la deuxième demande');
  /* Et c’est la dernière : plus jamais, quoi qu’il arrive ensuite */
  a.ctx.jour = '2027-03-01'; a.ctx.serie = 40;
  await a.retour(); await a.retour();
  assert.deepEqual(a.appels, ['noter']);
  /* 7 jours de série suffisent aussi, sans module terminé */
  const s = accueil({ faites: 5, demandes: 1, le: '2026-11-13', serie: 7 });
  await s.retour();
  assert.deepEqual(s.appels, ['noter']);
  /* Pas de moment fort : le module 1 n’a qu’une leçon (il ne compte pas), 6 jours de série ne suffisent pas */
  for (const o of [{ faites: 1 }, { faites: 12 }, { faites: 5, serie: 6 }]) { const x = accueil({ demandes: 1, le: '2026-11-01', ...o }); await x.retour(); assert.deepEqual(x.appels, [], JSON.stringify(o)); }
  /* Trop tôt : moins de 7 jours après la première demande, même avec un module terminé et une longue série */
  const tot = accueil({ faites: 13, serie: 9, demandes: 1, le: '2026-11-14' });
  await tot.retour();
  assert.deepEqual(tot.appels, []);
  tot.ctx.jour = '2026-11-21';
  await tot.retour();
  assert.deepEqual(tot.appels, ['noter'], 'le 7e jour, elle part');
  /* Une première demande d’avant cette version (pas de date gardée) : la deuxième n’attend que le moment fort */
  const ancien = accueil({ faites: 13, demandes: 1 });
  await ancien.retour();
  assert.deepEqual(ancien.appels, ['noter']);
  /* iOS n’a pas pu la recevoir : le compteur et la date reviennent où ils étaient, on redemandera */
  const rate = accueil({ faites: 13, demandes: 1, le: '2026-11-12', reponse: { ok: false } });
  await rate.retour();
  assert.equal(rate.stock.get('requete-note-demandee'), '1');
  assert.equal(rate.stock.get('requete-note-jour'), '2026-11-12');
  assert.deepEqual([...rate.ctx.comptes], []);
  /* Statistiques coupées : la demande part quand même, sans rien compter */
  const muet = accueil({ faites: 13, demandes: 1, le: '2026-11-12', stats: false });
  await muet.retour();
  assert.deepEqual(muet.appels, ['noter']);
  assert.deepEqual([...muet.ctx.comptes], []);
  /* Un compteur abîmé ne rouvre pas les demandes à l’infini */
  for (const v of ['2', '7', 'x']) { const k = accueil({ faites: 13, serie: 30, le: '2026-01-01' }); k.stock.set('requete-note-demandee', v); await k.retour(); assert.equal(k.appels.length, v === 'x' ? 1 : 0, v); }
});
