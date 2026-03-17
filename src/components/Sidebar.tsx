'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BUSINESS_TEMPLATES } from '@/types'
import type { Tenant } from '@/types'

const MODS: Record<string, { icon: string; label: string; href: string }> = {
  resumen:         { icon: '🏠', label: 'Inicio',       href: '/panel' },
  reservas:        { icon: '📅', label: 'Reservas',     href: '/reservas' },
  citas:           { icon: '📅', label: 'Citas',        href: '/reservas' },
  mesas:           { icon: '🪑', label: 'Mesas',        href: '/mesas' },
  pedidos:         { icon: '📦', label: 'Pedidos',      href: '/pedidos' },
  agenda:          { icon: '🗓️', label: 'Agenda',       href: '/agenda' },
  clientes:        { icon: '👥', label: 'Clientes',     href: '/clientes' },
  conversaciones:  { icon: '💬', label: 'Llamadas',     href: '/llamadas' },
  seguimientos:    { icon: '🔔', label: 'Seguimientos', href: '/llamadas' },
  oportunidades:   { icon: '⭐', label: 'Oportunidades',href: '/clientes' },
}

export default function Sidebar() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
        if (!(p as any)?.tenant_id) return
        const { data: t } = await supabase.from('tenants').select('*').eq('id', (p as any).tenant_id).single()
        setTenant(t)
      } catch(e) {}
    }
    load()
  }, [])

  const template = BUSINESS_TEMPLATES[tenant?.type || 'otro'] || BUSINESS_TEMPLATES.otro
  const modules = template.modules.map((m: string) => MODS[m]).filter(Boolean)
  const callsLeft = Math.max(0, (tenant?.free_calls_limit || 10) - (tenant?.free_calls_used || 0))
  const isTrial = !tenant?.plan || tenant?.plan === 'trial' || tenant?.plan === 'free'

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 z-10 transition-all duration-200`}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-gray-100">
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-indigo-600 text-lg leading-tight">Reservo.AI</p>
            {tenant && <p className="text-xs text-gray-500 truncate">{tenant.name}</p>}
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="text-gray-400 hover:text-gray-600 p-1 ml-auto shrink-0">
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Tipo + Trial */}
      {!collapsed && tenant && (
        <div className="px-4 py-3 border-b border-gray-100 space-y-2">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <span>{template.icon}</span>
            <span className="text-xs font-medium text-gray-600 truncate">{template.label}</span>
          </div>
          {isTrial && (
            <a href="/precios" className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${callsLeft <= 2 ? 'bg-red-50 border border-red-200 text-red-700' : callsLeft <= 5 ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-indigo-50 border border-indigo-100 text-indigo-700'}`}>
              <span>Llamadas gratis</span>
              <span className="font-bold">{callsLeft}/10</span>
            </a>
          )}
          {!isTrial && (
            <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-3 py-2">
              <span className="text-xs text-green-700 font-medium capitalize">Plan {tenant.plan}</span>
              <span className="text-xs text-green-600">{tenant.plan_calls_used || 0}/{tenant.plan_calls_included || 50}</span>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {modules.map((mod: any) => {
          const isActive = pathname === mod.href || (mod.href !== '/panel' && pathname?.startsWith(mod.href))
          return (
            <a key={mod.href + mod.label} href={mod.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
              <span className="text-xl shrink-0">{mod.icon}</span>
              {!collapsed && <span>{mod.label}</span>}
            </a>
          )
        })}
        
        <div className="border-t border-gray-100 my-2 pt-1">
          <a href="/configuracion" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${pathname === '/configuracion' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <span className="text-xl shrink-0">⚙️</span>
            {!collapsed && <span>Configuración</span>}
          </a>
          <a href="/precios" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${pathname === '/precios' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <span className="text-xl shrink-0">💳</span>
            {!collapsed && <span>Planes</span>}
          </a>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 p-3">
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all w-full">
          <span className="text-xl">🚪</span>
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}