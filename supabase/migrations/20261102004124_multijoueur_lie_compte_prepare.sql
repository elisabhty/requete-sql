-- Dormant account-based multiplayer. Existing guest identities remain unchanged.
create table requete_private.compte_jeu_config (
 singleton boolean primary key default true check(singleton), active boolean not null default false
);
insert into requete_private.compte_jeu_config(singleton,active) values(true,false);
create table requete_private.compte_jeu (
 user_id uuid primary key references auth.users(id) on delete cascade,
 secret text not null check(secret ~ '^[A-Za-z0-9]{24,64}$'),
 empreinte text generated always as (encode(extensions.digest(secret,'sha256'),'hex')) stored unique,
 cree_le timestamptz not null default now()
);
create table requete_private.compte_jeu_revoquee(empreinte text primary key check(empreinte ~ '^[a-f0-9]{64}$'));
alter table requete_private.compte_jeu_revoquee enable row level security;
revoke all on requete_private.compte_jeu_revoquee from public,anon,authenticated;
alter table requete_private.compte_jeu_config enable row level security;
alter table requete_private.compte_jeu enable row level security;
revoke all on requete_private.compte_jeu_config,requete_private.compte_jeu from public,anon,authenticated;
create index if not exists essai_compte_pid on requete_private.essai(pid);
create index if not exists membre_compte_pid on requete_private.membre(pid);
create index if not exists jeu_msg_compte_pid on public.jeu_msg((m->>'pid'));

