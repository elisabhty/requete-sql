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

test('un message qui finit sur son propre merci (bye: null) : pas de « Merci ! » de plus ; sa photo vient en dernier, sans queue de bulle avant elle', () => {
  /* Elisa, 25 octobre, 19 h 13 : à la fin du chapitre 14, Léa Simon écrit « Merci pour votre réactivité et pour la protéine, c’est une attention qui fait plaisir ! ». */
  const body = ['J’ai bien reçu le colis !', 'Merci pour votre réactivité !'];
  assert.deepEqual([...S.smsParts(body, undefined, null)], ['Bonjour,', 'J’ai bien reçu le colis !', 'Merci pour votre réactivité !']);
  assert.deepEqual([...S.smsParts(body)], ['Bonjour,', 'J’ai bien reçu le colis !', 'Merci pour votre réactivité !', 'Merci !'], 'sans option : « Merci ! » à la fin');
  const h = S.smsCard(3, 'k-cl', 'Léa', 'Simon', 'LS', body, false, 0, undefined, {id: 'ph2', src: 'x.webp', alt: 'Le colis'}, null);
  assert.ok(!h.includes('>Merci !<') && h.includes('<p class="sms-m">Merci pour votre réactivité !</p><p class="sms-m sms-ph" id="ph2"><img src="x.webp" alt="Le colis"></p></div>'),
    'la dernière phrase, puis la photo, en dernier : la consigne « Touche la photo » ne cache aucune phrase');
  assert.ok(!h.includes('sms-m last'), 'pas de queue sur la bulle de texte suivie de la photo');
  /* Avec « Merci ! » (chapitre 13), la photo vient juste avant lui, qui garde la queue. */
  const h2 = S.smsCard(1, 'k-cl', 'Léa', 'Simon', 'LS', ['Mon shaker est arrivé cassé.'], false, 0, undefined, {id: 'ph1', src: 'y.webp', alt: 'Le shaker'});
  assert.ok(h2.includes('<p class="sms-m sms-ph" id="ph1"><img src="y.webp" alt="Le shaker"></p><p class="sms-m last">Merci !</p>'));
});
test('la première bulle : « Bonjour, » par défaut ; la page peut choisir la sienne (hello : « Bonjour ! »), la bannière montre toujours la première phrase', () => {
  assert.deepEqual(parts('Peux-tu venir ?'), ['Bonjour,', 'Peux-tu venir ?', 'Merci !']);
  assert.deepEqual(parts('Peux-tu venir ?', 'Bonjour !'), ['Bonjour !', 'Peux-tu venir ?', 'Merci !']);
  const h = S.smsCard(1, 'k-in', 'Le service client', 'NutriBoost', 'SC', 'Peux-tu venir ?', false, 0, 'Bonjour !');
  assert.ok(h.includes('<p class="sms-m">Bonjour !</p>') && !h.includes('Bonjour,'), 'la conversation s’ouvre sur « Bonjour ! »');
  assert.ok(h.slice(h.indexOf('sms-n'), h.indexOf('sms-v')).includes('<div class="sms-np">Peux-tu venir&nbsp;?</div>'.replace('&nbsp;', '\u00a0')), 'l’aperçu de la notification est la première phrase, pas « Bonjour ! »');
});

test('un message sans formule (hello: null) : la conversation commence par la première phrase, la bannière aussi, et tout se lit', () => {
  /* Elisa, 26 octobre, 10 h 52 (chapitre 18) : le second message de Camille commence directement, « Petit changement : … ». */
  const body = ['Petit changement : on remplace finalement la tisane par le magnésium.', 'Il faut recréer la vue ?'];
  assert.deepEqual([...S.smsParts(body, null, null)], body, 'ni « Bonjour, » ni « Merci ! »');
  assert.deepEqual([...S.smsParts(body, null)], [...body, 'Merci !'], 'sans formule, mais avec « Merci ! »');
  const h = S.smsCard(2, 'k-pr', 'Camille', 'Roux', 'CR', body, false, 1, null, undefined, null);
  assert.ok(h.startsWith('<div class="abs ml sms k-pr" id="ml2" data-hi="0">'), 'la carte le signale à smsIn() (data-hi="0") : toutes ses bulles comptent dans le temps de lecture');
  assert.ok(h.includes('<div class="sms-b"><div class="sms-t"><i></i><i></i><i></i></div><p class="sms-m">Petit changement : on remplace finalement la tisane par le magnésium.</p><p class="sms-m last">Il faut recréer la vue ?</p></div>'));
  assert.ok(h.slice(h.indexOf('sms-n'), h.indexOf('sms-v')).includes('<div class="sms-np">Petit changement\u00a0: on remplace'), 'l’aperçu de la notification : sa première phrase');
  assert.ok(!S.smsCard(1, 'k-pr', 'Camille', 'Roux', 'CR', body, false, 0, 'Salut !').includes('data-hi'), 'avec une formule, rien ne change');
});

