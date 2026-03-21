'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSessionTenant } from '@/lib/session-cache'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import PeluProductosView from './PeluProductosView'
import NotifBell from '@/components/NotifBell'

const C = {
  bg:'#0C1018', card:'#131920', card2:'#161D2A', border:'rgba(255,255,255,0.07)',
  text:'#E8EEF6', sub:'#8895A7', muted:'#49566A', amber:'#F0A84E',
  green:'#34D399', red:'#F87171', yellow:'#FBB53F', violet:'#A78BFA', teal:'#2DD4BF',
  amberDim:'rgba(240,168,78,0.10)', greenDim:'rgba(52,211,153,0.10)',
  redDim:'rgba(248,113,113,0.10)', yellowDim:'rgba(251,181,63,0.10)',
}

const AVAIL_CFG = {
  always_available: { label:'Siempre disponible', color:C.green,  bg:C.greenDim,  icon:'✓' },
  limited_daily:    { label:'Limitado por día',   color:C.amber,  bg:C.amberDim,  icon:'⚡' },
  by_request:       { label:'Por encargo',        color:C.violet, bg:'rgba(167,139,250,0.12)', icon:'📋' },
  unavailable:      { label:'No disponible',      color:C.red,    bg:C.redDim,    icon:'✕' },
}

type AvailType = keyof typeof AVAIL_CFG

const CATEGORIES = ['Entrantes','Carnes','Pescados','Postres','Bebidas','Menú del día','Especiales','Otro']

