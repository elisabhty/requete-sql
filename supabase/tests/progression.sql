-- Integration tests in one rolled-back transaction. No real learning data is uploaded.
begin;
select set_config('requete.progress_a',gen_random_uuid()::text,true);
select set_config('requete.progress_b',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('requete.progress_a')::uuid),(current_setting('requete.progress_b')::uuid);
insert into public.progression_etat(user_id) values(current_setting('requete.progress_b')::uuid);
insert into public.progression_element(user_id,cle,donnees) values(current_setting('requete.progress_b')::uuid,'lesson:0','{"done":true}');
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.progress_a'),'role','authenticated')::text,true);
do $$
declare r jsonb; n integer;
begin
  r:=public.progression_lire();
  if r->>'epoch'<>'0' or jsonb_array_length(r->'elements')<>0 then raise exception 'FAIL initial state'; end if;
  r:=public.progression_enregistrer(0,'lesson:0',0,0,'{"done":true,"etapes":{"q1":1},"at":100}');
  if r->>'ok'<>'true' then raise exception 'FAIL first save'; end if;
  r:=public.progression_enregistrer(0,'lesson:0',1,0,'{"done":false,"etapes":{"q2":1},"at":200}');
  if r#>>'{element,data,done}'<>'true' or r#>>'{element,data,at}'<>'100' or not((r#>'{element,data,etapes}')?&array['q1','q2']) then raise exception 'FAIL monotonic merge'; end if;
  r:=public.progression_enregistrer(0,'lesson:0',0,0,'{"done":false}');
  if r->>'reason'<>'revision' then raise exception 'FAIL stale device'; end if;
  r:=public.progression_enregistrer(0,'video:0',0,0,'{"position":90,"contentVersion":"v1","answers":{"p0":{"first":0,"err":2}}}');
  if r->>'ok'<>'true' then raise exception 'FAIL video save'; end if;
  r:=public.progression_enregistrer(0,'video:0',1,0,'{"position":20,"contentVersion":"v1","answers":{"p0":{"first":1,"err":0},"p1":{"first":1,"err":0}}}');
  if r#>>'{element,data,position}'<>'20' or r#>>'{element,data,answers,p0,first}'<>'0' or not((r#>'{element,data,answers}')?'p1') then raise exception 'FAIL video merge or rewind'; end if;
  r:=public.progression_enregistrer(0,'video:0',2,0,'{"position":10,"contentVersion":"v2"}');
  if r->>'reason'<>'content_version' then raise exception 'FAIL changed content'; end if;
  r:=public.progression_reinitialiser(0,'lesson:0',2,0);
  if r->>'ok'<>'true' then raise exception 'FAIL lesson reset'; end if;
  r:=public.progression_enregistrer(0,'lesson:0',2,0,'{"done":true}');
  if r->>'reason'<>'generation' then raise exception 'FAIL old completion resurrected'; end if;
  r:=public.progression_enregistrer(0,'video:0',2,0,'{"position":90,"contentVersion":"v1"}');
  if r->>'reason'<>'generation' then raise exception 'FAIL old video resurrected'; end if;
  r:=public.progression_effacer(0);
  if r->>'ok'<>'true' or r->>'epoch'<>'1' then raise exception 'FAIL reset all'; end if;
  r:=public.progression_enregistrer(0,'challenge:af1',0,0,'{"done":true}');
  if r->>'reason'<>'epoch' then raise exception 'FAIL old device resurrected progress'; end if;
  r:=public.progression_effacer(0);
  if r->>'reason'<>'epoch' then raise exception 'FAIL repeated reset'; end if;
  begin
    perform public.progression_enregistrer(1,'lesson:0',0,0,'{"done":true,"cle":"not-for-cloud"}');
    raise exception 'FAIL secret accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.progression_enregistrer(1,'video:0',0,0,'{"contentVersion":"v1","answers":{"d0":{"sql":"not-for-cloud"}}}');
    raise exception 'FAIL draft accepted';
  exception when invalid_parameter_value then null; end;
  begin
    insert into public.progression_element(user_id,cle) values(auth.uid(),'lesson:99');
    raise exception 'FAIL direct insert';
  exception when insufficient_privilege then null; end;
  begin
    update public.progression_element set revision=0;
    raise exception 'FAIL direct update';
  exception when insufficient_privilege then null; end;
  select count(*) into n from public.progression_element where user_id=current_setting('requete.progress_b')::uuid;
  if n<>0 then raise exception 'FAIL another account visible'; end if;
  perform public.progression_enregistrer(1,'lesson:0',0,0,'{"done":true}');
end; $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$
begin
  begin perform public.progression_lire();raise exception 'FAIL anonymous RPC';exception when insufficient_privilege then null;end;
  begin perform * from public.progression_element;raise exception 'FAIL anonymous table';exception when insufficient_privilege then null;end;
end; $$;
reset role;
delete from auth.users where id=current_setting('requete.progress_a')::uuid;
do $$
begin
  if exists(select 1 from public.progression_element where user_id=current_setting('requete.progress_a')::uuid)
    or exists(select 1 from public.progression_etat where user_id=current_setting('requete.progress_a')::uuid) then raise exception 'FAIL account deletion cascade';end if;
  if not exists(select 1 from public.progression_element where user_id=current_setting('requete.progress_b')::uuid) then raise exception 'FAIL other account changed';end if;
end; $$;
select 'PASS: isolation, droits, conflits, fusion, vidéo, réinitialisations, données exclues et suppression en cascade' as resultat;
rollback;
