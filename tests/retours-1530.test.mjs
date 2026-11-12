/* 4 novembre, 15 h 30 (Elisa) : « Je m’en fiche pour voix de synthèse, je le garde que dans mes mentions ». La carte de « Ils apprécient
   Requête » dit « De vrais avis, recueillis par Requête » ; la voix de synthèse est dite dans les mentions légales du site, qui parlent
   maintenant aussi de cet écran de l’appli. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), ml = fs.readFileSync(path.join(ROOT, 'decouvrir/mentions-legales.html'), 'utf8');
const i = app.indexOf('/* ---------- « Ils apprécient Requête » (Elisa, 4 novembre, 14 h 08) ----------'), j = app.indexOf('/* 14 h 08 (réf. 3) : « mettre une flèche animée', i);
const code = app.slice(i, j).replace(/\/\*[\s\S]*?\*\//g, '');

test('la carte : « De vrais avis, recueillis sur le site requeteapp.com », sans la voix de synthèse', () => {
  assert.ok(code.includes('<p class="ob-tv-note">De vrais avis, recueillis sur le site requeteapp.com</p>'));
  assert.ok(!/voix de synthèse/.test(code), 'ni sous la photo, ni pour un lecteur d’écran');
});

test('les mentions légales le disent, pour le site et pour l’appli', () => {
  const avis = ml.slice(ml.indexOf('<section id="avis">'), ml.indexOf('</section>', ml.indexOf('<section id="avis">')));
  assert.ok(avis.includes('Les <b>avis audio</b> en haut de la page d’accueil sont lus par une <b>voix de synthèse</b> générée avec ElevenLabs'));
  assert.ok(avis.includes('Les mêmes avis audio sont repris dans l’appli, sur l’écran «&nbsp;Ils apprécient Requête&nbsp;» du parcours de bienvenue, lus par la même voix de synthèse.'));
});
