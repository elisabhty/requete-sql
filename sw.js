/* Service worker de Requête.

   Objectif : l'app démarre sans réseau. Le moteur SQL (sql-wasm.wasm) et la
   page elle-même sont mis en cache au premier passage.

   Stratégies :
   - navigations (index.html) → réseau d'abord, cache en repli. Une nouvelle
     version se voit donc dès qu'il y a du réseau, sans coincer hors ligne.
   - reste des fichiers du site → cache d'abord, réseau en repli, et la réponse
     réseau est rangée au passage.
   - domaines tiers (polices) → jamais interceptés : on laisse le navigateur
     échouer seul plutôt que de faire attendre le service worker.

  CACHE change à chaque déploiement des ressources. APP_VERSION concerne
  les données utilisateur : ne pas le modifier pour un rafraîchissement. */

const CACHE = 'requete-2026-10-12-ludique-v2076';

const PRECACHE = [
  './',
  './index.html',
  './home-journey.css',
  './manifest.webmanifest',
  './anim-responsive.css',
  './ux-polish.css',
  './design-premium.css',
  './design-premium.js',
  './ludique.css',
  './assets/fonts/bricolage-grotesque-bold.woff2',
  './assets/fonts/bricolage-grotesque-regular.woff2',
  './vendor/sqljs/sql-wasm.js',
  './vendor/sqljs/sql-wasm.wasm',
  './assets/mascotte-requete.png',
  './assets/mascotte-coucou.jpg',
  './assets/apple-touch-icon.png',
  './assets/icon-192.png',
  './assets/nutriboost-accueil.png',
  /* Cours en animation (lecteur du cours) : disponibles hors ligne. */
  './assets/anim/bases-relationnelles.html?app&embed',
  './assets/anim/where.html?app&embed',
  './assets/anim/as.html?app&embed',
  './assets/anim/distinct.html?app&embed',
  './assets/anim/comparer.html?app&embed',
  './assets/anim/and-or.html?app&embed',
  './assets/anim/not.html?app&embed',
  './assets/anim/null.html?app&embed',
  './assets/anim/like.html?app&embed',
  './assets/anim/in.html?app&embed',
  './assets/anim/between.html?app&embed',
  './assets/anim/order-by.html?app&embed',
  './assets/anim/limit-offset.html?app&embed',
  './assets/anim/fonctions-texte.html?app&embed',
  './assets/anim/fonctions-numeriques.html?app&embed',
  './assets/anim/fonctions-dates.html?app&embed',
  './assets/anim/conversion-types.html?app&embed',
  './assets/anim/case.html?app&embed',
  './assets/anim/coalesce.html?app&embed',
  './assets/anim/count.html?app&embed',
  './assets/anim/group-by.html?app&embed',
  './assets/anim/having.html?app&embed',
  './assets/anim/group-concat.html?app&embed',
  './assets/anim/inner-join.html?app&embed',
  './assets/anim/left-join.html?app&embed',
  './assets/anim/right-join.html?app&embed',
  './assets/anim/full-outer-join.html?app&embed',
  './assets/anim/cross-join.html?app&embed',
  './assets/anim/jointure-3-tables.html?app&embed',
  './assets/anim/join-group-by.html?app&embed',
  './assets/anim/self-join.html?app&embed',
  './assets/anim/plusieurs-conditions-on.html?app&embed',
  './assets/anim/quel-join-choisir.html?app&embed',
  './assets/anim/sous-requete-in.html?app&embed',
  './assets/anim/sous-requete-select.html?app&embed',
  './assets/anim/sous-requete-from.html?app&embed',
  './assets/anim/exists.html?app&embed',
  './assets/anim/with-cte.html?app&embed',
  './assets/anim/union.html?app&embed',
  './assets/anim/intersect-except.html?app&embed',
  './assets/anim/with-recursive.html?app&embed',
  './assets/anim/over.html?app&embed',
  './assets/anim/fonctions-rang.html?app&embed',
  './assets/anim/lag-lead.html?app&embed',
  './assets/anim/fenetres-glissantes.html?app&embed',
  './assets/anim/projet-normaliser.html?app&embed',
  './assets/anim/projet-cles.html?app&embed',
  './assets/anim/projet-uml.html?app&embed',
  './assets/anim/projet-create.html?app&embed',
  './assets/anim/projet-alter.html?app&embed',
  './assets/anim/projet-drop.html?app&embed',
  './assets/anim/projet-insert.html?app&embed',
  './assets/anim/projet-update.html?app&embed',
  './assets/anim/projet-delete.html?app&embed',
  './assets/anim/projet-ondelete.html?app&embed',
  './assets/anim/projet-transaction.html?app&embed',
  './assets/anim/projet-savepoint.html?app&embed',
  './assets/anim/projet-trigger.html?app&embed',
  './assets/anim/projet-concurrence.html?app&embed',
  './assets/anim/projet-vue.html?app&embed',
  './assets/anim/projet-index.html?app&embed',
  './assets/anim/projet-droits.html?app&embed',
  './assets/anim/core.css',
  './assets/anim/core.js',
  './assets/anim/moments.js',
  './assets/anim/gsap.min.js',
  './assets/anim/mascotte.webp',
  './assets/anim/bases-relationnelles-thumb.webp',
  './assets/anim/where-thumb.jpg',
  './assets/anim/as-thumb.jpg',
  './assets/anim/distinct-thumb.jpg',
  './assets/anim/comparer-thumb.jpg',
  './assets/anim/and-or-thumb.jpg',
  './assets/anim/not-thumb.jpg',
  './assets/anim/null-thumb.jpg',
  './assets/anim/like-thumb.jpg',
  './assets/anim/in-thumb.jpg',
  './assets/anim/between-thumb.jpg',
  './assets/anim/order-by-thumb.jpg',
  './assets/anim/limit-offset-thumb.jpg',
  './assets/anim/fonctions-texte-thumb.jpg',
  './assets/anim/fonctions-numeriques-thumb.jpg',
  './assets/anim/fonctions-dates-thumb.jpg',
  './assets/anim/conversion-types-thumb.jpg',
  './assets/anim/case-thumb.jpg',
  './assets/anim/coalesce-thumb.jpg',
  './assets/anim/count-thumb.jpg',
  './assets/anim/group-by-thumb.jpg',
  './assets/anim/having-thumb.jpg',
  './assets/anim/group-concat-thumb.jpg',
  './assets/anim/inner-join-thumb.jpg',
  './assets/anim/left-join-thumb.jpg',
  './assets/anim/right-join-thumb.jpg',
  './assets/anim/full-outer-join-thumb.jpg',
  './assets/anim/cross-join-thumb.jpg',
  './assets/anim/jointure-3-tables-thumb.jpg',
  './assets/anim/join-group-by-thumb.jpg',
  './assets/anim/self-join-thumb.jpg',
  './assets/anim/plusieurs-conditions-on-thumb.jpg',
  './assets/anim/quel-join-choisir-thumb.jpg',
  './assets/anim/sous-requete-in-thumb.jpg',
  './assets/anim/sous-requete-select-thumb.jpg',
  './assets/anim/sous-requete-from-thumb.jpg',
  './assets/anim/exists-thumb.jpg',
  './assets/anim/with-cte-thumb.jpg',
  './assets/anim/union-thumb.jpg',
  './assets/anim/intersect-except-thumb.jpg',
  './assets/anim/with-recursive-thumb.jpg',
  './assets/anim/over-thumb.jpg',
  './assets/anim/fonctions-rang-thumb.jpg',
  './assets/anim/lag-lead-thumb.jpg',
  './assets/anim/fenetres-glissantes-thumb.jpg',
  './assets/anim/projet-normaliser-thumb.jpg',
  './assets/anim/projet-cles-thumb.jpg',
  './assets/anim/projet-uml-thumb.jpg',
  './assets/anim/projet-create-thumb.webp',
  './assets/anim/projet-alter-thumb.webp',
  './assets/anim/projet-drop-thumb.jpg',
  './assets/anim/projet-insert-thumb.webp',
  './assets/anim/projet-update-thumb.webp',
  './assets/anim/projet-delete-thumb.webp',
  './assets/anim/projet-ondelete-thumb.webp',
  './assets/anim/projet-transaction-thumb.webp',
  './assets/anim/projet-transaction-shaker.webp',
  './assets/anim/projet-savepoint-thumb.webp',
  './assets/anim/projet-savepoint-colis.webp',
  './assets/anim/projet-trigger-thumb.webp',
  './assets/anim/projet-concurrence-thumb.webp',
  './assets/anim/projet-concurrence-atelier.webp',
  './assets/anim/projet-vue-thumb.webp',
  './assets/anim/projet-vue-box.webp',
  './assets/anim/projet-index-thumb.webp',
  './assets/anim/projet-index-scan.webp',
  './assets/anim/projet-droits-thumb.webp',
  './assets/anim/projet-droits-lina.webp',
  './assets/anim/projet-droits-equipe.webp',
  './assets/fonts/jetbrains-mono.woff2',
  './assets/fonts/inter-medium.woff2',
  './assets/fonts/inter-semibold.woff2',
  './assets/fonts/inter-bold.woff2',
  './assets/fonts/inter-extrabold.woff2',
];

