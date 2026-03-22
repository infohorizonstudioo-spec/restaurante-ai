import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function learnFromCall(params: {
  tenantId: string
  memoryType: string
  content: string
  confidence?: number
}): Promise<void> {
  await supabase.from('business_memory').insert({
    tenant_id: params.tenantId,
    memory_type: params.memoryType,
    content: params.content,
    confidence: params.confidence || 0.8,
  })
}

export async function getTenantMemory(tenantId: string): Promise<any[]> {
  const { data } = await supabase
    .from('business_memory')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(20)
  return data || []
}

export function buildMemoryContext(memories: any[]): string {
  if (!memories.length) return ''
  return memories.map(m => `[${m.memory_type}] ${m.content}`).join('\n')
}

export function getAdaptiveThresholds(memories: any[]): Record<string, number> {
  return {
    confidence: 0.7,
    maxWaitSeconds: 5,
    retryCount: 2,
  }
}
