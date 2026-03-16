export const runtime = 'edge'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      tenant_id,
      customer_name,
      customer_phone = '',
      reservation_date,
      reservation_time,
      party_size,
      notes = ''
    } = body

    if (!tenant_id || !customer_name || !reservation_date || !reservation_time || !party_size) {
      return Response.json({ success: false, error: 'Faltan datos obligatorios' }, { status: 400 })
    }

    // Crear o encontrar cliente
    let customerId = null
    try {
      const { data: existing } = await admin
        .from('customers')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('name', customer_name)
        .maybeSingle()

      if (existing) {
        customerId = existing.id
      } else {
        const { data: newCustomer } = await admin
          .from('customers')
          .insert({ tenant_id, name: customer_name, phone: customer_phone })
          .select('id')
          .single()
        customerId = newCustomer?.id
      }
    } catch(e) {}

    // Crear reserva
    const { data: reservation, error } = await admin
      .from('reservations')
      .insert({
        tenant_id,
        customer_id: customerId,
        customer_name,
        customer_phone,
        reservation_date,
        reservation_time,
        party_size: parseInt(party_size),
        notes,
        status: 'confirmed',
        source: 'voice_agent'
      })
      .select()
      .single()

    if (error) throw error

    return Response.json({
      success: true,
      reservation_id: reservation.id,
      message: `Reserva confirmada para ${customer_name}, el ${reservation_date} a las ${reservation_time} para ${party_size} personas.`
    })
  } catch(e: any) {
    console.error('Reservation tool error:', e)
    return Response.json({ success: false, error: e.message }, { status: 500 })
  }
}