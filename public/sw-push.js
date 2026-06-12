/* Web Push handlers (PWA Tier 3 — M13).
 *
 * Pulled into the Workbox-generated SW via importScripts in vite.config.ts.
 * Runs inside the same service worker as precache/runtime caching.
 *
 * Payload shape (from send-push edge function):
 *   { title, body, url, icon, badge, tag }
 */

// ── push ─────────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_e) {
    payload = { title: 'Heading', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Heading';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/badge-72x72.png',
    tag: payload.tag || 'heading-push',
    data: { url: payload.url || '/today' },
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.warn('[sw-push] showNotification failed:', err);
    })
  );
});

// ── notificationclick ─────────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/today';

  event.waitUntil(
    (async () => {
      try {
        const allClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of allClients) {
          try {
            const url = new URL(client.url);
            if (url.origin === self.location.origin) {
              await client.focus();
              if ('navigate' in client) await client.navigate(targetUrl);
              return;
            }
          } catch (_e) { /* ignore malformed client url */ }
        }
        if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
      } catch (err) {
        console.warn('[sw-push] notificationclick handler error:', err);
      }
    })()
  );
});

// ── notificationclose ─────────────────────────────────────────────────────────

self.addEventListener('notificationclose', (_event) => {
  // Notification dismissed without click — no action needed.
  // Hook present so browsers do not log an unhandled-event warning.
});
