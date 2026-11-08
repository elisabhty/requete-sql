/* Les défis de chaque base partagent leur seed SQL et gardent un résultat déterministe. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(root, 'vendor/sqljs', f) });
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const ctx = vm.createContext({});
vm.runInContext(cut('const CHALLENGES=[', '\nfunction defisParProgression(){').replace('const CHALLENGES=', 'CHALLENGES='), ctx);
const DEFIS = JSON.parse(JSON.stringify(ctx.CHALLENGES));
const AERO = DEFIS.filter(c => c.base === 'aeroport');
const WOK = DEFIS.filter(c => c.base === 'wok');
const FROMAGERIE = DEFIS.filter(c => c.base === 'fromagerie');
const VOYAGES = DEFIS.filter(c => c.base === 'voyages');
const LABO = DEFIS.filter(c => c.base === 'labo');
const ZOO = DEFIS.filter(c => c.base === 'zoo');
const SPORT = DEFIS.filter(c => c.base === 'salle_sport');
const aero = cut("aeroport:{nom:'Aéroport',", '\n`}');
const base = () => { const d = new SQL.Database(); d.run(aero.slice(aero.indexOf('sql:`') + 5)); return d; };

test('les défis comptent 57 Aéroport et quatorze bases de 30 défis', () => {
  /* 6 novembre : les sept bases ajoutées (station de ski, food truck, aquarium, vélos, ferme apicole, escape game, festival) */
  assert.equal(DEFIS.length, 477);
  for (const b of ['ski', 'foodtruck', 'aquarium', 'velos', 'apiculture', 'escape', 'festival'])
    assert.deepEqual(['f', 'm', 'd'].map(n => DEFIS.filter(c => c.base === b && c.niv === n).length), [10, 10, 10], b);
  assert.equal(AERO.length, 57);
  assert.equal(DEFIS.filter(c => c.base === 'hopital').length, 30);
  assert.equal(WOK.length, 30);
  assert.equal(FROMAGERIE.length, 30);
  assert.equal(VOYAGES.length, 30);
  assert.equal(LABO.length, 30);
  assert.equal(ZOO.length, 30);
  assert.equal(SPORT.length, 30);
  assert.deepEqual(WOK.map(c => c.id), [...Array.from({ length: 10 }, (_, i) => 'wf' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'wm' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'wd' + (i + 1))]);
  assert.deepEqual(FROMAGERIE.map(c => c.id), [...Array.from({ length: 10 }, (_, i) => 'ff' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'fm' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'fd' + (i + 1))]);
  assert.deepEqual(VOYAGES.map(c => c.id), [...Array.from({ length: 10 }, (_, i) => 'vf' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'vm' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'vd' + (i + 1))]);
  assert.deepEqual(LABO.map(c => c.id), [...Array.from({ length: 10 }, (_, i) => 'lf' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'lm' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'ld' + (i + 1))]);
  const zooParNiveau = [...ZOO].sort((a, b) => 'fmd'.indexOf(a.niv) - 'fmd'.indexOf(b.niv) || Number(a.id.slice(2)) - Number(b.id.slice(2)));
  assert.deepEqual(zooParNiveau.map(c => c.id), [
    ...Array.from({ length: 10 }, (_, i) => 'zf' + (i + 1)),
    ...Array.from({ length: 10 }, (_, i) => 'zm' + (i + 1)),
    ...Array.from({ length: 10 }, (_, i) => 'zd' + (i + 1)),
  ]);
  for (const c of DEFIS) {
    assert.ok(['aeroport', 'hopital', 'wok', 'fromagerie', 'voyages', 'labo', 'zoo', 'salle_sport', 'ski', 'foodtruck', 'aquarium', 'velos', 'apiculture', 'escape', 'festival'].includes(c.base), c.id);
    assert.equal(c.niv, ({ f: 'f', m: 'm', d: 'd' })[c.id[1]], c.id);
    assert.ok((c.situation && c.affiche.length) && c.indice && c.sol && c.titre && Number.isInteger(c.apres), c.id);
  }
  assert.ok(!/\b(clients|commandes|produits)\b/.test(AERO.map(c => c.sol).join(' ')), 'plus rien sur la base du cours dans le lot Aéroport');
  assert.ok(app.includes('const CHALLENGE_GUIDES={};'));
});

