'use client'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'

import { C } from "@/lib/colors"
import { ECOM_STATUS } from '@/lib/status-config'

export default function EcomReservasView() {
  const { tenant, template, tx } = useTenant()
  const L = template?.labels
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [tid, setTid] = useState<string|null>(null)
  const [modal, setModal] = useState<any|null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async (tenantId: string) => {
    const { data } = await supabase.from('reservations')
      .select('*').eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(200)
    setPedidos(data || [])
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
    const ch = supabase.channel('ecom-pedidos-rt-' + tid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: 'tenant_id=eq.' + tid }, () => load(tid))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tid, load])

  if (loading) return <PageLoader />

  const filtered = search
    ? pedidos.filter(p =>
        (p.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.notes || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.customer_phone || '').includes(search)
      )
    : pedidos

  const activos = pedidos.filter(p => !['entregado', 'cancelado', 'completada', 'cancelada'].includes(p.status))

  async function updateStatus(id: string, status: string) {
    await supabase.from('reservations').update({ status }).eq('id', id)
    if (tid) load(tid)
    setModal(null)
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, position: 'sticky', top: 0, zIndex: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>{L?.pageTitle || 'Pedidos'}</h1>
          <p style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{activos.length} activos · {pedidos.length} total</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={L?.buscarPlaceholder || 'Buscar pedidos…'}
            style={{ padding: '8px 14px', fontSize: 13, border: `1px solid ${C.borderMd}`, borderRadius: 9, outline: 'none', width: 200, background: C.surface2, color: C.text, fontFamily: 'inherit' }} />
          <NotifBell />
        </div>
      </div>

      {/* Stats cards */}
      {activos.length > 0 && (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 24px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
            {(['nuevo', 'confirmado', 'enviado', 'entregado'] as const).map(s => {
              const cnt = pedidos.filter(p => p.status === s).length
              const ss = ECOM_STATUS[s]
              return (
                <div key={s} style={{ background: C.surface, border: `1px solid ${ss.color}33`, borderRadius: 12, padding: '12px 16px' }}>
                  <p style={{ fontSize: 22, fontWeight: 700, color: ss.color }}>{cnt}</p>
                  <p style={{ fontSize: 12, color: ss.color, fontWeight: 600 }}>{tx(ss.label)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pedidos list */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 24px' }}>
        {filtered.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🛍️</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>{L?.emptyReservas || 'Sin pedidos'}</p>
            <p style={{ fontSize: 13, color: C.text3 }}>{tx('Los pedidos aparecerán aquí en tiempo real.')}</p>
          </div>
        ) : filtered.map(p => {
          const ss = ECOM_STATUS[p.status] || ECOM_STATUS.nuevo
          return (
            <div key={p.id} onClick={() => setModal(p)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.12s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.surface2; (e.currentTarget as HTMLElement).style.borderColor = C.borderMd }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.surface; (e.currentTarget as HTMLElement).style.borderColor = C.border }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: C.violetDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: C.violet, flexShrink: 0 }}>
                {(p.customer_name || '?')[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{p.customer_name || tx('Sin nombre')}</p>
                  <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 8, background: ss.bg, color: ss.color, fontWeight: 700, border: `1px solid ${ss.color}25`, flexShrink: 0 }}>{tx(ss.label)}</span>
                </div>
                {p.notes && <p style={{ fontSize: 12, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes}</p>}
                {p.customer_phone && <p style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>📞 {p.customer_phone}</p>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 11, color: C.text3 }}>{p.date || (p.created_at ? new Date(p.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : '')}</p>
                {p.time && <p style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{p.time.slice(0, 5)}</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal detalle */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setModal(null)}>
          <div style={{ background: C.surface, border: `1px solid ${C.borderMd}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{modal.customer_name || tx('Sin nombre')}</p>
                <p style={{ fontSize: 13, color: C.text2, marginTop: 2 }}>
                  {modal.date || ''} {modal.time ? '· ' + modal.time.slice(0, 5) : ''}
                </p>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.text3 }}>×</button>
            </div>
            {modal.customer_phone && <p style={{ fontSize: 13, color: C.text2, marginBottom: 8 }}>📞 {modal.customer_phone}</p>}
            {modal.notes && <p style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>📝 {modal.notes}</p>}
            {modal.source === 'voice_agent' && <p style={{ fontSize: 12, color: C.violet, marginBottom: 16, background: C.violetDim, padding: '6px 10px', borderRadius: 8 }}>📞 {tx('Pedido creado por el agente de voz')}</p>}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{tx('Estado')}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['nuevo', 'confirmado', 'enviado', 'entregado', 'cancelado'].map(s => {
                  const ss = ECOM_STATUS[s]
                  if (!ss) return null
                  return (
                    <button key={s} onClick={() => updateStatus(modal.id, s)}
                      style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${ss.color}40`,
                        background: modal.status === s ? ss.bg : 'transparent',
                        color: ss.color, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {tx(ss.label)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
