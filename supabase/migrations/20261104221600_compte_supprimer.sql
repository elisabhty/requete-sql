-- Supprimer mon compte (Elisa, 4 novembre, 22 h 08 : « suppression du compte » ; « toutes les choses obligatoires pour passer la
-- validation Apple en sérénité », règle 5.1.1 v). Depuis Mon compte, l’appli appelle compte_supprimer avec l’identifiant tiré au hasard
-- par l’appareil : tout ce que le serveur garde pour lui part d’un coup.
--   - le classement (jeu_joueur, avec ses parties et les signalements faits ou reçus, par cascade) et le pseudo (jeu_pseudo, avec son pays) ;
--   - le vote du prochain parcours, les avis sur les leçons, les écrans de l’accueil vus, les messages de « Nous contacter » ;
--   - les places dans les salles en cours et leurs essais (requete_private, effacés de toute façon au bout de 24 h) ;
--   - avec un compte connecté (auth.uid()), le compte lui-même : ses tables privées suivent par cascade, et le lien entre le compte et
--     l’appareil (requete_private.compte_jeu) part aussi, ce qui révoque l’identifiant (déclencheur existant, compte_jeu_revoquee).
-- Les fichiers joints aux messages restent dans l’espace privé contact-pieces : ils s’effacent depuis le tableau de bord (Storage), comme
-- après le traitement d’un message. Rien d’autre n’est lu ni renvoyé.
create or replace function public.compte_supprimer(p_cle text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
  v_uid uuid := auth.uid();
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  delete from public.jeu_joueur where cle = v_cle;
  delete from public.jeu_pseudo where cle = v_cle;
  delete from public.parcours_vote where cle = v_cle;
  delete from public.avis_lecon where cle = v_cle;
  delete from public.onboarding_etape where cle = v_cle;
  delete from public.contact_message where cle = v_cle;
  delete from requete_private.essai e using requete_private.membre m where m.cle = v_cle and e.code = m.code and e.pid = m.pid;
  delete from requete_private.membre where cle = v_cle;
  if v_uid is not null and coalesce(auth.jwt()->>'is_anonymous', 'false') <> 'true' then
    delete from auth.users where id = v_uid;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.compte_supprimer(text) from public, anon, authenticated;
grant execute on function public.compte_supprimer(text) to anon, authenticated;