/* Deux temps (Elisa, 26 octobre, 22 h 20 : « les vidéos mettent du temps à charger au début maintenant »).
   Avant, chaque nouvelle version téléchargeait d’un coup les 157 fichiers (11,6 Mo, dont toutes les animations
   et leurs images), en parallèle : juste après une mise en ligne, la vidéo ouverte attendait derrière eux.
   - à l’installation : seulement le cœur de l’app (page, styles, polices, moteur SQL, moteur des animations) ;
   - ensuite, quand la page le demande (message « warm », quelques secondes après son ouverture) : les animations
     et leurs images, deux à la fois, en sautant celles déjà rangées. Une vidéo ouverte entre-temps passe devant. */
const EN_FOND = (url) => url.includes('/assets/anim/') && !/\.(js|css)$/.test(url.split('?')[0]);
const COEUR = PRECACHE.filter((url) => !EN_FOND(url));
const ANIMS = PRECACHE.filter(EN_FOND);

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll échoue en bloc si un seul fichier manque : on tolère les absents.
    await Promise.all(COEUR.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

let rangement = null;
async function rangerAnims(){
  const cache = await caches.open(CACHE);
  const file = ANIMS.slice();
  const suivant = async () => {
    for (let url = file.shift(); url; url = file.shift()) {
      if (await cache.match(url)) continue;
      try { await cache.add(new Request(url, { cache: 'reload' })); } catch (err) {}
    }
  };
  await Promise.all([suivant(), suivant()]);
}
self.addEventListener('message', (e) => {
  if (e.data !== 'warm') return;
  if (!rangement) rangement = rangerAnims().finally(() => { rangement = null; });
  e.waitUntil(rangement);
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    /* La page de l’app est rechargée : une version précédente du worker pouvait y
       ranger la page d’une animation de cours (chargée dans un cadre). */
    try { const cache = await caches.open(CACHE); await cache.add(new Request('./index.html', { cache: 'reload' })); } catch (err) {}
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // polices et CDN : non interceptés

  /* Ne jamais intercepter le script du worker lui-même : une réponse en
     cache (ou une erreur de repli) empêcherait toute mise à jour future —
     constaté sur une ancienne version restée bloquée plusieurs jours. */
  if (url.pathname.endsWith('/sw.js')) return;

  /* Vidéos : Safari iOS les demande par morceaux (en-tête Range) et refuse
     une réponse complète servie depuis le cache. On laisse le navigateur
     les charger lui-même ; hors ligne, l’image fixe (poster) s’affiche. */
  if (url.pathname.endsWith('.mp4')) return;

  /* Animations des cours, chargées dans un cadre par le lecteur, et pages des cours
     interactifs (assets/projet/) : réseau d’abord, rangées sous leur propre adresse —
     surtout pas sous index.html, sinon l’app hors ligne s’ouvrirait sur cette page. */
  if (req.mode === 'navigate' && (req.destination === 'iframe' || url.pathname.includes('/assets/anim/') || url.pathname.includes('/assets/projet/'))) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: 'reload' });
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }

  /* Moteur commun des animations (core.js, core.css) : réseau d’abord lui aussi, en revalidant
     auprès du serveur — une page d’animation à jour ne doit jamais tourner avec un moteur resté
     en cache. Hors ligne, la copie rangée prend le relais. */
  if (url.pathname.includes('/assets/anim/') && /\.(js|css)$/.test(url.pathname) && !url.pathname.endsWith('/gsap.min.js')) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(req, { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'reload' });
        const cache = await caches.open(CACHE);
        cache.put('./index.html', res.clone());
        return res;
      } catch (err) {
        const cache = await caches.open(CACHE);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') {
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      return Response.error();
    }
  })());
});
