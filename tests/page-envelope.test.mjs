/* Enveloppes (layout « envelope ») des cartes « Mission accomplie » : invitations à l’événement éphémère (cours 4, cachet de
   la ville), invitations à l’avant-première (cours 59, look vip à cachet de cire, deux colonnes), enquête de satisfaction de
   juillet (cours 18, petites enveloppes sous la carte-questionnaire, Hugo sans email). Une enveloppe par ligne du résultat,
   dans l’ordre ; le contrôle des pages (tests/helpers/guide-checks.mjs) compare leurs valeurs au résultat de la mission. */
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv, checkGuideLesson} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html, ctx} = env;
const lessonOf = id => vm.runInContext(`MODULES.flatMap(m=>m.lessons).find(l=>l.id===${id})`, ctx);
const cardOf = id => { const b = lessonOf(id).studio.uses.body; return b.slice(b.lastIndexOf('<div class="ij-done is-locked"')); };
const count = (s, re) => (s.match(re) || []).length;

test('cours 4 : quatre enveloppes d’invitation, adressées dans leur fenêtre, cachet de Paris lu dans le résultat', () => {
  const c = cardOf(4);
  assert.doesNotThrow(() => checkGuideLesson(env, lessonOf(4)));
  assert.match(c, /<div class="ij-sms is-board is-page" style="--n:4;--sg:0\.5s" data-total="4" role="group"/);
  assert.ok(c.includes('<div class="pg-grid is-envelope">'), 'mise en page « enveloppes », look classique');
  assert.equal(count(c, /<div class="pg-card is-env" style="--t:/g), 4, 'une enveloppe par invité');
  assert.equal(count(c, /<i class="env-card" aria-hidden="true"><b>Invitation<\/b><\/i>/g), 4, 'la carte d’invitation (son titre) glisse dans chaque enveloppe');
  assert.equal(count(c, /<span class="env-post"><b class="db-x env-city" data-c="3" data-v="Paris">Paris<\/b><small aria-hidden="true">Envoyée<\/small><\/span>/g), 4, 'le cachet imprime la ville du résultat');
  assert.ok(c.includes('<small class="env-from" aria-hidden="true"><span>NutriBoost</span><span>Marketing</span></small>'), 'expéditeur sur deux lignes');
  assert.ok(c.includes('<span class="pg-main env-win"><span class="pg-who"><b class="db-x pg-name" data-c="0" data-v="Nathan">Nathan</b> <b class="db-x pg-name" data-c="1" data-v="Dupont">Dupont</b></span><span class="db-x pg-sub env-mail" data-c="2" data-v="nathan.dupont@mail.fr">nathan.dupont@mail.fr</span></span>'), 'nom et email dans la fenêtre');
  assert.ok(!c.includes('ij-sms-bubble') && !c.includes('ij-sms-list'), 'plus de bulle de message');
});

test('cours 59 : six enveloppes vip scellées à la cire, sur deux colonnes', () => {
  const c = cardOf(59);
  assert.doesNotThrow(() => checkGuideLesson(env, lessonOf(59)));
  assert.match(c, /<div class="ij-sms is-board is-page" style="--n:6;--sg:0\.4s" data-total="6" role="group"/);
  assert.ok(c.includes('<div class="pg-grid is-envelope is-vip is-2">'), 'look vip, deux colonnes');
  assert.equal(count(c, /<div class="pg-card is-env" style="--t:/g), 6);
  assert.equal(count(c, /<i class="env-wax" aria-hidden="true">✨<\/i>/g), 6, 'un cachet de cire par enveloppe');
  assert.equal(count(c, /<i class="env-card" aria-hidden="true"><b>Avant-première<\/b><\/i>/g), 6, 'la carte (son titre seul) dans chaque enveloppe');
  assert.ok(!c.includes('env-post') && !c.includes('env-postage'), 'ni timbre ni cachet de la poste');
  assert.ok(c.includes('<span class="pg-main env-win"><b class="db-x pg-name" data-c="0" data-v="Léa">Léa</b><span class="db-x pg-sub env-mail" data-c="1" data-v="lea@mail.fr">lea@mail.fr</span></span>'));
});

test('cours 18 : la carte-questionnaire, puis 14 petites enveloppes, une par commande ; celle de Hugo (email NULL) en alerte', () => {
  const c = cardOf(18);
  assert.doesNotThrow(() => checkGuideLesson(env, lessonOf(18)));
  assert.match(c, /<div class="ij-sms is-board is-page" style="--n:14;--sg:0\.18s" data-total="14" role="group"/);
  assert.ok(c.includes('<div class="pg-grid is-envelope is-mini">'), 'petites enveloppes');
  assert.equal(count(c, /<div class="pg-card is-env is-mini[ "]/g), 14, 'une enveloppe par commande');
  const hero = /<div class="env-hero" aria-hidden="true">[\s\S]*?<\/div><div class="pg-grid/.exec(c);
  assert.ok(hero && !hero[0].includes('data-c='), 'la carte-questionnaire, avant les enveloppes, ne porte aucune donnée');
  assert.equal(count(hero[0], /<i style="--i:\d">☆<\/i>/g), 5, 'cinq étoiles vides (personne n’a encore noté)');
  const warn = [...c.matchAll(/<div class="pg-card is-env is-mini is-warn"[^>]*>([\s\S]*?)<\/div>/g)];
  assert.equal(warn.length, 1, 'une seule enveloppe en alerte');
  assert.ok(warn[0][1].includes('data-v="Hugo"') && warn[0][1].includes('<em class="pg-stamp is-warn">sans email</em>') && warn[0][1].includes('<span class="db-x" data-c="1" data-v="NULL" hidden></span>'), 'Hugo : tampon « sans email », email NULL reporté');
  assert.ok(!warn[0][0].includes('title=') && !warn[0][1].includes('env-tick'), 'ni email en titre ni coche pour Hugo');
  assert.equal(count(c, /<i class="env-tick" aria-hidden="true">✓<\/i>/g), 13, 'une coche verte pour les 13 enquêtes prêtes');
  assert.equal(count(c, /<span class="db-x pg-sub" data-c="2" data-v="2026-07-02">2\u00a0juil\.<\/span>/g), 2, 'les deux commandes de Sophie du 2 juillet');
  assert.ok(c.includes('<div class="pg-card is-env is-mini" title="sophie@mail.fr" style="--t:'), 'l’email en titre de l’enveloppe');
});

test('CSS des enveloppes : état final de base (carte rangée, cachets et coches posés), états cachés avant la lecture, pied retardé', () => {
  for (const s of [
    '.pg-grid.is-envelope{grid-template-columns:minmax(0,1fr);gap:18px;padding-top:22px}',
    '.env-card{position:absolute;z-index:0;left:12%;right:12%;top:-14px;box-sizing:border-box;',
    '@keyframes pgEnvCard{from{transform:translateY(-4px)}}',
    'text-align:center;transform:translateY(16px)}',
    '.ij-sms.is-page:not(.is-play) .env-post,.ij-sms.is-page:not(.is-play) .env-wax,.ij-sms.is-page:not(.is-play) .env-tick{opacity:0}',
    '.ij-sms.is-page.is-play .env-card{animation:pgEnvCard .55s cubic-bezier(.4,0,.2,1) both calc(var(--t) + .2s)}',
    '.ij-sms.is-page.is-play .env-post{animation:pgStamp .42s cubic-bezier(.2,.8,.3,1.25) both calc(var(--t) + .6s)}',
    '.ij-sms.is-page.is-play .env-stars i{animation:pgTwinkle .4s ease calc(var(--to) + var(--i)*.08s)}',
    '.ij-sms.is-page:has(.pg-grid.is-envelope){--extra:.5s}', '.ij-sms.is-page:has(.pg-grid.is-vip){--extra:.8s}', '.ij-sms.is-page:has(.pg-body>.env-hero){--extra:.9s}',
    '.ij-sms.is-page:not(.is-play) .pg-grid .pg-card.is-env.is-mini.is-warn{outline-color:transparent;background:#FFF8EC}',
    'pgEnvShake .3s ease calc(var(--t) + .4s),pgWarnOn .3s ease both calc(var(--t) + .4s)}',
    '@media (max-width:360px){.pg-grid.is-envelope.is-2{grid-template-columns:minmax(0,1fr)}',
  ]) assert.ok(html.includes(s), s);
  assert.ok(!/\.ij-sms\.is-page:not\(\.is-play\)[^{]*\.env-card[^{]*\{/.test(html), 'la carte d’invitation n’est jamais cachée hors lecture : rangée dans l’enveloppe');
  assert.ok(!html.includes('.env-card small'), 'la carte se réduit à son titre : un onglet qui tient dans l’écart entre deux enveloppes');
  assert.ok(html.includes('.is-page .pg-grid .pg-card.is-env.is-mini.is-warn{border:1px solid #E9DCC3!important;outline:1.5px dashed #F59E0B;outline-offset:-1.5px}'), 'Hugo ne se distingue qu’à son tour : son liseré ambre est un outline (animable), pas la bordure !important du socle');
});
