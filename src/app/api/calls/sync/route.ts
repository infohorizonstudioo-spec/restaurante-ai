/**
 * Sync llamadas con Retell — actualiza estado y resúmenes
 * Se llama al cargar la página de llamadas para mantener datos frescos
 */
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'

const RETELL_KEY = process.env.RETELL_API_KEY || ''
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'calls:sync')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { data: activeCalls } = await supabase.from('calls')
      .select('id,call_sid')
      .eq('tenant_id', auth.tenantId)
      .eq('status', 'activa')

    let synced = 0
    for (const c of (activeCalls || [])) {
      if (!c.call_sid?.startsWith('call_')) continue
      try {
        const res = await fetch(`https://api.retellai.com/v2/get-call/${c.call_sid}`, {
          headers: { 'Authorization': `Bearer ${RETELL_KEY}` },
        })
        const retell = await res.json()

        if (retell.call_status === 'ended') {
          const analysis = retell.call_analysis || {}
          const duration = retell.end_timestamp && retell.start_timestamp
            ? Math.round((retell.end_timestamp - retell.start_timestamp) / 1000) : 0
          const summary = analysis.call_summary || retell.transcript?.slice(0, 500) || ''
          const isShort = duration < 15

          // Traducir resumen si viene en ingles
          let summaryEs = summary
          if (/^The (call|user|agent)/i.test(summary)) {
            if (summary.includes('brief')) summaryEs = 'Llamada breve, no se completo.'
            else if (summary.includes('order') || summary.includes('delivery')) summaryEs = 'El cliente quiso hacer un pedido.'
            else if (summary.includes('hours') || summary.includes('opening')) summaryEs = 'El cliente pregunto por los horarios.'
            else if (summary.includes('menu') || summary.includes('price')) summaryEs = 'El cliente pregunto por la carta y precios.'
            else if (summary.includes('reservation') || summary.includes('book')) summaryEs = 'El cliente quiso hacer una reserva.'
            else if (summary.includes('cancel')) summaryEs = 'El cliente quiso cancelar.'
            else if (summary.includes('location') || summary.includes('address')) summaryEs = 'El cliente pregunto por la direccion.'
            else if (summary.includes('no interaction')) summaryEs = 'Llamada sin interaccion.'
            else summaryEs = 'Llamada completada.'
          }

          let intent = 'informacion'
          if (isShort) intent = 'perdida'
          else if (/pedido|order|delivery|domicilio/i.test(summary)) intent = 'pedido'
          else if (/reserv|book|mesa|table/i.test(summary)) intent = 'reserva'
          else if (/cancel/i.test(summary)) intent = 'cancelacion'
          else if (/hora|hour|price|menu|carta|direccion|location/i.test(summary)) intent = 'informacion'

          await supabase.from('calls').update({
            status: isShort ? 'perdida' : 'completada',
            intent,
            summary: summaryEs,
            duration_seconds: duration,
          }).eq('id', c.id)
          synced++
        }
      } catch {}
    }

    return NextResponse.json({ synced, total: activeCalls?.length || 0 })
  } catch {
    return NextResponse.json({ error: 'Error de sync' }, { status: 500 })
  }
}
