'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

/* ─── LIVE NOTIFICATION FEED ─── */
const NOTIFICATIONS = [
  { icon:'📞', color:'#2DD4BF', msg:'Llamada entrante — Cita corte y color mañana', sub:'hace 2s' },
  { icon:'✅', color:'#4ADE80', msg:'Cita confirmada — García · Viernes 11:00', sub:'hace 8s' },
  { icon:'📋', color:'#F0A84E', msg:'Consulta registrada — Clínica · Revisión anual', sub:'hace 15s' },
  { icon:'📞', color:'#2DD4BF', msg:'Llamada entrante — Presupuesto instalación AC', sub:'hace 22s' },
  { icon:'✅', color:'#4ADE80', msg:'Reserva confirmada — López · Lunes 10:00', sub:'hace 31s' },
  { icon:'🔧', color:'#A78BFA', msg:'Servicio agendado — Taller · Revisión ITV', sub:'hace 40s' },
  { icon:'📞', color:'#2DD4BF', msg:'Llamada entrante — Asesoría fiscal autónomo', sub:'hace 55s' },
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
        <div style={{width:10,height:10,borderRadius:'50%',background:'#4ADE80',animation:'pulse 2s ease-in-out infinite'}}/>
        <span style={{fontSize:14,fontWeight:600,color:'#E8EEF6'}}>Prueba ahora — habla con nuestra IA</span>
      </div>
      <p style={{fontSize:13,color:'rgba(255,255,255,0.45)',marginBottom:20}}>Pulsa el botón y habla como si llamaras a un negocio. Pide una reserva, pregunta precios, o lo que quieras.</p>
      <div ref={widgetRef} dangerouslySetInnerHTML={{__html:'<elevenlabs-convai agent-id="agent_0701kkw2sdx5fp685xp6ckngf6zj"></elevenlabs-convai>'}}/>
      <p style={{fontSize:11,color:'rgba(255,255,255,0.2)',marginTop:12}}>Conversación real con IA · Sin registro · Gratis</p>
    </div>
  )
}

