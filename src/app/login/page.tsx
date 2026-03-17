'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const ERR: Record<string,string> = {
  'Invalid login credentials':  'Email o contraseña incorrectos',
  'invalid_credentials':        'Email o contraseña incorrectos',
  'Email not confirmed':        'Confirma tu email antes de entrar',
  'Too many requests':          'Demasiados intentos. Espera unos minutos.',
}
function mapErr(m: string) {
  for (const [k, v] of Object.entries(ERR)) if (m.includes(k)) return v
  return 'Error al iniciar sesión. Inténtalo de nuevo.'
}

const CONV = [
  { from: 'client', text: 'Buenas, quería una mesa para mañana por la noche.' },
  { from: 'agent',  text: '¡Buenas! ¿Para cuántas personas y a qué hora?' },
  { from: 'client', text: 'Para cuatro, sobre las nueve.' },
  { from: 'agent',  text: '¿Prefiere terraza o interior?' },
  { from: 'client', text: 'Terraza si hay disponibilidad.' },
  { from: 'agent',  text: 'Perfecto. ¿A nombre de quién la reservo?' },
  { from: 'client', text: 'De Martínez.' },
  { from: 'confirm', text: 'Reserva confirmada · Martínez · Mañana 21:00 · 4 personas · Terraza' },
]

