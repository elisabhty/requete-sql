-- « Se connecter avec Apple » : le jeton de renouvellement d’Apple, gardé côté serveur pour pouvoir le révoquer quand la personne
-- supprime son compte (Elisa, 12 novembre, 1 h 33 ; Apple, règle 5.1.1(v)). La fonction apple-jeton seule y touche (service_role) ;
-- la ligne part avec le compte (on delete cascade).
create table if not exists requete_private.apple_jeton (
  user_id uuid primary key references auth.users(id) on delete cascade,
  jeton text not null check (char_length(jeton) between 1 and 2048),
  maj timestamptz not null default now()
);
alter table requete_private.apple_jeton enable row level security;
revoke all on requete_private.apple_jeton from public, anon, authenticated;
comment on table requete_private.apple_jeton is 'Jeton de renouvellement Sign in with Apple, pour la révocation à la suppression du compte (fonction apple-jeton).';

create or replace function public.apple_jeton_garder(p_user uuid, p_jeton text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_jeton is null or char_length(p_jeton) not between 1 and 2048 then
    raise exception 'demande invalide' using errcode = '22023';
  end if;
  insert into requete_private.apple_jeton (user_id, jeton) values (p_user, p_jeton)
  on conflict (user_id) do update set jeton = excluded.jeton, maj = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apple_jeton_prendre(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  delete from requete_private.apple_jeton where user_id = p_user returning jeton into v;
  return v;
end $$;

revoke all on function public.apple_jeton_garder(uuid, text) from public, anon, authenticated;
revoke all on function public.apple_jeton_prendre(uuid) from public, anon, authenticated;
grant execute on function public.apple_jeton_garder(uuid, text) to service_role;
grant execute on function public.apple_jeton_prendre(uuid) to service_role;
