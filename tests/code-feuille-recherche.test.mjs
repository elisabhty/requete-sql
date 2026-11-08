/* Elisa, 8 novembre, 15 h 27 : la relecture de « Rejoindre une partie » qu’elle a fait faire, et ses captures (la feuille, puis la
   page « Tu rejoins la salle… »). Ce qui en est retenu :
   - la salle se cherche dans la feuille : « On cherche ta salle… » et sa roue dans le bouton, puis la salle d’attente ; un code qui ne
     mène nulle part, une salle complète, plus de réseau : le message sous le champ, le code gardé tel quel (rien n’est sélectionné),
     sans changer de page. Avant, la page « Tu rejoins la salle… » s’ouvrait, puis renvoyait à la feuille ;
   - « Code de la salle », « Rejoindre la salle » (on arrive d’abord dans sa salle d’attente) ; « Entre ton code ! » reste ;
   - ni correction ni suggestions du clavier, des capitales ; coller l’invitation entière ou son lien ne laisse que le code (le champ
     n’a plus de longueur maximale, qui coupait le texte collé avant qu’on en tire le code) ;
   - au 6e caractère, le contour du champ s’illumine et le bouton s’allume ; on n’entre jamais tout seul : il faut le toucher.
   Pas de bouton « Coller » : il faudrait lire le presse-papiers, et l’iPhone le demande à chaque fois. 16 h 05 (Elisa : « on peut
   rejoindre tant que l’hôte n’a pas cliqué sur commencer, mais après non ») : « Trop tard, la partie a déjà commencé ! » (salle-defis).
   Une salle fermée, sans hôte, ne répond pas : « Aucune salle ne correspond à ce code ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';

const classes = (...k) => { const s = new Set(k); return { add: (...a) => a.forEach(x => s.add(x)), remove: (...a) => a.forEach(x => s.delete(x)), toggle: (x, on) => { if (on === undefined ? !s.has(x) : on) s.add(x); else s.delete(x); }, contains: x => s.has(x), get list() { return [...s].sort(); } }; };

function feuille() {
  const inp = { value: '', classList: classes('jeu-input', 'is-code'), offsetWidth: 0 };
  const t = { textContent: 'Rejoindre la salle' };
  const go = { disabled: true, classList: classes('room-go'), attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, querySelector: s => s === 'span' ? t : null };
  const msg = { innerHTML: '', classList: classes('jeu-msg'), get textContent() { return this.innerHTML; }, set textContent(v) { this.innerHTML = v; } };
  const el = { dataset: { k: 'code' }, classList: classes('dx-feuille'), querySelector: s => ({ '#jeu-code': inp, '#jeu-code-go': go, '.jeu-msg': msg })[s] || null };
  const buzz = [], stops = [], minuteurs = [];
  const ctx = vm.createContext({
    setTimeout: (f, ms) => minuteurs.push({ f, ms }), clearTimeout: id => { if (id && minuteurs[id - 1]) minuteurs[id - 1].f = null; },
    document: { getElementById: id => id === 'dx-feuille' ? el : id === 'jeu-code-go' ? go : null, querySelector: s => s === '#dx-feuille .jeu-msg' ? msg : null },
    buzz: k => buzz.push(k), JEU: null, jeuStop() { stops.push(ctx.JEU && ctx.JEU.code); ctx.JEU = null; },
  });
  vm.runInContext(fn('jeuCleanCode') + cut('const DX_CODE_MSG=', '\nfunction dxCodeEtat(') + '\n' + fn('dxCodePret') + fn('dxCodeEtat') + fn('dxCodeColle'), ctx);
  const attendre = () => { for (const m of minuteurs.splice(0)) if (m.f) m.f(); };
  return { ctx, inp, go, t, msg, el, buzz, stops, minuteurs, attendre };
}

test('le code se tire d’une invitation collée entière, de son lien ou d’un message écrit à la main ; taper reste simple', () => {
  const { ctx } = feuille();
  const cas = [
    ['Rejoins-moi sur Requête pour un défi SQL ! Code de la salle : NENEKE https://elisabhty.github.io/requete-sql/?partie=NENEKE&de=lea', 'NENEKE'],
    ['https://elisabhty.github.io/requete-sql/?partie=ab12cd&de=lea', 'AB12CD'],
    ['mon code : abc123', 'ABC123'], ['Code JUIUUI', 'JUIUUI'], ['Viens jouer ! NENEKE', 'NENEKE'], ['  juiuui ', 'JUIUUI'],
    ['nenek', 'NENEK'], ['NENEKEX', 'NENEKE'], ['a b-c 1', 'ABC1'], ['CODE12', 'CODE12'], ['', ''],
  ];
  for (const [v, attendu] of cas) assert.equal(ctx.jeuCleanCode(v), attendu, v);
  /* Le champ n’a plus de longueur maximale : collée entière, l’invitation arrive jusqu’ici */
  const h = fn('defisFeuilleHTML');
  assert.ok(h.includes('autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="ABC123"') && !h.includes('maxlength'));
  assert.ok(h.includes('oninput="this.value=jeuCleanCode(this.value);dxCodePret(this)" onpaste="dxCodeColle(event)"'));
  assert.ok(!/(\(\?<[=!])/.test(fn('jeuCleanCode')), 'pas de regard en arrière : les vieux Safari ne le lisent pas');
});

