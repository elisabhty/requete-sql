/* Elisa, 8 novembre, 18 h 36 (capture d’une manche seule) : « Le pill base le mettre entre l’intérieur et l’extérieur du cadre genre
   poser en haut à droite / Comment faire les réactions ? De plus voir la réaction des autres en temps réel sur l’écran avec leur
   pseudo / Mettre toujours : « À toi de jouer ! Tu peux consulter le schéma de la base à tout moment pour explorer les tables et leurs
   colonnes. » ».
   - La base : une pastille posée à cheval sur le bord du cadre de « La situation », en haut à droite.
   - Réagir : avant, les quatre réactions n’apparaissaient qu’une fois la réponse trouvée, et à plusieurs. Maintenant, en salle,
     « Réagir » au bout de la ligne du niveau, dans le cadre de la manche, un seul bouton (31 octobre : « trop de boutons ») qui ouvre
     les quatre ; chaque réaction, la sienne comme celles des autres, monte le long du bord de l’écran avec le pseudo. 19 h 12 (capture
     d’une salle où elle est seule, sans « Réagir ») : « visible même seule » ; pas en partie seule (« Joue seul »). 19 h 37 : « le
     Réagir, laisse-le en bas à droite, et il s’enlève quand on écrit dans l’endroit de la requête » : un bouton posé en bas à droite
     de l’écran, effacé pendant qu’on écrit ; les réactions montent juste au-dessus de lui.
   - La situation finit toujours sur la phrase du schéma. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const NB = ' ';
const PHRASE = `À toi de jouer${NB}! Tu peux consulter le schéma de la base à tout moment pour explorer les tables et leurs colonnes.`;

test('la base : une pastille posée à cheval sur le bord du cadre, en haut à droite (en salle seulement)', () => {
  const f = cut('function defiConsigneHTML(c,o){', '\n}\n');
  assert.ok(f.includes("const base=o&&o.base&&nom?`<span class=\"dq-chip is-base\">Base ${esc(nom)}</span>`:'';"));
  assert.ok(f.includes('return `<div class="consigne dq${base?\' has-base\':\'\'}${titre?\' has-titre\':\'\'}">${base}${titre}<span class="tag">La situation</span>'), 'puis le titre (21 h 51)');
  assert.ok(!app.includes('dq-tete'), 'plus de rangée « La situation » + base');
  for (const r of ['html.lq .consigne.dq.has-base{position:relative;margin-top:30px}',
    'html.lq .consigne.dq .dq-chip.is-base{position:absolute;top:-14px;right:16px;z-index:1;box-sizing:border-box;height:26px;max-width:calc(100% - 32px);overflow:hidden;',
    'padding:0 12px;background:var(--accent);color:#fff;font:800 12px/26px var(--display);box-shadow:0 3px 0 var(--accent-lip);text-overflow:ellipsis}'])
    assert.ok(css.includes(r), r);
  /* 20 h 07 : « la pill violette est de mauvaise qualité (base) » : ni penchée ni décalée d’un demi-pixel, Safari la dessine nette */
  const regle = css.slice(css.indexOf('html.lq .consigne.dq .dq-chip.is-base{'), css.indexOf('}', css.indexOf('html.lq .consigne.dq .dq-chip.is-base{')));
  assert.ok(!/rotate|translate|transform/.test(regle), 'droite, sans transformation');
  assert.ok(!/\.dq-tete/.test(css), 'les règles de l’ancienne rangée sont parties');
  /* Rendu : en salle la pastille, sur la page d’un défi rien (la base y est dans la barre du haut) */
  const ctx = vm.createContext({ esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), escCode: s => String(s), DEFI_BASES: { zoo: { nom: 'Zoo' } } });
  vm.runInContext(cut('const DEFI_A_TOI=', '\nfunction defiConsigneHTML(c,o){') + '\n' + f + '\n}', ctx);
  ctx.c = { base: 'zoo', situation: `Au zoo, Raoul veut savoir. À toi de jouer${NB}!`, affiche: ['le nom'], garde: [], ordered: false };
  const salle = vm.runInContext('defiConsigneHTML(c,{base:true})', ctx), seul = vm.runInContext('defiConsigneHTML(c)', ctx);
  assert.ok(salle.startsWith('<div class="consigne dq has-base"><span class="dq-chip is-base">Base Zoo</span><span class="tag">La situation</span><p class="defi-ctx">'));
  assert.ok(seul.startsWith('<div class="consigne dq"><span class="tag">La situation</span><p class="defi-ctx">') && !seul.includes('is-base'));
});

