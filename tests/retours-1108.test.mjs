/* 4 novembre, 11 h 08 (Elisa, sept captures de son iPhone, TestFlight) :
   réf. 1 (« Comment as-tu connu Requête ? ») « la page bug à l’appui des trucs » ; réf. 2 (le rappel) « laisser choisir de manière
   UI/UX à quelle heure, et récupérer les jours mis dans l’autre page » ; réf. 3 (les raccourcis de l’icône) « le lien ne fonctionne
   pas vers les défis » ; réf. 4 (les jours) « mettre que ça pourra être modifiable directement dans son planning, donc t’inquiète, et
   pareil » (pour le rythme) ; réf. 5 (le prénom, clavier ouvert) « en bas, tu vois du noir sur les deux côtés, je préfère du
   transparent » ; réf. 6 (la première page) « ça sera enregistré sur tous les appareils, car compte obligatoire » ; réf. 7 (la
   promesse) « le bouton jaune, je trouve qu’on est trop bas ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html');
const css = read('onboarding-vitrine.css');
const sw = read('sw.js');
const plugin = read('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const scene = read('resources/ios/widget/App/SceneDelegate.swift');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const lastCut = (a, b) => { const i = app.lastIndexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
const media = css.slice(css.indexOf('@media (prefers-reduced-motion:no-preference){'), css.indexOf('@media (prefers-reduced-motion:reduce){', css.indexOf('@media (prefers-reduced-motion:no-preference){')));
const PATTERN = vm.runInNewContext('(' + cut('const PATTERN=', 'const JOURS=').replace('const PATTERN=', '').trim().replace(/;$/, '') + ')');
const JOURS = vm.runInNewContext(cut('const JOURS=', 'const MIN_PAR_ACTIVITE').replace('const JOURS=', '').trim().replace(/;$/, ''));
const rappel = cut('/* Les jours du rappel (Elisa, 4 novembre, 11 h 08, réf. 2)', '/* Le rappel dans Mon compte (Elisa, 5 novembre, 12 h 12');

test('réf. 1 : choisir une source ne fait plus rejouer l’entrée de toutes les tuiles', () => {
  /* 6 novembre, 23 h 16 : en fondu, à leur place */
  assert.ok(media.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine.ob-enter .ob-source-tile{animation:obvApparait .24s ease-out calc(var(--d,0ms) * .5) both}'));
  assert.ok(!/#onboarding\.ob-vitrine \.ob-source-tile\{animation/.test(css), 'plus sans « ob-enter » (la page est redessinée à chaque choix)');
});

test('réf. 2 : le rappel, les jours du parcours (pendant l’onboarding, ceux de l’étape des jours)', () => {
  const ctx = vm.createContext({ PATTERN, state: { plan: { freq: 5 } }, draft: { freq: 3 }, document: { getElementById: () => ({ classList: { contains: c => c === 'on' } }) } });
  vm.runInContext(rappel.replace('const JOURS_NOMS=', 'var JOURS_NOMS='), ctx);
  assert.deepEqual([...vm.runInContext('rappelJours()', ctx)], [1, 3, 5], 'onboarding ouvert : les jours choisis');
  ctx.document = { getElementById: () => ({ classList: { contains: () => false } }) };
  assert.deepEqual([...vm.runInContext('rappelJours()', ctx)], [1, 2, 3, 4, 5], 'sinon : ceux du parcours');
  ctx.state = { plan: null };
  assert.deepEqual([...vm.runInContext('rappelJours()', ctx)], [0, 1, 2, 3, 4, 5, 6], 'sans parcours : tous les jours');
  const texte = f => vm.runInContext(`rappelJoursTexte(${JSON.stringify(PATTERN[f])})`, ctx);
  assert.deepEqual([7, 5, 3, 2].map(texte), ['Chaque jour', 'En semaine', 'Lundi, mercredi et vendredi', 'Lundi et jeudi']);
});