/* ─── MAIN PAGE ─── */
export default function HomePage() {
  const C = {
    bg:'#090C13', card:'rgba(255,255,255,0.03)', border:'rgba(255,255,255,0.07)',
    text:'#E8EEF6', muted:'rgba(255,255,255,0.45)', amber:'#F0A84E', teal:'#2DD4BF',
    red:'#F87171', green:'#4ADE80'
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
        @media(max-width:768px){
          .hero-grid{grid-template-columns:1fr!important}
          .hero-right{display:none!important}
          .prob-grid{grid-template-columns:1fr!important}
          .steps-grid{grid-template-columns:1fr!important}
          .price-grid{grid-template-columns:1fr!important}
          .feat-grid{grid-template-columns:1fr 1fr!important}
          .intel-grid{grid-template-columns:1fr!important}
          .adapt-grid{grid-template-columns:1fr!important}
          .trust-grid{grid-template-columns:1fr!important}
          .compare-grid{grid-template-columns:1fr!important}
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
          <Link href="/registro" className="btn-primary" style={{padding:'8px 20px',fontSize:13,borderRadius:8,display:'inline-block',boxShadow:'0 4px 16px rgba(240,168,78,0.3)'}}>Crear mi recepcionista →</Link>
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          1. HERO — Impacto + dinero + problema real
         ══════════════════════════════════════════ */}
      <section style={{minHeight:'100vh',display:'grid',gridTemplateColumns:'1fr 1fr',gap:60,alignItems:'center',padding:'100px clamp(16px,5vw,64px) 60px',maxWidth:1200,margin:'0 auto'}} className="hero-grid">
        {/* LEFT */}
        <div style={{animation:'fadeUp 0.8s ease forwards'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(240,168,78,0.1)',border:'1px solid rgba(240,168,78,0.25)',borderRadius:20,padding:'5px 14px',marginBottom:30}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:C.amber,animation:'pulse 1.5s ease-in-out infinite'}}/>
            <span style={{fontSize:11.5,fontWeight:600,color:C.amber,letterSpacing:'0.06em'}}>ATENDIENDO LLAMADAS AHORA MISMO</span>
          </div>
          <h1 style={{fontSize:'clamp(36px,4.5vw,60px)',fontWeight:800,letterSpacing:'-0.04em',lineHeight:1.08,marginBottom:24,color:C.text}}>
            Cada llamada<br/>que no coges es<br/>
            <span style={{background:'linear-gradient(135deg,#F0A84E,#FBBF24)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>dinero que se va</span>
          </h1>
          <p style={{fontSize:17,color:C.muted,lineHeight:1.75,marginBottom:12,maxWidth:520}}>
            Reservo atiende tus llamadas, entiende lo que necesita cada cliente y <strong style={{color:C.text}}>toma decisiones por ti.</strong> Reservas, citas, pedidos. Todo resuelto, sin que tengas que hacer nada.
          </p>
          <p style={{fontSize:15.5,color:C.text,fontWeight:600,marginBottom:40,padding:'12px 0',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
            No es un chatbot. Es alguien que trabaja por ti.
          </p>
          <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:40}}>
            <Link href="/registro" className="btn-primary" style={{padding:'14px 32px',fontSize:15,borderRadius:12,display:'inline-block',boxShadow:'0 6px 24px rgba(240,168,78,0.35)'}}>
              Crear mi recepcionista →
            </Link>
            <Link href="#demo" className="btn-ghost" style={{padding:'14px 24px',fontSize:14,borderRadius:12,display:'inline-block'}}>
              Escuchar cómo responde
            </Link>
          </div>
          <div style={{display:'flex',gap:28,flexWrap:'wrap'}}>
            {[['0€','sin tarjeta'],['< 2s','tiempo respuesta'],['24/7','sin descanso']].map(([n,l])=>(
              <div key={l}>
                <p style={{fontSize:22,fontWeight:700,color:C.amber,letterSpacing:'-0.03em'}}>{n}</p>
                <p style={{fontSize:12,color:'rgba(255,255,255,0.35)',fontWeight:500,marginTop:1}}>{l}</p>
              </div>
            ))}
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
        <p style={{textAlign:'center',fontSize:12,color:'rgba(255,255,255,0.25)',letterSpacing:'0.08em',fontWeight:500,marginBottom:20}}>TRABAJA PARA TODO TIPO DE NEGOCIOS</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:10,justifyContent:'center'}}>
          {[
            '💇 Peluquerías','🏥 Clínicas','🦷 Dentistas','🔧 Talleres',
            '⚖️ Asesorías','🍽️ Restaurantes','🏋️ Gimnasios','💆 Spas',
            '🏠 Inmobiliarias','🐾 Veterinarias','📦 Transportistas','🎓 Academias',
          ].map(s=>(
            <div key={s} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:20,padding:'7px 16px',fontSize:13,color:'rgba(255,255,255,0.5)',fontWeight:500,whiteSpace:'nowrap'}}>
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* ── STATS BAR ── */}
      <div style={{background:'rgba(240,168,78,0.05)',borderTop:'1px solid rgba(240,168,78,0.1)',borderBottom:'1px solid rgba(240,168,78,0.1)',padding:'28px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1200,margin:'0 auto',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:24,textAlign:'center'}}>
          {[
            {n:'100%', s:'llamadas atendidas', t:'Todas. Sin excepción.'},
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

      {/* ══════════════════════════════════════════
          2. DEMO — Ejemplo real de decisiones
         ══════════════════════════════════════════ */}
      <section id="demo" style={{padding:'90px clamp(16px,5vw,64px)',maxWidth:1200,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:56}}>
          <p style={{fontSize:12,fontWeight:600,color:C.teal,letterSpacing:'0.08em',marginBottom:12}}>ESCUCHA LA DIFERENCIA</p>
          <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
            No sigue un guion.<br/>
            <span style={{color:C.amber}}>Entiende, decide y resuelve.</span>
          </h2>
          <p style={{fontSize:16,color:C.muted,maxWidth:580,margin:'0 auto'}}>
            Mira lo que pasa cuando un cliente llama. No repite respuestas. Escucha lo que necesita y actúa como alguien de tu equipo.
          </p>
        </div>

        {/* Live demo widget — habla con el agente real */}
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
            No responde siempre lo mismo. <span style={{color:C.teal,fontWeight:800}}>Escucha, entiende y actúa según lo que está pasando.</span>
          </p>
          <p style={{fontSize:14,color:C.muted,marginTop:8}}>
            Sin intervención humana. Sin esperas. Sin errores.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          3. INTELIGENCIA REAL
         ══════════════════════════════════════════ */}
      <section style={{background:'rgba(255,255,255,0.015)',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1200,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:56}}>
            <p style={{fontSize:12,fontWeight:600,color:C.amber,letterSpacing:'0.08em',marginBottom:12}}>INTELIGENCIA REAL</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
              No es un bot que repite frases.<br/>
              <span style={{color:C.amber}}>Piensa antes de responder.</span>
            </h2>
            <p style={{fontSize:16,color:C.muted,maxWidth:520,margin:'0 auto'}}>
              La diferencia es simple: un bot sigue instrucciones. Tu recepcionista entiende lo que está pasando y actúa en consecuencia.
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
                icon:'🧠',title:'Piensa antes de actuar',
                body:'Cruza disponibilidad, reglas de tu negocio y lo que pide el cliente. Todo en menos de un segundo.',
                example:'Grupo de 8 + terraza ocupada → sugiere salón privado automáticamente.',
                color:'rgba(240,168,78,0.1)',bc:'rgba(240,168,78,0.2)'
              },
              {
                icon:'✅',title:'Decide en cada situación',
                body:'Si puede resolverlo, lo resuelve. Si necesita tu atención, te avisa. Sabe cuándo actuar y cuándo preguntar.',
                example:'Petición fuera de horario → no dice "no se puede". Ofrece la mejor alternativa.',
                color:'rgba(45,212,191,0.1)',bc:'rgba(45,212,191,0.2)'
              },
              {
                icon:'📚',title:'Aprende de tu negocio',
                body:'Cada día entiende mejor cómo trabajas. Tus preferencias, tus excepciones, tu forma de tratar al cliente.',
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
          4. ADAPTACIÓN A CADA NEGOCIO
         ══════════════════════════════════════════ */}
      <section style={{padding:'90px clamp(16px,5vw,64px)',maxWidth:1200,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:56}}>
          <p style={{fontSize:12,fontWeight:600,color:C.teal,letterSpacing:'0.08em',marginBottom:12}}>SE ADAPTA A TI</p>
          <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
            Tu negocio es único.<br/>
            <span style={{color:C.amber}}>Tu recepcionista también.</span>
          </h2>
          <p style={{fontSize:16,color:C.muted,maxWidth:540,margin:'0 auto'}}>
            No todos los negocios trabajan igual. Por eso tu recepcionista aprende cómo funciona el tuyo y responde como si llevara meses contigo.
          </p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}} className="adapt-grid">
          {[
            {
              icon:'🍽️',tipo:'Restaurantes',
              body:'Gestiona reservas, turnos, mesas especiales, alergias y grupos grandes sin perder una sola llamada.',
              ejemplo:'"Mesa en terraza para 2 el sábado" → comprueba disponibilidad y confirma al instante.'
            },
            {
              icon:'💈',tipo:'Peluquerías y estética',
              body:'Citas con el profesional correcto, duración de cada servicio y reagendamientos. Todo automático.',
              ejemplo:'"Quiero corte y color con María" → busca el primer hueco con María.'
            },
            {
              icon:'🏥',tipo:'Clínicas y consultas',
              body:'Citas con el especialista adecuado, urgencias filtradas y recordatorios para que nadie falte.',
              ejemplo:'"Necesito ver al Dr. López esta semana" → revisa agenda y ofrece opciones reales.'
            },
            {
              icon:'🔧',tipo:'Talleres y servicios',
              body:'Presupuestos, citas para diagnóstico y seguimiento de reparaciones. Sin llamadas de vuelta.',
              ejemplo:'"Mi coche hace un ruido al frenar" → agenda revisión y anota el síntoma.'
            },
            {
              icon:'🏋️',tipo:'Gimnasios y centros',
              body:'Reservas de clases, información de horarios y gestión de pruebas gratuitas para nuevos clientes.',
              ejemplo:'"¿Hay yoga mañana por la tarde?" → confirma horario y reserva plaza.'
            },
            {
              icon:'⚖️',tipo:'Asesorías y despachos',
              body:'Filtra consultas, agenda reuniones con el profesional adecuado y recoge la información antes de la cita.',
              ejemplo:'"Necesito consulta fiscal para autónomo" → agenda con el asesor fiscal disponible.'
            },
          ].map(({icon,tipo,body,ejemplo})=>(
            <div key={tipo} className="card-hover" style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'28px 24px'}}>
              <span style={{fontSize:32,display:'block',marginBottom:14}}>{icon}</span>
              <h3 style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:10,letterSpacing:'-0.02em'}}>{tipo}</h3>
              <p style={{fontSize:13.5,color:C.muted,lineHeight:1.65,marginBottom:14}}>{body}</p>
              <div style={{background:'rgba(240,168,78,0.06)',borderRadius:10,padding:'10px 14px',fontSize:12.5,color:C.amber,lineHeight:1.5}}>
                {ejemplo}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          5. BENEFICIOS
         ══════════════════════════════════════════ */}
      <section style={{background:'rgba(255,255,255,0.015)',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1200,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:56}}>
            <p style={{fontSize:12,fontWeight:600,color:C.green,letterSpacing:'0.08em',marginBottom:12}}>RESULTADOS REALES</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15}}>
              Lo que cambia cuando<br/>
              <span style={{color:C.amber}}>dejas de perder llamadas</span>
            </h2>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:20}} className="intel-grid">
            {[
              {
                number:'100%',label:'Llamadas atendidas',
                body:'Nunca más una llamada sin respuesta. Ni en horario de comida, ni los domingos, ni a las 3 de la mañana.',
                icon:'📞'
              },
              {
                number:'+35%',label:'Más clientes',
                body:'Cada llamada que antes se perdía ahora es una oportunidad cerrada. Más reservas, más ingresos.',
                icon:'📈'
              },
              {
                number:'-80%',label:'Menos interrupciones',
                body:'Tu equipo deja de atender el teléfono para centrarse en lo que importa: el cliente que ya está ahí.',
                icon:'🎯'
              },
              {
                number:'24/7',label:'Más tranquilidad',
                body:'Tu recepcionista no descansa, no enferma, no tiene días malos. Trabaja por ti todo el día, todos los días.',
                icon:'😌'
              },
            ].map(({number,label,body,icon})=>(
              <div key={label} className="card-hover" style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'28px 24px',textAlign:'center'}}>
                <span style={{fontSize:28,display:'block',marginBottom:12}}>{icon}</span>
                <p style={{fontSize:36,fontWeight:800,color:C.amber,letterSpacing:'-0.04em',marginBottom:4}}>{number}</p>
                <h3 style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:10}}>{label}</h3>
                <p style={{fontSize:13,color:C.muted,lineHeight:1.65}}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          6. CÓMO FUNCIONA — 3 pasos
         ══════════════════════════════════════════ */}
      <section style={{padding:'90px clamp(16px,5vw,64px)',maxWidth:1200,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:56}}>
          <p style={{fontSize:12,fontWeight:600,color:C.amber,letterSpacing:'0.08em',marginBottom:12}}>ASÍ DE FÁCIL</p>
          <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15}}>
            De cero a atender llamadas<br/>
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
              body:'La configuramos para que responda exactamente como tú quieres. La probamos contigo hasta que suene perfecto.',
              time:'Lista en 48 horas',
              color:'rgba(45,212,191,0.1)',bc:'rgba(45,212,191,0.2)'
            },
            {
              n:'03',icon:'✅',title:'Empieza a trabajar por ti',
              body:'Activamos tu recepcionista y empieza a atender llamadas reales. Tú solo te dedicas a lo tuyo. Las llamadas están cubiertas.',
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

      {/* ══════════════════════════════════════════
          7. CONFIANZA
         ══════════════════════════════════════════ */}
      <section style={{background:'rgba(255,255,255,0.015)',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1200,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:56}}>
            <p style={{fontSize:12,fontWeight:600,color:C.teal,letterSpacing:'0.08em',marginBottom:12}}>PUEDES CONFIAR</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15}}>
              Trabaja como alguien<br/>
              <span style={{color:C.amber}}>de tu equipo</span>
            </h2>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}} className="trust-grid">
            {[
              {icon:'⚡',title:'Responde en menos de 2 segundos',body:'Tu cliente nunca espera. Descuelga y responde al instante, como la mejor recepcionista que hayas tenido.'},
              {icon:'🔒',title:'Nunca deja una llamada sin atender',body:'Da igual la hora, el día o cuántas llamadas entren a la vez. Todas se atienden. Todas.'},
              {icon:'🎯',title:'Actúa como alguien de tu equipo',body:'Usa el tono de tu negocio, conoce tus reglas y trata a cada cliente como tú lo harías.'},
              {icon:'📊',title:'Tú tienes el control total',body:'Panel en tiempo real con cada llamada, cada decisión y cada reserva. Ajustas lo que quieras, cuando quieras.'},
              {icon:'🤝',title:'Si no sabe, te avisa',body:'No inventa ni improvisa. Si algo se sale de lo normal, te pasa el aviso con todo el contexto para que decidas tú.'},
              {icon:'📈',title:'Cada día mejor',body:'Aprende de cada interacción. Las llamadas de la semana que viene se atenderán mejor que las de esta.'},
            ].map(({icon,title,body})=>(
              <div key={title} style={{display:'flex',alignItems:'flex-start',gap:14,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'24px 20px'}}>
                <div style={{width:44,height:44,borderRadius:12,background:'rgba(45,212,191,0.1)',border:'1px solid rgba(45,212,191,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>
                  {icon}
                </div>
                <div>
                  <h3 style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:6,letterSpacing:'-0.01em'}}>{title}</h3>
                  <p style={{fontSize:13,color:C.muted,lineHeight:1.65}}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          8. PRECIOS — Comparar con empleado
         ══════════════════════════════════════════ */}
      <section style={{padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <p style={{fontSize:12,fontWeight:600,color:C.amber,letterSpacing:'0.08em',marginBottom:12}}>PRECIOS</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:14}}>
              Menos que un empleado.<br/>
              <span style={{color:C.amber}}>Disponible todo el día.</span>
            </h2>
            <p style={{fontSize:15,color:C.muted}}>Sin contratos. Sin permanencia. Cancela cuando quieras.</p>
          </div>

          {/* Comparison table */}
          <div style={{maxWidth:700,margin:'0 auto 48px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:20,padding:'8px 28px',overflow:'hidden'}}>
            {[
              {label:'Disponibilidad',employee:'8h/día, 5 días',reservo:'24h/día, 365 días'},
              {label:'Llamadas simultáneas',employee:'1 a la vez',reservo:'Ilimitadas'},
              {label:'Vacaciones / bajas',employee:'30 días/año',reservo:'Nunca'},
              {label:'Errores por cansancio',employee:'Frecuentes',reservo:'0'},
              {label:'Coste mensual',employee:'1.500€ - 2.000€',reservo:'Desde 99€/mes'},
            ].map(({label,employee,reservo},i)=>(
              <div key={label} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,padding:'16px 0',borderBottom:i<4?'1px solid rgba(255,255,255,0.06)':'none',alignItems:'center'}} className="compare-grid">
                <p style={{fontSize:13.5,color:C.muted}}>{label}</p>
                <p style={{fontSize:13.5,color:'rgba(255,255,255,0.25)',textDecoration:'line-through',textAlign:'center'}}>{employee}</p>
                <p style={{fontSize:13.5,color:C.teal,fontWeight:700,textAlign:'center'}}>{reservo}</p>
              </div>
            ))}
          </div>

          {/* Pricing cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20,alignItems:'start'}} className="price-grid">
            {[
              {plan:'Starter',price:'99',calls:'50 llamadas',sub:'Incluidas al mes',features:['Recepcionista 24/7','Reservas automáticas','Panel de control','Soporte por email'],cta:'Empezar gratis',highlight:false},
              {plan:'Business',price:'299',calls:'200 llamadas',sub:'Incluidas al mes',features:['Todo lo de Starter','Reconoce clientes habituales','Decisiones personalizadas','Estadísticas avanzadas','Soporte prioritario'],cta:'Más popular',highlight:true},
              {plan:'Enterprise',price:'499',calls:'600 llamadas',sub:'Incluidas al mes',features:['Todo lo de Business','Hasta 3 locales','Manager dedicado','SLA garantizado','Soporte 24/7'],cta:'Contactar',highlight:false},
            ].map(({plan,price,calls,sub,features,cta,highlight})=>(
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
                <p style={{fontSize:12,color:'rgba(255,255,255,0.3)',marginBottom:24}}>{sub}</p>
                <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:28}}>
                  {features.map(f=>(
                    <div key={f} style={{display:'flex',alignItems:'center',gap:8}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={highlight?C.amber:'#4ADE80'}><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                      <span style={{fontSize:13,color:'rgba(255,255,255,0.7)'}}>{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/registro" className={highlight?'btn-primary':'btn-ghost'} style={{display:'block',textAlign:'center',padding:'12px',borderRadius:10,fontSize:14,fontWeight:600}}>
                  {highlight ? 'Crear mi recepcionista →' : cta}
                </Link>
              </div>
            ))}
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
              {q:'¿Suena como un robot?',a:'No. Habla de forma natural y mantiene conversaciones fluidas. Tus clientes no notarán la diferencia.'},
              {q:'¿Qué pasa si no sabe responder algo?',a:'Te avisa al momento con todo el contexto para que puedas intervenir tú. Nunca se queda bloqueada ni inventa respuestas.'},
              {q:'¿Cuánto tarda en estar lista?',a:'En 15 minutos nos explicas tu negocio. En 48 horas tu recepcionista está atendiendo llamadas.'},
              {q:'¿Necesito cambiar mi número de teléfono?',a:'No. Desviamos las llamadas al sistema cuando tú no puedes contestar. Tu número sigue siendo el mismo.'},
              {q:'¿De verdad decide por su cuenta?',a:'Sí. Sabe qué hacer en cada situación porque conoce tu negocio: tus horarios, tus reglas, tus excepciones. No sigue un guion — actúa como una persona de tu equipo.'},
              {q:'¿Puedo cancelar cuando quiera?',a:'Sí, sin permanencia ni penalizaciones. Es mes a mes.'},
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
              Deja de perder clientes<br/>por no coger el teléfono
            </h2>
            <p style={{fontSize:17,color:C.muted,marginBottom:12,lineHeight:1.7}}>
              Crea tu recepcionista y empieza a atender cada llamada como si tuvieras a alguien dedicado solo a eso.
            </p>
            <p style={{fontSize:15.5,fontWeight:600,color:C.text,marginBottom:40}}>
              No es un bot. Esto trabaja mejor que una persona.
            </p>
            <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
              <Link href="/registro" className="btn-primary" style={{padding:'16px 40px',fontSize:16,borderRadius:14,display:'inline-block',boxShadow:'0 8px 32px rgba(240,168,78,0.4)'}}>
                Crear mi recepcionista gratis →
              </Link>
            </div>
            <p style={{fontSize:12,color:'rgba(255,255,255,0.2)',marginTop:20}}>
              Sin tarjeta · Sin permanencia · Funciona en 48 horas
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{borderTop:'1px solid rgba(255,255,255,0.06)',padding:'32px clamp(16px,5vw,64px)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:16}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:26,height:26,background:'linear-gradient(135deg,#F0A84E,#E8943A)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#0A0D14"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
          </div>
          <span style={{fontSize:14,fontWeight:700,color:C.text,letterSpacing:'-0.01em'}}>Reservo<span style={{color:C.amber}}>.AI</span></span>
        </div>
        <p style={{fontSize:12,color:'rgba(255,255,255,0.2)'}}>© 2025 Reservo.AI — Tu recepcionista que nunca falla</p>
        <div style={{display:'flex',gap:20}}>
          {['Privacidad','Términos','Contacto'].map(l=>(
            <span key={l} style={{fontSize:12,color:'rgba(255,255,255,0.3)',cursor:'pointer'}}>{l}</span>
          ))}
        </div>
      </footer>

    </main>
  )
}
