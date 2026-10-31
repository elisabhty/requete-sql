-- Salles de défi entre amis (appli Requête). Une salle = un code de 6 caractères.
-- On y échange le pseudo, la présence, les manches, les temps et les réactions des joueurs (jamais leurs requêtes).
-- Rien n’est lisible ni modifiable directement : on passe par jeu_envoyer, jeu_historique et jeu_balise.
-- Tout s’efface au bout de 24 h (tâche planifiée jeu-menage).
-- Appliquée au projet Supabase « requete-sql » (ynuenrxozcpkrjdbeftc, Paris) le 31 octobre 2026.
--
-- Alertes attendues du conseiller de sécurité de Supabase :
--   « RLS Enabled No Policy » sur jeu_salle et jeu_msg : voulu, personne ne lit ni n’écrit ces tables directement ;
--   « Public Can Execute SECURITY DEFINER Function » sur jeu_envoyer, jeu_historique, jeu_balise : voulu, ce sont
--   les trois seules portes d’entrée, et elles vérifient ce qu’elles reçoivent (code de salle, taille, rafales).

create table public.jeu_salle (
  salle text primary key check (salle ~ '^[A-Z0-9]{6}$'),
  n integer not null default 1,                          -- numéro du dernier message de la salle
  fen timestamptz not null default clock_timestamp(),    -- début de la fenêtre anti-rafale (10 s)
  nb integer not null default 1,                         -- messages dans cette fenêtre
  cree timestamptz not null default clock_timestamp(),
  maj timestamptz not null default clock_timestamp()
);
create index jeu_salle_cree on public.jeu_salle (cree);
create index jeu_salle_maj on public.jeu_salle (maj);

-- Messages gardés pour ceux qui arrivent ou reviennent (les signes de vie et les réactions ne sont pas gardés).
create table public.jeu_msg (
  salle text not null references public.jeu_salle (salle) on delete cascade,
  n integer not null,
  m jsonb not null,
  cree timestamptz not null default clock_timestamp(),
  primary key (salle, n)
);
create index jeu_msg_cree on public.jeu_msg (cree);

alter table public.jeu_salle enable row level security;
alter table public.jeu_msg enable row level security;
revoke all on table public.jeu_salle, public.jeu_msg from anon, authenticated;

-- Envoyer un message dans une salle : numéroté dans l’ordre d’arrivée (le même pour tous), daté par le serveur,
-- puis diffusé en direct sur le canal public « salle:CODE ».
create or replace function public.jeu_envoyer(p_salle text, p_m jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t text := p_m->>'t';
  v_n integer;
  v_nb integer;
  v_now timestamptz;
  v_at bigint;
begin
  if p_salle is null or p_salle !~ '^[A-Z0-9]{6}$' then
    raise exception 'salle invalide' using errcode = '22023';
  end if;
  if p_m is null or jsonb_typeof(p_m) <> 'object' or octet_length(p_m::text) > 2048
     or v_t is null or v_t !~ '^[a-z]{1,12}$' then
    raise exception 'message invalide' using errcode = '22023';
  end if;

  -- La ligne de la salle est verrouillée jusqu’à la fin : les messages d’une salle sont numérotés et diffusés un par un.
  insert into public.jeu_salle as s (salle) values (p_salle)
  on conflict (salle) do update set
    n = s.n + 1,
    nb = case when s.fen > clock_timestamp() - interval '10 seconds' then s.nb + 1 else 1 end,
    fen = case when s.fen > clock_timestamp() - interval '10 seconds' then s.fen else clock_timestamp() end,
    maj = clock_timestamp()
  returning s.n, s.nb into v_n, v_nb;

  if v_nb > 80 or v_n > 20000 then
    raise exception 'trop de messages dans cette salle' using errcode = '54000';
  end if;
  if v_n = 1 and (select count(*) from public.jeu_salle where cree > clock_timestamp() - interval '1 minute') > 120 then
    raise exception 'trop de salles ouvertes en ce moment' using errcode = '54000';
  end if;

  v_now := clock_timestamp();
  v_at := floor(extract(epoch from v_now) * 1000)::bigint;

  if v_t not in ('ping', 'react') then
    insert into public.jeu_msg (salle, n, m, cree) values (p_salle, v_n, p_m, v_now);
  end if;

  perform realtime.send(jsonb_build_object('n', v_n, 'at', v_at, 'm', p_m), 'm', 'salle:' || p_salle, false);
  return jsonb_build_object('n', v_n, 'at', v_at);
end;
$$;

-- Relire une salle : les messages gardés après le numéro p_apres (500 au plus par appel, dans l’ordre).
create or replace function public.jeu_historique(p_salle text, p_apres integer default 0)
returns table (n integer, at bigint, m jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select j.n, floor(extract(epoch from j.cree) * 1000)::bigint, j.m
  from public.jeu_msg j
  where j.salle = p_salle
    and j.n > coalesce(p_apres, 0)
    and j.cree > now() - interval '24 hours'
  order by j.n
  limit 500;
$$;

-- Dernier message en quittant la page (navigator.sendBeacon : texte brut {"salle":…,"m":…}). Les erreurs sont ignorées.
create or replace function public.jeu_balise(text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  v := $1::jsonb;
  perform public.jeu_envoyer(v->>'salle', v->'m');
exception when others then
  return;
end;
$$;

-- Ménage : salles et messages de plus de 24 h, y compris la copie gardée par la diffusion en direct.
create or replace function public.jeu_menage()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.jeu_salle where maj < now() - interval '24 hours';
  delete from public.jeu_msg where cree < now() - interval '24 hours';
  delete from realtime.messages where topic like 'salle:%' and inserted_at < now() - interval '24 hours';
$$;

revoke all on function public.jeu_envoyer(text, jsonb) from public, anon, authenticated;
revoke all on function public.jeu_historique(text, integer) from public, anon, authenticated;
revoke all on function public.jeu_balise(text) from public, anon, authenticated;
revoke all on function public.jeu_menage() from public, anon, authenticated;
grant execute on function public.jeu_envoyer(text, jsonb) to anon, authenticated;
grant execute on function public.jeu_historique(text, integer) to anon, authenticated;
grant execute on function public.jeu_balise(text) to anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule('jeu-menage', '23 * * * *', 'select public.jeu_menage()');