test('réf. 2 : les notifications ne sonnent que les jours de séance, à l’heure choisie', async () => {
  const programme = async (freq, on = true) => {
    const appels = [];
    const ctx = vm.createContext({ PATTERN, state: { plan: { freq } }, draft: {}, document: { getElementById: () => null },
      rappelOn: () => on, rappelHeure: () => '07:45',
      window: { Capacitor: { isNativePlatform: () => true, Plugins: { LocalNotifications: {
        cancel: async o => { appels.push(['annule', [...o.notifications].map(n => n.id)]); }, requestPermissions: async () => ({ display: 'granted' }),
        schedule: async o => { appels.push(['programme', JSON.parse(JSON.stringify(o.notifications))]); } } } } } });
    vm.runInContext(rappel.replace('const JOURS_NOMS=', 'var JOURS_NOMS='), ctx);
    vm.runInContext('rappelNativeSync()', ctx);
    await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));
    return appels;
  };
  /* Depuis le 5 novembre, 19 h 41 : plus de rappel qui se répète (il garderait toujours le même texte), mais les séances à venir,
     une à une, chacune avec son message (tests/retours-1941.test.mjs) */
  const ids = [1, 11, 12, 13, 14, 15, 16, 17, ...Array.from({ length: 64 }, (_, i) => 100 + i)];
  const trois = await programme(3);
  assert.deepEqual(trois[0], ['annule', ids], 'l’ancien rappel quotidien, ceux des jours et les séances déjà posées, d’abord');
  const t = trois[1][1], maintenant = Date.now();
  assert.equal(trois[1][0], 'programme');
  assert.equal(t.length, 56, '56 séances au plus (iOS en garde 64 par appli)');
  assert.deepEqual(t.map(n => n.id), Array.from({ length: 56 }, (_, i) => 100 + i));
  for (const n of t) {
    const d = new Date(n.schedule.at);
    assert.ok([1, 3, 5].includes(d.getDay()), 'lundi, mercredi, vendredi : ' + n.schedule.at);
    assert.deepEqual([d.getHours(), d.getMinutes(), d.getSeconds()], [7, 45, 0], 'à l’heure choisie');
    assert.ok(d.getTime() > maintenant, 'à venir');
    assert.equal(n.schedule.allowWhileIdle, true);
    assert.ok(!('on' in n.schedule) && !('repeats' in n.schedule), 'une seule fois chacune');
  }
  assert.ok(t.every((n, i) => i === 0 || new Date(n.schedule.at) > new Date(t[i - 1].schedule.at)), 'dans l’ordre');
  const sept = (await programme(7))[1][1];
  assert.equal(sept.length, 56, 'tous les jours : les huit semaines à venir');
  assert.ok(sept.every((n, i) => i === 0 || new Date(n.schedule.at) - new Date(sept[i - 1].schedule.at) < 26 * 3600e3), 'un par jour');
  assert.equal((await programme(5, false)).length, 1, 'rappel coupé : tout est annulé, rien de programmé');
  /* Sur le web, le rappel de la page : les jours de séance seulement ; depuis le 5 novembre, 21 h 41, ceux du planning (retours-2141) */
  assert.ok(app.includes("  if(rappelJoursPrevus(now,1)[0]!==rappelIso(now)) return;   // les jours où le planning prévoit une séance pas encore faite (11 h 08, 21 h 41)"));
  /* Il suit le parcours : à la fin de l’onboarding, quand on ajuste ou recrée son planning */
  for (const k of ["  try{rappelNativeSync();}catch(e){}   // le rappel suit les jours du parcours créé (11 h 08)",
    "  try{rappelNativeSync();}catch(e){}   // le rappel suit les jours du parcours (11 h 08)",
    "  semaineOffset=0;jourSel=null;save();renderPlanning();\n  try{rappelNativeSync();}catch(e){}"])
    assert.ok(app.includes(k), k);
  /* Mon compte : les jours, plus « Rappel quotidien » */
  assert.ok(app.includes("<span><b>Rappel de séance</b><small>${remind?`${rappelJoursTexte()} à ${hour}`:'Désactivé'}</small></span>") && !app.includes('Rappel quotidien'));
});

