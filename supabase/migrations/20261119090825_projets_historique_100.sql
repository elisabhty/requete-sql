-- 19 novembre, 10 h 05 (Elisa : « quand on se déconnecte et on se reconnecte, on n’aura plus l’historique » ; « oui, direct pour tout
-- le monde ») : l’historique des exécutions suit le projet sur le compte, ses 100 dernières (l’appareil en garde 100 ; c’était 24).
create or replace function requete_private.projets_valide(p_cle text, p_data jsonb)
 returns boolean
 language plpgsql
 immutable
 set search_path to ''
as $function$
declare k text; v jsonb; q jsonb; kind text;
begin
 if p_cle is null or p_cle !~ '^project:db_[A-Za-z0-9_.-]{1,93}$' or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>4194304 then return false;end if;
 if not(p_data ?& array['name','scope','draft','desc','tdesc','pins','hist','database','baselines']) or (p_data-'name'-'scope'-'draft'-'desc'-'tdesc'-'pins'-'hist'-'database'-'baselines')<>'{}'::jsonb then return false;end if;
 if jsonb_typeof(p_data->'name')<>'string' or length(p_data->>'name')>80 or p_data->>'name' !~ '[^[:space:]]'
  or jsonb_typeof(p_data->'scope')<>'string' or p_data->>'scope' not in ('workspace','complete')
  or jsonb_typeof(p_data->'draft')<>'string' or length(p_data->>'draft')>12000
  or jsonb_typeof(p_data->'desc')<>'string' or length(p_data->>'desc')>4000
  or jsonb_typeof(p_data->'tdesc')<>'object' or jsonb_typeof(p_data->'pins')<>'array'
  or jsonb_typeof(p_data->'hist')<>'array' or jsonb_typeof(p_data->'baselines')<>'object' then return false;end if;
 if (select count(*) from jsonb_object_keys(p_data->'tdesc'))>128 or (select count(*) from jsonb_object_keys(p_data->'baselines'))>128 or jsonb_array_length(p_data->'pins')>12 or jsonb_array_length(p_data->'hist')>100 then return false;end if;
 for k,v in select * from jsonb_each(p_data->'tdesc') loop
  if length(k) not between 1 and 128 or jsonb_typeof(v)<>'string' or length(v#>>'{}')>4000 then return false;end if;
 end loop;
 foreach kind in array array['pins','hist'] loop
  for q in select value from jsonb_array_elements(p_data->kind) loop
   if jsonb_typeof(q)<>'object' or not(q ?& array['sql','ts']) then return false;end if;
   if (kind='pins' and (q-'sql'-'ts')<>'{}'::jsonb) or (kind='hist' and (q-'sql'-'ts'-'ok'-'n'-'ms'-'err')<>'{}'::jsonb) then return false;end if;
   if jsonb_typeof(q->'sql')<>'string' or length(q->>'sql')>12000 or q->>'sql' !~ '[^[:space:]]' or jsonb_typeof(q->'ts')<>'number' or q->>'ts' !~ '^[0-9]{1,13}$' then return false;end if;
   if (q->>'ts')::bigint>4102444800000 then return false;end if;
   if q?'ok' and jsonb_typeof(q->'ok')<>'boolean' then return false;end if;
   if q?'n' then
    if jsonb_typeof(q->'n')<>'number' or q->>'n' !~ '^[0-9]{1,10}$' then return false;end if;
    if (q->>'n')::bigint>1000000000 then return false;end if;
   end if;
   if q?'ms' then
    if jsonb_typeof(q->'ms')<>'number' then return false;end if;
    if (q->>'ms')::numeric<0 or (q->>'ms')::numeric>86400000 then return false;end if;
   end if;
   if q?'err' and (jsonb_typeof(q->'err')<>'string' or length(q->>'err')>2000) then return false;end if;
  end loop;
 end loop;
 if p_data->>'scope'='workspace' then
  if p_data->'database'<>'null'::jsonb or p_data->'baselines'<>'{}'::jsonb then return false;end if;
 else
  if not requete_private.projets_sqlite_valide(p_data->'database') then return false;end if;
 end if;
 for k,v in select * from jsonb_each(p_data->'baselines') loop
  if length(k) not between 1 and 128 or jsonb_typeof(v)<>'object' or not(v ?& array['name','b64']) or (v-'name'-'b64')<>'{}'::jsonb or jsonb_typeof(v->'name')<>'string' or length(v->>'name') not between 1 and 128 then return false;end if;
  if not requete_private.projets_sqlite_valide(v-'name') then return false;end if;
 end loop;
 return true;
end; $function$;
