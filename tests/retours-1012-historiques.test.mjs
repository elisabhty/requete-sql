/* Elisa, 14 novembre, 10 h 12 : « Est-ce que tu peux me montrer les historiques si par exemple il y en a 30, et les limites
   d’historique ; est-ce que ça va rester que sur le portable de la personne, donc est-ce qu’on peut en mettre en infinité ? Et la
   partie stat aussi, avec au moins 7 personnes dans le classement. Tu regardes si les textes ne se tronquent pas, on voit tout. »
   Ce qui a changé : l’historique des parties garde 500 parties (avant 12) et 100 adversaires (avant 30) ; celui de la Console,
   100 exécutions par projet (avant 24) dans la limite de 120 000 caractères ; Mes stats déplie l’historique ; les pseudos longs
   vont à la ligne sur les podiums ; les milliers sont séparés ; le chiffre du record ne se cache plus sous les pastilles. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => { const a = app.indexOf(`function ${name}(`); assert.ok(a > 0, name); return app.slice(a, app.indexOf('\n}', a) + 2); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = v => JSON.parse(JSON.stringify(v));

test('les limites : 500 parties, 100 adversaires, 100 exécutions par projet (120 000 caractères), déclarées avant leur premier usage', () => {
  assert.ok(app.includes('const JEU_HIST_MAX=500,JEU_ADV_MAX=100;'));
  assert.ok(app.indexOf('const JEU_HIST_MAX=500') < app.indexOf('function normalizeState('), 'lue par normalizeState dès le chargement');
  assert.ok(app.includes(".slice(0,typeof JEU_HIST_MAX!=='undefined'?JEU_HIST_MAX:500);") && app.includes(".slice(typeof JEU_ADV_MAX!=='undefined'?JEU_ADV_MAX:100).forEach"), 'normalizeState se lit aussi seule');
  assert.ok(app.includes('const HIST_MAX=100,HIST_CAR_MAX=120000;'));
  assert.ok(!/slice\(0,12\)/.test(fn('jeuCreditGame')) && fn('jeuCreditGame').includes(".slice(0,typeof JEU_HIST_MAX!=='undefined'?JEU_HIST_MAX:500);") && fn('jeuCreditGame').includes(".slice(typeof JEU_ADV_MAX!=='undefined'?JEU_ADV_MAX:100).forEach"));
  assert.ok(app.includes('<p class="console-library-help">Jusqu’à 100 exécutions, gardées sur cet appareil.</p>') && !app.includes('Les 24 dernières exécutions'));
  /* L’historique reste sur l’appareil : la synchronisation du compte ne l’emporte pas */
  const extrait = cut('function csExtraire(', '\n/* Ce que le compte connaît');
  assert.ok(!/salle|hist|projState/.test(extrait), 'le compte ne reçoit ni les parties ni la Console');
});

test('600 parties enregistrées : les 500 plus récentes restent ; 130 adversaires : les 100 derniers', () => {
  const ctx = vm.createContext({ JEU_HIST_MAX: 500, JEU_ADV_MAX: 100 });
  vm.runInContext(cut('function normalizeState(', 'function normalize('), ctx);
  const hist = Array.from({ length: 600 }, (_, i) => ({ at: 1e12 + i, pts: i, n: 3, ok: 2, niv: 'f', solo: 1 }));
  const mates = Object.fromEntries(Array.from({ length: 130 }, (_, i) => ['p' + i, { n: '@p' + i, g: 2, w: 1, l: 1, at: 1e12 + i }]));
  const s = plain(ctx.normalizeState({ salle: { hist, mates } }).salle);
  assert.equal(s.hist.length, 500);
  assert.equal(s.hist[0].at, 1e12 + 599, 'la plus récente d’abord');
  assert.equal(s.hist[499].at, 1e12 + 100, 'les 100 plus anciennes partent');
  assert.equal(Object.keys(s.mates).length, 100);
  assert.ok(s.mates['@p129'] && !s.mates['@p29'], 'les adversaires les plus anciens partent');
});

test('la Console : 100 exécutions au plus, et pas plus de 120 000 caractères ; la plus récente reste toujours', () => {
  const ctx = vm.createContext({ HIST_SQL_MAX: 20000 });
  vm.runInContext(fn('consoleSqlKey') + fn('dedupeConsoleQueries') + fn('promoteConsoleQuery'), ctx);
  const court = Array.from({ length: 130 }, (_, i) => ({ sql: `SELECT ${i};` }));
  assert.equal(ctx.dedupeConsoleQueries(court, 100, 120000).length, 100);
  const long = Array.from({ length: 10 }, (_, i) => ({ sql: `-- ${i}\n` + 'x'.repeat(19990) }));
  const g = ctx.dedupeConsoleQueries(long, 100, 120000);
  assert.equal(g.length, 6, 'six scripts de 20 000 caractères');
  assert.equal(ctx.promoteConsoleQuery([], { sql: 'y'.repeat(30000) }, 100, 120000).length, 1, 'un seul script trop lourd reste quand même (son début)');
});

