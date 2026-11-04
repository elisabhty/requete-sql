/* Retours de 1 h 51 (Elisa, 4 novembre), sur l’ouverture de l’appli iOS : « il n’y a pas d’haptique d’onde et de son dans
   l’application ». L’ouverture a maintenant un son, calé sur l’animation (assets/sons/ouverture.m4a, fabriqué par
   tools/sons/ouverture.py) et joué par Web Audio en session « ambient » (il se mêle à la musique et se tait en mode
   silencieux), et une haptique qui suit l’onde : la touche, l’onde qui s’éloigne, les résultats, la plongée. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import vm from 'node:vm';

const lire = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const app = lire('index.html');
const css = lire('ludique.css');
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };
const intro = cut(app, '/* Appli iOS : l’ouverture animée', '  </script>');
const attendre = () => new Promise(r => setTimeout(r, 0));

function lancer({ natif = true, calme = false, audio = true, haptique = true, session = 'auto', decode = true } = {}) {
  const log = [], cls = new Set(), file = [], frames = [];
  let horloge = 0;                                                   // une horloge à nous : les minuteurs partent à leur heure
  const nom = { textContent: 'Requête', innerHTML: '', setAttribute() {} };
  const L = { style: {}, classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) },
    querySelector: q => (q === '.ld-name' ? nom : null), insertAdjacentHTML() {} };
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
    window, Array, matchMedia: () => ({ matches: calme }), localStorage: { getItem: () => '' },
    navigator: { vibrate: ms => { log.push('vibre ' + ms); return true; }, audioSession: as },
    performance: perf, requestAnimationFrame: f => frames.push(f), setTimeout: (f, ms) => file.push([horloge + (ms || 0), f])
  });
  vm.runInContext(intro, ctx);
  /* Joue l’ouverture : deux images (is-play à 0 ms), puis les minuteurs dans l’ordre jusqu’au rangement (1,3 s) ; « occupe » simule
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
      if (!t || t[0] >= 1300) break;
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

test('haptique : la touche, l’onde qui s’éloigne, les résultats deux par deux, la plongée', async () => {
  const s = lancer(); await attendre(); s.log.splice(0);
  const j = s.jouer().filter(([, l]) => /^(choc|cran)/.test(l) || l.startsWith('crans'));
  assert.deepEqual(j, [[0, 'crans prêts'],
    [90, 'choc MEDIUM'],                                   // la touche au fond (introKey : 18 % de 0,5 s)
    [160, 'choc LIGHT'], [230, 'choc LIGHT'], [300, 'cran'], [370, 'cran'],   // l’onde, de plus en plus légère
    [514, 'cran'], [542, 'cran'], [570, 'cran'], [598, 'cran'],              // les résultats (500 + 14 k), un cran par paire
    [760, 'choc MEDIUM'],                                  // la plongée (0,74 s)
    [760, 'crans finis']]);
  /* Les crans des résultats tombent sur une case allumée sur deux */
  for (const [ms] of j.filter(([ms, l]) => l === 'cran' && ms > 500)) assert.equal((ms - 500 - 14) % 28, 0);
  assert.ok(!s.log.some(l => l.startsWith('vibre')), 'pas de vibration en double');
});

test('haptique : fil principal occupé au départ, rien ne s’entasse ; la touche et la plongée partent toujours', async () => {
  for (const occupe of [30, 70, 130, 250, 420]) {
    const s = lancer(); await attendre(); s.log.splice(0);
    const coups = s.jouer({ occupe }).filter(([, l]) => l === 'cran' || l.startsWith('choc '));
    assert.equal(coups.filter(([, l]) => l === 'choc MEDIUM').length, 2, `${occupe} ms : la touche et la plongée`);
    assert.equal(coups[0][1], 'choc MEDIUM'); assert.equal(coups.at(-1).join(' '), '760 choc MEDIUM');
    for (let i = 1; i < coups.length; i++) {
      const ecart = coups[i][0] - coups[i - 1][0];
      assert.ok(ecart >= 25 || coups[i][1] === 'choc MEDIUM', `${occupe} ms : ${coups[i - 1].join(' ')} puis ${coups[i].join(' ')}`);
    }
    /* Ce qui part le fait à son heure, ou avec au plus 45 ms de retard (la touche mise à part) */
    for (const [ms, l] of coups.slice(1)) {
      const prevu = [[160, 'choc LIGHT'], [230, 'choc LIGHT'], [300, 'cran'], [370, 'cran'], [514, 'cran'], [542, 'cran'], [570, 'cran'], [598, 'cran'], [760, 'choc MEDIUM']]
        .filter(([t, n]) => n === l && ms - t >= 0 && ms - t <= 45);
      assert.ok(prevu.length, `${occupe} ms : ${ms} ${l} hors de son créneau`);
    }
  }
});

test('sans Haptics : la vibration de la touche comme avant ; sans Web Audio ou son illisible : muet, sans rien bloquer', async () => {
  const a = lancer({ haptique: false }); await attendre();
  assert.ok(a.jouer().some(([ms, l]) => ms === 90 && l === 'vibre 25'));
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

test('le fichier son : léger, de la bonne durée, et calé sur les instants de l’animation', () => {
  const b = fs.readFileSync(new URL('../assets/sons/ouverture.m4a', import.meta.url));
  assert.equal(b.toString('latin1', 4, 8), 'ftyp');
  assert.ok(b.length > 10000 && b.length < 60000, `${b.length} octets`);
  const i = b.indexOf('mvhd'), v = b[i + 4];
  const [echelle, duree] = v === 1 ? [b.readUInt32BE(i + 24), Number(b.readBigUInt64BE(i + 28))] : [b.readUInt32BE(i + 16), b.readUInt32BE(i + 20)];
  assert.ok(Math.abs(duree / echelle - 1.8) < 0.06, `${(duree / echelle).toFixed(3)} s`);
  /* Le générateur : mêmes instants que l’animation */
  const py = lire('tools/sons/ouverture.py');
  for (const l of ['TOUCHE = 0.085', 'ONDE = 0.12', 'VITESSE = 3048', 'RESULTATS = [0.500 + i * 0.014 for i in range(8)]', 'PLONGEE = 0.72', 'ARRIVEE = 1.04',
    "SORTIE_M4A = os.path.join(RACINE, 'assets', 'sons', 'ouverture.m4a')"]) assert.ok(py.includes(l), l);
  assert.ok(css.includes('@keyframes introKey{\n  0%{transform:none}\n  18%{transform:translateY(calc(22*var(--u)))}'), 'la touche au fond à 18 % de 0,5 s, soit 90 ms');
  assert.ok(css.includes('.in-ring{animation:introWave .34s linear .12s forwards}'), 'l’onde part à 0,12 s');
  assert.ok(intro.includes('w=Math.round(120+(r-256)/3.048)') && intro.includes("'<s style=\"--p:'+(500+k*14)+'"), 'cases et résultats aux instants du son');
  assert.ok(css.includes('introZoom .3s cubic-bezier(.55,0,.9,.4) .74s forwards') && css.includes('{animation:introOut .24s linear 1.04s forwards}'));
  /* Le dossier assets part dans l’appli ; le .wav de travail reste hors du dépôt */
  assert.ok(lire('scripts/build-www.mjs').includes("for (const dir of ['assets', 'vendor'])"));
  assert.ok(lire('.gitignore').includes('tools/sons/sortie/'));
});
