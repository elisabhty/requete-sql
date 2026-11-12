/* Elisa, 12 novembre, 22 h 07 : « est-ce que le contact nous je peux le recevoir par mail quand j’ai un message ? pareil pour un
   commentaire avis du site internet ou de l’appli ? (avis cours, contacte-nous etc) », puis « Oui, par mail ».
   Un message « Contacte-nous », un avis de leçon avec un commentaire, un pseudo signalé : la base prévient la fonction alerte-mail
   (pg_net), qui prend ce qui attend, écrit un seul e-mail en texte simple et l’envoie par Resend. La clé de Resend est un secret
   de Supabase, posé par Elisa ; sans elle, rien n’est pris. La base elle-même est vérifiée par supabase/tests/alerte_mail.sql. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createAlerteHandler, ecrire, cleEnvoi, etoiles, RESEND, SUJETS} from '../supabase/functions/alerte-mail/handler.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sql = lire('supabase/migrations/20261112215758_alerte_mail.sql');
const entree = lire('supabase/functions/alerte-mail/index.ts');
const poignee = lire('supabase/functions/alerte-mail/handler.mjs');
const N = String.fromCharCode(0xa0);

const contact = (plus = {}) => ({genre: 'contact', ref: '12', essai: 1, quand: '2026-11-12T22:41:00+01:00', le: '12/11/2026 à 22:41',
  type: 'bug', message: 'L’écran reste blanc\nquand j’ouvre la leçon 3.', email: 'lea@exemple.fr',
  infos: {version: '2912', appareil: 'iPhone', navigateur: 'Safari', ecran: '393×852'}, pieces: [], ...plus});
const avis = (plus = {}) => ({genre: 'avis', ref: 'e'.repeat(64) + ':12', essai: 1, quand: '2026-11-12T22:45:00+01:00',
  le: '12/11/2026 à 22:45', lecon: 12, titre: 'Les jointures', note: 4, commentaire: 'Très clair, merci !', ...plus});
const signalement = (plus = {}) => ({genre: 'signalement', ref: '11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222',
  essai: 1, quand: '2026-11-12T22:50:00+01:00', le: '12/11/2026 à 22:50', pseudo: 'Xx', signalements: 2, masque: false, ...plus});

function monter({pret = true, attend = [], resend = {ok: true, status: 200}, casse = {}} = {}) {
  const j = {pris: 0, envois: [], rendus: [], journal: []};
  const h = createAlerteHandler({
    pret, a: 'contact@requeteapp.com', de: 'Requête <onboarding@resend.dev>', tableau: 'https://supabase.com/dashboard/project/abc/editor',
    prendre: async () => { j.pris++; if (casse.prendre) throw new Error('base'); return attend; },
    rendre: async refs => { if (casse.rendre) throw new Error('rendre'); j.rendus.push(refs); },
    envoyer: async (corps, unique) => { j.envois.push({corps, unique}); if (casse.envoyer) throw new Error('réseau'); return resend; },
    signer: async chemin => casse.signer ? '' : 'https://x.supabase.co/storage/v1/object/sign/contact-pieces/' + chemin + '?token=t',
    journal: quoi => j.journal.push(quoi)
  });
  const appeler = async (method = 'POST') => { const r = await h(new Request('https://x.test/alerte-mail', {method, body: method === 'POST' ? '{}' : undefined})); return {status: r.status, corps: await r.json()}; };
  return {j, appeler};
}

test('sans la clé de Resend, la fonction veille : rien n’est pris, donc rien n’est perdu', async () => {
  const {j, appeler} = monter({pret: false, attend: [contact()]});
  assert.deepEqual(await appeler(), {status: 200, corps: {ok: false, raison: 'veille'}});
  assert.equal(j.pris, 0);
  assert.equal(j.envois.length, 0);
});

test('seul un POST est écouté, et rien n’attend : aucun e-mail', async () => {
  const {j, appeler} = monter({attend: []});
  assert.equal((await appeler('GET')).status, 405);
  assert.equal(j.pris, 0);
  assert.deepEqual(await appeler(), {status: 200, corps: {ok: true}});
  assert.equal(j.pris, 1);
  assert.equal(j.envois.length, 0);
});

test('un message : un e-mail à Elisa, le sujet et le début du message en objet, l’adresse laissée en adresse de réponse', async () => {
  const {j, appeler} = monter({attend: [contact()]});
  assert.deepEqual(await appeler(), {status: 200, corps: {ok: true}}, 'la réponse ne dit rien de ce qui est parti');
  assert.equal(j.envois.length, 1);
  const {corps, unique} = j.envois[0];
  assert.deepEqual(Object.keys(corps).sort(), ['from', 'reply_to', 'subject', 'text', 'to'], 'du texte simple, pas de HTML');
  assert.equal(corps.from, 'Requête <onboarding@resend.dev>');
  assert.deepEqual(corps.to, ['contact@requeteapp.com']);
  assert.equal(corps.reply_to, 'lea@exemple.fr');
  assert.equal(corps.subject, 'Requête · Bug : L’écran reste blanc quand j’ouvre la leçon 3.');
  for (const morceau of ['Mon compte › Contacte-nous', 'Sujet : Bug', 'Reçu le 12/11/2026 à 22:41', 'De : lea@exemple.fr',
    'L’écran reste blanc\nquand j’ouvre la leçon 3.', 'Appareil : iPhone', 'Navigateur : Safari', 'Écran : 393×852', 'Version : 2912',
    'Pour répondre, réponds simplement à cet e-mail.', 'https://supabase.com/dashboard/project/abc/editor'])
    assert.ok(corps.text.includes(morceau), morceau);
  assert.match(unique, /^requete-alerte-[0-9a-f]{64}$/);
  assert.equal(j.rendus.length, 0);
});

test('sans adresse laissée : pas d’adresse de réponse, et l’e-mail le dit', async () => {
  const m = await ecrire([contact({email: null})]);
  assert.equal(m.repondre, '');
  assert.ok(m.texte.includes('De : pas d’adresse laissée (pas de réponse possible)'));
  assert.ok(!m.texte.includes('Pour répondre'));
  const {j, appeler} = monter({attend: [contact({email: null})]});
  await appeler();
  assert.ok(!('reply_to' in j.envois[0].corps));
});

test('une adresse ou un message tordus ne touchent ni l’objet ni l’adresse de réponse', async () => {
  const m = await ecrire([contact({email: 'lea@exemple.fr\nBcc: autre@exemple.fr', message: 'Bonjour\r\nBcc: x@y.fr\u0000 et la suite ' + 'a'.repeat(200)})]);
  assert.equal(m.repondre, '', 'une adresse avec un retour à la ligne n’est pas une adresse');
  assert.ok(!/[\r\n\u0000]/.test(m.sujet), 'l’objet tient sur une ligne');
  assert.ok(m.sujet.length <= 'Requête · Bug : '.length + 70 && m.sujet.endsWith('…'));
  assert.ok(!m.texte.includes('\u0000') && !m.texte.includes('\r'));
  assert.equal((await ecrire([contact({email: 'a@b'})])).repondre, '');
  assert.equal((await ecrire([contact({email: ' Lea@Exemple.FR '})])).repondre, 'lea@exemple.fr');
  assert.equal((await ecrire([contact({type: 'inconnu'})])).sujet.startsWith('Requête · Autre : '), true);
  assert.deepEqual(SUJETS, {bug: 'Bug', idee: 'Idée', question: 'Question', autre: 'Autre'});
});

test('les pièces jointes : un lien de lecture chacune, et le nom seul si le lien n’a pas pu être fait', async () => {
  const pieces = ['1'.repeat(32) + '/capture écran.png', '2'.repeat(32) + '/base.sqlite'];
  const m = await ecrire([contact({pieces})], {signer: async c => 'https://lien.test/' + c.length});
  assert.ok(m.texte.includes('Pièces jointes (liens valables 7 jours) :\n- capture écran.png : https://lien.test/50\n- base.sqlite : https://lien.test/44'));
  const sans = await ecrire([contact({pieces: pieces.slice(0, 1)})], {signer: async () => { throw new Error('stockage'); }});
  assert.ok(sans.texte.includes('Pièce jointe :\n- capture écran.png (à ouvrir dans Supabase › Storage › contact-pieces)'));
  assert.ok(!sans.texte.includes('valable'), 'pas de durée annoncée sans lien');
  assert.ok(!(await ecrire([contact()])).texte.includes('Pièce'));
  /* Le fichier lui-même ne part jamais chez Resend */
  assert.ok(!poignee.includes('attachments') && !entree.includes('attachments'));
  assert.match(entree, /\/storage\/v1\/object\/sign\/contact-pieces\/\$\{voie\}/);
  assert.match(entree, /expiresIn: 604800/);
});

