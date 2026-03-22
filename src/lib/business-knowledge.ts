import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function getBusinessKnowledge(tenantId: string): Promise<any[]> {
  const { data } = await supabase
    .from('business_knowledge')
    .select('category,content')
    .eq('tenant_id', tenantId)
  return data || []
}

export function buildKnowledgeContext(knowledge: any[]): string {
  return knowledge.map(k => `${(k.category || 'info').toUpperCase()}: ${k.content}`).join('\n')
}

export async function queryKnowledge(tenantId: string, category: string): Promise<string> {
  const { data } = await supabase
    .from('business_knowledge')
    .select('content')
    .eq('tenant_id', tenantId)
    .eq('category', category)
    .single()
  return data?.content || ''
}
