-- Elisa, 9 novembre, 14 h 09 : « tous prêts : l’hôte lance immédiatement ; un ou plusieurs joueurs non prêts : l’hôte peut lancer
-- après 30 secondes, sans les joueurs non prêts » ; « si un joueur clique sur Prêt·e exactement au moment où l’hôte lance, le serveur
-- doit figer la liste des participants au démarrage ».
-- jeu_envoyer_v2 :
--   - première manche lancée par une appli qui envoie la liste des prêts (who) : les participants sont les présents que le serveur
--     sait prêts (pret, mis par les messages « ready », refusés dès qu’une manche existe), plus l’hôte ; c’est le serveur qui tranche,
--     pas la liste de l’appli. Une appli d’avant (sans who) : tous les présents, comme avant ;
--   - manches suivantes : les présents parmi les participants de la première (un absent de la partie n’y entre pas en route) ;
--   - le message de la manche porte la liste (joueurs) : chaque téléphone affiche la même ;
--   - relais d’hôte en cours de partie : seulement entre participants.
-- jeu_envoyer_v2 est recréée telle qu’elle est en service (pg_get_functiondef) ; si un passage n’est plus celui attendu, rien n’est
-- changé.
-- Appliquée au projet Supabase « requete-sql » (ynuenrxozcpkrjdbeftc, Paris) le 9 novembre 2026, vers 14 h 20, avec l’accord d’Elisa
-- (« Oui, applique-le ») ; vérifiée ensuite : les trois passages sont en service.
do $t$
declare
  def text;
  joueurs_avant constant text := $a$into players,cles,v_cat from requete_private.membre mb where mb.code=p_salle and not mb.parti and mb.vu>now_at-interval '55 seconds';$a$;
  joueurs_apres constant text := $a$into players,cles,v_cat from requete_private.membre mb where mb.code=p_salle and not mb.parti and mb.vu>now_at-interval '55 seconds'
       and (case when n=0 then not (p_m ? 'who') or mb.pret or mb.pid=r.host   -- figés au lancement : les prêts et l’hôte (9 novembre 2026)
            else coalesce((select z.joueurs ? mb.pid from requete_private.manche z where z.code=p_salle and z.generation=r.generation and z.numero=0),true) end);$a$;
  message_avant constant text := $a$'startAt',cv+3300);$a$;
  message_apres constant text := $a$'startAt',cv+3300,'joueurs',players);$a$;
  relais_avant constant text := $a$select mb.pid into candidate from requete_private.membre mb where mb.code=p_salle and mb.pid<>r.host and not mb.parti and mb.vu>now_at-interval '55 seconds' order by mb.arrive,mb.pid limit 1;$a$;
  relais_apres constant text := $a$select mb.pid into candidate from requete_private.membre mb where mb.code=p_salle and mb.pid<>r.host and not mb.parti and mb.vu>now_at-interval '55 seconds'
     and coalesce((select z.joueurs ? mb.pid from requete_private.manche z where z.code=p_salle and z.generation=r.generation and z.numero=0),true)   -- entre participants
     order by mb.arrive,mb.pid limit 1;$a$;
  n_occ integer;
begin
  def := pg_get_functiondef('public.jeu_envoyer_v2(text,jsonb,text)'::regprocedure);
  foreach n_occ in array array[
    (length(def) - length(replace(def, joueurs_avant, ''))) / length(joueurs_avant),
    (length(def) - length(replace(def, message_avant, ''))) / length(message_avant),
    (length(def) - length(replace(def, relais_avant, ''))) / length(relais_avant)] loop
    if n_occ <> 1 then raise exception 'jeu_envoyer_v2 n’est plus celle attendue : rien n’est changé'; end if;
  end loop;
  execute replace(replace(replace(def, joueurs_avant, joueurs_apres), message_avant, message_apres), relais_avant, relais_apres);
end $t$;
