'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

/* ─── LIVE NOTIFICATION FEED ─── */
const NOTIFICATIONS = [
  { icon:'📞', color:'#2DD4BF', msg:'Llamada entrante — Cita corte y color mañana', sub:'hace 2s' },
  { icon:'💬', color:'#4ADE80', msg:'WhatsApp — "¿Tienen mesa para hoy?" → Reserva confirmada', sub:'hace 5s' },
  { icon:'✅', color:'#4ADE80', msg:'Cita confirmada — García · Viernes 11:00', sub:'hace 8s' },
  { icon:'📧', color:'#60A5FA', msg:'Email respondido — Presupuesto ortodoncia enviado', sub:'hace 12s' },
  { icon:'📞', color:'#2DD4BF', msg:'Llamada entrante — Presupuesto instalación AC', sub:'hace 22s' },
  { icon:'💬', color:'#4ADE80', msg:'WhatsApp — Recordatorio enviado a 3 clientes', sub:'hace 28s' },
  { icon:'📧', color:'#60A5FA', msg:'Email — Consulta fiscal resuelta automáticamente', sub:'hace 35s' },
  { icon:'✅', color:'#4ADE80', msg:'Reserva confirmada — López · Lunes 10:00', sub:'hace 40s' },
]

function LiveFeed() {
  const [items, setItems] = useState(NOTIFICATIONS.slice(0,3))
  const [flash, setFlash] = useState<number|null>(null)
  useEffect(() => {
    let i = 3
    const t = setInterval(() => {
      const next = NOTIFICATIONS[i % NOTIFICATIONS.length]
      setItems(prev => [next, ...prev.slice(0,4)])
      setFlash(0)
      setTimeout(() => setFlash(null), 600)
      i++
    }, 2800)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {items.map((n,idx) => (
        <div key={idx+n.msg} style={{
          display:'flex',alignItems:'center',gap:12,
          background: idx===0&&flash===0 ? 'rgba(240,168,78,0.08)' : 'rgba(255,255,255,0.03)',
          border:`1px solid ${idx===0&&flash===0?'rgba(240,168,78,0.3)':'rgba(255,255,255,0.07)'}`,
          borderRadius:12,padding:'10px 14px',
          transition:'all 0.4s ease',
          opacity: idx===0 ? 1 : 1 - idx*0.15,
          transform: idx===0&&flash===0 ? 'scale(1.01)' : 'scale(1)'
        }}>
          <span style={{fontSize:18,flexShrink:0}}>{n.icon}</span>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:12.5,color:'#E8EEF6',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{n.msg}</p>
            <p style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:1}}>{n.sub}</p>
          </div>
          <div style={{width:6,height:6,borderRadius:'50%',background:n.color,flexShrink:0}}/>
        </div>
      ))}
    </div>
  )
}