export default function ProductosPage() {
  const { tenant } = useTenant()
  if (tenant?.type === 'peluqueria' || tenant?.type === 'barberia') return <PeluProductosView />

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
      const sess = await getSessionTenant(); if(!sess) return
      setTid(sess.tenantId)
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

  if (loading) return <PageLoader />

  const filtered = filter === 'all' ? items : filter === 'limited' ? items.filter(i => i.availability_type === 'limited_daily') : items.filter(i => i.availability_type === filter)

  const soldOut = items.filter(i => i.availability_type === 'limited_daily' && (counts[i.id]||0) >= (i.daily_limit||0)).length
  const byRequest = items.filter(i => i.availability_type === 'by_request').length
  const available = items.filter(i => {
    if (i.availability_type === 'unavailable') return false
    if (i.availability_type === 'limited_daily') return (counts[i.id]||0) < (i.daily_limit||999)
    return true
  }).length

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'Sora',-apple-system,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap');*{box-sizing:border-box}.rz-inp{background:rgba(255,255,255,0.04);border:1px solid ${C.border};border-radius:10px;padding:10px 14px;color:${C.text};font-size:13px;font-family:inherit;outline:none;width:100%;transition:border-color 0.15s}.rz-inp:focus{border-color:${C.amber}!important}.rz-inp::placeholder{color:${C.muted}}`}</style>

      {/* Header */}
      <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:'14px 24px', position:'sticky', top:0, zIndex:30, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:17, fontWeight:700, color:C.text }}>Menú operativo</h1>
          <p style={{ fontSize:12, color:C.muted, marginTop:2 }}>{available} disponibles · {soldOut} agotados · {byRequest} por encargo</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={() => setModal({ _new: true })} style={{ background:`linear-gradient(135deg,${C.amber},#E8923A)`, color:'#0C1018', fontWeight:700, fontSize:13, padding:'9px 18px', border:'none', borderRadius:10, cursor:'pointer', fontFamily:'inherit' }}>+ Producto</button>
          <NotifBell />
        </div>
      </div>


      <div style={{ maxWidth:900, margin:'0 auto', padding:'20px 24px' }}>

        {/* KPIs del día */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
          {([
            { label:'Disponibles hoy', value:available, color:C.green, bg:C.greenDim },
            { label:'Agotados hoy', value:soldOut, color:C.red, bg:C.redDim },
            { label:'Por encargo', value:byRequest, color:C.violet, bg:'rgba(167,139,250,0.12)' },
            { label:'Total en carta', value:items.length, color:C.amber, bg:C.amberDim },
          ]).map(k => (
            <div key={k.label} style={{ background:k.bg, border:`1px solid ${k.color}22`, borderRadius:12, padding:'14px 16px' }}>
              <p style={{ fontSize:22, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</p>
              <p style={{ fontSize:11, color:C.muted, marginTop:4 }}>{k.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
          {[['all','Todos'], ['always_available','Siempre'], ['limited_daily','Limitados'], ['by_request','Encargo'], ['unavailable','No disp.']].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding:'5px 14px', fontSize:12, fontWeight:600, borderRadius:9,
              border:`1px solid ${filter===k ? C.amber+'44' : C.border}`,
              background: filter===k ? C.amberDim : 'transparent',
              color: filter===k ? C.amber : C.sub, cursor:'pointer', fontFamily:'inherit'
            }}>{l}</button>
          ))}
        </div>

        {/* Lista por categoría */}
        {filtered.length === 0 ? (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'60px 24px', textAlign:'center' }}>
            <p style={{ fontSize:32, marginBottom:12 }}>🍽️</p>
            <p style={{ fontSize:15, fontWeight:600, color:C.text, marginBottom:6 }}>Sin productos en carta</p>
            <p style={{ fontSize:13, color:C.muted }}>Añade productos para que el agente gestione la disponibilidad en tiempo real.</p>
            <button onClick={() => setModal({ _new: true })} style={{ marginTop:16, padding:'10px 24px', fontSize:13, fontWeight:700, background:`linear-gradient(135deg,${C.amber},#E8923A)`, color:'#0C1018', border:'none', borderRadius:10, cursor:'pointer', fontFamily:'inherit' }}>+ Añadir producto</button>
          </div>
        ) : (
          Object.entries(
            filtered.reduce((acc:any, item:any) => {
              if (!acc[item.category]) acc[item.category] = []
              acc[item.category].push(item)
              return acc
            }, {})
          ).map(([cat, catItems]) => (
            <div key={cat} style={{ marginBottom:20 }}>
              <p style={{ fontSize:11, fontWeight:700, color:C.muted, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:10 }}>{cat}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {(catItems as any[]).map(item => {
                  const cfg = AVAIL_CFG[item.availability_type as AvailType] || AVAIL_CFG.always_available
                  const usedToday = counts[item.id] || 0
                  const remaining = item.daily_limit ? item.daily_limit - usedToday : null
                  const isSoldOut = item.availability_type === 'limited_daily' && remaining !== null && remaining <= 0
                  return (
                    <div key={item.id} style={{
                      background: isSoldOut ? 'rgba(248,113,113,0.04)' : C.card,
                      border: `1px solid ${isSoldOut ? C.red+'22' : C.border}`,
                      borderRadius:12, padding:'12px 16px',
                      display:'flex', alignItems:'center', gap:14, opacity: isSoldOut ? 0.75 : 1
                    }}>
                      {/* Indicador disponibilidad */}
                      <div style={{ width:36, height:36, borderRadius:10, background:cfg.bg, border:`1px solid ${cfg.color}33`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                        {cfg.icon}
                      </div>
                      {/* Info */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                          <p style={{ fontSize:14, fontWeight:700, color: isSoldOut ? C.muted : C.text }}>{item.name}</p>
                          <span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:cfg.bg, color:cfg.color, fontWeight:700 }}>{cfg.label}</span>
                          {item.requires_confirmation && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:C.yellowDim, color:C.yellow, fontWeight:600 }}>Revisión manual</span>}
                          {item.price && <span style={{ fontSize:12, color:C.sub }}>{item.price}€</span>}
                        </div>
                        {item.description && <p style={{ fontSize:12, color:C.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.description}</p>}
                        {/* Stock bar para limitados */}
                        {item.availability_type === 'limited_daily' && item.daily_limit && (
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                            <div style={{ flex:1, height:5, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${Math.min(100, (usedToday/item.daily_limit)*100)}%`, background: isSoldOut ? C.red : usedToday/item.daily_limit > 0.7 ? C.yellow : C.green, transition:'width 0.3s', borderRadius:3 }}/>
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, color: isSoldOut ? C.red : remaining! <= 1 ? C.yellow : C.green, flexShrink:0 }}>
                              {isSoldOut ? 'AGOTADO' : `${remaining} restantes`}
                            </span>
                            <span style={{ fontSize:10, color:C.muted, flexShrink:0 }}>{usedToday}/{item.daily_limit}</span>
                            {usedToday > 0 && <button onClick={() => resetCount(item.id)} style={{ fontSize:10, color:C.muted, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>reset</button>}
                          </div>
                        )}
                      </div>
                      {/* Acciones */}
                      <div style={{ display:'flex', gap:6, flexShrink:0, position:'relative' }}>
                        <button onClick={() => setModal(item)} style={{ padding:'6px 12px', fontSize:12, fontWeight:600, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:8, cursor:'pointer', color:C.sub, fontFamily:'inherit' }}>Editar</button>
                        <button onClick={() => setDeleteConfirm(item.id)} style={{ padding:'6px 10px', fontSize:12, background:C.redDim, border:`1px solid ${C.red}33`, borderRadius:8, cursor:'pointer', color:C.red, fontFamily:'inherit' }}>✕</button>
                        {deleteConfirm===item.id&&(
                          <div style={{position:'absolute',right:0,top:'100%',marginTop:6,background:C.card,border:`1px solid ${C.red}44`,borderRadius:10,padding:'10px 14px',zIndex:20,width:220,boxShadow:'0 8px 24px rgba(0,0,0,0.4)'}}>
                            <p style={{fontSize:12,color:C.red,marginBottom:8}}>¿Eliminar "{item.name}"?</p>
                            <div style={{display:'flex',gap:6}}>
                              <button onClick={()=>setDeleteConfirm(null)} style={{flex:1,padding:'5px',fontSize:11,background:'rgba(255,255,255,0.06)',border:`1px solid ${C.border}`,borderRadius:7,cursor:'pointer',color:C.sub,fontFamily:'inherit'}}>Cancelar</button>
                              <button onClick={()=>deleteItem(item.id)} style={{flex:1,padding:'5px',fontSize:11,background:C.red,border:'none',borderRadius:7,cursor:'pointer',color:'white',fontFamily:'inherit',fontWeight:700}}>Eliminar</button>
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
      {modal && <ProductModal item={modal._new ? null : modal} onSave={saveItem} onClose={() => setModal(null)} />}
    </div>
  )
}


function ProductModal({ item, onSave, onClose }: { item: any | null, onSave: (d: any) => void, onClose: () => void }) {
  const [form, setForm] = useState({
    id:                   item?.id || undefined,
    name:                 item?.name || '',
    category:             item?.category || 'Carnes',
    description:          item?.description || '',
    availability_type:    (item?.availability_type || 'always_available') as AvailType,
    daily_limit:          item?.daily_limit || '',
    requires_confirmation:item?.requires_confirmation || false,
    alternatives:         (item?.alternatives || []).join(', '),
    price:                item?.price || '',
    sort_order:           item?.sort_order || 0,
  })
  const up = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const lbl = { fontSize:11, fontWeight:600, color:'#8895A7', letterSpacing:'0.03em', display:'block', marginBottom:5 }

  function submit() {
    if (!form.name.trim()) return
    onSave({
      ...form,
      daily_limit: form.daily_limit ? parseInt(String(form.daily_limit)) : null,
      price: form.price ? parseFloat(String(form.price)) : null,
      alternatives: form.alternatives ? form.alternatives.split(',').map((s:string) => s.trim()).filter(Boolean) : [],
    })
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }} onClick={onClose}>
      <div style={{ background:C.card, borderRadius:16, padding:24, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <p style={{ fontSize:16, fontWeight:700, color:C.text }}>{item ? 'Editar producto' : 'Nuevo producto'}</p>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:C.muted }}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={lbl}>NOMBRE *</label>
              <input className="rz-inp" value={form.name} onChange={e => up('name', e.target.value)} placeholder="Chuletón de buey" />
            </div>
            <div>
              <label style={lbl}>CATEGORÍA</label>
              <select className="rz-inp" value={form.category} onChange={e => up('category', e.target.value)} style={{ cursor:'pointer' }}>
                {CATEGORIES.map(c => <option key={c} value={c} style={{ background:C.card }}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>PRECIO (€)</label>
              <input className="rz-inp" type="number" value={form.price} onChange={e => up('price', e.target.value)} placeholder="28.50" />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={lbl}>DESCRIPCIÓN (opcional)</label>
              <input className="rz-inp" value={form.description} onChange={e => up('description', e.target.value)} placeholder="Descripción breve para el agente" />
            </div>
          </div>

          {/* Disponibilidad */}
          <div>
            <label style={lbl}>TIPO DE DISPONIBILIDAD</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {(Object.entries(AVAIL_CFG) as [AvailType, typeof AVAIL_CFG[AvailType]][]).map(([k, cfg]) => (
                <button key={k} onClick={() => up('availability_type', k)} style={{
                  padding:'10px 12px', borderRadius:10, border:`1px solid ${form.availability_type===k ? cfg.color+'44' : C.border}`,
                  background: form.availability_type===k ? cfg.bg : 'transparent',
                  color: form.availability_type===k ? cfg.color : C.muted,
                  cursor:'pointer', fontFamily:'inherit', textAlign:'left', fontSize:12, fontWeight:600, transition:'all 0.12s'
                }}>
                  <span style={{ marginRight:6 }}>{cfg.icon}</span>{cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Límite diario — solo si limited_daily */}
          {form.availability_type === 'limited_daily' && (
            <div>
              <label style={lbl}>LÍMITE DIARIO (unidades)</label>
              <input className="rz-inp" type="number" min={1} value={form.daily_limit} onChange={e => up('daily_limit', e.target.value)} placeholder="Ej: 5" />
              <p style={{ fontSize:11, color:C.muted, marginTop:4 }}>El agente dejará de ofrecerlo cuando se alcance este límite.</p>
            </div>
          )}

          {/* Revisión manual */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:C.text }}>Requiere confirmación manual</p>
              <p style={{ fontSize:11, color:C.muted }}>El agente no lo confirmará automáticamente</p>
            </div>
            <button onClick={() => up('requires_confirmation', !form.requires_confirmation)} style={{
              width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
              background: form.requires_confirmation ? C.amber : 'rgba(255,255,255,0.1)', position:'relative', transition:'background 0.2s'
            }}>
              <div style={{ position:'absolute', top:2, left: form.requires_confirmation ? 20 : 2, width:20, height:20, borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }}/>
            </button>
          </div>

          {/* Alternativas */}
          <div>
            <label style={lbl}>ALTERNATIVAS (separadas por coma)</label>
            <input className="rz-inp" value={form.alternatives} onChange={e => up('alternatives', e.target.value)} placeholder="Entrecot, Solomillo, Secreto ibérico" />
            <p style={{ fontSize:11, color:C.muted, marginTop:4 }}>El agente las sugerirá cuando este plato no esté disponible.</p>
          </div>

          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button onClick={onClose} style={{ flex:1, padding:'11px', background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:10, cursor:'pointer', color:C.sub, fontSize:13, fontFamily:'inherit' }}>Cancelar</button>
            <button onClick={submit} disabled={!form.name.trim()} style={{ flex:2, padding:'11px', background:`linear-gradient(135deg,${C.amber},#E8923A)`, border:'none', borderRadius:10, cursor:'pointer', color:'#0C1018', fontSize:13, fontWeight:700, fontFamily:'inherit', opacity: form.name.trim() ? 1 : 0.5 }}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
