/* Elisa, 14 novembre. 19 h 54 (les pages des parcours à venir venaient d’être cachées pour la 1.0) : « Mais comment ils vont faire
   pour voter du coup ? Pour le prochain parcours ? » Le vote reste : c’est un sondage qui marche, rien n’y est annoncé.
   20 h 09, sur la carte posée en bas de l’accueil : « Je ne veux pas en bas, peut-être en mode onglet comme Python : Vote pour le
   prochain parcours › […] Et cocher pour la notif. » Une pastille sous « Parcours SQL », dans la rangée où étaient Python, Excel et
   Power BI, ouvre la page du vote, faite comme celle de Python : la carte violette, l’alerte de lancement (pour tous les parcours
   pas encore ouverts), le vote. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const privacy = fs.readFileSync(new URL('../decouvrir/confidentialite.html', import.meta.url), 'utf8');
const block = app.slice(app.indexOf('/* ---------- Les parcours ----------'), app.indexOf('function renderModules(){'));
const attendre = () => new Promise(r => setTimeout(r, 0));
const J1 = 'ab'.repeat(32);

/* Le bac à sable, comme dans l’appli : les parcours à venir cachés (PARCOURS_AVENIR_MONTRES reste false) ; une fausse page
   « Parcours » (l’écran, son corps, le bouton retour) ; un iPhone si natif */
function sandbox({ state = {}, natif = false } = {}) {
  const calls = [], dits = [], classes = new Set();
  const span = { textContent: 'Accueil' }, attrs = {};
  const dom = {
    'scr-parcours': { classList: { toggle: (c, v) => { if (v) classes.add(c); else classes.delete(c); } } },
    'parcours-body': { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] },
    'parcours-back': { querySelector: () => span, setAttribute: (k, v) => { attrs[k] = v; } }
  };
  const window = natif ? { Capacitor: { isNativePlatform: () => true, isPluginAvailable: n => n === 'RequeteWidget',
    nativePromise: (p, m) => { calls.push(['natif', m]); return Promise.resolve({ autorise: true, refuse: false, jeton: J1 }); } } } : {};
  const ctx = vm.createContext({
    window, state: { lessons: {}, ...state }, save() {}, MODULES: [], TOTAL: 0, lqStkSvg: k => `<svg data-k="${k}"></svg>`, esc: String, escAttr: String,
    DEF_CHEV_SVG: '<svg class="chev"></svg>', activeTab: 'learn', switchTab(t) { calls.push(['switchTab', t]); }, returnToParent() { calls.push(['returnToParent']); },
    returnToHome() {}, buzz() {}, lqSay: m => dits.push(m), mascotReduced: () => false, prefersReduceMotion: () => true, requestAnimationFrame: f => f(),
    document: { getElementById: id => dom[id] || null, querySelector: () => null, querySelectorAll: () => [] },
    clsCle: () => 'cle', clsRpc: (fn, body) => { calls.push(['rpc', fn, JSON.parse(JSON.stringify(body))]); return Promise.resolve(fn === 'parcours_en_tete' ? { parcours: null } : fn === 'parcours_resultats' ? { seuil: 1, parts: {} } : { ok: true }); }
  });
  vm.runInContext(block, ctx);
  return { ctx, calls, dits, classes, span, attrs, dom };
}
const rpcs = (calls, fn) => calls.filter(c => c[0] === 'rpc' && c[1] === fn).map(c => c[2]);

/* Une fausse carte de vote dans la page « Parcours » : le bouton radio touché, sa carte, son bouton Voter, le choix coché */
function carte(coche) {
  const btn = { disabled: true, textContent: '', querySelector: () => null };
  const fs = { querySelector: q => (q === '.pc-vote-go' ? btn : q === 'input:checked' ? (coche.value ? coche : null) : null), closest: q => (q === '#parcours-body' ? {} : null) };
  btn.closest = q => (q === '.pc-vote' ? fs : null);
  const radio = v => ({ value: v, closest: q => (q === '.pc-vote' ? fs : null) });
  return { btn, radio };
}

