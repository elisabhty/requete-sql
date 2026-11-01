-- « Nous contacter » : joindre une image ou un fichier (Elisa, 1er novembre, 9 h 30 : « pouvoir mettre une image, un fichier »).
--
-- Les fichiers vont dans un espace de stockage privé, « contact-pieces » : l’appli peut y déposer, jamais y lire, ni modifier, ni
-- supprimer. 3 fichiers au plus par message (vérifié par contact_envoyer), 5 Mo chacun, seulement des images, des PDF et des
-- fichiers de données (texte, CSV, JSON, Excel, SQLite). Chaque fichier est rangé dans un dossier tiré au hasard
-- (<32 caractères hexadécimaux>/<nom du fichier>). Au plus 200 dépôts par heure pour tout le monde (contact_piece_ok), pour
-- qu’on ne puisse pas remplir l’espace.
-- Les pièces se voient dans le tableau de bord : vue contact_boite (colonne « pieces »), puis Storage › contact-pieces.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contact-pieces', 'contact-pieces', false, 5242880, array[
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf', 'text/plain', 'text/csv', 'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
  'application/vnd.sqlite3'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Le rythme des dépôts, pour tout le monde : 200 fichiers par heure au plus.
create or replace function public.contact_piece_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from storage.objects
          where bucket_id = 'contact-pieces' and created_at > now() - interval '1 hour') < 200;
$$;
revoke all on function public.contact_piece_ok() from public, anon, authenticated;
grant execute on function public.contact_piece_ok() to anon, authenticated;

drop policy if exists contact_pieces_depot on storage.objects;
create policy contact_pieces_depot on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'contact-pieces'
  and name ~ '^[0-9a-f]{32}/[^/]{1,120}$'
  and public.contact_piece_ok()
);

alter table public.contact_message add column if not exists pieces text[]
  check (pieces is null or cardinality(pieces) <= 3);

-- contact_envoyer reçoit aussi les chemins des pièces déposées juste avant ; il ne garde que ceux qui existent vraiment,
-- déposés depuis moins d’une heure, et au plus 3.
drop function if exists public.contact_envoyer(text, text, text, text, jsonb);
create or replace function public.contact_envoyer(p_cle text, p_type text, p_message text, p_email text default null,
  p_infos jsonb default null, p_pieces text[] default null)
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
  v_pieces text[];
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
  if p_infos is not null and jsonb_typeof(p_infos) = 'object' then
    select jsonb_object_agg(e.key, left(e.value #>> '{}', 80)) into v_infos
    from jsonb_each(p_infos) e
    where e.key in ('version', 'appareil', 'navigateur', 'mode', 'ecran', 'langue')
      and jsonb_typeof(e.value) in ('string', 'number');
  end if;
  if p_pieces is not null and cardinality(p_pieces) > 0 then
    select array_agg(o.name order by o.created_at) into v_pieces
    from (select distinct unnest(p_pieces[1:3]) as p) x
    join storage.objects o on o.bucket_id = 'contact-pieces' and o.name = x.p
    where x.p ~ '^[0-9a-f]{32}/[^/]{1,120}$' and o.created_at > now() - interval '1 hour';
  end if;
  if (select count(*) from public.contact_message where cle = v_cle and cree > now() - interval '10 minutes') >= 3
     or (select count(*) from public.contact_message where cle = v_cle and cree > now() - interval '1 day') >= 20
     or (select count(*) from public.contact_message where cree > now() - interval '1 hour') >= 300 then
    return jsonb_build_object('ok', false, 'raison', 'trop');
  end if;
  insert into public.contact_message (cle, type, message, email, infos, pieces)
  values (v_cle, p_type, v_msg, v_mail, v_infos, v_pieces);
  return jsonb_build_object('ok', true, 'pieces', coalesce(cardinality(v_pieces), 0));
end;
$$;
revoke all on function public.contact_envoyer(text, text, text, text, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.contact_envoyer(text, text, text, text, jsonb, text[]) to anon, authenticated;

-- La boîte de réception montre aussi les pièces (chemins dans Storage › contact-pieces).
create or replace view public.contact_boite with (security_invoker = true) as
select
  m.id,
  to_char(m.cree at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI') as recu_le,
  case m.type when 'bug' then 'Bug' when 'idee' then 'Idée' when 'question' then 'Question' else 'Autre' end as sujet,
  m.message,
  m.email,
  m.infos ->> 'version' as version,
  concat_ws(' · ', m.infos ->> 'appareil', m.infos ->> 'navigateur', m.infos ->> 'mode', m.infos ->> 'ecran') as appareil,
  m.lu,
  m.pieces
from public.contact_message m
order by m.cree desc;
revoke all on public.contact_boite from anon, authenticated;
