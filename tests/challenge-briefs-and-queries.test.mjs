import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const app=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const data=JSON.parse(JSON.stringify(vm.runInNewContext(app.slice(app.indexOf('const CHALLENGES=['),app.indexOf('const NIV='))+';({challenges:CHALLENGES,bases:DEFI_BASES})')));
const SQL=await createRequire(import.meta.url)('../vendor/sqljs/sql-wasm.js')({locateFile:f=>new URL('../vendor/sqljs/'+f,import.meta.url).pathname});
const challenge=id=>data.challenges.find(c=>c.id===id);
const base=name=>{const db=new SQL.Database();db.run(data.bases[name].sql);return db;};
const rows=(db,id)=>db.exec(challenge(id).sol)[0]?.values||[];
const table=(db,name)=>{const r=db.exec('SELECT * FROM '+name)[0];return r.values.map(row=>Object.fromEntries(r.columns.map((key,i)=>[key,row[i]])));};
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const round=n=>Math.round((n+Number.EPSILON)*100)/100;

test('tous les contextes contiennent la mission complète, sans renvoi à une question cachée',()=>{
 for(const c of data.challenges){
  assert.ok(c.contexte.includes(c.q),c.id+': colonnes, conditions et tri explicites');
  assert.doesNotMatch(c.contexte,/voir (?:la question|la consigne)|comme (?:ci-dessus|précédemment)/i,c.id);
  assert.ok(c.contexte.split(/\s+/).length<=130,c.id+': contexte lisible');
 }
});

test('toutes les solutions s’exécutent en lecture seule avec un résultat et un ordre stable',()=>{
 for(const c of data.challenges){const db=base(c.base);try{
  assert.equal(db.exec('PRAGMA foreign_key_check').length,0,c.id+': intégrité du seed');
  db.run('PRAGMA query_only=ON');
  const expected=rows(db,c.id);assert.ok(expected.length,c.id+': résultat non vide');
  db.run('PRAGMA reverse_unordered_selects=ON');
  if(c.ordered)assert.deepEqual(rows(db,c.id),expected,c.id+': tri stable');
 }finally{db.close();}}
});

test('les destinations par ville fusionnent plusieurs aéroports et conservent les ex æquo',()=>{
 const db=base('aeroport');try{
  db.run("UPDATE aeroports SET ville='Ville commune' WHERE id IN (SELECT id FROM aeroports ORDER BY id LIMIT 2)");
  const airports=new Map(table(db,'aeroports').map(a=>[a.id,a.ville]));
  const flights=new Map(table(db,'vols').map(v=>[v.id,airports.get(v.aeroport_arrivee_id)]));
  const counts=new Map();for(const r of table(db,'reservations')){const city=flights.get(r.vol_id);counts.set(city,(counts.get(city)||0)+1);}
  const sorted=[...counts].sort((a,b)=>b[1]-a[1]||cmp(a[0],b[0]));
  assert.deepEqual(rows(db,'am3'),sorted.slice(0,5));
  assert.deepEqual(rows(db,'ad2'),sorted.map(([city,n],i,a)=>[city,n,a.findIndex(x=>x[1]===n)+1]));
 }finally{db.close();}
});

test('un gros achat annulé ne modifie aucun indicateur commercial du restaurant',()=>{
 const db=base('wok');try{
  const ids=['wm1','wm3','wm4','wm5','wm7','wm8','wm10','wd1','wd2','wd3','wd4','wd5','wd6','wd7','wd8','wd9','wd10'];
  const before=new Map(ids.map(id=>[id,rows(db,id)]));
  db.run("INSERT INTO commandes SELECT 99999,1,serveur_id,table_id,'2024-01-02','12:00',2,'Annulée' FROM commandes LIMIT 1");
  db.run("INSERT INTO lignes_commande SELECT 99999,99999,id,999999,999 FROM plats ORDER BY id DESC LIMIT 1");
  for(const id of ids)assert.deepEqual(rows(db,id),before.get(id),id+': annulation exclue');
 }finally{db.close();}
});