test('« À toi de jouer ! Tu peux consulter le schéma… » sous chaque situation, dans un cadre gris clair (18 h 36, 19 h 57)', () => {
  assert.ok(app.includes("const DEFI_A_TOI=['À toi de jouer\\u00a0!','Tu peux consulter le schéma de la base à tout moment pour explorer les tables et leurs colonnes.'];"), 'l’espace insécable avant « ! »');
  /* 20 h 29 : « quand on clique sur schéma, c’est comme un bouton » */
  assert.ok(app.includes("const lien=`<button type=\"button\" class=\"dq-lien\" onclick=\"openSchemaSheet()\">${typeof ED_SCHEMA_SVG==='string'?ED_SCHEMA_SVG:''}schéma</button>`;"));
  assert.ok(cut('function defiConsigneHTML(c,o){', '\n}\n').includes('<p class="defi-ctx">${escCode(defiSituationSeule(c.situation))}</p>${defiAToiHTML()}'), 'au rendu, en salle comme sur la page d’un défi');
  const ctx = vm.createContext({});
  vm.runInContext(cut('const DEFI_A_TOI=', '\nfunction defiConsigneHTML(c,o){').replace(/^const /gm, 'var '), ctx);
  assert.equal(vm.runInContext('defiAToiHTML()', ctx), `<div class="dq-atoi"><b>À toi de jouer${NB}!</b> Tu peux consulter le <button type="button" class="dq-lien" onclick="openSchemaSheet()">schéma</button> de la base à tout moment pour explorer les tables et leurs colonnes.</div>`, '« schéma » ouvre le schéma');
  ctx.ED_SCHEMA_SVG = '<svg/>'; assert.ok(vm.runInContext('defiAToiHTML()', ctx).includes('onclick="openSchemaSheet()"><svg/>schéma</button>'), 'avec son icône');
  for (const r of ['html.lq .consigne.dq .dq-lien{display:inline-flex;align-items:center;gap:4px;margin:0 1px;padding:1px 8px 2px 6px;border:0;border-radius:9px;vertical-align:baseline;',
    'background:var(--accent-soft);color:var(--accent-ink);font:800 15px/1.3 var(--ui);box-shadow:0 2px 0 var(--lip);cursor:pointer;',
    'html.lq .consigne.dq .dq-lien:active{transform:translateY(2px);box-shadow:0 0 0 var(--lip)}',
    'html.lq .consigne.dq .dq-lien::after{content:"";position:absolute;inset:-11px -6px}'])
    assert.ok(css.includes(r), r);
  const data = vm.runInNewContext(app.slice(app.indexOf('const CHALLENGES=['), app.indexOf('const NIV=')) + ';({challenges:CHALLENGES})');
  assert.equal(data.challenges.length, 477);
  for (const c of data.challenges) {
    ctx.s = c.situation;
    const t = vm.runInContext('defiSituationSeule(s)', ctx);
    assert.ok(!t.includes('À toi de jouer'), `${c.id} : l’appel quitte le récit`);
    assert.equal(t, c.situation.replace(/\s*À toi de jouer\s*!$/, '').trim(), `${c.id} : la situation elle-même ne change pas`);
    assert.ok(/[.!?…»)]$/.test(t), `${c.id} : la situation finit sur sa ponctuation`);
  }
  ctx.s = 'Une situation sans la fin habituelle.';
  assert.equal(vm.runInContext('defiSituationSeule(s)', ctx), 'Une situation sans la fin habituelle.', 'une autre fin : rien n’est coupé');
  /* 20 h 22 : « je le veux plus clair » */
  for (const r of ['html.lq .consigne.dq .dq-atoi{margin:12px 0 0;padding:11px 14px 12px;border-radius:14px;background:#FAF9FC;box-shadow:inset 0 0 0 1px #EEECF3;',
    'html.lq .consigne.dq .dq-atoi b{color:var(--ink);font-weight:800}', 'html.lq .consigne.dq>.dq-atoi+.dq-sec{margin-top:14px}'])
    assert.ok(css.includes(r), r);
});

