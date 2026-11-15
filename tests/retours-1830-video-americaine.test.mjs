/* Elisa, 15 novembre, 16 h 57 : « t’as fait la vidéo data analyst mais dans le contexte américain ? (genre les salaires et tout -
   choisis la voix appropriée) ».
   La vidéo du site (decouvrir/video.html) garde ses chiffres dans une chaîne JSON (DON) ; la page anglaise reçoit ceux des États-Unis
   par tools/langue/site/en.json (sa clé « js:{…} ») : salaire médian Glassdoor, villes Built In, freelance Upwork, projections du BLS ;
   les textes des scènes, ce que dit la vidéo et ses sources y ont leur version américaine. L’accueil anglais aussi (la carte des
   salaires). Sa voix : tools/voix/en/video-site.json (Killian, une voix américaine), à générer puis intégrer avec
   node tools/voix/integrer-site.mjs --langue en (la musique de la vidéo française est reprise). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const don = page => JSON.parse(/const DON = JSON\.parse\('([^']*)'\);/.exec(lire(page))[1]);

test('les chiffres de la vidéo : la France sur la page française, les États-Unis sur la page anglaise', () => {
  const fr = don('decouvrir/video.html'), en = don('decouvrir/en/video.html');
  assert.equal(fr.avg, 44);
  assert.deepEqual(fr.cities[0], ['Paris', 45]);
  assert.deepEqual(fr.tjm, [420, 312]);
  assert.equal(fr.sept, 7);
  assert.equal(en.avg, 94);
  assert.deepEqual(en.avgU, ['$', 'K']);
  assert.deepEqual(en.cities.map(c => c[0]), ['San Francisco', 'Washington', 'Los Angeles', 'New York', 'Austin', 'Houston', 'Seattle']);
  assert.deepEqual(en.fourchette, [72, 122]);
  assert.deepEqual(en.tjm, [20, 50]);
  assert.deepEqual(en.tjmx, [], 'pas de carte « selon l’expérience » en freelance');
  assert.equal(en.da, 35);
  assert.equal(en.formateurs, false, 'les cours anglais ont une seule voix : pas de « 8 formateurs »');
  const D = JSON.parse(lire('tools/langue/site/en.json'));
  assert.ok(Object.keys(D).some(k => k.startsWith('js:{"avg":44')), 'la clé du JSON français dans le dictionnaire');
});

test('la page anglaise : les scènes et les sources américaines, plus d’euros', () => {
  const en = lire('decouvrir/en/video.html');
  for (const t of ['San Francisco leads,', 'the rest <em>around $90K</em>', '$72–122K', '$107–166K', '$148–232K', 'median $94K', 'In the U.S., 2025–2035',
    'Source: <b>Built In</b>', 'Source: <b>Upwork</b>', '<b>U.S. Bureau of Labor Statistics</b>', 'https://www.glassdoor.com/Salaries/data-analyst-salary-SRCH_KO0,12.htm',
    'https://www.bls.gov/ooh/math/data-scientists.htm', 'SELECT AVG(hourly_rate) FROM freelancers;'])
    assert.ok(en.includes(t), t);
  for (const t of ['average €44k', 'On apec.fr', 'Free-Work', 'In the Paris region', 'taught by 8 instructors.']) assert.ok(!en.includes(t), t);
  const fr = lire('decouvrir/video.html');
  assert.ok(fr.includes('Paris en tête,') && fr.includes('Sur apec.fr'), 'la page française ne change pas');
});

test('l’accueil anglais : les salaires américains, la colonne placée d’après ses bornes', () => {
  const en = lire('decouvrir/en/index.html'), fr = lire('decouvrir/index.html');
  assert.ok(en.includes('<small>Median total pay</small><b>$<span class="cnt" data-n="94">94</span>K</b></span><span class="db-badge">United States</span>'));
  assert.ok(en.includes('<span class="xt" data-v="72,122,40,250">$72–122K</span>') && en.includes('<span class="xt" data-v="148,232,40,250">$148–232K</span>'));
  assert.ok(fr.includes('<div class="xcol r1" style="--lo:20;--hi:40"><span class="xt" data-v="40,50,30,80">40–50&nbsp;k€</span>'));
  assert.ok(fr.includes("c.style.setProperty('--lo',Math.round((v[0]-v[2])*k));"));
  assert.ok(lire('decouvrir/vitrine.css').includes('html[lang="en"] #salaires .db-ic::before{content:"$"'));
});

test('la voix américaine : les 17 phrases aux mêmes places, une voix des États-Unis, la musique française reprise', () => {
  const fr = JSON.parse(lire('tools/voix/video-site.json')), en = JSON.parse(lire('tools/voix/en/video-site.json'));
  assert.equal(en.langue, 'en');
  assert.deepEqual(en.voix, {id: 'Whez8hBysHW6IVGRgjGA', nom: 'Killian'});
  assert.ok(!en.musique, 'pas de musique à générer');
  assert.deepEqual(en.elements.map(e => [e.id, e.debut]), fr.elements.map(e => [e.id, e.debut]));
  const tout = en.elements.map(e => e.texte).join(' ');
  assert.ok(tout.includes('ninety-four thousand dollars') && tout.includes('twenty to fifty dollars an hour') && tout.includes('thirty-five percent'));
  assert.ok(!/euro|instructors|formateur/i.test(tout));
  assert.ok(en.elements.every(e => e.texte.startsWith('[cheerful] ')));
  const n = en.elements.reduce((a, e) => a + e.texte.length, 0);
  assert.ok(n > 1800 && n < 2400, `environ 2 000 crédits (${n})`);
  const integ = lire('tools/voix/integrer-site.mjs');
  assert.ok(integ.includes("const li = process.argv.indexOf('--langue')") && integ.includes("path.join(ROOT, 'decouvrir', ...sous, 'voix')"));
});
