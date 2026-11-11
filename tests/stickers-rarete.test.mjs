/* Stickers : la rareté. Elisa, 6 novembre, sur sa capture de l’écran Stickers : « Ne pas mettre sur le tableau mais « rare » ou
   « de collection » pour ceux difficile à avoir / Pour les stickers difficile à obtenir mettre : Légendaire (étiquette) qui gêne paa
   avec des étoile peut être sur l’étiquette en mode paillette avec un agent design en parallèle ». Elle a choisi « Rare + Légendaire » :
   « Rare » pour 10 défis trouvés, « Légendaire » pour la série de 7 jours et le parcours terminé, les trois holographiques.
   On vérifie : plus de pastille « Sur le tableau » (un sticker posé est seulement estompé) ; l’étiquette sous la légende de ces trois-là
   seulement, gagnés ou pas, hors du bouton (ni sur le dessin, ni sur le cadenas, ni sur « Nouveau ») ; la rareté dans l’aria-label et
   dans la fiche ; « Légendaire » à paillettes et petites étoiles qui scintillent une fois gagné, immobile à gagner et en mouvement réduit.
   22 h, pour la fiche : « Étiquette à paillettes » (plutôt que la rareté en toutes lettres dans le texte) : la même étiquette, sous le
   grand sticker. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const take = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i); assert.ok(j > i, b); return html.slice(i, j); };
/* La section des stickers seule : elle s’arrête où commencent les ajouts des Défis (7 novembre), posés après elle. */
const debut63 = css.indexOf('/* ---------- 63. Stickers : l’étiquette de rareté'), fin63 = css.indexOf('/* Défis, relecture d’Elisa', debut63);
const sec = css.slice(debut63, fin63 > debut63 ? fin63 : undefined);
const code = sec.replace(/\/\*[\s\S]*?\*\//g, '');

/* La planche et la fiche dans un faux DOM : 3 modules, les accomplissements, l’état des stickers au choix. */
function world(stickers) {
  const host = { innerHTML: '', querySelectorAll: () => [] };
  const body = { innerHTML: '', scrollTop: 0, querySelector: () => null };
  const ctx = vm.createContext({
    MODULES: [{ titre: 'Introduction', lessons: [{ id: 0 }] }, { titre: 'Lire une table', lessons: [{ id: 2 }] }, { titre: 'Fonctions et expressions', lessons: [{ id: 51 }] }],
    itemDone: () => false, compteStats: () => ({ lessons: 0, defis: 0, streak: 0 }), streakRecord: () => 0,
    state: { stickers }, save: () => {}, activeTab: 'stickers', prefersReduceMotion: () => true, setTimeout: () => 0, requestAnimationFrame: () => 0,
    document: { getElementById: id => (id === 'stk-body' ? host : id === 'stk-sheet-body' ? body : { classList: { add() {}, remove() {} } }), querySelector: () => null, activeElement: null },
  });
  vm.runInContext(take('function esc(s){', 'function highlight(') + take('const STK_INK=', '/* En quittant l’écran, les nouveaux stickers ont été vus. */') + take('function stkOpen(', 'function stkClose('), ctx);
  const paint = ctx.stkPaint;
  Object.assign(ctx, { stkPaint() {}, stkBindBoard() {}, stkBindSheet() {}, stkScrollHolo() {}, stkTilt() {} });
  ctx.renderStickers();
  const cells = Object.fromEntries([...host.innerHTML.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => [/data-id="([^"]+)"/.exec(m[1])[1], m[1]]));
  const kicker = id => { ctx.stkOpen(id); return /<p class="stk-kicker">([^<]*)<\/p>/.exec(body.innerHTML)[1]; };
  const fiche = id => { ctx.stkOpen(id); return body.innerHTML; };
  return { ctx, out: host.innerHTML, cells, kicker, fiche, paint };
}
const rar = cell => (/<span class="stk-rar ([^"]+)" aria-hidden="true">([^<]*)/.exec(cell) || []).slice(1);

test('la rareté suit l’holographie : Rare (10 défis, 1ᵉʳ en multijoueur, défi difficile), Légendaire (séries de 7, 14 et 30 jours, Champion, parcours terminé)', () => {
  const { ctx } = world({ got: {}, fresh: {}, board: [], since: 1 });
  const all = vm.runInContext('[...STK_3D]', ctx);
  assert.equal(all.length, 29);
  assert.deepEqual(Object.fromEntries(all.map(id => [id, ctx.stkRarete(id)]).filter(([, r]) => r)), { defis10: 'Rare', premier: 'Rare', difficile: 'Rare', serie7: 'Légendaire', serie14: 'Légendaire', champion: 'Légendaire', serie30: 'Légendaire', parcours: 'Légendaire' });
  assert.deepEqual({ ...vm.runInContext('STK_HOLO', ctx) }, { defis10: 1, serie7: 2, parcours: 2, premier: 1, difficile: 1, serie14: 2, champion: 2, serie30: 2 }, 'les mêmes que les holographiques (2 : à paillettes)');
});

test('plus de pastille « Sur le tableau » : un sticker posé est seulement estompé, l’aria-label le dit encore', () => {
  const { out, cells } = world({ got: { serie3: 1, serie7: 1 }, fresh: {}, board: [{ id: 'serie3', x: .3, y: .5, r: 0, s: 1 }, { id: 'serie7', x: .7, y: .5, r: 0, s: 1 }], since: 1 });
  assert.ok(!out.includes('Sur le tableau') && !out.includes('stk-on'), 'aucun texte posé sur la planche');
  assert.ok(cells.serie3.includes('class="stk-cell is-placed"') && cells.serie3.includes('aria-label="Série de 3 jours, sur le tableau"'));
  assert.ok(cells.serie7.includes('class="stk-cell is-placed"') && cells.serie7.includes('aria-label="Série de 7 jours, légendaire, sur le tableau"'));
  assert.ok(css.includes('html.lq .stk-cell.is-placed .stk-art{opacity:.42}') && !css.includes('.stk-on'), 'le repère qui reste : le sticker estompé');
});

test('l’étiquette : sur les trois rares seulement, gagnés ou pas ; Légendaire a ses deux petites étoiles, à gagner elle se fait sobre', () => {
  const { cells } = world({ got: { requete: 1, serie3: 1, defis10: 1, serie7: 1 }, fresh: { defis10: 1 }, board: [{ id: 'serie7', x: .5, y: .5, r: 0, s: 1 }], since: 1 });
  assert.deepEqual(rar(cells.defis10), ['is-rare', 'Rare']);
  assert.deepEqual(rar(cells.serie7), ['is-leg', 'Légendaire'], 'gagné, même posé sur le tableau');
  assert.deepEqual(rar(cells.parcours), ['is-leg is-lock', 'Légendaire'], 'à gagner : elle se voit aussi (c’est ce qui donne envie)');
  for (const id of ['intro', 'lire', 'fonctions', 'requete', 'lecons10', 'serie3']) assert.ok(!cells[id].includes('stk-rar'), `${id} : pas d’étiquette`);
  assert.equal((cells.serie7.match(/<i class="stk-rar-sp"><svg /g) || []).length, 2, 'Légendaire : deux étoiles');
  assert.equal((cells.parcours.match(/<i class="stk-rar-sp"><svg /g) || []).length, 2, 'à gagner aussi');
  assert.ok(!cells.defis10.includes('stk-rar-sp'), 'Rare : sans étoiles');
  const none = world({ got: {}, fresh: {}, board: [], since: 1 }).cells;
  assert.deepEqual(rar(none.defis10), ['is-rare is-lock', 'Rare']);
  assert.deepEqual(rar(none.serie7), ['is-leg is-lock', 'Légendaire']);
});

test('elle ne gêne pas : sous la légende, hors du bouton qui porte le dessin, le cadenas et « Nouveau » ; dans le flux, jamais par-dessus', () => {
  const { cells } = world({ got: { defis10: 1 }, fresh: { defis10: 1 }, board: [], since: 1 });
  assert.ok(cells.defis10.includes('</button><small class="stk-cap">10 défis trouvés</small><span class="stk-rar is-rare" aria-hidden="true">Rare</span>'));
  assert.ok(cells.parcours.includes('</button><small class="stk-cap">Tous les modules</small><span class="stk-rar is-leg is-lock" aria-hidden="true">Légendaire<i class="stk-rar-sp">'));
  const button = c => c.slice(0, c.indexOf('</button>'));
  assert.ok(button(cells.defis10).includes('<em class="stk-new">Nouveau</em>') && !button(cells.defis10).includes('stk-rar'), '« Nouveau » reste dans le coin du dessin');
  assert.ok(button(cells.parcours).includes('class="stk-lock"') && !button(cells.parcours).includes('stk-rar'), 'le cadenas reste sur la silhouette');
  const base = sec.slice(sec.indexOf('html.lq .stk-rar{'), sec.indexOf('}', sec.indexOf('html.lq .stk-rar{')) + 1);
  assert.ok(base.includes('position:relative') && !base.includes('position:absolute') && base.includes('white-space:nowrap'), 'dans le flux de la case, sur une ligne');
  assert.ok(base.includes('font:800 11px/1 var(--display)') && base.includes('border:2px solid #fff') && base.includes('rotate:-3deg'), 'une étiquette de la DA : Bricolage, bord blanc d’autocollant, un peu de travers');
  assert.ok(code.includes('@media (max-width:359px){html.lq .stk-rar{padding:3px 6px;font-size:10.5px}'), 'à 320 px, trois étiquettes tiennent côte à côte');
});

test('l’aria-label dit la rareté : « Série de 7 jours, légendaire, à gagner »', () => {
  const locked = world({ got: {}, fresh: {}, board: [], since: 1 }).cells;
  assert.ok(locked.serie7.includes('aria-label="Série de 7 jours, légendaire, à gagner"'));
  assert.ok(locked.parcours.includes('aria-label="Parcours terminé, légendaire, à gagner"'));
  assert.ok(locked.defis10.includes('aria-label="10 défis, rare, à gagner"'));
  assert.ok(locked.serie3.includes('aria-label="Série de 3 jours, à gagner"'), 'un sticker ordinaire : rien de plus');
  const fresh = world({ got: { defis10: 1 }, fresh: { defis10: 1 }, board: [], since: 1 }).cells;
  assert.ok(fresh.defis10.includes('aria-label="10 défis, rare, nouveau"'));
  assert.ok(/<span class="stk-rar [^"]+" aria-hidden="true">/.test(fresh.defis10), 'l’étiquette elle-même est muette : son texte est déjà dans l’aria-label');
});

test('la fiche : l’étiquette à paillettes sous le grand sticker, à la place de « Holo » (22 h)', () => {
  const { kicker, fiche } = world({ got: { serie7: 1700000000000, defis10: 1 }, fresh: {}, board: [], since: 1 });
  assert.equal(kicker('serie7'), 'Accomplissement', 'le texte ne la répète pas');
  assert.equal(kicker('defis10'), 'Accomplissement');
  assert.equal(kicker('parcours'), 'Accomplissement · À gagner');
  assert.equal(kicker('serie3'), 'Accomplissement · À gagner');
  assert.equal(kicker('intro'), 'Module 1 · À gagner');
  const tag = id => (/<\/div><p class="stk-rar-fiche"><span class="stk-rar ([^"]+)">([^<]*)<i class="stk-rar-sp">|<\/div><p class="stk-rar-fiche"><span class="stk-rar ([^"]+)">([^<]*)<\/span><\/p>\s*<p class="stk-kicker">/.exec(fiche(id)) || []).filter(Boolean).slice(1);
  assert.deepEqual(tag('serie7'), ['is-leg', 'Légendaire'], 'juste après la scène du grand sticker, avec ses étoiles');
  assert.deepEqual(tag('defis10'), ['is-rare', 'Rare']);
  assert.deepEqual(tag('parcours'), ['is-leg is-lock', 'Légendaire'], 'à gagner : l’étiquette sobre');
  assert.ok(!fiche('serie3').includes('stk-rar') && !fiche('intro').includes('stk-rar'), 'un sticker ordinaire : rien');
  assert.ok(!/stk-rar-fiche"><span[^>]*aria-hidden/.test(fiche('serie7')), 'dans la fiche, l’étiquette se lit : le texte ne la dit plus');
  assert.ok(/<div class="stk-stage is-lock">[\s\S]*?<\/div><p class="stk-rar-fiche">/.test(fiche('parcours')), 'hors de la scène : le cadenas reste au centre du dessin');
  assert.ok(code.includes('html.lq .stk-rar-fiche{position:relative;margin:-30px 0 18px;line-height:1;pointer-events:none}'), 'remontée dans le bas de la scène, le doigt passe au travers');
  assert.ok(!take('function stkOpen(', 'function stkClose(').includes("' · Holo'"), 'plus de « Holo » affiché');
});

test('Légendaire scintille doucement une fois gagné : paillettes posées par stkPaint, opacité et transformation seulement', () => {
  const { paint, ctx } = world({ got: {}, fresh: {}, board: [], since: 1 });
  const props = new Map(), label = { style: { setProperty: (k, v) => props.set(k, v) } };
  Object.assign(ctx, { window: { devicePixelRatio: 3 }, stkGlitter: () => 'data:image/png;base64,PAILLETTES', stkFontWatch() {} });
  paint({ querySelectorAll: s => (s === '.stk-rar.is-leg' ? [label] : []) });
  assert.equal(props.get('--glit'), 'url(data:image/png;base64,PAILLETTES)', 'la même tuile de paillettes que les stickers holo');
  const animated = [...code.matchAll(/([^{}]+)\{[^{}]*animation:stkRar(Glit|Star)/g)].map(m => m[1].trim());
  assert.equal(animated.length, 3, 'deux couches de paillettes et les étoiles');
  assert.ok(animated.every(sel => sel.includes('.is-leg:not(.is-lock)')), 'seulement une fois gagné : à gagner, rien ne bouge');
  assert.ok(code.includes('html.lq .stk-rar.is-leg.is-lock::before,html.lq .stk-rar.is-leg.is-lock::after{display:none}'), 'à gagner : sans paillettes');
  for (const name of ['stkRarGlit', 'stkRarStar']) {
    const kf = code.slice(code.indexOf(`@keyframes ${name}{`), code.indexOf('}}', code.indexOf(`@keyframes ${name}{`)) + 2);
    const props2 = [...kf.matchAll(/([a-z-]+):/g)].map(m => m[1]);
    assert.ok(props2.length && props2.every(p => p === 'opacity' || p === 'transform'), `${name} : ${props2}`);
  }
  assert.ok(/calc\(var\(--i,0\) \* -\.9s\)/.test(code), 'deux étiquettes voisines ne scintillent pas en même temps');
  assert.ok(!/filter|drop-shadow/.test(code), 'sans filtre : nette sur iPhone');
  assert.ok(/html\.lq \.stk-rar\.is-leg::before,html\.lq \.stk-rar\.is-leg::after\{[^}]*opacity:\.8/.test(code) && code.includes('html.lq .stk-rar.is-leg::after{background-position:29px 13px;background-size:52px 52px;opacity:.45}'), 'immobile, elle garde ses paillettes');
});

test('mouvement réduit (réglage de l’appareil ou de l’appli) : l’étiquette ne bouge plus, telle quelle', () => {
  assert.ok(code.includes('@media (prefers-reduced-motion:reduce){html.lq .stk-rar::before,html.lq .stk-rar::after,html.lq .stk-rar-sp{animation:none!important}}'));
  assert.ok(code.includes('html.lq[data-motion="reduce"] .stk-rar::before,html.lq[data-motion="reduce"] .stk-rar::after,html.lq[data-motion="reduce"] .stk-rar-sp{animation:none!important}'));
});
