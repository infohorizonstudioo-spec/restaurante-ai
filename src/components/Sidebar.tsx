'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const NAV = [
  { href: '/dashboard', icon: '⚡', label: 'Centro de Mando', badge: null },
  { href: '/pedidos',   icon: '🧾', label: 'Pedidos',         badge: 'pedidos' },
  { href: '/reservas',  icon: '📅', label: 'Reservas',        badge: 'reservas' },
  { href: '/llamadas',  icon: '📞', label: 'Llamadas',        badge: 'llamadas' },
  { href: '/mesas',     icon: '🪑', label: 'Mesas',           badge: null },
  { href: '/entregas',  icon: '🛵', label: 'Entregas',        badge: 'entregas' },
  { href: '/clientes',  icon: '👥', label: 'Clientes',        badge: null },
  { href: '/agenda',    icon: '🗓️', label: 'Agenda',          badge: null },
  { href: '/alertas',   icon: '🔔', label: 'Alertas',         badge: 'alertas' },
]

export function Sidebar({ counts }: { counts: Record<string, number> }) {
  const path = usePathname()
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t)
  }, [])

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-[#0f0f12] border-r border-white/5 flex flex-col z-50">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-sm font-black shadow-lg shadow-violet-500/20">R</div>
          <div>
            <div className="font-black text-sm tracking-tight">RESERVO<span className="text-violet-400">.AI</span></div>
            <div className="text-[10px] text-white/25">La Bahía · En vivo</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
          <span className="text-[10px] font-mono text-white/30">{time}</span>
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 gap-1 p-2 border-b border-white/5">
        {[
          { label: 'Pedidos', val: counts.pedidos || 0, color: 'text-orange-400' },
          { label: 'Reservas', val: counts.reservas || 0, color: 'text-blue-400' },
          { label: 'Llamadas', val: counts.llamadas || 0, color: 'text-violet-400' },
          { label: 'Alertas', val: counts.alertas || 0, color: 'text-red-400' },
        ].map(k => (
          <div key={k.label} className="bg-white/[0.03] rounded-lg px-2 py-1.5 text-center">
            <div className={`text-lg font-black ${k.color}`}>{k.val}</div>
            <div className="text-[9px] text-white/30 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {NAV.map(item => {
          const active = path === item.href || (item.href !== '/dashboard' && path.startsWith(item.href))
          const count = item.badge ? (counts[item.badge] || 0) : 0
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group
                ${active ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20' : 'text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent'}`}>
              <span className="text-base">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center
                  ${active ? 'bg-violet-400 text-violet-900' : 'bg-white/10 text-white/60'}`}>
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-white/5 space-y-1">
        <Link href="/ajustes" className="flex items-center gap-2 px-3 py-2 text-xs text-white/30 hover:text-white/60 hover:bg-white/5 rounded-lg transition-all">
          <span>⚙️</span> Ajustes
        </Link>
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-[10px] font-bold">A</div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-white/60 truncate">Admin</div>
            <div className="text-[9px] text-white/25">Encargado</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
