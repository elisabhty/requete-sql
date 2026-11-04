-- « Fusionner sur une page » (Elisa, 4 novembre, 17 h 27, réf. 8 et 9) : la page « 24 jours » (promise) rejoint celle des jours ; elle
-- n’est plus une étape de l’onboarding. L’entonnoir ne la montre plus (sinon, elle paraîtrait se vider entre la construction du
-- parcours et les avis) ; les étapes déjà comptées restent dans la table. Appliquée le 4 novembre à 18 h 30, avec l’accord d’Elisa (« oui »).
create or replace view public.onboarding_entonnoir with (security_invoker = true) as
with ordre (etape, rang, nom) as (values
  ('welcome', 1, 'Accueil'), ('name', 2, 'Prénom'), ('pays', 3, 'Pays'), ('age', 4, 'Âge'), ('job', 5, 'Situation'),
  ('goal', 6, 'Objectif'), ('level', 7, 'Niveau'), ('rhythm', 8, 'Rythme'), ('jours', 9, 'Jours par semaine'),
  ('build', 10, 'Parcours construit'), ('temoignages', 11, 'Ils apprécient Requête'), ('pact', 12, 'Engagement'),
  ('practice', 13, 'Première requête'), ('account', 14, 'Connexion'), ('source', 15, 'Comment as-tu connu Requête'), ('rappel', 16, 'Rappel'),
  ('ready', 17, 'Parcours prêt'), ('termine', 18, 'Onboarding terminé')
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
