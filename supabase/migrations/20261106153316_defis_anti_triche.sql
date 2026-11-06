-- Elisa, 6 novembre, 16 h : les deux dernières règles de l’expert en game design, « Les deux ».
-- 1. Celui qui ne joue pas ne compte pas : une manche ne se compte « à plusieurs » que si au moins deux joueurs y ont exécuté une
--    requête (juste ou non). Sinon elle se compte comme seul : pas de bonus de place, et le +25 du premier coup à chaque fois. Un
--    deuxième téléphone qui ne fait rien ne donne plus de bonus de place.
-- 2. « Clore la manche » (et finir la partie) n’est possible, entre amis, que 2 minutes après le premier qui a trouvé : celui qui
--    trouve en premier ne peut plus fermer la manche aussitôt pour priver les autres de leurs points. Avant que quelqu’un ait trouvé,
--    l’hôte peut toujours clore (personne n’y gagne rien) ; seul, rien ne change.
-- Les deux fonctions sont reprises telles qu’en service ; seuls ces passages changent, et rien n’est fait s’ils ont changé de forme.
do $$
declare
  def text; nb integer;
  remplacer constant text[][] := array[
    ['public.jeu_score_v2(text,text,jsonb)',
     'select rd.*,e.ms,e.premier,',
     'select rd.*,e.ms,e.premier,(coalesce(rd.solo,false) or (select count(distinct x.pid) from requete_private.essai x where x.code=rd.code and x.generation=rd.generation and x.numero=rd.numero)<2) as seul,'],
    ['public.jeu_score_v2(text,text,jsonb)',
     'coalesce(bool_and(solo),true)',
     'coalesce(bool_and(seul),true)'],
    ['public.jeu_score_v2(text,text,jsonb)',
     '+case when premier and (solo or rang=0) then 25 else 0 end+case when solo then 0 when rang=0',
     '+case when premier and (seul or rang=0) then 25 else 0 end+case when seul then 0 when rang=0'],
    ['public.jeu_envoyer_v2(text,jsonb,text)',
     $a$   if r.host<>v_pid then raise exception 'fermeture non autorisée' using errcode='42501'; end if;$a$,
     $a$   if r.host<>v_pid then raise exception 'fermeture non autorisée' using errcode='42501'; end if;
   -- entre amis, pas avant 2 minutes après le premier qui a trouvé
   if exists(select 1 from requete_private.manche x where x.code=p_salle and x.generation=r.generation and x.numero=(p_m->>'n')::integer and not x.fermee and not coalesce(x.solo,false)
     and now_at<(select min(e.cree) from requete_private.essai e where e.code=x.code and e.generation=x.generation and e.numero=x.numero and e.juste)+interval '2 minutes') then
     raise exception 'clore la manche : 2 minutes après le premier qui a trouvé' using errcode='P0001'; end if;$a$],
    ['public.jeu_envoyer_v2(text,jsonb,text)',
     $a$   if r.host<>v_pid then raise exception 'fin non autorisée' using errcode='42501'; end if;$a$,
     $a$   if r.host<>v_pid then raise exception 'fin non autorisée' using errcode='42501'; end if;
   -- pas de fin de partie qui fermerait une manche en cours moins de 2 minutes après le premier qui a trouvé
   if exists(select 1 from requete_private.manche x where x.code=p_salle and x.generation=r.generation and not x.fermee and not coalesce(x.solo,false)
     and now_at<x.debut+interval '20 minutes'
     and now_at<(select min(e.cree) from requete_private.essai e where e.code=x.code and e.generation=x.generation and e.numero=x.numero and e.juste)+interval '2 minutes') then
     raise exception 'fin de partie : 2 minutes après le premier qui a trouvé' using errcode='P0001'; end if;$a$]];
begin
  for i in 1..array_length(remplacer, 1) loop
    def := pg_get_functiondef(remplacer[i][1]::regprocedure);
    nb := (length(def) - length(replace(def, remplacer[i][2], ''))) / length(remplacer[i][2]);
    if nb <> 1 then raise exception '% : passage introuvable (% fois)', remplacer[i][1], nb; end if;
    execute replace(def, remplacer[i][2], remplacer[i][3]);
  end loop;
end $$;
