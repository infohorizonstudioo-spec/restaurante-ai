import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Detecta si un número parece personal (móvil español) o de negocio
function classifyNumber(phone: string): 'personal' | 'business' | 'unknown' {
  const clean = phone.replace(/\s/g,'')
  if (/^\+346\d{8}$/.test(clean)||/^\+347\d{8}$/.test(clean)) return 'personal'
  if (/^[67]\d{8}$/.test(clean)) return 'personal'
  if (/^\+1/.test(clean)||/^\+34[89]/.test(clean)) return 'business'
  return 'unknown'
}

export async function POST(req: Request) {
  try {
    const { tenant_id, phone, option, acknowledged_warning } = await req.json()
    if (!tenant_id) return NextResponse.json({ error: 'tenant_id requerido' }, { status: 400 })

    // Número exclusivo solicitado — marcar pendiente
    if (option === 'dedicated') {
      await admin.from('tenants').update({ agent_phone: null }).eq('id', tenant_id)
      return NextResponse.json({ success: true, status: 'pending_dedicated',
        message: 'Solicitud registrada. Te asignamos número en menos de 24h.' })
    }

    // Número propio — validar
    if (!phone?.trim()) return NextResponse.json({ error: 'Número requerido' }, { status: 400 })

    const cleanPhone = phone.trim()
    const phoneType  = classifyNumber(cleanPhone)

    // Número personal sin confirmación de aviso
    if (phoneType === 'personal' && !acknowledged_warning) {
      return NextResponse.json({
        error: 'personal_number_warning', phoneType, requiresAck: true,
        message: 'Número personal detectado. El asistente responderá TODAS tus llamadas. Confirma que lo entiendes.',
      }, { status: 422 })
    }

    // Verificar duplicado entre tenants
    const { data: existing } = await admin.from('tenants')
      .select('id').eq('agent_phone', cleanPhone).neq('id', tenant_id).maybeSingle()
    if (existing) return NextResponse.json({ error: 'Número asignado a otro negocio' }, { status: 409 })

    await admin.from('tenants').update({ agent_phone: cleanPhone }).eq('id', tenant_id)

    return NextResponse.json({
      success: true, phone: cleanPhone, phoneType,
      warning: phoneType === 'personal' ? 'Número personal activo. El asistente responderá todas las llamadas.' : null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
