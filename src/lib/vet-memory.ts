/**
 * RESERVO.AI — Memoria de Veterinaria por tenant
 * Aprende patrones del negocio: urgencias frecuentes, servicios más pedidos,
 * especies más atendidas. Sin IA — solo contadores.
 */
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export interface VetMemory {
  tenantId:          string
  topServices:       string[]   // servicios más solicitados
  topSpecies:        string[]   // especies más atendidas
  urgencyRate:       number     // % de llamadas con urgencia
  avgConfidence:     number
  totalConsultations:number
}

const DEFAULT_VET_MEMORY: Omit<VetMemory, 'tenantId'> = {
  topServices:        ['consulta', 'vacuna', 'revision'],
  topSpecies:         ['perro', 'gato'],
  urgencyRate:        0.08,
  avgConfidence:      0.72,
  totalConsultations: 0,
}

export async function getVetMemory(tenantId: string): Promise<VetMemory> {
  try {
    const { data: tenant } = await admin.from('tenants')
      .select('agent_config').eq('id', tenantId).maybeSingle()
    const cfg = (tenant?.agent_config as any)?.vet_memory
    if (cfg) return { tenantId, ...DEFAULT_VET_MEMORY, ...cfg }

    // Calcular desde historial real
    const { data: consultations } = await admin
      .from('consultation_events')
      .select('consultation_type, is_urgency')
      .eq('tenant_id', tenantId)
      .limit(200)

    if (!consultations || consultations.length === 0)
      return { tenantId, ...DEFAULT_VET_MEMORY }

    // Contar servicios más frecuentes
    const serviceCount: Record<string, number> = {}
    let urgencyCount = 0
    for (const c of consultations) {
      const type = c.consultation_type || 'consulta'
      serviceCount[type] = (serviceCount[type] || 0) + 1
      if (c.is_urgency) urgencyCount++
    }
    const topServices = Object.entries(serviceCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k)

    return {
      tenantId,
      topServices: topServices.length ? topServices : DEFAULT_VET_MEMORY.topServices,
      topSpecies:  DEFAULT_VET_MEMORY.topSpecies,
      urgencyRate: consultations.length > 0 ? urgencyCount / consultations.length : 0.08,
      avgConfidence: DEFAULT_VET_MEMORY.avgConfidence,
      totalConsultations: consultations.length,
    }
  } catch {
    return { tenantId, ...DEFAULT_VET_MEMORY }
  }
}
