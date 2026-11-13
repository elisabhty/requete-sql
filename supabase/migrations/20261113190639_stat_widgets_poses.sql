-- 13 novembre, 20 h 04 (Elisa : « Oui, pour le widget, s’il te plaît ») : « widget_pose », une fois par jour, le nombre de widgets
-- posés (0 sans widget) et leur liste « genre:taille » (RequeteCheminee:systemMedium…). stat_tableau, dans « reglages » :
-- widgets_poses (appareils avec ou sans widget) et widgets_par_genre (appareils par widget et par taille).
-- Lire : select public.stat_tableau(30) -> 'reglages';
create or replace function public.stat_noter(p_cle text, p_evts jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_app text;
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  n integer;
  types constant text[] := array['installation','ouverture','flamme','serie_cassee','semaine_feu','lecon_debut','lecon_validee',
    'video_quittee','moment','module_termine','defi','partie','salle_creee','salle_rejointe','paywall_vu','offre','paywall_passe',
    'essai','achat','restaure','connexion','compte','rappel_oui','rappel_non','widget','erreur',
    'invitation','rappel_ouvert','revision','qcm','entretien','indice','salle_quittee','raccourci','duree','console','import',
    'sticker','partage','widget_pose'];
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  if p_evts is null or jsonb_typeof(p_evts) <> 'array' or jsonb_array_length(p_evts) > 40 then
    return jsonb_build_object('ok', false, 'raison', 'invalide');
  end if;
  v_app := encode(extensions.digest(v_cle || ':stat', 'sha256'), 'hex');
  if (select count(*) from requete_private.stat_evenement where appareil = v_app and cree > now() - interval '1 day') >= 1500
     or (select count(*) from requete_private.stat_evenement where cree > now() - interval '1 hour') >= 200000 then
    return jsonb_build_object('ok', false, 'raison', 'trop');
  end if;
  insert into requete_private.stat_evenement (appareil, type, jour, valeur, details)
  select v_app, e->>'t',
    case when coalesce(e->>'j', '') ~ '^\d{4}-\d{2}-\d{2}$' and (e->>'j')::date between v_jour - 3 and v_jour + 1 then (e->>'j')::date else v_jour end,
    case when jsonb_typeof(e->'v') = 'number' then greatest(-1000000, least(1000000, round((e->>'v')::numeric)))::integer end,
    case when jsonb_typeof(e->'d') = 'object' and octet_length((e->'d')::text) <= 300 then e->'d' end
  from jsonb_array_elements(p_evts) as e
  where jsonb_typeof(e) = 'object' and (e->>'t') = any(types);
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'n', n);
end; $$;
revoke all on function public.stat_noter(text, jsonb) from public;
grant execute on function public.stat_noter(text, jsonb) to anon, authenticated;

