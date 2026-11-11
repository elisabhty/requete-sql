/* Retours de 1 h 51 (Elisa, 4 novembre), sur l’ouverture de l’appli iOS : « il n’y a pas d’haptique d’onde et de son dans
   l’application ». L’ouverture a maintenant un son, calé sur l’animation (assets/sons/ouverture.m4a, fabriqué par
   tools/sons/ouverture.py) et joué par Web Audio en session « ambient » (il se mêle à la musique et se tait en mode
   silencieux), et une haptique qui suit l’onde : la touche, l’onde qui s’éloigne, les résultats, la plongée.
   11 novembre, 13 h 10 (« j’adore les haptiques », « Le logo se construit ») : le son et l’haptique suivent la nouvelle
   ouverture : un cran par case posée dans la touche, un coup fort quand elle est entière, un cran par lettre, un coup moyen
   à l’appui. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import vm from 'node:vm';
import { fauxLoader } from './aide-ouverture.mjs';

const lire = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const app = lire('index.html');
const css = lire('ludique.css');
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };
const intro = cut(app, '/* Appli iOS : l’ouverture animée', '  </script>');
const attendre = () => new Promise(r => setTimeout(r, 0));

function lancer({ natif = true, calme = false, audio = true, haptique = true, session = 'auto', decode = true } = {}) {
  const log = [], file = [], frames = [];
  let horloge = 0;                                                   // une horloge à nous : les minuteurs partent à leur heure
  const L = fauxLoader(), cls = L.cls;
  const as = session == null ? undefined : { type: session };
  const sources = [];
  class Contexte {
    constructor() { this.state = 'running'; this.destination = { nom: 'sortie' }; log.push('contexte'); }
    decodeAudioData(b, ok, ko) { log.push('décodé ' + b.byteLength); if (decode) ok({ son: true }); else ko(new Error('format')); }
    createBufferSource() { const s = { connect(d) { this.vers = d; }, start(t) { log.push('son ' + t); } }; sources.push(s); return s; }
    resume() { log.push('reprise'); }
    close() { log.push('fermé'); this.state = 'closed'; }
  }
  const perf = { now: () => horloge };
  const window = { innerWidth: 430, innerHeight: 932, performance: perf };
  if (audio) {
    window.AudioContext = Contexte;
    window.fetch = u => { log.push('charge ' + u); return Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(24252)) }); };
  }
  window.Capacitor = { Plugins: { SplashScreen: { hide: () => log.push('écran retiré') } } };
  if (haptique) window.Capacitor.Plugins.Haptics = { impact: o => log.push('choc ' + o.style), selectionStart: () => log.push('crans prêts'),
    selectionChanged: () => log.push('cran'), selectionEnd: () => log.push('crans finis') };
  const ctx = vm.createContext({
    document: { documentElement: { classList: { contains: c => natif && c === 'is-native' } }, getElementById: id => (id === 'loader' ? L : null) },
    window, Array, matchMedia: () => ({ matches: calme }), localStorage: { getItem: () => '', setItem() {} },
    navigator: { vibrate: ms => { log.push('vibre ' + ms); return true; }, audioSession: as },
    performance: perf, requestAnimationFrame: f => frames.push(f), setTimeout: (f, ms) => file.push([horloge + (ms || 0), f])
  });
  vm.runInContext(intro, ctx);
  /* Joue l’ouverture : deux images (is-play à 0 ms), puis les minuteurs dans l’ordre jusqu’au rangement (2,3 s) ; « occupe » simule
     un fil principal pris pendant ce temps-là juste après le départ. Renvoie le journal daté (ms après is-play). */
  const jouer = ({ occupe = 0 } = {}) => {
    window.__introJouer();
    const q = () => { const f = frames.splice(0); f.forEach(x => x()); };
    q(); q();
    const daté = log.splice(0).map(l => [horloge, l]);
    horloge += occupe;
    for (;;) {
      file.sort((a, b) => a[0] - b[0]);
      const t = file[0];
      if (!t || t[0] >= 2300) break;
      file.shift(); horloge = Math.max(horloge, t[0]); t[1]();
      log.splice(0).forEach(l => daté.push([horloge, l]));
    }
    return daté;
  };
  return { log, cls, as, sources, jouer, window };
}

