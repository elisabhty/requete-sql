-- Les retours de l’appli, par e-mail (Elisa, 12 novembre, 22 h 07 : « est-ce que le contact nous je peux le recevoir par mail
-- quand j’ai un message ? pareil pour un commentaire avis du site internet ou de l’appli ? » ; puis : « Oui, par mail »).
--
-- Trois choses préviennent Elisa : un message « Contacte-nous » (contact_message), un avis sur une leçon quand il porte un
-- commentaire (avis_lecon) et un pseudo signalé au classement (jeu_signalement). À chaque nouvelle ligne, la base appelle la
-- fonction alerte-mail (supabase/functions/alerte-mail) par pg_net, sans attendre sa réponse : l’envoi d’un message n’est
-- jamais ralenti ni empêché par l’e-mail. La fonction prend ce qui attend (alerte_prendre), écrit un seul e-mail et l’envoie
-- par Resend ; si l’envoi échoue, elle rend les lignes (alerte_rendre) et le rattrapage de chaque heure réessaie, 5 fois au
-- plus par ligne, pendant 2 jours.
--
-- Garde-fous : au plus 40 e-mails par jour, et à partir du 10e, un toutes les 10 minutes au plus (ce qui attend part dans
-- le suivant, regroupé) ; au plus 20 lignes de chaque sorte par e-mail. Rien de ce qui existait avant cette migration n’est
-- envoyé. Sans la clé RESEND_API_KEY, la fonction répond « veille » et ne prend rien : ce qui a moins de 2 jours partira dès
-- que la clé sera là.
--
-- L’appli ne voit rien de tout cela : alerte_prendre et alerte_rendre sont réservées au serveur (service_role).

create extension if not exists pg_net with schema extensions;

alter table public.contact_message
  add column if not exists alerte_le timestamptz,
  add column if not exists alerte_essais smallint not null default 0;
alter table public.avis_lecon
  add column if not exists alerte_le timestamptz,
  add column if not exists alerte_essais smallint not null default 0;
alter table public.jeu_signalement
  add column if not exists alerte_le timestamptz,
  add column if not exists alerte_essais smallint not null default 0;
comment on column public.contact_message.alerte_le is 'Quand l’e-mail d’alerte est parti (vide : pas encore). Fonction alerte-mail.';
comment on column public.avis_lecon.alerte_le is 'Quand l’e-mail d’alerte du commentaire est parti (vide : pas encore, ou pas de commentaire).';
comment on column public.jeu_signalement.alerte_le is 'Quand l’e-mail d’alerte est parti (vide : pas encore). Fonction alerte-mail.';

-- Ce qui existait déjà n’est pas envoyé.
update public.contact_message set alerte_le = cree where alerte_le is null;
update public.avis_lecon set alerte_le = note_le where alerte_le is null and commentaire is not null;
update public.jeu_signalement set alerte_le = cree where alerte_le is null;

create index if not exists contact_message_alerte on public.contact_message (cree) where alerte_le is null;
create index if not exists avis_lecon_alerte on public.avis_lecon (note_le) where alerte_le is null and commentaire is not null;
create index if not exists jeu_signalement_alerte on public.jeu_signalement (cree) where alerte_le is null;

-- Le compte des e-mails du jour (heure de Paris), pour les garde-fous.
create table if not exists requete_private.alerte_envoi (
  jour date primary key,
  envois integer not null default 0,
  dernier timestamptz not null default now()
);
alter table requete_private.alerte_envoi enable row level security;
revoke all on requete_private.alerte_envoi from public, anon, authenticated;
comment on table requete_private.alerte_envoi is 'E-mails d’alerte partis, par jour (fonction alerte-mail) : 40 au plus.';

-- L’adresse de la fonction, à un seul endroit.
create or replace function requete_private.alerte_url() returns text
language sql immutable set search_path = '' as $$
  select 'https://ynuenrxozcpkrjdbeftc.supabase.co/functions/v1/alerte-mail'::text;
$$;

-- Y a-t-il quelque chose à envoyer ?
create or replace function requete_private.alerte_attend() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.contact_message
                 where alerte_le is null and alerte_essais < 5 and cree > now() - interval '2 days')
      or exists (select 1 from public.avis_lecon
                 where alerte_le is null and commentaire is not null and alerte_essais < 5 and note_le > now() - interval '2 days')
      or exists (select 1 from public.jeu_signalement
                 where alerte_le is null and alerte_essais < 5 and cree > now() - interval '2 days');
