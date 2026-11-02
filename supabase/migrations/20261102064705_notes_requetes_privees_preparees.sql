-- Dormant private notes and explicitly saved SQL; independent from learning resets.
create table public.documents_etat(
 user_id uuid primary key references auth.users(id) on delete cascade,
 epoch bigint not null default 0 check(epoch>=0),modifie_le timestamptz not null default now()
);
create table public.documents_element(
 user_id uuid not null references auth.users(id) on delete cascade,
 cle text not null check(cle ~ '^note:[A-Za-z0-9_.-]{1,96}$'),
 donnees jsonb not null default '{}'::jsonb check(jsonb_typeof(donnees)='object' and octet_length(donnees::text)<=65536),
 revision bigint not null default 1 check(revision>0),generation bigint not null default 0 check(generation>=0),
 supprime boolean not null default false,modifie_le timestamptz not null default now(),primary key(user_id,cle)
);
alter table public.documents_etat enable row level security;
alter table public.documents_element enable row level security;
revoke all on public.documents_etat,public.documents_element from public,anon,authenticated;
grant select on public.documents_etat,public.documents_element to authenticated;
grant all on public.documents_etat,public.documents_element to service_role;
create policy documents_etat_lire on public.documents_etat for select to authenticated using((select auth.uid())=user_id and coalesce(((select auth.jwt())->>'is_anonymous'),'false')<>'true');
create policy documents_element_lire on public.documents_element for select to authenticated using((select auth.uid())=user_id and coalesce(((select auth.jwt())->>'is_anonymous'),'false')<>'true');
comment on table public.documents_element is 'Notes privées et SQL explicitement enregistré, jamais exécuté par ces RPC. Préparation inactive, sans import des brouillons ou bases locales.';
create function requete_private.documents_valide(p_cle text,p_data jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
begin
 if p_cle is null or p_cle !~ '^note:[A-Za-z0-9_.-]{1,96}$' or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>65536 then return false;end if;
 if not(p_data ?& array['txt','sql','ctx','ts','pin']) or (p_data-'txt'-'sql'-'ctx'-'ts'-'pin')<>'{}'::jsonb then return false;end if;
 if jsonb_typeof(p_data->'txt')<>'string' or length(p_data->>'txt')>20000
  or jsonb_typeof(p_data->'sql')<>'string' or length(p_data->>'sql')>12000
  or jsonb_typeof(p_data->'ctx')<>'string' or length(p_data->>'ctx')>300
  or jsonb_typeof(p_data->'pin')<>'boolean' or jsonb_typeof(p_data->'ts')<>'number'
  or p_data->>'ts' !~ '^[0-9]{1,13}$' then return false;end if;
 if (p_data->>'ts')::bigint>4102444800000 or (p_data->>'txt' !~ '[^[:space:]]' and p_data->>'sql' !~ '[^[:space:]]') then return false;end if;
 return true;
end; $$;
revoke all on function requete_private.documents_valide(text,jsonb) from public,anon,authenticated;
create function public.documents_lire()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint; result jsonb;
begin
  if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=u) then raise exception 'Connexion requise' using errcode='42501'; end if;
  insert into public.documents_etat(user_id) values(u) on conflict do nothing;
  select epoch into e from public.documents_etat where user_id=u for update;
  select coalesce(jsonb_agg(jsonb_build_object('key',cle,'data',donnees,'revision',revision,'generation',generation,'deleted',supprime,'updatedAt',modifie_le) order by cle),'[]'::jsonb)
    into result from public.documents_element where user_id=u;
  return jsonb_build_object('schemaVersion',1,'epoch',e,'elements',result);
end; $$;

