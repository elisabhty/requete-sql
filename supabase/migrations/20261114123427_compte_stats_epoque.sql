-- 14 novembre, 13 h 11 (suite ; 13 h 34 : « Oui vas-y ») : « Tout effacer » sur un appareil efface les parties du compte partout. Une époque compte les
-- effacements ; un appareil qui envoie sa part avec une époque dépassée ne la remet pas : on lui répond « effacé », il vide ses
-- parties, puis renvoie sa part (vide) avec la nouvelle époque. Un appareil qui n’a jamais envoyé (p_epoque nul) ajoute la sienne.
alter table requete_private.compte_stats add column if not exists epoque integer not null default 0;

drop function if exists public.compte_stats_garder(text, jsonb, jsonb);
create or replace function public.compte_stats_garder(p_appareil text, p_part jsonb, p_hist jsonb, p_epoque integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_app jsonb;
  v_hist jsonb;
  v_ep integer;
begin
  if v_uid is null or coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' then
    raise exception 'compte requis' using errcode = '42501';
  end if;
  if p_appareil is null or p_appareil !~ '^[A-Za-z0-9]{8,40}$'
     or p_part is null or jsonb_typeof(p_part) <> 'object' or octet_length(p_part::text) > 65536
     or p_hist is null or jsonb_typeof(p_hist) <> 'array' or jsonb_array_length(p_hist) > 500 or octet_length(p_hist::text) > 700000
     or (p_epoque is not null and p_epoque < 0) then
    raise exception 'données invalides' using errcode = '22023';
  end if;
  insert into requete_private.compte_stats (user_id) values (v_uid) on conflict do nothing;
  select epoque into v_ep from requete_private.compte_stats where user_id = v_uid for update;
  if p_epoque is not null and p_epoque < v_ep then
    return jsonb_build_object('ok', true, 'efface', true, 'epoque', v_ep);
  end if;
  select appareils || jsonb_build_object(p_appareil, p_part || jsonb_build_object('maj', extract(epoch from clock_timestamp())::bigint)),
         hist || p_hist
    into v_app, v_hist
    from requete_private.compte_stats where user_id = v_uid;
  if (select count(*) from jsonb_object_keys(v_app)) > 12 then
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_app
      from (select k, v from jsonb_each(v_app) as e(k, v)
            order by coalesce((v->>'maj')::bigint, 0) desc limit 12) x;
  end if;
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
  return jsonb_build_object('ok', true, 'appareils', v_app, 'hist', v_hist, 'epoque', v_ep);
end;
$$;
revoke all on function public.compte_stats_garder(text, jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.compte_stats_garder(text, jsonb, jsonb, integer) to authenticated;

create or replace function public.compte_stats_effacer()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_ep integer;
begin
  if v_uid is null or coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' then
    raise exception 'compte requis' using errcode = '42501';
  end if;
  insert into requete_private.compte_stats (user_id, epoque) values (v_uid, 1)
  on conflict (user_id) do update set appareils = '{}'::jsonb, hist = '[]'::jsonb, epoque = requete_private.compte_stats.epoque + 1, maj = now()
  returning epoque into v_ep;
  return jsonb_build_object('ok', true, 'epoque', v_ep);
end;
$$;
revoke all on function public.compte_stats_effacer() from public, anon, authenticated;
grant execute on function public.compte_stats_effacer() to authenticated;
