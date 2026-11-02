-- Dormant private notes and explicitly saved SQL; independent from learning resets.
create table public.personnalisation_etat(
 user_id uuid primary key references auth.users(id) on delete cascade,
 epoch bigint not null default 0 check(epoch>=0),modifie_le timestamptz not null default now()
);
create table public.personnalisation_element(
 user_id uuid not null references auth.users(id) on delete cascade,
 cle text not null check(cle ~ '^(preferences:main|stickers:board|study:legacy|study:[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12})$'),
 donnees jsonb not null default '{}'::jsonb check(jsonb_typeof(donnees)='object' and octet_length(donnees::text)<=65536),
 revision bigint not null default 1 check(revision>0),generation bigint not null default 0 check(generation>=0),
 supprime boolean not null default false,modifie_le timestamptz not null default now(),primary key(user_id,cle)
);
alter table public.personnalisation_etat enable row level security;
alter table public.personnalisation_element enable row level security;
revoke all on public.personnalisation_etat,public.personnalisation_element from public,anon,authenticated;
grant select on public.personnalisation_etat,public.personnalisation_element to authenticated;
grant all on public.personnalisation_etat,public.personnalisation_element to service_role;
create policy personnalisation_etat_lire on public.personnalisation_etat for select to authenticated using((select auth.uid())=user_id and coalesce(((select auth.jwt())->>'is_anonymous'),'false')<>'true');
create policy personnalisation_element_lire on public.personnalisation_element for select to authenticated using((select auth.uid())=user_id and coalesce(((select auth.jwt())->>'is_anonymous'),'false')<>'true');
comment on table public.personnalisation_element is 'Préférences, tableau de stickers et statistiques privées, préparation inactive. Aucun score public, SQL ou secret.';
create function requete_private.personnalisation_valide(p_cle text,p_data jsonb)
returns boolean language plpgsql stable security invoker set search_path='' as $$
declare k text; v jsonb; b jsonb; placed jsonb:='{}'; days_total numeric:=0; items_total numeric:=0; cutoff_day text;
 allowed text[]:=array['intro','lire','fonctions','agregats','jointures','sousreq','fenetre','modeliser','creer','ecrire','contraintes','transactions','triggers','index','securite','requete','lecons10','serie3','defis10','serie7','parcours'];
