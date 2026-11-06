/* Elisa, 6 novembre, 19 h 56 : « Oui tu peux baisser mais il faut que le son reste homogène avec le reste ». Dans chaque cours, les
   phrases jouées à part (« Bien vu ! », « Bien rattrapé ! », « Bravo ! », « À toi ! », « Touche… », les indices, les liens) et les
   chapitres qui s’écartent de plus de 1,5 LU de la voix qui explique y sont ramenés (tools/voix/volume.mjs), sans réencodage : le gain
   global des trames MP3, comme mp3gain. Même taille, même nombre d’échantillons, donc les tables VOICE restent justes. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {planifier, regler, verifier, mesureFichier, CRAN} from '../tools/voix/volume.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0;

/* Les gains globaux des granules d’un MP3 mono (MPEG-1 couche III), trame d’en-tête LAME comprise. */
function gains(buf){
  const b = buf; let i = 10 + ((b[6] & 0x7f) << 21 | (b[7] & 0x7f) << 14 | (b[8] & 0x7f) << 7 | (b[9] & 0x7f)); const out = [];
  const bits = (s, off, n) => { let v = 0; for (let k = 0; k < n; k++) { const x = off + k; v = (v << 1) | ((b[s + (x >> 3)] >> (7 - (x & 7))) & 1); } return v; };
  while (i + 4 <= b.length && (b.readUInt32BE(i) >>> 21) === 0x7ff) {
    const h = b.readUInt32BE(i), len = Math.floor(144000 * [0, 32, 40, 48, 56, 64, 80, 96, 112, 128][(h >>> 12) & 15] / 44100) + ((h >>> 9) & 1);
    out.push([bits(i + 4, 39, 8), bits(i + 4, 98, 8)]); i += len;
  }
  return out;
}

test('le plan : une phrase vise la voix qui explique + 0,5 LU, un chapitre la voix elle-même ; rien sous 1,5 LU d’écart', () => {
  const m = {ch01: {lufs: -28, crete: -9}, ch02: {lufs: -28.4, crete: -9}, ch03: {lufs: -27.6, crete: -9}, ch00: {lufs: -25.4, crete: -8},
    bienvu: {lufs: -24.2, crete: -8}, at1: {lufs: -26.4, crete: -8}, presque: {lufs: -31, crete: -2.5}, indice1: {lufs: -31, crete: -9}};
  const {ref, plan} = planifier(m), p = Object.fromEntries(plan.map(x => [x.id, x]));
  assert.equal(ref, -28);
  assert.equal(p.bienvu.crans, -2, '« Bien vu ! » à +3,8 LU : deux crans de 1,5 dB');
  assert.ok(Math.abs(p.bienvu.apres - 0.79) < 0.02);
  assert.equal(p.ch00.crans, -2, 'l’ouverture à +2,6 LU : ramenée à la voix');
  assert.ok(!p.at1 && !p.ch01 && !p.ch02 && !p.ch03, 'à 1,6 LU de la cible d’une phrase, ou dans la marge : pas touché');
  assert.equal(p.presque.crans, 0, 'trop basse, mais sa crête approcherait la saturation : laissée');
  assert.equal(p.indice1.crans, 2, 'trop basse, avec de la marge : remontée');
  assert.equal(CRAN, 1.505);
});

test('le réglage : seul le gain global de chaque granule change, de n crans ; même taille, même en-tête LAME', () => {
  const f = path.join(ROOT, 'assets/voix/as/ch01.mp3'), a = fs.readFileSync(f), {buf, trames, butees} = regler(a, -3);
  assert.equal(buf.length, a.length);
  const g0 = gains(a), g1 = gains(buf);
  assert.equal(g1.length, g0.length); assert.equal(trames, g0.length - 1, 'la trame d’en-tête LAME n’a pas de son : sautée');
  assert.deepEqual(g1[0], g0[0], 'trame d’en-tête intacte');
  for (let k = 1; k < g0.length; k++) assert.deepEqual(g1[k], g0[k].map(g => Math.max(0, g - 3)), `trame ${k}`);
  assert.equal(butees, g0.slice(1).flat().filter(g => g < 3).length);
  let diff = 0; for (let k = 0; k < a.length; k++) if (a[k] !== buf[k]) diff++;
  assert.ok(diff > 0 && diff <= 4 * trames, 'au plus quatre octets par trame (deux gains de 8 bits, à cheval sur deux octets)');
});

test('la vérification : le son réglé est le son d’origine multiplié par le gain, au même instant', {skip: !FFMPEG && 'ffmpeg absent'}, () => {
  const f = path.join(ROOT, 'assets/voix/as/rattrape.mp3'), tmp = path.join(os.tmpdir(), `volume-${process.pid}.mp3`);
  fs.writeFileSync(tmp, regler(fs.readFileSync(f), -2).buf);
  const v = verifier(f, tmp, -2), m0 = mesureFichier(f), m1 = mesureFichier(tmp);
  fs.unlinkSync(tmp);
  assert.ok(v.ok && v.snr > 100, `écart ${v.snr} dB`);
  assert.ok(Math.abs((m1.lufs - m0.lufs) + 2 * CRAN) < 0.15, `${m0.lufs} → ${m1.lufs} LUFS`);
});

test('les cours : « Bien vu ! », « Bien rattrapé ! » et « Encore un effort ! » au niveau de leur cours', {skip: !FFMPEG && 'ffmpeg absent'}, () => {
  for (const c of ['as', 'like', 'bases-relationnelles', 'projet-alter']) {
    const ref = ['ch01', 'ch02', 'ch03', 'ch04', 'ch05'].map(id => mesureFichier(path.join(ROOT, `assets/voix/${c}/${id}.mp3`)).lufs).sort((x, y) => x - y)[2];
    for (const id of ['bienvu', 'rattrape', 'fineffort']) {
      const {lufs} = mesureFichier(path.join(ROOT, `assets/voix/${c}/${id}.mp3`));
      assert.ok(lufs - ref < 2.6, `${c}/${id} : ${(lufs - ref).toFixed(1)} LU au-dessus de la voix du cours`);
    }
  }
});

test('l’intégration d’une voix règle le volume du cours, et l’outil se lance seul', () => {
  const integ = fs.readFileSync(path.join(ROOT, 'tools/voix/integrer.mjs'), 'utf8');
  assert.ok(integ.includes("import {mesureFichier, planifier, regler} from './volume.mjs';"));
  assert.ok(integ.includes('const {ref, plan} = planifier(mes), aFaire = plan.filter(p => p.crans);'));
  const vol = fs.readFileSync(path.join(ROOT, 'tools/voix/volume.mjs'), 'utf8');
  assert.ok(vol.includes('Sans --appliquer : le plan seul, rien n’est écrit.') && vol.includes("if (!prot) throw new Error('trames protégées par CRC"));
});
