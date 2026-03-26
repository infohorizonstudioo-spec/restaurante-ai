/**
 * useFeatureFlag — React hook for plan-based feature gating.
 * Reads tenant.plan from useTenant() context and checks against feature flags.
 */
'use client'
import { useTenant } from '@/contexts/TenantContext'
import { hasFeature, minimumPlan, FEATURE_LABELS, type Feature, type PlanType } from '@/lib/feature-flags'

export function useFeatureFlag(feature: Feature): {
  allowed: boolean
  plan: string
  requiredPlan: PlanType
  featureLabel: string
} {
  const { tenant } = useTenant()
  const plan = tenant?.plan || 'trial'
  const allowed = hasFeature(plan, feature)
  const requiredPlan = minimumPlan(feature)
  const featureLabel = FEATURE_LABELS[feature]

  return { allowed, plan, requiredPlan, featureLabel }
}
