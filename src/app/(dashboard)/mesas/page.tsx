'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader, PageHeader, Button, Input, Textarea, Modal, Badge, EmptyState, Alert } from '@/components/ui'

const ZONE_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#84cc16','#f97316']

export default function MesasPage() {
  const [tenant, setTenant]   = useState(null)
  const [zones, setZones]     = useState([])
  const [tables, setTables]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState(null) // { type, text }

  // Modals
  const [zoneModal, setZoneModal] = useState(false)
  const [tableModal, setTableModal] = useState(false)
  const [editZone, setEditZone] = useState(null)
  const [editTable, setEditTable] = useState(null)
  const [zoneForm, setZoneForm] = useState({ name: '', description: '' })
  const [tableForm, setTableForm] = useState({ name: '', capacity: 4, zone_id: '', notes: '', combinable: false })

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!p?.tenant_id) return
    const tid = p.tenant_id
    const [{ data: t }, { data: z }, { data: tb }] = await Promise.all([
      supabase.from('tenants').select('*').eq('id', tid).single(),
      supabase.from('zones').select('*').eq('tenant_id', tid).order('name'),
      supabase.from('tables').select('*').eq('tenant_id', tid).order('name'),
    ])
    setTenant(t); setZones(z || []); setTables(tb || []); setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function notify(type, text) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }

  // ── Zonas ──
  async function saveZone() {
    if (!zoneForm.name.trim()) return
    setSaving(true)
    if (editZone) {
      await supabase.from('zones').update({ name: zoneForm.name.trim(), description: zoneForm.description.trim() }).eq('id', editZone.id)
      notify('success', 'Zona actualizada')
    } else {
      await supabase.from('zones').insert({ tenant_id: tenant.id, name: zoneForm.name.trim(), description: zoneForm.description.trim(), active: true })
      notify('success', 'Zona creada')
    }
    setSaving(false); setZoneModal(false); setEditZone(null); setZoneForm({ name: '', description: '' }); load()
  }

  async function deleteZone(z) {
    const mesasEnZona = tables.filter(t => t.zone_id === z.id)
    if (mesasEnZona.length > 0) { notify('error', `No puedes borrar "${z.name}" mientras tenga ${mesasEnZona.length} mesas`); return }
    if (!confirm(`¿Eliminar zona "${z.name}"?`)) return
    await supabase.from('zones').delete().eq('id', z.id)
    notify('success', 'Zona eliminada'); load()
  }

  async function toggleZone(z) {
    await supabase.from('zones').update({ active: !z.active }).eq('id', z.id)
    load()
  }

  // ── Mesas ──
  async function saveTable() {
    if (!tableForm.name.trim() || !tableForm.capacity) return
    setSaving(true)
    const payload = {
      tenant_id: tenant.id,
      name: tableForm.name.trim(),
      capacity: parseInt(tableForm.capacity),
      zone_id: tableForm.zone_id || null,
      notes: tableForm.notes.trim() || null,
      combinable: tableForm.combinable,
      status: 'libre',
    }
    if (editTable) {
      await supabase.from('tables').update(payload).eq('id', editTable.id)
      notify('success', 'Mesa actualizada')
    } else {
      await supabase.from('tables').insert(payload)
      notify('success', 'Mesa creada')
    }
    setSaving(false); setTableModal(false); setEditTable(null); setTableForm({ name: '', capacity: 4, zone_id: '', notes: '', combinable: false }); load()
  }

  async function deleteTable(t) {
    if (!confirm(`¿Eliminar mesa "${t.name}"?`)) return
    await supabase.from('tables').delete().eq('id', t.id)
    notify('success', 'Mesa eliminada'); load()
  }

  function openNewZone() { setEditZone(null); setZoneForm({ name: '', description: '' }); setZoneModal(true) }
  function openEditZone(z) { setEditZone(z); setZoneForm({ name: z.name, description: z.description || '' }); setZoneModal(true) }
  function openNewTable(zoneId) { setEditTable(null); setTableForm({ name: '', capacity: 4, zone_id: zoneId || '', notes: '', combinable: false }); setTableModal(true) }
  function openEditTable(t) { setEditTable(t); setTableForm({ name: t.name, capacity: t.capacity, zone_id: t.zone_id || '', notes: t.notes || '', combinable: t.combinable || false }); setTableModal(true) }

  if (loading) return <PageLoader/>
  if (!tenant) return null

  const mesasSinZona = tables.filter(t => !t.zone_id)
  const isRestaurantType = ['restaurante', 'bar'].includes(tenant.type)

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      <PageHeader title='Gestión del local' subtitle='Zonas y mesas de tu establecimiento'
        actions={<Button icon={<span>+</span>} onClick={openNewZone}>Nueva zona</Button>}/>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        {msg && <Alert variant={msg.type} style={{ marginBottom: 16 }}>{msg.text}</Alert>}

        {!isRestaurantType && (
          <Alert variant='info' style={{ marginBottom: 20 }}>
            La gestión de mesas y zonas está pensada principalmente para restaurantes y bares.
            Tu tipo de negocio ({tenant.type}) usa citas sin asignación de mesa.
          </Alert>
        )}

        {/* Resumen */}
        {zones.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Zonas activas', value: zones.filter(z => z.active).length },
              { label: 'Total mesas', value: tables.length },
              { label: 'Capacidad total', value: tables.reduce((s, t) => s + (t.capacity || 0), 0) + ' personas' },
            ].map(s => (
              <div key={s.label} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px' }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{s.value}</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Sin zonas */}
        {zones.length === 0 && (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <EmptyState
              icon={<svg width='22' height='22' viewBox='0 0 24 24' fill='#94a3b8'><path d='M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'/></svg>}
              title='Crea las zonas de tu local'
              description='Define terraza, interior, sala VIP... El agente usará esta información para asignar mesas automáticamente cuando reciba llamadas.'
              action={<Button icon={<span>+</span>} onClick={openNewZone}>Crear primera zona</Button>}
            />
          </div>
        )}

        {/* Zonas con mesas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {zones.map((zone, zi) => {
            const color = ZONE_COLORS[zi % ZONE_COLORS.length]
            const mesasZona = tables.filter(t => t.zone_id === zone.id)
            const capacidad = mesasZona.reduce((s, t) => s + (t.capacity || 0), 0)

            return (
              <div key={zone.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
                {/* Zone header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: mesasZona.length > 0 ? '1px solid #f1f5f9' : 'none', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{zone.name}</p>
                        {!zone.active && <Badge variant='slate'>Inactiva</Badge>}
                      </div>
                      {zone.description && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{zone.description}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{mesasZona.length} mesas</span>
                      <span style={{ color: '#d1d5db' }}>·</span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{capacidad} personas</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openNewTable(zone.id)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, color: color, background: color + '18', border: '1px solid ' + color + '30', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}>
                      + Mesa
                    </button>
                    <button onClick={() => openEditZone(zone)} style={{ padding: '5px 10px', fontSize: 12, color: '#64748b', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Editar
                    </button>
                    <button onClick={() => toggleZone(zone)} style={{ padding: '5px 10px', fontSize: 12, color: '#64748b', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {zone.active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => deleteZone(zone)} style={{ padding: '5px 10px', fontSize: 12, color: '#ef4444', background: 'transparent', border: '1px solid #fecaca', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Borrar
                    </button>
                  </div>
                </div>

                {/* Mesas grid */}
                {mesasZona.length > 0 && (
                  <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                    {mesasZona.map(mesa => (
                      <div key={mesa.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 4 }} />
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => openEditTable(mesa)} style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>✏️</button>
                            <button onClick={() => deleteTable(mesa)} style={{ fontSize: 11, color: '#fca5a5', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>🗑</button>
                          </div>
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 3 }}>{mesa.name}</p>
                        <p style={{ fontSize: 12, color: '#64748b' }}>{mesa.capacity} personas</p>
                        {mesa.notes && <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, fontStyle: 'italic' }}>{mesa.notes}</p>}
                        {mesa.combinable && <p style={{ fontSize: 10, color: '#3b82f6', marginTop: 3 }}>↔ Combinable</p>}
                      </div>
                    ))}
                    {/* Add table */}
                    <button onClick={() => openNewTable(zone.id)} style={{ border: '2px dashed #e2e8f0', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 90, color: '#94a3b8', fontSize: 24, fontFamily: 'inherit' }}>
                      +
                    </button>
                  </div>
                )}

                {mesasZona.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>Sin mesas en esta zona</p>
                    <button onClick={() => openNewTable(zone.id)} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, color: color, background: color + '18', border: '1px solid ' + color + '30', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}>
                      + Añadir mesa
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Mesas sin zona */}
          {mesasSinZona.length > 0 && (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#94a3b8' }} />
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>Sin zona asignada</p>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{mesasSinZona.length} mesas</span>
                </div>
                <button onClick={() => openNewTable('')} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}>+ Mesa</button>
              </div>
              <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {mesasSinZona.map(mesa => (
                  <div key={mesa.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 6 }}>
                      <button onClick={() => openEditTable(mesa)} style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>✏️</button>
                      <button onClick={() => deleteTable(mesa)} style={{ fontSize: 11, color: '#fca5a5', background: 'none', border: 'none', cursor: 'pointer' }}>🗑</button>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 3 }}>{mesa.name}</p>
                    <p style={{ fontSize: 12, color: '#64748b' }}>{mesa.capacity} personas</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info de cómo usa Gabriela esto */}
        {(zones.length > 0 || tables.length > 0) && (
          <div style={{ marginTop: 20, background: 'linear-gradient(135deg,#eff6ff,#f0fdf4)', border: '1px solid #bfdbfe', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8', marginBottom: 6 }}>🤖 Cómo usa Gabriela este esquema</p>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
              Cuando un cliente llama y dice <em>"quiero una mesa en la terraza"</em>, Gabriela comprobará automáticamente
              qué mesas de la terraza están libres para esa fecha y hora, y asignará la mejor opción.
              Si la zona está llena, ofrecerá alternativas. Al confirmar, dirá algo como:
              <em> "Perfecto, te he reservado la Mesa 4 en la terraza para el viernes a las 21:00."</em>
            </p>
          </div>
        )}
      </div>

      {/* MODAL ZONA */}
      <Modal open={zoneModal} onClose={() => { setZoneModal(false); setEditZone(null); setZoneForm({ name: '', description: '' }) }}
        title={editZone ? 'Editar zona' : 'Nueva zona'}
        footer={<><Button variant='secondary' style={{ flex: 1 }} onClick={() => { setZoneModal(false); setEditZone(null) }}>Cancelar</Button><Button style={{ flex: 1 }} loading={saving} onClick={saveZone}>{editZone ? 'Guardar' : 'Crear zona'}</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label='Nombre de la zona *' value={zoneForm.name} placeholder='Terraza, Interior, Sala VIP...' onChange={e => setZoneForm({ ...zoneForm, name: e.target.value })}/>
          <Textarea label='Descripción (opcional)' value={zoneForm.description} rows={2} placeholder='Ej: Zona exterior con vistas al mar, acceso directo desde entrada...' onChange={e => setZoneForm({ ...zoneForm, description: e.target.value })}/>
          <Alert variant='info'>El nombre de la zona es lo que Gabriela entenderá cuando el cliente la mencione por teléfono.</Alert>
        </div>
      </Modal>

      {/* MODAL MESA */}
      <Modal open={tableModal} onClose={() => { setTableModal(false); setEditTable(null) }}
        title={editTable ? 'Editar mesa' : 'Nueva mesa'}
        footer={<><Button variant='secondary' style={{ flex: 1 }} onClick={() => { setTableModal(false); setEditTable(null) }}>Cancelar</Button><Button style={{ flex: 1 }} loading={saving} onClick={saveTable}>{editTable ? 'Guardar' : 'Crear mesa'}</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
            <Input label='Nombre *' value={tableForm.name} placeholder='Mesa 1, M-01, Reservada...' onChange={e => setTableForm({ ...tableForm, name: e.target.value })}/>
            <Input label='Personas *' type='number' min='1' max='30' value={String(tableForm.capacity)} onChange={e => setTableForm({ ...tableForm, capacity: parseInt(e.target.value) || 2 })}/>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Zona</label>
            <select value={tableForm.zone_id} onChange={e => setTableForm({ ...tableForm, zone_id: e.target.value })} style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, color: '#0f172a', background: '#fafafa', border: '1px solid #d1d5db', borderRadius: 9, padding: '9px 12px', outline: 'none' }}>
              <option value=''>Sin zona</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <Input label='Notas (opcional)' value={tableForm.notes} placeholder='Ej: Junto a la ventana, accesible...' onChange={e => setTableForm({ ...tableForm, notes: e.target.value })}/>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type='checkbox' checked={tableForm.combinable} onChange={e => setTableForm({ ...tableForm, combinable: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#3b82f6' }}/>
            <span style={{ fontSize: 13, color: '#374151' }}>Mesa combinable (puede unirse con otras para grupos grandes)</span>
          </label>
        </div>
      </Modal>
    </div>
  )
}