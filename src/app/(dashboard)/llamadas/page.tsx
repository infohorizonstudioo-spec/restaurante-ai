'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader, PageHeader, Badge, EmptyState } from '@/components/ui'

function dur(s?: number) {
  if (!s) return null
  const m = Math.floor(s/60), sec = s%60
  return m>0 ? `${m}m ${sec}s` : `${sec}s`
}
function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff/60)}min`
  if (diff < 86400) return `hace ${Math.floor(diff/3600)}h`
  return new Date(d).toLocaleDateString('es-ES', { day:'numeric', month:'short' })
}
function groupByDate(calls: any[]) {
  const groups: Record<string, any[]> = {}
  calls.forEach(c => {
    const d = c.created_at ? new Date(c.created_at).toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' }) : 'Sin fecha'
    if (!groups[d]) groups[d] = []
    groups[d].push(c)
  })
  return groups
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  completed:   { label: 'Completada', color: '#059669', bg: '#f0fdf4' },
  'in-progress':{ label: 'En curso',  color: '#d97706', bg: '#fffbeb' },
  failed:      { label: 'Fallida',    color: '#dc2626', bg: '#fef2f2' },
  missed:      { label: 'Perdida',    color: '#6b7280', bg: '#f9fafb' },
}

export default function LlamadasPage() {
  const [calls, setCalls]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string>('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!p?.tenant_id) return
    setTenantId(p.tenant_id)
    const { data } = await supabase.from('calls').select('*').eq('tenant_id', p.tenant_id).order('created_at', { ascending: false }).limit(100)
    setCalls(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    // Real-time updates
    const ch = supabase.channel('calls-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  if (loading) return <PageLoader/>

  const groups = groupByDate(calls)
  const total = calls.length
  const completed = calls.filter(c => c.status === 'completed').length
  const totalMin = Math.round(calls.reduce((s, c) => s + (c.duration || 0), 0) / 60)

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      <PageHeader title="Llamadas" subtitle={`${total} llamadas registradas`}/>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total recibidas', value: total, icon: '📞' },
            { label: 'Completadas', value: completed, icon: '✅' },
            { label: 'Minutos gestionados', value: totalMin + 'min', icon: '⏱' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24 }}>{s.icon}</div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>{s.value}</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {total === 0
          ? <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12 }}>
              <EmptyState icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="#94a3b8"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>} title="Sin llamadas aún" description="Las llamadas de tu recepcionista aparecerán aquí en tiempo real"/>
            </div>
          : Object.entries(groups).map(([date, dayCalls]) => (
              <div key={date} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{date}</span>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}/>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{dayCalls.length} llamada{dayCalls.length!==1?'s':''}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dayCalls.map(call => {
                    const st = STATUS_MAP[call.status] || STATUS_MAP.completed
                    const isOpen = expanded === call.id
                    return (
                      <div key={call.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'box-shadow 0.15s' }}>
                        {/* Main row */}
                        <button onClick={() => setExpanded(isOpen ? null : call.id)} style={{ width: '100%', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'inherit' }}>
                          {/* Icon */}
                          <div style={{ width: 38, height: 38, borderRadius: '50%', background: st.bg, border: `1px solid ${st.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill={st.color}><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                          </div>
                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <p style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{call.from_number || 'Número oculto'}</p>
                              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                            </div>
                            {/* Summary preview */}
                            {call.summary && <p style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 420 }}>{call.summary}</p>}
                            {!call.summary && call.status === 'in-progress' && <p style={{ fontSize: 12, color: '#d97706' }}>Llamada en curso...</p>}
                          </div>
                          {/* Right */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                            {call.duration && <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', fontFamily: 'monospace' }}>{dur(call.duration)}</span>}
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{call.created_at ? timeAgo(call.created_at) : ''}</span>
                          </div>
                          {/* Chevron */}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                            <path d="M6 9l6 6 6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>

                        {/* Expanded detail */}
                        {isOpen && (
                          <div style={{ padding: '0 18px 18px', borderTop: '1px solid #f1f5f9' }}>
                            <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {/* Summary box */}
                              {call.summary && (
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
                                  <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 6 }}>Resumen de la llamada</p>
                                  <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{call.summary}</p>
                                </div>
                              )}
                              {/* Action */}
                              {call.action_suggested && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px' }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  <p style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 500 }}>{call.action_suggested}</p>
                                </div>
                              )}
                              {/* Meta */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                                {[
                                  { label: 'Número', value: call.from_number || '—' },
                                  { label: 'Duración', value: dur(call.duration) || '—' },
                                  { label: 'ID', value: call.call_sid?.slice(-8) || '—' },
                                ].map(m => (
                                  <div key={m.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                                    <p style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 3 }}>{m.label}</p>
                                    <p style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{m.value}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
        }
      </div>
    </div>
  )
}