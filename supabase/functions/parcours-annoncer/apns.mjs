// Le jeton d’autorisation d’Apple pour les push (APNs) : un JWT ES256, signé avec la clé .p8 de l’équipe (secret APNS_KEY, son
// identifiant APNS_KEY_ID, l’équipe APNS_TEAM_ID). Valable une heure ; Apple refuse qu’on le renouvelle plus d’une fois toutes les
// 20 minutes : la fonction le garde 40 minutes. Web Crypto seulement (Deno et Node) : la signature ECDSA y sort déjà au format
// attendu par un JWT (r puis s, 64 octets).
const base64url = octets => {
  let s = '';
  for (const o of octets) s += String.fromCharCode(o);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const texte = t => base64url(new TextEncoder().encode(t));

export async function jetonApns({pem, kid, equipe, maintenant, subtle = globalThis.crypto.subtle}) {
  const corps = String(pem || '').replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(corps), c => c.charCodeAt(0));
  const cle = await subtle.importKey('pkcs8', der, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
  const tete = texte(JSON.stringify({alg: 'ES256', kid}));
  const charge = texte(JSON.stringify({iss: equipe, iat: maintenant}));
  const signature = new Uint8Array(await subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, cle, new TextEncoder().encode(`${tete}.${charge}`)));
  return `${tete}.${charge}.${base64url(signature)}`;
}
