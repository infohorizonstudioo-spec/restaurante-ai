'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/contexts/TenantContext'

const PLAN_COL: Record<string,string> = {
  trial:'#F0A84E',free:'#F0A84E',starter:'#60A5FA',pro:'#A78BFA',business:'#34D399',enterprise:'#34D399'
}
const PLAN_LBL: Record<string,string> = {
  trial:'Trial',free:'Trial',starter:'Starter',pro:'Pro',business:'Business',enterprise:'Business'
}

// Iconos SVG como paths compactos
const IC: Record<string,string> = {
  grid:    'M3 3h7v7H3zM13 3h7v7h-7zM3 13h7v7H3zM13 13h7v7h-7z',
  cal:     'M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  clock:   'M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2',
  phone:   'M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z',
  users:   'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  layout:  'M3 3h7v11H3zM13 3h7v7h-7zM13 13h7v7h-7z',
  bag:     'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',
  bar:     'M18 20V10M12 20V4M6 20v-6',
  card:    'M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2zM1 10h22',
  gear:    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  exit:    'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  chevron: 'M9 18l6-6-6-6',
}

function Icon({ id, size=16 }: { id: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={IC[id] || IC.grid}/>
    </svg>
  )
}

const DEFAULT_MODULES = [
  { id:'panel',         href:'/panel',         icon:'grid',   label:'Centro de control' },
  { id:'reservas',      href:'/reservas',       icon:'cal',    label:'Reservas' },
  { id:'agenda',        href:'/agenda',         icon:'clock',  label:'Agenda' },
  { id:'llamadas',      href:'/llamadas',       icon:'phone',  label:'Llamadas' },
  { id:'clientes',      href:'/clientes',       icon:'users',  label:'Clientes' },
  { id:'mesas',         href:'/mesas',          icon:'layout', label:'Mesas y zonas' },
  { id:'pedidos',       href:'/pedidos',        icon:'bag',    label:'Pedidos', pro:true },
  { id:'estadisticas',  href:'/estadisticas',   icon:'bar',    label:'Estadísticas', pro:true },
  { id:'facturacion',   href:'/facturacion',    icon:'card',   label:'Facturación' },
  { id:'configuracion', href:'/configuracion',  icon:'gear',   label:'Configuración' },
]

