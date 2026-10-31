-- Classement général des défis (appli Requête) : le Top 5 de tous les joueurs, pas seulement des amis.
-- Sans compte : chaque appareil tire une clé secrète au hasard (gardée dans sa progression) ; la base n’en garde que l’empreinte
-- (SHA-256). Le classement montre un identifiant public, le pseudo, les points et le nombre de parties.
-- Pour l’App Store (contenu créé par les joueurs, règle 1.2) : les pseudos sont filtrés (jeu_pseudo_ok), chaque joueur peut en
-- signaler un (masqué du classement après 3 signalements, à revoir dans la vue jeu_moderation), et chacun peut effacer ses données
-- (jeu_oublier). Comme pour les salles, rien n’est lisible ni modifiable directement : on passe par les fonctions.
--
-- Alertes attendues du conseiller de sécurité : « RLS Enabled No Policy » (voulu) et « Public Can Execute SECURITY DEFINER
-- Function » sur jeu_score, jeu_renommer, jeu_classement, jeu_signaler, jeu_oublier (voulu : ce sont les portes d’entrée, et elles
-- vérifient ce qu’elles reçoivent).

create table public.jeu_joueur (
  id uuid primary key default gen_random_uuid(),
  cle text not null unique,                       -- empreinte SHA-256 (hex) de la clé secrète de l’appareil
  pseudo text not null,
  pts integer not null default 0,
  parties integer not null default 0,
  best integer not null default 0,
  masque boolean not null default false,          -- masqué du classement (3 signalements)
  cree timestamptz not null default now(),
  maj timestamptz not null default now()
);
create index jeu_joueur_pts on public.jeu_joueur (pts desc, maj) where not masque;
create index jeu_joueur_cree on public.jeu_joueur (cree);

-- Les parties comptées : une seule fois chacune (identifiant u), et de quoi limiter les envois.
create table public.jeu_partie (
  joueur uuid not null references public.jeu_joueur (id) on delete cascade,
  u text not null,
  pts integer not null,
  n smallint not null,
  ok smallint not null,
  solo boolean not null,
  niv text not null,
  cree timestamptz not null default now(),
  primary key (joueur, u)
);
create index jeu_partie_cree on public.jeu_partie (cree);
create index jeu_partie_joueur_cree on public.jeu_partie (joueur, cree);

create table public.jeu_signalement (
  joueur uuid not null references public.jeu_joueur (id) on delete cascade,
  par uuid not null references public.jeu_joueur (id) on delete cascade,
  pseudo text not null,                           -- le pseudo signalé, tel qu’il était
  cree timestamptz not null default now(),
  primary key (joueur, par)
);
create index jeu_signalement_par on public.jeu_signalement (par, cree);

alter table public.jeu_joueur enable row level security;
alter table public.jeu_partie enable row level security;
alter table public.jeu_signalement enable row level security;
revoke all on table public.jeu_joueur, public.jeu_partie, public.jeu_signalement from anon, authenticated;

