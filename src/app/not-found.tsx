import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight:'100vh', background:'#0C1018', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui' }}>
      <div style={{ textAlign:'center', padding:24 }}>
        <div style={{ fontSize:64, marginBottom:16 }}>📞</div>
        <h1 style={{ fontSize:28, fontWeight:800, color:'#E8EEF6', marginBottom:8 }}>Página no encontrada</h1>
        <p style={{ fontSize:14, color:'#8895A7', marginBottom:24, lineHeight:1.6 }}>Esta página no existe o ha sido movida.</p>
        <Link href="/panel" style={{ display:'inline-block', padding:'12px 28px', fontSize:14, fontWeight:700, color:'#0C1018', background:'#F0A84E', borderRadius:10, textDecoration:'none' }}>
          Ir al panel →
        </Link>
      </div>
    </div>
  )
}
