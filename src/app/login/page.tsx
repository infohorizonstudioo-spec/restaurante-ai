'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const ERR: Record<string,string> = {
  'Invalid login credentials': 'Email o contraseña incorrectos',
  'invalid_credentials':       'Email o contraseña incorrectos',
  'Email not confirmed':       'Confirma tu email antes de entrar',
  'Too many requests':         'Demasiados intentos. Espera unos minutos.',
}
function mapErr(m: string) {
  for (const [k,v] of Object.entries(ERR)) if (m.includes(k)) return v
  return 'Error al iniciar sesión. Inténtalo de nuevo.'
}

// ── Animated call demo
const CONV = [
  { from:'client', text:'Buenas, quería mesa para mañana.' },
  { from:'agent',  text:'¡Hola! ¿Para cuántas personas y a qué hora?' },
  { from:'client', text:'Para cuatro, sobre las nueve.' },
  { from:'agent',  text:'¿Prefiere terraza o interior?' },
  { from:'client', text:'Terraza si hay disponibilidad.' },
  { from:'agent',  text:'Perfecto. ¿A nombre de quién la hago?' },
  { from:'client', text:'A nombre de García.' },
  { from:'confirm',text:'✓  Reserva García · Mañana 21:00 · 4 personas · Terraza' },
]

