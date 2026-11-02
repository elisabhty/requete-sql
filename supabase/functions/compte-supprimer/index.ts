import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {createAccountDeletionHandler} from './handler.mjs';

// Prepared source only. Do not deploy/enable before connecting the account UI.
// The secret never enters the app or the browser bundle.
let admin: ReturnType<typeof createClient>;
function authAdmin(){
  return admin??=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
}
Deno.serve(createAccountDeletionHandler({
  enabled:Deno.env.get('REQUETE_COMPTES_ENABLED')==='true',
  getUser:(jwt:string)=>authAdmin().auth.getUser(jwt),
  revokeSessions:(jwt:string)=>authAdmin().auth.admin.signOut(jwt,'global'),
  deleteUser:(id:string)=>authAdmin().auth.admin.deleteUser(id)
}));