test('réf. 2 : la page du rappel, « À quel moment ? » comme dans Mon compte (5 novembre, 12 h 12), les jours de séance, et tout change sur place', () => {
  const p = lastCut("}else if(slide==='rappel'){", "}else if(slide==='widget'){");
  assert.ok(p.includes("const fq=draft.freq||7,quand=fq===7?'chaque jour':fq===5?'en semaine':'tes jours de séance';") && p.includes('Un petit <em>rappel</em><br>${quand}&nbsp;?</h1>'));
  assert.ok(p.includes('${obRappelCarte()}') && p.includes('<p class="ob-rappel-note">Modifiable à tout moment dans Mon compte.</p>'));
  assert.ok(p.includes("obSetFooter(`Me rappeler à ${obHeureTexte(draft.rappelHeure)}`,obRappelDemander,'','','');"));
  const aides = cut('function obHeureTexte(h){', '/* La fenêtre en aperçu au centre de l’écran');
  const choix = cut('/* Les heures d’un moment ;', 'const RP_INFO_SVG=');
  const slots = cut('const RAPPEL_SLOTS=[', 'function rappelHeure(){');
  const slotId = cut('function rappelSlotId(h){', '/* Les jours du rappel');
  const conteneur = { innerHTML: '', contains: () => false, querySelector: () => null };
  const cta = { textContent: '' }, appels = [];
  const ctx = vm.createContext({ PATTERN, JOURS, OB_SLIDES: ['rappel'], obStep: 0, draft: { freq: 3, rappelHeure: '19:00' },
    rappelHeure: () => '19:00', escAttr: s => String(s), rappelJoursTexte: j => j.join('-'), buzz: k => appels.push(k), obCtaLibelle: (b, t) => { b.textContent = t; },
    document: { activeElement: null, getElementById: id => ({ 'ob-rappel-choix': conteneur, 'ob-next': cta })[id] } });
  vm.runInContext((slots + slotId + choix + aides).replace('const RAPPEL_SLOTS=', 'var RAPPEL_SLOTS='), ctx);
  assert.deepEqual(['19:00', '08:00', '12:30', '21:30'].map(x => vm.runInContext(`obHeureTexte('${x}')`, ctx)), ['19\u00a0h', '8\u00a0h', '12\u00a0h\u00a030', '21\u00a0h\u00a030']);
  const carte = vm.runInContext('obRappelCarte()', ctx);
  assert.ok(carte.includes('<p class="ob-rappel-k" id="ob-rappel-l">À quel moment&nbsp;?</p>') && carte.includes('<div class="ob-rappel-choix" id="ob-rappel-choix">'));
  assert.deepEqual([...carte.matchAll(/class="rp-slot( on)?" data-slot="(\w+)"/g)].map(m => [m[2], !!m[1]]), [['morning', false], ['afternoon', false], ['evening', true]], 'Matin, Après-midi, Soir');
  assert.deepEqual([...carte.matchAll(/class="rp-heure( on)?" data-h="([\d:]+)"/g)].map(m => (m[1] ? `[${m[2]}]` : m[2])).join(' '), '18:00 [19:00] 20:00 21:00 22:00');
  assert.ok(!carte.includes('type="time"') && !carte.includes('ob-rappel-moment'), 'plus de roue ni de quatre moments');
  assert.deepEqual([...carte.matchAll(/<i class="(on)?" style="--i:\d">(\w)<\/i>/g)].map(m => (m[1] ? m[2] : '.')).join(''), 'L.M.V..', 'du lundi au dimanche, ceux du parcours allumés');
  assert.ok(carte.includes('role="img" aria-label="1-3-5"'), 'lus en clair par un lecteur d’écran');
  /* Une heure, puis un moment : l’heure change sur place, le bouton la dit */
  vm.runInContext("obRappelHeure('21:00')", ctx);
  assert.equal(ctx.draft.rappelHeure, '21:00'); assert.equal(cta.textContent, 'Me rappeler à 21\u00a0h');
  assert.ok(conteneur.innerHTML.includes('class="rp-heure on" data-h="21:00"') && appels.join() === 'selection');
  vm.runInContext("obRappelSlot('morning')", ctx);
  assert.equal(ctx.draft.rappelHeure, '08:00', 'le matin : 8 h');
  assert.ok(conteneur.innerHTML.includes('class="rp-slot on" data-slot="morning"') && conteneur.innerHTML.includes('data-h="07:00"') && conteneur.innerHTML.includes('class="rp-heure on" data-h="08:00"'));
  vm.runInContext("obRappelSlot('morning')", ctx);
  assert.equal(ctx.draft.rappelHeure, '08:00', 'le même moment : l’heure reste');
  /* Une heure d’avant hors de la liste (Midi, 12 h 30) garde sa place parmi celles de l’après-midi */
  ctx.draft.rappelHeure = '12:30';
  assert.ok(/data-h="12:00"[^]*data-h="12:30"[^]*data-h="13:00"/.test(vm.runInContext('obRappelCarte()', ctx)) && vm.runInContext('obRappelCarte()', ctx).includes('class="rp-slot on" data-slot="afternoon"'));
  vm.runInContext("obRappelHeure('7:5')", ctx);
  assert.equal(ctx.draft.rappelHeure, '12:30', 'une heure mal formée est ignorée');
  /* L’heure choisie est gardée avant la demande d’iOS */
  assert.ok(cut('async function obRappelDemander(){', '/* L’heure et les jours du rappel').includes("const h=(typeof draft!=='undefined'&&draft&&draft.rappelHeure)||rappelHeure();\n  try{localStorage.setItem('requete-rappel-heure',h);}catch(e){}"));
  for (const k of ['html #onboarding.ob-vitrine .ob-rappel-carte{', 'html #onboarding.ob-vitrine .ob-rappel-choix .rp-heure.on{border-color:var(--v-sun);',
    'html #onboarding.ob-vitrine .ob-rappel-choix .rp-slot.on{background:#fff;', 'html #onboarding.ob-vitrine .ob-rappel-semaine i.on{background:var(--v-accent);color:#fff}',
    'html #onboarding.ob-vitrine.ob-fit-3 .ob-rappel-step .ob-notif{display:none}'])
    assert.ok(css.includes(k), k);
  assert.ok(!css.includes('.ob-rappel-moment') && !css.includes('.ob-rappel-heure'), 'les anciens styles sont partis');
});