function CallDemo() {
  const [shown,setShown]   = useState<number[]>([])
  const [typing,setTyping] = useState<number|null>(null)
  const timers             = useRef<ReturnType<typeof setTimeout>[]>([])
  const scroll             = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function clear() { timers.current.forEach(clearTimeout); timers.current = [] }
    function run() {
      clear(); setShown([]); setTyping(null)
      let d = 500
      CONV.forEach((msg,i) => {
        const ms = Math.min(msg.text.length*22+200,1600)
        if (msg.from==='agent') {
          timers.current.push(setTimeout(()=>setTyping(i),d)); d+=650
          timers.current.push(setTimeout(()=>{ setTyping(null); setShown(p=>[...p,i]) },d)); d+=ms
        } else {
          timers.current.push(setTimeout(()=>setShown(p=>[...p,i]),d)); d+=ms
        }
      })
      timers.current.push(setTimeout(run, d+2500))
    }
    run(); return clear
  },[])

  useEffect(()=>{ scroll.current?.scrollTo({ top:scroll.current.scrollHeight, behavior:'smooth' }) },[shown,typing])

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', gap:16 }}>
      {/* Header */}
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <div style={{ position:'relative' }}>
            <div style={{ width:38, height:38, borderRadius:10, background:'rgba(240,168,78,0.12)', border:'1px solid rgba(240,168,78,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="#F0A84E"><path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm0 12c5.33 0 8 2.67 8 4v2H4v-2c0-1.33 2.67-4 8-4z"/></svg>
            </div>
            <div style={{ position:'absolute', bottom:-1, right:-1, width:10, height:10, borderRadius:'50%', background:'#2DD4BF', border:'2px solid #0C1018' }}/>
          </div>
          <div>
            <p style={{ color:'#E8EEF6', fontWeight:600, fontSize:13, letterSpacing:'-0.01em' }}>Reservo.AI · Recepcionista virtual</p>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:1 }}>Atendiendo llamadas ahora mismo</p>
          </div>
        </div>
        <h2 style={{ color:'#E8EEF6', fontSize:22, fontWeight:700, letterSpacing:'-0.03em', lineHeight:1.25, marginBottom:10 }}>
          Tu empleado que nunca duerme
        </h2>
        <p style={{ color:'rgba(255,255,255,0.38)', fontSize:13, lineHeight:1.7 }}>
          Responde, gestiona y registra cada llamada — y tú lo ves todo en el panel en tiempo real.
        </p>
      </div>

      {/* Chat window */}
      <div style={{ flex:1, background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column', minHeight:240 }}>
        <div style={{ padding:'9px 14px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', gap:5 }}>
            {['#ff5f57','#febc2e','#28c840'].map(c=><div key={c} style={{ width:8, height:8, borderRadius:'50%', background:c, opacity:0.6 }}/>)}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background:'#F87171', animation:'rz-pulse 1.5s infinite' }}/>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)', letterSpacing:'0.07em', textTransform:'uppercase', fontWeight:600 }}>llamada activa</span>
          </div>
        </div>
        <div ref={scroll} style={{ flex:1, padding:12, display:'flex', flexDirection:'column', gap:8, overflowY:'auto', scrollbarWidth:'none' }}>
          {CONV.map((msg,i) => {
            const vis=shown.includes(i), typ=typing===i
            if(!vis&&!typ) return null
            if (msg.from==='confirm'&&vis) return (
              <div key={i} style={{ background:'rgba(45,212,191,0.1)', border:'1px solid rgba(45,212,191,0.2)', borderRadius:9, padding:'9px 12px', animation:'rz-fade-up 0.4s ease' }}>
                <p style={{ fontSize:12, color:'#2DD4BF', fontWeight:600 }}>{msg.text}</p>
              </div>
            )
            const isA = msg.from==='agent'
            return (
              <div key={i} style={{ display:'flex', gap:7, justifyContent:isA?'flex-start':'flex-end', animation:'rz-fade-up 0.3s ease' }}>
                {isA&&<div style={{ width:22, height:22, borderRadius:'50%', background:'rgba(240,168,78,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}><svg width="10" height="10" viewBox="0 0 24 24" fill="#F0A84E"><path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm0 12c5.33 0 8 2.67 8 4v2H4v-2c0-1.33 2.67-4 8-4z"/></svg></div>}
                <div style={{ maxWidth:'75%', background:isA?'rgba(255,255,255,0.06)':'rgba(240,168,78,0.15)', border:isA?'1px solid rgba(255,255,255,0.07)':'1px solid rgba(240,168,78,0.25)', borderRadius:isA?'4px 12px 12px 12px':'12px 4px 12px 12px', padding:'7px 11px' }}>
                  {typ
                    ?<div style={{ display:'flex', gap:3, alignItems:'center', height:14 }}>{[0,1,2].map(j=><div key={j} style={{ width:4, height:4, borderRadius:'50%', background:'rgba(255,255,255,0.4)', animation:'rz-bounce 1.1s ease-in-out infinite', animationDelay:j*0.18+'s' }}/>)}</div>
                    :<p style={{ fontSize:12.5, color:isA?'rgba(255,255,255,0.7)':'rgba(255,255,255,0.9)', lineHeight:1.5 }}>{msg.text}</p>
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
        {[{n:'24/7',l:'Sin descanso'},{n:'< 2s',l:'Tiempo respuesta'},{n:'100%',l:'Llamadas atendidas'}].map(s=>(
          <div key={s.l} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'12px 8px', textAlign:'center' }}>
            <p style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600, fontSize:16, color:'#E8EEF6', letterSpacing:'-0.02em' }}>{s.n}</p>
            <p style={{ color:'rgba(255,255,255,0.3)', fontSize:10.5, marginTop:3, fontWeight:500 }}>{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Benefits list
const BENEFITS = [
  { icon:'📞', text:'Responde llamadas automáticamente, 24/7' },
  { icon:'📅', text:'Gestiona reservas y pedidos en tiempo real' },
  { icon:'📊', text:'Todo aparece en el panel instantáneamente' },
]

export default function LoginPage() {
  const [email,setEmail]     = useState('')
  const [pw,setPw]           = useState('')
  const [loading,setLoading] = useState(false)
  const [error,setError]     = useState('')

  const login = useCallback(async () => {
    if (!email.trim()||!pw) { setError('Rellena todos los campos'); return }
    setLoading(true); setError('')
    try {
      const { data,error:e } = await supabase.auth.signInWithPassword({ email:email.trim().toLowerCase(), password:pw })
      if (e) throw e
      const { data:p } = await supabase.from('profiles').select('role,tenant_id').eq('id',data.user.id).single()
      if ((p as any)?.role==='superadmin') { window.location.href='/admin'; return }
      if ((p as any)?.tenant_id) {
        const { data:t } = await supabase.from('tenants').select('onboarding_complete').eq('id',(p as any).tenant_id).single()
        window.location.href = t?.onboarding_complete ? '/panel' : '/onboarding'
      } else window.location.href='/onboarding'
    } catch (e:any) { setError(mapErr(e.message||'')) }
    finally { setLoading(false) }
  },[email,pw])

  return (
    <div style={{ minHeight:'100vh', display:'grid', gridTemplateColumns:'1fr 1fr', fontFamily:"'Sora',-apple-system,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box}
        @keyframes rz-pulse{0%,100%{opacity:1}50%{opacity:0.45}}
        @keyframes rz-spin{to{transform:rotate(360deg)}}
        @keyframes rz-fade-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rz-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @keyframes rz-glow{0%,100%{box-shadow:0 0 0 0 rgba(240,168,78,0)}50%{box-shadow:0 0 0 6px rgba(240,168,78,0)}}
        .rzinp{width:100%;font-family:'Sora',sans-serif;font-size:14px;color:#E8EEF6;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px 14px;outline:none;transition:border-color 0.15s,box-shadow 0.15s}
        .rzinp::placeholder{color:#49566A}
        .rzinp:focus{border-color:#F0A84E;box-shadow:0 0 0 3px rgba(240,168,78,0.12)}
        .rzinp-light{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.09);color:#E8EEF6}
        .rzbtn{width:100%;padding:13px 20px;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;color:#0C1018;background:linear-gradient(135deg,#F0A84E,#E8923A);border:none;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:-0.01em;box-shadow:0 2px 14px rgba(240,168,78,0.25);transition:all 0.15s}
        .rzbtn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 22px rgba(240,168,78,0.38)}
        .rzbtn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
        @media(max-width:860px){.rz-rp{display:none!important}.rz-lp{grid-column:1/-1!important}}
      `}</style>

      {/* ── RIGHT: Dark panel with demo (shows first on visual impact) ── */}
      <div className="rz-rp" style={{ background:'linear-gradient(155deg,#0C1018 0%,#101825 45%,#0E1620 100%)', minHeight:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', padding:'clamp(28px,5vw,60px)', position:'relative', overflow:'hidden', order:2 }}>
        {/* Ambient glow */}
        <div style={{ position:'absolute', top:'15%', right:'10%', width:300, height:300, background:'radial-gradient(circle,rgba(240,168,78,0.06),transparent)', pointerEvents:'none', borderRadius:'50%' }}/>
        <div style={{ position:'absolute', bottom:'15%', left:'5%', width:200, height:200, background:'radial-gradient(circle,rgba(45,212,191,0.05),transparent)', pointerEvents:'none', borderRadius:'50%' }}/>
        {/* Grid texture */}
        <div style={{ position:'absolute', inset:0, opacity:0.02, backgroundImage:'linear-gradient(rgba(255,255,255,0.9) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.9) 1px,transparent 1px)', backgroundSize:'48px 48px', pointerEvents:'none' }}/>
        <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', gap:24, height:'min(580px,80vh)' }}>
          <CallDemo/>
        </div>
      </div>

      {/* ── LEFT: Form ── */}
      <div className="rz-lp" style={{ display:'flex', flexDirection:'column', justifyContent:'center', padding:'clamp(28px,6vw,72px)', background:'#0F1823', minHeight:'100vh', order:1, borderRight:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:380, width:'100%', margin:'0 auto' }}>

          {/* Logo */}
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:9, marginBottom:44, textDecoration:'none' }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#F0A84E,#E8923A)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 10px rgba(240,168,78,0.3)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#0C1018"><path d="M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/></svg>
            </div>
            <span style={{ fontWeight:700, fontSize:16, color:'#E8EEF6', letterSpacing:'-0.02em' }}>Reservo<span style={{ color:'#F0A84E' }}>.AI</span></span>
          </Link>

          <h1 style={{ fontSize:26, fontWeight:700, color:'#E8EEF6', letterSpacing:'-0.03em', marginBottom:6 }}>Bienvenido de nuevo</h1>
          <p style={{ fontSize:13, color:'#8895A7', marginBottom:28 }}>
            ¿Sin cuenta?{' '}<Link href="/registro" style={{ color:'#F0A84E', fontWeight:600, textDecoration:'none' }}>Empieza gratis →</Link>
          </p>

          {/* Benefits */}
          <div style={{ marginBottom:28, display:'flex', flexDirection:'column', gap:8 }}>
            {BENEFITS.map(b=>(
              <div key={b.text} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:9 }}>
                <span style={{ fontSize:14 }}>{b.icon}</span>
                <span style={{ fontSize:12.5, color:'#8895A7', lineHeight:1.4 }}>{b.text}</span>
              </div>
            ))}
          </div>

          {/* Form */}
          <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:18 }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#8895A7', marginBottom:6, letterSpacing:'0.05em', textTransform:'uppercase' }}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="tu@negocio.com" autoComplete="email" className="rzinp"/>
            </div>
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <label style={{ fontSize:11, fontWeight:600, color:'#8895A7', letterSpacing:'0.05em', textTransform:'uppercase' }}>Contraseña</label>
                <Link href="/reset" style={{ fontSize:12, color:'#F0A84E', textDecoration:'none', fontWeight:500 }}>¿Olvidaste?</Link>
              </div>
              <input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="••••••••" autoComplete="current-password" className="rzinp"/>
            </div>
          </div>

          {error && (
            <div style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:9, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#F87171', display:'flex', alignItems:'center', gap:7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#F87171" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="#F87171" strokeWidth="2" strokeLinecap="round"/></svg>
              {error}
            </div>
          )}

          <button onClick={login} disabled={loading} className="rzbtn">
            {loading
              ?<><div style={{ width:16,height:16,border:'2px solid rgba(12,16,24,0.3)',borderTop:'2px solid #0C1018',borderRadius:'50%',animation:'rz-spin 0.7s linear infinite' }}/> Entrando…</>
              :<>Entrar en el panel <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0C1018" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>
            }
          </button>

          <p style={{ marginTop:24, fontSize:11, color:'#49566A', textAlign:'center', lineHeight:1.6 }}>
            Al entrar aceptas los{' '}
            <a href="/terminos" style={{ color:'#8895A7' }}>Términos de servicio</a> y la{' '}
            <a href="/privacidad" style={{ color:'#8895A7' }}>Política de privacidad</a>
          </p>
        </div>
      </div>
    </div>
  )
}
