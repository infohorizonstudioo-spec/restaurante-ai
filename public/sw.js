// Service Worker — Reservo.AI Push Notifications + Offline TPV
// Maneja push events y caching offline para el TPV

const CACHE_NAME = 'reservo-tpv-v1'
const TPV_URLS = ['/tpv', '/panel']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(TPV_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  )
})

self.addEventListener('fetch', event => {
  // Network-first for API calls, cache-first for pages
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    )
  } else {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    )
  }
})

self.addEventListener('push', event => {
  if (!event.data) return
  const data = event.data.json()
  const options = {
    body:              data.body    || '',
    icon:              '/icon-192.png',
    badge:             '/badge-72.png',
    tag:               data.tag    || 'reservo-notif',
    requireInteraction: data.priority === 'critical',
    data:              { url: data.url || '/panel' },
    vibrate:           data.priority === 'critical' ? [200, 100, 200] : [100],
    actions: data.priority === 'critical' ? [
      { action: 'open',    title: 'Ver ahora' },
      { action: 'dismiss', title: 'Cerrar'    },
    ] : [],
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Reservo.AI', options)
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.action === 'dismiss') return
  const url = event.notification.data?.url || '/panel'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const existing = cs.find(c => c.url.includes('/panel') || c.url.includes('/llamadas'))
      if (existing) { existing.focus(); return }
      return clients.openWindow(url)
    })
  )
})

// install and activate handled above with caching logic
