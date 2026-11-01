create or replace function public.jeu_envoyer_v2(p_salle text,p_m jsonb,p_cle text) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 k text:=public.jeu_cle(p_cle); ident jsonb; v_pid text; nom text; t text:=p_m->>'t';
 r requete_private.salle%rowtype; member requete_private.membre%rowtype; rd requete_private.manche%rowtype;
 m jsonb; now_at timestamptz:=clock_timestamp(); cv bigint; prior public.jeu_msg%rowtype;
 count_live integer; old_host text; candidate text; n integer; selected text; players jsonb;
begin
 ident:=public.jeu_identite_v2(p_cle); v_pid:=ident->>'pid'; nom:=ident->>'pseudo';
 if p_salle is null or p_salle !~ '^[A-Z0-9]{6}$' or p_m is null or jsonb_typeof(p_m)<>'object'
    or octet_length(p_m::text)>2048 or p_m->>'pid' is distinct from v_pid
    or coalesce(p_m->>'u','') !~ '^[A-Za-z0-9]{8,32}$'
    or t not in ('cfg','hello','ping','ready','round','react','bye','host','close','end','again') then
   raise exception 'message non autorisé' using errcode='42501';
 end if;
 if t='cfg' then
   if (select count(*) from requete_private.salle where host=v_pid and cree>now_at-interval '1 minute')>=10 then
     raise exception 'trop de salles' using errcode='54000'; end if;
   insert into requete_private.salle(code,host,solo) values(p_salle,v_pid,coalesce((p_m->>'solo')::boolean,false)) on conflict do nothing;
 end if;
 select * into r from requete_private.salle where code=p_salle for update;
 if not found then raise exception 'salle introuvable' using errcode='22023'; end if;
 select msg.* into prior from public.jeu_msg msg where msg.salle=p_salle and msg.m->>'u'=p_m->>'u' limit 1;
 if found then
   if prior.m->>'pid' is distinct from v_pid then raise exception 'message non autorisé' using errcode='42501'; end if;
   return jsonb_build_object('n',prior.n,'at',floor(extract(epoch from prior.cree)*1000));
 end if;
 select * into member from requete_private.membre where code=p_salle and membre.pid=v_pid;
 if not found and (t='hello' or (t='cfg' and r.host=v_pid)) then
   select count(*) into count_live from requete_private.membre where code=p_salle and not parti and vu>now_at-interval '55 seconds';
   if count_live >= (case when r.solo then 1 else 5 end) then raise exception 'salle pleine' using errcode='54000'; end if;
   insert into requete_private.membre(code,pid,cle,pseudo,pret) values(p_salle,v_pid,k,nom,r.host=v_pid) returning * into member;
 end if;
 if member.cle is distinct from k then raise exception 'membre non autorisé' using errcode='42501'; end if;
 if member.parti and t<>'hello' then raise exception 'rejoins la salle' using errcode='42501'; end if;
 if t='hello' and member.parti then
   select count(*) into count_live from requete_private.membre where code=p_salle and not parti and vu>now_at-interval '55 seconds';
   if count_live>= (case when r.solo then 1 else 5 end) then raise exception 'salle pleine' using errcode='54000'; end if;
 end if;
 if t not in ('hello','ping','bye','react') and coalesce((p_m->>'g')::integer,-1)<>r.generation and t<>'again' then
   raise exception 'partie périmée' using errcode='22023'; end if;
 cv:=floor(extract(epoch from now_at)*1000)::bigint;
 m:=jsonb_build_object('v',1,'t',t,'pid',v_pid,'name',nom,'s',left(coalesce(p_m->>'s',''),20),'u',p_m->>'u','g',r.generation,'cv',cv);
 case t
 when 'cfg' then
   if r.host<>v_pid or exists(select 1 from requete_private.manche where code=p_salle and generation=r.generation) then raise exception 'réglage non autorisé' using errcode='42501'; end if;
   n:=(p_m->>'n')::integer;
   if n not in (1,3,5) or not exists(select 1 from requete_private.catalogue where niv=p_m->>'niv') then raise exception 'réglage invalide'; end if;
   update requete_private.salle set niv=p_m->>'niv',manches=n where code=p_salle;
   m:=m||jsonb_build_object('niv',p_m->>'niv','n',n,'max',case when r.solo then 1 else 5 end);
 when 'hello' then
   update requete_private.membre set parti=false where code=p_salle and membre.pid=v_pid;
 when 'ready' then
   if exists(select 1 from requete_private.manche where code=p_salle and generation=r.generation) then raise exception 'partie déjà lancée'; end if;
   update requete_private.membre set pret=coalesce((p_m->>'on')::boolean,false) where code=p_salle and membre.pid=v_pid;
   m:=m||jsonb_build_object('on',coalesce((p_m->>'on')::boolean,false));
 when 'round' then
   if r.host<>v_pid or r.fini then raise exception 'lancement non autorisé' using errcode='42501'; end if;
   n:=(p_m->>'n')::integer;
   if n<0 or n>=r.manches or n<>(select count(*) from requete_private.manche where code=p_salle and generation=r.generation) then raise exception 'manche invalide'; end if;
   if exists(select 1 from requete_private.membre where code=p_salle and not parti and vu>now_at-interval '55 seconds' and not pret and membre.pid<>v_pid) and n=0 then raise exception 'joueurs pas prêts'; end if;
   if n>0 then
     select * into rd from requete_private.manche where code=p_salle and generation=r.generation and numero=n-1;
     if not rd.fermee and now_at<rd.debut+interval '10 minutes' and exists(
       select 1 from requete_private.membre mb where mb.code=p_salle and not mb.parti and mb.vu>now_at-interval '55 seconds' and rd.joueurs ? mb.pid
       and not exists(select 1 from requete_private.essai e where e.code=p_salle and e.generation=r.generation and e.numero=n-1 and e.pid=mb.pid and e.juste)
     ) then raise exception 'manche en cours'; end if;
     update requete_private.manche set fermee=true where code=p_salle and generation=r.generation and numero=n-1;
   end if;
   selected:=p_m->>'cid';
   if not exists(select 1 from requete_private.catalogue where id=selected and niv=r.niv) or exists(select 1 from requete_private.manche where code=p_salle and generation=r.generation and defi=selected) then raise exception 'défi invalide'; end if;
   select jsonb_agg(mb.pid order by mb.arrive) into players from requete_private.membre mb where mb.code=p_salle and not mb.parti and mb.vu>now_at-interval '55 seconds';
   insert into requete_private.manche(code,generation,numero,defi,debut,joueurs,solo) values(p_salle,r.generation,n,selected,now_at+interval '3300 milliseconds',players,r.solo or jsonb_array_length(players)=1);
   m:=m||jsonb_build_object('n',n,'cid',selected,'one',case when r.solo or jsonb_array_length(players)=1 then 1 else 0 end,'startAt',cv+3300);
 when 'close' then
   if r.host<>v_pid then raise exception 'fermeture non autorisée' using errcode='42501'; end if;
   update requete_private.manche set fermee=true where code=p_salle and generation=r.generation and numero=(p_m->>'n')::integer;
   if not found then raise exception 'manche introuvable'; end if;
   m:=m||jsonb_build_object('n',(p_m->>'n')::integer);
 when 'end' then
   if r.host<>v_pid then raise exception 'fin non autorisée' using errcode='42501'; end if;
   update requete_private.salle set fini=true where code=p_salle;
   update requete_private.manche set fermee=true where code=p_salle and generation=r.generation;
 when 'again' then
   if r.host<>v_pid or not r.fini or (p_m->>'g')::integer<>r.generation+1 then raise exception 'relance non autorisée' using errcode='42501'; end if;
   update requete_private.salle set generation=generation+1,fini=false where code=p_salle;
   update requete_private.membre set pret=(membre.pid=v_pid) where code=p_salle;
   m:=m||jsonb_build_object('g',r.generation+1);
 when 'host' then
   if exists(select 1 from requete_private.membre where code=p_salle and membre.pid=r.host and not parti and vu>now_at-interval '80 seconds') then raise exception 'hôte encore présent' using errcode='42501'; end if;
   select mb.pid into candidate from requete_private.membre mb where mb.code=p_salle and mb.pid<>r.host and not mb.parti and mb.vu>now_at-interval '55 seconds' order by mb.arrive,mb.pid limit 1;
   if candidate is distinct from v_pid then raise exception 'relais non autorisé' using errcode='42501'; end if;
   old_host:=r.host;update requete_private.salle set host=v_pid where code=p_salle;
   m:=m||jsonb_build_object('from',old_host);
 when 'bye' then update requete_private.membre set parti=true where code=p_salle and membre.pid=v_pid;
 when 'react' then
   if coalesce(p_m->>'e','') not in ('👏','🔥','😅','🤯') then raise exception 'réaction invalide'; end if;
   m:=m||jsonb_build_object('e',p_m->>'e');
 when 'ping' then null;
 else raise exception 'message non autorisé' using errcode='42501';
 end case;
 update requete_private.membre set vu=now_at,pseudo=nom where code=p_salle and membre.pid=v_pid;
 return public.jeu_envoyer(p_salle,m);
end $$;