'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/contexts/TenantContext'
import { PageLoader } from '@/components/ui'

import { C } from "@/lib/colors"
import { INMO_STATUS } from '@/lib/status-config'

type FilterRange = 'hoy' | 'semana' | 'todas'

export default function InmoReservasView() {
  const [visitas, setVisitas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tid, setTid] = useState<string|null>(null)
  const [filter, setFilter] = useState<FilterRange>('hoy')
  const [modal, setModal] = useState<any|null>(null)
  const { tenant, tx } = useTenant()

  const load = useCallback(async (tenantId: string) => {
    const today = new Date().toISOString().slice(0,10)
    let q = supabase.from('reservations').select('*').eq('tenant_id', tenantId)

    if (filter === 'hoy') {
      q = q.eq('date', today)
    } else if (filter === 'semana') {
      const end = new Date()
      end.setDate(end.getDate() + 7)
      q = q.gte('date', today).lte('date', end.toISOString().slice(0,10))
    }

    const { data } = await q.order('date').order('time')
    setVisitas(data || [])
    setLoading(false)
  }, [filter])

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
    const ch = supabase.channel('inmo-visitas-rt-' + tid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: 'tenant_id=eq.' + tid }, () => load(tid))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tid, load])

  async function updateStatus(id: string, status: string) {
    await supabase.from('reservations').update({ status }).eq('id', id)
    if (tid) load(tid)
    setModal(null)
  }

  if (loading) return <PageLoader />

  const extractProperty = (r: any) => {
    if (r.notes) {
      const match = r.notes.match(/(?:propiedad|inmueble|dirección|piso|casa|chalet)[:\s]*(.+)/i)
      if (match) return match[1].trim().slice(0, 50)
    }
    return r.table_name || r.notes?.slice(0, 40) || '—'
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, position: 'sticky', top: 0, zIndex: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>{tx('Visitas')}</h1>
          <p style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{visitas.length} visita{visitas.length !== 1 ? 's' : ''} {filter === 'hoy' ? 'hoy' : filter === 'semana' ? 'esta semana' : 'en total'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {(['hoy', 'semana', 'todas'] as FilterRange[]).map(f => (
            <button key={f} onClick={() => { setFilter(f); setLoading(true) }}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${filter === f ? C.amber + '60' : C.border}`, background: filter === f ? C.amberDim : 'transparent', color: filter === f ? C.amber : C.text2, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
              {f === 'semana' ? tx('Esta semana') : f === 'todas' ? tx('Todas') : tx('Hoy')}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 24px' }}>
        {visitas.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔑</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>{tx('Sin visitas programadas')}</p>
            <p style={{ fontSize: 13, color: C.text3 }}>{tx('Las visitas agendadas por el agente aparecerán aquí.')}</p>
          </div>
        ) : visitas.map(r => {
          const ss = INMO_STATUS[r.status] || INMO_STATUS.pendiente
          const time = r.time || r.reservation_time || ''
          const name = r.customer_name || tx('Sin nombre')
          const property = extractProperty(r)
          return (
            <div key={r.id} onClick={() => setModal(r)}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.12s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.surface2; (e.currentTarget as HTMLElement).style.borderColor = C.borderMd }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.surface; (e.currentTarget as HTMLElement).style.borderColor = C.border }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: C.amberDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: C.amber, flexShrink: 0 }}>
                {name[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{name}</p>
                <p style={{ fontSize: 12, color: C.text2, marginTop: 1 }}>
                  {(r.date || r.reservation_date)?.slice(0, 10)} · {time.slice(0, 5)}
                  {property !== '—' ? ` · ${property}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 8, background: ss.bg, color: ss.color, fontWeight: 700, border: `1px solid ${ss.color}25`, flexShrink: 0 }}>{tx(ss.label)}</span>
                {r.customer_phone && <p style={{ fontSize: 11, color: C.text3 }}>{r.customer_phone}</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setModal(null)}>
          <div style={{ background: C.surface, border: `1px solid ${C.borderMd}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{modal.customer_name || tx('Sin nombre')}</p>
                <p style={{ fontSize: 13, color: C.text2, marginTop: 2 }}>
                  {(modal.date || modal.reservation_date)?.slice(0, 10)} · {(modal.time || modal.reservation_time || '').slice(0, 5)}
                </p>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.text3 }}>×</button>
            </div>
            {modal.customer_phone && <p style={{ fontSize: 13, color: C.text2, marginBottom: 8 }}>📞 {modal.customer_phone}</p>}
            {extractProperty(modal) !== '—' && <p style={{ fontSize: 13, color: C.text2, marginBottom: 8 }}>🏠 {extractProperty(modal)}</p>}
            {modal.notes && <p style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>📝 {modal.notes}</p>}
            {modal.source === 'voice_agent' && <p style={{ fontSize: 12, color: C.violet, marginBottom: 16, background: C.violetDim, padding: '6px 10px', borderRadius: 8 }}>📞 {tx('Visita creada por el agente de voz')}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {['programada', 'confirmada', 'realizada', 'cancelada'].map(s => (
                <button key={s} onClick={() => updateStatus(modal.id, s)}
                  style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${INMO_STATUS[s]?.color || C.border}40`, background: modal.status === s ? INMO_STATUS[s]?.bg || C.surface2 : 'transparent', color: INMO_STATUS[s]?.color || C.text2, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {tx(INMO_STATUS[s]?.label||s)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
