/* 5 novembre, 20 h 15 (Elisa) : à la question « les 11 cartes à la première personne, je les passe en « on », ou tu préfères garder
   la voix du candidat ? », « Met tous en « Je » pour les entretiens » ; les textes de la Bibliothèque ; et l’avis demandé sur ses
   icônes : Entretien SQL, « je remplacerais le micro par une icône de conversation avec un petit symbole de code » ; Selon le SGBD,
   « une icône avec deux bases de données côte à côte serait plus explicite ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const E = (() => { const c = {}; vm.runInNewContext((cut('const ENTRETIEN=[\n', '\n];') + '\n];').replace('const ENTRETIEN=', 'this.E='), c); return c.E; })();
const carte = id => E.find(q => q.id === id);
const texte = q => [q.a, q.apres || ''].join('\n\n').replace(/<code>.*?<\/code>/g, 'CODE');

test('Entretien SQL : toutes les réponses à la première personne, comme le candidat les dirait', () => {
  assert.equal(E.length, 142);
  /* Plus de « on » dans la réponse : seules les relances du recruteur le gardent (« Peut-on… ? », « Et si on… ? ») */
  const relances = ['Et si on groupe par la clé primaire ?', 'Et si on recrée la table ?'];
  for (const q of E) {
    let t = texte(q);
    for (const r of relances) t = t.replace(r, '');
    const m = t.match(/(?<![A-Za-zÀ-ÿ’'-])(on|On|l’on|qu’on|Qu’on)(?![A-Za-zÀ-ÿ’'])/);
    assert.equal(m, null, `${q.id} : « ${m && t.slice(Math.max(0, m.index - 30), m.index + 30)} »`);
    assert.ok(!/(?<![A-Za-zÀ-ÿ])[Jj]e [aeiouéèêh]/.test(t), q.id + ' : « je » s’élide devant une voyelle');
    assert.ok(!/(?<![A-Za-zÀ-ÿ])(tu|toi|ton|ta|tes|vous|votre|vos)(?![A-Za-zÀ-ÿ])/i.test(t), q.id + ' : le candidat parle de lui, pas à quelqu’un');
    for (const k of ['a', 'apres']) if (q[k]) {
      const s = q[k].replace(/<code>.*?<\/code>/g, 'CODE');
      assert.ok(!/ [:;?!]/.test(s) && !/[A-Za-zÀ-ÿ)][;?!]/.test(s), q.id + ' : espace insécable avant « : ; ? ! »');
      assert.ok(!/[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ]/.test(s), q.id + ' : apostrophe typographique');
    }
  }
  assert.ok(E.filter(q => /(?<![A-Za-zÀ-ÿ])([Jj]e |[Jj]’)/.test(texte(q))).length >= 110, 'presque toutes les cartes parlent en « je » (les autres sont des définitions)');
  /* Quelques réponses, telles que le candidat les dit */
  assert.ok(carte('ent-v2-121').a.includes('Je choisis le plus souvent une clé artificielle comme clé primaire'));
  assert.ok(carte('ent-v2-06').a.includes('j’écarte les vélos en réparation dans <code>WHERE</code>, puis je filtre sur <code>COUNT(*)</code> dans <code>HAVING</code>.'));
  assert.ok(carte('ent-v2-88').a.includes('Je m’en sers pour générer toutes les combinaisons') && carte('ent-v2-89').a.includes('ou le séparateur de mon choix'));
  assert.ok(carte('ent-v2-66').a.includes('Pour les limiter, j’accède aux lignes toujours dans le même ordre'), 'les conseils aussi');
  assert.ok(carte('ent-v2-112').a.includes('En entretien, je précise le dialecte que j’utilise') && carte('ent-v2-112').apres.startsWith('Deux noms reviennent souvent : T-SQL et PL/SQL.'));
  assert.ok(carte('ent-v2-131').a.includes('puis j’observe chacune au fil des mois'), '« je suis chacune » se lisait comme le verbe être');
  /* La relance reste posée par le recruteur, la question aussi */
  assert.ok(carte('ent-v2-08').apres.startsWith('Relance fréquente : peut-on trier sur une colonne absente du <code>SELECT</code> ?'));
  assert.ok(carte('ent-v2-33').q.startsWith('Peut-on sélectionner une colonne non agrégée avec GROUP BY'));
  /* Le site montre toujours le premier paragraphe de la carte ent-v2-06, mot pour mot */
  const vit = fs.readFileSync(path.join(ROOT, 'decouvrir/index.html'), 'utf8');
  assert.ok(vit.includes('<p>' + carte('ent-v2-06').a.split('\n\n')[0] + '</p>'));
});

test('la Bibliothèque : les textes d’Elisa', () => {
  const hub = cut('function renderJourneyHub(tab){', '\n  const hostId=');
  for (const k of ["['cards','Cartes mémo',`${stats.cards} carte${stats.cards>1?'s':''} débloquée${stats.cards>1?'s':''}\\u00a0· Révise l’essentiel.`,\"switchTab('collection')\"]",
    "['notes','Mes notes','Tes notes et requêtes, toujours à portée de main.',\"switchTab('notes')\"]",
    "['interview','Entretien SQL','Entraîne-toi aux questions des recruteurs.',\"switchTab('entretien')\"]",
    "['sgbd','Selon le SGBD','Un même langage, des différences à connaître.',\"switchTab('sgbd')\"]",
    "['courses','Tous les cours',`${MODULES.length} modules pour progresser à ton rythme.`,\"openCourseCatalog()\"]"])
    assert.ok(hub.includes(k), k);
  const cartes = n => vm.runInNewContext('`${stats.cards} carte${stats.cards>1?\'s\':\'\'} débloquée${stats.cards>1?\'s\':\'\'}\\u00a0· Révise l’essentiel.`', { stats: { cards: n } });
  assert.equal(cartes(8), '8 cartes débloquées · Révise l’essentiel.');
  assert.equal(cartes(1), '1 carte débloquée · Révise l’essentiel.');
  const stk = got => { const c = vm.createContext({ stkList: () => Array.from({ length: 21 }, (_, i) => ({ got: i < got })), stkState: () => ({ fresh: {} }) });
    vm.runInContext(cut('function stkHubEntry(){', '\nconst JOURNEY_STK='), c); return vm.runInContext('stkHubEntry()', c); };
  assert.equal(stk(6)[2], '6 sur 21 collectionnés · À toi de jouer !');
  assert.equal(stk(1)[2], '1 sur 21 collectionné · À toi de jouer !');
  assert.ok(!app.includes('Révise à ton rythme.') && !app.includes('Colle-les, imprime-les.') && !app.includes('Prépare tes réponses et teste tes acquis.'));
});

test('les icônes : deux bulles pour Entretien SQL, deux bases pour Selon le SGBD… puis les autocollants reviennent (21 h 54)', () => {
  /* 21 h 54 : « finalement on reste sur la même DA que les icônes » de Mon compte : les icônes fines (et ces deux-là) sont parties,
     chaque ligne retrouve son autocollant (retours-2154) */
  assert.ok(!app.includes('const JOURNEY_ICO={'));
  assert.ok(app.includes("const JOURNEY_STK={defis:'trophy',console:'term',cards:'cards',stickers:'peel',notes:'note',interview:'mic',sgbd:'db',courses:'book'};"));
});
