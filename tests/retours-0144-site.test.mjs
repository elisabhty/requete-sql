/* Elisa, 13 novembre, 1 h 44 : « maintenant update mon site internet je veux retirer l’appli sur mon site quand on appuie sur
   commencer et faire descendre vers l’appli et update les pages données confidencialité etc ». Ses trois choix : « Tout retirer »
   (plus d’appli dans le navigateur, plus de « Se connecter » ; un lien d’invitation mène au site), « La garder, autre bouton »
   (la vidéo reste, derrière « Voir la vidéo » ; sa fin mène à la section iPhone), « Publier tout de suite ».
   - index.html (l’appli) : dans un navigateur, l’adresse mène toujours à decouvrir/ ; l’ancienne appli gardée hors ligne est retirée.
     Restent l’app iPhone (Capacitor), le local (la mise au point) et les navigateurs pilotés (les tests). Le script de tête lui-même
     est exécuté dans retours-1400.test.mjs.
   - Le site : chaque « Commencer » descend à la section iPhone (#mobile) ; plus aucun lien vers l’appli ni vers la connexion.
   - La FAQ, la confidentialité et les conditions disent ce que fait l’app : compte Apple ou Google, abonnement Requête Premium par
     l’App Store (RevenueCat), progression sur l’iPhone et dans le compte. Aucun prix sur le site.
   Vérifié dans un navigateur (393 × 852 et 1280 × 800) : les cinq pages sans lien cassé ni erreur, « Commencer » et les objectifs
   descendent à la section iPhone, le menu ouvre la vidéo, « Passer la vidéo » revient à la section iPhone, connexion.html renvoie,
   ?partie=pret02 affiche le code PRET02 (et rien sans code), et l’adresse de l’appli hors local mène au site. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');
const PAGES = ['index.html', 'module.html', 'conditions.html', 'confidentialite.html', 'mentions-legales.html'];
const site = Object.fromEntries([...PAGES, 'video.html', 'connexion.html'].map(f => [f, lire('decouvrir/' + f)]));
const texte = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const corps = f => texte(/<main>[\s\S]*<\/main>/.exec(site[f])[0]);

test('l’appli : dans un navigateur, son adresse mène au site ; elle ne s’y garde plus hors ligne', () => {
  const tete = app.slice(app.indexOf('<script>(function(){try{var q=location.search'), app.indexOf('</script>', app.indexOf('<script>(function(){try{var q=location.search')));
  assert.ok(app.indexOf(tete) < app.indexOf('<meta name="viewport"'), 'avant tout le reste');
  assert.ok(tete.includes("if(window.Capacitor||navigator.webdriver||!/^https?:$/.test(location.protocol)||h==='localhost'||h==='127.0.0.1')return;"), 'l’app iPhone, le local et les tests gardent l’appli');
  assert.ok(tete.includes("location.replace('decouvrir/'+(m?'?partie='+m[1].toUpperCase()+'#mobile':''));"));
  assert.ok(tete.includes('r.unregister();') && tete.includes('caches.delete(k);'), 'l’ancienne appli hors ligne est retirée');
  for (const vieux of ['rq-vu-appli', 'display-mode: standalone', '[?&]app\\b', "getItem('requete-sql-v3')"]) assert.ok(!tete.includes(vieux), vieux);
  /* La page qui part vers le site n’enregistre pas son service worker en chemin */
  assert.ok(tete.includes('window.__rqVersSite=1;'));
  const sw = app.slice(app.indexOf("window.addEventListener('load',()=>{", app.indexOf("const SW_CACHE='")), app.indexOf('setTimeout(ranger,8000);'));
  assert.ok(sw.indexOf('if(window.__rqVersSite)return;') > 0 && sw.indexOf('if(window.__rqVersSite)return;') < sw.indexOf("navigator.serviceWorker.register('sw.js?'"));
  assert.ok(app.includes('<meta name="description" content="Apprends le SQL en écrivant des requêtes sur une vraie base. Leçons courtes, défis pratiques et console SQL, dans l’appli Requête pour iPhone.">'));
});