$$;

-- Prévenir la fonction : la demande part après la validation de la ligne, sans attendre la réponse. Une panne ici ne doit
-- jamais empêcher d’écrire le message, d’où le bloc qui avale l’erreur.
create or replace function requete_private.alerte_prevenir() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform net.http_post(url := requete_private.alerte_url(), body := '{}'::jsonb, timeout_milliseconds := 10000);
  exception when others then null;
  end;
  return null;
end $$;

-- Un commentaire nouveau ou changé sur un avis déjà envoyé : il repart.
create or replace function requete_private.avis_alerte_remettre() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.commentaire is not null and new.commentaire is distinct from old.commentaire then
    new.alerte_le := null;
    new.alerte_essais := 0;
  end if;
  return new;
end $$;

drop trigger if exists contact_message_alerte on public.contact_message;
create trigger contact_message_alerte after insert on public.contact_message
  for each row execute function requete_private.alerte_prevenir();

drop trigger if exists avis_lecon_alerte_remettre on public.avis_lecon;
create trigger avis_lecon_alerte_remettre before update of commentaire on public.avis_lecon
  for each row execute function requete_private.avis_alerte_remettre();

drop trigger if exists avis_lecon_alerte on public.avis_lecon;
create trigger avis_lecon_alerte after insert or update of commentaire on public.avis_lecon
  for each row when (new.commentaire is not null and new.alerte_le is null)
  execute function requete_private.alerte_prevenir();

drop trigger if exists jeu_signalement_alerte on public.jeu_signalement;
create trigger jeu_signalement_alerte after insert on public.jeu_signalement
  for each row execute function requete_private.alerte_prevenir();

-- Prendre ce qui attend : chaque ligne est marquée dans le même geste, donc jamais prise deux fois, même si deux appels
-- arrivent ensemble (le second attend la fin du premier).
create or replace function public.alerte_prendre() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  v_envois integer;
  v_dernier timestamptz;
  v jsonb := '[]'::jsonb;
  r record;
begin
  perform pg_advisory_xact_lock(hashtext('requete.alerte_mail'));
  select e.envois, e.dernier into v_envois, v_dernier from requete_private.alerte_envoi e where e.jour = v_jour;
  v_envois := coalesce(v_envois, 0);
  if v_envois >= 40 or (v_envois >= 10 and v_dernier > now() - interval '10 minutes') then
    return v;
  end if;

  for r in
    update public.contact_message m set alerte_le = now(), alerte_essais = m.alerte_essais + 1
    where m.id in (select c.id from public.contact_message c
                   where c.alerte_le is null and c.alerte_essais < 5 and c.cree > now() - interval '2 days'
                   order by c.cree limit 20 for update skip locked)
    returning m.id, m.cree, m.type, m.message, m.email, m.infos, m.pieces, m.alerte_essais
  loop
    v := v || jsonb_build_object('genre', 'contact', 'ref', r.id::text, 'essai', r.alerte_essais, 'quand', r.cree,
      'le', to_char(r.cree at time zone 'Europe/Paris', 'DD/MM/YYYY "à" HH24:MI'),
      'type', r.type, 'message', r.message, 'email', r.email, 'infos', coalesce(r.infos, '{}'::jsonb),
      'pieces', to_jsonb(coalesce(r.pieces, array[]::text[])));
  end loop;

  for r in
    update public.avis_lecon a set alerte_le = now(), alerte_essais = a.alerte_essais + 1
    where (a.cle, a.lecon) in (select b.cle, b.lecon from public.avis_lecon b
                               where b.alerte_le is null and b.commentaire is not null and b.alerte_essais < 5
                                 and b.note_le > now() - interval '2 days'
                               order by b.note_le limit 20 for update skip locked)
    returning a.cle, a.lecon, a.titre, a.note, a.commentaire, a.note_le, a.alerte_essais
  loop
    v := v || jsonb_build_object('genre', 'avis', 'ref', r.cle || ':' || r.lecon, 'essai', r.alerte_essais, 'quand', r.note_le,
      'le', to_char(r.note_le at time zone 'Europe/Paris', 'DD/MM/YYYY "à" HH24:MI'),
      'lecon', r.lecon, 'titre', r.titre, 'note', r.note, 'commentaire', r.commentaire);
  end loop;

  for r in
    update public.jeu_signalement s set alerte_le = now(), alerte_essais = s.alerte_essais + 1
    where (s.joueur, s.par) in (select t.joueur, t.par from public.jeu_signalement t
                                where t.alerte_le is null and t.alerte_essais < 5 and t.cree > now() - interval '2 days'
                                order by t.cree limit 20 for update skip locked)
    returning s.joueur, s.par, s.pseudo, s.cree, s.alerte_essais
  loop
    v := v || jsonb_build_object('genre', 'signalement', 'ref', r.joueur || ':' || r.par, 'essai', r.alerte_essais, 'quand', r.cree,
      'le', to_char(r.cree at time zone 'Europe/Paris', 'DD/MM/YYYY "à" HH24:MI'),
      'pseudo', r.pseudo,
      'signalements', (select count(*) from public.jeu_signalement x where x.joueur = r.joueur),
      'masque', coalesce((select j.masque from public.jeu_joueur j where j.id = r.joueur), false));
  end loop;

  if jsonb_array_length(v) > 0 then
    insert into requete_private.alerte_envoi as e (jour, envois, dernier) values (v_jour, 1, now())
    on conflict (jour) do update set envois = e.envois + 1, dernier = now();
    delete from requete_private.alerte_envoi where jour < v_jour - 30;
  end if;
  return v;
