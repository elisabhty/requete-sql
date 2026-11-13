/* Elisa, 13 novembre, 13 h 19, sur « Les bases de données relationnelles » (sa capture du chapitre 7) :
   « il y a un trou : clients, commandes et produits. Coupure. Elle est gérée… », « certains textes ne sont pas parlés (2 bulles) »,
   « le badge Relationnelle est derrière ».
   - Le trou : la voix reprend son souffle avant « Elle est gérée… » ; la coupe le laissait à la fin de la phrase d’avant (un souffle,
     puis près d’une seconde de silence). Le souffle reste maintenant avec la phrase qu’il annonce (souffles-lib.mjs) : 10 coupes
     déplacées dans 7 cours, et la même règle à chaque intégration.
   - Les textes muets : 7 légendes du cours (pas 2) n’avaient pas de voix ; elles sont prêtes à générer à part, avec la phrase de la
     relecture du 10 novembre (tools/voix/bases-relationnelles-complements.json, environ 690 crédits, sur la décision d’Elisa).
   - Le badge : il passe devant les lignes de la table commandes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {souffles, souffleAvant, levels} from '../tools/voix/souffles-lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* Un signal fait main, trame par trame (10 ms) : [début, fin, niveau] en secondes. thr = 0,007, quart du seuil = 0,00175. */
function signal(morceaux, duree = 5){
  const rms = new Float32Array(duree * 100).fill(0.0001);
  for (const [a, b, v] of morceaux) for (let i = Math.round(a * 100); i < Math.round(b * 100); i++) rms[i] = v;
  return {rms, thr: 0.007};
}
const VOIX = 0.1, SOUFFLE = 0.003;

test('le souffle d’avant une phrase part avec elle : la coupe passe avant lui', () => {
  /* « …et produits. » (0,5-2,0 s), 0,3 s de silence, le souffle (2,3-2,55 s, une trame au-dessus du seuil, comme dans le cours),
     un court silence, « Elle est gérée… » (2,6 s). L’ancienne coupe : 2,58 s, après le souffle. */
  const L = signal([[0.5, 2.0, VOIX], [2.3, 2.55, SOUFFLE], [2.42, 2.43, 0.008], [2.6, 4.0, VOIX]]);
  assert.deepEqual(souffleAvant(L, [0.44, 2.58], [2.58, 4.15]), [2.3, 2.55]);
  const r = souffles(L, [[0.44, 2.58], [2.58, 4.15]]);
  assert.deepEqual(r.clips, [[0.44, 2.27], [2.27, 4.15]], 'la phrase d’avant finit dans le silence, la suivante commence par son souffle');
  assert.equal(r.changes.length, 1);
  /* l’attaque d’un « s » sous le seuil, collée au mot : elle aussi part avec sa phrase (le mot ne commence plus dans la phrase d’avant) */
  const S = signal([[0.5, 2.0, VOIX], [2.2, 2.3, SOUFFLE], [2.3, 3.5, VOIX]]);
  assert.deepEqual(souffles(S, [[0.44, 2.24], [2.25, 3.65]]).clips, [[0.44, 2.17], [2.17, 3.65]]);
});

test('rien ne bouge quand ce n’est pas un souffle détaché, ou que la coupe est déjà bonne', () => {
  const cas = [
    /* la fin du dernier mot (un « e » qui s’éteint), sans silence entre la voix et elle : elle reste à sa phrase */
    [[[0.5, 2.0, VOIX], [2.0, 2.2, SOUFFLE], [2.6, 4.0, VOIX]], [[0.44, 2.4], [2.54, 4.15]]],
    /* un vrai mot (au-dessus du double du seuil) juste avant : pas un souffle */
    [[[0.5, 2.0, VOIX], [2.3, 2.5, 0.02], [2.6, 4.0, VOIX]], [[0.44, 2.58], [2.58, 4.15]]],
    /* la phrase d’avant s’arrête déjà avant le souffle */
    [[[0.5, 2.0, VOIX], [2.3, 2.55, SOUFFLE], [2.6, 4.0, VOIX]], [[0.44, 2.2], [2.25, 4.15]]],
    /* un souffle trop loin du début franc (plus de 0,35 s) : ce n’est pas celui de la phrase */
    [[[0.5, 2.0, VOIX], [2.3, 2.5, SOUFFLE], [3.0, 4.0, VOIX]], [[0.44, 2.6], [2.9, 4.15]]],
    /* un silence trop court avant lui (moins de 0,1 s) : peut-être la fin du mot */
    [[[0.5, 2.0, VOIX], [2.05, 2.3, SOUFFLE], [2.35, 4.0, VOIX]], [[0.44, 2.33], [2.33, 4.15]]]
  ];
  for (const [m, clips] of cas) {
    const r = souffles(signal(m), clips);
    assert.deepEqual(r.clips, clips, JSON.stringify(m));
    assert.equal(r.changes.length, 0);
  }
});

