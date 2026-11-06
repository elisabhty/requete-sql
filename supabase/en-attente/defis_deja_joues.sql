-- Elisa, 6 novembre, 15 h 20 : « oui le défi est retiré, mais est-ce que je peux suivre le nombre de défis joués pour chaque
-- personne dans la base de données ? Car s’il n’y en a plus, je dois en remettre ; et si je tombe sur quelqu’un qui a déjà fait un
-- défi, je ne dois pas l’avoir aussi (il ne doit pas être tiré pour lui non plus, ni pour moi) ».
--
-- 1. Le serveur garde, pour chaque joueur (la même empreinte que le classement), les défis qu’il a joués (tirés pendant qu’il était
--    dans la salle) et ceux qu’il a trouvés (requête jugée juste par le serveur) : requete_private.defi_joue. Les essais, eux,
--    restent effacés au bout de 24 heures.
-- 2. Le tirage passe au serveur : à chaque manche, il prend un défi du niveau qu’aucun joueur présent n’a encore joué ni trouvé
--    (ni dans la salle, ni ailleurs dans l’appli : la liste déjà envoyée par l’appli compte aussi). Le défi proposé par l’appli de
--    l’hôte est gardé s’il est dans ce cas ; un défi choisi exprès (« Avec des amis » sur la page d’un défi, imp = 1) aussi. Quand
--    il n’en reste plus, il prend celui que le moins de joueurs présents ont déjà joué, puis trouvé, et le plus anciennement.
-- 3. Chaque appli dit quels défis elle connaît (cat : la version de son catalogue, 1 pour les 267 défis d’aujourd’hui ; sans cat,
--    c’est une appli d’avant, donc 1) : le serveur ne tire que des défis que tous les téléphones de la salle connaissent
--    (catalogue.depuis), pour qu’un défi ajouté plus tard ne bloque pas une appli pas encore mise à jour.
-- 4. Deux vues pour le tableau de bord (Table Editor ou SQL Editor), fermées à l’appli : stats_defis_joues (un joueur par ligne :
--    défis joués, trouvés, faits sur le total par niveau, restants) et stats_defis_restants (une ligne par niveau : combien de défis,
--    le joueur à qui il en reste le moins, combien de joueurs en ont moins de 10 ou plus du tout).
-- 5. « Retirer mes scores du classement », « Effacer la progression » et « Supprimer mon compte » effacent aussi cette liste.

alter table requete_private.catalogue add column if not exists depuis smallint not null default 1;
alter table requete_private.membre add column if not exists cat smallint;

create table if not exists requete_private.defi_joue (
  cle text not null,
  defi text not null,
  niv text not null check (niv in ('f', 'm', 'd')),
  vu timestamptz not null default clock_timestamp(),
  dernier timestamptz not null default clock_timestamp(),
  fois integer not null default 1,
  trouve timestamptz,
  primary key (cle, defi)
);
alter table requete_private.defi_joue enable row level security;
revoke all on table requete_private.defi_joue from public, anon, authenticated;

-- Les manches des dernières 24 heures (le ménage efface les salles plus anciennes) : déjà jouées, et trouvées si l’essai était juste.
insert into requete_private.defi_joue (cle, defi, niv, vu, dernier, fois, trouve)
select mb.cle, rd.defi, c.niv, min(rd.debut), max(rd.debut), count(distinct (rd.code, rd.generation, rd.numero))::integer,
  min(e.cree) filter (where e.juste)
from requete_private.manche rd
join requete_private.membre mb on mb.code = rd.code and rd.joueurs ? mb.pid
join requete_private.catalogue c on c.id = rd.defi
left join requete_private.essai e on e.code = rd.code and e.generation = rd.generation and e.numero = rd.numero and e.pid = mb.pid
where mb.cle is not null
group by mb.cle, rd.defi, c.niv
on conflict (cle, defi) do nothing;