test('plus de carte en bas de l’accueil ; la pastille dans la rangée des parcours, avec ses mots', () => {
  assert.ok(!app.includes('id="home-vote"') && !app.includes('renderParcoursVoteAccueil') && !css.includes('#home-vote'), 'pas en bas');
  assert.ok(app.includes('<p class="pc-head-sub">${parcoursValidees(allDone)} · ${nMods} modules</p>${parcoursChipsHTML(allDone)}<div id="catalog-tools"'), 'sous « Parcours SQL », où était la rangée');
  const { ctx } = sandbox();
  const chips = ctx.parcoursChipsHTML(3);
  assert.ok(chips.startsWith('<ul class="pc-chips is-seul" aria-label="Tes parcours"><li><button type="button" class="pc-chip is-vote" onclick="openParcoursVote()"><i class="pc-chip-vote" aria-hidden="true"><svg'));
  assert.ok(chips.includes('<span class="pc-chip-t"><b>Vote pour le prochain parcours</b></span><svg class="chev"></svg></button></li></ul>'), '« Vote pour le prochain parcours › »');
  assert.ok(!/À venir|Tous les parcours|bientôt|prochainement/i.test(chips));
  for (const part of [
    'html.lq .pc-chip.is-vote{padding:8px 14px 8px 8px;border-style:solid;border-color:var(--line);box-shadow:0 4px 0 var(--lip)}',
    'html.lq .pc-chip-vote{display:grid;place-items:center;flex:none;width:40px;height:40px;border-radius:13px;background:var(--accent-soft);',
    'html.lq .pc-chips.is-seul .pc-chip.is-vote{white-space:normal}'
  ]) assert.ok(css.includes(part), part);
  /* Une fois voté : son choix sous la pastille */
  const v = sandbox({ state: { parcoursVote: { id: 'excel', le: 1, envoye: true } } });
  assert.ok(v.ctx.parcoursChipsHTML(3).includes('<b>Vote pour le prochain parcours</b><small>Ton vote : Excel</small>'));
  /* Le jour où tous les parcours sont ouverts : plus de vote */
  vm.runInContext('PARCOURS.forEach(p=>{p.dispo=true;})', ctx);
  assert.ok(!ctx.parcoursChipsHTML(3).includes('is-vote'));
});

test('la pastille ouvre la page du vote ; le retour ramène à l’accueil', () => {
  const s = sandbox();
  s.ctx.openParcoursVote();
  assert.deepEqual(s.calls.at(-1), ['switchTab', 'parcours']);
  s.ctx.renderParcoursScreen();
  assert.ok(s.classes.has('is-detail'), 'le titre est dans la carte violette');
  assert.equal(s.span.textContent, 'Accueil');
  assert.equal(s.attrs['aria-label'], 'Retour à l’accueil');
  assert.ok(s.dom['parcours-body'].innerHTML.startsWith('<div class="pc-view pc-vote-page">'));
  assert.ok(rpcs(s.calls, 'parcours_en_tete').length === 1, '« En tête » lu à l’ouverture de la page');
  s.ctx.parcoursBack();
  assert.deepEqual(s.calls.at(-1), ['returnToParent']);
  s.ctx.renderParcoursScreen();
  assert.ok(!s.classes.has('is-detail') && !s.dom['parcours-body'].innerHTML.includes('pc-vote-page'), 'refermée');
});

test('la page : comme celle de Python (carte violette, alerte, vote), rien d’annoncé', () => {
  const { ctx } = sandbox();
  const h = ctx.parcoursVotePageHTML();
  assert.ok(h.includes('<section class="pc-hero" aria-labelledby="pc-titre">') && h.includes('<img class="pc-hero-chat" src="assets/chat-ordi.webp"'));
  assert.ok(/<em class="pc-hero-tag"><svg[\s\S]*?<\/svg>Sondage<\/em>/.test(h));
  assert.ok(h.includes('<h2 id="pc-titre">Le prochain parcours</h2>') && h.includes('<svg class="pc-hero-trait"'));
  assert.ok(h.includes('<p class="pc-hero-sub">Dis-nous ce que tu aimerais apprendre après le SQL.</p>'));
  assert.ok(h.includes('<span class="pc-alert-copy"><b>M’avertir au lancement</b><small>Reçois une notification le jour où un nouveau parcours ouvre.</small></span>'));
  assert.ok(h.includes('<input type="checkbox" role="switch" class="pc-switch" onchange="parcoursAlerteTous(this.checked)">'), 'pas cochée d’office');
  assert.ok(/<legend><i class="pc-vote-ico" aria-hidden="true"><svg[\s\S]*?<\/svg><\/i><span>Quel parcours <span class="pc-insec">aimerais-tu<\/span> découvrir ensuite \?<\/span><\/legend>/.test(h));
  for (const [id, titre] of [['python', 'Python pour la data'], ['excel', 'Excel et tableaux croisés'], ['powerbi', 'Power BI']])
    assert.ok(h.includes(`<input type="radio" name="pc-vote" value="${id}" onchange="parcoursChoisir(this.value,this)">`) && h.includes(`<span class="pc-opt-t">${titre}</span>`), id);
  assert.equal((h.match(/ checked/g) || []).length, 0, 'rien de coché tant qu’il n’a pas voté');
  assert.ok(/<button type="button" class="pc-vote-go" onclick="parcoursVoter\(this\)" disabled><svg[\s\S]*?<\/svg><span>Voter<\/span><\/button>/.test(h), 'le bouton attend un choix');
  assert.ok(!/À venir|En préparation|bientôt|prochainement|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/i.test(h), 'ni « à venir », ni date');
  assert.ok(!h.includes('pc-themes'), 'pas de programme');
});

