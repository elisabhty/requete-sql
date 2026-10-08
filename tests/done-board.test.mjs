/* Carte « Mission accomplie » du cours « Renommer avec AS » : le Résultat est un dashboard (indicateur, graphique, tableau
   aux intitulés « Nom du produit » et « Prix (€) »), plus un envoi de message. Avant la lecture, des cases grises
   (chargement) ; puis les en-têtes, et chaque ligne avec sa barre pendant que l'indicateur compte les produits. */
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv, checkGuideLesson, openDb, decode} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html, ctx} = env;
const lesson = vm.runInContext('MODULES.flatMap(m=>m.lessons).find(l=>l.id===2)', ctx);
const body = lesson.studio.uses.body;
const card = body.slice(body.lastIndexOf('<div class="ij-done is-locked"'));

test('cours 2 : le Résultat de la mission est un dashboard, plus un message', () => {
  assert.match(card, /<div class="ij-sms is-board" style="--n:8;--sg:0\.26s" data-total="8"/, 'dashboard de 8 lignes');
  for (const old of ['ij-sms-bubble', 'ij-sms-list', 'ij-sms-plane', 'ij-sms-typing', 'Ajouté']) assert.ok(!card.includes(old), `plus de « ${old} » (animation d'envoi)`);
  assert.match(card, /<p class="ij-sms-h"><i aria-hidden="true">📊<\/i>Dashboard des produits<\/p>/, 'titre « Dashboard des produits »');
  assert.match(card, /<div class="db-tr is-head" role="row"><span class="db-x" role="columnheader">Nom du produit<\/span><span class="db-x is-num" role="columnheader">Prix \(€\)<\/span><\/div>/, 'en-têtes = les alias de la mission (le prix, chiffré, à droite)');
  assert.equal((card.match(/<div class="db-tr" role="row" style="--i:\d+">/g) || []).length, 8, 'les 8 produits');
  assert.match(card, /<small>Produits<\/small><b class="db-x" data-kpi="rows" data-count-to="8" data-ease="linear" data-delay="1\.1" data-dur="2\.08">8<\/b>/, 'indicateur : 8 produits, compté au rythme des lignes');
  assert.match(card, /<small>Prix \(€\) par produit<\/small>/, 'le graphique porte l’alias « Prix (€) »');
  assert.match(card, /<i style="--i:1\.00;--v:1\.000"><\/i>/, 'Collagène Marin (39.9) : la plus haute barre');
  assert.match(card, /<p class="ij-sms-done">✓ Dashboard à jour<\/p>/);
});

test('la vérification des dashboards refuse un tableau qui ne suit pas le résultat de la mission', () => {
  const swap = s => s.replace('Collagène Marin', 'Magnésium X');
  const bad = Object.assign({}, lesson, {studio: Object.assign({}, lesson.studio, {uses: Object.assign({}, lesson.studio.uses, {body: swap(body)})})});
  assert.throws(() => checkGuideLesson(env, bad), /lignes du dashboard sont celles du résultat/);
  const badHead = Object.assign({}, lesson, {studio: Object.assign({}, lesson.studio, {uses: Object.assign({}, lesson.studio.uses, {body: body.replace('role="columnheader">Prix (€)', 'role="columnheader">Prix')})})});
  assert.throws(() => checkGuideLesson(env, badHead), /en-têtes du dashboard sont les colonnes du résultat/);
});

