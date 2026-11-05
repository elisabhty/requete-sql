-- Salle de défi (Elisa, 5 novembre, 9 h 18 ; appliquée avec son accord à 10 h 16).
-- 1. Un essai manqué est annoncé à la salle (message « rate ») : pendant qu’ils cherchent, les autres voient passer le pseudo et une
--    croix. Seulement pendant la manche, entre amis, tant que le joueur n’a pas trouvé ; rien n’est dit de la requête elle-même. Si la
--    salle a trop de messages, l’annonce est perdue, mais l’essai est bien enregistré.
-- 2. Le +25 du premier essai ne va plus qu’au premier à trouver, entre amis (« quand une personne a mis la bonne requête, enlever les
--    +25 aux autres ») ; seul, chaque premier essai juste le garde.
create or replace function public.jeu_valider_v2(p_id uuid,p_juste boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare e requete_private.essai%rowtype; rd requete_private.manche%rowtype; mb requete_private.membre%rowtype; t integer; m jsonb; ouverte boolean; deja boolean;
begin
 select * into e from requete_private.essai where id=p_id;
 if not found then raise exception 'essai introuvable'; end if;
 perform 1 from requete_private.salle where code=e.code for update;
 select * into e from requete_private.essai where id=p_id for update;
 if e.fini then return jsonb_build_object('ok',e.juste); end if;
 select * into rd from requete_private.manche where code=e.code and generation=e.generation and numero=e.numero;
 -- A stale verification cannot reopen a finished round or replace an earlier success.
 ouverte:=not rd.fermee and clock_timestamp()<=rd.debut+interval '10 minutes';
 deja:=exists(select 1 from requete_private.essai where code=e.code and generation=e.generation and numero=e.numero and essai.pid=e.pid and juste);
 p_juste:=coalesce(p_juste,false) and ouverte and not deja;
 t:=greatest(0,floor(extract(epoch from e.cree-rd.debut)*1000)::integer);
 update requete_private.essai set fini=true,juste=p_juste,ms=case when p_juste then t end where id=e.id;
 select * into mb from requete_private.membre where code=e.code and pid=e.pid;
 if p_juste then
   m:=jsonb_build_object('v',1,'t','found','pid',e.pid,'name',mb.pseudo,'u',replace(e.id::text,'-',''),'g',e.generation,'n',e.numero,'ms',t,'p1',case when e.premier then 1 else 0 end);
   perform public.jeu_envoyer(e.code,m);
   perform requete_private.close_if_finished(e.code,e.generation,e.numero);
 elsif ouverte and not deja and not coalesce(rd.solo,false) then
   m:=jsonb_build_object('v',1,'t','rate','pid',e.pid,'name',mb.pseudo,'u',replace(e.id::text,'-',''),'g',e.generation,'n',e.numero);
   begin
     perform public.jeu_envoyer(e.code,m);
   exception when others then null;
   end;
 end if;
 return jsonb_build_object('ok',p_juste,'ms',case when p_juste then t end);
end $$;

create or replace function public.jeu_score_v2(p_cle text, p_pseudo text, p_partie jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 k text:=public.jeu_cle(p_cle); v_pid text:=left(k,24); v_code text:=p_partie->>'salle'; v_g integer:=(p_partie->>'g')::integer;
 r requete_private.salle%rowtype; pts integer; n integer; ok integer; all_solo boolean; receipt text;
begin
 select * into r from requete_private.salle where salle.code=v_code for update;
 if not found or not exists(select 1 from requete_private.membre where membre.code=v_code and membre.pid=v_pid and cle=k) then raise exception 'partie non vérifiée' using errcode='42501'; end if;
 with finished as (
   select rd.* from requete_private.manche rd where rd.code=v_code and rd.generation=v_g and (rd.fermee or rd.debut+interval '10 minutes'<clock_timestamp() or not exists(
     select 1 from requete_private.membre mb where mb.code=v_code and rd.joueurs ? mb.pid and not mb.parti and mb.vu>clock_timestamp()-interval '55 seconds'
     and not exists(select 1 from requete_private.essai ee where ee.code=v_code and ee.generation=v_g and ee.numero=rd.numero and ee.pid=mb.pid and ee.juste)
   ))
 ), gains as (
   select rd.*,e.ms,e.premier,
    (select count(*) from requete_private.essai other where other.code=v_code and other.generation=v_g and other.numero=rd.numero and other.juste and other.ms<e.ms) as rang
   from finished rd left join requete_private.essai e on e.code=rd.code and e.generation=rd.generation and e.numero=rd.numero and e.pid=v_pid and e.juste
 ) select count(*),count(ms),coalesce(bool_and(solo),true),coalesce(sum(case when ms is null then 0 else
   case when floor(ms/1000.0)<=60 then 200 when floor(ms/1000.0)<=120 then 175 when floor(ms/1000.0)<=180 then 150 when floor(ms/1000.0)<=240 then 125 when floor(ms/1000.0)<=300 then 100 when floor(ms/1000.0)<=420 then 75 else 50 end
   +case when premier and (solo or rang=0) then 25 else 0 end+case when solo then 0 when rang=0 then 50 when rang=1 then 30 when rang=2 then 20 when rang=3 then 10 else 0 end end),0)
 into n,ok,all_solo,pts from gains;
 if n<1 then raise exception 'partie non terminée'; end if;
 receipt:=left(encode(extensions.digest(r.id::text||':'||v_g,'sha256'),'hex'),24);
 return public.jeu_score(p_cle,p_pseudo,jsonb_build_object('u',receipt,'pts',pts,'n',n,'ok',ok,'solo',case when all_solo then 1 else 0 end,'niv',r.niv));
end $$;

revoke all on function public.jeu_valider_v2(uuid,boolean),public.jeu_score_v2(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.jeu_score_v2(text,text,jsonb) to anon,authenticated;
grant execute on function public.jeu_valider_v2(uuid,boolean) to service_role;
