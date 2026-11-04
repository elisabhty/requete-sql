-- « Savoir où les gens abandonnent » (Elisa, 4 novembre, 13 h 48 : « ok » pour la proposition 4).
--
-- Chaque étape de l’onboarding vue une première fois, une fois par appareil : l’empreinte de sa clé (jeu_cle, comme les votes et
-- les avis), l’étape et la date ; ni nom, ni e-mail, ni réponse. L’appli n’écrit que par onboarding_compter ; la table n’a aucun droit
-- direct pour anon et authenticated. Au plus 20 000 étapes par heure pour tout le monde, pour qu’on ne puisse pas la remplir.
-- L’entonnoir se lit dans le tableau de bord : vue onboarding_entonnoir (combien d’appareils ont vu chaque étape, dans l’ordre du
-- parcours, et la part de ceux qui ont vu l’accueil).
create table if not exists public.onboarding_etape (
  cle text not null,
  etape text not null check (etape ~ '^[a-zA-Z]{2,16}$'),
  vue_le timestamptz not null default now(),
  primary key (cle, etape)
);
create index if not exists onboarding_etape_vue_le on public.onboarding_etape (vue_le);
comment on table public.onboarding_etape is
  'Étapes de l’onboarding vues, une fois par appareil (empreinte de sa clé). Résultats : vue onboarding_entonnoir.';
alter table public.onboarding_etape enable row level security;
revoke all on public.onboarding_etape from public, anon, authenticated;

create or replace function public.onboarding_compter(p_cle text, p_etapes text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_etapes text[];
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  if cardinality(coalesce(p_etapes, '{}'::text[])) > 30 then
    return jsonb_build_object('ok', false, 'raison', 'invalide');
  end if;
  select array_agg(distinct e) into v_etapes from unnest(coalesce(p_etapes, '{}'::text[])) as e where e ~ '^[a-zA-Z]{2,16}$';
  if v_etapes is null then return jsonb_build_object('ok', true, 'n', 0); end if;
  if (select count(*) from public.onboarding_etape where vue_le > now() - interval '1 hour') >= 20000 then
    return jsonb_build_object('ok', false, 'raison', 'trop');
  end if;
  insert into public.onboarding_etape (cle, etape)
  select v_cle, e from unnest(v_etapes) as e
  on conflict (cle, etape) do nothing;
  return jsonb_build_object('ok', true, 'n', cardinality(v_etapes));
end;
$$;
revoke all on function public.onboarding_compter(text, text[]) from public, anon, authenticated;
grant execute on function public.onboarding_compter(text, text[]) to anon, authenticated;

-- Pour le tableau de bord : les étapes dans l’ordre du parcours, le nombre d’appareils qui les ont vues, et la part de l’accueil.
create or replace view public.onboarding_entonnoir with (security_invoker = true) as
with ordre (etape, rang, nom) as (values
  ('welcome', 1, 'Accueil'), ('name', 2, 'Prénom'), ('pays', 3, 'Pays'), ('age', 4, 'Âge'), ('job', 5, 'Situation'),
  ('goal', 6, 'Objectif'), ('level', 7, 'Niveau'), ('rhythm', 8, 'Rythme'), ('jours', 9, 'Jours par semaine'),
  ('build', 10, 'Parcours construit'), ('promise', 11, 'Promesse'), ('pact', 12, 'Engagement'), ('practice', 13, 'Première requête'),
  ('account', 14, 'Connexion'), ('source', 15, 'Comment as-tu connu Requête'), ('rappel', 16, 'Rappel'), ('ready', 17, 'Parcours prêt'),
  ('termine', 18, 'Onboarding terminé')
),
compte as (select etape, count(*) as appareils from public.onboarding_etape group by etape),
accueil as (select count(*) as n from public.onboarding_etape where etape = 'welcome')
select
  o.rang,
  o.nom as etape,
  coalesce(c.appareils, 0) as appareils,
  case when a.n > 0 then round(100.0 * coalesce(c.appareils, 0) / a.n, 1) end as "% de l’accueil"
from ordre o
left join compte c using (etape)
cross join accueil a
order by o.rang;
revoke all on public.onboarding_entonnoir from public, anon, authenticated;