test('animation du dashboard : chargement gris avant la lecture, état final = style de base, pied après la dernière ligne', () => {
  assert.ok(html.includes('.ij-sms.is-board:not(.is-play) .db-x{color:transparent}'), 'textes masqués avant la lecture');
  assert.ok(!/\n  \.db-x\{/.test(html) && html.includes('.is-board .db-x{position:relative;'), 'styles cloisonnés au dashboard (la classe db-x sert aussi au « × » des bases de la console)');
  assert.ok(html.includes('.ij-sms.is-board:not(.is-play) .db-x::after{opacity:1;animation:dbShim'), 'cases grises qui scintillent');
  assert.ok(/\.db-x::after\{[^}]*opacity:0;/.test(html), 'sans lecture (mouvement réduit), les cases grises disparaissent');
  assert.ok(html.includes('.db-tr{--t:calc(var(--t0,.15s) + .95s + var(--i,0)*var(--sg,.26s))'), 'une ligne après l’autre');
  assert.ok(html.includes('.ij-sms.is-board.is-play .db-chart i{animation:dbGrow .5s cubic-bezier(.3,.9,.3,1.15) both calc(var(--t0) + .95s + var(--i)*var(--sg,.26s))}'), 'chaque barre pousse avec sa ligne');
  assert.ok(html.includes('.ij-sms.is-board.is-play .ij-sms-done{animation:smsPop .45s cubic-bezier(.2,.8,.3,1.2) both calc(var(--t0) + .95s + var(--n,8)*var(--sg,.26s) + .45s + var(--extra,0s))}'), 'pied « à jour » après la dernière ligne (il déclenche la fin et le bouton Rejouer)');
});

test('compteur des missions : data-ease="linear" suit un rythme régulier', () => {
  const src = html.slice(html.indexOf('function actCountUp('), html.indexOf('function qfSettleHeight('));
  assert.ok(src.includes("const lin=b.dataset.ease==='linear';"));
  assert.ok(src.includes('e=lin?p:1-Math.pow(1-p,3)'));
});

test('cours 6 (AND et OR) : le Résultat est une planche de billets d’invitation, talon par agence et tampon « Envoyé »', () => {
  const l6 = vm.runInContext('MODULES.flatMap(m=>m.lessons).find(l=>l.id===6)', ctx);
  const b6 = l6.studio.uses.body, c6 = b6.slice(b6.lastIndexOf('<div class="ij-done is-locked"'));
  assert.ok(c6.includes('<div class="pg-grid is-tickets">'), 'mise en page « billets »');
  assert.equal((c6.match(/<div class="pg-card is-ticket"/g) || []).length, 4, 'un billet par invité');
  assert.equal((c6.match(/<span class="pg-stub is-alt">/g) || []).length, 1, 'un seul talon Lyon (autre couleur)');
  assert.equal((c6.match(/<em class="pg-stamp">Envoyé<\/em>/g) || []).length, 4, 'un tampon par billet');
  assert.ok(c6.includes('<span class="pg-who"><b class="db-x pg-name" data-c="0" data-v="Sophie">Sophie</b> <b class="db-x pg-name" data-c="1" data-v="Martin">Martin</b></span>'), 'prénom et nom sur la même ligne');
  assert.ok(!c6.includes('ij-sms-bubble') && !c6.includes('ij-sms-list'), 'plus de bulle de message');
  assert.ok(html.includes('@keyframes pgStamp{'), 'le tampon s’abat');
  const qrs = [...c6.matchAll(/<span class="pg-qr"><svg viewBox="-1 -1 23 23" shape-rendering="crispEdges" aria-hidden="true"><path d="([^"]+)"\/><\/svg><\/span>/g)].map(m => m[1]);
  assert.equal(qrs.length, 4, 'un QR code par billet, sur le talon');
  assert.equal(new Set(qrs).size, 4, 'chaque billet a son propre QR code');
  assert.ok(qrs.every(d => d.startsWith('M0 0h7v1h-7z')), 'repère d’angle en haut à gauche, comme un vrai QR code');
});

/* Objets à thème (guidePage) : la structure de chaque mise en page, sur le modèle des billets du cours 6. Le protocole des
   pages reste celui du contrôle (tests/helpers/guide-checks.mjs) : une carte pg-card par ligne du résultat, dans l'ordre (cartes
   empilées comprises), chacune avec toutes les colonnes de sa ligne (data-c, data-v). */
const themed = [1, 4, 5, 22, 7, 8, 9, 53, 21, 18, 42, 45, 55, 59, 80, 78, 57, 35];
const lessonOf = id => vm.runInContext(`MODULES.flatMap(m=>m.lessons).find(l=>l.id===${id})`, ctx);
const doneOf = id => { const b = lessonOf(id).studio.uses.body; return b.slice(b.lastIndexOf('<div class="ij-done is-locked"')); };
const count = (s, re) => (s.match(re) || []).length;
const withBody = (l, b) => Object.assign({}, l, {studio: Object.assign({}, l.studio, {uses: Object.assign({}, l.studio.uses, {body: b})})});
/* Résultat réel de la requête de la mission (la dernière du cours). */
const missionOf = id => {
  const b = lessonOf(id).studio.uses.body, last = b.slice(b.lastIndexOf('<div class="fn-use">'));
  const db = openDb(env); try { return db.exec(decode(/data-run-sql="([^"]*)"/.exec(last)[1]))[0]; } finally { db.close(); }
};
const vOf = (c, j) => [...c.matchAll(new RegExp(`data-c="${j}" data-v="([^"]*)"`, 'g'))].map(m => decode(m[1]));

test('objets à thème : plus aucun envoi générique (guideSms et sa bulle retirés), le cadre commun reste', () => {
  assert.ok(!html.includes('function guideSms(') && !html.includes('guideSms('), 'guideSms n’a plus d’appelant : retiré');
  assert.ok(!/\n\s+sms:\{/.test(html), 'aucune carte « Mission accomplie » ne garde un envoi sms:{…}');
  for (const old of ['ij-sms-bubble', 'ij-sms-typing', 'ij-sms-list', 'ij-sms-plane', 'ij-sms-meter', 'smsPlane', 'smsBubble']) assert.ok(!html.includes(old), `CSS morte retirée : ${old}`);
  for (const keep of ['  .ij-sms{', '#scr-lesson .ij-sms-h{', '#scr-lesson .ij-sms-done{', '@keyframes smsPop{']) assert.ok(html.includes(keep), `cadre commun gardé : ${keep}`);
  assert.ok(html.includes('@media (prefers-reduced-motion:reduce){.ij-sms,.ij-sms *,.ij-sms *::before,.ij-sms *::after{animation:none!important}#scr-lesson .ij-sms-done{opacity:1!important}}'), 'mouvement réduit : ::before compris, pied visible');
  for (const id of themed) {
    const c = doneOf(id);
    assert.match(c, /<div class="ij-sms is-board is-page" style="--n:\d+;--sg:[\d.]+s" data-total="\d+"/, `cours ${id} : la racine de page que lit le contrôle`);
    assert.ok(!c.includes('ij-sms-bubble') && !c.includes('ij-sms-list'), `cours ${id} : plus de bulle de message`);
    assert.doesNotThrow(() => checkGuideLesson(env, lessonOf(id)), `cours ${id}`);
  }
});

test('cours 22 (coupons) : 7 bons, 3 empilés, une pile « … et 3 autres bons », une pastille « 30 ans pile »', () => {
  const c = doneOf(22);
  assert.equal(count(c, /<div class="pg-card is-coupon[ "]/g), 7);
  assert.equal(count(c, /<div class="pg-card [^"]*\bis-stacked\b/g), 3);
  assert.equal(count(c, /<div class="pg-more"/g), 1);
  assert.equal(count(c, /<em class="pg-flag">/g), 1);
});

test('cours 18 (enveloppes mini) : 14 enveloppes, une par commande ; Hugo, sans email, en alerte avec data-v="NULL"', () => {
  const c = doneOf(18);
  assert.equal(count(c, /<div class="pg-card [^"]*\bis-mini\b/g), 14);
  const warn = c.split('<div class="pg-card').slice(1).filter(x => /^ [^"]*\bis-warn\b/.test(x));
  assert.equal(warn.length, 1, 'une seule enveloppe en alerte');
  assert.ok(warn[0].includes('data-c="0" data-v="Hugo"') && warn[0].includes('data-c="1" data-v="NULL"'), 'celle de Hugo, email NULL');
});

test('cours 21 (couloirs) : 3 têtes (Jeune, Adulte, Senior), les cartes dans l’ordre du résultat', () => {
  const c = doneOf(21), res = missionOf(21);
  assert.equal(count(c, /<div class="ln-head/g), 3);
  assert.deepEqual([...c.matchAll(/<small class="ln-tag">([^<]*)<\/small>/g)].map(m => m[1]), ['Jeune', 'Adulte', 'Senior']);
  for (let j = 0; j < res.columns.length; j++) assert.deepEqual(vOf(c, j), res.values.map(r => String(r[j])), `colonne ${res.columns[j]} dans l’ordre du résultat (le CSS range, le DOM garde l’ordre)`);
});

test('cours 53 (calendrier) : 16 cartes, deux posées en second sur un jour déjà pris (--k:1)', () => {
  const c = doneOf(53);
  assert.equal(count(c, /<div class="pg-card is-cal"/g), 16);
  assert.equal(count(c, /<div class="pg-card is-cal"[^>]*;--k:1;/g), 2);
});

test('cours 57 (recherche) : une seule fiche, la ligne du plan (is-plan)', () => {
  assert.equal(count(doneOf(57), /<div class="pg-card is-plan"/g), 1);
});

test('cours 42 (billets duo) : 7 billets dont 3 empilés', () => {
  const c = doneOf(42);
  assert.equal(count(c, /<div class="pg-card is-ticket[ "]/g), 7);
  assert.equal(count(c, /<div class="pg-card [^"]*\bis-stacked\b/g), 3);
});

test('contrôle des pages : deux valeurs échangées entre deux cartes (ou une valeur changée) sont refusées, sur chaque objet à thème', () => {
  for (const id of themed) {
    const l = lessonOf(id), body = l.studio.uses.body, at = body.lastIndexOf('<div class="ij-done is-locked"');
    const parts = body.slice(at).split('<div class="pg-card');
    const cards = parts.slice(1);
    let bad = null, k = 0;
    /* Première colonne dont deux cartes diffèrent : on échange leurs valeurs. */
    for (let j = 0; !bad && j < 12; j++) {
      const v = cards.map(cd => (new RegExp(`data-c="${j}" data-v="([^"]*)"`).exec(cd) || [])[1]);
      const a = v.findIndex(x => x !== undefined), b = v.findIndex(x => x !== undefined && x !== v[a]);
      if (a < 0) continue;
      const tag = x => `data-c="${j}" data-v="${x}"`;
      const cs = cards.slice();
      if (b < 0) { if (cards.length > 1) continue; cs[a] = cs[a].split(tag(v[a])).join(tag(v[a] + 'x')); }
      else { cs[a] = cs[a].split(tag(v[a])).join(tag(v[b])); cs[b] = cs[b].split(tag(v[b])).join(tag(v[a])); }
      bad = body.slice(0, at) + [parts[0], ...cs].join('<div class="pg-card'); k = a + 1;
    }
    assert.ok(bad, `cours ${id} : une valeur à échanger`);
    assert.throws(() => checkGuideLesson(env, withBody(l, bad)), new RegExp(`la carte ${k} montre toutes les colonnes`), `cours ${id}`);
  }
});

test('parcours : les noms cités suivent les cartes, contrôle repris des anciens envois (le désordre est refusé)', () => {
  for (const id of [4, 5, 7, 8, 9, 22, 45, 55, 59, 80, 35]) {
    const l = lessonOf(id), body = l.studio.uses.body;
    const m = /(is-out"><b>\d+<\/b><span>[^<]*<small>)([^<]*)(<\/small>)/.exec(body.slice(body.lastIndexOf('<div class="ij-done is-locked"')));
    const names = m[2].replace(/ et /g, ', ').split(', ');
    assert.equal(names.length, +/data-total="(\d+)"/.exec(body.slice(body.lastIndexOf('<div class="ij-done is-locked"')))[1], `cours ${id} : un nom par carte`);
    const moved = names.length > 1 ? [...names.slice(1), names[0]] : ['Personne'];
    const txt = moved.length > 1 ? moved.slice(0, -1).join(', ') + ' et ' + moved.at(-1) : moved[0];
    const bad = body.slice(0, body.lastIndexOf(m[0])) + m[1] + txt + m[3] + body.slice(body.lastIndexOf(m[0]) + m[0].length);
    assert.throws(() => checkGuideLesson(env, withBody(l, bad)), /le parcours cite les personnes des cartes/, `cours ${id}`);
  }
});
