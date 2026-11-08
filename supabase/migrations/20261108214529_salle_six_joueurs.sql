-- Elisa, 8 novembre, 22 h 27 : « accepte 6 max dans une salle, comme ça on a deux lignes pleines ». Une salle tient 6 joueurs
-- (l’hôte et 5 invités) au lieu de 5 : jeu_envoyer_v2 laisse entrer le 6e (« salle pleine » au 7e) et annonce max 6 dans le
-- réglage de la salle ; jeu_salles_ouvertes montre une salle tant qu’elle a moins de 6 joueurs, avec max 6.
-- Les deux fonctions sont recréées telles qu’elles sont en service (pg_get_functiondef) : seul le nombre de joueurs change ;
-- s’il n’est plus celui attendu, rien n’est changé.
-- Appliquée au projet Supabase « requete-sql » (ynuenrxozcpkrjdbeftc, Paris) le 8 novembre 2026, 22 h 45, avec l’accord d’Elisa (« ok pour… faire la migration »).
do $$
declare
  def text;
  neuf text;
  avant constant text := 'case when r.solo then 1 else 5 end';
begin
  def := pg_get_functiondef('public.jeu_envoyer_v2(text,jsonb,text)'::regprocedure);
  if (length(def) - length(replace(def, avant, ''))) / length(avant) <> 3 then
    raise exception 'les trois « 5 joueurs » introuvables dans jeu_envoyer_v2';
  end if;
  neuf := replace(def, avant, 'case when r.solo then 1 else 6 end');
  execute neuf;

  def := pg_get_functiondef('public.jeu_salles_ouvertes(text)'::regprocedure);
  if (length(def) - length(replace(def, 'having count(v.pid) < 5', ''))) / length('having count(v.pid) < 5') <> 1
     or (length(def) - length(replace(def, '''max'', 5,', ''))) / length('''max'', 5,') <> 1 then
    raise exception '« moins de 5 » et « max 5 » introuvables dans jeu_salles_ouvertes';
  end if;
  neuf := replace(replace(def, 'having count(v.pid) < 5', 'having count(v.pid) < 6'), '''max'', 5,', '''max'', 6,');
  execute neuf;
end $$;
