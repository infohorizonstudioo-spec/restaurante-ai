'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSessionTenant } from '@/lib/session-cache'
import NotifBell from '@/components/NotifBell'
import { useTenant } from '@/contexts/TenantContext'

import { C } from "@/lib/colors"

interface Servicio {
  id: string
  nombre: string
  categoria: 'corte' | 'color' | 'tratamiento' | 'barba'
  precio: number
  duracion: number // minutos
}

const CATEGORIAS = ['corte', 'color', 'tratamiento', 'barba'] as const
const CAT_STYLES: Record<string, { bg: string; color: string; icon: string }> = {
  corte:       { bg: C.violetDim, color: C.violet, icon: '✂️' },
  color:       { bg: C.blueDim,   color: C.blue,   icon: '🎨' },
  tratamiento: { bg: C.greenDim,  color: C.green,  icon: '💆' },
  barba:       { bg: C.amberDim,  color: C.amber,  icon: '🪒' },
}

const MOCK_SERVICIOS: Servicio[] = [
  { id:'1', nombre:'Corte caballero',        categoria:'corte',       precio:15,  duracion:30 },
  { id:'2', nombre:'Corte señora',           categoria:'corte',       precio:22,  duracion:45 },
  { id:'3', nombre:'Corte infantil',         categoria:'corte',       precio:12,  duracion:20 },
  { id:'4', nombre:'Tinte raíz',            categoria:'color',       precio:35,  duracion:60 },
  { id:'5', nombre:'Mechas completas',       categoria:'color',       precio:65,  duracion:90 },
  { id:'6', nombre:'Mechas babylights',      categoria:'color',       precio:80,  duracion:120 },
  { id:'7', nombre:'Balayage',              categoria:'color',       precio:75,  duracion:100 },
  { id:'8', nombre:'Tratamiento keratina',   categoria:'tratamiento', precio:50,  duracion:60 },
  { id:'9', nombre:'Hidratación profunda',   categoria:'tratamiento', precio:25,  duracion:30 },
  { id:'10',nombre:'Alisado',               categoria:'tratamiento', precio:60,  duracion:90 },
  { id:'11',nombre:'Arreglo de barba',       categoria:'barba',       precio:10,  duracion:15 },
  { id:'12',nombre:'Afeitado clásico',       categoria:'barba',       precio:15,  duracion:25 },
  { id:'13',nombre:'Barba + diseño',         categoria:'barba',       precio:18,  duracion:30 },
]

