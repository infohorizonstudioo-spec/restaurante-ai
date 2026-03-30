'use client'
import { useTenant } from '@/contexts/TenantContext'
import { C } from '@/lib/colors'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function CartaQRPage() {
  const { tenant } = useTenant()
  const [tables, setTables] = useState<{ id: string; number: string; name?: string; zone_name?: string }[]>([])
  const [selectedMesa, setSelectedMesa] = useState<string>('')
  const [mode, setMode] = useState<'carta' | 'pedidos'>('pedidos')
  const [loadingTables, setLoadingTables] = useState(true)

  useEffect(() => {
    if (!tenant) return
    ;(async () => {
      const { data } = await supabase
        .from('tables')
        .select('id, number, name, zone_name')
        .eq('tenant_id', tenant.id)
        .order('number')
      setTables(data || [])
      setLoadingTables(false)
    })()
  }, [tenant])

  if (!tenant) return null

  const slug = tenant.slug || tenant.id
  const base = typeof window !== 'undefined' ? window.location.origin : ''

  // Build URL based on mode and mesa
  function buildUrl(mesaNum?: string): string {
    if (mode === 'carta') {
      return `${base}/carta/${slug}`
    }
    const url = `${base}/pedir/${slug}`
    return mesaNum ? `${url}?mesa=${mesaNum}` : url
  }

  const currentUrl = buildUrl(selectedMesa || undefined)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentUrl)}`

  function downloadQR(url?: string, label?: string) {
    const targetUrl = url || qrUrl
    const a = document.createElement('a')
    a.href = targetUrl
    a.download = label ? `qr-mesa-${label}.png` : `qr-${mode}-${slug}.png`
    a.target = '_blank'
    a.click()
  }

  function printSingleQR() {
    const w = window.open('', '_blank')
    if (!w) return
    const mesaLabel = selectedMesa ? ` - Mesa ${selectedMesa}` : ''
    w.document.write(`<!DOCTYPE html><html><head><style>
      body { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; font-family:system-ui,sans-serif; }
      img { width:300px; height:300px; }
      h2 { margin-top:20px; font-size:24px; }
      p { color:#666; margin-top:8px; }
    </style></head><body>
      <img src="${qrUrl}" alt="QR" />
      <h2>${mode === 'pedidos' ? 'Escanea para pedir' : 'Escanea para ver la carta'}${mesaLabel}</h2>
      <p>${tenant?.name || 'Nuestro restaurante'}</p>
      <p style="font-size:12px;color:#999">${currentUrl}</p>
    </body></html>`)
    w.document.close()
    w.onload = () => { w.print() }
  }

  function printAllTables() {
    if (tables.length === 0) return
    const w = window.open('', '_blank')
    if (!w) return
    const cards = tables.map(t => {
      const url = buildUrl(t.number)
      const qr = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`
      const label = t.name || `Mesa ${t.number}`
      return `<div style="break-inside:avoid; text-align:center; padding:24px; border:1px solid #ddd; border-radius:16px; margin-bottom:16px;">
        <img src="${qr}" alt="QR ${label}" style="width:200px;height:200px;" />
        <h3 style="margin:12px 0 4px; font-size:18px;">${label}</h3>
        <p style="color:#666; font-size:13px; margin:0;">Escanea para pedir</p>
        <p style="color:#999; font-size:10px; margin-top:4px;">${tenant?.name || ''}</p>
      </div>`
    }).join('')

    w.document.write(`<!DOCTYPE html><html><head><style>
      body { font-family:system-ui,sans-serif; padding:20px; }
      .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:16px; }
      @media print { .grid { grid-template-columns: repeat(2, 1fr); } }
    </style></head><body>
      <h1 style="text-align:center; margin-bottom:24px;">QR de Mesas - ${tenant?.name || ''}</h1>
      <div class="grid">${cards}</div>
    </body></html>`)
    w.document.close()
    w.onload = () => { w.print() }
  }

  return (
    <div style={{ padding: 32, maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 8 }}>
        QR Carta y Pedidos
      </h1>
      <p style={{ fontSize: 14, color: C.text2, marginBottom: 24 }}>
        Genera codigos QR para que los clientes vean la carta o hagan pedidos desde el movil.
      </p>

      {/* Mode toggle */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 20,
        background: C.surface2, borderRadius: 12, padding: 3,
        border: `1px solid ${C.border}`,
      }}>
        {(['pedidos', 'carta'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, padding: '10px 16px', borderRadius: 10,
            background: mode === m ? C.surface : 'transparent',
            border: mode === m ? `1px solid ${C.border}` : '1px solid transparent',
            color: mode === m ? C.amber : C.text3,
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}>
            {m === 'pedidos' ? 'Pedir desde mesa' : 'Solo ver carta'}
          </button>
        ))}
      </div>

      {/* Table selector (only for pedidos mode) */}
      {mode === 'pedidos' && (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
          padding: '16px 18px', marginBottom: 20,
        }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 10, display: 'block' }}>
            Seleccionar mesa (opcional)
          </label>
          {loadingTables ? (
            <p style={{ fontSize: 13, color: C.text3 }}>Cargando mesas...</p>
          ) : tables.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                onClick={() => setSelectedMesa('')}
                style={{
                  padding: '8px 14px', borderRadius: 10,
                  background: !selectedMesa ? C.amberDim : 'transparent',
                  border: `1px solid ${!selectedMesa ? C.amberBorder : C.border}`,
                  color: !selectedMesa ? C.amber : C.text3,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                General
              </button>
              {tables.map(t => {
                const isActive = selectedMesa === t.number
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedMesa(t.number)}
                    style={{
                      padding: '8px 14px', borderRadius: 10,
                      background: isActive ? C.amberDim : 'transparent',
                      border: `1px solid ${isActive ? C.amberBorder : C.border}`,
                      color: isActive ? C.amber : C.text2,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {t.name || `Mesa ${t.number}`}{t.zone_name ? ` — ${t.zone_name}` : ''}
                  </button>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: C.text3 }}>
              No hay mesas configuradas. El QR funcionara sin numero de mesa.
            </p>
          )}
        </div>
      )}

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
          <img src={qrUrl} alt="QR" width={260} height={260} style={{ display: 'block' }} />
        </div>

        <p style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          {mode === 'pedidos'
            ? (selectedMesa ? `QR para Mesa ${selectedMesa}` : 'QR para pedir')
            : 'Escanea para ver la carta'}
        </p>
        <p style={{ fontSize: 13, color: C.text3, marginBottom: 20 }}>
          {tenant.name || 'Tu restaurante'}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          <button onClick={() => downloadQR()} style={{
            flex: 1, padding: '14px', borderRadius: 12,
            background: C.amberDim, border: `1px solid rgba(240,168,78,0.3)`,
            color: C.amber, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Descargar
          </button>
          <button onClick={printSingleQR} style={{
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

      {/* Print ALL tables button */}
      {mode === 'pedidos' && tables.length > 1 && (
        <button onClick={printAllTables} style={{
          width: '100%', padding: '14px', borderRadius: 14,
          background: C.surface, border: `1px solid ${C.amberBorder}`,
          color: C.amber, fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          Imprimir QR de todas las mesas ({tables.length})
        </button>
      )}

      {/* Public URL */}
      <div style={{
        background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 13, color: C.text3, flexShrink: 0 }}>URL:</span>
        <code style={{
          flex: 1, fontSize: 12, color: C.teal, wordBreak: 'break-all',
          fontFamily: 'var(--rz-mono)',
        }}>
          {currentUrl}
        </code>
        <button onClick={() => navigator.clipboard.writeText(currentUrl)} style={{
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
