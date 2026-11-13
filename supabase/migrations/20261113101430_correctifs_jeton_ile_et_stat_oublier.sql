-- Correctifs avant la mise en production (Elisa, 13 novembre, 11 h 07 : « pas de bug côté code et Supabase, tout est ok ? » ;
-- accord pour la base de production le même jour).
--
-- 1. Le jeton de la Live Activity d'une salle n'était jamais gardé. « {16,400} » dépasse la limite des expressions régulières de
--    Postgres (255 répétitions) : la fonction et la contrainte de la table échouaient à l'exécution (« invalid regular
--    expression: invalid repetition count(s) », 17 appels sur 17 le 12 novembre ; la table est restée vide). La forme du jeton et
--    sa longueur sont maintenant contrôlées séparément.
alter table requete_private.ile drop constraint if exists ile_jeton_check;
alter table requete_private.ile add constraint ile_jeton_check check (jeton ~ '^[0-9a-f]+$' and length(jeton) between 16 and 400);

create or replace function public.jeu_ile_jeton_v2(p_cle text, p_salle text, p_jeton text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid text := (public.jeu_identite_v2(p_cle))->>'pid';
begin
  if p_salle is null or p_salle !~ '^[A-Z0-9]{6}$' then
    raise exception 'salle invalide' using errcode = '22023';
  end if;
  if p_jeton is null then
    delete from requete_private.ile where code = p_salle and pid = v_pid;
    return jsonb_build_object('ok', true);
  end if;
  if p_jeton !~ '^[0-9a-f]+$' or length(p_jeton) not between 16 and 400 then
    raise exception 'jeton invalide' using errcode = '22023';
  end if;
  if not exists (select 1 from requete_private.membre m where m.code = p_salle and m.pid = v_pid) then
    raise exception 'pas dans cette salle' using errcode = '42501';
  end if;
  insert into requete_private.ile (code, pid, jeton) values (p_salle, v_pid, p_jeton)
  on conflict (code, pid) do update set jeton = excluded.jeton, bac = false, maj = clock_timestamp();
  return jsonb_build_object('ok', true);
end $$;

-- 2. stat_oublier n'existait pas : l'appli l'appelle depuis le 10 novembre (« Supprimer mon compte », et l'interrupteur des
--    statistiques qu'on coupe) pour effacer les statistiques anonymes de l'appareil, comme le dit la politique de
--    confidentialité ; chaque appel répondait 404, les statistiques restaient. Même empreinte brouillée que stat_noter.
create or replace function public.stat_oublier(p_cle text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  n integer;
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  delete from requete_private.stat_evenement
   where appareil = encode(extensions.digest(v_cle || ':stat', 'sha256'), 'hex');
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'n', n);
end; $$;
revoke all on function public.stat_oublier(text) from public, anon, authenticated;
grant execute on function public.stat_oublier(text) to anon, authenticated;
