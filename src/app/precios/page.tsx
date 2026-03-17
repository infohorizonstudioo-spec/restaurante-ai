'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 99, calls: 50, extra: 0.90,
    badge: null, highlight: false,
    desc: 'Para autónomos y pequeños negocios que empiezan a automatizar.',
    features: ['Recepcionista virtual 24/7','Panel de control completo','Gestión de reservas y citas','Historial de clientes','Resumen automático de llamadas','50 llamadas incluidas/mes'],
    priceId: 'price_1TBtxK0yU3RZWdR1MP4Z1lwj',
  },
  {
    id: 'pro', name: 'Pro', price: 299, calls: 200, extra: 0.70,
    badge: 'Más popular', highlight: true,
    desc: 'Para negocios en crecimiento que necesitan más volumen y funciones.',
    features: ['Todo lo del plan Starter','Zonas y mesas del local','Confirmaciones automáticas','Recordatorios de cita','Recuperación de llamadas perdidas','Estadísticas avanzadas','200 llamadas incluidas/mes'],
    priceId: 'price_1TBtxM0yU3RZWdR1DGs87LNC',
  },
  {
    id: 'business', name: 'Business', price: 499, calls: 600, extra: 0.50,
    badge: null, highlight: false,
    desc: 'Para cadenas y franquicias con alto volumen de llamadas.',
    features: ['Todo lo del plan Pro','Multi-ubicación','Acceso API completo','Gestor de cuenta dedicado','SLA garantizado','600 llamadas incluidas/mes'],
    priceId: 'price_1TBtxN0yU3RZWdR1dAiCDE3n',
  },
]

