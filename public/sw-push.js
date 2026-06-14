/* Web Push handlers (PWA Tier 3 — M13 upgraded).
 *
 * Pulled into the Workbox-generated SW via importScripts in vite.config.ts.
 *
 * Extended payload shape (from send-push edge function):
 *   {
 *     title, body, url,
 *     icon, badge,
 *     tag, renotify,
 *     requireInteraction,
 *     silent,
 *     actions: [{ action, title, icon, url }],
 *     notificationId   // for analytics postback
 *   }
 */

// ── push ─────────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_e) {
    payload = { title: 'Heading', body: event.data ? event.data.text() : '' };
  }

  const title  = payload.title  || 'Heading';
  const icon   = payload.icon   || '/pwa-192x192.png';
  const badge  = payload.badge  || '/badge-72x72.png';
  const tag    = payload.tag    || 'heading-push';

  // Map action objects — strip custom `url` from the SW-visible action (added to data below)
  const actions = Array.isArray(payload.actions)
    ? payload.actions.map(({ action, title: t, icon: i }) => ({
        action,
        title: t || '',
        ...(i ? { icon: i } : {}),
      }))
    : [];

  const options = {
    body:              payload.body              || '',
    icon,
    badge,
    tag,
    renotify:          payload.renotify          ?? false,
    requireInteraction: payload.requireInteraction ?? false,
    silent:            payload.silent            ?? false,
    // Store full payload in data for click routing
    data: {
      url:            payload.url            || '/today',
      actionUrls:     payload.actionUrls     || {},   // { actionKey: url }
      notificationId: payload.notificationId || null,
    },
    // Actions (Chrome desktop / Android — silently ignored elsewhere)
    ...(actions.length > 0 ? { actions } : {}),
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

  const data       = event.notification.data || {};
  const action     = event.action;                     // empty string = body tap
  const actionUrls = data.actionUrls || {};
  const defaultUrl = data.url || '/today';
  const targetUrl  = (action && actionUrls[action]) ? actionUrls[action] : defaultUrl;

  // Postback: tell the app which action was taken (for analytics)
  const notificationId = data.notificationId;
  if (notificationId) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          try {
            if (new URL(client.url).origin === self.location.origin) {
              client.postMessage({
                type: 'PUSH_CLICKED',
                notificationId,
                action: action || 'body',
              });
            }
          } catch (_e) { /* ignore */ }
        }
      })
    );
  }

  event.waitUntil(
    (async () => {
      try {
        const allClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of allClients) {
          try {
            if (new URL(client.url).origin === self.location.origin) {
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

self.addEventListener('notificationclose', (event) => {
  const data           = event.notification.data || {};
  const notificationId = data.notificationId;
  if (!notificationId) return;

  // Postback dismissed event for analytics
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        try {
          if (new URL(client.url).origin === self.location.origin) {
            client.postMessage({
              type: 'PUSH_DISMISSED',
              notificationId,
            });
          }
        } catch (_e) { /* ignore */ }
      }
    })
  );
});
