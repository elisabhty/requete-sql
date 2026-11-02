-- All fixtures rolled back. SQLite snapshots are opaque stored data, never opened here.
begin;
select set_config('requete.proj_a',gen_random_uuid()::text,true);
select set_config('requete.proj_b',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('requete.proj_a')::uuid),(current_setting('requete.proj_b')::uuid);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.proj_a'),'role','authenticated')::text,true);
do $$
declare p jsonb:='{"name":"Mes ventes","scope":"workspace","draft":"DROP TABLE exemple; -- texte seulement","desc":"Mon projet","tdesc":{"ventes":"Ventes"},"pins":[{"sql":"SELECT 1","ts":100}],"hist":[],"database":null,"baselines":{}}'; r jsonb; bad jsonb; b64 text;
begin
 r:=public.projets_lire();if jsonb_array_length(r->'elements')<>0 then raise exception 'FAIL initial projects';end if;
 r:=public.projets_enregistrer(0,'project:db_personal',0,0,p);
 if r->>'ok'<>'true' or r#>'{element,data}'<>p then raise exception 'FAIL project fields';end if;
 r:=public.projets_enregistrer(0,'project:db_personal',1,0,p||'{"name":"Depuis le web"}');
 if r#>>'{element,data,name}'<>'Depuis le web' then raise exception 'FAIL project update';end if;
 r:=public.projets_enregistrer(0,'project:db_personal',1,0,p||'{"name":"Ancien appareil"}');
 if r->>'reason'<>'revision' then raise exception 'FAIL conflicting project';end if;
 for bad in select value from jsonb_array_elements(jsonb_build_array(
  p||'{"token":"secret"}',p-'draft',p||'{"scope":"complete"}',p||'{"name":""}',
  p||'{"pins":[{"sql":"SELECT 1","ts":100,"secret":"x"}]}',
  p||'{"scope":"complete","database":{"b64":"Q1NW"}}',
  p||jsonb_build_object('draft',repeat('x',12001))
 )) loop
  begin perform public.projets_enregistrer(0,'project:db_personal',2,0,bad);raise exception 'FAIL invalid project';exception when invalid_parameter_value then null;end;
 end loop;
 begin perform public.projets_enregistrer(0,'project:cours',0,0,p);raise exception 'FAIL reserved project id';exception when invalid_parameter_value then null;end;
 -- Empty SQLite database is distinct from no database. Full integrity is checked locally on restore.
 r:=public.projets_enregistrer(0,'project:db_empty',0,0,p||'{"scope":"complete","database":{"b64":""}}');
 if r->>'ok'<>'true' then raise exception 'FAIL empty SQLite';end if;
 -- Validate/round-trip an opaque header fixture, without ever executing its bytes.
 b64:=replace(encode(decode('53514c69746520666f726d6174203300','hex')||decode(repeat('00',84),'hex'),'base64'),E'\n','');
 r:=public.projets_enregistrer(0,'project:db_header',0,0,p||jsonb_build_object('scope','complete','database',jsonb_build_object('b64',b64),'baselines',jsonb_build_object('ventes',jsonb_build_object('name','ventes','b64',b64))));
 if r#>>'{element,data,database,b64}'<>b64 then raise exception 'FAIL snapshot changed';end if;
 r:=public.projets_enregistrer(0,'project:db_header',1,0,p);
 if r->>'reason'<>'database_removal' or r#>>'{element,data,database,b64}'<>b64 then raise exception 'FAIL full snapshot lost';end if;
 begin update public.projets_element set donnees=p;raise exception 'FAIL direct update';exception when insufficient_privilege then null;end;
 begin insert into public.projets_element(user_id,cle,donnees) values(auth.uid(),'project:db_direct',p);raise exception 'FAIL direct insert';exception when insufficient_privilege then null;end;
 r:=public.projets_reinitialiser(0,'project:db_personal',2,0);
 if r->>'ok'<>'true' then raise exception 'FAIL project delete';end if;
 r:=public.projets_lire();
 if not exists(select 1 from jsonb_array_elements(r->'elements') e where e->>'key'='project:db_personal' and e->>'deleted'='true' and e->'data'='{}'::jsonb) then raise exception 'FAIL snapshot retained after delete';end if;
 r:=public.projets_enregistrer(0,'project:db_personal',2,0,p);if r->>'reason'<>'generation' then raise exception 'FAIL deleted project resurrected';end if;
 perform public.documents_enregistrer(0,'note:untouched',0,0,'{"txt":"Note indépendante","sql":"","ctx":"","ts":100,"pin":false}');
 perform public.progression_enregistrer(0,'lesson:0',0,0,'{"done":true}');
 perform public.projets_effacer(0);
 r:=public.documents_lire();if jsonb_array_length(r->'elements')<>1 then raise exception 'FAIL projects reset removed notes';end if;
 r:=public.progression_lire();if jsonb_array_length(r->'elements')<>1 then raise exception 'FAIL projects reset removed courses';end if;
 r:=public.projets_enregistrer(0,'project:db_old',0,0,p);if r->>'reason'<>'epoch' then raise exception 'FAIL old queue after clear';end if;
 perform public.projets_enregistrer(1,'project:db_final',0,0,p);
end; $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.proj_b'),'role','authenticated')::text,true);
do $$ declare r jsonb;begin
 r:=public.projets_lire();if jsonb_array_length(r->'elements')<>0 then raise exception 'FAIL another projects snapshot';end if;
 if exists(select 1 from public.projets_element where user_id=current_setting('requete.proj_a')::uuid) then raise exception 'FAIL another projects row';end if;
end; $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.proj_a'),'role','authenticated','is_anonymous',true)::text,true);
do $$ begin
 if exists(select 1 from public.projets_element) then raise exception 'FAIL guest read';end if;
 begin perform public.projets_lire();raise exception 'FAIL guest RPC';exception when insufficient_privilege then null;end;
end; $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 begin perform public.projets_lire();raise exception 'FAIL anon RPC';exception when insufficient_privilege then null;end;
 begin perform * from public.projets_element;raise exception 'FAIL anon table';exception when insufficient_privilege then null;end;
end; $$;
reset role;
delete from auth.users where id=current_setting('requete.proj_a')::uuid;
do $$ begin
 if exists(select 1 from public.projets_element where user_id=current_setting('requete.proj_a')::uuid) or exists(select 1 from public.projets_etat where user_id=current_setting('requete.proj_a')::uuid) then raise exception 'FAIL project deletion cascade';end if;
end; $$;
select 'PASS: projets privés, instantanés opaques, champs, conflits, suppressions et espaces indépendants' as resultat;
rollback;