test('le site : « Commencer » descend à la section iPhone, plus aucun lien vers l’appli ni vers la connexion', () => {
  for (const f of PAGES) {
    const h = site[f], ici = f === 'index.html' ? '#mobile' : './#mobile';
    assert.doesNotMatch(h, /href="\.\.\/(?:\?[^"]*)?"|href="\.\.\/index\.html|\?depuis=|connexion\.html|>Se connecter</, `${f} : plus de chemin vers l’appli`);
    const cta = h.slice(h.indexOf('<div class="nav-cta">'), h.indexOf('<button type="button" class="burger"'));
    assert.ok(cta.includes(`<a class="btn btn-p" href="${ici}">Commencer</a>`), `${f} : la barre`);
    const menu = h.slice(h.indexOf('<nav class="menu" id="menu"'), h.indexOf('</nav>', h.indexOf('<nav class="menu" id="menu"')));
    assert.ok(menu.includes('<a class="btn btn-s btn-lg" href="video.html">Voir la vidéo</a>'), `${f} : la vidéo, derrière son bouton`);
    const pied = h.slice(h.indexOf('<footer>'), h.indexOf('</footer>'));
    assert.ok(pied.includes(`<a href="${ici}">Commencer</a>`) && pied.includes(`<a href="${ici}">Requête sur iPhone</a>`) && !pied.includes('Requête sur mobile'), `${f} : le pied`);
    assert.ok(pied.includes('aria-label="Télécharger dans l’App Store"'), `${f} : le badge de l’App Store`);
  }
  const h = site['index.html'];
  assert.ok(h.includes('id="mobile"') && h.includes('<h2 id="mobile-h">Requête, <em>dans ta poche</em>.</h2>'), 'la section où tout descend');
  assert.equal((h.match(/<a class="g(?: wide)?" href="#mobile" data-goal="\w+">/g) || []).length, 5, 'les cinq objectifs');
  assert.ok(h.includes('<a class="poster more" href="#mobile">') && h.includes('<a class="btn btn-p btn-lg" href="#mobile">'), 'l’affiche « +55 autres cours » et le dernier bouton');
  assert.ok(!/href="video\.html"[^>]*data-goal/.test(h) && !h.includes('rq-vitrine-objectif\',') && !h.includes("localStorage.setItem('rq-vitrine-objectif'"), 'un objectif ne mène plus à la vidéo, et n’est plus gardé');
  assert.ok(site['module.html'].includes('<a class="btn btn-p btn-lg" href="./#mobile">') && site['module.html'].includes('<a class="alt" href="video.html">Voir la vidéo'));
});

