// Le jour où un parcours ouvre (Elisa, 11 novembre, 15 h 55 : « Ça peut pas être une notification push ? »). Elisa déclenche
// l’envoi une fois la mise à jour de l’appli en ligne : { parcours, essai } avec sa clé d’annonce (en-tête x-annonce, le secret
// PARCOURS_ANNONCE_CLE de la fonction). La fonction lit les inscrits du parcours (table parcours_alerte, avec la clé de service),
// pousse la notification par Apple (APNs, « alert ») à chacun, puis efface leur ligne : envoyée, ou jeton qu’Apple ne connaît plus.
// Un envoi qui échoue pour une autre raison (Apple indisponible) garde sa ligne : relancer la même commande renvoie seulement à
// ceux-là. Avec { essai: true }, rien ne part : la fonction dit combien d’appareils attendent et si la clé d’Apple est là.
// Pur : le réseau et la base sont donnés par index.ts, les tests donnent les leurs (tests/retours-1555.test.mjs).
export const PARCOURS = {python: 'Python pour la data', excel: 'Excel et tableaux croisés', powerbi: 'Power BI'};
export const PROD = 'api.push.apple.com', BAC = 'api.sandbox.push.apple.com';

// La notification : le titre dit quel parcours ouvre ; le texte, que la mise à jour de l’appli le contient. Un toucher ouvre l’appli.
export function chargeAnnonce(id) {
  return {aps: {alert: {title: `${PARCOURS[id]} est ouvert\u00a0!`, body: 'Le nouveau parcours t’attend dans Requête. Mets l’appli à jour si besoin.'},
    sound: 'default'}, parcours: id};
}

// Deux textes égaux, comparés en entier (le temps de la comparaison ne dit rien de la clé)
export function egal(a, b) {
  const x = new TextEncoder().encode(String(a)), y = new TextEncoder().encode(String(b));
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0 && x.length > 0;
}

// Un jeton d’une version installée depuis Xcode n’existe que dans le bac à sable d’Apple : refusé en production (BadDeviceToken),
// on essaie l’autre. Refusé partout, ou l’appli désinstallée (410) : le jeton est à oublier.
export async function pousserUn(jeton, charge, envoyer) {
  let r = await envoyer(PROD, jeton, charge);
  if (r.status === 200) return {ok: true};
  if (r.status === 400 && r.raison === 'BadDeviceToken') {
    const r2 = await envoyer(BAC, jeton, charge);
    if (r2.status === 200) return {ok: true};
    r = r2;
  }
  return {ok: false, oublier: r.status === 410 || (r.status === 400 && ['BadDeviceToken', 'DeviceTokenNotForTopic'].includes(r.raison))};
}

export function createAnnonceHandler({cle, pret, lire, effacer, envoyer, paquet = 20}) {
  const headers = {'Content-Type': 'application/json', 'Cache-Control': 'no-store'};
  const reply = (data, status = 200) => new Response(JSON.stringify(data), {status, headers});
  return async request => {
    if (request.method !== 'POST') return reply({erreur: 'Méthode non autorisée.'}, 405);
    if (!cle || !egal(request.headers.get('x-annonce') || '', cle)) return reply({erreur: 'Clé d’annonce absente ou fausse.'}, 401);
    let b;
    try { b = JSON.parse(await request.text()); } catch { return reply({erreur: 'Demande invalide.'}, 400); }
    const id = b && typeof b === 'object' ? b.parcours : null;
    if (typeof id !== 'string' || !Object.hasOwn(PARCOURS, id)) return reply({erreur: 'Parcours inconnu (python, excel ou powerbi).'}, 400);
    try {
      const cibles = (await lire(id)).filter(c => c && typeof c.cle === 'string' && typeof c.jeton === 'string');
      if (b.essai === true) return reply({ok: true, essai: true, parcours: id, inscrits: cibles.length, cleApple: pret});
      // En veille tant que la clé d’Apple n’est pas dans les secrets (APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID) : rien n’est effacé.
      if (!pret) return reply({ok: false, veille: true, parcours: id, inscrits: cibles.length});
      const charge = chargeAnnonce(id), finies = [];
      let envoyees = 0, oubliees = 0;
      for (let i = 0; i < cibles.length; i += paquet) {
        const lot = cibles.slice(i, i + paquet);
        const res = await Promise.all(lot.map(c => pousserUn(c.jeton, charge, envoyer).catch(() => ({ok: false}))));
        res.forEach((r, k) => {
          if (r.ok) { envoyees++; finies.push(lot[k].cle); } else if (r.oublier) { oubliees++; finies.push(lot[k].cle); }
        });
      }
      for (let i = 0; i < finies.length; i += 100) await effacer(id, finies.slice(i, i + 100));
      return reply({ok: true, parcours: id, inscrits: cibles.length, envoyees, oubliees, restantes: cibles.length - finies.length});
    } catch {
      return reply({erreur: 'Indisponible.'}, 503);
    }
  };
}
