/**
 * Retell envía el body de custom tools en dos formatos:
 * 1. Con payload_mode: { tenant_id, date, ... } (args at top level)
 * 2. Sin payload_mode: { args: { tenant_id, date }, call: {...} } (args nested)
 *
 * Esta función normaliza ambos formatos.
 */
export function parseRetellBody(body: Record<string, any>): Record<string, any> {
  if (body.args && typeof body.args === 'object') {
    // Retell nested format — extract args to top level
    return { ...body.args, _call: body.call }
  }
  // Already at top level
  return body
}
