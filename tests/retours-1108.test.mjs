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
const rappel = cut('/* Les jours du rappel (Elisa, 4 novembre, 11 h 08, réf. 2)', 'function setRappelHeure(h){');

test('réf. 1 : choisir une source ne fait plus rejouer l’entrée de toutes les tuiles', () => {
  assert.ok(media.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine.ob-enter .ob-source-tile{animation:obvTileIn .34s var(--v-pop) var(--d,0ms) both}'));
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
  const trois = await programme(3);
  assert.deepEqual(trois[0], ['annule', [1, 11, 12, 13, 14, 15, 16, 17]], 'l’ancien rappel quotidien et ceux des jours, d’abord');
  assert.deepEqual(trois[1][1].map(n => [n.id, n.schedule.on.weekday, n.schedule.on.hour, n.schedule.on.minute, n.schedule.repeats]),
    [[12, 2, 7, 45, true], [14, 4, 7, 45, true], [16, 6, 7, 45, true]], 'lundi, mercredi, vendredi (weekday : 1 = dimanche), chaque semaine');
  const sept = await programme(7);
  assert.deepEqual(sept[1][1].map(n => [n.id, n.schedule.on.weekday, n.schedule.on.hour]), [[1, undefined, 7]], 'tous les jours : un seul rappel quotidien');
  assert.equal((await programme(5, false)).length, 1, 'rappel coupé : tout est annulé, rien de programmé');
  /* Sur le web, le rappel de la page : les jours de séance seulement */
  assert.ok(app.includes("  if(!rappelJours().includes(now.getDay())) return;   // les jours de séance seulement (11 h 08)"));
  /* Il suit le parcours : à la fin de l’onboarding, quand on ajuste ou recrée son planning */
  for (const k of ["  try{rappelNativeSync();}catch(e){}   // le rappel suit les jours du parcours créé (11 h 08)",
    "  try{rappelNativeSync();}catch(e){}   // le rappel suit les jours du parcours (11 h 08)",
    "  semaineOffset=0;jourSel=null;save();renderPlanning();\n  try{rappelNativeSync();}catch(e){}"])
    assert.ok(app.includes(k), k);
  /* Mon compte : les jours, plus « Rappel quotidien » */
  assert.ok(app.includes("<span><b>Rappel de séance</b><small>${remind?`${rappelJoursTexte()} à ${hour}`:'Désactivé'}</small></span>") && !app.includes('Rappel quotidien'));
});

test('réf. 2 : la page du rappel, l’heure en grand, quatre moments, les jours de séance, et tout change sur place', () => {
  const p = lastCut("}else if(slide==='rappel'){", "}else if(slide==='widget'){");
  assert.ok(p.includes("const fq=draft.freq||7,quand=fq===7?'chaque jour':fq===5?'en semaine':'tes jours de séance';") && p.includes('Un petit <em>rappel</em><br>${quand}&nbsp;?</h1>'));
  assert.ok(p.includes('${obRappelCarte()}') && p.includes('<p class="ob-rappel-note">Modifiable à tout moment dans Mon compte.</p>'));
  assert.ok(p.includes("obSetFooter(`Me rappeler à ${obHeureTexte(draft.rappelHeure)}`,obRappelDemander,'','','');"));
  const aides = cut('const OB_RAPPEL_MOMENTS=', '/* La fenêtre en aperçu au centre de l’écran');
  const el = () => { const c = new Set(); return { textContent: '', value: '', dataset: {}, offsetWidth: 1, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; },
    classList: { add: x => c.add(x), remove: x => c.delete(x), toggle: (x, on) => (on ? c.add(x) : c.delete(x)), has: x => c.has(x) } }; };
  const moments = ['08:00', '12:30', '19:00', '21:30'].map(h => Object.assign(el(), { dataset: { h } }));
  const h = el(), inp = el(), cta = el(), appels = [];
  const ctx = vm.createContext({ PATTERN, JOURS, OB_ICO_HEURES: '<svg/>', OB_SLIDES: ['rappel'], obStep: 0, draft: { freq: 3, rappelHeure: '19:00' },
    rappelHeure: () => '19:00', escAttr: s => String(s), rappelJoursTexte: j => j.join('-'), prefersReduceMotion: () => false, buzz: k => appels.push(k),
    document: { getElementById: id => ({ 'ob-rappel-h': h, 'ob-rappel-input': inp, 'ob-next': cta })[id], querySelectorAll: () => moments } });
  vm.runInContext(aides.replace('const OB_RAPPEL_MOMENTS=', 'var OB_RAPPEL_MOMENTS='), ctx);
  assert.deepEqual(['19:00', '08:00', '12:30', '21:30'].map(x => vm.runInContext(`obHeureTexte('${x}')`, ctx)), ['19\u00a0h', '8\u00a0h', '12\u00a0h\u00a030', '21\u00a0h\u00a030']);
  const carte = vm.runInContext('obRappelCarte()', ctx);
  assert.ok(carte.includes('<input type="time" id="ob-rappel-input" value="19:00" aria-label="Heure du rappel" onchange="obRappelHeure(this.value)" onclick="try{this.showPicker&&this.showPicker();}catch(e){}">'), 'la roue d’iOS au toucher de l’heure (et le sélecteur d’un ordinateur)');
  assert.deepEqual([...carte.matchAll(/class="ob-rappel-moment( on)?" data-h="([\d:]+)" aria-pressed="(true|false)"/g)].map(m => [m[2], !!m[1], m[3]]),
    [['08:00', false, 'false'], ['12:30', false, 'false'], ['19:00', true, 'true'], ['21:30', false, 'false']]);
  assert.deepEqual([...carte.matchAll(/<i class="(on)?" style="--i:\d">(\w)<\/i>/g)].map(m => (m[1] ? m[2] : '.')).join(''), 'L.M.V..', 'du lundi au dimanche, ceux du parcours allumés');
  assert.ok(carte.includes('role="img" aria-label="1-3-5"'), 'lus en clair par un lecteur d’écran');
  vm.runInContext("obRappelHeure('08:00')", ctx);
  assert.equal(ctx.draft.rappelHeure, '08:00');
  assert.equal(h.textContent, '8\u00a0h'); assert.equal(inp.value, '08:00'); assert.equal(cta.textContent, 'Me rappeler à 8\u00a0h');
  assert.deepEqual(moments.map(m => m.classList.has('on')), [true, false, false, false]);
  assert.ok(h.classList.has('is-new') && appels.join() === 'selection', 'l’heure saute, un petit retour haptique');
  vm.runInContext("obRappelHeure('7:5')", ctx);
  assert.equal(ctx.draft.rappelHeure, '08:00', 'une heure mal formée est ignorée');
  /* L’heure choisie est gardée avant la demande d’iOS */
  assert.ok(cut('async function obRappelDemander(){', '/* L’heure et les jours du rappel').includes("const h=(typeof draft!=='undefined'&&draft&&draft.rappelHeure)||rappelHeure();\n  try{localStorage.setItem('requete-rappel-heure',h);}catch(e){}"));
  for (const k of ['html #onboarding.ob-vitrine .ob-rappel-carte{', 'html #onboarding.ob-vitrine .ob-rappel-moment.on{border-color:var(--v-sun);',
    'html #onboarding.ob-vitrine .ob-rappel-semaine i.on{background:var(--v-accent);color:#fff}', 'html #onboarding.ob-vitrine.ob-fit-3 .ob-rappel-step .ob-notif{display:none}'])
    assert.ok(css.includes(k), k);
});

