// Service Worker — Reservo.AI Push Notifications
// Maneja push events cuando la app está en segundo plano

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

self.addEventListener('install',  () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))
