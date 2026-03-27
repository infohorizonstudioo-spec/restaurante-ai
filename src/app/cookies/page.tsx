import Link from 'next/link'

export default function CookiesPage() {
  return (
    <div style={{ background: '#0C1018', minHeight: '100vh', color: '#E8EEF6', padding: '60px 24px', fontFamily: "'Sora',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/" style={{ color: '#F0A84E', fontSize: 14, textDecoration: 'none', marginBottom: 32, display: 'inline-block' }}>&larr; Volver</Link>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Política de Cookies</h1>
        <div style={{ fontSize: 15, lineHeight: 1.8, color: '#8895A7' }}>
          <p style={{ marginBottom: 16 }}>Esta política explica cómo Reservo.AI utiliza cookies y tecnologías similares para reconocerte cuando visitas nuestra plataforma.</p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E8EEF6', marginTop: 32, marginBottom: 12 }}>Qué son las cookies</h2>
          <p style={{ marginBottom: 16 }}>Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas un sitio web. Permiten que el sitio recuerde tus acciones y preferencias durante un período de tiempo.</p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E8EEF6', marginTop: 32, marginBottom: 12 }}>Cookies que usamos</h2>
          <p style={{ marginBottom: 8 }}><strong style={{ color: '#E8EEF6' }}>Esenciales:</strong> Necesarias para el funcionamiento del servicio. Incluyen cookies de sesión y autenticación. No se pueden desactivar.</p>
          <p style={{ marginBottom: 16 }}><strong style={{ color: '#E8EEF6' }}>Analytics:</strong> Nos ayudan a entender cómo se usa la plataforma para mejorar la experiencia. Utilizamos herramientas de análisis que recopilan datos anónimos de uso.</p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E8EEF6', marginTop: 32, marginBottom: 12 }}>Cómo desactivarlas</h2>
          <p style={{ marginBottom: 16 }}>Puedes configurar tu navegador para rechazar cookies o eliminar las existentes. Ten en cuenta que desactivar las cookies esenciales puede afectar al funcionamiento del servicio.</p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E8EEF6', marginTop: 32, marginBottom: 12 }}>Contacto</h2>
          <p>Para consultas sobre cookies: hola@reservo.ai</p>
        </div>
      </div>
    </div>
  )
}
