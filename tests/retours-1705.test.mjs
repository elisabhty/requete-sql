/* 4 novembre, 17 h 05 (Elisa, sur « tout est ok via Supabase ? 3 migrations prêtes, pas appliquées ») : « ok vas-y ».
   Les trois migrations sont appliquées à la base de l’appli : le vote des parcours, les avis sur les leçons et l’entonnoir de
   l’onboarding (l’appli appelait déjà onboarding_compter : 23 refus dans la journée, gardés sur les appareils puis renvoyés).
   Supabase leur a donné un numéro à l’application : les fichiers du dépôt prennent ce numéro, comme les autres, et celui des pièces
   jointes du contact (appliqué le 1er novembre sous 20261101083415, au même contenu) aussi. La confidentialité et le guide iOS
   disent ce qui part désormais. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const migrations = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort();
const app = lire('index.html');

test('les fichiers des migrations portent le numéro sous lequel la base les a appliquées', () => {
  for (const f of ['20261101083415_contact_pieces_jointes.sql', '20261104160653_parcours_vote.sql', '20261104160655_avis_lecon.sql',
    '20261104160656_onboarding_entonnoir.sql'])
    assert.ok(migrations.includes(f), f);
  for (const vieux of ['20261101093000', '20261103181500', '20261104123500', '20261104135000'])
    assert.ok(!migrations.some(f => f.startsWith(vieux)), `${vieux} : renommé`);
  const versions = migrations.map(f => f.slice(0, 14));
  assert.ok(versions.every(v => /^\d{14}$/.test(v)), 'un numéro AAAAMMJJHHMMSS devant chaque fichier');
  assert.equal(new Set(versions).size, versions.length, 'pas deux fois le même numéro');
  /* Plus aucun renvoi vers les anciens noms */
  const fichiers = ['index.html', 'IOS.md', ...fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.mjs')).map(f => `tests/${f}`)]
    .filter(f => f !== 'tests/retours-1705.test.mjs');
  for (const f of fichiers) {
    const t = lire(f);
    for (const vieux of ['20261101093000_', '20261103181500_', '20261104123500_', '20261104135000_']) assert.ok(!t.includes(vieux), `${f} : ${vieux}`);
  }
});

test('l’appli appelle chaque fonction avec les paramètres de sa migration', () => {
  const sig = (fichier, nom) => {
    const sql = lire(`supabase/migrations/${fichier}`);
    const m = sql.match(new RegExp(`create or replace function public\\.${nom}\\(([^)]*)\\)`));
    assert.ok(m, nom);
    return m[1].split(',').map(p => p.trim().split(/\s+/)[0]);
  };
  const appel = nom => {
    const m = app.match(new RegExp(`clsRpc\\('${nom}',\\{([^}]*)\\}`));
    assert.ok(m, `appel de ${nom}`);
    return [...m[1].matchAll(/(p_\w+):/g)].map(x => x[1]);
  };
  assert.deepEqual(appel('onboarding_compter'), sig('20261104160656_onboarding_entonnoir.sql', 'onboarding_compter'));
  assert.deepEqual(appel('lecon_noter'), sig('20261104160655_avis_lecon.sql', 'lecon_noter'));
  /* 16 novembre : le vote est retiré avec les parcours à venir ; l’appli n’appelle plus parcours_voter, ni rien d’autre des parcours */
  assert.ok(!/clsRpc\('parcours_/.test(app) && !app.includes("const PARCOURS="));
});

test('la page de confidentialité dit ce qui part désormais', () => {
  const p = lire('decouvrir/confidentialite.html');
  assert.ok(p.includes('<li><b>Avis sur les leçons</b> (facultatif). Si tu notes une leçon à la fin, ta note (de 1 à 5 étoiles), ton commentaire si tu en laisses un,'));
  /* 14 novembre, 18 h : avec l’accord des statistiques seulement */
  assert.ok(p.includes('<li><b>Écrans de l’accueil</b> (facultatif, avec ton accord). Si tu acceptes les statistiques d’usage anonymes (voir juste après), les écrans de l’accueil de l’appli que tu as vus'));
  assert.ok(p.includes('ni ton nom, ni ton e-mail, ni tes réponses. Nous n’en tirons qu’un décompte (combien d’appareils ont vu chaque écran)'));
  assert.ok(p.includes('ni outil de mesure d’audience d’un tiers, ni pixel de suivi. La seule mesure est celle que Requête fait elle-même, et seulement si tu l’acceptes&nbsp;: les écrans de l’accueil et les statistiques d’usage anonymes (voir plus haut), demandées une fois, au premier lancement.'));
  assert.ok(!p.includes('ni outil de mesure d’audience, ni pixel de suivi'), 'plus « aucune mesure » : les écrans de l’accueil sont comptés');
  /* Dans l’ordre : les avis, les écrans de l’accueil, puis les messages de contact (le vote, retiré le 16 novembre, n’y est plus) */
  assert.ok(!p.includes('<li><b>Vote pour le prochain parcours</b>'));
  const i = ['<li><b>Avis sur les leçons</b>', '<li><b>Écrans de l’accueil</b>', '<li><b>Messages de contact.</b>'].map(k => p.indexOf(k));
  assert.ok(i.every((x, k) => x > 0 && (k === 0 || x > i[k - 1])), i.join(' < '));
});

test('le guide iOS : appliquées, et ce qu’il faut déclarer dans App Store Connect', () => {
  const ios = lire('IOS.md');
  assert.ok(!ios.includes('À appliquer avant l’envoi'), 'plus rien à appliquer');
  for (const k of ['Appliquée le 4 novembre : `supabase/migrations/20261104160655_avis_lecon.sql`.',
    'Appliquée le 4 novembre : `supabase/migrations/20261104160656_onboarding_entonnoir.sql`.',
    '- **Avis sur les leçons** (« Donne ton avis sur la leçon », fin de leçon, 4 novembre)', '- **Étapes de l’onboarding** (4 novembre)',
    'vues `avis_lecons` (les\n  leçons les moins bien notées d’abord) et `avis_commentaires`', '**Résultats** : vue `onboarding_entonnoir`'])
    assert.ok(ios.includes(k), k);
});