end $$;

-- Rendre des lignes quand l’e-mail n’est pas parti : [{"genre": "contact", "ref": "12"}, …]. Elles seront reprises par le
-- rattrapage, tant qu’il leur reste des essais.
create or replace function public.alerte_rendre(p_refs jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  e jsonb;
  v_genre text;
  v_ref text;
  n integer := 0;
  k integer;
begin
  if p_refs is null or jsonb_typeof(p_refs) <> 'array' or jsonb_array_length(p_refs) > 100 then return 0; end if;
  for e in select value from jsonb_array_elements(p_refs) loop
    v_genre := e ->> 'genre';
    v_ref := coalesce(e ->> 'ref', '');
    k := 0;
    if v_genre = 'contact' and v_ref ~ '^[0-9]{1,18}$' then
      update public.contact_message set alerte_le = null where id = v_ref::bigint and alerte_le is not null;
      get diagnostics k = row_count;
    elsif v_genre = 'avis' and v_ref ~ '^[0-9a-f]{64}:[0-9]{1,5}$' then
      update public.avis_lecon set alerte_le = null
      where cle = split_part(v_ref, ':', 1) and lecon = split_part(v_ref, ':', 2)::integer and alerte_le is not null;
      get diagnostics k = row_count;
    elsif v_genre = 'signalement' and v_ref ~ '^[0-9a-f-]{36}:[0-9a-f-]{36}$' then
      update public.jeu_signalement set alerte_le = null
      where joueur::text = split_part(v_ref, ':', 1) and par::text = split_part(v_ref, ':', 2) and alerte_le is not null;
      get diagnostics k = row_count;
    end if;
    n := n + k;
  end loop;
  return n;
end $$;

-- Le rattrapage de chaque heure : s’il reste quelque chose (un envoi raté, la clé ajoutée après coup), on rappelle la fonction.
create or replace function requete_private.alerte_rattraper() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if requete_private.alerte_attend() then
    perform net.http_post(url := requete_private.alerte_url(), body := '{}'::jsonb, timeout_milliseconds := 10000);
  end if;
exception when others then null;
end $$;

revoke all on function public.alerte_prendre() from public, anon, authenticated;
revoke all on function public.alerte_rendre(jsonb) from public, anon, authenticated;
revoke all on function requete_private.alerte_url() from public, anon, authenticated;
revoke all on function requete_private.alerte_attend() from public, anon, authenticated;
revoke all on function requete_private.alerte_prevenir() from public, anon, authenticated;
revoke all on function requete_private.avis_alerte_remettre() from public, anon, authenticated;
revoke all on function requete_private.alerte_rattraper() from public, anon, authenticated;
grant execute on function public.alerte_prendre() to service_role;
grant execute on function public.alerte_rendre(jsonb) to service_role;

select cron.schedule('alerte-mail-rattrapage', '47 * * * *', 'select requete_private.alerte_rattraper()');
