-- « Une méthode fondée sur la recherche » (Elisa, 13 novembre, 0 h 07) : la scène de la vidéo est devenue une page de l’onboarding,
-- `methode`, entre le parcours construit et les avis. L’entonnoir la montre à sa place ; les rangs suivants se décalent d’un cran
-- (19 étapes). Seule la vue change : les étapes déjà comptées restent dans la table.
-- Appliquée le 13 novembre à 1 h 13, avec l’accord d’Elisa (« oui »).
create or replace view public.onboarding_entonnoir with (security_invoker = true) as
with ordre (etape, rang, nom) as (values
  ('welcome', 1, 'Accueil'), ('name', 2, 'Prénom'), ('pays', 3, 'Pays'), ('age', 4, 'Âge'), ('job', 5, 'Situation'),
  ('goal', 6, 'Objectif'), ('level', 7, 'Niveau'), ('rhythm', 8, 'Rythme'), ('jours', 9, 'Jours par semaine'),
  ('build', 10, 'Parcours construit'), ('methode', 11, 'Méthode fondée sur la recherche'), ('temoignages', 12, 'Ils apprécient Requête'),
  ('pact', 13, 'Engagement'), ('practice', 14, 'Première requête'), ('account', 15, 'Connexion'),
  ('source', 16, 'Comment as-tu connu Requête'), ('rappel', 17, 'Rappel'), ('ready', 18, 'Parcours prêt'), ('termine', 19, 'Onboarding terminé')
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
