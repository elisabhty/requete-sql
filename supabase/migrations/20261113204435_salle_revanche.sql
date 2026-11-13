-- Elisa, 13 novembre, 21 h 33 : « Touche revanche pour dire que tu es de la partie […] on attend que soit les personnes quittent la
-- salle, soit appuient sur revanche […] à la fin que tout le monde a appuyé, soit sur quitte la salle, soit sur revanche, ça relance ».
-- Sur le podium, chacun (l’hôte aussi) touche « Revanche » ; l’appli envoie { t:'revanche', on } (on : il en est, ou se ravise).
-- jeu_envoyer_v2 l’accepte de tout membre de la salle et le fait suivre à tous avec on (vrai ou faux, rien d’autre) ; la génération
-- (g) est celle du serveur, comme pour les autres messages. Quand tous ceux qui restent ont dit oui, l’hôte relance (« again »).
-- jeu_envoyer_v2 est recréée telle qu’elle est en service (pg_get_functiondef) : seuls la liste des messages et le cas « revanche »
-- changent ; si l’une des deux n’est plus celle attendue, rien n’est changé.
-- Essayée à blanc (BEGIN … ROLLBACK), puis appliquée au projet Supabase « requete-sql » (ynuenrxozcpkrjdbeftc) le 13 novembre 2026,
-- vers 21 h 44, avec l’accord d’Elisa (« Oui, applique ») ; vérifiée ensuite : la liste des messages et le cas « revanche » sont en
-- service.
do $t$
declare
  def text;
  types_avant constant text := $a$or t not in ('cfg','hello','ping','ready','round','react','bye','host','close','end','again','retire') then$a$;
  types_apres constant text := $a$or t not in ('cfg','hello','ping','ready','round','react','bye','host','close','end','again','retire','revanche') then$a$;
  ping_avant constant text := $a$ when 'ping' then null;$a$;
  ping_apres constant text := $a$ when 'revanche' then   -- « Revanche » sur le podium : chacun dit s’il en est (13 novembre 2026)
   m:=m||jsonb_build_object('on',coalesce(p_m->'on'='true'::jsonb,false));
 when 'ping' then null;$a$;
begin
  def := pg_get_functiondef('public.jeu_envoyer_v2(text,jsonb,text)'::regprocedure);
  if (length(def) - length(replace(def, types_avant, ''))) / length(types_avant) <> 1
     or (length(def) - length(replace(def, ping_avant, ''))) / length(ping_avant) <> 1 then
    raise exception 'jeu_envoyer_v2 n’est plus celle attendue : rien n’est changé';
  end if;
  execute replace(replace(def, types_avant, types_apres), ping_avant, ping_apres);
end $t$;
