import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const dynamic = 'force-dynamic'

/**
 * GET /api/export?type=reservations|calls|customers&format=csv
 * Exports tenant data as CSV for download.
 */
export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'export')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'reservations'
  const tid = auth.tenantId

  let rows: any[] = []
  let headers: string[] = []
  let filename = 'export.csv'

  if (type === 'reservations') {
    const { data } = await admin.from('reservations')
      .select('customer_name,customer_phone,date,time,people,status,source,notes')
      .eq('tenant_id', tid).order('date', { ascending: false }).limit(500)
    rows = data || []
    headers = ['Nombre', 'Teléfono', 'Fecha', 'Hora', 'Personas', 'Estado', 'Origen', 'Notas']
    filename = 'reservas.csv'
  } else if (type === 'calls') {
    const { data } = await admin.from('calls')
      .select('customer_name,caller_phone,status,intent,summary,started_at,duration_seconds')
      .eq('tenant_id', tid).order('started_at', { ascending: false }).limit(500)
    rows = data || []
    headers = ['Nombre', 'Teléfono', 'Estado', 'Intent', 'Resumen', 'Fecha', 'Duración (s)']
    filename = 'llamadas.csv'
  } else if (type === 'customers') {
    const { data } = await admin.from('customers')
      .select('name,phone,email,total_reservations,last_visit,created_at')
      .eq('tenant_id', tid).order('created_at', { ascending: false }).limit(1000)
    rows = data || []
    headers = ['Nombre', 'Teléfono', 'Email', 'Total reservas', 'Última visita', 'Registrado']
    filename = 'clientes.csv'
  } else {
    return NextResponse.json({ error: 'Invalid type. Use: reservations, calls, customers' }, { status: 400 })
  }

  // Build CSV
  const escape = (v: any) => {
    const s = String(v ?? '').replace(/"/g, '""')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
  }

  const csv = [
    headers.join(','),
    ...rows.map(r => Object.values(r).map(escape).join(','))
  ].join('\n')

  return new Response('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
