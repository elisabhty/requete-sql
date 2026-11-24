-- L’île de la leçon ou de l’onboarding, fermée 5 minutes après avoir quitté l’app (Elisa, 24 novembre, 16 h 48 : « Tu peux
-- pousser pour tout le monde de la fermer 5 min après avoir fermé complètement l’appli »).
--
-- L’app balayée, iOS ne la prévient pas : sans le serveur, l’île restait jusqu’à 8 heures. Dès qu’on quitte l’app, le téléphone
-- donne le jeton de push de chaque île en cours et son dernier état à la fonction ile-fermer (supabase/functions/ile-fermer), qui
-- les garde ici avec l’heure de la fermeture (ile_fermer_v1) ; revenu avant, il l’annule. Chaque minute, s’il y en a une de due,
-- la base appelle la fonction (pg_net, sans attendre sa réponse), qui les prend (ile_fermer_dues_v1) et pousse leur fin à Apple.
--
-- Rien d’autre que le jeton et l’état de l’île (l’avancement, l’étape, le prénom de l’onboarding) ; une ligne vit 15 minutes au
-- plus, et ce qui traîne plus de 12 heures est effacé. L’appli ne voit rien de tout cela : les deux fonctions sont réservées au
-- serveur (service_role). Garde-fou : 20 000 îles en attente au plus.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists requete_private.ile_fermer (
  jeton text primary key check (jeton ~ '^[0-9a-f]+$' and length(jeton) between 32 and 400),
  etat jsonb not null check (jsonb_typeof(etat) = 'object' and octet_length(etat::text) <= 1500),
  fin_le timestamptz not null,
  cree timestamptz not null default now()
);
create index if not exists ile_fermer_fin on requete_private.ile_fermer (fin_le);
alter table requete_private.ile_fermer enable row level security;
revoke all on requete_private.ile_fermer from public, anon, authenticated;
comment on table requete_private.ile_fermer is 'Îles (Live Activities leçon et onboarding) à fermer par Apple 5 minutes après avoir quitté l’app. Fonction ile-fermer.';

-- On quitte l’app (p_dans : les secondes avant la fermeture) ; on revient (p_dans vide : annulé).
create or replace function public.ile_fermer_v1(p_jeton text, p_dans integer, p_etat jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_jeton is null or p_jeton !~ '^[0-9a-f]+$' or length(p_jeton) not between 32 and 400 then
    raise exception 'demande invalide' using errcode = '22023';
  end if;
  if p_dans is null then
    delete from requete_private.ile_fermer where jeton = p_jeton;
    return;
  end if;
  if p_etat is null or jsonb_typeof(p_etat) <> 'object' or octet_length(p_etat::text) > 1500 then
    raise exception 'demande invalide' using errcode = '22023';
  end if;
  if not exists (select 1 from requete_private.ile_fermer where jeton = p_jeton)
     and (select count(*) from requete_private.ile_fermer) >= 20000 then
    raise exception 'trop d’îles en attente' using errcode = '53400';
  end if;
  insert into requete_private.ile_fermer (jeton, etat, fin_le)
  values (p_jeton, p_etat, now() + make_interval(secs => least(900, greatest(60, p_dans))))
  on conflict (jeton) do update set etat = excluded.etat, fin_le = excluded.fin_le;
end $$;
revoke all on function public.ile_fermer_v1(text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.ile_fermer_v1(text, integer, jsonb) to service_role;

-- Celles dont l’heure est passée, prises une seule fois (effacées en les rendant).
create or replace function public.ile_fermer_dues_v1(p_max integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
begin
  with dues as (
    select f.jeton from requete_private.ile_fermer f
    where f.fin_le <= now()
    order by f.fin_le
    limit least(200, greatest(1, coalesce(p_max, 100)))
    for update skip locked
  ), prises as (
    delete from requete_private.ile_fermer f using dues d where f.jeton = d.jeton
    returning f.jeton, f.etat
  )
  select coalesce(jsonb_agg(jsonb_build_object('jeton', p.jeton, 'etat', p.etat)), '[]'::jsonb) into v from prises p;
  delete from requete_private.ile_fermer where cree < now() - interval '12 hours';
  return v;
end $$;
revoke all on function public.ile_fermer_dues_v1(integer) from public, anon, authenticated;
grant execute on function public.ile_fermer_dues_v1(integer) to service_role;

-- Chaque minute : une île est due, la fonction est prévenue. Une panne ici n’empêche rien d’autre.
create or replace function requete_private.ile_fermer_lancer() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from requete_private.ile_fermer where fin_le <= now()) then
    begin
      perform net.http_post(url := 'https://ynuenrxozcpkrjdbeftc.supabase.co/functions/v1/ile-fermer',
        body := '{"envoyer": true}'::jsonb, timeout_milliseconds := 10000);
    exception when others then null;
    end;
  end if;
end $$;
revoke all on function requete_private.ile_fermer_lancer() from public, anon, authenticated;

select cron.schedule('ile-fermer', '* * * * *', 'select requete_private.ile_fermer_lancer()');