test('l’appareil plein : l’historique de la Console raccourcit de moitié et l’enregistrement repart, les brouillons restent', () => {
  let ecrit = null;
  const ctx = vm.createContext({ PROJ_KEY: 'k', JSON,
    localStorage: { setItem(k, v) { if (v.length > 4000) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } ecrit = v; } } });
  vm.runInContext(fn('saveProjState') + ';var projState={cours:{draft:"SELECT 1;",pins:[{sql:"SELECT 2;"}],hist:Array.from({length:100},(_,i)=>({sql:"SELECT "+"z".repeat(60)+i}))}};', ctx);
  assert.equal(ctx.saveProjState(), true);
  const p = JSON.parse(ecrit).cours;
  assert.ok(p.hist.length < 100 && p.hist.length >= 25 && p.hist[0].sql.endsWith('z0'), 'les plus récentes gardées');
  assert.equal(p.draft, 'SELECT 1;');
  assert.equal(p.pins.length, 1);
  const vide = vm.createContext({ PROJ_KEY: 'k', JSON, localStorage: { setItem() { throw new Error('plein'); } } });
  vm.runInContext(fn('saveProjState') + ';var projState={cours:{draft:"",pins:[],hist:[]}};', vide);
  assert.equal(vide.saveProjState(), false, 'rien à raccourcir : il s’arrête');
});

function perf(hist, vu) {
  const ctx = vm.createContext({ state: { salle: { hist } }, esc, clsPts: n => (+n || 0).toLocaleString('fr-FR'), JEU_HIST_MAX: 500, JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' },
    DEF_CHEV_SVG: '<svg data-k="chev"></svg>', lqStkSvg: k => `<svg data-k="${k}"></svg>`, Date, Math, buzz() {}, prefersReduceMotion: () => true });
  vm.runInContext(`const PERF_HIST_VU=4,PERF_HIST_PAS=25;let perfHistVu=${vu || 4};` + fn('jeuChrono') + fn('jeuDureeLisible') + fn('perfDay') + fn('perfWith') + fn('perfGame') + fn('perfBadge') +
    fn('perfHistPas') + fn('perfHistLigneHTML') + fn('perfHistPiedHTML') + ';var lire=()=>perfHistVu;', ctx);
  return ctx;
}
const parties = n => Array.from({ length: n }, (_, i) => ({ at: Date.now() - i * 864e5, pts: 1200 + i, n: 3, ok: 2, ms: 90000, niv: 'm', solo: i % 2, place: 2, players: 6,
  ppl: i % 2 ? undefined : [{ n: '@marie_charlotte', pts: 1500, place: 1 }, { n: '@elisa', pts: 1200, place: 2, me: 1 }, { n: '@jean_baptiste9', pts: 9, place: 3 }] }));

test('Mes stats : 4 parties, puis « Voir les 26 autres parties » ; au-delà de 35 qui restent, 25 de plus à chaque fois ; tout déplié, « Réduire »', () => {
  assert.equal(perf(parties(4)).perfHistPiedHTML(4), '', 'quatre parties : rien à déplier');
  const t = perf(parties(30));
  assert.ok(t.perfHistPiedHTML(30).startsWith('<button type="button" class="perf-hist-plus" aria-controls="perf-hist" onclick="perfHistPlus()"><span>Voir les 26 autres parties</span>'));
  assert.ok(!t.perfHistPiedHTML(30).includes('perf-hist-k'), 'un seul toucher : pas de compteur');
  const c = perf(parties(120));
  const p = c.perfHistPiedHTML(120);
  assert.ok(p.includes('<span>Voir 25 parties de plus</span>') && p.includes('<p class="perf-hist-k">4 sur 120 parties</p>'));
  const f = perf(parties(500), 500).perfHistPiedHTML(500);
  assert.ok(f.includes('<p class="perf-hist-k">Seules tes 500 dernières parties sont gardées.</p>') && f.includes('class="perf-hist-plus is-moins"') && f.includes('<span>Réduire</span>'));
  assert.ok(!perf(parties(30), 30).perfHistPiedHTML(30).includes('Seules tes'), 'moins de 500 : rien n’est perdu, on ne le dit pas');
  /* Le déplier, sans redessiner le tableau */
  const plus = fn('perfHistPlus');
  assert.ok(plus.includes("ol.insertAdjacentHTML('beforeend',h.slice(avant,perfHistVu).map((x,j)=>perfHistLigneHTML(x,Math.min(j,8))).join(''));"));
  assert.ok(plus.includes('[...ol.children].slice(PERF_HIST_VU).forEach(li=>li.remove());'));
  assert.ok(fn('renderDefisPerf').includes('const rows=hist.slice(0,perfHistVu).map((h,i)=>perfHistLigneHTML(h,i)).join(\'\');'));
  assert.ok(fn('defisOnglet').includes("if(k==='stats'&&DEFIS.onglet!=='stats')perfHistVu=PERF_HIST_VU;"), 'rouverte, la liste revient à 4');
});