test('« M’avertir au lancement » : une alerte pour tous les parcours pas encore ouverts ; sans notifications, le message dans l’appli', () => {
  const s = sandbox();
  s.ctx.parcoursAlerteTous(true);
  assert.deepEqual([...s.ctx.state.parcoursAlertes], ['python', 'excel', 'powerbi']);
  assert.equal(s.dits.at(-1), 'C’est noté : un message t’attendra dans l’appli le jour où un nouveau parcours ouvre.');
  assert.ok(s.ctx.parcoursVotePageHTML().includes('class="pc-switch" checked onchange="parcoursAlerteTous(this.checked)"'), 'cochée ensuite');
  s.ctx.parcoursAlerteTous(false);
  assert.deepEqual([...s.ctx.state.parcoursAlertes], []);
  assert.equal(s.dits.at(-1), 'Alerte retirée.');
  /* Une ancienne alerte d’un seul parcours (la page de Python, avant le 14 novembre) : l’interrupteur la montre cochée */
  const a = sandbox({ state: { parcoursAlertes: ['python'] } });
  assert.ok(a.ctx.parcoursVotePageHTML().includes('class="pc-switch" checked'));
});

test('iPhone : l’autorisation des notifications, puis l’appareil s’inscrit pour chaque parcours pas encore ouvert', async () => {
  const s = sandbox({ natif: true });
  s.ctx.parcoursAlerteTous(true);
  for (let i = 0; i < 8; i++) await attendre();
  assert.deepEqual(s.calls[0], ['natif', 'notifAutoriser']);
  assert.deepEqual(rpcs(s.calls, 'parcours_alerter').map(b => [b.p_parcours, b.p_on, b.p_jeton === J1]), [['python', true, true], ['excel', true, true], ['powerbi', true, true]]);
  assert.equal(s.dits.at(-1), 'C’est noté : tu recevras une notification le jour où un nouveau parcours ouvre.');
  s.ctx.parcoursAlerteTous(false);
  for (let i = 0; i < 8; i++) await attendre();
  assert.deepEqual(rpcs(s.calls, 'parcours_alerter').slice(3).map(b => [b.p_parcours, b.p_on]), [['python', false], ['excel', false], ['powerbi', false]], 'couper l’alerte désinscrit tout');
});

test('voter sur la page : le choix de sa carte part à la base ; la page se coche sur son vote', async () => {
  const s = sandbox();
  s.ctx.openParcoursVote();
  const coche = { value: '' }, c = carte(coche);
  s.ctx.parcoursChoisir('excel', c.radio('excel'));
  assert.equal(c.btn.disabled, false, 'un choix : le bouton s’allume');
  assert.equal(c.btn.textContent, 'Voter');
  assert.equal(vm.runInContext('parcoursVue', s.ctx), null, 'aucune page de parcours ne s’ouvre');
  coche.value = 'excel';
  s.ctx.parcoursVoter(c.btn);
  await attendre();
  assert.deepEqual(rpcs(s.calls, 'parcours_voter'), [{ p_cle: 'cle', p_parcours: 'excel' }]);
  assert.equal(s.ctx.state.parcoursVote.envoye, true);
  const h = s.ctx.parcoursVotePageHTML();
  assert.ok(h.includes('value="excel" checked') && (h.match(/ checked/g) || []).length === 1);
  assert.ok(h.includes('<span class="pc-opt-t">Excel et tableaux croisés<small class="pc-opt-moi">Ton vote</small></span>'));
  assert.ok(h.includes('Merci ! Ton vote : Excel et tableaux croisés.'));
  /* SQL (déjà ouvert) ou un parcours inconnu : rien */
  const avant = [c.btn.disabled, c.btn.textContent];
  s.ctx.parcoursChoisir('sql', c.radio('sql'));
  s.ctx.parcoursChoisir('java', c.radio('java'));
  assert.deepEqual([c.btn.disabled, c.btn.textContent], avant);
});

test('la confidentialité dit où l’alerte s’active, et pour quels parcours ; les barres des résultats se voient', () => {
  assert.ok(privacy.includes('<li><b>Alerte «&nbsp;M’avertir au lancement&nbsp;»</b> (facultatif). Si tu l’actives sur la page «&nbsp;Vote pour le prochain parcours&nbsp;»'));
  assert.ok(!privacy.includes('sur la page d’un parcours à venir'));
  assert.ok(css.includes('width:var(--pc-part,0%);') && !css.includes('width:var(--p,0%)'), '--p est pris par l’anneau (@property, un nombre)');
  assert.ok(css.includes('html.lq .pc-vote legend .pc-insec{white-space:nowrap}'), '« aimerais-tu » ne se coupe pas');
});
