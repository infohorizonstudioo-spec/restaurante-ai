'use client'
import{useEffect,useState,useCallback}from'react'
import{usePathname}from'next/navigation'
import{supabase}from'@/lib/supabase'
import{BUSINESS_TEMPLATES}from'@/types'
import type{Tenant}from'@/types'

const ICONS:Record<string,string> = {
  panel:     'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  reservas:  'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
  agenda:    'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z',
  clientes:  'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  llamadas:  'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  pedidos:   'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.1 17 7 17h11v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H15c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 19.5 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
  config:    'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  precios:   'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
  logout:    'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
}

const MODULE_MAP:Record<string,{icon:string;label:string;href:string}> = {
  resumen:        {icon:'panel',    label:'Inicio',    href:'/panel'},
  reservas:       {icon:'reservas', label:'Reservas',  href:'/reservas'},
  citas:          {icon:'reservas', label:'Citas',     href:'/reservas'},
  mesas:          {icon:'agenda',   label:'Mesas',     href:'/mesas'},
  pedidos:        {icon:'pedidos',  label:'Pedidos',   href:'/pedidos'},
  agenda:         {icon:'agenda',   label:'Agenda',    href:'/agenda'},
  clientes:       {icon:'clientes', label:'Clientes',  href:'/clientes'},
  conversaciones: {icon:'llamadas', label:'Llamadas',  href:'/llamadas'},
  seguimientos:   {icon:'llamadas', label:'Seguim.',   href:'/llamadas'},
  oportunidades:  {icon:'clientes', label:'Clientes',  href:'/clientes'},
}

const PLAN_COLOR:Record<string,string> = {trial:'#f59e0b',starter:'#3b82f6',pro:'#8b5cf6',business:'#10b981'}

function Icon({path,size=16,color='currentColor'}:{path:string;size?:number;color?:string}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{flexShrink:0}}><path d={path}/></svg>
}

function NavItem({icon,label,href,isActive,collapsed}:{icon:string;label:string;href:string;isActive:boolean;collapsed:boolean}){
  const[h,setH]=useState(false)
  const bg = isActive?'rgba(59,130,246,0.12)':h?'rgba(255,255,255,0.04)':'transparent'
  const col = isActive?'#93c5fd':h?'#e2e8f0':'#94a3b8'
  const border = isActive?'#3b82f6':'transparent'
  return(
    <a href={href} title={collapsed?label:undefined}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{display:'flex',alignItems:'center',gap:collapsed?0:10,padding:collapsed?'9px 0':'8px 12px',justifyContent:collapsed?'center':'flex-start',borderRadius:8,textDecoration:'none',borderLeft:`2px solid ${border}`,background:bg,color:col,fontSize:13,fontWeight:isActive?600:400,transition:'all 0.12s',whiteSpace:'nowrap',overflow:'hidden'}}>
      <Icon path={ICONS[icon]||ICONS.panel} size={16} color={col}/>
      {!collapsed&&<span style={{transition:'opacity 0.15s',color:col}}>{label}</span>}
    </a>
  )
}

