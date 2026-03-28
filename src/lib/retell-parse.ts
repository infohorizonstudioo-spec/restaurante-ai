/**
 * Retell envia el body de custom tools con 'arguments' como string JSON.
 * Los constant_value (como tenant_id) a veces NO se incluyen.
 * Esta funcion parsea el body y extrae lo que necesitamos.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function parseRetellBody(body: Record<string, any>): Promise<Record<string, any>> {
  let parsed: Record<string, any> = {}

  // Parse arguments string
  if (body.arguments && typeof body.arguments === 'string') {
    try { parsed = JSON.parse(body.arguments) } catch { parsed = {} }
  } else if (body.args && typeof body.args === 'object') {
    parsed = body.args
  } else {
    parsed = { ...body }
  }

  // Remove execution_message (not useful)
  delete parsed.execution_message

  // If no tenant_id, try to get it from the call context
  if (!parsed.tenant_id && body.call) {
    const agentId = body.call.agent_id || body.call.metadata?.agent_id
    if (agentId) {
      const { data } = await supabase
        .from('tenants')
        .select('id')
        .eq('retell_agent_id', agentId)
        .maybeSingle()
      if (data) parsed.tenant_id = data.id
    }
  }

  // Add call metadata
  parsed._call = body.call || {}
  parsed._caller_phone = body.call?.from_number || body.call?.caller_phone || ''

  return parsed
}
