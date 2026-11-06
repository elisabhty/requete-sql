-- Suite de defis_deja_joues. La liste des défis joués et trouvés suit désormais la place au classement (public.jeu_joueur, clé
-- étrangère en cascade) : « Retirer mes scores du classement » et « Effacer la progression » (jeu_oublier), comme « Supprimer mon
-- compte », effacent la place, donc la liste, comme le promettent l’appli et la page de confidentialité. Un joueur qui a retiré ses
-- scores n’est plus suivi (« tes prochaines parties ne sont plus envoyées ») ; un nouveau joueur l’est dès la fin de sa première
-- partie : jeu_score_v2, qui l’inscrit au classement, note alors les défis de cette partie.
-- (Les trois lignes reprises des dernières 24 heures, d’un joueur pas encore au classement, restent hors de cette règle : not valid.)

-- 1. Les trois endroits qui notent un défi le font seulement pour un joueur du classement
do $$
declare
  def text; nb integer;
  remplacer constant text[][] := array[
    ['public.jeu_envoyer_v2(text,jsonb,text)',
     'select x.cle,selected,r.niv from unnest(cles) as x(cle) where x.cle is not null and exists(select 1 from public.jeu_pseudo p where p.cle=x.cle)',
     'select x.cle,selected,r.niv from unnest(cles) as x(cle) where x.cle is not null and exists(select 1 from public.jeu_pseudo p where p.cle=x.cle) and exists(select 1 from public.jeu_joueur j where j.cle=x.cle)'],
    ['public.jeu_envoyer_v2(text,jsonb,text)',
     'select k,x.defi,r.niv from requete_private.manche x where x.code=p_salle and x.generation=r.generation and not x.fermee and x.joueurs ? v_pid',
     'select k,x.defi,r.niv from requete_private.manche x where x.code=p_salle and x.generation=r.generation and not x.fermee and x.joueurs ? v_pid and exists(select 1 from public.jeu_joueur j where j.cle=k)'],
    ['public.jeu_valider_v2(uuid,boolean)',
     'and mb.cle is not null and exists(select 1 from public.jeu_pseudo p where p.cle=mb.cle)',
     'and mb.cle is not null and exists(select 1 from public.jeu_pseudo p where p.cle=mb.cle) and exists(select 1 from public.jeu_joueur j where j.cle=mb.cle)']];
begin
  for i in 1..array_length(remplacer, 1) loop
    def := pg_get_functiondef(remplacer[i][1]::regprocedure);
    nb := (length(def) - length(replace(def, remplacer[i][2], ''))) / length(remplacer[i][2]);
    if nb <> 1 then raise exception '% : passage introuvable (% fois)', remplacer[i][1], nb; end if;
    execute replace(def, remplacer[i][2], remplacer[i][3]);
  end loop;
end $$;

-- 2. Fin de partie : le joueur entre au classement (jeu_score), puis les défis de la partie sont notés, trouvés compris
do $$
declare
  def text;
  decl_avant constant text := 'v_x integer; v_d integer;';
  fin_avant constant text := 'return public.jeu_score(p_cle,p_pseudo,jsonb_build_object(''u'',receipt,''pts'',pts,''n'',n,''ok'',ok,''solo'',case when all_solo then 1 else 0 end,''niv'',r.niv));';
begin
  def := pg_get_functiondef('public.jeu_score_v2(text,text,jsonb)'::regprocedure);
  if (length(def) - length(replace(def, decl_avant, ''))) / length(decl_avant) <> 1 then raise exception 'jeu_score_v2 : déclarations introuvables'; end if;
  if (length(def) - length(replace(def, fin_avant, ''))) / length(fin_avant) <> 1 then raise exception 'jeu_score_v2 : fin introuvable'; end if;
  def := replace(def, decl_avant, 'v_x integer; v_d integer; res jsonb;');
  def := replace(def, fin_avant,
'res:=public.jeu_score(p_cle,p_pseudo,jsonb_build_object(''u'',receipt,''pts'',pts,''n'',n,''ok'',ok,''solo'',case when all_solo then 1 else 0 end,''niv'',r.niv));
 -- les défis de la partie, notés pour ce joueur maintenant qu’il est au classement (sa première partie comprise)
 insert into requete_private.defi_joue(cle,defi,niv,vu,dernier,trouve)
 select k,rd.defi,c.niv,rd.debut,rd.debut,(select min(e.cree) from requete_private.essai e where e.code=rd.code and e.generation=rd.generation and e.numero=rd.numero and e.pid=v_pid and e.juste)
 from requete_private.manche rd join requete_private.catalogue c on c.id=rd.defi
 where rd.code=v_code and rd.generation=v_g and rd.joueurs ? v_pid
   and exists(select 1 from public.jeu_pseudo p where p.cle=k) and exists(select 1 from public.jeu_joueur j where j.cle=k)
 on conflict (cle,defi) do update set trouve=coalesce(requete_private.defi_joue.trouve,excluded.trouve);
 return res;');
  execute def;
end $$;

-- 3. La liste suit la place au classement
alter table requete_private.defi_joue
  add constraint defi_joue_classement_fkey foreign key (cle) references public.jeu_joueur (cle) on delete cascade not valid;
