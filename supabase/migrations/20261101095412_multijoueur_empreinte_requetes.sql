create or replace function public.jeu_essai_v2(p_cle text,p_salle text,p_g integer,p_n integer,p_id uuid,p_sql text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ident jsonb; v_pid text; rd requete_private.manche%rowtype; e requete_private.essai%rowtype; first_try boolean;
begin
 ident:=public.jeu_identite_v2(p_cle);v_pid:=ident->>'pid';
 perform 1 from requete_private.salle where code=p_salle for update;
 if not exists(select 1 from requete_private.membre where code=p_salle and membre.pid=v_pid and cle=public.jeu_cle(p_cle) and not parti) then raise exception 'membre non autorisé' using errcode='42501'; end if;
 select * into e from requete_private.essai where id=p_id;
 if found then
   if e.pid<>v_pid or e.code<>p_salle or e.generation<>p_g or e.numero<>p_n or e.requete<>encode(extensions.digest(p_sql,'sha256'),'hex') then raise exception 'essai non autorisé' using errcode='42501'; end if;
   return jsonb_build_object('id',e.id,'fini',e.fini,'juste',e.juste,'defi',(select defi from requete_private.manche where code=e.code and generation=e.generation and numero=e.numero));
 end if;
 select * into rd from requete_private.manche where code=p_salle and generation=p_g and numero=p_n;
 if not found or not (rd.joueurs ? v_pid) or rd.fermee or clock_timestamp()<rd.debut or clock_timestamp()>rd.debut+interval '10 minutes' then raise exception 'manche terminée ou non commencée'; end if;
 if p_sql is null or octet_length(p_sql)>12000 then raise exception 'requête trop longue'; end if;
 if exists(select 1 from requete_private.essai where code=p_salle and generation=p_g and numero=p_n and essai.pid=v_pid and (juste or cree>clock_timestamp()-interval '800 milliseconds')) then raise exception 'attends un instant' using errcode='54000'; end if;
 select not exists(select 1 from requete_private.essai where code=p_salle and generation=p_g and numero=p_n and essai.pid=v_pid) into first_try;
 insert into requete_private.essai(id,code,generation,numero,pid,requete,premier) values(p_id,p_salle,p_g,p_n,v_pid,encode(extensions.digest(p_sql,'sha256'),'hex'),first_try);
 return jsonb_build_object('id',p_id,'defi',rd.defi,'fini',false);
end $$;