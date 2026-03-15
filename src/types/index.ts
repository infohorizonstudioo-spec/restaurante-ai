export interface Tenant {
  id: string
  name: string
  slug: string
  type: 'restaurant' | 'clinic' | 'advisory' | 'other'
  phone?: string
  email?: string
  address?: string
  settings: Record<string, any>
  plan: 'free' | 'basic' | 'pro' | 'enterprise'
  active: boolean
  created_at: string
}

export interface Customer {
  id: string
  tenant_id: string
  name: string
  phone?: string
  email?: string
  notes?: string
  tags: string[]
  visits: number
  total_spent: number
  last_visit?: string
  blacklisted: boolean
  created_at: string
}

export interface Table {
  id: string
  tenant_id: string
  number: string
  name?: string
  capacity: number
  zone: string
  status: 'libre' | 'reservada' | 'ocupada' | 'pendiente' | 'bloqueada'
  current_people: number
  position_x: number
  position_y: number
  shape: string
  active: boolean
}

export interface Reservation {
  id: string
  tenant_id: string
  customer_id?: string
  table_id?: string
  customer_name: string
  customer_phone?: string
  date: string
  time: string
  people: number
  zone: string
  notes?: string
  allergies?: string
  status: 'pendiente' | 'confirmada' | 'sentada' | 'completada' | 'cancelada' | 'no_show'
  source: 'manual' | 'phone' | 'web' | 'whatsapp' | 'ai'
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  tenant_id: string
  reservation_id?: string
  table_id?: string
  customer_name?: string
  customer_phone?: string
  type: 'mesa' | 'domicilio' | 'recogida' | 'telefono'
  items: Array<{ name: string; qty: number; price: number }>
  notes?: string
  total: number
  status: 'nuevo' | 'confirmado' | 'preparando' | 'listo' | 'enviado' | 'entregado' | 'cancelado'
  priority: 'normal' | 'alta' | 'urgente'
  created_at: string
  updated_at: string
}

export interface Call {
  id: string
  tenant_id: string
  call_sid?: string
  caller_phone?: string
  caller_name?: string
  status: 'activa' | 'completada' | 'perdida' | 'transferida'
  intent?: string
  intent_data: Record<string, any>
  duration_seconds: number
  transcript: Array<{ role: string; content: string }>
  generating_reservation: boolean
  reservation_id?: string
  order_id?: string
  started_at: string
  ended_at?: string
}

export interface Alert {
  id: string
  tenant_id: string
  type: string
  title: string
  message?: string
  severity: 'info' | 'warning' | 'urgent' | 'critical'
  read: boolean
  data: Record<string, any>
  created_at: string
}