test('les cinq nouveaux défis Moyen exécutent leurs agrégats sur Aéroport', () => {
  const d = base();
  const rows = id => d.exec(DEFIS.find(c => c.id === id).sol)[0].values;
  assert.deepEqual(rows('am10'), [['AlphaJet', 9], ['BlueHorizon', 5], ['NovaAir', 5], ['SkyWings', 5], ['Skyline', 5], ['AtlanticGo', 4]]);
  assert.equal(rows('am11').length, 19);
  assert.deepEqual(rows('am11')[0], ['Harry', 'Brown', 3]);
  assert.deepEqual(rows('am12'), [['2025-05', 'Affaires', 12, 598], ['2025-05', 'Premium', 15, 422], ['2025-05', 'Économique', 43, 190], ['2025-06', 'Affaires', 9, 486], ['2025-06', 'Premium', 17, 260], ['2025-06', 'Économique', 35, 140]]);
  assert.deepEqual(rows('am13'), [['SKY203', 'Lisbonne', 7, 10], ['ALX105', 'Lisbonne', 6, 11], ['BLH403', 'Lisbonne', 6, 9], ['NVA302', 'Londres', 5, 10], ['ATG503', 'Paris', 5, 9], ['SKL602', 'Berlin', 5, 9]]);
  assert.deepEqual(rows('am14'), [['AlphaJet', 17, 9, 6], ['SkyWings', 16, 4, 3], ['Skyline', 13, 3, 1], ['BlueHorizon', 12, 6, 2], ['AtlanticGo', 10, 6, 7], ['NovaAir', 10, 4, 2]]);
  d.close();
});

test('lot Difficile Aéroport : les dix requêtes utilisent les notions annoncées et leurs résultats correspondent aux données', () => {
  const hard = AERO.filter(c => c.niv === 'd');
  assert.equal(hard.length, 10);
  const d = base();
  const rows = id => d.exec(DEFIS.find(c => c.id === id).sol)[0].values;
  assert.deepEqual(rows('ad1').slice(0, 3), [['AlphaJet', 26], ['SkyWings', 18], ['AtlanticGo', 14]]);
  assert.deepEqual(rows('ad2').slice(0, 5), [['Lisbonne', 36, 1], ['Paris', 31, 2], ['Londres', 17, 3], ['New York', 12, 4], ['Berlin', 11, 5]]);
  assert.equal(rows('ad3').length, 22, 'la moyenne inclut les passagers sans réservation à 0 €');
  assert.deepEqual(rows('ad3')[0], ['John', 'Miller', 4016, 3372.96]);
  assert.deepEqual(rows('ad4').slice(0, 3), [['NVA302', 144, 10, 6.9], ['ALX105', 180, 11, 6.1], ['SKY203', 180, 10, 5.6]]);
  assert.deepEqual(rows('ad5').slice(0, 3), [['ALX104', 2920, 1], ['ALX105', 1989, 2], ['ALX100', 830, 3]]);
  assert.deepEqual(rows('ad6')[0], [1, 'ATG500', '2025-05-18', 420, null, null]);
  assert.equal(rows('ad7').length, 18);
  assert.equal(rows('ad8').length, 10);
  assert.deepEqual(rows('ad10'), [['Diego', 'Ramirez', 'BLH401', 2]]);
  const aff = rows('ad9').filter(r => r[0] === 'BlueHorizon');
  assert.deepEqual(aff, [['BlueHorizon', 'Économique', 1965, 1], ['BlueHorizon', 'Premium', 1941, 2], ['BlueHorizon', 'Affaires', 760, 3]]);
  d.close();
});

