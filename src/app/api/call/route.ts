import { NextRequest, NextResponse } from 'next/server'
import { getRestaurantByPhone, createOrder } from '@/lib/supabase'

// Twilio llama aquí cuando entra una llamada
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const callSid = formData.get('CallSid') as string
  const to = formData.get('To') as string
  const from = formData.get('From') as string

  // Buscar restaurante por número de teléfono
  const restaurant = await getRestaurantByPhone(to)
  
  if (!restaurant) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response><Say language="es-ES">Lo sentimos, este servicio no está disponible.</Say><Hangup/></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }

  // Crear pedido inicial en BD
  const order = await createOrder(restaurant.id, callSid)
  const baseUrl = process.env.BASE_URL

  // Responder con TwiML que abre WebSocket de Media Streams
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${baseUrl?.replace('https://', '')}/api/stream">
      <Parameter name="restaurantId" value="${restaurant.id}"/>
      <Parameter name="orderId" value="${order.id}"/>
      <Parameter name="callerPhone" value="${from}"/>
    </Stream>
  </Connect>
</Response>`

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' }
  })
}
