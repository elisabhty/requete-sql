-- Elisa, 14 novembre, 13 h 11 (« Vas-y ») : « Connecte-toi pour retrouver… sur tous tes appareils » devient vrai pour le jeu aussi.
-- Le pseudo, les points du classement et les parties suivent le compte d’un iPhone à l’autre.
--
-- 1. Le joueur du compte (compte_joueur) : la clé de joueur de l’appareil où le compte s’est connecté la première fois. Tout le jeu
--    (pseudo réservé, points, salles) tient à cette clé ; un autre appareil qui se connecte au même compte la reprend, et avec elle
--    le pseudo et les points. La clé n’est rendue qu’au propriétaire du compte connecté. Une clé n’appartient qu’à un compte.
-- 2. Les parties du compte (compte_stats) : « Mes stats » additionne ce que chaque appareil a joué (sa part, sans double compte) et
--    garde les 500 dernières parties de tous les appareils.
-- La suppression du compte efface les deux (cascade) ; « Tout effacer » vide les parties du compte (compte_stats_effacer).
-- Indépendant du multijoueur lié au compte préparé le 2 novembre (compte_jeu, inactif) : jeu_cle ne change pas.

create table if not exists requete_private.compte_joueur (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cle text not null unique check (cle ~ '^[A-Za-z0-9]{24,64}$'),
  lie_le timestamptz not null default now()
);
alter table requete_private.compte_joueur enable row level security;
revoke all on table requete_private.compte_joueur from public, anon, authenticated;

create table if not exists requete_private.compte_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  appareils jsonb not null default '{}'::jsonb check (jsonb_typeof(appareils) = 'object'),
  hist jsonb not null default '[]'::jsonb check (jsonb_typeof(hist) = 'array'),
  maj timestamptz not null default now()
);
alter table requete_private.compte_stats enable row level security;
revoke all on table requete_private.compte_stats from public, anon, authenticated;

-- Le joueur du compte : celui déjà lié, sinon la clé de cet appareil (si aucun autre compte ne l’a).
create or replace function public.compte_joueur_lier(p_cle text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cle text;
begin
  if v_uid is null or coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' then
    raise exception 'compte requis' using errcode = '42501';
  end if;
  select cle into v_cle from requete_private.compte_joueur where user_id = v_uid;
  if v_cle is not null then
    return jsonb_build_object('ok', true, 'cle', v_cle, 'nouveau', false);
  end if;
  if p_cle is null or p_cle !~ '^[A-Za-z0-9]{24,64}$' then
    raise exception 'clé invalide' using errcode = '22023';
  end if;
  insert into requete_private.compte_joueur (user_id, cle) values (v_uid, p_cle) on conflict do nothing;
  select cle into v_cle from requete_private.compte_joueur where user_id = v_uid;
  if v_cle is null then
    -- cette clé est déjà le joueur d’un autre compte : l’appareil en prendra une neuve pour celui-ci
    return jsonb_build_object('ok', true, 'cle', null, 'autre', true);
  end if;
  return jsonb_build_object('ok', true, 'cle', v_cle, 'nouveau', v_cle = p_cle);
end;
$$;
revoke all on function public.compte_joueur_lier(text) from public, anon, authenticated;
grant execute on function public.compte_joueur_lier(text) to authenticated;

-- Les parties du compte : la part de cet appareil (remplacée), ses dernières parties (ajoutées) ; rend le tout.
create or replace function public.compte_stats_garder(p_appareil text, p_part jsonb, p_hist jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_app jsonb;
  v_hist jsonb;
begin
  if v_uid is null or coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' then
    raise exception 'compte requis' using errcode = '42501';
  end if;
  if p_appareil is null or p_appareil !~ '^[A-Za-z0-9]{8,40}$'
     or p_part is null or jsonb_typeof(p_part) <> 'object' or octet_length(p_part::text) > 65536
     or p_hist is null or jsonb_typeof(p_hist) <> 'array' or jsonb_array_length(p_hist) > 500 or octet_length(p_hist::text) > 700000 then
    raise exception 'données invalides' using errcode = '22023';
  end if;
  insert into requete_private.compte_stats (user_id) values (v_uid) on conflict do nothing;
  select appareils || jsonb_build_object(p_appareil, p_part || jsonb_build_object('maj', extract(epoch from clock_timestamp())::bigint)),
         hist || p_hist
    into v_app, v_hist
    from requete_private.compte_stats where user_id = v_uid for update;
  -- douze appareils au plus : les plus anciens sortent
  if (select count(*) from jsonb_object_keys(v_app)) > 12 then
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_app
      from (select k, v from jsonb_each(v_app) as e(k, v)
            order by coalesce((v->>'maj')::bigint, 0) desc limit 12) x;
  end if;
  -- les 500 dernières parties, chacune une fois (son heure, à la milliseconde)
  with tous as (
    select h, (h->>'at')::bigint as at from jsonb_array_elements(v_hist) h
    where jsonb_typeof(h) = 'object' and coalesce(h->>'at', '') ~ '^[0-9]{10,14}$'
  ), uniques as (
    select distinct on (at) h, at from tous order by at
  ), garde as (
    select h, at from uniques order by at desc limit 500
  )
  select coalesce(jsonb_agg(h order by at desc), '[]'::jsonb) into v_hist from garde;
  update requete_private.compte_stats set appareils = v_app, hist = v_hist, maj = now() where user_id = v_uid;
  return jsonb_build_object('ok', true, 'appareils', v_app, 'hist', v_hist);
end;
$$;
revoke all on function public.compte_stats_garder(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.compte_stats_garder(text, jsonb, jsonb) to authenticated;

-- « Tout effacer » avec un compte connecté : ses parties aussi
create or replace function public.compte_stats_effacer()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' then
    raise exception 'compte requis' using errcode = '42501';
  end if;
  delete from requete_private.compte_stats where user_id = v_uid;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.compte_stats_effacer() from public, anon, authenticated;
grant execute on function public.compte_stats_effacer() to authenticated;
