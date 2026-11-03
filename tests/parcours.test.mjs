/* Les parcours (Elisa, 3 novembre, 18 h 25 : « mettre en avant le fait qu’il y aura plusieurs modules par la suite même si
   aujourd’hui on en a qu’un » ; 19 h 01 : « Ok pour ça », sur la maquette). SQL est le premier parcours ; Python pour la data,
   Excel et tableaux croisés et Power BI sont annoncés « À venir » : alerte de sortie (sur l’appareil) et vote pour le prochain. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const sql = fs.readFileSync(new URL('../supabase/migrations/20261103181500_parcours_vote.sql', import.meta.url), 'utf8');
const privacy = fs.readFileSync(new URL('../decouvrir/confidentialite.html', import.meta.url), 'utf8');
const block = app.slice(app.indexOf('/* ---------- Les parcours ----------'), app.indexOf('function renderModules(){'));

function sandbox(extra = {}) {
  const calls = [];
  const ctx = vm.createContext({
    state: { lessons: { 1: { done: true } } }, save() {}, MODULES: [{ lessons: [{ id: 1 }, { id: 2 }, { id: 3 }] }, { lessons: [] }], TOTAL: 3,
    lqStkSvg: k => `<svg data-k="${k}"></svg>`, esc: String, escAttr: String, DEF_CHEV_SVG: '<svg class="chev"></svg>',
    activeTab: 'learn', switchTab(t) { calls.push(['switchTab', t]); ctx.activeTab = t; }, returnToParent() { calls.push(['returnToParent']); },
    returnToHome() {}, buzz() {}, lqSay(m) { calls.push(['lqSay', m]); },
    document: { getElementById: () => null, querySelector: () => null },
    clsCle: () => 'cle', clsRpc: (fn, body) => { calls.push(['rpc', fn, body]); return Promise.resolve({ ok: true }); },
    ...extra
  });
  vm.runInContext(block, ctx);
  return { ctx, calls };
}

test('SQL est le premier parcours ; trois parcours à venir, sans date ni contenu promis', () => {
  const { ctx } = sandbox();
  const list = vm.runInContext('PARCOURS', ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(list.map(p => [p.id, !!p.dispo]))), [['sql', true], ['python', false], ['excel', false], ['powerbi', false]]);
  assert.deepEqual(JSON.parse(JSON.stringify(list.map(p => p.titre))), ['SQL', 'Python pour la data', 'Excel et tableaux croisés', 'Power BI']);
  assert.ok(!/\b(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|bientôt)\b/i.test(block.replace(/\/\*[\s\S]*?\*\//g, '')), 'aucune date annoncée');
  for (const p of list.filter(p => !p.dispo)) assert.ok(sql.includes(`'${p.id}'`), `le serveur accepte le vote pour ${p.id}`);
});

test('accueil : « Parcours SQL » sous « Tes parcours », la rangée des parcours, la recherche reste', () => {
  const mods = app.slice(app.indexOf('function renderModules(){'), app.indexOf('function toggleCatalogTools('));
  assert.ok(mods.includes('<span>Tes parcours</span><h2>Parcours SQL</h2><p>${parcoursValidees(allDone)} · ${nMods} modules</p>'));
  assert.ok(mods.includes('<span>Chercher</span></button></div>${parcoursChipsHTML(allDone)}<div id="catalog-tools"'), 'la rangée vient sous le titre, avant la recherche');
  const { ctx } = sandbox();
  const chips = ctx.parcoursChipsHTML(1);
  assert.ok(chips.startsWith('<ul class="pc-chips" aria-label="Tes parcours">'));
  assert.ok(chips.includes('<span class="pc-chip is-on">') && chips.includes('SQL<em>En cours</em>'), 'SQL en cours, pas un bouton');
  assert.equal((chips.match(/onclick="openParcours\('(python|excel|powerbi)'\)"/g) || []).length, 3, 'chaque parcours à venir ouvre sa page');
  assert.equal((chips.match(/<em>À venir<\/em>/g) || []).length, 3);
  assert.ok(chips.includes('onclick="openParcours()">Tous les parcours'), 'puis « Tous les parcours »');
  assert.ok(ctx.parcoursChipsHTML(0).includes('SQL<em>Disponible</em>') && ctx.parcoursChipsHTML(3).includes('SQL<em>Terminé</em>'));
  assert.ok(css.includes('html.lq .pc-chips{display:flex;gap:8px;margin:0 0 16px;padding:2px 0 6px;list-style:none;overflow-x:auto;'), 'elle défile à l’horizontale');
  assert.ok(css.includes('html.lq .pc-chip{') && css.includes('border:2px dashed #C9BFF0'), 'les parcours à venir en pointillés');
});

test('la page « Parcours » est une sous-page de l’accueil : retour, onglet, autocollant, pas de bouton flottant', () => {
  assert.ok(app.includes('<section id="scr-parcours" class="screen">'));
  assert.ok(app.includes('id="parcours-back" onclick="parcoursBack()" aria-label="Retour à l’accueil"'));
  assert.ok(app.includes('<div class="lgtitle"><div class="eyebrow">Tes parcours</div><h1>Parcours</h1>'));
  assert.equal((app.match(/compte:'scr-compte',parcours:'scr-parcours'\}/g) || []).length, 2, 'screenForTab et switchTab');
  assert.ok(app.includes("function primaryTabFor(tab){\n  if(tab==='parcours')return 'learn';"), 'l’onglet Accueil reste allumé');
  assert.ok(app.includes("  else if(tab==='parcours') renderParcoursScreen();"));
  assert.ok(app.includes("'jeu','parcours'].includes(tab)"), 'pas de bouton flottant');
  assert.ok(app.includes("'scr-entretien':'mic','scr-parcours':'route'};"), 'l’autocollant de la route');
  assert.ok(css.includes('html.lq #scr-parcours.is-detail>.lgtitle,html.lq #app #scr-parcours.is-detail>.lgtitle.lq-head{display:none!important}'), 'la page d’un parcours a son titre dans la carte');
});

test('liste et page d’un parcours : ouvrir, revenir (vers la liste ou l’accueil), alerte, vote', async () => {
  const { ctx, calls } = sandbox();
  const plain = x => JSON.parse(JSON.stringify(x));
  const liste = ctx.parcoursListeHTML();
  assert.ok(liste.includes('<p class="pc-sec">Disponible</p>') && liste.includes('<p class="pc-sec">À venir</p>'));
  assert.ok(liste.includes('1 modules · 3 leçons') && liste.includes('1 leçon validée sur 3'), 'modules non vides seulement');
  assert.equal((liste.match(/class="pc-card is-soon"/g) || []).length, 3);
  assert.ok(liste.includes('Quel parcours après SQL ?') && liste.includes('<em>Voter</em>'));
  // Ouvert depuis l’accueil : le retour ramène à l’accueil.
  ctx.openParcours('python');
  assert.deepEqual(calls.at(-1), ['switchTab', 'parcours']);
  assert.equal(vm.runInContext('parcoursVue', ctx), 'python');
  ctx.parcoursBack();
  assert.deepEqual(calls.at(-1), ['returnToParent']);
  // Ouvert depuis la liste : le retour ramène à la liste.
  ctx.activeTab = 'parcours';
  ctx.openParcours('excel');
  assert.equal(vm.runInContext('parcoursDeListe', ctx), true);
  ctx.parcoursBack();
  assert.deepEqual(calls.at(-1), ['switchTab', 'parcours']);
  assert.equal(vm.runInContext('parcoursVue', ctx), null);
  // SQL n’a pas de page « à venir ».
  ctx.openParcours('sql');
  assert.equal(vm.runInContext('parcoursVue', ctx), null);
  const page = ctx.parcoursPageHTML(vm.runInContext("PARCOURS.find(p=>p.id==='python')", ctx));
  assert.ok(page.includes('<em class="pc-hero-tag">En préparation</em>') && page.includes('<h2 id="pc-titre">Python pour la data</h2>'));
  assert.ok(page.includes('<input type="checkbox" role="switch" class="pc-switch" onchange="parcoursAlerte(\'python\',this.checked)">'));
  assert.equal((page.match(/<input type="radio" name="pc-vote"/g) || []).length, 3);
  assert.ok(page.includes('value="python" checked'), 'le parcours de la page est proposé d’abord');
  // L’alerte reste sur l’appareil.
  ctx.parcoursAlerte('python', true);
  assert.deepEqual([...ctx.state.parcoursAlertes], ['python']);
  ctx.parcoursAlerte('sql', true);
  assert.deepEqual([...ctx.state.parcoursAlertes], ['python'], 'pas d’alerte pour un parcours déjà ouvert');
  assert.ok(ctx.parcoursListeHTML().includes('Python pour la data, à venir, alerte activée'));
  ctx.parcoursAlerte('python', false);
  assert.deepEqual([...ctx.state.parcoursAlertes], []);
  // Le vote part à la base de l’appli, avec la clé de l’appareil ; revoter le remplace.
  ctx.parcoursChoisir('excel');
  ctx.parcoursVoter();
  assert.equal(ctx.state.parcoursVote.id, 'excel');
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(plain(calls.filter(c => c[0] === 'rpc').at(-1)), ['rpc', 'parcours_voter', { p_cle: 'cle', p_parcours: 'excel' }]);
  assert.equal(ctx.state.parcoursVote.envoye, true);
  assert.ok(ctx.parcoursVoteMsg(vm.runInContext("PARCOURS.find(p=>p.id==='excel')", ctx)).startsWith('Merci ! Ton vote : Excel'));
  assert.equal(ctx.parcoursVoteFait('excel'), true, 'même choix : rien à renvoyer');
  assert.ok(ctx.parcoursListeHTML().includes('Ton vote : Excel et tableaux croisés.') && ctx.parcoursListeHTML().includes('<em>Changer</em>'));
});

test('vote hors ligne : il reste sur l’appareil et repart plus tard', async () => {
  let ok = false;
  const { ctx } = sandbox({ clsRpc: () => (ok ? Promise.resolve({ ok: true }) : Promise.reject(new Error('réseau'))) });
  ctx.parcoursChoisir('powerbi');
  ctx.parcoursVoter();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(ctx.state.parcoursVote.envoye, false);
  assert.ok(ctx.parcoursVoteMsg(vm.runInContext("PARCOURS.find(p=>p.id==='powerbi')", ctx)).includes('est gardé sur ton appareil'));
  ok = true;
  assert.equal(await ctx.parcoursEnvoyerVote(), true);
  assert.equal(ctx.state.parcoursVote.envoye, true);
  assert.ok(block.includes("window.addEventListener('online',()=>{try{parcoursEnvoyerVote();}catch(e){}});"), 'au retour du réseau');
});

test('la progression garde les alertes, les annonces et le vote (normalizeState)', () => {
  assert.ok(app.includes('const parcoursAlertes=Array.isArray(source.parcoursAlertes)?[...new Set(source.parcoursAlertes.filter(pcId))].slice(0,20):[];'));
  assert.ok(app.includes("const parcoursVote=pv&&typeof pv==='object'&&pcId(pv.id)?{id:pv.id,le:Math.max(0,Math.floor(Number(pv.le))||0),envoye:pv.envoye!==false}:null;"));
  assert.ok(app.includes('stickers,lecOuvertes,parcoursAlertes,parcoursAnnonces,parcoursVote};'));
});

test('base de l’appli : un vote par appareil, par la seule fonction parcours_voter ; la confidentialité le dit', () => {
  assert.ok(sql.includes('cle text primary key,') && sql.includes("check (parcours in ('python', 'excel', 'powerbi'))"));
  assert.ok(sql.includes('alter table public.parcours_vote enable row level security;'));
  assert.ok(sql.includes('revoke all on public.parcours_vote from public, anon, authenticated;'), 'aucun droit direct sur la table');
  assert.ok(sql.includes('security definer') && sql.includes("set search_path = ''") && sql.includes('v_cle text := public.jeu_cle(p_cle);'), 'l’empreinte de la clé, comme les messages de contact');
  assert.ok(sql.includes('on conflict (cle) do update set parcours = excluded.parcours, vote_le = now();'), 'revoter remplace le vote');
  assert.ok(sql.includes('grant execute on function public.parcours_voter(text, text) to anon, authenticated;'));
  assert.ok(sql.includes('create or replace view public.parcours_votes with (security_invoker = true)') && sql.includes('revoke all on public.parcours_votes from public, anon, authenticated;'), 'les résultats, pour le tableau de bord seulement');
  assert.ok(privacy.includes('<li><b>Vote pour le prochain parcours</b> (facultatif).') && privacy.includes('L’alerte de sortie d’un parcours, elle, reste sur ton appareil.'));
});
