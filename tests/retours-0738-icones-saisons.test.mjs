/* 16 novembre, 7 h 38 (Elisa : « 1 essai chacun et pareil pour le chat dans plusieurs thèmes » ; « Il manque un bouton noter
   l’application vers Apple Store dans compte »).
   - Six icônes de saison (Noël, Nouvel An, Saint-Valentin, Pâques, Été, Halloween), faites avec ElevenLabs (Nano Banana 2) à partir
     de l’icône de l’app, recadrées en 1024 × 1024 sans transparence : rangées dans resources/ios/icones (dans l’app à son prochain
     envoi), proposées dans Mon compte (Sur ton iPhone) quand l’app les a.
   - Requête dans les mêmes six tenues (assets/saisons) : le chat du widget de la série suit la saison.
   - « Noter l’application » revient dans Mon compte (Compte et assistance). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), en = lire('langue-en.js');
const cut = (debut, fin) => { const i = app.indexOf(debut); assert.ok(i >= 0, debut); const j = app.indexOf(fin, i + debut.length); assert.ok(j > i, fin); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';
const SAISONS = ['noel', 'nouvel-an', 'saint-valentin', 'paques', 'ete', 'halloween'];
const NOMS = ['IconeNoel', 'IconeNouvelAn', 'IconeSaintValentin', 'IconePaques', 'IconeEte', 'IconeHalloween'];
/* Largeur, hauteur et type de couleur d’un PNG (l’en-tête IHDR) */
const png = f => { const b = fs.readFileSync(f); assert.equal(b.toString('latin1', 1, 4), 'PNG', f); return {l: b.readUInt32BE(16), h: b.readUInt32BE(20), couleur: b[25]}; };

test('les six icônes de saison : un jeu d’icônes par saison, 1024 × 1024, sans transparence (App Store)', () => {
  for (const n of NOMS) {
    const d = path.join(ROOT, 'resources/ios/icones', n + '.appiconset');
    const c = JSON.parse(fs.readFileSync(path.join(d, 'Contents.json'), 'utf8'));
    assert.deepEqual(c.images, [{filename: `${n}-1024.png`, idiom: 'universal', platform: 'ios', size: '1024x1024'}], n);
    const i = png(path.join(d, `${n}-1024.png`));
    assert.equal(i.l, 1024); assert.equal(i.h, 1024);
    assert.equal(i.couleur, 2, n + ' : RVB, sans couche alpha');
  }
  for (const s of ['base', ...SAISONS]) { const i = png(path.join(ROOT, 'assets/icones', s + '.png')); assert.equal(i.l, 180, s); }
});

test('Requête en tenue de saison : six images légères pour le widget', () => {
  for (const s of SAISONS) {
    const b = fs.readFileSync(path.join(ROOT, 'assets/saisons', `chat-${s}.webp`));
    assert.equal(b.toString('latin1', 0, 4) + b.toString('latin1', 8, 12), 'RIFFWEBP', s);
    assert.ok(b.length < 90000, `${s} : ${b.length} octets`);
  }
});

test('la saison du jour : Noël, Nouvel An, Saint-Valentin, la semaine de Pâques, l’été, Halloween, sinon rien', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fn('paquesDe') + fn('saisonDu'), ctx);
  const s = (a, m, j) => ctx.saisonDu(new Date(a, m - 1, j));
  /* Pâques : 5 avril 2026, 28 mars 2027, 16 avril 2028 */
  for (const [a, m, j] of [[2026, 4, 5], [2027, 3, 28], [2028, 4, 16]]) {
    const p = ctx.paquesDe(a); assert.deepEqual([p.getFullYear(), p.getMonth() + 1, p.getDate()], [a, m, j]);
  }
  const cas = [[2026, 11, 16, ''], [2026, 11, 30, ''], [2026, 12, 1, 'noel'], [2026, 12, 26, 'noel'], [2026, 12, 27, 'nouvel-an'], [2027, 1, 3, 'nouvel-an'],
    [2027, 1, 4, ''], [2027, 2, 6, ''], [2027, 2, 7, 'saint-valentin'], [2027, 2, 14, 'saint-valentin'], [2027, 2, 15, ''], [2027, 3, 20, ''],
    [2027, 3, 21, 'paques'], [2027, 3, 29, 'paques'], [2027, 3, 30, ''], [2027, 6, 30, ''], [2027, 7, 1, 'ete'], [2027, 8, 31, 'ete'], [2027, 9, 1, ''],
    [2027, 10, 19, ''], [2027, 10, 20, 'halloween'], [2027, 10, 31, 'halloween'], [2027, 11, 1, '']];
  for (const [a, m, j, v] of cas) assert.equal(s(a, m, j), v, `${j}/${m}/${a}`);
});

