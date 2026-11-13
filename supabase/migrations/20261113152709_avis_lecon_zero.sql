-- Les avis de leçon n’arrivaient jamais (Elisa, 13 novembre, 16 h 19 : « Est-ce que je vais recevoir ? Par mail »). La 1re leçon
-- (« Les bases de données relationnelles ») porte le numéro 0, mais avis_lecon et lecon_noter n’acceptaient que 1 à 99 999 :
-- l’avis sur la leçon 0 revenait { ok: false, raison: 'invalide' }, et comme l’appli envoie les avis dans l’ordre des leçons, il
-- restait en tête de file et bloquait tous les suivants. On accepte désormais 0 à 99 999 ; rien d’autre ne change.
alter table public.avis_lecon drop constraint if exists avis_lecon_lecon_check;
alter table public.avis_lecon add constraint avis_lecon_lecon_check check (lecon between 0 and 99999);

create or replace function public.lecon_noter(p_cle text, p_lecon integer, p_note integer, p_titre text default null, p_commentaire text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_titre text := nullif(left(btrim(regexp_replace(coalesce(p_titre, ''), '[[:cntrl:][:space:]]+', ' ', 'g')), 120), '');
  v_commentaire text := nullif(left(btrim(regexp_replace(coalesce(p_commentaire, ''), '[[:cntrl:][:space:]]+', ' ', 'g')), 500), '');
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  if p_lecon is null or p_lecon not between 0 and 99999 or p_note is null or p_note not between 1 and 5 then
    return jsonb_build_object('ok', false, 'raison', 'invalide');
  end if;
  if (select count(*) from public.avis_lecon where note_le > now() - interval '1 hour') >= 5000 then
    return jsonb_build_object('ok', false, 'raison', 'trop');
  end if;
  insert into public.avis_lecon as a (cle, lecon, titre, note, commentaire) values (v_cle, p_lecon, v_titre, p_note, v_commentaire)
  on conflict (cle, lecon) do update set note = excluded.note, titre = coalesce(excluded.titre, a.titre), commentaire = excluded.commentaire, note_le = now();
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.lecon_noter(text, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.lecon_noter(text, integer, integer, text, text) to anon, authenticated;
