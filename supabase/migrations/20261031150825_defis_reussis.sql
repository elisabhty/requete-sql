-- Les défis réussis par joueur, pour savoir quand en ajouter (Elisa, 31 octobre, 15 h 52 : « est-ce que je pourrais voir le nombre
-- de défis réussis par user ? pour voir combien je devrais en rajouter au fil du temps »).
-- Ils suivent le classement (même identifiant tiré au hasard par l’appareil, même « Retirer mes scores du classement ») : la liste
-- des défis réussis et, par niveau, le nombre réussi sur le nombre de défis de l’appli ({"f":[3,5],"m":[5,11],"d":[1,9]}).
-- L’appli les envoie seulement quand ils changent (jeu_defis), et seulement pour un joueur déjà au classement (une partie jouée).
-- Rien n’est lisible depuis l’appli : trois vues pour le tableau de bord Supabase (Table Editor ou SQL Editor) :
--   stats_defis_resume    en une ligne : combien de joueurs, la moyenne, combien ont tout fini (par niveau aussi) ;
--   stats_defis_joueurs   un joueur par ligne, du plus avancé au moins avancé ;
--   stats_defis_par_defi  chaque défi et combien de joueurs l’ont réussi.
--
-- Alerte attendue du conseiller de sécurité : « Public Can Execute SECURITY DEFINER Function » sur jeu_defis (voulu : c’est la
-- porte d’entrée, elle vérifie ce qu’elle reçoit et ne crée aucun joueur).

alter table public.jeu_joueur
  add column defis text[] not null default '{}',
  add column defis_niv jsonb,
  add column defis_maj timestamptz;

create or replace function public.jeu_defis(p_cle text, p_defis jsonb, p_niv jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_ids text[];
  v_niv jsonb := '{}'::jsonb;
  v_k text;
  v_id uuid;
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  if p_defis is null or jsonb_typeof(p_defis) <> 'array' or jsonb_array_length(p_defis) > 500 then
    raise exception 'liste invalide' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct t.x order by t.x), '{}') into v_ids
  from jsonb_array_elements_text(p_defis) as t(x)
  where t.x ~ '^[A-Za-z0-9_-]{1,24}$';
  -- Par niveau : [réussis, défis de l’appli], deux entiers entre 0 et 999.
  if p_niv is not null and jsonb_typeof(p_niv) = 'object' then
    foreach v_k in array array['f', 'm', 'd'] loop
      if jsonb_typeof(p_niv->v_k) = 'array' and jsonb_array_length(p_niv->v_k) = 2
         and jsonb_typeof(p_niv->v_k->0) = 'number' and jsonb_typeof(p_niv->v_k->1) = 'number' then
        v_niv := v_niv || jsonb_build_object(v_k, jsonb_build_array(
          least(greatest((p_niv->v_k->>0)::numeric, 0), 999)::integer,
          least(greatest((p_niv->v_k->>1)::numeric, 0), 999)::integer));
      end if;
    end loop;
  end if;
  update public.jeu_joueur
  set defis = v_ids, defis_niv = nullif(v_niv, '{}'::jsonb), defis_maj = now()
  where cle = v_cle
  returning id into v_id;
  return jsonb_build_object('ok', v_id is not null, 'n', coalesce(cardinality(v_ids), 0));
end;
$$;

revoke all on function public.jeu_defis(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.jeu_defis(text, jsonb, jsonb) to anon, authenticated;

-- Un joueur par ligne : ses défis réussis (sur ceux de son appli), par niveau, ses parties, depuis quand il joue.
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
    j.defis
  from public.jeu_joueur j
  where j.defis_maj is not null
  order by 2 desc, j.defis_maj desc;

-- En une ligne : où en sont les joueurs. « ont_tout_fini » : il est temps d’ajouter des défis (et par niveau, lesquels).
create or replace view public.stats_defis_resume with (security_invoker = true) as
  with j as (
    select coalesce(cardinality(defis), 0) as n,
      (select coalesce(sum((e.v->>1)::integer), 0) from jsonb_each(defis_niv) as e(k, v)) as total,
      defis_niv as niv
    from public.jeu_joueur
    where defis_maj is not null
  )
  select count(*) as joueurs,
    round(avg(n), 1) as moyenne_defis_reussis,
    percentile_cont(0.5) within group (order by n::float8) as mediane,
    coalesce(max(n), 0) as record,
    max(total) as defis_dans_l_appli,
    count(*) filter (where total > 0 and n >= total) as ont_tout_fini,
    count(*) filter (where total > 0 and n >= total * 0.8) as ont_fini_80_pourcent,
    count(*) filter (where (niv->'f'->>1)::integer > 0 and (niv->'f'->>0)::integer >= (niv->'f'->>1)::integer) as ont_fini_les_faciles,
    count(*) filter (where (niv->'m'->>1)::integer > 0 and (niv->'m'->>0)::integer >= (niv->'m'->>1)::integer) as ont_fini_les_moyens,
    count(*) filter (where (niv->'d'->>1)::integer > 0 and (niv->'d'->>0)::integer >= (niv->'d'->>1)::integer) as ont_fini_les_difficiles
  from j;

-- Chaque défi (c1, c2… dans l’ordre de la liste CHALLENGES de l’appli) et combien de joueurs l’ont réussi.
create or replace view public.stats_defis_par_defi with (security_invoker = true) as
  select d.defi, count(*) as joueurs
  from public.jeu_joueur j, unnest(j.defis) as d(defi)
  where j.defis_maj is not null
  group by d.defi
  order by count(*) desc, length(d.defi), d.defi;

revoke all on public.stats_defis_joueurs, public.stats_defis_resume, public.stats_defis_par_defi from anon, authenticated;
