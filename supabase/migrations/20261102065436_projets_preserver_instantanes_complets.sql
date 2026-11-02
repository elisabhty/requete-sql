create or replace function public.projets_enregistrer(p_epoch bigint,p_cle text,p_revision bigint,p_generation bigint,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint; old public.projets_element; row_json jsonb;
begin
 if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=u) then raise exception 'Connexion requise' using errcode='42501';end if;
 if p_epoch is null or p_revision is null or p_generation is null or least(p_epoch,p_revision,p_generation)<0 or not requete_private.projets_valide(p_cle,p_data) then raise exception 'Document invalide' using errcode='22023';end if;
 insert into public.projets_etat(user_id) values(u) on conflict do nothing;
 select epoch into e from public.projets_etat where user_id=u for update;
 if e<>p_epoch then return jsonb_build_object('ok',false,'reason','epoch','epoch',e);end if;
 select * into old from public.projets_element where user_id=u and cle=p_cle;
 row_json:=case when old.cle is null then null else jsonb_build_object('key',old.cle,'data',old.donnees,'revision',old.revision,'generation',old.generation,'deleted',old.supprime,'updatedAt',old.modifie_le) end;
 if coalesce(old.generation,0)<>p_generation then return jsonb_build_object('ok',false,'reason','generation','element',row_json);end if;
 if coalesce(old.revision,0)<>p_revision then return jsonb_build_object('ok',false,'reason','revision','element',row_json);end if;
 if not coalesce(old.supprime,true) and old.donnees->>'scope'='complete' and p_data->>'scope'='workspace' then return jsonb_build_object('ok',false,'reason','database_removal','element',row_json);end if;
 if old.cle is null and (select count(*) from public.projets_element where user_id=u)>=64 then raise exception 'Trop de projets' using errcode='54000';end if;
 if coalesce((select sum(octet_length(donnees::text)) from public.projets_element where user_id=u and cle<>p_cle),0)+octet_length(p_data::text)>67108864 then raise exception 'Espace de projets atteint' using errcode='54000';end if;
 -- Full saved document, no SQL execution and no field-wise merge of concurrent edits.
 insert into public.projets_element(user_id,cle,donnees,revision,generation,supprime)
 values(u,p_cle,p_data,coalesce(old.revision,0)+1,coalesce(old.generation,0),false)
 on conflict(user_id,cle) do update set donnees=excluded.donnees,revision=excluded.revision,supprime=false,modifie_le=clock_timestamp()
 returning jsonb_build_object('key',cle,'data',donnees,'revision',revision,'generation',generation,'deleted',supprime,'updatedAt',modifie_le) into row_json;
 return jsonb_build_object('ok',true,'epoch',e,'element',row_json);
end; $$;

