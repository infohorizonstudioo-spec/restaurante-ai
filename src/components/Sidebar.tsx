'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const PLAN_LABELS:Record<string,string> = {free:'Trial',trial:'Trial',starter:'Starter',pro:'Pro',business:'Business'}
const PLAN_COLORS:Record<string,string> = {free:'#d97706',trial:'#d97706',starter:'#1d4ed8',pro:'#7c3aed',business:'#059669'}
const PLAN_LIMITS:Record<string,number> = {free:10,trial:10,starter:50,pro:200,business:600}

function Ico({d,s=17}:{d:string;s?:number}){
  return <svg width={s} height={s} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'><path d={d}/></svg>
}

const NAV = [
  {href:'/panel',        label:'Centro de control', icon:'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', plans:null},
  {href:'/reservas',     label:'Reservas',           icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', plans:null},
  {href:'/agenda',       label:'Agenda',             icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', plans:null},
  {href:'/llamadas',     label:'Llamadas',           icon:'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', plans:null},
  {href:'/clientes',     label:'Clientes',           icon:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', plans:null},
  {href:'/mesas',        label:'Local y mesas',      icon:'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', plans:null},
  {href:'/pedidos',      label:'Pedidos',            icon:'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', plans:['pro','business']},
  {href:'/estadisticas', label:'Estadísticas',       icon:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', plans:['pro','business']},
  {href:'/facturacion',  label:'Uso y facturación',  icon:'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z', plans:null},
  {href:'/configuracion',label:'Configuración',      icon:'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', plans:null},
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [tenant,setTenant]       = useState<any>(null)
  const [collapsed,setCollapsed] = useState(false)
  const [loading,setLoading]     = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({data:{user}}) => {
      if (!user) return
      supabase.from('profiles').select('tenant_id').eq('id',user.id).single().then(({data:p}) => {
        if (!p?.tenant_id) { setLoading(false); return }
        supabase.from('tenants')
          .select('id,name,plan,free_calls_used,free_calls_limit,plan_calls_used,plan_calls_included,agent_phone,agent_name')
          .eq('id',p.tenant_id).single()
          .then(({data:t}) => { setTenant(t); setLoading(false) })
      })
    })
  },[])

  async function logout() { await supabase.auth.signOut(); router.push('/login') }

  const plan      = tenant?.plan || 'free'
  const isTrial   = plan === 'free' || plan === 'trial'
  const planLabel = PLAN_LABELS[plan] || 'Trial'
  const planColor = PLAN_COLORS[plan] || '#d97706'
  const agentOk   = !!tenant?.agent_phone
  const callsUsed = isTrial ? (tenant?.free_calls_used||0) : (tenant?.plan_calls_used||0)
  const callsLim  = isTrial ? (tenant?.free_calls_limit||10) : (tenant?.plan_calls_included || PLAN_LIMITS[plan] || 50)
  const callsPct  = Math.min(100, Math.round((callsUsed/callsLim)*100))
  const callsLeft = Math.max(0, callsLim - callsUsed)
  const W = collapsed ? 64 : 220

  return (
    <aside style={{width:W,minHeight:'100vh',background:'#0f172a',color:'white',display:'flex',flexDirection:'column',flexShrink:0,transition:'width 0.2s ease',overflow:'hidden',position:'relative'}}>

      {/* Header */}
      <div style={{padding:collapsed?'16px 12px':'16px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.07)',minHeight:60}}>
        {!collapsed && (
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <div style={{width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#1e40af,#3b82f6)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width='14' height='14' viewBox='0 0 24 24' fill='white'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z'/></svg>
            </div>
            <span style={{fontWeight:700,fontSize:14,letterSpacing:'-0.01em',whiteSpace:'nowrap'}}>Reservo.AI</span>
          </div>
        )}
        <button onClick={()=>setCollapsed(!collapsed)} style={{padding:6,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:7,cursor:'pointer',color:'rgba(255,255,255,0.5)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontFamily:'inherit'}}>
          <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d={collapsed?'M9 18l6-6-6-6':'M15 18l-6-6 6-6'}/></svg>
        </button>
      </div>

      {/* Agent status */}
      {!collapsed && (
        <div style={{padding:'9px 14px',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
          <div style={{display:'flex',alignItems:'center',gap:7}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:agentOk?'#4ade80':'#f87171',flexShrink:0,animation:agentOk?'spulse 2s infinite':'none'}}/>
            <span style={{fontSize:11,color:agentOk?'#86efac':'#fca5a5',fontWeight:500}}>
              {agentOk ? (tenant?.agent_name||'Sofía')+' activa' : 'Sin número configurado'}
            </span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{flex:1,padding:'10px 8px',display:'flex',flexDirection:'column',gap:2,overflowY:'auto',overflowX:'hidden'}}>
        {NAV.map(item => {
          const active = pathname===item.href || (item.href!=='/panel' && pathname.startsWith(item.href))
          const locked = item.plans && !item.plans.includes(plan)
          return (
            <a key={item.href} href={locked?'/precios':item.href}
              title={collapsed?item.label+(locked?' (requiere '+item.plans?.join('/')+')'):'':undefined}
              style={{display:'flex',alignItems:'center',gap:10,padding:collapsed?'9px 10px':'8px 10px',borderRadius:9,
                background:active?'rgba(59,130,246,0.15)':'transparent',
                border:active?'1px solid rgba(59,130,246,0.2)':'1px solid transparent',
                color:active?'#60a5fa':locked?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.65)',
                textDecoration:'none',cursor:'pointer',transition:'all 0.12s',
                justifyContent:collapsed?'center':'flex-start',minWidth:0}}
              onMouseEnter={e=>{if(!active)(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)'}}
              onMouseLeave={e=>{if(!active)(e.currentTarget as HTMLElement).style.background='transparent'}}
            >
              <span style={{flexShrink:0,opacity:locked?0.4:1}}><Ico d={item.icon}/></span>
              {!collapsed && <span style={{fontSize:13,fontWeight:active?600:400,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.label}</span>}
              {!collapsed && locked && <span style={{marginLeft:'auto',fontSize:9,fontWeight:700,color:'#f59e0b',background:'rgba(245,158,11,0.12)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:4,padding:'1px 5px',flexShrink:0,textTransform:'uppercase',letterSpacing:'0.03em'}}>Pro</span>}
              {!collapsed && active && <div style={{position:'absolute',right:8,width:5,height:5,borderRadius:'50%',background:'#3b82f6'}}/>}
            </a>
          )
        })}
      </nav>

      {/* Call usage bar */}
      {!collapsed && !loading && (
        <div style={{padding:'10px 14px',borderTop:'1px solid rgba(255,255,255,0.07)'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'0.04em',fontWeight:600}}>Llamadas</span>
            <span style={{fontSize:11,fontWeight:700,color:callsLeft<=3?'#f87171':'rgba(255,255,255,0.7)'}}>{callsUsed}/{callsLim}</span>
          </div>
          <div style={{height:4,background:'rgba(255,255,255,0.08)',borderRadius:2,overflow:'hidden',marginBottom:6}}>
            <div style={{height:'100%',width:callsPct+'%',background:callsLeft<=3?'#ef4444':callsPct>80?'#f59e0b':'#3b82f6',borderRadius:2,transition:'width 0.4s'}}/>
          </div>
          {isTrial && callsLeft <= 3 && (
            <a href='/precios' style={{display:'block',fontSize:11,color:'#f59e0b',textDecoration:'none',fontWeight:600}}>
              {callsLeft===0?'Sin llamadas — Activar plan':'Quedan '+callsLeft+' — Actualizar'}
            </a>
          )}
        </div>
      )}

      {/* Plan + logout */}
      <div style={{padding:'10px 8px',borderTop:'1px solid rgba(255,255,255,0.07)'}}>
        {!collapsed && (
          <a href='/facturacion' style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:9,textDecoration:'none',marginBottom:4,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:planColor,flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:11,fontWeight:700,color:'white',letterSpacing:'0.02em'}}>{planLabel}</p>
              <p style={{fontSize:10,color:'rgba(255,255,255,0.35)',marginTop:1}}>{tenant?.name||'—'}</p>
            </div>
            <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' strokeWidth='2'><path d='M9 18l6-6-6-6'/></svg>
          </a>
        )}
        <button onClick={logout} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:collapsed?'9px 10px':'8px 10px',borderRadius:9,background:'transparent',border:'1px solid transparent',cursor:'pointer',color:'rgba(255,255,255,0.4)',fontFamily:'inherit',justifyContent:collapsed?'center':'flex-start',transition:'all 0.12s'}}
          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.05)'}
          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
        >
          <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><path d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'/></svg>
          {!collapsed && <span style={{fontSize:13}}>Cerrar sesión</span>}
        </button>
      </div>
      <style>{`@keyframes spulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </aside>
  )
}