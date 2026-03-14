import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getRestaurantByPhone(phone: string) {
  const { data } = await supabase
    .from('restaurants')
    .select('*')
    .eq('phone_number', phone)
    .eq('active', true)
    .single()
  return data
}

export async function createOrder(restaurantId: string, callSid: string) {
  const { data } = await supabase
    .from('orders')
    .insert({ restaurant_id: restaurantId, call_sid: callSid, status: 'nuevo' })
    .select()
    .single()
  return data
}

export async function updateOrder(orderId: string, updates: any) {
  const { data } = await supabase
    .from('orders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single()
  return data
}

export async function getOrders(restaurantId: string) {
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
  return data || []
}