test('chaque solution Aéroport s’exécute et son ordre reste stable', () => {
  for (const c of AERO) {
    const d = base();
    const r = d.exec(c.sol);
    assert.ok(r[0] && r[0].values.length > 0, `${c.id} : au moins une ligne`);
    if (c.ordered) {
      /* SQLite renverse l’ordre de ce que ORDER BY ne fixe pas : le résultat ne doit pas bouger */
      d.run('PRAGMA reverse_unordered_selects = ON');
      assert.deepEqual(d.exec(c.sol)[0].values, r[0].values, `${c.id} : ordre entièrement fixé par la consigne`);
    }
    d.close();
  }
});

/* Elisa, 4 novembre, 20 h 33 : en salle, le joueur ne voit que le défi ; « il faut que tu dises vous avez accès au schéma, et il faut
   que tous les défis soient très très bien expliqués point par point ». */
test('la consigne autonome d’un défi, point par point, avec l’accès au schéma, seul comme en salle', () => {
  const NOMS = Object.fromEntries([...app.matchAll(/\n  ([a-z_]+):\{nom:'([^']+)',/g)].map(m => [m[1], { nom: m[2] }]));
  vm.runInContext(cut('function defiConsigneHTML(c,o){', '\n/* Les indices d’un défi raté'), Object.assign(ctx, { esc: s => String(s).replace(/</g, '&lt;'), escCode: s => String(s).replace(/</g, '&lt;').replace(/`([^`\n]+)`/g, '<code>$1</code>'), DEFI_BASES: NOMS }));
  for (const c of [DEFIS[8], DEFIS.find(x => !x.ordered && x.affiche), DEFIS.find(x => x.garde && x.garde.length && x.precis && x.precis.length)]) {
    ctx.c = c;
    const html = vm.runInContext('defiConsigneHTML(c)', ctx);
    /* 7 novembre, 15 h 12 : les noms de tables et de colonnes, entre accents graves, s’affichent en code (retours-1512) */
    /* 8 novembre, 19 h 57 : la situation s’arrête avant « À toi de jouer ! », qui passe dessous dans son cadre gris (reactions-direct) */
    const seule = c.situation.replace(/\s*À toi de jouer\s*!$/, '');
    for (const t of [seule, ...c.affiche, ...c.garde, ...c.precis]) assert.ok(html.includes(t.replace(/`([^`\n]+)`/g, '<code>$1</code>')), c.id + ' : ' + t);
    assert.ok(html.includes('</p><div class="dq-atoi"><b>À toi de jouer\u00a0!</b> Tu peux consulter le <button type="button" class="dq-lien" onclick="openSchemaSheet()">') && html.includes('schéma</button> de la base à tout moment pour explorer les tables et leurs colonnes.</div>'), c.id + ' : l’appel dans son cadre, « schéma » ouvre le schéma');
    assert.ok(html.includes('<b>Affiche</b>') && (html.match(/<ol class="dq-l is-num">/g) || []).length >= 1, c.id + ' : une pastille numérotée par colonne');
    assert.equal(html.includes('<b>Garde</b>'), c.garde.length > 0, c.id + ' : les lignes gardées, s’il y en a');
    assert.equal(html.includes('<b>À savoir</b>'), c.precis.length > 0, c.id);
    assert.ok(c.ordered ? c.tri.split(/,\s*puis\s+/).every(t => html.includes(t.trim())) && html.includes('l’ordre compte') : html.includes('<b>Ordre libre</b>'), c.id + ' : le tri clé par clé, ou l’ordre libre');
    /* 9 novembre, 0 h 31 (« supprimer du coup ») : plus de carte « Tu as accès au schéma » ; la pastille d’« À toi de jouer » l’ouvre */
    assert.ok(html.includes('class="dq-lien" onclick="openSchemaSheet()"') && !html.includes('Tu as accès au') && !html.includes('dq-schema'), c.id + ' : le schéma à un toucher');
    assert.ok(!html.includes(c.sol) && !html.includes(c.indice), c.id + ' : ni solution ni indice');
  }
  ctx.c = { ...DEFIS[8], affiche: ['<script>intrusion</script>'] };
  assert.ok(!vm.runInContext('defiConsigneHTML(c)', ctx).includes('<script>'), 'les points restent du texte');
  ctx.c = { contexte: '<script>intrusion</script>', q: 'Autre texte' };
  const ancien = vm.runInContext('defiConsigneHTML(c)', ctx);
  assert.ok(!ancien.includes('<script>') && ancien.includes('class="dq-lien" onclick="openSchemaSheet()"') && !ancien.includes('Tu as accès au'), 'un ancien défi garde son texte, et le schéma (par « À toi de jouer »)');
  assert.ok(!app.includes('<summary>Un indice</summary>'), 'pas d’indice');
  assert.equal((app.match(/\$\{defiConsigneHTML\(c,\{titre:true\}\)\}/g) || []).length + (app.match(/\$\{defiConsigneHTML\(c,\{base:true,titre:true\}\)\}/g) || []).length, 2, 'défi seul et manche en salle (la base en pastille, 8 novembre, 18 h 28 ; le titre dans le cadre, 21 h 51)');
  ctx.c = DEFIS[8];
  assert.ok(vm.runInContext('defiConsigneHTML(c,{base:true})', ctx).startsWith('<div class="consigne dq has-base"><span class="dq-chip is-base">Base ' + NOMS[DEFIS[8].base].nom + '</span><span class="tag">La situation</span>'), 'en salle : la base posée sur le bord du cadre, puis « La situation » (18 h 36)');
});

test('1 h 20 : le Schéma attire l’œil pendant un défi ; un défi seul se ferme au bout du chrono de son niveau (8 novembre : 10, 15 ou 20 min)', () => {
  assert.ok(app.includes("function schAttn(){return typeof mode!=='undefined'&&(mode==='defi'||mode==='jeu')?' sch-attn':'';}"));
  assert.ok(app.includes('class="ed-schema${schAttn()}"') && app.includes('class="btn-ghost${schAttn()}"'));
  assert.ok(app.includes("document.querySelectorAll('.sch-attn').forEach(b=>b.classList.remove('sch-attn'));"), 'ouvert une fois : il s’arrête');
  assert.ok(app.includes('const t0=depart||Date.now(),dur=jeuDureeMs(c&&c.niv);') && app.includes('if(took>=dur){defiChronoStop();defiSesClear();defiTempsEcoule(c);}'));
  assert.ok(app.includes("document.querySelectorAll('#defi-solo-block .btn-run').forEach(b=>b.disabled=true);"));
  assert.ok(app.includes('  defiChronoStart(c,reprise?reprise.t0:0);'));
});

test('un niveau sans défi est grisé et ne se choisit pas', () => {
  /* 6 novembre, 15 h 20 : un niveau qui a des défis montre son coefficient à la place (retours-1520-pratiquer) */
  /* 7 novembre, 21 h 44 : « ×2 pts » (retours-2144-defis). Refonte du 7 novembre : plus de « Bientôt » (aucun texte ne promet ce qui
     viendra) ; la carte reste grisée et désactivée (is-bientot, disabled). */
  /* 8 novembre, 11 h 08 (« ce niveau premium ») : la pièce de « Ta salle de défi » puis ×N */
  assert.ok(app.includes("${vide?'':`<span class=\"room-lv-x\" aria-hidden=\"true\">${DX_PIECE_SVG}×${x}<small>pts</small></span>`}"));
  const niv = app.slice(app.indexOf('function jeuNiveauxHTML('), app.indexOf('\nfunction defisNiv('));
  assert.ok(niv.length > 100 && !niv.includes('Bientôt') && niv.includes("${vide?' is-bientot':''}") && niv.includes("${vide?' disabled':"));
  assert.ok(app.includes("if(!jeuChallenges(jeuNiv).length){const k=['f','m','d'].find(x=>jeuChallenges(x).length);if(k)jeuNiv=k;}"));
  assert.ok(app.includes("if(k==='niv'&&!(JEU_NIVL[v]&&jeuChallenges(v).length))return;"), 'écran Défis');
  assert.ok(app.includes("if(k==='niv'&&JEU_NIVL[v]&&jeuChallenges(v).length)J.niv=v;"), 'salle d’attente');
});
