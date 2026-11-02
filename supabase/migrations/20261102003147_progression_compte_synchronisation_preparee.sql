-- Prepared backend only: no frontend imports or automatic upload.
create table public.progression_etat (
  user_id uuid primary key references auth.users(id) on delete cascade,
  epoch bigint not null default 0 check(epoch>=0),
  modifie_le timestamptz not null default now()
);
create table public.progression_element (
  user_id uuid not null references auth.users(id) on delete cascade,
  cle text not null check(cle ~ '^(lesson|challenge|video|interview|activity):[A-Za-z0-9_.-]{1,96}$'),
  donnees jsonb not null default '{}'::jsonb check(jsonb_typeof(donnees)='object' and octet_length(donnees::text)<=32768),
  revision bigint not null default 1 check(revision>0),
  generation bigint not null default 0 check(generation>=0),
  supprime boolean not null default false,
  modifie_le timestamptz not null default now(),
  primary key(user_id,cle)
);
comment on table public.progression_element is 'Progression personnelle préparée pour web/iOS. Aucun score classé, secret, fichier ou brouillon SQL. Non raccordée aux écrans.';
alter table public.progression_etat enable row level security;
alter table public.progression_element enable row level security;
revoke all on public.progression_etat,public.progression_element from public,anon,authenticated;
grant select on public.progression_etat,public.progression_element to authenticated;
grant all on public.progression_etat,public.progression_element to service_role;
create policy progression_etat_lire on public.progression_etat for select to authenticated using((select auth.uid())=user_id);
create policy progression_element_lire on public.progression_element for select to authenticated using((select auth.uid())=user_id);

