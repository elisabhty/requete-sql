-- Elisa, 14 novembre, 12 h 41 (« Oui ») : 200 pièces jointes de 5 Mo par heure pouvaient remplir l’espace gratuit de Supabase en
-- quelques heures. Au plus 30 par heure pour tout le monde ; au-delà, le message part quand même (le « merci » dit qu’une pièce
-- n’a pas pu suivre).
create or replace function public.contact_piece_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from storage.objects
          where bucket_id = 'contact-pieces' and created_at > now() - interval '1 hour') < 30;
$$;
revoke all on function public.contact_piece_ok() from public, anon, authenticated;
grant execute on function public.contact_piece_ok() to anon, authenticated;
