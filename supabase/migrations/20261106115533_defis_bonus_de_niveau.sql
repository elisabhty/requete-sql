-- Elisa, 6 novembre, 12 h 42 : « Alors pour les points défis ? », puis son choix, le « Bonus de niveau » : un défi trouvé rapporte
-- en plus +25 en Moyen et +50 en Difficile, rien en Facile (un défi difficile prend plus de temps, et le chrono lui coûtait des points
-- au classement). jeu_score_v2 ajoute ce bonus à chaque manche trouvée, d’après le niveau de la salle ; jeu_score accepte le maximum
-- qui va avec (par manche trouvée : 225, 250 ou 275 seul ; 275, 300 ou 325 entre amis). Comme pour la durée des manches (6 novembre,
-- 7 h 52), chaque fonction est recréée telle qu’elle est en service (pg_get_functiondef), seul le barème change ; si le morceau
-- attendu n’y est pas exactement une fois, rien n’est changé.
do $$
declare
  def text;
  avant text;
begin
  -- jeu_score_v2 : le bonus du niveau de la salle, à chaque manche trouvée (dans le « sinon » d’une manche trouvée)
  def := pg_get_functiondef('public.jeu_score_v2(text,text,jsonb)'::regprocedure);
  avant := '+case when premier and (solo or rang=0) then 25 else 0 end';
  if (length(def) - length(replace(def, avant, ''))) / length(avant) <> 1 then
    raise exception 'barème de jeu_score_v2 introuvable';
  end if;
  execute replace(def, avant, '+(case r.niv when ''m'' then 25 when ''d'' then 50 else 0 end)' || avant);

  -- jeu_score : le plafond par manche trouvée, avec le bonus du niveau
  def := pg_get_functiondef('public.jeu_score(text,text,jsonb)'::regprocedure);
  avant := 'v_pts > v_ok * (case when v_solo then 225 else 275 end)';
  if (length(def) - length(replace(def, avant, ''))) / length(avant) <> 1 then
    raise exception 'plafond de jeu_score introuvable';
  end if;
  execute replace(def, avant,
    'v_pts > v_ok * ((case when v_solo then 225 else 275 end) + (case v_niv when ''m'' then 25 when ''d'' then 50 else 0 end))');
end $$;