begin
 if p_cle is null or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>65536 then return false;end if;
 if p_cle='preferences:main' then
  if not(p_data ?& array['largeText','reduceMotion','videoRate','challenge','reminder']) or (p_data-'largeText'-'reduceMotion'-'videoRate'-'challenge'-'reminder')<>'{}'::jsonb
   or jsonb_typeof(p_data->'largeText')<>'boolean' or jsonb_typeof(p_data->'reduceMotion')<>'boolean' or p_data->'videoRate' not in ('0.5'::jsonb,'0.75'::jsonb,'1'::jsonb,'1.5'::jsonb,'2'::jsonb) then return false;end if;
  b:=p_data->'challenge';
  if jsonb_typeof(b)<>'object' or not(b ?& array['niv','nb','mode','nivUser']) or (b-'niv'-'nb'-'mode'-'nivUser')<>'{}'::jsonb
   or jsonb_typeof(b->'niv')<>'string' or b->>'niv' not in ('f','m','d') or b->'nb' not in ('1'::jsonb,'3'::jsonb,'5'::jsonb)
   or jsonb_typeof(b->'mode')<>'string' or b->>'mode' not in ('solo','friends') or jsonb_typeof(b->'nivUser')<>'boolean' then return false;end if;
  b:=p_data->'reminder';
  if jsonb_typeof(b)<>'object' or not(b ?& array['enabled','time']) or (b-'enabled'-'time')<>'{}'::jsonb or jsonb_typeof(b->'enabled')<>'boolean'
   or jsonb_typeof(b->'time')<>'string' or b->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return false;end if;
 elsif p_cle='stickers:board' then
  if not(p_data ?& array['got','fresh','board','since']) or (p_data-'got'-'fresh'-'board'-'since')<>'{}'::jsonb
   or jsonb_typeof(p_data->'got')<>'object' or jsonb_typeof(p_data->'fresh')<>'object' or jsonb_typeof(p_data->'board')<>'array'
   or jsonb_typeof(p_data->'since')<>'number' or p_data->>'since' !~ '^[0-9]{1,13}$' then return false;end if;
  if (p_data->>'since')::bigint>4102444800000 or jsonb_array_length(p_data->'board')>21 then return false;end if;
  for k,v in select * from jsonb_each(p_data->'got') loop
   if not(k=any(allowed)) or jsonb_typeof(v)<>'number' or v::text !~ '^[0-9]{1,13}$' then return false;end if;
   if v::numeric<1 or v::numeric>4102444800000 then return false;end if;
  end loop;
  for k,v in select * from jsonb_each(p_data->'fresh') loop if not((p_data->'got')?k) or v<>'1'::jsonb then return false;end if;end loop;
  for b in select value from jsonb_array_elements(p_data->'board') loop
   if jsonb_typeof(b)<>'object' or not(b ?& array['id','x','y','r','s']) or (b-'id'-'x'-'y'-'r'-'s')<>'{}'::jsonb or jsonb_typeof(b->'id')<>'string'
    or not((p_data->'got')?(b->>'id')) or placed?(b->>'id') then return false;end if;
   placed:=placed||jsonb_build_object(b->>'id',true);
   foreach k in array array['x','y','r','s'] loop if jsonb_typeof(b->k)<>'number' then return false;end if;end loop;
   if (b->>'x')::numeric not between 0 and 1 or (b->>'y')::numeric not between 0 and 1 or (b->>'r')::numeric not between -180 and 180 or (b->>'s')::numeric not between 0.5 and 2 then return false;end if;
  end loop;
 elsif p_cle='study:legacy' then
  if not(p_data ?& array['cutoff','days','items','timeZone']) or (p_data-'cutoff'-'days'-'items'-'timeZone')<>'{}'::jsonb
   or jsonb_typeof(p_data->'cutoff')<>'number' or p_data->>'cutoff' !~ '^[0-9]{1,13}$' or jsonb_typeof(p_data->'days')<>'object' or jsonb_typeof(p_data->'items')<>'object'
   or jsonb_typeof(p_data->'timeZone')<>'string' or length(p_data->>'timeZone')>100 or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_data->>'timeZone') then return false;end if;
  if (p_data->>'cutoff')::bigint not between 946684800000 and 4102444800000 or (select count(*) from jsonb_object_keys(p_data->'days'))>4096 or (select count(*) from jsonb_object_keys(p_data->'items'))>1024 then return false;end if;
  if p_data->>'timeZone'<>'UTC' and position('/' in p_data->>'timeZone')=0 then return false;end if;
  cutoff_day:=to_char(to_timestamp((p_data->>'cutoff')::numeric/1000) at time zone (p_data->>'timeZone'),'YYYY-MM-DD');
  for k,v in select * from jsonb_each(p_data->'days') loop
   if k !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or k<'2000-01-01' or k>'2100-01-01' or k>cutoff_day or jsonb_typeof(v)<>'number' or v::text !~ '^[0-9]{1,5}$' then return false;end if;
   begin if to_char(k::date,'YYYY-MM-DD')<>k then return false;end if;exception when datetime_field_overflow or invalid_datetime_format then return false;end;
   if v::numeric>86400 then return false;end if;days_total:=days_total+v::numeric;
  end loop;
  for k,v in select * from jsonb_each(p_data->'items') loop
   if k !~ '^(l[0-9]{1,6}|d[A-Za-z0-9_-]{1,24}|jeu|console|entretien)$' or jsonb_typeof(v)<>'number' or v::text !~ '^[0-9]{1,10}$' then return false;end if;
   if v::numeric>3155760000 then return false;end if;items_total:=items_total+v::numeric;
  end loop;
  if items_total<>days_total then return false;end if;
 elsif p_cle ~ '^study:[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then
  if not(p_data ?& array['activity','start','end']) or (p_data-'activity'-'start'-'end')<>'{}'::jsonb or jsonb_typeof(p_data->'activity')<>'string'
   or p_data->>'activity' !~ '^(l[0-9]{1,6}|d[A-Za-z0-9_-]{1,24}|jeu|console|entretien)$'
   or jsonb_typeof(p_data->'start')<>'number' or p_data->>'start' !~ '^[0-9]{1,13}$' or jsonb_typeof(p_data->'end')<>'number' or p_data->>'end' !~ '^[0-9]{1,13}$' then return false;end if;
  if (p_data->>'start')::bigint<946684800000 or (p_data->>'end')::bigint>4102444800000 or (p_data->>'end')::bigint<=(p_data->>'start')::bigint or (p_data->>'end')::bigint-(p_data->>'start')::bigint>3600000 then return false;end if;
 else return false;
 end if;
 return true;
