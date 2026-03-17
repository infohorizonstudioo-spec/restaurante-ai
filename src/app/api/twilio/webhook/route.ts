import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const body = await req.formData()
    const callSid    = body.get('CallSid')?.toString() || ''
    const callerPhone= body.get('From')?.toString()    || ''
    const toPhone    = body.get('To')?.toString()      || ''
    const callStatus = body.get('CallStatus')?.toString() || 'in-progress'
    const duration   = parseInt(body.get('CallDuration')?.toString()||'0')||0

    if (!callSid) return NextResponse.json({ ok: true })

    // Find tenant by agent_phone
    const { data: tenant } = await admin.from('tenants')
      .select('id').eq('agent_phone', toPhone).maybeSingle()

    if (!tenant) return NextResponse.json({ ok: true })

    // Upsert call record usando columnas reales de la tabla calls
    await admin.from('calls').upsert({
      tenant_id:    tenant.id,
      call_sid:     callSid,
      caller_phone: callerPhone,
      from_number:  callerPhone,
      to_number:    toPhone,
      status:       callStatus === 'completed' ? 'completed' : callStatus,
      direction:    'inbound',
      duration_seconds: duration > 0 ? duration : null,
      duration:     duration > 0 ? duration : null,
      started_at:   new Date().toISOString(),
    }, { onConflict: 'call_sid', ignoreDuplicates: false })

    return NextResponse.json({ ok: true })
  } catch(e: any) {
    console.error('Twilio webhook error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}