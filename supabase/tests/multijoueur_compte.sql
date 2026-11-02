-- Rollback all fixtures and activation flag. No real account or game is modified.
begin;
select set_config('requete.multi_a',gen_random_uuid()::text,true);
select set_config('requete.multi_b',gen_random_uuid()::text,true);
select set_config('requete.multi_key',encode(extensions.gen_random_bytes(24),'hex'),true);
select set_config('requete.multi_guest',encode(extensions.gen_random_bytes(24),'hex'),true);
select set_config('requete.multi_room',upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),true);
select set_config('requete.multi_challenge',(select id from requete_private.catalogue where niv='f' limit 1),true);
insert into auth.users(id) values(current_setting('requete.multi_a')::uuid),(current_setting('requete.multi_b')::uuid);
-- Reserve an existing guest pseudo and server-stored historical score.
select public.jeu_pseudo_prendre(current_setting('requete.multi_key'),'Sql'||substr(current_setting('requete.multi_a'),1,10));
insert into public.jeu_joueur(cle,pseudo,pts,parties) select public.jeu_cle(current_setting('requete.multi_key')),pseudo,100,1 from public.jeu_pseudo where cle=public.jeu_cle(current_setting('requete.multi_key'));
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.multi_a'),'role','authenticated')::text,true);
do $$ begin
 begin perform public.jeu_compte_identite();raise exception 'FAIL enabled by default';exception when object_not_in_prerequisite_state then null;end;
end; $$;
reset role;
update requete_private.compte_jeu_config set active=true;
set local role authenticated;
do $$
declare r jsonb; r2 jsonb; code text:=current_setting('requete.multi_room');
begin
 r:=public.jeu_compte_lier(current_setting('requete.multi_key'),'LIER');
 if r->>'linked'<>'true' or r?'secret' or r?'cle' or r?'user_id' then raise exception 'FAIL identity or secret exposed'; end if;
 r2:=public.jeu_compte_lier(current_setting('requete.multi_key'),'LIER');
 if r2->>'pid'<>r->>'pid' then raise exception 'FAIL link not idempotent'; end if;
 r2:=public.jeu_compte_creer('SqlSecond');
 if r2->>'pid'<>r->>'pid' then raise exception 'FAIL second identity per account'; end if;
 r2:=public.jeu_compte_classement();
 if r2#>>'{moi,pts}'<>'100' then raise exception 'FAIL historical score lost'; end if;
 begin
  perform public.jeu_compte_lier(current_setting('requete.multi_key'),'oui');raise exception 'FAIL missing confirmation';
 exception when invalid_parameter_value then null;end;
 perform public.jeu_compte_envoyer(code,jsonb_build_object('t','cfg','pid','forged','name','other','u','accountTestCfg','g',0,'n',1,'niv','f','solo',true));
 perform public.jeu_compte_envoyer(code,jsonb_build_object('t','round','u','accountTestRound','g',0,'n',0,'cid',current_setting('requete.multi_challenge')));
 begin perform public.jeu_valider_v2(gen_random_uuid(),true);raise exception 'FAIL client can validate';exception when insufficient_privilege then null;end;
end; $$;
reset role;
-- Advance the test round only, keeping the real server clock and score formula.
update requete_private.manche set debut=clock_timestamp()-interval '10 seconds' where code=current_setting('requete.multi_room');
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.jeu_compte_essai(current_setting('requete.multi_room'),0,0,gen_random_uuid(),'SELECT 1');
 perform set_config('requete.multi_attempt',r->>'id',true);
 if r->>'defi'<>current_setting('requete.multi_challenge') then raise exception 'FAIL assigned challenge'; end if;
