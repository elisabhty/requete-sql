-- Server-owned identities, room membership, attempts and ranking receipts.
create schema if not exists requete_private;
revoke all on schema requete_private from public, anon, authenticated;
create table requete_private.catalogue(id text primary key, niv text not null check(niv in ('f','m','d')));
create table requete_private.salle(
 code text primary key, id uuid not null default gen_random_uuid(), host text not null,
 generation integer not null default 0, niv text not null default 'f', manches integer not null default 1,
 solo boolean not null default false, fini boolean not null default false, cree timestamptz not null default now()
);
create table requete_private.membre(
 code text not null references requete_private.salle(code) on delete cascade,
 pid text not null, cle text not null, pseudo text not null, arrive timestamptz not null default clock_timestamp(),
 vu timestamptz not null default clock_timestamp(), parti boolean not null default false, pret boolean not null default false,
 primary key(code,pid)
);
create table requete_private.manche(
 code text not null references requete_private.salle(code) on delete cascade, generation integer not null, numero integer not null,
 defi text not null references requete_private.catalogue(id), debut timestamptz not null, fermee boolean not null default false,
 joueurs jsonb not null, solo boolean not null, primary key(code,generation,numero)
);
create table requete_private.essai(
 id uuid primary key default gen_random_uuid(), code text not null, generation integer not null, numero integer not null,
 pid text not null, requete text not null, cree timestamptz not null default clock_timestamp(),
 fini boolean not null default false, juste boolean not null default false, ms integer, premier boolean not null default false,
 foreign key(code,generation,numero) references requete_private.manche(code,generation,numero) on delete cascade
);
create index essai_joueur on requete_private.essai(code,generation,numero,pid,cree);
create unique index une_reussite on requete_private.essai(code,generation,numero,pid) where juste;
create index if not exists jeu_msg_identifiant on public.jeu_msg(salle,(m->>'u'));
alter table requete_private.salle enable row level security;
alter table requete_private.membre enable row level security;
alter table requete_private.manche enable row level security;
alter table requete_private.essai enable row level security;
alter table requete_private.catalogue enable row level security;
revoke all on all tables in schema requete_private from public,anon,authenticated;

create function public.jeu_identite_v2(p_cle text) returns jsonb language plpgsql security definer set search_path='' as $$
declare k text:=public.jeu_cle(p_cle); nom text;
begin
 select pseudo into nom from public.jeu_pseudo where cle=k;
 if k is null or nom is null then raise exception 'pseudo réservé requis' using errcode='42501'; end if;
 return jsonb_build_object('pid',left(k,24),'pseudo',nom);
end $$;

-- This is the only public room writer. The raw device key is never relayed or stored.
create function public.jeu_envoyer_v2(p_salle text,p_m jsonb,p_cle text) returns jsonb language plpgsql security definer set search_path='' as $$
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
 select * into prior from public.jeu_msg where salle=p_salle and m->>'u'=p_m->>'u' limit 1;
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

create function public.jeu_historique_v2(p_salle text,p_apres integer,p_cle text)
returns table(n integer,at bigint,m jsonb) language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from requete_private.membre where code=p_salle and cle=public.jeu_cle(p_cle)) then raise exception 'membre non autorisé' using errcode='42501'; end if;
 return query select h.n,h.at,h.m from public.jeu_historique(p_salle,p_apres) h;
end $$;