test('coller : le code seul arrive dans le champ ; un morceau de code se colle normalement', () => {
  const { ctx, inp, go } = feuille();
  let empeche = 0;
  const ev = t => ({ target: inp, clipboardData: { getData: k => (k === 'text' ? t : '') }, preventDefault() { empeche++; } });
  ctx.dxCodeColle(ev('Rejoins-moi sur Requête pour un défi SQL ! Code de la salle : NENEKE'));
  assert.deepEqual([inp.value, empeche, go.disabled, inp.classList.contains('is-pret')], ['NENEKE', 1, false, true]);
  inp.value = 'AB';
  ctx.dxCodeColle(ev('C1'));
  assert.deepEqual([inp.value, empeche], ['AB', 1], 'le navigateur colle « C1 » lui-même, puis oninput nettoie');
});

test('au 6e caractère : le contour s’illumine, le bouton s’allume, le téléphone le signale une fois ; taper efface l’erreur', () => {
  const { ctx, inp, go, msg, buzz, attendre } = feuille();
  for (const v of ['N', 'NE', 'NENEK']) { inp.value = v; ctx.dxCodePret(inp); }
  assert.deepEqual([go.disabled, inp.classList.contains('is-pret'), buzz.length], [true, false, 0]);
  inp.value = 'NENEKE'; ctx.dxCodePret(inp); ctx.dxCodePret(inp);
  assert.deepEqual([go.disabled, inp.classList.contains('is-pret'), buzz], [false, true, ['light']]);
  msg.innerHTML = 'Aucune salle…'; msg.classList.add('is-ko'); inp.classList.add('is-ko');
  inp.value = 'NENEK'; ctx.dxCodePret(inp);
  /* La bulle se replie en douceur : elle garde son texte le temps du repli, puis se vide */
  assert.deepEqual([msg.innerHTML, msg.classList.contains('is-ko'), inp.classList.contains('is-ko'), go.disabled], ['Aucune salle…', false, false, true]);
  inp.value = 'NENE'; ctx.dxCodePret(inp);
  assert.equal(msg.innerHTML, 'Aucune salle…', 'taper encore pendant le repli le laisse finir');
  attendre();
  assert.equal(msg.innerHTML, '');
});

