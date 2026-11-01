-- The verified client is published before disabling the legacy protocol.
revoke all on function
 public.jeu_envoyer(text,jsonb),
 public.jeu_historique(text,integer),
 public.jeu_balise(text),
 public.jeu_score(text,text,jsonb),
 public.jeu_defis(text,jsonb,jsonb)
from public, anon, authenticated;

-- Remove plaintext remnants from early verification tests.
update requete_private.essai
set requete=encode(extensions.digest(requete,'sha256'),'hex')
where requete !~ '^[a-f0-9]{64}$';
