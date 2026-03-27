'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSessionTenant } from '@/lib/session-cache'
import NotifBell from '@/components/NotifBell'
import { useTenant } from '@/contexts/TenantContext'

import { C } from "@/lib/colors"

type Category = 'Corte' | 'Barba' | 'Combo' | 'Tratamiento'

interface Service {
  id: string
  name: string
  category: Category
  price: number
  duration: number
  description?: string
}

const CATEGORY_STYLES: Record<Category,{color:string;bg:string;icon:string}> = {
  Corte:       {color:C.amber, bg:C.amberDim, icon:'✂️'},
  Barba:       {color:C.teal,  bg:C.tealDim,  icon:'🪒'},
  Combo:       {color:C.yellow,bg:C.yellowDim, icon:'⚡'},
  Tratamiento: {color:C.violet,bg:C.violetDim, icon:'💈'},
}

const MOCK_SERVICES: Service[] = [
  {id:'1', name:'Corte clásico',      category:'Corte',       price:15, duration:30, description:'Corte con tijera o máquina'},
  {id:'2', name:'Corte degradado',     category:'Corte',       price:17, duration:35, description:'Fade / degradado con diseño'},
  {id:'3', name:'Corte + lavado',      category:'Corte',       price:18, duration:35},
  {id:'4', name:'Arreglo de barba',    category:'Barba',       price:12, duration:20, description:'Perfilado y recorte de barba'},
  {id:'5', name:'Afeitado clásico',    category:'Barba',       price:14, duration:25, description:'Afeitado con navaja y toalla caliente'},
  {id:'6', name:'Diseño de barba',     category:'Barba',       price:15, duration:25, description:'Diseño personalizado de barba'},
  {id:'7', name:'Combo corte + barba', category:'Combo',       price:22, duration:45, description:'Corte completo + arreglo de barba'},
  {id:'8', name:'Combo premium',       category:'Combo',       price:30, duration:60, description:'Corte + barba + lavado + tratamiento'},
  {id:'9', name:'Tinte barba',         category:'Tratamiento', price:12, duration:20, description:'Coloración de barba'},
  {id:'10',name:'Tratamiento capilar', category:'Tratamiento', price:20, duration:30, description:'Hidratación y nutrición capilar'},
  {id:'11',name:'Black mask',          category:'Tratamiento', price:10, duration:15, description:'Limpieza facial con mascarilla'},
]

const CATEGORIES: Category[] = ['Corte','Barba','Combo','Tratamiento']

