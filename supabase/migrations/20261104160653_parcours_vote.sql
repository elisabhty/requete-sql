-- « Quel parcours après SQL ? » (Elisa, 3 novembre, 19 h 01 : « Ok pour ça », sur la maquette des parcours à venir).
--
-- Un vote par appareil : l’empreinte de sa clé (jeu_cle, comme les messages de contact), le parcours choisi et la date ; ni nom,
-- ni e-mail. Revoter remplace le vote. L’appli n’écrit que par parcours_voter ; la table n’a aucun droit direct pour anon et
-- authenticated. Au plus 2 000 votes par heure pour tout le monde, pour qu’on ne puisse pas remplir la table.
-- Les résultats se lisent dans le tableau de bord : vue parcours_votes (le nombre de votes par parcours).
create table if not exists public.parcours_vote (
  cle text primary key,
  parcours text not null check (parcours in ('python', 'excel', 'powerbi')),
  vote_le timestamptz not null default now()
);
comment on table public.parcours_vote is
  'Votes « Quel parcours après SQL ? » : un par appareil (empreinte de sa clé), revoter le remplace. Résultats : vue parcours_votes.';
alter table public.parcours_vote enable row level security;
revoke all on public.parcours_vote from public, anon, authenticated;

create or replace function public.parcours_voter(p_cle text, p_parcours text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  if p_parcours is null or p_parcours not in ('python', 'excel', 'powerbi') then
    return jsonb_build_object('ok', false, 'raison', 'invalide');
  end if;
  if (select count(*) from public.parcours_vote where vote_le > now() - interval '1 hour') >= 2000 then
    return jsonb_build_object('ok', false, 'raison', 'trop');
  end if;
  insert into public.parcours_vote (cle, parcours) values (v_cle, p_parcours)
  on conflict (cle) do update set parcours = excluded.parcours, vote_le = now();
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.parcours_voter(text, text) from public, anon, authenticated;
grant execute on function public.parcours_voter(text, text) to anon, authenticated;

-- Pour le tableau de bord (éditeur SQL ou Table Editor) : les votes par parcours, du plus demandé au moins demandé.
create or replace view public.parcours_votes with (security_invoker = true) as
select
  v.parcours,
  case v.parcours when 'python' then 'Python pour la data' when 'excel' then 'Excel et tableaux croisés' else 'Power BI' end as titre,
  count(*) as votes,
  to_char(max(v.vote_le) at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI') as dernier_vote
from public.parcours_vote v
group by v.parcours
order by count(*) desc;
revoke all on public.parcours_votes from public, anon, authenticated;
