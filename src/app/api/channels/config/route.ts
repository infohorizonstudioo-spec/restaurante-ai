/**
 * GET/PUT /api/channels/config
 * Read and update channel configuration per tenant.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeString, sanitizeObject } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'channels:config:get')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const tenantId = auth.tenantId
    const channel = req.nextUrl.searchParams.get('channel')

    let query = supabase.from('channel_configs').select('*').eq('tenant_id', tenantId)
    if (channel) query = query.eq('channel', channel)

    const { data, error } = await query
    if (error) {
      logger.error('Channel config query failed', { channel }, error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, configs: channel ? (data?.[0] || null) : data })
  } catch (err) {
    logger.error('Channel config GET failed', {}, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'channels:config:put')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const rawBody = await req.json()
    const body = sanitizeObject(rawBody)
    const { channel, ...updates } = body

    logger.info('Channel config update', { tenantId: auth.tenantId, channel })
    const tenant_id = auth.tenantId
    if (!channel) {
      return NextResponse.json({ error: 'channel required' }, { status: 400 })
    }

    // Upsert channel config
    const { data, error } = await supabase.from('channel_configs')
      .upsert({
        tenant_id,
        channel,
        ...updates,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,channel' })
      .select('*')
      .maybeSingle()

    if (error) {
      logger.error('Channel config upsert failed', { channel }, error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Update tenant's channels_enabled array
    const { data: allConfigs } = await supabase.from('channel_configs')
      .select('channel').eq('tenant_id', tenant_id).eq('enabled', true)

    const enabledChannels = ['voice', ...(allConfigs || []).map(c => c.channel)]
    await supabase.from('tenants')
      .update({ channels_enabled: [...new Set(enabledChannels)] })
      .eq('id', tenant_id)

    return NextResponse.json({ success: true, config: data })
  } catch (err) {
    logger.error('Channel config PUT failed', {}, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
