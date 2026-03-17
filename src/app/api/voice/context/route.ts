import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
const CTX: Record<string,string> = {
  restaurante: 'Eres Sofia, recepcionista del restaurante. Gestiona reservas: nombre, fecha, hora, personas, zona (Interior/Terraza). Confirma datos antes de crear.',
  hotel: 'Eres Sofia, recepcionista del hotel. Gestiona reservas de habitacion: nombre, fechas, tipo habitacion, huespedes.',
  clinica: 'Eres Sofia, recepcionista de la clinica. Gestiona citas: nombre paciente, fecha, hora, tipo consulta.',
  otro: 'Eres Sofia, recepcionista virtual. Atiende con profesionalidad y gestiona reservas o citas.',
}
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const callerPhone: string = body.caller_phone || body.from || ''
    const toPhone: string = body.to_number || body.to || ''
    if (!toPhone) return NextResponse.json({ error: 'No destination number' }, { status: 400 })
    const { data: tenant, error: tErr } = await admin.from('tenants')
      .select('id,name,type,plan,agent_name,free_calls_used,free_calls_limit,plan_calls_used,plan_calls_included,subscription_status,language')
      .eq('agent_phone', toPhone).maybeSingle()
    if (tErr || !tenant) return NextResponse.json({ error: 'Tenant not found: '+toPhone }, { status: 404 })
    // TRIAL BLOCK
    const isTrial = ['trial','free'].includes(tenant.plan as string)
    if (isTrial) {
      const used  = (tenant.free_calls_used  as number) || 0
      const limit = (tenant.free_calls_limit as number) || 10
      if (used >= limit) {
        return NextResponse.json({ dynamic_variables: {
          tenant_id: tenant.id, business_name: tenant.name,
          agent_name: tenant.agent_name || 'Sofia', blocked: 'true',
        }, tts_override: 'Lo sentimos, el periodo de prueba ha finalizado. Contacte con el administrador.' })
      }
    }
    const today = new Date().toISOString().slice(0, 10)
    const [zonesRes, reservasRes, callerRes] = await Promise.all([
      admin.from('zones').select('id,name').eq('tenant_id', tenant.id).eq('active', true),
      admin.from('reservations').select('time,people,customer_name').eq('tenant_id', tenant.id).eq('date', today).in('status', ['confirmada','confirmed','pendiente']).order('time'),
      callerPhone ? admin.from('customers').select('name,total_reservations,vip').eq('tenant_id', tenant.id).eq('phone', callerPhone).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ])
    const zones = (zonesRes.data || []).map((z: any) => z.name as string)
    const reservasHoy = (reservasRes.data || []) as any[]
    const caller = callerRes.data as any
    const bizType = ((tenant.type as string) || 'otro').toLowerCase()
    const basePrompt = CTX[bizType] || CTX.otro
    const lines = [
      basePrompt,
      'NEGOCIO: ' + (tenant.name as string),
      tenant.language === 'es' ? 'Habla siempre en espanol con tono profesional y cordial.' : '',
      zones.length > 0 ? 'ZONAS DISPONIBLES: ' + zones.join(', ') : '',
      reservasHoy.length > 0 ? 'RESERVAS HOY (' + reservasHoy.length + '): ' + reservasHoy.map((r: any) => r.time + ' ' + r.people + 'p ' + r.customer_name).join(' | ') : 'RESERVAS HOY: ninguna',
      caller?.name ? 'CLIENTE CONOCIDO: ' + caller.name + (caller.total_reservations ? ', ' + caller.total_reservations + ' reservas previas' : '') + (caller.vip ? ' [VIP]' : '') : '',
      'TENANT_ID: ' + (tenant.id as string),
      'Pasa el tenant_id ' + (tenant.id as string) + ' en check_availability y create_reservation.',
    ].filter(Boolean)
    const context = lines.join(' | ')
    if (callerPhone) {
      const nonDigits = new RegExp('[^0-9]', 'g')
      const digits = callerPhone.replace(nonDigits, '')
      await admin.from('calls').upsert({
        tenant_id: tenant.id, call_sid: 'voice_' + Date.now() + '_' + digits,
        caller_phone: callerPhone, from_number: callerPhone, to_number: toPhone,
        status: 'in-progress', direction: 'inbound',
        started_at: new Date().toISOString(), counted_for_billing: false,
      }, { onConflict: 'call_sid', ignoreDuplicates: true })
    }
    return NextResponse.json({ dynamic_variables: {
      tenant_id: tenant.id, business_name: tenant.name,
      agent_name: tenant.agent_name || 'Sofia',
      system_prompt: context, caller_name: caller?.name || '',
      is_vip: caller?.vip ? 'true' : 'false',
    }})
  } catch (e: any) {
    console.error('voice/context error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}