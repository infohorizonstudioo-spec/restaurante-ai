import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { createConversation } from '@/lib/elevenlabs'

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await req.json()
    if (!tenantId) return NextResponse.json({ error: 'tenantId requerido' }, { status: 400 })

    const admin = createAdminClient()
    const { data: tenant } = await admin.from('tenants').select('id, name, type').eq('id', tenantId).single()
    if (!tenant) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })

    const { conversationId, signedUrl } = await createConversation({
      tenantId:     tenant.id,
      businessType: tenant.type || 'otro',
      tenantName:   tenant.name,
    })

    return NextResponse.json({ conversationId, signedUrl })
  } catch (e: any) {
    console.error('[voice/start]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
