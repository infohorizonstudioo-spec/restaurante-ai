/**
 * FEATURE FLAGS — Plan-based feature gating.
 * Centralized place to check what each plan includes.
 * No rewriting needed when adding new plans or features.
 */

export type Feature =
  | 'estadisticas_basic'
  | 'estadisticas'
  | 'pedidos'
  | 'summaries'
  | 'alerts_inapp'
  | 'alerts_sms'
  | 'alerts_push'
  | 'reminders_24h'
  | 'reminders_custom'
  | 'visual_editor'
  | 'visual_editor_advanced'
  | 'export'
  | 'api_access'
  | 'multi_user'
  | 'multichannel_whatsapp'
  | 'multichannel_email'

export type PlanType = 'trial' | 'free' | 'starter' | 'pro' | 'business' | 'enterprise'

const PLAN_FEATURES: Record<PlanType, Feature[]> = {
  trial: [
    'estadisticas_basic',
    'alerts_inapp',
    'reminders_24h',
    'visual_editor',
  ],
  free: [
    'estadisticas_basic',
    'alerts_inapp',
    'reminders_24h',
    'visual_editor',
  ],
  starter: [
    'estadisticas_basic',
    'alerts_inapp',
    'alerts_sms',
    'reminders_24h',
    'visual_editor',
    'pedidos',
  ],
  pro: [
    'estadisticas_basic',
    'estadisticas',
    'pedidos',
    'summaries',
    'alerts_inapp',
    'alerts_sms',
    'alerts_push',
    'reminders_24h',
    'reminders_custom',
    'visual_editor',
    'visual_editor_advanced',
    'export',
    'multichannel_whatsapp',
  ],
  business: [
    'estadisticas_basic',
    'estadisticas',
    'pedidos',
    'summaries',
    'alerts_inapp',
    'alerts_sms',
    'alerts_push',
    'reminders_24h',
    'reminders_custom',
    'visual_editor',
    'visual_editor_advanced',
    'export',
    'api_access',
    'multi_user',
    'multichannel_whatsapp',
    'multichannel_email',
  ],
  enterprise: [
    'estadisticas_basic',
    'estadisticas',
    'pedidos',
    'summaries',
    'alerts_inapp',
    'alerts_sms',
    'alerts_push',
    'reminders_24h',
    'reminders_custom',
    'visual_editor',
    'visual_editor_advanced',
    'export',
    'api_access',
    'multi_user',
    'multichannel_whatsapp',
    'multichannel_email',
  ],
}

/** Check if a plan includes a feature */
export function hasFeature(plan: string, feature: Feature): boolean {
  const planFeatures = PLAN_FEATURES[plan as PlanType]
  if (!planFeatures) return false
  return planFeatures.includes(feature)
}

/** Get all features for a plan */
export function getFeatures(plan: string): Feature[] {
  return PLAN_FEATURES[plan as PlanType] || PLAN_FEATURES.trial
}

/** Throw if feature not available (for API routes) */
export function requireFeature(plan: string, feature: Feature): void {
  if (!hasFeature(plan, feature)) {
    throw new Error(`Feature "${feature}" requires a higher plan. Current: ${plan}`)
  }
}

/** Human-readable feature names */
export const FEATURE_LABELS: Record<Feature, string> = {
  estadisticas_basic: 'Estadisticas basicas',
  estadisticas: 'Estadisticas avanzadas',
  pedidos: 'Gestion de pedidos',
  summaries: 'Resumenes inteligentes',
  alerts_inapp: 'Alertas en la app',
  alerts_sms: 'Alertas por SMS',
  alerts_push: 'Alertas push',
  reminders_24h: 'Recordatorio 24h',
  reminders_custom: 'Recordatorios personalizados',
  visual_editor: 'Editor visual basico',
  visual_editor_advanced: 'Editor visual avanzado',
  export: 'Exportar datos',
  api_access: 'Acceso API',
  multi_user: 'Multi-usuario',
  multichannel_whatsapp: 'WhatsApp automatico',
  multichannel_email: 'Email automatico',
}

/** Minimum plan required for a feature */
export function minimumPlan(feature: Feature): PlanType {
  const plans: PlanType[] = ['trial', 'free', 'starter', 'pro', 'business', 'enterprise']
  for (const plan of plans) {
    if (PLAN_FEATURES[plan].includes(feature)) return plan
  }
  return 'enterprise'
}
