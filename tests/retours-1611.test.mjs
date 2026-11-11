/* Elisa, 11 novembre, 16 h 11, sur la page d’Excel : « Est-ce qu’il y a un lien entre le sondage des 3 pages ? D’ailleurs quand on
   clique sur Python je préfère que tu adaptes le haut par celui de Python (le cadre du haut) de manière fluide. » Le vote est le
   même sur les trois pages (un par appareil) ; le choix coché est le parcours affiché, et la carte violette et l’alerte le suivent
   sans recharger la page (parcoursMontrer). Au passage, les pastilles des thèmes tiennent dans la carte sur un iPhone de 375 ou
   393 points (« Projets concrets » débordait). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const block = app.slice(app.indexOf('/* ---------- Les parcours ----------'), app.indexOf('function renderModules(){'));

/* Une fausse page : la carte (titre, trait, phrase, thèmes, chat), l’interrupteur de l’alerte, le bouton du vote */
function fausse({ anime = false, haut = 40 } = {}) {
  const anims = [];
  const el = (extra = {}) => Object.defineProperties({
    textContent: '', innerHTML: '', children: [], style: {},
    animate(k, o) {
      let fin; const a = { k, o, el: this, playState: 'running', finished: new Promise(r => { fin = r; }), cancel() { a.playState = 'idle'; }, fini() { a.playState = 'finished'; fin(a); } };
      anims.push(a); return a;
    }
  }, Object.getOwnPropertyDescriptors(extra));
  let hauteur = 340;
  const titre = el(), trait = el(), sub = el(), chat = el();
  const themes = el({ set innerHTML(h) { this._h = h; this.children = (h.match(/<li>/g) || []).map(() => el()); hauteur = h.includes('Tableaux de bord') ? 328 : 340; }, get innerHTML() { return this._h; } });
  themes.innerHTML = '<li></li><li></li><li></li>';
  const hero = el({ querySelector: q => ({ h2: titre, '.pc-hero-trait': trait, '.pc-hero-sub': sub, '.pc-themes': themes, '.pc-hero-chat': chat })[q] || null,
    getBoundingClientRect: () => ({ top: haut, height: hauteur }), parentElement: null });
  if (!anime) delete hero.animate;
  const zone = { scrollTop: 275, getBoundingClientRect: () => ({ top: 60 }) };
  const sw = { checked: false, onchange: null }, btn = { disabled: false, textContent: '', querySelector: () => null };
  const doc = {
    getElementById: () => null, scrollingElement: zone, documentElement: zone,
    querySelector: q => ({ '#parcours-body .pc-hero': hero, '#parcours-body .pc-switch': sw, '#parcours-body .pc-vote-go': btn })[q] || null,
    querySelectorAll: () => []
  };
  return { anims, hero, titre, trait, sub, themes, chat, sw, btn, doc, zone };
}

function sandbox(page, state = {}) {
  const calls = [];
  const ctx = vm.createContext({
    state: { lessons: {}, ...state }, save() {}, MODULES: [], TOTAL: 0, lqStkSvg: k => `<svg data-k="${k}"></svg>`, esc: String, escAttr: String, DEF_CHEV_SVG: '',
    activeTab: 'parcours', switchTab() {}, returnToParent() {}, returnToHome() {}, buzz(t) { calls.push(['buzz', t]); }, lqSay() {}, mascotReduced: () => false,
    document: page ? page.doc : { getElementById: () => null, querySelector: () => null }, getComputedStyle: () => ({ overflowY: 'visible' }),
    requestAnimationFrame: f => { calls.push(['raf', f]); return 1; }, Promise,
    clsCle: () => 'cle', clsRpc: () => Promise.resolve({ ok: true })
  });
  vm.runInContext(block, ctx);
  return { ctx, calls };
}
const P = (ctx, id) => vm.runInContext(`PARCOURS.find(p=>p.id==='${id}')`, ctx);

test('le vote est le même sur les trois pages ; chaque page coche son parcours et marque « Ton vote »', () => {
  const { ctx } = sandbox(null, { parcoursVote: { id: 'excel', le: 1, envoye: true } });
  for (const id of ['python', 'excel', 'powerbi']) {
    const page = ctx.parcoursPageHTML(P(ctx, id));
    assert.ok(page.includes(`value="${id}" checked`), `${id} : le parcours affiché est coché`);
    assert.equal((page.match(/ checked/g) || []).length, 1);
    assert.ok(page.includes('<span class="pc-opt-t">Excel et tableaux croisés<small class="pc-opt-moi">Ton vote</small></span>'), `${id} : le vote est marqué`);
    assert.equal((page.match(/pc-opt-moi/g) || []).length, 1);
    assert.ok(page.includes('Merci\u00a0! Ton vote\u00a0: Excel et tableaux croisés.'));
  }
  assert.ok(!ctx.parcoursPageHTML(P(ctx, 'python')).includes('<span class="pc-opt-t">Python pour la data<small'), 'pas de marque sur un parcours non voté');
  assert.ok(css.includes('html.lq .pc-opt-moi{display:block;margin-top:3px;font:800 12.5px/1.2 var(--display);color:var(--accent-ink)}'));
});

