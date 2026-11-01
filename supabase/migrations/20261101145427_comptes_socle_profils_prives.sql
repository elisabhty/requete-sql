-- Foundation only: the app does not call Supabase Auth yet.
-- Credentials and providers belong to Supabase Auth, never to this table.
create table public.compte_profil (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  prenom text not null default '' check (char_length(prenom) <= 80 and prenom = btrim(prenom)),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
comment on table public.compte_profil is
  'Profils privés des futurs comptes Supabase Auth. Non raccordés à l’application ; aucune reprise automatique des données locales.';
alter table public.compte_profil enable row level security;
revoke all on table public.compte_profil from public, anon, authenticated;
grant select on table public.compte_profil to authenticated;
grant insert (user_id, prenom) on table public.compte_profil to authenticated;
grant update (prenom) on table public.compte_profil to authenticated;
grant all on table public.compte_profil to service_role;

create policy compte_profil_lire on public.compte_profil for select to authenticated
using ((select auth.uid()) = user_id);
create policy compte_profil_creer on public.compte_profil for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy compte_profil_modifier on public.compte_profil for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create function requete_private.compte_profil_dates()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.modifie_le := clock_timestamp();
  return new;
end;
$$;
revoke all on function requete_private.compte_profil_dates() from public, anon, authenticated;
create trigger compte_profil_dates before update on public.compte_profil
for each row execute function requete_private.compte_profil_dates();

-- No trigger on auth.users: future signup is independent from profile initialization.
-- No email/password duplication, no client access to device secrets or scores.
