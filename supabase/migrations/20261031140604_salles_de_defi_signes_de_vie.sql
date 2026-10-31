-- Les signes de vie et les réactions sont gardés aussi, mais seulement 90 s dans l’historique (puis effacés au ménage) :
-- un téléphone dont le direct (WebSocket) est bloqué peut ainsi suivre la salle en relisant l’historique toutes les 2,5 s.
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
  insert into public.jeu_msg (salle, n, m, cree) values (p_salle, v_n, p_m, v_now);
  perform realtime.send(jsonb_build_object('n', v_n, 'at', v_at, 'm', p_m), 'm', 'salle:' || p_salle, false);
  return jsonb_build_object('n', v_n, 'at', v_at);
end;
$$;

-- Relire une salle après le numéro p_apres : tout ce qui est gardé, sauf les signes de vie et réactions de plus de 90 s
-- (500 messages au plus par appel, dans l’ordre).
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
    and (j.m->>'t' not in ('ping', 'react') or j.cree > now() - interval '90 seconds')
  order by j.n
  limit 500;
$$;

create or replace function public.jeu_menage()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.jeu_salle where maj < now() - interval '24 hours';
  delete from public.jeu_msg where cree < now() - interval '24 hours';
  delete from public.jeu_msg where m->>'t' in ('ping', 'react') and cree < now() - interval '10 minutes';
  delete from realtime.messages where topic like 'salle:%' and inserted_at < now() - interval '24 hours';
$$;

revoke all on function public.jeu_envoyer(text, jsonb) from public, anon, authenticated;
revoke all on function public.jeu_historique(text, integer) from public, anon, authenticated;
revoke all on function public.jeu_menage() from public, anon, authenticated;
grant execute on function public.jeu_envoyer(text, jsonb) to anon, authenticated;
grant execute on function public.jeu_historique(text, integer) to anon, authenticated;
