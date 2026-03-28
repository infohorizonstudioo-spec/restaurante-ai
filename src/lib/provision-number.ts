/**
 * RESERVO.AI — Provisión automática de número receptor
 *
 * El cliente usa SU propio número de negocio (+34...).
 * Nosotros le damos un número receptor al que desviar llamadas.
 *
 * Flujo:
 * 1. Compra número receptor Twilio
 * 2. Crea SIP trunk → Retell
 * 3. Importa número en Retell con el agente
 * 4. Guarda en DB
 * 5. El cliente configura desvío de su número → nuestro número
 */

import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || ''
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''
const RETELL_KEY = process.env.RETELL_API_KEY || ''

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function twilioPost(path: string, body: Record<string, string>) {
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
  const res = await fetch(`https://api.twilio.com${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })
  return res.json()
}

async function twilioGet(path: string) {
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
  const res = await fetch(`https://api.twilio.com${path}`, {
    headers: { 'Authorization': `Basic ${auth}` },
  })
  return res.json()
}

async function trunkPost(path: string, body: Record<string, string>) {
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
  const res = await fetch(`https://trunking.twilio.com${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })
  return res.json()
}

export async function provisionPhoneNumber(tenantId: string, retellAgentId: string): Promise<{
  success: boolean
  agent_phone?: string
  instructions?: string
  error?: string
}> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !RETELL_KEY) {
    return { success: false, error: 'Missing Twilio or Retell credentials' }
  }

  try {
    logger.info('provision-number: starting', { tenantId })

    // 1. Comprar número receptor US
    const search = await twilioGet(
      `/2010-04-01/Accounts/${TWILIO_SID}/AvailablePhoneNumbers/US/Local.json?VoiceEnabled=true&PageSize=1`
    )
    const avail = search.available_phone_numbers?.[0]
    if (!avail) return { success: false, error: 'No numbers available' }

    const purchased = await twilioPost(
      `/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json`,
      { PhoneNumber: avail.phone_number }
    )
    if (!purchased.sid) return { success: false, error: purchased.message || 'Purchase failed' }

    const phoneNumber = purchased.phone_number
    const phoneSid = purchased.sid

    // 2. Crear SIP trunk → Retell
    const trunk = await trunkPost('/v1/Trunks', {
      FriendlyName: `Reservo-${tenantId.slice(0, 8)}`,
      TransferMode: 'enable-all',
    })

    // 3. Origination URI → Retell SIP
    await trunkPost(`/v1/Trunks/${trunk.sid}/OriginationUrls`, {
      FriendlyName: 'Retell', SipUrl: 'sip:sip.retellai.com',
      Priority: '1', Weight: '1', Enabled: 'true',
    })

    // 4. Asociar número al trunk
    await trunkPost(`/v1/Trunks/${trunk.sid}/PhoneNumbers`, {
      PhoneNumberSid: phoneSid,
    })

    // 5. Importar en Retell
    const importRes = await fetch('https://api.retellai.com/import-phone-number', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RETELL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_number: phoneNumber,
        inbound_agent_id: retellAgentId,
        termination_uri: `${TWILIO_SID}.pstn.twilio.com`,
      }),
    })
    const importData = await importRes.json()

    if (importData.status === 'error' && importData.message?.includes('already')) {
      await fetch(`https://api.retellai.com/update-phone-number/${phoneNumber}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${RETELL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inbound_agent_id: retellAgentId }),
      })
    }

    // 6. Guardar en DB
    await supabase.from('tenants').update({
      agent_phone: phoneNumber,
    }).eq('id', tenantId)

    logger.info('provision-number: complete', { tenantId, phoneNumber })

    return {
      success: true,
      agent_phone: phoneNumber,
      instructions: `Configura el desvío de llamadas de tu número de negocio al ${phoneNumber}. En la mayoría de operadores españoles: marca **67*${phoneNumber.replace('+', '00')}# desde tu teléfono fijo.`,
    }
  } catch (err: any) {
    logger.error('provision-number: failed', { tenantId }, err)
    return { success: false, error: err.message }
  }
}
