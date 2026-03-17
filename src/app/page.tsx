'use client'
import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{fontFamily:"'DM Sans',-apple-system,sans-serif",background:'#fff',color:'#0f172a',lineHeight:1.5}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif}
        .nav-link:hover{background:#f8fafc!important}
        .cta-btn:hover{opacity:0.92!important;transform:translateY(-1px)}
        .card-hover:hover{border-color:#bfdbfe!important;box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes slideIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .float{animation:float 4s ease-in-out infinite}
        .slide{animation:slideIn 0.7s ease forwards}
        .pulse-dot{animation:pulse 2s ease-in-out infinite}
        a{text-decoration:none;color:inherit}
        @media(max-width:768px){.hero-grid{grid-template-columns:1fr!important}.hero-mockup{display:none!important}.price-grid{grid-template-columns:1fr!important}.prob-grid{grid-template-columns:1fr!important}.sol-grid{grid-template-columns:1fr!important}}
      `}</style>

      {/* ── NAV ── */}
      <nav style={{position:'fixed',top:0,left:0,right:0,zIndex:100,background:'rgba(255,255,255,0.96)',backdropFilter:'blur(12px)',borderBottom:'1px solid #f1f5f9',padding:'0 clamp(16px,4vw,48px)',height:60,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <Link href="/" style={{display:'flex',alignItems:'center',gap:9}}>
          <div style={{width:30,height:30,background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(59,130,246,0.3)'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
          </div>
          <span style={{fontWeight:700,fontSize:16,letterSpacing:'-0.01em',color:'#0f172a'}}>Reservo.AI</span>
        </Link>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <Link href="/login" className="nav-link" style={{padding:'7px 16px',fontSize:13,fontWeight:500,color:'#64748b',borderRadius:8,transition:'background 0.15s'}}>Iniciar sesión</Link>
          <Link href="/registro" className="cta-btn" style={{padding:'7px 18px',fontSize:13,fontWeight:600,color:'white',background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:8,boxShadow:'0 2px 8px rgba(59,130,246,0.25)',transition:'all 0.15s'}}>Empezar gratis</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{paddingTop:100,paddingBottom:80,padding:'100px clamp(16px,5vw,64px) 80px',maxWidth:1140,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:60,alignItems:'center'}} className="hero-grid">
        <div className="slide">
          <div style={{display:'inline-flex',alignItems:'center',gap:7,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:20,padding:'5px 14px',marginBottom:28}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:'#3b82f6'}} className="pulse-dot"/>
            <span style={{fontSize:12,fontWeight:600,color:'#1d4ed8',letterSpacing:'0.02em'}}>RECEPCIONISTA CON INTELIGENCIA ARTIFICIAL</span>
          </div>
          <h1 style={{fontSize:'clamp(34px,4.5vw,58px)',fontWeight:700,letterSpacing:'-0.03em',lineHeight:1.1,marginBottom:22,color:'#0f172a'}}>
            Nunca vuelvas a{' '}
            <span style={{background:'linear-gradient(135deg,#1e40af,#3b82f6)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>perder una llamada</span>
          </h1>
          <p style={{fontSize:18,color:'#64748b',lineHeight:1.7,marginBottom:36,maxWidth:480}}>
            Reservo.AI responde automáticamente, gestiona reservas y organiza tu negocio — sin que tú tengas que levantar el teléfono.
          </p>
          <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:24}}>
            <Link href="/registro" className="cta-btn" style={{padding:'14px 30px',fontSize:15,fontWeight:600,color:'white',background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:10,boxShadow:'0 4px 16px rgba(59,130,246,0.35)',display:'flex',alignItems:'center',gap:8,transition:'all 0.15s'}}>
              Probar 10 llamadas gratis
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
            <a href="#demo" style={{padding:'14px 24px',fontSize:15,fontWeight:500,color:'#374151',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,display:'flex',alignItems:'center',gap:7}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="#374151"/></svg>
              Ver demo
            </a>
          </div>
          <p style={{fontSize:13,color:'#94a3b8'}}>✓ Sin tarjeta de crédito &nbsp;·&nbsp; ✓ Lista en 5 minutos &nbsp;·&nbsp; ✓ Cancela cuando quieras</p>
        </div>

        {/* Dashboard mockup */}
        <div className="float hero-mockup">
          <div style={{background:'white',borderRadius:16,boxShadow:'0 24px 64px rgba(0,0,0,0.12)',border:'1px solid #e2e8f0',overflow:'hidden',position:'relative'}}>
            <div style={{background:'#0f172a',padding:'12px 16px',display:'flex',alignItems:'center',gap:8}}>
              <div style={{display:'flex',gap:5}}>{['#ef4444','#f59e0b','#22c55e'].map(c=><div key={c} style={{width:10,height:10,borderRadius:'50%',background:c}}/>)}</div>
              <div style={{flex:1,background:'rgba(255,255,255,0.08)',borderRadius:4,height:16,marginLeft:4}}/>
              <div style={{width:7,height:7,borderRadius:'50%',background:'#22c55e'}} className="pulse-dot"/>
            </div>
            <div style={{padding:14,background:'#f8fafc'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                {[{n:'12',l:'Llamadas hoy',c:'#1d4ed8',bg:'#eff6ff'},{n:'8',l:'Reservas',c:'#166534',bg:'#f0fdf4'},{n:'24',l:'Clientes',c:'#6b21a8',bg:'#faf5ff'},{n:'0',l:'Perdidas',c:'#166534',bg:'#f0fdf4'}].map(s=>(
                  <div key={s.l} style={{background:'white',borderRadius:8,padding:'10px 12px',border:'1px solid #e2e8f0'}}>
                    <div style={{fontSize:22,fontWeight:700,color:s.c,letterSpacing:'-0.02em'}}>{s.n}</div>
                    <div style={{fontSize:11,color:'#94a3b8',marginTop:1}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{background:'white',borderRadius:8,border:'1px solid #e2e8f0',overflow:'hidden',marginBottom:8}}>
                <div style={{padding:'8px 12px',borderBottom:'1px solid #f1f5f9',fontSize:11,fontWeight:600,color:'#374151'}}>Llamadas recientes</div>
                {[{n:'María García',t:'13:45',s:'Reserva creada',c:'#059669'},{n:'Carlos López',t:'13:32',s:'Info horarios',c:'#1d4ed8'},{n:'Ana Martínez',t:'13:18',s:'Cita modificada',c:'#059669'}].map((c,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:9,padding:'8px 12px',borderTop:i>0?'1px solid #f8fafc':'none'}}>
                    <div style={{width:26,height:26,borderRadius:'50%',background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#1d4ed8',flexShrink:0}}>{c.n[0]}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.n}</div>
                      <div style={{fontSize:10,color:c.c,marginTop:1}}>{c.s}</div>
                    </div>
                    <div style={{fontSize:10,color:'#94a3b8'}}>{c.t}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{position:'absolute',top:'-12px',right:'-12px',background:'#059669',color:'white',borderRadius:20,padding:'6px 14px',fontSize:11,fontWeight:700,boxShadow:'0 4px 12px rgba(5,150,105,0.4)',whiteSpace:'nowrap'}}>✓ Llamada gestionada</div>
        </div>
      </section>

      {/* ── PROBLEMA ── */}
      <section style={{background:'#f8fafc',padding:'80px clamp(16px,5vw,64px)',borderTop:'1px solid #e2e8f0',borderBottom:'1px solid #e2e8f0'}}>
        <div style={{maxWidth:920,margin:'0 auto',textAlign:'center'}}>
          <p style={{fontSize:12,fontWeight:600,color:'#3b82f6',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:12}}>EL PROBLEMA</p>
          <h2 style={{fontSize:'clamp(26px,3.5vw,38px)',fontWeight:700,letterSpacing:'-0.02em',marginBottom:14}}>¿Cuántas llamadas pierdes al día?</h2>
          <p style={{color:'#64748b',fontSize:16,marginBottom:52,maxWidth:520,margin:'0 auto 52px'}}>Cada llamada sin respuesta es un cliente que se va con la competencia.</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}} className="prob-grid">
            {[
              {icon:'📞',title:'No puedes contestar siempre',desc:'Estás con un cliente, en la cocina o simplemente ocupado. La llamada se va.'},
              {icon:'📅',title:'Se escapan reservas',desc:'Sin sistema centralizado, las citas se olvidan, se duplican o se pierden.'},
              {icon:'😤',title:'El cliente no vuelve',desc:'Si no hay respuesta inmediata, se va. Y eso es dinero que nunca volverá.'},
            ].map(p=>(
              <div key={p.title} className="card-hover" style={{background:'white',borderRadius:14,padding:'28px 24px',border:'1px solid #e2e8f0',textAlign:'left',transition:'all 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
                <div style={{fontSize:32,marginBottom:16}}>{p.icon}</div>
                <h3 style={{fontWeight:600,fontSize:15,marginBottom:10,color:'#0f172a',lineHeight:1.3}}>{p.title}</h3>
                <p style={{color:'#64748b',fontSize:13,lineHeight:1.7}}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOLUCIÓN ── */}
      <section style={{padding:'80px clamp(16px,5vw,64px)',maxWidth:920,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:52}}>
          <p style={{fontSize:12,fontWeight:600,color:'#3b82f6',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:12}}>LA SOLUCIÓN</p>
          <h2 style={{fontSize:'clamp(26px,3.5vw,38px)',fontWeight:700,letterSpacing:'-0.02em',marginBottom:14}}>Reservo.AI lo hace por ti</h2>
          <p style={{color:'#64748b',fontSize:16}}>Tu recepcionista digital disponible 24 horas, 7 días a la semana.</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}} className="sol-grid">
          {[
            {icon:'🎙️',title:'Atiende llamadas automáticamente',desc:'Responde con voz natural, en tu idioma, como si fuera una persona real de tu equipo.'},
            {icon:'📋',title:'Crea reservas al instante',desc:'Pregunta los datos y registra la cita directamente en tu panel, sin errores.'},
            {icon:'🔔',title:'Te avisa de lo importante',desc:'Recibe notificaciones instantáneas cuando hay reservas nuevas o cambios urgentes.'},
            {icon:'📊',title:'Todo en un panel claro',desc:'Llamadas, reservas y clientes ordenados. Nunca más perderás información.'},
          ].map(s=>(
            <div key={s.title} className="card-hover" style={{background:'#f8fafc',borderRadius:14,padding:'24px',border:'1px solid #e2e8f0',display:'flex',gap:18,alignItems:'flex-start',transition:'all 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.03)'}}>
              <div style={{fontSize:26,flexShrink:0,marginTop:2}}>{s.icon}</div>
              <div>
                <h3 style={{fontWeight:600,fontSize:14,marginBottom:7,color:'#0f172a'}}>{s.title}</h3>
                <p style={{color:'#64748b',fontSize:13,lineHeight:1.7}}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── DEMO ── */}
      <section id="demo" style={{background:'#0f172a',padding:'80px clamp(16px,5vw,64px)',color:'white'}}>
        <div style={{maxWidth:720,margin:'0 auto',textAlign:'center'}}>
          <p style={{fontSize:12,fontWeight:600,color:'#60a5fa',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:12}}>ASÍ FUNCIONA</p>
          <h2 style={{fontSize:'clamp(26px,3.5vw,38px)',fontWeight:700,letterSpacing:'-0.02em',marginBottom:14}}>Una llamada → Una reserva automática</h2>
          <p style={{color:'rgba(255,255,255,0.6)',fontSize:15,marginBottom:52}}>En menos de 30 segundos, el agente gestiona la llamada y crea la reserva.</p>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',flexWrap:'wrap',gap:6}}>
            {[
              {icon:'📞',label:'Cliente llama',c:'#60a5fa'},
              null,
              {icon:'🤖',label:'IA responde',c:'#a78bfa'},
              null,
              {icon:'📅',label:'Reserva creada',c:'#34d399'},
              null,
              {icon:'🔔',label:'Recibes aviso',c:'#fbbf24'},
            ].map((s,i)=>
              s===null
                ? <div key={i} style={{color:'rgba(255,255,255,0.2)',fontSize:22,padding:'0 4px'}}>→</div>
                : <div key={i} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:'18px 22px',textAlign:'center',minWidth:130}}>
                    <div style={{fontSize:30,marginBottom:10}}>{s.icon}</div>
                    <div style={{fontSize:12,fontWeight:600,color:s.c}}>{s.label}</div>
                  </div>
            )}
          </div>
        </div>
      </section>

      {/* ── PRECIOS ── */}
      <section style={{padding:'80px clamp(16px,5vw,64px)',maxWidth:1000,margin:'0 auto',textAlign:'center'}}>
        <p style={{fontSize:12,fontWeight:600,color:'#3b82f6',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:12}}>PRECIOS</p>
        <h2 style={{fontSize:'clamp(26px,3.5vw,38px)',fontWeight:700,letterSpacing:'-0.02em',marginBottom:14}}>Precio claro, sin sorpresas</h2>
        <p style={{color:'#64748b',fontSize:16,marginBottom:52}}>Empieza gratis. Escala cuando tu negocio lo necesite.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}} className="price-grid">
          {[
            {name:'Starter',price:'99',calls:'50 llamadas/mes',features:['Panel de control completo','Gestión de reservas','Notificaciones','Soporte email'],highlight:false},
            {name:'Pro',price:'299',calls:'200 llamadas/mes',features:['Todo de Starter','Gestión de pedidos','Analíticas avanzadas','Soporte prioritario','Multi-idioma'],highlight:true},
            {name:'Business',price:'499',calls:'600 llamadas/mes',features:['Todo de Pro','Multi-ubicación','Acceso API','Gestor de cuenta','SLA garantizado'],highlight:false},
          ].map(p=>(
            <div key={p.name} style={{background:p.highlight?'linear-gradient(145deg,#1e3a8a,#1e40af)':'white',borderRadius:16,padding:'32px 28px',border:p.highlight?'none':'1px solid #e2e8f0',boxShadow:p.highlight?'0 24px 48px rgba(30,64,175,0.25)':'0 1px 3px rgba(0,0,0,0.05)',color:p.highlight?'white':'#0f172a',position:'relative',overflow:'hidden',textAlign:'left'}}>
              {p.highlight&&<div style={{position:'absolute',top:16,right:16,background:'rgba(255,255,255,0.15)',backdropFilter:'blur(4px)',borderRadius:20,padding:'3px 12px',fontSize:11,fontWeight:700,letterSpacing:'0.04em'}}>MÁS POPULAR</div>}
              <div style={{fontSize:12,fontWeight:600,marginBottom:10,opacity:p.highlight?0.8:1,color:p.highlight?'white':'#64748b',letterSpacing:'0.03em',textTransform:'uppercase'}}>{p.name}</div>
              <div style={{fontSize:44,fontWeight:700,letterSpacing:'-0.04em',marginBottom:4,lineHeight:1}}>{p.price}<span style={{fontSize:16,fontWeight:400,opacity:0.65}}>€/mes</span></div>
              <div style={{fontSize:13,opacity:0.65,marginBottom:24}}>{p.calls}</div>
              <ul style={{listStyle:'none',marginBottom:28,display:'flex',flexDirection:'column',gap:8}}>
                {p.features.map(f=>(
                  <li key={f} style={{fontSize:13,display:'flex',alignItems:'center',gap:9,opacity:p.highlight?0.9:0.8}}>
                    <span style={{color:p.highlight?'#86efac':'#059669',fontWeight:700,flexShrink:0}}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/registro" className="cta-btn" style={{display:'block',padding:'12px',background:p.highlight?'rgba(255,255,255,0.15)':'linear-gradient(135deg,#1e40af,#3b82f6)',color:'white',borderRadius:9,fontSize:14,fontWeight:600,textAlign:'center',border:p.highlight?'1px solid rgba(255,255,255,0.25)':'none',transition:'all 0.15s'}}>
                {p.highlight?'Empezar ahora →':'Seleccionar'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{background:'linear-gradient(145deg,#0f172a,#1e3a5f)',padding:'100px clamp(16px,5vw,64px)',textAlign:'center',color:'white'}}>
        <div style={{maxWidth:600,margin:'0 auto'}}>
          <div style={{fontSize:48,marginBottom:20}}>🚀</div>
          <h2 style={{fontSize:'clamp(28px,4vw,44px)',fontWeight:700,letterSpacing:'-0.025em',marginBottom:16,lineHeight:1.2}}>Empieza con 10 llamadas gratis</h2>
          <p style={{color:'rgba(255,255,255,0.65)',fontSize:17,marginBottom:40,lineHeight:1.6}}>Sin tarjeta de crédito. Configura tu recepcionista AI en menos de 5 minutos.</p>
          <Link href="/registro" className="cta-btn" style={{display:'inline-flex',alignItems:'center',gap:9,padding:'15px 36px',background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',color:'white',borderRadius:12,fontSize:16,fontWeight:600,boxShadow:'0 6px 24px rgba(59,130,246,0.4)',transition:'all 0.15s'}}>
            Crear cuenta gratis
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{borderTop:'1px solid #e2e8f0',padding:'28px clamp(16px,4vw,48px)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,background:'white'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:22,height:22,background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
          </div>
          <span style={{fontSize:13,fontWeight:600,color:'#374151'}}>Reservo.AI</span>
        </div>
        <p style={{fontSize:12,color:'#94a3b8'}}>© 2025 Reservo.AI · Todos los derechos reservados</p>
        <div style={{display:'flex',gap:16}}>
          {['Privacidad','Términos','Contacto'].map(l=><a key={l} href="#" style={{fontSize:12,color:'#94a3b8'}}>{l}</a>)}
        </div>
      </footer>
    </main>
  )
}