/* Un client écrit par SMS : la notification de l’iPhone, puis la conversation de Messages (assets/anim/core.js et core.css).
   Elisa, 24 octobre : « Quand c’est des clients, faire plutôt des messages SMS immersifs, crédibles, iPhone iOS. »
   Un coach, l’équipe ou le développeur écrivent toujours par mail ; le service client, qui centralise les demandes des clients depuis le
   chapitre 5, écrit par SMS quand la page le décide (7e élément du message : {sms: true}), sinon par mail (Elisa, 25 octobre : « c’est un
   message de l’accueil qui dit qu’elle ne pourra pas venir », puis « plus l’accueil mais le service client »). Depuis le chapitre 6, aucun
   client n’écrit lui-même. Les règles « client-par-sms » et « service-client-relaie » de la charte (tests/helpers/redaction.mjs) vérifient que
   chaque chapitre du projet, y compris ceux à venir, les respecte. */
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
vm.runInContext("const NB = '\\u00a0';" + core.slice(a, b) + ';this.S = {isSms, smsTime, smsRank, smsParts, smsCard, SMS_ICO};', ctx);
const S = ctx.S;
const parts = (body, hello) => [...S.smsParts(body, hello)];   // un tableau du moteur (autre contexte) ne se compare pas tel quel

test('qui écrit par SMS : un client ou une cliente ; le service client seulement quand la page le décide ({sms: true})', () => {
  for (const t of ['client', 'cliente']) assert.equal(S.isSms(t), true, t);
  for (const t of ['coach', 'équipe', 'service client', 'développeur']) assert.equal(S.isSms(t), false, t);
  assert.equal(S.isSms('équipe', {sms: true}), true, 'le service client qui relaie une demande écrit par SMS');
  assert.equal(S.isSms('équipe', {}), false);
  assert.equal(S.isSms('équipe', undefined), false);
  assert.equal(S.isSms('équipe', {bye: 'Merci pour ton aide !'}), false, 'une formule de fin ne change pas le support : c’est un mail');
  assert.equal(S.isSms('coach', {sms: false}), false);
});

test('les bulles : « Bonjour, », une bulle par phrase de la demande, « Merci ! », jamais de signature', () => {
  assert.deepEqual(parts(['Je ne viendrai finalement à aucun atelier.', 'Peux-tu supprimer mon compte ?']),
    ['Bonjour,', 'Je ne viendrai finalement à aucun atelier.', 'Peux-tu supprimer mon compte ?', 'Merci !']);
  assert.deepEqual(parts('Je ne pourrai pas venir à l’atelier Cuisine saine prévu le 19 septembre. Peux-tu annuler mon inscription ?'),
    ['Bonjour,', 'Je ne pourrai pas venir à l’atelier Cuisine saine prévu le 19 septembre.', 'Peux-tu annuler mon inscription ?', 'Merci !'], 'un texte de deux phrases : deux bulles');
  assert.deepEqual(parts('Je voudrais aussi participer à l’atelier Méditation du 24 septembre.'), ['Bonjour,', 'Je voudrais aussi participer à l’atelier Méditation du 24 septembre.', 'Merci !']);
});

test('la première bulle : « Bonjour, » par défaut ; la page peut choisir la sienne (hello : « Bonjour ! »), la bannière montre toujours la première phrase', () => {
  assert.deepEqual(parts('Peux-tu venir ?'), ['Bonjour,', 'Peux-tu venir ?', 'Merci !']);
  assert.deepEqual(parts('Peux-tu venir ?', 'Bonjour !'), ['Bonjour !', 'Peux-tu venir ?', 'Merci !']);
  const h = S.smsCard(1, 'k-in', 'Le service client', 'NutriBoost', 'SC', 'Peux-tu venir ?', false, 0, 'Bonjour !');
  assert.ok(h.includes('<p class="sms-m">Bonjour !</p>') && !h.includes('Bonjour,'), 'la conversation s’ouvre sur « Bonjour ! »');
  assert.ok(h.slice(h.indexOf('sms-n'), h.indexOf('sms-v')).includes('<div class="sms-np">Peux-tu venir&nbsp;?</div>'.replace('&nbsp;', '\u00a0')), 'l’aperçu de la notification est la première phrase, pas « Bonjour ! »');
});

