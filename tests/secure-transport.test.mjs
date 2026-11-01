import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function jeuSupabase('),html.indexOf('/* Retour au premier plan, réseau retrouvé'));
const settle=()=>new Promise(r=>setTimeout(r,30));
test('un broadcast public falsifié ne devient jamais un message de jeu vérifié',async()=>{
 const calls=[],delivered=[],rows=[],sockets=[];
 class Socket{
  constructor(){this.readyState=1;sockets.push(this);queueMicrotask(()=>this.onopen?.());}
  send(raw){const f=JSON.parse(raw);if(f.event==='phx_join')queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({topic:f.topic,event:'phx_reply',ref:f.ref,payload:{status:'ok'}})}));}
  close(){this.readyState=3;}
  broadcast(m){this.onmessage({data:JSON.stringify({topic:'realtime:salle:ABC123',event:'broadcast',payload:{payload:m}})});}
 }
 const ctx=vm.createContext({setTimeout,clearTimeout,setInterval,clearInterval,AbortController,Date,Promise,JSON,Math,WebSocket:Socket,
  JEU_SB:'https://test.supabase.co',JEU_SB_KEY:'public-test',JEU_HB_MS:15000,JEU:null,
  window:{REQUETE_SECURE_MULTIPLAYER:true},clsCle:()=> 'secret-device-key-not-broadcast',
  fetch:async(url,opt)=>{calls.push({url,body:JSON.parse(opt.body)});return{ok:true,json:async()=>url.endsWith('/jeu_historique_v2')?rows:{n:1,at:Date.now()}};}
 });
 vm.runInContext(source,ctx);
 const transport=ctx.jeuSupabase('ABC123',m=>delivered.push(m),()=>{});
 try{
  await settle();assert.equal(calls.length,0,'no history read before authenticated enrolment');
  await transport.send({t:'hello',pid:'mine',u:'hello000'});await settle();
  sockets[0].broadcast({n:9999,at:Date.now(),m:{v:1,t:'found',pid:'victim',ms:0,p1:1}});await settle();
  assert.equal(delivered.length,0,'unsolicited broadcast ignored');
  rows.push({n:1,at:Date.now(),m:{v:1,t:'found',pid:'verified',ms:1250,p1:0}});
  sockets[0].broadcast({n:10000,m:{t:'found',pid:'forged'}});await new Promise(r=>setTimeout(r,220));
  assert.equal(delivered.length,1);assert.equal(delivered[0].pid,'verified');assert.equal(delivered[0].ms,1250);
  assert.ok(calls.every(c=>c.url.endsWith('_v2')&&c.body.p_cle==='secret-device-key-not-broadcast'));
 }finally{transport.close();}
});
