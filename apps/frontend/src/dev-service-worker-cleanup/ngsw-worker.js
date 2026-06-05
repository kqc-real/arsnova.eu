/* global self, caches, URL */
/* Development-only cleanup worker for stale localized PWA previews on localhost. */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));

      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      await Promise.all(
        clients.map(async (client) => {
          try {
            const url = new URL(client.url);
            if (url.origin === self.location.origin) {
              if (url.pathname === '/de' || url.pathname === '/de/') {
                url.pathname = '/';
              } else if (url.pathname.startsWith('/de/')) {
                url.pathname = url.pathname.slice('/de'.length);
              }
            }
            await client.navigate(url.href);
          } catch {
            /* best effort */
          }
        }),
      );

      await self.registration.unregister();
    })(),
  );
});