test('les 10 coupes des 7 cours : déplacées dans les pages, et plus aucun souffle à la fin d’une phrase', () => {
  const attendu = {
    'any-all': [['v1y30qth', 'ch02', 17.35, 20.03], ['v6auoj8', 'ch02', 20.03, 23.54], ['vp1uj17', 'ch03', 12.11, 15.34], ['v18zqr9q', 'ch03', 15.34, 18.46], ['vrs5kcu', 'ch05', 0, 3.15], ['v1t9p9bi', 'ch05', 3.15, 6.74]],
    'bases-relationnelles': [['v14qnoq5', 'ch05', 5.16, 8.07], ['v7218ol', 'ch05', 8.07, 14.16], ['vr7j86h', 'ch05', 14.16, 18.71]],
    'conversion-types': [['v1aowrkb', 'ch02', 7.77, 11.83], ['v4zvkv3', 'ch02', 11.83, 14.46]],
    'join-group-by': [['vtiu3qo', 'ch01', 12.68, 16.66], ['v1la05n7', 'ch01', 16.66, 20.924]],
    'jointure-3-tables': [['vqjqs8o', 'ch01', 15.54, 18.24], ['vwsh9u2', 'ch01', 18.24, 22.9]],
    'left-join': [['vtbi7g7', 'ch02', 4.92, 9.85], ['v1sx2yzw', 'ch02', 9.85, 14.92]],
    'with-cte': [['vhxuiq2', 'ch04', 16.04, 19.9], ['v1aglubx', 'ch04', 19.9, 22.596]]
  };
  for (const [cours, caps] of Object.entries(attendu)) {
    const page = lire(`assets/anim/${cours}.html`);
    for (const c of caps) assert.ok(page.includes(JSON.stringify(c)), `${cours} : ${JSON.stringify(c)}`);
    /* les fichiers concernés, relus : plus rien à déplacer */
    const V = vm.runInContext(page.slice(page.indexOf('const VOICE = {'), page.indexOf('/* Fin de la voix off */')).replace('const VOICE =', 'VOICE =') + ';VOICE', vm.createContext({VOICE: null}));
    for (const f of new Set(caps.map(c => c[1]))) {
      const L = levels(path.join(ROOT, 'assets/voix', cours, f + '.mp3'));
      const clips = V.caps.filter(c => c[1] === f).sort((x, y) => x[2] - y[2]).map(c => [c[2], c[3]]);
      assert.equal(souffles(L, clips).changes.length, 0, `${cours} ${f}`);
    }
  }
});

test('les outils : integrer.mjs applique la règle à chaque intégration, souffles.mjs corrige les pages déjà faites', () => {
  const integ = lire('tools/voix/integrer.mjs');
  assert.ok(integ.includes("import {levels, souffles} from './souffles-lib.mjs';") && !integ.includes('\nfunction levels(f){'), 'une seule mesure du son, partagée');
  assert.ok(integ.includes('const clips = souffles(L, bounds(L, spans, dur)).clips;'));
  const s = lire('tools/voix/souffles.mjs');
  assert.ok(s.includes("import {levels, souffles} from './souffles-lib.mjs';") && s.includes("APPLIQUER = args.includes('--appliquer')"));
  assert.ok(lire('tools/voix/A-REGENERER.md').includes('10 coupes déplacées dans 7 cours'));
});

