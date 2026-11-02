-- Real private document RPCs in a rolled-back transaction. SQL content is data only.
begin;
select set_config('requete.docs_a',gen_random_uuid()::text,true);
select set_config('requete.docs_b',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('requete.docs_a')::uuid),(current_setting('requete.docs_b')::uuid);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.docs_a'),'role','authenticated')::text,true);
do $$
declare p jsonb:='{"txt":"Ma note","sql":"DROP TABLE exemple; -- texte sauvegardé seulement","ctx":"Console","ts":100,"pin":false}'; r jsonb; bad jsonb;
begin
 r:=public.documents_lire();if r->>'epoch'<>'0' or jsonb_array_length(r->'elements')<>0 then raise exception 'FAIL initial documents';end if;
 r:=public.documents_enregistrer(0,'note:n123',0,0,p);
 if r->>'ok'<>'true' or r#>'{element,data}'<>p then raise exception 'FAIL saved SQL modified';end if;
 p:=p||'{"txt":"Depuis le web","sql":"","pin":true}';
 r:=public.documents_enregistrer(0,'note:n123',1,0,p);
 if r->>'ok'<>'true' or r#>>'{element,data,sql}'<>'' or r#>>'{element,data,pin}'<>'true' then raise exception 'FAIL SQL clear or pin';end if;
 r:=public.documents_enregistrer(0,'note:n123',1,0,p||'{"txt":"Ancien appareil"}');
 if r->>'reason'<>'revision' or r#>>'{element,data,txt}'<>'Depuis le web' then raise exception 'FAIL conflicting edit';end if;
 for bad in select value from jsonb_array_elements(jsonb_build_array(
  p||'{"user_id":"other"}',p||'{"token":"not-for-cloud"}',p-'pin',p||'{"pin":"false"}',
  p||'{"txt":"","sql":""}',p||jsonb_build_object('sql',repeat('x',12001)),p||jsonb_build_object('txt',repeat('😀',20000))
 )) loop
  begin perform public.documents_enregistrer(0,'note:n123',2,0,bad);raise exception 'FAIL invalid document';exception when invalid_parameter_value then null;end;
 end loop;
 begin insert into public.documents_element(user_id,cle,donnees) values(auth.uid(),'note:direct',p);raise exception 'FAIL direct insert';exception when insufficient_privilege then null;end;
 begin update public.documents_element set donnees=p;raise exception 'FAIL direct update';exception when insufficient_privilege then null;end;
 begin delete from public.documents_element;raise exception 'FAIL direct delete';exception when insufficient_privilege then null;end;
 r:=public.documents_reinitialiser(0,'note:n123',2,0);if r->>'ok'<>'true' then raise exception 'FAIL delete note';end if;
 r:=public.documents_lire();
 if not exists(select 1 from jsonb_array_elements(r->'elements') e where e->>'key'='note:n123' and e->>'deleted'='true' and e->'data'='{}'::jsonb) then raise exception 'FAIL deletion content retained';end if;
 r:=public.documents_enregistrer(0,'note:n123',2,0,p);if r->>'reason'<>'generation' then raise exception 'FAIL deleted note resurrected';end if;
 -- Explicit fresh write in the new generation may recreate it.
 r:=public.documents_enregistrer(0,'note:n123',3,1,p);if r->>'ok'<>'true' then raise exception 'FAIL intentional recreation';end if;
 -- Learning and documents have independent reset namespaces.
 perform public.progression_enregistrer(0,'lesson:0',0,0,'{"done":true}');
 perform public.progression_effacer(0);
 r:=public.documents_lire();if jsonb_array_length(r->'elements')<>1 then raise exception 'FAIL learning reset removed note';end if;
 perform public.progression_enregistrer(1,'lesson:0',0,0,'{"done":true}');
 r:=public.documents_effacer(0);if r->>'epoch'<>'1' then raise exception 'FAIL documents epoch';end if;
 r:=public.progression_lire();if jsonb_array_length(r->'elements')<>1 then raise exception 'FAIL documents reset removed learning';end if;
 r:=public.documents_enregistrer(0,'note:old',0,0,p);if r->>'reason'<>'epoch' then raise exception 'FAIL old queue after global clear';end if;
 perform public.documents_enregistrer(1,'note:new',0,0,p);
end; $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.docs_b'),'role','authenticated')::text,true);
do $$ declare s jsonb;begin
 s:=public.documents_lire();if jsonb_array_length(s->'elements')<>0 then raise exception 'FAIL another documents snapshot visible';end if;
 if exists(select 1 from public.documents_element where user_id=current_setting('requete.docs_a')::uuid) then raise exception 'FAIL another documents row visible';end if;
end; $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.docs_a'),'role','authenticated','is_anonymous',true)::text,true);
do $$ begin
 if exists(select 1 from public.documents_element) then raise exception 'FAIL anonymous Auth direct read';end if;
 begin perform public.documents_lire();raise exception 'FAIL anonymous Auth RPC';exception when insufficient_privilege then null;end;
end; $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 begin perform * from public.documents_element;raise exception 'FAIL anon table';exception when insufficient_privilege then null;end;
 begin perform public.documents_lire();raise exception 'FAIL anon RPC';exception when insufficient_privilege then null;end;
end; $$;
reset role;
delete from auth.users where id=current_setting('requete.docs_a')::uuid;
do $$ begin
 if exists(select 1 from public.documents_element where user_id=current_setting('requete.docs_a')::uuid)
  or exists(select 1 from public.documents_etat where user_id=current_setting('requete.docs_a')::uuid) then raise exception 'FAIL document deletion cascade';end if;
end; $$;
select 'PASS: notes, SQL conservé sans exécution, versions, suppressions, espaces indépendants et accès privés' as resultat;
rollback;