export default function PreciosPage() {
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('tenant_id').eq('id', user.id).single().then(({ data: p }) => {
        if (!p?.tenant_id) return
        supabase.from('tenants').select('*').eq('id', p.tenant_id).single().then(({ data: t }) => setTenant(t))
      })
    })
  }, [])

  async function checkout(priceId: string) {
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, tenantId: tenant?.id }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (e: any) {
      setErr(e.message || 'Error al procesar el pago')
      setLoading(false)
    }
  }

  const currentPlan = tenant?.plan

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif}
        .plan-card{transition:transform 0.2s,box-shadow 0.2s}
        .plan-card:hover{transform:translateY(-4px)}
        .feat-item{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}
      `}</style>

      {/* Nav */}
      <nav style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 clamp(16px,4vw,48px)', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#1e40af,#3b82f6)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Reservo.AI</span>
        </Link>
        <div style={{ display: 'flex', gap: 8 }}>
          {tenant
            ? <Link href="/panel" style={{ padding: '7px 16px', fontSize: 13, fontWeight: 500, color: '#1d4ed8', textDecoration: 'none' }}>← Mi panel</Link>
            : <><Link href="/login" style={{ padding: '7px 16px', fontSize: 13, color: '#64748b', textDecoration: 'none' }}>Iniciar sesión</Link>
               <Link href="/registro" style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#1e40af,#3b82f6)', borderRadius: 8, textDecoration: 'none' }}>Empezar gratis</Link></>
          }
        </div>
      </nav>

      {/* Header */}
      <div style={{ textAlign: 'center', padding: 'clamp(40px,6vw,72px) 24px 48px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 20, padding: '4px 14px', marginBottom: 20 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', animation: 'pulse 2s infinite' }}/>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8', letterSpacing: '0.04em' }}>SIN PERMANENCIA · CANCELA CUANDO QUIERAS</span>
        </div>
        <h1 style={{ fontSize: 'clamp(28px,4vw,46px)', fontWeight: 700, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: 12 }}>Elige tu plan</h1>
        <p style={{ fontSize: 16, color: '#64748b', maxWidth: 440, margin: '0 auto 16px' }}>Empieza con 10 llamadas gratis. Sin tarjeta de crédito.</p>

        {/* Trial badge */}
        {tenant && (currentPlan === 'free' || currentPlan === 'trial' || !currentPlan) && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '1px solid #fbbf24', borderRadius: 10, padding: '8px 18px', marginTop: 8 }}>
            <span style={{ fontSize: 16 }}>⚡</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
              Te quedan {Math.max(0, (tenant.free_calls_limit || 10) - (tenant.free_calls_used || 0))} llamadas gratuitas
            </span>
          </div>
        )}
        {tenant && currentPlan && !['free','trial'].includes(currentPlan) && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '8px 18px', marginTop: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>Plan activo: {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</span>
          </div>
        )}
      </div>

      {/* Cards */}
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 clamp(16px,4vw,40px) 80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20, alignItems: 'start' }}>
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.id
          const isHighlight = plan.highlight

          return (
            <div key={plan.id} className="plan-card" style={{
              background: isHighlight ? 'linear-gradient(155deg,#1e3a8a,#1e40af)' : 'white',
              borderRadius: 18,
              border: isHighlight ? 'none' : isCurrent ? '2px solid #3b82f6' : '1px solid #e2e8f0',
              padding: '30px 26px 26px',
              boxShadow: isHighlight ? '0 20px 60px rgba(30,64,175,0.3)' : isCurrent ? '0 0 0 4px rgba(59,130,246,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
              color: isHighlight ? 'white' : '#0f172a',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Shine effect for highlight */}
              {isHighlight && <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, background: 'rgba(255,255,255,0.05)', borderRadius: '50%', pointerEvents: 'none' }}/>}

              {/* Badge */}
              {plan.badge && (
                <div style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, color: 'white', letterSpacing: '0.03em' }}>
                  {plan.badge}
                </div>
              )}
              {isCurrent && !isHighlight && (
                <div style={{ position: 'absolute', top: 18, right: 18, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>
                  Plan actual
                </div>
              )}

              {/* Plan name */}
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: isHighlight ? 'rgba(255,255,255,0.6)' : '#94a3b8', marginBottom: 12 }}>{plan.name}</p>

              {/* Price */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: isHighlight ? 'white' : '#0f172a' }}>{plan.price}</span>
                <span style={{ fontSize: 15, fontWeight: 400, color: isHighlight ? 'rgba(255,255,255,0.55)' : '#94a3b8', paddingBottom: 6 }}>€/mes</span>
              </div>
              <p style={{ fontSize: 12, color: isHighlight ? 'rgba(255,255,255,0.5)' : '#94a3b8', marginBottom: 6 }}>{plan.calls} llamadas incluidas · {plan.extra}€ extra</p>
              <p style={{ fontSize: 13, color: isHighlight ? 'rgba(255,255,255,0.65)' : '#64748b', lineHeight: 1.55, marginBottom: 24, minHeight: 40 }}>{plan.desc}</p>

              {/* CTA */}
              {err && <p style={{ fontSize: 12, color: isHighlight ? '#fca5a5' : '#dc2626', marginBottom: 10 }}>{err}</p>}
              {isCurrent
                ? <div style={{ padding: '11px', background: isHighlight ? 'rgba(255,255,255,0.1)' : '#f8fafc', border: '1px solid', borderColor: isHighlight ? 'rgba(255,255,255,0.15)' : '#e2e8f0', borderRadius: 10, fontSize: 14, fontWeight: 600, color: isHighlight ? 'rgba(255,255,255,0.7)' : '#94a3b8', textAlign: 'center' as const }}>
                    Plan activo ✓
                  </div>
                : tenant
                  ? <button onClick={() => checkout(plan.priceId)} disabled={loading} style={{ width: '100%', padding: '12px', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: isHighlight ? '#1e40af' : 'white', background: isHighlight ? 'white' : 'linear-gradient(135deg,#1e40af,#3b82f6)', border: 'none', borderRadius: 10, cursor: 'pointer', boxShadow: isHighlight ? '0 4px 16px rgba(0,0,0,0.1)' : '0 2px 8px rgba(59,130,246,0.3)', transition: 'all 0.15s', opacity: loading ? 0.6 : 1 }}>
                      {loading ? 'Procesando...' : isCurrent ? 'Plan actual' : 'Seleccionar plan'}
                    </button>
                  : <Link href="/registro" style={{ display: 'block', padding: '12px', fontSize: 14, fontWeight: 600, color: isHighlight ? '#1e40af' : 'white', background: isHighlight ? 'white' : 'linear-gradient(135deg,#1e40af,#3b82f6)', borderRadius: 10, textAlign: 'center' as const, textDecoration: 'none', boxShadow: isHighlight ? '0 4px 16px rgba(0,0,0,0.1)' : '0 2px 8px rgba(59,130,246,0.3)' }}>
                      Empezar ahora →
                    </Link>
              }

              {/* Divider */}
              <div style={{ height: 1, background: isHighlight ? 'rgba(255,255,255,0.1)' : '#f1f5f9', margin: '22px 0' }}/>

              {/* Features */}
              <div>
                {plan.features.map(f => (
                  <div key={f} className="feat-item">
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: isHighlight ? 'rgba(255,255,255,0.12)' : '#eff6ff', border: '1px solid', borderColor: isHighlight ? 'rgba(255,255,255,0.2)' : '#bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke={isHighlight ? '#86efac' : '#1d4ed8'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <span style={{ fontSize: 13, color: isHighlight ? 'rgba(255,255,255,0.8)' : '#475569', lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* FAQ strip */}
      <div style={{ background: 'white', borderTop: '1px solid #e2e8f0', padding: '48px clamp(16px,4vw,48px)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a', marginBottom: 28, textAlign: 'center' as const }}>Preguntas frecuentes</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
            {[
              { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí. Sin permanencia ni penalizaciones. Cancela desde tu panel con un clic.' },
              { q: '¿Qué pasa si supero las llamadas incluidas?', a: 'Se factura automáticamente al precio extra de tu plan. Siempre visible en tu panel.' },
              { q: '¿Puedo cambiar de plan?', a: 'En cualquier momento. Si subes de plan, el cambio es inmediato. Si bajas, se aplica al siguiente ciclo.' },
              { q: '¿Cómo funciona el trial gratuito?', a: '10 llamadas completamente gratis. Sin tarjeta de crédito. Sin compromiso.' },
            ].map(faq => (
              <div key={faq.q} style={{ padding: '18px 20px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 7 }}>{faq.q}</p>
                <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}