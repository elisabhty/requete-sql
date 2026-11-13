/* Elisa, 13 novembre, 11 h 29 : « complète » (les sept « à compléter » des pages légales du site, en ligne).
   - L’éditrice, la directrice de la publication et la responsable du traitement : Elisa Blanchart, entrepreneur individuel (EI).
   - Le SIRET et l’adresse : ceux de l’avis de situation au répertoire Sirene qu’elle a joint, daté du 13 novembre 2026
     (911 203 370 00034 ; le dossier de janvier portait encore l’ancien établissement, 00026).
   - 11 h 41, « tu peux mettre hormend AI lab etc » : l’enseigne HORMEND AI LABS et le nom commercial HORMEND, comme dans l’avis.
   - Le téléphone : elle le donnera plus tard ; à sa demande, la ligne est masquée d’ici là (plus de « à compléter » en ligne).
   - Le médiateur : MCP Médiation, retrouvé dans ses mails à sa demande (convention du 31 janvier 2026, attestation valable
     jusqu’au 31 janvier 2027, au nom de Hormend Nutrition, le nom commercial de la même entreprise individuelle). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, 'decouvrir', f), 'utf8');
const mentions = lire('mentions-legales.html'), conf = lire('confidentialite.html'), cond = lire('conditions.html');
const luhn = s => [...s].reverse().reduce((t, c, i) => { let d = +c; if (i % 2) { d *= 2; if (d > 9) d -= 9; } return t + d; }, 0) % 10 === 0;

test('plus aucun « à compléter » sur le site', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'decouvrir')).filter(f => f.endsWith('.html'))) {
    const p = lire(f);
    assert.ok(!p.includes('class="todo"'), `${f} : une case à compléter`);
    assert.ok(!/à compléter/i.test(p), `${f} : « à compléter »`);
  }
});

test('mentions légales : l’éditrice, son SIRET, son adresse, la directrice de la publication ; pas de ligne de téléphone vide', () => {
  const bloc = /<section id="editeur">[\s\S]*?<\/section>/.exec(mentions)[0];
  assert.ok(bloc.includes('<dt>Éditeur</dt><dd>Elisa Blanchart, entrepreneur individuel (EI)</dd>'));
  /* 11 h 41 (« tu peux mettre hormend AI lab etc ») : l’enseigne et le nom commercial, écrits comme dans l’avis Sirene */
  assert.ok(bloc.includes('<dt>Éditeur</dt><dd>Elisa Blanchart, entrepreneur individuel (EI)</dd>\n<dt>Enseigne</dt><dd>HORMEND AI LABS (nom commercial&nbsp;: HORMEND)</dd>\n<dt>SIRET</dt>'));
  assert.ok(bloc.includes('<dt>SIRET</dt><dd>911&nbsp;203&nbsp;370&nbsp;00034</dd>'));
  const siret = /<dt>SIRET<\/dt><dd>([^<]+)<\/dd>/.exec(bloc)[1].replace(/&nbsp;/g, '');
  assert.match(siret, /^\d{14}$/); assert.ok(luhn(siret) && luhn(siret.slice(0, 9)), 'la clé du SIRET et celle du SIREN');
  assert.ok(bloc.includes('<dt>Adresse</dt><dd>78 avenue des Champs-Élysées, Bureau 326, 75008 Paris</dd>'));
  assert.ok(bloc.includes('<dt>E-mail</dt><dd><a href="mailto:contact@requeteapp.com">contact@requeteapp.com</a></dd>'));
  assert.ok(bloc.includes('<dt>Directrice de la publication</dt><dd>Elisa Blanchart</dd>'));
  assert.ok(!bloc.includes('Téléphone'), 'la ligne revient avec le numéro');
  assert.equal((bloc.match(/<dt>/g) || []).length, 6);
  assert.ok(mentions.includes('<p class="lg-maj">Dernière mise à jour&nbsp;: 13 novembre 2026</p>'));
  /* L’hébergeur garde le sien */
  assert.ok(mentions.includes('Téléphone&nbsp;: +1 877 448 4820'));
});

test('confidentialité : le responsable du traitement est nommé', () => {
  assert.ok(conf.includes('<section id="responsable"><h2>Responsable du traitement</h2><p>Le responsable du traitement est l’éditeur de Requête (Elisa Blanchart, entrepreneur individuel, enseigne HORMEND AI LABS), joignable à <a href="mailto:contact@requeteapp.com">contact@requeteapp.com</a>.</p></section>'));
});

test('conditions : le médiateur de la consommation, quand et comment le saisir', () => {
  const bloc = /<section id="droit">[\s\S]*?<\/section>/.exec(cond)[0];
  assert.ok(bloc.includes('Ces conditions sont soumises au droit français. En cas de désaccord, écris-nous d’abord&nbsp;: nous cherchons une solution amiable.'));
  /* Ce que le médiateur demande d’écrire : la réclamation écrite d’abord, deux mois, gratuit, un an, en ligne ou par courrier */
  for (const t of ['ta réclamation écrite', 'dans un délai de deux mois', 'gratuitement', 'dans l’année qui suit cette réclamation', 'articles L.&nbsp;611-1 et R.&nbsp;612-1 et suivants du Code de la consommation',
    '<b>MCP Médiation</b>', '<a href="https://www.mcpmediation.org" target="_blank" rel="noopener">www.mcpmediation.org</a>', 'Médiation de la Consommation et Patrimoine, 12 square Desnouettes, 75015 Paris'])
    assert.ok(bloc.includes(t), t);
});
