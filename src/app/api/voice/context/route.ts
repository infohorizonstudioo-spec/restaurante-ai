import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
const D = {
  tenant_id:'',
  business_name:'Recepcionista',
  agent_name:'Sofia',
  zones:'',
  caller_phone:'',
  today: new Date().toISOString().slice(0,10),
}
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(()=>({}))
    // Acepta payload de ElevenLabs context webhook Y de Twilio
    const agentPhone: string = body?.phone_call?.agent_number || body?.to_number || body?.to || body?.parameters?.to_number || ''
    const callerPhone: string = body?.phone_call?.external_number || body?.caller_phone || body?.from || body?.parameters?.caller_phone || ''
    // Sin telefono -> defaults, nunca error
    if (!agentPhone) {
      return NextResponse.json({ dynamic_variables: { ...D, caller_phone: callerPhone } })
    }
    const { data: tenant } = await admin.from('tenants')
      .select('id,name,type,plan,agent_name,free_calls_used,free_calls_limit,language')
      .eq('agent_phone', agentPhone).maybeSingle()
    // Sin tenant -> defaults, nunca error
    if (!tenant) {
      console.log('context: tenant not found for', agentPhone)
      return NextResponse.json({ dynamic_variables: { ...D, caller_phone: callerPhone } })
    }
    // Trial agotado
    const isTrial = ['trial','free'].includes((tenant.plan as string)||'trial')
    if (isTrial && ((tenant.free_calls_used as number)||0) >= ((tenant.free_calls_limit as number)||10)) {
      return NextResponse.json({ dynamic_variables: { ...D, tenant_id:tenant.id, business_name:tenant.name||D.business_name, caller_phone:callerPhone, blocked:'true' } })
    }
    const today = new Date().toISOString().slice(0,10)
    const [zr,rr,cr] = await Promise.all([
      admin.from('zones').select('name').eq('tenant_id',tenant.id).eq('active',true),
      admin.from('reservations').select('time,people,customer_name').eq('tenant_id',tenant.id).eq('date',today).in('status',['confirmada','confirmed','pendiente']).order('time').limit(10),
      callerPhone ? admin.from('customers').select('name,vip').eq('tenant_id',tenant.id).eq('phone',callerPhone).maybeSingle() : Promise.resolve({data:null}),
    ])
    const zones = (zr.data||[]).map((z:any)=>z.name).join(', ')||D.zones
    const resHoy = (rr.data||[]) as any[]
    const cliente = cr.data as any
    const biz = (tenant.name as string)||D.business_name
    if (callerPhone) {
      const digits = callerPhone.replace(new RegExp('[^0-9]','g'),'')
      await admin.from('calls').upsert({
        tenant_id:tenant.id, call_sid:'ctx_'+Date.now()+'_'+digits,
        caller_phone:callerPhone, from_number:callerPhone, to_number:agentPhone,
        status:'activa', direction:'inbound', started_at:new Date().toISOString(), counted_for_billing:false,
      },{onConflict:'call_sid',ignoreDuplicates:true})
    }
    return NextResponse.json({
      dynamic_variables: {
        tenant_id: tenant.id,
        business_name: biz,
        agent_name: tenant.agent_name||D.agent_name,
        caller_phone: callerPhone,
        zones,
        today,
        reservas_hoy: resHoy.length>0 ? resHoy.map((r:any)=>r.time+' '+r.people+'p '+r.customer_name).join(' | ') : 'Sin reservas',
        cliente_info: cliente?.name ? 'Cliente: '+cliente.name+(cliente.vip?' [VIP]':'') : '',
      },
      conversation_config_override: {
        agent: { first_message: biz+', dígame.' }
      }
    })
  } catch(e:any) {
    console.error('voice/context:',e.message)
    return NextResponse.json({ dynamic_variables: { ...D } })
  }
}