test('la recherche dans la feuille : « On cherche ta salle… », la coche, ou le message à sa place et « Réessayer » (16 h 34)', () => {
  const { ctx, inp, go, t, msg, el, buzz, stops, attendre } = feuille();
  inp.value = 'NENEKE';
  ctx.dxCodeEtat('cherche', 'NENEKE');
  assert.deepEqual([go.classList.contains('is-cherche'), go.attrs['aria-busy'], t.textContent, go.disabled, msg.innerHTML, el.classList.contains('is-cherche')], [true, 'true', 'On cherche ta salle…', true, '', true]);
  /* Pendant qu’on cherche, le code ne change pas */
  ctx.JEU = { verif: true, code: 'NENEKE' };
  inp.value = 'NENEKA'; ctx.dxCodePret(inp);
  assert.deepEqual([inp.value, stops], ['NENEKE', []]);
  /* Trouvée : la coche verte, « Salle trouvée ! » */
  ctx.dxCodeEtat('trouvee', 'NENEKE');
  assert.deepEqual([go.classList.contains('is-trouvee'), go.classList.contains('is-cherche'), t.textContent, go.disabled, inp.classList.contains('is-trouvee'), el.classList.contains('is-cherche')], [true, false, 'Salle trouvée\u00a0!', true, true, false]);
  assert.deepEqual(buzz, ['success']);
  ctx.JEU = null;
  /* Personne dans la salle : le champ rougit et tremble, le code reste tel quel ; le message à sa place ; « Réessayer » */
  ctx.dxCodeEtat('introuvable', 'NENEKE');
  assert.deepEqual([go.classList.contains('is-cherche'), go.classList.contains('is-trouvee'), go.attrs['aria-busy'], t.textContent, go.disabled], [false, false, 'false', 'Réessayer', false]);
  /* 16 h 50 (« est-ce que le message peut être mieux comme UI UX ») : une bulle, l’autocollant « ! », le gras, puis quoi faire */
  assert.ok(msg.innerHTML.startsWith('<span class="dx-alerte-plie"><span class="dx-alerte"><i class="dx-alerte-ico"><svg viewBox="0 0 32 32" aria-hidden="true">') && msg.innerHTML.endsWith('<span class="dx-alerte-t"><b>Salle introuvable&nbsp;!</b><small>Ce code ne correspond à aucune salle. Vérifie-le et réessaie.</small></span></span></span>'));
  assert.ok(msg.classList.contains('is-ko') && inp.classList.contains('is-ko') && inp.classList.contains('is-shake') && !inp.classList.contains('is-pret') && !inp.classList.contains('is-trouvee'));
  assert.equal(inp.value, 'NENEKE');
  assert.deepEqual(buzz, ['success', 'error']);
  /* Complète, commencée, sans réseau : le message seul, le champ n’est pas en faute */
  for (const [e, texte] of [['complete', '<b>Salle complète&nbsp;!</b><small>Elle accueille déjà 5 joueurs, le maximum.</small>'], ['commencee', '<b>Trop tard, la partie a commencé&nbsp;!</b><small>On rejoint une salle avant que l’hôte lance la partie.</small>'], ['reseau', '<b>Connexion impossible</b><small>Vérifie ta connexion internet, puis réessaie.</small>'], ['horsligne', '<b>Pas de connexion internet</b><small>Connecte-toi, puis réessaie.</small>']]) {
    ctx.dxCodeEtat(e, 'NENEKE');   // même juste après « introuvable » : le champ n’est plus rouge
    assert.ok(msg.innerHTML.endsWith(`<span class="dx-alerte-t">${texte}</span></span></span>`), e);
    assert.ok(!inp.classList.contains('is-ko'), e);
    assert.equal(t.textContent, 'Réessayer', e);
  }
  assert.deepEqual(buzz.slice(2), ['warning', 'warning', 'warning', 'warning']);
  /* Code incomplet (Entrée avant 6 caractères) : le champ tremble, le bouton ne dit pas « Réessayer » */
  inp.value = 'NEN'; inp.classList.remove('is-ko', 'is-shake');
  ctx.dxCodeEtat('incomplet', 'NEN');
  assert.ok(msg.innerHTML.endsWith('<span class="dx-alerte-t"><b>Code incomplet</b><small>Entre les 6 caractères du code.</small></span></span></span>') && inp.classList.contains('is-shake'));
  assert.deepEqual([t.textContent, go.disabled], ['Rejoindre la salle', true]);
  /* Le code corrigé : le message s’efface, le bord redevient violet, « Rejoindre la salle » */
  ctx.dxCodeEtat('introuvable', 'NENEKE'); inp.value = 'NENEKA'; ctx.dxCodePret(inp);
  assert.deepEqual([msg.classList.contains('is-ko'), inp.classList.contains('is-ko'), t.textContent, go.disabled], [false, false, 'Rejoindre la salle', false]);
  attendre();
  assert.equal(msg.innerHTML, '');
  /* « Réessayer » : la bulle se replie pendant qu’on cherche ; une nouvelle erreur pendant le repli la garde ouverte */
  ctx.dxCodeEtat('introuvable', 'NENEKA'); ctx.dxCodeEtat('cherche', 'NENEKA');
  assert.ok(!msg.classList.contains('is-ko') && msg.innerHTML.includes('Salle introuvable'));
  ctx.dxCodeEtat('reseau', 'NENEKA'); attendre();
  assert.ok(msg.classList.contains('is-ko') && msg.innerHTML.includes('<b>Connexion impossible</b>'), 'le repli annulé ne vide pas la nouvelle bulle');
  /* Une autre feuille ouverte : rien ne bouge */
  const autre = feuille(); autre.el.dataset.k = 'creer';
  autre.ctx.dxCodeEtat('introuvable', 'X');
  assert.equal(autre.msg.innerHTML, '');
});

