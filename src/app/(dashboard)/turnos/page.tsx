'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSessionTenant } from '@/lib/session-cache'
import { PageLoader } from '@/components/ui'
import NotifBell from '@/components/NotifBell'
import { useTenant } from '@/contexts/TenantContext'
import { calculateDayStats, parseReservationConfig, generateSlots } from '@/lib/scheduling-engine'
import type { SlotStats, ReservationConfig } from '@/lib/scheduling-engine'

import { C } from '@/lib/colors'

function pct(used: number, max: number) { return max > 0 ? Math.min(100, Math.round(used/max*100)) : 0 }
function barColor(p: number) { return p >= 100 ? C.red : p >= 75 ? C.yellow : C.green }

function SlotBar({ label, used, max }: { label: string; used: number; max: number }) {
  const p = pct(used, max)
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
        <span style={{ fontSize:10, color:C.muted }}>{label}</span>
        <span style={{ fontSize:10, fontWeight:700, color: barColor(p) }}>{used}/{max}</span>
      </div>
      <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:p+'%', background: barColor(p), borderRadius:2, transition:'width 0.3s' }}/>
      </div>
    </div>
  )
}

export default function TurnosPage() {
  const { template, tx } = useTenant()
  const L = template?.labels
  const [tid, setTid]           = useState<string|null>(null)
  const [loading, setLoading]   = useState(true)
  const [stats, setStats]       = useState<SlotStats[]>([])
  const [cfg, setCfg]           = useState<ReservationConfig|null>(null)
  const [date, setDate]         = useState(new Date().toISOString().slice(0,10))
  const [zones, setZones]       = useState<any[]>([])
  const [tables, setTables]     = useState<any[]>([])
  const [reservas, setReservas] = useState<any[]>([])

  const load = useCallback(async (tenantId: string, d: string) => {
    const [tr, zr, tabR, resR] = await Promise.all([
      supabase.from('tenants').select('reservation_config,type').eq('id', tenantId).maybeSingle(),
      supabase.from('zones').select('id,name').eq('tenant_id', tenantId).eq('active', true),
      supabase.from('tables').select('id,zone_id,capacity').eq('tenant_id', tenantId),
      supabase.from('reservations').select('id,time,people,table_id,customer_name,status')
        .eq('tenant_id', tenantId).eq('date', d)
        .in('status', ['confirmada','confirmed','pendiente','pending'])
        .order('time'),
    ])
    const config = parseReservationConfig(tr.data?.reservation_config)
    setCfg(config)
    setZones(zr.data || [])
    setTables(tabR.data || [])
    setReservas(resR.data || [])
    const dayStats = calculateDayStats(config, resR.data || [], zr.data || [], tabR.data || [])
    setStats(dayStats)
    setLoading(false)
  }, [])

  useEffect(() => {
    (async () => {
      const sess = await getSessionTenant()
      if (!sess) { setLoading(false); return }
      setTid(sess.tenantId)
      await load(sess.tenantId, date)
    })()
  }, [load, date])

  if (loading) return <PageLoader />

  const today = new Date().toISOString().slice(0,10)
  const totalReservas = reservas.length
  const totalPersonas = reservas.reduce((s:number, r:any) => s+(r.people||1), 0)
  const slotsFull = stats.filter(s => s.reservations >= s.max_reservations).length
  const slotsWithRes = stats.filter(s => s.reservations > 0).length

  return (
    <div style={{ background:C.bg, minHeight:'100vh', fontFamily:"'Sora',-apple-system,sans-serif" }}>
      <style>{`*{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{ background:'rgba(19,25,32,0.85)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)', borderBottom:`1px solid ${C.border}`, padding:'14px 24px', position:'sticky', top:0, zIndex:20, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:17, fontWeight:700, color:C.text }}>{tx('Control de turnos')}</h1>
          <p style={{ fontSize:12, color:C.muted, marginTop:2 }}>{tx('Capacidad por franja')} · {date===today?tx('Hoy'):date}</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <input type="date" value={date} onChange={e=>{setDate(e.target.value);if(tid)load(tid,e.target.value)}}
            style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:9, padding:'7px 12px', color:C.text, fontSize:13, fontFamily:'inherit', outline:'none', colorScheme:'dark' }}/>
          <NotifBell />
        </div>
      </div>

      <div className="rz-page-enter" style={{ maxWidth:1000, margin:'0 auto', padding:'20px 24px' }}>

        {/* KPIs */}
        <div className="rz-grid-4col" style={{ gap:10, marginBottom:20 }}>
          {[
            { label:tx(`${L?.reservas || 'Reservas'} hoy`), value:totalReservas, color:C.amber },
            { label:tx('Personas hoy'), value:totalPersonas, color:C.teal },
            { label:tx('Franjas activas'), value:slotsWithRes, color:C.green },
            { label:tx('Franjas completas'), value:slotsFull, color:slotsFull>0?C.red:C.muted },
          ].map(k=>(
            <div key={k.label} style={{ background:`${k.color}12`, border:`1px solid ${k.color}22`, borderRadius:12, padding:'14px 16px' }}>
              <p style={{ fontSize:24, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</p>
              <p style={{ fontSize:11, color:C.muted, marginTop:4 }}>{k.label}</p>
            </div>
          ))}
        </div>

        {/* Config activa */}
        {cfg && (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'14px 18px', marginBottom:20, display:'flex', gap:20, flexWrap:'wrap' }}>
            <p style={{ fontSize:11, fontWeight:700, color:C.amber, letterSpacing:'0.04em', alignSelf:'center' }}>{tx('CONFIG ACTIVA')}</p>
            {[
              { l:tx('Intervalo'), v:cfg.reservation_slot_interval_minutes+'min' },
              { l:tx('Duración media'), v:cfg.default_reservation_duration_minutes+'min' },
              { l:tx('Buffer'), v:cfg.buffer_minutes+'min' },
              { l:tx('Máx. reservas/franja'), v:String(cfg.max_new_reservations_per_slot) },
              { l:tx('Máx. personas/franja'), v:String(cfg.max_new_people_per_slot) },
            ].map(x=>(
              <div key={x.l}>
                <p style={{ fontSize:10, color:C.muted }}>{x.l}</p>
                <p style={{ fontSize:14, fontWeight:700, color:C.text }}>{x.v}</p>
              </div>
            ))}
          </div>
        )}

        {/* Grid de franjas */}
        {stats.length === 0 ? (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'48px 24px', textAlign:'center' }}>
            <p style={{ fontSize:28, marginBottom:10 }}>📋</p>
            <p style={{ fontSize:15, fontWeight:600, color:C.text, marginBottom:6 }}>{tx('Sin franjas configuradas')}</p>
            <p style={{ fontSize:13, color:C.muted }}>{tx('Configura los horarios de servicio en Configuración para ver las franjas.')}</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:10 }}>
            {stats.map(slot => {
              const pRes = pct(slot.reservations, slot.max_reservations)
              const pPpl = pct(slot.people, slot.max_people)
              const isFull = pRes >= 100
              const isActive = slot.reservations > 0
              const slotReservas = reservas.filter((r:any) => r.time?.slice(0,5) === slot.time)
              return (
                <div key={slot.time} style={{
                  background: isFull ? 'rgba(248,113,113,0.06)' : isActive ? `${C.amber}06` : C.card,
                  border: `1px solid ${isFull ? C.red+'33' : isActive ? C.amber+'33' : C.border}`,
                  borderRadius:12, padding:'14px',
                }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <span style={{ fontSize:16, fontWeight:800, color: isFull ? C.red : isActive ? C.amber : C.text }}>{slot.time}</span>
                    <span style={{
                      fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:8,
                      background: isFull ? C.redDim : isActive ? C.amberDim : 'rgba(255,255,255,0.04)',
                      color: isFull ? C.red : isActive ? C.amber : C.muted,
                    }}>{isFull ? tx('COMPLETO') : isActive ? tx('ACTIVO') : tx('LIBRE')}</span>
                  </div>

                  <SlotBar label={tx('Reservas')} used={slot.reservations} max={slot.max_reservations}/>
                  <SlotBar label={tx('Personas')} used={slot.people} max={slot.max_people}/>

                  {/* Zonas */}
                  {Object.entries(slot.zones).map(([z,v])=>(
                    <SlotBar key={z} label={z.charAt(0).toUpperCase()+z.slice(1)} used={v.used} max={v.max}/>
                  ))}

                  {/* Reservas de esta franja */}
                  {slotReservas.length > 0 && (
                    <div style={{ marginTop:8, borderTop:`1px solid ${C.border}`, paddingTop:8, display:'flex', flexDirection:'column', gap:4 }}>
                      {slotReservas.map((r:any)=>(
                        <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <span style={{ fontSize:11, color:C.sub, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>{r.customer_name||tx('Cliente')}</span>
                          <span style={{ fontSize:10, color:C.muted }}>{r.people}p</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