export default function BarbeProductosView() {
  const { tenant } = useTenant()
  const [filter, setFilter] = useState<'all'|Category>('all')
  const [services, setServices] = useState<Service[]>(MOCK_SERVICES)
  const [modal, setModal] = useState<Service | null | 'new'>(null)
  const [tid, setTid] = useState<string|null>(null)

  const loadServices = useCallback(async (tenantId: string) => {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('category')
      .order('sort_order')
    if (data && data.length > 0) {
      setServices(data.map((d: any) => ({
        id: d.id,
        name: d.name,
        category: d.category || 'Corte',
        price: d.price || 0,
        duration: d.duration || 30,
        description: d.description,
      })))
    }
  }, [])

  useEffect(() => {
    (async () => {
      const sess = await getSessionTenant()
      if (!sess) return
      setTid(sess.tenantId)
      await loadServices(sess.tenantId)
    })()
  }, [loadServices])

  if (tenant?.type !== 'barberia') return null

  async function handleSave(data: Omit<Service, 'id'>) {
    if (!tid) return
    if (modal === 'new') {
      const { data: inserted } = await supabase.from('menu_items').insert({
        name: data.name, category: data.category, price: data.price,
        duration: data.duration, description: data.description,
        tenant_id: tid, active: true
      }).select('id').maybeSingle()
      if (inserted) setServices(prev => [...prev, { ...data, id: inserted.id }])
    } else if (modal && typeof modal === 'object') {
      await supabase.from('menu_items').update({
        name: data.name, category: data.category, price: data.price,
        duration: data.duration, description: data.description,
        updated_at: new Date().toISOString()
      }).eq('id', modal.id)
      setServices(prev => prev.map(s => s.id === modal.id ? { ...s, ...data } : s))
    }
    setModal(null)
  }

  async function handleDelete(id: string) {
    if (!tid) return
    await supabase.from('menu_items').update({ active: false }).eq('id', id)
    setServices(prev => prev.filter(s => s.id !== id))
  }

  const filtered = filter === 'all' ? services : services.filter(s => s.category === filter)
  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(s => s.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {} as Record<Category, Service[]>)

  return (
    <div style={{background:C.bg,minHeight:'100vh'}}>
      {/* Header */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'14px 24px',position:'sticky',top:0,zIndex:30,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontSize:17,fontWeight:700,color:C.text}}>Servicios y tarifas</h1>
          <p style={{fontSize:12,color:C.text3,marginTop:2}}>{services.length} servicios disponibles</p>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <button onClick={() => setModal('new')} style={{background:`linear-gradient(135deg,${C.amber},#E8923A)`,color:'#0C1018',fontWeight:700,fontSize:13,padding:'9px 18px',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit'}}>+ Servicio</button>
          <NotifBell/>
        </div>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'20px 24px'}}>
        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10,marginBottom:20}}>
          {CATEGORIES.map(cat=>{
            const cs = CATEGORY_STYLES[cat]
            const count = services.filter(s=>s.category===cat).length
            return (
              <div key={cat} style={{background:cs.bg,border:`1px solid ${cs.color}22`,borderRadius:12,padding:'14px 16px'}}>
                <p style={{fontSize:22,fontWeight:800,color:cs.color,lineHeight:1}}>{count}</p>
                <p style={{fontSize:11,color:C.text3,marginTop:4}}>{cs.icon} {cat}</p>
              </div>
            )
          })}
        </div>

        {/* Filtros */}
        <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
          <button onClick={()=>setFilter('all')} style={{
            padding:'5px 14px',fontSize:12,fontWeight:600,borderRadius:9,
            border:`1px solid ${filter==='all'?C.amber+'44':C.border}`,
            background:filter==='all'?C.amberDim:'transparent',
            color:filter==='all'?C.amber:C.text2,cursor:'pointer',fontFamily:'inherit'
          }}>Todos</button>
          {CATEGORIES.map(cat=>{
            const cs = CATEGORY_STYLES[cat]
            return (
              <button key={cat} onClick={()=>setFilter(cat)} style={{
                padding:'5px 14px',fontSize:12,fontWeight:600,borderRadius:9,
                border:`1px solid ${filter===cat?cs.color+'44':C.border}`,
                background:filter===cat?cs.bg:'transparent',
                color:filter===cat?cs.color:C.text2,cursor:'pointer',fontFamily:'inherit'
              }}>{cs.icon} {cat}</button>
            )
          })}
        </div>

        {/* Lista por categoría */}
        {Object.entries(grouped).map(([cat, items])=>{
          const cs = CATEGORY_STYLES[cat as Category]
          return (
            <div key={cat} style={{marginBottom:20}}>
              <p style={{fontSize:11,fontWeight:700,color:C.text3,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:10}}>{cs.icon} {cat}</p>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {items.map(item=>(
                  <div key={item.id} onClick={() => setModal(item)} style={{
                    background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'12px 16px',
                    display:'flex',alignItems:'center',gap:14,transition:'all 0.12s',cursor:'pointer'
                  }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.surface2;(e.currentTarget as HTMLElement).style.borderColor=C.borderMd}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=C.surface;(e.currentTarget as HTMLElement).style.borderColor=C.border}}>
                    <div style={{width:36,height:36,borderRadius:10,background:cs.bg,border:`1px solid ${cs.color}33`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                      {cs.icon}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:14,fontWeight:700,color:C.text}}>{item.name}</p>
                      {item.description && <p style={{fontSize:12,color:C.text3,marginTop:2}}>{item.description}</p>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                      <span style={{fontSize:11,color:C.text3}}>{item.duration} min</span>
                      <span style={{fontSize:14,fontWeight:800,color:C.amber}}>{item.price}€</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {modal && (
        <BarbeServicioModal
          item={modal === 'new' ? null : modal}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function BarbeServicioModal({ item, onSave, onDelete, onClose }: {
  item: Service | null
  onSave: (d: Omit<Service, 'id'>) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(item?.name || '')
  const [category, setCategory] = useState<Category>(item?.category || 'Corte')
  const [price, setPrice] = useState(item?.price?.toString() || '')
  const [duration, setDuration] = useState(item?.duration?.toString() || '')
  const [description, setDescription] = useState(item?.description || '')

  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#8895A7', letterSpacing: '0.03em', display: 'block', marginBottom: 5 }
  const inp: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }

  function submit() {
    if (!name.trim() || !price || !duration) return
    onSave({ name, category, price: parseFloat(price), duration: parseInt(duration), description: description || undefined })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{item ? 'Editar servicio' : 'Nuevo servicio'}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.text3 }} aria-label="Cerrar">x</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>NOMBRE DEL SERVICIO *</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Corte clasico" />
          </div>

          <div>
            <label style={lbl}>CATEGORIA</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {CATEGORIES.map(cat => {
                const cs = CATEGORY_STYLES[cat]
                return (
                  <button key={cat} onClick={() => setCategory(cat)} style={{
                    padding: '10px 12px', borderRadius: 10,
                    border: `1px solid ${category === cat ? cs.color + '44' : C.border}`,
                    background: category === cat ? cs.bg : 'transparent',
                    color: category === cat ? cs.color : C.text3,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontSize: 12, fontWeight: 600
                  }}>{cs.icon} {cat}</button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>PRECIO (EUR) *</label>
              <input style={inp} type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="15" />
            </div>
            <div>
              <label style={lbl}>DURACION (min) *</label>
              <input style={inp} type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="30" />
            </div>
          </div>

          <div>
            <label style={lbl}>DESCRIPCION (opcional)</label>
            <input style={inp} value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripcion del servicio" />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            {item && (
              <button onClick={() => { onDelete(item.id); onClose() }} style={{ padding: '11px 16px', background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 10, cursor: 'pointer', color: C.red, fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}>Eliminar</button>
            )}
            <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', color: C.text2, fontSize: 13, fontFamily: 'inherit' }}>Cancelar</button>
            <button onClick={submit} disabled={!name.trim() || !price || !duration} style={{
              flex: 2, padding: '11px', background: `linear-gradient(135deg,${C.amber},#E8923A)`,
              border: 'none', borderRadius: 10, cursor: 'pointer', color: '#0C1018', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              opacity: name.trim() && price && duration ? 1 : 0.5
            }}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
