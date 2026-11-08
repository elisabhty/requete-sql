/* Elisa, 8 novembre, 18 h 36 (capture d’une manche seule) : « Le pill base le mettre entre l’intérieur et l’extérieur du cadre genre
   poser en haut à droite / Comment faire les réactions ? De plus voir la réaction des autres en temps réel sur l’écran avec leur
   pseudo / Mettre toujours : « À toi de jouer ! Tu peux consulter le schéma de la base à tout moment pour explorer les tables et leurs
   colonnes. » ».
   - La base : une pastille posée à cheval sur le bord du cadre de « La situation », en haut à droite.
   - Réagir : avant, les quatre réactions n’apparaissaient qu’une fois la réponse trouvée, et à plusieurs. Maintenant, à plusieurs,
     « Réagir » au bout de la ligne du niveau, dans le cadre de la manche, un seul bouton (31 octobre : « trop de boutons ») qui ouvre
     les quatre ; chaque réaction, la sienne comme celles des autres, monte le long du bord de l’écran avec le pseudo.
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
  assert.ok(f.includes('return `<div class="consigne dq${base?\' has-base\':\'\'}">${base}<span class="tag">La situation</span>'));
  assert.ok(!app.includes('dq-tete'), 'plus de rangée « La situation » + base');
  for (const r of ['html.lq .consigne.dq.has-base{position:relative;margin-top:30px}',
    'html.lq .consigne.dq .dq-chip.is-base{position:absolute;top:-1px;right:16px;z-index:1;max-width:calc(100% - 32px);',
    'background:var(--accent);color:#fff;box-shadow:0 3px 0 var(--accent-lip);text-overflow:ellipsis;translate:0 -50%;rotate:-2.5deg}'])
    assert.ok(css.includes(r), r);
  assert.ok(!/\.dq-tete/.test(css), 'les règles de l’ancienne rangée sont parties');
  /* Rendu : en salle la pastille, sur la page d’un défi rien (la base y est dans la barre du haut) */
  const ctx = vm.createContext({ esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), escCode: s => String(s), DEFI_BASES: { zoo: { nom: 'Zoo' } } });
  vm.runInContext(cut('const DEFI_A_TOI=', '\nfunction defiConsigneHTML(c,o){') + '\n' + f + '\n}', ctx);
  ctx.c = { base: 'zoo', situation: `Au zoo, Raoul veut savoir. À toi de jouer${NB}!`, affiche: ['le nom'], garde: [], ordered: false };
  const salle = vm.runInContext('defiConsigneHTML(c,{base:true})', ctx), seul = vm.runInContext('defiConsigneHTML(c)', ctx);
  assert.ok(salle.startsWith('<div class="consigne dq has-base"><span class="dq-chip is-base">Base Zoo</span><span class="tag">La situation</span><p class="defi-ctx">'));
  assert.ok(seul.startsWith('<div class="consigne dq"><span class="tag">La situation</span><p class="defi-ctx">') && !seul.includes('is-base'));
});

test('la situation finit toujours sur « À toi de jouer ! Tu peux consulter le schéma… », une seule fois', () => {
  assert.ok(app.includes(`const DEFI_A_TOI='${PHRASE}';`), 'l’espace insécable avant « ! »');
  assert.ok(cut('function defiConsigneHTML(c,o){', '\n}\n').includes('<p class="defi-ctx">${escCode(defiSituation(c.situation))}</p>'), 'au rendu, en salle comme sur la page d’un défi');
  const ctx = vm.createContext({});
  vm.runInContext(cut('const DEFI_A_TOI=', '\nfunction defiConsigneHTML(c,o){').replace(/^const /gm, 'var '), ctx);
  const data = vm.runInNewContext(app.slice(app.indexOf('const CHALLENGES=['), app.indexOf('const NIV=')) + ';({challenges:CHALLENGES})');
  assert.equal(data.challenges.length, 477);
  for (const c of data.challenges) {
    ctx.s = c.situation;
    const t = vm.runInContext('defiSituation(s)', ctx);
    assert.ok(t.endsWith(' ' + PHRASE), `${c.id} : la phrase pour finir`);
    assert.equal(t.split('À toi de jouer').length, 2, `${c.id} : « À toi de jouer » une seule fois`);
    assert.equal(t.slice(0, -PHRASE.length).trim(), c.situation.replace(/\s*À toi de jouer\s*!$/, '').trim(), `${c.id} : la situation elle-même ne change pas`);
  }
  ctx.s = 'Une situation sans la fin habituelle.';
  assert.equal(vm.runInContext('defiSituation(s)', ctx), 'Une situation sans la fin habituelle. ' + PHRASE, 'une autre fin : la phrase s’ajoute aussi');
});

