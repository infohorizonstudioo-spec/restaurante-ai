'use client'
import { useState } from 'react'

const C = {
  bg:'#0C1018', card:'#131920', card2:'#161D2A', border:'rgba(255,255,255,0.08)',
  text:'#E8EEF6', sub:'#8895A7', muted:'#49566A', amber:'#F0A84E',
  green:'#34D399', red:'#F87171', teal:'#2DD4BF',
  amberDim:'rgba(240,168,78,0.12)',
}

const SECTIONS = [
  {
    icon:'🤖', title:'¿Qué es Sofía?',
    content:`Tu recepcionista virtual atiende el teléfono por ti las 24 horas, sin descansos, sin días libres.

Cuando un cliente llama:
• Le saluda y entiende qué quiere
• Si quiere reservar, apunta los datos y confirma
• Si quiere pedir algo, toma el pedido
• Si tiene una pregunta, la responde con la información de tu negocio

Tú no tienes que estar pendiente del teléfono. Ella lo hace por ti.`
  },
  {
    icon:'📞', title:'¿Qué pasa cuando entra una llamada?',
    content:`1. El cliente llama a tu número
2. Sofía coge el teléfono y saluda
3. Entiende lo que quiere el cliente
4. Actúa según tus reglas:
   • Si es una reserva normal → la confirma automáticamente
   • Si es algo especial → te avisa para que lo revises tú
5. Al terminar, ves el resumen en tu panel

Todo queda guardado: la reserva, el nombre del cliente y lo que pidió.`
  },
  {
    icon:'✅', title:'¿Cuándo confirma Sofía sola?',
    content:`Sofía confirma automáticamente cuando:
• La reserva es para pocas personas (tú decides el límite)
• El horario es normal
• No hay nada especial que revisar

Sofía te avisa y espera tu revisión cuando:
• El grupo es más grande de lo que hayas configurado
• El cliente menciona alergias
• Es una celebración o evento especial
• Hay algo inusual en la petición

Tú controlas esto en Configuración → "¿Cuándo quieres que confirme sola?"`
  },
  {
    icon:'👁', title:'¿Qué significa "Revísalo tú"?',
    content:`Cuando ves que una llamada dice "Revísalo tú", significa que Sofía recibió la llamada pero prefiere que tú tomes la decisión final.

No es un error. Es Sofía siendo prudente.

Qué hacer:
1. Ve a "Llamadas recibidas"
2. Abre la llamada marcada
3. Lee el resumen
4. Decide si confirmar o no
5. Llama al cliente si hace falta

Esto ocurre sobre todo con grupos grandes o peticiones especiales.`
  },
  {
    icon:'⚙️', title:'¿Cómo configuro a Sofía?',
    content:`Ve a "Configuración" en el menú lateral.

Las cosas más importantes que puedes ajustar:

🔹 Nombre del negocio y de Sofía
🔹 Hasta cuántas personas confirma sola (ej: grupos de más de 6 → te avisa)
🔹 Qué hace cuando hay alergias o celebraciones
🔹 La carta y productos que tiene tu negocio
🔹 La información que Sofía usa para responder preguntas

Funciona como entrenar a una empleada nueva: cuéntale cómo funciona tu negocio y ella lo aplicará.`
  },
  {
    icon:'📋', title:'¿Cómo gestiono las reservas?',
    content:`Tienes dos vistas para ver tus reservas:

📅 RESERVAS — Lista de todas las reservas del día o de la semana
📆 AGENDA — Vista de calendario, como una agenda visual

En ambas puedes:
• Ver qué reservas hay y a qué hora
• Cambiar el estado de una reserva
• Añadir una reserva manualmente

Las reservas que confirma Sofía aparecen automáticamente. No tienes que hacer nada.`
  },
  {
    icon:'🍽️', title:'¿Para qué sirve la Carta?',
    content:`En "Carta y productos" puedes decirle a Sofía qué ofreces y qué hay disponible hoy.

Por ejemplo:
• Chuletón de buey: queda 1 ración hoy → Sofía lo sabe y no lo ofrecerá cuando se acabe
• Rodaballo: requiere encargo → Sofía avisará al cliente
• Bacalao: no disponible hoy → Sofía no lo mencionará

Así Sofía nunca confirma algo que no puedes servir.

Actualiza la disponibilidad cada día para que Sofía tenga información correcta.`
  },
  {
    icon:'💡', title:'Consejos rápidos',
    content:`✅ Rellena bien la carta y los horarios — Sofía responderá mejor
✅ Pon el nombre real de tu negocio — los clientes lo escucharán
✅ Revisa las llamadas marcadas al final del día — son las que necesitan tu decisión
✅ Si Sofía comete un error, corrígelo en la llamada — aprenderá

❌ No dejes la carta vacía — Sofía no sabrá qué ofreces
❌ No te preocupes si Sofía tiene dudas — es normal al principio
❌ No ignores las llamadas marcadas como "Revísalo tú"`
  },
]

