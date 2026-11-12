// Les retours de l’appli, par e-mail (Elisa, 12 novembre, 22 h 07 : « est-ce que le contact nous je peux le recevoir par mail
// quand j’ai un message ? pareil pour un commentaire avis… » ; « Oui, par mail »).
//
// La base appelle cette fonction (pg_net) à chaque message « Contacte-nous », à chaque avis de leçon qui porte un commentaire
// et à chaque pseudo signalé, puis une fois par heure s’il reste quelque chose. La fonction ne reçoit rien et ne répond rien
// d’utile à qui l’appelle : elle prend ce qui attend dans la base (alerte_prendre, réservée au serveur), écrit UN e-mail en
// texte simple et l’envoie par Resend à Elisa. L’adresse laissée dans un message devient l’adresse de réponse : « Répondre »
// suffit. Si l’envoi échoue, les lignes sont rendues (alerte_rendre) et le rattrapage réessaie.
// Sans la clé RESEND_API_KEY, elle répond {ok:false, raison:'veille'} et ne prend rien.

export const RESEND = 'https://api.resend.com/emails';
export const SUJETS = {bug: 'Bug', idee: 'Idée', question: 'Question', autre: 'Autre'};
const INFOS = [['appareil', 'Appareil'], ['navigateur', 'Navigateur'], ['mode', 'Mode'], ['ecran', 'Écran'], ['langue', 'Langue'], ['version', 'Version']];
const ADRESSE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const TRAIT = '· · · · · · · · · ·';

