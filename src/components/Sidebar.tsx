'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { BUSINESS_TEMPLATES } from '@/types'
import type { Tenant } from '@/types'

const ALL_MODULES: Record<string, { icon: string; label: string; href: string }> = {
  resumen: { icon: '🏠', label: 'Inicio', href: '/panel' },
  reservas: { icon: '📅', label: 'Reservas', href: '/panel/reservas' },
  citas: { icon: '📅', label: 'Citas', href: '/panel/reservas' },
  mesas: { icon: '🪑', label: 'Mesas', href: '/panel/mesas' },
  pedidos: { icon: '📦', label: 'Pedidos', href: '/panel/pedidos' },
  agenda: { icon: '🗓️', label: 'Agenda', href: '/panel/agenda' },
  clientes: { icon: '👥', label: 'Clientes', href: '/panel/clientes' },
  conversaciones: { icon: '💬', label: 'Llamadas', href: '/panel/llamadas' },
  seguimientos: { icon: '🔔', label: 'Seguimientos', href: '/panel/llamadas' },
  oportunidades: { icon: '⭐', label: 'Oportunidades', href: '/panel/clientes' },
}

export default function Sidebar() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
        if (!profile?.tenant_id) return
        const { data: t } = await supabase.from('tenants').select('*').eq('id', profile.tenant_id).single()
        setTenant(t)
      } catch(e) {}
    }
    load()
  }, [])

  const template = BUSINESS_TEMPLATES[tenant?.type || 'otro'] || BUSINESS_TEMPLATES.otro
  const modules = template.modules.map((m: string) => ALL_MODULES[m]).filter(Boolean)

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 transition-all duration-200 z-10`}>
      <div className="flex items-center justify-between px-4 py-5 border-b border-gray-100">
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-indigo-600 text-lg">Reservo.AI</p>
            {tenant && <p className="text-xs text-gray-500 truncate">{tenant.name}</p>}
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="text-gray-400 hover:text-gray-600 p-1 ml-auto shrink-0">
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {!collapsed && tenant && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <span>{template.icon}</span>
            <span className="text-xs font-medium text-gray-600 truncate">{template.label}</span>
          </div>
          {tenant.plan === 'trial' && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">
              <p className="text-xs text-amber-700">
                <span className="font-bold">{Math.max(0, (tenant.free_calls_limit || 10) - (tenant.free_calls_used || 0))}</span> llamadas gratis
              </p>
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {modules.map((mod: any) => {
          const isActive = pathname === mod.href || (mod.href !== '/panel' && pathname?.startsWith(mod.href))
          return (
            <a key={mod.href + mod.label} href={mod.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
              <span className="text-lg shrink-0">{mod.icon}</span>
              {!collapsed && <span>{mod.label}</span>}
            </a>
          )
        })}
        <div className="border-t border-gray-100 my-2"/>
        <a href="/configuracion" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${pathname === '/configuracion' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
          <span className="text-lg shrink-0">⚙️</span>
          {!collapsed && <span>Configuración</span>}
        </a>
        <a href="/precios" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${pathname === '/precios' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
          <span className="text-lg shrink-0">💳</span>
          {!collapsed && <span>Planes</span>}
        </a>
      </nav>

      <div className="border-t border-gray-100 p-3">
        <button onClick={signOut} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-all w-full">
          <span className="text-lg">🚪</span>
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}