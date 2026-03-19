/**
 * RESERVO.AI — Memoria del Negocio
 * 
 * Carga reglas configuradas por el negocio desde Supabase.
 * Registra correcciones manuales para mejorar decisiones futuras.
 * 
 * El aprendizaje es:
 *   - acumulativo (necesita N casos antes de cambiar regla)
 *   - auditable (todo queda en agent_feedback)
 *   - reversible (las reglas se pueden resetear)
 *   - NO automático en decisiones críticas
 */

import { createClient } from '@supabase/supabase-js'
import { BusinessRules, DEFAULT_RULES, InteractionStatus } from './agent-decision'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Cargar reglas del negocio ───────────────────────────────────────────────

export async function getBusinessRules(tenantId: string): Promise<BusinessRules> {
  try {
    const { data } = await admin
      .from('business_rules')
      .select('rules, patterns')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!data) return DEFAULT_RULES

    return {
      ...DEFAULT_RULES,
      ...(data.rules || {}),
      patterns: { ...DEFAULT_RULES.patterns, ...(data.patterns || {}) },
    }
  } catch {
    return DEFAULT_RULES
  }
}

// ── Registrar feedback del negocio (corrección manual) ─────────────────────

export async function recordFeedback(params: {
  tenant_id:        string
  call_sid:         string
  original_status:  InteractionStatus
  corrected_status: InteractionStatus
  flags:            string[]
  intent:           string
  note?:            string
}): Promise<void> {
  try {
    await admin.from('agent_feedback').insert({
      tenant_id:        params.tenant_id,
      call_sid:         params.call_sid,
      original_status:  params.original_status,
      corrected_status: params.corrected_status,
      flags:            params.flags,
      intent:           params.intent,
      note:             params.note || null,
      created_at:       new Date().toISOString(),
    })
  } catch(e: any) {
    console.error('recordFeedback error:', e.message)
  }
}

// ── Sugerir actualización de regla basada en feedback acumulado ────────────
// Se activa cuando el negocio ha corregido el mismo patrón N veces.
// NO aplica cambios críticos automáticamente — solo sugiere.

const MIN_CORRECTIONS_TO_SUGGEST = 3  // cuántas correcciones antes de sugerir

export async function analyzeFeedbackPatterns(tenantId: string): Promise<{
  suggestions: Array<{ pattern: string; suggested_status: InteractionStatus; count: number }>
}> {
  try {
    const { data } = await admin
      .from('agent_feedback')
      .select('flags, original_status, corrected_status, intent')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!data || data.length === 0) return { suggestions: [] }

    // Contar correcciones por flag+estado
    const counts: Record<string, { corrected: InteractionStatus; count: number }> = {}

    for (const row of data) {
      const flags: string[] = Array.isArray(row.flags) ? row.flags : []
      for (const flag of flags) {
        const key = flag + '|' + row.original_status
        if (!counts[key]) counts[key] = { corrected: row.corrected_status, count: 0 }
        // Solo acumular si la corrección es consistente
        if (counts[key].corrected === row.corrected_status) counts[key].count++
      }
    }

    const suggestions = Object.entries(counts)
      .filter(([, v]) => v.count >= MIN_CORRECTIONS_TO_SUGGEST)
      .map(([key, v]) => ({
        pattern:          key.split('|')[0],
        suggested_status: v.corrected,
        count:            v.count,
      }))

    return { suggestions }
  } catch {
    return { suggestions: [] }
  }
}

// ── Aplicar sugerencia aprobada por el negocio ─────────────────────────────
// Sólo se ejecuta cuando el negocio confirma explícitamente.

export async function applyLearnedRule(
  tenantId: string,
  pattern:  string,
  status:   InteractionStatus,
  approvedBy: string
): Promise<void> {
  try {
    const { data: existing } = await admin
      .from('business_rules')
      .select('id, patterns')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const updatedPatterns = {
      ...(existing?.patterns || {}),
      [pattern]: status,
    }

    if (existing) {
      await admin
        .from('business_rules')
        .update({ patterns: updatedPatterns, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
    } else {
      await admin
        .from('business_rules')
        .insert({ tenant_id: tenantId, patterns: updatedPatterns, rules: {} })
    }

    // Auditar el cambio
    await admin.from('agent_feedback').insert({
      tenant_id:        tenantId,
      call_sid:         'rule_update',
      original_status:  'pending_review',
      corrected_status: status,
      flags:            [pattern],
      intent:           'rule_update',
      note:             'Regla aprobada por ' + approvedBy,
      created_at:       new Date().toISOString(),
    })
  } catch(e: any) {
    console.error('applyLearnedRule error:', e.message)
  }
}
