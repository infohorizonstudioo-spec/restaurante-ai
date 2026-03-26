'use client'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import Link from 'next/link'

export default function EstadisticasPage(){
  const { template, t, tx } = useTenant()
  const L = template?.labels
  const [plan,setPlan]   = useState<string>('free')
  const [loading,setLoad]= useState(true)
  const [data,setData]   = useState<any>(null)
  const [,setTid]        = useState<string|null>(null)

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser(); if(!user) { setLoad(false); return }
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle(); if(!p?.tenant_id) { setLoad(false); return }
      const {data:t} = await supabase.from('tenants').select('plan,free_calls_used,free_calls_limit,plan_calls_used,plan_calls_included,plan_extra_rate,name').eq('id',p.tenant_id).maybeSingle()
      setPlan(t?.plan||'free'); setTid(p.tenant_id)

      const isPro = (t?.plan==='pro'||t?.plan==='business'||t?.plan==='enterprise')
      if (!isPro) { setLoad(false); return }

      const today = new Date().toISOString().slice(0,10)

      const [callsR, resR, custR] = await Promise.all([
        // Limitar a últimos 90 días para evitar queries lentas en tenants con historial largo
        supabase.from('calls').select('status,intent,started_at,duration_seconds')
          .eq('tenant_id',p.tenant_id)
          .gte('started_at', new Date(Date.now()-90*24*60*60*1000).toISOString()),
        supabase.from('reservations').select('status,date,people,source')
          .eq('tenant_id',p.tenant_id)
          .gte('date', new Date(Date.now()-90*24*60*60*1000).toISOString().slice(0,10)),
        supabase.from('customers').select('id,created_at,total_reservations').eq('tenant_id',p.tenant_id),
      ])

      const calls = callsR.data||[]
      const res   = resR.data||[]
      const custs = custR.data||[]

      // KPIs
      const callsTotal  = calls.length
      const callsMonth  = calls.filter(c=>(c.started_at||'').slice(0,7)===today.slice(0,7)).length
      // Solo llamadas completadas este mes (excluir activas/fallidas del denominador)
      const callsMonthCompleted = callsMonth > 0
        ? calls.filter(c=>(c.started_at||'').slice(0,7)===today.slice(0,7) && (c.status==='completada'||c.status==='completed')).length
        : 0
      const resTotal    = res.length
      const resMonth    = res.filter(r=>(r.date||'').slice(0,7)===today.slice(0,7)).length
      const resVoiceMonth = res.filter(r=>(r.date||'').slice(0,7)===today.slice(0,7)&&r.source==='voice_agent').length
      const resConfirm  = res.filter(r=>r.status==='confirmada'||r.status==='confirmed')
      // Tasa de conversión real: reservas creadas por voz / llamadas completadas
      const convRate = callsMonthCompleted>0 ? Math.round((resVoiceMonth/callsMonthCompleted)*100) : 0

      // Hora pico (basado en calls con started_at)
      const hourCounts:Record<number,number> = {}
      calls.forEach(c=>{ if(c.started_at){ const h=new Date(c.started_at).getHours(); hourCounts[h]=(hourCounts[h]||0)+1 } })
      const peakHour = Object.entries(hourCounts).sort((a,b)=>b[1]-a[1])[0]

      // Intenciones
      const intents:Record<string,number> = {}
      calls.forEach(c=>{ if(c.intent){ intents[c.intent]=(intents[c.intent]||0)+1 } })
      const topIntents = Object.entries(intents).sort((a,b)=>b[1]-a[1]).slice(0,5)

      // Personas promedio
      const avgPeople = res.length>0 ? (res.reduce((s:number,r:any)=>s+((r.people||r.party_size||2) as number),0)/res.length).toFixed(1) : '—'

      // Reservas por dia de la semana
      const dayNames = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab']
      const dayCounts:Record<number,number> = {}
      res.forEach(r=>{ if(r.date){ const d=new Date(r.date+'T12:00:00').getDay(); dayCounts[d]=(dayCounts[d]||0)+1 } })
      const maxDay = Math.max(...Object.values(dayCounts),1)

      // Fuente reservas
      const srcVoice = res.filter(r=>r.source==='voice_agent').length
      const srcManual= res.filter(r=>r.source==='manual'||!r.source).length

      setData({ callsTotal,callsMonth,callsMonthCompleted,resTotal,resMonth,resVoiceMonth,resConfirm:resConfirm.length,convRate,peakHour,topIntents,avgPeople,dayCounts,maxDay,dayNames,srcVoice,srcManual,custs:custs.length })
      setLoad(false)
    })()
  },[])

  if(loading) return <PageLoader/>

  const isPro = plan==='pro'||plan==='business'||plan==='enterprise'

  if(!isPro) return (
    <div style={{background:'#0C1018',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{maxWidth:440,textAlign:'center'}}>
        <div style={{width:64,height:64,borderRadius:16,background:'linear-gradient(135deg,#7c3aed,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',boxShadow:'0 8px 24px rgba(124,58,237,0.25)'}}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
        </div>
        <h2 style={{fontSize:22,fontWeight:700,color:'#E8EEF6',marginBottom:10}}>Estadísticas avanzadas</h2>
        <p style={{fontSize:14,color:'#8895A7',lineHeight:1.6,marginBottom:24}}>Analiza el rendimiento de tu recepcionista: tasa de conversión, hora pico, tendencias de reservas y más. Disponible en Pro y Business.</p>
        <Link href="/precios" style={{display:'inline-block',padding:'12px 28px',fontSize:14,fontWeight:600,color:'white',background:'linear-gradient(135deg,#7c3aed,#a78bfa)',borderRadius:10,textDecoration:'none',boxShadow:'0 4px 16px rgba(124,58,237,0.3)'}}>
          Ver planes →
        </Link>
      </div>
    </div>
  )

  const d = data
  if (!d) return null

  return (
    <div style={{background:'#0C1018',minHeight:'100vh'}}>
      <div style={{background:'#131920',borderBottom:'1px solid rgba(255,255,255,0.07)',padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:20}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:700,color:'#E8EEF6'}}>{t.nav.stats}</h1>
          <p style={{fontSize:12,color:'#49566A',marginTop:1}}>{tx('Rendimiento de tu recepcionista y reservas')}</p>
        </div>
        <NotifBell/>
      </div>
      <div style={{maxWidth:1000,margin:'0 auto',padding:'24px'}}>

        {/* KPIs */}
        <div className="rz-grid-4col" style={{gap:12,marginBottom:20}}>
          {[
            {label:tx('Llamadas este mes'),value:d.callsMonth,sub:tx('Completadas')+': '+d.callsMonthCompleted,color:'#F0A84E'},
            {label:`${L?.reservas||tx('Reservas')} ${tx('este mes')}`, value:d.resMonth,  sub:tx('Via agente')+': '+d.resVoiceMonth,   color:'#34D399'},
            {label:tx('Tasa conversión'),   value:d.convRate+'%',sub:`${L?.reservas||tx('Reservas')} ${tx('voz / llamadas completadas')}`, color:d.convRate>=30?'#059669':d.convRate>=15?'#d97706':'#dc2626'},
            {label:L?.clientes||'Clientes', value:d.custs, sub:`${tx('Media por')} ${L?.reserva?.toLowerCase()||'reserva'}: ${d.avgPeople}`, color:'#A78BFA'},
          ].map(k=>(
            <div key={k.label} style={{background:'#131920',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:'18px 20px'}}>
              <p style={{fontSize:28,fontWeight:700,color:k.color,letterSpacing:'-0.025em'}}>{k.value}</p>
              <p style={{fontSize:12,color:'#C4CDD8',fontWeight:500,marginTop:4}}>{k.label}</p>
              <p style={{fontSize:11,color:'#49566A',marginTop:1}}>{k.sub}</p>
            </div>
          ))}
        </div>

        <div className="rz-grid-2col-equal" style={{gap:16,marginBottom:16}}>
          {/* Reservas por día */}
          <div style={{background:'#131920',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:'18px 20px'}}>
            <p style={{fontSize:13,fontWeight:600,color:'#E8EEF6',marginBottom:14}}>Reservas por día de la semana</p>
            <div style={{display:'flex',gap:8,alignItems:'flex-end',height:100}}>
              {[1,2,3,4,5,6,0].map(day=>{
                const cnt = d.dayCounts[day]||0
                const h   = d.maxDay>0 ? Math.round((cnt/d.maxDay)*100) : 0
                const isPeak = cnt===d.maxDay&&cnt>0
                return (
                  <div key={day} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    <p style={{fontSize:10,color:'#C4CDD8',fontWeight:600}}>{cnt||''}</p>
                    <div style={{width:'100%',height:h+'%',minHeight:4,background:isPeak?'#1d4ed8':'#bfdbfe',borderRadius:4,transition:'height 0.5s'}}/>
                    <p style={{fontSize:10,color:'#49566A'}}>{d.dayNames[day]}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Hora pico + fuente */}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{background:'#131920',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:'16px 20px',flex:1}}>
              <p style={{fontSize:13,fontWeight:600,color:'#E8EEF6',marginBottom:8}}>{tx('Hora pico')}</p>
              {d.peakHour ? (
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{fontSize:32,fontWeight:800,color:'#F0A84E'}}>{d.peakHour[0]}h</div>
                  <div>
                    <p style={{fontSize:13,color:'#C4CDD8'}}>{d.peakHour[1]} llamadas</p>
                    <p style={{fontSize:11,color:'#49566A'}}>El horario más activo</p>
                  </div>
                </div>
              ) : <p style={{fontSize:13,color:'#49566A'}}>Sin datos de llamadas</p>}
            </div>
            <div style={{background:'#131920',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:'16px 20px',flex:1}}>
              <p style={{fontSize:13,fontWeight:600,color:'#E8EEF6',marginBottom:8}}>{tx('Origen reservas')}</p>
              <div style={{display:'flex',gap:16}}>
                <div>
                  <p style={{fontSize:22,fontWeight:700,color:'#A78BFA'}}>{d.srcVoice}</p>
                  <p style={{fontSize:11,color:'#49566A'}}>{tx('Via agente voz')}</p>
                </div>
                <div>
                  <p style={{fontSize:22,fontWeight:700,color:'#8895A7'}}>{d.srcManual}</p>
                  <p style={{fontSize:11,color:'#49566A'}}>{tx('Manuales')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Intenciones */}
        {d.topIntents.length>0&&(
          <div style={{background:'#131920',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:'18px 20px'}}>
            <p style={{fontSize:13,fontWeight:600,color:'#E8EEF6',marginBottom:14}}>{tx('Intenciones detectadas')}</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {d.topIntents.map(([intent,cnt]:any)=>{
                const pct = Math.round((cnt/d.callsTotal)*100)
                return (
                  <div key={intent} style={{display:'flex',alignItems:'center',gap:10}}>
                    <p style={{fontSize:13,color:'#C4CDD8',width:160,flexShrink:0,textTransform:'capitalize'}}>{intent.replace(/_/g,' ')}</p>
                    <div style={{flex:1,height:8,background:'rgba(255,255,255,0.05)',borderRadius:4,overflow:'hidden'}}>
                      <div style={{height:'100%',width:pct+'%',background:'#F0A84E',borderRadius:4}}/>
                    </div>
                    <p style={{fontSize:12,color:'#49566A',width:40,textAlign:'right',flexShrink:0}}>{cnt}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}