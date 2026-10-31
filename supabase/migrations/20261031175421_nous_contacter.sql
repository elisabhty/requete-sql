-- « Nous contacter » (Elisa, 31 octobre, 18 h 49 : « pour aide, fais plutôt l’onglet pour contacter, reporter un bug, etc. »).
-- Mon compte › Nous contacter : un bug, une idée, une question ou autre chose, un message, une adresse e-mail facultative
-- (pour répondre) et, pour un bug, quelques infos techniques (version, appareil, navigateur, écran).
--
-- Rien n’est lisible depuis l’appli : la table n’a aucun droit pour anon / authenticated ; on y écrit seulement par
-- contact_envoyer (qui vérifie tout et limite le rythme). Les messages se lisent dans le tableau de bord Supabase,
-- Table Editor, vue « contact_boite » (le plus récent en haut). Ils sont effacés au bout de 3 ans (contact_menage).

create table if not exists public.contact_message (
  id bigint generated always as identity primary key,
  cree timestamptz not null default now(),
  -- empreinte (sha-256) de l’identifiant tiré au hasard par l’appareil, le même que pour le classement : ni nom ni e-mail
  cle text not null,
  type text not null check (type in ('bug', 'idee', 'question', 'autre')),
  message text not null check (char_length(message) between 3 and 1000),
  email text check (email is null or char_length(email) <= 200),
  infos jsonb check (infos is null or pg_column_size(infos) <= 2000),
  lu boolean not null default false
);
comment on table public.contact_message is 'Messages envoyés depuis l’appli (Mon compte › Nous contacter). À lire dans la vue contact_boite ; cocher « lu » une fois traité.';

alter table public.contact_message enable row level security;
revoke all on table public.contact_message from anon, authenticated;
create index if not exists contact_message_cle_cree on public.contact_message (cle, cree desc);
create index if not exists contact_message_cree on public.contact_message (cree desc);

create or replace function public.contact_envoyer(p_cle text, p_type text, p_message text, p_email text default null,
  p_infos jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_msg text := btrim(coalesce(p_message, ''));
  v_mail text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_infos jsonb;
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  if p_type is null or p_type not in ('bug', 'idee', 'question', 'autre') then
    return jsonb_build_object('ok', false, 'raison', 'invalide');
  end if;
  if char_length(v_msg) < 3 or char_length(v_msg) > 1000 then
    return jsonb_build_object('ok', false, 'raison', 'invalide');
  end if;
  if v_mail is not null and (char_length(v_mail) > 200 or v_mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    return jsonb_build_object('ok', false, 'raison', 'email');
  end if;
  -- Infos techniques : seulement ces quelques champs, courts.
  if p_infos is not null and jsonb_typeof(p_infos) = 'object' then
    select jsonb_object_agg(e.key, left(e.value #>> '{}', 80)) into v_infos
    from jsonb_each(p_infos) e
    where e.key in ('version', 'appareil', 'navigateur', 'mode', 'ecran', 'langue')
      and jsonb_typeof(e.value) in ('string', 'number');
  end if;
  -- Rythme : 3 messages en 10 minutes et 20 par jour pour un appareil ; 300 par heure en tout.
  if (select count(*) from public.contact_message where cle = v_cle and cree > now() - interval '10 minutes') >= 3
     or (select count(*) from public.contact_message where cle = v_cle and cree > now() - interval '1 day') >= 20
     or (select count(*) from public.contact_message where cree > now() - interval '1 hour') >= 300 then
    return jsonb_build_object('ok', false, 'raison', 'trop');
  end if;
  insert into public.contact_message (cle, type, message, email, infos) values (v_cle, p_type, v_msg, v_mail, v_infos);
  return jsonb_build_object('ok', true);
end;
$$;

-- La boîte de réception, pour le tableau de bord (jamais lisible depuis l’appli).
create or replace view public.contact_boite with (security_invoker = true) as
select
  m.id,
  to_char(m.cree at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI') as recu_le,
  case m.type when 'bug' then 'Bug' when 'idee' then 'Idée' when 'question' then 'Question' else 'Autre' end as sujet,
  m.message,
  m.email,
  m.infos ->> 'version' as version,
  concat_ws(' · ', m.infos ->> 'appareil', m.infos ->> 'navigateur', m.infos ->> 'mode', m.infos ->> 'ecran') as appareil,
  m.lu
from public.contact_message m
order by m.cree desc;

-- Conservation : au plus 3 ans.
create or replace function public.contact_menage()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.contact_message where cree < now() - interval '3 years';
$$;

revoke all on public.contact_boite from anon, authenticated;
revoke all on function public.contact_envoyer(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.contact_menage() from public, anon, authenticated;
grant execute on function public.contact_envoyer(text, text, text, text, jsonb) to anon, authenticated;

select cron.schedule('contact-menage', '29 4 * * *', 'select public.contact_menage()');
