-- Plus de ménage des pseudos (Elisa, 31 octobre, 17 h 53 : « il n’y aura pas de suppression de pseudo si la personne a encore son
-- compte ») : un pseudo n’est plus libéré au bout de 12 mois sans ouverture de l’appli ; il reste à la personne tant qu’elle ne le
-- supprime pas. Dans l’appli : Mon compte › Données et confidentialité › « Supprimer mon pseudo » (jeu_pseudo_liberer, qui retire
-- aussi ses scores du classement). Sur demande : delete from jeu_pseudo where pseudo = '…'.

select cron.unschedule('jeu-pseudo-menage');
drop function if exists public.jeu_pseudo_menage();

create or replace function public.jeu_pseudo_liberer(p_cle text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  delete from public.jeu_joueur where cle = v_cle;
  delete from public.jeu_pseudo where cle = v_cle;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.jeu_pseudo_liberer(text) from public, anon, authenticated;
grant execute on function public.jeu_pseudo_liberer(text) to anon, authenticated;