create function requete_private.progression_valide(p_cle text,p_data jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare kind text:=split_part(p_cle,':',1); k text; v jsonb; subkey text; subvalue jsonb;
begin
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

create function public.progression_lire()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint; result jsonb;
begin
  if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise exception 'Connexion requise' using errcode='42501'; end if;
  insert into public.progression_etat(user_id) values(u) on conflict do nothing;
  select epoch into e from public.progression_etat where user_id=u for update;
  select coalesce(jsonb_agg(jsonb_build_object('key',cle,'data',donnees,'revision',revision,'generation',generation,'deleted',supprime,'updatedAt',modifie_le) order by cle),'[]'::jsonb)
    into result from public.progression_element where user_id=u;
  return jsonb_build_object('schemaVersion',1,'epoch',e,'elements',result);
end; $$;

create function public.progression_enregistrer(p_epoch bigint,p_cle text,p_revision bigint,p_generation bigint,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint; old public.progression_element; merged jsonb; row_json jsonb; answer_key text; answer_value jsonb; answers jsonb;
begin
  if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise exception 'Connexion requise' using errcode='42501'; end if;
  if p_epoch is null or p_revision is null or p_generation is null or least(p_epoch,p_revision,p_generation)<0 or not requete_private.progression_valide(p_cle,p_data) then raise exception 'Progression invalide' using errcode='22023'; end if;
  insert into public.progression_etat(user_id) values(u) on conflict do nothing;
  select epoch into e from public.progression_etat where user_id=u for update;
  if e<>p_epoch then return jsonb_build_object('ok',false,'reason','epoch','epoch',e); end if;
  select * into old from public.progression_element where user_id=u and cle=p_cle;
  row_json:=case when old.cle is null then null else jsonb_build_object('key',old.cle,'data',old.donnees,'revision',old.revision,'generation',old.generation,'deleted',old.supprime,'updatedAt',old.modifie_le) end;
  if coalesce(old.generation,0)<>p_generation then return jsonb_build_object('ok',false,'reason','generation','element',row_json); end if;
  if coalesce(old.revision,0)<>p_revision then return jsonb_build_object('ok',false,'reason','revision','element',row_json); end if;
  if old.cle is null and (select count(*) from public.progression_element where user_id=u)>=2048 then raise exception 'Trop d’éléments' using errcode='54000'; end if;
  if split_part(p_cle,':',1)='video' and not coalesce(old.supprime,true) and old.donnees->>'contentVersion' is distinct from p_data->>'contentVersion' then
    return jsonb_build_object('ok',false,'reason','content_version','element',row_json);
  end if;
  merged:=(case when old.supprime then '{}'::jsonb else coalesce(old.donnees,'{}'::jsonb) end)||p_data;
  if split_part(p_cle,':',1) in ('lesson','challenge') then
    merged:=jsonb_set(merged,'{done}',to_jsonb(coalesce((old.donnees->>'done')::boolean,false) and not coalesce(old.supprime,false) or coalesce((p_data->>'done')::boolean,false)));
  end if;
  if split_part(p_cle,':',1)='lesson' then
    merged:=jsonb_set(merged,'{etapes}',(case when old.supprime then '{}'::jsonb else coalesce(old.donnees->'etapes','{}'::jsonb) end)||coalesce(p_data->'etapes','{}'::jsonb));
    if not coalesce(old.supprime,false) and old.donnees?'at' and p_data?'at' then merged:=jsonb_set(merged,'{at}',to_jsonb(least((old.donnees->>'at')::bigint,(p_data->>'at')::bigint))); end if;
  end if;
  if split_part(p_cle,':',1)='video' then
    answers:=(case when old.supprime then '{}'::jsonb else coalesce(old.donnees->'answers','{}'::jsonb) end)||coalesce(p_data->'answers','{}'::jsonb);
    if not coalesce(old.supprime,false) then
      for answer_key,answer_value in select * from jsonb_each(coalesce(old.donnees->'answers','{}'::jsonb)) loop
        if answer_key ~ '^p[0-9]+$' then answers:=jsonb_set(answers,array[answer_key],answer_value); end if;
      end loop;
    end if;
    merged:=jsonb_set(merged,'{answers}',answers);
  end if;
  insert into public.progression_element(user_id,cle,donnees,revision,generation,supprime)
    values(u,p_cle,merged,coalesce(old.revision,0)+1,coalesce(old.generation,0),false)
    on conflict(user_id,cle) do update set donnees=excluded.donnees,revision=excluded.revision,supprime=false,modifie_le=clock_timestamp()
    returning jsonb_build_object('key',cle,'data',donnees,'revision',revision,'generation',generation,'deleted',supprime,'updatedAt',modifie_le) into row_json;
  return jsonb_build_object('ok',true,'epoch',e,'element',row_json);
end; $$;

create function public.progression_reinitialiser(p_epoch bigint,p_cle text,p_revision bigint,p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint; old public.progression_element; target text;
begin
  if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise exception 'Connexion requise' using errcode='42501'; end if;
  if p_epoch is null or p_revision is null or p_generation is null or least(p_epoch,p_revision,p_generation)<0 or p_cle is null or p_cle !~ '^(lesson|challenge|video|interview|activity):[A-Za-z0-9_.-]{1,96}$' then raise exception 'Demande invalide' using errcode='22023'; end if;
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

create function public.progression_effacer(p_epoch bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint;
begin
  if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise exception 'Connexion requise' using errcode='42501'; end if;
  if p_epoch is null or p_epoch<0 then raise exception 'Demande invalide' using errcode='22023'; end if;
  insert into public.progression_etat(user_id) values(u) on conflict do nothing;
  select epoch into e from public.progression_etat where user_id=u for update;
  if e<>p_epoch then return jsonb_build_object('ok',false,'reason','epoch','epoch',e); end if;
  delete from public.progression_element where user_id=u;
  update public.progression_etat set epoch=epoch+1,modifie_le=clock_timestamp() where user_id=u returning epoch into e;
  return jsonb_build_object('ok',true,'epoch',e);
end; $$;

revoke all on function public.progression_lire(),public.progression_enregistrer(bigint,text,bigint,bigint,jsonb),public.progression_reinitialiser(bigint,text,bigint,bigint),public.progression_effacer(bigint) from public,anon,authenticated;
grant execute on function public.progression_lire(),public.progression_enregistrer(bigint,text,bigint,bigint,jsonb),public.progression_reinitialiser(bigint,text,bigint,bigint),public.progression_effacer(bigint) to authenticated;
