/**
 * RESERVO.AI — Status configuration (single source of truth)
 * Import from here instead of defining status colors in each component.
 */
import { C } from './colors'

/** Reservation statuses (used in reservas, agenda, clientes views) */
export const RESERVATION_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  confirmada:  { bg: C.greenDim, color: C.green, label: 'Confirmada' },
  confirmed:   { bg: C.greenDim, color: C.green, label: 'Confirmada' },
  pendiente:   { bg: C.yellowDim, color: C.yellow, label: 'Pendiente' },
  pending:     { bg: C.yellowDim, color: C.yellow, label: 'Pendiente' },
  pending_review: { bg: C.amberDim, color: C.amber, label: 'Para revisión' },
  cancelada:   { bg: C.redDim, color: C.red, label: 'Cancelada' },
  cancelled:   { bg: C.redDim, color: C.red, label: 'Cancelada' },
  completada:  { bg: C.amberDim, color: C.amber, label: 'Completada' },
  completed:   { bg: C.amberDim, color: C.amber, label: 'Completada' },
  no_show:     { bg: C.orangeDim, color: C.orange, label: 'No presentado' },
}

/** Order statuses (used in pedidos) */
export const ORDER_STATUS: Record<string, { color: string; icon: string }> = {
  collecting: { color: C.amber, icon: '📝' },
  confirmed:  { color: C.teal, icon: '✅' },
  preparing:  { color: C.yellow, icon: '🍳' },
  ready:      { color: C.green, icon: '🔔' },
  delivered:  { color: C.text2, icon: '✔️' },
  cancelled:  { color: C.red, icon: '✖️' },
}

/** Agent decision statuses (used in llamadas, agente) */
export const DECISION_STATUS: Record<string, { color: string; bg: string; icon: string }> = {
  confirmed:             { color: '#4ADE80', bg: 'rgba(74,222,128,0.10)', icon: '✅' },
  pending_review:        { color: C.yellow, bg: C.yellowDim, icon: '👁' },
  modified:              { color: C.blue, bg: C.blueDim, icon: '✏️' },
  cancelled:             { color: C.red, bg: C.redDim, icon: '✕' },
  rejected:              { color: C.red, bg: C.redDim, icon: '✕' },
  needs_human_attention: { color: C.amber, bg: C.amberDim, icon: '⚠️' },
  incomplete:            { color: C.text2, bg: 'rgba(136,149,167,0.10)', icon: '❓' },
}

/** Ecommerce order statuses */
export const ECOM_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  nuevo:      { bg: C.blueDim, color: C.blue, label: 'Nuevo' },
  confirmado: { bg: C.greenDim, color: C.green, label: 'Confirmado' },
  enviado:    { bg: C.amberDim, color: C.amber, label: 'Enviado' },
  entregado:  { bg: C.tealDim, color: C.teal, label: 'Entregado' },
  cancelado:  { bg: C.redDim, color: C.red, label: 'Cancelado' },
  pendiente:  { bg: C.yellowDim, color: C.yellow, label: 'Pendiente' },
}

/** Inmobiliaria statuses (extends base) */
export const INMO_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  ...RESERVATION_STATUS,
  programada: { bg: C.blueDim, color: C.blue, label: 'Programada' },
  completada: { bg: C.amberDim, color: C.amber, label: 'Realizada' },
  completed:  { bg: C.amberDim, color: C.amber, label: 'Realizada' },
}
