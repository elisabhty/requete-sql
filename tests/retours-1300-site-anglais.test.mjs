/* Elisa, 15 novembre, 13 h : « on va partir sur l’anglais. Et fini le travail du coup avec le site ». Le site existe en anglais dans
   decouvrir/en/, construit à partir des pages françaises et d’un dictionnaire (tools/langue/site.mjs, tools/langue/site/en.json).
   Tant que l’anglais de l’appli est en essai, ces pages ne sont ni dans le menu des pages françaises ni dans les moteurs de
   recherche (noindex) ; « node tools/langue/site.mjs --langue en publier » les ouvre le jour venu. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PAGES = ['index.html', 'module.html', 'video.html', 'conditions.html', 'confidentialite.html', 'mentions-legales.html', 'connexion.html'];

test('les pages anglaises sont à jour : reconstruites depuis les pages françaises et le dictionnaire d’aujourd’hui', () => {
  const sources = JSON.parse(lire('decouvrir/en/sources.json'));
  for (const [f, h] of Object.entries(sources))
    assert.equal(crypto.createHash('sha1').update(lire(f)).digest('hex').slice(0, 12), h, `${f} a changé : node tools/langue/site.mjs --langue en recolter, traduire, puis construire`);
  assert.deepEqual(Object.keys(sources).filter(f => f.endsWith('.html')).map(f => f.slice(10)), PAGES);
});

test('chaque page anglaise : en anglais, ses adresses un dossier plus bas, la page française en face', () => {
  for (const f of PAGES) {
    const h = lire('decouvrir/en/' + f);
    assert.match(h, /<html lang="en"/, f);
    /* 15 novembre (le site ouvert) : les adresses hreflang complètes, comme les veut Google, et le français par défaut */
    const nom = f === 'index.html' ? '' : f;
    assert.ok(h.includes(`<link rel="alternate" hreflang="fr" href="https://requeteapp.com/decouvrir/${nom}">`) && h.includes(`<link rel="alternate" hreflang="en" href="https://requeteapp.com/decouvrir/en/${nom}">`) && h.includes(`<link rel="alternate" hreflang="x-default" href="https://requeteapp.com/decouvrir/${nom}">`), f);
    assert.ok(!/(src|href)="\.\.\/assets\//.test(h), `${f} : les fichiers de l’appli sont à ../../assets`);
  }
  const i = lire('decouvrir/en/index.html');
  assert.ok(i.includes('<title>Requête — Learn SQL, the #1 skill for data analysts</title>'));
  assert.ok(i.includes('href="../vitrine.css') && i.includes('src="modules.js'), 'la feuille de style partagée, le catalogue traduit');
  assert.ok(i.includes('assets/anim/en/where-thumb.webp') && lire('decouvrir/en/modules.js').length > 1000, 'les vignettes anglaises des cours');
  assert.ok(i.includes('"name":"Do I need programming knowledge to start?"'), 'la FAQ des moteurs de recherche aussi');
  assert.ok(i.includes("['SELECT',' first_name, city']") && i.includes("toLocaleString('en-US')"), 'la requête tapée et les nombres');
  assert.ok(i.includes('lang="fr" data-href="../"'), 'le français mène à la page française');
  for (const f of ['conditions.html', 'confidentialite.html', 'mentions-legales.html'])
    assert.ok(lire('decouvrir/en/' + f).includes('This is a translation: if it differs from the French version, the French version prevails.'), f);
});

test('pas encore ouvertes : ni dans le menu français, ni dans les moteurs de recherche ; la voix reste à faire', () => {
  const publie = lire('decouvrir/index.html').includes('lang="en" data-href="en/');
  for (const f of PAGES) assert.equal(lire('decouvrir/en/' + f).includes('<meta name="robots" content="noindex">'), !publie || f === 'connexion.html', f);
  if (!publie) assert.ok(lire('decouvrir/index.html').includes('data-soon="English version coming soon."'));
  /* La vidéo et les avis audio cherchent leur voix dans le dossier anglais : muets tant qu’elle n’y est pas, jamais en français */
  assert.ok(!lire('decouvrir/en/video.html').includes('../voix/'));
});

test('les règles du site valent aussi en anglais : pas de « sans compte », pas de prix de l’abonnement', () => {
  for (const f of PAGES) {
    const t = lire('decouvrir/en/' + f).replace(/<script[\s\S]*?<\/script>|<!--[\s\S]*?-->/g, '');
    assert.doesNotMatch(t, /without an account|no account needed|sans compte/i, f);
    assert.doesNotMatch(t, /€\s?\d+(\.\d+)?\s?(\/|per) ?(month|year|week)/i, f);
  }
});

test('l’outil du site : récolter, construire, vérifier, publier ; documenté', () => {
  const t = lire('tools/langue/site.mjs');
  for (const k of ["'recolter'", "'construire'", "'verifier'", "'publier'", 'export function adresse(', 'export function traduireCode(', "D['js:' + s.v]"]) assert.ok(t.includes(k), k);
  const D = JSON.parse(lire('tools/langue/site/en.json'));
  assert.ok(Object.keys(D).length > 900);
  for (const [k, v] of Object.entries(D)) {
    const o = k.match(/<\d+\/>/g) || [], p = v.match(/<\d+\/>/g) || [];
    assert.deepEqual(p.sort(), o.sort(), 'les mêmes dessins : ' + k.slice(0, 80));
  }
  assert.ok(lire('tools/langue/README.md').includes('site.mjs'));
});
