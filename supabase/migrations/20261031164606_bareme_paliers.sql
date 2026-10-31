-- Barème en paliers (Elisa, 31 octobre, 17 h 39) : le défi vaut 200 points trouvé en 1 min au plus, 175 de 1 à 2 min, 150 de 2 à
-- 3 min, 125 de 3 à 4 min, 100 de 4 à 5 min, 75 de 5 à 7 min, 50 au-delà (la manche s’arrête à 10 min) ; +25 si la première requête
-- exécutée est la bonne ; entre amis +50 / +30 / +20 / +10 du 1er au 4e à trouver. Une manche trouvée vaut donc de 50 à 225 points
-- seul, et jusqu’à 275 entre amis : jeu_score accepte ces bornes (le reste ne change pas).

create or replace function public.jeu_score(p_cle text, p_pseudo text, p_partie jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_pseudo text := public.jeu_pseudo_net(p_pseudo);
  v_u text := p_partie->>'u';
  v_pts integer;
  v_n integer;
  v_ok integer;
  v_solo boolean;
  v_niv text := coalesce(p_partie->>'niv', 'f');
  v_id uuid;
  v_avant text;
  v_total integer;
  v_parties integer;
  v_res text;
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  if jsonb_typeof(p_partie) <> 'object' then raise exception 'partie invalide' using errcode = '22023'; end if;
  begin
    v_pts := (p_partie->>'pts')::integer;
    v_n := (p_partie->>'n')::integer;
    v_ok := (p_partie->>'ok')::integer;
    v_solo := coalesce((p_partie->>'solo')::integer, 0) = 1;
  exception when others then
    raise exception 'partie invalide' using errcode = '22023';
  end;
  if v_u is null or v_u !~ '^[A-Za-z0-9]{6,24}$' or v_n is null or v_n not between 1 and 5 or v_ok is null or v_ok not between 0 and v_n
     or v_pts is null or v_pts < v_ok * 50 or v_pts > v_ok * (case when v_solo then 225 else 275 end) or v_niv not in ('f', 'm', 'd') then
    raise exception 'partie invalide' using errcode = '22023';
  end if;

  select pseudo into v_res from public.jeu_pseudo where cle = v_cle;
  if v_res is null then
    insert into public.jeu_pseudo (cle, pseudo, norme) values (v_cle, v_pseudo, public.jeu_pseudo_norme(v_pseudo)) on conflict do nothing;
    select pseudo into v_res from public.jeu_pseudo where cle = v_cle;
    if v_res is null then raise exception 'pseudo déjà pris' using errcode = '23505', hint = 'pseudo'; end if;
  end if;
  v_pseudo := v_res;
  update public.jeu_pseudo set vu = now() where cle = v_cle;

  select id, pseudo into v_id, v_avant from public.jeu_joueur where cle = v_cle;
  if v_id is null then
    if (select count(*) from public.jeu_joueur where cree > now() - interval '1 minute') >= 60 then
      raise exception 'trop de nouveaux joueurs en ce moment' using errcode = '54000';
    end if;
    insert into public.jeu_joueur (cle, pseudo) values (v_cle, v_pseudo) returning id into v_id;
  elsif v_avant is distinct from v_pseudo then
    update public.jeu_joueur set pseudo = v_pseudo, masque = false where id = v_id;
    delete from public.jeu_signalement where joueur = v_id;
  end if;

  if (select count(*) from public.jeu_partie where joueur = v_id and cree > now() - interval '1 hour') >= 40
     or (select count(*) from public.jeu_partie where cree > now() - interval '1 minute') >= 600 then
    raise exception 'trop de parties en ce moment' using errcode = '54000';
  end if;

  insert into public.jeu_partie (joueur, u, pts, n, ok, solo, niv)
  values (v_id, v_u, v_pts, v_n, v_ok, v_solo, v_niv)
  on conflict do nothing;
  if found then
    update public.jeu_joueur
    set pts = pts + v_pts, parties = parties + 1, best = greatest(best, v_pts), maj = now()
    where id = v_id
    returning pts, parties into v_total, v_parties;
  else
    select pts, parties into v_total, v_parties from public.jeu_joueur where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'pts', v_total, 'parties', v_parties,
    'rang', (select count(*) + 1 from public.jeu_joueur o where not o.masque and o.pts > v_total));
end;
$$;

revoke all on function public.jeu_score(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.jeu_score(text, text, jsonb) to anon, authenticated;