/* Un faux DOM pour « Réagir » et les bulles : le cadre (ses classes), le bouton, le calque des réactions et ses bulles. */
function monde({ reduit = false, live = ['a', 'b'], solo = false } = {}) {
  let T = 1_000_000;
  const later = [], cleared = [], els = {}, sent = [], dits = [];
  const classes = () => { const set = new Set(); return { set, add: k => set.add(k), contains: k => set.has(k), toggle: (k, on) => (on ? set.add(k) : set.delete(k), on) }; };
  const el = tag => {
    const e = { tag, id: '', children: [], style: { p: {}, setProperty(k, v) { this.p[k] = v; } }, dataset: {}, attrs: {}, className: '', textContent: '', isConnected: false, parent: null, w: 70,
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
      appendChild(c) { this.children.push(c); c.parent = this; c.isConnected = true; if (c.id) els[c.id] = c; return c; },
      append(...cs) { cs.forEach(c => this.appendChild(c)); },
      remove() { if (this.parent) { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; this.isConnected = false; } if (els[this.id] === this) delete els[this.id]; },
      get firstElementChild() { return this.children[0] || null; },
      getBoundingClientRect() { return { width: this.w }; }, focus() { focus.push(this.id || this.tag); } };
    return e;
  };
  const focus = [];
  const section = Object.assign(el('section'), { id: 'jeu-direct', classList: classes() });
  const bouton = Object.assign(el('button'), { id: 'jeu-reagir-b' });
  const premiere = Object.assign(el('button'), { id: 'premiere' });
  const body = el('body');
  const document = { body, hidden: false, activeElement: null,
    getElementById: id => id === 'jeu-root' ? {} : id === 'jeu-direct' ? section : id === 'jeu-reagir-b' ? bouton : els[id] || null,
    querySelector: q => q === '#jeu-reagir-l button' ? premiere : null, createElement: el };
  const J = { me: 'a', solo, players: { a: { name: 'Elisa' }, b: { name: '@lea_data' }, c: { name: '@max' } }, lastReact: 0 };
  const ctx = vm.createContext({
    JEU: J, JEU_REACTS: ['👏', '🔥', '😅', '🤯'], document, window: { innerHeight: 800, visualViewport: { offsetTop: 0, height: 500 } },
    Date: { now: () => T }, setTimeout: (f, ms) => (later.push([f, ms]), later.length), clearTimeout: k => cleared.push(k),
    prefersReduceMotion: () => reduit, jeuLive: () => live, jeuOrder: () => ['a', 'b', 'c'], jeuNom: v => String(v || '').slice(0, 16),
    jeuSend: m => sent.push(m), jeuToast: t => dits.push(t), buzz: () => {},
  });
  vm.runInContext(cut('const JEU_REAGIR_MS=', '\n/* « Il écrit »').replace(/^const /gm, 'var ') + '\n' + cut('function jeuReact(e,btn){', '\n}\n') + '\n}', ctx);
  return { ctx, J, section, bouton, focus, later, cleared, els, sent, dits, body, ev: c => vm.runInContext(c, ctx), avance: ms => { T += ms; } };
}

