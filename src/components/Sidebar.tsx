'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BUSINESS_TEMPLATES } from '@/types'
import type { Tenant } from '@/types'
import {
  LayoutDashboard, Calendar, CalendarDays, Grid3X3, ShoppingBag,
  Users, Phone, Settings, CreditCard, LogOut, ChevronLeft,
  ChevronRight, Bell, Star, Zap, Bot
} from 'lucide-react'

const NAV_ITEMS: Record<string, { icon: any; label: string; href: string }> = {
  resumen:        { icon: LayoutDashboard, label: 'Inicio',        href: '/panel' },
  reservas:       { icon: Calendar,        label: 'Reservas',      href: '/reservas' },
  citas:          { icon: Calendar,        label: 'Citas',         href: '/reservas' },
  mesas:          { icon: Grid3X3,         label: 'Mesas',         href: '/mesas' },
  pedidos:        { icon: ShoppingBag,     label: 'Pedidos',       href: '/pedidos' },
  agenda:         { icon: CalendarDays,    label: 'Agenda',        href: '/agenda' },
  clientes:       { icon: Users,           label: 'Clientes',      href: '/clientes' },
  conversaciones: { icon: Phone,           label: 'Llamadas',      href: '/llamadas' },
  seguimientos:   { icon: Bell,            label: 'Seguimientos',  href: '/llamadas' },
  oportunidades:  { icon: Star,            label: 'Oportunidades', href: '/clientes' },
}

const PLAN_COLORS: Record<string, string> = {
  trial: 'text-amber-400',
  starter: 'text-sky-400',
  pro: 'text-indigo-400',
  business: 'text-violet-400',
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
  const modules = template.modules.map((m: string) => NAV_ITEMS[m]).filter(Boolean)
  const isTrial = !tenant?.plan || tenant?.plan === 'trial' || tenant?.plan === 'free'
  const callsLeft = Math.max(0, (tenant?.free_calls_limit || 10) - (tenant?.free_calls_used || 0))
  const planLabel = tenant?.plan === 'business' ? 'Business' : tenant?.plan === 'pro' ? 'Pro' : tenant?.plan === 'starter' ? 'Starter' : 'Trial'

  return (
    <aside style={{ width: collapsed ? '64px' : '240px', background: '#0f172a', transition: 'width 0.2s ease' }}
      className="flex-shrink-0 flex flex-col h-screen sticky top-0 z-10">
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-white/5">
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <span className="font-semibold text-white text-sm tracking-tight">Reservo.AI</span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center mx-auto">
            <Bot size={14} className="text-white" />
          </div>
        )}
        {!collapsed && (
          <button onClick={() => setCollapsed(true)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Business info */}
      {!collapsed && tenant && (
        <div className="px-3 py-3 border-b border-white/5">
          <p className="text-xs font-medium text-slate-400 truncate mb-0.5">{tenant.name}</p>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-medium ${PLAN_COLORS[tenant.plan] || PLAN_COLORS.trial}`}>
              {planLabel}
            </span>
            {isTrial && (
              <>
                <span className="text-slate-600">·</span>
                <a href="/precios" className={`text-xs ${callsLeft <= 2 ? 'text-red-400' : 'text-slate-400'} hover:text-white transition-colors`}>
                  {callsLeft}/10 llamadas
                </a>
              </>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {modules.map((mod: any) => {
          const Icon = mod.icon
          const isActive = pathname === mod.href || (mod.href !== '/panel' && pathname?.startsWith(mod.href))
          return (
            <a key={mod.href + mod.label} href={mod.href}
              style={{
                background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                borderLeft: isActive ? '2px solid #6366f1' : '2px solid transparent',
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group ${
                isActive ? 'text-indigo-300' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}>
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span>{mod.label}</span>}
            </a>
          )
        })}

        <div className="my-1 border-t border-white/5" />

        {[
          { href: '/configuracion', icon: Settings, label: 'Configuración' },
          { href: '/precios', icon: CreditCard, label: 'Planes' },
        ].map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <a key={item.href} href={item.href}
              style={{ background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent', borderLeft: isActive ? '2px solid #6366f1' : '2px solid transparent' }}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'text-indigo-300' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}>
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </a>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-3 border-t border-white/5 pt-2">
        {collapsed && (
          <button onClick={() => setCollapsed(false)}
            className="w-full flex items-center justify-center py-2 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors mb-1">
            <ChevronRight size={14} />
          </button>
        )}
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all w-full">
          <LogOut size={16} className="flex-shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}