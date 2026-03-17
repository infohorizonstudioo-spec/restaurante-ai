'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader, PageHeader, Button, Badge, EmptyState, Modal, Input, Select, Alert } from '@/components/ui'
import Link from 'next/link'

const STATUS: Record<string, { label: string; color: string; next?: string }> = {
  nuevo:       { label: 'Nuevo',       color: '#1d4ed8', next: 'preparacion' },
  preparacion: { label: 'Preparando',  color: '#d97706', next: 'listo' },
  listo:       { label: 'Listo',       color: '#059669', next: 'reparto' },
  reparto:     { label: 'En reparto',  color: '#7c3aed', next: 'entregado' },
  entregado:   { label: 'Entregado',   color: '#64748b', next: undefined },
}

export default function PedidosPage() {
  const [tenant, setTenant]     = useState<any>(null)
  const [orders, setOrders]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({ customer_name:'', customer_phone:'', items:'', total:'', notes:'', type:'local' })

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!p?.tenant_id) return
    const { data: t } = await supabase.from('tenants').select('*').eq('id', p.tenant_id).single()
    setTenant(t)
    if (!t) { setLoading(false); return }
    const q = supabase.from('orders').select('*').eq('tenant_id', p.tenant_id).order('created_at', { ascending: false })
    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveOrder() {
    if (!form.customer_name.trim()) return
    setSaving(true)
    await supabase.from('orders').insert({
      tenant_id: tenant.id,
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim() || null,
      items: form.items.trim() ? form.items.split('\n').map(i=>i.trim()).filter(Boolean) : [],
      total: parseFloat(form.total) || 0,
      notes: form.notes.trim() || null,
      type: form.type,
      status: 'nuevo',
    })
    setSaving(false); setShowModal(false)
    setForm({ customer_name:'', customer_phone:'', items:'', total:'', notes:'', type:'local' })
    load()
  }

  async function advance(order: any) {
    const next = STATUS[order.status]?.next
    if (!next) return
    await supabase.from('orders').update({ status: next }).eq('id', order.id)
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next } : o))
  }

  if (loading) return <PageLoader/>

  // ── PLAN GATE — solo Business ──
  const plan = tenant?.plan
  const hasPedidos = plan === 'business' || plan === 'pro' // Pro también para restaurantes
  if (!hasPedidos) {
    return (
      <div style={{ background:'#f8fafc', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ maxWidth:480, textAlign:'center', padding:'0 24px' }}>
          <div style={{ width:64, height:64, borderRadius:16, background:'#eff6ff', border:'1px solid #bfdbfe', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:30 }}>📦</div>
          <h2 style={{ fontSize:22, fontWeight:700, color:'#0f172a', marginBottom:10, letterSpacing:'-0.02em' }}>Gestión de pedidos</h2>
          <p style={{ fontSize:14, color:'#64748b', lineHeight:1.65, marginBottom:28 }}>
            La gestión de pedidos y entregas a domicilio está disponible a partir del plan <strong>Pro</strong>.
            Permite gestionar pedidos, entregas y hacer seguimiento en tiempo real.
          </p>
          <Link href="/precios" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 24px', background:'linear-gradient(135deg,#1e40af,#3b82f6)', color:'white', borderRadius:10, fontSize:14, fontWeight:600, textDecoration:'none', boxShadow:'0 2px 8px rgba(59,130,246,0.3)' }}>
            Ver planes →
          </Link>
          <p style={{ fontSize:12, color:'#94a3b8', marginTop:16 }}>Tu plan actual: <strong>{plan || 'Trial gratuito'}</strong></p>
        </div>
      </div>
    )
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const counts = Object.keys(STATUS).reduce((acc, k) => ({ ...acc, [k]: orders.filter(o=>o.status===k).length }), {} as Record<string,number>)

  return (
    <div style={{ background:'#f8fafc', minHeight:'100vh' }}>
      <PageHeader title="Pedidos" subtitle={`${orders.length} pedidos · ${counts.nuevo||0} nuevos`}
        actions={<Button icon={<span>+</span>} onClick={()=>setShowModal(true)}>Nuevo pedido</Button>}/>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:24 }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:20 }}>
          {Object.entries(STATUS).map(([k,v]) => (
            <button key={k} onClick={()=>setFilter(filter===k?'all':k)} style={{ background:'white', border: filter===k ? `2px solid ${v.color}` : '1px solid #e2e8f0', borderRadius:10, padding:'12px 14px', cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const, transition:'all 0.12s', boxShadow: filter===k ? `0 0 0 3px ${v.color}18` : 'none' }}>
              <p style={{ fontSize:20, fontWeight:700, color:v.color }}>{counts[k]||0}</p>
              <p style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>{v.label}</p>
            </button>
          ))}
        </div>

        {filtered.length === 0
          ? <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12 }}>
              <EmptyState icon={<span style={{fontSize:32}}>📦</span>} title="Sin pedidos" description="Los pedidos aparecerán aquí" action={<Button onClick={()=>setShowModal(true)}>+ Nuevo pedido</Button>}/>
            </div>
          : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {filtered.map(order => {
                const st = STATUS[order.status] || STATUS.nuevo
                const nextSt = st.next ? STATUS[st.next] : null
                return (
                  <div key={order.id} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:16 }}>
                    <div style={{ width:38, height:38, borderRadius:'50%', background:st.color+'18', border:`1px solid ${st.color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}>
                      {order.type === 'delivery' ? '🛵' : '🏠'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                        <p style={{ fontSize:14, fontWeight:600, color:'#0f172a' }}>{order.customer_name}</p>
                        <span style={{ padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600, background:st.color+'18', color:st.color }}>{st.label}</span>
                        {order.type === 'delivery' && <Badge variant='indigo'>Reparto</Badge>}
                      </div>
                      {order.items?.length>0 && <p style={{ fontSize:12, color:'#64748b' }}>{Array.isArray(order.items) ? order.items.join(', ') : order.items}</p>}
                      {order.customer_phone && <p style={{ fontSize:11, color:'#94a3b8' }}>{order.customer_phone}</p>}
                    </div>
                    {order.total>0 && <p style={{ fontSize:16, fontWeight:700, color:'#0f172a', flexShrink:0 }}>{Number(order.total).toFixed(2)}€</p>}
                    {nextSt && (
                      <button onClick={()=>advance(order)} style={{ padding:'7px 14px', fontFamily:'inherit', fontSize:12, fontWeight:600, color:nextSt.color, background:nextSt.color+'18', border:`1px solid ${nextSt.color}30`, borderRadius:8, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                        → {nextSt.label}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
        }
      </div>

      <Modal open={showModal} onClose={()=>setShowModal(false)} title="Nuevo pedido"
        footer={<><Button variant='secondary' style={{flex:1}} onClick={()=>setShowModal(false)}>Cancelar</Button><Button style={{flex:1}} loading={saving} onClick={saveOrder}>Crear pedido</Button></>}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Input label='Cliente *' value={form.customer_name} placeholder='Nombre' onChange={e=>setForm({...form,customer_name:e.target.value})}/>
            <Input label='Teléfono' value={form.customer_phone} placeholder='+34 600...' onChange={e=>setForm({...form,customer_phone:e.target.value})}/>
          </div>
          <Select label='Tipo' value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
            <option value='local'>En local</option>
            <option value='delivery'>Reparto a domicilio</option>
            <option value='takeaway'>Para llevar</option>
          </Select>
          <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#374151', marginBottom:5, textTransform:'uppercase' as const, letterSpacing:'0.04em' }}>Artículos (uno por línea)</label><textarea value={form.items} onChange={e=>setForm({...form,items:e.target.value})} rows={3} placeholder={'1x Pizza Margarita\n2x Agua'} style={{ width:'100%', fontFamily:'inherit', fontSize:14, color:'#0f172a', background:'#f9fafb', border:'1px solid #e2e8f0', borderRadius:9, padding:'9px 12px', outline:'none', resize:'vertical' }}/></div>
          <Input label='Total (€)' type='number' step='0.01' value={form.total} placeholder='0.00' onChange={e=>setForm({...form,total:e.target.value})}/>
          <Input label='Notas' value={form.notes} placeholder='Dirección de entrega, alergias...' onChange={e=>setForm({...form,notes:e.target.value})}/>
        </div>
      </Modal>
    </div>
  )
}