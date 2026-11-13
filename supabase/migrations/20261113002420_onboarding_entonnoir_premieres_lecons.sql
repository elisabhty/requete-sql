-- « Prolonger l’entonnoir après l’onboarding » (Elisa, 13 novembre, 1 h 18) : il s’arrêtait à « Onboarding terminé ». Il continue
-- avec la première leçon commencée, la première et la deuxième leçon terminées, pour voir si l’on apprend une fois entré ; puis
-- les demandes de note faites à iOS (la demande seulement : iOS ne dit ni si la fenêtre est apparue, ni si une note a été donnée).
-- L’appli envoie ces étapes par onboarding_compter, comme les autres, si les statistiques anonymes sont activées. Seule la vue change.
-- Appliquée le 13 novembre à 1 h 24, à la demande d’Elisa.
create or replace view public.onboarding_entonnoir with (security_invoker = true) as
with ordre (etape, rang, nom) as (values
  ('welcome', 1, 'Accueil'), ('name', 2, 'Prénom'), ('pays', 3, 'Pays'), ('age', 4, 'Âge'), ('job', 5, 'Situation'),
  ('goal', 6, 'Objectif'), ('level', 7, 'Niveau'), ('rhythm', 8, 'Rythme'), ('jours', 9, 'Jours par semaine'),
  ('build', 10, 'Parcours construit'), ('methode', 11, 'Méthode fondée sur la recherche'), ('temoignages', 12, 'Ils apprécient Requête'),
  ('pact', 13, 'Engagement'), ('practice', 14, 'Première requête'), ('account', 15, 'Connexion'),
  ('source', 16, 'Comment as-tu connu Requête'), ('rappel', 17, 'Rappel'), ('ready', 18, 'Parcours prêt'), ('termine', 19, 'Onboarding terminé'),
  ('leconDebut', 20, '1re leçon commencée'), ('leconUne', 21, '1re leçon terminée'), ('leconDeux', 22, '2e leçon terminée'),
  ('note', 23, 'Note demandée à iOS (1re fois)'), ('noteDeux', 24, 'Note demandée à iOS (2e fois)')
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
