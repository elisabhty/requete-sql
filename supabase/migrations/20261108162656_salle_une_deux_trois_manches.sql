-- Elisa, 8 novembre, 17 h 08 : « on va partir sur 1 / 2 / 3 manches car 5 ça fait trop ». Le serveur accepte 2 manches ;
-- 5 reste accepté le temps que les applis déjà installées (elles proposent encore 1, 3 ou 5) soient mises à jour.
-- jeu_envoyer_v2 est recréée telle qu’elle est en service (pg_get_functiondef) : seul son réglage des manches change ;
-- s’il n’est plus celui attendu, rien n’est changé.
do $$
declare
  def text;
  neuf text;
begin
  def := pg_get_functiondef('public.jeu_envoyer_v2(text,jsonb,text)'::regprocedure);
  if (length(def) - length(replace(def, 'n not in (1,3,5)', ''))) / length('n not in (1,3,5)') <> 1 then
    raise exception 'réglage des manches introuvable dans jeu_envoyer_v2';
  end if;
  neuf := replace(def, 'n not in (1,3,5)', 'n not in (1,2,3,5)');
  execute neuf;
end $$;
