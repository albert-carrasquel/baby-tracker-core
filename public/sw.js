const CACHE_VERSION = 'dev' /*__CACHE_VERSION__*/;
const CACHE_NAME = `baby-tracker-shell-${CACHE_VERSION}`;

const CORE_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/theme-init.js',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const BUILD_ASSETS = [] /*__PRECACHE_ASSETS__*/;

function isCacheableStaticPath(pathname) {
  return (
    pathname === '/' ||
    pathname === '/index.html' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/theme-init.js' ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/icons/')
  );
}

self.addEventListener('install', (event) => {
  const assetsToCache = Array.from(
    new Set([...CORE_SHELL_ASSETS, ...(Array.isArray(BUILD_ASSETS) ? BUILD_ASSETS : [])]),
  );

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(assetsToCache)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('baby-tracker-shell-') && key !== CACHE_NAME)
            .map((oldKey) => caches.delete(oldKey)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never cache URLs carrying query parameters (e.g. auth callbacks or tokens).
  if (url.search !== '') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  if (!isCacheableStaticPath(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        if (response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
