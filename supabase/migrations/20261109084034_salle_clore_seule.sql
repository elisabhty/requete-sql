-- Elisa, 9 novembre, 8 h 42 : « La manche se clore seule quand tout le monde a trouvé, l’hôte n’a pas la main pour la clore, elle
-- termine au mieux au chrono si personne n’a trouvé ». L’appli n’a plus de bouton « Clore la manche pour tous » depuis ; 9 h 35
-- (« Oui ») : le serveur ne l’accepte plus non plus, pour les applis déjà installées qui l’ont encore.
-- Entre amis, une manche en cours se clôt seule : quand tous les joueurs présents ont trouvé (close_if_finished), ou à la fin de son
-- chrono. Un « close » de l’hôte avant la fin du chrono est refusé, que quelqu’un ait trouvé ou non (avant : refusé seulement dans
-- les 2 minutes après le premier qui a trouvé). Après le chrono, ou seul, rien ne change ; « end » et « round » non plus.
-- jeu_envoyer_v2 est recréée telle qu’elle est en service (pg_get_functiondef) : seule sa règle « close » change ; si elle n’est
-- plus celle attendue, rien n’est changé.
-- Essayée avant, en service, dans une transaction annulée : personne n’a trouvé, l’hôte clôt : refusé ; le premier a trouvé il y a
-- 2 min 50 et l’ami cherche : refusé ; un invité clôt : refusé ; chrono écoulé : accepté ; seule : accepté.
-- Appliquée au projet Supabase « requete-sql » (ynuenrxozcpkrjdbeftc, Paris) le 9 novembre 2026, 9 h 40, avec l’accord d’Elisa (« Oui »).
do $t$
declare
  def text;
  avant constant text := $a$   -- entre amis, pas avant 2 minutes après le premier qui a trouvé
   if exists(select 1 from requete_private.manche x where x.code=p_salle and x.generation=r.generation and x.numero=(p_m->>'n')::integer and not x.fermee and not coalesce(x.solo,false)
     and now_at<(select min(e.cree) from requete_private.essai e where e.code=x.code and e.generation=x.generation and e.numero=x.numero and e.juste)+interval '2 minutes') then
     raise exception 'clore la manche : 2 minutes après le premier qui a trouvé' using errcode='P0001'; end if;$a$;
  apres constant text := $a$   -- entre amis, la manche se clôt seule : quand tous les joueurs présents ont trouvé, ou à la fin de son chrono (9 novembre 2026)
   if exists(select 1 from requete_private.manche x where x.code=p_salle and x.generation=r.generation and x.numero=(p_m->>'n')::integer and not x.fermee and not coalesce(x.solo,false)
     and now_at<x.debut+requete_private.manche_duree(x.defi)) then
     raise exception 'La manche se clôt seule : quand tout le monde a trouvé, ou à la fin du chrono.' using errcode='P0001'; end if;$a$;
begin
  def := pg_get_functiondef('public.jeu_envoyer_v2(text,jsonb,text)'::regprocedure);
  if (length(def) - length(replace(def, avant, ''))) / length(avant) <> 1 then
    raise exception 'la règle « close » de jeu_envoyer_v2 n’est plus celle attendue : rien n’est changé';
  end if;
  execute replace(def, avant, apres);
end $t$;
