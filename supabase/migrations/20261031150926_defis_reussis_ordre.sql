-- La liste des défis d’un joueur dans l’ordre de l’appli (c1, c2… c10, pas c1, c10, c2).
create or replace view public.stats_defis_joueurs with (security_invoker = true) as
  select j.pseudo,
    coalesce(cardinality(j.defis), 0) as defis_reussis,
    (select coalesce(sum((e.v->>1)::integer), 0) from jsonb_each(j.defis_niv) as e(k, v)) as defis_dans_l_appli,
    (j.defis_niv->'f'->>0) || '/' || (j.defis_niv->'f'->>1) as faciles,
    (j.defis_niv->'m'->>0) || '/' || (j.defis_niv->'m'->>1) as moyens,
    (j.defis_niv->'d'->>0) || '/' || (j.defis_niv->'d'->>1) as difficiles,
    j.parties,
    j.pts as points,
    j.defis_maj as mis_a_jour,
    j.cree as premiere_partie,
    array(select u.x from unnest(j.defis) as u(x) order by length(u.x), u.x) as defis
  from public.jeu_joueur j
  where j.defis_maj is not null
  order by 2 desc, j.defis_maj desc;
revoke all on public.stats_defis_joueurs from anon, authenticated;
