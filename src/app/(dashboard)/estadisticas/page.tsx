'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader, PageHeader } from '@/components/ui'
import Link from 'next/link'

function Metric({ label, value, sub, color = '#1d4ed8' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12, padding:'18px 20px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
      <p style={{ fontSize:28, fontWeight:700, color, letterSpacing:'-0.025em' }}>{value}</p>
      <p style={{ fontSize:12, color:'#374151', fontWeight:500, marginTop:4 }}>{label}</p>
      {sub && <p style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{sub}</p>}
    </div>
  )
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value/max)*100) : 0
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontSize:13, color:'#374151' }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{value}</span>
      </div>
      <div style={{ height:7, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
        <div style={{ height:'100%', width:pct+'%', background:color, borderRadius:4, transition:'width 0.6s ease' }}/>
      </div>
    </div>
  )
}

export default function EstadisticasPage() {
  const [tenant, setTenant]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [data, setData]       = useState<any>({})

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!p?.tenant_id) return
    const { data: t } = await supabase.from('tenants').select('*').eq('id', p.tenant_id).single()
    setTenant(t)
    if (!t) { setLoading(false); return }
    const tid = p.tenant_id
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastMonth  = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().split('T')[0]
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

    const [calls, reservas, clientes, ordenes] = await Promise.all([
      supabase.from('calls').select('*').eq('tenant_id', tid),
      supabase.from('reservations').select('*').eq('tenant_id', tid),
      supabase.from('customers').select('*').eq('tenant_id', tid),
      supabase.from('orders').select('*').eq('tenant_id', tid),
    ])

    const allCalls = calls.data || []
    const allRes   = reservas.data || []
    const allCli   = clientes.data || []
    const allOrd   = ordenes.data || []

    const callsThisMonth    = allCalls.filter(c => c.created_at >= monthStart+'T00:00:00')
    const callsLastMonth    = allCalls.filter(c => c.created_at >= lastMonth+'T00:00:00' && c.created_at <= lastMonthEnd+'T23:59:59')
    const resThisMonth      = allRes.filter(r => r.reservation_date >= monthStart)
    const resCompleted      = allRes.filter(r => r.status === 'completada' || r.status === 'confirmada')
    const voiceRes          = allRes.filter(r => r.source === 'voice_agent')
    const completedCalls    = allCalls.filter(c => c.status === 'completed')
    const totalCallMin      = Math.round(allCalls.reduce((s,c) => s+(c.duration||0),0) / 60)
    const newCliThisMonth   = allCli.filter(c => c.created_at >= monthStart+'T00:00:00')
    const ordThisMonth      = allOrd.filter(o => o.created_at >= monthStart+'T00:00:00')

    // Reservas por día de semana
    const byDay: Record<string,number> = { Lun:0, Mar:0, Mié:0, Jue:0, Vie:0, Sáb:0, Dom:0 }
    const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    allRes.forEach(r => {
      if (r.reservation_date) {
        const d = new Date(r.reservation_date).getDay()
        byDay[dayNames[d]] = (byDay[dayNames[d]]||0) + 1
      }
    })

    // Hora pico
    const byHour: Record<string,number> = {}
    allRes.forEach(r => {
      if (r.reservation_time) { const h = r.reservation_time.slice(0,2); byHour[h] = (byHour[h]||0)+1 }
    })
    const peakHour = Object.entries(byHour).sort((a,b)=>b[1]-a[1])[0]

    setData({ allCalls, allRes, allCli, allOrd, callsThisMonth, callsLastMonth, resThisMonth, resCompleted, voiceRes, completedCalls, totalCallMin, newCliThisMonth, ordThisMonth, byDay, peakHour })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <PageLoader/>

  // Plan gate — Pro y Business
  const plan = tenant?.plan
  if (plan !== 'pro' && plan !== 'business') {
    return (
      <div style={{ background:'#f8fafc', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ maxWidth:460, textAlign:'center', padding:'0 24px' }}>
          <div style={{ width:64, height:64, borderRadius:16, background:'#eff6ff', border:'1px solid #bfdbfe', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:30 }}>📊</div>
          <h2 style={{ fontSize:22, fontWeight:700, color:'#0f172a', marginBottom:10 }}>Estadísticas avanzadas</h2>
          <p style={{ fontSize:14, color:'#64748b', lineHeight:1.65, marginBottom:28 }}>
            Las estadísticas detalladas están disponibles en el plan <strong>Pro</strong> y <strong>Business</strong>.
            Ve llamadas, conversiones, horas pico y tendencias de clientes.
          </p>
          <Link href="/precios" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 24px', background:'linear-gradient(135deg,#1e40af,#3b82f6)', color:'white', borderRadius:10, fontSize:14, fontWeight:600, textDecoration:'none' }}>
            Ver planes →
          </Link>
        </div>
      </div>
    )
  }

  const maxDay = Math.max(...Object.values(data.byDay || {}), 1)

  return (
    <div style={{ background:'#f8fafc', minHeight:'100vh' }}>
      <PageHeader title="Estadísticas" subtitle="Rendimiento de tu recepcionista"/>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:24 }}>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          <Metric label="Llamadas este mes" value={data.callsThisMonth?.length||0} sub={`${data.callsLastMonth?.length||0} el mes anterior`} color='#1d4ed8'/>
          <Metric label="Reservas gestionadas" value={data.resThisMonth?.length||0} sub={`${data.voiceRes?.length||0} por el agente`} color='#059669'/>
          <Metric label="Clientes nuevos" value={data.newCliThisMonth?.length||0} sub={`${data.allCli?.length||0} en total`} color='#7c3aed'/>
          <Metric label="Minutos gestionados" value={data.totalCallMin||0 + 'min'} sub={`${data.completedCalls?.length||0} llamadas completadas`} color='#d97706'/>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          {/* Reservas por día */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12, padding:'20px' }}>
            <p style={{ fontSize:14, fontWeight:600, color:'#0f172a', marginBottom:16 }}>Reservas por día de la semana</p>
            {Object.entries(data.byDay||{}).map(([day, count]: [string, any]) => (
              <Bar key={day} label={day} value={count} max={maxDay} color='#3b82f6'/>
            ))}
            {(!data.byDay || Object.values(data.byDay).every(v=>v===0)) && (
              <p style={{ fontSize:13, color:'#94a3b8', textAlign:'center', padding:'20px 0' }}>Sin datos aún</p>
            )}
          </div>

          {/* Métricas de agente */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12, padding:'20px' }}>
            <p style={{ fontSize:14, fontWeight:600, color:'#0f172a', marginBottom:16 }}>Métricas del agente</p>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {[
                { label:'Tasa de conversión (llamada → reserva)', value: data.allCalls?.length > 0 ? Math.round((data.voiceRes?.length/data.allCalls?.length)*100)+'%' : '—', color:'#059669' },
                { label:'Llamadas completadas', value: data.completedCalls?.length||0, color:'#1d4ed8' },
                { label:'Reservas creadas por el agente', value: data.voiceRes?.length||0, color:'#7c3aed' },
                { label:'Hora pico', value: data.peakHour ? data.peakHour[0]+':00h ('+data.peakHour[1]+' reservas)' : '—', color:'#d97706' },
                { label:'Total clientes registrados', value: data.allCli?.length||0, color:'#0891b2' },
              ].map(m => (
                <div key={m.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f1f5f9' }}>
                  <p style={{ fontSize:13, color:'#64748b' }}>{m.label}</p>
                  <p style={{ fontSize:16, fontWeight:700, color:m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Llamadas este mes vs anterior */}
        <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12, padding:'20px' }}>
          <p style={{ fontSize:14, fontWeight:600, color:'#0f172a', marginBottom:6 }}>Comparativa mensual</p>
          <p style={{ fontSize:12, color:'#94a3b8', marginBottom:16 }}>Llamadas recibidas</p>
          <div style={{ display:'flex', gap:16, alignItems:'flex-end', height:100 }}>
            {[
              { label:'Mes anterior', value:data.callsLastMonth?.length||0, color:'#bfdbfe' },
              { label:'Este mes', value:data.callsThisMonth?.length||0, color:'#3b82f6' },
            ].map(b => {
              const maxV = Math.max(data.callsLastMonth?.length||0, data.callsThisMonth?.length||0, 1)
              const h = Math.round((b.value/maxV)*80)+4
              return (
                <div key={b.label} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>{b.value}</span>
                  <div style={{ width:60, height:h, background:b.color, borderRadius:'6px 6px 0 0', transition:'height 0.5s' }}/>
                  <span style={{ fontSize:11, color:'#94a3b8' }}>{b.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}