import { createClient } from '@supabase/supabase-js'
import OrderFlow from './OrderFlow'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

interface MenuItem {
  id: string
  name: string
  price: number
  category: string
  description?: string
  image_url?: string
  availability_type?: string
}

export default async function PedirPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ mesa?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const mesa = sp.mesa || null

  // Load tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, type, logo_url, slug')
    .ilike('slug', slug)
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

  // Load menu
  const { data: items } = await supabase
    .from('menu_items')
    .select('id, name, price, category, description, image_url, availability_type')
    .eq('tenant_id', tenant.id)
    .eq('active', true)
    .order('category')
    .order('sort_order')

  return <OrderFlow tenant={tenant} items={(items || []) as MenuItem[]} mesa={mesa} slug={slug} />
}
