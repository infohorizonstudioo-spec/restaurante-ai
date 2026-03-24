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
    .select('id,memory_type,content,confidence,active,created_at')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .gte('confidence', 0.5)
    .order('confidence', { ascending: false })
    .limit(30)
  return data || []
}

export function buildMemoryContext(memories: any[]): string {
  if (!memories.length) return ''
  return memories.map(m => `[${m.memory_type}] ${m.content}`).join('\n')
}

export function getAdaptiveThresholds(memories: any[]): { confidenceThreshold: number; autoConfirmEnabled: boolean; largeGroupThreshold: number } {
  if (!memories || memories.length === 0) {
    return { confidenceThreshold: 0.7, autoConfirmEnabled: true, largeGroupThreshold: 8 }
  }

  // Analyze correction patterns to adjust confidence
  const corrections = memories.filter(m => m.memory_type === 'correction')
  const patterns = memories.filter(m => m.memory_type === 'pattern')

  let confidenceThreshold = 0.7

  // If there are many corrections (agent was wrong often), raise the threshold
  if (corrections.length >= 5) {
    confidenceThreshold = 0.82  // Be more cautious
  } else if (corrections.length >= 3) {
    confidenceThreshold = 0.76
  }

  // If patterns show high success rate, lower the threshold slightly
  const confirmedPatterns = patterns.filter(p => p.content?.includes('confirmed'))
  const totalPatterns = patterns.length
  if (totalPatterns > 10 && confirmedPatterns.length / totalPatterns > 0.8) {
    confidenceThreshold = Math.max(0.6, confidenceThreshold - 0.05)  // More trusting
  }

  // Auto-confirm: disable if too many corrections
  const autoConfirmEnabled = corrections.length < 8

  // Large group threshold: check if there are large_group flags
  const largeGroupMemories = memories.filter(m => m.content?.includes('large_group'))
  const largeGroupThreshold = largeGroupMemories.length >= 3 ? 6 : 8

  return { confidenceThreshold, autoConfirmEnabled, largeGroupThreshold }
}