test('le widget reçoit le chat de la saison une fois par saison ; une version de l’app d’avant ne garde rien', async () => {
  const src = fn('paquesDe') + fn('saisonDu') + cut('const WIDGET_SAISON_K=', '\nasync function widgetSaisonMaj(') + '\nasync ' + fn('widgetSaisonMaj');
  const essai = (reponse, date) => {
    const appels = [], stock = {};
    const ctx = vm.createContext({appels, ilePont: () => ({}), Date: class extends Date { constructor(...a) { super(...(a.length ? a : [date])); } },
      localStorage: {getItem: k => stock[k] ?? null, setItem: (k, v) => { stock[k] = v; }},
      widgetImagesEnvoyer: async (liste, o) => { appels.push([liste, o]); return reponse; }});
    vm.runInContext(src, ctx);
    return {appels, stock, ctx};
  };
  let e = essai({ok: true, images: ['Mascotte']}, '2026-12-10T10:00:00');
  await e.ctx.widgetSaisonMaj(); await e.ctx.widgetSaisonMaj();
  assert.deepEqual(JSON.parse(JSON.stringify(e.appels)), [[[{nom: 'Mascotte', url: 'assets/saisons/chat-noel.webp'}], {tout: true}]], 'une seule fois');
  assert.equal(e.stock['rq-widget-saison'], 'noel');
  e = essai({ok: true, images: []}, '2027-01-10T10:00:00'); e.stock['rq-widget-saison'] = 'nouvel-an';
  await e.ctx.widgetSaisonMaj();
  assert.deepEqual(JSON.parse(JSON.stringify(e.appels)), [[[], {tout: true}]], 'hors saison : l’image d’origine revient');
  assert.equal(e.stock['rq-widget-saison'], 'aucune');
  e = essai(null, '2026-12-10T10:00:00');
  await e.ctx.widgetSaisonMaj();
  assert.equal(e.stock['rq-widget-saison'], undefined, 'pas de pont : retenté plus tard');
  assert.ok(fn('widgetMaj').includes('widgetSaisonMaj();'), 'à chaque envoi du widget');
});

