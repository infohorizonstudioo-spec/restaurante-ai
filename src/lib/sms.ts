/**
 * Builds SMS messages for different reservation events.
 * Returns the message text — does NOT send (that's the API's job).
 */

export function buildReservationSms(params: {
  businessName: string
  customerName: string
  date: string
  time: string
  people: number
  status: 'confirmed' | 'cancelled' | 'reminder'
}): string {
  const { businessName, customerName, date, time, people, status } = params

  const dateStr = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  if (status === 'confirmed') {
    return `✅ ${businessName}: Hola ${customerName}, tu reserva está confirmada para el ${dateStr} a las ${time}, ${people} persona${people !== 1 ? 's' : ''}. ¡Te esperamos!`
  }
  if (status === 'cancelled') {
    return `❌ ${businessName}: Hola ${customerName}, tu reserva del ${dateStr} a las ${time} ha sido cancelada. Si necesitas algo, llámanos.`
  }
  if (status === 'reminder') {
    return `📅 ${businessName}: Hola ${customerName}, te recordamos tu reserva para mañana a las ${time}, ${people} persona${people !== 1 ? 's' : ''}. ¡Te esperamos!`
  }
  return `${businessName}: Hola ${customerName}, actualización sobre tu reserva del ${dateStr} a las ${time}.`
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
    return `✅ ${businessName}: Hola ${customerName}, tu pedido (${total.toFixed(2)}€) para ${orderType} está confirmado. Te avisamos cuando esté listo.`
  }
  if (status === 'ready') {
    return `🍽️ ${businessName}: ¡${customerName}, tu pedido está listo! Puedes pasar a recogerlo.`
  }
  if (status === 'delivering') {
    return `🚗 ${businessName}: ${customerName}, tu pedido va en camino. ¡Llegará en breve!`
  }
  return `${businessName}: Actualización de tu pedido, ${customerName}.`
}
