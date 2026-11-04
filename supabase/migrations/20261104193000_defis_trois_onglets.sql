-- Les défis en trois onglets, Jouer, Classement et Amis (Elisa, 4 novembre, 18 h 55 : « voir toutes les salles dispo plutôt que les
-- amis (amis aussi mais les 2) », « il faut qu’on voie aussi le pays sur le compte au niveau défis » ; 19 h 10 : « pas remis à jour
-- tous les lundis, all time, mais on peut voir par semaine ; bien faire attention à glisser par page, par ex. max 5 ensuite page 2 » ;
-- une salle créée est publique par défaut, le drapeau est affiché d’office et se masque dans Mon compte).
--
-- 1. Le pays du joueur, à côté de son pseudo : jeu_pseudo.pays (deux lettres, ou rien s’il le masque), posé par jeu_pays.
-- 2. Les salles publiques : requete_private.salle.publique, que l’hôte pose avec jeu_salle_publier ; jeu_salles_ouvertes liste celles
--    qui attendent des joueurs (hôte présent, partie pas commencée, moins de 5 joueurs).
-- 3. Les drapeaux d’une liste de pseudos (salle, podium, amis) : jeu_drapeaux ; un pseudo absent de la réponse n’existe pas.
-- 4. Le classement par pages de 5 : jeu_classement_v2 (le monde, un pays ou des amis ; depuis toujours ou depuis lundi), avec la
--    place du joueur qui demande et la page où elle se trouve. Les totaux ne sont jamais remis à zéro : la semaine est une vue.

alter table public.jeu_pseudo add column if not exists pays text;
alter table public.jeu_pseudo drop constraint if exists jeu_pseudo_pays_ok;
alter table public.jeu_pseudo add constraint jeu_pseudo_pays_ok check (pays is null or pays ~ '^[A-Z]{2}$');

alter table requete_private.salle add column if not exists publique boolean not null default false;
create index if not exists salle_ouvertes_idx on requete_private.salle (cree) where publique and not fini and not solo;
create index if not exists jeu_partie_cree_idx on public.jeu_partie (cree, joueur);

-- Le pays du joueur : les deux lettres du pays de son profil, ou null pour ne plus l’afficher. Il faut avoir réservé son pseudo.
create or replace function public.jeu_pays(p_cle text, p_pays text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_pays text := case when p_pays ~ '^[A-Z]{2}$' then p_pays end;
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  if not exists (select 1 from public.jeu_pseudo where cle = v_cle) then
    return jsonb_build_object('ok', false, 'raison', 'pseudo');
  end if;
  update public.jeu_pseudo set pays = v_pays where cle = v_cle and pays is distinct from v_pays;
  return jsonb_build_object('ok', true, 'pays', v_pays);
end;
$$;

-- Les drapeaux d’une liste de pseudos (50 au plus) : pour chaque pseudo existant, sa forme réservée et son pays (null s’il le masque).
create or replace function public.jeu_drapeaux(p_pseudos text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('q', q.v, 'pseudo', p.pseudo, 'pays', p.pays) order by q.v), '[]'::jsonb)
  from (
    select distinct x as v
    from unnest((coalesce(p_pseudos, '{}'::text[]))[1:50]) as x
    where char_length(x) between 2 and 40
  ) q
  join public.jeu_pseudo p on p.norme = public.jeu_pseudo_norme(public.jeu_pseudo_forme(q.v));
$$;

