-- Audit de sécurité avant la mise en ligne (Elisa, 11 novembre, 23 h 25 puis 23 h 38 : « corrige stp ce que tu as trouvé »).
--
-- 1. La salle dans l’île : l’alerte qu’un joueur fait pousser aux autres (l’île qui s’ouvre, l’écran verrouillé) n’est plus son texte à
--    lui. La fonction jeu-ile ne garde que les deux alertes de l’appli (« @léa entre dans la salle », « Fin de la partie ») et les
--    réécrit avec les pseudos que le serveur connaît ; une au plus toutes les 8 secondes par salle (jeu_ile_alerte_v2, pour la
--    fonction seulement). Avant, un joueur pouvait pousser n’importe quel texte, en boucle, aux autres joueurs de sa salle.
-- 2. Les signalements : un pseudo n’est masqué d’office qu’après 3 signalements de joueurs installés (leur fiche a plus d’un jour et
--    au moins une partie). Trois clés créées à la volée ne suffisent plus.
-- 3. Le parcours en tête des votes : seuls comptent les votes d’appareils vus il y a plus d’un jour (bienvenue ou partie) ; un vote
--    fabriqué à la chaîne n’entre pas dans le badge.

-- 1. L’alerte de l’île : la dernière envoyée, par salle
alter table requete_private.ile_etat add column if not exists alerte_le timestamptz;

create or replace function public.jeu_ile_alerte_v2(p_cle text, p_salle text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid text := (public.jeu_identite_v2(p_cle))->>'pid';
  v_ok boolean;
  v_noms jsonb;
begin
  if p_salle is null or p_salle !~ '^[A-Z0-9]{6}$' then
    raise exception 'demande invalide' using errcode = '22023';
  end if;
  if not exists (select 1 from requete_private.membre m where m.code = p_salle and m.pid = v_pid and not m.parti) then
    raise exception 'pas dans cette salle' using errcode = '42501';
  end if;
  update requete_private.ile_etat e set alerte_le = clock_timestamp()
  where e.code = p_salle and (e.alerte_le is null or e.alerte_le < clock_timestamp() - interval '8 seconds');
  v_ok := found;
  select coalesce(jsonb_object_agg(m.pid, m.pseudo), '{}'::jsonb) into v_noms
  from requete_private.membre m where m.code = p_salle;
  return jsonb_build_object('ok', v_ok, 'moi', v_pid, 'noms', v_noms);
end $$;
comment on function public.jeu_ile_alerte_v2(text, text) is
  'Pour la fonction jeu-ile : une alerte de l’île peut-elle partir (une toutes les 8 s par salle) ? Avec les pseudos des membres.';
revoke all on function public.jeu_ile_alerte_v2(text, text) from public, anon, authenticated;
grant execute on function public.jeu_ile_alerte_v2(text, text) to service_role;

-- 2. Les signalements : seuls les joueurs installés comptent pour masquer un pseudo
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
  if (select count(distinct s.par) from public.jeu_signalement s
      join public.jeu_joueur j on j.id = s.par
      where s.joueur = p_joueur and j.cree < now() - interval '1 day' and j.parties >= 1) >= 3 then
    update public.jeu_joueur set masque = true where id = p_joueur;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- 3. Le parcours en tête : les votes d’appareils vus il y a plus d’un jour
create or replace function public.parcours_en_tete()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select v.parcours from public.parcours_vote v
    where exists (select 1 from public.onboarding_etape o where o.cle = v.cle and o.vue_le < now() - interval '1 day')
       or exists (select 1 from public.jeu_joueur j where j.cle = v.cle and j.cree < now() - interval '1 day')
  ), c as (
    select v.parcours, count(*) as n from v group by v.parcours
  ), t as (
    select coalesce(sum(n), 0) as total, coalesce(max(n), 0) as tete from c
  )
  select jsonb_build_object('parcours',
    case when t.total >= 10 and (select count(*) from c where c.n = t.tete) = 1
      then (select c.parcours from c where c.n = t.tete)
      else null end)
  from t;
$$;
revoke all on function public.parcours_en_tete() from public, anon, authenticated;
grant execute on function public.parcours_en_tete() to anon, authenticated;