const reponse = (corps, status = 200) => new Response(JSON.stringify(corps), {status, headers: {'content-type': 'application/json'}});
const propre = t => String(t ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
const ligne = t => propre(t).replace(/\s+/g, ' ');
const court = (t, n) => { const s = ligne(t); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
export const etoiles = n => { const k = Math.max(0, Math.min(5, Math.round(+n) || 0)); return '★'.repeat(k) + '☆'.repeat(5 - k); };
const nomPiece = chemin => { const s = String(chemin || ''); return s.slice(s.lastIndexOf('/') + 1) || 'fichier'; };

async function blocContact(m, signer) {
  const adresse = ligne(m.email);
  const lignes = [
    'Message depuis l’appli (Mon compte › Contacte-nous)',
    `Sujet : ${SUJETS[m.type] || 'Autre'}`,
    `Reçu le ${ligne(m.le)}`,
    adresse ? `De : ${adresse}` : 'De : pas d’adresse laissée (pas de réponse possible)',
    '',
    propre(m.message)
  ];
  const infos = m.infos && typeof m.infos === 'object' ? m.infos : {};
  const details = INFOS.filter(([cle]) => ligne(infos[cle])).map(([cle, nom]) => `${nom} : ${court(infos[cle], 80)}`);
  if (details.length) lignes.push('', ...details);
  const pieces = Array.isArray(m.pieces) ? m.pieces.filter(p => typeof p === 'string' && p).slice(0, 3) : [];
  if (pieces.length) {
    const liens = [];
    let signes = 0;
    for (const p of pieces) {
      let lien = '';
      try { lien = signer ? ligne(await signer(p)) : ''; } catch { lien = ''; }
      if (lien) signes++;
      liens.push(lien ? `- ${nomPiece(p)} : ${lien}` : `- ${nomPiece(p)} (à ouvrir dans Supabase › Storage › contact-pieces)`);
    }
    const duree = signes ? (signes > 1 ? ' (liens valables 7 jours)' : ' (lien valable 7 jours)') : '';
    lignes.push('', `${pieces.length > 1 ? 'Pièces jointes' : 'Pièce jointe'}${duree} :`, ...liens);
  }
  return lignes.join('\n');
}

function blocAvis(a) {
  const titre = ligne(a.titre);
  return [
    `Avis sur une leçon : ${etoiles(a.note)} (${+a.note || 0} sur 5)`,
    `Leçon ${+a.lecon || 0}${titre ? ` · « ${titre} »` : ''}`,
    `Reçu le ${ligne(a.le)}`,
    '',
    propre(a.commentaire)
  ].join('\n');
}

function blocSignalement(s) {
  const n = +s.signalements || 1;
  return [
    `Pseudo signalé au classement : « ${ligne(s.pseudo)} »`,
    `Signalé le ${ligne(s.le)}`,
    s.masque ? `${pluriel(n, 'signalement', 'signalements')} pour ce joueur : il est maintenant masqué du classement.`
      : `${pluriel(n, 'signalement', 'signalements')} pour ce joueur. Il sera masqué du classement au 3e signalement compté (joueurs inscrits depuis plus d’un jour).`
  ].join('\n');
}

const ORDRE = {contact: 0, avis: 1, signalement: 2};
const trier = items => items.filter(i => i && i.genre in ORDRE).sort((a, b) =>
  ORDRE[a.genre] - ORDRE[b.genre] || String(a.quand || '').localeCompare(String(b.quand || '')));

/* L’e-mail : son sujet, son texte, et l’adresse de réponse quand tous les messages viennent de la même. */
export async function ecrire(items, {signer, tableau} = {}) {
  const liste = trier(items);
  const blocs = [];
  for (const i of liste) {
    blocs.push(i.genre === 'contact' ? await blocContact(i, signer) : i.genre === 'avis' ? blocAvis(i) : blocSignalement(i));
  }
  const contacts = liste.filter(i => i.genre === 'contact');
  const adresses = [...new Set(contacts.map(c => ligne(c.email).toLowerCase()).filter(a => ADRESSE.test(a)))];
  const repondre = adresses.length === 1 && contacts.every(c => ligne(c.email).toLowerCase() === adresses[0]) ? adresses[0] : '';
  let sujet;
  if (liste.length === 1) {
    const i = liste[0];
    sujet = i.genre === 'contact' ? `Requête · ${SUJETS[i.type] || 'Autre'} : ${court(i.message, 70)}`
      : i.genre === 'avis' ? `Requête · Avis ${etoiles(i.note)} sur la leçon ${+i.lecon || 0}${ligne(i.titre) ? ` « ${court(i.titre, 50)} »` : ''}`
      : `Requête · Pseudo signalé : ${court(i.pseudo, 40)}`;
  } else {
    const compte = g => liste.filter(i => i.genre === g).length;
    const parts = [];
    if (compte('contact')) parts.push(pluriel(compte('contact'), 'message', 'messages'));
    if (compte('avis')) parts.push(pluriel(compte('avis'), 'avis', 'avis'));
    if (compte('signalement')) parts.push(pluriel(compte('signalement'), 'signalement', 'signalements'));
    sujet = `Requête · ${parts.join(', ')}`;
  }
  const pied = [];
  if (repondre) pied.push('Pour répondre, réponds simplement à cet e-mail.');
  if (tableau) pied.push(`Tout retrouver : ${tableau} (vues contact_boite et avis_commentaires)`);
  const texte = blocs.join(`\n\n${TRAIT}\n\n`) + (pied.length ? `\n\n${TRAIT}\n\n${pied.join('\n')}` : '') + '\n';
  return {sujet, texte, repondre, combien: liste.length};
}

/* Une clé d’envoi unique par lot et par essai (Resend ne renvoie pas deux fois la même, 24 h) : une empreinte, pour que les
   références de la base ne sortent pas. */
export async function cleEnvoi(items, subtle = globalThis.crypto.subtle) {
  const brut = trier(items).map(i => `${i.genre}/${i.ref}/${i.essai}`).join('|');
  const octets = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(brut)));
  return 'requete-alerte-' + [...octets].map(o => o.toString(16).padStart(2, '0')).join('');
}

export function createAlerteHandler({pret, prendre, rendre, envoyer, signer, a, de, tableau, journal = () => {}}) {
  return async request => {
    if (request.method !== 'POST') return reponse({ok: false}, 405);
    if (!pret) return reponse({ok: false, raison: 'veille'});
    let items;
    try { items = await prendre(); } catch { journal('base'); return reponse({ok: false, raison: 'base'}, 500); }
    if (!Array.isArray(items) || !items.length) return reponse({ok: true});
    try {
      const mail = await ecrire(items, {signer, tableau});
      if (!mail.combien) return reponse({ok: true});
      const corps = {from: de, to: [a], subject: mail.sujet, text: mail.texte};
      if (mail.repondre) corps.reply_to = mail.repondre;
      const r = await envoyer(corps, await cleEnvoi(items));
      if (!r || !r.ok) throw new Error(`Resend ${r ? r.status : ''} ${r && r.raison ? r.raison : ''}`.trim());
      return reponse({ok: true});
    } catch (e) {
      journal(String(e && e.message || e));
      try { await rendre(items.filter(i => i && i.genre && i.ref).map(i => ({genre: i.genre, ref: String(i.ref)}))); } catch { journal('rendre'); }
      return reponse({ok: false, raison: 'envoi'}, 502);
    }
  };
}
