-- Collection uses the existing private progress snapshot. No duplicate unlock table.
-- All accounts, progress and resets below are fixtures rolled back at the end.
begin;
select set_config('requete.collection_a',gen_random_uuid()::text,true);
select set_config('requete.collection_b',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('requete.collection_a')::uuid),(current_setting('requete.collection_b')::uuid);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.collection_a'),'role','authenticated')::text,true);
do $$
declare s jsonb; r jsonb;
begin
 r:=public.progression_enregistrer(0,'lesson:0',0,0,'{"done":true,"at":100,"level":0}');
 if r->>'ok'<>'true' then raise exception 'FAIL learning progress';end if;
 s:=public.progression_lire();
 if not exists(select 1 from jsonb_array_elements(s->'elements') e where e->>'key'='lesson:0' and e#>>'{data,done}'='true' and e->>'deleted'='false') then raise exception 'FAIL collection source';end if;
 r:=public.progression_enregistrer(0,'lesson:0',1,0,'{"done":false}');
 if r#>>'{element,data,done}'<>'true' then raise exception 'FAIL old device removes card';end if;
 begin perform public.progression_enregistrer(0,'collection:0',0,0,'{"unlocked":true}');raise exception 'FAIL independent unlock accepted';exception when invalid_parameter_value then null;end;
 r:=public.progression_reinitialiser(0,'lesson:0',2,0);
 if r->>'ok'<>'true' then raise exception 'FAIL reset lesson';end if;
 s:=public.progression_lire();
 if exists(select 1 from jsonb_array_elements(s->'elements') e where e->>'key'='lesson:0' and e->>'deleted'='false') then raise exception 'FAIL deleted lesson remains unlocked';end if;
 r:=public.progression_enregistrer(0,'lesson:0',2,0,'{"done":true}');
 if r->>'reason'<>'generation' then raise exception 'FAIL old queue resurrects card';end if;
 r:=public.progression_effacer(0);s:=public.progression_lire();
 if s->>'epoch'<>'1' or jsonb_array_length(s->'elements')<>0 then raise exception 'FAIL clear collection source';end if;
 r:=public.progression_enregistrer(1,'lesson:4',0,0,'{"done":true}');
end; $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.collection_b'),'role','authenticated')::text,true);
do $$ declare s jsonb;begin
 s:=public.progression_lire();if jsonb_array_length(s->'elements')<>0 then raise exception 'FAIL another collection visible';end if;
 if exists(select 1 from public.progression_element where user_id=current_setting('requete.collection_a')::uuid) then raise exception 'FAIL direct collection read';end if;
end; $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.collection_a'),'role','authenticated','is_anonymous',true)::text,true);
do $$ begin
 begin perform public.progression_lire();raise exception 'FAIL anonymous Auth snapshot';exception when insufficient_privilege then null;end;
end; $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 begin perform public.progression_lire();raise exception 'FAIL anon snapshot';exception when insufficient_privilege then null;end;
end; $$;
reset role;
delete from auth.users where id=current_setting('requete.collection_a')::uuid;
do $$ begin
 if exists(select 1 from public.progression_element where user_id=current_setting('requete.collection_a')::uuid) then raise exception 'FAIL account deletion';end if;
end; $$;
select 'PASS: source privée de collection, réinitialisations, appareils périmés, isolation et suppression' as resultat;
rollback;
