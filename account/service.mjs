// Prepared account API. Nothing is initialized or sent when this module is imported.
// The caller supplies an official Supabase client; activation is explicit and off by default.
export class AccountError extends Error {
  constructor(code,message){super(message);this.name='AccountError';this.code=code;}
}
const fail=(code,message)=>{throw new AccountError(code,message);};
function emailAddress(value){
  const email=String(value||'').trim();
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('invalid_email','Vérifie ton adresse e-mail.');
  return email;
}
function passwordValue(value,creating=false){
  if(typeof value!=='string'||!value.length||(creating&&value.length<12))fail('invalid_password',creating?'Choisis un mot de passe d’au moins 12 caractères.':'Saisis ton mot de passe.');
  return value; // Do not trim passwords or store them in learning state.
}
function firstName(value){
  const name=String(value??'').trim();
  if(name.length>80)fail('invalid_name','Le prénom doit contenir au maximum 80 caractères.');
  return name;
}
function check(result){
  if(result?.error){
    const code=result.error.code||'account_unavailable';
    const messages={invalid_credentials:'L’adresse e-mail ou le mot de passe est incorrect.',email_not_confirmed:'Confirme ton adresse e-mail avant de te connecter.',over_email_send_rate_limit:'Patiente avant de demander un nouvel e-mail.',over_request_rate_limit:'Patiente un instant avant de réessayer.'};
    fail(code,messages[code]||'L’opération est indisponible. Réessaie dans un instant.');
  }
  return result?.data;
}
export function createAccountService(client,{enabled=false,redirectUrl,providers=['email']}={}){
  const available=new Set(providers.filter(p=>['email','apple','google'].includes(p)));
  const requireEnabled=()=>{if(!enabled)fail('accounts_disabled','La connexion n’est pas encore activée.');};
  const requireProvider=provider=>{requireEnabled();if(!available.has(provider))fail('provider_disabled','Ce mode de connexion n’est pas encore disponible.');};
  const redirect=()=>{
    let url;try{url=new URL(redirectUrl);}catch{fail('missing_redirect','Le retour de connexion doit être configuré.');}
    if(url.username||url.password||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))fail('invalid_redirect','Le retour de connexion doit utiliser une adresse autorisée.');
    return url.href;
  };
  async function verifiedUser(){
    requireEnabled();const user=check(await client.auth.getUser())?.user;
    if(!user||user.is_anonymous)fail('not_signed_in','Connecte-toi pour accéder à ton compte.');
    return user;
  }
  async function readProfile(user){
    return check(await client.from('compte_profil').select('user_id,prenom,cree_le,modifie_le').eq('user_id',user.id).maybeSingle());
  }
  async function ensureProfile(prenom=''){
    const user=await verifiedUser();let profile=await readProfile(user);
    if(profile)return profile; // Never overwrite a cloud profile with a guest/device name.
    const inserted=await client.from('compte_profil').insert({user_id:user.id,prenom:firstName(prenom)}).select('user_id,prenom,cree_le,modifie_le').single();
    if(inserted.error?.code==='23505'){
      profile=await readProfile(user);
      if(profile)return profile; // Another device created it during sign-in.
    }
    return check(inserted);
  }
  return Object.freeze({
    enabled:!!enabled,
    availableProviders:Object.freeze(enabled?[...available]:[]),
    async current(){
      if(!enabled)return {enabled:false,user:null,profile:null};
      const result=await client.auth.getUser();
      if(result.error?.name==='AuthSessionMissingError'||(!result.error&&!result.data?.user))return {enabled:true,user:null,profile:null};
      const user=check(result)?.user;
      if(user?.is_anonymous)return {enabled:true,user:null,profile:null};
      return {enabled:true,user,profile:await readProfile(user)};
    },
    async signUp({email,password}){
      requireProvider('email');
      const data=check(await client.auth.signUp({email:emailAddress(email),password:passwordValue(password,true),options:{emailRedirectTo:redirect()}}));
      // A user object without a session is NOT a successful login (email confirmation).
      return {user:data?.session?data.user:null,confirmationRequired:!data?.session};
    },
    async signIn({email,password}){
      requireProvider('email');
      const data=check(await client.auth.signInWithPassword({email:emailAddress(email),password:passwordValue(password)}));
      if(!data?.session||!data.user||data.user.is_anonymous)fail('not_signed_in','La connexion n’a pas abouti.');
      return {user:data.user}; // Profile init is a separate retryable step.
    },
    async startProvider(provider){
      requireProvider(provider);
      if(provider==='email')fail('invalid_provider','Utilise le formulaire de connexion par e-mail.');
      return check(await client.auth.signInWithOAuth({provider,options:{redirectTo:redirect()}}));
    },
    ensureProfile,
    async updateProfile({prenom}){
      const name=firstName(prenom),user=await verifiedUser();
      return check(await client.from('compte_profil').update({prenom:name}).eq('user_id',user.id).select('user_id,prenom,cree_le,modifie_le').single());
    },
    async requestPasswordReset(email){
      requireProvider('email');
      check(await client.auth.resetPasswordForEmail(emailAddress(email),{redirectTo:redirect()}));
      return {message:'Si cette adresse est associée à un compte, un e-mail de récupération sera envoyé.'};
    },
    async changePassword(password){
      passwordValue(password,true);await verifiedUser();
      check(await client.auth.updateUser({password}));return {updated:true};
    },
    async signOut({allDevices=false}={}){
      requireEnabled();check(await client.auth.signOut({scope:allDevices?'global':'local'}));
      // Deliberately no access to state, localStorage, files or learning progress.
      return {signedOut:true};
    },
    async deleteAccount(confirmation){
      requireEnabled();if(confirmation!=='SUPPRIMER')fail('confirmation_required','Confirme la suppression du compte.');
      await verifiedUser();
      const result=check(await client.functions.invoke('compte-supprimer',{body:{confirmation}}));
      if(result?.deleted!==true)fail('delete_failed','Le compte n’a pas été supprimé.');
      // A local cleanup failure must not misreport an already-deleted account.
      try{
        const cleanup=await client.auth.signOut({scope:'local'});
        return cleanup?.error?{deleted:true,localSessionCleared:false}:{deleted:true};
      }catch{return {deleted:true,localSessionCleared:false};}
    }
  });
}
