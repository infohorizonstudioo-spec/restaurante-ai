'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function NotificationBell() {
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    loadNotifications()
    const ch = supabase.channel('notifications-bell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => loadNotifications())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function loadNotifications() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', session.user.id).single()
    if (!tenant) return
    const { data } = await supabase.from('notifications').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(10)
    if (data) {
      setNotifications(data)
      setCount(data.filter((n: any) => !n.read).length)
    }
  }

  async function markAllRead() {
    const unread = notifications.filter(n => !n.read).map(n => n.id)
    if (unread.length === 0) return
    await supabase.from('notifications').update({ read: true }).in('id', unread)
    setCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const S = {
    bell: { position: 'relative' as const, cursor: 'pointer', padding: '8px', borderRadius: '8px', background: 'transparent', border: 'none', color: '#8895A7', fontSize: '18px' },
    badge: { position: 'absolute' as const, top: '2px', right: '2px', background: '#F0A84E', color: '#0C1018', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    dropdown: { position: 'absolute' as const, top: '40px', right: 0, width: '320px', background: '#131920', border: '1px solid #1A2230', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 100, overflow: 'hidden' },
    header: { padding: '12px 16px', borderBottom: '1px solid #1A2230', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    item: { padding: '10px 16px', borderBottom: '1px solid rgba(26,34,48,0.5)', fontSize: '13px', color: '#8895A7' },
    empty: { padding: '24px', textAlign: 'center' as const, color: '#49566A', fontSize: '13px' }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button style={S.bell} onClick={() => { setOpen(!open); if (!open) markAllRead() }}>
        🔔
        {count > 0 && <span style={S.badge}>{count}</span>}
      </button>
      {open && (
        <div style={S.dropdown}>
          <div style={S.header}>
            <span style={{ color: '#E8EEF6', fontWeight: 600, fontSize: '14px' }}>Notificaciones</span>
            {count > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#F0A84E', fontSize: '12px', cursor: 'pointer' }}>Marcar leídas</button>}
          </div>
          {notifications.length === 0 ? (
            <div style={S.empty}>Sin notificaciones</div>
          ) : (
            notifications.map(n => (
              <div key={n.id} style={{ ...S.item, background: n.read ? 'transparent' : 'rgba(240,168,78,0.05)' }}>
                <div style={{ color: n.read ? '#49566A' : '#E8EEF6', fontWeight: n.read ? 400 : 500 }}>{n.message || n.title || 'Notificación'}</div>
                <div style={{ fontSize: '11px', color: '#49566A', marginTop: '4px' }}>{new Date(n.created_at).toLocaleString('es-ES')}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
