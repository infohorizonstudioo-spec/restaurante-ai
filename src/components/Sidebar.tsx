'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type NavItem = { href: string; icon: string; label: string; pro?: boolean }
const NAV: NavItem[] = [
  { href:'/panel',        icon:'grid',     label:'Centro de control' },
  { href:'/reservas',     icon:'cal',      label:'Reservas' },
  { href:'/agenda',       icon:'clock',    label:'Agenda' },
  { href:'/llamadas',     icon:'phone',    label:'Llamadas' },
  { href:'/clientes',     icon:'users',    label:'Clientes' },
  { href:'/mesas',        icon:'layout',   label:'Local y mesas' },
  { href:'/pedidos',      icon:'bag',      label:'Pedidos',      pro:true },
  { href:'/estadisticas', icon:'bar',      label:'Estadisticas', pro:true },
  { href:'/facturacion',  icon:'card',     label:'Facturacion' },
  { href:'/configuracion',icon:'gear',     label:'Configuracion' },
]
const PLAN_COL: Record<string,string> = {
  trial:'#d97706',free:'#d97706',starter:'#1d4ed8',pro:'#7c3aed',business:'#059669',enterprise:'#059669'
}
const PLAN_LBL: Record<string,string> = {
  trial:'Trial',free:'Trial',starter:'Starter',pro:'Pro',business:'Business',enterprise:'Business'
}
function SvgIcon({ d }: { d: string }) {
  return (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d={d}/>
    </svg>
  )
}
const ICONS: Record<string,string> = {
  grid:   'M3 3h7v7H3zM13 3h7v7h-7zM3 13h7v7H3zM13 13h7v7h-7z',
  cal:    'M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  clock:  'M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2',
  phone:  'M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z',
  users:  'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  layout: 'M3 3h7v11H3zM13 3h7v7h-7zM13 13h7v7h-7z',
  bag:    'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',
  bar:    'M18 20V10M12 20V4M6 20v-6',
  card:   'M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2zM1 10h22',
  gear:   'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
}
function Sidebar() {
  const path = usePathname()
  const router = useRouter()
  const [billing, setBilling] = useState<Record<string,any> | null>(null)
  const [agentActive, setAgentActive] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
      if (!p?.tenant_id) return
      const { data: b } = await supabase.rpc('get_billing_summary', { p_tenant_id: p.tenant_id })
      setBilling(b as Record<string,any> | null)
      const { data: t } = await supabase.from('tenants').select('agent_phone').eq('id', p.tenant_id).single()
      setAgentActive(!!(t as any)?.agent_phone)
    })()
  }, [])
  const plan: string = billing?.plan || 'trial'
  const isTrial: boolean = billing?.is_trial ?? true
  const used: number = billing?.used_calls || 0
  const included: number = billing?.included_calls || 10
  const pct: number = included > 0 ? Math.min(100, Math.round((used / included) * 100)) : 0
  const extra: number = billing?.extra_calls || 0
  const planColor: string = PLAN_COL[plan] || '#d97706'
  const planLabel: string = PLAN_LBL[plan] || 'Trial'
  return (
    <nav style={{ width: collapsed ? 56 : 220, minWidth: collapsed ? 56 : 220, background: '#0f172a', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, transition: 'width 0.2s', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: collapsed ? '14px 10px' : '14px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {!collapsed && <span style={{ fontSize: 16, fontWeight: 800, color: 'white' }}>Reservo.AI</span>}
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, borderRadius: 6, marginLeft: collapsed ? 'auto' : 0 }}>
          <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d={collapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'}/></svg>
        </button>
      </div>
      {!collapsed && (
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: agentActive ? '#4ade80' : '#ef4444' }} />
            <span style={{ fontSize: 11, color: agentActive ? '#4ade80' : '#ef4444', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {agentActive ? 'Sofia activa' : 'Sin numero configurado'}
            </span>
          </div>
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {NAV.map(item => {
          const active = path === item.href || (item.href !== '/panel' && path.startsWith(item.href))
          const locked = !!(item.pro && isTrial)
          return (
            <Link key={item.href} href={locked ? '/precios' : item.href}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px 18px' : '9px 14px', margin: '1px 6px', borderRadius: 8, textDecoration: 'none', background: active ? '#1e293b' : 'transparent', color: active ? 'white' : '#94a3b8', transition: 'all 0.1s' }}>
              <span style={{ color: active ? 'white' : '#64748b', flexShrink: 0 }}><SvgIcon d={ICONS[item.icon] || ICONS.grid} /></span>
              {!collapsed && (
                <>
                  <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                  {item.pro && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: '#7c3aed22', color: '#a78bfa', flexShrink: 0 }}>PRO</span>}
                </>
              )}
            </Link>
          )
        })}
      </div>
      {!collapsed && billing && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 8, background: planColor + '22', color: planColor }}>{planLabel}</span>
            <span style={{ fontSize: 10, color: '#64748b' }}>{used}/{included}</span>
          </div>
          <div style={{ height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', width: pct + '%', background: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : planColor, borderRadius: 2 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#475569' }}>LLAMADAS</span>
            {extra > 0 && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>+{extra} extra</span>}
            {isTrial && <Link href='/precios' style={{ fontSize: 10, color: '#60a5fa', fontWeight: 600, textDecoration: 'none' }}>Activar</Link>}
          </div>
        </div>
      )}
      <div style={{ padding: '8px 6px', borderTop: '1px solid #1e293b' }}>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '8px 14px' : '8px 10px', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
          <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9'/></svg>
          {!collapsed && <span style={{ fontSize: 13 }}>Cerrar sesion</span>}
        </button>
      </div>
    </nav>
  )
}
export default Sidebar
export { Sidebar }