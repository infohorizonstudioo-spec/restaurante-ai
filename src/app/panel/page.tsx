'use client'
import{useEffect,useState,useCallback}from'react'
import{supabase}from'@/lib/supabase'
import{BUSINESS_TEMPLATES}from'@/types'
import{PageLoader,StatCard,Card,CardHeader,Badge,EmptyState,Alert}from'@/components/ui'

const CALL_STATUS={completed:{l:'Completada',c:'#059669',bg:'#d1fae5'},active:{l:'Activa',c:'#1d4ed8',bg:'#dbeafe'},missed:{l:'Perdida',c:'#991b1b',bg:'#fee2e2'}}

export default function PanelPage(){
  const[data,setData]=useState(null)
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')

  const load=useCallback(async()=>{
    try{
      const{data:{user}}=await supabase.auth.getUser()
      if(!user){window.location.href='/login';return}
      const{data:p}=await supabase.from('profiles').select('tenant_id,role').eq('id',user.id).single()
      if(!p){window.location.href='/login';return}
      if(p.role==='superadmin'){window.location.href='/admin';return}
      const tid=p.tenant_id
      if(!tid){window.location.href='/onboarding';return}
      const today=new Date().toISOString().split('T')[0]
      const[{data:tenant},{data:calls},{data:allRes},{count:totalCustomers}]=await Promise.all([
        supabase.from('tenants').select('*').eq('id',tid).single(),
        supabase.from('calls').select('*').eq('tenant_id',tid).order('created_at',{ascending:false}).limit(8),
        supabase.from('reservations').select('*').eq('tenant_id',tid).gte('reservation_date',today).order('reservation_date').order('reservation_time').limit(30),
        supabase.from('customers').select('*',{count:'exact',head:true}).eq('tenant_id',tid),
      ])
      if(!tenant){setError('No se pudo cargar el negocio');return}
      setData({tenant,calls:calls||[],todayRes:(allRes||[]).filter(r=>r.reservation_date===today),upcomingRes:(allRes||[]).filter(r=>r.reservation_date>today).slice(0,5),totalCustomers:totalCustomers||0})
    }catch(e){setError('Error al cargar.'+e.message);console.error(e)}
    finally{setLoading(false)}
  },[]);useEffect(()=>{load()},[load])

  if(loading)return<PageLoader/>
  if(error)return<div style={{padding:24}}><Alert variant='error' title='Error'>{error}</Alert></div>
  if(!data)return null

  const{tenant,calls,todayRes,upcomingRes,totalCustomers}=data
  const template=BUSINESS_TEMPLATES[tenant.type]||BUSINESS_TEMPLATES.otro
  const isTrial=!tenant.plan||tenant.plan==='trial'||tenant.plan==='free'
  const callsLeft=Math.max(0,(tenant.free_calls_limit||10)-(tenant.free_calls_used||0))
  const h=new Date().getHours()
  const greeting=h<13?'Buenos días':h<20?'Buenas tardes':'Buenas noches'
  const date=new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})
  const resUnit=template.reservationUnit==='mesa'?'Reservas':'Citas'

  return(
    <div style={{background:'#f8fafc',minHeight:'100vh'}}>
      <header style={{height:56,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',background:'white',borderBottom:'1px solid #e2e8f0',position:'sticky',top:0,zIndex:40,gap:12}}>
        <div>
          <p style={{fontSize:15,fontWeight:600,color:'#0f172a'}}>{greeting}, <span style={{color:'#1d4ed8'}}>{tenant.name}</span></p>
          <p style={{fontSize:12,color:'#94a3b8',textTransform:'capitalize'}}>{date}</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {isTrial&&callsLeft<=3&&<a href='/precios' style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:20,fontSize:12,fontWeight:600,color:'#92400e',textDecoration:'none'}}>⚠ {callsLeft} llamadas restantes</a>}
          <div style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#94a3b8'}}><div style={{width:7,height:7,borderRadius:'50%',background:'#059669'}}/>Agente activo</div>
        </div>
      </header>

      <div style={{maxWidth:1200,margin:'0 auto',padding:24,display:'flex',flexDirection:'column',gap:16}}>

        {isTrial&&callsLeft===0&&<Alert variant='warning' title='Llamadas agotadas'>Activa un plan para seguir atendiendo. <a href='/precios' style={{fontWeight:600}}>Ver planes →</a></Alert>}

        {!tenant.agent_phone&&(
          <div style={{background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:12,padding:'18px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
            <div><p style={{color:'white',fontWeight:600,fontSize:14}}>Activa tu recepcionista AI</p><p style={{color:'rgba(255,255,255,0.75)',fontSize:12,marginTop:3}}>Configura el número para recibir llamadas automáticamente</p></div>
            <a href='/configuracion' style={{background:'white',color:'#1e40af',padding:'8px 18px',borderRadius:8,fontWeight:600,fontSize:13,textDecoration:'none',flexShrink:0}}>Configurar →</a>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          <StatCard label='Llamadas totales' value={calls.length} href='/llamadas' bg='#eff6ff' color='#1d4ed8' icon={<svg width='18' height='18' viewBox='0 0 24 24' fill='#1d4ed8'><path d='M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z'/></svg>}/>
          <StatCard label={resUnit+' hoy'} value={todayRes.length} href='/reservas' bg='#f0fdf4' color='#166534' icon={<svg width='18' height='18' viewBox='0 0 24 24' fill='#166534'><path d='M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z'/></svg>}/>
          <StatCard label='Clientes' value={totalCustomers} href='/clientes' bg='#faf5ff' color='#6b21a8' icon={<svg width='18' height='18' viewBox='0 0 24 24' fill='#6b21a8'><path d='M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z'/></svg>}/>
          {isTrial?<StatCard label='Llamadas gratis' value={callsLeft} href='/precios' bg={callsLeft<=3?'#fffbeb':'#faf5ff'} color={callsLeft<=3?'#92400e':'#6b21a8'} icon={<svg width='18' height='18' viewBox='0 0 24 24' fill={callsLeft<=3?'#92400e':'#6b21a8'}><path d='M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z'/></svg>}/>:<StatCard label='Uso mensual' value={(tenant.plan_calls_used||0)+'/'+(tenant.plan_calls_included||50)} href='/precios' bg='#f5f3ff' color='#5b21b6' icon={<svg width='18' height='18' viewBox='0 0 24 24' fill='#5b21b6'><path d='M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z'/></svg>}/>}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:12,alignItems:'start'}}>
          <Card>
            <CardHeader title='Llamadas recientes' action={<a href='/llamadas' style={{fontSize:13,color:'#1d4ed8',textDecoration:'none',fontWeight:500}}>Ver todas →</a>} icon={<svg width='15' height='15' viewBox='0 0 24 24' fill='#94a3b8'><path d='M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z'/></svg>}/>
            {calls.length===0
              ?<EmptyState icon={<svg width='20' height='20' viewBox='0 0 24 24' fill='#94a3b8'><path d='M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z'/></svg>} title='Sin llamadas aún' description='Las llamadas del agente aparecerán aquí en tiempo real'/>
              :<div>{calls.map((c,i)=>{
                const sc=CALL_STATUS[c.status]||CALL_STATUS.completed
                return(
                  <div key={c.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 20px',borderTop:i>0?'1px solid #f1f5f9':'none'}}>
                    <div style={{width:34,height:34,borderRadius:10,background:sc.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <svg width='14' height='14' viewBox='0 0 24 24' fill={sc.c}><path d='M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z'/></svg>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:2}}>
                        <p style={{fontSize:13,fontWeight:500,color:'#0f172a'}}>{c.from_number||'Número desconocido'}</p>
                        <Badge variant={c.status==='completed'?'green':c.status==='missed'?'red':'blue'}>{sc.l}</Badge>
                      </div>
                      {c.summary&&<p style={{fontSize:12,color:'#64748b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.summary}</p>}
                    </div>
                    <p style={{fontSize:11,color:'#94a3b8',flexShrink:0}}>{c.created_at?new Date(c.created_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):''}</p>
                  </div>
                )
              })}</div>
            }
          </Card>

          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <Card>
              <CardHeader title={resUnit+' hoy'} action={<a href='/agenda' style={{fontSize:12,color:'#1d4ed8',textDecoration:'none'}}>Agenda →</a>} icon={<svg width='15' height='15' viewBox='0 0 24 24' fill='#94a3b8'><path d='M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z'/></svg>}/>
              {todayRes.length===0
                ?<div style={{padding:'20px',textAlign:'center'}}><p style={{fontSize:13,color:'#94a3b8'}}>Sin {resUnit.toLowerCase()} hoy</p></div>
                :todayRes.slice(0,6).map((r,i)=>(
                  <div key={r.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 20px',borderTop:i>0?'1px solid #f1f5f9':'none'}}>
                    <div><p style={{fontSize:13,fontWeight:500,color:'#0f172a'}}>{r.customer_name}</p><p style={{fontSize:11,color:'#94a3b8'}}>{r.party_size} pers.</p></div>
                    <p style={{fontSize:13,fontFamily:'monospace',fontWeight:600,color:'#374151'}}>{r.reservation_time?.slice(0,5)}</p>
                  </div>
                ))
              }
            </Card>
            {upcomingRes.length>0&&(
              <Card>
                <CardHeader title='Próximas' icon={<svg width='15' height='15' viewBox='0 0 24 24' fill='#94a3b8'><path d='M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z'/></svg>}/>
                {upcomingRes.map((r,i)=>(
                  <div key={r.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 20px',borderTop:i>0?'1px solid #f1f5f9':'none'}}>
                    <div><p style={{fontSize:13,fontWeight:500,color:'#0f172a'}}>{r.customer_name}</p><p style={{fontSize:11,color:'#94a3b8'}}>{new Date(r.reservation_date+'T12:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})}</p></div>
                    <p style={{fontSize:12,fontFamily:'monospace',color:'#94a3b8'}}>{r.reservation_time?.slice(0,5)}</p>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}