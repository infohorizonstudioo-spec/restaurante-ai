import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function getBusinessRules(tenantId: string): Promise<Record<string, any>> {
  const { data } = await supabase
    .from('business_rules')
    .select('rule_key,rule_value')
    .eq('tenant_id', tenantId)
  if (!data) return {}
  const rules: Record<string, any> = {}
  data.forEach((r: any) => { rules[r.rule_key] = r.rule_value })
  return rules
}
