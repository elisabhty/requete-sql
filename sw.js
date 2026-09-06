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

const CACHE = 'requete-2026-09-06-comparer-situation-prix-v341';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './viz-select.js',
  './viz-select.css',
  './viz-where.js',
  './viz-where.css',
  './viz-orderby.js',
  './viz-orderby.css',
  './anim-responsive.css',
  './lesson-cases.js',
  './lesson-case-view.js',
  './lesson-cases.css',
  './vendor/sqljs/sql-wasm.js',
  './vendor/sqljs/sql-wasm.wasm',
  './assets/mascotte-requete.png',
  './assets/nutriboost-accueil.png',
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
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // polices et CDN : non interceptés

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