test('son : chargé pendant le démarrage, en session « ambient », lancé avec l’animation, puis la session d’avant revient', async () => {
  const s = lancer();
  assert.equal(s.as.type, 'ambient', 'se mêle à la musique en cours et se tait en mode silencieux');
  await attendre();
  assert.deepEqual(s.log.splice(0), ['contexte', 'charge assets/sons/ouverture.m4a', 'décodé 24252']);
  const j = s.jouer();
  assert.ok(s.cls.has('is-play'));
  assert.deepEqual(j.slice(0, 3).map(x => x[1]), ['écran retiré', 'son 0', 'crans prêts'], 'le son part dans la même image que l’animation');
  assert.equal(s.sources.length, 1); assert.deepEqual(s.sources[0].vers, { nom: 'sortie' });
  assert.equal(s.as.type, 'ambient', 'pendant le son');
  s.sources[0].onended();
  assert.equal(s.as.type, 'auto', 'après : la session d’avant (le lecteur des cours passe en « lecture » quand il le faut)');
  assert.equal(s.log.at(-1), 'fermé');
});

/* Les instants de la version pleine (PLEINE, dans le script de l’ouverture) */
const CASES = Array.from({ length: 16 }, (_, i) => 380 + 32 * i), LETTRES = Array.from({ length: 7 }, (_, j) => 1110 + 36 * j);
const ENTIERE = 1080, APPUI = 1440 + Math.round(640 * 0.14);
const PREVU = [...CASES.map(t => [t, 'cran']), [ENTIERE, 'choc HEAVY'], ...LETTRES.map(t => [t, 'cran']), [APPUI, 'choc MEDIUM']];

test('haptique : un cran par case posée, un coup fort pour la touche entière, un cran par lettre, un coup moyen à l’appui', async () => {
  const s = lancer(); await attendre(); s.log.splice(0);
  const j = s.jouer().filter(([, l]) => /^(choc|cran)/.test(l) || l.startsWith('crans'));
  assert.deepEqual(j, [[0, 'crans prêts'], ...PREVU, [APPUI, 'crans finis']]);
  assert.equal(APPUI, 1530, 'l’appui au plus bas : 14 % de la plongée de 0,64 s partie à 1,44 s');
  for (let i = 1; i < j.length - 1; i++) assert.ok(j[i][0] - j[i - 1][0] >= 25 || i === 1, `${j[i - 1].join(' ')} puis ${j[i].join(' ')} : au moins 25 ms`);
  assert.ok(!s.log.some(l => l.startsWith('vibre')), 'pas de vibration en double');
});

test('haptique : fil principal occupé au départ, rien ne s’entasse ; la touche entière et l’appui partent toujours', async () => {
  for (const occupe of [30, 70, 130, 250, 420]) {
    const s = lancer(); await attendre(); s.log.splice(0);
    const coups = s.jouer({ occupe }).filter(([, l]) => l === 'cran' || l.startsWith('choc '));
    assert.deepEqual(coups.filter(([, l]) => l.startsWith('choc')).map(c => c.join(' ')), [`${ENTIERE} choc HEAVY`, `${APPUI} choc MEDIUM`], `${occupe} ms`);
    for (let i = 1; i < coups.length; i++) {
      const ecart = coups[i][0] - coups[i - 1][0];
      assert.ok(ecart >= 25 || coups[i][1].startsWith('choc'), `${occupe} ms : ${coups[i - 1].join(' ')} puis ${coups[i].join(' ')}`);
    }
    /* Ce qui part le fait à son heure, ou avec au plus 45 ms de retard */
    for (const [ms, l] of coups) {
      const prevu = PREVU.filter(([t, n]) => n === l && ms - t >= 0 && ms - t <= 45);
      assert.ok(prevu.length, `${occupe} ms : ${ms} ${l} hors de son créneau`);
    }
  }
});

