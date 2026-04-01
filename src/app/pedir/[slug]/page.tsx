import type { Metadata } from 'next'
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
  daily_limit?: number
  featured?: boolean
  featured_label?: string
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data: tenant } = await supabase.from('tenants').select('name').ilike('slug', slug).maybeSingle()
  const name = tenant?.name || slug
  return {
    title: `${name} — Pedir`,
    description: `Haz tu pedido en ${name} directamente desde el movil.`,
    openGraph: { title: `${name} — Pedir`, description: `Pedido digital en ${name}` },
  }
}

export default async function PedirPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ mesa?: string; paid?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const mesa = sp.mesa || null
  const justPaid = sp.paid === 'true'

  // Load tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, type, logo_url, slug, whatsapp_phone')
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

  // Load menu with featured and availability fields
  const { data: items } = await supabase
    .from('menu_items')
    .select('id, name, price, category, description, image_url, availability_type, daily_limit, featured, featured_label')
    .eq('tenant_id', tenant.id)
    .eq('active', true)
    .order('category')
    .order('sort_order')

  // Load daily counts to know what's sold out
  const today = new Date().toISOString().slice(0, 10)
  const { data: dailyCounts } = await supabase
    .from('menu_daily_counts')
    .select('item_id, count')
    .eq('tenant_id', tenant.id)
    .eq('date', today)

  const countMap: Record<string, number> = {}
  for (const c of (dailyCounts || [])) {
    countMap[c.item_id] = c.count
  }

  // Look up zone for this table
  let zone: string | null = null
  if (mesa) {
    const { data: tableData } = await supabase.from('tables')
      .select('zone_name').eq('tenant_id', tenant.id).eq('number', String(mesa)).maybeSingle()
    zone = tableData?.zone_name || null
  }

  return <OrderFlow tenant={tenant} items={(items || []) as MenuItem[]} mesa={mesa} zone={zone} slug={slug} dailyCounts={countMap} justPaid={justPaid} />
}
