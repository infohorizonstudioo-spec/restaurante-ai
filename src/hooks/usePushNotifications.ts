'use client'
import { useEffect, useCallback, useState } from 'react'

export type PushStatus = 'unsupported' | 'denied' | 'default' | 'granted'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('default')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) { setStatus('unsupported'); return }
    setStatus(Notification.permission as PushStatus)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  const requestPermission = useCallback(async (): Promise<PushStatus> => {
    if (!('Notification' in window)) return 'unsupported'
    const result = await Notification.requestPermission()
    setStatus(result as PushStatus)

    // Si se concede, crear suscripción push real con VAPID
    if (result === 'granted' && 'serviceWorker' in navigator && VAPID_PUBLIC_KEY) {
      try {
        const reg = await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()
        const sub = existing || await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
        })
        // Guardar suscripción en el servidor
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() }),
          credentials: 'include',
        })
      } catch {
        // silently ignore
      }
    }
    return result as PushStatus
  }, [])

  const unsubscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
          credentials: 'include',
        })
        await sub.unsubscribe()
        setStatus('default')
      }
    } catch {
      // silently ignore
    }
  }, [])

  const sendTest = useCallback((priority: 'info' | 'warning' | 'critical' = 'info') => {
    if (Notification.permission !== 'granted') return
    new Notification('Reservo.AI — Prueba de notificación', {
      body: 'Las notificaciones push están activadas y funcionando.',
      icon: '/icon-192.png',
      requireInteraction: priority === 'critical',
    })
  }, [])

  return { status, requestPermission, unsubscribe, sendTest }
}