test('sans Haptics : une vibration quand la touche est entière ; sans Web Audio ou son illisible : muet, sans rien bloquer', async () => {
  const a = lancer({ haptique: false }); await attendre();
  assert.ok(a.jouer().some(([ms, l]) => ms === ENTIERE && l === 'vibre 25'));
  const b = lancer({ audio: false }); await attendre();
  const jb = b.jouer();
  assert.ok(!jb.some(([, l]) => l.startsWith('son')) && b.cls.has('is-play'));
  assert.equal(b.as.type, 'auto', 'session jamais touchée');
  const c = lancer({ decode: false }); await attendre();
  const jc = c.jouer();
  assert.ok(!jc.some(([, l]) => l.startsWith('son')) && jc.some(([, l]) => l === 'fermé'));
  assert.equal(c.as.type, 'auto', 'session rendue');
  /* L’appli prête avant que le son soit décodé : on ne l’attend pas */
  const d = lancer();
  const jd = d.jouer();
  assert.ok(!jd.some(([, l]) => l.startsWith('son ')) && d.cls.has('is-play'));
  assert.equal(d.as.type, 'auto');
  /* iOS sans Audio Session API (avant iOS 17) : Web Audio y est déjà « ambient » */
  const e = lancer({ session: null }); await attendre();
  assert.ok(e.jouer().some(([, l]) => l === 'son 0'));
});

test('mouvement réduit : un fondu, ni son ni haptique ; sur le site : rien', async () => {
  const s = lancer({ calme: true }); await attendre();
  assert.deepEqual(s.log, [], 'pas de contexte audio ni de chargement');
  assert.equal(s.as.type, 'auto');
  const j = s.jouer();
  assert.ok(!j.some(([, l]) => /^(son|choc|cran|vibre)/.test(l)) && s.cls.has('fade-out'));
  const web = lancer({ natif: false }); await attendre();
  assert.deepEqual(web.log, []); assert.equal(web.window.__introJouer, undefined);
});

test('le fichier son : léger, de la bonne durée, et calé sur les instants de l’animation (le logo qui se construit)', () => {
  const b = fs.readFileSync(new URL('../assets/sons/ouverture.m4a', import.meta.url));
  assert.equal(b.toString('latin1', 4, 8), 'ftyp');
  assert.ok(b.length > 10000 && b.length < 60000, `${b.length} octets`);
  const i = b.indexOf('mvhd'), v = b[i + 4];
  const [echelle, duree] = v === 1 ? [b.readUInt32BE(i + 24), Number(b.readBigUInt64BE(i + 28))] : [b.readUInt32BE(i + 16), b.readUInt32BE(i + 20)];
  assert.ok(Math.abs(duree / echelle - 2.6) < 0.06, `${(duree / echelle).toFixed(3)} s`);
  /* Le générateur : mêmes instants que l’animation (PLEINE, dans le script de l’ouverture) */
  const py = lire('tools/sons/ouverture.py');
  for (const l of ['CASES = [(0.380 + 0.032 * i, c) for i, (c, r) in enumerate(ORDRE)]', 'ENTIERE = 1.080', 'LETTRES = [1.110 + 0.036 * j for j in range(7)]',
    'APPUI = 1.440 + 0.64 * 0.14', 'PLONGEE = 1.440 + 0.64 * 0.28', 'ARRIVEE = 1.930', "ORDRE = sorted([(c, r) for c in range(4) for r in range(4)], key=lambda s: (s[0] + s[1], s[0]))",
    "SORTIE_M4A = os.path.join(RACINE, 'assets', 'sons', 'ouverture.m4a')"]) assert.ok(py.includes(l), l);
  assert.ok(intro.includes('var PLEINE={soude:980,dSoude:100,fin:1080,appui:1440,dPlonge:640,sortie:1930,dSortie:360,')
    && intro.includes('k:function(i){return [22*i,380+32*i];},l:function(j){return [560+28*j,1110+36*j];}};'), 'cases, touche, lettres, appui, arrivée aux instants du son');
  assert.ok(intro.includes('if(!court)jouerSon();'), 'la version courte est muette');
  /* Le dossier assets part dans l’appli ; le .wav de travail reste hors du dépôt */
  assert.ok(lire('scripts/build-www.mjs').includes("for (const dir of ['assets', 'vendor'])"));
  assert.ok(lire('.gitignore').includes('tools/sons/sortie/'));
});