test('« Réagir » : un seul bouton dans la ligne du niveau, à plusieurs ; il ouvre les quatre réactions', () => {
  const play = cut("}else if(v.startsWith('play')){", "}else if(v.startsWith('res')){");
  assert.ok(play.includes("`<span class=\"jeu-hud-niv\"><span class=\"dx-f-niv is-${c.niv}\">${jeuNivBars(c.niv)}${JEU_NIVL[c.niv]}</span>${J.solo?'':jeuReagirHTML()}</span></div>`"), 'au bout de la ligne du niveau ; pas en partie seule');
  const m = monde(), h = m.ev('jeuReagirHTML()');
  assert.ok(h.startsWith('<span class="jeu-reagir" id="jeu-reagir"><button type="button" class="jeu-reagir-b" id="jeu-reagir-b" aria-expanded="false" aria-controls="jeu-reagir-l" aria-label="Réagir" onclick="jeuReagirBasculer(event)">'));
  assert.ok(h.includes('<span>Réagir</span>') && h.includes('class="jeu-reagir-x"'), 'le sourire et « Réagir » ; la croix, cachée tant que c’est fermé');
  assert.equal((h.match(/onclick="jeuReact\('/g) || []).length, 4, 'les quatre réactions');
  assert.ok(h.includes('<span class="jeu-reagir-l" id="jeu-reagir-l" role="group" aria-label="Réactions"><button type="button" style="--i:0" onclick="jeuReact(\'👏\',this)" aria-label="Réagir 👏">👏</button>'));
  /* Le cadre ne le montre qu’à plusieurs ; la première fois de la partie, son sourire se balance */
  const d = cut('function jeuDirectHTML(n,hud){', '\n}\n');
  assert.ok(d.includes('const reagir=jeuReagirLa(),neuf=reagir&&!J.reagirVu;if(neuf)J.reagirVu=1;'));
  assert.ok(d.includes("${reagir?' has-reagir':''}${reagir&&J.reagir?' is-reagir':''}${neuf?' is-reagir-neuf':''}\" id=\"jeu-direct\""));
  assert.equal(m.ev('jeuReagirLa()'), true);
  assert.equal(monde({ live: ['a'] }).ev('jeuReagirLa()'), false, 'seul dans la salle : personne pour voir');
  assert.equal(monde({ solo: true }).ev('jeuReagirLa()'), false, 'partie seule');
});

test('« Réagir » : touché, il s’ouvre ; une réaction part ; seul, il se referme au bout de 4,5 s ; la croix le referme', () => {
  const m = monde();
  m.ev('jeuReagirBasculer({detail:1})');
  assert.ok(m.section.classList.contains('is-reagir') && m.bouton.attrs['aria-expanded'] === 'true', 'ouvert');
  assert.deepEqual(m.focus, [], 'au doigt, le focus ne bouge pas');
  const [ferme, ms] = m.later.at(-1); assert.equal(ms, 4500);
  /* Une réaction : envoyée, dite au lecteur d’écran, et la ligne reste ouverte 4,5 s de plus */
  m.ev("jeuReact('🔥')");
  assert.deepEqual(m.sent.map(x => ({ ...x })), [{ t: 'react', e: '🔥' }]); assert.deepEqual(m.dits, ['Toi 🔥']);
  assert.equal(m.later.filter(x => x[1] === 4500).length, 2, 'le compte à rebours repart');
  /* Trop tôt (moins de 1,5 s) : rien ne part, le bouton dit non */
  const anims = []; m.ctx.btn = { animate: (k, o) => anims.push([k, o]) };
  m.avance(800); m.ev("jeuReact('👏',btn)"); assert.equal(m.sent.length, 1); assert.equal(anims.length, 1, 'un petit non de la tête');
  m.avance(800); m.ev("jeuReact('👏',btn)"); assert.equal(m.sent.length, 2, 'après 1,5 s, elle part');
  m.ev("jeuReact('💩')"); assert.equal(m.sent.length, 2, 'seulement les quatre réactions');
  /* Le temps passe : la ligne se referme seule */
  m.later.filter(x => x[1] === 4500).at(-1)[0]();
  assert.ok(!m.section.classList.contains('is-reagir') && m.bouton.attrs['aria-expanded'] === 'false');
  /* Au clavier : la première réaction prend le focus ; la croix le rend au bouton */
  m.ev('jeuReagirBasculer({detail:0})'); assert.deepEqual(m.focus, ['premiere']);
  m.ev('jeuReagirBasculer({detail:0})'); assert.deepEqual(m.focus, ['premiere', 'jeu-reagir-b']);
  assert.ok(!m.section.classList.contains('is-reagir'));
  assert.equal(typeof ferme, 'function');
});

test('« Réagir » suit la salle : il apparaît quand quelqu’un arrive (son sourire salue une fois), disparaît quand on reste seul', () => {
  const m = monde({ live: ['a'] });
  m.ev('jeuReagirMaj()'); assert.ok(!m.section.classList.contains('has-reagir'));
  m.ctx.jeuLive = () => ['a', 'b'];
  m.ev('jeuReagirMaj()');
  assert.ok(m.section.classList.contains('has-reagir') && m.section.classList.contains('is-reagir-neuf'));
  m.section.classList.set.delete('is-reagir-neuf');
  m.ev('jeuReagirBasculer({detail:1})');
  m.ctx.jeuLive = () => ['a'];
  m.ev('jeuReagirMaj()'); assert.ok(!m.section.classList.contains('has-reagir') && !m.section.classList.contains('is-reagir'), 'seul : caché et refermé');
  m.ctx.jeuLive = () => ['a', 'c'];
  m.ev('jeuReagirMaj()'); assert.ok(m.section.classList.contains('has-reagir') && !m.section.classList.contains('is-reagir-neuf'), 'une fois par partie');
  assert.ok(cut('function jeuDirectPeindre(n){', '\n}\n').includes('const J=JEU;if(!J)return;\n  jeuReagirMaj();'), 'à chaque tour d’horloge');
});

test('les réactions en direct : l’emoji et le pseudo montent le long du bord de l’écran, la sienne aussi (« Toi »)', () => {
  const m = monde();
  assert.equal(m.ev("jeuReactBulle('b','🔥','@lea_data')"), true);
  const c = m.els['jeu-rl'];
  assert.ok(c && c.className === 'jeu-rl' && c.attrs['aria-hidden'] === 'true', 'un calque, hors de la lecture (le lecteur d’écran l’entend déjà)');
  assert.equal(m.body.children[0], c, 'sur la page, hors de la manche : visible où qu’on soit');
  assert.equal(c.style.top, '320px', 'aux deux tiers de ce qu’on voit (au-dessus du clavier)');
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
  for (let i = 0; i < 4; i++) { m.avance(100); m.ev("jeuReactBulle('b','👏')"); }
  assert.equal(c.children.length, 6);
  m.ev("jeuReactBulle('b','👏')"); assert.equal(c.children.length, 6, 'la plus ancienne laisse sa place');
  /* Ni hors de la salle, ni écran caché */
  const n = monde(); n.ctx.document.getElementById = id => null;
  assert.equal(n.ev("jeuReactBulle('b','🔥')"), false);
  const o = monde(); o.ctx.document.hidden = true; assert.equal(o.ev("jeuReactBulle('b','🔥')"), false);
  /* En mouvement réduit : la précédente reste là 2,8 s, la suivante se met à côté */
  const r = monde({ reduit: true });
  r.ev("jeuReactBulle('b','🔥')"); r.avance(2000); r.ev("jeuReactBulle('c','👏')");
  assert.equal(r.els['jeu-rl'].children[1].style.p['--x'], '-80px');
});

test('reçue d’un autre : de son avatar et le long de l’écran ; la carte « Trouvé » garde ses réactions ; on part, elles partent', () => {
  const react = cut("    case 'react':", "    case 'rate':{");
  assert.ok(react.includes('if(JEU_REACTS.includes(m.e)&&J.synced&&!replay&&!mine){jeuToast(`${name} ${m.e}`);jeuReactPop(m.pid,m.e);jeuReactBulle(m.pid,m.e,name);}'));
  const f = cut('function jeuFoundHTML(r,pid){', '\nfunction jeuCountUp(el){');
  assert.ok(f.includes("${JEU_REACTS.map(e=>`<button type=\"button\" onclick=\"jeuReact('${e}',this)\" aria-label=\"Réagir ${e}\">${e}</button>`).join('')}"));
  const stop = cut('function jeuStop(){', '\n}\n');
  assert.ok(stop.includes('clearTimeout(J.reagirT);') && stop.includes("document.getElementById('jeu-rl')?.remove();"));
});

test('le style : « Réagir » en verre dans le cadre, les réactions en pastilles blanches ; les bulles par-dessus tout, sans rien bloquer', () => {
  for (const r of ['html.lq #jeu-root .jeu-reagir{display:none;', 'html.lq #jeu-root .jeu-direct.has-reagir .jeu-reagir{display:flex}',
    'background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.3);color:#fff;font:800 13px/1 var(--display);',
    'html.lq #jeu-root .jeu-reagir-b>svg{flex:none;width:19px;height:19px;color:var(--sun-hi)}',
    'html.lq #jeu-root .jeu-direct.is-reagir .jeu-hud-niv>.dx-f-niv{display:none}', 'html.lq #jeu-root .jeu-direct.is-reagir .jeu-reagir-l{display:flex}',
    'html.lq #jeu-root .jeu-direct.is-reagir .jeu-reagir-l button{animation:jeuReagirIn .42s cubic-bezier(.3,1.5,.5,1) calc(var(--i,0)*55ms) backwards}',
    'html.lq #jeu-root .jeu-direct.is-reagir-neuf .jeu-reagir-b>svg:first-child{animation:jeuReagirSalut 1.3s ease-in-out .7s 2}',
    'html.lq .jeu-rl{position:fixed;top:64%;right:max(16px,env(safe-area-inset-right));z-index:8990;width:0;height:0;pointer-events:none}',
    'translate:var(--x,0px) var(--y,0px);\n  animation:jeuRl 2.8s cubic-bezier(.22,.7,.3,1) both}',
    'html.lq .jeu-rl-n[data-c="3"]{background:hsl(338 70% 52%)}', '@keyframes jeuRl{0%{opacity:0;transform:translateY(16px) scale(.35)}',
    '@media (prefers-reduced-motion:reduce){html.lq .jeu-rl-b{animation:jeuRlCalme 2.8s ease both}}', 'html.lq[data-motion="reduce"] .jeu-rl-b{animation:jeuRlCalme 2.8s ease both}',
    'html.lq[data-motion="reduce"] #jeu-root .jeu-direct.is-reagir .jeu-reagir-l button,html.lq[data-motion="reduce"] #jeu-root .jeu-direct.is-reagir-neuf .jeu-reagir-b>svg:first-child{animation:none}'])
    assert.ok(css.includes(r), r);
  /* Le salut ne joue que deux fois, puis le sourire se tait (pas d’animation sans fin) */
  assert.ok(!/jeuReagir\w*[^;}]*infinite/.test(css));
});
