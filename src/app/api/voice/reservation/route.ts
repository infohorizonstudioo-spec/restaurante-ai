import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tenant_id, customer_name, customer_phone = '', reservation_date, reservation_time, party_size, notes = '' } = body
    if (!tenant_id || !customer_name || !reservation_date || !reservation_time || !party_size) return NextResponse.json({ success: false, error: 'Faltan datos' }, { status: 400 })
    const { data: reservation, error } = await admin.from('reservations').insert({ tenant_id, customer_name, customer_phone, reservation_date, reservation_time, party_size: parseInt(party_size), notes, status: 'confirmada', source: 'voice_agent' }).select().single()
    if (error) throw error
    return NextResponse.json({ success: true, reservation_id: reservation.id, message: `Reserva confirmada para ${customer_name} el ${reservation_date} a las ${reservation_time}.` })
  } catch(e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }) }
}