test('le site ne garde plus l’ancienne appli hors ligne : caches vidés, service worker retiré, un seul rechargement', () => {
  for (const f of PAGES) {
    const h = site[f];
    assert.ok(!/serviceWorker\.register\(/.test(h), `${f} : rien n’est enregistré`);
    const i = h.indexOf('var sw=navigator.serviceWorker;'), bloc = h.slice(h.lastIndexOf('(function(){', i), h.indexOf('})();', i) + 5);
    assert.ok(i > 0, f);
    /* Exécuté : un ancien service worker aux commandes → tout est retiré, puis un rechargement, un seul */
    const jouer = ({ controle, deja = false, sans = false }) => {
      const fait = [], ss = new Map(deja ? [['rq-vitrine-maj', '1']] : []);
      const promis = v => ({ then: f1 => { const r = f1(v); return r && r.then ? r : promis(r); }, catch: () => promis(v) });
      const caches = { keys: () => promis(['requete-2026-11-13']), delete: k => fait.push('cache ' + k) };
      const ctx = vm.createContext({ window: { caches }, caches, Promise: { all: a => promis(a) },
        navigator: sans ? {} : { serviceWorker: { controller: controle ? {} : null, getRegistrations: () => promis([{ unregister: () => { fait.push('retiré'); } }]) } },
        sessionStorage: { getItem: k => ss.get(k) ?? null, setItem: (k, v) => ss.set(k, v) }, location: { reload: () => fait.push('rechargé') } });
      vm.runInContext(bloc, ctx);
      return fait;
    };
    assert.deepEqual(jouer({ controle: true }), ['cache requete-2026-11-13', 'retiré', 'rechargé'], f);
    assert.deepEqual(jouer({ controle: true, deja: true }), ['cache requete-2026-11-13', 'retiré'], `${f} : pas de boucle`);
    assert.deepEqual(jouer({ controle: false }), ['cache requete-2026-11-13', 'retiré'], `${f} : rien aux commandes, pas de rechargement`);
    assert.deepEqual(jouer({ sans: true }), ['cache requete-2026-11-13'], `${f} : sans service worker`);
  }
});

test('l’accueil du site dit ce qu’est Requête : une appli pour iPhone, avec un compte', () => {
  const h = site['index.html'];
  assert.ok(h.includes('<meta name="description" content="71 cours courts en vidéo interactive, un labo SQL et tes propres données pour apprendre le SQL à ton rythme, du débutant à l’avancé. L’appli pour iPhone, à télécharger dans l’App Store.">'));
  assert.ok(h.includes('<h3>Un labo SQL dans ta poche</h3>') && h.includes('</svg><span><span>Appli</span> <span>iPhone</span></span></li>'));
  /* La FAQ : la même réponse dans les données structurées et à l’écran */
  const faq = JSON.parse([...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]).find(j => j.includes('"FAQPage"')));
  const reponse = q => faq.mainEntity.find(x => x.name === q).acceptedAnswer.text;
  const ecran = Object.fromEntries([...h.matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)].map(m => [texte(m[1]).trim(), texte(m[2]).trim()]));
  const attendu = {
    'Une installation est-elle nécessaire ?': 'Oui. Requête est une application pour iPhone, à télécharger dans l’App Store. Elle exécute SQL sur une vraie base SQLite, directement sur ton iPhone. Une fois ton compte connecté, les cours se suivent aussi hors ligne ; la sauvegarde de ta progression et les défis entre amis demandent une connexion internet.',
    'Un compte est-il nécessaire pour utiliser Requête ?': 'Oui. Tu te connectes en un geste avec Apple ou Google, sans mot de passe à créer. Ta progression est alors sauvegardée dans ton compte.',
    'Où sont enregistrées ma progression et mes notes ?': 'Sur ton iPhone et dans ton compte : tes leçons validées, tes défis réussis, ton planning et tes notes y sont sauvegardés, pour les retrouver sur un autre iPhone ou après une réinstallation. Les fichiers que tu importes, eux, restent sur ton iPhone.',
    'Puis-je utiliser Requête sur mon téléphone ?': 'Oui, sur iPhone : Requête est une application à part entière, à télécharger dans l’App Store. La version Android arrive bientôt, sur Google Play.',   // 2 h 41 : « bientôt pour Google Play »
  };
  for (const [q, r] of Object.entries(attendu)) { assert.equal(reponse(q), r, q); assert.equal(ecran[q], r, q + ' (à l’écran)'); }
  for (const q of faq.mainEntity) assert.equal(ecran[q.name], q.acceptedAnswer.text, q.name);
  const tout = texte(h);
  for (const vieux of ['dans ton navigateur', 'Aucune installation', 'sans compte', 'Sans compte', 'écran d’accueil', 'sur ordinateur']) assert.ok(!tout.includes(vieux), vieux);
  /* La fiche d’un parcours */
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(lire('decouvrir/modules.js'), ctx);
  const details = Object.fromEntries(ctx.window.MODULES.find(m => m.id === 'sql').details);
  assert.equal(details.appareil, 'Sur iPhone');
  assert.ok(site['module.html'].includes('<span>sur ton iPhone, même hors ligne</span>') && !texte(site['module.html']).includes('navigateur'));
});

