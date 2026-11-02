-- Real RPCs and RLS in a rolled-back transaction; no user data retained.
begin;
select set_config('requete.plan_a',gen_random_uuid()::text,true);
select set_config('requete.plan_b',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('requete.plan_a')::uuid),(current_setting('requete.plan_b')::uuid);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.plan_a'),'role','authenticated')::text,true);
do $$
declare p jsonb:='{"niveau":"debutant","rythme":"regulier","freq":3,"per":3,"mix":true,"timeZone":"Europe/Paris","sessions":[{"d":"2026-11-02","lessons":[0,1]}],"archive":[2]}'; r jsonb; bad jsonb;
begin
 r:=public.progression_enregistrer(0,'planning:main',0,0,p);
 if r->>'ok'<>'true' or r#>'{element,data}'<>p then raise exception 'FAIL plan save'; end if;
 p:=jsonb_set(p,'{sessions}', '[{"d":"2026-11-05","lessons":[1,0]}]');
 r:=public.progression_enregistrer(0,'planning:main',1,0,p);
 if r->>'ok'<>'true' or r#>'{element,data,sessions}'<>p->'sessions' then raise exception 'FAIL moved session'; end if;
 r:=public.progression_enregistrer(0,'planning:main',1,0,p);
 if r->>'reason'<>'revision' then raise exception 'FAIL stale plan accepted'; end if;
 for bad in select value from jsonb_array_elements(jsonb_build_array(
  jsonb_set(p,'{sessions,0,lessons}','[0,0]'),
  jsonb_set(p,'{archive}','[0]'),
  jsonb_set(p,'{sessions,0,d}','"2026-02-30"'),
  jsonb_set(p,'{timeZone}','"Mars/Paris"'),
  jsonb_set(p,'{freq}','4'),p||'{"sql":"private"}',p-'sessions',
  jsonb_set(p,'{sessions,0}','{"d":"2026-11-05","lessons":[0],"sql":"private"}'),
  jsonb_set(p,'{sessions}','[{"d":"2026-11-05","lessons":[0]},{"d":"2026-11-05","lessons":[1]}]')
 )) loop
  begin
   perform public.progression_enregistrer(0,'planning:main',2,0,bad);
   raise exception 'FAIL invalid plan accepted: %',bad;
  exception when invalid_parameter_value then null; end;
 end loop;
 r:=public.progression_enregistrer(0,'lesson:0',0,0,'{"done":true,"level":4,"due":1000}');
 r:=public.progression_enregistrer(0,'lesson:0',1,0,'{"level":0,"due":100}');
 if r#>>'{element,data,level}'<>'0' or r#>>'{element,data,due}'<>'100' or r#>>'{element,data,done}'<>'true' then raise exception 'FAIL failed review'; end if;
 r:=public.progression_enregistrer(0,'lesson:0',1,0,'{"level":4,"due":2000}');
 if r->>'reason'<>'revision' then raise exception 'FAIL stale review'; end if;
 r:=public.progression_reinitialiser(0,'planning:main',2,0);
 if r->>'ok'<>'true' then raise exception 'FAIL plan reset'; end if;
 r:=public.progression_enregistrer(0,'planning:main',2,0,p);
 if r->>'reason'<>'generation' then raise exception 'FAIL deleted plan resurrected'; end if;
 r:=public.progression_enregistrer(0,'planning:main',3,1,p);
 if r->>'ok'<>'true' then raise exception 'FAIL explicit new plan'; end if;
end; $$;
-- B cannot read or reset A's plan, even if it guesses the key and revision.
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.plan_b'),'role','authenticated')::text,true);
do $$
declare r jsonb;
begin
 if exists(select 1 from public.progression_element where cle='planning:main') then raise exception 'FAIL another plan visible'; end if;
 r:=public.progression_lire();if jsonb_array_length(r->'elements')<>0 then raise exception 'FAIL RPC leaks another plan'; end if;
 r:=public.progression_reinitialiser(0,'planning:main',4,1);
 if r->>'ok'='true' then raise exception 'FAIL cross account reset'; end if;
end; $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.plan_a'),'role','authenticated','is_anonymous',true)::text,true);
do $$
begin
 begin perform public.progression_lire();raise exception 'FAIL guest RPC';exception when insufficient_privilege then null;end;
end; $$;
reset role;
do $$
begin
 if not exists(select 1 from public.progression_element where user_id=current_setting('requete.plan_a')::uuid and cle='planning:main' and not supprime and revision=4) then raise exception 'FAIL other account changed plan'; end if;
 if has_function_privilege('anon','public.progression_enregistrer(bigint,text,bigint,bigint,jsonb)','EXECUTE')
  or has_table_privilege('authenticated','public.progression_element','UPDATE') then raise exception 'FAIL permissions'; end if;
end; $$;
select 'PASS: planning, déplacements, doublons, fuseau, conflits, révisions, suppression et isolation' as resultat;
rollback;
