// Le jour où un parcours ouvre : le point d’entrée de la fonction (la logique est dans handler.mjs, la signature dans apns.mjs,
// copie de celle de jeu-ile). Déployée sans vérification de JWT (verify_jwt=false) : elle n’obéit qu’à la clé d’annonce d’Elisa
// (en-tête x-annonce), le secret PARCOURS_ANNONCE_CLE. La clé d’Apple est celle de la salle dans l’île (APNS_KEY, APNS_KEY_ID,
// APNS_TEAM_ID ; APNS_TOPIC : fr.requete.app par défaut). Commande d’envoi : IOS.md, « Le jour où un parcours ouvre ».
import {createAnnonceHandler} from './handler.mjs';
import {jetonApns} from './apns.mjs';

const base = Deno.env.get('SUPABASE_URL') ?? '';
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const pem = Deno.env.get('APNS_KEY') ?? '';
const kid = Deno.env.get('APNS_KEY_ID') ?? '';
const equipe = Deno.env.get('APNS_TEAM_ID') ?? '';
const sujet = Deno.env.get('APNS_TOPIC') ?? 'fr.requete.app';
const cle = Deno.env.get('PARCOURS_ANNONCE_CLE') ?? '';

let autorisation = {jwt: '', depuis: 0};
async function jwtApple(): Promise<string> {
  const maintenant = Math.floor(Date.now() / 1000);
  if (!autorisation.jwt || maintenant - autorisation.depuis > 2400) {
    autorisation = {jwt: await jetonApns({pem, kid, equipe, maintenant}), depuis: maintenant};
  }
  return autorisation.jwt;
}

const entetes = {apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json'};

// Les inscrits d’un parcours, 1 000 par page
async function lire(id: string) {
  const tous: {cle: string, jeton: string}[] = [];
  for (let debut = 0; ; debut += 1000) {
    const r = await fetch(`${base}/rest/v1/parcours_alerte?parcours=eq.${id}&select=cle,jeton&order=cle&limit=1000&offset=${debut}`, {headers: entetes});
    if (!r.ok) throw new Error('lecture refusée');
    const page = await r.json() as {cle: string, jeton: string}[];
    tous.push(...page);
    if (page.length < 1000) return tous;
  }
}

async function effacer(id: string, cles: string[]) {
  const liste = cles.filter(c => /^[0-9a-f]{64}$/.test(c)).join(',');
  if (!liste) return;
  const r = await fetch(`${base}/rest/v1/parcours_alerte?parcours=eq.${id}&cle=in.(${liste})`, {method: 'DELETE', headers: entetes});
  if (!r.ok) throw new Error('effacement refusé');
}

// Une notification : apns-push-type « alert », le sujet de l’app, priorité 10 ; Apple la garde un jour si le téléphone est éteint.
async function envoyer(hote: string, jeton: string, charge: unknown) {
  const response = await fetch(`https://${hote}/3/device/${jeton}`, {method: 'POST', headers: {
    authorization: `bearer ${await jwtApple()}`, 'apns-push-type': 'alert', 'apns-topic': sujet, 'apns-priority': '10',
    'apns-expiration': String(Math.floor(Date.now() / 1000) + 86400), 'content-type': 'application/json'},
    body: JSON.stringify(charge)});
  let raison = '';
  if (!response.ok) {
    try { raison = ((await response.json()) as {reason?: string}).reason ?? ''; } catch { raison = ''; }
  } else {
    try { await response.body?.cancel(); } catch { /* rien à lire */ }
  }
  return {status: response.status, raison};
}

Deno.serve(createAnnonceHandler({cle, pret: !!(pem && kid && equipe), lire, effacer, envoyer}));
