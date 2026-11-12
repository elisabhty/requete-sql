-- Owner SQL editor only. All fixtures are rolled back; no e-mail is sent (the pg_net requests queued here vanish with the rollback).
-- Les retours par e-mail (migration alerte_mail) : ce qui prévient, ce qui est pris une seule fois, rendu, rattrapé, limité.
begin;
-- La file d’attente de pg_net (les appels à la fonction). Si l’éditeur n’a pas le droit de la lire, ces vérifications-là sont passées.
create function pg_temp.alerte_file() returns bigint language plpgsql as $f$
begin
  if not has_table_privilege('net.http_request_queue', 'select') then return null; end if;
  return (select count(*) from net.http_request_queue);
end $f$;
do $$
declare
  c text := repeat('e', 64);
  v_file bigint;
  v jsonb;
  m jsonb;
  v_id bigint;
  v_a uuid;
  v_b uuid;
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  i integer;
begin
  -- La place nette pour le compte du jour
  delete from requete_private.alerte_envoi where jour = v_jour;

  -- 1. Un message « Contacte-nous » : la fonction est prévenue, la ligne est prise une seule fois, avec tout ce qu’il faut
  v_file := pg_temp.alerte_file();
  insert into public.contact_message (cle, type, message, email, infos, pieces)
  values (c, 'bug', 'L’écran reste blanc', 'lea@exemple.test', '{"version":"2911","appareil":"iPhone"}', array[repeat('1', 32) || '/capture.png'])
  returning id into v_id;
  if pg_temp.alerte_file() <> v_file + 1 then raise exception 'FAIL contact : fonction non prévenue'; end if;
  if v_file is not null then
    if (select url from net.http_request_queue order by id desc limit 1) <> requete_private.alerte_url() then raise exception 'FAIL adresse'; end if;
  end if;
  if not requete_private.alerte_attend() then raise exception 'FAIL attend'; end if;
  v := public.alerte_prendre();
  select e into m from jsonb_array_elements(v) e where e ->> 'genre' = 'contact' and e ->> 'ref' = v_id::text;
  if m is null then raise exception 'FAIL contact non pris'; end if;
  if m ->> 'type' <> 'bug' or m ->> 'message' <> 'L’écran reste blanc' or m ->> 'email' <> 'lea@exemple.test'
     or m #>> '{infos,version}' <> '2911' or m #>> '{pieces,0}' <> repeat('1', 32) || '/capture.png'
     or m ->> 'essai' <> '1' or m ->> 'le' !~ '^[0-9]{2}/[0-9]{2}/[0-9]{4} à [0-9]{2}:[0-9]{2}$' then
    raise exception 'FAIL contact : contenu %', m;
  end if;
  if (select alerte_le is null or alerte_essais <> 1 from public.contact_message where id = v_id) then raise exception 'FAIL contact non marqué'; end if;
  if exists (select 1 from jsonb_array_elements(public.alerte_prendre()) e where e ->> 'ref' = v_id::text) then raise exception 'FAIL pris deux fois'; end if;
  if (select envois from requete_private.alerte_envoi where jour = v_jour) <> 1 then raise exception 'FAIL compte du jour'; end if;

  -- 2. L’envoi a raté : la ligne est rendue, reprise (essai 2), et plus du tout après 5 essais
  if public.alerte_rendre(jsonb_build_array(jsonb_build_object('genre', 'contact', 'ref', v_id::text))) <> 1 then raise exception 'FAIL rendre'; end if;
  if (select alerte_le is not null from public.contact_message where id = v_id) then raise exception 'FAIL non rendu'; end if;
  for i in 2..5 loop
    select e into m from jsonb_array_elements(public.alerte_prendre()) e where e ->> 'ref' = v_id::text and e ->> 'genre' = 'contact';
    if m is null or (m ->> 'essai')::integer <> i then raise exception 'FAIL essai % : %', i, m; end if;
    perform public.alerte_rendre(jsonb_build_array(jsonb_build_object('genre', 'contact', 'ref', v_id::text)));
  end loop;
  if exists (select 1 from jsonb_array_elements(public.alerte_prendre()) e where e ->> 'ref' = v_id::text and e ->> 'genre' = 'contact') then
    raise exception 'FAIL repris après 5 essais';
  end if;
  -- des références fantaisistes : rien, et pas d’erreur
  if public.alerte_rendre('[{"genre":"contact","ref":"1; drop"},{"genre":"avis","ref":"x:1"},{"genre":"signalement","ref":"a:b"},{"genre":"autre","ref":"1"},{}]') <> 0
     or public.alerte_rendre('{"genre":"contact"}') <> 0 or public.alerte_rendre(null) <> 0 then
    raise exception 'FAIL références invalides';
  end if;

  -- 3. Un vieux message (plus de 2 jours) n’est jamais envoyé
  insert into public.contact_message (cle, type, message, cree) values (c, 'idee', 'vieux message', now() - interval '3 days') returning id into v_id;
  if exists (select 1 from jsonb_array_elements(public.alerte_prendre()) e where e ->> 'ref' = v_id::text and e ->> 'genre' = 'contact') then
    raise exception 'FAIL vieux message pris';
  end if;

  -- 4. Un avis : sans commentaire, rien ; avec, un e-mail ; la note seule qui change, rien ; le commentaire qui change, il repart
  v_file := pg_temp.alerte_file();
  insert into public.avis_lecon (cle, lecon, titre, note) values (c, 12, 'Les jointures', 4);
  if pg_temp.alerte_file() <> v_file then raise exception 'FAIL avis sans commentaire : prévenu'; end if;
  if exists (select 1 from jsonb_array_elements(public.alerte_prendre()) e where e ->> 'ref' = c || ':12') then raise exception 'FAIL avis sans commentaire pris'; end if;
  update public.avis_lecon set note = 5, commentaire = 'Très clair', note_le = now() where cle = c and lecon = 12;
  if pg_temp.alerte_file() <> v_file + 1 then raise exception 'FAIL commentaire : non prévenu'; end if;
  select e into m from jsonb_array_elements(public.alerte_prendre()) e where e ->> 'genre' = 'avis' and e ->> 'ref' = c || ':12';
  if m is null or m ->> 'commentaire' <> 'Très clair' or m ->> 'note' <> '5' or m ->> 'titre' <> 'Les jointures' or m ->> 'lecon' <> '12' then
    raise exception 'FAIL avis : contenu %', m;
  end if;
  update public.avis_lecon set note = 3, commentaire = 'Très clair', note_le = now() where cle = c and lecon = 12;
  if pg_temp.alerte_file() <> v_file + 1 then raise exception 'FAIL même commentaire : prévenu'; end if;
  if (select alerte_le is null from public.avis_lecon where cle = c and lecon = 12) then raise exception 'FAIL même commentaire : remis'; end if;
  update public.avis_lecon set commentaire = 'Très clair, merci', note_le = now() where cle = c and lecon = 12;
  if pg_temp.alerte_file() <> v_file + 2 then raise exception 'FAIL commentaire changé : non prévenu'; end if;
  select e into m from jsonb_array_elements(public.alerte_prendre()) e where e ->> 'genre' = 'avis' and e ->> 'ref' = c || ':12';
  if m is null or m ->> 'commentaire' <> 'Très clair, merci' or m ->> 'essai' <> '1' then raise exception 'FAIL commentaire changé : %', m; end if;
  insert into public.avis_lecon (cle, lecon, note, commentaire) values (c, 13, 2, 'Trop rapide');
  if pg_temp.alerte_file() <> v_file + 3 then raise exception 'FAIL avis avec commentaire dès le départ'; end if;
  update public.avis_lecon set commentaire = null where cle = c and lecon = 13;
  if exists (select 1 from jsonb_array_elements(public.alerte_prendre()) e where e ->> 'ref' = c || ':13') then raise exception 'FAIL commentaire retiré pris'; end if;

  -- 5. Un pseudo signalé : prévenu, avec le nombre de signalements
  insert into public.jeu_joueur (cle, pseudo) values (repeat('1', 64), 'Signale') returning id into v_a;
  insert into public.jeu_joueur (cle, pseudo) values (repeat('2', 64), 'Temoin') returning id into v_b;
  v_file := pg_temp.alerte_file();
  insert into public.jeu_signalement (joueur, par, pseudo) values (v_a, v_b, 'Signale');
  if pg_temp.alerte_file() <> v_file + 1 then raise exception 'FAIL signalement : non prévenu'; end if;
  select e into m from jsonb_array_elements(public.alerte_prendre()) e where e ->> 'genre' = 'signalement' and e ->> 'ref' = v_a || ':' || v_b;
  if m is null or m ->> 'pseudo' <> 'Signale' or m ->> 'signalements' <> '1' or m ->> 'masque' <> 'false' then raise exception 'FAIL signalement : %', m; end if;

  -- 6. Les garde-fous : 40 e-mails par jour, et à partir du 10e un toutes les 10 minutes
  insert into public.contact_message (cle, type, message) values (c, 'question', 'encore un') returning id into v_id;
  update requete_private.alerte_envoi set envois = 40, dernier = now() - interval '1 hour' where jour = v_jour;
  if jsonb_array_length(public.alerte_prendre()) <> 0 then raise exception 'FAIL plafond du jour'; end if;
  update requete_private.alerte_envoi set envois = 10, dernier = now() - interval '2 minutes' where jour = v_jour;
  if jsonb_array_length(public.alerte_prendre()) <> 0 then raise exception 'FAIL rythme'; end if;
  if not requete_private.alerte_attend() then raise exception 'FAIL ce qui attend reste à envoyer'; end if;
  -- l’avis et le signalement n’étaient pas partis non plus : rendus, ils rejoignent le même e-mail
  if public.alerte_rendre(jsonb_build_array(jsonb_build_object('genre', 'avis', 'ref', c || ':12'))) <> 1 then raise exception 'FAIL rendre avis'; end if;
  if public.alerte_rendre(jsonb_build_array(jsonb_build_object('genre', 'signalement', 'ref', v_a || ':' || v_b))) <> 1 then raise exception 'FAIL rendre signalement'; end if;
  update requete_private.alerte_envoi set envois = 10, dernier = now() - interval '11 minutes' where jour = v_jour;
  v := public.alerte_prendre();
  if not exists (select 1 from jsonb_array_elements(v) e where e ->> 'genre' = 'contact' and e ->> 'ref' = v_id::text)
     or not exists (select 1 from jsonb_array_elements(v) e where e ->> 'genre' = 'avis' and e ->> 'ref' = c || ':12')
     or not exists (select 1 from jsonb_array_elements(v) e where e ->> 'genre' = 'signalement') then
    raise exception 'FAIL regroupement après l’attente (% lignes prises)', jsonb_array_length(v);
  end if;
  if (select envois from requete_private.alerte_envoi where jour = v_jour) <> 11 then raise exception 'FAIL un seul e-mail pour le lot'; end if;

  -- 7. Le rattrapage : il ne rappelle la fonction que s’il reste quelque chose
  v_file := pg_temp.alerte_file();
  if not requete_private.alerte_attend() then
    perform requete_private.alerte_rattraper();
    if pg_temp.alerte_file() <> v_file then raise exception 'FAIL rattrapage à vide'; end if;
  end if;
  insert into public.contact_message (cle, type, message) values (c, 'autre', 'à rattraper');
  v_file := pg_temp.alerte_file();
  perform requete_private.alerte_rattraper();
  if pg_temp.alerte_file() <> v_file + 1 then raise exception 'FAIL rattrapage'; end if;
end $$;

-- L’appli n’a aucun droit : ni prendre, ni rendre, ni lire le compte du jour
set local role anon;
do $$
begin
  begin perform public.alerte_prendre(); raise exception 'FAIL anon prend'; exception when insufficient_privilege then null; end;
  begin perform public.alerte_rendre('[]'); raise exception 'FAIL anon rend'; exception when insufficient_privilege then null; end;
  begin perform 1 from requete_private.alerte_envoi; raise exception 'FAIL anon lit'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$
begin
  begin perform public.alerte_prendre(); raise exception 'FAIL authenticated prend'; exception when insufficient_privilege then null; end;
  begin perform public.alerte_rendre('[]'); raise exception 'FAIL authenticated rend'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'alerte_mail : OK' as resultat;
rollback;