-- A bound key alone is no longer a credential. Also blocks the legacy Edge
-- verifier (service-role JWT without this owner's auth.uid()). Locks serialize
-- guest operations with claiming the same key, preventing a claim/delete race.
create or replace function public.jeu_cle(p_cle text)
returns text language plpgsql volatile security definer set search_path='' as $$
declare k text; owner_id uuid;
begin
 if p_cle is null or p_cle !~ '^[A-Za-z0-9]{24,64}$' then return null; end if;
 k:=encode(extensions.digest(p_cle,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('jeu-key:'||k,0));
 if exists(select 1 from requete_private.compte_jeu_revoquee where empreinte=k) then
  raise exception 'Identité supprimée' using errcode='42501'; end if;
 select user_id into owner_id from requete_private.compte_jeu where empreinte=k;
 if owner_id is not null and (auth.uid() is distinct from owner_id or coalesce(auth.jwt()->>'is_anonymous','false')='true') then
  raise exception 'Connexion du propriétaire requise' using errcode='42501';
 end if;
 return k;
end; $$;
revoke all on function public.jeu_cle(text) from public,anon,authenticated;

create function requete_private.jeu_compte_uid()
returns uuid language plpgsql stable security invoker set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true'
  or not exists(select 1 from auth.users where id=u) then raise exception 'Connexion requise' using errcode='42501'; end if;
 if not coalesce((select active from requete_private.compte_jeu_config where singleton),false) then
  raise exception 'Multijoueur par compte non activé' using errcode='55000'; end if;
 return u;
end; $$;
create function requete_private.jeu_compte_secret()
returns text language plpgsql security invoker set search_path='' as $$
declare u uuid:=requete_private.jeu_compte_uid(); k text;
begin
 select secret into k from requete_private.compte_jeu where user_id=u;
 if k is null then raise exception 'Identité multijoueur à créer ou à lier' using errcode='42501'; end if;
 return k;
end; $$;

create function public.jeu_compte_identite()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=requete_private.jeu_compte_uid(); k text;
begin
 select secret into k from requete_private.compte_jeu where user_id=u;
 if k is null then return jsonb_build_object('linked',false); end if;
 return public.jeu_identite_v2(k)||jsonb_build_object('linked',true);
end; $$;
create function public.jeu_compte_creer(p_pseudo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=requete_private.jeu_compte_uid(); k text; result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('jeu-account:'||u::text,0));
 select secret into k from requete_private.compte_jeu where user_id=u;
 if k is not null then return public.jeu_identite_v2(k)||jsonb_build_object('linked',true); end if;
 k:=encode(extensions.gen_random_bytes(24),'hex');
 result:=public.jeu_pseudo_prendre(k,p_pseudo);
 if result->>'ok'<>'true' then return result; end if;
 insert into requete_private.compte_jeu(user_id,secret) values(u,k);
 return public.jeu_identite_v2(k)||jsonb_build_object('linked',true);
end; $$;
create function public.jeu_compte_lier(p_cle text,p_confirmation text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=requete_private.jeu_compte_uid(); k text; existing text;
begin
 if p_confirmation is distinct from 'LIER' then raise exception 'Confirmation requise' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('jeu-account:'||u::text,0));
 k:=public.jeu_cle(p_cle);
 if k is null or not exists(select 1 from public.jeu_pseudo where cle=k) then raise exception 'Clé du pseudo requise' using errcode='42501'; end if;
 select empreinte into existing from requete_private.compte_jeu where user_id=u;
 if existing is not null then
  if existing<>k then raise exception 'Ce compte possède déjà une identité multijoueur' using errcode='42501'; end if;
  return public.jeu_identite_v2(p_cle)||jsonb_build_object('linked',true);
 end if;
 if exists(select 1 from requete_private.membre where cle=k and not parti and vu>clock_timestamp()-interval '80 seconds') then
  raise exception 'Quitte la salle avant de lier ce pseudo' using errcode='55000'; end if;
 insert into requete_private.compte_jeu(user_id,secret) values(u,p_cle) on conflict do nothing;
 if not found then raise exception 'Identité déjà liée' using errcode='42501'; end if;
 return public.jeu_identite_v2(p_cle)||jsonb_build_object('linked',true);
end; $$;

create function public.jeu_compte_envoyer(p_salle text,p_m jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text:=requete_private.jeu_compte_secret(); identity jsonb;
begin
 if jsonb_typeof(p_m) is distinct from 'object' then raise exception 'Message invalide' using errcode='22023'; end if;
 identity:=public.jeu_identite_v2(k);
 -- Never trust the identity or display name supplied by a client.
 return public.jeu_envoyer_v2(p_salle,p_m||jsonb_build_object('pid',identity->>'pid','name',identity->>'pseudo'),k);
end; $$;
create function public.jeu_compte_historique(p_salle text,p_apres integer default 0)
returns table(n integer,at bigint,m jsonb) language plpgsql security definer set search_path='' as $$
begin return query select * from public.jeu_historique_v2(p_salle,p_apres,requete_private.jeu_compte_secret()); end; $$;
create function public.jeu_compte_score(p_salle text,p_g integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text:=requete_private.jeu_compte_secret(); identity jsonb;
begin
 identity:=public.jeu_identite_v2(k);
 return public.jeu_score_v2(k,identity->>'pseudo',jsonb_build_object('salle',p_salle,'g',p_g));
end; $$;
create function public.jeu_compte_classement()
returns jsonb language plpgsql security definer set search_path='' as $$
begin return public.jeu_classement(requete_private.jeu_compte_secret()); end; $$;
create function public.jeu_compte_defis()
returns jsonb language plpgsql security definer set search_path='' as $$
begin return public.jeu_defis_v2(requete_private.jeu_compte_secret()); end; $$;
create function public.jeu_compte_essai(p_salle text,p_g integer,p_n integer,p_id uuid,p_sql text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin return public.jeu_essai_v2(requete_private.jeu_compte_secret(),p_salle,p_g,p_n,p_id,p_sql); end; $$;

-- Erasure is implemented now: account deletion cannot leave a usable guest key.
create function requete_private.jeu_compte_supprimer()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_pid text:=left(old.empreinte,24);
begin
 perform pg_advisory_xact_lock(hashtextextended('jeu-key:'||old.empreinte,0));
 insert into requete_private.compte_jeu_revoquee(empreinte) values(old.empreinte) on conflict do nothing;
 delete from public.jeu_joueur where cle=old.empreinte; -- parties/signals cascade
 delete from public.jeu_pseudo where cle=old.empreinte;
 delete from public.jeu_msg where m->>'pid'=v_pid;
 delete from requete_private.essai where essai.pid=v_pid;
 delete from requete_private.membre where membre.pid=v_pid;
 update requete_private.manche set joueurs=joueurs-v_pid where joueurs?v_pid;
 return old;
end; $$;
create trigger compte_jeu_effacement before delete on requete_private.compte_jeu
 for each row execute function requete_private.jeu_compte_supprimer();

revoke all on function requete_private.jeu_compte_uid(),requete_private.jeu_compte_secret(),requete_private.jeu_compte_supprimer() from public,anon,authenticated;
revoke all on function public.jeu_compte_identite(),public.jeu_compte_creer(text),public.jeu_compte_lier(text,text),public.jeu_compte_envoyer(text,jsonb),public.jeu_compte_historique(text,integer),public.jeu_compte_score(text,integer),public.jeu_compte_classement(),public.jeu_compte_defis(),public.jeu_compte_essai(text,integer,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.jeu_compte_identite(),public.jeu_compte_creer(text),public.jeu_compte_lier(text,text),public.jeu_compte_envoyer(text,jsonb),public.jeu_compte_historique(text,integer),public.jeu_compte_score(text,integer),public.jeu_compte_classement(),public.jeu_compte_defis(),public.jeu_compte_essai(text,integer,integer,uuid,text) to authenticated;
