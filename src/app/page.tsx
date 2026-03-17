import Link from 'next/link'

export default function HomePage() {
  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",background:'#ffffff',color:'#0f172a',lineHeight:1.5}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
        @keyframes slideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .float{animation:float 4s ease-in-out infinite}
        .pulse{animation:pulse 2s ease-in-out infinite}
        .slide{animation:slideIn 0.6s ease forwards}
        a{text-decoration:none;color:inherit}
      `}</style>

      {/* NAV */}
      <nav style={{position:'fixed',top:0,left:0,right:0,zIndex:100,background:'rgba(255,255,255,0.95)',backdropFilter:'blur(12px)',borderBottom:'1px solid #f1f5f9',padding:'0 24px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:30,height:30,background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="white"/></svg>
          </div>
          <span style={{fontWeight:700,fontSize:16,letterSpacing:'-0.01em'}}>Reservo.AI</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <Link href="/login" style={{padding:'7px 16px',fontSize:13,fontWeight:500,color:'#475569',borderRadius:8,transition:'background 0.15s'}} onMouseEnter={e=>(e.currentTarget.style.background='#f8fafc')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>Iniciar sesión</Link>
          <Link href="/registro" style={{padding:'7px 16px',fontSize:13,fontWeight:600,color:'white',background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:8,boxShadow:'0 1px 4px rgba(59,130,246,0.3)'}}>Empezar gratis</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{paddingTop:120,paddingBottom:80,padding:'120px 24px 80px',maxWidth:1100,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:60,alignItems:'center'}}>
        <div className="slide">
          <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:20,padding:'4px 12px',marginBottom:24}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#3b82f6'}} className="pulse"/>
            <span style={{fontSize:12,fontWeight:600,color:'#1d4ed8'}}>Agente de IA para negocios</span>
          </div>
          <h1 style={{fontSize:'clamp(36px,4vw,56px)',fontWeight:700,letterSpacing:'-0.03em',lineHeight:1.1,marginBottom:20,color:'#0f172a'}}>
            Nunca vuelvas a<br/>
            <span style={{background:'linear-gradient(135deg,#1e40af,#3b82f6)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>perder una llamada</span>
          </h1>
          <p style={{fontSize:18,color:'#475569',lineHeight:1.6,marginBottom:32,maxWidth:460}}>
            Reservo.AI responde por ti 24/7, gestiona reservas automáticamente y organiza tu negocio mientras tú te centras en lo que importa.
          </p>
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            <Link href="/registro" style={{padding:'13px 28px',fontSize:15,fontWeight:600,color:'white',background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:10,boxShadow:'0 4px 16px rgba(59,130,246,0.35)',display:'flex',alignItems:'center',gap:8}}>
              Probar gratis
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
            <a href="#demo" style={{padding:'13px 24px',fontSize:15,fontWeight:500,color:'#374151',background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:10,display:'flex',alignItems:'center',gap:6}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="#374151"/></svg>
              Ver demostración
            </a>
          </div>
          <p style={{marginTop:20,fontSize:13,color:'#94a3b8'}}>✓ 10 llamadas gratis &nbsp; ✓ Sin tarjeta &nbsp; ✓ Listo en 5 minutos</p>
        </div>

        {/* Dashboard mockup */}
        <div className="float" style={{position:'relative'}}>
          <div style={{background:'white',borderRadius:16,boxShadow:'0 20px 60px rgba(0,0,0,0.12)',border:'1px solid #e2e8f0',overflow:'hidden'}}>
            {/* mock header */}
            <div style={{background:'#0f172a',padding:'12px 16px',display:'flex',alignItems:'center',gap:8}}>
              <div style={{display:'flex',gap:5}}>{['#ef4444','#f59e0b','#10b981'].map(c=><div key={c} style={{width:10,height:10,borderRadius:'50%',background:c}}/>)}</div>
              <div style={{flex:1,background:'rgba(255,255,255,0.1)',borderRadius:4,height:18,marginLeft:8}}/>
            </div>
            {/* mock content */}
            <div style={{padding:16,background:'#f8fafc'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                {[{n:'12',l:'Llamadas hoy',c:'#3b82f6'},{n:'8',l:'Reservas',c:'#10b981'},{n:'24',l:'Clientes',c:'#8b5cf6'},{n:'2',l:'Pendientes',c:'#f59e0b'}].map(s=>(
                  <div key={s.l} style={{background:'white',borderRadius:8,padding:'10px 12px',border:'1px solid #e2e8f0'}}>
                    <div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.n}</div>
                    <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{s.l}</div>
                  </div>
                ))}
              </div>
              {/* mock calls */}
              {[{n:'María García',t:'13:45',s:'Reserva creada'},{n:'Carlos López',t:'13:32',s:'Info horarios'},{n:'Ana Martínez',t:'13:18',s:'Modificar cita'}].map((c,i)=>(
                <div key={i} style={{background:'white',borderRadius:8,padding:'8px 12px',marginBottom:6,border:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#eff6ff,#dbeafe)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:600,color:'#1d4ed8',flexShrink:0}}>{c.n[0]}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.n}</div>
                    <div style={{fontSize:10,color:'#10b981',marginTop:1}}>{c.s}</div>
                  </div>
                  <div style={{fontSize:10,color:'#94a3b8',flexShrink:0}}>{c.t}</div>
                </div>
              ))}
            </div>
          </div>
          {/* floating badge */}
          <div style={{position:'absolute',top:-12,right:-12,background:'#10b981',color:'white',borderRadius:20,padding:'6px 12px',fontSize:11,fontWeight:700,boxShadow:'0 4px 12px rgba(16,185,129,0.4)'}}>
            ✓ Llamada gestionada
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section style={{background:'#f8fafc',padding:'80px 24px',borderTop:'1px solid #e2e8f0',borderBottom:'1px solid #e2e8f0'}}>
        <div style={{maxWidth:900,margin:'0 auto',textAlign:'center'}}>
          <h2 style={{fontSize:32,fontWeight:700,letterSpacing:'-0.02em',marginBottom:12}}>¿Cuántas llamadas pierdes al día?</h2>
          <p style={{color:'#64748b',fontSize:16,marginBottom:48}}>Cada llamada sin respuesta es un cliente que se va a la competencia.</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}}>
            {[
              {icon:'📞',title:'No puedes contestar',desc:'Estás con otro cliente, en la cocina o simplemente ocupado. La llamada se pierde.'},
              {icon:'📅',title:'Se escapan reservas',desc:'Sin un sistema centralizado, las reservas se olvidan o se duplican.'},
              {icon:'😤',title:'El cliente no vuelve',desc:'Un cliente que no encuentra atención inmediata se va. Y no vuelve.'},
            ].map(p=>(
              <div key={p.title} style={{background:'white',borderRadius:12,padding:24,border:'1px solid #e2e8f0',textAlign:'left'}}>
                <div style={{fontSize:28,marginBottom:12}}>{p.icon}</div>
                <h3 style={{fontWeight:600,fontSize:15,marginBottom:8,color:'#0f172a'}}>{p.title}</h3>
                <p style={{color:'#64748b',fontSize:13,lineHeight:1.6}}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUCIÓN */}
      <section style={{padding:'80px 24px',maxWidth:900,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:48}}>
          <h2 style={{fontSize:32,fontWeight:700,letterSpacing:'-0.02em',marginBottom:12}}>Reservo.AI lo hace por ti</h2>
          <p style={{color:'#64748b',fontSize:16}}>Tu recepcionista digital trabaja 24/7 sin descanso.</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>
          {[
            {icon:'🎙️',title:'Atiende llamadas automáticamente',desc:'Responde con voz natural, en tu idioma, como si fuera una persona real de tu equipo.'},
            {icon:'📋',title:'Crea reservas al instante',desc:'Pregunta los datos necesarios y registra la reserva directamente en tu panel.'},
            {icon:'🔔',title:'Te avisa de lo importante',desc:'Recibe notificaciones cuando hay reservas nuevas, cancelaciones o clientes urgentes.'},
            {icon:'📊',title:'Organiza todo en un panel',desc:'Todas las llamadas, reservas y clientes en un lugar claro y ordenado.'},
          ].map(s=>(
            <div key={s.title} style={{background:'#f8fafc',borderRadius:12,padding:24,border:'1px solid #e2e8f0',display:'flex',gap:16,alignItems:'flex-start'}}>
              <div style={{fontSize:24,flexShrink:0,marginTop:2}}>{s.icon}</div>
              <div>
                <h3 style={{fontWeight:600,fontSize:15,marginBottom:6}}>{s.title}</h3>
                <p style={{color:'#64748b',fontSize:13,lineHeight:1.6}}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DEMO */}
      <section id="demo" style={{background:'#0f172a',padding:'80px 24px',color:'white'}}>
        <div style={{maxWidth:700,margin:'0 auto',textAlign:'center'}}>
          <h2 style={{fontSize:32,fontWeight:700,letterSpacing:'-0.02em',marginBottom:12}}>Así funciona</h2>
          <p style={{color:'#94a3b8',fontSize:16,marginBottom:48}}>En menos de 30 segundos, una llamada se convierte en una reserva confirmada.</p>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:0,flexWrap:'wrap',gap:8}}>
            {[
              {icon:'📞',label:'Cliente llama',color:'#3b82f6'},
              {icon:'→',label:'',color:'#475569',small:true},
              {icon:'🤖',label:'IA responde',color:'#8b5cf6'},
              {icon:'→',label:'',color:'#475569',small:true},
              {icon:'📅',label:'Reserva creada',color:'#10b981'},
              {icon:'→',label:'',color:'#475569',small:true},
              {icon:'🔔',label:'Tú recibes aviso',color:'#f59e0b'},
            ].map((s,i)=>
              s.small
                ? <div key={i} style={{color:'#475569',fontSize:20,padding:'0 4px'}}>→</div>
                : <div key={i} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:'16px 20px',textAlign:'center',minWidth:120}}>
                    <div style={{fontSize:28,marginBottom:8}}>{s.icon}</div>
                    <div style={{fontSize:12,fontWeight:600,color:s.color}}>{s.label}</div>
                  </div>
            )}
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section style={{padding:'80px 24px',maxWidth:1000,margin:'0 auto',textAlign:'center'}}>
        <h2 style={{fontSize:32,fontWeight:700,letterSpacing:'-0.02em',marginBottom:12}}>Precio claro, sin sorpresas</h2>
        <p style={{color:'#64748b',fontSize:16,marginBottom:48}}>Empieza gratis. Escala cuando tu negocio lo necesite.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}}>
          {[
            {name:'Starter',price:'99',calls:'50 llamadas/mes',features:['Panel completo','Reservas automáticas','Soporte email'],cta:'Empezar',highlight:false},
            {name:'Pro',price:'299',calls:'200 llamadas/mes',features:['Todo de Starter','Pedidos online','Analíticas avanzadas','Soporte prioritario'],cta:'El más popular',highlight:true},
            {name:'Business',price:'499',calls:'600 llamadas/mes',features:['Todo de Pro','Multi-ubicación','API personalizada','Soporte 24/7'],cta:'Para empresas',highlight:false},
          ].map(p=>(
            <div key={p.name} style={{background:p.highlight?'linear-gradient(135deg,#1e40af,#3b82f6)':'white',borderRadius:16,padding:'28px 24px',border:p.highlight?'none':'1px solid #e2e8f0',boxShadow:p.highlight?'0 20px 40px rgba(59,130,246,0.25)':null,color:p.highlight?'white':'#0f172a',position:'relative',overflow:'hidden'}}>
              {p.highlight&&<div style={{position:'absolute',top:12,right:12,background:'rgba(255,255,255,0.2)',borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:700}}>POPULAR</div>}
              <div style={{fontSize:13,fontWeight:600,marginBottom:8,opacity:p.highlight?0.85:1,color:p.highlight?'white':'#64748b'}}>{p.name}</div>
              <div style={{fontSize:40,fontWeight:700,letterSpacing:'-0.03em',marginBottom:4}}>{p.price}<span style={{fontSize:16,fontWeight:400,opacity:0.7}}>€/mes</span></div>
              <div style={{fontSize:13,opacity:0.7,marginBottom:20}}>{p.calls}</div>
              <ul style={{listStyle:'none',marginBottom:24,textAlign:'left'}}>
                {p.features.map(f=><li key={f} style={{fontSize:13,padding:'4px 0',display:'flex',alignItems:'center',gap:8,opacity:p.highlight?0.9:0.8}}><span style={{color:p.highlight?'#bfdbfe':'#10b981',fontWeight:700}}>✓</span>{f}</li>)}
              </ul>
              <Link href="/registro" style={{display:'block',padding:'10px',background:p.highlight?'rgba(255,255,255,0.2)':'#1e40af',color:'white',borderRadius:8,fontSize:13,fontWeight:600,textAlign:'center',border:p.highlight?'1px solid rgba(255,255,255,0.3)':'none'}}>
                {p.highlight?'Empezar ahora →':p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{background:'linear-gradient(135deg,#0f172a,#1e3a5f)',padding:'80px 24px',textAlign:'center',color:'white'}}>
        <div style={{maxWidth:600,margin:'0 auto'}}>
          <h2 style={{fontSize:36,fontWeight:700,letterSpacing:'-0.02em',marginBottom:16}}>Empieza con 10 llamadas gratis</h2>
          <p style={{color:'rgba(255,255,255,0.7)',fontSize:16,marginBottom:32}}>Sin tarjeta de crédito. Configurado en 5 minutos.</p>
          <Link href="/registro" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'14px 32px',background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',color:'white',borderRadius:10,fontSize:16,fontWeight:600,boxShadow:'0 4px 20px rgba(59,130,246,0.4)'}}>
            Crear cuenta gratis
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{borderTop:'1px solid #e2e8f0',padding:'24px',textAlign:'center',background:'white'}}>
        <p style={{fontSize:12,color:'#94a3b8'}}>© 2025 Reservo.AI · Todos los derechos reservados</p>
      </footer>
    </div>
  )
}