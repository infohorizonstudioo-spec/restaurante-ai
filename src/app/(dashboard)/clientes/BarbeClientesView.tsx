'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/contexts/TenantContext'
import { getCommonStrings } from '@/lib/i18n'
import { PageLoader } from '@/components/ui'
import NotifBell from '@/components/NotifBell'

import { C } from "@/lib/colors"

export default function BarbeClientesView() {
  const { tenant, tx } = useTenant()
  const cs = getCommonStrings('es')
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  const [historial, setHistorial] = useState<any[]>([])
  const [loadingH, setLoadingH] = useState(false)

  const load = useCallback(async (tenantId: string) => {
    const { data } = await supabase.from('customers').select('*')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false })
    setClientes(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!tenant?.id) return
    load(tenant.id)
  }, [tenant?.id, load])

  async function openClient(c: any) {
    setSelected(c); setLoadingH(true); setHistorial([])
    const [resR, callR] = await Promise.all([
      supabase.from('reservations').select('*').eq('tenant_id', c.tenant_id)
        .eq('customer_id', c.id).order('date', { ascending: false }).limit(10),
      supabase.from('calls').select('*').eq('tenant_id', c.tenant_id)
        .eq('caller_phone', c.phone).order('started_at', { ascending: false }).limit(5),
    ])
    setHistorial([
      ...(resR.data || []).map(r => ({ ...r, _type: 'cita' })),
      ...(callR.data || []).map(c => ({ ...c, _type: 'llamada' })),
    ].sort((a, b) => {
      const da = a.date || a.started_at || ''
      const db = b.date || b.started_at || ''
      return db.localeCompare(da)
    }))
    setLoadingH(false)
  }

  if (loading) return <PageLoader />

  const filtered = search
    ? clientes.filter(c =>
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || '').includes(search))
    : clientes

  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{tx('Clientes')}</h1>
          <p style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{clientes.length} {tx('registrados')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tx('Buscar clientes…')}
            style={{ padding: '8px 14px', fontSize: 13, border: `1px solid ${C.borderMd}`, borderRadius: 9, outline: 'none', width: 200, background: C.surface2, color: C.text, fontFamily: 'inherit' }} />
          <NotifBell />
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Lista */}
        <div style={{ width: 300, flexShrink: 0, overflowY: 'auto', borderRight: `1px solid ${C.border}` }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✂️</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{cs.noClients}</p>
              <p style={{ fontSize: 13, color: C.text3, marginTop: 4 }}>{tx('Los clientes que llamen al agente aparecerán aquí.')}</p>
            </div>
          ) : filtered.map(c => (
            <div key={c.id} onClick={() => openClient(c)} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, background: selected?.id === c.id ? C.surface2 : 'transparent', transition: 'background 0.1s' }}
              onMouseEnter={e => { if (selected?.id !== c.id)(e.currentTarget as HTMLElement).style.background = C.surface2 }}
              onMouseLeave={e => { if (selected?.id !== c.id)(e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.amberDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.amber, flexShrink: 0 }}>
                  {c.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                  <p style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>{c.phone || tx('Sin teléfono')}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.text2 }}>{c.total_reservations || 0} {tx('citas')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detalle */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {!selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.text3 }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>✂️</div>
              <p style={{ fontSize: 14, color: C.text3 }}>{tx('Selecciona un cliente para ver su historial')}</p>
            </div>
          ) : (
            <>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.amberDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: C.amber }}>
                    {selected.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{selected.name}</p>
                    <p style={{ fontSize: 13, color: C.text2 }}>{selected.phone}</p>
                  </div>
                </div>
                {selected.notes && <p style={{ fontSize: 13, color: C.text2, background: C.surface2, padding: '8px 12px', borderRadius: 9 }}>📝 {selected.notes}</p>}
              </div>

              <p style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{tx('Historial de citas')}</p>
              {loadingH ? <p style={{ color: C.text3 }}>{tx('Cargando...')}</p>
                : historial.length === 0 ? <p style={{ fontSize: 13, color: C.text3 }}>{cs.noActivity}</p>
                : historial.map((h, i) => (
                  <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{h._type === 'cita' ? '✂️' : '📞'}</span>
                    <div style={{ flex: 1 }}>
                      {h._type === 'cita' ? (
                        <>
                          <p style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{h.date} a las {(h.time || '').slice(0, 5)}</p>
                          <p style={{ fontSize: 11, color: C.text3 }}>{h.notes || h.status}</p>
                        </>
                      ) : (
                        <>
                          <p style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{h.summary || tx('Llamada')}</p>
                          <p style={{ fontSize: 11, color: C.text3 }}>{(h.started_at || '').slice(0, 10)}</p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
