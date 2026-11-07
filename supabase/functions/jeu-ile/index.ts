// La salle dans l’île : le point d’entrée de la fonction (la logique est dans handler.mjs, la signature dans apns.mjs).
// Déployée sans vérification de JWT (verify_jwt=false), comme jeu-verifier : elle authentifie l’appareil par sa clé (jeu_ile_cibles_v2).
// Secrets à ajouter dans Supabase (Edge Functions › Secrets), une seule fois, par Elisa : APNS_KEY (le contenu du fichier .p8,
// lignes BEGIN et END comprises), APNS_KEY_ID (10 caractères), APNS_TEAM_ID (l’équipe Apple). Sans eux, la fonction répond
// « veille » et ne pousse rien. APNS_TOPIC : l’identifiant de l’app (fr.requete.app par défaut).
import {createIleHandler} from './handler.mjs';
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
  let data: {message?: string, code?: string} | null = null;
  try { data = texte ? JSON.parse(texte) : null; } catch { data = null; }
  if (!response.ok) throw Object.assign(new Error(data?.message || 'RPC refusé'), {code: data?.code});
  return data;
}

// Une Live Activity : apns-push-type « liveactivity », le sujet de l’app suivi de .push-type.liveactivity, priorité 10 (tout de
// suite) ; l’envoi expire au bout de 5 minutes (un état plus vieux ne sert plus).
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

Deno.serve(createIleHandler({pret: !!(pem && kid && equipe), rpc, envoyer}));
