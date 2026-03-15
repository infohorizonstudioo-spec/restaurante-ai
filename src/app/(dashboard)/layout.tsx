'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard', icon: '◈', label: 'Dashboard' },
  { href: '/llamadas',  icon: '◉', label: 'Llamadas' },
  { href: '/reservas',  icon: '□', label: 'Reservas' },
  { href: '/pedidos',   icon: '≡', label: 'Pedidos' },
  { href: '/mesas',     icon: '⊞', label: 'Mesas' },
  { href: '/agenda',    icon: '▤', label: 'Agenda' },
  { href: '/clientes',  icon: '◯', label: 'Clientes' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const active = (href: string) => path === href || path.startsWith(href + '/')

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen bg-[#070710]">
      <aside className="w-[220px] shrink-0 flex flex-col border-r border-white/[0.06] bg-white/[0.015]">
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-black shadow-lg shadow-violet-500/20">R</div>
            <div>
              <p className="text-xs font-bold text-white/90">Reservo.AI</p>
              <p className="text-[10px] text-white/30">La Bahía · Pro</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map(item => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all
                ${active(item.href)
                  ? 'bg-white/[0.08] text-white font-medium'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'}`}>
              <span className="text-base w-5 text-center opacity-70">{item.icon}</span>
              {item.label}
              {item.href === '/llamadas' && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400"/>
              )}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-5 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-violet-500/30 flex items-center justify-center text-xs font-bold text-violet-300">A</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/70 truncate">Arturo</p>
              <p className="text-[10px] text-white/30">Admin</p>
            </div>
          </div>
          <button onClick={logout}
            className="w-full text-[10px] text-white/25 hover:text-white/50 py-1.5 px-3 rounded-lg hover:bg-white/5 transition-all text-left">
            Cerrar sesión →
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}