import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

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
  image_url?: string
  description?: string
  featured?: boolean
  featured_label?: string
  availability_type?: string
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data: tenant } = await supabase.from('tenants').select('name').eq('slug', slug).maybeSingle()
  const name = tenant?.name || slug
  return {
    title: `${name} — Carta`,
    description: `Consulta la carta de ${name}. Precios, platos y especialidades.`,
    openGraph: { title: `${name} — Carta`, description: `Carta digital de ${name}` },
  }
}

export default async function CartaPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Find tenant by slug
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
          <p style={{ color: '#8895A7' }}>Carta no encontrada</p>
        </div>
      </div>
    )
  }

  // Fetch active menu items (including featured + availability)
  const { data: items } = await supabase
    .from('menu_items')
    .select('id, name, price, category, image_url, description, featured, featured_label, availability_type')
    .eq('tenant_id', tenant.id)
    .eq('active', true)
    .order('category')
    .order('name')

  // Filter out unavailable items
  const menuItems: MenuItem[] = ((items || []) as MenuItem[]).filter(
    i => i.availability_type !== 'unavailable'
  )

  // Separate featured items
  const featuredItems = menuItems.filter(i => i.featured)

  // Group non-featured by category
  const categories: Record<string, MenuItem[]> = {}
  for (const item of menuItems) {
    if (item.featured) continue // shown in specials section
    const cat = item.category || 'Otros'
    if (!categories[cat]) categories[cat] = []
    categories[cat].push(item)
  }
  const categoryNames = Object.keys(categories)

  const hasProducts = menuItems.length > 0
  const pedir_url = `/pedir/${tenant.slug}`

  return (
    <div style={{
      minHeight: '100vh', background: '#0C1018',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: 680, margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '28px 20px 20px', textAlign: 'center',
        background: 'linear-gradient(180deg, #131920 0%, #0C1018 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {tenant.logo_url && (
          <img src={tenant.logo_url} alt={tenant.name}
            style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', marginBottom: 10 }} />
        )}
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#E8EEF6', letterSpacing: '-0.02em', margin: 0 }}>
          {tenant.name}
        </h1>
        {tenant.address && (
          <p style={{ fontSize: 12, color: '#49566A', marginTop: 6 }}>{tenant.address}</p>
        )}
      </div>

      {/* Category nav */}
      {categoryNames.length > 1 && (
        <div style={{
          display: 'flex', gap: 6, padding: '12px 20px',
          overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.06)',
          WebkitOverflowScrolling: 'touch',
        }}>
          {categoryNames.map(cat => (
            <a key={cat} href={`#cat-${cat.replace(/\s+/g, '-')}`} style={{
              padding: '7px 14px', borderRadius: 20,
              background: 'rgba(240,168,78,0.08)', border: '1px solid rgba(240,168,78,0.18)',
              color: '#F0A84E', fontSize: 12, fontWeight: 600,
              textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {cat}
            </a>
          ))}
        </div>
      )}

      {/* Especiales del d\u00eda */}
      {featuredItems.length > 0 && (
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>{'\u2B50'}</span>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#F0A84E', margin: 0 }}>Recomendaciones</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {featuredItems.map(item => (
              <div key={item.id} style={{
                display: 'flex', gap: 12, padding: '12px 14px',
                background: 'rgba(240,168,78,0.04)', borderRadius: 12,
                border: '1px solid rgba(240,168,78,0.20)',
                alignItems: 'center',
              }}>
                {item.image_url && (
                  <img src={item.image_url} alt={item.name} style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#E8EEF6', margin: 0 }}>{item.name}</p>
                  {item.description && (
                    <p style={{ fontSize: 11, color: '#8895A7', margin: '3px 0 0', lineHeight: 1.4 }}>{item.description}</p>
                  )}
                  {item.featured_label && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#F0A84E', background: 'rgba(240,168,78,0.12)', padding: '2px 7px', borderRadius: 5, marginTop: 4, display: 'inline-block' }}>
                      {item.featured_label}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#F0A84E', flexShrink: 0 }}>
                  {item.price.toFixed(2)}\u20AC
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Carta */}
      <div style={{ padding: '18px 20px 32px' }}>
        {!hasProducts && (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{'\uD83C\uDF7D\uFE0F'}</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#E8EEF6', marginBottom: 6 }}>
              Carta en preparaci\u00f3n
            </p>
            <p style={{ fontSize: 13, color: '#8895A7' }}>
              Estamos actualizando nuestra carta. Vuelve pronto.
            </p>
          </div>
        )}

        {categoryNames.map(cat => (
          <div key={cat} id={`cat-${cat.replace(/\s+/g, '-')}`} style={{ marginBottom: 28 }}>
            <h2 style={{
              fontSize: 15, fontWeight: 700, color: '#F0A84E',
              marginBottom: 12, paddingBottom: 6,
              borderBottom: '1px solid rgba(240,168,78,0.15)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              {cat}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {categories[cat].map((item, idx) => (
                <div key={item.id} style={{
                  display: 'flex', gap: 12, padding: '12px 0',
                  borderBottom: idx < categories[cat].length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  alignItems: 'center',
                }}>
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name}
                      style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#E8EEF6', margin: 0 }}>
                      {item.name}
                    </p>
                    {item.description && (
                      <p style={{ fontSize: 11, color: '#6B7A8D', margin: '3px 0 0', lineHeight: 1.4 }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#F0A84E', flexShrink: 0 }}>
                    {item.price.toFixed(2)}\u20AC
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* CTA: hacer pedido */}
      {hasProducts && (
        <div style={{ padding: '0 20px 24px' }}>
          <a href={pedir_url} style={{
            display: 'block', textAlign: 'center', padding: '14px',
            borderRadius: 12, background: 'linear-gradient(135deg, #F0A84E, #E8923A)',
            color: '#0C1018', fontSize: 15, fontWeight: 800,
            textDecoration: 'none', boxShadow: '0 4px 16px rgba(240,168,78,0.3)',
          }}>
            Hacer pedido
          </a>
        </div>
      )}

      {/* Footer */}
      <div style={{
        textAlign: 'center', padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
        color: '#3A4555', fontSize: 10,
      }}>
        {tenant.phone && <p style={{ marginBottom: 4 }}>{tenant.phone}</p>}
        Carta digital by Reservo.AI
      </div>
    </div>
  )
}
