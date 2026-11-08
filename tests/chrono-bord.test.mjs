/* Elisa, 8 novembre, 19 h 18 : « J’ai pas le message un coup de patte • voir l’indice / Et le chrono le mettre comme la pill du cadre
   entre l’intérieur et l’extérieur » ; 19 h 27, avec sa capture de 18 h 16 (la pastille violette « Pas encore · voir l’indice » en bas
   de l’écran) : « je parle de ça, le message en bas ».
   - Le chrono sort du bandeau de la manche : posé à cheval sur son bord, en haut à droite, comme la base sur « La situation ».
   - La pastille du bas dit toujours « Un coup de patte ? » (un indice arrivé sans essai raté disait « Nouvel indice · le voir ») ; elle
     se montre tant que ce qu’elle annonce n’est pas vu en entier, et se pose au-dessus du clavier. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('le chrono hors du bandeau, juste avant lui dans la section, en salle comme seule', () => {
  const play = cut("}else if(v.startsWith('play')){", "}else if(v.startsWith('res')){");
  assert.ok(!/<span class="jeu-hud-r">\$\{val\}<b class="jeu-timer/.test(play), 'plus dans la tête du bandeau');
  assert.ok(play.includes('const chrono=`<b class="jeu-timer${dur0-took0<30000?\' is-low\':\'\'}" id="jeu-timer" role="timer" aria-label="Temps restant de la manche">${jeuRebours(dur0-took0,dur0)}</b>`;'));
  assert.ok(play.includes('<section class="jeu-direct is-seul" aria-label="Manche ${n+1} sur ${J.nb}">${chrono}<div class="jeu-direct-bande">${hud}</div></section>`:jeuDirectHTML(n,hud,chrono)}'));
  assert.ok(cut('function jeuDirectHTML(n,hud,chrono){', '\n}\n').includes('aria-labelledby="jeu-direct-t">${chrono||\'\'}<div class="jeu-direct-bande">${hud||\'\'}`+'));
  /* Il garde son identifiant : chaque seconde le tient à jour, rouge les 30 dernières */
  assert.ok(cut('function jeuTick(){', '\n}\n').includes("el=document.getElementById('jeu-timer')"));
  assert.equal((app.match(/id="jeu-timer"/g) || []).length, 1);
});

test('le style : à cheval sur le bord, en haut à droite, un rien penché ; le cadre lui fait de la place, dedans et dehors', () => {
  for (const r of ['html.lq #jeu-root .jeu-direct:has(>.jeu-timer){margin-top:32px}',
    'html.lq #jeu-root .jeu-direct>.jeu-timer{position:absolute;top:0;right:16px;z-index:3;height:34px;box-sizing:border-box;padding:0 13px 0 11px!important;',
    'font-size:17px!important;box-shadow:0 3px 0 #C98F00;translate:0 -50%;rotate:-2deg}', 'html.lq #jeu-root .jeu-direct>.jeu-timer.is-low{box-shadow:0 3px 0 #B8323A}',
    'html.lq #jeu-root .jeu-direct:has(>.jeu-timer) .jeu-hud{padding-top:30px}',
    '  html.lq #jeu-root .jeu-direct>.jeu-timer{right:12px;padding:0 11px 0 9px!important;font-size:16px!important}',
    '  html.lq #jeu-root .jeu-direct:has(>.jeu-timer) .jeu-hud{padding-top:28px}}'])
    assert.ok(css.includes(r), r);
  assert.ok(!css.includes('.jeu-hud .jeu-timer'), 'les règles du chrono dans la tête sont parties');
  /* Le bandeau coupe ce qui dépasse (ses coins arrondis, sa grille) : le chrono n’est donc pas dedans */
  assert.ok(css.includes('html.lq #jeu-root .jeu-direct-bande{position:relative;z-index:1;isolation:isolate;overflow:hidden;'));
  assert.ok(css.includes('html.lq #jeu-root .jeu-direct{position:relative;'), 'la section le place');
});

