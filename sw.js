/**
 * Dulce Arte - Service Worker PWA
 * Caching inteligente, soporte offline completo y actualización continua.
 */

const CACHE_NAME = 'dulce-arte-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/css/style.css',
    '/assets/js/catalog.js',
    '/assets/icons/favicon-32x32.png',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-512x512.png',
    '/assets/icons/maskable-icon-512x512.png',
    '/assets/icons/apple-touch-icon.png',
    '/assets/images/logo_dulce_arte.png',
    '/assets/images/hero_dulce_arte.jpg',
    '/assets/images/pastafrola_membrillo.jpg',
    '/assets/images/maicenitas_dulce_leche.jpg',
    '/assets/images/bizcochuelo_casero.jpg',
    '/assets/images/galletas_artesanales.jpg',
    '/assets/images/torta_evento_dulce.jpg'
];

// 1. Instalación: Precachear recursos estáticos vitales
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('Algunos recursos estáticos no pudieron precachearse:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// 2. Activación: Limpieza de versiones antiguas de caché
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Estrategias de Fetch:
// - Para llamadas a API (/api/): Network-first con fallback a caché
// - Para fuentes y estáticos: Stale-While-Revalidate
// - Para navegación (HTML): Network-first con fallback al index precacheado
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Evitar interceptar solicitudes que no sean GET
    if (request.method !== 'GET') {
        return;
    }

    // Evitar esquemas no compatibles (chrome-extension, etc.)
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Estrategia para API: Network-first con fallback a caché
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request);
                })
        );
        return;
    }

    // Estrategia para recursos estáticos y páginas (Stale-While-Revalidate)
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return networkResponse;
                })
                .catch((err) => {
                    // Si estamos navegando a una página y no hay conexión, servir index precacheado
                    if (request.mode === 'navigate') {
                        return caches.match('/index.html') || caches.match('/');
                    }
                    return null;
                });

            return cachedResponse || fetchPromise;
        })
    );
});
