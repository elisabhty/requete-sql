// « Se connecter avec Apple » : le jeton d’Apple gardé à la connexion, révoqué à la suppression du compte (logique : handler.mjs).
// Déployée sans vérification de JWT par la passerelle (verify_jwt=false), comme jeu-ile : elle vérifie elle-même le jeton du compte
// auprès de Supabase Auth (/auth/v1/user).
// Secrets à ajouter dans Supabase (Edge Functions › Secrets), une seule fois, par Elisa : APPLE_SIWA_KEY (le contenu du fichier .p8
// de la clé « Sign in with Apple », lignes BEGIN et END comprises), APPLE_SIWA_KEY_ID (10 caractères), APPLE_TEAM_ID (l’équipe).
// Sans eux, la fonction répond « veille » et rien n’est gardé ni révoqué.
import {createAppleJetonHandler, secretClient} from './handler.mjs';

const base = Deno.env.get('SUPABASE_URL') ?? '';
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const pem = Deno.env.get('APPLE_SIWA_KEY') ?? '';
const kid = Deno.env.get('APPLE_SIWA_KEY_ID') ?? '';
const equipe = Deno.env.get('APPLE_TEAM_ID') ?? Deno.env.get('APNS_TEAM_ID') ?? '';
const client = 'fr.requete.app';

async function rpc(name: string, args: unknown) {
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {method: 'POST',
    headers: {apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json'}, body: JSON.stringify(args)});
  const texte = await response.text();
  if (!response.ok) throw new Error('RPC refusé');
  return texte ? JSON.parse(texte) : null;
}

Deno.serve(createAppleJetonHandler({
  pret: !!(pem && kid && equipe),
  client,
  utilisateur: async (jwt: string) => {
    const r = await fetch(`${base}/auth/v1/user`, {headers: {apikey: service, Authorization: `Bearer ${jwt}`}});
    return r.ok ? await r.json() : null;
  },
  garder: (id: string, jeton: string) => rpc('apple_jeton_garder', {p_user: id, p_jeton: jeton}),
  prendre: (id: string) => rpc('apple_jeton_prendre', {p_user: id}),
  secret: () => secretClient({pem, kid, equipe, client, maintenant: Math.floor(Date.now() / 1000)})
}));
