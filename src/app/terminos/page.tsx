import Link from 'next/link'

export default function TerminosPage() {
  return (
    <div style={{ background: '#0C1018', minHeight: '100vh', color: '#E8EEF6', padding: '60px 24px', fontFamily: "'Sora',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/" style={{ color: '#F0A84E', fontSize: 14, textDecoration: 'none', marginBottom: 32, display: 'inline-block' }}>&larr; Volver</Link>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Términos de Servicio</h1>
        <div style={{ fontSize: 15, lineHeight: 1.8, color: '#8895A7' }}>
          <p style={{ marginBottom: 16 }}>Al usar Reservo.AI aceptas los siguientes términos y condiciones. Por favor, léelos con atención antes de utilizar el servicio.</p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E8EEF6', marginTop: 32, marginBottom: 12 }}>Uso del servicio</h2>
          <p style={{ marginBottom: 16 }}>Reservo.AI proporciona una plataforma de gestión inteligente para negocios, incluyendo agente de voz, gestión de reservas, mensajería multicanal y más. El uso del servicio está sujeto a estas condiciones.</p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E8EEF6', marginTop: 32, marginBottom: 12 }}>Responsabilidades</h2>
          <p style={{ marginBottom: 16 }}>Eres responsable de mantener la confidencialidad de tu cuenta y contraseña. También eres responsable de la exactitud de los datos que introduces en la plataforma.</p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E8EEF6', marginTop: 32, marginBottom: 12 }}>Facturación</h2>
          <p style={{ marginBottom: 16 }}>Los planes de pago se facturan mensualmente. El acceso al servicio está condicionado al pago puntual de la suscripción correspondiente.</p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E8EEF6', marginTop: 32, marginBottom: 12 }}>Cancelaciones</h2>
          <p style={{ marginBottom: 16 }}>Puedes cancelar tu suscripción en cualquier momento. La cancelación será efectiva al final del período de facturación vigente. No se realizan reembolsos por períodos parciales.</p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E8EEF6', marginTop: 32, marginBottom: 12 }}>Limitaciones</h2>
          <p style={{ marginBottom: 16 }}>Reservo.AI no garantiza disponibilidad ininterrumpida del servicio. Nos reservamos el derecho de modificar o discontinuar funcionalidades con previo aviso.</p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E8EEF6', marginTop: 32, marginBottom: 12 }}>Contacto</h2>
          <p>Para consultas sobre estos términos: hola@reservo.ai</p>
        </div>
      </div>
    </div>
  )
}
