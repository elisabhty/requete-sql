-- Elisa, 9 novembre, 13 h 20 : la salle d’attente selon le rôle ; un joueur pas prêt depuis 60 s (« @lili prend son temps… »), l’hôte
-- peut le retirer, après une question, jamais tout seul. L’appli envoie { t:'retire', who, hu } ; jeu_envoyer_v2 l’accepte :
--   - de l’hôte seulement, en salle d’attente (aucune manche de la partie en cours), jamais pour lui-même ;
--   - le joueur visé doit être dans la salle : il est noté parti (et plus prêt), comme s’il avait dit « bye » ; il peut revenir avec
--     le code (un nouveau « hello » le remet dans la salle, comme avant) ;
--   - le message part à tous avec who et hu (l’arrivée visée : un retrait relu dans l’historique ne retire pas celui qui est revenu).
-- jeu_envoyer_v2 est recréée telle qu’elle est en service (pg_get_functiondef) : seuls la liste des messages et le cas « retire »
-- changent ; si l’une des deux n’est plus celle attendue, rien n’est changé.
do $t$
declare
  def text;
  types_avant constant text := $a$or t not in ('cfg','hello','ping','ready','round','react','bye','host','close','end','again') then$a$;
  types_apres constant text := $a$or t not in ('cfg','hello','ping','ready','round','react','bye','host','close','end','again','retire') then$a$;
  bye_avant constant text := $a$ when 'bye' then
   update requete_private.membre set parti=true where code=p_salle and membre.pid=v_pid;$a$;
  bye_apres constant text := $a$ when 'retire' then   -- l’hôte retire un joueur de la salle d’attente (9 novembre 2026)
   if r.host<>v_pid or exists(select 1 from requete_private.manche x where x.code=p_salle and x.generation=r.generation) then
     raise exception 'retrait non autorisé' using errcode='42501'; end if;
   if coalesce(p_m->>'who','')='' or p_m->>'who'=v_pid then raise exception 'retrait invalide' using errcode='22023'; end if;
   update requete_private.membre set parti=true,pret=false where code=p_salle and membre.pid=p_m->>'who' and not parti;
   if not found then raise exception 'joueur absent de la salle' using errcode='22023'; end if;
   m:=m||jsonb_build_object('who',p_m->>'who','hu',left(coalesce(p_m->>'hu',''),20));
 when 'bye' then
   update requete_private.membre set parti=true where code=p_salle and membre.pid=v_pid;$a$;
begin
  def := pg_get_functiondef('public.jeu_envoyer_v2(text,jsonb,text)'::regprocedure);
  if (length(def) - length(replace(def, types_avant, ''))) / length(types_avant) <> 1
     or (length(def) - length(replace(def, bye_avant, ''))) / length(bye_avant) <> 1 then
    raise exception 'jeu_envoyer_v2 n’est plus celle attendue : rien n’est changé';
  end if;
  execute replace(replace(def, types_avant, types_apres), bye_avant, bye_apres);
end $t$;
