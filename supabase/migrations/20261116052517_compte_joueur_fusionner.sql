-- 16 novembre, 6 h 19 (Elisa : « J’aimerais synchroniser les points avec le nouveau pseudo du compte » ; « ok, et il reste dans les
-- classements, remplacé par le pseudo totalement »).
-- Un iPhone utilisé sans compte a son propre joueur (sa clé tirée au hasard) : son pseudo, ses points, ses parties, ses défis joués.
-- Quand il se connecte à un compte qui a déjà un joueur, l’appli passe au joueur du compte ; jusqu’ici, le joueur de l’iPhone était
-- libéré (jeu_pseudo_liberer) et ses points disparaissaient avec lui. Maintenant, compte_joueur_fusionner les rend au compte :
--   - les parties (jeu_partie, chacune une seule fois) passent au joueur du compte : ses points, ses parties, la semaine aussi ;
--     le meilleur score reste le plus haut ; les défis réussis et les défis joués (pour ne pas retomber dessus en salle) s’ajoutent ;
--   - le pseudo du compte reste, celui de l’iPhone disparaît des classements (général, semaine, pays, amis) ; un compte sans pseudo
--     prend celui de l’iPhone, avec son pays, son niveau et ses signalements ;
--   - seulement le joueur d’un appareil qui n’a jamais été à un compte (sa clé, que seul cet appareil connaît) ; jamais celui d’un
--     autre compte ; le joueur de l’appareil est ensuite supprimé.
-- Les signalements suivent par une mise à jour (pas d’insertion : jeu_signalement_alerte n’envoie pas de nouvelle alerte).
create or replace function public.compte_joueur_fusionner(p_ancienne text, p_cle text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := auth.uid();
  a text; c text;
  ja public.jeu_joueur; jc public.jeu_joueur;
  psa public.jeu_pseudo; psc public.jeu_pseudo;
  v_transfert boolean := false;
  v_pts bigint := 0; v_n integer := 0;
  v_defis jsonb;
begin
  if v_uid is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then
    raise exception 'compte requis' using errcode='42501';
  end if;
  if p_ancienne is null or p_cle is null or p_ancienne !~ '^[A-Za-z0-9]{24,64}$' or p_cle !~ '^[A-Za-z0-9]{24,64}$' then
    raise exception 'clé invalide' using errcode='22023';
  end if;
  if not exists(select 1 from requete_private.compte_joueur where user_id=v_uid and cle=p_cle) then
    raise exception 'joueur d’un autre compte' using errcode='42501';
  end if;
  if p_ancienne=p_cle then return jsonb_build_object('ok',true,'pts',0,'parties',0); end if;
  if exists(select 1 from requete_private.compte_joueur where cle=p_ancienne) then
    return jsonb_build_object('ok',false,'raison','compte');
  end if;
  /* les deux verrous de jeu_cle, toujours dans le même ordre */
  if p_ancienne<p_cle then a:=public.jeu_cle(p_ancienne); c:=public.jeu_cle(p_cle);
  else c:=public.jeu_cle(p_cle); a:=public.jeu_cle(p_ancienne); end if;
  if a is null or c is null then raise exception 'clé invalide' using errcode='22023'; end if;

  select * into ja from public.jeu_joueur where cle=a for update;
  select * into jc from public.jeu_joueur where cle=c for update;
  select * into psa from public.jeu_pseudo where cle=a for update;
  select * into psc from public.jeu_pseudo where cle=c for update;

  /* les défis joués de l’appareil, mis de côté : ils tiennent à son pseudo (clé étrangère) */
  select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) into v_defis from requete_private.defi_joue d where d.cle=a;
  delete from requete_private.defi_joue where cle=a;

  /* le pseudo : celui du compte reste ; un compte sans pseudo prend celui de l’appareil */
  if psa.cle is not null then
    if psc.cle is null then
      update public.jeu_pseudo set cle=c where cle=a;
      select * into psc from public.jeu_pseudo where cle=c;
      v_transfert := true;
    else
      delete from public.jeu_pseudo where cle=a;
    end if;
  end if;

  if ja.id is not null then
    if jc.id is null then
      insert into public.jeu_joueur(cle,pseudo,masque,cree,maj)
      values (c, coalesce(psc.pseudo, ja.pseudo), v_transfert and ja.masque, ja.cree, ja.maj)
      returning * into jc;
    elsif v_transfert and ja.masque then
      update public.jeu_joueur set masque=true where id=jc.id;
    end if;
    with moved as (
      insert into public.jeu_partie(joueur,u,pts,n,ok,solo,niv,cree)
      select jc.id,p.u,p.pts,p.n,p.ok,p.solo,p.niv,p.cree from public.jeu_partie p where p.joueur=ja.id
      on conflict (joueur,u) do nothing
      returning pts
    ) select coalesce(sum(pts),0),count(*) into v_pts,v_n from moved;
    update public.jeu_joueur set
      pts=pts+v_pts::integer, parties=parties+v_n, best=greatest(best,ja.best), maj=greatest(maj,ja.maj),
      defis=(select coalesce(array_agg(distinct x order by x),'{}') from unnest(jc.defis||ja.defis) x),
      defis_niv=coalesce(defis_niv,ja.defis_niv), defis_maj=greatest(defis_maj,ja.defis_maj),
      pseudo=coalesce(psc.pseudo,pseudo)
    where id=jc.id;
    /* ses signalements : ceux qu’il a faits, et ceux de son pseudo s’il passe au compte (mis à jour, jamais réinsérés) */
    update public.jeu_signalement s set par=jc.id where s.par=ja.id and s.joueur<>jc.id
      and not exists(select 1 from public.jeu_signalement t where t.joueur=s.joueur and t.par=jc.id);
    if v_transfert then
      update public.jeu_signalement s set joueur=jc.id where s.joueur=ja.id and s.par<>jc.id
        and not exists(select 1 from public.jeu_signalement t where t.joueur=jc.id and t.par=s.par);
    end if;
    delete from public.jeu_joueur where id=ja.id;
  end if;

  /* les défis joués, rendus au compte (il lui faut un pseudo et une place au classement) */
  if jsonb_array_length(v_defis)>0 and exists(select 1 from public.jeu_pseudo where cle=c) and exists(select 1 from public.jeu_joueur where cle=c) then
    insert into requete_private.defi_joue(cle,defi,niv,vu,dernier,fois,trouve)
    select c,d->>'defi',d->>'niv',(d->>'vu')::timestamptz,(d->>'dernier')::timestamptz,coalesce((d->>'fois')::integer,1),(d->>'trouve')::timestamptz
    from jsonb_array_elements(v_defis) d
    on conflict (cle,defi) do update set
      vu=least(requete_private.defi_joue.vu,excluded.vu), dernier=greatest(requete_private.defi_joue.dernier,excluded.dernier),
      fois=requete_private.defi_joue.fois+excluded.fois, trouve=least(requete_private.defi_joue.trouve,excluded.trouve);
  end if;

  return jsonb_build_object('ok',true,'pseudo',(select pseudo from public.jeu_pseudo where cle=c),'pts',v_pts,'parties',v_n);
end; $$;
revoke all on function public.compte_joueur_fusionner(text,text) from public, anon;
grant execute on function public.compte_joueur_fusionner(text,text) to authenticated;
