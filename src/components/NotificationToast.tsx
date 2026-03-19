'use client'
import { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react'

export interface Toast {
  id:       string
  title:    string
  body?:    string
  type:     string
  priority: 'info' | 'warning' | 'critical'
  icon:     string
}

interface ToastCtx {
  push: (t: Omit<Toast,'id'>) => void
}
const Ctx = createContext<ToastCtx>({ push: () => {} })
export const useToast = () => useContext(Ctx)

const COLORS = {
  info:     { bg:'rgba(45,212,191,0.12)', border:'rgba(45,212,191,0.3)',  text:'#2DD4BF', dot:'#2DD4BF'  },
  warning:  { bg:'rgba(251,181,63,0.12)', border:'rgba(251,181,63,0.3)', text:'#FBB53F', dot:'#FBB53F'  },
  critical: { bg:'rgba(248,113,113,0.12)',border:'rgba(248,113,113,0.35)',text:'#F87171', dot:'#F87171'  },
}
// duración auto-dismiss por prioridad (0 = no desaparece solo)
const AUTO_DISMISS = { info: 5000, warning: 8000, critical: 0 }

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id:string) => void }) {
  const c = COLORS[toast.priority]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 10)
    const dur = AUTO_DISMISS[toast.priority]
    if (dur > 0) {
      const t2 = setTimeout(() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300) }, dur)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
    return () => clearTimeout(t1)
  }, [toast.id, toast.priority, onRemove])

  return (
    <div onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300) }}
      style={{
        display:'flex', gap:12, alignItems:'flex-start',
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius:14, padding:'14px 16px', cursor:'pointer',
        boxShadow:'0 8px 32px rgba(0,0,0,0.4)',
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(120%) scale(0.96)',
        opacity: visible ? 1 : 0,
        transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        width:320, maxWidth:'90vw', position:'relative',
      }}>
      {/* Barra izquierda de prioridad */}
      <div style={{ position:'absolute', left:0, top:8, bottom:8, width:3, borderRadius:2, background:c.dot }}/>
      <div style={{ fontSize:20, flexShrink:0 }}>{toast.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:13, fontWeight:700, color:'#E8EEF6', marginBottom: toast.body ? 3 : 0, lineHeight:1.3 }}>{toast.title}</p>
        {toast.body && <p style={{ fontSize:12, color:'#8895A7', lineHeight:1.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{toast.body}</p>}
        {toast.priority === 'critical' && (
          <p style={{ fontSize:10, color:c.text, marginTop:4, fontWeight:700, letterSpacing:'0.04em' }}>REQUIERE ATENCIÓN · Toca para cerrar</p>
        )}
      </div>
      {toast.priority !== 'critical' && (
        <button onClick={e=>{ e.stopPropagation(); setVisible(false); setTimeout(()=>onRemove(toast.id),300) }}
          style={{ background:'none', border:'none', color:'#49566A', cursor:'pointer', fontSize:16, padding:0, flexShrink:0, marginTop:-2 }}>✕</button>
      )}
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((t: Omit<Toast,'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { ...t, id }])
  }, [])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      {/* Stack de toasts — esquina superior derecha */}
      <div style={{
        position:'fixed', top:16, right:16, zIndex:9999,
        display:'flex', flexDirection:'column', gap:10,
        pointerEvents:'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents:'all' }}>
            <ToastItem toast={t} onRemove={remove}/>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
