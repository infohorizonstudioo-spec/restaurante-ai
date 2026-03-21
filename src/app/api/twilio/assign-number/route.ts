import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function classifyNumber(phone: string): 'personal' | 'business' | 'unknown' {
  const clean = phone.replace(/\s/g,'')
  if (/^\+346\d{8}$/.test(clean)||/^\+347\d{8}$/.test(clean)) return 'personal'
  if (/^[67]\d{8}$/.test(clean)) return 'personal'
  if (/^\+1/.test(clean)||/^\+34[89]/.test(clean)) return 'business'
  return 'unknown'
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
    if (!auth.tenantId) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 403 })

    const { phone, option, acknowledged_warning } = await req.json()

    if (option === 'dedicated') {
      await admin.from('tenants').update({ agent_phone: null }).eq('id', auth.tenantId)
      return NextResponse.json({ success: true, status: 'pending_dedicated',
        message: 'Solicitud registrada. Te asignamos número en menos de 24h.' })
    }

    if (!phone?.trim()) return NextResponse.json({ error: 'Número requerido' }, { status: 400 })

    const cleanPhone = phone.trim()
    const phoneType  = classifyNumber(cleanPhone)

    if (phoneType === 'personal' && !acknowledged_warning) {
      return NextResponse.json({
        error: 'personal_number_warning', phoneType, requiresAck: true,
        message: 'Número personal detectado. El asistente responderá TODAS tus llamadas. Confirma que lo entiendes.',
      }, { status: 422 })
    }

    const { data: existing } = await admin.from('tenants')
      .select('id').eq('agent_phone', cleanPhone).neq('id', auth.tenantId).maybeSingle()
    if (existing) return NextResponse.json({ error: 'Número asignado a otro negocio' }, { status: 409 })

    await admin.from('tenants').update({ agent_phone: cleanPhone }).eq('id', auth.tenantId)

    return NextResponse.json({
      success: true, phone: cleanPhone, phoneType,
      warning: phoneType === 'personal' ? 'Número personal activo.' : null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
