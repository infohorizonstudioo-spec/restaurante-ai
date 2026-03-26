'use client'
import { useFeatureFlag } from '@/hooks/useFeatureFlag'
import type { Feature } from '@/lib/feature-flags'

const C = {
  amber: '#F0A84E', amberDim: 'rgba(240,168,78,0.10)',
  text: '#E8EEF6', text2: '#8895A7', text3: '#49566A',
  surface: '#131920', border: 'rgba(255,255,255,0.07)',
}

const PLAN_LABELS: Record<string, string> = {
  trial: 'Prueba', free: 'Prueba', starter: 'Basico',
  pro: 'Profesional', business: 'Completo', enterprise: 'Enterprise',
}

/**
 * Wrapper component that checks feature access.
 * Shows upgrade prompt if the user's plan doesn't include the feature.
 */
export function UpgradeGate({ feature, children }: { feature: Feature; children: React.ReactNode }) {
  const { allowed, requiredPlan, featureLabel } = useFeatureFlag(feature)

  if (allowed) return <>{children}</>

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
      padding: '40px 32px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>
        {featureLabel}
      </h3>
      <p style={{ fontSize: 14, color: C.text2, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
        Esta funcion esta disponible a partir del plan {PLAN_LABELS[requiredPlan] || requiredPlan}.
        Actualiza tu plan para acceder.
      </p>
      <a href="/precios" style={{
        display: 'inline-block', padding: '12px 28px', borderRadius: 12,
        background: `linear-gradient(135deg, ${C.amber}, #E8923A)`,
        color: '#0C1018', fontSize: 14, fontWeight: 700,
        textDecoration: 'none',
      }}>
        Ver planes
      </a>
    </div>
  )
}
