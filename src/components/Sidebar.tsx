'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BUSINESS_TEMPLATES } from '@/types'
import type { Tenant } from '@/types'
import {
  LayoutDashboard, Calendar, CalendarDays, Grid3X3, ShoppingBag,
  Users, Phone, Settings, CreditCard, LogOut, ChevronLeft, ChevronRight,
  Bell, Star, Bot, AlertTriangle, BarChart3, MessageSquare
} from 'lucide-react'

const MODULE_NAV: Record<string,{icon:any;label:string;href:string}> = {
  resumen:        {icon:LayoutDashboard, label:'Inicio',        href:'/panel'},
  reservas:       {icon:Calendar,        label:'Reservas',      href:'/reservas'},
  citas:          {icon:Calendar,        label:'Citas',         href:'/reservas'},
  mesas:          {icon:Grid3X3,         label:'Mesas',         href:'/mesas'},
  pedidos:        {icon:ShoppingBag,     label:'Pedidos',       href:'/pedidos'},
  agenda:         {icon:CalendarDays,    label:'Agenda',        href:'/agenda'},
  clientes:       {icon:Users,           label:'Clientes',      href:'/clientes'},
  conversaciones: {icon:Phone,           label:'Llamadas',      href:'/llamadas'},
  seguimientos:   {icon:MessageSquare,   label:'Seguimientos',  href:'/llamadas'},
  oportunidades:  {icon:Star,            label:'Oportunidades', href:'/clientes'},
  alertas:        {icon:Bell,            label:'Alertas',       href:'/alertas'},
  estadisticas:   {icon:BarChart3,       label:'Estadísticas',  href:'/estadisticas'},
}

const PLAN_BADGE: Record<string,{label:string;color:string}> = {
  trial:    {label:'Trial',    color:'#fbbf24'},
  starter:  {label:'Starter', color:'#38bdf8'},
  pro:      {label:'Pro',     color:'#a5b4fc'},
  business: {label:'Business',color:'#c084fc'},
}

function NavItem({icon:Icon,label,href,isActive,collapsed}:{icon:any;label:string;href:string;isActive:boolean;collapsed:boolean}) {
  const [hovered,setHovered] = useState(false)
  return (
    <a href={href} title={collapsed?label:undefined}
      onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{
        display:'flex', alignItems:'center', gap:collapsed?0:10,
        padding:collapsed?'8px 0':'7px 10px',
        justifyContent:collapsed?'center':'flex-start',
        borderRadius:8, textDecoration:'none',
        borderLeft:isActive?'2px solid var(--sidebar-active-border)':'2px solid transparent',
        background:isActive?'var(--sidebar-active-bg)':hovered?'var(--sidebar-hover-bg)':'transparent',
        color:isActive?'var(--sidebar-text-active)':hovered?'var(--sidebar-text-hover)':'var(--sidebar-text)',
        fontSize:13, fontWeight:500, transition:'all 0.12s', whiteSpace:'nowrap', overflow:'hidden',
      }}>
      <Icon size={15} style={{flexShrink:0,opacity:isActive?1:0.75}}/>
      {!collapsed && <span>{label}</span>}
    </a>
  )
}

