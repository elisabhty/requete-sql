-- Elisa, 6 novembre, 7 h 52 : « faire partir le chrono de 20 min pour passer à 0 et fermeture de la salle ».
-- Une manche dure désormais 20 minutes au plus (10 avant) : les cinq fonctions qui la bornent comptent 20 minutes. Chacune est
-- recréée telle qu’elle est en service, seule sa durée change (pg_get_functiondef), sans rien toucher d’autre ; si l’une n’a plus
-- sa borne de 10 minutes, rien n’est changé.
do $$
declare
  f record;
  def text;
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
    execute replace(def, 'interval ''10 minutes''', 'interval ''20 minutes''');
    nb := nb + 1;
  end loop;
  if nb <> 5 then raise exception 'cinq fonctions attendues, % trouvées', nb; end if;
end $$;
