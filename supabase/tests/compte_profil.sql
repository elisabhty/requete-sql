-- Run in Supabase SQL Editor (owner). Every fixture is rolled back.
-- No email, password, external request or permanent test account is created.
begin;
select set_config('requete.test_user_a', gen_random_uuid()::text, true);
select set_config('requete.test_user_b', gen_random_uuid()::text, true);
insert into auth.users (id) values
  (current_setting('requete.test_user_a')::uuid),
  (current_setting('requete.test_user_b')::uuid);
insert into public.compte_profil (user_id, prenom)
values (current_setting('requete.test_user_b')::uuid, 'Autre');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('requete.test_user_a'), 'role', 'authenticated'
)::text, true);
insert into public.compte_profil (prenom) values ('Elisa');
do $$
declare n integer;
begin
  select count(*) into n from public.compte_profil;
  if n <> 1 then raise exception 'FAIL: isolation en lecture'; end if;
  update public.compte_profil set prenom = 'Alice' where user_id = auth.uid();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: mise à jour du profil propre'; end if;
  if not exists (select 1 from public.compte_profil where prenom = 'Alice' and modifie_le >= cree_le)
    then raise exception 'FAIL: dates de mise à jour'; end if;
  update public.compte_profil set prenom = 'Intrusion'
  where user_id = current_setting('requete.test_user_b')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: modification du profil voisin'; end if;
  begin
    insert into public.compte_profil (user_id, prenom)
    values (current_setting('requete.test_user_b')::uuid, 'Intrusion');
    raise exception 'FAIL: création pour autrui autorisée';
  exception when insufficient_privilege then null; end;
  begin
    update public.compte_profil set user_id = current_setting('requete.test_user_b')::uuid;
    raise exception 'FAIL: changement de propriétaire autorisé';
  exception when insufficient_privilege then null; end;
  begin
    update public.compte_profil set cree_le = '2000-01-01';
    raise exception 'FAIL: falsification des dates autorisée';
  exception when insufficient_privilege then null; end;
  begin
    update public.compte_profil set prenom = repeat('x',81);
    raise exception 'FAIL: prénom sans limite';
  exception when check_violation then null; end;
  begin
    delete from public.compte_profil;
    raise exception 'FAIL: suppression directe autorisée';
  exception when insufficient_privilege then null; end;
end $$;

set local role anon;
select set_config('request.jwt.claims', '{}', true);
do $$
begin
  begin
    perform * from public.compte_profil;
    raise exception 'FAIL: lecture anonyme autorisée';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.compte_profil (prenom) values ('Intrusion');
    raise exception 'FAIL: insertion anonyme autorisée';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
delete from auth.users where id = current_setting('requete.test_user_a')::uuid;
do $$
begin
  if exists (select 1 from public.compte_profil where user_id = current_setting('requete.test_user_a')::uuid)
    then raise exception 'FAIL: suppression en cascade'; end if;
end $$;
select 'PASS: propriétaire, isolation, droits de colonnes, contraintes, accès anonyme et suppression en cascade' as resultat;
rollback;
