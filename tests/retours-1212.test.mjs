/* 5 novembre, 12 h 12 (Elisa, neuf captures) :
   Réf. 1 : « je veux pas que ça mène vers le planning quand on clique » (Mon compte › Parcours et rythme) ; « Page de parcours :
   Adapte ton rythme. Un programme qui s’adapte à toi, pas l’inverse. Corriger aussi sur l’onboarding ou ailleurs si c’est pertinent ».
   Réf. 2 → réf. 3 : la suppression du compte. Réf. 4 : « récupérer l’e-mail du compte ici ? Dans ton e-mail automatiquement ».
   Réf. 5 → réf. 6 : le rappel, et l’onboarding « en fonction de cette UI/UX ». Réf. 7 : « Contacte-nous », « Quel est le sujet de ton
   message ? », un exemple qui suit le sujet, « Inclure les informations techniques », « Envoyer mon message » avec une confirmation,
   aussi sur le site ; le bouton coupé en bas. Joue seul : les manches coupées par le pied ; « Un défi tiré au sort, pour t’entraîner ».
   Vérifié dans un navigateur (430, 390, 375 et 320 px de large). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), ob = lire('onboarding-vitrine.css'), sw = lire('sw.js');
const site = lire('decouvrir/index.html'), vcss = lire('decouvrir/vitrine.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attendre = () => new Promise(r => setImmediate(r));

test('réf. 1 : « Parcours et rythme » ouvre « Adapte ton rythme » sur Mon compte, sans passer par le planning', () => {
  const ouvrir = cut('function openAccountPlanSettings(){', '\n}\n') + '\n}';
  const pas = [];
  const ctx = vm.createContext({ state: { plan: {} }, switchTab: t => pas.push(['onglet', t]), openPlanAdjust: d => pas.push(['feuille', d && d.id]),
    document: { activeElement: { id: 'autre' }, querySelector: s => (s === '#scr-compte [onclick="openAccountPlanSettings()"]' ? { id: 'ligne-compte' } : null) } });
  vm.runInContext(ouvrir, ctx);
  ctx.openAccountPlanSettings();
  assert.deepEqual(JSON.parse(JSON.stringify(pas)), [['feuille', 'ligne-compte']], 'la feuille, depuis la ligne de Mon compte');
  ctx.state.plan = null; ctx.openAccountPlanSettings();
  assert.deepEqual(JSON.parse(JSON.stringify(pas.at(-1))), ['onglet', 'planning'], 'sans parcours : le planning, pour en créer un');
  /* Appliqué depuis Mon compte : on y reste, la ligne à jour, le focus revient dessus */
  const commit = cut('function planAdjustCommit(preview){', '\n}\n');
  assert.ok(commit.includes("const depuisCompte=!!planAdjustTrigger?.closest?.('#scr-compte');"));
  assert.ok(commit.includes("if(depuisCompte){\n    if(typeof renderCompte==='function')renderCompte();") && commit.includes("}else requestAnimationFrame(()=>{\n    const nextScreen=document.getElementById('scr-planning');"));
  /* Le titre et la phrase d’Elisa ; les boutons du planning disent « adapter » ; l’onboarding aussi */
  assert.ok(app.includes('<b id="plan-adjust-title" tabindex="-1">Adapte ton rythme</b>') && app.includes("lqVizCap('plan-adjust-sheet',PL_STK_CAL,'Un programme qui s’adapte à toi, pas l’inverse.');"));
  assert.ok(app.includes('<p class="pl-adjust-lead">Un programme qui s’adapte à toi, pas l’inverse.</p>'));
  assert.ok(app.includes('onclick="openPlanAdjust(this)">${PLAN_SLIDERS_SVG}Adapter mon rythme</button>') && app.includes('${PLAN_SLIDERS_SVG}<span>Adapter</span></button>'));
  assert.ok(!app.includes('Choisis un rythme confortable') && !app.includes('>Ajuster mon rythme<') && !app.includes('Modifier mon rythme'));
  assert.ok(app.includes('<span>Pas de stress&nbsp;: tu pourras l’adapter à tout moment, dans ton planning ou dans Mon compte.</span>'));
});