export default function Sidebar() {
  const [tenant,setTenant] = useState<Tenant|null>(null)
  const [collapsed,setCollapsed] = useState(false)
  const pathname = usePathname()

  useEffect(()=>{
    const mq = window.matchMedia('(max-width:1024px)')
    setCollapsed(mq.matches)
    const cb = (e:MediaQueryListEvent) => setCollapsed(e.matches)
    mq.addEventListener('change',cb)
    return ()=>mq.removeEventListener('change',cb)
  },[])

  useEffect(()=>{
    let mounted=true
    supabase.auth.getUser().then(({data:{user}})=>{
      if(!user||!mounted) return
      supabase.from('profiles').select('tenant_id').eq('id',user.id).single().then(({data:p})=>{
        if(!p?.tenant_id||!mounted) return
        supabase.from('tenants').select('*').eq('id',(p as any).tenant_id).single().then(({data:t})=>{
          if(mounted) setTenant(t)
        })
      })
    })
    return ()=>{mounted=false}
  },[])

  const signOut = useCallback(async()=>{
    await supabase.auth.signOut()
    window.location.href='/login'
  },[])

  const template = BUSINESS_TEMPLATES[tenant?.type||'otro']||BUSINESS_TEMPLATES.otro
  const modules  = (template.modules as string[]).map(m=>MODULE_NAV[m]).filter(Boolean)
  const isTrial  = !tenant?.plan||tenant.plan==='trial'||tenant.plan==='free'
  const callsLeft = Math.max(0,(tenant?.free_calls_limit||10)-(tenant?.free_calls_used||0))
  const planInfo  = PLAN_BADGE[tenant?.plan||'trial']
  const lowCalls  = isTrial&&callsLeft<=3

  return (
    <aside role="navigation" aria-label="Menú principal"
      style={{
        width:collapsed?'var(--sidebar-collapsed)':'var(--sidebar-width)',
        background:'var(--sidebar-bg)', display:'flex', flexDirection:'column',
        height:'100vh', position:'sticky', top:0, flexShrink:0,
        transition:'width 0.2s ease', zIndex:'var(--z-sidebar)', overflowX:'hidden',
      }}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:collapsed?'center':'space-between',padding:collapsed?0:'0 12px',height:'var(--header-height)',borderBottom:'1px solid var(--sidebar-separator)',flexShrink:0}}>
        {!collapsed && (
          <div style={{display:'flex',alignItems:'center',gap:9,minWidth:0}}>
            <div style={{width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#6366f1,#4f46e5)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 2px 8px rgba(79,70,229,0.4)'}}>
              <Bot size={14} color="#fff"/>
            </div>
            <p style={{color:'#f1f5f9',fontWeight:700,fontSize:13,letterSpacing:'-0.01em',lineHeight:1}}>Reservo.AI</p>
          </div>
        )}
        {collapsed && <div style={{width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#6366f1,#4f46e5)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(79,70,229,0.4)'}}><Bot size={14} color="#fff"/></div>}
        {!collapsed && (
          <button onClick={()=>setCollapsed(true)} style={{width:24,height:24,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'none',cursor:'pointer',color:'var(--sidebar-text)'}}>
            <ChevronLeft size={14}/>
          </button>
        )}
      </div>

      {/* Tenant info */}
      {tenant&&!collapsed&&(
        <div style={{padding:'10px 12px',borderBottom:'1px solid var(--sidebar-separator)',flexShrink:0}}>
          <p style={{color:'#cbd5e1',fontSize:12,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:3}}>{tenant.name}</p>
          <div style={{display:'flex',alignItems:'center',gap:5}}>
            <span style={{fontSize:11,fontWeight:600,color:planInfo.color}}>{planInfo.label}</span>
            {isTrial&&(
              <>
                <span style={{color:'rgba(255,255,255,0.1)',fontSize:10}}>·</span>
                <a href="/precios" style={{fontSize:11,color:lowCalls?'#fbbf24':'var(--sidebar-text)',textDecoration:'none',display:'flex',alignItems:'center',gap:3}}>
                  {lowCalls&&<AlertTriangle size={10}/>}{callsLeft}/10 llamadas
                </a>
              </>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{flex:1,padding:8,overflowY:'auto',overflowX:'hidden'}} className="scrollbar-hide">
        <div style={{display:'flex',flexDirection:'column',gap:1}}>
          {modules.map(mod=>{
            const isActive = pathname===mod.href||(mod.href!=='/panel'&&pathname?.startsWith(mod.href))
            return <NavItem key={mod.href+mod.label} {...mod} isActive={isActive} collapsed={collapsed}/>
          })}
          <div style={{height:1,background:'var(--sidebar-separator)',margin:'6px 0'}}/>
          <NavItem icon={Settings} label="Configuración" href="/configuracion" isActive={pathname==='/configuracion'} collapsed={collapsed}/>
          <NavItem icon={CreditCard} label="Planes" href="/precios" isActive={pathname==='/precios'} collapsed={collapsed}/>
        </div>
      </nav>

      {/* Footer */}
      <div style={{padding:8,borderTop:'1px solid var(--sidebar-separator)',flexShrink:0,display:'flex',flexDirection:'column',gap:2}}>
        {collapsed&&(
          <button onClick={()=>setCollapsed(false)} style={{width:'100%',padding:'8px 0',display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'none',cursor:'pointer',color:'var(--sidebar-text)',borderRadius:8,marginBottom:2}}>
            <ChevronRight size={14}/>
          </button>
        )}
        <button onClick={signOut} title={collapsed?'Cerrar sesión':undefined}
          style={{width:'100%',display:'flex',alignItems:'center',gap:collapsed?0:10,justifyContent:collapsed?'center':'flex-start',padding:collapsed?'8px 0':'7px 10px',background:'transparent',border:'none',cursor:'pointer',color:'var(--sidebar-text)',borderRadius:8,fontSize:13,fontWeight:500,transition:'all 0.12s'}}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color='#f87171';(e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.08)'}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color='var(--sidebar-text)';(e.currentTarget as HTMLElement).style.background='transparent'}}>
          <LogOut size={15} style={{opacity:0.7,flexShrink:0}}/>
          {!collapsed&&<span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}