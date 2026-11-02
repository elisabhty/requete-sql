create or replace function public.personnalisation_reinitialiser(p_epoch bigint,p_cle text,p_revision bigint,p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e bigint; old public.personnalisation_element; target text;
begin
  if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=u) then raise exception 'Connexion requise' using errcode='42501'; end if;
  if p_epoch is null or p_revision is null or p_generation is null or least(p_epoch,p_revision,p_generation)<0 or p_cle is null or p_cle !~ '^(preferences:main|stickers:board|study:legacy|study:[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12})$' then raise exception 'Demande invalide' using errcode='22023'; end if;
  insert into public.personnalisation_etat(user_id) values(u) on conflict do nothing;
  select epoch into e from public.personnalisation_etat where user_id=u for update;
  if e<>p_epoch then return jsonb_build_object('ok',false,'reason','epoch','epoch',e); end if;
  select * into old from public.personnalisation_element where user_id=u and cle=p_cle;
  if coalesce(old.generation,0)<>p_generation then return jsonb_build_object('ok',false,'reason','generation'); end if;
  if coalesce(old.revision,0)<>p_revision then return jsonb_build_object('ok',false,'reason','revision'); end if;
  if old.cle is null and (select count(*) from public.personnalisation_element where user_id=u)>=16384 then raise exception 'Trop d’éléments' using errcode='54000'; end if;
  foreach target in array array[p_cle] loop
    insert into public.personnalisation_element(user_id,cle,donnees,generation,supprime) values(u,target,'{}'::jsonb,1,true)
    on conflict(user_id,cle) do update set donnees='{}'::jsonb,generation=public.personnalisation_element.generation+1,revision=public.personnalisation_element.revision+1,supprime=true,modifie_le=clock_timestamp();
  end loop;
  return jsonb_build_object('ok',true,'epoch',e);
end; $$;

