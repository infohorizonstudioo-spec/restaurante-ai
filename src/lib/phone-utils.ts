/**
 * Phone number normalization utilities.
 * Centralizes E.164 formatting used across voice, WhatsApp, SMS channels.
 */

/**
 * Normalize a phone number to E.164 format.
 * Handles common Spanish formats and international prefixes.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  // Strip everything except digits and leading +
  let cleaned = phone.replace(/[^\d+]/g, '')
  if (!cleaned) return null

  // Remove leading + for processing
  const hasPlus = cleaned.startsWith('+')
  if (hasPlus) cleaned = cleaned.slice(1)

  // Already has country code (10+ digits)
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return '+' + cleaned
  }

  // Spanish mobile (9 digits starting with 6 or 7) or landline (9 digits starting with 9)
  if (cleaned.length === 9 && /^[679]/.test(cleaned)) {
    return '+34' + cleaned
  }

  // US/Canada (10 digits)
  if (cleaned.length === 10) {
    return '+1' + cleaned
  }

  // Return with + if we have enough digits
  if (cleaned.length >= 7) {
    return '+' + cleaned
  }

  return null
}

/**
 * Strip the whatsapp: prefix from Twilio WhatsApp numbers.
 * "whatsapp:+34612345678" → "+34612345678"
 */
export function stripWhatsAppPrefix(identifier: string): string {
  return identifier.replace(/^whatsapp:/i, '')
}

/**
 * Format for Twilio WhatsApp API.
 * "+34612345678" → "whatsapp:+34612345678"
 */
export function toWhatsAppFormat(phone: string): string {
  const normalized = normalizePhone(phone)
  if (!normalized) return phone
  return `whatsapp:${normalized}`
}

/**
 * Check if two phone numbers refer to the same number.
 */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a)
  const nb = normalizePhone(b)
  if (!na || !nb) return false
  return na === nb
}

/**
 * Extract a display-friendly phone number.
 * "+34612345678" → "612 345 678"
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return ''
  const normalized = normalizePhone(phone)
  if (!normalized) return phone

  // Spanish numbers
  if (normalized.startsWith('+34') && normalized.length === 12) {
    const local = normalized.slice(3)
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  }

  return normalized
}