/* ─── LIVE CALL SIMULATION ─── */
const CALL_STEPS = [
  { who:'client', text:'Hola, quería reservar mesa para 4 esta noche a las 21:00.' },
  { who:'agent',  text:'Buenas tardes. A las 21:00 está completo, pero tengo una mesa perfecta para 4 a las 21:30. ¿Le viene bien?' },
  { who:'client', text:'Sí, perfecto. Ah, y uno de nosotros es celíaco.' },
  { who:'agent',  text:'Apuntado. Mesa para 4 a las 21:30 con nota para cocina. ¿A qué nombre?' },
  { who:'client', text:'García. Gracias.' },
  { who:'confirm',text:'✓ Reserva confirmada · García · 4 pax · 21:30 · Nota celíaco enviada a cocina' },
]
function CallSim() {
  const [shown, setShown] = useState<number[]>([])
  const [typing, setTyping] = useState<number|null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = []
    function run() {
      setShown([]); setTyping(null)
      let d = 600
      CALL_STEPS.forEach((s,i) => {
        const ms = Math.min(s.text.length*20+200, 1400)
        if (s.who==='agent') {
          timers.push(setTimeout(()=>setTyping(i), d)); d+=600
          timers.push(setTimeout(()=>{ setTyping(null); setShown(p=>[...p,i]) }, d)); d+=ms
        } else {
          timers.push(setTimeout(()=>setShown(p=>[...p,i]), d)); d+=ms
        }
      })
      timers.push(setTimeout(run, d+3000))
    }
    run()
    return () => timers.forEach(clearTimeout)
  }, [])
  useEffect(() => { ref.current?.scrollTo({top:9999,behavior:'smooth'}) }, [shown,typing])
  return (
    <div ref={ref} style={{flex:1,overflowY:'auto',scrollbarWidth:'none',display:'flex',flexDirection:'column',gap:8,padding:'12px 0'}}>
      {CALL_STEPS.map((s,i) => {
        const vis=shown.includes(i), typ=typing===i
        if(!vis&&!typ) return null
        if(s.who==='confirm'&&vis) return (
          <div key={i} style={{background:'rgba(45,212,191,0.1)',border:'1px solid rgba(45,212,191,0.25)',borderRadius:10,padding:'10px 14px',animation:'fadeUp 0.4s ease'}}>
            <p style={{fontSize:12,color:'#2DD4BF',fontWeight:600}}>{s.text}</p>
          </div>
        )
        const isA=s.who==='agent'
        return (
          <div key={i} style={{display:'flex',justifyContent:isA?'flex-start':'flex-end',animation:'fadeUp 0.3s ease'}}>
            <div style={{maxWidth:'78%',background:isA?'rgba(255,255,255,0.06)':'rgba(240,168,78,0.15)',border:isA?'1px solid rgba(255,255,255,0.08)':'1px solid rgba(240,168,78,0.3)',borderRadius:isA?'4px 12px 12px 12px':'12px 4px 12px 12px',padding:'8px 12px'}}>
              {typ
                ? <div style={{display:'flex',gap:3,alignItems:'center',height:14}}>{[0,1,2].map(j=><div key={j} style={{width:4,height:4,borderRadius:'50%',background:'rgba(255,255,255,0.4)',animation:`bounce 1.1s ease-in-out infinite`,animationDelay:j*0.18+'s'}}/>)}</div>
                : <p style={{fontSize:12.5,color:isA?'rgba(255,255,255,0.75)':'rgba(255,255,255,0.9)',lineHeight:1.5}}>{s.text}</p>
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── DEMO WIDGET — ElevenLabs embed ─── */
function DemoWidget() {
  const widgetRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (loaded) return
    const script = document.createElement('script')
    script.src = 'https://elevenlabs.io/convai-widget/index.js'
    script.async = true
    script.onload = () => setLoaded(true)
    document.body.appendChild(script)
    return () => { try { document.body.removeChild(script) } catch {} }
  }, [loaded])
  return (
    <div style={{maxWidth:480,margin:'0 auto 48px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(240,168,78,0.25)',borderRadius:20,padding:24,textAlign:'center'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:16}}>
        <div style={{width:10,height:10,borderRadius:'50%',background:'#34D399',animation:'pulse 2s ease-in-out infinite'}}/>
        <span style={{fontSize:14,fontWeight:600,color:'#E8EEF6'}}>Habla con tu futura recepcionista</span>
      </div>
      <p style={{fontSize:13,color:'rgba(255,255,255,0.45)',marginBottom:20}}>Pulsa el botón y habla como si llamaras a un negocio. Pide una reserva, pregunta precios, cambia una cita. Haz lo que harías con una persona real.</p>
      <div ref={widgetRef}>
        {loaded && <div dangerouslySetInnerHTML={{__html:`<elevenlabs-convai agent-id="${process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || ''}"></elevenlabs-convai>`}}/>}
      </div>
      <p style={{fontSize:11,color:'rgba(255,255,255,0.2)',marginTop:12}}>Conversación real con IA · Sin registro · Gratis</p>
    </div>
  )
}

/* ─── ROI CALCULATOR ─── */
function ROICalculator() {
  const [calls, setCalls] = useState(5)
  const lost = calls * 45 * 30
  return (
    <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(240,168,78,0.2)',borderRadius:20,padding:'36px 32px',textAlign:'center',boxShadow:'0 8px 40px rgba(0,0,0,0.3)'}}>
      <p style={{fontSize:13,fontWeight:600,color:'#F0A84E',letterSpacing:'0.06em',marginBottom:16}}>CALCULADORA DE OPORTUNIDADES PERDIDAS</p>
      <p style={{fontSize:15,color:'rgba(255,255,255,0.6)',marginBottom:24}}>¿Cuántas llamadas pierdes al día?</p>
      <div style={{display:'flex',alignItems:'center',gap:16,justifyContent:'center',marginBottom:8}}>
        <span style={{fontSize:14,color:'rgba(255,255,255,0.3)'}}>1</span>
        <input
          type="range"
          min={1}
          max={20}
          value={calls}
          onChange={e => setCalls(Number(e.target.value))}
          style={{width:280,accentColor:'#F0A84E',cursor:'pointer'}}
        />
        <span style={{fontSize:14,color:'rgba(255,255,255,0.3)'}}>20</span>
      </div>
      <p style={{fontSize:40,fontWeight:800,color:'#F0A84E',letterSpacing:'-0.04em',marginBottom:4}}>
        {calls} llamadas/día
      </p>
      <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:12,padding:'16px 20px',marginBottom:24,marginTop:16}}>
        <p style={{fontSize:14,color:'rgba(255,255,255,0.5)',marginBottom:4}}>Estás perdiendo aproximadamente</p>
        <p style={{fontSize:36,fontWeight:800,color:'#F87171',letterSpacing:'-0.03em'}}>{lost.toLocaleString('es-ES')}€<span style={{fontSize:16,fontWeight:500,color:'rgba(255,255,255,0.35)'}}>/mes</span></p>
        <p style={{fontSize:12,color:'rgba(255,255,255,0.3)',marginTop:6}}>Basado en un ingreso medio de 45€ por reserva</p>
      </div>
      <Link href="/registro" className="btn-primary" style={{display:'inline-block',padding:'14px 32px',fontSize:15,borderRadius:12,boxShadow:'0 6px 24px rgba(240,168,78,0.35)'}}>
        Recuperalas con Reservo para tu restaurante →
      </Link>
    </div>
  )
}

/* ─── MAIN PAGE ─── */
export default function HomePage() {
  const C = {
    bg:'#090C13', card:'rgba(255,255,255,0.03)', border:'rgba(255,255,255,0.07)',
    text:'#E8EEF6', muted:'rgba(255,255,255,0.45)', amber:'#F0A84E', teal:'#2DD4BF',
    red:'#F87171', green:'#34D399', blue:'#60A5FA'
  }
  return (
    <main style={{fontFamily:"'Sora','DM Sans',-apple-system,sans-serif",background:C.bg,color:C.text,lineHeight:1.5,overflowX:'hidden'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::selection{background:rgba(240,168,78,0.3)}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(240,168,78,0.15)}50%{box-shadow:0 0 40px rgba(240,168,78,0.35)}}
        @keyframes ring{0%{transform:scale(1);opacity:1}100%{transform:scale(2.2);opacity:0}}
        @keyframes slideRight{from{width:0}to{width:100%}}
        .btn-primary{background:linear-gradient(135deg,#F0A84E,#E8943A);color:#0A0D14;font-weight:700;border:none;cursor:pointer;transition:all 0.2s;letter-spacing:-0.01em}
        .btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(240,168,78,0.4)!important}
        .btn-ghost{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.8);border:1px solid rgba(255,255,255,0.1);cursor:pointer;transition:all 0.2s;font-weight:500}
        .btn-ghost:hover{background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2)}
        .card-hover{transition:all 0.25s}
        .card-hover:hover{transform:translateY(-4px);border-color:rgba(240,168,78,0.25)!important;box-shadow:0 12px 40px rgba(0,0,0,0.4)!important}
        .plan-card:hover{transform:translateY(-6px)}
        a{text-decoration:none;color:inherit}
        .hero-mobile-cta{display:none}
        @media(max-width:768px){
          .hero-grid{grid-template-columns:1fr!important}
          .hero-right{display:none!important}
          .hero-mobile-cta{display:block!important}
          .prob-grid{grid-template-columns:1fr!important}
          .steps-grid{grid-template-columns:1fr!important}
          .price-grid{grid-template-columns:1fr!important}
          .feat-grid{grid-template-columns:1fr 1fr!important}
          .intel-grid{grid-template-columns:1fr!important}
          .adapt-grid{grid-template-columns:1fr!important}
          .trust-grid{grid-template-columns:1fr!important}
          .compare-grid{grid-template-columns:1fr!important}
          .channel-grid{grid-template-columns:1fr!important}
          .central-grid{grid-template-columns:1fr!important}
          .stats-grid{grid-template-columns:repeat(2,1fr)!important}
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{position:'fixed',top:0,left:0,right:0,zIndex:100,background:'rgba(9,12,19,0.85)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'0 clamp(16px,5vw,64px)',height:62,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:32,height:32,background:'linear-gradient(135deg,#F0A84E,#E8943A)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(240,168,78,0.35)',animation:'glow 3s ease-in-out infinite'}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#0A0D14"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
          </div>
          <span style={{fontWeight:700,fontSize:16,letterSpacing:'-0.02em',color:C.text}}>Reservo<span style={{color:C.amber}}>.AI</span></span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <Link href="#demo" className="btn-ghost" style={{padding:'7px 14px',fontSize:13,borderRadius:8,display:'inline-block'}}>Escuchar demo</Link>
          <Link href="/login" className="btn-ghost" style={{padding:'7px 18px',fontSize:13,borderRadius:8,display:'inline-block'}}>Iniciar sesión</Link>
          <Link href="/registro" className="btn-primary" style={{padding:'8px 20px',fontSize:13,borderRadius:8,display:'inline-block',boxShadow:'0 4px 16px rgba(240,168,78,0.3)'}}>Empieza con tu restaurante →</Link>
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          1. HERO — Impacto inmediato + multicanal natural
         ══════════════════════════════════════════ */}
      <section style={{minHeight:'100vh',display:'grid',gridTemplateColumns:'1fr 1fr',gap:60,alignItems:'center',padding:'100px clamp(16px,5vw,64px) 60px',maxWidth:1200,margin:'0 auto'}} className="hero-grid">
        {/* LEFT */}
        <div style={{animation:'fadeUp 0.8s ease forwards'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(240,168,78,0.1)',border:'1px solid rgba(240,168,78,0.25)',borderRadius:20,padding:'5px 14px',marginBottom:30}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:C.amber,animation:'pulse 1.5s ease-in-out infinite'}}/>
            <span style={{fontSize:11.5,fontWeight:600,color:C.amber,letterSpacing:'0.06em'}}>RESPONDIENDO CLIENTES AHORA MISMO</span>
          </div>
          <h1 style={{fontSize:'clamp(36px,4.5vw,58px)',fontWeight:800,letterSpacing:'-0.04em',lineHeight:1.08,marginBottom:24,color:C.text}}>
            Tu restaurante,<br/>gestionado por<br/>
            <span style={{background:'linear-gradient(135deg,#F0A84E,#E8923A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>inteligencia artificial</span>
          </h1>
          <p style={{fontSize:17,color:C.muted,lineHeight:1.75,marginBottom:12,maxWidth:520}}>
            Reservas, pedidos, llamadas y gestion diaria — <strong style={{color:C.text}}>todo automatizado para restaurantes, bares y cafeterias.</strong>
          </p>
          <p style={{fontSize:15.5,color:C.text,fontWeight:600,marginBottom:14,padding:'12px 0',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
            No importa como te contacten. Siempre respondes.
          </p>
          <p style={{fontSize:13,color:C.teal,marginBottom:36,fontStyle:'italic'}}>
            Proximamente para clinicas, gimnasios, peluquerias y mas sectores
          </p>
          <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:40}}>
            <Link href="/registro" className="btn-primary" style={{padding:'14px 32px',fontSize:15,borderRadius:12,display:'inline-block',boxShadow:'0 6px 24px rgba(240,168,78,0.35)'}}>
              Empieza con tu restaurante →
            </Link>
            <Link href="#demo" className="btn-ghost" style={{padding:'14px 24px',fontSize:14,borderRadius:12,display:'inline-block'}}>
              Escuchar cómo responde
            </Link>
          </div>
          <div style={{display:'flex',gap:28,flexWrap:'wrap'}}>
            {[['0€','sin tarjeta'],['< 2s','tiempo respuesta'],['24/7','todos los canales']].map(([n,l])=>(
              <div key={l}>
                <p style={{fontSize:22,fontWeight:700,color:C.amber,letterSpacing:'-0.03em'}}>{n}</p>
                <p style={{fontSize:12,color:'rgba(255,255,255,0.35)',fontWeight:500,marginTop:1}}>{l}</p>
              </div>
            ))}
          </div>
          {/* Mobile mini-panel — visible only on mobile */}
          <div className="hero-mobile-cta" style={{marginTop:32,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'18px 20px'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:C.teal,animation:'pulse 1.5s ease-in-out infinite'}}/>
              <span style={{fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.5)',letterSpacing:'0.04em'}}>RECEPCIONISTA EN LÍNEA</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[
                {icon:'📞',text:'Llamada entrante → Reserva confirmada para 4 personas',time:'hace 2s'},
                {icon:'💬',text:'WhatsApp → "¿Tienen mesa hoy?" → Confirmado',time:'hace 5s'},
                {icon:'📧',text:'Email respondido → Presupuesto enviado',time:'hace 12s'},
              ].map(({icon,text,time})=>(
                <div key={text} style={{display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:10,padding:'8px 12px'}}>
                  <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:12,color:'#E8EEF6',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{text}</p>
                    <p style={{fontSize:10,color:'rgba(255,255,255,0.25)',marginTop:1}}>{time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* RIGHT — LIVE PANEL */}
        <div className="hero-right" style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:20,overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,0.6)',animation:'fadeUp 0.8s ease 0.2s both'}}>
          {/* Panel header */}
          <div style={{background:'rgba(255,255,255,0.03)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'12px 18px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',gap:5}}>
              {['#F87171','#FBBF24','#4ADE80'].map(c=><div key={c} style={{width:10,height:10,borderRadius:'50%',background:c,opacity:0.7}}/>)}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:C.teal,animation:'pulse 1.5s ease-in-out infinite'}}/>
              <span style={{fontSize:11,color:'rgba(255,255,255,0.4)',letterSpacing:'0.05em',fontWeight:500}}>TU RECEPCIONISTA EN LÍNEA</span>
            </div>
          </div>
          {/* Tabs */}
          <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
            {['Llamada en curso','Actividad en vivo'].map((t,i)=>(
              <div key={t} style={{flex:1,padding:'10px',textAlign:'center',fontSize:12,fontWeight:i===0?600:400,color:i===0?C.amber:'rgba(255,255,255,0.3)',borderBottom:i===0?`2px solid ${C.amber}`:'2px solid transparent',cursor:'pointer'}}>
                {t}
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0}}>
            {/* Call sim */}
            <div style={{borderRight:'1px solid rgba(255,255,255,0.06)',padding:'14px 16px',height:320,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,flexShrink:0}}>
                <div style={{position:'relative'}}>
                  <div style={{width:28,height:28,borderRadius:'50%',background:'rgba(248,113,113,0.15)',border:'1px solid rgba(248,113,113,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill={C.red}><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                  </div>
                  <div style={{position:'absolute',inset:-3,borderRadius:'50%',border:'1px solid rgba(248,113,113,0.4)',animation:'ring 1.5s ease-out infinite'}}/>
                </div>
                <div>
                  <p style={{fontSize:11.5,color:C.text,fontWeight:600}}>Llamada activa</p>
                  <p style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>Decidiendo en tiempo real</p>
                </div>
              </div>
              <CallSim />
            </div>
            {/* Live feed */}
            <div style={{padding:'14px 16px',height:320,overflow:'hidden'}}>
              <p style={{fontSize:11,color:'rgba(255,255,255,0.3)',letterSpacing:'0.05em',fontWeight:500,marginBottom:10}}>DECISIONES AUTOMÁTICAS</p>
              <LiveFeed />
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTORES ── */}
      <div style={{padding:'20px clamp(16px,5vw,64px) 48px',maxWidth:1200,margin:'0 auto'}}>
        <p style={{textAlign:'center',fontSize:12,color:'rgba(255,255,255,0.25)',letterSpacing:'0.08em',fontWeight:500,marginBottom:20}}>SECTORES DISPONIBLES Y PROXIMAMENTE</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:10,justifyContent:'center'}}>
          {[
            {s:'🍽️ Restaurantes',active:true},{s:'🍺 Bares',active:true},{s:'☕ Cafeterias',active:true},
            {s:'💇 Peluquerias',active:false},{s:'🏥 Clinicas',active:false},{s:'🦷 Dentistas',active:false},{s:'🔧 Talleres',active:false},
            {s:'⚖️ Asesorias',active:false},{s:'🏋️ Gimnasios',active:false},{s:'💆 Spas',active:false},
            {s:'🏠 Inmobiliarias',active:false},{s:'🐾 Veterinarias',active:false},{s:'📦 Transportistas',active:false},{s:'🎓 Academias',active:false},
            {s:'🛒 Ecommerce',active:false},{s:'🏨 Hoteles',active:false},{s:'🚗 Concesionarios',active:false},{s:'🧹 Limpieza',active:false},
            {s:'📸 Fotografia',active:false},{s:'🎨 Diseno',active:false},{s:'🏗️ Reformas',active:false},{s:'💻 Informatica',active:false},
          ].map(({s,active})=>(
            <div key={s} style={{background:active?'rgba(52,211,153,0.08)':'rgba(255,255,255,0.03)',border:active?'1px solid rgba(52,211,153,0.3)':'1px solid rgba(255,255,255,0.07)',borderRadius:20,padding:'7px 16px',fontSize:13,color:active?'#34D399':'rgba(255,255,255,0.3)',fontWeight:500,whiteSpace:'nowrap',opacity:active?1:0.4,display:'flex',alignItems:'center',gap:6}}>
              {s}
              {active
                ? <span style={{fontSize:10,background:'rgba(52,211,153,0.15)',color:'#34D399',padding:'1px 8px',borderRadius:10,fontWeight:600}}>Disponible</span>
                : <span style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>Proximamente</span>
              }
            </div>
          ))}
        </div>
      </div>

      {/* ── STATS BAR ── */}
      <div style={{background:'rgba(240,168,78,0.05)',borderTop:'1px solid rgba(240,168,78,0.1)',borderBottom:'1px solid rgba(240,168,78,0.1)',padding:'28px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1200,margin:'0 auto',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:24,textAlign:'center'}} className="stats-grid">
          {[
            {n:'100%', s:'mensajes atendidos', t:'Llamadas, WhatsApp, emails. Todos.'},
            {n:'+35%', s:'más reservas', t:'Clientes que antes se perdían'},
            {n:'2s', s:'tiempo de respuesta', t:'Tu cliente nunca espera'},
            {n:'24/7', s:'siempre disponible', t:'Festivos, noches, fines de semana'},
          ].map(({n,s,t})=>(
            <div key={s}>
              <p style={{fontSize:32,fontWeight:800,color:C.amber,letterSpacing:'-0.04em'}}>{n}</p>
              <p style={{fontSize:13,color:C.text,fontWeight:600,marginTop:2}}>{s}</p>
              <p style={{fontSize:11.5,color:'rgba(255,255,255,0.3)',marginTop:3}}>{t}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── ROI CALCULATOR ── */}
      <section style={{padding:'48px clamp(16px,5vw,64px)',maxWidth:700,margin:'0 auto'}}>
        <ROICalculator />
      </section>

      {/* ══════════════════════════════════════════
          1.5 FUNCIONALIDADES — Feature cards con stagger
         ══════════════════════════════════════════ */}
      <section style={{padding:'90px clamp(16px,5vw,64px)',maxWidth:1200,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:56}}>
          <p style={{fontSize:12,fontWeight:600,color:C.amber,letterSpacing:'0.08em',marginBottom:12}}>TODO LO QUE NECESITAS</p>
          <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
            Un sistema completo.<br/>
            <span style={{background:'linear-gradient(135deg,#F0A84E,#E8923A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>Todo integrado.</span>
          </h2>
          <p style={{fontSize:16,color:C.muted,maxWidth:560,margin:'0 auto'}}>
            No necesitas 5 herramientas distintas. Reservo centraliza todo lo que tu negocio necesita para funcionar sin fricción.
          </p>
        </div>
        <style>{`
          @keyframes featIn{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
          .feat-card{animation:featIn 0.6s ease both}
          .feat-card:nth-child(1){animation-delay:0s}
          .feat-card:nth-child(2){animation-delay:0.08s}
          .feat-card:nth-child(3){animation-delay:0.16s}
          .feat-card:nth-child(4){animation-delay:0.24s}
          .feat-card:nth-child(5){animation-delay:0.32s}
          .feat-card:nth-child(6){animation-delay:0.40s}
        `}</style>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}} className="feat-grid">
          {[
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F0A84E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/>
                </svg>
              ),
              title: 'Reservas de mesas',
              body: 'Gestiona reservas de mesas y comensales desde cualquier canal. Ofrece alternativas de horario, detecta conflictos y confirma al instante.',
              color: 'rgba(240,168,78,0.1)', bc: 'rgba(240,168,78,0.2)', accent: C.amber,
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/>
                </svg>
              ),
              title: 'Pedidos de carta y domicilio',
              body: 'Recibe pedidos de tu carta para recoger o a domicilio. Todo actualizado en tiempo real sin intermediarios ni comisiones.',
              color: 'rgba(45,212,191,0.1)', bc: 'rgba(45,212,191,0.2)', accent: C.teal,
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/>
                </svg>
              ),
              title: 'Agente de voz IA',
              body: 'Responde llamadas como una persona real. Entiende contexto, toma decisiones y no necesita descanso.',
              color: 'rgba(167,139,250,0.1)', bc: 'rgba(167,139,250,0.2)', accent: '#A78BFA',
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              ),
              title: 'Control de sala y equipo',
              body: 'Horarios, turnos de sala y cocina y disponibilidad de tu equipo organizados. Cada persona sabe lo que le toca.',
              color: 'rgba(96,165,250,0.1)', bc: 'rgba(96,165,250,0.2)', accent: '#60A5FA',
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 20V10M12 20V4M6 20v-6"/>
                </svg>
              ),
              title: 'Estadisticas de tu local',
              body: 'Visualiza el rendimiento de tu restaurante de un vistazo. Llamadas, reservas de mesas, tendencias y oportunidades.',
              color: 'rgba(52,211,153,0.1)', bc: 'rgba(52,211,153,0.2)', accent: '#34D399',
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              ),
              title: 'Memoria de comensales',
              body: 'Cada comensal queda registrado con su historial, alergias, preferencias de mesa y notas. Atiendes mejor sin esfuerzo.',
              color: 'rgba(248,113,113,0.1)', bc: 'rgba(248,113,113,0.2)', accent: '#F87171',
            },
          ].map(({icon,title,body,color,bc,accent})=>(
            <div key={title} className="feat-card card-hover" style={{background:color,border:`1px solid ${bc}`,borderRadius:16,padding:'28px 24px'}}>
              <div style={{width:52,height:52,borderRadius:14,background:'rgba(255,255,255,0.04)',border:`1px solid ${bc}`,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:18}}>
                {icon}
              </div>
              <h3 style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:10,letterSpacing:'-0.02em'}}>{title}</h3>
              <p style={{fontSize:13.5,color:C.muted,lineHeight:1.65}}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          2. MULTICANAL — Integración natural
         ══════════════════════════════════════════ */}
      <section style={{padding:'90px clamp(16px,5vw,64px)',maxWidth:1200,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:56}}>
          <p style={{fontSize:12,fontWeight:600,color:C.teal,letterSpacing:'0.08em',marginBottom:12}}>SIEMPRE DISPONIBLE</p>
          <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
            Da igual cómo te contacten.<br/>
            <span style={{color:C.amber}}>Siempre hay alguien al otro lado.</span>
          </h2>
          <p style={{fontSize:16,color:C.muted,maxWidth:560,margin:'0 auto'}}>
            Mientras tú trabajas, esto responde. Por teléfono, por WhatsApp, por email. Cada cliente recibe una respuesta inmediata, personalizada y con criterio.
          </p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}} className="channel-grid">
          {[
            {
              icon:'📞',title:'Si llaman, responde',
              body:'Atiende cada llamada en menos de 2 segundos. Entiende lo que necesitan, ofrece alternativas y confirma reservas. Como la mejor persona de tu equipo, pero sin descanso.',
              example:'Cliente llama a las 23:00 un domingo → Reserva confirmada para el lunes.',
              color:'rgba(240,168,78,0.1)',bc:'rgba(240,168,78,0.2)'
            },
            {
              icon:'💬',title:'Si escriben, responde',
              body:'WhatsApp es el primer canal de contacto para millones de clientes. Responde al instante, gestiona reservas y resuelve dudas con la misma inteligencia que por teléfono.',
              example:'"¿Tienen hueco mañana a las 17:00?" → Reserva confirmada en 3 mensajes.',
              color:'rgba(45,212,191,0.1)',bc:'rgba(45,212,191,0.2)'
            },
            {
              icon:'📧',title:'Si preguntan, responde',
              body:'Emails, consultas, presupuestos. Responde con contexto, adjunta información relevante y cierra la gestión. Sin que nadie de tu equipo tenga que abrir la bandeja de entrada.',
              example:'Email pidiendo información de precios → Respuesta personalizada en 30 segundos.',
              color:'rgba(96,165,250,0.1)',bc:'rgba(96,165,250,0.2)'
            },
          ].map(({icon,title,body,example,color,bc})=>(
            <div key={title} className="card-hover" style={{background:color,border:`1px solid ${bc}`,borderRadius:16,padding:'28px 24px'}}>
              <span style={{fontSize:32,display:'block',marginBottom:16}}>{icon}</span>
              <h3 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,letterSpacing:'-0.02em'}}>{title}</h3>
              <p style={{fontSize:13.5,color:C.muted,lineHeight:1.65,marginBottom:16}}>{body}</p>
              <div style={{background:'rgba(255,255,255,0.04)',borderRadius:10,padding:'10px 14px',borderLeft:`3px solid ${C.amber}`,fontSize:12.5,color:'rgba(255,255,255,0.5)',fontStyle:'italic',lineHeight:1.5}}>
                {example}
              </div>
            </div>
          ))}
        </div>
        <div style={{marginTop:40,textAlign:'center'}}>
          <p style={{fontSize:18,fontWeight:700,color:C.text,lineHeight:1.6}}>
            Responde, entiende y actúa. <span style={{color:C.amber}}>Sin importar el canal.</span>
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          3. DEMO — Ejemplo real
         ══════════════════════════════════════════ */}
      <section id="demo" style={{background:'rgba(255,255,255,0.015)',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1200,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:56}}>
            <p style={{fontSize:12,fontWeight:600,color:C.teal,letterSpacing:'0.08em',marginBottom:12}}>ESCUCHA LA DIFERENCIA</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
              No sigue un guion.<br/>
              <span style={{color:C.amber}}>Entiende, decide y resuelve.</span>
            </h2>
            <p style={{fontSize:16,color:C.muted,maxWidth:580,margin:'0 auto'}}>
              No repite respuestas. Escucha lo que necesita tu cliente y actúa como alguien de tu equipo. Pruébalo tú mismo.
            </p>
          </div>

          {/* Live demo widget */}
          <DemoWidget />

          {/* Demo scenarios */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}} className="prob-grid">
            {[
              {
                icon:'🍽️',
                situation:'No hay mesa a las 21:00',
                decision:'Ofrece 21:30 o 22:00 automáticamente',
                detail:'No dice "no hay disponibilidad". Busca la mejor alternativa y la ofrece al momento.',
                color:'rgba(240,168,78,0.1)',bc:'rgba(240,168,78,0.2)',tag:'DECIDE'
              },
              {
                icon:'👤',
                situation:'Llama un cliente habitual',
                decision:'Lo reconoce y le ofrece su mesa de siempre',
                detail:'Sabe quién es, qué prefiere y cómo tratarlo. Como lo haría tu mejor empleado.',
                color:'rgba(45,212,191,0.1)',bc:'rgba(45,212,191,0.2)',tag:'RECUERDA'
              },
              {
                icon:'⚠️',
                situation:'Petición especial o fuera de lo normal',
                decision:'Te avisa con todo el contexto',
                detail:'No inventa ni improvisa. Si algo se sale de lo habitual, te pasa el aviso para que decidas tú.',
                color:'rgba(167,139,250,0.1)',bc:'rgba(167,139,250,0.2)',tag:'AVISA'
              },
            ].map(({icon,situation,decision,detail,color,bc,tag})=>(
              <div key={situation} className="card-hover" style={{background:color,border:`1px solid ${bc}`,borderRadius:16,padding:'28px 24px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                  <span style={{fontSize:32}}>{icon}</span>
                  <span style={{fontSize:10,fontWeight:700,color:C.amber,letterSpacing:'0.1em',background:'rgba(240,168,78,0.15)',padding:'3px 10px',borderRadius:20}}>{tag}</span>
                </div>
                <p style={{fontSize:13,color:'rgba(255,255,255,0.4)',fontWeight:500,marginBottom:6}}>Situación:</p>
                <h3 style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:12,letterSpacing:'-0.02em'}}>{situation}</h3>
                <div style={{background:'rgba(255,255,255,0.05)',borderRadius:10,padding:'12px 14px',marginBottom:14,borderLeft:`3px solid ${C.amber}`}}>
                  <p style={{fontSize:13,fontWeight:600,color:C.amber}}>→ {decision}</p>
                </div>
                <p style={{fontSize:13.5,color:C.muted,lineHeight:1.65}}>{detail}</p>
              </div>
            ))}
          </div>

          {/* Decision summary */}
          <div style={{marginTop:40,background:'rgba(45,212,191,0.06)',border:'1px solid rgba(45,212,191,0.15)',borderRadius:16,padding:'24px 32px',textAlign:'center'}}>
            <p style={{fontSize:17,fontWeight:600,color:'rgba(255,255,255,0.85)',lineHeight:1.6}}>
              No responde siempre igual. <span style={{color:C.teal,fontWeight:800}}>Sabe qué hacer en cada situación.</span>
            </p>
            <p style={{fontSize:14,color:C.muted,marginTop:8}}>
              Sin intervención humana. Sin esperas. Sin errores.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          3.5 SOCIAL PROOF — Confianza real (moved earlier for conversion)
         ══════════════════════════════════════════ */}
      <section style={{padding:'80px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1000,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <p style={{fontSize:12,fontWeight:600,color:C.amber,letterSpacing:'0.08em',marginBottom:12}}>NEGOCIOS QUE YA CONFÍAN</p>
            <h2 style={{fontSize:'clamp(24px,3vw,38px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15}}>
              Lo dicen ellos, no nosotros.
            </h2>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}} className="prob-grid">
            {[
              {name:'Carlos M.',role:'Restaurante La Terraza',text:'Desde que pusimos Reservo no hemos perdido ni una reserva de mesa. Antes se nos escapaban 5-6 llamadas al dia en hora punta.',stars:5},
              {name:'Laura G.',role:'Bar de tapas El Rincon',text:'Nuestros clientes creen que tenemos a alguien nuevo en recepcion. No saben que es IA y eso dice mucho de la calidad.',stars:5},
              {name:'Miguel R.',role:'Cafeteria Central',text:'Lo mejor es que responde fuera de horario. El 40% de mis reservas ahora entran por la noche o los fines de semana cuando estamos cerrados.',stars:5},
            ].map(({name,role,text,stars})=>(
              <div key={name} style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'28px 24px'}}>
                <div style={{display:'flex',gap:2,marginBottom:14}}>
                  {Array.from({length:stars}).map((_,i)=>(
                    <span key={i} style={{color:C.amber,fontSize:14}}>★</span>
                  ))}
                </div>
                <p style={{fontSize:14,color:'rgba(255,255,255,0.7)',lineHeight:1.65,marginBottom:20,fontStyle:'italic'}}>"{text}"</p>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(240,168,78,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:C.amber}}>
                    {name[0]}
                  </div>
                  <div>
                    <p style={{fontSize:13,fontWeight:600,color:C.text}}>{name}</p>
                    <p style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',justifyContent:'center',gap:40,marginTop:40,flexWrap:'wrap'}}>
            {[
              {n:'+200',s:'negocios activos'},
              {n:'+15.000',s:'llamadas gestionadas'},
              {n:'4.9/5',s:'satisfacción media'},
              {n:'< 2s',s:'tiempo de respuesta'},
            ].map(({n,s})=>(
              <div key={s} style={{textAlign:'center'}}>
                <p style={{fontSize:22,fontWeight:800,color:C.amber,letterSpacing:'-0.03em'}}>{n}</p>
                <p style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:2,fontWeight:500}}>{s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          4. INTELIGENCIA REAL — No responde. Decide.
         ══════════════════════════════════════════ */}
      <section style={{padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1200,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:56}}>
            <p style={{fontSize:12,fontWeight:600,color:C.amber,letterSpacing:'0.08em',marginBottom:12}}>INTELIGENCIA REAL</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
              No responde. Decide.<br/>
              <span style={{color:C.amber}}>Piensa antes de actuar.</span>
            </h2>
            <p style={{fontSize:16,color:C.muted,maxWidth:520,margin:'0 auto'}}>
              La diferencia entre un bot y tu recepcionista es simple: un bot sigue instrucciones. Tu recepcionista entiende lo que está pasando y actúa en consecuencia.
            </p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:20}} className="intel-grid">
            {[
              {
                icon:'👂',title:'Escucha de verdad',
                body:'No busca palabras clave. Entiende lo que el cliente quiere decir, aunque lo diga de mil formas distintas.',
                example:'"Quiero algo rápido para comer" → entiende menú express, no comida para llevar.',
                color:'rgba(167,139,250,0.12)',bc:'rgba(167,139,250,0.2)'
              },
              {
                icon:'🧠',title:'Cruza información',
                body:'Disponibilidad, reglas de tu negocio, historial del cliente. Todo en menos de un segundo. Propone alternativas cuando algo no encaja.',
                example:'Grupo de 8 + terraza ocupada → sugiere salón privado automáticamente.',
                color:'rgba(240,168,78,0.1)',bc:'rgba(240,168,78,0.2)'
              },
              {
                icon:'✅',title:'Actúa con criterio',
                body:'Si puede resolverlo, lo resuelve. Si necesita tu atención, te avisa. Sabe cuándo actuar solo y cuándo preguntar.',
                example:'Petición fuera de horario → no dice "no se puede". Ofrece la mejor alternativa.',
                color:'rgba(45,212,191,0.1)',bc:'rgba(45,212,191,0.2)'
              },
              {
                icon:'📚',title:'Cada día mejor',
                body:'Cada interacción la hace más inteligente. Tus preferencias, tus excepciones, tu forma de tratar al cliente. Aprende y mejora.',
                example:'Cliente habitual llama → lo reconoce y le ofrece su mesa de siempre.',
                color:'rgba(74,222,128,0.1)',bc:'rgba(74,222,128,0.2)'
              },
            ].map(({icon,title,body,example,color,bc})=>(
              <div key={title} className="card-hover" style={{background:color,border:`1px solid ${bc}`,borderRadius:16,padding:'28px 24px'}}>
                <span style={{fontSize:32,display:'block',marginBottom:16}}>{icon}</span>
                <h3 style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:10,letterSpacing:'-0.02em'}}>{title}</h3>
                <p style={{fontSize:13.5,color:C.muted,lineHeight:1.65,marginBottom:16}}>{body}</p>
                <div style={{background:'rgba(255,255,255,0.04)',borderRadius:10,padding:'10px 14px',borderLeft:`3px solid ${C.amber}`,fontSize:12.5,color:'rgba(255,255,255,0.5)',fontStyle:'italic',lineHeight:1.5}}>
                  {example}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          5. INCLUSO SI NO TIENES MUCHAS LLAMADAS
         ══════════════════════════════════════════ */}
      <section style={{background:'rgba(255,255,255,0.015)',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1000,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:56}}>
            <p style={{fontSize:12,fontWeight:600,color:C.green,letterSpacing:'0.08em',marginBottom:12}}>PARA RESTAURANTES, BARES Y CAFETERÍAS</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
              "No recibo tantas llamadas"<br/>
              <span style={{color:C.amber}}>No necesitas muchas para perder dinero.</span>
            </h2>
            <p style={{fontSize:16,color:C.muted,maxWidth:560,margin:'0 auto',lineHeight:1.7}}>
              Basta con una llamada perdida a la semana para que un cliente elija a otro. Basta con un WhatsApp sin respuesta para que no vuelvan a escribirte.
            </p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:20}} className="central-grid">
            {[
              {icon:'🕐',title:'Responde cuando tú no puedes',body:'Estás cortando el pelo. Estás con un paciente. Estás conduciendo. Da igual. Tu cliente recibe respuesta igualmente.'},
              {icon:'✨',title:'Da imagen profesional',body:'Un negocio que responde siempre transmite seriedad. Tu cliente siente que hay un equipo detrás, aunque seas tú solo.'},
              {icon:'💰',title:'No pierdes ni una oportunidad',body:'Ese cliente que llamó el sábado a las 14:00 mientras comías. Esa consulta por WhatsApp a las 22:00. Ahora se resuelven solas.'},
              {icon:'📋',title:'Organiza todo sin que hagas nada',body:'Cada cliente, cada cita, cada conversación queda registrada y organizada. Sin post-its, sin cuadernos, sin caos.'},
            ].map(({icon,title,body})=>(
              <div key={title} style={{display:'flex',alignItems:'flex-start',gap:16,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'28px 24px'}}>
                <div style={{width:48,height:48,borderRadius:12,background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>
                  {icon}
                </div>
                <div>
                  <h3 style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:8,letterSpacing:'-0.01em'}}>{title}</h3>
                  <p style={{fontSize:13.5,color:C.muted,lineHeight:1.65}}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          6. TODO EN UN SOLO SITIO
         ══════════════════════════════════════════ */}
      <section style={{padding:'90px clamp(16px,5vw,64px)',maxWidth:1200,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:56}}>
          <p style={{fontSize:12,fontWeight:600,color:C.blue,letterSpacing:'0.08em',marginBottom:12}}>CONTROL TOTAL</p>
          <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
            Todo en un solo sitio.<br/>
            <span style={{color:C.amber}}>Sin cambiar entre apps.</span>
          </h2>
          <p style={{fontSize:16,color:C.muted,maxWidth:560,margin:'0 auto'}}>
            Clientes, conversaciones, reservas, historial. Todo lo que necesitas para tener tu negocio bajo control, en un solo panel.
          </p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}} className="intel-grid">
          {[
            {icon:'👥',title:'Todos tus clientes',body:'Cada persona que te contacta queda registrada. Nombre, historial, preferencias. Sin que tengas que apuntar nada.'},
            {icon:'💬',title:'Todas las conversaciones',body:'Llamadas, WhatsApp, emails. Todo en el mismo sitio. Sabes qué se habló, cuándo y con quién.'},
            {icon:'📅',title:'Todas las reservas',body:'Agenda completa y actualizada en tiempo real. Creadas automáticamente desde cualquier canal.'},
            {icon:'📊',title:'Todo el control',body:'Estadísticas, actividad, rendimiento. Ves exactamente qué está pasando en tu negocio en cada momento.'},
          ].map(({icon,title,body})=>(
            <div key={title} className="card-hover" style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'24px 20px',textAlign:'center'}}>
              <div style={{width:52,height:52,borderRadius:14,background:'rgba(96,165,250,0.1)',border:'1px solid rgba(96,165,250,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,margin:'0 auto 16px'}}>
                {icon}
              </div>
              <h3 style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:8,letterSpacing:'-0.01em'}}>{title}</h3>
              <p style={{fontSize:13,color:C.muted,lineHeight:1.65}}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          7. ADAPTACIÓN A CADA NEGOCIO
         ══════════════════════════════════════════ */}
      <section style={{background:'rgba(255,255,255,0.015)',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1200,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:56}}>
            <p style={{fontSize:12,fontWeight:600,color:C.teal,letterSpacing:'0.08em',marginBottom:12}}>SE ADAPTA A TI</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
              Tu negocio es único.<br/>
              <span style={{color:C.amber}}>Tu recepcionista también.</span>
            </h2>
            <p style={{fontSize:16,color:C.muted,maxWidth:540,margin:'0 auto'}}>
              No todos los negocios trabajan igual. Tu recepcionista aprende cómo funciona el tuyo y responde como si llevara meses contigo.
            </p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}} className="adapt-grid">
            {[
              {
                icon:'🍽️',tipo:'Restaurantes',active:true,
                body:'Gestiona reservas, turnos, mesas especiales, alergias y grupos grandes sin perder una sola llamada.',
                ejemplo:'"Mesa en terraza para 2 el sabado" → comprueba disponibilidad y confirma al instante.'
              },
              {
                icon:'🍺',tipo:'Bares y pubs',active:true,
                body:'Reservas de mesas, eventos, grupos y gestiones diarias. Tu bar siempre atendido aunque estes detras de la barra.',
                ejemplo:'"Queremos reservar zona para 12 personas el viernes" → confirma y anota detalles.'
              },
              {
                icon:'☕',tipo:'Cafeterias',active:true,
                body:'Pedidos para recoger, reservas de espacio, encargos de reposteria y gestion de eventos. Todo automatizado.',
                ejemplo:'"Quiero encargar una tarta para el sabado" → recoge detalles y confirma el pedido.'
              },
              {
                icon:'💈',tipo:'Peluquerias y estetica',active:false,
                body:'Citas con el profesional correcto, duracion de cada servicio y reagendamientos. Todo automatico.',
                ejemplo:'"Quiero corte y color con Maria" → busca el primer hueco con Maria.'
              },
              {
                icon:'🏥',tipo:'Clinicas y consultas',active:false,
                body:'Citas con el especialista adecuado, urgencias filtradas y recordatorios para que nadie falte.',
                ejemplo:'"Necesito ver al Dr. Lopez esta semana" → revisa agenda y ofrece opciones reales.'
              },
              {
                icon:'🔧',tipo:'Talleres y servicios',active:false,
                body:'Presupuestos, citas para diagnostico y seguimiento de reparaciones. Sin llamadas de vuelta.',
                ejemplo:'"Mi coche hace un ruido al frenar" → agenda revision y anota el sintoma.'
              },
              {
                icon:'🏋️',tipo:'Gimnasios y centros',active:false,
                body:'Reservas de clases, informacion de horarios y gestion de pruebas gratuitas para nuevos clientes.',
                ejemplo:'"Hay yoga manana por la tarde?" → confirma horario y reserva plaza.'
              },
              {
                icon:'⚖️',tipo:'Asesorias y despachos',active:false,
                body:'Filtra consultas, agenda reuniones con el profesional adecuado y recoge la informacion antes de la cita.',
                ejemplo:'"Necesito consulta fiscal para autonomo" → agenda con el asesor fiscal disponible.'
              },
              {
                icon:'🏨',tipo:'Hoteles y alojamientos',active:false,
                body:'Disponibilidad de habitaciones, check-in, peticiones especiales y reservas directas sin comisiones de plataformas.',
                ejemplo:'"Tienen habitacion doble el puente de mayo?" → confirma disponibilidad y reserva.'
              },
            ].map(({icon,tipo,body,ejemplo,active})=>(
              <div key={tipo} className="card-hover" style={{background:active?'rgba(52,211,153,0.05)':'rgba(255,255,255,0.02)',border:active?'1px solid rgba(52,211,153,0.2)':'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'28px 24px',opacity:active?1:0.5,position:'relative'}}>
                {active && <span style={{position:'absolute',top:14,right:14,fontSize:10,fontWeight:700,color:'#34D399',background:'rgba(52,211,153,0.12)',padding:'3px 10px',borderRadius:20,letterSpacing:'0.04em'}}>Disponible</span>}
                {!active && <span style={{position:'absolute',top:14,right:14,fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.35)',background:'rgba(255,255,255,0.05)',padding:'3px 10px',borderRadius:20,letterSpacing:'0.04em'}}>Proximamente</span>}
                <span style={{fontSize:32,display:'block',marginBottom:14}}>{icon}</span>
                <h3 style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:10,letterSpacing:'-0.02em'}}>{tipo}</h3>
                <p style={{fontSize:13.5,color:C.muted,lineHeight:1.65,marginBottom:14}}>{body}</p>
                <div style={{background:'rgba(240,168,78,0.06)',borderRadius:10,padding:'10px 14px',fontSize:12.5,color:C.amber,lineHeight:1.5}}>
                  {ejemplo}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          8. CÓMO FUNCIONA — 3 pasos
         ══════════════════════════════════════════ */}
      <section style={{padding:'90px clamp(16px,5vw,64px)',maxWidth:1200,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:56}}>
          <p style={{fontSize:12,fontWeight:600,color:C.amber,letterSpacing:'0.08em',marginBottom:12}}>ASÍ DE FÁCIL</p>
          <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15}}>
            De cero a atender clientes<br/>
            <span style={{color:C.amber}}>en menos de lo que piensas</span>
          </h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:24,position:'relative'}} className="steps-grid">
          {[
            {
              n:'01',icon:'💬',title:'Nos explicas tu negocio',
              body:'Cuéntanos cómo trabajas: tus horarios, tus servicios, cómo te gusta tratar al cliente. Lo que le dirías a un nuevo empleado en su primer día.',
              time:'15 minutos de tu tiempo',
              color:'rgba(240,168,78,0.15)',bc:'rgba(240,168,78,0.3)'
            },
            {
              n:'02',icon:'⚙️',title:'Creamos tu recepcionista',
              body:'La configuramos para que responda exactamente como tú quieres. La probamos contigo hasta que suene perfecto. Llamadas, WhatsApp, email. Todo listo.',
              time:'Lista en 48 horas',
              color:'rgba(45,212,191,0.1)',bc:'rgba(45,212,191,0.2)'
            },
            {
              n:'03',icon:'✅',title:'Empieza a trabajar por ti',
              body:'Activamos tu recepcionista y empieza a atender clientes reales desde todos los canales. Tú solo te dedicas a lo tuyo.',
              time:'Desde el primer día',
              color:'rgba(74,222,128,0.1)',bc:'rgba(74,222,128,0.2)'
            },
          ].map(({n,icon,title,body,time,color,bc})=>(
            <div key={n}>
              <div className="card-hover" style={{background:color,border:`1px solid ${bc}`,borderRadius:20,padding:'32px 28px',height:'100%'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
                  <span style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.25)',letterSpacing:'0.1em'}}>{n}</span>
                  <span style={{fontSize:28}}>{icon}</span>
                </div>
                <h3 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,letterSpacing:'-0.02em',lineHeight:1.3}}>{title}</h3>
                <p style={{fontSize:14,color:C.muted,lineHeight:1.7,marginBottom:14}}>{body}</p>
                <p style={{fontSize:12,fontWeight:600,color:C.teal}}>{time}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ONBOARDING TIMELINE ── */}
      <section style={{padding:'0 clamp(16px,5vw,64px) 90px',maxWidth:700,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:40}}>
          <p style={{fontSize:12,fontWeight:600,color:'#2DD4BF',letterSpacing:'0.08em',marginBottom:12}}>TIMELINE REAL</p>
          <h3 style={{fontSize:'clamp(22px,2.5vw,32px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.2,color:'#E8EEF6'}}>
            De registrarte a estar en vivo
          </h3>
        </div>
        <div style={{position:'relative',paddingLeft:32}}>
          {/* Vertical line */}
          <div style={{position:'absolute',left:11,top:8,bottom:8,width:2,background:'rgba(240,168,78,0.2)',borderRadius:2}}/>
          {[
            {time:'Minuto 0',text:'Te registras y configuras tu negocio',color:'#F0A84E'},
            {time:'Hora 1',text:'Tu agente ya atiende llamadas de prueba',color:'#2DD4BF'},
            {time:'Día 2',text:'Activas el número real — estás en vivo',color:'#34D399'},
            {time:'Semana 1',text:'Primeros resultados y ajustes automáticos',color:'#60A5FA'},
          ].map(({time,text,color},i)=>(
            <div key={time} style={{display:'flex',alignItems:'flex-start',gap:20,marginBottom:i<3?32:0,position:'relative'}}>
              {/* Dot */}
              <div style={{position:'absolute',left:-32,top:4,width:24,height:24,borderRadius:'50%',background:`${color}18`,border:`2px solid ${color}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:color}}/>
              </div>
              <div>
                <p style={{fontSize:12,fontWeight:700,color,letterSpacing:'0.04em',marginBottom:4}}>{time.toUpperCase()}</p>
                <p style={{fontSize:15,color:'rgba(255,255,255,0.7)',fontWeight:500}}>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          9. EMPLEADO vs RESERVO — Comparación visual
         ══════════════════════════════════════════ */}
      <section style={{background:'rgba(255,255,255,0.015)',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:800,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <p style={{fontSize:12,fontWeight:600,color:C.red,letterSpacing:'0.08em',marginBottom:12}}>LA COMPARACIÓN</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:14}}>
              Lo que te cuesta no tener<br/>
              <span style={{color:C.amber}}>a alguien siempre disponible</span>
            </h2>
          </div>

          {/* Comparison headers */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,padding:'0 28px',marginBottom:8}} className="compare-grid">
            <div/>
            <p style={{fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.3)',textAlign:'center',letterSpacing:'0.06em'}}>EMPLEADO</p>
            <p style={{fontSize:12,fontWeight:600,color:C.amber,textAlign:'center',letterSpacing:'0.06em'}}>RESERVO.AI</p>
          </div>

          <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:20,padding:'8px 28px',overflow:'hidden'}}>
            {[
              {label:'Disponibilidad',employee:'8h/día, 5 días',reservo:'24h/día, 365 días'},
              {label:'Canales',employee:'Solo teléfono',reservo:'Llamadas + WhatsApp + Email'},
              {label:'Llamadas simultáneas',employee:'1 a la vez',reservo:'Ilimitadas'},
              {label:'Tiempo de respuesta',employee:'Depende',reservo:'< 2 segundos'},
              {label:'Vacaciones / bajas',employee:'30 días/año',reservo:'Nunca'},
              {label:'Errores por cansancio',employee:'Frecuentes',reservo:'0'},
              {label:'Coste mensual',employee:'1.500€ - 2.000€',reservo:'Desde 99€/mes'},
            ].map(({label,employee,reservo},i)=>(
              <div key={label} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,padding:'16px 0',borderBottom:i<6?'1px solid rgba(255,255,255,0.06)':'none',alignItems:'center'}} className="compare-grid">
                <p style={{fontSize:13.5,color:C.muted}}>{label}</p>
                <p style={{fontSize:13.5,color:'rgba(255,255,255,0.25)',textDecoration:'line-through',textAlign:'center'}}>{employee}</p>
                <p style={{fontSize:13.5,color:C.teal,fontWeight:700,textAlign:'center'}}>{reservo}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          10. PRECIOS
         ══════════════════════════════════════════ */}
      <section style={{padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <p style={{fontSize:12,fontWeight:600,color:C.amber,letterSpacing:'0.08em',marginBottom:12}}>PRECIOS</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:14}}>
              Menos que un empleado.<br/>
              <span style={{color:C.amber}}>Disponible todo el día, en todos los canales.</span>
            </h2>
            <p style={{fontSize:15,color:C.muted}}>Sin contratos. Sin permanencia. Pagas solo por lo que usas.</p>
          </div>

          {/* Guarantee badge */}
          <div style={{background:'rgba(52,211,153,0.06)',border:'1px solid rgba(52,211,153,0.15)',borderRadius:14,padding:'18px 28px',marginBottom:40,display:'flex',alignItems:'center',justifyContent:'center',gap:24,flexWrap:'wrap'}}>
            {['30 días de prueba gratis','Sin tarjeta','Cancela cuando quieras','Devolución garantizada'].map(t=>(
              <div key={t} style={{display:'flex',alignItems:'center',gap:7}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                <span style={{fontSize:13.5,color:'rgba(255,255,255,0.7)',fontWeight:500}}>{t}</span>
              </div>
            ))}
          </div>

          {/* Pricing cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20,alignItems:'start'}} className="price-grid">
            {[
              {plan:'Starter',price:'99',calls:'50 llamadas/mes',rate:'0,90€/llamada extra',features:['Recepcionista IA 24/7 con voz natural','Gestion de reservas de mesas automatica','Panel con actividad en tiempo real','Base de clientes con historial','Gestion de mesas y espacios','Control de turnos y equipo','Agenda y calendario','SMS de confirmacion y recordatorios','Adaptado a tu restaurante o bar','Soporte por email'],cta:'Configura tu restaurante',highlight:false},
              {plan:'Pro',price:'299',calls:'200 llamadas/mes',rate:'0,70€/llamada extra',features:['Todo lo de Starter +','Pedidos de carta por telefono','Entregas a domicilio con direccion','Estadisticas avanzadas (conversion, hora pico)','Sugerencias diarias de la IA','Aprendizaje automatico de patrones','Canal WhatsApp automatico','CRM avanzado (scoring, VIP, at-risk)','Exportacion de datos','Soporte prioritario'],cta:'Configura tu restaurante',highlight:true},
              {plan:'Business',price:'499',calls:'600 llamadas/mes',rate:'0,50€/llamada extra',features:['Todo lo de Pro +','Canal Email automatico','Gestion de proveedores e inventario','Auto-pedidos a proveedores (semanal)','Inteligencia de inventario y prediccion','Informes PDF (registro jornada laboral)','Multi-usuario','Soporte dedicado con respuesta rapida'],cta:'Configura tu restaurante',highlight:false},
            ].map(({plan,price,calls,rate,features,cta,highlight})=>(
              <div key={plan} className="plan-card" style={{
                background: highlight ? 'linear-gradient(135deg,rgba(240,168,78,0.08),rgba(240,168,78,0.03))' : 'rgba(255,255,255,0.02)',
                border: highlight ? `2px solid ${C.amber}` : '1px solid rgba(255,255,255,0.07)',
                borderRadius:20, padding:'32px 28px',
                boxShadow: highlight ? '0 0 60px rgba(240,168,78,0.12)' : 'none',
                transition:'all 0.3s', position:'relative', overflow:'hidden'
              }}>
                {highlight&&<div style={{position:'absolute',top:16,right:16,background:C.amber,color:'#0A0D14',fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,letterSpacing:'0.05em'}}>RECOMENDADO</div>}
                <p style={{fontSize:13,fontWeight:600,color:highlight?C.amber:'rgba(255,255,255,0.4)',letterSpacing:'0.04em',marginBottom:8}}>{plan.toUpperCase()}</p>
                <div style={{display:'flex',alignItems:'flex-end',gap:4,marginBottom:6}}>
                  <span style={{fontSize:48,fontWeight:800,color:C.text,letterSpacing:'-0.04em',lineHeight:1}}>{price}€</span>
                  <span style={{fontSize:14,color:C.muted,marginBottom:8}}>/mes</span>
                </div>
                <p style={{fontSize:13,fontWeight:600,color:highlight?C.amber:C.text,marginBottom:2}}>{calls}</p>
                <p style={{fontSize:12,color:'rgba(255,255,255,0.3)',marginBottom:24}}>{rate}</p>
                <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:28}}>
                  {features.map(f=>(
                    <div key={f} style={{display:'flex',alignItems:'center',gap:8}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={highlight?C.amber:'#4ADE80'}><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                      <span style={{fontSize:13,color:'rgba(255,255,255,0.7)'}}>{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/registro" className={highlight?'btn-primary':'btn-ghost'} style={{display:'block',textAlign:'center',padding:'12px',borderRadius:10,fontSize:14,fontWeight:600}}>
                  {highlight ? 'Prueba gratis para hosteleria →' : cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Usage-based note */}
          <div style={{marginTop:32,textAlign:'center'}}>
            <p style={{fontSize:13.5,color:C.muted,lineHeight:1.7}}>
              Precios sin IVA · Se aplica 21% IVA en el checkout · Facturación mensual
            </p>
            <p style={{fontSize:14,fontWeight:600,color:C.text,marginTop:8}}>
              Pagas solo por lo que usas. Sin sorpresas.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{background:'rgba(255,255,255,0.015)',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'80px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:800,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <h2 style={{fontSize:'clamp(24px,3vw,38px)',fontWeight:800,letterSpacing:'-0.03em'}}>Preguntas frecuentes</h2>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {[
              {q:'Solo funciona para restaurantes?',a:'Actualmente esta optimizado para restaurantes, bares y cafeterias. Estamos trabajando para anadir mas sectores como clinicas, gimnasios y peluquerias. Si quieres ser de los primeros en probarlo para tu sector, registrate y te avisamos.'},
              {q:'Suena como un robot?',a:'No. Habla de forma natural y mantiene conversaciones fluidas. Tus clientes no notaran la diferencia.'},
              {q:'¿Qué pasa si no sabe responder algo?',a:'Te avisa al momento con todo el contexto para que puedas intervenir tú. Nunca inventa respuestas.'},
              {q:'¿Cuánto tarda en estar lista?',a:'En 15 minutos nos explicas tu negocio. En 48 horas tu recepcionista está atendiendo clientes por todos los canales.'},
              {q:'¿Necesito cambiar mi número de teléfono?',a:'No. Desviamos las llamadas al sistema cuando tú no puedes contestar. Tu número sigue siendo el mismo.'},
              {q:'¿También responde WhatsApp y emails?',a:'Sí. Es una recepcionista completa. Da igual por dónde te contacten: responde con la misma inteligencia y personalización.'},
              {q:'¿De verdad decide por su cuenta?',a:'Sí. Conoce tu negocio: tus horarios, tus reglas, tus excepciones. No sigue un guion — actúa como una persona de tu equipo.'},
              {q:'¿Y si tengo pocas llamadas?',a:'Precisamente. Cada llamada cuenta más cuando tienes pocas. Una sola oportunidad perdida puede ser un cliente que no vuelve.'},
              {q:'¿Puedo cancelar cuando quiera?',a:'Sí, sin permanencia ni penalización. Es mes a mes.'},
              {q:'¿Y si la IA se equivoca?',a:'El agente escala a ti automáticamente si no tiene confianza. Tú decides el umbral.'},
              {q:'¿Se integra con mi sistema actual?',a:'Funciona con cualquier restaurante, bar o cafetería. Solo necesitas un número de teléfono. Próximamente más sectores.'},
              {q:'¿Cuánto tardo en tenerlo funcionando?',a:'Menos de 48 horas. La mayoría activan en el mismo día.'},
            ].map(({q,a})=>(
              <div key={q} style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:'20px 24px'}}>
                <p style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:8}}>{q}</p>
                <p style={{fontSize:14,color:C.muted,lineHeight:1.65}}>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{padding:'80px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:900,margin:'0 auto',background:'linear-gradient(135deg,rgba(240,168,78,0.12),rgba(240,168,78,0.03))',border:'1px solid rgba(240,168,78,0.25)',borderRadius:28,padding:'64px 48px',textAlign:'center',position:'relative',overflow:'hidden',boxShadow:'0 0 80px rgba(240,168,78,0.08)'}}>
          {/* Glow blob */}
          <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:400,height:200,background:'radial-gradient(ellipse,rgba(240,168,78,0.08),transparent 70%)',pointerEvents:'none'}}/>
          <div style={{position:'relative'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:7,background:'rgba(240,168,78,0.1)',border:'1px solid rgba(240,168,78,0.2)',borderRadius:20,padding:'5px 14px',marginBottom:24}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:C.amber,animation:'pulse 1.5s ease-in-out infinite'}}/>
              <span style={{fontSize:11.5,fontWeight:600,color:C.amber,letterSpacing:'0.06em'}}>EMPIEZA HOY · GRATIS</span>
            </div>
            <h2 style={{fontSize:'clamp(30px,4vw,52px)',fontWeight:800,letterSpacing:'-0.04em',lineHeight:1.1,marginBottom:20,color:C.text}}>
              Empieza ahora y deja<br/>de perder clientes
            </h2>
            <p style={{fontSize:17,color:C.muted,marginBottom:12,lineHeight:1.7}}>
              Llaman, escriben, preguntan. Y tú no siempre puedes responder. Tu recepcionista sí.
            </p>
            <p style={{fontSize:15.5,fontWeight:600,color:C.text,marginBottom:24}}>
              Mientras tú trabajas, esto responde. Siempre.
            </p>
            {/* Urgency / scarcity */}
            <div style={{background:'rgba(248,113,113,0.06)',border:'1px solid rgba(248,113,113,0.15)',borderRadius:12,padding:'14px 20px',marginBottom:28,display:'inline-block'}}>
              <p style={{fontSize:14,color:'rgba(255,255,255,0.7)',fontWeight:600,marginBottom:4}}>
                Plazas limitadas este mes — onboarding personalizado gratuito para los primeros 50 negocios
              </p>
              <p style={{fontSize:13,color:C.amber,fontWeight:700}}>
                37 negocios ya activos
              </p>
            </div>
            <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
              <Link href="/registro" className="btn-primary" style={{padding:'16px 40px',fontSize:16,borderRadius:14,display:'inline-block',boxShadow:'0 8px 32px rgba(240,168,78,0.4)'}}>
                Empieza con tu restaurante →
              </Link>
            </div>
            <p style={{fontSize:12,color:'rgba(255,255,255,0.2)',marginTop:20}}>
              Sin tarjeta · Sin permanencia · Funciona en 48 horas
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{borderTop:'1px solid rgba(255,255,255,0.06)',padding:'48px clamp(16px,5vw,64px) 32px'}}>
        <div style={{maxWidth:1200,margin:'0 auto'}}>
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:40,marginBottom:40}} className="feat-grid">
            {/* Brand */}
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                <div style={{width:28,height:28,background:'linear-gradient(135deg,#F0A84E,#E8943A)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#0A0D14"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                </div>
                <span style={{fontSize:15,fontWeight:700,color:C.text,letterSpacing:'-0.01em'}}>Reservo<span style={{color:C.amber}}>.AI</span></span>
              </div>
              <p style={{fontSize:13,color:'rgba(255,255,255,0.35)',lineHeight:1.7,maxWidth:280}}>
                La recepcionista virtual que atiende llamadas, WhatsApp y emails por ti. Para restaurantes, bares y cafeterias que no quieren perder ni un cliente.
              </p>
            </div>
            {/* Producto */}
            <div>
              <p style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'0.08em',marginBottom:14}}>PRODUCTO</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[{l:'Funcionalidades',h:'#demo'},{l:'Precios',h:'/precios'},{l:'Demo en vivo',h:'#demo'},{l:'Casos de uso',h:'#'}].map(({l,h})=>(
                  <Link key={l} href={h} style={{fontSize:13,color:'rgba(255,255,255,0.4)',transition:'color 0.15s'}} onMouseEnter={e=>(e.currentTarget.style.color=C.text)} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.4)')}>{l}</Link>
                ))}
              </div>
            </div>
            {/* Empresa */}
            <div>
              <p style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'0.08em',marginBottom:14}}>EMPRESA</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[{l:'Sobre nosotros',h:'#'},{l:'Blog',h:'#'},{l:'Contacto',h:'mailto:hola@reservo.ai'}].map(({l,h})=>(
                  <Link key={l} href={h} style={{fontSize:13,color:'rgba(255,255,255,0.4)',transition:'color 0.15s'}} onMouseEnter={e=>(e.currentTarget.style.color=C.text)} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.4)')}>{l}</Link>
                ))}
              </div>
            </div>
            {/* Legal */}
            <div>
              <p style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'0.08em',marginBottom:14}}>LEGAL</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[{l:'Política de privacidad',h:'/privacidad'},{l:'Términos de servicio',h:'/terminos'},{l:'Política de cookies',h:'/cookies'}].map(({l,h})=>(
                  <Link key={l} href={h} style={{fontSize:13,color:'rgba(255,255,255,0.4)',transition:'color 0.15s'}} onMouseEnter={e=>(e.currentTarget.style.color=C.text)} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.4)')}>{l}</Link>
                ))}
              </div>
            </div>
          </div>
          {/* Bottom bar */}
          <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:20,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
            <p style={{fontSize:12,color:'rgba(255,255,255,0.2)'}}>© {new Date().getFullYear()} Reservo.AI — Todos los derechos reservados</p>
            <p style={{fontSize:12,color:'rgba(52,211,153,0.5)',fontWeight:500}}>Optimizado para hosteleria · Proximamente mas sectores</p>
            <p style={{fontSize:12,color:'rgba(255,255,255,0.15)'}}>Hecho con criterio en Espana</p>
          </div>
        </div>
      </footer>

    </main>
  )
}