test('une invitation à un défi (?partie=CODE) : la section iPhone redit le code, et reste muette sans code', () => {
  const h = site['index.html'];
  assert.ok(h.includes('<p class="mob-now mob-inv" id="mob-inv" hidden style="display:none">'), 'cachée aussi par son style (.mob-now l’emporte sur [hidden])');
  assert.ok(h.includes('<span>Tu es invité·e à un défi. Installe Requête, puis entre le code <b id="mob-inv-code"></b> dans Pratiquer&nbsp;› Défis&nbsp;› «&nbsp;Rejoindre avec un code&nbsp;».</span>'));
  assert.ok(app.includes("${b('code','rocket','Rejoindre avec un code')}") && app.includes('<span class="tab-label">Pratiquer</span>'), 'les mots de l’app');
  const i = h.indexOf("var g=document.getElementById('goals');"), bloc = h.slice(h.lastIndexOf('(function(){', i), h.indexOf('})();', i) + 5);
  const ouvrir = search => {
    const inv = { hidden: true, style: { display: 'none' } }, code = { textContent: '' }, oublie = [];
    const els = { goals: { addEventListener() {}, querySelectorAll: () => [] }, 'mob-inv': inv, 'mob-inv-code': code };
    vm.runInContext(bloc, vm.createContext({ document: { getElementById: k => els[k] }, location: { search }, localStorage: { removeItem: k => oublie.push(k) } }));
    return { cache: inv.hidden, display: inv.style.display, code: code.textContent, oublie };
  };
  assert.deepEqual(ouvrir('?partie=pret02&de=elisa_sql'), { cache: false, display: '', code: 'PRET02', oublie: ['rq-vitrine-objectif'] });
  assert.deepEqual(ouvrir(''), { cache: true, display: 'none', code: '', oublie: ['rq-vitrine-objectif'] });
  assert.equal(ouvrir('?partie=PRE02').cache, true, 'un code abîmé : rien');
  /* L’app partage toujours l’adresse du site */
  assert.ok(app.includes("const base=location.protocol.startsWith('http')?location.origin+location.pathname:'https://requeteapp.com/';"));
});

test('la vidéo reste sur le site, et ramène à la section iPhone ; la page de connexion n’est plus qu’un renvoi', () => {
  const v = site['video.html'];
  assert.ok(v.includes('<a class="pill" href="./#mobile" aria-label="Passer la vidéo">') && v.includes('<div id="end">\n  <a href="./#mobile">Commencer'));
  assert.doesNotMatch(v, /\?depuis=|connexion\.html|class="pill login"|vd-leave/);
  const cx = site['connexion.html'];
  assert.ok(cx.includes('<meta http-equiv="refresh" content="0; url=./#mobile">') && cx.includes("<script>location.replace('./#mobile');</script>") && cx.includes('<meta name="robots" content="noindex">'));
  assert.ok(cx.length < 1500 && !cx.includes('<form'), 'plus de formulaire');
  /* L’app iPhone embarque toujours la vidéo (scripts/build-www.mjs) : ses liens restent dans le dossier embarqué */
  assert.ok(lire('scripts/build-www.mjs').includes("'decouvrir/video.html'"));
});

