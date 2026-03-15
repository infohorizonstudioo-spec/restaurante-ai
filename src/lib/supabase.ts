import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const DEMO_TENANT_ID_KEY = 'reservo_tenant_id'

export async function getDemoTenant() {
  const { data } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', 'la-bahia')
    .single()
  return data
}

export async function getTenantData(tenantId: string) {
  const [reservations, tables, orders, calls, alerts] = await Promise.all([
    supabase.from('reservations').select('*').eq('tenant_id', tenantId).order('date').order('time'),
    supabase.from('tables').select('*').eq('tenant_id', tenantId).eq('active', true),
    supabase.from('orders').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    supabase.from('calls').select('*').eq('tenant_id', tenantId).order('started_at', { ascending: false }),
    supabase.from('alerts').select('*').eq('tenant_id', tenantId).eq('read', false).order('created_at', { ascending: false }),
  ])
  return {
    reservations: reservations.data || [],
    tables: tables.data || [],
    orders: orders.data || [],
    calls: calls.data || [],
    alerts: alerts.data || [],
  }
}
