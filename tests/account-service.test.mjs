import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createAccountService} from '../account/service.mjs';

const user={id:'own-user',email:'alice@example.test',is_anonymous:false};
const settings={enabled:true,redirectUrl:'https://elisabhty.github.io/requete-sql/decouvrir/connexion.html'};
function fake({profile=null,session=true,existingProfileOnInsert=false}={}){
 const calls=[];let row=profile;
 const client={auth:{
  getUser:async()=>{calls.push(['getUser']);return {data:{user},error:null};},
  signUp:async args=>{calls.push(['signUp',args]);return {data:{user,session:session?{user}:null},error:null};},
  signInWithPassword:async args=>{calls.push(['signIn',args]);return {data:{user,session:session?{user}:null},error:null};},
  signInWithOAuth:async args=>{calls.push(['oauth',args]);return {data:{url:'https://apple.example.test'},error:null};},
  resetPasswordForEmail:async(...args)=>{calls.push(['reset',...args]);return {data:{},error:null};},
  updateUser:async args=>{calls.push(['updateUser',args]);return {data:{user},error:null};},
  signOut:async args=>{calls.push(['signOut',args]);return {error:null};}
 },functions:{invoke:async(...args)=>{calls.push(['invoke',...args]);return {data:{deleted:true},error:null};}},from(name){
  calls.push(['from',name]);let operation='select',payload;
  const q={select(){return q;},eq(key,id){calls.push(['eq',key,id]);return q;},insert(value){operation='insert';payload=value;calls.push(['insert',value]);return q;},update(value){operation='update';payload=value;calls.push(['update',value]);return q;},async maybeSingle(){return {data:row,error:null};},async single(){
   if(operation==='insert'&&existingProfileOnInsert){row={user_id:user.id,prenom:'Déjà créé'};return {data:null,error:{code:'23505'}};}
   if(operation==='insert')row=payload;
   if(operation==='update')row={...row,...payload};
   return {data:row,error:null};
  }};return q;
 }};
 return {client,calls};
}
test('le service importé et construit reste inactif et ne fait aucun appel',async()=>{
 const {client,calls}=fake();const service=createAccountService(client);
 assert.deepEqual(await service.current(),{enabled:false,user:null,profile:null});
 for(const call of [()=>service.signUp({email:user.email,password:'long-password'}),()=>service.signIn({email:user.email,password:'x'}),()=>service.ensureProfile(),()=>service.signOut(),()=>service.deleteAccount('SUPPRIMER')])await assert.rejects(call(),{code:'accounts_disabled'});
 assert.deepEqual(calls,[]);assert.deepEqual(service.availableProviders,[]);
});
test('une inscription à confirmer ne fait pas croire que le compte est connecté',async()=>{
 const {client,calls}=fake({session:false});const service=createAccountService(client,settings);
 assert.deepEqual(await service.signUp({email:'  alice@example.test ',password:' long-password '}),{user:null,confirmationRequired:true});
 assert.equal(calls[0][1].password,' long-password ');
 assert.equal(calls.some(c=>c[0]==='from'),false,'pas de profil avant la confirmation');
});
test('les entrées et les fournisseurs non configurés sont refusés avant tout envoi',async()=>{
 const {client,calls}=fake();const service=createAccountService(client,settings);
 await assert.rejects(service.signUp({email:'incorrect',password:'long-password'}),{code:'invalid_email'});
 await assert.rejects(service.signUp({email:user.email,password:'short'}),{code:'invalid_password'});
 await assert.rejects(service.startProvider('apple'),{code:'provider_disabled'});
 await assert.rejects(service.startProvider('google'),{code:'provider_disabled'});
 await assert.rejects(createAccountService(client,{...settings,redirectUrl:'javascript:alert(1)'}).signUp({email:user.email,password:'long-password'}),{code:'invalid_redirect'});
 assert.deepEqual(calls,[]);
});
test('un compte existant conserve son prénom et son identité serveur',async()=>{
 const profile={user_id:user.id,prenom:'Alice'};const {client,calls}=fake({profile});const service=createAccountService(client,settings);
 assert.deepEqual(await service.ensureProfile('Autre prénom local'),profile);
 assert.ok(calls.some(c=>c[0]==='eq'&&c[2]===user.id));
 assert.equal(calls.some(c=>c[0]==='insert'||c[0]==='update'),false);
});
test('la connexion exige une vraie session et ne crée pas le profil dans la foulée',async()=>{
 const {client,calls}=fake();const service=createAccountService(client,settings);
 assert.deepEqual(await service.signIn({email:user.email,password:'existing-password'}),{user});
 assert.deepEqual(calls,[['signIn',{email:user.email,password:'existing-password'}]]);
 client.auth.signInWithPassword=async()=>({data:{user,session:null},error:null});
 await assert.rejects(service.signIn({email:user.email,password:'existing-password'}),{code:'not_signed_in'});
});
test('la récupération ne peut modifier un mot de passe sans utilisateur vérifié',async()=>{
 const {client,calls}=fake();const service=createAccountService(client,settings);
 await service.changePassword('new-long-password');
 assert.deepEqual(calls,[['getUser'],['updateUser',{password:'new-long-password'}]]);
 client.auth.getUser=async()=>({data:{user:null},error:{code:'bad_jwt',message:'internal details'}});
 await assert.rejects(service.changePassword('new-long-password'),{code:'bad_jwt',message:'L’opération est indisponible. Réessaie dans un instant.'});
 assert.equal(calls.filter(c=>c[0]==='updateUser').length,1);
});
test('deux appareils peuvent initialiser le profil sans écraser le premier',async()=>{
 const {client}=fake({existingProfileOnInsert:true});const service=createAccountService(client,settings);
 assert.deepEqual(await service.ensureProfile('Invité'),{user_id:user.id,prenom:'Déjà créé'});
});
test('seul le prénom peut être envoyé à la modification du profil',async()=>{
 const {client,calls}=fake({profile:{user_id:user.id,prenom:'Alice'}});const service=createAccountService(client,settings);
 await service.updateProfile({prenom:'  Elisa  ',user_id:'other-user',role:'admin'});
 assert.deepEqual(calls.find(c=>c[0]==='update')[1],{prenom:'Elisa'});
 assert.ok(calls.some(c=>c[0]==='eq'&&c[2]===user.id));
});
test('la déconnexion est locale par défaut et globale seulement sur demande',async()=>{
 const {client,calls}=fake();const service=createAccountService(client,settings);
 await service.signOut();await service.signOut({allDevices:true});
 assert.deepEqual(calls,[['signOut',{scope:'local'}],['signOut',{scope:'global'}]]);
});
test('la récupération du mot de passe utilise le retour configuré et un message neutre',async()=>{
 const {client,calls}=fake();const service=createAccountService(client,settings);
 const result=await service.requestPasswordReset(user.email);
 assert.ok(result.message.startsWith('Si cette adresse'));
 assert.equal(calls[0][2].redirectTo,settings.redirectUrl);
});
test('un utilisateur anonyme ou une session manquante ne donnent pas accès au profil',async()=>{
 const {client,calls}=fake();client.auth.getUser=async()=>({data:{user:{...user,is_anonymous:true}}});
 await assert.rejects(createAccountService(client,settings).ensureProfile(),{code:'not_signed_in'});
 assert.deepEqual(calls,[]);
 client.auth.getUser=async()=>({data:{user:null},error:{name:'AuthSessionMissingError'}});
 assert.equal((await createAccountService(client,settings).current()).user,null);
});
test('une suppression exige une confirmation et passe par le serveur avec aucun identifiant fourni',async()=>{
 const {client,calls}=fake();const service=createAccountService(client,settings);
 await assert.rejects(service.deleteAccount('oui'),{code:'confirmation_required'});
 assert.deepEqual(calls,[]);
 assert.deepEqual(await service.deleteAccount('SUPPRIMER'),{deleted:true});
 assert.deepEqual(calls.find(c=>c[0]==='invoke'),['invoke','compte-supprimer',{body:{confirmation:'SUPPRIMER'}}]);
});
test('une panne de suppression conserve la session, une panne de nettoyage ne masque pas une suppression réussie',async()=>{
 const {client,calls}=fake();const service=createAccountService(client,settings);
 client.functions.invoke=async()=>({data:null,error:{code:'unavailable'}});
 await assert.rejects(service.deleteAccount('SUPPRIMER'),{code:'unavailable'});
 assert.equal(calls.some(c=>c[0]==='signOut'),false);
 client.functions.invoke=async()=>({data:{deleted:true},error:null});
 client.auth.signOut=async()=>({error:{code:'offline'}});
 assert.deepEqual(await service.deleteAccount('SUPPRIMER'),{deleted:true,localSessionCleared:false});
});
test('le service ne touche pas aux données locales et aucun écran ne le charge',()=>{
 const module=fs.readFileSync(new URL('../account/service.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(module,/\b(?:window|document|localStorage|sessionStorage)\s*[.\[]/);
 for(const name of ['index.html','decouvrir/connexion.html','sw.js'])assert.doesNotMatch(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'),/account\/service\.mjs|compte-supprimer/);
});
