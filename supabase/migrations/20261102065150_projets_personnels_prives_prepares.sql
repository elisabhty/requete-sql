-- Dormant private notes and explicitly saved SQL; independent from learning resets.
create table public.projets_etat(
 user_id uuid primary key references auth.users(id) on delete cascade,
 epoch bigint not null default 0 check(epoch>=0),modifie_le timestamptz not null default now()
);
create table public.projets_element(
 user_id uuid not null references auth.users(id) on delete cascade,
 cle text not null check(cle ~ '^project:[A-Za-z0-9_.-]{1,96}$'),
 donnees jsonb not null default '{}'::jsonb check(jsonb_typeof(donnees)='object' and octet_length(donnees::text)<=4194304),
 revision bigint not null default 1 check(revision>0),generation bigint not null default 0 check(generation>=0),
 supprime boolean not null default false,modifie_le timestamptz not null default now(),primary key(user_id,cle)
);
alter table public.projets_etat enable row level security;
alter table public.projets_element enable row level security;
revoke all on public.projets_etat,public.projets_element from public,anon,authenticated;
grant select on public.projets_etat,public.projets_element to authenticated;
grant all on public.projets_etat,public.projets_element to service_role;
create policy projets_etat_lire on public.projets_etat for select to authenticated using((select auth.uid())=user_id and coalesce(((select auth.jwt())->>'is_anonymous'),'false')<>'true');
create policy projets_element_lire on public.projets_element for select to authenticated using((select auth.uid())=user_id and coalesce(((select auth.jwt())->>'is_anonymous'),'false')<>'true');
comment on table public.projets_element is 'Projets privés choisis, espace SQL et instantané SQLite optionnel explicite. Aucune exécution serveur, préparation inactive.';
create function requete_private.projets_sqlite_valide(p jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare b text; raw bytea;
begin
 if p is null or jsonb_typeof(p)<>'object' or not(p?'b64') or (p-'b64')<>'{}'::jsonb or jsonb_typeof(p->'b64')<>'string' then return false;end if;
 b:=p->>'b64';
 if length(b)>2796204 or length(b)%4<>0 or b !~ '^[A-Za-z0-9+/]*={0,2}$' then return false;end if;
 begin raw:=decode(b,'base64');exception when others then return false;end;
 if octet_length(raw)>2097152 or replace(encode(raw,'base64'),E'\n','')<>b then return false;end if;
 if octet_length(raw)>0 and (octet_length(raw)<100 or substring(raw from 1 for 16)<>decode('53514c69746520666f726d6174203300','hex')) then return false;end if;
 return true;
end; $$;
revoke all on function requete_private.projets_sqlite_valide(jsonb) from public,anon,authenticated;
create function requete_private.projets_valide(p_cle text,p_data jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text; v jsonb; q jsonb; kind text;
begin
 if p_cle is null or p_cle !~ '^project:[A-Za-z0-9_.-]{1,96}$' or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>4194304 then return false;end if;
 if not(p_data ?& array['name','scope','draft','desc','tdesc','pins','hist','database','baselines']) or (p_data-'name'-'scope'-'draft'-'desc'-'tdesc'-'pins'-'hist'-'database'-'baselines')<>'{}'::jsonb then return false;end if;
 if jsonb_typeof(p_data->'name')<>'string' or length(p_data->>'name')>80 or p_data->>'name' !~ '[^[:space:]]'
  or jsonb_typeof(p_data->'scope')<>'string' or p_data->>'scope' not in ('workspace','complete')
  or jsonb_typeof(p_data->'draft')<>'string' or length(p_data->>'draft')>12000
  or jsonb_typeof(p_data->'desc')<>'string' or length(p_data->>'desc')>4000
  or jsonb_typeof(p_data->'tdesc')<>'object' or jsonb_typeof(p_data->'pins')<>'array'
  or jsonb_typeof(p_data->'hist')<>'array' or jsonb_typeof(p_data->'baselines')<>'object' then return false;end if;
 if (select count(*) from jsonb_object_keys(p_data->'tdesc'))>128 or (select count(*) from jsonb_object_keys(p_data->'baselines'))>128 or jsonb_array_length(p_data->'pins')>12 or jsonb_array_length(p_data->'hist')>24 then return false;end if;
 for k,v in select * from jsonb_each(p_data->'tdesc') loop
  if length(k) not between 1 and 128 or jsonb_typeof(v)<>'string' or length(v#>>'{}')>4000 then return false;end if;
 end loop;
 foreach kind in array array['pins','hist'] loop
  for q in select value from jsonb_array_elements(p_data->kind) loop
   if jsonb_typeof(q)<>'object' or not(q ?& array['sql','ts']) then return false;end if;
   if (kind='pins' and (q-'sql'-'ts')<>'{}'::jsonb) or (kind='hist' and (q-'sql'-'ts'-'ok'-'n'-'ms'-'err')<>'{}'::jsonb) then return false;end if;
   if jsonb_typeof(q->'sql')<>'string' or length(q->>'sql')>12000 or q->>'sql' !~ '[^[:space:]]' or jsonb_typeof(q->'ts')<>'number' or q->>'ts' !~ '^[0-9]{1,13}$' then return false;end if;
   if (q->>'ts')::bigint>4102444800000 then return false;end if;
   if q?'ok' and jsonb_typeof(q->'ok')<>'boolean' then return false;end if;
   if q?'n' then
    if jsonb_typeof(q->'n')<>'number' or q->>'n' !~ '^[0-9]{1,10}$' then return false;end if;
    if (q->>'n')::bigint>1000000000 then return false;end if;
   end if;
   if q?'ms' then
    if jsonb_typeof(q->'ms')<>'number' then return false;end if;
    if (q->>'ms')::numeric<0 or (q->>'ms')::numeric>86400000 then return false;end if;
   end if;
   if q?'err' and (jsonb_typeof(q->'err')<>'string' or length(q->>'err')>2000) then return false;end if;
  end loop;
 end loop;
 if p_data->>'scope'='workspace' then
  if p_data->'database'<>'null'::jsonb or p_data->'baselines'<>'{}'::jsonb then return false;end if;
 else
  if not requete_private.projets_sqlite_valide(p_data->'database') then return false;end if;
 end if;
 for k,v in select * from jsonb_each(p_data->'baselines') loop
  if length(k) not between 1 and 128 or jsonb_typeof(v)<>'object' or not(v ?& array['name','b64']) or (v-'name'-'b64')<>'{}'::jsonb or jsonb_typeof(v->'name')<>'string' or length(v->>'name') not between 1 and 128 then return false;end if;
  if not requete_private.projets_sqlite_valide(v-'name') then return false;end if;
 end loop;
 return true;
end; $$;
revoke all on function requete_private.projets_valide(text,jsonb) from public,anon,authenticated;
create function public.projets_lire()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint; result jsonb;
begin
  if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=u) then raise exception 'Connexion requise' using errcode='42501'; end if;
  insert into public.projets_etat(user_id) values(u) on conflict do nothing;
  select epoch into e from public.projets_etat where user_id=u for update;
  select coalesce(jsonb_agg(jsonb_build_object('key',cle,'data',donnees,'revision',revision,'generation',generation,'deleted',supprime,'updatedAt',modifie_le) order by cle),'[]'::jsonb)
    into result from public.projets_element where user_id=u;
  return jsonb_build_object('schemaVersion',1,'epoch',e,'elements',result);
end; $$;

create function public.projets_enregistrer(p_epoch bigint,p_cle text,p_revision bigint,p_generation bigint,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint; old public.projets_element; row_json jsonb;
begin
 if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=u) then raise exception 'Connexion requise' using errcode='42501';end if;
 if p_epoch is null or p_revision is null or p_generation is null or least(p_epoch,p_revision,p_generation)<0 or not requete_private.projets_valide(p_cle,p_data) then raise exception 'Document invalide' using errcode='22023';end if;
 insert into public.projets_etat(user_id) values(u) on conflict do nothing;
 select epoch into e from public.projets_etat where user_id=u for update;
 if e<>p_epoch then return jsonb_build_object('ok',false,'reason','epoch','epoch',e);end if;
 select * into old from public.projets_element where user_id=u and cle=p_cle;
 row_json:=case when old.cle is null then null else jsonb_build_object('key',old.cle,'data',old.donnees,'revision',old.revision,'generation',old.generation,'deleted',old.supprime,'updatedAt',old.modifie_le) end;
 if coalesce(old.generation,0)<>p_generation then return jsonb_build_object('ok',false,'reason','generation','element',row_json);end if;
 if coalesce(old.revision,0)<>p_revision then return jsonb_build_object('ok',false,'reason','revision','element',row_json);end if;
 if old.cle is null and (select count(*) from public.projets_element where user_id=u)>=64 then raise exception 'Trop de projets' using errcode='54000';end if;
 if coalesce((select sum(octet_length(donnees::text)) from public.projets_element where user_id=u and cle<>p_cle),0)+octet_length(p_data::text)>67108864 then raise exception 'Espace de projets atteint' using errcode='54000';end if;
 -- Full saved document, no SQL execution and no field-wise merge of concurrent edits.
 insert into public.projets_element(user_id,cle,donnees,revision,generation,supprime)
 values(u,p_cle,p_data,coalesce(old.revision,0)+1,coalesce(old.generation,0),false)
 on conflict(user_id,cle) do update set donnees=excluded.donnees,revision=excluded.revision,supprime=false,modifie_le=clock_timestamp()
 returning jsonb_build_object('key',cle,'data',donnees,'revision',revision,'generation',generation,'deleted',supprime,'updatedAt',modifie_le) into row_json;
 return jsonb_build_object('ok',true,'epoch',e,'element',row_json);
end; $$;

create function public.projets_reinitialiser(p_epoch bigint,p_cle text,p_revision bigint,p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint; old public.projets_element; target text;
begin
  if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=u) then raise exception 'Connexion requise' using errcode='42501'; end if;
  if p_epoch is null or p_revision is null or p_generation is null or least(p_epoch,p_revision,p_generation)<0 or p_cle is null or p_cle !~ '^project:[A-Za-z0-9_.-]{1,96}$' then raise exception 'Demande invalide' using errcode='22023'; end if;
  insert into public.projets_etat(user_id) values(u) on conflict do nothing;
  select epoch into e from public.projets_etat where user_id=u for update;
  if e<>p_epoch then return jsonb_build_object('ok',false,'reason','epoch','epoch',e); end if;
  select * into old from public.projets_element where user_id=u and cle=p_cle;
  if coalesce(old.generation,0)<>p_generation then return jsonb_build_object('ok',false,'reason','generation'); end if;
  if coalesce(old.revision,0)<>p_revision then return jsonb_build_object('ok',false,'reason','revision'); end if;
  if old.cle is null and (select count(*) from public.projets_element where user_id=u)>=64 then raise exception 'Trop d’éléments' using errcode='54000'; end if;
  foreach target in array array[p_cle] loop
    insert into public.projets_element(user_id,cle,donnees,generation,supprime) values(u,target,'{}'::jsonb,1,true)
    on conflict(user_id,cle) do update set donnees='{}'::jsonb,generation=public.projets_element.generation+1,revision=public.projets_element.revision+1,supprime=true,modifie_le=clock_timestamp();
  end loop;
  return jsonb_build_object('ok',true,'epoch',e);
end; $$;

create function public.projets_effacer(p_epoch bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint;
begin
  if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=u) then raise exception 'Connexion requise' using errcode='42501'; end if;
  if p_epoch is null or p_epoch<0 then raise exception 'Demande invalide' using errcode='22023'; end if;
  insert into public.projets_etat(user_id) values(u) on conflict do nothing;
  select epoch into e from public.projets_etat where user_id=u for update;
  if e<>p_epoch then return jsonb_build_object('ok',false,'reason','epoch','epoch',e); end if;
  delete from public.projets_element where user_id=u;
  update public.projets_etat set epoch=epoch+1,modifie_le=clock_timestamp() where user_id=u returning epoch into e;
  return jsonb_build_object('ok',true,'epoch',e);
end; $$;

revoke all on function public.projets_lire(),public.projets_enregistrer(bigint,text,bigint,bigint,jsonb),public.projets_reinitialiser(bigint,text,bigint,bigint),public.projets_effacer(bigint) from public,anon,authenticated;
grant execute on function public.projets_lire(),public.projets_enregistrer(bigint,text,bigint,bigint,jsonb),public.projets_reinitialiser(bigint,text,bigint,bigint),public.projets_effacer(bigint) to authenticated;