test('les 7 légendes muettes : générées à part, sans refaire les chapitres ; jamais payées deux fois', () => {
  const comp = JSON.parse(lire('tools/voix/bases-relationnelles-complements.json')), job = JSON.parse(lire('tools/voix/bases-relationnelles.json'));
  assert.deepEqual(comp.elements.map(e => e.id), ['ch05b', 'ch06b', 'ch06c', 'ch08a', 'ch11']);   // ch08a : 13 h 49, la requête et le moteur SQL
  assert.equal(comp.elements.reduce((n, e) => n + e.texte.length, 0), 1023, 'environ 1 020 crédits');
  const page = lire('assets/anim/bases-relationnelles.html');
  const CAPTIONS = vm.runInContext(page.slice(page.indexOf('const CAPTIONS = ['), page.indexOf('\n];', page.indexOf('const CAPTIONS = [')) + 3).replace('const CAPTIONS =', 'CAPTIONS =') + ';CAPTIONS', vm.createContext({APP: true, CAPTIONS: null}));
  const plain = h => h.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const legendes = new Set(CAPTIONS.map(c => plain(c[2])));
  for (const e of comp.elements) {
    assert.ok(e.texte.startsWith('[cheerful] ') && e.texte === '[cheerful] ' + e.phrases.join('\n\n'), `${e.id} : le ton et le texte du cours`);
    if (e.id !== 'ch11') assert.ok(e.avant && e.apres, `${e.id} : la phrase d’avant et celle d’après, pour le ton`);
    (e.legendes || e.phrases).forEach(l => {
      /* chaque phrase a sa légende dans la page (celle de ch06c : son nouveau texte, posé avec sa voix le 13 novembre, 14 h 14) */
      assert.ok(legendes.has(l), `${e.id} : ${l}`);
    });
  }
  /* le cours les liste à leur place (après leur chapitre) ; ch05 et ch06 ne changent pas : leurs fichiers ne sont pas refaits */
  const ids = job.elements.map(e => e.id);
  assert.ok(ids.indexOf('ch05b') === ids.indexOf('ch05') + 1 && ids.indexOf('ch06b') === ids.indexOf('ch06') + 1 && ids.indexOf('ch06c') === ids.indexOf('ch06') + 2);
  assert.ok(ids.indexOf('ch08a') === ids.indexOf('ch08') - 1, 'ch08a : juste avant le chapitre 8');
  assert.equal(job.elements.find(e => e.id === 'ch05').phrases.length, 12);
  assert.equal(job.elements.find(e => e.id === 'ch06').phrases.length, 16);
  /* generer.mjs : un fichier fait dans sortie/<cours>-complements compte comme fait pour le cours */
  const gen = lire('tools/voix/generer.mjs');
  assert.ok(gen.includes("return fs.readdirSync(s).some(d => d.startsWith(c + '-') && ici(path.join(s, d)));"));
  /* integrer.mjs : un complément va aux légendes muettes ; une voix dont la légende a changé n’est plus gardée */
  const integ = lire('tools/voix/integrer.mjs');
  assert.ok(integ.includes('const COMPLEMENT = /^ch\\d+[a-z]$/;') && integ.includes('const prises = COMPLEMENT.test(el.id) ? voixPrises() : null;'));
  assert.ok(integ.includes("const kept = (ANCIEN.caps || []).filter(c => c[1] === el.id && CLES.has(c[0]));"));
  /* la commande, dans la liste des voix à refaire */
  assert.ok(lire('tools/voix/A-REGENERER.md').includes('node tools/voix/generer.mjs --toutes --cours bases-relationnelles-complements --oui'));
});

test('le badge « Relationnelle » passe devant les lignes de la table commandes', () => {
  const page = lire('assets/anim/bases-relationnelles.html');
  assert.ok(page.includes('#stamp4{right:56px;top:214px;z-index:3}'));
});
