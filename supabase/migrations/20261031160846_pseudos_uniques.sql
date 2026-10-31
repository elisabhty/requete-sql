-- Pseudos uniques et nouveau barème (Elisa, 31 octobre, 16 h 49 : « ne pas pouvoir changer de pseudo → intégration Supabase, pseudo
-- unique par personne, ou on propose un pseudo s’il est pris, choix du pseudo à la connexion » ; « la rapidité, c’est juste du bonus :
-- un nombre de points à la base qui baisse en fonction du temps, par exemple 200 à la base puis ça descend »).
--
-- Le pseudo se choisit dans l’onboarding ; jeu_pseudo le réserve pour l’appareil (l’empreinte de sa clé secrète, celle du classement,
-- qui voyage avec « Exporter ma progression »). Deux pseudos sont les mêmes sans accents, majuscules ni ponctuation (« Léa », « lea »,
-- « L.É.A »). Un pseudo réservé ne se change plus ; s’il est pris, la base en propose trois libres. Il est libéré au bout de 12 mois
-- sans ouverture de l’appli (avec les scores de l’appareil).
-- Barème : le défi vaut 200 points au départ, 100 à 3 min ; +50 / +30 / +15 aux trois premiers entre amis : 200 par manche trouvée
-- au plus seul, 250 entre amis.
--
-- Alertes attendues du conseiller de sécurité : « Public Can Execute SECURITY DEFINER Function » sur jeu_pseudo_libre et
-- jeu_pseudo_prendre (voulu : ce sont les portes d’entrée, elles vérifient ce qu’elles reçoivent), « RLS Enabled No Policy » sur
-- jeu_pseudo (voulu : rien n’est lisible directement).

create table public.jeu_pseudo (
  cle text primary key,                   -- empreinte SHA-256 (hex) de la clé secrète de l’appareil
  pseudo text not null,
  norme text not null unique,             -- le pseudo sans accents, majuscules ni ponctuation
  cree timestamptz not null default now(),
  vu timestamptz not null default now()   -- dernière ouverture de l’appli (au plus une fois par jour)
);
create index jeu_pseudo_cree on public.jeu_pseudo (cree);
create index jeu_pseudo_vu on public.jeu_pseudo (vu);
alter table public.jeu_pseudo enable row level security;
revoke all on table public.jeu_pseudo from anon, authenticated;

-- « Léa », « lea » et « L.É.A » : le même pseudo. Un pseudo sans lettre ni chiffre (des émojis) se compare tel quel, en minuscules.
create or replace function public.jeu_pseudo_norme(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(regexp_replace(translate(lower(btrim(coalesce(p, ''))), 'àâäáãåāçćčéèêëēęíìîïīñńóòôöõøōúùûüūýÿœæß', 'aaaaaaaccceeeeeeiiiiinnooooooouuuuuyyoas'), '[^a-z0-9]', '', 'g'), ''),
    lower(btrim(coalesce(p, ''))));
$$;

