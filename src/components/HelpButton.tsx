'use client'
import { useState } from 'react'
import { useTenant } from '@/contexts/TenantContext'

const C = {
  bg:'#0C1018', card:'#131920', card2:'#161D2A', border:'rgba(255,255,255,0.08)',
  text:'#E8EEF6', sub:'#8895A7', muted:'#49566A', amber:'#F0A84E',
  green:'#34D399', red:'#F87171', teal:'#2DD4BF',
  amberDim:'rgba(240,168,78,0.12)',
}

function getSections(name: string, tx: (s:string)=>string) {
  const n = name || 'Sofía'
  return [
    {
      icon:'🤖', title:tx('¿Qué es') + ` ${n}?`,
      content:`${tx('Tu recepcionista virtual atiende el teléfono por ti las 24 horas, sin descansos, sin días libres.')}

${tx('Cuando alguien llama a tu negocio')}:
1. ${n} ${tx('coge el teléfono y saluda')}
2. ${tx('Pregunta qué necesita el cliente')}
3. ${tx('Gestiona reservas, pedidos, consultas')}
4. ${tx('Todo queda guardado en el panel')}`
    },
    {
      icon:'✅', title:tx('¿Cuándo confirma') + ` ${n} ` + tx('sola') + '?',
      content:`${n} ${tx('confirma automáticamente cuando')}:
• ${tx('La reserva es para pocas personas')}
• ${tx('Hay disponibilidad clara')}
• ${tx('No hay peticiones especiales')}

${n} ${tx('te avisa y espera tu revisión cuando')}:
• ${tx('Es un grupo grande')}
• ${tx('Piden algo especial')}
• ${tx('Mencionan alergias')}
• ${tx('Tiene dudas')}`
    },
    {
      icon:'👁', title:tx('¿Qué significa "Revísalo tú"?'),
      content:tx('Significa que tu recepcionista recibió la llamada pero prefiere que tú tomes la decisión final.') + '\n\n' + tx('No es un error. Es prudencia.')
    },
    {
      icon:'⚙️', title:tx('¿Cómo configuro a') + ` ${n}?`,
      content:`${tx('Ve a Configuración. Ahí puedes cambiar')}:

🔹 ${tx('Nombre del negocio y del agente')}
🔹 ${tx('Horarios y capacidad')}
🔹 ${tx('Qué puede hacer sin preguntarte')}
🔹 ${tx('La información que usa para responder')}`
    },
    {
      icon:'📅', title:tx('¿Cómo funcionan las reservas?'),
      content:tx('Las reservas que confirma tu recepcionista aparecen automáticamente. No tienes que hacer nada.')
    },
    {
      icon:'💡', title:tx('Consejos'),
      content:`✅ ${tx('Rellena bien la carta y los horarios')}
✅ ${tx('Revisa las llamadas de vez en cuando')}
✅ ${tx('Si comete un error, corrígelo — aprenderá')}

❌ ${tx('No dejes la carta vacía')}
❌ ${tx('No te preocupes si tiene dudas al principio')}`
    },
  ]
}

export default function HelpButton() {
  const { tenant, tx } = useTenant()
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState(0)
  const agentName = tenant?.agent_name || 'Sofía'
  const sections = getSections(agentName, tx)

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        position:'fixed', bottom:24, right:24, zIndex:500,
        width:44, height:44, borderRadius:'50%',
        background:`linear-gradient(135deg,${C.amber},#E8923A)`,
        border:'none', cursor:'pointer', color:'#0C1018',
        fontSize:20, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:`0 4px 20px rgba(240,168,78,0.4)`,
        transition:'transform 0.15s',
        fontFamily:'inherit',
      }}
        onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.1)')}
        onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')}
        title={tx('Ayuda')}
      >?</button>

      {open && (
        <div style={{
          position:'fixed', inset:0, zIndex:1000,
          display:'flex', alignItems:'flex-end', justifyContent:'flex-end',
          padding:20, background:'rgba(0,0,0,0.5)',
        }} onClick={() => setOpen(false)}>
          <div style={{
            width:420, maxHeight:'80vh', background:C.card,
            borderRadius:16, overflow:'hidden', display:'flex', flexDirection:'column',
            boxShadow:'0 20px 60px rgba(0,0,0,0.7)',
            border:`1px solid ${C.border}`,
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontSize:15, fontWeight:700, color:C.text }}>💡 {tx('Ayuda')}</h2>
              <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', color:C.muted, fontSize:20, cursor:'pointer' }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', overflowX:'auto', borderBottom:`1px solid ${C.border}`, padding:'0 12px', gap:2, scrollbarWidth:'none' }}>
              {sections.map((s, i) => (
                <button key={i} onClick={() => setSection(i)} style={{
                  padding:'10px 12px', fontSize:18, background:'none', border:'none',
                  borderBottom: section === i ? `2px solid ${C.amber}` : '2px solid transparent',
                  cursor:'pointer', flexShrink:0, opacity: section === i ? 1 : 0.5,
                  transition:'all 0.15s',
                }}>{s.icon}</button>
              ))}
            </div>

            {/* Content */}
            <div style={{ padding:'20px', overflowY:'auto', flex:1 }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:12 }}>{sections[section].title}</h3>
              <p style={{ fontSize:13, color:C.sub, lineHeight:1.7, whiteSpace:'pre-wrap' }}>{sections[section].content}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