/* Un faux DOM pour « Réagir » et les bulles : la page, le bouton posé en bas à droite, le calque des réactions et ses bulles. */
function monde({ reduit = false, live = ['a', 'b'], solo = false, view = 'play0' } = {}) {
  let T = 1_000_000;
  const later = [], cleared = [], els = {}, sent = [], dits = [], focus = [], ecoute = {};
  const classes = () => { const set = new Set(); return { set, add: k => set.add(k), contains: k => set.has(k), toggle: (k, on) => (on ? set.add(k) : set.delete(k), on) }; };
  const el = tag => {
    const e = { tag, id: '', children: [], style: { p: {}, setProperty(k, v) { this.p[k] = v; } }, dataset: {}, attrs: {}, className: '', textContent: '', isConnected: false, parent: null,
      w: 70, top: 0, h: 0, classList: classes(),
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
      appendChild(c) { this.children.push(c); c.parent = this; c.isConnected = true; if (c.id) els[c.id] = c; return c; },
      append(...cs) { cs.forEach(c => this.appendChild(c)); },
      remove() { if (this.parent) { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; this.isConnected = false; } if (els[this.id] === this) delete els[this.id]; },
      get firstElementChild() { return this.children[0] || null; },
      getBoundingClientRect() { return { width: this.w, top: this.top, height: this.h }; }, focus() { focus.push(this.id || this.tag); } };
    return e;
  };
  const premiere = Object.assign(el('button'), { id: 'premiere' });
  const body = el('body');
  const root = { getBoundingClientRect: () => ({ left: 20, right: 373, width: 353 }) };
  /* Le bouton naît d’un modèle (template) : son HTML est gardé, son bouton intérieur trouvable par son identifiant */
  const template = () => ({ content: { firstElementChild: null }, set innerHTML(h) {
    const f = el('div'); f.id = 'jeu-reagir'; f.html = h; f.top = 690; f.h = 48;
    const b = el('button'); b.id = 'jeu-reagir-b'; els['jeu-reagir-b'] = b; f.bouton = b; this.content.firstElementChild = f; } });
  const document = { body, hidden: false, activeElement: null,
    getElementById: id => (id === 'jeu-root' ? root : els[id] || null),
    querySelector: q => (q === '#jeu-reagir-l button' ? premiere : null), createElement: tag => (tag === 'template' ? template() : el(tag)),
    addEventListener: (k, f) => { ecoute[k] = f; } };
  const J = { me: 'a', solo, view, players: { a: { name: 'Elisa' }, b: { name: '@lea_data' }, c: { name: '@max' } }, lastReact: 0 };
  const ctx = vm.createContext({
    JEU: J, JEU_REACTS: ['👏', '🔥', '😅', '🤯'], document, window: { innerHeight: 800, innerWidth: 393, visualViewport: { offsetTop: 0, height: 500 }, addEventListener: (k, f) => { ecoute['w:' + k] = f; } },
    Date: { now: () => T }, setTimeout: (f, ms) => (later.push([f, ms]), later.length), clearTimeout: k => cleared.push(k),
    prefersReduceMotion: () => reduit, jeuLive: () => live, jeuOrder: () => ['a', 'b', 'c'], jeuNom: v => String(v || '').slice(0, 16),
    jeuSend: m => sent.push(m), jeuToast: t => dits.push(t), buzz: () => {},
  });
  vm.runInContext(cut('const JEU_REAGIR_MS=', '\n/* « Il écrit »').replace(/^(const|let) /gm, 'var ') + '\n' + cut('const JEU_REACT_PAS=', '\n/* Arrivées, départs, nouvel hôte').replace(/^(const|let) /gm, 'var '), ctx);
  return { ctx, J, document, focus, later, cleared, els, sent, dits, body, ecoute, ev: c => vm.runInContext(c, ctx), avance: ms => { T += ms; }, fab: () => els['jeu-reagir'] || null };
}

