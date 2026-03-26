'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/contexts/TenantContext'
import { getCommonStrings } from '@/lib/i18n'
import { PageLoader } from '@/components/ui'

import { C } from "@/lib/colors"

const LEAD_STATUS: Record<string,{bg:string;color:string;label:string}> = {
  nuevo:       {bg:C.tealDim,   color:C.teal,  label:'Nuevo'},
  contactado:  {bg:C.amberDim,  color:C.amber, label:'Contactado'},
  en_proceso:  {bg:C.violetDim, color:C.violet, label:'En proceso'},
  cerrado:     {bg:C.greenDim,  color:C.green, label:'Cerrado'},
}

function parseLeadInfo(notes: string|null): { busca?: string; presupuesto?: string } {
  if (!notes) return {}
  const result: { busca?: string; presupuesto?: string } = {}
  const opMatch = notes.match(/(?:busca|operación|interés)[:\s]*(comprar|vender|alquilar)/i)
  if (opMatch) result.busca = opMatch[1]
  const priceMatch = notes.match(/(?:presupuesto|precio|budget)[:\s]*([^\n,;]+)/i)
  if (priceMatch) result.presupuesto = priceMatch[1].trim()
  return result
}

export default function InmoClientesView() {
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any|null>(null)
  const [historial, setHistorial] = useState<any[]>([])
  const [loadingH, setLoadingH] = useState(false)
  const [tid, setTid] = useState<string|null>(null)
  const { tenant } = useTenant()
  const cs = getCommonStrings('es')

  const load = useCallback(async (tenantId: string) => {
    const { data } = await supabase.from('customers').select('*')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false })
    setClientes(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
      if (!p?.tenant_id) return
      setTid(p.tenant_id)
      await load(p.tenant_id)
    })()
  }, [load])

  useEffect(() => {
    if (!tid) return
    const ch = supabase.channel('inmo-clientes-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: 'tenant_id=eq.' + tid }, () => load(tid))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tid, load])

  async function openClient(c: any) {
    setSelected(c); setLoadingH(true); setHistorial([])
    const [resR, callR] = await Promise.all([
      supabase.from('reservations').select('*').eq('tenant_id', c.tenant_id).eq('customer_id', c.id).order('date', { ascending: false }).limit(10),
      supabase.from('calls').select('*').eq('tenant_id', c.tenant_id).eq('caller_phone', c.phone).order('started_at', { ascending: false }).limit(5),
    ])
    setHistorial([
      ...(resR.data || []).map(r => ({ ...r, _type: 'visita' })),
      ...(callR.data || []).map(c => ({ ...c, _type: 'llamada' })),
    ].sort((a, b) => {
      const da = a.date || a.reservation_date || a.started_at || ''
      const db = b.date || b.reservation_date || b.started_at || ''
      return db.localeCompare(da)
    }))
    setLoadingH(false)
  }

  if (loading) return <PageLoader />

  const filtered = search
    ? clientes.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search) || (c.email || '').includes(search))
    : clientes

  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0, zIndex: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Leads / Clientes</h1>
          <p style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{clientes.length} registrados</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar leads…"
          style={{ padding: '8px 14px', fontSize: 13, border: `1px solid ${C.borderMd}`, borderRadius: 9, outline: 'none', width: 220, background: C.surface2, color: C.text, fontFamily: 'inherit' }} />
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* List */}
        <div style={{ width: 340, flexShrink: 0, overflowY: 'auto', borderRight: `1px solid ${C.border}`, background: C.surface }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏠</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>Sin leads</p>
              <p style={{ fontSize: 13, color: C.text3 }}>Los clientes que contacten al agente aparecerán aquí.</p>
            </div>
          ) : filtered.map(c => {
            const info = parseLeadInfo(c.notes)
            const status = LEAD_STATUS[c.status] || LEAD_STATUS.nuevo
            return (
              <div key={c.id} onClick={() => openClient(c)} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, background: selected?.id === c.id ? C.surface2 : 'transparent', transition: 'background 0.1s' }}
                onMouseEnter={e => { if (selected?.id !== c.id) (e.currentTarget as HTMLElement).style.background = C.surface2 }}
                onMouseLeave={e => { if (selected?.id !== c.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.amberDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.amber, flexShrink: 0 }}>
                    {c.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                      <span style={{ fontSize: 9, fontWeight: 700, color: status.color, background: status.bg, padding: '1px 6px', borderRadius: 4 }}>{status.label}</span>
                    </div>
                    <p style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>
                      {c.phone || c.email || 'Sin contacto'}
                      {info.busca ? ` · ${info.busca}` : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {c.last_visit && <p style={{ fontSize: 10, color: C.text3 }}>{new Date(c.last_visit).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Detail */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: C.bg }}>
          {!selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.text3 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.amberDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 14 }}>🏠</div>
              <p style={{ fontSize: 14, color: C.text3 }}>Selecciona un lead para ver su ficha</p>
            </div>
          ) : (
            <>
              {/* Lead card */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 50, height: 50, borderRadius: '50%', background: C.amberDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: C.amber }}>
                    {selected.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{selected.name}</p>
                    <p style={{ fontSize: 13, color: C.text2, marginTop: 1 }}>{selected.phone}{selected.email ? ' · ' + selected.email : ''}</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                  {(() => {
                    const info = parseLeadInfo(selected.notes)
                    return [
                      { label: 'Busca', value: info.busca || '—' },
                      { label: 'Presupuesto', value: info.presupuesto || '—' },
                      { label: 'Última interacción', value: selected.last_visit ? new Date(selected.last_visit).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—' },
                    ].map(m => (
                      <div key={m.label} style={{ background: C.surface2, borderRadius: 9, padding: '10px 14px' }}>
                        <p style={{ fontSize: 10, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{m.label}</p>
                        <p style={{ fontFamily: 'var(--rz-mono)', fontSize: 16, fontWeight: 700, color: C.text }}>{m.value}</p>
                      </div>
                    ))
                  })()}
                </div>
                {selected.notes && <p style={{ marginTop: 12, fontSize: 13, color: C.text2, background: C.surface2, padding: '8px 12px', borderRadius: 9 }}>📝 {selected.notes}</p>}
              </div>

              {/* History */}
              <p style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Historial de contactos y visitas</p>
              {loadingH ? <div style={{ textAlign: 'center', padding: 20, color: C.text3 }}>Cargando...</div>
                : historial.length === 0 ? <p style={{ fontSize: 13, color: C.text3, padding: '20px 0' }}>{cs.noActivity}</p>
                : historial.map((h, i) => (
                  <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', gap: 10, transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
                    onMouseLeave={e => (e.currentTarget.style.background = C.surface)}>
                    <span style={{ fontSize: 16 }}>{h._type === 'visita' ? '🔑' : '📞'}</span>
                    <div style={{ flex: 1 }}>
                      {h._type === 'visita' ? (
                        <>
                          <p style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                            Visita {(h.date || h.reservation_date)?.slice(0, 10)} a las {(h.time || h.reservation_time || '').slice(0, 5)}
                          </p>
                          <p style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>{h.notes?.slice(0, 60) || ''} {h.status}</p>
                        </>
                      ) : (
                        <>
                          <p style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{h.summary || 'Llamada'}</p>
                          <p style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>{(h.started_at || '').slice(0, 10)}</p>
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
