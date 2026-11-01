create or replace function public.jeu_identite_v2(p_cle text) returns jsonb language plpgsql security definer set search_path='' as $$
declare k text:=public.jeu_cle(p_cle); nom text;
begin
 select pseudo into nom from public.jeu_pseudo where cle=k;
 if k is null or nom is null then raise exception 'pseudo réservé requis' using errcode='42501'; end if;
 return jsonb_build_object('pid',left(k,24),'pseudo',nom,'serverNow',floor(extract(epoch from clock_timestamp())*1000));
end $$;
create function public.jeu_balise_v2(text) returns void language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin v:=$1::jsonb;perform public.jeu_envoyer_v2(v->>'salle',v->'m',v->>'cle');exception when others then return;end $$;
revoke all on function public.jeu_balise_v2(text) from public,anon,authenticated;
grant execute on function public.jeu_balise_v2(text) to anon,authenticated;