test('une collègue sans nom de famille (Lina, chapitre 20) : son prénom seul, sans espace de trop', () => {
  /* Elisa, 26 octobre, 11 h 57 : « Message de Lina » ; son badge ne porte que son prénom. */
  const body = ['Je peux consulter les expéditions !', 'Le colis de Léa Simon est prêt.'];
  const h = S.smsCard(2, 'k-in', 'Lina', '', 'L', body, false, 0, null, undefined, null);
  assert.ok(h.includes('<b>Lina</b>') && h.includes('<div class="sms-who">Lina<i>›</i></div>'), 'la bannière et la conversation : « Lina »');
  assert.ok(!h.includes('Lina </') && !h.includes('Lina <i>'), 'pas d’espace après le prénom');
});

test('l’heure d’envoi : « 07:00 » à « 18:59 », la même pour un même expéditeur', () => {
  for (const n of ['Léa Simon', 'Nathan Dupont', 'Inès Lefebvre', 'Sophie Martin']) {
    const h = S.smsTime(n);
    assert.match(h, /^(0[7-9]|1[0-8]):[0-5]\d$/, `${n} : ${h}`);
    assert.equal(S.smsTime(n), h);
  }
  assert.notEqual(S.smsTime('Léa Simon'), S.smsTime('Nathan Dupont'), 'deux expéditeurs, deux heures');
});

test('deux SMS du même expéditeur (le service client, aux chapitres 11 et 12) : sept minutes d’écart, jamais la même heure', () => {
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
    'const end = first + (bubbles.length - 1) * step + 0.35;', 'const said = bubbles.slice(hi, merci ? -1 : undefined);',
    'const total = Math.ceil(readTime(said.map(b => b.textContent).join(\' \')) * 20) / 20;'])
    assert.ok(f.includes(part), `smsIn : ${part}`);
  assert.ok(core.includes('await document.fonts.ready;\n    smsFit();'), 'les bulles se resserrent sur leur ligne la plus longue, polices chargées, avant la timeline');
  assert.ok(index.includes("case 'sms':{"), 'le son de la notification existe dans le lecteur');
});

/* Elisa, 26 octobre, 13 h 39 (Réf 1) : « les messages défilent beaucoup trop vite, tout d’un coup ». Les bulles n’arrivent plus toutes en une
   seconde avant une longue pause : chaque bulle reste seule le temps de la lire, puis la suivante arrive. Le temps de lecture total ne change pas. */
