'use client'
import { useEffect, useCallback, useState } from 'react'

export type PushStatus = 'unsupported' | 'denied' | 'default' | 'granted'

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
    return result as PushStatus
  }, [])

  const sendTest = useCallback((priority: 'info'|'warning'|'critical' = 'info') => {
    if (Notification.permission !== 'granted') return
    new Notification('Reservo.AI — Prueba de notificación', {
      body: 'Las notificaciones push están activadas y funcionando.',
      icon: '/icon-192.png',
      requireInteraction: priority === 'critical',
    })
  }, [])

  return { status, requestPermission, sendTest }
}
