-- Elisa, 8 novembre, 9 h 17 (« Ok » à la proposition de 9 h 14) : le bonus du premier coup vaut +25 à tous les niveaux. Il ne compte
-- plus ×2 en Moyen ni ×4 en Difficile : à +100, il dissuadait de lancer une requête pour regarder les données, alors que c’est un bon
-- réflexe en SQL. La vitesse et la place gardent leur multiplicateur. Manche parfaite : 225, 425 ou 825 seul ; 275, 525 ou 1 025 entre
-- amis (jeu_score les accepte déjà : elles restent sous ses bornes de 225 et 275 par manche, ×2 ou ×4).
-- jeu_score_v2 est recréée telle qu’elle est en service, seul son calcul du premier coup change (pg_get_functiondef) ; si ce calcul
-- n’y est plus tel quel, rien n’est changé.
do $$
declare
  def text;
  avant constant text := '+case when premier and (seul or rang=0) then 25 else 0 end+case when seul then 0 when rang=0 then 50 when rang=1 then 30 when rang=2 then 20 when rang=3 then 10 else 0 end)*v_x end),0)';
  apres constant text := '+case when seul then 0 when rang=0 then 50 when rang=1 then 30 when rang=2 then 20 when rang=3 then 10 else 0 end)*v_x+case when premier and (seul or rang=0) then 25 else 0 end end),0)';
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'jeu_score_v2';
  if def is null or (length(def) - length(replace(def, avant, ''))) / length(avant) <> 1 then
    raise exception 'le calcul du premier coup est introuvable dans jeu_score_v2';
  end if;
  execute replace(def, avant, apres);
end $$;
