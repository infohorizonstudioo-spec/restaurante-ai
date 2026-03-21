'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from './NotificationToast'
import { useRouter } from 'next/navigation'

const C = {
  amber:'#F0A84E', amberDim:'rgba(240,168,78,0.10)', amberBorder:'rgba(240,168,78,0.25)',
  teal:'#2DD4BF', tealDim:'rgba(45,212,191,0.10)',
  red:'#F87171', redDim:'rgba(248,113,113,0.12)',
  yellow:'#FBB53F', yellowDim:'rgba(251,181,63,0.10)',
  green:'#4ADE80',
  text:'#E8EEF6', text2:'#8895A7', text3:'#49566A',
  surface:'#131920', surface2:'#1A2230', surface3:'#202C3E',
  border:'rgba(255,255,255,0.07)',
}

const TYPE_CFG: Record<string,{icon:string;color:string;bg:string}> = {
  new_call:                    { icon:'📞', color:C.teal,   bg:C.tealDim   },
  call_active:                 { icon:'🔴', color:C.red,    bg:C.redDim    },
  call_finished:               { icon:'📞', color:C.green,  bg:'rgba(74,222,128,0.10)' },
  missed_call:                 { icon:'📵', color:C.red,    bg:C.redDim    },
  new_reservation:             { icon:'📅', color:C.teal,   bg:C.tealDim   },
  reservation_pending_review:  { icon:'⏳', color:C.yellow, bg:C.yellowDim },
  new_order:                   { icon:'🛍️', color:C.amber,  bg:C.amberDim  },
  important_alert:             { icon:'⚠️', color:C.yellow, bg:C.yellowDim },
  incident:                    { icon:'🚨', color:C.red,    bg:C.redDim    },
  pending_review:              { icon:'🔍', color:C.amber,  bg:C.amberDim  },
  // legacy
  call_completed:              { icon:'📞', color:C.green,  bg:'rgba(74,222,128,0.10)' },
  call_pending:                { icon:'⏳', color:C.yellow, bg:C.yellowDim },
  call_attention:              { icon:'⚠️', color:C.amber,  bg:C.amberDim  },
  call_missed:                 { icon:'📵', color:C.red,    bg:C.redDim    },
  reservation_created:         { icon:'✅', color:C.teal,   bg:C.tealDim   },
  default:                     { icon:'🔔', color:C.text2,  bg:C.surface3  },
}

const PRIORITY_BORDER: Record<string,string> = {
  critical: C.red,
  warning:  C.yellow,
  info:     'transparent',
}

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60)   return 'ahora mismo'
  if (s < 3600) return Math.floor(s/60) + 'm'
  if (s < 86400)return Math.floor(s/3600) + 'h'
  return Math.floor(s/86400) + 'd'
}

