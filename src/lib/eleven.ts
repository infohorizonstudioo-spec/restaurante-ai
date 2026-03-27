/**
 * RESERVO.AI — ElevenLabs Agent Provisioning (prompt dinámico)
 *
 * provisionElevenAgent(tenantId):
 *   1. Lee tenant de Supabase (nombre, tipo, agent_name)
 *   2. Lee business_knowledge, business_rules, business_memory
 *   3. Usa templates.ts (resolveTemplate) para el agentContext base
 *   4. Reutiliza buildPrompt de provision-agent.ts (prompt completo con personalidad, flujos, idiomas)
 *   5. PATCH al agente en ElevenLabs — SOLO prompt y first_message
 *   6. NO toca voz, LLM, tools, ni enable_conversation_initiation_client_data_from_webhook
 */

import { createClient } from '@supabase/supabase-js'
import { buildPrompt, getFirstMessage } from '@/lib/provision-agent'
import { logger } from '@/lib/logger'
import { sanitizeForLLM } from '@/lib/sanitize'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const EL_KEY = process.env.ELEVENLABS_API_KEY!
const DEFAULT_AGENT_ID = 'agent_0701kkw2sdx5fp685xp6ckngf6zj'

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────
export async function provisionElevenAgent(
  tenantId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // ── 1. Leer tenant de Supabase ──────────────────────────
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name, type, agent_name, el_agent_id')
      .eq('id', tenantId)
      .single()

    if (tenantErr || !tenant) {
      return { success: false, error: `Tenant no encontrado: ${tenantId}` }
    }

    // ── 2. Leer business_knowledge (horarios, servicios, políticas…) ──
    const { data: knowledge } = await supabase
      .from('business_knowledge')
      .select('category, content')
      .eq('tenant_id', tenantId)
      .eq('active', true)

    const kv: Record<string, string> = {}
    for (const k of knowledge || []) {
      kv[k.category] = kv[k.category]
        ? kv[k.category] + '. ' + k.content
        : k.content
    }

    // ── 3. Leer business_rules ──────────────────────────────
    const { data: rules } = await supabase
      .from('business_rules')
      .select('rule_key, rule_value')
      .eq('tenant_id', tenantId)

    const rulesLines: string[] = []
    for (const r of rules || []) {
      if (r.rule_key === 'max_capacity')
        rulesLines.push('Aforo máximo: ' + r.rule_value)
      else if (r.rule_key === 'advance_booking_hours')
        rulesLines.push('Reservas con mínimo ' + r.rule_value + 'h de antelación')
      else if (r.rule_key === 'large_group_min')
        rulesLines.push('Grupos de más de ' + r.rule_value + ' personas: llamar directamente')
      else if (r.rule_key === 'num_professionals')
        rulesLines.push('Profesionales disponibles: ' + r.rule_value)
      else if (r.rule_key === 'slot_duration')
        rulesLines.push('Duración por cita/servicio: ' + r.rule_value + ' minutos')
      else if (r.rule_key === 'total_spaces')
        rulesLines.push('Espacios/mesas totales: ' + r.rule_value)
      else if (r.rule_key === 'closed_days') {
        try {
          rulesLines.push('Cerrado: ' + JSON.parse(r.rule_value).join(', '))
        } catch {
          rulesLines.push('Días cerrados: ' + r.rule_value)
        }
      }
    }

    // ── 4. Leer business_memory (activa, alta confianza) ────
    const { data: memories } = await supabase
      .from('business_memory')
      .select('content, memory_type')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .gte('confidence', 0.7)
      .order('created_at', { ascending: false })
      .limit(10)

    const memoryLines = (memories || []).map((m) => m.content)

    // ── 5. Construir prompt con buildPrompt (prompt completo) ──
    const businessType = tenant.type || 'otro'

    const prompt = buildPrompt({
      agent_name: tenant.agent_name || 'Sofia',
      business_name: tenant.name,
      business_type: businessType,
      business_information: kv.informacion || kv.servicios || '',
      hours: kv.horarios || '',
      services: kv.servicios || '',
      menu: kv.menu || '',
      prices: kv.precios || '',
      policies: kv.politicas || '',
      faqs: kv.faqs || '',
      rules: rulesLines.join('. '),
      memory: memoryLines.join('. '),
      channel: 'voice',
    })

    // ── 6. first_message dinámico por tipo de negocio ───────
    const firstMessage = getFirstMessage(businessType, sanitizeForLLM(tenant.name).slice(0, 100))

    // ── 7. PATCH al agente — SOLO prompt y first_message ────
    const agentId = tenant.el_agent_id || DEFAULT_AGENT_ID

    const patchBody = {
      conversation_config: {
        agent: {
          prompt: { prompt },
          first_message: firstMessage,
        },
      },
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
      {
        method: 'PATCH',
        headers: {
          'xi-api-key': EL_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patchBody),
      },
    )

    if (!res.ok) {
      const errText = await res.text()
      logger.error('ElevenLabs PATCH failed', { tenantId, agentId, status: res.status, errText })
      return {
        success: false,
        error: `ElevenLabs PATCH ${res.status}: ${errText}`,
      }
    }

    return { success: true }
  } catch (err: any) {
    logger.error('provisionElevenAgent failed', { tenantId }, err)
    return { success: false, error: err.message || 'Error inesperado' }
  }
}
