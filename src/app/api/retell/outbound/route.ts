/**
 * RESERVO.AI — Outbound Call API
 *
 * POST /api/retell/outbound
 *
 * Permite al negocio hacer llamadas salientes para:
 * 1. Llamar a proveedores para pedir productos
 * 2. Llamar a clientes para recordatorios/callbacks
 * 3. Llamar a clientes de lista de espera
 * 4. Llamar para seguimiento post-visita
 *
 * El agente se adapta según el tipo de llamada (proveedor vs cliente).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createOutboundCall, createRetellLLM, createRetellAgent, getVoiceForBusiness } from '@/lib/retell'
import { buildConversationStylePrompt, buildMultilingualPersonalityPrompt } from '@/lib/conversation-style'
import { sanitizeUUID, sanitizePhone, sanitizeString } from '@/lib/sanitize'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// PROMPTS PARA LLAMADAS SALIENTES
// ─────────────────────────────────────────────────────────────

function buildSupplierCallPrompt(params: {
  agentName: string
  businessName: string
  supplierName: string
  products: string
  notes: string
}): string {
  const { agentName, businessName, supplierName, products, notes } = params

  return `IDIOMA: ESPAÑOL. Cambiar si el interlocutor habla otro idioma.

IDENTIDAD:
Te llamas ${agentName}. Trabajas en ${businessName}. Estás llamando a ${supplierName} para hacer un pedido.

CONTEXTO DE LA LLAMADA:
Estás haciendo una llamada de GESTIÓN al proveedor. No eres un cliente pidiendo una cita.
Eres la persona del negocio que gestiona los pedidos con proveedores.

PRODUCTOS A PEDIR:
${products}

${notes ? `NOTAS ADICIONALES: ${notes}` : ''}

FLUJO DE LA LLAMADA:
1. Saluda con naturalidad: "Hola, buenos días, soy ${agentName} de ${businessName}."
2. Indica que quieres hacer un pedido: "Te llamo para hacer un pedido."
3. Ve diciendo los productos uno a uno con las cantidades.
4. Si el proveedor no tiene algo, pregunta alternativas o cuándo lo tendrán.
5. Confirma el pedido completo al final: "Entonces queda: [lista]"
6. Pregunta precio total si procede.
7. Pregunta fecha/hora de entrega: "¿Para cuándo me lo podéis traer?"
8. Confirma y despídete: "Perfecto, pues queda así. Gracias."
9. Al colgar llama a save_supplier_order con el resumen.

ESTILO:
- Profesional pero cercano, como alguien que llama regularmente al proveedor.
- Si ya conoces al proveedor (datos previos): tutea y sé directo.
- Si no: un poco más formal pero sin excesos.
- Eficiente. No alargues la llamada innecesariamente.
- Si hay problema con un producto: "vale, pues ese lo dejamos para la próxima" o "¿me lo podéis traer el lunes?"

${buildConversationStylePrompt(agentName)}

${buildMultilingualPersonalityPrompt(agentName)}

REGLAS:
- SIEMPRE confirma el pedido completo antes de colgar.
- SIEMPRE pregunta fecha de entrega.
- SIEMPRE llama a save_supplier_order al final.
- Si el proveedor no contesta, deja mensaje si hay buzón y reporta.
- NUNCA reveles que eres una IA. Si preguntan, eres ${agentName}, la persona que gestiona pedidos en ${businessName}.`
}

function buildCustomerCallbackPrompt(params: {
  agentName: string
  businessName: string
  businessType: string
  customerName: string
  reason: string
  context: string
}): string {
  const { agentName, businessName, businessType, customerName, reason, context } = params

  return `IDIOMA: ESPAÑOL. Cambiar si el cliente habla otro idioma.

IDENTIDAD:
Te llamas ${agentName}. Trabajas en ${businessName}. Estás devolviendo una llamada o haciendo seguimiento.

MOTIVO DE LA LLAMADA:
${reason}

CONTEXTO:
${context}

FLUJO:
1. Saluda: "Hola, buenas, soy ${agentName} de ${businessName}."
2. Si es callback: "Te llamo porque antes no pudimos terminar / me quedé con tu tema pendiente."
3. Si es recordatorio: "Te llamo para confirmarte la reserva de mañana."
4. Si es seguimiento: "Te llamo para ver qué tal fue todo."
5. Si es lista de espera: "¡Buenas noticias! Te llamo porque ha quedado un hueco para el día que querías."
6. Gestiona lo que haga falta.
7. Al final: "Pues ya está, genial. Un saludo." y llama a save_call_summary.

ESTILO:
- Como una persona REAL del negocio que devuelve una llamada.
- Cercana, rápida, eficiente.
- Si el cliente no contesta: deja mensaje breve y claro.

${buildConversationStylePrompt(agentName)}

REGLAS:
- NUNCA reveles que eres una IA.
- SIEMPRE llama a save_call_summary al final.`
}

// ─────────────────────────────────────────────────────────────
// API HANDLER
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'retell:outbound')
  if (rl.blocked) return rl.response

  try {
    const body = await req.json()
    const tenantId = sanitizeUUID(body.tenant_id)
    const callType = body.call_type as string // 'supplier' | 'callback' | 'reminder' | 'waitlist' | 'followup'
    const phone = sanitizePhone(body.phone)

    if (!tenantId || !phone || !callType) {
      return NextResponse.json({ error: 'tenant_id, phone, and call_type required' }, { status: 400 })
    }

    // Verificar autenticación: API key O sesión de usuario autenticado
    const apiKey = req.headers.get('x-agent-key')
    const validKey = process.env.AGENT_API_KEY
    const isApiKeyAuth = validKey && apiKey === validKey

    if (!isApiKeyAuth) {
      // Intentar auth por sesión de usuario
      const { requireAuth } = await import('@/lib/api-auth')
      const auth = await requireAuth(req)
      if (!auth.ok || auth.tenantId !== tenantId) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      }
    }

    // Leer tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id,name,type,agent_name,retell_agent_id,agent_phone')
      .eq('id', tenantId)
      .single()

    if (!tenant) {
      return NextResponse.json({ error: 'tenant not found' }, { status: 404 })
    }

    if (!tenant.retell_agent_id) {
      return NextResponse.json({ error: 'No Retell agent configured. Run provision first.' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!
    const agentApiKey = process.env.AGENT_API_KEY || ''
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (agentApiKey) headers['x-agent-key'] = agentApiKey

    // ── Construir prompt y contexto según tipo de llamada ──
    let dynamicVars: Record<string, string> = {
      current_date: new Date().toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      }),
      caller_phone: phone,
      business_personality: '',
    }

    let callMetadata: Record<string, any> = {
      tenant_id: tenantId,
      call_type: callType,
    }

    if (callType === 'supplier') {
      // Llamada a proveedor
      const supplierName = sanitizeString(body.supplier_name, 100) || 'proveedor'
      const products = sanitizeString(body.products, 2000) || ''
      const notes = sanitizeString(body.notes, 1000) || ''

      dynamicVars.customer_context = buildSupplierCallPrompt({
        agentName: tenant.agent_name || 'Sofia',
        businessName: tenant.name,
        supplierName,
        products,
        notes,
      })
      callMetadata.supplier_name = supplierName
      callMetadata.products = products
    } else {
      // Callback a cliente
      const customerName = sanitizeString(body.customer_name, 100) || ''
      const reason = sanitizeString(body.reason, 500) || 'Seguimiento'
      const context = sanitizeString(body.context, 1000) || ''

      dynamicVars.customer_context = buildCustomerCallbackPrompt({
        agentName: tenant.agent_name || 'Sofia',
        businessName: tenant.name,
        businessType: tenant.type || 'otro',
        customerName,
        reason,
        context,
      })
      callMetadata.customer_name = customerName
      callMetadata.reason = reason
    }

    // Hacer la llamada via Retell
    const result = await createOutboundCall({
      agent_id: tenant.retell_agent_id,
      customer_number: phone,
      from_number: tenant.agent_phone || undefined,
      metadata: callMetadata,
      retell_llm_dynamic_variables: dynamicVars,
    })

    // Registrar en calls
    await supabase.from('calls').insert({
      tenant_id: tenantId,
      call_sid: result.call_id,
      caller_phone: tenant.agent_phone || '',
      customer_name: body.customer_name || body.supplier_name || '',
      status: 'activa',
      intent: callType === 'supplier' ? 'pedido_proveedor' : 'callback',
      summary: `Llamada saliente: ${callType}`,
      started_at: new Date().toISOString(),
      source: 'retell',
    })

    logger.info('Outbound call initiated', { tenantId, callType, callId: result.call_id })

    return NextResponse.json({
      success: true,
      call_id: result.call_id,
      call_type: callType,
    })
  } catch (err: any) {
    logger.error('Outbound call error', {}, err)
    return NextResponse.json({ error: err.message || 'internal error' }, { status: 500 })
  }
}
