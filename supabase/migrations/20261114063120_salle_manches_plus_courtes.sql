-- Elisa, 14 novembre, 7 h 17 : « Facile on descend à 6 min, Moyen 12 min, Difficile 15 min par manche, max 3 manches, et recalcule
-- les points en fonction ».
-- La durée d’une manche (requete_private.manche_duree, d’après le niveau du défi) : 6 minutes en Facile, 12 en Moyen, 15 en Difficile
-- (10, 15 et 20 depuis le 8 novembre). Les fonctions qui bornent une manche l’appellent déjà (20261108080808) : rien d’autre à changer.
-- Les points (jeu_score_v2) : six paliers par manche, chacun un sixième du chrono : 1 min en Facile, 2 min en Moyen, 2 min 30 en
-- Difficile (200, 175, 150, 125, 100, 75, puis ×1, ×2 ou ×4), comme l’appli (JEU_NIV_MANCHE, JEU_NIV_DUREE, JEU_PALIERS). Le dernier
-- palier s’arrête à 6 sixièmes (420 avant : 7 min en Facile). La manche parfaite ne change pas, ni les bornes de jeu_score.
-- Le nombre de manches (1, 2 ou 3) ne change pas (20261108162656).
-- jeu_score_v2 est recréée telle qu’elle est en service (pg_get_functiondef) : seuls ses paliers changent ; si l’un des passages n’est
-- plus celui attendu, rien n’est changé.
-- Essayée à blanc (BEGIN … ROLLBACK), puis appliquée au projet Supabase « requete-sql » (ynuenrxozcpkrjdbeftc) le 14 novembre 2026,
-- vers 7 h 31, avec l’accord d’Elisa (« Oui, applique et publie ») ; vérifiée ensuite : 6, 12 et 15 minutes, les paliers de 1 min,
-- 2 min et 2 min 30 sont en service, les droits de jeu_score_v2 n’ont pas changé.
create or replace function requete_private.manche_duree(p_defi text) returns interval
language sql stable set search_path = '' as $$
  select case (select c.niv from requete_private.catalogue c where c.id = p_defi)
    when 'm' then interval '12 minutes' when 'd' then interval '15 minutes' else interval '6 minutes' end
$$;
revoke all on function requete_private.manche_duree(text) from public, anon, authenticated;

do $t$
declare
  def text;
  a1 constant text := $a$v_x integer; v_d integer; res jsonb;$a$;
  b1 constant text := $a$v_x integer; v_d numeric; res jsonb;$a$;
  a2 constant text := $a$-- le niveau de la salle : les points ×1, ×2 ou ×4, des paliers 1, 3 ou 5 fois plus longs$a$;
  b2 constant text := $a$-- le niveau de la salle : les points ×1, ×2 ou ×4, des paliers de 1 min, 2 min ou 2 min 30 (14 novembre 2026)$a$;
  a3 constant text := $a$v_d:=case r.niv when 'm' then 3 when 'd' then 5 else 1 end;$a$;
  b3 constant text := $a$v_d:=case r.niv when 'm' then 2 when 'd' then 2.5 else 1 end;$a$;
  a4 constant text := $a$when floor(ms/1000.0)<=420*v_d then 75$a$;
  b4 constant text := $a$when floor(ms/1000.0)<=360*v_d then 75$a$;
  occ integer;
begin
  def := pg_get_functiondef('public.jeu_score_v2(text,text,jsonb)'::regprocedure);
  foreach occ in array array[
    (length(def) - length(replace(def, a1, ''))) / length(a1),
    (length(def) - length(replace(def, a2, ''))) / length(a2),
    (length(def) - length(replace(def, a3, ''))) / length(a3),
    (length(def) - length(replace(def, a4, ''))) / length(a4)] loop
    if occ <> 1 then raise exception 'jeu_score_v2 n’est plus celle attendue : rien n’est changé'; end if;
  end loop;
  execute replace(replace(replace(replace(def, a1, b1), a2, b2), a3, b3), a4, b4);
end $t$;
