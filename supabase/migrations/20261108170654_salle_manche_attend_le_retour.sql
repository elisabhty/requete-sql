-- Elisa, 8 novembre, 18 h 01 : « pourquoi quand je rafraîchis la page ça m’amène à la manche suivante ? ». Recharger la page envoie
-- « bye » ; seule dans la salle, plus personne n’était présent, et la manche se fermait aussitôt (« Manche abandonnée »), puis la
-- suivante partait. Désormais, une manche ne se ferme plus parce que personne n’est là : elle attend un retour jusqu’à la fin de son
-- chrono. Elle se ferme toujours à la fin du chrono, ou quand tous les joueurs présents ont trouvé (un absent ne bloque rien).
-- close_if_finished est recréée telle qu’elle est en service (pg_get_functiondef) : seule sa condition change ; si elle n’est plus
-- celle attendue, rien n’est changé.
do $$
declare
  def text;
  neuf text;
  avant constant text := E'and exists(\n   select 1 from requete_private.membre mb where mb.code=p_code and rd.joueurs ? mb.pid and not mb.parti and mb.vu>clock_timestamp()-interval ''55 seconds''\n   and not exists(select 1 from requete_private.essai e where e.code=p_code and e.generation=p_g and e.numero=p_n and e.pid=mb.pid and e.juste)\n ) then return; end if;';
  apres constant text := E'and (exists(\n   select 1 from requete_private.membre mb where mb.code=p_code and rd.joueurs ? mb.pid and not mb.parti and mb.vu>clock_timestamp()-interval ''55 seconds''\n   and not exists(select 1 from requete_private.essai e where e.code=p_code and e.generation=p_g and e.numero=p_n and e.pid=mb.pid and e.juste)\n ) or not exists(\n   select 1 from requete_private.membre mb where mb.code=p_code and rd.joueurs ? mb.pid and not mb.parti and mb.vu>clock_timestamp()-interval ''55 seconds''\n )) then return; end if;';
begin
  def := pg_get_functiondef('requete_private.close_if_finished(text,integer,integer)'::regprocedure);
  if (length(def) - length(replace(def, avant, ''))) / length(avant) <> 1 then
    raise exception 'condition introuvable dans close_if_finished';
  end if;
  neuf := replace(def, avant, apres);
  execute neuf;
end $$;
