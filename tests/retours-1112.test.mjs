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

/* 13 novembre, 2 h 41 (Elisa : « mettre sur le site bientôt pour Google Play, sans lien ») : à côté du badge de l’App Store, un badge
   « Bientôt sur Google Play » qui ne se touche pas (clair, en pointillé, une icône de téléphone, pas le logo de Google). Le « bientôt »
   lié à la sortie de l’app iPhone reste parti. */
test('le site : le badge de l’App Store mène à la fiche ; « Bientôt sur Google Play » à côté, sans lien', () => {
  for (const f of PAGES) {
    const p = lire('decouvrir/' + f);
    assert.doesNotMatch(p, /Bientôt sur l’App Store|bientôt dans ta poche|bientôt en application|href="[^"]*play\.google/, f);
    const badges = p.match(/<a class="store" href="[^"]+" target="_blank" rel="noopener" aria-label="Télécharger dans l’App Store"><svg[\s\S]*?<\/svg><span><small>Télécharger dans<\/small><b>l’App Store<\/b><\/span><\/a>/g) || [];
    assert.equal(badges.length, f === 'index.html' ? 2 : 1, f + ' : le badge, en lien');
    for (const b of badges) assert.ok(b.includes(`href="${FICHE}"`), f + ' : la fiche de Requête');
    const bientot = p.match(/<\/a><span class="store soon" role="img" aria-label="Bientôt sur Google Play"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"[^>]*aria-hidden="true"><rect [^>]*\/><path [^>]*\/><\/svg><span><small>Bientôt sur<\/small><b>Google Play<\/b><\/span><\/span><\/div>/g) || [];
    assert.equal(bientot.length, badges.length, f + ' : après chaque badge de l’App Store, dans la même rangée');
    assert.equal((p.match(/Google Play/g) || []).length, bientot.length * 2 + (f === 'index.html' ? 2 : f === 'mentions-legales.html' ? 1 : 0), f + ' : nulle part ailleurs (sauf la FAQ de l’accueil, et les marques citées dans les mentions légales)');
    assert.doesNotMatch(p, /<a[^>]*class="store soon"|#00D7FE|#00F076/, f + ' : ni lien, ni logo');
  }
  const css = lire('decouvrir/vitrine.css');
  assert.ok(css.includes('.store.soon{background:#F3F0FF;color:var(--ink);border:1.5px dashed #B3A9DC;box-shadow:none;cursor:default}') && css.includes('.store.soon small{color:var(--ink-3)}'));
  const h = lire('decouvrir/index.html');
  for (const t of ['Oui, sur iPhone : Requête est une application à part entière, à télécharger dans l’App Store. La version Android arrive bientôt, sur Google Play.',
    'Oui, sur iPhone&nbsp;: Requête est une application à part entière, à télécharger dans l’App Store. La version Android arrive bientôt, sur Google Play.'])
    assert.ok(h.includes(t), 'la FAQ le dit aussi (données structurées et à l’écran)');
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
  assert.ok(lire('decouvrir/module.html').includes(`+'<p class="label">L’appli mobile</p>'+document.querySelector('footer .stores').outerHTML`), 'la fiche d’un parcours');
  assert.ok(lire('decouvrir/conditions.html').includes('Requête est une application pour iPhone, à télécharger dans l’App Store&nbsp;; ce site la présente.'));
  const css = lire('decouvrir/vitrine.css');
  assert.ok(css.includes('a.store{cursor:pointer;color:#fff;text-decoration:none;') && css.includes('a.store:focus-visible{outline:3px solid var(--accent);outline-offset:3px}'), 'un lien qui se touche');
});

test('l’app : plus de « Bientôt sur l’App Store », rien à basculer le jour de la sortie', () => {
  const app = lire('index.html');
  assert.doesNotMatch(app, /Bientôt sur l’App Store|arrive bientôt sur l’App Store|bientôt sur l’App Store|appStoreEnLigne/);
});
