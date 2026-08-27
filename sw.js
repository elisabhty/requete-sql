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

   CACHE doit changer à chaque déploiement pour purger l'ancien contenu :
   garde-le aligné sur APP_VERSION dans index.html. */

const CACHE = 'requete-2026-08-27-case-v131';

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
  './vendor/sqljs/sql-wasm.js',
  './vendor/sqljs/sql-wasm.wasm',
  './assets/mascotte-requete.png',
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
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', res.clone());
        return res;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      return Response.error();
    }
  })());
});
