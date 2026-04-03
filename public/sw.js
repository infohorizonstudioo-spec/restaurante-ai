// Service Worker — Reservo.AI
// Push notifications + offline cache para dashboard
const CACHE_NAME = 'reservo-v2'
const OFFLINE_URL = '/offline'

// Pages to pre-cache for offline use
const PRECACHE = ['/panel', '/tpv', '/cocina', '/pedidos', '/reservas']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
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
  const url = new URL(event.request.url)

  // Skip non-GET and cross-origin
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return

  // API calls: network-only (don't cache API responses)
  if (url.pathname.startsWith('/api/')) return

  // Pages: network-first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful page loads for offline
        if (response.ok && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

// Push notifications
self.addEventListener('push', event => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { return }
  const options = {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.tag || 'reservo-notif',
    requireInteraction: data.priority === 'critical',
    data: { url: data.url || '/panel' },
    vibrate: data.priority === 'critical' ? [200, 100, 200] : [100],
    actions: data.priority === 'critical' ? [
      { action: 'open', title: 'Ver ahora' },
      { action: 'dismiss', title: 'Cerrar' },
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
