// L’île de la leçon ou de l’onboarding, fermée 5 minutes après avoir quitté l’app : le point d’entrée de la fonction (la logique
// est dans handler.mjs, la signature dans apns.mjs, la même que jeu-ile). Déployée sans vérification de JWT (verify_jwt=false),
// comme jeu-ile : l’app l’appelle avec la clé publique, et la base chaque minute (requete_private.ile_fermer_lancer).
// Les secrets sont ceux de jeu-ile, déjà dans Supabase (Edge Functions › Secrets) : APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID, et
// APNS_TOPIC (fr.requete.app par défaut). Sans eux, la fonction garde les îles à fermer mais n’en ferme aucune (« veille »).
import {createFermerHandler} from './handler.mjs';
import {jetonApns} from './apns.mjs';

const base = Deno.env.get('SUPABASE_URL') ?? '';
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const pem = Deno.env.get('APNS_KEY') ?? '';
const kid = Deno.env.get('APNS_KEY_ID') ?? '';
const equipe = Deno.env.get('APNS_TEAM_ID') ?? '';
const sujet = Deno.env.get('APNS_TOPIC') ?? 'fr.requete.app';

let autorisation = {jwt: '', depuis: 0};
async function jwtApple(): Promise<string> {
  const maintenant = Math.floor(Date.now() / 1000);
  if (!autorisation.jwt || maintenant - autorisation.depuis > 2400) {
    autorisation = {jwt: await jetonApns({pem, kid, equipe, maintenant}), depuis: maintenant};
  }
  return autorisation.jwt;
}

async function rpc(name: string, args: unknown) {
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {method: 'POST',
    headers: {apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json'}, body: JSON.stringify(args)});
  const texte = await response.text();
  let data: unknown = null;
  try { data = texte ? JSON.parse(texte) : null; } catch { data = null; }
  if (!response.ok) throw new Error('RPC refusé');
  return data;
}

// La fin d’une Live Activity : apns-push-type « liveactivity », priorité 10 ; l’envoi expire au bout de 5 minutes.
async function envoyer(hote: string, jeton: string, charge: unknown) {
  const response = await fetch(`https://${hote}/3/device/${jeton}`, {method: 'POST', headers: {
    authorization: `bearer ${await jwtApple()}`, 'apns-push-type': 'liveactivity', 'apns-topic': `${sujet}.push-type.liveactivity`,
    'apns-priority': '10', 'apns-expiration': String(Math.floor(Date.now() / 1000) + 300), 'content-type': 'application/json'},
    body: JSON.stringify(charge)});
  let raison = '';
  if (!response.ok) {
    try { raison = ((await response.json()) as {reason?: string}).reason ?? ''; } catch { raison = ''; }
  } else {
    try { await response.body?.cancel(); } catch { /* rien à lire */ }
  }
  return {status: response.status, raison};
}

Deno.serve(createFermerHandler({pret: !!(pem && kid && equipe), rpc, envoyer}));
