-- La salle dans l'île dans la langue de chacun (Elisa, 15 novembre, 17 h 45 : « corrige stp », pour « l'alerte “@léa entre dans la
-- salle” est en français pour tout le monde, et le nom du défi s'affiche dans la langue de celui qui l'envoie »).
-- Chaque téléphone donne sa langue avec le jeton de sa Live Activity (p_langue : 'fr', 'en'…) ; jeu_ile_cibles_v2 la rend avec
-- chaque jeton, et la fonction jeu-ile écrit l'alerte et le nom du défi dans cette langue. Une version d'avant ne donne pas de
-- langue : le français, comme avant (la langue déjà connue d'un jeton est gardée).
alter table requete_private.ile add column if not exists langue text check (langue is null or langue ~ '^[a-z]{2}$');

-- Une seule fonction (pas deux à trois et quatre paramètres : l'API ne saurait laquelle appeler) ; p_langue facultatif.
drop function if exists public.jeu_ile_jeton_v2(text, text, text);
create function public.jeu_ile_jeton_v2(p_cle text, p_salle text, p_jeton text, p_langue text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid text := (public.jeu_identite_v2(p_cle))->>'pid';
  v_langue text := case when p_langue ~ '^[a-z]{2}$' then p_langue end;
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
  insert into requete_private.ile (code, pid, jeton, langue) values (p_salle, v_pid, p_jeton, v_langue)
  on conflict (code, pid) do update set jeton = excluded.jeton, bac = false, maj = clock_timestamp(),
    langue = coalesce(excluded.langue, requete_private.ile.langue);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.jeu_ile_jeton_v2(text, text, text, text) from public, anon, authenticated;
grant execute on function public.jeu_ile_jeton_v2(text, text, text, text) to anon, authenticated;

-- Les jetons des autres joueurs, avec leur langue (le français sans elle).
create or replace function public.jeu_ile_cibles_v2(p_cle text, p_salle text, p_etat jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid text := (public.jeu_identite_v2(p_cle))->>'pid';
  v_avant jsonb;
  v_cibles jsonb;
begin
  if p_salle is null or p_salle !~ '^[A-Z0-9]{6}$' or p_etat is null or jsonb_typeof(p_etat) <> 'object'
     or octet_length(p_etat::text) > 3500 then
    raise exception 'demande invalide' using errcode = '22023';
  end if;
  if not exists (select 1 from requete_private.membre m where m.code = p_salle and m.pid = v_pid and not m.parti) then
    raise exception 'pas dans cette salle' using errcode = '42501';
  end if;
  select e.etat into v_avant from requete_private.ile_etat e where e.code = p_salle for update;
  if v_avant is not null and v_avant = p_etat then
    return jsonb_build_object('pareil', true, 'cibles', '[]'::jsonb);
  end if;
  insert into requete_private.ile_etat (code, etat) values (p_salle, p_etat)
  on conflict (code) do update set etat = excluded.etat, maj = clock_timestamp();
  select coalesce(jsonb_agg(jsonb_build_object('jeton', i.jeton, 'bac', i.bac, 'langue', coalesce(i.langue, 'fr'))), '[]'::jsonb) into v_cibles
  from requete_private.ile i
  join requete_private.membre m on m.code = i.code and m.pid = i.pid
  where i.code = p_salle and i.pid <> v_pid and not m.parti;
  return jsonb_build_object('pareil', false, 'cibles', v_cibles);
end $$;
