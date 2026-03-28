import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

/**
 * POST /api/shifts/notify
 * Sends SMS to all employees with their shifts for the specified week.
 * Body: { from: "2026-03-24", to: "2026-03-30" }
 */
export async function POST(req: Request) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.messaging, 'shifts:notify')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const tenantId = auth.tenantId

    const body = await req.json()
    const { from, to } = body
    if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })

    // Get tenant name
    const { data: tenant } = await admin.from('tenants')
      .select('name').eq('id', tenantId).maybeSingle()
    const businessName = (tenant as any)?.name || 'tu negocio'

    // Get all active employees with phone numbers
    const { data: employees } = await admin.from('employees')
      .select('id, name, phone')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .not('phone', 'is', null)

    if (!employees || employees.length === 0) {
      return NextResponse.json({ success: true, sent: 0, reason: 'No employees with phone numbers' })
    }

    // Get all shifts for the week
    const { data: shifts } = await admin.from('employee_shifts')
      .select('employee_id, date, start_time, end_time')
      .eq('tenant_id', tenantId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })

    // Build a map of dates in the range for "libre" detection
    const allDates: string[] = []
    const d = new Date(from + 'T00:00:00')
    const endDate = new Date(to + 'T00:00:00')
    while (d <= endDate) {
      allDates.push(d.toISOString().slice(0, 10))
      d.setDate(d.getDate() + 1)
    }

    let sentCount = 0
    const errors: string[] = []

    for (const emp of employees) {
      // Build shift schedule text for this employee
      const empShifts = (shifts || []).filter((s: any) => s.employee_id === emp.id)
      const shiftsByDate: Record<string, any[]> = {}
      for (const s of empShifts) {
        if (!shiftsByDate[s.date]) shiftsByDate[s.date] = []
        shiftsByDate[s.date].push(s)
      }

      const lines: string[] = []
      for (const date of allDates) {
        const dayOfWeek = DAY_NAMES[new Date(date + 'T00:00:00').getDay()]
        const dayShifts = shiftsByDate[date]
        if (dayShifts && dayShifts.length > 0) {
          const times = dayShifts.map((s: any) => `${s.start_time}-${s.end_time}`).join(', ')
          lines.push(`${dayOfWeek} ${times}`)
        } else {
          lines.push(`${dayOfWeek} libre`)
        }
      }

      const message = `Hola ${emp.name}, tus turnos esta semana:\n${lines.join('\n')}\n${businessName}`

      // Send SMS via internal endpoint
      try {
        const smsRes = await fetch(new URL('/api/sms/send', req.url).toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('authorization') || '',
          },
          body: JSON.stringify({ to: emp.phone, message, type: 'shift-notify' }),
        })
        const smsData = await smsRes.json()
        if (smsData.ok) sentCount++
        else errors.push(`${emp.name}: ${smsData.reason || 'failed'}`)
      } catch (err) {
        errors.push(`${emp.name}: SMS request failed`)
      }
    }

    logger.info('shifts:notify completed', { tenantId, sentCount, total: employees.length })
    return NextResponse.json({ success: true, sent: sentCount, total: employees.length, errors: errors.length > 0 ? errors : undefined })
  } catch (e: any) {
    logger.error('shifts:notify failed', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
