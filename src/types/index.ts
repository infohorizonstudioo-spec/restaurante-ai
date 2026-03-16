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
  email: string
  plan: PlanType
  agent_name: string
  agent_phone: string
  business_hours: BusinessHours
  language: string
  onboarding_complete: boolean
  onboarding_step: number
  free_calls_used: number
  free_calls_limit: number
  call_count: number
  created_at: string
}

export interface BusinessHours {
  [day: string]: { open: string; close: string; closed: boolean }
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
  zone_id: string
  zone_name?: string
  name: string
  capacity: number
  status: TableStatus
  notes?: string
  combinable: boolean
}

export interface Reservation {
  id: string
  tenant_id: string
  customer_id?: string
  customer_name: string
  customer_phone: string
  reservation_date: string
  reservation_time: string
  party_size: number
  table_id?: string
  table_name?: string
  zone_id?: string
  notes?: string
  status: ReservationStatus
  source: 'voice_agent' | 'manual' | 'web'
  created_at: string
}

export interface Customer {
  id: string
  tenant_id: string
  name: string
  phone: string
  email?: string
  notes?: string
  total_reservations: number
  last_visit?: string
  created_at: string
}

export interface Call {
  id: string
  tenant_id: string
  call_sid: string
  from_number: string
  to_number: string
  status: string
  direction: string
  duration?: number
  summary?: string
  action_suggested?: string
  transcript?: string
  created_at: string
}

export interface Order {
  id: string
  tenant_id: string
  customer_name: string
  customer_phone: string
  customer_address?: string
  items: OrderItem[]
  notes?: string
  status: OrderStatus
  total?: number
  created_at: string
}

export interface OrderItem {
  name: string
  quantity: number
  price?: number
  notes?: string
}

// Config de cada plantilla
export interface TemplateConfig {
  type: BusinessType
  label: string
  icon: string
  modules: string[]
  agentQuestions: string[]
  reservationFields: string[]
  hasTableManagement: boolean
  hasZones: boolean
  hasOrders: boolean
  hasProfessionals: boolean
  hasTreatments: boolean
  reservationUnit: 'mesa' | 'cita' | 'servicio'
  agentSystemPrompt: string
}

