-- « Donne ton avis sur la leçon » (Elisa, 4 novembre, 12 h 35 : « à chaque fin de leçon, mettre une partie “Donne ton avis sur la
-- leçon” avec des étoiles animées »).
--
-- Un avis par appareil et par leçon : l’empreinte de sa clé (jeu_cle, comme le vote des parcours), la leçon (son numéro et son titre),
-- la note de 1 à 5 et la date ; ni nom, ni e-mail. Changer sa note remplace l’avis. L’appli n’écrit que par lecon_noter ; la table n’a
-- aucun droit direct pour anon et authenticated. Au plus 5 000 avis par heure pour tout le monde, pour qu’on ne puisse pas la remplir.
-- Les résultats se lisent dans le tableau de bord : vue avis_lecons (par leçon, la moyenne, le nombre d’avis et leur répartition).
create table if not exists public.avis_lecon (
  cle text not null,
  lecon integer not null check (lecon between 1 and 99999),
  titre text check (titre is null or char_length(titre) <= 120),
  note smallint not null check (note between 1 and 5),
  note_le timestamptz not null default now(),
  primary key (cle, lecon)
);
create index if not exists avis_lecon_note_le on public.avis_lecon (note_le);
comment on table public.avis_lecon is
  'Avis « Donne ton avis sur la leçon » : un par appareil (empreinte de sa clé) et par leçon, changer sa note le remplace. Résultats : vue avis_lecons.';
alter table public.avis_lecon enable row level security;
revoke all on public.avis_lecon from public, anon, authenticated;

create or replace function public.lecon_noter(p_cle text, p_lecon integer, p_note integer, p_titre text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_titre text := nullif(left(btrim(regexp_replace(coalesce(p_titre, ''), '[[:cntrl:][:space:]]+', ' ', 'g')), 120), '');
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  if p_lecon is null or p_lecon not between 1 and 99999 or p_note is null or p_note not between 1 and 5 then
    return jsonb_build_object('ok', false, 'raison', 'invalide');
  end if;
  if (select count(*) from public.avis_lecon where note_le > now() - interval '1 hour') >= 5000 then
    return jsonb_build_object('ok', false, 'raison', 'trop');
  end if;
  insert into public.avis_lecon as a (cle, lecon, titre, note) values (v_cle, p_lecon, v_titre, p_note)
  on conflict (cle, lecon) do update set note = excluded.note, titre = coalesce(excluded.titre, a.titre), note_le = now();
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.lecon_noter(text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.lecon_noter(text, integer, integer, text) to anon, authenticated;

-- Pour le tableau de bord (éditeur SQL ou Table Editor) : les leçons les moins bien notées d’abord, avec le nombre d’avis,
-- la moyenne, la répartition des notes et la date du dernier avis.
create or replace view public.avis_lecons with (security_invoker = true) as
select
  a.lecon,
  max(a.titre) as titre,
  count(*) as avis,
  round(avg(a.note)::numeric, 2) as moyenne,
  count(*) filter (where a.note = 5) as "5 étoiles",
  count(*) filter (where a.note = 4) as "4 étoiles",
  count(*) filter (where a.note = 3) as "3 étoiles",
  count(*) filter (where a.note = 2) as "2 étoiles",
  count(*) filter (where a.note = 1) as "1 étoile",
  to_char(max(a.note_le) at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI') as dernier_avis
from public.avis_lecon a
group by a.lecon
order by avg(a.note) asc, count(*) desc;
revoke all on public.avis_lecons from public, anon, authenticated;
