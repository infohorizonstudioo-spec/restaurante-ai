// ─────────────────────────────────────────────────────────────────────────────
// RESERVO.AI — tipos centrales
// La lógica de plantillas vive en @/lib/templates
// ─────────────────────────────────────────────────────────────────────────────

export type BusinessType =
  | 'restaurante' | 'bar' | 'cafeteria'
  | 'clinica_dental' | 'clinica_medica' | 'asesoria'
  | 'peluqueria' | 'seguros' | 'inmobiliaria'
  | 'academia' | 'otro'

export type TableStatus      = 'libre' | 'reservada' | 'ocupada' | 'bloqueada'
export type ReservationStatus= 'confirmada' | 'pendiente' | 'cancelada' | 'completada'
export type OrderStatus      = 'nuevo' | 'preparacion' | 'listo' | 'reparto' | 'entregado'
export type PlanType         = 'trial' | 'free' | 'starter' | 'pro' | 'business' | 'enterprise'

export interface Tenant {
  id: string
  name: string
  type: BusinessType
  email?: string
  plan: PlanType
  agent_name?: string
  agent_phone?: string
  business_hours?: Record<string, { open: string; close: string; closed: boolean }>
  business_description?: string
  language?: string
  onboarding_complete?: boolean
  onboarding_step?: number
  free_calls_used?: number
  free_calls_limit?: number
  plan_calls_used?: number
  plan_calls_included?: number
  call_count?: number
  created_at?: string
}

export interface Zone {
  id: string
  tenant_id: string
  name: string
  description?: string
  active: boolean
}

export interface Table {
  id: string
  tenant_id: string
  zone_id?: string
  zone_name?: string
  name: string
  number?: string
  capacity: number
  status: TableStatus
  notes?: string
  combinable?: boolean
}

export interface Reservation {
  id: string
  tenant_id: string
  customer_id?: string
  customer_name: string
  customer_phone?: string
  date: string
  time: string
  people: number
  table_id?: string
  table_name?: string
  zone_id?: string
  notes?: string
  status: ReservationStatus
  source?: string
  created_at?: string
}

export interface Customer {
  id: string
  tenant_id: string
  name: string
  phone?: string
  email?: string
  notes?: string
  total_reservations?: number
  last_visit?: string
  vip?: boolean
  created_at?: string
}

export interface Call {
  id: string
  tenant_id: string
  call_sid?: string
  caller_phone?: string
  from_number?: string
  to_number?: string
  status?: string
  direction?: string
  duration_seconds?: number
  summary?: string
  action_suggested?: string
  transcript?: string
  intent?: string
  customer_name?: string
  started_at?: string
  created_at?: string
}

// Re-exportar desde templates para compatibilidad con imports existentes
export type { TemplateConfig, MasterTemplate } from '@/lib/templates'
export { resolveTemplate, isHosteleria, hasSpacesModule, hasOrdersModule } from '@/lib/templates'
