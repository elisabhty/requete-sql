-- 14 novembre, 22 h 39 (Elisa : « Dans le profil du joueur, précisez le niveau ») : le niveau SQL de chaque joueur (1 à 5, ses leçons
-- validées : Explorateur·rice SQL … SELECT * FROM légende), envoyé par l'appli avec son pseudo quand il change (jeu_niveau), comme le
-- pays (jeu_pays), et montré dans le profil du joueur (jeu_niveaux, comme jeu_drapeaux). « Supprimer mon compte » l'efface avec le
-- pseudo (compte_supprimer supprime la ligne de jeu_pseudo).

alter table public.jeu_pseudo add column if not exists niveau smallint;
alter table public.jeu_pseudo drop constraint if exists jeu_pseudo_niveau_check;
alter table public.jeu_pseudo add constraint jeu_pseudo_niveau_check check (niveau between 1 and 5);

create or replace function public.jeu_niveau(p_cle text, p_niveau integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_niveau smallint := case when p_niveau between 1 and 5 then p_niveau::smallint end;
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  if v_niveau is null then raise exception 'niveau invalide' using errcode = '22023'; end if;
  if not exists (select 1 from public.jeu_pseudo where cle = v_cle) then
    return jsonb_build_object('ok', false, 'raison', 'pseudo');
  end if;
  update public.jeu_pseudo set niveau = v_niveau where cle = v_cle and niveau is distinct from v_niveau;
  return jsonb_build_object('ok', true, 'niveau', v_niveau);
end;
$$;

create or replace function public.jeu_niveaux(p_pseudos text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('q', q.v, 'pseudo', p.pseudo, 'niveau', p.niveau) order by q.v), '[]'::jsonb)
  from (
    select distinct x as v
    from unnest((coalesce(p_pseudos, '{}'::text[]))[1:50]) as x
    where char_length(x) between 2 and 40
  ) q
  join public.jeu_pseudo p on p.norme = public.jeu_pseudo_norme(public.jeu_pseudo_forme(q.v))
  where p.niveau is not null;
$$;

revoke all on function public.jeu_niveau(text, integer) from public, anon, authenticated;
revoke all on function public.jeu_niveaux(text[]) from public, anon, authenticated;
grant execute on function public.jeu_niveau(text, integer) to anon, authenticated;
grant execute on function public.jeu_niveaux(text[]) to anon, authenticated;
