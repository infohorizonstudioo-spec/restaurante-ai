'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase, getDemoTenant } from '@/lib/supabase'
import type { Table } from '@/types'

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  libre:     {label:'Libre',    color:'text-emerald-400', bg:'bg-emerald-500/15 border-emerald-500/25'},
  reservada: {label:'Reservada',color:'text-blue-400',    bg:'bg-blue-500/15 border-blue-500/25'},
  ocupada:   {label:'Ocupada',  color:'text-orange-400',  bg:'bg-orange-500/15 border-orange-500/25'},
  pendiente: {label:'Pendiente',color:'text-amber-400',   bg:'bg-amber-500/15 border-amber-500/25'},
  bloqueada: {label:'Bloqueada',color:'text-red-400',     bg:'bg-red-500/15 border-red-500/25'},
}
const ZONES = ['interior','terraza','barra','privado']

export default function MesasPage() {
  const [tables, setTables] = useState<Table[]>([])
  const [zone, setZone] = useState('interior')

  useEffect(() => {
    async function load() {
      const t = await getDemoTenant()
      if (!t) return
      const { data } = await supabase.from('tables').select('*').eq('tenant_id', t.id).eq('active', true)
      setTables(data || [])
    }
    load()
  }, [])

  async function cycleStatus(table: Table) {
    const cycle: Record<string,string> = { libre:'ocupada', ocupada:'libre', reservada:'ocupada', pendiente:'ocupada', bloqueada:'libre' }
    const next = cycle[table.status] || 'libre'
    await supabase.from('tables').update({ status: next }).eq('id', table.id)
    setTables(prev => prev.map(t => t.id === table.id ? {...t, status: next as any} : t))
  }

  const zoneTables = tables.filter(t => t.zone === zone)
  const libre = tables.filter(t => t.status === 'libre').length
  const ocupada = tables.filter(t => t.status === 'ocupada').length
  const reservada = tables.filter(t => t.status === 'reservada').length

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mesas</h1>
          <p className="text-white/40 text-sm">{libre} libres · {ocupada} ocupadas · {reservada} reservadas</p>
        </div>
        <div className="flex gap-3">
          {[{k:'libre',v:libre,c:'emerald'},{k:'ocupada',v:ocupada,c:'orange'},{k:'reservada',v:reservada,c:'blue'}].map(s=>(
            <div key={s.k} className="glass rounded-xl px-4 py-2 text-center">
              <div className={`text-lg font-bold text-${s.c}-400`}>{s.v}</div>
              <div className="text-[10px] text-white/30 capitalize">{s.k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Zone tabs */}
      <div className="flex gap-1">
        {ZONES.map(z => (
          <button key={z} onClick={() => setZone(z)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all
              ${zone===z ? 'bg-white/12 text-white' : 'text-white/35 hover:text-white/60 hover:bg-white/5'}`}>
            {z} <span className="text-white/20 ml-1">{tables.filter(t=>t.zone===z).length}</span>
          </button>
        ))}
      </div>

      {/* Mapa de mesas */}
      <div className="glass rounded-2xl p-6">
        <div className="relative" style={{height: '420px'}}>
          {zoneTables.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/25 text-sm">Sin mesas en esta zona</div>
          ) : zoneTables.map(table => {
            const cfg = STATUS_CFG[table.status] || STATUS_CFG.libre
            const x = Math.max(20, Math.min(table.position_x || 80, 750))
            const y = Math.max(20, Math.min(table.position_y || 80, 350))
            return (
              <button key={table.id} onClick={() => cycleStatus(table)}
                style={{ left: x, top: y, transform: 'translate(-50%,-50%)' }}
                className={`absolute flex flex-col items-center justify-center rounded-xl border transition-all hover:scale-105 active:scale-95 cursor-pointer
                  ${table.shape === 'round' ? 'rounded-full' : ''}
                  ${table.capacity >= 8 ? 'w-24 h-16' : table.capacity >= 6 ? 'w-20 h-14' : 'w-16 h-12'}
                  ${cfg.bg}`}>
                <span className={`text-xs font-bold ${cfg.color}`}>{table.number}</span>
                <span className="text-[9px] text-white/30">{table.capacity} pax</span>
                <span className={`text-[9px] ${cfg.color} opacity-70`}>{cfg.label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-white/25 text-center mt-2">Toca una mesa para cambiar su estado</p>
      </div>

      {/* Lista */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tables.map(table => {
          const cfg = STATUS_CFG[table.status] || STATUS_CFG.libre
          return (
            <div key={table.id} className={`glass rounded-xl p-4 border ${cfg.bg} transition-all`}>
              <div className="flex items-start justify-between mb-2">
                <span className="font-bold">{table.number}</span>
                <span className={`text-[10px] ${cfg.color}`}>{cfg.label}</span>
              </div>
              <p className="text-xs text-white/30">{table.capacity} personas</p>
              <p className="text-xs text-white/25 capitalize">{table.zone}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
