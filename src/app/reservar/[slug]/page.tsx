import { createClient } from '@supabase/supabase-js'
import PublicReservationForm from './PublicReservationForm'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function ReservarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, logo_url, address, phone')
    .eq('slug', slug)
    .maybeSingle()

  if (!tenant) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0C1018', color: '#E8EEF6', fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 48, marginBottom: 8 }}>404</h1>
          <p style={{ color: '#8895A7' }}>Negocio no encontrado</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0C1018',
      fontFamily: "'Sora', -apple-system, sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 440,
        background: '#131920', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20, padding: 32,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {tenant.logo_url && (
            <img src={tenant.logo_url} alt={tenant.name} style={{
              width: 64, height: 64, objectFit: 'contain', borderRadius: 12,
              margin: '0 auto 12px', display: 'block',
              border: '1px solid rgba(255,255,255,0.07)',
            }} />
          )}
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#E8EEF6', margin: 0 }}>
            {tenant.name}
          </h1>
          <p style={{ fontSize: 13, color: '#8895A7', marginTop: 6 }}>
            Reserva tu mesa
          </p>
          {tenant.address && (
            <p style={{ fontSize: 12, color: '#49566A', marginTop: 4 }}>{tenant.address}</p>
          )}
        </div>

        <PublicReservationForm slug={slug} />

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <p style={{ fontSize: 10, color: '#49566A' }}>Powered by Reservo.AI</p>
        </div>
      </div>
    </div>
  )
}