export default function NotificationBell({ tenantId }: { tenantId: string }) {
  const [notifs, setNotifs]   = useState<any[]>([])
  const [open, setOpen]       = useState(false)
  const [shake, setShake]     = useState(false)
  const [filter, setFilter]   = useState<'all'|'unread'|'critical'>('all')
  const panelRef              = useRef<HTMLDivElement>(null)
  const { push: pushToast }   = useToast()
  const router                = useRouter()

  const unread   = notifs.filter(n => !n.read).length
  const critical = notifs.filter(n => n.priority === 'critical' && !n.read).length

  const filtered = notifs.filter(n => {
    if (filter === 'unread')   return !n.read
    if (filter === 'critical') return n.priority === 'critical'
    return true
  })

  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications')
      .select('*').eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }).limit(50)
    setNotifs(data || [])
  }, [tenantId])

  const markRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id).eq('tenant_id', tenantId)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [tenantId])

  const markAllRead = useCallback(async () => {
    if (!unread) return
    await supabase.from('notifications').update({ read: true })
      .eq('tenant_id', tenantId).eq('read', false)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }, [tenantId, unread])

  const deleteNotif = useCallback(async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id).eq('tenant_id', tenantId)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }, [tenantId])

  // Tiempo real + toast para cada nueva notificación
  useEffect(() => {
    if (!tenantId) return
    load()
    const ch = supabase.channel('notifs-' + tenantId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: 'tenant_id=eq.' + tenantId
      }, payload => {
        const n = payload.new as any
        setNotifs(prev => [n, ...prev].slice(0, 50))
        setShake(true); setTimeout(() => setShake(false), 800)
        // Toast global
        const cfg = TYPE_CFG[n.type] || TYPE_CFG.default
        pushToast({ title: n.title, body: n.body, type: n.type, priority: n.priority || 'info', icon: cfg.icon })
        // Push notification si está permitido
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(n.title, { body: n.body || '', icon: '/icon-192.png', tag: n.id, requireInteraction: n.priority === 'critical' })
          } catch {}
        }
        // Sonido
        try { new Audio('/notification.mp3').play().catch(()=>{}) } catch {}
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tenantId, load, pushToast])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={panelRef} style={{ position:'relative' }}>
      {/* CAMPANITA */}
      <button onClick={() => { setOpen(o => !o); if (!open) markAllRead() }} style={{
        width:38, height:38, borderRadius:10,
        background: open ? C.amberDim : critical > 0 ? C.redDim : 'rgba(255,255,255,0.04)',
        border: `1px solid ${open ? C.amberBorder : critical > 0 ? C.red + '50' : C.border}`,
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
        position:'relative', transition:'all 0.15s',
        animation: shake ? 'bell-shake 0.4s ease' : 'none',
      }}>
        <style>{`
          @keyframes bell-shake{0%,100%{transform:rotate(0)}20%{transform:rotate(-15deg)}40%{transform:rotate(15deg)}60%{transform:rotate(-10deg)}80%{transform:rotate(10deg)}}
        `}</style>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={critical>0 ? C.red : unread>0 ? C.amber : C.text2}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {unread > 0 && (
          <div style={{
            position:'absolute', top:3, right:3, minWidth:16, height:16,
            borderRadius:8, background: critical > 0 ? C.red : C.amber,
            border:`2px solid #0C1018`, display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:9, fontWeight:800, color:'white', padding:'0 3px',
          }}>
            {unread > 9 ? '9+' : unread}
          </div>
        )}
      </button>

      {/* PANEL */}
      {open && (
        <div style={{
          position:'absolute', top:46, right:0, width:360,
          background:'#0F1520', border:`1px solid ${C.border}`,
          borderRadius:16, boxShadow:'0 24px 64px rgba(0,0,0,0.6)',
          zIndex:1000, overflow:'hidden', animation:'ntFadeUp 0.15s ease',
        }}>
          <style>{`@keyframes ntFadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

          {/* Header */}
          <div style={{ padding:'14px 16px 10px', borderBottom:`1px solid ${C.border}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <p style={{ fontSize:14, fontWeight:700, color:C.text }}>
                Avisos {unread > 0 && <span style={{ fontSize:11, color:C.amber, fontWeight:600 }}>· {unread} nuevos</span>}
              </p>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ fontSize:11, color:C.text3, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                  Marcar todos leídos
                </button>
              )}
            </div>
            {/* Filtros */}
            <div style={{ display:'flex', gap:6 }}>
              {([['all','Todos'],['unread','Sin leer'],['critical','Críticos']] as const).map(([k,l]) => (
                <button key={k} onClick={() => setFilter(k)} style={{
                  padding:'4px 10px', fontSize:11, fontWeight:600, borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit',
                  background: filter===k ? (k==='critical'?C.redDim:C.amberDim) : 'rgba(255,255,255,0.04)',
                  color: filter===k ? (k==='critical'?C.red:C.amber) : C.text3,
                  transition:'all 0.15s',
                }}>{l}</button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div style={{ maxHeight:420, overflowY:'auto', scrollbarWidth:'thin' }}>
            {filtered.length === 0 ? (
              <div style={{ padding:'36px 24px', textAlign:'center' }}>
                <div style={{ fontSize:28, marginBottom:8 }}>🔔</div>
                <p style={{ fontSize:13, color:C.text3 }}>Sin avisos{filter !== 'all' ? ' en esta categoría':''}</p>
              </div>
            ) : filtered.map((n, i) => {
              const cfg = TYPE_CFG[n.type] || TYPE_CFG.default
              const pb  = PRIORITY_BORDER[n.priority || 'info']
              return (
                <div key={n.id} onClick={() => {
                  markRead(n.id)
                  const url = n.target_url
                  if (url) { setOpen(false); router.push(url) }
                }} style={{
                  display:'flex', gap:10, padding:'12px 16px',
                  borderBottom: i < filtered.length-1 ? `1px solid ${C.border}` : 'none',
                  background: !n.read ? (n.priority==='critical'?'rgba(248,113,113,0.04)':n.priority==='warning'?'rgba(251,181,63,0.03)':'rgba(240,168,78,0.02)') : 'transparent',
                  cursor:'pointer', transition:'background 0.15s',
                  borderLeft: pb !== 'transparent' ? `3px solid ${pb}` : '3px solid transparent',
                }}>
                  <div style={{ width:34, height:34, borderRadius:9, flexShrink:0, background:cfg.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                    {cfg.icon}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:4 }}>
                      <p style={{ fontSize:12.5, fontWeight:!n.read?700:500, color:C.text, lineHeight:1.35 }}>{n.title}</p>
                      <span style={{ fontSize:10, color:C.text3, flexShrink:0 }}>{timeAgo(n.created_at)}</span>
                    </div>
                    {n.body && <p style={{ fontSize:11.5, color:C.text2, marginTop:2, lineHeight:1.45, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.body}</p>}
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                      {n.priority === 'critical' && <span style={{ fontSize:10, fontWeight:700, color:C.red, letterSpacing:'0.04em' }}>CRÍTICO</span>}
                      {n.priority === 'warning'  && <span style={{ fontSize:10, fontWeight:700, color:C.yellow }}>IMPORTANTE</span>}
                      {!n.read && <div style={{ width:6, height:6, borderRadius:'50%', background: n.priority==='critical'?C.red:C.amber }}/>}
                    </div>
                  </div>
                  <button onClick={e=>{e.stopPropagation();deleteNotif(n.id)}} style={{ background:'none',border:'none',color:C.text3,cursor:'pointer',fontSize:14,padding:'0 2px',alignSelf:'flex-start',flexShrink:0 }}>✕</button>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div style={{ padding:'10px 16px', borderTop:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:11, color:C.text3 }}>{notifs.length} avisos guardados</span>
              <button onClick={async()=>{ await supabase.from('notifications').delete().eq('tenant_id',tenantId); setNotifs([]) }}
                style={{ fontSize:11, color:C.text3, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                Borrar todo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
