'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

/* ─── LIVE NOTIFICATION FEED ─── */
const NOTIFICATIONS = [
  { icon:'📞', color:'#2DD4BF', msg:'Llamada entrante — Reserva mesa para 6 confirmada', sub:'hace 2s' },
  { icon:'💬', color:'#4ADE80', msg:'WhatsApp — "¿Tienen mesa para hoy?" → Reserva confirmada', sub:'hace 5s' },
  { icon:'✅', color:'#4ADE80', msg:'Pedido confirmado — Domicilio · C/ Gran Vía 42', sub:'hace 8s' },
  { icon:'📧', color:'#60A5FA', msg:'Email respondido — Menú para evento privado enviado', sub:'hace 12s' },
  { icon:'📞', color:'#2DD4BF', msg:'Llamada entrante — Consulta de alérgenos resuelta', sub:'hace 22s' },
  { icon:'💬', color:'#4ADE80', msg:'WhatsApp — Recordatorio enviado a 3 clientes', sub:'hace 28s' },
  { icon:'📧', color:'#60A5FA', msg:'Email — Reserva de grupo para viernes confirmada', sub:'hace 35s' },
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

/* ─── DEMO WIDGET — Llamada real con Retell ─── */
function DemoWidget() {
  const phone = '+12603083534'
  return (
    <div style={{maxWidth:520,margin:'0 auto 48px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(240,168,78,0.25)',borderRadius:20,padding:'36px 32px',textAlign:'center'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:20}}>
        <div style={{position:'relative'}}>
          <div style={{width:14,height:14,borderRadius:'50%',background:'#34D399',animation:'pulse 2s ease-in-out infinite'}}/>
          <div style={{position:'absolute',inset:-4,borderRadius:'50%',border:'1px solid rgba(52,211,153,0.4)',animation:'ring 2s ease-out infinite'}}/>
        </div>
        <span style={{fontSize:15,fontWeight:700,color:'#E8EEF6'}}>Recepcionista en línea ahora</span>
      </div>
      <p style={{fontSize:14,color:'rgba(255,255,255,0.55)',marginBottom:28,lineHeight:1.7}}>
        Llama al número y habla como si llamaras a un restaurante.<br/>
        Pide una reserva, pregunta por la carta o haz un pedido. Es real.
      </p>
      <a href={`tel:${phone}`} style={{
        display:'inline-flex',alignItems:'center',gap:12,
        padding:'18px 40px',fontSize:18,fontWeight:800,
        background:'linear-gradient(135deg,#F0A84E,#E8943A)',color:'#0A0D14',
        borderRadius:14,textDecoration:'none',
        boxShadow:'0 8px 32px rgba(240,168,78,0.4)',
        transition:'all 0.2s',cursor:'pointer',letterSpacing:'-0.01em',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#0A0D14"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
        Llamar ahora a la demo
      </a>
      <p style={{fontSize:13,color:'rgba(255,255,255,0.35)',marginTop:16,fontFamily:'monospace',letterSpacing:'0.05em'}}>{phone.replace('+1','+1 ').replace(/(\d{3})(\d{3})(\d{4})/,'$1 $2 $3')}</p>
      <p style={{fontSize:11,color:'rgba(255,255,255,0.18)',marginTop:8}}>Llamada real con IA · Sin registro · Gratis · Responde 24/7</p>
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
        Recupera esas reservas con Reservo →
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
          .pain-grid{grid-template-columns:1fr!important}
          .replace-grid{grid-template-columns:1fr!important}
          .solution-grid{grid-template-columns:1fr!important}
          .setup-grid{grid-template-columns:1fr!important}
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
          <Link href="/registro" className="btn-primary" style={{padding:'8px 20px',fontSize:13,borderRadius:8,display:'inline-block',boxShadow:'0 4px 16px rgba(240,168,78,0.3)'}}>Pruébalo en tu restaurante →</Link>
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          1. HERO
         ══════════════════════════════════════════ */}
      <section style={{minHeight:'100vh',display:'grid',gridTemplateColumns:'1fr 1fr',gap:60,alignItems:'center',padding:'100px clamp(16px,5vw,64px) 60px',maxWidth:1200,margin:'0 auto'}} className="hero-grid">
        {/* LEFT */}
        <div style={{animation:'fadeUp 0.8s ease forwards'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(240,168,78,0.1)',border:'1px solid rgba(240,168,78,0.25)',borderRadius:20,padding:'5px 14px',marginBottom:30}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:C.amber,animation:'pulse 1.5s ease-in-out infinite'}}/>
            <span style={{fontSize:11.5,fontWeight:600,color:C.amber,letterSpacing:'0.06em'}}>ATENDIENDO CLIENTES AHORA MISMO</span>
          </div>
          <h1 style={{fontSize:'clamp(36px,4.5vw,58px)',fontWeight:800,letterSpacing:'-0.04em',lineHeight:1.08,marginBottom:24,color:C.text}}>
            Tu restaurante<br/>
            <span style={{background:'linear-gradient(135deg,#F0A84E,#E8923A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>funciona solo.</span>
          </h1>
          <p style={{fontSize:17,color:C.muted,lineHeight:1.75,marginBottom:16,maxWidth:520}}>
            Atiende llamadas, gestiona reservas, controla pedidos, organiza tu equipo y predice lo que necesitas. <strong style={{color:C.text}}>Sin que tú estés pendiente.</strong>
          </p>
          <p style={{fontSize:13,color:C.teal,marginBottom:36,fontStyle:'italic'}}>
            Optimizado para restaurantes, bares y cafeterías. Próximamente más sectores.
          </p>
          <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:40}}>
            <Link href="/registro" className="btn-primary" style={{padding:'14px 32px',fontSize:15,borderRadius:12,display:'inline-block',boxShadow:'0 6px 24px rgba(240,168,78,0.35)'}}>
              Pruébalo en tu restaurante →
            </Link>
            <Link href="#demo" className="btn-ghost" style={{padding:'14px 24px',fontSize:14,borderRadius:12,display:'inline-block'}}>
              Escuchar cómo responde
            </Link>
          </div>
          <div style={{display:'flex',gap:28,flexWrap:'wrap'}}>
            {[['0€','sin tarjeta'],['< 2s','respuesta'],['24/7','siempre']].map(([n,l])=>(
              <div key={l}>
                <p style={{fontSize:22,fontWeight:700,color:C.amber,letterSpacing:'-0.03em'}}>{n}</p>
                <p style={{fontSize:12,color:'rgba(255,255,255,0.35)',fontWeight:500,marginTop:1}}>{l}</p>
              </div>
            ))}
          </div>
          {/* Mobile mini-panel */}
          <div className="hero-mobile-cta" style={{marginTop:32,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'18px 20px'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:C.teal,animation:'pulse 1.5s ease-in-out infinite'}}/>
              <span style={{fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.5)',letterSpacing:'0.04em'}}>RECEPCIONISTA EN LÍNEA</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[
                {icon:'📞',text:'Llamada entrante → Reserva confirmada para 4 personas',time:'hace 2s'},
                {icon:'💬',text:'WhatsApp → "¿Tienen mesa hoy?" → Confirmado',time:'hace 5s'},
                {icon:'📧',text:'Email respondido → Menú para evento enviado',time:'hace 12s'},
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

      {/* ══════════════════════════════════════════
          2. SECTORS
         ══════════════════════════════════════════ */}
      <div style={{padding:'20px clamp(16px,5vw,64px) 48px',maxWidth:1200,margin:'0 auto'}}>
        <p style={{textAlign:'center',fontSize:12,color:'rgba(255,255,255,0.25)',letterSpacing:'0.08em',fontWeight:500,marginBottom:20}}>SECTORES DISPONIBLES Y PRÓXIMAMENTE</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:10,justifyContent:'center'}}>
          {[
            {s:'🍽️ Restaurantes',active:true},{s:'🍺 Bares',active:true},{s:'☕ Cafeterías',active:true},
            {s:'💇 Peluquerías',active:false},{s:'🏥 Clínicas',active:false},{s:'🦷 Dentistas',active:false},{s:'🔧 Talleres',active:false},
            {s:'⚖️ Asesorías',active:false},{s:'🏋️ Gimnasios',active:false},{s:'💆 Spas',active:false},
            {s:'🏠 Inmobiliarias',active:false},{s:'🐾 Veterinarias',active:false},{s:'🏨 Hoteles',active:false},{s:'🎓 Academias',active:false},
          ].map(({s,active})=>(
            <div key={s} style={{background:active?'rgba(52,211,153,0.08)':'rgba(255,255,255,0.03)',border:active?'1px solid rgba(52,211,153,0.3)':'1px solid rgba(255,255,255,0.07)',borderRadius:20,padding:'7px 16px',fontSize:13,color:active?'#34D399':'rgba(255,255,255,0.3)',fontWeight:500,whiteSpace:'nowrap',opacity:active?1:0.4,display:'flex',alignItems:'center',gap:6}}>
              {s}
              {active
                ? <span style={{fontSize:10,background:'rgba(52,211,153,0.15)',color:'#34D399',padding:'1px 8px',borderRadius:10,fontWeight:600}}>Disponible</span>
                : <span style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>Próximamente</span>
              }
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          3. PAIN SECTION — ¿Te suena esto?
         ══════════════════════════════════════════ */}
      <section style={{background:'rgba(248,113,113,0.03)',borderTop:'1px solid rgba(248,113,113,0.1)',borderBottom:'1px solid rgba(248,113,113,0.1)',padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1000,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:56}}>
            <p style={{fontSize:12,fontWeight:600,color:C.red,letterSpacing:'0.08em',marginBottom:12}}>EL DÍA A DÍA DE VERDAD</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
              ¿Te suena esto?
            </h2>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}} className="pain-grid">
            {[
              'Pierdes llamadas cuando estás en cocina o atendiendo',
              'Reservas apuntadas en un papel que nadie encuentra',
              'Pedidos que llegan mal o se pierden',
              'No sabes quién trabaja mañana hasta última hora',
              'Stock que se acaba sin que nadie avise',
              'Clientes que llaman fuera de horario y no les contesta nadie',
              'Llevas la caja de cabeza',
            ].map((pain)=>(
              <div key={pain} style={{display:'flex',alignItems:'center',gap:14,background:'rgba(248,113,113,0.05)',border:'1px solid rgba(248,113,113,0.12)',borderRadius:14,padding:'18px 20px'}}>
                <span style={{fontSize:18,color:C.red,flexShrink:0}}>✗</span>
                <p style={{fontSize:15,color:'rgba(255,255,255,0.75)',fontWeight:500,lineHeight:1.5}}>{pain}</p>
              </div>
            ))}
          </div>
          <div style={{textAlign:'center',marginTop:56}}>
            <h3 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15}}>
              <span style={{background:'linear-gradient(135deg,#F0A84E,#E8923A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>Todo eso desaparece.</span>
            </h3>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          4. SOLUTION — No es una app más
         ══════════════════════════════════════════ */}
      <section style={{padding:'90px clamp(16px,5vw,64px)',maxWidth:1200,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:56}}>
          <p style={{fontSize:12,fontWeight:600,color:C.amber,letterSpacing:'0.08em',marginBottom:12}}>RESULTADOS, NO FUNCIONALIDADES</p>
          <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
            No es una app más.<br/>
            <span style={{color:C.amber}}>Es el sistema que lleva tu negocio.</span>
          </h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}} className="solution-grid">
          {[
            {
              icon:'📞',title:'Nunca pierdes una llamada',
              body:'Responde por ti 24/7. Por teléfono, WhatsApp y email. Como tu mejor empleado, pero sin descanso.',
              color:'rgba(240,168,78,0.1)',bc:'rgba(240,168,78,0.2)'
            },
            {
              icon:'📅',title:'Reservas sin errores',
              body:'Se gestionan solas. Ofrece alternativas, confirma al instante, avisa a cocina. Sin papel, sin caos.',
              color:'rgba(45,212,191,0.1)',bc:'rgba(45,212,191,0.2)'
            },
            {
              icon:'🛵',title:'Pedidos en tiempo real',
              body:'Carta, domicilio, recoger. Todo actualizado al segundo. Sin intermediarios, sin comisiones.',
              color:'rgba(96,165,250,0.1)',bc:'rgba(96,165,250,0.2)'
            },
            {
              icon:'💳',title:'Cobras en segundos',
              body:'TPV inteligente que se organiza sola. Destaca lo que más vendes según la hora. Sin configurar nada.',
              color:'rgba(167,139,250,0.1)',bc:'rgba(167,139,250,0.2)'
            },
            {
              icon:'👥',title:'Turnos y caja controlados',
              body:'Cada turno tiene su caja. Sabes quién vendió qué, cuánto se facturó y si cuadra. Sin Excel.',
              color:'rgba(52,211,153,0.1)',bc:'rgba(52,211,153,0.2)'
            },
            {
              icon:'🔮',title:'El sistema piensa por ti',
              body:'Avisa antes de que se acabe el stock, predice carga, detecta clientes que dejaron de venir y te dice qué hacer.',
              color:'rgba(248,113,113,0.1)',bc:'rgba(248,113,113,0.2)'
            },
          ].map(({icon,title,body,color,bc})=>(
            <div key={title} className="card-hover" style={{background:color,border:`1px solid ${bc}`,borderRadius:16,padding:'28px 24px'}}>
              <span style={{fontSize:32,display:'block',marginBottom:16}}>{icon}</span>
              <h3 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:10,letterSpacing:'-0.02em'}}>{title}</h3>
              <p style={{fontSize:14,color:C.muted,lineHeight:1.7}}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          5. DEMO — Prueba cómo atiende
         ══════════════════════════════════════════ */}
      <section id="demo" style={{background:'rgba(255,255,255,0.015)',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1200,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:56}}>
            <p style={{fontSize:12,fontWeight:600,color:C.teal,letterSpacing:'0.08em',marginBottom:12}}>ESCUCHA LA DIFERENCIA</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
              Prueba cómo atiende<br/>
              <span style={{color:C.amber}}>a tus clientes</span>
            </h2>
            <p style={{fontSize:16,color:C.muted,maxWidth:580,margin:'0 auto'}}>
              Habla con la recepcionista como si llamaras a un restaurante. Pide una reserva, pregunta por la carta, haz un pedido.
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
        </div>
      </section>

      {/* ══════════════════════════════════════════
          5.5. TPV INTELIGENTE — El dolor real
         ══════════════════════════════════════════ */}
      <section style={{padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1000,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <p style={{fontSize:12,fontWeight:600,color:C.red,letterSpacing:'0.08em',marginBottom:12}}>OLVÍDATE DE LA TPV</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
              La TPV es un problema,<br/><span style={{color:C.amber}}>no una solución.</span>
            </h2>
            <p style={{fontSize:16,color:C.muted,maxWidth:560,margin:'0 auto'}}>
              Configurarla es un dolor de cabeza. Usarla es peor. Pierdes productos, no encuentras nada, tardas en cobrar. Y encima pagas por ella.
            </p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}} className="prob-grid">
            <div style={{background:'rgba(248,113,113,0.04)',border:'1px solid rgba(248,113,113,0.12)',borderRadius:16,padding:'28px 24px'}}>
              <p style={{fontSize:14,fontWeight:700,color:C.red,marginBottom:16}}>Con una TPV tradicional:</p>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {['Tardas días en configurarla','No sabes dónde están los productos','Cobrar es lento y confuso','La carta cambia y hay que rehacer todo','No aprende nada — siempre igual','Pagas licencia + hardware + mantenimiento'].map(t=>(
                  <div key={t} style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{color:C.red,fontSize:14,flexShrink:0}}>✗</span>
                    <span style={{fontSize:13.5,color:'rgba(255,255,255,0.5)'}}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{background:'rgba(52,211,153,0.04)',border:'1px solid rgba(52,211,153,0.12)',borderRadius:16,padding:'28px 24px'}}>
              <p style={{fontSize:14,fontWeight:700,color:C.green,marginBottom:16}}>Con Reservo:</p>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {['Tu carta se crea en minutos','Los productos se organizan solos','Los pedidos entran en tiempo real','Cambias la carta al instante','Aprende lo que vendes y te sugiere mejoras','Todo incluido en tu plan — sin hardware'].map(t=>(
                  <div key={t} style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{color:C.green,fontSize:14,flexShrink:0}}>✓</span>
                    <span style={{fontSize:13.5,color:'rgba(255,255,255,0.7)'}}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{textAlign:'center',marginTop:36}}>
            <p style={{fontSize:18,fontWeight:700,color:C.text}}>No necesitas configurar nada. <span style={{color:C.amber}}>Empieza a usarla.</span></p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          6. REPLACEMENT — No necesitas 5 herramientas
         ══════════════════════════════════════════ */}
      <section style={{padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:800,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <p style={{fontSize:12,fontWeight:600,color:C.blue,letterSpacing:'0.08em',marginBottom:12}}>TODO EN UNO</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
              No necesitas 5 herramientas
            </h2>
            <p style={{fontSize:16,color:C.muted,maxWidth:520,margin:'0 auto'}}>
              Reservo sustituye todo lo que usas por separado. Un solo sistema, un solo precio.
            </p>
          </div>
          <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:20,padding:'8px 32px',overflow:'hidden'}}>
            {[
              {tool:'TPV tradicional'},
              {tool:'Agenda de reservas'},
              {tool:'CRM de clientes'},
              {tool:'Recepcionista / telefonista'},
              {tool:'Gestor de pedidos'},
              {tool:'Control de turnos y caja'},
              {tool:'Gestión de stock y proveedores'},
            ].map(({tool},i)=>(
              <div key={tool} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:20,padding:'18px 0',borderBottom:i<6?'1px solid rgba(255,255,255,0.06)':'none',alignItems:'center'}} className="replace-grid">
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:14,color:'rgba(255,255,255,0.25)',textDecoration:'line-through'}}>{tool}</span>
                </div>
                <span style={{fontSize:14,color:C.green,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  Incluido
                </span>
              </div>
            ))}
          </div>
          <div style={{textAlign:'center',marginTop:32}}>
            <p style={{fontSize:22,fontWeight:800,color:C.text,letterSpacing:'-0.02em'}}>
              Todo en un solo sistema. <span style={{color:C.amber}}>Desde 99€/mes.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          7. INTELLIGENCE — No solo gestiona. Piensa.
         ══════════════════════════════════════════ */}
      <section style={{background:'rgba(255,255,255,0.015)',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1200,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:56}}>
            <p style={{fontSize:12,fontWeight:600,color:C.amber,letterSpacing:'0.08em',marginBottom:12}}>INTELIGENCIA REAL</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
              No solo gestiona.<br/>
              <span style={{color:C.amber}}>Piensa.</span>
            </h2>
            <p style={{fontSize:16,color:C.muted,maxWidth:520,margin:'0 auto'}}>
              Analiza los datos de tu restaurante y te avisa antes de que los problemas lleguen.
            </p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:20}} className="intel-grid">
            {[
              {
                icon:'🧊',title:'Stock bajo',
                body:'Te quedan pocas bebidas para el fin de semana. Pide a tu proveedor antes del jueves.',
                color:'rgba(96,165,250,0.1)',bc:'rgba(96,165,250,0.2)'
              },
              {
                icon:'📈',title:'Patrón detectado',
                body:'Este plato se vende más los viernes. Prepara más cantidad para evitar quedarte sin.',
                color:'rgba(240,168,78,0.1)',bc:'rgba(240,168,78,0.2)'
              },
              {
                icon:'👤',title:'Cliente inactivo',
                body:'Este cliente no ha vuelto en 3 semanas. Antes venía cada viernes. ¿Le enviamos un mensaje?',
                color:'rgba(248,113,113,0.1)',bc:'rgba(248,113,113,0.2)'
              },
              {
                icon:'🔥',title:'Día de alta demanda',
                body:'Hoy tienes un 30% más de reservas que lo normal. Avisa a cocina y refuerza el turno.',
                color:'rgba(52,211,153,0.1)',bc:'rgba(52,211,153,0.2)'
              },
            ].map(({icon,title,body,color,bc})=>(
              <div key={title} className="card-hover" style={{background:color,border:`1px solid ${bc}`,borderRadius:16,padding:'28px 24px'}}>
                <span style={{fontSize:32,display:'block',marginBottom:16}}>{icon}</span>
                <h3 style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:10,letterSpacing:'-0.02em'}}>{title}</h3>
                <p style={{fontSize:13.5,color:C.muted,lineHeight:1.65}}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          8. ROI CALCULATOR
         ══════════════════════════════════════════ */}
      <section style={{padding:'80px clamp(16px,5vw,64px)',maxWidth:700,margin:'0 auto'}}>
        <ROICalculator />
      </section>

      {/* ══════════════════════════════════════════
          9. SOCIAL PROOF
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
              {name:'Carlos M.',role:'Restaurante La Terraza',text:'Desde que pusimos Reservo no hemos perdido ni una reserva de mesa. Antes se nos escapaban 5-6 llamadas al día en hora punta.',stars:5},
              {name:'Laura G.',role:'Bar de tapas El Rincón',text:'Nuestros clientes creen que tenemos a alguien nuevo en recepción. No saben que es IA y eso dice mucho de la calidad.',stars:5},
              {name:'Miguel R.',role:'Cafetería Central',text:'Lo mejor es que responde fuera de horario. El 40% de mis reservas ahora entran por la noche o los fines de semana cuando estamos cerrados.',stars:5},
            ].map(({name,role,text,stars})=>(
              <div key={name} style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'28px 24px'}}>
                <div style={{display:'flex',gap:2,marginBottom:14}}>
                  {Array.from({length:stars}).map((_,i)=>(
                    <span key={i} style={{color:C.amber,fontSize:14}}>★</span>
                  ))}
                </div>
                <p style={{fontSize:14,color:'rgba(255,255,255,0.7)',lineHeight:1.65,marginBottom:20,fontStyle:'italic'}}>&ldquo;{text}&rdquo;</p>
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
          10. SETUP — Listo en minutos
         ══════════════════════════════════════════ */}
      <section style={{background:'rgba(255,255,255,0.015)',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:700,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <p style={{fontSize:12,fontWeight:600,color:C.teal,letterSpacing:'0.08em',marginBottom:12}}>SIN COMPLICACIONES</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15}}>
              Listo en minutos,<br/>
              <span style={{color:C.amber}}>no en semanas</span>
            </h2>
          </div>
          <div style={{position:'relative',paddingLeft:32}}>
            {/* Vertical line */}
            <div style={{position:'absolute',left:11,top:8,bottom:8,width:2,background:'rgba(240,168,78,0.2)',borderRadius:2}}/>
            {[
              {time:'Minuto 1',text:'Registra tu restaurante',color:'#F0A84E'},
              {time:'Minuto 5',text:'Configura tu carta y horarios',color:'#2DD4BF'},
              {time:'Hora 1',text:'Tu agente empieza a responder',color:'#34D399'},
              {time:'Semana 1',text:'Primeros resultados reales',color:'#60A5FA'},
            ].map(({time,text,color},i)=>(
              <div key={time} style={{display:'flex',alignItems:'flex-start',gap:20,marginBottom:i<3?32:0,position:'relative'}}>
                {/* Dot */}
                <div style={{position:'absolute',left:-32,top:4,width:24,height:24,borderRadius:'50%',background:`${color}18`,border:`2px solid ${color}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:color}}/>
                </div>
                <div>
                  <p style={{fontSize:12,fontWeight:700,color,letterSpacing:'0.04em',marginBottom:4}}>{time.toUpperCase()}</p>
                  <p style={{fontSize:16,color:'rgba(255,255,255,0.8)',fontWeight:600}}>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          11. GUARANTEE
         ══════════════════════════════════════════ */}
      <section style={{padding:'60px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:700,margin:'0 auto'}}>
          <div style={{background:'rgba(52,211,153,0.06)',border:'1px solid rgba(52,211,153,0.2)',borderRadius:20,padding:'40px 36px',textAlign:'center'}}>
            <div style={{width:56,height:56,borderRadius:'50%',background:'rgba(52,211,153,0.12)',border:'1px solid rgba(52,211,153,0.25)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:28}}>
              🛡️
            </div>
            <h3 style={{fontSize:24,fontWeight:800,color:C.text,marginBottom:24,letterSpacing:'-0.02em'}}>Sin riesgo. Sin excusas.</h3>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}} className="setup-grid">
              {['30 días de prueba gratis','Sin tarjeta de crédito','Cancela cuando quieras','Devolución garantizada'].map(t=>(
                <div key={t} style={{display:'flex',alignItems:'center',gap:10,justifyContent:'center'}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  <span style={{fontSize:15,color:'rgba(255,255,255,0.8)',fontWeight:600}}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          12. PRICING
         ══════════════════════════════════════════ */}
      <section style={{padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <p style={{fontSize:12,fontWeight:600,color:C.amber,letterSpacing:'0.08em',marginBottom:12}}>PRECIOS CLAROS</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:14}}>
              Menos que un empleado.<br/>
              <span style={{color:C.amber}}>Más que cualquier herramienta.</span>
            </h2>
            <p style={{fontSize:15,color:C.muted}}>Sin contratos. Sin permanencia. Pagas solo por lo que usas.</p>
          </div>

          {/* Pricing cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20,alignItems:'start'}} className="price-grid">
            {[
              {
                plan:'Starter',headline:'Empieza a automatizar',sub:'Para restaurantes que quieren dejar de perder llamadas',
                price:'99',calls:'50 llamadas/mes',rate:'0,90€/llamada extra',
                features:['Recepcionista IA 24/7','Reservas automáticas','Panel en tiempo real','Base de clientes','Gestión de mesas','Control de turnos','TPV simple y visual','Caja por turnos','SMS de confirmación','Soporte por email'],
                cta:'Empieza a automatizar',highlight:false
              },
              {
                plan:'Pro',headline:'Automatiza tu operación',sub:'Para restaurantes que quieren crecer sin contratar',
                price:'299',calls:'200 llamadas/mes',rate:'0,70€/llamada extra',
                features:['Todo lo de Starter +','Pedidos por teléfono','Entregas a domicilio','TPV inteligente por hora','Estadísticas avanzadas','Sugerencias de la IA','Canal WhatsApp','CRM avanzado (VIP, scoring)','Exportación de datos','Soporte prioritario'],
                cta:'Automatiza tu operación',highlight:true
              },
              {
                plan:'Business',headline:'Control total',sub:'Para restaurantes con alta demanda',
                price:'499',calls:'600 llamadas/mes',rate:'0,50€/llamada extra',
                features:['Todo lo de Pro +','Canal Email','Stock inteligente y proveedores','Auto-pedidos semanales','Predicción de demanda','Cierres de caja avanzados','Informes PDF','Multi-usuario','Soporte dedicado'],
                cta:'Toma el control total',highlight:false
              },
            ].map(({plan,headline,sub,price,calls,rate,features,cta,highlight})=>(
              <div key={plan} className="plan-card" style={{
                background: highlight ? 'linear-gradient(135deg,rgba(240,168,78,0.08),rgba(240,168,78,0.03))' : 'rgba(255,255,255,0.02)',
                border: highlight ? `2px solid ${C.amber}` : '1px solid rgba(255,255,255,0.07)',
                borderRadius:20, padding:'32px 28px',
                boxShadow: highlight ? '0 0 60px rgba(240,168,78,0.12)' : 'none',
                transition:'all 0.3s', position:'relative', overflow:'hidden'
              }}>
                {highlight&&<div style={{position:'absolute',top:16,right:16,background:C.amber,color:'#0A0D14',fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,letterSpacing:'0.05em'}}>RECOMENDADO</div>}
                <p style={{fontSize:13,fontWeight:600,color:highlight?C.amber:'rgba(255,255,255,0.4)',letterSpacing:'0.04em',marginBottom:4}}>{plan.toUpperCase()}</p>
                <p style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:4,letterSpacing:'-0.01em'}}>{headline}</p>
                <p style={{fontSize:12.5,color:'rgba(255,255,255,0.35)',marginBottom:16,lineHeight:1.5}}>{sub}</p>
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
                  {highlight ? 'Prueba gratis 30 días →' : cta}
                </Link>
              </div>
            ))}
          </div>

          {/* IVA note */}
          <div style={{marginTop:32,textAlign:'center'}}>
            <p style={{fontSize:13.5,color:C.muted,lineHeight:1.7}}>
              IVA no incluido · 21% IVA se aplica en el checkout · Facturación mensual
            </p>
            <p style={{fontSize:14,fontWeight:600,color:C.text,marginTop:8}}>
              Pagas solo por lo que usas. Sin sorpresas.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          13. VERTICALS FUTURE
         ══════════════════════════════════════════ */}
      <section style={{padding:'48px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:800,margin:'0 auto',textAlign:'center'}}>
          <div style={{background:'rgba(45,212,191,0.05)',border:'1px solid rgba(45,212,191,0.15)',borderRadius:16,padding:'28px 32px'}}>
            <p style={{fontSize:16,color:'rgba(255,255,255,0.7)',lineHeight:1.7}}>
              Actualmente optimizado para <strong style={{color:C.teal}}>restaurantes, bares y cafeterías</strong>. Próximamente disponible para clínicas, gimnasios, peluquerías y más.
            </p>
            <Link href="/registro" style={{fontSize:14,color:C.amber,fontWeight:600,marginTop:12,display:'inline-block'}}>
              Regístrate y te avisamos cuando esté listo para tu sector →
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          14. FAQ
         ══════════════════════════════════════════ */}
      <section style={{background:'rgba(255,255,255,0.015)',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'80px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:800,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <h2 style={{fontSize:'clamp(24px,3vw,38px)',fontWeight:800,letterSpacing:'-0.03em'}}>Preguntas frecuentes</h2>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {[
              {q:'¿Suena como un robot?',a:'No. Habla de forma natural y mantiene conversaciones fluidas. Tus clientes no notan la diferencia. Pruébalo tú mismo en la demo de arriba.'},
              {q:'¿Qué pasa si no sabe responder algo?',a:'Te avisa al momento con todo el contexto para que puedas intervenir tú. Nunca inventa respuestas ni improvisa.'},
              {q:'¿Necesito cambiar mi número de teléfono?',a:'No. Desviamos las llamadas al sistema cuando tú no puedes contestar. Tu número sigue siendo el mismo.'},
              {q:'¿También responde WhatsApp y emails?',a:'Sí. Da igual por dónde te contacten: responde con la misma inteligencia y personalización por todos los canales.'},
              {q:'¿Sabe gestionar alergias y peticiones especiales?',a:'Sí. Recuerda las alergias de cada cliente, anota peticiones especiales y avisa a cocina automáticamente.'},
              {q:'¿Puedo ver las reservas y pedidos en tiempo real?',a:'Sí. Tienes un panel donde ves todo lo que pasa: reservas, pedidos, llamadas, mensajes. Todo actualizado al segundo.'},
              {q:'¿Cuánto tarda en estar listo?',a:'Menos de una hora para empezar a funcionar. En una semana ya ves resultados reales.'},
              {q:'¿Y si tengo pocas llamadas?',a:'Precisamente. Cada llamada cuenta más cuando tienes pocas. Una sola oportunidad perdida puede ser un cliente que no vuelve.'},
              {q:'¿Puedo cancelar cuando quiera?',a:'Sí, sin permanencia ni penalización. Es mes a mes. Y tienes 30 días de prueba gratis para decidir.'},
              {q:'¿Se integra con mi sistema actual?',a:'Funciona con cualquier restaurante, bar o cafetería. Solo necesitas un número de teléfono. No hace falta cambiar nada de lo que ya tienes.'},
              {q:'¿De verdad decide por su cuenta?',a:'Sí. Conoce tu negocio: tus horarios, tus reglas, tus excepciones. Si puede resolverlo, lo resuelve. Si no, te avisa a ti.'},
              {q:'¿Solo funciona para restaurantes?',a:'Actualmente está optimizado para hostelería (restaurantes, bares, cafeterías). Próximamente más sectores. Regístrate y te avisamos.'},
            ].map(({q,a})=>(
              <div key={q} style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:'20px 24px'}}>
                <p style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:8}}>{q}</p>
                <p style={{fontSize:14,color:C.muted,lineHeight:1.65}}>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          15. FINAL CTA
         ══════════════════════════════════════════ */}
      <section style={{padding:'80px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:900,margin:'0 auto',background:'linear-gradient(135deg,rgba(240,168,78,0.12),rgba(240,168,78,0.03))',border:'1px solid rgba(240,168,78,0.25)',borderRadius:28,padding:'64px 48px',textAlign:'center',position:'relative',overflow:'hidden',boxShadow:'0 0 80px rgba(240,168,78,0.08)'}}>
          {/* Glow blob */}
          <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:400,height:200,background:'radial-gradient(ellipse,rgba(240,168,78,0.08),transparent 70%)',pointerEvents:'none'}}/>
          <div style={{position:'relative'}}>
            <h2 style={{fontSize:'clamp(30px,4vw,52px)',fontWeight:800,letterSpacing:'-0.04em',lineHeight:1.1,marginBottom:20,color:C.text}}>
              Tu restaurante puede<br/>
              <span style={{background:'linear-gradient(135deg,#F0A84E,#E8923A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>funcionar solo.</span>
            </h2>
            <p style={{fontSize:18,color:'rgba(255,255,255,0.7)',marginBottom:12,lineHeight:1.7,fontWeight:500}}>
              Empieza hoy.
            </p>
            {/* Urgency / scarcity */}
            <div style={{background:'rgba(248,113,113,0.06)',border:'1px solid rgba(248,113,113,0.15)',borderRadius:12,padding:'14px 20px',marginBottom:28,display:'inline-block'}}>
              <p style={{fontSize:14,color:'rgba(255,255,255,0.7)',fontWeight:600}}>
                Plazas limitadas — onboarding personalizado para los primeros 50 negocios
              </p>
            </div>
            <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
              <Link href="/registro" className="btn-primary" style={{padding:'18px 48px',fontSize:17,borderRadius:14,display:'inline-block',boxShadow:'0 8px 32px rgba(240,168,78,0.4)'}}>
                Pruébalo en tu restaurante →
              </Link>
            </div>
            <p style={{fontSize:12,color:'rgba(255,255,255,0.2)',marginTop:20}}>
              Sin tarjeta · Sin permanencia · 30 días gratis
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          16. FOOTER
         ══════════════════════════════════════════ */}
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
                El sistema que lleva tu restaurante por ti. Llamadas, reservas, pedidos, equipo y predicciones. Todo en uno.
              </p>
            </div>
            {/* Producto */}
            <div>
              <p style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'0.08em',marginBottom:14}}>PRODUCTO</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[{l:'Cómo funciona',h:'#solucion'},{l:'Precios',h:'/precios'},{l:'Demo en vivo',h:'#demo'},{l:'Registrarse',h:'/registro'}].map(({l,h})=>(
                  <Link key={l} href={h} style={{fontSize:13,color:'rgba(255,255,255,0.4)',transition:'color 0.15s'}} onMouseEnter={e=>(e.currentTarget.style.color=C.text)} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.4)')}>{l}</Link>
                ))}
              </div>
            </div>
            {/* Empresa */}
            <div>
              <p style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'0.08em',marginBottom:14}}>EMPRESA</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[{l:'Contacto',h:'mailto:info.horizonstudioo@gmail.com'},{l:'Iniciar sesión',h:'/login'}].map(({l,h})=>(
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
            <p style={{fontSize:12,color:'rgba(52,211,153,0.5)',fontWeight:500}}>Optimizado para hostelería · Próximamente más sectores</p>
            <a href="https://horizonstudioo.com" target="_blank" rel="noopener" style={{fontSize:12,color:'rgba(255,255,255,0.25)',textDecoration:'none',transition:'color 0.15s'}} onMouseEnter={e=>(e.currentTarget.style.color='#F0A84E')} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.25)')}>Hecho por Horizon Studio</a>
          </div>
        </div>
      </footer>

    </main>
  )
}
