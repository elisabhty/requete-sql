/* 16 novembre, 8 h 12 (Elisa : « on pourra mettre le SEO après ou on le fait maintenant ? », puis « Ok ») : les bases du
   référencement du site, avant la sortie sur l’App Store. robots.txt et sitemap.xml à la racine (avec les pages anglaises), l’adresse
   principale de chaque page (canonical, celle de la page anglaise pour l’anglais), une image de partage en 1200 × 630 à une adresse
   complète (WhatsApp, Messages, réseaux). Les pages anglaises restent construites par tools/langue/site.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SITE = 'https://requeteapp.com/decouvrir/';

test('robots.txt et sitemap.xml : le site, en français et en anglais ; pas les mises à jour de l’appli', () => {
  const r = lire('robots.txt');
  assert.ok(r.includes('User-agent: *') && r.includes('Disallow: /maj/') && r.includes('Sitemap: https://requeteapp.com/sitemap.xml'));
  const s = lire('sitemap.xml');
  for (const p of ['', 'conditions.html', 'confidentialite.html', 'mentions-legales.html'])
    for (const l of ['', 'en/']) assert.ok(s.includes(`<loc>${SITE}${l}${p}</loc>`), l + p);
  assert.equal((s.match(/<url>/g) || []).length, 8);
  assert.ok(s.includes(`<xhtml:link rel="alternate" hreflang="en" href="${SITE}en/"/>`));
});

test('chaque page a son adresse principale ; l’anglaise, la sienne', () => {
  for (const p of ['index.html', 'conditions.html', 'confidentialite.html', 'mentions-legales.html']) {
    const nom = p === 'index.html' ? '' : p;
    assert.ok(lire('decouvrir/' + p).includes(`<link rel="canonical" href="${SITE}${nom}">`), p);
    assert.ok(lire('decouvrir/en/' + p).includes(`<link rel="canonical" href="${SITE}en/${nom}">`), 'en/' + p);
  }
  assert.ok(lire('decouvrir/en/connexion.html').includes('<link rel="canonical" href="./">'), 'la page de renvoi garde le sien');
  assert.ok(lire('tools/langue/site.mjs').includes("if (can && can.getAttribute('href').startsWith(SITE_P)) can.setAttribute('href', ici);"));
});

test('l’image de partage : 1200 × 630, à une adresse complète, avec og:url et la langue d’à côté', () => {
  const b = fs.readFileSync(path.join(ROOT, 'decouvrir/partage.jpg'));
  assert.equal(b[0], 0xff); assert.equal(b[1], 0xd8);
  assert.ok(b.length < 200000);
  for (const [f, url, loc, alt] of [['decouvrir/index.html', SITE, 'fr_FR', 'en_US'], ['decouvrir/en/index.html', SITE + 'en/', 'en_US', 'fr_FR']]) {
    const h = lire(f);
    assert.ok(h.includes(`<meta property="og:image" content="${SITE}partage.jpg">`) && h.includes('<meta property="og:image:width" content="1200">'), f);
    assert.ok(h.includes(`<meta property="og:url" content="${url}">`) && h.includes(`<meta property="og:locale" content="${loc}">`) && h.includes(`<meta property="og:locale:alternate" content="${alt}">`), f);
    assert.ok(h.includes('<meta name="twitter:card" content="summary_large_image">'), f);
    assert.ok(!h.includes('name="robots"'), f + ' : dans les moteurs de recherche');
  }
});
