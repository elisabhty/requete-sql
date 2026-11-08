-- Elisa, 8 novembre, 8 h 21 : « 10 min de jeu stp par manche ».
-- Une manche dure de nouveau 10 minutes au plus (20 depuis le 6 novembre) : les cinq fonctions qui la bornent comptent 10 minutes,
-- comme l’appli (JEU_ROUND_MS). Chacune est recréée telle qu’elle est en service, seule sa durée change (pg_get_functiondef), sans
-- rien toucher d’autre ; si l’une n’a plus sa borne de 20 minutes, rien n’est changé.
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
    if position('interval ''20 minutes''' in def) = 0 then
      raise exception 'durée de manche introuvable dans %', f.oid::regprocedure;
    end if;
    execute replace(def, 'interval ''20 minutes''', 'interval ''10 minutes''');
    nb := nb + 1;
  end loop;
  if nb <> 5 then raise exception 'cinq fonctions attendues, % trouvées', nb; end if;
end $$;
