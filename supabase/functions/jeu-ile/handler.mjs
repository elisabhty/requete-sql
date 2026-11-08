// La salle dans l’île (Elisa, 7 novembre, 20 h 16 : la planche « Ta salle vit dans l’île », « Tu pars envoyer le code sur
// WhatsApp : tu vois tes amis arriver »). Le téléphone dont la salle vient de changer envoie le nouvel état ({ cle, salle, etat,
// alerte }) ; la fonction vérifie qu’il est dans la salle et que l’état est nouveau (jeu_ile_cibles_v2), puis le pousse par Apple
// aux Live Activities des autres joueurs ; les jetons refusés sont oubliés (jeu_ile_suivi_v2). Pur : le réseau, la base et
// l’horloge sont donnés par index.ts, les tests donnent les leurs (tests/ios-salle-ile.test.mjs).
const ID = /^[A-Za-z0-9_-]{4,64}$/;
const PHASES = ['attente', 'partie', 'pause', 'fin'];
const SONS = ['miaou.wav', 'default'];
// Six joueurs par salle au plus, comme dans l’appli (JEU_MAX) et la base (8 novembre, 22 h 27 ; cinq avant).
const MAX_JOUEURS = 6;
const propre = (v, max) => (typeof v === 'string'
  ? Array.from(v.replace(/[\u0000-\u001f\u007f<>\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').trim()).slice(0, max).join('')
  : null);
const entier = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);
const ident = v => (v === '' ? '' : typeof v === 'string' && ID.test(v) ? v : null);

// L’état, reconstruit : exactement les clés que la Live Activity attend (RequeteSalle.ContentState, dans RequeteWidget.swift),
// dans le même ordre ; un même état donne le même JSON, le serveur reconnaît celui qu’il a déjà poussé.
export function etatPropre(e, maintenant) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  if (!PHASES.includes(e.phase) || !Array.isArray(e.joueurs) || e.joueurs.length < 1 || e.joueurs.length > MAX_JOUEURS) return null;
  const joueurs = [];
  for (const j of e.joueurs) {
    if (!j || typeof j !== 'object') return null;
    const p = ident(j.p), n = propre(j.n, 24), pts = entier(j.pts, 0, 1000000), r = entier(j.r, 0, MAX_JOUEURS);
    if (!p || !n || pts === null || r === null || typeof j.ok !== 'boolean') return null;
    joueurs.push({p, n, pts, r, ok: j.ok});
  }
  const hote = ident(e.hote), manche = entier(e.manche, 0, 5), nb = entier(e.nb, 0, 5), defi = propre(e.defi, 80), nouveau = ident(e.nouveau);
  const fin = e.fin === 0 ? 0 : Number.isInteger(e.fin) && Math.abs(e.fin - maintenant) <= 86400 ? e.fin : null;
  if (hote === null || manche === null || nb === null || defi === null || fin === null || nouveau === null) return null;
  return {phase: e.phase, joueurs, hote, manche, nb, defi, fin, nouveau};
}

// L’alerte (l’île s’ouvre un instant) : un ami arrive (le petit miaou), la partie finit. Absente : null ; mal formée : undefined.
export function alertePropre(a) {
  if (a === null || a === undefined) return null;
  if (typeof a !== 'object' || Array.isArray(a)) return undefined;
  const titre = propre(a.titre, 80), texte = propre(a.texte, 120), son = SONS.includes(a.son) ? a.son : 'default';
  if (!titre || texte === null) return undefined;
  return {titre, texte, son};
}

// Ce que reçoit Apple : une mise à jour, ou la fin (le podium reste un quart d’heure sur l’écran verrouillé).
export function chargeApns(etat, alerte, maintenant) {
  const fin = etat.phase === 'fin';
  const aps = {timestamp: maintenant, event: fin ? 'end' : 'update', 'content-state': etat};
  if (fin) aps['dismissal-date'] = maintenant + 900;
  if (alerte) aps.alert = {title: alerte.titre, body: alerte.texte, sound: alerte.son};
  return {aps};
}

export const PROD = 'api.push.apple.com', BAC = 'api.sandbox.push.apple.com';
// Un jeton d’une version de développement n’existe que dans le bac à sable d’Apple : refusé en production (BadDeviceToken), on
// essaie l’autre. Refusé partout, ou l’activité finie (410) : le jeton est à oublier.
export async function pousserUn(cible, charge, envoyer) {
  const premier = cible.bac ? BAC : PROD, second = cible.bac ? PROD : BAC;
  let r = await envoyer(premier, cible.jeton, charge);
  if (r.status === 200) return {ok: true};
  if (r.status === 400 && r.raison === 'BadDeviceToken') {
    const r2 = await envoyer(second, cible.jeton, charge);
    if (r2.status === 200) return {ok: true, bac: second === BAC};
    r = r2;
  }
  return {ok: false, oublier: r.status === 410 || (r.status === 400 && ['BadDeviceToken', 'DeviceTokenNotForTopic'].includes(r.raison))};
}

export function createIleHandler({pret, rpc, envoyer, maintenant = () => Math.floor(Date.now() / 1000)}) {
  const headers = {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'apikey,authorization,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS'};
  const reply = (data, status = 200) => new Response(JSON.stringify(data), {status, headers});
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, {headers});
    if (request.method !== 'POST') return reply({error: 'Méthode non autorisée.'}, 405);
    try {
      if (Number(request.headers.get('content-length') || 0) > 6000) return reply({error: 'Demande trop longue.'}, 413);
      const text = await request.text();
      if (new TextEncoder().encode(text).length > 6000) return reply({error: 'Demande trop longue.'}, 413);
      let b;
      try { b = JSON.parse(text); } catch { return reply({error: 'Demande invalide.'}, 400); }
      const t = maintenant();
      const objet = !!b && typeof b === 'object' && !Array.isArray(b);
      const etat = objet ? etatPropre(b.etat, t) : null, alerte = objet ? alertePropre(b.alerte) : undefined;
      if (!objet || typeof b.cle !== 'string' || !/^[A-Za-z0-9]{24,64}$/.test(b.cle) || typeof b.salle !== 'string'
        || !/^[A-Z0-9]{6}$/.test(b.salle) || !etat || alerte === undefined) return reply({error: 'Demande invalide.'}, 400);
      // En veille tant que la clé d’Apple n’est pas dans les secrets de la fonction (APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID).
      if (!pret) return reply({ok: true, pousse: 0, veille: true});
      const r = await rpc('jeu_ile_cibles_v2', {p_cle: b.cle, p_salle: b.salle, p_etat: etat});
      if (!r || r.pareil || !Array.isArray(r.cibles) || !r.cibles.length) return reply({ok: true, pousse: 0});
      const cibles = r.cibles.slice(0, MAX_JOUEURS - 1), charge = chargeApns(etat, alerte, t);
      const resultats = await Promise.all(cibles.map(c => pousserUn(c, charge, envoyer).catch(() => ({ok: false}))));
      const retirer = [], bac = [];
      resultats.forEach((x, i) => { if (x.oublier) retirer.push(cibles[i].jeton); if (x.bac) bac.push(cibles[i].jeton); });
      if (retirer.length || bac.length) await rpc('jeu_ile_suivi_v2', {p_salle: b.salle, p_retirer: retirer, p_bac: bac}).catch(() => null);
      return reply({ok: true, pousse: resultats.filter(x => x.ok).length});
    } catch (e) {
      const status = e?.code === '42501' ? 403 : e?.code === '22023' ? 400 : 503;
      return reply({error: status === 403 ? 'Pas dans cette salle.' : status === 400 ? 'Demande invalide.' : 'Indisponible.'}, status);
    }
  };
}