end; $$;
revoke all on function requete_private.personnalisation_valide(text,jsonb) from public,anon,authenticated;
create function public.personnalisation_lire()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint; result jsonb;
begin
  if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=u) then raise exception 'Connexion requise' using errcode='42501'; end if;
  insert into public.personnalisation_etat(user_id) values(u) on conflict do nothing;
  select epoch into e from public.personnalisation_etat where user_id=u for update;
  select coalesce(jsonb_agg(jsonb_build_object('key',cle,'data',donnees,'revision',revision,'generation',generation,'deleted',supprime,'updatedAt',modifie_le) order by cle),'[]'::jsonb)
    into result from public.personnalisation_element where user_id=u;
  return jsonb_build_object('schemaVersion',1,'epoch',e,'elements',result);
end; $$;

create function public.personnalisation_enregistrer(p_epoch bigint,p_cle text,p_revision bigint,p_generation bigint,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint; old public.personnalisation_element; row_json jsonb; merged jsonb; k text; v jsonb; prior bigint; incoming bigint;
begin
 if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=u) then raise exception 'Connexion requise' using errcode='42501';end if;
 if p_epoch is null or p_revision is null or p_generation is null or least(p_epoch,p_revision,p_generation)<0 or not requete_private.personnalisation_valide(p_cle,p_data) then raise exception 'Document invalide' using errcode='22023';end if;
 insert into public.personnalisation_etat(user_id) values(u) on conflict do nothing;
 select epoch into e from public.personnalisation_etat where user_id=u for update;
 if e<>p_epoch then return jsonb_build_object('ok',false,'reason','epoch','epoch',e);end if;
 select * into old from public.personnalisation_element where user_id=u and cle=p_cle;
 row_json:=case when old.cle is null then null else jsonb_build_object('key',old.cle,'data',old.donnees,'revision',old.revision,'generation',old.generation,'deleted',old.supprime,'updatedAt',old.modifie_le) end;
 if coalesce(old.generation,0)<>p_generation then return jsonb_build_object('ok',false,'reason','generation','element',row_json);end if;
 if coalesce(old.revision,0)<>p_revision then return jsonb_build_object('ok',false,'reason','revision','element',row_json);end if;
 if p_cle like 'study:%' and not coalesce(old.supprime,true) and old.donnees is distinct from p_data then return jsonb_build_object('ok',false,'reason','immutable_study','element',row_json);end if;
 if old.cle is null and (select count(*) from public.personnalisation_element where user_id=u)>=16384 then raise exception 'Trop de personnalisation' using errcode='54000';end if;
 if coalesce((select sum(octet_length(donnees::text)) from public.personnalisation_element where user_id=u and cle<>p_cle),0)+octet_length(p_data::text)>16777216 then raise exception 'Espace de personnalisation atteint' using errcode='54000';end if;
 merged:=p_data;
 if p_cle='stickers:board' and not coalesce(old.supprime,true) then
  for k,v in select * from jsonb_each(old.donnees->'got') loop
   prior:=v::text::bigint;incoming:=(merged#>>array['got',k])::bigint;
   merged:=jsonb_set(merged,array['got',k],to_jsonb(case when incoming is null then prior when prior=1 then incoming when incoming=1 then prior else least(prior,incoming) end));
  end loop;
  prior:=(old.donnees->>'since')::bigint;incoming:=(merged->>'since')::bigint;
  if prior>0 then merged:=jsonb_set(merged,'{since}',to_jsonb(case when incoming>0 then least(prior,incoming) else prior end));end if;
 end if;

 insert into public.personnalisation_element(user_id,cle,donnees,revision,generation,supprime)
 values(u,p_cle,merged,coalesce(old.revision,0)+1,coalesce(old.generation,0),false)
 on conflict(user_id,cle) do update set donnees=excluded.donnees,revision=excluded.revision,supprime=false,modifie_le=clock_timestamp()
 returning jsonb_build_object('key',cle,'data',donnees,'revision',revision,'generation',generation,'deleted',supprime,'updatedAt',modifie_le) into row_json;
 return jsonb_build_object('ok',true,'epoch',e,'element',row_json);
end; $$;

create function public.personnalisation_reinitialiser(p_epoch bigint,p_cle text,p_revision bigint,p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint; old public.personnalisation_element; target text;
begin
  if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=u) then raise exception 'Connexion requise' using errcode='42501'; end if;
  if p_epoch is null or p_revision is null or p_generation is null or least(p_epoch,p_revision,p_generation)<0 or p_cle is null or p_cle !~ '^(preferences:main|stickers:board|study:legacy|study:[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12})$' then raise exception 'Demande invalide' using errcode='22023'; end if;
  insert into public.personnalisation_etat(user_id) values(u) on conflict do nothing;
  select epoch into e from public.personnalisation_etat where user_id=u for update;
  if e<>p_epoch then return jsonb_build_object('ok',false,'reason','epoch','epoch',e); end if;
  select * into old from public.personnalisation_element where user_id=u and cle=p_cle;
  if coalesce(old.generation,0)<>p_generation then return jsonb_build_object('ok',false,'reason','generation'); end if;
  if coalesce(old.revision,0)<>p_revision then return jsonb_build_object('ok',false,'reason','revision'); end if;
  if p_cle like 'study:%' and not coalesce(old.supprime,true) and old.donnees is distinct from p_data then return jsonb_build_object('ok',false,'reason','immutable_study','element',row_json);end if;
 if old.cle is null and (select count(*) from public.personnalisation_element where user_id=u)>=16384 then raise exception 'Trop d’éléments' using errcode='54000'; end if;
  foreach target in array array[p_cle] loop
    insert into public.personnalisation_element(user_id,cle,donnees,generation,supprime) values(u,target,'{}'::jsonb,1,true)
    on conflict(user_id,cle) do update set donnees='{}'::jsonb,generation=public.personnalisation_element.generation+1,revision=public.personnalisation_element.revision+1,supprime=true,modifie_le=clock_timestamp();
  end loop;
  return jsonb_build_object('ok',true,'epoch',e);
end; $$;

create function public.personnalisation_effacer(p_epoch bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint;
begin
  if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=u) then raise exception 'Connexion requise' using errcode='42501'; end if;
  if p_epoch is null or p_epoch<0 then raise exception 'Demande invalide' using errcode='22023'; end if;
  insert into public.personnalisation_etat(user_id) values(u) on conflict do nothing;
  select epoch into e from public.personnalisation_etat where user_id=u for update;
  if e<>p_epoch then return jsonb_build_object('ok',false,'reason','epoch','epoch',e); end if;
  delete from public.personnalisation_element where user_id=u;
  update public.personnalisation_etat set epoch=epoch+1,modifie_le=clock_timestamp() where user_id=u returning epoch into e;
  return jsonb_build_object('ok',true,'epoch',e);
end; $$;

revoke all on function public.personnalisation_lire(),public.personnalisation_enregistrer(bigint,text,bigint,bigint,jsonb),public.personnalisation_reinitialiser(bigint,text,bigint,bigint),public.personnalisation_effacer(bigint) from public,anon,authenticated;
grant execute on function public.personnalisation_lire(),public.personnalisation_enregistrer(bigint,text,bigint,bigint,jsonb),public.personnalisation_reinitialiser(bigint,text,bigint,bigint),public.personnalisation_effacer(bigint) to authenticated;