test('réf. 3 : un raccourci de l’icône pendant l’onboarding le dit dans un bandeau', () => {
  const b = cut('/* Un bandeau en haut de l’onboarding', 'function obNext(){');
  assert.ok(b.includes("b.className='ob-bandeau';b.setAttribute('role','status');") && b.includes("obBandeau.t=setTimeout(()=>b.classList.remove('is-on'),3600);"));
  assert.ok(css.includes('html #onboarding.ob-vitrine>.ob-bandeau{position:absolute;z-index:8;') && css.includes('html #onboarding.ob-vitrine>.ob-bandeau.is-on{transform:translate(-50%,0);opacity:1}'));
});

test('réf. 4 : « pas de stress, tu pourras le changer dans ton planning », sous les jours et sous la durée', () => {
  /* 5 novembre, 12 h 12 : « adapte ton rythme » ; Mon compte l’ouvre aussi, sur place */
  assert.ok(app.includes('<span>Pas de stress&nbsp;: tu pourras l’adapter à tout moment, dans ton planning ou dans Mon compte.</span></p>'));
  assert.ok(lastCut("}else if(slide==='jours'){", "}else if(slide==='build'){").includes('</div>${obModifiable()}</div>`;'));
  assert.ok(lastCut("}else if(slide==='rhythm'){", "}else if(slide==='jours'){").includes('${obRhythmSummary()}${obModifiable()}</div>`;'));
  assert.ok(!cut('function obRhythmSummary(){', 'function obModifiable(){').includes('modifiable à tout moment'), 'dit une seule fois');
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-modifiable{display:flex;') && css.includes('html #onboarding.ob-vitrine.ob-fit-4 .ob-modifiable{display:none}'));
});

test('réf. 5 : sous le clavier, la couleur du bas de la page plutôt que du noir', () => {
  const f = cut('function couleurHex(c){', 'function obRhythmSummary(){');
  const ctx = vm.createContext({ innerWidth: 390, innerHeight: 600, getComputedStyle: el => ({ backgroundColor: el.bg }), Math, parseFloat });
  vm.runInContext(f, ctx);
  assert.deepEqual(['rgb(69, 41, 204)', 'rgba(255, 255, 255, 0.9)', 'rgba(0, 0, 0, 0)', 'transparent', 'rgb(244 242 252)'].map(c => vm.runInContext(`couleurHex(${JSON.stringify(c)})`, ctx)),
    ['#4529CC', '#FFFFFF', null, null, '#F4F2FC']);
  /* L’onboarding : son violet ; ailleurs, le premier fond plein sous le bas de l’écran */
  ctx.document = { getElementById: () => ({ classList: { contains: c => c === 'on' } }) };
  assert.equal(vm.runInContext('couleurDuBas()', ctx), '#4529CC');
  const feuille = { nodeType: 1, bg: 'rgba(0, 0, 0, 0)', parentElement: { nodeType: 1, bg: 'rgb(255, 255, 255)', parentElement: null } };
  ctx.document = { getElementById: () => null, elementFromPoint: (x, y) => (x === 195 && y === 598 ? feuille : null) };
  assert.equal(vm.runInContext('couleurDuBas()', ctx), '#FFFFFF');
  /* Envoyée à l’app (une fois par couleur), avant que le clavier s’ouvre */
  const appels = [];
  ctx.window = { Capacitor: { isNativePlatform: () => true, isPluginAvailable: n => n === 'RequeteWidget', nativePromise: (p, m, o) => { appels.push([p, m, o.couleur]); return Promise.resolve(); } } };
  vm.runInContext('fondSousClavier();fondSousClavier()', ctx);
  assert.deepEqual(appels, [['RequeteWidget', 'fond', '#FFFFFF']]);
  ctx.window = {};
  vm.runInContext('fondSousClavier.derniere=null;fondSousClavier()', ctx);
  assert.equal(appels.length, 1, 'dans Safari, rien');
  assert.ok(app.includes("  document.addEventListener('focusin',e=>{const t=e.target;if(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable))fondSousClavier();});\n  window.addEventListener('keyboardWillShow',fondSousClavier);"));
  /* Le côté iPhone : la méthode « fond » du pont, la fenêtre aux couleurs de l’app dès le lancement */
  assert.ok(plugin.includes('CAPPluginMethod(name: "fond", returnType: CAPPluginReturnPromise)') && plugin.includes('@objc func fond(_ call: CAPPluginCall) {'));
  assert.ok(plugin.includes('self.bridge?.viewController?.view.window?.backgroundColor = couleur') && plugin.includes('convenience init?(requeteHex hex: String) {'));
  for (const k of ['let rouge: CGFloat = CGFloat((v >> 16) & 0xFF) / 255', 'let vert: CGFloat = CGFloat((v >> 8) & 0xFF) / 255',
    'let bleu: CGFloat = CGFloat(v & 0xFF) / 255', 'self.init(red: rouge, green: vert, blue: bleu, alpha: 1)'])
    assert.ok(plugin.includes(k), `${k} : en CGFloat (pas de division entière), une composante par ligne (16 h 28)`);
  assert.ok(scene.includes('window?.backgroundColor = UIColor(requeteHex: "#F4F2FC")\n        window?.rootViewController = RequeteViewController()'));
});

test('réf. 6 et 7 : la première page parle de tous les appareils, et le bouton remonte sur toutes les étapes', () => {
  assert.ok(app.includes("'Ta progression sera sauvegardée sur tous tes appareils.');") && !app.includes("'Ta progression est enregistrée sur cet appareil.');"));
  /* 4 novembre, 14 h 08 (réf. 3) : « monter encore le bouton jaune » : jusqu’à 58 px au-dessus de la barre d’accueil, 34 px au moins */
  assert.ok(sansCommentaires(css).includes('html #onboarding.ob-vitrine .ob-foot{padding-bottom:calc(var(--safe-bottom,0px) + clamp(34px,6.6vh,58px))!important}'));
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=29">') && sw.includes("'./onboarding-vitrine.css?v=29',"), 'feuille rechargée');
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  /* Le cache a changé de nom ce jour-là (rappel-jours, v2497), et de nouveau à chaque version qui a suivi */
  assert.ok(app.includes(`const SW_CACHE='${cache}';`) && Number((cache.match(/-v(\d+)$/) || [])[1]) >= 2497, cache);
});
