/**
 * RESERVO.AI — SMS Builder (Multilanguage)
 *
 * Builds SMS messages for reservation/booking/order events.
 * Returns the message text — does NOT send (that's the API's job).
 * Supports 40+ languages via language-engine.
 * Falls back to Spanish for backwards compatibility.
 */

import { buildMultilangSms, buildMultilangOrderSms, type LangCode } from './language-engine'

export function buildReservationSms(params: {
  businessName: string
  customerName: string
  date: string
  time: string
  people: number
  status: 'confirmed' | 'cancelled' | 'reminder'
  bookingLabel?: string
  language?: string // ISO 639-1 language code
}): string {
  const lang = (params.language || 'es') as LangCode
  const smsType = params.status === 'reminder' ? 'reminder' : params.status

  return buildMultilangSms(lang, smsType, {
    businessName: params.businessName,
    customerName: params.customerName,
    date: params.date,
    time: params.time,
    people: params.people,
    bookingLabel: params.bookingLabel,
  })
}

/**
 * Build a 30-minute reminder SMS in the customer's language.
 */
export function buildReminder30minSms(params: {
  businessName: string
  customerName: string
  date: string
  time: string
  people: number
  bookingLabel?: string
  language?: string
}): string {
  const lang = (params.language || 'es') as LangCode
  return buildMultilangSms(lang, 'reminder_30min', {
    businessName: params.businessName,
    customerName: params.customerName,
    date: params.date,
    time: params.time,
    people: params.people,
    bookingLabel: params.bookingLabel,
  })
}

export function buildOrderSms(params: {
  businessName: string
  customerName: string
  orderType: string
  total: number
  status: 'confirmed' | 'ready' | 'delivering'
  language?: string
}): string {
  const lang = (params.language || 'es') as LangCode
  return buildMultilangOrderSms(lang, params.status, {
    businessName: params.businessName,
    customerName: params.customerName,
    orderType: params.orderType,
    total: params.total,
  })
}
