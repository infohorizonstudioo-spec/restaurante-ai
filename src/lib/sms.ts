/**
 * Builds SMS messages for different reservation/booking events.
 * Returns the message text — does NOT send (that's the API's job).
 * Adapts terminology per business type (reserva/cita/sesión/clase).
 */

export function buildReservationSms(params: {
  businessName: string
  customerName: string
  date: string
  time: string
  people: number
  status: 'confirmed' | 'cancelled' | 'reminder'
  bookingLabel?: string // "reserva" | "cita" | "sesión" | "clase" | "visita"
}): string {
  const { businessName, customerName, date, time, people, status } = params
  const label = params.bookingLabel || 'reserva'

  const dateStr = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const peopleStr = people > 1 ? `, ${people} personas` : ''

  if (status === 'confirmed') {
    return `${businessName}: Hola ${customerName}, confirmada tu ${label} para el ${dateStr} a las ${time}${peopleStr}. ¡Te esperamos!`
  }
  if (status === 'cancelled') {
    return `${businessName}: Hola ${customerName}, tu ${label} del ${dateStr} a las ${time} queda cancelada. Cualquier cosa, llámanos.`
  }
  if (status === 'reminder') {
    return `${businessName}: Hola ${customerName}, mañana tienes ${label} a las ${time}${peopleStr}. ¡Te esperamos!`
  }
  return `${businessName}: Hola ${customerName}, te escribimos por tu ${label} del ${dateStr} a las ${time}.`
}

export function buildOrderSms(params: {
  businessName: string
  customerName: string
  orderType: string
  total: number
  status: 'confirmed' | 'ready' | 'delivering'
}): string {
  const { businessName, customerName, orderType, total, status } = params

  if (status === 'confirmed') {
    return `${businessName}: Hola ${customerName}, tu pedido (${total.toFixed(2)}€) para ${orderType} está confirmado. Te avisamos cuando esté listo.`
  }
  if (status === 'ready') {
    return `${businessName}: ${customerName}, tu pedido está listo. Puedes pasar a recogerlo cuando quieras.`
  }
  if (status === 'delivering') {
    return `${businessName}: ${customerName}, tu pedido va en camino. Llega en breve.`
  }
  return `${businessName}: Hola ${customerName}, te escribimos por tu pedido.`
}