-- L’hôte rend sa salle publique (la liste « Salles ouvertes ») ou privée (le code seulement). Une salle seul ne se publie pas.
create or replace function public.jeu_salle_publier(p_cle text, p_salle text, p_publique boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text := public.jeu_cle(p_cle);
  r requete_private.salle%rowtype;
begin
  if k is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  if p_salle is null or p_salle !~ '^[A-Z0-9]{6}$' then raise exception 'salle invalide' using errcode = '22023'; end if;
  select * into r from requete_private.salle where code = p_salle;
  if not found then return jsonb_build_object('ok', false, 'raison', 'introuvable'); end if;
  if r.solo then return jsonb_build_object('ok', false, 'raison', 'solo'); end if;
  if not exists (select 1 from requete_private.membre m where m.code = p_salle and m.pid = r.host and m.cle = k) then
    raise exception 'réservé à l’hôte' using errcode = '42501';
  end if;
  update requete_private.salle set publique = coalesce(p_publique, false) where code = p_salle;
  return jsonb_build_object('ok', true, 'publique', coalesce(p_publique, false));
end;
$$;

-- Les salles ouvertes (20 au plus) : publiques, réglées (niveau et manches), partie pas encore commencée, hôte présent (signe de vie
-- depuis moins de 55 s), moins de 5 joueurs présents, hôte non masqué du classement ; les plus remplies d’abord, puis les plus
-- anciennes. On n’y voit pas les salles où l’on est déjà. Pour chacune : le code, le niveau, les manches, l’hôte et son pays, les
-- joueurs présents et leur pays.
create or replace function public.jeu_salles_ouvertes(p_cle text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with vivants as (
    select m.code, m.pid, m.cle, m.pseudo, m.arrive
    from requete_private.membre m
    where not m.parti and m.vu > now() - interval '55 seconds'
  ), salles as (
    select s.code, s.niv, s.manches, s.cree, s.host
    from requete_private.salle s
    where s.publique and not s.solo and not s.fini and s.niv is not null and s.manches is not null
      and s.cree > now() - interval '12 hours'
      and not exists (select 1 from requete_private.manche x where x.code = s.code and x.generation = s.generation)
      and not exists (select 1 from vivants moi where moi.code = s.code and moi.cle = public.jeu_cle(p_cle))
  ), ouvertes as (
    select s.code, s.niv, s.manches, s.cree, h.pseudo as hote, hp.pays as hote_pays, count(v.pid) as nb,
      jsonb_agg(jsonb_build_object('pseudo', v.pseudo, 'pays', vp.pays) order by v.arrive, v.pid) as joueurs
    from salles s
    join vivants h on h.code = s.code and h.pid = s.host
    join vivants v on v.code = s.code
    left join public.jeu_pseudo hp on hp.cle = h.cle
    left join public.jeu_pseudo vp on vp.cle = v.cle
    where not exists (select 1 from public.jeu_joueur jj where jj.cle = h.cle and jj.masque)
    group by s.code, s.niv, s.manches, s.cree, h.pseudo, hp.pays
    having count(v.pid) < 5
    order by count(v.pid) desc, s.cree
    limit 20
  )
  select coalesce(jsonb_agg(jsonb_build_object('code', o.code, 'niv', o.niv, 'manches', o.manches, 'nb', o.nb, 'max', 5,
      'hote', o.hote, 'pays', o.hote_pays, 'joueurs', o.joueurs) order by o.nb desc, o.cree), '[]'::jsonb)
  from ouvertes o;
$$;

-- La base du classement : chaque joueur classé (non masqué, plus de 0 point sur la période), son pays, ses points et ses parties
-- sur la période, son rang (ex æquo au même rang) et sa position (pour les pages), et si c’est le joueur qui demande.
create or replace function requete_private.classement_base(p_cle text, p_portee text, p_periode text, p_pays text, p_normes text[])
returns table (id uuid, pseudo text, pays text, pts bigint, parties bigint, rang bigint, pos bigint, moi boolean)
language sql
stable
set search_path = ''
as $$
  with semaine as (
    select p.joueur, sum(p.pts)::bigint as pts, count(*)::bigint as parties
    from public.jeu_partie p
    where p_periode = 'semaine'
      and p.cree >= (date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris')
    group by p.joueur
  ), base as (
    select j.id, j.cle, j.pseudo, j.maj, ps.pays, ps.norme,
      case when p_periode = 'semaine' then coalesce(w.pts, 0) else j.pts::bigint end as pts,
      case when p_periode = 'semaine' then coalesce(w.parties, 0) else j.parties::bigint end as parties
    from public.jeu_joueur j
    left join semaine w on w.joueur = j.id
    left join public.jeu_pseudo ps on ps.cle = j.cle
    where not j.masque
  )
  select b.id, b.pseudo, b.pays, b.pts, b.parties,
    rank() over (order by b.pts desc) as rang,
    row_number() over (order by b.pts desc, b.maj, b.id) as pos,
    b.cle is not distinct from p_cle as moi
  from base b
  where b.pts > 0
    and (p_portee <> 'pays' or b.pays = p_pays)
    and (p_portee <> 'amis' or b.cle is not distinct from p_cle or b.norme = any(p_normes));
$$;

-- Le classement, 5 joueurs par page : p_portee « monde », « pays » (p_pays, deux lettres) ou « amis » (p_pseudos, 100 au plus,
-- plus le joueur qui demande) ; p_periode « tout » (depuis toujours) ou « semaine » (depuis lundi, heure de Paris) ; p_page à partir
-- de 0. Rend les lignes de la page, le nombre de joueurs classés, la place du joueur (et sa page), et ses rangs depuis toujours dans
-- le monde et dans son pays (la carte joueur de l’onglet Jouer).
create or replace function public.jeu_classement_v2(p_cle text default null, p_portee text default 'monde', p_periode text default 'tout',
  p_page integer default 0, p_pays text default null, p_pseudos text[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_portee text := case when p_portee in ('monde', 'pays', 'amis') then p_portee else 'monde' end;
  v_periode text := case when p_periode = 'semaine' then 'semaine' else 'tout' end;
  v_page integer := greatest(0, least(coalesce(p_page, 0), 1000));
  v_pays text := case when p_pays ~ '^[A-Z]{2}$' then p_pays end;
  v_normes text[] := '{}';
  v_lignes jsonb;
  v_total integer;
  v_moi jsonb;
  v_monde bigint;
  v_rang_pays bigint;
  v_mon_pays text;
begin
  if v_portee = 'pays' and v_pays is null then
    return jsonb_build_object('lignes', '[]'::jsonb, 'total', 0, 'page', 0, 'par_page', 5, 'moi', null,
      'portee', v_portee, 'periode', v_periode);
  end if;
  if v_portee = 'amis' then
    select coalesce(array_agg(distinct public.jeu_pseudo_norme(public.jeu_pseudo_forme(x))), '{}')
    into v_normes
    from unnest((coalesce(p_pseudos, '{}'::text[]))[1:100]) as x
    where char_length(x) between 2 and 40;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'pseudo', b.pseudo, 'pays', b.pays, 'pts', b.pts, 'parties', b.parties,
      'rang', b.rang, 'moi', b.moi) order by b.pos), '[]'::jsonb)
  into v_lignes
  from requete_private.classement_base(v_cle, v_portee, v_periode, v_pays, v_normes) b
  where b.pos > v_page * 5 and b.pos <= v_page * 5 + 5;
  select count(*) into v_total from requete_private.classement_base(v_cle, v_portee, v_periode, v_pays, v_normes);
  if v_cle is not null then
    select jsonb_build_object('id', b.id, 'pseudo', b.pseudo, 'pays', b.pays, 'pts', b.pts, 'parties', b.parties, 'rang', b.rang,
        'page', (b.pos - 1) / 5)
    into v_moi
    from requete_private.classement_base(v_cle, v_portee, v_periode, v_pays, v_normes) b
    where b.moi;
    select b.rang into v_monde from requete_private.classement_base(v_cle, 'monde', 'tout', null, '{}') b where b.moi;
    select ps.pays into v_mon_pays from public.jeu_pseudo ps where ps.cle = v_cle;
    if v_mon_pays is not null then
      select b.rang into v_rang_pays from requete_private.classement_base(v_cle, 'pays', 'tout', v_mon_pays, '{}') b where b.moi;
    end if;
  end if;
  return jsonb_build_object('lignes', v_lignes, 'total', v_total, 'page', v_page, 'par_page', 5, 'moi', v_moi,
    'portee', v_portee, 'periode', v_periode,
    'rangs', jsonb_build_object('monde', v_monde, 'pays', v_rang_pays, 'mon_pays', v_mon_pays));
end;
$$;

revoke all on function requete_private.classement_base(text, text, text, text, text[]) from public, anon, authenticated;
revoke all on function public.jeu_pays(text, text) from public, anon, authenticated;
revoke all on function public.jeu_drapeaux(text[]) from public, anon, authenticated;
revoke all on function public.jeu_salle_publier(text, text, boolean) from public, anon, authenticated;
revoke all on function public.jeu_salles_ouvertes(text) from public, anon, authenticated;
revoke all on function public.jeu_classement_v2(text, text, text, integer, text, text[]) from public, anon, authenticated;
grant execute on function public.jeu_pays(text, text) to anon, authenticated;
grant execute on function public.jeu_drapeaux(text[]) to anon, authenticated;
grant execute on function public.jeu_salle_publier(text, text, boolean) to anon, authenticated;
grant execute on function public.jeu_salles_ouvertes(text) to anon, authenticated;
grant execute on function public.jeu_classement_v2(text, text, text, integer, text, text[]) to anon, authenticated;
