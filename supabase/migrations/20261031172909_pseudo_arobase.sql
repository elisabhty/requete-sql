-- Le pseudo en identifiant (Elisa, 31 octobre, 18 h 22 : « ne pas pouvoir mettre de majuscules, tout sera en minuscules avec un @ au
-- début, et faire attention aux espaces ») : @ puis 15 caractères au plus, en minuscules — lettres (accents compris), chiffres, point,
-- tiret bas, tiret — sans espace. jeu_pseudo_forme le met sous cette forme ; la réservation, la vérification, les idées et le
-- classement s’en servent. Les pseudos déjà réservés passent sous cette forme (la norme, qui fait l’unicité, ne change pas).

create or replace function public.jeu_pseudo_forme(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when h = '' then '' else '@' || h end
  from (select left(regexp_replace(lower(coalesce(p, '')), '[^a-z0-9àâäáãåāçćčéèêëēęíìîïīñńóòôöõøōúùûüūýÿœæß._-]', '', 'g'), 15) as h) x;
$$;

-- Trois pseudos libres, proches de celui qu’on voulait : un suffixe SQL (« @lea_sql », « @lea.db »…), sinon un nombre.
create or replace function public.jeu_pseudo_idees(p_pseudo text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_base text := substr(public.jeu_pseudo_forme(p_pseudo), 2);
  v_out text[] := '{}';
  v_s text;
  v_c text;
  i integer;
begin
  if char_length(v_base) = 0 or not public.jeu_pseudo_ok(v_base) then v_base := 'joueur'; end if;
  for v_s in select s from unnest(array['_sql', '.db', '_select', '_join', '_data', '_query', '.dev', '_index']) as s order by random() loop
    exit when cardinality(v_out) >= 3;
    v_c := '@' || left(v_base, 15 - char_length(v_s)) || v_s;
    if public.jeu_pseudo_ok(v_c) and not (v_c = any(v_out))
       and not exists (select 1 from public.jeu_pseudo where norme = public.jeu_pseudo_norme(v_c)) then
      v_out := v_out || v_c;
    end if;
    exit when cardinality(v_out) >= 2;  -- deux suffixes au plus, le troisième est un nombre
  end loop;
  for i in 1..30 loop
    exit when cardinality(v_out) >= 3;
    v_c := '@' || left(v_base, 12) || (10 + floor(random() * 990))::integer::text;
    if public.jeu_pseudo_ok(v_c) and not (v_c = any(v_out))
       and not exists (select 1 from public.jeu_pseudo where norme = public.jeu_pseudo_norme(v_c)) then
      v_out := v_out || v_c;
    end if;
  end loop;
  return to_jsonb(v_out);
end;
$$;

-- Ce pseudo est-il libre ? (pour l’appareil qui demande : le sien compte comme libre)
create or replace function public.jeu_pseudo_libre(p_pseudo text, p_cle text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v text := public.jeu_pseudo_forme(p_pseudo);
  v_cle text := public.jeu_cle(p_cle);
  v_qui text;
begin
  if char_length(v) < 2 then
    return jsonb_build_object('ok', false, 'raison', 'invalide', 'idees', '[]'::jsonb);
  end if;
  if not public.jeu_pseudo_ok(v) then
    return jsonb_build_object('ok', false, 'raison', 'refuse', 'idees', public.jeu_pseudo_idees(null));
  end if;
  select cle into v_qui from public.jeu_pseudo where norme = public.jeu_pseudo_norme(v);
  if v_qui is null or v_qui = v_cle then
    return jsonb_build_object('ok', true, 'pseudo', v);
  end if;
  return jsonb_build_object('ok', false, 'raison', 'pris', 'idees', public.jeu_pseudo_idees(v));
end;
$$;

-- Réserver son pseudo : une seule fois par appareil. Déjà réservé : on rend le sien (il ne se change plus) et on note la visite.
create or replace function public.jeu_pseudo_prendre(p_cle text, p_pseudo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v text := public.jeu_pseudo_forme(p_pseudo);
  v_deja text;
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  select pseudo into v_deja from public.jeu_pseudo where cle = v_cle;
  if v_deja is not null then
    update public.jeu_pseudo set vu = now() where cle = v_cle and vu < now() - interval '1 hour';
    return jsonb_build_object('ok', true, 'pseudo', v_deja);
  end if;
  if char_length(v) < 2 then
    return jsonb_build_object('ok', false, 'raison', 'invalide', 'idees', '[]'::jsonb);
  end if;
  if not public.jeu_pseudo_ok(v) then
    return jsonb_build_object('ok', false, 'raison', 'refuse', 'idees', public.jeu_pseudo_idees(null));
  end if;
  if (select count(*) from public.jeu_pseudo where cree > now() - interval '1 minute') >= 60 then
    raise exception 'trop de nouveaux joueurs en ce moment' using errcode = '54000';
  end if;
  insert into public.jeu_pseudo (cle, pseudo, norme) values (v_cle, v, public.jeu_pseudo_norme(v)) on conflict do nothing;
  select pseudo into v_deja from public.jeu_pseudo where cle = v_cle;
  if v_deja is null then
    return jsonb_build_object('ok', false, 'raison', 'pris', 'idees', public.jeu_pseudo_idees(v));
  end if;
  update public.jeu_joueur set pseudo = v_deja where cle = v_cle;
  return jsonb_build_object('ok', true, 'pseudo', v_deja);
end;
$$;

-- Une partie terminée : le pseudo réservé fait foi (une ancienne version de l’appli réserve, sous sa forme d’identifiant, celui
-- qu’elle envoie s’il est libre).
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
    -- Une ancienne version de l’appli, sans réservation : le pseudo envoyé, sous sa forme d’identifiant.
    v_pseudo := public.jeu_pseudo_forme(v_pseudo);
    if char_length(v_pseudo) < 2 then raise exception 'pseudo invalide' using errcode = '22023', hint = 'pseudo'; end if;
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

-- Les pseudos déjà réservés, et ceux du classement, sous leur forme d’identifiant.
update public.jeu_pseudo set pseudo = public.jeu_pseudo_forme(pseudo)
  where char_length(public.jeu_pseudo_forme(pseudo)) >= 2 and pseudo <> public.jeu_pseudo_forme(pseudo);
update public.jeu_joueur j set pseudo = p.pseudo from public.jeu_pseudo p where p.cle = j.cle and j.pseudo <> p.pseudo;

revoke all on function public.jeu_pseudo_forme(text) from public, anon, authenticated;
revoke all on function public.jeu_pseudo_idees(text) from public, anon, authenticated;
revoke all on function public.jeu_pseudo_libre(text, text) from public, anon, authenticated;
revoke all on function public.jeu_pseudo_prendre(text, text) from public, anon, authenticated;
revoke all on function public.jeu_score(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.jeu_pseudo_libre(text, text) to anon, authenticated;
grant execute on function public.jeu_pseudo_prendre(text, text) to anon, authenticated;
grant execute on function public.jeu_score(text, text, jsonb) to anon, authenticated;