test('réf. 2 et 3 : la suppression du compte dit ce qui part, en deux blocs, puis l’encadré « irréversible »', () => {
  const html = vm.runInContext(cut('const DEL_SVG={', 'async function compteSupprimer(){') + ';compteSupprimerHTML("@lea<b>",false)', vm.createContext({ esc }));
  assert.ok(html.startsWith('<p class="lq-del-h">Voici ce qui sera supprimé&nbsp;:</p>'));
  assert.ok(html.includes('<b>Sur Requête</b><small>Ton pseudo «&nbsp;@lea&lt;b&gt;&nbsp;», tes scores et ta place dans les classements, tes avis, ton vote et tes messages.</small>'), 'le pseudo, échappé');
  assert.ok(html.includes('<b>Sur cet appareil</b><small>Tes leçons, tes défis, tes cartes mémo, tes notes, ton planning et tes projets enregistrés.</small>'));
  assert.ok(html.includes('<p class="lq-del-warn"><span class="lq-del-wi"><svg') && html.includes('<span><b>Cette action est irréversible.</b> Tes données ne pourront pas être récupérées.</span></p>'));
  const avecCompte = vm.runInContext(cut('const DEL_SVG={', 'async function compteSupprimer(){') + ';compteSupprimerHTML("",true)', vm.createContext({ esc }));
  assert.ok(avecCompte.includes('<small>Ton pseudo, tes scores et ta place dans les classements, tes avis, ton vote et tes messages, et ton compte.</small>'));
  const f = cut('async function compteSupprimer(){', '\n}\n');
  assert.ok(f.includes("titre:'Supprimer ton compte ?',texte:'Tu es sur le point de supprimer définitivement ton compte Requête et les données associées.',"));
  assert.ok(f.includes("corps:compteSupprimerHTML(p,compte),oui:'Continuer vers la confirmation',non:'Conserver mon compte',danger:true"));
  assert.ok(f.includes("oui:'Supprimer définitivement mon compte',non:'Conserver mon compte',danger:true"), 'la seconde fenêtre dit l’acte final');
  /* lqAsk prend un corps (du HTML écrit par l’app) sous le bandeau, que le lecteur d’écran lit aussi */
  const ask = cut('function lqAsk(o){', '/* Elisa, 31 octobre, 8 h 37 (Réf 10)');
  assert.ok(ask.includes("${o.corps?`<div class=\"lq-ask-corps\" id=\"lq-ask-c\">${o.corps}</div>`:''}") && ask.includes("aria-describedby=\"lq-ask-p${o.corps?' lq-ask-c':''}\""));
  for (const k of ['html.lq .lq-ask-sheet.has-corps{max-height:calc(100% - var(--safe-top,0px) - 16px - env(safe-area-inset-bottom,0px));overflow-x:hidden;overflow-y:auto;',
    'html.lq .lq-del-i{flex:none;display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--accent-soft);color:var(--accent-ink)}',
    'html.lq .lq-del-warn{display:flex;align-items:flex-start;gap:10px;', 'html[data-motion="reduce"].lq .lq-ask.on .lq-ask-corps{animation:none}',
    'html.lq .lq-ask-sheet.has-corps .lq-ask-btns{position:sticky;bottom:-20px;z-index:2;margin:0 -20px -20px;padding:12px 20px 20px;background:#fff}', '@media (max-height:760px){'])
    assert.ok(lq.includes(k), k);
});