test('le panier moyen du restaurant est une moyenne de commandes, pas une moyenne de lignes',()=>{
 const db=base('wok');try{
  const orders=new Map(table(db,'commandes').filter(c=>c.statut!=='Annulée'&&c.client_id!==null).map(c=>[c.id,{client:c.client_id,total:0,hasLine:false}]));
  for(const l of table(db,'lignes_commande'))if(orders.has(l.commande_id)){const o=orders.get(l.commande_id);o.total+=l.quantite*l.prix_unitaire;o.hasLine=true;}
  const totals=new Map();for(const o of orders.values())if(o.hasLine){if(!totals.has(o.client))totals.set(o.client,[]);totals.get(o.client).push(o.total);}
  const expected=table(db,'clients').filter(c=>totals.has(c.id)).map(c=>[c.prenom,c.nom,round(totals.get(c.id).reduce((a,b)=>a+b,0)/totals.get(c.id).length)]).sort((a,b)=>b[2]-a[2]||cmp(a[1],b[1])||cmp(a[0],b[0]));
  assert.deepEqual(rows(db,'wm3'),expected);
 }finally{db.close();}
});

test('voyages : le panier moyen inclut les réservations sans paiement payé avec zéro',()=>{
 const db=base('voyages');try{
  const payments=new Map();for(const p of table(db,'paiements'))if(p.statut==='Payé')payments.set(p.reservation_id,(payments.get(p.reservation_id)||0)+p.montant);
  const totals=new Map();for(const r of table(db,'reservations')){if(!totals.has(r.client_id))totals.set(r.client_id,[]);totals.get(r.client_id).push(payments.get(r.id)||0);}
  const expected=table(db,'clients').filter(c=>totals.has(c.id)).map(c=>[c.prenom,c.nom,round(totals.get(c.id).reduce((a,b)=>a+b,0)/totals.get(c.id).length)]).sort((a,b)=>b[2]-a[2]||cmp(a[1],b[1])||cmp(a[0],b[0]));
  assert.deepEqual(rows(db,'vm3'),expected);
 }finally{db.close();}
});

test('voyages : plusieurs paiements ne multiplient pas les personnes, les annulations sont exclues',()=>{
 const db=base('voyages');try{
  db.run("INSERT INTO paiements SELECT 99999,reservation_id,1,date_paiement,moyen,'Payé' FROM paiements WHERE statut='Payé' LIMIT 1");
  db.run("UPDATE reservations SET nb_personnes=999999 WHERE statut='Annulée'");
  const orders=new Map(table(db,'reservations').filter(r=>r.statut!=='Annulée').map(r=>[r.id,r]));
  const totals=new Map();for(const r of orders.values()){if(!totals.has(r.circuit_id))totals.set(r.circuit_id,{people:0,paid:0});totals.get(r.circuit_id).people+=r.nb_personnes;}
  for(const p of table(db,'paiements'))if(p.statut==='Payé'&&orders.has(p.reservation_id))totals.get(orders.get(p.reservation_id).circuit_id).paid+=p.montant;
  const expected=table(db,'circuits').filter(c=>totals.has(c.id)).map(c=>[c.nom,totals.get(c.id).people,round(totals.get(c.id).paid)]).sort((a,b)=>b[1]-a[1]||cmp(a[0],b[0])).slice(0,5);
  assert.deepEqual(rows(db,'vm4'),expected);
 }finally{db.close();}
});

test('le prix moyen du fromage est pondéré par les kilos, pas la moyenne des prix unitaires',()=>{
 const db=base('fromagerie');try{
  const lots=new Map(table(db,'lots').map(l=>[l.id,l.fromage_id]));const totals=new Map();let price=0,weight=0;
  for(const v of table(db,'ventes')){const id=lots.get(v.lot_id);if(!totals.has(id))totals.set(id,{price:0,weight:0});totals.get(id).price+=v.prix_total;totals.get(id).weight+=v.quantite_kg;price+=v.prix_total;weight+=v.quantite_kg;}
  const expected=table(db,'fromages').filter(f=>totals.has(f.id)&&totals.get(f.id).price/totals.get(f.id).weight>price/weight).map(f=>[f.nom,round(totals.get(f.id).price/totals.get(f.id).weight)]).sort((a,b)=>b[1]-a[1]||cmp(a[0],b[0]));
  assert.deepEqual(rows(db,'fd10'),expected);
 }finally{db.close();}
});

test('une équipe sans publication ne fait pas réussir automatiquement le défi des revues',()=>{
 const db=base('labo');try{
  db.run('DELETE FROM publications');
  assert.deepEqual(rows(db,'ld6'),[]);
 }finally{db.close();}
});
