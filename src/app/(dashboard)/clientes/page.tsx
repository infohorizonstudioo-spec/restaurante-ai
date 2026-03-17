'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader, PageHeader, Input, Badge, EmptyState, Modal, Button } from '@/components/ui'

function relDate(d?: string) {
  if (!d) return null
  const diff = (Date.now() - new Date(d).getTime()) / 86400000
  if (diff < 1) return 'Hoy'
  if (diff < 2) return 'Ayer'
  if (diff < 7) return `Hace ${Math.floor(diff)} días`
  if (diff < 30) return `Hace ${Math.floor(diff/7)} semanas`
  return new Date(d).toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' })
}

function avatar(name: string, i: number) {
  const colors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#84cc16','#f97316']
  return { initials: name.slice(0,2).toUpperCase(), color: colors[i % colors.length] }
}

export default function ClientesPage() {
  const [clients, setClients]     = useState<any[]>([])
  const [reservas, setReservas]   = useState<any[]>([])
  const [calls, setCalls]         = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState<any>(null)
  const [tenantId, setTenantId]   = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!p?.tenant_id) return
    setTenantId(p.tenant_id)
    const [{ data: c }, { data: r }, { data: cl }] = await Promise.all([
      supabase.from('customers').select('*').eq('tenant_id', p.tenant_id).order('last_visit', { ascending: false }),
      supabase.from('reservations').select('*').eq('tenant_id', p.tenant_id).order('reservation_date', { ascending: false }),
      supabase.from('calls').select('*').eq('tenant_id', p.tenant_id).order('created_at', { ascending: false }),
    ])
    setClients(c || [])
    setReservas(r || [])
    setCalls(cl || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!search) return clients
    const q = search.toLowerCase()
    return clients.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(q)
    )
  }, [clients, search])

  function getClientReservas(client: any) {
    return reservas.filter(r =>
      r.customer_id === client.id ||
      r.customer_phone === client.phone ||
      r.customer_name === client.name
    ).sort((a,b) => new Date(b.reservation_date).getTime() - new Date(a.reservation_date).getTime())
  }

  function getClientCalls(client: any) {
    return calls.filter(c => c.from_number === client.phone)
  }

  function getClientStats(client: any) {
    const res = getClientReservas(client)
    const cls = getClientCalls(client)
    const last = res[0]
    const upcoming = res.find(r => new Date(r.reservation_date) >= new Date())
    return { reservas: res, calls: cls, last, upcoming, total: res.length + cls.length }
  }

  if (loading) return <PageLoader/>

  const totalClientes = clients.length
  const totalReservas = reservas.length
  const nuevosEsteMes = clients.filter(c => c.created_at && (Date.now() - new Date(c.created_at).getTime()) < 30*86400000).length

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      <PageHeader title="Clientes" subtitle={`${totalClientes} clientes registrados`}/>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Clientes totales', value: totalClientes, color: '#1d4ed8' },
            { label: 'Reservas registradas', value: totalReservas, color: '#059669' },
            { label: 'Nuevos este mes', value: nuevosEsteMes, color: '#7c3aed' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
              <p style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: '-0.025em' }}>{s.value}</p>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 14 }}>
          <Input placeholder="Buscar por nombre, teléfono o email..." value={search} onChange={e=>setSearch(e.target.value)} style={{ maxWidth: 360 }}/>
        </div>

        {filtered.length === 0
          ? <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12 }}>
              <EmptyState icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="#94a3b8"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>} title="Sin clientes aún" description="Los clientes aparecerán aquí cuando hagan su primera reserva o llamada"/>
            </div>
          : <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {['Cliente', 'Teléfono', 'Última visita', 'Próxima cita', 'Reservas', 'Llamadas', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((client, i) => {
                    const av = avatar(client.name || '?', i)
                    const stats = getClientStats(client)
                    return (
                      <tr key={client.id} style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none', cursor: 'pointer' }} onClick={() => setSelected(client)}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: av.color + '18', border: `1.5px solid ${av.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: av.color, flexShrink: 0 }}>{av.initials}</div>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{client.name}</p>
                              {client.email && <p style={{ fontSize: 11, color: '#94a3b8' }}>{client.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 13, color: '#64748b', fontFamily: 'monospace' }}>{client.phone || '—'}</span></td>
                        <td style={{ padding: '12px 16px' }}>
                          {stats.last
                            ? <div>
                                <p style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{relDate(stats.last.reservation_date)}</p>
                                <p style={{ fontSize: 11, color: '#94a3b8' }}>{stats.last.reservation_time?.slice(0,5)} · {stats.last.party_size}p{stats.last.zone_name ? ' · ' + stats.last.zone_name : ''}</p>
                              </div>
                            : <span style={{ color: '#d1d5db', fontSize: 13 }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {stats.upcoming
                            ? <Badge variant='green'>{new Date(stats.upcoming.reservation_date).toLocaleDateString('es-ES',{day:'numeric',month:'short'})} {stats.upcoming.reservation_time?.slice(0,5)}</Badge>
                            : <span style={{ color: '#d1d5db', fontSize: 13 }}>Sin cita</span>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>{stats.reservas.length}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 13, color: '#64748b' }}>{stats.calls.length}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* MODAL — historial completo del cliente */}
      {selected && (() => {
        const av = avatar(selected.name || '?', filtered.indexOf(selected))
        const stats = getClientStats(selected)
        return (
          <Modal open={!!selected} onClose={() => setSelected(null)} title="Historial del cliente" footer={<Button variant="secondary" style={{ flex:1 }} onClick={() => setSelected(null)}>Cerrar</Button>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: av.color + '18', border: `2px solid ${av.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: av.color }}>{av.initials}</div>
                <div>
                  <p style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{selected.name}</p>
                  {selected.phone && <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{selected.phone}</p>}
                  {selected.email && <p style={{ fontSize: 12, color: '#94a3b8' }}>{selected.email}</p>}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                  <div style={{ textAlign: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: '#1d4ed8' }}>{stats.reservas.length}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8' }}>reservas</p>
                  </div>
                  <div style={{ textAlign: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: '#059669' }}>{stats.calls.length}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8' }}>llamadas</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selected.notes && <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>NOTAS</p>
                <p style={{ fontSize: 13, color: '#78350f' }}>{selected.notes}</p>
              </div>}

              {/* Historial reservas */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Historial de visitas</p>
                {stats.reservas.length === 0
                  ? <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>Sin visitas registradas</p>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                      {stats.reservas.map(r => {
                        const isPast = new Date(r.reservation_date) < new Date()
                        const isFuture = !isPast
                        return (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: isFuture ? '#eff6ff' : '#fafafa', border: '1px solid', borderColor: isFuture ? '#bfdbfe' : '#e2e8f0', borderRadius: 9 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.status === 'confirmada' ? '#059669' : r.status === 'cancelada' ? '#dc2626' : '#94a3b8', flexShrink: 0 }}/>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <p style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>
                                  {new Date(r.reservation_date).toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'long' })}
                                  {' '}{r.reservation_time?.slice(0,5)}
                                </p>
                                {isFuture && <Badge variant='blue'>Próxima</Badge>}
                              </div>
                              <p style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                                {r.party_size} persona{r.party_size!==1?'s':''}
                                {r.table_name ? ` · Mesa ${r.table_name}` : ''}
                                {r.zone_name ? ` · ${r.zone_name}` : ''}
                                {r.source === 'voice_agent' ? ' · 📞 Llamada' : ' · Manual'}
                              </p>
                              {r.notes && <p style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: 1 }}>{r.notes}</p>}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: r.status==='confirmada'?'#059669':r.status==='cancelada'?'#dc2626':'#94a3b8', flexShrink: 0 }}>{r.status}</span>
                          </div>
                        )
                      })}
                    </div>
                }
              </div>

              {/* Llamadas */}
              {stats.calls.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Llamadas recibidas</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                    {stats.calls.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 9 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#94a3b8" style={{ marginTop: 2, flexShrink: 0 }}><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {c.summary && <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{c.summary}</p>}
                          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{c.created_at ? relDate(c.created_at) : ''}{c.duration ? ` · ${Math.round(c.duration/60)}min` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}