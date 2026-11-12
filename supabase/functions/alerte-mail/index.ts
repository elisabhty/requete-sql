// Les retours de l’appli par e-mail : le point d’entrée (la logique est dans handler.mjs).
// Déployée sans vérification de JWT (verify_jwt=false) : c’est la base qui l’appelle (pg_net, migration alerte_mail). Elle ne lit
// rien de ce qu’on lui envoie et ne renvoie que {ok} : l’appeler de l’extérieur ne fait qu’envoyer plus tôt ce qui attendait.
// Secrets à ajouter dans Supabase (Edge Functions › Secrets), par Elisa : RESEND_API_KEY (la clé du compte Resend, « Sending
// access » suffit). Facultatifs : ALERTE_MAIL_A (où recevoir, contact@requeteapp.com par défaut) et ALERTE_MAIL_DE (l’expéditeur ;
// par défaut l’adresse d’essai de Resend, qui n’écrit qu’à l’adresse du compte Resend : tant que le domaine requeteapp.com
// n’est pas vérifié chez Resend, ALERTE_MAIL_A doit être l’adresse de ce compte).
// Sans RESEND_API_KEY, la fonction répond « veille » et ne prend rien.
import {createAlerteHandler, RESEND} from './handler.mjs';

const base = Deno.env.get('SUPABASE_URL') ?? '';
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const cle = Deno.env.get('RESEND_API_KEY') ?? '';
const a = Deno.env.get('ALERTE_MAIL_A') ?? 'contact@requeteapp.com';
const de = Deno.env.get('ALERTE_MAIL_DE') ?? 'Requête <onboarding@resend.dev>';
const projet = (() => { try { return new URL(base).hostname.split('.')[0]; } catch { return ''; } })();
const entetes = {apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json'};

async function rpc(name: string, args: unknown) {
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {method: 'POST', headers: entetes, body: JSON.stringify(args)});
  const texte = await response.text();
  if (!response.ok) throw new Error('RPC refusé');
  return texte ? JSON.parse(texte) : null;
}

// Un lien de lecture vers une pièce jointe (espace privé « contact-pieces »), valable 7 jours
async function signer(chemin: string) {
  const voie = chemin.split('/').map(encodeURIComponent).join('/');
  const r = await fetch(`${base}/storage/v1/object/sign/contact-pieces/${voie}`, {method: 'POST', headers: entetes,
    body: JSON.stringify({expiresIn: 604800})});
  if (!r.ok) { try { await r.body?.cancel(); } catch { /* rien à lire */ } return ''; }
  const {signedURL} = await r.json() as {signedURL?: string};
  return signedURL ? `${base}/storage/v1${signedURL}` : '';
}

async function envoyer(corps: unknown, unique: string) {
  const r = await fetch(RESEND, {method: 'POST', headers: {Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json',
    'Idempotency-Key': unique}, body: JSON.stringify(corps)});
  let raison = '';
  try {
    const j = await r.json() as {message?: string, name?: string};
    if (!r.ok) raison = [j.name, j.message].filter(Boolean).join(' : ').slice(0, 240);
  } catch { raison = ''; }
  return {ok: r.ok, status: r.status, raison};
}

Deno.serve(createAlerteHandler({
  pret: !!cle,
  prendre: () => rpc('alerte_prendre', {}),
  rendre: (refs: unknown) => rpc('alerte_rendre', {p_refs: refs}),
  envoyer, signer, a, de,
  tableau: projet ? `https://supabase.com/dashboard/project/${projet}/editor` : '',
  journal: (quoi: string) => console.error('alerte-mail :', quoi)
}));
