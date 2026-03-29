'use client'

import { useEffect, useState } from 'react'
import { C } from '@/lib/colors'

interface HealthData {
  status: 'ok' | 'degraded' | 'down'
  services: Record<string, boolean>
  timestamp: string
}

/**
 * ServiceStatus — subtle banner at the bottom of the dashboard.
 * Hidden when all services are operational; visible only on degraded/down.
 */
export default function ServiceStatus() {
  const [health, setHealth] = useState<HealthData | null>(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' })
        if (!cancelled) {
          const data: HealthData = await res.json()
          setHealth(data)
        }
      } catch {
        if (!cancelled) {
          setHealth({ status: 'down', services: {}, timestamp: new Date().toISOString() })
        }
      }
    }

    check()
    const interval = setInterval(check, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Hide when all OK or not loaded yet
  if (!health || health.status === 'ok') return null

  const isDown = health.status === 'down'
  const dotColor = isDown ? C.red : C.yellow
  const bgColor = isDown ? C.redDim : C.yellowDim
  const borderColor = isDown ? 'rgba(248,113,113,0.25)' : 'rgba(250,204,21,0.25)'
  const label = isDown ? 'Servicio interrumpido' : 'Servicio degradado'
  const downNames = Object.entries(health.services)
    .filter(([, up]) => !up)
    .map(([name]) => name)

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 498,
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        padding: '8px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'var(--rz-font)',
        fontSize: 13,
        color: C.text,
        maxWidth: 420,
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
        }}
      />
      <span style={{ fontWeight: 600 }}>{label}</span>
      {downNames.length > 0 && (
        <span style={{ color: C.text2, fontSize: 12 }}>
          ({downNames.join(', ')})
        </span>
      )}
    </div>
  )
}
