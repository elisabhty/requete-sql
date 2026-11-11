/* Elisa, 11 novembre, 15 h 15 : la page « Python pour la data » (un parcours à venir), puis sa maquette de la même page. La carte
   violette : l’étiquette, le titre en blanc souligné d’un trait jaune, une phrase, le chat à l’ordinateur, trois thèmes ; l’alerte
   avec sa cloche (« M’avertir au lancement ») ; le vote avec son pictogramme, une icône par parcours, « En tête » et un bouton
   avec sa coche. « En tête » : au choix d’Elisa, de vrais votes (parcours_en_tete, sans chiffres, à partir de 10 votes, sans
   égalité). L’étiquette garde « En préparation » : jamais « bientôt » dans les textes. Pas de logos de marques (Python, Excel,
   Power BI) : les autocollants de l’appli. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const sql = fs.readFileSync(new URL('../supabase/migrations/20261111143000_parcours_en_tete.sql', import.meta.url), 'utf8');
const block = app.slice(app.indexOf('/* ---------- Les parcours ----------'), app.indexOf('function renderModules(){'));

/* La page, jouée dans un bac à sable ; une fausse page où « En tête » se pose */
function sandbox({ tete = null, rpcKo = false } = {}) {
  const calls = [], opts = ['python', 'excel', 'powerbi'].map(v => {
    const l = { v, html: '', input: { value: v }, badge: null,
      querySelector(q) { return q === 'input' ? this.input : q === '.pc-tete' ? this.badge : null; },
      insertAdjacentHTML(w, h) { this.html += h; this.badge = { remove: () => { this.badge = null; } }; } };
    return l;
  });
  const ctx = vm.createContext({
    state: { lessons: {} }, save() {}, MODULES: [], TOTAL: 0, lqStkSvg: k => `<svg data-k="${k}"></svg>`, esc: String, escAttr: String, DEF_CHEV_SVG: '',
    activeTab: 'parcours', switchTab() {}, returnToParent() {}, returnToHome() {}, buzz() {}, lqSay() {}, mascotReduced: () => false, Date,
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: q => (q === '#parcours-body .pc-opt' ? opts : []) },
    clsCle: () => 'cle', clsRpc: (fn, body) => { calls.push([fn, body]); return rpcKo ? Promise.reject(new Error('réseau')) : Promise.resolve(fn === 'parcours_en_tete' ? { parcours: tete } : { ok: true }); }
  });
  vm.runInContext(block, ctx);
  return { ctx, calls, opts };
}
const P = (ctx, id) => vm.runInContext(`PARCOURS.find(p=>p.id==='${id}')`, ctx);

