-- Rollback all fixture accounts and personalisation. No real preference or notification changes.
begin;
select set_config('requete.perso_a',gen_random_uuid()::text,true);
select set_config('requete.perso_b',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('requete.perso_a')::uuid),(current_setting('requete.perso_b')::uuid);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.perso_a'),'role','authenticated')::text,true);
do $$
declare s jsonb:='{"got":{"intro":1,"lire":100},"fresh":{"intro":1},"board":[{"id":"intro","x":0.5,"y":0.5,"r":0,"s":1}],"since":100}';
 prefs jsonb:='{"largeText":true,"reduceMotion":false,"videoRate":1.5,"challenge":{"niv":"f","nb":3,"mode":"solo","nivUser":false},"reminder":{"enabled":true,"time":"19:00"}}';
 event jsonb:='{"activity":"l0","start":1793620800000,"end":1793620860000}';
 legacy jsonb:='{"cutoff":1793620800000,"timeZone":"UTC","days":{"2026-11-02":60},"items":{"l0":60}}'; r jsonb; bad jsonb;
begin
 r:=public.personnalisation_lire();if jsonb_array_length(r->'elements')<>0 then raise exception 'FAIL initial snapshot';end if;
 r:=public.personnalisation_enregistrer(0,'stickers:board',0,0,s);if r->>'ok'<>'true' then raise exception 'FAIL stickers save';end if;
 s:=s||'{"got":{"intro":1793620800000},"fresh":{},"board":[],"since":200}';
 r:=public.personnalisation_enregistrer(0,'stickers:board',1,0,s);
 if r#>>'{element,data,got,intro}'<>'1793620800000' or r#>>'{element,data,got,lire}'<>'100' or r#>>'{element,data,since}'<>'100' then raise exception 'FAIL earned stickers or known date lost';end if;
 r:=public.personnalisation_enregistrer(0,'stickers:board',1,0,s);if r->>'reason'<>'revision' then raise exception 'FAIL stale board';end if;
 r:=public.personnalisation_enregistrer(0,'preferences:main',0,0,prefs);
 if r#>>'{element,data,videoRate}'<>'1.5' then raise exception 'FAIL preferences';end if;
 for bad in select value from jsonb_array_elements(jsonb_build_array(
  prefs||'{"token":"not-for-cloud"}',prefs||'{"videoRate":3}',jsonb_set(prefs,'{reminder,time}','"25:00"'),prefs-'largeText'
 )) loop
  begin perform public.personnalisation_enregistrer(0,'preferences:main',1,0,bad);raise exception 'FAIL invalid preference';exception when invalid_parameter_value then null;end;
 end loop;
 begin perform public.personnalisation_enregistrer(0,'stickers:board',2,0,s||'{"got":{"fake":1}}');raise exception 'FAIL unknown sticker';exception when invalid_parameter_value then null;end;
 begin perform public.personnalisation_enregistrer(0,'stickers:board',2,0,s||'{"board":[{"id":"lire","x":0.5,"y":0.5,"r":0,"s":1}]}');raise exception 'FAIL non-earned placement';exception when invalid_parameter_value then null;end;
 r:=public.personnalisation_enregistrer(0,'study:00000000-0000-0000-0000-000000000001',0,0,event);
 if r->>'ok'<>'true' then raise exception 'FAIL study event';end if;
 r:=public.personnalisation_enregistrer(0,'study:00000000-0000-0000-0000-000000000001',1,0,event||'{"end":1793620920000}');
 if r->>'reason'<>'immutable_study' then raise exception 'FAIL mutable event';end if;
 r:=public.personnalisation_enregistrer(0,'study:legacy',0,0,legacy);if r->>'ok'<>'true' then raise exception 'FAIL historical baseline';end if;
 r:=public.personnalisation_enregistrer(0,'study:legacy',1,0,legacy||'{"days":{"2026-11-02":120},"items":{"l0":120}}');if r->>'reason'<>'immutable_study' then raise exception 'FAIL second device overwrote baseline';end if;
 begin perform public.personnalisation_enregistrer(0,'study:legacy',1,0,legacy||'{"days":{"2026-11-03":60}}');raise exception 'FAIL future baseline';exception when invalid_parameter_value then null;end;
 begin perform public.personnalisation_enregistrer(0,'study:legacy',1,0,legacy||'{"items":{"l0":30}}');raise exception 'FAIL inconsistent totals';exception when invalid_parameter_value then null;end;
 begin perform public.personnalisation_enregistrer(0,'study:00000000-0000-0000-0000-000000000002',0,0,event||'{"end":1793624400001}');raise exception 'FAIL excessive event duration';exception when invalid_parameter_value then null;end;
 begin update public.personnalisation_element set donnees=prefs;raise exception 'FAIL direct write';exception when insufficient_privilege then null;end;
 r:=public.personnalisation_reinitialiser(0,'stickers:board',2,0);if r->>'ok'<>'true' then raise exception 'FAIL reset board';end if;
 r:=public.personnalisation_enregistrer(0,'stickers:board',2,0,s);if r->>'reason'<>'generation' then raise exception 'FAIL old board resurrected';end if;
 -- An effacement only affects this new namespace.
 perform public.progression_enregistrer(0,'lesson:0',0,0,'{"done":true}');
 perform public.personnalisation_effacer(0);
 r:=public.progression_lire();if jsonb_array_length(r->'elements')<>1 then raise exception 'FAIL personalisation reset removed learning';end if;
 r:=public.personnalisation_enregistrer(0,'preferences:main',0,0,prefs);if r->>'reason'<>'epoch' then raise exception 'FAIL old queue after reset';end if;
 perform public.personnalisation_enregistrer(1,'preferences:main',0,0,prefs);
end; $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.perso_b'),'role','authenticated')::text,true);
do $$ declare s jsonb;begin
 s:=public.personnalisation_lire();if jsonb_array_length(s->'elements')<>0 then raise exception 'FAIL other account snapshot';end if;
 if exists(select 1 from public.personnalisation_element where user_id=current_setting('requete.perso_a')::uuid) then raise exception 'FAIL other account rows';end if;
end; $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.perso_a'),'role','authenticated','is_anonymous',true)::text,true);
do $$ begin
 if exists(select 1 from public.personnalisation_element) then raise exception 'FAIL guest rows';end if;
 begin perform public.personnalisation_lire();raise exception 'FAIL guest RPC';exception when insufficient_privilege then null;end;
end; $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 begin perform public.personnalisation_lire();raise exception 'FAIL anon RPC';exception when insufficient_privilege then null;end;
 begin perform * from public.personnalisation_element;raise exception 'FAIL anon rows';exception when insufficient_privilege then null;end;
end; $$;
reset role;
delete from auth.users where id=current_setting('requete.perso_a')::uuid;
do $$ begin
 if exists(select 1 from public.personnalisation_element where user_id=current_setting('requete.perso_a')::uuid) or exists(select 1 from public.personnalisation_etat where user_id=current_setting('requete.perso_a')::uuid) then raise exception 'FAIL cascade';end if;
end; $$;
select 'PASS: stickers, préférences, périodes immuables, reprise historique, versions, isolation et suppression' as resultat;
rollback;
