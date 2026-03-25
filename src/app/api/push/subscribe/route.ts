/**
 * POST /api/push/subscribe
 * Guarda la suscripción push del navegador en Supabase.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
    if (!auth.tenantId) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 403 })

    const { subscription } = await req.json()
    if (!subscription?.endpoint) return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 })

    // Guardar en push_subscriptions (upsert por endpoint)
    const { error } = await admin.from('push_subscriptions').upsert({
      tenant_id: auth.tenantId,
      user_id:   auth.userId,
      endpoint:  subscription.endpoint,
      p256dh:    subscription.keys?.p256dh || '',
      auth:      subscription.keys?.auth || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('push/subscribe error:', e.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE — eliminar suscripción
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { endpoint } = await req.json()
    await admin.from('push_subscriptions')
      .delete().eq('endpoint', endpoint).eq('tenant_id', auth.tenantId)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
