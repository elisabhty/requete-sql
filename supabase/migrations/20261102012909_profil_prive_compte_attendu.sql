drop function public.compte_profil_enregistrer(bigint,jsonb);
create function public.compte_profil_enregistrer(p_revision bigint,p_donnees jsonb,p_compte_attendu uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=requete_private.profil_uid(); p jsonb;
begin
 if u is distinct from p_compte_attendu then raise exception 'Compte différent' using errcode='42501';end if;
 if p_revision is null or p_revision<1 or not requete_private.profil_valide(p_donnees) then raise exception 'Profil invalide' using errcode='22023';end if;
 update public.compte_profil c set
  prenom=case when p_donnees?'prenom' then p_donnees->>'prenom' else c.prenom end,
  objectif=case when p_donnees?'objectif' then p_donnees->>'objectif' else c.objectif end,
  fuseau_horaire=case when p_donnees?'fuseau_horaire' then p_donnees->>'fuseau_horaire' else c.fuseau_horaire end
 where user_id=u and revision=p_revision returning to_jsonb(c) into p;
 if p is null then return jsonb_build_object('ok',false,'reason','revision_or_missing','profile',public.compte_profil_lire());end if;
 return jsonb_build_object('ok',true,'profile',p);
end; $$;
revoke all on function public.compte_profil_enregistrer(bigint,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.compte_profil_enregistrer(bigint,jsonb,uuid) to authenticated;