test('la carte violette : étiquette, titre souligné, phrase, chat à l’ordinateur, trois thèmes ; jamais « bientôt »', () => {
  const { ctx } = sandbox();
  const page = ctx.parcoursPageHTML(P(ctx, 'python'));
  assert.ok(page.includes('<img class="pc-hero-chat" src="assets/chat-ordi.webp" alt="" width="314" height="358" decoding="async">'), 'le chat (en mouvement réduit, chat-ordi-fixe.webp)');
  assert.ok(/<em class="pc-hero-tag"><svg[^>]*>[\s\S]*?<\/svg>En préparation<\/em>/.test(page), 'l’étiquette avec sa fusée');
  assert.ok(page.includes('<h2 id="pc-titre">Python pour la data</h2>\n        <svg class="pc-hero-trait"'), 'le trait jaune sous le titre');
  assert.ok(page.includes('<ul class="pc-themes" aria-label="Au programme">'));
  assert.deepEqual([...page.matchAll(/<li><svg[^>]*>[\s\S]*?<\/svg><span>([^<]+)<\/span><\/li>/g)].map(m => m[1]), ['Analyse de données', 'Automatisation', 'Projets concrets']);
  for (const [id, desc, themes] of [['excel', 'Un nouveau parcours pour organiser, calculer et résumer tes données avec Excel.', ['Formules', 'Tableaux croisés', 'Graphiques']],
    ['powerbi', 'Un nouveau parcours pour construire des tableaux de bord et faire parler tes données avec Power BI.', ['Tableaux de bord', 'Visualisation', 'Projets concrets']]]) {
    const p = ctx.parcoursPageHTML(P(ctx, id));
    assert.ok(p.includes(`<p class="pc-hero-sub">${desc}</p>`), id);
    assert.deepEqual([...p.matchAll(/<li><svg[^>]*>[\s\S]*?<\/svg><span>([^<]+)<\/span><\/li>/g)].map(m => m[1]), themes, id);
  }
  ctx.mascotReduced = () => true;
  assert.ok(ctx.parcoursPageHTML(P(ctx, 'python')).includes('src="assets/chat-ordi-fixe.webp"'));
  assert.ok(!/bientôt|prochainement/i.test(block.replace(/\/\*[\s\S]*?\*\//g, '')), 'jamais « bientôt » ni « prochainement »');
});

test('l’alerte avec sa cloche, le vote avec son pictogramme, une icône par parcours et un bouton avec sa coche', () => {
  const { ctx } = sandbox();
  const page = ctx.parcoursPageHTML(P(ctx, 'python'));
  assert.ok(page.includes('<i class="pc-alert-ico" aria-hidden="true"><svg') && page.includes('<b>M’avertir au lancement</b><small>Reçois une notification dans l’appli le jour de l’ouverture.</small>'));
  assert.ok(/<legend><i class="pc-vote-ico" aria-hidden="true"><svg[\s\S]*?<\/svg><\/i><span>Quel parcours aimerais-tu découvrir ensuite \?<\/span><\/legend>/.test(page), 'la question est la légende du groupe, avec son pictogramme');
  assert.ok(page.includes('<p class="pc-vote-sub">Ton vote nous aide à choisir le prochain !</p>'));
  for (const [id, k] of [['python', 'term'], ['excel', 'table'], ['powerbi', 'chart']])
    assert.ok(page.includes(`value="${id}"`) && page.includes(`<i class="pc-opt-ico" aria-hidden="true"><svg data-k="${k}"></svg></i>`), `${id} : l’autocollant de l’appli, pas le logo de la marque`);
  assert.ok(/<button type="button" class="pc-vote-go" onclick="parcoursVoter\(\)"><svg[\s\S]*?<\/svg><span>Voter<\/span><\/button>/.test(page));
  assert.ok(!page.includes('pc-tete'), 'sans vote en tête, pas de badge');
});

test('« En tête » : le parcours qui a le plus de votes, lu à la base de l’appli, sans chiffres ; posé sur la page déjà ouverte', async () => {
  const s = sandbox({ tete: 'excel' });
  assert.equal(await s.ctx.parcoursTeteCharger(), 'excel');
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls)), [['parcours_en_tete', {}]]);
  assert.deepEqual(s.opts.map(o => !!o.badge), [false, true, false], 'le badge sur la page ouverte');
  assert.ok(s.opts[1].html.startsWith('<em class="pc-tete"><svg') && s.opts[1].html.endsWith('En tête</em>'));
  const page = s.ctx.parcoursPageHTML(P(s.ctx, 'python'));
  assert.ok(page.includes('<span class="pc-opt-t">Excel et tableaux croisés</span><em class="pc-tete">'), 'et dans la page dessinée ensuite');
  /* Relu 5 minutes plus tard au plus ; tout de suite après son propre vote */
  await s.ctx.parcoursTeteCharger();
  assert.equal(s.calls.length, 1, 'pas plus d’une fois toutes les 5 minutes');
  await s.ctx.parcoursTeteCharger(true);
  assert.equal(s.calls.length, 2);
  assert.ok(block.includes('parcoursEnvoyerVote().then(ok=>{if(activeTab===\'parcours\')renderParcoursScreen();if(ok)parcoursTeteCharger(true);});'));
  assert.ok(block.includes('  if(p)parcoursTeteCharger();\n}'), 'à chaque ouverture de la page d’un parcours');
  /* Une réponse inattendue (SQL, un parcours inconnu) ou hors ligne : pas de badge */
  for (const opt of [{ tete: 'sql' }, { tete: 'java' }, { tete: null }, { rpcKo: true }]) {
    const t = sandbox(opt);
    assert.equal(await t.ctx.parcoursTeteCharger(), null, JSON.stringify(opt));
    assert.ok(t.opts.every(o => !o.badge));
  }
});

test('base de l’appli : parcours_en_tete ne renvoie que le parcours en tête, à partir de 10 votes et sans égalité', () => {
  assert.ok(sql.includes('create or replace function public.parcours_en_tete()\nreturns jsonb\nlanguage sql\nstable\nsecurity definer\nset search_path = \'\''));
  assert.ok(sql.includes('case when t.total >= 10 and (select count(*) from c where c.n = t.tete) = 1'));
  assert.ok(sql.includes("select jsonb_build_object('parcours',") && !/'votes'|'total'|'n'/.test(sql.replace(/--.*$/gm, '')), 'aucun chiffre renvoyé');
  assert.ok(sql.includes('revoke all on function public.parcours_en_tete() from public, anon, authenticated;\ngrant execute on function public.parcours_en_tete() to anon, authenticated;'));
});

test('styles : la carte, ses thèmes, la cloche, le vote et « En tête », d’après la maquette', () => {
  for (const part of [
    'html.lq .pc-hero-chat{position:absolute;z-index:0;right:-10px;top:14px;width:46%;max-width:200px;',
    'html.lq .pc-hero-copy{position:relative;z-index:1;max-width:60%}',
    'html.lq .pc-hero h2{margin:16px 0 0;font:800 33px/1.04 var(--display);letter-spacing:-.02em;color:#fff;',
    'html.lq .pc-themes{position:relative;z-index:1;display:grid;grid-template-columns:repeat(3,auto);',
    'html.lq .pc-alert-ico{position:relative;display:grid;place-items:center;flex:none;width:50px;height:50px;border-radius:15px;background:var(--accent-soft);',
    'html.lq .pc-vote-ico{display:grid;place-items:center;flex:none;width:50px;height:50px;',
    'html.lq .pc-tete{display:inline-flex;align-items:center;gap:3px;flex:none;',
    'html.lq .pc-vote-go:disabled::after{display:none}'
  ]) assert.ok(css.includes(part), part);
  assert.ok(!css.includes('.pc-hero-stk') && !css.includes('.pc-hero-k{'), 'l’ancienne carte est partie');
});