/* Le module « Contacte-nous » dans un faux DOM (comme retours-1849). */
function contact({ store = {}, compte = null } = {}) {
  const els = {};
  const get = id => (els[id] ||= { id, value: '', textContent: '', innerHTML: '', hidden: false, disabled: false, placeholder: '', dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, setAttribute() {}, focus() {} });
  const c = vm.createContext({ esc, escAttr: s => String(s).replace(/"/g, '&quot;'), JSON, Math, String, Array, Promise, setTimeout: f => f(),
    lqStkSvg: k => `<svg data-k="${k}"></svg>`, appVersionLabel: () => 'Version v2535',
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
    navigator: { userAgent: 'iPhone Safari/604.1 Version/18.0', maxTouchPoints: 5, language: 'fr-FR', onLine: true },
    screen: { width: 430, height: 932 }, innerWidth: 430, innerHeight: 932, matchMedia: () => ({ matches: false }),
    document: { getElementById: get, querySelectorAll: () => [] }, clsCle: () => 'K'.repeat(32), buzz() {},
    clsRpc: () => Promise.resolve({ ok: true }) });
  c.window = c;
  if (compte) c.state = compte;
  vm.runInContext(cut('/* ---------- Comprendre mes données ----------', 'function replayOnboarding(){'), c);
  return { c, ev: s => vm.runInContext(s, c), el: get, store };
}

test('réf. 7 : « Contacte-nous », le sujet, un exemple qui suit le sujet, « Envoyer mon message » toujours visible, puis la confirmation', async () => {
  assert.ok(app.includes('<span><b>Contacte-nous</b><small>Un bug, une idée, une question</small></span>') && app.includes('<summary><span>Contacte-nous</span><small>Un bug, une idée, une question : on lit tout.</small>'));
  assert.ok(!/>Nous contacter</.test(app) && !app.includes('«&nbsp;Nous contacter&nbsp;»') && !app.includes('« Nous contacter »'), 'plus de « Nous contacter » à l’écran');
  const t = contact();
  const h = t.ev('ctHTML()');
  assert.ok(h.includes('<p class="ct-l" id="ct-sujet-l">Quel est le sujet de ton message&nbsp;?</p>'));
  assert.ok(h.includes('<b>Inclure les informations techniques</b><small>v2535 · iPhone · Safari · navigateur · 430×932</small>'));
  /* 21 h 54 : la note sur le serveur est partie (retours-2154) ; le pied avec le bouton reste */
  assert.ok(!h.includes('class="ct-note"') && h.includes('<div class="ct-pied">') && h.includes('onclick="ctEnvoyer()">Envoyer mon message</button></div>'), 'le pied avec le bouton');
  /* L’exemple change avec le sujet */
  const ex = {};
  for (const k of ['bug', 'idee', 'question', 'autre']) { t.ev(`ctType('${k}')`); ex[k] = t.el('ct-msg').placeholder; }
  assert.deepEqual(ex, {
    bug: 'Ex. : sur l’écran Défis, « Rejoindre » ne réagit pas. Je m’attendais à entrer dans la salle.',
    idee: 'Ex. : un cours sur les fonctions de fenêtrage, ou un mode sombre pour réviser le soir.',
    question: 'Ex. : comment retrouver ma progression sur un autre appareil ?',
    autre: 'Ex. : un mot sur Requête, ton école, un partenariat…' });
  /* L’envoi : le bouton attend, puis la confirmation remercie pour ce qui a été envoyé */
  t.ev("ctType('idee')"); t.el('ct-msg').value = 'Un mode sombre'; t.ev("ctTape(document.getElementById('ct-msg'))");
  await t.ev('ctEnvoyer()'); await attendre();
  const merci = t.el('ct-body').innerHTML;
  assert.ok(merci.includes('<b>Message envoyé&nbsp;!</b>') && merci.includes('<p>Merci pour ton idée. On lit chaque message.</p>'));
  for (const k of ['html.lq #scr-compte .ct-pied{position:sticky;bottom:0;z-index:2;margin:14px -18px 0;padding:12px 18px calc(var(--safe-bottom,0px) + 14px);background:#fff;',
    'html.lq #scr-compte .ct-body:has(.ct-pied){padding-bottom:0!important}'])
    assert.ok(lq.includes(k), k);
});

test('réf. 4 : l’e-mail du compte connecté remplit le champ vide ; sinon, celui tapé une fois reste sur l’appareil', () => {
  const connecte = contact({ compte: { accountMode: 'connected', accountLabel: ' lea@exemple.fr ' } });
  assert.ok(connecte.ev('ctHTML()').includes('value="lea@exemple.fr"'), 'l’adresse du compte');
  const tape = contact({ compte: { accountMode: 'connected', accountLabel: 'lea@exemple.fr' }, store: { 'rq-contact': JSON.stringify({ type: 'bug', msg: '', mail: 'moi@ailleurs.fr' }) } });
  assert.ok(tape.ev('ctHTML()').includes('value="moi@ailleurs.fr"'), 'celle tapée par la personne passe avant');
  const pseudo = contact({ compte: { accountMode: 'connected', accountLabel: 'Apple' } });
  assert.ok(pseudo.ev('ctHTML()').includes('value=""'), 'un identifiant qui n’est pas une adresse : rien');
  assert.ok(contact({ compte: { accountMode: 'guest', accountLabel: 'lea@exemple.fr' } }).ev('ctHTML()').includes('value=""'), 'sans compte connecté : rien');
  assert.ok(contact().ev('ctHTML()').includes('value=""'), 'sans état (tests, autres pages) : rien');
});

/* Le rappel de Mon compte dans un faux DOM. */
function rappel({ store = {}, perm = 'default', sansNotif = false } = {}) {
  const body = { innerHTML: '', contains: () => false, querySelector: () => null }, appels = [];
  const ctx = vm.createContext({
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } }, PATTERN: { 7: [0, 1, 2, 3, 4, 5, 6], 5: [1, 2, 3, 4, 5] },
    state: { plan: { freq: 7 } }, draft: null, window: {}, navigator: { vibrate() {} }, Notification: sansNotif ? undefined : { permission: perm, requestPermission: () => appels.push('permission') },
    document: { activeElement: null, documentElement: { classList: { contains: () => false } }, getElementById: id => (id === 'rp-body' ? body : null) },
    closePlusDetails: () => appels.push('fermer'), renderCompte: () => appels.push('compte'), toast: (a, b) => appels.push(['toast', a, b]), buzz: () => {} });
  vm.runInContext(cut('function rappelOn(){', 'function tickRappel(){'), ctx);
  return { ctx, ev: s => vm.runInContext(s, ctx), body, appels, store };
}