/* La pastille du bas, dans un faux écran : la fenêtre (et ce qu’on en voit, clavier compris), la barre du haut, la carte et ses parts. */
function ecran({ clavier = 0, navbas = 60 } = {}) {
  const ios = [], mos = [], timers = [], ecoute = { vv: {}, sc: {} };
  let peek = null;
  const box = (top, h) => ({ top, bottom: top + h, height: h });
  const navbar = { getBoundingClientRect: () => box(0, navbas) };
  const sc = { getBoundingClientRect: () => box(0, 800), querySelector: q => (q === '.navbar' ? navbar : null),
    addEventListener: (k, f) => { ecoute.sc[k] = f; }, removeEventListener: k => { delete ecoute.sc[k]; } };
  const part = top => ({ top, getBoundingClientRect() { return box(this.top, 60); }, closest: () => sc, scrollIntoView(o) { this.vu = o; } });
  const hint = part(300), st = part(380);
  const card = { isConnected: true, querySelector: q => (q === '.coach-hint' ? hint : q === '.coach-st' ? st : null), closest: () => sc, scrollIntoView() {} };
  const vv = { offsetTop: 0, height: 800 - clavier, addEventListener: (k, f) => { ecoute.vv[k] = f; }, removeEventListener: k => { delete ecoute.vv[k]; } };
  const body = { appendChild: el => { peek = el; el.isConnected = true; el.remove = () => { el.isConnected = false; if (peek === el) peek = null; }; } };
  const c = vm.createContext({
    COACH: { kind: 'solo', round: 0, diag: 'Ta requête renvoie 3 lignes ; il en faut 5.', n: 0 }, JEU: null,
    window: { innerHeight: 800, visualViewport: vv },
    document: { body, getElementById: id => (id === 'coach-peek' ? peek : null), createElement: () => ({ style: {}, classList: { add() {} } }) },
    IntersectionObserver: class { constructor(f, o) { this.f = f; this.o = o; ios.push(this); } observe(t) { this.t = t; } disconnect() { this.off = true; } },
    MutationObserver: class { constructor(f) { this.f = f; mos.push(this); } observe() {} disconnect() { this.off = true; } },
    setTimeout: (f, ms) => timers.push([f, ms]), prefersReduceMotion: () => true,
  });
  vm.runInContext(cut('function coachEnJeu(){', 'function coachVoir(i){'), c);
  c.card = card;
  return { c, ios, mos, timers, ecoute, hint, st, vv, peek: () => peek, ev: x => vm.runInContext(x, c) };
}

test('la pastille dit toujours « Un coup de patte ? » : voir l’indice, ou voir pourquoi', () => {
  const e = ecran();
  e.ev('coachPeek(card,false)'); assert.equal(e.peek().innerHTML, '<span aria-hidden="true">↑</span>Un coup de patte ? · voir pourquoi', 'un essai raté, pas encore d’indice');
  e.c.COACH.n = 1; e.ev('coachPeek(card,false)'); assert.ok(e.peek().innerHTML.endsWith('Un coup de patte ? · voir l’indice'), 'un essai raté, un indice sur la carte');
  e.c.COACH.n = 0; e.c.COACH.diag = ''; e.ev('coachPeek(card,true)'); assert.ok(e.peek().innerHTML.endsWith('Un coup de patte ? · voir l’indice'), 'un indice qui arrive, sans essai raté');
  assert.ok(!cut('function coachPeek(card,hint){', '\n}\n').includes('Nouvel indice'), 'plus de « Nouvel indice · le voir »');
});

test('elle se montre tant que ce qu’elle annonce n’est pas vu en entier ; elle y ramène ; elle suit le défilement', () => {
  const e = ecran();
  e.ev('coachPeek(card,false)');
  const b = e.peek(), io = e.ios[0];
  assert.equal(io.t, e.st, 'elle surveille l’encart « Un coup de patte ? »'); assert.deepEqual([...io.o.threshold], [0, 0.5, 1]);
  io.f([{ isIntersecting: false }]); assert.equal(b.hidden, false, 'hors de l’écran : elle se montre');
  io.f([{ isIntersecting: true }]); assert.equal(b.hidden, true, 'vu en entier : elle se cache');
  e.st.top = 770; io.f([{ isIntersecting: true }]); assert.equal(b.hidden, false, 'coupé en bas de l’écran : pas vu');
  e.st.top = 20; e.ecoute.sc.scroll(); assert.equal(b.hidden, false, 'sous la barre du haut : pas vu');
  e.st.top = 380; e.ecoute.sc.scroll(); assert.equal(b.hidden, true, 'on fait défiler jusqu’à lui : elle se cache');
  /* Un indice : elle surveille l’indice */
  const f = ecran(); f.ev('coachPeek(card,true)'); assert.equal(f.ios[0].t, f.hint);
  /* La toucher : l’encart au milieu de l’écran, elle part, les écoutes avec elle */
  e.st.top = 770; io.f([{ isIntersecting: true }]);
  b.onclick(); assert.equal(e.peek(), null); assert.deepEqual({ ...e.st.vu }, { behavior: 'auto', block: 'center' });
  assert.ok(io.off && e.mos[0].off); assert.deepEqual(Object.keys(e.ecoute.vv), []); assert.deepEqual(Object.keys(e.ecoute.sc), []);
});

test('le clavier ouvert : ce qu’il cache n’est pas vu, et la pastille se pose au-dessus de lui', () => {
  const e = ecran({ clavier: 320 });
  e.ev('coachPeek(card,false)');
  const b = e.peek(), io = e.ios[0];
  io.f([{ isIntersecting: true }]);
  assert.equal(b.hidden, true, 'l’encart (380 à 440) au-dessus du clavier (480) : vu');
  assert.equal(b.style.bottom, '334px', 'au-dessus du clavier');
  e.st.top = 460; e.ecoute.vv.resize(); assert.equal(b.hidden, false, 'à moitié derrière le clavier : pas vu');
  e.vv.height = 800; e.ecoute.vv.resize(); assert.equal(b.style.bottom, '', 'le clavier fermé : sa place de toujours');
  assert.equal(b.hidden, true);
});
