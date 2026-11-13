/* Elisa, 6 novembre, 11 h 12 : « ne mets jamais “prochainement”, car l’app sera publiée et je vais oublier de les enlever pour la
   mise en prod ». Son choix (« Ceux liés à la sortie ») : sur le site, plus de « Bientôt sur l’App Store » ni de Google Play ;
   le badge de l’App Store est un lien vers la fiche de Requête ; « Requête, dans ta poche » ; les conditions parlent de
   l’application pour iPhone. Les autres « bientôt » (langues du site, connexion, parcours à venir) ne dépendent pas de la sortie. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const lire = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const FICHE = 'https://apps.apple.com/app/id6830361256';
const PAGES = ['index.html', 'conditions.html', 'confidentialite.html', 'mentions-legales.html', 'module.html'];

test('le site : le badge de l’App Store mène à la fiche, plus de Google Play, plus de « bientôt » lié à la sortie', () => {
  for (const f of PAGES) {
    const p = lire('decouvrir/' + f);
    assert.doesNotMatch(p, /Bientôt sur|bientôt dans ta poche|bientôt en application|aria-label="[^"]*Google Play/, f);
    const badges = p.match(/<a class="store" href="[^"]+" target="_blank" rel="noopener" aria-label="Télécharger dans l’App Store"><svg[\s\S]*?<\/svg><span><small>Télécharger dans<\/small><b>l’App Store<\/b><\/span><\/a>/g) || [];
    assert.equal(badges.length, f === 'index.html' ? 2 : 1, f + ' : le badge, en lien');
    for (const b of badges) assert.ok(b.includes(`href="${FICHE}"`), f + ' : la fiche de Requête');
    assert.ok(!p.includes('<span class="store"'), f + ' : plus de badge-image');
  }
  assert.ok(lire('index.html').includes(`function appStoreFiche(){return '${FICHE}';}`), 'la même fiche que dans l’app');
});

test('la section « mobile » : « Requête, dans ta poche », l’iPhone seulement (13 novembre : plus de navigateur pour les autres téléphones)', () => {
  const h = lire('decouvrir/index.html');
  assert.ok(h.includes('<span class="sticker lav">iPhone<svg'), 'plus d’Android');
  assert.ok(h.includes('<h2 id="mobile-h">Requête, <em>dans ta poche</em>.</h2>'));
  /* 13 novembre, 1 h 44 : l’appli ne s’ouvre plus dans un navigateur (retours-0144-site) */
  assert.ok(!h.includes('Pas d’iPhone') && !h.includes('connexion.html') && !h.includes('ajoute-la à ton écran d’accueil'));
  assert.ok(h.includes('<span>Connexion en un geste avec Apple ou Google&nbsp;: ta progression te suit.</span>'));
  assert.ok(!h.includes('En attendant, Requête'), 'plus d’« en attendant »');
  assert.ok(lire('decouvrir/module.html').includes(`+'<p class="label">L’appli iPhone</p>'+document.querySelector('footer .stores').outerHTML`), 'la fiche d’un parcours');
  assert.ok(lire('decouvrir/conditions.html').includes('Requête est une application pour iPhone, à télécharger dans l’App Store&nbsp;; ce site la présente.'));
  const css = lire('decouvrir/vitrine.css');
  assert.ok(css.includes('a.store{cursor:pointer;color:#fff;text-decoration:none;') && css.includes('a.store:focus-visible{outline:3px solid var(--accent);outline-offset:3px}'), 'un lien qui se touche');
});

test('l’app : plus de « Bientôt sur l’App Store », rien à basculer le jour de la sortie', () => {
  const app = lire('index.html');
  assert.doesNotMatch(app, /Bientôt sur l’App Store|arrive bientôt sur l’App Store|bientôt sur l’App Store|appStoreEnLigne/);
});
