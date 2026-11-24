// L’île de la leçon ou de l’onboarding, fermée 5 minutes après avoir quitté l’app (Elisa, 24 novembre, 16 h 48 : « Tu peux
// pousser pour tout le monde de la fermer 5 min après avoir fermé complètement l’appli »). L’app balayée, iOS ne la prévient pas :
// c’est le serveur qui ferme l’île, par Apple.
//
// Trois demandes :
//   - { jeton, dans, etat } : le téléphone vient de quitter l’app (RequeteIleFermeture, RequeteWidgetPlugin.swift) ; l’île est à
//     fermer dans « dans » secondes (300 ; entre 60 et 900), avec son dernier état (rendu tel quel à Apple pour la fin) ;
//   - { jeton, annuler: true } : on est revenu dans l’app avant ;
//   - { envoyer: true } : la base, chaque minute, quand une île est due (requete_private.ile_fermer_lancer) : la fonction prend
//     celles dont l’heure est passée (ile_fermer_dues_v1) et pousse leur fin à Apple.
// Pur : le réseau, la base et l’horloge sont donnés par index.ts, les tests donnent les leurs (tests/retours-1648-ile-cinq-minutes).
const JETON = /^[0-9a-f]{32,400}$/;
// Les clés des deux états (RequeteLecon.ContentState et RequeteAccueil.ContentState, dans RequeteWidget.swift) : rien d’autre
// n’est gardé.
const NOMBRES = ['progression'];
const ENTIERS = ['reussis', 'moments', 'objectif', 'etape', 'total', 'minutes'];
const BOOLEENS = ['allumee', 'fini', 'pause', 'clin'];
const TEXTES = ['titre', 'bonjour'];

export function etatPropre(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const r = {};
  for (const k of NOMBRES) if (k in e) { if (typeof e[k] !== 'number' || !Number.isFinite(e[k])) return null; r[k] = Math.min(1, Math.max(0, e[k])); }
  for (const k of ENTIERS) if (k in e) { if (!Number.isInteger(e[k]) || e[k] < 0 || e[k] > 1000) return null; r[k] = e[k]; }
  for (const k of BOOLEENS) if (k in e) { if (typeof e[k] !== 'boolean') return null; r[k] = e[k]; }
  for (const k of TEXTES) if (k in e) { if (typeof e[k] !== 'string') return null; r[k] = Array.from(e[k]).slice(0, 80).join(''); }
  if (typeof r.fini !== 'boolean') return null;
  return r;
}

// Ce que reçoit Apple : la fin, et l’île s’en va tout de suite (dismissal-date : maintenant).
export function chargeFin(etat, maintenant) {
  return {aps: {timestamp: maintenant, event: 'end', 'dismissal-date': maintenant, 'content-state': etat}};
}

export const PROD = 'api.push.apple.com', BAC = 'api.sandbox.push.apple.com';
// Comme jeu-ile : un jeton d’une version de développement n’existe que dans le bac à sable d’Apple.
export async function pousserUn(jeton, charge, envoyer) {
  let r = await envoyer(PROD, jeton, charge);
  if (r.status === 200) return true;
  if (r.status === 400 && r.raison === 'BadDeviceToken') {
    r = await envoyer(BAC, jeton, charge);
    if (r.status === 200) return true;
  }
  return false;
}

export function createFermerHandler({pret, rpc, envoyer, maintenant = () => Math.floor(Date.now() / 1000)}) {
  const headers = {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'apikey,authorization,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS'};
  const reply = (data, status = 200) => new Response(JSON.stringify(data), {status, headers});
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, {headers});
    if (request.method !== 'POST') return reply({error: 'Méthode non autorisée.'}, 405);
    try {
      if (Number(request.headers.get('content-length') || 0) > 3000) return reply({error: 'Demande trop longue.'}, 413);
      const text = await request.text();
      if (new TextEncoder().encode(text).length > 3000) return reply({error: 'Demande trop longue.'}, 413);
      let b;
      try { b = JSON.parse(text || '{}'); } catch { return reply({error: 'Demande invalide.'}, 400); }
      if (!b || typeof b !== 'object' || Array.isArray(b)) return reply({error: 'Demande invalide.'}, 400);

      if (b.envoyer === true) {
        // En veille tant que la clé d’Apple n’est pas dans les secrets (APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID) : rien n’est pris.
        if (!pret) return reply({ok: true, ferme: 0, veille: true});
        const dues = await rpc('ile_fermer_dues_v1', {p_max: 100});
        const t = maintenant();
        let ferme = 0;
        for (const d of Array.isArray(dues) ? dues : []) {
          if (!d || typeof d.jeton !== 'string' || !JETON.test(d.jeton)) continue;
          const etat = etatPropre(d.etat);
          if (!etat) continue;
          try { if (await pousserUn(d.jeton, chargeFin(etat, t), envoyer)) ferme += 1; } catch { /* la suivante */ }
        }
        return reply({ok: true, ferme});
      }

      if (typeof b.jeton !== 'string' || !JETON.test(b.jeton)) return reply({error: 'Demande invalide.'}, 400);
      if (b.annuler === true) {
        await rpc('ile_fermer_v1', {p_jeton: b.jeton, p_dans: null, p_etat: null});
        return reply({ok: true, annule: true});
      }
      const etat = etatPropre(b.etat);
      if (!Number.isInteger(b.dans) || !etat) return reply({error: 'Demande invalide.'}, 400);
      const dans = Math.min(900, Math.max(60, b.dans));
      await rpc('ile_fermer_v1', {p_jeton: b.jeton, p_dans: dans, p_etat: etat});
      return reply({ok: true, dans});
    } catch {
      return reply({error: 'Le serveur n’a pas pu répondre.'}, 500);
    }
  };
}
