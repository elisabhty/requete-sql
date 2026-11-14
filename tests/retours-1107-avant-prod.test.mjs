/* Elisa, 13 novembre, 11 h 07 : « ok pas de bug côté code et supabase, tout est ok ? on va bientôt déployer en prod ».
   La vérification a trouvé deux bugs dans la base, corrigés par 20261113101430_correctifs_jeton_ile_et_stat_oublier.sql
   (appliquée à la production avec son accord, puis vérifiée par un essai annulé) :
   1. Le jeton de la Live Activity d’une salle n’était jamais gardé : « {16,400} » dépasse la limite des expressions régulières
      de Postgres (255 répétitions). jeu_ile_jeton_v2 échouait à chaque appel avec un jeton (17 sur 17 le 12 novembre), et la
      contrainte de la table aurait refusé la ligne : l’île d’une salle ne pouvait pas être mise à jour, l’appli fermée.
   2. stat_oublier n’existait pas : l’appli l’appelle (« Supprimer mon compte », l’interrupteur des statistiques qu’on coupe) et
      recevait 404 ; les statistiques anonymes restaient, alors que la politique de confidentialité dit qu’elles sont effacées.
   Ces tests gardent les deux familles d’erreurs : une fonction appelée par l’appli sans migration qui la crée, et une
   répétition de plus de 255 dans la dernière version d’une fonction ou d’une contrainte. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const MIG = path.join(ROOT, 'supabase/migrations');
const fichiers = fs.readdirSync(MIG).filter(f => f.endsWith('.sql')).sort();
const migrations = fichiers.map(f => [f, fs.readFileSync(path.join(MIG, f), 'utf8')]);
const tout = migrations.map(m => m[1]).join('\n');

/* La dernière définition de chaque fonction publique, dans l’ordre des migrations */
function dernieres() {
  const der = new Map();
  for (const [f, sql] of migrations) {
    const re = /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/gi;
    let m;
    while ((m = re.exec(sql))) {
      const apres = sql.slice(m.index);
      const balise = (/\bas\s+(\$[a-z_]*\$)/i.exec(apres) || [])[1];
      assert.ok(balise, `${f} : le corps de ${m[1]}`);
      const debut = apres.indexOf(balise) + balise.length, fin = apres.indexOf(balise, debut);
      assert.ok(fin > debut, `${f} : la fin de ${m[1]}`);
      der.set(m[1], {fichier: f, corps: apres.slice(debut, fin)});
    }
  }
  return der;
}
const trop = s => [...s.matchAll(/\{(\d*),?(\d+)\}/g)].filter(m => +m[2] > 255 || +m[1] > 255).map(m => m[0]);