-- Only the Edge verifier can start/finish an SQL attempt. No client result or time is accepted.
create function public.jeu_essai_v2(p_cle text,p_salle text,p_g integer,p_n integer,p_id uuid,p_sql text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ident jsonb; v_pid text; rd requete_private.manche%rowtype; e requete_private.essai%rowtype; first_try boolean;
begin
 ident:=public.jeu_identite_v2(p_cle);v_pid:=ident->>'pid';
 perform 1 from requete_private.salle where code=p_salle for update;
 if not exists(select 1 from requete_private.membre where code=p_salle and membre.pid=v_pid and cle=public.jeu_cle(p_cle) and not parti) then raise exception 'membre non autorisé' using errcode='42501'; end if;
 select * into e from requete_private.essai where id=p_id;
 if found then
   if e.pid<>v_pid or e.code<>p_salle or e.generation<>p_g or e.numero<>p_n or e.requete<>p_sql then raise exception 'essai non autorisé' using errcode='42501'; end if;
   return jsonb_build_object('id',e.id,'fini',e.fini,'juste',e.juste,'defi',(select defi from requete_private.manche where code=e.code and generation=e.generation and numero=e.numero));
 end if;
 select * into rd from requete_private.manche where code=p_salle and generation=p_g and numero=p_n;
 if not found or not (rd.joueurs ? v_pid) or rd.fermee or clock_timestamp()<rd.debut or clock_timestamp()>rd.debut+interval '10 minutes' then raise exception 'manche terminée ou non commencée'; end if;
 if p_sql is null or octet_length(p_sql)>12000 then raise exception 'requête trop longue'; end if;
 if exists(select 1 from requete_private.essai where code=p_salle and generation=p_g and numero=p_n and essai.pid=v_pid and (juste or cree>clock_timestamp()-interval '800 milliseconds')) then raise exception 'attends un instant' using errcode='54000'; end if;
 select not exists(select 1 from requete_private.essai where code=p_salle and generation=p_g and numero=p_n and essai.pid=v_pid) into first_try;
 insert into requete_private.essai(id,code,generation,numero,pid,requete,premier) values(p_id,p_salle,p_g,p_n,v_pid,p_sql,first_try);
 return jsonb_build_object('id',p_id,'defi',rd.defi,'fini',false);
end $$;

create function public.jeu_valider_v2(p_id uuid,p_juste boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare e requete_private.essai%rowtype; rd requete_private.manche%rowtype; mb requete_private.membre%rowtype; t integer; m jsonb;
begin
 select * into e from requete_private.essai where id=p_id;
 if not found then raise exception 'essai introuvable'; end if;
 perform 1 from requete_private.salle where code=e.code for update;
 select * into e from requete_private.essai where id=p_id for update;
 if e.fini then return jsonb_build_object('ok',e.juste); end if;
 select * into rd from requete_private.manche where code=e.code and generation=e.generation and numero=e.numero;
 -- A stale verification cannot reopen a finished round or replace an earlier success.
 p_juste:=coalesce(p_juste,false) and not rd.fermee and clock_timestamp()<=rd.debut+interval '10 minutes'
   and not exists(select 1 from requete_private.essai where code=e.code and generation=e.generation and numero=e.numero and essai.pid=e.pid and juste);
 t:=greatest(0,floor(extract(epoch from e.cree-rd.debut)*1000)::integer);
 update requete_private.essai set fini=true,juste=p_juste,ms=case when p_juste then t end where id=e.id;
 if p_juste then
   select * into mb from requete_private.membre where code=e.code and pid=e.pid;
   m:=jsonb_build_object('v',1,'t','found','pid',e.pid,'name',mb.pseudo,'u',replace(e.id::text,'-',''),'g',e.generation,'n',e.numero,'ms',t,'p1',case when e.premier then 1 else 0 end);
   perform public.jeu_envoyer(e.code,m);
 end if;
 return jsonb_build_object('ok',p_juste,'ms',case when p_juste then t end);
end $$;

create function public.jeu_score_v2(p_cle text,p_pseudo text,p_partie jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
   +case when premier then 25 else 0 end+case when solo then 0 when rang=0 then 50 when rang=1 then 30 when rang=2 then 20 when rang=3 then 10 else 0 end end),0)
 into n,ok,all_solo,pts from gains;
 if n<1 then raise exception 'partie non terminée'; end if;
 receipt:=left(encode(extensions.digest(r.id::text||':'||v_g,'sha256'),'hex'),24);
 return public.jeu_score(p_cle,p_pseudo,jsonb_build_object('u',receipt,'pts',pts,'n',n,'ok',ok,'solo',case when all_solo then 1 else 0 end,'niv',r.niv));
end $$;

revoke all on function public.jeu_identite_v2(text),public.jeu_envoyer_v2(text,jsonb,text),public.jeu_historique_v2(text,integer,text),public.jeu_score_v2(text,text,jsonb),public.jeu_essai_v2(text,text,integer,integer,uuid,text),public.jeu_valider_v2(uuid,boolean) from public,anon,authenticated;
grant execute on function public.jeu_identite_v2(text),public.jeu_envoyer_v2(text,jsonb,text),public.jeu_historique_v2(text,integer,text),public.jeu_score_v2(text,text,jsonb) to anon,authenticated;
grant execute on function public.jeu_essai_v2(text,text,integer,integer,uuid,text),public.jeu_valider_v2(uuid,boolean) to service_role;
-- Secure rooms expire with the existing hourly cleanup, including all their verification records.
create function requete_private.menage() returns void language sql security definer set search_path='' as $$
 delete from requete_private.salle where cree<clock_timestamp()-interval '24 hours';
$$;
revoke all on function requete_private.menage() from public,anon,authenticated;
select cron.schedule('jeu-securite-menage','27 * * * *','select requete_private.menage()');

insert into requete_private.catalogue(id,niv) values ('af1','f'),('af2','f'),('af3','f'),('af4','f'),('af5','f'),('af6','f'),('af7','f'),('af8','f'),('af9','f'),('af10','f'),('af11','f'),('af12','f'),('af13','f'),('af14','f'),('af15','f'),('af16','f'),('af17','f'),('af18','f'),('af19','f'),('af20','f'),('af21','f'),('af22','f'),('af23','f'),('af24','f'),('af25','f'),('af26','f'),('af27','f'),('af28','f'),('af29','f'),('af30','f'),('af31','f'),('af32','f'),('af33','f'),('am1','m'),('am2','m'),('am3','m'),('am4','m'),('am5','m'),('am6','m'),('am7','m'),('am8','m'),('am9','m');

