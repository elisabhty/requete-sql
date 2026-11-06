-- Elisa, 6 novembre, 15 h, après le rapport de l’expert en game design (le bonus de niveau +25 / +50 de 12 h 42 ne comblait que
-- 7 % de l’écart par heure entre le Facile et le Difficile) : son choix, « Multiplicateur ×2 / ×4 ». En Moyen, tous les points d’une
-- manche trouvée (le palier de temps, le premier coup, la place) comptent double et chaque palier dure 3 fois plus longtemps ; en
-- Difficile, ×4 et 5 fois plus longtemps. Le Facile ne change pas. Manche parfaite : 225, 450 ou 900 seul ; 275, 550 ou 1 100 entre
-- amis. jeu_score_v2 est réécrite en entier (le niveau est celui de la salle) ; jeu_score accepte le plafond qui va avec.
create or replace function public.jeu_score_v2(p_cle text, p_pseudo text, p_partie jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 k text:=public.jeu_cle(p_cle); v_pid text:=left(k,24); v_code text:=p_partie->>'salle'; v_g integer:=(p_partie->>'g')::integer;
 r requete_private.salle%rowtype; pts integer; n integer; ok integer; all_solo boolean; receipt text;
 v_x integer; v_d integer;
begin
 select * into r from requete_private.salle where salle.code=v_code for update;
 if not found or not exists(select 1 from requete_private.membre where membre.code=v_code and membre.pid=v_pid and cle=k) then raise exception 'partie non vérifiée' using errcode='42501'; end if;
 -- le niveau de la salle : les points ×1, ×2 ou ×4, des paliers 1, 3 ou 5 fois plus longs
 v_x:=case r.niv when 'm' then 2 when 'd' then 4 else 1 end;
 v_d:=case r.niv when 'm' then 3 when 'd' then 5 else 1 end;
 with finished as (
   select rd.* from requete_private.manche rd where rd.code=v_code and rd.generation=v_g and (rd.fermee or rd.debut+interval '20 minutes'<clock_timestamp() or not exists(
     select 1 from requete_private.membre mb where mb.code=v_code and rd.joueurs ? mb.pid and not mb.parti and mb.vu>clock_timestamp()-interval '55 seconds'
     and not exists(select 1 from requete_private.essai ee where ee.code=v_code and ee.generation=v_g and ee.numero=rd.numero and ee.pid=mb.pid and ee.juste)
   ))
 ), gains as (
   select rd.*,e.ms,e.premier,
    (select count(*) from requete_private.essai other where other.code=v_code and other.generation=v_g and other.numero=rd.numero and other.juste and other.ms<e.ms) as rang
   from finished rd left join requete_private.essai e on e.code=rd.code and e.generation=rd.generation and e.numero=rd.numero and e.pid=v_pid and e.juste
 ) select count(*),count(ms),coalesce(bool_and(solo),true),coalesce(sum(case when ms is null then 0 else
   (case when floor(ms/1000.0)<=60*v_d then 200 when floor(ms/1000.0)<=120*v_d then 175 when floor(ms/1000.0)<=180*v_d then 150 when floor(ms/1000.0)<=240*v_d then 125 when floor(ms/1000.0)<=300*v_d then 100 when floor(ms/1000.0)<=420*v_d then 75 else 50 end
   +case when premier and (solo or rang=0) then 25 else 0 end+case when solo then 0 when rang=0 then 50 when rang=1 then 30 when rang=2 then 20 when rang=3 then 10 else 0 end)*v_x end),0)
 into n,ok,all_solo,pts from gains;
 if n<1 then raise exception 'partie non terminée'; end if;
 receipt:=left(encode(extensions.digest(r.id::text||':'||v_g,'sha256'),'hex'),24);
 return public.jeu_score(p_cle,p_pseudo,jsonb_build_object('u',receipt,'pts',pts,'n',n,'ok',ok,'solo',case when all_solo then 1 else 0 end,'niv',r.niv));
end $$;

-- jeu_score : le plafond par manche trouvée, multiplié par le niveau (au lieu du bonus de 12 h 42) ; recréée telle qu’elle est en
-- service, seule cette ligne change ; si elle a changé de forme, rien n’est fait.
do $$
declare
  def text;
  avant text := 'v_pts > v_ok * ((case when v_solo then 225 else 275 end) + (case v_niv when ''m'' then 25 when ''d'' then 50 else 0 end))';
begin
  def := pg_get_functiondef('public.jeu_score(text,text,jsonb)'::regprocedure);
  if (length(def) - length(replace(def, avant, ''))) / length(avant) <> 1 then
    raise exception 'plafond de jeu_score introuvable';
  end if;
  execute replace(def, avant,
    'v_pts > v_ok * (case when v_solo then 225 else 275 end) * (case v_niv when ''m'' then 2 when ''d'' then 4 else 1 end)');
end $$;
