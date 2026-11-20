-- Elisa, 20 novembre, 10 h 15 : « Et on peut baisser Moyen ? » ; à la question : « ×1,5, paliers 1 min 30 » ; puis « Oui, applique et
-- publie pour tous ». Le Moyen compte ×1,5 (au lieu de ×2), ses paliers durent 1 min 30 (au lieu de 2 min) et sa manche 9 min (au lieu
-- de 12) : toujours 200 points par minute au premier palier, comme le Facile et le Difficile. 300, 263, 225, 188, 150, 113 ; place
-- +75 / +45 / +30 / +15 ; manche parfaite 325 seul, 400 entre amis. Arrondi manche par manche (20261120084511). Les indices restent au
-- quart, à la moitié et aux trois quarts de la manche. jeu_score garde ses bornes (×2 au plus en Moyen : plus large que ×1,5).
-- Appliquée au projet Supabase « requete-sql » (ynuenrxozcpkrjdbeftc) le 20 novembre 2026 avec l’accord d’Elisa ; vérifiée ensuite.
create or replace function requete_private.manche_duree(p_defi text) returns interval
language sql stable set search_path = '' as $$
  select case (select c.niv from requete_private.catalogue c where c.id = p_defi)
    when 'm' then interval '9 minutes' when 'd' then interval '15 minutes' else interval '6 minutes' end
$$;
revoke all on function requete_private.manche_duree(text) from public, anon, authenticated;

do $t$
declare
  def text;
  a1 constant text := $a$v_x:=case r.niv when 'm' then 2 when 'd' then 2.5 else 1 end;$a$;
  b1 constant text := $a$v_x:=case r.niv when 'm' then 1.5 when 'd' then 2.5 else 1 end;$a$;
  a2 constant text := $a$v_d:=case r.niv when 'm' then 2 when 'd' then 2.5 else 1 end;$a$;
  b2 constant text := $a$v_d:=case r.niv when 'm' then 1.5 when 'd' then 2.5 else 1 end;$a$;
  a3 constant text := $a$-- le niveau de la salle : les points ×1, ×2 ou ×2,5, des paliers de 1 min, 2 min ou 2 min 30 : proportionnels (20 novembre 2026)$a$;
  b3 constant text := $a$-- le niveau de la salle : les points ×1, ×1,5 ou ×2,5, des paliers de 1 min, 1 min 30 ou 2 min 30 : proportionnels (20 novembre 2026)$a$;
begin
  select pg_get_functiondef('public.jeu_score_v2(text,text,jsonb)'::regprocedure) into def;
  if position(a1 in def)=0 or position(a2 in def)=0 or position(a3 in def)=0 then
    raise exception 'jeu_score_v2 n’est plus celle attendue : rien n’est changé';
  end if;
  execute replace(replace(replace(def, a1, b1), a2, b2), a3, b3);
end $t$;
