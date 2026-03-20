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
  { who:'client', text:'Buenas, quería pedir cita para esta semana.' },
  { who:'agent',  text:'¡Hola! ¿Para qué servicio y qué día le viene mejor?' },
  { who:'client', text:'Para el jueves, cualquier hora de mañana.' },
  { who:'agent',  text:'Tengo disponible el jueves a las 10:30. ¿Le va bien?' },
  { who:'client', text:'Perfecto, sí.' },
  { who:'confirm',text:'✓ Cita confirmada · Jueves 10:30 · Registrada en el panel' },
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

/* ─── STATS COUNTER ─── */
function Counter({ to, suffix='' }: { to:number, suffix?:string }) {
  const [v,setV] = useState(0)
  useEffect(() => {
    let start=0
    const step = to/60
    const t = setInterval(()=>{ start+=step; if(start>=to){setV(to);clearInterval(t)}else setV(Math.floor(start)) },16)
    return ()=>clearInterval(t)
  },[to])
  return <>{v.toLocaleString('es-ES')}{suffix}</>
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
          <Link href="/login" className="btn-ghost" style={{padding:'7px 18px',fontSize:13,borderRadius:8,display:'inline-block'}}>Iniciar sesión</Link>
          <Link href="/registro" className="btn-primary" style={{padding:'8px 20px',fontSize:13,borderRadius:8,display:'inline-block',boxShadow:'0 4px 16px rgba(240,168,78,0.3)'}}>Empezar gratis →</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{minHeight:'100vh',display:'grid',gridTemplateColumns:'1fr 1fr',gap:60,alignItems:'center',padding:'100px clamp(16px,5vw,64px) 60px',maxWidth:1200,margin:'0 auto'}} className="hero-grid">
        {/* LEFT */}
        <div style={{animation:'fadeUp 0.8s ease forwards'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(240,168,78,0.1)',border:'1px solid rgba(240,168,78,0.25)',borderRadius:20,padding:'5px 14px',marginBottom:30}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:C.amber,animation:'pulse 1.5s ease-in-out infinite'}}/>
            <span style={{fontSize:11.5,fontWeight:600,color:C.amber,letterSpacing:'0.06em'}}>RECEPCIONISTA CON IA · 24/7</span>
          </div>
          <h1 style={{fontSize:'clamp(36px,4.5vw,60px)',fontWeight:800,letterSpacing:'-0.04em',lineHeight:1.08,marginBottom:24,color:C.text}}>
            Cada llamada<br/>que no respondes<br/>
            <span style={{background:'linear-gradient(135deg,#F0A84E,#FBBF24)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>es dinero perdido</span>
          </h1>
          <p style={{fontSize:17,color:C.muted,lineHeight:1.75,marginBottom:16,maxWidth:500}}>
            Tu negocio recibe llamadas cuando estás ocupado, cuando cierras, o cuando no puedes contestar. <strong style={{color:C.text}}>Cada una es un cliente que se va.</strong>
          </p>
          <p style={{fontSize:15,color:'rgba(255,255,255,0.35)',marginBottom:40}}>
            Reservo.AI responde en menos de 2 segundos. Siempre.
          </p>
          <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:40}}>
            <Link href="/registro" className="btn-primary" style={{padding:'14px 32px',fontSize:15,borderRadius:12,display:'inline-block',boxShadow:'0 6px 24px rgba(240,168,78,0.35)'}}>
              Empieza hoy gratis →
            </Link>
            <Link href="/login" className="btn-ghost" style={{padding:'14px 24px',fontSize:14,borderRadius:12,display:'inline-block'}}>
              Ver demo
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
              <span style={{fontSize:11,color:'rgba(255,255,255,0.4)',letterSpacing:'0.05em',fontWeight:500}}>SOFIA EN LÍNEA</span>
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
                  <p style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>Sofía respondiendo</p>
                </div>
              </div>
              <CallSim />
            </div>
            {/* Live feed */}
            <div style={{padding:'14px 16px',height:320,overflow:'hidden'}}>
              <p style={{fontSize:11,color:'rgba(255,255,255,0.3)',letterSpacing:'0.05em',fontWeight:500,marginBottom:10}}>NOTIFICACIONES</p>
              <LiveFeed />
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTORES ── */}
      <div style={{padding:'20px clamp(16px,5vw,64px) 48px',maxWidth:1200,margin:'0 auto'}}>
        <p style={{textAlign:'center',fontSize:12,color:'rgba(255,255,255,0.25)',letterSpacing:'0.08em',fontWeight:500,marginBottom:20}}>PARA TODO TIPO DE NEGOCIOS</p>
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
            {n:'8', s:'llamadas perdidas', t:'Un negocio pierde de media al día'},
            {n:'+30%', s:'más clientes', t:'Media de nuestros clientes'},
            {n:'2s', s:'respuesta', t:'Tiempo máximo de espera'},
            {n:'100%', s:'llamadas atendidas', t:'Todas. Sin excepción.'},
          ].map(({n,s,t})=>(
            <div key={s}>
              <p style={{fontSize:32,fontWeight:800,color:C.amber,letterSpacing:'-0.04em'}}>{n}</p>
              <p style={{fontSize:13,color:C.text,fontWeight:600,marginTop:2}}>{s}</p>
              <p style={{fontSize:11.5,color:'rgba(255,255,255,0.3)',marginTop:3}}>{t}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── PROBLEMA ── */}
      <section style={{padding:'90px clamp(16px,5vw,64px)',maxWidth:1200,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:56}}>
          <p style={{fontSize:12,fontWeight:600,color:C.red,letterSpacing:'0.08em',marginBottom:12}}>EL PROBLEMA QUE NADIE TE DICE</p>
          <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
            Tu negocio está<br/>
            <span style={{color:C.red}}>perdiendo clientes ahora mismo</span>
          </h2>
          <p style={{fontSize:16,color:C.muted,maxWidth:520,margin:'0 auto'}}>Mientras lees esto, alguien está intentando contactar con tu negocio. Si no contestas, llama al siguiente.</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}} className="prob-grid">
          {[
            {icon:'📵',title:'No puedes contestar siempre',body:'Estás atendiendo a un cliente, en una reunión, o simplemente ocupado. Las llamadas entran igual — y la gente no espera.',color:'rgba(248,113,113,0.1)',bc:'rgba(248,113,113,0.2)'},
            {icon:'🌙',title:'Cierras. Las llamadas no',body:'A las 22:00 alguien busca cita para mañana. Tú has cerrado. Tu competencia tiene IA que responde al instante.',color:'rgba(251,191,36,0.1)',bc:'rgba(251,191,36,0.2)'},
            {icon:'💸',title:'Cada llamada perdida = cliente perdido',body:'Un cliente que no te localiza no te llama dos veces. Se va al competidor. Para siempre.',color:'rgba(240,168,78,0.1)',bc:'rgba(240,168,78,0.2)'},
          ].map(({icon,title,body,color,bc})=>(
            <div key={title} className="card-hover" style={{background:color,border:`1px solid ${bc}`,borderRadius:16,padding:'28px 24px'}}>
              <span style={{fontSize:32,display:'block',marginBottom:16}}>{icon}</span>
              <h3 style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:10,letterSpacing:'-0.02em'}}>{title}</h3>
              <p style={{fontSize:14,color:C.muted,lineHeight:1.65}}>{body}</p>
            </div>
          ))}
        </div>
        {/* Pain quote */}
        <div style={{marginTop:48,background:'rgba(248,113,113,0.05)',border:'1px solid rgba(248,113,113,0.15)',borderRadius:16,padding:'24px 32px',textAlign:'center'}}>
          <p style={{fontSize:18,fontWeight:600,color:'rgba(255,255,255,0.85)',fontStyle:'italic',lineHeight:1.6}}>
            "Un negocio que pierde 8 llamadas al día pierde entre <span style={{color:C.amber,fontStyle:'normal',fontWeight:800}}>2.000€ y 4.000€ al mes</span> en clientes que nunca volvieron."
          </p>
        </div>
      </section>

      {/* ── SOLUCIÓN ── */}
      <section style={{background:'rgba(255,255,255,0.015)',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1200,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:56}}>
            <p style={{fontSize:12,fontWeight:600,color:C.teal,letterSpacing:'0.08em',marginBottom:12}}>LA SOLUCIÓN</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:16}}>
              Más citas. Más clientes.<br/>
              <span style={{color:C.amber}}>Cero llamadas perdidas.</span>
            </h2>
            <p style={{fontSize:16,color:C.muted,maxWidth:500,margin:'0 auto'}}>No es un contestador. Es tu mejor recepcionista — que nunca se cansa, nunca falla y trabaja las 24 horas. Para cualquier tipo de negocio.</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}} className="prob-grid">
            {[
              {icon:'📞',title:'Responde en 2 segundos',body:'Cada llamada, a cualquier hora. Tu cliente nunca escucha el buzón de voz ni cuelga esperando.',color:C.teal},
              {icon:'📅',title:'Gestiona citas y solicitudes',body:'Agenda, informa, recoge datos. Todo queda registrado en tu panel al instante y en tiempo real.',color:C.amber},
              {icon:'📊',title:'Tú lo ves todo en tiempo real',body:'Panel con llamadas, citas y clientes actualizado al momento. Desde el móvil, desde cualquier sitio.',color:'#A78BFA'},
            ].map(({icon,title,body,color})=>(
              <div key={title} className="card-hover" style={{background:'rgba(255,255,255,0.02)',border:`1px solid rgba(255,255,255,0.07)`,borderRadius:16,padding:'28px 24px'}}>
                <div style={{width:44,height:44,borderRadius:12,background:`rgba(${color==='#2DD4BF'?'45,212,191':color===C.amber?'240,168,78':'167,139,250'},0.1)`,border:`1px solid rgba(${color==='#2DD4BF'?'45,212,191':color===C.amber?'240,168,78':'167,139,250'},0.2)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,marginBottom:16}}>
                  {icon}
                </div>
                <h3 style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:10,letterSpacing:'-0.02em'}}>{title}</h3>
                <p style={{fontSize:14,color:C.muted,lineHeight:1.65}}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section style={{padding:'90px clamp(16px,5vw,64px)',maxWidth:1200,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:56}}>
          <p style={{fontSize:12,fontWeight:600,color:C.amber,letterSpacing:'0.08em',marginBottom:12}}>ASÍ DE SIMPLE</p>
          <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15}}>
            3 pasos.<br/>Sin complicaciones.
          </h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:24,position:'relative'}} className="steps-grid">
          {[
            {n:'01',icon:'📲',title:'Alguien llama a tu negocio',body:'A las 14:00, a las 22:00, o cuando estás con otro cliente. Da igual. Siempre se atiende.',color:'rgba(240,168,78,0.15)',bc:'rgba(240,168,78,0.3)'},
            {n:'02',icon:'🤖',title:'Tu IA responde en 2 segundos',body:'Con el nombre de tu negocio, tus servicios y tus horarios. Suena como alguien de tu equipo.',color:'rgba(45,212,191,0.1)',bc:'rgba(45,212,191,0.2)'},
            {n:'03',icon:'✅',title:'La cita aparece en tu panel',body:'Tú lo ves todo en tiempo real desde el móvil o el ordenador. Sin hacer absolutamente nada.',color:'rgba(74,222,128,0.1)',bc:'rgba(74,222,128,0.2)'},
          ].map(({n,icon,title,body,color,bc},i)=>(
            <div key={n} style={{position:'relative'}}>
              <div className="card-hover" style={{background:color,border:`1px solid ${bc}`,borderRadius:20,padding:'32px 28px',height:'100%'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
                  <span style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.25)',letterSpacing:'0.1em'}}>{n}</span>
                  <span style={{fontSize:28}}>{icon}</span>
                </div>
                <h3 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,letterSpacing:'-0.02em',lineHeight:1.3}}>{title}</h3>
                <p style={{fontSize:14,color:C.muted,lineHeight:1.7}}>{body}</p>
              </div>
              {i<2&&<div style={{position:'absolute',right:-13,top:'50%',transform:'translateY(-50%)',fontSize:22,color:'rgba(255,255,255,0.15)',zIndex:1,display:'none'}} className="arrow-connector">→</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── PRECIOS ── */}
      <section style={{background:'rgba(255,255,255,0.015)',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'90px clamp(16px,5vw,64px)'}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:56}}>
            <p style={{fontSize:12,fontWeight:600,color:C.amber,letterSpacing:'0.08em',marginBottom:12}}>PRECIOS</p>
            <h2 style={{fontSize:'clamp(28px,3.5vw,46px)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:14}}>
              Menos que un camarero a tiempo parcial.<br/>
              <span style={{color:C.amber}}>Sin días libres ni bajas.</span>
            </h2>
            <p style={{fontSize:15,color:C.muted}}>Sin contratos. Sin permanencia. Cancela cuando quieras.</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20,alignItems:'start'}} className="price-grid">
            {[
              {plan:'Starter',price:'99',calls:'50 llamadas',sub:'Incluidas al mes',features:['Recepcionista IA 24/7','Reservas automáticas','Panel de control','Soporte por email'],cta:'Empezar gratis',highlight:false},
              {plan:'Business',price:'299',calls:'200 llamadas',sub:'Incluidas al mes',features:['Todo lo de Starter','Gestión de pedidos','Mesas y zonas','Estadísticas avanzadas','Soporte prioritario'],cta:'Más popular',highlight:true},
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
                  {highlight ? 'Empezar ahora →' : cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{padding:'80px clamp(16px,5vw,64px)',maxWidth:800,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:48}}>
          <h2 style={{fontSize:'clamp(24px,3vw,38px)',fontWeight:800,letterSpacing:'-0.03em'}}>Preguntas frecuentes</h2>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {[
            {q:'¿Suena como un robot?',a:'No. Usa voces naturales y conversación fluida. Tus clientes no sabrán que es IA a menos que se lo digas.'},
            {q:'¿Qué pasa si la IA no sabe responder algo?',a:'Te notifica inmediatamente para que puedas llamar tú. Nunca se queda sin respuesta.'},
            {q:'¿Cuánto tarda en configurarse?',a:'Menos de 15 minutos. Rellenas el formulario con los datos de tu negocio y arranca.'},
            {q:'¿Necesito cambiar mi número de teléfono?',a:'No. Desviamos las llamadas al sistema cuando tú no puedes contestar.'},
            {q:'¿Puedo cancelar cuando quiera?',a:'Sí, sin permanencia ni penalizaciones. Es mes a mes.'},
          ].map(({q,a})=>(
            <div key={q} style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:'20px 24px'}}>
              <p style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:8}}>{q}</p>
              <p style={{fontSize:14,color:C.muted,lineHeight:1.65}}>{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{padding:'0 clamp(16px,5vw,64px) 80px'}}>
        <div style={{maxWidth:900,margin:'0 auto',background:'linear-gradient(135deg,rgba(240,168,78,0.12),rgba(240,168,78,0.03))',border:'1px solid rgba(240,168,78,0.25)',borderRadius:28,padding:'64px 48px',textAlign:'center',position:'relative',overflow:'hidden',boxShadow:'0 0 80px rgba(240,168,78,0.08)'}}>
          {/* Glow blob */}
          <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:400,height:200,background:'radial-gradient(ellipse,rgba(240,168,78,0.08),transparent 70%)',pointerEvents:'none'}}/>
          <div style={{position:'relative'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:7,background:'rgba(240,168,78,0.1)',border:'1px solid rgba(240,168,78,0.2)',borderRadius:20,padding:'5px 14px',marginBottom:24}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:C.amber,animation:'pulse 1.5s ease-in-out infinite'}}/>
              <span style={{fontSize:11.5,fontWeight:600,color:C.amber,letterSpacing:'0.06em'}}>EMPIEZA HOY · GRATIS</span>
            </div>
            <h2 style={{fontSize:'clamp(30px,4vw,52px)',fontWeight:800,letterSpacing:'-0.04em',lineHeight:1.1,marginBottom:20,color:C.text}}>
              No pierdas ni una<br/>llamada más.
            </h2>
            <p style={{fontSize:17,color:C.muted,marginBottom:12,lineHeight:1.7}}>
              Mientras tardas en decidirte, tu negocio está perdiendo llamadas.
            </p>
            <p style={{fontSize:15,color:'rgba(255,255,255,0.35)',marginBottom:40}}>
              Configúralo en 15 minutos. Sin tarjeta de crédito. Sin compromiso.
            </p>
            <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
              <Link href="/registro" className="btn-primary" style={{padding:'16px 40px',fontSize:16,borderRadius:14,display:'inline-block',boxShadow:'0 8px 32px rgba(240,168,78,0.4)'}}>
                Empezar gratis ahora →
              </Link>
            </div>
            <p style={{fontSize:12,color:'rgba(255,255,255,0.2)',marginTop:20}}>
              Sin permanencia · Cancela cuando quieras · Soporte en español
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
        <p style={{fontSize:12,color:'rgba(255,255,255,0.2)'}}>© 2025 Reservo.AI — Todos los derechos reservados</p>
        <div style={{display:'flex',gap:20}}>
          {['Privacidad','Términos','Contacto'].map(l=>(
            <span key={l} style={{fontSize:12,color:'rgba(255,255,255,0.3)',cursor:'pointer'}}>{l}</span>
          ))}
        </div>
      </footer>

    </main>
  )
}
