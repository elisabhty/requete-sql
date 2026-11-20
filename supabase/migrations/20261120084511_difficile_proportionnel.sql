-- Elisa, 20 novembre, 9 h 43 : « rends proportionnels les points » ; à la question « Points ×2,5 ou paliers de 4 min ? » :
-- « Points ×2,5 ». En Difficile, les paliers durent 2 min 30 et les points comptaient ×4 : 320 points par minute au premier palier,
-- contre 200 en Facile (×1, 1 min) et en Moyen (×2, 2 min). Les points de vitesse et de place comptent maintenant ×2,5 en Difficile,
-- comme la longueur de ses paliers : 500, 438, 375, 313, 250, 188, puis 125 ; place +125 / +75 / +50 / +25. Arrondi à l’entier le
-- plus proche, manche par manche (comme l’appli : JEU_NIV_X, jeuX). Le premier coup reste +25. La manche (15 min) ne change pas.
-- jeu_score_v2 est recréée telle qu’elle est en service (pg_get_functiondef) : seuls son multiplicateur et son arrondi changent ; si
-- l’un des passages n’est plus celui attendu, rien n’est changé. jeu_score garde ses bornes (×4 au plus : plus large que ×2,5).
-- Appliquée au projet Supabase « requete-sql » (ynuenrxozcpkrjdbeftc) le 20 novembre 2026 avec l’accord d’Elisa.
do $t$
declare
  def text;
  a1 constant text := $a$v_x integer; v_d numeric; res jsonb;$a$;
  b1 constant text := $a$v_x numeric; v_d numeric; res jsonb;$a$;
  a2 constant text := $a$v_x:=case r.niv when 'm' then 2 when 'd' then 4 else 1 end;$a$;
  b2 constant text := $a$v_x:=case r.niv when 'm' then 2 when 'd' then 2.5 else 1 end;$a$;
  a3 constant text := $a$coalesce(sum(case when ms is null then 0 else
   (case when$a$;
  b3 constant text := $a$coalesce(sum(case when ms is null then 0 else
   round((case when$a$;
  a4 constant text := $a$when rang=3 then 10 else 0 end)*v_x+case when premier$a$;
  b4 constant text := $a$when rang=3 then 10 else 0 end)*v_x)+case when premier$a$;
  a5 constant text := $a$-- le niveau de la salle : les points ×1, ×2 ou ×4, des paliers de 1 min, 2 min ou 2 min 30 (14 novembre 2026)$a$;
  b5 constant text := $a$-- le niveau de la salle : les points ×1, ×2 ou ×2,5, des paliers de 1 min, 2 min ou 2 min 30 : proportionnels (20 novembre 2026)$a$;
begin
  select pg_get_functiondef('public.jeu_score_v2(text,text,jsonb)'::regprocedure) into def;
  if position(a1 in def)=0 or position(a2 in def)=0 or position(a3 in def)=0 or position(a4 in def)=0 or position(a5 in def)=0 then
    raise exception 'jeu_score_v2 n’est plus celle attendue : rien n’est changé';
  end if;
  def := replace(replace(replace(replace(replace(def, a1, b1), a2, b2), a3, b3), a4, b4), a5, b5);
  execute def;
end $t$;
