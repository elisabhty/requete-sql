/* Un client écrit par SMS : la notification de l’iPhone, puis la conversation de Messages (assets/anim/core.js et core.css).
   Elisa, 24 octobre : « Quand c’est des clients, faire plutôt des messages SMS immersifs, crédibles, iPhone iOS. »
   Un coach, l’équipe ou le développeur écrivent toujours par mail ; l’accueil, qui centralise les demandes des clients depuis le chapitre 5,
   écrit par SMS quand la page le décide (7e élément du message : {sms: true}), sinon par mail (Elisa, 25 octobre : « c’est un message de
   l’accueil qui dit qu’elle ne pourra pas venir »). La règle « client-par-sms » de la charte (tests/helpers/redaction.mjs) vérifie que
   chaque chapitre du projet, y compris ceux à venir, la respecte. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as R from './helpers/redaction.mjs';

const lire = f => fs.readFileSync(path.join(R.ANIM, f), 'utf8');
const core = lire('core.js'), css = lire('core.css'), index = fs.readFileSync(path.join(R.ROOT, 'index.html'), 'utf8');

/* La partie « SMS » du moteur, exécutée seule : ses fonctions pures (isSms, smsTime, smsParts, smsCard). */
const a = core.indexOf('/* ---------- Un client écrit : SMS'), b = core.indexOf('/* ---------- Habillage : chapitres et légendes');
assert.ok(a > 0 && b > a, 'repères de la partie SMS de core.js introuvables');
const ctx = vm.createContext({});
vm.runInContext("const NB = '\\u00a0';" + core.slice(a, b) + ';this.S = {isSms, smsTime, smsParts, smsCard, SMS_ICO};', ctx);
const S = ctx.S;
const parts = body => [...S.smsParts(body)];   // un tableau du moteur (autre contexte) ne se compare pas tel quel

test('qui écrit par SMS : un client ou une cliente ; l’accueil seulement quand la page le décide ({sms: true})', () => {
  for (const t of ['client', 'cliente']) assert.equal(S.isSms(t), true, t);
  for (const t of ['coach', 'équipe', 'accueil', 'développeur']) assert.equal(S.isSms(t), false, t);
  assert.equal(S.isSms('accueil', {sms: true}), true, 'l’accueil qui relaie une demande écrit par SMS');
  assert.equal(S.isSms('accueil', {}), false);
  assert.equal(S.isSms('accueil', undefined), false);
  assert.equal(S.isSms('coach', {sms: false}), false);
});

test('les bulles : « Bonjour, », une bulle par phrase de la demande, « Merci ! », jamais de signature', () => {
  assert.deepEqual(parts(['Je ne viendrai finalement à aucun atelier.', 'Peux-tu supprimer mon compte ?']),
    ['Bonjour,', 'Je ne viendrai finalement à aucun atelier.', 'Peux-tu supprimer mon compte ?', 'Merci !']);
  assert.deepEqual(parts('Je ne pourrai pas venir à l’atelier Cuisine saine prévu le 19 septembre. Peux-tu annuler mon inscription ?'),
    ['Bonjour,', 'Je ne pourrai pas venir à l’atelier Cuisine saine prévu le 19 septembre.', 'Peux-tu annuler mon inscription ?', 'Merci !'], 'un texte de deux phrases : deux bulles');
  assert.deepEqual(parts('Je voudrais aussi participer à l’atelier Méditation du 24 septembre.'), ['Bonjour,', 'Je voudrais aussi participer à l’atelier Méditation du 24 septembre.', 'Merci !']);
});

test('l’heure d’envoi : « 07:00 » à « 18:59 », la même pour un même expéditeur', () => {
  for (const n of ['Léa Simon', 'Nathan Dupont', 'Inès Lefebvre', 'Sophie Martin']) {
    const h = S.smsTime(n);
    assert.match(h, /^(0[7-9]|1[0-8]):[0-5]\d$/, `${n} : ${h}`);
    assert.equal(S.smsTime(n), h);
  }
  assert.notEqual(S.smsTime('Léa Simon'), S.smsTime('Nathan Dupont'), 'deux expéditeurs, deux heures');
});

