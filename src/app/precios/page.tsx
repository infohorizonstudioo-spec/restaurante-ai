'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const PLANS = [
  {
    id:'starter', name:'Starter', price:99, calls:50, extra:'0,90',
    badge: null,
    desc: 'Para autónomos y pequeños negocios',
    color: '#3b82f6',
    features: [
      'Recepcionista virtual 24/7',
      '50 llamadas al mes',
      'Reservas y citas automáticas',
      'Panel de control completo',
      'Historial de clientes',
      'Resumen automático de cada llamada',
      'Soporte por email',
    ],
  },
  {
    id:'pro', name:'Pro', price:299, calls:200, extra:'0,70',
    badge: 'Más popular',
    desc: 'Para negocios en crecimiento',
    color: '#ffffff',
    features: [
      'Todo del plan Starter',
      '200 llamadas al mes',
      'Disponibilidad automática por zonas',
      'Gestión de mesas y espacios',
      'Confirmaciones automáticas',
      'Recordatorios y seguimientos',
      'Analíticas avanzadas',
      'Soporte prioritario',
    ],
  },
  {
    id:'business', name:'Business', price:499, calls:600, extra:'0,50',
    badge: null,
    desc: 'Para cadenas y grandes volúmenes',
    color: '#7c3aed',
    features: [
      'Todo del plan Pro',
      '600 llamadas al mes',
      'Multi-ubicación',
      'Panel multi-negocio',
      'Acceso API completo',
      'Gestor de cuenta dedicado',
      'SLA garantizado',
      'Soporte 24/7',
    ],
  },
]

const COMPARE_ROWS = [
  { f: 'Llamadas incluidas/mes', vals: ['50', '200', '600'] },
  { f: 'Llamada extra', vals: ['0,90€', '0,70€', '0,50€'] },
  { f: 'Recepcionista virtual 24/7', vals: [true, true, true] },
  { f: 'Reservas automáticas', vals: [true, true, true] },
  { f: 'Historial de clientes', vals: [true, true, true] },
  { f: 'Resumen de llamadas', vals: [true, true, true] },
  { f: 'Gestión de mesas y zonas', vals: [false, true, true] },
  { f: 'Analíticas avanzadas', vals: [false, true, true] },
  { f: 'Multi-ubicación', vals: [false, false, true] },
  { f: 'Soporte', vals: ['Email', 'Prioritario', '24/7 + gestor'] },
]

const FAQS = [
  { q: 'Qué pasa si supero las llamadas del plan', a: 'Puedes seguir recibiendo llamadas. Cada llamada extra se factura al precio de tu plan (0,90€ Starter / 0,70€ Pro / 0,50€ Business).' },
  { q: 'Puedo cambiar de plan en cualquier momento', a: 'Sí. Puedes subir o bajar de plan cuando quieras. El cambio es inmediato y se prorratea el coste del mes en curso.' },
  { q: 'Necesito instalar algo', a: 'No. Todo funciona en la nube. Solo necesitas configurar el número de teléfono en la sección de configuración y ya está listo.' },
  { q: 'Qué pasa con mis datos si cancelo', a: 'Tus datos están disponibles durante 30 días tras la cancelación para que puedas exportarlos. Luego se eliminan de forma segura.' },
]

