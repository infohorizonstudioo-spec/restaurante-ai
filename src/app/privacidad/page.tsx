import Link from 'next/link'

export default function PrivacidadPage() {
  return (
    <div style={{ background: '#0C1018', minHeight: '100vh', color: '#E8EEF6', padding: '60px 24px', fontFamily: "'Sora',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/" style={{ color: '#F0A84E', fontSize: 14, textDecoration: 'none', marginBottom: 32, display: 'inline-block' }}>&larr; Volver</Link>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Política de Privacidad</h1>
        <div style={{ fontSize: 15, lineHeight: 1.8, color: '#8895A7' }}>
          <p style={{ marginBottom: 16 }}>En Reservo.AI, nos tomamos tu privacidad muy en serio. Esta política describe cómo recopilamos, usamos y protegemos tu información personal.</p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E8EEF6', marginTop: 32, marginBottom: 12 }}>Datos que recopilamos</h2>
          <p style={{ marginBottom: 16 }}>Recopilamos los datos necesarios para operar el servicio: nombre del negocio, datos de contacto, información de reservas, llamadas y mensajes de tus clientes.</p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E8EEF6', marginTop: 32, marginBottom: 12 }}>Cómo usamos tus datos</h2>
          <p style={{ marginBottom: 16 }}>Tus datos se usan exclusivamente para proporcionar y mejorar el servicio de Reservo.AI. No vendemos ni compartimos datos personales con terceros para fines de marketing.</p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E8EEF6', marginTop: 32, marginBottom: 12 }}>Seguridad</h2>
          <p style={{ marginBottom: 16 }}>Utilizamos cifrado en tránsito (TLS) y en reposo. Los datos se almacenan en servidores seguros con acceso restringido.</p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E8EEF6', marginTop: 32, marginBottom: 12 }}>Tus derechos</h2>
          <p style={{ marginBottom: 16 }}>Puedes solicitar acceso, rectificación o eliminación de tus datos en cualquier momento escribiendo a hola@reservo.ai.</p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E8EEF6', marginTop: 32, marginBottom: 12 }}>Contacto</h2>
          <p>Para cualquier consulta sobre privacidad: hola@reservo.ai</p>
        </div>
      </div>
    </div>
  )
}
