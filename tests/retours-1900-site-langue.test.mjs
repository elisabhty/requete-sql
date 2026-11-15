// 15 novembre (Elisa : « Afficher le site en anglais selon la personne … oui je vais l'ouvrir aujourd'hui ») : le site anglais ouvert,
// et chacun arrive dans sa langue. Voir LANGUES.md, « Le site en anglais ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const avec = ['index.html', 'module.html', 'conditions.html', 'confidentialite.html', 'mentions-legales.html'];

test('la langue du navigateur : un script en tête des pages, en français comme en anglais', () => {
  for (const p of avec) for (const d of ['decouvrir/', 'decouvrir/en/']) {
    const s = lire(d + p), i = s.indexOf('rq-langue-site');
    assert.ok(i > 0 && i < s.indexOf('</head>'), `${d}${p} : le script de langue`);
    assert.ok(s.indexOf('<meta charset="utf-8">') < s.indexOf('<script>'), `${d}${p} : après le jeu de caractères`);
    for (const m of ['depuis=appli', 'navigator.languages', 'webdriver', "window.top"]) assert.ok(s.includes(m) || (m === 'window.top' && /self\s*!==?\s*top|top\s*!==?\s*self|window\.top/.test(s)), `${d}${p} : ${m}`);
    assert.match(s, /<link rel="alternate" hreflang="fr" href="[^"]+">/, `${d}${p} : hreflang fr`);
    assert.match(s, /<link rel="alternate" hreflang="en" href="[^"]+">/, `${d}${p} : hreflang en`);
  }
});

test('pas de renvoi dans la vidéo (embarquée dans l’appli) ni dans connexion.html', () => {
  for (const f of ['decouvrir/video.html', 'decouvrir/connexion.html', 'decouvrir/en/video.html', 'decouvrir/en/connexion.html'])
    if (existsSync(new URL('../' + f, import.meta.url))) assert.ok(!lire(f).includes('rq-langue-site'), f);
});

test('les pages anglaises sont ouvertes aux moteurs de recherche', () => {
  for (const p of avec) assert.ok(!/noindex/.test(lire('decouvrir/en/' + p)), p);
});

test('l’appli en anglais ouvre les pages anglaises du site', () => {
  const s = lire('index.html'), i = s.indexOf('function siteUrl(chemin){');
  assert.ok(i > 0);
  const corps = s.slice(i, s.indexOf('\n}', i));
  assert.ok(corps.includes("L.code==='en'") && corps.includes("'decouvrir/en/'+chemin.slice(10)"), 'siteUrl : decouvrir/en/');
  assert.ok(corps.indexOf("'decouvrir/en/'") < corps.indexOf('appliNative'), 'avant l’adresse en ligne');
});

test('la vidéo anglaise : les ventes de la démo par État, en dollars ; les formateurs comptent leurs cours anglais', () => {
  const v = lire('decouvrir/en/video.html').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  const montre = v.replace(/<small>k?€<\/small>/g, '');   // les unités que le script remplace (DON.avgU, DON.tjU)
  assert.ok(!/€|Île-de-France|Occitanie|Hauts-de-France|Auvergne/.test(montre), 'plus d’euros ni de régions françaises');
  assert.ok(v.includes('<span>California</span>') && v.includes('>$41K</b>'), 'les ventes par État');
  const i = lire('decouvrir/en/index.html'), titres = [...lire('decouvrir/en/modules.js').matchAll(/titre:"([^"]+)"/g)].map(m => m[1]);
  assert.ok(titres.includes('Joins') && !titres.includes('Jointures'));
  for (const [, l] of i.matchAll(/data-mods="([^"]*)"/g)) for (const t of l.split('|')) assert.ok(titres.includes(t), `data-mods : ${t}`);
});
