'use client'

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ minHeight:'100vh', background:'#0C1018', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui' }}>
      <div style={{ textAlign:'center', padding:24, maxWidth:400 }}>
        <div style={{ width:64, height:64, borderRadius:16, background:'rgba(248,113,113,0.10)', border:'1px solid rgba(248,113,113,0.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:28 }}>&#9888;&#65039;</div>
        <h2 style={{ fontSize:20, fontWeight:700, color:'#E8EEF6', marginBottom:8 }}>Algo sali&oacute; mal</h2>
        <p style={{ fontSize:14, color:'#8895A7', marginBottom:24, lineHeight:1.6 }}>
          Ha ocurrido un error inesperado. Puedes intentar recargar o volver al panel.
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button onClick={reset} style={{ padding:'10px 24px', fontSize:14, fontWeight:600, color:'#E8EEF6', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, cursor:'pointer', fontFamily:'inherit' }}>
            Reintentar
          </button>
          <a href="/panel" style={{ padding:'10px 24px', fontSize:14, fontWeight:700, color:'#0C1018', background:'#F0A84E', borderRadius:10, textDecoration:'none', display:'inline-block' }}>
            Ir al panel
          </a>
        </div>
      </div>
    </div>
  )
}