test('un avis avec un commentaire, un pseudo signalé : chacun son e-mail lisible', async () => {
  const a = await ecrire([avis()]);
  assert.equal(a.sujet, 'Requête · Avis ★★★★☆ sur la leçon 12 « Les jointures »');
  assert.ok(a.texte.startsWith('Avis sur une leçon : ★★★★☆ (4 sur 5)\nLeçon 12 · « Les jointures »\nReçu le 12/11/2026 à 22:45\n\nTrès clair, merci !'));
  assert.equal(a.repondre, '');
  assert.ok(!a.texte.includes('e'.repeat(64)), 'l’empreinte de l’appareil ne part pas');
  assert.equal(etoiles(5), '★★★★★');
  assert.equal(etoiles(1), '★☆☆☆☆');
  assert.equal(etoiles('x'), '☆☆☆☆☆');
  const s = await ecrire([signalement()]);
  assert.equal(s.sujet, 'Requête · Pseudo signalé : Xx');
  assert.ok(s.texte.includes('Pseudo signalé au classement : « Xx »\nSignalé le 12/11/2026 à 22:50\n2 signalements pour ce joueur. Il sera masqué du classement au 3e signalement compté'));
  assert.ok(!s.texte.includes('11111111-1111'), 'les identifiants des joueurs ne partent pas');
  const masque = await ecrire([signalement({signalements: 3, masque: true})]);
  assert.ok(masque.texte.includes('3 signalements pour ce joueur : il est maintenant masqué du classement.'));
  assert.ok((await ecrire([signalement({signalements: 1})])).texte.includes('1 signalement pour ce joueur.'));
});