function joue(textes, {hi = true, fast = false} = {}){
  const f = core.slice(core.indexOf('function smsIn('), core.indexOf('/* ---------- Habillage'));
  const holds = [], pops = [], bulles = textes.map(t => ({textContent: t}));
  const tl = {to(el, v, t){ if (bulles.includes(el)) pops.push([t, v.duration]); return this; }, set(){ return this; }};
  const c = vm.createContext({$: s => s === '#ml1' ? {dataset: hi ? {} : {hi: '0'}} : {}, $$: s => s.endsWith(' .sms-m') ? bulles : [], show(){}, cue(){}, gsap: {set(){}}, tl,
    hold: (t, d) => holds.push([t, d]), plain: h => h, readTime: h => h.length / 17});
  vm.runInContext(f + ';this.smsIn = smsIn;', c);
  const end = c.smsIn(1, 10, 11.6, fast);
  return {holds, pops, end, total: Math.ceil(textes.slice(hi ? 1 : 0, /^Merci/.test(textes[textes.length - 1]) ? -1 : undefined).join(' ').length / 17 * 20) / 20};
}
test('la lecture : chaque bulle reste seule le temps de la lire, puis la suivante arrive ; le temps total de lecture ne change pas', () => {
  const textes = ['Salut !', 'L’agence prépare la page de notre prochaine box.', 'Elle a besoin du nom, de la catégorie et du prix des produits sélectionnés.',
    'La sélection peut encore changer, donc évitons les exports à refaire.', 'Peux-tu préparer une vue dédiée ?'];
  const {holds, pops, end, total} = joue(textes);
  assert.equal(pops.length, 5, 'cinq bulles');
  assert.equal(holds.length, 4, 'une pause par phrase, aucune pour « Salut ! »');
  assert.ok(Math.abs(holds.reduce((s, h) => s + h[1], 0) - total) < 1e-9, `le temps de lecture total : ${total} s, comme avant`);
  for (let k = 0; k < 3; k++) {
    const [at, dur] = pops[k + 1], next = pops[k + 2][0];
    assert.ok(holds[k][0] >= at + dur - 1e-9 && holds[k][0] < next, `phrase ${k + 1} : la pause tombe après son apparition, avant la bulle suivante`);
  }
  assert.ok(Math.abs(holds[3][0] - (end + 0.05)) < 1e-9, 'la dernière phrase : sa pause après la toute dernière bulle');
  const parts = holds.map(h => h[1]), longueurs = textes.slice(1).map(t => t.length);
  assert.ok(parts[1] > parts[0] && parts[3] < parts[2], 'chaque bulle reçoit une part à sa longueur');
  assert.ok(Math.abs(parts[1] / parts[0] - longueurs[1] / longueurs[0]) < 0.05, 'proportionnelle à sa longueur');
  /* Sans formule, avec « Merci ! » ; et la version serrée : chaque bulle a fini d’apparaître avant la suivante */
  const sans = joue(['Petit changement : on remplace finalement la tisane par le magnésium.', 'Il faut recréer la vue ?', 'Merci !'], {hi: false});
  assert.equal(sans.holds.length, 2, 'les deux phrases, pas « Merci ! »');
  assert.ok(sans.holds[0][0] < sans.pops[1][0] && Math.abs(sans.holds[1][0] - (sans.end + 0.05)) < 1e-9, 'la dernière part après « Merci ! »');
  assert.ok(Math.abs(sans.holds.reduce((s, h) => s + h[1], 0) - sans.total) < 1e-9);
  const serre = joue(['Bonjour,', 'Je ne pourrai pas venir.', 'Pouvez-vous annuler ?'], {fast: true});
  assert.ok(serre.pops.every(([t, d], k) => k === serre.pops.length - 1 || t + d < serre.pops[k + 1][0]), 'version serrée : une bulle a fini d’apparaître avant la suivante');
});

