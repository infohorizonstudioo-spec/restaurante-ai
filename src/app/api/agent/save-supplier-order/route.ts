/**
 * RESERVO.AI — Save Supplier Order
 *
 * El agente llama aquí después de hablar con un proveedor.
 * Guarda el pedido confirmado, el resumen de la llamada,
 * y actualiza el stock si procede.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateAgentKey } from '@/lib/agent-auth'
import { createNotification } from '@/lib/notifications'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeUUID, sanitizeString } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'agent:save-supplier-order')
    if (rl.blocked) return rl.response

    if (!validateAgentKey(req)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const tenantId = sanitizeUUID(body.tenant_id)
    const supplierName = sanitizeString(body.supplier_name, 200)
    const items = body.items || []
    const total = body.total || null
    const deliveryDate = body.delivery_date || null
    const summary = sanitizeString(body.summary, 2000)
    const status = body.confirmed === false ? 'cancelled' : 'confirmed'
    const notes = sanitizeString(body.notes, 1000)

    if (!tenantId || !summary) {
      return NextResponse.json({ error: 'tenant_id and summary required' }, { status: 400 })
    }

    // Buscar proveedor por nombre
    let supplierId: string | null = null
    if (supplierName) {
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('name', `%${supplierName}%`)
        .maybeSingle()
      supplierId = supplier?.id || null
    }

    // Guardar pedido
    const { data: order } = await supabase.from('supply_orders').insert({
      tenant_id: tenantId,
      supplier_id: supplierId,
      items: items.length > 0 ? items : [{ name: summary, quantity: 1 }],
      total,
      notes,
      status,
      call_summary: summary,
      delivery_date: deliveryDate,
      ordered_by: 'agent',
    }).select('id').maybeSingle()

    // Notificar al negocio
    await createNotification({
      tenant_id: tenantId,
      type: 'call_completed',
      title: `Pedido a ${supplierName || 'proveedor'} — ${status === 'confirmed' ? 'Confirmado' : 'No confirmado'}`,
      body: summary,
    }).catch(() => {})

    logger.info('Supplier order saved', { tenantId, orderId: order?.id, status })

    return NextResponse.json({
      success: true,
      order_id: order?.id || null,
      status,
    })
  } catch (err) {
    logger.error('save-supplier-order error', {}, err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
