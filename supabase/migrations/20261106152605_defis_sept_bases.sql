-- Elisa, 6 novembre, 16 h (« Tout mettre en ligne ») : les sept nouvelles bases de défis (station de ski, food truck, aquarium,
-- vélos en libre-service, ferme apicole, escape game, festival de musique), 30 défis chacune, 10 par niveau : 210 défis, nommés
-- comme dans l’appli (préfixe de la base, niveau, numéro : kf1 … gd10). Ils entrent au catalogue du serveur avec la version 2
-- (catalogue.depuis, voir defis_deja_joues) : le serveur ne les tire que dans une salle où tous les téléphones ont l’appli qui les
-- connaît (cat 2). Appliquée après le déploiement de jeu-verifier avec le catalogue des 477 défis.
insert into requete_private.catalogue (id, niv, depuis)
select b.p || n.n || i.i, n.n, 2
from unnest(array['k', 't', 'q', 'b', 'r', 'e', 'g']) as b (p)
cross join unnest(array['f', 'm', 'd']) as n (n)
cross join generate_series(1, 10) as i (i)
on conflict (id) do update set niv = excluded.niv, depuis = excluded.depuis;

do $$
begin
  if (select count(*) from requete_private.catalogue where depuis = 2) <> 210 then raise exception 'il faut 210 défis en version 2'; end if;
  if (select count(*) from requete_private.catalogue) <> 477 then raise exception 'il faut 477 défis au catalogue'; end if;
end $$;
