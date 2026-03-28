/**
 * RESERVO.AI — Supplier Auto-Order Cron
 *
 * Runs weekly (Monday 8am via Vercel Cron).
 * For each tenant with active suppliers:
 *   1. Check inventory_items where current_stock <= min_stock
 *   2. Group low-stock items by supplier_id
 *   3. For each supplier with items to order:
 *      - Create a supply_order with status 'pending'
 *      - Send SMS to supplier via Twilio
 *      - Save a scheduled_callback with reason 'supplier_order'
 *
 * Also supports manual trigger via POST from the dashboard (auth required).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || ''
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''

// ─────────────────────────────────────────────────────────────
// SMS helper (same Twilio pattern as voice/notify)
// ─────────────────────────────────────────────────────────────

async function sendSms(from: string, to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return { ok: false, error: 'Twilio not configured' }
  }
  const auth64 = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
  const params = new URLSearchParams({ To: to, From: from, Body: body })

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth64}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
  )
  const data = await res.json()
  if (!data.sid) {
    return { ok: false, error: data.message || 'SMS send failed' }
  }
  return { ok: true, sid: data.sid }
}

// ─────────────────────────────────────────────────────────────
// Core logic: process a single tenant
// ─────────────────────────────────────────────────────────────

interface OrderResult {
  tenant_id: string
  orders_created: number
  sms_sent: number
  errors: string[]
}

async function processSupplierOrders(tenantId: string, tenantName: string, agentPhone: string, businessPhone: string): Promise<OrderResult> {
  const result: OrderResult = { tenant_id: tenantId, orders_created: 0, sms_sent: 0, errors: [] }

  // 1. Find low-stock items with a supplier assigned
  // Supabase PostgREST doesn't support column-to-column comparison,
  // so we fetch all active items with a supplier and filter in JS.
  const { data: allItems, error: allErr } = await supabase
    .from('inventory_items')
    .select('id, name, unit, current_stock, min_stock, max_stock, price_per_unit, supplier_id')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .not('supplier_id', 'is', null)

  if (allErr) {
    result.errors.push(`Inventory query error: ${allErr.message}`)
    return result
  }

  const lowItems = (allItems || []).filter(i => i.current_stock <= i.min_stock)
  if (lowItems.length === 0) return result

  // 2. Group by supplier_id
  const bySupplier: Record<string, typeof lowItems> = {}
  for (const item of lowItems) {
    const sid = item.supplier_id!
    if (!bySupplier[sid]) bySupplier[sid] = []
    bySupplier[sid].push(item)
  }

  // 3. For each supplier, create order + SMS + callback
  for (const [supplierId, items] of Object.entries(bySupplier)) {
    try {
      // Get supplier info
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id, name, phone, contact_name')
        .eq('id', supplierId)
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .maybeSingle()

      if (!supplier) continue

      // Build order items with suggested quantity (fill up to max_stock)
      const orderItems = items.map(i => ({
        item_id: i.id,
        name: i.name,
        qty: Math.max(1, (i.max_stock || i.min_stock * 2) - i.current_stock),
        unit: i.unit,
        price: i.price_per_unit || 0,
      }))
      const total = orderItems.reduce((s, i) => s + i.qty * i.price, 0)

      // Create supply_order
      const { error: orderErr } = await supabase.from('supply_orders').insert({
        tenant_id: tenantId,
        supplier_id: supplierId,
        items: orderItems,
        total,
        notes: 'Pedido automático — stock bajo detectado',
        status: 'pending',
        ordered_by: 'system',
        priority: items.some(i => i.current_stock === 0) ? 'urgent' : 'normal',
      })

      if (orderErr) {
        result.errors.push(`Order insert error for supplier ${supplier.name}: ${orderErr.message}`)
        continue
      }
      result.orders_created++

      // Build items list text for SMS (max 5 items to keep SMS short)
      const itemsText = orderItems.slice(0, 5)
        .map(i => `${i.qty} ${i.unit} ${i.name}`)
        .join(', ')
      const moreText = orderItems.length > 5 ? ` y ${orderItems.length - 5} productos mas` : ''

      // Send SMS if supplier has phone
      if (supplier.phone) {
        const contactName = supplier.contact_name || supplier.name
        const fromNumber = agentPhone || '+12138753573'
        const smsBody = `Hola ${contactName}, te escribimos de ${tenantName}. Necesitamos: ${itemsText}${moreText}. Llamanos al ${businessPhone} cuando puedas para confirmar. Gracias.`

        const smsResult = await sendSms(fromNumber, supplier.phone, smsBody)
        if (smsResult.ok) {
          result.sms_sent++
          logger.info('Supplier order SMS sent', { tenantId, supplierId, sid: smsResult.sid })
        } else {
          result.errors.push(`SMS to ${supplier.name} failed: ${smsResult.error}`)
        }

        // Save scheduled_callback so agent has context when supplier calls back
        await supabase.from('scheduled_callbacks').insert({
          tenant_id: tenantId,
          phone: supplier.phone,
          reason: 'supplier_order',
          context: JSON.stringify({
            supplier_id: supplierId,
            supplier_name: supplier.name,
            products: orderItems.map(i => `${i.qty} ${i.unit} ${i.name}`),
            total,
            auto_generated: true,
          }),
          priority: items.some(i => i.current_stock === 0) ? 'high' : 'normal',
          scheduled_for: new Date().toISOString(),
          status: 'pending',
        })
      }
    } catch (err) {
      result.errors.push(`Supplier ${supplierId}: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  return result
}

// ─────────────────────────────────────────────────────────────
// Main cycle: iterate all tenants
// ─────────────────────────────────────────────────────────────

async function runSupplierOrderCycle(singleTenantId?: string): Promise<{
  tenants_processed: number
  total_orders: number
  total_sms: number
  errors: string[]
}> {
  let tenants: { id: string; name: string; agent_phone: string | null; phone: string | null }[] = []

  if (singleTenantId) {
    const { data } = await supabase
      .from('tenants')
      .select('id, name, agent_phone, phone')
      .eq('id', singleTenantId)
      .maybeSingle()
    if (data) tenants = [data]
  } else {
    // Get all tenants that have at least one active supplier
    const { data: supplierTenants } = await supabase
      .from('suppliers')
      .select('tenant_id')
      .eq('active', true)

    const uniqueTenantIds = [...new Set((supplierTenants || []).map(s => s.tenant_id))]
    if (uniqueTenantIds.length > 0) {
      const { data } = await supabase
        .from('tenants')
        .select('id, name, agent_phone, phone')
        .in('id', uniqueTenantIds)
      tenants = data || []
    }
  }

  let totalOrders = 0
  let totalSms = 0
  const allErrors: string[] = []

  for (const t of tenants) {
    try {
      const businessPhone = t.phone || t.agent_phone || ''
      const res = await processSupplierOrders(t.id, t.name || '', t.agent_phone || '', businessPhone)
      totalOrders += res.orders_created
      totalSms += res.sms_sent
      allErrors.push(...res.errors)
    } catch (err) {
      allErrors.push(`Tenant ${t.id}: ${err instanceof Error ? err.message : 'unknown error'}`)
      logger.error('Supplier order failed for tenant', { tenantId: t.id }, err)
    }
  }

  return {
    tenants_processed: tenants.length,
    total_orders: totalOrders,
    total_sms: totalSms,
    errors: allErrors,
  }
}

// ─────────────────────────────────────────────────────────────
// HTTP handlers
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Cron secret auth
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runSupplierOrderCycle()
    logger.info('Supplier order cron completed', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    logger.error('Supplier order cron failed', {}, err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

// POST: manual trigger from dashboard (single tenant)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tenant_id } = body

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
    }

    // Auth: either cron secret or agent key
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const agentKey = req.headers.get('x-agent-key')

    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`
    const isAgentAuth = agentKey === process.env.AGENT_API_KEY

    // For dashboard calls, verify Supabase JWT
    let isUserAuth = false
    if (!isCronAuth && !isAgentAuth) {
      const token = authHeader?.replace('Bearer ', '')
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token)
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .maybeSingle()
          isUserAuth = profile?.tenant_id === tenant_id
        }
      }
    }

    if (!isCronAuth && !isAgentAuth && !isUserAuth) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const result = await runSupplierOrderCycle(tenant_id)
    logger.info('Supplier order manual trigger completed', { tenant_id, ...result })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    logger.error('Supplier order manual trigger failed', {}, err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
