/**
 * RESERVO.AI — Memoria de Psicología por tenant
 * Aprende patrones: tipos de sesión más frecuentes, modalidad preferida.
 * MÁXIMA PRIVACIDAD — nunca guarda contenido de sesiones.
 */
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export interface PsicoMemory {
  tenantId:          string
  topSessionTypes:   string[]   // primera_sesion, seguimiento, pareja...
  topModality:       string     // presencial | online
  avgSessionDuration:number     // minutos
  newPatientRate:    number     // % primeras sesiones
  totalSessions:     number
}

const DEFAULT_PSICO_MEMORY: Omit<PsicoMemory, 'tenantId'> = {
  topSessionTypes:    ['seguimiento', 'primera_sesion'],
  topModality:        'presencial',
  avgSessionDuration: 50,
  newPatientRate:     0.25,
  totalSessions:      0,
}

export async function getPsicoMemory(tenantId: string): Promise<PsicoMemory> {
  try {
    const { data: tenant } = await admin.from('tenants')
      .select('agent_config').eq('id', tenantId).maybeSingle()
    const cfg = (tenant?.agent_config as any)?.psico_memory
    if (cfg) return { tenantId, ...DEFAULT_PSICO_MEMORY, ...cfg }

    // Calcular desde historial — solo metadatos, sin contenido
    const { data: sessions } = await admin
      .from('consultation_events')
      .select('consultation_type, duration_minutes')
      .eq('tenant_id', tenantId)
      .limit(200)

    if (!sessions || sessions.length === 0)
      return { tenantId, ...DEFAULT_PSICO_MEMORY }

    const typeCount: Record<string, number> = {}
    let totalDuration = 0
    let newCount = 0
    for (const s of sessions) {
      const t = s.consultation_type || 'seguimiento'
      typeCount[t] = (typeCount[t] || 0) + 1
      if (s.duration_minutes) totalDuration += s.duration_minutes
      if (t === 'primera_sesion') newCount++
    }
    const topSessionTypes = Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k)

    return {
      tenantId,
      topSessionTypes: topSessionTypes.length ? topSessionTypes : DEFAULT_PSICO_MEMORY.topSessionTypes,
      topModality:     DEFAULT_PSICO_MEMORY.topModality,
      avgSessionDuration: sessions.length > 0 ? Math.round(totalDuration / sessions.length) || 50 : 50,
      newPatientRate:  sessions.length > 0 ? newCount / sessions.length : 0.25,
      totalSessions:   sessions.length,
    }
  } catch {
    return { tenantId, ...DEFAULT_PSICO_MEMORY }
  }
}