test('plusieurs retours d’un coup : un seul e-mail, les messages d’abord, chacun dans l’ordre d’arrivée', async () => {
  const lot = [signalement(), avis(), contact({ref: '13', quand: '2026-11-12T22:44:00+01:00', message: 'Le second'}), contact()];
  const {j, appeler} = monter({attend: lot});
  await appeler();
  assert.equal(j.envois.length, 1);
  const {corps} = j.envois[0];
  assert.equal(corps.subject, 'Requête · 2 messages, 1 avis, 1 signalement');
  const t = corps.text;
  const places = ['L’écran reste blanc', 'Le second', 'Avis sur une leçon', 'Pseudo signalé au classement'].map(x => t.indexOf(x));
  assert.ok(places.every(p => p >= 0) && places.join() === [...places].sort((x, y) => x - y).join(), places.join());
  assert.equal(corps.reply_to, 'lea@exemple.fr', 'les deux messages viennent de la même adresse');
  const deux = await ecrire([contact(), contact({ref: '13', email: 'autre@exemple.fr'})]);
  assert.equal(deux.repondre, '', 'deux adresses différentes : chacune est dans son message, pas de réponse automatique');
  assert.ok(deux.texte.includes('De : lea@exemple.fr') && deux.texte.includes('De : autre@exemple.fr'));
  assert.equal((await ecrire([contact(), contact({ref: '13', email: null})])).repondre, '');
  assert.equal((await ecrire([avis(), avis({ref: 'f'.repeat(64) + ':3'})])).sujet, 'Requête · 2 avis');
  assert.equal((await ecrire([{genre: 'inconnu'}, null, contact()])).combien, 1, 'ce qui n’a pas de sorte connue est ignoré');
});

test('l’envoi rate : les lignes sont rendues à la base pour le rattrapage, et le journal dit pourquoi sans rien citer', async () => {
  for (const cas of [{resend: {ok: false, status: 403, raison: 'validation_error'}}, {casse: {envoyer: true}}]) {
    const {j, appeler} = monter({attend: [contact(), avis()], ...cas});
    assert.deepEqual(await appeler(), {status: 502, corps: {ok: false, raison: 'envoi'}});
    assert.deepEqual(j.rendus, [[{genre: 'contact', ref: '12'}, {genre: 'avis', ref: 'e'.repeat(64) + ':12'}]]);
    assert.equal(j.journal.length, 1);
    assert.ok(!j.journal[0].includes('blanc') && !j.journal[0].includes('lea@'), 'ni message ni adresse dans le journal');
  }
  const refus = monter({attend: [contact()], resend: {ok: false, status: 403, raison: 'validation_error'}});
  await refus.appeler();
  assert.equal(refus.j.journal[0], 'Resend 403 validation_error');
  /* La base ne répond pas : rien n’est envoyé */
  const {j, appeler} = monter({casse: {prendre: true}});
  assert.deepEqual(await appeler(), {status: 500, corps: {ok: false, raison: 'base'}});
  assert.equal(j.envois.length, 0);
  /* Rendre échoue aussi : la fonction répond quand même */
  const double = monter({attend: [contact()], casse: {envoyer: true, rendre: true}});
  assert.equal((await double.appeler()).status, 502);
  assert.deepEqual(double.j.journal, ['réseau', 'rendre']);
});