export default function Sidebar() {
  const path   = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const { tenant, template } = useTenant()

  const plan      = tenant?.plan || 'trial'
  const isTrial   = plan === 'trial' || plan === 'free'
  const used      = isTrial ? (tenant?.free_calls_used||0) : (tenant?.plan_calls_used||0)
  const included  = isTrial ? (tenant?.free_calls_limit||10) : (tenant?.plan_calls_included||50)
  const pct       = included > 0 ? Math.min(100, Math.round((used/included)*100)) : 0
  const planColor = PLAN_COL[plan] || '#F0A84E'
  const planLabel = PLAN_LBL[plan] || 'Trial'
  const agentOn   = !!(tenant?.agent_phone)
  const agentName = tenant?.agent_name || 'Sofía'
  const modules   = template?.modules || DEFAULT_MODULES
  const W = collapsed ? 60 : 224

  return (
    <nav style={{
      width: W, minWidth: W, maxWidth: W,
      height: '100vh', position: 'sticky', top: 0,
      background: 'var(--rz-surface)', flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--rz-border)',
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden', zIndex: 40,
    }}>
      <style>{`
        .rz-nav-item { display:flex; align-items:center; gap:10px; padding:9px 12px; margin:1px 8px; border-radius:var(--rz-r-md); text-decoration:none; color:var(--rz-text-2); transition:all 0.15s ease; position:relative; }
        .rz-nav-item:hover { background:rgba(255,255,255,0.04); color:var(--rz-text); }
        .rz-nav-item.active { background:var(--rz-amber-dim); color:var(--rz-amber); }
        .rz-nav-item.active .rz-nav-indicator { opacity:1; }
        .rz-nav-indicator { position:absolute; left:-8px; top:50%; transform:translateY(-50%); width:3px; height:18px; background:var(--rz-amber); border-radius:0 3px 3px 0; opacity:0; transition:opacity 0.15s; }
        .rz-nav-label { font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; }
        .rz-nav-item.active .rz-nav-label { font-weight:600; }
        .rz-collapse-btn { background:none; border:1px solid var(--rz-border); color:var(--rz-text-3); cursor:pointer; border-radius:var(--rz-r-sm); padding:5px; display:flex; align-items:center; justify-content:center; }
        .rz-collapse-btn:hover { border-color:var(--rz-border-md); color:var(--rz-text-2); background:rgba(255,255,255,0.04); }
      `}</style>

      {/* ── Header: Logo + collapse ── */}
      <div style={{ padding: collapsed ? '14px 10px' : '14px 16px', display:'flex', alignItems:'center', justifyContent: collapsed ? 'center' : 'space-between', borderBottom:'1px solid var(--rz-border)', flexShrink:0 }}>
        {!collapsed && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* Logo mark */}
            <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg, var(--rz-amber) 0%, var(--rz-amber-2) 100%)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 2px 8px var(--rz-amber-glow)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#0C1018"><path d="M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/></svg>
            </div>
            <span style={{ fontFamily:'var(--rz-font)', fontWeight:700, fontSize:15, color:'var(--rz-text)', letterSpacing:'-0.02em' }}>Reservo<span style={{ color:'var(--rz-amber)' }}>.AI</span></span>
          </div>
        )}
        {collapsed && (
          <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg, var(--rz-amber) 0%, var(--rz-amber-2) 100%)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px var(--rz-amber-glow)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#0C1018"><path d="M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/></svg>
          </div>
        )}
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} className="rz-collapse-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        )}
      </div>

      {/* ── Agent status pill ── */}
      {!collapsed && (
        <div style={{ padding:'8px 16px', borderBottom:'1px solid var(--rz-border)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 10px', background: agentOn ? 'var(--rz-teal-dim)' : 'var(--rz-red-dim)', borderRadius:'var(--rz-r-sm)', border:`1px solid ${agentOn ? 'rgba(45,212,191,0.15)' : 'rgba(248,113,113,0.15)'}` }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background: agentOn ? 'var(--rz-teal)' : 'var(--rz-red)', flexShrink:0, animation: agentOn ? 'rz-pulse 2s ease-in-out infinite' : 'none' }}/>
            <span style={{ fontSize:11, fontWeight:600, color: agentOn ? 'var(--rz-teal)' : 'var(--rz-red)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {agentOn ? agentName + ' — en línea' : 'Sin número configurado'}
            </span>
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
        {collapsed && (
          <div style={{ display:'flex', justifyContent:'center', padding:'8px 0 4px' }}>
            <button onClick={() => setCollapsed(false)} className="rz-collapse-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        )}
        {modules.map(item => {
          if (item.hidden) return null
          const active  = path === item.href || (item.href !== '/panel' && path.startsWith(item.href))
          const locked  = !!(item.pro && isTrial)
          const href    = locked ? '/precios' : item.href
          return (
            <Link key={item.href} href={href}
              title={collapsed ? item.label : undefined}
              className={`rz-nav-item${active ? ' active' : ''}`}
              style={collapsed ? { justifyContent:'center', padding:'10px 0', margin:'1px 8px' } : {}}>
              <div className="rz-nav-indicator"/>
              <span style={{ flexShrink:0, opacity: active ? 1 : 0.65 }}>
                <Icon id={item.icon} size={16}/>
              </span>
              {!collapsed && (
                <>
                  <span className="rz-nav-label">{item.label}</span>
                  {item.pro && (
                    <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:5, background:'var(--rz-violet-dim)', color:'var(--rz-violet)', flexShrink:0, letterSpacing:'0.04em' }}>PRO</span>
                  )}
                </>
              )}
            </Link>
          )
        })}
      </div>

      {/* ── Billing mini bar ── */}
      {!collapsed && tenant && (
        <div style={{ padding:'12px 16px', borderTop:'1px solid var(--rz-border)', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background: planColor+'18', color: planColor, letterSpacing:'0.04em', textTransform:'uppercase' }}>{planLabel}</span>
            <span style={{ fontFamily:'var(--rz-mono)', fontSize:11, color:'var(--rz-text-3)' }}>{used}<span style={{ color:'var(--rz-text-3)' }}>/{included}</span></span>
          </div>
          <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden', marginBottom:6 }}>
            <div style={{ height:'100%', width:pct+'%', background: pct>=100 ? 'var(--rz-red)' : pct>=80 ? 'var(--rz-yellow)' : planColor, borderRadius:2, transition:'width 0.6s ease', transformOrigin:'left' }}/>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:10, color:'var(--rz-text-3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Llamadas del ciclo</span>
            {isTrial && <Link href="/precios" style={{ fontSize:10, color:'var(--rz-amber)', fontWeight:700, textDecoration:'none', letterSpacing:'-0.01em' }}>Activar →</Link>}
          </div>
        </div>
      )}

      {/* ── Sign out ── */}
      <div style={{ padding:'8px', borderTop:'1px solid var(--rz-border)', flexShrink:0 }}>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent: collapsed ? 'center' : 'flex-start', gap:10, padding: collapsed ? '10px 0' : '9px 12px', borderRadius:'var(--rz-r-md)', background:'none', border:'none', cursor:'pointer', color:'var(--rz-text-3)', transition:'all 0.15s' }}
          onMouseEnter={e=>{ e.currentTarget.style.background='rgba(248,113,113,0.07)'; e.currentTarget.style.color='var(--rz-red)' }}
          onMouseLeave={e=>{ e.currentTarget.style.background='none'; e.currentTarget.style.color='var(--rz-text-3)' }}>
          <Icon id="exit" size={16}/>
          {!collapsed && <span style={{ fontSize:13, fontWeight:500 }}>Cerrar sesión</span>}
        </button>
      </div>
    </nav>
  )
}
export { Sidebar }