-- Un pseudo acceptable ? Minuscules sans accents, chiffres lus comme des lettres (0 → o, 1 → i, 3 → e, 4 → a, 5 → s, 7 → t…).
-- Les mots longs sont refusés où qu’ils soient ; les mots courts seulement en mot entier (pour ne pas refuser « Kinoshita »).
-- La même liste est dans l’appli (JEU_PSEUDO_LONGS, JEU_PSEUDO_COURTS) : un test vérifie qu’elles restent identiques.
create or replace function public.jeu_pseudo_ok(p_pseudo text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := lower(coalesce(p_pseudo, ''));
  v_colle text;
  v_mots text[];
begin
  v := translate(v, 'àâäáãåāçćčéèêëēęíìîïīñńóòôöõøōúùûüūýÿœæß', 'aaaaaaaccceeeeeeiiiiinnooooooouuuuuyyoas');
  v := translate(v, '0134578@$!|€', 'oieastbasiie');
  v_colle := regexp_replace(v, '[^a-z]', '', 'g');
  if v_colle ~ '(connard|connasse|salope|encul|batard|niquer|niktamer|ntamere|tamere|bougnoul|youpin|nigger|nigga|faggot|hitler|pedoph|tapette|gouine|bitch|fuck|whore|asshole|motherf|putain|enfoire|branleur|branlette|porno|pornhub|sodomi|zoophil|nazisme|chinetoque|bamboula|terroris|jihad|suicid)' then
    return false;
  end if;
  select array_agg(m) into v_mots
  from regexp_split_to_table(regexp_replace(v, '[^a-z]+', ' ', 'g'), ' ') as m
  where m <> '';
  if v_mots && array['con','cons','conne','connes','pute','putes','pd','pds','pede','pedes','fdp','ntm','tg','bite','bites','cul','sexe','sex','sexy','merde','nazi','nazis','kkk','sucer','suce','suceur','chatte','couille','couilles','dick','cock','pussy','porn','fag','fags','retard','nique','viol','violer','violeur','fion','zizi','teub','ass','tits','boobs','shit','cunt','slut','negre','negres','negro','bordel','daech','pedo','salaud'] then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.jeu_cle(p_cle text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_cle ~ '^[A-Za-z0-9]{24,64}$' then encode(extensions.digest(p_cle, 'sha256'), 'hex') end;
$$;

create or replace function public.jeu_pseudo_net(p_pseudo text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(regexp_replace(coalesce(p_pseudo, ''), '\s+', ' ', 'g'));
begin
  if char_length(v) not between 1 and 16 or v ~ '[[:cntrl:]<>]' then
    raise exception 'pseudo invalide' using errcode = '22023';
  end if;
  if not public.jeu_pseudo_ok(v) then
    raise exception 'pseudo refusé' using errcode = '22023', hint = 'pseudo';
  end if;
  return v;
end;
$$;

-- Une partie terminée : ses points s’ajoutent (une seule fois par partie), dans les limites du barème
-- (100 par manche trouvée, +50 au premier entre amis, +60 de rapidité au plus).
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
     or v_pts is null or v_pts < v_ok * 100 or v_pts > v_ok * (case when v_solo then 160 else 210 end) or v_niv not in ('f', 'm', 'd') then
    raise exception 'partie invalide' using errcode = '22023';
  end if;

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

-- Nouveau pseudo choisi dans l’appli (le classement suit tout de suite) : les signalements de l’ancien pseudo sont effacés.
create or replace function public.jeu_renommer(p_cle text, p_pseudo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_pseudo text := public.jeu_pseudo_net(p_pseudo);
  v_id uuid;
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  update public.jeu_joueur set pseudo = v_pseudo, masque = false, maj = now()
  where cle = v_cle and pseudo is distinct from v_pseudo
  returning id into v_id;
  if v_id is not null then delete from public.jeu_signalement where joueur = v_id; end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Le classement : les 12 premiers (l’appli en montre 5, sans ceux que le joueur a masqués), le nombre de joueurs classés,
-- et la place du joueur qui demande.
create or replace function public.jeu_classement(p_cle text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_top jsonb;
  v_moi jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'pseudo', t.pseudo, 'pts', t.pts, 'parties', t.parties, 'rang', t.rang) order by t.pts desc, t.maj), '[]'::jsonb)
  into v_top
  from (
    select j.id, j.pseudo, j.pts, j.parties, j.maj, rank() over (order by j.pts desc) as rang
    from public.jeu_joueur j
    where not j.masque and j.pts > 0
    order by j.pts desc, j.maj
    limit 12
  ) t;
  if v_cle is not null then
    select jsonb_build_object('id', j.id, 'pseudo', j.pseudo, 'pts', j.pts, 'parties', j.parties, 'masque', j.masque,
      'rang', (select count(*) + 1 from public.jeu_joueur o where not o.masque and o.pts > j.pts))
    into v_moi
    from public.jeu_joueur j where j.cle = v_cle;
  end if;
  return jsonb_build_object('top', v_top, 'moi', v_moi,
    'total', (select count(*) from public.jeu_joueur where not masque and pts > 0));
end;
$$;

-- Signaler un pseudo (il faut avoir joué au moins une partie) : 3 signalements différents le masquent du classement.
create or replace function public.jeu_signaler(p_cle text, p_joueur uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_par uuid;
  v_pseudo text;
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  select id into v_par from public.jeu_joueur where cle = v_cle;
  if v_par is null then raise exception 'joue une partie avant de signaler' using errcode = '42501'; end if;
  if v_par = p_joueur then return jsonb_build_object('ok', false); end if;
  if (select count(*) from public.jeu_signalement where par = v_par and cree > now() - interval '1 day') >= 20 then
    raise exception 'trop de signalements' using errcode = '54000';
  end if;
  select pseudo into v_pseudo from public.jeu_joueur where id = p_joueur;
  if v_pseudo is null then return jsonb_build_object('ok', false); end if;
  insert into public.jeu_signalement (joueur, par, pseudo) values (p_joueur, v_par, v_pseudo) on conflict do nothing;
  if (select count(*) from public.jeu_signalement where joueur = p_joueur) >= 3 then
    update public.jeu_joueur set masque = true where id = p_joueur;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Effacer ses données du classement (pseudo, points, parties, signalements).
create or replace function public.jeu_oublier(p_cle text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  delete from public.jeu_joueur where cle = v_cle;
  return jsonb_build_object('ok', true);
end;
$$;

-- Pour la modération (tableau de bord Supabase, éditeur SQL) : les pseudos signalés, du plus signalé au moins signalé.
create or replace view public.jeu_moderation with (security_invoker = true) as
  select j.id, j.pseudo, j.pts, j.masque, count(s.par) as signalements, max(s.cree) as dernier
  from public.jeu_joueur j join public.jeu_signalement s on s.joueur = j.id
  group by j.id
  order by count(s.par) desc, max(s.cree) desc;
revoke all on public.jeu_moderation from anon, authenticated;

revoke all on function public.jeu_pseudo_ok(text) from public, anon, authenticated;
revoke all on function public.jeu_cle(text) from public, anon, authenticated;
revoke all on function public.jeu_pseudo_net(text) from public, anon, authenticated;
revoke all on function public.jeu_score(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.jeu_renommer(text, text) from public, anon, authenticated;
revoke all on function public.jeu_classement(text) from public, anon, authenticated;
revoke all on function public.jeu_signaler(text, uuid) from public, anon, authenticated;
revoke all on function public.jeu_oublier(text) from public, anon, authenticated;
grant execute on function public.jeu_score(text, text, jsonb) to anon, authenticated;
grant execute on function public.jeu_renommer(text, text) to anon, authenticated;
grant execute on function public.jeu_classement(text) to anon, authenticated;
grant execute on function public.jeu_signaler(text, uuid) to anon, authenticated;
grant execute on function public.jeu_oublier(text) to anon, authenticated;