test('fermée pendant la recherche (×, le voile, Échap, un autre onglet), elle l’arrête ; trouvée, la feuille se referme sur la salle', () => {
  assert.ok(fn('defisFeuilleFermer').includes("if(typeof JEU!=='undefined'&&JEU&&JEU.verif)jeuStop();"));
  assert.ok(fn('defisFeuilleFermer').includes("el.querySelectorAll('#jeu-code,#jeu-code-go').forEach(x=>x.removeAttribute('id'));"), 'rouverte aussitôt, la feuille ne lit jamais l’ancien code');
  const suivre = fn('jeuVerifSuivre');
  assert.ok(suivre.indexOf('J.verif=false;') < suivre.indexOf('defisFeuilleFermer(true);'), 'la salle trouvée n’est pas arrêtée en refermant la feuille');
  assert.ok(suivre.includes('jeuEcran();') && suivre.includes("if(J.full){jeuVerifEchec('complete');return false;}"));
  assert.ok(fn('jeuRender').startsWith('function jeuRender(){\n  const J=JEU;if(!J)return;\n  if(J.verif&&!jeuVerifSuivre(J))return;'), 'rien ne se dessine tant qu’on cherche');
  assert.ok(app.includes("function jeuToast(txt){ if(typeof JEU!=='undefined'&&JEU&&JEU.verif)return;"), 'ni annonce');
  /* Le bouton touché ne ferme pas le clavier : en cas d’erreur, on corrige tout de suite */
  assert.ok(fn('defisFeuilleHTML').includes('id="jeu-code-go" onmousedown="event.preventDefault()"'));
});

test('le pseudo à réserver : son échec revient dans la feuille, plus de fenêtre par-dessus', async () => {
  const dits = [], infos = [], ko = [];
  const ctx = vm.createContext({ psMien: () => '', lqSay: t => dits.push(t), lqInfo: (...a) => infos.push(a[0]) });
  vm.runInContext(fn('jeuAvecPseudo'), ctx);
  for (const [rep, attendu] of [[() => Promise.resolve(false), 'pseudo'], [() => Promise.reject(new Error('réseau')), 'reseau']]) {
    ctx.psReserverPourSalle = rep;
    ctx.jeuAvecPseudo(() => assert.fail('pas de salle'), r => ko.push(r));
    await new Promise(r => setImmediate(r));
    assert.equal(ko.at(-1), attendu);
  }
  assert.deepEqual(infos, [], 'avec la feuille : pas de fenêtre');
  ctx.psReserverPourSalle = () => Promise.resolve(false);
  ctx.jeuAvecPseudo(() => {});
  await new Promise(r => setImmediate(r));
  assert.deepEqual(infos, ['Salle indisponible'], 'ailleurs : la fenêtre, comme avant');
});

