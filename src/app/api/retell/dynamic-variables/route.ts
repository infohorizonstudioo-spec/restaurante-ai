/**
 * RESERVO.AI — Retell Dynamic Variables Webhook
 *
 * Retell llama aquí al inicio de cada llamada inbound para obtener
 * variables dinámicas que se inyectan en el prompt del agente.
 *
 * Aquí es donde la MAGIA ocurre: reconocemos al cliente por teléfono,
 * cargamos toda su memoria, y le decimos al agente exactamente
 * cómo tratarlo. En tiempo real. Antes de que diga ni hola.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { getCustomerProfile } from '@/lib/customer-memory'
import { buildMemoryContext } from '@/lib/tenant-learning'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.webhook, 'retell:dynamic-vars')
  if (rl.blocked) return rl.response

  try {
    const body = await req.json()

    // Retell envía distintos campos según el tipo de llamada
    const agentId = body.agent_id || body.call?.agent_id || ''
    const callerPhone = body.from_number || body.caller_phone || body.caller_number || body.call?.from_number || body.call?.caller_phone || ''
    const calledNumber = body.to_number || body.call?.to_number || ''

    logger.info('Retell dynamic variables requested', { agentId, from: callerPhone })

    // Buscar tenant por agent_id
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id,name,type,agent_name')
      .eq('retell_agent_id', agentId)
      .maybeSingle()

    if (!tenant) {
      logger.warn('Retell dynamic vars: no tenant for agent', { agentId })
      return NextResponse.json({
        current_date: new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        caller_phone: callerPhone,
        customer_context: 'Sin información previa del cliente.',
        business_personality: '',
      })
    }

    // ── 1. Fecha actual formateada ──
    const currentDate = new Date().toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    // ── 2. Contexto del cliente (MEMORIA VIVA) ──
    let customerContext = 'Sin información previa del cliente.'
    if (callerPhone) {
      // Primero: comprobar si es un proveedor devolviendo llamada
      try {
        const { data: pendingCallback } = await supabase
          .from('scheduled_callbacks')
          .select('context,reason')
          .eq('tenant_id', tenant.id)
          .eq('phone', callerPhone)
          .eq('status', 'pending')
          .in('reason', ['supplier_order', 'missed_call_sms'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (pendingCallback?.context) {
          const ctx = typeof pendingCallback.context === 'string' ? JSON.parse(pendingCallback.context) : pendingCallback.context

          if (pendingCallback.reason === 'supplier_order') {
            customerContext = `ATENCION: Este es un PROVEEDOR (${ctx.supplier_name || 'proveedor'}) que nos devuelve la llamada. Le hemos mandado un SMS pidiendole un pedido. Necesitamos: ${(ctx.products || []).join(', ')}. ${ctx.notes || ''} Trata esta llamada como un PEDIDO A PROVEEDOR — confirma los productos, pregunta precios y plazos de entrega. Al terminar llama a save_call_summary con intent=pedido_proveedor.`
          } else if (pendingCallback.reason === 'missed_call_sms') {
            customerContext = `Este cliente nos llamo antes pero no pudimos atenderle. Le enviamos un SMS y ahora nos devuelve la llamada. Saluda con naturalidad tipo: "Hola! Si, perdona que antes no te pudimos coger. Dime, en que te puedo ayudar?" NO digas "buenos dias" ni "digame" — ya sabe quien eres porque le mandaste el SMS.`
          }

          // Marcar como procesado
          await supabase.from('scheduled_callbacks').update({ status: 'completed' }).eq('phone', callerPhone).eq('tenant_id', tenant.id).eq('status', 'pending')
        }
      } catch {}

      // Si no es proveedor, buscar perfil de cliente normal
      if (customerContext === 'Sin información previa del cliente.') {
        try {
          const profile = await getCustomerProfile(tenant.id, callerPhone)
          if (profile) {
            customerContext = profile.promptFragment
          }
        } catch (err) {
          logger.error('Retell dynamic vars: customer profile failed', { tenantId: tenant.id }, err)
        }
      }
    }

    // ── 3. Personalidad del negocio (aprendizaje) ──
    let businessPersonality = ''
    try {
      const { data: memories } = await supabase
        .from('business_memory')
        .select('content,memory_type')
        .eq('tenant_id', tenant.id)
        .eq('active', true)
        .gte('confidence', 0.7)
        .order('confidence', { ascending: false })
        .limit(10)

      if (memories && memories.length > 0) {
        businessPersonality = memories.map(m => `[${m.memory_type}] ${m.content}`).join('\n')
      }
    } catch {}

    const response = {
      current_date: currentDate,
      caller_phone: callerPhone,
      customer_context: customerContext,
      business_personality: businessPersonality,
    }

    logger.info('Retell dynamic variables sent', {
      tenantId: tenant.id,
      hasCustomerContext: customerContext !== 'Sin información previa del cliente.',
    })

    return NextResponse.json(response)
  } catch (err) {
    logger.error('Retell dynamic variables error', {}, err)
    return NextResponse.json({
      current_date: new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      caller_phone: '',
      customer_context: 'Sin información previa del cliente.',
      business_personality: '',
    })
  }
}
