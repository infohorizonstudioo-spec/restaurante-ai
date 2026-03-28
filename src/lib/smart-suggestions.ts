/**
 * RESERVO.AI — Smart Suggestions Engine
 * Generates daily actionable suggestions for business owners
 * based on their data: reservations, calls, customers, orders, etc.
 */
import { createClient } from '@supabase/supabase-js'

export interface Suggestion {
  id: string
  type: 'inventory' | 'reservations' | 'customers' | 'operations'
  priority: 'high' | 'medium' | 'low'
  icon: string
  title: string
  description: string
  action: string
  actionHref?: string
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function generateSuggestions(tenantId: string): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = []
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  // Tomorrow's date
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)
  const tomorrowDow = tomorrow.getDay() // 0=Sun, 5=Fri

  // Start of current week (Monday)
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - ((now.getDay() + 6) % 7))
  const weekStartStr = weekStart.toISOString().slice(0, 10)

  try {
    // Fetch all needed data in parallel
    const [
      { data: tomorrowReservations },
      { data: missedCalls },
      { data: weekCalls },
      { data: weekReservations },
      { data: recentCustomers },
      { data: tenant },
    ] = await Promise.all([
      // Tomorrow's reservations
      supabase.from('reservations')
        .select('id, customer_name, time, people, status')
        .eq('tenant_id', tenantId)
        .eq('date', tomorrowStr)
        .in('status', ['confirmada', 'confirmed', 'pendiente', 'pending']),

      // Missed calls without callback
      supabase.from('calls')
        .select('id, caller_phone, started_at')
        .eq('tenant_id', tenantId)
        .in('status', ['perdida', 'missed', 'no_answer'])
        .order('started_at', { ascending: false })
        .limit(20),

      // This week's calls (for summary)
      supabase.from('calls')
        .select('id, intent, status')
        .eq('tenant_id', tenantId)
        .gte('started_at', weekStartStr + 'T00:00:00')
        .lte('started_at', today + 'T23:59:59'),

      // This week's reservations created
      supabase.from('reservations')
        .select('id, source')
        .eq('tenant_id', tenantId)
        .gte('created_at', weekStartStr + 'T00:00:00'),

      // Customers who haven't visited recently (at-risk)
      supabase.from('customers')
        .select('id, name, last_visit, visit_count')
        .eq('tenant_id', tenantId)
        .not('last_visit', 'is', null)
        .order('last_visit', { ascending: true })
        .limit(10),

      // Tenant info
      supabase.from('tenants')
        .select('name, type, agent_name')
        .eq('id', tenantId)
        .maybeSingle(),
    ])

    // 1. Tomorrow's reservations alert
    const tomorrowCount = tomorrowReservations?.length || 0
    if (tomorrowCount >= 3) {
      const totalPeople = (tomorrowReservations || []).reduce((s, r) => s + (r.people || 1), 0)
      suggestions.push({
        id: 'tomorrow-reservations',
        type: 'reservations',
        priority: tomorrowCount >= 8 ? 'high' : 'medium',
        icon: '📅',
        title: `Tienes ${tomorrowCount} reservas manana`,
        description: `${totalPeople} personas esperadas. Asegurate de tener todo preparado para manana.`,
        action: 'Ver reservas',
        actionHref: '/reservas',
      })
    }

    // 2. Friday preparation (if tomorrow is Friday)
    if (tomorrowDow === 5) {
      suggestions.push({
        id: 'friday-prep',
        type: 'inventory',
        priority: 'medium',
        icon: '🔥',
        title: 'Viernes es el dia mas fuerte',
        description: 'Revisa stock de carnes, bebidas y productos clave. Asegurate de tener suficiente personal.',
        action: 'Revisar productos',
        actionHref: '/productos',
      })
    }

    // 3. Saturday preparation (if tomorrow is Saturday)
    if (tomorrowDow === 6) {
      suggestions.push({
        id: 'saturday-prep',
        type: 'inventory',
        priority: 'medium',
        icon: '🎉',
        title: 'Sabado — dia fuerte en perspectiva',
        description: 'Prepara el servicio para el fin de semana. Verifica reservas y stock disponible.',
        action: 'Ver agenda',
        actionHref: '/agenda',
      })
    }

    // 4. Missed calls without callback
    const missedCount = missedCalls?.length || 0
    if (missedCount > 0) {
      suggestions.push({
        id: 'missed-calls',
        type: 'operations',
        priority: missedCount >= 3 ? 'high' : 'medium',
        icon: '📞',
        title: `Tienes ${missedCount} llamadas perdidas sin resolver`,
        description: `Hay ${missedCount} llamada${missedCount !== 1 ? 's' : ''} que no se pudieron atender. Revisa si alguna requiere seguimiento.`,
        action: 'Ver llamadas',
        actionHref: '/llamadas',
      })
    }

    // 5. At-risk customers (haven't visited in 30+ days with 3+ previous visits)
    if (recentCustomers && recentCustomers.length > 0) {
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const atRisk = recentCustomers.filter(c =>
        c.last_visit && new Date(c.last_visit) < thirtyDaysAgo && (c.visit_count || 0) >= 3
      )
      if (atRisk.length > 0) {
        const topCustomer = atRisk[0]
        const daysSince = Math.floor((now.getTime() - new Date(topCustomer.last_visit).getTime()) / (1000 * 60 * 60 * 24))
        suggestions.push({
          id: 'at-risk-customer',
          type: 'customers',
          priority: 'low',
          icon: '👤',
          title: `Cliente habitual ${topCustomer.name || 'desconocido'} no viene desde hace ${daysSince} dias`,
          description: atRisk.length > 1
            ? `${atRisk.length} clientes habituales no han vuelto en mas de 30 dias. Considera contactarles.`
            : `Este cliente solia venir con frecuencia. Quizas una llamada o mensaje le anime a volver.`,
          action: 'Ver clientes',
          actionHref: '/clientes',
        })
      }
    }

    // 6. Weekly agent summary
    const totalWeekCalls = weekCalls?.length || 0
    if (totalWeekCalls > 0) {
      const weekReservationsCounted = weekCalls?.filter(c => c.intent === 'reserva').length || 0
      const weekOrders = weekCalls?.filter(c => c.intent === 'pedido').length || 0
      const completedCalls = weekCalls?.filter(c => c.status === 'completada' || c.status === 'completed').length || 0
      const agentName = tenant?.agent_name || 'Tu agente'

      suggestions.push({
        id: 'weekly-summary',
        type: 'operations',
        priority: 'low',
        icon: '🤖',
        title: `${agentName} ha atendido ${totalWeekCalls} llamadas esta semana`,
        description: `${completedCalls} completadas, ${weekReservationsCounted} reservas y ${weekOrders} pedidos gestionados automaticamente.`,
        action: 'Ver estadisticas',
        actionHref: '/estadisticas',
      })
    }

    // 7. Upcoming holidays (Spain-based simple check)
    const nextWeek = new Date(now)
    nextWeek.setDate(nextWeek.getDate() + 7)
    const holidays = getUpcomingHolidays(now, nextWeek)
    if (holidays.length > 0) {
      suggestions.push({
        id: 'holiday-prep',
        type: 'operations',
        priority: 'medium',
        icon: '📆',
        title: `La semana que viene hay ${holidays[0].name}`,
        description: 'Planifica con antelacion: revisa stock, turnos del equipo y reservas previstas.',
        action: 'Ver agenda',
        actionHref: '/agenda',
      })
    }

    // 8. Pending reservations that need confirmation
    const pendingTomorrow = (tomorrowReservations || []).filter(
      r => r.status === 'pendiente' || r.status === 'pending'
    )
    if (pendingTomorrow.length > 0) {
      suggestions.push({
        id: 'pending-confirmations',
        type: 'reservations',
        priority: 'high',
        icon: '⏳',
        title: `${pendingTomorrow.length} reservas de manana sin confirmar`,
        description: 'Revisa y confirma las reservas pendientes para evitar no-shows.',
        action: 'Confirmar reservas',
        actionHref: '/reservas',
      })
    }

  } catch (err) {
    // If any query fails, return whatever suggestions we gathered
  }

  // Sort: high > medium > low
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return suggestions.slice(0, 8)
}

// Simple holiday checker for Spain
function getUpcomingHolidays(from: Date, to: Date): { name: string; date: Date }[] {
  const year = from.getFullYear()
  const holidays = [
    { name: 'Ano Nuevo', date: new Date(year, 0, 1) },
    { name: 'Reyes', date: new Date(year, 0, 6) },
    { name: 'Dia del Trabajador', date: new Date(year, 4, 1) },
    { name: 'Asuncion', date: new Date(year, 7, 15) },
    { name: 'Fiesta Nacional', date: new Date(year, 9, 12) },
    { name: 'Todos los Santos', date: new Date(year, 10, 1) },
    { name: 'Constitucion', date: new Date(year, 11, 6) },
    { name: 'Inmaculada', date: new Date(year, 11, 8) },
    { name: 'Navidad', date: new Date(year, 11, 25) },
    // Next year's early holidays
    { name: 'Ano Nuevo', date: new Date(year + 1, 0, 1) },
    { name: 'Reyes', date: new Date(year + 1, 0, 6) },
  ]

  return holidays.filter(h => h.date >= from && h.date <= to)
}
