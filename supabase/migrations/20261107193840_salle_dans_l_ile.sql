-- La salle dans l’île (Elisa, 7 novembre, 20 h 16 : la planche « Ta salle vit dans l’île », « Tu pars envoyer le code sur WhatsApp :
-- tu vois tes amis arriver »). Chaque téléphone d’une salle entre amis confie le jeton de push de sa Live Activity
-- (jeu_ile_jeton_v2) ; celui dont la salle vient de changer envoie le nouvel état à la fonction jeu-ile, qui le pousse aux autres
-- par Apple (jeu_ile_cibles_v2, puis jeu_ile_suivi_v2 pour les jetons refusés). Rien d’autre ne change.
--
-- Les jetons et le dernier état vivent avec la salle : ils partent avec elle au ménage de 24 h (requete_private.menage), et un
-- joueur qui quitte la salle (bye) ne reçoit plus rien. Le serveur ne repousse pas un état identique au dernier envoyé (deux
-- téléphones qui voient le même changement). Seuls les membres de la salle (la clé de l’appareil, comme pour jeu_envoyer_v2)
-- donnent un jeton ou un état ; seule la fonction (service_role) lit les jetons.

create table requete_private.ile (
  code text not null references requete_private.salle(code) on delete cascade,
  pid text not null,
  jeton text not null check (jeton ~ '^[0-9a-f]{16,400}$'),
  bac boolean not null default false,                -- le jeton d’une version de développement (APNs « sandbox »)
  maj timestamptz not null default clock_timestamp(),
  primary key (code, pid),
  foreign key (code, pid) references requete_private.membre(code, pid) on delete cascade
);
create table requete_private.ile_etat (
  code text primary key references requete_private.salle(code) on delete cascade,
  etat jsonb not null,
  maj timestamptz not null default clock_timestamp()
);
alter table requete_private.ile enable row level security;
alter table requete_private.ile_etat enable row level security;
revoke all on table requete_private.ile, requete_private.ile_etat from public, anon, authenticated;

-- Le téléphone donne le jeton de la Live Activity de sa salle ; null : il quitte la salle, le jeton est oublié.
create function public.jeu_ile_jeton_v2(p_cle text, p_salle text, p_jeton text) returns jsonb
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
  if p_jeton !~ '^[0-9a-f]{16,400}$' then
    raise exception 'jeton invalide' using errcode = '22023';
  end if;
  if not exists (select 1 from requete_private.membre m where m.code = p_salle and m.pid = v_pid) then
    raise exception 'pas dans cette salle' using errcode = '42501';
  end if;
  insert into requete_private.ile (code, pid, jeton) values (p_salle, v_pid, p_jeton)
  on conflict (code, pid) do update set jeton = excluded.jeton, bac = false, maj = clock_timestamp();
  return jsonb_build_object('ok', true);
end $$;

-- Pour la fonction jeu-ile : l’auteur est-il dans la salle ? L’état est-il nouveau ? Si oui, il est gardé, et voici les jetons des
-- autres joueurs encore là.
create function public.jeu_ile_cibles_v2(p_cle text, p_salle text, p_etat jsonb) returns jsonb
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
  select coalesce(jsonb_agg(jsonb_build_object('jeton', i.jeton, 'bac', i.bac)), '[]'::jsonb) into v_cibles
  from requete_private.ile i
  join requete_private.membre m on m.code = i.code and m.pid = i.pid
  where i.code = p_salle and i.pid <> v_pid and not m.parti;
  return jsonb_build_object('pareil', false, 'cibles', v_cibles);
end $$;

-- Après l’envoi : les jetons qu’Apple refuse (l’activité est finie, l’app supprimée) s’en vont ; ceux d’une version de
-- développement sont notés (la fois suivante, droit au bac à sable).
create function public.jeu_ile_suivi_v2(p_salle text, p_retirer text[], p_bac text[]) returns void
language sql security definer set search_path = '' as $$
  delete from requete_private.ile where code = p_salle and jeton = any (coalesce(p_retirer, '{}'::text[]));
  update requete_private.ile set bac = true where code = p_salle and jeton = any (coalesce(p_bac, '{}'::text[]));
$$;

revoke all on function public.jeu_ile_jeton_v2(text, text, text) from public, anon, authenticated;
revoke all on function public.jeu_ile_cibles_v2(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.jeu_ile_suivi_v2(text, text[], text[]) from public, anon, authenticated;
grant execute on function public.jeu_ile_jeton_v2(text, text, text) to anon, authenticated;
grant execute on function public.jeu_ile_cibles_v2(text, text, jsonb) to service_role;
grant execute on function public.jeu_ile_suivi_v2(text, text[], text[]) to service_role;