export default function HelpButton() {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState(0)

  return (
    <>
      {/* Botón flotante ? */}
      <button onClick={() => setOpen(true)} style={{
        position:'fixed', bottom:24, right:24, zIndex:500,
        width:44, height:44, borderRadius:'50%',
        background:`linear-gradient(135deg,${C.amber},#E8923A)`,
        border:'none', cursor:'pointer', color:'#0C1018',
        fontSize:20, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:`0 4px 20px rgba(240,168,78,0.4)`,
        transition:'transform 0.15s, box-shadow 0.15s',
        fontFamily:'inherit',
      }}
        onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.1)')}
        onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')}
        title="Ayuda — ¿Cómo funciona esto?"
      >?</button>

      {/* Panel de ayuda */}
      {open && (
        <div style={{
          position:'fixed', inset:0, zIndex:1000,
          display:'flex', alignItems:'flex-end', justifyContent:'flex-end',
          padding:16, pointerEvents:'none',
        }}>
          {/* Overlay para cerrar */}
          <div style={{position:'absolute',inset:0,pointerEvents:'auto'}} onClick={()=>setOpen(false)}/>

          <div style={{
            position:'relative', pointerEvents:'auto',
            width:400, height:'85vh', maxHeight:640,
            background:C.card, border:`1px solid ${C.border}`,
            borderRadius:18, overflow:'hidden',
            boxShadow:'0 24px 80px rgba(0,0,0,0.6)',
            display:'flex', flexDirection:'column',
            fontFamily:"'Sora',-apple-system,sans-serif",
            animation:'helpSlideIn 0.2s ease',
          }}>
            <style>{`
              @keyframes helpSlideIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
              .help-section-btn{background:none;border:none;cursor:pointer;text-align:left;width:100%;padding:10px 14px;border-radius:9px;transition:background 0.12s;font-family:inherit;}
              .help-section-btn:hover{background:rgba(255,255,255,0.05);}
              .help-section-btn.active{background:${C.amberDim};}
            `}</style>

            {/* Header */}
            <div style={{padding:'16px 18px 12px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div>
                <p style={{fontSize:15,fontWeight:700,color:C.text}}>¿Cómo funciona?</p>
                <p style={{fontSize:11,color:C.muted,marginTop:1}}>Todo lo que necesitas saber</p>
              </div>
              <button onClick={()=>setOpen(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.muted,lineHeight:1,padding:4}}>✕</button>
            </div>

            <div style={{display:'flex',flex:1,overflow:'hidden'}}>
              {/* Índice lateral */}
              <div style={{width:150,borderRight:`1px solid ${C.border}`,padding:'10px 8px',overflowY:'auto',flexShrink:0}}>
                {SECTIONS.map((s,i)=>(
                  <button key={i} onClick={()=>setSection(i)}
                    className={`help-section-btn${section===i?' active':''}`}
                    style={{color:section===i?C.amber:C.sub,fontSize:11,fontWeight:section===i?700:500}}>
                    <span style={{display:'block',marginBottom:2}}>{s.icon}</span>
                    {s.title.split('?')[0].replace('¿','').trim()}
                  </button>
                ))}
              </div>

              {/* Contenido */}
              <div style={{flex:1,overflow:'auto',padding:'18px 16px'}}>
                <p style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:12,lineHeight:1.3}}>
                  {SECTIONS[section].icon} {SECTIONS[section].title}
                </p>
                <div style={{fontSize:13,color:C.sub,lineHeight:1.8,whiteSpace:'pre-line'}}>
                  {SECTIONS[section].content}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{padding:'10px 18px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
              <button onClick={()=>setSection(s=>Math.max(0,s-1))} disabled={section===0}
                style={{fontSize:12,color:section===0?C.muted:C.amber,background:'none',border:'none',cursor:section===0?'default':'pointer',fontFamily:'inherit',fontWeight:600,padding:'4px 8px'}}>
                ← Anterior
              </button>
              <span style={{fontSize:10,color:C.muted}}>{section+1} / {SECTIONS.length}</span>
              <button onClick={()=>setSection(s=>Math.min(SECTIONS.length-1,s+1))} disabled={section===SECTIONS.length-1}
                style={{fontSize:12,color:section===SECTIONS.length-1?C.muted:C.amber,background:'none',border:'none',cursor:section===SECTIONS.length-1?'default':'pointer',fontFamily:'inherit',fontWeight:600,padding:'4px 8px'}}>
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
