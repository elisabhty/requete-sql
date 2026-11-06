/* Elisa, 6 novembre, 17 h 16 : « Le résumé de la leçon 45 ne correspond pas à la leçon. Corrige » et « La vidéo de la page d’accueil
   du site dit encore 267 cas pratiques […] Corrige ». La leçon 45 (Sous-requête dans WHERE avec IN) suit le retard de livraison : on filtre
   les clients avec la liste que renvoie la sous-requête ; son résumé parlait d’un autre cas (le Magnésium). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');

test('leçon 45 : le même résumé dans l’appli et sur le site, celui de sa vidéo', () => {
  const app = lire('index.html'), site = lire('decouvrir/modules.js');
  assert.ok(app.includes('guide({ id:45, titre:"Sous-requête dans WHERE avec IN", résumé:"Filtrer avec la liste renvoyée par une sous-requête",'));
  assert.ok(site.includes('["Sous-requête dans WHERE avec IN", "Filtrer avec la liste renvoyée par une sous-requête", 245]'));
  assert.ok(!app.includes('déjà commandé du Magnésium') && !site.includes('déjà commandé du Magnésium'));
  assert.ok(lire('assets/anim/sous-requete-in.html').includes('Sont concernés : les clients dont une commande est <b>en préparation</b>.'), 'la vidéo : les commandes en préparation');
});

test('le site compte 477 cas pratiques partout, la vidéo comprise', () => {
  for (const f of ['decouvrir/index.html', 'decouvrir/video.html', 'decouvrir/connexion.html', 'decouvrir/modules.js'])
    assert.ok(!/\b267\b/.test(lire(f)), f);
  const video = lire('decouvrir/video.html');
  assert.equal((video.match(/477 cas pratiques/g) || []).length, 4, 'l’autocollant, la tuile et les deux phrases lues par VoiceOver');
  assert.ok(!JSON.stringify(JSON.parse(lire('tools/voix/video-site.json'))).match(/cas pratiques|deux cent/), 'la voix ne dit pas ce nombre');
});