function CallDemo() {
  const [shown, setShown]     = useState<number[]>([])
  const [typing, setTyping]   = useState<number | null>(null)
  const timersRef             = useRef<ReturnType<typeof setTimeout>[]>([])
  const scrollRef             = useRef<HTMLDivElement>(null)

  // ── La función run() está dentro del useEffect y cumDelay se resetea cada vez ──
  useEffect(() => {
    function clearAll() {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }

    function run() {
      clearAll()
      setShown([])
      setTyping(null)

      let delay = 400 // ← DENTRO de run, se resetea cada ciclo

      CONV.forEach((msg, i) => {
        const readMs = Math.min(msg.text.length * 24 + 250, 1800)

        if (msg.from === 'agent') {
          timersRef.current.push(setTimeout(() => setTyping(i), delay))
          delay += 700
          timersRef.current.push(setTimeout(() => {
            setTyping(null)
            setShown(p => [...p, i])
          }, delay))
          delay += readMs
        } else {
          timersRef.current.push(setTimeout(() => setShown(p => [...p, i]), delay))
          delay += readMs
        }
      })

      // Reiniciar después de que acabe
      timersRef.current.push(setTimeout(run, delay + 2200))
    }

    run()
    return clearAll
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [shown, typing])

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <div style={{ position:'relative' }}>
            <div style={{ width:40,height:40,borderRadius:12,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm0 12c5.33 0 8 2.67 8 4v2H4v-2c0-1.33 2.67-4 8-4z" fill="rgba(255,255,255,0.75)"/></svg>
            </div>
            <div style={{ position:'absolute',bottom:-2,right:-2,width:10,height:10,borderRadius:'50%',background:'#4ade80',border:'2px solid #0b1120' }}/>
          </div>
          <div>
            <p style={{ color:'white',fontWeight:600,fontSize:14,letterSpacing:'-0.01em' }}>Sofía · Tu recepcionista virtual</p>
            <p style={{ fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:1 }}>Atendiendo llamadas ahora mismo</p>
          </div>
        </div>
        <h2 style={{ color:'white',fontSize:20,fontWeight:700,letterSpacing:'-0.025em',lineHeight:1.3,marginBottom:8 }}>
          Tu empleado virtual que nunca descansa
        </h2>
        <p style={{ color:'rgba(255,255,255,0.4)',fontSize:13,lineHeight:1.65 }}>
          Responde igual que lo haría un recepcionista — y tú lo ves todo en el panel en tiempo real.
        </p>
      </div>

      <div style={{ flex:1,background:'rgba(0,0,0,0.25)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,overflow:'hidden',display:'flex',flexDirection:'column' }}>
        <div style={{ padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div style={{ display:'flex',gap:5 }}>
            {['#ff5f57','#febc2e','#28c840'].map(c=><div key={c} style={{ width:9,height:9,borderRadius:'50%',background:c,opacity:0.65 }}/>)}
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:5 }}>
            <div style={{ width:6,height:6,borderRadius:'50%',background:'#f87171',animation:'rpulse 1.5s infinite' }}/>
            <span style={{ fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.06em',textTransform:'uppercase' as const,fontWeight:600 }}>Llamada activa</span>
          </div>
        </div>
        <div ref={scrollRef} style={{ flex:1,padding:'14px',display:'flex',flexDirection:'column',gap:9,overflowY:'auto' as const,scrollbarWidth:'none' as const }}>
          {CONV.map((msg,i)=>{
            const vis=shown.includes(i), typ=typing===i
            if(!vis&&!typ) return null
            if(msg.from==='confirm'&&vis) return(
              <div key={i} style={{ background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:9,padding:'9px 13px',animation:'rfadeUp 0.4s ease' }}>
                <div style={{ display:'flex',alignItems:'center',gap:7 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <p style={{ fontSize:12,color:'#4ade80',fontWeight:600 }}>{msg.text}</p>
                </div>
              </div>
            )
            const isA=msg.from==='agent'
            return(
              <div key={i} style={{ display:'flex',gap:8,justifyContent:isA?'flex-start':'flex-end',animation:'rfadeUp 0.3s ease' }}>
                {isA&&<div style={{ width:24,height:24,borderRadius:'50%',background:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm0 12c5.33 0 8 2.67 8 4v2H4v-2c0-1.33 2.67-4 8-4z" fill="rgba(255,255,255,0.55)"/></svg></div>}
                <div style={{ maxWidth:'76%',background:isA?'rgba(255,255,255,0.07)':'rgba(59,130,246,0.22)',border:isA?'1px solid rgba(255,255,255,0.07)':'1px solid rgba(59,130,246,0.3)',borderRadius:isA?'4px 12px 12px 12px':'12px 4px 12px 12px',padding:'8px 12px' }}>
                  {typ
                    ?<div style={{ display:'flex',gap:3,alignItems:'center',height:16 }}>
                        {[0,1,2].map(j=><div key={j} style={{ width:4,height:4,borderRadius:'50%',background:'rgba(255,255,255,0.4)',animation:'rbounce 1.1s ease-in-out infinite',animationDelay:j*0.18+'s' }}/>)}
                      </div>
                    :<p style={{ fontSize:12.5,color:isA?'rgba(255,255,255,0.75)':'rgba(255,255,255,0.9)',lineHeight:1.55,margin:0 }}>{msg.text}</p>
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:14 }}>
        {[{n:'24/7',l:'Sin descanso'},{n:'< 2s',l:'Tiempo respuesta'},{n:'100%',l:'Llamadas atendidas'}].map(s=>(
          <div key={s.l} style={{ background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:9,padding:'11px 8px',textAlign:'center' as const }}>
            <p style={{ color:'white',fontWeight:700,fontSize:15,letterSpacing:'-0.01em' }}>{s.n}</p>
            <p style={{ color:'rgba(255,255,255,0.35)',fontSize:10.5,marginTop:2 }}>{s.l}</p>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes rfadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rpulse  { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes rbounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  const [email,setEmail]     = useState('')
  const [pw,setPw]           = useState('')
  const [loading,setLoading] = useState(false)
  const [error,setError]     = useState('')

  const login = useCallback(async () => {
    if (!email.trim()||!pw) { setError('Rellena todos los campos'); return }
    setLoading(true); setError('')
    try {
      const {data,error:e} = await supabase.auth.signInWithPassword({ email:email.trim().toLowerCase(), password:pw })
      if (e) throw e
      const {data:p} = await supabase.from('profiles').select('role,tenant_id').eq('id',data.user.id).single()
      if ((p as any)?.role==='superadmin') { window.location.href='/admin'; return }
      if ((p as any)?.tenant_id) {
        const {data:t} = await supabase.from('tenants').select('onboarding_complete').eq('id',(p as any).tenant_id).single()
        window.location.href = t?.onboarding_complete ? '/panel' : '/onboarding'
      } else window.location.href='/onboarding'
    } catch (e:any) { setError(mapErr(e.message||'')) }
    finally { setLoading(false) }
  },[email,pw])

  return (
    <div style={{ minHeight:'100vh',display:'grid',gridTemplateColumns:'1fr 1fr',fontFamily:"'DM Sans',-apple-system,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}
        @keyframes rspin{to{transform:rotate(360deg)}}
        input:focus{border-color:#3b82f6!important;box-shadow:0 0 0 3px rgba(59,130,246,0.14)!important;outline:none}
        .rinp{width:100%;font-family:inherit;font-size:14px;color:#0f172a;background:#f9fafb;border:1px solid #e2e8f0;border-radius:9px;padding:11px 14px;outline:none;transition:border 0.15s,box-shadow 0.15s}
        .rbtn{width:100%;padding:12px;font-family:inherit;font-size:15px;font-weight:600;color:white;background:linear-gradient(135deg,#1e40af,#3b82f6);border:none;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 2px 10px rgba(59,130,246,0.28);transition:all 0.15s}
        .rbtn:hover:not(:disabled){opacity:0.92;transform:translateY(-1px)}
        .rbtn:disabled{opacity:0.55;cursor:default;transform:none}
        @media(max-width:900px){.rrp{display:none!important}.rlp{grid-column:1/-1!important}}
      `}</style>

      {/* ── LEFT ── */}
      <div className="rlp" style={{ display:'flex',flexDirection:'column',justifyContent:'center',padding:'clamp(32px,6vw,72px)',background:'#fff',minHeight:'100vh' }}>
        <div style={{ maxWidth:380,width:'100%',margin:'0 auto' }}>
          <Link href="/" style={{ display:'flex',alignItems:'center',gap:8,marginBottom:48,textDecoration:'none' }}>
            <div style={{ width:30,height:30,background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(59,130,246,0.28)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
            </div>
            <span style={{ fontWeight:700,fontSize:15,color:'#0f172a',letterSpacing:'-0.01em' }}>Reservo.AI</span>
          </Link>
          <h1 style={{ fontSize:26,fontWeight:700,letterSpacing:'-0.025em',color:'#0f172a',marginBottom:6 }}>Bienvenido de nuevo</h1>
          <p style={{ fontSize:14,color:'#64748b',marginBottom:32 }}>
            ¿Sin cuenta?{' '}
            <Link href="/registro" style={{ color:'#1d4ed8',fontWeight:500,textDecoration:'none' }}>Empieza gratis →</Link>
          </p>
          <div style={{ display:'flex',flexDirection:'column',gap:16,marginBottom:20 }}>
            <div>
              <label style={{ display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:6,textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="tu@negocio.com" autoComplete="email" className="rinp"/>
            </div>
            <div>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
                <label style={{ fontSize:11,fontWeight:600,color:'#374151',textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Contraseña</label>
                <Link href="/reset" style={{ fontSize:12,color:'#1d4ed8',textDecoration:'none' }}>¿Olvidaste?</Link>
              </div>
              <input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="••••••••" autoComplete="current-password" className="rinp"/>
            </div>
          </div>
          {error&&<div style={{ background:'#fef2f2',border:'1px solid #fecaca',borderRadius:9,padding:'10px 14px',marginBottom:16,fontSize:13,color:'#dc2626',display:'flex',alignItems:'center',gap:7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#dc2626" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/></svg>
            {error}
          </div>}
          <button onClick={login} disabled={loading} className="rbtn">
            {loading
              ?<><div style={{ width:16,height:16,border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid white',borderRadius:'50%',animation:'rspin 0.7s linear infinite' }}/>Entrando...</>
              :<>Entrar <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></>
            }
          </button>
          <p style={{ marginTop:28,fontSize:12,color:'#94a3b8',textAlign:'center' as const,lineHeight:1.6 }}>
            Al entrar aceptas los <a href="#" style={{ color:'#64748b',textDecoration:'underline' }}>Términos</a> y la <a href="#" style={{ color:'#64748b',textDecoration:'underline' }}>Privacidad</a>
          </p>
        </div>
      </div>

      {/* ── RIGHT: Demo ── */}
      <div className="rrp" style={{ background:'linear-gradient(160deg,#0b1120 0%,#0f1f3d 48%,#0b1120 100%)',minHeight:'100vh',display:'flex',flexDirection:'column',justifyContent:'center',padding:'clamp(32px,5vw,56px)',position:'relative',overflow:'hidden' }}>
        <div style={{ position:'absolute',inset:0,opacity:0.02,backgroundImage:'linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)',backgroundSize:'40px 40px',pointerEvents:'none' }}/>
        <div style={{ position:'absolute',top:'12%',right:'6%',width:260,height:260,background:'radial-gradient(circle,rgba(59,130,246,0.09),transparent)',borderRadius:'50%',pointerEvents:'none' }}/>
        <div style={{ position:'relative',zIndex:1,height:'min(560px,78vh)',display:'flex',flexDirection:'column' }}>
          <CallDemo/>
        </div>
      </div>
    </div>
  )
}