test('réf. 5 et 6 : le rappel de Mon compte, « Recevoir un rappel », « À quel moment ? », rien ne change avant « Enregistrer mes préférences »', () => {
  const r = rappel();
  r.ev('RP=null;rappelBrouillon();rappelPeindre()');
  let h = r.body.innerHTML;
  assert.ok(h.includes('<b>Recevoir un rappel</b><small>Désactivé</small>') && h.includes('role="switch" aria-checked="false"'), 'éteint : « Désactivé », sans heure à côté');
  assert.ok(!h.includes('acc-remind-now') && !h.includes('Notification désactivée'), 'plus de « Notification désactivée » à côté de 19:00');
  assert.ok(h.includes('<p class="rp-l" id="rp-l">À quel moment&nbsp;?</p>') && h.includes('class="rp-slot on" data-slot="evening"') && h.includes('class="rp-heure on" data-h="19:00"'));
  assert.ok(h.includes('Active les rappels pour recevoir une notification à l’heure choisie, sous réserve des autorisations de ton appareil.'));
  assert.ok(h.includes('<div class="rp-pied"><button type="button" class="lq-btn rp-go" onclick="rappelEnregistrer()">Enregistrer mes préférences</button></div>'));
  /* On allume, on choisit le matin puis 9 h : rien n’est encore enregistré */
  r.ev("rappelBasculer();rappelMoment('morning');rappelChoisirHeure('09:00')");
  h = r.body.innerHTML;
  assert.ok(h.includes('<small>Activé · chaque jour à 09:00</small>') && h.includes('class="rp-slot on" data-slot="morning"') && h.includes('class="rp-heure on" data-h="09:00"'));
  /* 21 h 41 : le prochain rappel, et qu’il suit le planning (retours-2141) */
  const quand = new Date().getHours() < 9 ? 'aujourd’hui' : 'demain';
  assert.ok(h.includes(`<span>Prochain rappel\u00a0: ${quand} à 09:00.</span>`), h);   // 22 h 04 : sans la phrase sur le planning
  assert.deepEqual(r.store, {}, 'rien ne change avant « Enregistrer »');
  r.ev('rappelEnregistrer()');
  assert.deepEqual(r.store, { 'requete-rappel': '1', 'requete-rappel-heure': '09:00' });
  assert.deepEqual(JSON.parse(JSON.stringify(r.appels)), ['permission', 'fermer', 'compte', ['toast', 'Rappel enregistré', 'Chaque jour à 09:00']], 'l’autorisation demandée, la feuille fermée');
  assert.equal(r.ev('RP'), null);
  /* Rouvrir, changer, fermer sans enregistrer : rien ne change */
  const f = rappel({ store: { 'requete-rappel': '1', 'requete-rappel-heure': '19:00' } });
  f.ev("RP=null;rappelBrouillon();rappelBasculer()");
  assert.equal(f.ev('RP.on'), false);
  f.ev('RP=null');
  assert.deepEqual(f.store, { 'requete-rappel': '1', 'requete-rappel-heure': '19:00' });
  /* Bloquées par le navigateur : la note le dit */
  const b = rappel({ store: { 'requete-rappel': '1' }, perm: 'denied' });
  b.ev('RP=null;rappelBrouillon();rappelPeindre()');
  assert.ok(b.body.innerHTML.includes('<p class="rp-note is-ko">') && b.body.innerHTML.includes('Les notifications sont bloquées pour ce site : autorise-les dans les réglages de ton navigateur.'));
  /* Safari d’iPhone hors écran d’accueil : pas de notifications, on le dit */
  const sn = rappel({ store: { 'requete-rappel': '1' }, sansNotif: true });
  sn.ev('RP=null;rappelBrouillon();rappelPeindre()');
  assert.ok(sn.body.innerHTML.includes('Ce navigateur n’affiche pas de notifications\u00a0: ton rappel ne pourra pas sonner ici.'));
  /* L’ouverture part de ce qui est enregistré, la fermeture oublie le brouillon */
  assert.ok(cut('function openPlusDetails(id){', '\n}\n').includes("if(id==='plus-reminders'){RP=null;rappelBrouillon();rappelPeindre();}"));
  assert.ok(cut('function closePlusDetails(){', '\n}\n').includes("if(id==='plus-reminders')RP=null;"));
  assert.ok(app.includes('<summary><span>Ton rappel d’entraînement</span><small>Quelques minutes suffisent pour progresser. Choisis le moment qui te convient.</small>'));
  for (const k of ['html.lq #scr-compte .rp-seg{display:flex;gap:4px;padding:4px;border-radius:16px;background:#F1EEFB}',
    'html.lq #scr-compte .rp-slot.on{background:#fff;color:var(--accent-ink);', 'html.lq #scr-compte .rp-heures{display:grid;grid-template-columns:repeat(auto-fit,minmax(54px,1fr));',
    'html.lq #scr-compte .rp-heure.on{border-color:var(--accent);background:var(--accent-soft);', 'html.lq #scr-compte .rp-pied{position:sticky;bottom:0;'])
    assert.ok(lq.includes(k), k);
  assert.ok(!app.includes('acc-remind') && !lq.includes('acc-remind') && !app.includes('function toggleRappel('), 'l’ancien réglage est parti');
});

