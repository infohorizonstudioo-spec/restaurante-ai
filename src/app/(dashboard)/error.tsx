'use client'

import { C } from '@/lib/colors'

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--rz-font)' }}>
      <div style={{ textAlign: 'center', padding: 24, maxWidth: 420 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: C.redDim,
          border: `1px solid rgba(248,113,113,0.25)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 28,
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>
          Algo salio mal
        </h2>
        <p style={{ fontSize: 14, color: C.text2, marginBottom: 24, lineHeight: 1.6 }}>
          Ha ocurrido un error inesperado. Puedes intentar recargar o volver al panel principal.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              padding: '10px 24px', fontSize: 14, fontWeight: 600,
              color: C.text, background: C.surface2,
              border: `1px solid ${C.border}`, borderRadius: 10,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Reintentar
          </button>
          <a
            href="/panel"
            style={{
              padding: '10px 24px', fontSize: 14, fontWeight: 700,
              color: C.bg, background: C.amber,
              borderRadius: 10, textDecoration: 'none', display: 'inline-block',
            }}
          >
            Volver al panel
          </a>
        </div>
      </div>
    </div>
  )
}
