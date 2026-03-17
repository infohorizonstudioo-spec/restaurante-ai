'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BUSINESS_TEMPLATES } from '@/types'
import type { Tenant, Call, Reservation } from '@/types'
import { Phone, Calendar, Users, Zap, ArrowRight, PhoneIncoming, Bot, AlertTriangle, Activity, Clock } from 'lucide-react'
import { PageLoader, StatCard, Card, CardHeader, Badge, EmptyState, Alert } from '@/components/ui'

const CALL_STATUS: Record<string,{label:string;variant:'green'|'blue'|'slate'}> = {
  completed:{label:'Completada',variant:'green'},
  active:   {label:'Activa',    variant:'blue'},
  missed:   {label:'Perdida',   variant:'slate'},
}

export default function PanelPage() {
  const [data,setData]     = useState<any>(null)
  const [loading,setLoading] = useState(true)
  const [error,setError]   = useState('')

  const loadData = useCallback(async()=>{
    try {
      const {data:{user}} = await supabase.auth.getUser()
      if(!user){window.location.href='/login';return}
      const {data:profile} = await supabase.from('profiles').select('tenant_id,role').eq('id',user.id).single()
      if(!profile){window.location.href='/login';return}
      if((profile as any).role==='superadmin'){window.location.href='/admin';return}
      const tid = (profile as any).tenant_id
      if(!tid){window.location.href='/onboarding';return}
      const today = new Date().toISOString().split('T')[0]
      const [
        {data:tenant},
        {data:calls},
        {data:allRes},
        {count:totalCustomers},
      ] = await Promise.all([
        supabase.from('tenants').select('*').eq('id',tid).single(),
        supabase.from('calls').select('*').eq('tenant_id',tid).order('created_at',{ascending:false}).limit(8),
        supabase.from('reservations').select('*').eq('tenant_id',tid).gte('reservation_date',today).order('reservation_date').order('reservation_time').limit(30),
        supabase.from('customers').select('*',{count:'exact',head:true}).eq('tenant_id',tid),
      ])
      if(!tenant){setError('No se pudo cargar el negocio.');return}
      setData({tenant,calls:calls||[],todayRes:(allRes||[]).filter((r:any)=>r.reservation_date===today),upcomingRes:(allRes||[]).filter((r:any)=>r.reservation_date>today).slice(0,6),totalCustomers:totalCustomers||0})
    } catch(e){setError('Error al cargar el panel.');console.error(e)}
    finally{setLoading(false)}
  },[])

  useEffect(()=>{loadData()},[loadData])

  if(loading) return <PageLoader/>
  if(error) return <div className="p-6"><Alert variant="error" title="Error de carga">{error}</Alert></div>
  if(!data)  return null

  const {tenant,calls,todayRes,upcomingRes,totalCustomers} = data
  const template  = BUSINESS_TEMPLATES[tenant.type]||BUSINESS_TEMPLATES.otro
  const isTrial   = !tenant.plan||tenant.plan==='trial'||tenant.plan==='free'
  const callsLeft = Math.max(0,(tenant.free_calls_limit||10)-(tenant.free_calls_used||0))
  const resUnit   = template.reservationUnit==='mesa'?'Reservas':'Citas'
  const now = new Date()
  const h   = now.getHours()
  const greeting = h<13?'Buenos días':h<20?'Buenas tardes':'Buenas noches'
  const dateStr  = now.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})

  return (
    <div style={{background:'var(--color-bg)',minHeight:'100vh'}}>
      <header style={{height:'var(--header-height)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 var(--content-pad)',background:'var(--color-surface)',borderBottom:'1px solid var(--color-border)',position:'sticky',top:0,zIndex:'var(--z-header)' as any,gap:12}}>
        <div>
          <p className="text-title-sm">{greeting}, {tenant.name}</p>
          <p className="text-xs capitalize" style={{color:'var(--color-text-muted)',marginTop:1}}>{dateStr}</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {isTrial&&callsLeft<=3&&(
            <a href="/precios" className="badge badge-amber" style={{textDecoration:'none',padding:'5px 10px',fontSize:12,gap:4}}>
              <AlertTriangle size={11}/>{callsLeft} llamadas restantes
            </a>
          )}
          <div style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'var(--color-text-muted)'}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:'var(--color-success)'}}/>Agente activo
          </div>
        </div>
      </header>

      <div style={{maxWidth:'var(--content-max)',margin:'0 auto',padding:'var(--content-pad)'}}>
        {isTrial&&callsLeft===0&&(
          <Alert variant="warning" className="mb-5" title="Llamadas gratuitas agotadas">
            Activa un plan para que el agente siga atendiendo.{' '}
            <a href="/precios" style={{fontWeight:600,textDecoration:'underline'}}>Ver planes →</a>
          </Alert>
        )}
        {!tenant.agent_phone&&(
          <div style={{background:'linear-gradient(135deg,#4f46e5,#6366f1)',borderRadius:'var(--radius-lg)',padding:'20px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,gap:16}}>
            <div>
              <p style={{color:'#fff',fontWeight:600,fontSize:14}}>Activa tu recepcionista AI</p>
              <p style={{color:'rgba(255,255,255,0.75)',fontSize:12,marginTop:3}}>Asigna un número para recibir llamadas</p>
            </div>
            <a href="/configuracion" style={{background:'#fff',color:'#4f46e5',padding:'8px 16px',borderRadius:'var(--radius-md)',fontWeight:600,fontSize:13,textDecoration:'none',flexShrink:0,boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}}>
              Configurar →
            </a>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:20}}>
          <StatCard label="Llamadas totales" value={calls.length} icon={<Phone size={17}/>} href="/llamadas" colorClass="text-indigo-600 bg-indigo-50"/>
          <StatCard label={resUnit+' hoy'} value={todayRes.length} icon={<Calendar size={17}/>} href="/reservas" colorClass="text-emerald-600 bg-emerald-50"/>
          <StatCard label="Clientes" value={totalCustomers} icon={<Users size={17}/>} href="/clientes" colorClass="text-sky-600 bg-sky-50"/>
          {isTrial
            ? <StatCard label="Llamadas gratis" value={callsLeft} icon={<Zap size={17}/>} href="/precios" colorClass={callsLeft<=3?'text-amber-600 bg-amber-50':'text-violet-600 bg-violet-50'}/>
            : <StatCard label="Uso del mes" value={`${tenant.plan_calls_used||0}/${tenant.plan_calls_included||50}`} icon={<Activity size={17}/>} href="/precios" colorClass="text-violet-600 bg-violet-50"/>
          }
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:12,alignItems:'start'}}>
          <Card>
            <CardHeader title="Llamadas recientes" icon={<Phone size={15}/>}
              action={<a href="/llamadas" className="btn btn-ghost btn-sm" style={{textDecoration:'none',color:'var(--color-brand)',gap:4}}>Ver todas <ArrowRight size={12}/></a>}/>
            {calls.length===0
              ? <EmptyState icon={<Phone size={20}/>} title="Sin llamadas aún" description="Las llamadas del agente aparecerán aquí en tiempo real"/>
              : calls.map((c:any,i:number)=>{
                  const st = CALL_STATUS[c.status]||CALL_STATUS.completed
                  return (
                    <div key={c.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 20px',borderTop:i>0?'1px solid var(--color-border-light)':'none'}}>
                      <div style={{width:34,height:34,borderRadius:10,background:c.status==='completed'?'var(--color-success-light)':'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
                        <PhoneIncoming size={14} style={{color:c.status==='completed'?'var(--color-success)':'var(--color-info)'}}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:2}}>
                          <p className="text-body" style={{fontWeight:500}}>{c.from_number||'Número desconocido'}</p>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </div>
                        {c.summary&&<p className="text-body-sm" style={{color:'var(--color-text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:380}}>{c.summary}</p>}
                        {c.action_suggested&&<p className="text-body-sm" style={{color:'var(--color-brand)',marginTop:3,display:'flex',alignItems:'center',gap:4}}><Zap size={10}/>{c.action_suggested}</p>}
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        {c.duration&&<p className="text-caption" style={{color:'var(--color-text-muted)',display:'flex',alignItems:'center',gap:3,justifyContent:'flex-end'}}><Clock size={10}/>{Math.floor(c.duration/60)}m{c.duration%60}s</p>}
                        <p className="text-caption" style={{color:'var(--color-text-muted)',marginTop:2}}>
                          {c.created_at?new Date(c.created_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):''}
                        </p>
                      </div>
                    </div>
                  )
                })
            }
          </Card>

          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <Card>
              <CardHeader title={resUnit+' hoy'} icon={<Calendar size={15}/>}
                action={<a href="/agenda" className="btn btn-ghost btn-sm" style={{textDecoration:'none',color:'var(--color-brand)',gap:4}}>Agenda <ArrowRight size={12}/></a>}/>
              {todayRes.length===0
                ? <div style={{padding:'24px 20px',textAlign:'center'}}><p className="text-body-sm" style={{color:'var(--color-text-muted)'}}>Sin {resUnit.toLowerCase()} hoy</p></div>
                : todayRes.slice(0,6).map((r:any,i:number)=>(
                    <div key={r.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 20px',borderTop:i>0?'1px solid var(--color-border-light)':'none'}}>
                      <div style={{minWidth:0}}>
                        <p className="text-body" style={{fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.customer_name}</p>
                        <p className="text-body-sm" style={{color:'var(--color-text-muted)'}}>{r.party_size} pers.{r.source==='voice_agent'?<span style={{marginLeft:4,color:'var(--color-brand)'}}>· IA</span>:''}</p>
                      </div>
                      <p className="text-mono" style={{color:'var(--color-text-secondary)',fontWeight:500,flexShrink:0,marginLeft:8}}>{r.reservation_time?.slice(0,5)}</p>
                    </div>
                  ))
              }
            </Card>
            {upcomingRes.length>0&&(
              <Card>
                <CardHeader title="Próximas" icon={<Calendar size={15}/>}/>
                {upcomingRes.map((r:any,i:number)=>(
                  <div key={r.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 20px',borderTop:i>0?'1px solid var(--color-border-light)':'none'}}>
                    <div>
                      <p className="text-body" style={{fontWeight:500}}>{r.customer_name}</p>
                      <p className="text-body-sm" style={{color:'var(--color-text-muted)'}}>{new Date(r.reservation_date+'T12:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})}</p>
                    </div>
                    <p className="text-mono" style={{color:'var(--color-text-muted)',fontSize:12,flexShrink:0}}>{r.reservation_time?.slice(0,5)}</p>
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