-- Le tirage d’une manche. p_cles : les joueurs présents ; p_cat : la version de catalogue que tous connaissent ; p_cid : le défi
-- proposé par l’appli de l’hôte ; p_impose : un défi choisi exprès, gardé s’il est valable.
create or replace function requete_private.defi_tirer(p_salle text, p_g integer, p_niv text, p_cat integer, p_cles text[], p_cid text, p_impose boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v text;
begin
  if p_impose and exists (select 1 from requete_private.catalogue c where c.id = p_cid and c.niv = p_niv and c.depuis <= p_cat)
     and not exists (select 1 from requete_private.manche rd where rd.code = p_salle and rd.generation = p_g and rd.defi = p_cid) then
    return p_cid;
  end if;
  with faits as (
    select dj.cle, dj.defi, dj.trouve is not null as trouve, dj.dernier
    from requete_private.defi_joue dj where dj.cle = any (coalesce(p_cles, '{}'))
    union all
    select j.cle, d.defi, true, j.defis_maj
    from public.jeu_joueur j cross join lateral unnest(j.defis) as d (defi) where j.cle = any (coalesce(p_cles, '{}'))
  ), par_defi as (
    select f.defi, count(distinct f.cle) as joueurs, count(distinct f.cle) filter (where f.trouve) as trouveurs, max(f.dernier) as dernier
    from faits f group by f.defi
  )
  select c.id into v
  from requete_private.catalogue c
  left join par_defi p on p.defi = c.id
  where c.niv = p_niv and c.depuis <= p_cat
    and not exists (select 1 from requete_private.manche rd where rd.code = p_salle and rd.generation = p_g and rd.defi = c.id)
  order by coalesce(p.joueurs, 0), (c.id is not distinct from p_cid) desc, coalesce(p.trouveurs, 0), p.dernier nulls first, random()
  limit 1;
  return v;
end;
$$;
revoke all on function requete_private.defi_tirer(text, integer, text, integer, text[], text, boolean) from public, anon, authenticated;

-- jeu_envoyer_v2 telle qu’en service, avec : la version de catalogue de chaque appli (cat), le tirage par le serveur
-- (defi_tirer) et les défis joués notés pour chaque joueur présent, y compris celui qui arrive pendant une manche.
create or replace function public.jeu_envoyer_v2(p_salle text, p_m jsonb, p_cle text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
 k text:=public.jeu_cle(p_cle); ident jsonb; v_pid text; nom text; t text:=p_m->>'t';
 r requete_private.salle%rowtype; member requete_private.membre%rowtype; rd requete_private.manche%rowtype;
 m jsonb; now_at timestamptz:=clock_timestamp(); cv bigint; prior public.jeu_msg%rowtype;
 count_live integer; old_host text; candidate text; n integer; selected text; players jsonb;
 cles text[]; v_cat integer;
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
 -- les défis que cette appli connaît (sans cat : une appli d’avant, qui connaît les 267 premiers)
 if coalesce(p_m->>'cat','') ~ '^[0-9]{1,3}$' and member.cat is distinct from (p_m->>'cat')::smallint then
   update requete_private.membre set cat=(p_m->>'cat')::smallint where code=p_salle and membre.pid=v_pid;
 end if;
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
   for rd in select * from requete_private.manche where code=p_salle and generation=r.generation and not fermee loop
     perform requete_private.close_if_finished(p_salle,r.generation,rd.numero);
   end loop;
   update requete_private.manche set joueurs=joueurs||jsonb_build_array(v_pid) where code=p_salle and generation=r.generation and not fermee and not (joueurs ? v_pid);
   -- arrivé pendant une manche : il voit son défi, qui compte comme joué
   insert into requete_private.defi_joue(cle,defi,niv)
   select k,x.defi,r.niv from requete_private.manche x where x.code=p_salle and x.generation=r.generation and not x.fermee and x.joueurs ? v_pid
   on conflict (cle,defi) do nothing;
 when 'ready' then
   if exists(select 1 from requete_private.manche where code=p_salle and generation=r.generation) then raise exception 'partie déjà lancée'; end if;
   update requete_private.membre set pret=coalesce((p_m->>'on')::boolean,false) where code=p_salle and membre.pid=v_pid;
   m:=m||jsonb_build_object('on',coalesce((p_m->>'on')::boolean,false));
 when 'round' then
   if r.host<>v_pid or r.fini then raise exception 'lancement non autorisé' using errcode='42501'; end if;
   n:=(p_m->>'n')::integer;
   if n<0 or n>=r.manches or n<>(select count(*) from requete_private.manche where code=p_salle and generation=r.generation) then raise exception 'manche invalide'; end if;

   if n>0 then
     select * into rd from requete_private.manche where code=p_salle and generation=r.generation and numero=n-1;
     if not rd.fermee and now_at<rd.debut+interval '20 minutes' and exists(
       select 1 from requete_private.membre mb where mb.code=p_salle and not mb.parti and mb.vu>now_at-interval '55 seconds' and rd.joueurs ? mb.pid
       and not exists(select 1 from requete_private.essai e where e.code=p_salle and e.generation=r.generation and e.numero=n-1 and e.pid=mb.pid and e.juste)
     ) then raise exception 'manche en cours'; end if;
     update requete_private.manche set fermee=true where code=p_salle and generation=r.generation and numero=n-1;
   end if;
   select jsonb_agg(mb.pid order by mb.arrive),array_agg(mb.cle),coalesce(min(coalesce(mb.cat,1)),1)
     into players,cles,v_cat from requete_private.membre mb where mb.code=p_salle and not mb.parti and mb.vu>now_at-interval '55 seconds';
   -- le serveur tire le défi : aucun joueur présent ne l’a encore joué ni trouvé, et tous les téléphones le connaissent
   selected:=requete_private.defi_tirer(p_salle,r.generation,r.niv,v_cat,cles,p_m->>'cid',coalesce(p_m->>'imp','')='1');
   if selected is null then raise exception 'défi invalide'; end if;
   insert into requete_private.manche(code,generation,numero,defi,debut,joueurs,solo) values(p_salle,r.generation,n,selected,now_at+interval '3300 milliseconds',players,r.solo or jsonb_array_length(players)=1);
   insert into requete_private.defi_joue(cle,defi,niv)
   select x.cle,selected,r.niv from unnest(cles) as x(cle) where x.cle is not null
   on conflict (cle,defi) do update set dernier=excluded.dernier,fois=requete_private.defi_joue.fois+1;
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
 when 'bye' then
   update requete_private.membre set parti=true where code=p_salle and membre.pid=v_pid;
   for rd in select * from requete_private.manche where code=p_salle and generation=r.generation and not fermee loop
     perform requete_private.close_if_finished(p_salle,r.generation,rd.numero);
   end loop;
 when 'react' then
   if coalesce(p_m->>'e','') not in ('👏','🔥','😅','🤯') then raise exception 'réaction invalide'; end if;
   m:=m||jsonb_build_object('e',p_m->>'e');
 when 'ping' then null;
 else raise exception 'message non autorisé' using errcode='42501';
 end case;
 update requete_private.membre set vu=now_at,pseudo=nom where code=p_salle and membre.pid=v_pid;
 return public.jeu_envoyer(p_salle,m);
end $function$;

-- jeu_valider_v2 telle qu’en service, avec le défi trouvé noté pour le joueur (quand le serveur juge la requête juste).
create or replace function public.jeu_valider_v2(p_id uuid, p_juste boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare e requete_private.essai%rowtype; rd requete_private.manche%rowtype; mb requete_private.membre%rowtype; t integer; m jsonb; ouverte boolean; deja boolean;
begin
 select * into e from requete_private.essai where id=p_id;
 if not found then raise exception 'essai introuvable'; end if;
 perform 1 from requete_private.salle where code=e.code for update;
 select * into e from requete_private.essai where id=p_id for update;
 if e.fini then return jsonb_build_object('ok',e.juste); end if;
 select * into rd from requete_private.manche where code=e.code and generation=e.generation and numero=e.numero;
 -- A stale verification cannot reopen a finished round or replace an earlier success.
 ouverte:=not rd.fermee and clock_timestamp()<=rd.debut+interval '20 minutes';
 deja:=exists(select 1 from requete_private.essai where code=e.code and generation=e.generation and numero=e.numero and essai.pid=e.pid and juste);
 p_juste:=coalesce(p_juste,false) and ouverte and not deja;
 t:=greatest(0,floor(extract(epoch from e.cree-rd.debut)*1000)::integer);
 update requete_private.essai set fini=true,juste=p_juste,ms=case when p_juste then t end where id=e.id;
 select * into mb from requete_private.membre where code=e.code and pid=e.pid;
 if p_juste then
   -- trouvé : noté pour ce joueur, pour ne plus le lui tirer (ni à ceux qui jouent avec lui)
   insert into requete_private.defi_joue(cle,defi,niv,trouve)
   select mb.cle,rd.defi,c.niv,clock_timestamp() from requete_private.catalogue c where c.id=rd.defi and mb.cle is not null
   on conflict (cle,defi) do update set trouve=coalesce(requete_private.defi_joue.trouve,excluded.trouve);
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
end $function$;

-- « Retirer mes scores du classement » et « Effacer la progression » : la liste des défis joués part avec les scores.
create or replace function public.jeu_oublier(p_cle text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_cle text := public.jeu_cle(p_cle);
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  delete from public.jeu_joueur where cle = v_cle;
  delete from requete_private.defi_joue where cle = v_cle;
  return jsonb_build_object('ok', true);
end;
$function$;

-- « Supprimer mon compte » (et sa solution de repli, qui libère le pseudo et les scores) : la liste aussi.
create or replace function public.compte_supprimer(p_cle text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_uid uuid := auth.uid();
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  delete from public.jeu_joueur where cle = v_cle;
  delete from public.jeu_pseudo where cle = v_cle;
  delete from public.parcours_vote where cle = v_cle;
  delete from public.avis_lecon where cle = v_cle;
  delete from public.onboarding_etape where cle = v_cle;
  delete from public.contact_message where cle = v_cle;
  delete from requete_private.defi_joue where cle = v_cle;
  delete from requete_private.essai e using requete_private.membre m where m.cle = v_cle and e.code = m.code and e.pid = m.pid;
  delete from requete_private.membre where cle = v_cle;
  if v_uid is not null and coalesce(auth.jwt()->>'is_anonymous', 'false') <> 'true' then
    delete from auth.users where id = v_uid;
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.jeu_pseudo_liberer(p_cle text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_cle text := public.jeu_cle(p_cle);
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  delete from public.jeu_joueur where cle = v_cle;
  delete from public.jeu_pseudo where cle = v_cle;
  delete from requete_private.defi_joue where cle = v_cle;
  return jsonb_build_object('ok', true);
end;
$function$;

-- La suppression d’un compte connecté (déclencheur compte_jeu_effacement, sur requete_private.compte_jeu) : la liste aussi.
create or replace function requete_private.jeu_compte_supprimer()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare v_pid text:=left(old.empreinte,24);
begin
 perform pg_advisory_xact_lock(hashtextextended('jeu-key:'||old.empreinte,0));
 insert into requete_private.compte_jeu_revoquee(empreinte) values(old.empreinte) on conflict do nothing;
 delete from public.jeu_joueur where cle=old.empreinte; -- parties/signals cascade
 delete from public.jeu_pseudo where cle=old.empreinte;
 delete from requete_private.defi_joue where cle=old.empreinte;
 delete from public.jeu_msg where m->>'pid'=v_pid;
 delete from requete_private.essai where essai.pid=v_pid;
 delete from requete_private.membre where membre.pid=v_pid;
 update requete_private.manche set joueurs=joueurs-v_pid where joueurs?v_pid;
 return old;
end; $function$;

-- Pour toi, dans le tableau de bord : un joueur par ligne (pseudo du classement), du plus avancé au moins avancé. « Faits » : joués
-- ou trouvés (dans une salle, ou ailleurs dans l’appli d’après la liste qu’elle envoie) ; ce sont ceux qui ne lui sont plus tirés.
create or replace view public.stats_defis_joues with (security_invoker = true) as
with faits as (
  select dj.cle, dj.defi, true as joue, dj.trouve is not null as trouve, dj.dernier from requete_private.defi_joue dj
  union all
  select j.cle, d.defi, false, true, j.defis_maj from public.jeu_joueur j cross join lateral unnest(j.defis) as d (defi)
), par as (
  select f.cle, f.defi, bool_or(f.joue) as joue, bool_or(f.trouve) as trouve, max(f.dernier) as dernier from faits f group by f.cle, f.defi
), tot as (
  select count(*) filter (where niv = 'f') as f, count(*) filter (where niv = 'm') as m, count(*) filter (where niv = 'd') as d from requete_private.catalogue
)
select p.pseudo,
  count(*) filter (where par.joue) as defis_joues,
  count(*) filter (where par.trouve) as defis_trouves,
  count(*) filter (where c.niv = 'f') || '/' || tot.f as faciles,
  count(*) filter (where c.niv = 'm') || '/' || tot.m as moyens,
  count(*) filter (where c.niv = 'd') || '/' || tot.d as difficiles,
  tot.f - count(*) filter (where c.niv = 'f') as restants_faciles,
  tot.m - count(*) filter (where c.niv = 'm') as restants_moyens,
  tot.d - count(*) filter (where c.niv = 'd') as restants_difficiles,
  max(par.dernier) as dernier_defi
from par
join requete_private.catalogue c on c.id = par.defi
join public.jeu_pseudo p on p.cle = par.cle
cross join tot
group by par.cle, p.pseudo, tot.f, tot.m, tot.d
order by count(*) desc, max(par.dernier) desc;

-- Une ligne par niveau : quand en ajouter. « au_plus_bas » : ce qu’il reste au joueur le plus avancé.
create or replace view public.stats_defis_restants with (security_invoker = true) as
with faits as (
  select dj.cle, dj.defi from requete_private.defi_joue dj
  union
  select j.cle, d.defi from public.jeu_joueur j cross join lateral unnest(j.defis) as d (defi)
), par_joueur as (
  select f.cle, c.niv, count(*) as faits from faits f join requete_private.catalogue c on c.id = f.defi group by f.cle, c.niv
), tot as (
  select niv, count(*) as total from requete_private.catalogue group by niv
)
select case tot.niv when 'f' then 'Facile' when 'm' then 'Moyen' else 'Difficile' end as niveau,
  tot.total as defis_dans_l_appli,
  count(pj.cle) as joueurs,
  coalesce(max(pj.faits), 0) as record_faits,
  tot.total - coalesce(max(pj.faits), 0) as au_plus_bas,
  count(pj.cle) filter (where tot.total - pj.faits < 10) as joueurs_a_moins_de_10,
  count(pj.cle) filter (where pj.faits >= tot.total) as joueurs_a_zero
from tot
left join par_joueur pj on pj.niv = tot.niv
group by tot.niv, tot.total
order by case tot.niv when 'f' then 1 when 'm' then 2 else 3 end;

revoke all on public.stats_defis_joues, public.stats_defis_restants from anon, authenticated;
