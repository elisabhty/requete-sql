/* Elisa, 9 novembre, 9 h 35, à « Le serveur des salles classées accepte toujours la clôture par l’hôte venant des anciennes versions
   de l’appli. Je peux la bloquer côté serveur si tu me dis oui. » : « Oui ». Depuis 8 h 42, l’appli n’a plus de bouton « Clore la
   manche pour tous » (retours-1520-pratiquer) ; le serveur refuse maintenant le « close » d’une appli d’avant : entre amis, une
   manche en cours se clôt seule, quand tous les joueurs présents ont trouvé ou à la fin de son chrono. Appliquée en service le
   9 novembre à 9 h 40 (20261109084034), après un essai dans une transaction annulée. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'supabase', 'migrations');
const mig = fin => { const f = fs.readdirSync(DIR).find(x => x.endsWith(fin)); assert.ok(f, fin); return fs.readFileSync(path.join(DIR, f), 'utf8'); };

test('le serveur refuse le « close » de l’hôte entre amis tant que la manche court : elle se clôt seule', () => {
  assert.ok(fs.existsSync(path.join(DIR, '20261109084034_salle_clore_seule.sql')), 'la version enregistrée en service');
  const m = mig('_salle_clore_seule.sql');
  /* Reprise telle qu’en service, seule la règle « close » change ; rien n’est fait si elle a changé de forme */
  assert.ok(m.includes("def := pg_get_functiondef('public.jeu_envoyer_v2(text,jsonb,text)'::regprocedure);"));
  assert.ok(m.includes("if (length(def) - length(replace(def, avant, ''))) / length(avant) <> 1 then") && m.includes('execute replace(def, avant, apres);'));
  const avant = m.slice(m.indexOf('avant constant text := $a$'), m.indexOf('$a$;', m.indexOf('avant constant text := $a$')));
  const apres = m.slice(m.indexOf('apres constant text := $a$'), m.indexOf('$a$;', m.indexOf('apres constant text := $a$')));
  /* La règle d’avant : refusé seulement dans les 2 minutes après le premier qui a trouvé (defis_anti_triche, 6 novembre) */
  assert.ok(avant.includes("raise exception 'clore la manche : 2 minutes après le premier qui a trouvé' using errcode='P0001';"));
  assert.ok(mig('_defis_anti_triche.sql').includes("raise exception 'clore la manche : 2 minutes après le premier qui a trouvé' using errcode='P0001';"), 'la même que celle en service avant');
  /* La nouvelle : la manche de ce « close » (son numéro), en cours, à plusieurs, avant la fin de son chrono : refusé */
  assert.ok(apres.includes("x.numero=(p_m->>'n')::integer and not x.fermee and not coalesce(x.solo,false)"), 'seulement la manche visée, entre amis');
  assert.ok(apres.includes('and now_at<x.debut+requete_private.manche_duree(x.defi)) then'), 'jusqu’à la fin de son chrono (10, 15 ou 20 min selon le niveau)');
  assert.ok(!apres.includes('min(e.cree)') && !apres.includes("interval '2 minutes'"), 'que quelqu’un ait trouvé ou non');
  assert.ok(apres.includes("raise exception 'La manche se clôt seule : quand tout le monde a trouvé, ou à la fin du chrono.' using errcode='P0001';"));
  /* Ni « end » ni « round » ne changent ; l’essai et l’accord sont notés */
  assert.ok(!m.includes("when 'end'") && !m.includes("when 'round'"));
  assert.ok(m.includes('personne n’a trouvé, l’hôte clôt : refusé') && m.includes('chrono écoulé : accepté ; seule : accepté'));
  assert.ok(m.includes('avec l’accord d’Elisa (« Oui »)'));
});
