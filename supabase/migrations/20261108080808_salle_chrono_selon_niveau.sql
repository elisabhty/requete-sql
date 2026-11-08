-- Elisa, 8 novembre, 8 h 52 : « 15 min pour moyen et 20 min par manche pour difficile » (le Facile garde ses 10 min de 8 h 21).
-- La durée d’une manche suit le niveau de son défi (requete_private.catalogue) : 10 minutes en Facile, 15 en Moyen, 20 en Difficile,
-- comme l’appli (JEU_NIV_MANCHE) ; chaque palier tient ainsi dans la manche (cinq de 3 minutes en Moyen, quatre de 5 en Difficile).
-- Les cinq fonctions qui bornent une manche comptent cette durée au lieu de 10 minutes : chacune est recréée telle qu’elle est en
-- service, seule sa borne change (pg_get_functiondef) ; si l’une n’a plus sa borne de 10 minutes, ou en garde une après coup, rien
-- n’est changé.
create function requete_private.manche_duree(p_defi text) returns interval
language sql stable set search_path = '' as $$
  select case (select c.niv from requete_private.catalogue c where c.id = p_defi)
    when 'm' then interval '15 minutes' when 'd' then interval '20 minutes' else interval '10 minutes' end
$$;
revoke all on function requete_private.manche_duree(text) from public, anon, authenticated;

do $$
declare
  f record;
  def text;
  neuf text;
  nb integer := 0;
begin
  for f in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname, p.proname) in (('public','jeu_envoyer_v2'), ('public','jeu_essai_v2'), ('public','jeu_score_v2'),
                                     ('public','jeu_valider_v2'), ('requete_private','close_if_finished'))
  loop
    def := pg_get_functiondef(f.oid);
    if position('interval ''10 minutes''' in def) = 0 then
      raise exception 'durée de manche introuvable dans %', f.oid::regprocedure;
    end if;
    neuf := regexp_replace(def, '([a-z_]+)\.debut\+interval ''10 minutes''', '\1.debut+requete_private.manche_duree(\1.defi)', 'g');
    if position('interval ''10 minutes''' in neuf) > 0 then
      raise exception 'une borne de 10 minutes reste dans %', f.oid::regprocedure;
    end if;
    execute neuf;
    nb := nb + 1;
  end loop;
  if nb <> 5 then raise exception 'cinq fonctions attendues, % trouvées', nb; end if;
end $$;
