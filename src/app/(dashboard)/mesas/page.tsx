'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
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

  useEffect(() => { loadData() }, [selectedDate])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile) return
    const tid = (profile as any).tenant_id
    const [{ data: t }, { data: z }, { data: tb }, { data: r }] = await Promise.all([
      supabase.from('tenants').select('*').eq('id', tid).single(),
      supabase.from('zones').select('*').eq('tenant_id', tid).order('name'),
      supabase.from('tables').select('*').eq('tenant_id', tid).order('name'),
      supabase.from('reservations').select('*').eq('tenant_id', tid).eq('reservation_date', selectedDate).in('status', ['confirmada', 'pendiente'])
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

  async function updateTableStatus(id: string, status: string) {
    await supabase.from('tables').update({ status }).eq('id', id)
    setTables(prev => prev.map(t => t.id === id ? { ...t, status: status as any } : t))
  }

  async function autoAssign() {
    for (const res of reservations.filter(r => !r.table_id)) {
      const avail = tables.filter(t => {
        const busy = reservations.some(r2 => r2.table_id === t.id && r2.reservation_time === res.reservation_time && r2.id !== res.id)
        return !busy && t.capacity >= res.party_size && t.status !== 'bloqueada'
      }).sort((a,b) => a.capacity - b.capacity)
      if (avail[0]) await supabase.from('reservations').update({ table_id: avail[0].id, table_name: avail[0].name }).eq('id', res.id)
    }
    loadData()
  }

  const sc: Record<string,string> = { libre:'bg-green-100 border-green-300 text-green-800', reservada:'bg-blue-100 border-blue-300 text-blue-800', ocupada:'bg-red-100 border-red-300 text-red-800', bloqueada:'bg-gray-100 border-gray-300 text-gray-600' }

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando mesas...</div>

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Gestión de Mesas</h1><p className="text-gray-500 text-sm">{tables.length} mesas · {zones.length} zonas</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border border-gray-300 rounded-xl px-3 py-2 text-sm"/>
          <button onClick={autoAssign} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700">✨ Auto-asignar</button>
          <button onClick={() => setShowAddZone(true)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm">+ Zona</button>
          <button onClick={() => setShowAddTable(true)} className="bg-gray-800 text-white px-4 py-2 rounded-xl text-sm">+ Mesa</button>
        </div>
      </div>

      {zones.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <p className="text-4xl mb-3">🏪</p><p className="text-gray-500 font-medium">Configura tu local</p>
          <p className="text-sm text-gray-400 mt-1">Añade zonas y mesas para gestionar la ocupación</p>
          <button onClick={() => setShowAddZone(true)} className="mt-4 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium">Crear primera zona</button>
        </div>
      ) : zones.map(zone => {
        const zt = tables.filter(t => t.zone_id === zone.id)
        return (
          <div key={zone.id} className="bg-white rounded-2xl border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
              <div><h3 className="font-semibold">{zone.name}</h3><p className="text-sm text-gray-500">{zt.length} mesas · {zt.filter(t=>t.status==='libre').length} libres</p></div>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {zt.map(table => {
                const tr = reservations.find(r => r.table_id === table.id)
                return (
                  <div key={table.id} className={`rounded-xl border-2 p-3 cursor-pointer hover:shadow-md ${sc[table.status]||sc.libre}`}
                    onClick={() => { const ns: Record<string,string> = {libre:'ocupada',ocupada:'libre',reservada:'libre',bloqueada:'libre'}; updateTableStatus(table.id, ns[table.status]||'libre') }}>
                    <p className="font-bold text-lg text-center">{table.name}</p>
                    <p className="text-xs text-center opacity-75">{table.capacity}p</p>
                    {tr && <p className="text-xs text-center mt-1 truncate">{tr.customer_name}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {showAddZone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Nueva zona</h3>
            <input value={newZone.name} onChange={e => setNewZone({...newZone, name: e.target.value})} placeholder="Nombre (Terraza, Interior...)" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mb-4"/>
            <div className="flex gap-2"><button onClick={() => setShowAddZone(false)} className="flex-1 border border-gray-300 rounded-xl py-2 text-sm">Cancelar</button><button onClick={addZone} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-medium">Crear</button></div>
          </div>
        </div>
      )}
      {showAddTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3">
            <h3 className="font-bold text-lg">Nueva mesa</h3>
            <input value={newTable.name} onChange={e => setNewTable({...newTable, name: e.target.value})} placeholder="Nombre o número" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"/>
            <select value={newTable.zone_id} onChange={e => setNewTable({...newTable, zone_id: e.target.value})} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
              <option value="">Selecciona zona</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
            <input type="number" value={newTable.capacity} onChange={e => setNewTable({...newTable, capacity: parseInt(e.target.value)})} min={1} max={30} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" placeholder="Capacidad"/>
            <div className="flex gap-2"><button onClick={() => setShowAddTable(false)} className="flex-1 border border-gray-300 rounded-xl py-2 text-sm">Cancelar</button><button onClick={addTable} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-medium">Crear</button></div>
          </div>
        </div>
      )}
    </div>
  )
}