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
  // Deduplicate: don't insert if same content exists recently (last 24h)
  const { count } = await supabase
    .from('business_memory')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', params.tenantId)
    .eq('memory_type', params.memoryType)
    .eq('content', params.content)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  if ((count || 0) > 0) return // Already learned this recently

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

  const now = Date.now()

  // Apply temporal decay: memories older than 30 days get reduced weight
  const weightedMemories = memories.map(m => {
    const age = (now - new Date(m.created_at).getTime()) / (1000 * 60 * 60 * 24)
    const decay = age > 90 ? 0.3 : age > 30 ? 0.6 : 1.0
    return { ...m, weight: (m.confidence || 0.8) * decay }
  })

  // Analyze correction patterns with weights
  const corrections = weightedMemories.filter(m => m.memory_type === 'correction')
  const recentCorrections = corrections.filter(m => m.weight > 0.5)
  const patterns = weightedMemories.filter(m => m.memory_type === 'pattern')

  let confidenceThreshold = 0.7

  // If there are many RECENT corrections, raise threshold
  if (recentCorrections.length >= 5) {
    confidenceThreshold = 0.82
  } else if (recentCorrections.length >= 3) {
    confidenceThreshold = 0.76
  }

  // If patterns show high success rate, lower threshold
  const confirmedPatterns = patterns.filter(p => p.content?.includes('confirmed') && p.weight > 0.5)
  const recentPatterns = patterns.filter(p => p.weight > 0.5)
  if (recentPatterns.length > 10 && confirmedPatterns.length / recentPatterns.length > 0.8) {
    confidenceThreshold = Math.max(0.6, confidenceThreshold - 0.05)
  }

  // Auto-confirm: disable only if RECENT corrections are high
  const autoConfirmEnabled = recentCorrections.length < 8

  // Large group threshold from recent memory
  const largeGroupMemories = weightedMemories.filter(m => m.content?.includes('large_group') && m.weight > 0.5)
  const largeGroupThreshold = largeGroupMemories.length >= 3 ? 6 : 8

  return { confidenceThreshold, autoConfirmEnabled, largeGroupThreshold }
}
