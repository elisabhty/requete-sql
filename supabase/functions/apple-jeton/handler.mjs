// « Se connecter avec Apple » : garder le jeton d’Apple à la connexion, le révoquer à la suppression du compte (Elisa, 12 novembre,
// 1 h 33 : « oui »). Apple le demande aux apps qui proposent Sign in with Apple (règle 5.1.1(v), « Offering account deletion in your
// app » : « use the Sign in with Apple REST API to revoke user tokens »).
//
// Deux demandes, chacune avec le jeton du compte Supabase (Authorization: Bearer …), vérifié auprès de Supabase Auth :
// - {action:'garder', code} : juste après la connexion, le code d’autorisation d’Apple (valable 10 minutes) est échangé contre un
//   jeton de renouvellement (appleid.apple.com/auth/token), gardé côté serveur seulement (apple_jeton_garder) ;
// - {action:'revoquer'} : avant la suppression du compte, ce jeton est révoqué (appleid.apple.com/auth/revoke) puis oublié
//   (apple_jeton_prendre). L’app disparaît alors des « Apps utilisant l’identifiant Apple » de la personne.
// Sans les secrets (APPLE_SIWA_KEY, APPLE_SIWA_KEY_ID, APPLE_TEAM_ID), la fonction répond {ok:false, raison:'veille'} : la
// connexion et la suppression continuent sans elle.

export const APPLE = 'https://appleid.apple.com';

const base64url = octets => {
  let s = '';
  for (const o of octets) s += String.fromCharCode(o);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const texte = t => base64url(new TextEncoder().encode(t));

/* Le « client_secret » d’Apple : un JWT ES256 signé avec la clé Sign in with Apple (.p8), au nom de l’équipe, pour l’app. */
export async function secretClient({pem, kid, equipe, client, maintenant, subtle = globalThis.crypto.subtle}) {
  const corps = String(pem || '').replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(corps), c => c.charCodeAt(0));
  const cle = await subtle.importKey('pkcs8', der, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
  const tete = texte(JSON.stringify({alg: 'ES256', kid}));
  const charge = texte(JSON.stringify({iss: equipe, iat: maintenant, exp: maintenant + 300, aud: APPLE, sub: client}));
  const signature = new Uint8Array(await subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, cle, new TextEncoder().encode(`${tete}.${charge}`)));
  return `${tete}.${charge}.${base64url(signature)}`;
}

const reponse = (corps, status = 200) => new Response(JSON.stringify(corps), {status, headers: {
  'content-type': 'application/json', 'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS'}});

export function createAppleJetonHandler({utilisateur, garder, prendre, secret, fetcher = fetch, client = 'fr.requete.app', pret}) {
  const formulaire = async (chemin, champs) => {
    const r = await fetcher(APPLE + chemin, {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams(champs).toString()});
    const t = await r.text();
    let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = null; }
    return {ok: r.ok, status: r.status, json: j};
  };
  return async req => {
    if (req.method === 'OPTIONS') return reponse({ok: true});
    if (req.method !== 'POST') return reponse({ok: false, raison: 'methode'}, 405);
    const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) return reponse({ok: false, raison: 'connexion'}, 401);
    const u = await utilisateur(jwt).catch(() => null);
    if (!u || !u.id || u.is_anonymous) return reponse({ok: false, raison: 'connexion'}, 401);
    let corps = null;
    try { corps = await req.json(); } catch { corps = null; }
    const action = corps && corps.action;
    if (action !== 'garder' && action !== 'revoquer') return reponse({ok: false, raison: 'demande'}, 400);
    if (!pret) return reponse({ok: false, raison: 'veille'});
    if (action === 'garder') {
      const code = corps.code;
      if (typeof code !== 'string' || !/^[A-Za-z0-9._-]{10,512}$/.test(code)) return reponse({ok: false, raison: 'demande'}, 400);
      const r = await formulaire('/auth/token', {client_id: client, client_secret: await secret(), code, grant_type: 'authorization_code'});
      const jeton = r.json && r.json.refresh_token;
      if (!r.ok || typeof jeton !== 'string' || !jeton) return reponse({ok: false, raison: 'apple', detail: r.json && r.json.error || r.status}, 502);
      await garder(u.id, jeton);
      return reponse({ok: true});
    }
    const jeton = await prendre(u.id);
    if (!jeton) return reponse({ok: true, revoque: false});
    const r = await formulaire('/auth/revoke', {client_id: client, client_secret: await secret(), token: jeton, token_type_hint: 'refresh_token'});
    if (!r.ok) {
      await garder(u.id, jeton).catch(() => {});   // gardé pour un nouvel essai
      return reponse({ok: false, raison: 'apple', detail: r.json && r.json.error || r.status}, 502);
    }
    return reponse({ok: true, revoque: true});
  };
}
