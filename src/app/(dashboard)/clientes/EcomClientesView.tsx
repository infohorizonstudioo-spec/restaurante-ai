'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/contexts/TenantContext'
import { PageLoader } from '@/components/ui'
import NotifBell from '@/components/NotifBell'

const C = {
  violet:'#A78BFA', violetDim:'rgba(167,139,250,0.12)',
  amber:'#F0A84E', amberDim:'rgba(240,168,78,0.10)',
  green:'#34D399', greenDim:'rgba(52,211,153,0.10)',
  text:'#E8EEF6', text2:'#8895A7', text3:'#49566A',
  bg:'#0C1018', surface:'#131920', surface2:'#1A2230',
  border:'rgba(255,255,255,0.07)', borderMd:'rgba(255,255,255,0.11)',
}

export default function EcomClientesView() {
  const { tenant } = useTenant()
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loadingP, setLoadingP] = useState(false)

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
    setSelected(c); setLoadingP(true); setPedidos([])
    const { data } = await supabase.from('reservations').select('*')
      .eq('tenant_id', c.tenant_id).eq('customer_id', c.id)
      .order('date', { ascending: false }).limit(10)
    setPedidos(data || [])
    setLoadingP(false)
  }

  if (loading) return <PageLoader />
  const filtered = search
    ? clientes.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search) || (c.email || '').includes(search))
    : clientes

  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Clientes</h1>
          <p style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{clientes.length} clientes</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar clientes…"
            style={{ padding: '8px 14px', fontSize: 13, border: `1px solid ${C.borderMd}`, borderRadius: 9, outline: 'none', width: 220, background: C.surface2, color: C.text, fontFamily: 'inherit' }} />
          <NotifBell />
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 300, flexShrink: 0, overflowY: 'auto', borderRight: `1px solid ${C.border}` }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🛍️</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Sin clientes</p>
            </div>
          ) : filtered.map(c => (
            <div key={c.id} onClick={() => openClient(c)} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, background: selected?.id === c.id ? C.surface2 : 'transparent', transition: 'background 0.1s' }}
              onMouseEnter={e => { if (selected?.id !== c.id)(e.currentTarget as HTMLElement).style.background = C.surface2 }}
              onMouseLeave={e => { if (selected?.id !== c.id)(e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.violetDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.violet, flexShrink: 0 }}>
                  {c.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                  <p style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>{c.email || c.phone || 'Sin contacto'}</p>
                </div>
                <p style={{ fontSize: 11, color: C.text2, flexShrink: 0 }}>{c.total_reservations || 0} pedidos</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {!selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>🛍️</div>
              <p style={{ fontSize: 14, color: C.text3 }}>Selecciona un cliente</p>
            </div>
          ) : (
            <>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.violetDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: C.violet }}>
                    {selected.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{selected.name}</p>
                    <p style={{ fontSize: 13, color: C.text2 }}>{selected.phone}{selected.email ? ' · ' + selected.email : ''}</p>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Pedidos</p>
              {loadingP ? <p style={{ color: C.text3 }}>Cargando...</p>
                : pedidos.length === 0 ? <p style={{ fontSize: 13, color: C.text3 }}>Sin pedidos registrados.</p>
                : pedidos.map((p, i) => (
                  <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>🛍️</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{p.date} · {(p.time || '').slice(0, 5)}</p>
                      <p style={{ fontSize: 11, color: C.text3 }}>{p.notes || p.status}</p>
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