test('choisir un autre parcours dans le vote : la carte et l’alerte suivent (mouvement réduit : d’un coup)', () => {
  const page = fausse();
  const { ctx, calls } = sandbox(page, { parcoursAlertes: ['powerbi'] });
  ctx.openParcours('python');
  ctx.parcoursChoisir('powerbi');
  assert.equal(vm.runInContext('parcoursVue', ctx), 'powerbi', 'la page affichée est celle du choix (retour, vote, rendu)');
  assert.equal(page.titre.textContent, 'Power BI');
  assert.equal(page.sub.textContent, 'Un nouveau parcours pour construire des tableaux de bord et faire parler tes données avec Power BI.');
  assert.ok(page.themes.innerHTML.includes('<span>Tableaux de bord</span>') && page.themes.innerHTML.includes('<span>Visualisation</span>'));
  assert.equal(page.sw.checked, true, 'l’alerte de Power BI était déjà activée');
  page.sw.onchange.call({ checked: false });
  assert.deepEqual([...ctx.state.parcoursAlertes], [], 'l’interrupteur agit sur le parcours affiché');
  assert.deepEqual(calls.find(c => c[0] === 'buzz'), ['buzz', 'selection'], 'un petit cran sous le doigt');
  assert.equal(page.btn.textContent, 'Voter');
  ctx.parcoursChoisir('excel');
  assert.equal(page.titre.textContent, 'Excel et tableaux croisés');
  assert.equal(page.sw.checked, false);
  // Hors d’une page de parcours (la liste), rien ne bouge.
  ctx.parcoursBack();
  ctx.parcoursChoisir('python');
  assert.equal(vm.runInContext('parcoursVue', ctx), null);
});

test('avec mouvement : l’ancien contenu glisse et s’efface, puis le nouveau arrive ; la hauteur suit, le vote reste sous le doigt', async () => {
  const page = fausse({ anime: true, haut: -200 });
  const { ctx, calls } = sandbox(page);
  ctx.openParcours('python');
  ctx.parcoursChoisir('powerbi');
  const sorties = page.anims.filter(a => a.o.fill === 'forwards');
  assert.equal(sorties.length, 6, 'titre, trait, phrase et trois thèmes');
  assert.ok(sorties.every(a => a.k[1].opacity === 0 && a.k[1].transform === 'translateX(-16px)'), 'vers la gauche : Power BI est plus bas dans la liste');
  assert.ok(page.anims.some(a => a.el === page.chat), 'le chat fait un petit bond');
  assert.equal(page.titre.textContent, '', 'le contenu change après la sortie');
  sorties.forEach(a => a.fini());
  await new Promise(r => setTimeout(r, 0));
  assert.equal(page.titre.textContent, 'Power BI');
  const h = page.anims.find(a => a.el === page.hero);
  assert.deepEqual(JSON.parse(JSON.stringify(h.k)), [{ height: '340px' }, { height: '328px' }], 'la carte change de hauteur en douceur');
  assert.ok(page.anims.some(a => a.el === page.titre && a.k[0].transform === 'translateX(18px)'), 'le titre arrive par la droite');
  assert.ok(page.anims.some(a => a.el === page.trait && a.k[0].clipPath === 'inset(0 100% 0 0)'), 'le trait jaune se redessine');
  assert.equal(page.anims.filter(a => page.themes.children.includes(a.el)).length, 3, 'les thèmes sautillent un à un');
  // Le haut de la carte est sorti de l’écran : la page suit la hauteur (12 points de moins).
  const raf = calls.find(c => c[0] === 'raf');
  assert.ok(raf);
  raf[1]();
  assert.equal(page.zone.scrollTop, 263, 'la zone défile de l’écart de hauteur');
  // Un autre choix pendant l’animation reprend proprement.
  ctx.parcoursChoisir('excel');
  assert.ok(page.anims.filter(a => a.el === page.hero).every(a => a.playState === 'idle'), 'l’animation en cours s’arrête');
});

test('le code : un choix ne recharge pas la page ; les pastilles tiennent dans la carte', () => {
  assert.ok(block.includes("  if(parcoursVue&&parcoursVue!==id){const avant=parcoursVue;parcoursVue=id;parcoursMontrer(id,avant);}"));
  assert.ok(block.includes('  const sel=p.id;'), 'le choix coché est le parcours affiché');
  assert.ok(block.includes("if(typeof hero.animate!=='function'||(typeof mascotReduced==='function'&&mascotReduced())){remplir();return;}"), 'mouvement réduit');
  assert.ok(css.includes('html.lq .pc-themes{position:relative;z-index:1;display:grid;grid-template-columns:repeat(3,auto);justify-content:stretch;gap:5px;margin:18px -8px 0;'));
  assert.ok(css.includes('@media (max-width:392.98px){\n  html.lq .pc-themes li{padding:7px 5px;font-size:11px}'));
  assert.ok(css.includes('@media (max-width:339.98px){html.lq .pc-themes{grid-template-columns:repeat(2,auto)}}'));
});