create or replace function public.stat_tableau(p_jours integer default 30)
returns jsonb language sql security definer set search_path to '' as $$
with p as (select greatest(1, least(400, coalesce(p_jours, 30))) as n, (now() at time zone 'Europe/Paris')::date as auj),
ev as (select e.* from requete_private.stat_evenement e, p where e.jour > p.auj - p.n),
jours as (select generate_series(p.auj - p.n + 1, p.auj, interval '1 day')::date as jour from p),
install as (select appareil, min(jour) as j0 from requete_private.stat_evenement where type = 'installation' group by appareil),
ouv as (select distinct appareil, jour from requete_private.stat_evenement where type = 'ouverture'),
serie as (select appareil, max(valeur) as best from ev where type = 'flamme' group by appareil)
select jsonb_build_object(
  'periode', (select n from p),
  'par_jour', (select coalesce(jsonb_agg(jsonb_build_object('jour', j.jour,
      'actifs', (select count(distinct appareil) from ev where type = 'ouverture' and jour = j.jour),
      'nouveaux', (select count(distinct appareil) from ev where type = 'installation' and jour = j.jour),
      'flammes', (select count(distinct appareil) from ev where type = 'flamme' and jour = j.jour),
      'lecons', (select count(*) from ev where type = 'lecon_validee' and jour = j.jour),
      'parties', (select count(*) from ev where type = 'partie' and jour = j.jour)) order by j.jour), '[]'::jsonb) from jours j),
  'actifs_7j', (select count(distinct appareil) from ev, p where type = 'ouverture' and jour > p.auj - 7),
  'actifs_30j', (select count(distinct appareil) from ev, p where type = 'ouverture' and jour > p.auj - 30),
  'appareils', (select count(distinct appareil) from ev),
  'retention', (select jsonb_build_object(
      'j1', jsonb_build_object('base', count(*) filter (where i.j0 <= p.auj - 1), 'revenus', count(*) filter (where i.j0 <= p.auj - 1 and exists (select 1 from ouv o where o.appareil = i.appareil and o.jour = i.j0 + 1))),
      'j7', jsonb_build_object('base', count(*) filter (where i.j0 <= p.auj - 7), 'revenus', count(*) filter (where i.j0 <= p.auj - 7 and exists (select 1 from ouv o where o.appareil = i.appareil and o.jour between i.j0 + 7 and i.j0 + 13))),
      'j30', jsonb_build_object('base', count(*) filter (where i.j0 <= p.auj - 30), 'revenus', count(*) filter (where i.j0 <= p.auj - 30 and exists (select 1 from ouv o where o.appareil = i.appareil and o.jour between i.j0 + 30 and i.j0 + 36))))
    from install i, p where i.j0 > p.auj - p.n - 36),
  'flammes', jsonb_build_object(
      'allumees', (select count(*) from ev where type = 'flamme'),
      'semaines_en_feu', (select count(*) from ev where type = 'semaine_feu'),
      'series_cassees', (select count(*) from ev where type = 'serie_cassee'),
      'serie_cassee_moyenne', (select round(avg(valeur), 1) from ev where type = 'serie_cassee'),
      'meilleures_series', (select jsonb_build_object('1', count(*) filter (where best = 1), '2-6', count(*) filter (where best between 2 and 6),
         '7-13', count(*) filter (where best between 7 and 13), '14-29', count(*) filter (where best between 14 and 29), '30+', count(*) filter (where best >= 30)) from serie)),
  'cours', jsonb_build_object(
      'commencees', (select count(*) from ev where type = 'lecon_debut'),
      'validees', (select count(*) from ev where type = 'lecon_validee'),
      'modules_termines', (select coalesce(jsonb_object_agg(valeur, c), '{}'::jsonb) from (select valeur, count(*) c from ev where type = 'module_termine' group by valeur) x),
      'abandons_video', (select coalesce(jsonb_agg(jsonb_build_object('lecon', valeur, 'n', c, 'pct_moyen', pct) order by c desc), '[]'::jsonb) from
         (select valeur, count(*) c, round(avg((details->>'pct')::numeric)) pct from ev where type = 'video_quittee' group by valeur order by c desc limit 10) x),
      'moments', (select coalesce(jsonb_agg(jsonb_build_object('lecon', valeur, 'essais', c, 'reussis', ok) order by c desc), '[]'::jsonb) from
         (select valeur, count(*) c, count(*) filter (where details->>'ok' = 'true') ok from ev where type = 'moment' group by valeur order by count(*) filter (where details->>'ok' <> 'true') desc limit 10) x)),
  'defis', jsonb_build_object(
      'solo_essais', (select count(*) from ev where type = 'defi'),
      'solo_reussis', (select count(*) from ev where type = 'defi' and valeur = 1),
      'parties_solo', (select count(*) from ev where type = 'partie' and details->>'solo' = 'true'),
      'parties_amis', (select count(*) from ev where type = 'partie' and coalesce(details->>'solo', '') <> 'true'),
      'salles_creees', (select count(*) from ev where type = 'salle_creee'),
      'salles_rejointes', (select count(*) from ev where type = 'salle_rejointe'),
      'indices', (select count(*) from ev where type = 'indice'),
      'les_plus_durs', (select coalesce(jsonb_agg(jsonb_build_object('defi', c, 'appareils', a, 'reussi_par', r, 'essais', e, 'indices', i) order by a - r desc, a desc), '[]'::jsonb) from
         (select c, count(distinct appareil) filter (where type = 'defi') a, count(distinct appareil) filter (where type = 'defi' and valeur = 1) r,
            count(*) filter (where type = 'defi') e, count(*) filter (where type = 'indice') i
          from (select details->>'c' c, appareil, type, valeur from ev where type in ('defi', 'indice') and details ? 'c') d
          group by c order by count(distinct appareil) filter (where type = 'defi') - count(distinct appareil) filter (where type = 'defi' and valeur = 1) desc,
            count(*) filter (where type = 'defi') desc limit 10) x)),
  'salles', jsonb_build_object(
      'fermees_sans_personne', (select count(*) from ev where type = 'salle_quittee' and details->>'ou' = 'attente' and details->>'hote' = 'true'
         and (case when details->>'joueurs' ~ '^\d+$' then (details->>'joueurs')::integer else 0 end) <= 1),
      'quittees_en_attente', (select count(*) from ev where type = 'salle_quittee' and details->>'ou' = 'attente'),
      'abandons_en_partie_amis', (select count(*) from ev where type = 'salle_quittee' and details->>'ou' = 'partie' and coalesce(details->>'solo', '') <> 'true'),
      'abandons_en_partie_solo', (select count(*) from ev where type = 'salle_quittee' and details->>'ou' = 'partie' and details->>'solo' = 'true'),
      'quittees_a_la_fin', (select count(*) from ev where type = 'salle_quittee' and details->>'ou' = 'fin')),
  'revisions', jsonb_build_object(
      'faites', (select count(*) from ev where type = 'revision'),
      'du_premier_coup', (select count(*) from ev where type = 'revision' and valeur = 1),
      'appareils', (select count(distinct appareil) from ev where type = 'revision'),
      'qcm_reponses', (select count(*) from ev where type = 'qcm'),
      'qcm_bonnes', (select count(*) from ev where type = 'qcm' and valeur = 1),
      'qcm_les_plus_rates', (select coalesce(jsonb_agg(jsonb_build_object('lecon', l, 'question', q, 'ratees', c) order by c desc), '[]'::jsonb) from
         (select details->>'l' l, details->>'q' q, count(*) c from ev where type = 'qcm' and valeur = 0 group by 1, 2 order by 3 desc limit 10) x),
      'entretien_reponses', (select count(*) from ev where type = 'entretien'),
      'entretien_sues', (select count(*) from ev where type = 'entretien' and valeur = 1),
      'entretien_a_revoir', (select coalesce(jsonb_agg(jsonb_build_object('question', q, 'n', c) order by c desc), '[]'::jsonb) from
         (select details->>'q' q, count(*) c from ev where type = 'entretien' and valeur = 0 group by 1 order by 2 desc limit 10) x)),
  'invitations', jsonb_build_object(
      'partagees', (select count(*) from ev where type = 'invitation' and details->>'a' = 'partagee'),
      'partagees_par', (select coalesce(jsonb_object_agg(via, c), '{}'::jsonb) from
         (select coalesce(details->>'via', '?') via, count(*) c from ev where type = 'invitation' and details->>'a' = 'partagee' group by 1) x),
      'liens_ouverts', (select count(*) from ev where type = 'invitation' and details->>'a' = 'ouverte'),
      'liens_ouverts_avant_inscription', (select count(*) from ev where type = 'invitation' and details->>'a' = 'ouverte' and details->>'nouveau' = 'true'),
      'salles_rejointes_par_lien', (select count(*) from ev where type = 'salle_rejointe' and details->>'via' = 'lien'),
      'salles_rejointes_par_code', (select count(*) from ev where type = 'salle_rejointe' and details->>'via' = 'code'),
      'arrives_avec_une_invitation', (select count(distinct appareil) from ev where type = 'salle_rejointe' and details->>'nouveau' = 'true')),
  'argent', jsonb_build_object(
      'paywall_vu', (select count(distinct appareil) from ev where type = 'paywall_vu'),
      'choix_annuel', (select count(*) from ev where type = 'offre' and details->>'o' = 'an'),
      'choix_semaine', (select count(*) from ev where type = 'offre' and details->>'o' = 'semaine'),
      'passe_sans_payer', (select count(distinct appareil) from ev where type = 'paywall_passe'),
      'essais', (select count(*) from ev where type = 'essai'),
      'achats_annuel', (select count(*) from ev where type = 'achat' and details->>'o' = 'an'),
      'achats_semaine', (select count(*) from ev where type = 'achat' and details->>'o' = 'semaine'),
      'restaurations', (select count(*) from ev where type = 'restaure'),
      'paywall_depuis', (select coalesce(jsonb_object_agg(d, c), '{}'::jsonb) from
         (select coalesce(details->>'depuis', '?') d, count(distinct appareil) c from ev where type = 'paywall_vu' group by 1) x)),
  'comptes', jsonb_build_object('crees', (select count(*) from ev where type = 'compte'), 'connexions', (select count(*) from ev where type = 'connexion')),
  'reglages', jsonb_build_object('rappel_oui', (select count(distinct appareil) from ev where type = 'rappel_oui'), 'rappel_non', (select count(distinct appareil) from ev where type = 'rappel_non'),
      'widget', (select count(distinct appareil) from ev where type = 'widget'),
      'rappels_ouverts', (select count(*) from ev where type = 'rappel_ouvert'),
      'widgets_poses', (select jsonb_build_object('appareils_avec', count(distinct appareil) filter (where valeur > 0),
         'appareils_sans', count(distinct appareil) filter (where coalesce(valeur, 0) = 0)) from ev where type = 'widget_pose'),
      'widgets_par_genre', (select coalesce(jsonb_object_agg(g, c), '{}'::jsonb) from
         (select w as g, count(distinct appareil) c from ev, regexp_split_to_table(coalesce(details->>'k', ''), ',') as w
          where type = 'widget_pose' and w <> '' group by 1) x)),
  'usage', jsonb_build_object(
      'seances', (select count(*) from ev where type = 'duree'),
      'duree_mediane_min', (select round((percentile_cont(0.5) within group (order by valeur) / 60.0)::numeric, 1) from ev where type = 'duree'),
      'duree_moyenne_min', (select round(avg(valeur) / 60.0, 1) from ev where type = 'duree'),
      'temps_total_h', (select round(coalesce(sum(valeur), 0) / 3600.0, 1) from ev where type = 'duree'),
      'console_jours', (select count(*) from ev where type = 'console'),
      'console_appareils', (select count(distinct appareil) from ev where type = 'console'),
      'imports', (select count(*) from ev where type = 'import'),
      'tables_importees', (select coalesce(sum(valeur), 0) from ev where type = 'import'),
      'stickers', (select coalesce(jsonb_object_agg(s, c), '{}'::jsonb) from (select coalesce(details->>'s', '?') s, count(*) c from ev where type = 'sticker' group by 1) x),
      'partages', (select coalesce(jsonb_object_agg(q, c), '{}'::jsonb) from (select coalesce(details->>'quoi', '?') q, count(*) c from ev where type = 'partage' group by 1) x),
      'raccourcis', (select coalesce(jsonb_object_agg(k, c), '{}'::jsonb) from (select coalesce(details->>'k', '?') k, count(*) c from ev where type = 'raccourci' group by 1) x)),
  'plateformes', (select coalesce(jsonb_object_agg(pl, c), '{}'::jsonb) from (select coalesce(details->>'p', '?') pl, count(distinct appareil) c from ev where type = 'ouverture' group by 1) x),
  'versions', (select coalesce(jsonb_object_agg(v, c), '{}'::jsonb) from (select coalesce(details->>'v', '?') v, count(distinct appareil) c from ev where type = 'ouverture' group by 1 order by 2 desc limit 6) x),
  'erreurs', (select coalesce(jsonb_agg(jsonb_build_object('message', m, 'n', c) order by c desc), '[]'::jsonb) from (select details->>'m' m, count(*) c from ev where type = 'erreur' group by 1 order by 2 desc limit 10) x),
  'onboarding', (select coalesce(jsonb_object_agg(etape, c), '{}'::jsonb) from (select etape, count(*) c from public.onboarding_etape, p where vue_le > now() - make_interval(days => p.n) group by etape) x)
); $$;
revoke all on function public.stat_tableau(integer) from public, anon, authenticated;
