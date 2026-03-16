'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Table, Zone, Tenant, Reservation } from '@/types'

export default function MesasPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showAddZone, setShowAddZone] = useState(false)
  const [showAddTable, setShowAddTable] = useState(false)
  const [newZone, setNewZone] = useState({ name: '', description: '' })
  const [newTable, setNewTable] = useState({ name: '', zone_id: '', capacity: 4, combinable: false })
  const supabase = createClient()

  useEffect(() => { loadData() }, [selectedDate])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile) return
    const tenantId = profile.tenant_id

    const [{ data: t }, { data: z }, { data: tb }, { data: r }] = await Promise.all([
      supabase.from('tenants').select('*').eq('id', tenantId).single(),
      supabase.from('zones').select('*').eq('tenant_id', tenantId).order('name'),
      supabase.from('tables').select('*').eq('tenant_id', tenantId).order('name'),
      supabase.from('reservations').select('*').eq('tenant_id', tenantId)
        .eq('reservation_date', selectedDate).in('status', ['confirmada', 'pendiente'])
    ])
    setTenant(t); setZones(z || []); setTables(tb || []); setReservations(r || [])
    setLoading(false)
  }

  async function addZone() {
    if (!tenant || !newZone.name) return
    await supabase.from('zones').insert({ tenant_id: tenant.id, ...newZone, active: true })
    setNewZone({ name: '', description: '' }); setShowAddZone(false); loadData()
  }

  async function addTable() {
    if (!tenant || !newTable.name || !newTable.zone_id) return
    await supabase.from('tables').insert({ tenant_id: tenant.id, ...newTable, status: 'libre' })
    setNewTable({ name: '', zone_id: '', capacity: 4, combinable: false }); setShowAddTable(false); loadData()
  }

  async function updateTableStatus(tableId: string, status: string) {
    await supabase.from('tables').update({ status }).eq('id', tableId)
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: status as any } : t))
  }

  async function autoAssignTables() {
    // Asignación automática: para cada reserva sin mesa, busca la mejor disponible
    const unassigned = reservations.filter(r => !r.table_id)
    for (const res of unassigned) {
      const availableTables = tables.filter(t => {
        const isOccupied = reservations.some(r2 => r2.table_id === t.id && 
          r2.reservation_time === res.reservation_time && r2.id !== res.id)
        return !isOccupied && t.capacity >= res.party_size && t.status !== 'bloqueada'
      }).sort((a, b) => a.capacity - b.capacity) // Mejor fit primero
      
      if (availableTables[0]) {
        await supabase.from('reservations').update({ table_id: availableTables[0].id, table_name: availableTables[0].name })
          .eq('id', res.id)
      }
    }
    loadData()
  }

  const statusColors: Record<string, string> = {
    libre: 'bg-green-100 border-green-300 text-green-800',
    reservada: 'bg-blue-100 border-blue-300 text-blue-800',
    ocupada: 'bg-red-100 border-red-300 text-red-800',
    bloqueada: 'bg-gray-100 border-gray-300 text-gray-600'
  }
  const statusLabels: Record<string, string> = { libre: '✅ Libre', reservada: '📋 Reservada', ocupada: '🔴 Ocupada', bloqueada: '🔒 Bloqueada' }

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando mesas...</div>

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Mesas</h1>
          <p className="text-gray-500 text-sm mt-0.5">{tables.length} mesas · {zones.length} zonas</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 text-sm"/>
          <button onClick={autoAssignTables} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 flex items-center gap-2">
            ✨ Asignación automática
          </button>
          <button onClick={() => setShowAddZone(true)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200">
            + Zona
          </button>
          <button onClick={() => setShowAddTable(true)} className="bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-900">
            + Mesa
          </button>
        </div>
      </div>

      {/* Reservas del día asignadas */}
      {reservations.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Reservas del {new Date(selectedDate + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reservations.map(res => (
              <div key={res.id} className={`p-4 rounded-xl border ${res.table_id ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{res.customer_name}</p>
                    <p className="text-sm text-gray-600">{res.reservation_time?.slice(0,5)} · {res.party_size} pers.</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${res.table_id ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {res.table_name || 'Sin mesa'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {reservations.some(r => !r.table_id) && (
            <p className="text-sm text-yellow-700 mt-3">⚠️ {reservations.filter(r => !r.table_id).length} reserva(s) sin mesa asignada. Usa la asignación automática.</p>
          )}
        </div>
      )}

      {/* Zonas y mesas */}
      {zones.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">🏪</p>
          <p className="text-gray-500 font-medium">Configura tu local</p>
          <p className="text-sm text-gray-400 mt-1">Añade zonas (terraza, interior, barra) y mesas para gestionar la ocupación</p>
          <button onClick={() => setShowAddZone(true)} className="mt-4 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium">
            Crear primera zona
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {zones.map(zone => {
            const zoneTables = tables.filter(t => t.zone_id === zone.id)
            const libres = zoneTables.filter(t => t.status === 'libre').length
            return (
              <div key={zone.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <div>
                    <h3 className="font-semibold text-gray-900">{zone.name}</h3>
                    <p className="text-sm text-gray-500">{zoneTables.length} mesas · {libres} libres</p>
                  </div>
                </div>
                <div className="p-6">
                  {zoneTables.length === 0 ? (
                    <p className="text-gray-400 text-sm">No hay mesas en esta zona</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {zoneTables.map(table => {
                        const tableRes = reservations.find(r => r.table_id === table.id)
                        return (
                          <div key={table.id} className={`rounded-xl border-2 p-3 cursor-pointer transition-all hover:shadow-md ${statusColors[table.status] || statusColors.libre}`}
                            onClick={() => {
                              const nextStatus = { libre: 'ocupada', ocupada: 'libre', reservada: 'libre', bloqueada: 'libre' }
                              updateTableStatus(table.id, nextStatus[table.status as keyof typeof nextStatus] || 'libre')
                            }}>
                            <p className="font-bold text-lg text-center">{table.name}</p>
                            <p className="text-xs text-center opacity-75">{table.capacity} plazas</p>
                            {tableRes && <p className="text-xs text-center mt-1 truncate">{tableRes.customer_name}</p>}
                            <p className="text-xs text-center mt-0.5 opacity-60">{statusLabels[table.status]?.split(' ')[0]}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal añadir zona */}
      {showAddZone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Nueva zona</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Nombre de la zona</label>
                <input value={newZone.name} onChange={e => setNewZone({...newZone, name: e.target.value})}
                  placeholder="Ej: Terraza, Interior, Barra..."
                  className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm"/>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowAddZone(false)} className="flex-1 border border-gray-300 rounded-xl py-2 text-sm">Cancelar</button>
                <button onClick={addZone} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-medium">Crear zona</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal añadir mesa */}
      {showAddTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Nueva mesa</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Nombre o número</label>
                <input value={newTable.name} onChange={e => setNewTable({...newTable, name: e.target.value})}
                  placeholder="Ej: Mesa 1, T-01..."
                  className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm"/>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Zona</label>
                <select value={newTable.zone_id} onChange={e => setNewTable({...newTable, zone_id: e.target.value})}
                  className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm">
                  <option value="">Selecciona zona</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Capacidad (personas)</label>
                <input type="number" value={newTable.capacity} onChange={e => setNewTable({...newTable, capacity: parseInt(e.target.value)})}
                  min={1} max={30} className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm"/>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newTable.combinable} onChange={e => setNewTable({...newTable, combinable: e.target.checked})} className="rounded"/>
                <span className="text-sm text-gray-700">Se puede combinar con otras mesas</span>
              </label>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowAddTable(false)} className="flex-1 border border-gray-300 rounded-xl py-2 text-sm">Cancelar</button>
                <button onClick={addTable} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-medium">Crear mesa</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}