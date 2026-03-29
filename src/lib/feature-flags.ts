/**
 * FEATURE FLAGS — Plan-based feature gating.
 * Centralized place to check what each plan includes.
 *
 * MODELO DE NEGOCIO:
 * - Cada plan incluye X llamadas/mes (50/200/600)
 * - Llamadas extra se cobran por encima (0.90/0.70/0.50 EUR)
 * - Las funcionalidades se desbloquean progresivamente por plan
 * - Cuanto más usa el cliente → más llamadas → más ingresos
 */

export type Feature =
  // ── Starter (incluido en todos) ──
  | 'reservas'              // Gestión de reservas
  | 'panel'                 // Panel en tiempo real
  | 'clientes_basic'        // CRM básico (nombre, teléfono, historial)
  | 'mesas'                 // Gestión de mesas/espacios
  | 'turnos'                // Control de turnos y equipo
  | 'agenda'                // Calendario/agenda
  | 'config_agente_basic'   // Configuración básica del agente
  | 'alerts_inapp'          // Notificaciones in-app
  | 'sms_confirmations'     // SMS de confirmación y recordatorios
  | 'temas'                 // 3 temas visuales
  | 'estadisticas_basic'    // Estadísticas básicas (llamadas, reservas del día)
  // ── Pro ──
  | 'pedidos'               // Gestión de pedidos (recoger/domicilio)
  | 'domicilio'             // Entregas a domicilio con dirección
  | 'estadisticas'          // Estadísticas avanzadas (conversión, hora pico, intents)
  | 'insights'              // Sugerencias diarias IA (smart suggestions)
  | 'aprendizaje'           // Aprendizaje automático de patrones
  | 'catalogo_voz'          // Catálogo consultable por voz
  | 'alerts_push'           // Push notifications
  | 'alerts_sms'            // Alertas SMS al propietario
  | 'multichannel_whatsapp' // Canal WhatsApp automático
  | 'productos'             // Gestión de productos/menú
  | 'crm_avanzado'          // CRM avanzado (scoring, VIP, at-risk)
  | 'alertas_custom'        // Reglas de alerta configurables
  | 'reminders_custom'      // Recordatorios personalizados
  | 'export'                // Exportación de datos
  | 'summaries'             // Resúmenes inteligentes de llamadas
  // ── Business ──
  | 'multichannel_email'    // Canal Email automático
  | 'proveedores'           // Gestión de proveedores e inventario
  | 'auto_pedidos_prov'     // Auto-pedidos a proveedores (cron)
  | 'inventario_ia'         // Inteligencia de inventario (predicción)
  | 'informes_pdf'          // Informes PDF (registro jornada laboral)
  | 'multi_user'            // Multi-usuario

export type PlanType = 'trial' | 'free' | 'starter' | 'pro' | 'business' | 'enterprise'

// ── Features por plan (progresivo — cada plan incluye el anterior) ──

const STARTER_FEATURES: Feature[] = [
  'reservas', 'panel', 'clientes_basic', 'mesas', 'turnos', 'agenda',
  'config_agente_basic', 'alerts_inapp', 'sms_confirmations', 'temas',
  'estadisticas_basic',
]

const PRO_FEATURES: Feature[] = [
  ...STARTER_FEATURES,
  'pedidos', 'domicilio', 'estadisticas', 'insights', 'aprendizaje',
  'catalogo_voz', 'alerts_push', 'alerts_sms', 'multichannel_whatsapp',
  'productos', 'crm_avanzado', 'alertas_custom', 'reminders_custom',
  'export', 'summaries',
]

const BUSINESS_FEATURES: Feature[] = [
  ...PRO_FEATURES,
  'multichannel_email', 'proveedores', 'auto_pedidos_prov', 'inventario_ia',
  'informes_pdf', 'multi_user',
]

const PLAN_FEATURES: Record<PlanType, Feature[]> = {
  trial: STARTER_FEATURES,
  free: STARTER_FEATURES,
  starter: STARTER_FEATURES,
  pro: PRO_FEATURES,
  business: BUSINESS_FEATURES,
  enterprise: BUSINESS_FEATURES,
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
  reservas: 'Gestión de reservas',
  panel: 'Panel en tiempo real',
  clientes_basic: 'Base de clientes',
  mesas: 'Gestión de mesas',
  turnos: 'Control de turnos',
  agenda: 'Agenda y calendario',
  config_agente_basic: 'Configuración del agente',
  alerts_inapp: 'Notificaciones en la app',
  sms_confirmations: 'SMS de confirmación',
  temas: 'Temas visuales',
  estadisticas_basic: 'Estadísticas básicas',
  pedidos: 'Gestión de pedidos',
  domicilio: 'Entregas a domicilio',
  estadisticas: 'Estadísticas avanzadas',
  insights: 'Sugerencias inteligentes',
  aprendizaje: 'Aprendizaje automático',
  catalogo_voz: 'Catálogo por voz',
  alerts_push: 'Notificaciones push',
  alerts_sms: 'Alertas por SMS',
  multichannel_whatsapp: 'WhatsApp automático',
  productos: 'Gestión de productos',
  crm_avanzado: 'CRM avanzado',
  alertas_custom: 'Alertas configurables',
  reminders_custom: 'Recordatorios personalizados',
  export: 'Exportar datos',
  summaries: 'Resúmenes inteligentes',
  multichannel_email: 'Email automático',
  proveedores: 'Gestión de proveedores',
  auto_pedidos_prov: 'Auto-pedidos a proveedores',
  inventario_ia: 'Inteligencia de inventario',
  informes_pdf: 'Informes PDF',
  multi_user: 'Multi-usuario',
}

/** Minimum plan required for a feature */
export function minimumPlan(feature: Feature): PlanType {
  const plans: PlanType[] = ['trial', 'free', 'starter', 'pro', 'business', 'enterprise']
  for (const plan of plans) {
    if (PLAN_FEATURES[plan].includes(feature)) return plan
  }
  return 'enterprise'
}
