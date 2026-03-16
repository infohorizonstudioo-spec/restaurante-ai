export type BusinessType = 
  | 'restaurante' | 'bar' | 'clinica_dental' | 'clinica_medica'
  | 'asesoria' | 'peluqueria' | 'seguros' | 'inmobiliaria' | 'otro'

export type TableStatus = 'libre' | 'reservada' | 'ocupada' | 'bloqueada'
export type ReservationStatus = 'confirmada' | 'pendiente' | 'cancelada' | 'completada'
export type OrderStatus = 'nuevo' | 'preparacion' | 'listo' | 'reparto' | 'entregado'
export type PlanType = 'trial' | 'starter' | 'pro' | 'business'

export interface Tenant {
  id: string
  name: string
  type: BusinessType
  email?: string
  plan: PlanType
  agent_name?: string
  agent_phone?: string
  business_hours?: Record<string, { open: string; close: string; closed: boolean }>
  language?: string
  onboarding_complete?: boolean
  onboarding_step?: number
  free_calls_used?: number
  free_calls_limit?: number
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
  reservation_date: string
  reservation_time: string
  party_size: number
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
  created_at?: string
}

export interface Call {
  id: string
  tenant_id: string
  call_sid?: string
  from_number?: string
  to_number?: string
  status?: string
  direction?: string
  duration?: number
  summary?: string
  action_suggested?: string
  transcript?: string
  created_at?: string
}

export interface TemplateConfig {
  type: BusinessType
  label: string
  icon: string
  modules: string[]
  hasTableManagement: boolean
  hasZones: boolean
  hasOrders: boolean
  hasProfessionals: boolean
  reservationUnit: 'mesa' | 'cita'
  agentSystemPrompt: string
}

export const BUSINESS_TEMPLATES: Record<string, TemplateConfig> = {
  restaurante: {
    type: 'restaurante', label: 'Restaurante', icon: '🍽️',
    modules: ['resumen', 'reservas', 'mesas', 'pedidos', 'agenda', 'clientes', 'conversaciones'],
    hasTableManagement: true, hasZones: true, hasOrders: true,
    hasProfessionals: false, reservationUnit: 'mesa',
    agentSystemPrompt: 'Eres una recepcionista de restaurante. Para reservas necesitas: nombre, fecha, hora y número de personas. Pregunta si tienen preferencia de zona.'
  },
  bar: {
    type: 'bar', label: 'Bar', icon: '🍺',
    modules: ['resumen', 'reservas', 'mesas', 'pedidos', 'agenda', 'clientes', 'conversaciones'],
    hasTableManagement: true, hasZones: true, hasOrders: true,
    hasProfessionals: false, reservationUnit: 'mesa',
    agentSystemPrompt: 'Eres una recepcionista de bar. Para reservas necesitas: nombre, fecha, hora y número de personas.'
  },
  clinica_dental: {
    type: 'clinica_dental', label: 'Clínica Dental', icon: '🦷',
    modules: ['resumen', 'citas', 'agenda', 'clientes', 'conversaciones'],
    hasTableManagement: false, hasZones: false, hasOrders: false,
    hasProfessionals: true, reservationUnit: 'cita',
    agentSystemPrompt: 'Eres la recepcionista de una clínica dental. Gestiona citas. Pregunta: tipo de tratamiento, fecha y si es urgente.'
  },
  clinica_medica: {
    type: 'clinica_medica', label: 'Clínica Médica', icon: '🏥',
    modules: ['resumen', 'citas', 'agenda', 'clientes', 'conversaciones'],
    hasTableManagement: false, hasZones: false, hasOrders: false,
    hasProfessionals: true, reservationUnit: 'cita',
    agentSystemPrompt: 'Eres la recepcionista de una clínica médica. Gestiona citas. Pregunta: especialidad, fecha y si es urgente.'
  },
  asesoria: {
    type: 'asesoria', label: 'Asesoría / Consultoría', icon: '💼',
    modules: ['resumen', 'citas', 'agenda', 'clientes', 'seguimientos', 'conversaciones'],
    hasTableManagement: false, hasZones: false, hasOrders: false,
    hasProfessionals: true, reservationUnit: 'cita',
    agentSystemPrompt: 'Eres la recepcionista de una asesoría. Gestiona citas. Pregunta: tipo de consulta, fecha y datos del cliente.'
  },
  peluqueria: {
    type: 'peluqueria', label: 'Peluquería / Estética', icon: '✂️',
    modules: ['resumen', 'citas', 'agenda', 'clientes', 'conversaciones'],
    hasTableManagement: false, hasZones: false, hasOrders: false,
    hasProfessionals: true, reservationUnit: 'cita',
    agentSystemPrompt: 'Eres la recepcionista de una peluquería. Gestiona citas. Pregunta: servicio deseado, profesional preferido y fecha.'
  },
  seguros: {
    type: 'seguros', label: 'Seguros', icon: '🛡️',
    modules: ['resumen', 'citas', 'agenda', 'clientes', 'seguimientos', 'conversaciones'],
    hasTableManagement: false, hasZones: false, hasOrders: false,
    hasProfessionals: true, reservationUnit: 'cita',
    agentSystemPrompt: 'Eres la recepcionista de una correduría de seguros. Gestiona llamadas y citas. Pregunta: tipo de seguro y motivo.'
  },
  inmobiliaria: {
    type: 'inmobiliaria', label: 'Inmobiliaria', icon: '🏠',
    modules: ['resumen', 'citas', 'agenda', 'clientes', 'seguimientos', 'conversaciones'],
    hasTableManagement: false, hasZones: false, hasOrders: false,
    hasProfessionals: true, reservationUnit: 'cita',
    agentSystemPrompt: 'Eres la recepcionista de una inmobiliaria. Gestiona llamadas. Pregunta: si buscan comprar, vender o alquilar y datos de contacto.'
  },
  otro: {
    type: 'otro', label: 'Otro negocio', icon: '🏪',
    modules: ['resumen', 'citas', 'agenda', 'clientes', 'conversaciones'],
    hasTableManagement: false, hasZones: false, hasOrders: false,
    hasProfessionals: false, reservationUnit: 'cita',
    agentSystemPrompt: 'Eres una recepcionista virtual amable. Gestiona llamadas y citas de forma profesional.'
  }
}