test('la carte d’un SMS : bannière de notification, conversation, bulles, barre de saisie', () => {
  const h = S.smsCard(2, 'k-cl', 'Nathan', 'Dupont', 'ND', ['Je ne viendrai finalement à aucun atelier.', 'Peux-tu supprimer mon compte ?']);
  assert.ok(h.startsWith('<div class="abs ml sms k-cl" id="ml2">'), 'même emplacement et même identifiant qu’un mail : la page le place, le montre et le cache pareil');
  assert.ok(!/class="[^"]*\bcard\b[^"]*\bml\b/.test(h) && /<div class="card sms-n">/.test(h) && /<div class="card sms-v">/.test(h), 'les cadres visibles (bannière, conversation) sont des cartes : le contrôle des cadres collés les voit');
  /* La bannière : l’icône Messages, le nom, « maintenant », le début du message (pas « Bonjour, »). */
  const ban = h.slice(h.indexOf('sms-n'), h.indexOf('sms-v'));
  assert.ok(ban.includes('class="sms-ic"') && ban.includes('<b>Nathan Dupont</b>') && ban.includes('<span>maintenant</span>'), 'icône Messages, nom, « maintenant »');
  assert.ok(ban.includes('<div class="sms-np">Je ne viendrai finalement à aucun atelier.</div>') && !ban.includes('Bonjour,'), 'la bannière montre le début de la demande');
  /* La conversation : en-tête (retour, avatar, nom, vidéo), date, bulles, barre de saisie. */
  const conv = h.slice(h.indexOf('class="card sms-v"'));
  for (const part of ['class="sms-bk"', 'class="sms-vd"', '<i class="sms-av">ND</i>', 'Nathan Dupont<i>›</i>', 'Message texte · SMS<br><b>Aujourd’hui</b> ' + S.smsTime('Nathan Dupont'),
    '<div class="sms-t"><i></i><i></i><i></i></div>', '<div class="sms-i">', 'class="sms-in">Message texte · SMS'])
    assert.ok(conv.includes(part), `conversation : ${part}`);
  const bulles = [...conv.matchAll(/<p class="sms-m( last)?">([^<]*)<\/p>/g)];
  assert.deepEqual(bulles.map(m => m[2]), ['Bonjour,', 'Je ne viendrai finalement à aucun atelier.', 'Peux-tu supprimer mon compte ?', 'Merci !']);
  assert.deepEqual(bulles.map(m => !!m[1]), [false, false, false, true], 'seule la dernière bulle a sa queue');
  /* Rien d’un mail : ni avatar à enveloppe, ni étiquette, ni signature. */
  for (const part of ['mav', 'mbg', 'mtg', '✉️', 'Nouveau mail', 'class="sn']) assert.ok(!h.includes(part), `un SMS n’a pas : ${part}`);
});

test('la conversation compacte (sous un tableau) : sans date ni barre de saisie', () => {
  const h = S.smsCard(2, 'k-cl', 'Léa', 'Simon', 'LS', 'Je ne pourrai pas venir. Peux-tu annuler mon inscription ?', true);
  assert.ok(h.startsWith('<div class="abs ml sms cmp k-cl" id="ml2">'));
  assert.ok(!h.includes('class="sms-d"') && !h.includes('class="sms-i"') && !h.includes('class="sms-in"'), 'ni date, ni barre de saisie');
  assert.ok(h.includes('<i class="sms-av">LS</i>') && h.includes('<div class="sms-t">'), 'l’en-tête et « … » restent');
});

test('le style : bulles grises iOS, bleu des icônes, queue de la dernière bulle, cadre d’un mail replié', () => {
  for (const part of ['.ml.sms{padding:0;overflow:visible;border-radius:58px}', '.sms-m{', 'background:#E9E9EB', '#007AFF', '.sms-m.last::before', '.sms-m.last::after', '.sms-t{', '.sms-i{', '.sms-in{',
    '.ml.sms.cmp .sms-v{top:0;', '.ml.sms.cmp .sms-m{'])
    assert.ok(css.includes(part) || core.includes(part), `core.css : ${part}`);
  const sms = css.slice(css.indexOf('/* ---------- Un client écrit : SMS'));
  assert.ok(!/-apple-system|system-ui|San Francisco|SF Pro/i.test(sms.replace(/\/\*[\s\S]*?\*\//g, '')), 'la police est celle des animations (Inter) : mêmes retours à la ligne sur tous les appareils');
  assert.ok(/\.ml\.sms\{[^}]*border-radius:58px/.test(sms), 'la carte a le rayon de la bannière : l’app l’entoure comme elle entoure un mail');
});

test('la cadence : la bannière, le toucher, « … », puis une bulle toutes les 0,28 s (0,25 s en version serrée) ; l’image reste le temps de lire', () => {
  const f = core.slice(core.indexOf('function smsIn('), core.indexOf('/* ---------- Habillage'));
  for (const part of ["cue(t, 'sms', 0.8);", "cue(T, 'click', 0.5);", 'first = T + (fast ? 0.5 : 0.62)', 'step = fast ? 0.25 : 0.28', "tl.set(dots, {autoAlpha: 0}, first);",
    'const end = first + (bubbles.length - 1) * step + 0.35;', 'hold(end + 0.05, Math.ceil(readTime(bubbles.slice(1, -1).map(b => b.textContent).join(\' \')) * 20) / 20);'])
    assert.ok(f.includes(part), `smsIn : ${part}`);
  assert.ok(core.includes('await document.fonts.ready;\n    smsFit();'), 'les bulles se resserrent sur leur ligne la plus longue, polices chargées, avant la timeline');
  assert.ok(index.includes("case 'sms':{"), 'le son de la notification existe dans le lecteur');
});

/* ---------- Les chapitres ---------- */
const PAGES = R.pagesProjet();
const AVEC_CLIENT = PAGES.filter(f => R.donnees(f).MAILS.some(m => /^client/.test(m[2])));
test('les chapitres où un client écrit : 1, 2, 9 et 10 (ceux à venir s’ajoutent seuls)', () => {
  assert.deepEqual(['projet-cles.html', 'projet-delete.html', 'projet-normaliser.html', 'projet-ondelete.html'].filter(f => !AVEC_CLIENT.includes(f)), [], 'les quatre chapitres déjà faits');
});
for (const f of AVEC_CLIENT) {
  test(`${f} : le message d’un client est un SMS (smsCard, smsIn), celui d’un coach ou de l’équipe reste un mail`, () => {
    const src = lire(f), M = R.donnees(f).MAILS;
    assert.ok(R.rendEnSms(src), 'smsCard pour une étiquette de client, smsIn dans mailIn');
    assert.ok(/isSms\(tag, MAILS\[n\]\[6\]\) \? smsCard\(n \+ 1, k, /.test(src) && /function mailIn\(n, t, T\)\{\n  if \(isSms\(MAILS\[n - 1\]\[2\], MAILS\[n - 1\]\[6\]\)\) \{ if \(!APP\) fingerTap\(\$\('#ml' \+ n\), T\); return smsIn\(n, t, T/.test(src), 'même câblage dans chaque page');
    assert.ok(M.some(m => !/^client/.test(m[2])), 'au moins un mail resté un mail');
    /* La page garde le code du mail (coach, équipe, accueil) : avatar à enveloppe, adresse, signature. */
    assert.ok(src.includes('<i class="mav">') && src.includes('Nouveau mail'), 'la carte de mail existe toujours');
    /* L’app s’arrête sur la notification : « Touche le message… » pour un client, « Touche le mail… » sinon. */
    assert.ok(src.includes("msg = /^client/.test(MAILS[n][2]) || (MAILS[n][6] || {}).sms ? 'message' : 'mail'") && src.includes('prompt: `Touche le ${msg} pour l’ouvrir.`') && src.includes('label: `Ouvrir le ${msg} '), 'consigne et étiquette du toucher');
  });
}
test('chapitre 1 : la conversation est compacte et serrée (elle tient sous le fichier, avant que la légende ne revienne)', () => {
  const src = lire('projet-normaliser.html');
  assert.ok(src.includes('smsCard(n + 1, k, w[1], w[2], w[4], body, true)') && src.includes('return smsIn(n, t, T, true);'), 'version compacte et cadence serrée');
});
test('chapitre 9 : l’accueil relaie la demande de Léa Simon par SMS (« Léa ne pourra pas venir. » en aperçu) ; Nathan écrit par SMS ; Hugo reste un mail de l’accueil', () => {
  const src = lire('projet-delete.html'), M = R.donnees('projet-delete.html').MAILS;
  assert.deepEqual(M.map(m => `${m[0][0]} ${m[0][1]} [${m[2]}]`), ['L’accueil NutriBoost [accueil]', 'Nathan Dupont [client]', 'L’accueil NutriBoost [accueil]']);
  assert.deepEqual(M.map(m => !!(m[6] && m[6].sms)), [true, false, false], 'seul le premier message de l’accueil porte l’option {sms: true}');
  assert.deepEqual(parts(M[0][4]), ['Bonjour,', 'Léa ne pourra pas venir.', 'Elle est inscrite à l’atelier Cuisine saine du 19 septembre.', 'Peux-tu annuler son inscription ?', 'Merci !'],
    'une bulle par phrase ; la première phrase est l’aperçu de la notification');
  const h = S.smsCard(1, 'k-in', 'L’accueil', 'NutriBoost', 'AC', M[0][4]);
  const ban = h.slice(h.indexOf('sms-n'), h.indexOf('sms-v'));
  assert.ok(ban.includes('<b>L’accueil NutriBoost</b>') && ban.includes('<div class="sms-np">Léa ne pourra pas venir.</div>'), 'bannière : « L’accueil NutriBoost », « Léa ne pourra pas venir. »');
  assert.ok(h.includes('<i class="sms-av">AC</i>') && h.includes('L’accueil NutriBoost<i>›</i>'), 'conversation : avatar AC, nom de l’accueil');
  assert.ok(src.includes('Elisa, 25 octobre'), 'la page garde la trace de la demande d’Elisa');
});
test('chapitres 9 et 10 : la légende annonce les SMS', () => {
  assert.ok(lire('projet-delete.html').includes('cap(\'c2\', "Trois demandes arrivent :<br>deux SMS et un mail.", 2.8);'));
  assert.ok(lire('projet-ondelete.html').includes('cap(\'c2\', "Deux demandes arrivent :<br>un SMS et un mail.", 2.8);'));
});
