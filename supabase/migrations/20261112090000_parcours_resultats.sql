-- « Quel parcours aimerais-tu découvrir ensuite ? » : les résultats (Elisa, 12 novembre, réf. 15 : « on voit pas les résultats ? »).
--
-- En lecture seule : la part de chaque parcours, en pour cent arrondi, sans aucun nombre de votes, et seulement à partir du seuil
-- (sinon parts vaut null, et l’appli dit dès combien de votes ils s’afficheront). Rien sur les appareils ni sur les dates.
create or replace function public.parcours_resultats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select v.parcours, count(*) as n from public.parcours_vote v group by v.parcours
  ), t as (
    select coalesce(sum(n), 0) as total from c
  )
  select jsonb_build_object('seuil', 10, 'parts',
    case when t.total >= 10 then (
      select jsonb_object_agg(p.id, round(100.0 * coalesce(c.n, 0) / t.total))
      from (values ('python'), ('excel'), ('powerbi')) as p(id) left join c on c.parcours = p.id)
    else null end)
  from t;
$$;
comment on function public.parcours_resultats() is
  'Résultats du vote « Quel parcours après SQL ? » : la part de chaque parcours en pour cent (sans nombre de votes), à partir de 10 votes ; sinon parts à null.';
revoke all on function public.parcours_resultats() from public, anon, authenticated;
grant execute on function public.parcours_resultats() to anon, authenticated;
