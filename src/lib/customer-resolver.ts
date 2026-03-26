/**
 * Cross-channel customer identity resolution.
 * Matches customers by phone, email, or WhatsApp across all channels.
 */
import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from './phone-utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface ResolvedCustomer {
  customerId: string
  isNew: boolean
  customerData: {
    id: string
    name: string
    phone?: string | null
    email?: string | null
    whatsapp_phone?: string | null
    preferred_channel?: string
    channel_identifiers?: Record<string, string[]>
    vip?: boolean
    total_reservations?: number
    notes?: string | null
  }
}

export async function resolveCustomer(params: {
  tenantId: string
  phone?: string | null
  email?: string | null
  whatsappPhone?: string | null
  name?: string | null
  channel: string
}): Promise<ResolvedCustomer> {
  const { tenantId, email, name, channel } = params
  const phone = normalizePhone(params.phone)
  const whatsappPhone = normalizePhone(params.whatsappPhone || params.phone)

  let customer: any = null

  // 1. Search by phone (most common identifier)
  if (phone && !customer) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .maybeSingle()
    customer = data
  }

  // 2. Search by whatsapp_phone
  if (whatsappPhone && !customer) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('whatsapp_phone', whatsappPhone)
      .maybeSingle()
    customer = data
  }

  // 3. Search by email
  if (email && !customer) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('email', email)
      .maybeSingle()
    customer = data
  }

  // 4. If found, update identifiers
  if (customer) {
    const identifiers = customer.channel_identifiers || {}
    let needsUpdate = false
    const updates: Record<string, any> = {}

    // Add new phone identifiers
    if (phone && customer.phone !== phone) {
      if (!customer.phone) {
        updates.phone = phone
        needsUpdate = true
      }
    }
    if (whatsappPhone && customer.whatsapp_phone !== whatsappPhone) {
      updates.whatsapp_phone = whatsappPhone
      needsUpdate = true
    }
    if (email && (!customer.email || customer.email.toLowerCase() !== email.toLowerCase())) {
      if (!customer.email) {
        updates.email = email
        needsUpdate = true
      }
    }

    // Update channel_identifiers JSONB
    const phones = new Set(identifiers.phones || [])
    const emails = new Set(identifiers.emails || [])
    const whatsapps = new Set(identifiers.whatsapp || [])

    if (phone) phones.add(phone)
    if (email) emails.add(email.toLowerCase())
    if (whatsappPhone) whatsapps.add(whatsappPhone)

    const newIdentifiers = {
      phones: [...phones],
      emails: [...emails],
      whatsapp: [...whatsapps],
    }

    if (JSON.stringify(newIdentifiers) !== JSON.stringify(identifiers)) {
      updates.channel_identifiers = newIdentifiers
      needsUpdate = true
    }

    // Update preferred channel if this is the first time on this channel
    if (channel && customer.preferred_channel !== channel) {
      updates.preferred_channel = channel
      needsUpdate = true
    }

    // Update name if provided and current name is empty
    if (name && !customer.name) {
      updates.name = name
      needsUpdate = true
    }

    if (needsUpdate) {
      await supabase
        .from('customers')
        .update(updates)
        .eq('id', customer.id)
        .eq('tenant_id', tenantId)
      Object.assign(customer, updates)
    }

    return {
      customerId: customer.id,
      isNew: false,
      customerData: customer,
    }
  }

  // 5. Create new customer
  const newCustomer: Record<string, any> = {
    tenant_id: tenantId,
    name: name || 'Cliente sin nombre',
    preferred_channel: channel,
    channel_identifiers: {
      phones: phone ? [phone] : [],
      emails: email ? [email.toLowerCase()] : [],
      whatsapp: whatsappPhone ? [whatsappPhone] : [],
    },
  }
  if (phone) newCustomer.phone = phone
  if (email) newCustomer.email = email
  if (whatsappPhone) newCustomer.whatsapp_phone = whatsappPhone

  const { data: created } = await supabase
    .from('customers')
    .insert(newCustomer)
    .select('*')
    .maybeSingle()

  return {
    customerId: created?.id || '',
    isNew: true,
    customerData: created || newCustomer,
  }
}
