/**
 * RESERVO.AI — Notificación SMS para llamadas perdidas y proveedores
 *
 * Tipos:
 * - missed_call: SMS al cliente "Tenemos una llamada perdida tuya, llámanos"
 * - supplier_order: SMS al proveedor "Necesitamos hacer un pedido, llámanos"
 *
 * Cuando el proveedor/cliente llame de vuelta, el agente ya tiene
 * el contexto cargado via dynamic-variables.
 */
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || ''
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'voice:notify')
  if (rl.blocked) return rl.response

  try {
    const body = await req.json()
    const { tenant_id, phone, notify_type, supplier_id, products, notes } = body

    if (!tenant_id || !phone || !notify_type) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    // Auth
    const apiKey = req.headers.get('x-agent-key') || req.headers.get('x_agent_key')
    if (apiKey !== process.env.AGENT_API_KEY) {
      const auth = await requireAuth(req)
      if (!auth.ok || auth.tenantId !== tenant_id) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
    }

    const { data: tenant } = await supabase.from('tenants')
      .select('id,name,agent_phone,phone')
      .eq('id', tenant_id).single()

    if (!tenant) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
    }

    const businessPhone = tenant.phone || tenant.agent_phone || ''
    const fromNumber = tenant.agent_phone || '+12138753573'
    let smsBody = ''

    if (notify_type === 'missed_call') {
      smsBody = `Hola, te escribimos de ${tenant.name}. Hemos visto que nos has llamado y no hemos podido atenderte. Cuando puedas, llamanos al ${businessPhone} y te atendemos. Un saludo.`

      // Guardar contexto para que el agente sepa cuando devuelvan la llamada
      await supabase.from('scheduled_callbacks').insert({
        tenant_id,
        phone,
        reason: 'missed_call_sms',
        context: JSON.stringify({
          type: 'missed_call',
          sms_sent_at: new Date().toISOString(),
          business_name: tenant.name,
        }),
        priority: 'normal',
        scheduled_for: new Date().toISOString(),
        status: 'pending',
      })
    } else if (notify_type === 'supplier_order') {
      // Get supplier info
      let supplierName = ''
      let productList = products || []

      if (supplier_id) {
        const { data: supplier } = await supabase.from('suppliers')
          .select('name,phone,products')
          .eq('id', supplier_id).single()
        if (supplier) {
          supplierName = supplier.name
          if (!productList.length && supplier.products) productList = supplier.products
        }
      }

      const productText = productList.length > 0
        ? ` Necesitamos: ${productList.slice(0, 5).join(', ')}.`
        : ''

      smsBody = `Hola${supplierName ? ' ' + supplierName : ''}, te escribimos de ${tenant.name}. Necesitamos hacer un pedido.${productText}${notes ? ' ' + notes : ''} Cuando puedas, llamanos al ${businessPhone} y lo cerramos. Gracias.`

      // Save pending order context so the agent knows when they call back
      if (supplier_id) {
        await supabase.from('scheduled_callbacks').insert({
          tenant_id,
          phone,
          reason: 'supplier_order',
          context: JSON.stringify({
            supplier_id,
            supplier_name: supplierName,
            products: productList,
            notes: notes || '',
          }),
          priority: 'normal',
          scheduled_for: new Date().toISOString(),
          status: 'pending',
        })
      }
    } else {
      return NextResponse.json({ error: 'Tipo no valido' }, { status: 400 })
    }

    // Send SMS via Twilio
    if (!TWILIO_SID || !TWILIO_TOKEN) {
      return NextResponse.json({ error: 'SMS no configurado' }, { status: 500 })
    }

    const auth64 = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
    const smsParams = new URLSearchParams({
      To: phone,
      From: fromNumber,
      Body: smsBody,
    })

    const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth64}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: smsParams.toString(),
    })
    const smsData = await smsRes.json()

    if (!smsData.sid) {
      logger.error('SMS failed', { error: smsData.message })
      return NextResponse.json({ error: smsData.message || 'Error al enviar SMS' }, { status: 500 })
    }

    logger.info('SMS sent', { to: phone, type: notify_type, sid: smsData.sid })
    return NextResponse.json({ success: true, message_sid: smsData.sid })
  } catch (err: any) {
    logger.error('Notify error', {}, err)
    return NextResponse.json({ error: 'Error al enviar' }, { status: 500 })
  }
}
