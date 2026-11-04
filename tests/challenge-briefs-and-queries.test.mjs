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

/* Elisa, 4 novembre, 20 h 33 : en salle, le joueur ne voit que la consigne ; elle dit point par point tout le résultat attendu
   (« Affiche » : une ligne par colonne ; « Garde » ; « Trie » si l’ordre est vérifié ; « À savoir »). Six défis attendent sa
   décision (à retirer, ou à refaire avec la requête proposée) et gardent leur ancien texte. */
const EN_ATTENTE=['ld1','ld9','zm8','zd6','sm9','sd3'];
test('chaque consigne dit point par point le résultat attendu, sans renvoi à une question cachée',()=>{
 for(const c of data.challenges){
  if(EN_ATTENTE.includes(c.id)){assert.ok(c.contexte.includes(c.q),c.id+': ancien texte complet, en attente');continue;}
  assert.ok(c.situation&&Array.isArray(c.affiche)&&c.affiche.length&&Array.isArray(c.garde)&&Array.isArray(c.precis),c.id+': situation, affiche, garde, à savoir');
  assert.equal(c.contexte,undefined,c.id+': plus d’ancien texte');
  const db=base(c.base);let cols;try{cols=db.exec(c.sol)[0]?.columns;}finally{db.close();}
  if(cols)assert.equal(c.affiche.length,cols.length,c.id+': un point « Affiche » par colonne du résultat');
  if(!c.ordered)assert.equal(c.tri,undefined,c.id+': ordre libre, pas de tri');
  else if(c.tri)assert.match(c.tri,/^par /,c.id+': le tri commence par « par »');
  const t=[c.titre,c.situation,...c.affiche,...c.garde,c.tri||'',...c.precis].join(' ');
  assert.doesNotMatch(t,/voir (?:la question|la consigne)|comme (?:ci-dessus|précédemment)/i,c.id);
  assert.ok(t.split(/\s+/).length<=170,c.id+': consigne lisible d’un coup d’œil');
  assert.doesNotMatch(t.replace(/«[^»]*»/g,''),/['"]/,c.id+': apostrophes et guillemets typographiques');
  assert.doesNotMatch(t,/ [?!;:]/,c.id+': espace insécable avant la ponctuation');
 }
});

test('toutes les solutions s’exécutent en lecture seule avec un résultat et un ordre stable',()=>{
 for(const c of data.challenges){const db=base(c.base);try{
  assert.equal(db.exec('PRAGMA foreign_key_check').length,0,c.id+': intégrité du seed');
  db.run('PRAGMA query_only=ON');
  const expected=rows(db,c.id);if(['zm8','zd6','sm9'].includes(c.id))assert.equal(expected.length,0,c.id+': résultat vide prévu dans cette base');else assert.ok(expected.length,c.id+': résultat non vide');
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

test('sport : un cours sans créneau reste dans les compteurs et deux créneaux ne cumulent pas leur capacité',()=>{
 const db=base('salle_sport');try{
  const slot=table(db,'planning')[0],signup=table(db,'inscriptions_cours')[0];
  db.run('DELETE FROM inscriptions_cours; DELETE FROM planning');
  assert.equal(rows(db,'sm1').length,table(db,'cours').length);
  assert.ok(rows(db,'sm1').every(r=>r[1]===0));
  db.run('UPDATE cours SET capacite_max=2 WHERE id=?',[slot.cours_id]);
  const insert=(name,row)=>db.run('INSERT INTO '+name+' ('+Object.keys(row).join(',')+') VALUES ('+Object.keys(row).map(()=>'?').join(',')+')',Object.values(row));
  for(const id of [90001,90002]){
   insert('planning',{...slot,id});
   insert('inscriptions_cours',{...signup,id,planning_id:id});
  }
  assert.deepEqual(rows(db,'sm6'),[],'un inscrit par créneau pour deux places : aucun créneau plein');
 }finally{db.close();}
});

test('les bilans mensuels ne fusionnent pas septembre de deux années différentes',()=>{
 const db=base('salle_sport');try{
  const camille=table(db,'adherents').find(a=>a.prenom==='Camille'&&a.nom==='Moreau');
  const row=table(db,'inscriptions_cours').find(i=>i.adherent_id===camille.id);
  const copy={...row,id:99999,date_inscription:'2025-09-02'};
  db.run('INSERT INTO inscriptions_cours ('+Object.keys(copy).join(',')+') VALUES ('+Object.keys(copy).map(()=>'?').join(',')+')',Object.values(copy));
  assert.deepEqual(rows(db,'sd3'),[['2024-09',3,null,null],['2025-09',1,3,-2]]);
 }finally{db.close();}
});