test('réf. 5 : l’onboarding prend le même « À quel moment ? »', () => {
  const carte = cut('function obRappelCarte(){', '\n}\n');
  assert.ok(carte.includes("${rappelChoixHTML(h,'obRappelSlot','obRappelHeure','ob-rappel-l')}") && carte.includes('À quel moment&nbsp;?'));
  assert.ok(!app.includes('OB_RAPPEL_MOMENTS') && !app.includes('ob-rappel-input') && !app.includes('OB_ICO_HEURES'), 'la roue et les quatre moments sont partis');
  for (const k of ['html #onboarding.ob-vitrine .ob-rappel-choix .rp-seg{display:flex;gap:4px;padding:4px;border-radius:14px;background:#F1EFF8}',
    'html #onboarding.ob-vitrine .ob-rappel-choix .rp-heures{display:grid;grid-template-columns:repeat(auto-fit,minmax(46px,1fr));gap:6px;margin-top:9px}',
    'html #onboarding.ob-vitrine.ob-fit-2 .ob-rappel-choix :is(.rp-slot,.rp-heure){min-height:36px}'])
    assert.ok(ob.includes(k), k);
});

test('Joue seul : le pied ne couvre plus les manches, la phrase d’Elisa, et le dégradé du bas mesuré après l’entrée', () => {
  /* 8 novembre, 8 h 21 : la phrase de sa maquette de « Joue seul » remplace « Un défi tiré au sort, pour t’entraîner. » (retours-1016-feuilles). */
  assert.ok(app.includes(":['Mode solo',`Joue ${typeof accord==='function'?accord('seule','seul','seul·e'):'seul·e'}`,'Relève des défis contre la montre.'];") && !app.includes('sans adversaire') && !app.includes('défis SQL à ton rythme'), '8 h 48 : « Enlève sql » ; 23 h 44 : « contre la montre » (retours-2344)');
  assert.ok(lq.includes('html.lq .dx-feuille .dx-f-pied{position:sticky;bottom:-18px;z-index:2;margin:6px -18px -18px;padding:12px 18px 18px;background:#fff}'));
  assert.ok(app.includes("setTimeout(marque,typeof prefersReduceMotion==='function'&&prefersReduceMotion()?0:720);}"));
});

