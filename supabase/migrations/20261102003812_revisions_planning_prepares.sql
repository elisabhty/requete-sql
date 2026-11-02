-- Prepared extension only. Same owner RLS, CAS, epochs and tombstones as progress.
alter table public.progression_element drop constraint progression_element_cle_check;
alter table public.progression_element add constraint progression_element_cle_check
 check(cle='planning:main' or cle ~ '^(lesson|challenge|video|interview|activity):[A-Za-z0-9_.-]{1,96}$');
create function requete_private.planning_valide(p jsonb)
returns boolean language plpgsql stable security invoker set search_path='' as $$
declare s jsonb; id jsonb; seen jsonb:='{}'; dates jsonb:='{}'; d text;
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>32768 then return false; end if;
 if not(p ?& array['niveau','rythme','freq','per','mix','sessions','archive','timeZone'])
  or (p-'niveau'-'rythme'-'freq'-'per'-'mix'-'sessions'-'archive'-'timeZone')<>'{}'::jsonb then return false; end if;
 if jsonb_typeof(p->'niveau')<>'string' or p->>'niveau' not in ('debutant','bases','inter')
  or jsonb_typeof(p->'rythme')<>'string' or p->>'rythme' not in ('calme','regulier','intensif')
  or p->'freq' not in ('2'::jsonb,'3'::jsonb,'5'::jsonb,'7'::jsonb)
  or jsonb_typeof(p->'per')<>'number' or p->>'per' !~ '^[0-9]{1,3}$'
  or (p->>'per')::integer not between 1 and 100 or jsonb_typeof(p->'mix')<>'boolean'
  or jsonb_typeof(p->'timeZone')<>'string' or length(p->>'timeZone')>100
  or (p->>'timeZone'<>'UTC' and position('/' in p->>'timeZone')=0)
  or not exists(select 1 from pg_catalog.pg_timezone_names where name=p->>'timeZone') then return false; end if;
 if jsonb_typeof(p->'sessions')<>'array' or jsonb_typeof(p->'archive')<>'array' then return false; end if;
 if jsonb_array_length(p->'sessions')>512 or jsonb_array_length(p->'archive')>1024 then return false; end if;
 for s in select value from jsonb_array_elements(p->'sessions') loop
  if jsonb_typeof(s)<>'object' or not(s ?& array['d','lessons']) or (s-'d'-'lessons')<>'{}'::jsonb
    or jsonb_typeof(s->'d')<>'string' or jsonb_typeof(s->'lessons')<>'array' then return false; end if;
  d:=s->>'d';
  if d !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or d<'2000-01-01' or d>'2100-12-31' or dates?d then return false; end if;
  begin
    if to_char(d::date,'YYYY-MM-DD')<>d then return false; end if;
  exception when datetime_field_overflow or invalid_datetime_format then return false;
  end;
  dates:=dates||jsonb_build_object(d,true);
  if jsonb_array_length(s->'lessons') not between 1 and 1024 then return false; end if;
  for id in select value from jsonb_array_elements(s->'lessons') loop
   if jsonb_typeof(id)<>'number' or id::text !~ '^[0-9]{1,6}$' or seen?(id::text) then return false; end if;
   seen:=seen||jsonb_build_object(id::text,true);
  end loop;
 end loop;
 for id in select value from jsonb_array_elements(p->'archive') loop
  if jsonb_typeof(id)<>'number' or id::text !~ '^[0-9]{1,6}$' or seen?(id::text) then return false; end if;
  seen:=seen||jsonb_build_object(id::text,true);
 end loop;
 if (select count(*) from jsonb_object_keys(seen))>1024 then return false; end if;
 return true;