-- Trois pseudos libres, proches de celui qu’on voulait : un suffixe SQL (« Léa_sql », « Léa.db », « LéaSelect »…), sinon un nombre.
create or replace function public.jeu_pseudo_idees(p_pseudo text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_base text := btrim(regexp_replace(coalesce(p_pseudo, ''), '\s+', ' ', 'g'));
  v_out text[] := '{}';
  v_s text;
  v_c text;
  i integer;
begin
  if char_length(v_base) = 0 or v_base ~ '[[:cntrl:]<>]' or not public.jeu_pseudo_ok(v_base) then v_base := 'Joueur'; end if;
  for v_s in select s from unnest(array['_sql', '.db', 'Select', 'Join', '_data', 'Query', '.dev', 'Index']) as s order by random() loop
    exit when cardinality(v_out) >= 3;
    v_c := left(v_base, 16 - char_length(v_s)) || v_s;
    if public.jeu_pseudo_ok(v_c) and not (v_c = any(v_out))
       and not exists (select 1 from public.jeu_pseudo where norme = public.jeu_pseudo_norme(v_c)) then
      v_out := v_out || v_c;
    end if;
    exit when cardinality(v_out) >= 2;  -- deux suffixes au plus, le troisième est un nombre
  end loop;
  for i in 1..30 loop
    exit when cardinality(v_out) >= 3;
    v_c := left(v_base, 13) || (10 + floor(random() * 990))::integer::text;
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
  v text := btrim(regexp_replace(coalesce(p_pseudo, ''), '\s+', ' ', 'g'));
  v_cle text := public.jeu_cle(p_cle);
  v_qui text;
begin
  if char_length(v) not between 1 and 16 or v ~ '[[:cntrl:]<>]' then
    return jsonb_build_object('ok', false, 'raison', 'invalide', 'idees', '[]'::jsonb);
  end if;
  if not public.jeu_pseudo_ok(v) then
    return jsonb_build_object('ok', false, 'raison', 'refuse', 'idees', public.jeu_pseudo_idees(null));
  end if;
  select cle into v_qui from public.jeu_pseudo where norme = public.jeu_pseudo_norme(v);
  if v_qui is null or v_qui = v_cle then
    return jsonb_build_object('ok', true);
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
  v text := btrim(regexp_replace(coalesce(p_pseudo, ''), '\s+', ' ', 'g'));
  v_deja text;
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  select pseudo into v_deja from public.jeu_pseudo where cle = v_cle;
  if v_deja is not null then
    update public.jeu_pseudo set vu = now() where cle = v_cle and vu < now() - interval '1 hour';
    return jsonb_build_object('ok', true, 'pseudo', v_deja);
  end if;
  if char_length(v) not between 1 and 16 or v ~ '[[:cntrl:]<>]' then
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

-- Une partie terminée : nouveau barème, et le pseudo réservé fait foi (une ancienne version de l’appli, sans réservation, réserve
-- celui qu’elle envoie s’il est libre ; sinon : « pseudo déjà pris »).
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
     or v_pts is null or v_pts < v_ok * 100 or v_pts > v_ok * (case when v_solo then 200 else 250 end) or v_niv not in ('f', 'm', 'd') then
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

-- Le pseudo ne se change plus : jeu_renommer (anciennes versions de l’appli) remet au classement le pseudo réservé.
create or replace function public.jeu_renommer(p_cle text, p_pseudo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_res text;
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  select pseudo into v_res from public.jeu_pseudo where cle = v_cle;
  if v_res is not null then update public.jeu_joueur set pseudo = v_res where cle = v_cle; end if;
  return jsonb_build_object('ok', v_res is not null, 'pseudo', v_res);
end;
$$;

-- Ménage quotidien : un pseudo sans ouverture de l’appli depuis 12 mois est libéré, avec les scores de l’appareil.
create or replace function public.jeu_pseudo_menage()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.jeu_pseudo where vu < now() - interval '12 months';
  delete from public.jeu_joueur j where j.maj < now() - interval '12 months'
    and not exists (select 1 from public.jeu_pseudo p where p.cle = j.cle);
end;
$$;

revoke all on function public.jeu_pseudo_norme(text) from public, anon, authenticated;
revoke all on function public.jeu_pseudo_idees(text) from public, anon, authenticated;
revoke all on function public.jeu_pseudo_libre(text, text) from public, anon, authenticated;
revoke all on function public.jeu_pseudo_prendre(text, text) from public, anon, authenticated;
revoke all on function public.jeu_pseudo_menage() from public, anon, authenticated;
revoke all on function public.jeu_score(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.jeu_renommer(text, text) from public, anon, authenticated;
grant execute on function public.jeu_pseudo_libre(text, text) to anon, authenticated;
grant execute on function public.jeu_pseudo_prendre(text, text) to anon, authenticated;
grant execute on function public.jeu_score(text, text, jsonb) to anon, authenticated;
grant execute on function public.jeu_renommer(text, text) to anon, authenticated;

select cron.schedule('jeu-pseudo-menage', '41 3 * * *', 'select public.jeu_pseudo_menage()');