/* ---------- Les chapitres ---------- */
const PAGES = R.pagesProjet();
const estSms = m => /^client/.test(m[2]) || !!(m[6] && m[6].sms);   // un client, ou le service client quand le message le dit
const AVEC_SMS = PAGES.filter(f => R.donnees(f).MAILS.some(estSms));
test('les chapitres où un SMS arrive : 1 et 2 (un client), 9 (le service client) ; le chapitre 12 n’a qu’un mail ; ceux à venir s’ajoutent seuls', () => {
  assert.deepEqual(['projet-cles.html', 'projet-delete.html', 'projet-normaliser.html'].filter(f => !AVEC_SMS.includes(f)), [], 'les trois chapitres déjà faits');
  assert.ok(!AVEC_SMS.includes('projet-ondelete.html'), 'le chapitre 12 : un seul message, un mail du service client (Elisa, 25 octobre, 12 h 51)');
  const clients = PAGES.filter(f => R.donnees(f).MAILS.some(m => /^client/.test(m[2])));
  /* Deux exceptions : au chapitre 13, Léa Simon écrit elle-même, avec la photo de son shaker cassé (trame d’Elisa, 25 octobre, 17 h 05) ; le service client écrit
     ensuite. Au chapitre 14, à la fin, elle écrit qu’elle a bien reçu son colis (Elisa, 25 octobre, 19 h 13). */
  assert.deepEqual(clients, ['projet-cles.html', 'projet-normaliser.html', 'projet-savepoint.html', 'projet-transaction.html'], 'un client écrit lui-même aux chapitres 1 et 2, et aux chapitres 13 et 14 (les trames d’Elisa) : depuis le chapitre 5, le service client centralise les demandes');
});
for (const f of AVEC_SMS) {
  test(`${f} : un SMS est rendu en SMS (smsCard, smsIn), celui d’un coach, de l’équipe ou du service client (sans option) reste un mail`, () => {
    const src = lire(f), M = R.donnees(f).MAILS;
    assert.ok(R.rendEnSms(src), 'smsCard pour un SMS, smsIn dans mailIn');
    assert.ok(/isSms\(tag, MAILS\[n\]\[6\]\) \? smsCard\(n \+ 1, k, /.test(src) && /function mailIn\(n, t, T\)\{\n  if \(isSms\(MAILS\[n - 1\]\[2\], MAILS\[n - 1\]\[6\]\)\) \{ if \(!APP\) fingerTap\(\$\('#ml' \+ n\), T\); return smsIn\(n, t, T/.test(src), 'même câblage dans chaque page');
    /* Une page qui a aussi un mail (coach, équipe, service client sans option) garde son code : avatar à enveloppe, adresse, signature.
       Le chapitre 10 (l’équipe logistique, le 30 octobre) et les chapitres 13 à 20 n’ont que des SMS (Léa Simon, puis le service client ; deux fois le service client ; la responsable commerciale ;
       l’équipe ateliers ; deux fois Camille, la responsable de la box ; l’équipe logistique ; Camille Roux, responsable des opérations, puis Lina,
       puis Camille Roux de nouveau) : ils n’embarquent pas le code du mail. */
    if (M.some(m => !estSms(m))) assert.ok(src.includes('<i class="mav">') && src.includes('Nouveau mail'), 'la carte de mail existe toujours');
    else assert.ok(!src.includes('Nouveau mail') && ['projet-merge.html', 'projet-procedures.html', 'projet-transaction.html', 'projet-savepoint.html', 'projet-trigger.html', 'projet-concurrence.html', 'projet-vue.html', 'projet-index.html', 'projet-droits.html'].includes(f), 'que des SMS : aux chapitres 10 et 13 à 20 seulement, sans le code du mail');
    /* L’app s’arrête sur la notification : « Touche le message… » pour un client, « Touche le mail… » sinon. */
    assert.ok(/msg = (?:\/\^client\/\.test\(MAILS\[n\]\[2\]\) \|\| \(MAILS\[n\]\[6\] \|\| \{\}\)\.sms|mailSms\(n\)) \? 'message' : 'mail'/.test(src) && src.includes('prompt: `Touche le ${msg} pour l’ouvrir.`') && src.includes('label: `Ouvrir le ${msg} '), 'consigne et étiquette du toucher');
  });
}
test('chapitre 1 : la conversation est compacte et serrée (elle tient sous le fichier, avant que la légende ne revienne)', () => {
  const src = lire('projet-normaliser.html');
  assert.ok(src.includes('smsCard(n + 1, k, w[1], w[2], w[4], body, true)') && src.includes('return smsIn(n, t, T, true);'), 'version compacte et cadence serrée');
});
test('chapitre 11 : le service client relaie les trois demandes : deux SMS (« Léa vient de nous prévenir… », « Nathan Dupont nous a demandé… »), puis le mail d’Hugo Laurent', () => {
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
test('chapitre 12 : le service client relaie la demande d’Inès Lefebvre par un mail (sa demande citée mot pour mot, puis ce qu’il demande à l’équipe), sans SMS', () => {
  const src = lire('projet-ondelete.html'), M = R.donnees('projet-ondelete.html').MAILS;
  assert.deepEqual(M.map(m => `${m[0][0]} ${m[0][1]} [${m[2]}]`), ['Le service client NutriBoost [équipe]'], 'un seul message, du service client');
  assert.ok(!estSms(M[0]) && !(M[0][6] && M[0][6].sms), 'un mail : ni l’option {sms: true}, ni un client qui écrit lui-même (le service client centralise les demandes depuis le chapitre 5)');
  /* Les mots d’Elisa (25 octobre, 12 h 51) : la demande de la cliente, entre guillemets, puis la demande à l’équipe. */
  assert.deepEqual(M[0][4], [
    'Inès Lefebvre nous a écrit :',
    '<i class="qt">Bonjour, je souhaite supprimer mon compte NutriBoost. Vous pouvez conserver mon avis, mais je ne souhaite plus que mon prénom apparaisse. Merci !</i>',
    'Peux-tu supprimer le compte d’Inès Lefebvre tout en conservant son avis sur la fiche produit ? Il devra apparaître sous la mention « Ancien client ».']);
  assert.equal(M[0][3], 'service.client@nutriboost.fr'); assert.equal(M[0][5], 'Le service client NutriBoost');
  assert.ok(src.includes('Elisa, 25 octobre') && src.includes('<i class="mav">') && src.includes('Nouveau mail'), 'la page garde la trace de la demande d’Elisa et la carte de mail');
  assert.ok(!/smsCard|smsIn/.test(src), 'la page n’embarque pas le code des SMS : elle n’en a aucun');
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
test('chapitre 11 : la légende annonce les SMS ; le chapitre 12, qui n’a qu’un mail, n’en annonce pas', () => {
  assert.ok(lire('projet-delete.html').includes('cap(\'c2\', "Trois autres demandes arrivent.", 2.8);'));   // Elisa, 25 octobre, 08 h 17 (Réf 1)
  assert.ok(!/autres demandes arrivent/.test(lire('projet-ondelete.html')), 'le chapitre 12 ne dit pas « demandes arrivent » : une carte-titre « Quelque temps plus tard… », puis le mail');
});
