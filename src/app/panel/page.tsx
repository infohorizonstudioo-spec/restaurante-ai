'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import Link from 'next/link'

const PLAN_LABELS:Record<string,string> = {free:'Trial',trial:'Trial',starter:'Starter',pro:'Pro',business:'Business'}
const PLAN_COLS:Record<string,string>   = {free:'#d97706',trial:'#d97706',starter:'#1d4ed8',pro:'#7c3aed',business:'#059669'}
const PLAN_LIMITS:Record<string,number> = {free:10,trial:10,starter:50,pro:200,business:600}

function StatCard({label,value,sub,color,href}:any){
  const el=(
    <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:14,padding:'18px 20px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)',transition:'all 0.15s',cursor:href?'pointer':'default'}}>
      <p style={{fontSize:30,fontWeight:700,color,letterSpacing:'-0.025em',lineHeight:1}}>{value}</p>
      <p style={{fontSize:12,color:'#374151',fontWeight:500,marginTop:6}}>{label}</p>
      {sub&&<p style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{sub}</p>}
    </div>
  )
  return href?<Link href={href} style={{textDecoration:'none'}}>{el}</Link>:el
}

export default function PanelPage(){
  const router=useRouter()
  const [loading,setLoading]=useState(true)
  const [tenant,setTenant]=useState<any>(null)
  const [calls,setCalls]=useState<any[]>([])
  const [reservas,setReservas]=useState<any[]>([])
  const [clientes,setClientes]=useState<any[]>([])

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser()
    if (!user){router.push('/login');return}
    const {data:p}=await supabase.from('profiles').select('tenant_id,role').eq('id',user.id).single()
    // superadmin sin tenant va a admin, con tenant se queda en su panel
    if (!p?.tenant_id){
      if (p?.role==='superadmin') router.push('/admin')
      else router.push('/onboarding')
      return
    }
    const tid=p.tenant_id
    const today=new Date().toISOString().split('T')[0]
    const [{data:t},{data:c},{data:r},{data:cl}]=await Promise.all([
      supabase.from('tenants').select('*').eq('id',tid).single(),
      supabase.from('calls').select('*').eq('tenant_id',tid).order('started_at',{ascending:false}).limit(10),
      supabase.from('reservations').select('*').eq('tenant_id',tid).eq('date',today).order('time'),
      supabase.from('customers').select('id').eq('tenant_id',tid),
    ])
    setTenant(t);setCalls(c||[]);setReservas(r||[]);setClientes(cl||[])
    setLoading(false)
  },[router])

  useEffect(()=>{
    load()
    const ch=supabase.channel('panel-rt')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'calls'},load)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'calls'},load)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'reservations'},load)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'reservations'},load)
      .subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[load])

  if(loading)return<PageLoader/>
  if(!tenant)return null

  const plan=tenant.plan||'free'
  const isTrial=plan==='free'||plan==='trial'
  const planLabel=PLAN_LABELS[plan]||'Trial'
  const planColor=PLAN_COLS[plan]||'#d97706'
  const callsUsed=isTrial?(tenant.free_calls_used||0):(tenant.plan_calls_used||0)
  const callsLimit=isTrial?(tenant.free_calls_limit||10):(PLAN_LIMITS[plan]||50)
  const callsLeft=Math.max(0,callsLimit-callsUsed)
  const agentActive=!!tenant.agent_phone

  const hour=new Date().getHours()
  const greeting=hour<13?'Buenos días':hour<20?'Buenas tardes':'Buenas noches'
  const dayStr=new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})

  return(
    <div style={{background:'#f8fafc',minHeight:'100vh'}}>
      <div style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'16px 28px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:700,color:'#0f172a'}}>{greeting}, <span style={{color:'#1d4ed8'}}>{tenant.name}</span></h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:2,textTransform:'capitalize'}}>{dayStr}</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',background:agentActive?'#f0fdf4':'#fef2f2',border:'1px solid',borderColor:agentActive?'#86efac':'#fecaca',borderRadius:20}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:agentActive?'#4ade80':'#f87171',animation:agentActive?'pulse 2s infinite':'none'}}/>
            <span style={{fontSize:12,fontWeight:600,color:agentActive?'#166534':'#dc2626'}}>
              {agentActive?(tenant.agent_name||'Sofía')+' activa':'Agente sin número'}
            </span>
          </div>
          {!agentActive&&<Link href='/configuracion' style={{padding:'6px 14px',fontSize:12,fontWeight:600,color:'white',background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:8,textDecoration:'none'}}>Configurar →</Link>}
        </div>
      </div>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'24px 28px'}}>
        {isTrial&&callsLeft<=5&&(
          <div style={{background:'linear-gradient(135deg,#fffbeb,#fef3c7)',border:'1px solid #fbbf24',borderRadius:12,padding:'14px 20px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:20}}>⚡</span>
              <div>
                <p style={{fontWeight:600,fontSize:14,color:'#92400e'}}>{callsLeft===0?'Has agotado tus llamadas gratuitas':'Quedan solo '+callsLeft+' llamada'+(callsLeft!==1?'s':'')+' gratuita'+(callsLeft!==1?'s':'')}</p>
                <p style={{fontSize:12,color:'#b45309',marginTop:1}}>Activa un plan para seguir recibiendo llamadas</p>
              </div>
            </div>
            <Link href='/precios' style={{padding:'8px 18px',fontSize:13,fontWeight:600,color:'white',background:'linear-gradient(135deg,#d97706,#f59e0b)',borderRadius:9,textDecoration:'none',whiteSpace:'nowrap'}}>Ver planes →</Link>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
          <StatCard label='Llamadas hoy' value={calls.filter(c=>{const d=(c.started_at||c.created_at||'')?.slice(0,10);return d===new Date().toISOString().split('T')[0]}).length} color='#1d4ed8' href='/llamadas'/>          <StatCard label='Reservas hoy' value={reservas.length} color='#059669' sub={reservas.filter(r=>r.status==='confirmada').length+' confirmadas'} href='/reservas'/>
          <StatCard label='Clientes' value={clientes.length} color='#7c3aed' href='/clientes'/>
          <StatCard label={isTrial?'Llamadas restantes':'Llamadas del plan'} value={isTrial?callsLeft+'':callsUsed+'/'+callsLimit} color={callsLeft<=3?'#dc2626':planColor} sub={planLabel} href='/facturacion'/>
        </div>

        {isTrial&&(
          <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,padding:'16px 20px',marginBottom:20}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:600,color:'#0f172a'}}>Uso del trial gratuito</span>
              <span style={{fontSize:13,fontWeight:700,color:callsLeft<=3?'#dc2626':'#374151'}}>{callsUsed} / {callsLimit} llamadas</span>
            </div>
            <div style={{height:8,background:'#f1f5f9',borderRadius:4,overflow:'hidden',marginBottom:6}}>
              <div style={{height:'100%',width:Math.min(100,Math.round(callsUsed/callsLimit*100))+'%',background:callsLeft<=3?'#ef4444':callsUsed/callsLimit>0.7?'#f59e0b':'#1d4ed8',borderRadius:4,transition:'width 0.5s'}}/>
            </div>
            <p style={{fontSize:12,color:'#94a3b8'}}>Cada llamada recibida por tu recepcionista cuenta como una llamada del plan.</p>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:16}}>
          <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:14,overflow:'hidden'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h2 style={{fontSize:14,fontWeight:600,color:'#0f172a'}}>Llamadas recientes</h2>
              <Link href='/llamadas' style={{fontSize:12,color:'#1d4ed8',textDecoration:'none',fontWeight:500}}>Ver todas →</Link>
            </div>
            {calls.length===0
              ?<div style={{padding:'40px 20px',textAlign:'center'}}>
                <div style={{fontSize:32,marginBottom:10}}>📞</div>
                <p style={{fontSize:14,fontWeight:500,color:'#374151',marginBottom:6}}>Sin llamadas aún</p>
                <p style={{fontSize:12,color:'#94a3b8',lineHeight:1.6}}>Las llamadas de tu recepcionista aparecerán aquí en tiempo real.</p>
                {!agentActive&&<Link href='/configuracion' style={{display:'inline-block',marginTop:14,padding:'8px 18px',fontSize:13,fontWeight:600,color:'white',background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:9,textDecoration:'none'}}>Configurar número →</Link>}
              </div>
              :calls.map((call,i)=>{
                const status=call.status||'completed'
                const phone=call.caller_phone||call.from_number||'Número oculto'
                const dur=call.duration_seconds?Math.round(call.duration_seconds/60)+'m':null
                return(
                  <div key={call.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 20px',borderTop:i>0?'1px solid #f8fafc':'none'}}>
                    <div style={{width:34,height:34,borderRadius:'50%',background:status==='completed'?'#f0fdf4':'#fef2f2',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={status==='completed'?'#059669':'#dc2626'}><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                        <p style={{fontSize:13,fontWeight:600,color:'#0f172a'}}>{phone}</p>
                        <span style={{fontSize:11,padding:'1px 7px',borderRadius:10,background:['completada','completed'].includes(status)?'#f0fdf4':['fallida','failed'].includes(status)?'#fef2f2':'#eff6ff',color:['completada','completed'].includes(status)?'#059669':['fallida','failed'].includes(status)?'#dc2626':'#1d4ed8',fontWeight:600}}>{['completada','completed'].includes(status)?'Completada':['activa','in-progress'].includes(status)?'En curso':'Fallida'}</span>
                      </div>
                      {call.summary?<p style={{fontSize:12,color:'#64748b',lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{call.summary}</p>:<p style={{fontSize:12,color:'#94a3b8'}}>Sin resumen</p>}
                    </div>
                    <div style={{flexShrink:0,textAlign:'right'}}>
                      <p style={{fontSize:11,color:'#94a3b8',whiteSpace:'nowrap'}}>{(call.started_at||call.created_at)?new Date(call.started_at||call.created_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):''}</p>
                      {dur&&<p style={{fontSize:11,fontWeight:600,color:'#374151',marginTop:2}}>{dur}</p>}
                    </div>
                  </div>
                )
              })
            }
          </div>

          <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:14,overflow:'hidden'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h2 style={{fontSize:14,fontWeight:600,color:'#0f172a'}}>Reservas hoy</h2>
              <Link href='/reservas' style={{fontSize:12,color:'#1d4ed8',textDecoration:'none',fontWeight:500}}>Gestionar →</Link>
            </div>
            {reservas.length===0
              ?<div style={{padding:'40px 16px',textAlign:'center'}}><div style={{fontSize:28,marginBottom:8}}>📅</div><p style={{fontSize:13,color:'#94a3b8',lineHeight:1.6}}>Sin citas hoy</p></div>
              :reservas.slice(0,8).map((r,i)=>(
                <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderTop:i>0?'1px solid #f8fafc':'none'}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#1d4ed8',flexShrink:0}}>{r.customer_name?.[0]?.toUpperCase()||'?'}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:13,fontWeight:500,color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.customer_name}</p>
                    <p style={{fontSize:11,color:'#94a3b8'}}>{(r.time||r.reservation_time||'').slice(0,5)} · {r.people||r.party_size}p{r.table_name?' · '+r.table_name:''}</p>
                  </div>
                  <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:r.status==='confirmada'?'#f0fdf4':'#f8fafc',color:r.status==='confirmada'?'#059669':'#94a3b8',fontWeight:600,flexShrink:0}}>{r.status}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  )
}