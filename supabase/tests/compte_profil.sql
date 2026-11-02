-- Owner SQL editor only. All fixtures are rolled back; no email/password sent.
begin;
select set_config('requete.test_user_a',gen_random_uuid()::text,true);
select set_config('requete.test_user_b',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('requete.test_user_a')::uuid),(current_setting('requete.test_user_b')::uuid);
insert into public.compte_profil(user_id,prenom) values(current_setting('requete.test_user_b')::uuid,'Autre');
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.test_user_a'),'role','authenticated')::text,true);
do $$
declare p jsonb; r jsonb; bad jsonb; u uuid:=auth.uid();
begin
 if public.compte_profil_lire() is not null then raise exception 'FAIL initial profile';end if;
 p:=public.compte_profil_creer('{"prenom":"Elisa","objectif":"work","fuseau_horaire":"Europe/Paris"}');
 if p->>'prenom'<>'Elisa' or p->>'revision'<>'1' or p->>'objectif'<>'work' or p->>'fuseau_horaire'<>'Europe/Paris' then raise exception 'FAIL profile create';end if;
 p:=public.compte_profil_creer('{"prenom":"Invité","objectif":"curious"}');
 if p->>'prenom'<>'Elisa' or p->>'objectif'<>'work' then raise exception 'FAIL cloud profile overwritten at creation';end if;
 r:=public.compte_profil_enregistrer(1,'{"prenom":"Alice","objectif":"career"}',u);
 if r->>'ok'<>'true' or r#>>'{profile,revision}'<>'2' or r#>>'{profile,fuseau_horaire}'<>'Europe/Paris' then raise exception 'FAIL profile update';end if;
 if (r#>>'{profile,modifie_le}')::timestamptz<(p->>'cree_le')::timestamptz then raise exception 'FAIL timestamp';end if;
 r:=public.compte_profil_enregistrer(1,'{"prenom":"Ancienne sauvegarde"}',u);
 if r->>'ok'<>'false' or r#>>'{profile,prenom}'<>'Alice' then raise exception 'FAIL stale overwrite';end if;
 if (select count(*) from public.compte_profil)<>1 then raise exception 'FAIL private read isolation';end if;
 begin perform public.compte_profil_enregistrer(2,'{"prenom":"Intrusion"}',current_setting('requete.test_user_b')::uuid);raise exception 'FAIL expected account mismatch';exception when insufficient_privilege then null;end;
 for bad in select value from jsonb_array_elements(jsonb_build_array(
  '{"user_id":"other"}'::jsonb,'{"email":"private@example.test"}'::jsonb,'{"objectif":"unknown"}'::jsonb,
  '{"fuseau_horaire":"Mars/Paris"}'::jsonb,'{"fuseau_horaire":null}'::jsonb,'{}'::jsonb,
  jsonb_build_object('prenom',repeat('x',81)),jsonb_build_object('prenom',E'Elisa\nSQL')
 )) loop
  begin perform public.compte_profil_enregistrer(2,bad,u);raise exception 'FAIL invalid field';exception when invalid_parameter_value then null;end;
 end loop;
 begin update public.compte_profil set prenom='Direct';raise exception 'FAIL direct write bypass';exception when insufficient_privilege then null;end;
 begin update public.compte_profil set revision=100;raise exception 'FAIL forged revision';exception when insufficient_privilege then null;end;
 begin update public.compte_profil set cree_le='2000-01-01';raise exception 'FAIL forged timestamp';exception when insufficient_privilege then null;end;
 begin insert into public.compte_profil(user_id,prenom) values(current_setting('requete.test_user_b')::uuid,'Intrusion');raise exception 'FAIL insert another account';exception when insufficient_privilege then null;end;
 begin delete from public.compte_profil;raise exception 'FAIL direct delete';exception when insufficient_privilege then null;end;
end; $$;
-- An anonymous Auth session also uses the authenticated Postgres role.
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.test_user_a'),'role','authenticated','is_anonymous',true)::text,true);
do $$ begin
 if exists(select 1 from public.compte_profil) then raise exception 'FAIL guest read';end if;
 begin perform public.compte_profil_lire();raise exception 'FAIL guest RPC';exception when insufficient_privilege then null;end;
end; $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 begin perform * from public.compte_profil;raise exception 'FAIL anon read';exception when insufficient_privilege then null;end;
 begin perform public.compte_profil_lire();raise exception 'FAIL anon RPC';exception when insufficient_privilege then null;end;
end; $$;
reset role;
delete from auth.users where id=current_setting('requete.test_user_a')::uuid;
do $$ begin
 if exists(select 1 from public.compte_profil where user_id=current_setting('requete.test_user_a')::uuid) then raise exception 'FAIL deletion cascade';end if;
 if not exists(select 1 from public.compte_profil where user_id=current_setting('requete.test_user_b')::uuid and prenom='Autre') then raise exception 'FAIL other profile changed';end if;
end; $$;
select 'PASS: profil privé, champs, versions concurrentes, comptes, anonymes et suppression' as resultat;
rollback;
