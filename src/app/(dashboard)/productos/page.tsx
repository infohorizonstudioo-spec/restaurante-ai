'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSessionTenant } from '@/lib/session-cache'
import { PageLoader } from '@/components/ui'
import NotifBell from '@/components/NotifBell'
import { useTenant } from '@/contexts/TenantContext'
import { UpgradeGate } from '@/components/UpgradeGate'
import PeluProductosView from './PeluProductosView'
import BarbeProductosView from './BarbeProductosView'
import { C } from '@/lib/colors'
import { useFocusTrap } from '@/hooks/useFocusTrap'

const AVAIL_CFG = {
  always_available: { label:'Siempre disponible', color:C.green,  bg:C.greenDim,  icon:'✓' },
  limited_daily:    { label:'Limitado por día',   color:C.amber,  bg:C.amberDim,  icon:'⚡' },
  by_request:       { label:'Por encargo',        color:C.violet, bg:'rgba(167,139,250,0.12)', icon:'📋' },
  unavailable:      { label:'No disponible',      color:C.red,    bg:C.redDim,    icon:'✕' },
}

type AvailType = keyof typeof AVAIL_CFG

const CATEGORIES_BY_TYPE: Record<string, string[]> = {
  restaurante: ['Entrantes','Carnes','Pescados','Postres','Bebidas','Menú del día','Especiales','Otro'],
  bar: ['Tapas','Raciones','Bocadillos','Bebidas','Cócteles','Especiales','Otro'],
  cafeteria: ['Cafés','Desayunos','Meriendas','Bollería','Bocadillos','Bebidas','Otro'],
  hotel: ['Habitaciones','Servicios','Restaurante','Minibar','Packs','Otro'],
  ecommerce: ['Electrónica','Ropa','Hogar','Accesorios','Deportes','Ofertas','Otro'],
  gimnasio: ['Abonos','Clases','Entrenamiento personal','Suplementos','Otro'],
  academia: ['Idiomas','Refuerzo','Oposiciones','Formación profesional','Talleres','Otro'],
  spa: ['Masajes','Faciales','Corporales','Circuitos','Bonos','Otro'],
  taller: ['Revisiones','Neumáticos','Mecánica','Electricidad','Chapa y pintura','Otro'],
  clinica_dental: ['Revisiones','Limpieza','Empastes','Ortodoncia','Implantes','Estética','Otro'],
  clinica_medica: ['Consultas','Revisiones','Pruebas','Especialidades','Otro'],
  veterinaria: ['Consultas','Vacunas','Cirugía','Peluquería','Productos','Otro'],
  fisioterapia: ['Manual','Deportiva','Rehabilitación','Electroterapia','Pilates','Otro'],
  psicologia: ['Individual','Pareja','Familiar','Infantil','Online','Otro'],
  asesoria: ['Fiscal','Laboral','Contabilidad','Jurídico','Mercantil','Otro'],
  seguros: ['Auto','Hogar','Salud','Vida','Negocio','Otro'],
  inmobiliaria: ['Venta','Alquiler','Vacacional','Tasaciones','Otro'],
}
const DEFAULT_CATEGORIES = ['General','Servicios','Productos','Otro']