test('une ligne de l’historique : le titre court, avec qui dessous, puis le jour ; les points séparés', () => {
  const c = perf(parties(2));
  const l = c.perfHistLigneHTML(parties(1)[0], 0);
  assert.ok(l.includes('<span class="perf-g"><b>À plusieurs · Moyen</b><small class="perf-g-avec">avec @marie_charlotte et @jean_baptiste9</small><small>Aujourd’hui · 2/3 résolus · 1 min 30</small></span><em>+1 200</em>'), l);
  const s = c.perfHistLigneHTML(parties(2)[1], 1);
  assert.ok(s.includes('<b>En solo · Moyen</b><small>Hier') && !s.includes('perf-g-avec'));
});

test('une partie d’une autre année dit son année', () => {
  const ctx = vm.createContext({ Date, Math });
  vm.runInContext(fn('perfDay'), ctx);
  const an = new Date().getFullYear(), d = new Date(an - 1, 10, 12, 12).getTime();
  assert.equal(ctx.perfDay(d), `12 nov. ${an - 1}`);
  const ici = new Date(); ici.setDate(ici.getDate() - 20);
  assert.ok(!/\d{4}$/.test(ctx.perfDay(ici.getTime())) || ici.getFullYear() !== an, 'cette année : sans l’année');
});

test('les pseudos longs vont à la ligne sur les podiums (« @marie_ » puis « charlotte »), plus de « … »', () => {
  const ctx = vm.createContext({ esc });
  vm.runInContext(fn('pseudoBr'), ctx);
  assert.equal(ctx.pseudoBr('@marie_charlotte'), '@marie_<wbr>charlotte');
  assert.equal(ctx.pseudoBr('@a.b-c<x>'), '@a.<wbr>b-<wbr>c&lt;x&gt;');
  assert.equal(ctx.pseudoBr('@lea_'), '@lea_', 'rien après : pas de coupure');
  assert.ok(fn('clsPodiumHTML').includes('<span class="dx-pod-n" aria-hidden="true">${pseudoBr(x.pseudo)}</span>'), 'le classement');
  assert.ok(app.includes("`${g.map(x=>`<span class=\"dx-pod-n\" aria-hidden=\"true\">${typeof pseudoBr==='function'?pseudoBr(x&&x.name||'Joueur'):nom(x)}</span>`).join('')}"), 'l’écran de fin de partie');
  assert.ok(fn('perfPodiumHTML').includes('g.map(x=>pseudoBr(x.n)'), 'Mes stats');
  for (const r of [
    'html.lq :is(#scr-defis,#jeu-root) .dx-pod-n{display:block;max-width:100%;color:var(--ink);font:700 13.5px/1.2 var(--display);letter-spacing:-.005em;overflow-wrap:anywhere;text-wrap:balance}',
    'html.lq #jeu-root .jr2-nm b{font:700 15.5px/1.2 var(--display);letter-spacing:-.005em;color:var(--ink);overflow-wrap:anywhere}',
    'html.lq .perf-g b{display:block;font:700 13.5px/1.25 var(--display);color:var(--ink);overflow-wrap:anywhere}'])
    assert.ok(css.includes(r), r);
  assert.ok(!/\.dx-pod-n\{[^}]*ellipsis/.test(css) && !/\.perf-g b\{[^}]*ellipsis/.test(css) && !/\.jr2-nm b\{[^}]*ellipsis/.test(css));
});

test('« 10 850 points » : les milliers séparés, en montant aussi ; « 1 250 000 » rapetisse pour tenir', () => {
  const k = fn('renderDefisPerf');
  assert.ok(k.includes('data-sep="1"') && k.includes("${v==null?'—':clsPts(v)}</b>") && k.includes("String(v).length>6?' is-xlong':''"));
  assert.ok(fn('actCountUp').includes("const fmt=b.dataset.sep?v=>(+v.toFixed(dec)).toLocaleString('fr-FR',{minimumFractionDigits:dec,maximumFractionDigits:dec})+suf:v=>v.toFixed(dec).replace('.',',')+suf;"));
  assert.ok(css.includes('html.lq #scr-defis .perf-kpi.is-xlong b{font-size:16px}'));
});

test('le chiffre du record monte au-dessus des pastilles des autres joueurs', () => {
  const ctx = vm.createContext({ Math });
  vm.runInContext(fn('perfRecordHaut'), ctx);
  assert.equal(ctx.perfRecordHaut({ pts: 900 }, [{ pts: 950 }, { pts: 100 }], 950), ' style="--hl:100%;--hlpx:11px"');
  assert.equal(ctx.perfRecordHaut({ pts: 900 }, [{ pts: 100 }], 900), '', 'pastilles plus bas : à sa place');
  assert.equal(ctx.perfRecordHaut({ pts: 900 }, [], 900), '', 'seul');
  assert.ok(css.includes('html.lq .perf-bar em{position:absolute;left:50%;bottom:calc(var(--hl,var(--h)) + var(--hlpx,5px));z-index:4;'));
});
