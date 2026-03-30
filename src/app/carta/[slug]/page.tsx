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
}

export default async function CartaPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Find tenant by slug
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug')
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

  // Fetch active menu items
  const { data: items } = await supabase
    .from('menu_items')
    .select('id, name, price, category, image_url, description')
    .eq('tenant_id', tenant.id)
    .eq('active', true)
    .order('category')
    .order('name')

  const menuItems: MenuItem[] = (items || []) as MenuItem[]

  // Group by category
  const categories: Record<string, MenuItem[]> = {}
  for (const item of menuItems) {
    const cat = item.category || 'Otros'
    if (!categories[cat]) categories[cat] = []
    categories[cat].push(item)
  }
  const categoryNames = Object.keys(categories)

  return (
    <div style={{
      minHeight: '100vh', background: '#0C1018',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '32px 20px 24px', textAlign: 'center',
        background: 'linear-gradient(180deg, #131920 0%, #0C1018 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <h1 style={{
          fontSize: 28, fontWeight: 800, color: '#E8EEF6',
          letterSpacing: '-0.02em', margin: 0,
        }}>
          {tenant.name}
        </h1>
        <p style={{ fontSize: 14, color: '#8895A7', marginTop: 8 }}>
          Nuestra carta
        </p>
      </div>

      {/* Category nav */}
      {categoryNames.length > 1 && (
        <div style={{
          display: 'flex', gap: 8, padding: '16px 20px',
          overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          {categoryNames.map(cat => (
            <a key={cat} href={`#cat-${cat.replace(/\s+/g, '-')}`} style={{
              padding: '8px 16px', borderRadius: 20,
              background: 'rgba(240,168,78,0.1)', border: '1px solid rgba(240,168,78,0.2)',
              color: '#F0A84E', fontSize: 13, fontWeight: 600,
              textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {cat}
            </a>
          ))}
        </div>
      )}

      {/* Menu items */}
      <div style={{ padding: '16px 20px 40px', maxWidth: 640, margin: '0 auto' }}>
        {menuItems.length === 0 && (
          <p style={{ textAlign: 'center', color: '#8895A7', padding: '40px 0', fontSize: 15 }}>
            La carta se esta preparando...
          </p>
        )}

        {categoryNames.map(cat => (
          <div key={cat} id={`cat-${cat.replace(/\s+/g, '-')}`} style={{ marginBottom: 32 }}>
            <h2 style={{
              fontSize: 18, fontWeight: 700, color: '#F0A84E',
              marginBottom: 16, paddingBottom: 8,
              borderBottom: '1px solid rgba(240,168,78,0.2)',
            }}>
              {cat}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {categories[cat].map(item => (
                <div key={item.id} style={{
                  display: 'flex', gap: 14, padding: '14px 16px',
                  background: '#131920', borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.07)',
                  alignItems: 'center',
                }}>
                  {item.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.image_url} alt={item.name}
                      style={{
                        width: 60, height: 60, borderRadius: 10, objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#E8EEF6', margin: 0 }}>
                      {item.name}
                    </p>
                    {item.description && (
                      <p style={{ fontSize: 12, color: '#8895A7', margin: '4px 0 0', lineHeight: 1.4 }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span style={{
                    fontSize: 16, fontWeight: 800, color: '#F0A84E',
                    flexShrink: 0, fontFamily: 'monospace',
                  }}>
                    {item.price.toFixed(2)}{'\u20AC'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center', padding: '20px', borderTop: '1px solid rgba(255,255,255,0.07)',
        color: '#49566A', fontSize: 11,
      }}>
        Powered by Reservo.AI
      </div>
    </div>
  )
}