test('confidentialité : l’appli sur iPhone, le compte, l’abonnement par l’App Store et RevenueCat', () => {
  const p = site['confidentialite.html'], t = corps('confidentialite.html');
  assert.ok(p.includes('<p class="lead">Requête est une appli pour iPhone&nbsp;: tu t’y connectes avec Apple ou Google, et ton compte sauvegarde ta progression. Ce site, lui, la présente. Voici précisément ce qui circule, et pourquoi.</p>'));
  assert.ok(p.includes('<p class="lg-maj">Dernière mise à jour&nbsp;: 13 novembre 2026</p>'));
  assert.ok(p.includes('sont enregistrés dans l’appli, sur ton iPhone. Une partie est aussi sauvegardée avec ton compte (voir «&nbsp;Ton compte&nbsp;»)&nbsp;; ce qui sort de ton iPhone est détaillé plus bas.</p>'));
  assert.ok(p.includes('sont lus et transformés en tables directement sur ton iPhone&nbsp;: ils ne quittent pas ton appareil.'));
  assert.ok(p.includes('<li><a href="#compte">Ton compte</a></li>') && p.includes('<li><a href="#abonnement">Abonnement Requête Premium</a></li>'), 'le sommaire suit les titres');
  /* L’hébergement : le site, et le fichier des rappels que l’app y relit */
  assert.ok(p.includes('<li><b>Hébergement du site.</b> Ce site est hébergé par GitHub Pages (GitHub, Inc., États-Unis)') && p.includes('L’appli y relit aussi, au plus deux fois par jour, la liste des messages de ses rappels'));
  assert.ok(app.includes("const RAPPEL_URL='https://requeteapp.com/rappels.json'"), 'ce que fait l’app');
  assert.ok(!t.includes('Google Fonts') && !/fonts\.(googleapis|gstatic)/.test(app), 'plus de polices de Google, dans l’app non plus');
  /* L’abonnement, tel qu’il est branché (achat.js : pas d’identifiant de compte donné à RevenueCat) */
  const abo = /<section id="abonnement">[\s\S]*?<\/section>/.exec(p)[0];
  assert.ok(abo.includes('<h2>Abonnement Requête Premium</h2>') && abo.includes('le paiement passe par l’App Store d’Apple&nbsp;: nous ne recevons jamais tes coordonnées bancaires.'));
  assert.ok(abo.includes('Il reçoit un identifiant d’achat anonyme créé sur ton iPhone') && abo.includes('ni ton nom, ni ton e-mail, ni ton compte Requête.'));
  assert.ok(abo.includes('<a href="https://www.revenuecat.com/privacy" target="_blank" rel="noopener">politique de confidentialité de RevenueCat</a>'));
  assert.ok(abo.includes('Supprimer ton compte Requête ne résilie pas l’abonnement&nbsp;: il se gère depuis Mon compte › «&nbsp;Gérer mon abonnement&nbsp;», ou dans les réglages de ton identifiant Apple.'));
  const achat = lire('achat.js');
  assert.ok(achat.includes('var demarre = P.configure({apiKey: RC_CLE_IOS});') && !/logIn\(|setEmail\(|setAttributes\(|appUserID/.test(achat), 'un achat sans identifiant de compte');
  assert.ok(!/\b(sera|passera|recevrons|seront)\b/.test(texte(abo)), 'au présent : l’abonnement existe');
  /* Les cookies, les droits */
  assert.ok(p.includes('ni outil de mesure d’audience d’un tiers, ni pixel de suivi. Le seul décompte est celui des écrans de l’accueil, fait par Requête elle-même (voir plus haut). Ce site ne dépose aucun cookie. Dans l’appli, le seul stockage utilisé'));
  assert.ok(p.includes('Ce qui ne quitte jamais ton iPhone (tes bases et fichiers importés, tes réglages), nous ne pouvons ni le consulter ni le supprimer à ta place&nbsp;: c’est toi qui le gardes.'));
  assert.ok(p.includes('<b>Rappel quotidien.</b> Il ne s’active que si tu autorises les notifications sur ton iPhone'));
  for (const vieux of ['Sans compte', 'sans compte', 'stockage local de ton navigateur', 'dans ton navigateur', 'ou sur le site', 'appli iOS', '(appli iPhone)', 'hors ligne']) assert.ok(!t.includes(vieux), vieux);
});

test('conditions : une appli pour iPhone, un compte, l’abonnement Requête Premium ; aucun prix sur le site', () => {
  const p = site['conditions.html'], t = corps('conditions.html');
  assert.ok(p.includes('<p class="lead">Les règles pour utiliser Requête, et celles de l’abonnement Requête Premium.</p>') && p.includes('<p class="lg-maj">Dernière mise à jour&nbsp;: 13 novembre 2026</p>'));
  assert.ok(p.includes('<p>Requête est une application pour iPhone, à télécharger dans l’App Store&nbsp;; ce site la présente. Pour l’utiliser, tu te connectes avec Apple ou avec Google, puis tu choisis un abonnement Requête Premium (voir plus bas). Il faut une connexion internet pour te connecter et t’abonner&nbsp;; ensuite, les cours se suivent aussi hors ligne.</p>'));
  assert.ok(p.includes('<p>Ta progression est enregistrée sur ton iPhone et sauvegardée avec ton compte. Les fichiers que tu importes restent sur ton iPhone, et restent à toi.'));
  assert.ok(p.includes('Tu peux aussi supprimer ton compte depuis l’appli (Mon compte, «&nbsp;Supprimer mon compte&nbsp;»).'));
  const abo = /<section id="premium">[\s\S]*?<\/section>/.exec(p)[0];
  assert.ok(abo.includes('<h2>Abonnement Requête Premium</h2><p>L’accès aux cours et à la pratique demande un abonnement Requête Premium, vendu dans l’appli par l’intermédiaire de l’App Store. Avant tout achat, l’appli affiche le prix, la durée de l’abonnement et ses conditions de renouvellement.</p>'));
  assert.ok(abo.includes('depuis Mon compte › «&nbsp;Gérer mon abonnement&nbsp;» ou les réglages de ton identifiant Apple.</li>') && abo.includes('<li>Supprimer ton compte Requête ne résilie pas l’abonnement.</li>'));
  assert.ok(app.includes('abonnementGerer()') && app.includes("startOnboarding('paywall');"), 'ce que fait l’app : « Gérer mon abonnement », et le paywall sans abonnement');
  for (const vieux of ['dans un navigateur', 'Un compte n’est pas nécessaire', 'pourra être réservée', 'quand il arrivera', 'appli iOS', 'Effacer les données de ton navigateur']) assert.ok(!t.includes(vieux), vieux);
  /* Aucun prix, ni « bientôt », dans ce que le site dit de l’appli et de l’abonnement */
  for (const f of ['conditions.html', 'confidentialite.html', 'mentions-legales.html']) {
    assert.doesNotMatch(corps(f), /\d\s?€|44,99|5,99|[Bb]ientôt|[Pp]rochainement/, f);
  }
  for (const f of PAGES) assert.doesNotMatch(site[f], /44,99|5,99/, f + ' : pas de prix');
});

test('dans l’app, les feuilles légales de secours ne parlent plus de navigateur ni d’usage sans compte', () => {
  const ouvrir = app.slice(app.indexOf('function openLegal(kind){'), app.indexOf("const sheet=document.getElementById('card-sheet');", app.indexOf('function openLegal(kind){')));
  assert.ok(ouvrir.includes('if(LEGAL_PAGES[kind]&&openLegalSite(kind))return;'), 'les pages légales sont celles du site');
  assert.ok(ouvrir.includes('Tu t’y connectes avec Apple ou Google&nbsp;: ta progression est enregistrée sur cet iPhone et sauvegardée avec ton compte.</p>'));
  assert.ok(ouvrir.includes('<p>L’accès aux leçons, aux défis et aux outils de pratique demande un abonnement Requête Premium, vendu par l’App Store.</p>'));
  assert.doesNotMatch(ouvrir, /sans compte|navigateur\)|dans le navigateur|Le compte est optionnel/);
  const integree = app.slice(app.indexOf("const privacy=obLegalMode==='privacy';"), app.indexOf("}else if(slide==='welcome'){", app.indexOf("const privacy=obLegalMode==='privacy';")));
  assert.doesNotMatch(integree, /sans compte|dans ton navigateur|aucun service de connexion/);
});