export const BUSINESS_TEMPLATES: Record<BusinessType, TemplateConfig> = {
  restaurante: {
    type: 'restaurante', label: 'Restaurante', icon: '🍽️',
    modules: ['resumen', 'reservas', 'mesas', 'pedidos', 'agenda', 'clientes', 'conversaciones'],
    agentQuestions: ['Para cuántas personas', 'Qué fecha y hora', 'Alguna preferencia de zona', 'Nombre para la reserva'],
    reservationFields: ['fecha', 'hora', 'personas', 'zona', 'mesa', 'notas'],
    hasTableManagement: true, hasZones: true, hasOrders: true,
    hasProfessionals: false, hasTreatments: false, reservationUnit: 'mesa',
    agentSystemPrompt: 'Eres una recepcionista de restaurante. Gestiona reservas de mesa, pedidos y consultas sobre el local. Para reservas necesitas: nombre, fecha, hora y número de personas. Pregunta si tienen preferencia de zona (terraza, interior, barra).'
  },
  bar: {
    type: 'bar', label: 'Bar', icon: '🍺',
    modules: ['resumen', 'reservas', 'mesas', 'pedidos', 'agenda', 'clientes', 'conversaciones'],
    agentQuestions: ['Para cuántas personas', 'Qué fecha y hora', 'Zona preferida'],
    reservationFields: ['fecha', 'hora', 'personas', 'zona', 'notas'],
    hasTableManagement: true, hasZones: true, hasOrders: true,
    hasProfessionals: false, hasTreatments: false, reservationUnit: 'mesa',
    agentSystemPrompt: 'Eres una recepcionista de bar. Gestiona reservas de mesa y pedidos. Para reservas necesitas: nombre, fecha, hora y número de personas.'
  },
  clinica_dental: {
    type: 'clinica_dental', label: 'Clínica Dental', icon: '🦷',
    modules: ['resumen', 'citas', 'agenda', 'pacientes', 'conversaciones'],
    agentQuestions: ['Tipo de tratamiento', 'Fecha preferida', 'Urgencia', 'Nombre y teléfono'],
    reservationFields: ['fecha', 'hora', 'tratamiento', 'profesional', 'duracion', 'notas'],
    hasTableManagement: false, hasZones: false, hasOrders: false,
    hasProfessionals: true, hasTreatments: true, reservationUnit: 'cita',
    agentSystemPrompt: 'Eres la recepcionista de una clínica dental. Gestiona citas para tratamientos dentales. Pregunta: tipo de tratamiento, fecha preferida, si es urgente. Necesitas nombre y teléfono del paciente.'
  },
  clinica_medica: {
    type: 'clinica_medica', label: 'Clínica Médica', icon: '🏥',
    modules: ['resumen', 'citas', 'agenda', 'pacientes', 'conversaciones'],
    agentQuestions: ['Especialidad o motivo', 'Fecha preferida', 'Es urgente', 'Nombre y teléfono'],
    reservationFields: ['fecha', 'hora', 'especialidad', 'profesional', 'duracion', 'notas'],
    hasTableManagement: false, hasZones: false, hasOrders: false,
    hasProfessionals: true, hasTreatments: true, reservationUnit: 'cita',
    agentSystemPrompt: 'Eres la recepcionista de una clínica médica. Gestiona citas médicas. Pregunta: motivo o especialidad, fecha preferida, si es urgente. Necesitas nombre y teléfono del paciente.'
  },
  asesoria: {
    type: 'asesoria', label: 'Asesoría / Consultoría', icon: '💼',
    modules: ['resumen', 'citas', 'agenda', 'clientes', 'seguimientos', 'conversaciones'],
    agentQuestions: ['Tipo de consulta', 'Fecha preferida', 'Nombre y empresa'],
    reservationFields: ['fecha', 'hora', 'tipo_consulta', 'profesional', 'notas'],
    hasTableManagement: false, hasZones: false, hasOrders: false,
    hasProfessionals: true, hasTreatments: false, reservationUnit: 'cita',
    agentSystemPrompt: 'Eres la recepcionista de una asesoría. Gestiona citas de consultoría. Pregunta: tipo de consulta (fiscal, laboral, jurídica), fecha preferida, nombre y empresa del cliente.'
  },
  peluqueria: {
    type: 'peluqueria', label: 'Peluquería / Estética', icon: '✂️',
    modules: ['resumen', 'citas', 'agenda', 'clientes', 'conversaciones'],
    agentQuestions: ['Qué servicio necesita', 'Profesional preferido', 'Fecha y hora'],
    reservationFields: ['fecha', 'hora', 'servicio', 'profesional', 'duracion', 'notas'],
    hasTableManagement: false, hasZones: false, hasOrders: false,
    hasProfessionals: true, hasTreatments: true, reservationUnit: 'cita',
    agentSystemPrompt: 'Eres la recepcionista de una peluquería o centro de estética. Gestiona citas. Pregunta: servicio deseado (corte, color, tratamiento, etc.), si tiene preferencia de profesional, fecha y hora.'
  },
  seguros: {
    type: 'seguros', label: 'Seguros', icon: '🛡️',
    modules: ['resumen', 'oportunidades', 'citas', 'agenda', 'clientes', 'seguimientos', 'conversaciones'],
    agentQuestions: ['Tipo de seguro', 'Motivo de contacto', 'Nombre y datos de contacto'],
    reservationFields: ['fecha', 'hora', 'tipo_consulta', 'agente', 'notas'],
    hasTableManagement: false, hasZones: false, hasOrders: false,
    hasProfessionals: true, hasTreatments: false, reservationUnit: 'cita',
    agentSystemPrompt: 'Eres la recepcionista de una correduría de seguros. Gestiona llamadas de clientes y citas. Pregunta: tipo de seguro de interés, motivo del contacto, datos de contacto.'
  },
  inmobiliaria: {
    type: 'inmobiliaria', label: 'Inmobiliaria', icon: '🏠',
    modules: ['resumen', 'oportunidades', 'citas', 'agenda', 'clientes', 'seguimientos', 'conversaciones'],
    agentQuestions: ['Compra, venta o alquiler', 'Zona de interés', 'Presupuesto aproximado', 'Datos de contacto'],
    reservationFields: ['fecha', 'hora', 'tipo_operacion', 'agente', 'notas'],
    hasTableManagement: false, hasZones: false, hasOrders: false,
    hasProfessionals: true, hasTreatments: false, reservationUnit: 'cita',
    agentSystemPrompt: 'Eres la recepcionista de una inmobiliaria. Gestiona llamadas de clientes interesados en propiedades. Pregunta: si buscan comprar, vender o alquilar, zona de interés, presupuesto aproximado.'
  },
  otro: {
    type: 'otro', label: 'Otro tipo de negocio', icon: '🏪',
    modules: ['resumen', 'citas', 'agenda', 'clientes', 'conversaciones'],
    agentQuestions: ['En qué puedo ayudarte', 'Fecha preferida', 'Nombre y contacto'],
    reservationFields: ['fecha', 'hora', 'motivo', 'notas'],
    hasTableManagement: false, hasZones: false, hasOrders: false,
    hasProfessionals: false, hasTreatments: false, reservationUnit: 'cita',
    agentSystemPrompt: 'Eres una recepcionista virtual. Gestiona llamadas, citas y consultas de clientes. Sé amable y profesional.'
  }
}