export default function ProductosPage() {
  const { tenant, tx } = useTenant()
  if (tenant?.type === 'barberia') return <BarbeProductosView />
  if (tenant?.type === 'peluqueria') return <PeluProductosView />

  const CATEGORIES = CATEGORIES_BY_TYPE[tenant?.type || ''] || DEFAULT_CATEGORIES

  const [tid, setTid]         = useState<string|null>(null)
  const [items, setItems]     = useState<any[]>([])
  const [counts, setCounts]   = useState<Record<string,number>>({})
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string|null>(null)
  const [modal, setModal]     = useState<any|null>(null)
  const [filter, setFilter]   = useState('all')
  const today = new Date().toISOString().slice(0,10)

  const load = useCallback(async (tenantId: string) => {
    const [ir, cr] = await Promise.all([
      supabase.from('menu_items').select('*').eq('tenant_id', tenantId).eq('active', true).order('category').order('sort_order'),
      supabase.from('menu_daily_counts').select('item_id,count').eq('tenant_id', tenantId).eq('date', today),
    ])
    setItems(ir.data || [])
    const countMap: Record<string,number> = {}
    ;(cr.data || []).forEach((r:any) => { countMap[r.item_id] = r.count })
    setCounts(countMap)
    setLoading(false)
  }, [today])

  useEffect(() => {
    (async () => {
      const sess = await getSessionTenant()
      if(!sess) { setLoading(false); return }
      setTid(sess.tenantId)
      await load(sess.tenantId)
    })()
  }, [load])

  async function saveItem(data: any) {
    if (!tid) return
    if (data.id) {
      await supabase.from('menu_items').update({ ...data, updated_at: new Date().toISOString() }).eq('id', data.id)
    } else {
      await supabase.from('menu_items').insert({ ...data, tenant_id: tid })
    }
    setModal(null); await load(tid)
  }

  async function deleteItem(id: string) {
    if (!tid) return
    await supabase.from('menu_items').update({ active: false }).eq('id', id)
    setDeleteConfirm(null)
    await load(tid)
  }

  async function resetCount(itemId: string) {
    if (!tid) return
    await supabase.from('menu_daily_counts').delete().eq('item_id', itemId).eq('date', today)
    await load(tid)
  }

  if (loading) return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'Sora',-apple-system,sans-serif" }}>
      <style>{`@keyframes rzShimmer{0%{opacity:0.5}50%{opacity:1}100%{opacity:0.5}}.rz-skel{animation:rzShimmer 1.5s ease-in-out infinite}`}</style>
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="rz-skel" style={{ width:160, height:18, borderRadius:6, background:C.borderMd }} />
          <div className="rz-skel" style={{ width:220, height:12, borderRadius:4, background:C.surface2, marginTop:8 }} />
        </div>
        <div className="rz-skel" style={{ width:120, height:36, borderRadius:10, background:C.borderMd }} />
      </div>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'20px 24px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:20 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:12, padding:'14px 16px' }}>
              <div className="rz-skel" style={{ width:40, height:22, borderRadius:6, background:C.borderMd, marginBottom:6 }} />
              <div className="rz-skel" style={{ width:70, height:10, borderRadius:4, background:C.surface2 }} />
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:6, marginBottom:16 }}>
          {[80,110,100,90,100].map((w,i) => <div key={i} className="rz-skel" style={{ width:w, height:30, borderRadius:9, background:C.surface2 }} />)}
        </div>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'12px 16px', marginBottom:6, display:'flex', alignItems:'center', gap:14 }}>
            <div className="rz-skel" style={{ width:36, height:36, borderRadius:10, background:C.borderMd, flexShrink:0 }} />
            <div style={{ flex:1 }}>
              <div className="rz-skel" style={{ width:`${50 + i*15}%`, maxWidth:200, height:14, borderRadius:4, background:C.borderMd, marginBottom:6 }} />
              <div className="rz-skel" style={{ width:`${70 + i*5}%`, maxWidth:300, height:10, borderRadius:4, background:C.surface2 }} />
            </div>
            <div className="rz-skel" style={{ width:60, height:30, borderRadius:8, background:C.surface2, flexShrink:0 }} />
          </div>
        ))}
      </div>
    </div>
  )

  const filtered = filter === 'all' ? items : filter === 'limited' ? items.filter(i => i.availability_type === 'limited_daily') : items.filter(i => i.availability_type === filter)

  const soldOut = items.filter(i => i.availability_type === 'limited_daily' && (counts[i.id]||0) >= (i.daily_limit||0)).length
  const byRequest = items.filter(i => i.availability_type === 'by_request').length
  const available = items.filter(i => {
    if (i.availability_type === 'unavailable') return false
    if (i.availability_type === 'limited_daily') return (counts[i.id]||0) < (i.daily_limit||999)
    return true
  }).length

  return (
    <UpgradeGate feature="productos">
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'Sora',-apple-system,sans-serif" }}>
      <style>{`*{box-sizing:border-box}.rz-inp{background:rgba(255,255,255,0.04);border:1px solid ${C.border};border-radius:10px;padding:10px 14px;color:${C.text};font-size:13px;font-family:inherit;outline:none;width:100%;transition:border-color 0.15s}.rz-inp:focus{border-color:${C.amber}!important}.rz-inp::placeholder{color:${C.muted}}.rz-product-card{transition:transform 0.2s ease,box-shadow 0.2s ease,border-color 0.2s ease}.rz-product-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.3);border-color:rgba(255,255,255,0.12)!important}@keyframes rzModalIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes rzOverlayIn{from{opacity:0}to{opacity:1}}.rz-modal-overlay{animation:rzOverlayIn 0.2s ease}.rz-modal-content{animation:rzModalIn 0.25s ease}`}</style>

      {/* Header */}
      <div style={{ background:C.surface,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)', borderBottom:`1px solid ${C.border}`, padding:'14px 24px', position:'sticky', top:0, zIndex:30, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:17, fontWeight:700, color:C.text }}>{tx('Menú operativo')}</h1>
          <p style={{ fontSize:12, color:C.muted, marginTop:2 }}>{available} {tx('disponibles')} · {soldOut} {tx('agotados')} · {byRequest} {tx('por encargo')}</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={() => setModal({ _new: true })} style={{ background:`linear-gradient(135deg,${C.amber},#E8923A)`, color:C.bg, fontWeight:700, fontSize:13, padding:'9px 18px', border:'none', borderRadius:10, cursor:'pointer', fontFamily:'inherit' }}>+ {tx('Nuevo producto')}</button>
          <NotifBell />
        </div>
      </div>


      <div className="rz-page-enter" style={{ maxWidth:900, margin:'0 auto', padding:'20px 24px' }}>

        {/* KPIs del día */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:20 }}>
          {([
            { label:tx('Disponibles hoy'), value:available, color:C.green, bg:C.greenDim },
            { label:tx('Agotados hoy'), value:soldOut, color:C.red, bg:C.redDim },
            { label:tx('Por encargo'), value:byRequest, color:C.violet, bg:'rgba(167,139,250,0.12)' },
            { label:tx('Total en carta'), value:items.length, color:C.amber, bg:C.amberDim },
          ]).map(k => (
            <div key={k.label} style={{ background:k.bg, border:`1px solid ${k.color}22`, borderRadius:12, padding:'14px 16px' }}>
              <p style={{ fontSize:22, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</p>
              <p style={{ fontSize:11, color:C.muted, marginTop:4 }}>{k.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display:'flex', gap:4, marginBottom:16, flexWrap:'wrap' }}>
          {([['all',tx('Todas'), items.length], ['always_available',tx('Siempre disponible'), items.filter(i=>i.availability_type==='always_available').length], ['limited_daily',tx('Limitado por día'), items.filter(i=>i.availability_type==='limited_daily').length], ['by_request',tx('Por encargo'), byRequest], ['unavailable',tx('No disponible'), items.filter(i=>i.availability_type==='unavailable').length]] as [string,string,number][]).map(([k,l,count]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding:'7px 14px', fontSize:12, fontWeight:600, borderRadius:9, position:'relative',
              border:`1px solid ${filter===k ? C.amber+'44' : 'transparent'}`,
              background: filter===k ? C.amberDim : 'transparent',
              color: filter===k ? C.amber : C.sub, cursor:'pointer', fontFamily:'inherit',
              transition:'all 0.2s ease', display:'flex', alignItems:'center', gap:6
            }}>
              {l}
              {count > 0 && <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:6, background: filter===k ? C.amber+'22' : C.borderMd, color: filter===k ? C.amber : C.muted, lineHeight:'16px' }}>{count}</span>}
              <span style={{ position:'absolute', bottom:-1, left:'50%', transform:'translateX(-50%)', width: filter===k ? '60%' : '0%', height:2, background:C.amber, borderRadius:1, transition:'width 0.25s ease' }} />
            </button>
          ))}
        </div>

        {/* Lista por categoría */}
        {filtered.length === 0 ? (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'80px 24px', textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:16, background:C.amberDim, display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
              <span style={{ fontSize:28 }}>🍽️</span>
            </div>
            <p style={{ fontSize:17, fontWeight:700, color:C.text, marginBottom:8 }}>{tx('Sin productos en carta')}</p>
            <p style={{ fontSize:13, color:C.muted, maxWidth:320, margin:'0 auto', lineHeight:1.5 }}>{tx('Añade productos para que se gestione la disponibilidad en tiempo real.')}</p>
            <button onClick={() => setModal({ _new: true })} style={{ marginTop:20, padding:'11px 28px', fontSize:13, fontWeight:700, background:`linear-gradient(135deg,${C.amber},#E8923A)`, color:C.bg, border:'none', borderRadius:10, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 16px rgba(240,168,78,0.25)' }}>+ {tx('Nuevo producto')}</button>
          </div>
        ) : (
          Object.entries(
            filtered.reduce((acc:any, item:any) => {
              if (!acc[item.category]) acc[item.category] = []
              acc[item.category].push(item)
              return acc
            }, {})
          ).map(([cat, catItems]) => (
            <div key={cat} style={{ marginBottom:24 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <p style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:'0.06em', textTransform:'uppercase' }}>{tx(cat)}</p>
                <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:6, background:C.border, color:C.muted }}>{(catItems as any[]).length}</span>
                <div style={{ flex:1, height:1, background:C.border }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {(catItems as any[]).map(item => {
                  const cfg = AVAIL_CFG[item.availability_type as AvailType] || AVAIL_CFG.always_available
                  const usedToday = counts[item.id] || 0
                  const remaining = item.daily_limit ? item.daily_limit - usedToday : null
                  const isSoldOut = item.availability_type === 'limited_daily' && remaining !== null && remaining <= 0
                  return (
                    <div key={item.id} className="rz-product-card" style={{
                      background: isSoldOut ? 'rgba(248,113,113,0.04)' : C.card,
                      border: `1px solid ${isSoldOut ? C.red+'22' : C.border}`,
                      borderRadius:12, padding:'12px 16px',
                      display:'flex', alignItems:'center', gap:14, opacity: isSoldOut ? 0.75 : 1,
                      cursor:'default'
                    }}>
                      {/* Indicador disponibilidad */}
                      <div style={{ width:36, height:36, borderRadius:10, background:cfg.bg, border:`1px solid ${cfg.color}33`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                        {cfg.icon}
                      </div>
                      {/* Info */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                          <p style={{ fontSize:14, fontWeight:700, color: isSoldOut ? C.muted : C.text }}>{item.name}</p>
                          <span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:cfg.bg, color:cfg.color, fontWeight:700 }}>{tx(cfg.label)}</span>
                          {item.requires_confirmation && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:C.yellowDim, color:C.yellow, fontWeight:600 }}>{tx('Revisión manual')}</span>}
                          {item.price && <span style={{ fontSize:12, color:C.sub }}>{item.price}€</span>}
                        </div>
                        {item.description && <p style={{ fontSize:12, color:C.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.description}</p>}
                        {/* Stock bar para limitados */}
                        {item.availability_type === 'limited_daily' && item.daily_limit && (
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                            <div style={{ flex:1, height:5, background:C.borderMd, borderRadius:3, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${Math.min(100, (usedToday/item.daily_limit)*100)}%`, background: isSoldOut ? C.red : usedToday/item.daily_limit > 0.7 ? C.yellow : C.green, transition:'width 0.3s', borderRadius:3 }}/>
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, color: isSoldOut ? C.red : remaining! <= 1 ? C.yellow : C.green, flexShrink:0 }}>
                              {isSoldOut ? tx('AGOTADO') : `${remaining} ${tx('restantes')}`}
                            </span>
                            <span style={{ fontSize:10, color:C.muted, flexShrink:0 }}>{usedToday}/{item.daily_limit}</span>
                            {usedToday > 0 && <button onClick={() => resetCount(item.id)} style={{ fontSize:10, color:C.muted, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>{tx('Restablecer')}</button>}
                          </div>
                        )}
                      </div>
                      {/* Acciones */}
                      <div style={{ display:'flex', gap:6, flexShrink:0, position:'relative' }}>
                        <button onClick={() => setModal(item)} style={{ padding:'6px 12px', fontSize:12, fontWeight:600, background:C.surface2, border:`1px solid ${C.border}`, borderRadius:8, cursor:'pointer', color:C.sub, fontFamily:'inherit' }}>{tx('Editar')}</button>
                        <button onClick={() => setDeleteConfirm(item.id)} style={{ padding:'6px 10px', fontSize:12, background:C.redDim, border:`1px solid ${C.red}33`, borderRadius:8, cursor:'pointer', color:C.red, fontFamily:'inherit' }} aria-label="Cerrar">✕</button>
                        {deleteConfirm===item.id&&(
                          <div style={{position:'absolute',right:0,top:'100%',marginTop:6,background:C.card,border:`1px solid ${C.red}44`,borderRadius:10,padding:'10px 14px',zIndex:20,width:220,boxShadow:'0 8px 24px rgba(0,0,0,0.4)'}}>
                            <p style={{fontSize:12,color:C.red,marginBottom:8}}>{tx('Eliminar')} "{item.name}"?</p>
                            <div style={{display:'flex',gap:6}}>
                              <button onClick={()=>setDeleteConfirm(null)} style={{flex:1,padding:'5px',fontSize:11,background:C.borderMd,border:`1px solid ${C.border}`,borderRadius:7,cursor:'pointer',color:C.sub,fontFamily:'inherit'}}>{tx('Cancelar')}</button>
                              <button onClick={()=>deleteItem(item.id)} style={{flex:1,padding:'5px',fontSize:11,background:C.red,border:'none',borderRadius:7,cursor:'pointer',color:C.text,fontFamily:'inherit',fontWeight:700}}>{tx('Eliminar')}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {modal && <ProductModal item={modal._new ? null : modal} onSave={saveItem} onClose={() => setModal(null)} categories={CATEGORIES} tx={tx} />}
    </div>
    </UpgradeGate>
  )
}


function ProductModal({ item, onSave, onClose, categories, tx=(s:string)=>s }: { item: any | null, onSave: (d: any) => void, onClose: () => void, categories: string[], tx?:(s:string)=>string }) {
  const focusRef = useFocusTrap(onClose)
  const CATEGORIES = categories
  const [form, setForm] = useState({
    id:                   item?.id || undefined,
    name:                 item?.name || '',
    category:             item?.category || categories[0] || 'General',
    description:          item?.description || '',
    availability_type:    (item?.availability_type || 'always_available') as AvailType,
    daily_limit:          item?.daily_limit || '',
    requires_confirmation:item?.requires_confirmation || false,
    alternatives:         (item?.alternatives || []).join(', '),
    price:                item?.price || '',
    sort_order:           item?.sort_order || 0,
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const up = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const lbl = { fontSize:11, fontWeight:600, color:C.text2, letterSpacing:'0.03em', display:'block', marginBottom:5 }

  function submit() {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = tx('Campo obligatorio')
    if (form.price && (isNaN(Number(form.price)) || Number(form.price) < 0)) errors.price = tx('Precio no válido')
    if (form.availability_type === 'limited_daily' && form.daily_limit && (isNaN(Number(form.daily_limit)) || Number(form.daily_limit) < 1)) errors.daily_limit = tx('Mínimo 1')
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return
    onSave({
      ...form,
      daily_limit: form.daily_limit ? parseInt(String(form.daily_limit)) : null,
      price: form.price ? parseFloat(String(form.price)) : null,
      alternatives: form.alternatives ? form.alternatives.split(',').map((s:string) => s.trim()).filter(Boolean) : [],
    })
  }

  return (
    <div className="rz-modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16, backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)' }} onClick={onClose}>
      <div ref={focusRef} className="rz-modal-content" style={{ background:C.card, borderRadius:16, padding:24, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.7)', border:`1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <p style={{ fontSize:16, fontWeight:700, color:C.text }}>{item ? tx('Editar producto') : tx('Nuevo producto')}</p>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:C.muted }} aria-label="Cerrar">✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={lbl}>{tx('Nombre').toUpperCase()} *</label>
              <input className="rz-inp" value={form.name} onChange={e => { up('name', e.target.value); formErrors.name && setFormErrors(f => ({...f, name: ''})) }} placeholder={tx('Nombre del producto')} />
              {formErrors.name && <p style={{ fontSize:11, color:C.red, marginTop:3 }}>{formErrors.name}</p>}
            </div>
            <div>
              <label style={lbl}>{tx('Categoría').toUpperCase()}</label>
              <select className="rz-inp" value={form.category} onChange={e => up('category', e.target.value)} style={{ cursor:'pointer' }}>
                {CATEGORIES.map(c => <option key={c} value={c} style={{ background:C.card }}>{tx(c)}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>{tx('Precio').toUpperCase()} (€)</label>
              <input className="rz-inp" type="number" value={form.price} onChange={e => { up('price', e.target.value); formErrors.price && setFormErrors(f => ({...f, price: ''})) }} placeholder="28.50" />
              {formErrors.price && <p style={{ fontSize:11, color:C.red, marginTop:3 }}>{formErrors.price}</p>}
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={lbl}>{tx('Descripción').toUpperCase()} ({tx('opcional')})</label>
              <input className="rz-inp" value={form.description} onChange={e => up('description', e.target.value)} placeholder={tx('Descripción breve del producto')} />
            </div>
          </div>

          {/* Disponibilidad */}
          <div>
            <label style={lbl}>{tx('Disponibilidad').toUpperCase()}</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {(Object.entries(AVAIL_CFG) as [AvailType, typeof AVAIL_CFG[AvailType]][]).map(([k, cfg]) => (
                <button key={k} onClick={() => up('availability_type', k)} style={{
                  padding:'10px 12px', borderRadius:10, border:`1px solid ${form.availability_type===k ? cfg.color+'44' : C.border}`,
                  background: form.availability_type===k ? cfg.bg : 'transparent',
                  color: form.availability_type===k ? cfg.color : C.muted,
                  cursor:'pointer', fontFamily:'inherit', textAlign:'left', fontSize:12, fontWeight:600, transition:'all 0.12s'
                }}>
                  <span style={{ marginRight:6 }}>{cfg.icon}</span>{tx(cfg.label)}
                </button>
              ))}
            </div>
          </div>

          {/* Límite diario — solo si limited_daily */}
          {form.availability_type === 'limited_daily' && (
            <div>
              <label style={lbl}>{tx('Límite diario').toUpperCase()}</label>
              <input className="rz-inp" type="number" min={1} value={form.daily_limit} onChange={e => { up('daily_limit', e.target.value); formErrors.daily_limit && setFormErrors(f => ({...f, daily_limit: ''})) }} placeholder="Ej: 5" />
              {formErrors.daily_limit && <p style={{ fontSize:11, color:C.red, marginTop:3 }}>{formErrors.daily_limit}</p>}
              <p style={{ fontSize:11, color:C.muted, marginTop:4 }}>{tx('Se dejará de ofrecer cuando se alcance este límite')}</p>
            </div>
          )}

          {/* Revisión manual */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:C.text }}>{tx('Requiere confirmación manual')}</p>
              <p style={{ fontSize:11, color:C.muted }}>{tx('No se confirmará automáticamente')}</p>
            </div>
            <button onClick={() => up('requires_confirmation', !form.requires_confirmation)} style={{
              width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
              background: form.requires_confirmation ? C.amber : C.borderMd, position:'relative', transition:'background 0.2s'
            }}>
              <div style={{ position:'absolute', top:2, left: form.requires_confirmation ? 20 : 2, width:20, height:20, borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }}/>
            </button>
          </div>

          {/* Alternativas */}
          <div>
            <label style={lbl}>{tx('Alternativas').toUpperCase()}</label>
            <input className="rz-inp" value={form.alternatives} onChange={e => up('alternatives', e.target.value)} placeholder="Entrecot, Solomillo, Secreto ibérico" />
            <p style={{ fontSize:11, color:C.muted, marginTop:4 }}>{tx('Se sugerirán cuando este producto no esté disponible')}</p>
          </div>

          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button onClick={onClose} style={{ flex:1, padding:'11px', background:C.surface2, border:`1px solid ${C.border}`, borderRadius:10, cursor:'pointer', color:C.sub, fontSize:13, fontFamily:'inherit' }}>{tx('Cancelar')}</button>
            <button onClick={submit} disabled={!form.name.trim()} style={{ flex:2, padding:'11px', background:`linear-gradient(135deg,${C.amber},#E8923A)`, border:'none', borderRadius:10, cursor:'pointer', color:C.bg, fontSize:13, fontWeight:700, fontFamily:'inherit', opacity: form.name.trim() ? 1 : 0.5 }}>{tx('Guardar')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