end; $$;
reset role;
-- Simulate the trusted verifier result, not a client-supplied verdict.
select public.jeu_valider_v2(current_setting('requete.multi_attempt')::uuid,true);
set local role authenticated;
do $$ declare a jsonb; b jsonb; begin
 a:=public.jeu_compte_score(current_setting('requete.multi_room'),0);
 b:=public.jeu_compte_score(current_setting('requete.multi_room'),0);
 if (a->>'pts')::integer<=100 or a->>'pts'<>b->>'pts' or a->>'parties'<>b->>'parties' then raise exception 'FAIL score or duplicate receipt'; end if;
 if (select count(*) from public.jeu_compte_historique(current_setting('requete.multi_room'),0) where m->>'name'='other' or m->>'pid'='forged')<>0 then raise exception 'FAIL forged identity'; end if;
 perform public.jeu_compte_envoyer(current_setting('requete.multi_room'),jsonb_build_object('t','ping','u','secondDevicePing'));
end; $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.multi_b'),'role','authenticated')::text,true);
do $$ declare r jsonb; begin
 begin perform public.jeu_compte_lier(current_setting('requete.multi_key'),'LIER');raise exception 'FAIL theft';exception when insufficient_privilege then null;end;
 r:=public.jeu_compte_creer('Sql'||substr(current_setting('requete.multi_a'),1,10));
 if r->>'ok'<>'false' then raise exception 'FAIL pseudo collision'; end if;
 r:=public.jeu_compte_creer('Sql'||substr(current_setting('requete.multi_b'),1,10));
 if r->>'linked'<>'true' then raise exception 'FAIL new identity'; end if;
 begin perform * from public.jeu_compte_historique(current_setting('requete.multi_room'),0);raise exception 'FAIL room history leak';exception when insufficient_privilege then null;end;
 begin perform public.jeu_compte_score(current_setting('requete.multi_room'),0);raise exception 'FAIL other score';exception when insufficient_privilege then null;end;
 begin perform * from requete_private.compte_jeu;raise exception 'FAIL secret read';exception when insufficient_privilege then null;end;
end; $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('requete.multi_b'),'role','authenticated','is_anonymous',true)::text,true);
do $$ begin
 begin perform public.jeu_compte_identite();raise exception 'FAIL Supabase guest account';exception when insufficient_privilege then null;end;
end; $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 begin perform public.jeu_identite_v2(current_setting('requete.multi_key'));raise exception 'FAIL raw key bypass';exception when insufficient_privilege then null;end;
 begin perform public.jeu_compte_identite();raise exception 'FAIL anonymous account RPC';exception when insufficient_privilege then null;end;
 if public.jeu_pseudo_prendre(current_setting('requete.multi_guest'),'SqlGuest'||substr(current_setting('requete.multi_b'),1,7))->>'ok'<>'true' then raise exception 'FAIL guest compatibility';end if;
 perform public.jeu_identite_v2(current_setting('requete.multi_guest'));
end; $$;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$ begin
 begin perform public.jeu_essai_v2(current_setting('requete.multi_key'),current_setting('requete.multi_room'),0,0,gen_random_uuid(),'SELECT 1');raise exception 'FAIL old Edge bypass';exception when insufficient_privilege then null;end;
end; $$;
reset role;
select set_config('request.jwt.claims','{}',true);
delete from auth.users where id=current_setting('requete.multi_a')::uuid;
do $$ declare k text:=encode(extensions.digest(current_setting('requete.multi_key'),'sha256'),'hex');begin
 if exists(select 1 from requete_private.compte_jeu where user_id=current_setting('requete.multi_a')::uuid)
  or exists(select 1 from public.jeu_pseudo where cle=k)
  or exists(select 1 from public.jeu_joueur where cle=k)
  or exists(select 1 from requete_private.membre where pid=left(k,24))
  or exists(select 1 from requete_private.essai where pid=left(k,24))
  or exists(select 1 from public.jeu_msg where m->>'pid'=left(k,24)) then raise exception 'FAIL account erasure';end if;
 if not exists(select 1 from requete_private.compte_jeu where user_id=current_setting('requete.multi_b')::uuid) then raise exception 'FAIL other account erased';end if;
 begin perform public.jeu_pseudo_prendre(current_setting('requete.multi_key'),'SqlReturn');raise exception 'FAIL deleted key reuse';exception when insufficient_privilege then null;end;
end; $$;
select 'PASS: activation, liaison, identité, salles, scores vérifiés, doublons, ancien protocole et suppression' as resultat;
rollback;
