-- « Quel parcours aimerais-tu découvrir ensuite ? » : le badge « En tête » (Elisa, 11 novembre, 15 h 15, sur sa maquette de la
-- page Python ; puis, au choix : « Vrais votes »).
--
-- L’appli ne lit toujours pas les votes : cette fonction, en lecture seule, ne renvoie que le parcours en tête, sans aucun chiffre,
-- et seulement à partir de 10 votes et sans égalité (sinon : null). Rien sur les appareils ni sur les dates.
create or replace function public.parcours_en_tete()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select v.parcours, count(*) as n from public.parcours_vote v group by v.parcours
  ), t as (
    select coalesce(sum(n), 0) as total, coalesce(max(n), 0) as tete from c
  )
  select jsonb_build_object('parcours',
    case when t.total >= 10 and (select count(*) from c where c.n = t.tete) = 1
      then (select c.parcours from c where c.n = t.tete)
      else null end)
  from t;
$$;
comment on function public.parcours_en_tete() is
  'Le parcours en tête des votes « Quel parcours après SQL ? » (sans chiffres), à partir de 10 votes et sans égalité ; sinon null.';
revoke all on function public.parcours_en_tete() from public, anon, authenticated;
grant execute on function public.parcours_en_tete() to anon, authenticated;
