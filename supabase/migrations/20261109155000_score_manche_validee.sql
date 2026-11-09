-- Elisa, 9 novembre, 15 h 41 : « si la personne a validé la manche, même si elle n’a pas terminé les autres manches, elle va gagner
-- ses points ». jeu_score_v2 ne comptait que les manches terminées pour tout le monde (close, chrono écoulé, ou tous les présents ont
-- trouvé) : qui partait pendant la manche qu’il venait de trouver recevait « partie non terminée », et l’appli abandonnait l’envoi ;
-- ses points n’arrivaient jamais au classement. Désormais, une manche que ce joueur a trouvée compte pour lui, même si les autres la
-- jouent encore (son rang y est déjà acquis : qui trouve plus tard a un temps plus long).
-- jeu_score_v2 est recréée telle qu’elle est en service (pg_get_functiondef) : seule la condition « manche terminée » change ; si
-- elle n’est plus celle attendue, rien n’est changé.
do $t$
declare
  def text;
  avant constant text := $a$and (rd.fermee or rd.debut+requete_private.manche_duree(rd.defi)<clock_timestamp() or not exists($a$;
  apres constant text := $a$and (rd.fermee or exists(select 1 from requete_private.essai ej where ej.code=v_code and ej.generation=v_g and ej.numero=rd.numero and ej.pid=v_pid and ej.juste) or rd.debut+requete_private.manche_duree(rd.defi)<clock_timestamp() or not exists($a$;
begin
  def := pg_get_functiondef('public.jeu_score_v2(text,text,jsonb)'::regprocedure);
  if (length(def) - length(replace(def, avant, ''))) / length(avant) <> 1 then
    raise exception 'jeu_score_v2 n’est plus celle attendue : rien n’est changé';
  end if;
  execute replace(def, avant, apres);
end $t$;
