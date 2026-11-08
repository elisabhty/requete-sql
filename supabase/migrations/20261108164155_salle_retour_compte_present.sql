-- Elisa, 8 novembre, 17 h 31 : « quand je quitte et que je reviens sur la page, je ne veux pas que ça se bloque (quand je vais sur une
-- autre appli par exemple) ». De retour (« hello »), un joueur est compté présent avant que le serveur regarde la manche en cours :
-- son dernier signe de vie datait d’avant son départ, et seul dans la salle, parti plus de 55 s, il retrouvait la manche fermée.
-- jeu_envoyer_v2 est recréée telle qu’elle est en service (pg_get_functiondef) : seule cette ligne change ; si elle n’est plus
-- celle attendue, rien n’est changé.
do $$
declare
  def text;
  neuf text;
  avant constant text := 'update requete_private.membre set parti=false where code=p_salle and membre.pid=v_pid;';
begin
  def := pg_get_functiondef('public.jeu_envoyer_v2(text,jsonb,text)'::regprocedure);
  if (length(def) - length(replace(def, avant, ''))) / length(avant) <> 1 then
    raise exception 'arrivée introuvable dans jeu_envoyer_v2';
  end if;
  neuf := replace(def, avant, 'update requete_private.membre set parti=false,vu=now_at where code=p_salle and membre.pid=v_pid;');
  execute neuf;
end $$;