test('l’heure d’envoi : « 07:00 » à « 18:59 », la même pour un même expéditeur', () => {
  for (const n of ['Léa Simon', 'Nathan Dupont', 'Inès Lefebvre', 'Sophie Martin']) {
    const h = S.smsTime(n);
    assert.match(h, /^(0[7-9]|1[0-8]):[0-5]\d$/, `${n} : ${h}`);
    assert.equal(S.smsTime(n), h);
  }
  assert.notEqual(S.smsTime('Léa Simon'), S.smsTime('Nathan Dupont'), 'deux expéditeurs, deux heures');
});

test('deux SMS du même expéditeur (le service client, aux chapitres 9 et 10) : sept minutes d’écart, jamais la même heure', () => {
  const nom = 'Le service client NutriBoost', min = h => +h.slice(0, 2) * 60 + +h.slice(3);
  assert.equal(S.smsTime(nom, 0), S.smsTime(nom), 'le premier SMS garde l’heure de l’expéditeur');
  assert.equal(min(S.smsTime(nom, 1)) - min(S.smsTime(nom, 0)), 7);
  assert.equal(min(S.smsTime(nom, 2)) - min(S.smsTime(nom, 0)), 14);
  for (const n of [0, 1, 2]) assert.match(S.smsTime(nom, n), /^(0[7-9]|1[0-9]|2[0-3]):[0-5]\d$/, `heure ${n}`);
});
test('le rang d’un SMS parmi ceux du même expéditeur : 0 pour le premier, un mail ou un autre expéditeur ne compte pas', () => {
  const L = (nom, tag, opt) => [[nom, 'NutriBoost', 'SC'], 'k-in', tag, 'x@y.fr', ['Bonjour.'], 'x', opt];
  const liste = [L('Le service client', 'équipe', {sms: true}), L('Karim', 'développeur'), L('Le service client', 'équipe', {sms: true}), L('Le service client', 'équipe', {bye: 'Merci !'}), L('Le service client', 'équipe', {sms: true})];
  assert.deepEqual([0, 2, 4].map(n => S.smsRank(liste, n)), [0, 1, 2], 'les trois SMS du service client : rangs 0, 1 et 2 ; son mail (n°4) ne décale pas le rang du dernier SMS');
  assert.equal(S.smsRank(liste, 1), 0, 'un autre expéditeur repart de 0');
});