export default function PeluProductosView() {
  const { tenant } = useTenant()
  const [servicios, setServicios] = useState<Servicio[]>(MOCK_SERVICIOS)
  const [filter, setFilter] = useState<string>('all')
  const [modal, setModal] = useState<Servicio | null | 'new'>(null)
  const [tid, setTid] = useState<string|null>(null)

  const isPelu = tenant?.type === 'peluqueria'
  const accent = isPelu ? C.violet : C.text2

  const loadServices = useCallback(async (tenantId: string) => {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('category')
      .order('sort_order')
    if (data && data.length > 0) {
      setServicios(data.map((d: any) => ({
        id: d.id,
        nombre: d.name || d.nombre || '',
        categoria: d.category || d.categoria || 'corte',
        precio: d.price || d.precio || 0,
        duracion: d.duration || d.duracion || 30,
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

  const filtered = filter === 'all' ? servicios : servicios.filter(s => s.categoria === filter)

  const grouped = filtered.reduce<Record<string, Servicio[]>>((acc, s) => {
    if (!acc[s.categoria]) acc[s.categoria] = []
    acc[s.categoria].push(s)
    return acc
  }, {})

  async function handleSave(data: Omit<Servicio, 'id'>) {
    if (!tid) return
    if (modal === 'new') {
      const { data: inserted } = await supabase.from('menu_items').insert({
        name: data.nombre, category: data.categoria, price: data.precio,
        duration: data.duracion, tenant_id: tid, active: true
      }).select('id').maybeSingle()
      if (inserted) setServicios(prev => [...prev, { ...data, id: inserted.id }])
    } else if (modal && typeof modal === 'object') {
      await supabase.from('menu_items').update({
        name: data.nombre, category: data.categoria, price: data.precio,
        duration: data.duracion, updated_at: new Date().toISOString()
      }).eq('id', modal.id)
      setServicios(prev => prev.map(s => s.id === modal.id ? { ...s, ...data } : s))
    }
    setModal(null)
  }

  async function handleDelete(id: string) {
    if (!tid) return
    await supabase.from('menu_items').update({ active: false }).eq('id', id)
    setServicios(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 24px', position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: C.text }}>Servicios y tarifas</h1>
          <p style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{servicios.length} servicios configurados</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setModal('new')} style={{ background: `linear-gradient(135deg,${accent},${isPelu ? '#8B5CF6' : '#6B7280'})`, color: '#fff', fontWeight: 700, fontSize: 13, padding: '9px 18px', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>+ Añadir servicio</button>
          <NotifBell />
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 24px' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
          {CATEGORIAS.map(cat => {
            const st = CAT_STYLES[cat]
            const count = servicios.filter(s => s.categoria === cat).length
            return (
              <div key={cat} style={{ background: st.bg, border: `1px solid ${st.color}22`, borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: st.color, lineHeight: 1 }}>{count}</p>
                <p style={{ fontSize: 11, color: C.text3, marginTop: 4, textTransform: 'capitalize' }}>{st.icon} {cat}</p>
              </div>
            )
          })}
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => setFilter('all')} style={{
            padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 9,
            border: `1px solid ${filter === 'all' ? accent + '44' : C.border}`,
            background: filter === 'all' ? (isPelu ? C.violetDim : 'rgba(136,149,167,0.12)') : 'transparent',
            color: filter === 'all' ? accent : C.text2, cursor: 'pointer', fontFamily: 'inherit'
          }}>Todos</button>
          {CATEGORIAS.map(cat => {
            const st = CAT_STYLES[cat]
            return (
              <button key={cat} onClick={() => setFilter(cat)} style={{
                padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 9,
                border: `1px solid ${filter === cat ? st.color + '44' : C.border}`,
                background: filter === cat ? st.bg : 'transparent',
                color: filter === cat ? st.color : C.text2, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize'
              }}>{st.icon} {cat}</button>
            )
          })}
        </div>

        {/* Lista por categoría */}
        {Object.entries(grouped).map(([cat, items]) => {
          const st = CAT_STYLES[cat]
          return (
            <div key={cat} style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.text3, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>{st.icon} {cat}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map(item => (
                  <div key={item.id} onClick={() => setModal(item)} style={{
                    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
                    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14,
                    cursor: 'pointer', transition: 'all 0.12s'
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.surface2; (e.currentTarget as HTMLElement).style.borderColor = C.borderMd }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.surface; (e.currentTarget as HTMLElement).style.borderColor = C.border }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: st.bg, border: `1px solid ${st.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      {st.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{item.nombre}</p>
                      <p style={{ fontSize: 12, color: C.text2, marginTop: 1 }}>{item.duracion} min</p>
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: accent, flexShrink: 0 }}>{item.precio}€</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '60px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>{isPelu ? '✂️' : '🪒'}</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>Sin servicios en esta categoría</p>
            <p style={{ fontSize: 13, color: C.text3 }}>Añade servicios para gestionar las tarifas de tu negocio.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <ServicioModal
          item={modal === 'new' ? null : modal}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
          accent={accent}
        />
      )}
    </div>
  )
}

function ServicioModal({ item, onSave, onDelete, onClose, accent }: {
  item: Servicio | null
  onSave: (d: Omit<Servicio, 'id'>) => void
  onDelete: (id: string) => void
  onClose: () => void
  accent: string
}) {
  const [nombre, setNombre] = useState(item?.nombre || '')
  const [categoria, setCategoria] = useState<Servicio['categoria']>(item?.categoria || 'corte')
  const [precio, setPrecio] = useState(item?.precio?.toString() || '')
  const [duracion, setDuracion] = useState(item?.duracion?.toString() || '')

  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#8895A7', letterSpacing: '0.03em', display: 'block', marginBottom: 5 }
  const inp: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }

  function submit() {
    if (!nombre.trim() || !precio || !duracion) return
    onSave({ nombre, categoria, precio: parseFloat(precio), duracion: parseInt(duracion) })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{item ? 'Editar servicio' : 'Nuevo servicio'}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.text3 }} aria-label="Cerrar">×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>NOMBRE DEL SERVICIO *</label>
            <input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Corte caballero" />
          </div>

          <div>
            <label style={lbl}>CATEGORÍA</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {CATEGORIAS.map(cat => {
                const st = CAT_STYLES[cat]
                return (
                  <button key={cat} onClick={() => setCategoria(cat)} style={{
                    padding: '10px 12px', borderRadius: 10,
                    border: `1px solid ${categoria === cat ? st.color + '44' : C.border}`,
                    background: categoria === cat ? st.bg : 'transparent',
                    color: categoria === cat ? st.color : C.text3,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontSize: 12, fontWeight: 600, textTransform: 'capitalize'
                  }}>{st.icon} {cat}</button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>PRECIO (€) *</label>
              <input style={inp} type="number" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="15" />
            </div>
            <div>
              <label style={lbl}>DURACIÓN (min) *</label>
              <input style={inp} type="number" value={duracion} onChange={e => setDuracion(e.target.value)} placeholder="30" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            {item && (
              <button onClick={() => { onDelete(item.id); onClose() }} style={{ padding: '11px 16px', background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 10, cursor: 'pointer', color: C.red, fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}>Eliminar</button>
            )}
            <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', color: C.text2, fontSize: 13, fontFamily: 'inherit' }}>Cancelar</button>
            <button onClick={submit} disabled={!nombre.trim() || !precio || !duracion} style={{
              flex: 2, padding: '11px', background: `linear-gradient(135deg,${accent},${accent === C.violet ? '#8B5CF6' : '#6B7280'})`,
              border: 'none', borderRadius: 10, cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              opacity: nombre.trim() && precio && duracion ? 1 : 0.5
            }}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