export default function PreciosPage() {
  const [tenant, setTenant]       = useState<any>(null)
  const [loading, setLoading]     = useState(false)
  const [currentPlan, setCurrentPlan] = useState('free')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
      if (!(p as any)?.tenant_id) return
      const { data: t } = await supabase.from('tenants').select('*').eq('id', (p as any).tenant_id).single()
      setTenant(t)
      setCurrentPlan(t?.plan || 'free')
    })()
  }, [])

  async function checkout(planId: string) {
    setLoading(true)
    try {
      const priceEnvMap: Record<string, string> = {
        starter:  'STRIPE_PRICE_STARTER',
        pro:      'STRIPE_PRICE_PRO',
        business: 'STRIPE_PRICE_BUSINESS',
      }
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const { url } = await r.json()
      if (url) window.location.href = url
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const isTrial    = !currentPlan || currentPlan === 'trial' || currentPlan === 'free'
  const callsLeft  = tenant ? Math.max(0, (tenant.free_calls_limit || 10) - (tenant.free_calls_used || 0)) : 10

  const Check = ({ dark }: { dark?: boolean }) => (
    <div style={{ width: 18, height: 18, borderRadius: '50%', background: dark ? 'rgba(255,255,255,0.14)' : '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke={dark ? 'rgba(255,255,255,0.85)' : '#059669'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans',-apple-system,sans-serif", color: '#0f172a' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        .pc{background:white;border:1px solid #e2e8f0;border-radius:18px;padding:32px 26px;display:flex;flex-direction:column;transition:all 0.2s;box-shadow:0 1px 4px rgba(0,0,0,0.05)}
        .pc:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,0.09)}
        .pcf{background:linear-gradient(150deg,#1e3a8a,#1e40af);border-color:transparent;box-shadow:0 20px 48px rgba(30,64,175,0.28)}
        .pcf:hover{transform:translateY(-4px);box-shadow:0 28px 56px rgba(30,64,175,0.32)}
        .pb{width:100%;padding:13px;font-family:inherit;font-size:14px;font-weight:600;border:none;border-radius:10px;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center;gap:7px}
        .pb:hover:not(:disabled){opacity:0.88;transform:translateY(-1px)}
        .pb:disabled{opacity:0.5;cursor:default;transform:none}
        @media(max-width:900px){.pgrid{grid-template-columns:1fr!important}}
        @media(max-width:600px){.pgrid{gap:12px!important}.cmptbl{display:none}}
      `}</style>

      {/* Top nav */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
        <Link href="/panel" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#1e40af,#3b82f6)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Reservo.AI</span>
        </Link>
        <Link href="/panel" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#64748b" strokeWidth="2" strokeLinecap="round"/></svg>
          Volver al panel
        </Link>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '52px 24px 80px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          {isTrial && callsLeft > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 20, padding: '5px 14px', marginBottom: 18 }}>
              <span>⚡</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>Te quedan {callsLeft} llamadas gratuitas</span>
            </div>
          )}
          {isTrial && callsLeft === 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 20, padding: '5px 14px', marginBottom: 18 }}>
              <span>⚠️</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>Llamadas agotadas — activa un plan</span>
            </div>
          )}
          <h1 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 14, lineHeight: 1.15 }}>
            Elige tu plan
          </h1>
          <p style={{ fontSize: 17, color: '#64748b', maxWidth: 440, margin: '0 auto 18px', lineHeight: 1.6 }}>
            Empieza con 10 llamadas gratis. Sin tarjeta de crédito.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
            {['Sin permanencia', 'Cancela cuando quieras', 'Listo en 5 minutos'].map(txt => (
              <div key={txt} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#64748b' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {txt}
              </div>
            ))}
          </div>
        </div>

        {/* Plan cards */}
        <div className="pgrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, alignItems: 'start', marginBottom: 64 }}>
          {PLANS.map(plan => {
            const isFeat   = plan.id === 'pro'
            const isActive = currentPlan === plan.id
            return (
              <div key={plan.id} className={`pc${isFeat ? ' pcf' : ''}`} style={{ position: 'relative' }}>
                {plan.badge && (
                  <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#f59e0b', color: 'white', borderRadius: 20, padding: '4px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(245,158,11,0.35)' }}>
                    ★ {plan.badge.toUpperCase()}
                  </div>
                )}

                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: isFeat ? 'rgba(255,255,255,0.5)' : plan.color }} />
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: isFeat ? 'rgba(255,255,255,0.55)' : '#94a3b8' }}>{plan.name}</span>
                    {isActive && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: isFeat ? 'rgba(255,255,255,0.15)' : '#d1fae5', color: isFeat ? 'white' : '#059669', padding: '2px 8px', borderRadius: 20 }}>ACTIVO</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 5 }}>
                    <span style={{ fontSize: 46, fontWeight: 700, letterSpacing: '-0.04em', color: isFeat ? 'white' : '#0f172a', lineHeight: 1 }}>{plan.price}</span>
                    <span style={{ fontSize: 15, color: isFeat ? 'rgba(255,255,255,0.5)' : '#94a3b8' }}>€/mes</span>
                  </div>
                  <p style={{ fontSize: 13, color: isFeat ? 'rgba(255,255,255,0.5)' : '#64748b', marginBottom: 10 }}>{plan.desc}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isFeat ? 'rgba(255,255,255,0.8)' : '#374151' }}>
                      {plan.calls} llamadas/mes
                    </span>
                    <span style={{ fontSize: 11, color: isFeat ? 'rgba(255,255,255,0.35)' : '#94a3b8' }}>+{plan.extra}€ extra</span>
                  </div>
                </div>

                <div style={{ height: 1, background: isFeat ? 'rgba(255,255,255,0.1)' : '#f1f5f9', marginBottom: 18 }} />

                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, flex: 1 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13 }}>
                      <Check dark={isFeat} />
                      <span style={{ color: isFeat ? 'rgba(255,255,255,0.82)' : '#374151', lineHeight: 1.5 }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className="pb"
                  disabled={loading || isActive}
                  onClick={() => checkout(plan.id)}
                  style={{
                    marginTop: 'auto',
                    background: isFeat ? 'rgba(255,255,255,0.15)' : plan.color,
                    color: 'white',
                    border: isFeat ? '1px solid rgba(255,255,255,0.25)' : 'none',
                    boxShadow: isFeat ? 'none' : `0 2px 10px ${plan.color}44`,
                  }}>
                  {loading ? (
                    <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Procesando...</>
                  ) : isActive ? (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>Plan activo</>
                  ) : (
                    <>Empezar con {plan.name} <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Comparativa */}
        <div className="cmptbl" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', marginBottom: 60, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Comparativa completa</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={{ textAlign: 'left', padding: '11px 20px', color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', width: '40%' }}>Característica</th>
                {PLANS.map(p => <th key={p.id} style={{ textAlign: 'center', padding: '11px 14px', color: p.id === 'pro' ? '#1d4ed8' : '#0f172a', fontSize: 12, fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, ri) => (
                <tr key={row.f} style={{ borderTop: '1px solid #f1f5f9', background: ri % 2 === 0 ? '#fafbfd' : 'white' }}>
                  <td style={{ padding: '10px 20px', color: '#374151', fontWeight: 500 }}>{row.f}</td>
                  {row.vals.map((v, vi) => (
                    <td key={vi} style={{ textAlign: 'center', padding: '10px 14px', color: PLANS[vi].id === 'pro' ? '#1d4ed8' : '#374151', fontWeight: typeof v === 'string' ? 500 : 400 }}>
                      {typeof v === 'boolean'
                        ? v
                          ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto', display: 'block' }}><path d="M20 6L9 17l-5-5" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          : <span style={{ color: '#d1d5db', fontSize: 18 }}>—</span>
                        : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 660, margin: '0 auto 60px' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', marginBottom: 24, letterSpacing: '-0.02em' }}>Preguntas frecuentes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAQS.map((item, i) => (
              <div key={i} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
                <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 7 }}>¿{item.q}?</p>
                <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA final */}
        <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', borderRadius: 20, padding: '44px 40px', textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🚀</div>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 10 }}>Empieza gratis, sin compromiso</h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, marginBottom: 28 }}>10 llamadas sin coste. Sin tarjeta. Sin permanencia.</p>
          <Link href="/registro" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: 'white', borderRadius: 11, fontSize: 15, fontWeight: 600, textDecoration: 'none', boxShadow: '0 4px 16px rgba(59,130,246,0.35)' }}>
            Crear cuenta gratis
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
        </div>
      </div>
    </div>
  )
}
