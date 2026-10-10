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

const CACHE = 'requete-2026-10-08-ludique-v1720';

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
  './assets/anim/where.html?app&embed',
  './assets/anim/select.html?app&embed',
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
  './assets/anim/core.css',
  './assets/anim/core.js',
  './assets/anim/gsap.min.js',
  './assets/anim/mascotte.webp',
  './assets/anim/where-thumb.jpg',
  './assets/anim/select-thumb.jpg',
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
  './assets/fonts/jetbrains-mono.woff2',
  './assets/fonts/inter-medium.woff2',
  './assets/fonts/inter-semibold.woff2',
  './assets/fonts/inter-bold.woff2',
  './assets/fonts/inter-extrabold.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll échoue en bloc si un seul fichier manque : on tolère les absents.
    await Promise.all(PRECACHE.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    ));
    await self.skipWaiting();
  })());
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

  /* Animations des cours, chargées dans un cadre par le lecteur : réseau d’abord,
     rangées sous leur propre adresse — surtout pas sous index.html, sinon l’app
     hors ligne s’ouvrirait sur l’animation. */
  if (req.mode === 'navigate' && (req.destination === 'iframe' || url.pathname.includes('/assets/anim/'))) {
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