create function public.documents_enregistrer(p_epoch bigint,p_cle text,p_revision bigint,p_generation bigint,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint; old public.documents_element; row_json jsonb;
begin
 if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=u) then raise exception 'Connexion requise' using errcode='42501';end if;
 if p_epoch is null or p_revision is null or p_generation is null or least(p_epoch,p_revision,p_generation)<0 or not requete_private.documents_valide(p_cle,p_data) then raise exception 'Document invalide' using errcode='22023';end if;
 insert into public.documents_etat(user_id) values(u) on conflict do nothing;
 select epoch into e from public.documents_etat where user_id=u for update;
 if e<>p_epoch then return jsonb_build_object('ok',false,'reason','epoch','epoch',e);end if;
 select * into old from public.documents_element where user_id=u and cle=p_cle;
 row_json:=case when old.cle is null then null else jsonb_build_object('key',old.cle,'data',old.donnees,'revision',old.revision,'generation',old.generation,'deleted',old.supprime,'updatedAt',old.modifie_le) end;
 if coalesce(old.generation,0)<>p_generation then return jsonb_build_object('ok',false,'reason','generation','element',row_json);end if;
 if coalesce(old.revision,0)<>p_revision then return jsonb_build_object('ok',false,'reason','revision','element',row_json);end if;
 if old.cle is null and (select count(*) from public.documents_element where user_id=u)>=2048 then raise exception 'Trop de documents' using errcode='54000';end if;
 if coalesce((select sum(octet_length(donnees::text)) from public.documents_element where user_id=u and cle<>p_cle),0)+octet_length(p_data::text)>16777216 then raise exception 'Espace de documents atteint' using errcode='54000';end if;
 -- Full saved document, no SQL execution and no field-wise merge of concurrent edits.
 insert into public.documents_element(user_id,cle,donnees,revision,generation,supprime)
 values(u,p_cle,p_data,coalesce(old.revision,0)+1,coalesce(old.generation,0),false)
 on conflict(user_id,cle) do update set donnees=excluded.donnees,revision=excluded.revision,supprime=false,modifie_le=clock_timestamp()
 returning jsonb_build_object('key',cle,'data',donnees,'revision',revision,'generation',generation,'deleted',supprime,'updatedAt',modifie_le) into row_json;
 return jsonb_build_object('ok',true,'epoch',e,'element',row_json);
end; $$;

create function public.documents_reinitialiser(p_epoch bigint,p_cle text,p_revision bigint,p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint; old public.documents_element; target text;
begin
  if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=u) then raise exception 'Connexion requise' using errcode='42501'; end if;
  if p_epoch is null or p_revision is null or p_generation is null or least(p_epoch,p_revision,p_generation)<0 or p_cle is null or p_cle !~ '^note:[A-Za-z0-9_.-]{1,96}$' then raise exception 'Demande invalide' using errcode='22023'; end if;
  insert into public.documents_etat(user_id) values(u) on conflict do nothing;
  select epoch into e from public.documents_etat where user_id=u for update;
  if e<>p_epoch then return jsonb_build_object('ok',false,'reason','epoch','epoch',e); end if;
  select * into old from public.documents_element where user_id=u and cle=p_cle;
  if coalesce(old.generation,0)<>p_generation then return jsonb_build_object('ok',false,'reason','generation'); end if;
  if coalesce(old.revision,0)<>p_revision then return jsonb_build_object('ok',false,'reason','revision'); end if;
  if old.cle is null and (select count(*) from public.documents_element where user_id=u)>=2048 then raise exception 'Trop d’éléments' using errcode='54000'; end if;
  foreach target in array array[p_cle] loop
    insert into public.documents_element(user_id,cle,donnees,generation,supprime) values(u,target,'{}'::jsonb,1,true)
    on conflict(user_id,cle) do update set donnees='{}'::jsonb,generation=public.documents_element.generation+1,revision=public.documents_element.revision+1,supprime=true,modifie_le=clock_timestamp();
  end loop;
  return jsonb_build_object('ok',true,'epoch',e);
end; $$;

create function public.documents_effacer(p_epoch bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint;
begin
  if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=u) then raise exception 'Connexion requise' using errcode='42501'; end if;
  if p_epoch is null or p_epoch<0 then raise exception 'Demande invalide' using errcode='22023'; end if;
  insert into public.documents_etat(user_id) values(u) on conflict do nothing;
  select epoch into e from public.documents_etat where user_id=u for update;
  if e<>p_epoch then return jsonb_build_object('ok',false,'reason','epoch','epoch',e); end if;
  delete from public.documents_element where user_id=u;
  update public.documents_etat set epoch=epoch+1,modifie_le=clock_timestamp() where user_id=u returning epoch into e;
  return jsonb_build_object('ok',true,'epoch',e);
end; $$;

revoke all on function public.documents_lire(),public.documents_enregistrer(bigint,text,bigint,bigint,jsonb),public.documents_reinitialiser(bigint,text,bigint,bigint),public.documents_effacer(bigint) from public,anon,authenticated;
grant execute on function public.documents_lire(),public.documents_enregistrer(bigint,text,bigint,bigint,jsonb),public.documents_reinitialiser(bigint,text,bigint,bigint),public.documents_effacer(bigint) to authenticated;
