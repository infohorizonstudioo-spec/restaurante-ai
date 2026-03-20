/**
 * POST /api/voice/order
 * Endpoint mid-call: construye pedidos en tiempo real durante la llamada.
 * ElevenLabs llama esto como client_tool mientras toma el pedido.
 * El panel lo refleja vía Supabase Realtime al instante.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  const t0 = Date.now()
  try {
    const body = await req.json().catch(() => ({}))
    const {
      action = 'update',
      call_sid, tenant_id,
      order_type = 'recoger',
      customer_name, customer_phone,
      items = [], notes, pickup_time,
    } = body

    if (!call_sid || !tenant_id)
      return NextResponse.json({ ok: false, error: 'call_sid y tenant_id requeridos' }, { status: 400 })

    const { data: tenant } = await admin.from('tenants')
      .select('id').eq('id', tenant_id).maybeSingle()
    if (!tenant)
      return NextResponse.json({ ok: false, error: 'tenant no encontrado' }, { status: 404 })

    // Enriquecer con precios del menú para calcular total
    let totalEstimate: number | null = null
    if (items.length > 0) {
      const itemNames = items.map((i: any) => i.name).filter(Boolean)
      const { data: menuItems } = await admin.from('menu_items')
        .select('id,name,price').eq('tenant_id', tenant_id).in('name', itemNames)
      if (menuItems?.length) {
        const priceMap: Record<string, { id: string; price: number }> = {}
        menuItems.forEach((m: any) => { priceMap[m.name.toLowerCase()] = { id: m.id, price: m.price || 0 } })
        totalEstimate = 0
        // Enriquecer items con item_id si no tienen
        for (const item of items) {
          const key = item.name?.toLowerCase()
          if (key && priceMap[key]) {
            if (!item.item_id) item.item_id = priceMap[key].id
            totalEstimate += priceMap[key].price * (item.quantity || 1)
          }
        }
        if (totalEstimate === 0) totalEstimate = null
      }
    }

    const status = { start:'collecting', update:'collecting', confirm:'confirmed', cancel:'cancelled' }[action as string] || 'collecting'

    // Upsert atómico
    const { data: result, error } = await admin.rpc('upsert_order_event', {
      p_call_sid: call_sid, p_tenant_id: tenant_id,
      p_order_type: order_type,
      p_customer_name: customer_name || null,
      p_customer_phone: customer_phone || null,
      p_items: JSON.stringify(items),
      p_notes: notes || null, p_pickup_time: pickup_time || null,
      p_status: status, p_total_estimate: totalEstimate,
    })
    if (error) throw error
    const orderId = (result as any)?.order_event_id

    // Reducir stock si se confirma
    if (action === 'confirm') {
      for (const item of items) {
        if (!item.item_id) continue
        try {
          await admin.rpc('reduce_menu_stock', {
            p_tenant_id: tenant_id, p_item_id: item.item_id,
            p_quantity: item.quantity || 1,
          })
        } catch { /* non-critical */ }
      }
    }

    // Vincular con la llamada activa
    if (orderId) {
      await admin.from('calls').update({ order_event_id: orderId })
        .eq('call_sid', call_sid).eq('tenant_id', tenant_id)
    }

    // Mensaje natural para el agente
    const itemList = items.map((i: any) => `${i.quantity || 1} ${i.name}`).join(', ')
    const messages: Record<string, string> = {
      start:   'Vale, te tomo el pedido.',
      confirm: `Perfecto, pedido confirmado: ${itemList}.${pickup_time ? ' Recogida a las ' + pickup_time + '.' : ''} ¡Hasta pronto!`,
      cancel:  'Entendido, pedido cancelado.',
      update:  items.length ? `Anotado: ${itemList}. ¿Algo más?` : 'Vale, ¿qué más quieres pedir?',
    }

    // Notificación al confirmar
    if (action === 'confirm' && orderId) {
      const name = customer_name || customer_phone || 'Cliente'
      const itemList = items.map((i: any) => `${i.quantity || 1}× ${i.name}`).join(', ')
      await createNotification({
        tenant_id,
        type: 'new_order',
        title: `Pedido confirmado — ${name}`,
        body: `${itemList}${pickup_time ? ' · Recogida ' + pickup_time : ''}`,
        call_sid,
        related_entity_id: orderId,
        target_url: '/pedidos',
        priority: 'info',
      })
    }

    console.log(`order/${action} | sid:${call_sid.slice(0,16)} | items:${items.length} | ${Date.now()-t0}ms`)

    return NextResponse.json({
      ok: true, order_event_id: orderId, status,
      items_count: items.length, total_estimate: totalEstimate,
      message: messages[action] || 'Vale.',
    })
  } catch (e: any) {
    console.error('voice/order error:', e.message)
    return NextResponse.json({ ok: true, error: e.message })
  }
}

export async function GET() {
  return NextResponse.json({ status:'ok', endpoint:'voice/order', actions:['start','update','confirm','cancel'] })
}