test('Mon compte : l’icône de l’app au choix, cachée pour l’instant ; montrée, seulement si l’app a les icônes, et d’un geste', async () => {
  const brut = cut('const ICONES=', '\nfunction langueLigneHTML(');
  /* 16 novembre, 8 h 04 (Elisa : « Non, ne mets pas le bouton icône de l’app maintenant ») : la ligne est cachée */
  assert.ok(brut.includes('const ICONES_PROPOSEES=false;'), 'cachée pour l’instant');
  const cachee = vm.createContext({esc: x => x, iconesNatif: async () => { throw new Error('pas appelé'); }});
  vm.runInContext(brut, cachee);
  await cachee.iconesCharger();
  assert.equal(cachee.iconeLigneHTML('>'), '', 'ni ligne'); assert.equal(cachee.iconeReglageHTML(), '', 'ni feuille');
  /* Le jour où elle est montrée (ICONES_PROPOSEES à true) */
  const src = brut.replace('const ICONES_PROPOSEES=false;', 'const ICONES_PROPOSEES=true;');
  const essai = (natif) => {
    const j = {choix: [], toasts: [], rendus: 0};
    const ctx = vm.createContext({esc: x => x, activeTab: 'compte', renderCompte: () => { j.rendus++; }, buzz: () => {}, toast: (a) => j.toasts.push(a),
      iconesNatif: async () => natif, iconeChoisir: async id => { j.choix.push(id); return {ok: true, actuelle: id}; }});
    vm.runInContext(src, ctx);
    return {j, ctx};
  };
  let e = essai(null);
  await e.ctx.iconesCharger();
  assert.equal(e.ctx.iconeLigneHTML('>'), '', 'une version d’avant : rien');
  assert.equal(e.ctx.iconeReglageHTML(), '');
  e = essai({possible: true, actuelle: '', liste: ['IconeHalloween', 'IconeNoel']});
  await e.ctx.iconesCharger();
  assert.equal(e.j.rendus, 1, 'la page se redessine avec la ligne');
  assert.ok(e.ctx.iconeLigneHTML('>').includes('onclick="openPlusDetails(\'plus-icone\')"') && e.ctx.iconeLigneHTML('>').includes('<small>Classique</small>'));
  const f = e.ctx.iconeReglageHTML();
  assert.deepEqual([...f.matchAll(/iconeChanger\('(\w*)',this\)/g)].map(m => m[1]), ['', 'IconeNoel', 'IconeHalloween'], 'l’icône de base, puis celles de l’app, dans l’ordre des saisons');
  assert.ok(f.includes('class="ic-c on" role="radio" aria-checked="true" onclick="iconeChanger(\'\',this)"'));
  await e.ctx.iconeChanger('IconeNoel', null);
  assert.deepEqual(e.j.choix, ['IconeNoel']);
  assert.ok(e.ctx.iconeLigneHTML('>').includes('assets/icones/noel.png') && e.ctx.iconeLigneHTML('>').includes('<small>Noël</small>'));
  await e.ctx.iconeChanger('IconeNoel', null);
  assert.deepEqual(e.j.choix, ['IconeNoel'], 'déjà la sienne : rien');
  e = essai({possible: false, actuelle: '', liste: ['IconeNoel']});
  await e.ctx.iconesCharger();
  assert.equal(e.ctx.iconeLigneHTML('>'), '', 'iOS ne permet pas de changer d’icône : rien');
  /* Dans Mon compte */
  const rc = fn('renderCompte');
  assert.ok(rc.includes('if(!ICN.charge&&typeof ilePont===\'function\'&&ilePont())iconesCharger();') && rc.includes('const surIphone=widgetsVus||iconesIci();'));
  assert.ok(rc.includes('<p class="account-settings-group-title">${natifTexte(\'Sur ton iPhone\')}</p>\n          <div class="account-settings-list">\n            ${iconeLigneHTML(CHEV)}'));
  assert.ok(rc.includes('${langueReglageHTML()}\n    ${iconeReglageHTML()}'));
  for (const k of ['Icône de l’app', 'Classique', 'Noël', 'Nouvel An', 'Saint-Valentin', 'Pâques', 'Été', 'Halloween', 'L’icône n’a pas changé',
    'L’icône change sur ton écran d’accueil, et ton iPhone te le confirme.']) assert.ok(en.includes(`"${k}":`), k);
  /* Les noms des icônes sont ceux des jeux d’icônes de l’app */
  for (const n of ['IconeNoel', 'IconeNouvelAn', 'IconeSaintValentin', 'IconePaques', 'IconeEte', 'IconeHalloween']) assert.ok(src.includes(`id:'${n}'`), n);
});

test('« Noter l’application » : la page « Écrire un avis » de l’App Store, dans Compte et assistance', () => {
  const rc = fn('renderCompte');
  assert.ok(rc.includes('<button class="account-setting-row" type="button" onclick="noterAppli()"><span class="plus-row-icon is-stk">${lqStkSvg(\'etoile\')}</span><span><b>Noter l’application</b><small>${natifTexte(\'Ton avis sur l’App Store aide d’autres à nous trouver\')}</small></span>'));
  const i = rc.indexOf('onclick="noterAppli()"');
  assert.ok(i > rc.indexOf('<p class="account-settings-group-title">Compte et assistance</p>') && i < rc.indexOf("onclick=\"openPlusDetails('plus-data')\""), 'avant « Tes données, tes choix »');
  assert.ok(fn('noterAppli').includes('?action=write-review'));
  assert.ok(en.includes('"Noter l’application": "Rate the app"') && en.includes('"Ton avis sur l’App Store aide d’autres à nous trouver":'));
});

test('les icônes vont dans l’app avec scripts/ios-widget.mjs (sans AppIcon, recopiées à chaque fois)', () => {
  const s = lire('scripts/ios-widget.mjs');
  assert.ok(s.includes("readdirSync(dos).filter(n => n.endsWith('.appiconset') && n !== 'AppIcon.appiconset')"));
  for (const f of ['resources/ios/icones/IconeNoel.appiconset/IconeNoel-1024.png', 'assets/saisons/chat-noel.webp', 'assets/icones/noel.png'])
    assert.equal(spawnSync('git', ['check-ignore', '-q', f], {cwd: ROOT}).status, 1, f + ' : dans Git');
});
