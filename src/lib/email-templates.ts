/**
 * HTML email templates for automated responses.
 * Clean, responsive design matching the RESERVO.AI brand.
 * Adapts terminology per business type (reserva/cita/sesión/clase).
 */

import { escapeHtml } from './sanitize'

function baseTemplate(businessName: string, content: string): string {
  businessName = escapeHtml(businessName)
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
  <tr><td style="background:#0C1018;padding:24px 32px;">
    <span style="color:#F0A84E;font-size:20px;font-weight:700;">${businessName}</span>
  </td></tr>
  <tr><td style="padding:32px;color:#333;font-size:15px;line-height:1.6;">
    ${content}
  </td></tr>
  <tr><td style="padding:16px 32px;background:#f9f9f9;color:#999;font-size:12px;text-align:center;">
    ${businessName} · Powered by Reservo.AI
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

export function agentResponseEmail(params: {
  businessName: string
  customerName?: string
  agentName: string
  responseContent: string
}): string {
  const { businessName, customerName, agentName, responseContent } = params
  const safeCustomer = customerName ? escapeHtml(customerName) : ''
  const safeAgent = escapeHtml(agentName)
  const safeBusiness = escapeHtml(businessName)
  const safeContent = escapeHtml(responseContent).replace(/\n/g, '<br>')
  const greeting = safeCustomer ? `Hola ${safeCustomer},` : 'Hola,'
  const content = `
    <p>${greeting}</p>
    <div style="white-space:pre-wrap;">${safeContent}</div>
    <p style="margin-top:24px;color:#666;">Un saludo,<br><strong>${safeAgent}</strong><br>${safeBusiness}</p>
  `
  return baseTemplate(businessName, content)
}

export function reservationConfirmationEmail(params: {
  businessName: string
  customerName: string
  date: string
  time: string
  people: number
  notes?: string
  bookingLabel?: string // "reserva" | "cita" | "sesión" | "clase" | "visita"
  peopleLabel?: string  // "Personas" | "Pacientes" | "Participantes" | "Alumnos"
}): string {
  const { businessName, customerName, date, time, people, notes } = params
  const label = escapeHtml(params.bookingLabel || 'reserva')
  const pLabel = escapeHtml(params.peopleLabel || 'Personas')
  const safeCustomer = escapeHtml(customerName)
  const safeTime = escapeHtml(time)
  const safeNotes = notes ? escapeHtml(notes) : ''
  const dateStr = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
  const safeDateStr = escapeHtml(dateStr)
  const content = `
    <p>Hola ${safeCustomer},</p>
    <p>Te confirmo tu ${label}:</p>
    <table style="background:#f9f9f9;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8">
      <tr><td style="color:#666;">Fecha</td><td style="font-weight:600;">${safeDateStr}</td></tr>
      <tr><td style="color:#666;">Hora</td><td style="font-weight:600;">${safeTime}</td></tr>
      ${people > 1 ? `<tr><td style="color:#666;">${pLabel}</td><td style="font-weight:600;">${people}</td></tr>` : ''}
      ${safeNotes ? `<tr><td style="color:#666;">Notas</td><td>${safeNotes}</td></tr>` : ''}
    </table>
    <p>¡Te esperamos!</p>
  `
  return baseTemplate(businessName, content)
}

export function reservationCancelledEmail(params: {
  businessName: string
  customerName: string
  date: string
  time: string
  bookingLabel?: string
}): string {
  const { businessName, customerName, date, time } = params
  const label = escapeHtml(params.bookingLabel || 'reserva')
  const safeCustomer = escapeHtml(customerName)
  const safeTime = escapeHtml(time)
  const dateStr = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long'
  })
  const safeDateStr = escapeHtml(dateStr)
  const content = `
    <p>Hola ${safeCustomer},</p>
    <p>Tu ${label} del <strong>${safeDateStr}</strong> a las <strong>${safeTime}</strong> queda cancelada.</p>
    <p>Si necesitas cualquier cosa, escríbenos o llámanos sin problema.</p>
  `
  return baseTemplate(businessName, content)
}
