'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const C = {
  amber:'#F0A84E', amberDim:'rgba(240,168,78,0.10)', amberBorder:'rgba(240,168,78,0.25)',
  teal:'#2DD4BF', red:'#F87171', redDim:'rgba(248,113,113,0.10)',
  yellow:'#FBB53F', green:'#4ADE80',
  text:'#E8EEF6', text2:'#8895A7', text3:'#49566A',
  bg:'#0C1018', surface:'#131920', surface2:'#1A2230', surface3:'#202C3E',
  border:'rgba(255,255,255,0.07)',
}

const TYPE_CFG: Record<string,{icon:string;color:string;bg:string}> = {
  call_completed:       { icon:'📞', color:C.green,  bg:'rgba(74,222,128,0.10)'  },
  call_pending:         { icon:'⏳', color:C.yellow, bg:'rgba(251,181,63,0.10)'  },
  call_attention:       { icon:'⚠️', color:C.amber,  bg:C.amberDim              },
  call_missed:          { icon:'📵', color:C.red,    bg:C.redDim                },
  reservation_created:  { icon:'✅', color:C.teal,   bg:'rgba(45,212,191,0.10)' },
  default:              { icon:'🔔', color:C.text2,  bg:C.surface3              },
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60)  return 'ahora mismo'
  if (s < 3600) return Math.floor(s/60) + 'm'
  if (s < 86400) return Math.floor(s/3600) + 'h'
  return Math.floor(s/86400) + 'd'
}

export default function NotificationBell({ tenantId }: { tenantId: string }) {
  const [notifs, setNotifs]   = useState<any[]>([])
  const [open, setOpen]       = useState(false)
  const [shake, setShake]     = useState(false)
  const panelRef              = useRef<HTMLDivElement>(null)

  const unread = notifs.filter(n => !n.read).length

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(30)
    setNotifs(data || [])
  }, [tenantId])

  // Marcar todas como leídas al abrir
  const markAllRead = useCallback(async () => {
    if (!unread) return
    await supabase.from('notifications')
      .update({ read: true })
      .eq('tenant_id', tenantId)
      .eq('read', false)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }, [tenantId, unread])

  // Suscripción en tiempo real
  useEffect(() => {
    if (!tenantId) return
    load()
    const ch = supabase.channel('notifs-' + tenantId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: 'tenant_id=eq.' + tenantId
      }, payload => {
        setNotifs(prev => [payload.new, ...prev].slice(0, 30))
        // Animar campanita
        setShake(true)
        setTimeout(() => setShake(false), 800)
        // Sonido sutil
        try { new Audio('/notification.mp3').play().catch(()=>{}) } catch {}
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tenantId, load])

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    setOpen(o => !o)
    if (!open) markAllRead()
  }

  return (
    <div ref={panelRef} style={{ position:'relative' }}>
      {/* CAMPANITA */}
      <button onClick={handleOpen} style={{
        width:38, height:38, borderRadius:10,
        background: open ? C.amberDim : 'rgba(255,255,255,0.04)',
        border: `1px solid ${open ? C.amberBorder : C.border}`,
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
        position:'relative', transition:'all 0.15s',
        animation: shake ? 'bell-shake 0.4s ease' : 'none',
      }}>
        <style>{`
          @keyframes bell-shake {
            0%,100%{transform:rotate(0deg)}
            20%{transform:rotate(-15deg)}
            40%{transform:rotate(15deg)}
            60%{transform:rotate(-10deg)}
            80%{transform:rotate(10deg)}
          }
        `}</style>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={unread>0?C.amber:C.text2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {unread > 0 && (
          <div style={{
            position:'absolute', top:4, right:4, minWidth:16, height:16,
            borderRadius:8, background:C.red, border:`2px solid ${C.bg}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:9, fontWeight:800, color:'white', padding:'0 3px',
          }}>
            {unread > 9 ? '9+' : unread}
          </div>
        )}
      </button>

      {/* PANEL DROPDOWN */}
      {open && (
        <div style={{
          position:'absolute', top:46, right:0, width:340,
          background:C.surface, border:`1px solid ${C.border}`,
          borderRadius:14, boxShadow:'0 20px 60px rgba(0,0,0,0.5)',
          zIndex:1000, overflow:'hidden',
          animation:'fadeUp 0.15s ease',
        }}>
          <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

          {/* Header */}
          <div style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <p style={{ fontSize:13, fontWeight:700, color:C.text }}>Avisos</p>
            {notifs.length > 0 && (
              <button onClick={async () => {
                await supabase.from('notifications').delete().eq('tenant_id', tenantId)
                setNotifs([])
              }} style={{ fontSize:11, color:C.text3, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                Borrar todo
              </button>
            )}
          </div>

          {/* Lista */}
          <div style={{ maxHeight:380, overflowY:'auto', scrollbarWidth:'none' }}>
            {notifs.length === 0 ? (
              <div style={{ padding:'40px 24px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🔔</div>
                <p style={{ fontSize:13, color:C.text3 }}>Sin avisos por ahora</p>
                <p style={{ fontSize:12, color:C.text3, marginTop:4 }}>Aquí verás las llamadas y eventos importantes</p>
              </div>
            ) : notifs.map((n, i) => {
              const cfg = TYPE_CFG[n.type] || TYPE_CFG.default
              return (
                <div key={n.id} style={{
                  display:'flex', gap:10, padding:'12px 16px',
                  borderBottom: i < notifs.length - 1 ? `1px solid ${C.border}` : 'none',
                  background: n.read ? 'transparent' : 'rgba(240,168,78,0.03)',
                  transition:'background 0.2s',
                }}>
                  {/* Icono */}
                  <div style={{
                    width:34, height:34, borderRadius:9, flexShrink:0,
                    background:cfg.bg, display:'flex', alignItems:'center',
                    justifyContent:'center', fontSize:15,
                  }}>
                    {cfg.icon}
                  </div>
                  {/* Contenido */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:4 }}>
                      <p style={{ fontSize:12.5, fontWeight: n.read ? 500 : 700, color:C.text, lineHeight:1.4 }}>
                        {n.title}
                      </p>
                      <span style={{ fontSize:10, color:C.text3, flexShrink:0, marginTop:1 }}>
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    {n.body && (
                      <p style={{ fontSize:11.5, color:C.text2, marginTop:2, lineHeight:1.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {n.body}
                      </p>
                    )}
                    {!n.read && (
                      <div style={{ width:6, height:6, borderRadius:'50%', background:C.amber, marginTop:4 }}/>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