test('la feuille de style : l’onde violette au 6e caractère, la roue dans le bouton violet, le rouge de l’erreur', () => {
  for (const k of ['html.lq .dx-feuille .room-join .jeu-input.is-code.is-pret{border-color:var(--accent)!important;animation:dxCodeOnde .6s ease-out}',
    '@keyframes dxCodeOnde{0%{outline:3px solid rgba(106,77,244,.5);outline-offset:0}100%{outline:3px solid rgba(106,77,244,0);outline-offset:10px}}',
    'html.lq .dx-feuille .room-join .jeu-input.is-code.is-ko{border-color:#E5484D!important;',
    'html.lq .dx-feuille[data-k="code"] .jeu-msg,html.lq .dx-feuille[data-k="code"] .jeu-msg:empty{display:grid;grid-template-rows:0fr;min-height:0;margin:0!important;',
    'html.lq .dx-feuille[data-k="code"] .jeu-msg.is-ko{grid-template-rows:1fr;margin:-10px 0 18px!important}',
    'html.lq .dx-feuille[data-k="code"] .jeu-msg:not(.is-ko) .dx-alerte{animation:dxAlerteFin .2s ease both}', 'html.lq .dx-feuille[data-k="code"] .dx-alerte{display:flex;align-items:flex-start;gap:11px;',
    'html.lq .dx-feuille[data-k="code"] .dx-alerte-t b{color:#B8323A;font:700 16px/1.25 var(--display);', 'html.lq .dx-feuille[data-k="code"] .dx-alerte-ico{flex:none;display:block;width:32px;height:32px;rotate:-8deg;', 'html.lq .dx-feuille.is-cherche .room-join .jeu-input.is-code{color:var(--ink-3);caret-color:transparent}',
    'html.lq :is(#scr-defis,.dx-feuille) .room-go.is-trouvee:disabled{background:#17A35E!important;', 'html.lq .dx-feuille .room-go.is-trouvee .dx-go-ok{display:flex;',
    'html.lq :is(#scr-defis,.dx-feuille) .room-go.is-cherche:disabled{background:var(--accent)!important;', 'html.lq .dx-feuille .room-go.is-cherche .dx-go-roue{display:block;',
    'html.lq .dx-feuille .room-go.is-cherche>svg{display:none}', 'html.lq[data-motion="reduce"] .dx-feuille .room-join .jeu-input.is-code.is-pret,'])
    assert.ok(lq.includes(k), k);
  const i = lq.indexOf('20.19 La feuille du code'), j = lq.indexOf('Défis v2 · 21.');
  assert.ok(i > 0 && i < j, 'avec les feuilles des Défis, avant la section 21');
});

test('la salle classée (l’identité d’abord, multiplayer-security.js) : ses erreurs reviennent sous le champ ; le bouton attend tant qu’on cherche', async () => {
  const sec = lire('multiplayer-security.js');
  const essai = async ({ reponse, retirer = true }) => {
    const etats = [], infos = [], starts = [];
    const button = { disabled: true, isConnected: true, classList: classes('room-go', 'is-cherche') };
    const ecran = {};
    const ctx = vm.createContext({
      window: {}, navigator: { onLine: true }, AbortController, setTimeout, clearTimeout, Date, Error, TypeError, JSON,
      document: { querySelector: s => (s === '#dx-feuille .room-go' ? button : s === '.screen.active' ? ecran : null) },
      JEU_SB: 'https://x.test', JEU_SB_KEY: 'k', clsCle: () => 'c', psMien: () => '@lea', psAdopter() {},
      fetch: reponse, lqInfo: (...a) => infos.push(a[1]), psReserverPourSalle: () => Promise.resolve(false),
      dxCodeEtat: (e, c) => { etats.push([e, c]); if (retirer) button.classList.remove('is-cherche'); },
    });
    vm.runInContext('var jeuStart=function(){__starts.push([...arguments]);};var jeuRun=function(){};' + sec, Object.assign(ctx, { __starts: starts }));
    await ctx.jeuStart('NENEKE', false, null, { nomId: 'jeu-nom', parCode: true, verif: true });
    return { etats, infos, starts, button };
  };
  const hors = await essai({ reponse: () => Promise.reject(new TypeError('Load failed')) });
  assert.deepEqual([hors.etats, hors.infos, hors.button.disabled], [[['reseau', 'NENEKE']], [], false], 'hors ligne : sous le champ, pas de fenêtre');
  const panne = await essai({ reponse: () => Promise.resolve({ ok: false, json: () => Promise.resolve({ message: 'trop de demandes' }) }) });
  assert.deepEqual(panne.etats, [['indispo', 'NENEKE']]);
  const sansPseudo = await essai({ reponse: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ pid: 'p' }) }) });
  assert.deepEqual([sansPseudo.etats, sansPseudo.infos], [[['pseudo', 'NENEKE']], []], 'le pseudo n’a pas pu être réservé : sous le champ');
  const ok = await essai({ reponse: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ pid: 'p', pseudo: '@lea', serverNow: Date.now() }) }), retirer: false });
  assert.equal(ok.starts.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(ok.starts[0])), ['NENEKE', false, null, { nomId: 'jeu-nom', parCode: true, verif: true, secure: true }], 'la recherche continue dans la feuille');
  assert.equal(ok.button.disabled, true, 'le bouton attend toujours, « On cherche ta salle… »');
  assert.ok(app.includes('<script src="multiplayer-security.js?v=4"></script>'));
});
