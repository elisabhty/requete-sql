/* Socle des objets à thème (guidePage) : étapes, report automatique des colonnes, pile (show / tail / keep), alertes
   (warn, flag, tag), tampon final (seal), noms reliés (sep, alias, subTxt). Configurations d'essai : aucun cours n'est
   converti ici. Puis deux contrôles négatifs sur le cours 6 (billets), dont le rendu ne change pas. */
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv, checkGuideLesson, decode} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html, ctx} = env;
const page = m => vm.runInContext(`guidePage(${JSON.stringify(m)})`, ctx);
/* Colonnes portées par chaque carte, lues comme le contrôle des pages (tests/helpers/guide-checks.mjs). */
const cardsOf = h => h.split('<div class="pg-card').slice(1).map(cd => { const a = []; for (const m of cd.matchAll(/data-c="(\d+)" data-v="([^"]*)"/g)) a[+m[1]] = decode(m[2]); return a; });
const ROOT = /^<div class="ij-sms is-board is-page" style="--n:(\d+);--sg:[\d.]+s" data-total="(\d+)" role="group" aria-label="[^"]*">/;
const T = s => `--t:calc(var(--t0,.15s) + .95s + ${s}*var(--sg,.28s))`;
const seven = [['Lucas', 'Bernard', 'Lyon', 28], ['Emma', 'Dubois', 'Marseille', 45], ['Chloé', 'Moreau', 'Bordeaux', 26], ['Hugo', 'Laurent', 'Lyon', 52], ['Gabriel', 'Michel', 'Toulouse', 29], ['Inès', 'Lefebvre', 'Nantes', 41], ['Nathan', 'Dupont', 'Paris', 30]];

test('pile show / tail : 3 cartes montrées, 3 empilées, la dernière en vue ; une seule étape pour toute la pile', () => {
  const h = page({h: 'Bons', chrome: false, layout: 'tickets', name: [0, 1], sub: [{col: 2}, {col: 3, tpl: '{v} ans'}], stamp: 'Envoyé', show: 3, tail: 1, more: '… et {n} autres bons', rows: seven, done: '✓ 7 offres envoyées'});
  const r = ROOT.exec(h);
  assert.ok(r, 'racine inchangée, reconnue par le contrôle des pages');
  assert.equal(+r[1], 5, '--n = 3 cartes montrées + 1 pile + 1 dernière');
  assert.equal(+r[2], 7, 'data-total = nombre de lignes');
  assert.ok(h.includes('<div class="pg-grid is-tickets has-pile">'));
  assert.deepEqual(cardsOf(h), seven.map(x => x.map(String)), 'les 7 cartes restent dans le DOM, dans l’ordre du résultat, avec toutes leurs colonnes');
  const st = [...h.matchAll(/<div class="pg-card is-ticket is-stacked" style="(--t:[^;]+);--k:(\d)" aria-hidden="true">/g)];
  assert.deepEqual(st.map(m => +m[2]), [0, 1, 2], 'Hugo, Gabriel et Inès empilés (--k = rang dans la pile)');
  assert.ok(st.every(m => m[1] === T(3)), 'la pile partage une étape');
  assert.ok(h.includes(`<div class="pg-card is-ticket is-tail" style="${T(4)}">`), 'la dernière ligne vient après la pile');
  assert.ok(h.includes(`<div class="pg-more" style="${T(3)}">… et 3 autres bons</div></div>`), 'libellé de la pile, à son étape, en fin de grille');
  assert.ok(!/<div class="pg-more"[^>]*data-c=|class="pg-cards/.test(h), 'le libellé ne porte pas de donnée');
});

test('pile keep : les lignes gardées restent en vue (ordre du résultat) ; is-deep dès la 4e carte empilée ; une seule ligne à empiler reste montrée', () => {
  const rows = Array.from({length: 9}, (_, i) => [`P${i}`, i]);
  const h = page({h: 'X', chrome: false, layout: 'tickets', name: 0, show: 2, keep: [3, 5], rows, done: '✓'});
  assert.equal(+ROOT.exec(h)[1], 5, '4 cartes en vue + 1 pile');
  const cards = [...h.matchAll(/<div class="pg-card([^"]*)" style="--t:calc\(var\(--t0,\.15s\) \+ \.95s \+ (\d+)\*var/g)].map(m => [m[1].trim(), +m[2]]);
  assert.deepEqual(cards, [['is-ticket', 0], ['is-ticket', 1], ['is-ticket is-stacked', 4], ['is-ticket', 2], ['is-ticket is-stacked', 4], ['is-ticket', 3], ['is-ticket is-stacked', 4], ['is-ticket is-stacked is-deep', 4], ['is-ticket is-stacked is-deep', 4]]);
  assert.ok(h.includes('>… et 5 autres</div>'), 'libellé par défaut');
  const one = page({h: 'X', chrome: false, layout: 'tickets', name: 0, show: 6, rows: seven, done: '✓'});
  assert.ok(!one.includes('is-stacked') && !one.includes('has-pile') && +ROOT.exec(one)[1] === 7, 'une seule ligne à empiler : elle reste montrée');
});

test('report automatique et affichage : data-v reste brut, les colonnes non montrées sont reportées, cachées ; alerte warn', () => {
  const rows = [['Sophie', null, '2026-07-02', 12.5], ['Hugo', 'hugo@mail.fr', '2026-08-01', 3]];
  const h = page({h: 'X', chrome: false, layout: 'list', name: 0, sub: [{col: 1, nul: 'sans email', mono: true}, {col: 2, fmt: 'short'}], warn: {col: 1, val: null, txt: 'sans email'}, rows, done: '✓'});
  assert.deepEqual(cardsOf(h), [['Sophie', 'NULL', '2026-07-02', '12.5'], ['Hugo', 'hugo@mail.fr', '2026-08-01', '3']]);
  assert.ok(h.includes('<span class="db-x pg-sub is-mono" data-c="1" data-v="NULL">sans email</span>'), 'nul : texte affiché, valeur brute NULL');
  assert.ok(h.includes('<span class="db-x pg-sub" data-c="2" data-v="2026-07-02">2 juil.</span>'), 'date courte');
  assert.ok(h.includes('data-v="2026-08-01">1er août</span>'), 'le 1er du mois');
  assert.ok(h.includes('<span class="db-x" data-c="3" data-v="12.5" hidden></span></div>'), 'colonne non montrée : reportée, cachée, en fin de carte');
  assert.ok(h.includes('<div class="pg-card is-warn" style="'), 'carte en alerte');
  assert.equal((h.match(/<em class="pg-stamp is-warn">sans email<\/em>/g) || []).length, 1, 'tampon d’alerte sur la seule ligne concernée');
  const long = page({h: 'X', chrome: false, layout: 'list', name: 0, sub: [{col: 1, fmt: 'long'}, {col: 2, map: {en_preparation: 'en préparation'}}], rows: [['A', '2026-07-30', 'en_preparation']], done: '✓'});
  assert.ok(long.includes('data-v="2026-07-30">30 juillet 2026</span>') && long.includes('data-v="en_preparation">en préparation</span>'), 'date longue, valeur traduite (map)');
});

test('noms reliés (sep), alias, ligne fixe (subTxt), pastilles (flag, tag), tampon final (seal), décalage (delay), ton et look', () => {
  const rows = [['Sophie', 'Nathan', 'Paris', 30], ['Nathan', 'Nathan', 'Paris', 31]];
  const h = page({h: 'X', chrome: false, layout: 'tickets', name: [0, 1], sep: ' & ', alias: {'0:1': 'Nathan P.', '1:0': 'Nathan P.', '1:1': 'Nathan D.'}, subTxt: 'Entrée pour 2', stamp: 'Envoyé', flag: {col: 3, val: 30, txt: '30 ans pile'}, tag: {1: 'par défaut'}, seal: 'Transmise', delay: 0.5, tone: 'green', look: 'duo', rows, done: '✓'});
  assert.ok(h.includes('<b class="db-x pg-name" data-c="0" data-v="Nathan">Nathan P.</b><i class="pg-sep"> &amp; </i><b class="db-x pg-name" data-c="1" data-v="Nathan">Nathan D.</b>'), 'deux noms reliés, alias affichés, valeurs brutes');
  assert.ok(h.includes('<span class="pg-foot"><small class="pg-subs">Entrée pour 2</small><em class="pg-stamp">Envoyé</em></span>'));
  assert.equal((h.match(/<em class="pg-flag">30 ans pile<\/em>/g) || []).length, 1, 'flag : la ligne qui a la valeur');
  assert.equal((h.match(/<em class="pg-flag">par défaut<\/em>/g) || []).length, 1, 'tag : la ligne désignée');
  assert.ok(h.includes('</div><em class="pg-seal" aria-hidden="true">Transmise</em></div></div><p class="ij-sms-done">'), 'tampon final après la grille');
  assert.ok(h.includes('style="--t:calc(var(--t0,.15s) + 1.45s + 0*var(--sg,.28s))"'), 'delay décale toutes les cartes');
  assert.ok(h.includes('<div class="pg-grid is-tickets is-duo" data-tone="green">'));
  assert.deepEqual(cardsOf(h), rows.map(x => x.map(String)), 'ville et âge, non montrés, reportés');
});

test('CSS du socle : état final de base, états cachés seulement avant la lecture, mouvement réduit (::before compris)', () => {
  for (const s of [
    '@media (prefers-reduced-motion:reduce){.ij-sms,.ij-sms *,.ij-sms *::before,.ij-sms *::after{animation:none!important}',
    '.ij-sms.is-page:has(.pg-seal){--extra:.7s}',
    '.ij-sms.is-page.is-play .pg-grid .pg-card.is-stacked{animation:pgPile .3s ease both calc(var(--t) + var(--k)*.06s)}',
    '.ij-sms.is-page.is-play .pg-more{animation:smsPop .35s cubic-bezier(.2,.8,.3,1.25) both calc(var(--t) + .3s)}',
    '.ij-sms.is-page.is-play .pg-flag{animation:smsPop .35s cubic-bezier(.2,.8,.3,1.25) both calc(var(--t) + .35s)}',
    '.ij-sms.is-page.is-play .pg-seal{animation:pgStamp .5s cubic-bezier(.2,.8,.3,1.25) both var(--to)}',
    '.pg-grid.has-pile>.is-stacked{order:1}', '.pg-grid.has-pile>.pg-more{order:2}', '.pg-grid.has-pile>.is-tail{order:3}',
  ]) assert.ok(html.includes(s), s);
  assert.ok(!/\.ij-sms\.is-page:not\(\.is-play\)[^{]*\.is-stacked/.test(html), 'la pile reste visible sans lecture');
});

test('contrôle des pages (cours 6) : une valeur changée sur une carte, ou des noms du parcours dans le désordre, sont refusés', () => {
  const l6 = vm.runInContext('MODULES.flatMap(m=>m.lessons).find(l=>l.id===6)', ctx);
  const body = l6.studio.uses.body;
  const withBody = b => Object.assign({}, l6, {studio: Object.assign({}, l6.studio, {uses: Object.assign({}, l6.studio.uses, {body: b})})});
  assert.doesNotThrow(() => checkGuideLesson(env, l6));
  assert.equal(body.split('data-c="3" data-v="52"').length, 2);
  assert.throws(() => checkGuideLesson(env, withBody(body.replace('data-c="3" data-v="52"', 'data-c="3" data-v="25"'))), /la carte 3 montre toutes les colonnes/);
  const who = '<small>Sophie Martin, Nathan Petit, Hugo Laurent et Léa Simon</small>';
  assert.equal(body.split(who).length, 2);
  assert.throws(() => checkGuideLesson(env, withBody(body.replace(who, '<small>Nathan Petit, Sophie Martin, Hugo Laurent et Léa Simon</small>'))), /le parcours cite les personnes des cartes/);
});