end; $$;
revoke all on function requete_private.planning_valide(jsonb) from public,anon,authenticated;
create or replace function requete_private.progression_valide(p_cle text,p_data jsonb)
returns boolean language plpgsql stable security invoker set search_path='' as $$
declare kind text:=split_part(p_cle,':',1); k text; v jsonb; subkey text; subvalue jsonb;
begin
  if p_cle='planning:main' then return requete_private.planning_valide(p_data); end if;
  if p_cle is null or p_cle !~ '^(lesson|challenge|video|interview|activity):[A-Za-z0-9_.-]{1,96}$'
    or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>32768 then return false; end if;
  for k,v in select * from jsonb_each(p_data) loop
    if kind='lesson' then
      if k='done' then if jsonb_typeof(v)<>'boolean' then return false; end if;
      elsif k='etapes' then
        if jsonb_typeof(v)<>'object' then return false; end if;
        for subkey,subvalue in select * from jsonb_each(v) loop
          if subkey !~ '^(exo|q[0-9]{1,3})$' or subvalue not in ('true'::jsonb,'1'::jsonb) then return false; end if;
        end loop;
      elsif k in ('at','due','level') then
        if jsonb_typeof(v)<>'number' or v::text !~ '^[0-9]+$' then return false; end if;
        if v::numeric > (case when k='level' then 4 else 4102444800000 end) then return false; end if;
      else return false; end if;
    elsif kind='challenge' then
      if k<>'done' or jsonb_typeof(v)<>'boolean' then return false; end if;
    elsif kind='video' then
      if k='position' then
        if jsonb_typeof(v)<>'number' or v::numeric<0 or v::numeric>86400 then return false; end if;
      elsif k='contentVersion' then
        if jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 128 then return false; end if;
      elsif k='answers' then
        if jsonb_typeof(v)<>'object' then return false; end if;
        for subkey,subvalue in select * from jsonb_each(v) loop
          if jsonb_typeof(subvalue)<>'object' then return false; end if;
          if subkey ~ '^p[0-9]{1,3}$' then
            if (subvalue-'first'-'err')<>'{}'::jsonb or not(subvalue ?& array['first','err'])
              or subvalue->'first' not in ('0'::jsonb,'1'::jsonb)
              or jsonb_typeof(subvalue->'err')<>'number' or (subvalue->>'err') !~ '^[0-9]{1,4}$' then return false; end if;
          elsif subkey ~ '^[0-9]{1,3}$' then
            if (subvalue-'k'-'q')<>'{}'::jsonb or not(subvalue ?& array['k','q'])
              or jsonb_typeof(subvalue->'k')<>'number' or (subvalue->>'k') !~ '^[0-9]{1,3}$'
              or jsonb_typeof(subvalue->'q')<>'string' or length(subvalue->>'q')>2000 then return false; end if;
          else return false; end if;
        end loop;
      else return false; end if;
    elsif kind='interview' then
      if k<>'mark' or v not in ('"ok"'::jsonb,'"review"'::jsonb) then return false; end if;
    elsif kind='activity' then
      if k<>'active' or v<>'true'::jsonb or substring(p_cle from 10) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
    end if;
  end loop;
  if kind='video' and not(p_data?'contentVersion') then return false; end if;
  return true;
end; $$;
revoke all on function requete_private.progression_valide(text,jsonb) from public,anon,authenticated;

create or replace function public.progression_reinitialiser(p_epoch bigint,p_cle text,p_revision bigint,p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint; old public.progression_element; target text;
begin
  if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise exception 'Connexion requise' using errcode='42501'; end if;
  if p_epoch is null or p_revision is null or p_generation is null or least(p_epoch,p_revision,p_generation)<0 or p_cle is null or (p_cle<>'planning:main' and p_cle !~ '^(lesson|challenge|video|interview|activity):[A-Za-z0-9_.-]{1,96}$') then raise exception 'Demande invalide' using errcode='22023'; end if;
  insert into public.progression_etat(user_id) values(u) on conflict do nothing;
  select epoch into e from public.progression_etat where user_id=u for update;
  if e<>p_epoch then return jsonb_build_object('ok',false,'reason','epoch','epoch',e); end if;
  select * into old from public.progression_element where user_id=u and cle=p_cle;
  if coalesce(old.generation,0)<>p_generation then return jsonb_build_object('ok',false,'reason','generation'); end if;
  if coalesce(old.revision,0)<>p_revision then return jsonb_build_object('ok',false,'reason','revision'); end if;
  if old.cle is null and (select count(*) from public.progression_element where user_id=u)>=2047 then raise exception 'Trop d’éléments' using errcode='54000'; end if;
  foreach target in array case when p_cle like 'lesson:%' then array[p_cle,'video:'||split_part(p_cle,':',2)] else array[p_cle] end loop
    insert into public.progression_element(user_id,cle,donnees,generation,supprime) values(u,target,'{}'::jsonb,1,true)
    on conflict(user_id,cle) do update set donnees='{}'::jsonb,generation=public.progression_element.generation+1,revision=public.progression_element.revision+1,supprime=true,modifie_le=clock_timestamp();
  end loop;
  return jsonb_build_object('ok',true,'epoch',e);
end; $$;