test('la clé d’envoi : la même pour le même lot, une autre à l’essai suivant, et jamais les références de la base', async () => {
  const k1 = await cleEnvoi([contact(), avis()]);
  assert.equal(k1, await cleEnvoi([avis(), contact()]), 'l’ordre du lot ne compte pas');
  assert.notEqual(k1, await cleEnvoi([contact({essai: 2}), avis()]));
  assert.notEqual(k1, await cleEnvoi([contact()]));
  assert.ok(k1.length <= 256 && !k1.includes('e'.repeat(64)));
  assert.match(entree, /'Idempotency-Key': unique/);
});

test('le point d’entrée : la clé vient des secrets, l’adresse d’arrivée et l’expéditeur ont une valeur par défaut', () => {
  assert.equal(RESEND, 'https://api.resend.com/emails');
  assert.match(entree, /Deno\.env\.get\('RESEND_API_KEY'\) \?\? ''/);
  assert.match(entree, /Deno\.env\.get\('ALERTE_MAIL_A'\) \?\? 'contact@requeteapp\.com'/);
  assert.match(entree, /Deno\.env\.get\('ALERTE_MAIL_DE'\) \?\? 'Requête <onboarding@resend\.dev>'/);
  assert.match(entree, /pret: !!cle,/);
  assert.match(entree, /prendre: \(\) => rpc\('alerte_prendre', \{\}\)/);
  assert.match(entree, /rendre: \(refs: unknown\) => rpc\('alerte_rendre', \{p_refs: refs\}\)/);
  assert.match(entree, /Authorization: `Bearer \$\{cle\}`/);
  assert.ok(!/re_[A-Za-z0-9]{8,}/.test(entree + poignee + sql), 'aucune clé de Resend dans le dépôt');
  /* Rien de ce qu’on lui envoie n’est lu : pas de corps de requête, pas d’en-tête */
  assert.ok(!/request\.(json|text|headers)/.test(poignee));
});

