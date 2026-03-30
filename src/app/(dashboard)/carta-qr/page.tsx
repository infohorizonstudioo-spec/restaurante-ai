'use client'
import { useTenant } from '@/contexts/TenantContext'
import { C } from '@/lib/colors'

export default function CartaQRPage() {
  const { tenant } = useTenant()
  if (!tenant) return null

  const slug = tenant.slug || tenant.id
  const menuUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/carta/${slug}`
    : `/carta/${slug}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(menuUrl)}`

  function downloadQR() {
    const a = document.createElement('a')
    a.href = qrUrl
    a.download = `carta-qr-${slug}.png`
    a.target = '_blank'
    a.click()
  }

  function printQR() {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><style>
      body { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; font-family:system-ui,sans-serif; }
      img { width:300px; height:300px; }
      h2 { margin-top:20px; font-size:24px; }
      p { color:#666; margin-top:8px; }
    </style></head><body>
      <img src="${qrUrl}" alt="QR Carta" />
      <h2>Escanea para ver la carta</h2>
      <p>${tenant?.name || 'Nuestro restaurante'}</p>
      <p style="font-size:12px;color:#999">${menuUrl}</p>
    </body></html>`)
    w.document.close()
    w.onload = () => { w.print() }
  }

  return (
    <div style={{ padding: 32, maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 8 }}>
        QR Carta Digital
      </h1>
      <p style={{ fontSize: 14, color: C.text2, marginBottom: 32 }}>
        Imprime o descarga este QR para que tus clientes vean la carta desde el movil.
      </p>

      {/* QR Card */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,
        padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center',
        marginBottom: 24,
      }}>
        <div style={{
          background: '#fff', borderRadius: 16, padding: 16, marginBottom: 20,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR Carta" width={260} height={260} style={{ display: 'block' }} />
        </div>

        <p style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          Escanea para ver la carta
        </p>
        <p style={{ fontSize: 13, color: C.text3, marginBottom: 20 }}>
          {tenant.name || 'Tu restaurante'}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          <button onClick={downloadQR} style={{
            flex: 1, padding: '14px', borderRadius: 12,
            background: C.amberDim, border: `1px solid rgba(240,168,78,0.3)`,
            color: C.amber, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Descargar QR
          </button>
          <button onClick={printQR} style={{
            flex: 1, padding: '14px', borderRadius: 12,
            background: 'linear-gradient(135deg, #F0A84E, #E8923A)',
            border: 'none', color: '#0C1018', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(240,168,78,0.3)',
          }}>
            Imprimir
          </button>
        </div>
      </div>

      {/* Public URL */}
      <div style={{
        background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 13, color: C.text3, flexShrink: 0 }}>URL publica:</span>
        <code style={{
          flex: 1, fontSize: 12, color: C.teal, wordBreak: 'break-all',
          fontFamily: 'var(--rz-mono)',
        }}>
          {menuUrl}
        </code>
        <button onClick={() => navigator.clipboard.writeText(menuUrl)} style={{
          padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
          background: 'transparent', color: C.text2, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
        }}>
          Copiar
        </button>
      </div>
    </div>
  )
}
