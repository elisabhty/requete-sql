import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPrivateProfile,validatePrivateProfile,extractPrivateProfile} from '../account/profile.mjs';
function setup(){
 let row=null;const requests=[];
 const auth={id:'A',async getSession(){return {data:{session:{access_token:'token:'+auth.id}}};},async getUser(token){return {data:{user:{id:token.slice(6),is_anonymous:false}}};}};
 const options={accountId:'A',auth,url:'https://example.supabase.co',apikey:'public',enabled:true,fetcher:async(url,args)=>{
  const body=JSON.parse(args.body);requests.push({url,body,token:args.headers.Authorization});let result;
  if(url.pathname.endsWith('lire'))result=row;
  else if(url.pathname.endsWith('creer')){row||={user_id:'A',prenom:'',objectif:'',fuseau_horaire:'UTC',...body.p_donnees,revision:1};result=row;}
  else if(body.p_revision!==row?.revision)result={ok:false,reason:'revision_or_missing',profile:row};
  else{row={...row,...body.p_donnees,revision:row.revision+1};result={ok:true,profile:row};}
  return new Response(JSON.stringify(result));
 }};
 return {options,auth,requests,api:createPrivateProfile(options)};
}
test('le profil privé est inactif et absent des écrans',async()=>{
 const p=createPrivateProfile();assert.deepEqual(await p.current(),{enabled:false,profile:null});await assert.rejects(p.create({prenom:'Elisa'}),{code:'profile_disabled'});
 for(const file of ['index.html','sw.js','decouvrir/connexion.html'])assert.doesNotMatch(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),/account\/profile\.mjs/);
});
test('la préparation du profil local exclut âge, métier, signatures, secrets et scores',()=>{
 const p=extractPrivateProfile({name:' Elisa ',profile:{goal:'work',ageRange:'PRIVATE',job:'PRIVATE',pacte:'PRIVATE'},notes:['PRIVATE'],pts:999},{timeZone:'Europe/Paris'});
 assert.deepEqual(p,{prenom:'Elisa',objectif:'work',fuseau_horaire:'Europe/Paris'});assert.doesNotMatch(JSON.stringify(p),/PRIVATE|pts/);
});
test('les champs inconnus, objectifs et fuseaux invalides sont refusés',()=>{
 for(const p of [{},{email:'x'}, {objectif:'unknown'},{fuseau_horaire:'Mars/Paris'},{prenom:'a\nb'},{prenom:'x'.repeat(81)}])assert.throws(()=>validatePrivateProfile(p),{code:'invalid_profile'});
 assert.equal(validatePrivateProfile({prenom:'😀'.repeat(80)}).prenom.length,160);
});
test('la création répétée conserve le profil cloud et ne déclenche aucun import implicite',async()=>{
 const d=setup();assert.equal(await d.api.current(),null);await d.api.create({prenom:'Elisa',objectif:'work'});const p=await d.api.create({prenom:'Invité'});assert.equal(p.prenom,'Elisa');assert.equal(p.objectif,'work');
});
test('deux appareils ne peuvent pas remplacer un profil avec une ancienne version',async()=>{
 const d=setup(),other=createPrivateProfile(d.options);await d.api.create({prenom:'Elisa'});const a=await d.api.current(),b=await other.current();
 assert.equal((await d.api.update({objectif:'work'},{revision:a.revision})).ok,true);
 const conflict=await other.update({prenom:'Ancien'},{revision:b.revision});assert.equal(conflict.ok,false);assert.equal(conflict.profile.prenom,'Elisa');assert.equal(conflict.profile.objectif,'work');
 const saved=await other.update({prenom:'Alice'},{revision:conflict.profile.revision});assert.equal(saved.profile.objectif,'work');assert.equal(saved.profile.prenom,'Alice');
});
test('une version affichée est obligatoire, même pour modifier seulement le prénom',()=>{
 assert.throws(()=>setup().api.update({prenom:'Elisa'}),{code:'revision_required'});
});
test('un changement de compte bloque la requête et un jeton capturé reste attaché au compte vérifié',async()=>{
 const d=setup();d.auth.id='B';await assert.rejects(d.api.current(),{code:'wrong_account'});assert.equal(d.requests.length,0);
 d.auth.id='A';const real=d.options.fetcher;d.options.fetcher=async(...args)=>{d.auth.id='B';return real(...args);};await createPrivateProfile(d.options).current();assert.equal(d.requests[0].token,'Bearer token:A');
});
test('une panne ne produit aucune fausse sauvegarde et aucune persistance locale',async()=>{
 const d=setup();d.options.fetcher=async()=>{throw Error('offline');};await assert.rejects(createPrivateProfile(d.options).create({prenom:'Elisa'}),/offline/);assert.equal(d.requests.length,0);
});
