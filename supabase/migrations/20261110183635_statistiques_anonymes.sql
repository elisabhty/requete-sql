-- Statistiques anonymes de l'appli (Elisa, 10 novembre, 19 h 33 : « Oui tout » ; accord pour la base de production).
-- Un événement = un appareil brouillé (l'empreinte de sa clé, brouillée une seconde fois : on ne peut pas la relier au pseudo ni aux
-- salles), un type pris dans une liste fermée, le jour, un nombre et quelques détails courts. Rien à lire depuis l'appli : la table est
-- privée, seule stat_noter y écrit ; stat_tableau calcule les chiffres du tableau de bord et n'est lançable que par le propriétaire.
create table if not exists requete_private.stat_evenement (
  id bigint generated always as identity primary key,
  appareil text not null check (appareil ~ '^[0-9a-f]{64}$'),
  type text not null check (type ~ '^[a-z_]{3,24}$'),
  jour date not null,
  valeur integer,
  details jsonb check (details is null or (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 300)),
  cree timestamptz not null default now()
);
alter table requete_private.stat_evenement enable row level security;
create index if not exists stat_evenement_type_jour on requete_private.stat_evenement (type, jour);
create index if not exists stat_evenement_appareil_cree on requete_private.stat_evenement (appareil, cree);
revoke all on requete_private.stat_evenement from public, anon, authenticated;

create or replace function public.stat_noter(p_cle text, p_evts jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_app text;
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  n integer;
  types constant text[] := array['installation','ouverture','flamme','serie_cassee','semaine_feu','lecon_debut','lecon_validee',
    'video_quittee','moment','module_termine','defi','partie','salle_creee','salle_rejointe','paywall_vu','offre','paywall_passe',
    'essai','achat','restaure','connexion','compte','rappel_oui','rappel_non','widget','erreur'];
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

-- Le tableau de bord : tous les chiffres d'une période, en un seul JSON (lancé par le propriétaire, jamais par l'appli).
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
      'salles_rejointes', (select count(*) from ev where type = 'salle_rejointe')),
  'argent', jsonb_build_object(
      'paywall_vu', (select count(distinct appareil) from ev where type = 'paywall_vu'),
      'choix_annuel', (select count(*) from ev where type = 'offre' and details->>'o' = 'an'),
      'choix_semaine', (select count(*) from ev where type = 'offre' and details->>'o' = 'semaine'),
      'passe_sans_payer', (select count(distinct appareil) from ev where type = 'paywall_passe'),
      'essais', (select count(*) from ev where type = 'essai'),
      'achats_annuel', (select count(*) from ev where type = 'achat' and details->>'o' = 'an'),
      'achats_semaine', (select count(*) from ev where type = 'achat' and details->>'o' = 'semaine'),
      'restaurations', (select count(*) from ev where type = 'restaure')),
  'comptes', jsonb_build_object('crees', (select count(*) from ev where type = 'compte'), 'connexions', (select count(*) from ev where type = 'connexion')),
  'reglages', jsonb_build_object('rappel_oui', (select count(distinct appareil) from ev where type = 'rappel_oui'), 'rappel_non', (select count(distinct appareil) from ev where type = 'rappel_non'),
      'widget', (select count(distinct appareil) from ev where type = 'widget')),
  'plateformes', (select coalesce(jsonb_object_agg(pl, c), '{}'::jsonb) from (select coalesce(details->>'p', '?') pl, count(distinct appareil) c from ev where type = 'ouverture' group by 1) x),
  'versions', (select coalesce(jsonb_object_agg(v, c), '{}'::jsonb) from (select coalesce(details->>'v', '?') v, count(distinct appareil) c from ev where type = 'ouverture' group by 1 order by 2 desc limit 6) x),
  'erreurs', (select coalesce(jsonb_agg(jsonb_build_object('message', m, 'n', c) order by c desc), '[]'::jsonb) from (select details->>'m' m, count(*) c from ev where type = 'erreur' group by 1 order by 2 desc limit 10) x),
  'onboarding', (select coalesce(jsonb_object_agg(etape, c), '{}'::jsonb) from (select etape, count(*) c from public.onboarding_etape, p where vue_le > now() - make_interval(days => p.n) group by etape) x)
); $$;
revoke all on function public.stat_tableau(integer) from public, anon, authenticated;

-- Garder 13 mois au plus
select cron.schedule('stat-menage', '17 4 * * *', $$delete from requete_private.stat_evenement where cree < now() - interval '400 days'$$)
where not exists (select 1 from cron.job where jobname = 'stat-menage');