test('le site : « Contacte-nous », le sujet, l’exemple qui suit le sujet, « Envoyer mon message » ; les pages légales et iOS suivent', () => {
  assert.equal((site.match(/<a href="#contact">Contacte-nous<\/a>/g) || []).length, 2, 'le menu et le pied');
  assert.ok(site.includes('<legend>Quel est le sujet de ton message&nbsp;?</legend>') && site.includes('<span>Envoyer mon message</span>'));
  assert.ok(site.includes('aria-describedby="ctex"></textarea>') && site.includes("if(ex)ex.textContent='Ex.\\u00a0: '+(EX[v]||EX['Une question']);"));
  assert.ok(vcss.includes('.ct-ex{margin:-6px 4px 0;font:500 13.5px/1.45 var(--ui);color:var(--ink-3);text-wrap:pretty}'));
  const v = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'decouvrir/vitrine.css'))).digest('hex').slice(0, 8);
  for (const f of ['index.html', 'conditions.html', 'confidentialite.html', 'mentions-legales.html', 'module.html', 'connexion.html'])
    assert.ok(lire('decouvrir/' + f).includes(`vitrine.css?v=${v}`), `${f} : la feuille du site à jour`);
  /* 6 novembre : les conditions (l’app pour iPhone, plus « bientôt ») et la confidentialité (les durées de conservation) changent */
  for (const [f, jour] of [['conditions.html', 6], ['mentions-legales.html', 5], ['confidentialite.html', 6]]) {
    const p = lire('decouvrir/' + f);
    assert.ok(p.includes('«&nbsp;Contacte-nous&nbsp;»') && !p.includes('Nous contacter') && p.includes(`Dernière mise à jour&nbsp;: ${jour} novembre 2026`), f);
  }
  const ios = lire('scripts/ios-widget.mjs');
  assert.ok(ios.includes("['NSCameraUsageDescription', 'Pour joindre une photo à ton message dans « Contacte-nous ».']"));
});

test('les versions', () => {
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=260">') && app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=39">') && sw.includes("'./onboarding-vitrine.css?v=39',"));
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  assert.ok(cache === 'requete-2026-11-09-pas-tout-a-fait-v2718' && app.includes(`const SW_CACHE='${cache}';`));
});
