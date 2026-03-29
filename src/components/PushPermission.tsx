'use client'
import { useState, useEffect } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

const DISMISS_KEY = 'reservo_push_dismissed'

export default function PushPermission() {
  const { status, requestPermission } = usePushNotifications()
  const [dismissed, setDismissed] = useState(true) // hidden by default until hydrated

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
  }, [])

  if (status !== 'default' || dismissed) return null

  async function handleActivate() {
    await requestPermission()
    setDismissed(true)
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px', marginBottom: 16,
      background: 'var(--rz-amber-dim)', border: '1px solid rgba(240,168,78,0.25)',
      borderRadius: 10, fontSize: 13, color: 'var(--rz-text)',
    }}>
      <span style={{ flex: 1 }}>
        Activa las notificaciones para recibir alertas de reservas, pedidos y llamadas en tiempo real.
      </span>
      <button onClick={handleActivate} style={{
        padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8,
        background: 'var(--rz-amber)', color: 'var(--rz-bg)', border: 'none', cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}>
        Activar
      </button>
      <button onClick={handleDismiss} style={{
        padding: '6px 10px', fontSize: 12, borderRadius: 8,
        background: 'transparent', color: 'var(--rz-text-3)', border: 'none', cursor: 'pointer',
      }}>
        Ahora no
      </button>
    </div>
  )
}
