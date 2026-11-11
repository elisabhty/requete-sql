-- « M’avertir au lancement » en vraie notification (Elisa, 11 novembre, 15 h 55 : « Ça peut pas être une notification push ? » ;
-- puis « Oui, en push »).
--
-- Dans l’appli iPhone, quand on active l’alerte d’un parcours à venir, iOS demande l’autorisation des notifications, puis
-- l’appareil s’inscrit ici : l’empreinte de sa clé (jeu_cle, comme le vote), le parcours et son adresse de notification chez
-- Apple (le jeton de push, en hexadécimal). Rien d’autre : ni nom, ni e-mail. Couper l’alerte efface la ligne. Le jour où le
-- parcours ouvre, la fonction parcours-annoncer (supabase/functions/parcours-annoncer, déclenchée par Elisa) envoie la
-- notification à chaque inscrit, puis efface les lignes. L’appli n’écrit que par parcours_alerter ; la table n’a aucun droit
-- direct pour anon et authenticated ; la fonction d’envoi la lit et l’efface avec la clé de service.
create table if not exists public.parcours_alerte (
  cle text not null,
  parcours text not null check (parcours in ('python', 'excel', 'powerbi')),
  jeton text not null check (jeton ~ '^[0-9a-f]{64,200}$'),
  inscrit_le timestamptz not null default now(),
  primary key (cle, parcours)
);
comment on table public.parcours_alerte is
  'Alertes « M’avertir au lancement » (notification push) : l’appareil (empreinte de sa clé), le parcours, son jeton de push Apple. Effacées après l’envoi.';
alter table public.parcours_alerte enable row level security;
revoke all on public.parcours_alerte from public, anon, authenticated;
grant select, delete on public.parcours_alerte to service_role;

create or replace function public.parcours_alerter(p_cle text, p_parcours text, p_jeton text, p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text := public.jeu_cle(p_cle);
begin
  if v_cle is null then raise exception 'clé invalide' using errcode = '22023'; end if;
  if p_parcours is null or p_parcours not in ('python', 'excel', 'powerbi') then
    return jsonb_build_object('ok', false, 'raison', 'invalide');
  end if;
  if not coalesce(p_on, false) then
    delete from public.parcours_alerte where cle = v_cle and parcours = p_parcours;
    return jsonb_build_object('ok', true);
  end if;
  if p_jeton is null or lower(p_jeton) !~ '^[0-9a-f]{64,200}$' then
    return jsonb_build_object('ok', false, 'raison', 'jeton');
  end if;
  if (select count(*) from public.parcours_alerte where inscrit_le > now() - interval '1 hour') >= 3000 then
    return jsonb_build_object('ok', false, 'raison', 'trop');
  end if;
  insert into public.parcours_alerte (cle, parcours, jeton) values (v_cle, p_parcours, lower(p_jeton))
  on conflict (cle, parcours) do update set jeton = excluded.jeton, inscrit_le = now();
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.parcours_alerter(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.parcours_alerter(text, text, text, boolean) to anon, authenticated;

-- Supprimer mon compte efface aussi les alertes de l’appareil (le reste est inchangé).
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
  delete from public.parcours_alerte where cle = v_cle;
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
