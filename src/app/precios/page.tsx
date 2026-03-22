'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const C = {
  bg: '#0C1018', card: '#131920', card2: '#161D2A',
  border: 'rgba(255,255,255,0.08)', borderMd: 'rgba(255,255,255,0.13)',
  text: '#E8EEF6', sub: '#8895A7', muted: '#49566A',
  amber: '#F0A84E', green: '#34D399', teal: '#2DD4BF', violet: '#A78BFA',
  amberDim: 'rgba(240,168,78,0.12)', greenDim: 'rgba(52,211,153,0.10)',
  violetDim: 'rgba(167,139,250,0.12)',
}

const PLANS = [
  {
    id: 'starter', label: 'Starter', price: '99', calls: 50, rate: '0.90',
    accent: C.teal, dim: 'rgba(45,212,191,0.10)', popular: false,
    features: ['50 llamadas incluidas', 'Reservas automáticas', 'Panel de clientes', 'Soporte por email'],
  },
  {
    id: 'pro', label: 'Pro', price: '299', calls: 200, rate: '0.70',
    accent: C.amber, dim: C.amberDim, popular: true,
    features: ['200 llamadas incluidas', 'Todo lo de Starter', 'Estadísticas avanzadas', 'Pedidos', 'Soporte prioritario'],
  },
  {
    id: 'business', label: 'Business', price: '499', calls: 600, rate: '0.50',
    accent: C.violet, dim: C.violetDim, popular: false,
    features: ['600 llamadas incluidas', 'Todo lo de Pro', 'Gestión de reparto', 'Multi-zona', 'Soporte dedicado'],
  },
] as const
type PlanId = 'starter' | 'pro' | 'business'

export default function PreciosPage() {
  const [loading, setLoading] = useState<PlanId | null>(null)
  const [error, setError] = useState('')

  async function handlePlan(planId: PlanId) {
    if (loading) return
    setLoading(planId); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/registro'; return }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      const d = await res.json()
      if (d.url) window.location.href = d.url
      else setError(d.error || 'Error al procesar el pago. Inténtalo de nuevo.')
    } catch (e: any) {
      setError(e.message || 'Error de conexión')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 64 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: C.amber, letterSpacing: '-0.02em' }}>Reservo.AI</span>
          <Link href="/panel" style={{ fontSize: 13, color: C.sub, textDecoration: 'none', padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: 8 }}>
            Ir al panel →
          </Link>
        </div>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-block', background: C.amberDim, border: `1px solid ${C.amber}44`, borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600, color: C.amber, marginBottom: 16, letterSpacing: '0.05em' }}>
            PLANES Y PRECIOS
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: C.text, marginBottom: 12, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Planes simples y transparentes
          </h1>
          <p style={{ fontSize: 16, color: C.sub, margin: 0 }}>
            Empieza gratis. Sin tarjeta. Cancela cuando quieras.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom: 24, padding: '12px 16px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10 }}>
            <p style={{ fontSize: 13, color: '#F87171', margin: 0 }}>⚠ {error}</p>
          </div>
        )}

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{
              background: plan.popular ? C.card2 : C.card,
              border: `1px solid ${plan.popular ? plan.accent + '44' : C.border}`,
              borderRadius: 16, padding: 24, position: 'relative',
              boxShadow: plan.popular ? `0 0 0 1px ${plan.accent}22, 0 8px 32px rgba(0,0,0,0.3)` : 'none',
              transition: 'border-color 0.2s',
            }}>

              {/* Popular badge */}
              {plan.popular && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: `linear-gradient(135deg,${plan.accent},${plan.accent}bb)`,
                  color: C.bg, fontSize: 11, fontWeight: 800, padding: '4px 14px',
                  borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.05em',
                }}>
                  MÁS POPULAR
                </div>
              )}

              {/* Plan name */}
              <p style={{ fontSize: 11, fontWeight: 700, color: plan.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                {plan.label}
              </p>

              {/* Price */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 800, color: C.text, lineHeight: 1 }}>{plan.price}</span>
                <span style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>EUR/mes</span>
              </div>

              {/* Calls info */}
              <p style={{ fontSize: 12, color: C.sub, marginBottom: 2 }}>{plan.calls} llamadas incluidas</p>
              <p style={{ fontSize: 11, color: C.muted, marginBottom: 20 }}>{plan.rate} EUR/llamada adicional</p>

              {/* CTA */}
              <button
                onClick={() => handlePlan(plan.id as PlanId)}
                disabled={!!loading}
                style={{
                  width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 700,
                  borderRadius: 10, border: `1px solid ${plan.accent}66`,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: plan.popular ? `linear-gradient(135deg,${plan.accent},${plan.accent}bb)` : plan.dim,
                  color: plan.popular ? C.bg : plan.accent,
                  marginBottom: 20, opacity: loading ? 0.6 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {loading === plan.id ? 'Redirigiendo...' : `Empezar ${plan.label}`}
              </button>

              {/* Features */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={plan.accent} strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span style={{ fontSize: 12, color: C.sub, lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p style={{ textAlign: 'center', fontSize: 12, color: C.muted, marginTop: 32 }}>
          IVA no incluido · Facturación mensual · Cancela en cualquier momento
        </p>
      </div>
    </div>
  )
}