test('« Réagir » : un bouton posé en bas à droite de l’écran, pendant la manche, dans toute salle (même seule) ; plus dans le cadre', () => {
  const play = cut("}else if(v.startsWith('play')){", "}else if(v.startsWith('res')){");
  assert.ok(!play.includes('jeuReagirHTML') && play.includes('<span class="jeu-hud-box${val?\'\':\' is-seul\'}">${val}${chrono}</span></div>`;'), 'la tête du cadre : la manche, le niveau, ce que vaut le défi | le chrono');
  assert.ok(!cut('function jeuDirectHTML(n,hud){', '\n}\n').includes('reagir'), 'le cadre ne s’en occupe plus');
  const m = monde(), h = m.ev('jeuReagirHTML()');
  assert.ok(h.startsWith('<div class="jeu-reagir" id="jeu-reagir"><button type="button" class="jeu-reagir-b" id="jeu-reagir-b" aria-expanded="false" aria-controls="jeu-reagir-l" aria-label="Réagir" onclick="jeuReagirBasculer(event)">'));
  assert.ok(h.includes('<span>Réagir</span>') && h.includes('class="jeu-reagir-x"'), 'le sourire et « Réagir » ; la croix, cachée tant que c’est fermé');
  assert.equal((h.match(/onclick="jeuReact\('/g) || []).length, 4, 'les quatre réactions');
  assert.ok(h.includes('<span class="jeu-reagir-l" id="jeu-reagir-l" role="group" aria-label="Réactions"><button type="button" style="--i:0" onclick="jeuReact(\'👏\',this)" aria-label="Réagir 👏">👏</button>'));
  assert.ok(app.includes("  const J=JEU,v=String(J&&J.view||''),m=/^(?:play|res)(\\d+)$/.exec(v);") && app.includes("return !!(m&&!(typeof jeuSoloLike==='function'&&jeuSoloLike(+m[1])));"), 'pendant la manche et à ses résultats, dans une salle où l’on n’est pas seul (9 novembre, 7 h 16 ; 15 h 24)');
  assert.equal(m.ev('jeuReagirLa()'), true, 'pendant la manche, à plusieurs');
  assert.equal(monde({ live: ['a'] }).ev('jeuReagirLa()'), true, 'seule dans la salle aussi (19 h 12)');
  assert.equal(monde({ solo: true }).ev('jeuReagirLa()'), false, 'pas en partie seule (« Joue seul »)');
  for (const v of ['lobby', 'draw0']) assert.equal(monde({ view: v }).ev('jeuReagirLa()'), false, v);
  /* 15 h 24 (Elisa : « laisse le Réagir jusqu’au bilan, résultat ») : aux résultats de la manche et sur le podium aussi */
  assert.equal(monde({ view: 'res0' }).ev('jeuReagirLa()'), true, 'résultats de la manche');
  assert.equal(monde({ view: 'final' }).ev('JEU.seulFin=false;jeuReagirLa()'), true, 'podium');
  assert.equal(monde({ view: 'final' }).ev('JEU.seulFin=true;jeuReagirLa()'), false, 'bilan seul : non');
  /* Il suit la salle : à chaque dessin, à chaque tour d’horloge ; on part, il part */
  assert.ok(cut('function jeuRender(){', '\n  J.drawT.forEach(clearTimeout)').includes('jeuReagirMaj();'));
  assert.ok(cut('function jeuTick(){', '\n}\n').includes('jeuReagirMaj();'));
  assert.ok(cut('function jeuStop(){', '\n}\n').includes("document.getElementById('jeu-reagir')?.remove();"));
});

test('« Réagir » posé, salué une fois, effacé pendant qu’on écrit, retiré hors de la manche', () => {
  const m = monde();
  m.ev('jeuReagirMaj()');
  const f = m.fab();
  assert.ok(f && f.parent === m.body, 'posé sur la page (pas dans la manche, qui défile)');
  assert.ok(f.classList.contains('is-neuf'), 'la première fois, son sourire se balance');
  assert.equal(f.style.right, '20px', 'contre le bord droit de la manche');
  assert.ok(m.ecoute.focusin && m.ecoute.focusout, 'il suit le clavier');
  /* On écrit dans l’éditeur : il s’efface, et la rangée ouverte se referme */
  m.ev('jeuReagirBasculer({detail:1})'); assert.ok(f.classList.contains('is-ouvert'));
  m.document.activeElement = { tagName: 'TEXTAREA', id: 'ed-lesson' };
  m.ecoute.focusin(); m.later.at(-1)[0]();
  assert.ok(f.classList.contains('is-ecrit') && !f.classList.contains('is-ouvert'), 'on écrit : effacé, refermé');
  m.document.activeElement = { tagName: 'INPUT', type: 'text' }; m.ev('jeuReagirMaj()'); assert.ok(f.classList.contains('is-ecrit'), 'un autre champ aussi');
  m.document.activeElement = { tagName: 'BUTTON' }; m.ecoute.focusout(); m.later.at(-1)[0]();
  assert.ok(!f.classList.contains('is-ecrit'), 'on a fini d’écrire : il revient');
  /* Une autre manche : le même bouton, sans resaluer ; le bilan : parti */
  f.classList.set.delete('is-neuf'); m.ev('jeuReagirMaj()'); assert.equal(m.fab(), f); assert.ok(!f.classList.contains('is-neuf'));
  /* La pastille « Un coup de patte ? » là : il monte au-dessus d’elle ; partie, il redescend (19 h 49) */
  const pastille = { hidden: false }; m.document.getElementById = (g => id => (id === 'coach-peek' ? pastille : g(id)))(m.document.getElementById);
  m.ev('jeuReagirMaj()'); assert.ok(f.classList.contains('is-haut'));
  pastille.hidden = true; m.ev('jeuReagirMaj()'); assert.ok(!f.classList.contains('is-haut'), 'cachée : il redescend');
  assert.ok(app.includes("const maj=e=>{if(!card.isConnected||!coachEnJeu()){bye();return;}b.hidden=(e?!!e.isIntersecting:true)&&coachPeekVu(cible);coachPeekCaler(b);coachPeekReagir(!b.hidden);};"), 'tout de suite, quand elle se montre ou se cache');
  assert.ok(cut('function coachPeek(card,hint){', '\n}\n').includes('b.remove();coachPeekReagir(false);};'), 'partie : il redescend');
  m.J.view = 'res0'; m.ev('jeuReagirMaj()'); assert.ok(m.fab(), '15 h 24 : aux résultats de la manche, il reste');
  m.J.view = 'lobby'; m.ev('jeuReagirMaj()'); assert.equal(m.fab(), null, 'salle d’attente : retiré');
  m.J.view = 'play1'; m.ev('jeuReagirMaj()'); assert.ok(m.fab() && !m.fab().classList.contains('is-neuf'), 'une fois par partie');
  const s = monde({ solo: true }); s.ev('jeuReagirMaj()'); assert.equal(s.fab(), null, 'partie seule : jamais');
});

test('« Réagir » : touché, il s’ouvre ; une réaction part ; seul, il se referme au bout de 4,5 s ; la croix le referme', () => {
  const m = monde();
  m.ev('jeuReagirMaj()');
  const f = m.fab(), b = m.els['jeu-reagir-b'];
  m.ev('jeuReagirBasculer({detail:1})');
  assert.ok(f.classList.contains('is-ouvert') && b.attrs['aria-expanded'] === 'true', 'ouvert');
  assert.deepEqual(m.focus, [], 'au doigt, le focus ne bouge pas');
  assert.equal(m.later.at(-1)[1], 4500);
  /* Une réaction : envoyée, dite au lecteur d’écran, et la rangée reste ouverte 4,5 s de plus */
  m.ev("jeuReact('🔥')");
  assert.deepEqual(m.sent.map(x => ({ ...x })), [{ t: 'react', e: '🔥' }]); assert.deepEqual(m.dits, ['Toi 🔥']);
  assert.equal(m.later.filter(x => x[1] === 4500).length, 2, 'le compte à rebours repart');
  /* À la chaîne (20 h 07) : chaque touche part, même rapprochée ; l’emoji touché saute ; le lecteur d’écran ne la dit qu’une fois */
  const anims = []; m.ctx.btn = { animate: (k, o) => anims.push(k.map(x => x.transform).join(' ')) };
  m.avance(160); m.ev("jeuReact('🔥',btn)"); m.avance(160); m.ev("jeuReact('🔥',btn)");
  assert.equal(m.sent.length, 3, 'à la chaîne'); assert.deepEqual(m.dits, ['Toi 🔥'], 'dite une fois');
  assert.deepEqual(anims, ['scale(1) scale(1.28) scale(1)', 'scale(1) scale(1.28) scale(1)'], 'l’emoji saute à chaque touche');
  /* Trop rapproché (moins de 150 ms) : rien ne part, le bouton dit non */
  m.avance(100); m.ev("jeuReact('🔥',btn)"); assert.equal(m.sent.length, 3); assert.equal(anims.at(-1), 'none translateX(-3px) translateX(3px) none', 'un petit non de la tête');
  /* Dix au plus en 4 s, pour ne pas inonder la salle */
  for (let i = 0; i < 9; i++) { m.avance(200); m.ev("jeuReact('👏',btn)"); }
  assert.equal(m.sent.length, 10, 'dix en 4 s'); assert.equal(anims.at(-1), 'none translateX(-3px) translateX(3px) none', 'la onzième dit non');
  m.avance(2500); m.ev("jeuReact('👏',btn)"); assert.equal(m.sent.length, 11, 'les plus anciennes sorties de la fenêtre : elle repart');
  m.ev("jeuReact('💩')"); assert.equal(m.sent.length, 11, 'seulement les quatre réactions');
  assert.ok(app.includes('const JEU_REACT_PAS=150,JEU_REACT_RAFALE=10,JEU_REACT_FENETRE=4000;'));
  /* Le temps passe : la rangée se referme seule */
  m.later.filter(x => x[1] === 4500).at(-1)[0]();
  assert.ok(!f.classList.contains('is-ouvert') && b.attrs['aria-expanded'] === 'false');
  /* Au clavier : la première réaction prend le focus ; la croix le rend au bouton */
  m.ev('jeuReagirBasculer({detail:0})'); assert.deepEqual(m.focus, ['premiere']);
  m.ev('jeuReagirBasculer({detail:0})'); assert.deepEqual(m.focus, ['premiere', 'jeu-reagir-b']);
  assert.ok(!f.classList.contains('is-ouvert'));
});

test('les réactions en direct : l’emoji et le pseudo montent juste au-dessus de « Réagir », la sienne aussi (« Toi »)', () => {
  const m = monde();
  m.ev('jeuReagirMaj()');
  assert.equal(m.ev("jeuReactBulle('b','🔥','@lea_data')"), true);
  const c = m.els['jeu-rl'];
  assert.ok(c && c.className === 'jeu-rl' && c.attrs['aria-hidden'] === 'true', 'un calque, hors de la lecture (le lecteur d’écran l’entend déjà)');
  assert.equal(m.body.children.includes(c), true, 'sur la page, hors de la manche : visible où qu’on soit');
  assert.deepEqual([c.style.top, c.style.right], ['680px', '20px'], 'juste au-dessus du bouton « Réagir », contre le bord de la manche');
  const b = c.children[0];
  assert.equal(b.className, 'jeu-rl-b');
  assert.deepEqual(b.children.map(x => [x.tag, x.className, x.textContent]), [['i', 'jeu-rl-e', '🔥'], ['b', 'jeu-rl-n', '@lea_data']]);
  assert.equal(b.children[1].dataset.c, '1', 'le pseudo sur la couleur de son avatar');
  assert.deepEqual([b.style.p['--x'], b.style.p['--y']], ['0px', '0px'], 'contre le bord');
  /* La sienne, juste après : à gauche de la précédente, sans la cacher */
  m.avance(400); m.ev("jeuReact('👏')");
  const t = c.children[1];
  assert.deepEqual(t.children.map(x => x.textContent), ['👏', 'Toi']);
  assert.equal(t.style.p['--x'], '-80px');
  m.avance(300); m.ev("jeuReactBulle('c','😅')"); assert.equal(c.children[2].style.p['--x'], '-160px');
  m.avance(300); m.ev("jeuReactBulle('b','🤯')"); assert.deepEqual([c.children[3].style.p['--x'], c.children[3].style.p['--y']], ['0px', '-84px'], 'trop loin du bord : un étage au-dessus');
  m.avance(2000); m.ev("jeuReactBulle('c','🔥')"); assert.deepEqual([c.children[4].style.p['--x'], c.children[4].style.p['--y']], ['0px', '0px'], 'plus tard : de nouveau contre le bord');
  /* Elle passe et s’efface : 2,9 s, puis partie ; six au plus à la fois */
  const fin = m.later.filter(x => x[1] === 2900); assert.equal(fin.length, 5);
  fin[0][0](); assert.equal(c.children.length, 4);
  while (c.children.length < 14) { m.avance(100); m.ev("jeuReactBulle('b','👏')"); }
  m.ev("jeuReactBulle('b','👏')"); assert.equal(c.children.length, 14, 'quatorze au plus : la plus ancienne laisse sa place');
  /* On écrit (« Réagir » effacé) : elles montent au-dessus du clavier */
  m.fab().classList.add('is-ecrit'); m.avance(3000); m.ev("jeuReactBulle('b','👏')"); assert.equal(c.style.top, '414px');
  /* Ni hors de la salle, ni écran caché */
  const n = monde(); n.ctx.document.getElementById = () => null;
  assert.equal(n.ev("jeuReactBulle('b','🔥')"), false);
  const o = monde(); o.ctx.document.hidden = true; assert.equal(o.ev("jeuReactBulle('b','🔥')"), false);
  /* En mouvement réduit : la précédente reste là 2,8 s, la suivante se met à côté */
  const r = monde({ reduit: true });
  r.ev("jeuReactBulle('b','🔥')"); r.avance(2000); r.ev("jeuReactBulle('c','👏')");
  assert.equal(r.els['jeu-rl'].children[1].style.p['--x'], '-80px');
});

test('reçue d’un autre : de son avatar et le long de l’écran ; la carte « Trouvé » garde ses réactions ; on part, elles partent', () => {
  const react = cut("    case 'react':", "    case 'rate':{");
  assert.ok(react.includes('if(JEU_REACTS.includes(m.e)&&J.synced&&!replay&&!mine){const suite=jeuReactSuite(m.pid);if(!suite)jeuToast(`${name} ${m.e}`);jeuReactPop(m.pid,m.e);jeuReactBulle(m.pid,m.e,name,suite);}'), 'à la chaîne, dite une fois');
  const f = cut('function jeuFoundHTML(r,pid){', '\nfunction jeuCountUp(el){');
  assert.ok(f.includes("${JEU_REACTS.map(e=>`<button type=\"button\" onclick=\"jeuReact('${e}',this)\" aria-label=\"Réagir ${e}\">${e}</button>`).join('')}"));
  const stop = cut('function jeuStop(){', '\n}\n');
  assert.ok(stop.includes('clearTimeout(J.reagirT);') && stop.includes("document.getElementById('jeu-rl')?.remove();"));
});

test('le style : « Réagir », la pastille de verre à contour soleil posée en bas à droite ; effacé quand on écrit ; au-dessus de « Un coup de patte ? »', () => {
  for (const r of ['html.lq .jeu-reagir{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:calc(var(--safe-bottom,0px) + 22px);z-index:91;',
    'html.lq .jeu-reagir.is-ecrit{opacity:0;visibility:hidden;translate:0 18px;pointer-events:none;',
    'html.lq .jeu-reagir.is-haut:not(.is-ecrit){translate:0 -58px}', 'html.lq body:has(.viz.on) .jeu-reagir{opacity:0;visibility:hidden;pointer-events:none}',
    'html.lq body:has(>.jeu-reagir) #jeu-root{padding-bottom:76px}',
    /* 19 h 57 : « mets le bouton Réagir en plus fin » */
    'gap:6px;height:38px;margin:0;padding:0 14px 0 10px;border:2px solid var(--sun);border-radius:999px;',
    /* 20 h 39 : « style glass et contour orange comme la DA de l’appli » ; 21 h 13 : « je voulais dire ce jaune » (« l’ordre compte ») */
    'background:linear-gradient(180deg,rgba(255,255,255,.86),rgba(255,255,255,.64));-webkit-backdrop-filter:blur(14px) saturate(1.8);backdrop-filter:blur(14px) saturate(1.8);',
    'color:var(--ink);font:800 13.5px/1 var(--display);box-shadow:inset 0 1px 0 #fff,0 3px 0 var(--sun-lip),0 10px 22px -12px rgba(224,161,0,.55);',
    'html.lq .jeu-reagir-b:active{transform:translateY(2px);box-shadow:inset 0 1px 0 #fff,0 1px 0 var(--sun-lip),0 6px 14px -10px rgba(224,161,0,.55)}',
    'html.lq .jeu-reagir-b>svg{flex:none;width:18px;height:18px;color:var(--ink)}', 'html.lq .jeu-reagir-b>svg>circle:first-child{fill:var(--sun)}',
    'html.lq .jeu-reagir-b>.jeu-reagir-x{display:none;width:15px;height:15px;color:var(--ink)}', 'outline:3px solid var(--accent);outline-offset:2px}',
    'box-shadow:inset 0 0 0 2px #FBE5A6,0 4px 0 #F2D78B,0 14px 28px -14px rgba(27,22,64,.45)}', 'html.lq .jeu-reagir-l button:active{transform:scale(.84);background:var(--sun-soft)}',
    'html.lq .jeu-reagir.is-ouvert .jeu-reagir-b{width:38px;padding:0}',
    'html.lq .jeu-reagir.is-ouvert .jeu-reagir-b>.jeu-reagir-x{display:block}',
    'html.lq .jeu-reagir.is-ouvert .jeu-reagir-l{display:flex;transform-origin:right center;animation:jeuReagirTray .32s cubic-bezier(.3,1.35,.5,1) backwards}',
    'html.lq .jeu-reagir.is-neuf .jeu-reagir-b>svg:first-child{animation:jeuReagirSalut 1.3s ease-in-out .9s 2}',
    '@media (prefers-reduced-motion:reduce){html.lq .jeu-reagir,html.lq .jeu-reagir *{transition:none!important;animation:none!important}}',
    'html.lq .jeu-rl{position:fixed;top:64%;right:max(16px,env(safe-area-inset-right));z-index:8990;width:0;height:0;pointer-events:none}',
    'translate:var(--x,0px) var(--y,0px);\n  animation:jeuRl 2.8s cubic-bezier(.22,.7,.3,1) both}',
    'html.lq .jeu-rl-n[data-c="3"]{background:hsl(338 70% 52%)}', '@keyframes jeuRl{0%{opacity:0;transform:translateY(16px) scale(.35)}',
    '@media (prefers-reduced-motion:reduce){html.lq .jeu-rl-b{animation:jeuRlCalme 2.8s ease both}}', 'html.lq[data-motion="reduce"] .jeu-rl-b{animation:jeuRlCalme 2.8s ease both}'])
    assert.ok(css.includes(r), r);
  assert.ok(!css.includes('#jeu-root .jeu-reagir') && !css.includes('has-reagir'), 'plus rien de « Réagir » dans le cadre');
  /* 19 h 49 : « faire en sorte que la pill Réagir soit au-dessus » : devant la pastille « Un coup de patte ? » (z-index 90) */
  assert.ok(/html\.lq \.coach-peek\{[^}]*z-index:90;/.test(css));
  /* Le salut ne joue que deux fois, puis le sourire se tait (pas d’animation sans fin) */
  assert.ok(!/jeuReagir\w*[^;}]*infinite/.test(css));
});

test('à la chaîne (20 h 07) : les suivantes d’un joueur montent en grappe derrière la première, sans redire le pseudo', () => {
  const m = monde();
  m.ev('jeuReagirMaj()');
  /* La suite : moins de 1,2 s après la précédente du même joueur */
  assert.equal(m.ev("jeuReactSuite('b')"), false); m.avance(500); assert.equal(m.ev("jeuReactSuite('b')"), true);
  m.avance(1300); assert.equal(m.ev("jeuReactSuite('b')"), false, 'après 1,2 s : une nouvelle chaîne'); assert.equal(m.ev("jeuReactSuite('c')"), false, 'chacun la sienne');
  const n = monde(); n.ev('jeuReagirMaj()');
  n.ev("jeuReactBulle('b','🔥','@lea_data',false)");
  const c = n.els['jeu-rl'], tete = c.children[0];
  for (let i = 0; i < 3; i++) { n.avance(250); n.ev("jeuReactBulle('b','🔥','@lea_data',true)"); }
  const suites = c.children.slice(1);
  assert.deepEqual(suites.map(b => b.className), ['jeu-rl-b is-suite', 'jeu-rl-b is-suite', 'jeu-rl-b is-suite']);
  assert.ok(suites.every(b => b.children.length === 1 && b.children[0].textContent === '🔥'), 'l’emoji seul, sans le pseudo (déjà dit)');
  assert.ok(suites.every(b => Math.abs(parseInt(b.style.p['--x'], 10)) <= 12 && b.style.p['--y'] === '0px'), 'de la place de la première, un rien de côté');
  /* Un autre joueur réagit pendant la grappe : il se met à côté d’elle */
  n.avance(200); n.ev("jeuReactBulle('c','👏','@max',false)");
  assert.equal(c.children.at(-1).style.p['--x'], '-80px');
  /* La première partie (2,9 s), la suivante redit le pseudo */
  tete.remove(); n.avance(300); n.ev("jeuReactBulle('b','🔥','@lea_data',true)");
  assert.equal(c.children.at(-1).className, 'jeu-rl-b'); assert.equal(c.children.at(-1).children[1].textContent, '@lea_data');
  assert.ok(css.includes('html.lq .jeu-rl-b.is-suite .jeu-rl-e{width:42px;height:42px;font-size:23px}'));
});

/* 21 h 29 : « comme les réactions : mets les … avec le pseudo si quelqu’un écrit, couronne avec le pseudo si quelqu’un a réussi, et
   validé (icône) avec le pseudo » */
test('les bulles d’état montent comme les réactions : les …, la couronne, la coche, avec le pseudo ; les … une fois toutes les 15 s', () => {
  const m = monde();
  Object.assign(m.ctx, { JEU_COURONNE_SVG: '<svg class="roi"/>', JEU_ICO: { check: '<svg class="ok"/>' } });
  assert.equal(m.ev("jeuStatutBulle('b','ecrit')"), true);
  const c = m.els['jeu-rl'], b0 = c.children[0];
  assert.equal(b0.className, 'jeu-rl-b is-ecrit'); assert.equal(b0.children[0].innerHTML, '<b></b><b></b><b></b>', 'les trois petits points');
  assert.equal(b0.children[1].textContent, '@lea_data', 'son pseudo dessous, sur sa couleur');
  assert.equal(m.ev("jeuStatutBulle('b','ecrit')"), false, 'il écrit encore : pas une bulle à chaque signal');
  m.avance(15000); assert.equal(m.ev("jeuStatutBulle('b','ecrit')"), true, '15 s plus tard, oui');
  m.avance(3000); m.ev("jeuStatutBulle('c','roi')");
  const roi = c.children[c.children.length - 1];
  assert.equal(roi.className, 'jeu-rl-b is-roi'); assert.equal(roi.children[0].innerHTML, '<svg class="roi"/>'); assert.equal(roi.children[1].textContent, '@max');
  m.avance(3000); m.ev("jeuStatutBulle('b','ok')");
  const ok = c.children[c.children.length - 1];
  assert.equal(ok.className, 'jeu-rl-b is-ok'); assert.equal(ok.children[0].innerHTML, '<svg class="ok"/>');
  /* Une réaction de c juste après sa couronne : elle ne s’y accroche pas (la bulle d’état n’est pas une grappe) */
  assert.equal(m.J.rlPos && m.J.rlPos.c, undefined, 'la bulle d’état ne devient pas la tête d’une chaîne');
  const fn = cut('function jeuReactBulle(pid,e,nom,suite,quoi){', '\n}\n');
  assert.ok(fn.includes("const chaine=!!(!quoi&&suite&&Q&&Q.el&&Q.el.isConnected);") && fn.includes("if(quoi)i.innerHTML=quoi.html;else i.textContent=e;"));
  for (const k of ['html.lq .jeu-rl-b.is-ecrit .jeu-rl-e>b{flex:none;width:7px;height:7px;border-radius:50%;background:var(--accent);animation:jeuRlPoint 1s ease-in-out infinite}',
    'html.lq .jeu-rl-b.is-roi .jeu-rl-e svg{width:32px;height:32px}', 'html.lq .jeu-rl-b.is-ok .jeu-rl-e{color:#1E9E62}',
    'html.lq[data-motion="reduce"] .jeu-rl-b.is-ecrit .jeu-rl-e>b{animation:none;opacity:1}'])
    assert.ok(css.includes(k), k);
});
