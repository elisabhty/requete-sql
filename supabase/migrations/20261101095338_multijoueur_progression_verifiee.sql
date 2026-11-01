create function public.jeu_defis_v2(p_cle text,p_defis jsonb default null,p_niv jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text:=public.jeu_cle(p_cle); ids text[]; levels jsonb; p text:=left(k,24);
begin
 select coalesce(array_agg(distinct x),'{}') into ids from (
   select unnest(j.defis) as x from public.jeu_joueur j where j.cle=k
   union select rd.defi from requete_private.essai e join requete_private.manche rd using(code,generation,numero) where e.pid=p and e.juste
 ) t;
 select jsonb_object_agg(niv,jsonb_build_array(done,total)) into levels from (
   select c.niv,count(*) filter(where c.id=any(ids)) as done,count(*) as total from requete_private.catalogue c group by c.niv
   union all select 'd',0,0 where not exists(select 1 from requete_private.catalogue where niv='d')
 ) t;
 return public.jeu_defis(p_cle,to_jsonb(ids),levels);
end $$;
revoke all on function public.jeu_defis_v2(text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.jeu_defis_v2(text,jsonb,jsonb) to anon,authenticated;