test('la base : elle prévient sans jamais bloquer l’écriture, et seules les fonctions du serveur prennent ou rendent', () => {
  assert.match(sql, /create extension if not exists pg_net with schema extensions;/);
  for (const t of ['contact_message', 'avis_lecon', 'jeu_signalement'])
    assert.match(sql, new RegExp(`alter table public\\.${t}\\s+add column if not exists alerte_le timestamptz,\\s+add column if not exists alerte_essais smallint not null default 0;`), t);
  /* Ce qui existait avant n’est pas envoyé */
  assert.match(sql, /update public\.contact_message set alerte_le = cree where alerte_le is null;/);
  assert.match(sql, /update public\.avis_lecon set alerte_le = note_le where alerte_le is null and commentaire is not null;/);
  assert.match(sql, /update public\.jeu_signalement set alerte_le = cree where alerte_le is null;/);
  /* L’appel part sans attendre, et une panne est avalée */
  const prevenir = sql.slice(sql.indexOf('function requete_private.alerte_prevenir()'), sql.indexOf('function requete_private.avis_alerte_remettre()'));
  assert.match(prevenir, /begin\s+perform net\.http_post\(url := requete_private\.alerte_url\(\), body := '\{\}'::jsonb, timeout_milliseconds := 10000\);\s+exception when others then null;\s+end;\s+return null;/);
  assert.match(sql, /select 'https:\/\/ynuenrxozcpkrjdbeftc\.supabase\.co\/functions\/v1\/alerte-mail'::text;/);
  assert.match(sql, /create trigger contact_message_alerte after insert on public\.contact_message\s+for each row execute function requete_private\.alerte_prevenir\(\);/);
  assert.match(sql, /create trigger jeu_signalement_alerte after insert on public\.jeu_signalement\s+for each row execute function requete_private\.alerte_prevenir\(\);/);
  /* Un avis : seulement avec un commentaire, et de nouveau quand le commentaire change */
  assert.match(sql, /create trigger avis_lecon_alerte after insert or update of commentaire on public\.avis_lecon\s+for each row when \(new\.commentaire is not null and new\.alerte_le is null\)\s+execute function requete_private\.alerte_prevenir\(\);/);
  assert.match(sql, /create trigger avis_lecon_alerte_remettre before update of commentaire on public\.avis_lecon/);
  assert.match(sql, /if new\.commentaire is not null and new\.commentaire is distinct from old\.commentaire then\s+new\.alerte_le := null;\s+new\.alerte_essais := 0;/);
  /* Garde-fous */
  assert.match(sql, /if v_envois >= 40 or \(v_envois >= 10 and v_dernier > now\(\) - interval '10 minutes'\) then\s+return v;/);
  assert.equal((sql.match(/alerte_essais < 5/g) || []).length, 6, 'cinq essais au plus, pour prendre comme pour savoir s’il reste quelque chose');
  assert.equal((sql.match(/interval '2 days'/g) || []).length, 6);
  assert.equal((sql.match(/limit 20 for update skip locked/g) || []).length, 3);
  assert.match(sql, /perform pg_advisory_xact_lock\(hashtext\('requete\.alerte_mail'\)\);/);
  /* Droits */
  for (const f of ['public.alerte_prendre()', 'public.alerte_rendre(jsonb)'])
    assert.ok(sql.includes(`revoke all on function ${f} from public, anon, authenticated;`) && sql.includes(`grant execute on function ${f} to service_role;`), f);
  assert.ok(!/grant execute on function [^;]*alerte[^;]* to (anon|authenticated)/.test(sql));
  assert.match(sql, /alter table requete_private\.alerte_envoi enable row level security;/);
  for (const m of sql.matchAll(/create or replace function ([a-z_.]+)\([^)]*\)[^$]*\$\$/g))
    assert.match(m[0], /set search_path = ''/, m[1]);
  /* Le rattrapage de chaque heure */
  assert.match(sql, /select cron\.schedule\('alerte-mail-rattrapage', '47 \* \* \* \*', 'select requete_private\.alerte_rattraper\(\)'\);/);
  assert.match(sql, /if requete_private\.alerte_attend\(\) then\s+perform net\.http_post/);
  /* La vérification à lancer dans l’éditeur SQL annule tout */
  const verif = lire('supabase/tests/alerte_mail.sql');
  assert.ok(verif.includes('\nbegin;\n') && verif.trimEnd().endsWith('rollback;'));
});

test('la confidentialité le dit, sur le site comme dans l’appli, et IOS.md explique la clé', () => {
  const page = lire('decouvrir/confidentialite.html');
  assert.ok(page.includes(`une copie (ton message, son sujet, ton adresse e-mail si tu l’as donnée et ces infos techniques) nous est envoyée par e-mail par le service d’envoi Resend (Plus Five Five, Inc., États-Unis)&nbsp;; tes fichiers n’y sont pas joints, seulement un lien de lecture valable 7&nbsp;jours.`));
  assert.ok(page.includes('Quand il porte un commentaire, il nous est aussi envoyé par e-mail (la note, le commentaire, la leçon et la date, sans ton identifiant) par le service d’envoi Resend (États-Unis).'));
  assert.ok(page.includes('(le pseudo signalé nous est envoyé par e-mail, par le service d’envoi Resend, pour que nous le vérifiions vite)'));
  const app = lire('index.html');
  assert.equal(app.split('Pour les lire sans attendre, nous en recevons une copie par e-mail, par le service d’envoi Resend (États-Unis).</li>').length - 1, 2);
  assert.equal(app.split('Un commentaire nous arrive aussi par e-mail (Resend), sans cet identifiant.</li>').length - 1, 2);
  assert.ok(!page.includes(N + ';') && !/prochainement|bientôt disponible/i.test(page.slice(page.indexOf('Messages de contact'), page.indexOf('Rappel quotidien'))));
  const doc = lire('IOS.md');
  const bloc = doc.slice(doc.indexOf('### Les retours par e-mail'), doc.indexOf('### Les raccourcis de l’icône'));
  for (const morceau of ['`RESEND_API_KEY`', '`ALERTE_MAIL_A`', '`ALERTE_MAIL_DE`', 'supabase/functions/alerte-mail', '20261112215758_alerte_mail.sql',
    'supabase/tests/alerte_mail.sql', 'Sending access', '40 e-mails par jour'])
    assert.ok(bloc.includes(morceau), morceau);
  assert.ok(!bloc.includes('—'));
});