test('chaque fonction de la base appelée par l’appli ou par une fonction Edge est créée par une migration', () => {
  const definies = new Set(dernieres().keys());
  const sources = ['index.html', ...fs.readdirSync(ROOT).filter(f => f.endsWith('.js'))];
  for (const d of fs.readdirSync(path.join(ROOT, 'supabase/functions')))
    for (const f of fs.readdirSync(path.join(ROOT, 'supabase/functions', d))) if (/\.(ts|mjs)$/.test(f)) sources.push(`supabase/functions/${d}/${f}`);
  const appels = new Map();
  for (const f of sources) {
    const s = lire(f);
    for (const m of s.matchAll(/(?:clsRpc|\.rpc|\brpc)\(\s*['"]([a-z0-9_]+)['"]/g)) appels.set(m[1], f);
    for (const m of s.matchAll(/rest\/v1\/rpc\/([a-z0-9_]+)/g)) appels.set(m[1], f);
  }
  assert.ok(appels.size >= 35, `${appels.size} fonctions appelées`);
  /* La salle de défi passe par son propre relais, qui ajoute « _v2 » et la clé de l’appareil : ce sont celles-là qui partent */
  const app = lire('index.html');
  assert.ok(app.includes("if(secure){opt.body=JSON.stringify(Object.assign({},body,{p_cle:clsCle()}));fn+='_v2';}"));
  for (const ancien of ['jeu_historique', 'jeu_envoyer']) { assert.ok(appels.has(ancien)); appels.delete(ancien); assert.ok(definies.has(ancien + '_v2'), ancien + '_v2'); }
  const absentes = [...appels.keys()].filter(n => !definies.has(n)).sort();
  assert.deepEqual(absentes, [], 'appelées, mais créées par aucune migration');
  assert.ok(appels.has('stat_oublier') && appels.has('jeu_ile_jeton_v2') && appels.has('compte_supprimer'));
});

test('stat_oublier efface les statistiques de l’appareil, avec la même empreinte brouillée que stat_noter', () => {
  const der = dernieres(), oublier = der.get('stat_oublier'), noter = der.get('stat_noter');
  assert.equal(oublier.fichier, '20261113101430_correctifs_jeton_ile_et_stat_oublier.sql');
  const empreinte = "encode(extensions.digest(v_cle || ':stat', 'sha256'), 'hex')";
  assert.ok(noter.corps.includes(`v_app := ${empreinte};`) && oublier.corps.includes(`where appareil = ${empreinte};`));
  assert.ok(oublier.corps.includes('v_cle text := public.jeu_cle(p_cle);') && oublier.corps.includes("if v_cle is null then raise exception 'clé invalide'"));
  assert.ok(oublier.corps.includes('delete from requete_private.stat_evenement') && oublier.corps.includes("return jsonb_build_object('ok', true, 'n', n);"));
  const sql = lire('supabase/migrations/' + oublier.fichier);
  assert.ok(/create or replace function public\.stat_oublier\(p_cle text\)\s+returns jsonb language plpgsql security definer set search_path to ''/.test(sql));
  assert.ok(sql.includes('revoke all on function public.stat_oublier(text) from public, anon, authenticated;\ngrant execute on function public.stat_oublier(text) to anon, authenticated;'));
  /* L’appli : la clé de l’appareil, « ok » attendu ; appelée à la suppression du compte et quand on coupe les statistiques */
  const app = lire('index.html');
  assert.ok(app.includes("return clsRpc('stat_oublier',{p_cle:cle||clsCle()}).then(r=>!!(r&&r.ok)).catch(()=>false);"));
  assert.ok(app.includes("if(typeof statOublier==='function')await statOublier(cle);") && app.includes('if(!on)statOublier();'));
  /* … ce que promet la politique de confidentialité */
  assert.match(lire('decouvrir/confidentialite.html'), /Supprimer mon compte[\s\S]{0,700}statistiques d’usage/);
});

test('aucune répétition de plus de 255 dans la dernière version d’une fonction ou d’une contrainte (limite de Postgres)', () => {
  /* La forme qui a cassé : acceptée à la création, refusée à l’exécution (« invalid repetition count(s) ») */
  assert.deepEqual(trop("jeton ~ '^[0-9a-f]{16,400}$'"), ['{16,400}']);
  assert.deepEqual(trop("p !~ '^[A-Z0-9]{6}$' and x ~ '^[0-9a-f]{64}$' and y ~ '^.{2,255}$'"), []);
  const der = dernieres();
  assert.ok(der.size >= 80, `${der.size} fonctions`);
  for (const [nom, d] of der) assert.deepEqual(trop(d.corps), [], `${nom} (${d.fichier})`);
  /* Le jeton de l’île : la forme et la longueur, contrôlées séparément, dans la fonction comme dans la table */
  const jeton = der.get('jeu_ile_jeton_v2');
  assert.equal(jeton.fichier, '20261113101430_correctifs_jeton_ile_et_stat_oublier.sql');
  assert.ok(jeton.corps.includes("if p_jeton !~ '^[0-9a-f]+$' or length(p_jeton) not between 16 and 400 then\n    raise exception 'jeton invalide' using errcode = '22023';"));
  for (const garde of ["raise exception 'salle invalide'", 'delete from requete_private.ile where code = p_salle and pid = v_pid;', "raise exception 'pas dans cette salle' using errcode = '42501';",
    'on conflict (code, pid) do update set jeton = excluded.jeton, bac = false, maj = clock_timestamp();']) assert.ok(jeton.corps.includes(garde), garde);
  const sql = lire('supabase/migrations/' + jeton.fichier);
  assert.ok(sql.includes("alter table requete_private.ile drop constraint if exists ile_jeton_check;\nalter table requete_private.ile add constraint ile_jeton_check check (jeton ~ '^[0-9a-f]+$' and length(jeton) between 16 and 400);"));
  /* Les contraintes : celle de l’île est la seule à avoir eu ce défaut, et elle est remplacée après sa création */
  const fautives = migrations.filter(([, s]) => [...s.matchAll(/check\s*\(([^;]*?)\)\s*[,;\n]/gi)].some(m => trop(m[1]).length)).map(m => m[0]);
  assert.deepEqual(fautives, ['20261107193840_salle_dans_l_ile.sql']);
  assert.ok(fichiers.indexOf(jeton.fichier) > fichiers.indexOf('20261107193840_salle_dans_l_ile.sql'));
  /* La fonction Edge qui lit ces jetons et l’appli qui les confie n’ont pas changé */
  assert.ok(lire('index.html').includes("clsRpc('jeu_ile_jeton_v2',{p_cle:clsCle(),p_salle:ev.code,p_jeton:ev.jeton})"));
});

test('les migrations du dépôt portent le numéro de version de la base, dans l’ordre', () => {
  assert.equal(fichiers.at(-1), '20261114063120_salle_manches_plus_courtes.sql', 'la dernière : des manches de 6, 12 et 15 min (14 novembre, 7 h 17)');
  for (const f of fichiers) assert.match(f, /^\d{14}_[a-z0-9_]+\.sql$/, f);
  assert.equal(new Set(fichiers.map(f => f.slice(0, 14))).size, fichiers.length, 'un numéro par migration');
});