test('la carte d’un SMS : son rang décale l’heure d’envoi, sans toucher au reste', () => {
  const corps = ['Léa ne pourra pas venir.', 'Peux-tu annuler son inscription ?'];
  const a = S.smsCard(1, 'k-in', 'Le service client', 'NutriBoost', 'SC', corps), b = S.smsCard(2, 'k-in', 'Le service client', 'NutriBoost', 'SC', corps, false, 1);
  const nom = 'Le service client NutriBoost';
  assert.ok(a.includes('<b>Aujourd’hui</b> ' + S.smsTime(nom, 0)) && b.includes('<b>Aujourd’hui</b> ' + S.smsTime(nom, 1)) && S.smsTime(nom, 0) !== S.smsTime(nom, 1), 'deux SMS du service client, deux heures');
  assert.equal(a.replace(/id="ml1"/, 'id="ml2"').replace(S.smsTime(nom, 0), S.smsTime(nom, 1)), b, 'seuls l’identifiant et l’heure changent');
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
const estSms = m => /^client/.test(m[2]) || !!(m[6] && m[6].sms);   // un client, ou le service client quand le message le dit
const AVEC_SMS = PAGES.filter(f => R.donnees(f).MAILS.some(estSms));
test('les chapitres où un SMS arrive : 1 et 2 (un client), 9 et 10 (le service client) ; ceux à venir s’ajoutent seuls', () => {
  assert.deepEqual(['projet-cles.html', 'projet-delete.html', 'projet-normaliser.html', 'projet-ondelete.html'].filter(f => !AVEC_SMS.includes(f)), [], 'les quatre chapitres déjà faits');
  const clients = PAGES.filter(f => R.donnees(f).MAILS.some(m => /^client/.test(m[2])));
  assert.deepEqual(clients, ['projet-cles.html', 'projet-normaliser.html'], 'un client écrit lui-même aux chapitres 1 et 2 seulement : depuis le chapitre 5, le service client centralise les demandes');
});
for (const f of AVEC_SMS) {
  test(`${f} : un SMS est rendu en SMS (smsCard, smsIn), celui d’un coach, de l’équipe ou du service client (sans option) reste un mail`, () => {
    const src = lire(f), M = R.donnees(f).MAILS;
    assert.ok(R.rendEnSms(src), 'smsCard pour un SMS, smsIn dans mailIn');
    assert.ok(/isSms\(tag, MAILS\[n\]\[6\]\) \? smsCard\(n \+ 1, k, /.test(src) && /function mailIn\(n, t, T\)\{\n  if \(isSms\(MAILS\[n - 1\]\[2\], MAILS\[n - 1\]\[6\]\)\) \{ if \(!APP\) fingerTap\(\$\('#ml' \+ n\), T\); return smsIn\(n, t, T/.test(src), 'même câblage dans chaque page');
    assert.ok(M.some(m => !estSms(m)), 'au moins un mail resté un mail');
    /* La page garde le code du mail (coach, équipe, service client) : avatar à enveloppe, adresse, signature. */
    assert.ok(src.includes('<i class="mav">') && src.includes('Nouveau mail'), 'la carte de mail existe toujours');
    /* L’app s’arrête sur la notification : « Touche le message… » pour un client, « Touche le mail… » sinon. */
    assert.ok(/msg = (?:\/\^client\/\.test\(MAILS\[n\]\[2\]\) \|\| \(MAILS\[n\]\[6\] \|\| \{\}\)\.sms|mailSms\(n\)) \? 'message' : 'mail'/.test(src) && src.includes('prompt: `Touche le ${msg} pour l’ouvrir.`') && src.includes('label: `Ouvrir le ${msg} '), 'consigne et étiquette du toucher');
  });
}
test('chapitre 1 : la conversation est compacte et serrée (elle tient sous le fichier, avant que la légende ne revienne)', () => {
  const src = lire('projet-normaliser.html');
  assert.ok(src.includes('smsCard(n + 1, k, w[1], w[2], w[4], body, true)') && src.includes('return smsIn(n, t, T, true);'), 'version compacte et cadence serrée');
});
test('chapitre 9 : le service client relaie les trois demandes : deux SMS (« Léa vient de nous prévenir… », « Nathan Dupont nous a demandé… »), puis le mail d’Hugo Laurent', () => {
  const src = lire('projet-delete.html'), M = R.donnees('projet-delete.html').MAILS;
  assert.deepEqual(M.map(m => `${m[0][0]} ${m[0][1]} [${m[2]}]`), Array(3).fill('Le service client NutriBoost [équipe]'));
  assert.deepEqual(M.map(m => !!(m[6] && m[6].sms)), [true, true, false], 'les deux premiers messages du service client portent l’option {sms: true}, le dernier est un mail');
  /* Les mots d’Elisa (25 octobre, 08 h 21, Réf 1 et 2) : « Bonjour ! », sa demande en deux phrases, « Merci ! » ; la première phrase est l’aperçu de la notification. */
  const LEA = ['Léa vient de nous prévenir au téléphone qu’elle ne pourra pas participer à l’atelier « Cuisine saine » du 19 septembre.', 'Peux-tu annuler son inscription à cet atelier ?'];
  const NATHAN = ['Nathan Dupont nous a demandé de supprimer complètement son compte, car il ne souhaite plus participer aux ateliers.', 'Peux-tu t’en occuper et me confirmer la suppression pour que je puisse lui répondre rapidement ?'];
  assert.deepEqual(M[0][4], LEA); assert.deepEqual(M[1][4], NATHAN);
  assert.deepEqual(M.slice(0, 2).map(m => m[6].hello), ['Bonjour !', 'Bonjour !'], 'les deux SMS s’ouvrent sur « Bonjour ! », pas sur « Bonjour, »');
  assert.deepEqual(parts(M[0][4], M[0][6].hello), ['Bonjour !', ...LEA, 'Merci !'], 'une bulle par phrase, entre « Bonjour ! » et « Merci ! »');
  assert.deepEqual(parts(M[1][4], M[1][6].hello), ['Bonjour !', ...NATHAN, 'Merci !']);
  const nom = 'Le service client NutriBoost';
  const h0 = S.smsCard(1, 'k-in', 'Le service client', 'NutriBoost', 'SC', M[0][4], false, S.smsRank(M, 0), M[0][6].hello), h1 = S.smsCard(2, 'k-in', 'Le service client', 'NutriBoost', 'SC', M[1][4], false, S.smsRank(M, 1), M[1][6].hello);
  const ban = h => h.slice(h.indexOf('sms-n'), h.indexOf('sms-v')).replace(/\u00a0/g, ' ');   // l’aperçu porte ses espaces insécables : on lit le texte
  assert.ok(ban(h0).includes('<b>Le service client NutriBoost</b>') && ban(h0).includes('<div class="sms-np">' + LEA[0] + '</div>'), 'bannière : « Le service client NutriBoost », la première phrase de Léa');
  assert.ok(h0.includes('<p class="sms-m">Bonjour !</p>') && h1.includes('<p class="sms-m">Bonjour !</p>') && !h0.includes('Bonjour,') && !h1.includes('Bonjour,'), 'la première bulle : « Bonjour ! »');
  assert.ok(ban(h1).includes('<b>Le service client NutriBoost</b>') && ban(h1).includes('<div class="sms-np">' + NATHAN[0] + '</div>'), 'bannière : la première phrase de Nathan');
  assert.ok(h0.includes('<i class="sms-av">SC</i>') && h0.includes('Le service client NutriBoost<i>›</i>'), 'conversation : avatar SC, nom du service client');
  assert.ok(h0.includes('<b>Aujourd’hui</b> ' + S.smsTime(nom, 0)) && h1.includes('<b>Aujourd’hui</b> ' + S.smsTime(nom, 1)) && S.smsTime(nom, 0) !== S.smsTime(nom, 1), 'deux SMS du même expéditeur : deux heures');
  assert.ok(src.includes('body, false, smsRank(MAILS, n), (MAILS[n][6] || {}).hello) : `'), 'la page donne le rang du SMS (l’heure d’envoi du second est plus tardive) et sa première bulle');
  assert.equal(M[2][6].bye, 'Merci !', 'le mail d’Hugo se termine par « Merci ! » (Elisa, 25 octobre, 08 h 21, Réf 3)');
  assert.ok(src.includes("(MAILS[n][6] || {}).bye || 'Merci !', sign]"), 'la formule de fin du mail vient du message');
  assert.ok(src.includes('Elisa, 25 octobre'), 'la page garde la trace de la demande d’Elisa');
});
test('chapitre 10 : le service client relaie la demande d’Inès Lefebvre par SMS (« Bonjour ! », puis « Inès Lefebvre ne reviendra plus aux ateliers. » en aperçu), puis écrit le mail des avis', () => {
  const src = lire('projet-ondelete.html'), M = R.donnees('projet-ondelete.html').MAILS;
  assert.deepEqual(M.map(m => `${m[0][0]} ${m[0][1]} [${m[2]}]`), Array(2).fill('Le service client NutriBoost [équipe]'));
  assert.deepEqual(M.map(m => !!(m[6] && m[6].sms)), [true, false]);
  /* Comme au chapitre 9 (Elisa, 25 octobre, réponse « Oui » de 08 h 55) : « Bonjour ! », sa demande en deux phrases, « Merci ! ». */
  assert.equal(M[0][6].hello, 'Bonjour !', 'le SMS s’ouvre sur « Bonjour ! », pas sur « Bonjour, »');
  assert.deepEqual(parts(M[0][4], M[0][6].hello), ['Bonjour !', 'Inès Lefebvre ne reviendra plus aux ateliers.', 'Peux-tu supprimer son compte ?', 'Merci !']);
  const h = S.smsCard(1, 'k-in', 'Le service client', 'NutriBoost', 'SC', M[0][4], false, S.smsRank(M, 0), M[0][6].hello);
  assert.ok(h.includes('<p class="sms-m">Bonjour !</p>') && !h.includes('Bonjour,'), 'la première bulle : « Bonjour ! »');
  assert.ok(h.slice(h.indexOf('sms-n'), h.indexOf('sms-v')).includes('<div class="sms-np">Inès Lefebvre ne reviendra plus aux ateliers.</div>'), 'l’aperçu de la notification');
  assert.ok(src.includes('body, false, smsRank(MAILS, n), (MAILS[n][6] || {}).hello) : `') && src.includes('Elisa, 25 octobre'), 'la page donne sa première bulle au SMS');
});

/* La durée d’un message suit sa longueur : une bulle (SMS) ou une ligne (mail) toutes les 0,28 s ; le départ juste après la pause de lecture, 0,06 s après sa fin. */
for (const f of ['projet-delete.html', 'projet-ondelete.html']) {
  test(`${f} : le temps d’un message suit son nombre de lignes, et le message ne part qu’après sa pause de lecture`, () => {
    const src = lire(f), a = src.indexOf('const SCH = '), b = src.indexOf('/* ---------- Gabarits');
    const D = vm.createContext({APP: true});
    vm.runInContext(src.slice(a, b) + ';this.X = {MAILS, MAILS_ROWS: MAILS.map((m, n) => mailRows(n)), MO, SMS: MAILS.map((m, n) => mailSms(n)), BLOC: MAILS.map((m, n) => +(mailOutAt(n) + 1).toFixed(2))};', D);
    const X = JSON.parse(JSON.stringify(D.X));
    X.MAILS.forEach((m, n) => {
      const lignes = X.SMS[n] ? S.smsParts(m[4]).length : 1 + [].concat(m[4]).length + 2;   // « Bonjour, », ses phrases, « Merci ! » ; ou : ses paragraphes, la formule de fin, la signature
      assert.equal(X.MAILS_ROWS[n], lignes, `message ${n + 1} : ${lignes} lignes`);
      /* Le toucher à +1,6 s ; la dernière ligne arrive à T + 0,4 + 0,28 k (mail) ou T + 0,62 + 0,28 k (SMS), le départ est après la pause (fin + 0,05). */
      const fin = 1.6 + (X.SMS[n] ? 0.62 : 0.4) + 0.28 * (lignes - 1) + 0.35;
      assert.ok(X.MO[n] > fin + 0.05 && X.MO[n] <= fin + 0.05 + 0.4, `message ${n + 1} : part à +${X.MO[n]} s, après sa pause de lecture (+${(fin + 0.05).toFixed(2)} s)`);
      assert.equal(X.BLOC[n], +(X.MO[n] + 1).toFixed(2), 'le bloc finit 1 s après le départ');
    });
    assert.ok(/mailOut\(\d, MAIL\d \+ MO\[\d\]\);/.test(src) && !/MAIL\d \+ (?:3\.8|4\.1|4\.15)\b/.test(src), 'le départ de chaque message suit sa longueur (plus de 3,8 s, 4,1 s ou 4,15 s écrits en dur)');
  });
}
test('chapitres 9 et 10 : la légende annonce les SMS', () => {
  assert.ok(lire('projet-delete.html').includes('cap(\'c2\', "Trois autres demandes arrivent.", 2.8);'));   // Elisa, 25 octobre, 08 h 17 (Réf 1)
  assert.ok(lire('projet-ondelete.html').includes('cap(\'c2\', "Deux autres demandes arrivent.", 2.8);'));   // Elisa, 25 octobre, comme au chapitre 9
});