export default function Sidebar(){
  const[tenant,setTenant]=useState<Tenant|null>(null)
  const[collapsed,setCollapsed]=useState(false)
  const pathname=usePathname()

  useEffect(()=>{
    const mq=window.matchMedia('(max-width:1024px)')
    if(mq.matches)setCollapsed(true)
    const cb=(e:MediaQueryListEvent)=>setCollapsed(e.matches)
    mq.addEventListener('change',cb)
    return()=>mq.removeEventListener('change',cb)
  },[])

  useEffect(()=>{
    let mounted=true
    supabase.auth.getUser().then(({data:{user}})=>{
      if(!user||!mounted)return
      supabase.from('profiles').select('tenant_id').eq('id',user.id).single().then(({data:p})=>{
        if(!(p as any)?.tenant_id||!mounted)return
        supabase.from('tenants').select('*').eq('id',(p as any).tenant_id).single().then(({data:t})=>{
          if(mounted)setTenant(t)
        })
      })
    })
    return()=>{mounted=false}
  },[])

  const signOut=useCallback(async()=>{await supabase.auth.signOut();window.location.href='/login'},[])

  const template=BUSINESS_TEMPLATES[tenant?.type||'otro']||BUSINESS_TEMPLATES.otro
  const modules=(template.modules as string[]).map(m=>MODULE_MAP[m]).filter(Boolean)
  const isTrial=!tenant?.plan||tenant.plan==='trial'||tenant.plan==='free'
  const callsLeft=Math.max(0,(tenant?.free_calls_limit||10)-(tenant?.free_calls_used||0))
  const planColor=PLAN_COLOR[tenant?.plan||'trial']
  const width=collapsed?60:224

  return(
    <aside style={{width,minWidth:width,background:'#0f172a',display:'flex',flexDirection:'column',height:'100vh',position:'sticky',top:0,flexShrink:0,transition:'width 0.2s ease',overflow:'hidden',borderRight:'1px solid rgba(255,255,255,0.06)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:collapsed?'center':'space-between',padding:collapsed?'0':'0 14px',height:56,borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
        {!collapsed&&(
          <>
            <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
              <div style={{width:26,height:26,background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <span style={{color:'#f1f5f9',fontWeight:700,fontSize:14,letterSpacing:'-0.01em'}}>Reservo.AI</span>
            </div>
            <button onClick={()=>setCollapsed(true)} style={{width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'none',cursor:'pointer',color:'#475569',borderRadius:5,transition:'color 0.12s'}}
              onMouseEnter={e=>(e.currentTarget.style.color='#94a3b8')} onMouseLeave={e=>(e.currentTarget.style.color='#475569')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </>
        )}
        {collapsed&&(
          <div style={{width:26,height:26,background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
        )}
      </div>

      {/* Tenant pill */}
      {tenant&&!collapsed&&(
        <div style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
          <p style={{color:'#cbd5e1',fontSize:12,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:3}}>{tenant.name}</p>
          <div style={{display:'flex',alignItems:'center',gap:5}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:planColor,flexShrink:0}}/>
            <span style={{fontSize:11,fontWeight:600,color:planColor,textTransform:'capitalize'}}>{tenant.plan||'Trial'}</span>
            {isTrial&&<><span style={{color:'rgba(255,255,255,0.15)',fontSize:10}}>·</span><a href="/precios" style={{fontSize:11,color:callsLeft<=3?'#fbbf24':'#64748b',textDecoration:'none'}}>{callsLeft}/10 llamadas</a></>}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{flex:1,padding:'8px 6px',overflowY:'auto',overflowX:'hidden',scrollbarWidth:'none'}}>
        <div style={{display:'flex',flexDirection:'column',gap:2}}>
          {modules.map(m=>{
            const active=pathname===m.href||(m.href!=='/panel'&&pathname?.startsWith(m.href))
            return<NavItem key={m.href+m.label} {...m} isActive={active} collapsed={collapsed}/>
          })}
          <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'8px 0'}}/>
          <NavItem icon="config" label="Configuración" href="/configuracion" isActive={pathname==='/configuracion'} collapsed={collapsed}/>
          <NavItem icon="precios" label="Planes" href="/precios" isActive={pathname==='/precios'} collapsed={collapsed}/>
        </div>
      </nav>

      {/* Footer */}
      <div style={{padding:'8px 6px',borderTop:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
        {collapsed&&(
          <button onClick={()=>setCollapsed(false)} style={{width:'100%',padding:'8px 0',display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'none',cursor:'pointer',color:'#475569',borderRadius:8,marginBottom:4,transition:'color 0.12s'}}
            onMouseEnter={e=>(e.currentTarget.style.color='#94a3b8')} onMouseLeave={e=>(e.currentTarget.style.color='#475569')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
        <button onClick={signOut} title={collapsed?'Cerrar sesión':undefined}
          style={{width:'100%',display:'flex',alignItems:'center',gap:collapsed?0:10,justifyContent:collapsed?'center':'flex-start',padding:collapsed?'9px 0':'8px 12px',background:'transparent',border:'none',cursor:'pointer',color:'#64748b',borderRadius:8,fontSize:13,fontWeight:400,transition:'all 0.12s'}}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color='#f87171';(e.currentTarget as HTMLElement).style.background='rgba(248,113,113,0.08)'}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color='#64748b';(e.currentTarget as HTMLElement).style.background='transparent'}}>
          <Icon path={ICONS.logout} size={15} color="currentColor"/>
          {!collapsed&&<span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}