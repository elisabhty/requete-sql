-- Vérification du 10 novembre (accord d'Elisa) : jeu_renommer n'est plus appelée par l'appli, elle n'est plus ouverte à tous ;
-- un index sur le défi de chaque manche (clé étrangère signalée par l'outil de performance de Supabase).
revoke execute on function public.jeu_renommer(text, text) from public, anon, authenticated;
create index if not exists manche_defi_idx on requete_private.manche (defi);
