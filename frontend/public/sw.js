/**
 * HES Transport & Logistique - Service Worker PWA (App Shell & Offline Fallback)
 * Architecture : Single-tenant multi-agences
 * Sécurité : Isolation stricte des données sensibles, aucune persistance de routes API
 */

const CACHE_NAME = 'hes-app-shell-v1';

// Assets essentiels composant l'App Shell minimal
const APP_SHELL_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Installation : Pré-mise en cache de l'App Shell minimal
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_PRECACHE))
      .catch((err) => {
        // En cas d'échec sur un asset non bloquant, l'installation se poursuit
        console.warn('[SW] Pré-cache partiel App Shell:', err);
      })
  );
});

// Activation : Nettoyage immédiat des anciens caches obsolètes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
            return null;
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Communication client <-> Service Worker (ex: mise à jour sans perte de saisie)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Interception des requêtes HTTP
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. RÈGLE CRITIQUE CYBERSÉCURITÉ : Exclusion absolue de l'API et des requêtes mutatives
  // Ne JAMAIS persister de données sensibles (CIN, montants COD, adresses, jetons) dans CacheStorage
  const isApiRequest = url.pathname.startsWith('/api/') || url.pathname.includes('/api/v1');
  const isMutation = request.method !== 'GET';

  if (isApiRequest || isMutation) {
    // Stratégie : Network-Only strict sans interaction CacheStorage
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            statusCode: 503,
            error: 'Service Unavailable',
            message:
              'Connexion réseau indisponible. Cette action en ligne ne peut pas être exécutée hors-ligne.',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // 2. Navigation HTML (App Shell SPA)
  // Stratégie : Network-First avec repli sur /index.html en cache pour le support hors-ligne
  const isNavigation =
    request.mode === 'navigate' ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;
          const fallbackShell = await caches.match('/');
          return fallbackShell || new Response('Application hors-ligne', { status: 503 });
        })
    );
    return;
  }

  // 3. Assets statiques (JS, CSS, Polices, Images locales)
  // Stratégie : Cache-First avec repli réseau et mise en cache dynamique
  const isStaticAsset =
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.woff2'));

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Pour toute autre requête GET tierce (ex: Google Fonts CDN)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      });
    })
  );
});