test('réf. 3 : un raccourci de l’icône pendant l’onboarding le dit dans un bandeau', () => {
  const b = cut('/* Un bandeau en haut de l’onboarding', 'function obNext(){');
  assert.ok(b.includes("b.className='ob-bandeau';b.setAttribute('role','status');") && b.includes("obBandeau.t=setTimeout(()=>b.classList.remove('is-on'),3600);"));
  assert.ok(css.includes('html #onboarding.ob-vitrine>.ob-bandeau{position:absolute;z-index:8;') && css.includes('html #onboarding.ob-vitrine>.ob-bandeau.is-on{transform:translate(-50%,0);opacity:1}'));
});

test('réf. 4 : « pas de stress, tu pourras le changer dans ton planning », sous les jours et sous la durée', () => {
  assert.ok(app.includes('<span>Pas de stress&nbsp;: tu pourras le changer à tout moment dans ton planning.</span></p>'));
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
  assert.ok(plugin.includes('self.init(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)'), 'en CGFloat (pas de division entière)');
  assert.ok(scene.includes('window?.backgroundColor = UIColor(requeteHex: "#F4F2FC")\n        window?.rootViewController = RequeteViewController()'));
});

test('réf. 6 et 7 : la première page parle de tous les appareils, et le bouton remonte sur toutes les étapes', () => {
  assert.ok(app.includes("'Ta progression sera sauvegardée sur tous tes appareils.');") && !app.includes("'Ta progression est enregistrée sur cet appareil.');"));
  assert.ok(sansCommentaires(css).includes('html #onboarding.ob-vitrine .ob-foot{padding-bottom:calc(var(--safe-bottom,0px) + 34px)!important}'));
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=18">') && sw.includes("'./onboarding-vitrine.css?v=18',"), 'feuille rechargée');
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  assert.ok(app.includes(`const SW_CACHE='${cache}';`) && cache.includes('rappel-jours'));
});
